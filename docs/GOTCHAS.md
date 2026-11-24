# curvesel gotchas

Non-obvious facts about this exact stack and machine. Read the section for what you are touching
before you start; it saves hours. Add new ones as you learn them (SESSION §3.7). Facts, not rules.

## Toolchain
Node 26 and npm 11 locally (pnpm is installed too, but the workspace uses npm). Learned in
`../list-picker`, the same toolchain:
- Biome 2.6 formats Markdown too: exclude `**/*.md` in `biome.json`, or it rewraps every doc.
- TypeScript 7 is the native (Go) compiler; the binary is still `tsc`. Source imports use the `.ts`
  extension (`rewriteRelativeImportExtensions` turns them into `.js` in `dist/`).
- CI runs the root `typecheck` before `build`, on a clean clone: a file that imports a package by
  name finds no `dist` types there, though it passes locally over a stale `dist`.
- Writing a file under the repository during the browser tests makes Vite reload every open page
  and breaks the tests running beside it: serve generated pages with `page.route`.
- Vitest's default include also matches `*.spec.ts`: name Playwright files `e2e/*.e2e.ts`.
- `vanilla` imports `core` at runtime, through its exports, to `dist/`, which a clean clone lacks:
  tests alias the source (`vitest.config.ts`), the type check maps it (`paths` in the root
  `tsconfig.json`), and each package's build keeps `paths: {}`, using the built `dist/`.
- `happy-dom` returns an empty computed `position` for an unstyled element, not `static`.
- `ResizeObserver` watches the content box by default: a padding or border change alone never
  fires it. Observe `{ box: "border-box" }` when measuring `offsetWidth`. It never fires for an
  element that only moves.
- Pages served by Vite (the demo, the e2e server at the repository root) resolve `@curvesel/core`
  to its source through `vite.config.ts`; `vite demo` needs `--config vite.config.ts`, since Vite
  looks for the config in the page's root. The playground imports `core`'s source directly.
- Chrome reports a `ResizeObserver` loop only as a window `error` event: Playwright's `pageerror`
  and console listeners miss it, so `e2e/engine.html` forwards window errors to `console.error`.
- Chrome keeps an emptied `style=""` attribute; `happy-dom` drops it. `happy-dom` also runs
  `MutationObserver` callbacks in another order than Chrome (creation order), so a Slide moved
  between two Carousels only shows a mix-up in the browser.
- The agent's shell is zsh: `${PIPESTATUS[0]}` is empty there (zsh has `$pipestatus[1]`). To see
  a command's exit code, run it without a pipe and read `$?`.

## Property tests
- `fc.double({ min, max })` favours values near 0 and the bounds: over `±2π`, under 10% of
  draws exceed 1. Map `fc.integer` for an even spread (`n / 1000`).
- `fc.double` also draws denormals (`5e-324`): a reference formula must divide before it multiplies
  (`L · (sin(u) / u)`), or `L · sin(u)` underflows to 0.

## DOM and motion
- Without `touch-action` set on the Stage, a touch drag scrolls the page and fires `pointercancel`.
- A passive `wheel` listener's `preventDefault` is ignored, and the page scrolls with the
  Carousel. Chrome makes them passive by default on `window`, `document` and `body`: the Stage's
  says `{ passive: false }` explicitly.
- A key pressed in a Playwright test goes to the focused element: focus the Stage first, or Home
  and End scroll the page instead.
- `setPointerCapture` keeps `pointermove` coming when the pointer leaves the Stage; without it, a
  fast drag is lost. Captured on `pointerdown`, Chrome retargets the following `click` to the
  Stage, so a tap on a Slide's button never reaches it: capture past the drag threshold instead.
  After a captured drag, Chrome sends the `click` to the Stage, not the Slide: a test of the click
  guard listens on the page, or it passes with the guard off. The guard stops bubbling listeners
  only: capture-phase ones on ancestors (React's `onClickCapture`) still hear a drag's click.
- Reading layout (`getBoundingClientRect`, `offsetWidth`) right after a style write forces a
  synchronous layout; in the animation loop that costs more than all the math.
- The CSS `scale` (and `translate`, `rotate`) property applies after the Slide's `transform`, so on
  a Slide it scales its place on the Curve too, pulling it towards the centre: style an element
  inside the Slide instead (the demo's `.face`).
- An element's native role counts as the user's: `role="group"` on an `<img alt>` hides its alt
  text, and on a link or button its role. DEC-15's ARIA goes on generic elements only.
- An `overflow: hidden` Stage still scrolls to show a focused element, shifting every Slide off
  the centre for good; `overflow: clip` does not scroll (the demo uses it).
- Touch focus arrives after `pointerup`, when the Drag is over, and an input always matches
  `:focus-visible`: telling a tap's focus from the keyboard's needs the press itself.
- `perspective` belongs on the Stage (the Slides' parent); `transform-style: preserve-3d` is only
  needed when a transformed element has 3D-transformed children, which DEC-07 avoids by giving every
  Slide its own full `transform`.
- A synchronous loop that never ends (a physics `step` that stops making progress) hangs Vitest:
  its timeout cannot interrupt the thread. Bound every loop in `core` by a count, as `step` bounds
  its pieces.
- The `requestAnimationFrame` callback's timestamp is when the frame began, so it can be earlier
  than a `performance.now()` read just before the request: `now − last` comes out slightly
  negative, and `step` throws. Clamp the elapsed time at 0.
