# Node Notes and Public Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add versioned Markdown notes to private tree nodes and let users publish governed, attributed snapshots to the public catalog through the website and MCP.

**Architecture:** Keep note and publication state in PostgreSQL beside the existing tree library, but expose each through narrow application services and HTTP modules. Publication execution is a transactionally locked state machine with signed prepare tokens and durable idempotency receipts; public reads fail closed through one shared visibility query. The React app lazily loads note bodies and uses explicit confirmation flows for destructive note/publication actions.

**Tech Stack:** Rust 2024, Axum 0.8, SQLx/PostgreSQL, HMAC-SHA256, React 18, TypeScript, TanStack Query, react-markdown, remark-gfm, Vitest, MCP TypeScript SDK.

**Spec:** `docs/specs/2026-09-23-node-notes-and-public-sharing-design.md`

## Global Constraints

- Notes contain 1–30,000 Unicode characters when present; deletion stores a `NULL` tombstone and increments the version.
- Public snapshots contain at most 500 nodes, 2,000 edges, and 64 blocks.
- A user may have at most 20 active publications and may successfully publish/update at most 5 times per rolling hour.
- Public pages contain at most 50 items and use an opaque `(catalog_published_at, tree_id)` cursor.
- Publication confirmation tokens expire after 10 minutes and bind account, source, revision, action, expected public tree, disclosure digest, and publisher name.
- User publication visibility requires active publication, public/ready tree, and active publisher account.
- Notes, progress, chat, generation sessions, account IDs, player IDs, and contact data never enter a public snapshot.
- Existing dirty workspace files are preserved; stage and commit only files changed by the current task.

---

### Task 1: Database contracts for note tombstones and publication state

**Files:**
- Create: `../mapflow-server/migrations/0020_node_notes_and_publications.sql`
- Modify: `../mapflow-server/tests/postgres_tree_library_schema.rs`
- Modify: `../mapflow-server/tests/postgres_mcp_schema.rs`

**Interfaces:**
- Produces tables `account_node_notes`, `user_tree_publications`, and `tree_publication_action_receipts`.
- Produces partial unique indexes for active source publications and consumed confirmation nonces.

- [ ] **Step 1: Write failing migration contract tests**

Add assertions that the migration defines nullable `markdown_content`, positive `version`, the four publication states, active-source uniqueness, request digests, stored response JSON, confirmation nonce uniqueness, and non-restricting audit UUIDs.

```rust
#[test]
fn node_note_deletion_keeps_a_versioned_tombstone() {
    let migration = migration_sql("0020_node_notes_and_publications.sql");
    assert!(migration.contains("markdown_content TEXT"));
    assert!(!migration.contains("markdown_content TEXT NOT NULL"));
    assert!(migration.contains("CHECK (version > 0)"));
}
```

- [ ] **Step 2: Run the schema tests and verify RED**

Run: `cargo test --test postgres_tree_library_schema --test postgres_mcp_schema`

Expected: failure because migration 0020 and its tables do not exist.

- [ ] **Step 3: Add migration 0020**

Create all tables, constraints, indexes, `ON DELETE` behavior, `active/superseded/withdrawn/removed` checks, and receipt fields specified in the design. Store source/result UUIDs in receipts as audit values without restrictive foreign keys.

- [ ] **Step 4: Run schema tests and verify GREEN**

Run: `cargo test --test postgres_tree_library_schema --test postgres_mcp_schema`

- [ ] **Step 5: Commit the schema slice**

Commit message: `feat: add note and publication database contracts`

### Task 2: Versioned node-note backend

