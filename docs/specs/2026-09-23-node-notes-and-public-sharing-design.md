# 节点笔记与用户技能树公开设计

日期：2026-09-23
状态：范围已确认，等待文档复核后进入 TDD 实现

## 1. 目标

本期解决两个连续的使用问题：

1. 用户学完一个节点后，可以把自己的理解保存成一份持续修订的 Markdown 笔记，第二天回来仍能直接复习；
2. 用户可以主动把个人技能树的当前版本发布到公共池，其他用户看到发布者与派生来源后，可以像使用官方树一样复制一份私人副本。

同时扩展 MapFlow MCP 与配套 Skill，使 AI 可以在获得用户明确指令后读取、改写节点笔记和发布技能树。笔记是“活的总结”，每个用户、每棵私人树、每个节点只有一份当前正文，不设计成不断追加的时间线。

## 2. 本期范围

### 2.1 包含

- 私人树节点详情增加“写笔记／查看笔记”入口和已有笔记标记。
- Markdown 笔记的读取、编辑、预览、保存、独立删除与并发冲突保护。
- 用户主动发布、更新公开版本、取消公开；新建和 AI 生成的树默认仍为私人树。
- 公共池展示用户发布的树、发布者及派生来源；官方树继续显示“MapFlow 官方”。
- 公开树仍按现有逻辑复制为加入者自己的私人副本。
- MCP 增加读取／改写笔记、发布／取消公开和获取最新版操作指南的工具。
- 更新 MapFlow Skill、站内 MCP 指南和相关说明。
- 用户发布频率和活动数量上限、公共目录分页、账号封禁联动，以及管理员最小发布列表和紧急下架能力。

### 2.2 不包含

- 图片上传、附件、画板、Mermaid、XML 图表或允许 Markdown 加载远程图片。
- 笔记历史版本、多人共同编辑、富文本编辑器和跨节点知识库。
- 点赞、评论、通知和用户举报入口。本期只为后续互动保留稳定的公开版本标识；管理员发布列表与紧急下架属于公共内容上线前的必要能力，纳入本期。
- 自动公开、默认勾选公开，或 AI 未经用户明确要求自行发布。

## 3. 产品行为

### 3.1 节点笔记

私人树的节点详情面板增加一个笔记按钮：

- 没有笔记时显示“写笔记”；
- 已有笔记时显示“查看笔记”，节点卡片显示一个低干扰的笔记标记；
- 公共池预览不显示也不允许写个人笔记，用户需先把树加入自己的技能树。

点击后打开同一个弹窗，提供“阅读”和“编辑”两种状态。编辑区使用纯文本 Markdown，支持标题、列表、任务列表、表格、引用、链接和代码块；“预览”使用与阅读状态相同的安全渲染器。保存是显式动作，关闭含未保存内容的弹窗时必须二次确认。

一份笔记最多 30,000 个 Unicode 字符。保存时正文必须含有至少一个非空白字符；空白正文返回 `note_content_empty`，不能静默清掉已有内容。弹窗提供独立的“删除笔记”按钮并二次确认。保存或删除成功后立刻更新节点标记和阅读视图，不等待整棵树重新加载。

笔记正文不随学习进度重置而删除。删除私人树、从树中删除对应节点，或删除个人库条目时，相关笔记随外键级联删除。

### 3.2 冲突语义

每份笔记有单调递增的 `version`。首次读取从未存在的笔记时返回空正文、`has_note = false` 和 `version = 0`。首次写入得到 v1；删除时保留墓碑行，将正文设为 `NULL` 并把版本继续加一。删除后的读取返回空正文、`has_note = false` 和墓碑的实际版本，不能回到 v0。重新写入在墓碑版本上继续递增，从而消除“创建 → 删除 → 重建”的 ABA 窗口。

保存或删除时客户端必须提交刚读取的版本：

- 版本相同：写入成功并返回新版本；
- 版本不同：返回 `409 note_version_conflict`，不得覆盖服务器正文；
- 弹窗提示“笔记已在其他窗口或由 AI 更新”，允许重新加载最新版后继续编辑。

