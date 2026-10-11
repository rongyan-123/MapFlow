# Four-interface release candidate

This is the continuation of the approved 2026-10-08 four-interface design and 2026-10-11 integrated acceptance plan. The implementation is in the frontend and backend `codex/four-interface-learning-20261008` branches. The shared main checkouts and production service have not been changed. Final source commits are recorded with the packaged candidate provenance after both repositories pass their gates.

## Included behavior

- Public library retains search/filter, paging and private-copy joining. My maps is a separate full-width view with notes/progress and remembered viewport.
- Learning chat has an area-selection/management layer and multiple chats per owned map. Map and canvas open on demand and release heavy hidden renderers. Node references are removable and never send a message automatically.
- Roles are shared in the account; management, learning-area and independent histories remain scoped. Independent tavern has its own canvas and cannot access private learning resources. Imported roles announce themselves without replacing the active story or draft.
- Management tools require an explicit owned map. Learning tools stay within the current area. Granular, versioned note/progress changes require the exact confirmation; failures remain available for Agent correction and diagnostics.
- Existing platform settlement, model access, administrator permissions, wallet and auxiliary entries remain. Opening pages, areas or chats does not generate a billable model request.
- The latest mobile main changes are retained. Final review fixes cover response-loss retries across refresh, archived read-only content with local history browsing, full learning return URLs and historical role names across edits/branches/continuations.

## Evidence

See `../research/2026-10-11-integrated-browser-and-billing.md` and the backend `docs/research/2026-10-11-actual-acceptance.md` for full automated gates, actual desktop/mobile checks, four billed requests and exact receipt audits. The billed calls used disposable accounts/databases; production balances were not altered. SQLx migration replay through 0044 preserved all original fields and counts across 54 production-snapshot tables. Final review has no remaining Critical/Important findings.

## Authorized release sequence after final confirmation

1. Re-fetch both repositories and check main against the tested source commits. Integrate by fast-forward where possible; if main changes again, test the combined candidate before publishing.
2. Package the fixed frontend build, backend source, compiled worker and engine revision with checksums. Build the release image from this fixed provenance without switching production.
3. Take a private current database backup and record existing application, diagnostics/payment mounts and source labels. Validate the candidate against a fresh isolated clone with the new area/scene protocol. The old acceptance script's arbitrary tavern-to-map linking must not be reused: the redesigned scenes intentionally reject it.
4. Apply the additive migrations and switch the application while keeping the database, diagnostics, payment monitor and tunnel configuration. Verify readiness, fixed static assets, all four routes, restored histories, normal/administrator access boundaries and unchanged existing top-ups/ledger rows. Navigation must still issue zero model turns.
5. Run an isolated authenticated release check of the real generation/receipt chain; record exact source/image/asset hashes and outcomes. Any additional production payment or destructive action requires its own explicit instruction.

The old backend is incompatible with new learning conversation constraints; an application-only rollback to that version is not a verified recovery path. Preserve new chats/payments and use a compatible corrective image rather than restoring an old database over new user activity.

Deployment requires the concrete candidate confirmation specified in the approved design's implementation authorization note. This document is preparation, not a record of a production release.
