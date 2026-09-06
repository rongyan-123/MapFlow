# MapFlow MCP(外部 Agent 学习接入)设计文档

**日期**: 2026-09-06
**状态**: 待确认
**关联**: mapflow-server(mutation 通道 / 认证 / 审计 / 部署);MapFlow-publish(npx relay 包与规范文档)

## 背景

MapFlow 的技能树由 AI 生成、用户在网站内学习。网站内嵌的 Harness Agent 已能通过审批代理调用树编辑工具;但**用户自己的外部 Agent**(Claude Code、Codex、Cursor 等)没有任何接入途径——用户想用 Agent 帮自己整理学习内容时只能手动操作网站。

目标:让**所有注册用户**的外部 Agent 通过**一行命令**(npx)连接 MapFlow,读取自己的学习进度、按自己的语义重组私有树,首次授权一次(约 3 秒),之后永久免操作。所有 Agent 操作可审计追溯。

设计过程要点(决策背景,防止后人重蹈):

- 用户明确否定「第二套分组视图实体 + 引用卡」:节点实体在画布上只能画一次,跨块复制节点在视图上必然混乱。
- 用户认可的核心语义:**知识之间的联系用树本身的"新节点 + 依赖边"表达**(如安全语境需要"守卫"→ 新建衍化节点"网关",拉边"先学守卫才学网关"),不建视图系统。
- 但「按块保留知识点」(学习更清晰,参考 MapFlowNext 的 ArchBlock 排布)仍是用户的核心诉求——块作为**可选维度**引入,默认难度排布原样保留。

## 目标与非目标

### MVP 目标(本 spec 范围)

1. 外部 Agent 经 MCP 读:学习进度、私树全量(节点/边/块/完成度)。
2. 外部 Agent 经 MCP 写:自己的私有树——现有 8 种编辑操作 + 块操作。
3. 认证:api_tokens(服务器只存 digest)+ 浏览器一次性授权,长期有效、可吊销。
4. 审计:所有树变更在数据层总闸落账,不记秘密,可 SQL 追溯。
5. 分发:`@mapflow/mcp`(npx 包,TS relay),零配置,默认指向生产。

### 非目标(MVP 不做,列为后续方向,见 §10)

- AI 生成(v1/v2 的生成/clone 能力)不经 MCP 暴露。
- 前端"块视图"渲染与视图切换 UI(本 spec 只保证数据与读接口)。
- 生成新树时 AI 自动带块结构。
- 审计查询/令牌管理 UI(AdminPanel)。

## 术语表(写给非后端读者)

| 词 | 含义 |
|---|---|
| mutation(变更) | "改树动作"的统称,现有 8 种 + 新增 4 种块命令,全部经 `apply_personal_tree_mutation` 一个总闸执行 |
| token(门禁卡) | 服务器发给 Agent 的一串随机字符串,每次调用出示 |
| digest(指纹) | 服务器不存卡本身,只存卡的单向哈希(SHA-256,32 字节);验证时当场算一遍比对,指纹无法反推卡号 |
| device flow | 首次授权的标准流程:浏览器打开授权页→用户点允许→发卡 |
| revision(乐观锁) | 树每次变更版本号 +1;提交时核对版本,已被别人改过则拒绝重来 |
| 幂等 | 同一请求发两遍效果等于发一遍(靠 request_id 去重) |
| 块 | 树级可选分组:名字/颜色/顺序;一个节点至多属于一块(唯一归属) |

## 架构总览

```
外部 Agent(Claude Code / Codex / …)
   │  MCP(stdio)
   ▼
@mapflow/mcp npx relay ── 用户本机:①首次授权弹浏览器 ②存 token ③JSON-RPC 转发
   │  普通 HTTPS + Bearer token
   ▼
caddy(网关,唯一入口,现有中间件:防伪 IP/限流/CSRF 全复用)
   ▼
mapflow-server(单体 axum,新增 /mcp 路由 + 授权端点,不新增进程)
   │
   ▼
Postgres(新增 api_tokens / agent_audit_events 两张表)
```

**为什么不是新服务**:MCP 是现有 axum 进程里的**新路由**而非新进程——编译产物仍是同一个可执行文件,CI→GHCR→switch.sh 部署、health 回滚、监控全部走老路;内存增量几十 MB。服务与路由的关系:一个服务(进程)可以挂几十个路由(登录、公告、健康检查都同在一个进程里)。

