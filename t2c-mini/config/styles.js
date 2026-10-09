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
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
};

// 五套卡片风格：底色 / 字色 / 装饰各自不同，正文与日期的字体字号排版
// 统一复刻 flomo 分享图的笔记体（系统无衬线、18.4px、1.8 行高；卡宽 500 基准）。
// 像素测量依据见 2026-10-02 对 flomo 分享图的采样（1230 宽画布 × 500/1230 换算）。
// 字号用「整行墨迹宽 / 全宽字符数」反推（24 字 × 45.2px ≈ 1083px），已用短行交叉验证。
const styles = [
  {
    id: 'minimal',
    name: '极简',
    desc: '优雅排版的纯净白色',
    // 容器
    bg: '#FFFFFF',
    borderColor: '#E4E4E7', // border-zinc-200
    textColor: '#18181B', // text-zinc-900
    // 正文：复刻 flomo 笔记体（系统无衬线 / 常规字重 / 小字 / 1.8 行高）
    textFont: 'sans',
    textWeight: 400,
    textItalic: false,
    textSize: 18.4,
    textLineHeight: 1.8,
    textTracking: 0,
    // 日期与正文同族，小字浅灰
    dateFont: 'sans',
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
    // 正文：flomo 笔记体（杂志风的个性交给米白纸面 + 橙色光斑）
    textFont: 'sans',
    textWeight: 400,
    textItalic: false,
    textSize: 18.4,
    textLineHeight: 1.8,
    textTracking: 0,
    // 日期与正文同族，小字
    dateFont: 'sans',
    dateSize: 12,
    dateColor: '#1A1A1A',
    dateTracking: 0,
    dateUpper: false,
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
    // 正文：flomo 笔记体（大胆风的个性交给满版橙底白字，字重也收敛为常规）
    textFont: 'sans',
    textWeight: 400,
    textItalic: false,
    textSize: 18.4,
    textLineHeight: 1.8,
    textTracking: 0,
    // 日期与正文同族，小字
    dateFont: 'sans',
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
    // 正文：flomo 笔记体（午夜风的个性交给深黑纸面 + 亮绿圆点）
    textFont: 'sans',
    textWeight: 400,
    textItalic: false,
    textSize: 18.4,
    textLineHeight: 1.8,
    textTracking: 0,
    // 日期与正文同族，小字
    dateFont: 'sans',
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
    // 正文：flomo 笔记体（光韵风的个性交给三色渐变 + 白纱叠加）
    textFont: 'sans',
    textWeight: 400,
    textItalic: false,
    textSize: 18.4,
    textLineHeight: 1.8,
    textTracking: 0,
    // 日期与正文同族，小字
    dateFont: 'sans',
    dateSize: 12,
    dateColor: '#18181B',
    dateTracking: 0,
    dateUpper: false,
    dateOpacity: 0.6,
    decor: 'veil', // 整幅 10% 白叠加
    markWhite: false
  }
];

module.exports = {
  stacks: stacks,
  styles: styles
};
