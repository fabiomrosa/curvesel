// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Carousel, createCarousel } from "../src/index.ts";

class InertResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function pointer(target: Element, type: string, x: number, t: number) {
  const buttons = type === "pointerup" ? 0 : 1;
  const init = { bubbles: true, clientX: x, clientY: 300, pointerId: 1, buttons };
  const event = new PointerEvent(type, init);
  Object.defineProperty(event, "timeStamp", { value: t });
  target.dispatchEvent(event);
}

const settle = () => vi.advanceTimersByTime(5000);

let root: HTMLElement;
let announcer: HTMLElement;
let carousel: Carousel;
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", InertResizeObserver);
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
  document.body.innerHTML = `<p id="announcer" aria-live="polite">Ready</p><div id="stage">${"<div></div>".repeat(5)}</div>`;
  root = document.getElementById("stage") as HTMLElement;
  announcer = document.getElementById("announcer") as HTMLElement;
  carousel = createCarousel(root, { layout: "ribbon", size: 100, announcer });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("Announcer (DEC-15)", () => {
  it("says the new Active slide's label once the Track rests, not on mount", () => {
    expect(announcer.textContent).toBe("Ready");
    carousel.goTo(3);
    // Mid-flight, already past the next Slide: still nothing.
    vi.advanceTimersByTime(150);
    expect(carousel.position).toBeGreaterThan(1.2);
    expect(announcer.textContent).toBe("Ready");
    settle();
    expect(announcer.textContent).toBe("4 of 5");
    carousel.next();
    expect(announcer.textContent).toBe("4 of 5");
    settle();
    expect(announcer.textContent).toBe("5 of 5");
  });

  it("says the Slide a key settles on", () => {
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true }));
    settle();
    expect(announcer.textContent).toBe("2 of 5");
  });

  it("says the new Active slide when children change at rest", async () => {
    carousel.destroy();
    carousel = createCarousel(root, { layout: "ribbon", size: 100, announcer, loop: true });
    carousel.goTo(4);
    settle();
    root.lastElementChild?.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    settle();
    expect(announcer.textContent).toBe("4 of 4");
    // Another Slide comes to the centre without the index changing.
    carousel.destroy();
    carousel = createCarousel(root, { layout: "ribbon", size: 100, announcer });
    carousel.goTo(1);
    settle();
    root.prepend(document.createElement("div"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    settle();
    expect(announcer.textContent).toBe("2 of 5");
  });

  it("says nothing during a Drag, then the Slide it settles on", () => {
    pointer(root, "pointerdown", 500, 0);
    pointer(root, "pointermove", 380, 10);
    vi.advanceTimersByTime(17);
    expect(announcer.textContent).toBe("Ready");
    pointer(root, "pointerup", 380, 400);
    settle();
    expect(announcer.textContent).toBe("2 of 5");
  });

  it("says a Slide only when it is new", () => {
    carousel.goTo(3);
    settle();
    announcer.textContent = "";
    carousel.goTo(3);
    settle();
    expect(announcer.textContent).toBe("");
    carousel.goTo(0);
    settle();
    expect(announcer.textContent).toBe("1 of 5");
  });

  it("uses `slideLabel`, and puts the earlier text back on destroy", () => {
    carousel.destroy();
    carousel = createCarousel(root, {
      layout: "ribbon",
      size: 100,
      announcer,
      slideLabel: (index, count) => `Card ${index + 1} / ${count}`,
    });
    carousel.next();
    settle();
    expect(announcer.textContent).toBe("Card 2 / 5");
    carousel.destroy();
    expect(announcer.textContent).toBe("Ready");
  });

  it("puts back the announcer's own nodes, unless the user changed its text", () => {
    carousel.destroy();
    announcer.innerHTML = '<span class="mine">Ready</span>';
    const mine = announcer.firstElementChild;
    carousel = createCarousel(root, { layout: "ribbon", size: 100, announcer });
    carousel.next();
    settle();
    carousel.destroy();
    expect(announcer.firstElementChild).toBe(mine);
    carousel = createCarousel(root, { layout: "ribbon", size: 100, announcer });
    carousel.next();
    settle();
    announcer.textContent = "Theirs";
    carousel.destroy();
    expect(announcer.textContent).toBe("Theirs");
  });

  it("reports a `slideLabel` that throws, and keeps moving", () => {
    const report = vi.fn();
    vi.stubGlobal("reportError", report);
    carousel.destroy();
    carousel = createCarousel(root, {
      layout: "ribbon",
      size: 100,
      announcer,
      slideLabel: () => {
        throw new Error("no labels today");
      },
    });
    report.mockClear();
    carousel.next();
    settle();
    expect(report).toHaveBeenCalledTimes(1);
    expect(carousel.position).toBe(1);
  });

  it("throws for an announcer that is not an element, or is the Stage, around it or in it", () => {
    carousel.destroy();
    const options = { size: 100, announcer: "#announcer" as unknown as HTMLElement };
    expect(() => createCarousel(root, options)).toThrow(
      "curvesel: announcer must be an HTMLElement",
    );
    for (const element of [root, document.body, root.firstElementChild as HTMLElement]) {
      expect(() => createCarousel(root, { size: 100, announcer: element })).toThrow(
        "curvesel: announcer must be outside the Stage",
      );
    }
    expect(root.children).toHaveLength(5);
  });
});
