import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createTrack, dragMove, dragStart, release, step, type TrackState } from "../src/index.ts";

/** A speed below any rest threshold: an upper bound for the time Inertia lasts. */
const SLOW = 0.001;
/** Seconds: more than any Snap takes. */
const SNAP_TIME = 3;

// `fc.double` favours values near 0; integers spread them over the whole range.
const count = fc.integer({ min: 1, max: 20 });
const rubberBand = fc.integer({ min: 5, max: 100 }).map((n) => n / 100);
const friction = fc.integer({ min: 1, max: 500 }).map((n) => n / 1000);
/** Where the Drag leaves the Track, from half a Slide before the first to half after the last. */
const start = fc.integer({ min: 0, max: 1000 }).map((n) => n / 1000);
const velocity = fc.integer({ min: -1000, max: 1000 }).map((n) => n / 100);
const jitter = fc.array(
  fc.integer({ min: 1, max: 99 }).map((ms) => ms / 1000),
  { minLength: 1, maxLength: 20 },
);

interface Run {
  end: TrackState;
  time: number;
  /** Inertia never sped up, and Snap never crossed its target. */
  smooth: boolean;
}

/** Steps through the `dt` sequence, cycled, until the Track rests. */
function run(state: TrackState, dts: readonly number[]): Run {
  let track = state;
  let time = 0;
  let smooth = true;
  for (let i = 0; track.phase !== "rest" && i < 1e5; i++) {
    const dt = dts[i % dts.length] as number;
    const next = step(track, dt);
    if (track.phase === "inertia" && next.phase === "inertia") {
      if (Math.abs(next.velocity) > Math.abs(track.velocity)) smooth = false;
    }
    if (
      track.phase === "snap" &&
      (next.position - next.target) * (track.position - track.target) < 0
    ) {
      smooth = false;
    }
    track = next;
    time += dt;
  }
  return { end: track, time, smooth };
}

function expectSettled(end: TrackState, count: number): void {
  expect(end.phase).toBe("rest");
  expect(Number.isInteger(end.position)).toBe(true);
  expect(end.position).toBeGreaterThanOrEqual(0);
  expect(end.position).toBeLessThanOrEqual(count - 1);
}

describe("Inertia and Snap invariants", () => {
  it("ends on the same Slide at any frame rate, slowing down, in finite time", () => {
    let atEnd = 0;
    let between = 0;
    fc.assert(
      fc.property(
        count,
        rubberBand,
        friction,
        start,
        velocity,
        jitter,
        (n, band, f, from, v, dts) => {
          const dragged = dragMove(
            dragStart(createTrack({ count: n, rubberBand: band, friction: f })),
            n * from - 0.5,
          );
          const released = release(dragged, v);
          const bound = Math.max(0, Math.log(Math.abs(v) / SLOW) / -Math.log(f)) + SNAP_TIME;
          const runs = [[1 / 30], [1 / 60], [1 / 120], dts].map((schedule) =>
            run(released, schedule),
          );
          const reference = runs[0]?.end.position as number;
          for (const { end, time, smooth } of runs) {
            expectSettled(end, n);
            expect(smooth).toBe(true);
            expect(time).toBeLessThanOrEqual(bound);
            expect(end.position).toBeCloseTo(reference, 12);
          }
          if (reference === 0 || reference === n - 1) atEnd++;
          else between++;
        },
      ),
      { numRuns: 300 },
    );
    expect(atEnd).toBeGreaterThan(50);
    expect(between).toBeGreaterThan(50);
  });

  it("settles on a whole Slide within bounds after any sequence of gestures", () => {
    const gesture = fc.record({
      moves: fc.array(
        start.map((u) => 4 * u - 2),
        { maxLength: 5 },
      ),
      velocity,
      dts: jitter,
    });
    let interrupted = 0;
    fc.assert(
      fc.property(
        count,
        rubberBand,
        friction,
        fc.array(gesture, { minLength: 1, maxLength: 5 }),
        jitter,
        (n, band, f, gestures, dts) => {
          let track = createTrack({ count: n, rubberBand: band, friction: f });
          for (const { moves, velocity: v, dts: between } of gestures) {
            if (track.phase !== "rest") interrupted++;
            track = release(moves.reduce(dragMove, dragStart(track)), v);
            for (const dt of between) track = step(track, dt);
          }
          const { end, time, smooth } = run(track, dts);
          expectSettled(end, n);
          expect(smooth).toBe(true);
          const bound = Math.max(0, Math.log(10 / SLOW) / -Math.log(f)) + SNAP_TIME;
          expect(time).toBeLessThanOrEqual(bound);
        },
      ),
      { numRuns: 300 },
    );
    expect(interrupted).toBeGreaterThan(100);
  });
});
