# t2c-mini

Text2Card 的微信小程序版。用 Skyline 渲染引擎的 `<snapshot>` 组件把 WXML + WXSS 排好版的卡片直接截成图片，取代网页版的 DOM 截图出图链路（线上用的是 `modern-screenshot`，不是 snapdom）。

> **对齐目标**：`https://card.pomodiary.com/zh-CN/create`（线上**新版** Text2Card）。
> 注意这台机器上的 `D:\Github\text2card` 是**旧版**（只有配色主题、用 8 MB 明朝体、横竖两种比例）。两者设计完全不同，本工程只对齐线上新版。旧版的配色主题与字体方案已于 2026-09-22 全部移除。

## 为什么不用 canvas

网页版的卡片版式本来就是一份 CSS，改成 canvas 等于用绘图指令重画一遍，而且以后每次改样式都要改两处。`<snapshot>` 让设计只存一份，长期维护成本低得多。

## 目录

```
app.js / app.json / app.wxss   全局配置，Skyline 开关在这里
config/
  styles.js                    5 套版式风格 + 3 个字体栈（网页 px 数值）
components/card/               卡片组件，单层结构，按一个宽度参数算全部尺寸
pages/index/                   第一步：一个 textarea 写文字（webview 页，见坑 5）
pages/pick/                    第二步：挑版式，出图、保存、分享都在这一页（skyline）
utils/export.js                takeSnapshot 封装 + 隐私授权门禁 + 落盘文件回收
utils/tokens.js                断行切分：英文整词 / CJK 逐字 / 空格归属
tools/test-tokens.js           断行切分的单测，纯 Node 跑，不用起模拟器
tools/check-wxml.js            wxml 静态检查：拦「文字内容另起一行」（见坑 8）
test-results/                  验证时导出的成品图与界面截图，已在 packOptions.ignore 里排除
```

两处不报错的错法各配了一个检查脚本，改坏了立刻报，都是纯 Node、不用起模拟器：

```
node tools/test-tokens.js     # 断行切分，19 例
node tools/check-wxml.js      # 文字内容必须贴着标签，见坑 8
```

断行之所以要抽成独立模块，是因为它**切错了不会崩**，只会让卡片在中文文案下悄悄溢出；而 `check-wxml` 拦的那条更隐蔽，只让中文变豆腐块，英文一切正常。

## 五套风格

风格定义是**手写**在 `config/styles.js` 里的，不再由脚本从网页版导出 —— 线上那份是 Tailwind class 字符串、跑在浏览器里，本地没有任何工具能把它编译成 WXSS 能吃的值。所以做法是扒出 class 原文后，把每条 class 摊平成数值落到 `styles.js`，并写清每一项对应的 Tailwind 类名，方便日后核对。

| id | 中文 | 底色 | 正文 | 日期 | 装饰 |
| --- | --- | --- | --- | --- | --- |
| `minimal` | 极简 | `#FFFFFF` 白 | serif / 400 / *斜体* / 36px | mono 12px `#9F9FA9` | 右侧 32×32 细圆环 |
| `editorial` | 杂志 | `#F5F2ED` 米 | serif / 300 / 48px / 负字距 | sans 10px 大写 60% | 右上 128×128 橙色模糊光斑 |
| `bold` | 大胆 | `#FF4400` 橙 | sans / **700** / 48px / 行高 1 | mono 12px 80% | 无 |
| `dark` | 午夜 | `#09090B` 黑 | sans / 300 / 36px / 宽字距 | mono 12px `#52525C` 暗灰 | 右侧 8×8 亮绿圆点 |
| `gradient` | 光韵 | 琥珀→玫瑰→紫 线性渐变 | serif / 500 / 36px / 行高 1.375 | sans 10px 60% | 整幅 10% 白叠加 |

三套系统字体栈照抄线上版：

```
sans  ui-sans-serif, system-ui, sans-serif, …
serif ui-serif, Georgia, Cambria, "Times New Roman", Times, serif
mono  ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, …
```

**线上版零 web font、零 `@font-face`**，所以本工程也不引字体。于是没有 base64 字体要维护，主包体积也不再被字体挤压。

## 三种格式

