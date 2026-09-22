// utils/tokens.js
//
// 把一段文案切成「可断行的最小单位」。这个文件存在的唯一理由是
// Skyline 的文本引擎会把英文单词从中间断开，而 word-break 的
// normal / keep-all / break-word 与 overflow-wrap 实测全部无效。
// 界面上唯一的解法是：每个单位单独渲染成 inline-block，换行只发生在
// 单位与单位之间，再用 margin-right 把被吃掉的空格补回来。
//
// 切成什么粒度，是这里唯一的决策：
//
//   英文 —— 一个词（含尾随标点）算一个单位，整体不可断。
//   CJK —— 一个字算一个单位，因为汉字之间本来就允许断行。
//
// 必须同时处理这两种，不能图省事写 split(/\s+/)：中文句子没有空格，
// 整句会被切成**一个** inline-block，于是永不换行、直接撑破卡片。
// 文案库全是英文，所以这个坑不会在默认路径上自己暴露出来。
//
// 空格不产出单位，而是记在前一个单位的 gap 上（渲染时转成 margin-right）。
// 记在「前一个单位后面」而不是「当前单位前面」是有意的：若记在前面，
// 每个折行处的行首都会多出一个左间距，看起来像首行缩进错乱。

// 线上版空文案会显示占位符（React 侧是 children: text || t("placeholder")）。
var PLACEHOLDER = '想说点什么？';

// 表意文字与全角标点的码点区间。落在这里面的字符逐字成块。
var CJK_RANGES = [
  [0x1100, 0x11ff], // 谚文字母
  [0x2e80, 0x303f], // 康熙部首 / CJK 符号与标点
  [0x3040, 0x30ff], // 平假名 / 片假名
  [0x3130, 0x318f], // 谚文兼容字母
  [0x3400, 0x4dbf], // CJK 扩展 A
  [0x4e00, 0x9fff], // CJK 统一表意文字
  [0xa960, 0xa97f], // 谚文字母扩展 A
  [0xac00, 0xd7af], // 谚文音节
  [0xf900, 0xfaff], // CJK 兼容表意文字
  [0xfe10, 0xfe4f], // 竖排形式 / CJK 兼容形式
  [0xff00, 0xffef], // 半角及全角形式
  [0x1f200, 0x1f2ff], // 带圈表意文字补充
  [0x20000, 0x3ffff] // CJK 扩展 B 至 F
];

function isCJK(cp) {
  for (var i = 0; i < CJK_RANGES.length; i++) {
    var r = CJK_RANGES[i];
    if (cp >= r[0] && cp <= r[1]) return true;
  }
  return false;
}

// 切一行，返回 [{ i, t, gap }]。
// gap 为 1 表示这个单位后面原本有空格，渲染时要补 margin-right。
function tokenize(line) {
  var atoms = [];
  var buf = '';

  function flush() {
    if (buf) {
      atoms.push({ t: buf, spaceAfter: false });
      buf = '';
    }
  }

  // 用 Array.from 按码点迭代，代理对（扩展区汉字、部分 emoji）不会被拆成半个
  var chars = Array.from(String(line == null ? '' : line));
  for (var i = 0; i < chars.length; i++) {
    var ch = chars[i];

    if (/\s/.test(ch)) {
      flush();
      // 空白挂到上一个单位上；行首空白直接丢弃
      if (atoms.length) atoms[atoms.length - 1].spaceAfter = true;
      continue;
    }

    if (isCJK(ch.codePointAt(0))) {
      flush();
      atoms.push({ t: ch, spaceAfter: false });
      continue;
    }

    buf += ch;
  }
  flush();

  // 行尾空白不留间距，否则最后一个单位带着 margin-right，
  // 换行计算会把它算进去，可能提前折行。
  if (atoms.length) atoms[atoms.length - 1].spaceAfter = false;

  return atoms.map(function (a, idx) {
    return { i: idx, t: a.t, gap: a.spaceAfter ? 1 : 0 };
  });
}

// 文案用 \n 分段（段间是空行），逐行切。
// 返回 [{ i, tokens }]，空行保留 —— 它是段落间距的来源。
// 整段为空时回退到占位符。
function buildLines(content) {
  var text = String(content == null ? '' : content).trim() || PLACEHOLDER;
  var lines = text.split('\n').map(function (line, li) {
    return { i: li, tokens: tokenize(line) };
  });
  // 掐掉首尾空行，否则正文会整体偏移
  while (lines.length && !lines[0].tokens.length) lines.shift();
  while (lines.length && !lines[lines.length - 1].tokens.length) lines.pop();
  return lines;
}

module.exports = {
  PLACEHOLDER: PLACEHOLDER,
  isCJK: isCJK,
  tokenize: tokenize,
  buildLines: buildLines
};
