# Knowledge Chat Agent 前端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在个人技能树页面增加“只读知识 Agent”聊天入口和本地原型面板：桌面端把聊天放进右侧详情位，移动端切换为可返回的全屏聊天；公共树和未登录用户不显示/不能使用聊天。

**Architecture:** App 继续拥有当前树、个人库条目、选中节点和移动视图状态。个人树的 `NodeDetailPanel` 提供入口；打开后右侧区域切换为 `KnowledgeChatPanel`，中间画布通过现有 flex 重新分配宽度。聊天组件调用独立 client，维护本地非流式消息列表和 loading/error 状态；服务端返回的 sandbox 余额只作为原型状态展示，不接现有正式生成积分组件。

**Tech Stack:** React 18, TypeScript, TanStack Query existing state, Tailwind CSS, Vitest + Testing Library, existing identity/session context.

**Spec:** `D:/mapflow-server/.worktrees/knowledge-chat-agent/docs/specs/2026-08-22-knowledge-chat-agent-design.md`

## Global Constraints

- 只在 `codex/knowledge-chat-ui` worktree 修改；不部署、不修改主 worktree 中用户已有的未跟踪文档。
- 公共树 (`displayMode === 'showcase'`) 永远不显示聊天入口；聊天请求必须绑定当前个人 `libraryEntryId`。
- 没有登录 session 时，入口不发送请求；按现有 identity flow 打开登录对话框或显示登录提示。
- 不在前端拼接/重放历史；一次会话由当前 personal library entry 绑定，服务端/DSH 管理上下文。
- 本地原型显示每次成功回答扣 `0.2` sandbox credits；失败不显示成功扣费；不把 sandbox 状态写入现有正式 `CreditPill`。
- 兼容手机窄屏：聊天输入区不能被底部浏览器 UI/安全区遮挡，消息区必须可滚动，发送中不能重复提交。
- 所有新增业务逻辑先写测试并确认红，再实现；UI 样式调整可直接配合组件测试，但最终仍要跑完整套件和 typecheck/build。

---

## Task 1: 新增 chat API 类型、解析和客户端红测试

**Files:**

- Add `src/features/knowledge-chat/knowledgeChatClient.ts`
- Add `src/features/knowledge-chat/types.ts`
- Add `src/features/knowledge-chat/knowledgeChatClient.test.ts`

- [ ] 先写失败测试：成功响应解析 `answer`、usage、`charged_credits: 0.2`、sandbox remaining；请求携带 same-origin credentials、JSON body、CSRF header 和稳定 `client_turn_id`。
- [ ] 先写失败测试：reset 请求使用当前 personal library entry；HTTP 错误 envelope 转成包含 `status/code/message/traceId` 的 `KnowledgeChatApiError`；畸形成功响应被拒绝。
- [ ] 运行 `npm test -- --run src/features/knowledge-chat/knowledgeChatClient.test.ts` 确认红。
- [ ] 定义 `KnowledgeChatMessage`, `KnowledgeChatResponse`, `KnowledgeChatUsage`, `KnowledgeChatError` 等前端类型；credits 用 number 仅做展示，服务端整数 sandbox units 同时保留，避免 UI 把正式余额误当测试余额。
- [ ] 实现 `sendKnowledgeChatMessage(libraryEntryId, message, clientTurnId, csrfToken)` 和 `resetKnowledgeChat(libraryEntryId, csrfToken)`；复用 tree library 的错误 envelope 约定但使用独立 error class，消息长度在发送前和服务端双重限制。
- [ ] 完成解析边界后跑该测试，再跑 `npm run typecheck`。

## Task 2: NodeDetailPanel 增加个人树聊天入口

**Files:**

- Modify `src/features/skill-tree/NodeDetailPanel.tsx`
- Add or modify `src/features/skill-tree/NodeDetailPanel.test.tsx`

- [ ] 先添加失败组件测试：personal mode 有 `与这棵树聊天` 按钮并调用 `onOpenChat`；showcase mode 没有该按钮；没有选中节点时不渲染可误触发的聊天入口。
- [ ] 运行 `npm test -- --run src/features/skill-tree/NodeDetailPanel.test.tsx` 确认红。
- [ ] 增加可选 `onOpenChat` 和 pending/availability 文案 props；入口放在节点标题操作区/详情顶部，保持现有完成状态按钮行为不变。
- [ ] 确保聊天按钮只由 App 在个人树、已登录并有 library entry 时传入；组件本身不发请求。
- [ ] 跑组件测试和 typecheck。