**Files:**
- Create: `../mapflow-server/src/adapters/postgres/tree_note_store.rs`
- Create: `../mapflow-server/src/application/tree_note_service.rs`
- Create: `../mapflow-server/src/http/tree_notes.rs`
- Modify: `../mapflow-server/src/adapters/postgres/mod.rs`
- Modify: `../mapflow-server/src/application/mod.rs`
- Modify: `../mapflow-server/src/http/mod.rs`
- Modify: `../mapflow-server/src/app.rs`
- Modify: `../mapflow-server/src/lib.rs`
- Modify: `../mapflow-server/src/tree_library.rs`
- Create: `../mapflow-server/tests/postgres_tree_note_store.rs`
- Modify: `../mapflow-server/tests/tree_library_http.rs`

**Interfaces:**
- Produces `NodeNoteView { node_id, markdown, has_note, version, updated_at }`.
- Produces service methods `get_note`, `set_note`, and `delete_note` scoped by `(account_id, library_entry_id, node_id)`.
- Produces `GET/PUT/DELETE /api/me/tree-library/{entry}/nodes/{node}/note`.

- [ ] **Step 1: Write failing store tests**

Cover never-written v0, create v1, update v2, blank rejection, tombstone v3, recreate v4, stale v1/v2 conflicts, owner isolation, and node/library cascade behavior using the existing PostgreSQL test harness.

- [ ] **Step 2: Run note store tests and verify RED**

Run: `cargo test --test postgres_tree_note_store`

Expected: compile failure for missing note store/types.

- [ ] **Step 3: Implement store compare-and-swap operations**

Use `INSERT ... SELECT` for `expected_version = 0`, and `UPDATE ... SET markdown_content = $value, version = version + 1 ... WHERE version = $expected` for existing rows. Resolve zero affected rows into `NotFound` versus `VersionConflict` without exposing another account.

- [ ] **Step 4: Run note store tests and verify GREEN**

Run: `cargo test --test postgres_tree_note_store`

- [ ] **Step 5: Write failing HTTP tests**

Cover authentication, CSRF, snake_case response, empty-content error, `409 note_version_conflict`, explicit delete, tombstone response, and `noted_node_ids` excluding tombstones.

- [ ] **Step 6: Run HTTP tests and verify RED**

Run: `cargo test --test tree_library_http note`

- [ ] **Step 7: Implement service, handlers, routes, and personal-tree projection**

Map store results to stable codes `tree_note.not_found`, `tree_note.content_empty`, `tree_note.content_too_long`, and `tree_note.version_conflict`. Add `noted_node_ids` without embedding note bodies.

- [ ] **Step 8: Run note backend tests and verify GREEN**

Run: `cargo test --test postgres_tree_note_store --test tree_library_http note`

- [ ] **Step 9: Commit the note backend slice**

Commit message: `feat: add versioned node notes`

### Task 3: Publication prepare tokens, snapshot state machine, and receipts

**Files:**
- Create: `../mapflow-server/src/tree_publication.rs`
- Create: `../mapflow-server/src/adapters/postgres/tree_publication_store.rs`
- Create: `../mapflow-server/src/application/tree_publication_service.rs`
- Create: `../mapflow-server/src/http/tree_publications.rs`
- Modify: `../mapflow-server/src/adapters/postgres/mod.rs`
- Modify: `../mapflow-server/src/application/mod.rs`
- Modify: `../mapflow-server/src/http/mod.rs`
- Modify: `../mapflow-server/src/app.rs`
- Modify: `../mapflow-server/src/config.rs`
- Modify: `../mapflow-server/src/lib.rs`
- Create: `../mapflow-server/tests/postgres_tree_publication_store.rs`
- Create: `../mapflow-server/tests/tree_publication_http.rs`

**Interfaces:**
- Produces `PublicationPrepareView`, `PublicationStatusView`, `PublicationActionResult`, and opaque signed confirmation tokens.
- Produces prepare/publish/unpublish-prepare/unpublish HTTP routes from the spec.
- Consumes the existing private graph and `forked_from_tree_id` provenance.

- [ ] **Step 1: Write failing token tests**

Assert HMAC verification, 10-minute expiry, account/action/revision/public-tree binding, signature rejection, and distinct random nonces.

- [ ] **Step 2: Run token tests and verify RED**

