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

  it("leaves an element with a role of its own, set or native, as it is", () => {
    const root = stage(
      '<div role="listitem" aria-label="Mine"></div><img alt="Sunset"><a href="#"></a><button></button><div aria-labelledby="t"></div>',
    );
    root.setAttribute("role", "group");
    root.setAttribute("aria-labelledby", "heading");
    const carousel = createCarousel(root, { size: 100 });
    const [listitem, image, link, button, labelled] = [...root.children] as HTMLElement[];
    expect(marks(root, ARIA)).toEqual({
      role: "group",
      "aria-roledescription": null,
      "aria-label": null,
    });
    expect(marks(listitem as Element, ARIA)).toEqual({
      role: "listitem",
      "aria-roledescription": null,
      "aria-label": "Mine",
    });
    for (const native of [image, link, button]) {
      expect(ARIA.filter((name) => (native as Element).hasAttribute(name))).toEqual([]);
    }
    expect(marks(labelled as Element, ARIA)).toEqual({
      role: "group",
      "aria-roledescription": "slide",
      "aria-label": null,
    });
    carousel.destroy();
    expect(marks(listitem as Element, ARIA)).toEqual({
      role: "listitem",
      "aria-roledescription": null,
      "aria-label": "Mine",
    });
    expect(root.getAttribute("role")).toBe("group");
  });

  it("leaves a list's semantics to the list", () => {
    document.body.innerHTML = '<ul id="stage"><li></li><li></li></ul>';
    const root = document.getElementById("stage") as HTMLElement;
    createCarousel(root, { size: 100 });
    for (const element of [root, ...root.children]) {
      expect(ARIA.filter((name) => element.hasAttribute(name))).toEqual([]);
    }
  });

  it("names generic containers: sections, spans and custom elements too", () => {
    const root = stage("<section></section><span></span><x-card></x-card>");
    createCarousel(root, { size: 100 });
    expect([...root.children].map((slide) => slide.getAttribute("role"))).toEqual([
      "group",
      "group",
      "group",
    ]);
  });

  it("stops writing a label the user set after mount, and leaves it on destroy", async () => {
    const root = stage("<div></div>".repeat(2));
    const carousel = createCarousel(root, { size: 100 });
    root.firstElementChild?.setAttribute("aria-label", "Mine later");
    root.setAttribute("aria-label", "Our picks");
    root.append(document.createElement("div"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(root.firstElementChild?.getAttribute("aria-label")).toBe("Mine later");
    expect(root.children[1]?.getAttribute("aria-label")).toBe("2 of 3");
    carousel.destroy();
    expect(root.firstElementChild?.getAttribute("aria-label")).toBe("Mine later");
    expect(root.getAttribute("aria-label")).toBe("Our picks");
    expect(root.children[1]?.hasAttribute("aria-label")).toBe(false);
  });

  it("treats an empty aria-label as none, and rejects an empty `label`", () => {
    const root = stage('<div aria-label=""></div>');
    root.setAttribute("aria-label", " ");
    createCarousel(root, { size: 100 });
    expect(root.getAttribute("aria-label")).toBe("Carousel");
    expect(root.firstElementChild?.getAttribute("aria-label")).toBe("1 of 1");
    expect(() => createCarousel(stage("<div></div>"), { size: 100, label: "" })).toThrow(
      "curvesel: label must be a non-empty string",
    );
  });

  it("reports a `slideLabel` that throws, and keeps going", () => {
    const report = vi.fn();
    vi.stubGlobal("reportError", report);
    const root = stage("<div></div>".repeat(2));
    const carousel = createCarousel(root, {
      size: 100,
      slideLabel: () => {
        throw new Error("no labels today");
      },
    });
    expect(report).toHaveBeenCalledTimes(1);
    expect(root.firstElementChild?.getAttribute("role")).toBe("group");
    expect(carousel.position).toBe(0);
  });
});
