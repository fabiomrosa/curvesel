import type { Pose, Rotation } from "./pose.ts";

/** Where the Curve bends: `xz` in depth, `yz` vertically in depth (a wheel), `xy` in the screen. */
export type Plane = "xz" | "yz" | "xy";

/** A periodic part of the Curvature: `amplitude · sin(2π·s / wavelength + phase)`. */
export interface Wave {
  /** Radians of bend per Slide step at the crest. */
  readonly amplitude: number;
  /** In Slides. */
  readonly wavelength: number;
  /**
   * Radians; π/2 by default (DEC-13): the centre sits on a crest and the heading swings evenly
   * around it, so a wavy ribbon stays level on average.
   */
  readonly phase?: number;
  /** `space` (default): the Wave stays put as the Slides move; `ribbon`: it travels with them. */
  readonly anchor?: "space" | "ribbon";
  /** `z` (default): bends in the Curve's Plane; `y`: across it, pitching the Slides. */
  readonly plane?: "z" | "y";
}

/** The Curve's options. Lengths along the Curve count Slide steps (`size + gap`). */
export interface CurveOptions {
  /** Radians of bend per Slide step: 0 is a flat ribbon, `2π / N` closes a cylinder of N Slides. */
  readonly curvature: number;
  /** The space between neighbouring Slides along the Curve, in px. */
  readonly gap: number;
  /** Where the Curve bends; `xz` by default. */
  readonly plane?: Plane;
  /** Makes the Curve undulate in its Plane (see `Wave.anchor`). */
  readonly wave?: Wave;
  /** How far from the centre, in Offsets, a Slide is still shown; every Slide by default. */
  readonly visibleRange?: number;
}

/** What the engine measures and passes to every Layout. */
export interface LayoutContext {
  /** The slide size along the Curve, in px. */
  readonly size: number;
  /** The Track's Position; 0 when absent. */
  readonly position?: number;
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
  const position = context.position ?? 0;
  if (!Number.isFinite(position)) {
    throw new Error(`curvesel: position must be a finite number, got ${position}`);
  }
  if (options.wave) checkWave(options.wave);
  const wave = options.wave && travelling(options.wave, position);
  const visibleRange = options.visibleRange ?? Number.POSITIVE_INFINITY;
  if (!(visibleRange >= 0)) {
    throw new Error(`curvesel: visibleRange must be a number ≥ 0, got ${visibleRange}`);
  }
  if (!(Number.isFinite(context.size) && context.size > 0)) {
    throw new Error(`curvesel: size must be a finite number > 0, got ${context.size}`);
  }
  const step = context.size + options.gap;
  const curvature = options.curvature;
  // The Curve's two angles along its length: yaw turns it in its Plane, pitch lifts it across.
  const waveTurns = (u: number) => (wave ? waveTurn(u, wave) : 0);
  const pitching = wave?.plane === "y";
  const yaw = (u: number) => curvature * u + (pitching ? 0 : waveTurns(u));
  const pitch = (u: number) => (pitching ? waveTurns(u) : 0);
  const point = wave
    ? scale(integrate(offset, yaw, pitch), step)
    : circle(offset * step, curvature * offset);
  const placed = place(plane, point, yaw(offset), pitch(offset));
  const zIndex = stackOrder(placed.z / step, Math.abs(offset));
  return { ...placed, zIndex, visible: Math.abs(offset) <= visibleRange };
}

/** A point in the Curve's own axes: along it from the centre, towards its bend, across its Plane. */
type Vector = readonly [along: number, bend: number, across: number];

const scale = ([a, b, n]: Vector, k: number): Vector => [a * k, b * k, n * k];

/**
 * The point `length` px along a circle that turns by `turn`: `R·sin(turn)` along and
 * `R·(cos(turn) − 1)` towards the bend, written so they stay exact as the turn tends to 0.
 */
function circle(length: number, turn: number): Vector {
  const turn2 = turn * turn;
  const small = Math.abs(turn) < SERIES_LIMIT;
  const sinc = small ? 1 - turn2 / 6 + (turn2 * turn2) / 120 : Math.sin(turn) / turn;
  const cosc = small ? -turn / 2 + (turn * turn2) / 24 : (Math.cos(turn) - 1) / turn;
  return [length * sinc, length * cosc, 0];
}

