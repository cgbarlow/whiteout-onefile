# Pipeline order

Three orders are mandatory: the **per-frame render order**, the **module boot order**, and the **quality-tier table**. Getting
the render order wrong is the commonest way to lose the look (bloom after tonemap = no highlights; AO on direct light = dirty
halos; dither before grade = banding). The post chain is `cookbook/three/post/pipeline.js` (passes in `cookbook/three/post/shaders.js`);
this file is the contract it implements. Where the cookbook does not implement a step yet, it says so.

## 1. Per-frame render order

| # | Step | Target / resolution | Notes |
|---|---|---|---|
| 0 | `G.emit('update', dt, t)`: input → game logic (fixed step, `engine/loop.js`) → actors → camera → hero/view-model springs | CPU | Zero allocations. Camera must be final before any pass. |
| 1 | Sun shadow map update | 1024²-4096² depth | `createShadowScheduler` (static / every N frames) and `fitSunShadow` in `lighting/pcss.js`; PCSS filter installed globally by `installPCSS`. |
| 2 | Planar reflection (wet ground / calm water) | 0.5× (1× ultra) HalfFloat, mips | `ground/planar-reflection.js`: mirrored camera, oblique near-plane clip; skip when no reflective surface is visible. |
| 3 | Probe / env refresh (rare) | Cube 128 HalfFloat → PMREM | `lighting/probes.js`, `lighting/env-from-sky.js`: only on ART/weather change or level load; never per frame. Caustics texture (`water/caustics.js`) is the one small per-frame bake allowed (512²). |
| 4 | **Main HDR scene pass**: opaques, then sky (inside-out box at the far plane, `lighting/sky.js`), then transparents (water, glass, particles, rain, decals) back-to-front | Full × dynres scale, **HalfFloat, MSAA** (tier), DepthTexture | The one analytic fog/in-scatter is applied **inside every material** by `lighting/atmos.js` (`patchAtmos`); the sky and backdrop use the same `atmosApply()`. |
| 5 | Overlay / view model (FPS hero layer) | Same target | `createPost(G, { overlay: { scene, camera } })`; second camera FOV 54; drawn after the world so it never clips into walls; excluded from motion blur. |
| 6 | Half-res linear depth | 0.5× | Shared by AO, volumetrics and upsample (`DEPTH_HALF`). |
| 7 | SSAO + bilateral blur | 0.5× | `SSAO`, `BILATERAL`; off on low. |
| 8 | Volumetric sun shafts + bilateral blur | 0.5× | `VOLUME`: shadow-map ray march, IGN-jittered start, HG phase, height-falloff density, analytic far-haze continuation. |
| 9 | **Composite**: joint-bilateral upsample; AO on ambient-ish pixels only (fades on brightly lit); `col*T + inscatter` | Full HDR | `COMPOSITE`. |
| 10 | Motion blur (optional) | Full HDR | **Not in `post/pipeline.js` yet.** If a game adds it: reprojection from depth, 9 taps, vector clamped, skipped on camera cuts and on the overlay. |
| 11 | Bloom down chain, first level = Karis average `c/(1+max(c))` | 0.5× → 6 levels | `BLOOM_DOWN`. |
| 12 | Eye adaptation | 1×1 ping-pong | `ADAPT`, metered from the bloom chain; τ = `adaptTau`, clamp `adaptMin..adaptMax`. Order relative to bloom does not matter as long as exposure is applied **before** the tonemap curve. |
| 13 | Bloom tent up chain, then optional anamorphic streak | 0.5× | `BLOOM_UP`, `STREAK` (`?streak=1`). |
| 14 | Lens dirt × hot highlights | Full | `DIRT` texture rendered once. An occlusion-tested lens flare is **not implemented**; skip it rather than fake it with sprites. |
| 15 | **Tonemap + grade**: exposure → `mix(ACES, AgX, agxMix)` → `pow(c, lookPower)` → saturation → split tone → S-curve → vignette → radial chroma | Full | `TONEMAP`. Gameplay overlays (damage edge) go here. |
| 16 | **Final**: FXAA 3.11 → unsharp mask (`sharpen`, backed off on edges) → grain (luminance-weighted) → **TPDF dither ±1/255** → sRGB canvas | Canvas | `FINAL`. Dither is always the last operation. |
| 17 | DOM UI overlay | HTML/CSS | Never drawn into the canvas; hidden under `.shot`. |

URL switches implemented by the pipeline: `?post=0` (plain ACES `BYPASS`, the A/B that proves the chain carries the look),
`?ao=0`, `?vol=0`, `?bloom=0`, `?streak=1`.

## 2. Module boot order

`engine/boot.js` (`createBoot`) runs each step as a named, timed stage behind the loading screen: a non-critical stage that
throws is replaced by its stub and logged to `G.errors`; a critical one shows the fatal screen (never a blank page).
`__stats().modules` lists `{name, ms, ok, stub}`; a shipped build must have no `stub: true`.

