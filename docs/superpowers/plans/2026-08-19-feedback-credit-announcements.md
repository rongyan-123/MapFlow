# 反馈 + 积分 + 公告 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 MapFlow 教学系统添加三个功能：用户反馈（右下角悬浮按钮 + 管理端列表）、积分系统（签到随机 2-5 分 / 生成一棵树 3 分 / 免费额度用尽后走积分 / 规划失败退款）、公告系统（未读弹窗 + 导航按钮 + 管理端新建/删除）。

**Architecture:** 后端新增 `credit_ledger`（流水账，余额由 SUM 推导）、`user_feedback`、`announcements` + `announcement_reads` 四张表（迁移 0007）。免费 grants 系统原样保留，`reserve_platform_session` 事务内 grants 用尽后走积分扣费路径（同一事务已锁 accounts 行，无超卖）；usage 变 released 时按 generation_session_id 关联退款。前端沿用每 feature 一个文件 + 本地 request/校验副本模式，新增 credit/feedback/announcements 三个 feature 目录。管理面板 AdminPanel 增加「反馈」「公告」两个 Tab。

**Tech Stack:** Rust (axum + sqlx + PostgreSQL)、React (react-query)、getrandom 0.4.3（不新增 rand 依赖）、GitHub Actions 自动部署。

**Spec:** `docs/superpowers/specs/2026-08-19-feedback-credit-announcements-design.md`

## Global Constraints

以下约束对所有 task 生效（数值与 spec 逐字一致，plan 内修正处已注明）：

1. **signin_date 日界表达式（spec 缺陷修正）**：spec 的 `(CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::DATE` 有日界差一天 bug，本计划统一使用 `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')::date`。
2. **int4/int8 绑定**：`credit_ledger.amount` / `balance_after` 是 INTEGER 列，Rust 写入一律 `as i32`；SUM 读取用 `COALESCE(SUM(amount),0)::BIGINT` 读作 i64。给 INTEGER 列绑 i64 会报 42804。
3. **不新增 rand 依赖**：随机数用现有 getrandom 0.4.3，`getrandom::fill(&mut [u8; 1])`，award = `SIGNIN_MIN_AWARD + i64::from(random_byte[0] % 4)`（4 = 5-2+1）。
4. **积分常量（src/credit.rs）**：`CREDIT_PRICE_PER_TREE: i64 = 3`、`SIGNIN_MIN_AWARD: i64 = 2`、`SIGNIN_MAX_AWARD: i64 = 5`；新注册固定发放 `INVITE_ACTIVATION_GRANT_AMOUNT: i32 = 3`（忽略批次 grant_count）。
5. **余额不足复用现有错误**：积分不足时抛 `StoreError::EntitlementExhausted`（前端显示「积分不足」文案），不新增错误变体。
6. **`fail_platform_initial_planning` 从 `pub(crate)` 改 `pub`**（集成测试需要）。
7. **退款幂等 guard**：仅当该 session 有 spend 条目且无 refund 条目时插入 refund；refund 不锁行（ledger SUM 权威，balance_after 仅为簿记）。
8. **公告删除两步**：同一事务内先删 `announcement_reads` 再删 `announcements`（spec 要求，不用 ON DELETE CASCADE）。
9. **ServiceError 新增 3 变体**（error.rs 的 status/code/message 三个 match 都要改）：
   - `CreditAlreadySignedIn` → 409 `credit.already_signed_in`「今天已经签到过了，明天再来吧。」
   - `CreditUnavailable` → 503 `credit.temporarily_unavailable`「积分服务暂时不可用，请稍后重试。」
   - `Unavailable` → 503 `service.temporarily_unavailable`「服务暂时不可用，请稍后重试。」（feedback/announcements 存储失败用）
10. **路由 gating**：credit/feedback/announcements 公共路由无条件注册，handler 内 `state.xxx.as_deref().ok_or(ServiceError::NotFound)`；admin 路由在现有 admin block 内，handler 内再 guard 对应 state。
11. **迁移 0007 一次性建四张表**（credit_ledger + user_feedback + announcements + announcement_reads），Task 1 写全，Task 4/5 只写 store 代码不碰迁移。
12. **本地验证**：本机 Rust 工具链不在 PATH，用全路径 `~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe`；push 前必须本地 `cargo fmt --check` + `cargo clippy --all-targets` + `cargo check`（CI 每轮 ~15 分钟，禁止靠 CI 试错）。前端用 `npm test` + `npm run typecheck`。
13. **生产验证走 https://xxian.fun**（curl 直连 127.0.0.1:18082 会 403 origin_rejected；Secure cookie 需手动提取）。
14. **子代理约束**：implementer 一律显式 `model=sonnet`；直接在 main 分支工作；所有 commit message 用中文。

## 跨任务交接

| 交接 | 内容 | 位置 |
|---|---|---|
| T1 → T2 | `insert_credit_spend` / `refund_credit_spend`（credit_store.rs 内 pub(crate) async fn）+ `CREDIT_PRICE_PER_TREE` | 见 Task 1 Step 3 / Task 2 接口 |
| T1 → T3 | tests/credit_http.rs 的 freeRemaining 断言**先写 0**，T3 注册逻辑改固定 3 次后**改为 3** | Task 3 Step 4 显式改写 |
| T1 → T6 | `credit_ledger` 表存在（T6 子查询依赖） | 迁移在 Task 1 |
| T2 → T2 | `fail_platform_initial_planning` 改 pub 与退款在同一 task 内完成 | Task 2 Step 3 |
| T4/T5 → T9 | admin 反馈/公告 API 先于前端管理 Tab 存在 | 顺序 T4→T5→T9 |
| T7 → T8 | CreditPill 的 session 来源用 `useIdentity()` | 与 T8 的 AnnouncementProvider 同模式 |

---

### Task 1: 积分后端骨架（迁移 + 域 + 存储 + HTTP + 接线）

积分系统的全部基础设施：0007 迁移（四张表）、credit 域模块（常量 + 错误 + 摘要）、PostgresCreditStore（签到/余额/今日已签 + 两个 pub(crate) 交易内帮手）、HTTP handler（me/signin）、ServiceError 3 变体、app/runtime/server/lib 接线。

**Files:**
- Create: `D:\mapflow-server\migrations\0007_feedback_credit_announcements.sql`
- Create: `D:\mapflow-server\src\credit.rs`
- Create: `D:\mapflow-server\src\adapters\postgres\credit_store.rs`
- Create: `D:\mapflow-server\src\http\credit.rs`
- Create: `D:\mapflow-server\tests\credit_http.rs`
- Modify: `D:\mapflow-server\src\error.rs`
- Modify: `D:\mapflow-server\src\app.rs`
- Modify: `D:\mapflow-server\src\runtime.rs`
- Modify: `D:\mapflow-server\src\server.rs`
- Modify: `D:\mapflow-server\src\lib.rs`
- Modify: `D:\mapflow-server\src\adapters\postgres\mod.rs`
- Modify: `D:\mapflow-server\src\http\mod.rs`

**Interfaces:**
- Consumes: 现有 `PostgresPlatformGenerationStore::summary()`（platform_generation_store.rs，返回 `PlatformGenerationEntitlementSummary { available, .. }`）、`CurrentIdentity::account_id()`、`auth::require_current_identity` / `require_mutation_identity`（http/auth.rs:131/140）。
- Produces: `PostgresCreditStore`（new/sign_in/balance/signed_in_today + `pub(crate) async fn insert_credit_spend(transaction, account_id, generation_session_id, balance_after: i64)` + `pub(crate) async fn refund_credit_spend(transaction, account_id, generation_session_id)`）、`CreditHttpState`、`ServiceError::{CreditAlreadySignedIn, CreditUnavailable, Unavailable}`、`tests/credit_http.rs`（freeRemaining 断言 0，T3 改 3）。

- [ ] **Step 1: 写迁移文件（四张表一次建全）**

创建 `D:\mapflow-server\migrations\0007_feedback_credit_announcements.sql`：

```sql
CREATE TABLE credit_ledger (
    entry_id              UUID PRIMARY KEY,
    account_id            UUID NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
    kind                  TEXT NOT NULL CHECK (kind IN ('signin', 'spend', 'refund')),
    amount                INTEGER NOT NULL CHECK (amount <> 0),
    balance_after         INTEGER NOT NULL,
    signin_date           DATE,
    generation_session_id UUID,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT credit_ledger_kind_shape CHECK (
        (kind = 'signin' AND signin_date IS NOT NULL AND generation_session_id IS NULL)
        OR (kind IN ('spend', 'refund')
            AND signin_date IS NULL AND generation_session_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX credit_ledger_signin_unique
    ON credit_ledger (account_id, signin_date) WHERE kind = 'signin';

CREATE INDEX credit_ledger_account_created
    ON credit_ledger (account_id, created_at DESC);

CREATE FUNCTION reject_credit_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'credit ledger is append-only';
END;
$$;

CREATE TRIGGER credit_ledger_append_only
BEFORE UPDATE OR DELETE ON credit_ledger
FOR EACH ROW EXECUTE FUNCTION reject_credit_ledger_mutation();

CREATE TABLE user_feedback (
    feedback_id UUID PRIMARY KEY,
    account_id  UUID NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
    content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX user_feedback_created ON user_feedback (created_at DESC);

CREATE TABLE announcements (
    announcement_id UUID PRIMARY KEY,
    title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
    content         TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX announcements_created ON announcements (created_at DESC);

CREATE TABLE announcement_reads (
    account_id       UUID NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
    announcement_id  UUID NOT NULL REFERENCES announcements(announcement_id) ON DELETE RESTRICT,
    read_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (account_id, announcement_id)
);
```

- [ ] **Step 2: 写 credit 域模块**

创建 `D:\mapflow-server\src\credit.rs`：

```rust
pub const CREDIT_PRICE_PER_TREE: i64 = 3;
pub const SIGNIN_MIN_AWARD: i64 = 2;
pub const SIGNIN_MAX_AWARD: i64 = 5;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CreditSigninResult {
    pub balance: i64,
    pub awarded: i64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CreditStoreError {
    AccountNotFound,
    AlreadySignedIn,
    StorageUnavailable,
}

impl std::fmt::Display for CreditStoreError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::AccountNotFound => formatter.write_str("credit account not found"),
            Self::AlreadySignedIn => formatter.write_str("already signed in today"),
            Self::StorageUnavailable => formatter.write_str("credit storage unavailable"),
        }
    }
}

impl std::error::Error for CreditStoreError {}
```

- [ ] **Step 3: 写 PostgresCreditStore**

创建 `D:\mapflow-server\src\adapters\postgres\credit_store.rs`：

```rust
use chrono::NaiveDate;
use sqlx::postgres::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::credit::{CreditSigninResult, CreditStoreError, SIGNIN_MAX_AWARD, SIGNIN_MIN_AWARD};

#[derive(Clone, Debug)]
pub struct PostgresCreditStore {
    pool: PgPool,
}

impl PostgresCreditStore {
    #[must_use]
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn sign_in(&self, account_id: Uuid) -> Result<CreditSigninResult, CreditStoreError> {
        let mut transaction = self
            .pool
            .begin()
            .await
            .map_err(|_| CreditStoreError::StorageUnavailable)?;
        let locked_account: Option<Uuid> = sqlx::query_scalar(
            "SELECT account_id FROM accounts WHERE account_id = $1 AND status = 'active' FOR UPDATE",
        )
        .bind(account_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|_| CreditStoreError::StorageUnavailable)?;
        if locked_account.is_none() {
            return Err(CreditStoreError::AccountNotFound);
        }
        let today: NaiveDate = sqlx::query_scalar(
            "SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')::date",
        )
        .fetch_one(&mut *transaction)
        .await
        .map_err(|_| CreditStoreError::StorageUnavailable)?;
        let already: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM credit_ledger \
             WHERE account_id = $1 AND kind = 'signin' AND signin_date = $2",
        )
        .bind(account_id)
        .bind(today)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|_| CreditStoreError::StorageUnavailable)?;
        if already.is_some() {
            return Err(CreditStoreError::AlreadySignedIn);
        }
        let mut random_byte = [0_u8; 1];
        getrandom::fill(&mut random_byte).map_err(|_| CreditStoreError::StorageUnavailable)?;
        let awarded =
            SIGNIN_MIN_AWARD + i64::from(random_byte[0] % 4);
        debug_assert!((SIGNIN_MIN_AWARD..=SIGNIN_MAX_AWARD).contains(&awarded));
        let balance_before: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(amount), 0)::BIGINT FROM credit_ledger WHERE account_id = $1",
        )
        .bind(account_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|_| CreditStoreError::StorageUnavailable)?;
        let balance_after = balance_before + awarded;
        sqlx::query(
            "INSERT INTO credit_ledger \
             (entry_id, account_id, kind, amount, balance_after, signin_date) \
             VALUES ($1, $2, 'signin', $3, $4, $5)",
        )
        .bind(Uuid::now_v7())
        .bind(account_id)
        .bind(awarded as i32)
        .bind(balance_after as i32)
        .bind(today)
        .execute(&mut *transaction)
        .await
        .map_err(|_| CreditStoreError::StorageUnavailable)?;
        transaction
            .commit()
            .await
            .map_err(|_| CreditStoreError::StorageUnavailable)?;
        Ok(CreditSigninResult {
            balance: balance_after,
            awarded,
        })
    }

    pub async fn balance(&self, account_id: Uuid) -> Result<i64, CreditStoreError> {
        sqlx::query_scalar(
            "SELECT COALESCE(SUM(amount), 0)::BIGINT FROM credit_ledger WHERE account_id = $1",
        )
        .bind(account_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|_| CreditStoreError::StorageUnavailable)
    }

    pub async fn signed_in_today(&self, account_id: Uuid) -> Result<bool, CreditStoreError> {
        let count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM credit_ledger \
             WHERE account_id = $1 AND kind = 'signin' \
               AND signin_date = (SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')::date)",
        )
        .bind(account_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|_| CreditStoreError::StorageUnavailable)?;
        Ok(count > 0)
    }

    /// 事务内帮手：reserve_platform_session 扣费路径调用（同事务已锁 accounts 行）。
    pub(crate) async fn insert_credit_spend(
        transaction: &mut Transaction<'_, Postgres>,
        account_id: Uuid,
        generation_session_id: Uuid,
        balance_after: i64,
    ) -> Result<(), CreditStoreError> {
        sqlx::query(
            "INSERT INTO credit_ledger \
             (entry_id, account_id, kind, amount, balance_after, generation_session_id) \
             VALUES ($1, $2, 'spend', $3, $4, $5)",
        )
        .bind(Uuid::now_v7())
        .bind(account_id)
        .bind(-(crate::credit::CREDIT_PRICE_PER_TREE as i32))
        .bind(balance_after as i32)
        .bind(generation_session_id)
        .execute(&mut **transaction)
        .await
        .map_err(|_| CreditStoreError::StorageUnavailable)
    }

    /// 事务内帮手：usage 变 released 时调用。幂等：无 spend 或无 refund 前置时直接 no-op。
    pub(crate) async fn refund_credit_spend(
        transaction: &mut Transaction<'_, Postgres>,
        account_id: Uuid,
        generation_session_id: Uuid,
    ) -> Result<(), CreditStoreError> {
        let spent: Option<i32> = sqlx::query_scalar(
            "SELECT amount FROM credit_ledger \
             WHERE account_id = $1 AND kind = 'spend' AND generation_session_id = $2",
        )
        .bind(account_id)
        .bind(generation_session_id)
        .fetch_optional(&mut **transaction)
        .await
        .map_err(|_| CreditStoreError::StorageUnavailable)?;
        let Some(spent) = spent else {
            return Ok(());
        };
        let already_refunded: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM credit_ledger \
             WHERE account_id = $1 AND kind = 'refund' AND generation_session_id = $2",
        )
        .bind(account_id)
        .bind(generation_session_id)
        .fetch_optional(&mut **transaction)
        .await
        .map_err(|_| CreditStoreError::StorageUnavailable)?;
        if already_refunded.is_some() {
            return Ok(());
        }
        let refund_amount = i64::from(-spent);
        let balance_after: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(amount), 0)::BIGINT FROM credit_ledger WHERE account_id = $1",
        )
        .bind(account_id)
        .fetch_one(&mut **transaction)
        .await
        .map_err(|_| CreditStoreError::StorageUnavailable)?
            + refund_amount;
        sqlx::query(
            "INSERT INTO credit_ledger \
             (entry_id, account_id, kind, amount, balance_after, generation_session_id) \
             VALUES ($1, $2, 'refund', $3, $4, $5)",
        )
        .bind(Uuid::now_v7())
        .bind(account_id)
        .bind(refund_amount as i32)
        .bind(balance_after as i32)
        .bind(generation_session_id)
        .execute(&mut **transaction)
        .await
        .map_err(|_| CreditStoreError::StorageUnavailable)
    }
}
```

- [ ] **Step 4: 写 credit HTTP handler**

创建 `D:\mapflow-server\src\http\credit.rs`：

