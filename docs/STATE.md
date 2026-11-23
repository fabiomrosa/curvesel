# curvesel state

What exists in this repository now. The code wins over this file: if they disagree, fix this file.
Every slice's pull request updates it (SESSION §3).

## Capabilities
- The npm workspace builds, formats, lints, type-checks and tests with one command,
  `npm run verify`, which CI runs in the `gate` job (plus the title, size, frozen-files and secret
  checks). Coverage below 80% of lines fails it.
- `curvePose(offset, { curvature, gap }, { size })`: the Pose of a Slide on a Curve of constant
  Curvature in the `xz` Plane, from a flat ribbon (0) to a closed cylinder (`2π / N`), exact
  through `κ = 0`. Invalid options throw `curvesel:` errors.

## Modules
- `packages/core` (`@curvesel/core`): `curve-pose.ts` (`curvePose`, `CurveOptions`,
  `LayoutContext`), `pose.ts` (`Pose`, `Rotation`, a row-major 3×3 matrix).

## Known issues
None.

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
- **Next:** C1.2 (playground).