| # | Stage | Why here |
|---|---|---|
| 1 | `engine/core.js` (`createCore`: G, renderer, camera, sun) + `engine/harness.js` | Everything else needs G; harness first so errors are captured from the start. |
| 2 | `engine/quality.js` (`createQuality`): tier from renderer string or `?q=`, dynres, context-loss guard | Later modules size themselves from `G.quality.tier` / `G.quality.settings`. |
| 3 | `art.js` → `G.ART` (read-only) | Constants before any shader is built. |
| 4 | `lighting/pcss.js` `installPCSS` and `lighting/atmos.js` `installAtmos` | Global chunk patches only apply to programs compiled **after** them. |
| 5 | `lighting/sky.js` `createSky` → `lighting/env-from-sky.js` `createEnvFromSky` → `G.env`, `scene.environment` | Materials compile against the env. |
| 6 | Materials: `materials/bake.js` GPU bake of the surf sets; weathering patch ready | Bakes need the renderer; the patch must exist before world materials are created. |
| 7 | World / terrain / level layout (`geo/*`), dressed around the 6 poses and the fly path | Needs materials. |
| 8 | Ground + water (`ground/ground.js`, `ground/planar-reflection.js`, `water/sea.js`, `water/caustics.js`) | Needs world bounds. |
| 9 | Backdrop / far field (≥ 2 parallax layers, same fog) | Needs fog and world bounds. |
| 10 | Props, decals, practical lights (`lighting/lights.js`: real lights within the tier budget + light-pool decals) | Needs world and materials. |
| 11 | `fitSunShadow` to the finished caster bounds; `createShadowScheduler` | Shadow frustum fitted once the level exists. |
| 12 | Hero object (weapon / vehicle / avatar / ship) | |
| 13 | Actors (AI, rigs) | Needs world collision. |
| 14 | FX pools and weather (preallocated) | Need camera and ground mask. |
| 15 | Probes (`lighting/probes.js` `createProbe`): capture interiors once | Needs the finished interior. |
| 16 | Post pipeline (`post/pipeline.js` `createPost` → `G.post`, `G.render`) | Needs final sizes and quality. |
| 17 | Audio (`audio/synth.js` offline renders, time-sliced; `audio/mixer.js` graph starts suspended until the first gesture) | Long renders yield; do not block the first frame. |
| 18 | Game state machine, HUD, input (`engine/input.js`) | |
| 19 | **Warm-up**: `await Q.warmup({ extras })` (`engine/quality.js` `warmup`) plus one offscreen instance of every enemy/FX/decal/env variant for a frame | Prevents first-use hitches that trip dynres (a tier stuck low after one hitch). |
| 20 | Render ≥ 3 frames, then `G.markReady()` (`__ready = true`); title starts as a live fly along PATH | Never a black first frame. Dynres ignores the first 5 s after ready. |

## 3. Quality-tier table

The runtime truth is `TIERS` in `cookbook/three/engine/quality.js` (read through `G.quality.settings`); per-pass costs in
`POST_TIERS` (`post/pipeline.js`) and PCSS taps in `lighting/pcss.js`. Values at the time of writing:

| Switch | low | med | high | ultra |
|---|---|---|---|---|
| Pixel cap (drawing-buffer MP after dpr × scale) | 1.0 | 1.5 | 2.3 | 3.7 |
| Sun shadow map | 1024 | 2048 | 2048 | 4096 |
| PCSS taps (0 = plain PCF) | 0 | 8 | 16 | 32 |
| Volumetric steps (`quality.js` / `POST_TIERS`) | 0 (off) / 16 | 12 / 16 | 20 / 20 | 32 / 24 |
| SSAO (taps) | off | on (8) | on (12) | on (16) |
| Bloom mips | 4 | 5 | 6 | 6 |
| MSAA on the HDR target (`quality.js` / `POST_TIERS`) | 0 / 0 | 0 / 2 | 4 / 4 | 4 / 4 |
| Anisotropy | 2 | 4 | 8 | 16 |
| Particle multiplier | 0.4 | 0.7 | 1.0 | 1.3 |
| Draw-distance multiplier | 0.6 | 0.8 | 1.0 | 1.2 |
| Planar reflection (recommended) | off | 0.5 | 0.5 | 1.0 |

The two tables disagree on med MSAA and on low/ultra volumetric steps. `TIERS` in `engine/quality.js` is the authoritative
tier table; for post-chain specifics (MSAA, AO taps, volumetric steps actually used) it defers to `POST_TIERS`, as its own
comment states. `ART.vol.steps` is the art-directed request; the tier
clamps it.

A proven tier ladder for reference (`test/low/medium/high/ultra`): msaa 0/0/2/4/4, shadow 1024/2048/2048/4096/4096,
tex 256/512/1024/1024/2048, volSteps 10/12/16/24/40, planar 0.5/0/0.5/0.5/1, motion blur on high and ultra only, rain 0.4/0.5/0.8/1/1.
A tier change emits `G.emit('quality', G.quality, 'tier')`; modules resize targets and swap `#define` permutations, which
the warm-up already compiled.
