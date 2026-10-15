# 全局助手引导与知识库实施计划

> For agentic workers: use the approved spec, TDD, isolated worktrees, scoped independent implementation and fresh review. The user approved implementation on 2026-10-15; do not add another approval gate for these tasks.

**Goal:** 将全局助手落实为平台统一客服与规划助手，保留模型配置，提供单会话、回访三卡和管理员发布知识库。

**Architecture:** 前端独立全局页面，复用模型与 Agent 执行客户端；服务端唯一绑定、有界时间线和增量事件；不可裁剪平台策略；PostgreSQL 保存知识文章、不可变版本与带代次的发布任务，独立 ONNX 文本向量推理。

**Tech Stack:** React 18、TypeScript、Vitest；Rust/Axum/SQLx/PostgreSQL；DSH worker/Node/Vitest；CPU ONNX Runtime。

**Spec:** `docs/specs/2026-10-15-global-assistant-guidance-design.md`，用户已同意 v2。

## Global Constraints

- 前端工作区 `C:/Users/Administrator/.codex/worktrees/b869/MapFlow-publish`，后端 `D:/mapflow-server-chat-ui-20261013`，均为 `codex/global-assistant-guidance-20261015`。
- FE BASE `edd5f0457a3f1e9bea89372f9b49aa487e775473`；BE BASE `a1a579be354a82a955f92090d597aedfa641f7b5`。
- 固定入口 main、生产数据、所有 Codex 会话与既有路径保持原位。禁止 CaseRAG。
- 新业务行为先写测试并观察 RED，再实现 GREEN。纯 CSS/文档不补无意义测试。
- 保留现金、积分、BYOK 及计费；不新增工具次数/Agent 步数上限，不以超时结清未决费用。
- 首页 40 条，历史每页最多 100 条；change 每页最多 100 条。页数不限制总历史。
- 代理只写分配文件，不执行 git add/commit、迁移生产或删除目录；由主代理审阅、暂存精确文件并提交。
- 所有 API 仅返回安全错误、账号自有内容；模型凭证不写日志、数据库、浏览器持久化或报告。

## Review Focus

1. 旧标签页在绑定迁移间隙发新请求：只能登记为迁移前接受或拒绝，不能产生第二条新会话执行。
2. system 内容超过 128 字符且模型窗口小：实际请求仍含完整平台策略，不能以引用代替。
3. 一万条消息后完成和恢复：不能隐式 fetch 全图或所有历史执行。
4. 未知外部结果、停止与迟到回复：不能重发、覆盖新消息或丢费用审计。
5. 旧发布任务晚完成或索引中下架：条件切换失效，重启和重试也不能重新上架。

## Shared Interface

前后端专用契约如下；实现阶段若需要修订，先由主代理同步到两个实现者，不能各自猜字段。

```ts
type GlobalSendAvailability = { conversation: boolean; cash: boolean };
interface GlobalSnapshot {
  conversationId: string; bindingVersion: number; graphRevision: number;
  headMessageId: string | null;
  messages: GraphMessage[]; completions: AgentCompletion[];
  olderCursor: string | null; syncCursor: string;
  generationSettings: GenerationSettings; generationSettingsVersion: number;
  activeExecution: AgentStatus | null; blockingExecutions: AgentStatus[];
  sendAvailability: GlobalSendAvailability;
}
interface GlobalMessagePage {
  conversationId: string; bindingVersion: number;
  messages: GraphMessage[]; completions: AgentCompletion[]; olderCursor: string | null;
}
type GlobalChange =
  | {sequence: number; type: 'message'; message: GraphMessage}
  | {sequence: number; type: 'completion'; result: AgentCompletion}
  | {sequence: number; type: 'settlement'; executionId: string; settlement: AgentSettlement; usage: AgentUsage | null};
interface GlobalChangePage {
  conversationId: string; bindingVersion: number; graphRevision: number; headMessageId: string | null;
  changes: GlobalChange[]; nextCursor: string; hasMore: boolean;
  activeExecution: AgentStatus | null; blockingExecutions: AgentStatus[];
  sendAvailability: GlobalSendAvailability;
}
```

`GraphMessage`、`AgentCompletion`、`AgentStatus`、`GenerationSettings` 为现有 camelCase 契约。blockers 返回当前会话最早阻塞请求和账号最早现金阻塞请求，去重后最多两条，处理后刷新再显示下一项。`cash` 表示现金额外队列是否开放；是否可发送取 conversation 且现金场景还取 cash，再执行原模型/余额检查。

