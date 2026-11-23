// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type CarouselOptions, createCarousel } from "../src/index.ts";

class InertResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function stage(attributes = ""): HTMLElement {
  document.body.innerHTML = `<div id="stage" ${attributes}>${"<div><input></div>".repeat(5)}</div>`;
  return document.getElementById("stage") as HTMLElement;
}

/** A keydown on `target`; returns whether the Carousel took it (the default was prevented). */
function press(target: Element, key: string, extra = {}): boolean {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key, ...extra });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

const settle = () => vi.advanceTimersByTime(5000);

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", InertResizeObserver);
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("Keyboard", () => {
  /** The Position after each key, settled, or `undefined` for a key the Carousel left alone. */
  function positions(options: CarouselOptions, keys: string[]): (number | undefined)[] {
    const root = stage();
    const carousel = createCarousel(root, { size: 100, ...options });
    return keys.map((key) => {
      const taken = press(root, key);
      settle();
      return taken ? carousel.position : undefined;
    });
  }

  it("steps with the arrows along the Curve on screen, and goes to the ends with Home and End", () => {
    const keys = ["ArrowRight", "ArrowRight", "ArrowLeft", "ArrowDown", "End", "Home"];
    expect(positions({ layout: "ribbon" }, keys)).toEqual([1, 2, 1, undefined, 4, 0]);
    expect(positions({ layout: "wheel" }, ["ArrowDown", "ArrowRight", "ArrowUp"])).toEqual([
      1,
      undefined,
      0,
    ]);
    // A ribbon turned half round runs right to left: the left arrow brings the next Slide.
    const reversed = { curvature: 0, gap: 20, tilt: Math.PI };
    expect(positions({ layout: reversed }, ["ArrowLeft", "ArrowRight"])).toEqual([1, 0]);
  });

  it("leaves keys from inside a Slide, and with a modifier, to the page", () => {
    const root = stage();
    const carousel = createCarousel(root, { layout: "ribbon", size: 100 });
    expect(press(root.querySelector("input") as Element, "ArrowRight")).toBe(false);
    expect(press(root, "ArrowRight", { altKey: true })).toBe(false);
    expect(press(root, "End", { metaKey: true })).toBe(false);
    settle();
    expect(carousel.position).toBe(0);
    carousel.destroy();
    expect(press(root, "ArrowRight")).toBe(false);
  });
});

describe("tabindex (DEC-14)", () => {
  it("makes a Stage without one focusable, and removes it on destroy", () => {
    const root = stage();
    const carousel = createCarousel(root, { size: 100 });
    expect(root.getAttribute("tabindex")).toBe("0");
    carousel.destroy();
    expect(root.hasAttribute("tabindex")).toBe(false);
  });

  it("leaves the user's own tabindex as it is", () => {
    const root = stage('tabindex="-1"');
    const carousel = createCarousel(root, { size: 100 });
    expect(root.getAttribute("tabindex")).toBe("-1");
    carousel.destroy();
    expect(root.getAttribute("tabindex")).toBe("-1");
  });
});
