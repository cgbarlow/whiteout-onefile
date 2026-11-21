// Station kit parts shared by every builder: colliders, ground seating, face frames, skins with openings, rivet rows,
// doors, canopies, steps, roof gear. All real metres, bevelled through geo/kit.js. Builders write into two Kits:
//   k  structural parts (contact AO baked)        d  small detail (rivets, cables, handles: grime only, no AO bake)
// Material keys: paint steel dark concrete wood glass (sodium lens) win (window interiors) + lab keys in lab.js.
import { Box3, Vector3, Color } from 'three';
import { panelWall, tube, lathe, ladder, railing, roundedBox, Kit } from '../../cookbook/geo/kit.js';

/** Kit with a vertex budget: bevel rows only where the radius can be seen (seg 2 from 3 cm, else 1), cheap bars */
export class SKit extends Kit {
  box(w, h, d, mat, o = {}) { const r = o.r ?? 0.008; return this.add(roundedBox(w, h, d, r, o.seg ?? (r >= 0.03 ? 2 : 1), o.step ?? 0.9), mat, o); }
  bar(a, b, w, h, mat, o = {}) { return super.bar(a, b, w, h, mat, { step: 2.0, ...o }); }
  /** thin round member between two points (lattice bracing, wires): 4-sided tube, no AO occluder */
  rod(a, b, r, mat, o = {}) { return this.add(tube([a, b], r, { radial: o.radial ?? 4 }), mat, { ...o, occ: false }); }
}
const RIVET = lathe([[0.0095, 0], [0.0075, 0.0045], [0, 0.0065]], { seg: 5, crease: 80 });
import { heightFn } from '../terrain/height.js';

export const C = {
  orange: 0xd4561e, orangeDeep: 0xb8461a, orangeLab: 0xcf5c24, white: 0xd6d2c8, cream: 0xc8c0ae, grey: 0x8a9098,
  steel: 0x7c838b, dark: 0x2c2f33, black: 0x1b1c1e, conc: 0x9a968e, yellow: 0xd8a21e, red: 0x9a2418, blue: 0x2a4a6a, green: 0x4a5a3c,
};
const _c = new Color();
/** colour jitter: hex * (1 ± amt) per channel group, deterministic from rnd */
export const jit = (hex, rnd, amt = 0.08) => { _c.set(hex); const s = 1 + (rnd() - 0.5) * 2 * amt; return _c.multiplyScalar(s).getHex(); };
export const shade = (hex, s) => _c.set(hex).multiplyScalar(s).getHex();

export const box3 = (x0, y0, z0, x1, y1, z1) => new Box3(new Vector3(Math.min(x0, x1), y0, Math.min(z0, z1)), new Vector3(Math.max(x0, x1), y1, Math.max(z0, z1)));

// snow surface height (the terrain module's pure height function, read-only): props sit on the drifts, never float
let _h = null;
export function gy(x, z) {
  if (!_h) { try { _h = heightFn(); } catch (e) { _h = () => 0; } }
  const v = _h(x, z);
  return Number.isFinite(v) ? v : 0;
}
/** lowest snow height under a footprint (so a foot never hangs over a hollow), minus a sink */
export function seat(x, z, r = 0.3, sink = 0.04) {
  let h = gy(x, z);
  for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.785; h = Math.min(h, gy(x + Math.cos(a) * r, z + Math.sin(a) * r)); }
  return h - sink;
}