| key | 比例 | 导出像素 |
| --- | --- | --- |
| `square` | 1:1 | 2000 × 2000 |
| `portrait` | 3:4（默认） | 2000 × 2666 |
| `landscape` | 4:3 | 2000 × 1500 |

## 界面：两步流程

2026-09-23 改版，对齐小红书文字卡片的体感：**先把话说清楚，再决定它长什么样**。2026-09-30 第一步进一步收敛成小红书「文字」编辑器的样子——整页只有一个输入框。

```
01 写（webview 页）              02 选（skyline 页）
  一个多行 textarea               顶部大预览（实时刻画的卡片）
  右下角 0 / 1000 字数            格式：正方形 / 竖版 / 横版
  [下一步 · 挑版式]               版式：底部托盘，五套风格横滑
                                 [发给朋友]
```

改版前所有控件挤在一页：风格网格排在最上面，用户还没写一个字就得先挑版式，而挑完往往还要回头改文字，改完再滚回顶部重挑。改成两步之后，"挑版式" 这个决策点落在文字已经确定之后，第二步的预览就是最终结果，改风格立刻看到效果。

两个细节：

- **01 页整页只有一个 `textarea`**，没有署名、灵感库、段落管理。换行就是卡片上的另起一行，空行才分段；1000 字上限对齐小红书。01 页因此单独配 `"renderer": "webview"`（见坑 5），02 页保持 skyline，跨页稿件走 `globalData.draft`。
- **「下一步」在正文为空时是禁用态**，文案变成「先写点什么」，不做静默拦截也不弹提示。

### 视觉：朱砂暖纸

整套只有六个色，朱砂只用在两处（步骤序号、主按钮），别处一律不用：

```
纸 #F6F4F0   白 #FFFFFF   墨 #17171A   淡墨 #5C5852   灰字 #8A8681   朱砂 #C2402D
```

层次靠字重、字号、留白拉，不靠描边和阴影。中文标题走衬线（`ui-serif` → 宋体），与无衬线的正文和 UI 拉开距离，也给"文字卡片"这件事本身一个态度。

## 尺寸是怎么算的

`styles.js` 里的数值单位是**网页 px**，即线上版卡片 `max-w-[500px]` 时的实际渲染值。组件只认一个基准 `CARD_W = 500`，实际宽度由 `k = 卡片实际宽度 / 500` 统一缩放，三种格式共用同一套数值。

这一层是必要的：卡片最终要导出到 1000 CSS px 宽（`snapshot` 再出 2 倍图 → 2000px），如果照搬 rpx 会让字号随屏幕宽度漂移，同一份设计在不同手机上出图不一致。

页面侧 `EXPORT_W = 1000`，即相对 500 基准整体放大 2 倍。

## 版面骨架

单层卡片，**没有**旧版那种「外层白框 + 内层卡片」：

```
div  相对定位 · 纵向 flex · 两端对齐 · overflow hidden · aspect-ratio
  ├ [editorial] 右上角橙色模糊光斑
  ├ [gradient]  整幅 10% 白叠加
  ├ head  两端对齐 · 日期 + 圆环 / 圆点
  ├ body  撑满 · 垂直居中 · 逐词 inline-block 的正文
  └ foot  右下角固定水印 TEXT2CARD
```

日期用 `Sep 22, 2026` 格式（对齐线上 `toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})`）。小程序端 `Intl` 支持不稳，所以手工拼 `MONTHS` 数组，结果与浏览器一致。

卡片不显示署名（2026-09-30 随编辑器极简改版移除，五套风格的署名样式一并从 `styles.js` 删掉）；水印恒为 `TEXT2CARD`（与线上一致，始终大写，`bold` 风格下强制白色）。

## 必须知道的坑

### 出图

1. `takeSnapshot` 的 `type` 必须是 `'arraybuffer'`。传 `'file'` 时模拟器上不回调成功也不回调失败，界面一直转圈。
2. `<snapshot>` 不能放进 `scroll-view`，必须与它平级。
3. 落盘用异步 `fs.writeFile`，`writeFileSync` 传 ArrayBuffer 会失败且错误对象为空。
4. 离屏舞台的宽度必须跟着导出尺寸动态绑定。写死一个值的话，另一种比例会在导出图右侧留一大块空白。

