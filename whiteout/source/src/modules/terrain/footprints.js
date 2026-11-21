// Footprint raster + wind drift field (load time only, pure function of contracts.js LAYOUT).
// Every LAYOUT footprint (modules, shed, lean-tos, radio hut, tower footing, fuel tanks) is rasterised into a 0.5 m
// grid: `occ` = obstacle cell, `top` = obstacle height. From that raster, for every cell:
//   windward drift  — march DOWNWIND to the first obstacle at distance s: a scour moat right at the wall, then a
//                     drift ramp peaking ~1.5-2.3 m out and decaying upwind over ~0.7·H (H = obstacle height);
//   lee tail        — march UPWIND to the first obstacle: a long tongue behind it that narrows with distance
//                     (side rays must also hit the obstacle) and decays over ~3·H;
//   contact         — distance to the nearest obstacle (cavity darkening at the base of everything).
// Doorways facing the wind are dug out (the crew shovels them), so the spawn door and the HAB/STORE doors are clear.
import { LAYOUT as L, WORLD } from '../../contracts.js';
import { WIND, fbm } from './noise.js';

export const GRID = { x0: -70, z0: -60, res: 0.5, nx: 281, nz: 233 }; // covers WORLD + 10 m
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Rects that must be exactly flat (y = 0): [x0, z0, x1, z1, height]. */
export function layoutRects(margin = 0.4) {
  const R = [];
  // r = [x0, z0, x1, z1, height, margin, bank]; closed buildings (bank = 1) keep only a 0.12 m flat skirt so the
  // windward drift banks right up against the wall and hides the skids
  const add = (c, s, h, m = margin, bank = 0) => R.push([c[0] - s[0] / 2 - m, c[1] - s[1] / 2 - m, c[0] + s[0] / 2 + m, c[1] + s[1] / 2 + m, h, m, bank]);
  const mb = Math.min(margin, 0.12);
  for (const m of L.modules) add(m.c, m.size, m.h + (m.floor ?? 0.3), mb, 1);
  add(L.shed.c, L.shed.size, L.shed.h, mb, 1);
  add(L.radioHut.c, L.radioHut.size, L.radioHut.h, mb, 1);
  for (const g of L.generators) add(g.c, [5.4, 4.6], 2.9);
  add(L.tower.c, [L.tower.base + 1, L.tower.base + 1], 1.2); // open lattice: only the footing slabs catch snow
  for (const t of L.fuelTanks) {                                // 6 m × Ø2.4 m horizontal tanks, rotated
    const c = Math.cos(t[2]), s = Math.sin(t[2]), hx = 3.3 * Math.abs(c) + 1.4 * Math.abs(s), hz = 3.3 * Math.abs(s) + 1.4 * Math.abs(c);
    add([t[0], t[1]], [2 * hx, 2 * hz], 2.7, 0.2);
  }
  return R;
}

/** Doors (world [x, z]) that are kept clear of drift. */
export function doors() {
  const d = [L.shed.door, L.radioHut.door];
  for (const m of L.modules) d.push(m.door);
  return d;
}

/** Rasterise the LAYOUT footprints: occ = obstacle cell, top = obstacle height. Pure (LAYOUT only), so the station
 *  can seat its props on the very same surface before the terrain mesh exists (station/parts.js gy()). */
export function rasterise(rects) {
  const { x0, z0, res, nx, nz } = GRID, N = nx * nz;
  const occ = new Uint8Array(N), top = new Float32Array(N), bank = new Uint8Array(N);
  for (const r of rects) { // rects carry a margin (r[5]): the obstacle itself is the inset rect
    const m = r[5] ?? 0.4;
    const i0 = Math.max(0, Math.ceil((r[0] + m - x0) / res)), i1 = Math.min(nx - 1, Math.floor((r[2] - m - x0) / res));
    const j0 = Math.max(0, Math.ceil((r[1] + m - z0) / res)), j1 = Math.min(nz - 1, Math.floor((r[3] - m - z0) / res));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = i + j * nx; occ[k] = 1; if (r[4] > top[k]) top[k] = r[4]; if (r[6]) bank[k] = 1; }
  }
  return { occ, top, bank };
}

function blur(src, nx, nz, r, passes) {
  let a = src, b = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < nz; j++) { // horizontal running sum
      let s = 0; const row = j * nx;
      for (let i = -r; i <= r; i++) s += a[row + Math.min(nx - 1, Math.max(0, i))];
      for (let i = 0; i < nx; i++) {
        b[row + i] = s / (2 * r + 1);
        s += a[row + Math.min(nx - 1, i + r + 1)] - a[row + Math.max(0, i - r)];
      }
    }
    for (let i = 0; i < nx; i++) { // vertical
      let s = 0;
      for (let j = -r; j <= r; j++) s += b[Math.min(nz - 1, Math.max(0, j)) * nx + i];
      for (let j = 0; j < nz; j++) {
        a[j * nx + i] = s / (2 * r + 1);
        s += b[Math.min(nz - 1, j + r + 1) * nx + i] - b[Math.max(0, j - r) * nx + i];
      }
    }
  }
  return a;
}

