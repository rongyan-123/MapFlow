# 管理面板 v2（审计可读化 + 统计增强 + 自动部署）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 审计日志事件可读化（中文映射 + details 含 IP）、管理面板统计增强（当前在线/连续登录/停留时长/每人消耗）、CI 构建后自动部署到生产服务器。

**Architecture:** 后端 `AdminStore` 数据层扩展三个响应结构（dashboard/accounts/audit-events），审计写入在 store 层接受 `details` 参数、handler 层传入客户端 IP；前端表驱动映射事件类型 + 新增指标卡片/图表/列；部署自动化 = 服务器固化 `switch.sh`（docker load → 换容器 → health 回滚）+ CI 新增 `deploy-prod` job（scp 归档 → ssh 触发），专用部署密钥独立于现有主密钥。

**Tech Stack:** Rust 1.85.0 + sqlx 0.8.6（新增 `json` feature）、Axum；React 18 + TypeScript + vitest；GitHub Actions（ubuntu-24.04）+ 阿里云服务器（docker 容器，root 密钥登录）。

**Spec:** D:\MapFlow-publish\docs\superpowers\specs\2026-08-19-admin-panel-v2-design.md

## Global Constraints

- 全部 commit message 用中文（用户全局规范）。
- 后端：Rust 1.85.0（CI pinned），`cargo fmt --check`、`cargo clippy --all-targets --all-features --locked -- -D warnings`、`cargo test --all-targets --all-features --locked` 必须全绿。
- 前端：Node 24.11.1，`npm run typecheck`、`npm test`、`npm run build` 必须全绿。
- 审计事件类型字符串（`identity.registered` / `identity.logged_in`）**不可更改**——可读化只在前端做映射，后端不新增/改名事件类型。
- 管理响应保持 `Cache-Control: no-store`；不暴露邀请码明文；不打印任何 secret（部署密钥私钥只进 GitHub secret，绝不进 git/日志/命令行输出）。
- 服务器（1.6GiB RAM）：不在服务器上编译 Rust；生产 SQL 变更先本地/沙箱验证。
- 部署脚本保留现有容器运行参数（512m / 0.75cpu / read-only / tmpfs 16m / cap-drop ALL / no-new-privileges / user 10001:10001 / 127.0.0.1:18082/18083 / 挂载 ro）与 TURNSTILE env 过滤逻辑。
- 前端新字段必须与后端 camelCase 序列化名一致（currentOnline / consecutive3dLogins / totalActiveMinutes / avgActiveMinutes / dailyConsumed7d / platformConsumedUsages / activeMinutes / details）。

---

### Task 1: 后端 AdminStore 数据层 + HTTP 响应扩展

**Files:**
- Modify: `D:\mapflow-server\Cargo.toml`（sqlx features 加 `"json"`；`Cargo.lock` 由 cargo 自动更新并提交）
- Modify: `D:\mapflow-server\src\application\admin.rs`（AdminDashboard / AdminAccount / AdminAuditEvent）
- Modify: `D:\mapflow-server\src\adapters\postgres\admin_store.rs`（dashboard_summary / list_accounts / list_audit_events）
- Modify: `D:\mapflow-server\src\http\admin.rs`（DashboardResponse / DailyConsumedResponse / AdminAccountResponse / AdminAuditEventResponse + From impls）
- Test: `D:\mapflow-server\tests\postgres_admin_store.rs`

**Interfaces:**
- Produces（Task 2 与前端消费）:
  - `AdminDashboard` 新增字段：`current_online: i64`、`consecutive_3d_logins: i64`、`total_active_minutes: i64`、`avg_active_minutes: i64`、`daily_consumed_7d: Vec<DailyConsumed>`；新结构体 `pub struct DailyConsumed { pub date: NaiveDate, pub consumed: i64 }`
  - `AdminAccount` 新增字段：`platform_consumed_usages: i64`、`active_minutes: i64`
  - `AdminAuditEvent` 新增字段：`details: serde_json::Value`
  - HTTP 响应 camelCase：`currentOnline`、`consecutive3dLogins`、`totalActiveMinutes`、`avgActiveMinutes`、`dailyConsumed7d: [{date, consumed}]`、`platformConsumedUsages`、`activeMinutes`、`details`

- [ ] **Step 1: 加 sqlx json feature**

