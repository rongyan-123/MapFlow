# 当前生产发布

现场切换时间：**2026-10-30 09:09:02（北京时间）**。已在知识总览、学习计划和四用途模型版本上，加入用户确认的默认主连线、分散出口和就近绕行。重新核对最新main与现网后，正常合并并推送前端main；本轮只替换前端静态文件，后端、Worker和schema67不变。产品冻结提交与后续文档提交分别记录。

| 内容 | 生产冻结值 |
| --- | --- |
| 前端产品提交 | e944026de9c4fafb5c39c88859121f61469ba582，400静态文件 |
| 后端产品提交 | 9ce434b7b4f24c15f7617c622b07b8cdfd48cafa，本轮未变 |
| Worker源码提交 | 742c0e7c1fcad6b3af9c0d4803eca05ef30845c6，1516个文件逐项一致 |
| 技能树引擎 | 00b97c01fff6fa4fa4b4832d37cea8853b0e5c49 |
| 当前镜像ID | sha256:dd7f948fefe44863eab55d72d054b55cd766e7ccceb1eb953ec63c3d8c3e901f |
| 上一完整镜像 | sha256:1c7d6788dbcb2a059d9266561f5b76e76194032ce898477194354fa3d907c9e1 |
| 数据库 | 原PostgreSQL、schema67及迁移校验均不变，本轮无迁移/恢复覆盖 |
| 英语世界 | 前后端继续关闭，业务接口404 |
| 详细记录 | [本轮连线整合](research/2026-10-30-learning-plan-lines-deployment.md)、[学习计划实施与首次发布](research/2026-10-30-learning-plan-deployment.md) |

## 功能与兼容范围

默认每个目标节点显示距离最近的前置主连线；没有前置关系时用最近关联线补充。选中节点再展开全部直接关系，已有主线路径保持稳定。连线从分散端口出发、就近绕过无关节点并使用小圆角；节点布局、位置、进度与学习前置语义保持。按块排序仍只展示选中节点的直接关系，真实拖动隐藏连线、释放恢复。

完整知识总览、持久学习位置、整图剩余范围每日计划、独立原生工具Worker、版本化管理员策略与四用途模型设置继续保留。浏览节点不推进学习位置；计划失败/取消/版本冲突保留旧计划，全部完成不调用模型。旧图关系语义不明时仍提示确认，没有批量改写用户地图。新图v2知识块元数据、现金/积分/BYOK准入结算、批量进度与通知功能沿用此前发布行为。

## 验证与数据保留

本轮布局与连线集成回归先红后绿；前端115测试文件861通过、1文件/1测试原有跳过，类型/构建及diff检查通过。Linux隔离副本完成45项通知、53项地图、27项批量进度及77项学习新功能HTTP检查。后台Chrome完成29项学习检查（五宽/双主题）与20项连线检查，截图实际查看。与原生产镜像比较，165节点位置和进度相同，426条关系默认显示160条，两个选中样本分别166/162条；路由采样未穿过无关卡片。

切换持准入表锁并确认无活动任务；最新备份独立恢复134表完整摘要一致。生产数据库身份、schema67、业务数据及12条原资金关注记录保持，包括原5072积分余额不足待入账；未充值、核销、免单或主动扣费。切换快照不代表恢复流量后的永久记录数量。

上线后公网35项HTTP检查、11个精确资源哈希通过；真实公开地图19项后台浏览器检查通过，默认主线、选中展开、绕障、拖动恢复、按块与明暗/窄屏均复测。未创建正式测试登录、修改正式进度或调用付费模型。后端与Worker本轮没有代码改动，原测试结果和已知Windows IPv6测试限制保留在首次发布记录中。

## 运维与回退

当前app：eb6955254fd5ea0c56892e04647361cccff47fae6d8a90d04632f36431881166。知识服务：aef59dfcd7ee22cd3493cf0f560a5b84b6233f06809081dd87ba3e195e2dbba2，共享当前app网络。原PostgreSQL：d57bb0d28f216a4048849e182a90eafd61c25dae5da0352f186a4592f710b19a。后端/管理程序/Node/Worker、知识镜像和资源/安全/挂载/日志/重启策略均逐项核对不变。

上一完整容器对停止保留为 `mapflow-laptop-app-before-learning-plan-lines-20261030` / `mapflow-laptop-knowledge-before-learning-plan-lines-20261030`。当前恢复入口为宿主OPERATIONS首段及 `/opt/mapflow-laptop-migration-20261006/releases/20261030-learning-plan-lines/recover.py`。回退目标具有相同后端、Worker和schema67，只回退前端；要求当前身份、迁移校验、无活动工作与原资金证据一致，保留数据库及用户新数据，不恢复旧dump。本轮未执行生产回退。首次学习计划发布之前的旧镜像恢复脚本不是本轮入口。

重启顺序仍为先停知识服务、重启app并等readiness、再启动知识服务。Caddy管理API关闭、单文件挂载inode及HTTP/HTTPS/SSH隧道保留。隔离验收容器与本任务本机代理/隧道停止；其他会话的分支、工作区和62417预览保留。

## 最近发布

| 日期 | 内容 | 记录 |
| --- | --- | --- |
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

隔离验收不等同正式用户的上线后端到端验收；公开页上线不承诺搜索收录或排名。后端Windows全套历史仍有1个既有IPv6分类失败，未改写为全绿。
