# 英语世界前后端与数据库设计方案

日期：2026-10-18。版本：评审稿 0.2，已补充六项审计问题对应的设计约束和待实现测试，见第 15 部分。本文落实已讨论的产品方向，不表示已经执行数据库迁移、引入依赖或发布功能。产品依据见[设计基线](2026-10-18-immersive-vocabulary-world-design.md)，参考项目见[调研记录](../research/2026-10-18-immersive-vocabulary-open-source.md)。

## 1 目标与第一版范围

新增“英语世界”独立区域，与学习聊天、独立酒馆同级。玩家用英文参与 AI 生成的剧本杀事件，NPC 每个话轮提供一次单词翻译机会；主持人按世界事实判断行动，死亡后解释原因，允许回档。玩家遇到的词进入自己的词库，复习安排与游戏存档分开保存。

第一版做通一个小型原创案件：生成、检查、保存、开始、自由英文行动、局部翻译、死亡复盘、回档、继续、个人词库与基础复习。题材可输入，不把教堂、警察或固定人物写成程序唯一支持的故事。先验证单人游玩；多人联机、角色商城、公共世界发布和完整考试测评不纳入第一版。

首版文本玩法必须可以独立运行。语音作为单独工作包保留数据与界面设计，只有关键对白真实生成并通过听读验收后才显示播放按钮；不将语音功能标成文本版已完成。

## 2 已核对的现状与设计选择

本次审计修订核对前端 `71b1d8cc9cd8c016bb1ee4bef8f85db4bec7fa17`、后端 `8614119c5ca35ac748cb654a2cf2f69f3feb8e5c`；固定入口检查通过。原稿依据分别为 `7a2faab4ebe0`、`06bfd1b54bc3`。三份已有研究与设计文档已备份并核对摘要，当前开发分支已快进包含此次核对的前端 main。方案读取的产品源码以 Git 已跟踪文件为准。

已读入口包括前端 `src/app/Application.tsx`、`src/app/routes.ts`、`src/ui/AppFrame.tsx`、`src/api/agentExecutionClient.ts`；后端迁移 0021、0022、0040、0046、0048、0049、0051、0053、0058，以及 `src/agent_execution/`、`harness-worker/src/harness.ts` 和执行协议。

本次另行核对了 Worker 的 chatSessions 复用、runChatTurn 的 finally checkpoint，以及后端 finalization 的 stage_completion/finalize_execution：原生执行历史会先于业务验收保存；现有聊天最终提交会在同一事务中保存回复、执行完成结果、结算状态和完成事件。英语世界必须明确区分原调用恢复资料与已确认角色记忆，并沿用统一业务提交边界，不能只依靠回档时清理会话。

现有聊天场景只有 tavern、learning、management。执行表直接关联 `tavern_conversations`，工具日志和完成结果也连接聊天图；现金消费明细写入 `wallet_tavern_charges`。因此不能只增加一个导航和提示词，就认为新业务已独立。新区域也不能绕开既有调用身份、停止恢复和费用证据机制另建临时收费循环。

| 可选方式 | 代价与结果 | 决定 |
| --- | --- | --- |
| 独立英语世界业务表，增加中性的执行归属，复用底层执行和结算 | 需要先调整共享基础；角色、秘密和存档可独立保存，旧聊天接口可保持兼容 | 推荐 |
| 在酒馆角色库创建隐藏主持人与角色，所有游戏伪装成聊天 | 初期较快，但角色列表、聊天历史、权限与图分支容易混入新业务，后续很难分离 | 不采用 |
| 复制一套 DSH、调用日志和计费 | 业务看似独立，但需要重新验证所有恢复、扣费与证据边界 | 不采用 |

## 3 名词与隔离范围

| 名词 | 本方案的含义 |
| --- | --- |
| 剧本世界 | 用户保存的一项内容，例如一件可反复游玩的案件 |
| 剧本版本 | 某次生成并验收后的真相、规则、人物和线索，开始游戏后不被主持人随意改写 |
| 游玩记录 | 某账号基于一个确定剧本版本的一次游戏，英文类型名 Playthrough |
| 分支 | 游玩记录中从某个存档点继续发展的路线，回档会新建分支 |
| 话轮 | 玩家的一次行动及其被确认的结果；开场也是一种话轮，但没有玩家输入 |
| 台词 | 话轮里一段可见旁白或某个人说的话，单词翻译预算按 NPC 台词记录 |
| 检查点 | 已完成话轮边界上的完整游戏状态，恢复时可重建角色记忆 |
| 工作会话 | 某次尝试使用的临时 DSH 历史，可恢复原调用；未确认内容不进入角色正式记忆 |
| 业务操作 | 一次客户端请求的持久身份，记录请求摘要和原结果；无需关联模型执行 |
| 复习题 | 服务端发出的、绑定词义和复习状态版本的一次作答机会，只能结算一次 |
| 单词出现记录 | 某句台词或玩家原文中一个具体词位置，可独立确定或纠正词义 |
| 角色 | 本世界中的人物，属于剧本版本；不是现有私人角色库中的角色卡 |
| 执行上下文 | 给一次 AI 会话标明账号和业务归属的记录，不等于一个游戏存档 |
| 学习记录 | 账号在各次尝试中真正遇见、查询、使用与回忆词语的历史，回档不删除 |

| 范围 | 学习聊天 | 独立酒馆 | 英语世界 |
| --- | --- | --- | --- |
| 业务归属 | 账号与学习区 | 账号与酒馆会话 | 账号、剧本版本、游玩记录、分支、人物 |
| 人物来源 | 私人角色库及学习教师 | 私人角色库 | 剧本版本中的人物与专属 Agent 配置 |
| 可读资料 | 当前学习区授权的地图与资料 | 当前会话配置 | 当前剧本授权的事实和该角色知道的信息 |
| 可写对象 | 授权地图、笔记、画布与会话 | 酒馆会话与画布 | 当前剧本草稿或当前分支的候选结果 |
| 记忆与草稿 | 学习场景自己的记录 | 酒馆场景自己的记录 | 新的 `english-world` 命名空间 |
| 资金基础 | 复用平台规则 | 复用平台规则 | 同样复用，消费来源明确标为英语世界 |

英语世界 Agent 不调用学习区的地图、笔记和教学画布工具，也不读取酒馆历史。学习、酒馆与全局助手不直接读取未公开剧本真相。进程可以共用，角色记忆、工具权限和会话标识不能共用。

## 4 首版明确采用的默认规则

以下是供本方案评审的具体默认值，可在实现前统一调整，不是用户此前逐项指定的参数。

- 暂定区域名“英语世界”，路径前缀 `/english-world`，业务类型 `english_world`。
- NPC 一次返回的一段台词算一个话轮内的翻译单位，即使含多个句号，也只能选择一个词位置；旁白首版不提供额外翻译预算。短语与复合词首版按服务端切好的单词位置计算。
- 选择翻译前先显示确认；成功接受后不能换词。同一请求重试返回同一选择；模型或网络失败不直接创建新的选择。
- 只接受英文作为游戏回答。输入中文按世界预设作为语言异常交给裁决，输入法尚未提交的文字不触发世界事件。界面按钮和系统错误使用中文。
- 发生身份暴露等预设规则可以立即死亡；语法不标准、判断不明或服务出错，不直接推导为死亡。禁忌可以逐渐被玩家发现，但必须预先存在于剧本规则中。
- 每个已确认话轮保存检查点；回档新建分支并保留失败路线，不覆盖原记录。首版不允许在模型生成中途保存可恢复游戏点。
- 准备阶段最多两轮有依据的修订。模型调用结果未知时先核对原调用，不因为修订次数未用完就重发。每轮实际调用单独留存身份与费用依据。
- 游戏中不开放编辑历史、任意重新生成和“继续生成”旧聊天按钮；重试、回档和新行动分别使用明确业务操作。

## 5 前端页面与交互设计

沿用现有浅色、深色主题和基础按钮、抽屉、弹窗，主要内容表现为案件与线索，不另造一套账号、钱包或全局导航。

### 5.1 页面结构

| 页面与路径 | 主要内容 | 主要操作与必要状态 |
| --- | --- | --- |
| 区域首页 `/english-world` | 最近游玩、保存的世界、待复习概览，顶部“我的世界 / 我的词库 / 复习” | 继续、创建世界；空列表、加载、失败、只读历史状态 |
| 创建与准备 `/english-world/prepare/:taskId` | 题材、英语难度、词库范围、复习偏好、模型与资金；准备后显示真实阶段进度 | 创建前确认配置；已接受后刷新恢复同一任务；停止；可恢复时恢复；不会显示内部提示词或真相 |
| 世界详情 `/english-world/worlds/:worldId` | 不泄密的简介、难度、版本状态、已有游玩记录 | 开始、重玩同一版本、查看旧尝试；生成新版要明确为新准备任务，不覆盖旧版本 |
| 游玩 `/english-world/play/:playthroughId?branch=:branchId` | 当前地点与人物、英文叙事和台词、已公开线索、英文输入、单词帮助 | 点词、发送、存档、回档、离开；行动等待、异常可核对、死亡和完成状态 |
| 词库 `/english-world/words` | 已遇见、已查词、待复习、已掌握筛选；词义、原句与事件出处 | 搜索、打开词条、跳回有权查看的历史片段；不能打开未来分支或剧本真相 |
| 复习 `/english-world/review` | 到期词，阅读识别与主动表达分开；作答后再看释义 | 回忆、提交、评分或确认，显示下次复习；刷新不会重复评分 |

