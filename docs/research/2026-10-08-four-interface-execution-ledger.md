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
- [x] Scene/conversation binding and legacy migration: backend `8d84f06`, 782 full regression tests passed.
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
- Scene/area client RED: missing operations, wrong scene request path and acceptance of inconsistent metadata. GREEN: 17 area/scene contracts plus 27 existing Tavern contracts passed. A repeated mock response-body issue was fixed in the test fixture, not hidden in transport code.
- Full selection-layer UI RED: missing “进入” button after creating a compiling empty shell (the missing-import error is not the behavioral RED). GREEN: six user-visible tests for opening, explicit map membership, search, archived history, creation failure and empty-account/management guidance.
- Frontend complete bounded suite: 592 passed / 1 skipped. Initial unrestricted run had one transient historical linking-recovery UI failure; its exact rerun and full bounded run passed. Four main navigation pages are not integrated yet, and backend scene full regression is pending.
- Backend scene RED: new conversation endpoint 404; explicit tavern-to-map binding 200 where forbidden was required; role switch replaced the topic title. Focused GREEN: area histories/default tutor/scenes, permission rejection and anchored role-change records. Five legacy billing fixtures now open actual learning conversations; all 28 paid-service regression tests passed.
- Ruling: role-change positions are persisted as separate anchored events rather than synthetic system messages. Existing graph leaves must be assistant messages; this preserves history invariants and avoids adding UI metadata to model context.
- Frontend selection/client checkpoint gate: complete suite 592 passed / 1 skipped, TypeScript and production build passed. Vite retains existing large-chunk warnings; navigation/lazy-render work is still required. No publish action was performed.
- 2026-10-11 resumed on the user's request. Reviewed main commits `183a744` and `13e3bba` and fetched origin. Both mobile chat-height improvements merged into this isolated frontend branch. Stashed scene work restored; toolbar conflicts resolved by retaining mobile compact menus plus scene-aware creation. Shared main and production were not modified.
- Scene UI RED → GREEN: three real-client UI tests for area history/atomic creation, archived history without creation and rejecting a remembered ID outside independent scene history. Tool settings RED: old personal map picker remained in learning/tavern. Current task: preserve fixed area toggle and verify superseded linking tests against the atomic protocol.
- Ruling: new conversation retries require a persisted client request ID and matching request hash. A lost response must restore the same ID, not guess from recent history or create another story. Add this to the area protocol and preserve the current tool opt-out on new chat. Cost: one additive migration and replay tests.
- Scene-aware UI gate: complete frontend 609 passed / 1 skipped; typecheck and build passed. New RED → GREEN cache tests prevent learning history from flashing in independent tavern, including a mixed old cached catalogue. User mobile commits preserved. Backend creation replay focused GREEN; complete backend gate pending. Continue actual page navigation.
- Backend replay gate complete: `92a508a`, 783 passing tests, fmt/configured Clippy. Backend owned management protocol `05d217e`, 785 passing tests, no map binding or model call on opening. Management tools remain to implement.
- Four actual page UI checkpoint: 627 passed / 1 skipped, types/build/diff checks passed. Node entry stages an optional removable reference and sends only on explicit Send; account/map viewport restoration and lazy mutually exclusive map/canvas views covered. Browser and charged-request acceptance remain final integration gates.
- Ruling: collapse releases the heavy canvas editor instead of retaining its hidden mount — approved lazy-renderer requirement — cost: editor-local selection resets on reopen; hook-owned document/autosave remains.
