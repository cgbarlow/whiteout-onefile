# Art direction: look theses

Pick **one** thesis in Phase 0. Copy its `ART` object into the game's `src/art.js` as `export const ART = {...}`
(rename the constant). Change values only through the look-director, one knob per critic round (see
`critic-rubric.md` A/B protocol). Every object below follows the binding schema in `cookbook/CONTRACT.md`; each one
was checked against that schema during development.

Units and conventions (all colours are **linear** RGB, not sRGB hex):
- `sun.elevDeg` is degrees above the horizon. `sun.azimDeg` is measured from +Z toward +X:
  `dir = (cos e·sin a, sin e, cos e·cos a)` (`engine/core.js sunDirFromArt`). Example: sun `(.916,.225,.331)` is elev 13°, azim 70°.
- `sun.intensity` is HDR (no tonemapping in three; the post chain tonemaps). Golden hour 7-10, overcast 2-3, night/moon < 1.
- `fog.sigma` is the per-channel extinction per metre. Transmittance over d metres is `exp(-sigma*d)`:
  0.003 leaves 74% at 100 m (clear), 0.01 leaves 37% (hazy), 0.03 leaves 5% (thick fog). **Blue > red** gives warm distance
  (dust, dusk); **red > blue** gives cyan/blue distance (underwater, clear air at noon).
- `fog.scatter` is the in-scatter (haze) colour before sun tint. `sunInscatter` scales the forward-scatter lobe toward the sun.
- `grade.agxMix` blends ACES (punch, burning oranges) toward AgX (highlights roll to white without hue skew). Use ≥0.4 when
  the scene has saturated emissives (neon, lava) so they do not clip to flat primaries.
- `weather.kind` is one of `rain|snow|dust|none`. Ash, marine snow, pollen and sparks all use `dust` (camera-wrapped motes) with a tint set by the weather module.

## Hero-pose rules (apply to every thesis)

Write the 6 poses **before** the world exists, as `[x,y,z, tx,ty,tz]` in `contracts.js`. The world is then dressed around them
(e.g. `makeWorld(POSES, PATH)`, `rel(pose, fwd, right)`, `nearPose()` keep-outs).

| # | Purpose | Rule |
|---|---|---|
| 1 | Establishing vista **into the sun** | Sun 5-20° above frame centre or just outside the top/side edge; volumetric shafts cross ≥1/3 of the frame; 3 depth layers (foreground silhouette < 5 m, midground set piece 15-40 m, far layer in haze). |
| 2 | Gameplay eye at spawn | Exactly the player camera (eye 1.6-1.7 m, game FOV). Must show the objective direction and one readable landmark. |
| 3 | Hero object close-up | Hero (weapon, vehicle, avatar, ship) fills 30-50% of the frame; rim light from the sun behind it; signature surface effect visible on it (rain beads, frost, dust). |
| 4 | Interior or second biome | Different light regime (probe, practicals, colour of fog). Proves the look is not one trick. |
| 5 | Action moment | Actors + FX in frame (muzzle, sparks, splashes, boost, spell). FX must light their surroundings (pooled point light). |
| 6 | **Reverse angle away from the sun** | The usual failure: flat front-lit grey. Needs sky fill (env), rim from practicals, contact AO, and a far layer. Critic scores it as harshly as pose 1. |

Composition rules for all poses:
- Horizon on a third, never centred; tilt the camera 2-6° down for ground-level shots so wet ground/reflections fill the lower third.
- Always one foreground element within 1-5 m, partly cropped by the frame edge (gives scale and parallax).
- One clear focal point brighter or more saturated than its surroundings; leading lines (lanes, rails, pipes, kelp columns) point at it.
- Never frame the world boundary, an empty skybox band, or a flat fogged wall. If a pose sees > 150 m, there must be a far-field layer there.
- Fly path: 30-60 s Catmull-Rom through all six poses with arc-length parametrisation; world generation keeps it clear.

## Thesis index

| id | Thesis | Signature surface | Weather |
|---|---|---|---|
| T1 | Golden-hour rain, industrial | mirror puddles + wet roughness gradient | rain |
| T2 | Neon night, wet city | neon reflections in wet asphalt | light rain |
| T3 | Overcast snow, research station | snow accumulation + frost | snow |
| T4 | Desert dusk haze | wind-rippled sand + long shadows | blowing dust |
| T5 | Underwater god rays | projected caustics | marine snow |
| T6 | Foggy forest dawn | crepuscular shafts through trunks + dew | pollen motes |
| T7 | Volcanic ash dusk | emissive lava cracks under ash | ash fall |
| T8 | Space-station interior with planet light | hard window light + planet bounce | none |
| T9 | Autumn countryside afternoon | foliage colour field + aerial perspective | drifting leaves |
| T10 | Stormy sea | Gerstner swell + spray + lightning | heavy rain |

---

## T1. Golden-hour rain, industrial

**Mood.** A storm is breaking. A low, warm sun at 13° burns through a gap in a slate cloud deck and backlights a wet port of
containers, cranes and sheds. Everything is soaked: the asphalt runs from mirror puddles to damp to dry, walls carry vertical
streaks, beads sit on every up-facing surface. Shafts cut through rain and steam between stacks, and the far city dissolves into
warm haze. The image is teal in the shadows and amber in the highlights, filmic, slightly gritty. 

