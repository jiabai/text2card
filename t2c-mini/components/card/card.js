// 卡片组件：单层结构，对齐线上新版 Text2Card（card.pomodiary.com）。
//
// 版面骨架（五套风格共用，只有 class 不同）：
//   card  relative flex flex-col justify-between p-12 shadow-2xl overflow-hidden
//         {square:1:1, portrait:3/4, landscape:4/3}  w-full max-w-[500px]
//     ├ 装饰层  [editorial] 右上角光斑 / [gradient] 整幅白色叠加
//     ├ head   flex justify-between items-start mb-8   → 日期 + (圆环|圆点)
//     ├ body   flex-grow flex items-center             → 正文，垂直居中
//     └ foot   mt-8 flex justify-end items-end         → 固定水印 TEXT2CARD
//
// 尺寸策略：styles.js 里的数值都是网页 px（卡片宽 500 时的值），
// 这里统一乘 k = 实际卡片宽 / 500，所以三种导出格式共用同一套数值，
// 改变导出宽度也只是整体等比缩放，版面比例不会走样。
//
// 断行策略：Skyline 的文本引擎会把英文单词从中间断开，而 word-break 与
// overflow-wrap 实测全部无效，所以走「逐 token inline-block，换行只发生在
// token 之间」。切分规则（英文整词 / CJK 逐字 / 空格挂前一个 token）都在
// utils/tokens.js 里，那边有配套单测 tools/test-tokenize.js 可单独跑，
// 不用起模拟器。
//
// 注意不能图省事用 split(/\s+/)：中文句子没有空格，整句会变成一个
// inline-block，永不换行并直接撑破卡片。

const CFG = require('../../config/styles.js');
const TOKENS = require('../../utils/tokens.js');

const CARD_W = 500; // 网页版卡片宽度 max-w-[500px]
const PAD = 48; // md:p-12
const HEAD_GAP = 32; // mb-8
const FOOT_GAP = 32; // mt-8
const MARK = { size: 10, tracking: 0.1, opacity: 0.4 }; // text-[10px] tracking-widest opacity-40
const WORD_GAP = 0.26; // em，替代被 inline-block 吃掉的空格

// 正文自适应：文字总高超过可用高度时整体缩小字号，最低压到基准的 55%；
// 缩完若仍有富余则按比例回扩，把可用空间吃满（超了就退回最近放得下的字号）。
// 极端情况下宁可裁切也不缩到不可读，短文不受影响（保持基准字号）。
const FIT_MIN = 0.55;
const FIT_TOL = 1; // px，测量容差
const FIT_MAX_RETRY = 6; // 收敛保护：缩小 + 回扩共用这一预算
const FIT_GROW = 1.2; // 单轮回扩上限（换行数随字号非线性，步子大了会来回震荡）

// aspect-[3/4] 是宽高比 3:4，所以竖版高度 = 宽 × 4/3；横版反过来。
const RATIO = {
  square: 1,
  portrait: 4 / 3,
  landscape: 3 / 4
};

const round = (n) => Math.round(n * 100) / 100;

const upper = (s, on) => (on ? String(s || '').toUpperCase() : String(s || ''));

