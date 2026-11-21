// Station props: fuel tanks with 2:1 ellipsoidal heads on steel saddles (weld seams, manway, vent gooseneck, fill line,
// gauge, ladder), guyed triangular lattice masts (3 top dressings), work-light poles with floodlight heads, crate /
// aluminium case / drum clusters, a drum rack, a container (skidoo.js: snowmobile + sledge), snow fence, cable runs on
// posts. Everything sits on the snow surface (parts.seat) and is bevelled; colliders returned as Box3.
import { lathe, tube, crate, barrel, pallet, container, extrudeBevel, pipeRun, ladder, railing } from '../../cookbook/geo/kit.js';
import { C, shade, jit, box3, seat, gy, cable, remapUV } from './parts.js';
import { roundedBox } from '../../cookbook/geo/kit.js';
import { winUV } from './textures.js';
import { snowCap, driftAlong, windTail } from './wear.js';
const WR = -Math.atan2(2, 6); // downwind heading (wind [6, 0, 2])
// work-light head: pivot (x, 4.33, z + 0.33), tilted so the lens faces down and slightly +z (the atmosphere's lamp
// axis (0, -1, 0.3)); WORK_LENS = lens centre offset from the pole foot [dx, y, dz] (index.js puts the light there)
export const WORK_TILT = 1.27;
export const WORK_LENS = [0, 4.33 - 0.075 * Math.sin(WORK_TILT), 0.33 + 0.075 * Math.cos(WORK_TILT)];

// props register their ground contact blobs / stencils here; index.js turns them into wear decals
export const MARKS = { blobs: [], stencils: [] };

