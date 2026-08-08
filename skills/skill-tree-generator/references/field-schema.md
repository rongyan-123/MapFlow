# 技能树字段规范

本文档定义 `LearningTreeSnapshot` 的完整字段规范，是 `SKILL.md` 阶段 B 第 7 步（生成 JSON 输出）的权威参考。所有字段名、类型、枚举值均与 `src/types/learning.ts` 严格对齐。

---

## 1. 顶层结构

`LearningTreeSnapshot` 是技能树的顶层数据结构，由五个部分组成：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tree` | `SkillTree` | 是 | 技能树的元信息对象 |
| `nodes` | `SkillNode[]` | 是 | 节点数组，包含全部知识节点 |
| `edges` | `SkillEdge[]` | 是 | 边数组，表达节点间的依赖关系 |
| `current_node_id` | `string \| null` | 是 | 当前学习位置节点 ID，新生成树为 `null` |
| `progress` | `NodeLearningProgress[]` | 是 | 学习进度数组，新生成树全部为 `not_started` |

**类型定义出处**：`src/types/learning.ts` 第 57-65 行 `LearningTreeSnapshot` 接口。

---

## 2. tree 对象（SkillTree）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | UUID v4 格式，整棵树的唯一标识 |
| `topic` | `string` | 是 | 主题简写（如 `"NestJS + Agent AI Backend"`），用于路由/索引 |
| `title` | `string` | 是 | 展示标题（如 `"生产级 Agent AI 应用后端完整体系（NestJS）"`） |
| `description` | `string \| null` | 是 | 一句话描述整棵树的范围与目标 |
| `difficulty_level` | `string` | 是 | 整体难度，三枚举：`"beginner"` / `"intermediate"` / `"advanced"` |
| `total_nodes` | `number` | 是 | 节点总数。可填 `0`（由前端根据 `nodes.length` 自动计算），也可显式填入准确值 |

**类型定义出处**：`src/types/learning.ts` 第 14-21 行 `SkillTree` 接口。

---

## 3. SkillNode 字段逐一说明

`SkillNode` 共 17 个字段，定义在 `src/types/learning.ts` 第 23-41 行。

### 3.1 id

- **类型**：`string`
- **必填**：是
- **格式**：UUID v4（如 `"733f0ac2-5a0d-409a-aaf6-980c6180448c"`）
- **说明**：节点的全局唯一标识，不可重复、不可为空。生成新节点时使用 `crypto.randomUUID()` 或等效 UUID v4 生成器。

### 3.2 tree_id

- **类型**：`string`
- **必填**：是
- **说明**：所属树的 ID，必须与 `tree.id` 完全相同。同一棵树的所有节点共享同一个 `tree_id`。

### 3.3 title

- **类型**：`string`
- **必填**：是
- **说明**：节点名称。建议用动词开头，表达"掌握/理解/实现 X"的语义。例如：
  - 合格：`"掌握事件循环"`、`"Provider 与依赖注入"`
  - 不合格：`"事件循环"`（无动词，不表达学习动作）、`"了解一些东西"`（含糊）

### 3.4 description

- **类型**：`string | null`
- **必填**：是
- **说明**：一句话说明该节点要学什么、为什么重要。可以为 `null`（前端会显示默认占位文本）。建议格式：`"学习 <主题>，建立 <能力目标>。"`

### 3.5 icon

- **类型**：`string`
- **必填**：是
- **说明**：节点图标标识符。TypeScript 类型为 `string`（无编译期枚举约束），但必须从以下约定值中选择：

| 类别 | 可用值 |
|------|--------|
| 导航/基础 | `compass`, `map`, `layers` |
| 安全/防护 | `shield`, `lock`（如有） |
| 代码/API | `code`, `edit`, `scissors`, `sort` |
| 数据/存储 | `database`, `cloud`, `server` |
| 智能/AI | `brain`, `lightbulb`, `puzzle` |
| 网络/通信 | `network`, `link`, `message`, `radio`, `wifi`（如有） |
| 工具/配置 | `wrench`, `tool`, `settings`, `gauge` |
| 工作流/状态 | `workflow`, `pause`, `sync`, `refresh`, `history` |
| 模板/输出 | `template`, `output`, `book` |
| 进度/成就 | `rocket`, `trophy`, `trending`, `activity` |
| 形状/结构 | `cube` |
| 调试/检测 | `bug` |

完整列表（按字母序）：`activity`, `book`, `brain`, `bug`, `cloud`, `compass`, `code`, `cube`, `database`, `edit`, `gauge`, `history`, `layers`, `lightbulb`, `link`, `map`, `message`, `network`, `output`, `pause`, `puzzle`, `radio`, `refresh`, `rocket`, `scissors`, `server`, `settings`, `shield`, `sort`, `sync`, `template`, `tool`, `trending`, `trophy`, `workflow`, `wrench`

> 注意：`src/types/learning.ts` 中 `icon` 字段的 TypeScript 类型为 `string`，上述列表是项目的**约定值集合**。生成技能树时必须使用约定值，前端图标组件仅渲染已知值；使用未知值将导致图标位置显示空白。

### 3.6 category

- **类型**：`string`
- **必填**：是
- **说明**：节点所属的主干模块名。同一 category 的节点在可视化中通常使用相同的颜色分组。约 2-6 个字为宜。例如：`"框架核心"`、`"数据一致性"`、`"API边界"`、`"安全与测试"`、`"生产工程"`、`"延后分支"`。

### 3.7 difficulty

- **类型**：`number`
- **必填**：是
- **取值范围**：`1` ~ `5`
- **说明**：节点学习难度，整数。
  - `1`：入门 —— 零基础可学
  - `2`：基础 —— 需少量前置
  - `3`：中级 —— 需扎实前置
  - `4`：进阶 —— 需较深理解
  - `5`：专家 —— 需深厚积累或跨领域知识

### 3.8 estimated_minutes

- **类型**：`number`
- **必填**：是
- **说明**：预估学习分钟数。用于前端显示总学习时长和单个节点预计耗时。基础节点通常 90 分钟，深度分支节点可达 180 分钟。

### 3.9 depth_level

- **类型**：`number`
- **必填**：是
- **说明**：节点在技能树中的层级深度，从 `1` 开始递增。`depth_level=1` 为根节点（无前置依赖），`depth_level=2` 的节点依赖 `depth_level=1` 的节点，以此类推。同一 `depth_level` 的节点在拓扑排序中处于同级。

### 3.10 position_x

- **类型**：`number`
- **必填**：是
- **说明**：节点在画布上的 X 坐标（像素）。可填 `0` 或任意值 —— 前端自动布局算法会覆盖此字段。若手动布局，建议以 100-200 为间距。

### 3.11 position_y

- **类型**：`number`
- **必填**：是
- **说明**：节点在画布上的 Y 坐标（像素）。可填 `0` 或任意值 —— 前端自动布局算法会覆盖此字段。若手动布局，建议以 100-150 为行间距。

### 3.12 order_in_level

- **类型**：`number`
- **必填**：是
- **说明**：同一 `depth_level` 内的排序编号，从 `0` 开始递增。同一层级内，`order_in_level` 小的节点排在前面。用于稳定同层节点的视觉顺序（避免每次渲染随机排列）。

### 3.13 learning_objectives

- **类型**：`string | null`
- **必填**：是
- **重要**：前端类型是 `string`（而非 `string[]`），存储的是**字符串化的 JSON 数组**。
- **说明**：2-4 条可观察、可验证的学习目标。每条必须是可被第三方判断"做到了还是没做到"的行为描述，而非内部心理状态。
- **格式**：`"[\"目标1\", \"目标2\", \"目标3\"]"` —— 注意内层双引号必须用反斜杠转义。
- **合格示例**：
  ```
  "[\"能够用自己的话解释「Provider 与依赖注入」解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证「Provider 与依赖注入」的最小闭环\", \"能画出或口述「Provider 与依赖注入」的关键机制，解释边界并诊断一个典型错误\"]"
  ```
- **不合格示例**：
  ```
  "[\"理解依赖注入\", \"知道怎么用\"]"
  ```
  （"理解"和"知道"不可观察，无法验证）

### 3.14 key_concepts

- **类型**：`string | null`
- **必填**：是
- **重要**：与 `learning_objectives` 相同，前端类型是 `string`，存储**字符串化的 JSON 数组**。
- **说明**：2-5 个核心关键词，用于检索、标签和快速识别节点内容。
- **格式**：`"[\"关键词1\", \"关键词2\", \"关键词3\"]"`
- **示例**：`"[\"Provider 与依赖注入\", \"NestJS\", \"生产级后端\"]"`

### 3.15 recommended_depth

- **类型**：`RecommendedDepth`（字符串联合类型）
- **必填**：是
- **说明**：Bloom 分类学映射的推荐学习深度，五级枚举。必须在以下五值中精确选择其一：

| 值 | 含义 | 典型场景 |
|----|------|----------|
| `"Recognize"` | 识别 | 能认出概念、知道它何时需要、何时可以延后。适用于可延后分支节点 |
| `"Understand"` | 理解 | 能解释核心机制、边界与典型错误。适用于影响架构判断的节点 |
| `"Use"` | 应用 | 脱离照抄后仍能按可靠模式完成实现。适用于可重复使用的工程能力 |
| `"Transfer"` | 迁移 | 在需求/流量/安全约束改变时能重新应用和验证。适用于生产级关键能力 |
| `"DeepMastery"` | 精通 | 达到可教学、可贡献上游、可设计新方案的水平。适用于核心专长领域 |

- **类型定义出处**：`src/types/learning.ts` 第 1-6 行 `RecommendedDepth` 类型。

### 3.16 depth_rationale

- **类型**：`string`
- **必填**：是
- **说明**：为什么该节点被指定为此深度（1-2 句）。**不能写"很重要"或"需要掌握"** —— 必须给出与 `recommended_depth` 值匹配的具体理由。
- **合格示例**：
  - Understand → `"该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。"`
  - Use → `"该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。"`
  - Transfer → `"该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。"`
- **不合格示例**：
  - `"很重要"` —— 空洞，未说明为什么是这个深度而非其他
  - `"需要掌握"` —— 同上

### 3.17 observable_evidence

- **类型**：`string`
- **必填**：是
- **重要**：与 `learning_objectives` 相同，前端类型是 `string`（不是 `string[]`），存储**字符串化的 JSON 数组**。**不可为 null**（与 `learning_objectives` 和 `key_concepts` 不同）。
- **说明**：可验证的验收证据列表（3-5 条），每个条必须具体到"能用什么方式证明学习者已达标"。
- **格式**：`"[\"证据1\", \"证据2\", \"证据3\"]"`
- **合格示例**：
  ```
  "[\"能够用自己的话解释「Provider 与依赖注入」解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证「Provider 与依赖注入」的最小闭环\", \"能画出或口述「Provider 与依赖注入」的关键机制，解释边界并诊断一个典型错误\"]"
  ```
- **不合格示例**：
  ```
  "[\"学完了\", \"理解了\", \"会用了\"]"
  ```
  （不可验证、不可观察、无具体行为标准）

**类型定义出处**：`src/types/learning.ts` 第 23-41 行 `SkillNode` 接口。

---

## 4. 正例与反例

### 4.1 正例：完整合格节点

以下节点来自 `src/lib/nestTreeData.ts`，所有字段完整且符合规范：

```json
{
  "id": "b9af692b-da07-40e5-a7fd-ab13d5af4838",
  "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
  "title": "配置、环境与秘密",
  "description": "学习 配置、环境与秘密，建立可测试、可维护、可部署的 NestJS 后端能力。",
  "icon": "code",
  "category": "API边界",
  "difficulty": 3,
  "estimated_minutes": 90,
  "depth_level": 6,
  "position_x": 1008.0,
  "position_y": 696.0,
  "order_in_level": 1,
  "learning_objectives": "[\"能够用自己的话解释「配置、环境与秘密」解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证「配置、环境与秘密」的最小闭环\"]",
  "key_concepts": "[\"配置、环境与秘密\", \"NestJS\", \"生产级后端\"]",
  "recommended_depth": "Use",
  "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
  "observable_evidence": "[\"能够用自己的话解释「配置、环境与秘密」解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证「配置、环境与秘密」的最小闭环\", \"能独立完成「配置、环境与秘密」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
}
```

**为什么合格**：
- 17 个字段一个不缺，类型全部正确
- `title` 动词开头，语义明确
- `icon` 使用了约定值 `"code"`
- `difficulty` 在 1-5 范围，`recommended_depth` 在五级枚举内
- `learning_objectives` / `key_concepts` / `observable_evidence` 均为正确的字符串化 JSON 数组，内层引号已转义
- `depth_rationale` 给出了与 `"Use"` 级别匹配的具体理由，而非空洞的"很重要"
- 每条 `observable_evidence` 都可被第三方验证

### 4.2 反例：不合格节点

```json
{
  "id": "bad-node-1",
  "tree_id": "some-tree-id",
  "title": "数据库",
  "description": null,
  "icon": "unknown-icon",
  "category": "",
  "difficulty": 7,
  "estimated_minutes": 0,
  "depth_level": 0,
  "position_x": 0,
  "position_y": 0,
  "order_in_level": 0,
  "learning_objectives": "[\"理解数据库\"]",
  "key_concepts": null,
  "recommended_depth": "Use",
  "depth_rationale": "很重要",
  "observable_evidence": "[\"会用了\"]"
}
```

**逐条不合格原因**：

| # | 字段 | 问题 | 说明 |
|----|------|------|------|
| 1 | `id` | 非 UUID v4 | `"bad-node-1"` 不是合法 UUID，前端可能无法正确索引 |
| 2 | `title` | 无动词、不表达学习动作 | `"数据库"` 只是一个名词，无法让学习者知道要学什么 |
| 3 | `icon` | 非约定值 | `"unknown-icon"` 不在约定列表中，前端图标组件不会渲染 |
| 4 | `category` | 空字符串 | 无分类信息，同层节点无法正确分组和着色 |
| 5 | `difficulty` | 超出范围 | `7` 不在 1-5 范围内 |
| 6 | `depth_level` | 从 0 开始 | 规范要求从 1 开始，`0` 破坏了层级语义 |
| 7 | `learning_objectives` | 目标不可观察 | `"理解数据库"` 无法被第三方判断"做到了还是没做到" |
| 8 | `key_concepts` | null（且过少） | 建议至少填 2 个关键词，`null` 会导致检索和标签功能失效 |
| 9 | `depth_rationale` | 空洞无物 | `"很重要"` 没有给出深度理由，无法判断为什么是 `"Use"` 而不是 `"Understand"` 或 `"Transfer"` |
| 10 | `observable_evidence` | 证据不可验证 | `"会用了"` 无法被自动化测试或他人验证 |

---

## 5. edges 规范

`SkillEdge` 表达节点间的**前置依赖关系**：从 `source_node_id` 指向 `target_node_id`，语义为"学完 source 才能学 target"。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 边的唯一标识，建议 UUID v4 |
| `source_node_id` | `string` | 是 | 前置节点 ID，必须存在于 `nodes` 数组中 |
| `target_node_id` | `string` | 是 | 后继节点 ID，必须存在于 `nodes` 数组中 |
| `edge_type` | `string` | 是 | 边类型，如 `"prerequisite"`（前置依赖） |
| `label` | `string \| null` | 是 | 边的显示标签，可为 `null` |

**类型定义出处**：`src/types/learning.ts` 第 43-48 行 `SkillEdge` 接口。

### 5.1 约束规则

1. **存在性**：`source_node_id` 和 `target_node_id` 必须分别存在于 `nodes` 数组的某个节点的 `id` 字段中（外键约束）。
2. **禁止自环**：`source_node_id` 不得等于 `target_node_id`。
3. **禁止重复边**：不允许存在两条 `(source_node_id, target_node_id)` 完全相同的边。
4. **禁止环**：边的集合不能形成有向环。技能树必须是有向无环图（DAG），否则拓扑排序失败，前端无法正确渲染。
5. **层级约束**：通常 `source.depth_level < target.depth_level`（边从浅层指向深层），但不强制（允许同层引用）。

### 5.2 示例

```json
{
  "id": "edge-uuid-1",
  "source_node_id": "733f0ac2-5a0d-409a-aaf6-980c6180448c",
  "target_node_id": "a489a8a5-60b0-421d-b961-d2c333c89d48",
  "edge_type": "prerequisite",
  "label": null
}
```

---

## 6. progress 规范

`NodeLearningProgress` 记录单个节点的学习进度。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `node_id` | `string` | 是 | 对应节点的 `id`，必须存在于 `nodes` 中 |
| `status` | `LearningStatus` | 是 | 四枚举之一（见下） |
| `evidence` | `string` | 是 | 学习证据文本 |

**类型定义出处**：`src/types/learning.ts` 第 8-12 行 `LearningStatus` 类型，第 51-55 行 `NodeLearningProgress` 接口。

### 6.1 status 枚举

| 值 | 含义 |
|----|------|
| `"not_started"` | 尚未开始 |
| `"in_progress"` | 学习中 |
| `"completed"` | 已完成 |
| `"mastered"` | 已精通 |

### 6.2 新生成树的默认值

- 所有节点的 `status` 统一为 `"not_started"`
- 所有节点的 `evidence` 统一为空字符串 `""`
- `LearningTreeSnapshot.current_node_id` 设置为 `null`
- 为每个节点生成一条 `NodeLearningProgress` 记录

### 6.3 示例

```json
{
  "node_id": "b9af692b-da07-40e5-a7fd-ab13d5af4838",
  "status": "not_started",
  "evidence": ""
}
```

---

## 7. JSON 格式注意

### 7.1 字符串化 JSON 数组的转义

`learning_objectives`、`key_concepts`、`observable_evidence` 三个字段的**前端 TypeScript 类型是 `string`**（不是 `string[]`），存储的是**字符串化的 JSON 数组**。这意味着写入 JSON 文件时，内层双引号必须用反斜杠 `\"` 转义。

