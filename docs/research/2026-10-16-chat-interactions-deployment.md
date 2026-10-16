# 智能体会话、画布与聊天交互前端发布

2026-10-16，用户授权「部署过去吧，把之前的前端修复」。已发布至 <https://xxian.fun/learning>，维护提示已解除。

本次包含酒馆全部私人角色直接选择、各智能体独立会话与草稿、学习区默认展开画布和允许绘图、酒馆画布默认关闭、主题聚光收拢动效，以及常驻历史栏开关、生成中显示用户问题、输入框模型按钮直达模型配置。桌面和手机使用同一冻结构建。

## 发布身份

| 内容 | 冻结值 |
| --- | --- |
| 前端产品提交 | `9d7a3d599462ff0f67f73e09e1ca6d17efaee500` |
| 应用镜像 | `mapflow-server:chat-interactions-20261016-9d7a3d5` |
| 应用 image ID | `sha256:b2af8b2f1794ba11ac8c51a79549d90d8e738b5b5ecbb3b01e567513eb5672ec` |
| 前一版应用 image ID | `sha256:8bfd98b0afdaab7889efe162717eb544337fd37ffa7ec2c714f0e496009be3a2` |
| 保留的线上后端提交 | `900798a38bf6f5493fd3f97cf9985f9ac91f25df` |
| 保留的知识服务 image ID | `sha256:db3ebab1e2673d69176ac4c7c1a1b39d0dc29c8091c7cc594412b9e246fd3ffd` |
| 396 文件归档 SHA-256 | `bc6b414f907d66bcb5f8b561b289b8af6f013702328d96e9d4278a5a2001b573` |
| 冻结发布工具 SHA-256 | `78cf1aa3897ff78331764c2e38cbbd5623df4605e70805646bc4d09da38e68a0` |
| 实际前端入口 | `/assets/index-D4JUoUWu.js`、`/assets/index-i5D-3BwL.css` |

本次发布前端。后端二进制、Node、Harness 等 17 个运行文件逐项保持原哈希，数据库 schema57 和所有迁移记录不变，计费配置不变。前端通过既有画布权限接口实现进入学习区默认允许绘图；后端候选 `e3fe9f2` 的新会话默认值及教学提示词增强没有随本次发布，保留在原功能分支。

## 构建、切换与验证

- 产品完整测试 599 项通过、1 项既有跳过；类型检查与生产构建通过，使用同一份已实际验收的 `dist`。逻辑和桌面/手机交互证据见[酒馆会话](2026-10-16-tavern-agent-conversations-acceptance.md)、[画布与主题](2026-10-16-learning-canvas-theme-transition-acceptance.md)、[聊天交互](2026-10-16-learning-chat-interactions-acceptance.md)。
- 复用上一轮发布器和保护模块，只更新版本、路径、前序镜像绑定及运维说明。部署保护测试 36 项通过，冻结工具语法检查通过；新镜像文件集合与清单完全相等，旧前端静态文件已从新镜像移除，后端父镜像层保留。
- 发布前拒绝活动或可恢复执行；维护中停止旧应用与知识服务，取得 28,924,529 字节的一致性冷备份。4 条原有无执行者、费用待核对的持久化记录逐项保持身份、状态和完整行摘要。
- PostgreSQL 容器保留，88 张表集合和迁移记录不变。除单独验证的请求观测日志外，所有表记录数量与完整行摘要一致。观测日志按既有容量策略清理 50 条，原 20,000 条保留行逐条核验，检查期间新增 5 条；未清空日志，也未导入验收账户或地图。
- 原应用的环境变量、挂载、运行用户、资源限制、安全设置、网络/IP/别名和重启策略核对一致，仅替换前端版本标签。知识服务用原镜像、原模型重建并绑定新应用容器，健康、模型身份及实际推理 smoke 通过。
- 应用内 14 个页面均返回冻结的同一入口；5 个未登录私有接口返回 401。公网页面和健康检查通过，实际浏览器确认新 JS/CSS 入口。
- Browser Harness 检查首页与登录页，两套主题、320/390/1024/1440px，共 16 张截图并查看，无页面或主要容器横向溢出。首次禁用浏览器缓存的页面加载超过脚本原 8 秒等待，随后确认页面正常，使用正常缓存和 30 秒加载等待完成全部检查；没有修改产品逻辑或测试断言。
- 生产验收浏览器没有正式账号登录态，学习入口正确要求登录；未创建生产测试账号，未发起收费模型请求。登录后的聊天、模型配置、历史栏、智能体切换和画布交互使用上述同构建本地验收记录；手机尺寸模拟不等同于真机键盘验收。

## 回退与留存

远端私有目录：`/opt/mapflow-laptop-migration-20261006/releases/20261016-chat-interactions/`。冻结包：`/home/rong/.local/state/mapflow/chat-interactions-20261016/`，归 root 管理；私有配置、备份及数据库证据不进入 Git。

回退入口：`sudo python3 /home/rong/.local/state/mapflow/chat-interactions-20261016/chat_release.py rollback`，恢复保留的 `mapflow-laptop-app-before-chat-interactions-20261016` 与 `mapflow-laptop-knowledge-before-chat-interactions-20261016`。保留当前数据库及发布后的用户记录，不用历史备份覆盖后续活动。本次切换未触发回退。

服务器 `OPERATIONS.md` 已更新；全部 Codex 会话、工作区路径和私有收款资料保留。本机日志、冻结清单、线上结果和截图在 `D:/tmp/mapflow-chat-ui-deployment-20261016/`。发布工具留存于 [冻结脚本](../deployment/scripts/2026-10-16-chat-interactions-release.py)，服务器包内命名为 `chat_release.py`，保护模块继续使用 `material_theme_release_checks.py` 的冻结内容；该工具依赖服务器留存的既有运维模块，不能作为独立通用发布器运行。