```rust
use axum::extract::State;
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;

use super::auth::{require_current_identity, require_mutation_identity};
use crate::credit::{CreditStoreError, CREDIT_PRICE_PER_TREE};
use crate::{CreditHttpState, PublicAppState, ServiceError};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreditSummaryResponse {
    balance: i64,
    signed_in_today: bool,
    free_remaining: i64,
    price_per_tree: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SigninResponse {
    balance: i64,
    awarded: i64,
}

pub(crate) async fn me(
    State(state): State<PublicAppState>,
    headers: HeaderMap,
) -> Result<Response, ServiceError> {
    let current = require_current_identity(&state, &headers).await?;
    let credit = credit_state(&state)?;
    let account_id = current.account_id();
    let balance = credit
        .credit_store
        .balance(account_id)
        .await
        .map_err(map_credit_error)?;
    let signed_in_today = credit
        .credit_store
        .signed_in_today(account_id)
        .await
        .map_err(map_credit_error)?;
    let free_remaining = credit
        .platform_entitlements
        .summary(account_id)
        .await
        .map(|summary| summary.available)
        .unwrap_or(0);
    Ok(no_store_json(
        StatusCode::OK,
        CreditSummaryResponse {
            balance,
            signed_in_today,
            free_remaining,
            price_per_tree: CREDIT_PRICE_PER_TREE,
        },
    ))
}

pub(crate) async fn signin(
    State(state): State<PublicAppState>,
    headers: HeaderMap,
) -> Result<Response, ServiceError> {
    let current = require_mutation_identity(&state, &headers).await?;
    let credit = credit_state(&state)?;
    let result = credit
        .credit_store
        .sign_in(current.account_id())
        .await
        .map_err(map_credit_error)?;
    Ok(no_store_json(
        StatusCode::OK,
        SigninResponse {
            balance: result.balance,
            awarded: result.awarded,
        },
    ))
}

fn credit_state(state: &PublicAppState) -> Result<&CreditHttpState, ServiceError> {
    state.credit.as_deref().ok_or(ServiceError::NotFound)
}

const fn map_credit_error(error: CreditStoreError) -> ServiceError {
    match error {
        CreditStoreError::AccountNotFound => ServiceError::NotFound,
        CreditStoreError::AlreadySignedIn => ServiceError::CreditAlreadySignedIn,
        CreditStoreError::StorageUnavailable => ServiceError::CreditUnavailable,
    }
}

fn no_store_json<T: Serialize>(status: StatusCode, body: T) -> Response {
    let mut response = (status, Json(body)).into_response();
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}
```

- [ ] **Step 5: 写失败测试（tests/credit_http.rs）**

创建 `D:\mapflow-server\tests\credit_http.rs`（注意：**freeRemaining 断言写 0**，Task 3 会改为 3）：

```rust
use axum::body::Body;
use axum::http::{Method, Request, StatusCode, header};
use axum::Router;
use sqlx::PgPool;
use tower::ServiceExt;

use mapflow_server::{
    CreditHttpState, IdentityHttpState, IdentitySecretKeys, IdentityService, InvitationDigestKey,
    PasswordPolicy, PostgresCreditStore, PostgresIdentityStore, PostgresPlatformGenerationStore,
    PublicAppState, RegisterIdentityCommand, build_public_router,
};

mod common;

#[sqlx::test(migrations = "./migrations")]
async fn credit_me_reports_balance_and_free_remaining(pool: PgPool) {
    let app = credit_app(&pool).await;
    let username = "credituser";
    let (cookie, _) = register_and_login(&app, username).await;

    let response = request(
        &app,
        Method::GET,
        "/api/credit/me",
        Some(cookie.as_str()),
        None,
        None,
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    let body = response_json(response).await;
    assert_eq!(body["balance"], 0);
    assert_eq!(body["signedInToday"], false);
    assert_eq!(body["freeRemaining"], 0); // Task 3 后注册固定发 3 次，此断言改为 3
    assert_eq!(body["pricePerTree"], 3);
}

#[sqlx::test(migrations = "./migrations")]
async fn credit_signin_awards_two_to_five_credits(pool: PgPool) {
    let app = credit_app(&pool).await;
    let username = "signer";
    let (cookie, csrf) = register_and_login(&app, username).await;

    let response = request(
        &app,
        Method::POST,
        "/api/credit/signin",
        Some(cookie.as_str()),
        Some(csrf.as_str()),
        None,
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    let body = response_json(response).await;
    let awarded = body["awarded"].as_i64().expect("awarded is a number");
    let balance = body["balance"].as_i64().expect("balance is a number");
    assert!((2..=5).contains(&awarded));
    assert_eq!(balance, awarded);

    let me = request(
        &app,
        Method::GET,
        "/api/credit/me",
        Some(cookie.as_str()),
        None,
        None,
    )
    .await;
    let me_body = response_json(me).await;
    assert_eq!(me_body["balance"], balance);
    assert_eq!(me_body["signedInToday"], true);
}

#[sqlx::test(migrations = "./migrations")]
async fn credit_signin_is_rejected_when_already_signed_in_today(pool: PgPool) {
    let app = credit_app(&pool).await;
    let (cookie, csrf) = register_and_login(&app, "twice").await;

    request(
        &app,
        Method::POST,
        "/api/credit/signin",
        Some(cookie.as_str()),
        Some(csrf.as_str()),
        None,
    )
    .await;
    let response = request(
        &app,
        Method::POST,
        "/api/credit/signin",
        Some(cookie.as_str()),
        Some(csrf.as_str()),
        None,
    )
    .await;
    assert_eq!(response.status(), StatusCode::CONFLICT);
    let body = response_json(response).await;
    assert_eq!(body["error"]["code"], "credit.already_signed_in");
}

#[sqlx::test(migrations = "./migrations")]
async fn credit_signin_requires_csrf(pool: PgPool) {
    let app = credit_app(&pool).await;
    let (cookie, _) = register_and_login(&app, "no-csrf").await;

    let response = request(
        &app,
        Method::POST,
        "/api/credit/signin",
        Some(cookie.as_str()),
        None,
        None,
    )
    .await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[sqlx::test(migrations = "./migrations")]
async fn credit_routes_are_absent_without_credit_wiring(pool: PgPool) {
    let store = PostgresIdentityStore::new(pool.clone(), InvitationDigestKey::new([42_u8; 32]));
    let service = IdentityService::new(
        store,
        IdentitySecretKeys::new([11_u8; 32], [12_u8; 32], [13_u8; 32], [14_u8; 32], 1)
            .expect("valid secret keys"),
        PasswordPolicy::new(["password123", "qwerty123"]),
    );
    let identity = IdentityHttpState::secure(service, "https://mapflow.test")
        .expect("valid HTTPS identity state");
    let app = build_public_router(
        PublicAppState::new(common::ready_snapshot(), common::static_site_root())
            .with_identity(identity),
    );

    let response = request(&app, Method::GET, "/api/credit/me", None, None, None).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

async fn credit_app(pool: &PgPool) -> Router {
    let store = PostgresIdentityStore::new(pool.clone(), InvitationDigestKey::new([42_u8; 32]));
    let service = IdentityService::new(
        store,
        IdentitySecretKeys::new([11_u8; 32], [12_u8; 32], [13_u8; 32], [14_u8; 32], 1)
            .expect("valid secret keys"),
        PasswordPolicy::new(["password123", "qwerty123"]),
    );
    let identity = IdentityHttpState::secure(service, "https://mapflow.test")
        .expect("valid HTTPS identity state");
    build_public_router(
        PublicAppState::new(common::ready_snapshot(), common::static_site_root())
            .with_identity(identity)
            .with_credit(CreditHttpState::new(
                PostgresCreditStore::new(pool.clone()),
                PostgresPlatformGenerationStore::new(pool.clone()),
            )),
    )
}

async fn register_and_login(app: &Router, username: &str) -> (String, String) {
    let batch_id = Uuid::new_v4();
    let invitation = InvitationCode::parse("CREDIT").expect("valid invitation");
    // 通过 store 直接发批次（grant_count 默认 0），再走 HTTP 注册登录
    let store = PostgresIdentityStore::new(
        /* pool 不可得；改用 HTTP 注册接口 */
    );
    todo!()
}
```

**注意（implementer）**：上面的 `register_and_login` 帮手是示意骨架，`todo!()` 必须替换为可编译实现。请参考 `tests/admin_http.rs` 的既有模式（`seed_account` + `login` + `json_request` + `session_cookie` + `response_json`）完整实现：
- 注册走 HTTP `POST /api/auth/register`（body `{ username, password, invitationCode, email }`），invitation 通过 `PostgresIdentityStore::create_invitation_batch`（见 admin_http.rs:36-66）或直接 SQL 种子（见 admin_http.rs:98-129 `seed_invite`，注意 `create_invitation_batch` 需要 InvitationDigestKey，测试内可直接构造）。
- 登录走 HTTP `POST /api/auth/login`，提取 cookie + csrfToken。
- `request` / `json_request` / `response_json` / `session_cookie` helper 参考 admin_http.rs 实现（HOST + ORIGIN 头、ConnectInfo）。
- 测试文件头部 `use uuid::Uuid; use mapflow_server::InvitationCode;` 按需补齐。
- 五个测试的断言不变；`credit_me_reports_balance_and_free_remaining` 的 freeRemaining 断言必须为 0（见测试内注释）。

- [ ] **Step 6: 跑测试确认失败**

Run: `~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe test --test credit_http`
Expected: 编译失败（PostgresCreditStore / CreditHttpState / ServiceError 变体 / with_credit / 路由均不存在）

- [ ] **Step 7: ServiceError 新增 3 变体**

修改 `D:\mapflow-server\src\error.rs`（三处 match + 枚举）：

枚举（按字母序插入，`Self::Unavailable` 放在 `Self::TreeLibraryUnavailable` 前、`Self::Worker` 前——枚举顺序不影响编译，按可读性放置）：

```rust
    CreditAlreadySignedIn,
    CreditUnavailable,
    ...
    Unavailable,
```

`status()` 中：`Self::CreditAlreadySignedIn` 加入 CONFLICT 组；`Self::CreditUnavailable | Self::Unavailable` 加入 SERVICE_UNAVAILABLE 组：

```rust
            Self::Conflict
            | Self::CreditAlreadySignedIn
            | Self::InvitationAlreadyRedeemed
            ...
            Self::GenerationUnavailable
            | Self::CreditUnavailable
            | Self::IdentityUnavailable
            | Self::PlatformGenerationUnavailable
            | Self::TreeLibraryUnavailable
            | Self::Unavailable => StatusCode::SERVICE_UNAVAILABLE,
```

`code()` 中：

```rust
            Self::CreditAlreadySignedIn => "credit.already_signed_in",
            Self::CreditUnavailable => "credit.temporarily_unavailable",
            Self::Unavailable => "service.temporarily_unavailable",
```

`message()` 中：

```rust
            Self::CreditAlreadySignedIn => "今天已经签到过了，明天再来吧。",
            Self::CreditUnavailable => "积分服务暂时不可用，请稍后重试。",
            Self::Unavailable => "服务暂时不可用，请稍后重试。",
```

- [ ] **Step 8: app.rs 加 CreditHttpState + with_credit + 路由**

修改 `D:\mapflow-server\src\app.rs`：

```rust
#[derive(Clone)]
pub struct CreditHttpState {
    pub(crate) credit_store: PostgresCreditStore,
    pub(crate) platform_entitlements: PostgresPlatformGenerationStore,
}

impl CreditHttpState {
    #[must_use]
    pub const fn new(
        credit_store: PostgresCreditStore,
        platform_entitlements: PostgresPlatformGenerationStore,
    ) -> Self {
        Self {
            credit_store,
            platform_entitlements,
        }
    }
}
```

`PublicAppState` 字段加 `pub(crate) credit: Option<Arc<CreditHttpState>>`，`new()` 初始化为 `None`，加 builder：

```rust
    #[must_use]
    pub fn with_credit(mut self, credit: CreditHttpState) -> Self {
        self.credit = Some(Arc::new(credit));
        self
    }
```

import 区加 `use crate::adapters::postgres::PostgresCreditStore;`（若 crate 顶层 re-export 则用 `use crate::PostgresCreditStore;`，与现有 import 风格一致——app.rs 顶部现有 `use crate::{IdentityService, ..., PostgresPlatformGenerationStore, ...}`，把 `PostgresCreditStore` 加进该组；`CreditHttpState` 在 app.rs 本文件定义）。

`build_public_router` 无条件注册（放在现有 `/api/auth/session` 路由之后）：

```rust
        .route("/api/credit/me", get(credit::me))
        .route("/api/credit/signin", post(credit::signin))
```

`use crate::http::{admin, auth, credit, health, internal, invitation_claim, public, security_headers, tree_generation, tree_library};`

- [ ] **Step 9: runtime.rs 返回 7-tuple**

修改 `D:\mapflow-server\src\runtime.rs`：`bootstrap_public_services` 与 `bootstrap_identity_services` 的返回类型从 4-tuple 改为：

```rust
    (
        IdentityHttpState,
        TreeLibraryHttpState,
        TreeGenerationHttpState,
        PostgresAdminStore,
        PostgresCreditStore,
        PostgresFeedbackStore,
        PostgresAnnouncementsStore,
    ),
```

（PostgresFeedbackStore / PostgresAnnouncementsStore 尚未创建——Task 4/5 才建。**本 task 只返回 PostgresCreditStore，返回 5-tuple**；Task 4/5 各自扩展返回元组。为避免 Task 4/5 改动 runtime 时破坏 T1 编译，T1 先返回 5-tuple，Task 4 加 PostgresFeedbackStore 变 6-tuple，Task 5 加 PostgresAnnouncementsStore 变 7-tuple，server.rs 同步解构。）

`bootstrap_identity_services` 中在 `let generation_store = PostgresTreeGenerationStore::new(pool);` **之前**加：

```rust
    let credit_store = PostgresCreditStore::new(pool.clone());
```

（`pool` 在 `PostgresTreeGenerationStore::new(pool)` 被 move，clone 必须在其前。）import 加 `PostgresCreditStore`。

`Ok((identity_state, tree_library_state, tree_generation_state, admin_store, credit_store))`

- [ ] **Step 10: server.rs 解构 + with_credit**

修改 `D:\mapflow-server\src\server.rs`：

```rust
            let (mut identity, tree_library, tree_generation, admin_store, credit_store) =
                bootstrap_public_services(identity_config)
                    .await
                    .map_err(CanaryServerError::Bootstrap)?;
```

admin block 之后：

```rust
            let platform_funded_generation_enabled = tree_generation.has_platform_model_access();
            let platform_entitlements = tree_generation.platform_entitlements.clone();
            let credit = CreditHttpState::new(credit_store, platform_entitlements);
            public_state = public_state
                .with_identity(identity)
                .with_tree_library(tree_library)
                .with_tree_generation(tree_generation)
                .with_credit(credit)
                .with_platform_funded_generation(platform_funded_generation_enabled);
```

（`TreeGenerationHttpState.platform_entitlements` 是 `pub(crate)`，app.rs:55，可 clone。）import 加 `CreditHttpState`（crate 顶层 re-export 后 `use crate::CreditHttpState;`）。

- [ ] **Step 11: lib.rs + adapters/postgres/mod.rs + http/mod.rs 导出**

`D:\mapflow-server\src\lib.rs`：
- `mod credit;`（第 4 行 `mod adapters;` 附近，按字母序插在 `mod config;` 前）
- `pub use credit::{CreditSigninResult, CreditStoreError, CREDIT_PRICE_PER_TREE, SIGNIN_MAX_AWARD, SIGNIN_MIN_AWARD};`
- adapters::postgres pub use 组加 `PostgresCreditStore`
- app pub use 组加 `CreditHttpState`

`D:\mapflow-server\src\adapters\postgres\mod.rs`：
- `mod credit_store;`
- `pub use credit_store::PostgresCreditStore;`

`D:\mapflow-server\src\http\mod.rs`：
- `pub(crate) mod credit;`

- [ ] **Step 12: 跑测试确认通过**

Run: `~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe test --test credit_http`（需要本地 DATABASE_URL 环境变量，参考现有测试运行方式；CI 用 sqlx test fixtures）
Expected: 5 个测试全过

- [ ] **Step 13: fmt + clippy + 提交**

```bash
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe fmt --check
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe clippy --all-targets
git add migrations/0007_feedback_credit_announcements.sql src/credit.rs src/adapters/postgres/credit_store.rs src/http/credit.rs tests/credit_http.rs src/error.rs src/app.rs src/runtime.rs src/server.rs src/lib.rs src/adapters/postgres/mod.rs src/http/mod.rs
git commit -m "feat: 积分系统骨架（签到/余额 API + credit_ledger 迁移）"
```

Expected: fmt 无 diff、clippy 无 warning、提交成功

---

### Task 2: 生成扣费与退款（reserve_platform_session 积分路径 + 两处 released 退款）

把积分接入平台生成流程：`reserve_platform_session` 免费额度用尽后走积分扣费（同事务，无超卖）；`fail_platform_initial_planning` 与 `finalize_platform_failure` 在 usage 变 released 时退款。