**正确格式**（在 JSON 文件中的字面量）：
```json
"learning_objectives": "[\"目标1\", \"目标2\", \"目标3\"]"
```

**错误格式**（常见错误）：
```json
// 错误 1：当成原生 JSON 数组
"learning_objectives": ["目标1", "目标2", "目标3"]

// 错误 2：内层引号未转义
"learning_objectives": "["目标1", "目标2"]"

// 错误 3：使用单引号（JSON 标准不支持）
"learning_objectives": "['目标1', '目标2']"
```

**前端反序列化逻辑**（供理解，生成时无需关心）：
```typescript
// 前端读取时使用 JSON.parse() 反序列化
const objectives: string[] = JSON.parse(node.learning_objectives);
```

### 7.2 生成时的注意事项

1. 使用 `JSON.stringify()` 序列化数组后赋值给字段值：
   ```typescript
   const node = {
     learning_objectives: JSON.stringify(["目标1", "目标2", "目标3"]),
     key_concepts: JSON.stringify(["概念1", "概念2"]),
     observable_evidence: JSON.stringify(["证据1", "证据2", "证据3"]),
   };
   ```
   然后再将整个 `LearningTreeSnapshot` 序列化为 JSON 字符串写入文件。JSON 库会自动处理外层的转义。

2. **手动编辑 JSON 文件时**：务必确认内层引号已转义。验证方法 —— 用 `JSON.parse()` 读取文件，再用 `JSON.parse()` 读取 `learning_objectives` 字段；两次均不抛异常即为正确。

