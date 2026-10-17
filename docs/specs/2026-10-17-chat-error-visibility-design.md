# 聊天异常卡片只在需要处理时显示

用户已确认：正常生成不显示截图中的“原请求状态”卡片，实际报错时才出现。影响全局助手的提示呈现和共享执行控制的原因分类，保留普通生成进度、输入框停止按钮、真实异常恢复入口以及后台原始核账记录。

正常 queued/running/recovering/ready_to_commit 和成功状态不展示原请求卡片；普通主动停止且无错误也不展示。failed、awaiting_reconciliation、明确操作错误或其他旧执行确实阻塞当前发送时保留处理入口。恢复用控制查询不能把正常在途 dispatched 调用判成 external_outcome_unknown；正常状态返回 none，异常结束后才依据持久化事实分类。共享提示组件也不将正常在途状态解释为上游异常。

沿用已确认的测试边界，按 TDD 完成：

1. 真实助手页面验证正常发送与停止时没有异常卡片，已有失败/等待恢复仍可处理；先红后绿。
2. 执行控制 HTTP 接口验证 cash/points/byok 正常在途状态 reason=none，旧响应字段、真正未知结果和鉴权规则保持；先红后绿。
3. 完整前后端测试、类型/格式/静态检查与构建，自审 diff；实际浏览器核对桌面和手机的正常/异常界面并截图。修改在独立分支，固定 main 在合入后验收。本轮不改生产历史数据，部署另按用户指令执行。

## 验证记录（2026-10-17）

- TDD：改实现前，页面和共享组件的正常状态用例按预期报红；执行控制 HTTP 用例在 `cash/queued` 返回 `external_outcome_unknown`，按预期报红。修改后相关前端 20 项及 HTTP 7 项全部通过，保留缺 Key、真实未知调用及跨设备发送冲突的恢复流程。
- 前端完整测试：670 通过、1 跳过；类型检查与生产构建通过，构建保留既有大资源包提示。后端格式检查与全目标 Clippy 通过，保留既有告警，未对无关代码扩展修改。
- 后端完整回归：134 个目标，1091 通过、0 失败、10 忽略、2 过滤。沿用此前已确认的 Windows 环境基线排除项 `chat_transport_distinguishes_dns_and_unreachable_network_from_connection_refusal` 和 `unreadable_journal_does_not_prevent_replaying_evidence_already_in_database`，过滤项未计为通过。后端实现提交为 `c6080cd86ed5bdd7aa8ca5d4d3d6e94d531906fc`。
- 浏览器验收：使用实际构建和真实本地登录，拦截执行状态构造正常与失败场景；320/390/1024/1440px、浅色与深色均无横向溢出。正常状态无原请求卡片、保留停止按钮，失败状态显示核对提示。没有调用真实模型或更改生产数据。
- 本机证据：`D:/tmp/mapflow-running-warning-audit-20261017/`，包括红绿测试、完整测试、构建与静态检查日志，以及 `browser-acceptance.json` 和 6 张界面截图。

用户确认后已于 2026-10-17 发布，固定版本、生产副本验证与回退方式见 [发布记录](../research/2026-10-17-chat-error-visibility-deployment.md)。
