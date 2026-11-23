import { slideOffset } from "./slide-offset.ts";

/** The Track's motion state; every call returns a new one. */
export interface TrackState {
  /** The Position, in Slides: 0 is the first, `count − 1` the last. */
  readonly position: number;
  /** Positions per second. */
  readonly velocity: number;
  readonly phase: "rest" | "drag" | "inertia" | "snap";
  /** The whole Position a Snap settles on. */
  readonly target: number;
  readonly count: number;
  /** Turning forever: no ends, no Rubber band, and Snap to any whole Position. */
  readonly loop: boolean;
  /** The fraction of a move that counts past the first or last Slide. */
  readonly rubberBand: number;
  /** The fraction of the velocity kept after a second of Inertia. */
  readonly friction: number;
}

export interface TrackOptions {
  count: number;
  /** `false` by default. */
  loop?: boolean;
  /** 0.1 by default, as in the 2012 version. */
  rubberBand?: number;
  /** The fraction of the velocity kept per second; 0.84³⁰ (2012's 0.84 per 30 fps frame) by default. */
  friction?: number;
}

const DEFAULT_RUBBER_BAND = 0.1;
const DEFAULT_FRICTION = 0.84 ** 30;
/** Positions per second: slower than this, Inertia ends. */
const REST_SPEED = 0.01;
/** Positions: this close to its target, and slower than `REST_SPEED`, a Snap ends. */
const REST_DISTANCE = 0.001;
/** Per second: the angular frequency of Snap's critically damped spring. */
const SNAP_RATE = 12;
/** Seconds: a longer step (a backgrounded tab) counts as this long. */
const MAX_DT = 0.1;
/** Past one end, across the bounds, past the other: the velocity never changes sign. */
const MAX_PIECES = 3;

/** A Track at rest on the first Slide. */
export function createTrack({
  count,
  loop = false,
  rubberBand = DEFAULT_RUBBER_BAND,
  friction = DEFAULT_FRICTION,
}: TrackOptions): TrackState {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`curvesel: count must be a whole number of at least 1, got ${count}`);
  }
  if (!(rubberBand > 0 && rubberBand <= 1)) {
    throw new Error(`curvesel: rubberBand must be a number in (0, 1], got ${rubberBand}`);
  }
  if (!(friction > 0 && friction < 1)) {
    throw new Error(`curvesel: friction must be a number in (0, 1), got ${friction}`);
  }
  return { position: 0, velocity: 0, phase: "rest", target: 0, count, loop, rubberBand, friction };
}

/** The pointer goes down on the Stage: the Track stops and follows the Drag. */
export function dragStart(state: TrackState): TrackState {
  return { ...state, velocity: 0, phase: "drag" };
}

/**
 * The pointer moves by `delta` Positions. Past an end only `rubberBand` of the move counts, so a
 * move and its reverse cancel out, wherever they start.
 */
export function dragMove(state: TrackState, delta: number): TrackState {
  if (!Number.isFinite(delta)) {
    throw new Error(`curvesel: delta must be a finite number, got ${delta}`);
  }
  const pointer = toPointer(state, state.position) + delta;
  return { ...state, position: fromPointer(state, pointer) };
}

/**
 * The pointer is released at `velocity` Positions per second: Inertia carries the Track on, or with
 * almost no speed it Snaps to the nearest Slide.
 */
export function release(state: TrackState, velocity: number): TrackState {
  if (!Number.isFinite(velocity)) {
    throw new Error(`curvesel: velocity must be a finite number, got ${velocity}`);
  }
  if (Math.abs(velocity) < REST_SPEED) return snapFrom(state, state.position, velocity);
  return { ...state, velocity, phase: "inertia" };
}

/**
 * Sends the Track to Slide `index` with Snap's spring, keeping its velocity; when looping, to the
 * nearest whole Position that shows that Slide. During a fling the spring may pass the target.
 */
export function goTo(state: TrackState, index: number): TrackState {
  const offset = slideOffset(index, state.position, state.count, state.loop);
  return { ...state, target: Math.round(state.position + offset), phase: "snap" };
}

