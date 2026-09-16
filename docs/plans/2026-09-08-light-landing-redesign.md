# Light landing redesign spec (2026-09-08)

## Goal and boundaries

Make only the marketing landing page warm, light, and readable on mobile. Keep the current landing copy, Earth interaction contract, console route, identity flow, and public read-only APIs intact. No console component receives a new visual theme.

## Implementation plan and verification

1. **Light visual foundation.** Add landing-scoped warm white/pale cyan surfaces, charcoal text, teal accents, restrained shadows, and a light Earth/fallback treatment. Keep the opening concept and copy; reduce CRT scanline contrast and flash. Verify with a fresh 1440×900 and 390×844 opening capture and the existing landing tests.
2. **B/C media replacement.** Render `public/landing/course-overload.webp` for B and `public/landing/direction-crossroads.webp` for C. Desktop keeps the B–C sticky media stage and vertical mask, with the first B image fully present during A→B and the mask beginning at B→C. Mobile renders each image inside its own natural-flow scene so a previous image cannot cover D. Add motion helper/component assertions for layer timing and image semantics. A missing asset blocks final visual acceptance; it is not replaced with a fake placeholder.
3. **D read-only public map demo.** Add a landing-only `LandingPublicMapDemo` that reads the public catalog/detail through `fetchPublicTrees` and `fetchPublicTree`, prefers the Python Agent public tree, and converts its graph into the existing `LearningTreeSnapshot` shape. Reuse `SkillTreeCanvas` with showcase mode, a light surface, and an initial fit around a small real branch cluster; node selection opens a local read-only explanation panel. No POST, completion, chat, personal-library, or credit call is reachable. Verify loading, API error/retry, node selection, drag/zoom, and zero write requests. The scene uses this real public tree, so no third static parchment image is generated.
4. **E closure and CTA.** Replace the duplicate right graphic with centered three-line direction / learning map / anywhere copy and short AI/MCP clarification. Add the jelly CTA with bounded pointer tilt, press feedback, keyboard focus/Enter, touch feedback, and reduced-motion bypass. Verify click, keyboard activation, mobile press, and reduced-motion behavior.
5. **Acceptance.** Run focused red→green tests for new logic, then the full test suite, typecheck, build, and diff check. Use Browser Harness for 1440×900 and 390×844 A/B/C/D/E frames, A→B and B→C midpoints, B/C→D and D→E transitions, public-map interactions, no-write network evidence, reverse scroll, resize, mobile scroll, and reduced motion. Do not commit until the parent reviews the main desktop screenshots; do not push or deploy.

## Self-audit before implementation

- Changes stay in landing components/styles, landing tests, the read-only demo adapter, and public landing assets.
- `App.tsx`, console route behavior, personal progress mutations, chat, and billing remain untouched.
- The existing sticky/clip timing fix remains the source of truth; B/C media changes cannot reintroduce an early fixed layer or a second pin owner.
- Real image files must exist at the two agreed public paths before claiming visual completion.

## Approved image sources

The two approved images were generated with the built-in imagegen tool. The
original outputs are preserved outside the repository under
`C:/Users/Administrator/.codex/generated_images/01a07a75-994c-7fe3-89a2-6c5a15c35843/`.
The source files are `exec-ef5976b9-67ac-4b47-84bf-9b6287d25666.png` (B) and
`exec-bfe1fc52-f1eb-44e3-a452-a0b3bc34e71e.png` (C). The repository contains
only the consumed WebP outputs:

- `public/landing/course-overload.webp` (1448×1086)
- `public/landing/direction-crossroads.webp` (1448×1086)

`scripts/prepare_landing_assets.py` is a parameterized, credential-free
converter. It accepts `--course-source`, `--crossroads-source`, and an
optional `--output-dir`, preserves the 4:3 framing without cropping, and
writes WebP at quality 90. No temporary Browser Harness script or machine
session data belongs in the repository.

The prompts called for a single 4:3 image on a light background in both
cases:

- **B course overload:** one dense, messy collage of 25+ varied Chinese Java,
  Python, Agent, frontend, backend, Go, and Linux course covers, with a high
  density of blue, cyan, yellow, and red.
- **C direction crossroads:** restrained light cream paper-art terrain viewed
  obliquely, with one backpacked person at the same starting point facing six
  clearly signed routes for Agent development, backend, frontend, operations,
  data engineering, and mobile development.

No third static parchment/羊皮纸 asset was generated: D is the real,
read-only public map preview.
