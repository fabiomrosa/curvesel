import { describe, expect, it } from "vitest";
import { curvePose, type Layout, presets, rotationFromAngles } from "../src/index.ts";

function expectRotation(actual: readonly number[], expected: readonly number[]): void {
  expected.forEach((value, i) => {
    expect(actual[i]).toBeCloseTo(value, 9);
  });
}

const QUARTER = Math.PI / 2;

describe("rotationFromAngles", () => {
  it("matches CSS rotateX, rotateY and rotateZ for a quarter turn around each axis", () => {
    // CSS axes: x right, y down, z towards the viewer; columns are where x, y and z go.
    expectRotation(rotationFromAngles(QUARTER, 0, 0), [1, 0, 0, 0, 0, -1, 0, 1, 0]);
    expectRotation(rotationFromAngles(0, QUARTER, 0), [0, 0, 1, 0, 1, 0, -1, 0, 0]);
    expectRotation(rotationFromAngles(0, 0, QUARTER), [0, -1, 0, 1, 0, 0, 0, 0, 1]);
  });

  it("composes in the order of `rotateX(rx) rotateY(ry) rotateZ(rz)`", () => {
    // rotateX(π/2) · rotateY(π/2), multiplied by hand.
    expectRotation(rotationFromAngles(QUARTER, QUARTER, 0), [0, 0, 1, 1, 0, 0, 0, 1, 0]);
    // rotateX(π/2) · rotateY(π/2) · rotateZ(π/2), multiplied by hand: pins the order of all three.
    expectRotation(rotationFromAngles(QUARTER, QUARTER, QUARTER), [0, 0, 1, 0, -1, 0, 1, 0, 0]);
  });

  it("throws a message naming the angle when it is not a finite number", () => {
    expect(() => rotationFromAngles(0, Number.NaN, 0)).toThrow(
      "curvesel: ry must be a finite number, got NaN",
    );
  });
});

describe("Layout", () => {
  it("is satisfied by curvePose with its options bound, and by a custom function", () => {
    const arc: Layout = (offset, context) => curvePose(offset, presets.arc, context);
    const stack: Layout = (offset) => ({
      x: 0,
      y: offset * 10,
      z: -Math.abs(offset) * 50,
      rotation: rotationFromAngles(0, 0, offset * 0.1),
      zIndex: 100 - Math.round(Math.abs(offset)),
      visible: Math.abs(offset) <= 3,
    });
    expect(arc(0, { size: 200 }).visible).toBe(true);
    expect(stack(2, { size: 200 }).y).toBeCloseTo(20, 9);
  });
});

describe("presets", () => {
  const context = { size: 200 };

  it("closes the cylinder in 10 Slides and hides its back half", () => {
    const full = curvePose(10, presets.cylinder, context);
    expect(Math.hypot(full.x, full.y, full.z)).toBeLessThan(1e-6);
    expect(curvePose(2, presets.cylinder, context).visible).toBe(true);
    expect(curvePose(3, presets.cylinder, context).visible).toBe(false);
  });

  it("lays the ribbon flat, the wheel in yz and the arc in the screen with its centre below", () => {
    expect(curvePose(3, presets.ribbon, context).z).toBeCloseTo(0, 9);
    const wheel = curvePose(2.5, presets.wheel, context);
    expect(wheel.x).toBeCloseTo(0, 9);
    expect(wheel.y).toBeGreaterThan(0);
    const arc = curvePose(2, presets.arc, context);
    expect(arc.z).toBeCloseTo(0, 9);
    expect(arc.y).toBeGreaterThan(0);
  });

  it("cannot be changed by accident", () => {
    expect(Object.isFrozen(presets)).toBe(true);
    for (const preset of Object.values(presets)) expect(Object.isFrozen(preset)).toBe(true);
  });
});
