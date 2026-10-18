# 当前生产发布

现场核对日期：2026-10-19。英语世界文本版已上线。生产与本机 main 分开记录；修改本页需核对镜像 ID、前后端 revision 和宿主 OPERATIONS，不能从分支名或本地 dist 推断线上版本。

| 内容 | 生产冻结值 |
| --- | --- |
| 前端产品提交 | c72962dae882e337ff0d52e9e4880b5510468c13 |
| 后端产品提交 | 5258e3efab05bb635482233a3ebc0c7c1e15e4e0 |
| Worker 源码提交 | 与后端相同 |
| 镜像 config ID | sha256:cf96646ee4197030eba803235956ecf24c4a8e03a382752c151916c7d6962954 |
| 宿主 OCI manifest ID | sha256:0ac8c0aff855df6a4e04ae427bf4c72668bcc16c66513444faa7ff7e79526bf5 |
| 数据库发布版本 | schema65，保留原 0063 校验和 |
| 英语世界开关 | MAPFLOW_ENGLISH_WORLD_ENABLED=true |
| 发布与验收 | [英语世界发布记录](research/2026-10-19-english-world-deployment.md) |

独立入口为 [英语世界](https://xxian.fun/english-world)。文本版支持剧本生成、英文行动、一句一词翻译、死亡复盘、分支回档、个人词库和 FSRS 阅读／拼写复习。首批为 60 个原创义项、59 个词形；语音和大规模外部词库导入留待后续。

模型和默认值以服务端当前目录为准；现金、积分及 BYOK 的收费边界沿用原规则。真实现金／积分闭环在独立本地实例完成，正式运行文件逐项等价；本轮没有给生产账号赋测试额度或发起生产模型测试。

迁移前完整备份并独立恢复核对；随后从当前 schema65 再做最新备份，正式接续没有重跑迁移。旧业务、原调用和资金记录保留，两条原 stopped／cash／audit_only 未知调用提醒仍可见。schema65 只使用本次新核心兼容回退组合，不重启旧 `824aa5dd…` 核心，不以旧备份覆盖新用户活动。重启入口以宿主 OPERATIONS 首段为准。

## 学习画布

学习画布增强已随本次新核心部署：新学习会话事务内默认启用画布，教学角色获得画布指导。隔离副本通过真实登录／CSRF 创建及重放会话，核对 enabled=true、空元素、revision=0 和冻结教学提示，未调用模型。前端默认展开并调用授权接口此前已经上线。

## 最近已发布内容

| 日期 | 内容 | 记录 |
| --- | --- | --- |
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
