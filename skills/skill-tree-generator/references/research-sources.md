# 技能树研究来源与搜索词参考

本文档定义技能树生成时的研究来源清单与搜索词模板，是 `SKILL.md` 阶段 B 第 5 步（大范围搜索）的操作手册。AI 拿到本文档即可照着执行搜索，不需要额外推断。

---

## 1. 搜索总原则

1. **方向驱动搜索词**：同一技术栈，不同方向搜索侧重点不同。例如 `"NestJS"` 通用搜索不足以区分"后端工程师构建 CRUD API"和"AI 应用方向做 Agent 编排"——必须按学习者目标定制搜索词。
2. **每层主干至少 1 个来源支撑**：生成的技能树中，每个主干模块（depth_level=1）至少有一个明确的研究来源 URL 作为依据。禁止凭印象编造。
3. **记录来源 URL**：搜索过程中每一条关键信息都附带来源链接，供后续学习者质疑或追溯。
4. **广度优先，再深度**：先用宽泛词搜索路径全貌（roadmap、大纲），再用细分词搜索具体模块（如"消息队列选型"、"鉴权方案对比"），避免一开始就陷入细节。
5. **时效性优先**：优先使用近 2 年内的资料。如果搜索结果中无明确日期，优先选择 star 数高、更新频繁的仓库；优先选择官方文档而非第三方博客。

---

## 2. 来源一：主流学习路径

### 2.1 站点清单

| 站点 | URL | 用途 | 特点 |
|------|-----|------|------|
| roadmap.sh | https://roadmap.sh | 获取技术栈的结构化学习路线 | 社区驱动、定期更新、按角色分类 |
| 各语言/框架官方教程 | 如 https://docs.nestjs.com、https://docs.python.org/3/tutorial/ | 获取官方推荐的学习顺序 | 权威性强、第一手信息 |
| freeCodeCamp | https://www.freecodecamp.org | 获取完整课程大纲和章节结构 | 免费、覆盖广泛、有项目实战 |
| The Odin Project | https://www.theodinproject.com | 获取 Web 开发完整路径 | 结构清晰、含大量阅读材料 |
| Coursera | https://www.coursera.org | 获取大学级课程大纲 | 名校背书、有专项课程系列 |
| edX | https://www.edx.org | 获取大学级课程结构 | 与 Coursera 互补、MIT/Harvard 课程 |
| Udemy | https://www.udemy.com | 获取热门课程的内容大纲 | 覆盖面广、可看到课程目录 |

### 2.2 搜索词模板

使用 `<topic>` 占位符替换为具体技术栈：

| 搜索词模板 | 说明 | 适用场景 |
|-----------|------|---------|
| `<topic> roadmap` | 在搜索引擎中搜索 roadmap.sh 或社区路线图 | 任何技术栈的全局路径 |
| `<topic> learning path` | 搜索结构化学习路径 | 与 roadmap 互补，偏社区博客 |
| `<topic> official tutorial` | 搜索官方教程 | 框架/语言有官方文档时优先用 |
| `<topic> freecodecamp curriculum` | 搜索 freeCodeCamp 对应课程 | Web 开发类技术 |
| `<topic> syllabus` | 搜索课程大纲 | MOOC 平台或大学课程 |
| `<topic> course outline` | 搜索课程章节结构 | 与 syllabus 互补 |
| `<topic> 学习路线` | 中文社区学习路线汇总 | 中文开发者较多的技术栈 |
| `<topic> 学习路径` | 中文社区结构化路径 | 与"学习路线"互补 |

### 2.3 使用策略

1. 优先用 `roadmap.sh` 查看是否有现成的角色路线图（如 Frontend、Backend、DevOps 等）。
2. 如果目标技术栈有官方文档，用 `official tutorial` 获取推荐的学习顺序。
3. 用 freeCodeCamp / The Odin Project / MOOC 大纲补充分层和项目实战环节。
4. 中文社区（如掘金、CSDN）的"学习路线"文章通常提供更贴近国内场景的路径参考。

---

## 3. 来源二：GitHub 生态

### 3.1 站点清单

| 站点/资源 | URL | 用途 | 特点 |
|-----------|-----|------|------|
| GitHub awesome 列表 | https://github.com 搜索 `awesome-<topic>` | 获取社区认可的资源汇总 | 覆盖面广、有分类结构 |
| 知名仓库 README | 如 https://github.com/nestjs/nest | 获取技术栈图和架构概览 | 直接来自项目维护者 |
| GitHub Trending | https://github.com/trending | 发现当前热门仓库 | 时效性强 |
| GitHub Topics | https://github.com/topics | 按主题浏览仓库 | 有分类标签 |
| GitHub Collections | https://github.com/collections | GitHub 官方精选列表 | 质量有筛选 |

