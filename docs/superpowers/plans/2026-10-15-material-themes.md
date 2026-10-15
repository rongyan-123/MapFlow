# Material Themes Implementation Plan

> **For agentic workers:** Apply the confirmed visual specification task by task. Root owns shared UI implementation; independent artwork and read-only audits may run under dispatching-parallel-agents without overlapping file ownership.

**Goal:** Deliver the approved warm-paper light theme and graphite dark theme throughout MapFlow, with working desktop/mobile previews.

**Architecture:** Extend the existing semantic CSS tokens and current React presentation components. Preserve routing, actual API data, global-assistant responsibilities and existing viewport/graph geometry. Migrate legacy theme preferences with a small independently tested change.

**Tech Stack:** React18.3, TypeScript5.5, Vite5, existing CSS/SVG and Vitest2; no UI framework replacement or new runtime dependency.

**Spec:** `docs/specs/2026-10-15-material-themes-design.md`

## Global Constraints

- User approved A light + B dark; interface brand accents are copper and lavender, with no green brand/decoration.
- Normal text contrast >=4.5:1; visible keyboard focus; mobile touch targets >=44px; mobile header52px.
- Graph nodes remain240×104; original viewport/keyboard adaptation and single global conversation remain functional.
- Pure CSS/HTML/SVG changes are exempt from TDD under the supplied AGENTS.md. Theme preference behavior uses RED→GREEN; existing full regression suite still runs.
- Reuse `C:/Users/Administrator/.codex/worktrees/b869/MapFlow-publish`; preserve all worktree/session paths and fixed clean main directories.

## Review Focus

1. Legacy `ivory/blue-gray` preferences and cross-tab updates resolve to the correct new theme.
2. At320px or with a500px viewport, welcome art, dialogs and keyboard focus do not hide cards or controls.
3. Dark theme borders, disabled text, muted text, scrims and native controls remain legible.
4. Long real map/role/model names preserve actions and fixed map-node geometry.
5. Empty/loading/error/account/admin states use actual existing data and permissions rather than decorative invented records.

### Task 1: Theme contract and reusable visual assets

**Files:** `src/domains/identity/useTheme.ts`, its existing test, theme label callers; new `src/ui/BrandMark.tsx`, `src/ui/WelcomeArtwork.tsx`, `src/ui/brand-art.css`, optional generated decorative asset under `src/assets/mapflow/`.

**Interfaces:** `useTheme()` still returns `{theme,setTheme}`; canonical values are `light/dark`. BrandMark and WelcomeArtwork consume only optional CSS class names and emit decorative presentation.

- [x] Run existing full suite before edits; save output in this task's evidence directory.
- [x] Write legacy-preference and cross-tab normalization expectations; run the theme test and observe the missing mapping fail.
- [x] Implement canonical two-theme choices and migration; rerun theme and affected settings tests to green.
- [x] Create and inspect folded-route branding and paper/graphite art, keeping text and controls native HTML.

Validation: meaningful preference tests, current settings/account tests, typecheck, direct asset inspection. Artwork creation and read-only color audit have separate ownership from root's shared components.

### Task 2: Shared surfaces, navigation, forms and all page presentations

**Files:** `src/ui/tokens.css`, `layout.css`, `primitives.css`, `pages.css`, `AppFrame.tsx`, `MapCard.tsx`, `src/pages/LandingPage.tsx`, `IdentityPage.tsx` where needed, conversation/global-assistant styles and presentation, admin/support styles as required.

**Interfaces:** Existing `--mf-*` variables retain semantic meaning; add surface/elevation/display-font/ambient tokens consumed consistently by page CSS. Existing navigation callbacks, form handlers, dialogs, map and chat controllers retain signatures.

- [x] Define both palettes, surface and typography scales, focus/pressed/loading states and reduced-motion behavior.
- [x] Apply route branding and layered sidebar/header/navigation, preserving layout breakpoints.
- [x] Refine global assistant title, decorative welcome, question card markup and composer; preserve actual question text selection and handlers.
- [x] Refine map cards/canvas/nodes, home/auth, chat/roles/dialogs and account/model/admin data views.
- [x] Run affected component tests, typecheck and build; inspect current diff for behavioral changes outside the theme migration.

Validation: Vitest regressions and built preview against the existing isolated real API. Check map-node geometry and preserved model/account/payment controls in actual pages.

### Task 3: Browser acceptance, complete checks and handoff

**Files:** browser evidence under `D:/tmp/mapflow-ui-material-themes-20261015/`; tracked final acceptance record under `docs/research/`.

- [x] Inspect both themes at320/390/768/1024/1440 and390×500; include representative long content and all page groups.
- [x] Click navigation, theme controls, model/role/admin dialogs and question cards; verify no question-card auto-send.
- [x] Read screenshots and measure header height, overflow, card/composer clearance, focus and representative computed contrast.
- [x] Fix observed issues, run the final full suite/typecheck/build, then obtain fresh review of the whole branch.
- [x] Commit reviewed changes and provide the actual local preview URL plus desktop/mobile screenshots for user acceptance.

Validation: complete test logs, actual screenshots and a bounded written account of any environment limitations. Production and fixed main updates await the user's release instruction.
