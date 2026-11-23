# curvesel state

What exists in this repository now. The code wins over this file: if they disagree, fix this file.
Every slice's pull request updates it (SESSION §3).

## Capabilities
- The npm workspace builds, formats, lints, type-checks, tests and runs the browser tests
  (Playwright in Chrome: the playground's Drag, Rubber band and idle loop, and the engine's resize,
  hidden Stage, removed and moved Slides) with one command, `npm run verify`, which CI runs in the
  `gate` job (plus the title, size, frozen-files and secret
  checks). Coverage below 80% of lines fails it.
- `curvePose(offset, { curvature, gap, plane, wave, twist, tilt, visibleRange }, { size, position
  })`: the Pose of a Slide on a Curve of constant Curvature in the `xz` (default), `yz` (wheel: down
  the screen, bending away) or `xy` (arc: in the screen, the centre below) Plane, from a flat ribbon
  (0) to a closed cylinder (`2π / N`), exact through `κ = 0`. A Wave (`amplitude`, `wavelength`,
  `phase`, `plane`) makes it undulate in its Plane (`z`) or across it (`y`, pitching the Slides),
  fixed relative to the centre (`anchor: 'space'`) or travelling with the Slides (`'ribbon'`, the
  phase shifted by `2π·position / wavelength`; the ribbon rocks as it moves, since the Active slide
  keeps facing the viewer). `twist` turns each Slide by `twist · offset` around its tangent; `tilt`
  leans the whole Curve around the view axis, the Slides staying upright. Each Pose says whether it
  is `visible` and its `zIndex` (nearer the viewer above; at equal depth, nearer the centre above).
  Invalid options throw `curvesel:` errors.
- `presets` (`cylinder`, `ribbon`, `wheel`, `arc`), the `Layout` type for custom Layouts, and
  `rotationFromAngles(rx, ry, rz)` (CSS `rotateX rotateY rotateZ`).
- The Track: `createTrack({ count, rubberBand })` at rest on Position 0; `dragStart` and
  `dragMove(state, delta)` (delta in Positions) move it, and past the first or last Slide only
  `rubberBand` (0.1 by default) of a move counts, so a move and its reverse cancel out.
  `release(state, velocity)` starts Inertia and `step(state, dt)` advances it: the velocity keeps
  `friction` of itself per second (2012's 0.84 per 30 fps frame by default), decaying `rubberBand`
  times faster past an end, solved exactly so any frame rate ends at the same Position; `dt` counts
  at most 0.1 s. Below 0.01 Positions per second (or on a release with no speed), Snap pulls the
  Track to `target`, the nearest whole Position within bounds, with a critically damped spring
  (ω = 12/s, solved exactly, spending the rest of the step), and it rests exactly on it.
  `createTrack({ count, loop: true })` turns forever: no ends, no Rubber band, Snap to any whole
  Position. `slideOffset(index, position, count, loop)` is `index − position`, wrapped into
  `[−count/2, count/2)` when looping. `goTo(state, index)` starts Snap's spring towards that Slide
  (the nearest Position showing it when looping), keeping the velocity towards it up to what never
  passes it; it is ignored during a Drag. `goBy(state, delta)` steps whole Slides on from the one
  it is on or heading to (past the ends when looping, so repeated steps keep their direction).
- `createCarousel(stage, { layout, size, perspective, loop })` (`@curvesel/vanilla`) lays the
  Stage's children on the Curve at Position 0 (size: the largest Slide along the Curve, or given),
  writing only DEC-07's properties, and lays them out again when the Stage or a Slide resizes (a
  `ResizeObserver`; while they measure 0 the last layout stays), and follows added and removed
  children (a `MutationObserver`; a removed child gets back what was written); `destroy()` restores
  them exactly. `goTo(index)`, `next()`, `previous()` and `position` move it with one
  `requestAnimationFrame` loop that runs only in Inertia or Snap (`friction`, `rubberBand`
  options); geometry is measured on mount, resize and child changes, a frame only writes, and a
  culled Slide is written once until it comes back. Removing the Slides past the Position Snaps it
  back to the new last one. `on('change' | 'select', handler)` returns an unsubscribe function:
  `change` hands the Position once per frame that moved it, `select` the Active slide's index when
  it changes (also after a child change); a handler's error is reported (`reportError`), not
  thrown; `destroy()` drops every handler. A Drag (`drag.ts`: one pointer, captured on its first
  move, no `window` or `document` listener) moves it along the Layout's tangent on screen, applied
  in the next frame; a release carries the last 100 ms of velocity into Inertia; the Active slide
  is clamped past an end; `touch-action` follows the drag axis.