// ------------------------------------------------------------------ fuel tank
export function fuelTank(k, d, [x, z, ry], i, rnd) {
  const L = 6, R = 1.2, yc = 0.62 + R, hd = R / 2, y0 = seat(x, z, 2.0, 0.03);
  const col = [0x7f8a70, 0xbcb39c, 0x5f6e5a][i % 3];
  // shell profile along the axis: ellipsoidal heads + straight shell with raised weld seams every 1.5 m
  const prof = [[0, -L / 2]];
  for (let j = 1; j <= 8; j++) { const a = (j / 8) * Math.PI / 2; prof.push([R * Math.sin(a), -L / 2 + hd * (1 - Math.cos(a))]); }
  const ys = -L / 2 + hd, ye = L / 2 - hd;
  for (let s = ys + 1.25; s < ye - 0.5; s += 1.5) prof.push([R, s - 0.012], [R + 0.006, s - 0.004], [R + 0.006, s + 0.004], [R, s + 0.012]);
  for (let j = 8; j >= 1; j--) { const a = (j / 8) * Math.PI / 2; prof.push([R * Math.sin(a), L / 2 - hd * (1 - Math.cos(a))]); }
  prof.push([0, L / 2]);
  k.push(x, y0, z, ry);
  k.add(lathe(prof, { seg: 40, crease: 30 }), 'paint', { at: [0, yc, 0], rot: [0, 0, Math.PI / 2], color: col, occ: { r: R, y0: -L / 2, y1: L / 2 } });
  // saddles: plate with a curved cradle on a base plate + concrete footing
  for (const sx of [-L / 2 + 1.25, L / 2 - 1.25]) {
    const Rr = R + 0.01, th = Math.acos(0.95 / Rr), yA = yc - Rr * Math.sin(th), pts = [[-1.0, 0], [1.0, 0], [1.0, yA]];
    for (let j = 0; j <= 14; j++) { const a = -th - (j / 14) * (Math.PI - 2 * th); pts.push([Rr * Math.cos(a), yc + Rr * Math.sin(a)]); }
    pts.push([-1.0, yA]);
    k.add(extrudeBevel(pts, { depth: 0.02, bevel: 0.004 }), 'steel', { at: [sx, 0, 0], rot: [0, Math.PI / 2, 0], color: C.steel });
    for (const e of [-0.12, 0.12]) k.box(0.02, 0.5, 1.9, 'steel', { at: [sx + e, 0.3, 0], color: C.steel, r: 0.004 });
    k.box(0.5, 0.03, 2.2, 'steel', { at: [sx, 0.015, 0], color: C.dark, r: 0.005 });
    k.box(0.7, 0.25, 2.4, 'concrete', { at: [sx, -0.1, 0], color: C.conc, r: 0.02 });
    for (const e of [-0.9, 0.9]) d.cyl(0.02, 0.05, 'steel', { at: [sx, 0.05, e], seg: 6, color: C.dark, occ: false });
  }
  // straps over the shell
  for (const sx of [-L / 2 + 1.25, L / 2 - 1.25]) d.add(tube(Array.from({ length: 17 }, (_, j) => { const a = Math.PI * (j / 16); return [sx, yc + Math.sin(a) * (R + 0.012), Math.cos(a) * (R + 0.012)]; }), 0.012, { radial: 4 }), 'dark', { color: C.dark, occ: false });
  // manway with bolted flange, vent gooseneck, fill pipe to ground, contents gauge, top walkway + ladder
  const top = yc + R;
  k.cyl(0.32, 0.22, 'steel', { at: [0.6, top + 0.07, 0], seg: 24, color: shade(col, 0.9) });
  k.cyl(0.38, 0.05, 'steel', { at: [0.6, top + 0.2, 0], seg: 24, color: shade(col, 0.85) });
  for (let j = 0; j < 12; j++) { const a = j * 0.5236; d.cyl(0.015, 0.04, 'steel', { at: [0.6 + Math.cos(a) * 0.34, top + 0.24, Math.sin(a) * 0.34], seg: 6, color: C.dark, occ: false }); }
  k.add(tube([[-1.4, top - 0.02, 0.2], [-1.4, top + 0.55, 0.2], [-1.4, top + 0.68, 0.32], [-1.4, top + 0.55, 0.44]], 0.04, { radial: 10, curve: true, samples: 10 }), 'steel', { color: 0x8a8e92, occ: false });
  // fill line hugging the shell: off the top, round the shoulder, down the side to a capped coupling at hand height
  const fl = []; for (let j = 0; j <= 8; j++) { const a = Math.PI / 2 - (j / 8) * (Math.PI / 2); fl.push([2.2, yc + Math.sin(a) * (R + 0.07), Math.cos(a) * (R + 0.07)]); }
  fl.push([2.2, 1.05, R + 0.07]);
  k.add(tube(fl, 0.04, { radial: 10 }), 'steel', { color: 0x5a5e62, occ: false });
  k.box(0.16, 0.2, 0.14, 'dark', { at: [2.2, 0.95, R + 0.1], color: C.yellow, r: 0.02 }); // fill cap
  k.cyl(0.09, 0.08, 'steel', { at: [-0.4, top + 0.02, 0.5], seg: 16, color: C.dark });
  if (i < 2) {
    k.box(1.6, 0.04, 0.7, 'steel', { at: [0.2, top + 0.24, -0.35], color: C.steel, r: 0.006 });
    railing(d, [[-0.6, top + 0.26, -0.7], [1.0, top + 0.26, -0.7]], { h: 0.9, postEvery: 0.8, r: 0.018, color: C.yellow, toe: false });
    k.push(-0.6, 0, -R - 0.15, Math.PI / 2); ladder(k, top + 0.25, { w: 0.42, color: C.yellow, cage: false }); k.pop();
  }
  k.pop();
  const c = Math.cos(ry), s = Math.sin(ry), hx = Math.abs(c) * L / 2 + Math.abs(s) * (R + 0.4), hz = Math.abs(s) * L / 2 + Math.abs(c) * (R + 0.4);
  return { col: box3(x - hx, 0, z - hz, x + hx, y0 + 2 * R + 0.7, z + hz), sign: { name: 'diesel', at: [x + Math.sin(ry) * (R + 0.02), y0 + yc + 0.2, z + Math.cos(ry) * (R + 0.02)], ry } };
}

