# Four-interface refactor execution ledger

## Authority and worktrees

- Approved design: `docs/specs/2026-10-08-four-interface-learning-design.md`; user explicitly said to start implementation and create a long-running task on 2026-10-08.
- Frontend: `D:/MapFlow-chat-first-design-20261008`, branch `codex/four-interface-learning-20261008`, initial design checkpoint `290e09f`.
- Backend: `D:/MapFlow-four-interface-server-20261008`, branch `codex/four-interface-learning-20261008`, base `6547705`.
- First completed subsystem: learning-area API and frontend client. Backend checkpoint `eea79ea`; next task is scene/conversation binding.
- Deployment and production writes are not part of implementation authorization; prepare a verified release candidate first.

## Decisions

- Ruling: user's “可以，直接开始做” approves the conservative permission matrix in the reviewed design — reads are scoped, edits require approval, tavern has no learning-resource access — no new blanket writing permission is inferred.
- Ruling: area identity equals its personal library entry's UUID — the design requires one area per account-owned map; this avoids a second ambiguous locator while still persisting explicit membership and tombstones. Cost if changed later: a compatibility mapping, not a history rewrite.
- Ruling: test at real authenticated HTTP and user-visible UI boundaries already specified in the design; use database writes only to arrange fixtures and inspect migration invariants, not as the only proof of API behavior.
- Ruling: current CONTEXT.md still describes public-map joins as references; current source actually creates private copies. Preserve current implementation and flag terminology documentation for the relevant integration pass.

## Progress

- [x] Long-running goal created.
- [x] Approved design reviewed; isolated frontend/backend worktrees verified.
- [x] Existing Rust/SQLx integration test fixtures and isolated Linux test database located; Windows does not have cargo in PATH.
- [x] Learning-area API: RED → GREEN and compatibility tests; 777 backend tests and configured checks passed.
- [ ] Scene/conversation binding and legacy migration.
- [ ] Four page navigation and learning-area selection.
- [ ] Role filtering/import hints and scene-aware histories.
- [ ] Management directory/tutorial tools and strict learning/tavern tool isolation.
- [ ] Map/canvas views, viewport/notes recovery and generation ownership during navigation.
- [ ] Full checks, real request/UI acceptance and independent review.
- [ ] Concrete main integration/release candidate; deployment approval.

## Evidence

New implementation tests and request measurements are appended as they are run. Previous baseline: frontend 569 passed / 1 skipped, TypeScript and production build passed. Baseline results do not prove the refactor.

- Area API RED: authenticated GET returned 404 rather than 200, after correcting the fixture invitation format. GREEN: repeated POST gives the same area, list contains one area and no conversation is created.
- Five HTTP/migration tests passed: explicit creation, account/CSRF isolation, concurrent creation, deleted-map placeholder, legacy history preservation and replay-safe migration. The `learning_area` filter covers four tests; the deleted-map test was separately run by its exact name.
- Production read-only aggregate inventory: 361 accounts, 45 conversations (36 map-linked, 9 unlinked), 31 distinct linked owner/map pairs, 44 characters, 9 canvases, 16 cash receipts and 25 legacy import markers. No user bodies or credentials were printed, and no production writes were performed.
- Initial full backend run: 148 library tests passed; the existing worker-start test failed its five-second handshake under full parallel load. Its exact isolated rerun passed in 0.11 s. The whole suite was then repeated with two test threads, without changing product code or test timeouts.
- Full bounded backend run completed: 777 tests passed; fmt check passed; configured Clippy passed with eight warnings in unchanged baseline files. Experimental stricter `-D warnings` was not green on baseline lints; none arose in this subsystem.
- Frontend client RED: missing learning-area operations. GREEN: 10 contract tests passed; complete suite 579 passed / 1 skipped, and TypeScript passed. These are client/API checks, not acceptance of the four redesigned pages.