**Files:**
- Modify: `D:\mapflow-server\src\adapters\postgres\tree_generation_store.rs`（92-185 reserve_platform_session、282-328 fail_platform_initial_planning、1331-1365 finalize_platform_failure）
- Modify: `D:\mapflow-server\tests\postgres_tree_generation_store.rs`

**Interfaces:**
- Consumes: Task 1 的 `insert_credit_spend` / `refund_credit_spend`（credit_store.rs，`pub(crate)`）、`CREDIT_PRICE_PER_TREE`（src/credit.rs）、测试 helper `insert_platform_grant` / `insert_platform_session_with_initial_plan` / `fail_platform_run`（tests/postgres_tree_generation_store.rs:1120-1339）。
- Produces: 修改后的 `reserve_platform_session`（积分路径）、`pub fail_platform_initial_planning`、带退款的 `finalize_platform_failure`；5 个新集成测试。

- [ ] **Step 1: 写失败测试（5 个新用例）**

在 `D:\mapflow-server\tests\postgres_tree_generation_store.rs` 追加（文件顶部有 `PostgresTreeGenerationStore`、`StoreError`、`GenerationInput` 等 import；新增 helper 与用例放文件尾部）：

```rust
#[sqlx::test(migrations = "./migrations")]
async fn platform_reservation_charges_three_credits_when_free_entitlement_is_exhausted(
    pool: PgPool,
) {
    let (store, account_id) = store_with_account(&pool).await;
    seed_credit(&pool, account_id, 9).await;

    let reserved = store
        .reserve_platform_session(account_id, generation_input("credit-charge"))
        .await
        .expect("reservation succeeds with credits");

    assert!(reserved.was_created);
    assert_eq!(credit_balance(&pool, account_id).await, 6);
    let spent_amount: i32 = sqlx::query_scalar(
        "SELECT amount FROM credit_ledger \
         WHERE account_id = $1 AND kind = 'spend' AND generation_session_id = $2",
    )
    .bind(account_id)
    .bind(Uuid::parse_str(&reserved.view.generation_session_id).unwrap())
    .fetch_one(&pool)
    .await
    .expect("spend entry");
    assert_eq!(spent_amount, -3);
}

#[sqlx::test(migrations = "./migrations")]
async fn platform_reservation_rejects_when_credit_balance_is_below_price(pool: PgPool) {
    let (store, account_id) = store_with_account(&pool).await;
    seed_credit(&pool, account_id, 2).await;

    let error = store
        .reserve_platform_session(account_id, generation_input("too-cheap"))
        .await
        .expect_err("reservation is rejected");

    assert!(matches!(error, StoreError::EntitlementExhausted));
    assert_eq!(credit_balance(&pool, account_id).await, 2);
    let spend_count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM credit_ledger WHERE account_id = $1 AND kind = 'spend'",
    )
    .bind(account_id)
    .fetch_one(&pool)
    .await
    .expect("spend count");
    assert_eq!(spend_count, 0);
}

#[sqlx::test(migrations = "./migrations")]
async fn platform_reservation_prefers_free_entitlement_without_charging_credits(pool: PgPool) {
    let (store, account_id) = store_with_account(&pool).await;
    insert_platform_grant(&pool, account_id, 3).await;
    seed_credit(&pool, account_id, 5).await;

    let reserved = store
        .reserve_platform_session(account_id, generation_input("free-first"))
        .await
        .expect("reservation succeeds");

    assert!(reserved.was_created);
    assert_eq!(credit_balance(&pool, account_id).await, 5);
    let spend_count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM credit_ledger WHERE account_id = $1 AND kind = 'spend'",
    )
    .bind(account_id)
    .fetch_one(&pool)
    .await
    .expect("spend count");
    assert_eq!(spend_count, 0);
}

#[sqlx::test(migrations = "./migrations")]
async fn platform_initial_planning_failure_refunds_charged_credits(pool: PgPool) {
    let (store, account_id) = store_with_account(&pool).await;
    seed_credit(&pool, account_id, 9).await;
    let reserved = store
        .reserve_platform_session(account_id, generation_input("refund-me"))
        .await
        .expect("reservation succeeds");
    let session_id = Uuid::parse_str(&reserved.view.generation_session_id).unwrap();
    assert_eq!(credit_balance(&pool, account_id).await, 6);

    let released = store
        .fail_platform_initial_planning(session_id)
        .await
        .expect("initial planning failure releases usage");
    assert!(released);
    assert_eq!(credit_balance(&pool, account_id).await, 9);
    let refund_count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM credit_ledger WHERE account_id = $1 AND kind = 'refund'",
    )
    .bind(account_id)
    .fetch_one(&pool)
    .await
    .expect("refund count");
    assert_eq!(refund_count, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn platform_failure_without_credit_charge_creates_no_refund_entry(pool: PgPool) {
    let (store, account_id) = store_with_account(&pool).await;
    insert_platform_grant(&pool, account_id, 3).await;
    let reserved = store
        .reserve_platform_session(account_id, generation_input("no-refund"))
        .await
        .expect("reservation succeeds");
    let session_id = Uuid::parse_str(&reserved.view.generation_session_id).unwrap();

    let released = store
        .fail_platform_initial_planning(session_id)
        .await
        .expect("initial planning failure releases usage");
    assert!(released);
    let refund_count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM credit_ledger WHERE account_id = $1 AND kind = 'refund'",
    )
    .bind(account_id)
    .fetch_one(&pool)
    .await
    .expect("refund count");
    assert_eq!(refund_count, 0);
}
```

追加 helper（文件尾部）：

```rust
async fn seed_credit(pool: &PgPool, account_id: Uuid, balance: i64) {
    sqlx::query(
        "INSERT INTO credit_ledger (entry_id, account_id, kind, amount, balance_after) \
         VALUES ($1, $2, 'signin', $3, $3)",
    )
    .bind(Uuid::now_v7())
    .bind(account_id)
    .bind(balance as i32)
    .execute(pool)
    .await
    .expect("seed credit");
}

async fn credit_balance(pool: &PgPool, account_id: Uuid) -> i64 {
    sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0)::BIGINT FROM credit_ledger WHERE account_id = $1",
    )
    .bind(account_id)
    .fetch_one(pool)
    .await
    .expect("credit balance")
}
```

（`store_with_account` / `insert_platform_grant` / `generation_input` 应已存在于该文件既有 helper 中——`insert_platform_grant(&pool, account_id, amount)` 签名按既有 helper 实际签名核对；若 helper 名称不同，以文件内既有名称为准，测试逻辑不变。）

- [ ] **Step 2: 跑测试确认失败**

Run: `~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe test --test postgres_tree_generation_store`
Expected: 新用例失败（无积分路径：免费额度用尽仍抛 EntitlementExhausted / 无退款条目）

- [ ] **Step 3: 改造 reserve_platform_session**

修改 `D:\mapflow-server\src\adapters\postgres\tree_generation_store.rs`（140-142 的 `if available <= 0` 分支替换为）：

```rust
        let mut credit_balance_after_charge: Option<i64> = None;
        if available <= 0 {
            let balance: i64 = sqlx::query_scalar(
                "SELECT COALESCE(SUM(amount), 0)::BIGINT FROM credit_ledger WHERE account_id = $1",
            )
            .bind(account_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(map_sql_error)?;
            if balance < CREDIT_PRICE_PER_TREE {
                return Err(StoreError::EntitlementExhausted);
            }
            credit_balance_after_charge = Some(balance - CREDIT_PRICE_PER_TREE);
        }
```

usage INSERT（160-168）之后、`transaction.commit()`（169）之前插入：

```rust
        if let Some(balance_after) = credit_balance_after_charge {
            insert_credit_spend(
                &mut transaction,
                account_id,
                generation_session_id,
                balance_after,
            )
            .await
            .map_err(|_| StoreError::Unavailable)?;
        }
```

文件顶部 import 加：

```rust
use crate::credit::CREDIT_PRICE_PER_TREE;
use super::credit_store::insert_credit_spend;
```

- [ ] **Step 4: 改造 fail_platform_initial_planning（改 pub + 退款）**

修改 `D:\mapflow-server\src\adapters\postgres\tree_generation_store.rs` 282-328：

- 签名 `pub(crate) async fn` → `pub async fn`
- `if usage_account_id.is_none()` 分支改为 let-else（避免 unwrap）：

```rust
        let Some(account_id) = usage_account_id else {
            transaction.commit().await.map_err(map_sql_error)?;
            return Ok(false);
        };
```

- usage UPDATE（316-325）之后、commit（326）之前插入：

```rust
        refund_credit_spend(&mut transaction, account_id, generation_session_id)
            .await
            .map_err(|_| StoreError::Unavailable)?;
```

- import 加 `use super::credit_store::refund_credit_spend;`

- [ ] **Step 5: 改造 finalize_platform_failure（usage released 后退款）**

修改 `D:\mapflow-server\src\adapters\postgres\tree_generation_store.rs` 1331-1365：usage UPDATE 的 `rows_affected() != 1` 检查（1347-1349）之后、session UPDATE（1350）之前插入：

```rust
    refund_credit_spend(transaction, account_id, generation_session_id)
        .await
        .map_err(|_| StoreError::Unavailable)?;
```

（该函数已有 `use super::credit_store::...`——若 Step 4 的 import 在文件顶部统一加过则复用。）

- [ ] **Step 6: 跑测试确认通过**

Run: `~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe test --test postgres_tree_generation_store`
Expected: 5 个新用例 + 既有用例全过（既有 `platform_reservation_requires_an_available_entitlement` 无 grant 断言 EntitlementExhausted：无 grant 且无积分 → 走积分路径余额 0 < 3 → 仍抛 EntitlementExhausted ✓；`concurrent_platform_reservations` 有 manual grant 3 → 免费路径不变 ✓）

- [ ] **Step 7: fmt + clippy + 提交**

```bash
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe fmt --check
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe clippy --all-targets
git add src/adapters/postgres/tree_generation_store.rs tests/postgres_tree_generation_store.rs
git commit -m "feat: 生成扣积分与失败退款（免费额度用尽走积分路径）"
```

Expected: 干净通过

---

### Task 3: 注册固定发 3 次免费

新注册用户无论批次 grant_count 是多少，固定发 3 次免费（`INVITE_ACTIVATION_GRANT_AMOUNT`），统一发放不统一的历史。既有 19 个账号不迁移。

**Files:**
- Modify: `D:\mapflow-server\src\adapters\postgres\platform_generation_store.rs`
- Modify: `D:\mapflow-server\src\adapters\postgres\identity_store.rs`（register 130-190）
- Modify: `D:\mapflow-server\tests\postgres_identity_contract.rs`（2 个测试改写）
- Modify: `D:\mapflow-server\tests\credit_http.rs`（freeRemaining 0 → 3）

**Interfaces:**
- Consumes: 既有 `insert_invite_activation_grant(transaction, account_id, invite_id, amount)`（platform_generation_store.rs:162）。
- Produces: `pub(crate) const INVITE_ACTIVATION_GRANT_AMOUNT: i32 = 3;`；注册逻辑改为固定 3。

- [ ] **Step 1: 加常量**

`D:\mapflow-server\src\adapters\postgres\platform_generation_store.rs` 顶部（`impl PostgresPlatformGenerationStore` 之前）：

```rust
/// 新注册用户一次性发放的免费平台生成次数（忽略批次 grant_count，统一口径）。
pub(crate) const INVITE_ACTIVATION_GRANT_AMOUNT: i32 = 3;
```

- [ ] **Step 2: 改注册逻辑**

`D:\mapflow-server\src\adapters\postgres\identity_store.rs` register（140-150）：

```rust
        let invitation: Option<Uuid> = sqlx::query_scalar(
            "SELECT i.invite_id \
             FROM invite_codes i JOIN invite_batches b ON b.batch_id = i.batch_id \
             WHERE i.code_digest = $1 AND i.status = 'available' FOR UPDATE OF i",
        )
        .bind(invitation_digest.as_slice())
        .fetch_optional(&mut *transaction)
        .await
        .map_err(map_storage_failure)?;
        let invite_id = invitation.ok_or(PostgresIdentityError::InvitationRejected)?;
```

169-176 的 grant 调用：

```rust
        insert_invite_activation_grant(
            &mut transaction,
            registration.account_id,
            invite_id,
            INVITE_ACTIVATION_GRANT_AMOUNT,
        )
        .await
        .map_err(|_| PostgresIdentityError::StorageUnavailable)?;
```

import 加 `use super::platform_generation_store::INVITE_ACTIVATION_GRANT_AMOUNT;`（文件顶部已有该模块其他 import 则并入）。

- [ ] **Step 3: 改写契约测试**

`D:\mapflow-server\tests\postgres_identity_contract.rs`：

测试 1（189-263 附近）`invitation_registration_grants_the_batch_amount_in_the_same_transaction` → 改名 `invitation_registration_always_grants_fixed_three_generations`：批次 grant 5（`create_invitation_batch` 后 SQL `UPDATE invite_batches SET platform_generation_grant_count = 5`），注册后断言 `summary.total_granted == 3` 且 source == ("invite_activation", 3)。

测试 2 `zero_grant_invitation_registration_creates_no_entitlement_row` → 改名 `zero_grant_batch_registration_still_grants_fixed_three_generations`：批次 grant 0，注册后断言 grant 行存在且 amount = 3、source_kind = 'invite_activation'（count 断言从 0 改为 1）。

（具体 SQL 与断言以该文件既有实现为准，改动仅两处断言与两个名字。）

- [ ] **Step 4: 更新 credit_http.rs 断言**

`D:\mapflow-server\tests\credit_http.rs` 的 `credit_me_reports_balance_and_free_remaining`：`assert_eq!(body["freeRemaining"], 0)` → `assert_eq!(body["freeRemaining"], 3);`（注册现在发 3 次免费）。

- [ ] **Step 5: 跑测试确认通过**

Run: `~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe test --test postgres_identity_contract --test credit_http`
Expected: 全过

- [ ] **Step 6: fmt + clippy + 提交**

```bash
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe fmt --check
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe clippy --all-targets
git add src/adapters/postgres/platform_generation_store.rs src/adapters/postgres/identity_store.rs tests/postgres_identity_contract.rs tests/credit_http.rs
git commit -m "feat: 新注册固定发放 3 次免费生成额度"
```

Expected: 干净通过

---

### Task 4: 反馈后端（提交 + 管理端分页列表）

用户反馈：`POST /api/feedback`（201）+ `GET /api/admin/feedback?limit=&offset=`（管理员，分页 + 用户名）。

**Files:**
- Create: `D:\mapflow-server\src\adapters\postgres\feedback_store.rs`
- Create: `D:\mapflow-server\src\http\feedback.rs`
- Create: `D:\mapflow-server\tests\feedback_http.rs`
- Modify: `D:\mapflow-server\src\application\admin.rs`（AdminFeedback + FeedbackPage + AdminStore trait）
- Modify: `D:\mapflow-server\src\adapters\postgres\admin_store.rs`（impl list_feedback）
- Modify: `D:\mapflow-server\src\http\admin.rs`（feedback handler + 路由挂载在 app.rs）
- Modify: `D:\mapflow-server\src\app.rs`（FeedbackHttpState + with_feedback + 路由）
- Modify: `D:\mapflow-server\src\runtime.rs`（6-tuple）、`D:\mapflow-server\src\server.rs`、`D:\mapflow-server\src\lib.rs`、`D:\mapflow-server\src\adapters\postgres\mod.rs`、`D:\mapflow-server\src\http\mod.rs`

**Interfaces:**
- Consumes: Task 1 的 `ServiceError::Unavailable`、`auth::map_json_rejection`（auth.rs:260）、`admin::admin_json_response` / `admin_store`（http/admin.rs）。
- Produces: `PostgresFeedbackStore`（new + submit）、`FeedbackHttpState`、`AdminStore::list_feedback(limit, offset) -> Result<FeedbackPage, AdminStoreError>`、`AdminFeedback { feedback_id, username, content, created_at }`、`FeedbackPage { items, total }`。

- [ ] **Step 1: 写失败测试（tests/feedback_http.rs）**

