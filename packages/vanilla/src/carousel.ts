import {
  type CurveOptions,
  createTrack,
  curvePose,
  type Layout,
  type Plane,
  type Pose,
  type PresetName,
  presets,
  slideOffset,
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
}

export interface Carousel {
  /** Restores every property and attribute the Carousel wrote. */
  destroy(): void;
}

const DEFAULT_PERSPECTIVE = 1000;
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
  const slides = [...stage.children].filter((child) => child instanceof HTMLElement);
  const track = createTrack({ count: Math.max(slides.length, 1), loop: options.loop ?? false });

  const saved = [
    save(stage, ["perspective"], []),
    ...slides.map((slide) => save(slide, SLIDE_PROPERTIES, SLIDE_ATTRIBUTES)),
  ];
  const measure = () => options.size ?? largest(slides, plane);
  // A resize lays the Slides out again; while they measure 0 (a hidden Stage) the last layout stays.
  const observer = new ResizeObserver(() => {
    const size = measure();
    if (size > 0) render(stage, slides, track, layout, size);
  });
  const destroy = () => {
    observer.disconnect();
    for (const restore of saved) restore();
  };
  try {
    // A positioned Stage keeps its own position; a static one becomes the Slides' containing block.
    if (!POSITIONED.includes(getComputedStyle(stage).position)) {
      saved.push(save(stage, ["position"], []));
      stage.style.position = "relative";
    }
    stage.style.perspective = `${perspective}px`;
    // Measured once the Slides are out of the flow, as they will stay.
    for (const slide of slides) slide.style.position = "absolute";
    const size = measure();
    if (!(size > 0)) {
      throw new Error(
        "curvesel: the Slides measure 0 px along the Curve; give `size`, or mount once they are laid out",
      );
    }
    render(stage, slides, track, layout, size);
    for (const element of [stage, ...slides]) observer.observe(element);
  } catch (error) {
    destroy();
    throw error;
  }
  return { destroy };
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

function render(
  stage: HTMLElement,
  slides: HTMLElement[],
  track: TrackState,
  layout: Layout,
  size: number,
): void {
  const { count, position, loop } = track;
  // Where each absolute Slide starts (padding, alignment, direction), all read before any write.
  const centres = slides.map(
    (slide) =>
      `translate(${stage.clientWidth / 2 - slide.offsetLeft}px, ${stage.clientHeight / 2 - slide.offsetTop}px) translate(-50%, -50%)`,
  );
  const active = (((Math.round(position) % count) + count) % count) as number;
  slides.forEach((slide, index) => {
    const offset = slideOffset(index, position, count, loop);
    const pose = layout(offset, { size, position });
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
  return () => {
    for (const { name, value, priority } of values) {
      if (value === "") element.style.removeProperty(name);
      else element.style.setProperty(name, value, priority);
    }
    for (const { name, value } of marks) {
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    }
  };
}
