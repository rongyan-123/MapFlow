# MapFlow 酒馆角色卡聊天 MVP 设计

日期：2026-09-20
状态：产品范围已确认，等待文档复核后进入实现计划

## 1. 目标

在 MapFlow 内新增独立的“酒馆”功能。用户可以导入普通 SillyTavern PNG/JSON 角色卡，查看兼容性结果，创建角色会话，并在 MapFlow 原有账号、主题、积分与监控体系内连续聊天。

第一版只验证一件事：角色卡聊天本身是否足够有吸引力，并且将学习单词自然放入对话后，用户是否愿意继续玩。它不是完整的剧情游戏引擎，也不承诺运行社区卡附带的脚本生态。

验收终点是：导入一张真实第三方卡，可选绑定一组手工单词，连续完成至少五轮对话；刷新页面后历史仍在；空闲超过五分钟后运行时会话被回收，再次发送消息仍能从持久化历史恢复；积分和请求观测一致。

## 2. 已确认范围

### 2.1 本期包含

- MapFlow 顶层导航增加“酒馆”，使用现有登录、主题和响应式外壳。
- 导入普通 PNG/JSON 角色卡，兼容 Character Card V1、V2 和 V3 的常用文字字段。
- 导入前展示角色名称、描述、开场白、头像和兼容性警告。
- 支持角色设定、场景、示例对话、角色／用户名称占位符和基础世界书。
- 创建会话时填写用户称呼、可选 Persona，并可选绑定一组手工单词；不提供词表时就是普通角色聊天。
- 独立角色聊天历史、精确积分扣费、请求观测与 300 秒 TTL/LRU。
- 默认纯聊天，不向角色 Runtime 暴露搜索、技能树修改、文件、Shell、MCP 或其他工具。

### 2.2 本期不包含

- SillyTavern 前端、Node 服务端或完整插件宿主。
- 酒馆助手、MVU、EJS、正则脚本、自定义 HTML 面板和任意 JavaScript 执行。
- 卡片商城、自动抓取、MCP 下载器和社区账号体系。
- 自动词汇量测评、课程规划、掌握度算法和随机生成完整世界。
- 回档、死亡、结算、势力状态、权威游戏规则和后台多 Agent。
- 角色卡在线编辑、群聊、分支聊天、消息重写和聊天导入导出。

导入器遇到上述扩展时必须给出“不支持但已安全忽略”的结构化警告，不能把“文件导入成功”表述为“卡片全部机制兼容”。

## 3. 方案比较与选择

| 方案 | 优点 | 代价 | 结论 |
| --- | --- | --- | --- |
| MapFlow 原生页面 + 角色卡兼容层 + 现有 DSH Runtime | 复用账号、积分、监控和视觉；权限边界清楚；可逐步增加兼容字段 | 需要自行实现最小卡片规范化和会话领域 | 采用 |
| 嵌入完整 `dsh-agent-rp` Host | 已有更多角色扮演资源与兼容代码 | 依赖其 Host 补丁、会话事件和 UI 扩展槽；与现有应用形成第二套宿主 | 不采用整套；仅参考 MIT 源码 |
| Fork SillyTavern 或其二开 | 社区插件兼容范围最大 | AGPL、DOM/前后端耦合、第二套身份和存储；难以融入 MapFlow | 本期不采用 |

实现时可以定向参考固定版本 `hewzhew/dsh-agent-rp@f8b98d9eb4bbffa218db3a755da7a61b0c731b7c` 的 PNG 元数据、卡片规范化和世界书算法。若复制实现片段，必须保留 MIT 版权与第三方声明；角色卡内容自身的授权与程序许可证分开处理。

## 4. 领域语言

- **角色（Tavern Character）**：某次导入后得到的、归当前账号所有的规范化角色卡。第一版不可在线编辑；重新导入产生另一个角色。
- **兼容性报告（Compatibility Report）**：导入器对支持字段、被忽略字段、脚本依赖和限额裁剪的结构化结果。
- **角色会话（Tavern Conversation）**：角色、用户 Persona、可选学习词表与所选开场白的不可变快照，加上持续追加的对话回合。
- **学习词表（Vocabulary Snapshot）**：创建会话时可选保存的单词数组。缺省时不生成词汇提示段；存在时只影响语言暴露策略，不代表掌握度，也不能强迫剧情围绕单词展开。空数组统一规范化为缺省。
- **回合（Tavern Turn）**：一条用户消息及其成功完成的助手回复、模型用量和扣费记录。失败请求不产生完成回合。
- **运行时会话（Runtime Session）**：DSH worker 内可丢弃的 Agent Handle。它不是聊天记录；丢失后可以由角色会话与持久化回合重建。
- **基础世界书（Basic Lorebook）**：只包含文本、启用状态、触发关键词、常驻标记、优先级和插入内容的世界知识集合。

