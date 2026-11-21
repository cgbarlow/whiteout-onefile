// Prefab module shells (hab, lab, mess, store, radio hut): skids + bearers, panelWall cladding with real openings,
// corner posts, fascia + parapet, roof (flat membrane / gable / monopitch), windows from the window atlas, doors with
// canopies and grated landings, rivet rows along every 1.2 m seam, wall gear. Each module gets its own style so no two
// silhouettes repeat. `hollow` shells leave the openings through (lab.js lines the inside).
import { panelWall, extrudeBevel, tube, lathe } from '../../cookbook/geo/kit.js';
import { C, shade, jit, box3, face, faceU, toWorld, pushFace, skin, rivets, windowUnit, doorLeaf, canopy, landing, roofVent, hvac, eBox, roofLadder } from './parts.js';
import { winUV, WIN_LIT } from './textures.js';
import { snowCap } from './wear.js';

const SIDES = ['+z', '-z', '+x', '-x'];

// per-module look (id → style). windows: { side: [u-centres] } on the 1.2 m seam grid; w/h opening size.
export const STYLES = {
  hab:   { kind: 'panel', pitch: 1.2, color: C.orange, band: C.white, roof: 'flat', porch: true, win: { '+z': [1.8, 4.2, 7.8, 10.2, 13.8], '-z': [2.4, 6.0, 9.6, 13.2] }, ww: 1.2, wh: 0.9 },
  lab:   { kind: 'panel', pitch: 1.2, color: C.orangeLab, band: C.cream, roof: 'flat', platform: true, win: { '+z': [3.0, 6.6, 10.2], '-z': [3.0, 6.6, 10.2] }, ww: 1.2, wh: 0.9 },
  mess:  { kind: 'rib', pitch: 0.6, color: C.orangeDeep, band: null, roof: 'gable', win: { '+z': [1.8, 4.2, 6.6, 9.6], '-z': [3.0, 7.2] , '-x': [3.0] }, ww: 1.0, wh: 0.9 },
  store: { kind: 'trapezoid', pitch: 0.3, color: C.white, band: C.orange, roof: 'mono', win: { '+z': [7.8] }, ww: 0.8, wh: 0.5, roller: true },
  radio: { kind: 'panel', pitch: 1.2, color: C.cream, band: C.red, roof: 'flat', win: { '-z': [2.0], '+z': [2.0] }, ww: 0.8, wh: 0.6 },
};

/**
 * Exterior shell. k = AO kit, d = detail kit, m = LAYOUT module ({c,size,h,floor,door,doorFace}), rnd = seeded rng.
 * Returns { colliders, glows: [[x,y,z,nx,nz]], signs: [{name, at, ry, w}], faces: {side:{w,holes}}, t }.
 */
