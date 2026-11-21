// Snow banked around the station's loose props (crates, drums, fence posts, snowmobile, containers): load time only.
// The station seats every prop on the PURE shelf function (height.js) before the terrain mesh exists, so this field
// is added to the mesh only: snow rises around the base of each prop (never under it) and the prop reads as sitting
// IN the snow instead of on a plane.
//   windward bank  — the drift leans on the upwind face: 30-45 % of the prop height at the foot, decaying upwind
//                    over ~0.6·H + 0.5 m (a crate 0.8 m tall gets a 0.3 m bank).
//   lee            — a shallow scoured hollow right behind (≤ 7 cm, starting 0.25 m off the face), then a narrow
//                    tail tongue that the side rays must confirm (as footprints.js).
//   contact        — distance to the nearest prop (feeds the cool cavity tint at the foot of every prop).
// Props come from the station's collider boxes (public API): boxes inside a LAYOUT footprint are building walls
// (already drifted by footprints.js) and are skipped; thin tall boxes (poles, masts) only get contact darkening.
import { GRID } from './footprints.js';
import { WIND, fbm } from './noise.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** boxes: Box3[] (world); rects: layoutRects(). Returns { drift, near, count } on the footprints GRID (or null). */
export function propDriftField(boxes, rects, groundAt) {
  if (!boxes || !boxes.length) return null;
  const { x0, z0, res, nx, nz } = GRID, N = nx * nz;
  const H = new Float32Array(N), occ = new Uint8Array(N);
  const inRect = (x, z) => { for (const r of rects) if (x > r[0] - 0.3 && x < r[2] + 0.3 && z > r[1] - 0.3 && z < r[3] + 0.3) return true; return false; };
  let count = 0;
  const posts = []; // [x, z, scoop radius] of thin tall boxes
  for (const b of boxes) {
    if (!b || !b.min || !isFinite(b.min.x) || !isFinite(b.max.x)) continue;
    const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
    const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z;
    if (sx > 9 || sz > 9 || inRect(cx, cz)) continue;
    const g = groundAt(cx, cz);
    if (b.min.y > g + 0.5) continue;                      // raised (canopies, lamp heads)
    const h = Math.min(2.4, b.max.y - Math.max(b.min.y, g));
    if (h < 0.15) continue;
    const thin = Math.min(sx, sz) < 0.3 && Math.max(sx, sz) < 0.6; // poles / posts: contact + a small scoop only
    if (thin) posts.push(cx, cz, Math.max(0.25, Math.max(sx, sz) * 0.5 + 0.22));
    const i0 = Math.max(0, Math.ceil((b.min.x - x0) / res)), i1 = Math.min(nx - 1, Math.floor((b.max.x - x0) / res));
    const j0 = Math.max(0, Math.ceil((b.min.z - z0) / res)), j1 = Math.min(nz - 1, Math.floor((b.max.z - z0) / res));
    let any = false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = i + j * nx; occ[k] = 1; if (!thin && h > H[k]) H[k] = h; any = true; }
    if (!any) { // smaller than a cell: mark the nearest cell for contact only
      const i = Math.round((cx - x0) / res), j = Math.round((cz - z0) / res);
      if (i >= 0 && j >= 0 && i < nx && j < nz) occ[i + j * nx] = 1;
    }
    count++;
  }
  if (!count) return null;
  const drift = new Float32Array(N), near = new Float32Array(N);
  const wx = WIND[0], wz = WIND[1], px = -wz, pz = wx;
  const NW = Math.round(3 / res), NL = Math.round(6 / res);
  const wI = new Int32Array(NL + 1), wJ = new Int32Array(NL + 1);
  for (let s = 1; s <= NL; s++) { wI[s] = Math.round(wx * s); wJ[s] = Math.round(wz * s); }
  const at = (i, j) => (i < 0 || j < 0 || i >= nx || j >= nz ? 0 : H[i + j * nx]);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = i + j * nx; if (occ[k]) continue;
    let d = 0;
    for (let s = 1; s <= NW; s++) {
      const h = at(i + wI[s], j + wJ[s]);
      if (h) { const sm = s * res - 0.25; d = Math.min(0.45, 0.38 * h) * Math.exp(-Math.max(0, sm) / (0.6 * h + 0.5)); break; }
    }
    for (let s = 1; s <= NL; s++) {
      const bi = i - wI[s], bj = j - wJ[s], h = at(bi, bj);
      if (h) {
        const sm = s * res - 0.25, o = (0.25 * sm + 0.3) / res, oi = Math.round(px * o), oj = Math.round(pz * o);
        const side = (at(bi + oi, bj + oj) ? 0.5 : 0) + (at(bi - oi, bj - oj) ? 0.5 : 0);
        const hollow = -0.07 * ss(0.0, 0.3, sm) * (1 - ss(0.6, 1.6, sm));
        const tail = Math.min(0.22, 0.2 * h) * ss(1.0, 1.8 + 0.4 * h, sm) * Math.exp(-sm / (2.6 * h)) * (0.2 + 0.8 * side);
        d += hollow + tail;
        break;
      }
    }
    drift[k] = d;
  }
  // contact distance (chamfer), metres, capped at 4 (as footprints.js)
  for (let k = 0; k < N; k++) near[k] = occ[k] ? 0 : 99;
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
    near[k] = Math.min(4, v);
  }
  // rounded scoop around thin posts (wind eddy): ≤ 3.5 cm, (1 - r²)² profile, no cone
  for (let p = 0; p < posts.length; p += 3) {
    const px0 = posts[p], pz0 = posts[p + 1], R = posts[p + 2], n = Math.ceil(R / res);
    const ci = Math.round((px0 - x0) / res), cj = Math.round((pz0 - z0) / res);
    for (let j = cj - n; j <= cj + n; j++) for (let i = ci - n; i <= ci + n; i++) {
      if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
      const q = Math.hypot(x0 + i * res - px0, z0 + j * res - pz0) / R;
      if (q < 1) { const w = 1 - q * q; drift[i + j * nx] -= 0.035 * w * w; }
    }
  }
  // separable Gaussian (σ 1.3 cells, radius 3) over the free cells only, so every ramp, crest and tail edge is
  // rounded (no faceted ridges on the 0.5 m mesh), then a gentle along-wind noise break-up
  gaussFree(drift, occ, nx, nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = i + j * nx; if (occ[k] || drift[k] === 0) continue;
    const x = x0 + i * res, z = z0 + j * res, u = x * wx + z * wz, v = -x * wz + z * wx;
    drift[k] *= 0.8 + 0.4 * fbm(u * 0.25, v * 0.6, 75, 2);
  }
  return { drift, near, occ, count };
}

const GK = (() => { const k = new Float32Array(7); let s = 0; for (let i = -3; i <= 3; i++) { k[i + 3] = Math.exp(-(i * i) / (2 * 1.3 * 1.3)); s += k[i + 3]; } for (let i = 0; i < 7; i++) k[i] /= s; return k; })();
function gaussFree(F, occ, nx, nz) {
  const T = new Float32Array(F.length);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = i + j * nx; if (occ[k]) continue;
    let s = 0, w = 0;
    for (let a = -3; a <= 3; a++) { const ii = i + a; if (ii < 0 || ii >= nx || occ[k + a]) continue; s += F[k + a] * GK[a + 3]; w += GK[a + 3]; }
    T[k] = w > 0 ? s / w : 0;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = i + j * nx; if (occ[k]) { F[k] = 0; continue; }
    let s = 0, w = 0;
    for (let b = -3; b <= 3; b++) { const jj = j + b; if (jj < 0 || jj >= nz || occ[k + b * nx]) continue; s += T[k + b * nx] * GK[b + 3]; w += GK[b + 3]; }
    F[k] = w > 0 ? s / w : 0;
  }
}
