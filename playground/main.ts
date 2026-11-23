// A hand-test page for @curvesel/core (`npm run dev`). Not published, not covered.
import {
  createTrack,
  curvePose,
  dragMove,
  dragStart,
  goTo,
  type Plane,
  type Pose,
  type PresetName,
  presets,
  release,
  slideOffset,
  step,
  type TrackState,
} from "../packages/core/src/index.ts";

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

let track: TrackState = createTrack({ count: value("count") });

/** A new Track for the count and loop controls, kept near its Position. */
function retrack(): void {
  const count = value("count");
  const at = Math.round(track.position);
  // A looped Position shows Slide `at mod count`; keep that Slide.
  const shown = track.loop ? ((at % track.count) + track.count) % track.count : at;
  const position = Math.min(Math.max(shown, 0), count - 1);
  track = { ...createTrack({ count, loop: input("loop").checked }), position, target: position };
}

/** The Offset of every Slide from the Track's Position. */
function offsets({ count, position, loop }: TrackState): number[] {
  return Array.from({ length: count }, (_, i) => slideOffset(i, position, count, loop));
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

/** A Slide's segment in one view: its two ends along the Curve's direction. */
function segment(pose: Pose, [a, b]: View["axes"], half: number, plane: Plane) {
  const p: Vector = [pose.x, pose.y, pose.z];
  // The Curve runs along the Slide's own y axis in the wheel, along its x axis otherwise.
  const along = axis(pose, plane === "yz" ? 1 : 0);
  return [
    p[a] - along[a] * half,
    p[b] - along[b] * half,
    p[a] + along[a] * half,
    p[b] + along[b] * half,
  ] as const;
}

/**
 * One view: each Slide a segment along the Curve's direction, a tick along its own z axis. The view
 * is fitted to `frame` (the Curve at Position 0), not to the Slides, so they move under a Drag.
 */
function draw(
  { svg, axes }: View,
  poses: { offset: number; pose: Pose }[],
  frame: Pose[],
  size: number,
  plane: Plane,
): void {
  const [a, b] = axes;
  const half = size / 2;
  const shapes: SVGLineElement[] = [];
  for (const { offset, pose } of poses) {
    const p: Vector = [pose.x, pose.y, pose.z];
    const face = axis(pose, 2);
    const kind = Math.abs(offset) < 0.5 ? "slide centre" : pose.visible ? "slide" : "slide hidden";
    shapes.push(line(...segment(pose, axes, half, plane), kind));
    shapes.push(
      line(p[a], p[b], p[a] + face[a] * half * 0.4, p[b] + face[b] * half * 0.4, "facing"),
    );
  }
  const ends = frame.map((pose) => segment(pose, axes, half, plane));
  const us = ends.flatMap(([u0, , u1]) => [u0, u1]);
  const vs = ends.flatMap(([, v0, , v1]) => [v0, v1]);
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  const span = Math.max(u1 - u0, v1 - v0, size) * 1.15;
  // The view stays centred on the frame, square, with a margin.
  svg.setAttribute(
    "viewBox",
    `${(u0 + u1) / 2 - span / 2} ${(v0 + v1) / 2 - span / 2} ${span} ${span}`,
  );
  svg.replaceChildren(...shapes);
  for (const shape of shapes) shape.setAttribute("vector-effect", "non-scaling-stroke");
}

function render(): void {
  input("position").value = String(track.position);
  for (const output of form.querySelectorAll("output")) {
    output.textContent = input(output.htmlFor.value).value;
  }
  const plane = byId<HTMLSelectElement>("plane").value as Plane;
  const options = {
    curvature: value("curvature"),
    gap: value("gap"),
    plane,
    visibleRange: value("visible-range"),
    twist: value("twist"),
    tilt: value("tilt"),
    wave: {
      amplitude: value("amplitude"),
      wavelength: value("wavelength"),
      phase: value("phase"),
      anchor: byId<HTMLSelectElement>("anchor").value as "space" | "ribbon",
      plane: byId<HTMLSelectElement>("wave-plane").value as "z" | "y",
    },
  };
  byId<HTMLOutputElement>("track-phase").textContent = track.phase;
  byId<HTMLOutputElement>("at").textContent = track.position.toFixed(3);
  const context = { size: value("size"), position: track.position };
  try {
    const poses = offsets(track).map((offset) => ({
      offset,
      pose: curvePose(offset, options, context),
    }));
    // Painted back to front, as the browser stacks them by z-index.
    poses.sort((a, b) => a.pose.zIndex - b.pose.zIndex);
    const frame = Array.from({ length: track.count }, (_, i) =>
      curvePose(i - Math.floor(track.count / 2), options, { size: context.size }),
    );
    for (const view of views) draw(view, poses, frame, context.size, plane);
    error.textContent = "";
  } catch (thrown) {
    error.textContent = thrown instanceof Error ? thrown.message : String(thrown);
  }
}

byId<HTMLButtonElement>("close-ring").addEventListener("click", () => {
  input("curvature").value = String((2 * Math.PI) / value("count"));
  render();
});
// A Preset sets the controls from its options; the Wave, Twist and Tilt go back to none.
const presetSelect = byId<HTMLSelectElement>("preset");
presetSelect.addEventListener("change", () => {
  const preset = presets[presetSelect.value as PresetName];
  if (!preset) return;
  byId<HTMLSelectElement>("plane").value = preset.plane ?? "xz";
  input("curvature").value = String(preset.curvature);
  input("gap").value = String(preset.gap);
  input("visible-range").value = String(preset.visibleRange ?? input("visible-range").max);
  // The ring Presets close in 10 Slides; more would overlap.
  if (presetSelect.value === "cylinder" || presetSelect.value === "wheel")
    input("count").value = "10";
  for (const id of ["amplitude", "twist", "tilt"]) input(id).value = "0";
  retrack();
  render();
});
// Changing a control by hand leaves the Preset.
form.addEventListener("input", (event) => {
  if (event.target !== presetSelect) presetSelect.value = "";
  if (event.target === input("count") || event.target === input("loop")) retrack();
  // The Position slider drags the Track, and Snaps it when let go.
  if (event.target === input("position")) {
    track = { ...dragStart(track), position: value("position") };
  }
});
input("position").addEventListener("change", () => {
  track = release(track, 0);
  moved();
});

// One animation loop, running only while the Track moves on its own (Inertia or Snap).
let frame = 0;
let last = 0;
let frames = 0;
function animate(now: number): void {
  // A frame's timestamp is when the frame began, which can be before `last` (GOTCHAS).
  track = step(track, Math.max(0, now - last) / 1000);
  last = now;
  render();
  frame = 0;
  if (track.phase === "inertia" || track.phase === "snap") request();
}
function request(): void {
  if (frame) return;
  frames++;
  byId<HTMLOutputElement>("frames").textContent = String(frames);
  frame = requestAnimationFrame((now) => {
    if (!last) last = now;
    animate(now);
  });
}
function moved(): void {
  last = performance.now();
  render();
  if (track.phase === "inertia" || track.phase === "snap") request();
}

// A Drag on any view: pixels divided by the step on screen; released at the recent velocity.
const samples: { time: number; position: number }[] = [];
for (const { svg: view } of views) {
  let start = 0;
  let pixelsPerStep = 1;
  view.addEventListener("pointerdown", (event) => {
    view.setPointerCapture(event.pointerId);
    const box = view.viewBox.baseVal;
    pixelsPerStep = ((value("size") + value("gap")) * view.clientWidth) / box.width;
    start = alongDrag(event);
    track = dragStart(track);
    samples.length = 0;
    samples.push({ time: event.timeStamp, position: track.position });
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    render();
  });
  view.addEventListener("pointermove", (event) => {
    if (track.phase !== "drag" || !view.hasPointerCapture(event.pointerId)) return;
    // Size and gap 0: the Slides have no step to drag by.
    if (!(pixelsPerStep > 0)) return;
    const along = alongDrag(event);
    track = dragMove(track, -(along - start) / pixelsPerStep);
    start = along;
    samples.push({ time: event.timeStamp, position: track.position });
    while (samples.length > 2 && event.timeStamp - (samples[0]?.time ?? 0) > 100) samples.shift();
    render();
  });
  const end = (event: PointerEvent) => {
    if (track.phase !== "drag") return;
    // The velocity over the last 100 ms; a pointer held still has none.
    samples.push({ time: event.timeStamp, position: track.position });
    while (samples.length > 0 && event.timeStamp - (samples[0]?.time ?? 0) > 100) samples.shift();
    const first = samples[0];
    const elapsed = first ? (event.timeStamp - first.time) / 1000 : 0;
    const velocity = first && elapsed > 0 ? (track.position - first.position) / elapsed : 0;
    track = release(track, velocity);
    moved();
  };
  view.addEventListener("pointerup", end);
  view.addEventListener("pointercancel", end);
}
/** The pointer's coordinate along the Curve: down the screen for the wheel, across otherwise. */
function alongDrag(event: PointerEvent): number {
  return byId<HTMLSelectElement>("plane").value === "yz" ? event.clientY : event.clientX;
}

/** The Slide the Track is on or heading to. */
function current(): number {
  const at = track.phase === "snap" ? track.target : Math.round(track.position);
  if (!track.loop) return Math.min(Math.max(at, 0), track.count - 1);
  return ((at % track.count) + track.count) % track.count;
}
for (const [id, by] of [
  ["previous", -1],
  ["next", 1],
] as const) {
  byId<HTMLButtonElement>(id).addEventListener("click", () => {
    const index = current() + by;
    const wrapped = track.loop ? (index + track.count) % track.count : index;
    track = goTo(track, Math.min(Math.max(wrapped, 0), track.count - 1));
    moved();
  });
}
form.addEventListener("input", render);
render();
