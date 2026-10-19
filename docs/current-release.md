# 当前生产发布

现场核对日期：2026-10-19。英语世界已按用户要求停用，12:58:53（北京时间）恢复旧界面。生产与本机 main 分开记录；修改本页需核对镜像 ID、前后端 revision 和宿主 OPERATIONS，不能从分支名或本地 dist 推断线上版本。

| 内容 | 生产冻结值 |
| --- | --- |
| 前端产品提交 | 71b1d8cc9cd8c016bb1ee4bef8f85db4bec7fa17，原 395 文件界面 |
| 后端产品提交 | 5258e3efab05bb635482233a3ebc0c7c1e15e4e0 |
| Worker 源码提交 | 与后端相同 |
| 镜像 config ID | sha256:05304a70d34bdd9b3db0351d304b939f19145ca65c03fd4c973bb5e64c4b2732 |
| 宿主 OCI manifest ID | sha256:e183a49a72c86621afcaba37d43fd1d150c72af0ff2849b7a3c9bb85ba8e7623 |
| 数据库发布版本 | schema65，保留原 0063 校验和 |
| 英语世界开关 | MAPFLOW_ENGLISH_WORLD_ENABLED=false，业务接口 404 |
| 发布与撤回 | [英语世界实际记录](research/2026-10-19-english-world-deployment.md) |

生产不再展示英语世界入口。用户实际遇到选词输出不完整、三次自动尝试均失败、页面始终 0% 且扣除 0.015033 积分，已据原记录核实；用户明确不需要补偿，只要求先停用。随机题材入口、进度／重试反馈和失败计费列为后续本地修改项，未经用户明确确认不得重新上线。

模型和默认值以服务端当前目录为准；现金、积分及 BYOK 的收费边界沿用原规则。真实现金／积分闭环在独立本地实例完成，正式运行文件逐项等价；本轮没有给生产账号赋测试额度或发起生产模型测试。

此次停用前再次完整备份并在隔离库恢复，128 张表摘要一致；生产保留当前 schema65，未重跑迁移或覆盖数据库。旧业务、原调用和资金记录保留，两条原 stopped／cash／audit_only 未知调用提醒仍可见。当前运行新核心与旧界面的兼容组合；不重启旧 `824aa5dd…` 核心，不以旧备份覆盖新用户活动。旧界面资金页不支持英语世界中性执行，必要时使用新核心认证管理员核账接口。重启入口以宿主 OPERATIONS 首段为准。

## 学习画布

学习画布增强已随本次新核心部署：新学习会话事务内默认启用画布，教学角色获得画布指导。隔离副本通过真实登录／CSRF 创建及重放会话，核对 enabled=true、空元素、revision=0 和冻结教学提示，未调用模型。前端默认展开并调用授权接口此前已经上线。

## 最近已发布内容

| 日期 | 内容 | 记录 |
| --- | --- | --- |
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
