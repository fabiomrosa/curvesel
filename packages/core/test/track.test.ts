import { describe, expect, it } from "vitest";
import { createTrack, dragMove, dragStart, type TrackState } from "../src/index.ts";

function drag(state: TrackState, ...deltas: number[]): TrackState {
  return deltas.reduce(dragMove, dragStart(state));
}

describe("createTrack", () => {
  it("starts at rest on Position 0 with no velocity", () => {
    const track = createTrack({ count: 5 });
    expect(track.position).toBeCloseTo(0, 12);
    expect(track.velocity).toBeCloseTo(0, 12);
    expect(track.phase).toBe("rest");
    expect(track.count).toBe(5);
    expect(track.rubberBand).toBeCloseTo(0.1, 12);
  });

  it("throws a message naming the count when it is not a whole number of at least 1", () => {
    expect(() => createTrack({ count: 0 })).toThrow(
      "curvesel: count must be a whole number of at least 1, got 0",
    );
    expect(() => createTrack({ count: 2.5 })).toThrow("curvesel: count");
    expect(() => createTrack({ count: Number.NaN })).toThrow("curvesel: count");
  });

  it("throws a message naming the rubberBand when it is not in (0, 1]", () => {
    expect(() => createTrack({ count: 3, rubberBand: 0 })).toThrow(
      "curvesel: rubberBand must be a number in (0, 1], got 0",
    );
    expect(() => createTrack({ count: 3, rubberBand: 1.5 })).toThrow("curvesel: rubberBand");
    expect(() => createTrack({ count: 3, rubberBand: Number.NaN })).toThrow("curvesel: rubberBand");
  });
});

describe("dragMove", () => {
  it("adds the moves up to the Position within bounds, in the drag phase", () => {
    const track = drag(createTrack({ count: 5 }), 1.5, 0.75, -0.25);
    expect(track.position).toBeCloseTo(2, 12);
    expect(track.phase).toBe("drag");
    expect(track.velocity).toBeCloseTo(0, 12);
  });

  it("counts a rubberBand fraction of the move past the last Slide", () => {
    const track = drag(createTrack({ count: 3 }), 2, 1);
    expect(track.position).toBeCloseTo(2.1, 12);
  });

  it("counts a rubberBand fraction of the move past the first Slide", () => {
    const track = drag(createTrack({ count: 3, rubberBand: 0.5 }), -1);
    expect(track.position).toBeCloseTo(-0.5, 12);
  });

  it("counts in full the part of a move that is within bounds, and is continuous at the end", () => {
    // 1.5 to the end, then 0.5 past it at 0.1.
    const track = drag(createTrack({ count: 3 }), 0.5, 2);
    expect(track.position).toBeCloseTo(2.05, 12);
    const justPast = drag(createTrack({ count: 3 }), 2 + 1e-9);
    expect(justPast.position).toBeCloseTo(2, 8);
  });

  it("returns to the same Position when the moves are undone", () => {
    const track = drag(createTrack({ count: 3 }), 0.5, 3, -3);
    expect(track.position).toBeCloseTo(0.5, 12);
    const back = drag(createTrack({ count: 3 }), -2, 2.5);
    expect(back.position).toBeCloseTo(0.5, 12);
  });

  it("resists in both directions with a single Slide", () => {
    expect(drag(createTrack({ count: 1 }), 1).position).toBeCloseTo(0.1, 12);
    expect(drag(createTrack({ count: 1 }), -1).position).toBeCloseTo(-0.1, 12);
  });

  it("throws a message naming the delta when it is not a finite number", () => {
    expect(() => drag(createTrack({ count: 3 }), Number.POSITIVE_INFINITY)).toThrow(
      "curvesel: delta must be a finite number, got Infinity",
    );
  });

  it("leaves the given state unchanged", () => {
    const start = dragStart(createTrack({ count: 3 }));
    dragMove(start, 1);
    expect(start.position).toBeCloseTo(0, 12);
  });
});