// ------------------------------------------------------------------ guyed lattice mast
export function mast(k, d, [x, z], i, { h = 11 } = {}) {
  const y0 = seat(x, z, 0.6, 0.06), fw = 0.36, rr = fw / Math.sqrt(3), legs = [];
  k.box(0.9, 0.3, 0.9, 'concrete', { at: [x, y0 + 0.06, z], color: C.conc, r: 0.03 });
  k.box(0.5, 0.025, 0.5, 'steel', { at: [x, y0 + 0.22, z], color: C.steel, r: 0.004 });
  for (let j = 0; j < 3; j++) { const a = j * 2.0944 + i; legs.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  for (const [lx, lz] of legs) d.add(tube([[x + lx, y0 + 0.22, z + lz], [x + lx, y0 + h, z + lz]], 0.022, { radial: 8 }), 'steel', { color: C.grey, occ: false });
  const bay = 0.42;
  for (let y = y0 + 0.3, n = 0; y < y0 + h - bay; y += bay, n++) for (let j = 0; j < 3; j++) {
    const a = legs[j], b = legs[(j + 1) % 3], up = (n + j) % 2 === 0;
    d.rod([x + a[0], y + (up ? 0 : bay), z + a[1]], [x + b[0], y + (up ? bay : 0), z + b[1]], 0.009, 'steel', { color: C.grey });
    if (n % 3 === 0) d.rod([x + a[0], y, z + a[1]], [x + b[0], y, z + b[1]], 0.008, 'steel', { color: C.grey });
  }
  // guys: 3 directions × 2 levels to anchor blocks with turnbuckles
  for (let j = 0; j < 3; j++) {
    const a = j * 2.0944 + i + 0.5, gx = x + Math.cos(a) * h * 0.6, gz = z + Math.sin(a) * h * 0.6, gy0 = seat(gx, gz, 0.3, 0.05);
    k.box(0.45, 0.32, 0.45, 'concrete', { at: [gx, gy0 + 0.1, gz], rot: [0, a, 0], color: shade(C.conc, 0.9), r: 0.03 });
    for (const lv of [0.5, 0.92]) {
      const top = [x + Math.cos(a) * rr * 0.5, y0 + h * lv, z + Math.sin(a) * rr * 0.5], an = [gx, gy0 + 0.3, gz];
      d.add(tube([top, an], 0.011, { radial: 4 }), 'dark', { color: 0x2a2c30, occ: false });
    }
    d.cyl(0.03, 0.22, 'steel', { at: [gx - Math.cos(a) * 0.15, gy0 + 0.42, gz - Math.sin(a) * 0.15], rot: [0, 0, 0.6], seg: 6, color: C.steel, occ: false });
  }
  // top dressing: 0 yagi + whip, 1 met station (anemometer animated separately), 2 dipole array, 3 whip + lamp cage
  const t = y0 + h;
  k.cyl(0.03, 1.4, 'steel', { at: [x, t + 0.7, z], seg: 8, color: C.grey });
  if (i % 4 === 0 || i % 4 === 2) {
    for (let e = 0; e < 3; e++) {
      const yy = t - 0.5 - e * 0.9, ry = i * 0.7 + e * 1.1;
      k.push(x, yy, z, ry); k.box(2.0 - e * 0.4, 0.04, 0.04, 'steel', { at: [0.6, 0, 0], color: C.grey, r: 0.006 });
      for (let q = 0; q < 6 - e; q++) d.box(0.025, 0.025, 0.9 - q * 0.08, 'steel', { at: [0.0 + q * 0.3, 0, 0], color: C.grey, r: 0, occ: false });
      k.pop();
    }
  }
  if (i % 4 === 1) { k.box(1.6, 0.05, 0.05, 'steel', { at: [x, t - 0.2, z], color: C.grey, r: 0.006 }); k.box(0.3, 0.4, 0.22, 'paint', { at: [x, t - 1.4, z + 0.3], color: C.white, r: 0.02 }); }
  if (i % 4 === 3) { k.box(0.3, 0.3, 0.3, 'steel', { at: [x, t + 1.5, z], color: C.dark, r: 0.03 }); k.box(0.2, 0.15, 0.2, 'glass', { at: [x, t + 1.42, z], r: 0.01, occ: false }); }
  d.add(tube([[x + legs[0][0], y0 + 0.3, z + legs[0][1]], [x + legs[0][0] + 0.4, y0 + 0.05, z + legs[0][1]], [x + legs[0][0] + 2.5, gy(x + legs[0][0] + 2.5, z) + 0.02, z + legs[0][1] + 0.6]], 0.02, { radial: 5, curve: true, samples: 10 }), 'dark', { color: C.black, occ: false });
  return { col: box3(x - 0.5, 0, z - 0.5, x + 0.5, t, z + 0.5), top: [x, t, z], cups: i % 4 === 1 ? [x - 0.75, t - 0.1, z] : i % 4 === 0 ? [x, t + 1.5, z] : null };
}

// ------------------------------------------------------------------ work-light pole
export function workLightPole(k, d, [x, z], i) {
  const y0 = seat(x, z, 0.5, 0.06);
  k.box(0.8, 0.5, 0.8, 'concrete', { at: [x, y0 + 0.15, z], color: jit(C.conc, () => (i * 0.37) % 1, 0.08), r: 0.03 });
  k.box(0.32, 0.025, 0.32, 'steel', { at: [x, y0 + 0.41, z], color: C.steel, r: 0.004 });
  for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) d.cyl(0.018, 0.06, 'steel', { at: [x + ax * 0.12, y0 + 0.44, z + az * 0.12], seg: 6, color: C.dark, occ: false });
  k.add(lathe([[0.085, 0], [0.075, 0.3], [0.065, 4.1 - y0], [0.0, 4.1 - y0]], { seg: 12, crease: 40 }), 'steel', { at: [x, y0 + 0.42, z], color: C.grey, occ: { r: 0.085, y0: 0, y1: 4 } });
  // floodlight: arm off the pole top, U-yoke with pivot bolts, finned die-cast housing tilted down at the yard, visor,
  // bezel ring and a sodium lens ('glass' emissive) — the real light sits just in front of it (index.js WORK_LENS)
  k.box(0.08, 0.08, 0.42, 'steel', { at: [x, 4.47, z + 0.17], color: C.grey, r: 0.012 });
  k.box(0.64, 0.05, 0.07, 'steel', { at: [x, 4.47, z + 0.33], color: C.dark, r: 0.012 });
  for (const e of [-1, 1]) { k.box(0.035, 0.2, 0.07, 'steel', { at: [x + e * 0.3, 4.37, z + 0.33], color: C.dark, r: 0.008 }); d.cyl(0.022, 0.05, 'steel', { at: [x + e * 0.33, 4.33, z + 0.33], rot: [0, 0, Math.PI / 2], seg: 8, color: 0x6a6e72, occ: false }); }
  k.push(x, 4.33, z + 0.33, 0, WORK_TILT);
  k.box(0.52, 0.34, 0.16, 'dark', { at: [0, 0, -0.01], color: 0x23262a, r: 0.035 });
  k.box(0.5, 0.3, 0.04, 'dark', { at: [0, 0, -0.1], color: 0x1b1c1e, r: 0.015 });
  k.box(0.56, 0.025, 0.16, 'dark', { at: [0, 0.19, 0.06], rot: [-0.2, 0, 0], color: 0x23262a, r: 0.008 }); // visor
  for (const [w, h, ox, oy] of [[0.5, 0.035, 0, 0.145], [0.5, 0.035, 0, -0.145], [0.035, 0.29, 0.233, 0], [0.035, 0.29, -0.233, 0]]) k.box(w, h, 0.03, 'steel', { at: [ox, oy, 0.075], color: 0x8a8e92, r: 0.008 }); // bezel
  k.box(0.43, 0.255, 0.012, 'glass', { at: [0, 0, 0.07], r: 0.006, occ: false });
  for (let q = 0; q < 7; q++) d.box(0.012, 0.28, 0.09, 'dark', { at: [-0.21 + q * 0.07, 0, -0.165], color: C.dark, r: 0, occ: false }); // fins
  d.add(tube([[0.18, -0.12, -0.14], [0.2, -0.22, -0.2], [0.05, -0.3, -0.35]], 0.012, { radial: 5, curve: true, samples: 6 }), 'dark', { color: C.black, occ: false }); // lamp lead
  k.pop();
  d.add(tube([[x, 4.47, z + 0.3], [x + 0.05, 4.3, z + 0.22], [x + 0.06, 4.1, z + 0.07]], 0.01, { radial: 5, curve: true, samples: 6 }), 'dark', { color: C.black, occ: false });
  k.box(0.28, 0.36, 0.16, 'paint', { at: [x, 1.4 + y0, z - 0.14], color: 0x9aa0a6, r: 0.02 });
  d.add(tube([[x, 1.2 + y0, z - 0.2], [x + 0.1, y0 + 0.2, z - 0.4], [x + 0.6, gy(x + 0.6, z - 0.9) + 0.02, z - 0.9]], 0.018, { radial: 5, curve: true, samples: 10 }), 'dark', { color: C.black, occ: false });
  return box3(x - 0.45, 0, z - 0.45, x + 0.45, 4.5, z + 0.45);
}

