// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Carousel, createCarousel } from "../src/index.ts";

class InertResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const settle = () => vi.advanceTimersByTime(5000);

let root: HTMLElement;
let carousel: Carousel;
const button = (index: number) => root.children[index]?.querySelector("button") as HTMLElement;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", InertResizeObserver);
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
  document.body.innerHTML = `<div id="stage">${"<div><button>Go</button></div>".repeat(5)}</div>`;
  root = document.getElementById("stage") as HTMLElement;
  carousel = createCarousel(root, { layout: "ribbon", size: 100 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("Focus (DEC-15)", () => {
  it("brings the Slide that keyboard focus enters to the centre", () => {
    button(2).focus();
    settle();
    expect(carousel.position).toBe(2);
    // Focus on the Stage itself moves nothing.
    root.focus();
    settle();
    expect(carousel.position).toBe(2);
  });

  it("goes the short way round when looping", () => {
    carousel.destroy();
    carousel = createCarousel(root, { layout: "ribbon", size: 100, loop: true });
    button(4).focus();
    settle();
    expect(carousel.position).toBe(-1);
  });

  it("leaves a pointer's focus, and focus during a press, where it is", () => {
    // A tap's focus does not match :focus-visible.
    const tapped = button(3);
    Object.defineProperty(tapped, "matches", {
      value: (selector: string) => selector !== ":focus-visible",
    });
    tapped.focus();
    settle();
    expect(carousel.position).toBe(0);
    root.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX: 500, clientY: 300, buttons: 1 }),
    );
    button(2).focus();
    settle();
    expect(carousel.position).toBe(0);
  });

  it("stops following focus on destroy", () => {
    carousel.destroy();
    button(2).focus();
    settle();
    expect(carousel.position).toBe(0);
  });
});
