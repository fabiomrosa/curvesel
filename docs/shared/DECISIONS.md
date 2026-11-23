# Decisions

The register of product and cross-project decisions. **Accepted** entries are binding for every
repository. **Proposed** entries are the agent's recommendations waiting for the owner; until
accepted, a slice that depends on one must stop and ask.

To add a decision: append an entry with the next number, status Proposed, the decision, why, and
consequences. Only the owner changes a status to Accepted. Never edit an accepted decision; supersede
it with a new entry and mark the old one "Superseded by DEC-nn".

---

## DEC-01 · Small slices, merged by pull request — Accepted (owner, 2026-11-23)
Every change is one slice from a `docs/PLAN.md`, one session, one pull request of at most 15 files and
400 lines (SESSION §0). The agent squash-merges it once CI is green and its review is clean (SESSION
§4); the owner can stop any merge with the `hold` label and reads the result in `git log main`.
- **Why:** small diffs stay reviewable, the plan keeps sessions from drifting, and every merge leaves
  one titled commit on `main`.
- **Consequences:** CI enforces the size and the title; a slice that won't fit is split before coding.

## DEC-02 · Any coding agent can work on the project — Accepted (owner, 2026-11-23)
The instructions live in agent-neutral files: `AGENTS.md` (`CLAUDE.md` imports it), skills in
`.agents/skills/`, and the rules that must always hold as CI checks. `.claude/hooks/` repeat them
earlier for Claude Code only.
- **Why:** the workflow must not depend on one tool.
- **Consequences:** a rule that matters gets a CI check, not only a hook or a sentence.

## DEC-03 · YAGNI, KISS and test-first — Accepted (owner, 2026-11-23)
Build only what the current slice needs, test first, and add a mechanical check only when a real
mistake shows it is needed.

## DEC-04 · Nothing reaches main except a merged pull request — Accepted (owner, 2026-11-23)
No agent commits or pushes to `main`, force-pushes a branch under review, or merges around a red
check.
- **Why:** with merges automated, the pull request is the only record of what changed and why.
- **Consequences:** protect `main` (pull requests only, CI required) when the GitHub plan allows it;
  GitHub Free cannot protect a private repository's branches, so `guard-git.py` blocks it in Claude
  Code and the CI job `main-via-pr` flags it for any agent.

## DEC-05 · One name per component, `curvesel-<role>`, in every tool — Accepted (owner, 2026-11-23)
Each repository's name (`curvesel`) is also its local folder and the name of its project in every
provider (hosting, error tracking, analytics, builds) and in alerts. A new component is
`curvesel-<role>`, with a role noun that will not need renaming (`site` for a public site, `web`
only for a web version of an app).
- **Why:** outside the code host the organization is not shown, so a bare `site` or `admin` says
  nothing in a terminal tab, an alert or a provider's project list, and global names are often taken,
  which would give a component a second name.
- **Consequences:** a hostname or slug a provider forces differently is noted in that repository's
  README "Config".

## DEC-06 · The Position is a continuous number; Layouts are pure functions of the Offset — Accepted (owner, 2026-11-23)
The Track holds one number, the Position (`2.37` is between Slide 2 and Slide 3). Each Slide's
Offset is `index − Position`, and a Layout turns an Offset (and its options) into a Pose.
- **Why:** the 2012 carousel mixed degrees, indexes and pixels in every handler; one continuous
  number makes drag, inertia, snap, `goTo` and every Layout independent of each other.
- **Consequences:** the physics knows nothing about shapes and the Layouts know nothing about input;
  both are tested without a DOM.

## DEC-07 · The Slides are the user's; the library writes only position and state — Accepted (owner, 2026-11-23)
The Stage's direct children are the Slides, adopted as they are: never created, cloned, moved,
re-parented or changed inside. The library writes, and restores on `destroy()`:
- on the Stage: `position: relative`, `perspective` (an option), `touch-action`, and ARIA
  attributes (M3);
- on each Slide: `position: absolute`, `transform`, `z-index`, `visibility`, the CSS variables
  `--cs-offset` and `--cs-abs-offset`, and the attributes `data-cs-active` and `data-cs-visible`.

Opacity, fades, overlays, scale and hover are the user's CSS, driven by those variables.
- **Why:** the owner's core requirement: children keep their own behaviour, and the library is only
  container and motion. The 2012 version loaded images and styled panels itself, which tied it to
  one page.
- **Consequences:** the user animates inside a Slide, not the Slide's own `transform`. No default
  theme; the demo's styles live in the demo only.

