# 2026-08-28 生成、积分与个人树 Agent 修改跨仓库规格

## 范围与边界

本地同时修改 `D:\MapFlow-publish` 与 `D:\mapflow-server` 的前端、Rust API、PostgreSQL schema 和 `harness-worker`。不 push、不运行 CI、不部署、不修改生产数据。BYOK 生成链路保持现有模型密钥生命周期和平台不扣积分语义。

## 生成付费方式

`fundingMode` 扩展为 `byok | platform | credits`：

- `platform` 是现有免费平台额度，仍由服务端固定模型、思考模式、思考强度和最多一次 AI 补充问题；前端不能覆盖固定参数。
- `credits` 是积分计费生成。创建请求只提交 `platformSelection`：`model`、`thinking`、`reasoningEffort`、`clarificationQuestionLimit`。`clarificationQuestionLimit` 只允许 1、2、3，服务端按每次模型返回 `needs_input` 的结果递增使用次数；`replan` 和 `adjust` 各自独立计数，不占用追问次数。
- `byok` 请求继续提交 `modelAccess`，不创建积分预扣或积分账务。

服务端暴露 `GET /api/me/tree-generation-options`，返回可用 paid catalog、模型能力、可选追问次数和服务端计算的展示价格。任何创建/修订/确认请求都不接受客户端价格或扣费金额；服务端重新从 catalog 校验并计算价格。

## Generation Catalog 与账务

服务端以可扩展 catalog 保存模型能力与价格系数，至少含 `deepseek-v4-flash`、`deepseek-v4-pro`。catalog 负责校验模型、thinking、reasoning effort、追问次数组合，并根据实际 planning/formal run Token 用量、缓存命中/未命中和模型独立系数计算整数微积分；无最低扣费。积分生成在首次创建时只预占，成功回答/生成后按实际账单结算，失败、取消、超时和未产生结果退款；幂等 key 重试不得重复扣费。

数据库新增生成 session 的 `clarification_question_limit` 与 `credit_price_units`，plan/run 记录实际选择和 usage；`funding_mode = credits` 不进入免费 entitlement 计数。现有 `platform_generation_usages` 仅服务免费 `platform`。签到默认奖励 1，少量随机奖励 2，接口返回实际 `awarded`。

知识聊天沿用独立 turn 账务，不设置最低扣费。每个模型在 billing catalog 中有独立输入缓存命中、输入未命中、输出单价和倍率；按实际 Token 统一向上取整到微积分单位，目标普通对话约 5～8 次消耗 1 积分。BYOK 不进入此账务。

## DSH Knowledge Chat 修改闭环

个人树聊天继续使用同一 `account_id + library_entry_id` 的原生 DSH 会话、上下文、模型选择、web_search 和审批能力。工具 allowlist 为 `web_search`（只读）以及一个窄权限 `personal_tree_mutation`；不存在文件系统、Shell、服务器、数据库、其他账号或任意路径工具。外部搜索和树内容都按不可信资料处理。

`personal_tree_mutation` 参数是版本约束的受限命令：修改树信息、增加/修改/删除节点、增加/修改/删除边，以及整树清空。Rust 宿主必须再次校验当前登录账号、当前 library entry、private/AI-generated/ready 树和 `expectedRevision`；跨账号、公共树、其他 entry、错误版本、未知字段和越权 id 一律拒绝。提案阶段只返回摘要差异和 `proposalId`，不落库；执行阶段必须同时满足：

1. 用户通过聊天 UI 明确点击确认；
2. DSH `ctx.approval.request` 返回 `allowed-once`；
3. Rust 事务中的账号、entry、tree、revision 校验全部通过。

删除节点/边和整树清空使用单独确认类型；审批缺失、超时、取消、`rejected`、`unavailable` 或 wire 消息不完整都 fail closed。执行以 `proposalId + idempotencyKey` 幂等，revision 乐观锁冲突返回当前安全摘要并要求重新生成提案。成功事务只更新当前个人 AI 树，不触碰公共树、完成记录所属账号之外的数据；整树清空保留合法的树元信息并写入空图状态，不删除其他账号数据。

## Approval wire protocol

在现有 JSONL protocol v1 增加：

- worker → host `approval_request { protocolVersion, requestId, approvalRequestId, toolName, callId?, reason?, proposal }`
- host → worker `approval_result { protocolVersion, requestId, approvalRequestId, outcome }`

`outcome` 只允许 `allowed-once | rejected | cancelled | unavailable`。Rust 在聊天 SSE 发出不含原始整树 JSON、内部字段或工具参数的 `approval_required` 事件；前端点击确认/拒绝后通过独立 CSRF 保护接口把结果送回当前挂起 request，Rust 再发送 `approval_result` 给 worker。非 SSE/断连/过期审批自动 `cancelled`，禁止默认放行。

## 前端合约

生成对话框在选择 `credits` 后展示模型、thinking、reasoning effort 和 1/2/3 追问次数；价格和实际扣费均展示服务端值。规划页的“AI 追问”只在 outcome 为 `needs_input` 时消耗，replan/adjust 使用独立按钮和独立剩余次数。

知识聊天显示自然语言提案差异与确认/拒绝按钮；普通回答永远不显示原始整树 JSON、UUID、坐标或内部字段。聊天完成后刷新积分与个人树查询；确认成功后保留当前节点选择并刷新 revision/画布。

## 验证

每个业务切片先写失败测试并记录红色失败，再实现绿色，再重构。必须运行前端 `npx vitest run`、`npm run typecheck`、`npm run build`；运行 `harness-worker` 的 test/typecheck/build；Rust 可用时运行 fmt/check/clippy/test；启动本地真实 PostgreSQL，执行 migration 与真实 HTTP/DSH worker 链路，并使用 Browser Harness 做真实 DOM 验收。只报告本地结果。
