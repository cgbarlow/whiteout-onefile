// STATION (critical world module): prefab modules, vehicle shed, generator lean-tos, radio hut, fuel tanks, masts,
// crates/drums, work lights + window glow (lighting/lights.js), stencilled signage (decals/canvas-text.js), lab interior.
//   create(G, { mats, lights }) → { root, colliders: Box3[], bounds: Box3, interior: {group, box, probeAt},
//                                   windows: [[x,y,z,side]], insideAt(x, z) → 'lab'|'radio'|'shed'|null, labLamp, update }
// Layout comes ONLY from contracts.js LAYOUT. The generators themselves and the beacon tower belong to modules/generators.
// Files: parts.js (kit helpers), modules.js (prefab shells + roof/wall gear), lab.js (hollow interiors + lab dressing),
// buildings.js (shed + snowcat, lean-tos), props.js (tanks, masts, poles, clusters), signs.js (decals), textures.js
// (window/frost/screen canvases + station materials), anim.js (flags, windsock, anemometers).
import { Box3, Vector3, Group, Mesh, PlaneGeometry } from 'three';
import { Kit } from '../../cookbook/geo/kit.js';
import { SKit } from './parts.js';
import { LAYOUT as L, SEED } from '../../contracts.js';
import { moduleShell, moduleGear, STYLES } from './modules.js';
import { lineShell, labDressing, radioDressing } from './lab.js';
import { vehicleShed, leanTo } from './buildings.js';
import { fuelTank, mast, workLightPole, crateCluster, drumCluster, drumRack, containerAt, snowFence, cableRun, MARKS, WORK_LENS, WORK_TILT } from './props.js';
import { skidoo } from './skidoo.js';
import { trackRun } from './ruts.js';
import { createWear, driftAlong } from './wear.js';
import { banks, workArea, yardTails } from './yard.js';
import { buildSigns } from './signs.js';
import { stationMaterials } from './textures.js';
import { createAnim } from './anim.js';
import { gy, cable } from './parts.js';

