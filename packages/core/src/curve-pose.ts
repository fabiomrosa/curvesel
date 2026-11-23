import type { Pose } from "./pose.ts";

/** Where the Curve bends: `xz` in depth, `yz` vertically in depth (a wheel), `xy` in the screen. */
export type Plane = "xz" | "yz" | "xy";

/** The Curve's options. Lengths along the Curve count Slide steps (`size + gap`). */
export interface CurveOptions {
  /** Radians of bend per Slide step: 0 is a flat ribbon, `2π / N` closes a cylinder of N Slides. */
  readonly curvature: number;
  /** The space between neighbouring Slides along the Curve, in px. */
  readonly gap: number;
  /** Where the Curve bends; `xz` by default. */
  readonly plane?: Plane;
  /** How far from the centre, in Offsets, a Slide is still shown; every Slide by default. */
  readonly visibleRange?: number;
}

/** What the engine measures and passes to every Layout. */
export interface LayoutContext {
  /** The slide size along the Curve, in px. */
  readonly size: number;
}

const PLANES: readonly Plane[] = ["xz", "yz", "xy"];

// The stacking order: depth in buckets of 1/100 of a step, each bucket split by the distance from
// the centre in 1/100 of an Offset, up to 100 Offsets. The base keeps it within CSS's 0 to 2³¹ − 1
// for a depth within ±1000 steps.
const DEPTH_BUCKETS_PER_STEP = 100;
const DISTANCE_STEPS_PER_OFFSET = 100;
const DISTANCES_PER_BUCKET = 100 * DISTANCE_STEPS_PER_OFFSET;
const Z_INDEX_BASE = 1e9;
const Z_INDEX_MAX = 2 ** 31 - 1;

/** Below this turn (radians), `sin(u)/u` and `(cos(u) − 1)/u` use their series, error under 1e-22. */
const SERIES_LIMIT = 1e-4;

/**
 * The Pose of the Slide at `offset` on a Curve of constant Curvature: a circle of radius
 * `step / curvature` through the origin in the chosen Plane, tangent to its first axis there.
 */
export function curvePose(offset: number, options: CurveOptions, context: LayoutContext): Pose {
  if (!Number.isFinite(options.curvature)) {
    throw new Error(`curvesel: curvature must be a finite number, got ${options.curvature}`);
  }
  if (!(Number.isFinite(options.gap) && options.gap >= 0)) {
    throw new Error(`curvesel: gap must be a finite number ≥ 0, got ${options.gap}`);
  }
  const plane = options.plane ?? "xz";
  if (!PLANES.includes(plane)) {
    throw new Error(`curvesel: plane must be "xz", "yz" or "xy", got ${JSON.stringify(plane)}`);
  }
  const visibleRange = options.visibleRange ?? Number.POSITIVE_INFINITY;
  if (!(visibleRange >= 0)) {
    throw new Error(`curvesel: visibleRange must be a number ≥ 0, got ${visibleRange}`);
  }
  if (!(Number.isFinite(context.size) && context.size > 0)) {
    throw new Error(`curvesel: size must be a finite number > 0, got ${context.size}`);
  }
  const step = context.size + options.gap;
  const turn = options.curvature * offset;
  const length = offset * step;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const small = Math.abs(turn) < SERIES_LIMIT;
  const turn2 = turn * turn;
  // x = R·sin(turn) and z = R·(cos(turn) − 1), with R = step / curvature, written so they stay
  // exact as the Curvature tends to 0.
  const sinc = small ? 1 - turn2 / 6 + (turn2 * turn2) / 120 : sin / turn;
  const cosc = small ? -turn / 2 + (turn * turn2) / 24 : (cos - 1) / turn;
  // In the Curve's own Plane: `along` from the centre, `bend` towards the side it curves to.
  const placed = place(plane, length * sinc, length * cosc, cos, sin);
  const zIndex = stackOrder(placed.z / step, Math.abs(offset));
  return { ...placed, zIndex, visible: Math.abs(offset) <= visibleRange };
}

/** Higher nearer the viewer (`depth` in steps); within one depth bucket, higher nearer the centre. */
function stackOrder(depth: number, distance: number): number {
  const bucket = Math.round(depth * DEPTH_BUCKETS_PER_STEP);
  const far = Math.min(Math.round(distance * DISTANCE_STEPS_PER_OFFSET), DISTANCES_PER_BUCKET - 1);
  const order = Z_INDEX_BASE + bucket * DISTANCES_PER_BUCKET + (DISTANCES_PER_BUCKET - 1 - far);
  return Math.min(Math.max(order, 0), Z_INDEX_MAX);
}

/** Turns a point and heading in the Curve's own Plane into a position and rotation in the Stage. */
function place(plane: Plane, along: number, bend: number, cos: number, sin: number) {
  switch (plane) {
    case "xz": // rotateY(turn): bends away from the viewer.
      return { x: along, y: 0, z: bend, rotation: [cos, 0, sin, 0, 1, 0, -sin, 0, cos] } as const;
    case "yz": // rotateX(−turn): goes down the screen, bends away from the viewer.
      return { x: 0, y: along, z: bend, rotation: [1, 0, 0, 0, cos, sin, 0, -sin, cos] } as const;
    case "xy": // rotateZ(turn): bends down the screen, the centre below.
      return { x: along, y: -bend, z: 0, rotation: [cos, -sin, 0, sin, cos, 0, 0, 0, 1] } as const;
  }
}
