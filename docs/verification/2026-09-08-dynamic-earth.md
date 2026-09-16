# Dynamic Earth verification — 2026-09-08

## Scope

This verification covers the landing Earth background's dense flight layer, its independent animation loop, reveal lifecycle, interaction state, reduced-motion behavior, and the responsive flight budgets.

The flight records are derived from [`jeantimex/flights-tracker`](https://github.com/jeantimex/flights-tracker), upstream commit `b3be3ae5943103c01b25953cd5c25bb3d9a6296d`. The packed resource contains all 34,297 upstream records (`departure`, `arrival`, and `speed`) in [`public/flights/flights.json`](../../public/flights/flights.json). The MIT attribution and the reviewed upstream files are recorded in [`docs/THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) and [`src/features/landing/earth/LICENSE`](../../src/features/landing/earth/LICENSE).

## What was reproduced and changed

The old implementation was reproduced at the fixed C-scene camera twice with the same scroll position. Its five static `THREE.Line` routes were visually unchanged; only the star shader shimmer changed. There was no flight position state or time progression.

The new renderer uses the upstream flight records and source-like path behavior: elevated great-circle-style paths, per-flight duration derived from source speed, destination waits, reversal, a moving head point with a small aircraft silhouette, and short trailing particles. Flight positions are updated from `requestAnimationFrame` time and do not depend on page scroll or Earth self-rotation.

The deterministic geographic sampler takes records round-robin across global departure latitude/longitude buckets. It therefore retains worldwide coverage instead of selecting the first records from `Data.js`.

| viewport budget | active flights | path points | trail particles per flight | route segments | trail particles |
| --- | ---: | ---: | ---: | ---: | ---: |
| phone (<=640px) | 900 | 16 | 4 | 7,200 | 3,600 |
| tablet / high-DPR | 1,600 | 20 | 5 | 16,000 | 8,000 |
| desktop | 2,800 | 24 | 6 | 33,600 | 16,800 |

The renderer is rebuilt only when a resize crosses a budget boundary, while the Earth rotation and zoom state stay in the existing interaction ref. A hidden A scene does not fetch or construct the dense renderer. After reveal, the static Earth can paint first and the flight layer is installed once the packed resource is parsed.

## Fixed-camera motion evidence

The following desktop run used browser-harness on the local Vite tab, a 1441×900 viewport, DPR 1, no-preference motion, and `.mapflow-landing.scrollTop = 2500`. Both screenshots were captured without changing the camera or scroll position.

| sample | scrollTop | renderer frame | elapsed flight time | motion signature |
| --- | ---: | ---: | ---: | --- |
| first | 2500 | 2,688 | 19.967s | `-1.25192,-0.88213,0.43199` |
| second (+1.5s) | 2500 | 2,934 | 21.788s | `-1.25983,-0.90823,0.42386` |

The changed signature is the first flight head position, not Earth rotation. The run reported 2,800 active flights, 34,297 source records, 33,600 route segments, and 16,800 trailing particles. The observed RAF interval average was 7.97ms; this is a compositor scheduling interval, not a GPU render-time or guaranteed FPS claim. Startup and browser scheduling stalls are not hidden behind an FPS claim.

Screenshots from that run:

- [`mapflow-dense-earth-optimized-first.png`](C:/Users/Administrator/AppData/Local/Temp/mapflow-dense-earth-optimized-first.png)
- [`mapflow-dense-earth-optimized-second.png`](C:/Users/Administrator/AppData/Local/Temp/mapflow-dense-earth-optimized-second.png)

The earlier final desktop and phone captures are also available at `C:\Users\Administrator\AppData\Local\Temp\mapflow-dense-earth-final-1.png`, `mapflow-dense-earth-final-2.png`, `mapflow-dense-earth-mobile-final-1.png`, and `mapflow-dense-earth-mobile-final-2.png`.

## Lifecycle and interaction checks

- Hidden A scene: after a fresh desktop load, 2.1s of hidden time produced no flight frame, elapsed time, or RAF diagnostic. This prevents the dense JSON parse and renderer construction from blocking the opening scene.
- Reveal: after scrolling to the same fixed scene position, the desktop renderer reported the full 2,800-flight budget; this run measured 21.2ms through packed JSON parsing and 134.8ms through renderer installation. The synchronous construction remains a bounded reveal-time cost and is recorded rather than presented as a frame-rate guarantee.
- Hidden again: the animation controller cancels the pending RAF. A single resize/interaction/asset-load render remains available, but flight elapsed time and particle positions do not advance while hidden.
- Reduced motion: the renderer stays at a static sampled position; elapsed flight time remains zero and the motion signature is unchanged over the observation interval.
- Drag: a horizontal pointer drag changed the stored Earth rotation while scroll and zoom stayed unchanged.
- Zoom: Ctrl+wheel changed zoom from `1.00` to `1.18`; ordinary wheel input did not change zoom. Hiding and revealing the Earth retained the zoom value and interaction state.
- Canvas scroll forwarding: on a real 390×700 touch-emulation run, the C-scene root moved from `1750.8` to `1800.8` after a 200→150 upward move and to `1860.8` after the next 150→90 move. A normal wheel over the canvas moved the root from `1750.8` to `1822.5` while zoom stayed `1.00`; Ctrl+wheel remains reserved for Earth zoom.
- Input intent: single-finger touch/pen vertical scrolling locks the gesture in scroll mode, so a later horizontal movement cannot rotate the globe. A left-button mouse drag enters rotate mode immediately, including a purely vertical drag; a desktop check changed rotation X from `-0.1400` to `-0.5400` while scroll stayed `2500`.
- WebGL fallback: the static SVG fallback no longer renders the WebGL-only controls or interaction hint, which avoids exposing buttons that cannot change the fallback image.
- Flight data cancellation: the dense data request receives an `AbortSignal` and cleanup aborts it before renderer disposal. Abort is treated as normal teardown; other fetch failures leave the static route layer available.
- Non-square viewports use the measured canvas width and height for the PerspectiveCamera aspect, preserving the spherical projection.

## Automated verification

The new lifecycle policy has direct unit coverage in [`LandingEarthBackground.test.tsx`](../../src/features/landing/LandingEarthBackground.test.tsx), and flight sampling/renderer behavior is covered in [`flightMotion.test.ts`](../../src/features/landing/earth/flightMotion.test.ts).

```text
npm exec vitest run src/features/landing/LandingEarthBackground.test.tsx src/features/landing/earth/flightMotion.test.ts
19 passed

npm run typecheck
passed
```

The parent reran the final integrated suite: `37` test files and `329` tests passed. `npm run build` passed, including the TypeScript check; Vite emitted its existing warning that the main JavaScript chunk is larger than 500kB. The continuous touch regression includes pointer-down followed by three pointer-moves and checks the accumulated scroll distance. Final independent browser evidence is in [parent acceptance](2026-09-08-parent-acceptance.md).
