// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Carousel, createCarousel } from "../src/index.ts";

class InertResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

/** A wheel event on the Stage; returns it, to see whether the page scroll was prevented. */
function wheel(target: Element, deltaX: number, deltaY = 0, deltaMode = 0): WheelEvent {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaX,
    deltaY,
    deltaMode,
  });
  target.dispatchEvent(event);
  return event;
}

function pointer(target: Element, type: string, x: number, t: number) {
  const buttons = type === "pointerup" ? 0 : 1;
  const event = new PointerEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: 300,
    pointerId: 1,
    buttons,
  });
  Object.defineProperty(event, "timeStamp", { value: t });
  target.dispatchEvent(event);
}

const frame = () => vi.advanceTimersByTime(17);
const settle = () => vi.advanceTimersByTime(5000);

let root: HTMLElement;
let carousel: Carousel;
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", InertResizeObserver);
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout"],
  });
  document.body.innerHTML = `<div id="stage">${"<div></div>".repeat(5)}</div>`;
  root = document.getElementById("stage") as HTMLElement;
  // A ribbon of 100 px Slides with a 20 px gap: one Position is 120 px along x on screen.
  carousel = createCarousel(root, { layout: "ribbon", size: 100 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("Wheel", () => {
  it("moves the Track along the Curve, and Snaps after a pause", () => {
    expect(wheel(root, 60).defaultPrevented).toBe(true);
    frame();
    expect(carousel.position).toBeCloseTo(0.5, 9);
    wheel(root, 12);
    vi.advanceTimersByTime(100);
    expect(carousel.position).toBeCloseTo(0.6, 9);
    vi.advanceTimersByTime(100);
    settle();
    expect(carousel.position).toBe(1);
  });

  it("leaves the page to scroll at an end, and stops there", () => {
    expect(wheel(root, -60).defaultPrevented).toBe(false);
    wheel(root, 60);
    expect(wheel(root, -120).defaultPrevented).toBe(true);
    settle();
    expect(carousel.position).toBe(0);
    carousel.goTo(4);
    settle();
    expect(wheel(root, 60).defaultPrevented).toBe(false);
    expect(carousel.position).toBe(4);
    // Looping, there is no end.
    carousel.destroy();
    carousel = createCarousel(root, { layout: "ribbon", size: 100, loop: true });
    expect(wheel(root, -60).defaultPrevented).toBe(true);
    expect(carousel.position).toBeCloseTo(-0.5, 9);
  });

  it("counts only the delta along the Curve, in px, lines or pages", () => {
    expect(wheel(root, 0, 120).defaultPrevented).toBe(false);
    wheel(root, 3, 0, 1);
    frame();
    expect(carousel.position).toBeCloseTo(0.4, 9);
    wheel(root, 1, 0, 2);
    frame();
    expect(carousel.position).toBeCloseTo(1.4, 9);
    const down = createCarousel(root, { layout: "wheel", size: 100 });
    wheel(root, 0, 30);
    frame();
    expect(down.position).toBeGreaterThan(0);
  });

  it("gives way to a pointer Drag, which keeps its own release", () => {
    carousel.destroy();
    // Looping, so the flick has no end to stop at.
    carousel = createCarousel(root, { layout: "ribbon", size: 100, loop: true });
    wheel(root, 60);
    pointer(root, "pointerdown", 500, 0);
    pointer(root, "pointermove", 440, 10);
    pointer(root, "pointermove", 380, 20);
    pointer(root, "pointerup", 380, 30);
    // The flick's Inertia runs past the wheel's pause and carries beyond where it was let go.
    for (let i = 0; i < 12; i++) frame();
    const passed = carousel.position;
    settle();
    expect(carousel.position).toBeGreaterThan(Math.round(passed));
  });

  it("stops listening, and drops a pending Snap, on destroy", () => {
    wheel(root, 60);
    carousel.destroy();
    expect(vi.getTimerCount()).toBe(0);
    expect(carousel.position).toBeCloseTo(0.5, 9);
    expect(wheel(root, 60).defaultPrevented).toBe(false);
  });
});
