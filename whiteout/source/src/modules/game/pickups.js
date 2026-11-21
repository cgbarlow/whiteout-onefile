// Game-owned interactables that need a body in the world (load-time geometry, allocation-free per-frame state):
//  - spare torch CELLS: a bevelled rechargeable cell pack (grip ribs, hazard-yellow label band, cap, brass terminals).
//    LAYOUT.batteries entries inside an enterable module (the lab) sit in a bench charging dock; entries inside a
//    closed module (hab, mess, store) move to a wall-mounted charger beside that module's door (rain hood with snow,
//    open housing, dock, status LED, conduit to the snow, stencilled plate) so every cell is reachable.
//  - the EXTRACTION unit on the radio-hut desk: a gooseneck desk mic with a PTT bar + a 3-LED status strip
//    (PWR amber on backup → green when the beacon is powered, BCN flashing with the beacon, TX amber while calling,
//    green once the call is through).
//   createPickups(G, { heightAt }) → { cells: [{ pos (cell world pos), stand (Vector3 where a bot stands), yaw, taken, kind }],
//     setTaken(cell, b), console: { at, stand, yaw }, setConsole(powered, calling 0..1, done, t), update(dt, t), dispose }
import { Group, Mesh, MeshStandardMaterial, Color, Vector3 } from 'three';
import { Kit, roundedBox } from '../../cookbook/geo/kit.js';
import { makeMaterial } from '../../cookbook/materials/library.js';
import { DecalAtlas, signCanvas, decalGeo, decalMaterial } from '../../cookbook/decals/canvas-text.js';
import { LAYOUT as L } from '../../contracts.js';

const FACE_RY = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': 0, '-z': Math.PI };
const FACE_N = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };
const BENCH_TOP = 1.222;       // lab bench worktop (floor 0.3 + carcass + top), measured on the station build
const CHARGER_Y = 1.02;        // wall charger housing bottom above the snow
const RADIO_DESK = 1.03;       // radio-hut desk top (floor 0.25 + 0.78)

function lib(name, opts, fb) {
  let m;
  try { m = makeMaterial(name, opts); } catch (e) { m = new MeshStandardMaterial(fb); }
  m.vertexColors = true;
  return m;
}
function led(hex) {
  const m = new MeshStandardMaterial({ color: 0x0b0b0b, emissive: new Color(hex), emissiveIntensity: 0, roughness: 0.25 });
  m.userData.noWeather = true;
  return m;
}

