// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Carousel, createCarousel } from "../src/index.ts";

class InertResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function stage(count: number): HTMLElement {
  document.body.innerHTML = `<div id="stage">${"<div></div>".repeat(count)}</div>`;
  return document.getElementById("stage") as HTMLElement;
}

/** A pointer event at `t` ms, for pointer `id`. */
function pointer(target: Element, type: string, x: number, y: number, t: number, id = 1): void {
  const event = new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: id });
  Object.defineProperty(event, "timeStamp", { value: t });
  target.dispatchEvent(event);
}

/** Drags from (x0, y0) through the moves at 10 ms apart, then releases after `hold` ms. */
function drag(root: Element, moves: [number, number][], hold = 0, id = 1): void {
  pointer(root, "pointerdown", 500, 300, 0, id);
  moves.forEach(([x, y], i) => {
    pointer(root, "pointermove", x, y, (i + 1) * 10, id);
  });
  const [x, y] = moves.at(-1) ?? [500, 300];
  pointer(root, "pointerup", x, y, moves.length * 10 + hold, id);
}

const frame = () => vi.advanceTimersByTime(17);
const settle = () => vi.advanceTimersByTime(5000);
const slides = (root: HTMLElement) => [...root.children] as HTMLElement[];

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", InertResizeObserver);
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("Drag", () => {
  let root: HTMLElement;
  let carousel: Carousel;
  beforeEach(() => {
    root = stage(5);
    // A ribbon of 100 px Slides with a 20 px gap: one Position is 120 px along x on screen.
    carousel = createCarousel(root, { layout: "ribbon", size: 100 });
  });

  it("stores the moves and applies them in the next frame, in Positions", () => {
    pointer(root, "pointerdown", 500, 300, 0);
    pointer(root, "pointermove", 380, 310, 10);
    expect(carousel.position).toBe(0);
    frame();
    expect(carousel.position).toBeCloseTo(1, 9);
  });

  it("Snaps where it is when the pointer was held still before release", () => {
    drag(
      root,
      [
        [440, 300],
        [380, 300],
        [320, 300],
      ],
      300,
    );
    settle();
    expect(carousel.position).toBeCloseTo(2, 9);
  });

  it("carries a flick on with Inertia past where the pointer stopped", () => {
    drag(root, [
      [460, 300],
      [420, 300],
      [380, 300],
    ]);
    settle();
    expect(carousel.position).toBeGreaterThanOrEqual(2);
  });

  it("resists past the first Slide with the Rubber band, and keeps the first one Active", () => {
    const selects: number[] = [];
    carousel.on("select", (index) => selects.push(index));
    pointer(root, "pointerdown", 500, 300, 0);
    pointer(root, "pointermove", 620, 300, 10);
    frame();
    expect(carousel.position).toBeCloseTo(-0.1, 9);
    expect(slides(root)[0]?.hasAttribute("data-cs-active")).toBe(true);
    pointer(root, "pointermove", 1400, 300, 20);
    frame();
    expect(slides(root)[0]?.hasAttribute("data-cs-active")).toBe(true);
    expect(selects).toEqual([]);
  });

  it("captures the pointer once it moves, so a still tap keeps its own target", () => {
    const capture = vi.fn();
    root.setPointerCapture = capture;
    pointer(root, "pointerdown", 500, 300, 0);
    expect(capture).not.toHaveBeenCalled();
    pointer(root, "pointermove", 490, 300, 10);
    pointer(root, "pointermove", 480, 300, 20);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("follows one pointer at a time, and releases on pointercancel", () => {
    pointer(root, "pointerdown", 500, 300, 0);
    pointer(root, "pointerdown", 500, 300, 0, 2);
    pointer(root, "pointermove", 0, 300, 5, 2);
    pointer(root, "pointermove", 380, 300, 10);
    frame();
    expect(carousel.position).toBeCloseTo(1, 9);
    // Cancelled at 0.6 Positions with no speed: it Snaps to 1, as a release would.
    pointer(root, "pointermove", 428, 300, 20);
    frame();
    pointer(root, "pointercancel", 428, 300, 400);
    settle();
    expect(carousel.position).toBeCloseTo(1, 9);
  });

  it("sets touch-action for the drag axis, and listens on the Stage only, until destroy", () => {
    expect(root.style.touchAction).toBe("pan-y");
    const windowListen = vi.spyOn(window, "addEventListener");
    const documentListen = vi.spyOn(document, "addEventListener");
    drag(root, [[380, 300]], 300);
    settle();
    expect(windowListen).not.toHaveBeenCalled();
    expect(documentListen).not.toHaveBeenCalled();
    carousel.destroy();
    expect(root.style.touchAction).toBe("");
    drag(root, [[0, 300]], 300);
    settle();
    expect(carousel.position).toBeCloseTo(1, 9);
  });
});

describe("Drag along the Curve on screen", () => {
  it("drags down the screen in the wheel", () => {
    const root = stage(5);
    const carousel = createCarousel(root, { layout: "wheel", size: 100 });
    expect(root.style.touchAction).toBe("pan-x");
    pointer(root, "pointerdown", 500, 300, 0);
    pointer(root, "pointermove", 500, 299, 10);
    frame();
    expect(carousel.position).toBeGreaterThan(0);
  });

  it("drags along a tilted ribbon", () => {
    const root = stage(5);
    const carousel = createCarousel(root, {
      layout: { curvature: 0, gap: 20, tilt: Math.PI / 2 },
      size: 100,
    });
    pointer(root, "pointerdown", 500, 300, 0);
    pointer(root, "pointermove", 500, 180, 10);
    frame();
    expect(carousel.position).toBeCloseTo(1, 9);
  });
});

describe("removing Slides during Inertia", () => {
  it("lets Inertia run when the Position stays within the new count", async () => {
    const root = stage(5);
    const carousel = createCarousel(root, { layout: "ribbon", size: 100 });
    carousel.goTo(4);
    settle();
    // Back towards the first Slide with a flick: Inertia, heading below 2.
    drag(root, [
      [560, 300],
      [620, 300],
      [700, 300],
      [800, 300],
    ]);
    frame();
    slides(root)[4]?.remove();
    slides(root)[3]?.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    settle();
    expect(carousel.position).toBeLessThan(2);
  });
});