### 文本与 UI

5. **Skyline 下 `\n` 一定会被画成一个方块，`input` / `textarea` / `text` 全都一样，没有 CSS 解。** 多行编辑器的解法是**页面级 renderer 混用**（2026-09-30 已采用）：写作页 `pages/index/index.json` 单独配 `"renderer": "webview"`，选页保持 skyline（`<snapshot>` 只在 skyline 有），跨页稿件走 `app.globalData.draft`。webview 页 `navigateTo` skyline 页已实测正常。卡片自身不受影响——正文在 JS 里按 `\n` 切成多个 `<view>`（`utils/tokens.js` 的 `buildLines`），换行符从不进渲染节点。

   2026-09-23 做过一组控制变量实验（同一份内容，只改「有无换行」和渲染器）：

   | 内容 | Skyline | WebView |
   |---|---|---|
   | 中文 · 无换行 | 正常 | 正常 |
   | 中文 · 含换行 | **全变 □** | 正常两行 |
   | 英文 · 含换行 | **`Line one□Line two`** | 正常两行 |

   英文组最干净：文字正常，**只有换行处多出一个 □**。可见不是字体缺字形，而是 Skyline 把 `\n` 当成有字形的字符画了出来（WebView 会静默忽略控制字符）；中文则多一层放大——只要含 `\n`，整个节点字体就回退到不含中文字形的字体，整段全 □。`white-space` 的 `pre-wrap` / `pre-line` / `pre` 三个取值实测全部无效。
6. Skyline 的文本引擎会从英文单词中间断行，`word-break` / `overflow-wrap` 全部无效。解法是每个单位单独包成行内块，换行只发生在单位之间。
7. **断行的单位不能只按空白切。** 中文句子没有空格，`split(/\s+/)` 会把整句切成**一个**行内块 —— 永不换行、直接撑破卡片。正确做法是英文整词成块、CJK 逐字成块，空格记在前一个单位上（`utils/tokens.js`）。这个坑只在用户输入中文时才炸，英文预设文案的路径覆盖不到，所以配了 `tools/test-tokens.js` 单测兜底。
8. `border-box` 盒模型下给顶栏写死 `height` 再叠动态 `padding-top`，内容区会被吃光，看起来像顶栏消失。顶栏不要写死高度。
16. **`<text>` 的内容一旦另起一行，整个节点换成不含中文字形的字体，中文全变豆腐块。** 也就是写成

    ```xml
    <text class="cta-text">
      下一步 · 挑版式
    </text>
    ```

    渲染出来是 `□ □□□ · □□□` —— 换行本身渲染成 `□`，后面每个汉字也各是一个 `□`。字面量、数据字段、三元表达式三种内容都中招；内容紧贴标签就完全正常：

    ```xml
    <text class="cta-text">下一步 · 挑版式</text>
    ```

    **英文内容完全正常**，所以英文文案的工程永远踩不到；本工程是这次改版换成中文 UI 才暴露的。同类坑（坑 7 的中文断行）也是同一个性质。

    定位过程值得记一笔：一开始怀疑是 `letter-spacing`、`font-weight`、`class` 里的表达式、甚至离屏舞台漏光。做了一组对照才发现内容和 class 都没问题（同内容同 class 在 `scroll-view` 内正常、在底栏就豆腐块），最后把「内容另起一行」抽成唯一变量才锁定。

    已配静态检查 `node tools/check-wxml.js`，内容不贴标签直接退出码 1。
17. **Skyline 里 `position: fixed` 不可靠。** 底栏整个不渲染，还没有任何报错。改成整页 flex 纵向排：`scroll-view` 吃剩余高度（`flex-grow:1; flex-shrink:1; height:0`），底栏走正常文档流。副作用反而是好的 —— 成品面板一出现，滚动区自动变矮，不用手算偏移量。
18. **右上角要给微信胶囊按钮让出 44px。** `navigationStyle: custom` 之后胶囊是浮在页面上的，步骤号会正好钻到它底下。做法是页头第一行固定 `height: 44px`（等于胶囊高），内容一律靠左；正文区不能靠这一行来让位。
19. 滚动时内容会从状态栏底下穿过去。页头之上单独铺一条 `height: {{statusBarHeight}}px` 的底色块（在 `scroll-view` 之外、flex 首子元素），比给页头加 `padding-top` 干净 —— 后者会跟着一起滚上去。

