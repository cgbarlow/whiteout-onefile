// Height function for the snow shelf: (x, z) → { h, base, mask, path } pieces combined by heightFn().
//   base     wind-stretched dunes (long axis along the wind) + a slow swell, always ≥ 0 so nothing placed at y = 0
//            ever floats; the station sits in a shallow wind scour (flats at exactly 0).
//   sastrugi the shared sharp-ridge field (noise.js), masked off near footprints, on paths and on drift slopes.
//   drift    windward ramps + lee tongues of every footprint (footprints.js raster of the real station meshes).
//   path     trampled corridors (the station's trail-decal routes): 2 cm lower, no sastrugi, drift cut down;
//            dug-out aprons (h → 0) at doors, generator service sides and tank fillers (the station's slush decals).
//   berm     past WORLD bounds: a crest of 4-6 m (varies along the edge) then ridged pressure ridges, then the
//            shelf sinks under the horizon skirt beyond r = 120-140 m (the world edge is never framed).
// Exact flats: inside every LAYOUT footprint (+0.4 m) the height is exactly 0. Props outside the footprints are
// seated on this same function by the station (station/parts.js seat(): lowest point under the foot minus a sink).
import { ridged2 } from '../../cookbook/geo/noise.js';
import { SEED, LAYOUT as L } from '../../contracts.js';
import { WIND, vn, fbm, sastrugi } from './noise.js';
import { layoutRects, rasterise, driftField, sampleGrid, WORLD_RECT } from './footprints.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const SKIRT_Y = 1.6;   // horizon skirt height (index.js); the shelf ends 0.6 m under it
export const FAR = { r0: 118, r1: 138, cz: -2 };
// hand-placed whaleback drifts [x, z, half-length along the wind, half-width, crest m] (clear of paths/props)
export const HERO_DRIFTS = [[14.2, -8.6, 4.2, 1.5, 0.62], [12.6, -13.6, 3.0, 1.1, 0.4], [-16.5, -10.5, 5.0, 1.6, 0.7]];

// trampled routes (world x, z) — the same beaten paths the station lays its trail decals on (station/index.js), so
// the decals sit on a levelled corridor without sastrugi: shed → HAB → LAB, shed → GEN B, LAB → GEN A,
// LAB → MESS → GEN C → radio hut
export const PATHS = [
  [[43, 12], [14.5, 5.5]], [[11.2, 4], [8.6, -8.6]], [[42, 13.5], [9, 28.5]], [[8.2, -11.6], [10.6, -31.5]],
  [[7.6, -11.8], [-7, -21.5]], [[-8.6, -20.4], [-25, 12]], [[-24, 12.6], [-43, -14.4]],
];
// dug-out aprons (x, z, r): doorways, generator service sides, fuel-tank fillers (the station's slush decals)
export function aprons() {
  const A = [];
  for (const m of L.modules) A.push([m.door[0], m.door[1], 2.6]);
  A.push([L.shed.door[0], L.shed.door[1], 4.6], [L.radioHut.door[0], L.radioHut.door[1], 2.4]);
  for (const g of L.generators) A.push([g.c[0] + 3.0, g.c[1] + 0.3, 2.6]);
  for (const t of L.fuelTanks) A.push([t[0] + Math.sin(t[2]) * 2.2, t[1] + Math.cos(t[2]) * 2.2, 2.0]);
  return A;
}

function segDist(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
  const ex = x - a[0] - dx * t, ez = z - a[1] - dz * t;
  return Math.sqrt(ex * ex + ez * ez);
}
/** 0..1 trampled-path weight. */
export function pathAt(x, z) {
  let d = 1e9;
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) d = Math.min(d, segDist(x, z, p[i], p[i + 1]));
  if (d > 4) return 0;
  const w = 0.7 + 0.6 * vn(x * 0.17, z * 0.17, 81), e = 0.45 * (vn(x * 0.8, z * 0.8, 82) - 0.5);
  return (1 - ss(w, w + 1.4, d + e)) * (0.75 + 0.25 * vn(x * 0.09, z * 0.09, 83));
}

function rectDist2(x, z, r) { // squared distance to the rect (0 inside)
  const dx = Math.max(r[0] - x, 0, x - r[2]), dz = Math.max(r[1] - z, 0, z - r[3]);
  return dx * dx + dz * dz;
}

