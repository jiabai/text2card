// 02 选版式页。两步拆页后这是导航栈第 2 层：
//   - 系统返回键 / 手势 = wx.navigateBack，天然回到写页，不再退出小程序
//   - 自定义「上一步」也走 navigateBack，行为与系统键一致
// 稿件由写页写入 app.globalData.draft，本页 onLoad 读取，只读不改。

const STYLES = require('../../config/styles.js');
const EXPORTER = require('../../utils/export.js');

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

// 版式托盘选项（dock 内横排一屏放下）。chip 用底色 + 两道墨线示意版式，
// 渐变直接拿原串当 background-image，色卡才不会说谎。
const buildStyleChips = () => {
  return STYLES.styles.map((st, j) => {
    const isGradient = String(st.bg).indexOf('gradient') >= 0;
    return {
      index: j,
      id: st.id,
      chipBg: isGradient ? '#FFA1AD' : st.bg,
      chipImage: isGradient ? st.bg : 'none',
      chipInk: st.textColor
    };
  });
};

Page({
  data: {
    statusBarHeight: 20,

    styleChips: [],
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
    content: '',
    author: '',
    lede: '',

    errorMsg: '',
    busy: false,
    exportLabel: '发给朋友'
  },

  onLoad() {
    const app = getApp();
    const draft = (app.globalData && app.globalData.draft) || { content: '', author: '' };
    const saved = (app.globalData && app.globalData.pickState) || {};
    const styleIndex = saved.styleIndex || 0;
    const formatIndex = saved.formatIndex == null ? 1 : saved.formatIndex;

    let info = {};
    try {
      info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    } catch (e) {
      info = {};
    }
    const width = info.windowWidth || 375;
    const charCount = String(draft.content || '').replace(/\s/g, '').length;

    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      // 版式选择已移到 dock 托盘，预览可以放大；80% 是竖版（最高格式）
      // 能和「格式」分段器同屏放下、不用滚动的上限，实测 86% 会把它顶出折叠线
      previewSize: Math.round((width - 20 * 2) * 0.8),
      styleChips: buildStyleChips(),
      date: todayText(),

      content: draft.content || '',
      author: draft.author || '',

      styleIndex: styleIndex,
      style: STYLES.styles[styleIndex],
      formatIndex: formatIndex,
      format: FORMATS[formatIndex].key,
      formatName: FORMATS[formatIndex].name,
      lede: this.lede(charCount, FORMATS[formatIndex].name)
    });
  },

  // 返回写页（系统返回键 / 自定义上一步都会走到这里）。
  // 把成品文件删掉：本页随即销毁，留着只会堆本地存储。
  // 成品路径记在实例字段 _lastExport（不再进 data：没有成品面板了）。
  onUnload() {
    if (this._lastExport) EXPORTER.removeFile(this._lastExport);
  },

  lede(count, formatName) {
    return count + ' 字 · ' + formatName;
  },

  onBack() {
    wx.navigateBack();
  },

  // 缓存托盘几何信息，滑动跟刷时按 clientX 线性映射到 chip 序号。
  // 托盘在 dock（滚动区之外），位置不随页面滚动变化，量一次就够。
  onReady() {
    const self = this;
    this.createSelectorQuery()
      .select('#styleTray')
      .boundingClientRect(function (r) {
        if (r) self._trayRect = r;
      })
      .exec();
  },

  // touchstart / touchmove 共用：手指扫到哪格，预览就切到哪版
  onTrayTouch(e) {
    const t = e.touches && e.touches[0];
    if (t) this.scrubTo(t.clientX);
  },

  scrubTo(x) {
    const r = this._trayRect;
    const n = this.data.styleChips.length;
    if (!r || !(r.width > 0) || n < 1) return;
    let i = Math.floor(((x - r.left) / r.width) * n);
    if (i < 0) i = 0;
    if (i > n - 1) i = n - 1;
    if (i === this.data.styleIndex) return;
    this.onStyle({ currentTarget: { dataset: { index: i } } });
  },

  // 同步版式 / 格式偏好到 globalData。不放在「上一步」里同步，
  // 因为系统返回键不经过任何按钮处理函数。
  syncPickState() {
    getApp().globalData.pickState = {
      styleIndex: this.data.styleIndex,
      formatIndex: this.data.formatIndex
    };
  },

  onStyle(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (i === this.data.styleIndex) return;
    this.setData({ styleIndex: i, style: STYLES.styles[i] });
    this.syncPickState();
  },

  onFormat(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (i === this.data.formatIndex) return;
    this.setData({
      formatIndex: i,
      format: FORMATS[i].key,
      formatName: FORMATS[i].name,
      lede: this.lede(this.data.content.replace(/\s/g, '').length, FORMATS[i].name)
    });
    this.syncPickState();
  },

  // CTA「发给朋友」：生成图片后直接拉起转发菜单，一步到位。
  // 菜单关掉（发出/取消都算）就回写页开始下一轮；只有真失败才留在本页提示。
  onShareCta() {
    const self = this;
    if (self.data.busy) return;

    // 每次出图都落一个新文件，不清理会一直堆在本地存储里。只保留最新一张。
    const stale = self._lastExport || '';

    self.setData({ busy: true, exportLabel: '生成中…', errorMsg: '' });
    wx.showLoading({ title: '生成中', mask: true });

    // 留一帧让 setData 落到布局上，快照取自离屏舞台
    setTimeout(() => {
      EXPORTER.capture(self, '#cardSnap')
        .then((r) => {
          EXPORTER.removeFile(stale);
          self._lastExport = r.path;
          wx.hideLoading();
          self.setData({ busy: false, exportLabel: '发给朋友' });
          wx.showShareImageMenu({
            path: r.path,
            success() {
              self.backAfterShare();
            },
            fail(err) {
              // 用户反悔关掉菜单，和发出一样回写页；真失败才留在本页
              const msg = (err && err.errMsg) || '';
              if (msg.indexOf('cancel') >= 0) {
                self.backAfterShare();
              } else {
                self.setData({ errorMsg: '转发失败：' + msg });
              }
            }
          });
        })
        .catch((err) => {
          wx.hideLoading();
          self.setData({
            busy: false,
            exportLabel: '发给朋友',
            errorMsg: (err && err.message) || String(err)
          });
        });
    }, 400);
  },

  // 转发菜单关掉后的落点：不留成品面板，直接回写页（写页实例在栈里，正文原样保留）。
  // 拆成独立方法：自动化可以用 callMethod 直接触发，验证回跳与文件清理。
  backAfterShare() {
    wx.navigateBack();
  }
});
