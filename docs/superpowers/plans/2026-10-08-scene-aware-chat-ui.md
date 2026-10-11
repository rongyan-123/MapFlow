# Scene-aware chat UI

Approved continuation of the four-interface redesign. First replace the old create-then-link flow with the authenticated area protocol; then integrate real navigation. Shared cards remain account-wide; histories and remembered selections are scene/area scoped.

1. RED: render the learning chat and assert its area history request, atomic new conversation request, archived read-only entry, and refusal to load a remembered independent ID absent from the scene list. Verify real requests through the existing client.
2. GREEN: area-aware query keys and selection storage; independent chat never inherits an area's selected ID. New learning conversations use the area POST, with no subsequent map binding. Archived maps allow saved chats but no creation or tree-tool control. Preserve current draft/history on failure.
3. RED → GREEN: tool settings may only toggle the current learning area's tools; no map picker and no personal map reads in the independent tavern. Preserve drawing controls separately.
4. Adapt tests for superseded linking workflows while retaining their user-level intent: busy protection, failure recovery, exact remembered history and no unintended duplicate requests.
5. Run complete frontend suite, TypeScript, production build and diff review before committing. Then continue four-page routing, role filter/import markers and the management assistant.

Ruling: a lost response from a newly created conversation needs a server-backed idempotency key, not a guessed match from recent history. Implement and verify that protocol before adding automatic lost-response retries.

Completed UI gate on 2026-10-11: 609 complete-suite tests passed / 1 skipped, TypeScript/build/diff checks passed. Detailed evidence in `docs/research/2026-10-11-scene-chat-ui-verification.md`. Companion backend replay focused GREEN; whole backend regression and four-page integration remain active.
