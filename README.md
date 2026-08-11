# MapFlow

MapFlow 是一个面向真实用户的技能树学习平台前端。线上版本运行于 [xxian.fun](https://xxian.fun)，匿名访客可以浏览公共技能树，受邀激活的用户可以登录、建立个人树库并保存自己的学习进度。

## 当前主线

`main` 是服务器产品前端的唯一主线，包含：

- 公共技能树池与完整示例树；
- 邀请码激活、账号登录与安全会话；
- 与账号绑定的个人树库；
- 每个用户相互隔离的节点完成进度。

浏览器中的显示状态不代表权限。账号、个人数据和后续管理员功能均由服务端验证，修改前端代码不能绕过后端鉴权。

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