### 大小统计

9. 结果区显示「约 0 KB」时别去查 `takeSnapshot`。原因是 `FileSystemManager.getFileInfoSync` 在部分基础库上直接抛错，而代码里那个 `try/catch` 把错误吞了。字节数其实在 `takeSnapshot` 的回调里就有 —— `r.data.byteLength` 就是 PNG 的真实大小，别绕一圈去 stat 文件。

### 隐私接口（发版前必看，只在正式版暴露）

14. `wx.saveImageToPhotosAlbum` 属于隐私接口「相册（仅写入）」。微信自 2023-10-17 起强制启用隐私校验，**不论 `app.json` 里是否配 `__usePrivacyCheck__`**。两道关：

    - **后台必须声明。** 未在《用户隐私保护指引》里声明该信息类型，接口会被**直接禁用**。这一步只能在微信公众平台后台做，代码无解。
    - **声明后仍要同步用户同意。** 由代码做，`utils/export.js` 的 `ensurePrivacy()` 在保存前先查 `wx.getPrivacySetting`，只有 `needAuthorization` 为真才弹授权。

    **这个坑最阴的地方是它只在正式版暴露**：开发版与体验版不受隐私声明限制，所以真机预览、真机调试全部正常，一发版就报 `saveImageToPhotosAlbum:fail privacy permission is not authorized`。

    `ensurePrivacy()` 特意做成「后台没配指引时也不阻断」，避免自己把测试流程堵死。

### 本地文件回收

15. 每次出图都在 `wx.env.USER_DATA_PATH` 落一个新的 PNG，从不清理会一直堆积，小程序本地存储有配额上限。`onExport` 里记下上一次的 `resultPath`，新图成功后删掉旧文件，稳态只保留一张。实测连出两次图，文件总数只增加 1。

### 自动化（本机踩到的）

10. 用模拟器自动化驱动点击时，**点 `#btnExport` 会让工具自动滚动页面**，之后风格网格被推出可视区，再点 `#style-N` 会静默失败（返回 `success: false`，不报错）。每轮切换风格前先 `automation_viewport_action --action pageScrollTo --scroll-top 0`。
11. 连续调用 `automation_element_action` 可能拿到过期结果，两次之间插 `sleep`；`simulator_open_page` 重编译后要给 automator 几秒重新挂载，否则直接超时。
12. **`automation_page_action` 在 Git Bash 下不可用。** MSYS 的参数转换会把它打坏（报 `'D:\Program' is not recognized`）。要在 PowerShell 里调。
20. **`pageScrollTo` 对 `scroll-view` 无效**，`automation_element_action --action scrollTo` 同样不见效 —— 这一页的可滚动容器是 `scroll-view`（不是 page），工具滚的是 page。想验证屏幕外的内容，只能临时加一个 `setData` 方法用 `callMethod --args-file` 顶上去：
    ```js
    _dbg(patch) { this.setData(patch || {}); }
    ```
    再配 `scroll-top="{{scrollTop}}"` 绑定，`_dbg([{"scrollTop":470}])` 即可。验完记得删。
13. **PowerShell 5.1 会把传给原生 exe 的内嵌双引号剥掉**，`--patch '{"a":"b"}'` 到那边会变成 `{a:b}`，报 `Expected property name or '}' in JSON at position 1`。绕法是走 `callMethod --args-file <绝对路径>`，让 CLI 自己读文件，参数里只出现路径。中文内容写成 `\uXXXX` 转义（纯 ASCII），连编码问题一并躲掉。

## 包体积

改版后实测主包 **61,092 字节（约 60 KB）**（改版前 55,422 字节；增量来自两步流程的 WXML/WXSS）。