### 3.2 搜索词模板

| 搜索词模板 | 说明 | 适用场景 |
|-----------|------|---------|
| `github awesome <topic>` | 在搜索引擎搜索 awesome 列表 | 任何技术栈的资源汇总 |
| `<topic> awesome list` | 同上，语序变体 | 同上 |
| `github <topic> learning resources` | 搜索学习资源仓库 | 需要学习资源集合时 |
| `github <topic> roadmap` | 搜索技术栈的 GitHub roadmap | 技术栈本身在 GitHub 有 roadmap 的 |
| `<topic> awesome github` | 中文社区整理的 awesome 列表 | 中文开发者偏好的技术栈 |
| `<topic> awesome <sub-topic>` | 细分主题的 awesome 列表 | 深入特定子领域 |

### 3.3 使用策略

1. 先搜 `github awesome <topic>` 找出社区认可度最高的资源列表。
2. 打开对应技术栈的知名仓库 README，查看其技术栈图（通常有 Architecture / Tech Stack 章节）。
3. awesome 列表的目录结构可以作为技能树分层的参考。
4. 如果 awesome 列表仓库很久没更新（>2 年），标注并优先采用更活跃的替代来源。

---

## 4. 来源三：思维导图 / 知识图谱

### 4.1 站点清单

| 站点 | URL | 用途 | 特点 |
|------|-----|------|------|
| Xmind 分享页 | https://xmind.app/share/ | 搜索社区共享的思维导图 | 图形化展示，结构直观 |
| ProcessOn | https://www.processon.com | 搜索中文社区的流程图和知识图谱 | 中文资料丰富、可搜索模板 |
| 百度脑图 | https://naotu.baidu.com | 搜索中文社区的思维导图 | 免登录可查看公开分享 |
| 掘金 | https://juejin.cn | 搜索知识图谱文章和"一图读懂"系列 | 图文并茂、分类清晰 |
| CSDN | https://blog.csdn.net | 搜索知识总结和体系化文章 | 覆盖面广 |
| 知乎 | https://www.zhihu.com | 搜索"如何学习"类问题和知识总结 | 有高质量长回答 |

### 4.2 搜索词模板

| 搜索词模板 | 说明 | 适用场景 |
|-----------|------|---------|
| `<topic> 思维导图` | 中文社区思维导图汇总 | 中文资料丰富的技术栈 |
| `<topic> 知识图谱` | 搜索知识体系梳理文章 | 需要结构化全局认知 |
| `<topic> mindmap` | 英文社区思维导图 | 国际化技术栈 |
| `<topic> 脑图` | "脑图"是思维导图的别称 | 与"思维导图"互补 |
| `<topic> 知识体系` | 搜索体系化知识总结 | 获取深度结构 |
| `<topic> 一图读懂` | 掘金/CSDN 常见标题模式 | 获取简洁版结构 |
| `<topic> cheat sheet` | 速查表 | 获取核心概念列表 |

### 4.3 使用策略

1. 思维导图类结果擅长快速呈现"这个话题包含什么"，适合做主干模块候选清单。
2. 优先参考有出处/来源标注的思维导图，避免纯个人主观整理的版本。
3. Xmind 分享页的结果通常比百度脑图更规范，但百度脑图中文内容更多。
4. 掘金"一图读懂"系列文章的评论区经常有补充和纠错，值得一并阅读。

---

## 5. 来源四：大厂能力要求

### 5.1 站点清单

| 站点 | URL | 用途 | 特点 |
|------|-----|------|------|
| Boss 直聘 | https://www.zhipin.com | 获取国内互联网公司岗位 JD | 岗位量大、更新频繁、可按经验筛选 |
| 拉勾 | https://www.lagou.com | 获取互联网公司岗位 JD | 偏互联网、有薪资区间参考 |
| 脉脉 | https://maimai.cn | 获取公司内部职级和能力要求讨论 | 有匿名员工分享 |
| LinkedIn | https://www.linkedin.com | 获取国内外大厂岗位要求 | 国际化、外企为主 |
| 字节跳动技术博客 | https://blog.bytedance.com / https://tech.bytedance.com | 获取字节工程实践和能力要求 | 中文、案例丰富 |
| 阿里技术 | https://developer.aliyun.com / https://www.aliyun.com | 获取阿里技术栈和工程实践 | 中文、覆盖广 |
| 腾讯技术工程 | https://cloud.tencent.com/developer | 获取腾讯技术文章和课程 | 中文、有课程体系 |
| Google Engineering Blog | https://developers.google.com / https://research.google/blog | 获取 Google 工程实践 | 英文、前沿 |
| Meta Engineering Blog | https://engineering.fb.com | 获取 Meta 工程实践 | 英文、系统设计 |
| InfoQ | https://www.infoq.cn / https://www.infoq.com | 获取技术大会演讲和架构分享 | 中英文、大会议题有体系 |
| 极客时间 | https://time.geekbang.org | 获取系统化课程大纲 | 中文、课程章节清晰 |

