// 五套卡片风格，逐字段对齐线上新版 Text2Card（card.pomodiary.com/zh-CN/create）。
//
// 数据来源与还原方法记在项目记忆 2026-09-22.md：风格数组在线上页面 chunk 的
// webpack 模块 7028 里，是 Tailwind class 字符串；这里把每条 class 摊平成了数值，
// 单位统一用「网页 px」——也就是网页版卡片 max-w-[500px] 时的实际渲染值。
// 渲染时由 card.js 统一乘缩放系数 k = 卡片实际宽度 / 500，三种格式共用一套数值。
//
// 与旧版的区别：旧版一套「主题」只换 3 个颜色，这五套是版式风格，
// 字体、字号、字重、字距、行高、底色、日期的处理、装饰元素全都不同。

// 网页版的字体栈原文（Tailwind 默认），照抄过来保证跨端一致。
// 注意：线上版完全不用 web font，零 @font-face，全部走系统字体。
const stacks = {
  sans: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  // 笑颜版式专用：中文走楷体（iOS Kaiti SC / Windows KaiTi），缺字回退衬线
  kai: '"Kaiti SC", "STKaiti", "KaiTi", "DFKai-SB", "BiauKai", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  // 笑颜版式大号日期：等高窄数字（lining figures）。Georgia 的老式数字高低不齐，
  // 样图数字是齐 line 的，所以 Times 优先、Georgia 兜底。
  dateSerif: '"Times New Roman", Times, Georgia, serif',
  // 笑颜版式底部祝福：圆润手写体。Comic Sans 宽度最接近样图（225px@500），
  // Segoe Script 偏窄；iOS 无这两者，回退 cursive（Snell Roundhand）。
  script: '"Comic Sans MS", "Segoe Script", "Bradley Hand", cursive'
};

