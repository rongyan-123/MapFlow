# 当前生产发布

已于 **2026-11-18 17:19:02（北京时间）** 部署全站工作区改版到 https://xxian.fun 。首页/学习入口、笔记与计划、分用途模型设置、浮动卡片与宽布局接入正式业务；同时上线已整合main的新版地图/学习组和同草稿断线续作。旧图保留版本1，英语世界继续关闭。

| 内容 | 生产冻结值 |
| --- | --- |
| 前端产品提交 | 533d1f5b14ba624117384576fb13c5e5c0e36778，400静态文件 |
| 后端产品提交 | 9ef72b70b639dc0407bba6304b69e030b8c06bde |
| Worker源码提交 | 6255e126cc249316ef2dc25fbf9d98dec9d8ae27 |
| 技能树引擎 | 79074367545714efc3cb3a62bce8bb7dd97ce552 |
| 当前镜像 | sha256:9b8e1759cf0428425830f4eed14b00ecf986aa8d2fb62d99a5224722e3fa9002 |
| 数据库 | 原PostgreSQL保留，仅schema67→68，无生产备份恢复覆盖 |
| 完整记录 | [本轮部署、验证与恢复限制](research/2026-11-18-workspace-deployment.md) |

前端917通过/1跳过、Worker234通过/1跳过、引擎46通过，类型/构建通过。后端1265通过、10项与既有基线相同的知识服务失败、13忽略，非全绿。隔离接口与电脑/手机检查通过；公网42项HTTP及20组浏览器检查通过。公网浏览器使用真实生产静态文件和隔离API，不代表生产用户付费模型端到端验收。

本机样板间保留在 http://127.0.0.1:19387/ 。本机5项原有在途编辑单独保留，未发布。三个仓库main已同步；文档提交可以晚于表中冻结产品SHA。

当前恢复入口以服务器 `OPERATIONS.md` 首段及 `releases/20261118-workspace/recover_final.py` 为准；新增v2地图/v3草稿后禁止直接降级旧程序，不恢复旧备份覆盖实时数据库。

## 最近发布

| 日期 | 内容 | 记录 |
| --- | --- | --- |
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
