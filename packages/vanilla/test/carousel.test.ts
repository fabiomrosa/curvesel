// @vitest-environment happy-dom
import { curvePose, type Layout, type Pose, presets, rotationFromAngles } from "@curvesel/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type CarouselOptions, createCarousel } from "../src/index.ts";

/** A Stage of `count` Slides; happy-dom has no layout, so sizes are stubbed where they matter. */
function stage(count: number, inner = ""): HTMLElement {
  document.body.innerHTML = `<div id="stage">${Array.from(
    { length: count },
    (_, i) => `<div class="card">${i}${inner}</div>`,
  ).join("")}</div>`;
  return document.getElementById("stage") as HTMLElement;
}

const slides = (root: HTMLElement) => [...root.children] as HTMLElement[];

function stub(element: HTMLElement, sizes: Record<string, number>): void {
  for (const [name, value] of Object.entries(sizes)) {
    Object.defineProperty(element, name, { configurable: true, get: () => value });
  }
}

/** The numbers of the `matrix3d(...)` in a transform, column-major as CSS writes them. */
function matrix(transform: string): number[] {
  const inside = /matrix3d\(([^)]*)\)/.exec(transform)?.[1] ?? "";
  return inside.split(",").map(Number);
}

/** The matrix3d of a Pose, from CSS's definition: column j holds where the local axis j goes. */
function expectPose(transform: string, pose: Pose): void {
  const m = matrix(transform);
  expect(m).toHaveLength(16);
  const r = pose.rotation;
  for (let column = 0; column < 3; column++) {
    for (let row = 0; row < 3; row++) {
      expect(m[column * 4 + row]).toBeCloseTo(r[row * 3 + column] as number, 9);
    }
    expect(m[column * 4 + 3]).toBeCloseTo(0, 12);
  }
  expect(m[12]).toBeCloseTo(pose.x, 6);
  expect(m[13]).toBeCloseTo(pose.y, 6);
  expect(m[14]).toBeCloseTo(pose.z, 6);
  expect(m[15]).toBeCloseTo(1, 12);
}

/** Every attribute and inline declaration of an element, in a stable order. */
function snapshot(element: HTMLElement): string[] {
  const attributes = element
    .getAttributeNames()
    .filter((name) => name !== "style")
    .map((name) => `${name}=${element.getAttribute(name)}`);
  const declarations = Array.from({ length: element.style.length }, (_, i) =>
    element.style.item(i),
  ).map((name) => `${name}:${element.style.getPropertyValue(name)}`);
  return [...attributes, ...declarations].sort();
}

/** Mounts 3 Slides with these sizes stubbed, and returns the second Slide's transform. */
function mounted(options: CarouselOptions, sizes: Record<string, number>[] = []): string {
  const root = stage(3);
  slides(root).forEach((slide, i) => {
    stub(slide, sizes[i] ?? {});
  });
  createCarousel(root, options);
  return slides(root)[1]?.style.transform ?? "";
}

