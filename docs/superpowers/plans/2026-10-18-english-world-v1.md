# 英语世界 v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. User has approved design 0.2 and explicitly requested implementation and deployment; continue through all authorized steps without another planning approval gate.

**Goal:** 实现独立英语世界文本闭环、可追溯词库与基础复习，独立本地 Compose 使用真实模型和现金/积分结算，通过测试后部署现有生产。

**Architecture:** 独立英语世界表、HTTP、角色输入和记忆；中性 execution context 复用既有 DSH、原调用恢复与结算。模型阶段成果经过验收，游戏与任务、执行完成同一最终数据库事务。前端只使用公共投影和持久业务操作。

**Tech Stack:** 既有 React 18/TypeScript/Vite/Vitest，Rust/Axum/SQLx/PostgreSQL，既有 DSH Worker，轻量 Docker Compose。

**Spec:** ../../specs/2026-10-18-english-world-technical-design.md；公共接口见 ../../contracts/english-world-v1.md。

## Global Constraints

- 保留已批准方案 0.2 的隔离、幂等、正式记忆、统一提交、单题消费与逐位置义项修订合同。
- 固定入口 D:/MapFlow-publish、D:/mapflow-server 保持 main；代码在 D:/MapFlow-worktrees/english-world-v1-20261018/frontend、server，分支 codex/english-world-v1-20261018。
- 不调用 CaseRAG，不改会话数据库、JSONL、旧 worktree 或共享 .git 的位置。
- 文本核心先验收；语音工作包不在文本版中冒充完成。
- 所有新增业务逻辑先测试、观察红，再实现、绿、整理；提交前完整测试、类型检查、自审。
- cash/points/byok 使用现有真实结算与凭据机制，不伪造钱包、调用费用或未知费用的零值。
- 本地只用专属数据库、账号和额度，不复制生产玩家数据，不用测试脚本修改生产数据库。
- 生产发布依照现场 OPERATIONS、真实冻结 SHA、备份和闲置窗口验收；回退不覆盖新用户活动。

## Review Focus

- 旧聊天严格 API 与原会话 action 去重不得因中性 context 迁移改变；包含并发初始化旧会话测试。
- 未获验收、停止、失去 revision/fence 的角色历史不得进入正式记忆；包含 NPC 候选成功而话轮失败测试。
- DB 提交成功而响应丢失必须重放原世界/分支/执行，不再次收费；每个最终写入点做事务故障验证。
- 一题换操作号、双标签页、旧 revision 或词义更正不得重复推进 FSRS。
- 中文回答是世界事件；IME 组合、网络错误和模型失败不成为玩家死亡。

## Task 1: 中性执行与兼容

**Files:** server/src/agent_execution.rs、server/src/agent_execution/{domain,store,runner,backend,finalization,settlement,public_view,service,context,bridge,evidence_sink}.rs；必要旧工具强类型解包；Worker 专属冻结输入。测试 server/tests/english_world_execution.rs 和既有执行回归。

**Interfaces:** 共享层提供 AcceptDomainExecution、FrozenDomainInput、AgentExecutionDomain(stage/commit/terminate)、StagedDomainCompletion、DomainCommit；完整 Rust 签名按执行者在进度账本记录的冻结接口。accept_domain_in_transaction 不自行提交；select_domain_model 保留原模型及凭据身份。

- [x] 写旧会话接受后 context_id 非空、并发唯一、旧 DTO 未增字段的失败测试。例如 `assert!(sqlx::query_scalar::<_,Option<String>>("SELECT to_jsonb(e)->>'context_id' FROM agent_executions e WHERE execution_id=$1").bind(id).fetch_one(&pool).await?.is_some())`。
- [x] 运行该集成测试，确认因新归属缺失而红；依赖/环境失败单独记录，不能当红灯证据。
- [x] 实现共享归属、领域回调、无旧工具工作会话、中性费用明细，保留旧接口和未知调用规则。
- [x] 执行新测试及现有执行/现金/积分/BYOK/Worker回归，检查领域 finalization 使用同一事务。

## Task 2: schema、词库与领域不变量

**Files:** server/migrations/0064_agent_execution_contexts.sql、0065_english_world.sql；server/src/english_world/{mod,types,validation,tokenization,store,operations,learning,review}.rs；server/tests/english_world_schema.rs、english_world_domain.rs、english_world_learning.rs。

**Interfaces:** EnglishWorldStore::new(PgPool)，public projection 只返回公共合同；WorldSpec/SelectorResult/HostPlan/NpcResult 的结构化校验、stable tokenId、逐位置 occurrence、业务操作和题目消费。

- [x] 写 schema 关系、跨账号 FK、旧 context 唯一、请求重放、两义 bank 拆分和单题并发消费测试；首次 schema 测试直接检查 `to_regclass('ew_operations')` 非空，在旧库明确失败。
- [x] 在专属 PostgreSQL 下运行，记录实际红灯。
- [x] 实施 27 张文本表及旧表扩展；循环引用先建表后加 FK；AI 数据验收失败不给 ready。
- [x] 用真实 FSRS 库保存版本化状态；只可靠回忆推进，含提示保留证据；更正按有效事件重建。
- [x] 跑迁移、约束、幂等、复习与义项修订测试。

## Task 3: 准备、主持/NPC、翻译、复盘、回档

**Files:** server/src/english_world/{service,preparation,agent_policy,execution,playthroughs,translation,checkpoints,projection}.rs；server/tests/english_world_game.rs、english_world_recovery.rs。