// the cell pack, upright, base at y = 0 (76 × 150 × 50 mm)
function cellKit(k) {
  k.box(0.07, 0.15, 0.048, 'cell', { at: [0, 0.075, 0], r: 0.009, color: 0x2a2d31 });
  k.box(0.0716, 0.068, 0.0496, 'cell', { at: [0, 0.084, 0], r: 0.008, color: 0xd6a21e });            // label band
  k.box(0.0722, 0.007, 0.0502, 'cell', { at: [0, 0.071, 0], r: 0.002, color: 0x16171a });            // black rule
  k.box(0.0722, 0.004, 0.0502, 'cell', { at: [0, 0.106, 0], r: 0.0015, color: 0x16171a });
  for (let i = 0; i < 3; i++) k.box(0.0722, 0.0035, 0.0502, 'cell', { at: [0, 0.016 + i * 0.011, 0], r: 0.0015, color: 0x1b1d20 }); // grip ribs
  k.box(0.058, 0.012, 0.038, 'cell', { at: [0, 0.155, 0], r: 0.004, color: 0x1a1b1e });             // cap
  for (const x of [-0.016, 0.016]) k.cyl(0.0055, 0.009, 'metal', { at: [x, 0.164, 0], seg: 10, color: x < 0 ? 0xc89a52 : 0xb0b4b8 });
  k.box(0.012, 0.002, 0.001, 'metal', { at: [0.016, 0.1695, 0], r: 0, color: 0x30302c });
}
// bench dock: base at y = 0, front +z; the cell stands at (0, 0.03, 0)
function dockKit(k) {
  k.box(0.13, 0.034, 0.1, 'dark', { at: [0, 0.017, 0], r: 0.01, color: 0x2a2d30 });
  k.box(0.088, 0.012, 0.064, 'dark', { at: [0, 0.036, 0], r: 0.004, color: 0x17181a });
  k.box(0.04, 0.008, 0.004, 'steel', { at: [0, 0.02, 0.0505], r: 0.001, color: 0x8a9096 });           // brand strip
  k.tube([[0.055, 0.008, -0.05], [0.06, 0.004, -0.09], [0.04, 0.003, -0.16]], 0.0035, 'dark', { radial: 5, curve: true, samples: 6, color: 0x141516 });
}
// wall charger: wall plane z = 0 (outward +z), housing bottom at y = 0; the cell stands at (0, 0.062, 0.085)
function chargerKit(k, groundY) {
  k.box(0.42, 0.66, 0.012, 'steel', { at: [0, 0.2, 0.006], r: 0.004, color: 0x6a7075 });            // backplate
  for (const x of [-0.17, 0.17]) k.box(0.022, 0.46, 0.15, 'paint', { at: [x, 0.23, 0.087], r: 0.006, color: 0xd09a1c });
  k.box(0.362, 0.022, 0.15, 'paint', { at: [0, 0.449, 0.087], r: 0.006, color: 0xd09a1c });
  k.box(0.362, 0.03, 0.15, 'paint', { at: [0, 0.015, 0.087], r: 0.006, color: 0xd09a1c });
  k.box(0.318, 0.42, 0.01, 'dark', { at: [0, 0.23, 0.018], r: 0.002, color: 0x1c1e21 });              // dark interior
  k.box(0.33, 0.008, 0.012, 'dark', { at: [0, 0.31, 0.158], r: 0.002, color: 0x232528 });             // front lip rail
  k.box(0.14, 0.03, 0.094, 'dark', { at: [0, 0.045, 0.085], r: 0.008, color: 0x2a2d30 });            // dock
  k.box(0.09, 0.008, 0.062, 'dark', { at: [0, 0.062, 0.085], r: 0.003, color: 0x141517 });
  k.box(0.07, 0.11, 0.03, 'dark', { at: [0.1, 0.38, 0.04], r: 0.006, color: 0x2e3134 });             // transformer box
  k.box(0.44, 0.016, 0.21, 'paint', { at: [0, 0.474, 0.1], rot: [0.1, 0, 0], r: 0.005, color: 0xc08a18 }); // rain hood
  k.box(0.405, 0.028, 0.18, 'snow', { at: [0, 0.495, 0.095], rot: [0.1, 0, 0], r: 0.013, color: 0xffffff });
  for (const [x, y] of [[-0.18, -0.1], [0.18, -0.1], [-0.18, 0.5], [0.18, 0.5]]) k.cyl(0.008, 0.008, 'steel', { at: [x, y, 0.014], rot: [Math.PI / 2, 0, 0], seg: 6, color: 0x9aa0a6 });
  // conduit down the wall to the snow, with clips
  const yb = groundY - 0.05;
  k.tube([[0.12, 0.005, 0.03], [0.12, -0.06, 0.03], [0.12, yb, 0.03]], 0.012, 'steel', { radial: 8, color: 0x5a6066 });
  for (let y = -0.2; y > yb + 0.15; y -= 0.32) k.box(0.04, 0.014, 0.03, 'steel', { at: [0.12, y, 0.022], r: 0.003, color: 0x7a8086 });
}
// gooseneck desk mic, base at y = 0, user toward +z
function micKit(k) {
  k.box(0.13, 0.03, 0.11, 'dark', { at: [0, 0.015, 0], r: 0.012, color: 0x26292c });
  k.box(0.07, 0.01, 0.026, 'red', { at: [0, 0.034, 0.03], r: 0.004, color: 0xa82418 });                // PTT bar
  k.cyl(0.016, 0.018, 'steel', { at: [0, 0.039, -0.025], seg: 12, color: 0x8a9096 });
  k.tube([[0, 0.045, -0.025], [0, 0.16, -0.03], [0, 0.25, 0.0], [0, 0.29, 0.06]], 0.0055, 'dark', { radial: 7, curve: true, samples: 14, color: 0x1a1b1d });
  k.push(0, 0.295, 0.085, 0, -0.35, 0);
  k.cyl(0.021, 0.07, 'dark', { at: [0, 0, 0], rot: [Math.PI / 2, 0, 0], seg: 16, color: 0x1d1f22 });
  k.cyl(0.0225, 0.012, 'steel', { at: [0, 0, 0.03], rot: [Math.PI / 2, 0, 0], seg: 16, color: 0x6a7076 });
  k.cyl(0.019, 0.004, 'dark', { at: [0, 0, 0.037], rot: [Math.PI / 2, 0, 0], seg: 16, color: 0x0c0d0e });
  k.pop();
  k.tube([[-0.05, 0.008, -0.055], [-0.07, 0.003, -0.12], [-0.02, 0.002, -0.2]], 0.003, 'dark', { radial: 5, curve: true, samples: 6, color: 0x111213 });
}
// status strip: base at y = 0, front +z, three LED sockets at x = -0.045, 0, 0.045
function stripKit(k) {
  k.add(roundedBox(0.17, 0.05, 0.075, 0.008, 2), 'dark', { at: [0, 0.025, 0], color: 0x2c2f33 });
  k.box(0.15, 0.03, 0.006, 'dark', { at: [0, 0.03, 0.038], rot: [-0.2, 0, 0], r: 0.002, color: 0x141517 });
  for (const x of [-0.045, 0, 0.045]) k.cyl(0.008, 0.004, 'steel', { at: [x, 0.031, 0.04], rot: [Math.PI / 2 - 0.2, 0, 0], seg: 10, color: 0x7a8086 });
  k.box(0.024, 0.016, 0.02, 'red', { at: [0.068, 0.058, 0.0], r: 0.004, color: 0xa82418 });            // key switch guard
}