let _i0 = 0; const i0 = () => (_i0++) & 1;
export function moduleShell(k, d, m, st, rnd, { hollow = false } = {}) {
  const [cx, cz] = m.c, [sx, sz] = m.size, h = m.h, f = m.floor ?? 0.3, hx = sx / 2, hz = sz / 2, t = 0.16;
  const base = jit(st.color, rnd, 0.05), trim = shade(base, 0.82);
  const out = { colliders: [], glows: [], signs: [], faces: {}, t, wear: [] };
  const wearAt = (s, name, w, hh, u, v, z = 0.042) => out.wear.push({ name, w, h: hh, at: toWorld(s, cx, cz, hx, hz, f, u, v, z), ry: face(s, cx, cz, hx, hz).ry });
  // --- skids: two I-section runners with upturned sled noses + bearers every 1.2 m + tow eyes
  for (const dz of [-hz + 0.55, hz - 0.55]) {
    const z = cz + dz, L = sx + 0.5;
    k.box(L, 0.02, 0.2, 'steel', { at: [cx, 0.21, z], color: C.steel, r: 0.004 });
    k.box(L, 0.18, 0.014, 'steel', { at: [cx, 0.11, z], color: C.steel, r: 0.003 });
    k.box(L - 0.5, 0.02, 0.2, 'steel', { at: [cx, 0.01, z], color: C.steel, r: 0.004 });
    for (const s of [-1, 1]) {
      k.push(cx + s * (L / 2 + 0.17), 0.12, z, 0, 0, s * -0.55); k.box(0.42, 0.04, 0.2, 'steel', { color: C.steel, r: 0.006 }); k.pop();
      d.add(extrudeBevel([[-0.06, -0.06], [0.06, -0.06], [0.06, 0.06], [-0.06, 0.06]], { holes: [[[-0.03, -0.03], [-0.03, 0.03], [0.03, 0.03], [0.03, -0.03]]], depth: 0.025, bevel: 0.004 }), 'steel', { at: [cx + s * (L / 2 + 0.33), 0.24, z], rot: [0, Math.PI / 2, 0], color: C.yellow, occ: false });
    }
  }
  for (let x = -hx + 0.3; x <= hx - 0.2; x += 1.2) k.box(0.1, 0.08, sz - 0.2, 'steel', { at: [cx + x, 0.26, cz], color: C.dark, r: 0.006 });
  k.box(sx, 0.1, sz, 'steel', { at: [cx, f - 0.05, cz], color: C.dark, r: 0.01, step: 2 });
  // --- door / window openings per face (face-local)
  const holes = { '+z': [], '-z': [], '+x': [], '-x': [] };
  const dside = m.doorFace, du = faceU(dside, cx, cz, hx, hz, m.door[0], m.door[1]), dw = 1.0, dh = 2.1;
  const roller = st.roller;
  const doorW = roller ? 2.4 : dw, doorH = roller ? 2.4 : dh;
  holes[dside].push({ u0: du - doorW / 2, u1: du + doorW / 2, v0: 0, v1: doorH, door: true });
  const wins = [];
  for (const s of SIDES) for (const u of (st.win[s] || [])) {
    const v0 = 1.05, o = { u0: u - st.ww / 2, u1: u + st.ww / 2, v0, v1: v0 + st.wh };
    if (holes[s].some((p) => o.u1 > p.u0 - 0.2 && o.u0 < p.u1 + 0.2)) continue;
    holes[s].push(o); wins.push([s, o]);
  }
  if (!hollow) k.box(sx - 0.6, h - 0.04, sz - 0.6, 'dark', { at: [cx, f + h / 2, cz], color: 0x18191b, r: 0, step: 4, occ: false }); // core (only seen through the openings)
  // --- cladding + seam rivets + base flashing, per face
  for (const s of SIDES) {
    const w = pushFace(k, s, cx, cz, hx, hz, f);
    out.faces[s] = { w, holes: holes[s] };
    d.push(); skin(d, w, h - 0.3, holes[s], { kind: st.kind, pitch: st.pitch, depth: st.kind === 'panel' ? 0.024 : 0.034, color: base }); d.pop();
    k.box(w + 0.02, 0.07, 0.05, 'steel', { at: [w / 2, 0.035, 0.025], color: C.dark, r: 0.008 });
    if (st.band) { // painted band course at window-head height (not on the door opening)
      const bv = 2.25, bh = 0.16;
      const cuts = holes[s].filter((o) => o.v1 > bv - 0.01).sort((a, b) => a.u0 - b.u0);
      let u = 0;
      for (const o of [...cuts, { u0: w, u1: w }]) { if (o.u0 - u > 0.05) k.box(o.u0 - u, bh, 0.012, 'paint', { at: [(u + o.u0) / 2, bv, 0.018], color: st.band, r: 0.003, occ: false }); u = o.u1; }
    }
    const nSeam = Math.round(w / 1.2), H = h - 0.3;
    for (let i = 1; i < nSeam; i++) {
      const u = (w * i) / nSeam, hit = holes[s].filter((o) => u > o.u0 - 0.12 && u < o.u1 + 0.12);
      if (hit.some((o) => o.door)) continue;
      // seam cover strip (top-hat section, darker than the field) split around any window it crosses
      let v = 0.02;
      for (const o of [...hit.sort((a, b) => a.v0 - b.v0), { v0: H - 0.02, v1: H }]) {
        const v1 = hit.length && o.v0 < H - 0.03 ? o.v0 - 0.1 : o.v0;
        if (st.kind === 'panel' && v1 - v > 0.1) d.box(0.1, v1 - v, 0.03, 'paint', { at: [u, (v + v1) / 2, 0.015], color: shade(base, 0.6), r: 0.008, occ: false });
        v = o.v1 + (hit.length && o.v0 < H - 0.03 ? 0.12 : 0);
      }
      if (!hit.length) rivets(d, u, 0.12, u, h - 0.45, st.kind === 'panel' ? 0.03 : 0.012, 0.3, shade(base, 0.7));
      // rust weeping from the seam fixings, more on the lower half
      if (((i * 7 + s.length) % 3) === 0) wearAt(s, 'rust' + (i % 4), 0.22, 0.9, u, H - 0.55, 0.046);
    }
    rivets(d, 0.1, 0.1, w - 0.1, 0.1, 0.012, 0.4, base);
    // kick-panel joint 0.42 m above the floor with a drip flashing (breaks the tall field into real panel heights)
    { const cuts = holes[s].filter((o) => o.v0 < 0.45 && o.v1 > 0.4).sort((a, b) => a.u0 - b.u0); let u = 0;
      for (const o of [...cuts, { u0: w, u1: w }]) { if (o.u0 - u > 0.1 && st.kind === 'panel') d.box(o.u0 - u - 0.04, 0.035, 0.035, 'steel', { at: [(u + o.u0) / 2, 0.42, 0.018], color: shade(base, 0.55), r: 0.008, occ: false }); u = o.u1; } }
    // frost band at the foot, grime drips under the fascia (weathering decals, wear.js)
    wearAt(s, 'frostFoot' + (s.length + i0()) % 2, w + 0.05, 0.62, w / 2, 0.24);
    wearAt(s, 'drip' + (s === '+z' || s === '-x' ? 0 : 1), w, 0.55, w / 2, H - 0.26);
    k.pop();
  }
  // --- skirting from the snow to the floor line: ribbed galvanised sheet with an access hatch per long side
  for (const s of SIDES) {
    const w = pushFace(k, s, cx, cz, hx, hz, 0);
    d.push(); d.push(0, -0.04, -0.035); d.add(panelWall(w, f + 0.02, { kind: 'rib', pitch: 0.3, depth: 0.02, ystep: 1 }), 'steel', { color: 0x6a7076, occ: false }); d.pop(); d.pop();
    if (s === '+z' || s === '-z') { k.box(0.7, f - 0.08, 0.03, 'steel', { at: [w * 0.62, f / 2 - 0.01, -0.01], color: 0x7e868c, r: 0.006 }); d.box(0.12, 0.025, 0.03, 'dark', { at: [w * 0.62, f / 2, 0.015], color: C.dark, r: 0.005, occ: false }); }
    k.pop();
  }
  // --- corner trims (galvanised angle, proud of the paint), fascia, parapet
  for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    k.box(0.18, h + 0.05, 0.18, 'steel', { at: [cx + ax * (hx + 0.025), f + h / 2, cz + az * (hz + 0.025)], color: 0x9aa0a6, r: 0.02 });
    for (let y = 0.3; y < h; y += 0.6) d.cyl(0.012, 0.012, 'steel', { at: [cx + ax * (hx + 0.12), f + y, cz + az * (hz + 0.025)], rot: [0, 0, Math.PI / 2], seg: 6, color: C.dark, occ: false });
  }
  const top = f + h;
  if (st.roof === 'flat') {
    for (const s of SIDES) {
      const w = pushFace(k, s, cx, cz, hx, hz, top - 0.3);
      k.box(w + 0.1, 0.34, 0.08, 'paint', { at: [w / 2, 0.17, 0.04], color: trim, r: 0.012 });
      k.box(w + 0.4, 0.06, 0.34, 'steel', { at: [w / 2, 0.37, 0.02], color: C.grey, r: 0.012 }); // coping, overhanging
      k.box(w + 0.4, 0.1, 0.03, 'steel', { at: [w / 2, 0.32, 0.18], color: shade(C.grey, 0.8), r: 0.008 }); // drip edge
      snowCap(k, w + 0.3, 0.3, 0.09 + 0.03 * ((w * 7) % 1), [w / 2, 0.44, 0.0]); // snow crest on the coping
      k.pop();
    }
    k.box(sx - 0.1, 0.12, sz - 0.1, 'dark', { at: [cx, top - 0.02, cz], color: 0x3a3c40, r: 0.01, step: 2 });
    snowCap(k, sx - 0.4, sz - 0.4, 0.16, [cx, top + 0.1, cz]); // drifted roof load
    out.colliders.push(box3(cx - hx - 0.1, 0, cz - hz - 0.1, cx + hx + 0.1, top + 0.4, cz + hz + 0.1));
  } else {
    const rise = st.roof === 'gable' ? 0.9 : 0.55, ov = 0.25;
    for (const s of SIDES) { const w = pushFace(k, s, cx, cz, hx, hz, top - 0.22); k.box(w + 0.04, 0.22, 0.06, 'paint', { at: [w / 2, 0.11, 0.03], color: trim, r: 0.01 }); k.pop(); }
    const sheet = (x0, y0, z0, ry, len, run, ang) => {
      d.push(x0, y0, z0, ry, ang - Math.PI / 2); d.add(panelWall(len, run, { kind: 'trapezoid', pitch: 0.25, depth: 0.03, ystep: 1.2 }), 'steel', { color: jit(0x9aa0a6, rnd, 0.06), occ: false }); d.pop();
    };
    if (st.roof === 'gable') {
      const run = Math.hypot(hz + ov, rise), a = Math.atan2(rise, hz + ov);
      sheet(cx - hx - ov, top, cz + hz + ov, 0, sx + 2 * ov, run, a);
      sheet(cx + hx + ov, top, cz - hz - ov, Math.PI, sx + 2 * ov, run, a);
      k.box(sx + 2 * ov + 0.04, 0.08, 0.3, 'steel', { at: [cx, top + rise + 0.02, cz], color: C.grey, r: 0.02 }); // ridge cap
      for (const s of ['+x', '-x']) { // gable triangles
        const w = pushFace(k, s, cx, cz, hx, hz, top);
        k.add(extrudeBevel([[0, 0], [w, 0], [w / 2, rise - 0.04]], { depth: 0.08, bevel: 0.006 }), 'paint', { at: [0, 0, 0.0], color: trim });
        k.box(0.5, 0.3, 0.05, 'steel', { at: [w / 2, rise * 0.45, 0.05], color: C.grey, r: 0.008 }); // gable louvre
        k.pop();
      }
      out.colliders.push(box3(cx - hx - 0.1, 0, cz - hz - 0.1, cx + hx + 0.1, top + rise, cz + hz + 0.1));
    } else { // monopitch: high on -z, low on +z
      const run = Math.hypot(sz + 2 * ov, rise), a = Math.atan2(rise, sz + 2 * ov);
      sheet(cx - hx - ov, top, cz + hz + ov, 0, sx + 2 * ov, run, a);
      for (const s of ['+x', '-x']) {
        const w = pushFace(k, s, cx, cz, hx, hz, top);
        const tri = s === '+x' ? [[0, 0], [w, 0], [w, rise]] : [[0, 0], [w, 0], [0, rise]];
        k.add(extrudeBevel(tri, { depth: 0.08, bevel: 0.006 }), 'paint', { color: trim }); k.pop();
      }
      k.box(sx + 0.04, rise + 0.02, 0.08, 'paint', { at: [cx, top + rise / 2, cz - hz - 0.02], color: trim, r: 0.01 });
      out.colliders.push(box3(cx - hx - 0.1, 0, cz - hz - 0.1, cx + hx + 0.1, top + rise, cz + hz + 0.1));
    }
  }
  // --- windows (atlas variants, never two neighbours alike)
  let last = -1;
  for (const [s, o] of wins) {
    let vi; do { vi = Math.floor(rnd() * 8); } while (vi === last); last = vi;
    pushFace(k, s, cx, cz, hx, hz, f);
    windowUnit(k, d, o.u0, o.v0, o.u1 - o.u0, o.v1 - o.v0, { reveal: hollow ? 0.16 : 0.13, color: C.white, glassKey: hollow ? null : 'win', uv: winUV(vi), mull: st.ww > 1.1 ? 1 : 0, deep: hollow ? 0 : 0.17, pane: !hollow });
    k.pop();
    wearAt(s, 'rust' + (vi % 4), 0.32, 1.0, o.u0 + 0.05, o.v0 - 0.62, 0.05); wearAt(s, 'rust' + ((vi + 2) % 4), 0.26, 0.85, o.u1 - 0.06, o.v0 - 0.55, 0.05);
    if (!hollow && WIN_LIT[vi]) {
      const p = toWorld(s, cx, cz, hx, hz, f, (o.u0 + o.u1) / 2, o.v0 + 0.3, -0.3), nn = toWorld(s, 0, 0, 0, 0, 0, 0, 0, 1);
      out.glows.push([p[0], p[1], p[2], nn[0], nn[2], WIN_LIT[vi]]);
    }
  }
  // --- door: leaf (closed, ajar or roller), canopy, landing/steps, lamp bracket
  pushFace(k, dside, cx, cz, hx, hz, f);
  const dl = du - doorW / 2;
  // door reveal frame
  k.box(doorW + 0.16, 0.08, 0.1, 'steel', { at: [du, doorH + 0.04, 0.03], color: C.dark, r: 0.01 });
  for (const s of [-1, 1]) k.box(0.08, doorH, 0.1, 'steel', { at: [du + s * (doorW / 2 + 0.04), doorH / 2, 0.03], color: C.dark, r: 0.01 });
  if (roller) {
    k.box(doorW + 0.3, 0.42, 0.42, 'paint', { at: [du, doorH + 0.3, 0.2], color: C.grey, r: 0.03 }); // shutter drum box
    const open = 0.55; // shutter part-raised: a dark slot under it
    for (let y = doorH - 0.02; y > open; y -= 0.1) k.box(doorW - 0.04, 0.085, 0.03, 'steel', { at: [du, y, -0.05], color: jit(0xb8bcc0, rnd, 0.04), r: 0.012, occ: false });
    k.box(doorW - 0.04, 0.06, 0.06, 'dark', { at: [du, open + 0.03, -0.05], color: C.dark, r: 0.01 });
    k.box(doorW, open, 0.02, 'dark', { at: [du, open / 2, -0.4], color: 0x111214, r: 0 });
    for (const s of [-1, 1]) k.box(0.08, doorH, 0.08, 'steel', { at: [du + s * (doorW / 2 + 0.02), doorH / 2, -0.02], color: C.steel, r: 0.008 });
    k.box(doorW + 0.6, 0.1, 1.4, 'concrete', { at: [du, -f + 0.05, 0.7], color: C.conc, r: 0.02 }); // ramp pad
    k.push(du, -f + 0.1, 0.2, 0, -0.2); k.box(doorW, 0.06, 0.8, 'steel', { at: [0, 0, 0.4], color: C.steel, r: 0.01 }); k.pop();
  } else {
    if (!hollow) { k.box(doorW, doorH, 0.03, 'dark', { at: [du, doorH / 2, -0.14], color: 0x15161a, r: 0 }); doorLeaf(k, d, dl, 0, { color: jit(C.white, rnd, 0.06), open: st.ajar ?? 0, porthole: true }); }
    canopy(k, d, dl - 0.25, doorH + 0.35, doorW + 0.5, 1.15, C.grey);
    landing(k, d, dl - 0.3, doorW + 0.6, f, { depth: 1.2, steps: 2, rail: true });
  }
  // door lamp fixture (lens on the sodium 'glass' key) + door sign spot
  k.box(0.26, 0.16, 0.18, 'dark', { at: [du + doorW / 2 + 0.3, doorH + 0.15, 0.1], color: C.dark, r: 0.02 });
  k.box(0.2, 0.06, 0.12, 'glass', { at: [du + doorW / 2 + 0.3, doorH + 0.06, 0.12], r: 0.01, occ: false });
  k.pop();
  out.door = { side: dside, u: du, at: toWorld(dside, cx, cz, hx, hz, 0, du, 0, 1.6), lamp: toWorld(dside, cx, cz, hx, hz, f, du + doorW / 2 + 0.3, doorH + 0.0, 0.3), n: toWorld(dside, 0, 0, 0, 0, 0, 0, 0, 1) };
  // name sign: centred on the long +z face upper band (or above the door for the store)
  const nameSide = m.id === 'store' ? '+z' : '+z';
  out.signs.push({ name: m.id, at: toWorld(nameSide, cx, cz, hx, hz, f, m.id === 'store' ? 2.6 : 0.24 * sx, h - 0.62, 0.036), ry: face(nameSide, cx, cz, hx, hz).ry });
  { const u = m.id === 'store' ? 2.6 : 0.24 * sx; wearAt(nameSide, 'frostPatch', 0.6, 0.26, u + 0.45, h - 0.76, 0.045); wearAt(nameSide, 'frostPatch', 0.4, 0.2, u - 0.55, h - 0.5, 0.045); }
  return out;
}

