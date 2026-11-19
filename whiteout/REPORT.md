# WHITEOUT: ship report
Everything else is done. The build is `dist/index.html`, built with `node build.mjs`. I ran `state.mjs gate G2 fail` (it was unset), recorded the 6.4 score and set the phase to done. The repo is committed as `ec9a3c0 ship`.

WHITEOUT is a first-person survival horror game. You play a lone technician at a snowbound polar research station at dusk while a blizzard builds. You restart three generators to power the radio beacon while something stalks you between the buildings, then call for extraction from the beacon tower. It uses three.js 0.180.0 on WebGL2, and everything is procedural.

## How to play
- **Look:** mouse (pointer lock, with a drag fallback) or the right stick.
- **Move:** W A S D or the left stick.
- **Sprint:** Shift. It is noisy, so the stalker hears it.
- **Crouch:** Ctrl or C. Crouching inside a module hides you from the stalker.
- **Flashlight:** F. The battery drains, and spare cells are in the modules.
- **Generator:** hold E for 3 s to crank it. Cranking is noisy.
- **Beacon console:** hold E for 5 s to send the extraction call.
- **Pause and settings:** Esc.
- **Objective:** start GEN A, GEN B and GEN C in any order. The beacon then powers on, and you call from the radio hut.
- **Win and lose:** you win when the call completes. You lose if the stalker gets within 1.3 m of you.
- **The stalker:** it sees 25 m, or 45 m when your flashlight is on. Holding the beam on it for 1.5 s staggers it, and it retreats for 10 s.
- **Restart:** from the caught or extracted screen.

## Size (`tools/size-report.mjs`)
- **Raw:** 1125.6 KB.
- **Compressed:** 354.8 KB gzip, 293.1 KB brotli.
- **Budget:** 2048 KB, so it passes.
- **Breakdown:** js 1102.9 KB, css 15.3 KB, markup 7.4 KB. GLSL is about 254 KB.
- **Clean:** there are no blobs or external URLs.

## Gates
- **G1, boot: PASS.** All 8 poses captured with 0 errors on a real GPU (ANGLE Metal, Apple M1 Max). No module is stubbed, and the build is under 2 MB.
- **G2, visual: FAIL.**
  - Calibrated bar (critic-rubric §7): no blocker, ≤ 6 majors, every axis ≥ 6 (geometry ≥ 5.5), mean ≥ 6.4.
  - The final critic gave a mean of 6.4 (meets the bar) but materials 5.5 (< 6) and 9 major defects (> 6) fail it.
  - The 2-round critic budget is used up, so this build ships as the best snapshot with its open defect list. There are no blockers.
- **G3, gameplay: PASS.** The bot reaches both win and lose and uses every verb, cranking included. Restart works.
- **G4, performance: FAIL.**
  - At 1080p high, frame times are avg 16.72, p99 34.2 and max 36.1 ms. The gate is 12.5 / 20 / 33 ms.
  - The scene has 3.04 M triangles, over the 3 M limit.
  - It was avg 54.1 ms before the light-cull work in `src/perf/lightcull.js`.
  - What remains is in modules owned by other agents: ground snow patches about 3.7 ms, MSAA×4 about 3.6 ms, shadows about 2 ms, fixed geometry about 7 ms.
  - The GPU was shared with other agents and the 120 Hz screen rounds frame timing to 8.33 ms steps, so these numbers are pessimistic. The gate is still not met.
- **Size: PASS.**

## Performance (M1 Max, vsync off, 20 s run)
| File | Settings | avg | p50 | p95 | p99 | max | fps | Draw calls | Tris | Boot |
|---|---|---|---|---|---|---|---|---|---|---|
| bench-high.json | q=high, dynres=0, 1920×1080 | 16.72 ms | 17.4 | 32.4 | 34.2 | 36.1 | 59.8 | 278 | 3.04 M | 4.95 s |
| bench-auto.json | dynres=1, 2560×1440 | 20.07 ms | 20.3 | 26.2 | 35.7 | 41.3 | 49.8 | 278 | 3.04 M | 4.96 s |

With dynamic resolution on, the render scale averaged 0.928. It stepped down from 0.95 to 0.75 between t=19 s and t=30 s because frames were over budget. The quality tier stayed on high, and neither run logged an error.

## Final blind-critic scores
| lighting | materials | geometry | atmosphere | composition | color grade | ui | stability | mean |
|---|---|---|---|---|---|---|---|---|
| 6.5 | 5.5 | 6 | 7.5 | 6 | 7 | n/a | 6 | **6.4** |

UI was not scored because shot mode hides it. An earlier round scored 6.7 (`shots/round-02`), but the final review of this build is 6.4.

## Open defects