## Task 3: 实现 KnowledgeChatPanel 的状态、消息气泡和错误/积分反馈

**Files:**

- Add `src/features/knowledge-chat/KnowledgeChatPanel.tsx`
- Add `src/features/knowledge-chat/KnowledgeChatPanel.test.tsx`

- [ ] 先写失败测试：输入消息后显示用户气泡、发送中禁用按钮、收到回答后显示 assistant 气泡和 `本次测试消耗 0.2`，余额更新为服务端值。
- [ ] 先写失败测试：空白消息不发送；客户端错误显示中文 message；关闭回调保留当前 node；reset 按钮清空本地气泡并调用 API。
- [ ] 先写失败测试：长文本被限制/提示；小屏布局含可滚动消息区、底部输入区和返回按钮语义。
- [ ] 运行该组件测试确认红。
- [ ] 实现纯本地消息 state（role/content/id），用 `useRef` 将消息区滚动到底部；发送调用 Task 1 client，生成 `crypto.randomUUID` 不可用时使用稳定时间/随机回退，避免同一 turn 重复扣费。
- [ ] 面板头部显示当前树标题/个人库条目标识的短文案，不显示内部 account id、system prompt 或工具参数；工具搜索细节只在 assistant 最终回答中体现。
- [ ] 处理关闭、reset、loading、error、sandbox remaining；失败不追加成功回答和扣费提示。
- [ ] 使用 Tailwind 实现 desktop right-panel/full-height 和 mobile safe-area padding；所有按钮有可访问 label。
- [ ] 跑组件测试、typecheck。

## Task 4: 将面板接入 App 的桌面三栏和移动全屏流

**Files:**

- Modify `src/App.tsx`
- Modify `src/App.test.tsx` only for behavior assertions/mocks required by the new client
- Modify `src/features/skill-tree/NodeDetailPanel.tsx` only if integration prop shape needs a small adjustment

- [ ] 先写/更新 App 失败测试：公共树不出现聊天按钮；个人树登录后打开聊天把 `mobileView` 切到 chat；关闭后回到 detail 且选中节点仍在；未登录点击个人入口进入登录流程，不发送 chat 请求。
- [ ] 运行相关 App tests 确认红。
- [ ] 将 `mobileView` 扩展为 `'list' | 'graph' | 'detail' | 'chat'`，新增 `chatOpen` 或等价状态，并在账号/树切换时关闭当前 chat、清理本地会话 UI，防止跨账号/跨树串上下文。
- [ ] 在 personal tree 的 NodeDetailPanel 传入 `onOpenChat`；public tree 不传入。
- [ ] 桌面端在现有右侧 `mobile-detail` slot 根据 chat 状态渲染 `KnowledgeChatPanel`，关闭后恢复 NodeDetailPanel；保留 canvas、进度栏和节点选择状态。
- [ ] 移动端 header 的返回逻辑支持 chat -> detail/graph；聊天打开时隐藏列表和画布，面板占满主区域；底部 safe-area 不被 ProgressOverview/浏览器手势区覆盖。
- [ ] 当 selected personal tree 尚未加载、session 退出或 API 返回 not-owned 时，显示稳定提示，不渲染可用的聊天输入框。
- [ ] 跑 App tests、全量 `npm test`、`npm run typecheck`。

## Task 5: 前端本地验收和构建审查

**Files:**

- Inspect changed files only

- [ ] 全量运行 `npm test`，确保原有 158+ 测试和新增 chat tests 全部通过。
- [ ] 运行 `npm run typecheck` 和 `npm run build`；记录 Vite 既有大 chunk warning，不把 warning 伪报成失败。
- [ ] `git diff --check`、`git diff --stat`，确认没有改动 `HANDOVER.md` 或主 worktree 用户文档。
- [ ] 本地联调服务端 chat endpoint：登录账号打开个人树、连续发送两轮、刷新/关闭再打开、reset、切换另一棵个人树；确认上下文隔离、0.2 sandbox 扣费和失败不扣费。
- [ ] 用窄屏浏览器检查聊天消息滚动、输入框可见、返回树画布；桌面检查画布缩到左侧且右侧聊天面板出现。
- [ ] 用中文提交前端变更；等待用户确认后才考虑合并主分支和部署。
