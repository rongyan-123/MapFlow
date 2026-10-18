> 历史记录：本页记录 2026-10-11 的范围和结果。当前代码、生产身份与操作入口请先读[当前文档](../current-release.md)；本文不能单独作为现在的发布指令。

# Scene-aware chat UI verification

Continuation of the approved four-page redesign; not a release claim.

- Integrated mobile main commits `183a744` and `13e3bba` into the isolated redesign branch. Retained compact mobile header/actions and composer. Resolved only the two overlapping toolbar hunks.
- RED → GREEN at the user/HTTP boundary: area history requests, atomic area creation, preserved tools-off, busy protection, same-payload/key retry after lost response, archived history without creation, and no independent restoration of a learning ID.
- RED → GREEN: a cached learning detail and a mixed historical catalogue could briefly render in the independent tavern while loading. Membership, list and detail are now filtered by scene before display.
- Fixed-area tool settings have no map picker or personal library request. Independent tavern does not render those settings; drawing remains separate.
- Existing App test mocks now represent the actual scene/area contract. Superseded linking tests keep their original recovery/permission intent through the atomic endpoint; old shared-history expectations now assert separation required by the approved design.
- Complete frontend suite: **609 passed / 1 skipped** in 66 files, bounded to three workers. TypeScript and production build passed. Existing Vite large-chunk warnings remain.
- Companion backend request replay test passed; full backend regression is still running. No deployment or shared-main mutation occurred.

Four page integration, role filter/import indicator, management tools, rendering/state ownership and real API/browser acceptance remain on the active long-running goal.
