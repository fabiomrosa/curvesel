# curvesel gotchas

Non-obvious facts about this exact stack and machine. Read the section for what you are touching
before you start; it saves hours. Add new ones as you learn them (SESSION §3.7). Facts, not rules.

## Toolchain
Node 26 and npm 11 locally (pnpm is installed too, but the workspace uses npm). Learned in
`../list-picker`, the same toolchain:
- Biome 2.6 formats Markdown too: exclude `**/*.md` in `biome.json`, or it rewraps every doc.
- TypeScript 7 is the native (Go) compiler; the binary is still `tsc`. Source imports use the `.ts`
  extension (`rewriteRelativeImportExtensions` turns them into `.js` in `dist/`).
- Vitest's default include also matches `*.spec.ts`: name Playwright files `e2e/*.e2e.ts`.
- The agent's shell is zsh: `${PIPESTATUS[0]}` is empty there (zsh has `$pipestatus[1]`). To see
  a command's exit code, run it without a pipe and read `$?`.

## Property tests
- `fc.double({ min, max })` favours values near 0 and the bounds: over `±2π`, under 10% of
  draws exceed 1. Map `fc.integer` for an even spread (`n / 1000`).
- `fc.double` also draws denormals (`5e-324`): a reference formula must divide before it multiplies
  (`L · (sin(u) / u)`), or `L · sin(u)` underflows to 0.

## DOM and motion
- Without `touch-action` set on the Stage, a touch drag scrolls the page and fires `pointercancel`.
- `setPointerCapture` keeps `pointermove` coming when the pointer leaves the Stage; without it, a
  fast drag is lost.
- Reading layout (`getBoundingClientRect`, `offsetWidth`) right after a style write forces a
  synchronous layout; in the animation loop that costs more than all the math.
- `perspective` belongs on the Stage (the Slides' parent); `transform-style: preserve-3d` is only
  needed when a transformed element has 3D-transformed children, which DEC-07 avoids by giving every
  Slide its own full `transform`.
- A synchronous loop that never ends (a physics `step` that stops making progress) hangs Vitest:
  its timeout cannot interrupt the thread. Bound every loop in `core` by a count, as `step` bounds
  its pieces.
- The `requestAnimationFrame` callback's timestamp is when the frame began, so it can be earlier
  than a `performance.now()` read just before the request: `now − last` comes out slightly
  negative, and `step` throws. Clamp the elapsed time at 0.