/** A stand-in for `ResizeObserver`: it records what it watches, and `resize()` fires it. */
class FakeResizeObserver {
  static last: FakeResizeObserver | undefined;
  readonly watched = new Set<Element>();
  readonly boxes = new Set<string | undefined>();
  constructor(private readonly callback: () => void) {
    FakeResizeObserver.last = this;
  }
  observe(target: Element, options?: ResizeObserverOptions): void {
    this.watched.add(target);
    this.boxes.add(options?.box);
  }
  unobserve(target: Element): void {
    this.watched.delete(target);
  }
  disconnect(): void {
    this.watched.clear();
  }
  resize(): void {
    if (this.watched.size > 0) this.callback();
  }
}
const resize = () => FakeResizeObserver.last?.resize();

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("createCarousel", () => {
  it("places every Slide at its Pose for Position 0, centred on the Stage", () => {
    const root = stage(5);
    stub(root, { clientWidth: 800, clientHeight: 400 });
    createCarousel(root, { layout: "cylinder", size: 200 });
    slides(root).forEach((slide, i) => {
      // Not looping: Slide i sits at Offset i, the far ones hidden.
      const offset = i;
      const pose = curvePose(offset, presets.cylinder, { size: 200, position: 0 });
      expect(
        slide.style.transform.startsWith("translate(400px, 200px) translate(-50%, -50%) "),
      ).toBe(true);
      expectPose(slide.style.transform, pose);
      expect(slide.style.position).toBe("absolute");
      expect(slide.style.zIndex).toBe(String(pose.zIndex));
      expect(slide.style.visibility).toBe(pose.visible ? "visible" : "hidden");
      expect(Number(slide.style.getPropertyValue("--cs-offset"))).toBeCloseTo(offset, 12);
      expect(Number(slide.style.getPropertyValue("--cs-abs-offset"))).toBeCloseTo(
        Math.abs(offset),
        12,
      );
      expect(slide.hasAttribute("data-cs-active")).toBe(i === 0);
      expect(slide.hasAttribute("data-cs-visible")).toBe(pose.visible);
    });
    expect(root.style.position).toBe("relative");
    expect(root.style.perspective).toBe("1000px");
  });

  it("centres each Slide from where it starts, after it becomes absolute", () => {
    // Padding or alignment moves where an absolute Slide starts; sizes change once out of the flow.
    const root = stage(3);
    const out = () => slides(root).every((slide) => slide.style.position === "absolute");
    const when = (absolute: number, inFlow: number) => ({ get: () => (out() ? absolute : inFlow) });
    Object.defineProperties(root, { clientWidth: when(800, 800), clientHeight: when(400, 900) });
    for (const slide of slides(root)) {
      stub(slide, { offsetLeft: 80, offsetTop: 50 });
      Object.defineProperty(slide, "offsetWidth", when(150, 800));
    }
    createCarousel(root, { layout: "ribbon" });
    const second = slides(root)[1]?.style.transform ?? "";
    expect(second.startsWith("translate(320px, 150px) translate(-50%, -50%) ")).toBe(true);
    expectPose(second, curvePose(1, presets.ribbon, { size: 150 }));
  });

  it("wraps the Offsets when looping, the far Slides behind the centre", () => {
    const root = stage(5);
    createCarousel(root, { loop: true, size: 100 });
    const last = slides(root)[4] as HTMLElement;
    expect(Number(last.style.getPropertyValue("--cs-offset"))).toBeCloseTo(-1, 12);
    expect(Number(last.style.getPropertyValue("--cs-abs-offset"))).toBeCloseTo(1, 12);
    expectPose(last.style.transform, curvePose(-1, presets.cylinder, { size: 100 }));
  });

  it("takes a Preset name, a Curve's options or a Layout function", () => {
    const options = { curvature: 0.3, gap: 10, plane: "xy" as const };
    expectPose(mounted({ layout: options, size: 100 }), curvePose(1, options, { size: 100 }));
    const lifted: Layout = (offset) => ({
      ...{ x: offset * 50, y: -10, z: 0, zIndex: 7, visible: true },
      rotation: rotationFromAngles(0, 0, offset),
    });
    expectPose(mounted({ layout: lifted, size: 100 }), lifted(1, { size: 100 }));
    expectPose(mounted({ layout: "arc", size: 100 }), curvePose(1, presets.arc, { size: 100 }));
  });

  it("measures the largest Slide along the Curve, unless `size` is given", () => {
    const widths = [100, 300, 200].map((offsetWidth) => ({ offsetWidth, offsetHeight: 50 }));
    expectPose(mounted({ layout: "ribbon" }, widths), curvePose(1, presets.ribbon, { size: 300 }));
    const heights = [40, 60, 80].map((offsetHeight) => ({ offsetWidth: 500, offsetHeight }));
    expectPose(mounted({ layout: "wheel" }, heights), curvePose(1, presets.wheel, { size: 80 }));
    expectPose(
      mounted({ layout: "ribbon", size: 120 }, widths),
      curvePose(1, presets.ribbon, { size: 120 }),
    );
  });
});

describe("follow the size", () => {
  it("lays the Slides out again when a Slide or the Stage changes size", () => {
    const root = stage(3);
    let width = 100;
    let stageWidth = 800;
    Object.defineProperty(root, "clientWidth", { get: () => stageWidth });
    for (const slide of slides(root))
      Object.defineProperty(slide, "offsetWidth", { get: () => width });
    createCarousel(root, { layout: "ribbon" });
    const second = slides(root)[1] as HTMLElement;
    width = 250;
    resize();
    expectPose(second.style.transform, curvePose(1, presets.ribbon, { size: 250 }));
    stageWidth = 600;
    resize();
    expect(second.style.transform.startsWith("translate(300px, ")).toBe(true);
  });

  it("keeps a given size, still re-centring a Slide that moved", () => {
    const root = stage(3);
    let left = 0;
    for (const slide of slides(root)) {
      stub(slide, { offsetWidth: 100 });
      Object.defineProperty(slide, "offsetLeft", { get: () => left });
    }
    createCarousel(root, { layout: "ribbon", size: 120 });
    const second = slides(root)[1] as HTMLElement;
    left = 40;
    resize();
    expect(second.style.transform.startsWith("translate(-40px, ")).toBe(true);
    expectPose(second.style.transform, curvePose(1, presets.ribbon, { size: 120 }));
  });

  it("keeps the last layout while the Slides measure 0, as when the Stage is hidden", () => {
    const root = stage(3);
    let width = 100;
    for (const slide of slides(root))
      Object.defineProperty(slide, "offsetWidth", { get: () => width });
    createCarousel(root, { layout: "ribbon" });
    const before = slides(root)[1]?.style.transform;
    width = 0;
    expect(() => resize()).not.toThrow();
    expect(slides(root)[1]?.style.transform).toBe(before);
  });

  it("watches the Stage and every Slide, and stops on destroy", () => {
    const root = stage(3);
    const carousel = createCarousel(root, { size: 100 });
    expect([...(FakeResizeObserver.last?.watched ?? [])]).toEqual([root, ...slides(root)]);
    // The border box, as measured: a padding or border change alone must fire it too.
    expect([...(FakeResizeObserver.last?.boxes ?? [])]).toEqual(["border-box"]);
    carousel.destroy();
    expect(FakeResizeObserver.last?.watched.size).toBe(0);
  });
});