/** Drift field (m), contact field (0 at a wall .. 1 beyond 2 m), door clearance (0 at a door .. 1). */
export function driftField({ occ, top, bank }) {
  const { x0, z0, res, nx, nz } = GRID, N = nx * nz;
  const drift = new Float32Array(N), near = new Float32Array(N);
  const wx = WIND[0], wz = WIND[1], px = -wz, pz = wx;
  const H = new Float32Array(N); // obstacle height per cell (0 = free)
  for (let k = 0; k < N; k++) H[k] = occ[k] ? Math.max(0.6, top[k]) : 0;
  // precomputed integer offsets along the wind (march in cells, allocation-free inner loops)
  const NW = Math.round(8 / res), NL = Math.round(16 / res);
  const wI = new Int32Array(NL + 1), wJ = new Int32Array(NL + 1);
  for (let s = 1; s <= NL; s++) { wI[s] = Math.round(wx * s); wJ[s] = Math.round(wz * s); }
  const at = (i, j) => (i < 0 || j < 0 || i >= nx || j >= nz ? 0 : H[i + j * nx]);
  const bankAt = (i, j) => (bank && i >= 0 && j >= 0 && i < nx && j < nz ? bank[i + j * nx] : 0);
  // marched on every 2nd cell (1 m), the rest interpolated: the field is blurred to ~1 m anyway
  for (let j = 0; j < nz; j += 2) for (let i = 0; i < nx; i += 2) {
    const k = i + j * nx; if (occ[k]) continue;
    let d = 0;
    // windward: obstacle downwind within 8 m
    for (let s = 1; s <= NW; s++) {
      const h = at(i + wI[s], j + wJ[s]);
      if (h) {
        const sm = s * res, A = Math.min(1.05, 0.3 * h), s0 = 1.1 + 0.25 * h;
        // closed walls: the drift banks against the wall (40 % of the crest at the foot); open lean-tos and tank
        // saddles keep a scour moat at the foot
        const foot = bankAt(i + wI[s], j + wJ[s]) ? 0.4 + 0.6 * ss(0.0, s0, sm) : ss(0.45, s0, sm);
        d = A * (sm < s0 ? foot : Math.exp(-(sm - s0) / (0.7 * h + 0.4)));
        break;
      }
    }
    // lee: obstacle upwind within 16 m; the tongue narrows (side rays at ±0.28·s must also hit)
    for (let s = 1; s <= NL; s++) {
      const bi = i - wI[s], bj = j - wJ[s], h = at(bi, bj);
      if (h) {
        const sm = s * res, o = (0.28 * sm + 0.3) / res, oi = Math.round(px * o), oj = Math.round(pz * o);
        const side = (at(bi + oi, bj + oj) ? 0.5 : 0) + (at(bi - oi, bj - oj) ? 0.5 : 0);
        const A = Math.min(0.65, 0.19 * h);
        d = Math.max(d, A * ss(0.5, 1.4 + 0.35 * h, sm) * Math.exp(-sm / (3.0 * h)) * (0.25 + 0.75 * side));
        break;
      }
    }
    drift[k] = d;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (!(i & 1) && !(j & 1)) continue;
    const i0 = i & ~1, j0 = j & ~1, i1 = Math.min(nx - 1, i0 + 2), j1 = Math.min(nz - 1, j0 + 2);
    const u = (i - i0) / 2, v = (j - j0) / 2;
    drift[i + j * nx] = (drift[i0 + j0 * nx] * (1 - u) + drift[i1 + j0 * nx] * u) * (1 - v) + (drift[i0 + j1 * nx] * (1 - u) + drift[i1 + j1 * nx] * u) * v;
  }
  // contact distance (two-pass chamfer, metres, capped)
  const BIG = 99;
  for (let k = 0; k < N; k++) near[k] = occ[k] ? 0 : BIG;
  const D1 = res, D2 = res * Math.SQRT2;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = i + j * nx; let v = near[k];
    if (i > 0) v = Math.min(v, near[k - 1] + D1);
    if (j > 0) { v = Math.min(v, near[k - nx] + D1); if (i > 0) v = Math.min(v, near[k - nx - 1] + D2); if (i < nx - 1) v = Math.min(v, near[k - nx + 1] + D2); }
    near[k] = v;
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = i + j * nx; let v = near[k];
    if (i < nx - 1) v = Math.min(v, near[k + 1] + D1);
    if (j < nz - 1) { v = Math.min(v, near[k + nx] + D1); if (i < nx - 1) v = Math.min(v, near[k + nx + 1] + D2); if (i > 0) v = Math.min(v, near[k + nx - 1] + D2); }
    near[k] = v;
  }
  // soften, break up with noise (drifts are never ruler-straight), dig out the doorways
  blur(drift, nx, nz, 2, 2);
  const D = doors();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = i + j * nx, x = x0 + i * res, z = z0 + j * res;
    near[k] = Math.min(near[k], 4);
    if (drift[k] < 1e-4) continue;
    let clear = 1;
    for (const p of D) { const dx = x - p[0], dz = z - p[1], q = dx * dx + dz * dz; if (q < 25) clear = Math.min(clear, ss(2.0, 5.0, Math.sqrt(q))); }
    const n = fbm(x * 0.12, z * 0.12, 71, 3);
    drift[k] *= (0.62 + 0.8 * n) * (0.15 + 0.85 * clear);
  }
  return { drift, near, occ };
}

/** Bilinear sample of a GRID field (outside → `def`). */
export function sampleGrid(F, x, z, def = 0) {
  const { x0, z0, res, nx, nz } = GRID;
  const fx = (x - x0) / res, fz = (z - z0) / res;
  if (fx < 0 || fz < 0 || fx > nx - 1 || fz > nz - 1) return def;
  const i = Math.min(nx - 2, Math.floor(fx)), j = Math.min(nz - 2, Math.floor(fz)), u = fx - i, v = fz - j, k = i + j * nx;
  return (F[k] * (1 - u) + F[k + 1] * u) * (1 - v) + (F[k + nx] * (1 - u) + F[k + nx + 1] * u) * v;
}

export const WORLD_RECT = [WORLD.min[0], WORLD.min[2], WORLD.max[0], WORLD.max[2]];
