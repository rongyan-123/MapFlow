# 生成、积分与个人树 Agent 修改实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在本地完成可验证的生成付费选择、精确积分计费、DSH 审批闭环和当前个人树受限修改。

**Architecture:** Rust 服务端拥有 catalog、账务、账号/树/revision 授权和事务；Node worker 只拥有 DSH 原生会话与 approval answerer，通过 JSONL 传递审批；React 只展示服务端选项、提案差异和安全摘要。BYOK、免费 entitlement、只读 web_search 与现有生成流程保持兼容。

**Tech Stack:** React/Vite/TypeScript/Vitest；Axum/SQLx/PostgreSQL/Rust；Node 24、DSH Agent/Session/Tools/User Approval、JSONL。

**Spec:** `docs/specs/2026-08-28-generation-credit-chat-mutation.md`

## Global Constraints

- 直接在两个仓库 `main` 本地工作；禁止 push、CI、部署和生产数据。
- 每个业务切片先写测试并看红，再写最小实现、看绿，最后重构。
- 免费 `platform` 固定参数和免费次数不变；积分 `credits` 的价格只由 Rust catalog 计算；BYOK 不扣平台积分。
- 写工具只操作当前账号当前 library entry 对应的个人 AI 树；审批或授权不明确时 fail closed。

---

### Task 1: 生成 catalog 与 credits funding contract

**Files:**
- Modify: `D:\mapflow-server\src\tree_generation.rs`, `src\platform_generation.rs`, `src\platform_model_access.rs`
- Modify: `D:\mapflow-server\src\application\tree_generation_service.rs`, `src\adapters\postgres\tree_generation_store.rs`, `src\http\tree_generation.rs`
- Create: `D:\mapflow-server\migrations\0011_generation_credit_catalog.sql`
- Test: `D:\mapflow-server\tests\tree_generation_catalog_contract.rs`
- Modify: `D:\MapFlow-publish\src\features\tree-generation\types.ts`, `treeGenerationClient.ts`, `TreeGenerationDialog.tsx`, `GenerationFundingSelector.tsx`

**Interfaces:**
- Rust `GenerationFundingMode::Credits`, `PlatformGenerationSelection`, `GenerationPricingCatalog::quote`, `GET /api/me/tree-generation-options`。
- Credits create/revise/confirm 请求只提交 selection；金额由服务端计算并落账。

- [ ] 写 Rust catalog、selection 验证和 `credits` session 的失败测试。
- [ ] 运行 `cargo test --test tree_generation_catalog_contract --locked`，确认因缺少 credits/API 而失败。
- [ ] 添加 catalog、schema 迁移、服务端价格/实际 usage 结算与免费 platform 分支。
- [ ] 添加前端类型解析、options 查询和 credits 选择控件，保持 BYOK 请求不变。
- [ ] 运行 Rust focused tests 与前端 tree-generation tests、typecheck。

### Task 2: 修正签到与知识聊天 billing

**Files:**
- Modify: `D:\mapflow-server\src\credit.rs`, `src\adapters\postgres\credit_store.rs`, `src\application\knowledge_chat_billing.rs`
- Test: `D:\mapflow-server\tests\credit_contract.rs`, `tests/knowledge_chat_billing_contract.rs`
- Modify: `D:\MapFlow-publish\src\features\credit\creditClient.ts`, `src/features/knowledge-chat/knowledgeChatPanel.tsx`

- [ ] 先增加“签到 1 或 2”“聊天按实际 usage 无最低扣费和独立模型系数”的失败测试并运行红测试。
- [ ] 最小修改签到随机范围与聊天 catalog 默认系数，保持整数微积分和缓存命中逻辑。
- [ ] 前端展示服务端实际 awarded 与 charge/balance。
- [ ] 运行 focused Rust/TS tests。

### Task 3: DSH native approval 与 wire protocol

