import {
  type CurveOptions,
  createTrack,
  curvePose,
  dragMove,
  dragStart,
  goBy,
  type Layout,
  type Plane,
  type Pose,
  type PresetName,
  presets,
  release,
  goTo as sendTo,
  slideOffset,
  step,
  type TrackState,
} from "@curvesel/core";
import { listenForDrag, type Vector } from "./drag.ts";

export interface CarouselOptions {
  /** A Preset name, a Curve's options or a Layout function; `cylinder` by default. */
  layout?: PresetName | CurveOptions | Layout;
  /** The Slide size along the Curve, in px; measured from the largest Slide by default. */
  size?: number;
  /** The Stage's CSS `perspective`, in px; 1000 by default. */
  perspective?: number;
  loop?: boolean;
  /** The fraction of a move that counts past the ends; 0.1 by default. */
  rubberBand?: number;
  /** The fraction of the velocity kept per second of Inertia. */
  friction?: number;
  /** How far a pointer moves, in px, before it is a drag and its click is stopped; 10 by default. */
  dragThreshold?: number;
  /** The Stage's accessible name, unless it has one; "Carousel" by default (DEC-15). */
  label?: string;
  /** Each Slide's accessible name, unless it has one; "3 of 10" by default (DEC-15). */
  slideLabel?: (index: number, count: number) => string;
}

/** What each event hands its handlers. */
export interface CarouselEvents {
  /** The Position, once per frame that moved it. */
  change: number;
  /** The Active slide's index, when it changes. */
  select: number;
}

export interface Carousel {
  /** The Track's Position: 2.5 is halfway between Slides 2 and 3. */
  readonly position: number;
  /** Animates to Slide `index` (the short way round when looping). */
  goTo(index: number): void;
  next(): void;
  previous(): void;
  /** Calls `handler` on each `name` event; returns what stops it. */
  on<K extends keyof CarouselEvents>(
    name: K,
    handler: (value: CarouselEvents[K]) => void,
  ): () => void;
  /** Restores every property and attribute the Carousel wrote. */
  destroy(): void;
}

