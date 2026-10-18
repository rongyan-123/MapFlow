# 当前生产发布

现场核对日期：2026-10-18。生产与本机 main 分开记录；修改本页需核对镜像 ID、前后端 revision 和宿主 OPERATIONS，不能从分支名或本地 dist 推断线上版本。

| 内容 | 生产冻结值 |
| --- | --- |
| 前端产品提交 | 71b1d8cc9cd8c016bb1ee4bef8f85db4bec7fa17 |
| 后端产品提交 | 03f181e4c340b88ae7f7ae46546c26b6d766d8b2 |
| Worker 提交 | 8a5c4054cd7e91d8c0c7443a43c8efabc61865e6 |
| 镜像 | mapflow-server:byok-financial-attention-20261018 |
| 镜像 ID | sha256:824aa5dd8a21a3cabd87e33d722de8693f178498b8b54c78c396f1317009549c |
| 数据库发布版本 | schema63 |
| 发布与验收 | [BYOK 资金提醒隔离](research/2026-10-18-byok-financial-attention-deployment.md) |

当时开放 47 个现金模型，默认 DeepSeek V4.1 Flash。当前数量以服务端目录为准；积分和 BYOK 的收费边界沿用原规则。

本次以后端 a8ec71f9 为基础，只加入 main 的 5e0c0f8 资金提醒修复；冻结于后端 release/byok-financial-attention-20261018 标签。BYOK 原始记录保留，但历史和新请求都不进入本站资金待核对队列。前端、Worker、资金配置及模型目录保持原版。切换前两次确认无活动会话，并锁定生成受理表直至空闲旧应用停止。

## main 新增，尚未部署

2026-10-18 仓库收尾整合后端学习画布增强：新学习会话事务内默认启用画布；默认教师和已有学习角色获得画布教学指导。前端默认展开并调用授权接口此前已经上线。

此前 BYOK 后端发布以原线上 8a5c405 为父提交，仅包含执行调度修复；与主线 fd00b5d 的 runner 完全相同。反馈发布继续沿用这一修复。学习画布增强仍待单独发布验收。

## 最近已发布内容

| 日期 | 内容 | 记录 |
| --- | --- | --- |
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
