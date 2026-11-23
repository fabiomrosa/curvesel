# curvesel plan

This repository's track of `docs/shared/ROADMAP.md`, with entries in the template of
`docs/shared/SESSION.md` §0. Slice ids start with `C`.

---

### C0.1 · Runnable skeleton
- **Status:** done (2026-11-23)
- **Goal:** an empty project that builds, formats, tests and runs, with its gate in CI.
- **Depends on:** DEC-12 (accepted), P1.
- **In scope:**
  - The npm workspace (root `package.json`, `tsconfig` base, strict) with `packages/core` empty but
    building: its `package.json`, `tsconfig`, `src/index.ts`.
  - Vitest and Biome at the ARCHITECTURE versions, pinned.
  - The formatter and linter, wired into the gate.
  - One smoke test in `packages/core/test/`.
  - Coverage in the gate, failing below the floor of `docs/CONVENTIONS.md` §5 (80% of lines).
  - CI: the `gate` job in `.github/workflows/ci.yml` running `npm run verify`.
  - `README.md`: Tech references, Requirements, Running locally, Config (as far as the skeleton
    goes).
  - The gate as one command (`npm run verify`), the same one CI runs.
- **Out of scope:** any feature; `packages/vanilla` and the others; Playwright; publishing.
- **Contract:** none.
- **Acceptance criteria:**
  1. `npm run verify` passes from a clean clone.
  2. A badly formatted file fails the gate (seen once).
  3. The smoke test passes, and fails when broken (seen once).
  4. Coverage below the floor fails the gate (seen once).
  5. CI is green on the pull request.
- **Files:** 15 (lockfile excluded): root `package.json`, `tsconfig.json`, `biome.json`,
  `.gitignore`, `packages/core/{package.json,tsconfig.json,src/index.ts,test/smoke.test.ts}`,
  `ci.yml`, `README.md`, PLAN, STATE, CONVENTIONS, ARCHITECTURE "Stack", GOTCHAS. Coverage is set
  by CLI flags, with no Vitest config file.
- **References:** ARCHITECTURE "Stack", GOTCHAS; `../list-picker`'s root `package.json`,
  `tsconfig.json`, `biome.json` and `ci.yml`, the same toolchain already working.

---

## M1 · Core
Everything in `packages/core` (`@curvesel/core`), pure and DOM-free (DEC-06, DEC-11). Curve options
count length in Slide steps (ARCHITECTURE "The math"); a Pose's rotation is a 3×3 matrix. Each
Layout slice keeps the PRODUCT invariants in the shared property test
(`test/curve-pose.property.test.ts`); each slice extends the playground with what it adds. The
owner checks the Curve in the browser after C1.10 and the motion at the end of M1 (C1.16).

### C1.1 · Curve: constant Curvature
- **Status:** done (2026-11-23)
- **Goal:** Slides sit at equal steps along a Curve of constant Curvature in the `xz` Plane, from a
  flat ribbon to a closed cylinder.
- **Depends on:** C0.1, DEC-06, DEC-08.
- **In scope:**
  - `curvePose(offset, options, context)` with `options` `{ curvature, gap }` (radians per step,
    px) and `context` `{ size }` (px): `x = R·sin(κ·offset)`, `z = R·(cos(κ·offset) − 1)`,
    `R = step / κ`, a series near `κ = 0`; the rotation turns the Slide with the Curve's heading.
  - `Pose` `{ x, y, z, rotation }`, `rotation` a row-major 3×3 matrix.
  - A non-finite Curvature, a negative gap or a size that is not positive throws `curvesel:`.
  - `fast-check` (dev), the property test file.
- **Out of scope:** other Planes (C1.3), `zIndex` and `visible` (C1.4), the playground (C1.2).
- **Contract:** none. **Public API:** additive, `curvePose`, `Pose`, `CurveOptions`,
  `LayoutContext`; `packageName` removed.
- **Acceptance criteria:**
  1. Offset 0 is at the origin with the identity rotation, for any Curvature.
  2. Curvature 0: Offset k is at `x = k·step`, `z = 0`, identity rotation.
  3. Curvature `2π / N`: Offset N lands on Offset 0, and every Slide faces outwards from the axis.
  4. Property: neighbours are one step apart along the Curve (chord `2R·sin(κ/2)`), for random
     Curvatures and Offsets, reaching both near-zero and large Curvatures a minimum number of
     times.
  5. Property: the Pose is continuous through `κ = 0` (`±1e-9` and 0 agree within `EPS`).
  6. Each invalid option throws a message that names it.
- **Files:** ~9: `src/curve-pose.ts`, `src/pose.ts`, `src/index.ts`, `test/curve-pose.test.ts`,
  `test/curve-pose.property.test.ts`, `test/smoke.test.ts` (removed), root `package.json`, PLAN,
  STATE.