“角色会话”和现有“知识树聊天”是两个独立业务概念。二者不得共享会话键、历史、工具权限或 HTTP 路由。

## 5. 架构

```text
TavernPage
  ├─ CardImportModule ──> Tavern Character HTTP
  ├─ CharacterLibrary
  └─ ConversationPane ──> Tavern Conversation HTTP/SSE
                                │
                                ▼
                         TavernChatModule
                         ├─ ownership / idempotency
                         ├─ history / billing transaction
                         ├─ lore + vocabulary projection
                         └─ TavernRuntime interface
                                │
                                ▼
                     DeepSeekHarnessTavernAdapter
                                │ JSONL
                                ▼
                     harness-worker Tavern Runtime
                     ├─ static role prompt
                     ├─ per-turn context envelope
                     └─ 300s TTL + bounded LRU
```

### 5.1 CardImportModule

这是一个深模块，外部接口只有：

```ts
normalizeCharacterCard(file): Promise<NormalizedCharacterCard>
```

模块在浏览器本地读取 PNG 文本块或 JSON，统一为内部结构，并产生兼容性报告。调用方不需要理解 `chara`、`ccv3`、V1/V2/V3 差异或占位符格式。

浏览器输出的规范化 JSON 是服务端的权威导入输入契约，而不是原始文件的“证明”。服务端不重复解码 PNG 卡片规范，但会重新校验规范化结构、文本长度、数量和控制字符。请求可以同时携带可选原始文件；服务端记录 `source_format`、原始文件 SHA-256 和规范化 JSON SHA-256。两者不宣称内容一一对应，原始 PNG 只作为头像和来源留存，并再次校验体积、图片魔数和响应类型；JSON 卡没有头像时使用 MapFlow 默认头像。

首版支持字段：

- `name`
- `description`
- `personality`
- `scenario`
- `first_mes`
- `mes_example`
- `system_prompt`
- `post_history_instructions`
- `creator_notes`
- `alternate_greetings`
- `character_book` 中的基础世界书字段
- `{{char}}`、`{{user}}` 常用占位符

不识别的字段保留在兼容性报告中，不进入模型上下文。

### 5.2 TavernChatModule

Rust 端新增独立业务模块，承担账号归属、会话快照、历史读取、幂等、积分结算和错误语义。HTTP 层只做协议转换，不能直接调用 worker 或写表。

对外核心接口保持窄小：

```text
create_conversation(account, character, persona, vocabulary?)
list_conversations(account)
read_conversation(account, conversation_id)
send_turn(account, conversation_id, client_turn_id, message)
```

`send_turn` 是唯一生成入口。同一个 `client_turn_id` 重试时返回已保存结果，不重复调用模型或扣费。一个角色会话同时最多存在一个生成中的回合；并发提交返回稳定冲突错误。

### 5.3 TavernRuntime interface

角色聊天不复用 `KnowledgeChatService`，只复用更底层的 DSH 进程托管、模型配置、用量结构和会话恢复机制。Rust 使用独立的 `TavernChatRequest`，JSONL 使用独立的 `tavern_chat_message`；现有 `chat_message` 的非空工具校验和知识树工具白名单保持不变。酒馆请求没有通用 `tools` 字段，worker 的酒馆分支固定不注册工具并把模型步数上限固定为 1。

运行时请求包含：

- 稳定会话键 `tavern:{account_id}:{conversation_id}` 的安全派生值；
- 不可变角色配置及其指纹；
- Rust 生成的本轮结构化 `TavernTurnContext`；
- 当前原始用户消息；
- 首次创建或恢复时的已完成历史；
- 模型、输出上限和计费所需字段。

角色配置指纹发生变化时不复用旧 Agent Handle。第一版角色会话配置不可变，因此正常使用不会出现该情况。

### 5.4 Worker 运行方式

worker 为角色聊天建立独立 SessionStore 命名空间。静态系统提示由角色设定、场景、示例对话、Persona、所选开场白和宿主安全规则组成。

