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

// —— 笑颜版式（decor === 'dots'）专属常量，全部按 500 基准标定 ——

const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 波点几何（原图 1125px 实测换算到 500 宽）：横纵间距不等，点阵略偏扁。
// 点核等效半径 ~0.9px、含反锯齿视觉半径 ~1.1px；dotsImage 里有 1px 下限
// 钳制 —— 预览宽度 <500 时 k<1，亚像素半径的点会糊掉或整片消失，
// 视觉上就是「没有波点」。
const DOT = { gx: 15.4, gy: 12.8, r: 1.1, color: '#D4C7AF' };

// 英文词方块（相对 1em，落地时在 JS 里换成 px —— Skyline 不支持 em 长度）：
// 方块是一块实心渐变背景。行程法实测样图：方块顶在 baseline 上方 9px、
// 下方探出 7px（33px 字号）→ 相对 inline-block 盒顶 0.95em、高 0.48em。
// 不用 background-color —— 它至少铺满整个 1em。
const HL = { top: 0.95, h: 0.48, x: 0.045 };

// 大号日期压缩：样图数字是窄形衬线，用 scaleX 横向压窄，再以负 margin
// 抵消布局盒多出的宽度（transform 不改布局）。
const DATE_SCALE = 0.85;
const DATE_MR = -12; // @500 基准：布局盒宽 ≈111，负 margin 让两小行落在视觉缝后 10px

// 手绘笑脸：单份内联 SVG，深棕描边、圆头线。视箱 98×74（渲染 49×37@500）。
// 样图笑脸是「无边框」画法 —— 没有脸圈。几何全部按样图连通域实测（@1125
// 换算到视箱 1:1.125）：粗翘眉（stroke≈11）+ 两只 U 形笑眼（开口朝上，
// stroke≈5.5）+ 两端高翘的大弧笑嘴（端点翘到与胡须齐平）+ 两侧锯齿短胡须；
// 两眉不对称、嘴端与胡须相连，保留手绘感。
// 注意：属性必须用双引号 —— encodeURIComponent 不转义单引号，裸 ' 会把
// wxml 里 url('{{s.smileyImg}}') 的引号串截断，导致真机上笑脸整块不渲染。
const SMILEY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 98 74">' +
  '<g fill="none" stroke="#724908" stroke-linecap="round" stroke-linejoin="round">' +
  // 眉：填充的变宽逗号 —— 粗圆头沿 28° 弧线收成尖尾。右眉关于 x=51 镜像。
  '<path d="M41.2 2.1 Q31 6.5 26.2 13.7 A4.5 4.5 0 1 1 19.8 7.3 Q29 2.8 40.8 0.3 Z" fill="#724908" stroke="none"/>' +
  '<g transform="matrix(-1 0 0 1 102 0)">' +
  '<path d="M41.2 2.1 Q31 6.5 26.2 13.7 A4.5 4.5 0 1 1 19.8 7.3 Q29 2.8 40.8 0.3 Z" fill="#724908" stroke="none"/>' +
  '</g>' +
  // U 形笑眼：宽开头、双臂曲线收到底部偏外的窄圆底（样图眼 ~25x22 viewBox）
  '<path d="M19.5 28.5 C19.5 35 22 42 27 44.5 C34 43.5 41 39 42 27" stroke-width="4.8"/>' +
  '<path d="M82.5 28.5 C82.5 35 80 42 75 44.5 C68 43.5 60 39 59 27" stroke-width="4.8"/>' +
  // 大弧笑嘴：等曲率抛物线，弧顶精确拆成两段（二次贝塞尔细分，形状与
  // Q52 105 单弧完全一致），让所有控制点都落在视箱内 —— 控制点超出视箱、
  // 后面还跟着别的路径时，Skyline 的 SVG 解码器会死循环（整条渲染卡死，
  // 数据/DOM 已更新但画面不重绘）；实测拆开后即恢复。
  '<path d="M10 34 Q31 69.5 53 69.5" stroke-width="5"/>' +
  '<path d="M53 69.5 Q75 69.5 98 34" stroke-width="5"/>' +
  // 酒窝小箭头：嘴端与眼之间
  '<path d="M18.5 37.5 L14 40.5 M18.5 37.5 L15 34.5" stroke-width="3.6"/>' +
  '<path d="M83.5 37.5 L88 40.5 M83.5 37.5 L87 34.5" stroke-width="3.6"/>' +
  // 锯齿短胡须：连体折线锯齿 + 叠笔（左右镜像），压在嘴端之上
  '<g stroke-width="3.2">' +
  '<path d="M2 32 L6.5 37 L3 42 L7.5 47"/>' +
  '<path d="M8 32.5 L11 38 L8 44"/>' +
  '<path d="M98 32 L93.5 37 L97 42 L92.5 47"/>' +
  '<path d="M94 32.5 L91 38 L94 44"/>' +
  '</g>' +
  '</g></svg>';

