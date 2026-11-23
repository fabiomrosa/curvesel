/** The Track's motion state; every call returns a new one. */
export interface TrackState {
  /** The Position, in Slides: 0 is the first, `count − 1` the last. */
  readonly position: number;
  /** Positions per second. */
  readonly velocity: number;
  readonly phase: "rest" | "drag";
  readonly count: number;
  /** The fraction of a move that counts past the first or last Slide. */
  readonly rubberBand: number;
}

export interface TrackOptions {
  count: number;
  /** 0.1 by default, as in the 2012 version. */
  rubberBand?: number;
}

const DEFAULT_RUBBER_BAND = 0.1;

/** A Track at rest on the first Slide. */
export function createTrack({ count, rubberBand = DEFAULT_RUBBER_BAND }: TrackOptions): TrackState {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`curvesel: count must be a whole number of at least 1, got ${count}`);
  }
  if (!(rubberBand > 0 && rubberBand <= 1)) {
    throw new Error(`curvesel: rubberBand must be a number in (0, 1], got ${rubberBand}`);
  }
  return { position: 0, velocity: 0, phase: "rest", count, rubberBand };
}

/** The pointer goes down on the Stage: the Track follows the Drag. */
export function dragStart(state: TrackState): TrackState {
  return { ...state, phase: "drag" };
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
