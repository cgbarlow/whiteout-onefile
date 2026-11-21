// Generator / tower geometry helpers (load-time only, real metres, every edge bevelled):
//   bolt        hex bolt head on a washer, cached per size, oriented along an axis ('x','-x','y','-y','z','-z')
//   boltRing    n bolts on a circle in a plane facing an axis
//   finned      lathe profile of an air-cooled barrel: alternating thin fins (bevelled lips) and roots
//   bellows     corrugated exhaust flex section (lathe, sinusoidal radius) along +Y
//   channel     C-channel extrusion (frame rails), length along Z, web at x = 0, flanges toward +x
//   angleGeo    L-angle extrusion (tower legs and bracing), length along Z
//   memberGeo   orient a length-along-Z geometry between two points (bar-style), optional roll
//   snowCap     pillowy wind-blown snow slab (noise-lifted top), snowShell over a horizontal cylinder,
//   snowDrift   a wedge of snow banked against a face (rounded crest, noise along the run)
// All return indexed BufferGeometry with position/normal/uv/color (kit.normalizeGeo-compatible).
import { Matrix4, Quaternion, Vector3, BufferGeometry, Float32BufferAttribute } from 'three';
import { lathe, extrudeBevel, roundedBox, Kit } from '../../cookbook/geo/kit.js';
import { fbm2, vnoise2 } from '../../cookbook/geo/noise.js';

const HP = Math.PI / 2;
export const AXIS_ROT = { y: [0, 0, 0], '-y': [Math.PI, 0, 0], x: [0, 0, -HP], '-x': [0, 0, HP], z: [HP, 0, 0], '-z': [-HP, 0, 0] };

const _boltCache = new Map();
function boltGeo(r) {
  let g = _boltCache.get(r);
  if (!g) {
    // hex head with a chamfered crown; ≥ 7 mm bolts sit on a washer. No bottom cap (it is against the face).
    g = r >= 0.008 ? lathe([[1.35, 0], [1.35, 0.14], [0.98, 0.16], [0.98, 0.62], [0.82, 0.76], [0, 0.78]], { seg: 6, crease: 30 })
      : lathe([[1, 0], [1, 0.6], [0.8, 0.76], [0, 0.78]], { seg: 6, crease: 30 });
    g.scale(r, r, r);
    _boltCache.set(r, g);
  }
  return g;
}
/** hex bolt head (r = across-flats half size, m) at `at`, axis = outward normal */
export function bolt(k, at, axis = 'y', r = 0.008, key = 'steel', color = 0x8a8c8e) {
  k.add(boltGeo(r).clone(), key, { at, rot: AXIS_ROT[axis], color, occ: false });
}
/** n bolts on a circle radius R around centre `c`, in the plane whose normal is `axis` */
export function boltRing(k, c, axis, R, n, r = 0.007, key = 'steel', color = 0x8a8c8e, phase = 0) {
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2, u = Math.cos(a) * R, v = Math.sin(a) * R;
    const p = axis === 'x' || axis === '-x' ? [c[0], c[1] + u, c[2] + v] : axis === 'z' || axis === '-z' ? [c[0] + u, c[1] + v, c[2]] : [c[0] + u, c[1], c[2] + v];
    bolt(k, p, axis, r, key, color);
  }
}

/** air-cooled barrel: fins from y0 to y1 (base at 0), root radius r0, fin tip r1 */
export function finned(r0, r1, h, n, seg = 20) {
  const p = [[0, 0], [r0 + 0.004, 0]], pitch = h / n, t = pitch * 0.4;
  for (let i = 0; i < n; i++) {
    const y = i * pitch + pitch * 0.3;
    p.push([r0, y], [r1, y + 0.0025], [r1, y + t - 0.0025], [r0, y + t]); // fin lips chamfered by the 2.5 mm taper
  }
  p.push([r0, h], [r0 * 0.6, h], [0, h]);
  return lathe(p, { seg, crease: 40 });
}

