// GENERATORS (hero object) + BEACON TOWER: 3 diesel generator skids in their lean-tos and the 28 m lattice beacon.
//   create(G, { mats, lights, fx }) → {
//     list: [{ id, pos: Vector3 (panel point, world), state: 'off'|'cranking'|'running', progress 0..1, faulty }],
//     colliders: Box3[], running (count), beacon: { powered, lampAt },
//     crank(id, dt) → progress (call every frame E is held; emits 'noise' and 'gen:state'),
//     nearest(pos, range) → entry|null, reset(), update(dt, t) }
// Bus: emits 'gen:state' (id, state), 'beacon:on' (), 'noise' (x, z, radius). Generator C is faulty: it arcs at a loose
// exciter lead (sparks + a blue flash light from the fx pool) and its lamp stutters red.
// States read in motion: off (still, flap shut) · cranking (starter chugs shake the skid, the crank lever pumps, black
// puffs and flap kicks at every chug, amber lamp blinks) · running (fine idle shake, flap riding the exhaust, white
// exhaust steam from fx.emitter, green lamp). Beacon: a real red light from lights.add created at boot at intensity 0
// (the light count never changes), an incandescent 1.2 s flash once powered; a dim always-on aviation glow (two corner
// lamps + the halo) so the tower reads from the spawn in the haze.
// ?show=generators (or ?gen=A[,B,C]) starts units running; under ?shot the skids hold still (no shimmer from the shake).
// Draw calls: per unit paint/steel/dark/snow/lamp + lever + flap (7) ×3, one decal mesh, tower 6, 1 halo ≈ 29.
import { Group, Vector3, Box3, MeshStandardMaterial, Color } from 'three';
import { LAYOUT as L, RULES } from '../../contracts.js';
import { GKit } from './parts.js';
import { generatorKit, VARIANTS, GEN_HALF, GEN_PANEL } from './model.js';
import { leverKit, flapKit } from './panel.js';
import { beaconTower } from './beacon.js';
import { buildDecals } from './decals.js';
import { makeMaterial } from '../../cookbook/materials/library.js';

const HP = Math.PI / 2, PLINTH = 0.1;                   // station lean-to plinth top (buildings.js leanTo)
const FACE = { '+x': [0, HP, 0], '-x': [0, -HP, 0], '+z': [0, 0, 0], '-z': [0, Math.PI, 0], '+y': [-HP, 0, 0] };
const LEVER_REST = 0.32, LEVER_PULL = -0.62;            // rad about the pivot's z (rest leans back toward the engine)
const _p = new Vector3(), _n = new Vector3(), _v = new Vector3();
let _inst = null;

