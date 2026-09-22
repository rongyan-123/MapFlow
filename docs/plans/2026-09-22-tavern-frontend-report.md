# Tavern frontend handoff — 2026-09-22

## Status for main agent

- Frontend implementation complete in `C:/Users/Administrator/.codex/worktrees/tavern-20260922/frontend`, branch `codex/tavern-mvp-20260922`.
- Full frontend suite: **44 files / 388 tests passed**, including the external pinned PNG. Typecheck and production build passed. Frontend is ready for main's integrated UI acceptance; the scoped frontend commit contains this report.
- Real Chromium frontend smoke passed: authenticated `/tavern`, local PNG preview/avatar, ordinary conversation, 24 nature/forest vocabulary terms, five completed learning turns plus a long-message sixth turn, error/retry across reload with stable clientTurnId, restored history, four themes, desktop 1440px and mobile 390px/320px, no horizontal overflow or browser page errors.
- This smoke uses deterministic HTTP responses. It does **not** prove live backend/LLM generation, persistence, real charges, 300-second TTL recovery, or narrative/vocabulary quality. Main owns integrated acceptance.
- Real Seraphina: SHA-256 `8a71e8270f54fafbccf905b1bdf053a6a55f57bea89c01fcd8c0e87ee76a2d52`; **551,901 source bytes, 13,386 normalized JSON bytes, 34 warnings, all 4 plain-key lore entries retained**. Embedded V2 `chara` and V3 `ccv3` normalize identically apart from the actual PNG/JSON source container.
- `use_regex:true` alone does not disable lore. `/pattern/flags` keys are safely ignored with structured paths; literal keys remain. `selective:true` with empty secondary keys is retained for the corrected backend semantics. Regex-only required conditions omit the entry with a warning to avoid broadening triggers.
- Changes remain confined to `src/features/tavern/**`, `src/App.tsx`, `src/App.test.tsx`, and this report. The implementation plan and original `D:/MapFlow-publish` source are untouched. No subagents were used.

## Scope implemented

Local V1/V2/V3 JSON and PNG normalization, CRC/bounds checks, chara/ccv3 precedence, Unicode, unsupported-feature reports capped at 256 including an overflow summary, safe bounded warning paths, and server field limits. Import preview preserves the original source file and treats imported markup as text. Authenticated same-origin HTTP requests use CSRF for mutations; SSE accepts only a validated committed `completed` event as success.

The page reuses identity, credits, theme switching and mobile drawers. It includes role import/removal, preserved history after role removal, selected opening, optional Persona/vocabulary, immutable conversation details, account-scoped selection restoration, persisted pending-turn IDs, streaming drafts/errors, and same-ID retry after reload. Stale in-flight reads are cancelled on successful mutations/completion so they cannot revert new characters, conversations, turns or credit balances.

## Validation so far

- Initial WIP: 5 files / 105 relevant tests passed; typecheck failed on ES2020-incompatible `.at()` in App.test. Replaced with indexed access; did not change compiler settings.
- Red → green reproduced: stale history overwrite; stale balance overwrite; stale character import/removal lists; stale conversation creation list; unbounded warnings; unsafe/oversized warning paths; seven server schema bounds. Corrected regex-key semantics were verified red → green against both synthetic cards and the actual pinned PNG.
- Full suite command: `$env:TAVERN_CARD_FIXTURE='../acceptance/default_Seraphina.png'; npm test` — final run at 15:14:37 Asia/Shanghai: 44/44 files, 388/388 tests, 35.72 seconds, exit 0 (previous full run also passed in 31.38 seconds). This final run includes additional assertions for regex-only secondary filters and constant lore. The fixture test skips unless the environment variable is provided; no third-party content is checked in.
- `npm run typecheck` — exit 0.
- `npm run build` — exit 0; Vite 5.4.21 transformed 898 modules and built in 5.58 seconds. Outputs: CSS 100.34 kB (gzip 18.05), main JS 893.67 kB (gzip 273.61), SkillTree3D JS 878.04 kB (gzip 238.91). Vite emitted the >500 kB chunk-size advisory; no build errors. No lint script is configured.
- Browser command: set `TAVERN_CARD_FIXTURE` to the external PNG, `TAVERN_PLAYWRIGHT_MODULE` to an installed Playwright module URL when it is not on the package path, optionally `TAVERN_SCREENSHOTS` to an external directory, then run `node src/features/tavern/browserAcceptance.mjs` against local Vite (`TAVERN_BASE_URL`, default `http://127.0.0.1:5186`). This machine used `file:///D:/Python/python3.13.5/Lib/site-packages/playwright/driver/package/index.mjs` (Playwright 1.60.0). Exit 0; no page errors.
- Browser screenshots are local-only at `../acceptance/frontend-browser/`: real PNG preview, dark/ivory desktop, ivory 390px/320px mobile, long mobile message. They are not shipped.
- Desktop import/dark chat and 320px ivory screenshots were also visually inspected: avatar, plain-text card content, compatibility warnings, message bubbles and composer render correctly without horizontal overflow. `git diff --check` passed.

## Integration notes / limits

- HTTP/schema contracts follow the main-owned implementation plan without editing it. Main's empty-secondary-key Rust correction is needed to activate Seraphina's selective plain-key lore.
- Official regex syntax reference: [SillyTavern World Info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/). Advanced lore extensions remain explicitly unsupported; successful import does not claim complete SillyTavern feature compatibility.
- Source card remains outside the repository at `../acceptance/default_Seraphina.png`, from official ST commit `06bde939fb1e9c4c8d8641d810f0a916b5bce127`. Card licensing is not inferred from the program license.
- Refresh retry persistence uses account/conversation-scoped sessionStorage. Browsers denying storage retain same-ID retry only while the conversation pane remains mounted. Completed history is server-owned.
- Learning terms used: forest, canopy, glade, moss, fern, brook, stream, root, branch, bark, leaf, grove, meadow, shelter, wildlife, deer, owl, dawn, dusk, moonlight, trail, clearing, bloom, whisper.
