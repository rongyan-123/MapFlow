# @mapflow-publish/mcp

一行命令,让你的 Agent(Claude Code / Codex / Cursor)连接 MapFlow:
读取学习进度、读写你自己的私有技能树,还能按你的语义把树重组成「块」。
所有写入都有审计记录。需要已注册的 xxian.fun 账号。

## 一行命令(首次约 3 秒授权)

```bash
npx @mapflow-publish/mcp
```

首次运行自动打开浏览器 → 在 xxian.fun 授权页点「允许」(复用你的登录态)→
token 存入本机 `~/.mapflow/token`(权限 600)。之后每次运行静默直连,不再询问。

## 接入 Claude Code

```bash
claude mcp add mapflow -- npx @mapflow-publish/mcp
```

之后在 Claude Code 里直接说「读一下我的学习进度」「把安全相关的节点整理成块」即可。

## 工具

| 工具 | 作用 |
|---|---|
| `mapflow.get_progress` | 列出所有树 + 完成进度(含证据) |
| `mapflow.get_tree` | 读一棵树全量:节点/边/块/完成度 |
| `mapflow.apply_tree_mutation` | 提交一条编辑命令(add_node / add_edge / add_block / set_node_block 等) |
| `mapflow.create_tree` | 用完整节点图创建一棵私人树,可选同时写入块和节点归属 |
| `mapflow.whoami` | 查看当前 token 身份与授权状态 |

按语义把树重组成块的操作方法见 [BLOCKS.md](BLOCKS.md)。

支持从 Git 仓库加载 Skill 的 Agent 可直接加载项目内的 [`skills/mapflow-mcp/SKILL.md`](../skills/mapflow-mcp/SKILL.md)。Skill 与本 README、服务器 `tools/list` 共享同一条规则：前端只有关系布局和按块布局两种，坐标字段不能改成自由画布。

前端展示固定只有两种布局:默认的关系布局和按块布局。Agent 修改节点坐标、层内顺序或 `layoutMode: auto/manual` 都不能改变这两种布局,也不能创建第三种布局。依赖边或学习层级变化会改变学习图语义,从而影响自动计算结果;这不提供自由画布能力。需要按块布局时,树必须有至少一个块以及一个有效的节点归属;旧树没有块数据时仍可正常使用关系布局。

## 技术说明

`/mcp` 端点只接受单个 JSON-RPC 2.0 请求对象;畸形请求体回 HTTP 400/415,不支持 JSON-RPC batch(顶层数组请求回 -32600)。

## 环境变量(全部可选)

- `MAPFLOW_SERVER_URL` — 服务器地址,默认 `https://xxian.fun`
- `MAPFLOW_TOKEN_FILE` — token 文件路径,默认 `~/.mapflow/token`
- `MAPFLOW_TOKEN_LABEL` — 授权页显示的用途名,默认 `npx @mapflow-publish/mcp`

## 重新授权 / 吊销

token 被吊销(HTTP 401 `auth.token_revoked`)后,relay 会自动清掉缓存 token 并重新授权一次,
通常无需手动处理。想换一个用途名、或手动重来时:

```bash
rm ~/.mapflow/token
npx @mapflow-publish/mcp
```

服务器端吊销入口:运维 SQL 置 `revoked_at`(管理界面后续提供)。

## 隐私与安全

- token 明文只在授权那一刻出现一次:本机 `~/.mapflow/token`(权限 600)与签发响应;
  服务器只存 SHA-256 摘要,泄露数据库也无法反推 token。
- 所有写操作以「哪棵树、什么命令、哪个 token」落审计,可按账户 SQL 追溯。
- relay 不收集任何遥测;除你授权的树外不访问任何数据。
