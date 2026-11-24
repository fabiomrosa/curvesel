# @curvesel/vanilla

A headless 3D carousel over your own elements. The children of a container (the Stage) become the
Slides, laid out along a configurable Curve (a cylinder, a flat or wavy ribbon, a wheel, an arc)
and moved with drag, inertia and snap. The library writes only position and state; every Slide's
look and behaviour stay yours.

```sh
npm install @curvesel/vanilla
```

## Quick start

```html
<div id="stage" style="width: 800px; height: 400px; overflow: clip">
  <div class="card">One</div>
  <div class="card">Two</div>
  <div class="card">Three</div>
  <div class="card">Four</div>
</div>
<style>
  .card { width: 200px; height: 260px; background: #fff; border-radius: 12px; }
</style>
<script type="module">
  import { createCarousel } from "@curvesel/vanilla";

  const carousel = createCarousel(document.getElementById("stage"), { layout: "cylinder" });
  carousel.on("select", (index) => console.log("Active slide", index));
</script>
```

Drag, flick or use the wheel along the Curve; focus the Stage and use the arrow keys, Home and End.
Call `carousel.destroy()` to put every element back as it was.

## Options

`createCarousel(stage, options)`; every option is optional.

| Option | Default | |
|---|---|---|
| `layout` | `"cylinder"` | A Preset name (`cylinder`, `ribbon`, `wheel`, `arc`), Curve options, or a Layout function (`@curvesel/core`). |
| `size` | the largest Slide | The Slide length along the Curve, in px (its width; its height for a vertical Curve). |
| `perspective` | `1000` | The Stage's CSS `perspective`, in px. |
| `loop` | `false` | Turn forever, with no ends. |
| `rubberBand` | `0.1` | The fraction of a drag that counts past the first or last Slide. |
| `friction` | `0.84³⁰` | The fraction of the velocity kept after a second of inertia. |
| `dragThreshold` | `10` | Px a pointer moves before it is a drag; a drag's click is stopped, a tap's is not. |
| `label` | `"Carousel"` | The Stage's accessible name. |
| `slideLabel` | `"3 of 10"` | `(index, count) => string`: each Slide's accessible name. |
| `announcer` | none | Your own live-region element; it is told the new Slide when the carousel settles. |
| `reducedMotion` | the media query | Land on the target at once, with no animation (`prefers-reduced-motion` by default). |

An invalid option throws an `Error` starting with `curvesel:` at mount, and nothing is written.

## The Carousel

| Member | |
|---|---|
| `position` | The current Position: `2.5` is halfway between Slides 2 and 3. |
| `goTo(index)` | Animates to a Slide (the short way round when looping). |
| `next()`, `previous()` | One Slide on or back. |
| `on("change", handler)` | The Position, once per frame that moved it. Returns what unsubscribes. |
| `on("select", handler)` | The Active slide's index, when it changes. |
| `destroy()` | Stops everything and restores every property and attribute it wrote. |

Slides added to or removed from the Stage are followed, and so is any change of size.

## Styling

The library writes only these, and puts them back on `destroy()`:

- **On the Stage:** `position: relative` (if it was static), `perspective`, `touch-action`,
  `tabindex="0"` (if it had none), and ARIA (below).
- **On each Slide:** `position: absolute`, `transform`, `z-index`, `visibility`, the CSS variables
  `--cs-offset` (signed distance from the centre, in Slides) and `--cs-abs-offset`, the attributes
  `data-cs-active` and `data-cs-visible`, and ARIA.

Everything else is your CSS, driven by those. For example, dim and shrink the side Slides:

```css
.card { --away: min(var(--cs-abs-offset, 0), 3); }
.card > .face { opacity: calc(1 - var(--away) * 0.2); scale: calc(1 - var(--away) * 0.08); }
.card[data-cs-active] > .face { outline: 2px solid orange; }
```

- **Style inside the Slide**, not the Slide itself: the CSS `scale`, `rotate` and `translate`
  properties apply after the Slide's `transform` and would move it off the Curve.
- **Give the Stage `overflow: clip`, not `hidden`:** a `hidden` Stage still scrolls to show a
  focused element, which pushes every Slide off the centre.

## Accessibility

- A `div`, `span`, `section` or custom-element Stage becomes a `region` with
  `aria-roledescription="carousel"` and `label`; each such Slide a `group` with
  `aria-roledescription="slide"` and `slideLabel`. An element with a role of its own (an `img`, a
  link, a button, a list) keeps it, and a label you set always wins.
- The Stage is focusable; the arrow keys along the Curve step it, Home and End go to the ends.
  Keyboard focus moving into a Slide brings that Slide to the centre.
- Pass a visually hidden `<p aria-live="polite">` as `announcer` to have screen readers told the
  new Slide once the carousel settles.
- With `prefers-reduced-motion: reduce`, nothing animates that the user did not drag.

## Requirements

ES modules only (`import`); Node's `require` of ES modules also works. TypeScript types are
included. Any browser with Pointer Events, `ResizeObserver` and CSS 3D transforms.

## License

MIT
