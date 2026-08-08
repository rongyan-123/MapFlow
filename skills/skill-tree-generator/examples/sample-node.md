# 高质量节点示例与劣质对照

本文档是 `SKILL.md` "触发器与加载说明"一节引用的示例节点，用于向 AI 和人类作者展示"一个有质量的节点长什么样"。完整字段规范见 `references/field-schema.md`，质量标准见 `references/quality-standards.md`。

---

## 一、合格示例："依赖注入与控制反转"节点

以下是一个通过全部质量标准的 SkillNode，主题为"依赖注入"——这是所有后端框架共有的核心技术概念，通用性强、深度空间大，适合作为教学示例。

### 1.1 节点 JSON

```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "tree_id": "e5f6a7b8-9012-34cd-ef56-7890123456cd",
  "title": "实现依赖注入与控制反转",
  "description": "学习依赖注入（DI）与控制反转（IoC）的核心机制，建立可测试、松耦合的模块化架构能力。",
  "icon": "puzzle",
  "category": "框架核心",
  "difficulty": 3,
  "estimated_minutes": 120,
  "depth_level": 3,
  "position_x": 0,
  "position_y": 0,
  "order_in_level": 0,
  "learning_objectives": "[\"能用自己的话解释控制反转(IoC)与依赖注入(DI)解决的耦合问题及适用边界\", \"能在 NestJS 项目中独立配置 Provider 并实现 Controller→Service→Repository 三层注入的最小闭环\", \"能诊断并修复典型的 DI 错误场景（循环依赖、Provider 未注册、作用域冲突）\"]",
  "key_concepts": "[\"控制反转(IoC)\", \"依赖注入容器\", \"Provider 模式\", \"NestJS @Injectable\"]",
  "recommended_depth": "Use",
  "depth_rationale": "该节点是可重复使用的工程能力，后续所有模块化开发节点（动态模块、自定义 Provider、测试替身）都依赖于此；学习者需要脱离逐行照抄后仍能在 NestJS 项目中独立完成 Provider 注册、注入和作用域配置，而不能只是理解概念。",
  "observable_evidence": "[\"能在 NestJS 项目中从零搭建包含 Controller→Service→Repository 三层 Provider 链的最小应用，运行 `npm run start:dev` 后成功响应 HTTP 请求\", \"能写出并运行一个测试用例，验证当故意移除 @Injectable() 装饰器后 DI 容器抛出可识别的错误信息\", \"能用白板或文档画出 Provider 注册→实例化→注入的完整流程图，并口头解释每个步骤的职责\"]"
}
```

### 1.2 为什么这个节点是合格的

以下逐字段对照 `field-schema.md` 和 `quality-standards.md` 的规则，说明每个关键决策的理由。

