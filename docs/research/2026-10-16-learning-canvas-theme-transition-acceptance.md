# 学习画布与主题切换验收

2026-10-16。按[设计](../specs/2026-10-16-learning-canvas-theme-transition-design.md)完成，前端分支 `codex/learning-canvas-theme-transition-20261016`，承接已提交的独立酒馆智能体改进 `e22e357`；后端分支 `codex/learning-canvas-defaults-20261016`，基线 `main 4dba638`。本轮未合入 main、未部署。

## 行为

- 进入可用学习会话默认展开画布，并通过原有修订号接口开启 AI 绘图；新学习会话在创建事务内初始化 `enabled=true` 的空画布。只读历史不写入，清空历史后不隐式创建聊天。
- 用户在本次访问中收起或取消授权后保持选择；再次进入恢复学习默认。授权保存期间暂停发送；初始读取晚到也不重新打开用户刚收起的画布。
- 酒馆默认收起，包括以前已授权的画布；手动打开和绘图授权继续可用。全局助手定位与界面不受本轮修改影响。
- 新默认教学角色包含画布教学建议。已有学习角色不改写卡片或历史，通过当前执行的冻结提示加入相同建议：优先用图讲结构、流程、对比和例题，结合运行时提供的画布 skill，先 `read_canvas` 再 `apply_canvas_patch`，保留用户笔迹，未授权时不假装完成绘图。执行接管恢复使用原冻结提示。
- 桌面同时显示画布与聊天；窄屏上下分区，320px 工具栏不再落下孤立按钮。手机编辑消息时暂收绘图编辑器、保留工具栏；离开输入恢复画布，避免虚拟键盘下工具条覆盖聊天。
- 主题使用旧页面快照从覆盖视口的圆形范围收缩至点击控件中心，下层是新主题；两个方向均为 600ms。按钮和设置页选择器均有自己的圆心。连续切换取消旧动画，完成后释放动画对象；跨标签页同步和初始化不播放整屏动画。减少动态效果时直接切换，旧浏览器使用短颜色过渡。实现依据 [MDN View Transition 文档](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using)。

## 自动验证

- `LearningCanvasDefaults.test.tsx` 新增 6 个用户交互回归；实际 `SceneWorkspace`、画布 UI、客户端与持久化逻辑均参与，仅替换第三方 Excalidraw 引擎并在 HTTP 边界模拟服务端。
- `themeMotion.test.tsx` 新增 7 个回归：触发点与旧快照收缩、快速选择、快速切换、减少动态效果、跨标签页竞态、原生 API 失败、结束清理。关键新增逻辑均先复现失败再实现。
- 最终 `npm test -- --maxWorkers=3 --minWorkers=1`：84 个文件通过、1 个原有文件跳过；587 项通过、1 项跳过。`npm run build` 通过，包含 TypeScript 检查；仍有既有大资源分块提示。项目无前端 lint 脚本。
- 后端运行全部 132 个测试目标，最初 1066 通过、12 失败、10 跳过。启动本地真实 ONNX 知识库依赖后，对 4 个相关目标重跑 12 项全部通过；10 个依赖失败已消除。剩余 2 个失败分别为 Windows IPv6 网络错误分类和不可读日志路径，两项均在未修改的 `D:/mapflow-server main 4dba638` 上单独重现。按唯一测试合并结果为 1076 通过、2 个既有平台差异失败、10 跳过，不宣称后端全绿。
- 后端本轮相关测试均通过，包括默认教学角色和默认画布的 HTTP 验证、旧角色教学指导、冻结提示恢复以及酒馆不注入学习指导。`cargo fmt --all -- --check` 通过；按仓库配置运行 `cargo clippy --all-targets` 通过并保留已有警告。额外严格 `-D warnings` 在本轮和未修改 main 上均为 33 个告警失败，按文件和检查内容对照无新增项目；既有超长函数的行数差异在比较时规范化。
- 前后端 diff 自审及 `git diff --check` 通过；固定入口检查确认两个 main 均保持最新、没有未保存的产品改动。

## 本地实际验收

使用隔离普通账号、真实本地 API、PostgreSQL 与 ONNX worker；不请求付费模型，不访问生产写接口。预览 `http://127.0.0.1:18225` 已换为本轮后端的独立可执行文件快照，保留原验收账号和数据库。

- 实际从另一张已有私人地图创建学习区，新教学角色提示包含两个画布工具名，画布初始 `enabled=true`、修订号 0、元素为空；已有学习区也默认展开并授权。
- 实际授权酒馆画布后离开再进入，仍默认收起；手动打开保留授权。学习、酒馆各自画布与会话不混用。
- Chrome 检查 320/390/768/1024/1440px：画布、聊天和输入框均可见，无横向溢出。模拟手机键盘将视口缩至 390×480px，输入框仍在可见范围；这是视口模拟，未使用实体手机。
- 检查浅色与深色学习画布、桌面双向主题切换、手机抽屉按钮、设置页原生键盘选择及减少动态效果。主题中间帧验收使用 DevTools 慢速播放并暂停浏览器的实际动画取证；正常产品时长仍为 600ms。动画结束后没有残留快照动画。

证据目录 `D:/tmp/mapflow-learning-canvas-theme-20261016/`：`frontend-full-tests.log`、`frontend-build.log`、`backend-full-tests.log`、`backend-knowledge-retry.log`、两份 `baseline-windows-*.log`、Clippy 对照日志与 `check-summary.json`；`new-learning-real-api.json`、`canvas-layout-review.json`、`keyboard-and-return-review.json`、`theme-motion-review.json`、`final-browser-review.json`。截图包含 `final-learning-canvas-mobile.png`、`learning-canvas-1440.png`、`learning-canvas-dark-mobile.png`、`learning-keyboard-emulated.png`、`theme-dark-to-light-mid.png`、`theme-phone-drawer-mid.png`、`theme-settings-mid.png`。
