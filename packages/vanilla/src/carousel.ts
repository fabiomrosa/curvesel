import {
  type CurveOptions,
  createTrack,
  curvePose,
  goBy,
  type Layout,
  type Plane,
  type Pose,
  type PresetName,
  presets,
  goTo as sendTo,
  slideOffset,
  step,
  type TrackState,
} from "@curvesel/core";

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
  const saved = [save(stage, ["perspective"], [])];
  const measure = () => options.size ?? largest(slides, plane);
  // Geometry is read on mount, resize and child changes only; a frame computes and writes.
  const geometry = { size: 0, centres: [] as string[], hidden: new Set<HTMLElement>() };
  const paint = () => {
    if (geometry.size > 0) render(slides, track, layout, geometry);
  };
  const draw = () => {
    const size = measure();
    // While the Slides measure 0 (a hidden Stage) the last layout stays.
    if (!(size > 0)) return;
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
    const { position, count } = track;
    const active = ((Math.round(position) % count) + count) % count;
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
  const goTo = (index: number) => move(sendTo(track, index));
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
        owned.delete(slide);
        owners.delete(slide);
      });
      // Measured once out of the flow, as it will stay.
      slide.style.position = "absolute";
      resizes.observe(slide, { box: "border-box" });
    }
    slides = children;
    track = { ...track, count: Math.max(slides.length, 1) };
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
    for (const set of Object.values(handlers)) set.clear();
    if (frame !== 0) cancelAnimationFrame(frame);
    mutations.disconnect();
    resizes.disconnect();
    for (const slide of owned) owners.get(slide)?.();
    for (const restore of saved) restore();
  };
  try {
    // A positioned Stage keeps its own position; a static one becomes the Slides' containing block.
    if (!POSITIONED.includes(getComputedStyle(stage).position)) {
      saved.push(save(stage, ["position"], []));
      stage.style.position = "relative";
    }
    stage.style.perspective = `${perspective}px`;
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
    next: () => move(goBy(track, 1)),
    previous: () => move(goBy(track, -1)),
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
  const active = (((Math.round(position) % count) + count) % count) as number;
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
