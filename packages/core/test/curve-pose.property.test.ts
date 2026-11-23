import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type CurveOptions,
  curvePose,
  type LayoutContext,
  type Plane,
  type Pose,
} from "../src/index.ts";

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
const plane = fc.constantFrom<Plane>("xz", "yz", "xy");

/** A Pose in its Curve's own Plane: along the Curve's first axis, towards its bend, and off it. */
function inPlane({ x, y, z }: Pose, p: Plane): [along: number, bend: number, off: number] {
  if (p === "yz") return [y, z, x];
  if (p === "xy") return [x, -y, z];
  return [x, z, y];
}

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
    const planes = new Map<Plane, number>();
    fc.assert(
      fc.property(curvature, offset, size, gap, plane, (k, o, s, g, p) => {
        const options: CurveOptions = { curvature: k, gap: g, plane: p };
        const context: LayoutContext = { size: s };
        const step = s + g;
        const apart = distance(curvePose(o, options, context), curvePose(o + 1, options, context));
        expect(Math.abs(apart - chord(step, k))).toBeLessThan(EPS * step * 20);
        if (Math.abs(k) <= NEAR_ZERO) nearZero++;
        if (Math.abs(k) > 1) large++;
        planes.set(p, (planes.get(p) ?? 0) + 1);
      }),
      { numRuns: 500 },
    );
    expect(nearZero).toBeGreaterThan(50);
    expect(large).toBeGreaterThan(50);
    expect(planes.size).toBe(3);
    for (const n of planes.values()) expect(n).toBeGreaterThan(50);
  });

  it("follows the circle without a jump as the Curvature tends to 0", () => {
    // Curvatures on both sides of any series cut-off, near 0 and a little further.
    const small = fc.oneof(nearZeroCurvature, fc.double({ min: -1e-3, max: 1e-3, noNaN: true }));
    fc.assert(
      fc.property(small, offset, size, gap, plane, (k, o, s, g, p) => {
        const length = o * (s + g);
        const u = k * o;
        // The circle written another way, exact for any u ≠ 0 (no cancellation in cos − 1).
        const x = u === 0 ? length : length * (Math.sin(u) / u);
        const z = u === 0 ? 0 : (-2 * length * Math.sin(u / 2) ** 2) / u;
        const [along, bend, off] = inPlane(
          curvePose(o, { curvature: k, gap: g, plane: p }, { size: s }),
          p,
        );
        // Relative to the length, tight enough to catch a wrong series coefficient.
        expect(Math.abs(along - x)).toBeLessThanOrEqual(1e-11 * Math.abs(length));
        expect(Math.abs(bend - z)).toBeLessThanOrEqual(1e-11 * Math.abs(length));
        expect(Math.abs(off)).toBeLessThanOrEqual(EPS);
      }),
      { numRuns: 500 },
    );
  });

  it("stacks the Slide nearer the viewer above, and at equal depth the one nearer the centre", () => {
    let deeper = 0;
    let level = 0;
    const position = fc.double({ min: -20, max: 20, noNaN: true });
    // Small indexes make pairs less than one Offset apart in distance from the centre common.
    const index = fc.oneof(fc.integer({ min: -2, max: 2 }), fc.integer({ min: -30, max: 30 }));
    // Exact 0 and the xy Plane make Slides at equal depth common.
    const k = fc.oneof(fc.constant(0), curvature);
    fc.assert(
      fc.property(k, plane, size, gap, position, index, index, (c, p, s, g, at, i, j) => {
        fc.pre(i !== j);
        const options: CurveOptions = { curvature: c, gap: g, plane: p };
        const a = curvePose(i - at, options, { size: s });
        const b = curvePose(j - at, options, { size: s });
        for (const { zIndex } of [a, b]) {
          expect(Number.isInteger(zIndex)).toBe(true);
          expect(zIndex).toBeGreaterThanOrEqual(0);
          expect(zIndex).toBeLessThanOrEqual(2 ** 31 - 1);
        }
        const step = s + g;
        // Each pair both ways round: `front` is the one expected above.
        for (const [front, back, nearer, farther] of [
          [a, b, i - at, j - at],
          [b, a, j - at, i - at],
        ] as const) {
          if (front.z > back.z + step / 100) {
            expect(front.zIndex).toBeGreaterThan(back.zIndex);
            deeper++;
          } else if (
            // The documented tolerance: 1/100 of an Offset, for Slides within 99 of the centre.
            front.z === back.z &&
            Math.abs(nearer) + 1 / 100 < Math.abs(farther) &&
            Math.abs(farther) < 99
          ) {
            expect(front.zIndex).toBeGreaterThan(back.zIndex);
            level++;
          }
        }
      }),
      { numRuns: 2000 },
    );
    expect(deeper).toBeGreaterThan(100);
    expect(level).toBeGreaterThan(100);
  });
});