/** roof and wall gear per module: vents, HVAC, flues, ladder, platform, dish, wall boxes (k/d kits, world coords) */
export function moduleGear(k, d, m, st, rnd) {
  const [cx, cz] = m.c, [sx, sz] = m.size, h = m.h, f = m.floor ?? 0.3, hx = sx / 2, hz = sz / 2, top = f + h + 0.04;
  if (m.id === 'hab') {
    hvac(k, d, cx + 3.2, top, cz - 0.6, 0, { w: 2.0, h: 1.0, dp: 1.2, color: C.white });
    hvac(k, d, cx - 4.5, top, cz + 0.8, Math.PI / 2, { w: 1.2, h: 0.7, dp: 0.9, color: 0xb8bcc0 });
    for (const [x, z, r] of [[-6.5, -1.6, 0.11], [-1.0, 1.7, 0.14], [1.2, 1.7, 0.09], [6.4, -1.8, 0.12]]) roofVent(k, cx + x, top, cz + z, r);
    k.cyl(0.09, 1.3, 'steel', { at: [cx + 6.8, top + 0.65, cz + 1.9], seg: 12, color: 0xa0a4a8 }); // heater flue
    k.add(lathe2(0.2), 'steel', { at: [cx + 6.8, top + 1.3, cz + 1.9], color: C.dark });
    // satellite dish on a stub mast
    k.cyl(0.05, 1.1, 'steel', { at: [cx - 1.6, top + 0.55, cz - 1.9], seg: 10, color: C.grey });
    k.push(cx - 1.6, top + 1.2, cz - 1.9, -2.4, -0.7); k.add(dish(0.45), 'paint', { color: C.white }); k.pop();
    // cold porch at the -x door: a small vestibule with its own door, canopy and boot scraper
    porch(k, d, m, rnd);
    return habEnd(k, d, m);
  }
  if (m.id === 'lab') {
    // instrument platform with railing, met mast, ladder up the +x end
    const px = cx - 3.5, pz = cz, pw = 4.0, pd = 3.6;
    k.box(pw, 0.06, pd, 'steel', { at: [px, top + 0.5, pz], color: C.steel, r: 0.008 });
    for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.box(0.08, 0.5, 0.08, 'steel', { at: [px + ax * (pw / 2 - 0.1), top + 0.25, pz + az * (pd / 2 - 0.1)], color: C.dark, r: 0.006 });
    railingBox(d, px, top + 0.53, pz, pw, pd);
    k.cyl(0.04, 3.0, 'steel', { at: [px - 1.2, top + 2.0, pz - 1.2], seg: 10, color: C.grey });
    k.box(0.5, 0.04, 0.04, 'steel', { at: [px - 1.2, top + 3.1, pz - 1.2], color: C.grey, r: 0.005 });
    k.box(0.28, 0.32, 0.22, 'paint', { at: [px + 0.8, top + 0.7, pz - 1.2], color: C.white, r: 0.02 }); // stevenson screen
    for (let i = 0; i < 5; i++) d.box(0.3, 0.012, 0.25, 'paint', { at: [px + 0.8, top + 0.58 + i * 0.06, pz - 1.2], rot: [0, 0, 0.3], color: C.white, r: 0, occ: false });
    hvac(k, d, cx + 3.6, top, cz + 1.0, 0, { w: 1.4, h: 0.8, dp: 1.0, color: 0xc0c4c8 });
    roofVent(k, cx + 1.4, top, cz - 1.8, 0.12); roofVent(k, cx + 5.6, top, cz - 1.5, 0.1);
    pushFace(k, '+z', cx, cz, hx, hz, 0); roofLadder(k, sx - 0.7, f + h, { color: C.yellow }); k.pop();
  }
  if (m.id === 'mess') {
    // kitchen extract flue + chimney through the gable roof, LPG bottle cage on the -z wall
    k.cyl(0.16, 2.2, 'steel', { at: [cx - 2.6, top + 1.6, cz - 1.0], seg: 16, color: 0xb0b4b8 });
    k.add(lathe2(0.32), 'steel', { at: [cx - 2.6, top + 2.7, cz - 1.0], color: C.dark });
    k.cyl(0.08, 1.6, 'steel', { at: [cx + 3.4, top + 1.4, cz + 1.2], seg: 12, color: 0x9a9ea2 });
    k.add(lathe2(0.16), 'steel', { at: [cx + 3.4, top + 2.2, cz + 1.2], color: C.dark });
    pushFace(k, '-z', cx, cz, hx, hz, 0);
    const u = 3.0; k.box(1.4, 1.5, 0.6, 'steel', { at: [u, 0.8, 0.4], color: C.grey, r: 0.02 }); // bottle cage frame
    for (let i = 0; i < 3; i++) k.cyl(0.16, 1.2, 'paint', { at: [u - 0.42 + i * 0.42, 0.7, 0.45], seg: 16, color: i === 1 ? 0xb8b4aa : C.red, occ: false });
    for (let i = 0; i < 8; i++) d.box(0.015, 1.45, 0.015, 'steel', { at: [u - 0.68 + i * 0.195, 0.8, 0.71], color: C.dark, r: 0, occ: false });
    eBox(k, d, 6.0, 1.7, { w: 0.5, h: 0.6, color: C.grey }); k.pop();
  }
  if (m.id === 'store') {
    roofVent(k, cx + 2.5, top + 0.2, cz + 0.4, 0.13);
    pushFace(k, '+z', cx, cz, hx, hz, 0); eBox(k, d, 5.2, 1.6, { w: 0.5, h: 0.6, color: C.grey }); k.pop();
  }
  if (m.id === 'radio') {
    // feeder cable entry plate + cable ladder on the -x wall toward the tower, small HVAC
    hvac(k, d, cx + 0.7, top, cz - 0.4, 0, { w: 1.0, h: 0.6, dp: 0.8, color: C.white });
    pushFace(k, '-x', cx, cz, hx, hz, 0);
    k.box(0.5, 0.4, 0.06, 'steel', { at: [1.0, f + h - 0.6, 0.03], color: C.steel, r: 0.01 });
    for (let i = 0; i < 4; i++) d.cyl(0.03, 0.08, 'dark', { at: [0.85 + (i % 2) * 0.3, f + h - 0.7 + Math.floor(i / 2) * 0.2, 0.09], rot: [Math.PI / 2, 0, 0], seg: 8, color: C.black, occ: false });
    k.pop();
  }
}