对一条从未存在的笔记执行 `DELETE expected_version = 0` 是无副作用成功并保持 v0；一旦产生过正文，后续删除均保留墓碑。`noted_node_ids` 只选择 `markdown_content IS NOT NULL` 的记录。

这个约束同样适用于 MCP，避免浏览器和 AI 同时编辑时静默丢失用户内容。

### 3.3 Markdown 安全边界

前端使用 `react-markdown` 与 `remark-gfm` 渲染，不启用原始 HTML。渲染器禁用 `img`，拒绝 `javascript:`、`data:`、`file:` 等非网页协议，并为外部链接加安全属性。Markdown 正文只作为文本存储，服务端不保存渲染后的 HTML。

因此第一版可以表达结构化文字和代码，但不会通过 Markdown 偷带远程追踪图片、脚本或任意 HTML。图表能力以后作为明确的数据格式单独设计。

### 3.4 发布到公共池

私人树的操作菜单增加“发布到公共池”。第一次发布前显示确认窗口，明确展示：

- 将公开树标题、描述、节点、连线、学习块和布局所需字段；
- 将公开当前账号的显示名称；
- 不会公开节点笔记、学习进度、聊天记录、生成对话、账号标识、邮箱或手机号；
- 发布的是当前修订的副本，之后编辑私人树不会悄悄改变公共版本。

确认后，服务端在同一事务中复制当前树结构，生成新的公开树和发布记录。页面显示“已公开”和本次公开所对应的私人树修订号。

私人树继续修改后，操作变为“更新公共版本”。更新也需要确认；服务端创建新的公开快照，将旧快照标记为 `archived`，再把新快照设为活动版本。已经复制旧版的用户保留原有私人副本，不被强制改写。

“取消公开”将活动公共快照标记为 `archived`。它立即从公共池消失，但已经加入他人库中的私人副本继续存在。以后再次公开会产生新的公共快照。

删除存在活动公开版本的私人树时，删除确认框必须明确说明“公共版本也会同时取消公开”。服务端锁定源树与活动发布，并在删除个人库条目的同一个事务中把发布记录改为 `withdrawn`、把公共快照改为 `archived`，之后才删除或归档私人源树。删除与发布／更新使用同一把源树行锁：删除先完成时发布返回资源不存在，发布先完成时删除会看到并撤回最新活动版本，因此不会留下失去管理入口的公开快照。

同一棵源私人树在任意时刻最多有一个活动公开版本。重复的同一幂等请求返回原结果，不产生重复卡片。

### 3.5 公共池展示

公共列表和详情展示发布者显示名称与发布时间：

- 官方树：`MapFlow 官方`；
- 用户树：发布时保存的发布者显示名称快照。

发布者之后改名不回写历史发布记录，避免公共卡片身份随时间产生歧义。公共接口不返回 `account_id`、`player_id` 或联系方式。界面统一使用“发布者”，不能把发布者无条件称为原作者。

如果私人树来自公共树的复制，发布记录同时保存直接来源与根来源。公共卡片显示“基于《来源树标题》· 原发布者／官方来源”，详情可继续查看来源链；更新公开版本时沿用源私人树已经保存的来源链，不能因重新发布而洗掉归属。来源公开版本即使后来归档，署名快照仍保留。

### 3.6 公共内容治理

用户公开树上线时同时启用以下硬限制：

