import type { Pose } from "./pose.ts";

/** Where the Curve bends: `xz` in depth, `yz` vertically in depth (a wheel), `xy` in the screen. */
export type Plane = "xz" | "yz" | "xy";

/** A periodic part of the Curvature: `amplitude · sin(2π·s / wavelength + phase)`. */
export interface Wave {
  /** Radians of bend per Slide step at the crest. */
  readonly amplitude: number;
  /** In Slides. */
  readonly wavelength: number;
  /**
   * Radians; π/2 by default, which puts the centre on a crest so the heading swings evenly around
   * the centre's and the Active slide stays flat: a wavy ribbon stays level on average.
   */
  readonly phase?: number;
}

/** The Curve's options. Lengths along the Curve count Slide steps (`size + gap`). */
export interface CurveOptions {
  /** Radians of bend per Slide step: 0 is a flat ribbon, `2π / N` closes a cylinder of N Slides. */
  readonly curvature: number;
  /** The space between neighbouring Slides along the Curve, in px. */
  readonly gap: number;
  /** Where the Curve bends; `xz` by default. */
  readonly plane?: Plane;
  /** Makes the Curve undulate in its Plane, fixed relative to the centre. */
  readonly wave?: Wave;
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
  if (options.wave) checkWave(options.wave);
  const visibleRange = options.visibleRange ?? Number.POSITIVE_INFINITY;
  if (!(visibleRange >= 0)) {
    throw new Error(`curvesel: visibleRange must be a number ≥ 0, got ${visibleRange}`);
  }
  if (!(Number.isFinite(context.size) && context.size > 0)) {
    throw new Error(`curvesel: size must be a finite number > 0, got ${context.size}`);
  }
  const step = context.size + options.gap;
  const turn = options.curvature * offset;
  const heading = options.wave ? turn + waveTurn(offset, options.wave) : turn;
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
  let along = length * sinc;
  let bend = length * cosc;
  if (options.wave) {
    const [a, b] = integrate(offset, options.curvature, options.wave);
    along = a * step;
    bend = b * step;
  }
  const placed = place(plane, along, bend, Math.cos(heading), Math.sin(heading));
  const zIndex = stackOrder(placed.z / step, Math.abs(offset));
  return { ...placed, zIndex, visible: Math.abs(offset) <= visibleRange };
}

function checkWave({ amplitude, wavelength, phase = DEFAULT_PHASE }: Wave): void {
  if (!Number.isFinite(amplitude)) {
    throw new Error(`curvesel: wave.amplitude must be a finite number, got ${amplitude}`);
  }
  if (!(Number.isFinite(wavelength) && wavelength > 0)) {
    throw new Error(`curvesel: wave.wavelength must be a finite number > 0, got ${wavelength}`);
  }
  if (!Number.isFinite(phase)) {
    throw new Error(`curvesel: wave.phase must be a finite number, got ${phase}`);
  }
}

/** How much the Wave alone turns the Curve between the centre and `s`: its Curvature's integral. */
function waveTurn(s: number, { amplitude, wavelength, phase = DEFAULT_PHASE }: Wave): number {
  const k = (2 * Math.PI) / wavelength;
  return (amplitude / k) * (Math.cos(phase) - Math.cos(k * s + phase));
}

const DEFAULT_PHASE = Math.PI / 2;

/** Simpson intervals per Slide step: under 1e-6 of a step of error for Curvatures up to ~3. */
const SIMPSON_PER_STEP = 32;

/** The point at `s` steps along a Curve with a Wave: the integral of `(cos θ, −sin θ)`, in steps. */
function integrate(s: number, curvature: number, wave: Wave): [along: number, bend: number] {
  const n = 2 * Math.ceil((Math.abs(s) * SIMPSON_PER_STEP) / 2) || 2;
  const h = s / n;
  let along = 0;
  let bend = 0;
  for (let i = 0; i <= n; i++) {
    const u = i * h;
    const weight = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
    const theta = curvature * u + waveTurn(u, wave);
    along += weight * Math.cos(theta);
    bend -= weight * Math.sin(theta);
  }
  return [(along * h) / 3, (bend * h) / 3];
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