路由以新的 `EnglishWorldRoute` 类型解析，在现有 `resolveRoute` 内明确识别路径；不引入一套新的路由框架。账号、世界、游玩和分支 ID 从服务端重新验证，URL 中的分支不能自行成为活动分支。

### 5.2 桌面游玩布局

屏幕足够宽时分为三个阅读区域：左侧约 216px 显示本局记录与检查点；中间可伸缩区域显示场景与对话；右侧约 280px 显示已公开人物、地点、线索和物品。全站 224px 侧栏继续由 AppFrame 管理。业务内容宽度不足时先把左侧改成抽屉，再收起右侧，不能挤出横向滚动条。

中间顶部显示世界名、当前地点、分支名和离开入口。正文按人物标注说话者，旁白与台词视觉区分。只显示玩家有理由知道的处境，不暴露隐藏怀疑度、凶手标记或未发现线索。

点词后显示当前词位置与“本段还可翻译 1 个词”的确认；确认后仅展示该词在当前句子中的意思。预算用完仍能看到已查结果，其他词不再发翻译请求。输入区始终写明“用英文回答”，保留未发送草稿；不出现一键最优回复。

首版主持人输出先由服务端完整检查，再显示确认后的台词与后果。等待期间显示“正在判断本次行动”等真实进度，不将内部模型逐字输出直接推到前端，以免先泄露秘密或先宣布尚未生效的结果。

### 5.3 手机布局与入口

桌面全局导航新增“英语世界”，与学习、酒馆并列。当前 AppFrame 的手机底栏只取前四项，新入口不能仅追加到数组后就算完成。建议保留原四项，增加第五个“更多”，抽屉展示所有同级区域，包括酒馆和英语世界；选中状态在抽屉与页标题中一致。

手机游玩采用单列，人物与线索放入抽屉，存档入口留在顶部。输入固定在当前可视区域底部，跟随已有 visualViewport 处理；键盘出现时不遮挡发送按钮。按 320px、390px、1024px、1440px、两种主题与减少动画偏好验收。

### 5.4 死亡、复盘与回档

死亡后锁定继续发送，仍可浏览失败路线。复盘卡显示死亡事件、涉及的世界规则、上一句英文及翻译、玩家回答实际表达的意思，以及属于语言问题还是危险决定。没有语法错误就不编造错误。只解释此次相关事实，不自动揭晓整案。

操作为“从存档继续”“重玩这个世界”“查看本次词汇”。选择存档时显示地点、时间和已公开摘要，明确会创建新分支；当前有未结束任务时先停止或核对，不能仅切页面就回档。恢复成功后 URL、查询缓存和当前分支同时更新。

个人词库自动保存本段遇见的词，不等于全部释义立刻在严格局里可见。本局新词未获得的释义在正在游玩的挑战视图中隐藏；已查词、死亡复盘相关词及结束后的本段词汇可以解锁。此前已经学会或解锁的词不撤销。回档也不假装玩家没有看过解析。

## 6 数据库整体组织

建议完整范围新增 **28 张表**：3 张共享执行基础、6 张词库资料、3 张剧本内容、10 张准备与游玩记录（含业务操作）、5 张个人学习（含复习题和单词出现记录）、1 张语音资源。原稿 25 张基础上补充 ew_operations、ew_review_items、ew_word_occurrences 三张表，原有序号保留。语音表随语音工作包实施，文本版为其余 27 张。表按后述阶段落地，不一次性开放全部功能。

下文 PK（主键）是每条记录的唯一号码，FK（外键）是指向其他记录的号码，UQ 是不能重复的组合。普通 ID 使用 UUID，时间使用 TIMESTAMPTZ，次数与版本使用非负整数；金额继续使用整数微元或平台已有积分单位。JSONB 保存有固定格式的结构化资料，不接受客户端提交任意字段。

私人业务表均保存 `account_id`，并建立 `UQ(account_id, 主ID)`。关联私人记录时使用同时含 `account_id` 的复合外键，不能仅检查 UUID 存在。下表省略重复的创建、更新时间字段，实际迁移保留它们。

### 6.1 新增表总清单

| 序号 | 表名 | 保存的内容 | 主键与主要关联 |
| --- | --- | --- | --- |
| 01 | `agent_execution_contexts` | AI 执行的业务归属 | PK context_id；FK accounts；旧聊天可关联 conversation_id |
| 02 | `agent_execution_journal` | 新业务执行、工具和原调用的持久日志投影 | PK record_id；FK context、execution |
| 03 | `agent_usage_charges` | 新业务的已确认现金或积分消费明细 | PK execution_id；FK execution、context、钱包流水 |
| 04 | `ew_lexicon_sources` | 导入资源的来源、版本与许可 | PK source_id |
| 05 | `ew_lexemes` | 英语词元及词形 | PK lexeme_id |
| 06 | `ew_senses` | 一个词的具体义项、释义与来源 | PK sense_id；FK lexeme、source |
| 07 | `ew_relations` | 义项之间的真实或已审核关联 | PK relation_id；FK 两端 sense、source |
| 08 | `ew_word_packs` | 四级、日常等词库包及版本 | PK pack_id；FK source |
| 09 | `ew_word_pack_entries` | 词库包包含哪些词义 | PK pack_id、sense_id；FK pack、sense |
| 10 | `ew_worlds` | 用户保存的世界条目 | PK world_id；FK account，当前 ready 版本 |
| 11 | `ew_world_versions` | 有版本的剧本正文、真相、人物、地点、线索与规则 | PK world_version_id；FK account、world |
| 12 | `ew_world_targets` | 某剧本版本的目标词及其故事用途 | PK world_version_id、sense_id；FK version、sense |
| 13 | `ew_agent_tasks` | 选词、编剧、检查、主持等一次任务 | PK task_id；FK session、execution、版本与分支 |
| 14 | `ew_playthroughs` | 某账号在一个固定版本上的游玩记录 | PK playthrough_id；FK version、account、活动 branch |
| 15 | `ew_branches` | 本局的路线及回档来源 | PK branch_id；FK playthrough、父 branch、来源 checkpoint |
| 16 | `ew_turns` | 一次行动、确认结果和内部裁决 | PK turn_id；FK branch、前置 checkpoint、task |
| 17 | `ew_utterances` | 旁白或人物公开说出的台词及单词位置 | PK utterance_id；FK turn、playthrough |
| 18 | `ew_checkpoints` | 完成话轮后的游戏状态与历史位置 | PK checkpoint_id；FK branch、产生它的 turn |
| 19 | `ew_agent_sessions` | 本业务各角色的独立执行会话与权限身份 | PK agent_session_id；FK context、world；按用途绑定 branch |
| 20 | `ew_checkpoint_agent_states` | 检查点时各角色的可恢复记忆 | PK checkpoint_id、actor_key；FK checkpoint |
| 21 | `ew_translation_uses` | 哪个分支为哪段台词选择了哪个词 | PK translation_use_id；FK branch、utterance、task |
| 22 | `ew_learner_words` | 某账号实际遇见的个人词条 | PK learner_word_id；FK account，可关联 lexeme、sense |
| 23 | `ew_learning_events` | 接触、查词、使用、复盘和回忆证据 | PK learning_event_id；FK learner_word，必要时关联 turn、utterance |
| 24 | `ew_review_states` | 个人词条不同能力方向的 FSRS 状态 | PK learner_word_id、modality；FK learner_word |
| 25 | `ew_media_assets` | 真实生成的台词语音及来源信息 | PK asset_id；FK account、utterance；语音工作包新增 |
| 26 | `ew_operations` | 无须调用 AI 的请求也有持久身份和原结果 | PK operation_id；UQ account、client_action_id；可关联 task 与业务结果 |
| 27 | `ew_review_items` | 服务端签发、绑定具体复习版本的一道题及消费结果 | PK review_item_id；FK learner_word、review_state、consumed event |
| 28 | `ew_word_occurrences` | 每次实际出现的词位置、当前义项与归属修订 | PK occurrence_id；FK turn、utterance、learner_word、sense |

`ew_` 是本业务固定表前缀。NPC、地点、证物和规则首版放在剧本版本的结构化内容里，不各建一张几乎相同的表；它们必须有版本内稳定 ID，并由编剧保存服务检查引用。表关联用于账号、版本、执行、分支和词汇这些需要强约束的对象。全站跨世界人物检索不在首版范围，暂不为它拆分内容表。

### 6.2 共享执行基础字段与约束

**01 agent_execution_contexts**：`context_id`、`account_id`、`kind`、`conversation_id?`、`deleted_at?`。kind 只取 `conversation`、`english_world`。旧聊天 kind 必须有 conversation_id，英语世界必须为空。建立 UQ(account_id, conversation_id)，在数据库中保证一个旧会话只能对应一个 context；英语世界 conversation_id 为 NULL，使用 PostgreSQL 默认的 NULL 不相等语义，不限制这些新业务行的数量。另保留 UQ(account_id, context_id, kind) 和 UQ(account_id, conversation_id, context_id)，供复合 FK 使用。旧关联保留指向 `tavern_conversations(account_id, conversation_id)` 的 FK。