```rust
use axum::body::Body;
use axum::http::{Method, Request, StatusCode, header};
use axum::Router;
use sqlx::PgPool;
use tower::ServiceExt;

use mapflow_server::{
    FeedbackHttpState, IdentityHttpState, IdentitySecretKeys, IdentityService, InvitationDigestKey,
    PasswordPolicy, PostgresFeedbackStore, PostgresIdentityStore, PublicAppState,
    RegisterIdentityCommand, build_public_router,
};

mod common;

#[sqlx::test(migrations = "./migrations")]
async fn feedback_submission_requires_login_and_csrf(pool: PgPool) {
    let app = feedback_app(&pool).await;

    let anonymous = json_request(
        &app,
        Method::POST,
        "/api/feedback",
        None,
        None,
        serde_json::json!({ "content": "很好用" }),
    )
    .await;
    assert_eq!(anonymous.status(), StatusCode::UNAUTHORIZED);

    let (cookie, _) = register_and_login(&app, "feedbacker").await;
    let no_csrf = json_request(
        &app,
        Method::POST,
        "/api/feedback",
        Some(cookie.as_str()),
        None,
        serde_json::json!({ "content": "很好用" }),
    )
    .await;
    assert_eq!(no_csrf.status(), StatusCode::FORBIDDEN);
}

#[sqlx::test(migrations = "./migrations")]
async fn feedback_submission_creates_a_row_and_returns_created(pool: PgPool) {
    let app = feedback_app(&pool).await;
    let (cookie, csrf) = register_and_login(&app, "feedbacker2").await;

    let response = json_request(
        &app,
        Method::POST,
        "/api/feedback",
        Some(cookie.as_str()),
        Some(csrf.as_str()),
        serde_json::json!({ "content": "  希望支持暗色主题  " }),
    )
    .await;
    assert_eq!(response.status(), StatusCode::CREATED);

    let content: String = sqlx::query_scalar("SELECT content FROM user_feedback")
        .fetch_one(&pool)
        .await
        .expect("feedback row");
    assert_eq!(content, "希望支持暗色主题");
}

#[sqlx::test(migrations = "./migrations")]
async fn feedback_rejects_oversized_or_empty_content(pool: PgPool) {
    let app = feedback_app(&pool).await;
    let (cookie, csrf) = register_and_login(&app, "feedbacker3").await;

    let empty = json_request(
        &app,
        Method::POST,
        "/api/feedback",
        Some(cookie.as_str()),
        Some(csrf.as_str()),
        serde_json::json!({ "content": "   " }),
    )
    .await;
    assert_eq!(empty.status(), StatusCode::BAD_REQUEST);

    let huge = json_request(
        &app,
        Method::POST,
        "/api/feedback",
        Some(cookie.as_str()),
        Some(csrf.as_str()),
        serde_json::json!({ "content": "x".repeat(2001) }),
    )
    .await;
    assert_eq!(huge.status(), StatusCode::BAD_REQUEST);
}

#[sqlx::test(migrations = "./migrations")]
async fn feedback_admin_list_requires_admin_and_reports_page(pool: PgPool) {
    let mut app = feedback_app(&pool).await;
    app = build_admin_router(app, &pool); // 见下文 helper 说明
    let (user_cookie, _) = register_and_login(&app, "pleb").await;
    let (admin_cookie, admin_csrf) = register_and_login(&app, "adminuser").await;

    let forbidden = request(&app, Method::GET, "/api/admin/feedback?limit=10", Some(user_cookie.as_str()), None, None).await;
    assert_eq!(forbidden.status(), StatusCode::FORBIDDEN);

    let response = json_request(
        &app,
        Method::POST,
        "/api/feedback",
        Some(user_cookie.as_str()),
        Some(csrf_for(&app, "pleb").await.as_str()),  // 见 helper 说明
        serde_json::json!({ "content": "第一条" }),
    )
    .await;
    assert_eq!(response.status(), StatusCode::CREATED);

    let list = request(&app, Method::GET, "/api/admin/feedback?limit=10", Some(admin_cookie.as_str()), None, None).await;
    assert_eq!(list.status(), StatusCode::OK);
    let body = response_json(list).await;
    assert_eq!(body["total"], 1);
    assert_eq!(body["items"][0]["username"], "pleb");
    assert_eq!(body["items"][0]["content"], "第一条");
}
```

**注意（implementer）**：`feedback_app` / `register_and_login` / `json_request` / `request` / `response_json` / `session_cookie` / `csrf_for` helper 按 `tests/admin_http.rs` 既有模式完整实现（该文件 151-172 `login`、652-679 `request_with_body`、681 `session_cookie`、83-96 `wired_app` 可参考；`admin_username` 配置用 `identity.with_admin_username(Arc::from(ADMIN_USERNAME))` + `with_admin_store(PostgresAdminStore::new(pool.clone()))`）。`build_admin_router` 的职责是给 feedback_app 加上 admin 身份——更简单的实现是：`feedback_app` 直接接受一个 `admin: bool` 参数（true 时 wire admin username/store），测试里先建 admin 版 app 再注册两个账号。若 helper 结构有出入，以 admin_http.rs 既有模式为准，断言不变。

- [ ] **Step 2: 跑测试确认失败**

Run: `~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe test --test feedback_http`
Expected: 编译失败（PostgresFeedbackStore / 路由不存在）

- [ ] **Step 3: feedback_store.rs**

创建 `D:\mapflow-server\src\adapters\postgres\feedback_store.rs`：

```rust
use sqlx::postgres::PgPool;
use uuid::Uuid;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FeedbackStoreError {
    InvalidInput,
    StorageUnavailable,
}

impl std::fmt::Display for FeedbackStoreError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput => formatter.write_str("feedback content is invalid"),
            Self::StorageUnavailable => formatter.write_str("feedback storage unavailable"),
        }
    }
}

impl std::error::Error for FeedbackStoreError {}

#[derive(Clone, Debug)]
pub struct PostgresFeedbackStore {
    pool: PgPool,
}

impl PostgresFeedbackStore {
    #[must_use]
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn submit(
        &self,
        account_id: Uuid,
        content: &str,
    ) -> Result<(), FeedbackStoreError> {
        let content = content.trim();
        if content.is_empty() || content.chars().count() > 2000 {
            return Err(FeedbackStoreError::InvalidInput);
        }
        sqlx::query(
            "INSERT INTO user_feedback (feedback_id, account_id, content) VALUES ($1, $2, $3)",
        )
        .bind(Uuid::now_v7())
        .bind(account_id)
        .bind(content)
        .execute(&self.pool)
        .await
        .map_err(|_| FeedbackStoreError::StorageUnavailable)?;
        Ok(())
    }
}
```

- [ ] **Step 4: application/admin.rs 加反馈类型 + trait 方法**

`D:\mapflow-server\src\application\admin.rs`（AdminAccount 定义附近）：

```rust
/// 一条用户反馈（管理端列表）。
#[derive(Clone, Debug)]
pub struct AdminFeedback {
    pub feedback_id: Uuid,
    pub username: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

/// 反馈分页结果。
#[derive(Clone, Debug)]
pub struct FeedbackPage {
    pub items: Vec<AdminFeedback>,
    pub total: i64,
}
```

`AdminStore` trait（98 行附近）加方法：

```rust
    /// 分页读取用户反馈（按时间倒序，含提交者用户名）。
    ///
    /// # Errors
    ///
    /// Returns [`AdminStoreError::StorageUnavailable`] when the database is unreachable.
    async fn list_feedback(&self, limit: i64, offset: i64) -> Result<FeedbackPage, AdminStoreError>;
```

- [ ] **Step 5: admin_store.rs 实现 list_feedback**

`D:\mapflow-server\src\adapters\postgres\admin_store.rs`（list_accounts 之后）：

```rust
    async fn list_feedback(&self, limit: i64, offset: i64) -> Result<FeedbackPage, AdminStoreError> {
        let total: i64 = sqlx::query_scalar("SELECT count(*) FROM user_feedback")
            .fetch_one(&self.pool)
            .await
            .map_err(map_storage_failure)?;
        let rows: Vec<(Uuid, String, String, DateTime<Utc>)> = sqlx::query_as(
            "SELECT f.feedback_id, a.username_display, f.content, f.created_at \
             FROM user_feedback f JOIN accounts a ON a.account_id = f.account_id \
             ORDER BY f.created_at DESC, f.feedback_id LIMIT $1 OFFSET $2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(map_storage_failure)?;
        Ok(FeedbackPage {
            items: rows
                .into_iter()
                .map(|(feedback_id, username, content, created_at)| AdminFeedback {
                    feedback_id,
                    username,
                    content,
                    created_at,
                })
                .collect(),
            total,
        })
    }
```

import 加 `FeedbackPage`、`AdminFeedback`（文件顶部 `use crate::application::admin::{...}` 或 crate 顶层，按既有风格）。`DateTime` 已在文件内使用（AccountRow 用 `DateTime<Utc>`），确认 import 存在。

- [ ] **Step 6: http/feedback.rs**

创建 `D:\mapflow-server\src\http\feedback.rs`：

```rust
use axum::extract::{Json, State, rejection::JsonRejection};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;

use super::auth::{map_json_rejection, require_mutation_identity};
use crate::adapters::postgres::FeedbackStoreError;
use crate::{FeedbackHttpState, PublicAppState, ServiceError};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct SubmitFeedbackRequest {
    content: String,
}

pub(crate) async fn submit(
    State(state): State<PublicAppState>,
    headers: HeaderMap,
    request: Result<Json<SubmitFeedbackRequest>, JsonRejection>,
) -> Result<Response, ServiceError> {
    let current = require_mutation_identity(&state, &headers).await?;
    let Json(body) = request.map_err(map_json_rejection)?;
    let feedback = feedback_state(&state)?;
    feedback
        .store
        .submit(current.account_id(), &body.content)
        .await
        .map_err(map_feedback_error)?;
    let mut response = StatusCode::CREATED.into_response();
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok(response)
}

fn feedback_state(state: &PublicAppState) -> Result<&FeedbackHttpState, ServiceError> {
    state.feedback.as_deref().ok_or(ServiceError::NotFound)
}

const fn map_feedback_error(error: FeedbackStoreError) -> ServiceError {
    match error {
        FeedbackStoreError::InvalidInput => ServiceError::InvalidRequest,
        FeedbackStoreError::StorageUnavailable => ServiceError::Unavailable,
    }
}
```

- [ ] **Step 7: http/admin.rs 加反馈列表 handler**

