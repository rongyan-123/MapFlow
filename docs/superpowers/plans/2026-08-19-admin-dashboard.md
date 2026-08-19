# 管理员面板实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 MapFlow 增加管理员面板：后端 `/api/admin/*`（dashboard/accounts/invitations/audit-events + suspend/revoke），前端 admin 视图（4 个 Tab）。

**Architecture:** 后端复用现有会话认证（`require_current_identity`）+ 新增管理员检查（secrets 文件配置管理员用户名）；数据全部实时 SQL 聚合，不新增表；前端沿用 state 切换视图模式（`AppView`），无路由库。

**Tech Stack:** Rust/Axum + sqlx/PgPool（后端）；React + React Query + vitest（前端）。

**Spec:** `docs/superpowers/specs/2026-08-19-admin-dashboard-design.md`

## Global Constraints

- 邀请码明文绝不返回给 API（只返回状态与关联信息）
- 非管理员访问 admin 接口返回 403；错误响应不泄露管理员用户名
- 管理员用户名来自服务器 secrets 文件（单行文本，trim 后比较 `username_display`，大小写敏感）
- 统计用实时 SQL 聚合，不建物化表
- 前后端 commit message 用中文
- 后端测试用 `#[sqlx::test(migrations = "./migrations")]` 集成测试（CI 有 postgres service）
- 前端测试：vitest + Testing Library，`import.meta.env` 不依赖

---

### Task 1: 后端配置与管理员状态

**Files:**
- Modify: `D:\mapflow-server\src\config.rs`（`IdentityRuntimeConfig` 结构体 27-38 行；`load_identity_config` 148-161 行；测试 265-298 行）
- Modify: `D:\mapflow-server\src\error.rs`（`ServiceError` 枚举 21-53 行 + `status()` 匹配 57-80 行）
- Modify: `D:\mapflow-server\src\app.rs`（`IdentityHttpState` 33-42 行；`build_public_router` 206-287 行）
- Modify: `D:\mapflow-server\src\server.rs`（组装 state 处，约 30-45 行）

**Interfaces:**
- Produces: `IdentityRuntimeConfig.admin_username_file: Option<PathBuf>`
- Produces: `ServiceError::Forbidden`（status 403）
- Produces: `IdentityHttpState.admin_username: Option<Arc<str>>`（从文件读取，trim 后）

- [ ] **Step 1: 写失败测试 — config 加载 admin_username_file**

在 `config.rs` 测试模块加：
```rust
#[test]
fn admin_username_file_is_optional_path() {
    let config = CanaryConfig::load(&identity_environment(vec![(
        "MAPFLOW_ADMIN_USERNAME_FILE",
        "/secrets/admin-username".to_owned(),
    )]))
    .expect("config loads");

    let identity = config.identity.expect("identity configured");
    assert_eq!(
        identity.admin_username_file,
        Some(PathBuf::from("/secrets/admin-username"))
    );
}

#[test]
fn empty_admin_username_file_variable_is_rejected() {
    let config = CanaryConfig::load(&identity_environment(vec![(
        "MAPFLOW_ADMIN_USERNAME_FILE",
        String::new(),
    )]));
    assert!(config.is_err());
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cargo test --manifest-path D:\mapflow-server\Cargo.toml config 2>&1 | tail -5`
Expected: 编译错误（`admin_username_file` 字段不存在）

- [ ] **Step 3: 实现配置字段**

`config.rs`：
```rust
pub struct IdentityRuntimeConfig {
    // ...现有字段
    pub invitation_pool_file: Option<PathBuf>,
    pub turnstile_secret_key_file: Option<PathBuf>,
    pub admin_username_file: Option<PathBuf>,  // 新增
}
```
`load_identity_config` 末尾加：
```rust
let admin_username_file =
    optional_non_empty_path(environment, "MAPFLOW_ADMIN_USERNAME_FILE")?;
Ok(Some(IdentityRuntimeConfig {
    // ...现有字段
    turnstile_secret_key_file,
    admin_username_file,
}))
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cargo test --manifest-path D:\mapflow-server\Cargo.toml config 2>&1 | tail -5`
Expected: PASS

- [ ] **Step 5: 加 ServiceError::Forbidden**

`error.rs`：枚举加 `Forbidden,`（放在 `NotFound,` 后），`status()` 匹配加：
```rust
Self::Forbidden => StatusCode::FORBIDDEN,
```

- [ ] **Step 6: 实现 IdentityHttpState.admin_username**

`app.rs` `IdentityHttpState` 加字段 `pub(crate) admin_username: Option<Arc<str>>`；`secure()` 构造时置 `None`；加 builder：
```rust
#[must_use]
pub fn with_admin_username(mut self, admin_username: Arc<str>) -> Self {
    self.admin_username = Some(admin_username);
    self
}
```

