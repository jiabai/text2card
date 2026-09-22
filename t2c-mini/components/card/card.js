// 卡片组件：单层结构，对齐线上新版 Text2Card（card.pomodiary.com）。
//
// 版面骨架（五套风格共用，只有 class 不同）：
//   card  relative flex flex-col justify-between p-12 shadow-2xl overflow-hidden
//         {square:1:1, portrait:3/4, landscape:4/3}  w-full max-w-[500px]
//     ├ 装饰层  [editorial] 右上角光斑 / [gradient] 整幅白色叠加
//     ├ head   flex justify-between items-start mb-8   → 日期 + (圆环|圆点)
//     ├ body   flex-grow flex items-center             → 正文，垂直居中
//     └ foot   mt-8 flex justify-between items-end     → 署名 + 固定水印
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
    author: { type: String, value: '' },
    date: { type: String, value: '' },
    style: { type: Object, value: CFG.styles[0] }
  },

  data: {
    s: {},
    lines: [],
    dateText: '',
    authorText: '',
    markText: ''
  },

  observers: {
    'size, format, style': function () {
      this.recalc();
      this.syncText();
    },
    'content, author, date': function () {
      this.syncText();
    }
  },

  lifetimes: {
    attached() {
      this.recalc();
      this.syncText();
    }
  },

  methods: {
    recalc() {
      const st = this.data.style || CFG.styles[0];
      const w = Number(this.data.size) || 1000;
      const ratio = RATIO[this.data.format] || RATIO.portrait;
      const k = w / CARD_W; // 网页 px → 本卡 px 的换算系数
      const stacks = CFG.stacks;

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

          authorFont: stacks[st.authorFont] || stacks.sans,
          authorWeight: st.authorWeight,
          authorSize: round(st.authorSize * k),
          authorTracking: st.authorTracking || 0,
          authorColor: st.authorColor || st.textColor,
          authorOpacity: st.authorOpacity == null ? 1 : st.authorOpacity,
          authorChip: !!st.authorChip,
          authorChipBg: st.authorChipBg || 'transparent',
          authorPadX: st.authorChip ? round((st.authorPadX || 0) * k) : 0,
          authorPadY: st.authorChip ? round((st.authorPadY || 0) * k) : 0,
          authorUnderline: !!st.authorUnderline,
          authorUnderlineW: st.authorUnderline ? round(k) : 0,
          authorUnderlineColor: st.authorUnderlineColor || 'transparent',
          authorPadBottom: round((st.authorPadBottom || 0) * k),
          authorMarginBottom: round((st.authorMarginBottom || 0) * k),

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
      const st = this.data.style || CFG.styles[0];
      this.setData({
        lines: TOKENS.buildLines(this.data.content),
        dateText: upper(this.data.date, st.dateUpper),
        // 网页版是 children: a || "Anonymous"，空署名会显示 Anonymous
        authorText: upper(this.data.author || 'Anonymous', st.authorUpper),
        markText: 'TEXT2CARD'
      });
    }
  }
});
