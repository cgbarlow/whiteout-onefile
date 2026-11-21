// Hollow modules (LAB-2 and the radio hut): interior lining with real window openings (reveals, inner trims, frosted
// glass quads in the wall plane), open door leaf, floor/ceiling with T-bar grid, skirting, coving, corner trims
// (no exterior paint ever shows at a joint), and the lab dressing: lab benches with drawer units and epoxy tops,
// monitors, instruments, wall shelves, tall shelving, freezer, cable trays with dropping looms, a duct, and three
// fluorescent fixtures (one working + failing, two dead). Interior kit keys: iface (walls/ceiling), isteel (floor,
// cabinets, trays), idark (worktops, plastics), frost (glass), screen (monitors), diffuser (lit tube lens).
import { tube, lathe, roundedBox } from '../../cookbook/geo/kit.js';
import { C, shade, jit, box3, toWorld, pushFace, doorLeaf, remapUV } from './parts.js';
import { monitor, instrument, papers, jars, trayLoop } from './labprops.js';

const WALL = 0xb4bdb2, CEIL = 0xdcded8, FLOOR = 0x3c4743, CAB = 0xa7aeac, TOP = 0x1f2225, TRIM = 0x8d968e;
const SIDES = ['+z', '-z', '+x', '-x'];

/** boxes filling (x0..x1, 0..h) around holes, in the current frame, depth thick centred at z */
const hash1 = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
function slab(k, x0, x1, h, holes, z, thick, key, color, panel = 0, seed = 0) {
  const cuts = new Set([x0, x1]);
  for (const o of holes) { if (o.u0 > x0 && o.u0 < x1) cuts.add(o.u0); if (o.u1 > x0 && o.u1 < x1) cuts.add(o.u1); }
  const seams = [];
  if (panel) for (let u = x0 + panel; u < x1 - 0.1; u += panel) { cuts.add(u); seams.push(u); }
  const xs = [...cuts].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], mid = (a + b) / 2; if (b - a < 0.01) continue;
    const hs = holes.filter((o) => mid > o.u0 && mid < o.u1).sort((p, q) => p.v0 - q.v0);
    // per-panel albedo jitter (±8 %, a few panels replaced in a slightly different batch / yellowed)
    const pc = panel ? jit(color, () => hash1(Math.floor((mid - x0) / panel), seed), hash1(Math.floor((mid - x0) / panel), seed + 3) < 0.15 ? 0.16 : 0.08) : color;
    const st = panel ? 0.35 : 1.2;
    let y = 0;
    for (const o of hs) { if (o.v0 - y > 0.01) k.box(b - a, o.v0 - y, thick, key, { at: [mid, (y + o.v0) / 2, z], color: pc, r: 0.004, step: st }); y = o.v1; }
    if (h - y > 0.01) k.box(b - a, h - y, thick, key, { at: [mid, (y + h) / 2, z], color: pc, r: 0.004, step: st });
  }
  // panel joints: a dark recessed H-section strip over each seam (interrupted by openings)
  for (const u of seams) {
    const hs = holes.filter((o) => u > o.u0 - 0.02 && u < o.u1 + 0.02).sort((p, q) => p.v0 - q.v0);
    let y = 0;
    for (const o of [...hs, { v0: h, v1: h }]) { if (o.v0 - y > 0.05) k.box(0.014, o.v0 - y, 0.006, key, { at: [u, (y + o.v0) / 2, z + thick / 2 + 0.002], color: shade(color, 0.55), r: 0.002, occ: false }); y = o.v1; }
  }
}

/**
 * Line a hollow shell. k = exterior AO kit (door leaf), ki = interior kit, d = detail, m = module, sh = moduleShell result.
 * Returns { colliders, glass: [[x,y,z,nx,nz]] (window centres, world) }.
 */
