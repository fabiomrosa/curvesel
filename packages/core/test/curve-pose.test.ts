import { describe, expect, it } from "vitest";
import { curvePose, type Plane } from "../src/index.ts";

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
});
