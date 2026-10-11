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

## Subsequent learning-write and migration acceptance

The granular note/progress tools now share the existing atomic map receipt/audit transaction. The Agent must read the note version or current progress and map revision, propose one change, then wait for the matching explicit confirmation. Overwrite/deletion use a separate destructive confirmation. Conflicts, rejection and scope boundaries have behavioral tests.

A separate disposable fixture completed one actual learning request: the Agent saved `验收笔记：Session 保存持续的对话，Run 表示一次执行。` at note version 1 and changed the selected node from 0% to 35%. Two approval events were explicitly accepted by the acceptance driver after verifying the exact target and values. Cumulative input/output: 25,394 / 1,431; cache hit/miss: 23,936 / 1,458. One generation and one **¥0.003342** charge were audited against actual provider cost × 2 and a unique debit. This fixture's balance was ¥10 → ¥9.996658; it is not the earlier three-request fixture. Reloading the real browser recovered the saved answer, note and progress without issuing a model turn.

New role switches retain outgoing ID/name snapshots. The frontend uses anchored historical names and keeps unknown legacy names unknown. Note/progress caches refresh only in the permitted learning/management scope. The complete frontend gate now has **665 passed / 1 skipped**, with TypeScript/build green; worker **97 passed / 1 skipped**, types/build green.

Actual 390 × 844 mobile checks clicked model-price navigation from selection, learning and independent menus. The bottom logout action was within the viewport and opened/cancelled its confirmation. No page errors, horizontal overflow or automatic model calls were found.

The production database was copied privately for migration preflight; the source was read-only. An unlinked historical conversation with an enabled tool preference exposed migration 0040's excessive constraint. A regression reproduced it before correction; historical fields remain intact, and server authorization continues to deny learning tools in independent tavern. Actual SQLx admin migrations then ran twice through version 43. Complete original-field fingerprints and row counts matched for **54 original tables**; **66 conversations** became 56 learning / 10 tavern, **45 areas**, with no invalid scopes. The clone and private dump are temporary and are removed after acceptance.

This remains an integration checkpoint. The final repeated backend gate, fresh whole-branch review and concrete integration/release approval are still required. These checks did not deploy or modify production accounts/data.
