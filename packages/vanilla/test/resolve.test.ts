// @vitest-environment happy-dom
import { curvePose } from "@curvesel/core";
import { expect, it } from "vitest";

it("reaches core's source and a DOM, before any build", () => {
  expect(curvePose(0, { curvature: 0, gap: 0 }, { size: 1 }).x).toBeCloseTo(0, 12);
  expect(document.createElement("div").tagName).toBe("DIV");
});
