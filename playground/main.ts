// A hand-test page for @curvesel/core (`npm run dev`). Not published, not covered.
import { curvePose, type Pose } from "../packages/core/src/index.ts";

const SVG = "http://www.w3.org/2000/svg";
const byId = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const form = byId<HTMLFormElement>("options");
const error = byId<HTMLParagraphElement>("error");
const top = document.getElementById("top") as unknown as SVGSVGElement;
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

/** Offsets of N Slides around the centre: 0 is the centre, the rest split on both sides. */
function offsets(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i - Math.floor(count / 2));
}

/** The top view: each Slide a segment along its own x axis, a tick along its own z axis. */
function drawTop(poses: { offset: number; pose: Pose }[], size: number): void {
  const half = size / 2;
  const shapes: SVGLineElement[] = [];
  const xs: number[] = [];
  const zs: number[] = [];
  for (const { offset, pose } of poses) {
    const [ax, , fx, , , , az, , fz] = pose.rotation;
    const ends = [
      pose.x - ax * half,
      pose.z - az * half,
      pose.x + ax * half,
      pose.z + az * half,
    ] as const;
    shapes.push(line(...ends, offset === 0 ? "slide centre" : "slide"));
    shapes.push(line(pose.x, pose.z, pose.x + fx * half * 0.4, pose.z + fz * half * 0.4, "facing"));
    xs.push(ends[0], ends[2]);
    zs.push(ends[1], ends[3]);
  }
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const span = Math.max(x1 - x0, z1 - z0, 1) * 1.15;
  // The view stays centred on the drawing, square, with a margin.
  const left = (x0 + x1) / 2 - span / 2;
  top.setAttribute("viewBox", `${left} ${(z0 + z1) / 2 - span / 2} ${span} ${span}`);
  top.replaceChildren(...shapes);
  for (const shape of shapes) shape.setAttribute("vector-effect", "non-scaling-stroke");
}

function render(): void {
  for (const output of form.querySelectorAll("output")) {
    output.textContent = input(output.htmlFor.value).value;
  }
  const options = { curvature: value("curvature"), gap: value("gap") };
  const context = { size: value("size") };
  try {
    const poses = offsets(value("count")).map((offset) => ({
      offset,
      pose: curvePose(offset, options, context),
    }));
    drawTop(poses, context.size);
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
