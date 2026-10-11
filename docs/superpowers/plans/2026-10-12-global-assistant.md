# Global Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. The user approved implementation on 2026-10-12; do not request another design approval.

**Goal:** Add the default global assistant and consolidate chat and map creation into a durable, recoverable Agent execution with verified, unique settlement.

**Architecture:** Reuse management conversations, existing role cards, map stores, learning areas and ledgers. PostgreSQL owns execution identity, fenced ownership, model-call evidence, map drafts, result events and settlement; DSH owns the common model/tool loop. Browser streaming subscribes to stored events and does not own the execution. Model and funding snapshots belong to an execution, while a map draft can span executions.

**Tech Stack:** Rust/Axum/Tokio/SQLx/PostgreSQL, Node 24/DSH/TypeScript, React 18/TanStack Query/Vitest. No new Agent framework.

**Spec:** `D:/MapFlow-global-assistant-20261012/docs/specs/2026-10-11-global-assistant-design.md`, approved revision `29ef923`.

## Global Constraints

- Preserve `/library`, `/maps`, `/learning`, `/tavern`, their roles, histories, permissions and mobile navigation. Add `/assistant` as the generic authenticated default.
- No site tool-count, Agent-step, correction-count, total-duration, task-cost or universal Token hard limits. Native model capacities, ownership, balance and structural validation remain real constraints.
- Cash starts only when confirmed balance is positive; successful actual cost × 2 can make it negative. Same-account active cash executions are serial. BYOK never charges site cash or points.
- Missing actual fee remains unknown and pending indefinitely; alert administrators. Never estimate, fill zero, waive or auto-close it. A complete result remains available while settlement is pending.
- One execution identity per client operation; restored executions keep their model/funding snapshot. Successful execution settles once. Stopped/failed execution costs are audit facts, not transferred into a subsequent execution.
- One fenced writer per draft. Publish, saved result, settlement state and completion event use a short atomic transaction. No model/network work inside long transactions.
- Unknown external request outcomes are reconciled rather than blindly resent. Tool errors keep safe, precise details and are returned to the Agent.
- Business TDD: witness RED before implementation, then GREEN. Before each commit run applicable complete suites, configured type checks and diff review. Production publication is outside this implementation goal until a concrete validated candidate is approved.

## Review Focus

1. Stop/commit and stale-owner races: saved completion cannot become a free failure; stale workers cannot write or bill.
2. Missing, duplicate and conflicting receipts: final sum requires all calls; explicit zero differs from unknown; late posting cannot charge twice.
3. Browser and server disconnects: attachment and recovery preserve identity; no repeated external request whose outcome is unknown.
4. Large inputs and model switching: preserve the current request, draft checkpoint and complete tool pairs without leaking other scenes' private context.
5. Cross-account and mobile deep links: a result card opens only its owned target; entering learning never generates or charges.

## Workspaces and verification

- Frontend: `D:/MapFlow-global-assistant-20261012`, branch `codex/global-assistant-20261012`, base `29ef923`.
- Backend/worker: `D:/mapflow-server-global-assistant-20261012`, same branch name, base `5d883e4`.
- Rust checks run in a dedicated source directory on the notebook with a dedicated test PostgreSQL container, never the production database. `MAPFLOW_TEST_NODE=/usr/local/bin/node` is required by existing fake-worker contracts. Preserve the engine revision `50309c3e7e77b633721aeac4548852772b77abbb`.
- Logs and the progress ledger live under `.superpowers/sdd/2026-10-12-global-assistant/` and are ignored. The verification helper synchronizes source, runs cargo with the existing dependency cache, and returns exit status plus a short log tail.
- Complete suites: frontend `npm test` and `npm run typecheck`; worker `npm test`, `npm run typecheck`, `npm run build`; Rust `cargo test --locked --offline`, `cargo fmt --check`, `cargo clippy --all-targets --locked --offline`. Build the frontend before acceptance.

### Task 1: Execution identity, state and financial evidence