describe("follow the children", () => {
  /** MutationObserver callbacks run as a microtask after the change. */
  const mutated = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("adopts an added child and gives a removed one back as it was", async () => {
    const root = stage(3);
    const leaving = slides(root)[1] as HTMLElement;
    const before = snapshot(leaving);
    createCarousel(root, { layout: "ribbon", size: 100 });
    const arriving = document.createElement("div");
    root.append(arriving);
    leaving.remove();
    await mutated();
    expectPose(arriving.style.transform, curvePose(2, presets.ribbon, { size: 100 }));
    expect(snapshot(leaving)).toEqual(before);
    expect(FakeResizeObserver.last?.watched.has(arriving)).toBe(true);
    expect(FakeResizeObserver.last?.watched.has(leaving)).toBe(false);
  });

  it("takes the new count when looping, so the Offsets wrap around it", async () => {
    const root = stage(3);
    createCarousel(root, { loop: true, size: 100 });
    root.append(document.createElement("div"));
    await mutated();
    const offsets = slides(root).map((slide) =>
      Number(slide.style.getPropertyValue("--cs-offset")),
    );
    expect(offsets).toEqual([0, 1, -2, -1]);
  });

  it("mounts an empty Stage, and draws when a child arrives", async () => {
    const root = stage(0);
    createCarousel(root);
    const first = document.createElement("div");
    stub(first, { offsetWidth: 100 });
    root.append(first);
    await mutated();
    expect(first.hasAttribute("data-cs-active")).toBe(true);
  });

  it("hands a Slide over cleanly when it moves to another Carousel", async () => {
    // Whichever Carousel's observer runs first, the Slide ends up laid out by its new one.
    for (const order of [
      ["b", "a"],
      ["a", "b"],
    ]) {
      document.body.innerHTML = `<div id="a"><div></div><div></div></div><div id="b"><div></div></div>`;
      const byId = (id: string) => document.getElementById(id) as HTMLElement;
      const moving = slides(byId("a"))[0] as HTMLElement;
      const before = snapshot(moving);
      const carousels = order.map((id) => createCarousel(byId(id), { size: 100 }));
      byId("b").append(moving);
      await mutated();
      expect(moving.style.position).toBe("absolute");
      expect(Number(moving.style.getPropertyValue("--cs-offset"))).toBeCloseTo(1, 12);
      for (const carousel of carousels) carousel.destroy();
      expect(snapshot(moving)).toEqual(before);
    }
  });

  it("stops following on destroy", async () => {
    const root = stage(2);
    createCarousel(root, { size: 100 }).destroy();
    const late = document.createElement("div");
    root.append(late);
    await mutated();
    expect(late.getAttribute("style")).toBeNull();
  });
});

