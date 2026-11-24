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

  it("leaves focus after a press where it is, until a key or focus leaving the Carousel", () => {
    const press = () =>
      root.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, clientX: 500, clientY: 300, buttons: 1 }),
      );
    const release = () =>
      root.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, clientX: 500, clientY: 300, buttons: 0 }),
      );
    // A tap: its focus comes after the release.
    press();
    release();
    button(3).focus();
    settle();
    expect(carousel.position).toBe(0);
    // A key (Tab) on the way to the next element: keyboard focus again.
    button(3).dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
    button(4).focus();
    settle();
    expect(carousel.position).toBe(4);
    // Focus that left the Carousel and comes back by keyboard moves it too.
    press();
    release();
    document.body.insertAdjacentHTML("beforeend", "<button id='outside'>Out</button>");
    (document.getElementById("outside") as HTMLElement).focus();
    button(1).focus();
    settle();
    expect(carousel.position).toBe(1);
  });

  it("stops following focus on destroy", () => {
    carousel.destroy();
    button(2).focus();
    settle();
    expect(carousel.position).toBe(0);
  });
});