- **References:** DEC-08, ARCHITECTURE "The math", PRODUCT invariants, CONVENTIONS §5.

### C1.2 · Playground
- **Status:** done (2026-11-23)
- **Goal:** the owner can see the Curve and bend it by hand in the browser.
- **Depends on:** C1.1.
- **In scope:** Vite (dev), `npm run dev`; `playground/index.html` and `playground/main.ts` drawing
  a top view (x, z) of N Slides as segments of the slide's width, turned by their rotation, with
  sliders for count, Curvature and gap; errors shown on the page. Type-checked and linted like the
  packages, outside the coverage floor, never published; imports `core` from source.
- **Out of scope:** dragging (C1.16); any styling beyond legible lines.
- **Contract:** none. **Public API:** none.
- **Acceptance criteria:**
  1. `npm run dev` opens the playground with no console error.
  2. Moving Curvature from 0 to `2π / N` bends the line into a closed ring with no jump (seen in
     the browser).
- **Files:** ~7: root `package.json`, `tsconfig.json`, `playground/index.html`,
  `playground/main.ts`, README "Running locally", PLAN, STATE.
- **References:** ARCHITECTURE "Modules" (playground).

### C1.3 · Planes
- **Status:** done (2026-11-23)
- **Goal:** the same Curve bends vertically in depth (a wheel) or in the screen (an arc).
- **Depends on:** C1.2.
- **In scope:** `plane: 'xz' | 'yz' | 'xy'`, `xz` by default: `yz` puts the bend in `y` and `z`,
  `xy` in `x` and `y` with `z = 0`, each with the matching rotation. An unknown Plane throws. The
  playground adds a front view (x, y) and a Plane selector.
- **Out of scope:** Tilt (C1.9).
- **Contract:** none. **Public API:** additive, `Plane`, `plane` in `CurveOptions`.
- **Acceptance criteria:**
  1. For each Plane, a quarter turn (`κ·k = π/2`) puts Offset k on the expected axes with the
     expected rotation.
  2. The property test runs over every Plane, and the invariants hold.
  3. The wheel and the arc show in the playground's views (seen in the browser).
- **Files:** ~6: `src/curve-pose.ts`, its tests, `src/index.ts`, `playground/main.ts`, PLAN, STATE.
- **References:** DEC-08, PRODUCT "Plane".

### C1.4 · Visible range and depth order
- **Status:** done (2026-11-23)
- **Goal:** every Pose says whether its Slide is shown and how it stacks.
- **Depends on:** C1.3.
- **In scope:** `visibleRange` (in Offsets, everything visible by default): `visible` is
  `|offset| ≤ visibleRange`. `zIndex`: a non-negative integer, higher for the Slide nearer the
  viewer (larger `z`), ties broken by the smaller `|offset|`. The playground greys hidden Slides.
- **Out of scope:** `inert` and ARIA on culled Slides (M3).
- **Contract:** none. **Public API:** additive, `zIndex` and `visible` in `Pose`, `visibleRange`.
- **Acceptance criteria:**
  1. Offsets on each side of `visibleRange` are visible and hidden; a negative range throws.
  2. Property: of any two Slides, the one more than 1/100 of a step nearer the viewer has the
     larger `zIndex`; at equal `z`, so does the one more than 1/100 of an Offset nearer the centre
     (within 99 Offsets of it); every `zIndex` is a whole number from 0 to 2³¹ − 1 (for a depth
     within ±1000 steps). An integer computed from one Slide alone cannot order every pair
     exactly, so these tolerances are the rule.
- **Files:** ~6: `src/curve-pose.ts`, `src/pose.ts`, its tests, `playground/main.ts`, PLAN, STATE.
- **References:** DEC-07 (`z-index`, `visibility`), PRODUCT "Visible range".

### C1.5 · Wave in the Plane
- **Status:** done (2026-11-23)
- **Goal:** a ribbon undulates in its own Plane, its Slides still equally spaced.
- **Depends on:** C1.4.
- **In scope:** `wave: { amplitude, wavelength, phase }` (radians per step, Slides, radians; phase
  π/2 by default, which puts the Active slide on a crest, flat, and keeps a wavy ribbon level on
  average; phase 0 made it lean, seen in the playground):
  `κ(s) = curvature + amplitude · sin(2π·s / wavelength + phase)`, wave fixed relative to the
  centre (anchor `space`); the heading has a closed form, the position a fixed number of Simpson
  steps per step. The playground gets the Wave's sliders.
