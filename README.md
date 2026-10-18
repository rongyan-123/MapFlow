# MapFlow

MapFlow 是技能树学习平台，线上入口为 [xxian.fun](https://xxian.fun/)。用户可以浏览公共地图、保存私人学习地图，在学习区通过聊天和画布学习，也可以在独立酒馆使用自己的角色。

全局助手负责网站使用咨询、学习方向和长期规划，并可调用工具整理或生成学习地图；知识点教学由学习区承担。全局助手是平台固定智能体，个人角色库不包含它。

## 开发入口

| 仓库 | 本机固定目录 | 内容 |
| --- | --- | --- |
| MapFlow | D:/MapFlow-publish | 前端、MCP 接入资料和平台集成 |
| mapflow-server | D:/mapflow-server | Rust 后端、DSH Worker、知识检索与部署 |
| skill-tree-engine | D:/skill-tree-engine | 生成引擎与共享运行契约 |

固定目录保持最新整合 main。先读 [AGENTS.md](AGENTS.md)，运行 `python D:/MapFlow-publish/scripts/workspace_entry.py`，再在独立 codex/ 分支和 worktree 开发；优先复用空闲工作区。详见[工作区规则](docs/workflow/workspace-entry.md)。已有 Codex 会话及关联目录保留。

## 当前产品

- 全局助手：单一持续对话、轮换引导、平台知识检索，保留模型选择。
- 公共书库与我的地图：搜索筛选、关系布局、按块布局、私人进度与笔记。
- 学习聊天：按学习区隔离会话，默认展开画布并请求开启 AI 绘图。
- 独立酒馆：完整个人角色库直接选择，各角色会话独立且允许新建；画布默认收起。
- 账号、模型与额度：注册登录、模型配置、现金/积分/BYOK 通路和充值。
- 管理后台：用户与额度、请求观测、金额核对、模型目录验证和助手知识库。
- 暖纸浅色、石墨深色主题，桌面和手机共用界面组件。

可选模型以服务端当前目录为准。开放选择和默认模型分别设置，价格记录不代表可用性。BYOK 不扣本站现金，服务商仍按用户提供的凭据计费。

旧显式生成器和早期界面方案不是当前前端入口。旧接口是否继续兼容，以后端实现和现行合同为准。

## 代码与验证

src/app 管路由，src/pages 组织页面，src/domains 管业务状态和共享场景，src/api 管接口契约，src/ui 管公共组件。产品文件范围用 git ls-files 确认；ignored 的 SDK、下载包、私有配置和验收产物不属于产品源码。

在独立工作区运行：

```powershell
npm ci
npm test -- --maxWorkers=3 --minWorkers=1
npm run typecheck
npm run build
npm run workspace:test
```

项目没有独立的前端 lint 脚本。开发服务器默认把 /api 转发至 http://127.0.0.1:3000，需要其他地址时设置 MAPFLOW_API_TARGET。界面验收应覆盖桌面、手机、两套主题和真实交互。

## 文档与发布

- [文档目录](docs/README.md)
- [新会话交接](HANDOVER.md)
- [当前生产版本](docs/current-release.md)
- [生产与收款入口](docs/workflow/production.md)

本机 main 最新不表示已经部署。旧阿里云 CI 不是当前发布入口。原单人静态看板保存在 standalone-v0.1.0 标签，仅作历史版本，不在固定主目录切换到旧标签开发。

## 许可证

MIT。