describe("motion", () => {
  const settle = () => vi.advanceTimersByTime(5000);
  const mutated = () => new Promise((resolve) => setTimeout(resolve, 0));
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("animates to the Slide `goTo` names, and requests no frame at rest", () => {
    const root = stage(5);
    const carousel = createCarousel(root, { layout: "ribbon", size: 100 });
    carousel.goTo(3);
    vi.advanceTimersByTime(100);
    expect(carousel.position).toBeGreaterThan(0);
    expect(carousel.position).toBeLessThan(3);
    // Real time: a Snap of 3 Slides (ω = 12/s) rests within about a second.
    vi.advanceTimersByTime(1400);
    expect(vi.getTimerCount()).toBe(0);
    expect(carousel.position).toBeCloseTo(3, 9);
    expect(slides(root)[3]?.hasAttribute("data-cs-active")).toBe(true);
    expectPose(
      slides(root)[4]?.style.transform ?? "",
      curvePose(1, presets.ribbon, { size: 100, position: 3 }),
    );
    expect(vi.getTimerCount()).toBe(0);
    expect(() => carousel.goTo(5)).toThrow("curvesel: index");
  });

  it("steps with next and previous, stopping at the ends or wrapping when looping", () => {
    const carousel = createCarousel(stage(4), { size: 100 });
    carousel.previous();
    settle();
    expect(carousel.position).toBeCloseTo(0, 9);
    carousel.next();
    carousel.next();
    settle();
    expect(carousel.position).toBeCloseTo(2, 9);
    const looping = createCarousel(stage(4), { size: 100, loop: true });
    looping.previous();
    settle();
    expect(looping.position).toBeCloseTo(-1, 9);
  });

  it("writes a culled Slide once, and again only when it comes back", () => {
    const root = stage(8);
    const carousel = createCarousel(root, { layout: "cylinder", size: 100 });
    const [far, near] = [slides(root)[6], slides(root)[3]] as [HTMLElement, HTMLElement];
    far.style.transform = "none";
    near.style.transform = "none";
    carousel.goTo(1);
    settle();
    expect(far.style.transform).toBe("none");
    expect(near.style.transform).not.toBe("none");
    expect(near.hasAttribute("data-cs-visible")).toBe(true);
    // A resize measures again, and writes every Slide once more.
    resize();
    expect(far.style.transform).not.toBe("none");
  });

  it("cancels a pending frame on destroy", () => {
    const carousel = createCarousel(stage(3), { size: 100 });
    carousel.goTo(2);
    carousel.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("Snaps back to the last Slide when the Slides it was on are removed", async () => {
    const root = stage(5);
    const carousel = createCarousel(root, { size: 100 });
    carousel.goTo(4);
    settle();
    slides(root)[4]?.remove();
    slides(root)[3]?.remove();
    await mutated();
    settle();
    expect(carousel.position).toBeCloseTo(2, 9);
  });
});

describe("destroy", () => {
  it("restores a static Stage, and leaves nothing written when mounting throws", () => {
    for (const options of [{ size: 100 }, { size: 100, layout: { curvature: 0, gap: -1 } }, {}]) {
      const root = stage(2);
      const before = [root, ...slides(root)].map(snapshot);
      try {
        createCarousel(root, options).destroy();
      } catch (error) {
        expect(String(error)).toMatch(/curvesel: (gap|the Slides measure 0 px)/);
      }
      expect([root, ...slides(root)].map(snapshot)).toEqual(before);
    }
  });

  it("restores everything it wrote, on the same nodes in the same order", () => {
    const root = stage(4, `<input value="typed">`);
    root.style.setProperty("perspective", "300px");
    root.style.setProperty("position", "absolute");
    const first = slides(root)[0] as HTMLElement;
    first.style.setProperty("transform", "rotate(3deg)", "important");
    first.style.setProperty("z-index", "5");
    first.style.setProperty("color", "red");
    first.setAttribute("data-cs-active", "mine");
    const nodes = slides(root);
    const before = [root, ...nodes].map(snapshot);

    const carousel = createCarousel(root, { size: 100 });
    expect(slides(root)).toEqual(nodes);
    expect(first.style.transform).not.toBe("rotate(3deg)");
    // A Stage that is positioned already keeps its own position.
    expect(root.style.position).toBe("absolute");
    carousel.destroy();

    expect(slides(root)).toEqual(nodes);
    expect([root, ...nodes].map(snapshot)).toEqual(before);
    expect(first.style.getPropertyPriority("transform")).toBe("important");
  });
});

describe("options", () => {
  it("throws a message naming what is invalid", () => {
    expect(() => createCarousel(null as unknown as HTMLElement)).toThrow(
      "curvesel: stage must be an HTMLElement, got null",
    );
    expect(() =>
      createCarousel(stage(2), { layout: "spiral" as unknown as "arc", size: 100 }),
    ).toThrow("curvesel: layout must be a Preset name (cylinder, ribbon, wheel, arc)");
    expect(() => createCarousel(stage(2), { size: -1 })).toThrow(
      "curvesel: size must be a finite number > 0, got -1",
    );
    expect(() => createCarousel(stage(2), { size: 100, friction: 2 })).toThrow(
      "curvesel: friction",
    );
    expect(() => createCarousel(stage(2), { size: 100, rubberBand: 2 })).toThrow(
      "curvesel: rubberBand",
    );
    expect(() => createCarousel(stage(2), { size: 100, perspective: 0 })).toThrow(
      "curvesel: perspective must be a finite number > 0, got 0",
    );
    expect(() =>
      createCarousel(stage(2), { size: 100, layout: { curvature: 0, gap: -1 } }),
    ).toThrow("curvesel: gap");
  });
});
