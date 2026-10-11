# Learning map checkpoint

Observed RED failures: missing owned-map search, delayed area joins redirecting a newer page, a removed node remaining in the URL, editable notes during a pending save, a version reload overwriting a draft, missing learning-map details/progress/reference actions, and an earlier background response consuming a newer area's reference.

GREEN preserves the selected map while filtering its directory; node entry ignores stale view/account/map responses; removing or sending a reference clears only its own URL target. The lazily opened map restores the selected node, uses existing authenticated progress/note endpoints, and stages references without sending or charging. Pending note writes cannot be dismissed, and conflicts keep the typed draft.

Complete frontend regression: **650 passed / 1 existing skipped**. TypeScript and production build passed; a test-only `Array.at` compatibility error was corrected and typecheck rerun. Whitespace and diff self-review passed. No production deployment or data changes. Desktop/mobile browser and real charged API acceptance remain pending.
