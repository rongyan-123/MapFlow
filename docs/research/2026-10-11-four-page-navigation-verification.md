# Four-page navigation checkpoint

Isolated approved redesign, not published. User mobile commits `183a744` and `13e3bba` retained.

- Actual `/library`, `/maps`, `/learning`, `/tavern` pages. Public search/filters preserved; personal maps no longer mount a chat. Auxiliary identity/admin/theme/wallet/models remain reachable through desktop and compact mobile menus.
- RED → GREEN: direct pages, area selection/restoration, explicit-area priority, management within selection, invalid membership, archive history, node reference without automatic generation, scene-owned management new/history, legacy console restoration and canonical admin return.
- RED → GREEN: map position survives remount, is separate by account/map/layout and ignores obsolete revisions. Learning map loads only when requested; opening a drawing releases it, opening the map collapses a drawing. Desktop divider changes panel CSS, not tree layout state.
- Full frontend: **627 passed / 1 skipped**, 67 files, three workers. TypeScript and production build passed; existing Vite chunk-size warnings remain. `git diff --check` passed.
- Companion backend: replay-safe area creation `92a508a` (783 tests); owned management conversations `05d217e` (785 tests), fmt/configured Clippy passed.

Ruling: superseded canvas test asserted the editor stays mounted after collapse. The approved redesign requires lazy heavy renderers; its replacement verifies unmount/reopen while canvas document/autosave remains in the owning hook. Cost: editor-local selection is recreated on reopening; saved drawing data is retained.

Browser/real API acceptance is a final integration gate after role interactions, management tools and generation ownership. This checkpoint proves the UI/API contracts, not deployment or the completed redesign.
