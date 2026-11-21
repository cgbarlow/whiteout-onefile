// Shared terrain noise, bit-identical on the CPU and the GPU: the pcg3d integer hash of materials/noise.glsl.js
// (Jarzynski & Olano 2020) re-implemented with Math.imul, a value noise on it, and the SASTRUGI field.
// The heightfield (height.js) and the ground shader (snow.js) evaluate the same sastrugi so the per-pixel normal
// matches the geometry exactly (the mesh carries the silhouette, the shader carries the sharp crests).
//
// Sastrugi = sparse wind-carved ridges, stretched ALONG the wind: each lattice cell (8 m along × 1.8 m across the
// wind) may hold one ridge with its own length, width and height; a rounded prow faces upwind and the ridge tapers
// smoothly downwind (smooth cross-section: the 0.5 m mesh never shows triangular facets). The field is the MAX of the ridges (sharp crossings, never a sum of sines), its lanes are
// warped sideways, and a regional amplitude leaves smooth wind-packed patches between sastrugi fields.
import { ART } from '../../art.js';

const wind = ART.weather.wind;
const wl = Math.hypot(wind[0], wind[2]) || 1;
export const WIND = [wind[0] / wl, wind[2] / wl]; // unit vector the wind blows TOWARD (x, z)

export const SAST = { cu: 7.0, cv: 1.45, density: 0.9, seed: 61, regionSeed: 62, warpSeed: 63 };

const _h = [0, 0, 0];
/** pcg3d hash of an integer lattice point → 3 floats in [0,1) (top 24 bits, same as hash3i in GLSL). */
export function hash3(ix, iy, iz, out = _h) {
  let x = (Math.imul(ix | 0, 1664525) + 1013904223) >>> 0;
  let y = (Math.imul(iy | 0, 1664525) + 1013904223) >>> 0;
  let z = (Math.imul(iz | 0, 1664525) + 1013904223) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0; y = (y + Math.imul(z, x)) >>> 0; z = (z + Math.imul(x, y)) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0; y = (y ^ (y >>> 16)) >>> 0; z = (z ^ (z >>> 16)) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0; y = (y + Math.imul(z, x)) >>> 0; z = (z + Math.imul(x, y)) >>> 0;
  out[0] = (x >>> 8) / 16777216; out[1] = (y >>> 8) / 16777216; out[2] = (z >>> 8) / 16777216;
  return out;
}

/** value noise [0,1], cubic fade (tvn in GLSL). */
export function vn(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash3(ix, iy, s)[0], b = hash3(ix + 1, iy, s)[0], c = hash3(ix, iy + 1, s)[0], d = hash3(ix + 1, iy + 1, s)[0];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(x, y, s, oct = 3) {
  let a = 0.5, t = 0, n = 0;
  for (let i = 0; i < oct; i++) { t += a * vn(x, y, s + i); n += a; a *= 0.5; const nx = x * 1.6 - y * 1.2, ny = x * 1.2 + y * 1.6; x = nx + 5.3; y = ny + 1.7; }
  return t / n;
}

const _g = [0, 0, 0], _k = [0, 0, 0];
/** Sastrugi height (m, 0..~0.26) at world (x, z), regional amplitude included. */
export function sastrugi(x, z) {
  const u = x * WIND[0] + z * WIND[1];
  let v = -x * WIND[1] + z * WIND[0];
  v += 1.1 * (vn(u * 0.045, v * 0.07, SAST.warpSeed) - 0.5);
  const reg = vn(x * 0.028, z * 0.028, SAST.regionSeed);
  const amp = 0.5 + 0.5 * Math.min(1, Math.max(0, (reg - 0.28) / 0.42));
  const { cu, cv } = SAST;
  const i0 = Math.floor(u / cu), j0 = Math.floor(v / cv);
  let best = 0;
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const i = i0 + di, j = j0 + dj;
    const h = hash3(i, j, SAST.seed, _k);
    if (h[0] > SAST.density) continue;
    const c0 = (i + h[1]) * cu, c1 = (j + h[2]) * cv;
    const g = hash3(i, j, SAST.seed + 1, _g);
    const L = cu * (0.35 + 0.6 * g[0]), w = 0.6 + 0.8 * g[1], a = 0.07 + 0.19 * g[2];
    const t = (u - c0) / (2 * L) + 0.5;
    if (t <= 0 || t >= 1) continue;
    const we = w * (1 - 0.45 * t);
    const x = Math.abs(v - c1) / we;
    if (x >= 1) continue;
    const c = (1 - x * x) * (1 - x * x);                     // rounded crest, smooth toe (no linear facets)
    const q = Math.min(1, t / 0.24), along = q * q * (3 - 2 * q) * Math.pow(1 - t, 1.6);
    const r = a * along * c;
    if (r > best) best = r;
  }
  return best * amp;
}

