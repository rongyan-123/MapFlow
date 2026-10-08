# Learning-area client contract plan

Part of the approved four-interface refactor. User has authorized implementation; this client prepares the selection page without changing navigation or deploying.

## Scope and checks

- [x] Add HTTP contract tests through exported client operations: owned area envelopes, explicit idempotent creation, abort propagation, CSRF and authentication errors, malformed data rejection. Run before implementation and record the missing-operation failure.
- [x] Add typed learning-area client operations to the existing authenticated Tavern client, reusing its request/error validation rather than introducing a second transport. The API root for areas is `/api/me/learning-areas`.
- [x] Run focused tests, full frontend tests and TypeScript; inspect diff before commit. Interface: `{areaId, libraryEntryId, title, available, createdAt}` with one area per map, both identifiers equal. Listing never creates a conversation.

Files: `src/features/tavern/types.ts`, `src/features/tavern/tavernClient.ts`, new `src/features/tavern/learningAreas.test.ts`. No changes to wallet or model requests.
