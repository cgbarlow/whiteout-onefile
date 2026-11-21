// Vehicle shed (portal frame, trapezoid cladding, part-raised roller shutter, snowcat inside) and the three generator
// lean-tos (SHS posts on pads, rafters + purlins, corrugated roof, clad back wall, gutter, per-unit wear and clutter).
// The generators themselves and the beacon tower belong to modules/generators; the lean-to lamps to look/practicals.
import { panelWall, extrudeBevel, iBeamGeo, tube, lathe, barrel } from '../../cookbook/geo/kit.js';
import { C, shade, jit, box3, faceU, toWorld, pushFace, skin, rivets, windowUnit, doorLeaf, canopy, eBox, roofLadder, cable } from './parts.js';
import { winUV } from './textures.js';
import { roundedBox } from '../../cookbook/geo/kit.js';
import { snowcat } from './snowcat.js';
import { elecCabinet } from './fixtures.js';

const SIDES = ['+z', '-z', '+x', '-x'];

export function vehicleShed(k, d, s, rnd) {
  const [cx, cz] = s.c, [sx, sz] = s.size, eave = s.h - 0.4, rise = 1.2, hx = sx / 2, hz = sz / 2, cols = [], signs = [];
  const clad = 0x7f8b94, trim = 0x4e555c;
  k.box(sx + 0.2, 0.12, sz + 0.2, 'concrete', { at: [cx, 0.04, cz], color: C.conc, r: 0.02, step: 2 });
  // openings: big roller door centred on s.door, personnel door to its south, two high windows per long side
  const du = faceU('-x', cx, cz, hx, hz, s.door[0], s.door[1]), bw = 4.2, bh = 3.7;
  const holes = { '-x': [{ u0: du - bw / 2, u1: du + bw / 2, v0: 0, v1: bh, door: true }, { u0: du + bw / 2 + 0.9, u1: du + bw / 2 + 1.85, v0: 0, v1: 2.1, door: true }],
    '+z': [{ u0: 2.0, u1: 3.4, v0: 2.6, v1: 3.3 }, { u0: 5.0, u1: 6.4, v0: 2.6, v1: 3.3 }], '-z': [{ u0: 2.0, u1: 3.4, v0: 2.6, v1: 3.3 }], '+x': [] };
  for (const sd of SIDES) {
    const w = pushFace(k, sd, cx, cz, hx, hz, 0.1);
    d.push(); skin(d, w, eave - 0.1, holes[sd], { kind: 'trapezoid', pitch: 0.32, depth: 0.04, mat: 'paint', color: jit(clad, rnd, 0.04), ystep: 1.2 }); d.pop();
    k.box(w + 0.04, 0.16, 0.06, 'steel', { at: [w / 2, 0.08, 0.03], color: trim, r: 0.01 }); // base angle
    k.box(w + 0.1, 0.18, 0.1, 'steel', { at: [w / 2, eave - 0.19, 0.06], color: trim, r: 0.012 }); // eaves trim / gutter
    for (const o of holes[sd]) if (!o.door) windowUnit(k, d, o.u0, o.v0, o.u1 - o.u0, o.v1 - o.v0, { reveal: 0.1, color: 0xb8bcc0, uv: winUV(3), mull: 1 });
    // wall colliders around openings
    const door = holes[sd].filter((o) => o.door).sort((a, b) => a.u0 - b.u0);
    let u = 0;
    for (const o of [...door, { u0: w, u1: w }]) {
      if (o.u0 - u > 0.05) { const p0 = toWorld(sd, cx, cz, hx, hz, 0, u, 0, 0.06), p1 = toWorld(sd, cx, cz, hx, hz, 0, o.u0, 0, -0.2); cols.push(box3(p0[0], 0, p0[2], p1[0], eave + rise, p1[2])); }
      u = o.u1;
    }
    k.pop();
  }
  for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.box(0.14, eave, 0.14, 'steel', { at: [cx + ax * (hx + 0.03), eave / 2, cz + az * (hz + 0.03)], color: trim, r: 0.01 });
  // gables (ridge along x) + roof sheets + ridge cap
  for (const sd of ['+x', '-x']) { const w = pushFace(k, sd, cx, cz, hx, hz, eave); k.add(extrudeBevel([[0, 0], [w, 0], [w / 2, rise]], { depth: 0.06, bevel: 0.005 }), 'steel', { color: clad }); k.pop(); }
  const ov = 0.3, run = Math.hypot(hz + ov, rise), a = Math.atan2(rise, hz + ov);
  for (const [x0, z0, ry] of [[cx - hx - ov, cz + hz + ov, 0], [cx + hx + ov, cz - hz - ov, Math.PI]]) { d.push(x0, eave - 0.03, z0, ry, a - Math.PI / 2); d.add(panelWall(sx + 2 * ov, run, { kind: 'trapezoid', pitch: 0.3, depth: 0.035, ystep: 1.4 }), 'steel', { color: 0x9aa2a8, occ: false }); d.pop(); }
  k.box(sx + 0.7, 0.1, 0.34, 'steel', { at: [cx, eave + rise + 0.02, cz], color: trim, r: 0.02 });
  for (let i = 0; i < 3; i++) k.box(0.6, 0.3, 0.5, 'steel', { at: [cx - 2.4 + i * 2.4, eave + rise + 0.12, cz], color: trim, r: 0.03 }); // ridge vents
  // portal frames inside (I-beam columns + rafters)
  for (let x = cx - hx + 0.4; x < cx + hx; x += 2.4) for (const sgn of [-1, 1]) {
    k.add(iBeamGeo(eave - 0.1, { h: 0.24, b: 0.14, tw: 0.008, tf: 0.012 }), 'steel', { at: [x, 0.1 + (eave - 0.1) / 2, cz + sgn * (hz - 0.2)], rot: [-Math.PI / 2, 0, 0], color: 0x5a6068 });
    const r0 = [x, eave - 0.1, cz + sgn * (hz - 0.2)], r1 = [x, eave + rise - 0.25, cz];
    k.bar(r0, r1, 0.14, 0.24, 'steel', { color: 0x5a6068, r: 0.004 });
  }
  // big door: drum box, guides, slats down to 3.05 m (part-raised), threshold + apron
  pushFace(k, '-x', cx, cz, hx, hz, 0.1);
  k.box(bw + 0.4, 0.55, 0.55, 'steel', { at: [du, bh + 0.3, 0.28], color: 0xb0b4b8, r: 0.03 });
  for (const e of [-1, 1]) k.box(0.1, bh, 0.12, 'steel', { at: [du + e * (bw / 2 + 0.03), bh / 2, 0.06], color: trim, r: 0.01 });
  for (let y = bh - 0.05; y > 3.0; y -= 0.11) k.box(bw - 0.04, 0.095, 0.03, 'steel', { at: [du, y, 0.04], color: jit(0xc0c4c6, rnd, 0.03), r: 0.012, occ: false });
  k.box(bw - 0.02, 0.07, 0.07, 'dark', { at: [du, 3.0, 0.04], color: C.dark, r: 0.012 });
  k.box(bw + 1.6, 0.1, 2.4, 'concrete', { at: [du, -0.05, 1.3], color: shade(C.conc, 0.9), r: 0.02 });
  // personnel door + canopy + wall gear (electrical panel, shed lamp, ladder to the roof)
  const pd = holes['-x'][1];
  k.box(pd.u1 - pd.u0, 2.1, 0.03, 'dark', { at: [(pd.u0 + pd.u1) / 2, 1.05, -0.12], color: 0x15161a, r: 0 });
  doorLeaf(k, d, pd.u0 + 0.02, 0, { w: pd.u1 - pd.u0 - 0.04, h: 2.05, color: 0x8a949c, open: 0.0, porthole: false });
  canopy(k, d, pd.u0 - 0.2, 2.45, pd.u1 - pd.u0 + 0.4, 0.9, C.grey);
  eBox(k, d, du - bw / 2 - 0.6, 1.6, { w: 0.55, h: 0.7, color: 0x9aa0a6 });
  eBox(k, d, du - bw / 2 - 1.3, 1.3, { w: 0.3, h: 0.4, color: C.yellow });
  k.box(0.3, 0.2, 0.22, 'dark', { at: [du + bw / 2 + 0.45, 3.0, 0.12], color: C.dark, r: 0.02 });
  k.box(0.24, 0.07, 0.15, 'glass', { at: [du + bw / 2 + 0.45, 2.88, 0.14], r: 0.01, occ: false });
  roofLadder(k, 0.6, eave, { color: C.yellow, cage: true });
  k.pop();
  signs.push({ name: 'shed', at: toWorld('-x', cx, cz, hx, hz, 0.1, du, bh + 0.35, 0.57), ry: -Math.PI / 2 });
  signs.push({ name: 'nosmoke', at: toWorld('-x', cx, cz, hx, hz, 0.1, du - bw / 2 - 0.6, 2.3, 0.05), ry: -Math.PI / 2 });
  // snowcat parked inside, nose to the door
  snowcat(k, d, cx + 0.6, cz - 0.3, rnd);
  for (const e of [-1, 1]) signs.push({ name: 'cat', at: [cx + 0.6 + 0.76, 1.42, cz - 0.3 + e * 0.957], ry: e > 0 ? 0 : Math.PI }); // fleet number on the cab doors
  cols.push(box3(cx - 2.4, 0, cz - 1.9, cx + 2.6, 2.9, cz + 1.3));
  // workbench + tyres + shelving along the inside +z wall
  k.box(2.4, 0.06, 0.7, 'wood', { at: [cx + 1.6, 0.95, cz + hz - 0.55], color: 0x8a6a4a, r: 0.01 });
  for (const e of [-1.1, 1.1]) k.box(0.06, 0.85, 0.6, 'steel', { at: [cx + 1.6 + e, 0.52, cz + hz - 0.55], color: C.dark, r: 0.005 });
  for (let i = 0; i < 3; i++) k.add(lathe([[0.22, -0.13], [0.36, -0.12], [0.38, 0], [0.36, 0.12], [0.22, 0.13]], { seg: 20, crease: 60 }), 'dark', { at: [cx - 2.6, 0.24 + i * 0.27, cz + hz - 0.6], color: 0x18191b });
  return { colliders: cols, signs, door: toWorld('-x', cx, cz, hx, hz, 0, du, 0, 1.6) };
}