```js
export const ART_GOLDEN_RAIN = {
  sun:   { elevDeg: 13, azimDeg: 70, color: [1.0, 0.72, 0.42], intensity: 9.0 },
  sky:   { zenith: [0.055, 0.085, 0.13], horizon: [0.95, 0.55, 0.28], groundTint: [0.10, 0.09, 0.08],
           cloudCover: 0.75, cloudSharp: 0.55, sunGlow: 0.9, burnGap: 0.7 },
  fog:   { sigma: [0.0030, 0.0034, 0.0040], scatter: [0.30, 0.33, 0.38], heightFalloff: 0.06, baseHeight: 0.0,
           sunInscatter: 1.0, start: 2.0 },
  vol:   { density: 0.010, g: 0.60, steps: 24, strength: 0.8 },
  ambient: { skyIntensity: 1.6, envIntensity: 2.0 },
  grade: { exposure: 1.0, agxMix: 0.25, lookPower: 1.18, sat: 1.22, contrast: 0.22,
           splitShadow: [0.92, 1.0, 1.08], splitHigh: [1.06, 1.0, 0.92], vignette: 0.30,
           bloom: 0.065, bloomThreshold: 1.2, lensDirt: 0.25, chroma: 0.0013, grain: 0.020, sharpen: 0.30,
           adaptMin: 0.6, adaptMax: 2.0, adaptTau: 1.5 },
  surface: { wet: 0.85, dust: 0.0, snow: 0.0, macroVar: 0.30 },
  weather: { kind: 'rain', amount: 0.7, wind: [1.5, 0, 0.4] },
};
```

- **Palette (sRGB, roles):** burnt sky `#F2A35E`, slate deck `#2B3440`, container rust-red `#7D2219`, hazard yellow `#DEAC1E`, wet asphalt `#1C1D20`, sodium lamp `#FFB347`.
- **Signature surface:** mirror puddles of the burning sky with ripple rings; continuous wet→dry roughness gradient 0.055→0.72.
- **Cookbook:** `cookbook/three/post/pipeline.js`, `cookbook/three/post/shaders.js`, `cookbook/three/lighting/sky.js`, `cookbook/three/lighting/env-from-sky.js`,
  `cookbook/three/lighting/pcss.js`, `cookbook/three/lighting/probes.js` (shed interior), `cookbook/three/materials/bake.js`,
  `cookbook/three/materials/surfaces.glsl.js`, `cookbook/three/materials/weathering.js`, `cookbook/three/ground/ground.js` (mask, puddles, ripples),
  `cookbook/three/ground/planar-reflection.js`, `cookbook/three/lighting/lights.js` (sodium floodlights), `cookbook/three/weather/rain.js`,
  `cookbook/three/weather/lightning.js`, `cookbook/three/water/sea.js` (harbour), `cookbook/three/geo/kit.js`, `cookbook/three/decals/canvas-text.js`.
- **Composition tips:** (1) shoot lanes between stacks straight into the sun so the puddles mirror the burn gap; (2) put a crane or mast silhouette against the brightest cloud to anchor shafts; (3) pose 6 faces the dark side: give it sodium practicals that actually light the ground and a lit skyline card.
- **Avoid:** dry-looking roofs (wetness must hit every material via the patch); one flat grey cloud layer; container colours at full saturation (desaturate 15% and weather them); rain streaks thinner than 0.75 px (they alias).

## T2. Neon night, wet city

**Mood.** Midnight after rain in a dense street canyon. The sky is a low, light-polluted magenta-brown deck; the moon barely
matters. All light is practical: neon tubes, shop windows, signs, sodium and LED street lamps, each one reflected as a long
vertical smear in black wet asphalt. Steam leaks from grates, thin rain glints only where it crosses a light. Deep blacks with
colour in them (never pure black), saturated magenta/cyan accents, soft bloom with lens dirt.

```js
export const ART_NEON_NIGHT = {
  sun:   { elevDeg: 35, azimDeg: 300, color: [0.55, 0.65, 1.0], intensity: 0.35 },
  sky:   { zenith: [0.002, 0.003, 0.006], horizon: [0.030, 0.018, 0.036], groundTint: [0.01, 0.01, 0.012],
           cloudCover: 0.9, cloudSharp: 0.3, sunGlow: 0.2, burnGap: 0.0 },
  fog:   { sigma: [0.012, 0.011, 0.010], scatter: [0.020, 0.012, 0.028], heightFalloff: 0.04, baseHeight: 0.0,
           sunInscatter: 0.2, start: 1.0 },
  vol:   { density: 0.030, g: 0.50, steps: 20, strength: 0.6 },
  ambient: { skyIntensity: 0.4, envIntensity: 0.6 },
  grade: { exposure: 1.0, agxMix: 0.45, lookPower: 1.10, sat: 1.15, contrast: 0.20,
           splitShadow: [0.90, 0.98, 1.12], splitHigh: [1.08, 0.96, 1.02], vignette: 0.35,
           bloom: 0.09, bloomThreshold: 1.0, lensDirt: 0.5, chroma: 0.0020, grain: 0.030, sharpen: 0.20,
           adaptMin: 0.8, adaptMax: 1.6, adaptTau: 1.2 },
  surface: { wet: 1.0, dust: 0.0, snow: 0.0, macroVar: 0.30 },
  weather: { kind: 'rain', amount: 0.5, wind: [0.6, 0, 0.2] },
};
```

