# Four-interface release candidate

This is the continuation of the approved 2026-10-08 four-interface design and 2026-10-11 integrated acceptance plan. Both `codex/four-interface-learning-20261008` branches passed their gates. On 2026-10-11 the user explicitly approved main integration and deployment. Frontend main was fast-forwarded to `8abd0a7` and backend main to `8513071`, both pushed; the fixed image below is now live on the notebook. See `../research/2026-10-11-four-interface-production-release.md` for final release evidence.

## Fixed candidate

- Frontend source: `42ff810f40ed2d567bd553fcfd7b628c1aff317e`.
- Backend source: `8513071b91ecf7d0fc77b7f10e1b4767f860e818`; pinned engine `50309c3e7e77b633721aeac4548852772b77abbb`.
- Image: `mapflow-server:four-interface-candidate-20261011-8513071`.
- Image ID: `sha256:a331e6a5248174119d76d6aaafd1587cbb0062552f44b6f95ed397a37842a841`.
- Notebook packet: `/home/rong/.local/state/mapflow/four-interface-candidate-20261011/`; contains source archives, checksums/provenance, optimized binaries, the fixed frontend and compiled worker. No runtime credentials are in the image build context.

All 307 relevant backend source files matched the actual tested notebook tree and fixed source archive. All 370 frontend assets matched the build. Optimized, locked Rust release compilation passed. The image reuses an ID-verified existing runtime with the same dependency manifest and replaces both binaries, worker code and frontend; it was built without fetching a remote base. Source labels and 381 files inside the final image matched the prepared checksums. The actual packaged worker's shutdown protocol smoke passed without network access. This final documentation checkpoint does not change either fixed source build.

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
2. Reverify the already-built image/provenance above. If source integration adds anything beyond documentation, rebuild and rerun the affected gates before switching production.
3. Take a private current database backup and record existing application, diagnostics/payment mounts and source labels. Validate the candidate against a fresh isolated clone with the new area/scene protocol. The old acceptance script's arbitrary tavern-to-map linking must not be reused: the redesigned scenes intentionally reject it.
4. Apply the additive migrations and switch the application while keeping the database, diagnostics, payment monitor and tunnel configuration. Verify readiness, fixed static assets, all four routes, restored histories, normal/administrator access boundaries and unchanged existing top-ups/ledger rows. Navigation must still issue zero model turns.
5. Run an isolated authenticated release check of the real generation/receipt chain; record exact source/image/asset hashes and outcomes. Any additional production payment or destructive action requires its own explicit instruction.

The old backend is incompatible with new learning conversation constraints; an application-only rollback to that version is not a verified recovery path. Preserve new chats/payments and use a compatible corrective image rather than restoring an old database over new user activity.

The concrete candidate received the confirmation required by the approved design's implementation authorization note. All five release steps above completed; the linked production record supersedes earlier pending-release statements in the historical acceptance notes. Later documentation commits do not change the fixed source build or image.
