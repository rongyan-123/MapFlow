# 当前生产发布

现场核对日期：2026-10-21。17:29:48（北京时间）发布管理员待核对记录的用户名展示；同日已发布的手机界面及 HTTP→HTTPS 跳转继续保留。英语世界继续关闭。生产与本机 main 分开记录；修改本页需核对镜像 ID、前后端 revision 和宿主 OPERATIONS，不能从分支名或本地 dist 推断线上版本。

本机本轮完成消息中心／公告页“全部已读”、单条已读控件稳定位置、连续点击去重和两个入口状态同步，先完成本地验收，尚未部署。新界面需与新增已读接口一起发布；下面生产冻结值不因本机 main 更新而改变，范围见[设计](specs/2026-10-21-notification-read-actions-design.md)。

| 内容 | 生产冻结值 |
| --- | --- |
| 前端产品提交 | d47f84da19f79aee569e820766749fe35e6f11ae，397 个静态文件 |
| 后端产品提交 | c2dfc1d1ae0032006695fac90de924a2ea27130d |
| Worker 源码提交 | 5258e3efab05bb635482233a3ebc0c7c1e15e4e0，本轮未修改 |
| 当前宿主镜像 ID | sha256:981445a09a139deed955e6ee46f07ab12e71c26380b18e6e6a67e0f30d53fa48 |
| 直接回退宿主镜像 ID | sha256:e7c76e3858c7a75316ccc74c067aea06c68b23f1deb7359dce7ee6f9215a866d |
| 数据库发布版本 | schema65，保留原 0063 校验和 |
| 英语世界开关 | MAPFLOW_ENGLISH_WORLD_ENABLED=false，业务接口 404 |
| 本轮发布 | [待核对记录用户名与 Git 整理](research/2026-10-21-settlement-account-name-deployment.md) |

生产不再展示英语世界入口。用户实际遇到选词输出不完整、三次自动尝试均失败、页面始终 0% 且扣除 0.015033 积分，已据原记录核实；用户明确不需要补偿，只要求先停用。随机题材入口、进度／重试反馈和失败计费列为后续本地修改项，未经用户明确确认不得重新上线。

模型和默认值以服务端当前目录为准；现金、积分及 BYOK 的收费边界沿用原规则。本轮仅增加管理员记录中的用户名，不修改计费、停止或核账逻辑，没有给生产账号赋测试额度或发起模型调用。真实现金／积分闭环的历史验证见前次发布记录。

本轮停止服务前再次检查活动执行、旧生成任务、旧聊天锁、模型验证任务和待处理资金，全部为 0；接受新任务的数据库表在停止前持锁，避免检查后又接入聊天。另有 4 条已停止的现金 audit_only 提醒，完整冻结并保留原证据；它们不是运行中的会话，本轮没有替管理员核对或改账。最新生产备份在独立数据库还原，128 张表摘要一致；正式实例保持原 PostgreSQL、schema65 和业务数据，未重跑迁移或覆盖生产数据库。重启和直接回退入口以宿主 OPERATIONS 首段为准。

公网 HTTPS 首页、助手／学习／酒馆路由和 readiness 已通过；正式 HTML、主 CSS／JS 和管理员资源与发布清单逐字节一致。管理员真实接口在独立生产副本内验证了 4 个正确用户名、旧响应兼容和普通用户 403；正式公网只做未登录读检查，没有创建生产测试会话。

HTTP 隧道继续使用平台原始名称，接入本地 18090。本轮 Windows 无代理复查 GET／HEAD、深路径及编码参数均返回保留原地址的 308，HTTPS 为 200；没有修改原 SSH／HTTPS／HTTP 隧道。该服务此前已验证 active／enabled、Linger=yes，见 [HTTP 记录](deployment/2026-10-20-mobile-canvas-http.md)。

## 学习画布

新学习会话仍在后端事务内默认启用画布，教学角色获得画布指导。手机前端默认收起，手动打开时覆盖聊天区，可再次收起；保存失败在画布内提示并提供重试，保留未保存内容。连续点击和切换会话遵守最后一次操作，画布文字编辑不会再触发旧的 61px 高度规则。桌面布局及原画布工具沿用原规则。

## 最近已发布内容

| 日期 | 内容 | 记录 |
| --- | --- | --- |
| 2026-10-21 | 管理员待核对列表和详情显示用户名；旧客户端兼容，保留原核账证据；清理 9 个已完成本地分支 | [发布与整理](research/2026-10-21-settlement-account-name-deployment.md) |
| 2026-10-21 | 手机全屏画布、酒馆顶栏／角色库／历史、Skill/MCP 入口与教程导航；HTTP→HTTPS 跳转已接通 | [发布](research/2026-10-21-mobile-ui-deployment.md) |
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
