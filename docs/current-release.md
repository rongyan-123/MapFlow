# 当前生产发布

已于 **2026-11-18 20:46:32（北京时间）** 部署双账号AnyAI供应池到 https://xxian.fun 。原全站工作区改版、新版地图、同草稿续作保持；用户自带Key和积分渠道保持。

| 内容 | 生产冻结值 |
| --- | --- |
| 前端产品提交 | c8def6dcb0357ebf31b58f28d8241c7a5e02d71f，400静态文件 |
| 后端产品提交 | cab14ac32469ef1d92e1f7504fa5f15eefadb728 |
| Worker源码树 | b642feb8ec8a70ce7cd8a53a2c80f2235ac2988c |
| 技能树引擎 | 79074367545714efc3cb3a62bce8bb7dd97ce552 |
| 当前镜像 | sha256:0a0a46e7b2280af4541ebb58070bba12ccf8c9b8378a97eb549992364247ad60 |
| 数据库 | 原PostgreSQL/schema68，无新增迁移或旧备份覆盖 |
| 完整记录 | [部署、验证与恢复限制](research/2026-11-18-upstream-pool-deployment.md) |

正式管理员页面已验证2个可用账号、余额合计$2.818046 USD（查询时刻值，会随使用变化）。两个供应账号真实调用成功，隔离副本正式聊天链路使用新增账号且只结算一次；47个可选现金模型配置均覆盖。

前端919通过/1跳过，Worker239通过/1跳过。后端1267通过、10项既有Windows知识服务失败、13忽略；严格Clippy仍有108项既有诊断，非全绿。电脑/手机生产页面及42项公网HTTP检查通过，12份资源哈希一致。

本机真实站及样板间保留，原5项在途编辑未发布。前后端main已同步；文档提交可以晚于冻结产品SHA。

恢复入口为服务器 `OPERATIONS.md` 首段及 `releases/20261118-upstream-pool/recover.py`。一旦存在账号池绑定执行，不得直接降级旧程序；任何回退都不覆盖实时数据库。

## 最近发布

| 日期 | 内容 | 记录 |
| --- | --- | --- |
| 2026-11-18 | 双账号上游供应池、真实调用与管理员余额合计 | [发布](research/2026-11-18-upstream-pool-deployment.md) |
| 2026-11-18 | 全站工作区、浮动卡片、新版地图与同草稿续作 | [发布](research/2026-11-18-workspace-deployment.md) |
| 2026-11-05 | 修复助手冷启动时模型设置样式缺失 | [发布](research/2026-11-05-model-settings-style-deployment.md) |
| 2026-10-30 | 修复旧关系被忽略导致的超长首排及顶部提示遮挡 | [发布](research/2026-10-30-map-legacy-layout-deployment.md) |
| 2026-10-30 | 学习计划版整合默认主连线、分散出口与就近绕行 | [发布](research/2026-10-30-learning-plan-lines-deployment.md) |
| 2026-10-30 | 知识总览、持久学习位置、AI学习计划与四用途模型设置 | [发布](research/2026-10-30-learning-plan-deployment.md) |
| 2026-10-30 | 仅拖动画布期间隐藏连线，结束可靠恢复 | [发布](research/2026-10-30-map-pan-hide-deployment.md) |
| 2026-10-29 | 图谱测量缓存、交互及视口外流光暂停 | [发布](research/2026-10-29-map-drag-performance-deployment.md) |
| 2026-10-29 | 一次提交全部点亮/撤销、可核对取消与整批回滚 | [发布](research/2026-10-29-map-bulk-progress-deployment.md) |
| 2026-10-29 | 图谱/学习界面、公开阅读与教程、聊天和手机稳定性整合 | [发布](research/2026-10-29-map-visual-deployment.md) |
| 2026-10-21 | 消息与公告全部已读、单条操作稳定 | [发布](research/2026-10-21-notification-read-actions-deployment.md) |
| 2026-10-21 | 待核对用户名 | [发布](research/2026-10-21-settlement-account-name-deployment.md) |
| 2026-10-21 | 手机界面、画布、HTTP→HTTPS | [发布](research/2026-10-21-mobile-ui-deployment.md) |
| 2026-10-19 | 英语世界撤下，保留数据及原费用依据 | [发布](research/2026-10-19-english-world-deployment.md) |
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

隔离验收不等同正式用户的上线后端到端验收；公开页上线不承诺搜索收录或排名。本轮后端测试限制见上述摘要与详细发布记录。