并发初始化旧会话时，按 UQ(account_id, conversation_id) 插入或读取同一 context，不覆盖已有 context_id；软删除也不释放这个映射。回填先检查重复与归属异常，冲突时停止迁移，不为解决冲突生成第二个 context。两个并发请求必须得到同一个 context_id，随后相同旧 action_id 仍只命中一次执行。

英语世界 context 与 `ew_agent_sessions` 一对一，二者同账号；同事务建立。接受任务时同时检查会话绑定存在、业务类型为 english_world、世界和分支仍有效。迁移中使用延迟约束检查，防止提交只有执行归属却没有业务拥有者的英语世界 context。

**02 agent_execution_journal**：`record_id`、`account_id`、`context_id`、`execution_id`、`kind`、`call_key?`、`payload_digest`、`payload`、`applied_at?`。UQ(execution_id, record_id)，索引未应用日志。只保存内部记录，不经普通用户 SSE 原样公开。沿用现有“先有持久日志，再投影数据库”的恢复能力，新业务使用 context 日志；旧聊天继续读取旧日志，不能仅新增数据库表就删除现有持久化保护。

**03 agent_usage_charges**：`execution_id`、`account_id`、`context_id`、`funding`、`cash_micros?`、`point_units?`、`exact_upstream_cost?`、`ledger_entry_id?`、`credit_source_kind?`、`credit_source_id?`。FK(account_id, context_id, execution_id) 指向共享执行；funding 取 cash 或 points，一次 execution 只入一条已确认业务消费。

现金行通过 FK(account_id, ledger_entry_id) 关联钱包流水，只填写已确认的 cash_micros，积分字段为空。积分行通过 FK(account_id, credit_source_kind, credit_source_id) 关联积分流水，来源固定为 english_world，source_id 为本 execution_id，只填写已确认的 point_units，现金字段为空。非零现金消费必须有钱包流水，确认无本站费用时可记录真实的零且不伪造流水。BYOK 不写成本站消费，未知费用不在此填零；原费用依据仍由共享 execution settlement 保存。金额、业务消费与真实流水在同一事务入账。

### 6.3 词库六张表

**04 ew_lexicon_sources**：source_id、name、upstream_url、upstream_version、license_code、attribution、content_digest、import_status。来源内容获准导入且抽检通过才为 ready，导入重复摘要复用同一批次。

**05 ew_lexemes**：lexeme_id、language、lemma、normalized_lemma、forms JSONB。UQ(language, normalized_lemma)，搜索使用标准化词形与索引。全球公共词元不保存玩家原句或世界秘密。

**06 ew_senses**：sense_id、lexeme_id、source_id、source_sense_key、part_of_speech、definition_en、gloss_zh?、examples JSONB、content_digest、status。UQ(source_id, source_sense_key)；通过 lexeme 的义项区分同形异义。新增来源版本生成新义项记录，不静默改写旧世界引用的释义。

**07 ew_relations**：relation_id、source_sense_id、target_sense_id、relation_type、source_id、evidence JSONB、weight?、status。词义、构词、用途、地点、原因、前提等关系按封闭类型保存。UQ(两个 sense、relation_type、source_id)；权重不冒充真实性概率。具体剧本的想象联结存到 world_targets 的用途计划，不回写成公共词典事实。

**08 ew_word_packs**：pack_id、source_id、name、language、version、status。UQ(name, language, version)。**09 ew_word_pack_entries**：pack_id、sense_id、rank?、tags JSONB。一个词义可以属于多个包，包是版本化词义集合，不是个人掌握列表。

### 6.4 剧本三张表

**10 ew_worlds**：world_id、account_id、create_operation_id、title、summary_public、current_ready_version_id?、archived_at?。UQ(account_id, world_id)、UQ(account_id, create_operation_id)；创建操作 FK 指向本账号 ew_operations。当前版本 FK 必须同时匹配账号、world_id。创建世界先允许当前版本为空，通过验收再更新指针。

**11 ew_world_versions**：world_version_id、account_id、world_id、generation_operation_id、version_no、status、schema_version、agent_contract_version、content_private JSONB、summary_public JSONB、validation_report_private JSONB、content_digest、sealed_at?。UQ(account_id, world_id, version_no)、UQ(account_id, generation_operation_id)；status 为 draft、validating、ready、rejected。ready 后内容不可更新，新增内容建立新版；开局只使用 ready 版本。

content_private 的固定结构包含 `play_preset`、`rules`、`truth`、`timeline`、`characters`、`locations`、`clues`、`events`、`ending_conditions`。play_preset 固定本版本的输入语言、帮助预算、异常与死亡策略；穿越者仅为首个预设，不成为引擎唯一玩法。每项有稳定 ID；characters 有身份、目标、秘密和初始知识；events 描述前提、后果与可见范围。后端校验 ID 唯一、引用存在、前提可表达、词义用途可对应。summary_public 由服务端白名单生成，不是把 private 对象删几个字段就返回。

规则至少包含 rule_id、适用角色、触发事实或条件、允许的状态变化、后果与公开时机。时间、物品、已知事实和语言字符标记等明确条件由程序核验；语言含义、动机与推理仍依赖模型判断，保留原文、依据和检查结果，不宣称结构校验就能保证 AI 永不误判。不能解释的候选进入修订或暂停，不凭缺少证据执行死亡。

**12 ew_world_targets**：account_id、world_version_id、sense_id、priority、purpose、planned_appearances JSONB、actual_validation JSONB。FK 指向相同账号版本和已批准 sense；同一个词可进入多个世界。计划记录谁在什么情境为何使用这个词，允许修订时退回重选，不强行堆词。

### 6.5 准备与游玩九张主表

**13 ew_agent_tasks**：task_id、account_id、context_id、operation_id?、world_id、world_version_id?、playthrough_id?、branch_id?、turn_id?、agent_session_id、role、step_key、repair_round、attempt_id、base_checkpoint_id?、base_state_digest、captured_session_epoch、status、input_digest、input_refs_private JSONB、result_private JSONB、execution_id?、parent_task_id?、policy_version、last_failure_code?、commit_id?、applied_at?、applied_result_kind?、applied_result_ref?、committed_result_digest?。status 取 queued、running、validating、completed、blocked、failed、stopped；模型执行状态另存，不与任务混为一套枚举。UQ(agent_session_id, step_key, repair_round)，step_key 含准备阶段或具体 turn/action 的稳定标识，execution_id 非空时唯一。参与同一行动的主持与 NPC 任务通过 turn_id 和父任务明确关联，不能只从提示词猜测受影响的角色集合。

FK(account_id, agent_session_id, context_id) 绑定专属会话；execution 非空时，FK(account_id, context_id, execution_id) 绑定共享执行。可运行的模型任务与 execution 在同一事务建立，role 和世界、分支必须与 session 一致；纯程序检查可不创建模型执行。跨世界或跨分支 task 的父任务引用拒绝。

attempt_id 唯一绑定本任务尝试及原 execution；不可因为网络重试换号再调用。commit_id 非空时唯一，applied_at、结果类型、引用和摘要必须同时存在且提交后不可改。任务行保存持久提交回执；正式应用话轮时，task、turn、共享 execution.result 和完成事件记录相同 commit_id。NPC 等子任务的成果可以只是受限私有候选，任务完成不等于剧情已生效；只有最终话轮提交才更新正式游戏记忆。

**14 ew_playthroughs**：playthrough_id、account_id、start_operation_id、world_id、world_version_id、active_branch_id?、status。UQ(account_id, start_operation_id)，固定版本开局后不可换版本；status 为 active、completed、archived，具体分支死亡保存在 branch，不把整个世界删除。活动分支 FK 同时含 account、playthrough。先插入本局、根分支，再写活动指针。

**15 ew_branches**：branch_id、account_id、playthrough_id、restore_operation_id?、parent_branch_id?、fork_checkpoint_id?、revision、status、head_checkpoint_id?、current_state_private JSONB、public_state JSONB。非空 restore_operation_id 建 UQ(account_id, restore_operation_id)，根分支为空，回档分支必须关联本账号 ew_operations。status 为 active、dead、completed、abandoned；只有本局活动分支可接新行动。父分支与来源检查点同时为空或同时存在，来源点必须属于该父分支和同一游玩记录；revision 单调增加。

**16 ew_turns**：turn_id、account_id、playthrough_id、branch_id、operation_id、sequence、kind、client_action_id、request_digest、expected_revision、before_checkpoint_id、applied_checkpoint_id?、commit_id?、player_text?、language_flags JSONB、status、host_task_id?、adjudication_private JSONB、death_debrief_public?。kind 为 opening 或 player_action；普通行动必须有玩家文本，开场允许为空。UQ(branch_id, sequence)、UQ(account_id, branch_id, client_action_id)、UQ(account_id, operation_id)，非空 host_task_id 和 commit_id 分别唯一。status=applied 必须同时有 checkpoint、host task 提交回执及 commit_id，最终事务统一填写；同 ID 不同内容返回冲突，不能变成另一次行动。