Run: `cargo test tree_publication::tests`

- [ ] **Step 3: Implement the signed-token codec**

Use the configured server secret through `Hmac<Sha256>`, URL-safe base64, constant-time verification, and a versioned JSON payload.

- [ ] **Step 4: Write failing publication store tests**

Cover first publish, derived direct/root attribution, snapshot exclusion of personal tables, update superseding P1 with P2, stale source revision, stale unpublish target, same-key replay, same-key/different-digest conflict, consumed nonce, concurrent publication, rolling-hour limit, active-count limit, and source deletion withdrawal.

- [ ] **Step 5: Run publication store tests and verify RED**

Run: `cargo test --test postgres_tree_publication_store`

- [ ] **Step 6: Implement the transactionally locked store**

Lock the owned source tree and active publication with `FOR UPDATE`, validate the graph limits, reserve receipt key and confirmation nonce, copy only graph tables, transition old/new states atomically, write audit events, and persist the exact response JSON.

- [ ] **Step 7: Run publication store tests and verify GREEN**

Run: `cargo test --test postgres_tree_publication_store`

- [ ] **Step 8: Write failing publication HTTP tests**

Cover login/CSRF, prepare disclosure, invalid/expired token, idempotency header, stale revision, stale public tree, stable error envelopes, and deletion confirmation metadata.

- [ ] **Step 9: Implement service, handlers, routes, and delete-tree integration**

The delete-tree transaction must withdraw and archive the currently locked public snapshot before removing/archiving the source. Return publication status in personal library responses.

- [ ] **Step 10: Run publication HTTP tests and verify GREEN**

Run: `cargo test --test tree_publication_http --test tree_library_http`

- [ ] **Step 11: Commit the publication state-machine slice**

Commit message: `feat: publish governed tree snapshots`

### Task 4: Fail-closed public catalog and administrator removal

**Files:**
- Modify: `../mapflow-server/src/adapters/postgres/tree_library_store.rs`
- Modify: `../mapflow-server/src/application/tree_library_service.rs`
- Modify: `../mapflow-server/src/http/tree_library.rs`
- Modify: `../mapflow-server/src/adapters/postgres/admin_store.rs`
- Modify: `../mapflow-server/src/application/admin.rs`
- Modify: `../mapflow-server/src/http/admin.rs`
- Modify: `../mapflow-server/src/app.rs`
- Modify: `../mapflow-server/tests/postgres_tree_library_store.rs`
- Modify: `../mapflow-server/tests/tree_library_http.rs`
- Modify: `../mapflow-server/tests/postgres_admin_store.rs`
- Modify: `../mapflow-server/tests/admin_http.rs`

**Interfaces:**
- Changes public catalog to `public_catalog(cursor, limit) -> { trees, next_cursor }` with publisher/provenance metadata.
- Produces admin publication list and idempotent remove operation.
- Extends account suspension to remove active publications in the same transaction.

- [ ] **Step 1: Write failing catalog tests**

Cover mixed official/user ordering, 50-item cursor boundaries, no duplicates across equal timestamps, hidden withdrawn/removed/drifted/suspended content, and direct-detail failure for hidden content.

- [ ] **Step 2: Run catalog tests and verify RED**

Run: `cargo test --test postgres_tree_library_store public --test tree_library_http public`

- [ ] **Step 3: Implement the shared visible-catalog query and cursor codec**

Use `(catalog_published_at, tree_id)` seek pagination and one shared SQL predicate for list/detail/join. Preserve official trees without requiring a publication row.

- [ ] **Step 4: Run catalog tests and verify GREEN**

Run the command from Step 2.

- [ ] **Step 5: Write failing admin tests**

Cover publication pagination, required 1–500 character reason, remove transition plus audit, repeat safety, and suspension removing every active publication.

- [ ] **Step 6: Run admin tests and verify RED**

Run: `cargo test --test postgres_admin_store publication --test admin_http publication`