**Files:** Create backend `src/agent_execution.rs`, `src/agent_execution/state.rs`, `src/agent_execution/receipts.rs`, `tests/agent_execution_domain.rs`; modify `src/lib.rs`.

**Interfaces:** Produces `AgentExecutionState`, `FundingPath`, `ExecutionLease`, `ModelCallStatus`, `CostReceipt`, and `ReceiptLedger`. State transitions distinguish business outcome, notification and settlement. Receipts retain call identity, currency, exact decimal amount and provenance; aggregate only a sealed set of fully known calls.

- [ ] Write domain tests for a successful result with missing money, late/duplicate/conflicting receipts, explicit zero, stopped costs, unique operation identity and stale ownership. Literal amounts independently check precision and rounding.
- [ ] Run `cargo test --test agent_execution_domain --locked --offline`; expected RED for missing execution/receipt behavior.
- [ ] Implement only the state transitions and exact evidence aggregation needed by these tests. Reuse existing decimal billing rules rather than reference prices.
- [ ] Run domain tests and full Rust suite; expected GREEN. Review diff and commit `feat: model durable agent execution and receipt states`.

### Task 2: Durable execution store and short-lived coordination

**Files:** Create `migrations/0046_agent_executions.sql`, `src/agent_execution/store.rs`, `tests/postgres_agent_execution.rs`; modify `src/agent_execution.rs` and backend `CONTEXT.md`.

**Interfaces:** Consumes Task 1 states. Produces `PostgresAgentExecutionStore::{accept,claim,renew,stop,append_event,events,record_call,record_receipt,execution}` using account/execution identity and lease fence. `accept` deduplicates the action ID and rejects a changed payload. Model/config snapshots contain versioned credential references, never key plaintext.

- [ ] Write real PostgreSQL tests for replay versus payload conflict, one conversation owner, account cash queueing, lease takeover and stale writes, owner-scoped event pagination, stop/complete races and completed result reattachment.
- [ ] Run `cargo test --test postgres_agent_execution --locked --offline`; expected RED before the schema/store exists.
- [ ] Implement schema and transactional CAS operations. Lease expiration identifies lost ownership, never a task timeout. Released completed/pending runs do not retain database connections or cash locks.
- [ ] Run migration twice, store tests and full Rust suite; expected GREEN and preserved historical tables. Commit `feat: persist fenced agent execution and ordered events`.

### Task 3: Persistent batched map drafts

**Files:** Create `migrations/0047_agent_map_drafts.sql`, `src/agent_execution/drafts.rs`, `tests/postgres_agent_map_drafts.rs`; use existing `src/adapters/postgres/tree_library_store.rs` graph types and validators.

**Interfaces:** Produces `AgentMapDraft`, `DraftBatch`, `DraftPublication` and store methods `create_draft`, `apply_draft_batch`, `read_draft`, `prepare_publication`. Every operation has an ID, digest, expected version and execution fence. A prepared publication is immutable and uniquely targets one map.

- [ ] Write tests for whole-batch validation, duplicate action replay, changed-payload conflict, draft continuation across different executions/models, foreign ownership, cycle/dangling-edge diagnostics and stale versions.
- [ ] Run `cargo test --test postgres_agent_map_drafts --locked --offline`; expected RED.
- [ ] Implement atomic batches and compact indexed reads; reuse the existing graph representation and essential validators. Store safe, detailed failures without terminating the conversation.
- [ ] Run draft tests and full Rust suite; expected GREEN. Commit `feat: add recoverable batched agent map drafts`.

### Task 4: One uncapped DSH loop with per-call evidence

**Files:** Modify worker `src/harness.ts`, `src/protocol.ts`, `src/tavern.ts`, `src/tavern-contract.ts`; create worker `src/model-call-evidence.ts` and `src/model-access.ts`; modify Rust `src/adapters/agent_runtime/{protocol.rs,deepseek_harness.rs,tavern.rs}` and `src/tavern/{tool_session.rs,tree_tools.rs}`. Tests in worker `test/` and existing Rust fake-worker contracts.