- 每账号滚动一小时最多成功发布或更新 5 次，超限返回 `429 publication.rate_limited`；
- 每账号最多 20 个活动公开版本，超限返回 `409 publication.active_limit_reached`；
- 每个公开快照最多 500 个节点、2,000 条边、64 个学习块，继续执行现有逐字段长度和图完整性校验；
- 公共目录使用不透明游标分页，默认和最大页大小均为 50，按 `catalog_published_at DESC, tree_id DESC` 稳定排序；用户树的目录发布时间取发布记录的 `published_at`，官方树取首次进入公共目录的 `created_at`；
- 公共列表与公开详情都执行相同的可见性条件，不能通过已知 `public_tree_id` 绕过下架；
- 管理后台提供最小发布列表、查看发布者／来源和“紧急下架”操作，必须填写内部原因并写审计事件；用户举报入口仍留到下一阶段；
- 管理员下架将发布状态改为 `removed` 并归档公共树；封禁账号时，同一管理事务撤下该账号全部活动发布，已经复制到其他账号的私人副本不受影响。

树标题、描述、节点正文和其他用户生成字段始终作为不可信数据。把公开树复制到私人库后，知识聊天只能把这些字段放入受边界约束的知识上下文，不能把树内容解释为系统指令、工具授权或审批结果。

## 4. 数据设计

### 4.1 节点笔记

新增 `account_node_notes`：

```sql
CREATE TABLE account_node_notes (
    library_entry_id UUID NOT NULL,
    tree_id UUID NOT NULL,
    node_id TEXT NOT NULL,
    markdown_content TEXT,
    version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (library_entry_id, node_id),
    FOREIGN KEY (library_entry_id, tree_id)
      REFERENCES account_tree_library(library_entry_id, tree_id) ON DELETE CASCADE,
    FOREIGN KEY (tree_id, node_id)
      REFERENCES skill_nodes(tree_id, node_id) ON DELETE CASCADE
);
```

数据库约束要求非空正文长度为 1 到 30,000 个字符且至少包含一个非空白字符、`version > 0` 且时间顺序有效。`markdown_content IS NULL` 表示删除墓碑，不删除行；只有对应节点或个人库条目消失时才级联删除笔记行。

笔记归属通过 `account_tree_library.account_id` 校验，不能只凭 `library_entry_id` 或 `node_id` 访问。未归属、节点不存在和条目不存在对外统一返回资源不存在，防止枚举其他账号的数据。

### 4.2 用户发布记录

新增 `user_tree_publications`：

```sql
CREATE TABLE user_tree_publications (
    publication_id UUID PRIMARY KEY,
    public_tree_id UUID NOT NULL UNIQUE,
    source_tree_id UUID,
    source_revision BIGINT NOT NULL,
    publisher_account_id UUID,
    publisher_display_name TEXT NOT NULL,
    derived_from_public_tree_id UUID,
    root_public_tree_id UUID,
    derived_from_title TEXT,
    derived_from_publisher_display_name TEXT,
    state TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    ended_reason TEXT,
    FOREIGN KEY (public_tree_id) REFERENCES skill_trees(tree_id) ON DELETE RESTRICT,
    FOREIGN KEY (source_tree_id) REFERENCES skill_trees(tree_id) ON DELETE SET NULL,
    FOREIGN KEY (publisher_account_id) REFERENCES accounts(account_id) ON DELETE SET NULL,
    FOREIGN KEY (derived_from_public_tree_id) REFERENCES skill_trees(tree_id) ON DELETE RESTRICT,
    FOREIGN KEY (root_public_tree_id) REFERENCES skill_trees(tree_id) ON DELETE RESTRICT
);
```

`state` 只允许 `active`、`superseded`、`withdrawn`、`removed`。局部唯一索引保证每个非空 `source_tree_id` 最多一个 `active` 记录；检查约束要求活动记录具有非空源树、发布者且 `ended_at IS NULL`，结束状态则必须有 `ended_at`。发布时保存发布者与直接来源的显示快照；账号、源私人树或来源公开树以后归档时，历史仍可解释。直接来源取私人树的 `forked_from_tree_id`；根来源沿用直接来源发布记录中的 `root_public_tree_id`，没有时取直接来源自身。原创私人树的两个来源字段均为空。

公开快照的 `skill_trees.owner_account_id` 保持为空，所有权与展示来源只通过发布表表达，避免现有私人树授权逻辑误把公开副本当成可编辑资产。快照复制树、节点、连线、学习块与节点块归属，不复制个人库、进度、笔记、聊天或生成会话。

