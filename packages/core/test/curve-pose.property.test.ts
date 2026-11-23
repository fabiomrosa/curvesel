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

  describe("with a Wave", () => {
    // Curvatures up to π/2 and amplitudes up to 1 per step, wavelengths from 1 to 20 Slides.
    const base = fc.integer({ min: -1571, max: 1571 }).map((n) => n / 1000);
    const wave = fc.record({
      amplitude: fc.integer({ min: -1000, max: 1000 }).map((n) => n / 1000),
      wavelength: fc.integer({ min: 100, max: 2000 }).map((n) => n / 100),
      phase: fc.integer({ min: -3142, max: 3142 }).map((n) => n / 1000),
      anchor: fc.constantFrom("space" as const, "ribbon" as const),
      plane: fc.constantFrom("z" as const, "y" as const),
    });
    const twist = fc.integer({ min: -2000, max: 2000 }).map((n) => n / 1000);
    // Spread over the range: `fc.double` would favour Positions near 0, where the ribbon barely moves.
    const position = fc.integer({ min: -2000, max: 2000 }).map((n) => n / 100);

    it("keeps the Slides on the Curve, one step apart, turned with it, with any Twist", () => {
      fc.assert(
        fc.property(
          base,
          wave,
          plane,
          offset,
          size,
          gap,
          position,
          twist,
          (c, w, p, o, s, g, t, tw) => {
            const options: CurveOptions = { curvature: c, gap: g, plane: p, wave: w, twist: tw };
            const at = (u: number) => curvePose(u, options, { size: s, position: t });
            // Twist turns the Slides only: positions are those without it.
            const untwisted = curvePose(o, { ...options, twist: 0 }, { size: s, position: t });
            expect(distance(at(o), untwisted)).toBeLessThanOrEqual(EPS);
            // ... and by `twist · offset`: measured from the untwisted columns around the tangent.
            const column = (r: readonly number[], j: number) =>
              [0, 1, 2].map((i) => r[3 * i + j] ?? 0);
            const dot = (u: number[], v: number[]) =>
              u.reduce((sum, x, i) => sum + x * (v[i] ?? 0), 0);
            const [first, second] = p === "yz" ? [2, 0] : [1, 2];
            const turned = column(at(o).rotation, first);
            const angle = Math.atan2(
              dot(turned, column(untwisted.rotation, second)),
              dot(turned, column(untwisted.rotation, first)),
            );
            const expected = tw * o;
            expect(
              Math.abs(Math.atan2(Math.sin(angle - expected), Math.cos(angle - expected))),
            ).toBeLessThan(1e-9);
            const step = s + g;
            // Offset 0 stays at the origin, facing the viewer.
            const centre = at(0);
            expect(Math.hypot(centre.x, centre.y, centre.z)).toBeLessThanOrEqual(EPS);
            centre.rotation.forEach((value, i) => {
              expect(Math.abs(value - (i % 4 === 0 ? 1 : 0))).toBeLessThanOrEqual(EPS);
            });
            // Along a densely sampled Curve, neighbours are one step apart.
            let length = 0;
            for (let i = 0; i < 64; i++) length += distance(at(o + i / 64), at(o + (i + 1) / 64));
            expect(Math.abs(length - step)).toBeLessThan(1e-3 * step);
            // Every rotation is proper: orthonormal columns, determinant 1 (no mirror).
            const [a0, a1, a2, b0, b1, b2, c0, c1, c2] = at(o).rotation;
            const columns = [
              [a0, b0, c0],
              [a1, b1, c1],
              [a2, b2, c2],
            ];
            for (const [i, u] of columns.entries()) {
              for (const [j, v] of columns.entries()) {
                const dot =
                  (u[0] ?? 0) * (v[0] ?? 0) + (u[1] ?? 0) * (v[1] ?? 0) + (u[2] ?? 0) * (v[2] ?? 0);
                expect(Math.abs(dot - (i === j ? 1 : 0))).toBeLessThan(1e-9);
              }
            }
            const det =
              a0 * (b1 * c2 - b2 * c1) - a1 * (b0 * c2 - b2 * c0) + a2 * (b0 * c1 - b1 * c0);
            expect(Math.abs(det - 1)).toBeLessThan(1e-9);
            // The Curve's direction at the Slide is the Slide's own axis along it.
            const [before, here, after] = [at(o - 0.01), at(o), at(o + 0.01)];
            const j = p === "yz" ? 1 : 0;
            const direction = [after.x - before.x, after.y - before.y, after.z - before.z];
            direction.forEach((d, i) => {
              const axis = here.rotation[3 * i + j] ?? Number.NaN;
              expect(Math.abs(d / (0.02 * step) - axis)).toBeLessThan(1e-3);
            });
          },
        ),
        { numRuns: 300 },
      );
    });
  });
});
