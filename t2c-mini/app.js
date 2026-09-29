// 字体走系统字体栈（sans / serif / mono 三套），由 config/styles.js 的
// stacks 定义、卡片组件按风格选择。线上新版 Text2Card 也是纯系统字体，
// 没有任何 @font-face，所以这里不需要再加载字体。
App({
  globalData: {
    // 写页（index）→ 选页（pick）的稿件，点「下一步」时写入
    draft: { content: '' },
    // 选页的版式 / 格式偏好。选页改动时同步，往返两页不丢选择
    pickState: { styleIndex: 0, formatIndex: 1 }
  },

  onLaunch() {}
});
