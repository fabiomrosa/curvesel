# curvesel conventions

The exact shape of the code. Match it exactly; when something is not covered here, follow the nearest
existing code and propose an addition to this file in the pull request.

Rules are checked by the review (`curvesel-code-review`) unless tagged with the check that enforces
them (**[lint]**, **[test]**). A rule gets a mechanical check only when a real mistake shows it is
needed (DEC-03).

## 1. One role per file
- One exported class or function family per file, named after it.
- `src/index.ts` of each package is its public API and only re-exports.
- Layering: `core` ← engine ← adapters. A lower layer never imports a higher one.

## 2. Layout
```
packages/<name>/
  package.json
  src/
    index.ts           public API
    <thing>.ts
  test/
    <thing>.test.ts
```

## 3. Naming
- Files in kebab-case (`curve-pose.ts`); types and classes in PascalCase; functions and variables in
  camelCase.
- Domain names are exactly the Terms of `docs/shared/PRODUCT.md` (Carousel, Stage, Slide, Track,
  Position, Offset, Curve, Curvature, Wave, Twist, Tilt, Plane, Layout, Pose, Preset).
- Angles are radians in code and options; lengths are CSS pixels; time is seconds.
- Events are nouns of what happened: `change` (Position), `select` (Active slide).
- State the user may style: attributes start with `data-cs-` (e.g. `data-cs-active`), CSS variables
  with `--cs-` (e.g. `--cs-offset`).

## 4. Errors
- Bad input at mount or in a public call (a missing Stage, an invalid option, an index out of
  range) throws an `Error` whose message starts with `curvesel:` and names the value.
- Nothing is logged with `console` in library code.
- A loop in library code that runs until a condition holds also has a count bound, as `step` bounds
  its pieces: a loop that stops making progress then fails a test instead of hanging Vitest
  (GOTCHAS).

## 5. Tests
| Behaviour | Seam | Test |
|---|---|---|
| A Layout or physics behaviour | the `core` public API | `packages/core/test/<thing>.test.ts`, `it('<does what> when <case>')` |
| A PRODUCT invariant | the `core` public API, random options and Offsets (or `dt` sequences) | property test beside the unit tests |
| An engine behaviour | the engine with `happy-dom`, synthetic pointer events and a fake clock for `requestAnimationFrame` | `packages/vanilla/test/<thing>.test.ts` |
| A real gesture | the demo page in Playwright | `e2e/<flow>.e2e.ts` (from M2) |

**Numbers** are compared with a tolerance (`toBeCloseTo`, or a shared `EPS` for property tests),
never with `toBe`.

**Property tests** assert that they reached their interesting outcomes (a minimum count of each),
so a weak generator fails instead of passing blind. A property earns trust by going red:
- its tolerance is seen red against a small wrong variant of the formula it guards (a flipped sign,
  a wrong coefficient);
- its oracle compares raw values within the documented tolerance, computed independently of the
  code's own rounding or bucketing;
- a case the generator reaches rarely also gets a deterministic example test;
- numeric generators are integer-mapped (`fc.integer(...).map`) for an even spread, unless the bias
  towards 0 is the point (GOTCHAS "Property tests");
- a floating-point boundary is probed ulp by ulp around it, as `slide-offset.test.ts` does.

**Benchmarks** build their fixtures outside the timing, warm up each side, alternate which side runs
first, and report a median; a decision record states the method next to the numbers.

**Coverage floor:** 80% of lines (`--coverage.thresholds.lines` in the root `test:coverage` script),
measured by the gate over `packages/*/src` (tests and configuration excluded). It is raised when
coverage grows past it and lowered only with the owner's ok. A floor proves tests exist, not that
they came first: the "Seen red" line of the pull request does that.

## 6. Formatting and style
Biome's formatter and its recommended lint rules, configured in `biome.json` **[lint]**. Markdown
and `.claude/` are outside Biome. No `any` without a comment saying why.