`server.rs`：找到 `IdentityHttpState::secure(...)` 组装处（约 30-45 行），在其后加：
```rust
if let Some(admin_file) = config.identity.admin_username_file.as_ref() {
    let raw = tokio::fs::read_to_string(admin_file).await?;
    let admin_username: Arc<str> = Arc::from(raw.trim());
    identity_state = identity_state.with_admin_username(admin_username);
}
```
（变量名以 server.rs 实际命名为准）

- [ ] **Step 7: 全量测试 + 提交**

Run: `cargo test --manifest-path D:\mapflow-server\Cargo.toml --all-targets 2>&1 | tail -5`
Expected: PASS
```bash
cd /d/mapflow-server && git add -A && git commit -m "feat: 管理员用户名配置与 Forbidden 错误
- config: MAPFLOW_ADMIN_USERNAME_FILE 可选路径
- error: ServiceError::Forbidden 映射 403
- state: IdentityHttpState.admin_username 从 secrets 文件加载"
```

---

### Task 2: AdminStore trait + PostgresAdminStore

**Files:**
- Create: `D:\mapflow-server\src\application\admin.rs`（trait + 数据类型）
- Create: `D:\mapflow-server\src\adapters\postgres\admin_store.rs`（PostgresAdminStore 实现）
- Create: `D:\mapflow-server\tests\postgres_admin_store.rs`（集成测试）
- Modify: `D:\mapflow-server\src\lib.rs`（模块声明 + 导出）
- Modify: `D:\mapflow-server\src\adapters\postgres\mod.rs`（模块声明）

**Interfaces:**
- Consumes: 数据库表（0001/0003/0005/0006 迁移）：`accounts`、`invite_codes`、`invitation_claims`、`sessions`、`identity_audit_events`、`tree_generation_sessions`（含 `funding_mode`）、`tree_generation_plans`（token 列）、`platform_generation_usages`（`state` ∈ reserved/consumed/released）
- Produces:
```rust
// application/admin.rs
pub struct AdminDashboard {
    pub registered_accounts: i64,
    pub available_invites: i64,
    pub redeemed_invites: i64,
    pub revoked_invites: i64,
    pub active_sessions: i64,
    pub platform_consumed_usages: i64,
    pub platform_consumed_tokens: i64,
    pub login_trend_7d: Vec<DailyLogin>,
}
pub struct DailyLogin { pub date: NaiveDate, pub active_accounts: i64 }
pub struct AdminAccount {
    pub account_id: Uuid, pub username: String, pub status: String,
    pub registered_at: DateTime<Utc>, pub last_seen_at: Option<DateTime<Utc>>,
    pub byok_sessions: i64, pub platform_sessions: i64, pub total_tokens: i64,
}
pub struct AdminInvitation {
    pub invite_id: Uuid, pub status: String, pub created_at: DateTime<Utc>,
    pub claimed_ip: Option<IpAddr>, pub claimed_at: Option<DateTime<Utc>>,
    pub redeemed_by: Option<String>, pub redeemed_at: Option<DateTime<Utc>>,
}
pub struct AdminAuditEvent {
    pub event_id: Uuid, pub event_type: String, pub outcome: String,
    pub player_id: Option<String>, pub occurred_at: DateTime<Utc>,
}
pub struct AuditEventFilter {
    pub event_type: Option<String>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}
pub enum AdminStoreError { StorageUnavailable }
pub trait AdminStore: Send + Sync {
    async fn dashboard_summary(&self) -> Result<AdminDashboard, AdminStoreError>;
    async fn list_accounts(&self) -> Result<Vec<AdminAccount>, AdminStoreError>;
    async fn list_invitations(&self) -> Result<Vec<AdminInvitation>, AdminStoreError>;
    async fn list_audit_events(&self, filter: &AuditEventFilter, limit: i64, offset: i64)
        -> Result<Vec<AdminAuditEvent>, AdminStoreError>;
    async fn suspend_account(&self, account_id: Uuid) -> Result<bool, AdminStoreError>; // false=账号不存在
    async fn revoke_invitation(&self, invite_id: Uuid) -> Result<InvitationRevokeOutcome, AdminStoreError>;
}
pub enum InvitationRevokeOutcome { Revoked, AlreadyRedeemed, AlreadyRevoked, NotFound }
```

- [ ] **Step 1: 写失败测试 — PostgresAdminStore 集成测试**

