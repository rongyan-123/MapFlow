# MapFlow 酒馆原生能力账本与演进契约

日期：2026-09-24
状态：P1 实现中；SillyTavern 原生行为优先，`dsh-agent-rp` 仅作 MIT 参考实现

## 1. 目的与解释规则

现有酒馆 MVP 已验证角色卡导入、普通/学习聊天、持久化、计费、请求观测与 300 秒 Runtime 回收恢复。它有意排除了完整 Prompt Manager、Swipe、分支、群聊、脚本和扩展生态。本文件不推翻 MVP，而是把这些排除项重新纳入一个可演进的整体模型，避免继续在严格的“一条用户消息 + 一条助手回复”结构上堆补丁。

解释优先级固定为：

1. SillyTavern 原生源码和原生数据语义；
2. MapFlow 的账号、积分、安全、持久化与视觉约束；
3. `dsh-agent-rp` 中可复用的兼容算法；
4. DSH 仅作为模型执行 Harness，不定义酒馆产品语义。

源码基线：

- SillyTavern `06bde939fb1e9c4c8d8641d810f0a916b5bce127`（AGPL-3.0，仅研究行为，不复制代码）；
- `hewzhew/dsh-agent-rp@f8b98d9eb4bbffa218db3a755da7a61b0c731b7c`（MIT，复制实现时保留声明）；
- MapFlow 前后端分支 `codex/tavern-mvp-20260922`。

## 2. 逐项能力账本

| 能力 | SillyTavern 原生事实 | `dsh-agent-rp` 实际情况 | 当前 MapFlow | 目标与阶段 |
| --- | --- | --- | --- | --- |
| 角色卡 | V1/V2/V3、PNG/JSON、开场白、角色字段、管理与导入导出 | PNG/JSON/CHARX；未知字段保留；安全子集进入 Prompt | V1/V2/V3 PNG/JSON 常用字段；规范化后未知字段只变成警告 | P1 保留现有安全导入并增加无损原始字段快照、导出与版本化规范；CHARX 在 P2 |
| Prompt Manager | 模块目录、附加/分离、排序、开关、角色、相对/绝对位置、深度、触发条件、全局/角色顺序、预设导入导出 | 支持 Chat Completion 预设、模块顺序/开关/深度，但并非所有原生触发与位置等价 | P1 Compiler 已统一 action/history、核心宏、世界书上下文与真实 prompt fingerprint；尚无完整模块管理 UI | P1 完成统一编译与审计；P2 提供完整管理和预设 UI |
| 参数系统 | Chat Completion 与 Text Completion 分别支持大量 Provider/采样参数 | 能导入保存很多字段，主角色生成只实际应用 temperature、maxTokens、reasoningEffort 等少数字段 | 已贯通会话级 temperature、maxOutputTokens、stopSequences 与逐次快照；其余字段拒绝 | P1 只开放当前 DSH 真正贯通到 DeepSeek wire 的参数；扩展 DSH 后再按模型能力开放，不制造假开关 |
| 世界书 | 关键词/正则、四种选择逻辑、大小写/整词、扫描深度、递归、概率、预算、位置、角色字段扫描、定时和向量等 | 安全实现关键词/正则/选择逻辑/预算/部分位置；高级字段多为保留但不执行 | 常驻、主/辅助关键词、选择、优先级、最多 8 条、10 KiB | P1 将现有逻辑纳入 Prompt Compiler；P2 补原生确定性字段；概率/定时/向量按独立能力推进 |
| 宏 | 独立解析器与注册表；身份、角色字段、消息、变量、随机、骰子、日期时间等 | 实现身份、角色字段、消息、变量、可重放随机/骰子等子集 | P1 已单次展开身份、Persona、输入和最近消息宏，未知宏保留 | P1 保持可重放核心子集；P2 扩充变量与安全宏 |
| 回复操作 | Generate、Regenerate、Continue、Swipe、多回复版本和编辑 | 有重生成、续写和版本选择，但数据语义不完全等同于 ST Swipe | Reply/Regenerate/Continue 共用一个生成入口；Swipe/Edit 共用 revisioned graph action；P1 编辑限当前完整助手回复，续写片段不暴露尚未实现的编辑/重生成组合；成功生成有不可变审计记录 | P1 完成恢复与真实 UI 验收 |
| 分支/检查点 | 可从指定消息/Swipe 创建 Branch 和 Checkpoint | Session 事件可重放，但没有完整原生交互模型 | 已用持久化指针实现命名 Branch/Checkpoint/回档，不复制历史 | P1 完成真实 UI 与恢复验收 |
| 群聊 | 多角色、成员启用状态、发言顺序/激活策略、自回复等 | 故事 Worker 不是传统群聊 | 缺失 | P3；Conversation Graph 从 P1 起保留 author/character 维度，避免未来再迁移 |
| Quick Reply/STscript | Quick Reply 是内置扩展；STscript 有命令、管道、变量、流程和自动触发 | 只兼容 `/send`、`/setinput`、`/trigger` 等很小子集 | 缺失 | P4；先定义能力受限命令 Runtime，再谈语法兼容 |
| 正则 | 内置扩展可作用于输入、输出显示、Prompt、Reasoning 等位置 | 有隔离正则与显示/Prompt 分流 | 仅在导入警告中识别部分扩展 | P2 建纯文本 Transformation Pipeline；显示副本和模型副本不得改写持久化原文 |
| 第三方扩展 | Manifest、脚本/样式、事件、设置、安装与 Host DOM；能力宽且耦合浏览器 | 有受限扩展 Host，只验收有限扩展，不承诺任意插件 | 无通用 Host | P4；只提供显式能力协议和隔离沙箱，不宣称 SillyTavern 插件通用兼容 |
| MVU/EJS/Tavern Helper | 热门社区生态，并非全部属于原生核心 | 二开的重点；用隔离 frame/QuickJS、变量快照和审批能力实现子集 | 完全不执行 | P4；作为 Extension Runtime Adapter，不进入 Prompt/Graph 核心 |
| RAG/长期记忆 | Data Bank、Chat Vectorization、Summarize，可对聊天、文件和世界书召回 | 自己的 Memory/故事状态，语义不等同 | 仅保存完整历史并按 32 KiB 选后缀 | P3；摘要、向量和附件分别建模，召回结果作为 Prompt contribution |
| Function Calling | 扩展可以注册工具，模型调用可递归多轮 | 依赖 DSH 工具与 Worker，权限模型不同 | Tavern profile 固定零工具、一步 | P3/P4；默认仍为零工具，只允许宿主注册的会话能力，卡片永远不能授权工具 |
| 安全与重放 | 本地应用功能丰富，插件/DOM 权限较宽，聊天文件为业务事实 | Session 事件、隔离、审批和重放更严格 | PostgreSQL 权威历史、计费事务、代际 fence、TTL/LRU 恢复已经较强 | 横切基线；保留并扩展到 Graph/Compiler/Extension，不降级 |