// ------------------------------------------------------------------ clusters
/** wooden crates, aluminium polar cases, olive boxes; items: list of 'crate' | 'case' | 'box' | 'pallet' */
export function crateCluster(k, d, [x, z], rnd, n = 4) {
  const cols = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2.1 + rnd() * 0.6, r = i ? 1.0 + rnd() * 0.5 : 0, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, ry = (rnd() - 0.5) * 0.6;
    const kind = ['crate', 'case', 'box'][(i + Math.floor(rnd() * 2)) % 3];
    const y0 = seat(px, pz, 0.6, 0.09);
    k.push(px, y0, pz, ry);
    let top = 0, fw = 1.0, fd = 0.6;
    if (kind === 'crate') {
      if (rnd() < 0.5) { pallet(k, { color: 0xa88a62, seed: i + 3 }); top = 0.144; }
      k.push(0, top, 0); crate(k, { w: 1.2, h: 0.8, d: 0.8, color: jit(0xb89a70, rnd, 0.1), seed: i + 7 });
      for (const e of [-0.32, 0.32]) { // steel banding over the top and down both long faces, with crimp seals
        d.box(0.035, 0.006, 0.86, 'dark', { at: [e, 0.803, 0], color: 0x2a2c2e, r: 0, occ: false });
        for (const sz of [-1, 1]) { d.box(0.035, 0.8, 0.006, 'dark', { at: [e, 0.4, sz * 0.432], color: 0x2a2c2e, r: 0, occ: false }); d.box(0.05, 0.03, 0.012, 'steel', { at: [e, 0.55, sz * 0.437], color: C.steel, r: 0.002, occ: false }); }
      }
      k.pop(); top += 0.8; fw = 1.2; fd = 0.8;
      MARKS.stencils.push({ name: 'st' + (i % 3), at: [px + Math.sin(ry) * 0.445, y0 + top - 0.36, pz + Math.cos(ry) * 0.445], ry });
    }
    else if (kind === 'case') { // ribbed aluminium case (polar staple)
      const w = 0.8, h = 0.5, dd = 0.55;
      k.box(w, h, dd, 'steel', { at: [0, h / 2, 0], color: 0xc8ccd0, r: 0.03 });
      for (const e of [-1, 1]) { k.box(w + 0.01, 0.03, dd + 0.01, 'steel', { at: [0, h * (0.5 + e * 0.32), 0], color: 0xa8acb0, r: 0.01 }); d.box(0.14, 0.03, 0.03, 'dark', { at: [e * w * 0.3, h - 0.06, dd / 2 + 0.02], color: C.dark, r: 0.008, occ: false }); }
      top = h; fw = w; fd = dd;
    } else { k.box(1.0, 0.45, 0.55, 'paint', { at: [0, 0.225, 0], color: jit(0x4e5a3c, rnd, 0.1), r: 0.025 }); for (const e of [-1, 1]) d.box(0.04, 0.4, 0.58, 'dark', { at: [e * 0.35, 0.22, 0], color: C.dark, r: 0.006, occ: false }); top = 0.45; fw = 1.0; fd = 0.55; }
    let cw = fw, cd = fd, crot = 0;
    if (rnd() < 0.35) { k.push(0.05, top, 0, 0.3); k.box(0.8, 0.5, 0.55, 'steel', { at: [0, 0.25, 0], color: 0xc4c8cc, r: 0.03 }); k.pop(); top += 0.5; cw = 0.8; cd = 0.55; crot = 0.3; }
    // snow load on top (thicker toward the lee), a windward drift banked against the -x face
    k.push(0.05, top, 0, crot); snowCap(k, cw - 0.1, cd - 0.1, 0.035 + rnd() * 0.03, [0, 0.012, 0]); k.pop();
    k.pop();
    { const c = Math.cos(ry), sn = Math.sin(ry), lx = -fw / 2 - 0.02, a = [px + lx * c + (fd / 2 + 0.15) * sn, pz - lx * sn + (fd / 2 + 0.15) * c], b = [px + lx * c - (fd / 2 + 0.15) * sn, pz - lx * sn - (fd / 2 + 0.15) * c];
      driftAlong(k, a, b, Math.min(0.16, top * 0.22), 0.32 + rnd() * 0.14, 7 + i, { base: y0 + 0.05, side: -1 }); }
    windTail(k, px + Math.cos(WR) * (fw * 0.5 + 0.6), pz - Math.sin(WR) * (fw * 0.5 + 0.6), WR, 1.6 + rnd(), fd * 0.45, 0.14, 11 + i); // lee tail
    MARKS.blobs.push([px, pz, fw + 0.9, fd + 0.9, ry]);
    cols.push(box3(px - 0.7, 0, pz - 0.7, px + 0.7, y0 + top, pz + 0.7));
  }
  return cols;
}