export function create(G, { mats, lights, fx }) {
  const root = new Group(); root.name = 'generators';
  const rnd = G.rng(4711), low = G.quality?.tier === 'low', shot = !!G.params.get('shot');
  const D = buildDecals(G);
  const dk = new GKit();                                     // every decal (3 skids + tower) → one mesh
  const decal = (k) => (name, w, at, face, h = null) => { dk.pushMatrix(k.m); dk.add(D.geo(name, w, h), 'decal', { at, rot: FACE[face], occ: false }); dk.pop(); };
  const colliders = [], list = [];
  const lampMat = (c, k = 0) => { const m = new MeshStandardMaterial({ color: 0x140806, emissive: new Color(c), emissiveIntensity: k, roughness: 0.22 }); m.userData.noWeather = true; return m; };
  // orange parts: chipped painted steel over primer (edge wear on the bevels, roughness breakup), colour per vertex
  let opaint = mats.paint;
  try { opaint = makeMaterial('painted_metal', { tint: 0xffffff, scale: 1.2, weather: { preset: 'prop', edge: 0.85 } }); opaint.vertexColors = true; opaint.name = 'gen-opaint'; }
  catch (err) { G.errors?.push?.('generators: painted_metal unavailable, ' + err.message); }
  const kitMats = (extra) => ({ paint: mats.paint, opaint, steel: mats.steel, dark: mats.dark, concrete: mats.concrete, snow: mats.snowGround || mats.concrete, drift: mats.concrete, default: mats.steel, ...extra });
  const finish = (grp) => { grp.traverse((m) => { if (m.isMesh && /snow|drift|lamp|beacon|avia/.test(m.name)) m.castShadow = false; }); return grp; };

  for (const g of L.generators) {
    const v = VARIANTS[g.id] || VARIANTS.A, c = Math.cos(g.rotY), s = Math.sin(g.rotY);
    const toLocal = (wx, wy, wz) => { const dx = wx - g.gen[0], dz = wz - g.gen[1]; return [dx * c - dz * s, wy - PLINTH, dx * s + dz * c]; };
    const loc = (p, out) => out.set(g.gen[0] + p[0] * c + p[2] * s, p[1] + PLINTH, g.gen[1] - p[0] * s + p[2] * c);
    // the lean-to day tank (station buildings.js: 0.7×0.6×0.5 box at (c.x-1.85, 0.95, c.z-1.2)) feeds the skid
    const dayTank = toLocal(g.c[0] - 1.85 + 0.22, 0.63, g.c[1] - 1.2 + 0.12);
    const k = new GKit(), lamp = lampMat(0x30ff60);
    dk.push(g.gen[0], PLINTH, g.gen[1], g.rotY);
    const A = generatorKit(k, decal(k), { id: g.id, rnd, v, dayTank });
    dk.pop();
    k.bakeAO({ ground: 0, samples: low ? 4 : 6, radius: 0.3, keys: ['paint', 'opaint', 'steel', 'dark'] });
    k.grime({ base: 0, foot: 0.3, down: 0.3, streak: g.id === 'C' ? 0.5 : 0.3, scale: 1.4, seed: g.id.charCodeAt(0) }, ['paint', 'steel', 'dark']);
    // oil grime + soot on the orange castings: heavier toward the base and down from the engine joints
    k.grime({ base: 0, foot: 0.55, down: 0.5, streak: g.id === 'C' ? 0.7 : 0.5, dirt: [0.42, 0.37, 0.31], scale: 2.2, seed: g.id.charCodeAt(0) + 7 }, ['opaint']);
    const group = new Group(); group.name = 'gen' + g.id;
    group.position.set(g.gen[0], PLINTH, g.gen[1]); group.rotation.y = g.rotY;
    group.add(finish(k.build(kitMats({ lamp }))));
    const lk = new GKit(); leverKit(lk);
    const lever = new Group(); lever.position.fromArray(A.lever); lever.rotation.z = LEVER_REST; lever.add(lk.build(kitMats()));
    const fk = new GKit(); flapKit(fk);
    const flap = new Group(); flap.position.fromArray(A.hinge); flap.add(fk.build(kitMats()));
    group.add(lever, flap);
    root.add(group);
    colliders.push(new Box3(new Vector3(g.gen[0] - GEN_HALF[0], 0, g.gen[1] - GEN_HALF[1]), new Vector3(g.gen[0] + GEN_HALF[0], PLINTH + 1.6, g.gen[1] + GEN_HALF[1])));
    const exhaust = loc([A.stack[0], A.stack[1] + 0.03, A.stack[2]], new Vector3());
    const steam = fx?.emitter ? fx.emitter({ pos: exhaust, dir: { x: 0.45, y: 1, z: 0.15 }, kind: 'steam', rate: 11, size: 0.11, speed: 1.2 }) : null;
    steam?.stop();
    list.push({
      id: g.id, pos: loc(GEN_PANEL, new Vector3()), state: 'off', progress: 0, faulty: g.id === 'C',
      group, base: group.position.clone(), lamp, lever, flap, steam, exhaust, spark: loc(A.sparks, new Vector3()), sparkDir: new Vector3(c, 0.35, -s).normalize(),
      idle: 0, sparkT: 0.5 + rnd() * 1.5, fizzT: 0, arc: 0, chug: 0, chugN: 0, ph: rnd() * 10,
    });
  }

  // beacon tower + lamps: the red beacon light is created NOW at intensity 0 so the real-light count never changes
  const tk = new GKit(), beaconMat = lampMat(0xff2a1a, 0.04), aviaMat = lampMat(0xff2a1a, 2.2);
  const tw = beaconTower(tk, decal(tk), L.tower, rnd);
  colliders.push(...tw.colliders);
  tk.bakeAO({ ground: 0, samples: low ? 4 : 5, radius: 0.35, keys: ['concrete'] });
  tk.grime({ base: 0, foot: 0.7, down: 0.2, streak: 0.25, scale: 0.6 }, ['steel', 'concrete']);
  root.add(finish(tk.build(kitMats({ beacon: beaconMat, avia: aviaMat }))));
  const decals = dk.build({ decal: D.mat, default: D.mat }, { castShadow: false });
  decals.traverse((m) => { if (m.isMesh) m.renderOrder = 2; });
  root.add(decals);
  const AVIA_HALO = 3.6;
  const beaconLight = lights?.add?.({ position: tw.lampAt, kind: 'none', color: [1, 0.1, 0.05], intensity: 0, range: 85, real: true, pool: false, halo: true, haloStrength: 0, haloSize: 3.4 }) || null;
  if (beaconLight) beaconLight.group.traverse((m) => { if (m.isMesh && m.material === beaconLight.emisMat) m.visible = false; }); // the kit lens is the fixture
  G.scene.add(root);

  const S = { list, colliders, root, running: 0, beacon: { powered: false, lampAt: tw.lampAt, light: beaconLight } };
  const count = () => { let n = 0; for (let i = 0; i < list.length; i++) if (list[i].state === 'running') n++; return n; };
  const setState = (e, st) => {
    if (e.state === st) return;
    const was = e.state; e.state = st;
    if (st === 'running') {
      e.progress = 1; e.steam?.start();
      if (was === 'cranking' && fx?.smoke) { _v.set(0.6, 2.2, 0.2); fx.smoke(e.exhaust, { count: 3, size: 0.16, grow: 2.2, life: 2.2, color: [0.12, 0.115, 0.11], opacity: 0.55, spread: 0.06, vel: _v, rise: 0.9 }); }
      G.emit('noise', e.pos.x, e.pos.z, RULES.hearCrank);
    } else e.steam?.stop();
    G.emit('gen:state', e.id, st);
    S.running = count();
    if (S.running === list.length && !S.beacon.powered) { S.beacon.powered = true; G.emit('beacon:on'); }
  };
  S.crank = (id, dt) => {
    let e = null; for (let i = 0; i < list.length; i++) if (list[i].id === id) e = list[i];
    if (!e || e.state === 'running') return e ? e.progress : 0;
    setState(e, 'cranking'); e.idle = 0;
    e.progress = Math.min(1, e.progress + dt / RULES.crankHold);
    G.emit('noise', e.pos.x, e.pos.z, RULES.hearCrank);
    if (e.progress >= 1) setState(e, 'running');
    return e.progress;
  };
  S.nearest = (p, range = RULES.interactRange) => {
    let best = null, bd = range * range;
    for (let i = 0; i < list.length; i++) { const e = list[i], d = (e.pos.x - p.x) ** 2 + (e.pos.z - p.z) ** 2; if (d < bd) { bd = d; best = e; } }
    return best;
  };
  S.setRunning = (id) => { for (let i = 0; i < list.length; i++) if (list[i].id === id) setState(list[i], 'running'); };
  S.reset = () => {
    for (let i = 0; i < list.length; i++) { const e = list[i]; e.progress = 0; e.chug = 0; setState(e, 'off'); e.group.position.copy(e.base); e.group.rotation.z = 0; e.lever.rotation.z = LEVER_REST; e.flap.rotation.z = 0; }
    S.beacon.powered = false; S.running = 0;
  };

  S.update = (dt, t) => {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      let ax = 0, ay = 0, rz = 0, flapT = 0, lamp = 0;
      if (e.state === 'cranking') {
        if ((e.idle += dt) > 0.25) { e.progress = Math.max(0, e.progress - dt * 0.5); if (e.progress <= 0) setState(e, 'off'); }
      }
      if (e.state === 'cranking') {
        // starter chugs: rate rises as the engine catches; each chug shakes the skid, kicks the flap, coughs a puff
        e.chug += dt * (2.6 + 5.5 * e.progress);
        const n = Math.floor(e.chug), f = e.chug - n, pulse = Math.pow(Math.max(0, Math.sin(f * Math.PI)), 3);
        if (n !== e.chugN) {
          e.chugN = n;
          if (fx?.smoke) { _v.set(0.4, 1.3 + e.progress, 0.1); fx.smoke(e.exhaust, { count: 1, size: 0.1, grow: 1.8, life: 1.4, color: [0.09, 0.085, 0.08], opacity: 0.32 + 0.3 * e.progress, spread: 0.04, vel: _v, rise: 0.7 }); }
        }
        ay = 0.0028 * pulse; ax = 0.0018 * pulse * Math.sin(f * 40 + e.ph); rz = 0.0012 * pulse;
        flapT = 0.75 * pulse * (0.4 + e.progress);
        e.lever.rotation.z = LEVER_REST + (LEVER_PULL - LEVER_REST) * (0.5 - 0.5 * Math.cos(e.chug * 1.1));
        lamp = (t * 4) % 1 < 0.5 ? 3.2 : 0.25;
        e.lamp.emissive.setRGB(1.0, 0.55, 0.08);
      } else {
        e.lever.rotation.z += (LEVER_REST - e.lever.rotation.z) * Math.min(1, dt * 6);
        if (e.state === 'running') {
          const w = t + e.ph;
          ay = 0.0007 * Math.sin(w * 151) + 0.0004 * Math.sin(w * 97.3);
          ax = 0.0006 * Math.sin(w * 133.7); rz = 0.0005 * Math.sin(w * 71.1);
          flapT = 0.62 + 0.16 * Math.sin(w * 23.0) + 0.09 * Math.sin(w * 37.7);
          lamp = 4.5;                                           // steady: vibration moves geometry, never brightness
          e.lamp.emissive.setRGB(0.25, 1.0, 0.35);
        }
      }
      // faulty unit C: arcing at the loose exciter lead — sparks, a blue flash light, the lamp stutters red
      if (e.faulty && fx) {
        e.sparkT -= dt; e.arc = Math.max(0, e.arc - dt); e.fizzT -= dt;
        if (e.fizzT <= 0) { // constant fizz at the bare lead: 2-4 short sparks every 0.08-0.3 s, so it always reads
          e.fizzT = 0.08 + rnd() * 0.22;
          _n.copy(e.sparkDir); _n.y += (rnd() - 0.5) * 0.8; _n.normalize();
          fx.sparks?.(_p.copy(e.spark), _n, { count: 3 + Math.floor(rnd() * 4), speed: 2.2, spread: 0.9, life: 0.65, size: 0.016, heat: 1, bright: 3.5 });
          fx.glow?.(e.spark.x, e.spark.y, e.spark.z, 0.1 + rnd() * 0.08, 0.09, 0.62, 0.78, 1.0, 7);
        }
        if (e.sparkT <= 0) {
          const busy = e.state !== 'off';
          e.sparkT = busy ? 0.25 + rnd() * 0.6 : 0.5 + rnd() * 1.1;
          e.arc = 0.12;
          _n.copy(e.sparkDir); _n.y += (rnd() - 0.3) * 0.5; _n.normalize();
          fx.sparks?.(_p.copy(e.spark), _n, { count: 14 + Math.floor(rnd() * 14), speed: 2.6, spread: 1.0, life: 0.9, size: 0.02, heat: 1, bright: 3.2 });
          fx.glow?.(e.spark.x, e.spark.y, e.spark.z, 0.3, 0.12, 0.62, 0.78, 1.0, 10);
          fx.lights?.flash?.(e.spark.x, e.spark.y + 0.05, e.spark.z, 0.55, 0.7, 1.0, 9, 0.08, 4.5, 0.6);
        }
        // off: the red fault lamp holds a steady dim glow and pops to full only for the duration of an arc (no
        // per-frame modulation; a 90 rad/s sine aliased into random jitter at capture frame rates)
        if (e.state === 'off') { lamp = e.arc > 0 ? 3.0 : 0.15; e.lamp.emissive.setRGB(1.0, 0.12, 0.05); }
      }
      e.lamp.emissiveIntensity = lamp;
      if (shot) { ax = 0; ay = 0; rz = 0; }
      e.group.position.set(e.base.x + ax, e.base.y + ay, e.base.z);
      e.group.rotation.z = rz;
      e.flap.rotation.z += (flapT - e.flap.rotation.z) * Math.min(1, dt * (flapT > e.flap.rotation.z ? 30 : 9));
    }
    // beacon: incandescent 1.2 s flash once powered (rises, holds, fades); aviation lamps always on, dim
    let on = 0;
    if (S.beacon.powered) { const ph = (t % 1.2) / 1.2; on = ph < 0.5 ? Math.pow(Math.sin((ph / 0.5) * Math.PI), 0.55) : 0; }
    beaconMat.emissiveIntensity = 0.04 + on * 16;
    if (beaconLight) {
      if (beaconLight.light) beaconLight.light.intensity = on * 1500;
      if (beaconLight.halo) beaconLight.halo.uniforms.uStrength.value = AVIA_HALO + on * 12;
    }
  };
  // showcase / tests: ?gen=A,B starts those units; ?show=generators starts A so the hero frame shows a live unit
  const want = (G.params.get('gen') || (G.params.get('show') === 'generators' ? 'A' : '')).split(',');
  for (const id of want) if (id) S.setRunning(id);
  S.update(0, 0);
  _inst = S;
  return S;
}

// ?show=generators: generator A close-up from the panel side (pose-3 family), unit A running. The torch is off (as
// in ?show=atmosphere): every light on the skid has a visible source (the lean-to wall lamp, the panel lamp), and
// the torch's animated volumetric beam no longer crawls over the static hero. The gust is pinned low so the blowing
// snow and the fog density hold still between frames.
export const SHOW_CAM = [11.0, 1.72, -32.75, 8.0, 0.72, -34.45];
export function showcase(G) {
  const torchOff = () => G?.mods?.flashlight?.setOn?.(false);
  const calm = () => { const A = G?.mods?.atmosphere; if (A && A.hold == null) A.hold = 0.2; };
  torchOff(); calm();
  G?.on?.('ready', () => { torchOff(); calm(); });
  G?.on?.('game:start', torchOff);
  // an explicit ?cam= (capture --poses) wins over the showcase framing, so alternative poses can be compared
  const q = (G?.params?.get?.('cam') || '').split(',').map(Number), c = q.length === 6 && q.every(Number.isFinite) ? q : SHOW_CAM;
  return { cam: c.slice(0, 3), target: c.slice(3, 6), gen: _inst ? 'A' : null };
}