**17 ew_utterances**：utterance_id、account_id、playthrough_id、branch_id、turn_id、ordinal、speaker_kind、actor_key?、text_en、tokens JSONB、tokenizer_version、public_metadata JSONB。UQ(turn_id, ordinal)。tokens 给出稳定 token_id、原文位置、标准化词形和内部词义引用；公开响应不包含未解锁释义。actor_key 必须在本局固定版本中存在。旁白使用 speaker_kind=narrator，人物用 npc；两者都只保存玩家可见文字。

**18 ew_checkpoints**：checkpoint_id、account_id、playthrough_id、branch_id、after_sequence、produced_by_turn_id?、schema_version、world_version_digest、state_private JSONB、public_history_cursor JSONB、translation_budget_state JSONB、state_digest。UQ(branch_id, after_sequence)。初始点 after_sequence=0，其他点指向已应用话轮。保存世界状态、时间、物品、角色所知、已见线索及祖先分支历史截止位置，不仅保存聊天文本。

**19 ew_agent_sessions**：agent_session_id、account_id、context_id、context_kind=english_world、world_id、world_version_id?、playthrough_id?、branch_id?、scope_kind、role、actor_key、session_epoch、accepted_checkpoint_id?、accepted_state_digest、memory_state、prompt_version、tool_policy_version。memory_state 为 clean 或 rebuild_required；它描述逻辑角色会话，不将某份原生 DSH 历史自动视为正式记忆。准备会话只有 world/version 绑定；游玩会话必须有本局和分支；复盘、翻译仍绑定对应分支。UQ(account_id, context_id)、UQ(account_id, agent_session_id, context_id)，context 的复合 FK 同时匹配账号和 kind。按世界或分支、role、actor_key 建业务唯一约束，准备会话还包含版本范围以区分不同版本任务。actor_key 使用保留角色名或 npc:<人物ID>，避免主持人与人物编号碰撞。它不引用 tavern_characters。

**20 ew_checkpoint_agent_states**：checkpoint_id、account_id、actor_key、role、prompt_version、accepted_history JSONB、memory_private JSONB、summary_private、state_digest。每个角色在一个检查点只有一份记录，FK 通过 account_id 指向 checkpoint。保存的是已确认的角色可知历史和记忆；恢复时建立新分支的新 session，不带走未来原生执行、未知调用或旧费用状态。

**21 ew_translation_uses**：translation_use_id、account_id、playthrough_id、branch_id、operation_id、utterance_id、selected_token_id、client_action_id、request_digest、status、gloss_zh?、sense_id?、task_id?。UQ(account_id, branch_id, utterance_id)，即每段 NPC 台词一次选择；另有 UQ(account_id, operation_id)。台词可能来自该分支可见的祖先历史，所以 FK 匹配同账号同本局，后端再核实历史可见范围。status 为 reserved、ready、failed、outcome_unknown；不确定状态不允许改选另一个词。

### 6.6 个人学习三张主表

**22 ew_learner_words**：learner_word_id、account_id、lexeme_id?、sense_id?、normalized_lemma、meaning_key、first_seen_at、last_seen_at、first_event_id?、gloss_unlocked_at?、status。UQ(account_id, normalized_lemma, meaning_key)；已确定义项用 sense_id 派生稳定 meaning_key，未确定用 `unresolved:<occurrence_id>`，不将同形词的所有未知用法放入同一个桶。未知词可以先入个人库，不能把私有名字、原句或未审查释义自动放进公共词库。具体出现的重新归属、拆分和复习处理见第 6.8、9.6 部分。

**23 ew_learning_events**：learning_event_id、account_id、learner_word_id、occurrence_id?、review_item_id?、playthrough_id?、branch_id?、turn_id?、utterance_id?、event_kind、source_action_id、evidence_key、modality、assistance JSONB、evidence JSONB、rating?、occurred_at。event_kind 包括 exposure、lookup、production、debrief、recall、sense_assignment、evidence_correction。UQ(account_id, source_action_id, event_kind, evidence_key)，evidence_key 按 occurrence 或 review item 生成；recall 必须有 review_item_id，仅对 event_kind=recall 建部分 UQ(account_id, review_item_id)，一题最多一条回忆结算事件，后续更正事件可引用原题但不重新结算。

learner_word_id 记录事件发生时的归属，历史不改写；当前词义归属通过 occurrence 及后续修订事件解释。recall 的 evidence 固定保存题目标识、原作答、提示使用、评分依据、复习前后状态、算法与参数版本。历史列表刷新不是新曝光；请求重放不重复记录。主动回档后的新尝试记录新的经历，并标明此前已看过提示或解析。

**24 ew_review_states**：account_id、learner_word_id、modality、algorithm、algorithm_version、parameters_version、revision、evidence_revision、status、state_json JSONB、due_at、last_review_event_id?。status 为 ready 或 rebuilding；modality 首版为 reading、writing，listening 只有真实采集听力证据后启用。算法状态包含 FSRS 所需稳定度、难度、次数与时间，不把缺失能力填成 0 分；首次测试允许有 revision=0、无历史评分的初始状态。评分、题目消费、recall 事件与 state 更新同事务提交，锁 revision，按题目标识而非仅按客户端操作号去重。

为 due_at 建账号与能力方向的索引；个人词搜索建 account_id、normalized_lemma 索引。普通曝光、点词和剧情通关不自动生成 Good 评分。复习记录已经保存前后状态、算法和参数版本，因此不再重复建一张仅改名的复习日志表。

### 6.7 语音资源一张表

**25 ew_media_assets**：asset_id、account_id、utterance_id、kind、text_digest、voice_profile_version、provider_request_id?、status、storage_key?、mime_type?、duration_ms?、cost_evidence_private JSONB。kind 首版只允许 npc_tts；UQ(utterance_id, kind, voice_profile_version, text_digest)。生成服务凭据不入表；存储路径由服务端产生，音频读取先检查台词对玩家可见。费用不明保留未知，语音服务接入与模型文字调用分别验收。

### 6.8 业务操作、复习题与单词出现三张补充表

**26 ew_operations**：operation_id、account_id、client_action_id、operation_kind、scope_kind、scope_id、request_schema_version、request_digest、status、accepted_refs JSONB、result_refs JSONB、response_status、response_public JSONB、task_id?、created_at、completed_at?。PK operation_id，UQ(account_id, client_action_id)；操作号在本账号的整个英语世界业务内唯一。类型包含创建世界、生成新版、开局、行动、翻译、回档、签发题目、提交复习等；并不要求 execution_id。

scope 对应账号、世界、本局或具体题目；请求摘要涵盖操作类型、资源范围、客户端明确提交的参数、前置版本和模型选项。服务端自动选定的版本与配置在首次接受时冻结，重试不能根据当前默认值重算成另一个请求。status 为 accepted、completed、rejected；返回快照只含公开信息和稳定资源 ID，不存剧本秘密。操作记录的持久化、并发与结果重放见第 9.4 部分。

**27 ew_review_items**：review_item_id、account_id、learner_word_id、modality、expected_review_revision、expected_evidence_revision、target_sense_id、definition_digest、origin_occurrence_id?、origin_assignment_revision?、algorithm_version、parameters_version、question_schema_version、prompt_public JSONB、answer_key_private JSONB、status、expires_at、issued_at、consumed_operation_id?、consumed_event_id?、submission_digest?、result_public?。FK(account_id, learner_word_id, modality) 指向复习状态，revision 等字段为签发时快照。

题号由服务端产生，客户端不能替换目标词义、能力方向或期望状态版本。status 为 issued、consumed、expired、invalidated；每个 account、learner_word、modality、expected_review_revision 最多一条 issued 题，使用部分唯一索引。签发前在锁内处理过期题，consumed 必须同时有唯一 recall 事件、提交摘要与公开结算结果。两个标签页会复用尚有效的同一题，作答协议见第 9.5 部分。

**28 ew_word_occurrences**：occurrence_id、account_id、source_kind、source_anchor_id、turn_id、utterance_id?、token_id、tokenizer_version、surface、normalized_lemma、lexeme_id?、sense_id?、learner_word_id、assignment_revision、resolution_status、resolution_evidence_private JSONB、last_assignment_event_id?。source_kind 为 npc_utterance、narration 或 player_input，source_anchor_id 分别绑定实际台词或玩家输入所属 turn；用 FK 约束相同账号、本局与来源记录，并检查类型和非空来源列的对应关系。

UQ(account_id, source_kind, source_anchor_id, token_id) 保证同一个原文位置只有一个出现身份；页面刷新不新建，回档后新产生的台词使用自己的新身份。词形与原位置不可改，当前义项和 learner_word 允许按 assignment_revision 乐观锁修订。一次修订只接收明确的 occurrence_id 集合，同事务写 sense_assignment 事件并更新这些位置的归属；未选择的同形词经历保持不变。

## 7 表关联与跨表约束