- The demo (`npm run demo`): eight cards with their own counter buttons and inputs, mounted by the
  vanilla engine, with a Preset selector, Previous and Next, and the Active card from `select`;
  switching Presets destroys and mounts again, and the cards keep their state.
- The playground (`npm run dev`): top, front and side views of N Slides, a Preset selector, a Plane
  selector and sliders for count, Curvature, gap, size, the Wave with its plane and anchor, Twist,
  Tilt, the Position and visible range (hidden Slides dashed, painted in `zIndex` order), and a
  button that closes the ring; errors show on the page. It runs a Track: dragging any view moves it
  (pixels divided by the step on screen), a release carries the velocity of the last 100 ms into
  Inertia and Snap, one `requestAnimationFrame` loop runs only while the Track moves, Previous and
  Next call `goTo`, a checkbox loops it, and the page shows the Position, the phase and the frames
  requested. Slides sit at `slideOffset(index, position, count, loop)`; each view is fitted to the
  Curve at Position 0, so the Slides move under the pointer. The Position slider drags the Track
  and Snaps it when let go.

## Modules
- `packages/core` (`@curvesel/core`): `curve-pose.ts` (`curvePose`, `CurveOptions`,
  `LayoutContext`, `Plane`, `Wave`), `pose.ts` (`Pose`, `Rotation`, a row-major 3×3 matrix),
  `layout.ts` (`Layout`, `rotationFromAngles`), `presets.ts` (`presets`, `PresetName`),
  `track.ts` (`createTrack`, `dragStart`, `dragMove`, `release`, `goTo`, `goBy`, `step`, `TrackState`,
  `TrackOptions`), `slide-offset.ts` (`slideOffset`).
- `packages/vanilla`: `carousel.ts` (`createCarousel`, `CarouselOptions`, `Carousel`,
  `CarouselEvents`), `drag.ts` (pointer handling).
- `demo/` (`index.html`, `main.ts`): the engine's demo page; its look lives here only (DEC-07).
- `playground/` (`index.html`, `main.ts`): the hand-test page; not a package, never published.

## Known issues
- A ring with a `y` Wave closes only for a whole number of wavelengths at the default phase with
  `anchor: 'space'`; with another phase, or `ribbon` while the Track moves, it opens (C1.7 review).
  Closing it would need the Slide count in the Layout context.

## Last session
- **2026-11-23, bootstrap:** the repository starts from the AI-flow boilerplate: `AGENTS.md`
  (`CLAUDE.md` imports it), skills in `.agents/skills/`, hooks in `.claude/hooks/`, and CI checks,
  with the adjustments made in `../list-picker` (SESSION, `tdd`, CONVENTIONS, public API instead of
  a contract). PRODUCT, ROADMAP, DEC-06 to DEC-12 and ARCHITECTURE hold the design agreed with the
  owner: one Curve layout with Presets, adopted Slides, time-based physics.
- **2026-11-23, C0.1:** the runnable skeleton: root `package.json`, `tsconfig.json` and
  `biome.json` copied from `../list-picker`'s working toolchain, `packages/core` building to ESM
  plus declarations, a smoke test, the coverage floor as CLI flags, and the `gate` job in CI.
