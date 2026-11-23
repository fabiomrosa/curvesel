import { describe, expect, it } from "vitest";
import {
  createTrack,
  dragMove,
  dragStart,
  goTo,
  release,
  step,
  type TrackState,
} from "../src/index.ts";

function drag(state: TrackState, ...deltas: number[]): TrackState {
  return deltas.reduce(dragMove, dragStart(state));
}

/** Steps at 60 fps until the Track rests, or a minute passes. */
function settle(state: TrackState): TrackState {
  let track = state;
  for (let i = 0; i < 3600 && track.phase !== "rest"; i++) track = step(track, 1 / 60);
  return track;
}

/** Steps finely until Inertia ends, so the spring that follows has barely moved. */
function coast(state: TrackState): TrackState {
  let track = state;
  for (let i = 0; i < 1e6 && track.phase === "inertia"; i++) track = step(track, 1e-4);
  return track;
}

/** Half the velocity kept per second: a decay rate of ln 2. */
const HALF = { friction: 0.5 };

describe("createTrack", () => {
  it("starts at rest on Position 0 with no velocity", () => {
    const track = createTrack({ count: 5 });
    expect(track.position).toBeCloseTo(0, 12);
    expect(track.velocity).toBeCloseTo(0, 12);
    expect(track.phase).toBe("rest");
    expect(track.count).toBe(5);
    expect(track.rubberBand).toBeCloseTo(0.1, 12);
    expect(track.target).toBe(0);
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
    expect(createTrack({ count: 3, rubberBand: 1 }).rubberBand).toBeCloseTo(1, 12);
  });

  it("keeps 0.84 of the velocity per 30 fps frame by default, as in the 2012 version", () => {
    expect(createTrack({ count: 3 }).friction).toBeCloseTo(0.84 ** 30, 12);
  });

  it("throws a message naming the friction when it is not in (0, 1)", () => {
    expect(() => createTrack({ count: 3, friction: 1 })).toThrow(
      "curvesel: friction must be a number in (0, 1), got 1",
    );
    expect(() => createTrack({ count: 3, friction: 0 })).toThrow("curvesel: friction");
    expect(() => createTrack({ count: 3, friction: Number.NaN })).toThrow("curvesel: friction");
  });
});

