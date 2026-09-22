# 酒馆 MVP：真实 UI 验收

日期：2026-09-22。状态：本次 MVP 验收通过；非正式部署。

## 环境与边界

- 前端功能基线 `59d7c9d`，后端功能基线 `332550c`（其后提交为文档）。
- 地址 `https://localhost:18444/tavern`；本机 Caddy 静态站点、SSH 隧道、隔离服务/数据库，实际调用 Qwen/Qwen3-8B。
- Browser Harness 连接用户授权的 Chrome，仅操作新建测试标签页。点击、输入、选择下拉框、文件上传、刷新、移动视口均通过浏览器 UI/CDP 完成；没有用 fetch 代替用户操作。
- 使用专用测试账号。账号密码、Cookie、CSRF、模型密钥不写入本报告。
- 官方固定提交 Seraphina PNG 的来源及 SHA-256 见实施记录；第三方卡片没有打包进产品。

## 验收结果

| 项目 | 实测结果 |
| --- | --- |
| 真实 PNG 导入 | 文件选择 → 预览 → 确认导入，新增角色和头像正常；4 条基础世界书、34 项兼容提示 |
| 不带 vocabulary | `UI ordinary` 创建成功；数据库 vocabulary 为 NULL；开场白不扣费，生成 1 轮后扣 357 micro-credit |
| 可选 vocabulary | `UI Rowan` 使用 24 个森林相关词；快照和数据库保留 24 项；五轮剧情对话完成 |
| 多轮记忆 | 第五轮准确回答第一轮包裹名 SILVER ACORN，以及 remains sealed |
| 生成中刷新 | 流式草稿未冒充已保存回复；刷新后提示待确认消息；点击“重试这条消息”后完成 |
| 幂等/结算 | 上述中断未写入 turn/用量，重试只保存一份；相同 clientTurnId 不重复扣费另有真实 API 重放与回归覆盖 |
| 完成后刷新 | 对话选择保留；刷新前后完整 log 文本逐字一致，无新增扣费 |
| 真实 TTL | 五轮完成于 08:13:46 UTC，08:21:34 UTC 续聊；空闲约 7 分 48 秒，恢复后包裹记忆准确 |
| UI 监控 | 管理面板 → 请求观测 → 高级筛选“酒馆”及请求 ID → 业务/Worker 节点，可读到成功、用量、首字延迟、回收/恢复计数 |
| 主题/移动端 | 约 1059px 桌面、390px 移动视口；深浅主题、会话详情抽屉正常，未观察到横向溢出 |

测试工具的 `fill_input` 丢弃换行，曾将 24 词连成一项，页面正确拦截超过 80 字符的词条。改用 CDP 的真实多行输入事件并读回 24 行后再创建会话；这不是产品绕过校验，也未为此修改产品代码。

## 可定位的证据

- UI 普通会话：`01a0c828-38d2-79b3-a902-be703f051e38`。
- UI 学习会话：`01a0c82a-8a2a-7593-8836-dbdcedd7d967`。
- 生成中刷新：`01a0c82b-e85d-7870-843e-6501eab6140e`，观测 `failed / tavern.runtime_unavailable`；SSE 已建立，HTTP 状态仍为 200，不能只看 HTTP 码判成功。
- 重试：`01a0c82c-8430-7450-97dd-281a06719ad3`，succeeded，589 micro-credit。
- 第五轮：`01a0c82d-88a5-7db0-8eea-e06aa423a046`，succeeded，631 micro-credit。
- TTL 后续聊：`01a0c834-b5ec-7f52-afd2-cc3144595706`，succeeded；input=2120、output=14、firstDeltaMs=774、总耗时 1354ms、643 micro-credit。
- UI 七个成功回合首字范围 565–2346ms，总耗时 1354–3713ms。此处使用明确的简短回答要求，不能抹去此前 API 验收最长 143 秒的延迟记录。

TTL 前后 Worker 累计快照：

| 指标 | 第五轮结束 | 空闲后续聊结束 |
| --- | ---: | ---: |
| ttlEvictions | 4 | 5 |
| historyRestores | 2 | 3 |
| historyRestoreFailures | 0 | 0 |
| sessions / pending | 1 / 0 | 1 / 0 |
| failedTurns | 1 | 1 |
| rssBytes | 101900288 | 102031360 |

failedTurns=1 对应上述刷新导致的中断；快照是整个 Worker 进程累计状态，不是单请求增量。RSS 为 Worker，而非整个服务容器。

最终只读数据库对账：

| 会话 | 词表项数 | 完成回合 | 用量流水 | 扣费 micro-credit |
| --- | ---: | ---: | ---: | ---: |
| API 普通 | 0 | 1 | 1 | 511 |
| API 学习及 TTL | 24 | 6 | 6 | 5836 |
| UI 普通 | 0 | 1 | 1 | 357 |
| UI 学习及 TTL | 24 | 6 | 6 | 3465 |
| 合计 | — | 14 | 14 | 10169 |

本次 UI 消耗 0.003822 积分，最终余额 1.989831。没有重复 `(conversation_id, client_turn_id)` 分组。

截图保存在产品仓库外的同级 `acceptance/`：

- `ui-live-05-import-preview.png`、`ui-live-10-optional-vocabulary.png`：导入和可选词表。
- `ui-live-14-refresh.png`、`ui-live-15-retry-after-refresh.png`、`ui-live-16-persisted-refresh.png`：中断、重试、持久化。
- `ui-live-18-learning-5-memory.png`、`ui-live-31-ttl-restored.png`：多轮与 TTL 记忆。
- `ui-live-19-mobile-dark.png`、`ui-live-20-mobile-light.png`、`ui-live-21-mobile-details.png`：主题与移动端。
- `ui-live-32-ttl-monitor-dark.png`、`ui-live-33-ttl-usage-dark.png`：实际管理观测。

## 最后回归与未扩大的范围

- 前端：默认全量 388 passed、真实卡片测试 opt-in 跳过；以 `TAVERN_CARD_FIXTURE` 指向上述 PNG 单独执行后 1 passed。build（含 typecheck）通过；仍有既有大 chunk 警告。
- Worker：78 passed，真实计时测试默认 opt-in 跳过；此前 361.5 秒独立运行与本次真实模型/UI TTL 均已验证。typecheck/build 通过。
- Rust：`cargo test --locked --all-targets --quiet` 全通过（544 项）；严格 all-targets/all-features clippy 和 fmt 检查通过。
- 本次收尾没有改业务代码；原工作区未提交修复保持原状。
- 只支持普通角色卡和基础世界书，不执行社区脚本/MVU/自定义 HTML 面板。未证明长期学习效果，未把短轮次上下文恢复等同于无限长期记忆。
- 既有管理观测页面浅色模式部分对比度较弱；共享 Worker 泳道仍写“进程内”，实际上 DSH 在同容器 Node 子进程。数字快照真实，但共享标签不能当成进程拓扑证据。本次未扩大修改既有管理界面。
- 隔离库没有公共树，学习控制台读取示例树得到 404；与本次酒馆链路无关。酒馆页面未观察到 JS 异常。
- 正式发布仍需按 `server/docs/tavern-ledger-migration.md` 排空旧版本计费写入、完成账本迁移后再切流；此次没有推送、合并或正式部署。