**Major**
- **D1, lighting.** In pose-2 and most other frames, the flashlight is a glow floating in mid-air, not tied to any surface. Put a sharp pool of light on the surfaces it hits and keep only a faint cone.
- **D2, stability.** The volumetric glow shows a dither speckle that changes every frame. Smooth it over time and space.
- **D3, stability.** In pose-3 the static generator flickers between frames and the battery box is blown out to near white. Stabilise the lighting on static props and lower the flashlight and bloom on close surfaces.
- **D4, stability.** The drifting-snow and fog layer swims in big blotches over static buildings and ground, which reads as boiling. Make it move in wind-aligned streaks that don't change the shading of static surfaces.
- **D5, material.** The lab has snow falling indoors, a floor that looks like frosted ground, and flat grey walls. Turn off particles inside, use a vinyl floor, and add grime and decals.
- **D6, repetition.** The lab cabinets are identical and symmetrical. Vary their heights and states and add clutter.
- **D7, far field.** In pose-5 the far field is an empty grey-white plane against a fog wall. Add distant ridges, masts and beacon lights, plus some height variation in the snow.
- **D8, geometry.** In yaw-2 the drift has hard faceted edges that cut into the walls, and the hangar tiles show with no snow transition. Smooth the drifts, add accumulation on walls, and feather the doorway.
- **D9, material.** In yaw-2 the plow blade is a flat yellow slab and the hangar walls are bare. Add bevels, rust and a snow line to the blade, reflections to the glass, and racks to the hangar.

**Minor**
- **D10:** the drift meets the container wall in a hard line, and the ladder base has no snow buildup.
- **D11:** the mountain behind MESS is a perfect cone. It needs an irregular, layered ridge.
- **D12:** the window frost looks like camouflage, and the view outside is flat.
- **D13:** near-camera flakes render as soft squares.
- **D14:** the footprints are flat brown smudges.
- **D15:** the stalker in pose-5 is see-through and washed out by fog. It needs a solid dark silhouette with a rim of lamp light.
- **D16:** in pose-3 the cabinet conduits end in floating stubs, with no contact shadow on the wall.

## Best screenshots (`shots/final/`, 0 errors)
- **pose-1.png:** establishing view over the station in the blizzard.
- **pose-2.png:** eye level between buildings, with the flashlight and a work lamp.
- **pose-3.png:** the hero generator in its shed.
- **pose-4.png:** the lab interior.
- **pose-5.png:** the stalker near the shelter.
- **pose-6.png:** the west side, looking back past MESS.
- **yaw-1.png:** the container wall and drift.
- **yaw-2.png:** the plow truck and hangar.

Critic JPEGs, crops and shimmer maps are in `shots/final/critic/`.

## Verdict
The game is complete and playable. Boot (G1), gameplay (G3) and size pass, there are 0 errors on a real GPU, and it is 355 KB gzipped. It does not meet the visual bar (G2: mean 6.4 meets the calibrated 6.4 bar, but materials 5.5 < 6 and 9 majors > 6) or the frame-time bar (G4: 16.7 ms against 12.5 ms). It ships as the best snapshot, with 16 defects open and no blockers.

The highest-value next steps:
1. Ground the flashlight beam and stabilise the volumetric light (D1–D3).
2. Replace the boiling drift noise with wind-aligned streaks (D4).
3. For G4, cut the ground snow patch cost and use MSAA×2 on the high tier.
## Self-review

**Verdict.** Playable and complete. This is the first run, so it sets the skill's baseline: the critic gives it a mean of 6.4. Atmosphere (7.5) and colour grade (7) are the strongest axes, and materials (5.5) the weakest. It fails G2 on the materials axis and on 9 majors (the bar allows 6). In motion the volumetric light and drift noise boil.

**Against the bar.** Lighting 6.5: the practical lamps work, but the flashlight is a floating glow. Materials 5.5: interiors use flat grey walls and a frosted-ground floor. Geometry 6: the hero generator is detailed, but the drifts are faceted. Composition 6: the far field is empty. Stability 6: per-frame dither and boiling fog.

**Against intent (ART.md).** The dusk blizzard mood, with its warm lamps against cold haze, comes through clearly in pose-1, pose-2 and pose-3. The promised sense of being stalked between buildings is weaker, because the stalker reads see-through in fog (D15).

**Most visible weaknesses.** Floating flashlight glow (D1); boiling drift/fog (D2, D4); snow indoors and repeated lab furniture (D5, D6); empty far field (D7, D11); about 60 fps instead of 80 at 1080p high (G4).

**Next steps (ranked).**
1. Polish 1-2 rounds on D1, D2, D4 and D5 (flashlight pool, temporal volumetrics, wind-aligned drift, no snow indoors). This is the biggest visible gain. Cost: about 8-12 agents, under 1M tokens, 1-2 h.
2. Perf: MSAA×2 on high and cheaper snow patches, for G4. Cost: 2-3 agents, about 0.3M tokens.
3. Skill fixes: move recipes for the flashlight, temporal volumetrics, interior particle culling and far-field ridges into the cookbook so the next game starts with them (see the skill's references/run-log.md).
4. New test: a second game in a very different genre (for example a daytime coastal racer) to check the skill generalises beyond snow and horror. Cost: a quick-budget run, about 4M tokens and 5 h.