/** hab +x end: emergency exit (door on a grated landing with steps + rail, canopy, lamp, EXIT sign) and the
 *  utility end: power inlet + conduit into the snow, lagged water line, louvred vent, heater exhaust */
function habEnd(k, d, m) {
  const [cx, cz] = m.c, [sx, sz] = m.size, f = m.floor ?? 0.3, hx = sx / 2, hz = sz / 2, u = 2.1, dw = 0.95, dh = 2.05;
  const sd = '+x';
  pushFace(k, sd, cx, cz, hx, hz, f);
  k.box(dw + 0.18, dh + 0.1, 0.03, 'dark', { at: [u, dh / 2 + 0.02, 0.012], color: 0x15161a, r: 0.004 });
  k.box(dw + 0.26, 0.09, 0.1, 'steel', { at: [u, dh + 0.09, 0.05], color: C.dark, r: 0.01 });
  for (const e of [-1, 1]) k.box(0.09, dh + 0.05, 0.1, 'steel', { at: [u + e * (dw / 2 + 0.085), dh / 2, 0.05], color: C.dark, r: 0.01 });
  k.push(0, 0, 0.085); doorLeaf(k, d, u - dw / 2, 0.02, { w: dw, h: dh - 0.04, color: 0xc8c4ba, open: 0, porthole: true }); k.pop();
  d.bar([u - dw / 2 + 0.1, 1.0, 0.16], [u + dw / 2 - 0.1, 1.0, 0.16], 0.03, 0.03, 'steel', { color: C.red }); // panic bar
  canopy(k, d, u - 0.75, dh + 0.4, 1.5, 1.0, C.grey);
  k.box(0.26, 0.16, 0.18, 'dark', { at: [u + 0.78, dh + 0.2, 0.1], color: C.dark, r: 0.02 });
  k.box(0.2, 0.06, 0.12, 'glass', { at: [u + 0.78, dh + 0.11, 0.12], r: 0.01, occ: false });
  // utility end
  eBox(k, d, 4.5, 1.35, { w: 0.5, h: 0.62, color: 0x9aa0a6 });
  k.box(0.12, 0.12, 0.1, 'dark', { at: [4.5, 0.85, 0.12], color: C.yellow, r: 0.02 }); // inlet socket
  d.add(tube([[4.5, 0.85, 0.2], [4.5, 0.2, 0.32], [4.6, -f + 0.02, 0.9], [5.2, -f + 0.0, 2.6]], 0.03, { radial: 8, curve: true, samples: 14 }), 'dark', { color: C.black, occ: false });
  k.box(0.6, 0.42, 0.08, 'steel', { at: [4.6, 2.35, 0.04], color: 0xa8aeb4, r: 0.01 }); // louvred vent
  for (let i = 0; i < 6; i++) d.box(0.54, 0.02, 0.05, 'steel', { at: [4.6, 2.2 + i * 0.06, 0.09], rot: [0.6, 0, 0], color: 0x7a8086, r: 0.003, occ: false });
  k.add(tube([[5.35, 2.0, 0.12], [5.35, 0.1, 0.12], [5.35, -f + 0.05, 0.4]], 0.07, { radial: 12, curve: true, samples: 10 }), 'paint', { color: 0xc8ccd0, occ: false }); // lagged water line
  for (let y = 0.2; y < 2.0; y += 0.45) d.cyl(0.078, 0.03, 'steel', { at: [5.35, y, 0.12], seg: 12, color: C.steel, occ: false });
  k.pop();
  const toW = (uu, v, z) => toWorld(sd, cx, cz, hx, hz, f, uu, v, z);
  pushFace(k, sd, cx, cz, hx, hz, 0); landing(k, d, u - 0.8, 1.6, f, { depth: 0.9, steps: 1, rail: true }); k.pop();
  return {
    doors: [{ side: sd, at: toWorld(sd, cx, cz, hx, hz, 0, u, 0, 1.6), lamp: toW(u + 0.78, dh + 0.05, 0.3), n: [1, 0, 0] }],
    colliders: [box3(cx + hx, 0, cz + hz - u - 0.85, cx + hx + 1.35, f + 1.0, cz + hz - u + 0.85)], // landing + steps
    signs: [{ name: 'exitOut', at: toW(u, dh + 0.62, 0.05), ry: face(sd, cx, cz, hx, hz).ry }],
  };
}

