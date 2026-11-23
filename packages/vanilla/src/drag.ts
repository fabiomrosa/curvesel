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
 * `document` (DEC-10). A pointer that moves more than `threshold` px is a drag: it captures the
 * pointer, and its click is stopped before it reaches a Slide. Returns what removes every listener.
 */
export function listenForDrag(
  stage: HTMLElement,
  threshold: number,
  handlers: DragHandlers,
): () => void {
  let active: number | undefined;
  let captured = false;
  let origin: Vector = { x: 0, y: 0 };
  let last: Vector = { x: 0, y: 0 };
  let samples: { time: number; x: number; y: number }[] = [];
  const recent = (now: number) => samples.filter(({ time }) => now - time <= VELOCITY_WINDOW);

  // A drag's click; keyboard clicks (`detail` 0) pass. Lifted by that click or the next press.
  const swallow = (event: MouseEvent) => {
    if (event.detail === 0) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    unguard();
  };
  const unguard = () => stage.removeEventListener("click", swallow, true);
  // In the capture phase, so a Slide that stops its own `pointerdown` still lifts it.
  const press = () => {
    if (active === undefined) unguard();
  };

  const down = (event: PointerEvent) => {
    if (active !== undefined || (event.pointerType === "mouse" && event.button !== 0)) return;
    active = event.pointerId;
    captured = false;
    origin = last = { x: event.clientX, y: event.clientY };
    samples = [{ time: event.timeStamp, ...last }];
    handlers.start();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerId !== active) return;
    // No button held: the release happened off the Stage before capture.
    if (event.buttons === 0) return up(event);
    // Captured past the threshold: capturing on `pointerdown` would retarget a tap's click.
    const travel = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
    if (!captured && travel > threshold) {
      stage.setPointerCapture?.(event.pointerId);
      stage.addEventListener("click", swallow, true);
      captured = true;
    }
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
  stage.addEventListener("pointerdown", press, true);
  return () => {
    for (const [type, listener] of listeners) stage.removeEventListener(type, listener);
    stage.removeEventListener("pointerdown", press, true);
    unguard();
  };
}