结论：`dsh-agent-rp` 不是“更完整的 SillyTavern”。它在安全执行、事件重放和社区脚本隔离上投入较深，但原生消息图、群聊、STscript 和部分 Prompt/世界书语义仍不完整。MapFlow 应选择性复用算法，不继承其产品优先级。

## 3. 当前实现与目标之间的关键断点

### 3.1 线性回合不是可扩展的聊天模型

`tavern_turns` 将用户消息、助手消息和扣费绑定成一行。这适合 MVP，但无法表达：

- 同一用户消息下的多个 Swipe；
- 不新增用户消息的 Regenerate；
- 连续助手片段的 Continue；
- P1 编辑当前完整助手回复并保留旧候选；祖先路径重写留到有真实交互需求时再设计；
- 从任意版本创建 Branch/Checkpoint；
- 群聊中的具体说话角色。

因此不能继续给 `tavern_turns` 增加 `swipe_index`、`parent_turn_id` 等局部字段。P1 要新增真正的消息图；旧表只作为迁移来源和历史兼容证据。

### 3.2 Prompt 组装目前分裂

Rust 负责静态角色 Prompt 和世界书选择，Node 又负责动态 context 的最终渲染。增加 Prompt Manager、宏、正则、RAG 后，如果继续分散，会出现顺序和预算不一致。P1 必须建立一个权威 Prompt Compiler，所有模型输入都从同一个结果产生。

### 3.3 DSH Session 不应拥有业务历史

现有 Worker 已经每轮创建并释放 DSH Agent handle，逻辑 Session 主要缓存历史。进入消息图后，当前路径可能随 Swipe、编辑或分支切换而改变，缓存追加历史不再可靠。P1 改为每轮携带数据库权威活动路径并建立种子；300 秒 TTL/LRU 只缓存可重建的编译资源和运行优化，不拥有聊天事实。