`tests/postgres_admin_store.rs`（参考 `tests/postgres_platform_generation_store.rs` 的种子模式）：
```rust
use mapflow_server::{AdminStore, PostgresAdminStore};
use sqlx::PgPool;

async fn seed_account(pool: &PgPool, username: &str) -> uuid::Uuid {
    let account_id = uuid::Uuid::new_v4();
    let player_id = format!("MF-{}-{}-{}", "AAAA", "BBBB", "CCCC");
    sqlx::query(
        "INSERT INTO accounts (account_id, player_id, username_display, username_key) VALUES ($1, $2, $3, $4)",
    )
    .bind(account_id)
    .bind(&player_id)
    .bind(username)
    .bind(username.to_ascii_lowercase())
    .execute(pool)
    .await
    .expect("seed account");
    account_id
}

#[sqlx::test(migrations = "./migrations")]
async fn dashboard_aggregates_registrations_invites_and_sessions(pool: PgPool) {
    let store = PostgresAdminStore::new(pool.clone());
    seed_account(&pool, "adminuser").await;
    let summary = store.dashboard_summary().await.expect("dashboard");
    assert_eq!(summary.registered_accounts, 1);
    assert_eq!(summary.available_invites + summary.redeemed_invites, 0);
}

#[sqlx::test(migrations = "./migrations")]
async fn suspend_account_revokes_sessions(pool: PgPool) {
    let store = PostgresAdminStore::new(pool.clone());
    let account_id = seed_account(&pool, "suspendeduser").await;
    // 建一个会话
    sqlx::query(
        "INSERT INTO sessions (session_id, account_id, token_digest, csrf_digest, idle_expires_at, absolute_expires_at)
         VALUES ($1, $2, $3, $4, now() + interval '1 hour', now() + interval '1 day')",
    )
    .bind(uuid::Uuid::new_v4()).bind(account_id)
    .bind([0u8; 32].as_slice()).bind([0u8; 32].as_slice())
    .execute(&pool).await.expect("seed session");

    let suspended = store.suspend_account(account_id).await.expect("suspend");
    assert!(suspended);
    let row: (String,) = sqlx::query_as("SELECT status FROM accounts WHERE account_id = $1")
        .bind(account_id).fetch_one(&pool).await.expect("account");
    assert_eq!(row.0, "suspended");
    let active: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM sessions WHERE account_id = $1 AND revoked_at IS NULL",
    ).bind(account_id).fetch_one(&pool).await.expect("count");
    assert_eq!(active, 0);
}

#[sqlx::test(migrations = "./migrations")]
async fn revoke_invitation_marks_revoked_and_rejects_redeemed(pool: PgPool) {
    // 插入 batch + available 码 → revoke 成功
    // 插入 redeemed 码（需 account + redeem 字段）→ AlreadyRedeemed
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cargo test --manifest-path D:\mapflow-server\Cargo.toml --test postgres_admin_store 2>&1 | tail -5`
Expected: 编译错误（`mapflow_server::PostgresAdminStore` 不存在）

- [ ] **Step 3: 实现 trait 与 store**

`src/application/admin.rs`：定义上述数据类型与 trait（参考 `invitation_claim.rs` 的错误文档注释风格）。`AdminStoreError` 从 `sqlx::Error` 映射（`map_err(|_| AdminStoreError::StorageUnavailable)`）。

