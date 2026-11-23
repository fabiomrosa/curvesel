import { describe, expect, it } from "vitest";
import { curvePose, type Plane, type Wave } from "../src/index.ts";

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const context = { size: 200 };

function expectRotation(actual: readonly number[], expected: readonly number[]): void {
  expected.forEach((value, i) => {
    expect(actual[i]).toBeCloseTo(value, 9);
  });
}

describe("curvePose", () => {
  it("lays Slides in a straight line when the Curvature is 0", () => {
    const pose = curvePose(3, { curvature: 0, gap: 20 }, context);
    expect(pose.x).toBeCloseTo(660, 9);
    expect(pose.y).toBeCloseTo(0, 9);
    expect(pose.z).toBeCloseTo(0, 9);
    expectRotation(pose.rotation, IDENTITY);
  });

  it("puts Offset 0 at the origin with no rotation when the Curve bends", () => {
    for (const curvature of [-2, -0.3, 0.3, 1, Math.PI]) {
      const pose = curvePose(0, { curvature, gap: 20 }, context);
      expect(Math.hypot(pose.x, pose.y, pose.z)).toBeCloseTo(0, 9);
      expectRotation(pose.rotation, IDENTITY);
    }
  });

  it("closes a cylinder when the Curvature is 2π / N", () => {
    const n = 8;
    const options = { curvature: (2 * Math.PI) / n, gap: 20 };
    const radius = 220 / options.curvature;
    const full = curvePose(n, options, context);
    expect(Math.hypot(full.x, full.y, full.z)).toBeCloseTo(0, 6);
    // A quarter of the ring: Offset 2 sits at the side of the axis, facing +x.
    const quarter = curvePose(2, options, context);
    expect(quarter.x).toBeCloseTo(radius, 9);
    expect(quarter.z).toBeCloseTo(-radius, 9);
    expectRotation(quarter.rotation, [0, 0, 1, 0, 1, 0, -1, 0, 0]);
  });

  it("turns every Slide to face outwards from the cylinder's axis", () => {
    const options = { curvature: 0.7, gap: 20 };
    const axisZ = -220 / options.curvature;
    for (const offset of [-3.5, -1, 0.25, 2, 4]) {
      const { x, z, rotation } = curvePose(offset, options, context);
      const outwards = Math.hypot(x, z - axisZ);
      // The Slide's own z axis (the third column) points from the axis to the Slide.
      expect(rotation[2]).toBeCloseTo(x / outwards, 9);
      expect(rotation[8]).toBeCloseTo((z - axisZ) / outwards, 9);
      expect(rotation[5]).toBeCloseTo(0, 9);
    }
  });

  it("throws a message naming the option when an option is invalid", () => {
    const gap = 20;
    expect(() => curvePose(0, { curvature: Number.NaN, gap }, context)).toThrow(
      "curvesel: curvature must be a finite number, got NaN",
    );
    expect(() => curvePose(0, { curvature: Number.POSITIVE_INFINITY, gap }, context)).toThrow(
      "curvesel: curvature",
    );
    expect(() => curvePose(0, { curvature: 0, gap: -1 }, context)).toThrow(
      "curvesel: gap must be a finite number ≥ 0, got -1",
    );
    expect(() => curvePose(0, { curvature: 0, gap }, { size: 0 })).toThrow(
      "curvesel: size must be a finite number > 0, got 0",
    );
    expect(() => curvePose(0, { curvature: 0, gap }, { size: Number.NaN })).toThrow(
      "curvesel: size",
    );
  });

  describe("in each Plane, a quarter turn", () => {
    // Curvature π/4 per step: Offset 2 is a quarter of the way round, R = 2·220/(π/2).
    const radius = 880 / Math.PI;
    const at = (plane: Plane) => curvePose(2, { curvature: Math.PI / 4, gap: 20, plane }, context);

    it("puts Offset 2 at the side, facing sideways, in xz by default", () => {
      const pose = curvePose(2, { curvature: Math.PI / 4, gap: 20 }, context);
      expect(pose).toEqual(at("xz"));
      expect(pose.x).toBeCloseTo(radius, 9);
      expect(pose.z).toBeCloseTo(-radius, 9);
      expectRotation(pose.rotation, [0, 0, 1, 0, 1, 0, -1, 0, 0]);
    });

    it("puts Offset 2 below, facing down, in yz (the wheel)", () => {
      const pose = at("yz");
      expect(pose.x).toBeCloseTo(0, 9);
      expect(pose.y).toBeCloseTo(radius, 9);
      expect(pose.z).toBeCloseTo(-radius, 9);
      // Its own y axis points away from the viewer; its face (z axis) points down.
      expectRotation(pose.rotation, [1, 0, 0, 0, 0, 1, 0, -1, 0]);
    });

    it("puts Offset 2 to the side and down, turned a quarter in the screen, in xy (the arc)", () => {
      const pose = at("xy");
      expect(pose.x).toBeCloseTo(radius, 9);
      expect(pose.y).toBeCloseTo(radius, 9);
      expect(pose.z).toBeCloseTo(0, 9);
      // Its own x axis points down the screen; it still faces the viewer.
      expectRotation(pose.rotation, [0, -1, 0, 1, 0, 0, 0, 0, 1]);
    });
  });

  it("throws a message naming the Plane when it is unknown", () => {
    const plane = "zz" as Plane;
    expect(() => curvePose(0, { curvature: 0, gap: 20, plane }, context)).toThrow(
      `curvesel: plane must be "xz", "yz" or "xy", got "zz"`,
    );
  });

  describe("visible range", () => {
    const options = { curvature: 0.3, gap: 20, visibleRange: 2 };

    it("shows every Slide when no visible range is set", () => {
      expect(curvePose(40, { curvature: 0.3, gap: 20 }, context).visible).toBe(true);
    });

    it("shows a Slide within the visible range and hides it beyond", () => {
      expect(curvePose(2, options, context).visible).toBe(true);
      expect(curvePose(-2, options, context).visible).toBe(true);
      expect(curvePose(2.01, options, context).visible).toBe(false);
      expect(curvePose(-2.5, options, context).visible).toBe(false);
    });

    it("throws a message naming the visible range when it is negative", () => {
      expect(() => curvePose(0, { ...options, visibleRange: -1 }, context)).toThrow(
        "curvesel: visibleRange must be a number ≥ 0, got -1",
      );
      expect(() => curvePose(0, { ...options, visibleRange: Number.NaN }, context)).toThrow(
        "curvesel: visibleRange",
      );
    });
  });

  it("stacks the Slide nearer the centre above when two are at the same depth", () => {
    // In the screen's Plane every Slide is at z = 0; between two Slides the Track is at 0.3.
    const options = { curvature: 0.2, gap: 20, plane: "xy" as const };
    const nearer = curvePose(0.7, options, context);
    const farther = curvePose(-1.3, options, context);
    expect(nearer.zIndex).toBeGreaterThan(farther.zIndex);
  });

  describe("with a Wave", () => {
    const wave = { amplitude: 0.5, wavelength: 4 };

    it("keeps a wavy ribbon level by default: one wavelength on, at the same depth", () => {
      const pose = curvePose(4, { curvature: 0, gap: 20, wave }, context);
      expect(pose.z).toBeCloseTo(0, 6);
      expect(pose.x).toBeGreaterThan(0);
    });

    it("matches the Curve without a Wave when the amplitude tends to 0", () => {
      for (const curvature of [0, 0.3, -1, Math.PI / 2]) {
        for (const offset of [-7.5, -1, 0.25, 3]) {
          const plain = curvePose(offset, { curvature, gap: 20 }, context);
          const flat = { amplitude: 0, wavelength: 3 };
          const waved = curvePose(offset, { curvature, gap: 20, wave: flat }, context);
          // Simpson's error, relative to the length: far below a pixel.
          const tolerance = 1e-7 * Math.abs(offset) * 220 + 1e-12;
          expect(Math.hypot(waved.x - plain.x, waved.z - plain.z)).toBeLessThan(tolerance);
          expectRotation(waved.rotation, plain.rotation);
        }
      }
    });

    it("turns back to the centre's heading after one wavelength when the Curvature is 0", () => {
      for (const phase of [0, 1, -2.5]) {
        const pose = curvePose(4, { curvature: 0, gap: 20, wave: { ...wave, phase } }, context);
        expectRotation(pose.rotation, IDENTITY);
      }
    });

    it("keeps Offset 0 at the origin with no rotation", () => {
      const pose = curvePose(0, { curvature: 0.4, gap: 20, wave: { ...wave, phase: 1 } }, context);
      expect(Math.hypot(pose.x, pose.y, pose.z)).toBeCloseTo(0, 9);
      expectRotation(pose.rotation, IDENTITY);
    });

    describe("anchored to the ribbon", () => {
      const ribbon = { ...wave, phase: 0.4, anchor: "ribbon" as const };
      const options = (w: Wave) => ({ curvature: 0.2, gap: 20, wave: w });

      it("moves the Wave with the Position", () => {
        for (const position of [-3.7, 0.25, 1, 6]) {
          const shifted = { ...wave, phase: 0.4 + (2 * Math.PI * position) / 4 };
          for (const offset of [-2, 0.5, 3]) {
            const moving = curvePose(offset, options(ribbon), { size: 200, position });
            const fixed = curvePose(offset, options(shifted), { size: 200 });
            expect(Math.hypot(moving.x - fixed.x, moving.z - fixed.z)).toBeLessThan(1e-9);
            expectRotation(moving.rotation, fixed.rotation);
          }
        }
      });

      it("moves the default phase with the Position when no phase is given", () => {
        const travelling = { ...wave, anchor: "ribbon" as const };
        const shifted = { ...wave, phase: Math.PI / 2 + (2 * Math.PI * 1.3) / 4 };
        const moving = curvePose(2.5, options(travelling), { size: 200, position: 1.3 });
        const fixed = curvePose(2.5, options(shifted), { size: 200 });
        expect(Math.hypot(moving.x - fixed.x, moving.z - fixed.z)).toBeLessThan(1e-9);
        expectRotation(moving.rotation, fixed.rotation);
      });

      it("repeats the Poses one wavelength later", () => {
        const now = curvePose(2.5, options(ribbon), { size: 200, position: 1.3 });
        const later = curvePose(2.5, options(ribbon), { size: 200, position: 5.3 });
        expect(Math.hypot(now.x - later.x, now.z - later.z)).toBeLessThan(1e-6);
        expectRotation(later.rotation, now.rotation);
      });

      it("leaves a Wave anchored in space where it is when the Position changes", () => {
        const space = { ...wave, anchor: "space" as const };
        const here = curvePose(2.5, options(space), { size: 200, position: 0 });
        const there = curvePose(2.5, options(space), { size: 200, position: 3.3 });
        expect(there).toEqual(here);
      });

      it("throws a message naming the anchor or the Position when either is invalid", () => {
        const bad = { ...wave, anchor: "floor" as NonNullable<Wave["anchor"]> };
        expect(() => curvePose(0, options(bad), context)).toThrow(
          `curvesel: wave.anchor must be "space" or "ribbon", got "floor"`,
        );
        expect(() => curvePose(0, options(ribbon), { size: 200, position: Number.NaN })).toThrow(
          "curvesel: position must be a finite number, got NaN",
        );
      });
    });

    describe("across the Plane", () => {
      const across = { ...wave, plane: "y" as const };

      it("pitches each Slide by the integral of the Wave", () => {
        // Default phase π/2: over [0, 1] the pitch is 0.5·(4/2π)·sin(π/2) = 1/π, tilting down.
        const pose = curvePose(1, { curvature: 0, gap: 20, wave: across }, context);
        const [c, s] = [Math.cos(1 / Math.PI), Math.sin(1 / Math.PI)];
        expectRotation(pose.rotation, [c, -s, 0, s, c, 0, 0, 0, 1]);
      });

      it("pitches across the wheel (x) and across the arc (z, towards the viewer)", () => {
        const [c, s] = [Math.cos(1 / Math.PI), Math.sin(1 / Math.PI)];
        const wheel = curvePose(1, { curvature: 0, gap: 20, plane: "yz", wave: across }, context);
        expectRotation(wheel.rotation, [c, s, 0, -s, c, 0, 0, 0, 1]);
        const arc = curvePose(1, { curvature: 0, gap: 20, plane: "xy", wave: across }, context);
        expectRotation(arc.rotation, [c, 0, -s, 0, 1, 0, s, 0, c]);
      });

      it("waves a flat ribbon up and down in the screen, at no depth", () => {
        const at = (offset: number) =>
          curvePose(offset, { curvature: 0, gap: 20, wave: across }, context);
        for (const offset of [-3, 0.7, 1, 2, 5.5]) expect(at(offset).z).toBeCloseTo(0, 9);
        expect(at(2).y).toBeGreaterThan(50);
        expect(at(4).y).toBeCloseTo(0, 6);
        expect(at(4).x).toBeLessThan(4 * 220);
      });

      it("closes a ring whose length is a whole number of wavelengths, its height waving", () => {
        const ring = { curvature: (2 * Math.PI) / 12, gap: 20, wave: { ...across, wavelength: 3 } };
        const full = curvePose(12, ring, context);
        expect(Math.hypot(full.x, full.y, full.z)).toBeLessThan(1e-6);
        expectRotation(full.rotation, IDENTITY);
        expect(Math.abs(curvePose(1.5, ring, context).y)).toBeGreaterThan(20);
      });

      it("throws a message naming the Wave's plane when it is unknown", () => {
        const bad = { ...wave, plane: "x" as NonNullable<Wave["plane"]> };
        expect(() => curvePose(0, { curvature: 0, gap: 20, wave: bad }, context)).toThrow(
          `curvesel: wave.plane must be "z" or "y", got "x"`,
        );
      });
    });

    it("throws a message naming the Wave option when it is invalid", () => {
      const at = (w: Wave) => () => curvePose(0, { curvature: 0, gap: 20, wave: w }, context);
      expect(at({ amplitude: 0.5, wavelength: 0 })).toThrow(
        "curvesel: wave.wavelength must be a finite number > 0, got 0",
      );
      expect(at({ amplitude: Number.NaN, wavelength: 4 })).toThrow(
        "curvesel: wave.amplitude must be a finite number, got NaN",
      );
      expect(at({ amplitude: 0.5, wavelength: 4, phase: Number.POSITIVE_INFINITY })).toThrow(
        "curvesel: wave.phase must be a finite number, got Infinity",
      );
    });

    it("turns each Slide by the integral of the Curvature", () => {
      // κ(s) = 0.5·sin(2πs/4): over [0, 1] the heading turns 0.5·(4/2π)·(1 − cos(π/2)) = 1/π.
      const pose = curvePose(1, { curvature: 0, gap: 20, wave: { ...wave, phase: 0 } }, context);
      expectRotation(pose.rotation, [
        Math.cos(1 / Math.PI),
        0,
        Math.sin(1 / Math.PI),
        0,
        1,
        0,
        -Math.sin(1 / Math.PI),
        0,
        Math.cos(1 / Math.PI),
      ]);
    });
  });

  describe("with a Twist", () => {
    it("turns each Slide around its tangent by the Twist times its Offset", () => {
      // rotateY(π/2) · rotateX(0.6): a quarter turn of the Curve, then 2 · 0.3 around the tangent.
      const options = { curvature: Math.PI / 4, gap: 20, twist: 0.3 };
      const [c, s] = [Math.cos(0.6), Math.sin(0.6)];
      expectRotation(curvePose(2, options, context).rotation, [0, s, c, 0, c, -s, -1, 0, 0]);
    });

    it("turns the other way on the other side of the centre", () => {
      // Offset −2 of a flat ribbon: rotateX(−0.6).
      const options = { curvature: 0, gap: 20, twist: 0.3 };
      const [c, s] = [Math.cos(0.6), Math.sin(0.6)];
      expectRotation(curvePose(-2, options, context).rotation, [1, 0, 0, 0, c, s, 0, -s, c]);
    });

    it("turns the wheel's Slides around their tangent, the Slide's own y axis", () => {
      const options = { curvature: 0, gap: 20, plane: "yz" as const, twist: 0.3 };
      const [c, s] = [Math.cos(0.6), Math.sin(0.6)];
      expectRotation(curvePose(2, options, context).rotation, [c, 0, s, 0, 1, 0, -s, 0, c]);
    });

    it("leaves every position and Offset 0 where they were", () => {
      for (const offset of [-3, 0, 1.5]) {
        const plain = curvePose(offset, { curvature: 0.4, gap: 20 }, context);
        const twisted = curvePose(offset, { curvature: 0.4, gap: 20, twist: 0.7 }, context);
        expect([twisted.x, twisted.y, twisted.z]).toEqual([plain.x, plain.y, plain.z]);
      }
      const centre = curvePose(0, { curvature: 0.4, gap: 20, twist: 0.7 }, context);
      expectRotation(centre.rotation, IDENTITY);
    });

    it("throws a message naming the Twist when it is not a finite number", () => {
      expect(() => curvePose(0, { curvature: 0, gap: 20, twist: Number.NaN }, context)).toThrow(
        "curvesel: twist must be a finite number, got NaN",
      );
    });
  });
});