export function create(G, { mats, lights }) {
  const t0 = performance.now(), ph = {}; let tl = t0;
  const mark = (n) => { const t = performance.now(); ph[n] = Math.round(t - tl); tl = t; };
  const rnd = G.rng(SEED + 11);
  const root = new Group(); root.name = 'station';
  const colliders = [], signs = [], glows = [];
  const push = (a) => { for (const b of a) colliders.push(b); };
  // k: exterior structure (AO baked) · d: exterior detail · ki/di: lab + radio interiors (probe-lit materials)
  const k = new SKit(), d = new SKit(), ki = new SKit(), di = new SKit();
  // detail kits share their structural kit's matrix stack: builders push a face frame on k and place rivets, screws,
  // grating and railings on d in that same face-local frame (separate stacks dropped all of it at the world origin)
  d.stack = k.stack; di.stack = ki.stack;
  const smats = stationMaterials(G); mark('tex');
  const lab = L.modules.find((m) => m.interior);
  let labInfo = null;

  // ---- prefab modules (+ the radio hut, same kit family, hollow)
  const radio = { id: 'radio', name: 'RADIO', c: L.radioHut.c, size: L.radioHut.size, h: L.radioHut.h, floor: 0.25, door: L.radioHut.door, doorFace: L.radioHut.doorFace };
  const doors = [], wear = [];
  MARKS.blobs.length = 0; MARKS.stencils.length = 0;
  for (const m of [...L.modules, radio]) {
    const st = STYLES[m.id], hollow = !!m.interior || m.id === 'radio';
    const sh = moduleShell(k, d, m, st, rnd, { hollow });
    const gr = moduleGear(k, d, m, st, rnd);
    if (gr) { doors.push(...gr.doors); signs.push(...gr.signs); push(gr.colliders); }
    wear.push(...sh.wear);
    doors.push(sh.door);
    if (m.id !== 'radio') signs.push(...sh.signs);
    if (hollow) {
      const ls = lineShell(k, ki, di, m, sh, { open: m.id === 'radio' ? 1.3 : 1.9, dOut: d }); push(ls.colliders);
      if (m.interior) { const dr = labDressing(ki, di, m, rnd, ls.ih); push(dr.colliders); labInfo = { lamps: dr.lamps, glass: ls.glass, ih: ls.ih, labels: dr.labels }; }
      else push(radioDressing(ki, di, m, rnd).colliders);
    } else { push(sh.colliders); glows.push(...sh.glows); }
  }
  // ---- vehicle shed, lean-tos
  const shed = vehicleShed(k, d, L.shed, rnd); push(shed.colliders); signs.push(...shed.signs); doors.push({ at: shed.door, n: [-1, 0, 0], big: true });
  L.generators.forEach((g, i) => { const r = leanTo(k, d, g, rnd, i); push(r.colliders); signs.push(...r.signs); });
  // ---- fuel tanks, masts, work-light poles
  L.fuelTanks.forEach((t, i) => { const r = fuelTank(k, d, t, i, rnd); colliders.push(r.col); signs.push(r.sign); });
  const cups = [];
  L.masts.forEach((p, i) => { const r = mast(k, d, p, i, { h: i === 0 ? 12 : 9 + i * 0.8 }); colliders.push(r.col); if (r.cups) cups.push(r.cups); });
  L.workLights.forEach((p, i) => colliders.push(workLightPole(k, d, p, i)));
  // ---- set dressing (kept off the beaten paths and the stalker patrol line)
  push(drumCluster(d, d, [48.6, 20.2], rnd, 5, { lying: 1 }));               // pose-1 foreground under the mast
  push(crateCluster(d, d, [16.4, 8.8], rnd, 4)); push(crateCluster(d, d, [-5.8, -5.6], rnd, 3));
  push(crateCluster(d, d, [29.6, 19.6], rnd, 3)); push(crateCluster(d, d, [-41.2, -11.6], rnd, 2));
  push(drumCluster(d, d, [-18.2, 11.4], rnd, 5, { lying: 1 })); push(drumCluster(d, d, [11.6, -30.4], rnd, 4, { lying: 0 }));
  push(drumCluster(d, d, [9.4, 27.2], rnd, 4, { lying: 1 })); push(crateCluster(d, d, [11.2, 6.8], rnd, 2));
  colliders.push(drumRack(d, d, [-19.8, -1.8], 1.2, rnd));
  // north of the shed (spawn yaw 1): a container, the skidoo + sledge, a drum rack, a snow fence on the north berm
  colliders.push(containerAt(d, [42.2, 1.0], 0.12, 0x2f5d7c));
  colliders.push(skidoo(d, d, [39.6, 4.9], 0.35, rnd)); // on the flat lee of the shed drift (the crest at x 43-44 tipped it)
  push(drumCluster(d, d, [27.4, 12.6], rnd, 4, { lying: 1 })); // drums staged by the hab's utility end
  colliders.push(drumRack(d, d, [49.0, 3.4], 0.0, rnd));
  push(crateCluster(d, d, [38.6, -3.4], rnd, 3));
  snowFence(d, d, [26, -40], [56, -36], rnd); snowFence(d, d, [-30, -42], [-2, -43.5], rnd);
  // power: overhead runs from the lean-tos to the modules, a buried-ish run along the snow to the shed
  cableRun(d, d, [6.8, 27.6], [18, 8.4], 5); cableRun(d, d, [9.6, -31.6], [4.6, -14], 5);
  cableRun(d, d, [-25.4, 11.6], [-19.6, 3.6], 3); cableRun(d, d, [-19.6, 3.6], [-12.6, -18.2], 5); cableRun(d, d, [-26.6, -8], [-44, -13], 5);
  { const pts = []; for (let i = 0; i <= 14; i++) { const x = 30.2 + i * 1.12, z = 6.6 + Math.sin(i * 0.7) * 0.3; pts.push([x, gy(x, z) + 0.02, z]); } for (let i = 0; i < pts.length - 1; i++) cable(d, pts[i], pts[i + 1], 0.0, 0.02, 0x141516, 2); }

  // ---- snow banked against the modules / shed (lee tongues + windward ramps, door spans kept clear), a work area
  banks(d, L, doors); yardTails(d);
  push(workArea(k, d, rnd));
  // ---- contact AO + grime, then the un-baked detail joins the same per-material meshes
  const low = G.quality.tier === 'low';
  mark('kits');
  k.bakeAO({ ground: 0, samples: low ? 6 : 8, radius: 0.4 }); mark('ao');
  k.grime({ base: 0, streak: 0.4, foot: 0.5 });
  // detail: a cheap grime (no fbm): splash band at the foot, darker undersides, a hashed per-vertex value jitter
  d.grime((x, y, z, nx, ny) => { const h = Math.max(0, Math.min(1, y / 0.5)), j = Math.sin(x * 12.9898 + z * 78.233 + y * 3.1) * 43758.5453; return (0.8 + 0.2 * h * h) * (1 - 0.3 * Math.max(0, -ny)) * (0.94 + 0.06 * (j - Math.floor(j))); }, ['paint', 'steel', 'concrete', 'wood']); mark('grime');
  ki.bakeAO({ ground: lab.floor, samples: low ? 6 : 8, radius: 0.45, strength: 0.85 });
  // lab surfaces: low-frequency value blotches (±12 %), scuffed / darker kick zone at the wall feet, soot along the
  // wall-ceiling junction, darker undersides (the probe-lit interior otherwise reads as flat grey card)
  { const f0 = lab.floor, top = f0 + labInfo.ih;
    const nz = (x, y, z) => { const a = Math.sin(x * 1.7 + z * 0.9) * Math.sin(z * 2.3 - x * 0.6 + y * 1.1), b = Math.sin(x * 7.1 + y * 5.3 + z * 6.7) * 43758.5453; return 0.5 + 0.35 * a + 0.15 * (b - Math.floor(b)); };
    ki.grime((x, y, z, nx, ny) => { const v = 1 - Math.abs(ny), h = y - f0, n = nz(x, y, z);
      const kickZ = v * (1 - Math.min(1, h / 0.3)) * 0.22, ceil = v * Math.max(0, 1 - (top - y) / 0.3) * 0.2, under = Math.max(0, -ny) * 0.12;
      return (0.88 + 0.24 * n) * (1 - kickZ) * (1 - ceil) * (1 - under); }, ['iface', 'isteel']); }
  mark('aoLab');
  for (const [src, dst] of [[d, k], [di, ki]]) for (const [key, geos] of src.buckets) { if (!dst.buckets.has(key)) dst.buckets.set(key, []); dst.buckets.get(key).push(...geos); }
  const outer = k.build({ paint: mats.paint, steel: mats.steel, dark: mats.dark, concrete: mats.concrete, wood: mats.wood, glass: mats.glassLit, win: smats.win, pane: smats.pane, gloss: smats.gloss, tint: smats.tint, snow: mats.snowGround || mats.concrete, default: mats.steel });
  outer.name = 'station-exterior';
  const labGroup = new Group(); labGroup.name = 'lab';
  const inner = ki.build({ iface: mats.iface, isteel: mats.isteel, idark: mats.idark, frost: smats.frost, screen: smats.screen, diffuser: smats.diffuser, default: mats.isteel });
  for (const m of [...outer.children, ...inner.children]) if (/frost|win|screen|diffuser|glass|pane|tint|snow/.test(m.name)) m.castShadow = false;
  labGroup.add(inner);
  // ceiling bounce card above the working tube (additive, follows the failing-tube ratio; the probe sees a lit ceiling)
  const lab_ = { glow: null };
  { const [gx, , gz] = labInfo.lamps[1], gm = new Mesh(new PlaneGeometry(6.4, 4.6), smats.glow);
    gm.rotation.x = Math.PI / 2; gm.position.set(gx, lab.floor + labInfo.ih - 0.004, gz); gm.renderOrder = 3; gm.castShadow = false; gm.name = 'lab-ceilglow';
    root.add(gm); lab_.glow = gm; } // outside labGroup: probe.assign would put an envMap on it (MeshBasic multiplies by it)
  root.add(outer, labGroup); mark('meshes');

  // ---- signage + dirty snow decals
  const S = buildSigns(G, { modules: L.modules });
  for (const s of signs) {
    const w = { hab: 1.7, lab: 1.6, mess: 1.3, store: 1.4, shed: 2.2, diesel: 0.9, hv: 0.36, nosmoke: 0.46, genA: 1.25, genB: 1.25, genC: 1.25, exitOut: 0.5, hvs: 0.14, dbA: 0.26, dbB: 0.26, dbC: 0.26, cat: 0.5 }[s.name] ?? 0.9;
    S.wall(s.name, w, s.at, s.ry, !!s.inside);
  }
  { const [x, z] = L.radioHut.c, hx = L.radioHut.size[0] / 2; S.wall('radio', 0.9, [x + hx + 0.04, 1.75, z - 0.95], Math.PI / 2); S.wall('hv', 0.32, [x + hx + 0.04, 1.75, z + 0.9], Math.PI / 2); }
  // lab interior: door sign, notices, exit, whiteboard on the west wall, -80 label on the freezer
  { const [cx, cz] = lab.c, [sx, sz] = lab.size, f = lab.floor, x0 = cx - sx / 2 + 0.16, x1 = cx + sx / 2 - 0.16, zN = cz - sz / 2 + 0.16;
    S.wall('labsign', 0.8, [cx + sx / 2 + 0.04, f + 2.35, L.modules.find((m) => m.interior).door[1] + 1.0], Math.PI / 2);
    S.wall('wb', 1.4, [x0 + 0.04, f + 1.85, cz], Math.PI / 2, true, 0.84);
    S.wall('protocol', 0.42, [x0 + 4.0, f + 1.6, zN + 0.005], 0, true);
    S.wall('exit', 0.42, [x1 - 0.005, f + 2.45, cz - 0.0], -Math.PI / 2, true);
    S.wall('m80', 0.26, [x0 + 0.715, f + 0.65, cz], Math.PI / 2, true);
    for (const [name, w, at, ry, h] of labInfo.labels) S.wall(name, w, at, ry, true, h ?? null); }
  for (const dr of doors) { // slush at every door, oriented along the walking direction
    const ry = Math.atan2(dr.n[0], dr.n[2]);
    S.ground(rnd() < 0.5 ? 'slush0' : 'slush1', dr.big ? 6 : 3.2, dr.big ? 5 : 3.2, dr.at[0] + dr.n[0] * (dr.big ? 1.2 : 0.4), dr.at[2] + dr.n[2] * (dr.big ? 1.2 : 0.4), ry);
  }
  for (const g of L.generators) S.ground('slush1', 3.4, 3.0, g.c[0] + 3.0, g.c[1] + 0.3, 1.2);
  for (const t of L.fuelTanks) S.ground('slush0', 2.6, 2.6, t[0] + Math.sin(t[2]) * 2.2, t[1] + Math.cos(t[2]) * 2.2, t[2]);
  // beaten paths: shed → hab porch → lab door, shed → GEN B, lab → GEN A, lab → mess → GEN C
  const path = (a, b, w = 1.6) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4.2); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = a[0] + (b[0] - a[0]) * t + (rnd() - 0.5) * 0.6, z = a[1] + (b[1] - a[1]) * t + (rnd() - 0.5) * 0.6; S.ground('trail', w, 4.6, x, z, Math.atan2(b[0] - a[0], b[1] - a[1]) + (rnd() - 0.5) * 0.25); } };
  path([43, 12], [14.5, 5.5]); path([11.2, 4], [8.6, -8.6]); path([42, 13.5], [9, 28.5]); path([8.2, -11.6], [10.6, -31.5]);
  path([7.6, -11.8], [-7, -21.5]); path([-8.6, -20.4], [-25, 12]); path([-24, 12.6], [-43, -14.4], 1.3);
  S.build(root, labGroup); mark('signs');
  // ---- weathering decals: rust / drips / frost on the walls, contact blobs, crate stencils, snowcat tracks
  const W = createWear(G);
  for (const w of wear) W.wall(w.name, w.w, w.h, w.at, w.ry);
  for (const s of MARKS.stencils) W.wall(s.name, 0.62, null, s.at, s.ry);
  for (const [x, z, bw, bd, ry] of MARKS.blobs) W.ground('ao', bw, bd, x, z, ry, 0.02);
  for (const m of [...L.modules, radio]) W.ground('ao', m.size[0] + 1.6, m.size[1] + 1.6, m.c[0], m.c[1], 0, 0.018);
  for (const t of L.fuelTanks) W.ground('ao', 7.2, 3.4, t[0], t[1], t[2] + Math.PI / 2, 0.018);
  trackRun(W, [[45.5, 11.4], [36, 10.2], [27, 9.6], [19, 9.2], [11.6, 6.4], [9.6, -1]], G.rng(SEED + 23)); // snowcat run: shed → hab → lab
  W.build(root); mark('wear');

  // ---- motion: route-marker flag line north of the shed + by the tanks, windsock, anemometers
  const flags = [];
  for (let i = 0; i < 9; i++) { const x = 39.6 - i * 0.35, z = 1.0 - i * 5.2; flags.push([x, gy(x, z) + 2.05, z, i % 2 ? 0x1c1c1e : 0xb02418]); }
  for (let i = 0; i < 4; i++) { const x = -15.5 - i * 3.6, z = 0.4 + i * 0.4; flags.push([x, gy(x, z) + 1.95, z, 0x2a6a3a]); }
  const anim = createAnim(G, mats, { flags, sock: [40.6, 4.2, 17.6], cups });
  const pk = new Kit();
  for (const f of flags) { pk.cyl(0.016, 2.1, 'wood', { at: [f[0], f[1] - 1.0, f[2]], seg: 6, color: 0x9a8a5a }); }
  root.add(pk.build({ wood: mats.wood }), anim.group);
  colliders.push(new Box3(new Vector3(40.4, 0, 17.4), new Vector3(40.8, 4.2, 17.8)));

  // ---- practical lights: work lights (real, sodium), window glow pools, door lamps, lab fluorescent (real)
  const hideBulb = (it) => { it?.group?.traverse((m) => { if (m.isMesh && m.material === it.emisMat) m.visible = false; }); return it; };
  // work lights: the lamp sits on the floodlight lens (props.js head); its emissive bulb is flattened into a glowing
  // disc in the lens plane, so every beam / pool / halo has a visible source on the pole
  for (const [x, z] of L.workLights) {
    const it = lights.add({ position: [x + WORK_LENS[0], WORK_LENS[1] - 0.012 * Math.sin(WORK_TILT), z + WORK_LENS[2] + 0.012 * Math.cos(WORK_TILT)], kind: 'none', color: [1, 0.66, 0.36], intensity: 90, groundY: 0, real: true, haloStrength: 0.8, haloSize: 0.6 });
    it?.group?.traverse((m) => { if (m.isMesh && m.material === it.emisMat) { m.scale.set(2.9, 0.16, 1.75); m.rotation.x = WORK_TILT - Math.PI / 2; } });
  }
  glows.sort((a, b) => b[5] - a[5]);
  for (const w of glows.slice(0, 12)) {
    const px = w[0] - w[3] * 0.25, pz = w[2] - w[4] * 0.25, py = w[1] + 0.3;
    hideBulb(lights.add({ position: [px, py, pz], type: 'spot', target: [px + w[3] * 3.2, 0, pz + w[4] * 3.2], angle: 0.95, penumbra: 0.75, kind: 'none', color: [1, 0.62, 0.32], intensity: 70 * w[5], groundY: 0, real: false, pool: 'always', poolRadius: 4.6, halo: false }));
  }
  for (const g of labInfo.glass) hideBulb(lights.add({ position: [g[0] + g[3] * 0.1, g[1], g[2] + g[4] * 0.1], kind: 'none', color: [0.8, 0.88, 1.0], intensity: 6, groundY: 0, real: false, pool: 'always', poolRadius: 2.6, halo: false }));
  for (const dr of doors) if (dr.lamp) hideBulb(lights.add({ position: [dr.lamp[0] + dr.n[0] * 0.1, dr.lamp[1], dr.lamp[2] + dr.n[2] * 0.1], kind: 'none', color: [1, 0.68, 0.4], intensity: 16, groundY: 0, real: false, pool: 'always', poolRadius: 2.8, halo: true, haloStrength: 0.45, haloSize: 0.5 }));
  // flicker 0: no per-frame noise. look/practicals failingTube owns the intensity (steady, rare deterministic bursts,
  // none under ?shot=1); the ceiling bounce card + diffuser follow its ratio in update()
  const labLamp = hideBulb(lights.add({ position: labInfo.lamps[1], kind: 'none', color: [0.86, 0.92, 1.0], intensity: 22, range: 9, real: true, pool: false, flicker: 0, halo: false }));
  const window_ = glows.map((w) => [w[0], w[1], w[2], Math.sign(w[3] + w[4])]);

  // ---- interior + enterable zones (hide spots): lab, radio hut, vehicle shed
  const [lcx, lcz] = lab.c, [lsx, lsz] = lab.size, lf = lab.floor;
  const interior = {
    group: labGroup,
    box: new Box3(new Vector3(lcx - lsx / 2, lf, lcz - lsz / 2), new Vector3(lcx + lsx / 2, lf + lab.h, lcz + lsz / 2)),
    probeAt: [lcx + 1.0, lf + 1.6, lcz],
  };
  const R = L.radioHut, SH = L.shed;
  const zones = [
    { id: 'lab', b: interior.box },
    { id: 'radio', b: new Box3(new Vector3(R.c[0] - R.size[0] / 2, 0, R.c[1] - R.size[1] / 2), new Vector3(R.c[0] + R.size[0] / 2, 3, R.c[1] + R.size[1] / 2)) },
    { id: 'shed', b: new Box3(new Vector3(SH.c[0] - SH.size[0] / 2, 0, SH.c[1] - SH.size[1] / 2), new Vector3(SH.c[0] + SH.size[0] / 2, 5, SH.c[1] + SH.size[1] / 2)) },
  ];
  const insideAt = (x, z) => { for (let i = 0; i < zones.length; i++) { const b = zones[i].b; if (x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z) return zones[i].id; } return null; };

  // the lab diffuser follows the failing tube (look/practicals drives mats.lamp; we mirror its ratio, no allocation)
  const lampBase = mats.lamp?.emissiveIntensity || 1, diffBase = smats.diffuser.emissiveIntensity, glowBase = smats.glow.opacity;
  function update(dt, t) {
    anim.update(dt, t);
    const r = mats.lamp ? mats.lamp.emissiveIntensity / lampBase : 1, f = Math.max(0.03, (r - 0.15) / 0.85);
    smats.diffuser.emissiveIntensity = diffBase * f;
    if (lab_.glow) smats.glow.opacity = glowBase * f;
  }
  G.on('update', update);

  G.scene.add(root);
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root);
  let tris = 0; root.traverse((m) => { if (m.isMesh && m.geometry.index) tris += m.geometry.index.count / 3; });
  mark('rest'); const buildMs = performance.now() - t0;
  G.statsHooks?.push(() => ({ stationMs: Math.round(buildMs), stationTris: tris, stationPhases: ph }));
  return { root, colliders, bounds, interior, windows: window_, insideAt, labLamp, atlas: S.atlas, selfUpdating: true, update() {}, dispose() { G.off?.('update', update); G.scene.remove(root); } };
}

// ?show=station: the hab/lab row from the south-east at eye height
// (the hab's exit end + utility end in frame, the beacon tower as the counterweight on the left; the gust is held
// so the two-frame shimmer test measures the scene, not the 20-30 s fog cycle ramping between the frames)
export function showcase(G) {
  const a = G?.mods?.atmosphere; if (a && a.hold == null) a.hold = 0.35;
  return { cam: [33.5, 1.75, 10.5], target: [18, 2.0, 2.5] };
}