/** exhaust flex section along +Y, length L, mean radius r, n corrugations */
export function bellows(r, L, n = 14, seg = 16) {
  const p = [[0, 0], [r * 1.05, 0], [r * 1.05, 0.02]];
  const steps = n * 3;
  for (let i = 0; i <= steps; i++) { const y = 0.02 + (L - 0.04) * (i / steps); p.push([r * (1 + 0.11 * Math.cos((i / 3) * Math.PI * 2)), y]); }
  p.push([r * 1.05, L - 0.02], [r * 1.05, L], [0, L]);
  return lathe(p, { seg, crease: 60 });
}

/** C-channel (web thickness tw, flange b, height h, flange thickness tf), length L along Z, web at x = 0 */
export function channel(L, h = 0.3, b = 0.08, tw = 0.009, tf = 0.012) {
  return extrudeBevel([[0, 0], [b, 0], [b, tf], [tw, tf], [tw, h - tf], [b, h - tf], [b, h], [0, h]], { depth: L, bevel: 0.0025 });
}
/** L-angle a×a, thickness t, length L along Z; heel at the origin, legs toward +x and +y */
export function angleGeo(L, a = 0.1, t = 0.009) {
  return extrudeBevel([[0, 0], [a, 0], [a, t], [t, t], [t, a], [0, a]], { depth: L, bevel: 0.002 });
}
const _q = new Quaternion(), _z = new Vector3(0, 0, 1), _A = new Vector3(), _B = new Vector3(), _d = new Vector3(), _m = new Matrix4(), _r = new Matrix4();
/** place `g` (centred, length along Z) between points a and b, rolled by `roll` rad about its axis */
export function memberGeo(g, a, b, roll = 0) {
  _A.fromArray(a); _B.fromArray(b); _d.subVectors(_B, _A).normalize();
  _q.setFromUnitVectors(_z, _d);
  _m.compose(_A.clone().add(_B).multiplyScalar(0.5), _q, new Vector3(1, 1, 1));
  if (roll) _m.multiply(_r.makeRotationZ(roll));
  g.applyMatrix4(_m);
  return g;
}