function porch(k, d, m, rnd) {
  const [dx, dz] = m.door, f = m.floor ?? 0.3, pw = 2.4, pd = 1.9, ph = 2.6, cx = dx - pd / 2;
  const col = shade(C.orange, 0.94);
  k.box(pd, 0.1, pw, 'steel', { at: [cx, f - 0.05, dz], color: C.dark, r: 0.01 });
  k.box(pd - 0.1, ph, pw - 0.1, 'paint', { at: [cx, f + ph / 2, dz], color: shade(col, 0.5), r: 0.02, step: 3 }); // core
  for (const s of ['+z', '-z', '-x']) {
    const w = pushFace(k, s, cx, dz, pd / 2, pw / 2, f);
    const holes = s === '-x' ? [{ u0: w / 2 - 0.5, u1: w / 2 + 0.5, v0: 0, v1: 2.05 }] : [];
    skin(k, w, ph, holes, { kind: 'panel', pitch: 1.2, depth: 0.024, color: col });
    k.pop();
  }
  for (const [ax, az] of [[-1, -1], [-1, 1]]) k.box(0.14, ph + 0.05, 0.14, 'paint', { at: [cx + ax * (pd / 2 + 0.02), f + ph / 2, dz + az * (pw / 2 + 0.02)], color: shade(col, 0.82), r: 0.02 });
  k.box(pd + 0.3, 0.14, pw + 0.3, 'paint', { at: [cx - 0.1, f + ph + 0.07, dz], color: shade(col, 0.85), r: 0.02 });
  pushFace(k, '-x', cx, dz, pd / 2, pw / 2, f);
  k.box(1.0, 2.05, 0.03, 'dark', { at: [pw / 2, 1.02, -0.1], color: 0x15161a, r: 0 });
  doorLeaf(k, d, pw / 2 - 0.47, 0, { w: 0.94, h: 2.0, color: C.white, open: 0.0 });
  canopy(k, d, pw / 2 - 0.75, 2.35, 1.5, 0.9, C.grey);
  landing(k, d, pw / 2 - 0.75, 1.5, f, { depth: 0.9, steps: 2, rail: false });
  k.pop();
  k.box(0.5, 0.06, 0.3, 'steel', { at: [dx - pd - 1.3, 0.06, dz + 0.9], color: C.dark, r: 0.008 }); // boot scraper
}

function railingBox(d, x, y, z, w, dp) {
  const pts = [[x - w / 2, y, z - dp / 2], [x + w / 2, y, z - dp / 2], [x + w / 2, y, z + dp / 2], [x - w / 2 + 0.7, y, z + dp / 2]];
  d.add(tubeRail(pts, 1.0), 'steel', { color: C.yellow, occ: false });
  d.add(tubeRail(pts, 0.5), 'steel', { color: C.yellow, occ: false });
  for (const p of pts) d.cyl(0.022, 1.0, 'steel', { at: [p[0], y + 0.5, p[2]], seg: 8, color: C.yellow, occ: false });
}
const tubeRail = (pts, hh) => tube(pts.map((p) => [p[0], p[1] + hh, p[2]]), 0.022, { radial: 8 });
const lathe2 = (r) => lathe([[0, 0], [r * 0.5, 0], [r, r * 0.25], [r * 1.05, r * 0.35], [r * 0.3, r * 0.75], [0, r * 0.8]], { seg: 14, crease: 30 }); // rain cap
const dish = (r) => lathe([[0, -0.02], [r * 0.6, 0.04], [r, 0.16], [r - 0.01, 0.17], [r * 0.6, 0.06], [0, 0.0]], { seg: 24, crease: 50 });
