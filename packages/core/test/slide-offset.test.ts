import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { slideOffset } from "../src/index.ts";

/** The next double above `x`, from its bits. */
function nextUp(x: number): number {
  if (x === 0) return Number.MIN_VALUE;
  const bits = new BigInt64Array(new Float64Array([x]).buffer);
  bits[0] = (bits[0] as bigint) + (x > 0 ? 1n : -1n);
  return new Float64Array(bits.buffer)[0] as number;
}

function nextDown(x: number): number {
  return -nextUp(-x);
}

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

  it("stays in [−count/2, count/2) when rounding lands a hair past an end", () => {
    // The plain formula gives −1.5000000000000002 here.
    expect(slideOffset(0, -1.4999999999999998, 3, true)).toBeLessThan(1.5);
    expect(slideOffset(0, -1.4999999999999998, 3, true)).toBeGreaterThanOrEqual(-1.5);
    let checked = 0;
    for (let count = 1; count <= 40; count++) {
      for (let k = -30; k <= 30; k++) {
        const boundary = count / 2 + k * count;
        for (const position of [boundary, -boundary]) {
          let near = position;
          for (let ulp = 0; ulp < 4; ulp++) near = nextUp(near);
          for (let ulp = 0; ulp < 8; ulp++, near = nextDown(near), checked++) {
            const offset = slideOffset(0, near, count, true);
            expect(offset).toBeGreaterThanOrEqual(-count / 2);
            expect(offset).toBeLessThan(count / 2);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(30_000);
  });

  it("throws a message naming the value when an argument is invalid", () => {
    expect(() => slideOffset(5, 0, 5, false)).toThrow(
      "curvesel: index must be a whole number in [0, 5), got 5",
    );
    expect(() => slideOffset(0.5, 0, 5, false)).toThrow("curvesel: index");
    expect(() => slideOffset(-1, 0, 5, false)).toThrow("curvesel: index");
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