`src/adapters/postgres/admin_store.rs`：
```rust
#[derive(Clone)]
pub struct PostgresAdminStore { pool: PgPool }

impl PostgresAdminStore {
    pub const fn new(pool: PgPool) -> Self { Self { pool } }
}

#[async_trait]  // 若项目用 native async fn in trait 则不用宏；trait 定义处用 async fn
impl AdminStore for PostgresAdminStore {
    async fn dashboard_summary(&self) -> Result<AdminDashboard, AdminStoreError> {
        let registered_accounts: i64 = sqlx::query_scalar("SELECT count(*) FROM accounts")
            .fetch_one(&self.pool).await.map_err(|_| AdminStoreError::StorageUnavailable)?;
        // 并行查询其他指标（sqlx::query_as 或 query_scalar）：
        // - invite_codes: SELECT status, count(*) GROUP BY status → available/redeemed/revoked
        // - sessions: SELECT count(*) WHERE revoked_at IS NULL
        // - platform_generation_usages: SELECT count(*) WHERE state = 'consumed'
        // - platform tokens: JOIN tree_generation_plans 取每 session 最新 version 的 input+output：
        //   SELECT COALESCE(SUM(p.input_tokens + p.output_tokens), 0)
        //   FROM platform_generation_usages u
        //   JOIN tree_generation_plans p ON p.generation_session_id = u.generation_session_id
        //   AND p.version = (SELECT max(version) FROM tree_generation_plans p2 WHERE p2.generation_session_id = u.generation_session_id)
        //   WHERE u.state = 'consumed'
        // - login_trend_7d:
        //   SELECT (last_seen_at AT TIME ZONE 'UTC')::date AS day, count(DISTINCT account_id)
        //   FROM sessions WHERE last_seen_at >= now() - interval '7 days'
        //   GROUP BY day ORDER BY day
        todo!()  // 实现各查询
    }

    async fn list_accounts(&self) -> Result<Vec<AdminAccount>, AdminStoreError> {
        // 单条查询（LATERAL 或子查询）：
        // SELECT a.account_id, a.username_display, a.status, a.activated_at,
        //   (SELECT max(s.last_seen_at) FROM sessions s WHERE s.account_id = a.account_id),
        //   (SELECT count(*) FROM tree_generation_sessions g WHERE g.account_id = a.account_id AND g.funding_mode = 'byok'),
        //   (SELECT count(*) FROM tree_generation_sessions g WHERE g.account_id = a.account_id AND g.funding_mode = 'platform'),
        //   (SELECT COALESCE(SUM(p.input_tokens + p.output_tokens + p.cache_hit_input_tokens + p.cache_miss_input_tokens), 0)
        //    FROM tree_generation_plans p
        //    JOIN tree_generation_sessions g ON p.generation_session_id = g.generation_session_id
        //    WHERE g.account_id = a.account_id)
        // FROM accounts a ORDER BY a.activated_at DESC
        todo!()
    }

    async fn list_invitations(&self) -> Result<Vec<AdminInvitation>, AdminStoreError> {
        // SELECT i.invite_id, i.status, i.created_at, c.claimed_by_ip, c.claimed_at,
        //        a.username_display, i.redeemed_at
        // FROM invite_codes i
        // LEFT JOIN invitation_claims c ON c.invite_id = i.invite_id
        // LEFT JOIN accounts a ON a.account_id = i.redeemed_by_account_id
        // ORDER BY i.created_at
        todo!()
    }

    async fn list_audit_events(&self, filter: &AuditEventFilter, limit: i64, offset: i64)
        -> Result<Vec<AdminAuditEvent>, AdminStoreError> {
        // 动态 WHERE：event_type = $1（可选）、occurred_at >= $2（可选）、occurred_at <= $3（可选）
        // ORDER BY occurred_at DESC LIMIT $n OFFSET $m
        todo!()
    }

    async fn suspend_account(&self, account_id: Uuid) -> Result<bool, AdminStoreError> {
        // BEGIN;
        // UPDATE accounts SET status = 'suspended', updated_at = now() WHERE account_id = $1 AND status = 'active';
        // 若 affected == 0 → 检查账号是否存在（SELECT 1）→ 不存在返回 false，已 suspended 也返回 true（幂等）
        // UPDATE sessions SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL;
        // INSERT INTO identity_audit_events (event_id, event_type, account_id, outcome)
        //   VALUES ($1, 'admin.account_suspended', $2, 'succeeded');
        // COMMIT;
        todo!()
    }

    async fn revoke_invitation(&self, invite_id: Uuid) -> Result<InvitationRevokeOutcome, AdminStoreError> {
        // UPDATE invite_codes SET status = 'revoked', revoked_at = now()
        //   WHERE invite_id = $1 AND status = 'available' RETURNING invite_id
        // affected == 0 → 查当前状态区分 AlreadyRedeemed / AlreadyRevoked / NotFound
        // 成功则 INSERT 审计事件 'admin.invite_revoked'
        todo!()
    }
}
```
（sqlx 动态过滤：`list_audit_events` 用 `QueryBuilder`，参考项目内是否有先例；没有就拼条件字符串，参数用 `$1/$2/$3` 按需绑定）

- [ ] **Step 4: 运行测试确认通过**

Run: `cargo test --manifest-path D:\mapflow-server\Cargo.toml --test postgres_admin_store 2>&1 | tail -5`
Expected: PASS（需要本地 postgres：`DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres` 或 CI 环境；本地若没有 postgres 用 `docker run -d --name pg-test -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine`）

- [ ] **Step 5: 注册模块 + 全量测试 + 提交**

`lib.rs` 与 `adapters/postgres/mod.rs` 加 `pub mod admin;`（路径按项目惯例）。
```bash
cd /d/mapflow-server && git add -A && git commit -m "feat: AdminStore 聚合查询与封禁/作废操作
- dashboard: 注册/邀请码/会话/平台额度消耗/7日登录趋势
- accounts: 用户列表+生成用量+token
- invitations: 邀请码状态+领取兑换信息
- audit-events: 按类型与时间过滤分页
- suspend/revoke: 状态变更+会话吊销+审计写入"
```

---

### Task 3: admin HTTP handlers + 路由注册

**Files:**
- Create: `D:\mapflow-server\src\http\admin.rs`
- Modify: `D:\mapflow-server\src\http\mod.rs`（模块声明）
- Modify: `D:\mapflow-server\src\app.rs`（`build_public_router` 注册路由；`IdentityHttpState` 需要 `admin_store: Option<Arc<PostgresAdminStore>>` 或单独 state）
- Modify: `D:\mapflow-server\src\server.rs`（组装 admin store）
- Create: `D:\mapflow-server\tests\admin_http.rs`（HTTP 集成测试，参考 `registration_http.rs` 的启动模式）