打包范围内 16 个文件合计 69,692 字节，**比主包大 8 KB**。包比源码小是正常的：`project.config.json` 里 `minifyWXSS` 与 `minifyWXML` 都开着，WXML/WXSS 的空白与注释会被压掉。用这两个数互相校验时注意方向，不是「源码应当小于主包」。

对比：旧版设计（内联 8 MB 明朝体子集）主包是 593,732 字节。移除内联字体后降了一个数量级，离 2 MB 上限非常远。

`test-results/` 与 `tools/` 已在 `project.config.json` 的 `packOptions.ignore` 里排除，验证过：往里塞一个 1 MB 文件，编译出的包体积纹丝不动。

## 验证记录（2026-09-22）

模拟器自动化实测，出图全部通过：

| 产物 | 尺寸 | 字节 | md5 前 10 位 |
| --- | --- | --- | --- |
| new-minimal.png | 2000×2666 | 93,758 | `c176909ba2` |
| new-editorial.png | 2000×2666 | 175,959 | `4b31333194` |
| new-bold.png | 2000×2666 | 110,795 | `254339eb36` |
| new-dark.png | 2000×2666 | 76,841 | `b429e3d205` |
| new-gradient.png | 2000×2666 | 276,175 | `d7576c996b` |
| fmt-square.png | 2000×2000 | 88,201 | `927044e0a8` |
| fmt-landscape.png | 2000×1500 | 82,754 | `b82319bf1f` |

五套风格 md5 互不相同，三种格式比例精确（1.0000 / 0.7502 / 1.3333）。

## 验证记录（2026-09-23）

把渲染函数原文从线上 chunk 里扒出来逐项比对后，修掉三处偏差，并逐条实测：

| 修的东西 | 怎么验的 | 结果 |
| --- | --- | --- |
| 水印字体应为 sans（原先错跟了 `dateFont`） | 极简风格出图，水印从等宽体变回无衬线 | `test-results/zh-cjk.png` |
| 中文逐字断行（原先整句成一个行内块） | 注入 44 字中文，出图折成 4 行 | 同上，`2000×2666` |
| 空文案回退占位符 | 置空正文，预览出现「想说点什么？」+ `ANONYMOUS` | 模拟器截图 |
| 结果区字节数（原先恒为 0） | 出图后读 `resultInfo` | `2000 × 2666 px，约 92 KB` |

另外用「加阴影前后导出 md5 是否一致」实测了一个推断：线上卡片的 `shadow-2xl` **不会进导出图**。原因在 `modern-screenshot` 的源码里 —— 画布尺寸取自元素的 `getBoundingClientRect()`，不为外阴影留边距。所以卡片加阴影只影响 App 内预览（与线上预览一致），导出图逐字节不变：

```
无阴影  2000×2666  94,622 B  md5=26d1a8c2c88c51a43a2be5e471d79467
加阴影  2000×2666  94,622 B  md5=26d1a8c2c88c51a43a2be5e471d79467
```

断行那层的单测 `node tools/test-tokens.js`，19 例全过（含中英混排、日文、韩文、emoji、全角标点）。

同日还补了四项产品侧的缺口，并逐条在模拟器实测：

| 补的东西 | 为什么要补 | 怎么验的 |
| --- | --- | --- |
| 隐私授权门禁 | `saveImageToPhotosAlbum` 是隐私接口，正式版会被拦（见坑 14） | 无指引时 `ensurePrivacy` 直接放行，保存不被自己挡住 |
| 出图文件回收 | 之前每出一张图就留一个文件，实测已堆积 30 个 | 连出两次图，文件数只 +1，第一次的产物被删除 |
| 「清空」按钮 | 旧版网页有，小程序一直缺 | 点后正文与署名清空，卡片回退到占位符 |
| 单条文案时隐藏「换一换」 | 生日祝福只有 1 条，`(0+1)%1 = 0`，点了完全没反应 | 切到生日分类，`canShuffle` 为 `false` |

## 验证记录（2026-09-23 改版：两步流程）

模拟器自动化实测，截图存 `test-results/ui-*.jpg`：

