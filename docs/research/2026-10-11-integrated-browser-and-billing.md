# Integrated browser and billing checkpoint

The user's mobile commits `183a744` and `13e3bba` are ancestors of the redesign branch. Origin/main was fetched again before this checkpoint; the user's additional local main commit is also retained. No production deployment was made.

## Actual environment

Built frontend over local HTTPS, forwarded to the actual isolated Canary server on the notebook. The server uses the redesigned Rust code and compiled TypeScript DSH worker, a SQLx disposable database and a test identity. Platform requests use the actual configured provider key privately; no application API/model responses were mocked in these checks. Production accounts, balances and maps were not changed.

Browser checks passed for all four routes, public search/filter visibility, owned map display, creating/restoring an area, opening multiple chats, opening the lazy map, selecting a node, staging/removing its reference and opening the canvas. These navigation/creation actions produced zero `/turns` requests. A custom role created in independent tavern appeared in the learning role selector; creating it did not send a message. Mobile chat showed no horizontal page overflow and retained the compact toolbar and operation menu.

Actual acceptance reproduced missing navigation in the mobile area selection layer. RED/GREEN coverage now preserves its operation menu. Other behavioral fixes: history navigation while a bound request continues, collapsed learning canvas on entry, read-only archived canvas and reference removal after recovery of a committed response.

## Three actual billed requests

| Scene | Actual tools/behavior | Input / output tokens | Cache hit / miss input | Site charge |
|---|---|---:|---:|---:|
| Management | `list_personal_maps`, two owned titles, no full tree | 4,921 / 111 | 2,304 / 2,617 | ¥0.001714 |
| Learning | Missing node returned structured `not_found`; Agent corrected to the real node, read only description, then `read_canvas` and `apply_canvas_patch` | 23,303 / 1,087 | 16,768 / 6,535 | ¥0.005688 |
| Independent tavern | Custom role explains a concept; uses product help/own tool records and states private learning notes are unavailable | 2,066 / 952 | 512 / 1,554 | ¥0.002418 |

Token counts include each request in the multi-step Agent loop; they are not a claim that one prompt contained 23,303 tokens. All three returned streamed process/answer events, completed, and persisted one generation and one charge each. Total site charge: **¥0.009820**.

The manual Rust receipt audit queried the disposable database and passed: all three charge amounts equal the ceiling of recorded actual provider cost × 2 in microyuan; each references exactly one matching debit ledger entry; no charge is capped. Balance changed from ¥10 to ¥9.990180. This verifies actual settlement, rather than deriving charges from advertised token prices.

The node failure persisted tool name, `reading` phase, `nodeId`, exact attempted ID and detailed `not_found` result. The Agent received it and continued; it did not abort the conversation. Reopening the actual learning history loaded the saved five-element diagram (three labels, two arrows), canvas revision 2. Independent tools did not access a learning map/history.

## Automated gate and limits

Complete frontend: **654 passed / 1 skipped**; TypeScript and production build passed; diff whitespace check passed. Baseline bundle-size warnings remain. Local ignored artifacts include RED/GREEN logs, desktop/mobile screenshots, SSE receipts and private fixture files. Backend manual host/receipt tests are opt-in and never run against a production database.

This is an integration checkpoint, not completion of the redesign. Confirmed note/progress write tools, migration clone invariants, remaining historical-role presentation, whole-branch review and final integration/release approval still need completion. Ordinary browsing checks and the three charged requests do not substitute for those gates.
