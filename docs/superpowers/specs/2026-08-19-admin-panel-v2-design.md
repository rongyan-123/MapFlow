# 管理面板增强 v2 + 自动部署 设计文档

**日期**: 2026-08-19
**状态**: 待确认

## 背景

管理面板已上线（v1：dashboard/accounts/invitations/audit-events + suspend/revoke）。用户反馈：

1. 审计日志事件名不可读（`identity.logged_in` 这种代码标识符看不懂在说什么）
2. 面板统计太浅：只有"每日登录人数"一个趋势，想看当前在线、连续在线、停留时长、每人消耗次数等
3. 部署流程繁琐：每次小改动都要手动下载 artifact → scp → docker load → switch，希望 push 自动部署

## 现状调查（已确认的事实）

- 生产库 `identity_audit_events` 全部事件只有 2 种：`identity.registered`（20 次）、`identity.logged_in`（14 次）。生成树相关事件不在审计日志中。
- `details` JSONB 列存在但写入时均为 `{}`，且 API 响应不返回该列 → 事件信息量趋近于零。
- 平台模式**无配额概念**（代码只有 `platform_funded_generation_enabled` 布尔开关），"每用户剩余次数"无定义。
- `tree_generation_sessions` 无时长列，但 `sessions.created_at / last_seen_at / revoked_at` 可算停留时长。
- 连续 3 天在线 SQL 已验证可算（当前结果为 0，符合现实）。
- 平台用量表 `platform_generation_usages` 有 `state / reserved_at / finalized_at`，token 在 `tree_generation_plans`。

## 设计

### A. 审计日志可读化

**后端（mapflow-server）**

1. `AdminAuditEvent`（application/admin.rs）加 `details: serde_json::Value`；`list_audit_events` SQL 加 `details` 列；`AdminAuditEventResponse`（http/admin.rs）加 `details` 字段（与 eventType/outcome/playerId/occurredAt 并列）。
2. 审计写入丰富：`identity_store.rs` 两处 INSERT（注册 line 178、登录 line 222）接受 `details` 参数；调用方 `auth.rs` 的 register/login handler 传入 `effective_client_ip` → details = `{"client_ip": "x.x.x.x"}`。历史事件 details 保持 `{}`（无法补，前端对空 details 不显示 IP）。
3. 测试：admin 审计查询断言 details 字段透出；身份注册/登录集成测试断言 details 写入 IP。

**前端（MapFlow-publish）**

4. `types.ts` 的 `AdminAuditEvent` 加 `details: Record<string, unknown>`。
5. `AuditLogTab.tsx` 表驱动映射：
   - `identity.registered` → 标题「注册账号」，描述「新用户通过邀请码注册」
   - `identity.logged_in` → 标题「用户登录」，描述「用户登录系统」
   - 未知事件 → 原样显示 `eventType`
   - `outcome`: `succeeded` → 「成功」，`rejected` → 「拒绝」，`failed` → 「失败」+ 颜色区分
   - `details.client_ip` 存在时显示「IP: x.x.x.x」
   - 表格列调整：事件（图标+标题+描述）｜结果｜用户（playerId）｜IP｜时间

### B. 面板统计增强

**后端**（`AdminStore::dashboard_summary` 与 `list_accounts`）

6. `AdminDashboard` 新增字段：
   - `current_online: i64` — 当前在线会话数：`sessions WHERE revoked_at IS NULL AND absolute_expires_at > now()`
   - `consecutive_3d_logins: i64` — 近 7 天连续 ≥3 天登录的账号数（已验证 SQL：daily 去重 → day - row_number 分组 → 计数 ≥3）
   - `total_active_minutes: i64` — 全部会话累计活跃分钟：`SUM(EXTRACT(EPOCH FROM (COALESCE(revoked_at, now()) - created_at)))/60`
   - `avg_active_minutes: i64` — 人均：total / 有会话账号数（0 则 0）
   - `daily_consumed_7d: Vec<DailyConsumed>` — 近 7 天每日平台消耗次数：`platform_generation_usages WHERE state='consumed' AND finalized_at >= now() - interval '7 days'` 按天计数
7. `AdminAccount` 新增字段：
   - `platform_consumed_usages: i64` — 该账号 consumed 状态的 platform usage 数（「消耗次数」）
   - `active_minutes: i64` — 该账号全部会话累计分钟
