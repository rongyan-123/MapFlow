# 酒馆 MVP 实施与验收记录

依据：`docs/specs/2026-09-20-tavern-rolecard-mvp-design.md`。用户已授权连续完成实现，词表可选。

工作区：`C:/Users/Administrator/.codex/worktrees/tavern-20260922/frontend` 与同级 `server`，分支均为 `codex/tavern-mvp-20260922`。
前端基线 `95362e1`，后端基线 `6034656`：包含从原工作区复制的现有未提交修复；原工作区保持原状。最终交付区分这些基线与本次实现。

## 实施顺序和验证

- [x] 1. 核对当前基线；前端/worker 测试、Rust 单测与 PostgreSQL 测试环境。
- [x] 2. 统一用量账本：迁移回填、全部余额读取切换、知识聊天事务写入；真实 PostgreSQL 测试验证余额一致、幂等和无重复扣费。
- [x] 3. 卡片兼容与页面：JSON/PNG V1/V2/V3 解析、预览警告、主题/导航、可选词表、开场白和流式聊天；先红后绿的解析/组件/客户端测试。
- [x] 4. 独立 DSH Runtime：新协议、零工具、单步、动态上下文、TTL/LRU 与恢复；worker 测试与 Rust 假 worker 契约测试。
- [x] 5. 酒馆业务与 HTTP：规范化卡片校验、快照、世界书选择、数据库事务、账号隔离、幂等并发、SSE；领域/数据库/路由测试。
- [x] 6. 集成观测与全量回归：前端 build/typecheck/test，worker build/typecheck/test，Rust fmt/check/clippy/test，独立代码审查。
- [x] 7. 真实浏览器验收：普通/学习会话、五轮对话、刷新、300 秒回收后续聊、用量和请求观测交叉核验。详见 `2026-09-22-tavern-live-ui-acceptance.md`。

## 跨模块实现契约

JSON 使用 camelCase。规范化卡片 v1：

```ts
type NormalizedCharacterCard = {
  schemaVersion: 1; sourceFormat: 'json' | 'png'; name: string;
  description: string; personality: string; scenario: string; firstMessage: string;
  exampleDialogue: string; systemPrompt: string; postHistoryInstructions: string;
  creatorNotes: string; alternateGreetings: string[];
  lorebook: { id: string; keys: string[]; secondaryKeys: string[]; constant: boolean;
    enabled: boolean; selective: boolean; content: string; priority: number; order: number }[];
  warnings: { code: string; field: string; message: string }[];
};
type VocabularyEntry = { term: string; meaning?: string };
```

导入 multipart 字段仍为 `normalized_card`、可选 `source_file`；服务端权威输入为规范化 JSON。

- Character 响应：`{characterId, card, normalizedHash, sourceHash, avatarUrl, createdAt}`；列表 `{characters: Character[]}`；头像 GET `/api/me/tavern/characters/{id}/avatar`。
- 创建会话：`{characterId, userName, persona?, vocabulary?, greetingIndex?}`；`greetingIndex=0` 表示 firstMessage，后续索引表示 alternateGreetings。空词表归一为缺省。
- Conversation：`{conversationId, characterId, title, userName, persona, vocabulary, openingMessage, createdAt}`；列表 `{conversations: Conversation[]}`。
- 读取会话：`{conversation: Conversation, character: Character, turns: Turn[]}`；独立 turns GET `{turns: Turn[]}`。
- Turn：`{turnId, clientTurnId, userMessage, assistantMessage, usage, chargedCreditUnits, createdAt}`；usage 复用 inputTokens/outputTokens/cacheHitInputTokens/cacheMissInputTokens。
- POST turns：`{clientTurnId,message}`；SSE 事件 `started`、`delta {delta}`、`completed {turn,creditBalance,chargedCredits,idempotencyHit}`、`error {code,message,traceId,httpStatus}`。只有持久化成功才发 completed。
- 错误族沿设计文档；HTTP 使用现有 ErrorEnvelope 和身份/CSRF 边界。客户端重试保留 clientTurnId。

