# curvesel

A headless 3D carousel library: the user's own elements, laid out along a configurable curve
(cylinder, flat or wavy ribbon, vertical wheel, arc) and moved with drag, inertia and snap. An
open-source lab rewriting a 2012 jQuery carousel (`../3d-carousel`); no business model.

These docs are shared by the whole project. It is a single repository (`curvesel`, the hub), so
there is no `CONTRACT.md`: the packages inside it talk through their TypeScript public APIs.

## Repositories

| Repository | What | Stack |
|---|---|---|
| `curvesel` | `core` (curves and physics), the vanilla engine and the adapters, as packages of one npm workspace | TypeScript |

## Shared docs
| File | What |
|---|---|
| `SESSION.md` | How every session runs. **Follow it exactly.** |
| `PRODUCT.md` | What the product is, the launch scope, the ubiquitous language |
| `DECISIONS.md` | Product and cross-project decisions |
| `ROADMAP.md` | Milestones and the order of slices |

## Rules everywhere
- One slice per session, one small pull request (SESSION §0), squash-merged by the agent when CI is
  green (SESSION §4). Nothing reaches `main` any other way (DEC-04).
- Decisions are written down: product and cross-package ones in `DECISIONS.md` (the owner decides,
  the agent proposes); technical ones that touch only how the code is built in `docs/decisions/`.
