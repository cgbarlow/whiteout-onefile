// Beacon tower: 28 m square lattice mast tapering from a 5 m base to 1.4 m, L-angle legs and members (galvanised),
// X-bracing per face per 3.5 m bay + plan bracing, gusset plates (bolted on the low bays), concrete piers with base
// plates and anchor bolts, a caged ladder up the east face (stand-offs at every bay, a rest landing at 14 m), the
// top platform (grating, railing with toe boards, ladder gap), the red beacon (Fresnel lens, key 'beacon' — driven
// by index.js), two aviation obstruction lamps (key 'avia', dim, always on), lightning rod, whip + yagi, coax down a
// leg, 4 guy wires to anchor blocks with turnbuckles, snow on every top, a DANGER placard. Writes into Kit k (world
// coords) and decals through d(name, w, at, face). Keys: steel concrete dark snow beacon avia.
import { Box3, Vector3 } from 'three';
import { lathe, tube, ladder, railing } from '../../cookbook/geo/kit.js';
import { angleGeo, bolt, snowCap, chamferBox, snowDrift } from './parts.js';
import { heightFn } from '../terrain/height.js';

const GALV = 0x9aa0a6, GALV2 = 0x868c92, CONC = 0x8e8a82;
const box3 = (x0, y0, z0, x1, y1, z1) => new Box3(new Vector3(x0, y0, z0), new Vector3(x1, y1, z1));
let _h = null;
const gy = (x, z) => { if (!_h) { try { _h = heightFn(); } catch (e) { _h = () => 0; } } const v = _h(x, z); return Number.isFinite(v) ? v : 0; };

const _a = new Vector3(), _b = new Vector3(), _dir = new Vector3(), _ex = new Vector3(), _ey = new Vector3();
/** L-angle member from A to B: leg 1 along ex, leg 2 along ey (both ⟂-ish to the member; sheared, not rotated) */
function member(k, A, B, ex, ey, a = 0.07, t = 0.007, color = GALV) {
  _a.fromArray(A); _b.fromArray(B); _dir.subVectors(_b, _a);
  const L = _dir.length(); _dir.normalize(); _ex.fromArray(ex); _ey.fromArray(ey);
  const g = angleGeo(L, a, t), P = g.attributes.position.array, N = g.attributes.normal.array;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], s = P[i + 2] / L + 0.5;
    P[i] = _a.x + _dir.x * L * s + _ex.x * x + _ey.x * y; P[i + 1] = _a.y + _dir.y * L * s + _ex.y * x + _ey.y * y; P[i + 2] = _a.z + _dir.z * L * s + _ex.z * x + _ey.z * y;
    const nx = N[i], ny = N[i + 1], nz = N[i + 2];
    const qx = _ex.x * nx + _ey.x * ny + _dir.x * nz, qy = _ex.y * nx + _ey.y * ny + _dir.y * nz, qz = _ex.z * nx + _ey.z * ny + _dir.z * nz, l = Math.hypot(qx, qy, qz) || 1;
    N[i] = qx / l; N[i + 1] = qy / l; N[i + 2] = qz / l;
  }
  g.computeBoundingBox();
  k.add(g, 'steel', { color, occ: false });
}

