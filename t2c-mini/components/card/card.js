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
// 高度策略：卡片宽度固定，高度随正文内容自适应（小红书长图模式）。
// format 只决定「最小宽高比」：短文保持方形/竖版/横版的设计观感，
// 长文则在最小高度基础上向下撑高，正文始终保持基准字号，不缩字、不裁切。
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
const PAD = 26; // flomo：正文边距 63/1230 × 500 ≈ 26
const HEAD_GAP = 36; // 日期到正文的呼吸
const FOOT_GAP = 32; // mt-8
const PARA_GAP = 9; // 段距：flomo 22/1230 × 500 ≈ 9。任何换行都产生一次段距（tokens.js 合并连续换行）
const MARK = { size: 12, tracking: 0.1, opacity: 0.4 };
const WORD_GAP = 0.26; // em，替代被 inline-block 吃掉的空格

// 高度自适应：卡片宽度固定，高度随正文增长。
// format 只给「最小宽高比」，长文把卡片向下撑高，正文保持基准字号，
// 不缩字也不裁切。
const H_TOL = 1; // px，测量/取整容差
const H_MAX_RETRY = 8; // 「测量→改高→复测」收敛保护

// aspect-[3/4] 是宽高比 3:4，所以竖版最小高度 = 宽 × 4/3；横版反过来。
// 这里的比例是「下限」：内容超高时实际高度会大于它。
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
      if (this._hTimer) clearTimeout(this._hTimer);
      if (this._hVerify) clearTimeout(this._hVerify);
    }
  },

  methods: {
    recalc() {
      const st = this.data.style || CFG.styles[0];
      const w = Number(this.data.size) || 1000;
      const ratio = RATIO[this.data.format] || RATIO.portrait;
      const k = w / CARD_W; // 网页 px → 本卡 px 的换算系数
      const stacks = CFG.stacks;

      // 正文固定基准字号（不再缩字）；初始给格式最小高度，
      // 渲染后由 fitHeight 按正文实测高度向下撑开。
      const hMin = Math.round(w * ratio);
      this._hLast = 0;

      // 渐变要用 background-image，纯色用 background-color，分开给更稳。
      const isGradient = String(st.bg || '').indexOf('gradient') >= 0;

      // 装饰尺寸：blob 是 w-32 = 128px，ring 是 w-8 = 32px，dot 是 w-2 = 8px
      const decorSize =
        st.decor === 'blob' ? 128 * k : st.decor === 'ring' ? 32 * k : 8 * k;

      this.setData({
        s: {
          w: Math.round(w),
          h: hMin,
          pad: round(PAD * k),
          headGap: round(HEAD_GAP * k),
          footGap: round(FOOT_GAP * k),
          paraGap: round(PARA_GAP * k),

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
          self.fitHeightSoon();
        }
      );
    },

    // —— 高度自适应：量正文自然高度，把卡片向下撑到恰好装下 ——

    // 防抖： observers 常成对触发（recalc + syncText），合并成一轮测量。
    // 排两轮：首轮 80ms 快速收敛，次轮 400ms 做独立复检。全量编译刷新后
    // 组件首轮 attached 可能撞上布局未稳（实测离屏卡首帧宽度偶发异常，
    // 会把高度量虚高并被防震荡锁死），复检轮以全新状态重测一次即可自纠；
    // 布局已稳时两轮结果一致，复检轮不会产生任何 setData。
    fitHeightSoon() {
      const self = this;
      if (self._hTimer) clearTimeout(self._hTimer);
      if (self._hVerify) clearTimeout(self._hVerify);
      self._hTimer = setTimeout(function () {
        self.fitHeight(0);
      }, 80);
      self._hVerify = setTimeout(function () {
        self.fitHeight(0);
      }, 400);
    },

    fitHeight(retries) {
      const self = this;
      if (retries === 0) self._hLast = 0;

      // 正文换行数只取决于卡片宽度（固定），与卡片当前高度无关，
      // 所以 .text 的自然高度在任何中间态下量都是准的；文字变短/切小号字体时
      // 也能量出更小值把卡片收回来。复测一轮只是确认 setData 后布局已收敛，
      // 保证 snapshot 出图拿到的是最终高度。
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
        const need = res[3].height;
        if (!need) return;

        // 装下全部内容所需的卡片高 = 上下内边距 + 头部 + 头间隔 + 正文 + 底间隔 + 底部。
        // 不能拿 .body 的高度量：flex 子项被内容撑高时它和 .text 等高，没有参照意义。
        const required =
          s.pad * 2 +
          res[1].height +
          s.headGap +
          need +
          s.footGap +
          res[2].height;
        const w = Number(self.data.size) || 1000;
        const hMin = Math.round(w * (RATIO[self.data.format] || RATIO.portrait));
        // +H_TOL 留出亚像素余量，避免边界上差 1px 反复收敛
        const want = Math.max(hMin, Math.ceil(required) + H_TOL);
        const cur = Math.round(res[0].height);

        // 已贴合目标高度，或上一轮已设过同值（防 1px 震荡）→ 收敛
        if (Math.abs(cur - want) <= H_TOL || want === self._hLast) return;
        if (retries >= H_MAX_RETRY) return;

        self._hLast = want;
        // 渲染完成回调里复测，避免拿到重排前的旧高度
        self.setData({ 's.h': want }, function () {
          self.fitHeight(retries + 1);
        });
      });
    }
  }
});
