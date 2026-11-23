# curvesel architecture

A layered library in one npm workspace: pure math and physics at the bottom, a DOM engine on top of
it, and thin adapters on top of both. Behaviour is written and tested once, in the lower layers;
adapters only bind it to a UI layer (DEC-11, DEC-12).

## Stack
Exact versions are pinned in the root `package.json` (the same toolchain as `../list-picker`):
TypeScript 7.0.2, Vitest 5.1.1 with `@vitest/coverage-v8` 5.1.1, `fast-check` 4.11.0, Biome 2.6.8,
Vite 8.3.8.
- **Language:** TypeScript 7, `strict` plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`, ES modules (`nodenext`), target ES2024. Node 26 (npm 11).
- **Workspace:** npm workspaces, packages under `packages/`. The root `tsconfig.json` type-checks
  every package's `src` and `test`; each package's `tsconfig.json` extends it to build its `src`.
- **Tests:** Vitest 5 with V8 coverage. Added when first needed: `fast-check` 4 for property tests
  of the PRODUCT invariants (M1), `happy-dom` for engine unit tests (C2.0), Playwright 1.65 for
  real-browser tests (C2.6: the playground and `e2e/engine.html`, served by Vite from the root).
- **Format and lint:** Biome 2.
- **Build:** `tsc` per package, to ESM plus type declarations in `dist/`.
- **Playground:** Vite (dev server only, `npm run dev`), no config file: `vite playground`.

## Modules

| Package | Owns | May depend on |
|---|---|---|
| `packages/core` | The Curve layout and its integration, the Presets, the Pose, the Track and its physics step (Drag, Inertia, Snap, Rubber band, loop). No DOM. | nothing |
| `packages/vanilla` (C2.1) | `createCarousel(stage, options)`: adopts the Stage's children, measures them, runs the loop, handles input, writes Poses and CSS state | `core` |
| `playground/` (C1.2) | A local page that draws the Curve and exercises it by hand; not a package, never published | `core` (source) |
| `packages/react` (M4) | `<Carousel>` and a hook over the engine | `core`, `vanilla` |
| `packages/angular` (M5) | A component with `<ng-content>` and a slide directive over the engine | `core`, `vanilla` |

Each package is created by the first slice that needs it.

### The math (`core`)
- **Units:** the Curve's options count length in Slide steps, `step = size + gap` (px): Curvature is
  radians of bend per step (a closed cylinder of N Slides is `2π / N`), the Wave's wavelength is in
  Slides, Twist is radians per step. The radius is `step / curvature`, so a Preset fits any slide
  size. `gap` is in px; `size` is measured by the engine (the largest Slide along the Curve: its
  height in `yz`, its width otherwise; a `size` option overrides it) and passed in the Layout
  context.
- `curvePose(offset, options, context) → Pose`: the arc length is `s = offset` steps; the heading
  `θ(s)` is the integral of `κ(s)`; the position is the integral of the unit tangent, in the chosen
  Plane. With no Wave it is closed form (`x = R·sin(κs)`, `z = R·(cos(κs) − 1)`, a series near `κ =
  0`); with a Wave, the heading in closed form and the position by Simpson's rule, 32 intervals per
  step (default phase π/2, DEC-13). The Curve has two angles along its length: the yaw in its Plane
  (the Curvature and a `z` Wave) and the pitch across it (a `y` Wave). The tangent `(cos ψ cos φ,
  −cos ψ sin φ, sin ψ)` is integrated in the Curve's own axes (along, bend, across), then each Plane
  maps those axes to the Stage's; the Slide pitches around the Curve's in-Plane normal. Twist turns
  each Slide by `twist · offset` around its tangent (the rotation times a local turn about its along
  axis). Tilt rotates the whole Curve around the view axis through the centre, and each Slide back
  by the same angle, so its rotation is the untilted one and its content stays upright.
- A Pose is `{ x, y, z, rotation, zIndex, visible }`, `rotation` a row-major 3×3 matrix; the engine
  writes it as one `matrix3d()`. Rotations combine by multiplying matrices, never as Euler angles.
  The Slide at Offset 0 is at the origin with the identity rotation. `zIndex` comes from the Slide's
  own depth, in buckets of 1/100 of a step, each split by `|offset|` in 1/100 of an Offset (up to
  100) so that at equal depth the Slide nearer the centre is above; `visible` is `|offset| ≤
  visibleRange`.
- Presets are plain option objects, frozen: `cylinder` (a ring of 10, the back half hidden),
  `ribbon` (flat), `wheel` (the cylinder in `yz`), `arc` (`xy`, 0.2 per step, the centre below). A
  custom Layout is any `(offset, context) → Pose`; `rotationFromAngles(rx, ry, rz)` builds the
  rotation of CSS `rotateX(rx) rotateY(ry) rotateZ(rz)`.

### The physics (`core`)
- `TrackState`: `{ position, velocity, phase: 'rest' | 'drag' | 'inertia' | 'snap' }` plus bounds
  or loop. `step(state, dt) → state` is pure. Input becomes calls (`dragStart`, `dragMove(delta)`,
  `release(velocity)`, `goTo(index)`) that return a new state.
- Drag converts pixels to Position by the slide step; past the ends it is divided (Rubber band).
- Inertia decays velocity by friction per second, `rubberBand` times faster past an end, solved in
  closed form piece by piece between the ends (any split of `dt` ends at the same Position); below
  a threshold, Snap takes over in the same step: a critically damped spring to `target`,
  `round(position)` clamped (or free when looping), also in closed form. Snap never overshoots:
  the speed handed over is at most the rest threshold and decaying, so only a target already within
  the rest distance could be passed, and the step that would pass it rests on it instead. `goTo`
  keeps only the velocity towards its target, capped at `ω` times the distance, which a critically
  damped spring never passes.

## Writing a Pose (`vanilla`)
`transform: translate(W/2 − left, H/2 − top) translate(-50%, -50%) matrix3d(…)`: DEC-07 writes no
`left`/`top`, so it starts from where the absolute Slide sits (`offsetLeft`, `offsetTop`). These
and the size are read on mount, resize and child changes only; a frame computes and writes.

## Request flow
One gesture through the engine (M2):
1. `pointerdown` on the Stage: record the pointer; Track goes to `drag`.
2. `pointermove`: capture the pointer past the drag threshold (GOTCHAS), store the delta.
   The frame turns px into Positions along the Layout's tangent on screen at the centre.
3. Each `requestAnimationFrame`: apply the stored delta, `step(state, dt)`, compute each visible
   Slide's Offset and Pose, write `transform`, `z-index`, `visibility` and the CSS variables, all
   writes together. The loop stops when the Track is at rest.
4. `pointerup`: `release` with the measured velocity (Inertia, then Snap). If the drag passed the
   threshold, the next `click` is stopped in the capture phase.
5. `destroy()`: stop the loop, remove the listeners, restore what DEC-07 lists.

## Persistence
None. The library emits `change` (Position) and `select` (Active slide) through
`carousel.on(name, handler)`, which returns an unsubscribe function; the user persists.

## Configuration
Options passed to `createCarousel` or the adapter (a Preset name or Curve options, physics options,
`loop`, `perspective`); no environment. An invalid option (a missing Stage, a negative gap) throws an
`Error` with a plain message at mount, never fails silently.

## Security
The library never reads or writes the Slides' content and never uses `innerHTML`. No network access.

## External providers
None. GitHub for the code and CI; npm for publishing (from M3).

## Design references
None for the library: it is headless (DEC-07). The demo's arc Preset follows the owner's reference
image as described here (cards on an arc whose centre is below the screen, side cards tilted and
dimmed), judged by the owner in the browser; the demo's look lives in the demo only.

## Lessons from the 2012 carousel (`../3d-carousel/chosen.carousel.js`)
What it got right and returns here:
- The cylinder: `rotateY(i · 360/N) translateZ(r)` with `r = (w/2) / tan(π/N)`; here it is the
  Curve with constant Curvature.
- A ring of N places with an unbounded rotation, culled at ±60°, works as a window over a longer
  list: here the Visible range does the same.
- Rubber band at the ends (movement / 10), Inertia with friction 0.84, Snap with a short tween, and
  the click blocked only after a real drag.
What does not return: the global singleton, jQuery, TweenMax and jQuery UI, fixed sizes (235 px, 24
places), separate desktop and phone code, image loading and panel styling, the A–Z index tied to
text (the user builds it with `goTo`), mouse-only input, `setInterval` at 30 fps.