**Interfaces:**
- Consumes: `require_current_identity`（auth.rs:124）、`IdentityHttpState.admin_username`、`AdminStore`
- Produces: 路由 `/api/admin/dashboard`、`/api/admin/accounts`、`/api/admin/invitations`、`/api/admin/audit-events`、`/api/admin/accounts/{account_id}/suspend`、`/api/admin/invitations/{invite_id}/revoke`

- [ ] **Step 1: 写失败测试 — admin_http 集成测试**

`tests/admin_http.rs`（参考 `tests/registration_http.rs` 如何启动双监听服务器 + 用 reqwest 或 hyper 调用）。核心断言：
1. 未登录访问 `/api/admin/dashboard` → 401
2. 非管理员登录后访问 → 403
3. 管理员登录后访问 dashboard → 200 且 `registeredAccounts` 存在
4. suspend 接口：管理员 POST → 204；再查 `/api/admin/accounts` 确认 status=suspended
5. revoke：管理员 POST 一个 available 邀请码 → 204；再 revoke 已 redeem 的码 → 409

启动辅助：参考 `tests/registration_http.rs` 的 `spawn_server`（需要 `MAPFLOW_ADMIN_USERNAME_FILE` 指向临时文件，内容 `adminuser`；种子管理员账号 username=adminuser）。

- [ ] **Step 2: 运行测试确认失败**

Expected: 编译错误（`mapflow_server::http::admin` 不存在 / 路由 404）

- [ ] **Step 3: 实现 http/admin.rs**

```rust
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::response::Response;
use serde::{Deserialize, Serialize};
use crate::app::PublicAppState;
use crate::{AdminStore, AdminStoreError, ServiceError};
use super::auth::require_current_identity;

fn require_admin(
    state: &PublicAppState,
    headers: &HeaderMap,
) -> Result<crate::CurrentIdentity, ServiceError> {
    let current = futures::executor::block_on(require_current_identity(state, headers))
        .map_err(|_| ServiceError::Unauthenticated)?;  // 注意：实际是 async，见 Step 4 说明
    let identity = state.identity.as_ref().ok_or(ServiceError::NotFound)?;
    let Some(admin_username) = identity.admin_username.as_deref() else {
        return Err(ServiceError::Forbidden);
    };
    if current.username() != admin_username {
        return Err(ServiceError::Forbidden);
    }
    Ok(current)
}
```
（Step 4 说明：handler 本身是 async，直接 `require_current_identity(state, &headers).await?` 即可，无需 block_on——上面的 `require_admin` 应为 async fn）

handlers（每个都走 `require_admin`）：
```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DashboardResponse {
    registered_accounts: i64,
    available_invites: i64,
    redeemed_invites: i64,
    revoked_invites: i64,
    active_sessions: i64,
    platform_consumed_usages: i64,
    platform_consumed_tokens: i64,
    login_trend_7d: Vec<DailyLoginResponse>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DailyLoginResponse { date: String, active_accounts: i64 }

pub(crate) async fn dashboard(State(state): State<PublicAppState>, headers: HeaderMap)
    -> Result<Json<DashboardResponse>, ServiceError> { ... }

pub(crate) async fn accounts(State(state): State<PublicAppState>, headers: HeaderMap)
    -> Result<Json<AccountsResponse>, ServiceError> { ... }

pub(crate) async fn invitations(State(state): State<PublicAppState>, headers: HeaderMap)
    -> Result<Json<InvitationsResponse>, ServiceError> { ... }

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct AuditEventsQuery {
    event_type: Option<String>,
    from: Option<String>,  // RFC3339
    to: Option<String>,
    limit: Option<i64>,    // 默认 50，上限 200
    offset: Option<i64>,   // 默认 0
}

pub(crate) async fn audit_events(State(state): State<PublicAppState>, headers: HeaderMap,
    Query(query): Query<AuditEventsQuery>)
    -> Result<Json<AuditEventsResponse>, ServiceError> { ... }

pub(crate) async fn suspend_account(State(state): State<PublicAppState>, headers: HeaderMap,
    Path(account_id): Path<Uuid>)
    -> Result<StatusCode, ServiceError> {
    // require_admin + require_mutation_identity（CSRF）→ store.suspend_account
    // false → NotFound；true → StatusCode::NO_CONTENT
}

pub(crate) async fn revoke_invitation(State(state): State<PublicAppState>, headers: HeaderMap,
    Path(invite_id): Path<Uuid>)
    -> Result<StatusCode, ServiceError> {
    // require_admin + require_mutation_identity → store.revoke_invitation
    // AlreadyRedeemed → ServiceError::Conflict（409）；NotFound → NotFound；成功 → NO_CONTENT
}
```
错误映射 helper：
```rust
fn map_admin_store_error(error: AdminStoreError) -> ServiceError {
    match error { AdminStoreError::StorageUnavailable => ServiceError::IdentityUnavailable }
}
```

