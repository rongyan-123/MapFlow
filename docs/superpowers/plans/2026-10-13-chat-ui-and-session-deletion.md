# Chat UI and Conversation Deletion Implementation Plan

> **For agentic workers:** Execute the approved work continuously using TDD. The coordinator integrates and verifies the UI; an isolated backend worker implements the deletion contract. Fresh reviewers inspect the completed work. No further design approval is required: the user explicitly said “可以。开始。”

**Goal:** Deliver compact desktop/mobile chat, consistent configuration dialogs and persistent conversation deletion, including all six audit boundaries, with screenshots for user review.

**Architecture:** A desktop chat toolbar owns the previously stacked page controls. Conversation deletion is an account-scoped server tombstone with explicit bootstrap state, shared transaction gates and separate public/internal execution reads. Canvas deletion preparation freezes and flushes client drafts before deletion.

**Tech Stack:** React 18, TypeScript, TanStack Query, Tailwind, Vitest; existing Rust/Axum/SQLx/PostgreSQL backend; Browser Harness and Chromium for acceptance.

**Spec:** ../../specs/2026-10-13-chat-layout-and-conversation-deletion-design.md

## Global Constraints

- Frontend baseline/design commit dd37afd, branch codex/chat-ui-and-session-deletion-20261013.
- Backend baseline a9fb2e3a0a7872d06d4a6df9b8ad6262d5caf927; isolated D:/mapflow-server-chat-ui-20261013, branch codex/conversation-deletion-20261013.
- All added or changed logic: write the behavioral test, run and observe valid RED, implement GREEN, keep tests green during cleanup.
- Leave other worktrees and .ua/ untouched. Use explicit file staging and commit only this task's files.
- API list metadata: bootstrapState = never_created | has_active | cleared. Tombstone = deleted_at.
- DELETE success/repeat for the owning account = 204; inaccessible target = safe 404; active execution = 409 / tavern.conversation_busy.
- Default open after clear = 409 / tavern.history_cleared; deleted creation request replay = 410 / tavern.creation_target_deleted; keep existing uniqueness/hash checks.
- Desktop starts at 1024 px. Toolbar 52–56 px, single row; adaptive folding depends on its container width.
- Configuration maximum width 1024 px; height min(720 px, viewport height - 48 px); only categorized dialogs receive this frame.
- No production deletions, generated paid requests or publication as part of acceptance. Use isolated test data and actual interfaces.
- Final handoff must include screenshots that were visually inspected and a usable preview. Browser emulation is not a physical-phone claim.

## Review Focus

1. A late default-open response must not resurrect the last deleted conversation: frontend deletion tests seed both default-query caches and resolve a deferred response.
2. Generation replay and execution-ID reads must not bypass deletion checks: backend tests cover completed results, old cursors and old request/action IDs.
3. Canvas unmount must not clear busy state before an outstanding flush completes: fake-clock tests retain the lifecycle until the promise settles.
4. A failed deletion must preserve current drafts and model choices: frontend tests assert content and selectors before/after failure.
5. At 1024 px with the smallest chat panel, all primary buttons and a long title must remain reachable: real browser geometry checks and screenshots.

## Task 1: Backend deletion, bootstrap and execution boundaries

**Files:** D:/mapflow-server-chat-ui-20261013/src/http/tavern.rs; src/tavern/{store,management_conversations,learning_areas,tree_connection,turn_store,canvas}.rs and the existing shared access helpers; src/http/agent_executions.rs; src/agent_execution/{public_view,service,store}.rs; new migration; the existing error maps; focused backend tests.

**Consumes:** Existing account/CSRF authorization, bootstrap advisory locks, Agent account serialization, conversation row locks, legacy generation guard and finance stores.

**Produces:** The exact list/bootstrap/deletion/replay contract above, public execution denial for deleted conversations, preserved internal finance reads.

- [ ] Read approved spec and backend rules; locate the Linux build/test environment without modifying production.
- [ ] Add tests for first entry, cleared/default denial, explicit create, tombstone list/detail/write denial, ownership, repeat DELETE and 410 replay. Observe expected RED.
- [ ] Add two-connection barrier tests for delete/accept, legacy generation guard, resume and canvas write ordering. Observe RED caused by missing deletion checks.
- [ ] Implement the migration, bootstrap and tombstone transaction, preserve uniqueness and safe error mappings. Run focused tests GREEN.
- [ ] Apply public execution checks to active/accept/status/events/resume/stop/approval and old generation replay. Add completed-result/old-cursor tests plus internal financial-read checks; observe RED then GREEN.
- [ ] Run complete backend tests, fmt/check/clippy where configured; record real commands, results and environment limitations. Commit validated task files and write a report.

