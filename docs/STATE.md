# curvesel state

What exists in this repository now. The code wins over this file: if they disagree, fix this file.
Every slice's pull request updates it (SESSION §3).

## Capabilities
- The npm workspace builds, formats, lints, type-checks and tests with one command,
  `npm run verify`, which CI runs in the `gate` job (plus the title, size, frozen-files and secret
  checks). Coverage below 80% of lines fails it.
- `curvePose(offset, { curvature, gap, plane, wave, visibleRange }, { size, position })`: the Pose
  of a Slide on a Curve of constant Curvature in the `xz` (default), `yz` (wheel: down the screen,
  bending away) or `xy` (arc: in the screen, the centre below) Plane, from a flat ribbon (0) to a
  closed cylinder (`2π / N`), exact through `κ = 0`. A Wave (`amplitude`, `wavelength`, `phase`,
  `plane`) makes it undulate in its Plane (`z`) or across it (`y`, pitching the Slides), fixed
  relative to the centre (`anchor: 'space'`) or travelling with the Slides (`'ribbon'`, the phase
  shifted by `2π·position / wavelength`; the ribbon rocks as it moves, since the Active slide keeps
  facing the viewer). `twist` turns each Slide by `twist · offset` around its tangent; `tilt` leans the whole Curve around the view axis, the Slides staying upright. Each Pose says whether it is `visible` and its `zIndex` (nearer the viewer above; at equal depth, nearer the
  centre above). Invalid options throw `curvesel:` errors.
- The playground (`npm run dev`): top, front and side views of N Slides, a Plane selector and
  sliders for count, Curvature, gap, size, the Wave with its plane and anchor, the Position (Slides
  at `index − position`) and visible range (hidden Slides dashed, painted in `zIndex` order), and a
  button that closes the ring; errors show on the page.

## Modules
- `packages/core` (`@curvesel/core`): `curve-pose.ts` (`curvePose`, `CurveOptions`,
  `LayoutContext`, `Plane`), `pose.ts` (`Pose`, `Rotation`, a row-major 3×3 matrix).
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
- **Next:** C1.9 (Tilt).
