import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { slideOffset } from "../src/index.ts";

describe("slideOffset", () => {
  it("is index − position when not looping", () => {
    expect(slideOffset(1, 3.25, 5, false)).toBeCloseTo(-2.25, 12);
    expect(slideOffset(4, -1, 5, false)).toBeCloseTo(5, 12);
  });

  it("wraps into [−count/2, count/2) when looping", () => {
    expect(slideOffset(0, 4, 5, true)).toBeCloseTo(1, 12);
    expect(slideOffset(4, 0, 5, true)).toBeCloseTo(-1, 12);
    expect(slideOffset(2, 0, 4, true)).toBeCloseTo(-2, 12);
    expect(slideOffset(0, 2, 4, true)).toBeCloseTo(-2, 12);
    expect(slideOffset(1, 13.5, 5, true)).toBeCloseTo(2.5 - 5, 12);
  });

  it("throws a message naming the value when an argument is invalid", () => {
    expect(() => slideOffset(5, 0, 5, false)).toThrow(
      "curvesel: index must be a whole number in [0, 5), got 5",
    );
    expect(() => slideOffset(0.5, 0, 5, false)).toThrow("curvesel: index");
    expect(() => slideOffset(0, Number.NaN, 5, false)).toThrow(
      "curvesel: position must be a finite number, got NaN",
    );
    expect(() => slideOffset(0, 0, 0, false)).toThrow(
      "curvesel: count must be a whole number of at least 1, got 0",
    );
  });

  it("wraps every Offset into [−count/2, count/2), a whole number of counts away", () => {
    let wrapped = 0;
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 999 }),
        // `fc.double` favours values near 0; integers spread the Positions over the whole range.
        fc.integer({ min: -100_000, max: 100_000 }).map((n) => n / 100),
        (count, i, position) => {
          const index = i % count;
          const offset = slideOffset(index, position, count, true);
          expect(offset).toBeGreaterThanOrEqual(-count / 2);
          expect(offset).toBeLessThan(count / 2);
          const turns = (index - position - offset) / count;
          expect(Math.abs(turns - Math.round(turns))).toBeLessThan(1e-9);
          if (Math.round(turns) !== 0) wrapped++;
        },
      ),
      { numRuns: 1000 },
    );
    expect(wrapped).toBeGreaterThan(500);
  });
});