| 父对象 | 子对象 | 数量关系及用途 |
| --- | --- | --- |
| accounts | worlds、playthroughs、learner_words、execution_contexts | 一对多，所有私人资料从账号开始检查 |
| lexemes | senses | 一词多个意思 |
| lexicon_sources | senses、relations、word_packs | 每项资料可追溯到具体来源与版本 |
| word_packs 与 senses | word_pack_entries | 多对多，一词可属于多个目标包 |
| worlds | world_versions | 一个世界多版内容，旧局固定引用旧版 |
| world_versions 与 senses | world_targets | 多对多，保存词在本剧本中的用途 |
| world_versions | playthroughs | 同一份生成内容可以开多局，不重复生成世界 |
| playthroughs | branches | 一局多条路线，活动指针只指本局分支 |
| branches | turns、checkpoints、agent_sessions | 各路线自己的行动、存档和角色会话 |
| turns | utterances | 一次行动结果可以含旁白和多个人物台词 |
| checkpoints | checkpoint_agent_states | 一个存档点保存多个角色各自的记忆 |
| utterances 与 branches | translation_uses | 同一段历史台词在不同路线有各自预算；回档复制截至存档的预算状态 |
| agent_sessions | agent_tasks、execution_contexts | 一个角色会话多次任务，对应唯一共享执行归属 |
| agent_tasks | agent_executions | 一个模型任务对应一次共享执行；执行内可能有多个原模型调用 |
| learner_words | learning_events、review_states | 多次经历，按能力方向保存当前复习状态 |
| ew_operations | world、version、playthrough、branch、turn、translation | 同一业务请求固定指向原资源或结果，回档操作无需 AI execution |
| review_states | review_items | 题目绑定某个词条、能力与状态版本；一次消费只产生一条 recall 事件 |
| utterances 或玩家输入 | word_occurrences | 每个实际词位置单独记录，重新确定义项时只调整选中的位置 |
| word_occurrences | learning_events、learner_words | 原始经历保持不变，当前归属可通过修订记录拆分或合并 |
| utterances | media_assets | 同台词可有不同版本声音，读取仍受历史可见范围限制 |

parent_branch 与 fork_checkpoint 的复合 FK 必须匹配同账号、同本局、父分支。检查点产生话轮、话轮前后检查点、活动分支、题目与消费事件的环形引用使用先建空指针再回填或可延迟 FK，同事务提交；不得关闭约束来插入数据。复合 FK 的被引用端必须有对应的完整 UQ 组合，实施迁移时逐项列出并验证，不能假定只含主 ID 的唯一约束可替代所有组合。

所有已交付的剧本版本、台词、检查点和学习事件按追加记录处理。删除世界首版采用归档，隐藏当前入口，不级联删除个人学习史、原调用依据或钱包账目。公共词库来源停用时保留旧义项供既有世界解释，停止新生成使用该来源。

## 8 现有表与共享执行如何变化

### 8.1 需要修改的现有表

| 表 | 变化 | 兼容要求 |
| --- | --- | --- |
| agent_executions | 增加 context_id、context_kind；原 conversation_id 对新业务可空；保留旧聊天关联 | 旧行回填为 conversation context；新增 UQ(account_id, context_id, execution_id) 与归属复合 FK，旧接口行为保持 |
| agent_execution_operations | 增加 context_id；主键改为 account_id、context_id、原 action_id；conversation_id 对新业务可空 | 原聊天同会话仍只有一个 context，原操作去重含义不变；保留旧三列关联，新增账号/context/execution 复合 FK |
| agent_context_references | 增加 context_id，conversation_id 对新业务可空；新增账号/context/execution 复合 FK，读取改为 context 授权 | 旧会话读取接口先验证 conversation context，世界 Agent 无权读取旧聊天资料 |
| credit_usage_ledger | source_kind 增加 english_world；增加 UQ(account_id, source_kind, source_id) 供消费明细关联 | 已有 knowledge_chat、tavern 行与原主键不变，不迁移金额 |
| wallet_ledger | 增加 UQ(account_id, entry_id)，供新消费明细用复合 FK 关联同账号流水 | 仅补充归属约束，不修改余额、旧流水和已有金额规则 |

agent_executions 同时以 CHECK 限定 conversation 类型必须有 conversation_id、english_world 类型必须为空；FK(account_id, context_id, context_kind) 对应执行归属，旧聊天额外以 FK(account_id, conversation_id, context_id) 保证两个指针确实指向同一会话。操作与上下文引用的旧 conversation FK 保留，世界行依靠新的非空 context FK 约束归属，不能因 nullable 旧列而失去账号检查。

继续复用 agent_model_calls、回执、用量、结果、tool identities、execution_events、execution_settlements 与管理员结算审阅；这些记录的权威身份仍是 execution_id 和原 call_id。新业务现金明细写 agent_usage_charges，不伪造 tavern generation 或 output_message_id，不写 wallet_tavern_charges。旧聊天结算路径仍按原表写入。

### 8.2 共享代码的边界

在现有执行模块内增加按 context_kind 分派的业务适配器，职责是接受校验、冻结输入、编译提示词和工具、验证结果、提交业务结果、产生公开投影。聊天适配器继续处理原聊天图，英语世界适配器处理本方案数据。队列、模型目录、凭据内存、原调用证据和结算规则共用。

内部完成类型按业务区分：聊天结果保持 CompletedAgentExecution 原含义；英语世界结果指向 task、turn 或世界版本，不能假造聊天消息来满足旧结构。英语世界适配器参与共享 finalization 的同一数据库事务，统一保存领域结果、任务完成回执、execution.result 和完成事件，禁止先提交剧情再另做任务收尾。

共享结算接收 execution 与中性的业务结果引用；证据齐备时在最终事务内入账，未齐备时保存 pending_evidence 并允许已确认业务结果完成。后续补证只更新原执行的结算、账本与消费明细，不再次提交剧情；核心公式与资金通路不另写一份。

旧 `/api/me/agent-executions` 和聊天执行端点只投影 conversation context，继续返回原有严格字段；英语世界从自己的 `/api/me/english-world/tasks` 读取状态。普通旧接口访问世界 execution 返回不可访问，不把私人编剧输出伪装成聊天 answer。管理员可通过新增英语世界任务页看必要状态，不扩散秘密到普通聊天详情。

### 8.3 迁移次序

先新增 context 与新日志/明细表，给所有旧会话建立 conversation context，再为执行、操作、上下文引用回填 context；核对行数、账号映射、操作唯一性和旧账目合计。约束验证通过后，由新版本同时写旧兼容字段和新 context 字段。旧聊天 API 的正文、SSE 和 control 形状不变。

执行层变更先在功能关闭时完成回归，再按依赖创建词库与英语世界业务表，最后开放入口。世界、任务、会话、分支、话轮、检查点之间的环形外键在涉及的表都建好后统一添加并验证；英语世界 context 必须有 session 拥有者的约束也在此时安装，完成前不接受新业务 context。个人学习表等关联对象齐备后迁移。以下工作包是功能开发顺序，不表示可以在被引用表不存在时先安装外键。

此次核对的最大迁移编号为 0062；可按 context、词库、剧本与游玩基础、学习、语音分组新增迁移，实施时再次核对最新编号，不能改写历史迁移。数据库不能回滚到丢掉已发生用户活动的旧快照。

## 9 后端模块与 API 设计

### 9.1 模块职责

新增 `src/english_world.rs` 与 `src/english_world/`，按 lexicon、preparation、worlds、playthroughs、turns、translation、checkpoints、operations、occurrences、learning、review、agent_policy、projection、store 拆分。HTTP 位于 `src/http/english_world/`。共享执行适配在 `src/agent_execution/domain.rs` 及聊天、英语世界适配器，避免在每个钱包函数里反复判断故事类型。

| API（供页面请求服务的入口） | 作用与返回边界 |
| --- | --- |
| GET /api/me/english-world/worlds | 本账号的世界列表，只含公开摘要与版本状态 |
| POST /api/me/english-world/worlds | clientActionId 与创建配置；同事务保存操作、世界、版本及准备任务，返回原 worldId 与 taskId |
| GET /api/me/english-world/worlds/:id | 公开简介、可玩版本、本人尝试，不返回 content_private |
| POST /api/me/english-world/worlds/:id/versions | clientActionId 与配置；明确生成新版，重复请求找到原版本，不能覆盖正在玩的版本 |
| POST /api/me/english-world/worlds/:id/playthroughs | clientActionId、指定 ready 版本；操作、游玩、根分支和初始检查点同事务创建 |
| GET /api/me/english-world/playthroughs/:id | 本局公开状态、活动分支及允许操作 |
| GET /api/me/english-world/playthroughs/:id/history | 根据可见分支祖先与截止位置分页读取已确认台词 |
| POST /api/me/english-world/playthroughs/:id/turns | clientActionId、branchId、expectedRevision、英文文本；返回 turnId 与任务状态 |
| POST /api/me/english-world/playthroughs/:id/translations | branchId、utteranceId、tokenId、clientActionId；返回同一词的翻译状态与结果 |
| GET /api/me/english-world/playthroughs/:id/checkpoints | 可恢复检查点的公开摘要 |
| POST /api/me/english-world/playthroughs/:id/restores | checkpointId、expectedBranchId、expectedRevision、clientActionId；成功返回新 branchId |
| GET /api/me/english-world/playthroughs/:id/debrief | 仅允许已死亡或完成的对应分支查看必要复盘 |
| GET /api/me/english-world/tasks/:id | 过滤后的任务状态、阶段、允许操作和业务结果引用 |
| GET /api/me/english-world/tasks/:id/events | 断线可续读的公开进度事件，不原样发送共享内部日志 |
| POST /api/me/english-world/tasks/:id/stop 或 resume | 沿用原调用身份及恢复资格；缺 Key 才请求原 Key，未知调用不重发 |
| GET /api/me/english-world/words 与 /words/:id | 本账号词库和可见历史；严格局中的未解锁释义过滤 |
| GET /api/me/english-world/reviews/due | 到期候选与能力方向，只读取，不创建新题或提前附答案 |
| POST /api/me/english-world/reviews/items | clientActionId、词条和能力方向；签发或复用服务端题号，绑定复习版本，返回不含答案的题面 |
| POST /api/me/english-world/reviews | reviewItemId、作答、提示情况和 clientActionId；原子消费题目、写事件和更新复习状态 |