describe("dragStart", () => {
  it("puts the Track in the drag phase where it is", () => {
    const track = dragStart(createTrack({ count: 3 }));
    expect(track.phase).toBe("drag");
    expect(track.position).toBeCloseTo(0, 12);
  });

  it("stops a Track in Inertia", () => {
    const moving = release(createTrack({ count: 9 }), 5);
    expect(dragStart(moving).velocity).toBeCloseTo(0, 12);
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

describe("release", () => {
  it("starts Inertia at the release velocity", () => {
    const track = release(drag(createTrack({ count: 5 }), 1), 3);
    expect(track.phase).toBe("inertia");
    expect(track.velocity).toBeCloseTo(3, 12);
    expect(track.position).toBeCloseTo(1, 12);
  });

  it("snaps to the nearest Slide when the release has almost no speed", () => {
    const track = release(drag(createTrack({ count: 5 }), 1.3), 0.001);
    expect(track.phase).toBe("snap");
    expect(track.target).toBe(1);
  });

  it("throws a message naming the velocity when it is not a finite number", () => {
    expect(() => release(createTrack({ count: 3 }), Number.NaN)).toThrow(
      "curvesel: velocity must be a finite number, got NaN",
    );
  });
});

describe("step", () => {
  it("decays the velocity by the friction per second, moving by its integral", () => {
    let track = release(drag(createTrack({ count: 9, ...HALF }), 1), 2);
    for (let i = 0; i < 10; i++) track = step(track, 0.1);
    expect(track.velocity).toBeCloseTo(1, 12);
    expect(track.position).toBeCloseTo(1 + 1 / Math.LN2, 12);
    expect(track.phase).toBe("inertia");
  });

  it("ends Inertia in finite time, about velocity / decay rate farther on", () => {
    // Checked against a fine Euler simulation: 6.756353 after 8.64 s.
    const track = coast(release(drag(createTrack({ count: 10, ...HALF }), 1), 4));
    expect(track.phase).toBe("snap");
    expect(track.position).toBeCloseTo(6.756353, 5);
  });

  it("slows rubberBand times faster past an end", () => {
    // Without the band it would reach 7.756; checked against a fine Euler simulation.
    const track = coast(release(drag(createTrack({ count: 3, ...HALF }), 2), 4));
    expect(track.position).toBeCloseTo(2.575635, 5);
  });

  it("crosses back into bounds and out past the other end, changing the decay at each", () => {
    // From 2.05 (past the last Slide) towards the first; checked against a fine Euler simulation.
    const track = coast(release(drag(createTrack({ count: 3, ...HALF }), 2.5), -2));
    expect(track.position).toBeCloseTo(-0.037095, 5);
  });

  it("crosses both ends in one step as it would in many", () => {
    // From 1.05 (past the last of 2 Slides), fast enough to pass the first within 0.1 s.
    const fast = release(drag(createTrack({ count: 2, ...HALF }), 1.5), -20);
    let fine = fast;
    for (let i = 0; i < 100; i++) fine = step(fine, 0.001);
    const once = step(fast, 0.1);
    expect(once.position).toBeLessThan(0);
    expect(once.position).toBeCloseTo(fine.position, 12);
    expect(once.velocity).toBeCloseTo(fine.velocity, 9);
  });

  it("moves no farther than a tenth of a second allows, however long the step", () => {
    const moving = release(createTrack({ count: 99 }), 10);
    const late = step(moving, 10);
    expect(late.position).toBeLessThanOrEqual(10 * 0.1);
    expect(late.position).toBeCloseTo(step(moving, 0.1).position, 12);
  });

  it("snaps to the nearest Slide when Inertia ends, and rests exactly on it", () => {
    const track = settle(release(drag(createTrack({ count: 10, ...HALF }), 1), 4));
    expect(track.phase).toBe("rest");
    expect(track.position).toBeCloseTo(7, 12);
    expect(track.velocity).toBeCloseTo(0, 12);
  });

  it("returns to the end it passed, without overshooting it", () => {
    let track = release(drag(createTrack({ count: 3, ...HALF }), 2), 4);
    let lowest = track.position;
    for (let i = 0; i < 3600 && track.phase !== "rest"; i++) {
      track = step(track, 1 / 60);
      lowest = Math.min(lowest, track.position);
    }
    expect(track.position).toBeCloseTo(2, 12);
    expect(lowest).toBeGreaterThanOrEqual(2);
    expect(settle(release(drag(createTrack({ count: 3, ...HALF }), 2.5), -2)).position).toBeCloseTo(
      0,
      12,
    );
  });

  it("pulls with a critically damped spring of 12 per second", () => {
    // From 1.4 to 1 at rest: x(t) = 0.4 (1 + 12t) e^(−12t).
    const snapping = release(drag(createTrack({ count: 5 }), 1.4), 0);
    const later = step(snapping, 0.1);
    expect(later.phase).toBe("snap");
    expect(later.position).toBeCloseTo(1 + 0.4 * 2.2 * Math.exp(-1.2), 12);
    let fine = snapping;
    for (let i = 0; i < 100; i++) fine = step(fine, 0.001);
    expect(fine.position).toBeCloseTo(later.position, 12);
    expect(fine.velocity).toBeCloseTo(later.velocity, 12);
  });

  it("spends the rest of the step on the spring when Inertia ends within it", () => {
    const ending = coast(release(drag(createTrack({ count: 10, ...HALF }), 1), 4));
    const before = { ...ending, phase: "inertia" as const, velocity: 0.0100001 };
    const next = step(before, 0.1);
    expect(next.phase).toBe("snap");
    expect(next.position).toBeGreaterThan(ending.position + 0.05);
  });

  it("keeps snapping while it is close to the target but still fast", () => {
    const snapping = release(drag(createTrack({ count: 5 }), 1), 0);
    const passing = step({ ...snapping, position: 1.0001, velocity: 0.5 }, 0.001);
    expect(passing.phase).toBe("snap");
  });

  it("stops a Snap when a Drag starts", () => {
    const snapping = release(drag(createTrack({ count: 5 }), 1.4), 0);
    const caught = dragStart(step(snapping, 0.05));
    expect(caught.phase).toBe("drag");
    expect(caught.velocity).toBeCloseTo(0, 12);
  });

  it("leaves a Track at rest or in a Drag where it is", () => {
    const resting = createTrack({ count: 3 });
    expect(step(resting, 1 / 60)).toEqual(resting);
    const dragging = drag(resting, 1);
    expect(step(dragging, 1 / 60)).toEqual(dragging);
  });

  it("throws a message naming dt when it is negative or not a finite number", () => {
    const moving = release(createTrack({ count: 3 }), 1);
    expect(() => step(moving, -1)).toThrow(
      "curvesel: dt must be a finite number of at least 0, got -1",
    );
    expect(() => step(moving, Number.NaN)).toThrow("curvesel: dt");
  });
});

describe("loop", () => {
  it("is off by default", () => {
    expect(createTrack({ count: 3 }).loop).toBe(false);
  });

  it("lets a Drag move freely past the last Slide", () => {
    const track = drag(createTrack({ count: 3, loop: true }), 2, 1.5);
    expect(track.position).toBeCloseTo(3.5, 12);
    expect(drag(track, 0.5).position).toBeCloseTo(4, 12);
  });

  it("carries Inertia past the ends without the Rubber band", () => {
    // From 2 at 4 Positions per second with a decay of ln 2: about 4 / ln 2 farther on.
    const track = coast(release(drag(createTrack({ count: 3, loop: true, ...HALF }), 2), 4));
    expect(track.position).toBeCloseTo(2 + (4 - 0.01) / Math.LN2, 4);
  });

  it("snaps to a whole Position outside [0, count)", () => {
    expect(
      settle(release(drag(createTrack({ count: 3, loop: true }), 2, 1.6), 0)).position,
    ).toBeCloseTo(4, 12);
    expect(
      settle(release(drag(createTrack({ count: 3, loop: true }), -1.7), 0)).position,
    ).toBeCloseTo(-2, 12);
  });
});

describe("goTo", () => {
  it("snaps to the index and rests on it, the same at 30, 60 and 120 fps", () => {
    const sent = goTo(createTrack({ count: 9 }), 6);
    expect(sent.phase).toBe("snap");
    expect(sent.target).toBe(6);
    for (const fps of [30, 60, 120]) {
      let track = sent;
      for (let i = 0; i < 600 && track.phase !== "rest"; i++) track = step(track, 1 / fps);
      expect(track.phase).toBe("rest");
      expect(track.position).toBeCloseTo(6, 12);
    }
  });

  it("keeps the velocity it had, so a moving Track turns smoothly", () => {
    const moving = release(drag(createTrack({ count: 9 }), 3), -5);
    const sent = goTo(moving, 6);
    expect(sent.velocity).toBeCloseTo(-5, 12);
    expect(settle(sent).position).toBeCloseTo(6, 12);
  });

  it("takes the short way round when looping", () => {
    const nearEnd = drag(createTrack({ count: 5, loop: true }), 4.4);
    expect(goTo(nearEnd, 0).target).toBe(5);
    expect(goTo(nearEnd, 2).target).toBe(2);
    const turned = drag(createTrack({ count: 5, loop: true }), -7.2);
    expect(goTo(turned, 3).target).toBe(-7);
    expect(settle(goTo(nearEnd, 0)).position).toBeCloseTo(5, 12);
  });

  it("throws a message naming the index when it is outside [0, count) or not whole", () => {
    expect(() => goTo(createTrack({ count: 3 }), 3)).toThrow(
      "curvesel: index must be a whole number in [0, 3), got 3",
    );
    expect(() => goTo(createTrack({ count: 3 }), -1)).toThrow("curvesel: index");
    expect(() => goTo(createTrack({ count: 3, loop: true }), 1.5)).toThrow("curvesel: index");
  });
});
