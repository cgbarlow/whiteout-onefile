# Lessons: what makes procedural browser games look AAA, and the process that works

Condensed from forensic analysis of AAA-looking single-file procedural browser games (code, prompts and measurements).
Labels: **FACT** = seen in code, a prompt or a measurement; **HYP** = inference, with confidence.

## 1. The core insight

The worlds behind the best-looking procedural browser games are geometrically simple (bevelled boxes, a small mesh
vocabulary). The look comes from **light transport, atmosphere, wetness and post**, built as one coherent render stack, and
from a **process** that puts real-GPU screenshots in front of a blind critic for many rounds. A tightly scoped vertical slice
(one map, one hero object, 2-3 actor types, a 5-10 minute loop) with this stack reads as a 2013-2016 AAA game in stills.

## 2. What makes them look good (ranked by measured or evident contribution)

1. **A custom HDR post chain** (FACT, A/B measured: with `?post=0` the sky becomes a saturated blob, haze layers vanish,
   props read as flat CG). HalfFloat MSAA target → AO → volumetrics → composite → bloom (Karis) → adaptation → lens →
   `mix(ACES, AgX, 0.25)`, look power 1.18, sat 1.22 → split-tone grade, S-curve, vignette 0.3 → FXAA, sharpen 0.3,
   grain 0.02, ±1/255 dither. Order in `pipeline-order.md`.
2. **Volumetric sun shafts through the shadow map plus one analytic fog used by every shader** (FACT). A single closed-form
   in-scatter integral with per-channel σ is what makes distance read as water or air; a far-haze continuation layer adds depth.
3. **One art-directed sun, low and backlit** (FACT). Example: dir (.916,.225,.331), colour (1,.72,.42), intensity 9, against
   a slate cloud deck with a burning gap. Hero shots face into it.
4. **The procedural sky reused as the PMREM environment** (FACT): all reflections and ambient match the sky.
5. **GPU-baked procedural PBR sets** (FACT): ~27 `surf(uv)` programs with a shared noise/rust/paint-damage library baked to
   albedo/ORM/normal in ~150 ms; ~45 named materials tint them.
6. **One global weathering patch on every material** (FACT): world-space macro variation, wetness on up-facing faces, wall
   streaks, a damp band near the ground, rain beads faded by `fwidth`, specular AA. Coherence comes from it being shared.
7. **A signature surface**: mirror puddles (planar reflection, oblique clip, roughness-driven LOD, ripple rings), or
   projected caustics and Snell's window underwater.
8. **PCSS contact-hardening shadows**, or a baked 4096² static shadow for static scenes.
9. **Bevelled real-scale geometry and canvas-2D distressed signage**, plus a small mesh vocabulary (sweep, tube, lathe,
   rock = icosphere + fbm + plane clips, SDF → surface nets).
10. **Anti-aliasing of procedural detail and anti-banding everywhere**: TPDF dither, Karis bloom, minimum pixel widths, LOD by
    scale-to-zero fades (every LOD transition is a smoothstep).
11. **Scenes composed for fixed cameras** (FACT): `makeWorld(D, T, flyPts, POSES)` places content relative to the six critic
    poses and keeps the fly path clear. This is the strongest evidence for a pose-driven critic loop.

What still gives such games away (each is now a rubric check): prop repetition (container stacks), flat lighting facing away
from the sun, flat skyline cards, tiling sea normals, moire on corrugated metal, a cartoon muzzle flash, a black first frame,
floodlights that light nothing, a tier stuck low after one hitch, a straight world-edge seam, featureless surfaces up close,
boxy planks, plasticky organic materials. **Defects appear exactly where no critic camera pointed**, so random-yaw shots are
mandatory.

## 3. Why one-shot chat prompting fails

| Missing ingredient | Consequence |
|---|---|
| **Eyes**: real-GPU screenshots at fixed poses | Banding, fireflies, NaN pixels, acne and moire ship unseen. |
| **A blind critic** (images only) with a "nothing above minor" exit | Self-review that sees its own reasoning is too lenient. |
| **Time and tokens** | Chat gives one pass of ~30k tokens. A polished result takes millions of output tokens: the shipped code rewritten many times over. |
| **A build step** | A 1-2 MB game cannot be typed in one reply. Single-file is the delivery format, not the authoring format. |
| **Module contracts + parallel owners with stubs and showcases** | One agent does everything shallowly; one crash kills the page. |
| **Runtime self-checks** (`__errors`, shader-error tags, audio meter) | Broken pages and silent/clipping audio go unnoticed. |
| **Perf gates** | The model either piles on effects until it stutters or stays timid. |
| **A structured spec** (priorities, constraints, target, checklist, gates, DONE WHEN) | "Make it AAA" has no stop condition and nothing to measure. |
| **Graphics priors** | The model needs the recipes **given**: the cookbook. |

