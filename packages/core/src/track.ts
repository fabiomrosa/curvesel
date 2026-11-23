/** The Track's motion state; every call returns a new one. */
export interface TrackState {
  /** The Position, in Slides: 0 is the first, `count − 1` the last. */
  readonly position: number;
  /** Positions per second. */
  readonly velocity: number;
  readonly phase: "rest" | "drag" | "inertia";
  readonly count: number;
  /** The fraction of a move that counts past the first or last Slide. */
  readonly rubberBand: number;
  /** The fraction of the velocity kept after a second of Inertia. */
  readonly friction: number;
}

export interface TrackOptions {
  count: number;
  /** 0.1 by default, as in the 2012 version. */
  rubberBand?: number;
  /** 0.84 per 30 fps frame by default, as in the 2012 version. */
  friction?: number;
}

const DEFAULT_RUBBER_BAND = 0.1;
const DEFAULT_FRICTION = 0.84 ** 30;
/** Positions per second: slower than this, Inertia ends. */
const REST_SPEED = 0.01;
/** Seconds: a longer step (a backgrounded tab) counts as this long. */
const MAX_DT = 0.1;

/** A Track at rest on the first Slide. */
export function createTrack({
  count,
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
  return { position: 0, velocity: 0, phase: "rest", count, rubberBand, friction };
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

/** The pointer is released at `velocity` Positions per second: Inertia carries the Track on. */
export function release(state: TrackState, velocity: number): TrackState {
  if (!Number.isFinite(velocity)) {
    throw new Error(`curvesel: velocity must be a finite number, got ${velocity}`);
  }
  if (Math.abs(velocity) < REST_SPEED) return { ...state, velocity: 0, phase: "rest" };
  return { ...state, velocity, phase: "inertia" };
}

/**
 * Advances Inertia by `dt` seconds. The velocity decays exponentially (`rubberBand` times faster
 * past an end), solved exactly piece by piece between the ends, so any split of the same time
 * ends at the same Position. Below `REST_SPEED` the Track rests where it is.
 */
export function step(state: TrackState, dt: number): TrackState {
  if (!(Number.isFinite(dt) && dt >= 0)) {
    throw new Error(`curvesel: dt must be a finite number of at least 0, got ${dt}`);
  }
  if (state.phase !== "inertia") return state;
  let { position, velocity } = state;
  let left = Math.min(dt, MAX_DT);
  while (left > 0) {
    const edge = nextEdge(state.count, position, velocity);
    const outside = edge === undefined || position < 0 || position > state.count - 1;
    const decay = -Math.log(state.friction) / (outside ? state.rubberBand : 1);
    const toRest = Math.log(Math.abs(velocity) / REST_SPEED) / decay;
    const kept = edge === undefined ? 0 : 1 - (decay * (edge - position)) / velocity;
    const toEdge = kept > 0 ? -Math.log(kept) / decay : Number.POSITIVE_INFINITY;
    const time = Math.min(left, toRest, toEdge);
    const factor = Math.exp(-decay * time);
    position += (velocity * (1 - factor)) / decay;
    velocity *= factor;
    if (time === toRest) return { ...state, position, velocity: 0, phase: "rest" };
    if (time === toEdge) position = edge as number;
    left -= time;
  }
  return { ...state, position, velocity };
}

/** The next end the Track reaches moving at `velocity`, or none once it is past it. */
function nextEdge(count: number, position: number, velocity: number): number | undefined {
  const last = count - 1;
  if (velocity > 0) return position < 0 ? 0 : position < last ? last : undefined;
  return position > last ? last : position > 0 ? 0 : undefined;
}

/** Where the pointer is for a Position: past an end, the excess is stretched back by the band. */
function toPointer({ count, rubberBand }: TrackState, position: number): number {
  const last = count - 1;
  if (position < 0) return position / rubberBand;
  if (position > last) return last + (position - last) / rubberBand;
  return position;
}

function fromPointer({ count, rubberBand }: TrackState, pointer: number): number {
  const last = count - 1;
  if (pointer < 0) return pointer * rubberBand;
  if (pointer > last) return last + (pointer - last) * rubberBand;
  return pointer;
}