## Task 2: Frontend deletion and canvas lifecycle

**Files:** src/features/tavern/{TavernPage,ConversationPane,useTeachingCanvas,tavernClient,pendingCreation,types}; src/features/assistant/{agentConversationRun,agentExecutionClient}; src/lib/publicErrors.ts; corresponding tests and a focused ConversationDeletion.test.tsx.

**Consumes:** Task 1 API contract; existing QueryClient and account/scene/learning-area storage keys.

**Produces:** Delete confirmation and empty state, default-query invalidation, matching-ID retry cleanup, canvas freeze/flush/deleted lifecycle and terminal execution cleanup.

- [ ] Add a focused behavioral fixture using actual TavernPage with mocked HTTP only. Lists return `{ conversations, bootstrapState }` and DELETE returns a real 204 Response.
- [ ] Test cancel/no request, current/noncurrent/last deletion, safe failure preserving drafts, refreshed cleared state and explicit new UUID; observe RED.
- [ ] Add fake-clock useTeachingCanvas tests: queued 800 ms save, in-flight save, rejected flush, cancel, successful deletion then unmount with no PATCH. Observe RED.
- [ ] Implement a conversation-bound canvas preparation lifecycle; allow ordinary unmount flush, suppress deleted cleanup, expose status for deletion preparation. Run hook tests GREEN.
- [ ] Integrate DELETE, list metadata and explicit empty-state create. Clean both default-open query keys and prevent old responses being applied. Run focused UI tests GREEN.
- [ ] Test 410 matching pendingCreation cleanup and preserved network retry; test deleted execution 404 stops readers and clears recovery state. Implement GREEN.
- [ ] Run all frontend tests and typecheck before committing the integrated behavior.

## Task 3: Desktop/mobile UI and stable configuration frame

**Files:** src/App.tsx; src/features/learning/LearningChatWorkspace.tsx; src/features/assistant/AgentTavernPage.tsx; src/features/tavern/{TavernPage,ConversationPane,TavernUi}; shared desktop toolbar component/CSS; mobileChatChrome.css; focused toolbar, configuration and existing scene tests.

**Consumes:** Existing role, area, funding, canvas and navigation state; Task 2 delete and empty-state controls.

**Produces:** One compact toolbar, consistent categorized dialogs and orderly mobile drawer/composer.

- [ ] Test desktop shared controls, no separate model/canvas/header rows, correct learning-area values, menu folding and preserved drafts; observe RED for changed interaction/layout structure.
- [ ] Implement desktop toolbar slots above conversation/history splits; hide the redundant App chat title and move area/model/canvas controls into the toolbar.
- [ ] Keep history/new/canvas/config/more accessible; fold role/import first, then funding/model, area/back, map; truncate titles and remove decorative avatar in narrow containers.
- [ ] Set a fixed categorized-dialog frame with flexible scrolling content; verify switching all five categories preserves existing field state, focus and close behavior.
- [ ] Refine mobile drawer section hierarchy, configuration navigation, message width, empty/delete states and composer spacing; preserve touch sizes and draft behavior.
- [ ] Run affected tests GREEN, full frontend suite, typecheck, build and diff self-review; commit validated UI files.

## Task 4: Real acceptance, screenshots and review

**Files:** docs/research/2026-10-13-chat-ui-acceptance.md; screenshot/result artifacts under docs/research/2026-10-13-chat-ui/; ignored scripts and logs in this plan's workspace.

**Consumes:** Tasks 1–3, real isolated backend/database and built frontend.

**Produces:** User-openable preview, inspected desktop/mobile screenshots, geometric and functional acceptance evidence.

- [ ] Run actual build against isolated service; use real accounts/history and no substituted HTTP responses or paid generation.
- [ ] Desktop 1024/1280/1440/1920, boundary 1023/1025: default/wide sidebar, map shown with minimum chat width, long names, all menu controls and no horizontal overflow.
- [ ] Mobile 320/375/390/430 and landscape/short viewport: single toolbar, drawer, delete confirmation, all five config categories, long replies/code/tables, input/send reachability, dark/light theme.
- [ ] Exercise real create/cancel/delete/current/last/reload/new-create, old execution denial, saved canvas and failed-save protection on isolated data.
- [ ] Capture screenshots after each representative state; open and inspect the images, fix defects, repeat only affected checks.
- [ ] Fresh code review of each behavior/UI task and the whole branch; resolve meaningful findings with RED→GREEN and covering checks.
- [ ] Preserve evidence, commit acceptance report, then mark goal complete only after preview and screenshots are ready for the user.
