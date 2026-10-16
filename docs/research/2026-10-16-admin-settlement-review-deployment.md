# 管理员回执核对与学习区角色库发布

2026-10-16，前后端及配套数据库迁移已发布至 <https://xxian.fun/>。管理员进入“管理后台 → 查看待核对记录 → 核对这笔记录”，可重新核对已有证据；已停止或失败且仅供审计的记录，可填写说明并归档本版本提醒。用户所报执行 `01a14370-3646-7603-a29c-69dcc8bc6e49` 保持原样，仍可由管理员处理。

## 固定版本

| 项目 | 发布值 |
| --- | --- |
| 前端 | `2632500548c045a1f532bdc143000dad8eaab0aa` |
| 后端 | `d485130ba4806b8800d44bc011c8abdea970ec26` |
| 应用镜像 | `mapflow-server:admin-settlement-review-20261016-d485130` |
| 应用镜像 ID | `sha256:14dd0656ee0645d11fefcd6d0f8daf5dc4562788cb46b9ec16dbd23fe3194dd7` |
| 数据库 | schema58；仅追加 `0058_agent_settlement_reviews.sql` |
| 知识推理镜像 | 原 `sha256:db3ebab1e2673d69176ac4c7c1a1b39d0dc29c8091c7cc594412b9e246fd3ffd` |

前端包含此前通过验收的学习区完整角色库选择及历史按钮位置修复。后端以最新整合 main 为基线；已有知识推理单槽并发修复与当前线上推理镜像一致。未混入尚未完成的聊天核心重构，也未发布其他分支的提示词改动。

## 验证与数据保留

- 已批准产品版本完成前端 620 通过、1 原有跳过、类型检查及构建；后端有效 1080 通过、2 项在原 main 重现的 Windows 基线失败、10 跳过，fmt 与 Clippy 检查通过。此次部署未改变产品源码。
- Linux 在无网络构建容器中从固定 Git 归档执行 `cargo build --offline --release --locked`，替换服务器与管理二进制；17 个运行文件中，Node 和 Harness 文件保持原 SHA-256。逐项核对 396 个前端构建文件，删除旧前端文件，运行参数、密钥挂载、网络/IP、资源限制、支付配置均保留。
- 41 项部署保护测试通过。生产备份恢复到独立 internal 网络的 PostgreSQL 副本，验证迁移精确字节校验及历史迁移行保留、真实旧应用在 schema58 上启动、核对及重复归档、重启后归档状态保留。验证匿名 401、普通用户/缺少 CSRF 403、旧指纹 409、空说明/虚构金额 400。无新增模型调用。
- 第一份热备包含当时尚未结束的真实生成请求，被隔离验收保护检查拒绝。保留该快照和停止的独立容器，待请求自然结束后重新备份恢复；未更改真实执行或放宽活动执行检查。
- 生产切换前停机冷备份 `before-cutover.dump` 为 29,235,702 字节。88 张原表逐项校验：历史迁移记录不变，仅追加58；普通业务记录保持。访问观察记录按原有数量上限自动移除 88 行、保留 20,000 行旧记录并新增 9 行，已逐项验证删除顺序及保留行摘要，未手动清理。新增复核表为 0 行，没有代替管理员确认真实记录。原 4 笔无活动拥有者的待核账执行及所报记录的执行/结算/调用摘要均保持。
- PostgreSQL 容器与镜像未替换。知识推理伴随容器以原镜像和挂载重建至新应用网络命名空间，原始模型文件、健康身份及真实 CPU 嵌入检查通过。
- 公网主要路由、健康检查及受保护 API 验证通过。真实 Chrome 检查公网管理员路由登录保护，320/390/1440px、浅色/深色共 4 张截图，无横向溢出，入口 JS/CSS 与固定构建一致。没有借用生产账号登录或提交核对；已认证操作由真实本地 API/浏览器及生产副本 HTTP 验收覆盖。

## 运维与回退

私有发布包：`/home/rong/.local/state/mapflow/admin-settlement-review-20261016/`。发布目录：`/opt/mapflow-laptop-migration-20261006/releases/20261016-admin-settlement-review/`。均保留来源、SHA-256 清单、备份、隔离/生产验收、原容器设置与回退记录；含私有内容的目录仅 root 可读，未提交凭据或数据库备份。宿主 `OPERATIONS.md` 已更新。

回退命令：

```sh
sudo python3 /home/rong/.local/state/mapflow/admin-settlement-review-20261016/2026-10-16-admin-settlement-release.py rollback
```

恢复 `mapflow-laptop-app-before-admin-settlement-20261016` 与 `mapflow-laptop-knowledge-before-admin-settlement-20261016`，保留 schema58 和之后产生的数据。旧应用已在恢复副本的 schema58 上实际启动验证。不得将历史备份直接覆盖上线后的新记录。

本地发布证据：`D:/tmp/mapflow-admin-settlement-deployment-20261016/`。功能验收与手机弹窗截图：`D:/tmp/mapflow-admin-receipts-20261016/`。所有 Codex 会话、关联目录、Git worktree 及未完成重构的具名 stash 均保留。