### 4.3 发布动作回执

新增账号级 `tree_publication_action_receipts`，主键为 `(account_id, idempotency_key)`，保存：

- `action`：`publish`、`update` 或 `unpublish`；
- 规范化请求的 SHA-256 `request_digest`；
- 确认令牌的唯一 `confirmation_nonce`；
- 源树、源修订、操作前预期公共树；
- `publication_id`、结果公共树、稳定响应 JSON 与完成时间。

回执中的源树和公共树 UUID 是不可变的审计值，不使用会阻止源私人树删除的 `RESTRICT` 外键；删除个人库条目或源树不能抹掉已经提交的回执。

执行顺序先按账号和幂等键读取回执：同一摘要返回原始结果，即使当前发布状态后来已经变化；同一键配不同摘要返回 `409 publication.idempotency_conflict`。新请求必须成功占用回执键和确认 nonce 后才能改变发布状态，回执与状态改变在同一事务提交。准备接口签发包含随机 nonce 的 HMAC 认证不透明令牌，不保存服务端可见状态；令牌有效期为 10 分钟，并绑定账号、个人库条目、源树、动作、源修订、操作前公共树、公开字段摘要和发布者显示名称。令牌过期、签名无效、被另一幂等键消费或绑定内容变化均返回稳定错误。

### 4.4 可见状态的权威规则

对用户发布的树，公共可见性由发布记录和树记录共同决定，任何读取都必须满足：

```sql
publication.state = 'active'
AND tree.visibility = 'public'
AND tree.lifecycle = 'ready'
AND publisher_account.status = 'active'
```

这是失败关闭的联合条件，不把其中任一字段单独视为公共状态。状态转换必须在一个事务中同步完成：

| 动作 | 原发布 | 原公共树 | 新发布 | 新公共树 |
| --- | --- | --- | --- | --- |
| 首次发布 | 无 | 无 | `active` | `ready` |
| 更新版本 | `active → superseded` | `ready → archived` | `active` | `ready` |
| 用户取消／删除源树 | `active → withdrawn` | `ready → archived` | 无 | 无 |
| 管理员下架／封禁发布者 | `active → removed` | `ready → archived` | 无 | 无 |

官方树没有用户发布记录，继续由现有官方目录条件管理。监控任务定期检查状态漂移并告警；查询遇到漂移时不展示内容。

## 5. HTTP 接口

### 5.1 笔记

```text
GET    /api/me/tree-library/:libraryEntryId/nodes/:nodeId/note
PUT    /api/me/tree-library/:libraryEntryId/nodes/:nodeId/note
DELETE /api/me/tree-library/:libraryEntryId/nodes/:nodeId/note
```

读取返回：

```json
{
  "node_id": "transactions",
  "markdown": "## 我的理解\n...",
  "has_note": true,
  "version": 3,
  "updated_at": "2026-09-23T12:00:00Z"
}
```

从未存在时返回空正文、`has_note = false`、`version = 0`、`updated_at = null`；墓碑返回空正文、`has_note = false`、实际版本与删除时间。`PUT` 接收非空白 `markdown` 与 `expected_version`；`DELETE` 接收 `expected_version` 并保留墓碑。个人树详情只增加轻量的 `noted_node_ids`，笔记正文始终按需读取，避免一棵大树首次打开时加载所有笔记。

### 5.2 公开版本

```text
POST   /api/me/tree-library/:libraryEntryId/publication/prepare
POST   /api/me/tree-library/:libraryEntryId/publication
POST   /api/me/tree-library/:libraryEntryId/publication/unpublish-prepare
DELETE /api/me/tree-library/:libraryEntryId/publication
```

准备接口不改变公共状态。发布准备接收当前私人树 `expected_revision`，返回精确的公开字段、发布者显示名称、来源署名、当前修订、当前活动公共树和 10 分钟有效的确认令牌。取消准备接收 `expected_public_tree_id`，返回将要撤下的公共版本和确认令牌。浏览器必须先展示准备结果，再由用户确认执行。