`POST /api/me/global-assistant/open`（CSRF）、`GET /api/me/global-assistant/messages?before=...&limit=40`、`GET /api/me/global-assistant/changes?after=...&limit=100`。发送仍用现有 Agent 接受接口，客户端操作 ID、执行模型快照与结算不变。

### Task 1: 全局绑定、有界服务端链路及状态处理

**Files:** BE `src/tavern/global_assistant*.rs`、`src/http/global_assistant.rs`、`src/tavern.rs`、`src/http.rs`/实际 router 注册、`src/agent_execution/{service,store,prompt,finalization,settlement_recovery}.rs`、相关全局场景配置写入边界；新 migration `0056_global_assistant.sql`；`tests/global_assistant_*.rs`。

**Interfaces:** 产生 Shared Interface JSON；全局平台策略独立编译。Task 2 不改上述 Rust 文件，Task 3 仅消费契约。

- [ ] RED：新增实际 PostgreSQL 集成测试，覆盖 `open_is_singleton_across_clients`、`old_conversation_cannot_accept_new_execution`、`binding_migration_serializes_with_accept`、`accepted_operation_replay_survives_binding_change`、`global_history_and_changes_are_bounded`、`global_profile_and_canvas_writes_are_denied`；运行并保存失败证据。
- [ ] GREEN：在共同接受事务校验绑定，旧生成新请求终止拒绝；旧 ID 的状态/事件/原操作恢复兼容。实现唯一绑定和数据库分页索引，不通过完整 ConversationDetail 投影新 API。
- [ ] RED/GREEN：一万条消息分别走打开、发送、冻结上下文、完成提交、changes 与恢复；检查每条 SQL/返回范围。完成与变更序号原子持久化，不能仅 JS slice。
- [ ] RED/GREEN：覆盖 `successful_pending_settlement_allows_next_send`、`unknown_call_requires_reconcile_or_stop`、`confirmed_stop_releases_global_send`、`late_completion_cannot_replace_next_turn`、`late_receipt_remains_auditable`。保留现有停止和费用规则，未决账务继续显示管理员关注。
- [ ] 验证：`cargo test --test global_assistant_*` 对实际生成的测试文件逐一运行；相关 Agent/management/deletion 测试；`cargo fmt --check`。完整套件由主代理在整合后运行。
- [ ] 提交前写报告至本计划 workspace 的 `task-1-report.md`，列 RED/GREEN、命令、日志、字段和未完成问题。

### Task 2: 模型上下文中的平台策略保护

**Files:** BE `harness-worker/src/model-context.ts`、`model-access.ts`、`agent-execution*.ts`/实际 Agent host 组装、`protocol.ts`；对应 `harness-worker/tests`。需要 Rust 协议变更时只提出精确接口，由主代理与 Task 1 协调，不自行改其文件。

**Interfaces:** 可直接采用安全的更强不变量：实际 system 全文不可裁剪；归档对象为 messages 中的历史、参考和工具输出。若引入可归档 system 资料字段，必须是可信宿主字段，禁止用文本标记解析。旧执行的冻结 system 整体保留。

- [ ] RED：在现有 `prepareModelContext` 测试中把关键策略放到 128 字符之后，触发压缩后断言 `expect(projected.system).toBe(original.system)`；覆盖小窗口、长历史、工具调用完整性和逐轮实际请求。
- [ ] GREEN：去掉不可裁剪 system 的截短，保留数据归档和原文分页。估算字节不当作真实 tokens，不能新增任意执行次数上限。
- [ ] RED/GREEN：实际 model-access 请求捕获验证工具往返与恢复后的策略；配置不兼容使用明确错误，不自动换模型、不重发不确定调用。
- [ ] 验证：worker 全测试、typecheck、build；报告 RED/GREEN 和协议影响。

### Task 3: 独立全局页面、三卡和模型设置

**Files:** FE `src/pages/AssistantPage.tsx`、新 `src/features/global-assistant/*`、`src/api/globalAssistantClient.ts`、必要的共享 Agent run 终态处理及精确错误码映射、该页面专属 CSS；不改学习和酒馆的产品行为。