// GLSL twin of the above. Needs NOISE_GLSL (hash3i) — the ground patch calls ensureNoise(shader) first.
// tsSast(p, soft): soft = crest softening (m) from the pixel footprint so the sharp crest never aliases.
export const TERRAIN_GLSL = /*glsl*/`
#ifndef TS_LIB
#define TS_LIB
float tvn(vec2 p, float s) {
  vec2 i = floor(p); vec2 f = p - i; f = f * f * (3.0 - 2.0 * f);
  ivec2 c = ivec2(i);
  float a = hash3i(ivec3(c, int(s))).x, b = hash3i(ivec3(c + ivec2(1, 0), int(s))).x;
  float d = hash3i(ivec3(c + ivec2(0, 1), int(s))).x, e = hash3i(ivec3(c + ivec2(1, 1), int(s))).x;
  return a + (b - a) * f.x + (d - a) * f.y + (a - b - d + e) * f.x * f.y;
}
float tsSast(vec2 p, float soft) {
  vec2 W = vec2(TS_WX, TS_WZ);
  float u = dot(p, W);
  float v = dot(p, vec2(-W.y, W.x));
  v += 1.1 * (tvn(vec2(u * 0.045, v * 0.07), TS_WARP) - 0.5);
  float reg = tvn(p * 0.028, TS_REG);
  float amp = 0.5 + 0.5 * clamp((reg - 0.28) / 0.42, 0.0, 1.0);
  ivec2 b0 = ivec2(floor(vec2(u / TS_CU, v / TS_CV)));
  float best = 0.0;
  for (int di = -1; di <= 1; di++) for (int dj = -1; dj <= 1; dj++) {
    ivec2 c = b0 + ivec2(di, dj);
    vec3 h = hash3i(ivec3(c, int(TS_SEED)));
    if (h.x > TS_DENS) continue;
    float c0 = (float(c.x) + h.y) * TS_CU, c1 = (float(c.y) + h.z) * TS_CV;
    vec3 g = hash3i(ivec3(c, int(TS_SEED) + 1));
    float L = TS_CU * (0.35 + 0.6 * g.x), w = 0.6 + 0.8 * g.y, a = 0.07 + 0.19 * g.z;
    float t = (u - c0) / (2.0 * L) + 0.5;
    if (t <= 0.0 || t >= 1.0) continue;
    float we = w * (1.0 - 0.45 * t);
    float dv = v - c1;
    float xx = sqrt(dv * dv + soft * soft) / we;
    if (xx >= 1.0) continue;
    float cc = (1.0 - xx * xx) * (1.0 - xx * xx);
    float along = smoothstep(0.0, 0.24, t) * pow(1.0 - t, 1.6);
    best = max(best, a * along * cc);
  }
  return best * amp;
}
#endif
`;

export function terrainDefines() {
  const f = (n) => (+n).toFixed(5);
  return `#define TS_WX ${f(WIND[0])}\n#define TS_WZ ${f(WIND[1])}\n#define TS_CU ${f(SAST.cu)}\n#define TS_CV ${f(SAST.cv)}\n` +
    `#define TS_DENS ${f(SAST.density)}\n#define TS_SEED ${SAST.seed}.0\n#define TS_REG ${SAST.regionSeed}.0\n#define TS_WARP ${SAST.warpSeed}.0\n`;
}
