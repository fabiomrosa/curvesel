import type { Pose } from "./pose.ts";

/** The Curve's options. Lengths along the Curve count Slide steps (`size + gap`). */
export interface CurveOptions {
  /** Radians of bend per Slide step: 0 is a flat ribbon, `2π / N` closes a cylinder of N Slides. */
  readonly curvature: number;
  /** The space between neighbouring Slides along the Curve, in px. */
  readonly gap: number;
}

/** What the engine measures and passes to every Layout. */
export interface LayoutContext {
  /** The slide size along the Curve, in px. */
  readonly size: number;
}

/** Below this turn (radians), `sin(u)/u` and `(cos(u) − 1)/u` use their series, error under 1e-24. */
const SERIES_LIMIT = 1e-4;

/**
 * The Pose of the Slide at `offset` on a Curve of constant Curvature in the `xz` Plane: a circle of
 * radius `step / curvature` through the origin, tangent to x there, bending away from the viewer.
 */
export function curvePose(offset: number, options: CurveOptions, context: LayoutContext): Pose {
  if (!Number.isFinite(options.curvature)) {
    throw new Error(`curvesel: curvature must be a finite number, got ${options.curvature}`);
  }
  if (!(Number.isFinite(options.gap) && options.gap >= 0)) {
    throw new Error(`curvesel: gap must be a finite number ≥ 0, got ${options.gap}`);
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
  return {
    x: length * sinc,
    y: 0,
    z: length * cosc,
    rotation: [cos, 0, sin, 0, 1, 0, -sin, 0, cos],
  };
}