执行发布的 `POST` 接收确认令牌并要求 `Idempotency-Key`。没有活动版本时创建首次快照；已有活动版本且源修订更新时执行版本替换；修订相同则返回现有发布结果。执行取消的 `DELETE` 同时要求确认令牌、`expected_public_tree_id` 与 `Idempotency-Key`，旧窗口不能撤下后来出现的新版本。

发布／更新事务先锁定源私人树和当前活动发布，再重新验证令牌中的源修订和预期公共树。两个并发新请求只有一个能完成状态转换；其余请求返回 `409 publication.state_conflict`，响应附带最新活动公共树和源修订，不能顺势更新另一个窗口刚发布的版本。同一幂等键重试则由回执返回第一次的原始结果。

个人库条目增加只读发布状态：活动 `public_tree_id`、`source_revision`、`published_at` 和是否落后于当前修订。公共列表条目增加：

```json
{
  "publisher": {
    "kind": "user",
    "display_name": "示例用户"
  },
  "derived_from": {
    "public_tree_id": "来源树 ID",
    "title": "来源树标题",
    "publisher_display_name": "原发布者"
  },
  "published_at": "2026-09-23T12:00:00Z"
}
```

原创树的 `derived_from` 为 `null`；官方树使用 `publisher.kind = "official"` 与固定显示名称。已有客户端缺少新字段时仍可读取树主体。

公共目录响应增加 `next_cursor`。游标编码最后一项的 `(catalog_published_at, tree_id)`，服务端固定按这两个字段倒序查下一页；无更多数据时为 `null`。公共详情与目录共用同一个可见发布查询，管理员已下架、发布者非活动或双状态不一致的树统一返回不存在。

### 5.3 管理员紧急下架

```text
GET  /api/admin/tree-publications?cursor=:cursor&limit=:limit
POST /api/admin/tree-publications/:publicationId/remove
```

管理员列表复用 50 条不透明游标分页，并显示发布者、直接／根来源、发布时间、当前状态和公共树标识。下架接口接收 1 到 500 字的内部 `reason` 与 `Idempotency-Key`，只允许把当前 `active` 记录转为 `removed`；事务同步归档公共树并写管理员审计事件。重复下架返回当前状态，不把内容恢复为可见。现有账号封禁事务扩展为锁定并撤下该账号的全部活动发布。

## 6. MCP 与 Skill

服务器端 MCP 工具增加：

| 工具 | 行为 |
| --- | --- |
| `mapflow.get_usage_guide` | 返回服务器当前版本的操作规则、能力摘要和兼容版本信息 |
| `mapflow.get_node_note` | 读取当前账号私人树某节点的最新 Markdown、版本和更新时间 |
| `mapflow.set_node_note` | 用 `expectedVersion` 和非空白正文替换整份笔记 |
| `mapflow.delete_node_note` | 在用户明确要求后用 `expectedVersion` 删除笔记并保留墓碑 |
| `mapflow.prepare_tree_publication` | 只读返回公开范围、发布者、来源、修订和短期确认令牌 |
| `mapflow.publish_tree` | 使用确认令牌和幂等键发布或更新公共快照 |
| `mapflow.prepare_tree_unpublication` | 只读返回将撤下的精确公共版本和短期确认令牌 |
| `mapflow.unpublish_tree` | 使用确认令牌、`expectedPublicTreeId` 和幂等键取消公开 |

笔记工具不提供“追加”操作，也不能用空正文暗含删除。Skill 要求 AI 先读最新版，再在原文基础上精炼、补充和重组，最后携带版本号整体替换；不能把聊天回复机械堆到末尾。冲突后必须重读并重新合并。删除必须调用独立工具，并在用户明确要求删除时执行。