- **2026-11-23, plan M1:** sixteen slices, C1.1 to C1.16 (`docs/PLAN.md`). Agreed with the owner:
  Curve options in Slide steps, a Pose's rotation as a 3×3 matrix, and Tilt around the view axis
  with the Slides kept upright (ARCHITECTURE "The math", PRODUCT terms).
- **2026-11-23, C1.1:** `curvePose` with constant Curvature and the shared property test
  (`test/curve-pose.property.test.ts`: equal spacing, continuity through `κ = 0` against an
  independent formula of the circle).
- **2026-11-23, C1.2:** the playground, Vite with no config file, importing `core` from source.
  Checked in Chrome with a scratch Playwright script (flat, half bend, closed ring, error).
- **2026-11-23, C1.3:** the three Planes; the property tests run over each.
- **2026-11-23, C1.4:** `visible` and `zIndex` in every Pose, with a depth-order property.
- **2026-11-23, C1.5:** the Wave in the Curve's Plane (anchor `space`), default phase π/2.
- **2026-11-23, C1.6:** the Wave's `ribbon` anchor and `position` in the Layout context.
- **2026-11-23, C1.7:** the Wave across the Plane (yaw and pitch, one integration path); the
  property checks every rotation is proper.
- **2026-11-23, C1.8:** Twist; the Wave property draws a Twist too.
- **2026-11-23, C1.9:** Tilt; the Wave property draws a Tilt too.
- **2026-11-23, C1.10:** the Presets, the `Layout` type and `rotationFromAngles`; the property runs
  over every Preset.
- **2026-11-23, C1.11:** the Track and Drag with the Rubber band, a pure state in and out.
- **2026-11-23, C1.12:** Inertia, exact between the ends; a property runs the same release at
  30, 60 and 120 fps and with jittery `dt`.
- **2026-11-23, C1.13:** Snap; a property settles any sequence of gestures on a whole Slide, and
  the frame-rate property now ends on the same Slide.
- **2026-11-23, C1.14:** Loop and `slideOffset`; the gestures property runs looping too.
- **2026-11-23, C1.15:** `goTo`, with a property over any start, looping or not, at any frame rate.
- **2026-11-23, C1.16:** the playground drives a Track (Drag, Inertia, Snap, Rubber band, loop,
  `goTo`). Checked in Chrome with a scratch Playwright script: flings, past both ends, Previous and
  Next, loop, a Preset; no frame requested at rest.
- **2026-11-23, close M1:** the owner checked the motion in the playground; M1 is `done` in the
  ROADMAP, and the close pull request ranks the open retro proposals.
- **2026-11-23, M1 proposals:** five retro proposals applied (#20 to #24).
- **2026-11-23, plan M2:** twelve slices, C2.1 to C2.12 (`docs/PLAN.md`). Agreed with the owner:
  events through `carousel.on()`, the largest Slide as the size (overridable), and DEC-14 (the
  engine makes the Stage focusable); the arc demo follows ARCHITECTURE's description.
- **2026-11-23, C2.1:** `packages/vanilla` with `createCarousel` and `destroy()`.
- **2026-11-23, C2.2:** the Carousel follows the size of the Stage and the Slides.
- **2026-11-23, C2.3:** the Carousel follows the Stage's children; an empty Stage mounts.
- **2026-11-23, C2.4:** the animation loop, `goTo`, `next`, `previous`, `position` and culling.
- **2026-11-23, C2.5:** `carousel.on('change' | 'select')`.
- **2026-11-23, C2.6:** Playwright in the gate; each browser test went red against the bug it
  guards (C1.16's re-centring, C2.2's content box, C2.3's `style=""` and hand-over).
- **2026-11-23, C2.7:** the demo page, and `vite.config.ts` resolving `core` to its source.
- **2026-11-23, C2.8:** Drag in the engine; e2e in the demo (follow, Rubber band).
- **Next:** the owner checks the Drag in the demo (C2.8 criterion 3), then C2.9 (click guard).
