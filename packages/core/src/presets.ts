import type { CurveOptions } from "./curve-pose.ts";

export type PresetName = "cylinder" | "ribbon" | "wheel" | "arc";

const cylinder: CurveOptions = Object.freeze({
  curvature: (2 * Math.PI) / 10, // a closed ring of 10 Slides
  gap: 20,
  visibleRange: 2.5, // the back half hidden
});

/** The named variants of the one Curve (DEC-08): plain option objects, frozen. */
export const presets: Readonly<Record<PresetName, CurveOptions>> = Object.freeze({
  cylinder,
  ribbon: Object.freeze({ curvature: 0, gap: 20 }),
  wheel: Object.freeze({ ...cylinder, plane: "yz" }),
  // In the screen, bending downwards: the centre below, the side Slides dropping and turning.
  arc: Object.freeze({ curvature: 0.2, gap: 20, plane: "xy", visibleRange: 3 }),
});