`Cargo.toml` 的 sqlx 依赖行改为：
```toml
sqlx = { version = "0.8.6", default-features = false, features = ["runtime-tokio-rustls", "postgres", "uuid", "migrate", "macros", "ipnet", "chrono", "json"] }
```
运行 `cargo check --locked` 前先 `cargo update -p sqlx --precise 0.8.6` 无关——直接跑 `cargo check`（不带 --locked 让 lockfile 更新），确认通过后 lockfile 一并提交。

- [ ] **Step 2: 扩展 application/admin.rs 数据模型**

`AdminDashboard` 结构体加 5 个字段（类型见 Interfaces），新增：
```rust
pub struct DailyConsumed {
    pub date: NaiveDate,
    pub consumed: i64,
}
```
`AdminAccount` 加 `platform_consumed_usages: i64`、`active_minutes: i64`；`AdminAuditEvent` 加 `details: serde_json::Value`。注意检查该文件 `AdminAccount`/`AdminAuditEvent` 的构造点（可能在 admin_store.rs 或测试中）同步编译。

- [ ] **Step 3: 扩展 dashboard_summary 查询**

在 `admin_store.rs::dashboard_summary` 中按现有模式（`query_scalar` / `query_as` + `map_err(map_storage_failure)`）追加 5 个查询：

当前在线（未撤销且未过期会话数）：
```sql
SELECT count(*) FROM sessions WHERE revoked_at IS NULL AND absolute_expires_at > now()
```

近 7 天连续 ≥3 天登录账号数（SQL 已在生产库验证，当前结果为 0）：
```sql
WITH daily AS (
  SELECT DISTINCT account_id, (last_seen_at AT TIME ZONE 'UTC')::date AS day
  FROM sessions WHERE last_seen_at >= now() - interval '7 days'
), runs AS (
  SELECT account_id, day - (row_number() OVER (PARTITION BY account_id ORDER BY day))::int AS grp
  FROM daily
)
SELECT count(*) FROM (SELECT account_id, grp FROM runs GROUP BY account_id, grp HAVING count(*) >= 3) t
```

全部会话累计活跃分钟与有会话账号数（avg 分母）：
```sql
SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(revoked_at, now()) - created_at)))::BIGINT / 60, 0) FROM sessions
SELECT count(DISTINCT account_id) FROM sessions
```
`avg_active_minutes = if denominator == 0 { 0 } else { total / denominator }`。

近 7 天每日平台消耗次数（与 login_trend 相同的 `query_as::<(NaiveDate, i64)>` 模式）：
```sql
SELECT (finalized_at AT TIME ZONE 'UTC')::date AS day, count(*) FROM platform_generation_usages
WHERE state = 'consumed' AND finalized_at >= now() - interval '7 days'
GROUP BY day ORDER BY day
```
结果 `Vec<DailyConsumed>` 构造进 `AdminDashboard`。

- [ ] **Step 4: 扩展 list_accounts 查询**

现有 SELECT（`admin_store.rs` line 127-139）在 `total_tokens` 子查询后追加两列：
```sql
(SELECT count(*) FROM platform_generation_usages u
 WHERE u.account_id = a.account_id AND u.state = 'consumed'),
(SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(s.revoked_at, now()) - s.created_at)))::BIGINT / 60, 0)
 FROM sessions s WHERE s.account_id = a.account_id)
```
`AccountRow` tuple 类型与 `From` 映射同步加两个 `i64`（`platform_consumed_usages`、`active_minutes`）。

- [ ] **Step 5: 扩展 list_audit_events 查询**

SELECT 加 `details` 列（`admin_store.rs` line 220）：
```sql
SELECT event_id, event_type, outcome, player_id, occurred_at, details FROM identity_audit_events
```
`AuditEventRow` tuple 加 `serde_json::Value`（sqlx 需要 Step 1 的 json feature + `sqlx::types::Json` 包装或直接 Value——以 sqlx 0.8.6 实际支持为准，若 Value 直接实现 Type 则直接用，否则用 `Json<Value>` 并解包）。`AdminAuditEvent` 构造加 `details`。

- [ ] **Step 6: 扩展 http/admin.rs 响应结构**

