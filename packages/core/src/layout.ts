import type { LayoutContext } from "./curve-pose.ts";
import type { Pose, Rotation } from "./pose.ts";

/** A Layout: from a Slide's Offset (and what the engine measured) to its Pose. Must be pure. */
export type Layout = (offset: number, context: LayoutContext) => Pose;

/**
 * The rotation of CSS `rotateX(rx) rotateY(ry) rotateZ(rz)` (radians), for custom Layouts:
 * `Rx · Ry · Rz`, so the Slide turns around z first, then y, then x.
 */
export function rotationFromAngles(rx: number, ry: number, rz: number): Rotation {
  for (const [name, angle] of [
    ["rx", rx],
    ["ry", ry],
    ["rz", rz],
  ] as const) {
    if (!Number.isFinite(angle)) {
      throw new Error(`curvesel: ${name} must be a finite number, got ${angle}`);
    }
  }
  const [cx, sx, cy, sy, cz, sz] = [rx, ry, rz].flatMap((a) => [Math.cos(a), Math.sin(a)]) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  return [
    cy * cz,
    -cy * sz,
    sy,
    cx * sz + sx * sy * cz,
    cx * cz - sx * sy * sz,
    -sx * cy,
    sx * sz - cx * sy * cz,
    sx * cz + cx * sy * sz,
    cx * cy,
  ];
}