const SMILEY_ASPECT = 98 / 74; // 盒宽/盒高，与视箱一致，background-size:cover 不裁切

const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

// 波点底纹：一张 gx×gy 的 SVG 瓦片、中心一枚圆点，data URI + repeat 平铺。
// 不用 radial-gradient —— Skyline 对 gradient 背景的解析不稳，整条
// background-image 可能被静默丢弃（浏览器里却正常，属于「模拟器能看、
// 真机没有」的坑）；改走与笑脸相同的 SVG data URI 机制。
// 属性必须用双引号：encodeURIComponent 不转义单引号，见 SMILEY_SVG 注释。
const dotsImage = (k) => {
  const gx = round(DOT.gx * k);
  const gy = round(DOT.gy * k);
  const r = Math.max(1, DOT.r * k);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    gx +
    '" height="' +
    gy +
    '"><circle cx="' +
    gx / 2 +
    '" cy="' +
    gy / 2 +
    '" r="' +
    round(r) +
    '" fill="' +
    DOT.color +
    '"/></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};

// 方块的几何（px），跟随当前（fit 后的）字号：顶边、高度、左右出头。
const hlGeom = (sizePx, color) => ({
  hlT: round(sizePx * HL.top),
  hlH: round(sizePx * HL.h),
  hlPX: round(sizePx * HL.x),
  hlImg: 'linear-gradient(' + color + ', ' + color + ')'
});

const SMILEY_URI = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SMILEY_SVG);

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
    markText: '',
    // 笑颜版式的日期三段
    dateBig: '',
    dateMonth: '',
    dateTime: ''
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

      // 英文词方块几何（基准字号）
      const hg = hlGeom(this._baseTextSize, st.hlColor || '#EAD5B4');

      // 内边距：默认四方一致；笑颜版式样图是不对称的（上 66 / 下 63 / 左右 38）
      // 注意这些都是 @500 基准值，落地必须乘 k —— 导出在 1000px（k=2）渲染，
      // 漏乘 k 会让导出图边距只有一半，文字紧贴边框。
      const padX = st.padX != null ? st.padX : PAD;
      const padT = st.padTop != null ? st.padTop : padX;
      const padB = st.padBottom != null ? st.padBottom : padX;
      const headGap = st.headGap != null ? st.headGap : HEAD_GAP;

      // 笑脸盒：高 = smileySize，宽按视箱比例，保证 cover 不裁切
      const smileyH = (st.smileySize || 32) * k;
      const smileyW = smileyH * SMILEY_ASPECT;

      this.setData({
        s: {
          w: Math.round(w),
          h: Math.round(w * ratio),
          pad: round(padX * k),
          padT: round(padT * k),
          padB: round(padB * k),
          headGap: round(headGap * k),
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
          markColor: st.markWhite ? '#FFFFFF' : st.textColor,

          // —— 笑颜版式专属 ——
          isDots: st.decor === 'dots' ? 1 : 0,
          dotsImg: dotsImage(k),
          dotsSize: round(DOT.gx * k) + 'px ' + round(DOT.gy * k) + 'px',
          dateScale: st.decor === 'dots' ? DATE_SCALE : 1,
          dateMr: round(DATE_MR * k), // 抵消 scaleX 后布局盒多出的宽（仅 date-big 用）
          dateSubSize: round((st.dateSubSize || 13) * k),
          dateSubGap: round(5 * k), // 两小行之间的缝
          smileyGap: round(20 * k), // 笑脸与祝福文字之间的缝（样图 22，胡须端留 2）
          smileyH: round(smileyH),
          smileyW: round(smileyW),
          smileyRot: -2, // 样图笑脸整体顺时针微倾（PCA 主轴实测 -2.4°，特征线 ~-1°）
          smileyImg: SMILEY_URI, // [DIAG-A] mouth only
          greetSize: round((st.greetSize || 16) * k),
          greetNudge: round(8 * k), // 祝福语墨迹中心比笑脸中心低 ~4px，整体上提
          greetFont: stacks.script || 'cursive',
          greetText: st.greetText || '',

          // 英文词方块：实心渐变 + 显式尺寸/位置（字段随 fit 同步更新）
          hlT: hg.hlT,
          hlH: hg.hlH,
          hlPX: hg.hlPX,
          hlImg: hg.hlImg
        }
      });
    },

    syncText() {
      const self = this;
      const st = this.data.style || CFG.styles[0];
      const lines = TOKENS.buildLines(this.data.content);

      const patch = {
        lines: lines,
        dateText: upper(this.data.date, st.dateUpper),
        markText: 'TEXT2CARD'
      };

      // 笑颜版式：英文词加方块高亮；日期拆成 大号 MM/DD + 两小行
      if (st.decor === 'dots') {
        lines.forEach(function (line) {
          line.tokens.forEach(function (tk) {
            // 拉丁字母词（含带 ASCII 标点的词，如 "UI!"）才标，纯数字不标
            if (/[A-Za-z]/.test(tk.t)) tk.hl = 1;
          });
        });
        const dparts = this.diaryDateParts(this.data.date);
        patch.dateBig = dparts.big;
        patch.dateMonth = dparts.month;
        patch.dateTime = dparts.time;
      }

      this.setData(
        patch,
        // 渲染完成后再测量，时序才确定（固定延时在 Skyline 上会撞重排竞态）
        function () {
          self.fitTextSoon();
        }
      );
    },

    // 把传入的 "Oct 9, 2026" 拆成笑颜版式的三段：
    // big = MM/DD（与原图一致，月在前），month = 月份大写缩写加句点，
    // time = 当前 HH:MM（24 小时）。解析失败用当前日期兜底。
    diaryDateParts(dateStr) {
      const now = new Date();
      const m = String(dateStr || '').match(/([A-Za-z]{3})\D+(\d+)/);
      let mi = m ? MONTHS_ABBR.indexOf(m[1]) : -1;
      if (mi < 0) mi = now.getMonth();
      const day = m ? parseInt(m[2], 10) : now.getDate();
      return {
        big: pad2(mi + 1) + ' / ' + pad2(day),
        month: MONTHS_ABBR[mi].toUpperCase() + '.',
        time: pad2(now.getHours()) + ':' + pad2(now.getMinutes())
      };
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
      // 字号 + 行高 + 方块几何 一起改的补丁（方块要跟着字号走，渐变串复用）
      const sizePatch = (scale) => {
        const size = round(self._baseTextSize * scale);
        return {
          's.textSize': size,
          's.textLH': round(self._baseTextLH * scale),
          's.hlT': round(size * HL.top),
          's.hlH': round(size * HL.h),
          's.hlPX': round(size * HL.x)
        };
      };

      if (retries === 0) {
        self._fitBest = 0; // 最近一次「放得下」的缩放值
        self._fitDone = false; // 回扩结束标记，防震荡
        if (self._fitScale !== 1) {
          self._fitScale = 1;
          self.setData(sizePatch(1), function () {
            self.fitText(0);
          });
          return;
        }
      }

      // 可用高度用几何算：卡内容高 − 头部 − 底部。不能拿 .body 自己的高度用，
      // flex 子项被内容撑高时它和 .text 等高，比出来永远是“放得下”。
      // 笑颜版式的头部/底部类名不同（.head-diary / .foot-diary），各查一遍取非空。
      const q = self.createSelectorQuery();
      q.select('.card').boundingClientRect();
      q.select('.head').boundingClientRect();
      q.select('.head-diary').boundingClientRect();
      q.select('.foot').boundingClientRect();
      q.select('.foot-diary').boundingClientRect();
      q.select('.text').boundingClientRect();
      q.exec(function (res) {
        if (!res || res.length < 6 || !res[0] || !res[5]) {
          return;
        }
        const headRect = res[1] || res[2];
        const footRect = res[3] || res[4];
        if (!headRect || !footRect) return;
        const s = self.data.s;
        const avail =
          res[0].height - s.padT - s.padB - headRect.height - s.headGap - footRect.height - s.footGap;
        const need = res[5].height;
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
          self.setData(sizePatch(grow), function () {
            self.fitText(retries + 1);
          });
          return;
        }

        // 溢出：若发生在回扩阶段，退回最近一次放得下的字号，收工
        if (self._fitBest) {
          self._fitDone = true;
          self._fitScale = self._fitBest;
          self.setData(sizePatch(self._fitBest));
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
        self.setData(sizePatch(next), function () {
          self.fitText(retries + 1);
        });
      });
    }
  }
});