Component({
  properties: {
    // 卡片宽度（px）。预览传屏幕可用宽度，导出传 EXPORT_W。
    size: { type: Number, value: 1000 },
    format: { type: String, value: 'portrait' },
    content: { type: String, value: '' },
    date: { type: String, value: '' },
    style: { type: Object, value: CFG.styles[0] }
  },

  data: {
    s: {},
    lines: [],
    dateText: '',
    markText: ''
  },

  observers: {
    'size, format, style': function () {
      this.recalc();
      this.syncText();
    },
    'content, date': function () {
      this.syncText();
    }
  },

  lifetimes: {
    attached() {
      this.recalc();
      this.syncText();
    },
    detached() {
      if (this._fitTimer) clearTimeout(this._fitTimer);
    }
  },

  methods: {
    recalc() {
      const st = this.data.style || CFG.styles[0];
      const w = Number(this.data.size) || 1000;
      const ratio = RATIO[this.data.format] || RATIO.portrait;
      const k = w / CARD_W; // 网页 px → 本卡 px 的换算系数
      const stacks = CFG.stacks;

      // 正文基准字号（fitText 会在此基础上按需压缩，切风格/格式时重置为 1）
      this._baseTextSize = st.textSize * k;
      this._baseTextLH = st.textSize * st.textLineHeight * k;
      this._fitScale = 1;

      // 渐变要用 background-image，纯色用 background-color，分开给更稳。
      const isGradient = String(st.bg || '').indexOf('gradient') >= 0;

      // 装饰尺寸：blob 是 w-32 = 128px，ring 是 w-8 = 32px，dot 是 w-2 = 8px
      const decorSize =
        st.decor === 'blob' ? 128 * k : st.decor === 'ring' ? 32 * k : 8 * k;

      this.setData({
        s: {
          w: Math.round(w),
          h: Math.round(w * ratio),
          pad: round(PAD * k),
          headGap: round(HEAD_GAP * k),
          footGap: round(FOOT_GAP * k),

          bgColor: isGradient ? 'transparent' : st.bg,
          bgImage: isGradient ? st.bg : 'none',
          borderW: st.borderColor ? round(k) : 0,
          borderColor: st.borderColor || 'transparent',
          textColor: st.textColor,

          textFont: stacks[st.textFont] || stacks.sans,
          textWeight: st.textWeight,
          textItalic: st.textItalic ? 'italic' : 'normal',
          textSize: round(st.textSize * k),
          textLH: round(st.textSize * st.textLineHeight * k),
          textTracking: st.textTracking || 0,
          wordGap: WORD_GAP,

          dateFont: stacks[st.dateFont] || stacks.sans,
          dateSize: round(st.dateSize * k),
          dateColor: st.dateColor || st.textColor,
          dateTracking: st.dateTracking || 0,
          dateOpacity: st.dateOpacity == null ? 1 : st.dateOpacity,

          decor: st.decor || '',
          decorSize: round(decorSize),
          // -mt-10 -mr-10 → -40px，直接用 top/right 表达，避开负 margin
          decorOffset: round(-40 * k),
          decorRingW: round(k),
          decorBlobColor: 'rgba(255,105,0,0.2)', // orange-500/20

          markFont: stacks.sans, // 线上水印只有 text-[10px] opacity-40 uppercase tracking-widest，
          // 没有字体类，继承页面默认 sans —— 不是日期用的那个字体，别跟着 dateFont 走
          markSize: round(MARK.size * k),
          markTracking: MARK.tracking,
          markOpacity: MARK.opacity,
          markColor: st.markWhite ? '#FFFFFF' : st.textColor
        }
      });
    },

    syncText() {
      const self = this;
      const st = this.data.style || CFG.styles[0];
      this.setData(
        {
          lines: TOKENS.buildLines(this.data.content),
          dateText: upper(this.data.date, st.dateUpper),
          markText: 'TEXT2CARD'
        },
        // 渲染完成后再测量，时序才确定（固定延时在 Skyline 上会撞重排竞态）
        function () {
          self.fitTextSoon();
        }
      );
    },

    // —— 正文自适应：测量 .text 与可用空间的高度差，按比例缩小字号 ——

    // 防抖： observers 常成对触发（recalc + syncText），合并成一轮测量
    fitTextSoon() {
      const self = this;
      if (self._fitTimer) clearTimeout(self._fitTimer);
      self._fitTimer = setTimeout(function () {
        self.fitText(0);
      }, 80);
    },

    fitText(retries) {
      const self = this;

      // 每轮 fit 从基准字号起步：仅首轮恢复基准并清空回扩状态，后续复测
      // 保持在当前缩放值上，否则会陷入「缩→重置→量→缩」震荡。
      if (retries === 0) {
        self._fitBest = 0; // 最近一次「放得下」的缩放值
        self._fitDone = false; // 回扩结束标记，防震荡
        if (self._fitScale !== 1) {
          self._fitScale = 1;
          self.setData(
            {
              's.textSize': round(self._baseTextSize),
              's.textLH': round(self._baseTextLH)
            },
            function () {
              self.fitText(0);
            }
          );
          return;
        }
      }

      // 可用高度用几何算：卡内容高 − 头部 − 底部。不能拿 .body 自己的高度用，
      // flex 子项被内容撑高时它和 .text 等高，比出来永远是“放得下”。
      const q = self.createSelectorQuery();
      q.select('.card').boundingClientRect();
      q.select('.head').boundingClientRect();
      q.select('.foot').boundingClientRect();
      q.select('.text').boundingClientRect();
      q.exec(function (res) {
        if (!res || res.length < 4 || !res[0] || !res[1] || !res[2] || !res[3]) {
          return;
        }
        const s = self.data.s;
        const avail =
          res[0].height - s.pad * 2 - res[1].height - s.headGap - res[2].height - s.footGap;
        const need = res[3].height;
        if (!need) return;

        if (need <= avail + FIT_TOL) {
          // 放得下：记下当前缩放值；之前缩过且未收尾时，试着回扩把空间吃满
          self._fitBest = self._fitScale;
          if (self._fitScale >= 1 || self._fitDone) return;
          let grow = self._fitScale * Math.min(FIT_GROW, (avail / need) * 0.98);
          if (grow > 1) grow = 1;
          if (grow <= self._fitScale + 0.01) {
            self._fitDone = true; // 已到基准或增量无意义
            return;
          }
          self._fitScale = grow;
          self.setData(
            {
              's.textSize': round(self._baseTextSize * grow),
              's.textLH': round(self._baseTextLH * grow)
            },
            function () {
              self.fitText(retries + 1);
            }
          );
          return;
        }

        // 溢出：若发生在回扩阶段，退回最近一次放得下的字号，收工
        if (self._fitBest) {
          self._fitDone = true;
          self._fitScale = self._fitBest;
          self.setData({
            's.textSize': round(self._baseTextSize * self._fitBest),
            's.textLH': round(self._baseTextLH * self._fitBest)
          });
          return;
        }
        if (self._fitScale <= FIT_MIN) return; // 已到下限：宁可裁切不再缩
        if (retries >= FIT_MAX_RETRY) return; // 收敛保护

        // 目标高度比 × 0.98 保守系数（换行数随字号变化是非线性的）
        let next = self._fitScale * (avail / need) * 0.98;
        if (next < FIT_MIN) next = FIT_MIN;
        if (next >= self._fitScale) next = self._fitScale * 0.9; // 保证单调推进
        self._fitScale = next;
        // 渲染完成回调里复测，避免拿到重排前的旧高度
        self.setData(
          {
            's.textSize': round(self._baseTextSize * next),
            's.textLH': round(self._baseTextLH * next)
          },
          function () {
            self.fitText(retries + 1);
          }
        );
      });
    }
  }
});
