# MapFlow 全站前端重做 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. User approved the full design and continuous implementation. Do not ask again for execution mode or scope.

**Goal:** 以已确认的全站设计替换全部旧页面，手机和桌面使用一致的导航与交互，并接入既有真实后端。

**Architecture:** 保留现有 React/Vite 工具链及服务器协议。页面、领域状态、API 请求和 UI 基础组件各自有明确边界；视图全部重做，已测试的非 UI 协议算法迁移并保留行为。App 只负责身份边界和页面组合，不继续容纳地图、聊天、钱包和后台状态。

**Tech Stack:** 已安装 React 18、TypeScript、Vite、TanStack Query、Vitest、React Flow、Excalidraw；不升级无关依赖。

**Spec:** docs/specs/2026-10-14-full-frontend-rebuild-design.md

## Global Constraints

- 手机只有一条 52px 内容顶部栏；浏览器顶部不预留额外假状态栏。
- 配置五页共用一个外框；桌面 820×650，较小窗口适配视口；手机为可视区域内完整配置页。
- 所有写请求携带原 CSRF 与身份信息；错误码、请求 ID、取消与失效登录的处理统一。
- 连接恢复只重新附着已有执行；结果未知时不自动再发一次收费请求。
- 正式产品不使用设计示例地图、进度、金额、假回复或假成功状态。
- 身份、权限、幂等、版本、事件序列和保存协议保持；纯 CSS/HTML 验收，新增业务逻辑 RED→GREEN。
- 前端固定入口保持 main；复用 b869 开发工作区与 codex/frontend-rebuild-20261014 分支，保存全部 Codex 会话和目录。
- 禁用 CaseRAG，不读取或调用相关技能与工具。旧生成器后端退役另行核对。

## Review Focus

1. 换账号、刷新和旧 /console、entry、area/node 深链：不能读取另一个账号的缓存，选中地图与学习区仍正确。
2. 删除最后一条会话后返回或刷新：不能自动创建默认会话，主动新建必须可用。
3. SSE 断开、结果未知、停止和审批：不能因为页面切换重复收费或丢失执行身份。
4. 手机键盘、安全区、长名称和 1024px：输入、操作与滚动必须可达，顶部只能一个。
5. 保存失败、充值订单不确定、未登录及非管理员：保留真实错误与恢复路径，不使用外观覆盖权限或账本状态。

## Task 1: 外壳、设计变量和兼容路由

**Files:** src/app/routes.ts、src/app/useLocation.ts、src/ui/{Icon,Button,Dialog,AppFrame,PageHeader}.tsx、src/ui/{tokens,layout,primitives}.css、src/app/routes.test.ts、src/ui/Dialog.test.tsx。

**Interfaces:**
- Consumes: window.location、原账号 console-state.v1 中的 view、已确认导航地址。
- Produces: `resolveRoute(address: string, legacyView?: 'public'|'personal'|'learning'): ApplicationRoute`；`useLocation(): {route: ApplicationRoute; navigate: (address:string, replace?:boolean)=>void}`；基础组件只依赖显示 props。
- PageHeader 由页面渲染，AppFrame 不再额外渲染一层顶部栏；AppFrame 的导航数据由调用方提供。

- [ ] 写路由兼容测试，断言已知字面结果和参数，不验证字符串源码。

```ts
expect(resolveRoute('/maps?entry=entry-1')).toMatchObject({ page: 'maps', entryId: 'entry-1' });
expect(resolveRoute('/learning?area=area-1&node=node-1&title=CSV')).toMatchObject({ page: 'learning', areaId: 'area-1', node: {id:'node-1', title:'CSV'} });
expect(resolveRoute('/console', 'personal').page).toBe('maps');
```

- [ ] `npm test -- src/app/routes.test.ts`，Expected: 路由功能未存在，测试失败。
- [ ] 实现逐项 URL 解析及旧入口兼容；新增弹层行为从真实点击、焦点、关闭后草稿/滚动恢复验证。
- [ ] 写 UI 与 CSS，采用设计稿变量、44px 手机操作和一个顶部栏；业务规则不放入基础组件。
- [ ] 跑路由、弹层测试和 typecheck；Expected: PASS。提交 `feat: establish new frontend shell and navigation`。

