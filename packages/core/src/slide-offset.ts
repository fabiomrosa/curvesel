/**
 * The Offset of Slide `index` from the Position: `index − position`, wrapped into
 * `[−count/2, count/2)` when looping, so every Slide sits on the side of the Curve nearest the
 * Active slide.
 */
export function slideOffset(index: number, position: number, count: number, loop: boolean): number {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`curvesel: count must be a whole number of at least 1, got ${count}`);
  }
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error(`curvesel: index must be a whole number in [0, ${count}), got ${index}`);
  }
  if (!Number.isFinite(position)) {
    throw new Error(`curvesel: position must be a finite number, got ${position}`);
  }
  const offset = index - position;
  if (!loop) return offset;
  const half = count / 2;
  return offset - count * Math.floor((offset + half) / count);
}
