# Performance budgets

Budgets per quality tier, the bundle budget, and the frame-time gate (G4). Typical targets for a dense AAA-looking scene on
an M1 Max-class GPU at 1600×900, high tier, `dynres=0`: ≤ 2.5 M tris, ≤ 450 draw calls, ≤ 128 MB of baked textures, 80-120 fps,
and a GPU time of roughly 10-14 ms when an fps governor holds it.

## 1. Per-tier budgets

`G.quality.tier` is `low | med | high | ultra`. There is no `test` tier in the cookbook engine: captures use `?q=high&shot=1&dt=0.016667&seed=N`.
All numbers are **per frame in the worst hero pose**, read from `window.__stats()` (`calls`, `tris`) and `renderer.info.memory`.

| Budget | low | med | high | ultra |
|---|---|---|---|---|
| Target hardware | integrated / mobile-class (Intel UHD, Mali, Adreno) | Intel Iris Xe, M1 base, GTX 1650 | M1 Pro/Max, RTX 3060 | RTX 4070+, M3 Max |
| Pixel cap (`engine/quality.js` TIERS.pixelCap) | 1.0 MP | 1.5 MP | 2.3 MP | 3.7 MP |
| Dynres scale range (shipped controller) | 0.6-1.0 | 0.6-1.0 | 0.6-1.0 | 0.6-1.0 |
| MSAA samples (HDR target; `post/pipeline.js` POST_TIERS) | 0 | 2 | 4 | 4 |
| Triangles | ≤ 0.6 M | ≤ 1.2 M | ≤ 2.5 M | ≤ 3.5 M |
| Draw calls | ≤ 200 | ≤ 300 | ≤ 450 | ≤ 600 |
| Texture VRAM (bakes + RTs) | ≤ 48 MB | ≤ 80 MB | ≤ 128 MB | ≤ 192 MB |
| Baked material size | 512² | 1024² | 1024² (hero 2048²) | 2048² |
| Sun shadow map / PCSS taps (`engine/quality.js` TIERS) | 1024², plain PCF | 2048², 8 taps | 2048², 16 taps (4096² when the level is > 100 m) | 4096², 32 taps |
| Shadow update | every 4th frame or on change | every 2nd frame | every 2nd frame | every frame |
| SSAO | off (baked AO only) | half res, 8 taps | half res, 12 taps | half res, 16 taps |
| Volumetrics (half res; steps from TIERS / POST_TIERS, see `pipeline-order.md`) | off or 16 | 12-16 | 20 | 24-32 |
| Bloom mips (TIERS.bloomMips) | 4 | 5 | 6 (+ streak) | 6 (+ streak) |
| Planar reflection | off (env only) | 0.5 res | 0.5 res | 1.0 res |
| Motion blur | off | off | on (9 taps) | on |
| Rain streaks / snow flakes | 3 k | 6 k | 9 k | 12 k |
| Splash / impact particles | 300 | 600 | 900 | 1 200 |
| Live FX particles (sparks, smoke) | 500 | 1 000 | 2 000 | 3 000 |
| Real point/spot lights (`lighting/lights.js` budget; the rest become light-pool decals) | 2 | 4 | 6 | 8 |
| Probes (cube 128 HalfFloat) | 0-1 | 1-2 | 2-4 | 4 |
| Active GLSL (unique source across live programs) | ≤ 150 KB | ≤ 220 KB | ≤ 300 KB | ≤ 350 KB |
| Shader permutations warmed at boot | all for this tier | all | all | all |

Rules:
- Quality differences must come from **`#define` permutations, sample counts, resolutions and counts**, never from different
  shader code paths that only get tested on one tier.
- Hero poses must keep the **high** look on `test`: captures run with `?q=high`, never `low`.
- Instance anything repeated > 8 times (`InstancedMesh`); merge static meshes by material (target: a whole static level in ~100-150 meshes).
- LOD by smooth scale/dither fades over a 10-20% band, never hard cuts.

## 2. Dynamic resolution and tier changes

