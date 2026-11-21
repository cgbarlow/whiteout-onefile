// WHITEOUT entry: staged boot (engine/boot.js) in the mandatory order (references/pipeline-order.md §2):
//   core → quality → pcss → atmos → sky → env → materials → lights → station (world, critical) → terrain (ground +
//   berm + far field) → finalize → shadows → fx → generators (hero) → stalker → flashlight → atmosphere (weather) →
//   probes (lab, assigned) → post → audio → input → game → hud → warm-up → probe capture → markReady.
// Every module stage is non-critical (except station) and falls back to its stub in src/modules/_stub.js, so the game
// boots with any subset of modules done. Module ownership: OWNERS.md. Lead owns this file, contracts.js, art.js, _stub.js.
import { createCore } from './cookbook/engine/core.js';
import './perf/lightcull.js'; // perf: skip zero-contribution point/spot lights per fragment (bit-identical)
import { createBoot } from './cookbook/engine/boot.js';
import { createQuality } from './cookbook/engine/quality.js';
import { createInput, DEFAULT_BINDINGS } from './cookbook/engine/input.js';
import { installBench } from './cookbook/engine/bench.js';
import { finalizeMaterials } from './cookbook/engine/finalize.js';
import { installPCSS, fitSunShadow, createShadowScheduler, casterBounds } from './cookbook/lighting/pcss.js';
import { installAtmos } from './cookbook/lighting/atmos.js';
import { createSky } from './cookbook/lighting/sky.js';
import { createEnvFromSky } from './cookbook/lighting/env-from-sky.js';
import { createLights } from './cookbook/lighting/lights.js';
import { createProbe } from './cookbook/lighting/probes.js';
import { initMaterials } from './cookbook/materials/library.js';
import { createFX } from './cookbook/fx/index.js';
import { createPost } from './cookbook/post/pipeline.js';
import { ART } from './art.js';
import { buildMaterials, flatMaterials } from './look/materials.js';
import { failingTube, shedLamps, groundPools } from './look/practicals.js';
import { applyPostLook } from './look/post.js';
import { POSES, PATH, WORLD, PLAYER, LAYOUT } from './contracts.js';
import { STUBS } from './modules/_stub.js';
import * as Station from './modules/station/index.js';
import * as Terrain from './modules/terrain/index.js';
import * as Atmosphere from './modules/atmosphere/index.js';
import * as Generators from './modules/generators/index.js';
import * as Stalker from './modules/stalker/index.js';
import * as Flashlight from './modules/flashlight/index.js';
import * as Game from './modules/game/index.js';
import * as Hud from './modules/hud/index.js';
import * as Audio from './modules/audio/index.js';

// ?show=<name> → that module's showcase(G) camera
const SHOWCASES = { station: Station, terrain: Terrain, atmosphere: Atmosphere, generators: Generators, stalker: Stalker,
  flashlight: Flashlight, game: Game, hud: Hud, audio: Audio };
const own = (m) => { if (m && typeof m === 'object') m.selfUpdating = true; return m; }; // runs on its own G.on('update')

