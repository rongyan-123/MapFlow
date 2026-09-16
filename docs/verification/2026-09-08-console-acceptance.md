# 控制台重构验收记录（2026-09-08）

本记录对应[控制台重构实施计划](../plans/2026-09-08-console-redesign.md)。本轮只处理控制台的工作台、方向详情、地图外壳及移动端适配；已验收的 landing、计费与后端接口没有改动。

## 交付行为

- 工作台使用紧凑的学习方向列表。桌面端可比较领域、受众和真实知识点数量；390 × 844 首屏可以看到两个方向及其入口，页面没有水平溢出。
- 个人学习区按真实地图逐项显示名称、完成数、总数和进度。返回用户的两张地图分别保留继续入口；加载、失败和空状态互斥显示。
- 方向详情保留返回、摘要、适合人群、基础要求、真实推荐节点和起始问题。`开始探索`、`先看地图` 保持原有动作语义，地图提示为“地图可直接浏览，加入后记录个人进度”。
- 地图阶段保留暗色画布，压缩目录并在选中节点后才显示详情栏。公共地图在顶部操作条提供“加入我的学习”；加入失败提示与按钮相邻且不会重复出现在隐藏侧栏。
- 控制台 header 在手机端直接显示“探索 / 我的学习”；匿名登录入口保持可见，已登录账户区可收进既有更多菜单。320px 下标题区域允许收缩，右侧操作区保持不收缩。

## 浏览器证据

截图根目录：`C:/Users/Administrator/.codex/visualizations/2026/09/08/console/`。

- 工作台与详情：`iteration-home-desktop.png`、`iteration-home-mobile.png`、`iteration-intro-desktop.png`、`iteration-intro-mobile.png`。
- 返回用户与状态互斥：`iteration-returning-desktop.png`、`iteration-empty-mobile.png`、`iteration-error-mobile.png`、`iteration-loading-mobile.png`。
- 地图桌面、手机和横屏：`after-map-desktop.png`、`after-map-390.png`、`after-map-844.png`、`after-detail-mobile.png`、`after-personal-map-mobile.png`、`after-personal-detail-mobile.png`。
- 320px 与 375px 的地图边界记录：`after-map-320.png`、`after-map-375.png`。最终 320px header 收缩规则随后以内联 console CSS 修正，并通过类型检查和 diff 检查。

`after-home-desktop.png` 和 `after-home-mobile.png` 是账号状态同步中的短暂截图，不作为“登录按钮已加载”的证据；稳定的登录入口以 `iteration-home-mobile.png` 为准。`iteration-personal-mobile.png` 是账户 header 修补前的旧截图，不作为最终个人 header 证据。`after-chat-mobile.png` 使用的 fixture 历史响应与当前验收不匹配，未作为真实聊天健康截图引用。

公共地图正常读取真实公共 API，并渲染 79 个节点。返回用户、空库、失败和加载场景使用 `C:/Users/Administrator/.codex/visualizations/2026/09/08/console/fixture.js` 的只读 fixture 验收；fixture 拦截写请求，`blockedWrites=[]`。推荐问题填入聊天草稿后没有自动发送。

验收期间公共 API 曾出现一次代理 500（约 21 秒），重新进入后恢复 200；这是网络波动，未宣称修复后端。

## 工程验证

- `npm test`：39 个测试文件、342 个测试通过。
- `npm run typecheck`：通过。
- `npm run build`：通过，包含 TypeScript 检查；Vite 仅报告既有主 chunk 超过 500 kB 的 advisory。
- `git diff --check`：通过。
- landing smoke：通过；console audit 正常读取时 `window.__consoleAudit=false`，无水平溢出记录。

## 范围与限制

- 本轮没有修改 landing 源码、计费、身份 API、加入/聊天/进度业务契约或后端。
- 真实公共地图依赖预览端口的只读 API；fixture 状态用于验证 UI 状态互斥，不代表后端错误处理已改变。
- 截图是在本机 Chromium 的指定桌面、手机和横屏尺寸采集，不等同于所有实体设备的性能保证。
- 变更只保留在本地，未推送或部署。
