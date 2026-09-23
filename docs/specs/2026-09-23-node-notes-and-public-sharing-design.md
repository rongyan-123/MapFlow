# 节点笔记与用户技能树公开设计

日期：2026-09-23
状态：范围已确认，等待文档复核后进入 TDD 实现

## 1. 目标

本期解决两个连续的使用问题：

1. 用户学完一个节点后，可以把自己的理解保存成一份持续修订的 Markdown 笔记，第二天回来仍能直接复习；
2. 用户可以主动把个人技能树的当前版本发布到公共池，其他用户看到作者后，可以像使用官方树一样复制一份私人副本。

同时扩展 MapFlow MCP 与配套 Skill，使 AI 可以在获得用户明确指令后读取、改写节点笔记和发布技能树。笔记是“活的总结”，每个用户、每棵私人树、每个节点只有一份当前正文，不设计成不断追加的时间线。

## 2. 本期范围

### 2.1 包含

- 私人树节点详情增加“写笔记／查看笔记”入口和已有笔记标记。
- Markdown 笔记的读取、编辑、预览、保存、清空与并发冲突保护。
- 用户主动发布、更新公开版本、取消公开；新建和 AI 生成的树默认仍为私人树。
- 公共池展示用户发布的树及其作者；官方树继续显示“MapFlow 官方”。
- 公开树仍按现有逻辑复制为加入者自己的私人副本。
- MCP 增加读取／改写笔记、发布／取消公开和获取最新版操作指南的工具。
- 更新 MapFlow Skill、站内 MCP 指南和相关说明。

### 2.2 不包含

- 图片上传、附件、画板、Mermaid、XML 图表或允许 Markdown 加载远程图片。
- 笔记历史版本、多人共同编辑、富文本编辑器和跨节点知识库。
- 点赞、评论、通知、举报和管理后台。本期只为后续互动保留稳定的公开版本标识，不提前做半套论坛。
- 自动公开、默认勾选公开，或 AI 未经用户明确要求自行发布。

## 3. 产品行为

### 3.1 节点笔记

私人树的节点详情面板增加一个笔记按钮：

- 没有笔记时显示“写笔记”；
- 已有笔记时显示“查看笔记”，节点卡片显示一个低干扰的笔记标记；
- 公共池预览不显示也不允许写个人笔记，用户需先把树加入自己的技能树。

点击后打开同一个弹窗，提供“阅读”和“编辑”两种状态。编辑区使用纯文本 Markdown，支持标题、列表、任务列表、表格、引用、链接和代码块；“预览”使用与阅读状态相同的安全渲染器。保存是显式动作，关闭含未保存内容的弹窗时必须二次确认。

一份笔记最多 30,000 个 Unicode 字符。仅包含空白的保存等同于清空笔记。保存成功后立刻更新节点标记和阅读视图，不等待整棵树重新加载。

笔记正文不随学习进度重置而删除。删除私人树、从树中删除对应节点，或删除个人库条目时，相关笔记随外键级联删除。

### 3.2 冲突语义

每份笔记有单调递增的 `version`。首次读取不存在的笔记时返回空正文和 `version = 0`。保存或清空时客户端必须提交刚读取的版本：

- 版本相同：写入成功并返回新版本；
- 版本不同：返回 `409 note_version_conflict`，不得覆盖服务器正文；
- 弹窗提示“笔记已在其他窗口或由 AI 更新”，允许重新加载最新版后继续编辑。

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

同一棵源私人树在任意时刻最多有一个活动公开版本。重复的同一幂等请求返回原结果，不产生重复卡片。

### 3.5 公共池展示

公共列表和详情展示作者显示名称与发布时间：

- 官方树：`MapFlow 官方`；
- 用户树：发布时保存的作者显示名称快照。

作者之后改名不回写历史发布记录，避免公共卡片身份随时间产生歧义。公共接口不返回 `account_id`、`player_id` 或联系方式。

## 4. 数据设计

### 4.1 节点笔记

新增 `account_node_notes`：