export function lineShell(k, ki, d, m, sh, { open = 1.9, wall = WALL, dOut = null } = {}) {
  const [cx, cz] = m.c, [sx, sz] = m.size, h = m.h, f = m.floor ?? 0.3, hx = sx / 2, hz = sz / 2, t = sh.t;
  const ih = h - 0.12, cols = [], glass = [];
  for (const s of SIDES) {
    const { w, holes } = sh.faces[s];
    pushFace(ki, s, cx, cz, hx, hz, f);
    // inner frame: mirrored u, facing into the room
    ki.push(w, 0, -t, Math.PI);
    const mh = holes.map((o) => ({ ...o, u0: w - o.u1, u1: w - o.u0 }));
    slab(ki, t, w - t, ih, mh, -0.015, 0.03, 'iface', wall, 1.2, SIDES.indexOf(s) * 17 + m.c[0]);
    // skirting + coving (interrupted by the door)
    slab(ki, t, w - t, 0.1, mh.filter((o) => o.door), 0.012, 0.02, 'idark', 0x2a2d2e);
    for (const o of mh) {
      if (o.door) { // door casing
        ki.box(o.u1 - o.u0 + 0.16, 0.08, 0.03, 'isteel', { at: [(o.u0 + o.u1) / 2, o.v1 + 0.04, 0.005], color: TRIM, r: 0.006 });
        for (const e of [o.u0 - 0.04, o.u1 + 0.04]) ki.box(0.08, o.v1, 0.03, 'isteel', { at: [e, o.v1 / 2, 0.005], color: TRIM, r: 0.006 });
        for (const e of [o.u0 + 0.015, o.u1 - 0.015]) ki.box(0.03, o.v1, t - 0.02, 'iface', { at: [e, o.v1 / 2, -t / 2], color: shade(wall, 0.9), r: 0.003 }); // jamb linings
        ki.box(o.u1 - o.u0, 0.03, t - 0.02, 'iface', { at: [(o.u0 + o.u1) / 2, o.v1 - 0.015, -t / 2], color: shade(wall, 0.85), r: 0.003 });
        continue;
      }
      // window: inner architrave, deep sill board, glass in the wall plane
      const cw = o.u1 - o.u0, cu = (o.u0 + o.u1) / 2;
      ki.box(cw + 0.14, 0.06, 0.025, 'isteel', { at: [cu, o.v1 + 0.03, 0.01], color: TRIM, r: 0.005 });
      for (const e of [o.u0 - 0.035, o.u1 + 0.035]) ki.box(0.07, o.v1 - o.v0, 0.025, 'isteel', { at: [e, (o.v0 + o.v1) / 2, 0.01], color: TRIM, r: 0.005 });
      ki.box(cw + 0.2, 0.03, 0.2, 'isteel', { at: [cu, o.v0 - 0.015, 0.04], color: shade(TRIM, 1.1), r: 0.008 });
      const g = roundedBox(cw - 0.02, o.v1 - o.v0 - 0.02, 0.006, 0, 0);
      remapUV(g, [0, 0, 1, 1]);
      ki.add(g, 'frost', { at: [cu, (o.v0 + o.v1) / 2, -t * 0.55], occ: false });
    }
    ki.box(w - 2 * t, 0.07, 0.07, 'iface', { at: [w / 2, ih - 0.035, 0.035], color: shade(wall, 1.05), r: 0.012 }); // coving
    ki.pop();
    // world-space window centres (for glow pools) + wall colliders around the door
    for (const o of holes) if (!o.door) {
      const p = toWorld(s, cx, cz, hx, hz, f, (o.u0 + o.u1) / 2, o.v0 + 0.3, 0.4), n = toWorld(s, 0, 0, 0, 0, 0, 0, 0, 1);
      glass.push([p[0], p[1], p[2], n[0], n[2]]);
    }
    const door = holes.find((o) => o.door), segs = door ? [[0, door.u0], [door.u1, w]] : [[0, w]];
    for (const [a, b] of segs) {
      if (b - a < 0.05) continue;
      const p0 = toWorld(s, cx, cz, hx, hz, 0, a, 0, 0.05), p1 = toWorld(s, cx, cz, hx, hz, 0, b, 0, -t - 0.05);
      cols.push(box3(p0[0], 0, p0[2], p1[0], f + h + 0.4, p1[2]));
    }
    ki.pop();
    if (door) { // open door leaf swung outward on the exterior
      pushFace(k, s, cx, cz, hx, hz, f);
      // leaf hardware (lever, hinges, closer) goes on the EXTERIOR detail kit: it shares k's stack, so it follows this
      // face frame. d (interior detail) follows ki, already popped here: it dropped the hardware at the world origin.
      doorLeaf(k, dOut, door.u0 + 0.025, 0, { w: door.u1 - door.u0 - 0.05, h: door.v1 - 0.05, color: C.white, open, porthole: true });
      k.pop();
    }
  }
  // floor (sheet vinyl), ceiling with a T-bar grid, vertical corner trims
  const iw = sx - 2 * t, id = sz - 2 * t;
  ki.box(iw, 0.03, id, 'isteel', { at: [cx, f + 0.0, cz], color: FLOOR, r: 0.003, step: 1.0 });
  ki.box(iw, 0.02, id, 'idark', { at: [cx, f + ih + 0.07, cz], color: 0x16171a, r: 0, occ: false }); // plenum (seen through a gap)
  { const nx = Math.round(iw / 0.6), nz = Math.max(1, Math.round(id / 1.2)), tw = iw / nx, td = id / nz;
    const miss = m.interior ? [Math.floor(nx * 0.72), 0] : [-1, -1];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = cx - iw / 2 + (i + 0.5) * tw, z = cz - id / 2 + (j + 0.5) * td, hsh = hash1(i * 7 + j, m.c[0] + 5);
      if (i === miss[0] && j === miss[1]) { // missing tile: dark void, a loose loom dropping out of it
        d.add(tube([[x - 0.1, f + ih + 0.05, z], [x - 0.05, f + ih - 0.05, z + 0.1], [x + 0.08, f + ih - 0.42, z + 0.16]], 0.008, { radial: 5, curve: true, samples: 8 }), 'idark', { color: 0x1b1c1e, occ: false });
        continue;
      }
      const tilt = i === miss[0] + 1 && j === miss[1] ? 0.05 : 0, stain = hsh < 0.07;
      const col = stain ? jit(0xb8ab8a, () => hsh * 9 % 1, 0.08) : jit(CEIL, () => hsh, 0.07);
      ki.box(tw - 0.012, 0.016, td - 0.012, 'iface', { at: [x, f + ih + 0.008 - tilt * 0.6, z], rot: [tilt, 0, 0], color: col, r: 0.003, step: 0.3 });
    }
  }
  for (let x = -iw / 2 + 0.6; x < iw / 2; x += 0.6) ki.box(0.025, 0.018, id, 'isteel', { at: [cx + x, f + ih - 0.009, cz], color: 0xb8bcb8, r: 0, occ: false });
  for (let z = -id / 2 + 1.2; z < id / 2; z += 1.2) ki.box(iw, 0.018, 0.025, 'isteel', { at: [cx, f + ih - 0.009, cz + z], color: 0xb8bcb8, r: 0, occ: false });
  for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) ki.box(0.07, ih, 0.07, 'iface', { at: [cx + ax * (iw / 2 - 0.02), f + ih / 2, cz + az * (id / 2 - 0.02)], color: shade(wall, 0.95), r: 0.01 });
  return { colliders: cols, glass, ih };
}