- **Out of scope:** anchor `ribbon` (C1.6), a Wave across the Plane (C1.7).
- **Contract:** none. **Public API:** additive, `wave` in `CurveOptions`.
- **Acceptance criteria:**
  1. Amplitude 0 gives the closed form of C1.1 within `EPS`.
  2. Curvature 0: the heading returns to 0 after one wavelength.
  3. Property: neighbours stay one step apart along the Curve (a densely sampled length), with any
     Wave, and Offset 0 stays at the origin with the identity rotation.
  4. A wavelength that is not positive throws.
- **Files:** ~5: `src/curve-pose.ts`, its tests, `playground/main.ts`, PLAN, STATE.
- **References:** DEC-08 (Wave, anchor), PRODUCT invariants.

### C1.6 · Wave anchored to the ribbon
- **Status:** done (2026-11-23)
- **Goal:** the Wave can travel with the Slides instead of staying fixed on the screen.
- **Depends on:** C1.5.
- **In scope:** `wave.anchor: 'space' | 'ribbon'`, `space` by default; `position` in the Layout
  context. With `ribbon`, the phase moves with the Position, and the Curve is re-anchored so the
  Offset 0 invariant holds. The playground gets a Position slider and the anchor selector.
- **Out of scope:** the Track (C1.11).
- **Contract:** none. **Public API:** additive, `anchor`, `position` in `LayoutContext`.
- **Acceptance criteria:**
  1. With `ribbon`, Position p gives the Poses of `space` with the phase shifted by
     `2π·p / wavelength`; one wavelength later the Poses repeat.
  2. With `space`, the Position changes nothing.
  3. The property test covers both anchors.
- **Files:** ~5: `src/curve-pose.ts`, its tests, `playground/main.ts`, PLAN, STATE.
- **References:** DEC-08.

### C1.7 · Wave across the Plane
- **Status:** done (2026-11-23)
- **Goal:** a ribbon or a ring can undulate across its Plane (a horizontal ribbon waving up and
  down, a crown).
