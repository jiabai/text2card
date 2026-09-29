// 01 写文字页（小程序入口页，导航栈栈底）。
// 点「下一步」把稿件写入 app.globalData.draft，再 navigateTo 到 pages/pick/pick。
// 从选页返回（系统返回键 / 自定义上一步）时本页实例仍在，文字原样保留。
//
// 本页 renderer: webview（index.json）。Skyline 会把 textarea 里的换行渲染成
// 方块（README 坑 5），多行输入只能放在 webview 页；选页保持 skyline，
// 因为 <snapshot> 只在 skyline 下可用。跨页稿件走 globalData。

// 对齐小红书文字卡片：1000 字上限。
const MAX_LEN = 1000;

// 输入框原文 → 卡片文案：
//   - 统一换行符（开发者工具可能给 \r\n）
//   - 行内空白压平：卡片逐 token 排版，不需要也不保留连续空格/制表符
//   - 三个以上连续换行压成一个空行（空行是卡片的段落间距，留多了只是浪费版面）
//   - 掐掉首尾空行
// 单个换行就是卡片上的另起一行，空行才是分段，和用户在输入框里看到的一致。
const normalizeContent = (raw) =>
  String(raw || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

Page({
  data: {
    statusBarHeight: 20,

    maxLen: MAX_LEN,
    text: '',
    textLen: 0,
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
  },

  // 输入只更新字数与按钮态；正文归一化推迟到「下一步」，
  // 打字过程中不动 value，光标才不会被 setData 顶走。
  onInput(e) {
    const value = e.detail.value || '';
    const ok = normalizeContent(value).length > 0;
    this.setData({
      text: value,
      textLen: value.length,
      canNext: ok,
      nextLabel: ok ? '下一步 · 挑版式' : '先写点什么'
    });
  },

  // 存稿后进选页。navigateTo 保留本页在栈中，选页是第 2 层，
  // 系统返回键天然回到本页。
  onNext() {
    if (!this.data.canNext) return;
    getApp().globalData.draft = {
      content: normalizeContent(this.data.text)
    };
    wx.navigateTo({ url: '/pages/pick/pick' });
  }
});