- [ ] **Step 4: 实现路由注册**

`app.rs` `IdentityHttpState` 加 `pub(crate) admin_store: Option<Arc<PostgresAdminStore>>` + `with_admin_store` builder；`server.rs` 组装（`PostgresAdminStore::new(pool.clone())`）。`build_public_router` 加：
```rust
router = router
    .route("/api/admin/dashboard", get(admin::dashboard))
    .route("/api/admin/accounts", get(admin::accounts))
    .route("/api/admin/invitations", get(admin::invitations))
    .route("/api/admin/audit-events", get(admin::audit_events))
    .route("/api/admin/accounts/{account_id}/suspend", post(admin::suspend_account))
    .route("/api/admin/invitations/{invite_id}/revoke", post(admin::revoke_invitation));
```
（仅当 `admin_username.is_some()` 与 `admin_store.is_some()` 时注册，与 invitation_claim 的条件注册模式一致）

- [ ] **Step 5: 运行测试确认通过**

Run: `cargo test --manifest-path D:\mapflow-server\Cargo.toml --test admin_http 2>&1 | tail -5`
Expected: PASS

- [ ] **Step 6: 全量测试 + 提交**

```bash
cd /d/mapflow-server && git add -A && git commit -m "feat: /api/admin/* 接口与路由
- dashboard/accounts/invitations/audit-events 只读统计
- suspend/revoke 操作（含 CSRF 校验与 409 冲突处理）
- 未配置管理员时路由不注册"
```

---

### Task 4: /api/auth/session 返回 isAdmin

**Files:**
- Modify: `D:\mapflow-server\src\http\auth.rs`（`current_identity_response` 224-238 行 + `PublicAccountResponse` 44-48 行）

**Interfaces:**
- Consumes: `IdentityHttpState.admin_username`
- Produces: `PublicAccountResponse.is_admin: bool`

- [ ] **Step 1: 写失败测试 — session 响应含 isAdmin**

在 `tests/session_http.rs`（或 admin_http.rs）加断言：管理员登录后 `GET /api/auth/session` 响应 `account.isAdmin === true`；非管理员为 `false`。

- [ ] **Step 2: 运行测试确认失败**

- [ ] **Step 3: 实现**

`auth.rs`：
```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PublicAccountResponse {
    player_id: String,
    username: String,
    status: &'static str,
    is_admin: bool,
}
```
`current_identity_response` 改为 async（需要 state 判断 admin）或接受 `is_admin: bool` 参数。`current_session` handler：
```rust
let current = require_current_identity(&state, &headers).await?;
let is_admin = state.identity.as_ref()
    .and_then(|i| i.admin_username.as_deref())
    .is_some_and(|admin| current.username() == admin);
Ok(current_identity_response(&current, is_admin))
```
注意：`registration_response`/`authenticated_response` 用的 `PublicAccountResponse` 构造也要加 `is_admin: false`。

- [ ] **Step 4: 运行测试确认通过**

- [ ] **Step 5: 全量测试 + 提交**

```bash
cd /d/mapflow-server && git add -A && git commit -m "feat: /api/auth/session 返回 isAdmin 供前端显示入口"
```

---

### Task 5: 前端 types + adminClient + isAdmin 解析

**Files:**
- Modify: `D:\MapFlow-publish\src\features\identity\types.ts`（`IdentitySession` 加 `isAdmin: boolean`）
- Modify: `D:\MapFlow-publish\src\features\identity\identityClient.ts`（`parseSession` 解析 isAdmin）
- Create: `D:\MapFlow-publish\src\features\admin\types.ts`
- Create: `D:\MapFlow-publish\src\features\admin\adminClient.ts`
- Create: `D:\MapFlow-publish\src\features\admin\adminClient.test.ts`

