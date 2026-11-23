# curvesel — Product

The top of the precedence list (SESSION §8). Only the owner changes it, through a docs pull request.

## What it is
A headless, framework-agnostic 3D carousel library. The user's own elements become Slides laid out
along a configurable Curve: a closed cylinder, a flat or wavy ribbon, a tilted vertical wheel, an
arc in the plane of the screen, or anything in between. The library ships the container and the
motion (drag, inertia, snap, keyboard, wheel); the look and the behaviour of every Slide belong to
the user. A lab: it rewrites a 2012 jQuery/TweenMax carousel (`../3d-carousel`) and tests one idea,
that every variant is the same curve with different parameters.

## Who it serves
Front-end developers who want a 3D carousel of their own components (cards, products, media)
without a visual style or a framework imposed on them. No one pays: it is an open-source lab.

## Business model
None. Success is learning: one parametric curve covering every variant, smooth at 60 fps, written
down.

## Product principles
- **Headless, children keep their behaviour.** The user's elements (or components) are the Slides.
  The library never creates, clones, moves or re-parents them and never touches their inside, so
  their listeners, state, inputs and media survive. A click on a Slide reaches it unless the gesture
  was a drag.
- **One Curve, many Presets.** Cylinder, ribbon, wheel and arc are settings of one layout, not
  separate code. A new look is a new set of options, or the user's own Layout function.
- **State for the user's CSS.** The library writes position and depth; fades, overlays, scale and
  hover are the user's, driven by the CSS variables and attributes it exposes.
- **Feels physical.** Drag follows the pointer, a release carries inertia, the Track snaps to the
  nearest Slide, the ends resist (or the Track loops). Time-based, the same at any frame rate.
- **Framework-agnostic core.** `core` knows no DOM and no framework; the vanilla engine comes first,
  React and Angular adapters are thin layers over it.
- **Measured, not assumed.** A performance claim needs a benchmark or a trace.

## Launch v1
- **In:** `core` (the Curve layout with curvature, wave, twist, tilt and planes; the Presets; the
  physics), the vanilla engine (pointer, wheel and keyboard input, click guard, culling, CSS state),
  accessibility basics, a demo page with every Preset, the first npm publish.
- **Out:** React and Angular adapters (right after v1), autoplay, pagination or index UI (the user
  builds it with `goTo` and events), lazy loading of the user's content, virtualisation of very long
  lists, a default theme.

## Ubiquitous language

| Term | Meaning |
|---|---|
| Carousel | One mounted instance: a Stage, its Slides and a Track |
| Stage | The user's container element; its direct children are the Slides |
| Slide | One of the user's elements (or components), adopted as it is |
| Track | The motion state: the Position, its velocity, the bounds or loop |
| Position | A continuous number: `2.37` is between Slide 2 and Slide 3 |
| Active slide | The Slide nearest the Position, `round(Position)` |
| Offset | A Slide's signed distance from the Position, `index − Position`; 0 is the centre |
| Curve | The path the Slides sit on, defined by its curvature along its length |
| Curvature | How much the Curve bends per Slide step (slide size + gap), in radians; the radius is `step / κ`; 0 is straight |
| Wave | A periodic part of the Curvature (amplitude, wavelength, plane, anchor) that makes a ribbon undulate |
| Twist | A rotation of each Slide around the direction of the Curve, as a function of its length |
| Tilt | A rotation of the whole Curve around the view axis; the Slides stay upright |
| Plane | Where the Curve bends: `xz` (horizontal, in depth), `yz` (vertical, in depth), `xy` (in the screen) |
| Layout | A pure function from an Offset (and options) to a Pose |
| Pose | Where a Slide is: its transform, z-index and whether it is visible |
| Preset | A named set of Curve options: `cylinder`, `ribbon`, `wheel`, `arc` |
| Visible range | How far from the centre (in Offset) a Slide is still shown; beyond it, it is culled |
| Drag | The gesture: from pointer down past the threshold until release |
| Inertia | The motion after a release, slowed by friction |
| Snap | The motion that settles the Track on a whole Position |
| Rubber band | The resistance when the Track is pushed past its first or last Slide |
| Adapter | A thin layer that binds `core` and the engine to a UI layer (vanilla, React, Angular) |

## Engineering-critical invariants
- Neighbouring Slides are always the same distance apart along the Curve, with any Curvature, Wave
  or Twist.
- The Slide at Offset 0 sits at the centre of the Stage, facing the viewer, in every Preset.
- The Pose is continuous in every option: as Curvature tends to 0 the cylinder becomes a flat ribbon
  with no jump.
- At rest the Position is a whole number within bounds (or any whole number when looping).
- The Slides are the same nodes before, during and after mounting: never recreated, reordered or
  re-parented.
- `destroy()` removes every listener and restores every property and attribute the library wrote.