// ---- face frames: a box footprint (cx, cz, hx, hz) at base y; local +X runs left→right seen from outside, +Z out
const FACE = {
  '+z': (cx, cz, hx, hz) => ({ o: [cx - hx, cz + hz], ry: 0, w: 2 * hx }),
  '-z': (cx, cz, hx, hz) => ({ o: [cx + hx, cz - hz], ry: Math.PI, w: 2 * hx }),
  '+x': (cx, cz, hx, hz) => ({ o: [cx + hx, cz + hz], ry: Math.PI / 2, w: 2 * hz }),
  '-x': (cx, cz, hx, hz) => ({ o: [cx - hx, cz - hz], ry: -Math.PI / 2, w: 2 * hz }),
};
export function face(side, cx, cz, hx, hz) { return FACE[side](cx, cz, hx, hz); }
/** world (x, z) on a face → local u along the face */
export function faceU(side, cx, cz, hx, hz, x, z) {
  if (side === '+z') return x - (cx - hx);
  if (side === '-z') return cx + hx - x;
  if (side === '+x') return cz + hz - z;
  return z - (cz - hz);
}
/** face-local (u, v, z) → world [x, y, z] */
export function toWorld(side, cx, cz, hx, hz, y, u, v, z = 0) {
  const f = face(side, cx, cz, hx, hz), c = Math.cos(f.ry), s = Math.sin(f.ry);
  return [f.o[0] + u * c + z * s, y + v, f.o[1] - u * s + z * c];
}
/** push the face frame (origin = bottom-left corner of the face at height y) */
export function pushFace(k, side, cx, cz, hx, hz, y) { const f = face(side, cx, cz, hx, hz); k.push(f.o[0], y, f.o[1], f.ry); return f.w; }

/**
 * Cladding skin on a face (in face-local frame, z = 0 is the outer surface) with rectangular openings.
 * holes: [{u0,u1,v0,v1}] local metres. kind/pitch: panelWall profile. Splits into columns around the holes.
 */
export function skin(k, w, h, holes, { kind = 'panel', pitch = 1.2, depth = 0.03, mat = 'paint', color = C.orange, ystep = 0.9 } = {}) {
  const cuts = new Set([0, w]);
  for (const o of holes) { cuts.add(Math.max(0, o.u0)); cuts.add(Math.min(w, o.u1)); }
  const xs = [...cuts].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], cw = b - a; if (cw < 0.02) continue;
    const mid = (a + b) / 2, hs = holes.filter((o) => mid > o.u0 && mid < o.u1).sort((p, q) => p.v0 - q.v0);
    let y = 0;
    const strip = (y0, y1) => {
      if (y1 - y0 < 0.02) return;
      const n = Math.max(1, Math.round(cw / pitch));
      k.push(a, y0, 0); k.add(panelWall(cw, y1 - y0, { kind, pitch: cw / n, depth, ystep }), mat, { color, occ: false }); k.pop();
    };
    for (const o of hs) { strip(y, o.v0); y = o.v1; }
    strip(y, h);
  }
}

/** rivet row from (u0,v0) to (u1,v1) on a face-local plane at depth z, spacing s (detail kit) */
export function rivets(d, u0, v0, u1, v1, z, s = 0.3, color = C.orange) {
  const L = Math.hypot(u1 - u0, v1 - v0), n = Math.max(1, Math.round(L / s));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    d.add(RIVET.clone(), 'paint', { at: [u0 + (u1 - u0) * t, v0 + (v1 - v0) * t, z], rot: [Math.PI / 2, 0, 0], color, occ: false });
  }
}

