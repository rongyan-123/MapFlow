# Learning Areas API Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. This is the first independently testable subsystem of the approved four-interface refactor; continue with the remaining subsystems recorded in the design and execution ledger.

**Goal:** Let an authenticated user explicitly create/list one learning area per owned personal map without generating a map or conversation.

**Architecture:** Reuse the personal library entry as the stable one-to-one learning-area identifier. Persist area membership and a title snapshot in a new additive table. Register authenticated routes in the existing Tavern HTTP module and implement ownership-scoped database access in a focused learning-area module.

**Tech Stack:** Rust, Axum, SQLx/PostgreSQL, existing authenticated router fixtures.

**Spec:** `docs/specs/2026-10-08-four-interface-learning-design.md`.

## Global Constraints

- Four distinct business pages; this subsystem supports learning-chat selection, not a replacement of four pages with two.
- One account-owned map has at most one area. Creating an area must not generate a map, model response, conversation, or cash charge.
- Keep existing database migrations byte-identical, especially `0037`; add migration `0039_learning_areas.sql` after verifying current main ends at `0038`.
- Existing conversations, characters, branches, canvases and charges retain their IDs and contents.
- Scope by authenticated account; never trust an account ID supplied by a model or browser.
- No production writes or deployment during API implementation; use the established isolated test database.

## Review Focus

- Repeated and concurrent create requests return the same area ID.
- Foreign account requests cannot create or enumerate another account's areas.
- Creating an area without starting a conversation must leave the account's conversation list empty.
- A deleted map does not silently rebind its area to another map; an unavailable row can retain its title snapshot.
- A legacy map-linked conversation has a discoverable area after migration, without a second history import.

### Task 1: Explicit area membership through the authenticated HTTP boundary

**Files:**
- Create (backend): `migrations/0039_learning_areas.sql`, `src/tavern/learning_areas.rs`.
- Modify (backend): `src/tavern.rs`, `src/http/tavern.rs`.
- Test (backend): `tests/tavern_http_sidecar.rs` using its existing real router/authentication helpers.

**Interfaces:**
- `POST /api/me/learning-areas/{library_entry_id}` → `LearningArea` JSON: `areaId`, `libraryEntryId`, `title`, `available`, `createdAt`.
- `GET /api/me/learning-areas` → `{ "areas": LearningArea[] }`.
- Module methods: `learning_areas(account: Uuid)` and `create_learning_area(account: Uuid, entry: Uuid)`; account comes from existing authenticated request extensions.
- Area ID equals the unique personal library entry ID; separate scene/conversation association is owned by the next subsystem, not implicitly created here.

- [x] Add a router-level test that creates an owned public-map copy through the existing store fixture, checks an empty area list, creates an area twice, checks the same ID and one listing, and checks the conversation list remains empty.

```rust
let response = json_call(&app, Method::GET, "/api/me/learning-areas", &owner, Value::Null).await;
assert_eq!(response.status(), StatusCode::OK);
assert_eq!(body_json(response).await, json!({"areas":[]}));
let endpoint = format!("/api/me/learning-areas/{entry}");
let first = json_call(&app, Method::POST, &endpoint, &owner, json!({})).await;
assert_eq!(first.status(), StatusCode::OK);
let area = body_json(first).await;
assert_eq!(area["areaId"], entry.to_string());
assert_eq!(area["libraryEntryId"], entry.to_string());
assert_eq!(area["available"], true);
let again = body_json(json_call(&app, Method::POST, &endpoint, &owner, json!({})).await).await;
assert_eq!(again["areaId"], area["areaId"]);
let listed = body_json(json_call(&app, Method::GET, "/api/me/learning-areas", &owner, Value::Null).await).await;
assert_eq!(listed["areas"].as_array().unwrap().len(), 1);
let chats = body_json(json_call(&app, Method::GET, "/api/me/tavern/conversations", &owner, Value::Null).await).await;
assert_eq!(chats["conversations"], json!([]));
```

- [x] Run `cargo test --test tavern_http_sidecar explicit_learning_area_creation_is_idempotent_and_does_not_start_a_conversation -- --exact`. Expected RED: current router returns 404 instead of 200, not a compiler or database setup error. Keep red output in the plan workspace.
- [x] Add the table with an account foreign key and unique `(account_id, library_entry_id)`, using a durable library-entry identifier rather than cascading away area history when a map is removed. Backfill only existing linked conversations, grouping by owner and entry, retaining the map title.
- [x] Implement create as `INSERT ... SELECT` from the authenticated account's ready personal-library entry with `ON CONFLICT ... DO UPDATE` of title only. Reject zero returned rows as not found. List via account-scoped left joins to live maps, with snapshot fallback and an `available` flag.
- [x] Register the two routes on the existing authenticated router; serialize the response type with camelCase. Return mapped `ServiceError` rather than database text.
- [x] Re-run the exact test. Expected GREEN: successful explicit creation, stable ID, one listing and zero conversations; no model endpoint called.
- [x] Add/run owner-isolation, concurrent creation and unavailable-map tests at the same HTTP boundary. If an uncovered case fails, record its RED before correcting implementation; already-green coverage is recorded as regression coverage, not fabricated TDD failure.
- [x] Run complete backend tests, fmt check and configured Clippy before committing; review the migration and diff. Confirm existing migration hashes remain unchanged.
- [x] Commit only this subsystem plus its evidence; mark the ledger task complete and proceed with scene/conversation binding from the approved design.

## Execution decisions

- User's 2026-10-08 instruction explicitly approves implementation and asks to start a long-running task. The existing design already names HTTP behavior and UI behavior as test boundaries; no additional permission prompt is needed for these tests.
- Execution is inline; the fresh whole-branch reviewer is deferred until all implementation subsystems are ready. Do not spawn implementation agents for each task.
- Keep production deployment as a separate approval step after a concrete, verified release candidate exists.