## 4. 一条实现主线下的内部职责

下面只是同一实现里的代码职责，不是四套方案，也不对应四组对外 API。P1 不再为未来能力预先设计额外协议；HTTP 写入面固定收敛为两条：一条流式生成入口承载 Reply / Regenerate / Continue，一条 revisioned graph action 入口承载 Swipe / Edit / Branch / Checkpoint。设置读写属于会话资源本身，不为每个能力再造 endpoint。

### 4.1 Conversation Graph

内部领域入口：

```text
read_snapshot(account, conversation, branch?) -> ConversationSnapshot
apply(account, conversation, expected_revision, ConversationAction) -> GraphOutcome
```

`ConversationAction` 首阶段包括：

```text
Reply(text, client_action_id)
Regenerate(assistant_message_id, client_action_id)
Continue(assistant_message_id, client_action_id)
Edit(message_id, replacement)
SelectAlternative(assistant_message_id)
CreateBranch(anchor_message_id, name)
SelectBranch(branch_id)
CreateCheckpoint(anchor_message_id, name)
```

不变量：

- 消息内容节点不可变；编辑产生新节点或新路径，不覆写已生成依据；
- 助手 Swipe 是同一父节点下的候选；活动分支保存叶节点指针；
- Branch/Checkpoint 是指针，不复制历史；
- 每个生成动作持久化其 intent、Prompt 指纹、参数快照、模型、用量与扣费；
- 同一 `client_action_id` 同内容重放既有结果，不再次生成或扣费；
- 切换 Swipe/Branch 不调用模型、不扣费；
- 所有生成与图动作以 `expected_revision` 防止多标签页静默覆盖；设置资源以 `expected_settings_version` 条件更新，不另造行为接口。

### 4.2 Prompt Compiler

P1 内部纯函数：

```text
compile(CompilationInput) -> CompiledPrompt
```

P1 输入只包含不可变快照：角色、Persona、活动消息路径、生成 intent、当前世界书和可选词表。输出是唯一送入 Runtime 的 system / history / context / user envelope 和稳定 fingerprint。Graph 路径解释、核心宏、世界书激活与字节预算必须全部留在 Compiler 模块，调用方不得自行拼装第二套 Prompt。

Prompt preset、记忆贡献、可重放 entropy、无正文 manifest、预算报告和结构化 diagnostics 是完整 Prompt Manager 进入 P2 时的目标输出；P1 不先建立没有消费者的占位协议。届时输出扩展为：

- 有序 provider-neutral messages；
- 每段来源/位置/裁剪原因的无正文 manifest；
- 稳定 fingerprint；
- token/字节预算结果；
- 不支持或失败能力的结构化 diagnostics。

Compiler 内部执行固定流水线：

```text
normalize -> macro expansion -> world-info activation -> prompt module ordering
-> model-facing regex -> memory contribution -> budget -> final messages
```

持久化原消息永不被宏或正则改写。显示正则属于前端投影，不属于模型 Prompt。

### 4.3 Generation Policy

内部纯函数：

```text
resolve(model_profile, requested_settings) -> EffectiveGenerationSettings
```

P1 当前 DSH 可执行字段：`temperature`、`maxOutputTokens`、最多四个 `stopSequences`。Conversation 保存当前设置；每次生成保存不可变的生效快照。UI 只显示模型能力声明支持且真实进入 wire body 的字段。

`topP`、`topK`、Qwen3 `minP`、`frequencyPenalty` 保留在服务端能力模型中，但当前 profile 明确声明不支持并拒绝输入。开放它们之前，必须先在受控 DSH 分支中贯通 call config、会话 header、相等性比较、seed 校验和具体 Provider wire body；仅保存字段或仅增加 UI 不算支持。

DSH 当前通用配置只支持 `temperature`、`maxTokens`、`stop`。新增字段必须在受控 DSH 分支中进入 call config、会话 header、相等性比较和 DeepSeek/SiliconFlow wire body；禁止在冻结请求之后偷偷修改，也禁止直接修改 `node_modules`。

### 4.4 未来扩展的安全边界

P1 不实现、不预留一套可调用的 Extension Runtime 接口，只固定一条安全约束：未来如果接入正则、Quick Reply/STscript、Tavern Helper、EJS 或 MVU，它们不能直接访问数据库、DSH scope、MapFlow DOM、积分、文件、Shell、MCP 或账号凭据。等某个具体能力进入排期时，再按它的真实需求设计最小协议。