**Interfaces:** Produces common chat requests with model capability snapshots, call IDs and optional native output parameters; no finite `maxSteps`. Provider adapter reports each call start/outcome, text/usage and exact monetary receipts through a host evidence bridge. Plain chat is the same loop with no private tools.

- [ ] Write worker tests that actually execute more than 16 steps and 8 tools, return a recoverable error then correction, preserve missing versus zero money, and support BYOK completion without money. Add protocol and Rust bridge tests before changing each layer.
- [ ] Run the targeted worker/Rust contracts; expected RED at current caps and missing fee evidence.
- [ ] Consolidate DSH loops, remove count/total-time guards, and adapt existing cash/BYOK provider parsing into the model adapter without keeping a second Agent loop. Persist call-start before network dispatch. Abort is an explicit execution signal.
- [ ] Run full worker tests/typecheck/build and full Rust suite; expected GREEN. Commit `refactor: unify chat in uncapped DSH execution`.

### Task 5: Background execution, recovery and atomic completion

**Files:** Create `src/agent_execution/{runner.rs,finalization.rs}` and `tests/agent_execution_recovery.rs`; modify `src/tavern/{service.rs,turn_store.rs,cash_store.rs,paid_service.rs,execution_log.rs}`, `src/http/tavern.rs` and bootstrap modules discovered at their call sites.

**Interfaces:** Consumes Tasks 1–4 stores, publications and call evidence. Produces accept/subscribe/status/stop/resume operations. Saved reply/map, settlement, business success and completion event share one short transaction. A pending-fee result releases active execution ownership; late receipts post the original settlement once.

- [ ] Write fault tests for browser disconnect, server restart after a tool write, uncertain provider dispatch, notification loss, postcommit read failure, map-ready summary interruption, stop/commit races, zero/negative next balance, missing/conflicting receipts and posting rollback.
- [ ] Run recovery/settlement contracts; expected RED for current cancellation-on-drop, long locks and false failures.
- [ ] Run ownership in the background, persist checkpoints/events, restore by querying evidence first and separate subscriber lifetime. Implement exact unique finalization and pending reconciliation. Do not add automatic fee waiver or estimated debit.
- [ ] Run recovery tests and full Rust/worker suites; expected GREEN. Commit `feat: recover agent execution and finalize results exactly once`.

### Task 6: Persistent model profiles and window-aware context

**Files:** Create `migrations/0049_agent_model_profiles.sql` (0048 is the completed execution migration), `src/agent_execution/{model_profiles.rs,context.rs}` and tests; modify `src/platform_model_access.rs`, `src/platform_runtime.rs`, `src/http/admin.rs`, worker `src/platform.ts`; frontend `src/features/admin/{ProviderTab.tsx,adminClient.ts,types.ts}` and tests.

**Interfaces:** Produces versioned model/credential/capability snapshots and tested activation. Preserves cash catalogue versus points-default distinction. Context preparation returns complete current requirements, draft index and matching tool request/result groups with readable references to large stored data.

- [ ] Write tests for persistent restart selection, failed activation retaining old service, immutable old credentials/config, smaller window preserving a large latest turn/tool pairs, unsupported parameters and admin authorization.
- [ ] Run targeted profile/context/admin tests; expected RED at memory-only selection and universal history rejection.
- [ ] Implement supported adapter configuration persistence and snapshot activation, full input storage and window adaptation; record any paid context compression under the same execution.
- [ ] Run complete Rust/worker/frontend suites and type checks; expected GREEN. Commit `feat: configure durable model profiles and adaptive context`.

### Task 7: Default global assistant and execution-aware client

**Files:** Modify frontend `src/App.tsx`, `src/features/navigation/ApplicationShell.tsx`, `src/features/learning/LearningChatWorkspace.tsx`, `src/features/tavern/{TavernPage.tsx,tavernClient.ts,types.ts}`; create `src/features/assistant/GlobalAssistantPage.tsx` and focused tests.

**Interfaces:** Consumes Task 5 accepted execution identity and ordered events, reuses management conversations. Routes `/assistant`; status attachment never creates a new execution. Stop explicitly calls the stop endpoint; page changes detach only.

