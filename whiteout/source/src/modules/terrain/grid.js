// Rectilinear heightfield mesh (same contract as geo/sdf-terrain.js terrain(): metric UVs, cavity in vertex colour,
// exact heightAt on the rendered triangles, same b–d diagonal split), but with NON-UNIFORM axes: 0.5 m spacing over
// the play area + berm, growing geometrically to 4 m toward the far edge. A rectilinear grid has no T-junctions, so
// there are no cracks between the fine and coarse parts, and the whole 300 m shelf stays under ~190 k triangles.
// Extra attribute `tmask` (vec2): x = sastrugi weight (the shader adds the per-pixel sastrugi normal), y = path.
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Mesh, Group, Vector3 } from 'three';

/** Axis coordinates: fine `res` over [a, b], growing ×`grow` per step (≤ `maxStep`) out to [lo, hi]. */
export function axis(lo, a, b, hi, res, grow = 1.12, maxStep = 4) {
  const inner = [];
  const n = Math.round((b - a) / res);
  for (let i = 0; i <= n; i++) inner.push(a + (i * (b - a)) / n);
  const outer = (from, to, dir) => {
    const r = []; let p = from, s = res;
    while (dir * (to - p) > 1e-6) { s = Math.min(maxStep, s * grow); p += dir * s; if (dir * (p - to) > -s * 0.4) p = to; r.push(p); }
    return r;
  };
  return Float64Array.from([...outer(a, lo, -1).reverse(), ...inner, ...outer(b, hi, 1)]);
}

function findCell(A, x) { // largest i with A[i] <= x, clamped to [0, n-2]
  const n = A.length;
  if (x <= A[0]) return 0;
  if (x >= A[n - 1]) return n - 2;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= x) lo = m; else hi = m; }
  return lo;
}

/**
 * Build the ground. parts(x, z) → { h, smooth, mask, path, near } (height.js).
 * Returns { group, meshes, heightAt, normalAt, tris }.
 */
export function rectTerrain({ X, Z, parts, material, chunks = [2, 2], cavity = 0.6, tint = null }) {
  const nx = X.length, nz = Z.length, N = nx * nz;
  const H = new Float32Array(N), S = new Float32Array(N), M = new Float32Array(N * 2), Nr = new Float32Array(N);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const p = parts(X[i], Z[j]), k = i + j * nx;
    H[k] = p.h; S[k] = p.smooth; M[k * 2] = p.mask; M[k * 2 + 1] = p.path; Nr[k] = p.near;
  }
  const cl = (i, n) => (i < 0 ? 0 : i >= n ? n - 1 : i);
  const h = (A, i, j) => A[cl(i, nx) + cl(j, nz) * nx];
  const group = new Group(), meshes = [];
  const ci = chunks[0], cj = chunks[1], perI = Math.ceil((nx - 1) / ci), perJ = Math.ceil((nz - 1) / cj);
  let tris = 0;
  for (let b = 0; b < cj; b++) for (let a = 0; a < ci; a++) {
    const i0 = a * perI, j0 = b * perJ, i1 = Math.min(nx - 1, i0 + perI), j1 = Math.min(nz - 1, j0 + perJ);
    if (i0 >= i1 || j0 >= j1) continue;
    const w = i1 - i0 + 1, cnt = w * (j1 - j0 + 1);
    const P = new Float32Array(cnt * 3), Nn = new Float32Array(cnt * 3), C = new Float32Array(cnt * 3), U = new Float32Array(cnt * 2), T = new Float32Array(cnt * 2);
    let v = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++, v++) {
      const x = X[i], z = Z[j], y = h(H, i, j);
      const xm = X[cl(i - 1, nx)], xp = X[cl(i + 1, nx)], zm = Z[cl(j - 1, nz)], zp = Z[cl(j + 1, nz)];
      // normals from the smooth surface (no sastrugi: the shader adds them exactly, per pixel)
      const gx = (h(S, i + 1, j) - h(S, i - 1, j)) / Math.max(1e-4, xp - xm), gz = (h(S, i, j + 1) - h(S, i, j - 1)) / Math.max(1e-4, zp - zm);
      const l = Math.hypot(gx, 1, gz);
      P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
      Nn[v * 3] = -gx / l; Nn[v * 3 + 1] = 1 / l; Nn[v * 3 + 2] = -gz / l;
      U[v * 2] = x; U[v * 2 + 1] = z;
      // cavity: Laplacian of the full surface over ±2 cells (hollows between sastrugi and drift toes darken)
      const i2m = cl(i - 2, nx), i2p = cl(i + 2, nx), j2m = cl(j - 2, nz), j2p = cl(j + 2, nz);
      const dx = Math.max(0.5, (X[i2p] - X[i2m]) / 2), dz = Math.max(0.5, (Z[j2p] - Z[j2m]) / 2);
      const lap = (h(H, i + 2, j) + h(H, i - 2, j) - 2 * y) / (dx * dx) + (h(H, i, j + 2) + h(H, i, j - 2) - 2 * y) / (dz * dz);
      let o = Math.min(1, Math.max(0.6, 1 - lap * cavity)) * (0.93 + 0.07 * Math.max(0, 1 - Math.hypot(gx, gz)));
      const k = i + j * nx;
      if (tint) o = tint(x, z, o, M[k * 2 + 1], Nr[k], C, v * 3);
      else { C[v * 3] = C[v * 3 + 1] = C[v * 3 + 2] = o; }
      T[v * 2] = M[k * 2]; T[v * 2 + 1] = M[k * 2 + 1];
    }
    const ix = new Uint32Array((i1 - i0) * (j1 - j0) * 6);
    let q = 0;
    for (let j = 0; j < j1 - j0; j++) for (let i = 0; i < i1 - i0; i++) {
      const a0 = i + j * w, b0 = a0 + 1, d0 = a0 + w, e0 = d0 + 1;
      ix[q++] = a0; ix[q++] = d0; ix[q++] = b0; ix[q++] = b0; ix[q++] = d0; ix[q++] = e0;
    }
    tris += q / 3;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(P, 3)); g.setAttribute('normal', new Float32BufferAttribute(Nn, 3));
    g.setAttribute('color', new Float32BufferAttribute(C, 3)); g.setAttribute('uv', new Float32BufferAttribute(U, 2));
    g.setAttribute('tmask', new Float32BufferAttribute(T, 2));
    g.setIndex(new Uint32BufferAttribute(ix, 1)); g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new Mesh(g, material); m.receiveShadow = true; m.castShadow = false; m.matrixAutoUpdate = false;
    group.add(m); meshes.push(m);
  }
  // exact height of the rendered triangles (diagonal b–d, same as the index order above)
  const heightAt = (x, z) => {
    const i = findCell(X, x), j = findCell(Z, z);
    const u = Math.min(1, Math.max(0, (x - X[i]) / (X[i + 1] - X[i]))), v = Math.min(1, Math.max(0, (z - Z[j]) / (Z[j + 1] - Z[j])));
    const k = i + j * nx, A = H[k], B = H[k + 1], D = H[k + nx], E = H[k + nx + 1];
    return u + v <= 1 ? A + (B - A) * u + (D - A) * v : E + (D - E) * (1 - u) + (B - E) * (1 - v);
  };
  const normalAt = (x, z, out = new Vector3()) => {
    const e = 0.5; return out.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
  };
  return { group, meshes, heightAt, normalAt, tris, grid: { X, Z, H } };
}
