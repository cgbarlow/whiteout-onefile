# Genre recipes

Map the user's `<genre>` to one recipe in Phase 0. The recipe fixes the systems list, the hero object, the camera, the scope
cap and the 6 hero poses. Pick the look separately from `art-direction.md`. Each recipe lists only the cookbook files the
genre needs beyond the **always-on core**.

## Always-on core (every genre)

- `cookbook/three/engine/core.js`, `cookbook/three/engine/harness.js`, `cookbook/three/engine/patch.js` (foundation)
- `cookbook/three/engine/boot.js` (staged boot + stubs), `cookbook/three/engine/quality.js` (tiers, dynres with hysteresis, warm-up, context loss), `cookbook/three/engine/loop.js`, `cookbook/three/engine/input.js`, `cookbook/three/engine/bench.js` (#bench fly-through)
- `cookbook/three/post/pipeline.js` (full chain, order in `pipeline-order.md`)
- `cookbook/three/lighting/sky.js`, `cookbook/three/lighting/env-from-sky.js`, `cookbook/three/lighting/atmos.js` (the one fog for every shader), `cookbook/three/lighting/pcss.js` (PCSS + `fitSunShadow`), `cookbook/three/lighting/lights.js` (practicals that light things)
- `cookbook/three/materials/noise.glsl.js`, `cookbook/three/materials/bake.js`, `cookbook/three/materials/surfaces.glsl.js`, `cookbook/three/materials/library.js` (ready-made baked + weathered materials), `cookbook/three/materials/weathering.js`, `cookbook/three/materials/triplanar.js`
- `cookbook/three/geo/kit.js`, `cookbook/three/geo/scatter.js`, `cookbook/three/decals/canvas-text.js`
- `cookbook/three/audio/synth.js`, `cookbook/three/audio/sfx.js`, `cookbook/three/audio/mixer.js`, `cookbook/three/audio/reverb.js`, `cookbook/three/audio/music.js`, `cookbook/three/audio/meter.js`

## Global scope cap (do not exceed without the user asking)

- **One map**, 100-200 m across (e.g. 80×60 m playable, 190×320 m ground, sea to 880 m). Bigger is a backdrop, not playable space.
- **A 5-10 minute loop** with a clear **win** and a clear **lose**, and restart.
- 1-2 core verbs plus movement; 2-3 actor types; 1 hero object.
- UI screens: **title** (live fly along PATH, never a black frame), **settings** (quality tier, sensitivity, volume, invert Y), **pause**, **HUD**, **end screen** (win/lose with stats, restart).
- A proven slice at this scope: one 100×60 m map, one weapon, two enemy types, three objectives, three waves, an exit.

## Hero-pose template

Each recipe gives its 6 poses in the fixed order from `art-direction.md`: 1 vista into the sun, 2 gameplay eye at spawn,
3 hero close-up, 4 interior / second biome, 5 action moment, 6 reverse angle away from the sun.

---

## FPS (first-person shooter)

- **Systems:** player controller (capsule, 1.68 m eye, crouch 1.05 m, radius 0.32 m), weapon view model, hitscan + tracers, enemy AI (state machine + nav grid), waves/objectives, damage/health, HUD, audio (gun layers, impacts, reverb zones).
- **Hero object:** the weapon, on screen 100% of the time. ≥ 30k tris (~50k for a rifle) from the extrude kit with mm dimensions; second camera FOV 54 on layer 1 with `depthRange(0,0.05)`; damped springs (8 ms sub-steps) for sway/recoil; rain beads/dust via the weathering patch.
- **Camera:** first person, FOV 70-78, pointer lock with drag fallback.
- **Core verbs:** move, look, shoot, ADS, reload, interact (hold E).
- **Actors:** 2 enemy types (one ground melee/fast, one ranged/flying), optional ambient creatures.
- **Loop:** 3 objectives under 3 waves → extraction. Lose = health 0. 5-10 min.
- **UI:** title, settings, pause, HUD (ammo, health, objective marker, hit marker, damage edge), debrief.
- **Cookbook:** `cookbook/three/fx/index.js` (wires every pool), `cookbook/three/fx/muzzle.js`, `cookbook/three/fx/streaks.js` (sparks, tracers), `cookbook/three/fx/casings.js`, `cookbook/three/fx/decals.js` (impacts), `cookbook/three/fx/lights.js` (flash light pool), `cookbook/three/fx/billboards.js`, `cookbook/three/engine/springs.js`, `cookbook/three/lighting/probes.js`, `cookbook/three/ground/ground.js`, `cookbook/three/ground/planar-reflection.js`, weather per thesis.
- **Pitfalls:** oversized star-shaped muzzle flash (keep flash ≤ 8% of screen height, 2-3 frames, randomised, lit by a pooled point light); weapon clipping into walls (use the second camera); view-model smear after instant yaw (motion blur must exclude layer 1); first-shot hitch (warm muzzle/impact/enemy shaders at boot); enemies that float (contact shadow + foot IK).
- **Poses:** 1 lane into the sun from a rooftop; 2 spawn at eye height facing objective 1; 3 weapon ADS with sight glass, rain beads; 4 interior with shafts through windows; 5 firing at an enemy mid-lane (flash, tracers, sparks, brass); 6 reverse lane facing away from the sun with practicals.

## Third-person action

- **Systems:** character controller (capsule + ground snap, slope limit 45°), avatar rig (procedural: bone hierarchy from kit primitives, 2-bone IK feet, procedural walk/run cycle), orbit camera with collision, melee/ranged combat with hit-stop, lock-on, enemies, HUD.
- **Hero object:** the avatar: bevelled armour plates, cloth (sweep/tube), ≥ 30k tris; rim-lit; readable silhouette at 6 m.
- **Camera:** over-the-shoulder spring arm 3-4 m, FOV 60-65, camera collision sphere cast, lag 0.1-0.15 s.
- **Core verbs:** move, dodge/roll, attack (light/heavy), block or shoot, interact.
- **Actors:** 2 enemy archetypes + 1 mini-boss.
- **Loop:** traverse 3 zones → boss arena. Win = boss down; lose = health 0.
- **UI:** title, settings, pause, HUD (health/stamina bars, lock-on reticle, boss bar), end.
- **Cookbook:** `cookbook/three/engine/springs.js`, `cookbook/three/fx/streaks.js`, `cookbook/three/fx/billboards.js`, `cookbook/three/geo/scatter.js`, `cookbook/three/geo/sdf-terrain.js`.
- **Pitfalls:** foot sliding (drive cycle phase from ground speed); camera inside walls; avatar too small in frame (critic reads it as "empty"); T-pose on first frame; contact shadows missing under feet.
- **Poses:** 1 avatar silhouetted on a ridge into the sun; 2 spawn over-the-shoulder; 3 avatar three-quarter close-up, rim light; 4 dungeon/interior with practical torches; 5 mid-attack on an enemy with sparks and hit-stop; 6 reverse view of the avatar's face side away from the sun.

## Racing / driving

- **Systems:** vehicle physics (raycast wheels, spring-damper suspension, Pacejka-lite tyre grip, drift), track spline (Catmull-Rom → road mesh with camber, kerbs, barriers), AI drivers on the racing line, lap timing, boost, skid marks, HUD.
- **Hero object:** the car: bevelled body from lofted profiles, glass with env reflection, wheel rims (lathe), brake glow, ≥ 40k tris; clear coat (two-layer specular) + dirt/wet from the patch.
- **Camera:** chase cam 5-6 m behind with speed-based FOV 65→80 and slight lag; bumper cam optional.
- **Core verbs:** throttle, brake, steer, handbrake/drift, boost.
- **Actors:** 3-5 AI cars (same mesh, varied livery via tint).
- **Loop:** 3 laps on one 1-2 km closed track (the track is long, the playable area is the road ribbon + 30 m verges). Win = 1st; lose = last or timer.
- **UI:** title, car/livery pick, settings, countdown, HUD (speed, position, lap, minimap), results.
- **Cookbook:** `cookbook/three/ground/ground.js`, `cookbook/three/ground/planar-reflection.js` (wet track), `cookbook/three/geo/scatter.js`, `cookbook/three/geo/sdf-terrain.js`, `cookbook/three/fx/billboards.js` (tyre smoke), `cookbook/three/fx/streaks.js`, `cookbook/three/engine/springs.js`, motion blur (not in `cookbook/three/post/pipeline.js` yet: add a reprojection pass after the composite).
- **Pitfalls:** speed feels slow (add motion blur, FOV kick, roadside objects within 5 m for parallax, camera shake); visible track-spline seams; LOD popping on roadside props (fade, never cut); far field empty (racing sees far: ≥ 3 backdrop layers); shadow map too small for a long track (cascade-like: fit the frustum to the camera neighbourhood each frame with `fitSunShadow` in `cookbook/three/lighting/pcss.js`).
- **Poses:** 1 car cresting a hill into the sun; 2 chase cam at the start grid; 3 car three-quarter front close-up, wet paint; 4 tunnel or forest section; 5 drifting past an AI car with smoke and sparks; 6 reverse: front of the pack looking back away from the sun.

## Flight

- **Systems:** flight model (lift/drag/thrust, angle of attack, stall, bank-to-turn), terrain (heightfield or SDF) 2-4 km with LOD rings, clouds (raymarched slab or sprite clusters), rings/targets, enemies optional, HUD.
- **Hero object:** the aircraft: extruded fuselage + lofted wings, control-surface animation, canopy glass, exhaust heat shimmer, ≥ 30k tris.
- **Camera:** chase 12-15 m with lag, cockpit optional, FOV 65-70.
- **Core verbs:** pitch, roll, yaw, throttle, fire/boost.
- **Actors:** 3-6 drones or rival planes; birds.
- **Loop:** fly a 2 km course of 15-20 rings or destroy N targets in 6 min. Win = all rings; lose = crash or timer.
- **UI:** title, settings, HUD (altitude, speed, heading tape, target arrows), results.
- **Cookbook:** `cookbook/three/geo/sdf-terrain.js`, `cookbook/three/geo/scatter.js`, `cookbook/three/water/sea.js` (coast), `cookbook/three/fx/streaks.js`, `cookbook/three/fx/billboards.js`, motion blur (not in `cookbook/three/post/pipeline.js` yet: add a reprojection pass after the composite).
- **Pitfalls:** scale errors (trees too big relative to plane; use real metres); terrain edge visible from altitude (ring of low mountains + fog, terrain to ≥ 3× view distance in coarse LOD); cloud sprites with hard edges/camera intersection pops; shadow map unusable at altitude (fit to a 300 m box around the plane and fade beyond).
- **Poses:** 1 plane banking through a valley into the sun; 2 chase cam at takeoff; 3 plane close-up from the wingtip; 4 canyon or cloud interior; 5 passing through a ring with boost FX; 6 reverse: looking back at the plane with the sun behind the camera.

## Exploration / walking sim

- **Systems:** first-person walker (no weapon), interactables with narration text, discoverable notes/audio logs, environmental storytelling props, ambient life, music by zone.
- **Hero object:** the place itself; the hero set piece (lighthouse, temple, wreck) at the map's focal point, ≥ 50k tris and the best materials. Optional held object (lantern) with its own light.
- **Camera:** first person, FOV 65-70, head bob ≤ 1 cm, slow walk 1.4 m/s, sprint 3 m/s.
- **Core verbs:** walk, look, interact/read, (optional) photo mode.
- **Actors:** ambient creatures (birds, fish, deer) with closed-form motion in the vertex shader.
- **Loop:** find 5-7 story items → unlock the ending at the hero set piece. Win = ending; lose = none (state "no lose state" in SPEC; a soft fail such as nightfall resets to checkpoint is fine).
- **UI:** title, settings, pause, subtle HUD (interact prompt, collected count), ending card.
- **Cookbook:** `cookbook/three/geo/sdf-terrain.js`, `cookbook/three/geo/surface-nets.js`, `cookbook/three/geo/scatter.js`, `cookbook/three/lighting/probes.js`, `cookbook/three/weather/dust.js`, weather/water per thesis.
- **Pitfalls:** empty mid-ground (dress every 10 m with something to look at); random-yaw shots expose flat far field and world edges more than any genre (the player looks everywhere); unreadable objectives (light the next item with a practical or a shaft).
- **Poses:** 1 vista over the map to the hero set piece into the sun; 2 spawn view; 3 the held object or a story item close-up; 4 an interior; 5 an ambient-life moment (school of fish, flock lifting off); 6 reverse view from the set piece back to the spawn.

## Survival

- **Systems:** first- or third-person controller, needs (warmth/hunger/stamina), gathering nodes, crafting (5-8 recipes), base building on a grid (snap pieces), day/night cycle limited to dusk→night→dawn (keeps light art-directed), threats (wildlife or weather), save.
- **Hero object:** the shelter/base and the held tool; a campfire that lights the scene (point light + flicker + smoke).
- **Camera:** first person FOV 70, or third person 3.5 m.
- **Core verbs:** gather, craft, build, eat/warm, fight or flee.
- **Actors:** 2 threat types + 1 passive animal.
- **Loop:** survive 3 nights (each ~2-3 min) or repair the radio/beacon. Win = rescue; lose = a need hits 0.
- **UI:** title, settings, pause, HUD (needs bars, hotbar), inventory/crafting panel, end.
- **Cookbook:** `cookbook/three/geo/sdf-terrain.js`, `cookbook/three/geo/scatter.js`, `cookbook/three/weather/snow.js` or `cookbook/three/weather/rain.js`, `cookbook/three/fx/billboards.js`, `cookbook/three/fx/streaks.js`, `cookbook/three/lighting/probes.js`.
- **Pitfalls:** a time-of-day cycle that moves the sun through ugly noon light (restrict the sun to 2-3 art-directed keyframes and lerp ART between them only via the look-director's table); placing pieces that z-fight; inventory UI overlapping the HUD; night that is pure black (moon + fire + sky fill).
- **Poses:** 1 base at dusk into the low sun; 2 spawn; 3 held tool/campfire close-up; 4 inside the shelter by firelight; 5 threat attacking near the fire; 6 reverse: night side away from the sun with only the fire.

## Horror

- **Systems:** first-person walker, flashlight (spot light with cookie + shadow, battery), sanity/fear meter, a stalker AI (hearing/vision cones, patrol + chase), hiding spots, doors and keys, scripted scares, heavy audio design.
- **Hero object:** the flashlight beam and what it reveals; the stalker creature (only seen in fragments).
- **Camera:** first person FOV 65-70, subtle breathing sway, lens grain/vignette up.
- **Core verbs:** walk, flashlight, hide, interact/pick up, run.
- **Actors:** 1 stalker + ambient events (things falling, lights flickering).
- **Loop:** find 3 keys/fuses in one building (~120×60 m) → escape. Win = exit; lose = caught.
- **UI:** title, settings (brightness calibration), pause, minimal HUD (battery, prompts), caught/escaped screens.
- **Cookbook:** `cookbook/three/lighting/probes.js`, `cookbook/three/fx/billboards.js`, `cookbook/three/weather/dust.js` (motes in the beam), `cookbook/three/post/shaders.js` (fog in beams; needs a spot-shadow source or a cone-analytic approximation).
- **Pitfalls:** "dark" done as crushed black (dark must still have readable shapes: raise ambient floor, use blue moon fill and grain); the beam lighting nothing because the spot has no shadow (shadow-casting spot is the hero light); creature in full view = cheap (show it in shafts, silhouette); jump scares that spike audio above -1 dBFS.
- **Poses:** 1 the building exterior at dusk into the last sun; 2 spawn at the door; 3 flashlight beam on a detailed surface (dust motes, wet wall); 4 the deepest interior lit only by a failing practical; 5 the stalker in the beam at the end of a corridor; 6 reverse: looking back at the entrance from inside.

## Tower defense / RTS-lite

- **Systems:** top-down/iso camera rig, grid or path lanes, enemy waves on splines, 3-4 tower types with upgrade, projectile pool, economy, selection/placement UI, minimap.
- **Hero object:** the core/base being defended; towers with idle animation and muzzle FX.
- **Camera:** perspective tilted 50-60°, FOV 35-45 (tele look), zoom and pan with bounds; height 25-50 m.
- **Core verbs:** place, upgrade, sell, trigger ability, pan/zoom.
- **Actors:** 3 enemy types (swarm, armoured, flying) + boss wave.
- **Loop:** 8-12 waves, ~8 min. Win = all waves; lose = base HP 0.
- **UI:** title, settings, pause, HUD (gold, wave, base HP, tower palette, tooltip), end.
- **Cookbook:** `cookbook/three/geo/scatter.js`, `cookbook/three/geo/sdf-terrain.js`, `cookbook/three/fx/streaks.js`, `cookbook/three/fx/billboards.js`, `cookbook/three/decals/canvas-text.js`.
- **Pitfalls:** the elevated camera exposes the whole map edge (shape the map as a plateau/island, fog and a backdrop ring below the camera's view cone); tiny unreadable units (scale units 1.5-2× real and add silhouette rim); shadow acne from the steep view (slope-scaled bias); hundreds of draw calls from units (InstancedMesh per type); volumetrics wasted at this distance (lower vol strength, keep height fog).
- **Poses:** 1 low dramatic angle across the battlefield into the sun (not the gameplay view); 2 gameplay camera at wave 1; 3 a tower close-up firing; 4 the second biome lane (cave/forest); 5 boss wave mid-assault with FX; 6 gameplay camera rotated 180° away from the sun.

## 3D platformer

- **Systems:** character controller with coyote time (0.1 s), jump buffering (0.12 s), variable jump height, double jump or dash, moving platforms, checkpoints, collectibles, hazards, camera rails per section.
- **Hero object:** the character (stylised, chunky bevels, squash-and-stretch), readable at 8 m.
- **Camera:** third person 6-8 m, auto-framing per section, FOV 55-60.
- **Core verbs:** run, jump, double-jump/dash, ground-pound or attack.
- **Actors:** 2 enemy types (patroller, shooter) + hazards (spinners, crushers).
- **Loop:** one course of 5-7 sections over ~150 m vertical/horizontal, 100 collectibles, a goal. Win = goal; lose = lives 0 (checkpoint restore).
- **UI:** title, settings, pause, HUD (collectibles, lives), level complete with time.
- **Cookbook:** `cookbook/three/geo/scatter.js`, `cookbook/three/engine/springs.js`, `cookbook/three/fx/streaks.js`, `cookbook/three/fx/billboards.js` (landing puffs), `cookbook/three/water/sea.js` (below the course).
- **Pitfalls:** no drop shadow under the character (mandatory blob/contact shadow for depth reading); floating platforms with no AO or underside detail; collectibles that bloom into halos; a sky void below the course (sea or cloud layer).
- **Poses:** 1 course overview into the sun; 2 start; 3 character close-up mid-jump; 4 interior/cave section; 5 action: dashing past a hazard with FX; 6 reverse look back down the course.

## Puzzle (3D)

- **Systems:** room or diorama scenes (3-5 puzzles), interactable mechanisms (levers, mirrors redirecting light beams, rotating blocks), state machine per puzzle, hint system, undo.
- **Hero object:** the central mechanism (orrery, light-mirror rig, sliding block monument) with machined detail and emissive readouts.
- **Camera:** first person or orbit around a diorama, FOV 50-60; strong DOF optional.
- **Core verbs:** select/rotate/push, inspect, undo.
- **Actors:** none or one guide creature.
- **Loop:** 3-5 puzzles of rising difficulty, ~8 min. Win = final mechanism; lose = optional (timer or limited moves) or "no lose state" stated in SPEC.
- **UI:** title, settings, pause, minimal HUD, solved/complete screens, hint prompt.
- **Cookbook:** `cookbook/three/lighting/probes.js`, `cookbook/three/weather/dust.js`, `cookbook/three/post/shaders.js` (light beams are the puzzle), `cookbook/three/fx/streaks.js`.
- **Pitfalls:** dioramas floating in a void (always ground and a backdrop); materials too clean (weathering patch with dust); interaction affordance unreadable (emissive rim on interactables); beam puzzles with aliasing on thin beams (min pixel width).
- **Poses:** 1 the space into the sun through a window/oculus; 2 starting view; 3 mechanism close-up; 4 second room; 5 a beam/mechanism solving with FX; 6 reverse view away from the window.

## Sports (arena ball game)

- **Systems:** ball physics (sphere, restitution, spin/Magnus-lite), player controller with kick/throw, 1v1 or 3v3 simple AI (positioning + chase + pass), goals/scoring, match clock, crowd (instanced billboards or low-poly with vertex animation), replay cam optional.
- **Hero object:** the stadium/arena itself and the ball; floodlights that **light the pitch** (shadow-casting spots or baked light cards).
- **Camera:** broadcast cam (high side, tele FOV 35-45) or behind-player 8 m.
- **Core verbs:** move, sprint, kick/shoot, pass, tackle.
- **Actors:** AI teammates and opponents (1 mesh, tinted kits), keeper, crowd.
- **Loop:** one 4-6 min match. Win = more goals; lose = fewer (or golden goal).
- **UI:** title, team pick, settings, pause, HUD (score, clock), goal replay banner, full-time screen.
- **Cookbook:** `cookbook/three/decals/canvas-text.js` (pitch lines, ad boards), `cookbook/three/ground/ground.js` (grass with mow stripes), `cookbook/three/fx/streaks.js` (goal pyro), `cookbook/three/lighting/probes.js`.
- **Pitfalls:** floodlights that glow but light nothing (the classic defect); crowd repetition (tint, scale, animation phase variance); pitch line moire (canvas texture with mips, anisotropy 8, line width ≥ 2 texels); players with no contact shadows.
- **Poses:** 1 stadium exterior/top at golden hour into the sun; 2 kickoff broadcast cam; 3 ball and boot close-up; 4 tunnel/locker room; 5 a shot on goal with the keeper diving; 6 reverse broadcast angle from the other side.

## Boat / sailing

- **Systems:** Gerstner ocean shared with JS buoyancy (sample points on the hull), sail physics (apparent wind, sail trim angle → thrust), rudder, wake/foam trail, islands, buoys/checkpoints, weather.
- **Hero object:** the boat: lofted hull from station profiles (analytic hull), mast, rigging (tubes ≥ 1 px wide), sail cloth with wind billow in the vertex shader, ≥ 40k tris; wet deck.
- **Camera:** chase 10-14 m with roll damping (never full boat roll), FOV 60-65.
- **Core verbs:** steer, trim sail, (optional) reef/boost, interact (pick up cargo).
- **Actors:** rival boats, gulls, dolphins (closed-form motion).
- **Loop:** a regatta through 8-12 buoys around 2-3 islands within ~600 m, or deliver cargo before the storm. Win = finish/deliver; lose = timer or capsize.
- **UI:** title, settings, pause, HUD (wind indicator, speed, next buoy arrow, timer), results.
- **Cookbook:** `cookbook/three/water/sea.js`, `cookbook/three/weather/rain.js`, `cookbook/three/weather/lightning.js`, `cookbook/three/geo/sdf-terrain.js` (islands), `cookbook/three/geo/scatter.js`, `cookbook/three/fx/billboards.js` (spray), `cookbook/three/engine/springs.js`.
- **Pitfalls:** boat floating above or sinking into waves (sample the same Gerstner sum in JS as in the shader); tiling sea normals; horizon seam where the sea grid ends (extend ≥ 900 m, fade to sky horizon colour with the shared fog); thin rigging aliasing (min width, fade).
- **Poses:** 1 boat heeling into the sun with glitter path; 2 chase cam at the start line; 3 deck/sail close-up with spray beads; 4 a sheltered cove or harbour (second biome); 5 rounding a buoy against a rival with spray; 6 reverse: boat from the bow looking back away from the sun.

---

## Picking the renderer per genre

three.js r180 (WebGL2) for all of the above; it is the only engine this skill supports. For exploration, flight or swimming
scenes with massive instancing, lean on `InstancedMesh`, vertex-shader animation and LOD fades rather than a different renderer.
