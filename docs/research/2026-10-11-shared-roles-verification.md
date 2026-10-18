> 历史记录：本页记录 2026-10-11 的范围和结果。当前代码、生产身份与操作入口请先读[当前文档](../current-release.md)；本文不能单独作为现在的发布指令。

# Shared role interactions checkpoint

Approved redesign, isolated and unpublished.

- Five user-visible failures observed before implementation: current-role-only history, import replacing the selected story/draft, independent role selection creating a story, missing explicit role switching and missing role-change markers.
- GREEN: all-role history with an independent filter and retained active option; import/create updates the shared library plus explicit Use action and account-local unread notice, without changing story or draft; role selection changes the current story through its versioned endpoint; New conversation is the explicit creation action.
- Role-change records are parsed at the HTTP boundary and rendered only on their visible history path. A continuation across a role change remains separate. Its order test failed before the fix, then passed. Markers remain outside model messages.
- Archived area generation controls and execution are disabled while history remains visible; RED → GREEN at the composer and regenerate controls. Account-separated notices and hidden-card history covered.
- Superseded one-click creation/current-role-only tests now exercise explicit creation/filtering while preserving original duplicate creation, late-read, vocabulary and greeting assertions.
- **636 frontend tests passed / 1 skipped**, 67 files; TypeScript, production build and diff whitespace check passed. Existing Vite large-chunk warnings remain.

Management directory/tutorial tools, full history navigation layout, generation ownership, browser and real paid acceptance still belong to the active goal. No release or shared-main mutation.
