# 当前生产发布

现场切换时间：**2026-10-30 02:30:32（北京时间）**。已发布知识总览、持久学习位置、AI学习计划、管理员计划策略及四用途模型设置。发布前重新 fetch 并兼容最新 main，保留此前地图拖动隐藏连线、批量进度、通知、公开阅读与聊天修复。产品冻结提交与后续发布文档提交分别记录。

| 内容 | 生产冻结值 |
| --- | --- |
| 前端产品提交 | 410098682d5cc9c42a2dd11096449a922e3f66c1，400静态文件 |
| 后端产品提交 | 9ce434b7b4f24c15f7617c622b07b8cdfd48cafa |
| Worker源码提交 | 742c0e7c1fcad6b3af9c0d4803eca05ef30845c6；15个编译JS更新，Node和Linux依赖保持 |
| 技能树引擎 | 00b97c01fff6fa4fa4b4832d37cea8853b0e5c49 |
| 当前镜像ID | sha256:1c7d6788dbcb2a059d9266561f5b76e76194032ce898477194354fa3d907c9e1 |
| 上一完整镜像 | sha256:bcddf75253dbd1c5f47408259e9e2cf25c3af09db41982abcf0656e0dedce5e9 |
| 数据库 | 原PostgreSQL；迁移66/67后schema67，未恢复覆盖生产 |
| 英语世界 | 前后端继续关闭，业务接口404 |
| 详细记录 | [本轮学习计划发布](research/2026-10-30-learning-plan-deployment.md) |

## 新功能与兼容范围

地图详情与学习区共用完整知识总览，展示真实节点、说明、进度和知识块问题/学习链/补充说明。旧图缺少元数据时明确显示缺失，不虚构内容。浏览节点不移动当前学习位置；只有显式设置或开始学习才持久保存，地图金色箭头与“学到这里”同步。

学习计划必须填截止日期，可选开始日期与每日分钟数。整个剩余学习范围参与规划，已完成节点跳过，部分完成节点保留，长节点可按同一ID分日。每次任务使用独立DSH进程与固定Skill/原生工具schema，只有服务端校验通过的submit_study_plan才能保存；普通文本JSON不能冒充提交。生成失败、取消或版本冲突保留旧计划；全部完成时不调用模型。现金、积分与BYOK沿用原准入、用量证据和幂等结算。

全局助手、学习聊天、酒馆聊天、学习计划分别保存模型设置，旧配置仅迁移缺失用途；凭据只保存在当前页面/执行所需的受限内存。计划入口返回模型设置后保留日期草稿。管理员策略有草稿CAS、不可变发布版本及回滚，新任务冻结当时版本。

布局采用明确前置关系；不再人为添加根节点或限制层宽。知识关联与补充关系不约束学习顺序，循环、缺失引用与旧语义不明关系会提示。旧地图需要确认关系语义后才能用于计划，发布没有批量改写用户关系数据。新地图生成/读取支持v2知识块元数据，并兼容旧草稿。

此前main的实际拖动画布隐藏连线、松开恢复、测量缓存、流光暂停、批量完成/撤销与取消、通知操作和公开页面保持。`codex/map-primary-connections-20261030` 的两项未合入连线改动仍保留在原分支，本次未纳入。

## 验证与业务保留

实施阶段：前端849通过/1跳过，类型/构建通过；Worker223通过/1跳过，类型/构建通过。后端153组1245通过/12忽略/1过滤；过滤的既有Windows IPv6错误分类测试单独复现失败，源码未修改，不宣称全套全绿。Clippy退出0但有警告。原实施浏览器48项及五种宽度/双主题证据保留。

本轮Linux发布：Rust1.88离线构建成功；13项迁移/资金/回退保护单测通过。生产数据库隔离副本完成45项通知、53项地图、27项批量进度和77项新功能HTTP检查；实际发布镜像的DSH SDK完成5项原生工具检查。独立后台Chrome访问真实Linux API，29项检查、五种宽度双主题通过，截图目视核对，无未捕获异常。旧完整镜像在schema67副本上启动，5项旧接口可用，新学习位置、偏好与策略数据保留。

切换时持准入/结算表锁复核无活动工作；新鲜备份独立还原后128张表完整摘要一致。迁移与切换保持原业务列和原65条迁移记录；原数据库身份未变。11条既有停止现金审计与1笔5072积分余额不足待入账按原证据保留，没有充值、免单、核销或主动扣费。恢复流量后可能产生新记录，切换快照不是永久当前数量。

公网35项HTTP检查与11个资源哈希通过；真实公开图165节点的拖动隐藏/释放恢复通过，无浏览器异常。未创建生产测试登录或修改正式进度；没有付费真实模型端到端质量验收。

## 运维与回退

当前app：c3006c7d4603506268bf0c0656d25324cde29b160c83f218fb43c752d133218d。知识服务：5e329fea077ca88d25f276e88e5bd2c22493f9a9e114b6abeb3b8a1ebadd878e，共享当前app网络。原PostgreSQL：d57bb0d28f216a4048849e182a90eafd61c25dae5da0352f186a4592f710b19a。

旧完整对停止保留为 `mapflow-laptop-app-before-learning-plan-20261030` / `mapflow-laptop-knowledge-before-learning-plan-20261030`。恢复入口见宿主OPERATIONS首段及 `/opt/mapflow-laptop-migration-20261006/releases/20261030-learning-plan/recover.py`。回退保留现库及新数据，不恢复旧dump；要求运行身份、schema校验、原资金证据、无活动工作且study_plan_tasks为0。一旦已有新计划任务，脚本拒绝旧镜像自动回退，需重新评估兼容的前进修复，不得删除任务绕过保护。生产未执行回退。

重启仍先停知识服务、重启app并等readiness、再启动知识服务。原资源、安全、密钥挂载、日志及重启策略保持；Caddy管理API关闭，单文件挂载inode与HTTP/HTTPS/SSH隧道保持。旧发布脚本不是本轮直接恢复入口。

## 最近发布

| 日期 | 内容 | 记录 |
| --- | --- | --- |
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

隔离验收不等同正式用户的上线后端到端验收；公开页上线不承诺搜索收录或排名。后端Windows全套历史仍有1个既有IPv6分类失败，未改写为全绿。