`D:\mapflow-server\src\http\admin.rs`（audit_events 之后）：

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FeedbackResponse {
    items: Vec<AdminFeedbackResponse>,
    total: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AdminFeedbackResponse {
    feedback_id: Uuid,
    username: String,
    content: String,
    created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct FeedbackListQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

pub(crate) async fn feedback(
    State(state): State<PublicAppState>,
    headers: HeaderMap,
    query: Result<Query<FeedbackListQuery>, QueryRejection>,
) -> Result<Response, ServiceError> {
    require_admin(&state, &headers).await?;
    let Query(query) = query.map_err(|_| ServiceError::InvalidRequest)?;
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    let page = admin_store(&state)?
        .list_feedback(limit, offset)
        .await
        .map_err(map_admin_store_error)?;
    Ok(admin_json_response(FeedbackResponse {
        items: page
            .items
            .into_iter()
            .map(|item| AdminFeedbackResponse {
                feedback_id: item.feedback_id,
                username: item.username,
                content: item.content,
                created_at: item.created_at,
            })
            .collect(),
        total: page.total,
    }))
}
```

（Query/QueryRejection import 已在文件顶部；`AdminFeedback` 类型从 crate 顶层 import。）

- [ ] **Step 8: app.rs + runtime.rs + server.rs + lib.rs + mod.rs 接线**

`app.rs`：

```rust
#[derive(Clone)]
pub struct FeedbackHttpState {
    pub(crate) store: PostgresFeedbackStore,
}

impl FeedbackHttpState {
    #[must_use]
    pub const fn new(store: PostgresFeedbackStore) -> Self {
        Self { store }
    }
}
```

`PublicAppState` 加 `pub(crate) feedback: Option<Arc<FeedbackHttpState>>`（`new()` 初始 `None`）+ builder `with_feedback`。路由：

```rust
        .route("/api/feedback", post(feedback::submit))
```

admin block 内加：

```rust
            .route("/api/admin/feedback", get(admin::feedback))
```

`use crate::http::{...}` 加 `feedback`。

`runtime.rs`：返回 6-tuple（加 `PostgresFeedbackStore`，插在 `PostgresCreditStore` 后）；`bootstrap_identity_services` 在 `PostgresCreditStore::new(pool.clone())` 后加 `let feedback_store = PostgresFeedbackStore::new(pool.clone());`；`Ok((..., credit_store, feedback_store))`。

`server.rs`：解构 6-tuple，`let feedback = FeedbackHttpState::new(feedback_store);`，chain `.with_feedback(feedback)`。

`lib.rs`：`pub use adapters::postgres::{...}` 加 `PostgresFeedbackStore`；`pub use app::{...}` 加 `FeedbackHttpState`。

`adapters/postgres/mod.rs`：`mod feedback_store;` + `pub use feedback_store::PostgresFeedbackStore;`

`http/mod.rs`：`pub(crate) mod feedback;`

- [ ] **Step 9: 跑测试确认通过**

Run: `~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe test --test feedback_http`
Expected: 4 个测试全过

- [ ] **Step 10: fmt + clippy + 提交**

```bash
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe fmt --check
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe clippy --all-targets
git add src/adapters/postgres/feedback_store.rs src/http/feedback.rs tests/feedback_http.rs src/application/admin.rs src/adapters/postgres/admin_store.rs src/http/admin.rs src/app.rs src/runtime.rs src/server.rs src/lib.rs src/adapters/postgres/mod.rs src/http/mod.rs
git commit -m "feat: 用户反馈提交与管理端分页列表"
```

Expected: 干净通过

---

### Task 5: 公告后端（未读/已读 + 管理端新建/删除）

公告系统：`GET /api/announcements`（登录，含未读 id）、`POST /api/announcements/{id}/read`（幂等 204）、管理端 `GET/POST /api/admin/announcements`、`DELETE /api/admin/announcements/{id}`。

**Files:**
- Create: `D:\mapflow-server\src\adapters\postgres\announcements_store.rs`
- Create: `D:\mapflow-server\src\http\announcements.rs`
- Create: `D:\mapflow-server\tests\announcements_http.rs`
- Modify: `D:\mapflow-server\src\http\admin.rs`（3 个 admin handler）
- Modify: `D:\mapflow-server\src\app.rs`（AnnouncementsHttpState + 路由）、`D:\mapflow-server\src\runtime.rs`（7-tuple）、`D:\mapflow-server\src\server.rs`、`D:\mapflow-server\src\lib.rs`、`D:\mapflow-server\src\adapters\postgres\mod.rs`、`D:\mapflow-server\src\http\mod.rs`

**Interfaces:**
- Consumes: `ServiceError::Unavailable`、`auth::map_json_rejection`、`admin::admin_json_response` / `admin_response` / `require_mutation_admin`。
- Produces: `PostgresAnnouncementsStore`（list_for_account / mark_read / create / delete / list_with_read_counts）、`AnnouncementsHttpState`、`AnnouncementView { announcement_id, title, content, created_at, is_read }`、`AdminAnnouncement { announcement_id, title, content, created_at, read_count }`。

- [ ] **Step 1: 写失败测试（tests/announcements_http.rs）**

```rust
use axum::body::Body;
use axum::http::{Method, Request, StatusCode, header};
use axum::Router;
use sqlx::PgPool;
use tower::ServiceExt;

use mapflow_server::{
    AnnouncementsHttpState, IdentityHttpState, IdentitySecretKeys, IdentityService,
    InvitationDigestKey, PasswordPolicy, PostgresAnnouncementsStore, PostgresIdentityStore,
    PublicAppState, RegisterIdentityCommand, build_public_router,
};

mod common;

#[sqlx::test(migrations = "./migrations")]
async fn announcements_list_reports_unread_and_mark_read_is_idempotent(pool: PgPool) {
    let app = announcements_app(&pool).await;
    let (cookie, csrf) = register_and_login(&app, "announcer").await;

    let announcement_id = seed_announcement(&pool, "新功能上线", "现在可以签到领积分了").await;

    let list = request(
        &app,
        Method::GET,
        "/api/announcements",
        Some(cookie.as_str()),
        None,
        None,
    )
    .await;
    assert_eq!(list.status(), StatusCode::OK);
    let body = response_json(list).await;
    assert_eq!(body["items"].as_array().expect("items").len(), 1);
    assert_eq!(body["items"][0]["title"], "新功能上线");
    assert_eq!(body["items"][0]["isRead"], false);
    assert_eq!(body["unreadIds"][0], announcement_id.to_string());

    let read = request(
        &app,
        Method::POST,
        &format!("/api/announcements/{announcement_id}/read"),
        Some(cookie.as_str()),
        Some(csrf.as_str()),
        None,
    )
    .await;
    assert_eq!(read.status(), StatusCode::NO_CONTENT);

    let read_again = request(
        &app,
        Method::POST,
        &format!("/api/announcements/{announcement_id}/read"),
        Some(cookie.as_str()),
        Some(csrf.as_str()),
        None,
    )
    .await;
    assert_eq!(read_again.status(), StatusCode::NO_CONTENT);

    let after = request(
        &app,
        Method::GET,
        "/api/announcements",
        Some(cookie.as_str()),
        None,
        None,
    )
    .await;
    let after_body = response_json(after).await;
    assert_eq!(after_body["items"][0]["isRead"], true);
    assert_eq!(after_body["unreadIds"].as_array().expect("unreadIds").len(), 0);
}

#[sqlx::test(migrations = "./migrations")]
async fn announcements_list_requires_login(pool: PgPool) {
    let app = announcements_app(&pool).await;

    let response = request(&app, Method::GET, "/api/announcements", None, None, None).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[sqlx::test(migrations = "./migrations")]
async fn admin_announcement_create_list_and_delete(pool: PgPool) {
    let app = announcements_admin_app(&pool).await;
    let (admin_cookie, admin_csrf) = register_and_login(&app, "adminuser").await;
    let (user_cookie, _) = register_and_login(&app, "reader").await;

    let created = json_request(
        &app,
        Method::POST,
        "/api/admin/announcements",
        Some(admin_cookie.as_str()),
        Some(admin_csrf.as_str()),
        serde_json::json!({ "title": "群聊地址", "content": "欢迎加入群聊" }),
    )
    .await;
    assert_eq!(created.status(), StatusCode::OK);
    let created_body = response_json(created).await;
    let announcement_id = created_body["announcementId"]
        .as_str()
        .expect("announcement id")
        .to_owned();

    let forbidden = json_request(
        &app,
        Method::POST,
        "/api/admin/announcements",
        Some(user_cookie.as_str()),
        Some(admin_csrf.as_str()),
        serde_json::json!({ "title": "x", "content": "y" }),
    )
    .await;
    assert_eq!(forbidden.status(), StatusCode::FORBIDDEN);

    let list = request(
        &app,
        Method::GET,
        "/api/admin/announcements",
        Some(admin_cookie.as_str()),
        None,
        None,
    )
    .await;
    assert_eq!(list.status(), StatusCode::OK);
    let list_body = response_json(list).await;
    assert_eq!(list_body["items"][0]["title"], "群聊地址");
    assert_eq!(list_body["items"][0]["readCount"], 0);

    let deleted = request(
        &app,
        Method::DELETE,
        &format!("/api/admin/announcements/{announcement_id}"),
        Some(admin_cookie.as_str()),
        Some(admin_csrf.as_str()),
        None,
    )
    .await;
    assert_eq!(deleted.status(), StatusCode::NO_CONTENT);

    let after = request(
        &app,
        Method::GET,
        "/api/admin/announcements",
        Some(admin_cookie.as_str()),
        None,
        None,
    )
    .await;
    let after_body = response_json(after).await;
    assert_eq!(after_body["items"].as_array().expect("items").len(), 0);
}

#[sqlx::test(migrations = "./migrations")]
async fn admin_announcement_delete_removes_reads_then_announcement(pool: PgPool) {
    let app = announcements_admin_app(&pool).await;
    let (admin_cookie, admin_csrf) = register_and_login(&app, "adminuser").await;
    let (user_cookie, user_csrf) = register_and_login(&app, "reader2").await;
    let announcement_id = seed_announcement(&pool, "待删除", "内容").await;

    request(
        &app,
        Method::POST,
        &format!("/api/announcements/{announcement_id}/read"),
        Some(user_cookie.as_str()),
        Some(user_csrf.as_str()),
        None,
    )
    .await;

    let deleted = request(
        &app,
        Method::DELETE,
        &format!("/api/admin/announcements/{announcement_id}"),
        Some(admin_cookie.as_str()),
        Some(admin_csrf.as_str()),
        None,
    )
    .await;
    assert_eq!(deleted.status(), StatusCode::NO_CONTENT);

    let reads: i64 = sqlx::query_scalar("SELECT count(*) FROM announcement_reads")
        .fetch_one(&pool)
        .await
        .expect("reads count");
    let announcements: i64 = sqlx::query_scalar("SELECT count(*) FROM announcements")
        .fetch_one(&pool)
        .await
        .expect("announcements count");
    assert_eq!(reads, 0);
    assert_eq!(announcements, 0);
}
```

**注意（implementer）**：helper（`announcements_app` / `announcements_admin_app` / `register_and_login` / `json_request` / `request` / `response_json` / `session_cookie` / `seed_announcement`）按 `tests/admin_http.rs` 既有模式实现；admin 版 app 需 `with_admin_username` + `with_admin_store`。`seed_announcement` 直接 SQL INSERT 返回 id。`DELETE` 请求需带 CSRF 头（`require_mutation_admin`）。

- [ ] **Step 2: 跑测试确认失败**

Run: `~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe test --test announcements_http`
Expected: 编译失败（store / 路由不存在）

- [ ] **Step 3: announcements_store.rs**

创建 `D:\mapflow-server\src\adapters\postgres\announcements_store.rs`：

```rust
use chrono::{DateTime, Utc};
use sqlx::postgres::{PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AnnouncementStoreError {
    InvalidInput,
    StorageUnavailable,
}

impl std::fmt::Display for AnnouncementStoreError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput => formatter.write_str("announcement content is invalid"),
            Self::StorageUnavailable => formatter.write_str("announcement storage unavailable"),
        }
    }
}

impl std::error::Error for AnnouncementStoreError {}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AnnouncementView {
    pub announcement_id: Uuid,
    pub title: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub is_read: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminAnnouncement {
    pub announcement_id: Uuid,
    pub title: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub read_count: i64,
}

#[derive(Clone, Debug)]
pub struct PostgresAnnouncementsStore {
    pool: PgPool,
}

impl PostgresAnnouncementsStore {
    #[must_use]
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list_for_account(
        &self,
        account_id: Uuid,
    ) -> Result<Vec<AnnouncementView>, AnnouncementStoreError> {
        let rows: Vec<(Uuid, String, String, DateTime<Utc>, bool)> = sqlx::query_as(
            "SELECT a.announcement_id, a.title, a.content, a.created_at, \
                    (r.account_id IS NOT NULL) AS is_read \
             FROM announcements a \
             LEFT JOIN announcement_reads r \
               ON r.announcement_id = a.announcement_id AND r.account_id = $1 \
             ORDER BY a.created_at DESC, a.announcement_id",
        )
        .bind(account_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|_| AnnouncementStoreError::StorageUnavailable)?;
        Ok(rows
            .into_iter()
            .map(|(announcement_id, title, content, created_at, is_read)| AnnouncementView {
                announcement_id,
                title,
                content,
                created_at,
                is_read,
            })
            .collect())
    }

    /// 幂等：重复标记无害；公告不存在（FK 23503）也视为成功。
    pub async fn mark_read(
        &self,
        account_id: Uuid,
        announcement_id: Uuid,
    ) -> Result<(), AnnouncementStoreError> {
        let result = sqlx::query(
            "INSERT INTO announcement_reads (account_id, announcement_id) \
             VALUES ($1, $2) ON CONFLICT DO NOTHING",
        )
        .bind(account_id)
        .bind(announcement_id)
        .execute(&self.pool)
        .await;
        match result {
            Ok(_) => Ok(()),
            Err(error) if error.as_database_error().is_some_and(|db| db.code() == Some("23503")) => {
                Ok(())
            }
            Err(_) => Err(AnnouncementStoreError::StorageUnavailable),
        }
    }

    pub async fn create(
        &self,
        title: &str,
        content: &str,
    ) -> Result<Uuid, AnnouncementStoreError> {
        let title = title.trim();
        let content = content.trim();
        if title.is_empty() || title.chars().count() > 100 {
            return Err(AnnouncementStoreError::InvalidInput);
        }
        if content.is_empty() || content.chars().count() > 5000 {
            return Err(AnnouncementStoreError::InvalidInput);
        }
        let announcement_id = Uuid::now_v7();
        sqlx::query(
            "INSERT INTO announcements (announcement_id, title, content) VALUES ($1, $2, $3)",
        )
        .bind(announcement_id)
        .bind(title)
        .bind(content)
        .execute(&self.pool)
        .await
        .map_err(|_| AnnouncementStoreError::StorageUnavailable)?;
        Ok(announcement_id)
    }

    /// 两步删除：同一事务内先删已读记录，再删公告本身。
    pub async fn delete(&self, announcement_id: Uuid) -> Result<bool, AnnouncementStoreError> {
        let mut transaction = self
            .pool
            .begin()
            .await
            .map_err(|_| AnnouncementStoreError::StorageUnavailable)?;
        sqlx::query("DELETE FROM announcement_reads WHERE announcement_id = $1")
            .bind(announcement_id)
            .execute(&mut *transaction)
            .await
            .map_err(|_| AnnouncementStoreError::StorageUnavailable)?;
        let deleted = sqlx::query("DELETE FROM announcements WHERE announcement_id = $1")
            .bind(announcement_id)
            .execute(&mut *transaction)
            .await
            .map_err(|_| AnnouncementStoreError::StorageUnavailable)?;
        transaction
            .commit()
            .await
            .map_err(|_| AnnouncementStoreError::StorageUnavailable)?;
        Ok(deleted.rows_affected() == 1)
    }

    pub async fn list_with_read_counts(
        &self,
    ) -> Result<Vec<AdminAnnouncement>, AnnouncementStoreError> {
        let rows: Vec<(Uuid, String, String, DateTime<Utc>, i64)> = sqlx::query_as(
            "SELECT a.announcement_id, a.title, a.content, a.created_at, \
                    (SELECT count(*) FROM announcement_reads r \
                     WHERE r.announcement_id = a.announcement_id) \
             FROM announcements a \
             ORDER BY a.created_at DESC, a.announcement_id",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|_| AnnouncementStoreError::StorageUnavailable)?;
        Ok(rows
            .into_iter()
            .map(|(announcement_id, title, content, created_at, read_count)| AdminAnnouncement {
                announcement_id,
                title,
                content,
                created_at,
                read_count,
            })
            .collect())
    }
}
```

（`Transaction`/`Postgres` import 若未用（delete 用了）保留；`sqlx::Row` 不需要。）

- [ ] **Step 4: http/announcements.rs（public 部分）**

创建 `D:\mapflow-server\src\http\announcements.rs`：

```rust
use axum::extract::{Path, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use uuid::Uuid;

use super::auth::{require_current_identity, require_mutation_identity};
use crate::adapters::postgres::AnnouncementStoreError;
use crate::{AnnouncementsHttpState, PublicAppState, ServiceError};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AnnouncementsResponse {
    items: Vec<AnnouncementResponse>,
    unread_ids: Vec<Uuid>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AnnouncementResponse {
    announcement_id: Uuid,
    title: String,
    content: String,
    created_at: chrono::DateTime<chrono::Utc>,
    is_read: bool,
}

pub(crate) async fn list(
    State(state): State<PublicAppState>,
    headers: HeaderMap,
) -> Result<Response, ServiceError> {
    let current = require_current_identity(&state, &headers).await?;
    let announcements = announcements_state(&state)?;
    let items = announcements
        .store
        .list_for_account(current.account_id())
        .await
        .map_err(map_announcement_error)?;
    let unread_ids = items
        .iter()
        .filter(|item| !item.is_read)
        .map(|item| item.announcement_id)
        .collect();
    Ok(no_store_json(
        StatusCode::OK,
        AnnouncementsResponse {
            items: items
                .into_iter()
                .map(|item| AnnouncementResponse {
                    announcement_id: item.announcement_id,
                    title: item.title,
                    content: item.content,
                    created_at: item.created_at,
                    is_read: item.is_read,
                })
                .collect(),
            unread_ids,
        },
    ))
}

pub(crate) async fn mark_read(
    State(state): State<PublicAppState>,
    headers: HeaderMap,
    Path(announcement_id): Path<Uuid>,
) -> Result<Response, ServiceError> {
    let current = require_mutation_identity(&state, &headers).await?;
    let announcements = announcements_state(&state)?;
    announcements
        .store
        .mark_read(current.account_id(), announcement_id)
        .await
        .map_err(map_announcement_error)?;
    let mut response = StatusCode::NO_CONTENT.into_response();
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok(response)
}

fn announcements_state(state: &PublicAppState) -> Result<&AnnouncementsHttpState, ServiceError> {
    state.announcements.as_deref().ok_or(ServiceError::NotFound)
}

const fn map_announcement_error(error: AnnouncementStoreError) -> ServiceError {
    match error {
        AnnouncementStoreError::InvalidInput => ServiceError::InvalidRequest,
        AnnouncementStoreError::StorageUnavailable => ServiceError::Unavailable,
    }
}

fn no_store_json<T: Serialize>(status: StatusCode, body: T) -> Response {
    let mut response = (status, Json(body)).into_response();
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}
```

- [ ] **Step 5: http/admin.rs 加公告 3 handler**

`D:\mapflow-server\src\http\admin.rs`（feedback handler 之后）：

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AdminAnnouncementsResponse {
    items: Vec<AdminAnnouncementResponse>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AdminAnnouncementResponse {
    announcement_id: Uuid,
    title: String,
    content: String,
    created_at: DateTime<Utc>,
    read_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AdminAnnouncementCreatedResponse {
    announcement_id: Uuid,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct CreateAnnouncementRequest {
    title: String,
    content: String,
}

fn announcements_state(state: &PublicAppState) -> Result<&crate::AnnouncementsHttpState, ServiceError> {
    state.announcements.as_deref().ok_or(ServiceError::NotFound)
}

pub(crate) async fn announcements_list(
    State(state): State<PublicAppState>,
    headers: HeaderMap,
) -> Result<Response, ServiceError> {
    require_admin(&state, &headers).await?;
    let items = announcements_state(&state)?
        .store
        .list_with_read_counts()
        .await
        .map_err(map_announcement_error)?;
    Ok(admin_json_response(AdminAnnouncementsResponse {
        items: items
            .into_iter()
            .map(|item| AdminAnnouncementResponse {
                announcement_id: item.announcement_id,
                title: item.title,
                content: item.content,
                created_at: item.created_at,
                read_count: item.read_count,
            })
            .collect(),
    }))
}

pub(crate) async fn create_announcement(
    State(state): State<PublicAppState>,
    headers: HeaderMap,
    request: Result<Json<CreateAnnouncementRequest>, JsonRejection>,
) -> Result<Response, ServiceError> {
    require_mutation_admin(&state, &headers).await?;
    let Json(body) = request.map_err(map_json_rejection)?;
    let announcement_id = announcements_state(&state)?
        .store
        .create(&body.title, &body.content)
        .await
        .map_err(map_announcement_error)?;
    Ok(admin_json_response(AdminAnnouncementCreatedResponse {
        announcement_id,
    }))
}

pub(crate) async fn delete_announcement(
    State(state): State<PublicAppState>,
    headers: HeaderMap,
    Path(announcement_id): Path<Uuid>,
) -> Result<Response, ServiceError> {
    require_mutation_admin(&state, &headers).await?;
    let deleted = announcements_state(&state)?
        .store
        .delete(announcement_id)
        .await
        .map_err(map_announcement_error)?;
    if !deleted {
        return Err(ServiceError::NotFound);
    }
    Ok(admin_response(StatusCode::NO_CONTENT.into_response()))
}

const fn map_announcement_error(error: crate::adapters::postgres::AnnouncementStoreError) -> ServiceError {
    match error {
        crate::adapters::postgres::AnnouncementStoreError::InvalidInput => ServiceError::InvalidRequest,
        crate::adapters::postgres::AnnouncementStoreError::StorageUnavailable => ServiceError::Unavailable,
    }
}
```

（import：`map_json_rejection` 从 `super::auth` 引入；`Json`/`JsonRejection` 已在顶部 import。）

- [ ] **Step 6: app.rs + runtime.rs + server.rs + lib.rs + mod.rs 接线**

`app.rs`：

```rust
#[derive(Clone)]
pub struct AnnouncementsHttpState {
    pub(crate) store: PostgresAnnouncementsStore,
}

impl AnnouncementsHttpState {
    #[must_use]
    pub const fn new(store: PostgresAnnouncementsStore) -> Self {
        Self { store }
    }
}
```

`PublicAppState` 加 `pub(crate) announcements: Option<Arc<AnnouncementsHttpState>>`（`new()` 初始 `None`）+ `with_announcements`。路由：

```rust
        .route("/api/announcements", get(announcements::list))
        .route(
            "/api/announcements/{announcement_id}/read",
            post(announcements::mark_read),
        )
```

admin block 内加：

```rust
            .route("/api/admin/announcements", get(admin::announcements_list).post(admin::create_announcement))
            .route(
                "/api/admin/announcements/{announcement_id}",
                axum::routing::delete(admin::delete_announcement),
            )
```

`use crate::http::{...}` 加 `announcements`。

`runtime.rs`：返回 7-tuple（加 `PostgresAnnouncementsStore`）；`bootstrap_identity_services` 加 `let announcements_store = PostgresAnnouncementsStore::new(pool.clone());`；`Ok((..., credit_store, feedback_store, announcements_store))`。

`server.rs`：解构 7-tuple，`let announcements = AnnouncementsHttpState::new(announcements_store);`，chain `.with_feedback(feedback).with_announcements(announcements)`。

`lib.rs`：pub use 加 `PostgresAnnouncementsStore`、`AnnouncementsHttpState`。

`adapters/postgres/mod.rs`：`mod announcements_store;` + `pub use announcements_store::PostgresAnnouncementsStore;`

`http/mod.rs`：`pub(crate) mod announcements;`

- [ ] **Step 7: 跑测试确认通过**

Run: `~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe test --test announcements_http`
Expected: 4 个测试全过

- [ ] **Step 8: fmt + clippy + 提交**

```bash
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe fmt --check
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe clippy --all-targets
git add src/adapters/postgres/announcements_store.rs src/http/announcements.rs tests/announcements_http.rs src/http/admin.rs src/app.rs src/runtime.rs src/server.rs src/lib.rs src/adapters/postgres/mod.rs src/http/mod.rs
git commit -m "feat: 公告系统（未读/已读 + 管理端新建删除）"
```

Expected: 干净通过

---

### Task 6: 管理端积分余额列

AccountsTab 数据链路：`AdminAccount` 加 `credit_balance` 字段，SQL 子查询求和，HTTP 响应透出。

**Files:**
- Modify: `D:\mapflow-server\src\application\admin.rs`（AdminAccount）
- Modify: `D:\mapflow-server\src\adapters\postgres\admin_store.rs`（list_accounts SQL + tuple）
- Modify: `D:\mapflow-server\src\http\admin.rs`（AdminAccountResponse + accounts handler）
- Modify: `D:\mapflow-server\tests\postgres_admin_store.rs`（断言）
- Modify: `D:\mapflow-server\tests\admin_http.rs`（断言）

**Interfaces:**
- Consumes: `credit_ledger` 表（Task 1 迁移）。
- Produces: `AdminAccount.credit_balance: i64`（camelCase 响应字段 `creditBalance`）。

- [ ] **Step 1: 写失败测试（追加断言）**

`D:\mapflow-server\tests\postgres_admin_store.rs` 的 `list_accounts` 测试（约 431-450，按字段断言）中，seed 一条 credit_ledger 行后断言 `credit_balance`：

```rust
    sqlx::query(
        "INSERT INTO credit_ledger (entry_id, account_id, kind, amount, balance_after) \
         VALUES ($1, $2, 'signin', 5, 5)",
    )
    .bind(Uuid::new_v4())
    .bind(account_id)
    .execute(&pool)
    .await
    .expect("seed credit");

    // 在既有断言中追加：
    assert_eq!(account.credit_balance, 5);
```

（以该测试实际变量名为准；若列表测试用 `list_accounts` 返回 Vec 遍历断言，找到对应账号行加断言。）

`D:\mapflow-server\tests\admin_http.rs` 的 accounts 测试：断言响应 JSON 含 `creditBalance` 字段：

```rust
    assert_eq!(body["accounts"][0]["creditBalance"], 0);
```

（以既有 accounts 测试结构为准；字段缺失会导致 `body["creditBalance"]` 为 Null，断言失败。）

- [ ] **Step 2: 跑测试确认失败**

Run: `~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe test --test postgres_admin_store --test admin_http`
Expected: credit_balance 相关断言失败（字段不存在 / 编译错误）

- [ ] **Step 3: application/admin.rs**

`AdminAccount`（46-59）加字段：

```rust
    /// 该账号积分余额（credit_ledger 求和）。
    pub credit_balance: i64,
```

- [ ] **Step 4: admin_store.rs list_accounts**

SQL（201-217）在 `active_minutes` 子查询后加：

```sql
                   (SELECT COALESCE(SUM(amount), 0)::BIGINT FROM credit_ledger \
                    WHERE account_id = a.account_id) \
```

tuple 解构（226-237）加 `credit_balance`，`AdminAccount { ... }`（238-250）加 `credit_balance`。

- [ ] **Step 5: http/admin.rs**

`AdminAccountResponse`（63-74）加 `credit_balance: i64,`；`accounts` handler 的 `AdminAccountResponse::from` 映射加 `credit_balance: account.credit_balance`（若映射是手写字段则直接加一行）。

- [ ] **Step 6: 跑测试确认通过**

Run: `~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe test --test postgres_admin_store --test admin_http`
Expected: 全过（既有按字段断言不受加字段影响）

- [ ] **Step 7: fmt + clippy + 提交**

```bash
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe fmt --check
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe clippy --all-targets
git add src/application/admin.rs src/adapters/postgres/admin_store.rs src/http/admin.rs tests/postgres_admin_store.rs tests/admin_http.rs
git commit -m "feat: 管理端用户列表显示积分余额"
```

Expected: 干净通过

---

### Task 7: 前端积分（client + CreditPill + 生成方式选择 + App 接线）

前端积分功能：`creditClient`（me/signin）、header 的「积分 X · 签到」胶囊、生成方式选择器支持积分支付（可选 credit prop 保持旧测试兼容）、App 查询接线。

**Files:**
- Create: `D:\MapFlow-publish\src\features\credit\creditClient.ts`
- Create: `D:\MapFlow-publish\src\features\credit\CreditPill.tsx`
- Create: `D:\MapFlow-publish\src\features\credit\creditClient.test.ts`
- Modify: `D:\MapFlow-publish\src\features\tree-generation\GenerationFundingSelector.tsx`
- Modify: `D:\MapFlow-publish\src\features\tree-generation\TreeGenerationDialog.tsx`
- Modify: `D:\MapFlow-publish\src\App.tsx`
- Modify: `D:\MapFlow-publish\src\features\tree-generation\GenerationFundingSelector.test.tsx`

**Interfaces:**
- Consumes: `IdentityApiError`（identityClient）、`useIdentity()`（session）、`readPlatformGenerationEntitlements` 的无参模式。
- Produces: `readCreditSummary(): Promise<CreditSummary>`、`signInForCredit(csrfToken): Promise<CreditSigninResult>`、`CreditPill`、`GenerationFundingSelectorProps.credit?: CreditSummary | null`（可选 prop，undefined → 旧行为）、`TreeGenerationDialogProps.credit: CreditSummary | null`。

- [ ] **Step 1: 写失败测试（creditClient.test.ts）**

创建 `D:\MapFlow-publish\src\features\credit\creditClient.test.ts`（仿 adminClient.test.ts 的 mock fetch 模式）：

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCreditSummary, signInForCredit } from './creditClient';
import { IdentityApiError } from '../identity/identityClient';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('creditClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses the credit summary response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          balance: 4,
          signedInToday: false,
          freeRemaining: 3,
          pricePerTree: 3,
        }),
      ),
    );

    const summary = await readCreditSummary();

    expect(summary).toEqual({
      balance: 4,
      signedInToday: false,
      freeRemaining: 3,
      pricePerTree: 3,
    });
    expect(fetch).toHaveBeenCalledWith('/api/credit/me', expect.anything());
  });

  it('rejects a malformed credit summary response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { balance: 'nope' })),
    );

    await expect(readCreditSummary()).rejects.toThrow(IdentityApiError);
  });

  it('sends the CSRF token when signing in and parses the result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { balance: 7, awarded: 3 })),
    );

    const result = await signInForCredit('csrf-123');

    expect(result).toEqual({ balance: 7, awarded: 3 });
    const [path, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/credit/signin');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'X-CSRF-Token': 'csrf-123' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd D:\MapFlow-publish && npm test -- creditClient`
Expected: 失败（模块不存在）

- [ ] **Step 3: creditClient.ts**

创建 `D:\MapFlow-publish\src\features\credit\creditClient.ts`：

```ts
import { IdentityApiError } from '../identity/identityClient';

export interface CreditSummary {
  balance: number;
  signedInToday: boolean;
  freeRemaining: number;
  pricePerTree: number;
}

export interface CreditSigninResult {
  balance: number;
  awarded: number;
}

export async function readCreditSummary(): Promise<CreditSummary> {
  const response = await request('/api/credit/me', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(response);
  if (
    !isRecord(body) ||
    typeof body.balance !== 'number' ||
    typeof body.signedInToday !== 'boolean' ||
    typeof body.freeRemaining !== 'number' ||
    typeof body.pricePerTree !== 'number'
  ) {
    throw invalidResponseError();
  }
  return {
    balance: body.balance,
    signedInToday: body.signedInToday,
    freeRemaining: body.freeRemaining,
    pricePerTree: body.pricePerTree,
  };
}

export async function signInForCredit(csrfToken: string): Promise<CreditSigninResult> {
  const response = await request('/api/credit/signin', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken,
    },
  });
  const body = await readJson(response);
  if (!isRecord(body) || typeof body.balance !== 'number' || typeof body.awarded !== 'number') {
    throw invalidResponseError();
  }
  return { balance: body.balance, awarded: body.awarded };
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new IdentityApiError(0, 'credit.network_unavailable', '积分服务暂时无法连接。');
  }
  if (!response.ok) {
    throw await parseError(response);
  }
  return response;
}

async function parseError(response: Response): Promise<IdentityApiError> {
  try {
    const body: unknown = await response.json();
    if (
      isRecord(body) &&
      isRecord(body.error) &&
      typeof body.error.code === 'string' &&
      typeof body.error.message === 'string'
    ) {
      return new IdentityApiError(
        response.status,
        body.error.code,
        body.error.message,
        typeof body.error.traceId === 'string' ? body.error.traceId : undefined,
      );
    }
  } catch {
    // 兜底刻意不暴露格式错误的服务端响应体。
  }
  return new IdentityApiError(
    response.status,
    'credit.request_failed',
    response.status === 409 ? '今天已经签到过了，明天再来吧。' : '积分请求失败，请稍后再试。',
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw invalidResponseError();
  }
}

function invalidResponseError(): IdentityApiError {
  return new IdentityApiError(502, 'credit.invalid_response', '积分服务返回了无法识别的结果。');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```

- [ ] **Step 4: CreditPill.tsx**

创建 `D:\MapFlow-publish\src\features\credit\CreditPill.tsx`：

```tsx
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useIdentity } from '../identity/IdentityContext';
import { signInForCredit, type CreditSummary } from './creditClient';

interface CreditPillProps {
  credit: CreditSummary | null;
  onSignedIn: () => void;
}

export default function CreditPill({ credit, onSignedIn }: CreditPillProps) {
  const { session } = useIdentity();
  const [notice, setNotice] = useState<string | null>(null);
  const signin = useMutation({
    mutationFn: () => signInForCredit(session?.csrfToken ?? ''),
    onSuccess: (result) => {
      setNotice(`签到成功，获得 ${result.awarded} 积分。`);
      onSignedIn();
    },
  });

  const signedInToday = credit?.signedInToday === true;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={signedInToday ? '今日已签到' : '签到领取积分'}
        disabled={signedInToday || signin.isPending}
        onClick={() => signin.mutate()}
        className="rounded-xl border border-cyan-800 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {signin.isPending
          ? '签到中…'
          : `积分 ${credit?.balance ?? 0} · ${signedInToday ? '已签到' : '签到'}`}
      </button>
      {notice && <p className="absolute right-0 top-full z-40 mt-1 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-emerald-300">{notice}</p>}
      {signin.error && (
        <p role="alert" className="absolute right-0 top-full z-40 mt-1 whitespace-nowrap rounded-lg border border-rose-700 bg-slate-900 px-3 py-1.5 text-xs text-rose-300">
          {signin.error.message}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: GenerationFundingSelector 支持积分**

`D:\MapFlow-publish\src\features\tree-generation\GenerationFundingSelector.tsx`：

```tsx
import type {
  GenerationFundingMode,
  PlatformGenerationEntitlementSummary,
} from './types';
import type { CreditSummary } from '../credit/creditClient';

interface GenerationFundingSelectorProps {
  value: GenerationFundingMode;
  platformEntitlements: PlatformGenerationEntitlementSummary | null;
  credit?: CreditSummary | null;
  onChange: (mode: GenerationFundingMode) => void;
  disabled?: boolean;
}

export default function GenerationFundingSelector({
  value,
  platformEntitlements,
  credit,
  onChange,
  disabled = false,
}: GenerationFundingSelectorProps) {
  const freeAvailable =
    platformEntitlements?.platformModeAvailable === true &&
    platformEntitlements.available > 0;
  const creditEnough = credit !== null && credit !== undefined && credit.balance >= credit.pricePerTree;
  const platformAvailable = freeAvailable || creditEnough;

  return (
    <section aria-label="技能树生成方式" className="grid gap-3 sm:grid-cols-2">
      <FundingCard
        label="选择平台免费体验"
        title={
          freeAvailable
            ? `平台免费体验 · 剩余 ${platformEntitlements?.available ?? 0} 次`
            : credit
              ? `积分生成 · 需 ${credit.pricePerTree} 积分`
              : '平台免费体验 · 剩余 0 次'
        }
        description={
          freeAvailable
            ? '无需填写 API Key；模型和参数由服务器固定。'
            : credit
              ? `当前积分 ${credit.balance}${creditEnough ? '' : '，余额不足'}` +
                (platformEntitlements?.platformModeAvailable === false ? '' : '，可用积分支付')
              : '无需填写 API Key；模型和参数由服务器固定。'
        }
        selected={value === 'platform'}
        disabled={disabled || !platformAvailable}
        onClick={() => onChange('platform')}
      />
      {/* BYOK 卡片不变 */}
    </section>
  );
}
```

**注意（implementer）**：description 文案自由组织，语义要求：免费有剩余时显示「剩余 X 次」；免费用尽且传了 credit 时标题显示「积分生成 · 需 3 积分」，积分不足时卡片禁用；未传 credit（旧调用方/旧测试）时保持旧文案「平台免费体验 · 剩余 0 次」且禁用逻辑不变。**既有测试必须保持通过**（用例 1 传 entitlements(3) 不传 credit → 标题不变；用例 2 platformModeAvailable=false 不传 credit → 按钮禁用）。

- [ ] **Step 6: TreeGenerationDialog 透传 credit**

`D:\MapFlow-publish\src\features\tree-generation\TreeGenerationDialog.tsx`：

- props 加 `credit: CreditSummary | null;`
- destructure 加 `credit,`
- `<GenerationFundingSelector>` 调用加 `credit={credit}`
- import `import type { CreditSummary } from '../credit/creditClient';`

- [ ] **Step 7: App.tsx 接线**

`D:\MapFlow-publish\src\App.tsx`：

- import `CreditPill` 与 `readCreditSummary`
- queryKey（platformEntitlementsQueryKey 旁）：

```tsx
  const creditQueryKey = ['me', accountPlayerId, 'credit'] as const;
```

- query（platformEntitlements 旁）：

```tsx
  const creditQuery = useQuery({
    queryKey: creditQueryKey,
    queryFn: readCreditSummary,
    enabled:
      accountPlayerId !== null &&
      generationCapabilities?.platformFundedEnabled === true,
    staleTime: 15 * 1000,
    retry: false,
  });
```

- header 右侧（`<IdentityAccess />` 前）：

```tsx
        <div className="flex shrink-0 items-center gap-2">
          {session &&
            generationCapabilities?.platformFundedEnabled === true && (
              <CreditPill
                credit={creditQuery.data ?? null}
                onSignedIn={() => {
                  void creditQuery.refetch();
                  void platformEntitlements.refetch();
                }}
              />
            )}
          <IdentityAccess />
        </div>
```

- TreeGenerationDialog 调用加 `credit={creditQuery.data ?? null}`；`onPlatformEntitlementsChanged` 改为同时刷新积分：

```tsx
            onPlatformEntitlementsChanged={() => {
              void platformEntitlements.refetch();
              void creditQuery.refetch();
            }}
```

- [ ] **Step 8: 追加 GenerationFundingSelector 测试**

`D:\MapFlow-publish\src\features\tree-generation\GenerationFundingSelector.test.tsx` 追加：

```tsx
  it('shows credit pricing when free entitlement is exhausted and disables below price', () => {
    render(
      <GenerationFundingSelector
        value="byok"
        platformEntitlements={{ ...entitlements(0), platformModeAvailable: false }}
        credit={{ balance: 2, signedInToday: false, freeRemaining: 0, pricePerTree: 3 }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('积分生成 · 需 3 积分')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择平台免费体验' })).toBeDisabled();
  });

  it('enables platform mode with enough credits even without free entitlement', () => {
    render(
      <GenerationFundingSelector
        value="platform"
        platformEntitlements={{ ...entitlements(0), platformModeAvailable: false }}
        credit={{ balance: 5, signedInToday: false, freeRemaining: 0, pricePerTree: 3 }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '选择平台免费体验' })).toBeEnabled();
  });
```

- [ ] **Step 9: 跑测试 + typecheck**

Run: `cd D:\MapFlow-publish && npm test && npm run typecheck`
Expected: 全过

- [ ] **Step 10: 提交**

```bash
git add src/features/credit/ src/features/tree-generation/GenerationFundingSelector.tsx src/features/tree-generation/GenerationFundingSelector.test.tsx src/features/tree-generation/TreeGenerationDialog.tsx src/App.tsx
git commit -m "feat: 前端积分展示与签到（含生成方式积分支付）"
```

Expected: 提交成功

---

### Task 8: 前端反馈 + 公告（按钮 + 弹窗 + Provider）

反馈：右下角悬浮按钮 + Dialog 提交。公告：登录后未读弹窗 Provider + 导航「公告」按钮 + 全部列表 Dialog。

**Files:**
- Create: `D:\MapFlow-publish\src\features\feedback\feedbackClient.ts`
- Create: `D:\MapFlow-publish\src\features\feedback\FeedbackButton.tsx`
- Create: `D:\MapFlow-publish\src\features\feedback\feedbackClient.test.ts`
- Create: `D:\MapFlow-publish\src\features\announcements\announcementsClient.ts`
- Create: `D:\MapFlow-publish\src\features\announcements\AnnouncementProvider.tsx`
- Create: `D:\MapFlow-publish\src\features\announcements\AnnouncementDialog.tsx`
- Create: `D:\MapFlow-publish\src\features\announcements\AnnouncementsButton.tsx`
- Create: `D:\MapFlow-publish\src\features\announcements\AnnouncementsDialog.tsx`
- Create: `D:\MapFlow-publish\src\features\announcements\announcementsClient.test.ts`
- Modify: `D:\MapFlow-publish\src\main.tsx`
- Modify: `D:\MapFlow-publish\src\App.tsx`

**Interfaces:**
- Consumes: `useIdentity()`（session + csrfToken）、`IdentityApiError`。
- Produces: `submitFeedback(content, csrfToken): Promise<void>`、`getAnnouncements(): Promise<AnnouncementsData>`（`{ items, unreadIds }`）、`markAnnouncementRead(id, csrfToken): Promise<void>`、`AnnouncementProvider`、`AnnouncementDialog`、`AnnouncementsButton`、`AnnouncementsDialog`。

- [ ] **Step 1: 写失败测试（feedbackClient.test.ts + announcementsClient.test.ts）**

创建 `D:\MapFlow-publish\src\features\feedback\feedbackClient.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitFeedback } from './feedbackClient';
import { IdentityApiError } from '../identity/identityClient';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('feedbackClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('submits feedback with CSRF and returns nothing on 201', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(201, {})),
    );

    await expect(submitFeedback('很好用', 'csrf-1')).resolves.toBeUndefined();
    const [path, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/feedback');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ content: '很好用' });
  });

  it('surfaces a rejected feedback response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          error: { code: 'request.invalid', message: '请求格式无效。', traceId: 't' },
        }),
      ),
    );

    await expect(submitFeedback('x', 'csrf-2')).rejects.toThrow(IdentityApiError);
  });
});
```

创建 `D:\MapFlow-publish\src\features\announcements\announcementsClient.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAnnouncements, markAnnouncementRead } from './announcementsClient';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('announcementsClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses announcements with unread ids', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          items: [
            {
              announcementId: 'ann-1',
              title: '新功能',
              content: '内容',
              createdAt: '2026-08-19T00:00:00Z',
              isRead: false,
            },
          ],
          unreadIds: ['ann-1'],
        }),
      ),
    );

    const data = await getAnnouncements();
    expect(data.items).toHaveLength(1);
    expect(data.unreadIds).toEqual(['ann-1']);
  });

  it('marks an announcement read via POST with CSRF', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(204, {})));

    await expect(markAnnouncementRead('ann-1', 'csrf-9')).resolves.toBeUndefined();
    const [path, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/announcements/ann-1/read');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'X-CSRF-Token': 'csrf-9' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd D:\MapFlow-publish && npm test -- feedbackClient announcementsClient`
Expected: 失败（模块不存在）

- [ ] **Step 3: feedbackClient.ts**

创建 `D:\MapFlow-publish\src\features\feedback\feedbackClient.ts`（request/parseError/readJson/isRecord/invalidResponseError 副本，与 creditClient 同构）：

```ts
import { IdentityApiError } from '../identity/identityClient';

export async function submitFeedback(
  content: string,
  csrfToken: string,
): Promise<void> {
  await request('/api/feedback', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ content }),
  });
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new IdentityApiError(0, 'feedback.network_unavailable', '反馈服务暂时无法连接。');
  }
  if (!response.ok) {
    throw await parseError(response);
  }
  return response;
}

async function parseError(response: Response): Promise<IdentityApiError> {
  try {
    const body: unknown = await response.json();
    if (
      isRecord(body) &&
      isRecord(body.error) &&
      typeof body.error.code === 'string' &&
      typeof body.error.message === 'string'
    ) {
      return new IdentityApiError(
        response.status,
        body.error.code,
        body.error.message,
        typeof body.error.traceId === 'string' ? body.error.traceId : undefined,
      );
    }
  } catch {
    // 兜底刻意不暴露格式错误的服务端响应体。
  }
  return new IdentityApiError(
    response.status,
    'feedback.request_failed',
    '反馈请求失败，请稍后再试。',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```

- [ ] **Step 4: FeedbackButton.tsx**

创建 `D:\MapFlow-publish\src\features\feedback\FeedbackButton.tsx`（z-40 悬浮按钮 + Dialog；仿现有 Dialog 模式 `fixed inset-0 z-50`）：

```tsx
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useIdentity } from '../identity/IdentityContext';
import { submitFeedback } from './feedbackClient';

export default function FeedbackButton() {
  const { session } = useIdentity();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [done, setDone] = useState(false);
  const submit = useMutation({
    mutationFn: () => submitFeedback(content, session?.csrfToken ?? ''),
    onSuccess: () => {
      setDone(true);
      setContent('');
    },
  });

  if (!session) return null;

  const close = () => {
    if (submit.isPending) return;
    setOpen(false);
    setDone(false);
    submit.reset();
  };

  const submitForm = (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    submit.mutate();
  };

  return (
    <>
      <button
        type="button"
        aria-label="意见反馈"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-lg transition hover:border-cyan-600 hover:text-white"
      >
        意见反馈
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/85 p-3 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
          >
            <h2 id="feedback-dialog-title" className="text-base font-semibold text-white">
              意见反馈
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              功能建议、遇到的问题，或者任何想说的话。
            </p>
            {done ? (
              <p className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-300">
                已收到你的反馈，感谢！
              </p>
            ) : (
              <form onSubmit={submitForm} className="mt-4">
                <textarea
                  autoFocus
                  aria-label="反馈内容"
                  required
                  maxLength={2000}
                  rows={5}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
                  placeholder="写点什么…"
                />
                {submit.error && (
                  <p role="alert" className="mt-2 text-xs text-rose-300">
                    {submit.error.message}
                  </p>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={submit.isPending || !content.trim()}
                    className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submit.isPending ? '提交中…' : '提交反馈'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 5: announcementsClient.ts**

创建 `D:\MapFlow-publish\src\features\announcements\announcementsClient.ts`：

```ts
import { IdentityApiError } from '../identity/identityClient';

export interface Announcement {
  announcementId: string;
  title: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

export interface AnnouncementsData {
  items: Announcement[];
  unreadIds: string[];
}

export async function getAnnouncements(): Promise<AnnouncementsData> {
  const response = await request('/api/announcements', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(response);
  if (!isRecord(body) || !isAnnouncementsArray(body.items) || !isStringArray(body.unreadIds)) {
    throw invalidResponseError();
  }
  return { items: body.items, unreadIds: body.unreadIds };
}

export async function markAnnouncementRead(
  announcementId: string,
  csrfToken: string,
): Promise<void> {
  await request(`/api/announcements/${announcementId}/read`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken,
    },
  });
}

function isAnnouncementsArray(value: unknown): value is Announcement[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.announcementId === 'string' &&
        typeof item.title === 'string' &&
        typeof item.content === 'string' &&
        typeof item.createdAt === 'string' &&
        typeof item.isRead === 'boolean',
    )
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new IdentityApiError(0, 'announcements.network_unavailable', '公告服务暂时无法连接。');
  }
  if (!response.ok) {
    throw await parseError(response);
  }
  return response;
}

