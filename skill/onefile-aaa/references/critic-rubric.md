# Critic rubric

This file is for the **lead** (main session). It explains how to run the blind critic, read its JSON, route defects, decide
on regressions and apply gate G2. The critic itself only gets `agents/onefile-critic.md` and image paths. **Never pass it
this file, code, SPEC, ART, meta.json or earlier reviews.** Its axes, severities and categories below match that agent file exactly.

## 1. Inputs per round (what capture.mjs gives the critic)

From `shots/round-NN/critic/` only:
- `pose-1..6.jpg` (≤ 1568 px long edge: what the vision model really sees) and `pose-N-crop1.jpg`, `-crop2.jpg` (1:1 768² crops at the busiest regions).
- `pose-N-shimmer.jpg` (frozen camera, two frames 1/60 s apart, abs diff ×8).
- `yaw-1.jpg`, `yaw-2.jpg`: seeded random yaw from spawn (catches far field, world edge, emptiness).
- Module showcases when relevant (`show-<module>.jpg`).
Never give the critic the 2560×1440 masters (they are downscaled anyway and may exceed the image limit) or a contact sheet to score from.

## 2. Axes and anchors

Scores are 1-10 per axis; `ui` and `stability` may be `null` when nothing shows them. The general anchors are in the critic
agent (9-10 = 2018+ AAA screenshot, 7-8 strong AA/indie, 5-6 tech demo, 3-4 programmer art, 1-2 broken). Per axis:

| Axis | 9-10 | 7-8 | 5-6 | 3-4 |
|---|---|---|---|---|
| **lighting** | One art-directed key with soft contact-hardening shadows, sky-matched ambient, practicals that light surfaces, shape on the away-from-sun side | Coherent key + fill, a few flat zones or lights that light nothing | Correct but flat; default-looking shadows; no bounce | Unlit or uniformly lit |
| **materials** | Believable PBR: roughness variation, wear, grime, wetness/dust consistent everywhere, no tiling | Good sets, some plastic or tiling tells | Uniform colours with some roughness | Flat colours |
| **geometry** | Bevelled, real-scale, detailed silhouettes, organic forms where needed | Clean kit shapes, some boxy or primitive tells | Obvious primitives | Boxes and spheres |
| **atmosphere** | Layered depth, volumetric shafts, weather, haze matched to sky; far field reads | Haze and depth present, far field weak | Distance fog only | None |
| **composition** | Clear focal point, 3 depth layers, leading lines, foreground framing, no dead space, no world edge | Readable, some empty zones | Centred, flat staging | Random camera |
| **color_grade** | Filmic tonemap, controlled highlights, coloured shadows, cohesive palette, no banding | Filmic, minor clipping or muddiness | Default tonemap, saturated or dull | Clipped, no grade |
| **ui** | Typographic, legible over any background, no overlap, matches the art direction | Clean, a few alignment tells | Default fonts, readable | Overlapping or debug UI |
| **stability** | Black shimmer maps except rain/water/particles; no crawling edges in crops | Small speckle on a few edges | Visible shimmer on surfaces | Flicker, NaN or popping |

## 3. Severity definitions (as given to the critic)

- **blocker**: broken or unshippable. Black/NaN frames or pixels, missing geometry, magenta/shader-error objects, the camera inside geometry, a frame that is mostly UI or empty, crashing. Any blocker fails every gate.
- **major**: an obvious tell a player would notice within seconds. Shadow acne on a main surface, a visible world edge, moire on a large surface, a flat far field in a vista, a cartoon muzzle flash, floating objects, lights that light nothing, banding in the sky, overlapping UI.
- **minor**: a nitpick visible only on inspection. A small tiling patch, a slightly hard shadow, a faint fringe in one crop.

The lead may **escalate** a minor to major when it appears in ≥ 3 poses (it is systemic), and must never downgrade the critic's severity.

## 4. Routing: category → owner