- `DashboardResponse` 加 `current_online`、`consecutive_3d_logins`、`total_active_minutes`、`avg_active_minutes`、`daily_consumed_7d: Vec<DailyConsumedResponse>`；新结构体：
```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DailyConsumedResponse {
    date: String,
    consumed: i64,
}
```
`dashboard` handler 的构造同步补齐（`date: daily.date.to_string()`，与 DailyLoginResponse 同模式）。
- `AdminAccountResponse` 加 `platform_consumed_usages: i64`、`active_minutes: i64`（From impl 同步）。
- `AdminAuditEventResponse` 加 `details: serde_json::Value`（From impl 同步）。

- [ ] **Step 7: 更新集成测试**

`tests/postgres_admin_store.rs`（按现有测试模式）：
- dashboard 测试：造数据覆盖新字段——一个账号有过期会话（`absolute_expires_at < now()`）且未撤销 → 不计入 current_online；一个账号有未过期未撤销会话 → 计入；连续 3 天 `last_seen_at`（昨天/前天/大前天）→ `consecutive_3d_logins` 计入 1；一条 `platform_generation_usages` consumed（`finalized_at` 今天）→ `daily_consumed_7d` 当天计数 1 且 `platform_consumed_usages` 有值；`total_active_minutes > 0`。
- list_audit_events 测试：注册产生的审计事件 `details` 为对象（JSONB），断言 `details` 字段透出。
- list_accounts 测试：断言 `platform_consumed_usages` / `active_minutes` 字段存在且正确。

- [ ] **Step 8: 全量验证 + 提交**

```bash
cargo fmt --check && cargo clippy --all-targets --all-features --locked -- -D warnings && cargo test --all-targets --all-features --locked
```
全绿后提交（mapflow-server 仓库）：
```bash
git add Cargo.toml Cargo.lock src/application/admin.rs src/adapters/postgres/admin_store.rs src/http/admin.rs tests/postgres_admin_store.rs
git commit -m "feat: 管理面板统计增强（当前在线/连续登录/停留时长/每人消耗）+ 审计 details 透出"
```

---

### Task 2: 后端审计写入客户端 IP

**Files:**
- Modify: `D:\mapflow-server\src\adapters\postgres\identity_store.rs`（register / create_session 签名 + INSERT SQL）
- Modify: `D:\mapflow-server\src\application\identity_service.rs`（RegisterIdentityCommand / LoginIdentityCommand + register / login 调用点）
- Modify: `D:\mapflow-server\src\http\auth.rs`（两处 command 构造加 with_client_ip）
- Test: `D:\mapflow-server\tests\identity_service_contract.rs` 或 `tests\postgres_identity_contract.rs`（以现有审计事件测试所在文件为准）

**Interfaces:**
- Consumes: Task 1 的 `AdminAuditEvent.details`（审计查询已透出 details；本任务写 details 内容）
- Produces: 注册/登录后审计事件 `details = {"client_ip": "x.x.x.x"}`；历史事件 details 保持 `{}`

- [ ] **Step 1: 写失败测试**

在现有审计事件断言测试处（先 grep `identity_audit_events` 找测试位置，`tests/` 下）添加：注册与登录后查询审计事件，断言 `details` 含 `client_ip` 字段且值非空。先跑确认失败（当前无 details 参数，编译失败或断言失败皆可）。

- [ ] **Step 2: store 层签名与 SQL**

`identity_store.rs`：
- `pub async fn register(&self, registration: AtomicRegistration, audit_details: &serde_json::Value)`，INSERT SQL：
```sql
INSERT INTO identity_audit_events (event_id, event_type, account_id, player_id, outcome, details) VALUES ($1, 'identity.registered', $2, $3, 'succeeded', $4)
```
bind：`.bind(sqlx::types::Json(audit_details))`（若 Task 1 验证了 Value 直接 bind 则用直接 bind）。
- `pub(crate) async fn create_session(&self, account_id: Uuid, session: &NewSessionRecord, audit_details: &serde_json::Value)`，INSERT SQL：
```sql
INSERT INTO identity_audit_events (event_id, event_type, account_id, outcome, details) VALUES ($1, 'identity.logged_in', $2, 'succeeded', $3)
```

- [ ] **Step 3: service 层透传**