## DEC-08 · One Curve layout; the variants are Presets — Accepted (owner, 2026-11-23)
Slides sit at equal arc-length steps `s = Offset · (slide size + gap)` along a Curve whose Curvature
is a function of its length, `κ(s) = base + amplitude · sin(2π · s / wavelength + phase)`. The
Pose comes from integrating the heading along `s` (closed form when `amplitude` is 0, with a series
near `κ = 0`; a few numeric steps otherwise). Options: `plane` (`xz`, `yz`, `xy`), `curvature`
(`base`), `wave` (`amplitude`, `wavelength`, wave plane Z or Y, `anchor: 'space' | 'ribbon'`,
`space` by default with the phase that keeps the Active slide flat), `twist`, `tilt`, `gap`,
`visibleRange`. `cylinder`, `ribbon`, `wheel` and `arc` are Presets of it. A user may pass their own
Layout function instead.
- **Why:** cylinder to flat ribbon is one number going to 0; wheel and arc are the same Curve in
  another Plane; a wavy ribbon is a periodic Curvature. One implementation, every combination.
- **Consequences:** integrating by arc length keeps Slides equally spaced in every bend (a naive
  `z = A·sin(x)` would bunch them). The radius comes from the measured slide size, not a constant.

## DEC-09 · Our own time-based physics, no animation library — Accepted (owner, 2026-11-23)
One `requestAnimationFrame` loop, running only while the Track moves, advances the Position by real
elapsed time: Drag follows the pointer, a release starts Inertia with friction, then a spring Snaps
to the nearest whole Position. Past the ends a Rubber band resists, or the Track loops (an option).
`goTo(index)` animates with the same spring.
- **Why:** the 2012 version needed TweenMax and ran `setInterval` at 30 fps; the motion is small
  enough to own, and owning it keeps `core` dependency-free.
- **Consequences:** the physics is a pure step function `(state, dt) → state`, tested with fixed
  `dt` sequences; the same gesture ends at the same index at any frame rate.

## DEC-10 · Pointer Events, wheel and keyboard; a drag swallows only its own click — Accepted (owner, 2026-11-23)
The engine listens to `pointerdown`/`pointermove`/`pointerup` with pointer capture, `wheel`, and
arrow keys when the Stage has focus. Past the drag threshold, the next `click` is stopped in the
capture phase; below it, the click reaches the Slide untouched.
- **Why:** one code path for mouse, touch and pen; the 2012 version was mouse-only. Slides must keep
  their own clicks (DEC-07).
- **Consequences:** the Stage needs `touch-action` set for the drag axis, or a touch drag scrolls
  the page.

## DEC-11 · Vanilla first, then React and Angular — Accepted (owner, 2026-11-23)
`core` (no DOM) and the engine are plain TypeScript with no dependencies. The vanilla engine ships
first; React and Angular adapters come after v1 as thin layers over the same core and engine: React
renders the children and the engine styles them through refs, with no re-render per frame; Angular
projects them with `<ng-content>` and runs the loop outside the zone.
- **Why:** one implementation of the behaviour, tested once; adapters only bind it.
- **Consequences:** nothing in `core` or the engine imports a framework; the engine accepts an
  already-rendered Stage and follows its children.

## DEC-12 · One repository, an npm workspace of packages — Accepted (owner, 2026-11-23)
`packages/core`, `packages/vanilla`, then `packages/react` and `packages/angular`, each created by
the slice that first needs it, with one gate (`npm run verify`) over all of them. Published as
`@curvesel/core`, `@curvesel/vanilla`, `@curvesel/react`, `@curvesel/angular`; if the scope is
taken, `curvesel` (core and vanilla), `curvesel-react`, `curvesel-angular`.
- **Why:** the adapters change together with core; one repository keeps one plan, one CI and atomic
  changes across packages.
- **Consequences:** DEC-05's one-name-per-repository applies to the repository; the scope is
  confirmed before the first publish (P2).

## DEC-13 · The Wave's default phase is π/2 — Accepted (owner, 2026-11-23)
Clarifies DEC-08's "the phase that keeps the Active slide flat": with no `phase` given, the Wave
is `amplitude · sin(2π·s / wavelength + π/2)`, so the Active slide sits on a crest and the heading
swings evenly around it.
- **Why:** the Slide at Offset 0 always faces the viewer, so "flat" did not pick a phase; with
  phase 0 the heading never changes sign and a wavy ribbon leans across the screen (seen in the
  playground, C1.5).
- **Consequences:** a wavy ribbon stays level on average and symmetric about the Active slide; the
  Curvature at the centre is `curvature + amplitude`.

---

## Proposed (waiting for the owner)