export function drumCluster(k, d, [x, z], rnd, n = 6, { lying = 1 } = {}) {
  const cols = [], palette = [0x2a4a6a, 0x8a2a1e, 0xb8862e, 0x5a6068, 0x2a4a6a];
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + rnd() * 0.3, r = i ? 0.6 + (i % 3) * 0.12 : 0, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, y0 = seat(px, pz, 0.28, 0.04);
    const color = jit(palette[Math.floor(rnd() * palette.length)], rnd, 0.12);
    if (i >= n - lying) { // a drum lying on its side
      k.push(px + 0.8, y0 + 0.29, pz + 0.3, rnd() * 3, 0, Math.PI / 2); k.push(0, -0.425, 0); barrel(k, { color }); k.pop(); k.pop();
      cols.push(box3(px + 0.3, 0, pz - 0.2, px + 1.3, y0 + 0.6, pz + 0.8));
      continue;
    }
    k.push(px, y0, pz, rnd() * 6); barrel(k, { color }); k.pop();
    k.add(lathe([[0.27, 0], [0.27, 0.03], [0.2, 0.07], [0, 0.085]], { seg: 16, crease: 70 }), 'snow', { at: [px, y0 + 0.885, pz], color: 0xe6ebf1, occ: false }); // snow dome on the lid
    windTail(k, px + 0.45, pz + 0.1, WR, 1.4, 0.26, 0.14, i + 9);
    MARKS.blobs.push([px, pz, 0.95, 0.95, 0]);
    cols.push(box3(px - 0.3, 0, pz - 0.3, px + 0.3, y0 + 0.9, pz + 0.3));
  }
  return cols;
}