`identity_service.rs`：
- `RegisterIdentityCommand` 加字段 `client_ip: Option<String>` 与 builder：
```rust
#[must_use]
pub fn with_client_ip(mut self, client_ip: impl Into<String>) -> Self {
    self.client_ip = Some(client_ip.into());
    self
}
```
- `LoginIdentityCommand` 加同样字段与 `with_client_ip`。
- `register` 方法开头构造 details（一次）：
```rust
let audit_details = command
    .client_ip
    .map(|ip| serde_json::json!({ "client_ip": ip }))
    .unwrap_or_else(|| serde_json::json!({}));
```
循环内调用改为 `self.inner.store.register(registration, &audit_details).await`。
- `login` 方法同样构造 `audit_details`，调用改为 `self.inner.store.create_session(stored.account_id, &session_record, &audit_details).await`。

- [ ] **Step 4: handler 传入 IP**

`auth.rs`：
- register handler（line 58 已有 `let client_ip = effective_client_ip(client, identity.trusted_proxy_ip, &headers);`）：command 构造链末尾加 `.with_client_ip(client_ip.to_string())`。
- login handler（line 94 已有 `let client_ip = ...`）：`LoginIdentityCommand::new(...)` 后加 `.with_client_ip(client_ip.to_string())`。

- [ ] **Step 5: 验证 + 提交**

`cargo fmt --check && cargo clippy --all-targets --all-features --locked -- -D warnings && cargo test --all-targets --all-features --locked` 全绿，提交：
```bash
git add src/adapters/postgres/identity_store.rs src/application/identity_service.rs src/http/auth.rs tests/
git commit -m "feat: 注册/登录审计事件记录客户端 IP"
```

---

### Task 3: 前端（类型同步 + 概览卡片/图 + 账号列 + 审计映射）

**Files:**
- Modify: `D:\MapFlow-publish\src\features\admin\types.ts`
- Modify: `D:\MapFlow-publish\src\features\admin\OverviewTab.tsx`
- Modify: `D:\MapFlow-publish\src\features\admin\AccountsTab.tsx`
- Modify: `D:\MapFlow-publish\src\features\admin\AuditLogTab.tsx`
- Test: `D:\MapFlow-publish\src\features\admin\AdminPanel.test.tsx`（及受影响的 adminClient.test.ts）

**Interfaces:**
- Consumes: Task 1 后端响应字段（camelCase 见 Task 1 Interfaces）
- Produces: 前端编译通过 + 测试全绿；Task 4 需要本任务完成后 `git rev-parse HEAD` 作为 CI pin

- [ ] **Step 1: types.ts 同步**

```ts
export interface AdminDashboard {
  // 现有字段保留
  currentOnline: number;
  consecutive3dLogins: number;
  totalActiveMinutes: number;
  avgActiveMinutes: number;
  dailyConsumed7d: { date: string; consumed: number }[];
}
```
`AdminAccount` 加 `platformConsumedUsages: number; activeMinutes: number;`；`AdminAuditEvent` 加 `details: Record<string, unknown>;`。

- [ ] **Step 2: OverviewTab 指标卡片 + 消耗图**

先读 `OverviewTab.tsx` 了解现有卡片与柱状图实现，然后：
- 新增 4 张指标卡片（沿用现有卡片样式/布局模式）：当前在线（currentOnline）、连续 3 天在线（consecutive3dLogins）、总停留时长、人均停留时长（分钟数经 `formatMinutes` 格式化）。
- 本地 helper（与本仓库「每文件本地副本」惯例一致，不跨文件导出）：
```ts
function formatMinutes(minutes: number): string {
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}
```
- 登录趋势柱状图旁新增「每日消耗次数」柱状图（数据 `dailyConsumed7d`，`consumed` 为数值；复用现有柱状图的实现模式，若现有实现是内联 div 高度方案则同样处理；空数组显示空态文案）。

- [ ] **Step 3: AccountsTab 新列**

表格加两列「平台消耗次数」（`platformConsumedUsages`）与「停留时长」（`activeMinutes` 经 `formatMinutes`）。沿用现有列定义/表头模式（本地 helper 副本，不 import OverviewTab 的）。

- [ ] **Step 4: AuditLogTab 事件可读化**

