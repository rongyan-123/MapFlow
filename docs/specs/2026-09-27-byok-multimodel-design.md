# 自填 Key 多模型适配设计

日期：2026-09-27。前端实现分支 `codex/model-adapter-byok`；服务端实现分支 `codex/model-adapter-upstream`。

## 目标与范围

用户在生成技能树和酒馆里选择模型，填写自己的 API Key 与 URL，并由 MapFlow 服务端代发模型请求。自填 Key 的所有生成动作不检查、也不扣除 MapFlow 积分。Key 只存在当前页面内存和当次请求处理过程；刷新后重填。现有平台免费模型和旧积分模式继续按原规则运行。技能树聊天此次不改。

本期新增的模型只允许自填 Key。默认 URL 为爱你 AI 的 OpenAI 兼容 `/v1` 接口；保留 DeepSeek 官方入口，并允许用户填写其他公网 HTTPS OpenAI 兼容 `/v1` URL 和模型 ID。自定义线路只保证标准文本聊天字段；是否支持工具调用及特殊参数由该线路决定，错误要明确返回。

## 模型配置

首批预设为 `deepseek-v4-flash`、`deepseek-v4-pro`、`gpt-5.4-nano`、`gpt-5.4-mini`、`gpt-5.4`、`claude-sonnet-4-6`、`gemini-3.8-flash`、`qwen3.8-flash`、`kimi-k3`。服务端拥有唯一的预设目录及每个模型的参数约束，前端从服务端读取，不独立猜测支持项。请求中的预设参数由服务端再次校验；额外字段不透传。

公开模型详情表明，DeepSeek Flash 有 `thinking`，Pro 另有 `reasoning_effort`；GPT-5.4 本体有 `enable_thinking` 和 `reasoning_effort`，Nano/Mini 没有声明思考开关；Gemini 3.8 Flash 使用 `enable_thinking` 和 `thinking_budget`；Qwen3.8 Flash、Kimi K3、Claude Sonnet 4.6 有各自声明的思考开关。仅对声明 `web_search` 的模型展示联网选项。温度、最大输出与停止词沿用现有通用文本参数及服务端边界。媒体附件上传此次不做，因为它还需要独立的文件上传与权限流程。

酒馆的“上下文”选项控制 MapFlow 实际发送的历史对话预算，不是上游 API 字段。当前服务端最多发送 32 KiB 历史；可选预算不能高于此上限，模型 `context_window` 仅作为只读能力信息展示。生成技能树是分阶段任务，沿用现有输入约束，不增加伪上下文参数。

## 请求与密钥流向

前端配置：线路类型、base URL、模型 ID、Key、参数。Key 保存在 React 页面状态，不进入 localStorage、sessionStorage、URL、查询缓存或服务端数据库；酒馆每次回复、重试和续写都在请求体中携带当次 Key。页面刷新、切换账号或关闭页面即丢弃。只保存非秘密的会话生成参数和模型选择；不保存自定义 URL 中的用户名或密码。

服务端将自填 Key 请求与平台请求区分为显式类型。生成技能树经过现有 Rust OpenAI 兼容适配器；酒馆的自填 Key 回合由 Rust 请求级流式适配器执行，不复用平台 DSH 会话。平台酒馆继续使用 DSH。两条自填 Key 路径共用模型目录与参数契约，并各自实现与真实上游一致的请求序列化。用户 Key 不写入 worker 进程环境变量。

用户提供的 URL 只允许公网 HTTPS `/v1` base URL；拒绝 URL 凭据、片段、回环/私网/链路本地地址和重定向。DNS 解析后的目标 IP 也要校验，连接期间避免 DNS 重绑定。任何日志、错误、观测字段及调试输出都不得含 Key 或授权头。客户端和服务端均设置请求大小、超时和输出上限。

## 扣费和记录

自填 Key 在酒馆生成前跳过旧积分余额检查，提交时记录真实模型 ID、用量和 `chargedCreditUnits=0`，不写积分扣费流水。即使账号积分为 0，用户仍可成功回复、重试或续写。平台模型继续使用现有余额检查、报价与扣费事务。生成技能树现有自填 Key 路径保持不扣分；旧积分和免费模式维持旧的配额与价格。

## 失败处理

Key 缺失、模型不在所选线路目录、URL 不安全、参数不被该模型支持，都在调用前返回字段明确的错误。上游 `401/403/404/429` 和超时映射为可理解的消息，不回显 URL 中的秘密或响应体中的 Key。酒馆流式生成中断时沿用会话回滚与幂等机制，不写扣费流水。生成技能树若模型不支持工具调用，返回清楚的兼容性错误；不悄悄切换到别的模型或平台 Key。

## 实施与验证

1. 先写服务端目录、参数映射、URL 安全校验测试，确认失败，再实现目录和通用接入。模拟上游检查发送的模型 ID、Key 所在授权头、思考字段和不应发送的字段。
2. 先写生成技能树的多模型与自定义 URL 失败测试，再扩展现有自填 Key 请求。验证创建、调整、追问、确认各阶段使用同一配置且不扣积分。
3. 先写酒馆无积分自填 Key、零扣费、会话隔离、模型参数与 SSE 中断测试，再接 Rust 请求级流式适配器及结算分支。验证平台 DSH 路径结果不变。
4. 先写前端配置交互测试，再接生成技能树和酒馆界面。验证切换模型只展示可用参数、刷新后 Key 消失、提交请求携带所选模型和 URL。
5. 运行前后端完整测试套件、类型检查、构建、Rust 格式检查与 lint；自审 diff。真实爱你 AI 调用由用户在界面输入自己的 Key 后做连通验证；测试仓库不保存 Key。

参考：[爱你 AI 模型目录](https://anyai.token6688.com/v1/skills/models?type=chat)、[Gemini 3.8 Flash 详情](https://anyai.token6688.com/v1/skills/models/gemini-3.8-flash)、[OWASP SSRF 防护](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)。