async function parseError(response: Response): Promise<IdentityApiError> {
  try {
    const body: unknown = await response.json();
    if (
      isRecord(body) &&
      isRecord(body.error) &&
      typeof body.error.code === 'string' &&
      typeof body.error.message === 'string'
    ) {
      return new IdentityApiError(
        response.status,
        body.error.code,
        body.error.message,
        typeof body.error.traceId === 'string' ? body.error.traceId : undefined,
      );
    }
  } catch {
    // 兜底刻意不暴露格式错误的服务端响应体。
  }
  return new IdentityApiError(
    response.status,
    'announcements.request_failed',
    '公告请求失败，请稍后再试。',
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw invalidResponseError();
  }
}

function invalidResponseError(): IdentityApiError {
  return new IdentityApiError(502, 'announcements.invalid_response', '公告服务返回了无法识别的结果。');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```

- [ ] **Step 6: AnnouncementProvider + AnnouncementDialog + AnnouncementsButton + AnnouncementsDialog**

创建 `D:\MapFlow-publish\src\features\announcements\AnnouncementProvider.tsx`（登录后自动弹出未读；逐条「知道了」标记已读；全部读完后关闭）：

```tsx
import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '../identity/IdentityContext';
import { getAnnouncements, markAnnouncementRead } from './announcementsClient';
import AnnouncementDialog from './AnnouncementDialog';

export function AnnouncementProvider({ children }: { children: ReactNode }) {
  const { session } = useIdentity();
  const queryClient = useQueryClient();
  const [currentUnreadId, setCurrentUnreadId] = useState<string | null>(null);
  const completedSessionRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: ['announcements', session?.account.playerId ?? null],
    queryFn: getAnnouncements,
    enabled: session !== null,
    staleTime: 60 * 1000,
    retry: false,
  });
  const markRead = useMutation({
    mutationFn: (announcementId: string) =>
      markAnnouncementRead(announcementId, session?.csrfToken ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['announcements', session?.account.playerId ?? null],
      });
    },
  });

  const unreadIds = query.data?.unreadIds ?? [];
  const shouldShow = session !== null && !markRead.isPending && unreadIds.length > 0;
  const nextUnreadId = currentUnreadId ?? unreadIds[0] ?? null;

  // 会话切换时重置展示中的未读
  if (session && completedSessionRef.current !== session.account.playerId) {
    completedSessionRef.current = session.account.playerId;
    setCurrentUnreadId(null);
  }

  const handleDismiss = () => {
    if (!nextUnreadId) return;
    markRead.mutate(nextUnreadId);
    setCurrentUnreadId(null);
  };

  return (
    <>
      {children}
      {shouldShow && (
        <AnnouncementDialog
          announcementId={nextUnreadId ?? ''}
          title={query.data?.items.find((item) => item.announcementId === nextUnreadId)?.title ?? ''}
          content={query.data?.items.find((item) => item.announcementId === nextUnreadId)?.content ?? ''}
          remaining={unreadIds.length}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
}
```

**注意（implementer）**：`setState` 在渲染期间直接调用是反模式（React 会警告）。改为 `useEffect` 处理会话切换重置；`AnnouncementProvider` 只负责「弹未读、逐条已读、读完关闭」三件事，渲染逻辑可自由调整，但行为必须满足：(1) 登录后（session 从 null 变非 null）有未读则弹出；(2) 逐条「知道了」标记已读；(3) 全部读完自动关闭；(4) 登录状态下不阻塞主界面操作（Dialog 可关闭，关闭后同会话不再弹出，导航按钮仍可查看）。

创建 `D:\MapFlow-publish\src\features\announcements\AnnouncementDialog.tsx`：

```tsx
interface AnnouncementDialogProps {
  announcementId: string;
  title: string;
  content: string;
  remaining: number;
  onDismiss: () => void;
}

export default function AnnouncementDialog({
  announcementId,
  title,
  content,
  remaining,
  onDismiss,
}: AnnouncementDialogProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/85 p-3 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-dialog-title"
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
          公告 · 剩余 {remaining} 条未读
        </p>
        <h2 id="announcement-dialog-title" className="mt-1 text-base font-semibold text-white">
          {title}
        </h2>
        <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-300">
          {content}
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            知道了
          </button>
        </div>
      </section>
    </div>
  );
}
```

创建 `D:\MapFlow-publish\src\features\announcements\AnnouncementsButton.tsx`（导航区按钮，打开全部列表）：

```tsx
import { useState } from 'react';
import { useIdentity } from '../identity/IdentityContext';
import AnnouncementsDialog from './AnnouncementsDialog';

export default function AnnouncementsButton() {
  const { session } = useIdentity();
  const [open, setOpen] = useState(false);
  if (!session) return null;
  return (
    <>
      <button
        type="button"
        aria-label="查看公告"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
      >
        公告
      </button>
      {open && <AnnouncementsDialog onClose={() => setOpen(false)} />}
    </>
  );
}
```

创建 `D:\MapFlow-publish\src\features\announcements\AnnouncementsDialog.tsx`（全部公告倒序列表，已读标记；仿 AnnouncementDialog 外壳）：

```tsx
import { useQuery } from '@tanstack/react-query';
import { useIdentity } from '../identity/IdentityContext';
import { getAnnouncements } from './announcementsClient';

export default function AnnouncementsDialog({ onClose }: { onClose: () => void }) {
  const { session } = useIdentity();
  const query = useQuery({
    queryKey: ['announcements', session?.account.playerId ?? null],
    queryFn: getAnnouncements,
    staleTime: 30 * 1000,
  });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/85 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcements-dialog-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
              MapFlow
            </p>
            <h2 id="announcements-dialog-title" className="mt-1 text-base font-semibold text-white">
              全部公告
            </h2>
          </div>
          <button
            type="button"
            aria-label="关闭公告列表"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xl leading-none text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {query.isPending ? (
            <p className="py-8 text-center text-sm text-slate-500">正在读取公告…</p>
          ) : query.isError ? (
            <p role="alert" className="py-8 text-center text-sm text-rose-300">
              {query.error.message}
            </p>
          ) : query.data?.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">暂无公告。</p>
          ) : (
            query.data?.items.map((item) => (
              <article
                key={item.announcementId}
                className="mb-3 rounded-xl border border-slate-800 bg-slate-950/55 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      item.isRead
                        ? 'border border-slate-700 text-slate-500'
                        : 'border border-cyan-400/40 bg-cyan-400/10 text-cyan-200'
                    }`}
                  >
                    {item.isRead ? '已读' : '未读'}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">
                  {item.content}
                </p>
                <p className="mt-2 text-[10px] text-slate-600">
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 7: main.tsx + App.tsx 接线**

`D:\MapFlow-publish\src\main.tsx`（IdentityProvider 内包裹 App）：

```tsx
import { AnnouncementProvider } from './features/announcements/AnnouncementProvider';
...
      <IdentityProvider>
        <AnnouncementProvider>
          <App />
        </AnnouncementProvider>
      </IdentityProvider>
```

`D:\MapFlow-publish\src\App.tsx`：
- import `FeedbackButton` 与 `AnnouncementsButton`
- header nav（`<nav>` 之后、`<IdentityAccess />` 之前）加 `<AnnouncementsButton />`
- 主渲染树最底部（`</div>` 闭合前，`{generationDialogOpen ...}` 块之后）加 `<FeedbackButton />`（admin early-return 分支不渲染 → 天然只在 public/personal 视图显示，符合 spec）

- [ ] **Step 8: 跑测试 + typecheck**

Run: `cd D:\MapFlow-publish && npm test && npm run typecheck`
Expected: 全过

- [ ] **Step 9: 提交**

```bash
git add src/features/feedback/ src/features/announcements/ src/main.tsx src/App.tsx
git commit -m "feat: 前端反馈悬浮按钮与公告未读弹窗/列表"
```

Expected: 提交成功

---

### Task 9: 管理面板反馈/公告 Tab + 积分列

管理面板：AdminPanel 六 Tab（加反馈、公告）、FeedbackTab（分页列表）、AnnouncementsTab（列表 + 新建 + 删除）、AccountsTab 加「积分余额」列、adminClient 新接口 + isAdminAccount 加 creditBalance。

**Files:**
- Modify: `D:\MapFlow-publish\src\features\admin\AdminPanel.tsx`
- Create: `D:\MapFlow-publish\src\features\admin\FeedbackTab.tsx`
- Create: `D:\MapFlow-publish\src\features\admin\AnnouncementsTab.tsx`
- Modify: `D:\MapFlow-publish\src\features\admin\AccountsTab.tsx`
- Modify: `D:\MapFlow-publish\src\features\admin\adminClient.ts`
- Modify: `D:\MapFlow-publish\src\features\admin\types.ts`
- Modify: `D:\MapFlow-publish\src\features\admin\adminClient.test.ts`
- Modify: `D:\MapFlow-publish\src\features\admin\AdminPanel.test.tsx`

**Interfaces:**
- Consumes: `fetchAdminAccounts` 现有类型、`mutationInit` 模式（adminClient.ts:156-165）。
- Produces: `fetchAdminFeedback(limit, offset)`、`fetchAdminAnnouncements()`、`createAdminAnnouncement(title, content, csrf)`、`deleteAdminAnnouncement(id, csrf)`、`AdminAccount.creditBalance`、六 Tab AdminPanel。

- [ ] **Step 1: 更新既有测试（红）**

`D:\MapFlow-publish\src\features\admin\AdminPanel.test.tsx` 的 "renders the four tabs" 改为六个：

```tsx
    expect(screen.getByRole('tab', { name: '概览' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '用户' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '邀请码' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '反馈' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '公告' })).toBeInTheDocument();
```

`D:\MapFlow-publish\src\features\admin\adminClient.test.ts` 的 `fetchAdminAccounts` fixtures（约 114-135）每个账号对象加 `creditBalance: 0`；`isAdminAccount` 需要 `creditBalance` 才通过校验，因此 fixture 不更新则测试失败。追加新接口测试：

```ts
  it('lists admin feedback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          items: [
            {
              feedbackId: 'fb-1',
              username: 'user1',
              content: '希望支持暗色主题',
              createdAt: '2026-08-19T00:00:00Z',
            },
          ],
          total: 1,
        }),
      ),
    );

    const page = await fetchAdminFeedback('csrf-admin', 50, 0);
    expect(page.total).toBe(1);
    expect(page.items[0].content).toBe('希望支持暗色主题');
  });

  it('creates and deletes announcements', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { announcementId: 'ann-1' })));
    await expect(createAdminAnnouncement('标题', '内容', 'csrf-1')).resolves.toBe('ann-1');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(204, {})));
    await expect(deleteAdminAnnouncement('ann-1', 'csrf-2')).resolves.toBeUndefined();
    const [path, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/admin/announcements/ann-1');
    expect(init.method).toBe('DELETE');
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd D:\MapFlow-publish && npm test -- adminClient AdminPanel`
Expected: 失败（fixture 缺 creditBalance / 新函数不存在 / 只有四个 tab）

- [ ] **Step 3: types.ts + adminClient.ts**

`D:\MapFlow-publish\src\features\admin\types.ts`：`AdminAccount` 加 `creditBalance: number;`；加 `AdminFeedback { feedbackId, username, content, createdAt }`、`AdminFeedbackPage { items, total }`、`AdminAnnouncement { announcementId, title, content, createdAt, readCount }`。

`D:\MapFlow-publish\src\features\admin\adminClient.ts`：
- `isAdminAccount`（195-209）加 `typeof value.creditBalance === 'number'`
- 新函数：

```ts
export async function fetchAdminFeedback(
  csrfToken: string,
  limit: number,
  offset: number,
): Promise<AdminFeedbackPage> {
  void csrfToken;
  const response = await request(
    `/api/admin/feedback?limit=${limit}&offset=${offset}`,
    {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    },
  );
  const body = await readJson(response);
  if (
    !isRecord(body) ||
    !isExactArray(
      body.items,
      (item): item is AdminFeedback =>
        isRecord(item) &&
        typeof item.feedbackId === 'string' &&
        typeof item.username === 'string' &&
        typeof item.content === 'string' &&
        typeof item.createdAt === 'string',
    ) ||
    typeof body.total !== 'number'
  ) {
    throw invalidResponseError();
  }
  return { items: body.items, total: body.total };
}

export async function fetchAdminAnnouncements(
  csrfToken: string,
): Promise<AdminAnnouncement[]> {
  void csrfToken;
  const response = await request('/api/admin/announcements', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(response);
  if (
    !isRecord(body) ||
    !isExactArray(
      body.items,
      (item): item is AdminAnnouncement =>
        isRecord(item) &&
        typeof item.announcementId === 'string' &&
        typeof item.title === 'string' &&
        typeof item.content === 'string' &&
        typeof item.createdAt === 'string' &&
        typeof item.readCount === 'number',
    )
  ) {
    throw invalidResponseError();
  }
  return body.items;
}

export async function createAdminAnnouncement(
  title: string,
  content: string,
  csrfToken: string,
): Promise<string> {
  const response = await request('/api/admin/announcements', {
    ...mutationInit(csrfToken),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ title, content }),
  });
  const body = await readJson(response);
  if (!isRecord(body) || typeof body.announcementId !== 'string') {
    throw invalidResponseError();
  }
  return body.announcementId;
}