现有账号会话、CSRF、模型目录和钱包接口复用。所有新接口 no-store，错误使用封闭原因码；非本人资源返回不可访问，不泄露资源是否存在。

### 9.2 状态与公开信息

准备阶段为 selecting、writing、validating、ready，失败分别标 stopped、blocked 或 failed；只允许程序变更阶段。任务、模型执行和游戏存活是三种状态，模型调用失败不能写成玩家死亡。

公开任务响应包含版本、taskId、stage、state、progress、allowedActions、publicResultRef、publicError；不包含提示词、选词秘密用途、全量剧本、人物私密记忆、原上游 body 或 Key。公开事件仅允许阶段变化、进度、确认的话轮、结算摘要与终态。主体验证秘密不出现在初始 HTML、网络响应、前端缓存、错误或日志展示里。

### 9.3 一次行动的提交与崩溃恢复

接受行动先执行第 9.4 部分的操作查重，再检查账号、context、ready 剧本版本、活动分支、revision 和前置检查点。同事务登记操作、唯一 turn、任务、冻结的输入与原 execution 身份。不同操作并发执行时，最终仍只能有符合分支前置 revision 的一个结果生效。

模型在事务外使用临时工作会话运行，读取冻结的世界版本和前置状态。它提交候选台词、引用的事实与规则、状态变化、存活结果及公开范围。后端检查引用、角色可知范围与当前分支版本；结果不合格进入有限修订或失败，同时隔离受影响工作会话。合格候选以不可变摘要和 commit_id 进入领域专属 staged_completion；阶段持久化成功后不再为该原 execution 重新生成候选。

最终提交统一通过共享 finalization，由领域适配器使用同一 SQLx/PostgreSQL 事务。锁顺序在行动、停止和回档间保持一致，先锁账号与本局，再锁分支、execution、任务和相关角色；检查 lease、fence（阻止旧执行覆盖新结果的代号）、attempt、session epoch、前置检查点与 revision。一个事务内完成：

1. 将 turn 标为 applied，保存确认台词、裁决和新检查点，填写相同 commit_id。
2. 更新分支状态、revision、活动指针和各角色的已确认记忆，保存逐次词位置与学习事件。
3. 写入 task 的完成结果及持久提交回执；完成该次业务操作的结果映射。
4. 将共享 execution 标为 succeeded，保存带同一 commit_id、task/turn/checkpoint 引用的类型化 result，释放租约。
5. 写入唯一的持久 completed 事件；调用原结算模块得到已入账或 pending_evidence 状态，保存在同一结果中。

上述事务不执行网络请求。任何一步失败全部回滚，不能出现“剧情已生效但执行还没完成”的已提交中间态。正式角色记忆同样只能在这里推进，原生 DSH checkpoint 不是提交凭据。回复发送与 SSE 推送在提交后读取持久结果，通知失败不改变业务状态。

| 崩溃或断线位置 | 恢复行为 | 必须保持的结果 |
| --- | --- | --- |
| 候选尚未持久化 | 按原调用与原执行 checkpoint 核对；未知调用不自动重发 | 不凭残留文字认定已获得物品或死亡 |
| staged_completion 已保存，最终事务未开始 | 原 execution 重新取得合法租约后，仅用原候选继续 finalization | 不再调用模型；候选失去前置条件则记录冲突并隔离会话 |
| 最终事务任何语句后、COMMIT 前 | 数据库回滚全部更改，再按原 stage 重试最终事务 | turn、记忆、任务、执行与完成事件都没有半份提交 |
| COMMIT 成功但确认或 HTTP 响应丢失 | 先读 execution.result 与 task/turn 的相同 commit_id，重放原结果 | 不再检查已被自己推进的旧 revision，不再推进、发物品或扣费 |
| 提交后 SSE 未送达或费用仍缺证据 | 续读原 completed 事件；原执行独立核账 | 不重建剧情，不改变角色记忆；只补原结算状态 |

若读取到 task、turn 与 execution 的提交标识不一致，标记内部一致性故障并停止该任务推进，不据原生历史猜测应补哪一半。NPC 私有候选、翻译、复盘及准备阶段成果也通过领域最终事务保存任务结果与 execution 完成状态；候选成果被保存不等于它已进入某个游戏检查点。

停止与最终提交争用同一锁和状态条件：停止先提交时禁止后续业务应用，并隔离工作记忆；最终提交先成功时停止返回已完成结果，不撤销已确认剧情。可信迟到用量和费用继续归原执行收尾。

### 9.4 所有业务操作的持久去重

创建世界、生成新版、开局、回档、行动、翻译和复习相关 POST 均要求 clientActionId，首次接受后前端保存它，断线重试沿用原号。登录与账号授权先检查，随后按 UQ(account_id, client_action_id) 查询或原子占用 ew_operations；这一步必须早于活动分支、当前版本和 revision 检查。

同号同摘要返回原 response_public、HTTP 接受结果与资源引用；任务是否后来完成，通过原 task/turn 查询。请求类型、范围或内容不同则返回 operation_conflict，不把旧号当新请求。同号并发插入由数据库唯一约束和行锁串行化，后到请求等事务结束，得到原结果或明确未接受状态。服务端自动配置按首次接受快照解释，不能因默认模型变化而重新生成世界。

纯数据库操作在一个事务内保存操作与结果：创建世界关联原 world/version/task，开局关联原 playthrough/根分支/初始点，回档关联原 checkpoint 和新 branch，并更新活动指针。回档响应丢失后，即使当前活动分支已变化，原号重试仍返回原新 branchId；只有尚无该操作记录的新请求才检查 expectedBranchId 和 expectedRevision。

异步行动先同事务保存 accepted 操作、turn/task/execution 绑定与接受响应，Worker 只能领取已提交的任务。确定拒绝可保存 rejected 结果；事务提交前没有成功占用操作的请求不触发模型。操作结果快照不因重放改写，资源归档也不删除操作身份；首版不按短期 TTL 清理这些记录。ew_operations 负责客户端意图，agent_execution_operations 继续负责共享执行操作，不能用后者强行给纯回档建立虚假模型执行。

### 9.5 复习题只能结算一次

到期列表 GET 不签发题目。用户开始作答时，POST 签发接口先检查操作身份，再锁对应 review_state，处理过期题，返回现有有效题或创建一个 ew_review_items。题目绑定账号、词条、确定义项、reading/writing 方向、review revision、evidence revision、算法及参数版本；使用剧情原句的题还绑定 occurrence 与 assignment revision。答案留在服务端。

提交时先按第 9.4 部分处理请求重放，再以固定顺序锁复习状态和题目。锁内先判断是否 consumed：换新 clientActionId 提交相同作答，按不含操作号的 submission_digest 返回原结果，新操作只引用原消费记录；内容不同返回 review_item_consumed，不再评分。已消费题的原结果重放先于当前 revision 与过期检查，避免被它自己推进的状态版本误挡。

只有仍为 issued 的题才重新核验目标绑定、状态版本和到期时间。一个事务同时记录作答摘要、生成唯一 recall 事件、消费该题、保存公开评分结果、更新 FSRS 状态并令 revision 加一，最后完成业务操作。评分或状态写入失败，则题目消费一并回滚。旧版本、过期、被纠正词义影响或正在 rebuilding 的未答题返回明确失效原因，不更新 FSRS。两个标签页即使拿到不同请求号，也只能消费同一题一次；同版本 issued 唯一约束和状态 revision 检查共同防止多题重复推进。

### 9.6 按具体出现位置确定、拆分与纠正词义

每个可学习的原文位置先建立稳定 occurrence。未确定词义只关联自己的 `unresolved:<occurrence_id>` 临时词条，不开启 FSRS 评分；界面可按词形归组展示，底层不合并不同位置的语义证据。判定义项时提交明确的 occurrence_id、期望 assignment_revision 和依据，锁这些位置及相关词条后重新归属，并追加 sense_assignment 事件；其他位置、原句与历史事件不改写。

