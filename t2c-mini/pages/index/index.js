// 01 写文字页（小程序入口页，导航栈栈底）。
// 点「下一步」把稿件写入 app.globalData.draft，再 navigateTo 到 pages/pick/pick。
// 从选页返回（系统返回键 / 自定义上一步）时本页实例仍在，文字状态原样保留。

const PRESETS = require('../../config/presets.js');

const CATEGORIES = [
  { key: 'quote', name: '励志语录' },
  { key: 'morning', name: '早安问候' },
  { key: 'birthday', name: '生日祝福' }
];

// 每段带一个稳定 id，wx:key 才能用 id 而不是 index，避免增删段落时错位。
let seq = 0;
const newPara = (text) => ({ id: 'p' + ++seq, text: text || '' });

const joinContent = (paragraphs) =>
  paragraphs
    .map((p) => String(p.text || '').trim())
    .filter((t) => t.length > 0)
    .join('\n\n');

// Skyline 的原生 input 会把换行符渲染成一个方块，所以段落内部的硬换行压平成空格。
// 卡片是按换行分段的，段内不需要硬换行。
const normalize = (t) => String(t || '').replace(/\s+/g, ' ').trim();

Page({
  data: {
    statusBarHeight: 20,

    categories: CATEGORIES,
    catIndex: 0,
    cursor: 0,
    canShuffle: true,

    paragraphs: [],
    author: '',
    content: '',
    charCount: 0,
    canNext: false,
    nextLabel: '先写点什么'
  },

  onLoad() {
    let info = {};
    try {
      info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    } catch (e) {
      info = {};
    }
    this.setData({
      statusBarHeight: info.statusBarHeight || 20
    });
    this.loadFirst();
  },

  pool() {
    return PRESETS[CATEGORIES[this.data.catIndex].key] || PRESETS.quote;
  },

  // 正文一变，字数与能否进入下一步都要重算。
  // 统一在这里收口，避免每个输入回调各写一遍。
  refresh(extra) {
    const paragraphs = (extra && extra.paragraphs) || this.data.paragraphs;
    const content = joinContent(paragraphs);
    const count = content.replace(/\s/g, '').length;
    const ok = content.length > 0;
    const patch = {
      content: content,
      charCount: count,
      canNext: ok,
      nextLabel: ok ? '下一步 · 挑版式' : '先写点什么'
    };
    if (extra) {
      Object.keys(extra).forEach((k) => {
        patch[k] = extra[k];
      });
    }
    this.setData(patch);
  },

  applyPreset(item) {
    const parts = String((item && item.content) || '')
      .split('\n\n')
      .map((p) => normalize(p))
      .filter((p) => p.length > 0)
      .map((t) => newPara(t));

    this.refresh({
      paragraphs: parts.length ? parts : [newPara('')],
      author: (item && item.author) || ''
    });
  },

  loadFirst() {
    const list = this.pool();
    // 池子只有一条时（生日祝福目前就 1 条），换一换个寂寞：
    // (0 + 1) % 1 还是 0，点了没任何变化，用户会以为坏了。直接不显示。
    this.setData({ cursor: 0, canShuffle: list.length > 1 });
    this.applyPreset(list[0]);
  },

  onCat(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index === this.data.catIndex) return;
    this.setData({ catIndex: index });
    this.loadFirst();
  },

  onShuffle() {
    const list = this.pool();
    if (!list.length) return;
    const next = (this.data.cursor + 1) % list.length;
    this.setData({ cursor: next });
    this.applyPreset(list[next]);
  },

  onParaInput(e) {
    const i = Number(e.currentTarget.dataset.index);
    const paragraphs = this.data.paragraphs.slice();
    if (!paragraphs[i]) return;
    paragraphs[i] = { id: paragraphs[i].id, text: e.detail.value };
    this.refresh({ paragraphs: paragraphs });
  },

  onAddPara() {
    this.refresh({ paragraphs: this.data.paragraphs.concat([newPara('')]) });
  },

  onDelPara(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (this.data.paragraphs.length <= 1) return;
    const paragraphs = this.data.paragraphs.slice();
    paragraphs.splice(i, 1);
    this.refresh({ paragraphs: paragraphs });
  },

  onAuthor(e) {
    this.setData({ author: e.detail.value });
    this.refresh();
  },

  // 存稿后进选页。navigateTo 保留本页在栈中，选页是第 2 层，
  // 系统返回键天然回到本页。
  onNext() {
    if (!this.data.canNext) return;
    getApp().globalData.draft = {
      content: this.data.content,
      author: this.data.author
    };
    wx.navigateTo({ url: '/pages/pick/pick' });
  },

  // 清完留一个空段落，卡片会回退到占位符。
  onClear() {
    this.refresh({ paragraphs: [newPara('')], author: '' });
  }
});
