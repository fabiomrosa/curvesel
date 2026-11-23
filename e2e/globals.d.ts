import type { Carousel, createCarousel } from "../packages/vanilla/src/index.ts";

declare global {
  interface Window {
    createCarousel: typeof createCarousel;
    carousels: Carousel[];
  }
}