**Interfaces:**
- Consumes: 后端 API（Task 3/4 产出）
- Produces:
```ts
// features/admin/types.ts
export interface AdminDashboard {
  registeredAccounts: number;
  availableInvites: number;
  redeemedInvites: number;
  revokedInvites: number;
  activeSessions: number;
  platformConsumedUsages: number;
  platformConsumedTokens: number;
  loginTrend7d: { date: string; activeAccounts: number }[];
}
export interface AdminAccount {
  accountId: string; username: string; status: string;
  registeredAt: string; lastSeenAt: string | null;
  byokSessions: number; platformSessions: number; totalTokens: number;
}
export interface AdminInvitation {
  inviteId: string; status: string; createdAt: string;
  claimedIp: string | null; claimedAt: string | null;
  redeemedBy: string | null; redeemedAt: string | null;
}
export interface AdminAuditEvent {
  eventId: string; eventType: string; outcome: string;
  playerId: string | null; occurredAt: string;
}
// features/admin/adminClient.ts
export async function fetchAdminDashboard(csrfToken: string): Promise<AdminDashboard>;
export async function fetchAdminAccounts(csrfToken: string): Promise<AdminAccount[]>;
export async function fetchAdminInvitations(csrfToken: string): Promise<AdminInvitation[]>;
export async function fetchAdminAuditEvents(csrfToken: string, filter: AuditFilter): Promise<AdminAuditEvent[]>;
export async function suspendAdminAccount(accountId: string, csrfToken: string): Promise<void>;
export async function revokeAdminInvitation(inviteId: string, csrfToken: string): Promise<void>;
```
（请求模式参考 identityClient：`request(path, { headers, method })`；读 `src/lib/` 下是否有共享 request helper——先检查，没有则复制身份模块的 `request`/`readJson`/`isRecord` 到 adminClient）

- [ ] **Step 1: 写失败测试**

`adminClient.test.ts`（mock global fetch，参考现有 client 测试模式）：
- fetchAdminDashboard 解析合法响应
- 非法响应抛 IdentityApiError 风格错误
- suspend/revoke 调用 POST + csrf 头 + 204 视为成功
- 409 抛错（作废已兑邀请码）

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/features/admin/adminClient.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 types + adminClient + isAdmin 解析**

- [ ] **Step 4: 运行测试确认通过 + 全量测试**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /d/MapFlow-publish && git add -A && git commit -m "feat: 管理面板 API 客户端与 isAdmin 解析"
```

---

### Task 6: AdminPanel 组件（4 Tab）

**Files:**
- Create: `D:\MapFlow-publish\src\features\admin\AdminPanel.tsx`（容器 + Tab 切换）
- Create: `D:\MapFlow-publish\src\features\admin\OverviewTab.tsx`（指标卡片 + 7 日 CSS 柱状图）
- Create: `D:\MapFlow-publish\src\features\admin\AccountsTab.tsx`（用户表格 + 封禁按钮二次确认）
- Create: `D:\MapFlow-publish\src\features\admin\InvitationsTab.tsx`（分布 + 列表 + 作废按钮）
- Create: `D:\MapFlow-publish\src\features\admin\AuditLogTab.tsx`（类型过滤 + 分页）
- Create: `D:\MapFlow-publish\src\features\admin\AdminPanel.test.tsx`

**Interfaces:**
- Consumes: adminClient 6 个函数；`csrfToken` 从身份模块（检查 `useIdentitySession` hook 或类似提供方式，沿用 App.tsx 现有取 csrf 的路径）
- Produces: `<AdminPanel onBack={...} />`（内部管理自身数据加载与错误）

- [ ] **Step 1: 写失败测试**

`AdminPanel.test.tsx`（mock `adminClient` 模块）：
- 渲染 4 个 Tab 标题
- 概览 Tab：mock dashboard 数据 → 显示注册数/剩余邀请码/今日登录（柱状图最高日）
- 用户 Tab：mock accounts → 渲染用户名行；点"封禁"→ 确认弹窗 → 确认 → 调 suspend + 列表刷新
- 邀请码 Tab：mock invitations → 渲染状态；点"作废"→ 确认 → 调 revoke；409 错误显示中文提示
- 审计 Tab：mock events → 渲染类型/时间；切 event_type 过滤重新请求

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/features/admin/AdminPanel.test.tsx`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现组件**

- 样式：沿用 `IdentityDialog` 的 slate/cyan 主题（深色卡片、边框 slate-800）
- 概览指标卡片：`注册总数 / 今日登录 / 活跃会话 / 剩余邀请码 / 平台消耗次数 / 平台消耗 token`
- 7 日柱状图：`div` 高度按 `activeAccounts / max * 100%`，无图表库
- 封禁/作废交互：`window.confirm` 或内联确认态（用内联确认态，组件测试友好）
- 所有数据用 React Query（`useQuery`）+ mutation，沿用 TreeGenerationDialog 模式
- 错误：`StatusMessage` 风格展示 `IdentityApiError.message`

- [ ] **Step 4: 运行测试确认通过**

- [ ] **Step 5: 全量测试 + 提交**

```bash
cd /d/MapFlow-publish && npx vitest run && npx tsc --noEmit
cd /d/MapFlow-publish && git add -A && git commit -m "feat: 管理面板组件（概览/用户/邀请码/审计日志）"
```

---

### Task 7: App 集成（admin 视图 + 入口）

**Files:**
- Modify: `D:\MapFlow-publish\src\App.tsx`（`AppView` 26 行、state 36 行、personal 导航渲染处约 140-200 行）
- Modify: `D:\MapFlow-publish\src\App.test.tsx`（如有 view 切换测试）

