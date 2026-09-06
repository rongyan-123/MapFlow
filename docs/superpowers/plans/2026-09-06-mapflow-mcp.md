# MapFlow MCP(外部 Agent 学习接入)实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让所有注册用户的外部 Agent 通过一行 `npx @mapflow/mcp` 接入 MapFlow:读学习进度/树、编辑私树(含块),全程 api_token 认证 + 审计留痕。

**Architecture:** 所有服务端变更都落在现有单体 axum 进程(新路由 `/mcp` + `/api/mcp/auth/*`),不加新进程;写操作复用 `apply_personal_tree_mutation` 总闸(新增 4 种块命令 + 审计落账);认证用"opaque token,服务器只存 SHA-256 digest + 浏览器授权流";用户本机跑一个 thin TS relay(npx 包)把 stdio MCP 转成 HTTPS。

**Tech Stack:** Rust(axum 0.8 / sqlx 0.8 / uuid / sha2 / serde_json,依赖已齐,零新依赖);TypeScript(`@modelcontextprotocol/sdk`,vitest)。DB:Postgres migrations 追加 0015。两仓库:`D:\mapflow-server`(全部后端)与 `D:\MapFlow-publish`(npx relay 包新目录)。

**Spec:** `docs/superpowers/specs/2026-09-06-mapflow-mcp-design.md`(已评审批准,commit 76bb57e)。本计划对 spec 有四处以落地为准的实现偏差,理由如下:
1. spec §2 块定义"树记录 JSONB 一行"→ 落地为**独立表 `skill_tree_blocks`** + `skill_nodes.block_id` 列带复合外键 `ON DELETE SET NULL`。理由:获得数据库级自维护(删块自动置空节点归属、删节点无残留、跨树引用被数据库拒绝),与现有 skill_edges 行式风格一致。读接口仍是"树+块"一次返回,spec 语义不变。
2. spec §3 换 token 用"本地回环回调"→ 落地为 **relay 轮询 `auth/status` 端点**(spec 已写"轮询作备选",现选它为首选):免 localhost 端口与防火墙问题,跨平台一致。
3. spec §5 `actor_id` 为 "token_id / session_id"→ web 通道当前 `CurrentIdentity` 不暴露 session id,取 **account_id 字符串**作为 web 侧 actor_id(精度到账户;要 session 粒度需后续给 CurrentIdentity 加字段,已列 spec §10 之外的小遗留)。
4. spec §4 提到 MCP "会话头"→ 落地为**无状态逐请求 Bearer 认证,不实现会话头**:本子集无服务端推送/通知,`initialize` 结果不含会话标识,middleware 对每个请求独立验 token(实现更简,行为与 spec §3 "Bearer → digest → 查表"一致)。

## Global Constraints

- 两仓库并行,各自直接工作/commit 在 `main`(既定工作流),commit message 中文。
- 全程中文注释;TDD:每任务先写测试跑红,再实现跑绿。
- 完成后门禁:`cargo fmt`、`cargo clippy --all-targets --all-features`、`cargo test --all-targets --all-features --locked`。
- DB 集成测试用 `#[sqlx::test(migrations = "./migrations")]`,需要可连的 Postgres(CI 提供 `postgres://mapflow_test:mapflow_test_ci_only@127.0.0.1:5432/mapflow_test`);本地若无库则以 CI 为准,提交前本地至少跑非 DB 测试。
- 本地 Rust 工具链:`~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe`(若 PATH 无 cargo)。
- 安全铁律(违反 = 事故):绝不输出/记录 secrets;api token **明文只在签发响应出现一次**,服务器只存 digest;邀请码明文不进任何新表;环境变量不落 git/镜像/命令行。
- 契约风格沿用现状:patch JSON 键为 camelCase、DB 列为 snake_case;错误 = operationCode + 中文消息。
- 生产验证 URL 一律 `https://xxian.fun`(不是 127.0.0.1:18082)。
- 现有相关代码位置(先读再改):`src/adapters/postgres/tree_library_store.rs`(总闸与 8 种 op,apply_personal_tree_mutation 在 L306,apply_mutation_operation 在 L414,命令结构在 L17-31,OPERATIONS 白名单 L386);`src/application/knowledge_chat.rs`(唯一 mutation 调用点 L635,工具 schema L696);`src/app.rs`(PublicAppState L25、路由注册 L384、builder L200);`src/http/auth.rs`(身份守卫 L328/346);`migrations/`(0014 为当前最新);`tests/`(DB 测试基建 `#[sqlx::test(migrations = "./migrations")]`,参照 `tests/postgres_tree_library_store.rs` 与 `tests/postgres_tree_library_schema.rs`;账户/树 fixture 从这两个文件里的 helper 复制扩展)。

---

### Task 1: Migration 0015 —— api_tokens / blocks / audit 三张新表 + skill_nodes.block_id

**Files:**
- Create: `D:\mapflow-server\migrations\0015_mapflow_mcp_v1.sql`
- Create: `D:\mapflow-server\tests\postgres_mcp_schema.rs`

**Interfaces:**
- Produces: 表 `api_tokens`、`skill_tree_blocks`、`agent_audit_events`;`skill_nodes` 新增列 `block_id UUID`(复合外键 `ON DELETE SET NULL`)。后续所有任务依赖这些表存在。

- [ ] **Step 1: Write the migration SQL**

`0015_mapflow_mcp_v1.sql` 全文(直接创建):

```sql
CREATE TABLE api_tokens (
    token_id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    token_digest BYTEA NOT NULL,
    label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    CONSTRAINT api_tokens_digest_length CHECK (octet_length(token_digest) = 32),
    CONSTRAINT api_tokens_label_length CHECK (char_length(label) BETWEEN 1 AND 80),
    CONSTRAINT api_tokens_label_no_leading_trailing_space CHECK (label = btrim(label))
);
CREATE UNIQUE INDEX api_tokens_digest_unique ON api_tokens (token_digest);
CREATE INDEX api_tokens_account_lookup ON api_tokens (account_id, created_at DESC);

CREATE TABLE skill_tree_blocks (
    tree_id UUID NOT NULL REFERENCES skill_trees(tree_id) ON DELETE CASCADE,
    block_id UUID NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tree_id, block_id),
    CONSTRAINT skill_tree_blocks_tree_name_unique UNIQUE (tree_id, name),
    CONSTRAINT skill_tree_blocks_name_length CHECK (char_length(name) BETWEEN 1 AND 120),
    CONSTRAINT skill_tree_blocks_color_length
        CHECK (color IS NULL OR (char_length(color) BETWEEN 1 AND 40)),
    CONSTRAINT skill_tree_blocks_sort_nonnegative CHECK (sort_order >= 0)
);

ALTER TABLE skill_nodes ADD COLUMN block_id UUID;
ALTER TABLE skill_nodes ADD CONSTRAINT skill_nodes_block_foreign_key
    FOREIGN KEY (tree_id, block_id)
    REFERENCES skill_tree_blocks(tree_id, block_id)
    ON DELETE SET NULL;

CREATE TABLE agent_audit_events (
    event_id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    actor_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    tree_id UUID REFERENCES skill_trees(tree_id) ON DELETE SET NULL,
    operation TEXT NOT NULL,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT agent_audit_actor_type_allowed
        CHECK (actor_type IN ('api_token', 'web_session')),
    CONSTRAINT agent_audit_actor_id_length CHECK (char_length(actor_id) BETWEEN 1 AND 64),
    CONSTRAINT agent_audit_operation_length CHECK (char_length(operation) BETWEEN 1 AND 80),
    CONSTRAINT agent_audit_idempotency_key_length
        CHECK (idempotency_key IS NULL OR char_length(idempotency_key) BETWEEN 1 AND 128)
);
CREATE INDEX agent_audit_account_created
    ON agent_audit_events (account_id, created_at DESC);
```

- [ ] **Step 2: Write the schema tests(先红)**

`tests/postgres_mcp_schema.rs`。先读 `tests/postgres_tree_library_schema.rs` 全文,复用其 `uuid()`/insert 类 helper(尤其"如何插入一条 accounts 记录"与"如何插入一棵 private tree")。账户 fixture 写法可能形如 `INSERT INTO accounts (account_id, player_id, username_display, ...) VALUES (...)`——以既有 helper 为准(0001_identity_v1.sql 有 accounts 全部列)。测试代码(helper 名按既有文件风格调整):

```rust
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

fn uuid(value: &str) -> Uuid {
    Uuid::parse_str(value).expect("valid uuid literal")
}

// 从 tests/postgres_tree_library_schema.rs 复制:insert_account(...) 与 insert_tree(...)
// 使下面测试可跑;若既有 insert_tree 签名不同,以既有为准并保持语义。

#[sqlx::test(migrations = "./migrations")]
async fn mcp_migration_creates_all_three_new_tables(pool: PgPool) {
    for table in ["api_tokens", "skill_tree_blocks", "agent_audit_events"] {
        let qualified = format!("public.{table}");
        let exists: bool = sqlx::query_scalar("SELECT to_regclass($1) IS NOT NULL")
            .bind(qualified)
            .fetch_one(&pool)
            .await
            .expect("catalog query");
        assert!(exists, "missing mcp table: {table}");
    }
    let block_column_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns \
         WHERE table_name = 'skill_nodes' AND column_name = 'block_id')",
    )
    .fetch_one(&pool)
    .await
    .expect("column introspection");
    assert!(block_column_exists, "skill_nodes.block_id missing");
}

#[sqlx::test(migrations = "./migrations")]
async fn deleting_a_block_clears_node_membership_but_keeps_nodes(pool: PgPool) {
    let account = insert_account(&pool, uuid("20000000-0000-0000-0000-000000000001")).await;
    let (tree_id, _entry_id) =
        insert_tree(&pool, &account, uuid("20000000-0000-0000-0000-000000000010")).await;
    sqlx::query(
        "INSERT INTO skill_nodes \
         (tree_id, node_id, title, icon, category, difficulty, estimated_minutes, depth_level, \
          position_x, position_y, order_in_level, recommended_depth, depth_rationale, observable_evidence) \
         VALUES ($1, 'n1', '守卫', 'shield', '架构', 2, 30, 0, 0, 0, 0, 'Recognize', '', '')",
    )
    .bind(tree_id)
    .execute(&pool)
    .await
    .expect("seed node");
    let block_id = uuid("20000000-0000-0000-0000-000000000020");
    sqlx::query(
        "INSERT INTO skill_tree_blocks (tree_id, block_id, name, color, sort_order) \
         VALUES ($1, $2, '请求生命周期', '#4f9cf7', 0)",
    )
    .bind(tree_id)
    .bind(block_id)
    .execute(&pool)
    .await
    .expect("seed block");
    sqlx::query("UPDATE skill_nodes SET block_id = $2 WHERE tree_id = $1 AND node_id = 'n1'")
        .bind(tree_id)
        .bind(block_id)
        .execute(&pool)
        .await
        .expect("assign membership");

    sqlx::query("DELETE FROM skill_tree_blocks WHERE tree_id = $1 AND block_id = $2")
        .bind(tree_id)
        .bind(block_id)
        .execute(&pool)
        .await
        .expect("delete block");

    let node_block: Option<Uuid> =
        sqlx::query_scalar("SELECT block_id FROM skill_nodes WHERE tree_id = $1 AND node_id = 'n1'")
            .bind(tree_id)
            .fetch_one(&pool)
            .await
            .expect("read back");
    assert_eq!(node_block, None, "membership must be cleared by SET NULL");
    let node_count: i64 = sqlx::query_scalar("SELECT count(*) FROM skill_nodes WHERE tree_id = $1")
        .bind(tree_id)
        .fetch_one(&pool)
        .await
        .expect("node count");
    assert_eq!(node_count, 1, "node itself must survive block deletion");
}

#[sqlx::test(migrations = "./migrations")]
async fn deleting_a_tree_node_leaves_no_block_residue(pool: PgPool) {
    let account = insert_account(&pool, uuid("20000000-0000-0000-0000-000000000002")).await;
    let (tree_id, _entry_id) =
        insert_tree(&pool, &account, uuid("20000000-0000-0000-0000-000000000011")).await;
    let block_id = uuid("20000000-0000-0000-0000-000000000021");
    sqlx::query(
        "INSERT INTO skill_tree_blocks (tree_id, block_id, name) VALUES ($1, $2, '质量与安全')",
    )
    .bind(tree_id)
    .bind(block_id)
    .execute(&pool)
    .await
    .expect("seed block");
    sqlx::query(
        "INSERT INTO skill_nodes \
         (tree_id, node_id, title, icon, category, difficulty, estimated_minutes, depth_level, \
          position_x, position_y, order_in_level, recommended_depth, depth_rationale, \
          observable_evidence, block_id) \
         VALUES ($1, 'n2', '守卫', 'shield', '架构', 2, 30, 0, 0, 0, 0, 'Recognize', '', '', $2)",
    )
    .bind(tree_id)
    .bind(block_id)
    .execute(&pool)
    .await
    .expect("seed node with membership");

    sqlx::query("DELETE FROM skill_nodes WHERE tree_id = $1 AND node_id = 'n2'")
        .bind(tree_id)
        .execute(&pool)
        .await
        .expect("delete node");

    let block_count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM skill_tree_blocks WHERE tree_id = $1")
            .bind(tree_id)
            .fetch_one(&pool)
            .await
            .expect("block count");
    assert_eq!(block_count, 1, "block survives, orphan reference impossible by row deletion");
}

#[sqlx::test(migrations = "./migrations")]
async fn audit_table_rejects_unknown_actor_types_and_stores_required_fields(pool: PgPool) {
    let account = insert_account(&pool, uuid("20000000-0000-0000-0000-000000000003")).await;
    let bad = sqlx::query(
        "INSERT INTO agent_audit_events (event_id, account_id, actor_type, actor_id, operation) \
         VALUES ($1, $2, 'robot', 'x', 'add_node')",
    )
    .bind(uuid("20000000-0000-0000-0000-000000000030"))
    .bind(account)
    .execute(&pool)
    .await;
    assert!(bad.is_err(), "unknown actor_type must be rejected");

    let good = sqlx::query(
        "INSERT INTO agent_audit_events \
         (event_id, account_id, actor_type, actor_id, operation, summary) \
         VALUES ($1, $2, 'api_token', 'tok-1', 'add_block', $3)",
    )
    .bind(uuid("20000000-0000-0000-0000-000000000031"))
    .bind(account)
    .bind(json!({ "target": "b1" }))
    .execute(&pool)
    .await;
    assert!(good.is_ok(), "valid audit row must insert");
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cargo test --test postgres_mcp_schema`
Expected: 编译失败或全部失败——`0015` 迁移不存在,表缺失。红。

- [ ] **Step 4: Implement (创建 SQL 文件)并使测试通过**

文件 `migrations/0015_mapflow_mcp_v1.sql` 用 Step 1 全文(若 helper 断言报错则修正 helper)。注意 `#[sqlx::test(migrations = "./migrations")]` 会按文件名顺序应用全部迁移——0014 已在,0015 追加即可,不动旧文件。

- [ ] **Step 5: Run tests to verify they pass**

Run: `cargo test --test postgres_mcp_schema`
Expected: 全部 PASS。红→绿完成。

- [ ] **Step 6: Format + clippy + commit**

Run: `cargo fmt && cargo clippy --all-targets --all-features`
Run: `cargo test --all-targets --all-features --locked`(确保既有测试没被迁移破坏——尤其 skill_nodes 有外键后,既有 insert 语句若不带 block_id 仍应成功,因为列可空)
Commit(server 仓库):
```bash
git add migrations/0015_mapflow_mcp_v1.sql tests/postgres_mcp_schema.rs
git commit -m "feat: MCP 基础表迁移(api_tokens/skill_tree_blocks/agent_audit_events)"
```

---

### Task 2: mutation 块命令(4 种 op)+ 校验 + harness 工具 schema

