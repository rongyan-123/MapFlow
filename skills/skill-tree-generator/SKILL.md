---
name: skill-tree-generator
description: Generate a complete, research-backed learning skill tree (SKILL_TREE.json) for any topic. Use when the user asks to "生成技能树", "create a skill tree", "make a learning roadmap", "生成学习路线图/知识树", or wants a learning path converted into a node graph with recommended depths, dependencies, and learning evidence.
---

# Skill Tree Generator

根据已有主题、目标或材料生成新版学习地图，包含明确起步说明、真实依赖、专业总览和小组收纳。先研究，再设计并检查引用与有向无环关系。字段以 references/ 和实际保存工具的 schema 为准。

## 从需求到完整地图

1. 提取已有主题、目标和材料。生成前不问个人基础、经验、时间预算，不做前测。只有主题本身缺失或互相矛盾时才澄清主题。
2. 研究可靠来源，按需读取 references/research-sources.md、references/quality-standards.md 和 references/field-schema.md。不能编造搜索来源。
3. 在 tree.description 写清覆盖范围、默认起步建议以及其他合理入口。逐个检查没有前置的节点：确实独立、基础在范围外，还是漏连了关系？不要为了只剩一个根而造依赖。
4. 生成完整知识点、真实 prerequisite 边和专业 blocks 总览。每点包含推荐深度、理由、目标、关键概念和可观察的验收证据。生成的解释不是用户完成学习的证据。
5. 深度只用 Recognize / Understand / Use / Transfer / DeepMastery。先后顺序由真实依赖决定；不新增 L1、阶段或另一套难度层级，不按深度重新分配颜色。
6. 仅把共同解决一个小问题的紧密相关知识点收入 learning_groups；大范围专业分类仍用 blocks，不能整类几十个点一键塞进小组。允许独立点，每个点至多属于一个小组，不复制知识点。
7. 组内可分叉与汇合：**分支做简单点，不要为了复杂而复杂**。不要强制排成一条线，不固定根、节点、组、分支的数量，也不为了减少屏幕数量而删知识。
8. 检查真实 prerequisite 图和收纳后的外层图都无环。A组内部→组外→A组内部会产生收纳假循环，应调整组边界或让关键点独立显示，不能删真实边掩盖。related/supports 是说明关系，不作为强制前置。
9. 一次完成知识结构，无需逐层询问是否继续。给用户简短的范围、入口与分组理由，不要求披露内部思考链。将 SKILL_TREE.json 保存到用户指定位置，未指定则为 learning/SKILL_TREE.json。

## 保存格式

- `tree.generation_version: 2`；旧版本缺省为 1，不得仅换标签当作升级。
- `tree.total_nodes` 填真实数量，`description` 包含范围和起步说明。
- `nodes` 与 `edges` 使用同一套真实节点 ID；`edges[].edge_type` 明确区分 prerequisite 与 related/supports。
- `blocks`: `{block_id,name,color,sort_order,overview:{version:2,core_question,chain_node_ids,note}}[]`。这是后端导入格式，overview 引用本分类实际知识点，说明专业脉络；前端显示模型将 block_id 转为 id。
- `node_block_assignments`: `{node_id,block_id}[]`。每个新版知识点必须有专业分类。
- `learning_groups`: `{group_id,title,node_ids}[]`。成员引用原节点，不另造知识点；没有适合收纳的内容可为空。单个点保持独立。
- `current_node_id: null`，进度为 not_started；不能替用户开始或完成学习。

通过 `mapflow.create_tree` 创建时使用：`tree.generationVersion=2`、`learningGroups[{groupId,title,nodeIds}]`、`blocks[{id,name,overview:{version,core_question,chain_node_ids,note}}]`、`nodes[].blockId`。注意 overview 的内部字段仍为 snake_case。完整可保存参数见 [创建示例](../mapflow-mcp/references/create-tree-v2-example.json)，数组长度仅为示例，不是数量要求；独立创建请求须使用独立 idempotencyKey。存储格式和工具参数不要混用。读取校验错误，修正内容后再保存。

## 生成后怎样学习

网站在同一张画布里展示收纳地图；展开保留原节点、边和进度，可同时开多个组，也可切回完整地图与按块布局。

教学 AI 在地图生成后，根据已有对话、进度和用户选择推荐合适的起点。只有教学需要时才问一个简短问题，不强制问卷；尊重用户已选节点。推荐、查看和展开均不修改进度或当前学习位置。
