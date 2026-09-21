# 按块布局关联连线

用户已确认实现并直接部署服务器，跳过 CI，最终通过 browser-harness 截图验收。

- 仅块布局采用新连线；节点选中时显示直接前置、后置连接。
- 青色表示前置流入，紫色表示后置流出。实线托底、柔光、沿 source → target 流动的短光段和末端箭头。
- 同排连线从卡片下方绕行；跨排使用曲线，同列也有弧度；跨越中间卡片时沿空隙绕行。
- 选中节点、关联端点强化提示。尊重 reduced-motion，静态时仍能看清方向。
- 先测试关联筛选、方向与路径避障，再实现；完整测试、typecheck、build、自审后部署。
- 复用线上后端镜像替换前端产物，保留回滚容器；核验 HTTPS 与健康状态。
- 工作区已有 NodeDetailPanel 变更不属于本任务，不纳入本次部署。

## 实施与验收记录

- 前端提交：`bb3aaad0e799eba7b3ac20ab1ce9a9a4dd965013`。
- 独立发布目录全量测试：39 文件、329 测试通过；当前工作区含既有改动的 330 测试通过。类型检查、生产构建及 diff 检查通过。
- 直接 SSH 到服务器，以当前后端镜像为基础仅增加前端层，没有触发 CI。
- 线上镜像：`mapflow-server:block-flow-bb3aaad`。
- 保留回滚容器：`mapflow-app-rollback-block-flow-20260921T171303Z`。
- 发布记录：服务器 `/opt/mapflow/releases/block-flow-bb3aaad/deployment-receipt.json`。
- HTTPS 首页与健康接口均为 200；首页 no-store；加载 `index-C2WgO7Es.js` 与 `index-0sNQ9Crj.css`；容器 running、0 次重启、只读文件系统。
- browser-harness 使用现有 Chrome，已逐张查看截图。浏览器登录的是验收账号，因此仅在当前标签页临时替换两个只读 GET 响应，载入通过 MapFlow MCP 获取的真实树快照（161 节点、14 分组）；未写入学习数据。验收后移除了该临时替换及 sessionStorage 数据并刷新页面。
- 事务节点 16 条关联线、关系数据建模节点 9 条关联线显示正确；选择切换保留视口；节点拖动后曲线端点跟随；关系布局恢复 420 条原连线。
- 实际 SVG 路径采样检查事务节点的 16 条连线没有穿过其他卡片；流光偏移随时间递减，沿 source → target 移动；reduced-motion 时关闭流光但保留实线与箭头。
- 截图：`D:/tmp/mapflow-flow-production-final.png`、`D:/tmp/mapflow-flow-production-second-node.png`、`D:/tmp/mapflow-flow-production-drag.png`。