`acknowledgePublicScope = true` 不作为授权证据。AI 必须先调用准备工具，把返回的精确公开字段、发布者显示名称、来源署名、修订和目标公共树呈现给用户；用户在该准备结果之后明确确认，才可把短期令牌交给执行工具。令牌由服务端绑定账号和内容，工具 annotations 也只用于客户端风险展示，两者都不能替代会话中的明确用户意图。读取、写笔记不会暗含发布授权。

### 6.1 MCP 工具安全元数据

服务器 `tools/list` 的每个工具都返回 MCP `annotations`，relay 将其原样传给 `registerTool`。新增工具至少使用以下值：

| 工具 | `readOnlyHint` | `destructiveHint` | `idempotentHint` | `openWorldHint` |
| --- | --- | --- | --- | --- |
| `get_usage_guide` / `get_node_note` | `true` | `false` | `true` | `false` |
| `prepare_tree_publication` / `prepare_tree_unpublication` | `true` | `false` | `true` | `false` |
| `set_node_note` / `delete_node_note` | `false` | `true` | `true` | `false` |
| `publish_tree` / `unpublish_tree` | `false` | `true` | `true` | `true` |

笔记写操作的“幂等”只表示同一参数重试不会产生第二次内容变化；第一次成功后的重试可以因版本已变化而返回冲突。发布动作通过持久化回执保证相同幂等键与请求摘要返回原结果。现有 MCP 工具也在同一改动中补齐准确 annotations，避免目录中出现两套风险语义。

### 6.2 MCP 与 Skill 更新机制

`@mapflow-publish/mcp` 是薄转发层：每次进程启动都会从 MapFlow 服务器调用 `tools/list` 并动态注册工具。普通服务器工具和 schema 更新仍不要求卸载 npm 包；但现有 relay 只转发 `description` 与 `inputSchema`，本期必须发布新版 relay，增加 annotations 转发和自身版本头。旧 relay 虽可能看见新工具，却缺少完整风险元数据；服务器对发布类工具返回 `mcp.relay_upgrade_required`，直到客户端使用满足 `minimumRelayVersion` 的版本并重启。

站内命令统一为：

```bash
npx -y --prefer-online @mapflow-publish/mcp@latest
```

这会优先检查 npm 上的最新版，不要求用户手工清缓存或卸载旧版本。本期用户需要执行一次该命令并重启 MCP；以后仅服务器目录变化时仍只需重启。

Skill 文件本身没有运行时自动更新能力。本次机制准确称为“会话期规则同步”：新版本地 Skill 记录自己的 `skillVersion`，并规定每个 MapFlow 会话开始时调用 `mapflow.get_usage_guide({ skillVersion })`。响应包含 `guideVersion`、`minimumSkillVersion`、`minimumRelayVersion`、兼容状态、当前工具流程与限制。需要最新规则的写工具携带 `guideVersion`；过旧或缺失时分别返回 `mcp.skill_upgrade_required`、`mcp.relay_upgrade_required` 或 `mcp.guide_version_required`。`skillVersion` 是 Agent 按本地 Skill 声明提交的兼容性信息，不是不可伪造的授权凭证；发布安全仍由服务器令牌、资源锁、版本校验和回执保证。

用户首次需要重新执行：

```bash
npx skills add rongyan-123/MapFlow --skill mapflow-mcp --global
```

服务器指南不可覆盖“必须有用户明确发布意图”“先读后写且保留用户原意”等本地稳定安全规则。获取指南失败时，Agent 使用本地保守规则继续执行 `get_progress`、`get_tree`、`get_node_note` 等只读操作；公开发布、取消公开和其他要求当前指南的写操作保持禁用并说明原因。动态指南不能被描述成本地 Skill 自动更新。

## 7. 权限、隐私与一致性

