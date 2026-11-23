import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createTrack, dragMove, dragStart, release, step, type TrackState } from "../src/index.ts";

/** Relative tolerance for Positions: floating error, far below a visible pixel. */
const EPS = 1e-9;
/** A speed below any rest threshold: an upper bound for the time to rest. */
const SLOW = 0.001;

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
  slowedDown: boolean;
}

/** Steps through the `dt` sequence, cycled, until the Track rests. */
function run(state: TrackState, dts: readonly number[]): Run {
  let track = state;
  let time = 0;
  let slowedDown = true;
  for (let i = 0; track.phase !== "rest" && i < 1e5; i++) {
    const dt = dts[i % dts.length] as number;
    const next = step(track, dt);
    if (Math.abs(next.velocity) > Math.abs(track.velocity)) slowedDown = false;
    track = next;
    time += dt;
  }
  return { end: track, time, slowedDown };
}

describe("Inertia invariants", () => {
  it("ends at the same Position at any frame rate, slowing down, in finite time", () => {
    let outside = 0;
    let inside = 0;
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
          const bound = Math.max(0, Math.log(Math.abs(v) / SLOW) / -Math.log(f));
          const runs = [[1 / 30], [1 / 60], [1 / 120], dts].map((schedule) =>
            run(released, schedule),
          );
          const reference = runs[0]?.end.position as number;
          for (const { end, time, slowedDown } of runs) {
            expect(end.phase).toBe("rest");
            expect(slowedDown).toBe(true);
            expect(time).toBeLessThanOrEqual(bound + 0.1);
            expect(Math.abs(end.position - reference)).toBeLessThanOrEqual(
              EPS * Math.max(1, Math.abs(reference)),
            );
          }
          if (reference < 0 || reference > n - 1) outside++;
          else inside++;
        },
      ),
      { numRuns: 300 },
    );
    expect(outside).toBeGreaterThan(50);
    expect(inside).toBeGreaterThan(50);
  });
});
