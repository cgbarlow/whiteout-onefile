// Station weathering + snow build-up (load-time only):
//   decals   one 1024² atlas, ONE merged mesh: rust streaks under sills and fixings, grime drips under the fascia,
//            a frost + splash band along every wall foot, frost blooms over the stencils, soft contact-shadow
//            blobs under props, snowcat track pairs and crate stencils on the snow / boxes.
//   snow     geometry on the 'snow' key (mats.snowGround: the terrain's own snow shading, so caps and drifts
//            read as the same material as the shelf): caps on ledges, drifts banked against walls and props,
//            small mounds at post feet. Everything bevelled / rounded, real metres, no AO occluders.
import { Mesh, Matrix4, Vector3, Quaternion, Euler, PlaneGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { DecalAtlas, stencilCanvas, decalGeo, decalMaterial, distress } from '../../cookbook/decals/canvas-text.js';
import { mergeGeos, normalizeGeo, roundedBox, lathe } from '../../cookbook/geo/kit.js';
import { gy } from './parts.js';
import { rutCanvas, fillCanvas } from './ruts.js';

function hashN(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vn(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hashN(xi, yi, s), b = hashN(xi + 1, yi, s), c = hashN(xi, yi + 1, s), d = hashN(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vn(x, y, s) * 0.5 + vn(x * 2.1, y * 2.1, s + 1) * 0.3 + vn(x * 4.3, y * 4.3, s + 2) * 0.2;
const cl = (v) => Math.max(0, Math.min(1, v));
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// per-pixel RGBA painter: fn(u, v) → [r, g, b, a] (0..255, a 0..1)
function paint(w, h, fn) {
  const cv = canvas(w, h), g = cv.getContext('2d', { willReadFrequently: true }), id = g.createImageData(w, h), p = id.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x / w, y / h, x, y), o = (y * w + x) * 4;
    p[o] = c[0]; p[o + 1] = c[1]; p[o + 2] = c[2]; p[o + 3] = Math.round(cl(c[3]) * 255);
  }
  g.putImageData(id, 0, 0); return cv;
}
const _c4 = [0, 0, 0, 0];
const rgba = (r, g, b, a) => { _c4[0] = r; _c4[1] = g; _c4[2] = b; _c4[3] = a; return _c4; };

// rust: 3-5 tapered streaks running down from the top edge (sill ends / bolts), orange core, brown fringe
function rustCanvas(seed) {
  const n = 3 + Math.floor(hashN(seed, 1, 9) * 3), xs = [], ws = [], ls = [];
  for (let i = 0; i < n; i++) { xs.push(0.12 + 0.76 * hashN(seed, i, 2)); ws.push(0.03 + 0.07 * hashN(seed, i, 3)); ls.push(0.45 + 0.55 * hashN(seed, i, 4)); }
  return paint(96, 384, (u, v) => {
    let a = 0;
    for (let i = 0; i < n; i++) {
      const wob = (vn(v * 6, i, seed) - 0.5) * 0.05, d = Math.abs(u - xs[i] - wob), w = ws[i] * (1 - 0.6 * v / ls[i]);
      if (v > ls[i] || w <= 0) continue;
      a = Math.max(a, cl(1 - d / w) * (1 - v / ls[i]) ** 0.8 * (0.55 + 0.45 * fbm(u * 18, v * 40, seed)));
    }
    const top = cl(1 - v * 14) * 0.9 * (0.6 + 0.4 * fbm(u * 20, 0, seed + 4)); a = Math.max(a, top);
    const core = cl(a * 1.4 - 0.3);
    return rgba(96 + 70 * core, 46 + 22 * core, 22 + 6 * core, a * 0.85);
  });
}
// grime drips hanging from a fascia / coping (dark, sooty, broken by fbm)
function dripCanvas(seed) {
  return paint(512, 96, (u, v, x) => {
    const col = Math.floor(x / 5), L = 0.25 + 0.75 * hashN(col, 3, seed) * hashN(col >> 2, 5, seed), w = hashN(col, 7, seed);
    const streak = w > 0.55 ? cl(1 - v / L) * (0.4 + 0.6 * w) : 0;
    const band = cl(1 - v * 3.2) * 0.65;
    const n = fbm(u * 30, v * 6, seed);
    return rgba(34, 30, 28, Math.max(band, streak) * (0.45 + 0.55 * n) * 0.75);
  });
}
// frost + splash band at the wall foot: rime crystals feathering up from the bottom edge, grey splash just above it
function frostFootCanvas(seed) {
  return paint(1024, 112, (u, v) => {
    const up = 1 - v, edge = 0.5 + 0.35 * fbm(u * 26, 0.5, seed) + 0.15 * fbm(u * 90, 3, seed + 3);
    const fr = cl((edge - up) * 4.0), crystal = fbm(u * 160, v * 18, seed + 7);
    const a = cl(fr * (0.55 + 0.6 * crystal) + cl(1 - up * 6) * 0.5);
    const splash = cl(1 - Math.abs(up - edge - 0.1) * 6) * 0.35 * fbm(u * 50, v * 9, seed + 9);
    const w = 214 + 36 * crystal;
    return a > splash ? rgba(w * 0.9, w * 0.95, w, a * 0.92) : rgba(70, 66, 62, splash);
  });
}
// a frost bloom (stencil overspray frost): irregular feathered blob, crystal fronds at the rim
function frostPatchCanvas(seed) {
  return paint(256, 128, (u, v) => {
    const dx = (u - 0.5) * 2, dy = (v - 0.6) * 2.4, r = Math.hypot(dx, dy), n = fbm(u * 7, v * 5, seed);
    const a = cl((0.95 - r + (n - 0.5) * 0.9) * 2.2) * (0.5 + 0.5 * fbm(u * 60, v * 30, seed + 1));
    return rgba(226, 234, 242, a * 0.85);
  });
}
// soft contact shadow / melt-dirt blob under props (radial, slightly noisy rim)
function aoCanvas() {
  return paint(128, 128, (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5) * 2, n = fbm(u * 6, v * 6, 3);
    const a = cl(1 - r * (0.9 + 0.25 * n)) ** 1.6;
    return rgba(52, 58, 70, a * 0.7);
  });
}
export function createWear(G) {
  const atlas = new DecalAtlas(2048, 6);
  for (let i = 0; i < 4; i++) atlas.add('rust' + i, rustCanvas(11 + i * 7));
  atlas.add('drip0', dripCanvas(3)); atlas.add('drip1', dripCanvas(9));
  atlas.add('frostFoot0', frostFootCanvas(5)); atlas.add('frostFoot1', frostFootCanvas(14));
  atlas.add('frostPatch', frostPatchCanvas(21));
  atlas.add('ao', aoCanvas());
  for (let i = 0; i < 3; i++) atlas.add('ruts' + i, rutCanvas(4 + i * 13, [1, 0.8, 0.62][i]));
  atlas.add('fill0', fillCanvas(7)); atlas.add('fill1', fillCanvas(19));
  for (const [id, t] of [['st0', 'BAS-0412  ▲ THIS WAY UP'], ['st1', 'KEEP FROZEN  -20°C'], ['st2', 'CORE BOXES 7/12']]) {
    const cv = stencilCanvas({ text: t, h: 0.07, ppm: 260, color: 'rgba(28,28,30,1)', wear: 0.55, overspray: 0.5 });
    distress(cv, { amount: 0.4, seed: t.length, edge: 0.1 }); atlas.add(id, cv);
  }
  atlas.finish(G.renderer);

  const geos = [];
  const m4 = new Matrix4(), q = new Quaternion(), e = new Euler(), v = new Vector3(), one = new Vector3(1, 1, 1);
  /** wall decal w×h facing local +Z, rotated ry about Y, centred at `at` */
  const wall = (name, w, h, at, ry) => {
    const g = normalizeGeo(decalGeo(atlas, name, w, h));
    m4.compose(v.fromArray(at), q.setFromEuler(e.set(0, ry, 0)), one); g.applyMatrix4(m4); geos.push(g);
  };
  /** ground decal draped on the snow height function */
  const ground = (name, w, h, x, z, ry, lift = 0.025) => {
    const r = atlas.uv(name), g = new PlaneGeometry(w, h, 6, 6), uv = g.attributes.uv.array, p = g.attributes.position.array;
    for (let i = 0; i < uv.length; i += 2) { uv[i] = r.u0 + uv[i] * (r.u1 - r.u0); uv[i + 1] = r.v0 + uv[i + 1] * (r.v1 - r.v0); }
    const c = Math.cos(ry), s = Math.sin(ry);
    for (let i = 0; i < p.length; i += 3) { const lx = p[i], lz = -p[i + 1], wx = x + lx * c + lz * s, wz = z - lx * s + lz * c; p[i] = wx; p[i + 1] = Math.max(0, gy(wx, wz)) + lift; p[i + 2] = wz; }
    const n = g.attributes.normal.array; for (let i = 0; i < n.length; i += 3) { n[i] = 0; n[i + 1] = 1; n[i + 2] = 0; }
    geos.push(normalizeGeo(g));
  };
  function build(root) {
    if (!geos.length) return null;
    const mat = decalMaterial(atlas.texture, { key: 'wear', roughness: 0.8 }); mat.userData.noWeather = true;
    const mesh = new Mesh(mergeGeos(geos), mat); mesh.renderOrder = 2; mesh.receiveShadow = true; mesh.castShadow = false;
    mesh.name = 'decals:wear'; mesh.matrixAutoUpdate = false; root.add(mesh); return mesh;
  }
  return { atlas, wall, ground, build };
}

// ------------------------------------------------------------------ snow geometry ('snow' key)
const SNOW = 0xe6ebf1;
/** snow cap on a ledge: soft rounded slab w×t×d (local frame of the kit), slightly domed */
export function snowCap(k, w, d, t, at, o = {}) {
  if (w < 0.05 || d < 0.02) return;
  k.add(roundedBox(w, t, d, Math.min(t * 0.48, d * 0.45, 0.04), 2, 0.5), 'snow', { at, rot: o.rot, color: o.color ?? SNOW, occ: false });
}

/** a drift banked against a wall along a→b (world xz), out toward side n (+1 / -1 of the left normal):
 *  concave profile from height h at the wall to 0 at `depth`, height + reach broken by noise, tapered ends */
export function driftAlong(k, a, b, h, depth, seed = 1, o = {}) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.2) return;
  const tx = dx / L, tz = dz / L, side = o.side ?? 1, nx = -tz * side, nz = tx * side;
  const ns = Math.max(4, Math.ceil(L / 0.25)), nt = 7, pos = [], idx = [];
  const inset = o.inset ?? 0.03, base = o.base ?? null;
  for (let i = 0; i <= ns; i++) {
    const s = i / ns, end = Math.min(1, Math.min(s, 1 - s) * L / Math.min(1.2, L * 0.4)), taper = end * end * (3 - 2 * end);
    const hn = h * taper * (0.65 + 0.55 * fbm(s * L * 0.9, 1.3, seed)), dn = depth * (0.55 + 0.45 * taper) * (0.7 + 0.5 * fbm(s * L * 0.7, 4.1, seed + 3));
    for (let j = 0; j <= nt; j++) {
      const t = j / nt, x = a[0] + tx * s * L + nx * (t * dn - inset), z = a[1] + tz * s * L + nz * (t * dn - inset);
      const g0 = base != null ? base : Math.max(0, gy(x, z));
      const prof = (1 - t) ** 1.7 * (1 + 0.06 * Math.sin(t * 9 + s * 7));
      pos.push(x, g0 + hn * prof + (j === nt ? -0.04 : 0) + 0.01, z);
    }
  }
  const W = nt + 1;
  for (let i = 0; i < ns; i++) for (let j = 0; j < nt; j++) {
    const p0 = i * W + j, p1 = p0 + 1, p2 = p0 + W, p3 = p2 + 1;
    if (side > 0) idx.push(p0, p2, p1, p1, p2, p3); else idx.push(p0, p1, p2, p1, p3, p2);
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // the normals must face up: flip the winding if the first quad came out facing down
  if (g.attributes.normal.array[1] < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  k.add(g, 'snow', { color: o.color ?? SNOW, occ: false });
}

/** a small rounded mound (post feet, drum bases): lathe dome radius r, height h */
export function mound(k, x, z, r, h, o = {}) {
  const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([r * (1 - t * t) + 0.001, h * Math.sin(t * Math.PI / 2) - 0.03]); }
  pts.push([0, h - 0.03]);
  k.add(lathe(pts, { seg: 12, crease: 80 }), 'snow', { at: [x, Math.max(0, gy(x, z)) + (o.lift ?? 0), z], color: SNOW, occ: false });
}