Findings to keep in mind:
- A good build prompt names **no rendering technique** but does contain *process* instructions: blind critic subagent,
  6 poses at 2560×1440, GPU Chrome, timestamp queries. The likely extra ingredient behind the best results (HYP ~60%):
  already-perfected subsystem demos (SFX board, material board, model viewer) that the game then reuses. Hence
  **Phase 1.5: standalone subsystem showcases, each with its own short critic loop, before the game exists**.
- A single-agent pass with a screenshot self-check produces a good but clearly lesser result; any confidence about a
  one-shot pass reaching AAA stills is ≤ 50%.
- Calling `compileAsync` is not enough: hitches come from permutations compiled later plus a **one-way tier drop**. The fix
  is warming every permutation and reversible, hysteresis-based tier changes ignored for 5 s after ready.
- Tree-shaking three.js saves ~175 KB, not 300-400 KB: named imports = **~512 KB** minified (131 KB gz) vs 687 KB whole.

## 4. The process that works

1. **Spec first** (`spec-template.md`): priorities, constraints, target, look, scene checklist, gameplay, verification, DONE WHEN.
2. **Lead = the main session** (subagents cannot spawn subagents). It writes contracts, stubs, harness, build and a graybox,
   and keeps `STATE.json` (phase, round, best score, open defects → owner, gate status) so the run survives compaction and
   usage-limit pauses (a few hours of AI time can stretch over days).
3. **Fix the 6 critic poses and the fly path before building the world**; dress the world around them.
4. **Build the light/atmosphere/post stack first** from the cookbook with the chosen ART thesis; lock the look on a graybox
   (lighting, atmosphere, grade, materials ≥ 8).
5. **Subsystem showcases** (Phase 1.5): material board, hero-model viewer, SFX board, each with a short critic loop.
6. **Parallel module owners** (4-8), each with its showcase, zero errors, a budget, and no edits outside its module. Per-owner
   build dirs, OS-assigned ports, a capture lock, and **no perf numbers outside the perf phase** (shared GPU).
7. **Blind critic loop**: fresh `onefile-critic` (tools: Read only) each round on 1568 px JPEGs + 1:1 crops + shimmer heatmaps
   + random-yaw shots (it cannot watch video and loses sub-pixel detail on big images). Route defects by category; pairwise A/B
   for regressions; calibrate on the skill's own frames (`critic-rubric.md`).
8. **Perf gate** with vsync disabled and thresholds relative to the target refresh (`perf-budgets.md`).
9. **Ship**: esbuild single file, < 2 MB, no binary blobs, three.js MIT notice kept (`legalComments: 'eof'` or a banner).

Operational rules learned the hard way: never `cat`/`grep` `dist/index.html` (one line of 1.4 MB floods the context); cap source
files at ~800 lines; run long jobs (`npm i`, bench, full capture rounds) in the background with 60 s per-capture timeouts;
headed Chrome needs `--disable-backgrounding-occluded-windows --disable-renderer-backgrounding
--disable-background-timer-throttling` or occluded windows stop rendering; the GLSL minifier must keep `#` lines intact and
never fuse `a - -b` (use `templates/three/glsl-min.mjs`); test the **minified** build.

## 5. Honest expectations

- Cookbook + critic loop on Claude Opus: AAA-looking stills on the 6 poses after 3-5 rounds (HYP ~65%). Gameplay depth at
  vertical-slice scope (4-5/10).
- Cost: hours and millions of tokens, much cheaper than building from scratch because the cookbook removes rediscovery, but
  not chat-sized. State this to the user before starting (`--budget quick|standard|full` = 2/4/8 critic rounds).
- What will still give it away: the far field, repetition, anything off the poses. Random-yaw shots and the far-field recipe
  target exactly these.
- Licensing: study unlicensed code, never copy it. Adapt MIT code only with its copyright notice kept; the adapted code in
  this skill is listed in `THIRD_PARTY_NOTICES.md`.