例如同一天分别读到 bank 表示银行和河岸，两处先有两个临时身份。确认第一处为银行，只把第一处的当前归属移到“bank/银行”；第二处继续未确定。之后确定河岸，连接“bank/河岸”。已经错误归为银行的一部分位置也可以单独拆出，不能按 normalized_lemma 整批搬迁。统计当前词义经历时通过 occurrence 的现行归属关联，同事务重算相关词条的首末出现时间等汇总；原事件的历史归属作为修订依据保留。

未确定词义的曝光不产生掌握分数，因此确认义项时只带入对应出现及查词等经历。已有 FSRS 状态按确定义项和能力方向独立保存，不复制、平均或按曝光次数分摊到新义项。若纠正影响了已评分题的语境义项，先追加 evidence_correction 标记受影响回忆的适用性，同事务使相关状态 revision/evidence_revision 增加、置 rebuilding，并作废未答题。

重建只使用对该词义仍有效、可明确归属的 recall，按原发生时间和已记录的算法/参数版本重放；含混证据保留但不转成另一个意思的成功回忆。没有有效 recall 的新义项从未评估状态开始。重建完成后按期望 revision 提交新状态再开放出题；旧 consumed 题保持已消费，不能因证据更正再次作答结算。

## 10 Agent 层设计

主流程仍是选词、编剧、主持。检查、词义帮助和复盘是按需任务，不要求采购不同模型，也不让所有 NPC 每轮持续运行。

| 角色 | 能读什么 | 能交什么成果 | 明确禁止 |
| --- | --- | --- | --- |
| selector 选词 | 获准公共词库、关联、账号复习候选与难度 | 词义 ID、关联理由、情景用途 | 旧聊天、学习资料、修改个人掌握分数 |
| writer 编剧 | 选词计划、用户题材、当前世界草稿 | 完整剧本草稿与词语用途 | 修改 ready 版本、替玩家输入、直接开局 |
| validator 检查 | 完整草稿与词义、已定义规则 | 结构和内容问题、通过报告 | 自己宣布付费成功、跳过程序校验 |
| host 主持 | 全部已封存真相、本分支状态与玩家行动 | 候选事件、判定依据、NPC 激活请求 | 更换凶手、补造历史、直接扣费或改表 |
| npc 角色 | 本人身份、目标、记忆、当前可见证据 | 该角色台词、可尝试行动 | 全量真相、其他角色私密资料、其他分支未来 |
| glossary 词义帮助 | 已选 token 与当前公开台词，获准词义候选 | 一个词在此处的释义 | 整句翻译、最优回答、额外词语帮助 |
| debriefer 复盘 | 此次已确认裁决、相关台词、必要事实 | 死因、上一句翻译、表达解释 | 自动揭整案、重写旧结果、用推测制造语法错误 |

所有角色的工具清单由后端按用途组装并再次授权，模型返回的角色名、worldId 或工具参数不授予权限。写入工具只允许提交候选或本任务的草稿，最终提交由领域服务负责。

提示词、输出格式、工具版本在接受任务时冻结。建议新增 Worker 模块 `harness-worker/src/english-world/` 保存角色合同、提示词和输出格式，复用现有 HarnessRunner 的执行机制。后端生成 sessionKey，至少包含业务前缀、account、context、branch、role、actor 和 epoch；不能让客户端指定完整 sessionKey 或 systemPrompt。

运行顺序由后端准备服务与行动服务控制。DSH 单次执行中仍能按工具调用推进工作，但阶段完成须有服务端接收的合格成果，不能凭模型一句“我做完了”跳到主持。准备、主持、NPC、翻译和复盘用独立 context；普通角色永远不复用主持人的会话。

### 10.1 未提交尝试的记忆隔离与重建

本业务始终维护两种资料：检查点及已验收阶段成果是正式输入；原生 DSH 事件是原 execution 的恢复与审计资料。后者可以包含“获得钥匙”等未获批准的文字，不能直接接到下一次正式角色对话。后端拒绝业务输出并不会自动从 DSH 历史删除这些文字，不能依赖这个不存在的副作用。

每次尝试使用独立工作 sessionKey，在原有业务、账号、角色、branch、epoch 后加入 task/attempt 身份。开新尝试时，从最后已确认检查点的该角色视图和明确授权输入创建新工作会话；准备阶段尚无游戏检查点时，从最后已验收阶段成果创建。即使上次成功，也按已确认结构化记忆生成下一次输入，不把整个原生历史当正式记忆追加。

同一原 execution 断线恢复时，可以恢复它自己的工作历史、原调用身份和执行边界，不能改成新用户话轮；outcome_unknown 继续遵守原调用核对规则。它获得业务提交资格仍须经过完整验收和第 9.3 部分的事务检查。

验收失败、主动停止、前置 revision/epoch 冲突、权限拒绝或未提交尝试终止后，必须将参与该 turn 的受影响逻辑会话标为 rebuild_required 并推进 session_epoch；已完成私有候选但没有被最终话轮采用的 NPC 同样处理。失败或停止的终态记录、标脏与 epoch 推进在同一数据库事务中完成；事务中断则整体回滚。崩溃后尚无终态的尝试由恢复扫描器核对原调用并完成相同处理，未确认调用不得换号重发。下一次可运行任务前，从当下最后已确认检查点恢复这些角色，核对摘要，再标为 clean；新的 attempt key 及正式输入白名单始终禁止接续旧尝试的工作历史。

标脏与 epoch 推进按原 task/attempt 幂等执行，并比较 captured_session_epoch 与 accepted_checkpoint_id；同一失败尝试重放不重复推进 epoch。若该逻辑角色已进入新的正式检查点或新 epoch，只隔离旧尝试，不回退当前记忆指针，也不把后来合法任务误标为旧尝试的一部分。

Worker 可释放旧工作会话，但安全性不能依赖 reset 成功。旧 finally checkpoint、迟到工具结果和原生会话缓存仅写回原 execution 的隔离记录；task/attempt、branch、epoch、revision 与 fence 不匹配时不能更新正式记忆指针。有限修订使用新尝试、相同正式基线及明确列出的缺陷；需要审阅旧候选时，把它作为有来源的待检查资料传入，不能偷偷恢复整段失败角色记忆。

原调用、拒绝原因、候选文本、原生恢复资料与实际费用依据按原执行保留。重建角色记忆不删除审计，不撤销已发生的调用，不伪造未收费。只有已提交话轮的授权事实与台词进入新检查点，各 NPC 仍只获得自己可知的部分。

## 11 回档、缓存与学习的具体行为

恢复先查 ew_operations；同号同请求返回原新分支，命中重放时不重新校验旧活动指针。新操作才验证检查点属于本账号同一游玩、同一剧本版本，且当前无可写任务；活动任务先停止或核对。一个事务保存操作结果并新建 branch，父分支指向检查点所属路线，复制该点世界状态和角色已确认记忆，建立新的 agent_sessions/context，将翻译使用恢复到该点的预算状态；原分支保持不可改历史。活动指针同事务切到新分支，原路线若尚为 active 则改为 abandoned，已死亡或完成的状态保留。

历史台词可以继续引用原 ID，但读取严格按祖先分支的截止位置。回档后的警察看不到另一条失败路线中的供词。原执行的迟到输出因 branch、revision 与 fence 不符不能写新分支；其费用和用量只补原执行。

学习事件、已解锁释义、复习状态和消费不恢复到旧值。新尝试可以记录新的学习行为，明确此前是否见过解析；重复渲染与网络重放不累计次数。待复习词只影响表达和可选事件的优先级，不能推翻案件真相来强塞词。

复用缓存须至少匹配剧本摘要、前置状态摘要、角色可知资料摘要、提示词/工具版本和相同输入；不能仅按玩家文本查缓存。命中已确认结果可以不发新模型调用，但仍建立本次业务行动及来源关联；不重复复制原扣费。不假定模型或外部服务可以靠相同随机种子完全重现。

## 12 实施工作包与验证方式

本方案是设计评审稿，下面给出交付顺序和验证边界，未执行任何产品改动。每个工作包开始前先写能复现缺失行为的测试，确认失败，再实现、跑绿和整理；纯样式按项目豁免处理。

