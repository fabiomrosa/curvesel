// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Carousel, type CarouselOptions, createCarousel } from "../src/index.ts";

class InertResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

/** `prefers-reduced-motion`, switched by the test. */
class FakeQuery extends EventTarget {
  constructor(public matches: boolean) {
    super();
  }
  set(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event("change"));
  }
}

function pointer(target: Element, type: string, x: number, t: number) {
  const buttons = type === "pointerup" ? 0 : 1;
  const init = { bubbles: true, clientX: x, clientY: 300, pointerId: 1, buttons };
  const event = new PointerEvent(type, init);
  Object.defineProperty(event, "timeStamp", { value: t });
  target.dispatchEvent(event);
}

const frame = () => vi.advanceTimersByTime(17);

let root: HTMLElement;
let query: FakeQuery;
const mount = (options: CarouselOptions = {}): Carousel =>
  createCarousel(root, { layout: "ribbon", size: 100, ...options });

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", InertResizeObserver);
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout"],
  });
  query = new FakeQuery(true);
  vi.stubGlobal("matchMedia", (media: string) => {
    expect(media).toBe("(prefers-reduced-motion: reduce)");
    return query;
  });
  document.body.innerHTML = `<div id="stage">${"<div></div>".repeat(5)}</div>`;
  root = document.getElementById("stage") as HTMLElement;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("Reduced motion (DEC-16)", () => {
  it("lands at once after next, goTo, a key and a wheel gesture", () => {
    const carousel = mount();
    carousel.next();
    frame();
    expect(carousel.position).toBe(1);
    carousel.goTo(4);
    frame();
    expect(carousel.position).toBe(4);
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", cancelable: true }));
    frame();
    expect(carousel.position).toBe(0);
    root.dispatchEvent(new WheelEvent("wheel", { deltaX: 80, cancelable: true }));
    frame();
    // The wheel itself is the user's motion; its end lands.
    expect(carousel.position).toBeCloseTo(80 / 120, 9);
    vi.advanceTimersByTime(150);
    frame();
    expect(carousel.position).toBe(1);
  });

  it("follows a Drag, then lands on the nearest Slide with no Inertia", () => {
    const carousel = mount();
    pointer(root, "pointerdown", 500, 0);
    pointer(root, "pointermove", 440, 10);
    pointer(root, "pointermove", 380, 20);
    frame();
    expect(carousel.position).toBeCloseTo(1, 9);
    pointer(root, "pointermove", 350, 30);
    pointer(root, "pointerup", 350, 40);
    frame();
    // A fast flick would carry on; here it stays on the Slide nearest the release.
    expect(carousel.position).toBe(1);
  });

  it("follows the media query live, and the option overrides it both ways", () => {
    const carousel = mount();
    query.set(false);
    carousel.next();
    frame();
    frame();
    expect(Number.isInteger(carousel.position)).toBe(false);
    carousel.destroy();
    const still = mount({ reducedMotion: true });
    still.next();
    frame();
    expect(still.position).toBe(1);
    still.destroy();
    query.set(true);
    const moving = mount({ reducedMotion: false });
    moving.next();
    frame();
    frame();
    expect(Number.isInteger(moving.position)).toBe(false);
  });
});