**Interfaces:**
- Consumes: `IdentitySession.isAdmin`（Task 5）、`AdminPanel`（Task 6）
- Produces: 登录后导航栏"管理面板"按钮（`session.isAdmin === true` 时显示）；点击后 `view === 'admin'` 渲染 AdminPanel，带返回按钮

- [ ] **Step 1: 写失败测试**

`App.test.tsx` 或新测试：mock session 带 `isAdmin: true` → 导航栏出现"管理面板"；点击 → AdminPanel 渲染。`isAdmin: false` → 无入口。

- [ ] **Step 2: 运行测试确认失败**

- [ ] **Step 3: 实现**

`App.tsx`：
```tsx
type AppView = 'public' | 'personal' | 'admin';
// ...
const [view, setView] = useState<AppView>('public');
// personal 导航区（登录后）加：
{session?.isAdmin && (
  <button onClick={() => setView('admin')}>管理面板</button>
)}
// 渲染区：
{view === 'admin' ? (
  <AdminPanel onBack={() => setView('personal')} />
) : view === 'personal' ? (
  // 现有 personal 内容
) : ( // public )}
```
注意 App.tsx 现有 `view === 'personal'` 时的 session 保护逻辑（126-129 行：无 session 退回 public）——admin 视图同样处理。

- [ ] **Step 4: 运行测试确认通过 + 全量测试 + 提交**

```bash
cd /d/MapFlow-publish && npx vitest run && npx tsc --noEmit
cd /d/MapFlow-publish && git add -A && git commit -m "feat: 管理面板入口与 admin 视图"
```

---

### Task 8: 服务器部署（secret 文件 + switch 脚本 + CI）

**Files:**
- Modify: `D:\mapflow-server\.github\workflows\ci.yml`（`MAPFLOW_COMMIT` 更新为新前端 commit——由 Task 5-7 提交后的 SHA 决定）
- Modify: `C:\Users\Administrator\AppData\Local\Temp\mapflow-switch.sh`（挂载 admin-username 文件 + `MAPFLOW_ADMIN_USERNAME_FILE` env）

**Interfaces:**
- Consumes: Task 1-4 后端 commit、Task 5-7 前端 commit
- Produces: 生产可用的管理面板

- [ ] **Step 1: 服务器创建 secret 文件**

SSH 到 47.114.98.109：
```bash
printf '%s\n' 'rongyan' > /opt/mapflow/identity/secrets/admin-username
chown root:10001 /opt/mapflow/identity/secrets/admin-username
chmod 0440 /opt/mapflow/identity/secrets/admin-username
```
（**注意**：把管理员用户名替换为你实际的注册用户名，非 "rongyan" 则以实际为准）

- [ ] **Step 2: 更新 switch 脚本**

`mapflow-switch.sh` 的 python 部分加：
```python
args += ['-e', 'MAPFLOW_ADMIN_USERNAME_FILE=/run/secrets/admin-username']
```
挂载列表加 `('/opt/mapflow/identity/secrets/admin-username', '/run/secrets/admin-username')`。

- [ ] **Step 3: 更新 CI pin 并触发构建**

```bash
cd /d/mapflow-server && # 修改 ci.yml MAPFLOW_COMMIT 为前端最新 SHA
git add .github/workflows/ci.yml && git commit -m "ci: pin MapFlow frontend to <sha> (管理面板)" && git push origin main
```

- [ ] **Step 4: 部署验证**

用户浏览器下载 artifact → 校验 → scp → docker load → switch → 验证：
1. 非管理员账号访问 /api/admin/dashboard → 403
2. 管理员（rongyan）登录 → 导航栏有"管理面板" → 面板数据与直接 SQL 查询一致
3. 浏览器验收 4 个 Tab

- [ ] **Step 5: 收尾**

服务器删除已废弃的 `turnstile-secret-key` 文件（如果仍在）；确认 `mapflow-app-previous-*` 旧容器可清理。

---

## Self-Review 备忘

- Spec 覆盖：dashboard（登录趋势/邀请码/会话/平台消耗）→ Task 2-3 ✓；accounts → Task 2-3 ✓；invitations → Task 2-3 ✓；audit-events → Task 2-3 ✓；suspend/revoke → Task 2-3 ✓；isAdmin → Task 4-5 ✓；前端 4 Tab → Task 6 ✓；入口 → Task 7 ✓；部署 → Task 8 ✓
- 类型一致性：`AdminDashboard` 字段 `registeredAccounts`（camelCase）贯穿后端响应（`#[serde(rename_all = "camelCase")]`）与前端类型 ✓
- 无占位符：Task 2 的 `todo!()` 为计划标记，实现时按注释中的 SQL 填充（SQL 已在注释中给出完整语句）
