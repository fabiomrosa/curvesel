// @vitest-environment happy-dom
import { curvePose, type Layout, type Pose, presets, rotationFromAngles } from "@curvesel/core";
import { afterEach, describe, expect, it } from "vitest";
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

afterEach(() => {
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
    expect(() => createCarousel(stage(2), { size: 100, perspective: 0 })).toThrow(
      "curvesel: perspective must be a finite number > 0, got 0",
    );
    expect(() =>
      createCarousel(stage(2), { size: 100, layout: { curvature: 0, gap: -1 } }),
    ).toThrow("curvesel: gap");
  });
});
