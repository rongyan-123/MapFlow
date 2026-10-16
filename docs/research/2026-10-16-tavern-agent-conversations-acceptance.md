# 独立酒馆智能体切换验收

2026-10-16。在 `main f018a4fc15babeef3a83c42e0dff06d318ee7c85` 上复用开发工作区，分支 `codex/tavern-agent-conversations-20261016`。行为以[已确认设计](../specs/2026-10-16-tavern-agent-conversations-design.md)为准。

## 交付行为

- 桌面侧栏和手机顶栏直接列出完整私人角色库；创建或导入后直接可选，不需要回角色库再点一次“使用角色”。同名角色按 ID 区分，平台固定助手不出现在此列表。
- 选择角色打开它上次选择的会话；没有保存选择时打开它已有的最近会话，没有任何会话时才创建第一条。兼容旧版本已保存的会话选择，不会因它不是最新一条而丢失位置。
- “开始新对话”属于当前智能体；尚未选择智能体时先打开角色库。角色切换复用独立会话接口，不向另一个角色的原会话发送换角色请求，不复制其他角色的消息、Persona、词表或画布。
- 默认历史只显示当前智能体，保留“查看全部会话”访问既有历史及已移除角色的快照。草稿在本次酒馆页面访问内按会话保存。
- 首次会话创建期间锁定旧输入框和重复创建；错误保留原会话并展示于角色库内，可以明确重试。手机历史抽屉补齐内边距，去除重复标题，切换成功后关闭抽屉。

## 自动验证

- `src/pages/TavernAgentNavigation.test.tsx` 新增 17 个组件交互回归，使用实际 `SceneWorkspace` 和请求客户端，仅在 HTTP 边界模拟服务端。按失败测试、实现、通过测试推进；包括首次会话创建失败、连续选择、创建/导入、独立历史、草稿、场景隔离、已删除角色快照及旧选择兼容。
- 最后一次定向运行：`npm test -- src/pages/TavernAgentNavigation.test.tsx src/pages/SceneWorkspace.test.tsx --maxWorkers=2 --minWorkers=1`，26 项通过。
- 最后一次完整运行：`npm test -- --maxWorkers=4 --minWorkers=1`，82 个文件通过、1 个原有文件跳过；574 项通过、1 项跳过。
- `npm run build` 通过，包含 `tsc --noEmit`。项目无 lint 脚本；构建仍提示已有较大资源分块，本轮没有更改依赖或分块配置。
- `git diff --check` 通过。固定入口检查通过：前端 `main f018a4fc15ba`、后端 `main 4dba6380d881`，均不落后实际远端 main。

## 实际界面与接口验证

用 Browser Harness 操作专用 Chrome，在 `http://127.0.0.1:18225/tavern` 上验证生产构建，连接隔离本地真实 API 和已有验收数据库。账号为专用普通用户；本次不访问生产数据、不发起模型生成。

- 通过真实界面创建三个私人角色，包含超长中文名称；角色立即出现在下拉列表，列表 ID 集合与角色库 API 返回完全一致。
- A/B 智能体各自具有不同会话 ID，没有角色切换记录；已有消息仅属于自身角色。输入不同草稿、往返切换，准确恢复各自草稿和会话。
- 为 B 新建第二条会话，确认 ID 改变、消息为空白开场、草稿为空；切换 A 后返回 B，恢复刚创建的 B 会话。
- 手机顶栏直接切换、历史抽屉切换及关闭均验证通过。实际检查 320、390、768、1024、1440px，浅色与深色主题、超长名称；未发现横向溢出、遮挡或可见错误。可见角色选择控件均至少 44px 高。最终截图已人工查看；这是 Chrome 视口模拟，未使用实体手机。
- 进入全局助手确认没有酒馆角色选择器、没有 A/B 消息；返回酒馆仍保留先前会话。

本地证据目录：`D:/tmp/mapflow-tavern-agent-conversations-20261016/`。`interaction-acceptance.json` 保存实际交互结果，`final-browser-smoke.json` 保存最终构建复核；截图包括 `final-tavern-desktop.png`、`final-tavern-mobile.png`、`final-tavern-mobile-history.png`、`final-tavern-long-name-320.png`、`final-tavern-long-name-1024.png` 及深色主题截图。测试和构建输出为 `full-tests.log`、`targeted-tests.log`、`build.log`。

本轮没有迁移或改写旧聊天，也没有更改后端、计费或生产部署。历史上已经混用角色的旧会话保留原样；新切换流程使用各自独立的会话。