动态注入只有一条路径：Rust 的 `TavernContextProjector` 使用当前原始消息与最近四个已完成回合选择世界书条目，并生成带稳定字段顺序的 `TavernTurnContext`；Node worker 是唯一的模型文本渲染器，将该结构渲染为规范化 JSON 动态上下文。DSH 的 `SystemPrompt` 改为允许 runtime context，现有知识树会话在自身 scope 内显式调用 `suppressRuntimeContext()`，酒馆 scope 注册名称固定为 `mapflow:tavern-turn` 的 context provider。worker 在 `followup` 前更新会话状态中的当前 context，DSH 在每一步组装时读取它。

原始用户消息仍以未包装文本进入 `followup`。动态上下文只进入 DSH 的 runtime-context 投影，不写入 `tavern_turns` 的用户文本；持久化历史只保存原始用户／助手消息。Runtime Session 恢复时，Rust 根据数据库历史和当前消息重新计算本轮 context，再播种成对历史。这样同一张卡只有一套世界书选择算法和一套模型渲染格式。

角色卡是用户导入的提示内容，不是权限配置。第一版酒馆协议没有工具字段，worker 不注册工具并固定 `maxSteps=1`，同时通过 DSH `agentOptions.maxTokens` 将单次输出限制为 2,048 token；卡片中的“调用工具”“修改网站”“读取文件”等指令只会被当作角色文本。

Runtime Session 规则：

- 空闲 TTL 为 300 秒；扫描允许最多一个扫描周期的延迟。
- 只回收没有生成中或排队中请求的 Session。
- 容量达到上限时只按 LRU 回收空闲 Session。
- 淘汰只删除 worker 内存；数据库历史、角色和会话不删除。
- Rust 误认为 Session 仍存在时，worker 返回 `session_missing`；Rust 清除登记并携带持久化历史重试一次。
- 重试仍失败时返回稳定错误，不无限重试。

## 6. 世界书与学习词表

### 6.1 基础世界书

基础世界书只支持：`enabled`、主关键词、可选辅助关键词、常驻、内容、优先级和顺序。当前消息与最近四个已完成回合参与 Unicode 规范化后的大小写不敏感文本匹配。匹配语料按“当前消息、由新到旧的完整回合；每回合先用户后助手”构造；此顺序只用于可复现诊断，不改变关键词命中结果。

每轮最多激活 8 条。先选择常驻项，再选择关键词命中项，并按优先级、卡片顺序和导入顺序稳定裁剪；最终还受第 9 节的动态上下文字节预算限制。被裁剪数量进入观测指标，但正文不进入日志。

正则触发器、递归扫描、脚本、概率执行、向量召回和自定义插入深度本期不支持。

### 6.2 学习词表

创建会话时可以完全跳过词表；提供时允许输入最多 50 项，每项包含英文词或短语及可选中文释义。规范化后的完整词表最多占 2 KiB UTF-8 字节，超限时拒绝创建并提示用户精简，不静默漏掉词条。词条快照不可在会话中途修改。

宿主提示要求模型：

- 在语境自然时优先让 NPC、环境文字或叙述使用这些词；
- 以理解输入为主，不要求玩家必须主动产出目标词；
- 不得为了塞词制造与当前人物、时代、地点或冲突无关的场景；
- 不需要每轮覆盖单词，也不宣称用户已经掌握。

首版不做自动分块、间隔重复、词频统计或掌握度判定。这些能力只有在核心聊天被证明值得继续后再设计。

## 7. 持久化与计费

新增表：

- `tavern_characters`：账号、规范化卡片 JSON、兼容性报告、可选 PNG 头像、导入摘要和时间。
- `tavern_conversations`：账号、角色、Persona、可选学习词表快照、所选开场白、配置指纹、标题和时间。
- `tavern_turns`：会话、`client_turn_id`、用户文本、助手文本、模型用量、扣费单位和完成时间。
- `credit_usage_ledger`：账号、来源类型、来源 ID、微积分单位和时间；`(source_kind, source_id)` 唯一。

为避免每新增一种 AI 功能就在多个查询里手工减一张表，余额读取统一改为“积分发放账本减通用用量账本”。`charged_credit_units` 继续保留在业务回合表中作为审计明细，但切换完成后不再被任何余额查询直接扣减。

迁移按以下顺序执行，防止重复或漏扣：

