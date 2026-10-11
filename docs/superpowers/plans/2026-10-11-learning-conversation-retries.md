# Learning conversation retry protocol

Continuation of approved scene-aware UI. Replace the former create-then-link recovery with an atomic, replay-safe area creation request.

1. Write a real authenticated HTTP test: concurrent identical client request IDs produce one conversation; tools-off is retained; changed input with the same key returns conflict; a new key produces another conversation. Observe unknown-fields / duplicate-ID RED.
2. Add optional clientRequestId and toolsEnabled fields. Persist the request key and canonical request hash on the conversation with an account/area uniqueness constraint. Replays read the owned stored detail; mismatched payload is rejected. Keep older clients and the legacy restore endpoint compatible.
3. Frontend retains one creation payload/key after uncertain failure, locks double clicks, retries that same payload. Commit/cancel is explicit; do not infer ownership from another recent conversation. New learning chat uses only the area endpoint and respects prior tools opt-out.
4. Focused HTTP/UI GREEN, complete suites, fmt/Clippy/typecheck/build, migration/diff review. No production write.