### 5.2 搜索词模板

| 搜索词模板 | 说明 | 适用场景 |
|-----------|------|---------|
| `<topic> 招聘 要求` | 搜索岗位 JD 中的技术要求 | 职业导向的技能树 |
| `<topic> 岗位 JD` | 同上，更聚焦 | 同上 |
| `<topic> 工程师能力模型` | 搜索公司内部职级能力标准 | 需要分层（初级/高级/资深） |
| `<topic> 面试 要求` | 搜索面试考察点 | 面试导向的技能树 |
| `google engineering blog <topic>` | 搜索 Google 技术博客相关文章 | 深度技术实践 |
| `<topic> 进阶 能力` | 搜索高级/资深工程师要求 | 区分基础与进阶 |
| `senior engineer <topic> skills` | 搜索高级工程师技能要求 | 同上，英文版 |
| `<topic> 技术栈` | 搜索公司/团队的技术栈介绍 | 了解实际生产环境用到的技术 |
| `<topic> 架构 设计` | 搜索架构设计相关文章/演讲 | 系统设计层面 |
| `site:engineering.fb.com <topic>` | 限定 Meta 工程博客 | 精准搜索某公司 |
| `site:infoq.cn <topic>` | 限定 InfoQ 中文站 | 精准搜索技术大会内容 |

### 5.3 使用策略

1. 岗位 JD 是最贴近"市场需求"的来源——JD 中频繁出现的技术点 = 市场共识必学。
2. 大厂技术博客适合获取"实际生产环境怎么做"，用来验证技能树中是否有缺失的实践环节。
3. InfoQ 大会演讲按主题分类（如 QCon、ArchSummit），可以用大会议题目录作为技能树分层的参考。
4. 极客时间的课程大纲通常由一线工程师编写，章节结构即自然的技能树分层。
5. 国外大厂博客（Google / Meta）偏前沿和系统设计，适合补充进阶和深度节点。

---

## 6. 方向定制示例

以下两个示例展示如何根据学习者方向定制搜索词。AI 应根据学习者的实际方向，从模板中选取合适的搜索词组合，而非照搬以下全部词条。

### 6.1 示例 A：后端工程师方向学 NestJS

学习者目标：成为后端工程师，用 NestJS 构建生产级 CRUD API 和微服务。

搜索词集（6 条）：

1. `NestJS backend roadmap` — 搜索结构化的 NestJS 后端学习路线
2. `github awesome nestjs` — 获取 NestJS 社区资源汇总和分类
3. `NestJS official tutorial` — 获取官方推荐的入门顺序（https://docs.nestjs.com/first-steps）
4. `nestjs 思维导图` — 获取中文社区整理的 NestJS 知识体系
5. `NestJS 工程师 招聘 要求` — 在 Boss 直聘/拉勾搜索 NestJS 相关岗位 JD
6. `nestjs microservices architecture` — 搜索 NestJS 微服务架构的实践和最佳路径

补充备选：

- `Node.js backend roadmap` — NestJS 基于 Node.js，Node.js 后端路线图可提供上下文
- `nestjs 面试 题` — 面试题常反映出市场认为"必须掌握"的知识点
- `site:infoq.cn NestJS 实践` — InfoQ 上关于 NestJS 的实践分享

### 6.2 示例 B：AI 应用方向学 Python

学习者目标：进入 AI 应用开发方向，用 Python 做 LLM Agent、RAG、模型部署。

搜索词集（6 条）：

1. `AI application developer Python roadmap` — 搜索 AI 应用开发的 Python 学习路线
2. `github awesome llm application` — 获取 LLM 应用开发资源汇总
3. `Python AI 学习路线` — 搜索中文社区 AI 方向 Python 学习路径
4. `AI Engineer 能力模型` — 搜索 AI 工程师/算法工程师岗位能力要求
5. `langchain roadmap learning path` — 搜索 LangChain 框架的学习路径
6. `AI 应用开发 知识图谱` — 搜索 AI 应用开发领域知识体系梳理

补充备选：

- `LLM application architecture best practices` — LLM 应用架构最佳实践
- `google engineering blog machine learning` — Google ML 工程实践
- `Python RAG tutorial course outline` — RAG 相关教程大纲
- `huggingface course syllabus` — HuggingFace 官方课程大纲

### 6.3 搜索词定制指南

为任意方向构建搜索词集时，遵循以下步骤：