let memo = null;
/** The shelf height function (pure: depends on contracts.js LAYOUT only, memoised). station/parts.js seats every prop
 *  with it BEFORE the terrain mesh exists, and the mesh is sampled from the very same function, so nothing floats.
 *  fn(x, z) → metres; fn.parts(x, z) → { h, smooth, mask, path, near, sast } (shared scratch object). */
export function heightFn() {
  if (memo) return memo;
  const rects = layoutRects(0.4);
  const ras = rasterise(rects);
  const F = driftField(ras);
  const [wx0, wz0, wx1, wz1] = WORLD_RECT;

  const parts = { h: 0, smooth: 0, mask: 0, path: 0, near: 4, sast: 0 };
  const pathBox = PATHS.map((p) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const q of p) { a = Math.min(a, q[0]); b = Math.min(b, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); } return [a - 4, b - 4, c + 4, d + 4]; });
  const pathNear = (x, z) => { for (const b of pathBox) if (x > b[0] && x < b[2] && z > b[1] && z < b[3]) return true; return false; };
  const LOW = SKIRT_Y - 0.6;
  const APR = aprons();
  const apronAt = (x, z) => {
    let f = 1;
    for (const a of APR) { const dx = x - a[0], dz = z - a[1], q = dx * dx + dz * dz, R = a[2] + 2.5; if (q < R * R) f = Math.min(f, ss(a[2], R, Math.sqrt(q))); }
    return f;
  };
  // wind-stretched dunes + slow swell (≥ 20 m features) cached on a 2 m lattice, sampled bilinearly
  const BS = 2, B0 = -154, BN = 155, BASE = new Float32Array(BN * BN);
  for (let j = 0; j < BN; j++) for (let i = 0; i < BN; i++) {
    const x = B0 + i * BS, z = B0 + FAR.cz + j * BS, u = x * WIND[0] + z * WIND[1], v = -x * WIND[1] + z * WIND[0];
    const dune = fbm(u * 0.016, v * 0.05, SEED + 11, 3), swell = vn(x * 0.007, z * 0.007, SEED + 12);
    BASE[i + j * BN] = 0.04 + 0.34 * dune * dune + 0.12 * swell;
  }
  const baseAt = (x, z) => {
    const fx = Math.min(BN - 1.001, Math.max(0, (x - B0) / BS)), fz = Math.min(BN - 1.001, Math.max(0, (z - B0 - FAR.cz) / BS));
    const i = fx | 0, j = fz | 0, a = fx - i, b = fz - j, k = i + j * BN;
    return (BASE[k] * (1 - a) + BASE[k + 1] * a) * (1 - b) + (BASE[k + BN] * (1 - a) + BASE[k + BN + 1] * a) * b;
  };
  // longitudinal dunes: lanes ~14 m apart across the wind, each tens of metres long, crest offset to the lee
  const duneAt = (x, z) => {
    const u = x * WIND[0] + z * WIND[1], v = -x * WIND[1] + z * WIND[0];
    const lane = ridged2(u * 0.012 + 7.3, v * 0.07, 2, SEED + 31), len = vn(u * 0.02, v * 0.05, SEED + 32);
    const l = ss(0.0, 1.0, lane);                     // smoothstep rounds the ridged-noise cusp: no crease along the crest
    return 1.15 * l * l * ss(0.3, 0.75, len);
  };
  // wind crust: sharp ridged plates 1.5-4 m long along the wind, 5-8 cm, patchy (scoured hard-pack between)
  const crustAt = (x, z) => {
    const u = x * WIND[0] + z * WIND[1], v = -x * WIND[1] + z * WIND[0];
    const r = ridged2(u * 0.28 + 1.7, v * 0.85, 2, SEED + 33), p = vn(x * 0.06, z * 0.06, SEED + 34);
    return 0.075 * ss(0.1, 1.0, r) * ss(0.3, 0.6, p);    // rounded plate crests (the cusp would facet on the mesh)
  };
  // hero drifts (showcase foreground): long whaleback drifts along the wind, gentle stoss, steep lee slip face
  const heroAt = (x, z) => {
    let best = 0;
    for (const d of HERO_DRIFTS) {
      const dx = x - d[0], dz = z - d[1], u = (dx * WIND[0] + dz * WIND[1]) / d[2], v = (-dx * WIND[1] + dz * WIND[0]) / d[3];
      if (u <= -1 || u >= 1 || v <= -1 || v >= 1) continue;
      const along = u < 0.45 ? ss(-1, 0.45, u) : 1 - ss(0.45, 1, u) ** 0.6;           // stoss ramp, short lee face
      const across = (1 - v * v) ** 1.5 * (1 + 0.25 * (vn(x * 0.9, z * 0.9, SEED + 41) - 0.5));
      best = Math.max(best, d[4] * along * across);
    }
    return best;
  };
  function eval_(x, z, res = parts) {
    const r = Math.sqrt(x * x + (z - FAR.cz) * (z - FAR.cz));
    if (r >= FAR.r1) { res.h = res.smooth = LOW; res.mask = res.path = res.sast = 0; res.near = 4; return res; }
    const ox = Math.max(wx0 - x, 0, x - wx1), oz = Math.max(wz0 - z, 0, z - wz1), out = Math.sqrt(ox * ox + oz * oz);
    let base = baseAt(x, z);
    let h, mask = 0, sast = 0, P = 0, near = 4;
    if (out < 12) {
      // ---- inside a LAYOUT footprint: exactly flat
      let dr = 1e18;
      for (let i = 0; i < rects.length; i++) { const d = rectDist2(x, z, rects[i]); if (d < dr) dr = d; if (d === 0) break; }
      dr = Math.sqrt(dr);
      P = dr > 0 && pathNear(x, z) ? pathAt(x, z) : 0;
      near = sampleGrid(F.near, x, z, 4);
      const drift = sampleGrid(F.drift, x, z, 0);
      // scour around footprints (base fades to 0 at the walls), levelled path
      const flat = ss(0, 2.2, dr) * ss(0.2, 2.0, near);
      base *= flat;
      mask = ss(0.8, 3.0, near) * ss(0.4, 2.4, dr) * (1 - P) * (1 - 0.4 * Math.min(1, drift / 0.5)) * (1 - ss(1, 8, out));
      sast = mask > 0.001 ? sastrugi(x, z) * mask : 0;
      // open shelf away from the station: long wind-parallel dunes (0.6-1.2 m) and a metre-scale wind crust
      const open = ss(7, 20, dr) * (1 - P);
      const crust = ss(0.4, 2.0, dr) * (1 - 0.8 * P) * (1 - ss(2, 10, out));
      const hero = heroAt(x, z) * (1 - P) * ss(0.5, 2.5, dr);
      h = base + sast + drift * (1 - 0.35 * P) - 0.02 * P * flat + open * duneAt(x, z) + crust * crustAt(x, z) + hero;
      h = Math.max(h, 0);
      const ap = apronAt(x, z);
      if (ap < 1) { h *= ap; mask *= ap; sast *= ap; }
      if (dr === 0) { h = 0; mask = 0; sast = 0; }
    } else h = base;
    // ---- berm + pressure ridges past WORLD bounds
    if (out > 0) {
      const a = vn(x * 0.02, z * 0.02, SEED + 21), b = vn(x * 0.05, z * 0.05, SEED + 22);
      const cr = 11 + 7 * a, crest = 4.0 + 2.0 * b;
      const berm = out < cr ? crest * ss(0.5, cr, out) : crest * (0.5 + 0.5 * Math.exp(-(out - cr) / 12));
      const rid = ridged2(x * 0.028 + 3.1, z * 0.034, 4, SEED + 9), rid2 = ridged2(x * 0.11, z * 0.13, 3, SEED + 10);
      h += berm + ss(3, 26, out) * 3.4 * rid * rid + ss(0.5, 9, out) * 0.7 * rid2 * rid2;
    }
    // ---- sink under the horizon skirt
    if (r > FAR.r0) { const t = ss(FAR.r0, FAR.r1, r); h = h + (LOW - h) * t; mask *= 1 - t; sast *= 1 - t; }
    // smooth = everything but the sastrugi: the mesh normals come from it, the shader adds the sastrugi per pixel
    res.h = h; res.smooth = h - sast; res.mask = mask; res.path = P; res.near = near; res.sast = sast;
    return res;
  }
  const fn = (x, z) => eval_(x, z).h;
  fn.parts = eval_;
  fn.rects = rects;
  fn.drift = F;
  memo = fn;
  return fn;
}