- The shipped controller (`engine/quality.js`): scale moves in 0.05 steps in [0.6, 1]; down after 2 bad windows in a row,
  up after 3 good ones; a scale that failed recently needs 4× longer evidence before it is retried (stops 60↔30 ping-pong).
- **Evidence before ready + 5 s is ignored**, and single frames > 250 ms (tab switch, GC, compile) are dropped. Also ignore
  frames that overlap a screenshot or video recording.
- Tier changes are **reversible with hysteresis**: down after ~6 s sustained at the floor scale and still over budget; up after
  ~15 s of big headroom at full scale; ≥ 10 s between tier changes; never above the detected tier. Never lock a tier for the
  session (a common defect: one early hitch locks it at 0.6/medium).
- Precompile every permutation behind the loader: `renderer.compileAsync(scene, camera)`, `KHR_parallel_shader_compile`
  polling, and spawn one of every enemy/FX/decal/env variant offscreen for one frame.
- Persist the settled scale in `localStorage` (try/catch), with a crash canary: set a flag during load, clear it 15 s after ready; if it is still set on the next boot, start one tier lower.

## 3. Bundle budget (three.js path)

| Part | Budget | Notes |
|---|---|---|
| three.js r180, named imports, tree-shaken | ~512 KB (≤ 550 KB) | measured: 28-symbol import set = 512 KB minified (131 KB gz); `import * as THREE` = 687 KB |
| Game JS without shaders | ≤ 600 KB | a dense FPS slice lands around 450-700 KB including GLSL |
| GLSL (minified by `templates/three/glsl-min.mjs`) | ≤ 450 KB (plan ~250 KB) | typically 110-260 KB of GLSL |
| CSS | ≤ 40 KB | typically ~30 KB |
| **Total `dist/index.html`** | target ≤ 1.7 MB, **hard cap 2 MB** (build exits non-zero) | a full FPS slice ~1.4 MB; an explore-only scene can be < 100 KB |
| Embedded binary (`data:image|audio|font|octet`) | **0** | everything procedural |

## 4. Frame-time gate G4

Frame time from rAF is capped by vsync (16.7 ms on 60 Hz), and WebGL has no usable GPU timer on Chrome/Mac. So:

- **Measure with vsync off:** launch Chrome with `--disable-gpu-vsync --disable-frame-rate-limit` for the bench run only. Record the display refresh (`screen` refresh from a 1 s rAF count with vsync **on**, before the bench) in `meta.json`.
- **Gates are relative to the refresh period of the target display**, `P = 1000 / refreshHz` (default target 60 Hz → P = 16.7 ms):

| Measure (bench path, after 5 s warm-up, `?dynres=0&q=high`, 1920×1080) | Gate | At 60 Hz | At 120 Hz target |
|---|---|---|---|
| Average frame time | ≤ 0.75 · P | ≤ 12.5 ms | ≤ 6.25 ms |
| p99 | ≤ 1.2 · P | ≤ 20 ms | ≤ 10 ms |
| Max | ≤ 2.0 · P | ≤ 33 ms | ≤ 16.7 ms |

- Second run with defaults at 2560×1440: average dynres scale ≥ 0.8 and **no tier drop** during the bench.
- Static budgets in the same build: draw calls and tris within the tier table, texture VRAM within the tier table, boot to first rendered frame ≤ 10 s.
- When `EXT_disjoint_timer_query_webgl2` exists, also report GPU ms; a governor band of ~10-14 ms at 2560×1440 is a good high-tier target.
- Ignore spikes that line up with `page.screenshot()` or `recordVideo`; never record video during a bench.
- No perf measurement outside Phase 6: parallel owners share one GPU, so their fps numbers mean nothing.
- Fix order when over budget: per-tier shader permutations → half-res passes → shadow update rate → merge/instance → LOD fades. Re-run G2 after perf fixes.

Calibration note: good-looking scenes with a max frame of ~47 ms (dynres stuck at 0.6) or a p99 of 18 ms against a 16.7 ms cap
would fail a gate stricter than this; these thresholds are set so a dense scene passes once its tier and warm-up bugs are fixed.