- **Palette:** neon magenta `#FF2E88`, neon cyan `#18E0FF`, sodium `#FF9A3C`, LED white `#E8F0FF`, asphalt `#0B0C10`, shadow plum `#1A0F1E`.
- **Signature surface:** neon reflections (planar reflection on the street at ≥0.5 res; emissive signs must be in the reflection layer).
- **Cookbook:** `cookbook/three/post/pipeline.js`, `cookbook/three/lighting/sky.js`, `cookbook/three/lighting/env-from-sky.js`, `cookbook/three/lighting/probes.js` (bake a probe per block so reflections carry neon), `cookbook/three/materials/bake.js`, `cookbook/three/materials/weathering.js`, `cookbook/three/ground/ground.js`, `cookbook/three/ground/planar-reflection.js`, `cookbook/three/weather/rain.js`, `cookbook/three/decals/canvas-text.js` (signage, emissive), `cookbook/three/lighting/lights.js` (lights + ground light pools for the signs), `cookbook/three/fx/billboards.js` (steam), `cookbook/three/geo/kit.js`.
- **Composition tips:** (1) one-point perspective down the street with signs stacked on both walls; (2) keep a dark negative space (alley, overpass) next to the brightest sign so bloom reads; (3) foreground puddle within 2 m holding the biggest sign's reflection.
- **Avoid:** lighting the street with the "moon" (raise sun intensity and it becomes a day scene); signs that glow but cast nothing: put a pooled point/rect-ish light in front of the biggest 4-6 signs, and bake colour cards on the ground for the rest; pure black sky (banding plus no silhouette); bloom threshold < 0.8 (whole frame goes milky).

## T3. Overcast snow, research station

**Mood.** Flat white light under a full overcast, wind-driven snow, a cluster of prefab modules, antenna masts and fuel tanks on
an ice shelf. Shapes dissolve into the whiteout at 60-100 m. Warmth comes only from windows and work lights (sodium orange
against blue-grey). Low contrast, slightly desaturated, cool shadows; the snow must never clip to pure white.

```js
export const ART_SNOW_STATION = {
  sun:   { elevDeg: 18, azimDeg: 160, color: [0.95, 0.97, 1.0], intensity: 2.5 },
  sky:   { zenith: [0.34, 0.38, 0.44], horizon: [0.62, 0.66, 0.70], groundTint: [0.55, 0.57, 0.60],
           cloudCover: 0.98, cloudSharp: 0.15, sunGlow: 0.35, burnGap: 0.1 },
  fog:   { sigma: [0.020, 0.019, 0.017], scatter: [0.68, 0.72, 0.78], heightFalloff: 0.05, baseHeight: 0.0,
           sunInscatter: 0.3, start: 3.0 },
  vol:   { density: 0.010, g: 0.30, steps: 12, strength: 0.3 },
  ambient: { skyIntensity: 2.4, envIntensity: 2.2 },
  grade: { exposure: 0.9, agxMix: 0.50, lookPower: 1.05, sat: 0.90, contrast: 0.14,
           splitShadow: [0.94, 1.0, 1.08], splitHigh: [1.02, 1.0, 0.98], vignette: 0.25,
           bloom: 0.04, bloomThreshold: 1.5, lensDirt: 0.15, chroma: 0.0010, grain: 0.025, sharpen: 0.30,
           adaptMin: 0.5, adaptMax: 1.5, adaptTau: 2.0 },
  surface: { wet: 0.1, dust: 0.0, snow: 0.8, macroVar: 0.20 },
  weather: { kind: 'snow', amount: 0.6, wind: [3.0, 0, 1.0] },
};
```

- **Palette:** snow `#D9DFE6` (never `#FFFFFF`), shadow blue `#7C8A9C`, module orange `#D4561E`, sodium window `#FFB060`, steel `#5A6068`, ice `#A8C4D6`.
- **Signature surface:** snow accumulation on up-facing faces (`surface.snow` in the weathering patch: N.y mask + noise edge + windward bias), drifts against walls (geometry), frost on glass.
- **Cookbook:** `cookbook/three/post/pipeline.js`, `cookbook/three/lighting/sky.js`, `cookbook/three/lighting/env-from-sky.js`, `cookbook/three/lighting/pcss.js`, `cookbook/three/lighting/probes.js` (module interiors), `cookbook/three/materials/bake.js`, `cookbook/three/materials/surfaces.glsl.js` (snow, ice, painted-metal, galvanised), `cookbook/three/materials/weathering.js`, `cookbook/three/weather/snow.js`, `cookbook/three/geo/kit.js`, `cookbook/three/geo/sdf-terrain.js` (drifts, ice ridges), `cookbook/three/decals/canvas-text.js`.
- **Composition tips:** (1) frame a lit window or work light as the warm focal point against blue-grey; (2) use masts and cables as dark verticals that fade into the whiteout at 3 distances; (3) low camera with snow blowing across frame toward the lens for depth.
- **Avoid:** blown-out snow (adaptation must meter the bright ground: keep `adaptMin` ≤ 0.5); sharp, strong sun shadows (contradicts overcast; keep `intensity` ≤ 3); uniform snow with no AO in corners (add contact AO and dirty snow near doors/tracks); snowflakes as square sprites.

## T4. Desert dusk haze

