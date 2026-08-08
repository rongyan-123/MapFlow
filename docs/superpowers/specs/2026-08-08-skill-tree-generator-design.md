# Skill Tree Generator 设计文档

日期：2026-08-08
状态：已确认

## 背景与目标

MapFlow 前端仓库已上线（两棵完整演示技能树 + 瀑布流布局）。社区反馈：只看前端演示没有价值，**不知道如何生成一棵"有效有质量的、符合自己的学习教程"**。

目标：随仓库分发一个**技能树生成 skill**——任何 AI（Claude Code、Codex、API 接入等）都能调用它，引导用户从"想学的方向"出发，通过大范围研究，生成符合 SKILL_TREE.json 标准格式的高质量学习技能树。

## 用户场景

群友 clone MapFlow 仓库，在自己的 AI 环境（Claude Code / Codex / 其他支持 skill 规范的 agent）中说：

> "帮我在这个仓库里生成一棵学习 XX 的技能树"

AI 调用本 skill，走完两阶段向导，产出 `learning/SKILL_TREE.json`。群友拿到 JSON 即可接入前端可视化或自己的学习流程。

## 设计原则

- **渐进式披露**：SKILL.md 是索引不是教程（≤500 行），详细规范下沉到 references/ 按需加载
- **方向优先**：先问学生想走什么方向（职业/项目/兴趣目标），目标驱动搜索，不单纯给路线
- **质量来自研究**：大范围搜索主流学习路径、GitHub 生态、思维导图、大厂能力要求，作为分层与节点的依据；字段规范 AI 看到即遵守，不做校验脚本
- **通用性**：skill 目录不带 `.claude/` 前缀，放仓库根目录 `skills/`，任何 agent 可读可用

## 目录结构

```
skills/skill-tree-generator/
├── SKILL.md                    # 核心流程（两阶段向导）+ 触发条件，≤500 行
├── references/
│   ├── field-schema.md         # SKILL_TREE.json 字段规范 + 正例/反例
│   ├── research-sources.md     # 四类搜索来源清单 + 搜索词模板
│   └── quality-standards.md    # 高质量节点标准
└── examples/
    └── sample-node.md          # 一个经过打磨的示例节点
```

## SKILL.md 核心流程

### 阶段 A：方向与目标确认（先问，不是先给路线）

1. 问学生**想走什么方向**：
   - 职业目标（如"进大厂做 AI 应用后端"）
   - 项目目标（如"给自己产品做认证体系"）
   - 兴趣方向（如"想搞懂数据库原理"）
   - 没有明确方向时，用 2-3 个问题帮其收敛（现有经验、时间预算、最终想产出什么）
2. 确认主题技术栈与目标规模（建议 30-80 节点）
3. 学生确认后进入阶段 B

### 阶段 B：研究驱动生成

4. 按方向大范围搜索（四类来源，见 research-sources.md）：
   - 主流学习路径：roadmap.sh、官方教程、freeCodeCamp 等课程大纲
   - GitHub 生态：awesome 列表、知名仓库 README 技术栈
   - 思维导图：Xmind / ProcessOn 成熟脑图
   - 大厂能力要求：JD、技术博客、内部分享
5. 基于研究结果设计主干分层（一般 5-10 个模块，按主题规模调整），**向用户说明每层为什么这么分（引用研究来源）**
6. 填充节点：每节点强制携带推荐深度（Recognize/Understand/Use/Transfer/DeepMastery）+ 深度理由 + 学习目标 + 关键概念 + 验收证据
7. 依赖边按学习依赖连接
8. **展示节点清单给用户确认**，按反馈修改
9. 输出 SKILL_TREE.json（默认 `learning/SKILL_TREE.json`，目录不存在则创建；用户可指定其他位置）

## references 内容要点

### field-schema.md

- SKILL_TREE.json 完整结构：tree / nodes / edges / current_node_id / progress
- 节点 20 字段逐一说明 + 正例/反例
- 依赖边规范（无环、单一语义）
- 与前端的类型定义（frontend/src/types/learning.ts）一致

### research-sources.md

- 四类来源各自的具体站点与搜索词模板
- 搜索词按方向定制示例（如"后端方向"vs"AI 应用方向"）
- 研究结果的提炼要求：分层依据必须可追溯

### quality-standards.md

- 5 级推荐深度怎么定（各深度含义、判据）
- 学习目标/验收证据怎么写才可观察、可验证
- 分层原则：模块内聚、层间依赖清晰、粒度均匀

## 分发方式

- 仓库根目录 `skills/skill-tree-generator/`（不带 `.claude/` 前缀，保证通用性）
- README 增加"生成你自己的技能树"一节：
  - 说明仓库自带生成 skill 的位置与用法
  - 用法：在你的 AI 环境中说"帮我在这个仓库生成一棵学习 XX 的技能树"
  - 提示：skill 遵循通用 skill 规范，Claude Code 用户可复制到 `.claude/skills/` 自动加载，Codex/API 用户可直接使用文件内容

## 边界（不做的事）

- 不做教学流程（那是 adaptive-tutor 的职责，本仓库不涉及）
- 不做校验脚本（质量靠研究 + 字段规范 + 用户确认）
- 不强制前端集成（输出 JSON 即完成；README 提示可注册进 `frontend/src/lib/demoTrees.ts` 实现可视化）
