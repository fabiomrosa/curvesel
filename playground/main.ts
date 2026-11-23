// A hand-test page for @curvesel/core (`npm run dev`). Not published, not covered.
import { curvePose, type Plane, type Pose } from "../packages/core/src/index.ts";

const SVG = "http://www.w3.org/2000/svg";
const byId = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const form = byId<HTMLFormElement>("options");
const error = byId<HTMLParagraphElement>("error");
const input = (id: string) => byId<HTMLInputElement>(id);
const value = (id: string) => Number(input(id).value);

function line(x1: number, y1: number, x2: number, y2: number, className: string): SVGLineElement {
  const element = document.createElementNS(SVG, "line");
  element.setAttribute("x1", String(x1));
  element.setAttribute("y1", String(y1));
  element.setAttribute("x2", String(x2));
  element.setAttribute("y2", String(y2));
  element.setAttribute("class", className);
  return element;
}

/** Offsets of N Slides at a Position: indexes split on both sides of 0, each `index − position`. */
function offsets(count: number, position: number): number[] {
  return Array.from({ length: count }, (_, i) => i - Math.floor(count / 2) - position);
}

type Vector = readonly [number, number, number];
type View = { svg: SVGSVGElement; axes: readonly [0 | 1 | 2, 0 | 1 | 2] };

const svg = (id: string) => document.getElementById(id) as unknown as SVGSVGElement;
const views: readonly View[] = [
  { svg: svg("top"), axes: [0, 2] },
  { svg: svg("front"), axes: [0, 1] },
  { svg: svg("side"), axes: [2, 1] },
];

/** Column `j` of a row-major 3×3 rotation: where the Slide's own axis `j` points. */
function axis(pose: Pose, j: 0 | 1 | 2): Vector {
  const r = pose.rotation;
  // Indexes 0–8 of a 9-element tuple: always defined.
  return [r[j], r[3 + j], r[6 + j]] as Vector;
}

/** One view: each Slide a segment along the Curve's direction, a tick along its own z axis. */
function draw(
  { svg, axes: [a, b] }: View,
  poses: { offset: number; pose: Pose }[],
  size: number,
  plane: Plane,
): void {
  const half = size / 2;
  const shapes: SVGLineElement[] = [];
  const us: number[] = [];
  const vs: number[] = [];
  for (const { offset, pose } of poses) {
    const p: Vector = [pose.x, pose.y, pose.z];
    // The Curve runs along the Slide's own y axis in the wheel, along its x axis otherwise.
    const along = axis(pose, plane === "yz" ? 1 : 0);
    const face = axis(pose, 2);
    const ends = [
      p[a] - along[a] * half,
      p[b] - along[b] * half,
      p[a] + along[a] * half,
      p[b] + along[b] * half,
    ] as const;
    const kind = Math.abs(offset) < 0.5 ? "slide centre" : pose.visible ? "slide" : "slide hidden";
    shapes.push(line(...ends, kind));
    shapes.push(
      line(p[a], p[b], p[a] + face[a] * half * 0.4, p[b] + face[b] * half * 0.4, "facing"),
    );
    us.push(ends[0], ends[2]);
    vs.push(ends[1], ends[3]);
  }
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  const span = Math.max(u1 - u0, v1 - v0, size) * 1.15;
  // The view stays centred on the drawing, square, with a margin.
  svg.setAttribute(
    "viewBox",
    `${(u0 + u1) / 2 - span / 2} ${(v0 + v1) / 2 - span / 2} ${span} ${span}`,
  );
  svg.replaceChildren(...shapes);
  for (const shape of shapes) shape.setAttribute("vector-effect", "non-scaling-stroke");
}

function render(): void {
  for (const output of form.querySelectorAll("output")) {
    output.textContent = input(output.htmlFor.value).value;
  }
  const plane = byId<HTMLSelectElement>("plane").value as Plane;
  const options = {
    curvature: value("curvature"),
    gap: value("gap"),
    plane,
    visibleRange: value("visible-range"),
    wave: {
      amplitude: value("amplitude"),
      wavelength: value("wavelength"),
      phase: value("phase"),
      anchor: byId<HTMLSelectElement>("anchor").value as "space" | "ribbon",
      plane: byId<HTMLSelectElement>("wave-plane").value as "z" | "y",
    },
  };
  const context = { size: value("size"), position: value("position") };
  try {
    const poses = offsets(value("count"), context.position).map((offset) => ({
      offset,
      pose: curvePose(offset, options, context),
    }));
    // Painted back to front, as the browser stacks them by z-index.
    poses.sort((a, b) => a.pose.zIndex - b.pose.zIndex);
    for (const view of views) draw(view, poses, context.size, plane);
    error.textContent = "";
  } catch (thrown) {
    error.textContent = thrown instanceof Error ? thrown.message : String(thrown);
  }
}

byId<HTMLButtonElement>("close-ring").addEventListener("click", () => {
  input("curvature").value = String((2 * Math.PI) / value("count"));
  render();
});
form.addEventListener("input", render);
render();
