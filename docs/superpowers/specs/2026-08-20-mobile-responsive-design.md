# 手机端适配 设计文档

**日期**: 2026-08-20
**状态**: 待确认

## 背景

MapFlow 教学系统目前只有 PC 端可用——布局为「三栏固定全屏」（左侧技能树列表 `w-64` + 中间图区 + 右侧详情面板 `w-80`，三栏合计 576px，超出 iPhone 390px 宽度），手机浏览器访问必然挤压溢出。用户希望手机也能正常访问**全部功能**（不能砍功能），布局参考「豆包」模式：主界面单栏 + 左上角抽屉菜单收纳其他功能入口。

已调研：llm-wiki 无直接移动端适配经验；Web 主流做法（Material Navigation Drawer、Master-Detail 移动端退化、WCAG 2.5.5 触摸目标 44px、safe-area 处理、防横向溢出）已确认，本设计逐条对齐。

## 现状调查（已确认的事实）

- 前端：React 18 + Vite + Tailwind 3（`tailwind.config.ts`，默认断点 sm/md/lg/xl）+ `@xyflow/react` 12（技能树图，原生支持触摸平移缩放）+ react-query。无路由库，`AppView` 三态（public/personal/admin）在 App.tsx 用 state 切换。
- `index.html` 已有 `viewport` meta（`width=device-width, initial-scale=1.0`）。
- `html, body, #root { width/height: 100%; overflow: hidden }`——全屏固定视口布局（index.css）。
- App.tsx（693 行）状态：`view`（AppView）、`selectedPublicTreeId` / `selectedLibraryEntryId` / `selectedNodeId`、`completion`、`generationDialogOpen`、`generationSessionId`。结构：header（`min-h-16`，导航 + 积分胶囊 + 公告按钮 + 用户区）→ main（`aside w-64` 树列表 → `section flex-1` 图 → `aside w-80` 节点详情）。
- Dialog 均为自研 `fixed inset-0 z-50` 全屏遮罩，内部容器 `max-w-*` 固定宽度（如 TreeGenerationDialog `max-w-4xl`、PlatformGenerationConfirmation `max-w-md`）。
- 管理面板 AdminPanel：`TABS` 数组 + map 渲染，六 Tab（overview/accounts/invitations/audit/feedback/announcements）。
- FeedbackButton 悬浮按钮：`fixed bottom-5 right-5 z-40`，天然适合手机。
- 前端测试：vitest + jsdom（136 用例），布局类无法真实测断点（jsdom 无视口），交互逻辑可测。

## 设计

### A. 布局架构：一套代码、两种形态

以 Tailwind `lg`（1024px）为断点。**PC（≥lg）完全保持现状不动**（零回归风险）；**手机/小平板（<lg）单栏形态**。

| 区域 | PC（≥lg） | 手机（<lg） |
|---|---|---|
| header | 现状 | 「☰ 按钮 + 标题 + 积分胶囊」，导航与其余按钮收起 |
| 主内容 | 三栏（列表 w-64 + 图 + 详情 w-80） | 单栏视图栈：列表页 → 图页 → 详情页（带返回） |
| 其他功能入口 | 现状 header | 左上角抽屉（半屏滑出 + 遮罩 + Esc/遮罩关闭） |
| 管理面板 | 现状 | 全屏页 + Tab 横向滚动 |
| 弹窗 Dialog | 现状 | 内容宽度自适应手机（`max-w-[min(42rem,calc(100vw-2rem))]`） |
| FeedbackButton | 现状 | 保留（右下角悬浮） |

### B. 手机单栏视图栈

新增 App 级状态 `mobileView: 'list' | 'graph' | 'detail'`（仅 <lg 生效），由既有 selected 状态驱动：

- **列表页**：现有 sidebar 内容（树列表 + 生成按钮）全屏化。
- **图页**：点列表项进入，`@xyflow/react` 全屏图（触摸平移缩放原生支持），顶部返回条（← 回列表）。
- **详情页**：点节点进入，现有 aside 内容全屏化（节点详情/诊断/调整），返回回图页。
- 视图间用既有 `selectedPublicTreeId` / `selectedLibraryEntryId` / `selectedNodeId` 驱动，不引入新导航库。

### C. 左上角抽屉（豆包式导航）

`<lg` 时 header 左侧 ☰ 按钮打开抽屉：半屏（`max-w-[85vw]`）滑出 + 遮罩（点遮罩/Esc 关闭）。内容 = 现有 header 全部功能入口重组（**功能不减，入口移动**）：视图切换（公共树库/我的学习/管理面板[仅管理员]）、公告、意见反馈、账号操作（登录/登出）。积分胶囊保留在手机 header 右侧（签到入口）。复用现有 Dialog 的遮罩模式。

### D. 组件适配清单

1. App.tsx：断点布局分支 + `mobileView` 状态 + 抽屉状态 + header 手机版。
2. 三栏组件（树列表/图区/节点详情）：手机全屏化（现有内容组件复用，容器类改响应式）。
3. Dialog 族（公告/反馈/签到/生成/确认）：内部容器 `max-w-*` 改为 `max-w-[min(42rem,calc(100vw-2rem))]`，内部 flex 布局允许垂直滚动。
4. AdminPanel：`<lg` 全屏 + TABS 容器 `overflow-x-auto`。
5. 全局：触摸目标 ≥44px（`min-h-11`）、`html/body { overflow-x: hidden }` 兜底、`env(safe-area-inset-*)` 用于 header/底部悬浮按钮（iPhone 安全区）。
6. 不引入新依赖。

### E. 明确不做（第一版）

- PWA / 离线缓存 / 安装包
- 独立移动端路由库 / 框架
- 性能专项优化（图片懒加载等）
- 平板横屏专项布局（768-1023 走单栏，可接受）

## 风险与缓解

- **PC 回归**：PC 形态完全不改动件结构，仅加响应式类——用现有 136 测试 + 浏览器验收保底。
- **jsdom 测不了断点**：视图切换/抽屉交互逻辑拆为可测状态（组件测试覆盖「状态变化 → 渲染结果」），布局样式靠浏览器移动模拟 + 真机验收。
- **App.tsx 结构重组触碰所有视图接线**：改动集中在容器层，内容组件不动；测试先行。

## 验证方式

- 前端：`npm test`（新增视图切换/抽屉交互测试）+ `npm run typecheck` + `npm run build`。
- 布局验收：`npm run dev` + 浏览器 DevTools 移动模拟（375px/390px）逐页检查（登录、列表→图→详情、抽屉各入口、管理面板六 Tab、签到/反馈/公告弹窗、生成技能树全流程），再用真机（iOS Safari + Android Chrome）复验。
- 回归：PC 窗口（≥1024px）验收三栏布局与 header 无变化。
- 部署：push 自动部署后 curl + 手机真机访问 https://xxian.fun 复验。

## 范围外（明确不做）

- PWA、离线、安装包
- 手机专属新功能（推送通知等）
- 技能树图交互重设计（保留 xyflow 触摸能力，不重做）
