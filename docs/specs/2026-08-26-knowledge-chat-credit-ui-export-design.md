# MapFlow 知识聊天、积分与学习树工具设计

日期：2026-08-26  
范围：本地 `main` 分支；用户验收通过前不推送、不部署

## 1. 目标

本次实现覆盖以下用户可见能力：

1. 同一账号访问同一棵个人技能树时，知识聊天保留完整历史；刷新、重新登录和聊天面板重新打开后仍可读取。
2. 平台托管模型的聊天消耗正式积分，按实际 Token 动态计算并显示小数；BYOK 生成链路不进入平台聊天账本。
3. 退出登录必须经过确认。
4. 左侧个人树库和右侧节点详情可以分别收起/展开，默认展开，并记住当前浏览器的选择。
5. 提供深色、浅色、米色和蓝灰主题，主题选择持久化，所有主要文字和控件保持可读。
6. 当前个人技能树可以直接导出为 JSON 或 Markdown；导出内容只包含树数据和学习进度，不调用 AI，也不包含账号、平台或密钥信息。

## 2. 当前实现边界

现有 DSH `SessionStore` 只在 worker 进程内保存会话；它能保证同一 worker 中的连续对话上下文，但不会自动把会话写入 MapFlow 的 PostgreSQL。现有聊天服务使用独立的 `SandboxCreditMeter`，正式 `credit_ledger` 仍只支持整积分生成扣费。

因此本次采用两层会话模型：

- PostgreSQL 保存可展示、可恢复的完整对话记录，是跨刷新/重新登录/worker 重启的持久化来源。
- DSH 继续负责运行时上下文和工具调用。同一账号 + `library_entry_id` 使用稳定 session key；首次创建 worker 会话时，把数据库里的已完成用户/助手消息恢复为 DSH 的 seed，而不是在 Rust 中另写一个 Agent 记忆系统或把历史拼成普通系统提示词。

聊天重置是明确的破坏性操作：确认后同时清除该账号/个人树条目的持久化聊天记录和 DSH 会话。除重置外不自动清理历史。

## 3. 持久化聊天数据

新增 `knowledge_chat_turns` 表，核心字段如下：

- `account_id`：账号归属。
- `library_entry_id`：个人树条目归属。
- `client_turn_id`：客户端幂等键，前端生成 UUID。
- `user_message`、`assistant_message`：已完成的一轮对话文本。
- 输入/输出/缓存命中/缓存未命中 Token 数。
- 实际扣除的微积分单位。
- `created_at`：历史顺序依据。

唯一键为 `(account_id, library_entry_id, client_turn_id)`，查询历史按 `created_at, client_turn_id` 排序。查询和删除前均先做当前账号对 `library_entry_id` 的授权校验，不能通过错误差异泄露其他账号的记录。

HTTP 接口：

```text
GET  /api/me/tree-library/{library_entry_id}/knowledge-chat/history
POST /api/me/tree-library/{library_entry_id}/knowledge-chat/messages
POST /api/me/tree-library/{library_entry_id}/knowledge-chat/messages/stream
POST /api/me/tree-library/{library_entry_id}/knowledge-chat/reset
```

历史接口只返回 `{ id, role, content }` 消息，不返回账号字段、system prompt、工具参数、搜索原始响应或密钥。重试相同 `client_turn_id` 直接返回已保存的回答和原扣费结果。

## 4. 正式积分模型

继续复用已有 Token 计费目录和 `CREDIT_UNITS_PER_CREDIT = 1_000_000`，但把正式积分账本的权威金额改为 PostgreSQL `BIGINT` 微积分单位：

- 迁移时把既有整积分 `amount`、`balance_after` 乘以 1,000,000，历史余额数值不变。
- 所有签到和技能树生成扣费都改用微积分单位计算，生成价格保持原来的整积分语义。
- 增加聊天扣费的账务关联和幂等约束，聊天扣费使用独立的 `chat_spend` 类型，不复用 `generation_session_id`。
- 只有模型成功返回非空回答后才提交实际 Token 费用；模型、搜索、权限、超时、取消、流断开和空回答均不扣费。
- 正式账本扣费采用事务锁定账号、检查当前余额、检查幂等记录、插入扣费流水的顺序，避免同一 turn 重复扣费。
- 正式积分接口仍保持现有字段兼容，但 `balance` 返回小数；前端按最多 6 位小数显示，不再四舍五入成整数。
- 聊天成功后由前端主动刷新 `['me', accountId, 'credit']` 查询，并以服务端结果为准。