export function beaconTower(k, d, t, rnd) {
  const [cx, cz] = t.c, H = t.h, b0 = t.base / 2, b1 = 0.7, bays = 8;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  let y0 = 1e9; for (const [sx, sz] of corners) y0 = Math.min(y0, gy(cx + sx * b0, cz + sz * b0));
  y0 -= 0.02;
  const ft = y0 + 0.4;                                   // pier top (legs start here)
  const half = (y) => b0 + (b1 - b0) * ((y - ft) / (H - (ft - y0)));
  const P = (sx, sz, y) => [cx + sx * half(y), y, cz + sz * half(y)];
  const top = y0 + H;
  const colliders = [];

  // piers + base plates + anchor bolts, legs (heel outward, legs pointing in)
  for (const [sx, sz] of corners) {
    const px = cx + sx * b0, pz = cz + sz * b0, g = gy(px, pz);
    k.box(0.8, ft - g + 0.25, 0.8, 'concrete', { at: [px, (ft + g - 0.25) / 2, pz], color: CONC, r: 0.03 });
    k.box(0.36, 0.02, 0.36, 'steel', { at: [px, ft + 0.01, pz], color: GALV2, r: 0.004 });
    for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { bolt(k, [px + ax * 0.13, ft + 0.02, pz + az * 0.13], 'y', 0.012, 'steel', 0x7a7e82); k.cyl(0.01, 0.05, 'steel', { at: [px + ax * 0.13, ft + 0.05, pz + az * 0.13], color: 0x7a7e82 }); }
    k.add(snowCap(0.74, 0.74, 0.05, sx * 3 + sz + 7, { lee: 0.4 }), 'snow', { at: [px, ft + 0.045, pz], occ: false });
    k.push(px - sx * 0.4, g - 0.02, pz, sx > 0 ? 0 : Math.PI); k.add(snowDrift(0.9, 0.18, 0.35, sx * 5 + sz), 'snow', { occ: false }); k.pop();
    member(k, P(sx, sz, ft + 0.02), P(sx, sz, top), [-sx, 0, 0], [0, 0, -sz], 0.12, 0.012, GALV);
    colliders.push(box3(px - 0.4, 0, pz - 0.4, px + 0.4, top, pz + 0.4));
  }
  // bay levels: horizontals + X-bracing per face, plan bracing every 2nd level, gussets
  const lv = []; for (let i = 0; i <= bays; i++) lv.push(ft + 0.02 + ((top - ft - 0.02) * i) / bays);
  for (let i = 0; i <= bays; i++) {
    const y = lv[i];
    for (let c = 0; c < 4; c++) {
      const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
      const n = [(ax + bx) / 2, 0, (az + bz) / 2]; // outward face normal (axis-aligned)
      const along = [bx - ax, 0, bz - az].map((v) => v / 2);
      if (i > 0) member(k, P(ax, az, y), P(bx, bz, y), [0, 1, 0], [-n[0], 0, -n[2]], 0.08, 0.008);
      if (i < bays) {
        const y1 = lv[i + 1];
        member(k, P(ax, az, y + 0.05), P(bx, bz, y1 - 0.05), [-n[0], 0, -n[2]], [n[2], 0, n[0]], 0.06, 0.006, GALV2);
        member(k, P(bx, bz, y + 0.05), P(ax, az, y1 - 0.05), [-n[0], 0, -n[2]], [-n[2], 0, -n[0]], 0.06, 0.006, GALV2);
      }
      // gusset plate at each corner/level on this face; bolted on the low (readable) bays
      const [gx, , gz] = P(ax, az, y);
      k.add(chamferBox(Math.abs(n[0]) > 0 ? 0.008 : 0.22, 0.2, Math.abs(n[0]) > 0 ? 0.22 : 0.008, 0.002), 'steel', { at: [gx + n[0] * 0.01 + along[0] * 0.12, y, gz + n[2] * 0.01 + along[2] * 0.12], color: GALV2, occ: false });
      if (i < 3) for (const dy of [-0.05, 0.05]) bolt(k, [gx + n[0] * 0.016 + along[0] * 0.14, y + dy, gz + n[2] * 0.016 + along[2] * 0.14], n[0] > 0 ? 'x' : n[0] < 0 ? '-x' : n[2] > 0 ? 'z' : '-z', 0.01, 'steel', 0x7a7e82);
    }
    if (i % 2 === 1) member(k, P(-1, -1, y + 0.08), P(1, 1, y + 0.08), [0, 1, 0], [0.7, 0, -0.7], 0.06, 0.006, GALV2);
    if (i < 2) for (let c = 0; c < 4; c++) { // snow on the windward low horizontals
      const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4], A = P(ax, az, y), B = P(bx, bz, y), L = Math.hypot(B[0] - A[0], B[2] - A[2]) * (0.5 + 0.3 * rnd());
      const ry = Math.atan2(B[0] - A[0], B[2] - A[2]);
      k.add(chamferBox(0.06, 0.02, L, 0.008), 'snow', { at: [(A[0] + B[0]) / 2, y + 0.09, (A[2] + B[2]) / 2], rot: [0, ry, 0], occ: false });
    }
  }
  // caged ladder up the east face (outside, leaning with the taper), stand-offs at every level
  const lean = Math.atan2(b0 - b1, H), lx = cx + b0 + 0.32, lh = (top + 1.1 - ft) / Math.cos(lean);
  k.push(lx, ft, cz, -Math.PI / 2, lean, 0); ladder(k, lh, { w: 0.45, cage: true, color: GALV }); k.pop();
  for (let i = 1; i <= bays; i++) {
    const y = lv[i], fx = cx + half(y), lxx = lx - (y - ft) * Math.tan(lean);
    for (const s of [-1, 1]) k.bar([fx, y, cz + s * 0.22], [lxx, y, cz + s * 0.22], 0.05, 0.008, 'steel', { color: GALV2 });
  }
  for (const s of [-1, 1]) for (const a of [0.55, 1.0]) { // vertical cage straps
    const ox = Math.sin(a * Math.PI / 2) * 0.62, oz = Math.cos(a * Math.PI / 2) * 0.3 * s;
    k.bar([lx + ox, ft + 2.2, cz + oz], [lx + ox - (lh - 2.6) * Math.sin(lean), ft + lh - 0.4, cz + oz], 0.04, 0.006, 'steel', { color: GALV });
  }
  // rest landing at mid height
  { const y = lv[4], lxx = lx - (y - ft) * Math.tan(lean) + 0.35;
    k.box(0.8, 0.05, 0.9, 'steel', { at: [lxx, y, cz + 0.62], color: GALV2, r: 0.006 });
    railing(k, [[lxx - 0.38, y + 0.03, cz + 0.2], [lxx + 0.38, y + 0.03, cz + 0.2], [lxx + 0.38, y + 0.03, cz + 1.05], [lxx - 0.38, y + 0.03, cz + 1.05]], { h: 1.05, postEvery: 0.9, r: 0.02, color: 0xd8a21e });
    k.add(snowCap(0.7, 0.8, 0.04, 41, { lee: 0.5 }), 'snow', { at: [lxx, y + 0.045, cz + 0.62], occ: false }); }

  // top platform: perimeter beams, grating bars, railing with a ladder gap, toe boards
  const pw = 1.05, py = top;
  for (const [sx, sz, w, dd] of [[0, -1, 2 * pw, 0.1], [0, 1, 2 * pw, 0.1], [-1, 0, 0.1, 2 * pw], [1, 0, 0.1, 2 * pw]]) k.box(w, 0.12, dd, 'steel', { at: [cx + sx * pw, py - 0.06, cz + sz * pw], color: GALV2, r: 0.008 });
  for (let i = 0; i < 21; i++) k.add(chamferBox(0.006, 0.03, 2 * pw - 0.1, 0.002), 'steel', { at: [cx - pw + 0.05 + i * ((2 * pw - 0.1) / 20), py - 0.015, cz], color: GALV, occ: false });
  for (const s of [-0.5, 0.5]) k.add(chamferBox(2 * pw - 0.1, 0.03, 0.01, 0.002), 'steel', { at: [cx, py - 0.02, cz + s * pw], color: GALV, occ: false });
  railing(k, [[cx + pw, py, cz - 0.32], [cx + pw, py, cz - pw], [cx - pw, py, cz - pw], [cx - pw, py, cz + pw], [cx + pw, py, cz + pw], [cx + pw, py, cz + 0.32]], { h: 1.1, postEvery: 1.05, r: 0.022, color: 0xd8a21e });
  for (const [x, z, w, dd] of [[cx - 0.45, cz - 0.4, 0.9, 0.7], [cx + 0.35, cz + 0.45, 0.8, 0.6], [cx - 0.5, cz + 0.6, 0.5, 0.5]]) k.add(snowCap(w, dd, 0.04, x * 3, { lee: 0.6 }), 'snow', { at: [x, py + 0.02, z], occ: false });

  // beacon: pedestal, housing, Fresnel lens (emissive), dome, lightning rod, cage guard
  k.cyl(0.07, 0.62, 'steel', { at: [cx, py + 0.31, cz], color: GALV2 });
  k.cyl(0.21, 0.13, 'dark', { at: [cx, py + 0.685, cz], color: 0x222428, bevel: 0.015 });
  const lens = [[0.165, 0]];
  for (let i = 0; i < 7; i++) { const y = 0.02 + i * 0.042; lens.push([0.165, y], [0.182, y + 0.012], [0.165, y + 0.03]); }
  lens.push([0.165, 0.32], [0, 0.32]);
  k.add(lathe(lens, { seg: 32, crease: 50 }), 'beacon', { at: [cx, py + 0.75, cz], occ: false });
  k.add(lathe([[0, 0], [0.19, 0], [0.19, 0.03], [0.14, 0.09], [0.06, 0.12], [0, 0.125]], { seg: 28 }), 'dark', { at: [cx, py + 1.07, cz], color: 0x222428 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.add(tube([[cx + Math.cos(a) * 0.23, py + 0.75, cz + Math.sin(a) * 0.23], [cx + Math.cos(a) * 0.23, py + 1.07, cz + Math.sin(a) * 0.23]], 0.007, { radial: 5 }), 'dark', { color: 0x1a1a1c, occ: false }); }
  k.add(snowCap(0.3, 0.3, 0.03, 51), 'snow', { at: [cx, py + 1.2, cz], occ: false });
  k.cyl(0.012, 1.8, 'steel', { at: [cx, py + 2.1, cz], color: 0x8a8070 });
  // aviation obstruction lamps on two corner posts
  const avia = [[cx - pw + 0.08, cz - pw + 0.08], [cx + pw - 0.08, cz + pw - 0.08]];
  for (const [x, z] of avia) {
    k.cyl(0.03, 1.25, 'steel', { at: [x, py + 0.62, z], color: GALV2 });
    k.cyl(0.07, 0.05, 'dark', { at: [x, py + 1.27, z], color: 0x222428 });
    k.add(lathe([[0.058, 0], [0.058, 0.05], [0.045, 0.085], [0.02, 0.1], [0, 0.104]], { seg: 18 }), 'avia', { at: [x, py + 1.295, z], occ: false });
  }
  // whip + yagi aimed east at the station, coax down the north-west leg
  k.cyl(0.015, 3.2, 'steel', { at: [cx - pw + 0.08, py + 2.85, cz + pw - 0.08], color: 0x2a2a2a });
  k.bar([cx + pw, py + 0.9, cz - pw + 0.1], [cx + pw + 1.0, py + 0.9, cz - pw + 0.1], 0.04, 0.04, 'steel', { color: GALV });
  k.bar([cx + pw + 0.3, py + 0.9, cz - pw + 0.1], [cx + pw + 2.1, py + 0.9, cz - pw + 0.1], 0.025, 0.025, 'steel', { color: GALV });
  for (let i = 0; i < 6; i++) k.add(chamferBox(0.012, 0.012, 0.6 - i * 0.04, 0.003), 'steel', { at: [cx + pw + 0.45 + i * 0.32, py + 0.9, cz - pw + 0.1], color: GALV, occ: false });
  k.add(tube([[cx - b1 + 0.1, top - 0.2, cz - b1 + 0.1], [cx - b0 + 0.25, ft + 0.4, cz - b0 + 0.25], [cx - b0 + 0.6, gy(cx - b0 + 0.6, cz - b0 + 0.6) + 0.05, cz - b0 - 0.6], [cx + 0.5, gy(cx + 0.5, cz - 6.6) + 0.04, cz - 6.6]], 0.014, { radial: 6 }), 'dark', { color: 0x141414, occ: false });

  // guy wires from 0.8 H on each leg to anchor blocks at 0.45 H, turnbuckles near the anchors
  for (const [sx, sz] of corners) {
    const ax = cx + sx * H * 0.45, az = cz + sz * H * 0.45, ag = gy(ax, az), ry = Math.atan2(sx, sz);
    k.box(0.7, 0.55, 0.7, 'concrete', { at: [ax, ag + 0.1, az], rot: [0, ry, 0], color: CONC, r: 0.03 });
    k.add(snowCap(0.62, 0.62, 0.05, sx * 7 + sz * 3, { lee: 0.5 }), 'snow', { at: [ax, ag + 0.4, az], rot: [0, ry, 0], occ: false });
    k.box(0.02, 0.16, 0.1, 'steel', { at: [ax, ag + 0.45, az], rot: [0, ry, 0], color: GALV2, r: 0.004 });
    const hi = P(sx, sz, y0 + H * 0.8), tb = [ax - sx * 0.6, ag + 0.85, az - sz * 0.6];
    k.add(tube([hi, tb], 0.016, { radial: 4 }), 'dark', { color: 0x2a2c30, occ: false });
    k.add(tube([tb, [ax, ag + 0.5, az]], 0.02, { radial: 6 }), 'steel', { color: 0x7a7e82, occ: false });
    k.add(tube([[tb[0] + sx * 0.12, tb[1] - 0.07, tb[2] + sz * 0.12], [tb[0] + sx * 0.36, tb[1] - 0.22, tb[2] + sz * 0.36]], 0.026, { radial: 8 }), 'steel', { color: 0x8a8e92, occ: false }); // turnbuckle
    colliders.push(box3(ax - 0.45, 0, az - 0.45, ax + 0.45, ag + 0.6, az + 0.45));
  }
  // DANGER placard on the east face, low bay
  { const y = ft + 1.5, fx = cx + half(y) + 0.06;
    k.box(0.006, 0.42, 0.62, 'steel', { at: [fx, y, cz - 0.55], color: 0xb8b4aa, r: 0.002 });
    d('tower', 0.6, [fx + 0.004, y, cz - 0.55], '+x'); }
  return { colliders, lampAt: [cx, py + 0.91, cz], avia: avia.map(([x, z]) => [x, py + 1.35, z]), top: py };
}
