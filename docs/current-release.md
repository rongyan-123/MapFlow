# 当前生产发布

现场切换时间：**2026-11-05 00:19:58（北京时间）**。已修复直接打开或刷新全局助手时，四用途模型设置缺少样式、出现原生灰色按钮的问题。现有折叠布局保留，样式由模型设置组件自己加载。此前旧关系布局修复和学习计划功能保留，新树生成及断线恢复开发分支未纳入本次发布。

| 内容 | 生产冻结值 |
| --- | --- |
| 前端产品提交 | 1d4bab436857280fe0e90b5259f2a74158f277a9，401静态文件 |
| 后端产品提交 | 9ce434b7b4f24c15f7617c622b07b8cdfd48cafa，本轮未变 |
| Worker源码提交 | 742c0e7c1fcad6b3af9c0d4803eca05ef30845c6，1516完整文件逐项未变 |
| 技能树引擎 | 00b97c01fff6fa4fa4b4832d37cea8853b0e5c49 |
| 当前镜像ID | sha256:890813b2b071ef36cfb9a74f1b67c977648552b9fc89129349319ed26c81eb92 |
| 上一完整镜像 | sha256:c9cc5ad6da9c961b5d5ea0b2f70c485a33eb5fb204e347f1146b1ca5299f0f1c |
| 数据库 | 原PostgreSQL与schema67保持，本轮无迁移/生产恢复覆盖 |
| 英语世界 | 继续关闭，业务接口404 |
| 详细记录 | [本轮模型设置修复](research/2026-11-05-model-settings-style-deployment.md)、[旧图布局修复](research/2026-10-30-map-legacy-layout-deployment.md)、[连线整合](research/2026-10-30-learning-plan-lines-deployment.md)、[学习计划首次发布](research/2026-10-30-learning-plan-deployment.md) |

## 修复与兼容范围

模型设置的 `.mf-scene-model-*` 样式原先依赖地图页面懒加载，直接打开助手没有加载该文件。现将现有样式迁到组件自己的 `ModelSettings.css` 并直接导入，同时移除地图样式里会覆盖它的旧规则；只改3个前端文件。四用途配置、资金通路、模型选择、参数和API均未修改。

普通图和按块图共用布局关系投影：先保留全部明确prerequisite，再按稳定顺序加入不会成环的旧requires方向；成环的旧线仍可见并保留待审阅信息，不用它强排层级。真正的前置环及下游保持异常区域，不通过支撑关系传播到正常节点。该投影仅供布局，可开始状态和计划仍只读取明确前置；节点、关系、ID、进度、学习位置和数据库没有改写。

未设置根数、列数或宽度上限。公开165节点样本首排38→6、最宽38→15；历史170节点副本首排40→9、最宽40→15。所有明确前置向下，只有原“部署→容器资源边界”的混合成环旧线不参与分层。这些数量是样本结果，不是产品限制，也不能推断当前所有私人地图的数量。

知识总览、每日计划、独占原生工具Worker、四用途模型、版本化策略、默认主连线、选中展开、圆角绕行、拖动隐藏/释放恢复、批量进度和通知均保留。旧图语义待审阅的提示仍在，显示排序改善不等于已人工确认全部关系语义。

## 验证与数据保留

本轮前端完整测试867通过、1项原有跳过，类型/构建和diff检查通过；纯样式修复使用实际浏览器旧版红、新版绿验证。候选本机44项检查通过；Linux实际新旧镜像、电脑/手机及亮暗主题共8组32项对照检查通过。隔离库125项既有接口、77项学习功能及8项发布保护测试通过。截图实际查看。旧图布局的历史测试和样本结果见其原发布记录，未当作本轮重跑。

维护窗复核无活动工作，最新备份独立还原134张表摘要一致，生产业务数据、原数据库身份、schema67及12条资金证据保持，未充值/核销/免单或主动扣费。公网36项HTTP、12资源哈希和44项浏览器检查通过。公网浏览器读取实际生产静态文件，但将全部API转发到隔离测试后端；没有生产测试登录、业务写入或付费模型调用，不代表正式用户账号端到端验收。后端历史Windows IPv6测试限制见首次学习计划发布记录，本轮未改后端。

## 运维与回退

当前app：683cf4c02a6782aa2bfed8fc18f82642d4cf34136bd39b85a74b3e4d7ad18a09；知识服务：6892d2eba815d6b97180f636bd39af20f1eae42a5feefa6929591919a07d3039，共享当前app网络。原PostgreSQL：d57bb0d28f216a4048849e182a90eafd61c25dae5da0352f186a4592f710b19a。后端/Node/Worker、知识镜像、挂载、环境、安全/资源/日志/重启策略及Caddy配置和隧道均保留。

上一完整容器对停止保留为 `mapflow-laptop-app-before-model-settings-css-20261104` / `mapflow-laptop-knowledge-before-model-settings-css-20261104`。当前恢复入口见宿主OPERATIONS首段及 `/opt/mapflow-laptop-migration-20261006/releases/20261104-model-settings-css/restore_previous_frontend.py`：要求身份、迁移校验、无活动和原资金证据一致，使用相同后端/Worker/schema67，只回退前端，保留数据库新数据。生产未执行回退，不使用更早发布的恢复脚本。

仍按先停知识服务、重启app并等readiness、再启知识服务的顺序操作。本轮专用验收容器、代理与隧道停止，源码、备份、镜像和证据保留；用户正在验收的本机新树预览及其他会话保持。

## 最近发布

| 日期 | 内容 | 记录 |
| --- | --- | --- |
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

隔离验收不等同正式用户的上线后端到端验收；公开页上线不承诺搜索收录或排名。后端Windows全套历史仍有1个既有IPv6分类失败，未改写为全绿。
