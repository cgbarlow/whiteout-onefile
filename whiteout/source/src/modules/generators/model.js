// Hero diesel generator skid at real scale (2.6 × 1.1 × 1.5 m body, exhaust stack to 2.33 m). Writes into a Kit in
// LOCAL coordinates: origin = skid centre on the plinth top, +x = control-panel end (faces the open side of the
// lean-to / pose 3), -x = louvred radiator, -z = exhaust side (toward the lean-to back wall).
//   frame      C-channel rails, end plates, lifting lugs, fork pockets, belly fuel tank with filler, AV mounts
//   engine     sump + ribbed block, 4 finned barrels, heads, orange rocker cover, injection pump + injector lines,
//              fuel filter, starter, dipstick, oil filter, fan + belt + guard, coolant hoses, air filter + intake
//   alternator flywheel bell with bolt ring, banded stator frame, vent louvres, slotted end bell, terminal box
//   radiator   orange shroud posts, tanks, black core, 13 angled louvres (snow on each), filler cap
//   exhaust    manifold → elbow → flex bellows → muffler with bands + heat shield → stack (flap built separately)
//   snow       caps on every top face, a shell over the alternator, a drift banked against the radiator
// Panel, lever, battery box and the day-tank hose are in panel.js. Material keys: paint opaint (orange chipped steel) steel dark snow lamp.
import { lathe, tube, extrudeBevel, circle } from '../../cookbook/geo/kit.js';
import { bolt, boltRing, finned, bellows, channel, snowCap, snowShell, snowDrift, chamferBox, AXIS_ROT } from './parts.js';
import { panelKit } from './panel.js';

const HP = Math.PI / 2;
export const GEN_HALF = [1.36, 0.6];          // collision half-extents (x, z) around the skid centre
export const GEN_PANEL = [1.36, 1.15, 0];     // panel interaction point (local)
export const EX = -0.42, AY = 0.74;           // engine centre x, alternator axis height
export const STACK = [EX + 0.3, 2.325, -0.3]; // exhaust outlet (local), flap hinge just behind it

// per-unit look: A cared-for, B sun-faded with a replaced grey shroud, C (faulty) grimy and scorched
export const VARIANTS = {
  // orange parts use the generators' own chipped painted-steel material ('opaint'): deep industrial orange-red
  A: { orange: 0xa4321a, frame: 0x2c3034, engine: 0x30343a, cast: 0x3c3e40, panel: 0x5c646c, shroud: 0xb03c1c, fin: 0x9a9890, lee: 0.5, snow: 1.0 },
  B: { orange: 0x9c4a2c, frame: 0x3a4034, engine: 0x363a38, cast: 0x424240, panel: 0x6a706a, shroud: 0x8a9096, fin: 0x8e8c86, lee: 0.3, snow: 1.25 },
  C: { orange: 0x86301a, frame: 0x302c28, engine: 0x2a2a2a, cast: 0x343230, panel: 0x585a5a, shroud: 0x963a1c, fin: 0x7a7670, lee: 0.7, snow: 0.8 },
};

/**
 * k: Kit (local coords) · d: decal fn(name, w, at, face, h?) · o: { id, rnd, v (VARIANTS entry), dayTank: [x,y,z] local|null }
 * returns anchors (local): { panel, lamp, stack, hinge, lever, sparks }
 */