/** snow slab w × d (x/z), mean thickness h: rounded pillow, top lifted by noise, thicker toward `lee` (+x) edge */
export function snowCap(w, d, h, seed = 1, { lee = 0.0, step = 0.12, seg = 1 } = {}) {
  const r = Math.min(h * 0.48, w * 0.3, d * 0.3);
  const g = roundedBox(w, h, d, r, seg, step);
  const P = g.attributes.position.array, N = g.attributes.normal.array;
  for (let i = 0; i < P.length; i += 3) {
    const ny = N[i + 1];
    if (ny < -0.2) { P[i + 1] = -h / 2; continue; } // flat underside sits on the face
    const x = P[i], z = P[i + 2], u = x / w + 0.5;
    const n = fbm2(x * 9 + seed * 7.1, z * 9 - seed * 3.3, 3, seed);
    const lift = (n - 0.5) * 0.9 + lee * (u - 0.5) * 1.6;
    if (ny > 0.2) P[i + 1] += h * lift * Math.max(0, ny);
    else P[i + 1] += h * 0.4 * lift * Math.max(0, P[i + 1] / h + 0.5);
  }
  g.computeVertexNormals();
  return g;
}
/** snow shell lying on a horizontal cylinder of radius R (axis along Z), covering ±A rad from the top, length L */
export function snowShell(R, L, A = 0.9, t = 0.025, seed = 1) {
  const n = 14, pts = [];
  for (let i = 0; i <= n; i++) { // outer arc left → right
    const a = -A + (2 * A * i) / n, f = Math.pow(Math.cos((a / A) * HP), 0.55);
    const rr = R + t * f * (0.75 + 0.5 * vnoise2(i * 0.9, seed, seed));
    pts.push([Math.sin(a) * rr, Math.cos(a) * rr]);
  }
  for (let i = n; i >= 0; i--) { const a = -A + (2 * A * i) / n; pts.push([Math.sin(a) * (R - 0.002), Math.cos(a) * (R - 0.002)]); }
  return extrudeBevel(pts, { depth: L, bevel: Math.min(0.008, t * 0.3), curveSeg: 2 });
}
/** split an extruded mesh's long side quads along z so per-vertex shaping (taper, noise) has vertices to move */
function subdivideZ(g, L, step) {
  const n = Math.max(1, Math.ceil(L / step)); if (n < 2) return;
  const P = g.attributes.position.array, idx = g.index.array, N = g.attributes.normal.array, U = g.attributes.uv.array;
  const pos = Array.from(P), nor = Array.from(N), uv = Array.from(U), out = [];
  const vert = (a, b, t) => { // new vertex between a and b at fraction t
    for (let j = 0; j < 3; j++) { pos.push(P[a * 3 + j] + (P[b * 3 + j] - P[a * 3 + j]) * t); nor.push(N[a * 3 + j] + (N[b * 3 + j] - N[a * 3 + j]) * t); }
    uv.push(U[a * 2] + (U[b * 2] - U[a * 2]) * t, U[a * 2 + 1] + (U[b * 2 + 1] - U[a * 2 + 1]) * t); return pos.length / 3 - 1;
  };
  for (let i = 0; i < idx.length; i += 3) {
    const t = [idx[i], idx[i + 1], idx[i + 2]], zs = t.map((v) => P[v * 3 + 2]);
    const span = Math.max(...zs) - Math.min(...zs);
    if (span < L * 0.9) { out.push(...t); continue; }
    // a long side triangle: two verts share one end; slice it into n strips
    const lo = zs.map((z) => z < 0), a = t.filter((v, j) => lo[j]), b = t.filter((v, j) => !lo[j]);
    if (a.length === 2 && b.length === 1 || a.length === 1 && b.length === 2) {
      const [p0, p1] = a.length === 2 ? a : b, q = a.length === 2 ? b[0] : a[0];
      const rows = [[p0, p1]];
      for (let s2 = 1; s2 < n; s2++) rows.push([vert(p0, q, s2 / n), vert(p1, q, s2 / n)]);
      for (let s2 = 0; s2 < n - 1; s2++) { const [x0, x1] = rows[s2], [y0, y1] = rows[s2 + 1]; out.push(x0, x1, y1, x0, y1, y0); }
      const [x0, x1] = rows[n - 1]; out.push(x0, x1, q);
      continue;
    }
    out.push(...t);
  }
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setIndex(out);
}
/** snow banked against a face: run length L along Z, height h, reach d along +x from the face (x = 0) */
export function snowDrift(L, h, d, seed = 1) {
  const pts = [[0, 0], [d, 0]];
  for (let i = 1; i <= 8; i++) { const t = i / 8, x = d * (1 - t), y = h * Math.pow(Math.sin(t * HP), 1.6) * (1 - 0.15 * t); pts.push([x, y]); }
  pts.push([0, h * 0.86]);
  const g = extrudeBevel(pts, { depth: L, bevel: Math.min(0.02, h * 0.2), curveSeg: 2 });
  subdivideZ(g, L, 0.12);
  // ripple the crest height along the run so it never reads as an extrusion
  const P = g.attributes.position.array;
  for (let i = 0; i < P.length; i += 3) {
    const z = P[i + 2], y = P[i + 1];
    const u = z / L + 0.5, taper = Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, u)))), 0.6); // ends die into the floor
    if (y > 0.005) { const m = (0.6 + 0.65 * fbm2(z * 3.1 + seed, seed * 1.7, 3, seed)) * (0.15 + 0.85 * taper); P[i + 1] = y * m; P[i] *= 0.35 + 0.75 * m; }
  }
  g.computeVertexNormals();
  return g;
}

/** chamfered box (44 tris): flat faces, 45° chamfer strips on the 12 edges and corner facets — a real highlight
 *  line for small parts where a quarter-round bevel (108+ tris) cannot be seen anyway. Metric UVs, white colour. */