- **Depends on:** C1.6.
- **In scope:** `wave.plane: 'z' | 'y'`, `z` (in the Curve's Plane) by default; `y` bends across
  it. As built: a yaw around the Plane's fixed normal (the Curvature and a `z` Wave) and a pitch
  around the Curve's in-Plane normal (a `y` Wave), both in closed form, with one integration of the
  tangent; the Slide's rotation comes from the same two angles.
- **Out of scope:** a Wave in both directions at once.
- **Contract:** none. **Public API:** additive, `plane` in the Wave options.
- **Acceptance criteria:**
  1. Curvature 0 in `xz` with a `y` Wave keeps every Slide at `z = 0`, its `y` a wave.
  2. Curvature `2π / N` with a `y` Wave still closes the ring, with `y` oscillating, for a whole
     number of wavelengths at the default phase with `anchor: 'space'`. Otherwise it opens: the
     pitch shortens the ring's path by `cos ψ`, and closing it would need the Slide count.
  3. With `plane: 'z'` the frame integration matches C1.5's within `EPS` (one path, or both agree).
  4. The property test covers both Wave planes.
- **Files:** ~5: `src/curve-pose.ts` (or `src/frame.ts`), its tests, `playground/main.ts`, PLAN,
  STATE.
- **References:** DEC-08, ARCHITECTURE "The math".

### C1.8 · Twist
- **Status:** done (2026-11-23)
- **Goal:** Slides can rotate around the direction of the Curve, more the farther they are.
- **Depends on:** C1.7.
- **In scope:** `twist` (radians per step): the Slide at Offset k turns `twist·k` around its tangent;
  positions are unchanged. The playground gets a Twist slider.
- **Out of scope:** a Twist that varies along the Curve.
- **Contract:** none. **Public API:** additive, `twist`.
- **Acceptance criteria:**
  1. Twist changes rotations only: positions equal those without it.
  2. Offset k's rotation is the untwisted one turned `twist·k` around the tangent; Offset 0 keeps
     the identity.
  3. The property test covers random Twists.
- **Files:** ~5: `src/curve-pose.ts`, its tests, `playground/main.ts`, PLAN, STATE.
- **References:** PRODUCT "Twist".

### C1.9 · Tilt
- **Status:** done (2026-11-23)
- **Goal:** the whole Curve can lean around the view axis (a tilted wheel), with the Slides upright.
- **Depends on:** C1.8.
- **In scope:** `tilt` (radians): positions rotate around the view axis through the centre; each
  Slide's rotation is turned back by the same angle around the view axis, so its content stays
  upright and Offset 0 is unchanged. The playground gets a Tilt slider.
- **Out of scope:** tilting towards the viewer (it would break the Offset 0 invariant).
- **Contract:** none. **Public API:** additive, `tilt`.
- **Acceptance criteria:**
  1. Tilt rotates every position by the angle around the view axis and leaves Offset 0 at the
     origin with the identity rotation.
  2. Tilt `π/2` on an `xz` Curve gives the `yz` positions (the wheel).
  3. The property test covers random Tilts.
- **Files:** ~5: `src/curve-pose.ts`, its tests, `playground/main.ts`, PLAN, STATE.
- **References:** PRODUCT "Tilt".

### C1.10 · Presets and custom Layouts
- **Status:** done (2026-11-23)
- **Goal:** each variant is one named set of options, and a user can bring their own Layout.
- **Depends on:** C1.9.
- **In scope:** `presets`: `cylinder` (a closed ring of 10 with the back half hidden), `ribbon`
  (flat), `wheel` (the cylinder in `yz`), `arc` (`xy`, a gentle bend, the centre below the screen,
  as the owner's reference image). `Layout`, the type `(offset, context) → Pose`, which
  `curvePose` with options bound satisfies; `rotationFromAngles(rx, ry, rz)` for custom Layouts.
  The playground gets a Preset selector. The owner checks the Curve here.
- **Out of scope:** resolving a Preset name for the engine (M2).
- **Contract:** none. **Public API:** additive, `presets`, `PresetName`, `Layout`,
  `rotationFromAngles`.
- **Acceptance criteria:**
  1. The property test runs over every Preset (and random Offsets), and the invariants hold.
  2. `rotationFromAngles` matches known quarter turns around each axis.
  3. Each Preset looks as named in the playground (seen in the browser, by the owner).
- **Files:** ~7: `src/presets.ts`, `src/layout.ts`, their tests, `src/index.ts`,
  `playground/main.ts`, PLAN, STATE.
- **References:** DEC-08, ARCHITECTURE "Design references".

### C1.11 · Track and Drag
- **Status:** done (2026-11-23)
- **Goal:** a drag moves the Position, and the ends resist.
- **Depends on:** C1.10, DEC-09.
- **In scope:** `TrackState` `{ position, velocity, phase }` with `count`; `createTrack({ count })`
  at rest on 0; `dragStart(state)`, `dragMove(state, delta)` (delta in Positions; the engine
  divides pixels by the step). Past the first or last Slide, each move counts a fraction
  (`rubberBand`, 0.1 by default, as in 2012). A count below 1 throws.
- **Out of scope:** release (C1.12), loop (C1.14).
- **Contract:** none. **Public API:** additive, `createTrack`, `TrackState`, `dragStart`,
  `dragMove`.
- **Acceptance criteria:**
  1. Within bounds, moves add up to the Position; the phase is `drag`.
  2. Past an end, the excess grows by `rubberBand` of the move, and the Position is continuous at
     the end.
  3. An invalid count or `rubberBand` throws a message that names it.
- **Files:** ~5: `src/track.ts`, `test/track.test.ts`, `src/index.ts`, PLAN, STATE.
- **References:** DEC-06, DEC-09, ARCHITECTURE "The physics".

### C1.12 · Inertia
- **Status:** done (2026-11-23)
- **Goal:** a release carries the Track on and slows it down, the same at any frame rate.
- **Depends on:** C1.11.
- **In scope:** `release(state, velocity)` (Positions per second); `step(state, dt)` decays the
  velocity by `friction` per second (default from 2012's 0.84 per 30 fps frame); `dt` is clamped
  (a backgrounded tab); below a threshold the Track comes to rest where it is (Snap replaces this
  in C1.13). Past an end, the Rubber band slows it harder.
- **Out of scope:** Snap.
- **Contract:** none. **Public API:** additive, `release`, `step`.
- **Acceptance criteria:**
  1. Property: the same release ends within `EPS` of the same Position at 30, 60 and 120 fps and
     with jittery `dt`.
  2. The speed never grows during Inertia, and the Track reaches rest in finite time.
  3. One step with a huge `dt` moves no farther than the clamp allows.
- **Files:** ~5: `src/track.ts`, `test/track.test.ts`, `test/track.property.test.ts`, PLAN, STATE.
- **References:** DEC-09, PRODUCT "Feels physical".

### C1.13 · Snap
- **Status:** done (2026-11-23)
- **Goal:** the Track always settles on a whole Slide.
- **Depends on:** C1.12.
- **In scope:** below the Inertia threshold (or on a release with no speed), a critically damped
  spring to `round(position)`, clamped to the bounds; the phase is `snap`, then `rest`.
- **Out of scope:** loop (C1.14), `goTo` (C1.15).
- **Contract:** none. **Public API:** none (behaviour of `step` and `release`).
- **Acceptance criteria:**
  1. Property: any sequence of drags and releases, stepped with any `dt` sequence, comes to rest
     on a whole Position within bounds, within a bounded time.
  2. Released past an end, the Track returns to that end without overshooting it.
  3. The same gesture ends on the same Slide at 30, 60 and 120 fps.
- **Files:** ~5: `src/track.ts`, its tests, PLAN, STATE.
- **References:** DEC-09, PRODUCT invariants.

### C1.14 · Loop
- **Status:** done (2026-11-23)
- **Goal:** the Track can turn forever instead of stopping at the ends.
- **Depends on:** C1.13.
- **In scope:** `createTrack({ count, loop: true })`: no bounds and no Rubber band; Snap to any
  whole Position. `slideOffset(index, position, count, loop)`: `index − position`, wrapped into
  `[−count/2, count/2)` when looping.
- **Out of scope:** `goTo` (C1.15).
- **Contract:** none. **Public API:** additive, `loop`, `slideOffset`.
- **Acceptance criteria:**
  1. Looping, a drag past the last Slide moves freely and snaps to a whole Position outside
     `[0, count)`.
  2. Property: wrapped Offsets lie in `[−count/2, count/2)` and differ from `index − position` by
     a whole multiple of `count`.
  3. The property of C1.13 holds when looping (whole, not clamped).
- **Files:** ~6: `src/track.ts`, `src/slide-offset.ts`, their tests, `src/index.ts`, PLAN, STATE.
- **References:** DEC-09, PRODUCT invariants.

### C1.15 · goTo
- **Status:** done (2026-11-23)
- **Goal:** code can send the Track to any Slide with the same spring as Snap.
- **Depends on:** C1.14.
- **In scope:** `goTo(state, index)`: Snap towards `index`; when looping, the nearest whole
  Position showing that Slide. An index outside `[0, count)` or not whole throws `curvesel:`.
- **Out of scope:** `change` and `select` events (M2).
- **Contract:** none. **Public API:** additive, `goTo`.
- **Acceptance criteria:**
  1. `goTo` then stepping comes to rest on the index, the same at 30, 60 and 120 fps.
  2. Looping from near the end, `goTo(0)` takes the short way.
  3. An invalid index throws a message that names it.
- **Files:** ~5: `src/track.ts`, its tests, `src/index.ts`, PLAN, STATE.
- **References:** DEC-09, PRODUCT "Out" (the user builds pagination with `goTo`).

### C1.16 · Playground with motion
- **Status:** done (2026-11-23)
- **Goal:** the owner drags the Curve in the browser and feels Inertia, Snap, the Rubber band and
  the loop.
- **Depends on:** C1.15.
- **In scope:** in the playground only (no engine code): dragging the views moves the Track
  (pixels divided by the step), release with the measured velocity, one `requestAnimationFrame`
  loop that stops at rest, previous and next buttons with `goTo`, a loop checkbox. The owner
  checks M1 here.
- **Out of scope:** the engine, Pointer Events edge cases, the click guard (M2).
- **Contract:** none. **Public API:** none.
- **Acceptance criteria:**
  1. Drag, release, Snap, the Rubber band and the loop behave as in the tests (seen in the browser,
     by the owner).
  2. The loop stops when the Track is at rest (no frame requested at rest).
- **Files:** ~4: `playground/main.ts`, `playground/index.html`, PLAN, STATE.
- **References:** ARCHITECTURE "Request flow", DEC-09.

### C2.0 · Engine package
- **Status:** done (2026-11-23)
- **Goal:** `packages/vanilla` builds and tests against `core`'s source from a clean clone.
- **Depends on:** C1.16, DEC-12.
- **In scope:** `@curvesel/vanilla` (depending on `core`), `happy-dom`, the `vitest.config.ts`
  alias and the root `paths` that reach `core`'s source; a smoke test. Split from C2.1, which
  would not fit in one pull request.
- **Out of scope:** `createCarousel` (C2.1).
- **Contract:** none. **Public API:** a new, empty package.
- **Acceptance criteria:**
  1. With no `packages/*/dist`, `npm run verify` passes, and a `vanilla` test reaches `core` and a
     DOM.
- **Files:** ~10: the package's `package.json`, `tsconfig.json`, `src/index.ts`, a test,
  `vitest.config.ts`, the root `package.json` and `tsconfig.json`, the lockfile, GOTCHAS, PLAN.
- **References:** DEC-12, GOTCHAS "Toolchain".

### C2.1 · Mount and destroy
- **Status:** done (2026-11-23)
- **Goal:** a Stage's children sit on the Curve, and `destroy()` leaves them exactly as they were.
- **Depends on:** C2.0, DEC-07, DEC-08, DEC-12.
- **In scope:** `packages/vanilla` (`@curvesel/vanilla`, depending on `core`) and `happy-dom`.
  `createCarousel(stage, options)` with `layout` (a Preset name, Curve options or a Layout
  function; `cylinder` by default), `size`, `perspective` and `loop`; it writes DEC-07's
  properties for every Slide at Position 0: `transform` (the Pose's `matrix3d`, centred on the Stage
  by the transform alone, from where the absolute Slide starts), `z-index`, `visibility`,
  `--cs-offset`, `--cs-abs-offset`, `data-cs-active`, `data-cs-visible`. Measured once, absolute:
  the largest Slide along the Curve (its height in `yz`, its width otherwise); `size` overrides it.
  `destroy()` restores every property and attribute it wrote.
- **Out of scope:** resizing (C2.2), added or removed children (C2.3), motion (C2.4), input.
- **Contract:** none. **Public API:** new package: `createCarousel`, `CarouselOptions`, `Carousel`
  (`destroy`).
- **Acceptance criteria:**
  1. Each Slide carries the `matrix3d`, `z-index`, `visibility`, variables and attributes of its
     Pose at Position 0 (checked against `curvePose`).
  2. `destroy()` restores every inline property and attribute to its earlier value (absent stays
     absent); the Slides are the same nodes, in the same order, throughout.
  3. The size is the largest Slide along the Curve, and `size` overrides it.
  4. A missing Stage, an unknown Preset, an invalid option or Slides that measure 0 throw a
     `curvesel:` message naming it, and leave nothing written.
- **Files:** ~7: `src/carousel.ts`, `src/index.ts`, its test, ARCHITECTURE, GOTCHAS, PLAN, STATE.
- **References:** DEC-07, ARCHITECTURE "Modules" and "Request flow".

### C2.2 · Follow the size
- **Status:** done (2026-11-23)
- **Goal:** the Curve keeps fitting when the Stage or a Slide changes size.
- **Depends on:** C2.1.
- **In scope:** one `ResizeObserver` over the Stage and every Slide; a change re-measures and lays
  out again (the size is re-measured unless given, every Slide re-centred either way); while
  the Slides measure 0 (a hidden Stage) the last layout stays; `destroy()` disconnects it.
- **Out of scope:** added or removed children (C2.3).
- **Contract:** none. **Public API:** none.
- **Acceptance criteria:**
  1. Resizing a Slide or the Stage lays the Slides out again with the new size (a stubbed
     `ResizeObserver` in `happy-dom`).
  2. With `size` given, a resize keeps the size and re-centres every Slide.
  3. `destroy()` disconnects the observer.
- **Files:** ~5: `src/carousel.ts`, its test, PLAN, STATE.
- **References:** DEC-07.

### C2.3 · Follow the children
- **Status:** done (2026-11-23)
- **Goal:** the user adds and removes Slides freely, and the Carousel follows.
- **Depends on:** C2.2.
- **In scope:** a `MutationObserver` on the Stage's child list: an added child is adopted, a
  removed one gets back everything the library wrote, the Track takes the new count; an empty Stage
  draws nothing. (Clamping the Position moved to C2.4, where it can move.)
- **Out of scope:** reordering animations.
- **Contract:** none. **Public API:** none.
- **Acceptance criteria:**
  1. An appended child is laid out at its Offset; a removed child carries none of the library's
     properties or attributes.
  2. Looping, the Offsets wrap around the new count.
  3. An empty Stage mounts, draws nothing, and starts drawing when a child arrives.
  4. `destroy()` disconnects the observer.
- **Files:** ~5: `src/carousel.ts`, its test, PLAN, STATE.
- **References:** DEC-07, PRODUCT invariants.

### C2.4 · Animation loop and goTo
- **Status:** done (2026-11-23)
- **Goal:** code moves the Carousel, and it animates only while it moves.
- **Depends on:** C2.3, DEC-09.
- **In scope:** one `requestAnimationFrame` loop over the Track (`dt` from the frame timestamps,
  clamped at 0, GOTCHAS), `friction` and `rubberBand`; `goTo`, `next`, `previous`, `position`; per
  frame, only DEC-07's properties are written, all together; a Slide beyond the Visible range is
  hidden and not written again until it comes back.
- **Out of scope:** input (C2.8, C2.10), events (C2.5).
- **Contract:** none. **Public API:** additive, `goTo`, `next`, `previous`, `position`.
- **Acceptance criteria:**
  1. `goTo` animates to the Slide and rests on it; no frame is requested at rest (a fake clock).
  2. A culled Slide is written once when it leaves the Visible range and not again until it
     returns.
  3. `next` and `previous` stop at the ends, or wrap when looping.
  4. `destroy()` cancels a pending frame.
  5. Removing the last Slides while the Position is past them clamps it (from C2.3).
- **Files:** ~5: `src/carousel.ts`, its test, `src/index.ts`, PLAN, STATE.
- **References:** DEC-09, ARCHITECTURE "Request flow".

### C2.5 · Events
- **Status:** done (2026-11-23)
- **Goal:** the user's code hears where the Carousel is.
- **Depends on:** C2.4.
- **In scope:** `carousel.on('change' | 'select', handler)`, typed per event, returning an
  unsubscribe function: `change` with the Position, at most once per frame while it moves;
  `select` with the Active slide's index when it changes. `destroy()` drops every handler.
- **Out of scope:** DOM events on the Stage.
- **Contract:** none. **Public API:** additive, `on`, `CarouselEvents`.
- **Acceptance criteria:**
  1. `change` fires once per frame that moved the Position, never at rest.
  2. `select` fires once per change of the Active slide, with its index (wrapped when looping).
  3. Unsubscribing, or `destroy()`, stops a handler.
- **Files:** ~5: `src/carousel.ts`, its test, `src/index.ts`, PLAN, STATE.
- **References:** ARCHITECTURE "Persistence".

### C2.6 · Browser tests
- **Status:** done (2026-11-23)
- **Goal:** real-browser tests run in the gate.
- **Depends on:** C2.5.
- **In scope:** Playwright, configured as in `../list-picker` (the installed Chrome, no download),
  `npm run e2e` in `verify` and in CI; a smoke test of the playground (the M1 close's proposal 4:
  drag the ribbon, Rubber band, Snap, no frame at rest); the engine's resize in the browser (C2.2
  review: a Slide's padding change, a hidden then shown Stage, no `ResizeObserver` loop error); a
  restored or removed Slide that had no `style` attribute has none, and a Slide moved to a Carousel
  created earlier is laid out by it and fully restored (C2.3; `happy-dom` hides both).
- **Out of scope:** the demo (C2.7).
- **Contract:** none. **Public API:** none.
- **Acceptance criteria:**
  1. `npm run verify` runs the e2e tests, locally and in CI.
  2. The playground smoke test goes red against C1.16's re-centring bug (views fitted to the
     Slides) and green on `main`.
- **Files:** ~8: `playwright.config.ts`, `e2e/playground.e2e.ts`, root `package.json`, the lockfile,
  `.github/workflows/ci.yml`, AGENTS (commands), PLAN, STATE.
- **References:** CONVENTIONS §5, GOTCHAS.

### C2.7 · Demo page
- **Status:** done (2026-11-23)
- **Goal:** a page mounts the vanilla engine over real cards.
- **Depends on:** C2.6.
- **In scope:** `demo/` (Vite, `npm run demo`): a Stage of cards with their own buttons and inputs,
  a Preset selector, Previous and Next on `goTo`, the Active slide shown from `select`; an e2e test
  that every Preset mounts and `destroy()` restores the cards.
- **Out of scope:** input on the Stage (C2.8 onwards), the demo's final look (C2.11).
- **Contract:** none. **Public API:** none.
- **Acceptance criteria:**
  1. Each Preset lays the cards out in the demo (e2e: the Active card centred, the others placed).
  2. Switching Presets destroys and mounts again; the cards keep their typed input values.
- **Files:** ~6: `demo/index.html`, `demo/main.ts`, `e2e/demo.e2e.ts`, root `package.json`, PLAN,
  STATE.
- **References:** DEC-07, PRODUCT "Headless, children keep their behaviour".

### C2.8 · Drag
- **Status:** done (2026-11-23)
- **Goal:** the user drags the Carousel with mouse, touch or pen.
- **Depends on:** C2.7, DEC-10.
- **In scope:** `pointerdown` on the Stage with pointer capture (no listener on `window` or
  `document`); `pointermove` only stores the delta, applied in the next frame; pixels divided by the
  step on screen, along the Curve's direction on screen (vertical in `yz`, turned by the Tilt);
  `touch-action` for that axis; release at the velocity of the last 100 ms (none if the pointer was
  held still); one pointer at a time; `pointercancel` releases. The owner checks the Drag in the
  demo. Test then the clamp on removed Slides during Inertia (C2.4 review: it uses the Position
  unless the Track Snaps), and clamp the Active slide past an end when not looping (C2.5 review:
  `select` and `data-cs-active` wrap it today).
- **Out of scope:** the click guard (C2.9), wheel and keys (C2.10).
- **Contract:** none. **Public API:** none.
- **Acceptance criteria:**
  1. A drag moves the cards with the pointer, and a release Snaps (unit; its Chrome e2e moved to
     C2.9 for size).
  2. Past an end the Rubber band resists; a held-still release Snaps where it is.
  3. The Drag, Inertia and Snap feel right in the demo (seen in the browser, by the owner).
- **Files:** ~6: `src/carousel.ts` (or `src/drag.ts`), its test, `e2e/drag.e2e.ts`, PLAN, STATE.
- **References:** DEC-10, ARCHITECTURE "Request flow".

### C2.9 · Click guard
- **Status:** done (2026-11-23)
- **Goal:** a tap reaches the card; a drag does not click it.
- **Depends on:** C2.8, DEC-10.
- **In scope:** `dragThreshold` (px, a default from Pointer Events practice); past it, the next
  `click` is stopped in the capture phase on the Stage, and the guard is removed after that click
  or at the next `pointerdown`. Also C2.8's Drag e2e in the demo (follow, Rubber band).
- **Out of scope:** wheel and keys.
- **Contract:** none. **Public API:** additive, the `dragThreshold` option.
- **Acceptance criteria:**
  1. A tap on a card's button reaches it (e2e).
  2. A drag that ends over a button does not click it, and the next tap does.
- **Files:** ~5: `src/carousel.ts`, its test, `e2e/drag.e2e.ts`, PLAN, STATE.
- **References:** DEC-10.

### C2.10 · Wheel and keyboard
- **Status:** next
- **Goal:** a trackpad or wheel scrolls the Carousel, and arrow keys step it.
- **Depends on:** C2.9, DEC-10, DEC-14.
- **In scope:** `wheel` along the drag axis moves the Track like a Drag and Snaps after a short
  pause, preventing the page scroll only when the Track moves; with the Stage focused, the arrow
  keys of the drag axis call `next` and `previous`, Home and End go to the ends; `tabindex="0"` on
  a Stage without one (DEC-14), removed by `destroy()`.
- **Out of scope:** ARIA (M3).
- **Contract:** none. **Public API:** none.
- **Acceptance criteria:**
  1. Wheel deltas move the Track and it Snaps after the pause; at an end the page scrolls instead.
  2. Arrow keys, Home and End move the focused Carousel (e2e).
  3. `destroy()` removes the `tabindex` it added and leaves the user's own.
- **Files:** ~6: `src/carousel.ts`, its test, `e2e/keys.e2e.ts`, DECISIONS (DEC-14 only if
  changed), PLAN, STATE.
- **References:** DEC-10, DEC-14.

### C2.11 · Demo with every Preset
- **Status:** waiting (C2.10)
- **Goal:** the demo shows every Preset, the arc of cards included, and the owner checks M2.
- **Depends on:** C2.10.
- **In scope:** the demo's styles, driven by `--cs-abs-offset` and `data-cs-active` (side cards
  dimmed and smaller); the arc of cards as ARCHITECTURE "Design references" describes it (centre
  below the screen, side cards tilted and dimmed); a wavy ribbon and the loop.
- **Out of scope:** publishing the demo (M3).
- **Contract:** none. **Public API:** none.
- **Acceptance criteria:**
  1. Every Preset looks as named and moves as in M1's playground (seen in the browser, by the
     owner).
  2. The demo's look lives in `demo/` only; the library writes nothing beyond DEC-07 and DEC-14.