8. `AdminDashboardResponse` / `AdminAccountResponse`（http/admin.rs）同步加字段（camelCase）。
9. 测试：dashboard_summary 新字段断言、list_accounts 新字段断言。

**前端**

10. `types.ts` / `adminClient.ts` 同步新字段（`currentOnline`、`consecutive3dLogins`、`totalActiveMinutes`、`avgActiveMinutes`、`dailyConsumed7d`、`platformConsumedUsages`、`activeMinutes`）。
11. `OverviewTab.tsx`：
    - 指标卡片新增：当前在线（人）、连续 3 天在线（人）、总停留时长（分钟，格式化 xh xm）、人均停留时长
    - 登录趋势柱状图旁新增「每日消耗次数」柱状图（7 天，复用现有柱状图实现模式）
12. `AccountsTab.tsx` 表格新增列：平台消耗次数、停留时长（分钟格式化为 xh xm）。
13. 测试更新：AdminPanel.test.tsx 等 mock 数据补新字段并断言渲染。

### C. 自动部署（push 即上生产）

**服务器（阿里云 47.114.98.109）**

14. 生成专用部署密钥对（ed25519，注释 `deploy-key-mapflow`），公钥追加到 root 的 `~/.ssh/authorized_keys`（独立一行，吊销 = 删行 + 删 GitHub secret）。
15. 固化部署脚本到 `/opt/mapflow/switch.sh`（参数：归档文件名）：
    - `docker load -i <归档>` → 镜像 tag = `mapflow-server:canary-<SHA>`（从文件名提取）
    - 清理全部 `mapflow-app-previous-*` 容器
    - python 从当前 `mapflow-app` 容器 inspect 提取 MAPFLOW_ env（过滤 TURNSTILE、去重 POOL_FILE/ADMIN_USERNAME_FILE），拼 run 参数（内存/CPU/read-only/tmpfs/cap-drop/user/端口/挂载均与现部署一致）
    - `docker stop mapflow-app` → `docker rename mapflow-app mapflow-app-previous-<OLD_TAG>` → 启动新容器
    - 30 秒 health 检查（`/health/ready`），失败自动回滚（rm 新容器 + rename 回来 + start）
16. 建 `/opt/mapflow/artifacts/`，部署成功后可清理（保留最近 2 个归档）。

**CI（mapflow-server/.github/workflows/ci.yml）**

17. 新增 `deploy-prod` job：`needs: linux-canary-artifact`，`if: github.ref == 'refs/heads/main' && github.event_name == 'push'`：
    - `actions/download-artifact` 下载本次构建归档
    - SSH 配置：`DEPLOY_HOST` / `DEPLOY_SSH_KEY`（GitHub secrets），ssh-keyscan 固定 known_hosts
    - `scp` 归档到 `/opt/mapflow/artifacts/`
    - `ssh 'bash /opt/mapflow/switch.sh mapflow-server-<SHA>.tar.gz'`
    - 失败时 job 标红（回滚已由脚本内建）
18. GitHub secrets 需配置：`DEPLOY_HOST`（47.114.98.109）、`DEPLOY_SSH_KEY`（私钥全文）。若本机 gh 可用则我直接配置，否则给用户手动配置指引。

**风险与缓解**

- 部署密钥泄露：独立密钥非主密钥，吊销 = authorized_keys 删行 + 删 secret，无其他影响。
- 自动部署失败：脚本内建 30 秒 health 回滚，服务不中断。
- 服务器磁盘：归档保留最近 2 个，镜像保留（可手动回滚任意历史版本）。

## 验证方式

- 后端：`cargo test`（新字段 + details 透出 + IP 写入断言）
- 前端：`npm test`（Overview/Accounts/AuditLog 断言）
- 端到端：push 后 CI 自动构建+部署，curl 验证：dashboard 返回新字段、audit-events details 含 client_ip、登录事件映射
- 用户浏览器验收

## 范围外（明确不做）

- 平台配额系统（"剩余次数"）——用户确认只显示已消耗
- 生成树事件写入审计日志——审计事件保持注册/登录两类
- 历史审计事件补 IP——无法补，前端对空 details 不显示
