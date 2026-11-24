# One curve for every carousel

curvesel is a lab. It rewrites a 2012 jQuery and TweenMax carousel to test one idea: that every 3D
carousel variant (a cylinder, a flat or wavy ribbon, a vertical wheel, an arc) is the same curve
with different parameters. This page is the answer.

## The question

Does one parametric curve cover every variant, smoothly, at 60 fps?

## The answer: yes, with one exception

Every variant is a Curve with a constant **Curvature** (radians of bend per Slide step) in one of
three **Planes**, optionally undulated by a **Wave**, turned by a **Twist** and leaned by a **Tilt**:

| Variant | Curvature | Plane | Other |
|---|---|---|---|
| Cylinder | `2π / 10` (a ring of 10) | `xz` | back half hidden |
| Flat ribbon | `0` | `xz` | |
| Wavy ribbon | `0` | `xz` | a Wave |
| Wheel | `2π / 10` | `yz` | |
| Arc | `0.2` | `xy` | the centre below the screen |

The Presets are these option objects, nothing more; a custom Layout is a function of the Offset.
The cylinder of 2012 (`rotateY(i · 360/N) translateZ(r)`) is the case of constant Curvature that
closes after N Slides.

"Smoothly" means three things, each checked by property tests over random options rather than
over a few hand-picked shapes:

- **Spacing:** neighbouring Slides stay one step apart along the Curve, with any Curvature, Wave,
  Twist or Tilt.
- **Continuity:** as the Curvature tends to 0, the cylinder becomes the flat ribbon with no jump
  (the circle is written with series near 0, so it stays exact).
- **Motion:** the same gesture ends on the same Slide at 30, 60 and 120 fps and with jittery frames,
  because Inertia and Snap are solved in closed form instead of stepped per frame.

## How

Constant Curvature is a circle, in closed form. A Wave makes the heading vary along the Curve; the
heading still has a closed form, and the position is its integral, by Simpson's rule. Each Pose is a
position and a 3×3 rotation, written as one CSS `matrix3d`.

The first version integrated each Slide's Wave from the centre, so 200 Slides cost about 23 ms a
frame in Chrome, over the 16.7 ms budget. Keeping the integral for the Curve being laid out
brought it to about 4 ms (`npm run bench`, ARCHITECTURE "Frame budget").

## The exception

A ring with a Wave across its Plane closes only for a whole number of wavelengths at the default
phase. Otherwise it opens: closing it would need the Slide count inside the Curve, which a function
of the Offset does not have. The flat and open variants have no such limit.

## What changed from 2012

- **The Slides are yours.** 2012 loaded the images and styled the panels; curvesel adopts your
  elements and writes only position and state, so their listeners, inputs and media survive.
- **Time, not frames.** 2012 stepped friction 0.84 per frame at 30 fps; curvesel keeps 0.84³⁰ of the
  velocity per second, whatever the frame rate.
- **Every input.** Pointer Events (mouse, touch, pen), the wheel and the keyboard, where 2012 had
  the mouse and separate phone code.
- **Accessible.** Roles and labels, an announcer, focus that brings its Slide in, and reduced motion.
- **Kept:** the Rubber band at the ends (a tenth of the movement), the Snap to the nearest Slide, and
  the click blocked only after a real drag.
