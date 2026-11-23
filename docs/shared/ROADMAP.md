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

## Prerequisites (only the owner can do these)
- **P1** · The GitHub repository `curvesel`, `main` pushed, labels and squash settings
  (OWNER_PLAN §0). Needed by C0.1.
- **P2** · The npm scope `@curvesel` (or the unscoped fallback names, DEC-12). Needed by the first
  publish (M3).

## Later milestones (split when they start)
- **M1 · Core.** The Curve layout: constant Curvature (cylinder ↔ flat ribbon), then Wave (planes Z
  and Y, anchors `space` and `ribbon`), Twist, Tilt and the three Planes; the Presets; the custom
  Layout function. The physics: Position, Drag input, Inertia, Snap, Rubber band, loop, `goTo`.
  Property tests of the PRODUCT invariants. A local playground draws the Curve in 2D and grows with
  every slice; the owner checks it in the browser at the end of M1.
- **M2 · Vanilla engine and demo.** Mount over the Stage's children, measure with
  `ResizeObserver`, follow added and removed children, Pointer Events, wheel, keyboard, the click
  guard, culling, the CSS variables and attributes, `destroy()`, browser tests. A demo page with
  every Preset, including the arc of cards from the owner's reference image. The owner checks it in
  the browser midway and at the end.
- **M3 · v1 release.** ARIA (`aria-roledescription="carousel"`, a live region, `inert` on culled
  Slides), `prefers-reduced-motion`, the docs, the lab write-up, the first npm publish.
- **M4 · React adapter.** **M5 · Angular adapter.**

## Recommended order (one session at a time)
C0.1, then "plan M1" with the owner.

## Open decisions (see DECISIONS.md)
| Id | Question | Status | Needed by |
|---|---|---|---|
| – | None open | – | – |
