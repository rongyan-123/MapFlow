# 爱你 AI 接口速查（2026-09-27）

来源：公开接口 [`/v1/skills`](https://anyai.token6688.com/v1/skills)、[`/v1/skills/guide`](https://anyai.token6688.com/v1/skills/guide)、[`/v1/skills/models?type=chat`](https://anyai.token6688.com/v1/skills/models?type=chat)。调用前重新查询实时目录与模型参数。

## 本项目使用

MapFlow 目前只使用 `POST https://anyai.token6688.com/v1/chat/completions`。请求头为 `Authorization: Bearer <用户自己的 Key>`，请求体为 OpenAI Chat Completions 格式：

```json
{"model":"gemini-3.8-flash","messages":[{"role":"user","content":"你好"}],"stream":true}
```

响应为 SSE，`choices[0].delta.content` 是正文，`choices[0].delta.reasoning_content` 是思考内容，`data: [DONE]` 表示流结束。MapFlow 仅把正文显示在酒馆；生成技能树使用同一路径的非流式调用。

本站公开目录有 53 个聊天模型（查询时数量），MapFlow 当前预设 9 个文本模型：`deepseek-v4-flash`、`deepseek-v4-pro`、`gpt-5.4-nano`、`gpt-5.4-mini`、`gpt-5.4`、`claude-sonnet-4-6`、`gemini-3.8-flash`、`qwen3.8-flash`、`kimi-k3`。具体参数以 `/v1/skills/models/{model}` 的 `params[].options[].value` 为准；前端只展示已核对的参数。

## 其它公开路由

| 用途 | 路径 | 示例 |
| --- | --- | --- |
| 模型目录与参数 | `GET /v1/skills/models?type=chat`、`GET /v1/skills/models/{model}` | 查当前可用模型和参数 |
| 图片 | `POST /v1/images/generations` | `{"model":"<图片模型>","prompt":"一只猫"}`；此入口同步返回 |
| 视频 | `POST /v1/videos/generations` | `{"model":"<视频模型>","prompt":"一只猫跑过草地","duration":5}`；参数在顶层，异步返回任务 ID |
| 媒体通用 | `POST /v1/media/generate` | `{"model":"<音频或视频模型>","prompt":"示例","params":{}}`；视频/音频异步，图片同步 |
| 任务结果 | `GET /v1/skills/task-status?task_id={task_id}` | 轮询至 `is_final=true` |
| 价格 | `GET /v1/skills/models/{model}/pricing` | 需用户 Key；按账号和渠道返回实际价格，本项目不代查或缓存 |
| 余额和明细 | `GET /v1/skills/balance`、`GET /v1/skills/usage` | 需用户 Key；本期不接入 |

## 密钥与费用

Key 由用户在 MapFlow 页面输入，仅随该次模型请求发送到 MapFlow 后端，再由后端发给上游；页面刷新即清空，数据库和浏览器持久化存储均不保存 Key。本项目没有平台付费 Key。用户的上游费用由爱你 AI 直接向其账号收取；MapFlow 的自填 Key 请求不扣旧积分。价格因账号和渠道而异，不能用公共目录推算实际扣费。

技能文件的「使用须知与免责声明」限制本人或组织内部使用，并禁止未经许可的对外封装。公开产品场景需要向站方确认授权边界。
