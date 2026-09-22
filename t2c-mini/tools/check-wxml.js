/*
  检查所有 .wxml 里的「文字内容另起一行」。

  背景（2026-09-23 实测）：Skyline 下，只要 <text> 的内容带前后换行空白，例如

    <text class="cta-text">
      下一步 · 挑版式
    </text>

  这个节点就会 ① 把换行渲染成一个 □ ② 整个节点改用不含中文字形的字体，
  中文全部变成豆腐块。英文内容完全正常，所以英文文案库里永远测不出来。

  正确写法是内容紧贴标签：<text class="cta-text">下一步 · 挑版式</text>

  用法：node tools/check-wxml.js
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = ['test-results', 'node_modules', '.git'];

// 显示文字的元素。view 里也可能直接放文字，一并查。
const TAGS = ['text', 'view', 'button', 'label'];

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    if (SKIP.indexOf(e.name) >= 0) return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.wxml')) out.push(p);
  });
  return out;
}

// 找出 <tag ...> 之后紧跟空白换行的位置
function findOpenNewline(src, tag) {
  const re = new RegExp('<' + tag + '\\b[^>]*>([ \\t]*\\r?\\n)', 'g');
  const hits = [];
  let m;
  while ((m = re.exec(src)) !== null) hits.push(m.index);
  return hits;
}

// 找出 </tag> 之前的空白换行
function findCloseNewline(src, tag) {
  const re = new RegExp('(\\r?\\n[ \\t]*)</' + tag + '>', 'g');
  const hits = [];
  let m;
  while ((m = re.exec(src)) !== null) hits.push(m.index);
  return hits;
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

let problems = 0;
const files = walk(ROOT, []);

files.forEach((file) => {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');

  TAGS.forEach((tag) => {
    const marks = findOpenNewline(src, tag).concat(findCloseNewline(src, tag));
    marks
      .sort((a, b) => a - b)
      .forEach((index) => {
        const open = src.lastIndexOf('<' + tag, index);
        const close = src.indexOf('</' + tag + '>', index);
        if (open < 0 || close < 0) return;
        const inner = src.slice(src.indexOf('>', open) + 1, close);
        // 只查「内容全是纯文本」的节点。
        // 里面还有子标签（含注释）的是容器，空白换行完全正常，跳过。
        if (inner.indexOf('<') >= 0) return;
        if (inner.replace(/\s/g, '') === '') return;

        problems++;
        const ln = lineOf(src, index);
        console.log('  ' + rel + ':' + ln + '  <' + tag + '> 的内容没有贴着标签');
      });
  });
});

console.log('');
if (problems) {
  console.log('发现 ' + problems + ' 处。中文会渲染成豆腐块，把内容挪到标签同一行。');
  process.exit(1);
} else {
  console.log('全部通过：' + files.length + ' 个 wxml，文字内容都贴着标签。');
}
