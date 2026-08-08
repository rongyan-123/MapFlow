# Skill Tree Generator 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 MapFlow 仓库中实现 `skills/skill-tree-generator/` 技能树生成 skill（两阶段向导 + 研究驱动），并更新 README 说明用法，最终推送到 GitHub。

**Architecture:** skill 遵循通用 skill 规范（frontmatter + SKILL.md 索引 + references 渐进披露）。SKILL.md 只写两阶段向导核心流程（≤500 行）；字段规范、搜索来源、质量标准分别下沉到 references/ 三个文件；examples/ 放一个打磨过的示例节点。目录不带 `.claude/` 前缀，保持任何 AI 可复用。

**Tech Stack:** Markdown skill 文件（无代码依赖）、SKILL_TREE.json 数据格式（与 `frontend/src/types/learning.ts` 类型定义一致）。

## Global Constraints

- 目录路径：`skills/skill-tree-generator/`（仓库根目录，**不带** `.claude/` 前缀）
- SKILL.md ≤ 500 行；frontmatter 含 name + description（description 用第三人称、含触发词，不总结工作流程）
- 节点字段以 `frontend/src/types/learning.ts` 的类型定义为准（SkillNode 的 20 字段）
- 所有文档用中文撰写；技术术语（字段名、API 名、深度分级名）保留原文
- 流程必须两阶段：阶段 A 先问方向（职业/项目/兴趣，未明确时用 2-3 个问题收敛），阶段 B 研究驱动生成
- 研究四类来源必须全部覆盖：主流学习路径、GitHub 生态、思维导图、大厂能力要求
- 不做教学流程、不做校验脚本、不强制前端集成
- 每任务完成后提交（中文 commit message）

---

### Task 1: 创建 SKILL.md 主文件

**Files:**
- Create: `skills/skill-tree-generator/SKILL.md`

**Interfaces:**
- Produces: skill 入口文件。frontmatter name=`skill-tree-generator`；正文两阶段向导流程。后续 Task 2-4 的 references 文件被本文件第 4 步引用。

- [ ] **Step 1: 创建目录与 SKILL.md**

创建 `skills/skill-tree-generator/SKILL.md`，内容结构如下：

```markdown
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
```

- [ ] **Step 2: 验证结构**

运行：
```bash
cd /d/MapFlow-publish && wc -l skills/skill-tree-generator/SKILL.md
```
Expected: 行数 < 500；frontmatter 有 `name: skill-tree-generator` 与含触发词的 description。

- [ ] **Step 3: 提交**

```bash
cd /d/MapFlow-publish && git add skills/skill-tree-generator/SKILL.md && git commit -m "feat: 技能树生成 skill 主文件（两阶段向导）"
```

---

### Task 2: 字段规范 references/field-schema.md

**Files:**
- Create: `skills/skill-tree-generator/references/field-schema.md`

**Interfaces:**
- Consumes: `frontend/src/types/learning.ts` 的类型定义（SkillTree / SkillNode / SkillEdge / NodeLearningProgress / LearningTreeSnapshot）
- Produces: 节点字段权威规范，SKILL.md 阶段 B 第 7 步引用

- [ ] **Step 1: 编写字段规范文档**

创建 `skills/skill-tree-generator/references/field-schema.md`，内容必须包含：

1. **顶层结构**：`tree` / `nodes` / `edges` / `current_node_id` / `progress` 五部分及各自用途
2. **tree 对象**：`id`（uuid）、`topic`、`title`、`description`、`difficulty_level`（beginner/intermediate/advanced）、`total_nodes`（自动=节点数，可留 0 由前端忽略）
3. **SkillNode 全 20 字段逐一说明**（与 `frontend/src/types/learning.ts` 一致）：
   - `id` uuid、`tree_id` 与 tree.id 相同、`title` 节点名（动词开头，如"掌握事件循环"）、`description` 一句话、`icon`（枚举：compass/shield/code/database/brain/network/server/cloud/wrench/book/tool/puzzle/rocket/lightbulb/layers/link/message/template/output/workflow/pause/radio/history/sync/refresh/map/cube/settings/scissors/sort/edit/gauge/bug/activity/trending/trophy）、`category` 所属主干模块名、`difficulty` 1-5、`estimated_minutes` 预估学习分钟、`depth_level` 从 1 起的整数分层、`position_x/position_y`（可填 0，前端自动布局会覆盖）、`order_in_level` 层内顺序、`learning_objectives` JSON 数组字符串（2-4 条，可观察）、`key_concepts` JSON 数组字符串（2-5 个关键词）、`recommended_depth`（Recognize/Understand/Use/Transfer/DeepMastery）、`depth_rationale` 为什么是这个深度（1-2 句）、`observable_evidence` JSON 数组字符串（验收证据，可验证）
