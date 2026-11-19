# WHITEOUT — art direction

**Thesis:** T3 "Overcast snow, research station" (The Thing / Frostpunk), adapted to **dusk in a rising blizzard**.
The last dusk light bleeds through a full overcast low in the WSW (elev 7°, azim 255°): a warm, smeared glow, never a hard
disc. Everything else is blue-grey whiteout. Shapes dissolve at 60-90 m; in gusts at 35 m. Warmth comes only from sodium
windows, work lights and (once powered) the red beacon. Horror reads through silhouettes, not crushed black: the ambient
floor stays readable (sky env fill + grain), the flashlight is the one hard light the player owns.

Constants: `src/art.js` (`ART`, `PALETTE`). Change one knob per critic round.

## Palette (sRGB; snow never pure white)
| Role | Hex | Use |
|---|---|---|
| Snow | `#D9DFE6` | ground, accumulation, drifts |
| Shadow blue | `#7C8A9C` | snow in shade, fog body |
| Module orange | `#D4561E` | prefab module paint, generator housings (the only saturated mass) |
| Sodium window | `#FFB060` | windows, work lights (warm focal points) |
| Steel | `#5A6068` | masts, skids, tower lattice, tanks |
| Ice | `#A8C4D6` | frost on glass and panels, pressure ridges |
| Beacon red | `#FF2A1A` | aviation/beacon lamps (small, emissive, bloom) |
| Fluorescent | `#DFE8FF` | lab interior, failing tube (flicker) |
| Stalker | `#1A1C20` | creature: near-black, wet sheen rim, only seen in fragments |

## Signature surface
Snow accumulation on every up-facing face (`ART.surface.snow` → `uSnow`, weathering patch: N.y mask + noise edge +
windward bias), wind drifts piled against walls (geometry), frost creeping in from glass edges and generator panels.
Dirty, trampled snow near doors and along the spawn path.

## Lighting rules
- One dominant light: the dusk sky (env) + soft sun at ×3. No hemisphere/ambient lights.
- Practicals must light surfaces: window spill pools on the snow, work-light pools, the lab fluorescent, generator panel lamps.
- The flashlight is a shadow-casting spot (the hero light): motes and flakes glint in it.
- Exposure is a dusk exposure: `grade.adaptKey` 0.135 (scene key, wired into createPost), adaptMin 0.25 / adaptMax 1.2
  (bright whiteout cannot push the exposure up, dark interiors cannot lift to day), AgX mix 0.5.
- Sky reads in two layers: fog `heightFalloff` 0.08 thins the haze aloft so the dark slate deck (zenith 0.09/0.11/0.16)
  with its warm-lit underside shows above ~15°, while the ground layer still dissolves shapes at 60-90 m.
- The dusk glow is the fog's sun lobe, not the sun disc: `fog.sunInscatter` 2.2 with an amber sun `[1.0, 0.56, 0.30]`;
  the disc is a dim smear (`sky.diskRadiance` 6).
- Fog/horizon colour is cool slate-blue `[0.36, 0.43, 0.53]` (sky.horizon matches) so warm + cool never mixes to lavender.
- Env fill 2.2 keeps the snow brighter than the module walls and gives pose 6 (away from the sun) its fill.
- Shafts: post `volShaft` 1.5 (`ART.vol.shaft`) deepens the shadow volumes in the haze behind masts and modules.
- Grade: contrast 0.24, look power 1.18, sat 0.92, split tone teal shadows `[0.86,0.97,1.14]` / amber highs `[1.08,1.0,0.90]`.
- Lab: probe intensity 0.6 (`ART.ambient.probeIntensity`); frosted lab windows emit dusk blue `[0.16,0.26,0.46]`.
- Fog `heightFalloff` 0.13 (round 2): the ground layer still swallows the station at 60-90 m, but the far ice ridges
  (terrain far-field rings) now break through the haze above it, so the distance is never an empty plane.
- Snow bounce (`ART.ambient.bounce` `[0.55,0.58,0.66]`, look/materials.js `bounce` patch on every exterior material):
  down- and side-facing faces near the shelf are relit by the snow, so lean-to roofs, undersides and pose 6 keep shape.
- Practicals (look/practicals.js): the lab tube is STEADY and stutters only in rare 0.8 s bursts every 9-17 s (never a
  frame-to-frame change on a static view; no bursts under `?shot=1`); a caged wall lamp under each generator lean-to
  (real for A and C, fake pool for B); every fake pool sits on the drifted snow with snow albedo 0.8, window spill ×2.6.
- Post extras (`ART.post`, look/post.js): `volShaft` 1.5, AO radius 1.1 m / intensity 3.2 for contact grounding.

## Materials (look/materials.js, look/surfaces.js)
- **Ground** = `snow_crust` (matte compacted snow, roughness ~0.9, no metre-scale ripples) + `snowgnd` world patch:
  broad drifts + sastrugi stretched along `ART.weather.wind` (never tiles), map normal faded 4-38 m (no horizon moire),
  macro albedo, blue hollows, sparse distance-faded sun glints. `userData.noWeather`: the weathering snow layer must
  never stack on the ground (its noise normals were the round-1 "lake ripple" under the grazing sun).
- **Exterior paint** = `module_paint`: chips clustered in a few worn zones, broad soft dirt, faint vertical runs.
- **Lab** = `lab_panel` walls/ceiling (vinyl panels, 1.2 m seams), `lab_coat` floor/benches (powder coat / sheet vinyl,
  no zinc-spangle cells) + `labwear` world patch: grime clustered at floor contact and room corners, ceiling-edge soot,
  dirt along the skirting, a polished (lower roughness) wear path down the aisle.

## Hero shot list (src/contracts.js POSES)
1. **Vista into the dusk** — from the east ridge over the station roofs toward the beacon tower silhouetted against the
   sun glow; foreground antenna mast + drums within 4 m; midground hab/lab roofs at 20-40 m; tower + far ridges in haze.
2. **Spawn** — eye height at the vehicle-shed door; the lit hab windows and the path between modules lead west to the tower.
3. **Hero close-up** — generator A in its lean-to: frosted orange housing, panel lamp, exhaust stack, rim from the dusk.
4. **Interior** — inside the lab: benches, shelves, one failing fluorescent tube, frosted windows showing blue whiteout.
5. **Action** — the stalker caught in the flashlight beam between the fuel tanks, generator C throwing sparks, snow gusting.
6. **Reverse** — from the tower base back east to the station: warm windows, work-light pools, masts fading in 3 depths.

## Composition
- Lit window / work light as the warm focal point against blue-grey; masts and cables as dark verticals fading at 3 distances.
- Low camera with snow blowing across frame toward the lens; horizon on a third; tilt 2-6° down at ground level.
- Avoid: blown snow, sharp strong sun shadows, uniform snow with no AO, square flake sprites, the creature in full light.
