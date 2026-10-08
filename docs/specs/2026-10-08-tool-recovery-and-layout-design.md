# Unified tool results and durable conversation diagnostics

Approved by the user on 2026-10-08. Commit this audit and plan before implementation.

## Problem and outcome
Tool validation and execution failures currently lose their specific cause or abort the model loop. Successful conversation transactions contain process history, but failed attempts have no independent durable tool history. Keep authorization and mutation confirmation; return detailed failed tool results to the model so it can correct its request or explain the failure, and persist all tools through one independent channel.

## Scope
Backend tool execution, granular tree reading, canvas validation, direct model loop, DSH bridge and native tools, independent attempt/tool storage, crash-safe local journal and replay, account/conversation-scoped history reader, failed-attempt recovery, and request diagnostic integration. Existing billing remains actual model receipts times two, once for a completed generation; failed whole generations do not debit site cash. No new repair prompt and no automatic replay of side effects.

Retained interface work: draggable tree/workspace and canvas/chat boundaries with persisted constrained widths; a prominent canvas shortcuts button and opaque dialog with primary/secondary customizable bindings. Definitive failed attempts must allow editing and subsequent conversation without losing diagnostics.

## Sequence and verification
1. Preserve this plan and the evidence audit in git. Verify clean status and commit IDs.
2. Reproduce an invalid tool invocation through the model conversation boundary. Write a failing test proving the next model step receives the call ID, field and original cause, then implement result forwarding. Verify corrected invocation, normal answer and once-only settlement.
3. Replace ambiguous validation outcomes with structured field/rule/expected/actual diagnostics across canvas and tree tools. Test invalid JSON, missing resources, revision conflicts, revoked permission, cancellation, search/network errors and excessive results. Never weaken ownership checks.
4. Record attempt start and every tool start/result independently of successful chat commits, including native DSH calls. Preserve error name/message/source and stage after secret redaction. Test failure, partial answer, committed mutation followed by model failure and cancelled/interrupted attempts.
5. Add a durable journal before asynchronous database writing. Replay records idempotently after restart; replay logs only. Test unavailable database, duplicate replay and process interruption. Expose bounded account/conversation-scoped history to the model and detailed records to administrators.
6. Keep tool/time budgets bounded and provide a final-answer opportunity. Test recoverable tool failure, exhausted budget and irrecoverable model failure. Preserve partial output and do not force a response from an unavailable model.
7. Implement retained layout and shortcut interfaces with behavioral tests for persistence, conflicts, reset and typing exclusions. Verify browser resizing, narrow screens and no whole-tree layout recomputation on drag.
8. Run complete configured tests and type/lint checks, review every diff, commit and merge into current main, then deploy with database backup, isolated acceptance and public health checks.

## Evidence and limits
Request 65ae4cef-087d-43a9-a21e-973ecdb1cbfb has a persisted generic protocol failure and zero successful generation/cash debit in the failed interval. Its original failed tool name/arguments were not retained; do not invent a historical cause. The previous successful canvas operations do not identify the later failure. New tests must reproduce controlled failures rather than claim recovery of missing historical data.

## Data and security
Detailed execution diagnostics are for the owning conversation and administrators. Public terminal errors remain concise and do not expose providers, credentials or database details. The model receives useful structured tool failures with secrets redacted, not a generic replacement. Keep call IDs, request IDs, attempts and observed side effects distinct; do not report unknown effects as rolled back. Logging failure must not erase the primary failure or silently drop records.
