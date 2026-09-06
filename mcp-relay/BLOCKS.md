# MapFlow 块组织规范(供 Agent 参考)

> 本文说明如何把一棵 MapFlow 树按你自己的语义重组。
> 底层原语就是 MCP 工具本身,任何重组都可用文中的四步完成;
> 除工具外不需要任何「重组专用」能力。

## 背景与两条铁律

MapFlow 的树由 AI 生成,默认按「难度/推荐顺序」排布,适合顺着学。
块(block)是树级可选分组:把节点按你的学习语境归堆(如「先补安全再看质量」),
默认难度视图原样不动,树的主人(用户)随时可回到默认排布。

1. **一个节点只能属于一个块。** 需要同一知识点出现在两种语境时,不要复制节点——
   树在画布上每个知识点只能画一次。语境里缺的「转变后的形态」用新节点表达(第 4 步)。
2. **树是持续演化的。** 重组不是一次性导出,而是在同一棵树上的增量修改。
   每轮「读全量 → 设计 → 提交」后,树更贴近用户的真实学习方式;可以反复做。

## 四步流程

### 第 1 步:找到目标树(只读)

调用 `mapflow.get_progress`,从返回的树列表里挑出目标树,
记下它的 `libraryEntryId` 与当前进度(别选已完成 100% 的树做重组实验)。

### 第 2 步:读全量,建立心智模型(只读)

调用 `mapflow.get_tree`,参数 `{ "libraryEntryId": "…" }`,
拿到 `nodes`(标题/说明/难度/深度)、`edges`(依赖边)、`blocks`,
以及响应 `tree` 内的当前 `revision`(完成情况在顶层 `completedNodeIds`)。
先在脑子里回答三个问题再动手:

- 这棵树在讲什么?主线大概分几段?
- 用户当前学到哪?哪些已完成节点提示了用户的实际兴趣?
- 按你的目标语境,哪些节点该归到同一块?缺什么形态的节点?

### 第 3 步:建块并归位(写)

一条命令 = 一次 `mapflow.apply_tree_mutation` 调用;`revision` 填「第 2 步读到、
或上一条命令响应返回」的最新值,`idempotencyKey` 由你生成一次性唯一号
(同号重发不重复生效)。整体参数形如:

    {
      "libraryEntryId": "<目标树 id>",
      "mutation": {
        "operation": "add_block",
        "revision": 12,
        "idempotencyKey": "<本次命令唯一号>",
        "patch": { "name": "安全加固", "color": "#c0392b" }
      }
    }

`patch` 键与网站编辑器同款 camelCase;命令要引用目标实体时,id 放进命令顶层
`targetId`(与既有 add_node/delete_node 等一致的传法)。按语境切块、把节点归入:

1. `add_block`:`patch` 含 `name`、可选 `color`,无 `targetId`——块 id 由服务端生成,
   但不随提交响应返回;成功后重读一次 `mapflow.get_tree`,在返回的 `blocks`
   数组里按块名找到新块 id,记下来供后续命令用;
2. `set_node_block`:`targetId` = 节点 id,`patch` 含 `blockId`;想移出块则给
   `"blockId": null`;
3. 重复直至块的成员齐整;块不需要的节点保持原样(无 100% 覆盖要求)。

每次提交响应返回**新 revision**,下一次提交必须带上它。

### 第 4 步:补缺失的形态(写,可选)

语境需要但树上没有的知识点,用「新节点 + 依赖边」表达。例:安全语境要求
「先学守卫、再学网关」,而树上只有守卫:

1. `add_node`:`targetId` = 你为新节点起的 id(与树内既有节点 id 同风格),
   `patch` 含必填 `title`/`category` 与可选 `description`/`difficulty`/
   `estimatedMinutes`/`recommendedDepth` 等(标题与说明遵循树的既有风格);
2. `add_edge`:`targetId` = 新边 id,`patch` 含 `sourceNodeId`(= 守卫)、
   `targetNodeId`(= 网关)、`edgeType`(= 与树内既有先学边一致的取值,
   如 `prerequisite`),`label` 可选;
3. `set_node_block` 把网关归入安全块。

不要在已有节点上改标题去「冒充」新语义(那会污染默认视图下的原意)。

## 命名与粒度建议

- 块名:场景/阶段名,6-20 字,信息量优先,如「安全加固」「上线前检查」「性能优化」;
  避免「重要」「日常」「其他」这类无信息量词;多个块不要互相包含(「安全」与「安全-网络」)。
- 数量:每棵树 3-8 块;每块 3-15 个节点;明显偏多的块说明该继续切分。
- 块内自洽:先学完一块内依赖、再进入依赖它的下一块,顺序感最好。
- 颜色:`color` 用十六进制(如 `#c0392b`),一块一色,别在标题里加 emoji 或序号前缀。
- 完成度:重组不动任何节点的完成状态;把用户已完成的节点归入块时,
  块内起点自然就是下一个待学节点。

## Revision 冲突与错误处理

- `mutation.revision_conflict` → 树已被别人改过。丢弃本地草稿,
  重新 `mapflow.get_tree` 取最新 revision,把未提交的命令在新版本上重放。
- `mutation.invalid` → 命令无效:引用的节点/边/块 id 或 patch 字段不对。
  服务器只会回固定文案「变更命令无效,请检查节点/边/块 id 与 patch 字段。」,
  不会指明具体错在哪;需重读树,自行核对引用的 id 与 patch 字段后重发。
- `mutation.not_private_tree` → 只允许改自己的私有树,核对 `libraryEntryId`。
- HTTP 401 + `auth.token_revoked` → 本机 token 已被吊销:relay 会自动清掉缓存 token
  并重新授权一次,无需手动处理;401 + `auth.invalid_token` → token 文件损坏或不被识别,
  删除 `~/.mapflow/token` 后重新授权(见 README「重新授权」)。

## 收尾:向用户汇报

重组完成后,用两三句话向用户说明:建了哪几个块、各归入多少节点、
新建了哪些节点与依赖边、树现在的新 `revision`。
不要长篇转储整棵树;用户要的是「发生了什么、为什么、还能怎么调」。