const DEFAULT_PERSPECTIVE = 1000;
/** Px: about a finger's slop on a tap. */
const DEFAULT_DRAG_THRESHOLD = 10;
/** Ms without a wheel event before the Track Snaps. */
const WHEEL_PAUSE = 150;
/** Px per line, for a wheel that counts in lines (Firefox). */
const WHEEL_LINE = 16;
/** Each arrow key's direction on screen. */
const ARROWS: Record<string, Vector> = {
  ArrowRight: { x: 1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowDown: { x: 0, y: 1 },
  ArrowUp: { x: 0, y: -1 },
};
/**
 * Every adopted Slide, and what gives it back. A Slide moved to another Stage is given back by its
 * old Carousel before the new one saves it, whichever observer runs first.
 */
const owners = new WeakMap<HTMLElement, () => void>();
const POSITIONED = ["relative", "absolute", "fixed", "sticky"];
const SLIDE_PROPERTIES = [
  "position",
  "transform",
  "z-index",
  "visibility",
  "--cs-offset",
  "--cs-abs-offset",
];
const SLIDE_ATTRIBUTES = ["data-cs-active", "data-cs-visible"];
/** Elements with no role of their own, which DEC-15's ARIA may name (custom elements too). */
const GENERIC = ["div", "span", "section"];

/** Lays the Stage's children out on the Curve; they stay the user's nodes, in place (DEC-07). */
export function createCarousel(stage: HTMLElement, options: CarouselOptions = {}): Carousel {
  if (!(stage instanceof HTMLElement)) {
    throw new Error(`curvesel: stage must be an HTMLElement, got ${String(stage)}`);
  }
  const { layout, plane } = resolveLayout(options.layout ?? "cylinder");
  const perspective = options.perspective ?? DEFAULT_PERSPECTIVE;
  if (!(Number.isFinite(perspective) && perspective > 0)) {
    throw new Error(`curvesel: perspective must be a finite number > 0, got ${perspective}`);
  }
  if (options.size !== undefined && !(Number.isFinite(options.size) && options.size > 0)) {
    throw new Error(`curvesel: size must be a finite number > 0, got ${options.size}`);
  }
  const dragThreshold = options.dragThreshold ?? DEFAULT_DRAG_THRESHOLD;
  if (!(Number.isFinite(dragThreshold) && dragThreshold >= 0)) {
    throw new Error(`curvesel: dragThreshold must be a finite number ≥ 0, got ${dragThreshold}`);
  }
  const loop = options.loop ?? false;
  const { rubberBand, friction } = options;
  let slides: HTMLElement[] = [];
  let track: TrackState = createTrack({
    count: 1,
    loop,
    ...(rubberBand === undefined ? {} : { rubberBand }),
    ...(friction === undefined ? {} : { friction }),
  });
  const owned = new Set<HTMLElement>();
  const slideLabel = options.slideLabel ?? ((index, count) => `${index + 1} of ${count}`);
  if (options.label !== undefined && !(typeof options.label === "string" && options.label.trim())) {
    throw new Error(
      `curvesel: label must be a non-empty string, got ${JSON.stringify(options.label)}`,
    );
  }
  /** The ARIA the library wrote on each element, attribute by attribute (DEC-15). */
  const voiced: Voiced = new Map();
  const saved = [save(stage, ["perspective", "touch-action"], [])];
  const measure = () => options.size ?? largest(slides, plane);
  // Geometry is read on mount, resize and child changes only; a frame computes and writes.
  const geometry = { size: 0, centres: [] as string[], hidden: new Set<HTMLElement>() };
  const paint = () => {
    // While the Slides measure 0 (a hidden Stage) nothing is written: the last layout stays.
    if (geometry.size > 0) render(slides, track, layout, geometry);
  };
  const draw = () => {
    const size = measure();
    Object.assign(geometry, { size, centres: centres(stage, slides) });
    geometry.hidden.clear();
    paint();
  };
  const handlers = {
    change: new Set<(value: number) => void>(),
    select: new Set<(value: number) => void>(),
  };
  let heard = { position: 0, active: 0 };
  /** Tells the handlers what changed since they last heard. */
  const notify = () => {
    const { position } = track;
    const active = activeIndex(track);
    const before = heard;
    heard = { position, active };
    if (position !== before.position) emit(handlers.change, position);
    if (active !== before.active) emit(handlers.select, active);
  };
  let frame = 0;
  let last: number | undefined;
  let destroyed = false;
  const request = () => {
    if (frame === 0 && !destroyed) frame = requestAnimationFrame(tick);
  };
  // One loop, running only while the Track moves on its own; `dt` clamped at 0 (GOTCHAS).
  const tick = (now: number) => {
    frame = 0;
    if (dragging && (pending.x !== 0 || pending.y !== 0)) {
      track = dragMove(track, toPositions(dragging, pending));
      pending = { x: 0, y: 0 };
    }
    track = step(track, last === undefined ? 0 : Math.max(0, now - last) / 1000);
    last = now;
    paint();
    if (track.phase === "inertia" || track.phase === "snap") request();
    else last = undefined;
    notify();
  };
  const move = (next: TrackState) => {
    track = next;
    request();
  };
  let wheeling: ReturnType<typeof setTimeout> | undefined;
  /** Ends a wheel gesture now, so a Drag, a key or a call takes the Track from there. */
  const endWheel = () => {
    if (wheeling === undefined) return;
    clearTimeout(wheeling);
    wheeling = undefined;
    track = release(track, 0);
  };
  const goTo = (index: number) => {
    endWheel();
    move(sendTo(track, index));
  };
  const goOn = (delta: number) => {
    endWheel();
    move(goBy(track, delta));
  };
  // A Drag: the pointer's moves are stored, then applied in the next frame along the Curve.
  let dragging: ScreenStep | undefined;
  let pending: Vector = { x: 0, y: 0 };
  const stopListening = listenForDrag(stage, dragThreshold, {
    start() {
      endWheel();
      dragging = screenStep(layout, geometry.size, track.position);
      if (dragging) track = dragStart(track);
      pending = { x: 0, y: 0 };
    },
    move(delta) {
      if (!dragging) return;
      pending = { x: pending.x + delta.x, y: pending.y + delta.y };
      request();
    },
    end(velocity) {
      if (!dragging) return;
      track = release(
        dragMove(track, toPositions(dragging, pending)),
        toPositions(dragging, velocity),
      );
      pending = { x: 0, y: 0 };
      dragging = undefined;
      request();
    },
  });
  // A wheel along the Curve moves the Track like a Drag, within the ends, and Snaps after a pause;
  // one mostly across it, a pinch (`ctrlKey`) or one the page already scrolls with is the page's.
  const wheel = (event: WheelEvent) => {
    const along = dragging ? undefined : screenStep(layout, geometry.size, track.position);
    if (!along || event.ctrlKey || !event.cancelable) return;
    const { x, y } = along.axis;
    if (
      Math.abs(event.deltaX * x + event.deltaY * y) <= Math.abs(event.deltaX * y - event.deltaY * x)
    )
      return;
    const unit = event.deltaMode === 1 ? WHEEL_LINE : event.deltaMode === 2 ? along.px : 1;
    const by = -toPositions(along, { x: event.deltaX * unit, y: event.deltaY * unit });
    const from = track.position;
    const to = loop ? from + by : Math.min(Math.max(from + by, 0), track.count - 1);
    // At an end the page scrolls instead.
    if (to === from) return;
    event.preventDefault();
    move(dragMove(dragStart(track), to - from));
    clearTimeout(wheeling);
    wheeling = setTimeout(() => {
      wheeling = undefined;
      move(release(track, 0));
    }, WHEEL_PAUSE);
  };
  // Keys on the focused Stage; a Slide's own keys (an input's arrows) stay the Slide's.
  const key = (event: KeyboardEvent) => {
    if (event.target !== stage || event.altKey || event.ctrlKey || event.metaKey) return;
    const arrow = ARROWS[event.key];
    const along = screenStep(layout, geometry.size, track.position);
    if (event.key === "Home") goTo(0);
    else if (event.key === "End") goTo(track.count - 1);
    else if (arrow && along && Math.abs(arrow.x * along.axis.x + arrow.y * along.axis.y) >= 0.5) {
      goOn(Math.sign(arrow.x * along.axis.x + arrow.y * along.axis.y));
    } else return;
    event.preventDefault();
  };
  const resizes = new ResizeObserver(draw);
  /** Adopts the Stage's children as they are now: new ones taken in, removed ones given back. */
  const adopt = () => {
    const children = [...stage.children].filter((child) => child instanceof HTMLElement);
    for (const slide of owned) if (!children.includes(slide)) owners.get(slide)?.();
    for (const slide of children) {
      if (owned.has(slide)) continue;
      owners.get(slide)?.();
      const restore = save(slide, SLIDE_PROPERTIES, SLIDE_ATTRIBUTES);
      owned.add(slide);
      owners.set(slide, () => {
        resizes.unobserve(slide);
        restore();
        unvoice(voiced, slide);
        owned.delete(slide);
        owners.delete(slide);
      });
      // Measured once out of the flow, as it will stay.
      slide.style.position = "absolute";
      resizes.observe(slide, { box: "border-box" });
    }
    slides = children;
    track = { ...track, count: Math.max(slides.length, 1) };
    let labels: string[] | undefined;
    try {
      labels = slides.map((_, index) => slideLabel(index, slides.length));
    } catch (error) {
      reportError(error);
    }
    slides.forEach((slide, index) => {
      voice(voiced, slide, ["group", "slide"], labels?.[index]);
    });
    // Past the new last Slide (it was removed), Snap back to it.
    const at = track.phase === "snap" ? track.target : track.position;
    if (!loop && at > track.count - 1) goTo(track.count - 1);
  };
  const mutations = new MutationObserver(() => {
    adopt();
    draw();
    notify();
  });
  const destroy = () => {
    destroyed = true;
    stopListening();
    clearTimeout(wheeling);
    stage.removeEventListener("wheel", wheel);
    stage.removeEventListener("keydown", key);
    for (const set of Object.values(handlers)) set.clear();
    if (frame !== 0) cancelAnimationFrame(frame);
    mutations.disconnect();
    resizes.disconnect();
    for (const slide of owned) owners.get(slide)?.();
    for (const restore of saved) restore();
    unvoice(voiced, stage);
  };
  try {
    // A positioned Stage keeps its own position; a static one becomes the Slides' containing block.
    if (!POSITIONED.includes(getComputedStyle(stage).position)) {
      saved.push(save(stage, ["position"], []));
      stage.style.position = "relative";
    }
    stage.style.perspective = `${perspective}px`;
    voice(voiced, stage, ["region", "carousel"], options.label ?? "Carousel");
    // Focusable for the keys (DEC-14); a `tabindex` the user set stays theirs.
    if (!stage.hasAttribute("tabindex")) {
      saved.push(save(stage, [], ["tabindex"]));
      stage.setAttribute("tabindex", "0");
    }
    stage.addEventListener("wheel", wheel, { passive: false });
    stage.addEventListener("keydown", key);
    // A touch drag along the Curve; the page still scrolls across it (GOTCHAS).
    const axis = screenStep(layout, options.size ?? 1, 0)?.axis ?? { x: 1, y: 0 };
    stage.style.touchAction = Math.abs(axis.y) > Math.abs(axis.x) ? "pan-x" : "pan-y";
    resizes.observe(stage, { box: "border-box" });
    adopt();
    if (slides.length > 0 && !(measure() > 0)) {
      throw new Error(
        "curvesel: the Slides measure 0 px along the Curve; give `size`, or mount once they are laid out",
      );
    }
    draw();
    mutations.observe(stage, { childList: true });
  } catch (error) {
    destroy();
    throw error;
  }
  return {
    get position() {
      return track.position;
    },
    goTo,
    next: () => goOn(1),
    previous: () => goOn(-1),
    on(name, handler) {
      const set = handlers[name];
      if (!(set instanceof Set)) {
        throw new Error(
          `curvesel: event must be "change" or "select", got ${JSON.stringify(name)}`,
        );
      }
      set.add(handler);
      return () => set.delete(handler);
    },
    destroy,
  };
}

/**
 * Calls each handler subscribed when the event began (one that subscribes again is not called again
 * in the same event); a handler's error is reported, not thrown, so the motion and the others go on.
 */
function emit(handlers: Set<(value: number) => void>, value: number): void {
  for (const handler of [...handlers]) {
    if (!handlers.has(handler)) continue;
    try {
      handler(value);
    } catch (error) {
      reportError(error);
    }
  }
}

/** The Active slide: the nearest whole Position, wrapped when looping, clamped otherwise. */
function activeIndex({ position, count, loop }: TrackState): number {
  const at = Math.round(position);
  return loop ? ((at % count) + count) % count : Math.min(Math.max(at, 0), count - 1);
}

/** The Curve's direction on screen at the centre, and how many px one Position covers there. */
interface ScreenStep {
  axis: Vector;
  px: number;
}

/** From the Layout's tangent at Offset 0 (any Plane, Tilt or custom Layout); none if it is flat. */
function screenStep(layout: Layout, size: number, position: number): ScreenStep | undefined {
  if (!(size > 0)) return undefined;
  const near = 1e-3;
  const [from, to] = [layout(0, { size, position }), layout(near, { size, position })];
  const [dx, dy] = [(to.x - from.x) / near, (to.y - from.y) / near];
  const px = Math.hypot(dx, dy);
  return px > 1e-9 ? { axis: { x: dx / px, y: dy / px }, px } : undefined;
}

/** Pointer px (or px per second) as Positions: moving along the Curve brings the earlier Slides in. */
function toPositions({ axis, px }: ScreenStep, delta: Vector): number {
  return -(delta.x * axis.x + delta.y * axis.y) / px;
}

/** The Layout to call, and the Plane it bends in when it is a Curve. */
function resolveLayout(layout: PresetName | CurveOptions | Layout): {
  layout: Layout;
  plane: Plane;
} {
  if (typeof layout === "function") return { layout, plane: "xz" };
  const curve = typeof layout === "string" ? presets[layout] : layout;
  if (typeof curve !== "object" || curve === null) {
    throw new Error(
      `curvesel: layout must be a Preset name (${Object.keys(presets).join(", ")}), a Curve's options or a Layout function, got ${JSON.stringify(layout)}`,
    );
  }
  return {
    layout: (offset, context) => curvePose(offset, curve, context),
    plane: curve.plane ?? "xz",
  };
}

/** The largest Slide along the Curve: its height in the `yz` Plane, its width otherwise. */
function largest(slides: HTMLElement[], plane: Plane): number {
  const along = (slide: HTMLElement) => (plane === "yz" ? slide.offsetHeight : slide.offsetWidth);
  return Math.max(0, ...slides.map(along));
}

/** Where each absolute Slide starts (padding, alignment, direction), all read before any write. */
function centres(stage: HTMLElement, slides: HTMLElement[]): string[] {
  return slides.map(
    (slide) =>
      `translate(${stage.clientWidth / 2 - slide.offsetLeft}px, ${stage.clientHeight / 2 - slide.offsetTop}px) translate(-50%, -50%)`,
  );
}

/** Writes each Slide's Pose; a culled Slide is written once, then left until it comes back. */
function render(
  slides: HTMLElement[],
  track: TrackState,
  layout: Layout,
  { size, centres, hidden }: { size: number; centres: string[]; hidden: Set<HTMLElement> },
): void {
  const { count, position, loop } = track;
  const active = activeIndex(track);
  slides.forEach((slide, index) => {
    const offset = slideOffset(index, position, count, loop);
    const pose = layout(offset, { size, position });
    if (!pose.visible && hidden.has(slide)) return;
    if (pose.visible) hidden.delete(slide);
    else hidden.add(slide);
    slide.style.transform = `${centres[index]} ${matrix3d(pose)}`;
    slide.style.zIndex = String(pose.zIndex);
    slide.style.visibility = pose.visible ? "visible" : "hidden";
    slide.style.setProperty("--cs-offset", String(offset));
    slide.style.setProperty("--cs-abs-offset", String(Math.abs(offset)));
    slide.toggleAttribute("data-cs-active", index === active);
    slide.toggleAttribute("data-cs-visible", pose.visible);
  });
}

/** Per element, each ARIA attribute the library wrote: its value, and what was there before. */
type Voiced = Map<HTMLElement, Map<string, { value: string; was: string | null }>>;

/**
 * DEC-15's ARIA on a generic element with no `role`: on first sight the role, and the description
 * unless it has one; a label while it has none (a blank one counts as none), until the user sets one.
 */
function voice(
  voiced: Voiced,
  element: HTMLElement,
  [role, description]: [string, string],
  label?: string,
): void {
  let written = voiced.get(element);
  const write = (name: string, value: string) => {
    const prior = written?.get(name);
    const was = prior ? prior.was : element.getAttribute(name);
    element.setAttribute(name, value);
    written?.set(name, { value, was });
  };
  if (!written) {
    written = new Map();
    voiced.set(element, written);
    const name = element.localName;
    const generic = GENERIC.includes(name) || name.includes("-");
    if (!generic || element.hasAttribute("role")) return;
    write("role", role);
    if (!element.hasAttribute("aria-roledescription")) write("aria-roledescription", description);
  }
  if (!written.has("role") || label === undefined) return;
  const ours = written.get("aria-label")?.value;
  const current = element.getAttribute("aria-label");
  // A label the user set (before or since) is theirs.
  if (
    ours === undefined
      ? current?.trim() || element.hasAttribute("aria-labelledby")
      : current !== ours
  ) {
    written.delete("aria-label");
    return;
  }
  write("aria-label", label);
}

/** Puts back what was there before each ARIA attribute the library wrote that still holds its value. */
function unvoice(voiced: Voiced, element: HTMLElement): void {
  for (const [name, { value, was }] of voiced.get(element) ?? []) {
    if (element.getAttribute(name) !== value) continue;
    if (was === null) element.removeAttribute(name);
    else element.setAttribute(name, was);
  }
  voiced.delete(element);
}

/** CSS `matrix3d`, column-major: column j is where the Slide's own axis j points, then the place. */
function matrix3d({ x, y, z, rotation: r }: Pose): string {
  const values = [r[0], r[3], r[6], 0, r[1], r[4], r[7], 0, r[2], r[5], r[8], 0, x, y, z, 1];
  return `matrix3d(${values.join(", ")})`;
}

/** Remembers inline properties and attributes, and returns what puts them back as they were. */
function save(element: HTMLElement, properties: string[], attributes: string[]): () => void {
  const values = properties.map((name) => ({
    name,
    value: element.style.getPropertyValue(name),
    priority: element.style.getPropertyPriority(name),
  }));
  const marks = attributes.map((name) => ({ name, value: element.getAttribute(name) }));
  const styled = element.hasAttribute("style");
  return () => {
    for (const { name, value, priority } of values) {
      if (value === "") element.style.removeProperty(name);
      else element.style.setProperty(name, value, priority);
    }
    for (const { name, value } of marks) {
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    }
    // Browsers keep an emptied `style=""`; an element that had none gets none back.
    if (!styled && element.getAttribute("style") === "") element.removeAttribute("style");
  };
}