**Mood.** The sun is 6° above a dune horizon, huge and orange, throwing 20 m shadows across wind-rippled sand. The air is full of
fine dust that turns distance warm and flattens far ridges into layered silhouettes. Rusted wrecks, a ruined outpost, power
pylons marching to the horizon. Hot highlights, cool violet shadows from the clear zenith.

```js
export const ART_DESERT_DUSK = {
  sun:   { elevDeg: 6, azimDeg: 250, color: [1.0, 0.55, 0.28], intensity: 7.0 },
  sky:   { zenith: [0.10, 0.13, 0.22], horizon: [1.0, 0.58, 0.32], groundTint: [0.45, 0.30, 0.18],
           cloudCover: 0.15, cloudSharp: 0.7, sunGlow: 1.5, burnGap: 0.0 },
  fog:   { sigma: [0.006, 0.008, 0.012], scatter: [0.85, 0.60, 0.40], heightFalloff: 0.03, baseHeight: 0.0,
           sunInscatter: 1.6, start: 5.0 },
  vol:   { density: 0.012, g: 0.70, steps: 20, strength: 0.8 },
  ambient: { skyIntensity: 1.2, envIntensity: 1.5 },
  grade: { exposure: 1.0, agxMix: 0.20, lookPower: 1.20, sat: 1.15, contrast: 0.20,
           splitShadow: [0.90, 0.98, 1.10], splitHigh: [1.08, 1.0, 0.88], vignette: 0.30,
           bloom: 0.06, bloomThreshold: 1.3, lensDirt: 0.3, chroma: 0.0015, grain: 0.020, sharpen: 0.25,
           adaptMin: 0.6, adaptMax: 1.8, adaptTau: 1.5 },
  surface: { wet: 0.0, dust: 0.7, snow: 0.0, macroVar: 0.35 },
  weather: { kind: 'dust', amount: 0.4, wind: [4.0, 0, -1.0] },
};
```

- **Palette:** sun disc `#FFB15C`, sand lit `#D99A5B`, sand shadow `#6E5A78`, rust `#8A3B17`, bleached metal `#B8A894`, sky top `#3A4A6E`.
- **Signature surface:** wind ripples in sand (normal-only detail, faded with `fwidth` past ~30 m) and dust settled on up-facing faces of props (`surface.dust`).
- **Cookbook:** `cookbook/three/post/pipeline.js`, `cookbook/three/post/shaders.js`, `cookbook/three/lighting/sky.js`, `cookbook/three/lighting/env-from-sky.js`, `cookbook/three/lighting/pcss.js`, `cookbook/three/materials/bake.js`, `cookbook/three/materials/surfaces.glsl.js` (sand, rock, rust), `cookbook/three/materials/weathering.js`, `cookbook/three/geo/sdf-terrain.js`, `cookbook/three/geo/surface-nets.js`, `cookbook/three/geo/scatter.js`, `cookbook/three/weather/dust.js`.
- **Composition tips:** (1) side-light (sun 60-100° off the view axis) to rake ripples and stretch shadows across the frame; (2) pylons or a road as a leading line into the haze with 3+ ridge layers; (3) put a wreck silhouette against the sun disc for pose 1.
- **Avoid:** flat uniform orange (the zenith must stay blue-violet so shadows separate); ripple moire at distance; a terrain edge visible on the horizon (extend with low-poly ridges fogged at 300-600 m); sand that looks like orange plastic (roughness ≥ 0.85, no specular hotspot).

## T5. Underwater god rays

**Mood.** 10-30 m down in a kelp canyon. A rippling silver surface overhead shows Snell's window; caustics crawl over rock;
broad god rays fan down through kelp and fall off with depth. Cyan near the surface, deep blue with distance, red absorbed
first. Life everywhere: schools, mantas, bubbles, drifting marine snow. Soft contrast, ACES only, gentle vignette.

```js
export const ART_UNDERWATER = {
  sun:   { elevDeg: 70, azimDeg: 30, color: [1.0, 0.94, 0.85], intensity: 4.0 },
  sky:   { zenith: [0.55, 0.85, 1.0], horizon: [0.16, 0.58, 0.90], groundTint: [0.02, 0.06, 0.10],
           cloudCover: 0.0, cloudSharp: 0.0, sunGlow: 1.0, burnGap: 0.0 },
  fog:   { sigma: [0.058, 0.0235, 0.0195], scatter: [0.16, 0.58, 0.90], heightFalloff: 0.0, baseHeight: 0.0,
           sunInscatter: 1.4, start: 0.0 },
  vol:   { density: 0.035, g: 0.75, steps: 34, strength: 1.4 },
  ambient: { skyIntensity: 1.4, envIntensity: 1.0 },
  grade: { exposure: 1.1, agxMix: 0.0, lookPower: 1.0, sat: 0.93, contrast: 0.25,
           splitShadow: [0.95, 1.0, 1.05], splitHigh: [1.03, 1.0, 0.97], vignette: 0.55,
           bloom: 0.06, bloomThreshold: 1.0, lensDirt: 0.0, chroma: 0.0, grain: 0.015, sharpen: 0.15,
           adaptMin: 0.7, adaptMax: 1.6, adaptTau: 2.0 },
  surface: { wet: 0.0, dust: 0.0, snow: 0.0, macroVar: 0.30 },
  weather: { kind: 'dust', amount: 0.5, wind: [0.2, 0.05, 0.1] },
};
```

