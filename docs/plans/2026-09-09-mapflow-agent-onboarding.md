# MapFlow Agent onboarding and progressive-disclosure Skill

日期：2026-09-09

## 目标与范围

为本地 Codex/Claude Code Agent 提供一个可以连接用户 MapFlow 账号的 Skill。它覆盖读取个人学习进度、创建私人学习地图、补充节点和依赖边、切换自动/手动布局以及更新节点坐标。Skill 只指导决策和工具调用，MCP relay/server 才负责认证和网站写入。

本次前端仓库改动范围包含：控制台网站/Agent 双入口、网站聚光灯导览、Agent 接入教程、账号隔离状态和手动布局回归；同时保留 skills/mapflow/**、skills/skill-tree-generator/SKILL.md 的在线/离线触发边界、README 接入说明和本计划文档的既有改动。Skill-only 分支已推送到公开仓库的非默认分支并完成锁定提交验证；没有改动用户全局 Agent 配置、服务器源码或 relay 实现。`@mapflow-publish/mcp` relay 包已发布，实际能力以连接后的 `tools/list` 为准；`create_tree` 仍依赖新 server 能力发布，Skill 可安装不代表 MCP 新能力已经在生产可用。

## 控制台新手引导补充范围

控制台首次进入提供两个入口：直接在网站开始（适用于没接触过 Agent 的用户）和连接自己的 Agent（适用于接触过 Agent 或正在使用 Agent 的用户）。网站路径使用暗色遮罩、真实目标区域聚光和浅色提示框，按顺序说明生成学习地图、公共地图、我的地图，以及进入任意地图后的画布拖动/缩放、节点、聊天输入与发送、记录进度；每个步骤分别定位实际控件。导览只改变自己的持久化步骤，不自动生成、加入地图或发送消息，也不把导览完成写成学习完成。

导览状态按匿名或账号 key 隔离，跳过后由显式“重新打开新手引导”操作重新进入；切换账号、路径、路由和地图时保留当前账号状态。导览组件挂在控制台共同层，目标缺失时释放遮罩和焦点圈，目标异步出现或视口滚动/缩放后重新测量，Escape 跳过并恢复焦点。身份、生成、Agent 教程等真正的 modal 打开时暂停导览，关闭后继续。

Agent 路径直接打开浅色接入教程，展示 Codex/Claude Code 注册命令、授权验证、Skill 安装和项目任务；教程中的视频目前是明确不可播放的占位。Skill URL 固定到已验证提交 `017b5f96111fa73297e7603645681a7e7f4dc411`，MCP 注册命令保持真实可复制；新 `create_tree` 服务端能力仍按连接后的 `tools/list` 和部署状态如实呈现。

## 渐进披露结构

skills/mapflow/SKILL.md 只放短描述、共享安全/版本规范和路由：

- references/connection.md：Skill 文件与 MCP 连接的分层、Codex/Claude Code 命令、device auth 和发行状态；
- references/create-tree.md：新建完整图、补节点/边、创建幂等和网站落点；
- references/update-layout.md：读取 revision、auto/manual、坐标 patch 和冲突重读；
- references/learning-semantics.md：节点/边语义、证据与进度边界，以及视觉布局和学习顺序的区分。

路由要求按需读取 reference，不把所有细节预加载。自然追问、解释和比较可以作为不写入网站的结果；方向清楚时不强制逐节点审批、固定节点数量或逐节点通关。

## 已确认的 MCP 契约

### 创建地图

mapflow.create_tree 接收（以当前 server `tools/list` 和 Postgres 写入实现为准）：

~~~
{
  tree: {
    topic,
    title,
    description?,
    difficultyLevel,
    layoutMode: "auto" | "manual"
  },
  nodes: [{
    id, title, category,
    description?, icon?, difficulty?, estimatedMinutes?, depthLevel?,
    positionX?, positionY?, orderInLevel?, learningObjectives?, keyConcepts?,
    recommendedDepth?, depthRationale?, observableEvidence?
  }],
  edges?: [{ id, sourceNodeId, targetNodeId, edgeType, label? }],
  idempotencyKey
}
~~~

`tree.topic`、`tree.title`、`tree.description` 的上限分别为 240、240、4000；`difficultyLevel` 是 1–40 的非空文本，没有 server enum；`layoutMode` 必须是 `auto` 或 `manual`。节点至少 1 个、最多 500 个，边最多 2000 条；节点和边 id 在本树内唯一但不要求 UUID。节点 title 上限 240、description 上限 8000、icon 上限 80、category 上限 120；`difficulty` 为 0–10，estimated minutes/depth/order 非负，坐标必须有限且绝对值不超过 1,000,000。`recommendedDepth` 的枚举是 `Recognize`、`Understand`、`Use`、`Transfer`、`DeepMastery`；`edgeType` 是 1–80 的非空文本，没有 server enum。节点默认 icon=`circle`，数值字段为 0，recommendedDepth=`Understand`，证据为空；边端点必须存在且图无环。

创建请求的 `learningObjectives`、`keyConcepts`、`observableEvidence` 优先以 `string[]` 传入（也兼容合法 JSON 数组字符串），由服务端转换为内部 JSON 文本。**现有 mutation 的 patch 兼容形态不同：**只有 `add_node` 当前支持以 JSON 数组发送 learningObjectives 和 keyConcepts；`update_node` 不更新这两列。`observableEvidence` 在 add_node/update_node 中都由旧 parser 接收普通字符串；要保存数组证据时，把 JSON 数组编码成字符串，例如 `"[\"运行失败用例。\"]"`。创建默认作用域是当前账号的私人树，状态为 ready；返回 `{ libraryEntryId, treeId, revision: 1, layoutMode }`。创建幂等键长度 1–128 且按账号作用域处理：同 key 同 payload 返回原创建 receipt，不同 payload 返回 `create.idempotency_conflict`。

### 增量变更与布局

既有 mapflow.apply_tree_mutation 使用 libraryEntryId、mutation.revision、mutation.idempotencyKey 和 mutation.patch。patch 字段使用 camelCase。update_node 支持 positionX、positionY、orderInLevel；update_tree 支持 layoutMode。读取 mapflow.get_tree 时，节点响应字段保持 snake_case，tree.layoutMode 是 MCP 字段；Web DTO 的 layout_mode 不应被带入 MCP patch。完整的三节点创建、补节点、加边和调坐标验收样例见 `skills/mapflow/references/create-tree.md`。

开始编辑会话时先 whoami → get_progress → get_tree（会话范围已确认时可复用 whoami）；后续写入沿用 get_tree 或上一条成功 mutation 返回的最新 revision，冲突时重新读取并重新计算未完成的意图，不盲目重试旧 payload。普通写操作无需层层额外批准，删除、清空和覆盖需先明确作用域。

## 安全与学习边界

- Skill 不读取或展示 token，不要求用户粘贴 token；首次 device auth 由连接器引导。
- 未出现在 tools/list 的能力视为 server/relay 尚未更新，必须如实报告。
- 本地生成 JSON 不等于网站保存，项目中已有代码也不等于用户掌握；不凭这些事实标记节点完成。
- 用户的目标决定图的粒度和证据，不强制 30–80 节点或每节点审批/通关。
- 新节点和边表达学习结构；坐标和 layoutMode 表达视觉布局，二者不能混为一谈。

## 确定性验证记录（2026-09-09）

- PASS：使用 python -X utf8 scripts/quick_validate.py skills/mapflow 校验 frontmatter、命名和未完成占位符；输出 Skill is valid。Windows 默认 GBK 读取会误报编码异常，UTF-8 模式通过。
- PASS：解析 skills/mapflow/入口及四个 reference 的 Markdown 相对链接，全部存在且可达。
- PASS：在目标仓库运行 npx --yes skills add . --list，本地源发现 mapflow 与 skill-tree-generator；在两个临时项目目录分别以 Codex 和 Claude Code agent 做 copy 安装，skills list --json 分别返回 sourceType=local 的 mapflow。临时目录随后删除，未写用户全局 Agent 配置、未执行 device auth、未输出 token。
- PASS：从 `https://github.com/rongyan-123/MapFlow/tree/017b5f96111fa73297e7603645681a7e7f4dc411/skills/mapflow` 远程发现到 `mapflow`；本次发布修正运行了远程 `--list`，并逐一比对发布工作树与 4232 工作树的五个 Skill 文件，未重复此前已完成的 Codex/Claude Code 隔离安装。README 与本计划标明 Skill 已可安装，relay 包已发布但 `create_tree` 仍等待 server 能力发布；skill-tree-generator 明确仍是离线 JSON 用途；create-tree 示例已按当前后端逐键核对，并覆盖三节点创建、add_node 的证据字符串兼容形态、add_edge 和 update_node 布局。
- PASS：git diff --check 通过。diff 自审时保留了其他 agent 的未跟踪前端文件，不触碰它们；本任务只修改约定的 Skill、README、离线触发边界和计划文件。

## 前端新手引导验证记录（2026-09-09）

- PASS：网站路径在桌面与 390×844 移动视口完成实际操作验证：选择网站开始、生成说明、公共地图、我的学习、打开任意地图、选择节点、聊天输入区和记录进度。下一步只推进导览状态；没有自动生成、加入、发送或标记完成。
- PASS：无目标、部分出视口或被固定底栏遮挡时释放暗遮罩、aria-modal 和焦点循环，并提示用户滚动详情面板找到“标记为已完成”；目标完整可操作时才显示聚光。
- PASS：聊天输入框与发送按钮由同一 chat-compose 目标包围，移动端提示框不会覆盖发送控件；发送仍需用户明确点击。
- PASS：桌面截图和移动截图保存在本机验证目录；个人地图后的聊天/进度使用隔离 fixture 账号及本地 API 响应，匿名公共页到登录/加入入口使用真实页面验证。没有使用真实凭据、发送真实消息或写入生产学习状态。
- PASS：最后一次全量验证包含 Vitest、TypeScript --noEmit、Vite production build 和 staged diff 检查；build 仅保留既有大 chunk 警告。
