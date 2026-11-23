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

## M1 · Core · done (2026-11-23)
The Curve layout and the physics in `packages/core`, with property tests of the PRODUCT invariants,
and a local playground that draws the Curve and grows with every slice. Curve options count length
in Slide steps; a Pose's rotation is a 3×3 matrix (ARCHITECTURE "The math"). The owner checks the
Curve in the browser after C1.10 and the motion at the end (C1.16).

| Repository | Slices |
|---|---|
| `curvesel` | **Curve:** C1.1 constant Curvature, C1.2 playground, C1.3 Planes, C1.4 visible range and depth order, C1.5 Wave in the Plane, C1.6 Wave anchored to the ribbon, C1.7 Wave across the Plane, C1.8 Twist, C1.9 Tilt, C1.10 Presets and custom Layouts. **Physics:** C1.11 Track and Drag, C1.12 Inertia, C1.13 Snap, C1.14 Loop, C1.15 goTo, C1.16 playground with motion |

## M2 · Vanilla engine and demo · done (2026-11-23)
`packages/vanilla` over the user's own elements, then a demo page. Events through `carousel.on()`;
the Slide size is the largest Slide along the Curve, overridable; the engine makes the Stage
focusable (DEC-14). The owner checks the Drag in the demo (C2.8) and every Preset at the end
(C2.11).

| Repository | Slices |
|---|---|
| `curvesel` | **Engine:** C2.1 mount and destroy, C2.2 follow the size, C2.3 follow the children, C2.4 animation loop and goTo, C2.5 events. **Browser:** C2.6 browser tests, C2.7 demo page. **Input:** C2.8 Drag, C2.9 click guard, C2.10 wheel and keyboard. **Finish:** C2.11 demo with every Preset, C2.12 frame budget |

## Prerequisites (only the owner can do these)
- **P1** · The GitHub repository `curvesel`, `main` pushed, labels and squash settings
  (OWNER_PLAN §0). Needed by C0.1.
- **P2** · The npm scope `@curvesel` (or the unscoped fallback names, DEC-12). Needed by the first
  publish (M3).

## Later milestones (split when they start)
- **M3 · v1 release.** ARIA (`aria-roledescription="carousel"`, a live region, `inert` on culled
  Slides), `prefers-reduced-motion`, the docs, the lab write-up, the first npm publish.
- **M4 · React adapter.** **M5 · Angular adapter.**

## Recommended order (one session at a time)
C0.1 and C1.1 to C1.16 (done; M1 closed), C2.0 to C2.12 (done; M2 closed). Then "plan M3" with
the owner.

## Open decisions (see DECISIONS.md)
| Id | Question | Status | Needed by |
|---|---|---|---|
| – | None open | – | – |
