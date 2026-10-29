# 当前生产发布

现场切换时间：**2026-10-29 17:11:40（北京时间）**。地图全部点亮与撤销已改为各一次请求、一次事务和全图同时渐变；慢网取消由后端核对结果。此前图谱、公开阅读、教程及聊天稳定性更新保留。正式运行身份已逐项核对，文档main与产品冻结提交分别记录。

| 内容 | 生产冻结值 |
| --- | --- |
| 前端产品提交 | 7ea5ce3dd4185ff10682b7697006660aadb80b5d，400静态文件 |
| 后端产品提交 | dd8d1cc6976b4622e37e342b3699ca2c9e1b3a5b |
| Worker源码提交 | 5258e3efab05bb635482233a3ebc0c7c1e15e4e0，1516文件及Node未改 |
| 技能树引擎 | 00b97c01fff6fa4fa4b4832d37cea8853b0e5c49 |
| 当前镜像ID | sha256:06b42ad34a9179712cf6bc829c815b8abf56736055aa69b9f91d22a624d1998d |
| 直接回退镜像ID | sha256:3d9f7beb86ea708cd199852bfc6f0234c2f0e71e4def700771b24987275adb88 |
| 数据库 | 原PostgreSQL和schema65，无迁移、无生产恢复覆盖 |
| 英语世界 | 前后端继续关闭，业务接口404 |
| 详细记录 | [本轮批量发布](research/2026-10-29-map-bulk-progress-deployment.md) |

## 图谱与学习界面

历史收起入口并入历史标题区，收起历史后恢复地图偏好宽度。首次进入学习区只显示聊天，地图与画布默认收起；显式选择按账号、学习区或会话范围记住。

个人图谱未完成节点统一灰色，已完成节点按稳定分支着色。前置未满足时显示锁标识，仍可查看与提前学习。连线使用直角路径，减少动态效果时关闭流光并立即切换状态。

“全部点亮”与撤销各使用一次请求和一个数据库事务，全图同时渐变，无二次确认。失败整批不改，保留原35%和0%、原完成节点及后来手改的进度。撤销日志仍在当前浏览器，兼容旧版记录，不提供跨设备撤销管理。

慢网可点“取消等待”：取消先到会阻止迟到保存，保存已完成则明确可撤销。核对失败保留记录与重试入口，不把浏览器取消等同数据库回滚。操作标识和预期进度保护重放与并发；单节点接口继续兼容。

学习地图/私人地图工具并入原最顶端页头，状态与错误只显示一份且可关闭。节点详情正文独立滚动，完成按钮常驻，手机与短横屏可直接操作。

## 公开阅读与此前 main 更新

首页、/explore、/roadmaps/{treeId}、/guides及教程正文由服务端输出可直接阅读的HTML；robots.txt和sitemap.xml只包含公开入口。私人或下架地图不返回公开正文。公开书库正常跟踪参数不再返回400，原账号/归属/CSRF检查保持。

返回会话保留思考/工具过程、手机输入失焦稳定、学习区导航与宽度修复一同发布。14:08的整合范围为前端63文件、后端9文件；本次功能提交相对准备时main为前端12文件、后端9文件，历史发布文档另计。均未改变收费、模型传输、Worker、锁文件或迁移。

## 验证与业务保留

本次前端完整824通过/1原有跳过，类型检查与构建通过；同一产品提交快进合入main，400文件与本地受验清单一致。Linux Rust1.88.0离线锁定依赖构建4分02秒成功。后端完整149组为1226通过/1既有Windows IPv6分类失败/11忽略，fmt/check/clippy/doc检查退出0且保留告警，未声称重新执行Linux全套单元测试。

隔离生产副本完成27项新批量HTTP、53项旧地图HTTP、45项通知回归。Linux真实浏览器验证27节点一次点亮/撤销、原35%恢复、取消先到和保存先完成、刷新持久化、三种视口双主题详情及手机取消；SQL故障整批回滚另经真实接口验证。本地74节点样本已有对应验证。集合有重叠，不合计为覆盖率；未伪造成功响应，运行异常0，不写正式学习进度、不创建生产测试登录、不调用付费模型。

切换持准入/结算表锁复核，活动执行、生成、验证、旧锁和预留为0。11条既有现金审计与1笔终态余额不足的积分待入账按原证据保留，没有充值、免单、核销或主动扣费。仅自然核对时间戳允许变化，其余金额、用量与账务字段均比较。恢复流量后可产生新记录，不将切换时快照当作永久当前数量。

新鲜备份独立还原，128张表完整摘要一致。原数据库及schema65原位保留，没有用旧dump覆盖生产。公网31项验证和9个资源哈希匹配通过，HTTP保路径/参数的308继续有效。

## 运维与回退

当前app：2a5c13cb80f62206b2eb7c3600efffb1d7d12aa22e00c04af5e6b6eaecbfab21。知识服务：e2738a66f7ad5c1100142673e89ca122792cea709165441b67b95efcbcaed426，共享当前app网络。原PostgreSQL：d57bb0d28f216a4048849e182a90eafd61c25dae5da0352f186a4592f710b19a。

旧整对停止保留为 `mapflow-laptop-app-before-map-bulk-atomic-20261029` / `mapflow-laptop-knowledge-before-map-bulk-atomic-20261029`。当前恢复入口见宿主OPERATIONS首段及 `/opt/mapflow-laptop-migration-20261006/releases/20261029-map-bulk-atomic/recover.py`，保护运行身份、schema、资金证据和无活动工作，保留现库及新用户数据。脚本已语法/规则核对，成功发布后未执行回退。历史发布的恢复脚本不是本次直接回退入口。

重启仍先停知识服务、重启当前app并等readiness、再启动知识服务。原资源、安全、密钥挂载、日志及重启策略保持；Caddy管理API关闭，单文件挂载inode和HTTP/HTTPS/SSH隧道保持。后续有新活动或资金证据时，先重新复核，不盲跑过期脚本。

## 最近发布

| 日期 | 内容 | 记录 |
| --- | --- | --- |
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

隔离验收不等同正式用户的上线后端到端验收；公开页上线不承诺搜索收录或排名。后端Windows全套历史仍有1个既有IPv6分类失败，未改写为全绿。