Rust 对外 `pub mod tavern` 包含领域模型与 `TavernRuntime` trait。Runtime 请求为 `TavernChatRequest { session_key, config_fingerprint, system_prompt, user_prompt, context, history }`；context 为 `TavernTurnContext { version: u8, lore: Vec<TavernLoreContext { id, content }>, vocabulary: Option<Vec<VocabularyEntry>> }`。Node 唯一渲染动态 context，Rust 负责世界书选择与静态文本预算。trait 方法 `model_id() -> &str`、`chat_stream(request, on_text_delta) -> Result<AgentChatResult, AgentRuntimeError>`、`reset_session(&str) -> Result<(), AgentRuntimeError>`。

账本 SQL：`credit_usage_ledger(account_id, source_kind, source_id, charged_credit_units, created_at)`，来源种类 `knowledge_chat`、`tavern`，UUID source_id，唯一 `(source_kind, source_id)`。树生成已有扣费方式保留，余额只将原 knowledge_chat 扣减替换成通用账本，避免额外改造树生成结算语义。

## 进度

- 已创建长期目标与隔离工作区，保留最近代码及未提交恢复修复。
- worker 基线 41 测试、前端基线 330 测试通过。Rust 初始 66/67 通过，剩余失败为测试镜像缺 Node；补入 Node24 后已通过 67/67。
- 后端独立领域/持久化/事务已提交 `e9e194d`：6 个领域、2 个存储、1 个 schema、5 个回合事务测试通过，包含并发、幂等和故障回滚。
- 用量账本已提交 `c5964b1`：47 个针对性 PostgreSQL 回归通过；该实现时的全量快照 511 测试通过。最终集成后需重新全量验证。
- 源码审查正在进行；前端、Runtime、HTTP 为分离文件范围的实现任务。
- 验收下载普通第三方卡：SillyTavern 官方固定提交 `06bde939fb1e9c4c8d8641d810f0a916b5bce127` 的 `default/content/default_Seraphina.png`，SHA-256 `8a71e8270f54fafbccf905b1bdf053a6a55f57bea89c01fcd8c0e87ee76a2d52`。仅存于工作区外侧 acceptance 目录，未打包进产品。

## 集成后验证（2026-09-22）

- 前端：`d3803d6` 功能，`59d7c9d` 管理观测酒馆筛选；最终 389 测试通过，typecheck/build 通过。构建仍有现有大 chunk 提醒，无构建错误。
- Worker：`d1e8be9`；78 测试、typecheck/build，通过。另用真实计时 361.5 秒验证 idle TTL / LRU / 非空历史恢复，采用本地模型桩，不冒充付费模型测试。
- HTTP / bootstrap / 观测：`3948d6f`、`5f7d923`。流式成功仅在事务提交之后记录；数字型 worker 累计快照与用量均可从现有管理观测读取。
- 领域收尾：`332550c`。审查 R1–R7 均先复现后修复并独立复审：取消、清理时序、幂等容量、历史分页、字符限额、失锁后的结算、延迟 token 发布。最终使用独立 advisory guard、持久化代际 token、CAS 发布和事务内 token 校验；reset 同样持有代际校验后的行锁。
- 完整后端：`cargo test --locked --all-targets --quiet`，544 测试/83 targets 全部通过；`cargo clippy --locked --all-targets --all-features -- -D warnings` 和 `cargo fmt --all -- --check` 均通过。最后新增的 service 回归为 13 项。
- 空 secondaryKeys 忽略 selective 过滤；use_regex=true 不意味着普通关键词必须被当成正则。官方来源：https://docs.sillytavern.app/usage/core-concepts/worldinfo/ 。实际 PNG 的 4 条普通关键词世界书被保留，34 条兼容提示。

## 真实模型验收（独立环境，不是正式部署）

入口 `https://localhost:18444/tavern`，通过本机 Caddy 和 SSH 隧道连接专用容器；专用数据库与正式数据库隔离，模型密钥仅在服务器以只读文件挂载，没有打印或复制密钥。