## 详细设计

### 1. 工具集(Agent 能力清单)

分层原则(避免 schema 漂移):**schema 与执行单一来源**——写操作直接复用 `apply_personal_tree_mutation`(命令结构、白名单、幂等、乐观锁全继承),MCP 层不复制任何业务逻辑;读操作复用现有 domain 查询。网站内嵌 Harness Agent 与外部 MCP 是同一批底层能力的两个入口(前者走审批代理,后者走 api_token 直连),二者不存在第二套工具定义。

MCP 工具命名(前缀 `mapflow_`):

| 工具 | 功能 | 说明 |
|---|---|---|
| `mapflow.get_progress` | 读账户下所有树列表 + 每棵树的节点完成进度(含证据) | 账户级只读 |
| `mapflow.get_tree` | 读一棵树的全部节点/边/块/完成度 | 只读;`sort` 参数支持 `by_difficulty` / `by_category`(固有列排序,零新数据),默认按树的原始排布 |
| `mapflow.apply_tree_mutation` | 提交一条变更命令(见 §1.1 / §2) | 只对本人 private+ai_generated+ready 树生效;返回幂等回执与新 revision |
| `mapflow.whoami` | 查看当前 token 身份与授权状态 | 排障用 |

**不做**的呈现设计:不提供"视图/分组/排布"类工具(见 §2 语义集成方式)。

#### 1.1 mutation 命令(现有 8 种,全部原样暴露)

`add_node` `update_node` `delete_node` `add_edge` `update_edge` `delete_edge` `update_tree` `clear_tree`
——命令结构、字段白名单、幂等 request_id、revision 语义与网站内嵌通道完全一致;MCP 调用错误码与网站同风格(operationCode + 中文消息)。

### 2. 块模型(本 spec 的新增数据能力)

块是**可选维度**:默认视图(按难度/推荐序的 AI 排布)原样不动;块只是节点上的可选归属,供"按应用场景学习"的视图使用。

**数据**:

- 树记录新增 `blocks` 定义(JSONB 数组):`[{id, name, color, sort}]`,默认 `[]`(存量树零改动)。
- 节点记录新增可空 `block_id` 归属:**一个节点至多属于一块**(唯一归属)。
- 节点多属与跨块引用:**不允许**(用户否决:节点实体只能画一次,多属导致视图空洞)。同一知识点在另一语境的需求 → 用 §2.1 的方式表达。

**约束与自维护**:

- 写前校验:块引用必须存在、节点必须属于本树、块名不重复;`block_id` 只能指向本树已有块。
- 删节点:**无残留**(归属是节点行的列,随行删除,天然清理——不需要"删节点时扫各组摘引用"的额外逻辑)。
- 删块:该块内节点的 `block_id` 置 NULL(节点回到未分组),不级联删节点。
- 无 100% 覆盖要求:节点可以没有块(默认视图本来就不是块组织的)。

**mutation 新增命令变体**(复用同一 revision 锁与审计):

| 命令 | 作用 |
|---|---|
| `add_block {name, color?}` | 建块,返回块 id |
| `update_block {block_id, name?, color?}` | 改名/改色 |
| `delete_block {block_id}` | 删块(块内节点归属置空) |
| `set_node_block {node_id, block_id?}` | 节点换块 / 移出块(置空) |

(块间顺序 `sort` 的调整并入 `update_block`;MVP 不做块的细粒度重排工具,块少,整序成本低。)

#### 2.1 语义集成:规范文档,不是工具

"把知识点按新语义组织"(如:质量与安全语境 → 守卫需衍化)不是 MCP 专用工具,而是一份**规范文档**,Agent 参考规范自行执行——底层原语(add_node/add_edge/add_block)已全覆盖:

1. 取全量节点(`mapflow.get_tree`);
2. 按语义建块、把已有节点归入块;
3. 发现语境缺"转变/合并后的形态"(如网关),`add_node` 新建并 `add_edge` 拉依赖边(网关→守卫,表达"先学守卫");
4. 完成一次重组后可重复——**树因此持续演化**,不需要第二套视图数据。

规范文本(MVP):随 npx 包发布一份 markdown(约 1-2 页,中文),给出上述步骤与命名/粒度建议。后续可进化为可安装的 Agent skill(§10)。

