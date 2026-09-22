// utils/export.js
//
// Skyline <snapshot> 出图封装。
//
// 这个文件的存在意义就是把三个「不写注释下次一定再踩」的坑固化下来。
// 三条都是 2026-09-20 在本机 + 开发者工具模拟器里实测出来的结论：
//
//   1. takeSnapshot 的 type 必须传 'arraybuffer'。
//      传官方推荐的 'file' 时，模拟器上既不回调 success 也不回调 fail，界面会一直转圈。
//      换成 arraybuffer 拿二进制、自己写文件，立刻正常。
//
//   2. <snapshot> 节点不能放进 scroll-view 里。
//      放进去表现同上：静默挂死。必须让 export-stage 与 scroll-view 平级。
//
//   3. 落盘要用异步 fs.writeFile，别用 writeFileSync。
//      writeFileSync 传 ArrayBuffer 会失败，而且抛出来的错误对象是空的，
//      JSON.stringify 出来只有一个 {}，查都没法查。

var TIMEOUT = 15000;

function grabNode(page, selector) {
  return new Promise(function (resolve) {
    page
      .createSelectorQuery()
      .select(selector)
      .node()
      .exec(function (res) {
        resolve(res && res[0] ? res[0].node : null);
      });
  });
}

function takeShot(node) {
  return new Promise(function (resolve, reject) {
    node.takeSnapshot({
      type: 'arraybuffer',
      format: 'png',
      success: function (r) {
        if (r && r.data && r.data.byteLength) {
          // 顺手把字节数带出来：ArrayBuffer 的 byteLength 就是 PNG 的真实大小。
          // 比事后再去 stat 文件可靠 —— FileSystemManager.getFileInfoSync
          // 在部分基础库上会直接抛错，而那种错很容易被 catch 吞掉，
          // 表现为结果区永远显示「约 0 KB」。
          resolve({ data: r.data, bytes: r.data.byteLength });
        } else {
          reject(new Error('takeSnapshot 返回空数据'));
        }
      },
      fail: function (e) {
        reject(new Error('takeSnapshot 失败：' + JSON.stringify(e)));
      }
    });
  });
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error(label + ' ' + ms + 'ms 无回调'));
      }, ms);
    })
  ]);
}

function writePng(shot) {
  return new Promise(function (resolve, reject) {
    var fs = wx.getFileSystemManager();
    var path = wx.env.USER_DATA_PATH + '/t2c-' + Date.now() + '.png';
    fs.writeFile({
      filePath: path,
      data: shot.data,
      encoding: 'binary',
      success: function () {
        resolve({ path: path, bytes: shot.bytes });
      },
      fail: function (e) {
        reject(
          new Error(
            '写文件失败：' + (e && e.errMsg ? e.errMsg : JSON.stringify(e))
          )
        );
      }
    });
  });
}

// 只补宽高；字节数沿用 takeSnapshot 给的那个。
function readInfo(shot) {
  return new Promise(function (resolve) {
    wx.getImageInfo({
      src: shot.path,
      success: function (info) {
        resolve({
          path: shot.path,
          width: info.width,
          height: info.height,
          bytes: shot.bytes
        });
      },
      fail: function () {
        resolve({ path: shot.path, width: 0, height: 0, bytes: shot.bytes });
      }
    });
  });
}

// 删一个落盘文件。失败无所谓，调用方不需要关心。
function removeFile(path) {
  if (!path) return;
  try {
    wx.getFileSystemManager().unlink({
      filePath: path,
      fail: function () {}
    });
  } catch (e) {}
}

// 隐私合规门禁（2026-09-23 加）。
//
// 微信自 2023-10-17 起强制启用隐私校验，且不论 app.json 是否配 __usePrivacyCheck__。
// 保存图片到相册（wx.saveImageToPhotosAlbum）属于隐私接口「相册（仅写入）」，
// 要过两道关：
//
//   1. 小程序后台的《用户隐私保护指引》必须声明该信息类型。未声明则接口直接被禁用。
//      **开发版与体验版不受这条限制**，所以它在测试阶段完全不暴露，
//      只在正式版上炸 —— 报 saveImageToPhotosAlbum:fail privacy permission is not authorized。
//      这一步只能在公众平台后台做，代码无解。
//
//   2. 声明之后，仍需同步「用户已阅读并同意隐私政策」才能调用接口。这道由代码做。
//
// 实现上先查 getPrivacySetting，只有 needAuthorization 为真才弹授权。
// 这样后台还没配指引时流程不会被自己挡住，测试号上照常能保存。
function ensurePrivacy() {
  return new Promise(function (resolve, reject) {
    if (!wx.getPrivacySetting) {
      resolve();
      return;
    }
    wx.getPrivacySetting({
      success: function (res) {
        if (!res || !res.needAuthorization || !wx.requirePrivacyAuthorize) {
          resolve();
          return;
        }
        wx.requirePrivacyAuthorize({
          success: function () {
            resolve();
          },
          fail: function () {
            reject(new Error('需要先同意隐私保护指引，才能保存图片到相册'));
          }
        });
      },
      fail: function () {
        resolve();
      }
    });
  });
}

// 主入口。返回一个 Promise，resolve 出
// { path, width, height, bytes }。
function capture(page, selector) {
  return grabNode(page, selector)
    .then(function (node) {
      if (!node) {
        throw new Error('未取到 snapshot 节点，确认当前是 Skyline 渲染模式');
      }
      return withTimeout(takeShot(node), TIMEOUT, 'takeSnapshot');
    })
    .then(writePng)
    .then(readInfo);
}

module.exports = {
  capture: capture,
  removeFile: removeFile,
  ensurePrivacy: ensurePrivacy,
  TIMEOUT: TIMEOUT
};