/** generator lean-to: back wall north (-z), open W/E/S; plinth under the generator */
export function leanTo(k, d, g, rnd, idx) {
  const [cx, cz] = g.c, w = 5, dp = 4, hb = 2.9, hf = 2.4, cols = [], signs = [];
  const clad = [0x8e979e, 0x5d6a58, 0x7a5440][idx % 3], frame = [0x5a6068, 0x4a5048, 0x5a4a40][idx % 3];
  // posts (SHS) on base plates over concrete pads, knee braces
  for (const [px, pz, ph] of [[-w / 2, -dp / 2, hb], [w / 2, -dp / 2, hb], [-w / 2, dp / 2, hf], [w / 2, dp / 2, hf]]) {
    k.box(0.4, 0.2, 0.4, 'concrete', { at: [cx + px, 0.02, cz + pz], color: C.conc, r: 0.02 });
    k.box(0.24, 0.02, 0.24, 'steel', { at: [cx + px, 0.13, cz + pz], color: frame, r: 0.003 });
    k.box(0.12, ph - 0.12, 0.12, 'steel', { at: [cx + px, 0.12 + (ph - 0.12) / 2, cz + pz], color: frame, r: 0.008 });
    cols.push(box3(cx + px - 0.12, 0, cz + pz - 0.12, cx + px + 0.12, ph, cz + pz + 0.12));
    for (const s of [-1, 1]) if (s * pz < 0) d.bar([cx + px, ph - 0.7, cz + pz], [cx + px, ph - 0.12, cz + pz + s * 0.6], 0.06, 0.06, 'steel', { color: frame });
  }
  const slope = Math.atan2(hb - hf, dp), ry0 = (hb + hf) / 2;
  for (const px of [-w / 2, w / 2]) k.bar([cx + px, hb, cz - dp / 2 - 0.1], [cx + px, hf, cz + dp / 2 + 0.1], 0.1, 0.16, 'steel', { color: frame, r: 0.006 }); // rafters
  for (let i = 0; i < 4; i++) { const t = i / 3, zz = cz - dp / 2 + t * dp, yy = hb - t * (hb - hf); k.box(w + 0.4, 0.1, 0.06, 'steel', { at: [cx, yy + 0.1, zz], color: frame, r: 0.006 }); } // purlins
  // corrugated roof: sheets with a little stagger (unit C has one sheet lifted by the wind)
  const sheetW = 1.05, n = Math.ceil((w + 0.6) / sheetW);
  for (let i = 0; i < n; i++) {
    const x0 = cx - (w + 0.6) / 2 + i * sheetW, lifted = idx === 2 && i === 1;
    // from the low front edge up the slope toward the back wall (front face up)
    const L = (dp + 0.5) / Math.cos(slope);
    k.push(x0, hf + 0.16 - 0.25 * Math.tan(slope) + (lifted ? 0.05 : 0), cz + dp / 2 + 0.25, 0, slope - Math.PI / 2 + (lifted ? 0.04 : 0));
    d.push(); d.add(panelWall(sheetW + 0.04, L, { kind: 'sine', pitch: 0.076, depth: 0.018, ystep: 1.6 }), 'steel', { color: jit(clad, rnd, 0.07), occ: false }); d.pop();
    k.pop();
  }
  k.box(w + 0.6, 0.12, 0.12, 'steel', { at: [cx, hf + 0.08, cz + dp / 2 + 0.28], color: frame, r: 0.02 }); // gutter
  // back wall: trapezoid cladding on girts
  k.push(cx - w / 2, 0.1, cz - dp / 2 - 0.1, 0);
  d.push(); d.add(panelWall(w, hb - 0.05, { kind: 'trapezoid', pitch: 0.3, depth: 0.035, ystep: 0.8 }), 'paint', { color: jit(clad, rnd, 0.05), occ: false }); d.pop();
  k.pop();
  k.box(w, hb - 0.1, 0.04, 'steel', { at: [cx, 0.1 + (hb - 0.1) / 2, cz - dp / 2 - 0.16], color: shade(clad, 0.7), r: 0.004 });
  cols.push(box3(cx - w / 2, 0, cz - dp / 2 - 0.2, cx + w / 2, hb, cz - dp / 2));
  // plinth under the generator + cable conduit from the back wall, day tank, extinguisher, jerry cans
  k.box(3.4, 0.14, 1.8, 'concrete', { at: [g.gen[0], 0.03, g.gen[1]], color: shade(C.conc, 0.95), r: 0.02 });
  d.add(tube([[cx + 1.9, 1.8, cz - dp / 2 + 0.05], [cx + 1.9, 0.2, cz - dp / 2 + 0.05], [cx + 1.4, 0.14, cz - 1.2]], 0.03, { radial: 8, curve: true, samples: 12 }), 'dark', { color: C.black, occ: false });
  const cab = elecCabinet(k, d, cx + 1.7, 1.45, cz - dp / 2 + 0.25, 0, { w: 0.5, h: 0.65, dp: 0.42, color: 0x8a9096, rnd, ground: 0.12 }); // distribution board
  signs.push({ name: 'hvs', at: [cab.face[0] - 0.08, 1.6, cab.face[2]], ry: 0 }, { name: 'db' + g.id, at: [cab.face[0] + 0.02, 1.3, cab.face[2]], ry: 0 });
  const tx = cx - 1.85;
  k.box(0.7, 0.6, 0.5, 'steel', { at: [tx, 0.95, cz - 1.2], color: jit(0x5a6a3a, rnd, 0.1), r: 0.03 }); // day tank
  for (const e of [-0.3, 0.3]) k.box(0.05, 0.65, 0.45, 'steel', { at: [tx + e, 0.33, cz - 1.2], color: frame, r: 0.004 });
  k.cyl(0.075, 0.48, 'paint', { at: [cx + w / 2 - 0.15, 0.85, cz + dp / 2 - 0.2], seg: 14, color: 0x9a1a12 });
  for (let i = 0; i < 2 + idx % 2; i++) { k.push(cx - w / 2 + 0.5 + i * 0.22, 0, cz + 1.1, 0.2 * i); k.box(0.17, 0.46, 0.34, 'paint', { at: [0, 0.23, 0], color: [0x7a2a1e, 0x3a5a3a, 0x7a2a1e][i], r: 0.03 }); k.pop(); }
  signs.push({ name: 'gen' + g.id, at: [cx - 1.25, 2.25, cz - dp / 2 - 0.05], ry: 0 });
  signs.push({ name: 'hv', at: [cx + 1.7, 1.95, cz - dp / 2 + 0.03], ry: 0 });
  return { colliders: cols, signs };
}