**Files:**
- Modify: `D:\mapflow-server\src\adapters\postgres\tree_library_store.rs`(OPERATIONS 白名单 L386-395、validate_mutation_command L383-411、apply_mutation_operation L414-561)
- Modify: `D:\mapflow-server\src\application\knowledge_chat.rs`(personal_tree_mutation_tool schema L696-712 的 enum)
- Create: `D:\mapflow-server\tests\postgres_tree_mutation_blocks.rs`

**Interfaces:**
- Consumes: `skill_tree_blocks` 表与 `skill_nodes.block_id`(Task 1);命令结构 `PersonalTreeMutationCommand { operation, target_id, revision, idempotency_key, patch }`(现有);错误 `PostgresTreeLibraryError`(MutationInvalid / MutationTargetMissing / MutationRevisionConflict / MutationNotAuthorized,enum 在 tree_library_store.rs:854)。
- Produces: 新增可执行 operation:`add_block`、`update_block`、`delete_block`、`set_node_block`。调用方照常构造命令即可(与既有 8 种同构)。

- [ ] **Step 1: Write failing tests first**

`tests/postgres_tree_mutation_blocks.rs`。需要一棵"本人 private + ai_generated + ready"的树:先读 `tests/postgres_tree_library_store.rs` 全文,找到既有 mutation 测试如何建这样的树与构造命令(如既有 helper 或内联 insert);若无现成可复用,参照 Task 1 helper + 0011/0015 迁移补 `account_tree_library` 行(列:library_entry_id、account_id、tree_id、visibility、source、lifecycle…以 0002_tree_library_v1.sql 与既有测试为准)。测试:

```rust
use mapflow_server::{PersonalTreeMutationCommand, PersonalTreeMutationResult,
    PostgresTreeLibraryError, PostgresTreeLibraryStore};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

// 复用/复制既有测试文件的 fixture 函数(建 account、建可变更的私树与节点 n1)

fn block_command(operation: &str, target_id: Option<&str>, patch: serde_json::Value) -> PersonalTreeMutationCommand {
    PersonalTreeMutationCommand {
        operation: operation.to_owned(),
        target_id: target_id.map(str::to_owned),
        revision: 1,
        idempotency_key: format!("block-test-{}", uuid::Uuid::new_v4()),
        patch,
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn add_and_update_and_read_back_block_via_mutation(pool: PgPool) {
    let store = PostgresTreeLibraryStore::new(pool.clone());
    let (account, entry_id) = seed_mutable_personal_tree(&pool).await; // fixture

    let added = store
        .apply_personal_tree_mutation(
            account,
            entry_id,
            &block_command("add_block", None, json!({ "name": "请求生命周期", "color": "#4f9cf7" })),
        )
        .await
        .expect("add_block succeeds");
    assert!(matches!(added, PersonalTreeMutationResult::Applied { .. }));

    let block_id: Uuid =
        sqlx::query_scalar("SELECT block_id FROM skill_tree_blocks WHERE tree_id IN \
                            (SELECT tree_id FROM account_tree_library WHERE library_entry_id = $1)")
            .bind(entry_id)
            .fetch_one(&pool)
            .await
            .expect("block row exists");
    let updated = store
        .apply_personal_tree_mutation(
            account,
            entry_id,
            &block_command("update_block", Some(&block_id.to_string()), json!({ "color": "#22c55e" })),
        )
        .await
        .expect("update_block succeeds");
    assert!(matches!(updated, PersonalTreeMutationResult::Applied { .. }));
    let color: Option<String> = sqlx::query_scalar(
        "SELECT color FROM skill_tree_blocks WHERE tree_id IN \
         (SELECT tree_id FROM account_tree_library WHERE library_entry_id = $1) AND block_id = $2",
    )
    .bind(entry_id)
    .bind(block_id)
    .fetch_one(&pool)
    .await
    .expect("read color");
    assert_eq!(color.as_deref(), Some("#22c55e"));
}

#[sqlx::test(migrations = "./migrations")]
async fn assign_node_to_block_then_move_and_clear(pool: PgPool) {
    let store = PostgresTreeLibraryStore::new(pool.clone());
    let (account, entry_id) = seed_mutable_personal_tree(&pool).await; // 含节点 n1
    let first = store
        .apply_personal_tree_mutation(
            account, entry_id,
            &block_command("add_block", None, json!({ "name": "块A" })),
        )
        .await.expect("add block A");
    assert!(matches!(first, PersonalTreeMutationResult::Applied { .. }));
    let second = store
        .apply_personal_tree_mutation(
            account, entry_id,
            &block_command("add_block", None, json!({ "name": "块B" })),
        )
        .await.expect("add block B");
    assert!(matches!(second, PersonalTreeMutationResult::Applied { .. }));
    let block_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT block_id FROM skill_tree_blocks WHERE tree_id IN \
         (SELECT tree_id FROM account_tree_library WHERE library_entry_id = $1) ORDER BY sort_order",
    )
    .bind(entry_id).fetch_all(&pool).await.expect("list blocks");
    assert_eq!(block_ids.len(), 2);

    store.apply_personal_tree_mutation(
        account, entry_id,
        &block_command("set_node_block", Some("n1"), json!({ "blockId": block_ids[0].to_string() })),
    ).await.expect("assign n1 to block A");
    let assigned: Option<Uuid> = sqlx::query_scalar(
        "SELECT block_id FROM skill_nodes WHERE node_id = 'n1' AND tree_id IN \
         (SELECT tree_id FROM account_tree_library WHERE library_entry_id = $1)",
    ).bind(entry_id).fetch_one(&pool).await.expect("node membership");
    assert_eq!(assigned, Some(block_ids[0]));

    // 移到块 B
    store.apply_personal_tree_mutation(
        account, entry_id,
        &block_command("set_node_block", Some("n1"), json!({ "blockId": block_ids[1].to_string() })),
    ).await.expect("move n1 to block B");
    // 清空(不传 blockId / null)
    store.apply_personal_tree_mutation(
        account, entry_id,
        &block_command("set_node_block", Some("n1"), json!({ "blockId": null })),
    ).await.expect("clear membership");
    let cleared: Option<Uuid> = sqlx::query_scalar(
        "SELECT block_id FROM skill_nodes WHERE node_id = 'n1' AND tree_id IN \
         (SELECT tree_id FROM account_tree_library WHERE library_entry_id = $1)",
    ).bind(entry_id).fetch_one(&pool).await.expect("node membership");
    assert_eq!(cleared, None);
}

#[sqlx::test(migrations = "./migrations")]
async fn delete_block_clears_membership_and_rejects_unknown_targets(pool: PgPool) {
    let store = PostgresTreeLibraryStore::new(pool.clone());
    let (account, entry_id) = seed_mutable_personal_tree(&pool).await; // 含节点 n1
    store.apply_personal_tree_mutation(
        account, entry_id,
        &block_command("add_block", None, json!({ "name": "待删块" })),
    ).await.expect("add block");
    let block_id: Uuid = sqlx::query_scalar(
        "SELECT block_id FROM skill_tree_blocks WHERE tree_id IN \
         (SELECT tree_id FROM account_tree_library WHERE library_entry_id = $1)",
    ).bind(entry_id).fetch_one(&pool).await.expect("block id");
    store.apply_personal_tree_mutation(
        account, entry_id,
        &block_command("set_node_block", Some("n1"), json!({ "blockId": block_id.to_string() })),
    ).await.expect("assign");
    store.apply_personal_tree_mutation(
        account, entry_id,
        &block_command("delete_block", Some(&block_id.to_string()), json!({})),
    ).await.expect("delete block");

    let node_block: Option<Uuid> = sqlx::query_scalar(
        "SELECT block_id FROM skill_nodes WHERE node_id = 'n1' AND tree_id IN \
         (SELECT tree_id FROM account_tree_library WHERE library_entry_id = $1)",
    ).bind(entry_id).fetch_one(&pool).await.expect("read back");
    assert_eq!(node_block, None, "deleting block clears node membership");

    let missing = store.apply_personal_tree_mutation(
        account, entry_id,
        &block_command("delete_block", Some(&uuid("99999999-0000-0000-0000-000000000001").to_string()), json!({})),
    ).await;
    assert!(matches!(missing, Err(PostgresTreeLibraryError::MutationTargetMissing)));
}

#[sqlx::test(migrations = "./migrations")]
async fn duplicate_block_name_and_unknown_node_are_rejected(pool: PgPool) {
    let store = PostgresTreeLibraryStore::new(pool.clone());
    let (account, entry_id) = seed_mutable_personal_tree(&pool).await;
    store.apply_personal_tree_mutation(
        account, entry_id,
        &block_command("add_block", None, json!({ "name": "同名块" })),
    ).await.expect("first add");
    let duplicate = store.apply_personal_tree_mutation(
        account, entry_id,
        &block_command("add_block", None, json!({ "name": "同名块" })),
    ).await;
    assert!(matches!(duplicate, Err(PostgresTreeLibraryError::MutationInvalid)));

    let unknown_node = store.apply_personal_tree_mutation(
        account, entry_id,
        &block_command("set_node_block", Some("no-such-node"), json!({ "blockId": null })),
    ).await;
    assert!(matches!(unknown_node, Err(PostgresTreeLibraryError::MutationTargetMissing)));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --test postgres_tree_mutation_blocks`
Expected: 失败——操作不在白名单,MutationInvalid / apply_mutation_operation 无对应 arm。红。

- [ ] **Step 3: Implement the four operation arms**

`tree_library_store.rs`,validate_mutation_command(L383-411):
- `OPERATIONS` 常量扩为 12 项:`add_block`、`update_block`、`delete_block`、`set_node_block` 追加到数组,类型注解同步从 `[&str; 8]` 改 `[&str; 12]`。
- 既有 target_id 必填逻辑(L404-409)需豁免 `add_block`(无 target_id,块 id 由服务端生成):

```rust
    if command.operation != "clear_tree"
        && command.operation != "update_tree"
        && command.operation != "add_block"
        && command.target_id.as_deref().is_none_or(str::is_empty)
    {
        return Err(PostgresTreeLibraryError::MutationInvalid);
    }
```

`apply_mutation_operation`(L414-561)match 末尾、`_ =>` 之前追加四个 arm:

```rust
        "add_block" => {
            let block_id = Uuid::new_v4();
            let name = required_patch_string(patch, "name")?;
            // 下一次序直接在 SQL 里算:树行锁已串行化同树变更,不会拿到重复 sort_order
            sqlx::query(
                "INSERT INTO skill_tree_blocks (tree_id, block_id, name, color, sort_order) \
                 SELECT $1, $2, $3, $4, (COALESCE(MAX(sort_order), -1) + 1)::INTEGER \
                 FROM skill_tree_blocks WHERE tree_id = $1",
            )
            .bind(tree_id)
            .bind(block_id)
            .bind(name)
            .bind(optional_patch_string(patch, "color")?)
            .execute(&mut **transaction)
            .await
            .map_err(map_mutation_sql_error)?;
        }
        "update_block" => {
            let block_id = parse_block_target(command)?;
            let result = sqlx::query(
                "UPDATE skill_tree_blocks SET \
                 name = COALESCE($3, name), color = COALESCE($4, color), \
                 sort_order = COALESCE($5, sort_order) \
                 WHERE tree_id = $1 AND block_id = $2",
            )
            .bind(tree_id)
            .bind(block_id)
            .bind(optional_patch_string(patch, "name")?)
            .bind(optional_patch_string(patch, "color")?)
            .bind(patch_i32(patch, "sortOrder")?)
            .execute(&mut **transaction)
            .await
            .map_err(map_mutation_sql_error)?;
            if result.rows_affected() != 1 {
                return Err(PostgresTreeLibraryError::MutationTargetMissing);
            }
        }
        "delete_block" => {
            let block_id = parse_block_target(command)?;
            // skill_nodes 上的复合外键 ON DELETE SET NULL 自动清空块内节点归属
            let result = sqlx::query(
                "DELETE FROM skill_tree_blocks WHERE tree_id = $1 AND block_id = $2",
            )
            .bind(tree_id)
            .bind(block_id)
            .execute(&mut **transaction)
            .await
            .map_err(map_mutation_sql_error)?;
            if result.rows_affected() != 1 {
                return Err(PostgresTreeLibraryError::MutationTargetMissing);
            }
        }
        "set_node_block" => {
            let node_id = command.target_id.as_deref().unwrap_or_default();
            // 显式 null 与缺键等价(移出块);JSON 里的 null 经 patch.get 返回 Value::Null,
            // 不能走 optional_patch_string(它会把 null 判为类型错)
            let block_id = match patch.get("blockId") {
                None | Some(serde_json::Value::Null) => None,
                Some(value) => {
                    let Some(value) = value.as_str() else {
                        return Err(PostgresTreeLibraryError::MutationInvalid);
                    };
                    Some(
                        Uuid::parse_str(value)
                            .map_err(|_| PostgresTreeLibraryError::MutationInvalid)?,
                    )
                }
            };
            let result = if let Some(block_id) = block_id {
                sqlx::query(
                    "UPDATE skill_nodes SET block_id = $3 \
                     WHERE tree_id = $1 AND node_id = $2",
                )
                .bind(tree_id)
                .bind(node_id)
                .bind(block_id)
                .execute(&mut **transaction)
                .await
                .map_err(map_mutation_sql_error)?
            } else {
                sqlx::query(
                    "UPDATE skill_nodes SET block_id = NULL \
                     WHERE tree_id = $1 AND node_id = $2",
                )
                .bind(tree_id)
                .bind(node_id)
                .execute(&mut **transaction)
                .await
                .map_err(map_mutation_sql_error)?
            };
            if result.rows_affected() != 1 {
                return Err(PostgresTreeLibraryError::MutationTargetMissing);
            }
        }
```

`parse_block_target` 加在 `apply_mutation_operation` 之后(block_id 是 UUID 列,必须先解析成 `Uuid` 再 bind,不能像 node_id/edge_id(TEXT 列)那样 bind 字符串——PG 不会把 text 参数隐式转 uuid):

```rust
fn parse_block_target(
    command: &PersonalTreeMutationCommand,
) -> Result<Uuid, PostgresTreeLibraryError> {
    Uuid::parse_str(command.target_id.as_deref().unwrap_or_default())
        .map_err(|_| PostgresTreeLibraryError::MutationInvalid)
}
```

**错误映射(已核对代码,无需再查)**:`map_mutation_sql_error`(tree_library_store.rs:632-639)把**任何** DB 约束冲突(唯一 23505、外键 23503、check 23514)一律映射为 `MutationInvalid`。因此:重复块名 → `MutationInvalid`(与 Step 1 测试断言一致);set_node_block 引用不存在/跨树的 block_id → 复合外键拒绝 → `MutationInvalid`;长度超界(name>120、color>40)由 Task 1 的 check 约束兜住 → `MutationInvalid`(所以 arm 里不需要手写长度校验)。目标不存在类错误由 `rows_affected() != 1` 判 `MutationTargetMissing`(delete_block 删不存在的块、set_node_block 的节点不在本树),与测试断言一致。**不需要**新增 `patch_i64` 之类 helper——`sort_order` 是 INTEGER,复用既有 `patch_i32` 即可。

最后,`knowledge_chat.rs` 的 `personal_tree_mutation_tool()`(L696-712)enum 扩为 12 项,保持 harness 内嵌 Agent 也能提议块操作:

```rust
"operation": { "type": "string", "enum": ["add_node", "update_node", "delete_node", "add_edge", "update_edge", "delete_edge", "update_tree", "clear_tree", "add_block", "update_block", "delete_block", "set_node_block"] },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test --test postgres_tree_mutation_blocks`
Expected: PASS。

- [ ] **Step 5: 全量门禁 + commit**

Run: `cargo fmt && cargo clippy --all-targets --all-features && cargo test --all-targets --all-features --locked`
Commit:
```bash
git add src/adapters/postgres/tree_library_store.rs src/application/knowledge_chat.rs tests/postgres_tree_mutation_blocks.rs
git commit -m "feat: 个人树变更新增 4 种块操作(add/update/delete_block, set_node_block)"
```

