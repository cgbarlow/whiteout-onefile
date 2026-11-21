// Pressure-ridge ice outcrops on the berm (geo/sdf-terrain.js buildSdfTerrain + surface nets): each outcrop is a
// jumble of 7-10 tilted ice slabs (rotated rounded boxes, smooth-unioned) pushed up through the berm snow, with a
// small 3D roughness so the slab faces break into fractured planes. The volume's own ground sits 0.35 m under the
// heightfield so the two never z-fight and the slabs read as rising out of the snow. All outcrops merge into ONE
// mesh (one draw). Weathering (uSnow) lays snow on the up-facing slab tops; vertex colour = SDF openness AO.
import { Mesh, BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three';
import { buildSdfTerrain, sdBox, smin } from '../../cookbook/geo/sdf-terrain.js';
import { fbm3 } from '../../cookbook/geo/noise.js';
import { hash3 } from './noise.js';

// [x, z, radius, slabs, seed] — SE berm (spawn yaw view), N berm (north yaw view), W berm (pose-5 background)
export const OUTCROPS = [[73.5, 31, 7, 12, 3], [37, -63.5, 8, 13, 5], [-72.5, 33, 7.5, 12, 8]];

function slabs(cx, cz, rad, n, seed, heightAt) {
  const B = [], h = [0, 0, 0], g = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    hash3(seed, i, 401, h); hash3(seed, i, 402, g);
    const a = h[0] * Math.PI * 2, r = rad * Math.sqrt(h[1]) * 0.8;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r * 0.6;
    const ground = heightAt(x, z);
    const big = 1 - r / rad; // slabs near the middle stand taller
    const he = [1.4 + 1.8 * g[0] + 1.0 * big, 0.35 + 0.45 * g[1], 1.0 + 1.2 * h[2]];
    const yaw = g[2] * Math.PI, tilt = (0.25 + 0.85 * hash3(seed, i, 403, h)[0]) * (h[1] > 0.5 ? 1 : -1), roll = (h[2] - 0.5) * 0.6;
    const y = ground + 0.5 + (0.8 + 1.6 * big) * h[0];
    // rotation matrix R = Ry(yaw)·Rx(tilt)·Rz(roll); store its transpose for world → local
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cxr = Math.cos(tilt), sxr = Math.sin(tilt), cz2 = Math.cos(roll), sz2 = Math.sin(roll);
    const Rz = [cz2, -sz2, 0, sz2, cz2, 0, 0, 0, 1], Rx = [1, 0, 0, 0, cxr, -sxr, 0, sxr, cxr], Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
    const mul = (A, Bm) => { const o = new Array(9); for (let r0 = 0; r0 < 3; r0++) for (let c = 0; c < 3; c++) o[r0 * 3 + c] = A[r0 * 3] * Bm[c] + A[r0 * 3 + 1] * Bm[3 + c] + A[r0 * 3 + 2] * Bm[6 + c]; return o; };
    const R = mul(mul(Ry, Rx), Rz);
    B.push({ c: [x, y, z], he, R, top: y + Math.hypot(...he), rad: Math.hypot(...he) });
  }
  return B;
}

// buildSdfTerrain samples fn only on its voxel lattice: the host ground height is precomputed per lattice column
function densityFor(B, heightAt, seed, min, size, voxel) {
  const nx = Math.round(size[0] / voxel) + 1, nz = Math.round(size[2] / voxel) + 1, col = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) col[i + j * nx] = heightAt(min[0] + i * voxel, min[2] + j * voxel) - 0.35;
  const zero = [0, 0, 0];
  return (x, y, z) => {
    const i = Math.min(nx - 1, Math.max(0, Math.round((x - min[0]) / voxel))), j = Math.min(nz - 1, Math.max(0, Math.round((z - min[2]) / voxel)));
    let d = y - col[i + j * nx];
    let db = 1e9;
    for (const b of B) {
      const px = x - b.c[0], py = y - b.c[1], pz = z - b.c[2], R = b.R;
      const lb = Math.sqrt(px * px + py * py + pz * pz) - b.rad; // lower bound of the slab distance
      if (lb > Math.min(db, 1.2) + 0.4) continue;
      const lx = R[0] * px + R[3] * py + R[6] * pz, ly = R[1] * px + R[4] * py + R[7] * pz, lz = R[2] * px + R[5] * py + R[8] * pz;
      db = smin(db, sdBox(lx, ly, lz, zero, b.he, 0.06), 0.2);
    }
    if (db < 0.8 && db > -0.8) db += 0.2 * (fbm3(x * 0.8, y * 1.0, z * 0.8, 2, seed) - 0.5) * 2; // fractured faces
    d = smin(d, db, 0.6);
    return -d;
  };
}

/** Build all outcrops into one mesh on `material`. heightAt = the shelf's exact height. */
export function buildOutcrops({ heightAt, material, voxel = 0.5 }) {
  const geos = [];
  let tris = 0;
  for (const [cx, cz, rad, n, seed] of OUTCROPS) {
    const B = slabs(cx, cz, rad, n, seed, heightAt);
    let lo = 1e9, hi = -1e9;
    for (let x = cx - rad - 3; x <= cx + rad + 3; x += 2) for (let z = cz - rad - 3; z <= cz + rad + 3; z += 2) { const h = heightAt(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    for (const b of B) hi = Math.max(hi, b.top);
    const min = [cx - rad - 3.5, lo - 1.2, cz - rad - 3.5], size = [2 * rad + 7, hi - lo + 2.4, 2 * rad + 7];
    const S = buildSdfTerrain(densityFor(B, heightAt, seed, min, size, voxel), { min, size, voxel, cell: 1e4, flood: true, ao: true, material: null });
    for (const m of S.meshes) geos.push(m.geometry);
    tris += S.tris;
  }
  // merge (position / normal / color / uv) into one geometry
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), U = new Float32Array(nv * 2), I = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of geos) {
    P.set(g.attributes.position.array, ov * 3); N.set(g.attributes.normal.array, ov * 3); C.set(g.attributes.color.array, ov * 3); U.set(g.attributes.uv.array, ov * 2);
    const src = g.index.array; for (let i = 0; i < src.length; i++) I[oi + i] = src[i] + ov;
    ov += g.attributes.position.count; oi += src.length; g.dispose();
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new Float32BufferAttribute(N, 3));
  geo.setAttribute('color', new Float32BufferAttribute(C, 3)); geo.setAttribute('uv', new Float32BufferAttribute(U, 2));
  geo.setIndex(new Uint32BufferAttribute(I, 1)); geo.computeBoundingSphere(); geo.computeBoundingBox();
  const mesh = new Mesh(geo, material); mesh.name = 'ice-outcrops'; mesh.castShadow = false; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
  return { mesh, tris };
}