先读 `AuditLogTab.tsx`（表格列、筛选下拉、分页结构），然后：
- 文件内表驱动映射（本地常量，不新建文件）：
```ts
const EVENT_META: Record<string, { title: string; description: string }> = {
  'identity.registered': { title: '注册账号', description: '新用户通过邀请码注册' },
  'identity.logged_in': { title: '用户登录', description: '用户登录系统' },
};
const OUTCOME_META: Record<string, string> = {
  succeeded: '成功',
  rejected: '拒绝',
  failed: '失败',
};
```
未知 eventType 回退：标题显示原字符串、description 为空。未知 outcome 回退原字符串。
- 事件列渲染：标题 + 描述（副文字样式）；结果列：映射文本 + 颜色（成功绿 / 拒绝黄 / 失败红，沿用主题色 token）。
- 新列「IP」：`event.details?.clientIp`（注意 details JSONB 键为 snake_case `client_ip`——`event.details?.['client_ip']`）非空字符串时显示，否则显示「—」。
- 筛选下拉：value 保持 eventType 原值，label 用 `EVENT_META[type]?.title ?? type`（新增「全部事件」保留现有行为）。

- [ ] **Step 5: 更新测试**

`AdminPanel.test.tsx`（及 adminClient.test.ts）：
- 所有 mock dashboard/account/audit 数据补新字段（编译期强制）。
- 新增断言：概览渲染「当前在线」「连续 3 天在线」数值；账号表渲染消耗次数与停留时长列；审计日志渲染「注册账号」「用户登录」中文标题与 IP 值、outcome 中文。

- [ ] **Step 6: 验证 + 提交**

```bash
npm run typecheck && npm test && npm run build
```
全绿后提交（MapFlow-publish 仓库）：
```bash
git add src/features/admin/
git commit -m "feat: 管理面板 v2（概览新指标/每日消耗图/账号消耗列/审计事件中文映射）"
git push
```
push 后记录 `git rev-parse HEAD` 输出（Task 4 的 CI pin 用）。

---

### Task 4: 自动部署（服务器脚本 + 密钥 + CI job + 端到端验证）

**Files:**
- Create（服务器）: `/opt/mapflow/switch.sh`
- Modify（服务器）: `/root/.ssh/authorized_keys`（追加部署公钥一行）
- Modify: `D:\mapflow-server\.github\workflows\ci.yml`（deploy-prod job + MAPFLOW_COMMIT 更新）
- GitHub secrets: `DEPLOY_HOST`、`DEPLOY_SSH_KEY`

**Interfaces:**
- Consumes: Task 3 的前端提交 SHA（ci.yml 的 `MAPFLOW_COMMIT`）；现有 switch 脚本逻辑（`C:\Users\Administrator\AppData\Local\Temp\mapflow-switch.sh` 为参照，参数化改造）
- Produces: push main 后 CI 自动构建 + 部署 + health 回滚

- [ ] **Step 1: 生成部署密钥并配置服务器**

本地生成专用部署密钥（不入 git，仅用于本任务）：
```bash
ssh-keygen -t ed25519 -f /tmp/deploy_key_mapflow -N "" -C "deploy-key-mapflow"
```
将公钥（`/tmp/deploy_key_mapflow.pub` 内容，**可展示**）追加到服务器 root 的 `~/.ssh/authorized_keys`（独立一行）。验证：
```bash
ssh -i /tmp/deploy_key_mapflow root@47.114.98.109 "echo ok"
```
服务器建目录：
```bash
mkdir -p /opt/mapflow/artifacts
```

- [ ] **Step 2: 固化服务器部署脚本**

写 `/opt/mapflow/switch.sh`（参数：归档文件名，如 `mapflow-server-abc123.tar.gz`；逻辑参照现有 Temp 脚本改造）：

