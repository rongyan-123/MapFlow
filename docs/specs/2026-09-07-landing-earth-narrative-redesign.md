# MapFlow 首页 Earth 叙事重设计方案与验证清单

## 目标与边界

把首页从明亮的静态产品介绍改成一段可以被滚动阅读的产品叙事：一颗可识别、可拖拽、可缩放的地球持续留在页面背景中，前景按五个独立视口场景解释 MapFlow 如何把学习方向、理解过程和学习进度组织成一张地图。

本轮只改首页、首页动画/渲染资源、首页测试和本方案/第三方归属文档；保留工作台、登录、MCP 接入能力、计费和后端协议。不会部署或推送。

## 已核对的参考源码与取舍

- [jeantimex/flights-tracker](https://github.com/jeantimex/flights-tracker)：已核对 `Earth.js`、`Utils.js`、`Flight.js`、`MergedFlightPaths.js`、`Stars.js`、`main.js`。复用其 Earth sphere、纬经度投影、球面弧线路径和星场的实现思路；不搬入 dat.GUI、Stats/FPS、坐标页脚、飞机演示 UI、强制至少 2 秒 loading 或 loading 后自动镜头动画。
- [CRT fisheye CodePen](https://codepen.io/fand/pen/YPXBwVd)：只取开场 CRT/空间失真的视觉语法。实现为一次性的轻量 CSS 进场，降低色差、噪点和扫描线，不闪烁、不持续抖动，动画停止后标题仍然清晰。
- [Gridmorphic scroll scene CodePen](https://codepen.io/gridmorphic/pen/WbQPRwv)：只取固定媒体、clip-mask reveal 和滚动触发切换的构图语法。MapFlow 改成五个严格独立的 `100svh` 场景；停在任意场景时只有该场景文案和该场景地图画面可见，移动端不允许下一场景偷露。

## 叙事与文案

每个场景都使用一张明确的地图画面；地图节点来自现有 Agent 学习树中的真实主题，路线和节点关系标注为演示结构，不承诺职位或就业结果。

| 场景 | 标题 | 正文/转场 | 画面职责 |
| --- | --- | --- | --- |
| A 开场 | `学习——什么时候变得如此困难？` | `学习正在被异化成刷课、背题、追赶要求。痛苦、畏难随之而来，可到底该学什么、学到了什么，依然模糊。`<br><br>`看清学习与就业方向，建立自己的知识地图，随时查看学习进度。`<br>`这是 MapFlow 想帮你做的事。` | Earth 作为第一主视觉；初始就能看出是地球、星场和路线。开场 CRT 只发生一次。 |
| B | `学了这么多，我到底学会了什么？` | `写过项目，看过网课，也追问过许多问题。为什么回头看，还是说不清自己掌握了什么？`<br><br>`这些理解，还没有汇成一张看得见全貌的学习地图。` | 先模糊/扁平的关系线，随后 clip-mask 拉开，第一次露出完整 MapFlow 产品地图；背景 Earth 镜头不移动。 |
| C | `想进入一个领域，却不知道到底该学什么？` | `比如 Agent 开发，需要哪些基础，又会遇到哪些工程问题？把学习与就业方向展开成地图，先看清全貌，再决定从哪里开始。` | 展开 Agent 领域的真实主题路径：Python 基础 → FastAPI → LLM API → Agent 核心 / MCP → RAG / 生产化。 |
| D | `让每次理解，都丰富自己的地图。` | `学到一个概念，就把它放进地图；发现新的联系，就把它们连接起来。接入 MCP 后，也可以让你常用的 AI 帮你补充、整理。` | 在 C 的同一张图上增量出现节点和边；明确展示示例动作 `把刚才讨论的数据库迁移，整理进我的地图`，标注“示例操作”，不伪造个人进度。 |
| E | `学到了哪里，打开地图就知道。` | `已经理解的、还没弄懂的、接下来想探索的，都能在地图上看见。每次回来，都能接着丰富自己的体系。` | 同一张地图显示 completed / in-progress / next 三种可解释状态；唯一主 CTA 为 `打开我的学习地图`，进入现有工作台路由。 |

页眉保留登录和 Agent 接入入口，并增加一个常驻的 `进入工作台` 跳过叙事按钮。桌面标题尽量单行；移动端按中文语义自然换行，不用强制三行断词，也不使用大字号挤压正文。

## 组件与生命周期

```text
LandingPage
├─ LandingEarthBackground       // 唯一实例，固定背景，贯穿 A-E
├─ LandingHeader                // 登录、Agent 接入、跳过叙事
├─ LandingStory
│  ├─ Scene A: opening
│  ├─ Scene B: blur → reveal
│  ├─ Scene C: domain map
│  ├─ Scene D: MCP illustrative mutation
│  └─ Scene E: progress + CTA
└─ footer / existing MCP dialog
```

- `LandingEarthBackground` 只在 `LandingPage` 挂载一次，不按场景 key、不按滚动进度卸载，不从滚动位置写 camera position。Earth 的 mesh、routes、stars 和 camera ref 在首页滚动中保持同一生命周期。
- Earth 采用 Three.js/R3F 的轻量程序化纹理和现有 Agent 图谱主题；路线使用 `latLngToVector3` 语义与球面 Catmull-Rom 弧线。首屏只渲染少量路线和星点，移动端降低 DPR、路线点数和星点数。
- 视线层次：Earth/stars/routes 低亮度但可辨认；前景 copy 使用稳定的不透明/半透明深色面板，避免背景影响阅读；背景不抢正文。
- WebGL 不可用或创建 renderer 失败时，使用同一数据的 CSS/SVG Earth fallback；`prefers-reduced-motion` 下关闭自转/粒子闪烁/转场位移，只保留静态 Earth、路线和内容。

## 输入事件策略

- 鼠标/触控板拖拽空白 Canvas：旋转 Earth；提供低发现度的“重置视角”按钮。
- `Ctrl + wheel`：缩放 Earth；普通 wheel 完全交给页面滚动，不改变 camera。
- 触屏单指：默认 `touch-action: pan-y`，纵向手势优先滚动；仅在明显水平拖拽后旋转；双指 pinch 才缩放。
- Earth 第一次交互前显示一次 `拖动旋转 · Ctrl+滚轮缩放` 提示；提示不阻挡正文和 CTA。
- 所有控件可键盘访问，按钮有中文可读名称；地图装饰不承担唯一信息，场景正文和 `aria-label` 提供同等语义。

## 实施步骤与逐步验证

1. 先在 `landingMotion` 增加五场景进度、active scene、媒体 reveal 和输入判定纯函数测试，先跑红；验证：Vitest 只运行新增测试并确认失败原因是缺少实现。
2. 替换 `LandingStory` 为五个严格视口场景，加入已批准文案和真实主题地图结构；验证：LandingPage 测试覆盖 A-E 标题、关键正文、场景数、唯一 CTA、MCP dialog 和既有回调。
3. 新增 `LandingEarthBackground` 与纯函数 geometry/data 辅助；验证：组件测试覆盖唯一挂载标记、WebGL fallback、reduced-motion、缩放边界、垂直滚动不被阻止和 drag/pinch 事件规则。
4. 在 `LandingPage` 接入 persistent Earth、header 跳过按钮和路由 CTA；验证：组件测试确认 `onEnterConsole` / `onLogin` 仍被正确调用，进入工作台后不触发首页 API。
5. 加入 scoped CSS：深色背景、低亮路线、开场 CRT 一次性动画、clip-mask reveal、移动端独立 scene 和无横向溢出；验证：浏览器截图检查标题/正文可读、无持续闪烁、场景不互相露出。
6. 记录并判断本地“来源凭证”错误；验证：Browser Harness 保存 API 请求/响应摘要。2026-09-07 当前已观察到：`GET /api/capabilities` 同源 200，匿名 `GET /api/auth/session` 401，响应含 `Vary: Origin`，请求来自 `http://127.0.0.1:5177`；这两条是预期能力/匿名会话行为，不能据此修改生产 Origin/CSRF。若后续复现到 mutation 403，才对照其 `Origin`、`Host`、`X-CSRF-Token` 和 `x-request-id` 判断；不以放宽校验作为修复。
7. 完成后运行全量测试、typecheck、production build，并检查最终 diff；验证：所有命令结果记录在交付说明，Browser Harness 再做桌面和 375/390 宽度的滚动/拖拽/缩放/返回/CTA 验收。

## 验收清单

### 自动化

- [ ] landingMotion 先红后绿，覆盖五场景边界、reduced-motion、缩放上下限和触控方向判断。
- [ ] LandingPage 测试通过，既有 MCP 教程复制/关闭行为不回归。
- [ ] 全量 Vitest 通过。
- [ ] TypeScript typecheck 通过。
- [ ] Vite production build 通过。
- [ ] diff 自审：无 billing、后端、登录协议和无关工作台改动；无无主 TODO。

### Browser Harness

- [ ] 桌面 2134×1073：首屏 Earth/星场/路线可辨认；标题和正文稳定可读；开场 CRT 仅出现一次且不闪。
- [ ] 滚过 A→E：每个 `100svh` 停止点只有当前 scene copy/media；没有下一幕露头；B 的 clip reveal、C/D/E 的图像状态连续且不跳镜头。
- [ ] 滚回 B/A：Earth 仍是同一背景实例，camera/zoom/rotation 不被重置；普通滚轮仍只滚页面。
- [ ] 空白处拖拽旋转、`Ctrl+wheel` 缩放、重置按钮有效；提示在第一次交互后消失。
- [ ] 375×844 和 390×844：严格独立场景，无横向溢出、正文不裁切、CTA 可见且可点；纵向触控滚动不被 Canvas 截获。
- [ ] WebGL fallback/reduced-motion：仍显示可辨认 Earth/路线和全部文案。
- [ ] 点击 `打开我的学习地图` / `进入工作台` 进入现有 `/console`；登录、Agent 接入和 MCP 教程保持可用。

## 第三方归属

飞行追踪器的 MIT notice 保存在 [`docs/THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)。本项目只采用其 Earth/route/starfield renderer 的必要结构和数学语义，不包含其 GUI/FPS/loading/demo UI；任何后续复制其源码片段时，必须继续保留该 notice。