// --------------------------------------------------------------------------------------------- lab dressing
/** lab bench along a wall from x0..x1; zw = wall inner plane z, dir = +1 if the bench extends toward +z */
function bench(ki, d, f, x0, x1, zw, dir, rnd, items, labels) {
  const dp = 0.75, zc = zw + dir * dp / 2, L = x1 - x0, cols = [];
  // base cabinets in 0.6 m modules: drawers / cupboard / knee gap (never the same run twice)
  const n = Math.round(L / 0.6), mw = L / n;
  const plan = []; for (let i = 0; i < n; i++) plan.push(rnd() < 0.22 ? 'gap' : rnd() < 0.5 ? 'drawers' : 'door');
  for (let i = 0; i < n; i++) {
    const x = x0 + mw * (i + 0.5), kind = plan[i];
    if (kind === 'gap') {
      ki.box(mw, 0.05, 0.04, 'isteel', { at: [x, f + 0.82, zc + dir * (dp / 2 - 0.08)], color: CAB, r: 0.004 });
      if (rnd() < 0.6) ki.box(0.42, 0.28, 0.34, 'idark', { at: [x + (rnd() - 0.5) * 0.1, f + 0.14, zc - dir * 0.05], rot: [0, (rnd() - 0.5) * 0.3, 0], color: [0x3a5a7a, 0x8a8a84, 0x2c2f33][Math.floor(rnd() * 3)], r: 0.02 });
      continue;
    }
    ki.box(mw - 0.01, 0.78, dp - 0.08, 'isteel', { at: [x, f + 0.47, zc - dir * 0.03], color: jit(CAB, rnd, 0.03), r: 0.008 });
    ki.box(mw - 0.04, 0.08, 0.04, 'idark', { at: [x, f + 0.04, zc + dir * (dp / 2 - 0.1)], color: 0x2a2d2e, r: 0.004 }); // plinth
    const fz = zc + dir * (dp / 2 - 0.065);
    if (kind === 'drawers') for (let j = 0; j < 4; j++) {
      ki.box(mw - 0.03, 0.17, 0.02, 'isteel', { at: [x, f + 0.18 + j * 0.18, fz], color: shade(CAB, 1.06 - j * 0.02), r: 0.006 });
      d.box(0.18, 0.016, 0.022, 'isteel', { at: [x, f + 0.235 + j * 0.18, fz + dir * 0.02], color: 0x6a6e70, r: 0.004, occ: false });
    } else {
      ki.box(mw - 0.03, 0.7, 0.02, 'isteel', { at: [x, f + 0.47, fz], color: shade(CAB, 1.04), r: 0.006 });
      d.box(0.016, 0.16, 0.022, 'isteel', { at: [x + mw / 2 - 0.08, f + 0.7, fz + dir * 0.02], color: 0x6a6e70, r: 0.004, occ: false });
    }
    // asset tags / hazard stickers / handwritten notes on the cabinet fronts, kick scuffs on the plinth
    const fry = dir > 0 ? 0 : Math.PI, ff = fz + dir * 0.0115;
    if (rnd() < 0.55) labels.push(['tag' + Math.floor(rnd() * 3), 0.075, [x - mw * 0.25, f + 0.78, ff], fry]);
    if (rnd() < 0.18) labels.push(['haz' + Math.floor(rnd() * 3), 0.09, [x + mw * 0.1, f + 0.5, ff], fry]);
    else if (rnd() < 0.2) labels.push(['note' + Math.floor(rnd() * 3), 0.075, [x + mw * 0.15, f + 0.62, ff], fry]);
    if (rnd() < 0.5) labels.push(['kick' + Math.floor(rnd() * 2), mw * 0.8, [x, f + 0.12, ff + dir * 0.003], fry, 0.14]);
  }
  // epoxy top + back upstand
  ki.box(L + 0.02, 0.035, dp, 'idark', { at: [(x0 + x1) / 2, f + 0.9, zc], color: TOP, r: 0.006, step: 1.2 });
  ki.box(L, 0.12, 0.02, 'idark', { at: [(x0 + x1) / 2, f + 0.975, zw + dir * 0.01], color: TOP, r: 0.004 });
  cols.push(box3(x0, 0, zw, x1, f + 0.95, zw + dir * dp));
  // items along the top
  let x = x0 + 0.35;
  while (x < x1 - 0.4) {
    const r = rnd(), y = f + 0.918, iz = zc - dir * 0.08;
    if (r < 0.26) { monitor(ki, d, x + 0.25, y, iz, dir, Math.floor(rnd() * 4), items, labels, rnd); if (rnd() < 0.5) mug(ki, x + 0.62, y, zc + dir * 0.2); x += 0.95; }
    else if (r < 0.44) { instrument(ki, d, x + 0.22, y, iz, dir, rnd, labels); x += 0.7; }
    else if (r < 0.54) { binders(ki, x + 0.12, y, zw + dir * 0.14, dir, rnd); x += 0.55; }
    else if (r < 0.62) { rack(ki, d, x + 0.15, y, zc, rnd); x += 0.5; }
    else if (r < 0.68) { microscope(ki, x + 0.15, y, zc, dir); x += 0.55; }
    else if (r < 0.82) { papers(ki, d, x + 0.16, y, zc + dir * 0.05, dir, rnd); x += 0.62; }
    else if (r < 0.92) { jars(ki, d, x + 0.05, y, zc - dir * 0.12, rnd, labels, dir > 0 ? 0 : Math.PI); x += 0.55; }
    else { mug(ki, x + 0.1 + rnd() * 0.2, y, zc + dir * 0.15 * rnd()); x += 0.35; }
  }
  return cols;
}
function binders(ki, x, y, z, dir, rnd) {
  const cols = [0x2a4a6a, 0x8a2a1e, 0x3a5a3a, 0xb08a2e, 0x2c2f33];
  for (let i = 0; i < 5 + Math.floor(rnd() * 3); i++) ki.box(0.06, 0.3, 0.26, 'idark', { at: [x + i * 0.065, y + 0.15, z + dir * 0.02], rot: [0, 0, i === 4 ? 0.18 : 0], color: cols[Math.floor(rnd() * 5)], r: 0.006 });
}
function rack(ki, d, x, y, z, rnd) {
  ki.box(0.3, 0.06, 0.12, 'isteel', { at: [x, y + 0.06, z], color: 0xd0d4d6, r: 0.006 });
  for (let i = 0; i < 6; i++) d.cyl(0.011, 0.11, 'idark', { at: [x - 0.12 + i * 0.048, y + 0.08, z], seg: 6, color: [0x8ab0c8, 0xc8a050, 0x7a2a22][i % 3], occ: false });
}
function microscope(ki, x, y, z, dir) {
  ki.box(0.18, 0.03, 0.24, 'idark', { at: [x, y + 0.015, z], color: 0x1d1e20, r: 0.008 });
  ki.bar([x, y + 0.03, z - dir * 0.08], [x, y + 0.32, z - dir * 0.02], 0.05, 0.05, 'isteel', { color: 0xd8dadc, r: 0.012 });
  ki.push(x, y + 0.3, z, 0, dir * 0.5); ki.cyl(0.025, 0.2, 'idark', { seg: 12, color: 0x1d1e20 }); ki.pop();
  ki.box(0.12, 0.012, 0.1, 'isteel', { at: [x, y + 0.13, z + dir * 0.03], color: 0x30343a, r: 0.004 });
}
function mug(ki, x, y, z) { ki.add(lathe([[0, 0], [0.038, 0], [0.04, 0.005], [0.04, 0.095], [0.035, 0.095], [0.034, 0.012], [0, 0.012]], { seg: 14, crease: 40 }), 'isteel', { at: [x, y, z], color: 0xe8e2d4, occ: false }); }

