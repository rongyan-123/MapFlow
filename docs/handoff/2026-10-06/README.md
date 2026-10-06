# MapFlow 开发交接（2026-10-06）

> 本页记录历史开发分支的状态。当前前后端已经合入 main，酒馆正式按上游实扣 × 2 扣现金余额，生产运行在笔记本。请先阅读 [2026-10-07 部署记录](../../deployment/2026-10-07-tavern-cash.md)，不要按下文旧分支、试用开关或未实现扣费描述覆盖当前部署。

## 从这里继续

两仓库均使用分支 `codex/tavern-wallet-payments-20260930`，不要直接覆盖 main：

```sh
git clone --branch codex/tavern-wallet-payments-20260930 git@github.com:rongyan-123/mapflow-server.git
git clone --branch codex/tavern-wallet-payments-20260930 git@github.com:rongyan-123/MapFlow.git
```

已有仓库可先 `git fetch origin`，再切换/跟踪上述分支；先保护自己的未提交改动。后端 Cargo 私有 engine Git 依赖需要 GitHub SSH 读取权限。

## 已完成

- 独立现金额度钱包：1 元 = 1 额度；新账户一次性赠送0.1。管理员登录密码复核后直接给用户加减额度、确认充值；流水显示用户/原因/处理人，可撤销，不强制银行流水号。
- 微信/支付宝收款码、管理员上传替换、充值申请和已付/未付申报；申报不自动入账。
- 余额入口、模型/渠道展示及布局滚动优化。渠道目录不等于实时存活率，缺失价格不能当实际价格。
- 酒馆 BYOK（用户自己的 Key、公开 HTTPS /v1 URL、模型）；无 Key 可看会话，发送时明确提示。
- 平台模式统一为“使用平台模型（需要充值）”；使用服务端 AnyAI Key，9 个允许模型，显式试用开关，当前不扣钱包或旧积分。
- 真实 AnyAI deepseek-v4-flash 多轮聊天已验证：“你好”得到正常问候，“17 加 26”得到43；保存回复且额度仍为10。

## 继续开发的注意事项

1. 正式钱包扣费尚未实现。约定上游0.1倍率、本站0.2倍率，页面写0.2倍率；正式接通前核对价格、token usage、幂等结算和失败/断流计费。
2. 本次真实 SSE 应用层 usage 记录为0，上游实际有消费，不能按0做计费。优先核对上游 usage 返回格式。
3. 不要复用旧“只回复：平台聊天接入成功”验收会话作为用户日常会话。上下文与重复回复有关，但没有完整证明唯一根因；新会话多轮对照正常。不得把定向固定答复当完整验收。
4. 平台/模型选择目前页面刷新后需重新选；BYOK Key 刷新清空，不持久化。
5. 安卓收款监听是另一个会话/项目，本次推送不代表安卓侧完成；没有上线自动支付回调。
6. 本次为开发分支推送，不代表线上服务器已部署。

## 启动与验证

前端：`npm ci`，`npm test`，`npm run build`（含 TypeScript 检查）。

后端：安装项目要求的 Rust/Node 与 PostgreSQL；按 README 准备身份密钥、数据库 URL 文件和管理员用户名文件。先用 `mapflow-admin database migrate` 完成迁移（含0026/0027），再启动服务。

关键环境变量（值为本机绝对路径，密钥内容不要放进前端）：

```text
MAPFLOW_STATIC_ROOT=<前端仓库>/dist
MAPFLOW_DATABASE_URL_FILE=<私有目录>/db.url
MAPFLOW_IDENTITY_SECRETS_FILE=<私有目录>/identity.json
MAPFLOW_ADMIN_USERNAME_FILE=<私有目录>/admin-username
MAPFLOW_IDENTITY_PUBLIC_ORIGIN=<实际HTTPS入口>
MAPFLOW_TAVERN_ANYAI_API_KEY_FILE=<私有目录>/anyai-api-key
MAPFLOW_TAVERN_PLATFORM_TRIAL=true
```

试用开关和文件有效才启用平台模型。客户端不能指定平台 Key 的目标URL。身份 Origin/Host/CSRF 验证不可跳过；按 README 配置反向代理。Linux 原机演示通过专用本地代理访问 localhost:18082，映射后端身份 Origin；不是裸 vite proxy 即可完整复现。

后端测试使用测试 PostgreSQL 的 DATABASE_URL：`cargo test`；格式 `cargo fmt --check`；类型/构建 `cargo check --all-targets --locked`；lint `cargo clippy --all-targets`。

## 验证记录

业务代码最后完整验证：后端660通过、0失败；前端459通过、1跳过。前端typecheck/build、后端build/fmt通过。Clippy尚有既存警告：type_complexity、unused_async、match_bool、struct_excessive_bools、derivable_impls、cloned_ref_to_slice_refs；没有声称严格-D warnings全绿。

本目录 evidence 保存实际测试/构建日志；后端同目录还保存真实浏览器验收截图。历史方案和审计在后端 `docs/plans/`、`docs/audit/`。

## 本地数据与密钥不由 Git 迁移

原机私有运行目录：`/home/rong/.local/state/mapflow/wallet-preview-20260930`。本地测试账户、10额度、聊天历史及数据库记录属于运行数据，不在 Git 中。密钥也仅在服务端私有文件中，不在 Git 中。需通过私有通道迁移这些文件或在新机器重新配置。

本次另生成本地私有迁移包：`/home/rong/.local/state/mapflow/handoff-20261006/mapflow-local-runtime.tar.gz`。包含原机本地数据库备份、身份/AnyAI配置、启动代理脚本及恢复说明，不含生产数据库、SSH私钥。它含凭据，未上传Git；自行通过私有通道复制。启动脚本内有原机路径，恢复前改成新机目录；数据库URL也需匹配新机PostgreSQL配置。
