# Spec template

A good build prompt is an **engineering spec, not a wish** (about 30-40 lines): ranked priorities, hard constraints, a measurable
target, a scene checklist, controls, verification gates and a DONE WHEN. It names no rendering technique; the cookbook supplies
those. Fill this template in Phase 0 into the game's `SPEC.md`. Replace every `<…>`; delete nothing. Keep it ≤ 80 lines.

## Template

```text
Build <GENRE> "<TITLE>": <ONE-SENTENCE CONCEPT>. Small in scope (one <MAP SIZE, 100-200 m> level, a <5-10> minute loop),
but it must look like a current AAA game in every screenshot.

PRIORITIES (in this order when they conflict)
1. Visual quality at the 6 hero poses, in random-yaw views and in motion
2. Stable frame pacing at the target
3. Gameplay that is complete (win, lose, restart) and feels good
4. Bundle size

CONSTRAINTS
- three.js 0.180.0, WebGL2, named imports only. Everything procedural: no texture, model or
  audio files, no base64 blobs. Fonts: system or one Google Fonts link.
- Deliverable: one self-contained dist/index.html < 2 MB, built by esbuild from src/ modules (templates/three/build.mjs).
- Module contracts in src/contracts.js; every module exports create(G) + showcase(G) and has a stub fallback.
- Cookbook first: use onefile-aaa cookbook files as-is before writing new rendering code (cookbook/CONTRACT.md).
- Harness hooks: ?shot ?cam ?q ?dt ?seed ?show ?post=0 ?dynres=0 #bench; window.__ready __frames __errors __stats __setCam __G.
- Pointer lock with drag fallback; gamepad; zero per-frame allocations in update/render hot paths.

TARGET
- <MACHINE, e.g. MacBook Pro M1 Max / RTX 3060 desktop>, Chrome <VERSION>, <RES, e.g. 1920×1080>, display <REFRESH> Hz.
- Bench (vsync off, dynres off, q=high, 1920×1080): avg ≤ 0.75·P, p99 ≤ 1.2·P, max ≤ 2·P (P = 1000/<REFRESH> ms).
  Defaults at 2560×1440: dynres ≥ 0.8, no tier drop. Boot to first frame ≤ 10 s. Budgets: references/perf-budgets.md <TIER>.

LOOK (from ART.md, thesis <T#> in references/art-direction.md)
- Thesis: <ONE LINE>. Sun <elevDeg/azimDeg, colour, intensity>. Fog σ <r,g,b>. Grade <agxMix/lookPower/sat/split-tone>.
- Signature surface: <puddles | caustics | snow accumulation | neon reflections | sand ripples | lava | swell>. Weather: <kind, amount>.
- Hero object: <weapon | vehicle | avatar | ship | set piece>, ≥ 30k tris, real-world dimensions.
- Hero poses: 1 <vista into the sun> 2 <gameplay eye at spawn> 3 <hero close-up> 4 <interior / second biome>
  5 <action moment> 6 <reverse angle away from the sun>. Fly path: <30-60 s, key points>.

SCENE CHECKLIST
- <8-12 bullets: set pieces, props with variants, actors, FX, practical lights that light surfaces,
  far field with ≥ 2 parallax layers, boundary hidden by <fog | terrain | set dressing>, decals/signage>

GAMEPLAY
- Verbs: <…>. Actors: <…>. Objective loop: <…>. Win: <…>. Lose: <…>.
- UI: title (live fly along PATH, never a black frame), settings (tier, sensitivity, volume, invert Y), pause, HUD, end screen.

VERIFICATION
- Visual critic: a separate subagent (agents/onefile-critic.md, tools: Read) that sees ONLY renders: 6 poses captured in GPU
  Chrome by tools/capture.mjs --critic --shimmer (1568 px JPEG + 1:1 crops + shimmer heatmaps), 2 random-yaw shots and module
  showcases. It returns prioritised, located defects. Gate G2: the `g2` thresholds in references/quality-bar.json (no blocker;
  mean 8.0 is only the stretch target; see references/critic-rubric.md). Regressions decided by pairwise blind A/B.
- Performance: bench report (avg/p99/max, render scale, tier, renderer string) + GPU timestamps when available. Gate G4.
- Gameplay: playtest bot reaches win and lose, exercises every verb, restart works, zero console errors over 5 min;
  audio self-test: peak ≤ -1 dBFS, no NaN, no silent stems. Gate G3.
- Boot: 6 pose PNGs, __errors empty, renderer is not SwiftShader/llvmpipe, dist builds. Gate G1.

DONE WHEN gates G1-G4 pass in the same build, or the critic-round budget (<quick 2 | standard 4 | full 7>) is exhausted, in
which case ship the best snapshot with its residual defect list. Never ship a blocker. Deliver dist/index.html, its size,
the perf report and the critic's final review.
```

## Worked example (survival, thesis T3)