/** recessed window in a face frame: reveal, frame with mullion, sill, glass quad (uv rect from the window atlas) */
export function windowUnit(k, d, u, v, w, h, { reveal = 0.12, color = C.white, glassKey = 'win', uv = null, mull = 1, out = 0.0, deep = 0, pane = false, snow = true } = {}) {
  const cx = u + w / 2;
  // reveal returns (jambs, head, sill board) lining the opening
  k.box(0.04, h, reveal, 'steel', { at: [u + 0.02, v + h / 2, -reveal / 2 + out], color: shade(color, 0.85), r: 0.006 });
  k.box(0.04, h, reveal, 'steel', { at: [u + w - 0.02, v + h / 2, -reveal / 2 + out], color: shade(color, 0.85), r: 0.006 });
  k.box(w, 0.04, reveal, 'steel', { at: [cx, v + h - 0.02, -reveal / 2 + out], color: shade(color, 0.7), r: 0.006 });
  // frame ring (proud of the skin)
  const f = 0.07;
  k.box(w + 2 * f, f, 0.06, 'steel', { at: [cx, v + h + f / 2, out + 0.02], color, r: 0.008 });
  k.box(w + 2 * f, f, 0.06, 'steel', { at: [cx, v - f / 2, out + 0.02], color, r: 0.008 });
  for (const s of [-1, 1]) k.box(f, h, 0.06, 'steel', { at: [cx + s * (w / 2 + f / 2), v + h / 2, out + 0.02], color, r: 0.008 });
  for (let i = 1; i <= mull; i++) k.box(0.045, h, 0.05, 'steel', { at: [u + (w * i) / (mull + 1), v + h / 2, -reveal + 0.05 + out], color, r: 0.005, occ: false });
  // sloped sill with drip
  k.push(cx, v - f - 0.015, out + 0.06, 0, 0.12); k.box(w + 2 * f + 0.1, 0.03, 0.16, 'steel', { color: shade(color, 0.9), r: 0.006 });
  if (snow) k.add(roundedBox(w + 2 * f + 0.02, 0.045, 0.13, 0.02, 2, 0.5), 'snow', { at: [0, 0.03, -0.01], color: 0xe6ebf1, occ: false }); // snow on the sill
  k.pop();
  // deep rooms: a dark liner box behind the reveal so the lit interior card sits `deep` further in (real parallax)
  const back = -reveal + 0.02 + out - deep;
  if (deep > 0) {
    const zc = -reveal + out - deep / 2;
    for (const s of [-1, 1]) k.box(0.02, h, deep, 'dark', { at: [cx + s * (w / 2 - 0.01), v + h / 2, zc], color: 0x241a14, r: 0, occ: false });
    k.box(w, 0.02, deep, 'dark', { at: [cx, v + h - 0.01, zc], color: 0x1a1410, r: 0, occ: false });
    k.box(w, 0.02, deep, 'dark', { at: [cx, v + 0.01, zc], color: 0x3a2a1e, r: 0, occ: false });
  }
  // glass: a quad at the back of the reveal (or the room), uv mapped into the window atlas
  if (glassKey) {
    const g = roundedBox(w, h, 0.004, 0, 0);
    if (uv) remapUV(g, uv);
    k.add(g, glassKey, { at: [cx, v + h / 2, back], occ: false });
  }
  // the pane itself: reflective glass with frosted corners, just behind the frame ring
  if (pane) k.add(remapUV(roundedBox(w, h, 0.003, 0, 0), [0, 0, 1, 1]), 'pane', { at: [cx, v + h / 2, out - 0.035], occ: false });
  // frame screws (detail)
  if (d) for (const s of [-1, 1]) for (const t of [0.15, 0.85]) d.cyl(0.007, 0.006, 'steel', { at: [cx + s * (w / 2 + f / 2), v + h * t, out + 0.052], rot: [Math.PI / 2, 0, 0], seg: 6, color: shade(color, 0.6), occ: false });
}

/** remap a geometry's 0..w/0..h metric uv (front face) into an atlas rect [u0,v0,u1,v1] (only +z facing verts) */
export function remapUV(g, [u0, v0, u1, v1]) {
  const uv = g.attributes.uv.array, p = g.attributes.position.array, n = g.attributes.normal.array;
  g.computeBoundingBox(); const bb = g.boundingBox, W = bb.max.x - bb.min.x || 1, H = bb.max.y - bb.min.y || 1;
  for (let i = 0; i < uv.length / 2; i++) {
    const s = (p[i * 3] - bb.min.x) / W, t = (p[i * 3 + 1] - bb.min.y) / H;
    const back = n[i * 3 + 2] < -0.5; // the inside face mirrors so both sides read the right way round
    uv[i * 2] = u0 + (back ? 1 - s : s) * (u1 - u0); uv[i * 2 + 1] = v0 + t * (v1 - v0);
  }
  return g;
}