| # | 字段 | 值 | 为什么这么写 | 对应规范 |
|---|------|----|--------------|----------|
| 1 | `title` | `"实现依赖注入与控制反转"` | 以动作动词"实现"开头，而非裸名词"依赖注入"。`field-schema.md` 3.3 节要求 title"建议用动词开头，表达"掌握/理解/实现 X"的语义"，否则学习者看不到学习动作。 | field-schema 3.3 |
| 2 | `learning_objectives` | 三条，全部以"能…"开头 | 每条都是可被第三方判断"做到了还是没做到"的行为描述。"能解释…""能实现…""能诊断并修复…"分别对应 Understand/Use/Use 的标志动词，禁止出现"了解""掌握"等不可验证词。 | quality-standards 3.1, 3.3 |
| 3 | `key_concepts` | 四个，均为该节点独有技术词 | `"控制反转(IoC)"`、`"依赖注入容器"`、`"Provider 模式"`、`"NestJS @Injectable"` 都是该节点独有的核心概念，不含"编程""开发"等通用词。quality-standards 5.2 强调：如果有人只看到这组词就能猜出节点讲什么，才算合格。 | quality-standards 5.1-5.3 |
| 4 | `recommended_depth` + `depth_rationale` | `"Use"` + 具体理由 | rationale 说明了三个要素：(1) 为什么是 Use 而非 Understand——"需要脱离逐个照抄后仍能独立完成"；(2) 与后续节点的依赖关系——"后续所有模块化开发节点都依赖于此"；(3) 具体的工程产出——"独立完成 Provider 注册、注入和作用域配置"。这完全避开了 quality-standards 1.3 节禁止的"需要掌握""很重要"等空洞表述。 | quality-standards 1.3, field-schema 3.16 |
| 5 | `observable_evidence` | 三条，每条指向可运行/可演示产物 | 第一条指向 `npm run start:dev` + HTTP 响应（运行结果）；第二条指向测试用例输出（自动化验证）；第三条指向白板/文档 + 口头解释（可演示产出）。全部对照 quality-standards 4.2 的可接受证据形式表，没有"完成课程""看完文档"等不可验证描述。 | quality-standards 4.2-4.3, field-schema 3.17 |
| 6 | 字符串化 JSON 数组 | `learning_objectives` / `key_concepts` / `observable_evidence` 均为 `"[\"...\"]"` 格式 | `field-schema.md` 第 7 节明确指出：这三个字段的前端 TypeScript 类型是 `string`（不是 `string[]`），存储的是字符串化的 JSON 数组，内层双引号必须用反斜杠转义。本示例中每条都严格使用 `\"` 转义，后端 `JSON.stringify()` 后前端 `JSON.parse()` 可正确还原。其中 `observable_evidence` 不可为 `null`（类型定义中不含 `| null`），已填入完整数组。 | field-schema 7.1, 7.3 |

---

## 二、劣质对照：同一节点的反例

以下是同一主题的劣质版本——看似"有内容"，实际无法通过质量标准。

### 2.1 劣质节点 JSON

```json
{
  "id": "bad-di-node",
  "tree_id": "e5f6a7b8-9012-34cd-ef56-7890123456cd",
  "title": "依赖注入",
  "description": null,
  "icon": "unknown-icon",
  "category": "",
  "difficulty": 2,
  "estimated_minutes": 30,
  "depth_level": 1,
  "position_x": 0,
  "position_y": 0,
  "order_in_level": 0,
  "learning_objectives": "[\"了解依赖注入\", \"掌握 IoC 思想\"]",
  "key_concepts": null,
  "recommended_depth": "Use",
  "depth_rationale": "依赖注入很重要，需要掌握",
  "observable_evidence": "[\"看完依赖注入教程\", \"理解了怎么用\"]"
}
```

### 2.2 劣质点逐条分析

| # | 问题字段 | 劣质表现 | 违反了哪条规范 | 为什么这是问题 |
|---|----------|----------|----------------|----------------|
| 1 | `id` | `"bad-di-node"` | field-schema 3.1 | 不是 UUID v4 格式。`id` 是节点全局唯一标识，非标准格式可能导致前端索引失败或与其他节点碰撞。 |
| 2 | `title` | `"依赖注入"` | field-schema 3.3 | 裸名词，无学习动作。学习者看到标题不知道要"做什么"——是认得这个术语就行，还是要写出代码？合格写法如 `"实现依赖注入与控制反转"` 直接表达学习终点。 |
| 3 | `icon` | `"unknown-icon"` | field-schema 3.5 | 不在 36 个约定图标值列表中。前端图标组件只渲染已知值，使用未知值将导致节点图标位置显示为空白。 |
| 4 | `category` | `""` | field-schema 3.6 | 空字符串。category 决定节点的分组着色和视觉聚类，为空则节点失去模块归属，在树中孤立显示。 |
| 5 | `depth_level` | `1` | quality-standards 2.1 | 依赖注入放在 depth_level=1 不合理——学习者需要先了解 TypeScript 装饰器和模块化编程概念（depth_level=2 的前置节点）才能学习 DI。depth_level=1 通常放全景认知节点。 |
| 6 | `estimated_minutes` | `30` | quality-standards 1.3 建议时长 | `recommended_depth: "Use"` 的节点建议 90-180 分钟。30 分钟对 Use 级别严重低估——不可能在半小时内从零实现三层 Provider 注入闭环。 |
| 7 | `learning_objectives` | `"[\"了解依赖注入\", \"掌握 IoC 思想\"]"` | quality-standards 3.1 第 4 条 | "了解"和"掌握"都是禁止使用的不可验证词。第三方无法判断一个人是否"了解"了——"了解"到什么程度算达标？合格写法应为"能用自己的话解释…""能在 NestJS 中实现…"等可观察行为。 |
| 8 | `key_concepts` | `null` | quality-standards 5.1 | `null` 会导致搜索和标签功能失效。且即便不为 null，该节点的劣质版也完全没有提供任何关键技术词用于检索。 |
| 9 | `depth_rationale` | `"依赖注入很重要，需要掌握"` | field-schema 3.16, quality-standards 1.3 | 全面违反两条规范：(1) "很重要"是空洞判断，没有说明为什么是 `"Use"` 而非 `"Understand"` 或 `"Transfer"`；(2) 没有给出任何与 Use 级别匹配的具体理由——什么是 Use 级别的"能做的事"，这个节点没说。 |
| 10 | `observable_evidence` | `"[\"看完依赖注入教程\", \"理解了怎么用\"]"` | quality-standards 4.1 第 2、3 条 | "看完教程"是过程描述不是产物——看了不代表会了；"理解了"是不可验证的内部心理状态。合格证据必须指向具体产物：运行结果、测试输出、可演示的流程图。 |

