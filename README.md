# MapFlow

MapFlow 是一个面向真实用户、现已正式开放的技能树学习平台。线上版本运行于 [xxian.fun](https://xxian.fun)，所有人都可以直接访问网站并浏览公共技能树；需要保存个人树库、学习进度或使用 AI 生成器时，可以在站内注册账号。

## 当前主线

`main` 是服务器产品前端的唯一主线，包含：

- 公共技能树池与完整示例树；
- 公开注册、账号登录与安全会话（注册页可直接领取邀请码）；
- 与账号绑定的个人树库；
- 每个用户相互隔离的节点完成进度；
- 显式 AI 技能树生成器：填写固定需求、审阅规划，并在确认后后台生成个人技能树。

首版生成器使用用户自己的 DeepSeek API Key，并固定连接 DeepSeek 官方接口；Key 只保存在当前生成窗口的内存中，不写入浏览器存储或服务端数据库。重新规划和细节调整发生在正式生成之前，生成完成的技能树默认只进入当前用户的个人树库。

浏览器中的显示状态不代表权限。账号、个人数据和后续管理员功能均由服务端验证，修改前端代码不能绕过后端鉴权。

## 线上使用

直接访问 [xxian.fun](https://xxian.fun) 即可开始使用：

- 公共技能树和示例内容无需登录即可浏览；
- 需要保存个人学习进度、建立个人树库或使用 AI 生成器时，在网站内注册账号即可；
- 注册页面提供直接领取邀请码的入口，无需另外申请或等待人工发放。

## 本地开发

```bash
npm install
npm run dev
```

开发服务器默认把 `/api` 转发到 `http://127.0.0.1:3000`。需要使用其他 MapFlow Server 地址时，设置 `MAPFLOW_API_TARGET` 后再启动 Vite。

当前 `main` 面向服务器产品，不保证脱离后端后提供完整功能。

## 原单人静态看板

原来的无后端单人看板保存在 Git 标签 `standalone-v0.1.0`：

```bash
git switch --detach standalone-v0.1.0
npm install
npm run dev
```

该标签是历史稳定版本，不再与服务器产品同步开发。需要修改、导入或生成自己的技能树时，可以让 Claude Code、Codex 或其他 Agent 阅读该版本的 README 和项目结构后完成。

## 使用生成 Skill

仓库仍提供 `skills/skill-tree-generator/`。在支持 Skill 的 Agent 中打开仓库后，可以直接提出：

> 帮我生成一棵学习 XX 的技能树。

Skill 会引导确认学习方向和目标，并生成符合 MapFlow 数据结构的技能树。

## 使用 MapFlow 接入 Skill

skills/mapflow/ 面向 Codex 和 Claude Code 的在线接入工作流：它指导 Agent 通过 MapFlow MCP 读取账户进度、创建私人学习地图、补充节点和整理布局。它与 skill-tree-generator 分工不同，前者需要 MCP 连接后才会写入网站，后者只生成本地 SKILL_TREE.json。

MCP 连接和 Skill 文件需要分别安装。连接器首次运行会引导浏览器完成 device authorization，不要把 token 粘贴到聊天中。Skill 已发布到公开分支，可从已验证的提交 URL 安装。`@mapflow-publish/mcp` relay 包当前 npm latest 为 `0.1.0`，会按连接服务器的 `tools/list` 动态暴露能力；`create_tree` 是否可用以该清单为准，尚需对应 server 能力发布，不能把 Skill 已可安装当作 MCP 新能力已在生产可用。Codex 和 Claude Code 的命令分别是：

~~~text
codex mcp add mapflow -- npx -y @mapflow-publish/mcp
claude mcp add --transport stdio mapflow -- npx -y @mapflow-publish/mcp
~~~

已验证的 Skill 锁定源（提交 `017b5f96111fa73297e7603645681a7e7f4dc411`）和安装命令是：

~~~text
npx skills add https://github.com/rongyan-123/MapFlow/tree/017b5f96111fa73297e7603645681a7e7f4dc411/skills/mapflow --skill mapflow --agent codex
npx skills add https://github.com/rongyan-123/MapFlow/tree/017b5f96111fa73297e7603645681a7e7f4dc411/skills/mapflow --skill mapflow --agent claude-code
~~~

若未来将 Skill 合并到默认分支，简写命令才是：`npx skills add rongyan-123/MapFlow --skill mapflow --agent codex` 或 `--agent claude-code`。接入后，Agent 会先调用 MapFlow MCP 的 `mapflow.whoami`，再调用 `mapflow.get_progress` 选择 `libraryEntryId`；编辑会话开始时调用 `mapflow.get_tree` 读取 revision。若 `create_tree` 不在 `tools/list`，说明连接的服务端尚未提供该能力。

## 仓库边界

- `MapFlow`：公开前端与生成 Skill；
- `mapflow-server`：私有账号、数据、平台适配器、HTTP 与部署逻辑；
- `skill-tree-engine`：私有、宿主无关的 A/B/C 技能树生成引擎。

服务端固定依赖经过验证的 Engine commit，不跟随浮动分支。

## 验证

```bash
npm test
npm run build
```

## 技术栈

React 18 · TypeScript · Vite · React Flow · Tailwind CSS · TanStack Query

## 许可证

MIT