**Interfaces:** EnglishWorldDomain implements AgentExecutionDomain；EnglishWorldService 接受创建、开局、行动、翻译和回档；阶段由程序按冻结任务安排。虚拟 pipeline task 汇总子任务，仅正式 applying task 与共享 execution 参与原子游戏提交；NPC 子任务仅持私有候选。

- [x] 写生成阶段顺序、无效词义/引用拒绝、中文规则、合理英语多路径、一词预算、失败记忆、回档丢响应与旧 fence 测试。
- [x] 观察红后实现 selector → writer → validator → ready；游玩 host → 必要 NPC → 应用；独立 glossary/debriefer 按需运行。
- [x] 每次工作会话从角色正式视图创建；中止/拒绝/冲突按捕获 epoch 幂等标脏，旧原生 checkpoint 留原调用。
- [x] 把 applying task、turn/checkpoint、正式记忆、学习事件、共享 execution.result 与 completed event 放在同一最终事务；费用可 pending。
- [x] 注入 stage 后重启、事务各写入点失败、提交后丢响应/SSE，验证不重调模型、不重复生效或扣费。

## Task 4: HTTP、认证、功能开关与运行时

**Files:** server/src/http/english_world.rs、http/mod.rs、app.rs、lib.rs、runtime.rs 与实际 agent bootstrap；server/tests/english_world_http.rs。

**Interfaces:** 公共合同所有文本端点，既有 session/CSRF/model catalogue/wallet/credit；独立 root `/api/me/english-world`。

- [x] 先写旧 app 请求 `/api/me/english-world/worlds` 必须身份校验的测试，观察未接入时失败。
- [x] 接入新 service 与领域 adapter，保持旧执行端点拒绝世界 execution，GET 不签发复习题。
- [x] 验证授权、CSRF、跨账号、私密字段、资源 ID/摘要、旧后端功能关闭和任务停止/恢复。

## Task 5: 独立前端与交互

**Files:** frontend/src/{pages/EnglishWorldPage.tsx,api/englishWorldClient.ts,domains/englishWorld/*,ui/englishWorld/*}，现有 Application/routes/AppFrame/layout；相邻 Vitest 测试。

**Interfaces:** docs/contracts/english-world-v1.md；复用资金和模型 UI，不复用旧聊天执行/角色/cache。

- [x] 先写深链接解析、手机更多可达、API no-store/CSRF与原操作重放测试，观察红。
- [x] 实现世界、准备、游玩、点词、死亡复盘、回档、词库与复习页面；draft/operation 按账号和本局分支隔离，不保存 Key。
- [x] 明确等待/错误/失效/死亡状态，IME 中不发送；模型失败不切死亡，旧晚到结果不能覆盖新分支。
- [x] 执行测试/typecheck/build；fixture 布局验收 320/390/1024/1440；真实本地后端页面在 390/1440 与明暗两主题验收，签题、翻译和复盘均使用原生网络。

## Task 6: 本地 Compose、测试额度与真实调用

**Files:** server/compose.english-world.local.yml、deploy/english-world-local/*、scripts/english_world_local.py 和脚本测试；frontend/docs/implementation/2026-10-18-english-world-local-acceptance.md。

**Interfaces:** 专属 DB 127.0.0.1:55464，Compose project mapflow-english-world-v1-local；本地测试账号、现金/积分账本与服务端真实模型配置。真实 Key 仅受限配置文件，不写仓库或日志。

- [x] 先测试 seed 必须拒绝非本地/非专属数据库和重复充值，观察红再实现本地脚本。
- [x] 启动简单 db+app（必要本地 TLS 代理），种测试账号和可追溯额度/积分。
- [x] 跑全套后端与Worker、前端验证，真实登录、本地生成/游玩/翻译/死亡/回档/复习。
- [x] 分别真实 cash 与 points 调用，检查原 call/receipt/usage、钱包/积分流水和前后余额；同请求重放无重复调用/扣费，待核账不填零。

## Task 7: 审查、整合与生产发布

**Files:** 两仓库必要的部署与验收记录；不修改用户会话资料。

- [x] 独立审查整条分支的 spec 和安全/计费/恢复合同，先红后绿修复重要问题。
- [x] 完整 npm test/typecheck/build、Worker test/typecheck/build、cargo test/fmt/clippy 与 workspace checker；审查所有 diff 后提交。
- [x] 保存并验证未提交工作，核对远端 tip，将已验证提交整合到 main，保持固定入口干净最新。
- [x] 按现场 OPERATIONS 做 schema 迁移前备份、生产兼容与闲置检查，冻结镜像/版本后切换；验证真实接口、额度/积分与旧三区回归。
- [x] 记录生产和本地验证的实际范围、回退组合与数据保留；关闭本任务临时测试消费者，保留会话关联工作区。

截至 2026-10-19：本地文本验收及真实 cash/points 25 calls 对账通过。后端全套 1193 通过、11 个既有环境失败、11 忽略，严格 Clippy 的既有诊断保留原日志；不称全仓全绿。前端 c72962d、后端 5258e3e 已整合并推送 main。正式镜像与已测候选的输入、运行文件完全一致，终态重放没有新增调用或扣费。隔离迁移、真实兼容回退与生产 schema65 正式接续已完成；原数据、原资金提醒和最新备份保留，公开入口／保护边界／静态摘要通过。生产未发起玩家业务或模型测试，完整范围见本地验收与生产发布记录。
