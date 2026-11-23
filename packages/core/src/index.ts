/** The public API of `@curvesel/core`. */
export {
  type CurveOptions,
  curvePose,
  type LayoutContext,
  type Plane,
  type Wave,
} from "./curve-pose.ts";
export { type Layout, rotationFromAngles } from "./layout.ts";
export type { Pose, Rotation } from "./pose.ts";
export { type PresetName, presets } from "./presets.ts";
export { slideOffset } from "./slide-offset.ts";
export {
  createTrack,
  dragMove,
  dragStart,
  release,
  step,
  type TrackOptions,
  type TrackState,
} from "./track.ts";
