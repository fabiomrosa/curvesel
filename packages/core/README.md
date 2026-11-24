# @curvesel/core

The Curve layouts and the physics of curvesel, a headless 3D carousel: pure functions, no DOM.
`@curvesel/vanilla` uses it to move real elements; use it directly to lay out anything else
(a canvas, WebGL, another framework).

```sh
npm install @curvesel/core
```

## The Curve

Every layout is one Curve with different parameters. `curvePose(offset, options, context)` gives the
Pose of the Slide `offset` Slides from the centre (`0` is the centre, `-1` the one before):
`{ x, y, z, rotation, zIndex, visible }`: the position from the Stage's centre, in px, and
`rotation`, a row-major 3×3 matrix `r`. As CSS, after centring the element on the Stage:
`matrix3d(r0, r3, r6, 0, r1, r4, r7, 0, r2, r5, r8, 0, x, y, z, 1)`.

```ts
import { curvePose, presets } from "@curvesel/core";

const pose = curvePose(1, presets.cylinder, { size: 200 });
```

| Curve option | |
|---|---|
| `curvature` | Required. Radians of bend per Slide step: `0` is flat, `2π / N` closes a ring of N Slides. |
| `gap` | Required. Px between neighbouring Slides along the Curve (the Presets use 20). |
| `plane` | Where it bends: `xz` (away from the viewer, default), `yz` (down the screen), `xy` (in the screen). |
| `wave` | `{ amplitude, wavelength, phase?, anchor?, plane? }`: makes the Curve undulate; `anchor: "ribbon"` makes it travel with the Slides, `plane: "y"` pitches them across the Plane. |
| `twist` | Radians per Slide step each Slide turns around the Curve. |
| `tilt` | Radians the whole Curve leans around the view axis; the Slides stay upright. |
| `visibleRange` | How far from the centre, in Slides, a Slide is still `visible`. |

The context gives `size` (the Slide length along the Curve, in px) and, for a travelling Wave,
`position`. Neighbouring Slides always stay one `size + gap` apart along the Curve.

**Presets** (`presets.cylinder`, `ribbon`, `wheel`, `arc`) are plain Curve options. A custom
**Layout** is any `(offset, context) => Pose`; `rotationFromAngles(rx, ry, rz)` builds its rotation.

## The Track

The motion, as a state in and a new state out: `createTrack({ count, loop?, rubberBand?, friction? })`,
then `dragStart`, `dragMove(state, delta)`, `release(state, velocity)`, `goTo(state, index)`,
`goBy(state, delta)`, `land(state)` and `step(state, dt)`. Positions and velocities count Slides;
`dt` is in seconds. Inertia and Snap are solved exactly, so the same gesture ends on the same Slide
at any frame rate. Drive it from one `requestAnimationFrame` loop: call `step` with the time since
the last frame until `state.phase` is `"rest"` (a `dt` over 0.1 s counts as 0.1 s).
`slideOffset(index, position, count, loop)` gives a Slide's Offset to lay out.

## License

MIT