/** steel drum rack with drums lying in two tiers */
export function drumRack(k, d, [x, z], ry, rnd) {
  const y0 = seat(x, z, 1.2, 0.04);
  k.push(x, y0, z, ry);
  for (const e of [-0.95, 0.95]) for (const f of [-0.45, 0.45]) k.box(0.06, 1.45, 0.06, 'steel', { at: [e, 0.72, f], color: C.yellow, r: 0.006 });
  for (const y of [0.12, 0.78]) for (const f of [-0.45, 0.45]) k.box(1.96, 0.06, 0.06, 'steel', { at: [0, y, f], color: C.yellow, r: 0.006 });
  for (let t = 0; t < 2; t++) for (let j = 0; j < 3; j++) { if (t === 1 && j === 2) continue; k.push(-0.62 + j * 0.62, 0.45 + t * 0.66, -0.425, 0, Math.PI / 2); barrel(k, { color: jit([0x2a4a6a, 0x8a2a1e][(j + t) % 2], rnd, 0.1) }); k.pop(); }
  k.pop();
  return box3(x - 1.1, 0, z - 1.1, x + 1.1, y0 + 1.5, z + 1.1);
}

/** ISO container (cookbook prop) seated on two timber sleepers */
export function containerAt(k, [x, z], ry, color) {
  const y0 = seat(x, z, 2.5, 0.02);
  k.push(x, y0, z, ry);
  for (const e of [-2.2, 2.2]) k.box(0.25, 0.15, 2.7, 'wood', { at: [e, 0.07, 0], color: 0x5a4a3a, r: 0.01 });
  k.push(0, 0.15, 0); container(k, { color }); k.pop();
  k.pop();
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hx = c * 3.03 + s * 1.22, hz = s * 3.03 + c * 1.22;
  return box3(x - hx, 0, z - hz, x + hx, y0 + 2.75, z + hz);
}

