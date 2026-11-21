// Yard dressing that ties the station to the snow:
//   banks     drifts banked against every module, the radio hut and the vehicle shed: tall lee tongues on the
//             +x / +z faces (the wind blows toward +x, a little +z), low windward ramps on -x / -z, door spans and
//             their landings kept clear. Geometry on the 'snow' key (wear.js driftAlong).
//   workArea  a believable work cluster north-west of the hab (seen past the hab in the station showcase): a
//             towable light tower, a Nansen sledge of drums, a tarp-lashed pile on pallets, a fuel hose snaking
//             over the snow on sleepers to the hab, jerry cans. Away from the stalker patrol and the beaten paths.
import { tube, barrel, pallet, lathe } from '../../cookbook/geo/kit.js';
import { C, jit, box3, seat, gy } from './parts.js';
import { driftAlong, snowCap, mound, windTail } from './wear.js';

/** walls of an axis-aligned footprint → drifts, skipping ±gap around any door whose threshold lies on that wall */
function bankBox(d, cx, cz, sx, sz, doors, seed, k = 1) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
  // [a, b, side, height, depth]: lee faces deep, windward faces shallow
  const walls = [
    [[x0, z1], [x1, z1], 1, 0.3, 0.95], [[x0, z0], [x1, z0], -1, 0.32, 1.0],
    [[x1, z0], [x1, z1], -1, 0.58, 1.8], [[x0, z0], [x0, z1], 1, 0.3, 0.9],
  ];
  let w = 0;
  for (const [a, b, side, h, dp] of walls) {
    const ax = b[0] - a[0], az = b[1] - a[1], L = Math.hypot(ax, az), tx = ax / L, tz = az / L, nx = -tz * side, nz = tx * side;
    const cuts = [];
    for (const dr of doors) {
      const ox = dr.at[0] - dr.n[0] * 1.6, oz = dr.at[2] - dr.n[2] * 1.6; // threshold point on the wall
      const off = (ox - a[0]) * nx + (oz - a[1]) * nz, s = (ox - a[0]) * tx + (oz - a[1]) * tz;
      if (Math.abs(off) < 0.6 && s > -1 && s < L + 1) cuts.push([s - (dr.big ? 3.2 : 1.6), s + (dr.big ? 3.2 : 1.6)]);
    }
    cuts.sort((p, q) => p[0] - q[0]);
    let s0 = -0.05;
    for (const c of [...cuts, [L + 0.05, L + 0.05]]) {
      const s1 = Math.min(c[0], L + 0.05);
      if (s1 - s0 > 0.8) driftAlong(d, [a[0] + tx * s0, a[1] + tz * s0], [a[0] + tx * s1, a[1] + tz * s1], h * k, dp * k, seed + w * 5, { side, inset: 0.06 });
      s0 = Math.max(s0, c[1]); w++;
    }
  }
}

export function banks(d, L, doors) {
  let seed = 3;
  for (const m of L.modules) bankBox(d, m.c[0], m.c[1], m.size[0] + 0.08, m.size[1] + 0.08, doors, seed += 11);
  const R = L.radioHut; bankBox(d, R.c[0], R.c[1], R.size[0] + 0.08, R.size[1] + 0.08, doors, seed += 11, 0.8);
  const S = L.shed; bankBox(d, S.c[0], S.c[1], S.size[0] + 0.26, S.size[1] + 0.26, doors, seed += 11, 1.15);
}

/** wind tails / sastrugi in the open yard, aligned with the wind (+x, a little +z), off the paths and tracks */
export function yardTails(d) {
  const wr = -Math.atan2(2, 6); // wind [6, 0, 2] → heading about Y (local +x downwind)
  const T = [[25.4, 12.4, 5.5, 0.7, 0.26], [28.6, 13.6, 4.2, 0.55, 0.2], [21.6, 13.0, 6.5, 0.8, 0.3], [31.2, 12.2, 3.2, 0.45, 0.16],
    [23.8, 15.4, 4.6, 0.6, 0.22], [18.6, 11.8, 3.6, 0.5, 0.18], [33.2, 5.6, 4.4, 0.6, 0.22], [35.6, 2.4, 5.2, 0.7, 0.26], [30.4, -1.2, 4.0, 0.55, 0.2]];
  T.forEach(([x, z, L, w, h], i) => windTail(d, x, z, wr + (i % 3 - 1) * 0.08, L, w, h, 5 + i));
}

