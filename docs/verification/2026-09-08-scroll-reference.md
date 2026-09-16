# Landing scroll reference verification (2026-09-08)

## Scope

This note records the scroll narrative refactor in `LandingStory`, its motion helpers, and the scoped landing CSS. The reference is the [Gridmorphic scroll scene CodePen](https://codepen.io/gridmorphic/pen/WbQPRwv), checked against its HTML/CSS/GSAP source rather than only its screenshot. Earth rendering, CRT rendering, and the workbench remain outside this note.

> **Follow-up architecture note (2026-09-08):** the pin-based MapFlow layout described in the original version of this note has been superseded by the A→B synchronization fix. The current acceptance is recorded in [landing-sync-acceptance](./2026-09-08-landing-sync-acceptance.md). The opening scene now exits as an independent full-width section; the B–E media stage uses native sticky positioning, and `ScrollTrigger` observes progress without pinning the same element a second time.

## Reference architecture and the MapFlow implementation

The reference has a left column of chapter content and a right media stage. The right stage is pinned for the chapter track with `ScrollTrigger` (`trigger: ".arch"`, `start: "top top"`, `end: "bottom bottom"`, `pin: ".arch__right"`, `scrub: true`). Each image wrapper occupies the same fixed stage and uses a vertical `clip-path` reveal, so the current image remains a complete base while the next image enters from the lower edge. Its mobile branch removes the pin and lets the chapter content flow naturally; MapFlow keeps the same shared stack while its mobile CSS/native scroll layout avoids a second scroll owner.

MapFlow follows the reference's shared media-stack idea while using the following current structure:

- `src/features/landing/LandingStory.tsx`: `mapflow-story__opening` owns the full-width opening viewport; the B–E `mapflow-story__copy-column` and `mapflow-story__media-stage` share the following layout. The stage is native `sticky`; `ScrollTrigger.create` only scrubs the same progress used by the copy and Earth callback, so there is no competing CSS sticky/GSAP pin.
- `src/features/landing/landingMotion.ts`: `getStoryTimelineState` maps the one normalized story timeline to four scene-to-scene intervals. At a scene boundary the old base stays complete; inside an interval only the next layer's reveal changes. `getStorySceneProgress` and Earth reveal use this same four-interval coordinate.
- The opening-to-B interval keeps the first `whole` map fully revealed while it enters with B. The vertical mask starts at B→C and remains in force for later transitions.
- `src/features/landing/LandingStory.tsx` / `src/index.css`: `LearningMapGraphic` applies `inset(<top>% 0 0 0)` to the next layer, which reveals it bottom-to-top while the base remains underneath. This is a vertical mask, not the former per-article horizontal clip.
- `src/index.css`: the stage is native sticky, the media stack is absolute and shared, and mobile keeps the map below/alongside the copy without making the stage a touch target. The landing root and scenes deliberately have no native scroll snap so a scrub can stop at every intermediate progress value.

Lenis is not added. The app scrolls inside a nested `.mapflow-landing` element and the product contract gives ordinary wheel and single-finger vertical movement to that root; adding a second smooth-scroll owner would introduce a competing coordinate system. Native scrolling plus GSAP `scrub` preserves that contract. `prefers-reduced-motion` skips `ScrollTrigger` and leaves the DOM/native layout readable.

## Mobile layout corrections

The clarity heading is rendered as semantic spans. On narrow screens the prefix `学了这么多，` starts one line and `我到底` is a non-breaking phrase; the full heading remains the same accessible name through `aria-label`. Non-opening downward hints are hidden on narrow screens so they cannot cover the map legend. The media stage and map layers have `pointer-events: none`; only the copy/CTA restores pointer events, so Earth receives touch input and normal page scrolling remains available.

At `max-width: 860px` and `max-height: 840px`, each scene is exactly `100svh`, rather than being forced to `max(100svh, 40rem)`. This keeps the four timeline intervals aligned with the actual scene tops in short viewports such as 768×600. E keeps only its copy and CTA, so no footer competes with the map legend or steals heading width.

## Reproduction and evidence

The follow-up failure was reproduced at 1440×900 in the A→B interval: the media stage began at the story top while B copy remained in natural flow, and CSS `sticky` was combined with a GSAP `pin`. The next whole map therefore appeared early and was internally clipped before B copy reached its position. The before evidence is `C:/Users/Administrator/.codex/visualizations/2026/09/08/landing-sync-before-1440-step-2-744.png`.

The fixed stack was then checked at the same viewport:

| State | Expected DOM state | Evidence |
| --- | --- | --- |
| A/opening | no active map layer; CRT/DOM copy remains the only readable title | `C:/Users/Administrator/.codex/visualizations/2026/09/08/scroll-fix-1440-opening-final.png` |
| B boundary | base `whole`, next `domain`, reveal `0`; complete base map visible | `C:/Users/Administrator/.codex/visualizations/2026/09/08/scroll-fix-1440-B.png` |
| B→C midpoint | base `whole`, next `domain`, reveal about `0.5`; next map enters from the bottom | `C:/Users/Administrator/.codex/visualizations/2026/09/08/scroll-fix-1440-transition.png` |
| C/D/E boundaries | base advances to `domain`, `mcp`, then `progress`; no blank media stage | `scroll-fix-1440-C.png`, `scroll-fix-1440-D.png`, `scroll-fix-1440-E.png` in the same directory |
| 1440 desktop opening | opening scene spans the narrative width and the CRT/DOM title remains complete on one line | `C:/Users/Administrator/.codex/visualizations/2026/09/08/scroll-fix-1440-opening-final.png` |
| 1920 desktop B | copy-column sizing keeps the clarity heading on one line; `我到底` remains an unbroken semantic phrase | `C:/Users/Administrator/.codex/visualizations/2026/09/08/scroll-fix-1920-B-final.png` |
| 390×844 B | final DOM sample has a semantic two-line clarity heading, full map below copy, and no downward hint over the legend | `C:/Users/Administrator/.codex/visualizations/2026/09/08/landing-sync-after-390-B-centered.png` |
| 768×600 E | heading/copy keep their width; the map legend has no competing visible footer | the earlier E2 capture includes the removed footer and is superseded; recapture with the parent-owned harness |

The parent acceptance run additionally checked forward and reverse 1440×900 progress at 0.1 increments after removing snap; the reveal values advanced continuously from 0 through 0.9 and returned symmetrically when reversed. The parent also owns the touch gesture run; the stage's `pointer-events: none` change is the source-level fix for the earlier `elementFromPoint` media-stage interception.

## Automated checks

The focused landing checks after the layout changes pass:

```text
npm test -- src/features/landing/landingMotion.test.ts src/features/landing/LandingPage.test.tsx --run
18 tests passed
```

Final integrated validation: 39 test files and 344 tests passed. `npm run typecheck`, `npm run build`, and `git diff --check` passed. The production bundle retains Vite's warning about a JavaScript chunk larger than 500 kB. Final visual and input evidence is recorded in [landing sync acceptance](./2026-09-08-landing-sync-acceptance.md).