function checkWave(wave: Wave): void {
  const { amplitude, wavelength, phase = DEFAULT_PHASE, anchor = "space", plane = "z" } = wave;
  if (anchor !== "space" && anchor !== "ribbon") {
    throw new Error(
      `curvesel: wave.anchor must be "space" or "ribbon", got ${JSON.stringify(anchor)}`,
    );
  }
  if (!Number.isFinite(amplitude)) {
    throw new Error(`curvesel: wave.amplitude must be a finite number, got ${amplitude}`);
  }
  if (!(Number.isFinite(wavelength) && wavelength > 0)) {
    throw new Error(`curvesel: wave.wavelength must be a finite number > 0, got ${wavelength}`);
  }
  if (!Number.isFinite(phase)) {
    throw new Error(`curvesel: wave.phase must be a finite number, got ${phase}`);
  }
  if (plane !== "z" && plane !== "y") {
    throw new Error(`curvesel: wave.plane must be "z" or "y", got ${JSON.stringify(plane)}`);
  }
}

/** A Wave anchored to the ribbon carries its phase with the Slides: shifted by the Position. */
function travelling(wave: Wave, position: number): Wave {
  if (wave.anchor !== "ribbon") return wave;
  const phase = (wave.phase ?? DEFAULT_PHASE) + (2 * Math.PI * position) / wave.wavelength;
  return { ...wave, phase };
}

/** How much the Wave alone turns the Curve between the centre and `s`: its Curvature's integral. */
function waveTurn(s: number, { amplitude, wavelength, phase = DEFAULT_PHASE }: Wave): number {
  const k = (2 * Math.PI) / wavelength;
  return (amplitude / k) * (Math.cos(phase) - Math.cos(k * s + phase));
}

const DEFAULT_PHASE = Math.PI / 2;

/**
 * Simpson intervals per Slide step: about 1e-6 of a step of error for |curvature| + |amplitude| ≤ 3
 * and wavelengths ≥ 1 (1.6e-5 at a wavelength of 0.25): far below a pixel.
 */
const SIMPSON_PER_STEP = 32;

/** The point `s` steps along the Curve: the integral of its unit tangent, by Simpson's rule. */
function integrate(s: number, yaw: (u: number) => number, pitch: (u: number) => number): Vector {
  const n = 2 * Math.ceil((Math.abs(s) * SIMPSON_PER_STEP) / 2) || 2;
  const h = s / n;
  let [along, bend, across] = [0, 0, 0];
  for (let i = 0; i <= n; i++) {
    const weight = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
    const [t] = frame(yaw(i * h), pitch(i * h));
    along += weight * t[0];
    bend += weight * t[1];
    across += weight * t[2];
  }
  return scale([along, bend, across], h / 3);
}

/**
 * The Slide's own axes in the Curve's axes, for a yaw `φ` in the Plane and a pitch `ψ` across it:
 * the tangent, the in-Plane normal (which the pitch turns around; the Slide's face in `xz` and
 * `yz`) and the third axis.
 */
function frame(yaw: number, pitch: number): [tangent: Vector, face: Vector, third: Vector] {
  const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
  return [
    [cp * cy, -cp * sy, sp],
    [sy, cy, 0],
    [-sp * cy, sp * sy, cp],
  ];
}

/** Higher nearer the viewer (`depth` in steps); within one depth bucket, higher nearer the centre. */
function stackOrder(depth: number, distance: number): number {
  const bucket = Math.round(depth * DEPTH_BUCKETS_PER_STEP);
  const far = Math.min(Math.round(distance * DISTANCE_STEPS_PER_OFFSET), DISTANCES_PER_BUCKET - 1);
  const order = Z_INDEX_BASE + bucket * DISTANCES_PER_BUCKET + (DISTANCES_PER_BUCKET - 1 - far);
  return Math.min(Math.max(order, 0), Z_INDEX_MAX);
}

// Where each Plane puts the Curve's axes (along, bend, across) in the Stage's (x, y, z).
const IN_XZ = ([a, b, n]: Vector): Vector => [a, n, b];
const IN_YZ = ([a, b, n]: Vector): Vector => [n, a, b];
const IN_XY = ([a, b, n]: Vector): Vector => [a, -b, n];

/** Turns a point and the Slide's axes from the Curve's own axes into the Stage's. */
function place(plane: Plane, point: Vector, yaw: number, pitch: number) {
  const [tangent, face, third] = frame(yaw, pitch);
  switch (plane) {
    case "xz": // rotateY: bends away from the viewer.
      return at(IN_XZ(point), IN_XZ(tangent), IN_XZ(third), IN_XZ(face));
    case "yz": // rotateX(−θ): goes down the screen, bends away from the viewer.
      return at(IN_YZ(point), IN_YZ(third), IN_YZ(tangent), IN_YZ(face));
    case "xy": // rotateZ: bends down the screen, the centre below.
      return at(IN_XY(point), IN_XY(tangent), scale(IN_XY(face), -1), IN_XY(third));
  }
}

/** A position, and the rotation whose columns are the Slide's own x, y and z axes. */
function at([x, y, z]: Vector, X: Vector, Y: Vector, Z: Vector) {
  const rotation: Rotation = [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]];
  return { x, y, z, rotation };
}