| Critic category | First owner | Second owner (if the first proves it is not theirs) | Typical catalogue entries |
|---|---|---|---|
| lighting | render | look (ART sun/ambient) | flat away from sun, lights that light nothing, overexposed sky |
| shadow | render | world/props (casters, contact) | acne, peter-panning, floating objects |
| material | mats | props / ground | plasticky, tiling, wet look missing, close-up blank |
| geometry | props | world / hero / actors | sharp edges, blocky silhouettes |
| atmosphere | render (fog/vol) | look | fog seams, over-fogged, no depth |
| post | render | look (grade knobs) | banding, fireflies, bloom halos, smear |
| aliasing | mats (shader AA) | props/fx (thin geometry) | moire, specular sparkle, thin lines |
| stability | render | mats / world (LOD) / perf | shimmer, popping, stuck tier |
| composition | lead (poses) | world (dressing) | emptiness, no focal point |
| ui | hud | game | overlap, legibility, black first frame |
| far-field | backdrop | world | flat far field, visible world edge |
| repetition | world | mats | prop or texture repetition |
| scale | world | props | wrong proportions |
| color | look | render | crushed blacks, palette, grade |

Each routed defect is written to `CRITIC_LOG.md` as `round, id, pose, severity, category, owner, catalogue entry, status`.
Owners receive the defect text, the pose's critic image path and the catalogue row, never the critic's full JSON.

## 5. Pairwise A/B protocol (regressions)

Absolute critic scores wobble about ±0.5 per axis between identical builds, so they are **only** used for the gate. Revert
decisions use a pairwise blind comparison:

1. Keep `dist/best.html` plus its `shots/best/critic/` images.
2. After a round's fixes, capture the candidate at the same poses, seed and `?dt`.
3. For each pose, build a pair: `pair-N-a.jpg` / `pair-N-b.jpg`, with best/candidate assigned to a/b by a coin flip recorded only in the lead's state (never in the file names).
4. Spawn a fresh `onefile-critic` with this question appended: *"For each pair, which image looks more like a shipped AAA game, a or b, or tie? Give one reason in visual terms."* It returns `{"pairs":[{"pair":1,"winner":"a|b|tie","why":"..."}]}`.
5. Decide: candidate is **accepted** when it wins or ties ≥ 4 of 6 poses **and** no new blocker/major appears in its absolute review. It is **reverted** (only the owner changes of that round, by module) when it loses ≥ 3 poses or adds a blocker. Otherwise re-run once with a new coin flip; if still mixed, keep best and send the losing poses' defects back to the owners.
6. Change one variable per look iteration (look-director rule), so a loss points to one cause.

## 6. Calibration (the skill's own anchors)

The critic is calibrated against the skill's **own** frames, never against other games. See `quality-bar.md`:
- `calibration/floor/`: a booting graybox (the lowest acceptable output);
- `calibration/best/`: the best shipped frames this skill has produced.

Their recorded scores are in `quality-bar.json` → `anchors`. Run the drift check at the start of every run. If the critic's
mean on `best/` has moved more than 0.75, record `criticOffset` in `STATE.json` and subtract it before applying gates. If
floor and best score within 1.0 of each other, the critic is not discriminating: stop and report.

## 7. Gate G2 (visual)

The thresholds come from `quality-bar.json` (`g2`) and are passed to the workflow as `args.bar`. On a single round's absolute review, after the offset:
- no blocker, and at most `maxMajors` major defects across all poses, crops, shimmer maps and yaw shots;
- every non-null axis except ui ≥ `minAxis`, and geometry ≥ `minGeometry`;
- mean of the non-null axes ≥ `minMean`.

The look-lock uses `look` from the same file: lighting, atmosphere and color_grade each ≥ their minimum, and at most
`maxLookMajors` majors in the look categories.

The bar starts at the first shipped run's baseline and only goes **up**, through the ratchet in `quality-bar.md`. The
`stretch` values (no major, every axis ≥ 7.5, mean ≥ 8.0) are where it is headed. The critic is deliberately harsh (it lists
every tell), so its numbers sit well below a casual impression. Judge progress against the skill's own history, not against intuition.
Geometry is the axis most likely to stall. When it does, push bevels, hero tris and silhouettes (`defect-catalogue.md` geometry
rows) before touching anything else.

## 8. Stop rules tied to the critic

- **Plateau:** two consecutive rounds with mean improvement < 0.1 and no blocker/major → ship best.
- **Budget:** rounds quick 2 / standard 4 / full 7 → ship best with the open defect list in `REPORT.md`.
- Never ship a build with a blocker; if the best has one, keep fixing only blockers.