---

### Task 3: mutation 总闸审计落账(带调用方签名变更)

**Files:**
- Modify: `D:\mapflow-server\src\adapters\postgres\tree_library_store.rs`(`apply_personal_tree_mutation` L306-311 签名 + 事务内插审计)
- Modify: `D:\mapflow-server\src\application\knowledge_chat.rs:635`(唯一 src 调用点,补 actor 实参)
- Modify: `D:\mapflow-server\tests\postgres_tree_library_store.rs`(5 个调用点 L276/283/298/305/320 补 actor 实参)
- Modify: `D:\mapflow-server\tests\postgres_tree_mutation_blocks.rs`(Task 2 新增的 4 个测试调用点)
- Create: `D:\mapflow-server\tests\postgres_tree_mutation_audit.rs`

**Interfaces:**
- Consumes: `agent_audit_events` 表(Task 1);`PersonalTreeMutationCommand`/`PostgresTreeLibraryError`(现有);`PersonalTreeMutationResult`(现有)。
- Produces: 公开类型 `MutationActor`(构造器 `MutationActor::api_token(token_id: Uuid)` / `MutationActor::web_session(account_id: Uuid)`);`apply_personal_tree_mutation` 新签名 `(&self, actor: &MutationActor, account_id: Uuid, library_entry_id: Uuid, command: &PersonalTreeMutationCommand)`。Task 5(MCP 写工具)依赖新签名以 `api_token` actor 落账。