export function workArea(k, d, rnd) {
  const cols = [];
  // towable light tower: trailer chassis, outrigger jacks, telescopic mast, 4-head lamp bar (unlit, aimed at the yard)
  { const x = 7.2, z = 11.6, ry = 0.5, y0 = seat(x, z, 1.0, 0.06);
    k.push(x, y0, z, ry);
    k.box(2.3, 1.0, 1.25, 'paint', { at: [0, 0.75, 0], color: 0xd8a21e, r: 0.05 });
    for (let i = 0; i < 7; i++) d.box(0.02, 0.6, 0.03, 'dark', { at: [-0.7 + i * 0.07, 0.8, 0.64], color: C.dark, r: 0, occ: false }); // louvres
    for (const s of [-1, 1]) { k.cyl(0.26, 0.18, 'dark', { at: [0.1, 0.26, s * 0.72], rot: [Math.PI / 2, 0, 0], seg: 16, color: 0x18191b }); k.box(0.7, 0.05, 0.3, 'steel', { at: [0.1, 0.5, s * 0.72], color: C.dark, r: 0.01 }); }
    k.bar([1.15, 0.36, 0], [2.0, 0.3, 0], 0.08, 0.08, 'steel', { color: C.dark }); // drawbar
    for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { k.bar([ax * 1.0, 0.4, az * 0.55], [ax * 1.3, 0.4, az * 1.2], 0.07, 0.07, 'steel', { color: C.yellow }); k.box(0.22, 0.04, 0.22, 'steel', { at: [ax * 1.3, 0.04, az * 1.2], color: C.dark, r: 0.008 }); k.cyl(0.03, 0.36, 'steel', { at: [ax * 1.3, 0.22, az * 1.2], seg: 8, color: C.steel }); }
    k.cyl(0.09, 5.2, 'steel', { at: [-0.7, 1.25 + 2.6, 0], seg: 12, color: 0xb0b4b8 });
    k.cyl(0.065, 1.6, 'steel', { at: [-0.7, 6.4 + 0.6, 0], seg: 12, color: 0xc0c4c8 });
    k.push(-0.7, 7.6, 0, Math.PI / 2 - 0.4, -0.35); k.box(1.6, 0.08, 0.08, 'steel', { color: C.dark, r: 0.01 });
    for (let i = 0; i < 4; i++) { const u = -0.6 + i * 0.4; k.box(0.34, 0.26, 0.16, 'dark', { at: [u, 0.18, 0.04], color: C.dark, r: 0.02 }); k.box(0.28, 0.2, 0.02, 'steel', { at: [u, 0.18, 0.125], color: 0x9aa4ac, r: 0.006, occ: false }); }
    k.pop();
    snowCap(k, 2.2, 1.15, 0.12, [0, 1.3, 0]);
    k.pop();
    cols.push(box3(x - 1.6, 0, z - 1.6, x + 1.6, y0 + 1.4, z + 1.6));
    mound(k, x - 1.4, z - 0.6, 0.7, 0.3); }
  // Nansen sledge with drums lashed on, parked beside it
  { const x = 4.4, z = 9.8, ry = -0.25, y0 = seat(x, z, 1.4, 0.05);
    k.push(x, y0, z, ry);
    for (const e of [-0.48, 0.48]) { k.box(3.0, 0.06, 0.09, 'wood', { at: [0, 0.05, e], color: 0x7a5a3a, r: 0.015 }); k.push(1.55, 0.14, e, 0, 0, 0.45); k.box(0.3, 0.06, 0.09, 'wood', { color: 0x7a5a3a, r: 0.015 }); k.pop(); for (let s = 0; s < 5; s++) k.box(0.05, 0.28, 0.05, 'wood', { at: [-1.2 + s * 0.6, 0.22, e], color: 0x6a4a2a, r: 0.008 }); }
    for (let s = 0; s < 11; s++) k.box(0.12, 0.03, 1.06, 'wood', { at: [-1.35 + s * 0.27, 0.37, 0], color: jit(0x8a6a44, rnd, 0.1), r: 0.006 });
    for (let j = 0; j < 3; j++) { k.push(-0.9 + j * 0.9, 0.39 + 0.29, 0, 0, Math.PI / 2); k.push(0, -0.425, 0); barrel(k, { color: jit([0x2a4a6a, 0x8a2a1e, 0x2a4a6a][j], rnd, 0.1) }); k.pop(); k.pop(); }
    for (let j = 0; j < 3; j++) d.add(tube(Array.from({ length: 9 }, (_, q) => { const a = Math.PI * q / 8; return [-0.9 + j * 0.9 + 0.22, 0.68 + Math.sin(a) * 0.31, Math.cos(a) * 0.5]; }), 0.012, { radial: 4 }), 'dark', { color: C.yellow, occ: false });
    for (let j = 0; j < 3; j++) snowCap(k, 0.26, 0.78, 0.05, [-0.9 + j * 0.9, 0.985, 0]); // snow along the drum tops
    k.pop();
    cols.push(box3(x - 1.8, 0, z - 1.0, x + 1.8, y0 + 1.0, z + 1.0)); }
  // tarp-lashed pile on pallets (blue tarp draped over boxes, ropes, a snow load) + jerry cans
  { const x = 10.2, z = 13.3, ry = 0.2, y0 = seat(x, z, 1.0, 0.06);
    k.push(x, y0, z, ry);
    for (const e of [-0.62, 0.62]) { k.push(e, 0, 0); pallet(k, { color: 0xa08460, seed: 5 }); k.pop(); }
    k.box(2.3, 0.9, 1.15, 'dark', { at: [0, 0.6, 0], color: 0x2a4a72, r: 0.18, seg: 3 });
    k.box(1.4, 0.4, 1.0, 'dark', { at: [0.3, 1.2, 0.02], color: 0x2c4c76, r: 0.15, seg: 3 });
    for (const e of [-0.7, 0.0, 0.7]) d.add(tube([[e, 0.16, -0.62], [e, 1.0, -0.62], [e + 0.1, 1.38, 0], [e, 1.0, 0.62], [e, 0.16, 0.62]], 0.01, { radial: 4, curve: true, samples: 12 }), 'dark', { color: 0xc8b070, occ: false });
    snowCap(k, 1.3, 0.85, 0.1, [0.3, 1.42, 0.02]); snowCap(k, 2.1, 1.0, 0.07, [-0.2, 1.06, 0.0]);
    for (let i = 0; i < 3; i++) { k.push(1.5 + i * 0.22, 0, 0.7, 0.15 * i); k.box(0.17, 0.46, 0.34, 'paint', { at: [0, 0.23, 0], color: [0x7a2a1e, 0x3a5a3a, 0x7a2a1e][i], r: 0.03 }); k.pop(); }
    k.pop();
    cols.push(box3(x - 1.5, 0, z - 1.1, x + 2.2, y0 + 1.5, z + 1.1)); }
  // fuel hose from the yard over the snow on timber sleepers to the hab utility end
  { const pts = [[9.0, 12.0], [12.4, 11.6], [15.8, 10.6], [19.6, 8.6], [24.0, 8.5], [28.6, 8.2], [31.0, 6.4]];
    const path = pts.map(([x, z]) => [x, Math.max(0, gy(x, z)) + 0.13, z]);
    d.add(tube(path, 0.035, { radial: 8, curve: true, samples: 40 }), 'dark', { color: 0x1c1d1f, occ: false });
    for (let i = 1; i < pts.length - 1; i++) { const [x, z] = pts[i], a = Math.atan2(pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]); k.box(0.6, 0.09, 0.14, 'wood', { at: [x, Math.max(0, gy(x, z)) + 0.04, z], rot: [0, a + Math.PI / 2, 0], color: 0x5a4632, r: 0.01 }); }
    k.add(lathe([[0.07, -0.08], [0.09, -0.06], [0.09, 0.06], [0.07, 0.08]], { seg: 12, crease: 40 }), 'steel', { at: [path[3][0], path[3][1], path[3][2]], rot: [0, 0, Math.PI / 2], color: C.yellow, occ: false }); } // coupling
  return cols;
}