Constants are adapted from MIT-licensed code, Copyright (c) 2026 Maksymilian Dendura (see THIRD_PARTY_NOTICES.md): `SIG=(.058,.0235,.0195)`, `WCOL=(.16,.58,.90)`, `SUNC=(1.7,1.6,1.45)` (here split into
colour × intensity), vignette 0.55, ACES (agxMix 0), 7% desaturation. The original also darkens sunlight with depth
(`KD=(.056,.0245,.017)`, `sunE(y)=SUNC*exp(KD*y/sun.y)`); the schema has no slot for it, so the game's water module applies it to `G.sun.intensity`
per frame from camera depth. `heightFalloff: 0` keeps the medium uniform; `baseHeight` is unused here.

- **Palette:** surface cyan `#2A94E6`, deep blue `#0A2A55`, kelp gold `#C9A640`, coral magenta `#C2408E`, sand `#8FA3A0`, ray white `#E6F7FF`.
- **Signature surface:** projected caustics (512² iterated sin/cos warp texture, projected along the sun `p.xz - sun.xz*p.y/sun.y`, RGB offsets, faded to a constant 0.33 beyond 35-100 m): `cookbook/three/water/caustics.js` (`createCaustics` + `patchCaustics`).
- **Cookbook:** `cookbook/three/post/pipeline.js`, `cookbook/three/post/shaders.js` (34 steps, phase `.2+2μ³`), `cookbook/three/lighting/sky.js` (as the surface/Snell window), `cookbook/three/lighting/env-from-sky.js`, `cookbook/three/geo/sdf-terrain.js`, `cookbook/three/geo/surface-nets.js`, `cookbook/three/geo/scatter.js`, `cookbook/three/materials/bake.js`, `cookbook/three/weather/dust.js` (marine snow), `cookbook/three/water/sea.js` (surface from below).
- **Composition tips:** (1) look up 20-35° toward the surface so the ray fan and Snell window frame the subject; (2) silhouette a set piece (wreck, sculpture, whale) at 25-40 m in the blue, not closer; (3) hand-place kelp columns as frame edges (~45 around the poses works).
- **Avoid:** a visible basin wall meeting the surface along a straight seam (fix: dip the ring wall below fog distance and add a far background quad with the same fog); featureless surface up close; plastic sponges (add translucency and fbm colour variation); fog that is a single colour (red must die first).

## T6. Foggy forest dawn

**Mood.** Ten minutes after sunrise in a conifer and birch forest. Low valley fog pools in the hollows; the sun at 8° punches
crepuscular shafts between trunks, every shaft full of drifting pollen. Dew on ferns and moss glints. Cool blue-green shade,
warm gold light, soft wrap of fog that hides everything past 60 m in layered trunk silhouettes.

```js
export const ART_FOREST_DAWN = {
  sun:   { elevDeg: 8, azimDeg: 95, color: [1.0, 0.78, 0.55], intensity: 5.0 },
  sky:   { zenith: [0.20, 0.27, 0.38], horizon: [0.85, 0.70, 0.55], groundTint: [0.12, 0.14, 0.08],
           cloudCover: 0.35, cloudSharp: 0.4, sunGlow: 1.1, burnGap: 0.3 },
  fog:   { sigma: [0.030, 0.030, 0.032], scatter: [0.55, 0.54, 0.50], heightFalloff: 0.12, baseHeight: 0.0,
           sunInscatter: 1.3, start: 1.5 },
  vol:   { density: 0.045, g: 0.70, steps: 24, strength: 1.3 },
  ambient: { skyIntensity: 1.4, envIntensity: 1.4 },
  grade: { exposure: 1.05, agxMix: 0.35, lookPower: 1.12, sat: 1.05, contrast: 0.16,
           splitShadow: [0.92, 1.02, 1.04], splitHigh: [1.06, 1.01, 0.92], vignette: 0.30,
           bloom: 0.07, bloomThreshold: 1.1, lensDirt: 0.2, chroma: 0.0010, grain: 0.025, sharpen: 0.25,
           adaptMin: 0.6, adaptMax: 2.2, adaptTau: 1.8 },
  surface: { wet: 0.35, dust: 0.0, snow: 0.0, macroVar: 0.35 },
  weather: { kind: 'dust', amount: 0.3, wind: [0.4, 0.05, 0.2] },
};
```

- **Palette:** sun gold `#FFC27A`, fog `#9EA6A0`, moss `#4E6A2E`, birch bark `#D8D2C4`, conifer shade `#1E2E28`, fern lit `#8FB04A`.
- **Signature surface:** volumetric shafts through trunks (vol strength 1.3) plus dew: low `surface.wet` gives a sheen on up-facing leaves without puddles.
- **Cookbook:** `cookbook/three/post/pipeline.js`, `cookbook/three/post/shaders.js`, `cookbook/three/lighting/sky.js`, `cookbook/three/lighting/env-from-sky.js`, `cookbook/three/lighting/pcss.js`, `cookbook/three/geo/scatter.js` (trunks, ferns, rocks), `cookbook/three/geo/sdf-terrain.js`, `cookbook/three/materials/bake.js` (bark, foliage, rock), `cookbook/three/materials/weathering.js`, `cookbook/three/weather/dust.js`.
- **Composition tips:** (1) shoot into the sun so every trunk throws a shaft toward the lens; (2) stack trunk silhouettes at 10/25/50 m so fog grades them; (3) a path or stream as the lit leading line.
- **Avoid:** trunks as identical cylinders (vary radius, lean, bark tint; add root flare); foliage cards that shimmer (alpha-to-coverage or dithered alpha with `fwidth` AA, min-size fade); fog thick enough to kill the far layers completely (keep ≥ 5% transmittance at 100 m).