- [ ] **Step 7: Implement admin store/service/routes**

Add `GET /api/admin/tree-publications` and `POST /api/admin/tree-publications/{id}/remove`; update account suspension transaction to archive public trees and set publication state `removed`.

- [ ] **Step 8: Run admin and catalog tests and verify GREEN**

Run: `cargo test --test postgres_admin_store --test admin_http --test postgres_tree_library_store --test tree_library_http`

- [ ] **Step 9: Commit catalog and moderation slice**

Commit message: `feat: govern the public tree catalog`

### Task 5: MCP tools, annotations, version negotiation, and relay release

**Files:**
- Modify: `../mapflow-server/src/http/mcp_rpc.rs`
- Modify: `../mapflow-server/tests/mcp_rpc_http.rs`
- Modify: `mcp-relay/src/index.ts`
- Modify: `mcp-relay/src/index.test.ts`
- Modify: `mcp-relay/src/http.ts`
- Modify: `mcp-relay/src/http.test.ts`
- Modify: `mcp-relay/package.json`
- Modify: `mcp-relay/README.md`

**Interfaces:**
- Extends remote `ToolSpec` and startup `StartupToolList` with MCP annotations.
- Adds guide/note/publication MCP tools and stable version errors.
- Sends `X-MapFlow-Relay-Version` on relay requests.

- [ ] **Step 1: Write failing server MCP tests**

Assert all listed tools contain the four annotations; the guide response contains `guideVersion`, `minimumSkillVersion`, and `minimumRelayVersion`; note tools preserve tombstones; publication requires a prepare token; and missing/old relay or guide versions return `mcp.skill_upgrade_required`, `mcp.relay_upgrade_required`, or `mcp.guide_version_required`.

- [ ] **Step 2: Run server MCP tests and verify RED**

Run: `cargo test --test mcp_rpc_http`

- [ ] **Step 3: Implement MCP catalog and dispatch changes**

Add the eight tools defined in the spec, route them through the same services as HTTP, and keep annotations declarative rather than treating them as authorization.

- [ ] **Step 4: Run server MCP tests and verify GREEN**

Run: `cargo test --test mcp_rpc_http`

- [ ] **Step 5: Write failing relay tests**

Assert startup accepts/forwards `annotations`, every remote RPC includes the package version header, and unknown optional annotation fields survive unchanged.

- [ ] **Step 6: Run relay tests and verify RED**

Run: `npm test -- --run`

- [ ] **Step 7: Implement relay forwarding and bump its package version**

Forward the annotations object into `registerTool`, add the version header centrally in `rpcCall`, update command docs, and build the publishable package.

- [ ] **Step 8: Run relay tests/typecheck/build and verify GREEN**

Run: `npm test && npm run build`

- [ ] **Step 9: Commit MCP and relay slice**

Commit backend and frontend repositories separately with `feat: expose note and publication MCP tools` and `feat: forward MCP safety annotations`.

### Task 6: React note client and modal