- 所有笔记和发布写接口要求当前登录账号、CSRF（浏览器）或有效 MCP 令牌、资源归属校验与稳定错误码。
- 服务端重新计算账号显示名称、源树修订、派生来源和快照内容，不信任客户端提交的发布者、来源或树正文。
- 公开快照在数据库事务内一次性写完；任何节点、连线或块复制失败都不得留下可见的半棵树。
- 更新公开版本时先写好新快照，再切换活动记录和归档旧树，公共目录不会出现短暂空窗。
- 取消公开不删除他人的私人副本，也不泄漏哪些账号曾经复制过该树。
- 删除源私人树、管理员下架和账号封禁都必须同步撤下活动公开版本；公开目录与详情查询按联合可见条件失败关闭。
- 发布频率与活动数量在数据库事务中按账号校验，不能使用单进程内存计数代替跨实例一致的限制。
- MCP 确认令牌、工具 annotations 和动态指南分别承担内容绑定、客户端提示和会话期说明，任何一项都不单独充当用户授权。
- 公开操作写入结构化审计事件，包含账号、源树、源修订、公共树、动作和结果，不记录节点笔记正文。

## 8. 实现顺序与验证

所有业务逻辑按“测试先红、实现后绿”推进。

1. **数据库与领域层**：先写迁移契约、仓储和服务测试，再实现笔记版本控制与公开快照事务。
   验证：归属隔离、30,000 字限制、墓碑版本单调性、创建／更新／独立删除、ABA 与版本冲突、快照排除私人数据、来源链、联合状态转换、源树删除联动、并发发布、确认令牌、回执摘要冲突与原结果重放测试通过。
2. **HTTP 层**：先写路由与错误映射测试，再接入应用服务。
   验证：未登录、CSRF、越权、资源枚举、旧窗口取消、发布频率、活动数量、节点／边／块上限、50 条游标分页、直接详情绕过、封禁联动、管理员下架和稳定错误码测试通过。
3. **MCP 与 relay**：先写工具目录、annotations、schema、两阶段调用、版本协商与 relay 转发测试，再增加新工具并发布新版 npm relay。
   验证：`tools/list` 含完整安全元数据；新版 relay 原样转发；旧 relay 被发布工具稳定拒绝；准备令牌不能跨账号、跨修订、跨动作、过期或重复消费；笔记先读后写和删除使用独立工具。
4. **前端笔记**：先写客户端与组件交互测试，再实现按钮、标记、弹窗和安全 Markdown 渲染。
   验证：从未写过／已有／墓碑笔记、未保存关闭、预览、空白保存拒绝、删除二次确认、ABA 与并发冲突、危险链接／图片不渲染。
5. **前端发布**：先写发布状态和确认文案测试，再实现公开、更新、取消与发布者展示。
   验证：默认私人、准备结果后明确确认、旧公开版本归档、旧窗口不能取消新版本、公共卡片显示发布者和派生来源、源树删除警告、分页、限额、下架隐藏、个人笔记不出现在公共响应。
6. **Skill 与文档**：更新 Skill 引导、站内命令和能力说明。
   验证：运行 Skill `quick_validate.py`，验证 `guideVersion` 与最低版本协商、指南失败时只读降级，并对 MCP 安装／`@latest` 升级／重启路径做一次干净环境演练。
7. **完成前检查**：后端运行格式化、完整测试、静态检查；前端和 MCP relay 运行完整测试、类型检查和生产构建；自审最终 diff。
   验证：全部检查通过后，使用 browser-harness 在真实浏览器完成写／删／重建笔记、AI 改写、两阶段发布、公共池查看发布者与来源、其他账号复制、旧窗口取消冲突、源树删除联动和管理员下架的端到端验收并截图。

## 9. 后续论坛能力

点赞、评论和用户举报入口在本期之后单独设计。下一阶段至少需要：每账号每公开版本一次点赞、游标分页评论、发布者删除自己的评论、树发布者隐藏评论、用户举报流程、限流、内容长度和公开版本取消后的展示规则。评论应绑定 `publication_id`，避免更新公共版本后把旧讨论错误挂到新内容上。本期已经具备管理员发布列表、账号封禁联动和紧急下架，不等待论坛功能上线。
