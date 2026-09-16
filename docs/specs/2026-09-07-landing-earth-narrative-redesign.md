# MapFlow 首页 Earth 叙事重设计方案与验证清单

## 目标与边界

把首页从明亮的静态产品介绍改成一段可以被滚动阅读的产品叙事：一颗可识别、可拖拽、可缩放的地球作为唯一持久背景实例，在 A/B 前段保持隐藏，滚到 B 的转场时才可逆地揭示；随后 C/D/E 用同一颗地球解释 MapFlow 如何把学习方向、理解过程和学习进度组织成一张地图。

本轮只改首页、首页动画/渲染资源、首页测试和本方案/第三方归属文档；保留工作台、登录、MCP 接入能力、计费和后端协议。不会部署或推送。

## 已核对的参考源码与取舍

- [jeantimex/flights-tracker](https://github.com/jeantimex/flights-tracker)：已核对 `Earth.js`、`Utils.js`、`Flight.js`、`MergedFlightPaths.js`、`Stars.js`、`main.js`。复用其 Earth sphere、纬经度投影、球面弧线路径和星场的实现思路；不搬入 dat.GUI、Stats/FPS、坐标页脚、飞机演示 UI、强制至少 2 秒 loading 或 loading 后自动镜头动画。
- [CRT fisheye CodePen](https://codepen.io/fand/pen/YPXBwVd)：只取开场 CRT/空间失真的视觉语法。实现为本地 WebGL shader overlay，包含桶形失真、扫描线、轻微色差和噪点；效果随开场滚动进度可逆地减弱到零，不依赖 VFX-JS，稳定状态只有一份清晰标题。
- [Gridmorphic scroll scene CodePen](https://codepen.io/gridmorphic/pen/WbQPRwv)：只取固定媒体、clip-mask reveal 和滚动触发切换的构图语法。MapFlow 桌面端使用五个严格独立的 `100svh` 场景；短视口允许当前 scene 延展到可滚动高度，停在任意场景时只有该场景文案和该场景地图画面可见，移动端不允许下一场景偷露。

## 叙事与文案

每个场景都使用一张明确的地图画面；地图节点来自现有 Agent 学习树中的真实主题，路线和节点关系标注为演示结构，不承诺职位或就业结果。

| 场景 | 标题 | 正文/转场 | 画面职责 |
| --- | --- | --- | --- |
| A 开场 | `学习——什么时候变得如此困难？` | `学习正在被异化成刷课、背题、追赶要求。痛苦、畏难随之而来，可到底该学什么、学到了什么，依然模糊。`<br><br>`看清学习与就业方向，建立自己的知识地图，随时查看学习进度。`<br>`这是 MapFlow 想帮你做的事。` | 黑暗、逼仄的 cyber 开场；只保留受控的鱼眼/轻微色差/噪点和可读文案，不显示完整 Earth、路线或缩放控件。 |
| B | `学了这么多，我到底学会了什么？` | `写过项目，看过网课，也追问过许多问题。为什么回头看，还是说不清自己掌握了什么？`<br><br>`这些理解，还没有汇成一张看得见全貌的学习地图。` | 在问题段保持逼仄且不显示 Earth；读到最后一句时，前景和关系图用可逆 clip-mask 打开，Earth 同步从隐藏状态渐进揭示。 |
| C | `想进入一个领域，却不知道到底该学什么？` | `比如 Agent 开发，需要哪些基础，又会遇到哪些工程问题？把学习与就业方向展开成地图，先看清全貌，再决定从哪里开始。` | 使用同一张完整结构图和同一颗已揭示的 Earth：Python 基础 → FastAPI → LLM API → Agent 核心 → LangGraph / RAG / 生产化。 |
| D | `让每次理解，都丰富自己的地图。` | `学到一个概念，就把它放进地图；发现新的联系，就把它们连接起来。接入 MCP 后，也可以让你常用的 AI 帮你补充、整理。` | 在 C 的同一张图上增量出现 MCP 节点和边；明确展示示例动作 `把刚才讨论的数据库迁移，整理进我的地图`，标注“示例操作”，不伪造个人进度。 |
| E | `学到了哪里，打开地图就知道。` | `已经理解的、还没弄懂的、接下来想探索的，都能在地图上看见。每次回来，都能接着丰富自己的体系。` | 同一张图显示“已理解 / 正在探索 / 下一步”三种可解释状态；唯一主 CTA 为 `打开我的学习地图`，进入现有工作台路由。 |

页眉只保留必要的登录、Agent 接入和 `进入工作台` 入口。桌面标题尽量单行；移动端按中文语义自然换行，不用强制三行断词，也不使用大字号挤压正文。

## 组件与生命周期

```text
LandingPage
├─ LandingEarthBackground       // 唯一实例，固定背景，A/B 隐藏后在 B 转场揭示
├─ LandingHeader                // 登录、Agent 接入、进入工作台
├─ LandingStory
│  ├─ Scene A: opening
│  ├─ Scene B: blur → reveal
│  ├─ Scene C: domain map
│  ├─ Scene D: MCP illustrative mutation
│  └─ Scene E: progress + CTA
└─ E-scene attribution / existing MCP dialog
```

- `LandingEarthBackground` 只在 `LandingPage` 挂载一次，不按场景 key、不按滚动进度卸载，不从滚动位置写 camera position。A/B 前段通过 opacity 和 pointer-events 隐藏 Earth 与控件；B 转场后逐步开放交互。Earth 的 mesh、routes、stars、camera ref 和 zoom state 在首页滚动中保持同一生命周期，滚回 A/B 只隐藏，不重置。
- Earth 优先加载仓库内随包发布的 `public/world.topo.jpg`（来自 flights-tracker 的 `public/world.topo.jpg`），失败时回退到低亮度海面/经纬线纹理；路线使用其 `latLngToVector3` 语义与球面 Catmull-Rom 弧线，星场使用同源的点精灵闪烁语义。首屏只渲染少量路线和星点，移动端降低 DPR、路线点数和星点数。
- 视线层次：A/B 前段由稳定 veil 保持逼仄和可读；揭示后 Earth/stars/routes 低亮度但可辨认，前景 copy 保持高对比度；背景不抢正文。
- CRT shader 的参数随开场进度从轻微失真收敛到零；窄屏保留 shader canvas 但降低采样分辨率，配合 CSS 色散与曲面视窗，避免绘制第二份错位标题。
- WebGL 不可用或创建 renderer 失败时，使用同一数据的 CSS/SVG Earth fallback；`prefers-reduced-motion` 下关闭自转/粒子闪烁/转场位移，只保留静态 Earth、路线和内容。

## 输入事件策略

- 鼠标/触控板拖拽空白 Canvas：仅在 Earth 已揭示后旋转 Earth；提供低发现度的“重置视角”按钮。
- `Ctrl + wheel`：缩放 Earth；普通 wheel 完全交给页面滚动，不改变 camera。
- 触屏单指：默认 `touch-action: pan-y`，纵向手势优先滚动；仅在明显水平拖拽后旋转；双指 pinch 才缩放。
- Earth 第一次交互前显示一次 `拖动旋转 · Ctrl+滚轮缩放` 提示；A/B 隐藏阶段不显示控件，提示不阻挡正文和 CTA。
- 所有控件可键盘访问，按钮有中文可读名称；地图装饰不承担唯一信息，场景正文和 `aria-label` 提供同等语义。

## 实施步骤与逐步验证

1. 先在 `landingMotion` 增加五场景进度、active scene、媒体 reveal 和输入判定纯函数测试，先跑红；验证：Vitest 只运行新增测试并确认失败原因是缺少实现。
2. 替换 `LandingStory` 为五个严格视口场景，加入已批准文案和真实主题地图结构；验证：LandingPage 测试覆盖 A-E 标题、关键正文、场景数、唯一 CTA、MCP dialog 和既有回调。
3. 新增 `LandingEarthBackground` 与纯函数 geometry/data 辅助；验证：组件测试覆盖唯一挂载标记、WebGL fallback、缩放边界，纯函数和 Browser Harness 覆盖垂直滚动、drag/pinch 事件规则。
4. 在 `LandingPage` 接入 persistent Earth、header 跳过按钮和路由 CTA；验证：组件测试确认 `onEnterConsole` / `onLogin` 仍被正确调用，进入工作台后不触发首页 API。
5. 加入 scoped CSS 与本地 CRT WebGL overlay：深色背景、低亮路线、随进度可逆减弱的 shader、clip-mask reveal、移动端可延展 scene 和无横向溢出；验证：浏览器截图检查标题/正文可读、无持续闪烁、场景不互相露出。
6. 记录并判断本地“来源凭证”错误；验证：Browser Harness 保存 API 请求/响应摘要。2026-09-07 当前已观察到：`GET /api/capabilities` 同源 200，匿名 `GET /api/auth/session` 401，响应含 `Vary: Origin`，请求来自 `http://127.0.0.1:5177`；这两条是预期能力/匿名会话行为，不能据此修改生产 Origin/CSRF。若后续复现到 mutation 403，才对照其 `Origin`、`Host`、`X-CSRF-Token` 和 `x-request-id` 判断；不以放宽校验作为修复。
7. 完成后运行全量测试、typecheck、production build，并检查最终 diff；验证：所有命令结果记录在交付说明，Browser Harness 再做桌面和 390/768 宽度的滚动/拖拽/缩放/返回/CTA 验收。

## 验收清单

### 自动化

- [x] landingMotion 先红后绿，覆盖五场景边界、缩放上下限和触控方向判断。
- [x] LandingPage 测试通过，既有 MCP 教程复制/关闭行为不回归。
- [x] 全量 Vitest 通过：36 个测试文件、312 个测试。
- [x] TypeScript typecheck 通过。
- [x] Vite production build 通过（仅保留既有的大 chunk advisory）。
- [x] diff 自审：无 billing、后端、登录协议和无关工作台改动；无新增无主 TODO。

### Browser Harness

- [x] 桌面 1440×900：A 首屏不显示 Earth；B 前段保持隐藏，B 转场开始可见 Earth/关系图；C 的 Earth 为圆形，标题和正文稳定可读。
- [x] 滚过 A→E：A/B/C/D/E 只显示当前 scene copy/media；B 的 clip reveal 从 `100%` 逐步到 `0%`，D 增量显示 MCP 节点与边，E 显示进度图例。
- [x] 滚回 A 再回 C：Earth 仍是同一背景实例，zoom `1.18` 保留；隐藏阶段控件消失，重新揭示后控件恢复。
- [x] 空白处拖拽旋转、`Ctrl+wheel` 缩放、重置按钮有效；提示在第一次交互后消失。
- [x] 390×640、390×700、768×600、768×800：document 无横向溢出；短视口下 scene 可延展并可继续纵向滚动，E 的 CTA/归属说明可达；A 的 Earth 和控件隐藏。
- [x] WebGL fallback/reduced-motion：组件 fallback 测试通过；无自转/粒子闪烁，reduced-motion 仅保留静态 Earth、路线和内容。
- [x] 点击 `打开我的学习地图` / `进入工作台` 的回调与现有 `/console` 路由测试通过；登录、Agent 接入和 MCP 教程保持可用。

### 本次验证记录（2026-09-07）

- Browser Harness：1440×900 下，scrollTop `0` 和 `1000` 时 Earth 为 hidden；scrollTop `1200` 开始渐进揭示（Earth opacity `0.127`），scrollTop `1800` 完整揭示；B 的 map clip 从 `inset(... 100% ...)` 变为 `inset(... 52.5695% ...)`，C 为 `0%`。
- Browser Harness：scrollTop `2700` 的 D 场景出现 MCP 节点与橙色增量边；E 场景显示完整七节点地图、三种中文进度状态和 CTA。A/B/C/D/E 截图已保存到本地验证目录；A/B 前段没有完整 Earth，C/D/E 使用同一圆形 Earth。
- Browser Harness：真实 Canvas `Ctrl+wheel` 后事件 `defaultPrevented=true`、landing scrollTop 不变、zoom 从 `1` 到 `1.18`；普通 wheel 未被取消。拖拽测试使用五次各 3px 的慢速横向移动，累计位移足以触发旋转意图。
- Browser Harness：390×640、390×700、768×600、768×800 的 document/client width 相等且无横向溢出；短视口 scene 高度可延展，E 的 CTA 和 attribution 均可滚动到达；390px A 保留低采样 shader 且标题无重影。
- Browser Harness：768×800 复现过 inner 高于固定 scene 的边界问题；将短视口断点扩至 `max-height: 840px` 后，clarity/domain/mcp/progress 的 inner 均落在 scene 内，E 最大滚动位置仍可见 CTA（top `182`）和 attribution（top `768`）。
- Browser Harness：Earth zoom 在滚回隐藏阶段并重新回到 C 后仍为 `1.18`；隐藏阶段控件不渲染，重新揭示后恢复。
- Browser Harness：此前已模拟 `prefers-reduced-motion: reduce`，Earth/CRT 仍可渲染，场景 copy transition duration 为 `0s`；恢复默认媒体偏好后重新确认 Earth、CRT 和纹理请求正常。
- API 来源凭证：`GET /api/capabilities` 同源 200、匿名 `GET /api/auth/session` 401，均符合当前认证语义；未修改服务端 Origin/CSRF 或代理配置。

## 第三方归属

飞行追踪器的 MIT notice 保存在 [`docs/THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)。本项目只采用其 Earth/route/starfield renderer 的必要结构和数学语义，不包含其 GUI/FPS/loading/demo UI；任何后续复制其源码片段时，必须继续保留该 notice。
