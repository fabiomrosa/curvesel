import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type CurveOptions, curvePose, type LayoutContext, type Pose } from "../src/index.ts";

/** Relative tolerance for lengths in px: floating error, far below a visible pixel. */
const EPS = 1e-9;
const NEAR_ZERO = 1e-6;

const nearZeroCurvature = fc.double({ min: -NEAR_ZERO, max: NEAR_ZERO, noNaN: true });
// `fc.double` favours values near 0; integers spread the Curvatures over the whole range.
const anyCurvature = fc.integer({ min: -6283, max: 6283 }).map((n) => n / 1000);
const curvature = fc.oneof(nearZeroCurvature, anyCurvature);
const offset = fc.double({ min: -20, max: 20, noNaN: true });
const size = fc.double({ min: 1, max: 1000, noNaN: true });
const gap = fc.double({ min: 0, max: 200, noNaN: true });

function distance(a: Pose, b: Pose): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** The chord of a circle between two points one step apart along it, from the geometry alone. */
function chord(step: number, k: number): number {
  return Math.abs(k) <= NEAR_ZERO ? step * (1 - (k * k) / 24) : (2 * step * Math.sin(k / 2)) / k;
}

describe("curvePose invariants", () => {
  it("keeps neighbouring Slides one step apart along the Curve when it bends", () => {
    let nearZero = 0;
    let large = 0;
    fc.assert(
      fc.property(curvature, offset, size, gap, (k, o, s, g) => {
        const options: CurveOptions = { curvature: k, gap: g };
        const context: LayoutContext = { size: s };
        const step = s + g;
        const apart = distance(curvePose(o, options, context), curvePose(o + 1, options, context));
        expect(Math.abs(apart - chord(step, k))).toBeLessThan(EPS * step * 20);
        if (Math.abs(k) <= NEAR_ZERO) nearZero++;
        if (Math.abs(k) > 1) large++;
      }),
      { numRuns: 500 },
    );
    expect(nearZero).toBeGreaterThan(50);
    expect(large).toBeGreaterThan(50);
  });

  it("follows the circle without a jump as the Curvature tends to 0", () => {
    // Curvatures on both sides of any series cut-off, near 0 and a little further.
    const small = fc.oneof(nearZeroCurvature, fc.double({ min: -1e-3, max: 1e-3, noNaN: true }));
    fc.assert(
      fc.property(small, offset, size, gap, (k, o, s, g) => {
        const length = o * (s + g);
        const u = k * o;
        // The circle written another way, exact for any u ≠ 0 (no cancellation in cos − 1).
        const x = u === 0 ? length : length * (Math.sin(u) / u);
        const z = u === 0 ? 0 : (-2 * length * Math.sin(u / 2) ** 2) / u;
        const pose = curvePose(o, { curvature: k, gap: g }, { size: s });
        expect(Math.abs(pose.x - x)).toBeLessThan(EPS * (s + g) * 20);
        expect(Math.abs(pose.z - z)).toBeLessThan(EPS * (s + g) * 20);
      }),
      { numRuns: 500 },
    );
  });
});