export function chamferBox(w, h, d, c = 0.004) {
  const H = [w / 2, h / 2, d / 2]; c = Math.min(c, 0.45 * Math.min(w, h, d));
  const I = H.map((a) => a - c), P = [], N = [], U = [], C = [], X = [];
  const v = (p, n) => { P.push(p[0], p[1], p[2]); const l = Math.hypot(n[0], n[1], n[2]); N.push(n[0] / l, n[1] / l, n[2] / l);
    const ax = Math.abs(n[0]) >= Math.abs(n[1]) && Math.abs(n[0]) >= Math.abs(n[2]) ? 0 : Math.abs(n[1]) >= Math.abs(n[2]) ? 1 : 2;
    U.push(p[(ax + 1) % 3] + H[(ax + 1) % 3], p[(ax + 2) % 3] + H[(ax + 2) % 3]); C.push(1, 1, 1); return P.length / 3 - 1; };
  const poly = (pts, n) => { // fan, wound to face n
    const ids = pts.map((p) => v(p, n));
    const a = pts[0], b = pts[1], q = pts[2], cr = [(b[1] - a[1]) * (q[2] - a[2]) - (b[2] - a[2]) * (q[1] - a[1]), (b[2] - a[2]) * (q[0] - a[0]) - (b[0] - a[0]) * (q[2] - a[2]), (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])];
    const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
    for (let i = 1; i < ids.length - 1; i++) flip ? X.push(ids[0], ids[i + 1], ids[i]) : X.push(ids[0], ids[i], ids[i + 1]);
  };
  const pt = (ax, s, u, su, w2, sw) => { const p = [0, 0, 0]; p[ax] = s; p[u] = su; p[w2] = sw; return p; };
  for (let ax = 0; ax < 3; ax++) for (const sg of [-1, 1]) { // faces
    const u = (ax + 1) % 3, w2 = (ax + 2) % 3, n = [0, 0, 0]; n[ax] = sg;
    poly([pt(ax, sg * H[ax], u, -I[u], w2, -I[w2]), pt(ax, sg * H[ax], u, I[u], w2, -I[w2]), pt(ax, sg * H[ax], u, I[u], w2, I[w2]), pt(ax, sg * H[ax], u, -I[u], w2, I[w2])], n);
  }
  for (let ax = 0; ax < 3; ax++) { // edges parallel to axis ax
    const u = (ax + 1) % 3, w2 = (ax + 2) % 3;
    for (const su of [-1, 1]) for (const sw of [-1, 1]) {
      const n = [0, 0, 0]; n[u] = su; n[w2] = sw;
      poly([pt(ax, -I[ax], u, su * H[u], w2, sw * I[w2]), pt(ax, I[ax], u, su * H[u], w2, sw * I[w2]), pt(ax, I[ax], u, su * I[u], w2, sw * H[w2]), pt(ax, -I[ax], u, su * I[u], w2, sw * H[w2])], n);
    }
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) // corners
    poly([[sx * H[0], sy * I[1], sz * I[2]], [sx * I[0], sy * H[1], sz * I[2]], [sx * I[0], sy * I[1], sz * H[2]]], [sx, sy, sz]);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(P, 3)); g.setAttribute('normal', new Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new Float32BufferAttribute(U, 2)); g.setAttribute('color', new Float32BufferAttribute(C, 3)); g.setIndex(X);
  g.computeBoundingBox(); return g;
}

/** Kit with a vertex budget: chamfered boxes below 1.2 cm radius, two bevel rows only from 2 cm, coarser steps */
export class GKit extends Kit {
  box(w, h, d, mat, o = {}) {
    const r = o.r ?? 0.008;
    if (r < 0.012 && !o.step) return this.add(chamferBox(w, h, d, Math.max(r, 0.0015)), mat, o);
    return this.add(roundedBox(w, h, d, r, o.seg ?? (r >= 0.02 ? 2 : 1), o.step ?? 1.2), mat, o);
  }
  cyl(r, h, mat, o = {}) { // segment count follows the radius (a 1 cm knob does not need 16 sides)
    const auto = r < 0.015 ? 6 : r < 0.035 ? 10 : r < 0.07 ? 14 : 22;
    return super.cyl(r, h, mat, { ...o, seg: Math.min(o.seg || auto, auto) });
  }
  bar(a, b, w, h, mat, o = {}) { return super.bar(a, b, w, h, mat, { step: 2.0, ...o }); }
}