### 3. 认证:api_tokens + device flow

**为什么不是 JWT**:我们是一个进程 + 一个数据库的部署,验证方就是签发方,查库成本为零——JWT 的"免查询自证"优势用不上,反而背上吊销难(JWT 过期前无法即时作废)、payload 签死后难改的麻烦。opaque token + digest 与现有网站 session 同一哲学,统一且吊销即时。

**表 `api_tokens`**(仿现有 sessions 表模式,identity_store.rs:581 一带):

```
api_tokens:
  token_id      uuid 主键
  account_id    关联账户(外键)
  token_digest  bytea(32)= SHA-256(token 明文)
  label         用户填写的用途名(如 "my-codex")
  created_at
  revoked_at    可空;NULL = 有效
  last_used_at
```

- token 明文只在签发响应中出现一次,服务器只存 digest。
- **无自动过期**(用户需求:永久免操作);吊销 = 置 `revoked_at`。MVP 吊销途径:SQL/运维,UI 列后续方向。
- 验证中间件:`Authorization: Bearer <token>` → 算 digest → 查表(revoked_at NULL + account 有效)→ 注入账户身份;与现有 `client_ip` 解析链、限流共存。

**device flow(MVP 用本地回调授权,参考 gh CLI 模式)**:

```
1. 用户本机跑 npx @mapflow/mcp → relay 生成一次性授权请求 + PKCE 挑战
2. 自动打开浏览器 → xxian.fun 授权页(复用网站登录 cookie)
3. 页面显示"授权 {label} 访问你的学习数据?" → 用户点允许(≈3 秒)
4. 服务器登记批准;relay 经本地回环回调换发 api token(gh CLI 同款;轮询作备选)
5. relay 把 token 存本机(如 ~/.mapflow/token,权限 600),之后静默使用
```

- 授权页与换 token 端点都在 mapflow-server 内(网关后),不信任任何外部回调地址之外的跳转;一次性 code 有短时效。
- 服务器端点(前缀统一 `/api/mcp/`):授权发起、授权页批准、换 token;`/mcp` 为 JSON-RPC 入口(§4)。

### 4. 传输与 npx relay

- **协议**:MCP JSON-RPC 2.0 最小子集 over HTTP(`POST /mcp`,`initialize` / `tools/list` / `tools/call` + 会话头);MVP 不实现 SSE 流式通知。JSON-RPC 原文经 relay 转发,不在 relay 做业务逻辑。
- **relay 包内容(就三样)**:
  1. device flow 客户端(首次弹浏览器、PKCE、存/读本机 token、自动刷新吊销提示);
  2. stdio MCP server(对 Agent 呈现为标准 MCP,满足 Claude Code/Codex 等直接 `claude mcp add` 或自动发现);
  3. 转发器(把 JSON-RPC 原样 POST 到服务器,注入 Bearer)。
- **零配置**:服务器 URL 内置默认 `https://xxian.fun`;无网络环境提示清晰错误。
- 运行位置:用户本机,不在服务器上。

### 5. 审计(数据层,不是 tool 层)

**写入点 = mutation 总闸**。所有改树动作(无论来自网站 Harness Agent、MCP 还是未来任何入口)都必经 `apply_personal_tree_mutation`,审计在其内落账 → **不存在绕过账本的改法**。这就是"放 data/infrastructure 层"的含义:审计跟着数据操作走,不跟着某个入口走。

**表 `agent_audit_events`**:

```
agent_audit_events:
  id           uuid 主键
  account_id
  actor_type   'api_token' | 'web_session'
  actor_id     token_id / session_id(天然溯源到具体 Agent 或浏览器会话)
  tree_id      操作的树
  operation    命令名(add_node / add_edge / add_block / set_node_block …)
  summary      JSONB 语义摘要,如 {"node_title":"网关","edge_target":"守卫"}
               (只记摘要字段,不记原文敏感内容)
  request_id   幂等请求号(与 mutation 幂等共用同一把)
  created_at
```

- **不记任何秘密**:不记 token 明文/摘要、不记密码类、不记邀请码。
- 与业务同事务:业务失败则不落成功账。
- 索引:`(account_id, created_at)`。MVP 无查询 UI,运维 SQL 直查;管理面板读取列为后续方向。
- 块操作、删节点等全部自动纳入(它们在 mutation 总闸内)。