```bash
#!/bin/bash
set -eu
ARCHIVE="$1"
SHA="$(printf '%s' "$ARCHIVE" | sed -E 's/^mapflow-server-(.+)\.tar\.gz$/\1/')"
NEW="mapflow-server:canary-$SHA"
DIR=/opt/mapflow/artifacts

build_run_args() {
  python3 - "$NEW" <<'PY'
import json, subprocess, sys
new = sys.argv[1]
raw = subprocess.run(
    ['docker', 'inspect', 'mapflow-app', '--format', '{{json .Config.Env}}'],
    capture_output=True, text=True, check=True,
).stdout
envs = [e for e in json.loads(raw) if e.startswith('MAPFLOW_') and 'TURNSTILE' not in e]
if not any(e.startswith('MAPFLOW_INVITATION_POOL_FILE=') for e in envs):
    envs.append('MAPFLOW_INVITATION_POOL_FILE=/run/secrets/first-pilot-invitations')
if not any(e.startswith('MAPFLOW_ADMIN_USERNAME_FILE=') for e in envs):
    envs.append('MAPFLOW_ADMIN_USERNAME_FILE=/run/secrets/admin-username')
args = [
    'docker', 'run', '-d',
    '--name', 'mapflow-app',
    '--restart', 'unless-stopped',
    '--network', 'mapflow-identity',
    '--memory', '512m',
    '--memory-reservation', '256m',
    '--cpus', '0.75',
    '--pids-limit', '128',
    '--read-only',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges:true',
    '--user', '10001:10001',
    '-p', '127.0.0.1:18082:8080',
    '-p', '127.0.0.1:18083:8081',
]
for e in envs:
    args += ['-e', e]
for src, dst in [
    ('/opt/mapflow/identity/secrets/identity-secrets.json', '/run/secrets/identity-secrets.json'),
    ('/opt/mapflow/identity/secrets/deepseek-platform-api-key', '/run/secrets/deepseek-platform-api-key'),
    ('/opt/mapflow/identity/secrets/database.url', '/run/secrets/database.url'),
    ('/opt/mapflow/identity/secrets/first-pilot-invitations', '/run/secrets/first-pilot-invitations'),
    ('/opt/mapflow/identity/secrets/admin-username', '/run/secrets/admin-username'),
]:
    args += ['-v', f'{src}:{dst}:ro']
args.append(new)
print(' '.join(args))
PY
}

set -x
docker load -i "$DIR/$ARCHIVE"
OLD_TAG="$(docker inspect mapflow-app --format '{{.Config.Image}}' | sed -E 's/.*canary-([0-9a-f]+).*/\1/')"
RUN_ARGS="$(build_run_args)"
docker ps -aq --filter "name=mapflow-app-previous-" | xargs -r docker rm -f
docker stop mapflow-app
docker rename mapflow-app "mapflow-app-previous-$OLD_TAG"
eval "$RUN_ARGS"

attempt=0
until curl --fail --silent http://127.0.0.1:18082/health/ready >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "health check timed out, rolling back"
    docker rm -f mapflow-app
    docker rename "mapflow-app-previous-$OLD_TAG" mapflow-app
    docker start mapflow-app
    exit 1
  fi
  sleep 1
done
echo "mapflow-app switched to $NEW"
```
注意：`OLD_TAG` 提取用容器 Image ID 无意义——改为部署前先 `docker inspect mapflow-app --format '{{.Config.Image}}' | sed -E 's/.*canary-([0-9a-f]+).*/\1/'`（Config.Image 保留 tag 字符串）。清理旧 previous 容器时排除本次 rename 的容器。`chmod +x /opt/mapflow/switch.sh` 后先在服务器手动测试一次（load 已存在的归档——若无归档，用当前运行镜像的 tag 模拟或跳过，直接进入 Step 4 由 CI 触发首次真实验证）。

- [ ] **Step 3: 配置 GitHub secrets 并加 CI job**

私钥进 GitHub secret（尝试 `gh secret set`，若 gh 未登录则给出手动指引：仓库 Settings → Secrets and variables → Actions → New repository secret）：
```bash
gh secret set DEPLOY_HOST --body "47.114.98.109" --repo rongyan-123/mapflow-server
gh secret set DEPLOY_SSH_KEY --body "$(cat /tmp/deploy_key_mapflow)" --repo rongyan-123/mapflow-server
```
`ci.yml` 末尾追加（在 `linux-canary-artifact` job 之后、同缩进级别）：
```yaml
  deploy-prod:
    needs: linux-canary-artifact
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-24.04
    steps:
      - name: Download canary artifact
        uses: actions/download-artifact@6b208ae046db98c579e8a3aa621ab581f575935a # v5.1.0
        with:
          name: mapflow-server-canary-${{ github.sha }}
          path: artifact/

      - name: Deploy to production server
        env:
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
          DEPLOY_SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          ARCHIVE: mapflow-server-${{ github.sha }}.tar.gz
        run: |
          set -eu
          install -d -m 700 "$HOME/.ssh"
          install -m 600 /dev/null "$HOME/.ssh/deploy_key"
          printf '%s\n' "$DEPLOY_SSH_KEY" > "$HOME/.ssh/deploy_key"
          ssh-keyscan -t ed25519 "$DEPLOY_HOST" > "$HOME/.ssh/known_hosts"
          scp -i "$HOME/.ssh/deploy_key" -o StrictHostKeyChecking=yes "artifact/$ARCHIVE" "root@$DEPLOY_HOST:/opt/mapflow/artifacts/"
          ssh -i "$HOME/.ssh/deploy_key" -o StrictHostKeyChecking=yes "root@$DEPLOY_HOST" "bash /opt/mapflow/switch.sh $ARCHIVE"
```
同时把 `MAPFLOW_COMMIT` 更新为 Task 3 记录的前端 SHA（`git rev-parse HEAD` 完整 40 位）。