4. **正例/反例**：一个完整的节点正例（从 MapFlow 现有数据抄一个真实节点）；一个反例（缺字段、目标不可观察、深度理由写"很重要"）并说明为什么不合格
5. **edges 规范**：`id` 唯一、`source_node_id`/`target_node_id` 必须存在于 nodes、依赖语义（学完 source 才学 target）、禁止环、禁止重复边
6. **progress 规范**：`status` 枚举 not_started/in_progress/completed/mastered；新生成树全部 not_started，`current_node_id` 为 null
7. **JSON 格式注意**：learning_objectives/key_concepts/observable_evidence 是**字符串化的 JSON 数组**（`"[\"a\", \"b\"]"`），不是数组——必须转义

- [ ] **Step 2: 验证与前端类型一致**

运行：
```bash
cd /d/MapFlow-publish && grep -c "id\|title\|description\|icon\|category\|difficulty\|estimated_minutes\|depth_level\|position_x\|position_y\|order_in_level\|learning_objectives\|key_concepts\|recommended_depth\|depth_rationale\|observable_evidence" skills/skill-tree-generator/references/field-schema.md
```
Expected: 输出 ≥ 20（20 个节点字段名全部出现）；对照 `frontend/src/types/learning.ts` 人工确认无遗漏无多余。

- [ ] **Step 3: 提交**

```bash
git add skills/skill-tree-generator/references/field-schema.md && git commit -m "feat: 技能树字段规范参考文档"
```

---

### Task 3: 搜索来源 references/research-sources.md

**Files:**
- Create: `skills/skill-tree-generator/references/research-sources.md`

**Interfaces:**
- Produces: 四类来源清单 + 搜索词模板，SKILL.md 阶段 B 第 5 步引用

- [ ] **Step 1: 编写搜索来源文档**

创建 `skills/skill-tree-generator/references/research-sources.md`，内容必须包含：

1. **搜索总原则**：按方向定制搜索词（同一技术栈，后端方向与 AI 应用方向搜索侧重点不同）；每层主干至少 1 个来源支撑；结果记录来源 URL
2. **来源一：主流学习路径**
   - 站点：roadmap.sh、各语言/框架官方教程、freeCodeCamp / The Odin Project 课程大纲、知名 MOOC（Coursera/edX）课程结构
   - 搜索词模板：`<topic> roadmap`, `<topic> learning path`, `<topic> official tutorial`, `<topic> freecodecamp curriculum`
3. **来源二：GitHub 生态**
   - 站点：GitHub awesome 列表（awesome-<topic>）、知名仓库 README 的技术栈图、trending 仓库的学习资源
   - 搜索词模板：`github awesome <topic>`, `<topic> awesome list`, `github <topic> learning resources`
4. **来源三：思维导图**
   - 站点：Xmind 分享页、ProcessOn、百度脑图、各技术社区（掘金/CSDN）的知识图谱文章
   - 搜索词模板：`<topic> 思维导图`, `<topic> 知识图谱`, `<topic> mindmap`, `<topic> 脑图`
5. **来源四：大厂能力要求**
   - 站点：招聘 JD 站点（Boss/拉勾/脉脉）、大厂技术博客（字节/阿里/腾讯/Google/Meta 工程博客）、InfoQ/极客时间课程大纲
   - 搜索词模板：`<topic> 招聘 要求`, `<topic> 岗位 JD`, `<topic> 工程师能力模型`, `google engineering blog <topic>`