```sql
CREATE TABLE account_node_notes (
    library_entry_id UUID NOT NULL,
    tree_id UUID NOT NULL,
    node_id TEXT NOT NULL,
    markdown_content TEXT NOT NULL,
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

数据库约束要求正文长度为 1 到 30,000 个字符、`version > 0` 且时间顺序有效。空白正文不入库。

笔记归属通过 `account_tree_library.account_id` 校验，不能只凭 `library_entry_id` 或 `node_id` 访问。未归属、节点不存在和条目不存在对外统一返回资源不存在，防止枚举其他账号的数据。

### 4.2 用户发布记录

新增 `user_tree_publications`：

```sql
CREATE TABLE user_tree_publications (
    publication_id UUID PRIMARY KEY,
    public_tree_id UUID NOT NULL UNIQUE,
    source_tree_id UUID,
    source_revision BIGINT NOT NULL,
    creator_account_id UUID,
    creator_display_name TEXT NOT NULL,
    state TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    FOREIGN KEY (public_tree_id) REFERENCES skill_trees(tree_id) ON DELETE RESTRICT,
    FOREIGN KEY (source_tree_id) REFERENCES skill_trees(tree_id) ON DELETE SET NULL,
    FOREIGN KEY (creator_account_id) REFERENCES accounts(account_id) ON DELETE SET NULL
);
```

`state` 只允许 `active`、`superseded`、`withdrawn`。局部唯一索引保证每个非空 `source_tree_id` 最多一个 `active` 记录。发布时保存作者显示名称快照；账号或源私人树以后删除时，公开历史仍可解释。

公开快照的 `skill_trees.owner_account_id` 保持为空，所有权与展示来源只通过发布表表达，避免现有私人树授权逻辑误把公开副本当成可编辑资产。快照复制树、节点、连线、学习块与节点块归属，不复制个人库、进度、笔记、聊天或生成会话。

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
  "version": 3,
  "updated_at": "2026-09-23T12:00:00Z"
}
```

不存在时返回同结构的空正文、`version = 0`、`updated_at = null`。`PUT` 接收 `markdown` 与 `expected_version`；`DELETE` 接收 `expected_version`。个人树详情只增加轻量的 `noted_node_ids`，笔记正文始终按需读取，避免一棵大树首次打开时加载所有笔记。

### 5.2 公开版本

```text
POST   /api/me/tree-library/:libraryEntryId/publication
DELETE /api/me/tree-library/:libraryEntryId/publication
```

`POST` 接收当前私人树 `expected_revision` 与 `Idempotency-Key`。没有活动版本时创建首次快照；已有活动版本且源修订更新时执行版本替换；修订相同则返回现有发布结果。`DELETE` 取消当前活动版本，并要求 `Idempotency-Key`。

个人库条目增加只读发布状态：活动 `public_tree_id`、`source_revision`、`published_at` 和是否落后于当前修订。公共列表条目增加：

```json
{
  "creator": {
    "kind": "user",
    "display_name": "示例用户"
  },
  "published_at": "2026-09-23T12:00:00Z"
}
```

官方树使用 `kind = "official"` 与固定显示名称。已有客户端缺少新字段时仍可读取树主体。

## 6. MCP 与 Skill

服务器端 MCP 工具增加：

| 工具 | 行为 |
| --- | --- |
| `mapflow.get_usage_guide` | 返回服务器当前版本的操作规则、能力摘要和 Skill 最低兼容版本 |
| `mapflow.get_node_note` | 读取当前账号私人树某节点的最新 Markdown、版本和更新时间 |
| `mapflow.set_node_note` | 用 `expectedVersion` 替换整份笔记；空正文表示清空 |
| `mapflow.publish_tree` | 在用户明确要求并确认公开范围后发布或更新公共快照 |
| `mapflow.unpublish_tree` | 在用户明确要求后取消活动公开版本 |

笔记工具不提供“追加”操作。Skill 要求 AI 先读最新版，再在原文基础上精炼、补充和重组，最后携带版本号整体替换；不能把聊天回复机械堆到末尾。冲突后必须重读并重新合并。

发布工具要求 `expectedRevision`、新的 `idempotencyKey` 与 `acknowledgePublicScope = true`。工具说明和 Skill 都必须规定：只有用户明确表达发布意图，且知道作者显示名称和树结构会公开时，AI 才能调用。读取、写笔记不会暗含发布授权。