**Files:**
- Modify: `src/features/tree-library/types.ts`
- Modify: `src/features/tree-library/treeLibraryClient.ts`
- Modify: `src/features/tree-library/treeLibraryClient.test.ts`
- Create: `src/features/node-notes/NodeNoteDialog.tsx`
- Create: `src/features/node-notes/NodeNoteDialog.test.tsx`
- Create: `src/features/node-notes/SafeMarkdown.tsx`
- Create: `src/features/node-notes/SafeMarkdown.test.tsx`
- Modify: `src/features/skill-tree/NodeDetailPanel.tsx`
- Modify: `src/features/skill-tree/NodeDetailPanel.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces `fetchNodeNote`, `saveNodeNote`, and `deleteNodeNote` clients.
- Adds `onOpenNote(nodeId)` and `notedNodeIds` to the node-detail flow.

- [ ] **Step 1: Write failing client tests**

Assert encoded paths, CSRF, expected version payloads, tombstone parsing, and conflict error preservation.

- [ ] **Step 2: Run client tests and verify RED**

Run: `npm test -- src/features/tree-library/treeLibraryClient.test.ts`

- [ ] **Step 3: Implement note types and client functions**

Parse `has_note`, `version`, nullable timestamps, and `noted_node_ids` strictly.

- [ ] **Step 4: Write failing safe-Markdown and dialog tests**

Cover headings/GFM tables, raw HTML escaping, image suppression, unsafe protocol removal, external-link attributes, loading, edit/preview, empty rejection, unsaved-close confirmation, version conflict reload, and delete confirmation.

- [ ] **Step 5: Run component tests and verify RED**

Run: `npm test -- src/features/node-notes src/features/skill-tree/NodeDetailPanel.test.tsx`

- [ ] **Step 6: Install Markdown dependencies and implement components**

Add `react-markdown` and `remark-gfm`; do not add `rehype-raw`. Override `img` to render nothing and constrain anchors to HTTP(S)/mailto.

- [ ] **Step 7: Wire the modal through App and node details**

Use TanStack Query for lazy note reads and mutations; update cached `noted_node_ids` after save/delete without reloading the full graph.

- [ ] **Step 8: Run focused tests and verify GREEN**

Run: `npm test -- src/features/tree-library/treeLibraryClient.test.ts src/features/node-notes src/features/skill-tree/NodeDetailPanel.test.tsx src/App.test.tsx`

- [ ] **Step 9: Commit the note UI slice**

Commit message: `feat: add Markdown notes to tree nodes`

### Task 7: React publication, attribution, pagination, and admin UI

**Files:**
- Modify: `src/features/tree-library/types.ts`
- Modify: `src/features/tree-library/treeLibraryClient.ts`
- Modify: `src/features/tree-library/treeLibraryClient.test.ts`
- Modify: `src/features/tree-library/TreeLibraryActionDialog.tsx`
- Create: `src/features/tree-library/TreePublicationDialog.tsx`
- Create: `src/features/tree-library/TreePublicationDialog.test.tsx`
- Create: `src/features/admin/PublicationsTab.tsx`
- Create: `src/features/admin/PublicationsTab.test.tsx`
- Modify: `src/features/admin/types.ts`
- Modify: `src/features/admin/adminClient.ts`
- Modify: `src/features/admin/adminClient.test.ts`
- Modify: `src/features/admin/AdminPanel.tsx`
- Modify: `src/features/admin/AdminPanel.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Produces prepare/execute publish and unpublish clients with browser-generated idempotency keys.
- Extends public catalog cards/details with `publisher`, `derived_from`, and `next_cursor`.
- Adds administrator publication listing and removal.

- [ ] **Step 1: Write failing client and dialog tests**

Cover exact prepare disclosure, publish/update/unpublish labels, expected public tree ID, stale conflict recovery, deletion warning, publisher/provenance rendering, and cursor continuation.

- [ ] **Step 2: Run publication UI tests and verify RED**

Run: `npm test -- src/features/tree-library src/App.test.tsx`

- [ ] **Step 3: Implement publication client/types/dialog and App wiring**

Keep generation private by default. Only execute after the user confirms the server prepare response; refresh personal status and public catalog on success.

- [ ] **Step 4: Run publication UI tests and verify GREEN**

Run the command from Step 2.

- [ ] **Step 5: Write failing admin UI tests**

Cover the new tab, pagination, reason validation, remove confirmation, and removed-row refresh.

- [ ] **Step 6: Run admin UI tests and verify RED**

Run: `npm test -- src/features/admin`

- [ ] **Step 7: Implement admin client and PublicationsTab**

Use the existing admin shell and error conventions; require a nonblank removal reason and a new idempotency key.

- [ ] **Step 8: Run admin tests and verify GREEN**

Run: `npm test -- src/features/admin`

- [ ] **Step 9: Commit publication UI slice**

Commit message: `feat: publish and moderate community trees`

