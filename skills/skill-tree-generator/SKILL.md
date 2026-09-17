---
name: skill-tree-generator
description: Generate a complete, research-backed learning skill tree (SKILL_TREE.json) for any topic. Use when the user asks to "生成技能树", "create a skill tree", "make a learning roadmap", "生成学习路线图/知识树", or wants a learning path converted into a node graph with recommended depths, dependencies, and learning evidence.
---

# Skill Tree Generator

生成一棵"有效有质量、符合学习者目标"的学习技能树。质量来自研究，不来自校验：
先确认方向，再大范围搜索主流学习路径，基于研究结果设计分层与节点，产出标准
SKILL_TREE.json。字段规范见 references/，AI 看到即遵守，不设校验脚本。

## 核心原则

- **方向优先**：先问学习者想走什么方向（职业/项目/兴趣），目标驱动搜索，不单纯给路线
- **质量来自研究**：每层每节点都要有搜索来源依据，禁止凭印象编造
- **渐进披露给学习者**：一次只披露一层主干，确认后再展开节点，避免一次性 79 个节点全部返工

## 阶段 A：方向与目标确认

1. 问学习者：想走什么方向？
   - 职业目标（如"进大厂做 AI 应用后端"）
   - 项目目标（如"给自己的产品做认证体系"）
   - 兴趣方向（如"想搞懂数据库原理"）
2. 若方向不明确，用 2-3 个问题收敛：现有经验、时间预算、最终想产出什么
3. 确认主题技术栈与目标规模（建议 30-80 节点，一般 5-10 个主干模块）
4. 学习者确认后进入阶段 B；确认前不生成任何节点

## 阶段 B：研究驱动生成

5. 按方向大范围搜索（四类来源，详见 references/research-sources.md）：
   主流学习路径、GitHub 生态、思维导图、大厂能力要求
6. 基于研究结果设计主干分层，向学习者说明每层为什么这么分（引用来源）
7. 学习者确认分层后，逐模块填充节点（字段规范见 references/field-schema.md）
8. 每节点必须携带：推荐深度 + 深度理由 + 学习目标 + 关键概念 + 验收证据
   （质量标准见 references/quality-standards.md）
9. 依赖边按学习依赖连接，确保无环
10. 展示完整节点清单给学习者确认，按反馈修改
11. 输出 SKILL_TREE.json（默认 learning/SKILL_TREE.json，目录不存在则创建；学习者可指定位置）

## 输出格式速查

```json
{
  "tree": { "id": "uuid", "topic": "主题", "title": "标题", "description": "...", "difficulty_level": "beginner|intermediate|advanced", "total_nodes": 40 },
  "nodes": [{ "id": "uuid", "title": "...", "icon": "code", "depth_level": 1, "recommended_depth": "Understand", "learning_objectives": "[\"...\"]", "key_concepts": "[\"...\"]", "observable_evidence": "[\"...\"]", "...": "其余字段见 references/field-schema.md" }],
  "edges": [{ "id": "e1", "source_node_id": "uuid", "target_node_id": "uuid" }],
  "current_node_id": null,
  "progress": [{ "node_id": "uuid", "status": "not_started", "evidence": "" }]
}
```

## 触发器与加载说明

- description 触发词：生成技能树 / skill tree / learning roadmap / 学习路线图 / 知识树
- 本 SKILL.md 只含流程；字段细节、搜索清单、质量标准分别按需加载
  references/field-schema.md、references/research-sources.md、references/quality-standards.md
- 示例节点参考 examples/sample-node.md（展示"有质量"长什么样）