## 5. P1 持久化模型

新增迁移，不破坏旧计费流水：

```text
tavern_messages
  message_id UUID PK
  account_id UUID
  conversation_id UUID
  parent_message_id UUID NULL
  role user|assistant|system
  character_id UUID NULL
  content TEXT
  origin opening|user|model|edit|continue|migration
  created_at

tavern_branches
  branch_id UUID PK
  account_id UUID
  conversation_id UUID
  name TEXT
  leaf_message_id UUID NULL
  kind main|branch|checkpoint
  revision BIGINT
  created_at / updated_at

tavern_generations
  generation_id UUID PK
  account_id UUID
  conversation_id UUID
  branch_id UUID
  client_action_id TEXT
  intent reply|regenerate|continue
  anchor_message_id UUID NULL
  input_message_id UUID NULL
  output_message_id UUID
  prompt_fingerprint TEXT
  settings_snapshot JSONB
  model_id TEXT
  token usage + charged_credit_units
  created_at
```

`credit_usage_ledger.source_id` 继续使用一次成功生成的稳定 UUID。迁移既有 `tavern_turns` 时，每一行转换为一个用户节点、一个助手节点和一个 `migration` generation；已有 ledger source ID 必须原样保留，不能重新计费。既有 `opening_message` 转换为业务 Graph 的根助手节点。P1 的 DSH seed 只接受完整的 user/assistant 对，因此选中的开场白仍镜像在不可变角色配置中，但不伪造成用户消息；Compiler 在第一轮把根消息提供给最近角色消息宏和世界书扫描。等 Runtime 支持合法的首条 assistant seed 后，再移除静态镜像，不能宣称 P1 已与 SillyTavern wire history 完全等价。

## 6. P1 运行链

```text
HTTP action
  -> Conversation Graph 取得 revision/活动路径并占有 generation fence
  -> Prompt Compiler 编译数据库权威快照
  -> Generation Policy 解析生效参数
  -> Tavern Runtime Adapter
  -> DSH 单轮零工具执行
  -> 同一结算事务写消息、generation、usage ledger、branch leaf/revision
  -> completed SSE
```

模型失败、流中断、编译失败、参数不支持或结算失败都不能推进 branch leaf，也不能新增 charge。生成期间修改会话参数、角色快照、Prompt preset 或活动分支返回稳定冲突；旧 generation fence 仍禁止失锁请求提交或 reset 新请求。

## 7. 分阶段交付

### P1：原生对话核心（本轮首个完整实现阶段）

- Conversation Graph 与旧数据迁移；
- Reply、Regenerate、Continue、Swipe、编辑、Branch、Checkpoint；
- Prompt Compiler v1：现有角色/Persona/基础世界书/词表 + 统一身份、输入和最近消息宏；
- Generation Policy 与当前 DSH/DeepSeek Chat Completion 真正可执行的参数；
- DSH 每轮权威路径播种、300 秒可丢弃缓存、零工具；
- MapFlow 原生消息操作和设置抽屉；
- 完整 TDD、迁移对账、真实 UI 与 TTL 恢复验收。

### P2：Prompt 与文本语义

- 完整 Prompt Manager 和预设导入导出；
- 世界书确定性高级字段、管理 UI 和诊断；
- 扩展宏；
- 模型/显示正则分流；
- CHARX 和聊天导入导出。

### P3：多角色与记忆

- 群聊与发言策略；
- Data Bank、附件、摘要、向量召回；
- 宿主注册的可选 Function Calling。

### P4：受限生态兼容

- Quick Reply/STscript；
- Extension Runtime Adapter；
- Tavern Helper、EJS、MVU；
- 逐个兼容性套件验收，不宣称任意插件通用兼容。

## 8. P1 TDD 与验收门槛

1. 先写 Graph 纯领域红测：各 Action、活动路径、Swipe、编辑分叉、revision 冲突和幂等。
2. 写真实 PostgreSQL 红测：旧 turns 无损迁移、ledger source 不变、账号隔离、原子结算和 fence。
3. 写 Compiler 红测：顺序、宏可重放、世界书、预算、intent 差异和 fingerprint。
4. 写 Worker/DSH 红测：每个参数进入真实 wire body；权威路径替换旧 Session；卡片不能获得工具。
5. 写 HTTP/SSE 红测：只有数据库提交后 completed；切换 Swipe/Branch 不扣费。
6. 写前端红测：消息操作、Swipe 选择、分支、参数能力和恢复。
7. 运行前端、Worker、Rust 全量测试、类型检查、严格 lint/clippy/fmt。
8. 使用真实第三方卡完成 Reply、Regenerate、Continue、Swipe、编辑分支、Checkpoint、刷新和超过 300 秒后的续聊；逐项核对 DB、积分和观测。