## T7. Volcanic ash dusk

**Mood.** A black basalt landscape under an ash-choked sky; the sun is a dim red disc at 4°, and the real light comes from
below: lava rivers and glowing cracks that light the undersides of rocks and the ash plume. Ash falls like dirty snow. Near-
black values with hot orange accents and heavy, smoky atmosphere. Embers drift upward over the lava.

```js
export const ART_VOLCANIC_ASH = {
  sun:   { elevDeg: 4, azimDeg: 240, color: [1.0, 0.42, 0.18], intensity: 2.5 },
  sky:   { zenith: [0.03, 0.025, 0.03], horizon: [0.55, 0.20, 0.08], groundTint: [0.05, 0.035, 0.03],
           cloudCover: 0.95, cloudSharp: 0.6, sunGlow: 0.9, burnGap: 0.4 },
  fog:   { sigma: [0.012, 0.014, 0.016], scatter: [0.10, 0.055, 0.040], heightFalloff: 0.05, baseHeight: 0.0,
           sunInscatter: 1.0, start: 2.0 },
  vol:   { density: 0.025, g: 0.55, steps: 20, strength: 0.8 },
  ambient: { skyIntensity: 0.5, envIntensity: 0.6 },
  grade: { exposure: 1.0, agxMix: 0.40, lookPower: 1.15, sat: 1.10, contrast: 0.24,
           splitShadow: [0.95, 0.98, 1.06], splitHigh: [1.10, 0.98, 0.85], vignette: 0.38,
           bloom: 0.09, bloomThreshold: 1.4, lensDirt: 0.35, chroma: 0.0018, grain: 0.030, sharpen: 0.25,
           adaptMin: 0.7, adaptMax: 1.5, adaptTau: 1.5 },
  surface: { wet: 0.0, dust: 0.5, snow: 0.0, macroVar: 0.40 },
  weather: { kind: 'dust', amount: 0.7, wind: [2.0, -0.3, 1.0] },
};
```

- **Palette:** lava core `#FFD27A`, lava edge `#E2481A`, cooled crust `#2A1A16`, basalt `#1B1A1C`, ash `#6E6762`, plume lit `#8A3A1E`.
- **Signature surface:** emissive lava cracks (emissive mask from Voronoi edges, HDR 4-20, cooling gradient) under an ash layer (`surface.dust`), and the lava must light the scene: pooled point lights along the rivers + a lava-coloured ground-bounce term.
- **Cookbook:** `cookbook/three/post/pipeline.js`, `cookbook/three/post/shaders.js`, `cookbook/three/lighting/sky.js`, `cookbook/three/lighting/env-from-sky.js`, `cookbook/three/geo/sdf-terrain.js`, `cookbook/three/geo/surface-nets.js`, `cookbook/three/materials/bake.js`, `cookbook/three/materials/surfaces.glsl.js` (rock, emissive-panel adapted to lava), `cookbook/three/materials/weathering.js`, `cookbook/three/weather/dust.js` (ash; second instance tinted orange rising = embers), `cookbook/three/fx/billboards.js`, `cookbook/three/fx/streaks.js`, `cookbook/three/lighting/lights.js` (lava glow lights).
- **Composition tips:** (1) put a lava river on a diagonal as the leading light line; (2) backlight a rock arch with lava so its underside glows; (3) the plume as a dark mass against the red horizon in pose 1.
- **Avoid:** crushed blacks with no detail (lift shadows slightly through `splitShadow`, use AO not black); lava as flat orange without heat gradient; bloom halos around every crack (threshold ≥ 1.4); grey ash fog that kills all colour.

## T8. Space-station interior with exterior planet light

**Mood.** Inside a ring station orbiting a blue-white planet. Hard, colourless starlight blasts through windows in sharp
shafts across dust in the air; the planet fills the windows and bounces cool blue light into corridors. Interiors are lit by
practical panels and status lights. Clean, high-contrast, slightly cold, with warm amber safety lights as accents.

```js
export const ART_SPACE_STATION = {
  sun:   { elevDeg: 20, azimDeg: 120, color: [1.0, 0.96, 0.9], intensity: 8.0 },
  sky:   { zenith: [0.0005, 0.0006, 0.001], horizon: [0.10, 0.18, 0.32], groundTint: [0.18, 0.24, 0.34],
           cloudCover: 0.0, cloudSharp: 0.0, sunGlow: 0.25, burnGap: 0.0 },
  fog:   { sigma: [0.003, 0.003, 0.0034], scatter: [0.03, 0.035, 0.045], heightFalloff: 0.0, baseHeight: 0.0,
           sunInscatter: 0.8, start: 1.0 },
  vol:   { density: 0.012, g: 0.65, steps: 20, strength: 0.6 },
  ambient: { skyIntensity: 0.5, envIntensity: 1.2 },
  grade: { exposure: 1.0, agxMix: 0.50, lookPower: 1.10, sat: 1.0, contrast: 0.22,
           splitShadow: [0.92, 0.98, 1.10], splitHigh: [1.04, 1.0, 0.96], vignette: 0.32,
           bloom: 0.07, bloomThreshold: 1.2, lensDirt: 0.5, chroma: 0.0015, grain: 0.020, sharpen: 0.30,
           adaptMin: 0.5, adaptMax: 1.6, adaptTau: 1.0 },
  surface: { wet: 0.0, dust: 0.15, snow: 0.0, macroVar: 0.20 },
  weather: { kind: 'none', amount: 0.0, wind: [0, 0, 0] },
};
```