### Task 8: Skill and user-facing MCP guidance

**Files:**
- Modify: `skills/mapflow-mcp/SKILL.md`
- Create: `skills/mapflow-mcp/references/node-notes-and-publishing.md`
- Modify: `skills/mapflow-mcp/agents/openai.yaml`
- Modify: `src/features/mcp/McpGuideDialog.tsx`
- Modify: `src/features/mcp/McpGuideDialog.test.tsx`

**Interfaces:**
- Defines local `skillVersion`, guide-sync fallback, note read-before-write, explicit delete, and two-stage publication behavior.
- Shows `npx -y --prefer-online @mapflow-publish/mcp@latest` in website guidance.

- [ ] **Step 1: Write failing MCP guide UI tests**

Assert the latest command, restart requirement, session-rule-sync wording, note workflow, and publication confirmation wording.

- [ ] **Step 2: Run guide tests and verify RED**

Run: `npm test -- src/features/mcp/McpGuideDialog.test.tsx`

- [ ] **Step 3: Update the website guide and repository Skill**

Keep stable safety rules local, call `get_usage_guide` at session start, allow read-only fallback, and forbid publication writes when guide/relay compatibility fails.

- [ ] **Step 4: Validate Skill and run guide tests**

Run: `python C:/Users/Administrator/.codex/skills/.system/skill-creator/scripts/quick_validate.py D:/MapFlow-publish/skills/mapflow-mcp`

Run: `npm test -- src/features/mcp/McpGuideDialog.test.tsx`

- [ ] **Step 5: Sync the installed local Skill after repository validation**

Copy only the validated `SKILL.md`, `agents`, and `references` contents into `C:/Users/Administrator/.agents/skills/mapflow-mcp`, then rerun `quick_validate.py` on the installed directory.

- [ ] **Step 6: Commit the Skill and guide slice**

Commit message: `docs: teach agents node notes and safe publishing`

### Task 9: Full verification, direct deployment, and browser acceptance

**Files:**
- Review all task files in both repositories.
- Create production screenshots under `D:/tmp/`.

**Interfaces:**
- Produces a tested frontend bundle, backend binary/container, npm relay package artifact, validated Skill, and production acceptance evidence.

- [ ] **Step 1: Run complete backend checks**

Run: `cargo fmt --check`, `cargo test`, and `cargo clippy --all-targets --all-features -- -D warnings` in `D:/mapflow-server`.

- [ ] **Step 2: Run complete frontend and relay checks**

Run: `npm test`, `npm run typecheck`, and `npm run build` in `D:/MapFlow-publish`; run `npm test` and `npm run build` in `mcp-relay`.

- [ ] **Step 3: Review diffs and migration/deployment compatibility**

Confirm every changed line belongs to the approved spec, migration 0020 is forward-only, secrets are not logged, unrelated dirty files remain unstaged, and rollback preserves pre-migration readers.

- [ ] **Step 4: Build and deploy directly without CI**

Use the repository's existing direct-release scripts and server connection settings, apply migration 0020 before switching the app container, retain the previous container/image as rollback, and health-check both public and authenticated routes.

- [ ] **Step 5: Publish or stage the relay release**

Build the bumped `@mapflow-publish/mcp` tarball, inspect `npm pack --dry-run`, and publish with the already-authorized npm workflow if credentials are available; otherwise leave the exact tarball and publish command as the only external credential-dependent step.

- [ ] **Step 6: Run browser-harness acceptance in the open Chrome session**

Verify create/edit/delete/recreate note versions, safe Markdown rendering, publish prepare confirmation, publisher/provenance display, copy by another account, stale unpublish protection, source deletion withdrawal, pagination behavior, and admin removal. Save screenshots for the note modal, public card attribution, and removed-publication result.

- [ ] **Step 7: Report deployment and evidence**

Include commits, test totals, deployed image/container, rollback target, relay version, Skill version, production URL, and absolute screenshot paths.
