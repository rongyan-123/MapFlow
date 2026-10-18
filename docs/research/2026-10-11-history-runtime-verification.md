> 历史记录：本页记录 2026-10-11 的范围和结果。当前代码、生产身份与操作入口请先读[当前文档](../current-release.md)；本文不能单独作为现在的发布指令。

# History and request ownership checkpoint

The latest main mobile commits `183a744` and `13e3bba` remain integrated. This checkpoint adds visible scene histories and keeps an owned request alive when the visible chat is unmounted.

Behavioral RED failures covered missing history navigation, aborting a running request on navigation, and failing to cancel the previous account's request on an authenticated account change. Focused GREEN covered 132 tests. The final complete frontend run passed **642 tests**, with one existing skipped test; TypeScript and production build passed. Diff review and whitespace check completed. Vite retains existing large chunk warnings.

Navigation restores the same scoped stream without a second send; background completion updates its original conversation, never the newly visible chat. Stop and account changes cancel the request. A hidden conversation's proposed map write is rejected through the normal approval result: no confirmation is shown on an unrelated visible page. Read-only work and the owning conversation's response can continue.

Scope identity includes account, scene, learning area and conversation; the running binding also records branch and action. No concurrency limit or payment policy is changed. These are automated UI and API-contract checks, not real browser or charged API acceptance. Those integrated gates and the remaining learning-map actions are still pending.