/** the LAB-2 dressing; returns { colliders, lamps: [[x,y,z]] (fixture centres, lamps[1] = the working tube) } */
export function labDressing(ki, d, m, rnd, ih) {
  const [cx, cz] = m.c, [sx, sz] = m.size, f = m.floor, t = 0.16, x0 = cx - sx / 2 + t, x1 = cx + sx / 2 - t, zN = cz - sz / 2 + t, zS = cz + sz / 2 - t;
  const cols = [], items = [], labels = [];
  // benches: south wall in three runs, north wall in two (the door is on the east wall, aisle stays open)
  for (const [a, b] of [[x0 + 1.2, x0 + 4.4], [x0 + 4.9, x0 + 9.1], [x0 + 9.6, x1 - 1.3]]) cols.push(...bench(ki, d, f, a, b, zS, -1, rnd, items, labels));
  for (const [a, b] of [[x0 + 1.4, x0 + 5.6], [x0 + 6.1, x1 - 1.9]]) cols.push(...bench(ki, d, f, a, b, zN, 1, rnd, items, labels));
  // west wall: two tall shelving units + a -80 freezer between them, whiteboard above the freezer
  for (const [zc, w] of [[zN + 0.75, 1.2], [zS - 0.75, 1.2]]) {
    const xs = x0 + 0.24;
    for (const e of [-1, 1]) ki.box(0.45, 2.1, 0.03, 'isteel', { at: [xs, f + 1.05, zc + e * w / 2], color: 0x7d8488, r: 0.004 });
    for (let j = 0; j < 5; j++) {
      const y = f + 0.15 + j * 0.47;
      ki.box(0.45, 0.025, w, 'isteel', { at: [xs, y, zc], color: 0x8a9094, r: 0.004 });
      let z = zc - w / 2 + 0.06;
      while (z < zc + w / 2 - 0.12 && j < 4) {
        const bw = 0.1 + rnd() * 0.25, bh = 0.12 + rnd() * 0.28, kind = rnd();
        if (z + bw > zc + w / 2 - 0.03) break;
        ki.box(0.34, bh, bw, kind < 0.6 ? 'isteel' : 'idark', { at: [xs + 0.02, y + 0.012 + bh / 2, z + bw / 2], color: kind < 0.6 ? jit(0xb8b0a0, rnd, 0.15) : [0x2a4a6a, 0x7a2a22, 0x3a5a3a][Math.floor(rnd() * 3)], r: 0.008 });
        z += bw + 0.02 + rnd() * 0.06;
      }
    }
    cols.push(box3(x0, 0, zc - w / 2, x0 + 0.5, f + 2.1, zc + w / 2));
  }
  ki.box(0.7, 0.9, 1.4, 'isteel', { at: [x0 + 0.36, f + 0.45, cz], color: 0xd8dadc, r: 0.03 }); // chest freezer
  ki.box(0.72, 0.06, 1.42, 'isteel', { at: [x0 + 0.36, f + 0.93, cz], color: 0xc8cacc, r: 0.02 });
  ki.box(0.04, 0.06, 0.4, 'idark', { at: [x0 + 0.72, f + 0.8, cz], color: 0x2a2c2e, r: 0.01 });
  ki.box(0.025, 0.9, 1.5, 'iface', { at: [x0 + 0.02, f + 1.85, cz], color: 0xe8eaea, r: 0.006 }); // whiteboard
  cols.push(box3(x0, 0, cz - 0.7, x0 + 0.72, f + 0.96, cz + 0.7));
  // cable trays along both long walls with looms dropping to the benches; a round supply duct
  for (const [zw, dir] of [[zN, 1], [zS, -1]]) {
    const zt = zw + dir * 0.32, yt = f + ih - 0.42;
    for (const e of [-0.14, 0.14]) ki.box(x1 - x0 - 0.4, 0.05, 0.012, 'isteel', { at: [cx, yt, zt + e], color: 0x9aa0a4, r: 0.003 });
    for (let x = x0 + 0.4; x < x1 - 0.2; x += 0.3) d.box(0.025, 0.012, 0.28, 'isteel', { at: [x, yt - 0.02, zt], color: 0x9aa0a4, r: 0, occ: false });
    for (let x = x0 + 0.6; x < x1 - 0.4; x += 1.2) d.box(0.02, ih - (yt - f) + 0.02, 0.02, 'isteel', { at: [x, (yt + f + ih) / 2, zt], color: 0x6a6e72, r: 0, occ: false });
    for (let q = 0; q < 4; q++) { const lx = x0 + 1.0 + q * 3.1 + rnd() * 0.8; trayLoop(d, lx, lx + 0.5 + rnd() * 0.6, yt - 0.02, zt + (rnd() - 0.5) * 0.15, 0.18 + rnd() * 0.3, [0x1b1c1e, 0x3a3c40, 0x5a2a1e][q % 3]); }
    for (let c = 0; c < 4; c++) d.add(tube([[x0 + 0.3, yt + 0.0 + c * 0.012, zt - 0.08 + c * 0.05], [x1 - 0.3, yt + c * 0.012, zt - 0.08 + c * 0.05]], 0.011, { radial: 5 }), 'idark', { color: [0x1b1c1e, 0x3a3c40, 0x5a2a1e, 0x1e2a3a][c], occ: false });
  }
  for (const it of items) { // loom from the tray down the wall to each monitor
    const zw = it[2] < cz ? zN : zS, dir = zw === zN ? 1 : -1, zt = zw + dir * 0.32;
    for (const o of [-0.03, 0.02]) d.add(tube([[it[0] + o, f + ih - 0.44, zt - dir * 0.1], [it[0] + o, f + ih - 0.5, zw + dir * 0.035], [it[0] + o, f + 1.0, zw + dir * 0.035]], 0.011, { radial: 5 }), 'idark', { color: o < 0 ? 0x1b1c1e : 0x3a3c40, occ: false });
  }
  const dz = cz + 1.75, dy = f + ih - 0.16;
  ki.push(cx, dy, dz, 0, 0, Math.PI / 2); ki.cyl(0.1, x1 - x0 - 0.3, 'isteel', { seg: 16, color: 0xd0d4d6 }); ki.pop(); // spiral supply duct
  for (let x = x0 + 1; x < x1 - 0.5; x += 2.4) { d.box(0.25, 0.025, 0.025, 'isteel', { at: [x, dy - 0.11, dz], color: 0x8a8e92, r: 0, occ: false }); d.box(0.36, 0.12, 0.2, 'isteel', { at: [x + 0.6, dy - 0.12, dz], color: 0xc0c4c6, r: 0.01, occ: false }); } // hangers + diffusers
  // wall dressing: notice board with pinned sheets, wall clock, first-aid box, a power strip under each tray
  ki.box(0.9, 0.6, 0.02, 'idark', { at: [x0 + 6.0, f + 1.75, zS - 0.012], color: 0x7a5a3a, r: 0.004 });
  for (let j = 0; j < 6; j++) ki.box(0.18 + (j % 2) * 0.05, 0.24, 0.004, 'iface', { at: [x0 + 5.7 + (j % 3) * 0.28, f + 1.62 + Math.floor(j / 3) * 0.28, zS - 0.024], rot: [0, 0, (rnd() - 0.5) * 0.12], color: [0xf2eee0, 0xe8e2c8, 0xf0f0f0][j % 3], r: 0 });
  ki.add(lathe([[0, 0], [0.13, 0], [0.14, 0.01], [0.14, 0.04], [0, 0.04]], { seg: 24, crease: 40 }), 'idark', { at: [x0 + 2.6, f + 2.35, zN + 0.005], rot: [Math.PI / 2, 0, 0], color: 0x1d1f22, occ: false });
  ki.cyl(0.125, 0.006, 'iface', { at: [x0 + 2.6, f + 2.35, zN + 0.047], rot: [Math.PI / 2, 0, 0], seg: 24, color: 0xf0f0ec, occ: false });
  for (const a of [0.4, 2.1]) d.box(0.008, 0.09, 0.004, 'idark', { at: [x0 + 2.6 + Math.sin(a) * 0.04, f + 2.35 + Math.cos(a) * 0.04, zN + 0.053], rot: [0, 0, -a], color: 0x111111, r: 0, occ: false });
  ki.box(0.36, 0.3, 0.12, 'isteel', { at: [x1 - 0.1, f + 1.55, zS - 1.4], color: 0x2a8a3a, r: 0.012 });
  // fluorescent fixtures: [dead, WORKING (lamps[1] = labLamp), dead with a hanging diffuser]
  const lamps = [];
  [-4.5, 0, 4.5].forEach((lx, i) => {
    const x = cx + lx, y = f + ih;
    ki.box(1.34, 0.09, 0.34, 'isteel', { at: [x, y - 0.045, cz], color: 0xc8ccd0, r: 0.01 });
    for (const e of [-1, 1]) ki.box(1.3, 0.05, 0.02, 'isteel', { at: [x, y - 0.1, cz + e * 0.15], color: 0xd0d4d8, r: 0.004 });
    if (i === 1) {
      ki.box(1.24, 0.012, 0.26, 'diffuser', { at: [x, y - 0.095, cz], r: 0, occ: false });
      for (let j = 0; j < 9; j++) d.box(0.012, 0.035, 0.27, 'isteel', { at: [x - 0.56 + j * 0.14, y - 0.105, cz], color: 0xd8dadc, r: 0, occ: false }); // louvre
    } else {
      for (const e of [-0.06, 0.06]) ki.add(tube([[x - 0.6, y - 0.07, cz + e], [x + 0.6, y - 0.07, cz + e]], 0.013, { radial: 8 }), 'idark', { color: 0x6a6e72, occ: false });
      if (i === 2) { ki.push(x + 0.1, y - 0.36, cz + 0.12, 0, 0.0, 0.5); ki.box(1.2, 0.012, 0.25, 'iface', { color: 0xa8acb0, r: 0, occ: false }); ki.pop(); d.add(tube([[x - 0.45, y - 0.1, cz + 0.12], [x - 0.42, y - 0.62, cz + 0.12]], 0.004, { radial: 4 }), 'idark', { color: 0x1b1c1e, occ: false }); }
    }
    lamps.push([x, y - 0.25, cz]);
  });
  // stools (pedestal, foot ring, five-star base) and an office chair at the north bench gap
  for (const [x, z] of [[x0 + 2.6, zS - 1.1], [x0 + 7.2, zN + 1.0], [x0 + 10.6, zS - 1.05]]) {
    ki.cyl(0.18, 0.06, 'idark', { at: [x, f + 0.62, z], seg: 18, color: 0x23262a });
    ki.cyl(0.025, 0.56, 'isteel', { at: [x, f + 0.33, z], seg: 8, color: 0x9aa0a4 });
    ki.add(lathe([[0.16, -0.01], [0.17, 0], [0.16, 0.01], [0.15, 0]], { seg: 16 }), 'isteel', { at: [x, f + 0.28, z], color: 0x9aa0a4, occ: false });
    for (let a = 0; a < 5; a++) { const an = a * 1.2566 + x; ki.bar([x, f + 0.06, z], [x + Math.cos(an) * 0.28, f + 0.03, z + Math.sin(an) * 0.28], 0.035, 0.03, 'idark', { color: 0x1d1f22, r: 0.008 }); }
  }
  // door-end wall: lockers south of the door, coat hooks + extinguisher north of it
  ki.box(0.5, 1.9, 0.9, 'isteel', { at: [x1 - 0.26, f + 0.95, zS - 0.5], color: 0x6a7a84, r: 0.01 });
  for (let j = 0; j < 3; j++) d.box(0.02, 0.03, 0.12, 'idark', { at: [x1 - 0.51, f + 1.1, zS - 0.82 + j * 0.3], color: 0x2a2c2e, r: 0, occ: false });
  cols.push(box3(x1 - 0.52, 0, zS - 0.95, x1, f + 1.9, zS));
  for (let j = 0; j < 4; j++) d.bar([x1 - 0.01, f + 1.7, zN + 0.4 + j * 0.3], [x1 - 0.1, f + 1.74, zN + 0.4 + j * 0.3], 0.02, 0.02, 'isteel', { color: 0x9aa0a4, occ: false });
  for (const [z, c] of [[zN + 0.42, C.orange], [zN + 1.02, 0x2a4a6a]]) { ki.box(0.22, 0.75, 0.4, 'idark', { at: [x1 - 0.14, f + 1.32, z], color: c, r: 0.08 }); ki.box(0.2, 0.2, 0.26, 'idark', { at: [x1 - 0.13, f + 1.73, z], color: shade(c, 0.85), r: 0.07 }); }
  ki.cyl(0.075, 0.5, 'idark', { at: [x1 - 0.12, f + 0.55, zN + 1.6], seg: 14, color: 0x9a1a12 });
  labels.push(['haz1', 0.12, [x0 + 0.715, f + 0.45, cz + 0.3], Math.PI / 2], ['note1', 0.08, [x0 + 0.715, f + 0.75, cz - 0.42], Math.PI / 2]);
  labels.push(['note0', 0.08, [x0 + 0.05, f + 1.5, cz + 0.62], Math.PI / 2], ['note2', 0.08, [x0 + 0.05, f + 1.32, cz + 0.7], Math.PI / 2]);
  for (const [z, ry, x] of [[zN + 0.004, 0, x0 + 6.0], [zN + 0.004, 0, x1 - 1.2], [zS - 0.004, Math.PI, x0 + 4.65], [zS - 0.004, Math.PI, x0 + 9.35]]) labels.push(['kick' + (Math.abs(Math.floor(x)) % 2), 0.9, [x, f + 0.16, z], ry, 0.22]);
  labels.push(['kick0', 1.2, [x1 - 0.004, f + 0.18, cz + 0.6], -Math.PI / 2, 0.24], ['kick1', 1.0, [x0 + 0.004, f + 0.16, cz + 1.6], Math.PI / 2, 0.2]);
  return { colliders: cols, lamps, labels };
}

