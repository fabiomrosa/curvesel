# Roadmap

## The end goal
v1 is a published vanilla library and a demo page: `core` with the Curve layout and its Presets
(cylinder, flat and wavy ribbon, tilted wheel, arc) and the physics, the vanilla engine over the
user's own elements, accessibility basics, and a written answer to the lab's question (does one
parametric curve cover every variant, smoothly?). React and Angular adapters follow v1.

## How to use this plan
- `docs/PLAN.md` holds the full entries of the slices and their status. Slice ids start with the
  repository's prefix: `C` (curvesel). This file is the map, the prerequisites and the order.
- Only the current milestones have slices. A later milestone is split into slices with the owner
  before its first slice starts: ordered by feature, with its prerequisites, and every entry with its
  expected files.
- A slice is one session and one small pull request (SESSION §0).
- The plan changes only with the owner, through a docs pull request.
- A milestone is planned before its first slice and closed after its last (SESSION §7); its heading
  then reads `M<n> · Name · done (YYYY-MM-DD)`.

## M0 · Foundations
The npm workspace with `packages/core` empty, TypeScript strict, format, lint, tests with coverage,
build, and the gate in CI.

| Repository | Slices |
|---|---|
| `curvesel` | C0.1 runnable skeleton |

## M1 · Core
The Curve layout and the physics in `packages/core`, with property tests of the PRODUCT invariants,
and a local playground that draws the Curve and grows with every slice. Curve options count length
in Slide steps; a Pose's rotation is a 3×3 matrix (ARCHITECTURE "The math"). The owner checks the
Curve in the browser after C1.10 and the motion at the end (C1.16).

| Repository | Slices |
|---|---|
| `curvesel` | **Curve:** C1.1 constant Curvature, C1.2 playground, C1.3 Planes, C1.4 visible range and depth order, C1.5 Wave in the Plane, C1.6 Wave anchored to the ribbon, C1.7 Wave across the Plane, C1.8 Twist, C1.9 Tilt, C1.10 Presets and custom Layouts. **Physics:** C1.11 Track and Drag, C1.12 Inertia, C1.13 Snap, C1.14 Loop, C1.15 goTo, C1.16 playground with motion |

## Prerequisites (only the owner can do these)
- **P1** · The GitHub repository `curvesel`, `main` pushed, labels and squash settings
  (OWNER_PLAN §0). Needed by C0.1.
- **P2** · The npm scope `@curvesel` (or the unscoped fallback names, DEC-12). Needed by the first
  publish (M3).

## Later milestones (split when they start)
- **M2 · Vanilla engine and demo.** Mount over the Stage's children, measure with
  `ResizeObserver`, follow added and removed children, Pointer Events, wheel, keyboard, the click
  guard, culling, the CSS variables and attributes, `destroy()`, browser tests. A demo page with
  every Preset, including the arc of cards from the owner's reference image. The owner checks it in
  the browser midway and at the end.
- **M3 · v1 release.** ARIA (`aria-roledescription="carousel"`, a live region, `inert` on culled
  Slides), `prefers-reduced-motion`, the docs, the lab write-up, the first npm publish.
- **M4 · React adapter.** **M5 · Angular adapter.**

## Recommended order (one session at a time)
C0.1 (done), then C1.1 to C1.16 in order; each depends on the one before. Then "close M1" and
"plan M2" with the owner.

## Open decisions (see DECISIONS.md)
| Id | Question | Status | Needed by |
|---|---|---|---|
| – | None open | – | – |
