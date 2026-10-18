# 叙事英语世界与词汇资源调研

核验日期：2026-10-18，已按用户反馈补查高星主持人、多角色模拟与 AI 剧本杀项目。对应[设计草案](../specs/2026-10-18-immersive-vocabulary-world-design.md)。

## 结论

已有项目实现了“目标词生成故事”，也有项目实现了“英文自由输入影响 NPC 与任务”。本次核查的候选中，未找到同时具备多类型词汇关联、完整故事推进、一词翻译、身份暴露死亡和可靠个人复习的成品。这个结论仅限本轮检索范围，不表示网上不存在类似产品。

用户明确认为固定场景与固定人物的 Polyglot Path 参考价值低，已从主要玩法基准降级。当前优先参考 Concordia 的主持人、角色私有观察和状态恢复基础，以及 JianWang97/jubensha-ai 的动态剧本生成与结构校验。AI Voc Builder 仅保留为词汇故事提示方式的对照，不再据此推断其能保证词义与情节质量。

建议在 MapFlow 中安排选词、编剧、验收、保存和主持游玩的固定顺序，保持世界剧本可以重复使用。词义关系评估 Open English WordNet，场景与因果关系评估 ConceptNet；个人词库保存事件中获得的词汇，FSRS 计算其中的记忆状态。ConceptNet 不负责重新优化全部释义，FSRS 也不是词典或自动收词工具。

## 方法与证据边界

通过 agent-reach 的 GitHub CLI 路径检索，辅以网页检索和一级来源阅读。关键词包括 vocabulary story、AI language learning RPG、story vocabulary SRS、mnemonic vocabulary、英语词库及指定资源名。读取 GitHub API、README、LICENSE、具体生成和状态处理代码；研究资料只引用权利方、作者或官方发布渠道。

只做静态核验，没有 clone、安装、执行第三方项目，没有复现其部署或调用其 AI。源码中存在功能、测试文件或公开演示地址，均不等于已经验证生产可靠性。最近推送日期是 API 元数据，不代表持续维护承诺，也不等于最新提交日期。

关键快照：

| 资源 | 本次读取的默认分支 HEAD 或发布版本 |
| --- | --- |
| MapFlow 前端 | `c30959736976c3c68aad4944d501b5f8153e7cff` |
| MapFlow 后端 | `bf5f147f1902`，已通过固定入口检查 |
| Polyglot Path | `2c43c9b9d5396372ec38188d15a51e67c16d1698` |
| AI Voc Builder | `c7aa55b988012a1fc6ee0f137a965ebe6b90e622` |
| Open English WordNet | `bff3181fe5c810dcd157cba0eed60322a6e0aaed` |
| ECDICT | `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b` |
| ts-fsrs | 发布 `v5.4.2`；默认分支 HEAD `c8ca282edc3fe1cdfa1c24912437938b63a25cb3` |

许可证栏记录的是本次可见声明；代码、词典内容、例句和录音分别核查。未明确授权的公开源码不列入可直接复制的候选。

## 高星框架与剧本杀专项复查

以下星数为 2026-10-18 GitHub API 快照。本轮优先按星数检索，再核对是否真正具有所需机制。较高星的相关框架不等于现成动态剧本杀产品；中文 AI 剧本杀直接匹配项目的星数明显较低，不把固定剧本聊天或无授权演示替换成虚构的高星成品。