P1 完成的判据不是“新表和按钮存在”，而是以上每一种动作都能通过数据库权威历史恢复，且不会重复生成、串路径或重复扣费。

## 9. 2026-09-25 P1 实现契约审计

本节记录当前代码证据，不把“测试文件存在”等同于验收完成。

| P1 要求 | 当前实现证据 | 判定 |
| --- | --- | --- |
| 两条行为写通道 | `/turns` 统一 Reply / Regenerate / Continue；`/actions` 统一 Swipe / Edit / Branch / Checkpoint；设置仅为会话资源 PATCH | 已实现并通过前后端契约测试 |
| 生成与图操作防静默覆盖 | 生成和图操作均携带 `expectedRevision`；中断重试复用原 revision 与 `clientActionId`；旧页面在另一请求创建检查点后点击编辑，实际收到 409，数据库未写入旧编辑 | 已通过契约测试与真实旧页面冲突验收 |
| 设置资源防静默覆盖 | PATCH 携带 `expectedSettingsVersion`；数据库在同一条件更新中比较版本，旧标签页收到 409 并重载设置 | 已通过数据库红绿测和前端冲突测试 |
| 不可变 Conversation Graph | 消息编辑和重生成产生新节点，分支/检查点只保存指针；恢复拒绝悬空指针、环和用户消息叶子 | 14 项纯领域测试通过 |
| 权威 Prompt Compiler | Graph intent/history、滚动部署兼容历史、核心宏、世界书激活、词表和历史预算由一次 `compile_prompt` 完成 | 7 项 Compiler 测试通过 |
| 开场白语义 | Graph 以 assistant 开场白为根；受 DSH 完整对 seed 限制，不伪造 user 消息；首轮宏和世界书可见开场白 | 已实现；Runtime 首条 assistant seed 属后续兼容增强 |
| 真实参数而非假开关 | 仅开放 temperature、maxOutputTokens、stopSequences；不支持字段服务端拒绝，并进入 DSH wire 契约 | 参数策略 9 项、DSH 契约 12 项通过 |
| Runtime 可丢弃 | Worker 每轮以数据库权威历史播种；零工具；TTL/LRU 只释放缓存 | Worker 81 项通过；隔离浏览器已在空闲超过 300 秒并重启服务后续聊，回复包含编辑后的权威历史。实际 DSH 定时驱逐由 Worker 单测覆盖，浏览器环境使用假 Worker |
| 原始角色卡无损保留与导出 | 账户隔离的 `/characters/{id}/source` 下载原始 PNG/JSON bytes；隐藏角色不可下载；界面只在有 source hash 时显示入口 | 已通过数据库与真实浏览器下载验收 |
| 迁移与计费对账 | 迁移和 PostgreSQL 测试覆盖 generation/ledger 身份、事务结算和 fence；隔离浏览器测试账号 Reply、Regenerate、Continue 各一条 3 微积分流水，图操作无流水 | Rust 全量测试和实库对账通过 |
| 真实第三方卡 UI | Seraphina PNG 已完成导入、原卡下载、Reply、Regenerate、Swipe、Branch、Checkpoint、Edit、Continue、刷新以及超过 300 秒的进程丢失恢复；截图位于 `.tavern-acceptance-evidence/ui-p1-local-*` | 浏览器/数据库/积分/观测验收通过；假 Worker 不代表真实模型质量 |

Docker Desktop 已在重启后恢复。2026-09-25 复跑：Rust `cargo test --locked` 全通过；Worker 81 项通过、1 项跳过；前端 400 项通过、1 项跳过；前后端类型检查、构建、严格 Clippy 与格式检查通过。第一次并行全量前端测试有一个无关首页测试触发 5 秒超时，单独复跑全绿。真实 UI 使用隔离的 localhost HTTPS、测试数据库和假 Worker；其目的为契约与恢复验收，不能据此声称真实模型输出质量已被验证。