BYOK 生成路径不改：BYOK 仍使用用户自己的模型访问配置，不插入平台聊天扣费流水，也不减少平台积分。

## 5. DSH 恢复策略

Rust 请求模型增加可选的已完成历史 seed，只在为某个稳定 session key 第一次创建 DSH Agent 时使用。worker 使用 DSH 官方 `Session`/`AgentRegistry.create({ seed })` 能力生成合法的 user/message 与 assistant/message 事件；之后继续通过同一个 `AgentHandle` 的 `followup` 运行对话。

约束：

- seed 只来自已授权的 `knowledge_chat_turns`，只包含 user/assistant 文本。
- 不把其他账号、其他个人树或平台配置带入 seed。
- tool call、搜索结果和内部 system prompt 不写入 MapFlow 聊天历史响应。
- worker 内存 session 和持久化历史的 key 都包含账号与个人树条目，不能只用公共 `tree_id`。
- 现有只读 `web_search` 工具 allowlist、提示词防泄露和流式“只转发最终可见回答”策略保持不变。

## 6. 前端状态与布局

### 聊天

`KnowledgeChatPanel` 在 `libraryEntryId` 变化或首次挂载时读取历史；加载期间显示稳定状态，旧树的消息不能短暂串到新树。发送成功后追加回答、显示本轮费用并触发积分查询刷新。重置成功后清空本地消息并重新读取为空历史。

### 栏位

App 保存两个独立状态：

- `mapflow.layout.personal-sidebar-open`
- `mapflow.layout.node-detail-open`

localStorage 无效、缺失或值无法识别时均回退为 `true`，所以默认一定是展开。桌面端两个面板各有明确的 `aria-label` 收起/展开按钮；手机端继续使用现有 list/graph/detail/chat 视图栈，按钮不改变聊天全屏和返回逻辑。

### 退出

App 统一控制退出确认弹窗，桌面账号区和手机抽屉都只调用 `requestLogout`。只有确认按钮会调用 IdentityContext 的 `logout`；取消、Escape 和点击遮罩都不退出。

### 主题

主题写入 `html[data-mapflow-theme]` 和 localStorage：

```text
dark | light | ivory | blue-gray
```

用全局主题变量覆盖页面背景、面板背景、边框、正文、辅助文字、输入框、按钮和 React Flow 控件；保留主题选择器在顶部栏，手机端同样可见。每个主题都使用深色/浅色对应文字和边框，不依赖反色滤镜，避免图标、代码块和节点文字不可读。

## 7. 技能树导出

新增纯前端导出模块，输入当前 `PersonalTreeDetail` 的 graph 和 `completed_node_ids`，不请求后端额外数据，不调用模型。

JSON 结构包含：

```json
{
  "format_version": 1,
  "tree": {},
  "nodes": [],
  "edges": [],
  "completedNodeIds": [],
  "progress": { "completed": 0, "total": 0 }
}
```

不包含 `library_entry_id`、account/player 信息、聊天记录、积分、平台配置、API Key、session 或 CSRF 数据。JSON 保留节点字段和边字段，方便 Codex 读取；Markdown 以树元信息、进度摘要、带完成复选框的节点列表和关系列表组织，方便人读。

左侧个人树库提供一个“导出技能树”入口，点击后选择 JSON 或 Markdown；没有加载完成的个人树时不显示可用导出操作。下载文件名只根据安全化后的树标题生成。

## 8. 测试与本地验收

实现顺序遵循先红后绿：

1. Rust：微积分迁移/账本幂等、聊天历史 store、聊天服务正式扣费和 DSH seed 恢复测试。
2. worker：seed 会话恢复、同一树连续上下文、跨树隔离、工具 allowlist 和 reset 测试。
3. 前端：历史加载/切树隔离/积分刷新、退出确认、两个面板独立持久化、主题选择、JSON/Markdown 内容安全测试。
4. 跑 frontend 与 server 的完整测试、typecheck/build/fmt/clippy（受本机数据库环境限制的已有测试单独记录）。
5. 本地启动真实项目后，用 Browser Harness 的 DOM 操作逐项验收：刷新后历史、发送后小数积分、确认退出、栏位收起/刷新恢复、四种主题文字对比度、两种文件下载内容。禁止使用 Computer Use。

本阶段只保留在本地 `main`。用户明天验收通过后，才进行 GitHub/服务器发布。