/**
 * Advances the motion by `dt` seconds, solved exactly so any split of the same time ends at the
 * same Position: Inertia, then Snap, then rest. A Track at rest or in a Drag stays where it is.
 */
export function step(state: TrackState, dt: number): TrackState {
  if (!(Number.isFinite(dt) && dt >= 0)) {
    throw new Error(`curvesel: dt must be a finite number of at least 0, got ${dt}`);
  }
  const time = Math.min(dt, MAX_DT);
  if (state.phase === "inertia") return coast(state, time);
  if (state.phase === "snap") return spring(state, time);
  return state;
}

/**
 * Inertia: the velocity decays exponentially (`rubberBand` times faster past an end), piece by piece
 * between the ends. Below `REST_SPEED` the rest of the time goes to Snap.
 */
function coast(state: TrackState, time: number): TrackState {
  let { position, velocity } = state;
  let left = time;
  for (let piece = 0; piece < MAX_PIECES && left > 0; piece++) {
    const edge = nextEdge(state.count, position, velocity);
    const outside =
      !state.loop && (edge === undefined || position < 0 || position > state.count - 1);
    const decay = -Math.log(state.friction) / (outside ? state.rubberBand : 1);
    const toRest = Math.log(Math.abs(velocity) / REST_SPEED) / decay;
    const kept = edge === undefined ? 0 : 1 - (decay * (edge - position)) / velocity;
    const toEdge = kept > 0 ? -Math.log(kept) / decay : Number.POSITIVE_INFINITY;
    const span = Math.max(0, Math.min(left, toRest, toEdge));
    const factor = Math.exp(-decay * span);
    position += (velocity * (1 - factor)) / decay;
    velocity *= factor;
    left -= span;
    if (span === Math.max(0, toRest)) return spring(snapFrom(state, position, velocity), left);
    // Landing exactly on the end moves `nextEdge` on to the next one: each piece makes progress.
    if (span === toEdge) position = edge as number;
  }
  return { ...state, position, velocity };
}

/** Starts a Snap to the nearest whole Position, within bounds unless looping. */
function snapFrom(state: TrackState, position: number, velocity: number): TrackState {
  const nearest = Math.round(position);
  const target = state.loop ? nearest : Math.min(Math.max(nearest, 0), state.count - 1);
  return { ...state, position, velocity, target, phase: "snap" };
}

/**
 * Snap: a critically damped spring, `x(t) = (x₀ + (v₀ + ωx₀) t) e^(−ωt)` from the target. Close
 * enough and slow enough, the Track rests exactly on the target.
 */
function spring(state: TrackState, time: number): TrackState {
  const { target } = state;
  const x0 = state.position - target;
  const v0 = state.velocity;
  const decay = Math.exp(-SNAP_RATE * time);
  const drift = v0 + SNAP_RATE * x0;
  const x = (x0 + drift * time) * decay;
  const v = (v0 - SNAP_RATE * drift * time) * decay;
  if (Math.abs(x) < REST_DISTANCE && Math.abs(v) < REST_SPEED)
    return { ...state, position: target, velocity: 0, phase: "rest" };
  return { ...state, position: target + x, velocity: v };
}

/** The next end the Track reaches moving at `velocity`, or none once it is past it. */
function nextEdge(count: number, position: number, velocity: number): number | undefined {
  const last = count - 1;
  if (velocity > 0) return position < 0 ? 0 : position < last ? last : undefined;
  return position > last ? last : position > 0 ? 0 : undefined;
}

/** Where the pointer is for a Position: past an end, the excess is stretched back by the band. */
function toPointer({ count, loop, rubberBand }: TrackState, position: number): number {
  const last = count - 1;
  if (loop) return position;
  if (position < 0) return position / rubberBand;
  if (position > last) return last + (position - last) / rubberBand;
  return position;
}

function fromPointer({ count, loop, rubberBand }: TrackState, pointer: number): number {
  const last = count - 1;
  if (loop) return pointer;
  if (pointer < 0) return pointer * rubberBand;
  if (pointer > last) return last + (pointer - last) * rubberBand;
  return pointer;
}