1. 先创建 `credit_usage_ledger` 及 `(source_kind, source_id)` 唯一约束，不改变现有余额读取。
2. 用每条 `knowledge_chat_turns.turn_id` 作为来源 ID 幂等回填，并校验账号级与全局扣费总和完全一致。
3. 在同一应用版本中，把所有余额读取切换为通用用量账本；没有任何查询再同时减 `knowledge_chat_turns.charged_credit_units`。
4. 知识聊天和酒馆聊天都在保存成功回合的同一数据库事务内写入用量记录；重复来源由唯一约束返回既有结果。
5. 部署采用单写入者切换：完成迁移和一致性检查后才让新版本接流，旧版本不在回填后继续接受写入。若未来改为滚动多实例部署，必须先增加兼容触发器或双写过渡版本，不能直接复用本步骤。

扣费规则继续使用现有模型价格目录。角色卡不能选择价格、伪造 token 或改变免费额度。模型失败、流中断且未形成完成回复、持久化失败均不扣费；已完成回合重复读取不再次扣费。

## 8. HTTP 接口

所有接口均在现有会话、CSRF、账号限流和请求观测下：

```text
POST   /api/me/tavern/characters
GET    /api/me/tavern/characters
GET    /api/me/tavern/characters/{character_id}
DELETE /api/me/tavern/characters/{character_id}

POST   /api/me/tavern/conversations
GET    /api/me/tavern/conversations
GET    /api/me/tavern/conversations/{conversation_id}
GET    /api/me/tavern/conversations/{conversation_id}/turns
POST   /api/me/tavern/conversations/{conversation_id}/turns
```

`POST /api/me/tavern/characters` 使用 multipart：必填 `normalized_card` 是符合 MapFlow 版本化 schema 的 JSON，选填 `source_file` 只用于来源留存和 PNG 头像。服务端基于规范化 JSON 建立角色，不从来源文件推断或覆盖字段；响应同时返回 `normalized_hash`、可选 `source_hash` 和兼容性报告。JSON schema 版本不支持时直接拒绝，不做猜测性降级。

发送回合沿用知识聊天已经验证的流式事件风格，但使用独立事件类型和错误码。第一版删除角色时，如存在会话则软隐藏角色，不级联删除历史。

稳定错误族：

- `tavern.card_invalid`
- `tavern.card_unsupported`
- `tavern.input_too_large`
- `tavern.character_not_found`
- `tavern.conversation_not_found`
- `tavern.turn_conflict`
- `tavern.credit_unavailable`
- `tavern.runtime_unavailable`
- `tavern.persistence_failed`

## 9. 限额和安全

- 原始导入文件最大 8 MiB；规范化 JSON 最大 512 KiB。
- PNG 必须具有正确魔数；头像响应使用固定图片类型、CSP 和 `nosniff`。
- 单个文字字段最大 64 KiB；世界书最多 256 条。
- Persona 最大 4,000 字符；单轮用户输入最大 8,000 字符。
- 可选学习词表最多 50 项；词或短语最大 80 字符，释义最大 500 字符。
- 酒馆面向最小 32,768 token 的已允许模型，并使用确定性的 UTF-8 字节预算：静态 system prompt 最多 20 KiB，本轮动态上下文最多 10 KiB，当前用户消息最多 8 KiB，历史最多 32 KiB，模型输出最多 2,048 token。剩余上下文留给 DSH 格式、消息边界和 tokenizer 差异。
- 静态 prompt 的宿主安全规则和角色名不可裁剪；其余内容按“示例对话、次要描述、卡片自定义后置指令”的顺序从尾部裁剪。角色核心描述、Persona、场景、所选开场白或卡片自定义 system prompt 若仍超限，则拒绝创建会话，不静默改变角色。
- 动态上下文中的可选词表最多占 2 KiB，并在创建会话时保证完整放入；常驻世界书和命中世界书按既定优先级使用剩余额度。没有词表时全部 10 KiB 可用于世界书。
- 历史从最新完整用户／助手对向前选取，不拆分回合；开场白始终位于静态 prompt，不占成对历史。当前用户消息超限直接拒绝，不截断。
- 日志和请求观测不记录卡片正文、Persona、私聊原文、完整提示词、密码或模型密钥。
- 所有读取、删除和发送接口按 `account_id` 再查主键，防止横向越权。
- 导入内容永远不生成 DSH 工具 allowlist，也不能覆盖宿主 system policy。

## 10. 前端体验

酒馆是 `/tavern` 独立顶层页面，而不是技能树详情面板。

桌面布局：

