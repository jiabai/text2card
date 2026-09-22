// utils/tokens.js 的单测。直接用 Node 跑，不需要模拟器：
//
//   node tools/test-tokens.js
//
// 覆盖的是「哪些字符算一个可断行单位、空格挂在哪」这件事。
// 这个逻辑错了不会报错，只会让卡片在中文或混排文案下悄悄溢出，
// 所以值得单独锁住。

const T = require('../utils/tokens.js');

// 用 · 标记该单位后面跟着间距，用 | 分隔单位，便于肉眼核对
const render = (toks) => toks.map((t) => t.t + (t.gap ? '·' : '')).join('|');

const joinLines = (content) =>
  T.buildLines(content)
    .map((l) => render(l.tokens))
    .join(' / ');

const cases = [
  // [输入, 期望的单位串]
  ['Believe you can', 'Believe·|you·|can'],
  ['设计是让智慧变得可见。', '设|计|是|让|智|慧|变|得|可|见|。'],
  ['Hello 世界', 'Hello·|世|界'],
  ['世界 Hello', '世|界·|Hello'],
  ['你好 世界', '你|好·|世|界'],
  ['  前导空格 hello  ', '前|导|空|格·|hello'],
  ['a  b', 'a·|b'],
  ["don't stop.", "don't·|stop."],
  ['emoji 🌱 后面', 'emoji·|🌱·|后|面'],
  ['全角，标点。混合English在这里', '全|角|，|标|点|。|混|合|English|在|这|里'],
  ['中日韩漢字', '中|日|韩|漢|字'],
  ['あいうカタカナ', 'あ|い|う|カ|タ|カ|ナ'],
  ['한글테스트', '한|글|테|스|트'],
  ['2026 年 9 月', '2026·|年·|9·|月'],
  ['', '']
];

// 段落与占位符另算，因为走的是 buildLines 而不是 tokenize
const lineCases = [
  ['第一段\n\n第二段', '第|一|段 /  / 第|二|段'],
  ['', T.PLACEHOLDER.split('').join('|')],
  ['   ', T.PLACEHOLDER.split('').join('|')],
  ['\n\n只有内容\n\n', '只|有|内|容']
];

let bad = 0;
const run = (label, cases, fn) => {
  for (const [input, expect] of cases) {
    const got = fn(input);
    const ok = got === expect;
    if (!ok) bad++;
    console.log((ok ? 'PASS' : 'FAIL') + '  ' + label + '  ' + JSON.stringify(input));
    if (!ok) console.log('       期望 ' + JSON.stringify(expect) + '\n       实际 ' + JSON.stringify(got));
  }
};

run('tokenize  ', cases, (s) => render(T.tokenize(s)));
run('buildLines', lineCases, joinLines);

const total = cases.length + lineCases.length;
console.log('\n' + (bad ? bad + ' 个失败 / ' + total : '全部通过（' + total + ' 例）'));
process.exit(bad ? 1 : 0);