## Task 2: API 请求与领域协议迁移

**Files:** src/api/http.ts、src/api/http.test.ts；原 features 下 13 个 Client.ts 移到 src/api/；非 UI DTO 和验证迁入 src/domains/；更新所有已跟踪消费者和测试导入。

**Interfaces:**
- Consumes: 既有 URL、CSRF、credentials、AbortSignal、DTO 与 PublicUiError。
- Produces: `request(path:string, options?:RequestInit):Promise<Response>` 为唯一底层 HTTP 边界；各领域 API 保留现有导出函数与参数签名，领域类型不依赖页面。

- [ ] 先写 HTTP 行为测试，模拟服务器边界而非内部函数：GET 不丢身份、POST 保留 CSRF 与幂等 header、取消信号传递、不自动重试写请求、结构化错误可读。

```ts
const controller = new AbortController();
await request('/api/me/example', {method:'POST', signal:controller.signal, headers:{'X-CSRF-Token':'csrf','Idempotency-Key':'action-1'}, body:'{}'});
expect(sentRequest).toMatchObject({credentials:'same-origin', signal:controller.signal});
```

- [ ] 运行新测试观察失败，然后实现请求边界；保留各领域已有错误类及解析契约。
- [ ] 迁移现有客户端和已有契约测试，更新导入；不得留下原客户端转发壳当最终实现。
- [ ] 跑全部 API 和领域协议测试、typecheck；Expected: PASS。提交 `refactor: separate API contracts from frontend views`。

## Task 3: 身份、产品首页、设置与额度页面

**Files:** src/pages/{LandingPage,IdentityPage,SettingsPage,WalletPage,ModelsPage}.tsx；src/domains/identity/、src/domains/wallet/；src/app/Application.tsx；main.tsx。

**Interfaces:**
- Consumes: Task 1 的导航/组件、Task 2 的 identity、wallet、credit、模型目录 API。
- Produces: 独立页面入口；身份和账号控制器统一提供真实 session/CSRF/权限；账号转换清除先前账号的查询和执行订阅。

- [ ] 在现有真实身份与支付契约测试基础上先添加入口测试：保留目标地址、登录失败显示错误、未登录不请求个人数据、非管理员不见后台、退出保留服务器数据。
- [ ] 跑相应测试观察失败，再接新页面与路由；注册按能力接口及挑战条件显示，不取消 Turnstile/激活要求。
- [ ] 钱包重做余额、账本、订单和收款显示外观；保留创建请求 ID、付款状态声明、订单过期和 display-window 释放逻辑。
- [ ] 首页和设置用新设计；不加载旧 3D 首页，不编造统计或实时价格。模型偏好和密钥存储规则维持。
- [ ] 跑身份/额度/模型测试与 typecheck；Expected: PASS。提交 `feat: rebuild account and billing interfaces`。

## Task 4: 书库、个人地图、学习地图与笔记

**Files:** src/pages/{LibraryPage,MapsPage}.tsx；src/domains/maps/；src/domains/notes/；src/ui/{MapCard,RecordList}.tsx。

**Interfaces:**
- Consumes: public catalog/detail、personal library/detail、进度/笔记/发布/导入恢复 API；原布局纯函数与 React Flow。
- Produces: 列表先行的目录，独立地图视图、节点说明与笔记；创建入口导航到助手，选中个人地图由 entry URL 表达。

- [ ] 写首屏数据/空状态及深链测试：没有选择地图时展示实际目录，而非空地图；API 失败展示重试，不能回退到假示例；entry 深链选择正确地图。
- [ ] 运行测试红，再实现目录查询、分页、筛选与卡片；真实图使用服务器快照，不读取硬编码 DEMO_TREES 代替生产记录。
- [ ] 改写地图和节点 UI，保留图布局/依赖/块视图/进度算法；新增展示保持手势和节点选择可达。
- [ ] 发布/恢复/导出/删除重命名与笔记入口全部迁移，版本和二次确认保持。
- [ ] 跑地图库、节点笔记、布局、导出恢复测试与 typecheck；Expected: PASS。提交 `feat: rebuild map library and learning maps`。

## Task 5: 三场景对话、执行状态与画布

