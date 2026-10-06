---
name: ai-gateway-skill
description: 通过 爱你 AI (https://anyai.token6688.com) 接入 AI 模型能力时使用: 给用户的代码 / 网站 / APP 加对话、生图、生视频、语音、音乐等功能, 或直接替用户调用模型生成内容。GT 兼容 (换 base_url 即用) + CL Messages / GT Responses 原生入口 + 图片 / 视频 / 音频统一异步入口。每次新对话先按「启动步骤」拉本站实时真值再动手。
---

# 爱你 AI · AI 模型接入 Skill

> 这个文件只告诉你**去哪里拿真值、按什么规矩调**; 具体接口 / 模型 / 价格以本站实时接口返回为准, 不要背下来。

## 1. 平台与密钥

- 平台: 爱你 AI · Base URL: `https://anyai.token6688.com` · 网页文档: https://anyai.token6688.com/api-docs
- 鉴权: `Authorization: Bearer <API_KEY>` (CL 入口也接受 `x-api-key`)。
- Key 从哪来 (按顺序): ① 项目根 `.env` 的 `API_KEY` ② 本文件末尾「密钥」一节记录的位置 ③ 都没有 → 让用户到网页右上角「管理密钥」创建, 存进 `.env`。
- **没有 Key 不调任何付费接口。** 公开接口 (`/v1/skills` `/v1/skills/models` `/v1/skills/guide`) 不需要 Key。

## 2. 启动步骤 (每次新对话都做, 顺序不变)

1. `GET https://anyai.token6688.com/v1/skills` — 平台接口路由表 (分类 / path / method / 参数)。
2. `GET https://anyai.token6688.com/v1/skills/guide` (加 `Accept-Language: zh-CN` 头; 英文发 en) — 每种调用模式的端点、请求示例、轮询流程。
3. 按需 `GET https://anyai.token6688.com/v1/skills/models?type=chat|image|video|audio`, 再 `GET https://anyai.token6688.com/v1/skills/models/{model}` 看参数 (合法值 = `params[].options[].value`), `GET https://anyai.token6688.com/v1/skills/models/{model}/pricing` 看跨渠道价格。
4. 把 1~3 的要点整理进本文件同目录的 `API_MAP.md` (接口清单 / 模型清单 / 每类调用示例 / 计费口径 / Key 位置)。已存在且一致就跳过, 有差异就覆盖。
5. 然后才开始处理用户需求。

## 3. 该走哪个入口

| 需求 | 入口 | 备注 |
|---|---|---|
| 对话 / 写作 / 代码 (gpt · claude · gemini · qwen · deepseek · grok …) | `POST https://anyai.token6688.com/v1/chat/completions` | GT 格式, 换 `model` 即换厂商; `stream:true` SSE |
| 已用 CL SDK / CL Code | `POST https://anyai.token6688.com/v1/messages` | 请求体保持 CL 原样 |
| 已用 GT Responses SDK / Codex | `POST https://anyai.token6688.com/v1/responses` | 原生 Responses |
| 视频 / 音乐 / 语音 | `POST https://anyai.token6688.com/v1/media/generate` → `GET https://anyai.token6688.com/v1/tasks/{task_id}` | 请求体 `{"model","prompt","params":{…}}`, 轮询到 `is_final=true`, 结果在 `output_url`; 图片走这里是同步的 |
| 视频 (GT 风格) | `POST https://anyai.token6688.com/v1/videos/generations` | 参数放**顶层**, 不用 params 信封; 支持 `client_request_id` 幂等 |
| 同步出图 | `POST https://anyai.token6688.com/v1/images/generations` | 阻塞 40~50 秒; 链路超时 <60s 请改用 `POST https://anyai.token6688.com/api/v1/model-runtime/invoke` 异步。返回 `data[].url` (恒有, 可能是压缩图; 无损原图在条件字段 `original_url`) + `usage.cost_rmb` / `usage.balance_rmb`; `response_format` 不改变返回形态, 拿不到 base64 |
| 本地文件 → 公网 URL | `POST https://anyai.token6688.com/v1/files` (multipart 字段 file, ≤50MB) | 返回 `url` 直接当参考素材 |
| 余额 | `GET https://anyai.token6688.com/v1/skills/balance` | 付费调用前先查; 金额字段是 "$x.xxxxxx" 字符串, 解析时去掉 $ |
| 消费明细 | `GET https://anyai.token6688.com/v1/skills/usage` | 按次核算成本; 每条含 `model` / `channel` (渠道代号) / `cost` (⚡ 与美元双口径) / `tokens`。**金额带符号** (负=扣费 正=退款), 求和即净消费; 翻页带 `next_cursor` |

调度: 建密钥时可选策略 (智能 / 价格优先 / 稳定优先 / 速度优先) 或固定渠道; 单次请求可用 `X-Schedule-Strategy` 头覆盖。固定渠道是严格路由, 不自动切换。

## 4. 异步任务怎么判

- `status` 只有 4 个值: `pending` → `processing` → `completed` / `failed`; 用 `is_final` 判终态, 别猜字面值。
- 5~10 秒轮询一次; 卡在 pending/processing 多为上游排队, **不要重复提交** (会重复计费)。
- `failed` 时看 `error` / `error_class` (content_blocked / rate_limit / generation_failed …); 预冻结金额自动解冻, 不用申请退款。

## 5. 参数铁律 (每一条都有真实客户踩过)

1. 枚举参数发 `options[].value`, 不发显示 label — 发错会被静默忽略并落到默认档。
2. 视频类 `prompt` 必填; 参考图 / 音视频必须是公网可直接下载的 http(s) 直链, 本地文件先走 `/v1/files`。
3. `/v1/videos/generations` (顶层扁平) 和 `/v1/media/generate` (params 信封) 别互抄示例。
4. 异步提交按整单预冻结, 余额刚好够零头会 402 — 保持至少一单缓冲。
5. 先用最便宜的模型 / 最短时长把链路跑通并打印 `usage` / 费用, 再换满血模型上量。
6. 带参考视频的视频任务: 先 `POST /v1/pricing-estimate`, params 里带 `videos` + `video_total_duration_sec` (各段秒数之和) —— 参考视频按合计时长计入输入费, 不传就少算; 实扣 ≤ 响应里的 `max_effective_total_rmb`, 钱怎么构成看 `price_basis`。

## 6. 交付前自检

- [ ] 密钥只在服务端 / .env, 没进前端或 git
- [ ] 用真实接口跑过一次最小示例, 记录了返回体和费用
- [ ] 异步任务按 `is_final` 收口, 有失败分支和幂等重试
- [ ] `API_MAP.md` 与本次拉到的接口一致

## 7. 长期规则

- 不假设任何接口存在, 以 `/v1/skills` 为准; 再拉发现有新增 / 变动就更新 `API_MAP.md`。
- 401 → 提示用户到「管理密钥」检查或重建; 402 → 提示充值; 429 → 按 `Retry-After` 退避。

## 密钥

(由 AI 在完成第 2 步后填写: 例 “Key 在 .env 的 API_KEY”)

## 使用须知与免责声明

本 API 仅面向 爱你 AI 已注册用户开放, 用于在您自建的智能体 / 应用中调用本平台已接入的模型能力, 且仅限本人或本组织内部自用。禁止将 API 密钥或本平台接口转售、二次分发、封装后向不特定第三方提供服务, 或用于其他未经许可的外部接入; 禁止生成或传播违反法律法规的内容。经您的密钥发起的全部请求内容及生成结果由您自行负责; 平台对模型输出的准确性、完整性不作保证, 并有权在发现违规或异常调用时限流、停用密钥或终止服务。继续使用即视为已阅读并同意上述条款。