| 包 | 交付与主要文件范围 | 必须验证的行为 |
| --- | --- | --- |
| A 执行归属与兼容 | 后端新增 context/journal/charges 迁移；`src/agent_execution/domain.rs`、现有 store/runner/bridge/finalization/settlement/public_view；对应 Worker 协议 | 旧接口严格字段保持；同账号跨 context 被拒；旧会话并发初始化得到同一 context；旧请求重放；现金/积分/BYOK、停止后证据收尾与最新 BYOK 解锁回归 |
| B 总词库与个人词库 | 新增词库、学习、word-occurrence、review-item 表；`src/english_world/lexicon.rs`、occurrences.rs、learning.rs、review.rs；固定 Rust FSRS 实现与参数版本 | 来源与重复导入、bank 银行/河岸逐位置分流与纠错拆分、原事件保留、FSRS 不复制分摊、单题换请求号仍只结算一次、跨标签页并发与旧题失效 |
| C 世界准备 | world/version/targets/tasks/sessions/operations；preparation.rs、operations.rs、agent_policy.rs、Worker 专属合同 | 选词后才编剧，检查后才 ready；无效引用、有限修订、失败记忆重建、取消刷新恢复、原调用未知不重发；创建/新版重试不多造世界或任务；ready 内容不可改 |
| D 游玩与回档 | playthrough/branch/turn/utterance/checkpoint/agent-state/translation；领域 finalization、turns.rs、checkpoints.rs、translation.rs | 英文回答、中文规则、翻译预算、并发行动、死亡复盘；拒绝/停止/冲突后所有参与角色忘掉未提交事实；事务各写入点与提交后断线的故障注入；回档响应丢失重试仍返回原 branch；学习与账目不回滚 |
| E 前端区域 | `src/pages/EnglishWorldPage.tsx`、`src/domains/englishWorld/`、`src/api/englishWorldClient.ts`、`src/ui/englishWorld/`；修改 Application、routes、AppFrame | 独立入口、角色库与缓存隔离、空/错/等待/死亡状态、断网恢复、手机更多入口、键盘与两主题；公共响应无剧透字段 |
| F 整体试玩与开关 | 领域开关、隔离数据库、真实前后端与真实 Worker，模型仅在 HTTP 边界使用可控替身 | 生成可玩的案本、至少两条合理选择与一条违规路径、死亡解释、回档再玩、全量词汇出处追踪，旧三区功能不变 |
| G 关键对白语音 | 媒体表、语音适配、音频读取与播放 UI | 文本音频一致、重复生成去重、跨账号不可读取、真实声音与费用证据；独立听力回忆，不把文字正确当听懂 |

前端完成后运行 `npm test`、`npm run typecheck`、`npm run build` 及工作区检查器测试；后端运行完整 `cargo test`、`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`；Worker 运行 `npm test`、`npm run typecheck`、`npm run build`。数据库测试必须使用隔离实例，不能对生产库或用户已有游玩数据执行测试迁移。

先保存旧 API 响应和已知旧客户端作为兼容测试，验证旧前端/新后端与新前端/旧后端：功能未开放时明确不可用，不创建半成品游戏或放松解析。迁移后核对旧行数量、原账目与未完成执行身份。真实模型质量另做经授权、有费用记录的样本试玩；替身测试通过不能冒充真实剧情生成质量通过。

## 13 必须通过的整体验收

1. 账号 A 的世界、词库、分支、音频和任务，账号 B 通过替换 ID 也不能读取或修改。
2. 游戏 context 不能调用地图、画布、学习资料或酒馆历史；旧三区也不能读取游戏秘密。
3. 一次行动提交两遍、点词两次、重复收回执、断线重连，都不重复推进、翻译或扣费。
4. 主持人与 NPC 的提示词、工具结果、私密词义和未来事实不在公开页面、网络响应和浏览器缓存中出现。
5. 任意一次死亡都能引用已保存的规则与事实；上游失败、无效输出或无法判断不是死亡。
6. 回档恢复世界时间、线索、物品、角色记忆和翻译预算；旧未来不能影响新路线，原费用与个人学习史保留。
7. 同一 ready 世界可以多次开局，旧局仍固定原版本；新版本生成不覆盖旧真相。
8. 自动入库能追溯到具体事件和原句，刷新不增加曝光，查词不冒充掌握，FSRS 状态按原始回忆事件唯一更新。
9. 学习区、酒馆、全局助手原会话、角色选择、画布、模型配置、现金/积分/BYOK 行为通过既有回归。
10. 产品开关关闭时可以退回原入口，不删掉已产生的新业务数据，不还原整个生产数据库。
11. 被拒绝的“获得钥匙”、停止和提交冲突都不能成为下一次主持或 NPC 的正式记忆；旧 finally 落盘与迟到输出不绕过隔离，原调用与费用依据保留。
12. 创建世界、新版、开局、回档在并发或提交后丢响应时，原请求只得到原资源；同号不同内容明确冲突，已推进的 revision 不妨碍原结果重放。
13. 在最终事务内各写入点和 COMMIT 后发送前注入崩溃：恢复后任务、turn、检查点、execution 与完成事件具有同一 commit_id；不重调模型、不重复生效，费用可继续 pending。
14. 同一道复习题换操作号、跨标签页或提交不同答案都不能二次更新 FSRS；旧题、错误目标、过期题和更正后的失效题不能结算。
15. 同词形不同出现可分别确定或纠正义项；只改变选中的 occurrence，保留原始学习证据，FSRS 状态不跨义项复制，必要重建只使用有效回忆。

## 14 用九岁孩子能懂的话解释

可以把它想成一个新开的英语剧场，里面有准备剧本的人、演员、主持人和记录员。

选词 AI 先挑一组能用在同一件事情里的词，还要告诉编剧每个词是什么意思、准备放在哪里。编剧据此写出案件、人物和线索。检查程序和审核 AI 看有没有人名写错、证物放错地方、时间对不上、词用错意思。检查通过后把剧本装进有版本的档案袋，主持人不能玩到一半偷偷换凶手。

数据库是很多本有编号的记录册。世界表像剧目目录，版本表像封存的剧本，游玩表像你买的一场票，分支和存档表记着你走到哪里。主键就是每条记录的号码，外键就是“去另一本册子找这个号码”。所以系统能知道这句台词属于哪次行动、这次行动属于哪条路线。

主持人拿完整剧本，演员只拿自己的角色本。警察不知道的秘密，不会因为主持人知道就自动进警察脑子。你输入英文，主持人根据之前发生的事判断结果；如果死了，它会指出你说的话是什么意思、哪条规则让你出事。

回档像回到上一页，但要把游戏里每个人的记忆也翻回那一页。你本人已经学到的单词留在自己的单词本里，不会跟着消失。FSRS 像负责安排复习日期的计算器，只管什么时候再练，不替你编故事。

学习区、酒馆和英语剧场可以共用大楼的门票账户、电力和收银台；每个房间的剧本、演员记忆和记录册分别保管。新加的执行归属，就像每张工作单上写清“这是哪个房间、哪场游戏的事”，不会拿错别人的资料。

演员排练时说“我拿到了钥匙”，要等导演确认，这件事才会写进正式剧本记录。排练被否决后，下一场从正式记录开始；演员不能把失败排练当成真的经历。失败录像和花费另行保留。

每次创建和回档都有一张编号小票。你没有收到回档成功的画面，再按一次同一张小票，工作人员会告诉你刚才建好的路线号码。正式保存时，剧情、任务和完成记录一起盖章；突然停电时，要么全盖好了，要么全没盖，不会只记半件事。

复习题也有自己的号码，同一题交两次只算一次。单词本则记清每次出现的位置：银行的 bank 和河岸的 bank 先各夹一张纸条；后来弄明白其中一个，只移动对应纸条，不把另一张也带走。

## 15 本次审计的修订与待实现验证

下表为 0.2 的设计约定与 TDD 验收场景，不代表运行时测试已经通过。本轮没有新增业务代码、实际迁移或调用付费模型。

| 审计项 | 修订位置与决定 | 实现时先写的失败场景 |
| --- | --- | --- |
| P1 未提交输出污染记忆 | 6.5、10.1；正式记忆与每次工作会话分离，失败后受影响角色重建，旧执行资料保留 | M1 拒绝获得钥匙后主持与 NPC 均无钥匙记忆；M2 停止后 finally 仍保存历史；M3 提交冲突；M4 NPC 候选成功但最终话轮失败；M5 未知原调用只恢复原尝试；M6 正式成功后才看到授权的新事实 |
| P1 非模型操作无完整去重 | 6.8、9.4、11；新增 ew_operations，先重放后检查当前版本 | I1 创建世界成功后丢响应；I2 新版与开局并发重试；I3 回档已切换分支后重试；I4 同号不同内容；I5 提交前崩溃无资源；I6 纯回档不产生虚假 execution 或费用 |
| P1 业务与执行完成的崩溃窗口 | 8.2、9.3；剧情、任务回执、execution.result、完成事件同一最终事务 | C1 stage 前中断；C2 stage 后重启只提交；C3 最终事务每个写入点故障后全回滚；C4 COMMIT 成功但响应丢失；C5 SSE 未发及费用缺证据；C6 停止与提交竞争及迟到旧 fence |
| P2 旧会话可有多个 context | 6.2；UQ(account_id, conversation_id)，保留原 ID | U1 两个初始化事务并发只得到一个 context；U2 相同旧 action_id 仍只产生一次执行，回填有重复时拒绝继续 |
| P2 同题换操作号重复计分 | 6.6、6.8、9.5；服务端题号绑定目标和状态，一次原子消费 | R1 同题同答案换操作号返回原结果；R2 同题不同答案拒绝；R3 双标签页并发仅一条 recall；R4 同版本复用已签发题；R5 过期/旧 revision/错账号错词条拒绝；R6 评分中断回滚消费与状态 |
| P2 未知词义不能逐位置拆分 | 6.6、6.8、9.6；出现身份、归属修订和证据重建 | S1 银行/河岸两个 bank 分别确定；S2 已聚合错误义项只拆选中位置；S3 原事件保留且统计不重复；S4 无回忆的新义项不继承分数；S5 更正已评分语境后作废旧题并按有效证据重建 |