/** steel personnel door in a face frame: leaf with pressed panels, kick plate, lever, closer, porthole; open = angle */
export function doorLeaf(k, d, u, v, { w = 0.95, h = 2.05, color = C.white, open = 0, porthole = true, hinge = 'l' } = {}) {
  const hx = hinge === 'l' ? u : u + w, sgn = hinge === 'l' ? 1 : -1;
  k.push(hx, v, -0.04, sgn * -open); // swing outward about the hinge edge
  const lx = (x) => sgn * x;
  k.box(w, h, 0.05, 'paint', { at: [lx(w / 2), h / 2, 0], color, r: 0.01 });
  k.box(w - 0.16, h * 0.36, 0.012, 'paint', { at: [lx(w / 2), h * 0.25, 0.028], color: shade(color, 0.96), r: 0.006 });
  k.box(w - 0.04, 0.22, 0.008, 'steel', { at: [lx(w / 2), 0.13, 0.03], color: C.steel, r: 0.003 });
  if (porthole) {
    k.add(lathe([[0.13, -0.012], [0.16, -0.012], [0.165, 0.0], [0.16, 0.014], [0.13, 0.014]], { seg: 20, crease: 40 }), 'steel', { at: [lx(w / 2), h * 0.72, 0.03], rot: [Math.PI / 2, 0, 0], color: C.dark, occ: false });
    k.cyl(0.13, 0.01, 'win', { at: [lx(w / 2), h * 0.72, 0.02], rot: [Math.PI / 2, 0, 0], seg: 20, occ: false });
  }
  if (d) {
    d.box(0.03, 0.18, 0.03, 'steel', { at: [lx(w - 0.08), 1.0, 0.05], color: C.steel, r: 0.006, occ: false });
    d.bar([lx(w - 0.08), 1.06, 0.07], [lx(w - 0.22), 1.06, 0.07], 0.022, 0.022, 'steel', { color: C.steel, occ: false });
    d.box(0.32, 0.05, 0.05, 'dark', { at: [lx(0.24), h - 0.06, 0.06], color: C.dark, r: 0.008, occ: false }); // closer
    for (const t of [0.15, 0.5, 0.85]) d.cyl(0.018, 0.12, 'steel', { at: [lx(0.0), h * t, 0.02], color: C.steel, seg: 8, occ: false }); // hinges
  }
  k.pop();
}

/** door canopy on brackets above (u..u+w) at height v, projecting p */
export function canopy(k, d, u, v, w, p = 1.1, color = C.grey) {
  k.push(u + w / 2, v, 0, 0, 0.12);
  k.box(w, 0.06, p, 'steel', { at: [0, 0.03, p / 2], color, r: 0.012 });
  k.box(w + 0.02, 0.12, 0.05, 'steel', { at: [0, 0.0, p], color: shade(color, 0.85), r: 0.01 });
  k.add(roundedBox(w - 0.06, 0.07, p - 0.08, 0.03, 2, 0.5), 'snow', { at: [0, 0.085, p / 2 - 0.02], color: 0xe6ebf1, occ: false }); // snow load
  k.pop();
  for (const s of [-1, 1]) k.bar([u + w / 2 + s * (w / 2 - 0.06), v - 0.55, 0.02], [u + w / 2 + s * (w / 2 - 0.06), v - 0.02, p * 0.8], 0.04, 0.04, 'steel', { color: C.dark, r: 0.006 });
  if (d) d.add(tube([[u + w - 0.1, v + 0.02, p * 0.9], [u + w - 0.1, v - 0.2, p * 0.95], [u + w - 0.1, 0.1, p * 0.95]], 0.025, { radial: 8 }), 'steel', { color: C.steel, occ: false }); // downpipe
}

/** grated landing + steps out from a face at floor height f (face-local, outward +z), with side rail */
export function landing(k, d, u, w, f, { depth = 1.1, steps = 2, rail = true, color = C.steel } = {}) {
  const top = f - 0.02;
  k.box(w, 0.05, depth, 'steel', { at: [u + w / 2, top - 0.025, depth / 2 + 0.02], color, r: 0.006 });
  for (let i = 0; i < 2; i++) k.box(0.06, top - 0.05, 0.06, 'steel', { at: [u + 0.08 + i * (w - 0.16), (top - 0.05) / 2, depth - 0.05], color: C.dark, r: 0.006 });
  const rise = top / (steps + 1);
  for (let i = 0; i < steps; i++) k.box(w * 0.9, 0.04, 0.3, 'steel', { at: [u + w / 2, top - rise * (i + 1), depth + 0.15 + i * 0.28], color, r: 0.006 });
  if (d) for (let i = 0; i < Math.ceil(w / 0.05); i++) d.box(0.006, 0.006, depth - 0.06, 'dark', { at: [u + 0.03 + i * 0.05, top + 0.003, depth / 2 + 0.02], color: C.dark, r: 0, occ: false });
  if (rail && d) railing(d, [[u + w - 0.03, top, 0.05], [u + w - 0.03, top, depth], [u + w - 0.03, top - rise * steps, depth + 0.28 * steps]], { h: 0.95, postEvery: 1.0, r: 0.02, color: C.yellow, toe: false });
}