| 环节 | 怎么验的 | 结果 |
| --- | --- | --- |
| 第一步渲染 | `simulator_open_page` + 截图 | `ui-step1-write.jpg` |
| 空态与禁用 | 置空正文后读 `canNext` + 截图 | `canNext=false`，按钮转灰、文案变「先写点什么」，`ui-step1-empty.jpg` |
| 进入第二步 | 点 `#btnNext`，读 `step` + 截图 | `step=2`，`ui-step2-style.jpg` |
| 版式网格与色卡 | 滚到版式区截图 | 五套齐全，光韵直接渲染真渐变，`ui-step2-grid.jpg` |
| 返回第一步 | 点 `#btnBack`，读 `content` | 内容与署名保持，不清空 |
| 出图与成品面板 | 点 `#btnExport`，读 `resultInfo` + 截图 | `2000 × 2666 px，约 92 KB`，`ui-step2-result.jpg` |
| 界面文案无豆腐块 | 静态检查 + 逐屏肉眼核对 | `node tools/check-wxml.js` 通过 |

同轮修掉的问题，按发现顺序：

1. 底栏整个不渲染 —— `position: fixed` 在 Skyline 下不可靠（坑 17）。
2. 主按钮中文变豆腐块 —— `<text>` 内容另起一行（坑 16）。为此写了 `tools/check-wxml.js`。
3. 第二步的「上一步」与步骤号被微信胶囊按钮压住（坑 18）。
4. 滚动时卡片从状态栏底下穿过（坑 19）。
5. 光韵的色卡原本用假粉色顶替，改成直接渲染真渐变。

## 发版前必须做的后台配置（只有你能做）

代码侧已经就绪，下面这几件在微信公众平台后台，做完才能真正上线：

1. ~~注册正式 AppID~~ 已完成（2026-09-30）：`project.config.json` 已绑定正式账号 `wxc3b9ed4b6afa9d78`。
2. **配置《用户隐私保护指引》**，勾选「相册（仅写入）」并填用途说明。**不配的话正式版保存功能必然失败**，而开发版与体验版一切正常，所以这一步漏了不会在测试时发现。用途要写具体，例如「用于将生成的卡片图片保存到您的相册，图片仅存于本机，不会上传」；修改后审核需要数小时，有延迟。
3. **选服务类目**。「工具 / 图片处理」这类需要额外勾选图片存储与管理等子项，否则接口同样受限。
4. 小程序名称、头像、简介。注意获取方式要靠搜索与分享，没有网页版的 SEO 入口。

## 已知差异

- 线上版正文用 `motion` 库做入场动画（rotate + scale），小程序的 snapshot 取的是静态帧，没有对应能力。**取静态帧反而更接近「最终版式」**，因为线上版快照时动画已经结束。属可接受的差异。
- 线上正文是 `whitespace-pre-wrap break-words`。`break-words` 意味着**超长单词会被强制断行**；本实现是整词成块，一个比卡片还长的单词（比如长 URL）会溢出。文案场景下罕见，未做处理。
- 线上版「杂志」风格的光斑带 `mix-blend-multiply`，Skyline 无此属性，只保留了 20% 橙 + 64px 模糊。视觉差异很小。
- 线上版另有「下载 / 复制到剪贴板 / Web Share」三路导出；小程序侧是「保存到相册 / 分享给好友」。剪贴板在微信里没有可用落点（图片不能进剪贴板被其他 app 取用），故不做。

## 当前状态

AppID 已于 2026-09-30 替换为正式账号 `wxc3b9ed4b6afa9d78`（绑定到之前已发布的小程序，用新代码覆盖发布）；此前用的是测试号 `wx919392d18745f2a4`。

- 已在模拟器验证：两步流程（进 / 回 / 空态禁用）、五个风格切换、三种格式切换、出图、落盘、中文断行、空态占位符、出图文件回收。
- 真机验证过：生成图片、保存到相册、分享给好友。**但那次是在「一页式」旧布局上做的**，两步改版与 01 页切换 webview 渲染器之后还没上过真机，字体栈、渐变与混合渲染的跳转需要在真机上再扫一遍。
- 待办：后台两项（隐私指引 / 类目，见上）；名称、头像、简介（头像用 test-results/icons/icon-144.png）；两步流程 + webview 写作页的真机复验；加载态与错误提示仍然很粗；超长单词溢出。
