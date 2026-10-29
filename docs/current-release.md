# 当前生产发布

现场切换时间：**2026-10-29 14:08:44（北京时间）**。图谱与学习界面改进已随此前 main 中的公开阅读、教程及聊天稳定性更新发布。正式运行身份已逐项核对；源码 main 与产品冻结提交分别记录。

| 内容 | 生产冻结值 |
| --- | --- |
| 前端产品提交 | 10744b09e946b639a4f2429d9f7872814eed8866，400静态文件 |
| 后端产品提交 | 907f1f0ae7cc11feba65b259774365e2f0e94ad3 |
| Worker源码提交 | 5258e3efab05bb635482233a3ebc0c7c1e15e4e0，1516文件及Node未改 |
| 技能树引擎 | 00b97c01fff6fa4fa4b4832d37cea8853b0e5c49 |
| 当前镜像ID | sha256:3d9f7beb86ea708cd199852bfc6f0234c2f0e71e4def700771b24987275adb88 |
| 直接回退镜像ID | sha256:dbebe357210d318680f33dcb13ad103a7680eb77ceb0de1a0204910e4f84f4d9 |
| 数据库 | 原PostgreSQL和schema65，无迁移、无生产恢复覆盖 |
| 英语世界 | 前后端继续关闭，业务接口404 |
| 详细记录 | [本轮发布](research/2026-10-29-map-visual-deployment.md) |

## 图谱与学习界面

历史收起入口并入历史标题区，收起历史后恢复地图偏好宽度。首次进入学习区只显示聊天，地图与画布默认收起；显式选择按账号、学习区或会话范围记住。

个人图谱未完成节点统一灰色，已完成节点按稳定分支着色。前置未满足时显示锁标识，仍可查看与提前学习。连线使用直角路径，减少动态效果时关闭流光并立即切换状态。

“全部点亮”直接执行，无二次确认；保存成功后柔和过渡，可撤销恢复原35%和0%，保留点亮前已完成节点。失败在当前节点停止，保留部分成功及恢复入口。撤销依赖当前浏览器的本地日志，不是后端原子批次或跨设备事务。

学习地图/私人地图工具并入原最顶端页头，状态与错误只显示一份且可关闭。节点详情正文独立滚动，完成按钮常驻，手机与短横屏可直接操作。

## 公开阅读与此前 main 更新

首页、/explore、/roadmaps/{treeId}、/guides及教程正文由服务端输出可直接阅读的HTML；robots.txt和sitemap.xml只包含公开入口。私人或下架地图不返回公开正文。公开书库正常跟踪参数不再返回400，原账号/归属/CSRF检查保持。

返回会话保留思考/工具过程、手机输入失焦稳定、学习区导航与宽度修复一同发布。完整发布范围为前端相对原生产63文件、后端9文件；未改变收费、模型传输、Worker、锁文件或迁移。

## 验证与业务保留

前端任务分支与合并后main各自819通过/1原有跳过，类型检查及构建通过；400文件与原浏览器验收版本一致。Linux Rust1.88.0离线锁定依赖构建成功。

隔离生产副本完成53项地图真实HTTP检查、45项通知回归，以及真实浏览器点亮/撤销/35%恢复、SQL故障恢复、首次聊天偏好和三种视口双主题详情操作。浏览器未伪造成功响应，无运行异常，不写正式学习进度、不创建生产测试登录、不调用付费模型。

切换持准入/结算表锁复核，活动执行、生成、验证、旧锁和预留为0。9条既有现金审计与1笔终态余额不足的积分待入账按原证据保留，没有充值、免单、核销或主动扣费。仅自然核对时间戳允许变化，其余金额、用量与账务字段均比较。恢复流量后可产生新记录，不将切换时快照当作永久当前数量。

新鲜备份独立还原，128张表完整摘要一致。原数据库及schema65原位保留，没有用旧dump覆盖生产。公网29项验证和9个资源哈希匹配通过，HTTP保路径/参数的308继续有效。

## 运维与回退

当前app：9eb46791d63f633e7be5cc915809cb2c39de5400468f6db3f4fc88c18e1e5090。知识服务：6b6493420f1e361664cca55c2a2dd0f835b02e3bd64633ed36363d83be3c0c3c，共享当前app网络。原PostgreSQL：d57bb0d28f216a4048849e182a90eafd61c25dae5da0352f186a4592f710b19a。

旧整对停止保留为 `mapflow-laptop-app-before-map-visual-20261029` / `mapflow-laptop-knowledge-before-map-visual-20261029`。当前恢复入口见宿主OPERATIONS首段及 `/opt/mapflow-laptop-migration-20261006/releases/20261029-map-visual/recover.py`，保护运行身份、schema、资金证据和无活动工作，保留现库及新用户数据。脚本已语法/规则核对，成功发布后未执行回退。旧10月21日恢复脚本不是本次直接回退入口。

重启仍先停知识服务、重启当前app并等readiness、再启动知识服务。原资源、安全、密钥挂载、日志及重启策略保持；Caddy管理API关闭，单文件挂载inode和HTTP/HTTPS/SSH隧道保持。后续有新活动或资金证据时，先重新复核，不盲跑过期脚本。

## 最近发布

| 日期 | 内容 | 记录 |
| --- | --- | --- |
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

隔离验收不等同正式用户的上线后端到端验收；公开页上线不承诺搜索收录或排名。后端Windows全套历史仍有1个既有IPv6分类失败，未改写为全绿。