已完成真实 Qwen3-8B：普通会话 1 轮、可选 24 词学习会话 5 轮、最后一轮同 clientTurnId 重试。

- 实际卡片源哈希与上述固定样本一致；创建角色/会话/开场白未扣费。
- 6 个生成回合各有一条持久化 turn 与一条用量流水；总计 5,190 micro-credit，即 0.005190 积分，余额 2 → 1.994810。重复请求只返回已存结果，不增加回合和用量，不调用模型。
- 7 个 HTTP 请求观测全部 succeeded；Worker 采样显示最多 2 个 session、pending=0、0 失败/恢复失败，RSS 约 91–98 MB。日志不含原始对话内容。
- 5 个学习回答中，按单词边界和简单复数形式计数覆盖 18/24 个目标词；这是接入证据，不是记忆或学习成效证据。
- 首 delta 0.537–3.55 秒；总完成时间 7.476–143.478 秒。个别流式回合很慢，回答也未严格遵守 Persona 的约 90 词要求，并模仿了卡片中的转义引号。不能宣称叙事质量已达成最终效果。
- 本机证据在同级 `acceptance/api-live-evidence.json`、`api-observation-evidence.json`，包含测试对话，不纳入产品或日志。前端独立浏览器脚本另已验证 4 主题、桌面/320/390px，使用模拟 HTTP；与真实后端 UI 验收严格区分。
- 真实模型 TTL 已验证：上一轮结束 `07:42:50 UTC`，空闲超过 6 分钟后追问第一轮包裹名称，回答准确保留 **BLUE LANTERN / 没有打开**。观测为 `ttlEvictions=2`、`historyRestores=1`、`historyRestoreFailures=0`、`sessions=1`、`pending=0`。Rust 同时回收自己的复用提示，直接冷恢复，因此 `sessionMissing=0` 正常，并不表示没有回收。新增 0.001157 积分，总计 7 次生成花费 0.006347，余额 1.993653。
- 真实 TTL 证据为 `acceptance/api-ttl-evidence.json`；最终观测脚本验证了全部 8 个请求（7 次生成＋1 次重放），并核对回收计数、恢复计数和正文脱敏。
- 浏览器授权曾阻塞验收，现已解除：用户开启 Chrome 远程调试并授权连接后，Browser Harness 新建测试页，完成真实导入、普通会话 1 轮、学习会话 5 轮及空闲后续聊 1 轮。WMI 临时 wrapper 仅跳过已知 Windows OS 名称查询，没有关闭用户 Chrome 或绕过调试授权。
- UI 路径额外验证生成中刷新与重试：中断尝试未落库/未扣费，重试成功后仅一条 turn 和一条用量；完成后再次刷新，逐字核对持久化历史一致。
- UI 学习会话在 `08:13:46` 至 `08:21:34 UTC` 之间空闲约 7 分 48 秒后，准确回答 **SILVER ACORN / remains sealed**。Worker 累计快照 `ttlEvictions: 4 → 5`、`historyRestores: 2 → 3`、`historyRestoreFailures=0`、`pending=0`；不是把刷新当成 TTL 证明。
- 最终数据库共 14 个完成回合、14 条用量，10,169 micro-credit，余额 `1.989831`；本次 UI 7 个完成回合占 3,822 micro-credit。所有账号/数据库均为独立测试环境。
- 最后重新验证：前端默认套件 388 passed / 1 opt-in skipped，再启用真实 PNG fixture 单独验证 1 passed；worker 78 passed / 1 opt-in real-clock skipped（此前独立 361.5 秒已通过）；两端 build/typecheck 通过；Rust 全量 544 测试、严格 clippy、fmt 全通过。两个功能工作区及原始工作区状态已核对，保留原有修改。
- 测试入口仍为 `https://localhost:18444/tavern`，依赖本机代理和 SSH 隧道。正式站点、原始工作区和模型密钥未改动；没有合并或推送功能分支，也没有执行正式数据库迁移。