async function main() {
  // 1. core + harness first, so every later error is captured (the boot screen covers the canvas meanwhile)
  const G = createCore({ canvas: document.getElementById('c'), ART, fov: PLAYER.fov, far: 2000 });
  Object.assign(G, { POSES, PATH, WORLD, LAYOUT });
  installBench(G, { path: PATH });
  G.start();
  const boot = createBoot(G, { stubs: STUBS });
  const stage = boot.stage;

  // 2. quality: tier (renderer string / ?q=), dynres, context-loss guard
  const Q = await stage('quality', () => createQuality(G), { critical: true, msg: 'Waking the generators', at: 0.03 });

  // 3-5. global chunk patches BEFORE any material compiles; then sky → env
  await stage('pcss', () => { installPCSS({ G, tier: G.quality.tier }); return {}; }, { msg: 'Softening the shadows', at: 0.06 });
  await stage('atmos', () => installAtmos(G) || {}, { critical: true, msg: 'Thickening the snow haze', at: 0.09 });
  const sky = await stage('sky', () => own(createSky(G, { diskRadiance: ART.sky.diskRadiance })), { msg: 'Dimming the dusk', at: 0.12 });
  await stage('env', () => own(createEnvFromSky(G, sky)), { msg: 'Catching the last light', at: 0.15 });

  // 6. materials: GPU-baked PBR sets + shared weathering (uSnow accumulation from ART.surface.snow).
  //    Interior (lab) materials are own instances with the 'sheltered' preset so the probe can own them.
  const mats = await stage('materials', () => { initMaterials(G); return buildMaterials(LAYOUT.modules.find((m) => m.interior)); }, { msg: 'Frosting the paint', at: 0.2, stub: flatMaterials });

  // 7. practical lights system (budget per tier) — station / generators add their lamps through it
  const lights = await stage('lights', () => own(createLights(G)), { msg: 'Switching on the work lights', at: 0.23 });

  // 8. world (critical): station layout, colliders, lab interior, signage, practicals
  const station = await stage('station', () => Station.create(G, { mats, lights }), { critical: true, msg: 'Raising the station', at: 0.3 });
  // look: the lab tube is steady with rare bursts (never a frame-to-frame change on static views); lean-to lamps
  failingTube(G, station.labLamp, mats.lamp);
  shedLamps(G, lights);
  // 9. ground + boundary + far field
  const terrain = await stage('terrain', () => Terrain.create(G, { mats }), { msg: 'Drifting the snow', at: 0.38 });
  groundPools(lights, terrain); // seat the window / lamp pools on the drifted snow

  // 10. finalize: atmos fog + weathering on every built-in world material that lacks them (idempotent)
  finalizeMaterials(G, G.scene);

  // 11. sun shadow fitted to the casters. The sun map updates every 2nd frame (every 4th on low); the global
  //     shadowMap flag is raised every frame so the flashlight spot (its own autoUpdate) stays live.
  await stage('shadows', () => {
    // the near-flat snow shelf receives but never casts: at a 7° sun its own triangles self-shadow into a
    // regular ripple (reads as water). Drifts are too low to throw a readable shadow anyway.
    for (const m of terrain.meshes || []) m.castShadow = false;
    fitSunShadow(G, casterBounds(station.root), G.quality.settings.shadow);
    const sched = createShadowScheduler(G, { mode: 'dynamic', every: 1 });
    const sl = G.sun.light.shadow, every = G.quality.tier === 'low' ? 4 : 2;
    sl.autoUpdate = false;
    let pend = 4;
    G.on('update', () => { if (pend > 0 || G.frame % every === 0) { sl.needsUpdate = true; if (pend > 0) pend--; } });
    G.on('contextrestored', () => { pend = 4; });
    return own({ sched, update() {}, invalidate(n = 2) { pend = Math.max(pend, n); } });
  }, { msg: 'Casting shadows', at: 0.44 });

  // 12. FX pools (preallocated) — generators use sparks + exhaust steam
  const fx = await stage('fx', () => { const f = createFX(G); f.setGround(WORLD.groundY, terrain.heightAt); return own(f); }, { msg: 'Priming the sparks', at: 0.48 });

  // 13-15. hero object, actor, hero light
  const generators = await stage('generators', () => Generators.create(G, { mats, lights, fx }), { msg: 'Fuelling the generators', at: 0.54 });
  const colliders = station.colliders.concat(generators.colliders || []);
  const stalker = await stage('stalker', () => Stalker.create(G, { mats, colliders, station, terrain }), { msg: 'Something is out there', at: 0.6 });
  const flashlight = await stage('flashlight', () => Flashlight.create(G), { msg: 'Charging the torch', at: 0.64 });
  fx.prewarm?.(3);

  // 16. weather (blizzard + gusts)
  const atmosphere = await stage('atmosphere', () => Atmosphere.create(G, { station }), { msg: 'Calling the blizzard', at: 0.7 });

  // 17. lab interior probe: assigned now (warm-up compiles its programs), CAPTURED after the warm-up
  const probe = await stage('probes', () => {
    if (!station.interior) return {};
    const hide = [atmosphere.snow?.mesh, atmosphere.dust?.mesh, stalker.root, flashlight.vm?.group].filter(Boolean);
    const p = createProbe(G, { position: station.interior.probeAt, box: station.interior.box, hide });
    p.assign(station.interior.group, { intensity: ART.ambient.probeIntensity });
    return own(p);
  }, { msg: 'Lighting the lab', at: 0.74 });

  // 18. post: HDR chain → G.post, G.render
  await stage('post', () => { const p = createPost(G, { adaptKey: ART.grade.adaptKey }); applyPostLook(p, ART); return p; }, { msg: 'Grading the film', at: 0.78 });

  // 19. audio (graph suspended until the first gesture; banks render after ready)
  await stage('audio', () => Audio.create(G, { generators, atmosphere }), { msg: 'Tuning the radio', at: 0.82 });

  // 20. input → game (player + rules) → hud.  'light' (F) toggles the flashlight; interact is E only.
  const input = await stage('input', () => createInput(G, { root: document.getElementById('ui'),
    bindings: { ...DEFAULT_BINDINGS, interact: ['KeyE'], light: ['KeyF'] } }), { critical: true, msg: 'Finding the controls', at: 0.86 });
  G.on('preupdate', () => { if (!G.paused && input.pressed('light')) flashlight.toggle?.(); });
  const game = await stage('game', () => Game.create(G, { input, colliders, terrain, station, generators, stalker, flashlight }), { msg: 'Waking up', at: 0.89 });
  G.mods.player = game.player;
  const hud = await stage('hud', () => Hud.create(G, { input, game, flashlight, quality: Q, path: PATH }), { msg: 'Printing the checklist', at: 0.92 });
  G.mods.ui = hud;

  // ?show=<module>: isolate a module's showcase camera
  const show = SHOWCASES[G.params.get('show')];
  if (show?.showcase) { const s = show.showcase(G); G.on('ready', () => window.__setCam(s.cam, s.target)); }

  // 21-22. last finalize pass, warm-up (compileAsync + one frame of every permutation), probe capture → ready
  finalizeMaterials(G, G.scene);
  G.camera.position.fromArray(POSES[0]); G.camera.lookAt(POSES[0][3], POSES[0][4], POSES[0][5]);
  // extras: every enemy / fx / decal material with its real geometry (instanced / points kinds kept), so a material
  // that is hidden, culled or empty at boot (fx pools, the stalker, its prints) still has its program linked now.
  const extras = warmExtras([stalker.root, stalker.prints?.mesh, fx.billboards?.mesh, fx.streaks?.mesh,
    fx.muzzles?.mesh, fx.decals?.mesh, fx.casings?.mesh, flashlight.vm?.group, G.scene.getObjectByName('game-pickups')]);
  await stage('warmup', () => Q.warmup({ extras }), { msg: 'Compiling shaders', at: 0.95 });
  // the probe capture swaps the lab materials onto the captured cube-UV env (new program defines): warm again after
  // it (cached programs are free) so nothing links after ready. __stats().programs must not grow during play.
  await stage('probe-capture', () => { probe.capture?.(2); return {}; }, { msg: 'Lighting the lab', at: 0.98 });
  await boot.finish({ extras });
  G.readyPrograms = G.renderer.info.programs.length;
}

const _seen = new Set();
function warmExtras(roots) {
  const out = [];
  _seen.clear();
  for (const r of roots) {
    if (!r || !r.traverse) continue;
    r.traverse((o) => {
      if (!o.material || !o.geometry) return;
      const kind = o.isInstancedMesh ? 'instanced' : o.isPoints ? 'points' : o.isMesh && !o.isSkinnedMesh ? 'mesh' : null;
      if (!kind) return; // skinned / lines stay in the scene and compile through the scene traversal
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const key = m.uuid + kind + o.geometry.uuid;
        if (_seen.has(key)) continue;
        _seen.add(key);
        out.push({ material: m, geometry: o.geometry, kind, castShadow: o.castShadow, receiveShadow: o.receiveShadow });
      }
    });
  }
  return out;
}

main().catch((e) => {
  const msg = 'main: ' + (e && e.message || e);
  (window.__errors ||= []).push(msg); window.__fatal = window.__fatal || msg; console.error(e);
});