**为什么换签名**:审计表必须有 actor_type/actor_id,而现有函数不知道调用方是谁——只有把 actor 作为参数带进总闸,才能保证"所有改树动作都落账、无第二套绕过路径"(spec §5 的核心约束)。web 通道无 session id 暴露(偏差 #3),`web_session` actor_id 取 account_id 字符串。

- [ ] **Step 1: Write the failing tests**

先读 `tests/postgres_tree_library_store.rs` L245-333 现有 mutation 测试(建树 fixture:insert_account + insert_private_tree + insert_private_tree_node + 手插 account_tree_library),把 `insert_account`/`insert_private_tree`/`insert_private_tree_node`/`uuid` 四个 helper 复制到新文件。审计测试全文:

```rust
use mapflow_server::{
    MutationActor, PersonalTreeMutationCommand, PersonalTreeMutationResult,
    PostgresTreeLibraryError, PostgresTreeLibraryStore,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

// 复制:insert_account(pool, account_id, player_id, username)
//       insert_private_tree(pool, tree_id, owner_account_id)
//       insert_private_tree_node(pool, tree_id, node_id)
//       uuid(value)   ← 全部从 tests/postgres_tree_library_store.rs 复制

async fn seed(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
    let account = uuid("a1000000-0000-0000-0000-000000000001");
    let tree_id = uuid("a1000000-0000-0000-0000-000000000002");
    let entry_id = uuid("a1000000-0000-0000-0000-000000000003");
    insert_account(pool, account, "MF-0000-0000-0011", "auditlearner").await;
    insert_private_tree(pool, tree_id, account).await;
    insert_private_tree_node(pool, tree_id, "root").await;
    sqlx::query(
        "INSERT INTO account_tree_library (library_entry_id, account_id, tree_id) \
         VALUES ($1, $2, $3)",
    )
    .bind(entry_id)
    .bind(account)
    .bind(tree_id)
    .execute(pool)
    .await
    .expect("library entry inserts");
    (account, entry_id, tree_id)
}

fn command(operation: &str, target_id: Option<&str>, patch: Value) -> PersonalTreeMutationCommand {
    PersonalTreeMutationCommand {
        operation: operation.to_owned(),
        target_id: target_id.map(str::to_owned),
        revision: 1,
        idempotency_key: format!("audit-{}", Uuid::new_v4()),
        patch,
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn every_mutation_writes_an_audit_event_with_actor_and_summary(pool: PgPool) {
    let store = PostgresTreeLibraryStore::new(pool.clone());
    let (account, entry_id, _tree_id) = seed(&pool).await;
    let actor = MutationActor::api_token(uuid("a1000000-0000-0000-0000-000000000004"));

    store
        .apply_personal_tree_mutation(
            &actor,
            account,
            entry_id,
            &command("add_node", Some("practice"), json!({
                "title": "Practice", "category": "hands-on"
            })),
        )
        .await
        .expect("mutation applies");

    let (actor_type, actor_id, operation, summary): (String, String, String, Value) =
        sqlx::query_as(
            "SELECT actor_type, actor_id, operation, summary FROM agent_audit_events \
             WHERE account_id = $1",
        )
        .bind(account)
        .fetch_one(&pool)
        .await
        .expect("one audit row");
    assert_eq!(actor_type, "api_token");
    assert_eq!(actor_id, "a1000000-0000-0000-0000-000000000004");
    assert_eq!(operation, "add_node");
    assert_eq!(
        summary,
        json!({"targetId": "practice", "title": "Practice", "category": "hands-on"})
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn web_session_actor_records_account_id_and_block_ops_are_audited(pool: PgPool) {
    let store = PostgresTreeLibraryStore::new(pool.clone());
    let (account, entry_id, _tree_id) = seed(&pool).await;
    let actor = MutationActor::web_session(account);

    store
        .apply_personal_tree_mutation(&actor, account, entry_id,
            &command("add_block", None, json!({"name": "质量与安全", "color": "#f59e0b"})))
        .await
        .expect("add block");
    let block_id: Uuid = sqlx::query_scalar(
        "SELECT b.block_id FROM skill_tree_blocks b \
         JOIN account_tree_library l ON l.tree_id = b.tree_id WHERE l.library_entry_id = $1",
    )
    .bind(entry_id)
    .fetch_one(&pool)
    .await
    .expect("block row");
    store
        .apply_personal_tree_mutation(&actor, account, entry_id,
            &command("set_node_block", Some("root"), json!({"blockId": block_id.to_string()})))
        .await
        .expect("assign node");

    let rows: Vec<(String, String, String, Value)> = sqlx::query_as(
        "SELECT actor_type, actor_id, operation, summary FROM agent_audit_events \
         WHERE account_id = $1 ORDER BY created_at, event_id",
    )
    .bind(account)
    .fetch_all(&pool)
    .await
    .expect("audit rows");
    assert_eq!(rows.len(), 2, "one audit row per applied mutation");
    assert_eq!(rows[0].0, "web_session");
    assert_eq!(rows[0].1, account.to_string(), "web actor id is the account id");
    assert_eq!(rows[0].2, "add_block");
    assert_eq!(rows[0].3, json!({"name": "质量与安全", "color": "#f59e0b"}));
    assert_eq!(rows[1].2, "set_node_block");
    assert_eq!(rows[1].3, json!({"targetId": "root", "blockId": block_id.to_string()}));
}

#[sqlx::test(migrations = "./migrations")]
async fn failed_or_idempotent_mutations_write_no_audit_row(pool: PgPool) {
    let store = PostgresTreeLibraryStore::new(pool.clone());
    let (account, entry_id, _tree_id) = seed(&pool).await;
    let actor = MutationActor::web_session(account);
    let stale = command("delete_node", Some("root"), json!({}));

    store
        .apply_personal_tree_mutation(&actor, account, entry_id, &stale)
        .await
        .expect_err("revision 2 expected but tree is at 1");
    let before: i64 =
        sqlx::query_scalar("SELECT count(*) FROM agent_audit_events").fetch_one(&pool).await.unwrap();
    assert_eq!(before, 0, "rejected mutation must not be audited");

    let good = command("delete_node", Some("root"), json!({}));
    let mut good = good;
    good.revision = 1; // 修正到当前 revision
    let first = store
        .apply_personal_tree_mutation(&actor, account, entry_id, &good)
        .await
        .expect("delete applies");
    assert!(matches!(first, PersonalTreeMutationResult::Applied { .. }));
    let retried = store
        .apply_personal_tree_mutation(&actor, account, entry_id, &good)
        .await
        .expect("idempotent retry");
    assert!(matches!(retried, PersonalTreeMutationResult::AlreadyApplied { .. }));
    let after: i64 =
        sqlx::query_scalar("SELECT count(*) FROM agent_audit_events").fetch_one(&pool).await.unwrap();
    assert_eq!(after, 1, "idempotent retry must not double-audit");
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --test postgres_tree_mutation_audit`
Expected: 编译失败——`MutationActor` 不存在,且 `apply_personal_tree_mutation` 还是 3 参。红。

- [ ] **Step 3: Implement**

`tree_library_store.rs`:
1. 文件顶部加公开类型(在 `PersonalTreeMutationResult` 附近):

```rust
/// 改树动作的发起方。审计落账用;actor_id 不记秘密(token_id/account_id 均为公开标识)。
#[derive(Clone, Debug)]
pub struct MutationActor {
    actor_type: &'static str,
    actor_id: String,
}

impl MutationActor {
    #[must_use]
    pub fn api_token(token_id: Uuid) -> Self {
        Self { actor_type: "api_token", actor_id: token_id.to_string() }
    }

    #[must_use]
    pub fn web_session(account_id: Uuid) -> Self {
        Self { actor_type: "web_session", actor_id: account_id.to_string() }
    }
}
```

2. `apply_personal_tree_mutation`(L306)签名改为四参(actor 放第一位),函数体不变。
3. `apply_mutation_operation(...).await?;` 之后、`total_nodes` 重算之前,插入审计写(与业务同事务——事务失败自动回滚,审计不落):

```rust
        sqlx::query(
            "INSERT INTO agent_audit_events \
             (event_id, account_id, actor_type, actor_id, tree_id, operation, summary, \
              idempotency_key) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(Uuid::now_v7())
        .bind(account_id)
        .bind(actor.actor_type)
        .bind(&actor.actor_id)
        .bind(tree_id)
        .bind(&command.operation)
        .bind(audit_summary(command))
        .bind(&command.idempotency_key)
        .execute(&mut *transaction)
        .await
        .map_err(map_storage_failure)?;
```

4. 文件底部(或 apply 函数附近)加摘要构造函数——只挑结构与目标字段,键集与各操作 arm 的读取白名单一致,天然不含任何秘密:

```rust
/// 审计摘要:目标 id + 每操作少量结构字段。patch 键是各操作 arm 的固定白名单
/// (从未读取 token/密码/邀请码类内容),这里只摘白名单子集。
fn audit_summary(command: &PersonalTreeMutationCommand) -> serde_json::Value {
    let mut summary = serde_json::Map::new();
    if let Some(target_id) = command.target_id.as_deref() {
        summary.insert("targetId".to_owned(), serde_json::json!(target_id));
    }
    let patch_keys: &[&str] = match command.operation.as_str() {
        "add_node" => &["title", "category"],
        "update_node" => &["title"],
        "add_edge" => &["sourceNodeId", "targetNodeId", "edgeType"],
        "add_block" => &["name", "color"],
        "set_node_block" => &["blockId"],
        _ => &[], // delete_*/update_*/clear_tree 只靠 operation + targetId 可追溯
    };
    if let Some(patch) = command.patch.as_object() {
        for key in patch_keys {
            if let Some(value) = patch.get(*key) {
                summary.insert((*key).to_owned(), value.clone());
            }
        }
    }
    serde_json::Value::Object(summary)
}
```

5. 同步所有既有调用点(编译错会一个个指出来):
- `knowledge_chat.rs:635`:实参改为 `&crate::MutationActor::web_session(self.account_id), self.account_id, library_entry_id, &command`。
- `tests/postgres_tree_library_store.rs` 5 处(L276/283/298/305/320):在 account_id 前补 `&MutationActor::web_session(owner)`(L305 的 attacker 用例补 `&MutationActor::web_session(attacker)`),并给该文件 use 列表加 `MutationActor`。
- `tests/postgres_tree_mutation_blocks.rs`(Task 2):use 列表加 `MutationActor`,4 个测试的调用补 `&MutationActor::web_session(account)`。
- `lib.rs` L38-47 的 `pub use adapters::postgres::{...}` 加 `MutationActor`。

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test --test postgres_tree_mutation_audit && cargo test --test postgres_tree_mutation_blocks --test postgres_tree_library_store`
Expected: 全 PASS。审计断言(actor_type/actor_id/summary/幂等不重复/失败不落账)成立。

- [ ] **Step 5: 全量门禁 + commit**

Run: `cargo fmt && cargo clippy --all-targets --all-features && cargo test --all-targets --all-features --locked`
Commit:
```bash
git add src/adapters/postgres/tree_library_store.rs src/application/knowledge_chat.rs src/lib.rs tests/postgres_tree_mutation_audit.rs tests/postgres_tree_library_store.rs tests/postgres_tree_mutation_blocks.rs
git commit -m "feat: 树变更总闸审计落账(actor 入参 + agent_audit_events 同事务写入)"
```

---

### Task 4: PostgresApiTokenStore(签发 / 验证 / 吊销)

**Files:**
- Create: `D:\mapflow-server\src\adapters\postgres\api_token_store.rs`
- Modify: `D:\mapflow-server\src\adapters\postgres\mod.rs`(声明 `mod api_token_store;` 并按现有风格 re-export)
- Modify: `D:\mapflow-server\src\lib.rs:38-47`(pub use 补 `ApiTokenIdentity`/`ApiTokenError`/`PostgresApiTokenStore`)
- Create: `D:\mapflow-server\tests\postgres_api_token_store.rs`

**Interfaces:**
- Consumes: `api_tokens` 表(Task 1);`accounts` 表(0001,含 `status` 列);依赖 sha2 0.10.x 与 getrandom 0.4.x(均在现有 Cargo.toml,零新依赖——参照 `identity_service.rs:390` 的 `getrandom::fill` 与 `tree_generation_service.rs:411` 的 `Sha256::digest` 用法)。
- Produces: `PostgresApiTokenStore`(构造 `new(pool: PgPool)`);`issue_token(account_id, label) -> Result<(Uuid, String), ApiTokenError>`(返回 token_id + token 明文,明文只在签发响应出现一次);`authenticate(token: &str) -> Result<ApiTokenIdentity, ApiTokenError>`;`revoke(token_id) -> Result<(), ApiTokenError>`。`ApiTokenIdentity { token_id: Uuid, account_id: Uuid, label: String, username: String }`。Task 5 的 bearer 校验与 Task 8 的 device flow 换 token 依赖本 store。

**设计与 spec §3 对齐**:token 明文 = 32 随机字节的 64 位 hex(可放 URL/命令行,无歧义);库只存 SHA-256(明文 bytes)的 32 字节 digest(与 invite_codes/sessions 的 digest 风格一致);验证 = 当场重算比对;`revoked_at IS NOT NULL` 或账户非 `active` → 拒绝;每次 `authenticate` 顺带更新 `last_used_at`。

- [ ] **Step 1: Write the failing tests**

先读 `tests/postgres_identity_contract.rs` 的 insert_account helper(它和 store 测试同一模式),复制进新文件。测试全文:

```rust
use mapflow_server::{ApiTokenError, PostgresApiTokenStore};
use sqlx::PgPool;
use uuid::Uuid;

fn uuid(value: &str) -> Uuid {
    Uuid::parse_str(value).expect("valid test UUID")
}

// 复制 tests/postgres_identity_contract.rs 的 insert_account(account_id, player_id, username)

#[sqlx::test(migrations = "./migrations")]
async fn issued_token_authenticates_and_stores_only_a_digest(pool: PgPool) {
    let store = PostgresApiTokenStore::new(pool.clone());
    let account = uuid("b1000000-0000-0000-0000-000000000001");
    insert_account(&pool, account, "MF-0000-0000-0012", "tokenlearner").await;

    let (token_id, token) = store
        .issue_token(account, "my-codex")
        .await
        .expect("token issues");
    assert_eq!(token.len(), 64, "plaintext is 32 random bytes as hex");
    assert!(!token.contains('-'));

    let identity = store
        .authenticate(&token)
        .await
        .expect("fresh token authenticates");
    assert_eq!(identity.token_id, token_id);
    assert_eq!(identity.account_id, account);
    assert_eq!(identity.label, "my-codex");
    assert_eq!(identity.username, "tokenlearner");

    let (stored_digest, plaintext_leak): (Vec<u8>, i64) = sqlx::query_as(
        "SELECT token_digest, \
         (SELECT count(*) FROM api_tokens WHERE token_digest = decode($1, 'hex')) \
         FROM api_tokens WHERE token_id = $2",
    )
    .bind(&token)
    .bind(token_id)
    .fetch_one(&pool)
    .await
    .expect("token row");
    assert_eq!(stored_digest.len(), 32, "digest is 32 bytes");
    assert_eq!(plaintext_leak, 0, "server never stores the plaintext");
}

#[sqlx::test(migrations = "./migrations")]
async fn revoked_or_unknown_or_suspended_tokens_are_rejected(pool: PgPool) {
    let store = PostgresApiTokenStore::new(pool.clone());
    let account = uuid("b1000000-0000-0000-0000-000000000002");
    insert_account(&pool, account, "MF-0000-0000-0013", "tokenlearner2").await;
    let (token_id, token) = store.issue_token(account, "revoke-me").await.expect("issue");

    assert!(matches!(
        store.authenticate("0000000000000000000000000000000000000000000000000000000000000000")
            .await
            .expect_err("unknown token rejected"),
        ApiTokenError::InvalidToken
    ));

    store.revoke(token_id).await.expect("revoke succeeds");
    assert!(matches!(
        store.authenticate(&token).await.expect_err("revoked token rejected"),
        ApiTokenError::Revoked
    ));
    let revoked_row: Option<Uuid> = sqlx::query_scalar(
        "SELECT token_id FROM api_tokens WHERE token_id = $1 AND revoked_at IS NOT NULL",
    )
    .bind(token_id)
    .fetch_optional(&pool)
    .await
    .expect("revoked flag query");
    assert!(revoked_row.is_some());

    let (other_id, other_token) = store.issue_token(account, "keep").await.expect("issue");
    sqlx::query("UPDATE accounts SET status = 'suspended' WHERE account_id = $1")
        .bind(account)
        .execute(&pool)
        .await
        .expect("suspend account");
    assert!(matches!(
        store.authenticate(&other_token).await.expect_err("suspended rejected"),
        ApiTokenError::InvalidToken
    ));
    assert_eq!(other_id, other_id); // 保持变量被使用;token 依旧吊销路径可用
}

#[sqlx::test(migrations = "./migrations")]
async fn label_bounds_are_enforced(pool: PgPool) {
    let store = PostgresApiTokenStore::new(pool.clone());
    let account = uuid("b1000000-0000-0000-0000-000000000003");
    insert_account(&pool, account, "MF-0000-0000-0014", "tokenlearner3").await;
    for bad_label in ["", "x".repeat(81).as_str(), "   "] {
        assert!(
            matches!(
                store.issue_token(account, bad_label).await.expect_err("bad label rejected"),
                ApiTokenError::InvalidLabel
            ),
            "label {bad_label:?} must be rejected"
        );
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --test postgres_api_token_store`
Expected: 编译失败——类型与模块不存在。红。

- [ ] **Step 3: Implement**

`src/adapters/postgres/api_token_store.rs` 全文:

```rust
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct PostgresApiTokenStore {
    pool: PgPool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApiTokenIdentity {
    pub token_id: Uuid,
    pub account_id: Uuid,
    pub label: String,
    pub username: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ApiTokenError {
    InvalidLabel,
    InvalidToken,
    Revoked,
    RandomUnavailable,
    StorageUnavailable,
}

impl PostgresApiTokenStore {
    #[must_use]
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// 签发:返回 (token_id, 明文)。明文只在本次响应出现一次,服务器只存 digest。
    ///
    /// # Errors
    ///
    /// 标签不合法或随机源/数据库不可用时返回对应错误。
    pub async fn issue_token(
        &self,
        account_id: Uuid,
        label: &str,
    ) -> Result<(Uuid, String), ApiTokenError> {
        let label = label.trim();
        if !(1..=80).contains(&label.len()) {
            return Err(ApiTokenError::InvalidLabel);
        }
        let mut raw = [0_u8; 32];
        getrandom::fill(&mut raw).map_err(|_| ApiTokenError::RandomUnavailable)?;
        let token: String = raw.iter().map(|byte| format!("{byte:02x}")).collect();
        let digest: [u8; 32] = Sha256::digest(token.as_bytes()).into();
        let token_id = Uuid::now_v7();
        sqlx::query(
            "INSERT INTO api_tokens (token_id, account_id, token_digest, label) \
             VALUES ($1, $2, $3, $4)",
        )
        .bind(token_id)
        .bind(account_id)
        .bind(digest.as_slice())
        .bind(label)
        .execute(&self.pool)
        .await
        .map_err(|_| ApiTokenError::StorageUnavailable)?;
        Ok((token_id, token))
    }

    /// 验证明文 token:先按 digest 找"未吊销且账户 active"的有效行;找不到时再查一次
    /// 行是否存在,以区分 invalid(不存在)与 revoked(存在但吊销/账户失效)。
    ///
    /// # Errors
    ///
    /// 未知 token、已吊销或账户非 active 时返回对应错误。
    pub async fn authenticate(&self, token: &str) -> Result<ApiTokenIdentity, ApiTokenError> {
        let digest: [u8; 32] = Sha256::digest(token.as_bytes()).into();
        let row: Option<(Uuid, Uuid, String, String)> = sqlx::query_as(
            "SELECT t.token_id, t.account_id, t.label, a.username_display \
             FROM api_tokens t JOIN accounts a ON a.account_id = t.account_id \
             WHERE t.token_digest = $1 AND t.revoked_at IS NULL AND a.status = 'active'",
        )
        .bind(digest.as_slice())
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| ApiTokenError::StorageUnavailable)?;
        let Some((token_id, account_id, label, username)) = row else {
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS (SELECT 1 FROM api_tokens WHERE token_digest = $1)",
            )
            .bind(digest.as_slice())
            .fetch_one(&self.pool)
            .await
            .map_err(|_| ApiTokenError::StorageUnavailable)?;
            return if exists {
                Err(ApiTokenError::Revoked)
            } else {
                Err(ApiTokenError::InvalidToken)
            };
        };
        sqlx::query("UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token_id = $1")
            .bind(token_id)
            .execute(&self.pool)
            .await
            .map_err(|_| ApiTokenError::StorageUnavailable)?;
        Ok(ApiTokenIdentity { token_id, account_id, label, username })
    }

    /// 吊销(幂等):置 revoked_at。已吊销再次吊销也返回 Ok。
    ///
    /// # Errors
    ///
    /// 数据库不可用时返回对应错误。
    pub async fn revoke(&self, token_id: Uuid) -> Result<(), ApiTokenError> {
        sqlx::query(
            "UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP \
             WHERE token_id = $1 AND revoked_at IS NULL",
        )
        .bind(token_id)
        .execute(&self.pool)
        .await
        .map_err(|_| ApiTokenError::StorageUnavailable)?;
        Ok(())
    }
}
```

`mod.rs`(adapters/postgres):仿照 tree_library_store 的声明行加 `mod api_token_store;` 与导出;`lib.rs` 的 `pub use adapters::postgres::{...}` 列表加 `ApiTokenError, ApiTokenIdentity, PostgresApiTokenStore`。

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test --test postgres_api_token_store`
Expected: PASS。含"库中无明文(hex 全文查不到)"断言。

- [ ] **Step 5: 全量门禁 + commit**

Run: `cargo fmt && cargo clippy --all-targets --all-features && cargo test --all-targets --all-features --locked`
Commit:
```bash
git add src/adapters/postgres/api_token_store.rs src/adapters/postgres/mod.rs src/lib.rs tests/postgres_api_token_store.rs
git commit -m "feat: api token store(签发存 digest/验证/吊销,last_used 更新)"
```

---

### Task 5: device flow 服务端端点(授权请求 / 授权页 / 轮询换 token)

**Files:**
- Modify: `D:\mapflow-server\src\app.rs`(新增 `McpHttpState` 结构 + `with_mcp` builder + `build_public_router` 里条件注册 4 条路由)
- Create: `D:\mapflow-server\src\http\mcp_auth.rs`(三个端点 + 授权页)
- Modify: `D:\mapflow-server\src\http\mod.rs`(声明 `mod mcp_auth;`)
- Modify: `D:\mapflow-server\src\http\auth.rs`(把 `require_mutation_identity`(L346-373)的"同源校验+会话解析+csrf 比对"抽成带显式 csrf 值的 `pub(crate) fn require_form_csrf_identity`,供表单 POST 复用)
- Modify: `D:\mapflow-server\src\runtime.rs`(bootstrap 元组加第 9 项 `Option<McpHttpState>`)
- Modify: `D:\mapflow-server\src\server.rs`(L34-46 解构与 `.with_mcp(...)`)
- Modify: `D:\mapflow-server\Cargo.toml`(dev-dependencies 加 `tower = { version = "0.5", features = ["util"] }`——HTTP 集成测试用 `ServiceExt::oneshot`;axum 0.8 本就依赖 tower 0.5,零版本新增)
- Create: `D:\mapflow-server\tests\mcp_auth_http.rs`

**Interfaces:**
- Consumes: `PostgresApiTokenStore`(Task 4)、`agent_audit_events` 无关本任务、`subtle::ConstantTimeEq`(auth.rs:7 已在用)、`require_current_identity`(auth.rs:328,GET 页与表单解析前取身份)。
- Produces: `McpHttpState`(app.rs,`McpHttpState::new(pool: PgPool) -> Self`;pub 字段 `api_token_store` / `tree_library_store` / `pending_authorizations: Mutex<HashMap<String, PendingAuthorization>>`,字段 pub(crate))。端点契约(给 relay 用,Task 7 照此实现):

```
POST /api/mcp/auth/requests                     请求体 {"label": "my-codex"}
  → 200 {"requestCode": str36, "secret": str64, "verificationPath": "/api/mcp/auth/approve?code=…",
         "expiresInSeconds": 600}
GET  /api/mcp/auth/requests/{requestCode}       header Authorization: Bearer <secret>
  → 200 {"status":"pending"} | {"status":"approved","token":str64,"label":str}
    | 200 {"status":"expired"} | 401/404 中文错误
GET  /api/mcp/auth/approve?code={requestCode}   登录后 → HTML 授权页(label + 用户名 + 允许/拒绝表单)
POST /api/mcp/auth/approve?code={requestCode}   form {csrf, decision: "approve"|"deny"} → HTML 结果页
```

Task 6 的 `/mcp` 与 Task 8 的 relay 依赖本契约。**设计决策(偏差 #2 落地)**:授权请求登记在进程内存(`Mutex<HashMap>`),不放库——单进程部署、TTL 10 分钟、服务器重启丢 pending(用户重跑 npx 即可),换取零迁移;签发结果仍落 `api_tokens` 表。

- [ ] **Step 1: Write the failing HTTP tests**

先在 `Cargo.toml` dev-dependencies 补 `tower`(0.5,features `util`),再写 `tests/mcp_auth_http.rs`。测试用 `build_public_router` + `PublicAppState`(两者均 pub):`PublicAppState::new` 需要 `Arc<LearningTreeSnapshot>` 与 `static_root`——手拼一个最小快照即可(所有字段 pub,字段形态以 `src/mapflow_contract.rs` 的 `SkillTreeView`/`SkillNodeView`/`SkillEdgeView`/`NodeProgressView` 定义为准),`static_root` 用 `std::env::temp_dir()`(ready 只影响 health,不影响本任务路由)。**单测函数内顺序发多个请求:每次 `oneshot` 前 `router.clone()`(Router 可 clone),pool 在 move 前 clone**。

```rust
use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use mapflow_server::{
    LearningTreeSnapshot, McpHttpState, NodeProgressView, PublicAppState, SkillEdgeView,
    SkillNodeView, SkillTreeView, build_public_router,
};
use sqlx::PgPool;
use std::sync::Arc;
use tower::ServiceExt;

fn empty_snapshot() -> LearningTreeSnapshot {
    LearningTreeSnapshot {
        tree: SkillTreeView {
            id: String::new(),
            topic: String::new(),
            title: String::new(),
            description: None,
            difficulty_level: String::new(),
            total_nodes: 0,
            revision: 1,
        },
        nodes: Vec::<SkillNodeView>::new(),
        edges: Vec::<SkillEdgeView>::new(),
        current_node_id: None,
        progress: Vec::<NodeProgressView>::new(),
        demo_source: None,
    }
}

fn app(pool: PgPool) -> axum::Router {
    let state = PublicAppState::new(Arc::new(empty_snapshot()), std::env::temp_dir())
        .with_mcp(McpHttpState::new(pool));
    build_public_router(state)
}

async fn json_body(response: axum::response::Response) -> serde_json::Value {
    let body = axum::body::to_bytes(response.into_body(), 64 * 1024)
        .await
        .expect("read body");
    serde_json::from_slice(&body).expect("valid json body")
}

#[sqlx::test(migrations = "./migrations")]
async fn device_flow_creates_request_then_pending_and_secret_guards(pool: PgPool) {
    let router = app(pool.clone());

    let create = Request::builder()
        .method("POST")
        .uri("/api/mcp/auth/requests")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(r#"{"label": "my-codex"}"#))
        .expect("create request builds");
    let response = router.clone().oneshot(create).await.expect("create responds");
    assert_eq!(response.status(), StatusCode::OK);
    let json = json_body(response).await;
    let request_code = json["requestCode"].as_str().expect("request code").to_owned();
    let secret = json["secret"].as_str().expect("secret").to_owned();
    assert_eq!(json["expiresInSeconds"], 600);
    assert_eq!(secret.len(), 64);
    assert!(
        json["verificationPath"]
            .as_str()
            .is_some_and(|path| path.contains(&request_code)),
        "verification path carries the code"
    );

    // 错误 secret → 401
    let wrong_secret = Request::builder()
        .method("GET")
        .uri(format!("/api/mcp/auth/requests/{request_code}"))
        .header(header::AUTHORIZATION, format!("Bearer {}", "f".repeat(64)))
        .body(Body::empty())
        .expect("wrong secret request builds");
    let response = router.clone().oneshot(wrong_secret).await.expect("wrong secret responds");
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    // 正确 secret → pending
    let right_secret = Request::builder()
        .method("GET")
        .uri(format!("/api/mcp/auth/requests/{request_code}"))
        .header(header::AUTHORIZATION, format!("Bearer {secret}"))
        .body(Body::empty())
        .expect("right secret request builds");
    let response = router.clone().oneshot(right_secret).await.expect("pending poll responds");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await, serde_json::json!({ "status": "pending" }));
}

#[sqlx::test(migrations = "./migrations")]
async fn unknown_request_code_is_not_found_and_bad_labels_are_rejected(pool: PgPool) {
    let router = app(pool.clone());

    let unknown = Request::builder()
        .method("GET")
        .uri("/api/mcp/auth/requests/00000000-0000-0000-0000-000000000099")
        .header(header::AUTHORIZATION, "Bearer abc")
        .body(Body::empty())
        .expect("unknown code request builds");
    let response = router.clone().oneshot(unknown).await.expect("unknown code responds");
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    for bad_label in ["", "    ", &"x".repeat(81)] {
        let body = serde_json::json!({ "label": bad_label }).to_string();
        let create = Request::builder()
            .method("POST")
            .uri("/api/mcp/auth/requests")
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(body))
            .expect("bad label request builds");
        let response = router.clone().oneshot(create).await.expect("bad label responds");
        assert!(
            response.status() == StatusCode::BAD_REQUEST
                || response.status() == StatusCode::UNPROCESSABLE_ENTITY,
            "label {bad_label:?} must be rejected"
        );
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn approval_page_requires_a_logged_in_session(pool: PgPool) {
    let router = app(pool);
    let page = Request::builder()
        .method("GET")
        .uri("/api/mcp/auth/approve?code=00000000-0000-0000-0000-000000000099")
        .body(Body::empty())
        .expect("approve page request builds");
    let response = router.oneshot(page).await.expect("approve page responds");
    // 无会话 cookie 必须被登录守卫拦下;错误码以 auth.rs 现有守卫返回为准(401/403/404 择一断言:
    // 先跑一次看实际值再定,仓库 ServiceError 对未认证的具体映射以现有端点行为为准)
    assert_ne!(response.status(), StatusCode::OK);
}
```

**能力边界(诚实标注)**:批准→轮询拿到 token 的完整链路需要登录会话 + CSRF(identity 注入设施仓库尚无),自动测试只能到"授权页无会话 → 非 200";完整链路列为 Task 8 部署冒烟项(spec §7 第 5 行本就放在部署验证层)。

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --test mcp_auth_http`
Expected: 编译失败(`McpHttpState`、`mcp_auth` 模块、路由都不存在)。红。

- [ ] **Step 3: Implement(先 app.rs 骨架,再 mcp_auth.rs)**

`app.rs`:

```rust
#[derive(Clone)]
pub struct McpHttpState {
    pub(crate) api_token_store: crate::PostgresApiTokenStore,
    pub(crate) tree_library_store: crate::PostgresTreeLibraryStore,
    pub(crate) pending_authorizations:
        std::sync::Mutex<std::collections::HashMap<String, PendingAuthorization>>,
}

impl McpHttpState {
    #[must_use]
    pub fn new(pool: PgPool) -> Self {
        Self {
            api_token_store: crate::PostgresApiTokenStore::new(pool.clone()),
            tree_library_store: crate::PostgresTreeLibraryStore::new(pool),
            pending_authorizations: std::sync::Mutex::new(std::collections::HashMap::new()),
        }
    }
}
```

`PendingAuthorization` 定义放 `src/http/mcp_auth.rs`(pub(crate),app.rs 经 `use` 引用同 crate 类型无障碍),`app.rs` 需要 `pub use` 或 `use crate::http::mcp_auth::PendingAuthorization;`。`PublicAppState` 加字段 `pub(crate) mcp: Option<Arc<McpHttpState>>`(new 里 `mcp: None`)+ builder:

```rust
    #[must_use]
    pub fn with_mcp(mut self, mcp: McpHttpState) -> Self {
        self.mcp = Some(Arc::new(mcp));
        self
    }
```

`build_public_router` 在函数尾(其它条件路由之后)追加:

```rust
    if state.mcp.is_some() {
        router = router
            .route("/api/mcp/auth/requests", post(mcp_auth::start_authorization))
            .route(
                "/api/mcp/auth/requests/{request_code}",
                get(mcp_auth::poll_authorization),
            )
            .route(
                "/api/mcp/auth/approve",
                get(mcp_auth::approval_page).post(mcp_auth::resolve_approval),
            );
    }
```

(`route` 同 path 挂 GET+POST 是 axum 0.8 既有写法,参照 `/api/me/tree-library` L394-397。)

`runtime.rs`:`bootstrap_identity_services` 返回值元组加第 9 项 `Option<McpHttpState>`,在 `knowledge_chat` 构造附近加:

```rust
    let mcp = Some(McpHttpState::new(pool.clone()));
```

`bootstrap_public_services` 的元组与 `server.rs` 解构同步扩一项,并补:

```rust
            if let Some(mcp) = mcp {
                public_state = public_state.with_mcp(mcp);
            }
```

`auth.rs` 抽取(保持 `require_mutation_identity` 外部行为不变):

```rust
pub(crate) async fn require_form_csrf_identity(
    state: &PublicAppState,
    headers: &HeaderMap,
    supplied_csrf: &str,
) -> Result<CurrentIdentity, ServiceError> {
    verify_same_origin(headers, &state_origin(state)?, &state_host(state)?)?; // 以现有实现为准:需要 identity 状态
    let current = resolve_current_identity(identity, headers).await?;
    let expected_csrf = current.csrf_token().expose_secret();
    if supplied_csrf.len() != expected_csrf.len()
        || !bool::from(supplied_csrf.as_bytes().ct_eq(expected_csrf.as_bytes()))
    {
        return Err(ServiceError::CsrfRejected);
    }
    Ok(current)
}
```

实现时把 `require_mutation_identity`(L346-373)改写成"取 header 里的 x-csrf-token → 调 `require_form_csrf_identity`",保持原有 host/origin/观察点埋点逻辑不动(观察点埋点若不便抽出,新函数内做等价埋点即可;以编译过 + 行为不变为验收)。

- [ ] **Step 4: Implement 端点(续)**

`src/http/mcp_auth.rs` 骨架(完整写):

```rust
use std::collections::HashMap;
use std::time::{Duration, Instant, SystemTime};

use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::response::{Html, IntoResponse, Response};
use axum::{Form, Json};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq as _;
use uuid::Uuid;

use crate::app::{McpHttpState, PublicAppState};
use crate::error::ServiceError;
use crate::http::auth::{require_current_identity, require_form_csrf_identity};

pub(crate) const PENDING_TTL: Duration = Duration::from_secs(600);

/// 一次待批准的授权请求。secret 只存 digest;approved_account_id 由授权页回填。
pub(crate) struct PendingAuthorization {
    pub(crate) secret_digest: [u8; 32],
    pub(crate) label: String,
    pub(crate) approved_account_id: Option<Uuid>,
    pub(crate) expires_at: SystemTime,
}

fn sha256_hex(value: &str) -> [u8; 32] {
    Sha256::digest(value.as_bytes()).into()
}

fn random_secret() -> (String, [u8; 32]) {
    let mut raw = [0_u8; 32];
    getrandom::fill(&mut raw).expect("OS random is available on the server");
    let secret: String = raw.iter().map(|byte| format!("{byte:02x}")).collect();
    let digest = sha256_hex(&secret);
    (secret, digest)
}
```

**依赖检查**:`sha2`/`subtle`/`getrandom`/`uuid` 均在既有 Cargo.toml(identity/rate_limit/auth 已用);新增 `use` 若与现有导出路径不符以编译错误为准微调。`ServiceError` 与 `axum::response::Result` 的用法以现有 handler(如 `http/tree_library.rs`)为准。

然后实现三个端点(逻辑按契约;以下为行为规格,代码骨架以现有 handler 风格写,`Json`/`Html` 中文消息):

```rust
#[derive(Deserialize)]
pub(crate) struct StartRequest { label: String }

pub(crate) async fn start_authorization(
    State(state): State<PublicAppState>,
    Json(payload): Json<StartRequest>,
) -> Result<Json<serde_json::Value>, ServiceError> {
    let label = payload.label.trim().to_owned();
    if label.is_empty() || label.len() > 80 {
        return Err(ServiceError::BadRequest); // 以 error.rs 实际变体为准;语义=中文"标签需 1-80 字符"
    }
    let mcp = state.mcp.as_ref().ok_or(ServiceError::NotFound)?;
    let request_code = Uuid::now_v7().to_string();
    let (secret, digest) = random_secret();
    let expires_at = SystemTime::now() + PENDING_TTL;
    mcp.pending_authorizations.lock().expect("pending map lock").insert(
        request_code.clone(),
        PendingAuthorization { secret_digest: digest, label: label.clone(), approved_account_id: None, expires_at },
    );
    Ok(Json(serde_json::json!({
        "requestCode": request_code,
        "secret": secret,
        "verificationPath": format!("/api/mcp/auth/approve?code={request_code}"),
        "expiresInSeconds": PENDING_TTL.as_secs(),
    })))
}

pub(crate) async fn poll_authorization(
    State(state): State<PublicAppState>,
    Path(request_code): Path<String>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ServiceError> {
    // 1) 读 Authorization: Bearer <secret>;缺失/畸形 → 401 中文错误
    // 2) digest 与 PendingAuthorization.secret_digest 常量时间比对;不符 → 401
    // 3) 过期 → 移除该条并返回 {"status": "expired"}
    // 4) approved_account_id 为空 → {"status": "pending"}
    // 5) 已批准 → 移除该条,调 mcp.api_token_store.issue_token(account, label),
    //    返回 {"status": "approved", "token": <明文>, "label": ...}(token 明文只此一次)
}

pub(crate) async fn approval_page(
    State(state): State<PublicAppState>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Html<String>, ServiceError> {
    let current = require_current_identity(&state, &headers).await?;
    // 找 pending;不存在/过期 → 404 中文 HTML
    // 渲染表单(action 同 URL,含 hidden csrf=current.csrf_token()、label、username),
    // label/username 必须过 escape_html 防注入(用户可控文本!)
}

pub(crate) async fn resolve_approval(
    State(state): State<PublicAppState>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
    Form(form): Form<HashMap<String, String>>,
) -> Result<Html<String>, ServiceError> {
    let csrf = form.get("csrf").map(String::as_str).unwrap_or_default();
    let current = require_form_csrf_identity(&state, &headers, csrf).await?;
    // decision == "approve" → 回填 approved_account_id = Some(current.account_id)
    // 否则(deny/未知)→ 删除条目
    // 渲染结果 HTML(中文:"已授权,请回到终端" / "已取消")
}

/// 最小 HTML 转义:label/username 来自用户输入,必须转义后拼进页面
pub(crate) fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}
```

**已知取舍(诚实标注)**:`resolve_approval`/`approval_page` 依赖登录会话与 CSRF,仓库没有可注入身份的 HTTP 测试设施,自动测试只到"无会话 → 401";批准→轮询→签发 token 的完整链路放 Task 8 部署冒烟(与 spec §7 部署验证行一致)。

- [ ] **Step 5: Run tests to verify they pass**

Run: `cargo test --test mcp_auth_http`
Expected: PASS。另跑 `cargo test --all-targets` 确认 auth.rs 重构没破坏既有(http handler 无既有集成测试,以编译 + 既有测试绿为验收)。

- [ ] **Step 6: 全量门禁 + commit**

Run: `cargo fmt && cargo clippy --all-targets --all-features && cargo test --all-targets --all-features --locked`
Commit(含 Cargo.toml/Cargo.lock 的 dev-dep 变更):
```bash
git add src/app.rs src/http/mod.rs src/http/mcp_auth.rs src/http/auth.rs src/runtime.rs src/server.rs Cargo.toml Cargo.lock tests/mcp_auth_http.rs
git commit -m "feat: device flow 授权端点(请求登记/授权页/轮询换 api token)"
```

---

### Task 6: /mcp JSON-RPC 端点 + 四个工具接线

**Files:**
- Modify: `D:\mapflow-server\src\adapters\postgres\tree_library_store.rs`(新增两个只读方法:`list_tree_blocks` / `list_node_block_assignments`)
- Create: `D:\mapflow-server\src\http\mcp_rpc.rs`(JSON-RPC 处理器 + 工具定义与装配)
- Modify: `D:\mapflow-server\src\http\mod.rs`(声明 `mod mcp_rpc;`)
- Modify: `D:\mapflow-server\src\app.rs`(Task 5 的 `if state.mcp.is_some()` 块里加 `.route("/mcp", post(mcp_rpc::rpc))`)
- Create: `D:\mapflow-server\tests\common\mod.rs`(把 Task 5 的 `empty_snapshot`/`app` fixture 抽到共享位置)
- Modify: `D:\mapflow-server\tests\mcp_auth_http.rs`(改用共享 fixture——小重构)
- Create: `D:\mapflow-server\tests\mcp_rpc_http.rs`

**Interfaces:**
- Consumes: `McpHttpState`(Task 5)、`PostgresApiTokenStore::authenticate`(Task 4)、`list_personal_library`/`load_personal_tree`/`apply_personal_tree_mutation`(现有 store 方法)、`MutationActor`(Task 3)、Task 1 的 `skill_tree_blocks`/`skill_nodes.block_id`。
- Produces: `POST /mcp` 端点,JSON-RPC 2.0 子集:`initialize` / `tools/list` / `tools/call`(MVP 不做 notifications 之外的推送)。工具:`mapflow.get_progress` / `mapflow.get_tree` / `mapflow.apply_tree_mutation` / `mapflow.whoami`。Task 7 的 relay 与 Task 8 的冒烟依赖此契约。

**协议细节(写给 Task 7 的实现者,也是本任务的验收面)**:
- 认证:`Authorization: Bearer <token>` 作用于**每个** `/mcp` 请求(含 initialize);无/坏/吊销 token → `HTTP 401`,body `{"code": "auth.invalid_token"|"auth.token_revoked", "message": 中文}`。relay 先授权后连接,天然满足。
- 请求:`{"jsonrpc":"2.0","id":<number|string>,"method":"tools/call","params":{"name":…,"arguments":{…}}}`;无 `id` 的通知不响应。`id` 原样回带。
- 响应:`{"jsonrpc":"2.0","id":…,"result":…}`;错误 `{"jsonrpc":"2.0","id":…,"error":{"code":-32602,"message":中文,"data":{"code":<operationCode>}}}`。
- `initialize` 回 `{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":false}},"serverInfo":{"name":"mapflow","version":<env!("CARGO_PKG_VERSION")>}}`;`tools/list` 回 `{"tools":[{name,description,inputSchema}]}`。
- 错误码约定(中文消息 + `data.code`):修订冲突 `mutation.revision_conflict`"树已被修改,请重读最新版后重试。"、非本人树 `mutation.not_private_tree`"只能修改你自己的私人树。"、命令无效 `mutation.invalid`"变更命令无效,请检查节点/边/块 id 与 patch 字段。"、存储不可用 `tree_library.unavailable`"服务暂不可用,请稍后重试。"。**偏差记录**:spec §6 的 `block.unknown_block`/`block.duplicate_name`/`block.node_not_in_tree` 在 store 层已折叠为通用 `MutationInvalid`(Task 2 已核对映射),MCP 层不细分——中文消息足够 Agent 定位,`data.code` 保持粗粒度。

- [ ] **Step 1: Write the failing tests**

`tests/mcp_rpc_http.rs` + `tests/common/mod.rs`。**先建共享 fixture**:把 Task 5 `mcp_auth_http.rs` 里的 `empty_snapshot()`/`app()` 原样移入 `tests/common/mod.rs`(加 `pub`),并在 `mcp_auth_http.rs` 顶部加 `mod common; use common::{app, empty_snapshot};`,删除本地重复定义。然后新测试文件(直接复用 common):

```rust
mod common;

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use mapflow_server::{
    MutationActor, PostgresApiTokenStore, PostgresTreeLibraryStore,
};
use common::{app, empty_snapshot};
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

fn uuid(value: &str) -> Uuid {
    Uuid::parse_str(value).expect("valid test UUID")
}

// 建账户 + 私人树(含节点 n1/n2,难度 1 与 3)+ 块 b1 且 n1 归入 b1;返回 (account, entry_id, token)
async fn seed(pool: &PgPool) -> (Uuid, Uuid, String) {
    let account = uuid("c1000000-0000-0000-0000-000000000001");
    let tree_id = uuid("c1000000-0000-0000-0000-000000000002");
    let entry_id = uuid("c1000000-0000-0000-0000-000000000003");
    sqlx::query(
        "INSERT INTO accounts (account_id, player_id, username_display, username_key) \
         VALUES ($1, 'MF-0000-0000-0015', 'rpcuser', 'rpcuser')",
    )
    .bind(account)
    .execute(pool)
    .await
    .expect("account inserts");
    sqlx::query(
        "INSERT INTO skill_trees \
         (tree_id, owner_account_id, visibility, source, lifecycle, content_digest, topic, \
          title, difficulty_level, total_nodes) \
         VALUES ($1, $2, 'private', 'ai_generated', 'ready', $3, 'T', 'T', 'beginner', 2)",
    )
    .bind(tree_id)
    .bind(account)
    .bind(vec![9_u8; 32])
    .execute(pool)
    .await
    .expect("private tree inserts");
    // 注意:难度与原序故意相反(n1 难 3 先插、n2 难 1 后插),排序才可被区分
    for (node_id, difficulty) in [("n1", 3), ("n2", 1)] {
        sqlx::query(
            "INSERT INTO skill_nodes \
             (tree_id, node_id, title, icon, category, difficulty, estimated_minutes, \
              depth_level, position_x, position_y, order_in_level, recommended_depth, \
              depth_rationale, observable_evidence) \
             VALUES ($1, $2, $2, 'circle', '架构', $3, 10, 0, 0, 0, 0, 'Understand', '', '')",
        )
        .bind(tree_id)
        .bind(node_id)
        .bind(difficulty)
        .execute(pool)
        .await
        .expect("node inserts");
    }
    let block_id = uuid("c1000000-0000-0000-0000-000000000004");
    sqlx::query(
        "INSERT INTO skill_tree_blocks (tree_id, block_id, name, color, sort_order) \
         VALUES ($1, $2, '请求生命周期', '#4f9cf7', 0)",
    )
    .bind(tree_id)
    .bind(block_id)
    .execute(pool)
    .await
    .expect("block inserts");
    sqlx::query("UPDATE skill_nodes SET block_id = $3 WHERE tree_id = $1 AND node_id = 'n1'")
        .bind(tree_id)
        .bind(block_id)
        .execute(pool)
        .await
        .expect("membership inserts");
    sqlx::query(
        "INSERT INTO account_tree_library (library_entry_id, account_id, tree_id) \
         VALUES ($1, $2, $3)",
    )
    .bind(entry_id)
    .bind(account)
    .bind(tree_id)
    .execute(pool)
    .await
    .expect("library entry inserts");
    let (_, token) = PostgresApiTokenStore::new(pool.clone())
        .issue_token(account, "test-token")
        .await
        .expect("token issues");
    (account, entry_id, token)
}

async fn rpc(router: &axum::Router, token: Option<&str>, body: Value) -> (StatusCode, Value) {
    let mut builder = Request::builder().method("POST").uri("/mcp");
    if let Some(token) = token {
        builder = builder.header(header::AUTHORIZATION, format!("Bearer {token}"));
    }
    let request = builder
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body.to_string()))
        .expect("rpc request builds");
    let response = router.clone().oneshot(request).await.expect("rpc responds");
    let status = response.status();
    let value = serde_json::from_slice(
        &axum::body::to_bytes(response.into_body(), 1024 * 1024).await.expect("read body"),
    )
    .expect("json body");
    (status, value)
}

#[sqlx::test(migrations = "./migrations")]
async fn unauthenticated_or_bad_token_requests_are_rejected(pool: PgPool) {
    let router = app(pool);
    let (status, body) = rpc(&router, None, json!({"jsonrpc":"2.0","id":1,"method":"tools/list"})).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["code"], "auth.invalid_token");

    let (status, _body) = rpc(
        &router,
        Some(&"0".repeat(64)),
        json!({"jsonrpc":"2.0","id":1,"method":"tools/list"}),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test(migrations = "./migrations")]
async fn tools_list_and_whoami_and_get_progress(pool: PgPool) {
    let router = app(pool.clone());
    let (account, entry_id, token) = seed(&pool).await;
    let (_, entry_id, _) = (account, entry_id, ());

    let (status, body) = rpc(
        &router,
        Some(&token),
        json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["result"]["protocolVersion"], "2024-11-05");

    let (status, body) = rpc(&router, Some(&token), json!({"jsonrpc":"2.0","id":2,"method":"tools/list"})).await;
    assert_eq!(status, StatusCode::OK);
    let names: Vec<&str> = body["result"]["tools"]
        .as_array()
        .expect("tools array")
        .iter()
        .map(|tool| tool["name"].as_str().expect("tool name"))
        .collect();
    for expected in ["mapflow.get_progress", "mapflow.get_tree", "mapflow.apply_tree_mutation", "mapflow.whoami"] {
        assert!(names.contains(&expected), "missing tool {expected}: {names:?}");
    }

    let (status, body) = rpc(
        &router,
        Some(&token),
        json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"mapflow.whoami","arguments":{}}}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["result"]["accountId"], account.to_string());

    let (status, body) = rpc(
        &router,
        Some(&token),
        json!({"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"mapflow.get_progress","arguments":{}}}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["result"]["trees"][0]["libraryEntryId"], entry_id.to_string());
    assert_eq!(body["result"]["trees"][0]["totalNodes"], 2);
    assert_eq!(body["result"]["trees"][0]["completedNodes"], 0);
}

#[sqlx::test(migrations = "./migrations")]
async fn get_tree_returns_blocks_and_sorts_but_mutation_is_scoped_and_versioned(pool: PgPool) {
    let router = app(pool.clone());
    let (account, entry_id, token) = seed(&pool).await;

    let (status, body) = rpc(
        &router,
        Some(&token),
        json!({"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"mapflow.get_tree","arguments":{"libraryEntryId":entry_id.to_string()}}}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let result = &body["result"];
    assert_eq!(result["tree"]["totalNodes"], 2);
    assert_eq!(result["blocks"].as_array().expect("blocks").len(), 1);
    assert_eq!(result["blocks"][0]["name"], "请求生命周期");
    let nodes = result["nodes"].as_array().expect("nodes");
    assert_eq!(nodes.len(), 2);
    assert_eq!(nodes[0]["id"], "n1", "default keeps original order (n1 seeded first)");
    let n1 = nodes.iter().find(|node| node["id"] == "n1").expect("n1 present");
    assert_eq!(n1["blockId"], json!("c1000000-0000-0000-0000-000000000004"));

    // 按难度:n2(难 1)应排到最前——与原序相反,才能证明排序真的生效
    let (status, body) = rpc(
        &router,
        Some(&token),
        json!({"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"mapflow.get_tree","arguments":{"libraryEntryId":entry_id.to_string(),"sort":"by_difficulty"}}}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let nodes = body["result"]["nodes"].as_array().expect("nodes");
    assert_eq!(nodes.len(), 2);
    assert_eq!(nodes[0]["id"], "n2", "difficulty 1 must sort first");

    // apply:add_node 成功且审计以 api_token actor 落账;随后 stale revision 报 conflict
    let (status, body) = rpc(
        &router,
        Some(&token),
        json!({"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"mapflow.apply_tree_mutation","arguments":{"libraryEntryId":entry_id.to_string(),"mutation":{"operation":"add_node","targetId":"n3","revision":1,"idempotencyKey":"rpc-add-n3","patch":{"title":"N3","category":"hands-on"}}}}}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["result"]["applied"], true);
    assert_eq!(body["result"]["revision"], 2);
    let (actor_type, actor_id, operation): (String, String, String) = sqlx::query_as(
        "SELECT actor_type, actor_id, operation FROM agent_audit_events WHERE account_id = $1",
    )
    .bind(account)
    .fetch_one(&pool)
    .await
    .expect("audit row written by MCP");
    assert_eq!(actor_type, "api_token");
    assert_eq!(operation, "add_node");
    assert!(actor_id.len() == 36, "actor_id is the token id uuid: {actor_id}");

    let (status, body) = rpc(
        &router,
        Some(&token),
        json!({"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"mapflow.apply_tree_mutation","arguments":{"libraryEntryId":entry_id.to_string(),"mutation":{"operation":"add_node","targetId":"n4","revision":1,"idempotencyKey":"rpc-add-n4","patch":{"title":"N4","category":"hands-on"}}}}}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["error"]["data"]["code"], "mutation.revision_conflict");

    // 他人 entry:get_tree → 参数错误(not owned 语义)
    let (status, body) = rpc(
        &router,
        Some(&token),
        json!({"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"mapflow.get_tree","arguments":{"libraryEntryId":"99999999-0000-0000-0000-000000000099"}}}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["error"].is_object(), "unknown entry returns a jsonrpc error");
}
```

注意:seed 时树 `total_nodes=2`(与 2 个节点一致;`apply` 后 store 会重算为 3)。`empty_snapshot`/`app` 移到 common 后,Task 5 测试文件只剩两个集成测试用例不再需要 `use` 报错修剪,以编译为准。

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --test mcp_rpc_http`
Expected: 编译失败——store 读方法、`mcp_rpc` 模块与 `/mcp` 路由不存在。红。

- [ ] **Step 3: Implement(store 两个只读方法)**

`tree_library_store.rs`(放在 `load_personal_tree` 之后):

```rust
    /// Lists block definitions of one tree (ownership checked by the caller via
    /// `load_personal_tree` beforehand).
    ///
    /// # Errors
    ///
    /// Returns a storage-unavailable error when storage cannot be read.
    pub async fn list_tree_blocks(
        &self,
        tree_id: Uuid,
    ) -> Result<Vec<(Uuid, String, Option<String>, i32)>, PostgresTreeLibraryError> {
        sqlx::query_as(
            "SELECT block_id, name, color, sort_order \
             FROM skill_tree_blocks WHERE tree_id = $1 ORDER BY sort_order, block_id",
        )
        .bind(tree_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_storage_failure)
    }

    /// Lists node-to-block assignments of one tree as (node_id, block_id) pairs.
    ///
    /// # Errors
    ///
    /// Returns a storage-unavailable error when storage cannot be read.
    pub async fn list_node_block_assignments(
        &self,
        tree_id: Uuid,
    ) -> Result<Vec<(String, Uuid)>, PostgresTreeLibraryError> {
        sqlx::query_as(
            "SELECT node_id, block_id FROM skill_nodes \
             WHERE tree_id = $1 AND block_id IS NOT NULL ORDER BY node_id",
        )
        .bind(tree_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_storage_failure)
    }
```

(sqlx 的 `query_as` 对 4 元以内 tuple 有 `FromRow` 实现,可直接用;返回的 `String`/`Uuid`/`i32` 与 `OPTION<String>` 列类型对应。)

- [ ] **Step 4: Implement(JSON-RPC 处理器与工具)**

`src/http/mcp_rpc.rs`(骨架全文;`authenticate` 的 token 提取、错误中文文案按下面写,HTTP/axum 细节照既有 handler):

```rust
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app::PublicAppState;
use crate::error::ServiceError;
use crate::{MutationActor, PostgresTreeLibraryError};

pub(crate) async fn rpc(
    State(state): State<PublicAppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Response {
    let id = payload.get("id").cloned();
    let method = payload.get("method").and_then(Value::as_str).unwrap_or_default();
    let params = payload.get("params").cloned().unwrap_or_else(|| json!({}));
    // 1) 认证:Authorization: Bearer <token> → api_token_store.authenticate
    //    401 时返回 (StatusCode::UNAUTHORIZED, Json({"code": "auth.invalid_token" | "auth.token_revoked",
    //    "message": "令牌无效,请重新执行 npx @mapflow/mcp 授权。" | "令牌已吊销,请重新授权。"}))
    // 2) 按 method 分发;未实现的方法返回 jsonrpc 错误 -32601
    // 3) tools/call 的 name 分发到四个装配函数;工具不存在 → -32602
    // 4) 全部响应带原始 id;jsonrpc 版本字段恒为 "2.0"
}

fn jsonrpc_ok(id: Option<Value>, result: Value) -> Response { /* … */ }
fn jsonrpc_error(id: Option<Value>, code: i64, message: &str, op_code: &str) -> Response {
    Json(json!({
        "jsonrpc": "2.0",
        "id": id.unwrap_or(Value::Null),
        "error": { "code": code, "message": message, "data": { "code": op_code } },
    }))
    .into_response()
}
```

**装配函数(行为规格 + 关键代码)**——四个函数签名统一 `async fn(identity: &ApiTokenIdentity, params: &Value) -> Result<Value, McpToolError>`,错误经上层映射为 JSON-RPC error。映射表:

```rust
fn map_mutation_error(error: PostgresTreeLibraryError) -> (i64, &'static str, &'static str) {
    match error {
        PostgresTreeLibraryError::MutationRevisionConflict => (-32000, "mutation.revision_conflict", "树已被修改,请重读最新版后重试。"),
        PostgresTreeLibraryError::MutationNotAuthorized => (-32000, "mutation.not_private_tree", "只能修改你自己的私人树。"),
        PostgresTreeLibraryError::MutationInvalid | PostgresTreeLibraryError::MutationTargetMissing => {
            (-32602, "mutation.invalid", "变更命令无效,请检查节点/边/块 id 与 patch 字段。")
        }
        _ => (-32000, "tree_library.unavailable", "服务暂不可用,请稍后重试。"),
    }
}
```

- **whoami**:`json!({"tokenId": id.token_id, "accountId": id.account_id, "label": id.label, "username": id.username})`。
- **get_progress**:`store.list_personal_library(account_id)`,逐条拼 `libraryEntryId`/`title`/`topic`/`difficultyLevel`/`totalNodes`/`revision`/`completedNodes`;`completedNodeIds` 每棵一次 `SELECT node_id FROM account_node_completions WHERE library_entry_id = $1 ORDER BY node_id`(树少,逐条查可接受)。返回 `{"trees":[…]}`。字段键沿用 `PersonalLibraryEntryView`/`PersonalTreeView` 的既有命名,字符串化 uuid。
- **get_tree**:入参 `libraryEntryId`(必)、`sort`(可选 `original`/`by_difficulty`/`by_category`,非法值按参数错误 -32602)。`load_personal_tree(account_id, entry)` 得 `None` → 错误 `(-32602,"tree.not_found","树不存在或不属于当前账户。")`;然后 `list_tree_blocks(tree_id)` + `list_node_block_assignments(tree_id)` 并进结果。排序只作用于返回副本,节点列表按 `sort` 重排:

```rust
fn ordered_nodes(mut nodes: Vec<SkillNodeView>, sort: &str) -> Vec<SkillNodeView> {
    match sort {
        "by_difficulty" => nodes.sort_by_key(|node| (node.difficulty, node.depth_level, node.id.clone())),
        "by_category" => nodes.sort_by(|a, b| a.category.cmp(&b.category).then(a.difficulty.cmp(&b.difficulty)).then(a.id.cmp(&b.id))),
        _ => { /* 原序:库查询已按 depth_level, order_in_level 排好 */ }
    }
    nodes
}
```

返回形态(节点附带 `blockId` 键——在 `SkillNodeView` 的 JSON 上补字段,不引入共享 struct 变更):`{"libraryEntryId","sort","tree":{…SkillTreeView…},"nodes":[SkillNodeView + "blockId": uuid|null],"edges":[…],"blocks":[{"id","name","color","sortOrder"}],"completedNodeIds":[…]}`。
- **apply_tree_mutation**:入参 `libraryEntryId` + `mutation`(对象,直接 `serde_json::from_value::<PersonalTreeMutationCommand>(…)`,失败 → -32602 参数错误)。调用 `store.apply_personal_tree_mutation(&MutationActor::api_token(identity.token_id), identity.account_id, entry, &command)`,成功(Applied 或 AlreadyApplied)回 `{"applied": true, "revision"}`;错误走 `map_mutation_error`。

**工具清单(静态注册,tools/list 与 dispatch 共用这一个数组,防双源漂移)**:

```rust
struct ToolSpec { name: &'static str, description: &'static str, input_schema: Value }
const TOOLS: &[ToolSpec] = &[
    ToolSpec { name: "mapflow.get_progress", description: "读取当前账户全部学习树及每棵树的学习进度(完成节点数与节点 id 列表)。", input_schema: json!({"type":"object","properties":{},"additionalProperties":false}) },
    ToolSpec { name: "mapflow.get_tree", description: "读取一棵私人树的全部节点、边、块与完成度;可选按难度或分类排序输出。", input_schema: json!({"type":"object","properties":{ "libraryEntryId": {"type":"string","minLength":36,"maxLength":36}, "sort": {"type":"string","enum":["original","by_difficulty","by_category"]} }, "required":["libraryEntryId"], "additionalProperties":false}) },
    ToolSpec { name: "mapflow.apply_tree_mutation", description: "向本人一棵私人树提交一条变更命令(增删改节点/边、块操作);自带幂等与版本校验,失败需重读最新树后重试。", input_schema: json!({"type":"object","properties":{ "libraryEntryId": {"type":"string","minLength":36,"maxLength":36}, "mutation": {"type":"object","properties":{ "operation": {"type":"string","enum":["add_node","update_node","delete_node","add_edge","update_edge","delete_edge","update_tree","clear_tree","add_block","update_block","delete_block","set_node_block"]}, "targetId": {"type":"string","minLength":1,"maxLength":240}, "revision": {"type":"integer","minimum":1}, "idempotencyKey": {"type":"string","minLength":1,"maxLength":128}, "patch": {"type":"object"} }, "required":["operation","revision","idempotencyKey","patch"], "additionalProperties":false} }, "required":["libraryEntryId","mutation"], "additionalProperties":false}) },
    ToolSpec { name: "mapflow.whoami", description: "查看当前令牌对应的账户与用途标签(排障用)。", input_schema: json!({"type":"object","properties":{},"additionalProperties":false}) },
];
```

`TOOLS` 需要 `SkillNodeView`/`SkillEdgeView` 的 `Serialize`——它们已是(树响应走 serde)。`http/mod.rs` 声明 `mod mcp_rpc;`;`app.rs` 的 mcp 路由块补 `/mcp`。**字段键一致性**:id 一律序列化为字符串(uuid 转 `.to_string()`)。

- [ ] **Step 5: Run tests to verify they pass**

Run: `cargo test --test mcp_rpc_http --test mcp_auth_http`
Expected: 全 PASS。再跑 `cargo test --all-targets` 确认无回归。

- [ ] **Step 6: 全量门禁 + commit**

Run: `cargo fmt && cargo clippy --all-targets --all-features && cargo test --all-targets --all-features --locked`
Commit:
```bash
git add src/adapters/postgres/tree_library_store.rs src/http/mod.rs src/http/mcp_rpc.rs src/app.rs tests/common/mod.rs tests/mcp_auth_http.rs tests/mcp_rpc_http.rs
git commit -m "feat: /mcp JSON-RPC 端点与四个 mapflow_* 工具(读进度/读树/改树/whoami)"
```

---

### Task 7: mcp-relay TS 包(stdio MCP server + device flow 客户端 + 转发器)

**Files(全部新建,位于 `D:\MapFlow-publish\mcp-relay\`):**
- Create: `mcp-relay/package.json`
- Create: `mcp-relay/tsconfig.json`
- Create: `mcp-relay/vitest.config.ts`
- Create: `mcp-relay/src/config.ts`
- Create: `mcp-relay/src/token-file.ts`
- Create: `mcp-relay/src/http.ts`
- Create: `mcp-relay/src/device-flow.ts`
- Create: `mcp-relay/src/index.ts`
- Create: `mcp-relay/test/device-flow.test.ts`
- Create: `mcp-relay/test/http.test.ts`
- Modify: `D:\MapFlow-publish\vite.config.ts`(root vitest `include` 限定为 `['src/**/*.{test,spec}.{ts,tsx}']`,避免 root `npm test` 误抓 relay 测试——root tsconfig 已只 include `src`,无冲突)

**Interfaces:**
- Consumes: Task 5 端点契约 + Task 6 `/mcp` 契约;`@modelcontextprotocol/sdk`(stdio transport,McpServer)。
- Produces: 可发布 npm 包 `@mapflow/mcp`,bin `@mapflow/mcp`。Task 8 发布 + 端到端冒烟依赖本包。

**架构(spec §4 三件套,零业务逻辑)**:`index.ts` 用 SDK 建 stdio McpServer;启动时先 `ensureToken()`(无 token/吊销 → 弹浏览器 device flow),再向服务端 `tools/list` 拉真实工具清单并逐个注册(描述/inputSchema 与服务器同源,**relay 不复制任何 schema**);每个工具调用 = 把 `name`/`arguments` 原样 POST 到 `${MAPFLOW_SERVER_URL}/mcp`,透传结果。吊销(`401 + data.code="auth.token_revoked"`)→ 删本机 token 文件 → 重新 device flow 一次,重发该请求。

- [ ] **Step 1: 包脚手架**

`package.json`(name/版本发布时确认;先本地版):

```json
{
  "name": "@mapflow/mcp",
  "version": "0.1.0",
  "description": "MapFlow 外部 Agent 接入:一行命令让 Claude Code/Codex 等读写你的学习树(需先授权一次)。",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "@mapflow/mcp": "dist/index.js" },
  "files": ["dist", "README.md", "BLOCKS.md"],
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run --config vitest.config.ts",
    "prepublishOnly": "npm run build && npm test"
  },
  "dependencies": { "@modelcontextprotocol/sdk": "^1.0.0" },
  "devDependencies": { "@types/node": "^20.0.0", "typescript": "^5.5.0", "vitest": "^2.1.9" }
}
```

`tsconfig.json`:`module: "NodeNext"`、`moduleResolution: "NodeNext"`、`target: "ES2022"`、`outDir: "dist"`、`rootDir: "src"`、`strict: true`、`declaration: true`、`skipLibCheck: true`。`vitest.config.ts`:`defineConfig({ test: { environment: "node" } })`(独立配置,避开 root 的 jsdom + setup)。`npm install` 后**手动执行验证**:`npm run build` 出 `dist/index.js`,文件头保留 `#!/usr/bin/env node`(index.ts 第一行写 shebang,tsc 会保留)。TS SDK 版本若 API 名称与下方示例不符,以 `node_modules/@modelcontextprotocol/sdk` 里的 `.d.ts` 为准微调(公开 API:`McpServer`、`server.tool`、`StdioServerTransport`、`server.connect`)。

- [ ] **Step 2: Write the failing tests(先红)**

`test/device-flow.test.ts`(依赖注入设计:核心函数收一个 `deps` 对象,测试注入假 fetch/假 opener/临时 token 文件):

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDeviceFlow } from '../src/device-flow.js';
import { readTokenFile } from '../src/token-file.js';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('device flow', () => {
  let tokenFile: string;
  const baseUrl = 'https://test.example';

  beforeEach(() => {
    tokenFile = join(mkdtempSync(join(tmpdir(), 'mapflow-test-')), 'token');
  });
  afterEach(() => vi.restoreAllMocks());

  it('runs the full pending → approved sequence and saves the token', async () => {
    const requestCode = randomUUID();
    const secret = 'e'.repeat(64);
    const token = 'a'.repeat(64);
    let polled = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/mcp/auth/requests') && init?.method === 'POST') {
        return new Response(JSON.stringify({
          requestCode, secret,
          verificationPath: `/api/mcp/auth/approve?code=${requestCode}`,
          expiresInSeconds: 600,
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      polled += 1;
      const body = polled === 1
        ? { status: 'pending' }
        : { status: 'approved', token, label: 'test' };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const opened = vi.fn();

    await runDeviceFlow({ baseUrl, label: 'test', tokenFile, fetchImpl: fetchMock as never, openImpl: opened, pollIntervalMs: 1 });

    expect(opened).toHaveBeenCalledWith(
      expect.stringContaining(`/api/mcp/auth/approve?code=${requestCode}`),
    );
    expect(await readTokenFile(tokenFile)).toBe(token);
    const pollUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(pollUrls.some((url) => url.endsWith(`/api/mcp/auth/requests/${requestCode}`))).toBe(true);
  });

  it('fails fast when the user denies (status expired)', async () => {
    const requestCode = randomUUID();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return new Response(JSON.stringify({ requestCode, secret: 'e'.repeat(64), verificationPath: 'x', expiresInSeconds: 600 }), { status: 200 });
      return new Response(JSON.stringify({ status: 'expired' }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    await expect(runDeviceFlow({ baseUrl, label: 'test', tokenFile, fetchImpl: fetchMock as never, openImpl: vi.fn(), pollIntervalMs: 1 }))
      .rejects.toThrow(/过期|expired|超时/i);
    expect(await readTokenFile(tokenFile)).toBeNull();
  });
});
```

`test/http.test.ts`(转发层:URL/header/body 透传 + 错误透出):

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapflowRpcError, isRevokedResponse, rpcCall } from '../src/http.js';

describe('rpc forwarding', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts to /mcp with bearer header and passes through the result', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      jsonrpc: '2.0', id: 1,
      result: { tools: [{ name: 'mapflow.whoami' }] },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const result = await rpcCall({ baseUrl: 'https://x.test', token: 't'.repeat(64), fetchImpl: fetchMock as never, method: 'tools/list', params: {} });
    expect(result).toEqual({ tools: [{ name: 'mapflow.whoami' }] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://x.test/mcp');
    expect(init.headers).toMatchObject({ authorization: 'Bearer ' + 't'.repeat(64), 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body)).method).toBe('tools/list');
  });

  it('surfaces jsonrpc errors with operationCode and a revoked token clears cache via 401', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      jsonrpc: '2.0', id: 1,
      error: { code: -32000, message: '树已被修改,请重读最新版后重试。', data: { code: 'mutation.revision_conflict' } },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(rpcCall({ baseUrl: 'https://x.test', token: 't'.repeat(64), fetchImpl: fetchMock as never, method: 'tools/call', params: {} }))
      .rejects.toMatchObject({ operationCode: 'mutation.revision_conflict' });
  });

  it('classifies 401 responses: token_revoked clears the cached token, invalid_token does not', () => {
    expect(isRevokedResponse(401, 'auth.token_revoked')).toBe(true);
    expect(isRevokedResponse(401, 'auth.invalid_token')).toBe(false);
    expect(isRevokedResponse(500, 'auth.token_revoked')).toBe(false);
  });
});
```

(「吊销 → 清 token 重授权」的端到端路径不做自动化:服务器无 session 注入基建(Task 5 边界),由 Task 8 生产冒烟覆盖;http 层语义经上面 `isRevokedResponse` 纯函数断言锁定。)

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd D:/MapFlow-publish/mcp-relay && npm test`
Expected: 编译/引用失败——src 文件不存在。红。

- [ ] **Step 4: Implement**

`src/config.ts`:

```ts
export const DEFAULT_SERVER_URL = 'https://xxian.fun';
export function serverUrl(): string {
  return (process.env.MAPFLOW_SERVER_URL ?? DEFAULT_SERVER_URL).replace(/\/+$/, '');
}
export function tokenLabel(): string {
  return process.env.MAPFLOW_TOKEN_LABEL ?? 'npx @mapflow/mcp';
}
```

`src/token-file.ts`(读写本机 token,0600;token 必须是 64 hex):

```ts
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export function tokenFilePath(): string {
  return process.env.MAPFLOW_TOKEN_FILE ?? join(homedir(), '.mapflow', 'token');
}
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export async function readTokenFile(path = tokenFilePath()): Promise<string | null> {
  try {
    const raw = (await readFile(path, 'utf8')).trim();
    return TOKEN_PATTERN.test(raw) ? raw : null;
  } catch {
    return null; // 不存在或不可读 → 视为未授权
  }
}
export async function writeTokenFile(path: string, token: string): Promise<void> {
  if (!TOKEN_PATTERN.test(token)) throw new Error('refusing to store a malformed token');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, token + '\n', { mode: 0o600 });
  try { await chmod(path, 0o600); } catch { /* Windows 无 posix 权限位,忽略 */ }
}
export async function clearTokenFile(path = tokenFilePath()): Promise<void> {
  try { await rm(path); } catch { /* 已不存在则忽略 */ }
}
```

`src/http.ts`(服务端 `/mcp` 转发;对 401 + `auth.*` 返回"需要重授权"的哨兵错误):

```ts
export class MapflowRpcError extends Error {
  readonly operationCode: string;
  constructor(message: string, operationCode: string) {
    super(message);
    this.operationCode = operationCode;
  }
}
/** 401 且 data.code 是 auth.* → 抛出需要重授权的专用信号 */
export function isRevokedResponse(status: number, dataCode: unknown): boolean {
  return status === 401 && dataCode === 'auth.token_revoked';
}
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface RpcDeps { baseUrl: string; token: string; method: string; params: unknown; fetchImpl: FetchLike; }
export async function rpcCall(deps: RpcDeps): Promise<unknown> {
  const response = await deps.fetchImpl(`${deps.baseUrl}/mcp`, {
    method: 'POST',
    headers: { authorization: `Bearer ${deps.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: deps.method, params: deps.params }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; data?: { code?: string } }; result?: unknown;
  };
  if (response.status === 401) {
    const code = body.error?.data?.code ?? 'auth.invalid_token';
    const message = body.error?.message ?? '令牌无效,请重新执行 npx @mapflow/mcp 授权。';
    const error = new MapflowRpcError(message, code);
    (error as unknown as { status: number }).status = response.status;
    throw error;
  }
  if (body.error) {
    throw new MapflowRpcError(body.error.message ?? '服务返回错误。', body.error.data?.code ?? 'unknown');
  }
  return body.result;
}
```

`src/device-flow.ts`(device flow 客户端;浏览器打不开时打印 URL 兜底):

```ts
import { clearTokenFile, readTokenFile, writeTokenFile } from './token-file.js';
import { isRevokedResponse } from './http.js';
import { randomUUID } from 'node:crypto';

export interface DeviceFlowDeps {
  baseUrl: string; label: string; tokenFile: string; fetchImpl: FetchLike;
  openImpl: (url: string) => void; pollIntervalMs?: number; timeoutMs?: number;
}
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 与服务端 TTL(600s)一致

export async function runDeviceFlow(deps: DeviceFlowDeps): Promise<string> {
  const response = await deps.fetchImpl(`${deps.baseUrl}/api/mcp/auth/requests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label: deps.label }),
  });
  if (!response.ok) throw new Error(`授权请求创建失败(HTTP ${response.status}),请稍后重试。`);
  const { requestCode, secret, verificationPath } = await response.json();
  const verificationUrl = `${deps.baseUrl}${verificationPath}`;
  deps.openImpl(verificationUrl);
  const poll = `${deps.baseUrl}/api/mcp/auth/requests/${requestCode}`;
  const deadline = Date.now() + (deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const interval = deps.pollIntervalMs ?? 2000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval));
    const pollResponse = await deps.fetchImpl(poll, {
      headers: { authorization: `Bearer ${secret}` },
    });
    if (!pollResponse.ok) continue; // 服务端抖动:继续等
    const body = await pollResponse.json();
    if (body.status === 'approved' && typeof body.token === 'string') {
      await writeTokenFile(deps.tokenFile, body.token);
      return body.token;
    }
    if (body.status === 'expired') {
      throw new Error('授权已过期或已被拒绝,请重新运行 npx @mapflow/mcp 再试。');
    }
  }
  throw new Error('等待授权超时(10 分钟),请重新运行。');
}

export async function openBrowser(url: string): Promise<void> {
  // 用户本机;打印 URL 兜底(无图形环境/命令缺失时用户可手动打开)
  const { spawn } = await import('node:child_process');
  const platform = process.platform;
  const command = platform === 'darwin' ? ['open', url]
    : platform === 'win32' ? ['cmd', '/c', 'start', '', url]
    : ['xdg-open', url];
  try {
    spawn(command[0], command.slice(1), { stdio: 'ignore', detached: true }).unref();
  } catch {
    console.log(`请在浏览器打开授权页:${url}`);
  }
}
```

`src/index.ts`(bin 入口;转发器只做"拉清单 + 逐工具透传",不复制 schema):

```ts
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readTokenFile } from './token-file.js';
import { runDeviceFlow, openBrowser } from './device-flow.js';
import { rpcCall, isRevokedResponse, MapflowRpcError } from './http.js';
import { serverUrl, tokenLabel } from './config.js';

async function obtainToken(): Promise<string> {
  const tokenFile = (await import('./token-file.js')).tokenFilePath();
  const cached = await readTokenFile(tokenFile);
  if (cached) return cached;
  return runDeviceFlow({ baseUrl: serverUrl(), label: tokenLabel(), tokenFile, fetchImpl: fetch, openImpl: (url) => void openBrowser(url) });
}

async function main(): Promise<void> {
  const baseUrl = serverUrl();
  const tokenFile = (await import('./token-file.js')).tokenFilePath();
  let token = await obtainToken();
  const server = new McpServer({ name: 'mapflow', version: '0.1.0' });

  // 与服务器同源的工具清单:先拉一次,再逐工具注册
  const listed = (await rpcCall({ baseUrl, token, method: 'tools/list', params: {}, fetchImpl: fetch })) as { tools: Array<{ name: string; description?: string; inputSchema: unknown }> };
  for (const tool of listed.tools) {
    server.tool(tool.name, tool.description ?? '', tool.inputSchema as never, async (args) => {
      try {
        const result = await rpcCall({ baseUrl, token, method: 'tools/call', params: { name: tool.name, arguments: args }, fetchImpl: fetch });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        if (error instanceof MapflowRpcError && isRevokedResponse((error as unknown as { status?: number }).status ?? 0, error.operationCode)) {
          const { clearTokenFile } = await import('./token-file.js');
          await clearTokenFile(tokenFile);
          token = await obtainToken();
          const retried = await rpcCall({ baseUrl, token, method: 'tools/call', params: { name: tool.name, arguments: args }, fetchImpl: fetch });
          return { content: [{ type: 'text', text: JSON.stringify(retried) }] };
        }
        return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] };
      }
    });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
```

(Step 2 的测试代码即最终状态:device-flow 只保留两个用例,`isRevokedResponse` 断言已内联在 http.test.ts 第三用例;下方实现里的 401 分支与 `clearTokenFile` 由该用例锁定。)

**root `vite.config.ts` 修改**:`test` 节加 `include: ['src/**/*.{test,spec}.{ts,tsx}']`(root `npm test` 不再扫 mcp-relay;relay 用自带 vitest.config.ts)。

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd D:/MapFlow-publish/mcp-relay && npm test`
Run(回归 root):`cd D:/MapFlow-publish && npm test && npm run typecheck`
Expected: relay 测试 PASS;root 测试集不含 relay 文件且全绿。

- [ ] **Step 6: build 验证 + commit**

Run: `cd D:/MapFlow-publish/mcp-relay && npm run build`(确认 dist/index.js 头部有 shebang)
Commit(前端仓库):
```bash
git add mcp-relay/ vite.config.ts package-lock.json
git commit -m "feat: @mapflow/mcp npx relay 包(stdio 转发 + device flow + 本机 token)"
```

---

### Task 8: 规范文档 + 发布 + 部署冒烟(用户检查点收尾)

**Files:**
- Create: `D:\MapFlow-publish\mcp-relay\BLOCKS.md`(spec §2.1 规范文本,MVP 随包分发)
- Create: `D:\MapFlow-publish\mcp-relay\README.md`(一行命令 + 环境变量)
- 无需改 package.json:Task 7 的 `files` 已含 `["dist", "README.md", "BLOCKS.md"]`,`prepublishOnly` 已含 build+test

**Interfaces:**
- Consumes: Task 6 工具契约(`mapflow.get_progress` / `mapflow.get_tree` / `mapflow.apply_tree_mutation`,camelCase 参数);Task 2/3 错误码(`mutation.revision_conflict`、`block.*`、`auth.token_revoked`);Task 4/5 认证语义(token 明文只出现一次、吊销走运维 SQL)
- Produces: npm 上可 `npx @mapflow/mcp` 直用的 `@mapflow/mcp` 包;生产可验证的 `/mcp` 入口;一次「授权 → 读 → 写 → SQL 审计追溯」的完整冒烟记录

**说明**:Step 1-3 是纯文档(免 TDD,全局规范允许),以「与 spec §2.1 四步流程逐条对照」作为完成标准;Step 4-6 涉及 npm 发布与生产部署,**均需用户在场执行/确认**,执行到这些步骤时停下把清单交给用户。

- [ ] **Step 1: 写 `mcp-relay/BLOCKS.md`(块组织规范,完整内容)**

```markdown
# MapFlow 块组织规范(供 Agent 参考)

> 本文说明如何把一棵 MapFlow 树按你自己的语义重组。
> 底层原语就是 MCP 工具本身,任何重组都可用文中的四步完成;
> 除工具外不需要任何「重组专用」能力。

## 背景与两条铁律

MapFlow 的树由 AI 生成,默认按「难度/推荐顺序」排布,适合顺着学。
块(block)是树级可选分组:把节点按你的学习语境归堆(如「先补安全再看质量」),
默认难度视图原样不动,树的主人(用户)随时可回到默认排布。

1. **一个节点只能属于一个块。** 需要同一知识点出现在两种语境时,不要复制节点——
   树在画布上每个知识点只能画一次。语境里缺的「转变后的形态」用新节点表达(第 4 步)。
2. **树是持续演化的。** 重组不是一次性导出,而是在同一棵树上的增量修改。
   每轮「读全量 → 设计 → 提交」后,树更贴近用户的真实学习方式;可以反复做。

## 四步流程

### 第 1 步:找到目标树(只读)

调用 `mapflow.get_progress`,从返回的树列表里挑出目标树,
记下它的 `libraryEntryId` 与当前进度(别选已完成 100% 的树做重组实验)。

### 第 2 步:读全量,建立心智模型(只读)

调用 `mapflow.get_tree`,参数 `{ "libraryEntryId": "…" }`,
拿到 `nodes`(标题/说明/难度/深度/完成度)、`edges`(依赖边)、`blocks`、`revision`。
先在脑子里回答三个问题再动手:

- 这棵树在讲什么?主线大概分几段?
- 用户当前学到哪?哪些已完成节点提示了用户的实际兴趣?
- 按你的目标语境,哪些节点该归到同一块?缺什么形态的节点?

### 第 3 步:建块并归位(写)

一条命令 = 一次 `mapflow.apply_tree_mutation` 调用;`revision` 填「第 2 步读到、
或上一条命令响应返回」的最新值,`idempotencyKey` 由你生成一次性唯一号
(同号重发不重复生效)。整体参数形如:

    {
      "libraryEntryId": "<目标树 id>",
      "mutation": {
        "operation": "add_block",
        "revision": 12,
        "idempotencyKey": "<本次命令唯一号>",
        "patch": { "name": "安全加固", "color": "#c0392b" }
      }
    }

`patch` 键与网站编辑器同款 camelCase;命令要引用目标实体时,id 放进命令顶层
`targetId`(与既有 add_node/delete_node 等一致的传法)。按语境切块、把节点归入:

1. `add_block`:`patch` 含 `name`、可选 `color`,无 `targetId`——块 id 由服务端生成,
   在响应里返回,记下来供后续命令用;
2. `set_node_block`:`targetId` = 节点 id,`patch` 含 `blockId`;想移出块则给
   `"blockId": null`;
3. 重复直至块的成员齐整;块不需要的节点保持原样(无 100% 覆盖要求)。

每次提交响应返回**新 revision**,下一次提交必须带上它。

### 第 4 步:补缺失的形态(写,可选)

语境需要但树上没有的知识点,用「新节点 + 依赖边」表达。例:安全语境要求
「先学守卫、再学网关」,而树上只有守卫:

1. `add_node`:`targetId` = 你为新节点起的 id(与树内既有节点 id 同风格),
   `patch` 含必填 `title`/`category` 与可选 `description`/`difficulty`/
   `estimatedMinutes`/`recommendedDepth` 等(标题与说明遵循树的既有风格);
2. `add_edge`:`targetId` = 新边 id,`patch` 含 `sourceNodeId`(= 守卫)、
   `targetNodeId`(= 网关)、`edgeType`(= 与树内既有先学边一致的取值,
   如 `prerequisite`),`label` 可选;
3. `set_node_block` 把网关归入安全块。

不要在已有节点上改标题去「冒充」新语义(那会污染默认视图下的原意)。

## 命名与粒度建议

- 块名:场景/阶段名,6-20 字,信息量优先,如「安全加固」「上线前检查」「性能优化」;
  避免「重要」「日常」「其他」这类无信息量词;多个块不要互相包含(「安全」与「安全-网络」)。
- 数量:每棵树 3-8 块;每块 3-15 个节点;明显偏多的块说明该继续切分。
- 块内自洽:先学完一块内依赖、再进入依赖它的下一块,顺序感最好。
- 颜色:`color` 用十六进制(如 `#c0392b`),一块一色,别在标题里加 emoji 或序号前缀。
- 完成度:重组不动任何节点的完成状态;把用户已完成的节点归入块时,
  块内起点自然就是下一个待学节点。

## Revision 冲突与错误处理

- `mutation.revision_conflict` → 树已被别人改过。丢弃本地草稿,
  重新 `mapflow.get_tree` 取最新 revision,把未提交的命令在新版本上重放。
- `block.unknown_block` / `block.duplicate_name` / `block.node_not_in_tree` → 参数引用错了,
  重新读树核对 id 与块名。
- `mutation.not_private_tree` → 只允许改自己的私有树,核对 `libraryEntryId`。
- HTTP 401 + `auth.token_revoked` → 本机 token 已被吊销,删 token 文件后重新授权
  (见 README「重新授权」);401 + `auth.invalid_token` → token 文件损坏,同样重新授权。

## 收尾:向用户汇报

重组完成后,用两三句话向用户说明:建了哪几个块、各归入多少节点、
新建了哪些节点与依赖边、树现在的新 `revision`。
不要长篇转储整棵树;用户要的是「发生了什么、为什么、还能怎么调」。
```

- [ ] **Step 2: 写 `mcp-relay/README.md`(完整内容)**

```markdown
# @mapflow/mcp

一行命令,让你的 Agent(Claude Code / Codex / Cursor)连接 MapFlow:
读取学习进度、读写你自己的私有技能树,还能按你的语义把树重组成「块」。
所有写入都有审计记录。需要已注册的 xxian.fun 账号。

## 一行命令(首次约 3 秒授权)

```bash
npx @mapflow/mcp
```

首次运行自动打开浏览器 → 在 xxian.fun 授权页点「允许」(复用你的登录态)→
token 存入本机 `~/.mapflow/token`(权限 600)。之后每次运行静默直连,不再询问。

## 接入 Claude Code

```bash
claude mcp add mapflow -- npx @mapflow/mcp
```

之后在 Claude Code 里直接说「读一下我的学习进度」「把安全相关的节点整理成块」即可。

## 工具

| 工具 | 作用 |
|---|---|
| `mapflow.get_progress` | 列出所有树 + 完成进度(含证据) |
| `mapflow.get_tree` | 读一棵树全量:节点/边/块/完成度 |
| `mapflow.apply_tree_mutation` | 提交一条编辑命令(add_node / add_edge / add_block / set_node_block 等) |
| `mapflow.whoami` | 查看当前 token 身份与授权状态 |

按语义把树重组成块的操作方法见 [BLOCKS.md](BLOCKS.md)。

## 环境变量(全部可选)

- `MAPFLOW_SERVER_URL` — 服务器地址,默认 `https://xxian.fun`
- `MAPFLOW_TOKEN_FILE` — token 文件路径,默认 `~/.mapflow/token`
- `MAPFLOW_TOKEN_LABEL` — 授权页显示的用途名,默认 `claude-code-<主机名>`

## 重新授权 / 吊销

token 被吊销(HTTP 401 `auth.token_revoked`)或想换一个用途名时:

```bash
rm ~/.mapflow/token
npx @mapflow/mcp
```

服务器端吊销入口:运维 SQL 置 `revoked_at`(管理界面后续提供)。

## 隐私与安全

- token 明文只在授权那一刻出现一次:本机 `~/.mapflow/token`(权限 600)与签发响应;
  服务器只存 SHA-256 摘要,泄露数据库也无法反推 token。
- 所有写操作以「哪棵树、什么命令、哪个 token」落审计,可按账户 SQL 追溯。
- relay 不收集任何遥测;除你授权的树外不访问任何数据。
```

- [ ] **Step 3: 文档自审 + commit**

自审清单(对照 spec §2.1):四步流程齐全(get_tree → 建块归位 → 补形态 → 汇报)?
双铁律(单归属、树演化)在文?错误码与 Task 2/3/6 定义一致?README 与 Task 4/5 语义
(token 出现一次、服务器只存 digest、吊销走 SQL)一致?
Run: `cd D:/MapFlow-publish/mcp-relay && npm run build`(README/BLOCKS 进包前确认 files 命中)
Commit(前端仓库):
```bash
git add mcp-relay/README.md mcp-relay/BLOCKS.md
git commit -m "docs: @mapflow/mcp 包 README 与块组织规范(BLOCKS.md)"
```

- [ ] **Step 4: 服务器部署(用户检查点)**

本步要动生产,**停下把清单交给用户执行**(agent 不做 SSH/生产操作)。部署流程与
既有 release 完全一致(spec §8:零新增部署单元;CI → GHCR → switch.sh → health 回滚,
0015 迁移随部署自动执行;Caddyfile 无需改动——catch-all 已覆盖 `/mcp`,记录为与 spec §8 的偏差):

1. `cd D:/mapflow-server && git push origin main` → CI → GHCR(仓库既有流程);
2. 生产机执行 switch.sh 切到新镜像(参照 `mapflow-server` 部署文档/HANDOVER 的现成命令);
3. 冒烟断言(生产机或本机 curl):
   - `curl -si -X POST https://xxian.fun/mcp -H 'content-type: application/json' -d '{}'`
     期望:`HTTP/1.1 401`,JSON body 含 `auth.invalid_token` 与中文消息;
   - `curl -s https://xxian.fun/health/ready` → 200;
   - 迁移落库(生产 psql):`\dt agent_audit_events`、`\dt api_tokens`、`\dt skill_tree_blocks`,
     `\d skill_nodes` 见 `block_id` 列。

- [ ] **Step 5: npm 发布(用户检查点)**

spec 开放问题 1(包名与账号)在此确认。需要用户:
1. `npm login`(交互式;建议用户在本会话输入 `! npm login` 执行,账号须可发布到
   `@mapflow` scope——若未开通 scope,先建组织或改用非 scope 包名,与用户确认后再定);
2. 发布:`cd D:/MapFlow-publish/mcp-relay && npm publish --access public`
   (`prepublishOnly` 自动跑 build + test);
3. 验证:`npm view @mapflow/mcp version` 与 `npm view @mapflow/mcp files` 应含
   dist/README.md/BLOCKS.md。

- [ ] **Step 6: 生产全流程冒烟(用户 + agent 协作)并收尾**

1. 用户本机:`claude mcp add mapflow -- npx @mapflow/mcp`(或直接 `npx @mapflow/mcp`);
2. 首次运行 → 浏览器授权页 → 点允许(授权页断言:显示 label、点允许后跳转成功);
3. 在 Claude Code 里实测一轮完整链路(对着用户自己一棵树,事后零残留):
   - `mapflow.get_progress` → 选一棵树记 `libraryEntryId`;
   - `mapflow.get_tree` → 断言 nodes/edges/blocks 形状、记 `revision`;
   - `mapflow.apply_tree_mutation`:依次提交 `add_block`(块名「冒烟测试」,revision
     用最新值)→ `set_node_block`(把任一节点归入该块)→ `delete_block`(删块把成员
     节点 `block_id` 置空,树回到原状);
   - 断言:每次提交返回幂等回执与新 `revision`;故意提交一次旧 `revision` →
     `mutation.revision_conflict` 中文消息;
   - `mapflow.whoami` → 显示账户与授权状态;
4. 审计追溯(生产 psql,用户执行):按 `mapflow.whoami` 的账户 id:

```sql
SELECT actor_type, operation, summary, request_id, created_at
FROM agent_audit_events
WHERE account_id = '<账户 uuid>'
ORDER BY created_at DESC
LIMIT 10;
```

期望:冒烟的三条块命令落账,summary 可读、无 token/秘密字段;再执行一次
`SELECT label, revoked_at, last_used_at FROM api_tokens;` 确认无明文 token;
5. 全部通过 → 勾选本 plan 所有 checkbox,任务收尾;
   任一断言失败 → 回到对应 Task 修复,再走 Step 4-6。
