/** A screen vector, in px (or px per second). */
export interface Vector {
  x: number;
  y: number;
}

export interface DragHandlers {
  start(): void;
  /** The pointer moved by this much since the last call. */
  move(delta: Vector): void;
  /** The pointer let go, at this velocity (none if it was held still). */
  end(velocity: Vector): void;
}

/** How far back a release looks to measure the velocity, in ms. */
const VELOCITY_WINDOW = 100;

/**
 * Follows one pointer at a time on the Stage, with pointer capture: no listener on `window` or
 * `document` (DEC-10). Returns what removes every listener.
 */
export function listenForDrag(stage: HTMLElement, handlers: DragHandlers): () => void {
  let active: number | undefined;
  let captured = false;
  let last: Vector = { x: 0, y: 0 };
  let samples: { time: number; x: number; y: number }[] = [];
  const recent = (now: number) => samples.filter(({ time }) => now - time <= VELOCITY_WINDOW);

  const down = (event: PointerEvent) => {
    if (active !== undefined || (event.pointerType === "mouse" && event.button !== 0)) return;
    active = event.pointerId;
    captured = false;
    last = { x: event.clientX, y: event.clientY };
    samples = [{ time: event.timeStamp, ...last }];
    handlers.start();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerId !== active) return;
    // No button held: the release happened off the Stage before capture.
    if (event.buttons === 0) return up(event);
    // Captured once it moves: capturing on `pointerdown` would retarget a still tap's click.
    if (!captured) stage.setPointerCapture?.(event.pointerId);
    captured = true;
    handlers.move({ x: event.clientX - last.x, y: event.clientY - last.y });
    last = { x: event.clientX, y: event.clientY };
    samples = [...recent(event.timeStamp), { time: event.timeStamp, ...last }];
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId !== active) return;
    active = undefined;
    const kept = recent(event.timeStamp);
    const first = kept[0];
    const elapsed = first ? (event.timeStamp - first.time) / 1000 : 0;
    handlers.end(
      first && elapsed > 0
        ? { x: (last.x - first.x) / elapsed, y: (last.y - first.y) / elapsed }
        : { x: 0, y: 0 },
    );
  };

  const listeners = [
    ["pointerdown", down],
    ["pointermove", move],
    ["pointerup", up],
    ["pointercancel", up],
  ] as const;
  for (const [type, listener] of listeners) stage.addEventListener(type, listener);
  return () => {
    for (const [type, listener] of listeners) stage.removeEventListener(type, listener);
  };
}