export function generatorKit(k, d, o) {
  const { v, rnd } = o, S = (n) => 1 + (rnd() - 0.5) * n; // small per-instance jitter
  const snow = (geo, at, rot) => k.add(geo, 'snow', { at, rot, occ: false });

  // ------------------------------------------------------------------ base frame + belly tank
  for (const s of [1, -1]) { k.push(0, 0, s * 0.55, s * HP); k.add(channel(2.6), 'paint', { color: v.frame }); k.pop(); }
  for (const x of [-1.296, 1.296]) for (const s of [1, -1]) k.box(0.012, 0.3, 0.085, 'paint', { at: [x, 0.15, s * 0.508], color: v.frame, r: 0.003 });
  for (const x of [-1.25, 1.0, 1.25]) k.box(0.06, 0.06, 0.94, 'paint', { at: [x, 0.27, 0], color: v.frame, r: 0.006 });
  k.box(2.3, 0.24, 0.86, 'paint', { at: [0, 0.145, 0], color: 0x4a4e50, r: 0.03 });
  k.box(2.32, 0.012, 0.88, 'paint', { at: [0, 0.15, 0], color: 0x3e4244, r: 0.004 });               // tank seam flange
  k.cyl(0.032, 0.09, 'steel', { at: [1.02, 0.31, -0.24], seg: 14, color: 0x8a8c8e });                // filler neck
  k.cyl(0.046, 0.03, 'paint', { at: [1.02, 0.37, -0.24], seg: 18, color: 0xc8a020, bevel: 0.006 });  // filler cap
  for (const x of [-0.55, 0.55]) for (const s of [1, -1]) {                                          // fork pockets
    k.box(0.24, 0.1, 0.03, 'paint', { at: [x, 0.11, s * 0.567], color: v.frame, r: 0.008 });
    k.box(0.2, 0.065, 0.004, 'dark', { at: [x, 0.11, s * 0.583], color: 0x0c0c0c, r: 0.001, occ: false });
  }
  // lifting lugs (tab with an eye) welded on the rail tops
  const lug = [[-0.05, 0], [0.05, 0], [0.05, 0.045], ...circle(0.05, 8, 0, 0.045).filter(([, y]) => y > 0.045), [-0.05, 0.045]];
  for (const x of [-1.18, 1.16]) for (const s of [1, -1]) k.add(extrudeBevel(lug, { holes: [circle(0.019, 8, 0, 0.05).reverse()], depth: 0.016, bevel: 0.002 }), 'paint', { at: [x, 0.3, s * 0.51], color: v.frame });
  // rail bolts at the cross-members, GEN stencil + DIESEL ONLY on the outer webs
  for (const x of [-1.25, 1.0, 1.25]) for (const s of [1]) for (const y of [0.08, 0.22]) bolt(k, [x, y, s * 0.551], s > 0 ? 'z' : '-z', 0.009, 'steel', 0x6a6c6e);
  d('gen' + o.id, 0.62, [-0.42, 0.15, 0.556], '+z');
  d('gen' + o.id, 0.62, [0.42, 0.15, -0.556], '-z');
  d('diesel', 0.3, [0.92, 0.075, 0.556], '+z');
  // anti-vibration mounts (plate / rubber / plate) under the engine and alternator feet
  for (const x of [-0.82, -0.08, 0.45, 0.88]) for (const s of [1, -1]) {
    k.box(0.11, 0.008, 0.075, 'steel', { at: [x, 0.304, s * 0.505], color: 0x7a7c7e, r: 0.002 });
    k.cyl(0.03, 0.044, 'dark', { at: [x, 0.33, s * 0.505], seg: 10, color: 0x18181a });
    k.box(0.1, 0.008, 0.07, 'steel', { at: [x, 0.356, s * 0.505], color: 0x7a7c7e, r: 0.002 });
    bolt(k, [x + s * 0.04, 0.308, s * 0.505], 'y', 0.006);
  }

  // ------------------------------------------------------------------ engine
  for (const xm of [-0.82, -0.08]) for (const s of [1, -1]) {
    k.box(0.09, 0.04, 0.3, 'paint', { at: [xm, 0.38, s * 0.39], color: v.engine, r: 0.006 });
    k.box(0.012, 0.13, 0.24, 'paint', { at: [xm, 0.45, s * 0.37], color: v.engine, r: 0.003 });
  }
  k.box(0.86, 0.16, 0.4, 'paint', { at: [EX, 0.45, 0], color: v.cast, r: 0.025 });                    // sump
  k.box(0.9, 0.014, 0.44, 'paint', { at: [EX, 0.533, 0], color: v.cast, r: 0.004 });
  for (let i = 0; i < 5; i++) bolt(k, [EX - 0.4 + i * 0.2, 0.54, 0.205], 'y', 0.0055);
  k.box(0.98, 0.36, 0.5, 'paint', { at: [EX, 0.72, 0], color: v.engine, r: 0.022 });                  // block
  for (let i = 0; i < 12; i++) for (const s of [1, -1]) if (s > 0 || i % 3 === 0) k.box(0.016, 0.3, 0.022, 'paint', { at: [EX - 0.44 + i * 0.08, 0.72, s * 0.26], color: v.engine, r: 0.005 });
  k.box(1.0, 0.02, 0.42, 'paint', { at: [EX, 0.905, 0], color: v.cast, r: 0.006 });
  const cylX = [-0.36, -0.12, 0.12, 0.36].map((x) => EX + x);
  for (const x of cylX) {
    k.add(finned(0.072, 0.112, 0.3, 9, 10), 'steel', { at: [x, 0.915, 0], color: v.fin, occ: { r: 0.1, y0: 0, y1: 0.3 } });
    k.box(0.21, 0.08, 0.27, 'paint', { at: [x, 1.255, 0], color: v.cast, r: 0.012 });                  // head
    for (const dx of [-0.085, 0.085]) for (const dz of [-0.115, 0.115]) bolt(k, [x + dx, 1.295, dz], 'y', 0.0075);
    k.add(tube([[x + 0.065, 0.91, 0.125], [x + 0.065, 1.215, 0.125]], 0.011, { radial: 8 }), 'steel', { color: 0x8a8a88, occ: false }); // push-rod tube
  }
  k.box(0.98, 0.012, 0.23, 'paint', { at: [EX, 1.294, 0], color: v.cast, r: 0.003 });
  k.box(0.96, 0.085, 0.21, 'opaint', { at: [EX, 1.34, 0], color: v.orange, r: 0.03 });                // rocker cover
  k.box(0.88, 0.02, 0.05, 'opaint', { at: [EX, 1.388, 0], color: v.orange, r: 0.008 });
  for (let i = 0; i < 4; i++) bolt(k, [EX - 0.33 + i * 0.22, 1.398, 0], 'y', 0.009);
  k.cyl(0.028, 0.03, 'paint', { at: [EX + 0.3, 1.392, 0.065], seg: 14, color: 0xd8a21e, bevel: 0.006 }); // oil filler cap
  k.box(0.08, 0.08, 0.09, 'paint', { at: [EX - 0.53, 1.25, 0], color: v.cast, r: 0.012 });          // thermostat housing
  // injection pump + four injector lines curving up to the injectors
  const px = EX - 0.04;
  k.box(0.26, 0.12, 0.09, 'dark', { at: [px, 0.8, 0.3], color: 0x2a2c2e, r: 0.012 });
  k.box(0.28, 0.02, 0.1, 'steel', { at: [px, 0.87, 0.3], color: 0x7a7c7e, r: 0.004 });
  cylX.forEach((x, i) => {
    k.cyl(0.012, 0.06, 'steel', { at: [x - 0.03, 1.32, 0.085], seg: 10, color: 0x9a9a96 });
    k.add(tube([[px - 0.09 + i * 0.06, 0.88, 0.3], [px - 0.09 + i * 0.06, 0.97, 0.31], [x - 0.03, 1.2, 0.2], [x - 0.03, 1.36, 0.1], [x - 0.03, 1.35, 0.085]], 0.004, { radial: 5, curve: true, samples: 10 }), 'steel', { color: 0xa8a8a4, occ: false });
  });
  // fuel filter + fuel lines from the belly tank and the return
  k.cyl(0.042, 0.13, 'paint', { at: [EX - 0.36, 0.78, 0.33], seg: 18, color: 0xd8d4c8 });
  k.cyl(0.047, 0.03, 'dark', { at: [EX - 0.36, 0.86, 0.33], seg: 18, color: 0x2a2a2a });
  k.box(0.02, 0.1, 0.05, 'paint', { at: [EX - 0.36, 0.82, 0.282], color: v.engine, r: 0.003 });
  k.add(tube([[EX - 0.62, 0.265, 0.33], [EX - 0.62, 0.45, 0.4], [EX - 0.4, 0.66, 0.38], [EX - 0.36, 0.71, 0.33]], 0.007, { radial: 6, curve: true, samples: 14 }), 'dark', { color: 0x161616, occ: false });
  k.add(tube([[EX - 0.36, 0.875, 0.33], [EX - 0.3, 0.92, 0.36], [EX - 0.16, 0.86, 0.36], [px - 0.13, 0.82, 0.33]], 0.007, { radial: 6, curve: true, samples: 12 }), 'dark', { color: 0x161616, occ: false });
  k.add(tube([[px + 0.13, 0.78, 0.33], [px + 0.2, 0.6, 0.4], [px + 0.25, 0.4, 0.4], [px + 0.25, 0.265, 0.33]], 0.006, { radial: 6, curve: true, samples: 12 }), 'dark', { color: 0x2a1a10, occ: false });
  // starter + solenoid (+z, against the flywheel bell), dipstick, oil filter (-z)
  k.push(-0.05, 0.6, 0.335, 0, 0, -HP); k.cyl(0.06, 0.24, 'dark', { seg: 18, color: 0x232426 }); k.pop();
  k.push(-0.03, 0.685, 0.335, 0, 0, -HP); k.cyl(0.033, 0.13, 'dark', { seg: 14, color: 0x2a2b2d }); k.pop();
  k.add(tube([[EX + 0.22, 0.6, 0.27], [EX + 0.24, 0.85, 0.285], [EX + 0.26, 1.06, 0.29]], 0.005, { radial: 6, curve: true, samples: 8 }), 'steel', { color: 0x9a9a96, occ: false });
  k.add(tube(circle(0.016, 10).map(([a, b]) => [EX + 0.26, 1.08 + a, 0.29 + b]), 0.004, { radial: 5, closed: true }), 'paint', { color: 0xd8a21e, occ: false });
  k.cyl(0.05, 0.12, 'paint', { at: [EX - 0.2, 0.64, -0.33], seg: 18, color: 0x1c3a6a, rot: [HP, 0, 0] });
  // front: crank + fan pulleys, belt, water pump, fan blades, guard ring
  const fx = EX - 0.55;
  k.push(fx, 0.56, 0, 0, 0, HP); k.cyl(0.085, 0.04, 'dark', { seg: 24, color: 0x2a2a2c, bevel: 0.006 }); k.pop();
  k.push(fx, 0.88, 0, 0, 0, HP); k.cyl(0.062, 0.04, 'dark', { seg: 22, color: 0x2a2a2c, bevel: 0.006 }); k.pop();
  k.push(fx + 0.06, 0.88, 0, 0, 0, HP); k.cyl(0.05, 0.07, 'paint', { seg: 18, color: v.cast }); k.pop();
  const belt = [];
  for (let i = 0; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI; belt.push([fx, 0.56 + Math.sin(a) * 0.09, Math.cos(a) * 0.09]); }
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI; belt.push([fx, 0.88 + Math.sin(a) * 0.067, Math.cos(a) * 0.067]); }
  k.add(tube(belt, 0.007, { radial: 5, closed: true }), 'dark', { color: 0x141414, occ: false });
  const fan = [-1.06, 0.86, 0];
  k.push(fan[0], fan[1], fan[2], 0, 0, HP); k.cyl(0.055, 0.05, 'dark', { seg: 16, color: 0x2a2a2c }); k.pop();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.box(0.012, 0.2, 0.075, 'dark', { at: [fan[0], fan[1] + Math.cos(a) * 0.15, Math.sin(a) * 0.15], rot: [a, 0.35, 0], color: 0x1e1e20, r: 0.004, occ: false }); }
  k.add(tube(circle(0.285, 28).map(([a, b]) => [-1.02, fan[1] + a, b]), 0.006, { radial: 5, closed: true }), 'steel', { color: 0x6a6c6e, occ: false });
  k.add(tube(circle(0.17, 24).map(([a, b]) => [-1.02, fan[1] + a, b]), 0.004, { radial: 5, closed: true }), 'steel', { color: 0x6a6c6e, occ: false });
  for (let i = 0; i < 4; i++) { const a = 0.4 + (i / 4) * Math.PI * 2; k.add(tube([[-1.02, fan[1] + Math.cos(a) * 0.06, Math.sin(a) * 0.06], [-1.02, fan[1] + Math.cos(a) * 0.29, Math.sin(a) * 0.29]], 0.004, { radial: 5 }), 'steel', { color: 0x6a6c6e, occ: false }); }
  // coolant hoses with clamps at the straight ends
  k.add(tube([[-1.13, 1.2, 0.22], [-1.0, 1.24, 0.18], [EX - 0.66, 1.26, 0.05], [EX - 0.575, 1.25, 0.0]], 0.024, { radial: 12, curve: true, samples: 14 }), 'dark', { color: 0x121212, occ: false });
  k.add(tube([[-1.13, 0.47, -0.24], [-1.02, 0.5, -0.2], [EX - 0.62, 0.72, -0.12], [EX - 0.5, 0.82, -0.08]], 0.024, { radial: 12, curve: true, samples: 14 }), 'dark', { color: 0x121212, occ: false });
  for (const [x, y, z] of [[EX - 0.6, 1.255, 0.0], [-1.11, 1.2, 0.215], [-1.11, 0.47, -0.235]]) { k.push(x, y, z, 0, 0, HP); k.cyl(0.028, 0.016, 'steel', { seg: 14, color: 0xa0a09c }); k.pop(); }
  // air filter canister (+z) + intake elbow + manifold
  k.cyl(0.1, 0.3, 'paint', { at: [0.1, 1.16, 0.3], seg: 26, color: 0x2e3032, bevel: 0.01 });
  for (const y of [1.06, 1.26]) k.cyl(0.104, 0.018, 'steel', { at: [0.1, y, 0.3], seg: 26, color: 0x8a8c8e });
  k.add(lathe([[0, 0], [0.1, 0], [0.1, 0.012], [0.07, 0.035], [0.03, 0.045], [0, 0.046]], { seg: 26 }), 'paint', { at: [0.1, 1.31, 0.3], color: 0x2e3032 });
  k.box(0.86, 0.06, 0.07, 'paint', { at: [EX, 1.19, 0.19], color: v.cast, r: 0.015 });
  k.add(tube([[0.1, 1.08, 0.2], [0.06, 1.1, 0.19], [EX + 0.43, 1.19, 0.19]], 0.03, { radial: 12, curve: true, samples: 8 }), 'dark', { color: 0x1a1a1a, occ: false });

  // ------------------------------------------------------------------ flywheel bell + alternator
  k.push(0.07, AY, 0, 0, 0, -HP);
  k.add(lathe([[0, 0], [0.27, 0], [0.27, 0.012], [0.3, 0.06], [0.33, 0.165], [0.345, 0.168], [0.345, 0.19], [0, 0.19]], { seg: 30 }), 'paint', { color: v.engine });
  k.pop();
  boltRing(k, [0.262, AY, 0], 'x', 0.322, 8, 0.0075, 'steel', 0x7a7c7e, 0.2);
  k.push(0.26, AY, 0, 0, 0, -HP);
  k.add(lathe([[0, 0], [0.29, 0], [0.3, 0.01], [0.3, 0.07], [0.312, 0.075], [0.312, 0.112], [0.3, 0.117], [0.3, 0.578], [0.312, 0.583], [0.312, 0.62], [0.3, 0.625], [0.3, 0.68], [0.29, 0.69], [0, 0.69]], { seg: 30, crease: 30 }), 'opaint', { color: v.orange, occ: { r: 0.3, y0: 0, y1: 0.69 } });
  k.pop();
  for (let i = -6; i <= 6; i++) { const a = (i / 6) * 1.6; k.box(0.03, 0.012, 0.042, 'dark', { at: [0.353, AY + Math.cos(a) * 0.313, Math.sin(a) * 0.313], rot: [a, 0, 0], color: 0x0e0e0e, r: 0.002, occ: false }); }
  k.push(0.95, AY, 0, 0, 0, -HP);
  k.add(lathe([[0, 0], [0.3, 0], [0.3, 0.02], [0.28, 0.06], [0.22, 0.1], [0.12, 0.12], [0, 0.125]], { seg: 32, crease: 25 }), 'opaint', { color: v.orange });
  k.pop();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; k.box(0.008, 0.055, 0.014, 'dark', { at: [1.031, AY + Math.cos(a) * 0.245, Math.sin(a) * 0.245], rot: [a, 0, 0.59], color: 0x0c0c0c, r: 0.002, occ: false }); }
  k.push(1.07, AY, 0, 0, 0, -HP); k.cyl(0.075, 0.025, 'dark', { seg: 22, color: 0x2a2a2c, bevel: 0.006 }); k.pop();
  boltRing(k, [1.085, AY, 0], 'x', 0.055, 4, 0.006);
  for (const x of [0.45, 0.88]) { k.box(0.09, 0.08, 0.92, 'paint', { at: [x, 0.4, 0], color: v.frame, r: 0.008 }); for (const s of [1, -1]) k.box(0.012, 0.14, 0.14, 'paint', { at: [x, 0.5, s * 0.25], color: v.frame, r: 0.003 }); }
  // terminal box + lid screws + gland + main cable to the panel; plate + 400 V placard on its +z face
  k.box(0.32, 0.17, 0.3, 'opaint', { at: [0.62, 1.1, 0], color: v.orange, r: 0.014 });
  k.box(0.34, 0.02, 0.32, 'opaint', { at: [0.62, 1.195, 0], color: v.orange, r: 0.007 });
  for (const dx of [-0.15, 0.15]) for (const dz of [-0.14, 0.14]) bolt(k, [0.62 + dx, 1.205, dz], 'y', 0.006);
  k.push(0.785, 1.08, 0.06, 0, 0, -HP); k.cyl(0.026, 0.035, 'dark', { seg: 12, color: 0x1a1a1a }); k.pop();
  k.add(tube([[0.8, 1.08, 0.06], [0.92, 1.08, 0.08], [1.04, 1.0, 0.1], [1.12, 0.93, 0.1], [1.15, 0.91, 0.1]], 0.018, { radial: 10, curve: true, samples: 14 }), 'dark', { color: 0x141414, occ: false });
  d('data', 0.13, [0.56, 1.1, 0.1505], '+z');
  d('hv', 0.09, [0.72, 1.1, 0.1505], '+z');

  // ------------------------------------------------------------------ radiator (-x end)
  for (const s of [1, -1]) {
    k.box(0.16, 1.06, 0.05, 'opaint', { at: [-1.21, 0.86, s * 0.455], color: v.shroud, r: 0.01 });
    if (s > 0) for (const y of [0.45, 0.75, 1.05, 1.3]) bolt(k, [-1.21, y, 0.481], 'z', 0.007);
  }
  k.box(0.16, 0.12, 0.86, 'opaint', { at: [-1.21, 1.33, 0], color: v.shroud, r: 0.014 });
  k.box(0.16, 0.1, 0.86, 'opaint', { at: [-1.21, 0.37, 0], color: v.shroud, r: 0.012 });
  k.box(0.08, 0.78, 0.86, 'dark', { at: [-1.2, 0.86, 0], color: 0x1c1d1f, r: 0.004 });
  for (const y of [0.44, 1.27]) k.box(0.03, 0.04, 0.9, 'opaint', { at: [-1.305, y, 0], color: v.shroud, r: 0.006 });
  for (const s of [1, -1]) k.box(0.03, 0.87, 0.03, 'opaint', { at: [-1.305, 0.855, s * 0.44], color: v.shroud, r: 0.006 });
  for (let i = 0; i < 13; i++) {
    const y = 0.49 + i * 0.058;
    k.box(0.075, 0.006, 0.84, 'opaint', { at: [-1.31, y, 0], rot: [0, 0, 0.62], color: v.shroud, r: 0.002, occ: false });
    if (rnd() < 0.55 * v.snow) snow(chamferBox(0.04, 0.009, 0.8 - rnd() * 0.2, 0.004), [-1.33, y + 0.016, (rnd() - 0.5) * 0.06], [0, 0, 0.62]);
  }
  k.cyl(0.024, 0.03, 'steel', { at: [-1.21, 1.405, 0.25], seg: 14, color: 0x8a8c8e });
  k.cyl(0.036, 0.022, 'steel', { at: [-1.21, 1.43, 0.25], seg: 18, color: 0xa8a8a4, bevel: 0.005 });
  k.add(tube([[-1.21, 1.41, 0.28], [-1.25, 1.36, 0.41], [-1.26, 0.9, 0.42], [-1.26, 0.35, 0.41]], 0.005, { radial: 6, curve: true, samples: 12 }), 'dark', { color: 0x1a1a1a, occ: false });

  // ------------------------------------------------------------------ exhaust (-z side)
  const RUST = 0x5e4030, ex = STACK[0];
  cylX.forEach((x) => k.add(tube([[x, 1.24, -0.13], [x, 1.22, -0.18], [x, 1.2, -0.215]], 0.022, { radial: 10, curve: true, samples: 6 }), 'dark', { color: RUST, occ: false }));
  k.push(EX, 1.2, -0.235, 0, 0, -HP); k.cyl(0.034, 0.84, 'dark', { seg: 16, color: 0x4e3428 }); k.pop();
  k.add(tube([[ex, 1.2, -0.235], [ex, 1.27, -0.26], [ex, 1.33, -0.3], [ex, 1.37, -0.3]], 0.038, { radial: 14, curve: true, samples: 10 }), 'dark', { color: RUST, occ: false });
  k.add(bellows(0.042, 0.22, 10, 12), 'steel', { at: [ex, 1.36, -0.3], color: 0xb0aea8 });
  k.add(lathe([[0, 0], [0.045, 0], [0.045, 0.03], [0.12, 0.08], [0.12, 0.48], [0.05, 0.53], [0.05, 0.565], [0, 0.565]], { seg: 28, crease: 30 }), 'dark', { at: [ex, 1.58, -0.3], color: 0x463a32, occ: { r: 0.12, y0: 0, y1: 0.565 } });
  for (const y of [1.7, 2.02]) k.cyl(0.126, 0.03, 'steel', { at: [ex, y, -0.3], seg: 28, color: 0x7a7672 });
  k.cyl(0.05, 0.19, 'dark', { at: [ex, 2.14 + 0.095, -0.3], seg: 16, color: RUST });
  k.box(0.02, 0.03, 0.03, 'steel', { at: [ex - 0.06, 2.315, -0.3], color: 0x6a6662, r: 0.004 });     // flap hinge lug
  // muffler support strut from the rail, band arm, flat heat shield with the HOT SURFACE placard
  k.bar([ex, 0.3, -0.5], [ex, 1.86, -0.5], 0.045, 0.045, 'paint', { color: v.frame });
  k.bar([ex, 1.86, -0.52], [ex, 1.86, -0.41], 0.04, 0.03, 'paint', { color: v.frame });
  k.box(0.22, 0.26, 0.006, 'steel', { at: [ex, 1.86, -0.155], color: 0x8a8682, r: 0.002 });
  for (const y of [1.76, 1.96]) k.bar([ex, y, -0.18], [ex, y, -0.16], 0.03, 0.01, 'steel', { color: 0x6a6662 });
  for (const dx of [-0.09, 0.09]) for (const y of [1.75, 1.97]) bolt(k, [ex + dx, y, -0.151], 'z', 0.005);
  d('hot', 0.16, [ex, 1.87, -0.1515], '+z');

  // ------------------------------------------------------------------ panel, lever, battery, day-tank hose
  const P = panelKit(k, d, o);

  // ------------------------------------------------------------------ snow on every top (wind from -x: thicker west)
  const sv = v.snow, lee = v.lee;
  snow(snowCap(0.9, 0.17, 0.02 * sv, 11, { lee }), [EX, 1.398 + 0.01 * sv, 0]);
  snow(lathe([[0, 0], [0.096, 0], [0.098, 0.01], [0.08, 0.02 * sv], [0.03, 0.03 * sv], [0, 0.031 * sv]], { seg: 22 }), [0.1, 1.355, 0.3]);
  for (const [x0, x1] of [[0.3, 0.455], [0.79, 0.94]]) snow(snowShell(0.3, x1 - x0, 0.78, 0.022 * sv, x0 * 10), [(x0 + x1) / 2, AY, 0], [0, HP, 0]);
  snow(snowCap(0.3, 0.3, 0.024 * sv, 13, { lee }), [0.62, 1.205 + 0.012 * sv, 0]);
  snow(snowCap(0.15, 0.84, 0.04 * sv, 17, { lee: -0.4 }), [-1.21, 1.39 + 0.02 * sv, 0]);
  for (const s of [1, -1]) for (const [x0, x1] of [[-1.28, -0.88], [-0.76, -0.14], [0.02, 0.4], [0.52, 0.83], [0.94, 1.28]]) {
    if (rnd() > 0.8) continue;
    { const h = 0.012 * sv * S(0.5); snow(chamferBox(x1 - x0, h, 0.066, h * 0.45), [(x0 + x1) / 2, 0.3 + h / 2, s * 0.51]); }
  }
  for (const c of P.snowTops) snow(snowCap(c[0], c[1], c[2] * sv, c[6] || 23, { lee }), [c[3], c[4] + c[2] * sv * 0.5, c[5]], c[7]);
  // drift banked against the radiator louvres (windward), spill along the +z rail foot
  k.push(-1.32, 0, 0, Math.PI); snow(snowDrift(1.5, 0.3 * sv, 0.35, 5)); k.pop();
  k.push(-0.75, 0, 0.556, -HP); snow(snowDrift(0.9, 0.06 * sv, 0.1, 9)); k.pop();
  k.push(0.55, 0, 0.556, -HP); snow(snowDrift(0.5, 0.04 * sv, 0.07, 21)); k.pop();
  k.push(-0.6, 0, -0.556, HP); snow(snowDrift(1.2, 0.05 * sv, 0.08, 13)); k.pop();
  // drift banked against the skid rails out to the plinth edge (windward -x end deepest), and under the panel end
  // (key 'drift' = the plinth's own weathered surface, so the drift and the plinth snow coat read as one layer)
  const drift = (geo) => k.add(geo, 'drift', { occ: false, color: 0xf2f4f6 });
  k.push(0.1, 0, 0.58, -HP); drift(snowDrift(2.3, 0.1 * sv, 0.3, 27)); k.pop();
  k.push(-0.15, 0, -0.58, HP); drift(snowDrift(2.1, 0.08 * sv, 0.28, 31)); k.pop();
  k.push(1.32, 0, 0.05, 0); drift(snowDrift(0.95, 0.07 * sv, 0.34, 35)); k.pop();  return { ...P, stack: STACK.slice(), hinge: [STACK[0] - 0.06, 2.325, STACK[2]] };
}
export { AXIS_ROT };