6. **方向定制示例**：给两个方向的完整搜索词集示例（"后端工程师方向学 NestJS" vs "AI 应用方向学 Python"），各列出 4-6 条具体搜索词
7. **提炼要求**：搜索后产出——主干模块候选清单（每项带来源）、热门/共识性技术点清单、争议点（多个来源不一致时以主流共识为准并在说明中提及）

- [ ] **Step 2: 验证覆盖四类来源**

运行：
```bash
grep -c "主流学习路径\|GitHub 生态\|思维导图\|大厂能力要求" /d/MapFlow-publish/skills/skill-tree-generator/references/research-sources.md
```
Expected: 输出 ≥ 4（四类来源标题全部出现）。

- [ ] **Step 3: 提交**

```bash
git add skills/skill-tree-generator/references/research-sources.md && git commit -m "feat: 技能树研究来源与搜索词参考文档"
```

---

### Task 4: 质量标准 references/quality-standards.md

**Files:**
- Create: `skills/skill-tree-generator/references/quality-standards.md`

**Interfaces:**
- Produces: 节点质量标准，SKILL.md 阶段 B 第 8 步引用

- [ ] **Step 1: 编写质量标准文档**

创建 `skills/skill-tree-generator/references/quality-standards.md`，内容必须包含：

1. **5 级推荐深度判据**（每级给"含义 + 判据 + 典型动词"）：
   - Recognize 认识：知道存在、能识别场景。判据：能说出"这是什么、解决什么问题"。典型证据动词：列举、识别
   - Understand 理解：能解释原理与边界。判据：能用自己的话讲清机制。动词：解释、比较、画出
   - Use 应用：能独立完成真实任务。判据：能产出可运行成果。动词：实现、搭建、接入
   - Transfer 迁移：能应用到新场景/改造方案。判据：能在不同约束下做出取舍。动词：设计、重构、评估
   - DeepMastery 深度掌握：能教学、能评审、能原创。判据：能指导他人与建立方法论。动词：教学、评审、定义
2. **深度分层原则**：树自底向上按"先认识后应用"组织；同一模块内节点按学习顺序递增难度；deep 目标高的节点放在依赖链较后位置
3. **学习目标写法**：2-4 条、每条以能力动词开头、必须可观察（"能…"句式）、禁止"了解/熟悉/掌握"这类不可验证词
4. **验收证据写法**：可运行/可演示的具体产物（如"能跑通 xx-lab 并解释输出"）、禁止"完成课程""看完教程"
5. **关键概念写法**：2-5 个该节点独有的核心技术词，不写通用词（如"编程""代码"）
6. **分层粒度**：主干 5-10 模块；单模块 5-12 节点；相邻层有真实依赖，禁止把无关主题硬凑一层
7. **规模控制**：30-80 节点；节点过多时优先合并同类项（把"X 深入"并入"X"），过少时补充真实就业/项目所需能力

- [ ] **Step 2: 验证 5 级深度全部覆盖**

运行：
```bash
grep -c "Recognize\|Understand\|Use\|Transfer\|DeepMastery" /d/MapFlow-publish/skills/skill-tree-generator/references/quality-standards.md
```
Expected: 输出 ≥ 5。

- [ ] **Step 3: 提交**

```bash
git add skills/skill-tree-generator/references/quality-standards.md && git commit -m "feat: 技能树节点质量标准参考文档"
```

---

### Task 5: 示例节点 examples/sample-node.md

**Files:**
- Create: `skills/skill-tree-generator/examples/sample-node.md`

**Interfaces:**
- Produces: 质量示范，SKILL.md "触发器与加载说明"一节引用

- [ ] **Step 1: 编写示例节点**

创建 `skills/skill-tree-generator/examples/sample-node.md`，内容：

1. **选择一个通用主题**（如"依赖注入"），完整写出一个通过全部质量标准的节点：20 字段全填、深度理由具体、目标可观察、证据可验证
2. **对照说明**：逐字段解释"为什么这么写"（3-6 条点评，点出字段规范与质量标准的落点）
3. **反例对照**：同一节点的劣质版（缺字段、深度理由"很重要"、目标"了解依赖注入"），列出 3-5 条劣质点