**Files:** src/pages/{AssistantPage,LearningPage,TavernPage}.tsx；src/domains/conversations/{useConversationHistory,useConversationActions,useConversationExecution}.ts；src/ui/conversation/；迁移 agentConversationRun、conversationRuns、canvasPersistence 及已有测试。

**Interfaces:**
- Consumes: 会话 scene/area/graph/characters、Agent 运行对象、画布保存对象、模型选择和 Task 1 基础组件。
- Produces: 一个显示组件 `ConversationWorkspace`；场景参数明确传入，三个页面不继承酒馆页面；控制器不导入视图。

- [ ] 先写四项引导测试：点击填入输入而非立即执行；关闭配置保留草稿；真实历史为空时不编造开场回复；长地图标题独占宽度、按钮可达。
- [ ] 写历史/创建/删除 seam 测试：cleared 刷新为空；新建不用旧 action ID；活动执行或画布保存失败禁止删除。
- [ ] 测试跑红后逐项实现。迁移既有执行/事件/流式展示算法，保留 stop、retry、approval、settlement；不为 UI 重做重新发起已存在的执行。
- [ ] 把会话查询、创建/删除/角色动作、消息执行状态从 JSX 分开；配置与参数由新统一弹层承载，五页固定外框。
- [ ] 接实际 Excalidraw 与持久化，地图/画布手机互斥，切换后对话草稿仍在；开空画布不自动授权 AI 绘图。
- [ ] 完成角色库、创建编辑导入、世界书、原卡下载、历史与分支；模型/资金选择统一。
- [ ] 跑全部对话、Agent、角色、画布/删除集成测试和 typecheck；Expected: PASS。提交 `feat: rebuild conversations and learning workspace`。

## Task 6: 后台与全站辅助功能

**Files:** src/pages/admin/，src/domains/admin/；公告、反馈、MCP 接入说明、引导和主题 UI。

**Interfaces:**
- Consumes: 已有后台 API、身份权限、通用 RecordList 和表单/弹层。
- Produces: 十分区新后台；手机分区选择器及记录卡片，桌面表格；所有管理动作仍使用服务器权限、确认和版本。

- [ ] 在已有后台契约测试上写新入口可用性：普通账号不可进入；手机记录的管理按钮可见；分区切换和返回不误触写操作。
- [ ] 测试红后重做概览、用户、地图、邀请码、审计、请求观测、反馈、公告、模型、充值及各操作弹层。
- [ ] 重新组织公告、反馈、MCP 与帮助入口，使用同一套设计组件，保留全部现有服务器能力。
- [ ] 跑后台、公告/反馈、MCP 测试与 typecheck；Expected: PASS。提交 `feat: rebuild administration and support pages`。

## Task 7: 唯一新入口、旧前端移除及完整验收

**Files:** App.tsx、main.tsx、index.css、所有已替换旧视图；docs/research/2026-10-14-full-frontend-acceptance.md；浏览器验收脚本。

**Interfaces:**
- Consumes: Task 1–6 所有新页面和领域。
- Produces: 只加载新产品入口的可构建前端；基线能力覆盖表、测试和真实候选浏览器截图。

- [ ] 更新根入口行为测试，覆盖回退/前进、登录来源与完整路由；确认实际控制器行为，不只断言 class 或文字变化。
- [ ] 移除已替换的旧外壳、Portal、巨型 App 页面、旧 UI 客户端和死代码；共用非 UI 算法属于新领域模块，不误删 BYOK 目录等服务器接口。
- [ ] 完整 `npm test -- --maxWorkers=4 --minWorkers=1`、`npm run typecheck`、`npm run build`、`git diff --check`；Expected: 全部通过，既有 skip 如实记录。
- [ ] 构建产物启动本机预览；按规范十种尺寸、长名称、侧栏宽度、地图/画布/配置/键盘测试。隔离真实 API 验收记录来源；不把设计稿或 mock 成功当真实联调通过。
- [ ] 按完整覆盖表测试所有页面，截图逐张看；不把模拟键盘或 viewport 当 Android 真机。可复现的真机风险未关闭时如实保留验收边界。
- [ ] 完成后按 executing-plans 要求进行一次独立全分支审核；重要发现 RED→GREEN 修复及完整测试。
- [ ] 提交候选版本和验收报告，供用户查看；生产部署另待授权。