- **Files:** ~5: `demo/index.html`, `demo/main.ts`, `demo/style.css`, PLAN, STATE.
- **References:** ARCHITECTURE "Design references", DEC-07.

### C2.12 · Frame budget
- **Status:** waiting (C2.11)
- **Goal:** the cost of a frame is measured, not assumed.
- **Depends on:** C2.11.
- **In scope:** a trace of a drag in Chrome with 20 and 200 Slides, with and without a Wave
  (`bench/`), its method and medians written down; a fix (PLAN "Later": one integration per
  frame) is a slice of its own if a frame goes over budget.
- **Out of scope:** the fix itself.
- **Contract:** none. **Public API:** none.
- **Acceptance criteria:**
  1. The script reports the median and worst frame times of each case.
  2. The numbers and the method are recorded in `docs/ARCHITECTURE.md` (or a decision, if they
     change one).
- **Files:** ~5: `bench/frame-trace.ts`, root `package.json`, ARCHITECTURE, PLAN, STATE.
- **References:** PRODUCT "Measured, not assumed".

## Later
Ideas not planned yet; a milestone's planning picks from here.
- For M2: `LayoutContext.size` is the Slide's length along the Curve, so the engine measures the
  height in the `yz` Plane and the width otherwise (C1.3 review).
- For M2: with a Wave each Pose integrates from the centre, so N Slides cost O(N²·32) samples: 0.05
  ms a frame for 20 Slides, 6.7 ms for 200 (C1.5 review, a scratch benchmark). If the demo needs
  more, integrate once over the sorted Offsets per frame, and skip Slides beyond the visible range.