**Files:**
- Modify: `D:\mapflow-server\harness-worker\package.json`, `src/harness.ts`, `src/protocol.ts`, `src/security.ts`
- Modify: `D:\mapflow-server\src\adapters\agent_runtime\protocol.rs`, `deepseek_harness.rs`, `src/application/knowledge_chat.rs`
- Test: `D:\mapflow-server\harness-worker\tests\approval.spec.ts`, `tests/protocol.spec.ts`, `D:\mapflow-server\tests\harness_approval_contract.rs`

- [ ] 先写同一 DSH session 的 approval 请求、缺 answerer fail-closed、wire round-trip 失败测试并看红。
- [ ] 加载 `@deepseek-ai/dsh-user-approval`，在 agent scope 用 `ctx.approval.request`；实现 approval_request/result JSONL 与挂起 request broker。
- [ ] 只读 web_search 继续走 DSH native runtime；未知写工具和非法 approval outcome 一律拒绝。
- [ ] 运行 worker test/typecheck/build 与 Rust harness tests。

### Task 4: Personal tree mutation proposal/transaction

**Files:**
- Create: `D:\mapflow-server\src\application\personal_tree_mutation.rs`
- Modify: `src\application\knowledge_chat.rs`, `src\adapters\postgres\tree_library_store.rs`, `src\http\knowledge_chat.rs`, `src\app.rs`, `src\error.rs`
- Create: `D:\mapflow-server\migrations\0012_personal_tree_mutation.sql`
- Test: `D:\mapflow-server\tests\personal_tree_mutation_contract.rs`, `tests\knowledge_chat_http.rs`

- [ ] 先写提案只读、跨账号拒绝、revision 冲突、删除/清空需独立确认和幂等事务的失败测试。
- [ ] 添加严格命令 schema、差异摘要、proposal store/broker 和事务 SQL；只允许 private/ai_generated/ready 当前树。
- [ ] 将 mutation tool 作为唯一写入口，审批 allowed-once 后执行，其他结果 fail closed。
- [ ] 运行 DB contract tests（本地 PostgreSQL）与全量 Rust tests。

### Task 5: React approval/proposal UX

**Files:**
- Modify: `D:\MapFlow-publish\src\features\knowledge-chat\types.ts`, `knowledgeChatClient.ts`, `KnowledgeChatPanel.tsx`, `src\App.tsx`
- Test: `D:\MapFlow-publish\src\features\knowledge-chat\knowledgeChatClient.test.ts`, `KnowledgeChatPanel.test.tsx`, `src\App.test.tsx`

- [ ] 先写 DOM 测试：proposal 仅显示自然语言差异、确认/拒绝按钮、缺 approval 不执行、完成后刷新树和积分，并运行红。
- [ ] 消费 approval_required SSE 和 CSRF 审批 endpoint；确认/拒绝只发送 proposal id/idempotency key，不发送原始树 JSON。
- [ ] 刷新当前 personal tree/revision，保持选中节点；普通回答继续隐藏内部字段。
- [ ] 运行前端全量测试、typecheck、build。

### Task 6: Integrated local verification

**Files:**
- Modify only if verification exposes a required defect; otherwise no source changes.
- Create ignored local harness script only under an existing temp/ignored path if needed.

- [ ] 启动本地 PostgreSQL，应用新 migration，使用测试账号和 deterministic/真实本地 worker 跑 API 链路。
- [ ] 运行前端 `npx vitest run`、`npm run typecheck`、`npm run build`。
- [ ] 运行 harness `npm test`、`npm run typecheck`、`npm run build`。
- [ ] 运行 Rust `cargo fmt --check`、`cargo check --all-targets --locked`、`cargo clippy --all-targets --all-features --locked -- -D warnings`、`cargo test --all-targets --all-features --locked`。
- [ ] 用 Browser Harness 验收真实 DOM：credits 生成设置、聊天提案确认/拒绝、revision 刷新和最终回答不泄露原始整树 JSON。
