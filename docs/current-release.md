# 当前生产发布

现场核对日期：2026-10-18。生产与本机 main 分开记录；修改本页需核对镜像 ID、前后端 revision 和宿主 OPERATIONS，不能从分支名或本地 dist 推断线上版本。

| 内容 | 生产冻结值 |
| --- | --- |
| 前端产品提交 | 56623a234c62f018e7008ea0356fc68cb513b124 |
| 后端及 Worker 提交 | 8a5c4054cd7e91d8c0c7443a43c8efabc61865e6 |
| 镜像 | mapflow-server:model-catalog-20261017-8a5c405 |
| 镜像 ID | sha256:c54dc5ebf5f227bf402b11a4b1767a2a6f4fabdd0ca19826f93a2ceb7bcb5639 |
| 数据库发布版本 | schema61 |
| 发布与验收 | [多模型目录发布](research/2026-10-17-model-catalog-deployment.md) |

当时开放 47 个现金模型，默认 DeepSeek V4.1 Flash。当前数量以服务端目录为准；积分和 BYOK 的收费边界沿用原规则。

## main 新增，尚未部署

2026-10-18 仓库收尾整合后端学习画布增强：新学习会话事务内默认启用画布；默认教师和已有学习角色获得画布教学指导。前端默认展开并调用授权接口此前已经上线。

本轮更新文档和整理本地资料，没有据此切换生产镜像。后续发布应选择明确的新后端 SHA，并验证执行恢复、画布权限和当前用户数据保留。

## 最近已发布内容

| 日期 | 内容 | 记录 |
| --- | --- | --- |
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