/** mushroom roof vent */
export function roofVent(k, x, y, z, r = 0.12, color = C.grey) {
  k.add(lathe([[r * 0.7, 0], [r * 0.7, r * 2.2], [r * 1.6, r * 2.3], [r * 1.65, r * 2.6], [r * 0.4, r * 3.1], [0, r * 3.15]], { seg: 16, crease: 30 }), 'steel', { at: [x, y, z], color, occ: { r: r * 0.7, y0: 0, y1: r * 2.2 } });
}

/** packaged HVAC / heat-exchanger box with louvres and a fan grille on top */
export function hvac(k, d, x, y, z, ry = 0, { w = 1.6, h = 0.9, dp = 1.0, color = C.white } = {}) {
  k.push(x, y, z, ry);
  k.box(w, h, dp, 'paint', { at: [0, h / 2 + 0.08, 0], color, r: 0.025 });
  for (const s of [-1, 1]) k.box(0.08, 0.08, dp + 0.1, 'steel', { at: [s * (w / 2 - 0.15), 0.04, 0], color: C.dark, r: 0.008 });
  k.cyl(dp * 0.36, 0.08, 'dark', { at: [w * 0.18, h + 0.12, 0], seg: 24, color: C.dark });
  if (d) {
    for (let i = 0; i < 9; i++) d.box(w * 0.8, 0.018, 0.03, 'steel', { at: [0, 0.22 + i * (h - 0.3) / 9, dp / 2 + 0.01], rot: [0.5, 0, 0], color: shade(color, 0.7), r: 0.003, occ: false });
    for (let i = 0; i < 6; i++) d.box(dp * 0.7, 0.012, 0.012, 'steel', { at: [w * 0.18, h + 0.17, -dp * 0.3 + i * dp * 0.12], color: C.steel, r: 0, occ: false });
  }
  k.pop();
}

/** wall-mounted electrical box with conduit going down (face-local) */
export function eBox(k, d, u, v, { w = 0.4, h = 0.5, color = C.grey, conduit = true } = {}) {
  k.box(w, h, 0.18, 'paint', { at: [u, v, 0.09], color, r: 0.015 });
  if (d) {
    d.box(0.03, 0.06, 0.02, 'dark', { at: [u + w / 2 - 0.05, v, 0.19], color: C.dark, r: 0.004, occ: false });
    if (conduit) d.add(tube([[u - w * 0.25, v - h / 2, 0.06], [u - w * 0.25, 0.25, 0.06], [u - w * 0.25, 0.08, 0.2]], 0.016, { radial: 6 }), 'dark', { color: C.dark, occ: false });
  }
}

/** fixed ladder to a roof with hoops over the parapet (face-local) */
export function roofLadder(k, u, h, { color = C.yellow, cage = true } = {}) {
  k.push(u, 0.25, 0.25, Math.PI); ladder(k, h + 0.9, { w: 0.45, color, cage }); k.pop(); // cage hoops face out (+z)
  for (const s of [-1, 1]) k.box(0.06, 0.04, 0.26, 'steel', { at: [u + s * 0.225, h * 0.5, 0.13], color: C.dark, r: 0.005 });
}

/** a sagging cable between two world points (catenary approximation), tube radius r */
export function cable(d, a, b, sag = 0.4, r = 0.013, color = C.black, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  d.add(tube(pts, r, { radial: 5 }), 'dark', { color, occ: false });
}
