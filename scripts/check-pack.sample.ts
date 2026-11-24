// A user's code against the packed packages (`scripts/check-pack.ts`).
import { curvePose, presets } from "@curvesel/core";
import { type Carousel, createCarousel } from "@curvesel/vanilla";

export function mount(stage: HTMLElement): Carousel {
  const pose = curvePose(1, presets.cylinder, { size: 200 });
  const carousel = createCarousel(stage, { layout: "arc", label: `Picks (${pose.zIndex})` });
  carousel.on("select", (index) => console.log(index));
  return carousel;
}