```text
Build a first-person survival game "WHITEOUT RELAY": a lone technician must restart a failing Antarctic research station's
radio relay before a blizzard closes in, keeping warm between heated modules while the cold drains her. Small in scope (one
160 × 120 m ice-shelf station, a 7-minute loop), but it must look like a current AAA game in every screenshot.

PRIORITIES (in this order when they conflict)
1. Visual quality at the 6 hero poses, in random-yaw views and in motion
2. Stable frame pacing at the target
3. Gameplay that is complete (win, lose, restart) and feels good
4. Bundle size

CONSTRAINTS
- three.js 0.180.0, WebGL2, named imports only. Everything procedural: no texture, model or audio files, no base64 blobs.
  Fonts: system stack (no network).
- Deliverable: one self-contained dist/index.html < 2 MB, built by esbuild from src/ modules (templates/three/build.mjs).
- Module contracts in src/contracts.js; every module exports create(G) + showcase(G) and has a stub fallback.
- Cookbook first: use onefile-aaa cookbook files as-is before writing new rendering code (cookbook/CONTRACT.md).
- Harness hooks: ?shot ?cam ?q ?dt ?seed ?show ?post=0 ?dynres=0 #bench; window.__ready __frames __errors __stats __setCam __G.
- Pointer lock with drag fallback; gamepad; zero per-frame allocations in update/render hot paths.

TARGET
- MacBook Pro M1 Max, Chrome 142, 1920×1080, display 60 Hz.
- Bench (vsync off, dynres off, q=high, 1920×1080): avg ≤ 12.5 ms, p99 ≤ 20 ms, max ≤ 33 ms.
  Defaults at 2560×1440: dynres ≥ 0.8, no tier drop. Boot to first frame ≤ 10 s. Budgets: perf-budgets.md high.

LOOK (ART.md = ART_SNOW_STATION, thesis T3)
- Thesis: overcast whiteout, wind-driven snow, warmth only from windows and work lights.
  Sun elev 18 / azim 160, (0.95,0.97,1.0) ×2.5. Fog σ (0.020,0.019,0.017). Grade agxMix 0.5, lookPower 1.05, sat 0.9, cool shadows.
- Signature surface: snow accumulation on up-facing faces + drifts against walls, frost on windows. Weather: snow 0.6, wind (3,0,1).
- Hero object: the station's relay mast + the technician's thermal lantern (held, its own point light), mast ≥ 40k tris.
- Hero poses: 1 [-38,3.2,-30, 0,8,10] from the ridge toward the mast with the sun glow behind it
  2 [-20,1.68,-18, -6,1.5,-4] spawn at the vehicle shed door, eye height  3 [2,1.4,1.2, 0,1.2,0] lantern and frosted relay panel
  4 [14,1.68,6, 20,1.4,10] inside the generator module by sodium light  5 [6,1.68,-12, 12,1,-4] the generator overheating, sparks and steam, storm gusting
  6 [40,2.0,30, 0,4,0] reverse from the far fuel tanks back to the station, away from the sun.
  Fly path: 45 s through 1→2→5→4→3→6 at 4 m/s, 2-3 m altitude.

SCENE CHECKLIST
- 5 prefab modules on stilts (bevelled panels, rivets, frosted windows, warm interior probes), linked by a cable walkway
- Relay mast 30 m with guy wires (≥ 1 px wide), red aviation light that lights the snow below
- Fuel tanks, snowcat, crates, antenna dishes, each with 3 variants and weathering
- Snow terrain (SDF drifts and sastrugi) with footprints decals along the spawn path
- Work lights on poles: pooled point lights + baked light cards on the snow
- Blowing snow sheets near the ground, falling flakes, gust bursts
- Far field: 3 layers of ice ridges at 250/500/900 m in the same fog, a nunatak silhouette
- Boundary: ice cliffs on three sides, fogged sea ice on the fourth
- Signage: stencilled module names, hazard placards, distressed by wind

GAMEPLAY
- Verbs: walk/sprint, interact (hold E), carry fuse, warm up at heaters. Actors: blizzard gusts (visibility drops),
  one failing generator (overheats, must be vented). Objective loop: collect 3 fuses from 3 modules → install them in the
  relay → vent the generator → transmit. Win: transmission sent. Lose: body heat reaches 0 outside.
- UI: title (live fly), settings, pause, HUD (body heat ring, objective text, interaction prompt), end screen with time.

VERIFICATION
- Visual critic per critic-rubric.md (6 hero poses + 2 random-yaw shots + showcases; G2 thresholds from references/quality-bar.json; mean 8.0 is only the stretch target).
- Performance: bench report + GPU timestamps if available. Gate G4.
- Gameplay: bot reaches win and lose, all verbs, restart, zero errors over 5 min; audio self-test. Gate G3.
- Boot: G1.

DONE WHEN gates G1-G4 pass in the same build, or the standard budget (4 critic rounds) is exhausted, in which case ship the
best snapshot with its residual defect list. Never ship a blocker. Deliver dist/index.html, its size, the perf report and the
critic's final review.
```

## Filling rules

- Priorities never change order. If the user asks for "gameplay first", move item 3 to 1 and say so in SPEC.
- Every scene-checklist bullet must name something a camera can see, with a number (count, size, distance).
- Poses are numbers, not prose, by the end of Phase 0. Pose 6 always faces away from the sun.
- The checklist must include: practical lights that light surfaces, a far field with ≥ 2 layers, a hidden boundary.
- Win **and** lose are mandatory unless SPEC says "no lose state" with a reason (walking sim, puzzle).