Space has no air: add `fogged: false` to `sky` above (`ART.sky.fogged`; `lighting/sky.js` then skips the shared fog on the sky, which it otherwise evaluates to `ART.sky.fogFar`, default 3000 m), or the shared fog turns black space into a grey wall. Geometry inside the station keeps the fog, so the dust in the window shafts still reads. Keep `fog.scatter` near black so the dust only shows inside the window shafts.

- **Palette:** starlight `#FFF6E8`, planet blue `#5A8AD0`, panel white `#C8CED6`, hull grey `#3A3F46`, safety amber `#FFAA2A`, status red `#E23A3A`.
- **Signature surface:** hard window shafts across brushed/painted panels, plus the planet as a huge emissive card outside (sky shader: `horizon`/`groundTint` give the limb and bounce; render the planet itself as a sphere with its own atmosphere rim).
- **Cookbook:** `cookbook/three/post/pipeline.js`, `cookbook/three/post/shaders.js`, `cookbook/three/lighting/sky.js`, `cookbook/three/lighting/env-from-sky.js`, `cookbook/three/lighting/probes.js` (one probe per room: the planet bounce lives here), `cookbook/three/lighting/pcss.js`, `cookbook/three/materials/bake.js`, `cookbook/three/materials/surfaces.glsl.js` (painted-metal, galvanised, plastic, rubber, emissive-panel), `cookbook/three/geo/kit.js`, `cookbook/three/decals/canvas-text.js` (deck numbers, warnings), `cookbook/three/lighting/lights.js` (panel and safety practicals).
- **Composition tips:** (1) a corridor with a window bay so a shaft crosses the floor diagonally; (2) the planet limb in the upper third of a big window as the pose-1 vista; (3) amber practicals as rhythm down corridors (they must light the floor).
- **Avoid:** an interior lit only by the env (flat): practicals are mandatory; space with a stars-only black sky in view of the camera (banding, NaN-looking black: add faint nebula and dither); `fog.sigma` so high the station looks foggy (dust only shows in shafts); everything grey: give each zone one accent colour.

## T9. Autumn countryside afternoon

**Mood.** Mid-afternoon in late October: a clear sky with a few cumulus, a warm sun at 28°, rolling hills of stubble fields,
hedgerows and woods in orange, red and yellow, a village and church spire in the middle distance, blue aerial perspective on
the far ridges. Crisp air, high saturation in the foliage, long-ish soft shadows. Leaves drift across roads.

```js
export const ART_AUTUMN_COUNTRY = {
  sun:   { elevDeg: 28, azimDeg: 220, color: [1.0, 0.86, 0.66], intensity: 7.5 },
  sky:   { zenith: [0.12, 0.24, 0.48], horizon: [0.70, 0.72, 0.75], groundTint: [0.22, 0.16, 0.08],
           cloudCover: 0.4, cloudSharp: 0.65, sunGlow: 0.8, burnGap: 0.2 },
  fog:   { sigma: [0.0025, 0.0032, 0.0045], scatter: [0.55, 0.62, 0.75], heightFalloff: 0.02, baseHeight: 0.0,
           sunInscatter: 0.8, start: 10.0 },
  vol:   { density: 0.008, g: 0.60, steps: 16, strength: 0.6 },
  ambient: { skyIntensity: 1.6, envIntensity: 1.6 },
  grade: { exposure: 1.0, agxMix: 0.25, lookPower: 1.15, sat: 1.20, contrast: 0.18,
           splitShadow: [0.94, 0.98, 1.06], splitHigh: [1.06, 1.0, 0.90], vignette: 0.25,
           bloom: 0.05, bloomThreshold: 1.4, lensDirt: 0.1, chroma: 0.0010, grain: 0.018, sharpen: 0.25,
           adaptMin: 0.6, adaptMax: 1.8, adaptTau: 1.5 },
  surface: { wet: 0.1, dust: 0.15, snow: 0.0, macroVar: 0.40 },
  weather: { kind: 'dust', amount: 0.2, wind: [2.0, 0, 1.0] },
};
```