- 左栏：角色列表、导入按钮和兼容性状态。
- 中栏：当前角色的会话列表与消息流。
- 右栏：角色摘要、Persona、学习词表和世界书启用摘要。

创建会话采用一个短流程：选角色 → 填写用户称呼／Persona → 可选粘贴学习词表 → 选择开场白 → 确认。界面默认选择 `first_mes`，并把 `alternate_greetings` 展示为可切换候选；没有开场白时显示明确的空状态。

所选开场白保存在 `tavern_conversations.opening_message`，由界面作为首条角色消息展示，同时进入该会话的静态 prompt。它不是 `tavern_turns`，不需要伪造用户消息，不调用模型也不扣费。恢复 Runtime 时，开场白仍由静态 prompt 提供，持久化历史继续保持严格的用户／助手成对结构。

移动端使用现有抽屉模式在角色列表、聊天和设置之间切换。视觉继续使用当前主题变量、卡片圆角、描边和青色主操作色，不引入 SillyTavern 原页面或第二套设计系统。

## 11. 观测

复用现有请求观测，不建立第二套监控系统。新增业务分类 `tavern`，记录：

- 请求 ID、账号安全标识、角色会话安全标识、模型和阶段；
- 首 token、总耗时、输入／输出／缓存 token、扣费和幂等命中；
- 当前 Runtime Session 数、TTL/LRU 淘汰次数和原因；
- `session_missing` 次数、历史恢复成功／失败；
- 卡片导入格式、警告代码和限额拒绝原因，不记录正文；
- worker 进程内存抽样。

HTTP 200 或 SSE 建连不代表成功。只有模型完成、回合与用量同一事务提交后才记录业务成功。

## 12. 测试与验收

### 12.1 自动测试

1. 卡片契约：V1/V2/V3 JSON 与对应 PNG 规范化结果相同；占位符和基础世界书正确；来源哈希可复算；损坏、超限、脚本依赖产生确定结果；服务端不错误宣称原始文件与规范化 JSON 对应。
2. 领域与存储：账号隔离、角色软删除、可选词表、开场白选择、会话快照、回合幂等、并发冲突和计费事务。
3. 计费迁移：回填前后账号级与全局余额完全相同；切换后余额只读取通用用量账本；两种聊天都只扣一次。
4. Runtime：独立酒馆协议没有工具字段且只能运行一步；原知识聊天仍拒绝空工具；scope 级动态上下文不污染知识聊天；TTL/LRU 后携带历史恢复；生成中不回收；配置指纹隔离。
5. HTTP：CSRF、限流、越权、SSE 完成／失败语义和错误码。
6. 前端：导入预览、警告、创建会话、消息流、刷新恢复、移动布局和主题。
7. 原有知识树聊天、生成、积分和管理面板全量回归。

业务逻辑遵循 TDD：先加入能复现缺口的失败测试，再实现，再在绿色状态下重构。

### 12.2 真实 MVP 验收

- 使用一张来源可说明的普通 PNG 角色卡和其 JSON 等价样例。
- 导入后核对名称、头像、开场白、基础世界书和兼容性警告。
- 分别创建不带词表的普通角色会话，以及带 20 至 30 个相关单词的学习会话；两者都能正常聊天，学习会话连续完成至少五轮。
- 核对场景连贯，单词出现不强行扭曲剧情，输入框和流式状态正常。
- 刷新页面，历史和当前角色会话恢复。
- 空闲超过 300 秒并越过扫描容差，再发送追问；确认 Runtime 恢复历史且没有重复扣费。
- 检查请求观测、积分余额、数据库回合数、容器重启数和敏感信息扫描。

## 13. 实施切片

1. **通用计费底座**：新增用量账本、回填和知识聊天迁移，保持现有余额不变。
2. **卡片兼容层**：先写契约样例和失败测试，再做浏览器解析、服务端权威规范化输入校验、来源哈希和角色存储。
3. **独立角色会话**：数据表、所有权、会话创建、历史和幂等回合。
4. **DSH 角色 Runtime**：独立 `tavern_chat_message` 协议、零工具 Agent、scope 级 runtime context、提示预算和恢复。
5. **MapFlow 酒馆页面**：导航、导入、角色库、会话流和移动布局。
6. **观测与真实验收**：指标、第三方卡、五轮对话、TTL 回收恢复和浏览器点击测试。

每个切片单独保持可回归，不先搭空壳页面再补安全和账务。第一版完成前不扩展脚本、商城或游戏状态机。