- [ ] **Step 4: push 触发首次自动部署 + 端到端验证**

```bash
cd D:/mapflow-server && git add .github/workflows/ci.yml && git commit -m "ci: 构建完成后自动部署到生产服务器" && git push
```
等待 CI 构建 + deploy job 完成（GitHub Actions 页面确认，或轮询 `gh run watch`）。部署完成后验证（服务器上）：
```bash
docker ps --format '{{.Names}}\t{{.Image}}' | grep mapflow-app
curl --fail --silent -H 'Host: xxian.fun' http://127.0.0.1:18082/health/ready
```
管理接口端到端（登录拿 cookie → session → dashboard 断言新字段 → audit-events 断言 details 含 client_ip）：
```bash
# 登录（沿用已重置的 mapflowdemo 密码；从 Set-Cookie 提取 __Host-mapflow_session 后手动发 Cookie 头，Secure cookie 对 http 不回传）
curl -s -D /tmp/h -H 'Host: xxian.fun' -H 'Origin: https://xxian.fun' -H 'content-type: application/json' \
  -d '{"username":"mapflowdemo","password":"hjx2637754948"}' http://127.0.0.1:18082/api/auth/login -o /dev/null
TOK=$(sed -n 's/^set-cookie: \(__Host-mapflow_session=[^;]*\).*/\1/p' /tmp/h)
curl -s -H 'Host: xxian.fun' -H "Cookie: $TOK" http://127.0.0.1:18082/api/admin/dashboard \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print([k for k in ("currentOnline","consecutive3dLogins","totalActiveMinutes","avgActiveMinutes","dailyConsumed7d") if k in d])'
curl -s -H 'Host: xxian.fun' -H "Cookie: $TOK" 'http://127.0.0.1:18082/api/admin/audit-events?limit=5' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print([(e["eventType"], e.get("details", {}).get("client_ip")) for e in d["events"]])'
```
断言：dashboard 5 个新键都存在；audit-events 最新事件（本次验证登录产生）details.client_ip 非空。

- [ ] **Step 5: 用户验收引导**

告知用户：以后改动 = push 后端仓库（前端改动则先 push 前端、把 ci.yml 的 MAPFLOW_COMMIT 更新为新 SHA 再 push 后端）→ 等待 CI 自动部署。浏览器打开 https://xxian.fun 登录验收：概览新卡片与新图、账号列表消耗/停留列、审计日志中文事件与 IP 列。

---

## 自检清单（Self-Review）

- [ ] Spec A.1-A.5（details 透出 + IP 写入）→ Task 1 Step 5/6 + Task 2 全部
- [ ] Spec A.5（AuditLogTab 映射/结果/IP 列）→ Task 3 Step 4
- [ ] Spec B.6-B.9（dashboard 5 新字段 + accounts 2 新字段 + HTTP + 测试）→ Task 1
- [ ] Spec B.10-B.13（前端类型/概览/账号列/测试）→ Task 3
- [ ] Spec C.14-C.18（密钥/switch.sh/CI job/secrets/验证）→ Task 4
- [ ] 类型一致性：`consecutive_3d_logins`（Rust snake）→ `consecutive3dLogins`（JSON camel）→ `consecutive3dLogins`（TS）三处一致；`details` 键 `client_ip` 前端用 `details['client_ip']` 读取
- [ ] 无占位符：所有 SQL/签名/字段名已在任务中给出
