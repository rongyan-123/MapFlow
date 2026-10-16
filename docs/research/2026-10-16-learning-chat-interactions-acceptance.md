# 学习聊天交互验收

范围见 [设计](../specs/2026-10-16-learning-chat-interactions-design.md)。本轮只修改前端，在上一轮画布和主题候选版本上继续开发；未部署。

## 完成行为

- 历史开关常驻顶部，桌面明确标示展开/收起。收起同时移除历史栏和宽度分隔条，保留当前画布实例与输入草稿。手机只渲染历史抽屉，恢复焦点到开关。
- 回复请求从发送中到流式生成、完成与历史刷新均显示用户问题。用请求 ID 和保存的消息 ID 去重；同样的问题再次发送仍是新消息。刷新可恢复当前浏览器保存的请求；网络不确定时标明状态，返回编辑撤回临时气泡。没有更改数据库历史或分支结构。
- 学习、酒馆输入框模型按钮直达“模型接入”；普通配置仍进入原首页。全局助手专用模型界面保持。

## 自动验证

- 新增真实 `SceneWorkspace` + HTTP/SSE 边界回归 12 项。修改前 9 项失败、3 项保护用例通过；修改后 12 项通过。
- 针对性回归 31 项通过。覆盖收起不卸载画布、保留草稿、手机抽屉、两场景模型直达、生成中显示、历史送达/丢失、原请求恢复、不确定发送、重复文字及重新生成/继续不虚构新问题。
- 最终完整测试：85 个文件通过、1 个原有跳过；599 项通过、1 项原有跳过。命令 `npm test -- --maxWorkers=4 --minWorkers=2 --reporter=dot`。
- 首次默认并发全量运行有 1 项登录深链等待超时；该文件独立运行 8 项通过，降低工作线程后完整套件通过。没有放宽断言或测试超时。
- `npm run build`（包含 `tsc --noEmit`）通过。项目没有 lint 脚本。保留已有大 chunk 构建提示。

## 实际浏览器

本地预览 `http://127.0.0.1:18225`，正常用户账号，真实 Chrome + Browser Harness。检查 1440×960、1024×900、768×900、390×844、320×720，长学习区名称及真实画布展开，无页面横向溢出、控件遮挡或新增列；窄屏历史入口触控区域至少 44px。

- [桌面收起历史](D:/tmp/mapflow-chat-interactions-20261016/desktop-1440-history-collapsed.png)
- [模型直达](D:/tmp/mapflow-chat-interactions-20261016/desktop-model-selection-direct.png)
- [手机布局](D:/tmp/mapflow-chat-interactions-20261016/learning-layout-390.png)
- [手机历史抽屉](D:/tmp/mapflow-chat-interactions-20261016/history-drawer-320.png)
- [桌面生成中问题](D:/tmp/mapflow-chat-interactions-20261016/desktop-pending-question-simulated-stream.png)
- [手机深色生成中问题](D:/tmp/mapflow-chat-interactions-20261016/mobile-pending-question-dark-simulated-stream.png)

生成中的最后两张截图在隔离验收标签页中模拟执行 HTTP/SSE 外部边界，其余组件和交互均真实；没有执行收费模型请求、没有伪造已保存消息。已恢复网络边界与原浏览器恢复记录。正常历史页面也确认存在用户消息。

日志、尺寸记录与可重跑脚本：`D:/tmp/mapflow-chat-interactions-20261016/`。