**Interfaces:** 消费 Shared Interface；复用 `AgentModelContext`、`ModelSettings`、`agentExecutionClient`，不消费通用全量 SceneWorkspace/ConversationDetail。知识库来源扩展在 Task 5 接入。

- [ ] RED：旧界面下断言无会话历史/新建/角色/画布入口且有「模型设置」；三卡有历史仍展示、点击不发送、原草稿保留、发送后收起、重入轮换；先运行观察失败。
- [ ] GREEN：独立页控制器和消息/输入区；40 条打开、历史游标、changes 同步、SSE 原执行恢复。模型设置保留原资金通路、BYOK 和已有参数；错误和未决执行提供原请求核对、补 Key 和停止操作。
- [ ] RED/GREEN：停止经服务器确认后清除生成阻塞、保留未发草稿；旧流和费用不得覆盖新执行；不得 fetchConversation 或轮询全详情。
- [ ] 样式：三条纵向问题属于消息区；手机键盘聚焦时收起，单行头部，无重复安全区空白。维持导航抽屉。
- [ ] 验证：Vitest 全套、typecheck、build；逐项 UI 交互和截图由主代理整合后执行。

### Task 4: 管理员知识库、发布代次和检索

**Files:** BE 新 `src/assistant_knowledge*.rs`、`src/http/assistant_knowledge.rs`、migrations `0057_assistant_knowledge.sql`、`src/tavern/product_help.rs` 与全局工具分发；新独立 `knowledge-worker/`（模型资产不进 Git）；对应 Rust/Python 测试。

**Interfaces:** 普通用户只读已发布资料；管理员 CRUD/发布/下架/回滚。对全局现有 `search_product_help` 接工具，返回文章/章节/版本/片段/sourceId；补分页原文读取。Task 5 使用实现的 DTO 和实际路由。

- [ ] RED/GREEN：实际 DB 管理权限、CSRF、草稿不可检索、不可变修订和版本冲突；发布任务绑定 `publicationGeneration` 与内容/索引配置摘要，条件更新可见指针。
- [ ] RED/GREEN：使用 barrier 的旧任务晚完成、索引中下架、回滚、重复提交、旧失败回写及缓存晚写测试；成功状态与可见切换同事务。
- [ ] 推理：独立 CPU ONNX Runtime + tokenizer；资产从 `D:/A1-SmartMaintenance/backend/models/BAAI/bge-small-zh-v1.5` 核对复用，512 维、CLS pooling、归一化、查询指令，固定模型/依赖和校验摘要，不调用 A1 API 或其 dotenv。
- [ ] 检索：按标题/段落分段，实际 token 计数，全文原文持久化；中文分词关键词加 pgvector 精确语义召回、排名融合，故障只降级真实关键词，不伪造向量。
- [ ] 验证：40 个有来源问句和 10 个无答案/越界问题；Recall@5 至少 90%，对比浮点/量化质量，测 CPU 延迟和内存。无作者原稿则如实标未收录，不代写观点。

### Task 5: 管理后台与端到端验收

**Files:** FE `src/pages/admin/*`/实际管理路由、新知识库客户端、全局来源展示；`docs/research/2026-10-15-global-assistant-guidance-acceptance.md`。

- [ ] RED/GREEN：管理员创建、编辑、预览、发布、下架、回滚和冲突提示；普通用户不可进入，直调写接口拒绝。
- [ ] 点击验证管理员到助手真实检索带来源；无结果、离线、索引失败和发布竞争界面有明确状态。
- [ ] 320、360、390、430、768、1024、1440px 逐张截图并查看，包含回访、长名称、输入多行、键盘、安全区、SSE 中途返回和模型设置。
- [ ] 运行 FE 完整测试/typecheck/build、worker 完整测试/build、Rust 完整测试/fmt 与配置的 lint；记录已确认基线差异，不声称未通过项通过。
- [ ] 新鲜审阅全分支，修复重要问题并重跑相应验证；提交精确文件，交付截图和真实可操作预览。生产部署不混入本轮 UI 验收。

## Progress

执行记录位于本计划专属 `.superpowers/sdd/2026-10-15-global-assistant-guidance/progress.md`，验收证据保存在 `D:/tmp/mapflow-global-assistant-guidance-20261015/`。合并、部署与外部状态改变按用户授权和各自验收流程单独处理。