- [ ] Write tests for login/root default, all explicit old destinations, restoring management history, reconnecting from sequence, stale duplicate events, pending-cost display and stop versus navigation behavior. Test opaque mobile drawer/deep links with owned targets.
- [ ] Run targeted App/assistant/client tests; expected RED for missing default route and subscription protocol.
- [ ] Implement assistant route and shared client execution attachment; keep original map/chat interface and all role controls. Pure style adjustments follow current dark design.
- [ ] Run full frontend suite/typecheck/build; expected GREEN. Commit `feat: open the global assistant by default and restore live executions`.

### Task 8: Map-building tools and trusted learning cards

**Files:** Create `src/tavern/map_draft_tools.rs`; modify `src/tavern/{management_tools.rs,map_generation.rs,tool_session.rs}`, worker tool contracts, finalization; frontend management result/card components and tests.

**Interfaces:** Management tools `create_map_draft`, `read_map_draft`, `apply_map_draft_batch`, `validate_map_draft`, `publish_map_draft` use the current execution fence. Publication prepares a target finalized by Task 5. Cards include only server-owned saved map/area IDs. `join_learning_area` stays idempotent and unbilled.

- [ ] Write end-to-end tool tests for repairable structural errors, batch replay, staged publication, completion card, multiple user rounds and private scene boundaries. Write client tests for exact map selection, failed join staying in chat and click causing no model request.
- [ ] Run targeted tool/card tests; expected RED because old preparation only opens a form.
- [ ] Expose draft tools through the shared loop and deterministically render saved result cards with view/learn actions. Model text cannot fake successful publication.
- [ ] Run all Rust/worker/frontend suites and type checks; expected GREEN. Commit `feat: build maps through assistant tools and open owned learning areas`.

### Task 9: Retire duplicate entry points without deleting history

**Files:** Modify tree-generation HTTP/application entry gates, worker legacy run dispatch, frontend old create buttons/form entry, and applicable contracts; delete only proven uncalled legacy execution loops after reference review.

**Interfaces:** New execution version is fixed at creation; old inflight/historical records retain their supported reading/recovery path. New map-generation requests reach assistant draft tools rather than old planning/research/assembly pipeline.

- [ ] Write regressions for historic generation reads, old inflight ownership, migrated new entry, payment/auth/map editing/learning/standalone/BYOK behavior.
- [ ] Run tests; expected RED for remaining new traffic entering old loops.
- [ ] Switch supported new entry points and remove verified duplicate loops only after Task 8 acceptance. Keep protocol adaptation, old historical stores and domain validators.
- [ ] Run complete suites/typecheck/build/fmt/clippy and inspect call references; expected GREEN. Commit `refactor: retire duplicate generation execution entry points`.

### Task 10: Real quality, billing and recovery acceptance

**Files:** Add evidence under `docs/research/2026-10-12-global-assistant-acceptance.md` with private fixtures/logs kept ignored; package a fixed candidate only after all checks.

**Interfaces:** Uses the complete candidate and isolated test accounts/databases, not production data. Record model/config version, call IDs, input/output/cache tokens, exact fees, saved maps and timings.

- [ ] Run four real topic classes (simple, specialist, ambiguous, multi-round changes) through cash and the enabled points model, scoring structure and teaching quality separately. Report unavailable credentials/models precisely rather than inventing results.
- [ ] Run real API calls covering long output and more than former tool/step limits; verify cash exact receipts × 2, points policy, BYOK isolation and replay without another debit.
- [ ] Inject disconnect/restart/receipt faults against the candidate. Run the complete test suites, types, builds, fmt/clippy and diff self-review. Expected GREEN plus persisted single results and fees.
- [ ] Create a review package and use one fresh final reviewer as required by executing-plans; fix important findings with RED→GREEN and rerun affected complete suites.
- [ ] Commit acceptance evidence and report the exact reviewable candidate, remaining practical limitations and verification. Mark the goal complete only when its required implementation and validation are actually achieved.
