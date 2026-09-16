# Landing A→B synchronization acceptance (2026-09-08)

## Scope

This follow-up fixes the landing page's A→B image/copy timing at desktop and mobile sizes. Copy, illustrations, Earth behavior, console behavior, and product wording were left unchanged.

## Root cause and fix

The opening copy lived in the same natural-flow column as B–E while the media stage started at the story top. CSS `position: sticky` and a GSAP `ScrollTrigger pin` also acted on that stage. During A→B, the whole map was therefore fixed and clipped before the B copy reached its position.

The opening now occupies its own full-width scene. The B–E copy and media stage share the following layout; the stage uses native sticky positioning and `ScrollTrigger` only observes/scrubs progress. The first whole map stays fully revealed while it enters with B, and the vertical mask begins at B→C.

## Red → green evidence

- Structure regression first failed because opening was still inside `.mapflow-story__layout`; after the split, LandingPage and motion checks were green.
- The mask regression first failed because `getStoryTimelineState(0.125)` returned `mediaRevealProgress: 0.5`; after the fix it returns `1` for A→B while B→C remains `0.5` at `0.375`.
- Focused result: **18 tests passed**.

## Browser evidence

| Check | Evidence |
| --- | --- |
| 1440×900 A→B at 519, whole complete | `C:/Users/Administrator/.codex/visualizations/2026/09/08/landing-sync-after-1440-step-1-519-full-whole.png` |
| 1440×900 A→B at 744, copy and media enter together | `C:/Users/Administrator/.codex/visualizations/2026/09/08/landing-sync-after-1440-step-2-744-full-whole.png` |
| 1440×900 B settled at 969 | `C:/Users/Administrator/.codex/visualizations/2026/09/08/landing-sync-after-1440-step-3-969-full-whole.png` |
| 1440×900 B→C mask midpoint | `C:/Users/Administrator/.codex/visualizations/2026/09/08/landing-sync-after-1440-B-to-C-mid-settled.png` |
| 390×844 B centered and settled | `C:/Users/Administrator/.codex/visualizations/2026/09/08/landing-sync-after-390-B-centered.png` |
| 390×844 B with reduced motion | `C:/Users/Administrator/.codex/visualizations/2026/09/08/landing-sync-after-390-B-centered-reduced-motion.png` |
| Fast jump to E then reverse to B | `C:/Users/Administrator/.codex/visualizations/2026/09/08/landing-sync-after-1440-end-fast.png`, `C:/Users/Administrator/.codex/visualizations/2026/09/08/landing-sync-after-1440-reverse-744.png` |

The browser checks also confirmed `pin-spacer=0`, no media-stage transform, correct 390 resize geometry, and readable reduced-motion B state.

## Final checks

- `npm test -- --run`: **39 files / 344 tests passed**
- `npm run typecheck`: passed
- `npm run build`: passed; Vite retained its existing large-chunk warning
- `git diff --check`: passed
