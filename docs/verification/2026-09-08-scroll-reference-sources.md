# Landing scroll reference sources

This file records the external references used by the landing scroll implementation without changing the shared `docs/THIRD_PARTY_NOTICES.md` while the Earth work is being reconciled.

## Gridmorphic scroll scene

- Reference: [Gridmorphic scroll scene CodePen](https://codepen.io/gridmorphic/pen/WbQPRwv).
- The inspected source supplied the structural reference for a left chapter column, a pinned right media stage, one wrapper per image, and a GSAP `ScrollTrigger` with `scrub: true`.
- The inspected source also supplied the vertical image mask transition. MapFlow implements its own React/SVG map layers and its own `inset(top 0 0 0)` mask; it does not copy CodePen assets, text, or source code.

## GSAP / ScrollTrigger

- Runtime dependency: `gsap` `3.15.0` from `package.json` / `package-lock.json`.
- Imports used by the landing story: `gsap` and `gsap/ScrollTrigger` in `src/features/landing/LandingStory.tsx`.
- Official project: [GSAP](https://gsap.com/).
- API reference: [GSAP ScrollTrigger documentation](https://gsap.com/docs/v3/Plugins/ScrollTrigger/).
- Package terms: [GSAP standard license](https://gsap.com/standard-license/). No GSAP source is copied into this repository; the package is consumed as an npm dependency.

## Scope boundary

Lenis is not a dependency. The page owns a nested `.mapflow-landing` scroll root, so native wheel/touch scrolling remains the single input owner while GSAP scrubs the pinned media stage. The implementation and verification details are in [2026-09-08-scroll-reference.md](./2026-09-08-scroll-reference.md).