/** free-standing wind tail / sastruga: a lens of snow along `ry` (radians about Y, local +x = along the wind),
 *  length L, half-width hw, height h; blunt rounded head upwind, long tapering tail, a sharp crest line */
export function windTail(k, x, z, ry, L, hw, h, seed = 1) {
  const ns = 16, nt = 8, pos = [], idx = [], c = Math.cos(ry), s = Math.sin(ry);
  for (let i = 0; i <= ns; i++) {
    const u = i / ns, head = Math.min(1, u / 0.18), body = Math.sqrt(Math.max(0, head * (2 - head))) * (1 - u) ** 0.7;
    const w = hw * (0.3 + 0.7 * body) * (0.85 + 0.3 * fbm(u * 4, 1, seed));
    for (let j = 0; j <= nt; j++) {
      const t = j / nt * 2 - 1, lx = (u - 0.2) * L, lz = t * w, crest = (1 - Math.abs(t)) ** 1.8;
      const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
      pos.push(wx, Math.max(0, gy(wx, wz)) + h * body * crest * (0.8 + 0.4 * fbm(u * 6, t * 2, seed + 2)) - (Math.abs(t) > 0.99 ? 0.03 : 0) + 0.005, wz);
    }
  }
  const W = nt + 1;
  for (let i = 0; i < ns; i++) for (let j = 0; j < nt; j++) { const p0 = i * W + j; idx.push(p0, p0 + 1, p0 + W, p0 + 1, p0 + W + 1, p0 + W); }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  let up = 0; const n = g.attributes.normal.array; for (let i = 1; i < n.length; i += 3) up += n[i];
  if (up < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  k.add(g, 'snow', { color: SNOW, occ: false });
}
