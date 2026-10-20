# 当前生产发布

现场核对日期：2026-10-21。01:09:27（北京时间）发布已验收的手机画布、酒馆与接入教程修复，英语世界继续关闭。生产与本机 main 分开记录；修改本页需核对镜像 ID、前后端 revision 和宿主 OPERATIONS，不能从分支名或本地 dist 推断线上版本。

| 内容 | 生产冻结值 |
| --- | --- |
| 前端产品提交 | 5f0a2bda98a6145c7ab8a01fa0f132a1a6bda8b0，397 个静态文件 |
| 后端产品提交 | 5258e3efab05bb635482233a3ebc0c7c1e15e4e0 |
| Worker 源码提交 | 与后端相同 |
| 当前宿主镜像 ID | sha256:e7c76e3858c7a75316ccc74c067aea06c68b23f1deb7359dce7ee6f9215a866d |
| 保留的兼容回退宿主镜像 ID | sha256:e183a49a72c86621afcaba37d43fd1d150c72af0ff2849b7a3c9bb85ba8e7623 |
| 数据库发布版本 | schema65，保留原 0063 校验和 |
| 英语世界开关 | MAPFLOW_ENGLISH_WORLD_ENABLED=false，业务接口 404 |
| 本轮发布 | [手机界面发布与 HTTP 待办](research/2026-10-21-mobile-ui-deployment.md) |

生产不再展示英语世界入口。用户实际遇到选词输出不完整、三次自动尝试均失败、页面始终 0% 且扣除 0.015033 积分，已据原记录核实；用户明确不需要补偿，只要求先停用。随机题材入口、进度／重试反馈和失败计费列为后续本地修改项，未经用户明确确认不得重新上线。

模型和默认值以服务端当前目录为准；现金、积分及 BYOK 的收费边界沿用原规则。真实现金／积分闭环在独立本地实例完成，正式运行文件逐项等价；本轮没有给生产账号赋测试额度或发起生产模型测试。

本轮停止服务前再次检查活动执行、旧生成任务、旧聊天锁、模型验证任务、待处理资金和待核账提醒，全部为 0；接受新任务的数据库表在停止前持锁，避免检查后又接入聊天。最新生产备份在独立数据库还原，128 张表摘要一致；正式实例保持原 PostgreSQL、schema65 和业务数据，未重跑迁移或覆盖生产数据库。两条原 stopped／cash／audit_only 提醒已由管理员在 2026-10-19 23:51（北京时间）核对，原注意事项键、未知上游证据和费用保持原样，本轮没有替管理员核对或改账。重启和兼容回退入口以宿主 OPERATIONS 首段为准。

公网 HTTPS 首页、学习／酒馆路由和 readiness 已通过；正式 HTML、主 CSS 和主 JS 与本地发布清单逐字节一致。HTTP 仍为 404：独立 HTTP 转发配置通过语法检查，但服务商拒绝未登记的隧道。新增服务已停止并禁用，原 SSH／HTTPS 配置摘要保持一致；需先在服务商后台登记，见 [HTTP 记录](deployment/2026-10-20-mobile-canvas-http.md)。

## 学习画布

新学习会话仍在后端事务内默认启用画布，教学角色获得画布指导。手机前端默认收起，手动打开时覆盖聊天区，可再次收起；保存失败在画布内提示并提供重试，保留未保存内容。连续点击和切换会话遵守最后一次操作，画布文字编辑不会再触发旧的 61px 高度规则。桌面布局及原画布工具沿用原规则。

## 最近已发布内容

| 日期 | 内容 | 记录 |
| --- | --- | --- |
| 2026-10-21 | 手机全屏画布、酒馆顶栏／角色库／历史、Skill/MCP 入口与教程导航；HTTP 转发待服务商登记 | [发布](research/2026-10-21-mobile-ui-deployment.md) |
| 2026-10-19 | 按用户要求撤下英语世界，旧界面／新核心／功能关闭，数据与原扣费记录保留 | [撤回](research/2026-10-19-english-world-deployment.md) |
| 2026-10-19 | 英语世界文本玩法、个人词库、FSRS 与学习画布后端增强 | [发布](research/2026-10-19-english-world-deployment.md) |
| 2026-10-18 | BYOK 历史与新请求退出本站资金核对队列 | [发布](research/2026-10-18-byok-financial-attention-deployment.md) |
| 2026-10-18 | 反馈历史、管理员回复与消息铃铛 | [发布](research/2026-10-18-feedback-notifications.md) |
| 2026-10-18 | BYOK 历史会话自动解锁与前端恢复编辑 | [发布](research/2026-10-18-byok-conversation-recovery-deployment.md) |
| 2026-10-17 | 多模型目录、参数合同和持久验证 | [发布](research/2026-10-17-model-catalog-deployment.md) |
| 2026-10-17 | 正常生成隐藏异常卡片 | [发布](research/2026-10-17-chat-error-visibility-deployment.md) |
| 2026-10-17 | BYOK 隔离与停止收尾 | [发布](research/2026-10-17-byok-recovery-deployment.md) |
| 2026-10-16 | 共享聊天核心 | [发布](research/2026-10-16-chat-scene-core-deployment.md) |
| 2026-10-16 | 管理员核账与学习角色库 | [发布](research/2026-10-16-admin-settlement-review-deployment.md) |
| 2026-10-16 | 会话、画布、主题动画和聊天交互 | [发布](research/2026-10-16-chat-interactions-deployment.md) |
| 2026-10-16 | 两套主题与亮色地图 | [发布](research/2026-10-16-material-themes-deployment.md) |
| 2026-10-15 | 全局客服与知识库 | [发布](research/2026-10-15-global-assistant-guidance-deployment.md) |
| 2026-10-15 | 平台助手角色边界 | [发布](research/2026-10-15-platform-assistant-deployment.md) |
| 2026-10-15 | 全站新前端 | [发布](research/2026-10-15-full-frontend-deployment.md) |

引用历史验收要保留真实 API、隔离恢复库、模拟界面和生产读检查的区别。回退不得用旧备份覆盖上线后的用户活动。
