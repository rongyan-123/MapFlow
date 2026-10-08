# Conversation scenes and area histories plan

Continuation of the user-approved four-interface design. Persist scene ownership before replacing UI navigation. Keep existing graphs, opening messages, billing and diagnostics; no production deployment.

## Scope

- Add migration `0040`: `scene` (`tavern`, `learning`, `management`) and durable `learning_area_id` on existing conversations. Backfill linked conversations to their existing area. Store each area's default tutor reference without changing imported cards.
- Extend response metadata. The general conversation list defaults to tavern and supports an explicit validated scene filter. Area history routes require owned persisted membership and return only that area's conversations, including accessible archived history.
- `POST /api/me/learning-areas/{area}/conversations` explicitly creates a new conversation, accepting an optional account-owned role. Empty request uses a reusable default tutor. Existing tree-entry route remains idempotent and imports legacy chat once.
- Preserve title on explicit role switches and represent the switch in the message graph; keep permission unchanged. Scene-specific tool enforcement is the following gate, completed before any deployment.

## TDD and validation

1. Write authenticated HTTP tests: two new conversations in one area have different IDs, same area and reusable default role; independent histories are separated; foreign/missing areas and roles are rejected. Observe route/metadata RED before implementation.
2. Implement migration and shared area creation/opening path. Run focused GREEN plus existing area migration tests (adapt pre-metadata comparison to verify original fields, graph and charges).
3. Test multi-area/hidden role/archive behavior and migration replay. Review all changed lifecycle paths; full tests, fmt, configured Clippy and diff before commit.

Files: backend `migrations/0040_tavern_conversation_scenes.sql`, `src/tavern.rs`, `src/tavern/store.rs`, `src/tavern/learning_areas.rs`, `src/tavern/tree_connection.rs`, `src/http/tavern.rs`, `tests/tavern_http_sidecar.rs`. Frontend metadata and page consumption follow once the protocol is green.