### 6. 幂等、并发与错误

- mutation 已内建幂等(request_id 回执)与 revision 乐观锁——MCP 复用,不做第二套。
- revision 冲突:`operationCode` + 中文消息返回("树已被修改,请重读最新版后重试"),Agent 重读重提。
- 新错误码(沿用项目 operationCode + 中文消息风格,参照 commit 92a1763):
  - `auth.invalid_token` / `auth.token_revoked`
  - `mutation.revision_conflict` / `mutation.not_private_tree`
  - `block.unknown_block` / `block.duplicate_name` / `block.node_not_in_tree`
- 网关中间件(限流、client_ip 解析、CSRF 外的 bearer 校验)对 /mcp 全量生效。

### 7. 测试策略(TDD,先红后绿)

| 层 | 测什么 | 类型 |
|---|---|---|
| 单元(非 DB) | token digest 生成/比对、授权 code 一次性与时效、mutation 命令字段校验、块校验(名重复/引用悬空/跨树) | 现有 client_ip.rs 测试风格,纯函数 |
| DB 集成 | api_tokens CRUD、吊销即失效;审计落账(成功与回滚、不含秘密字段断言);块命令(建/改/删/换块、删节点归属自然消失、删块节点置空) | 真 Postgres,扩展 tree_library_store 现有测试 |
| HTTP | MCP JSON-RPC:无 token 拒绝、坏/吊销 token 拒绝、成功路径、tools/list 与 tools/call | axum 测试 |
| TS relay | device flow 状态、token 存取、转发类型 | vitest |
| 部署验证 | canary 生成接口(现有 CI)+ 手动 curl /mcp 冒烟 | CI |

块命令不是新通道,而是 mutation 新增变体 → 白名单/幂等/乐观锁/审计自动覆盖;测试只需证明"新命令本身正确"。

### 8. 部署

- **服务器:零新增部署单元**。新代码全部在 mapflow-server:路由 `/mcp`、`/api/mcp/*` 授权端点、两张新表(迁移随部署走)。CI(现有)→ GHCR → switch.sh 全链路不变;health 30s 回滚与 recover-prod 原样可用。内存增量几十 MB(当前 ~1GB 可用,无压力)。不在服务器上编译(既有铁律,CI 编译)。
- **caddy**:新增 `/mcp` 与 `/api/mcp/*` 路由转发到 app(同现有 /api 规则)。
- **npm 发布**:`@mapflow/mcp` 发布到 npm(唯一外部新动作;**需要用户提供 npm 账号/包名确认**)。包内附:relay 源码、块组织规范 markdown(§2.1)、README(一行命令示例)。
- **安全边界重申**:secrets 不进 env/镜像/git;token 明文只在签发响应与用户本机文件出现;邀请码不涉及本设计。

### 9. 里程碑拆分(建议实施顺序)

1. **数据层与总闸**:两张新表 + mutation 块命令变体 + 审计落账(+ 删节点/删块自维护)→ 测试全绿(§7 前四行)。
2. **认证**:api_tokens 签发/验证中间件 + device flow 授权端点。
3. **/mcp 路由**:JSON-RPC 子集 + 工具接线(读走 domain 查询,写走 mutation)。
4. **relay 包 + 规范文档**:npm 包(发布前与用户确认账号);本地对 Claude Code 实测一轮。
5. **部署验证**:canary → 生产,curl /mcp 冒烟 + 一次真实授权全流程。

### 10. 后续优化方向(明确不在 MVP,防范围蔓延)

- AI 生成新树时**自动生成块结构**(生成器加字段)——需动生成器与存量树策略,风险大,单独一轮。
- 前端块视图渲染(参考 MapFlowNext 排布方式)+ 视图切换 UI(按难度/按块/按分类)。
- AdminPanel:审计查询、token 列表与吊销 UI。
- 规范文档进化为可安装 Agent skill(随仓库分发)。
- MCP 能力扩展候选(v1/v2 生成类)在用户主动提出前不做。

## 开放问题(实施前需用户确认)

1. npm 包名与账号(建议 `@mapflow/mcp`)。
2. 授权页文案与 label 显示(是否显示用户名/头像)。
3. 工具命名前缀 `mapflow_*` 是否可接受。
4. spec 评审通过后进入 writing-plans 拆分实施计划。