export function createPickups(G, { heightAt = null } = {}) {
  const root = new Group(); root.name = 'game-pickups';
  const shot = !!G.params.get('shot');
  const inMat = (o) => ({ ...o, weather: 'sheltered' });
  const M = {
    cell: lib('plastic', { tint: 0xffffff, weather: 'prop' }, { roughness: 0.5 }),
    metal: lib('galvanised', { tint: 0xffffff, weather: 'sheltered' }, { roughness: 0.3, metalness: 1 }),
    dark: lib('plastic', inMat({ tint: 0xffffff }), { roughness: 0.55 }),
    darkOut: lib('plastic', { tint: 0xffffff, weather: 'prop' }, { roughness: 0.55 }),
    steel: lib('galvanised', { tint: 0xffffff, weather: 'prop' }, { roughness: 0.4, metalness: 1 }),
    steelIn: lib('galvanised', inMat({ tint: 0xffffff }), { roughness: 0.4, metalness: 1 }),
    paint: lib('painted_metal', { tint: 0xffffff, scale: 1.2, weather: { preset: 'prop', edge: 0.9 } }, { roughness: 0.5 }),
    red: lib('plastic', inMat({ tint: 0xffffff }), { roughness: 0.45 }),
    snow: lib('snow', { tint: 0xffffff, weather: 'sheltered' }, { roughness: 0.8 }),
    green: led(0x38ff6a), redLed: led(0xff2a14),
  };
  M.dark.name = 'game-dark'; M.paint.name = 'game-paint';
  // one decal plate ('TORCH CELLS') shared by the wall chargers
  const atlas = new DecalAtlas(512, 4);
  atlas.add('cells', signCanvas({ w: 0.3, h: 0.08, ppm: 600, bg: '#e9e4d6', lines: [{ text: 'TORCH CELLS', size: 0.6 }], rivets: false, wear: 0.4, dirt: 0.45 }));
  const decalMat = decalMaterial(atlas.finish(G.renderer), { roughness: 0.6 });
  const dk = new Kit();
  const ledGeo = roundedBox(0.02, 0.012, 0.008, 0.003, 1);
  const ledDot = roundedBox(0.014, 0.014, 0.006, 0.0055, 2);

  // cell template (shared geometry): one Group per cell so a taken cell just hides
  const ck = new Kit(); cellKit(ck); ck.bakeAO({ samples: 6, radius: 0.03, ground: 0 });
  const cellTpl = ck.build({ cell: M.cell, metal: M.metal });
  const cells = [];
  const ledMesh = (mat, geo, x, y, z, ry, rx = 0) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0, 'YXZ'); m.castShadow = false; m.matrixAutoUpdate = false; m.updateMatrix(); root.add(m); return m; };

  for (let i = 0; i < L.batteries.length; i++) {
    const [bx, bz] = L.batteries[i];
    const mod = L.modules.find((m) => Math.abs(bx - m.c[0]) < m.size[0] / 2 && Math.abs(bz - m.c[1]) < m.size[1] / 2);
    const k = new Kit();
    let cp, ry, stand, kind, ledG, ledR;
    if (!mod || mod.interior) {
      // bench dock in the lab: front toward the room centre
      const cz = mod ? mod.c[1] : bz;
      ry = bz < cz ? 0 : Math.PI;
      const fx = Math.sin(ry), fz = Math.cos(ry);
      k.push(bx, BENCH_TOP, bz, ry); dockKit(k); k.pop();
      cp = new Vector3(bx, BENCH_TOP + 0.03, bz);
      stand = new Vector3(bx + fx * 0.95, 0, bz + fz * 0.95);
      const lx = bx + fx * 0.0515 + Math.cos(ry) * 0.042, lz = bz + fz * 0.0515 - Math.sin(ry) * 0.042;
      ledG = ledMesh(M.green, ledDot, lx, BENCH_TOP + 0.02, lz, ry); ledR = ledMesh(M.redLed, ledDot, lx, BENCH_TOP + 0.02, lz, ry);
      kind = 'dock';
      cells[i] = { pos: cp, stand, yaw: Math.atan2(-(bx - stand.x), -(bz - stand.z)), taken: false, kind, ledG, ledR, grp: null, mod: mod?.id };
      k.bakeAO({ samples: 6, radius: 0.05, ground: BENCH_TOP });
      root.add(k.build({ dark: M.dark, steel: M.steelIn }));
    } else {
      // wall charger beside the closed module's door, on the side away from the door lamp
      const face = mod.doorFace, [nx, nz] = FACE_N[face];
      ry = FACE_RY[face];
      const tx = -nz, tz = nx;                                   // along the wall
      const side = mod.id === 'hab' ? -1.95 : -1.55;           // the hab's cold porch fills 2.8..5.3 m
      const wx = mod.door[0] + tx * side + nx * 0.005, wz = mod.door[1] + tz * side + nz * 0.005;
      const gy = heightAt ? heightAt(wx + nx * 0.2, wz + nz * 0.2) : 0;
      k.push(wx, gy + CHARGER_Y, wz, ry); chargerKit(k, -CHARGER_Y); k.pop();
      dk.push(wx, gy + CHARGER_Y, wz, ry); dk.add(decalGeo(atlas, 'cells', 0.3), 'decal', { at: [0, -0.075, 0.0135], occ: false }); dk.pop();
      cp = new Vector3(wx + nx * 0.085, gy + CHARGER_Y + 0.062, wz + nz * 0.085);
      stand = new Vector3(wx + nx * 0.85, 0, wz + nz * 0.85);
      // status LED on the hood's underside lip (front right), shows from the path
      const lx = wx + nx * 0.162 + tx * 0.12, lz = wz + nz * 0.162 + tz * 0.12, ly = gy + CHARGER_Y + 0.31;
      ledG = ledMesh(M.green, ledGeo, lx, ly + 0.01, lz, ry); ledR = ledMesh(M.redLed, ledGeo, lx, ly + 0.01, lz, ry);
      kind = 'wall';
      cells[i] = { pos: cp, stand, yaw: Math.atan2(-(cp.x - stand.x), -(cp.z - stand.z)), taken: false, kind, ledG, ledR, grp: null, mod: mod.id };
      k.bakeAO({ samples: 6, radius: 0.12 });
      k.grime({ base: gy, foot: 0.2, down: 0.4, streak: 0.5, scale: 3, seed: 31 + i }, ['paint', 'steel']);
      root.add(k.build({ paint: M.paint, steel: M.steel, dark: M.darkOut, snow: M.snow }));
    }
    const grp = cellTpl.clone();
    grp.position.copy(cp); grp.rotation.y = ry + (i % 2 ? 0.12 : -0.08);
    root.add(grp);
    cells[i].grp = grp;
  }
  if (dk.buckets.size) { const dm = dk.build({ decal: decalMat, default: decalMat }, { castShadow: false }); dm.traverse((m) => { if (m.isMesh) m.renderOrder = 2; }); root.add(dm); }

  // ---- radio console extraction unit (desk mic + status strip)
  const R = L.radioHut, deskZ = R.c[1] - R.size[1] / 2 + 0.16 + 0.36;       // desk centre line (station lab.js)
  const ck2 = new Kit();
  ck2.push(R.c[0] - 0.1, RADIO_DESK, deskZ + 0.2, 0.25); micKit(ck2); ck2.pop();
  ck2.push(R.c[0] + 0.28, RADIO_DESK, deskZ + 0.27, -0.12); stripKit(ck2); ck2.pop();
  ck2.bakeAO({ samples: 6, radius: 0.06, ground: RADIO_DESK });
  root.add(ck2.build({ dark: M.dark, steel: M.steelIn, red: M.red }));
  // LEDs on the strip's sloped face: PWR (amber backup / green mains), BCN (red), TX (amber call / green done)
  const sp = [R.c[0] + 0.28, RADIO_DESK, deskZ + 0.27], sry = -0.12, ux = Math.cos(sry), uz = -Math.sin(sry);
  const at = (j) => [sp[0] + ux * (j - 1) * 0.045 + Math.sin(sry) * 0.042, sp[1] + 0.032, sp[2] + uz * (j - 1) * 0.045 + Math.cos(sry) * 0.042];
  const pwrG = led(0x38ff6a), pwrA = led(0xffa020), bcn = led(0xff2a14), txMat = led(0xffa020);
  const ledG0 = ledMesh(pwrG, ledDot, ...at(0), sry, -0.2), ledA0 = ledMesh(pwrA, ledDot, ...at(0), sry, -0.2);
  ledMesh(bcn, ledDot, ...at(1), sry, -0.2); ledMesh(txMat, ledDot, ...at(2), sry, -0.2);
  const con = { at: new Vector3(R.c[0] + 0.1, RADIO_DESK, deskZ + 0.25), stand: new Vector3(R.c[0] + 0.35, 0, deskZ + 0.95), yaw: 0.25 };
  G.scene.add(root);

  const P = { root, cells, console: con, mats: M };
  P.setTaken = (c, b) => { c.taken = b; c.grp.visible = !b; c.ledG.visible = !b; c.ledR.visible = b; };
  for (const c of cells) P.setTaken(c, false);
  // console state (allocation-free): powered → PWR green, BCN flashes; calling → TX amber blink (faster as it
  // progresses); done → TX solid green
  let cPow = false, cCall = 0, cDone = false;
  P.setConsole = (powered, calling, done) => { cPow = powered; cCall = calling; cDone = done; };
  P.update = (dt, t) => {
    const tt = shot ? 0.25 : t;
    // charger LEDs: slow breathing green while charged, dim red once empty
    const br = shot ? 5 : 3.5 + 2 * Math.sin(tt * 2.1);
    M.green.emissiveIntensity = br; M.redLed.emissiveIntensity = 3;
    ledA0.visible = !cPow; ledG0.visible = cPow;
    pwrA.emissiveIntensity = shot ? 3 : 2 + 1.2 * Math.sin(tt * 3);
    pwrG.emissiveIntensity = 5;
    const ph = (tt % 1.2) / 1.2;                                   // in step with the beacon's 1.2 s flash
    bcn.emissiveIntensity = cPow ? (ph < 0.5 ? 7 : 0.3) : 0.1;
    if (cDone) { txMat.emissive.setRGB(0.22, 1, 0.42); txMat.emissiveIntensity = 6; }
    else {
      txMat.emissive.setRGB(1, 0.63, 0.13);
      const rate = 2 + cCall * 8;
      txMat.emissiveIntensity = cCall > 0 ? ((tt * rate) % 1 < 0.55 ? 6 : 0.4) : 0.08;
    }
  };
  P.update(0, 0);
  P.dispose = () => { G.scene.remove(root); root.traverse((m) => { if (m.isMesh) m.geometry.dispose(); }); };
  return P;
}