/** wind-break snow fence: posts + horizontal slats with gaps (a few broken), along a→b */
export function snowFence(k, d, a, b, rnd) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(L / 2.4), dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L, ry = Math.atan2(-dz, dx);
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * L, x = a[0] + dx * t, z = a[1] + dz * t, y0 = seat(x, z, 0.1, 0.25);
    k.box(0.09, 2.1, 0.09, 'wood', { at: [x, y0 + 1.05, z], rot: [0, ry, (rnd() - 0.5) * 0.06], color: 0x5a4632, r: 0.01 });
    if (i === n) break;
    for (let j = 0; j < 5; j++) {
      if (rnd() < 0.07) continue; // a missing slat
      const t2 = t + L / n / 2, mx = a[0] + dx * t2, mz = a[1] + dz * t2, yy = seat(mx, mz, 0.1, 0) + 0.45 + j * 0.34;
      d.box(L / n + 0.05, 0.14, 0.02, 'wood', { at: [mx, yy, mz], rot: [0, ry, (rnd() - 0.5) * 0.03], color: jit(0x7a6046, rnd, 0.12), r: 0.004, occ: false });
    }
  }
}

/** overhead cable on T-posts between two ground points (posts seated, catenary spans) */
export function cableRun(k, d, a, b, posts = 5) {
  let prev = null;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(posts, Math.round(L / 2.6)), ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]) + Math.PI / 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, y0 = seat(x, z, 0.1, 0.2), hp = 1.55 + 0.08 * ((i * 5) % 3);
    k.box(0.09, hp, 0.09, 'wood', { at: [x, y0 + hp / 2, z], rot: [0, ry, 0.03 * (((i * 7) % 3) - 1)], color: 0x5e4a36, r: 0.01 });
    k.box(0.4, 0.06, 0.06, 'wood', { at: [x, y0 + hp - 0.1, z], rot: [0, ry, 0], color: 0x5e4a36, r: 0.006 });
    snowCap(k, 0.11, 0.11, 0.06, [x, y0 + hp + 0.02, z]); // snow on the post top
    d.box(0.42, 0.025, 0.08, 'snow', { at: [x, y0 + hp - 0.06, z], rot: [0, ry, 0], color: 0xe6ebf1, r: 0.01, occ: false }); // rime on the cross arm
    windTail(k, x + 0.12, z + 0.04, WR, 1.1, 0.16, 0.12, i + 3); // lee tail behind the post
    if (i % 2 === 0) { // flagging tape: two short tails knotted under the arm, hanging with the wind
      for (let j = 0; j < 2; j++) d.box(0.025, 0.28, 0.004, 'paint', { at: [x + 0.03 + j * 0.03, y0 + hp - 0.3, z], rot: [0.0, ry, 0.5 + j * 0.25], color: j ? 0xd84a14 : 0xe8c21a, r: 0, occ: false });
    }
    const p = [x, y0 + hp - 0.04, z];
    if (prev) { cable(d, prev, p, 0.22, 0.014); if (i % 2) cable(d, [prev[0], prev[1] + 0.008, prev[2]], [p[0], p[1] + 0.008, p[2]], 0.22, 0.018, 0xc8d2dc, 8); } // rime on alternate spans
    prev = p;
  }
}
