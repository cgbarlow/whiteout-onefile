# Defect catalogue

Symptom → likely cause → fix, for every defect class seen in forensic analyses of AAA-looking procedural browser games plus the usual real-time
artefacts. The lead uses the **Critic category** and **Owner** columns to route a critic defect (`critic-rubric.md`).
Owners are module folders from the game layout (`render`, `mats`, `world`, `backdrop`, `ground`, `props`, `hero`, `actors`,
`fx`, `hud`, `game`, `perf` = quality/dynres, `look` = look-director owning `art.js`).

How to confirm a defect before fixing it: reproduce it at the same pose with `?shot=1&dt=0.016667&seed=…`, then toggle the
suspect subsystem (`?post=0`, `?ao=0`, `?vol=0`, `?bloom=0`, `?wet=0` when the game implements them) and capture again. A
fix is accepted only after an A/B capture at that pose shows it gone with no new defect.

## Lighting and shadows

| Defect | Symptom | Likely cause | Fix | Critic category | Owner |
|---|---|---|---|---|---|
| Shadow acne | Striped or moire dark bands on lit surfaces, worst at grazing sun angles | Depth bias too small for the shadow texel footprint; no slope scaling | Receiver-plane depth bias from `dFdx/dFdy` of shadow coords (the PCSS patch does this); `light.shadow.normalBias` 0.02-0.05 m; fit the shadow frustum tightly (`fitSunShadow` in `cookbook/three/lighting/pcss.js`) so texels are smaller | shadow | render |
| Peter-panning | Shadows detached from their casters, objects look like they float | Bias too large (often added to fix acne) | Lower `bias`, use `normalBias` instead; thicken thin casters (no single-sided planes as casters); add contact AO | shadow | render |
| Blocky / swimming shadows | Stair-stepped shadow edges that crawl when the camera moves | Shadow map too coarse for the frustum; frustum refit every frame with no texel snapping | Fit to the level AABB once (static sun) or snap the frustum origin to whole texels; PCSS 16-tap Vogel + IGN rotation; 4096 on high | shadow / stability | render |
| Hard shadows everywhere | Uniform penumbra; reads as CG | Plain PCF | PCSS contact hardening: blocker search 8 taps, `penM = distM*0.022*radius` | shadow | render |
| Flat lighting away from the sun | Pose 6 is grey and lifeless; no shape | Only the sun lights the scene; env too weak or not from the sky; no practicals | Env from the sky shader (PMREM, `envIntensity` 1.6-2.2); SSAO on ambient only; rim from practicals; a far layer lit by the sky | lighting | render + look |
| Lights that light nothing | Floodlights/neon/lamps glow but the ground under them is dark | Emissive mesh with no light, or light pool too small | `cookbook/three/lighting/lights.js`: pooled point/spot lights (tier budget, nearest the camera), plus light-pool decals (additive decal on the ground with the light's colour falloff) for the rest | lighting | props + render |
| Overexposed sky | Sky is a white or saturated yellow blob; no cloud detail | Sun disk/glow in HDR too hot; no tonemap or wrong order; adaptation meters the ground only | Tonemap after bloom (`pipeline-order.md`); `mix(ACES,AgX,≥0.25)`; clamp the sun disk ×110 only in the sky, never in the env (clamp env to 6); adaptation metered on centre taps with `adaptMax` ≤ 2 for bright scenes | color / atmosphere | render + look |
| Crushed blacks | Shadow areas pure black, no detail; banding in dark gradients | Exposure too low; contrast S-curve too strong; ambient missing; no dither | Raise ambient/env; reduce `contrast`; lift blacks via `splitShadow` (teal, not grey); TPDF dither ±1/255; check AO isn't applied to direct light | color | look + render |
| Interior lit by sky reflections | Interior surfaces reflect the bright outdoor sky | One global env for indoor and outdoor | Interior probe (`cookbook/three/lighting/probes.js`): CubeCamera 128 HalfFloat + PMREM, assigned to materials flagged `userData.interior`; view model switches env inside | lighting | render |

## Materials and surfaces

| Defect | Symptom | Likely cause | Fix | Critic category | Owner |
|---|---|---|---|---|---|
| Plasticky materials | Uniform roughness, clean colour, soft specular everywhere (e.g. sponges, coral) | No roughness/albedo variation; no AO; no wear | Baked surf sets with ORM; macro variation ±15-25% albedo; grime in crevices from AO; roughness variation 0.2-0.4 range; edge wear on bevels; translucency for organic | material | mats |
| Specular sparkle / aliasing | Bright single pixels flicker on bumpy metal or wet surfaces | Normal-map detail above Nyquist; low roughness on high-frequency normals | Specular AA (Toksvig from normal length, or `roughness = max(r, fwidth(N)*k)`); mip the normal map; fade beads with `fwidth` | aliasing / stability | mats |
| Moire | Interference patterns on corrugated metal, grilles, fences, pitch lines, shed skylights | Repeating detail finer than a pixel at distance without mips/fade | Mipmaps + anisotropy 8; `fwidth`-based fade of procedural stripes toward their average; min pixel width for thin geometry; geometric corrugation only near, normal-only far | aliasing | mats + props |
| Visible tiling / repetition | Same texture pattern repeating in a grid; same prop repeated | One texture scale, no world-space variation; copy-pasted props | World-space macro variation (3D noise) in the weathering patch; two scales with incommensurate ratios; per-instance tint/scale/rotation/wear seed; ≥3 prop variants (e.g. container stacks) | repetition | mats + world |
| Close-up surface goes blank | A surface looks like flat colour from < 1 m (e.g. a water surface up close) | Texture res too low; no detail map | Detail normal at 4-8× frequency faded in under 3 m; triplanar detail for hero items | material | mats |
| Wet look missing | Rain thesis but dry-looking surfaces, roofs, props | Weathering patch not applied to all materials | Apply `cookbook/three/materials/weathering.js` to every MeshStandardMaterial, including decals and hero; check `?wet=0` A/B shows a difference everywhere | material | mats |
| Dull reflections | Wet ground reflects nothing or a wrong sky | No planar reflection or env mismatch | `planar-reflection.js` (oblique clip, half-res, roughness-LOD) on puddles; env from the same sky shader | material | ground |

## Geometry and scale

| Defect | Symptom | Likely cause | Fix | Critic category | Owner |
|---|---|---|---|---|---|
| Sharp CG edges | Boxes with razor edges and no highlight lines | No bevels | `roundedBox` r = 5-12 mm, profile extrude with bevel 1-2 mm; never ship a raw BoxGeometry that the camera can see | geometry | props |
| Floating objects / no contact | Props hover or look pasted on the ground; no darkening at contact | Missing contact shadow/AO; slight y offset | SSAO + baked AO; contact shadow decals (blob/soft AO card); snap y to ground height; push 1-2 cm into the ground | shadow / geometry | world + props |
| Scale errors | Doors too small, stairs too tall, props toy-like | Arbitrary units | Real metres: door 2.1×0.9, stair rise 0.17, ISO container 6.06×2.438×2.591, eye 1.68; check against a 1.8 m reference capsule in the showcase | scale | world + props |
| Popping LOD | Objects snap in/out or change shape as the camera moves | Hard LOD switch or hard draw-distance cut | Smoothstep scale-to-zero or dither fade across a 10-20% band (e.g. `1 - ss(c.z*.7, c.z, dist/det)`); never cut instances at a fixed radius | stability | world |
| Blocky silhouettes | Organic shapes (rocks, creatures, ship hull) read as boxes (e.g. ship planks) | Low tessellation, extruded boxes for curved forms | Lathe/tube/sweep; icosphere + fbm + plane clip for rock; SDF → surface nets for sculpted forms | geometry | props / world |

## Atmosphere and far field

| Defect | Symptom | Likely cause | Fix | Critic category | Owner |
|---|---|---|---|---|---|
| Flat far field | Skyline/distant ships are flat single-colour silhouettes | One card at one depth, not fogged consistently | ≥2-3 parallax layers at different distances, procedural window lights, the **same** fog function as the world; rim/backlight from the sky | far-field | backdrop |
| Visible world edge | A wall, seam, terrain cut or skybox band visible (e.g. a straight seam) | Map ends inside the fog distance | Dip the boundary below the fog horizon; ring of terrain/set dressing; background quad/sky horizon at the fog colour at the far distance; check every random-yaw shot | far-field | backdrop + world |
| Fog seams | Visible line where fogged geometry meets the sky; distant objects brighter than the sky behind them | Sky not fogged with the same function; different fog in some shaders | One analytic fog/in-scatter in every shader (`cookbook/three/lighting/atmos.js` `patchAtmos`), the sky and the backdrop; match `fog.scatter` with `sky.horizon` | atmosphere | render |
| No depth layering | Image looks flat, everything equally contrasty | Fog too weak, no volumetrics | Raise `fog.sigma` until the 100 m layer is at 60-75% transmittance; volumetric shafts; aerial perspective tint | atmosphere | look + render |
| Over-fogged | Milky, low contrast, nothing past 30 m | Fog sigma too high, vol strength too high | Lower sigma; keep ≥5% transmittance at 100 m; `vol.strength` ≤ 1.4 | atmosphere | look |
| Emptiness | Large dead areas of plain ground or sky in random-yaw shots | Dressing only around hero poses | Scatter pass with density by zone; set dressing every ~10 m along sightlines; clouds with structure | composition | world |

## Post-processing and image quality

| Defect | Symptom | Likely cause | Fix | Critic category | Owner |
|---|---|---|---|---|---|
| Banding | Stepped gradients in sky, fog, dark areas, vignette | 8-bit output without dither; LDR intermediate targets | HalfFloat intermediates; ±1/255 TPDF dither `(ign(p)+ign(p+37)-1)/255` as the last op; grain 0.02 | post | render |
| Fireflies / NaN black pixels | Single white sparkles that bloom into blobs, or black pixels/squares that spread through blur | Division by zero, `normalize(0)`, `pow(negative)`, HDR spikes from specular, sun in the env | Guard divisions with `max(x,1e-4)`; Karis average on the first bloom downsample `c/(1+max(c))`; clamp bloom input (24); clamp env to 6; `if (any(isnan(c))) c = vec3(0)` only as a last safety net (find the source) | post / stability | render (or the material owner whose shader produced it) |
| Bloom halos | Glowing auras around every bright edge; milky image | Threshold too low or mix too high; bloom before exposure | `bloom` 0.05-0.09, threshold ≥ 1.0 in HDR; energy-conserving `mix(col,bloom,k)`, not add | post | look + render |
| Oversized muzzle flash | Cartoon star sprite filling the screen (often on hip-fire) | Sprite too big/long, symmetric | ≤ 8% of screen height, 2-3 frames, random rotation and shape from a small atlas, HDR core + soft sides, lit point light for 1-2 frames | fx | fx |
| Smear after camera snap | Hero/view model smears after instant yaw | Motion blur from reprojection with a large camera delta | Clamp the blur vector; skip motion blur on frames with yaw > 30°/frame or on camera cuts; exclude layer 1 | post | render |
| Over-sharpening | Halos/ringing along edges | Unsharp > 0.4 or applied on edges | Sharpen 0.2-0.3 backed off on edges by luma gradient | post | render |
| Chromatic aberration too strong | Colour fringes visible at centre | CA not radial or too large | Radial, ≤ 0.002, zero at the centre | post | look |
| Temporal shimmer | Orange speckle on static geometry in the shimmer heatmap | Jittered effects not filtered (vol/AO noise), sub-pixel geometry, specular aliasing | Bilateral blur + depth-aware upsample for half-res passes; IGN jitter (stable per pixel, animated only with a temporal filter); specular AA; min-width geometry | stability | render / mats |
| Thin-line aliasing | Wires, fences, rain streaks crawl and break up | Sub-pixel width without coverage AA | Keep width ≥ 0.75-1 px in the vertex shader (`uPix`), fade alpha by the lost coverage; MSAA 4 + FXAA | aliasing | props / fx |

## Runtime, perf and UI

| Defect | Symptom | Likely cause | Fix | Critic category | Owner |
|---|---|---|---|---|---|
| Black first frame | Title/intro starts on black, or a white flash | Scene not ready, adaptation starting at 0, post targets empty | Title is a live fly along PATH; init adaptation at the expected exposure; render 3+ frames before `markReady`; fade from the first rendered frame, not from black | ui / post | game + render |
| Stuck low quality tier | Whole session at 0.6 scale and medium after one early hitch | One-way tier drop; first-use shader compiles mid-game | Warm every permutation at boot (spawn one of each enemy/FX/decal offscreen, render each env variant) with `compileAsync` and `KHR_parallel_shader_compile`; ignore frame times for 5 s after ready; tier changes reversible with hysteresis | stability (perf) | perf |
| First-use hitch | 50-300 ms freeze the first time a weapon fires, an enemy spawns, an interior is entered | Shader program compiled on first draw | Same warm-up as above; `renderer.compileAsync(scene, camera)` behind the loader | stability | perf + integrator |
| UI overlapping | HUD elements overlap each other or the hero object; text clipped at small sizes | Absolute pixel layout; no safe area | CSS grid HUD with safe-area margins (≥ 24 px at 1080p), clamp() font sizes, test 1280×720 and 2560×1440; `?shot=1` hides UI for clean captures | ui | hud |
| Unreadable UI over bright scenes | Text lost against sky/snow | No backing | Subtle backing gradient/scrim at 30-45% opacity or text shadow; never pure white text on snow | ui | hud |
| Shader compile error | Magenta/black objects, `__errors` has `shader:` entries | GLSL syntax, minifier damage (`#define X (a)` → function macro, `a - -b` → `a--b`) | Fix the GLSL; follow CONTRACT GLSL rules; always test the `--min` build | blocker | owner of the shader |
| Context lost | Canvas goes black on integrated GPUs after load | VRAM spike (big bakes + 4096 shadow) | Handle `webglcontextlost/restored`; bake sizes per tier (`perf-budgets.md`) | blocker | perf |