1. **确定技术栈关键词**（如 NestJS、Python、Rust、Kubernetes）
2. **确定方向修饰词**（如 backend、AI application、frontend、devops）
3. **从 4 类来源各取 1-2 个模板**，组合技术栈 + 修饰词形成具体搜索词
4. **检查覆盖**：确保 4 类来源（学习路径 / GitHub / 思维导图 / 大厂）至少各 1 条
5. **为学习者确认**：展示搜索词清单给学习者，问是否还有想补充的方向侧重点

---

## 7. 提炼要求

搜索完成后，AI 应从原始搜索结果中提炼出以下三项产出。每一项都需附带来源 URL，不可凭空列出。

### 7.1 主干模块候选清单

列出技能树的主干模块（depth_level=1 节点），每项附带来源。

格式示例：

```
主干模块候选（8 个）：

1. TypeScript 基础 → 来源：roadmap.sh Frontend Roadmap + freeCodeCamp JS 课程
2. NestJS 核心概念（Controller/Provider/Module）→ 来源：NestJS 官方文档教程顺序
3. 数据库与 ORM → 来源：awesome-nestjs 分类 + Boss 直聘 NestJS 岗位 JD
4. 认证与鉴权 → 来源：NestJS 官方 Authentication 章节 + InfoQ 架构分享
5. 消息队列与异步处理 → 来源：阿里技术博客 + Google 工程博客微服务实践
...
```

要求：

- 主干模块数量建议 5-10 个
- 每个主干模块至少标注 1 个来源
- 来源描述要具体到文档章节/分类名，不只是网址

### 7.2 热门 / 共识性技术点

列出在多个来源中被反复提及的技术点，这些是学习者"绕不开"的内容，通常应作为 depth_level=2 或更深的必须节点。

格式示例：

```
共识技术点（12 个）：

1. TypeScript 装饰器 → 来源(3)：NestJS 官方教程 / awesome-nestjs / 掘金 NestJS 知识图谱
2. Prisma / TypeORM → 来源(4)：awesome-nestjs / Boss 直聘 JD / 拉勾 JD / 极客时间课程
3. JWT + OAuth2 → 来源(3)：NestJS Auth 官方文档 / freeCodeCamp / 字节跳动技术博客
4. Docker 容器化 → 来源(5)：roadmap.sh Backend / Boss 直聘 / 拉勾 / InfoQ / 阿里技术
...
```

要求：

- 来源数量 ≥ 3 才列入"共识"，标注来源数量
- 共识技术点是"必修"，不应放入"可选"分支

### 7.3 争议点处理

当不同来源对同一主题的建议不一致时（如"先学 Prisma 还是 TypeORM"、"用 REST 还是 GraphQL"），按照以下规则处理：

1. **以主流共识为准**：统计多个来源中的推荐频次，取多数。
2. **在节点说明中提及争议**：在对应节点的 `learning_objectives` 或 `key_concepts` 中注明"另有 X 推荐 Y，但多数来源推荐 Z"。
3. **争议点可设为 optional**：如果争议双方各有充分理由，将该节点的 `recommended_depth` 设为 `Understand`（而非 `Master`），或将其标记为可选分支。
4. **记录争议来源**：在技能树生成完成后，附一份争议点说明（放在 `SKILL_TREE.json` 的 `description` 字段或单独备注）。

格式示例：

```
争议点（2 个）：

1. ORM 选型：Prisma vs TypeORM
   - Prisma 推荐(7)：官方文档 / awesome-nestjs / roadmap.sh / Boss 直聘(4 份 JD)
   - TypeORM 推荐(3)：NestJS 官方文档早期版本 / 掘金学习路线(2 篇)
   - 处理：以 Prisma 为主线，TypeORM 作为 Understand 级别了解

2. 先学 Docker 还是先学数据库：
   - 先数据库(6)：roadmap.sh / 3 份 JD / 极客时间课程 / The Odin Project
   - 先 Docker(2)：InfoQ 架构分享 / 知乎高赞回答
   - 处理：数据库优先，Docker 放在数据库之后、部署之前
```

---

## 8. 附录：快速搜索检查清单

AI 在阶段 B 第 5 步执行搜索时，按以下顺序操作：

- [ ] 第 1 轮：用 2-3 个宽泛搜索词了解全貌（roadmap / learning path / 学习路线）
- [ ] 第 2 轮：按 4 类来源各搜 1-2 次，覆盖不同角度的信息来源
- [ ] 第 3 轮：根据第 1、2 轮发现的技术点，搜索 2-3 个细分词（如"消息队列 选型"、"身份认证 最佳实践"）
- [ ] 检查：4 类来源是否每类至少有 1 条有效结果？如果是纯外文技术栈，思维导图类来源可以只有英文搜索结果
- [ ] 提炼：从搜索结果中提取主干模块候选清单、共识技术点、争议点
- [ ] 展示：将提炼结果展示给学习者，附来源链接，请求确认后再进入第 6 步
