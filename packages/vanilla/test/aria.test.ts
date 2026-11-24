// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCarousel } from "../src/index.ts";

class InertResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function stage(html: string): HTMLElement {
  document.body.innerHTML = `<div id="stage">${html}</div>`;
  return document.getElementById("stage") as HTMLElement;
}

const marks = (element: Element, names: string[]) =>
  Object.fromEntries(names.map((name) => [name, element.getAttribute(name)]));
const ARIA = ["role", "aria-roledescription", "aria-label"];

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", InertResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("ARIA (DEC-15)", () => {
  it("names the Stage a carousel region and each Slide its place, until destroy", () => {
    const root = stage("<div></div>".repeat(3));
    const carousel = createCarousel(root, { size: 100 });
    expect(marks(root, ARIA)).toEqual({
      role: "region",
      "aria-roledescription": "carousel",
      "aria-label": "Carousel",
    });
    expect([...root.children].map((slide) => marks(slide, ARIA))).toEqual(
      ["1 of 3", "2 of 3", "3 of 3"].map((label) => ({
        role: "group",
        "aria-roledescription": "slide",
        "aria-label": label,
      })),
    );
    carousel.destroy();
    for (const element of [root, ...root.children]) {
      expect(ARIA.filter((name) => element.hasAttribute(name))).toEqual([]);
    }
  });

  it("takes the labels from `label` and `slideLabel`", () => {
    const root = stage("<div></div>".repeat(2));
    createCarousel(root, {
      size: 100,
      label: "Featured",
      slideLabel: (index, count) => `Card ${index + 1} / ${count}`,
    });
    expect(root.getAttribute("aria-label")).toBe("Featured");
    expect(root.children[1]?.getAttribute("aria-label")).toBe("Card 2 / 2");
  });

  it("keeps each Slide's place current when children change", async () => {
    const root = stage("<div></div>".repeat(2));
    createCarousel(root, { size: 100 });
    root.prepend(document.createElement("div"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect([...root.children].map((slide) => slide.getAttribute("aria-label"))).toEqual([
      "1 of 3",
      "2 of 3",
      "3 of 3",
    ]);
    // A Slide given back keeps nothing.
    const removed = root.firstElementChild as HTMLElement;
    removed.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ARIA.filter((name) => removed.hasAttribute(name))).toEqual([]);
    expect(root.firstElementChild?.getAttribute("aria-label")).toBe("1 of 2");
  });

  it("leaves the user's own role, description and label as they are", () => {
    const root = stage(
      '<div role="listitem" aria-label="Mine"></div><div aria-labelledby="t"></div><div aria-roledescription="card"></div>',
    );
    root.setAttribute("role", "group");
    root.setAttribute("aria-labelledby", "heading");
    const carousel = createCarousel(root, { size: 100 });
    expect(marks(root, ARIA)).toEqual({
      role: "group",
      "aria-roledescription": "carousel",
      "aria-label": null,
    });
    const [first, second, third] = [...root.children];
    expect(marks(first as Element, ARIA)).toEqual({
      role: "listitem",
      "aria-roledescription": "slide",
      "aria-label": "Mine",
    });
    expect((second as Element).hasAttribute("aria-label")).toBe(false);
    expect((third as Element).getAttribute("aria-roledescription")).toBe("card");
    carousel.destroy();
    expect(marks(first as Element, ARIA)).toEqual({
      role: "listitem",
      "aria-roledescription": null,
      "aria-label": "Mine",
    });
    expect(root.getAttribute("role")).toBe("group");
  });
});