- **Palette:** maple red `#B8321E`, birch yellow `#E0A82A`, oak brown `#7A4A1E`, stubble `#C8A868`, hedge green `#3E5A26`, far ridge blue `#7E96B8`.
- **Signature surface:** foliage colour field with per-instance hue variation + aerial perspective (blue-shifted far layers); the drifting leaves are an instanced fx layer using `weather.kind: 'dust'` motion with leaf sprites.
- **Cookbook:** `cookbook/three/post/pipeline.js`, `cookbook/three/lighting/sky.js`, `cookbook/three/lighting/env-from-sky.js`, `cookbook/three/lighting/pcss.js`, `cookbook/three/geo/sdf-terrain.js`, `cookbook/three/geo/scatter.js`, `cookbook/three/geo/kit.js`, `cookbook/three/materials/bake.js` (foliage, wood, rock, asphalt), `cookbook/three/materials/weathering.js`, `cookbook/three/weather/dust.js`, `cookbook/three/decals/canvas-text.js` (road signs).
- **Composition tips:** (1) a road or hedgerow S-curve leading to the spire; (2) a single tree in the foreground third, backlit so its leaves glow (translucency); (3) three hill layers fading blue.
- **Avoid:** every tree the same orange (mix 4-5 species hues plus 20% green); visible tiling on fields (macroVar ≥ 0.35, field patches as separate polygons); a hard terrain edge (this thesis sees far: needs ≥ 3 far-field layers and the fog scatter matched in the sky horizon).

## T10. Stormy sea

**Mood.** A full gale on open water at dusk. Dark green-grey swells 4-8 m high with wind-torn whitecaps and streaks of foam,
spray blowing off the crests, rain lashing horizontally. A thin band of light breaks under the cloud deck at the horizon;
lightning periodically flash-lights everything. Desaturated, high contrast, cold, with the one warm band of light and a
ship's lamps as the only warmth.

```js
export const ART_STORMY_SEA = {
  sun:   { elevDeg: 9, azimDeg: 60, color: [0.95, 0.85, 0.75], intensity: 3.0 },
  sky:   { zenith: [0.06, 0.07, 0.08], horizon: [0.30, 0.33, 0.36], groundTint: [0.04, 0.06, 0.07],
           cloudCover: 0.95, cloudSharp: 0.45, sunGlow: 0.7, burnGap: 0.45 },
  fog:   { sigma: [0.010, 0.010, 0.011], scatter: [0.34, 0.38, 0.42], heightFalloff: 0.04, baseHeight: 0.0,
           sunInscatter: 0.7, start: 3.0 },
  vol:   { density: 0.020, g: 0.55, steps: 16, strength: 0.7 },
  ambient: { skyIntensity: 1.4, envIntensity: 1.6 },
  grade: { exposure: 1.05, agxMix: 0.40, lookPower: 1.10, sat: 0.85, contrast: 0.26,
           splitShadow: [0.92, 1.0, 1.08], splitHigh: [1.03, 1.0, 0.96], vignette: 0.35,
           bloom: 0.05, bloomThreshold: 1.5, lensDirt: 0.5, chroma: 0.0015, grain: 0.030, sharpen: 0.25,
           adaptMin: 0.6, adaptMax: 2.0, adaptTau: 1.2 },
  surface: { wet: 1.0, dust: 0.0, snow: 0.0, macroVar: 0.25 },
  weather: { kind: 'rain', amount: 0.9, wind: [8.0, 0, 3.0] },
};
```

- **Palette:** swell body `#24343A`, foam `#C8D0D2`, horizon break `#D8B890`, storm deck `#1A1E22`, ship lamp `#FFB45A`, lightning `#E6EEFF`.
- **Signature surface:** Gerstner swell (4-6 waves, steepness ≤ 0.7 summed, ω=√(gk)) with foam from the Jacobian/crest height, sun glitter only in the horizon break, and spray particles off crests.
- **Cookbook:** `cookbook/three/post/pipeline.js`, `cookbook/three/lighting/sky.js`, `cookbook/three/lighting/env-from-sky.js`, `cookbook/three/water/sea.js`, `cookbook/three/weather/rain.js`, `cookbook/three/weather/lightning.js`, `cookbook/three/fx/billboards.js` (spray), `cookbook/three/materials/weathering.js`, `cookbook/three/geo/kit.js` (ship), `cookbook/three/decals/canvas-text.js` (hull name).
- **Composition tips:** (1) camera low near the water, a swell crest filling the lower third and blocking part of the horizon; (2) the horizon light band behind the ship silhouette; (3) a lightning flash pose (pose 5) with the deck lit from above.
- **Avoid:** visibly tiling normals (fix: add a second detail normal at an incommensurate scale and rotate it, fade with distance); flat-shaded sea with no subsurface (add a green-teal transmittance term on wave backs facing the sun); a mirror-smooth far sea (roughness up with distance); a sea plane ending at the horizon (extend to ≥ 900 m with graded density).

---

## Rules that hold across all theses

1. One dominant light. Practical lights exist to light surfaces near them, not to decorate.
2. Every material shares the weathering patch and fog; nothing is exempt (decals, particles, the hero object, the far field).
3. Sky, env (PMREM), fog and far-field cards use the same colours; change one, re-capture all six poses.
4. Saturation lives in a few accents. If the whole frame is saturated, nothing is.
5. Do not chase the critic by adding effects; fix the defect class it names (`defect-catalogue.md`).

## Checking a thesis before look-lock

All ten objects were rendered on a neutral graybox (bevelled container stacks, pylons, far ring of blocks) through the real
cookbook sky, env, atmos, PCSS, practical light and post chain, into the sun and away from it, with zero errors, during
development (that check page is not included here). After editing any constant, check it the same way on the game's own
graybox capture: it shows exposure, haze density and sun/sky balance only. Materials, wetness and practicals change the final read a lot (T2 and T7 look nearly black
on the graybox by design: their light comes from neon and lava). T8 is an interior thesis; its outdoor card shows a bright
star aureole that windows must frame, not a finished look.