---

## 三、三个关键字段的字符串化格式速查

`learning_objectives`、`key_concepts`、`observable_evidence` 在 JSON 文件中必须写成**字符串化的 JSON 数组**，内层双引号使用 `\"` 转义。以下是三种常见写法的对照：

### 3.1 正确写法（合格示例中的写法）

```json
"learning_objectives": "[\"能用自己的话解释控制反转(IoC)与依赖注入(DI)解决的耦合问题及适用边界\", \"能在 NestJS 项目中独立配置 Provider 并实现三层注入的最小闭环\"]"
```

为什么正确：外层是一个 string 值，内层是一个合法的 JSON 数组字符串。前端 `JSON.parse(node.learning_objectives)` 可得到 `string[]`。

### 3.2 错误写法 A：当成原生 JSON 数组

```json
"learning_objectives": ["能用自己的话解释...", "能在 NestJS 项目中..."]
```

问题：TypeScript 类型要求 `learning_objectives: string`，传入数组会导致类型错误。

### 3.3 错误写法 B：内层引号未转义

```json
"learning_objectives": "["能用自己的话解释...", "能在 NestJS 项目中..."]"
```

问题：内层的 `"` 未转义，JSON 解析器会在第一个 `"` 处认为字符串已结束，导致解析失败。

### 3.4 错误写法 C：observable_evidence 为 null

```json
"observable_evidence": null
```

问题：在 `src/types/learning.ts` 类型定义中，`observable_evidence` 的类型是 `string`（不含 `| null`），与 `learning_objectives`（`string | null`）和 `key_concepts`（`string | null`）不同。`observable_evidence` 不可为 null，至少需要填入 `"[]"`。

---

## 四、自检清单（节点写入前逐条核对）

撰写每个节点的五项质量字段后，对照以下清单自检（取自 `quality-standards.md` 第 8 节）：

- [ ] `recommended_depth` 是否匹配节点在树中的位置（依赖链末端才放 DeepMastery）？
- [ ] `depth_rationale` 是否说明了"为什么是这个深度"而非空洞的"很重要"？
- [ ] `learning_objectives` 中的每条是否可用"能……"开头？是否有不可验证词（"了解""掌握""熟悉""知道"）？
- [ ] `learning_objectives` 中的动词是否与 `recommended_depth` 的标志动词匹配？
- [ ] `observable_evidence` 的每条是否描述了具体产物（不是"完成课程""看完文档"）？
- [ ] `observable_evidence` 是否与 `recommended_depth` 匹配（Recognize 不应要求写代码；Use 不应只要求口头解释）？
- [ ] `key_concepts` 是否 2-5 个？是否都是该节点独有的技术词（不含"编程""代码"等通用词）？
- [ ] 五项之间是否自洽？例如 `recommended_depth="Recognize"` 但 `learning_objectives` 出现"能实现……"？