// 备注：Tailwind 的 w-32 = 128px（不是 32px），已在 decor 尺寸里体现。
// 正文行高：text-3xl 默认 2.25rem/1.875rem=1.2，text-4xl 默认 2.5rem/2.25rem≈1.1111，
// 有 leading-* 类时以该类为准。
const styles = [
  {
    id: 'minimal',
    name: '极简',
    desc: '优雅排版的纯净白色',
    // 容器
    bg: '#FFFFFF',
    borderColor: '#E4E4E7', // border-zinc-200
    textColor: '#18181B', // text-zinc-900
    // 正文 font-serif text-4xl leading-tight italic
    textFont: 'serif',
    textWeight: 400,
    textItalic: true,
    textSize: 36,
    textLineHeight: 1.25,
    textTracking: 0,
    // 日期 font-mono text-xs text-zinc-400
    dateFont: 'mono',
    dateSize: 12,
    dateColor: '#9F9FA9', // text-zinc-400
    dateTracking: 0,
    dateUpper: false,
    dateOpacity: 1,
    decor: 'ring', // 日期右侧 32×32 细圆环
    markWhite: false
  },
  {
    id: 'editorial',
    name: '杂志',
    desc: '高对比度时尚杂志风格',
    bg: '#F5F2ED',
    borderColor: '',
    textColor: '#1A1A1A',
    // 正文 font-serif text-5xl font-light leading-tight tracking-tight
    textFont: 'serif',
    textWeight: 300,
    textItalic: false,
    textSize: 48,
    textLineHeight: 1.25,
    textTracking: -0.025,
    // 日期 font-sans text-[10px] uppercase tracking-widest opacity-60
    dateFont: 'sans',
    dateSize: 10,
    dateColor: '#1A1A1A',
    dateTracking: 0.1,
    dateUpper: true,
    dateOpacity: 0.6,
    decor: 'blob', // 右上角 128×128 橙色光斑
    markWhite: false
  },
  {
    id: 'bold',
    name: '大胆',
    desc: '醒目无衬线的鲜艳橙色',
    bg: '#FF4400',
    borderColor: '',
    textColor: '#FFFFFF',
    // 正文 font-sans font-bold text-5xl tracking-tighter leading-none
    textFont: 'sans',
    textWeight: 700,
    textItalic: false,
    textSize: 48,
    textLineHeight: 1,
    textTracking: -0.05,
    // 日期 font-mono text-xs opacity-80
    dateFont: 'mono',
    dateSize: 12,
    dateColor: '#FFFFFF',
    dateTracking: 0,
    dateUpper: false,
    dateOpacity: 0.8,
    decor: '',
    markWhite: true // 右下角水印强制白色
  },
  {
    id: 'dark',
    name: '午夜',
    desc: '等宽点缀的深邃黑色',
    bg: '#09090B', // bg-zinc-950
    borderColor: '#27272A', // border-zinc-800
    textColor: '#F4F4F5', // text-zinc-100
    // 正文 font-sans font-light text-4xl tracking-wide（无 leading 类，用 text-4xl 默认行高）
    textFont: 'sans',
    textWeight: 300,
    textItalic: false,
    textSize: 36,
    textLineHeight: 1.1111,
    textTracking: 0.025,
    // 日期 font-mono text-xs text-zinc-600
    dateFont: 'mono',
    dateSize: 12,
    dateColor: '#52525C', // text-zinc-600
    dateTracking: 0,
    dateUpper: false,
    dateOpacity: 1,
    decor: 'dot', // 日期右侧 8×8 亮绿圆点
    markWhite: false
  },
  {
    id: 'gradient',
    name: '光韵',
    desc: '柔和的渐变网格',
    bg: 'linear-gradient(to bottom right, #FEE685, #FFA1AD, #A684FF)', // from-amber-200 via-rose-300 to-violet-400
    borderColor: '',
    textColor: '#18181B',
    // 正文 font-serif text-4xl font-medium leading-snug
    textFont: 'serif',
    textWeight: 500,
    textItalic: false,
    textSize: 36,
    textLineHeight: 1.375,
    textTracking: 0,
    // 日期 font-sans text-[10px] opacity-60
    dateFont: 'sans',
    dateSize: 10,
    dateColor: '#18181B',
    dateTracking: 0,
    dateUpper: false,
    dateOpacity: 0.6,
    decor: 'veil', // 整幅 10% 白叠加
    markWhite: false
  },
  {
    // 第六套：复刻手账波点卡片（暖米底 + 深棕楷体 + 手绘笑脸）。
    // 中间正文不写死，仍由用户输入；英文词自动加方块高亮，
    // 复刻原图「UI」背后的浅棕方块这一标志性处理。
    id: 'dots',
    name: '笑颜',
    desc: '波点暖纸上的每日祝福',
    bg: '#EEE7DD',
    borderColor: '',
    textColor: '#724908', // 深咖啡棕
    // 正文 楷体系 / 33px / 行高 1.7
    textFont: 'kai',
    textWeight: 400,
    textItalic: false,
    textSize: 33,
    textLineHeight: 1.7,
    textTracking: 0.05,
    // 日期：大号衬线 MM/DD（Times 窄数字 + scaleX 压缩，见 card.js），
    // 右侧 15px 两小行（月份缩写 / 时分）
    dateFont: 'dateSerif',
    dateSize: 40,
    dateColor: '#724908',
    dateTracking: 0,
    dateUpper: true,
    dateOpacity: 1,
    decor: 'dots', // 整幅波点底纹（SVG 瓦片平铺）
    markWhite: false,
    // —— 以下为本版式专属字段 ——
    // 样图内边距不对称：上 66 / 下 63 / 左右 38（@500 实测，66 使日期 cap 顶落在 71）
    padTop: 66,
    padBottom: 63,
    padX: 38,
    headGap: 20, // 日期块与正文区的间隔（影响正文垂直居中位置）
    dateSubSize: 15,
    hlColor: '#EAD5B4', // 英文词方块高亮（原图实测色）
    smileySize: 37, // 笑脸高度，宽 = 高 × 98/74（无边框画法，含两侧胡须线）
    greetSize: 15,
    greetText: 'Wishing you happiness every day'
  }
];

module.exports = {
  stacks: stacks,
  styles: styles
};
