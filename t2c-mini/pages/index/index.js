const STYLES = require('../../config/styles.js');
const PRESETS = require('../../config/presets.js');
const EXPORTER = require('../../utils/export.js');

const CATEGORIES = [
  { key: 'quote', name: '励志语录' },
  { key: 'morning', name: '早安问候' },
  { key: 'birthday', name: '生日祝福' }
];

// 对齐线上版：square / portrait / landscape
const FORMATS = [
  { key: 'square', name: '正方形' },
  { key: 'portrait', name: '竖版' },
  { key: 'landscape', name: '横版' }
];

// 导出用的卡片宽度（px）。styles.js 里的数值按卡片宽 500 标定，
// 这里取 1000 即整体放大 2 倍；snapshot 再出 2 倍图，最终宽 2000px。
const EXPORT_W = 1000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 对齐线上版 new Date().toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})
// 小程序端 Intl 支持不稳，这里手工拼，结果一致。
const todayText = () => {
  const d = new Date();
  return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
};

// 风格选项两列排布。宽度用百分比 + space-between，单数行也会自然靠左。
// chip 用底色 + 两道墨线示意版式，比纯色块更容易一眼认出是哪一套。
const buildStyleRows = () => {
  const list = STYLES.styles;
  const rows = [];
  for (let i = 0; i < list.length; i += 2) {
    const cells = [];
    for (let j = i; j < Math.min(i + 2, list.length); j++) {
      const st = list[j];
      const isGradient = String(st.bg).indexOf('gradient') >= 0;
      cells.push({
        index: j,
        id: st.id,
        name: st.name,
        desc: st.desc,
        // 渐变直接拿原串当 background-image，色卡才不会说谎
        chipBg: isGradient ? '#FFA1AD' : st.bg,
        chipImage: isGradient ? st.bg : 'none',
        chipInk: st.textColor
      });
    }
    rows.push({ i: i, cells: cells });
  }
  return rows;
};

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

    // 两步流程：1 = 写文字，2 = 选版式。
    // 卡片风格刻意放在第二步——先想说什么，再决定长什么样。
    step: 1,

    categories: CATEGORIES,
    catIndex: 0,
    cursor: 0,
    canShuffle: true,

    styleRows: [],
    styleIndex: 0,
    style: STYLES.styles[0],

    formats: FORMATS,
    formatIndex: 1,
    format: 'portrait',
    // WXML 里直接写 formats[formatIndex].name 不保险，放个平铺字段
    formatName: FORMATS[1].name,

    previewSize: 300,
    exportSize: EXPORT_W,

    date: '',
    paragraphs: [],
    author: '',
    content: '',
    charCount: 0,
    canNext: false,

    // 这几个是纯展示串。刻意在 js 里拼好再传，不在 WXML 里写多行三元：
    // 见 index.wxml 顶部那条铁律，文字内容一旦另起一行，中文会全变豆腐块。
    nextLabel: '先写点什么',
    exportLabel: '生成图片',
    lede: '',

    resultPath: '',
    resultInfo: '',
    errorMsg: '',
    busy: false
  },

  onLoad() {
    let info = {};
    try {
      info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    } catch (e) {
      info = {};
    }
    const width = info.windowWidth || 375;
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      // 预览卡刻意只占内容宽的 76%：竖版满宽会胖到把「格式」和「版式」两块
      // 全顶到屏幕外，用户得先滚动才知道下面还有东西可选。
      previewSize: Math.round((width - 20 * 2) * 0.76),
      styleRows: buildStyleRows(),
      date: todayText()
    });
    this.loadFirst();
  },

  pool() {
    return PRESETS[CATEGORIES[this.data.catIndex].key] || PRESETS.quote;
  },

  // 正文一变，字数、能否进入下一步、以及上一张成品图全部失效。
  // 统一在这里收口，避免每个输入回调各写一遍还漏掉清理。
  refresh(extra) {
    this.dropResult();
    const paragraphs = (extra && extra.paragraphs) || this.data.paragraphs;
    const content = joinContent(paragraphs);
    const count = content.replace(/\s/g, '').length;
    const ok = content.length > 0;
    const patch = {
      content: content,
      charCount: count,
      canNext: ok,
      nextLabel: ok ? '下一步 · 挑版式' : '先写点什么',
      lede: this.lede(count, this.data.formatName),
      resultPath: '',
      resultInfo: '',
      errorMsg: ''
    };
    if (extra) {
      Object.keys(extra).forEach((k) => {
        patch[k] = extra[k];
      });
    }
    this.setData(patch);
  },

  lede(count, formatName) {
    return count + ' 字 · ' + formatName;
  },

  dropResult() {
    if (this.data.resultPath) EXPORTER.removeFile(this.data.resultPath);
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

  onNext() {
    if (!this.data.canNext) return;
    this.setData({ step: 2 });
  },

  onBack() {
    this.setData({ step: 1 });
  },

  onStyle(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (i === this.data.styleIndex) return;
    // 换版式后上一张成品图已经对不上了，直接作废，免得保存错图
    this.dropResult();
    this.setData({ styleIndex: i, style: STYLES.styles[i], resultPath: '', resultInfo: '' });
  },

  onFormat(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (i === this.data.formatIndex) return;
    this.dropResult();
    this.setData({
      formatIndex: i,
      format: FORMATS[i].key,
      formatName: FORMATS[i].name,
      lede: this.lede(this.data.charCount, FORMATS[i].name),
      resultPath: '',
      resultInfo: ''
    });
  },

  onCloseResult() {
    this.dropResult();
    this.setData({ resultPath: '', resultInfo: '' });
  },

  onExport() {
    const self = this;
    if (self.data.busy) return;

    // 每次出图都落一个新文件，不清理会一直堆在本地存储里。只保留最新一张。
    const stale = self.data.resultPath;

    self.setData({
      busy: true,
      exportLabel: '生成中…',
      errorMsg: '',
      resultPath: '',
      resultInfo: ''
    });
    wx.showLoading({ title: '生成中', mask: true });

    // 留一帧让 setData 落到布局上，快照取自离屏舞台
    setTimeout(() => {
      EXPORTER.capture(self, '#cardSnap')
        .then((r) => {
          EXPORTER.removeFile(stale);
          wx.hideLoading();
          self.setData({
            busy: false,
            exportLabel: '生成图片',
            resultPath: r.path,
            resultInfo:
              r.width + ' × ' + r.height + ' px，约 ' + Math.round(r.bytes / 1024) + ' KB'
          });
        })
        .catch((err) => {
          wx.hideLoading();
          self.setData({
            busy: false,
            exportLabel: '生成图片',
            errorMsg: (err && err.message) || String(err)
          });
        });
    }, 400);
  },

  onSave() {
    const self = this;
    if (!self.data.resultPath) return;

    // saveImageToPhotosAlbum 是隐私接口，先过隐私授权再调。
    EXPORTER.ensurePrivacy()
      .then(() => {
        wx.saveImageToPhotosAlbum({
          filePath: self.data.resultPath,
          success() {
            wx.showToast({ title: '已保存到相册' });
          },
          fail(err) {
            const msg = (err && err.errMsg) || JSON.stringify(err);
            // 用户拒绝过授权后，系统不再弹窗，只能引导去设置页
            if (msg.indexOf('auth deny') >= 0 || msg.indexOf('auth denied') >= 0) {
              wx.showModal({
                title: '需要相册权限',
                content: '保存图片要访问相册，是否去设置里打开？',
                confirmText: '去设置',
                success(res) {
                  if (res.confirm) wx.openSetting({});
                }
              });
              return;
            }
            self.setData({ errorMsg: '保存失败：' + msg });
          }
        });
      })
      .catch((err) => {
        self.setData({ errorMsg: (err && err.message) || String(err) });
      });
  },

  // 清完留一个空段落，卡片会回退到占位符。
  onClear() {
    this.refresh({ paragraphs: [newPara('')], author: '' });
  },

  onShare() {
    const self = this;
    if (!self.data.resultPath) return;

    wx.showShareImageMenu({
      path: self.data.resultPath,
      fail(err) {
        self.setData({
          errorMsg: '分享失败：' + ((err && err.errMsg) || JSON.stringify(err))
        });
      }
    });
  }
});