/** radio hut dressing: console desk on the north wall (console point stays in front of it), radios, chair, rack */
export function radioDressing(ki, d, m, rnd) {
  const [cx, cz] = m.c, [sx, sz] = m.size, f = m.floor, t = 0.16, zN = cz - sz / 2 + t, x0 = cx - sx / 2 + t, cols = [];
  const dx0 = cx - 1.5, dx1 = cx + 1.0, dz = zN + 0.36;
  ki.box(dx1 - dx0, 0.04, 0.72, 'idark', { at: [(dx0 + dx1) / 2, f + 0.76, dz], color: 0x2a2c2f, r: 0.008 });
  for (const x of [dx0 + 0.25, dx1 - 0.25]) ki.box(0.45, 0.72, 0.66, 'isteel', { at: [x, f + 0.37, dz], color: 0x7a8288, r: 0.008 });
  // radio stack: transceivers with dials and green screens, a handset on a hook, a beacon controller with a red cover
  for (let i = 0; i < 3; i++) {
    const x = dx0 + 0.5 + i * 0.6, w = 0.48, h = 0.16 + (i % 2) * 0.06;
    ki.box(w, h, 0.32, 'isteel', { at: [x, f + 0.78 + h / 2, zN + 0.2], color: jit(0x4a5258, rnd, 0.1), r: 0.008 });
    ki.box(w * 0.36, h * 0.45, 0.01, 'screen', { at: [x - w * 0.2, f + 0.78 + h * 0.55, zN + 0.362], occ: false });
    for (let j = 0; j < 3; j++) d.cyl(0.016, 0.02, 'idark', { at: [x + 0.04 + j * 0.06, f + 0.78 + h * 0.5, zN + 0.37], rot: [Math.PI / 2, 0, 0], seg: 8, color: 0x1b1c1e, occ: false });
  }
  ki.box(0.6, 0.4, 0.3, 'isteel', { at: [dx0 + 0.8, f + 1.4, zN + 0.16], color: 0x5a6268, r: 0.01 }); // shelf unit above
  ki.box(0.3, 0.12, 0.22, 'isteel', { at: [dx1 - 0.3, f + 0.84, dz + 0.1], color: 0xa82418, r: 0.02 });
  ki.box(0.08, 0.2, 0.06, 'idark', { at: [dx1 - 0.08, f + 0.95, zN + 0.1], color: 0x17181a, r: 0.02 });
  d.add(tube([[dx1 - 0.08, f + 0.88, zN + 0.12], [dx1 - 0.2, f + 0.6, zN + 0.3], [dx1 - 0.3, f + 0.8, zN + 0.4]], 0.006, { radial: 4, curve: true, samples: 8 }), 'idark', { color: 0x1b1c1e, occ: false });
  cols.push(box3(dx0, 0, zN, dx1, f + 0.8, zN + 0.72));
  // chair + equipment rack on the west wall
  ki.cyl(0.2, 0.07, 'idark', { at: [cx - 0.4, f + 0.48, dz + 0.75], seg: 16, color: 0x23262a });
  ki.box(0.4, 0.42, 0.05, 'idark', { at: [cx - 0.4, f + 0.75, dz + 0.97], color: 0x23262a, r: 0.03 });
  ki.cyl(0.025, 0.42, 'isteel', { at: [cx - 0.4, f + 0.23, dz + 0.75], seg: 8, color: 0x9aa0a4 });
  ki.box(0.6, 1.8, 0.6, 'isteel', { at: [x0 + 0.32, f + 0.9, cz + 0.4], color: 0x2c3034, r: 0.012 });
  for (let j = 0; j < 6; j++) ki.box(0.02, 0.1, 0.5, 'idark', { at: [x0 + 0.63, f + 0.4 + j * 0.24, cz + 0.4], color: j % 2 ? 0x3a3e44 : 0x1d1f22, r: 0.004 });
  cols.push(box3(x0, 0, cz + 0.1, x0 + 0.62, f + 1.8, cz + 0.7));
  return { colliders: cols };
}
