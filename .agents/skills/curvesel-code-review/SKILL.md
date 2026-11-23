---
name: curvesel-code-review
description: The curvesel review checklist. Use when about to open any curvesel pull request (mandatory), or when asked to review curvesel code or a diff.
---

# curvesel-code-review

Review as a reader who did not write the change. If your agent can start a subagent, start one with a
fresh context (not a fork of this conversation) and give it this skill, the slice entry and the diff,
without your summary of the change. Otherwise reread the slice entry before the diff.

The review is read-only: the working tree and the branch end as they began (`git status` unchanged).
To break the code once, back the file up outside the repository, edit it, run the tests, and restore
the backup byte for byte (`cmp`); probes and scratch scripts live in `$TMPDIR`. Uncommitted work
under review exists nowhere else, so `checkout`, `restore` and `stash` stay out of the review.

Run `git diff main...HEAD --stat` and read every changed file. Answer each item with yes/no + file
reference. Any "no" is fixed before the pull request (or explicitly listed as a deviation in it).

## Scope
- [ ] `scripts/check-pr-size.py main` passes (≤15 files, ≤400 lines).
- [ ] The title is `<type>(<slice id>): <name>`, the name starts in lowercase, and the type matches the change (SESSION §4).
- [ ] Nothing beyond what the entry asks (YAGNI): no unused abstraction, configuration or parameter.
- [ ] Every change serves the current slice entry; nothing from "Out of scope"; extras moved to
      PLAN "Later".

## Layout and naming (CONVENTIONS)
- [ ] Each file has one role, named by its suffix, in the place CONVENTIONS gives it.
- [ ] No module reaches into another module's internals.
- [ ] `core` imports nothing from the DOM, the engine or a framework; the engine imports no framework.
- [ ] Layouts are pure functions of the offset and their options; no state, no DOM.

## Math (PRODUCT invariants)
- [ ] Neighbouring slides stay the same distance apart along the curve, with any curvature, wave or
      twist; the test checks it, not only a shape.
- [ ] Offset 0 is the centre, facing the viewer, in every preset; curvature near 0 has no jump.
- [ ] Physics is time-based (`dt`), not frame-based; the same gesture ends at the same index at
      30, 60 and 120 fps.

## DOM and performance
- [ ] The library never creates, clones, moves or re-parents a slide, and never changes its inside;
      it writes only what DEC-07 lists, and `destroy()` puts all of it back.
- [ ] Only `transform` (and DEC-07's properties) change per frame, written once per
      `requestAnimationFrame`; no layout read after a write in the same frame.
- [ ] A click on a slide reaches it unless the drag passed the threshold.
- [ ] Every listener added is removed by `destroy()`.

## Public API
- [ ] Changes to a package's `src/index.ts` are listed in the pull request, additive or breaking.

## Security and privacy
- [ ] No secrets in the code, the demo or the logs; no `innerHTML` with user values.

## Docs
- [ ] `docs/STATE.md` (capabilities, modules, last session), `docs/PLAN.md` status
      (`done (<date>)`), decisions if any, `README.md` if run/config changed, `docs/GOTCHAS.md` for
      new traps.

## Tests
- [ ] Every acceptance criterion has a test that was seen red (test-first, or the rule broken once).
- [ ] Each test exercises what runs, not a declaration the runtime may ignore (break the code once if
      unsure).
- [ ] A mistake this review keeps finding is proposed as a check in the retro.

## Output
Findings for the pull request's Review section. Each one gives the location (`file:line`), the input
or state that triggers it, the impact, and the smallest fix; one not demonstrated is marked as a
hypothesis. "No findings" is a valid result: never invent one to fill the list. After fixes, review
the new diff: a fixed finding is checked again, not assumed.

## Rationalizations
| Rationalization | Reality |
|---|---|
| "It's only docs or config." | Scope, size and the checklist still apply. |
| "The build is green." | Green proves only what the checks check; ask whether each one could fail. |
| "I wrote it, so I know it's right." | That is why the pass reads as someone else. |