3. **observable_evidence 不可为 null**：与 `learning_objectives` 和 `key_concepts`（可为 `null`）不同，`observable_evidence` 在类型定义中为 `string`（不含 `| null`），必须赋值，至少填入 `"[]"`。

### 7.3 SkillNode 字段的可空性对照

| 字段 | 可为 null |
|------|-----------|
| `description` | 是 (`string \| null`) |
| `learning_objectives` | 是 (`string \| null`) |
| `key_concepts` | 是 (`string \| null`) |
| `observable_evidence` | **否** (`string`，不可为 null) |
| 其余字段 | 否 |

---

## 8. 完整 JSON 结构速览

```json
{
  "tree": {
    "id": "<uuid>",
    "topic": "<主题简写>",
    "title": "<展示标题>",
    "description": "<一句话描述或 null>",
    "difficulty_level": "beginner | intermediate | advanced",
    "total_nodes": 0
  },
  "current_node_id": null,
  "nodes": [
    {
      "id": "<uuid>",
      "tree_id": "<与 tree.id 相同>",
      "title": "<节点名>",
      "description": "<一句话或 null>",
      "icon": "<约定图标值>",
      "category": "<主干模块名>",
      "difficulty": 1,
      "estimated_minutes": 90,
      "depth_level": 1,
      "position_x": 0,
      "position_y": 0,
      "order_in_level": 0,
      "learning_objectives": "[\"目标1\", \"目标2\"]",
      "key_concepts": "[\"概念1\", \"概念2\"]",
      "recommended_depth": "Recognize | Understand | Use | Transfer | DeepMastery",
      "depth_rationale": "<1-2句具体理由>",
      "observable_evidence": "[\"证据1\", \"证据2\"]"
    }
  ],
  "edges": [
    {
      "id": "<uuid>",
      "source_node_id": "<前置节点 uuid>",
      "target_node_id": "<后继节点 uuid>",
      "edge_type": "prerequisite",
      "label": null
    }
  ],
  "progress": [
    {
      "node_id": "<节点 uuid>",
      "status": "not_started",
      "evidence": ""
    }
  ]
}
```

---

## 9. 参考来源

- TypeScript 类型定义：`src/types/learning.ts`
- 真实节点数据示例：`src/lib/nestTreeData.ts`
- 工作流引用：`SKILL.md` 阶段 B 第 7 步