- [ ] **Step 2: 验证文件存在且含完整字段**

运行：
```bash
grep -c "recommended_depth\|observable_evidence\|learning_objectives" /d/MapFlow-publish/skills/skill-tree-generator/examples/sample-node.md
```
Expected: 输出 ≥ 3。

- [ ] **Step 3: 提交**

```bash
git add skills/skill-tree-generator/examples/sample-node.md && git commit -m "feat: 高质量节点示例与劣质对照"
```

---

### Task 6: README 增加"生成你自己的技能树"一节

**Files:**
- Modify: `README.md`（在"添加你自己的技能树"一节后追加）

**Interfaces:**
- Consumes: skill 完整目录（Task 1-5 产物）
- Produces: 群友使用入口

- [ ] **Step 1: 修改 README**

在 `README.md` 的「添加你自己的技能树」小节（方式 A/B/C 之后、"接入真实数据"之前）追加：

```markdown
**方式 D：用仓库自带的生成 Skill（推荐，零代码）**

本仓库自带一个**技能树生成 skill**（`skills/skill-tree-generator/`），任何 AI 都可以调用它
从零生成一棵符合格式的学习技能树——先问你想走的方向，再大范围研究主流学习路径、
GitHub 生态、思维导图与主流能力要求，基于研究产出完整 SKILL_TREE.json。

用法：在你的 AI 环境中（Claude Code、Codex 或任何支持 skill 规范的 agent）打开本仓库目录，
对它说：

> 帮我在这个仓库生成一棵学习 XX 的技能树

- 想学哪个方向、规模多大、职业/项目目标是什么，都会在生成过程中逐步确认
- 生成结果默认写入 `learning/SKILL_TREE.json`；想直接在前端可视化，把生成的 JSON
  注册进 `frontend/src/lib/demoTrees.ts` 即可（格式见「接入真实数据」一节）
- skill 遵循通用 skill 规范：Claude Code 用户可复制到自己的 `.claude/skills/` 实现自动加载，
  其他 agent / API 用户可直接按 SKILL.md 的流程执行
```

- [ ] **Step 2: 验证插入位置**

运行：
```bash
grep -n "方式 D\|方式 C\|接入真实数据" /d/MapFlow-publish/README.md
```
Expected: "方式 D" 行号在 "方式 C" 与 "接入真实数据" 之间。

- [ ] **Step 3: 构建验证（README 不影响构建）**

运行：
```bash
cd /d/MapFlow-publish && npm run build 2>&1 | tail -2
```
Expected: `✓ built` 成功。

- [ ] **Step 4: 提交**

```bash
git add README.md && git commit -m "docs: README 增加自带生成 skill 使用说明"
```

---

### Task 7: 全量验证并推送

**Files:**
- 无新文件

**Interfaces:**
- Consumes: Task 1-6 全部产物

- [ ] **Step 1: 结构终检**

运行：
```bash
cd /d/MapFlow-publish && find skills -type f && wc -l skills/skill-tree-generator/SKILL.md
```
Expected: 5 个文件（SKILL.md + 3 references + sample-node.md）；SKILL.md < 500 行。

- [ ] **Step 2: git 状态终检**

运行：
```bash
git status --short
```
Expected: 只包含 skills/ 与 README.md 与 docs/ 的预期改动；无 node_modules、无 dist、无学习目录内容。

- [ ] **Step 3: 推送**

```bash
git push
```
Expected: 成功推送到 origin/main。

- [ ] **Step 4: 本地实测 skill（可选，注意不碰学习目录）**

不要在任何学习项目目录（如 `/d/MapFlowNext`）中实测，避免产出文件污染学习进度。推荐两种安全方式：
1. 在发布仓库中直接对 AI 说"帮我在这个仓库生成一棵学习 XX 的技能树"（skill 已就位），产出 `learning/SKILL_TREE.json` 后审查并删除，确认两阶段向导走通；
2. 或改为人工审查 SKILL.md 流程完整性：阶段 A 先问方向 → 阶段 B 研究 → 分层确认 → 生成 → 节点确认 → 输出。