### 6.1 更新机制

`@mapflow-publish/mcp` 是薄转发层：每次进程启动都会从 MapFlow 服务器调用 `tools/list` 并按返回的 schema 注册工具。因此本次只增加服务器工具时，用户无需卸载或重新安装 npm 包，只需重启 Agent 或 MCP 进程。

只有转发层自身协议、授权或运行时代码发生变化时才需要发布新 npm 版本。站内命令统一为：

```bash
npx -y --prefer-online @mapflow-publish/mcp@latest
```

这会优先检查 npm 上的最新版，不要求用户手工清缓存或卸载旧版本。

Skill 文件本身没有运行时自动更新能力。本次先发布一版新的本地 Skill，规定每个 MapFlow 会话开始时调用 `mapflow.get_usage_guide`。以后工具用法、限制和推荐流程的变化由服务器指南下发；只有 Skill 的稳定行为契约或入口机制变化时，用户才需重新执行：

```bash
npx skills add rongyan-123/MapFlow --skill mapflow-mcp --global
```

服务器指南不可覆盖“必须有用户明确发布意图”“先读后写且保留用户原意”等稳定安全约束。

## 7. 权限、隐私与一致性

- 所有笔记和发布写接口要求当前登录账号、CSRF（浏览器）或有效 MCP 令牌、资源归属校验与稳定错误码。
- 服务端重新计算账号显示名称、源树修订和快照内容，不信任客户端提交的作者或树正文。
- 公开快照在数据库事务内一次性写完；任何节点、连线或块复制失败都不得留下可见的半棵树。
- 更新公开版本时先写好新快照，再切换活动记录和归档旧树，公共目录不会出现短暂空窗。
- 取消公开不删除他人的私人副本，也不泄漏哪些账号曾经复制过该树。
- 公开操作写入结构化审计事件，包含账号、源树、源修订、公共树、动作和结果，不记录节点笔记正文。

## 8. 实现顺序与验证

所有业务逻辑按“测试先红、实现后绿”推进。

1. **数据库与领域层**：先写迁移契约、仓储和服务测试，再实现笔记版本控制与公开快照事务。
   验证：归属隔离、30,000 字限制、创建／更新／清空、版本冲突、快照排除私人数据、更新归档、取消公开与幂等测试通过。
2. **HTTP 层**：先写路由与错误映射测试，再接入应用服务。
   验证：未登录、CSRF、越权、资源枚举、`409` 冲突和响应兼容性测试通过。
3. **MCP 层**：先写工具清单、schema、调用分派与权限测试，再增加五个工具。
   验证：进程重启后动态发现新工具；笔记先读后写和发布确认参数有机器可识别的错误。
4. **前端笔记**：先写客户端与组件交互测试，再实现按钮、标记、弹窗和安全 Markdown 渲染。
   验证：空／已有笔记、未保存关闭、预览、清空、并发冲突、危险链接／图片不渲染。
5. **前端发布**：先写发布状态和确认文案测试，再实现公开、更新、取消与作者展示。
   验证：默认私人、明确确认、旧公开版本归档、公共卡片作者正确、个人笔记不出现在公共响应。
6. **Skill 与文档**：更新 Skill 引导、站内命令和能力说明。
   验证：运行 Skill `quick_validate.py`，并对 MCP 安装／重启／更新路径做一次干净环境演练。
7. **完成前检查**：后端运行格式化、完整测试、静态检查；前端和 MCP relay 运行完整测试、类型检查和生产构建；自审最终 diff。
   验证：全部检查通过后，使用 browser-harness 在真实浏览器完成写笔记、AI 改写、发布、公共池查看作者、其他账号复制和取消公开的端到端验收并截图。

## 9. 后续论坛能力

点赞和评论在本期之后单独设计。下一阶段至少需要：每账号每公开版本一次点赞、游标分页评论、作者删除自己的评论、树作者隐藏评论、举报与管理入口、限流、内容长度和公开版本取消后的展示规则。评论应绑定 `publication_id`，避免更新公共版本后把旧讨论错误挂到新内容上。