export async function deleteAdminAnnouncement(
  announcementId: string,
  csrfToken: string,
): Promise<void> {
  await request(`/api/admin/announcements/${announcementId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken,
    },
  });
}
```

（`mutationInit` 是 POST 专用，createAdminAnnouncement 复用其 spread 后覆盖 headers/body；类型 import 从 `./types` 加 `AdminFeedback, AdminFeedbackPage, AdminAnnouncement`。）

- [ ] **Step 4: AdminPanel.tsx 六 Tab**

`D:\MapFlow-publish\src\features\admin\AdminPanel.tsx`：

```tsx
type AdminTab = 'overview' | 'accounts' | 'invitations' | 'audit' | 'feedback' | 'announcements';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'overview', label: '概览' },
  { id: 'accounts', label: '用户' },
  { id: 'invitations', label: '邀请码' },
  { id: 'audit', label: '审计日志' },
  { id: 'feedback', label: '反馈' },
  { id: 'announcements', label: '公告' },
];
```

main 渲染加：

```tsx
        {activeTab === 'feedback' && <FeedbackTab csrfToken={csrfToken} />}
        {activeTab === 'announcements' && <AnnouncementsTab csrfToken={csrfToken} />}
```

import 加 `FeedbackTab`、`AnnouncementsTab`。

- [ ] **Step 5: AccountsTab.tsx 积分列**

`D:\MapFlow-publish\src\features\admin\AccountsTab.tsx`：colSpan={10}（约 123 行）→ `colSpan={11}`；表头加 `<th>积分余额</th>`；行加 `<td>{account.creditBalance}</td>`（位置：按列序合理处，如「平台消耗」后）。

- [ ] **Step 6: FeedbackTab.tsx**

创建 `D:\MapFlow-publish\src\features\admin\FeedbackTab.tsx`（仿 AuditLogTab 分页模式）：

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminFeedback } from './adminClient';

const PAGE_SIZE = 20;

export default function FeedbackTab({ csrfToken }: { csrfToken: string }) {
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ['admin', 'feedback', offset],
    queryFn: () => fetchAdminFeedback(csrfToken, PAGE_SIZE, offset),
    retry: false,
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">用户反馈</h2>
        <p className="text-xs text-slate-500">共 {query.data?.total ?? 0} 条</p>
      </div>
      {query.isPending ? (
        <p className="py-8 text-center text-sm text-slate-500">正在读取反馈…</p>
      ) : query.isError ? (
        <p role="alert" className="py-8 text-center text-sm text-rose-300">
          {query.error.message}
        </p>
      ) : query.data?.items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">暂无反馈。</p>
      ) : (
        <div className="space-y-2">
          {query.data?.items.map((item) => (
            <article
              key={item.feedbackId}
              className="rounded-xl border border-slate-800 bg-slate-950/55 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-cyan-300">{item.username}</span>
                <span className="text-[10px] text-slate-600">
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {item.content}
              </p>
            </article>
          ))}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 disabled:opacity-40"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={(query.data?.total ?? 0) <= offset + PAGE_SIZE}
              onClick={() => setOffset((value) => value + PAGE_SIZE)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 7: AnnouncementsTab.tsx**

创建 `D:\MapFlow-publish\src\features\admin\AnnouncementsTab.tsx`（列表 + 新建表单 + 删除按钮）：

```tsx
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAdminAnnouncement,
  deleteAdminAnnouncement,
  fetchAdminAnnouncements,
} from './adminClient';

export default function AnnouncementsTab({ csrfToken }: { csrfToken: string }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: () => fetchAdminAnnouncements(csrfToken),
    retry: false,
  });
  const create = useMutation({
    mutationFn: () => createAdminAnnouncement(title.trim(), content.trim(), csrfToken),
    onSuccess: () => {
      setTitle('');
      setContent('');
      setLocalError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
  });
  const remove = useMutation({
    mutationFn: (announcementId: string) =>
      deleteAdminAnnouncement(announcementId, csrfToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
  });

  const submitForm = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) {
      setLocalError('标题与内容都不能为空。');
      return;
    }
    setLocalError(null);
    create.mutate();
  };

  return (
    <section>
      <form
        onSubmit={submitForm}
        className="mb-4 rounded-xl border border-slate-800 bg-slate-950/55 p-4"
      >
        <h2 className="text-sm font-semibold text-slate-100">发布公告</h2>
        <input
          aria-label="公告标题"
          required
          maxLength={100}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="标题（100 字以内）"
          className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
        />
        <textarea
          aria-label="公告内容"
          required
          maxLength={5000}
          rows={4}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="内容（5000 字以内）"
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
        />
        {localError && <p className="mt-2 text-xs text-rose-300">{localError}</p>}
        {create.error && (
          <p role="alert" className="mt-2 text-xs text-rose-300">
            {create.error.message}
          </p>
        )}
        <button
          type="submit"
          disabled={create.isPending}
          className="mt-3 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
        >
          {create.isPending ? '发布中…' : '发布'}
        </button>
      </form>

      {query.isPending ? (
        <p className="py-8 text-center text-sm text-slate-500">正在读取公告…</p>
      ) : query.isError ? (
        <p role="alert" className="py-8 text-center text-sm text-rose-300">
          {query.error.message}
        </p>
      ) : query.data?.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">暂无公告。</p>
      ) : (
        <div className="space-y-2">
          {query.data?.map((item) => (
            <article
              key={item.announcementId}
              className="rounded-xl border border-slate-800 bg-slate-950/55 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                  <p className="mt-1 text-[10px] text-slate-600">
                    {new Date(item.createdAt).toLocaleString('zh-CN')} · {item.readCount} 人已读
                  </p>
                </div>
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(item.announcementId)}
                  className="shrink-0 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-1 text-xs font-medium text-rose-300 transition hover:border-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                >
                  删除
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {item.content}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 8: 跑测试 + typecheck**

Run: `cd D:\MapFlow-publish && npm test && npm run typecheck`
Expected: 全过

- [ ] **Step 9: 提交**

```bash
git add src/features/admin/
git commit -m "feat: 管理面板反馈/公告 Tab 与用户积分余额列"
```

Expected: 提交成功

---

### Task 10: CI 部署 + 生产迁移 + 端到端验证（主会话执行，安全敏感）

**本 task 不做实现，由主会话（controller）在 Task 1-9 全部完成后执行。** 包含：更新前端版本 pin、push 触发 CI、用 canary 镜像手动跑迁移（新二进制才认识 0007，首次 deploy 会 health 失败自动回滚——无害）、rerun deploy、curl 端到端验证。

**Files:**
- Modify: `D:\mapflow-server\.github\workflows\ci.yml`（MAPFLOW_COMMIT）

- [ ] **Step 1: 确认本机后端改动全绿**

```bash
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe test
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe fmt --check
~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe clippy --all-targets
```

- [ ] **Step 2: 前端 build 验证 + 更新 ci.yml 的 MAPFLOW_COMMIT**

```bash
cd D:\MapFlow-publish && npm test && npm run typecheck && npm run build
```

确认前端仓库当前 HEAD SHA，更新 `D:\mapflow-server\.github\workflows\ci.yml` 的 `MAPFLOW_COMMIT` 为新 SHA（前端改动流程 = push 前端 → 更新 ci.yml pin → push 后端触发部署）。提交并 push。

- [ ] **Step 3: 首次 push 触发 CI（预期 deploy 自动回滚）**

push main 后观察 CI：linux-canary-artifact 应全绿（fmt/clippy/test/artifact）；deploy-prod 会因新容器无法启动（迁移 0007 缺失 → health 失败）自动回滚到 previous——**这是预期行为，无害**，服务不中断。

- [ ] **Step 4: 用 canary 镜像手动跑迁移**

从运行容器提取环境与挂载（不打印 secret 值）：

```bash
docker inspect mapflow-app --format '{{json .Config.Env}}'
docker inspect mapflow-app --format '{{json .Mounts}}'
```

用 canary-`<SHA>` 镜像跑一次性迁移容器（env/挂载从上面输出中复制，含 MAPFLOW_DATABASE_URL_FILE 与 identity secrets 挂载）：

```bash
docker run --rm \
  -e MAPFLOW_DATABASE_URL_FILE=/run/secrets/database.url \
  <其余所需 env 与挂载，从运行容器 inspect 提取> \
  canary-<SHA> /usr/local/bin/mapflow-admin database migrate
```

确认输出显示 0007 已应用（`SELECT version, description FROM _sqlx_migrations ORDER BY version;` 验证或迁移命令输出）。

- [ ] **Step 5: rerun deploy job 完成部署**

GitHub Actions 页面 rerun 失败的 deploy-prod job（或空提交触发）。等待 health 30 次检查通过。

- [ ] **Step 6: curl 端到端验证（走 https://xxian.fun）**

验证清单（登录后提取 `__Host-mapflow_session` cookie + csrfToken，后续请求带 Cookie/Origin/X-CSRF-Token 头）：

```bash
# 1. credit me（登录后）
curl -s -b cookie.txt https://xxian.fun/api/credit/me
# 期望：{"balance":N,"signedInToday":false,"freeRemaining":N,"pricePerTree":3}

# 2. 签到（带 CSRF + Origin）
curl -s -X POST -b cookie.txt -H 'X-CSRF-Token: <csrf>' -H 'Origin: https://xxian.fun' https://xxian.fun/api/credit/signin
# 期望：{"balance":N,"awarded":2-5}；重复请求 → 409 {"error":{"code":"credit.already_signed_in",...}}

# 3. 反馈提交 → 201；匿名 → 401
curl -s -X POST -b cookie.txt -H 'Content-Type: application/json' -H 'X-CSRF-Token: <csrf>' -H 'Origin: https://xxian.fun' -d '{"content":"端到端验证反馈"}' https://xxian.fun/api/feedback

# 4. 公告：GET 列表含 unreadIds；POST read → 204（幂等）
curl -s -b cookie.txt https://xxian.fun/api/announcements

# 5. admin 列表（管理员 cookie）
curl -s -b admin_cookie.txt 'https://xxian.fun/api/admin/feedback?limit=50'
curl -s -b admin_cookie.txt https://xxian.fun/api/admin/announcements
curl -s -b admin_cookie.txt https://xxian.fun/api/admin/accounts
# 期望：feedback items/total；announcements items（含 readCount）；accounts 含 creditBalance 字段
```

- [ ] **Step 7: 浏览器验收**

管理员登录验证：AccountsTab 显示积分余额列；发布一则公告 → 用普通用户账号登录验证未读弹窗出现、「知道了」后消失、导航「公告」按钮可查看全部列表；右侧「意见反馈」按钮提交成功提示；签到胶囊「积分 X · 签到」→ 点击后显示获得分数并刷新；生成技能树免费 3 次用完后确认显示「需 3 积分」。

- [ ] **Step 8: 全部通过后收尾**

确认 `docker ps -a` 无残留 previous 容器、artifacts 保留 2 个。更新 spec 状态为已上线（如需要）。向用户汇报部署结果。

---

## Self-Review

**1. Spec 覆盖：**

| Spec 章节 | 对应任务 |
|---|---|
| A 积分：credit_ledger 表/签到 2-5/生成 3 分 | T1（表+签到）、T2（扣费） |
| A 积分：免费优先、余额不足 EntitlementExhausted | T2 Step 3 |
| A 积分：released 退款 | T2 Step 4-5 |
| A 积分：新注册固定 3 次 | T3 |
| A 积分：/api/credit/me + signin + 409 | T1 Step 4/测试 |
| A 管理端：AccountsTab 积分余额列 | T6（后端）+ T9（前端） |
| B 反馈：表 + POST /api/feedback + admin 分页 | T4 |
| B 前端：右下角悬浮按钮 + Dialog | T8 Step 4 + T8 Step 7（App 接线） |
| C 公告：两表 + 未读/已读 + admin CRUD | T5 |
| C 前端：未读弹窗 + 公告按钮 + 管理 Tab | T8 Step 6-7 + T9 Step 4/7 |
| D 前端总览：credit 目录/CreditPill/反馈按钮 z-40 | T7、T8 |
| 风险：并发超卖/退款遗漏/UTC+8 日界 | T2（事务内）、T1（表达式已修正为 Global Constraint 1） |
| 范围外：admin_adjust/连续签到/公告富文本/反馈回复 | 无任务（明确不做） |

**2. 占位符扫描：** 无 TBD/TODO 残留——Task 1 Step 5 与 Task 4/5 测试中的「注意（implementer）」块是**有意为之的既有模式指引**（tests/admin_http.rs 的 helper 结构由 implementer 按文件现状套用，断言与路径全部写死），非计划占位符；唯一 `todo!()` 在 Task 1 Step 5 的示意骨架中，且有明确替换指令。

**3. 类型一致性：**
- `insert_credit_spend` / `refund_credit_spend` 签名在 T1 Step 3 定义、T2 Step 3-5 按该签名调用 ✓
- `CREDIT_PRICE_PER_TREE` i64 在 T1 定义、T2 比较 `balance < CREDIT_PRICE_PER_TREE` 与 `balance - CREDIT_PRICE_PER_TREE`（均为 i64）✓
- runtime 返回元组长度递进：T1 5-tuple → T4 6-tuple → T5 7-tuple，server.rs 同步解构 ✓
- `AdminAccount.credit_balance: i64`（T6）→ `creditBalance` JSON（camelCase）→ 前端 `isAdminAccount` 校验 `creditBalance`（T9）✓
- `GenerationFundingSelectorProps.credit?: CreditSummary | null` 可选（T7 Step 5）与既有测试不传 credit 兼容 ✓
- `ServiceError::Unavailable`（T1）被 T4/T5 的 map 函数引用 ✓
- 前端 creditClient 的 `readCreditSummary()` 无参，与 App 的 `queryFn: readCreditSummary` 匹配（同 readPlatformGenerationEntitlements 模式）✓