| 项目与星数 | 核实到的设计与通路 | 本项目可取之处与边界 |
| --- | --- | --- |
| [Concordia](https://github.com/google-deepmind/concordia)，1,794 | 角色提供行动，主持人安排可见信息与行动后果；[Social Deception](https://github.com/google-deepmind/concordia/tree/main/examples/games/social_deception) 有隐藏身份、夜间行动、提名、申辩、投票、死亡与终局 | 首要运行架构参考；是 Python 模拟库和示例，非已做好的英语剧本杀；通用检查点不能直接等同该例子所有状态的可靠回档 |
| [Generative Agents](https://github.com/joonspk-research/generative_agents)，22,237 | 角色有观察、记忆、反思、计划；实际保存时间、位置与角色记忆后可载入继续 | 仅参考角色持续记忆与续玩；初始 Smallville 世界手工制作，未提供动态案件生成、主持人判死与英语教学 |
| [AI Town](https://github.com/a16z-infra/ai-town)，10,662 | 数据库驱动持续小镇，角色对话与世界状态分开；地图与初始角色来自固定配置 | 不列主要剧本杀基准；位置历史和平滑回放不是任意剧情节点恢复后继续作新选择 |
| [JianWang97/jubensha-ai](https://github.com/JianWang97/jubensha-ai)，142 | 实际用模型与工具生成背景、角色、地点、证物和阶段，保存数据库；有主持人和独立角色上下文 | 最贴开局生产线的直接样本；默认全 AI 演出；结构校验不能证明完整时间线和推理可解；未见用户需要的身份判死与任意检查点回档 |

状态与许可一级来源：[Concordia API](https://api.github.com/repos/google-deepmind/concordia)、[Generative Agents API](https://api.github.com/repos/joonspk-research/generative_agents)、[AI Town API](https://api.github.com/repos/a16z-infra/ai-town)、[jubensha-ai API](https://api.github.com/repos/JianWang97/jubensha-ai)。本次均未归档，最近推送依次为 2026-10-16、2024-08-05、2026-08-26、2026-08-04；代码许可分别为 Apache-2.0、Apache-2.0、MIT、MIT。

已记录版本：Concordia main `4b7e02a94b719e56f10989046af32d79bbbc3b9c`；Generative Agents main `fe05a71d3e4ed7d10bf68aa4eda6dd995ec070f4`；AI Town main `8e05997f2409275669c8344b84a51692e83f3f33`；jubensha-ai main `d935e8b0a9bc73924fef35a95675a38c51694985`。Generative Agents 的默认分支提交时间与仓库 pushed_at 不同，不能把后者当成默认代码更新日期。Concordia 的 main 能力也不能自动视作已存在于发布包 v2.4.0。

### Concordia 的具体参考点

[Social Deception 主持人](https://github.com/google-deepmind/concordia/blob/main/examples/games/social_deception/game_master.py) 分开保存公共记录、私语和每个人的待接收信息；主持人知道完整角色真相，角色收到各自能看到的消息。[GameTracker](https://github.com/google-deepmind/concordia/blob/main/examples/games/social_deception/game_tracker.py) 保存角色状态。这可以参考到剧本杀的“主持人手册、个人角色本和公用线索”分工。

通用[模拟检查点](https://github.com/google-deepmind/concordia/blob/main/concordia/prefabs/simulation/generic.py) 保存人物、主持人、组件状态和日志，载入时复制状态；[相关测试](https://github.com/google-deepmind/concordia/blob/main/concordia/prefabs/simulation/checkpoint_test.py) 检查恢复分支的记忆独立。本轮只读代码未运行这些测试。实现也明确不恢复所有引擎游标、不保证外部服务确定性；具体剧本示例的临时状态、共享对象和后台操作仍需验收。

[Death 组件](https://github.com/google-deepmind/concordia/blob/main/concordia/contrib/components/game_master/death.py) 会判死并移除行动角色，但默认会将歧义情况按死亡处理，不适合原样作为英语学习的裁决器。[局后反思](https://github.com/google-deepmind/concordia/blob/main/examples/games/social_deception/cross_game_reflection.py) 面向策略，不等于翻译上一句英文和分析玩家语言错误。

### 其他项目的复用界限

jubensha-ai 的[剧本生成器](https://github.com/JianWang97/jubensha-ai/blob/d935e8b0a9bc73924fef35a95675a38c51694985/backend/src/agents/script_generation_agent.py)由模型依次调用工具生成基本资料、背景、角色、地点、证物和阶段。实际要求恰好一名凶手与一名受害者且不为同一人、角色名唯一、秘密与目标非空、至少一个案发现场、至少五条证物、证物地点存在；未完成必要步骤不允许结束生成。这证明有真实结构检查与失败修正，不能推广为已证明案件推理可解。

其[主持人](https://github.com/JianWang97/jubensha-ai/blob/d935e8b0a9bc73924fef35a95675a38c51694985/backend/src/agents/gm_agent.py)可规划阶段并检查开场与揭晓位置；[人物身份](https://github.com/JianWang97/jubensha-ai/blob/d935e8b0a9bc73924fef35a95675a38c51694985/backend/src/agents/character_identity.py)与[阶段资料分配](https://github.com/JianWang97/jubensha-ai/blob/d935e8b0a9bc73924fef35a95675a38c51694985/backend/src/agents/phase_director.py)将本人秘密、公开与个人掌握证物分开。已有怀疑度只是启发式，并非穿越者身份或语言判死。[历史恢复](https://github.com/JianWang97/jubensha-ai/blob/d935e8b0a9bc73924fef35a95675a38c51694985/backend/src/services/game_history_service.py)主要恢复暂停状态，未证明完整快照回档，不直接复用为产品存档合同。

Generative Agents 的 [reverie.py](https://github.com/joonspk-research/generative_agents/blob/main/reverie/backend_server/reverie.py) 与 [persona.py](https://github.com/joonspk-research/generative_agents/blob/main/reverie/backend_server/persona/persona.py) 确实保存模拟与角色记忆，能从保存目录继续。其 `/replay`、`/demo` 则是观看记录，不能混作从任意画面恢复游戏的证据。

AI Town 的[架构说明](https://github.com/a16z-infra/ai-town/blob/main/ARCHITECTURE.md)、[世界状态](https://github.com/a16z-infra/ai-town/blob/main/convex/aiTown/world.ts)及[初始化](https://github.com/a16z-infra/ai-town/blob/main/convex/init.ts)显示的是持续模拟和固定初始资料，本次不因其星数较高而推荐整站二开。

另查 [ChatArena](https://github.com/Farama-Foundation/ChatArena)，1,567 星，Apache-2.0，main `a15802dd89c0d69165bb0b07e70c2bac5a7c4e36`。其[消息可见性](https://github.com/Farama-Foundation/ChatArena/blob/main/chatarena/message.py)和[隐藏身份游戏](https://github.com/Farama-Foundation/ChatArena/blob/main/chatarena/environments/chameleon.py)可作局部参考；README 已于 2025-08-11 宣布弃用、不再维护，不推荐作主底座。导出对话也不代表能恢复全局状态。

另有 [NarrativeEngine-P](https://github.com/Sagesheep/NarrativeEngine-P)，105 星，MIT，main `a5020b93fccd56ea91a5b1b2dd30053b35c5a66b`，最近推送 2026-10-16。[人物生成](https://github.com/Sagesheep/NarrativeEngine-P/blob/a5020b93fccd56ea91a5b1b2dd30053b35c5a66b/src/services/npc-generation/profile.ts)、[知识范围](https://github.com/Sagesheep/NarrativeEngine-P/blob/a5020b93fccd56ea91a5b1b2dd30053b35c5a66b/src/services/campaign-state/knowledgeScope.ts)和[备份恢复](https://github.com/Sagesheep/NarrativeEngine-P/blob/a5020b93fccd56ea91a5b1b2dd30053b35c5a66b/server/services/backup.js)有实际实现，恢复会清理已经回滚场景对应的向量记录，适合作回档与外部记忆一致性参考。它的世界构建以导入和编辑资料为主，未核到自动产出完整自洽案件，不因为机制合适就归为高星成品。

更高星的 [AI Alibis](https://github.com/ironman5366/ai-murder-mystery-hackathon)，248 星，MIT，使用固定 `characters.json` 案本，本轮按用户条件排除主底座。49 星的 [ScottishFold007/ai-murder-mystery](https://github.com/ScottishFold007/ai-murder-mystery) 虽 README 有 MIT 标记，[实际 LICENSE](https://github.com/ScottishFold007/ai-murder-mystery/blob/3afe5bccb989ec1b8964c0ff851e99c5484c80fe/LICENSE)为非商业协议，商业服务需授权，不能当作已获商业复用授权的候选。

## AI Voc Builder 是否保证故事用词质量

复查其[故事生成](https://github.com/piglei/ai-vocabulary-builder/blob/c7aa55b988012a1fc6ee0f137a965ebe6b90e622/voc_builder/learn/ai_svc.py)与[实际入口](https://github.com/piglei/ai-vocabulary-builder/blob/c7aa55b988012a1fc6ee0f137a965ebe6b90e622/voc_builder/learn/views.py)：选词后直接要求模型自然使用目标词、其余用词简单、句子简短、目标词加标记并控制长度，再将生成文本交给页面。已读这条生成通路没有独立的词义、因果、剧情质量检查器；不能将提示词要求当作已验收效果。

因此我们的建议增加具体词义与场景用途说明，并在生成后分别进行程序结构检查和内容检查。程序检查覆盖、引用和数据完整性，AI 检查自然用法、人物动机与矛盾；人工盲玩验证是否可理解、可探索、可解。检查失败时有边界地修订，不无限重写，不把通过格式检查等同于故事合格。

## 上一轮产品与底座候选

以下保留为比较证据，不表示仍把固定场景语言 RPG 作为当前主路线。

以下八个仓库本次 API 查询均未归档。

| 项目 | 实际实现与适合参考的部分 | 与用户需求的差距 | 技术与许可；最近推送 |
| --- | --- | --- | --- |
| [Polyglot Path](https://github.com/juanan09/polyglot-path) | 自由语言对话；AI 提取意图、语法和用词；程序按 NPC 与意图推进连续任务；JSON 描述人物、地点、物品和事件 | 最接近可二开的语言 RPG，但任务较简单；未见关联词网、SRS、一词预算或身份死亡系统 | Nuxt/Vue/TS、Genkit、PostgreSQL；[MIT](https://github.com/juanan09/polyglot-path/blob/main/LICENSE)；2026-04-06 |
| [AI Voc Builder](https://github.com/piglei/ai-vocabulary-builder) | 从句子采词，生成包含目标词的短故事；词条高亮、测验、Anki 导出 | 仍从近期未出现的池中随机选词；没有互动世界和规则裁决，不能把故事轮换当作个人遗忘模型 | Python/FastAPI、Vue/TS、TinyDB；[BSD-3-Clause](https://github.com/piglei/ai-vocabulary-builder/blob/main/LICENSE)；2026-05-27 |
| [RPG English Learning](https://github.com/erisonsuzuki/rpg-english-learning) | 英文 RPG 聊天、角色、摘要、历史存储；提示词要求旧词与纠错形式在以后场景重现 | 更接近提示词驱动的叙事导师；没有经过程序约束的持续世界和所需翻译预算 | Next/React/TS、Supabase、Groq；[MIT](https://github.com/erisonsuzuki/rpg-english-learning/blob/main/license)；2026-09-23 |
| [FlashWord](https://github.com/JZJared/FlashWord-Public) | 指定词生成中文夹英文故事；保存复习评分、间隔、到期时间，并以到期词再生成文章 | 是阅读助记，仍随机配词；大段 HTML 内嵌逻辑，未附完整数据库迁移；不适合直接作为 MapFlow 底座 | HTML/JS、Node/Express、Supabase；[MIT](https://github.com/JZJared/FlashWord-Public/blob/main/LICENSE)；2026-04-08 |
| [English Story Quest](https://github.com/zhsjwjw3888/english-story-quest) | AI 创作故事的技能和离线脚本；交付、复习、评分、TTS 与媒体流程；附原创 40 词样本 | 不是现成 Web 游戏；固定间隔阶梯并非拟合个人记忆；公开样本不等于完整考试词库 | Python；[MIT 与原创样本说明](https://github.com/zhsjwjw3888/english-story-quest/blob/main/LICENSE)；2026-10-16 |
| [voba](https://github.com/Tapiocaba/voba) | 词表驱动的故事开端、分支、续写与结尾；创作、测试和混合模式；TTS | 选择题为主的黑客松原型，未见持续 SRS；无明确 LICENSE，只作设计参考 | React、Python、LangChain、Firebase；[API 无许可记录](https://api.github.com/repos/Tapiocaba/voba)；2024-02-22 |
| [Quilltale](https://github.com/Aeesh/Quilltale) | 地点、物品、NPC 记忆和玩家状态；程序验证移动和拾取 | 非语言学习产品；README 承认叙事先说成功而状态后拒绝等问题，跨重启持久化也有局限；无明确 LICENSE，只作架构参考 | Python/Gradio；[API 无许可记录](https://api.github.com/repos/Aeesh/Quilltale)；2026-09-16 |
| [Lute v3](https://github.com/LuteOrg/lute-v3) | 阅读查词、短语、词条状态、父词及词形关系、音频阅读进度 | 是精读产品，父词关系不能替代事件关联；没有 AI 世界与剧情裁决 | Python/Flask、SQLite；[MIT](https://github.com/LuteOrg/lute-v3/blob/develop/LICENSE.txt)；2026-09-05 |

关键源码证据与推断：

- Polyglot 的 [agent.ts](https://github.com/juanan09/polyglot-path/blob/2c43c9b9d5396372ec38188d15a51e67c16d1698/server/ai/agent.ts) 返回结构化 `intent`、`grammar_score`、`npc_response` 和 `learned_vocabulary`；[missionEngine.ts](https://github.com/juanan09/polyglot-path/blob/2c43c9b9d5396372ec38188d15a51e67c16d1698/server/utils/missionEngine.ts) 以人物和意图推进任务；[check_in.json](https://github.com/juanan09/polyglot-path/blob/2c43c9b9d5396372ec38188d15a51e67c16d1698/game-data/missions/check_in.json) 提供真实半夜入住任务。它能作为事件与行动的基准，但不能据此宣称具有可靠身份识破能力。
- AI Voc Builder 的 [ai_svc.py](https://github.com/piglei/ai-vocabulary-builder/blob/c7aa55b988012a1fc6ee0f137a965ebe6b90e622/voc_builder/learn/ai_svc.py) 确实让模型自然使用指定词写连贯故事；[store.py](https://github.com/piglei/ai-vocabulary-builder/blob/c7aa55b988012a1fc6ee0f137a965ebe6b90e622/voc_builder/infras/store.py) 的候选池仍会随机打乱。它解决了故事生成，不等于完成关联词库整理。
- RPG English Learning 的 [chat API](https://github.com/erisonsuzuki/rpg-english-learning/blob/main/app/api/chat/route.ts) 与[提示词](https://github.com/erisonsuzuki/rpg-english-learning/blob/main/docs/prompt.md) 证实有真实聊天与教学流程；文字要求模型记住历史，不能替代程序维护世界事实。
- FlashWord 的 [generate.js](https://github.com/JZJared/FlashWord-Public/blob/main/generate.js) 和 [index.html](https://github.com/JZJared/FlashWord-Public/blob/main/index.html) 有故事生成和复习闭环。公共文件布局与 README 部分不一致，二开前需要独立安装复现。
- English Story Quest 的 [review.py](https://github.com/zhsjwjw3888/english-story-quest/blob/main/scripts/review.py) 有评分与固定阶梯调整，属于可参考的工具流程；[README](https://github.com/zhsjwjw3888/english-story-quest/blob/main/README.md) 将故事创作交给宿主 AI。
- voba 的 [helpers.py](https://github.com/Tapiocaba/voba/blob/main/api/helpers/helpers.py) 和[选项生成](https://github.com/Tapiocaba/voba/blob/main/api/get_sentence_options.py) 确实支持分支，适合研究起承转合；缺少授权时不复制实现。
- Quilltale 的 [state.py](https://github.com/Aeesh/Quilltale/blob/main/src/world/state.py) 验证世界状态变更；结合其[自述局限](https://github.com/Aeesh/Quilltale)，支持我们采用“先验证后果，再展示已生效叙事”的设计建议，不能当作已解决世界一致性的现成引擎。
- Lute 的[阅读路由](https://github.com/LuteOrg/lute-v3/blob/develop/lute/read/routes.py) 与[官方手册](https://luteorg.github.io/lute-manual/) 是词形、短语、状态和阅读交互的参考。

## 词库、关系资源与语音内容

| 资源 | 能提供什么 | 许可与选型判断 |
| --- | --- | --- |
| [Open English WordNet](https://github.com/globalwordnet/english-wordnet) | 词元、词性、词义、英文释义、例句及上下位、反义、部分整体、派生等关系 | [CC BY 4.0 并保留 Princeton 许可](https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md)；优先评估为词义关系骨架，需要履行来源署名；不带中文、考试标签和录音 |
| [ConceptNet 5](https://github.com/commonsense/conceptnet5) | 地点、用途、因果、子事件、前提条件、动机和派生等关系，每条边带来源及许可 | [代码 Apache 2.0，完整数据 CC BY-SA 4.0](https://github.com/commonsense/conceptnet5/blob/master/LICENSE.txt)；适合事件联结，保留逐边来源和数据许可；不是完整英汉词典 |
| [ECDICT](https://github.com/skywind3000/ECDICT) | 中英文释义、音标、考试标签、频率与词形变化，字段较完整 | 根目录[声明 MIT](https://github.com/skywind3000/ECDICT/blob/master/LICENSE)，但[README](https://github.com/skywind3000/ECDICT/blob/master/README.md) 明述多源词典、爬取及网友贡献；未完成逐源内容授权核验，适合作原型候选和结构参考，不据此直接放行全量生产释义 |
| [kajweb/dict](https://github.com/kajweb/dict) | 四六级等分册、释义、近义、同根、词组、例句和发音链接 | [README](https://github.com/kajweb/dict/blob/master/README.md) 明述抓取商业背词 App；[API](https://api.github.com/repos/kajweb/dict) 无许可。仅参考字段，不导入为已获授权的产品词库；发音外链也不是录音再分发授权 |
| [FrameNet](https://framenet.icsi.berkeley.edu/) | 事件框架、参与角色、唤起事件的词汇单元和例句标注 | 很适合设计犯罪、调查等事件结构；[官方数据申请](https://framenet.icsi.berkeley.edu/data-request) 与选定数据包需再核查。[NLTK 的 1.7 元数据](https://github.com/nltk/nltk_data/blob/gh-pages/packages/corpora/framenet_v17.xml) 标 CC BY 3.0，但本轮未读到权利方该包完整许可，因此不认证为可直接导入 |
| [FreeDict 英汉与 WikDict](https://freedict.org/downloads/) | TEI 词典，词形、词性、义项、中译和部分 IPA | [eng-zho 2025.11.23 源包](https://download.freedict.org/dictionaries/eng-zho/2025.11.23/freedict-eng-zho-2025.11.23.src.tar.xz) 的 TEI 头声明 CC BY-SA 3.0，来源 WikDict/Wiktionary/DBnary；抽样见空中译和可疑映射，必须做内容抽检；无考试标签和现成录音 |
| [Kaikki 与 Wiktextract](https://kaikki.org/) | 词义、词形、词源、主题、相关词、翻译、IPA 和音频链接 | [抽取器](https://github.com/tatuylonen/wiktextract/blob/master/README.md) 大部分 MIT，不代表输出也是 MIT；文本遵循[来源许可](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)，录音逐个核对 Commons 文件页；中译覆盖不完整 |

资源状态：ECDICT API 最近推送 2025-03-28；kajweb/dict 为 2024-04-05；OEWN 为 2026-09-03；ConceptNet 为 2023-01-19；Wiktextract 为 2026-10-16。上述 GitHub 仓库本次均未归档。FreeDict 使用[指定版本目录](https://download.freedict.org/dictionaries/eng-zho/2025.11.23/)，Kaikki 以[原始导出说明](https://kaikki.org/dictionary/rawdata.html)与所选批次为准，不把“最新下载”当作永久版本。

实际关系与数据结构证据：

- OEWN 的 [entries-p.yaml](https://github.com/globalwordnet/english-wordnet/blob/bff3181fe5c810dcd157cba0eed60322a6e0aaed/src/yaml/entries-p.yaml) 中，同一词形可有不同词性和 synset（同义词义集合）。适配时应引用具体词义，不能只保存字符串。
- ConceptNet 的 [relations.py](https://github.com/commonsense/conceptnet5/blob/master/conceptnet5/relations.py) 和 [edges.py](https://github.com/commonsense/conceptnet5/blob/master/conceptnet5/edges.py) 展示关系种类与逐边来源字段。它适合提供候选联系，不能保证任意两个词之间都有可靠路径。
- ECDICT README 将部分 `detail/audio` 能力列为待添加，不能把字段名当作现成例句、图片或录音。FreeDict 与 Kaikki 也不等于可直接提供完整四级教学包。

建议保留三层内容：有来源的词义资源、有来源的真实关系、原创叙事关联。第三层允许把“警车与教堂”连成故事，但标记为创作关系，不修改底层词典来宣称两者本来就是语义同类。

## 复习调度基准

| 实现 | 本轮核验 | MapFlow 中的适用方式 |
| --- | --- | --- |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | [v5.4.2](https://github.com/open-spaced-repetition/ts-fsrs/releases/tag/v5.4.2)，2026-09-01 发布；[MIT](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/LICENSE)；包声明 Node >=20 | TS 项目适配较直接；当前本机 Node 为 v24.11.1，但尚未安装或运行该依赖。浏览器可做展示或预测，不能成为学习状态的唯一权威 |
| [rs-fsrs](https://github.com/open-spaced-repetition/rs-fsrs) | [Cargo.toml](https://github.com/open-spaced-repetition/rs-fsrs/blob/master/Cargo.toml) 为 1.2.1、edition 2024；[MIT](https://github.com/open-spaced-repetition/rs-fsrs/blob/master/LICENSE)；最近推送 2026-07-20 | 可评估在现有 Rust 后端执行；实际编译兼容、算法版本与状态迁移还需验证，不能因为同属 FSRS 就假定和 TS 实现可无损混用 |

[ts-fsrs 的模型](https://github.com/open-spaced-repetition/ts-fsrs/blob/c8ca282edc3fe1cdfa1c24912437938b63a25cb3/packages/fsrs/src/models.ts) 记录到期时间、稳定度、难度、次数、遗忘次数和复习日志，评分为 Again/Hard/Good/Easy。算法不附带词库、世界、账号或自动可信的掌握判断。

产品中应先记录看见、听见、查词、重听、主动表达与明确回忆的业务证据，再决定某次事件能否形成复习评分。不能让剧情通关直接把这段对白所有词都标为掌握，也不能每次曝光就自动延长间隔。

建议由服务端保存调度状态、时间与规则版本。词语到期只意味着需要合适的回忆机会；当前故事不适合时保留待复习状态，避免为满足算法强行破坏剧情。FSRS 的参数也不直接等于已经准确测量了玩家的听说读写能力。

## 关于关联组词的研究边界

[Tinkham 1997](https://journals.sagepub.com/doi/10.1191/026765897672376469) 区分语义同类聚组与主题聚组：在其研究条件下，前者造成困难，围绕共同情境的后者有促进作用。用户“夜晚、警察、教堂、嫌疑人、疑点”的例子更接近事件主题，而非纯近义词表。此处不把该实验推广为互动 RPG 学习有效性的证明。

[Nakata 与 Suzuki 的研究](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/effects-of-massing-and-spacing-on-the-learning-of-semantically-related-and-unrelated-words/F58BA8D70385603B9C42E408BFCB8A10) 于 2018 在线发表、2019 卷期刊出：133 名日本大学生学习 48 对英日词，语义相关与无关条件的测验准确率没有显著差异，但相关组产生更多组内混淆。这说明不能简单断言“随机一定差、同类一起背一定好”。

本产品应将事件关联、想象联结和自然复现视作待验证的设计假设。比较延迟回忆、新语境识别和听力识别，分别记录提示使用和实际测试结果；投入时长、故事读完或角色存活只能证明参与，不能单独证明记忆。

## 进入二开或自建之前的下一步

先评审七步流程的设计草案，再验证一个由 AI 生成、通过验收并保存的小型剧本杀事件。优先有限复现 Concordia 的主持与私有观察，比较动态剧本杀项目的开局生成检查；AI Voc Builder 只作提示词对照。只有决定实际引入后才安装和运行候选。

在少量词义上测试“真实关系 + 创作关系”的可编辑故事包，保留来源和版本。默认穿越者预设实行英文回答、一词翻译与规则死亡；其他世界可以采用不同策略。这里的可配置不是让前端自行决定规则，存档与裁决仍以服务端为准。

回档需要恢复角色记忆、阶段、线索和规则状态，保留词汇学习史；复用世界减少准备成本，但新的模型对话仍可能消耗 token。具体建议已同步到设计草案。本轮未选择全量生产词库，未引入依赖，未修改产品代码或生产状态。
