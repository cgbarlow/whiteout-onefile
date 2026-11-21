// Stalker sculpt: the body is a signed-distance sculpt (smooth-unioned round cones / ellipsoids / spheres in the
// bind pose of rig.js) meshed once at load with surface nets (cookbook geo/surface-nets.js), every vertex projected
// back onto the exact surface, normals from the SDF gradient. Fingers and toes are tapered claw tubes (geo/kit.js
// tube) because they are thinner than a voxel. Per vertex it bakes:
//   skinIndex/skinWeight  4 bones, from the distance to each primitive (each primitive belongs to 1-2 bones), so
//                         joints blend exactly where two parts meet (no gaps, no candy-wrapper seams)
//   color                 SDF ambient occlusion (crevices, armpits, eye sockets) × mottled bruise tint (linear)
//   aSkin (vec4)          x = frost (shoulders / upper back / skull, the faces that point up once it stoops),
//                         y = thinness (fingers, jaw, brow: back-lit translucency), z = claw / tooth (keratin),
//                         w = ambient occlusion alone (crevice grime in skin.js)
// buildSculpt() → { geometry, tris, ms }. Load-time only (~60-90 ms).
import { BufferGeometry, BufferAttribute } from 'three';
import { surfaceNets } from '../../cookbook/geo/surface-nets.js';
import { tube } from '../../cookbook/geo/kit.js';
import { BI } from './rig.js';

const K = 0.028;            // default smooth-union radius (m)
const VOX = 0.015;          // voxel (m): ~30 k triangles for the body (ribs + face read at 4 m)
const BOX = { x0: -0.44, y0: -0.02, z0: -0.31, x1: 0.44, y1: 2.42, z1: 0.26 };

// ---- primitives -------------------------------------------------------------------------------------------
// t: 0 round cone (a→b, ra→rb), 1 ellipsoid (centre a, radii r), 2 sphere (a, ra). sub = carve. bones: [b0, b1?]
// blended along seg (a→b for cones, o.seg for the others).
function makePrims() {
  const P = [];
  const add = (p) => {
    const m = (p.t === 0 ? Math.max(p.ra, p.rb) : p.t === 1 ? Math.max(p.r[0], p.r[1], p.r[2]) : p.ra) + p.k + 0.03;
    const a = p.a, b = p.t === 0 ? p.b : p.a;
    // flat numeric fields (hot loops): bounds, endpoints, axis, radii
    p.x0 = Math.min(a[0], b[0]) - m; p.y0 = Math.min(a[1], b[1]) - m; p.z0 = Math.min(a[2], b[2]) - m;
    p.x1 = Math.max(a[0], b[0]) + m; p.y1 = Math.max(a[1], b[1]) + m; p.z1 = Math.max(a[2], b[2]) + m;
    p.ax = a[0]; p.ay = a[1]; p.az = a[2]; p.bx = b[0] - a[0]; p.by = b[1] - a[1]; p.bz = b[2] - a[2];
    p.abl = p.t === 0 ? 1 / (p.bx * p.bx + p.by * p.by + p.bz * p.bz) : 0;
    p.rx = p.r ? p.r[0] : 0; p.ry = p.r ? p.r[1] : 0; p.rz = p.r ? p.r[2] : 0; p.ra ??= 0; p.rb ??= 0;
    const s = p.seg || (p.t === 0 ? [a, b] : null);
    if (s && p.bones.length > 1) { p.sa = s[0]; p.sd = [s[1][0] - s[0][0], s[1][1] - s[0][1], s[1][2] - s[0][2]]; p.sl = 1 / (p.sd[0] ** 2 + p.sd[1] ** 2 + p.sd[2] ** 2); }
    P.push(p);
  };
  const cone = (a, b, ra, rb, bones, o = {}) => add({ t: 0, a, b, ra, rb, bones, k: o.k ?? K, sub: !!o.sub, seg: o.seg });
  const ell = (a, r, bones, o = {}) => add({ t: 1, a, r, bones, k: o.k ?? K, sub: !!o.sub, seg: o.seg });
  const sph = (a, ra, bones, o = {}) => add({ t: 2, a, ra, bones, k: o.k ?? K, sub: !!o.sub, seg: o.seg });
  const B = BI;
  // torso: narrow pelvis, starved waist under a flared ribcage, blade-like scapulae, a ridge of vertebrae
  ell([0, 1.27, -0.012], [0.135, 0.08, 0.085], [B.pelvis]);
  sph([0, 1.30, -0.08], 0.038, [B.pelvis]);
  cone([0, 1.30, -0.01], [0, 1.64, -0.02], 0.074, 0.086, [B.spine1, B.spine2]);
  ell([0, 1.48, 0.09], [0.07, 0.085, 0.034], [B.spine1], { sub: true, k: 0.035 });               // sunken belly
  ell([0, 1.79, -0.008], [0.165, 0.2, 0.122], [B.spine2, B.chest], { seg: [[0, 1.62, 0], [0, 1.94, 0]] });
  ell([0, 1.665, 0.004], [0.152, 0.05, 0.112], [B.spine2], { k: 0.02 });                        // lower-rib ledge
  sph([0, 1.955, 0.09], 0.024, [B.chest], { sub: true, k: 0.015 });                             // sternal notch
  ell([0, 1.76, 0.128], [0.035, 0.12, 0.025], [B.chest], { sub: true, k: 0.03 });               // sternum groove
  for (let i = 0; i < 17; i++) {
    const y = 1.31 + i * 0.041, z = y < 1.6 ? -0.088 : y < 1.95 ? -0.126 + Math.max(0, y - 1.86) * 0.35 : -0.08;
    const bone = y < 1.48 ? B.spine1 : y < 1.66 ? B.spine2 : y < 1.94 ? B.chest : B.neck;
    sph([0, y, z], y > 1.95 ? 0.014 : 0.018, [bone], { k: 0.012 });
  }
  cone([0, 1.93, -0.04], [0, 2.13, -0.005], 0.042, 0.034, [B.neck, B.head]);
  // head: a long, narrow, eyeless skull drawn back into a horn-like occipital crest with a sagittal keel, hollow
  // temples, deep empty sockets under a heavy brow, a long snout and an underslung jaw that hangs open on the teeth
  ell([0, 2.222, -0.06], [0.058, 0.068, 0.128], [B.head], { k: 0.036 });
  cone([0, 2.245, -0.13], [0, 2.30, -0.275], 0.05, 0.016, [B.head], { k: 0.035 });               // occipital crest
  cone([0, 2.295, 0.03], [0, 2.29, -0.2], 0.011, 0.009, [B.head], { k: 0.02 });                  // sagittal keel
  cone([-0.056, 2.214, 0.074], [0.056, 2.214, 0.074], 0.021, 0.021, [B.head], { k: 0.018 });    // brow ridge
  cone([0, 2.195, 0.05], [0, 2.11, 0.2], 0.046, 0.02, [B.head], { k: 0.034 });                    // snout
  ell([0, 2.17, 0.085], [0.047, 0.045, 0.085], [B.head], { k: 0.035 });                        // maxilla: skull → snout wedge
  cone([0, 2.215, 0.08], [0, 2.15, 0.19], 0.012, 0.008, [B.head], { k: 0.015 });                // nasal ridge
  ell([0, 2.168, 0.176], [0.009, 0.016, 0.012], [B.head], { sub: true, k: 0.008 });             // nasal slit
  cone([0, 2.10, 0.0], [0, 2.03, 0.19], 0.04, 0.018, [B.jaw], { k: 0.018 });                      // jaw
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', x = (v) => v * s;
    ell([x(0.092), 1.835, -0.1], [0.07, 0.092, 0.025], [B.chest]);                                // scapula
    sph([x(0.108), 1.33, 0.032], 0.027, [B.pelvis]);                                              // iliac crest
    cone([x(0.03), 2.04, -0.045], [x(0.2), 1.955, -0.035], 0.034, 0.028, [B.chest]);                // trapezius
    cone([x(0.042), 2.115, -0.012], [x(0.013), 1.948, 0.07], 0.012, 0.01, [B.neck, B.chest], { k: 0.015 });
    cone([x(0.016), 1.94, 0.082], [x(0.2), 1.962, 0.0], 0.015, 0.015, [B['clav' + L]], { k: 0.018 });
    ell([x(0.13), 1.64, -0.01], [0.032, 0.042, 0.075], [B.spine2], { k: 0.02 });                  // flared false ribs (sideways, never a bump on the front)
    sph([x(0.054), 2.155, 0.066], 0.022, [B.head], { k: 0.018 });                                 // cheekbone
    sph([x(0.064), 2.118, 0.098], 0.02, [B.head], { sub: true, k: 0.02 });                        // sunken cheek
    sph([x(0.068), 2.222, -0.005], 0.028, [B.head], { sub: true, k: 0.03 });                      // temple hollow
    sph([x(0.034), 2.188, 0.108], 0.027, [B.head], { sub: true, k: 0.01 });                       // eye socket
    sph([x(0.03), 2.19, 0.084], 0.018, [B.head], { sub: true, k: 0.008 });                        // ... and its pit
    sph([x(0.047), 2.09, -0.005], 0.026, [B.jaw], { k: 0.02 });                                   // jaw angle
    // ribs: starved hoops standing proud of the flank, sloping down to the front, a gap at the sternum
    for (let r = 0; r < 6; r++) {
      const yb = 1.875 - r * 0.042;
      let prev = null;
      for (let k = 0; k <= 6; k++) {
        const ph = Math.PI * (0.22 + 0.63 * k / 6), y = yb - 0.075 * k / 6, q = (y - 1.79) / 0.2;
        const w = Math.sqrt(Math.max(0, 1 - q * q)) * 0.99;
        const pt = [x(0.165 * w * Math.sin(ph)), y, -0.008 - 0.122 * w * Math.cos(ph)];
        if (prev) cone(prev, pt, 0.0115, 0.0105, [B.spine2, B.chest], { k: 0.012, seg: [[0, 1.62, 0], [0, 1.94, 0]] });
        prev = pt;
      }
    }
    for (let f = 0; f < 4; f++) sph([x(0.352), 0.852, -0.028 + f * 0.0197], 0.011, [B['hand' + L]], { k: 0.01 }); // knuckles
    // arm: deltoid, ropy biceps/triceps, pointed elbow, forearm swelling below the elbow, knobbly wrist, narrow palm
    sph([x(0.215), 1.93, -0.02], 0.054, [B['uarm' + L]]);
    cone([x(0.215), 1.93, -0.02], [x(0.27), 1.45, -0.03], 0.044, 0.029, [B['uarm' + L]]);
    ell([x(0.24), 1.7, 0.012], [0.034, 0.12, 0.032], [B['uarm' + L]], { k: 0.02 });               // biceps
    ell([x(0.245), 1.68, -0.06], [0.032, 0.13, 0.03], [B['uarm' + L]], { k: 0.02 });              // triceps
    sph([x(0.272), 1.45, -0.058], 0.03, [B['farm' + L]], { k: 0.02 });                            // olecranon
    cone([x(0.27), 1.45, -0.03], [x(0.33), 0.945, 0.0], 0.033, 0.02, [B['farm' + L]]);
    ell([x(0.283), 1.33, -0.012], [0.04, 0.12, 0.036], [B['farm' + L]], { k: 0.025 });            // forearm swell
    cone([x(0.287), 1.42, -0.05], [x(0.336), 0.96, -0.016], 0.016, 0.012, [B['farm' + L]], { k: 0.02 });
    sph([x(0.333), 0.945, -0.012], 0.022, [B['hand' + L]], { k: 0.02 });
    ell([x(0.338), 0.886, 0.006], [0.02, 0.064, 0.044], [B['hand' + L]], { k: 0.02 });
    cone([x(0.338), 0.836, -0.03], [x(0.338), 0.836, 0.036], 0.016, 0.016, [B['fing' + L]], { k: 0.018 });
    // leg: gaunt thigh with sinewy quad + hamstring, knob knee + kneecap, tight calf, tibia ridge, ankle bones
    cone([x(0.12), 1.22, 0], [x(0.12), 0.64, 0], 0.066, 0.038, [B['thigh' + L]]);
    ell([x(0.122), 0.98, 0.03], [0.054, 0.2, 0.048], [B['thigh' + L]], { k: 0.025 });
    ell([x(0.118), 0.95, -0.035], [0.048, 0.19, 0.042], [B['thigh' + L]], { k: 0.025 });
    sph([x(0.12), 0.645, 0], 0.043, [B['thigh' + L], B['shin' + L]], { seg: [[0, 0.70, 0], [0, 0.59, 0]] });
    sph([x(0.12), 0.665, 0.04], 0.03, [B['thigh' + L]], { k: 0.02 });
    cone([x(0.12), 0.64, 0], [x(0.12), 0.10, 0], 0.037, 0.022, [B['shin' + L]]);
    ell([x(0.12), 0.46, -0.035], [0.042, 0.13, 0.04], [B['shin' + L]], { k: 0.025 });
    cone([x(0.12), 0.60, 0.03], [x(0.12), 0.14, 0.02], 0.013, 0.011, [B['shin' + L]], { k: 0.02 });
    sph([x(0.12) + 0.024, 0.10, 0], 0.019, [B['foot' + L]], { k: 0.02 });
    sph([x(0.12) - 0.024, 0.10, 0], 0.019, [B['foot' + L]], { k: 0.02 });
    sph([x(0.12), 0.048, -0.035], 0.042, [B['foot' + L]]);
    cone([x(0.12), 0.06, -0.02], [x(0.12), 0.03, 0.15], 0.036, 0.026, [B['foot' + L], B['toes' + L]], { seg: [[0, 0, 0.11], [0, 0, 0.16]] });
    ell([x(0.12), 0.028, 0.135], [0.05, 0.025, 0.04], [B['toes' + L]], { k: 0.02 });
  }
  return P;
}

// polynomial smooth min / max
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);

function primDist(p, x, y, z) {
  const px = x - p.ax, py = y - p.ay, pz = z - p.az;
  if (p.t === 0) {
    let h = (px * p.bx + py * p.by + pz * p.bz) * p.abl; h = h < 0 ? 0 : h > 1 ? 1 : h;
    const dx = px - p.bx * h, dy = py - p.by * h, dz = pz - p.bz * h;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (p.ra + (p.rb - p.ra) * h);
  }
  if (p.t === 2) return Math.sqrt(px * px + py * py + pz * pz) - p.ra;
  const qx = px / p.rx, qy = py / p.ry, qz = pz / p.rz, k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  const sx = qx / p.rx, sy = qy / p.ry, sz = qz / p.rz, k1 = Math.sqrt(sx * sx + sy * sy + sz * sz);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(p.rx, p.ry, p.rz);
}
const inBox = (p, x, y, z, m) => x > p.x0 - m && x < p.x1 + m && y > p.y0 - m && y < p.y1 + m && z > p.z0 - m && z < p.z1 + m;

// field over a pre-culled primitive list (list built with gather() around the query point)
function field(L, n, x, y, z) {
  let d = 0.25;
  for (let i = 0; i < n; i++) { const p = L[i]; if (!p.sub) d = smin(d, primDist(p, x, y, z), p.k); }
  for (let i = 0; i < n; i++) { const p = L[i]; if (p.sub) d = smax(d, -primDist(p, x, y, z), p.k); }
  return d;
}
function gather(P, out, x, y, z, m) { let n = 0; for (let i = 0; i < P.length; i++) if (inBox(P[i], x, y, z, m)) out[n++] = P[i]; return n; }

// cheap deterministic 3D value noise for the mottling
const hash = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash(ix, iy, iz), hash(ix + 1, iy, iz), ux), l(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), ux), uy),
    l(l(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), ux), l(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), ux), uy), uz);
}

// fingers + toes: tapered tubes ending in hooked claws (bind space)
function claws() {
  const out = [];
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', x0 = 0.338 * s;
    const zs = [-0.028, -0.009, 0.011, 0.031], lens = [0.205, 0.245, 0.255, 0.225];
    for (let f = 0; f < 4; f++) {
      const z = zs[f], l = lens[f], y0 = 0.836;
      const path = [[x0, y0 + 0.01, z], [x0 - s * 0.006, y0 - 0.38 * l, z * 1.12], [x0 - s * 0.018, y0 - 0.7 * l, z * 1.2], [x0 - s * 0.034, y0 - 0.93 * l, z * 1.18], [x0 - s * 0.05, y0 - l, z * 1.1]];
      out.push({ geo: tube(path, fingerR, { radial: 8, curve: true, samples: 16 }), b0: BI['hand' + L], b1: BI['fing' + L], split: 0.16 });
    }
    const thumb = [[x0 - s * 0.01, 0.912, 0.034], [x0 - s * 0.02, 0.87, 0.058], [x0 - s * 0.03, 0.815, 0.07], [x0 - s * 0.042, 0.775, 0.068]];
    out.push({ geo: tube(thumb, fingerR, { radial: 8, curve: true, samples: 12 }), b0: BI['hand' + L], b1: BI['hand' + L], split: 1 });
    for (let t = 0; t < 3; t++) {
      const dx = (t - 1) * 0.026 * s, fx = 0.12 * s + dx, len = t === 1 ? 0.15 : 0.12;
      const path = [[fx, 0.03, 0.135], [fx + dx * 0.4, 0.026, 0.135 + len * 0.45], [fx + dx * 0.7, 0.018, 0.135 + len * 0.85], [fx + dx * 0.8, 0.004, 0.135 + len]];
      out.push({ geo: tube(path, toeR, { radial: 8, curve: true, samples: 10 }), b0: BI['toes' + L], b1: BI['toes' + L], split: 1 });
    }
    // teeth: a row of needle fangs down each side of the snout (head bone) and up each side of the jaw (jaw bone),
    // longest mid-row, raked back; they clear each other with the jaw shut and bare when it hangs open
    for (let i = 0; i < 6; i++) {
      const z = 0.075 + i * 0.022, u = (z - 0.05) / 0.15, ay = 2.195 - 0.085 * u, r = 0.046 - 0.024 * u;
      const tx = s * r * 0.55, ty = ay - r * 0.8, len = 0.02 + 0.014 * (1 - Math.abs(u - 0.45) * 2);
      const path = [[tx, ty + 0.006, z], [tx * 0.96, ty - len * 0.5, z + 0.002], [tx * 0.9, ty - len, z - 0.005]];
      out.push({ geo: tube(path, toothR, { radial: 6, curve: true, samples: 5 }), b0: BI.head, b1: BI.head, split: 1, tooth: 1 });
    }
    for (let i = 0; i < 5; i++) {
      const z = 0.06 + i * 0.026, u = z / 0.19, ay = 2.10 - 0.07 * u, r = 0.04 - 0.022 * u;
      const tx = s * r * 0.55, ty = ay + r * 0.8, len = 0.017 + 0.01 * (1 - Math.abs(u - 0.5) * 2);
      const path = [[tx, ty - 0.006, z], [tx * 0.96, ty + len * 0.5, z + 0.002], [tx * 0.9, ty + len, z - 0.004]];
      out.push({ geo: tube(path, toothR, { radial: 6, curve: true, samples: 5 }), b0: BI.jaw, b1: BI.jaw, split: 1, tooth: 1 });
    }
  }
  return out;
}
// radius along the finger: knuckle bumps at the phalanx joints, a hooked claw over the last 14 %
function fingerR(t) {
  if (t > 0.86) { const u = (t - 0.86) / 0.14; return 0.0105 * (1 - u) * (1 - u * 0.3) + 0.0008; }
  return 0.0128 - 0.0035 * t + 0.0017 * Math.exp(-(((t - 0.36) / 0.05) ** 2)) + 0.0015 * Math.exp(-(((t - 0.66) / 0.05) ** 2));
}
function toothR(t) { return 0.0042 * (1 - t) + 0.0004; }
function toeR(t) {
  if (t > 0.7) { const u = (t - 0.7) / 0.3; return 0.013 * (1 - u) + 0.0008; }
  return 0.0145 - 0.002 * t;
}

export function buildSculpt() {
  const t0 = performance.now();
  const P = makePrims(), GL = new Array(P.length);
  let gn = 0;
  const F = (x, y, z) => field(GL, gn, x, y, z);
  const nx = Math.ceil((BOX.x1 - BOX.x0) / VOX) + 1, ny = Math.ceil((BOX.y1 - BOX.y0) / VOX) + 1, nz = Math.ceil((BOX.z1 - BOX.z0) / VOX) + 1;
  const D = new Float32Array(nx * ny * nz);
  // 4³-voxel blocks: one field sample at the block centre decides whether the block can be filled as far air /
  // deep inside; only blocks near the surface evaluate every voxel (over the primitives gathered for the block)
  const BS = 4, half = BS * 0.5 * VOX * 1.7321, far = half + VOX * 1.5;
  for (let bk = 0; bk < nz; bk += BS) for (let bj = 0; bj < ny; bj += BS) for (let bi = 0; bi < nx; bi += BS) {
    const cx = BOX.x0 + (bi + BS * 0.5 - 0.5) * VOX, cy = BOX.y0 + (bj + BS * 0.5 - 0.5) * VOX, cz = BOX.z0 + (bk + BS * 0.5 - 0.5) * VOX;
    gn = gather(P, GL, cx, cy, cz, half + 0.01);
    const dc = gn ? F(cx, cy, cz) : 0.25, exact = Math.abs(dc) < far;
    for (let k = bk; k < Math.min(nz, bk + BS); k++) for (let j = bj; j < Math.min(ny, bj + BS); j++) {
      const o = nx * (j + ny * k), y = BOX.y0 + j * VOX, z = BOX.z0 + k * VOX;
      for (let i = bi; i < Math.min(nx, bi + BS); i++) D[o + i] = exact ? -F(BOX.x0 + i * VOX, y, z) : -(dc - Math.sign(dc) * half);
    }
  }
  const sn = surfaceNets(D, nx, ny, nz);
  const nv = sn.nv, pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3);
  const e = 0.003;
  for (let v = 0; v < nv; v++) {
    let x = BOX.x0 + sn.pos[v * 3] * VOX, y = BOX.y0 + sn.pos[v * 3 + 1] * VOX, z = BOX.z0 + sn.pos[v * 3 + 2] * VOX;
    let gx = 0, gy = 1, gz = 0;
    gn = gather(P, GL, x, y, z, 0.02);
    for (let it = 0; it < 3; it++) { // project onto the exact surface along the gradient
      gx = F(x + e, y, z) - F(x - e, y, z); gy = F(x, y + e, z) - F(x, y - e, z); gz = F(x, y, z + e) - F(x, y, z - e);
      const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
      if (it < 2) { const d = F(x, y, z); x -= gx * d; y -= gy * d; z -= gz * d; }
    }
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; nrm[v * 3] = gx; nrm[v * 3 + 1] = gy; nrm[v * 3 + 2] = gz;
  }
  // winding: make triangle normals agree with the SDF gradient
  let idx = sn.idx, agree = 0;
  for (let t = 0; t < Math.min(idx.length, 3000); t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    agree += (uy * vz - uz * vy) * nrm[a] + (uz * vx - ux * vz) * nrm[a + 1] + (ux * vy - uy * vx) * nrm[a + 2];
  }
  if (agree < 0) { idx = idx.slice(); for (let t = 0; t < idx.length; t += 3) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; } }

  // ---- merge the claw tubes -------------------------------------------------------------------------------
  const tubes = claws();
  let tv = 0, ti = 0;
  for (const c of tubes) { tv += c.geo.attributes.position.count; ti += c.geo.index.count; }
  const NV = nv + tv, P3 = new Float32Array(NV * 3), N3 = new Float32Array(NV * 3), I = new Uint32Array(idx.length + ti);
  P3.set(pos); N3.set(nrm); I.set(idx);
  const SI = new Uint16Array(NV * 4), SW = new Float32Array(NV * 4), COL = new Float32Array(NV * 3), SK = new Float32Array(NV * 4);
  let vo = nv, io = idx.length;
  for (const c of tubes) {
    const gp = c.geo.attributes.position, gn = c.geo.attributes.normal, gi = c.geo.index, n = gp.count;
    // arc parameter of each vertex ≈ distance from the first ring / total length
    const x0 = gp.getX(0), y0 = gp.getY(0), z0 = gp.getZ(0); let maxd = 1e-6;
    for (let v = 0; v < n; v++) maxd = Math.max(maxd, Math.hypot(gp.getX(v) - x0, gp.getY(v) - y0, gp.getZ(v) - z0));
    for (let v = 0; v < n; v++) {
      const o = vo + v, x = gp.getX(v), y = gp.getY(v), z = gp.getZ(v);
      P3[o * 3] = x; P3[o * 3 + 1] = y; P3[o * 3 + 2] = z;
      N3[o * 3] = gn.getX(v); N3[o * 3 + 1] = gn.getY(v); N3[o * 3 + 2] = gn.getZ(v);
      const t = Math.hypot(x - x0, y - y0, z - z0) / maxd, w1 = Math.min(1, Math.max(0, (t - c.split * 0.5) / (c.split || 1)));
      SI[o * 4] = c.b0; SI[o * 4 + 1] = c.b1; SW[o * 4] = 1 - w1; SW[o * 4 + 1] = w1;
      const claw = c.tooth || t > 0.84 ? 1 : 0;
      const ao = 0.82 + 0.18 * t;
      COL[o * 3] = ao * (claw ? 0.62 : 1); COL[o * 3 + 1] = ao * (claw ? 0.58 : 1); COL[o * 3 + 2] = ao * (claw ? 0.55 : 1);
      SK[o * 4] = 0; SK[o * 4 + 1] = 0.72; SK[o * 4 + 2] = claw; SK[o * 4 + 3] = ao * 0.9;
    }
    for (let i = 0; i < gi.count; i++) I[io + i] = gi.getX(i) + vo;
    vo += n; io += gi.count;
  }

  // ---- body vertex bakes: skin weights, AO, mottling, frost, thinness ----------------------------------------
  const wb = new Float32Array(32), AL = new Array(P.length), AD = new Float32Array(P.length);
  for (let v = 0; v < nv; v++) {
    const x = P3[v * 3], y = P3[v * 3 + 1], z = P3[v * 3 + 2], gx = N3[v * 3], gy = N3[v * 3 + 1], gz = N3[v * 3 + 2];
    wb.fill(0);
    gn = gather(P, GL, x, y, z, 0.1);
    let dmin = 1e9;
    // the primitives gathered around the vertex (adds only), distances cached for the weight pass
    let na = 0;
    for (let i = 0; i < gn; i++) { const p = GL[i]; if (p.sub || !inBox(p, x, y, z, 0)) continue; const d = primDist(p, x, y, z); AL[na] = p; AD[na++] = d; if (d < dmin) dmin = d; }
    for (let i = 0; i < na; i++) {
      const p = AL[i];
      const f = Math.exp(-(AD[i] - dmin) / 0.016);
      if (p.bones.length > 1) {
        let h = ((x - p.sa[0]) * p.sd[0] + (y - p.sa[1]) * p.sd[1] + (z - p.sa[2]) * p.sd[2]) * p.sl; h = h < 0 ? 0 : h > 1 ? 1 : h;
        h = h * h * (3 - 2 * h);
        wb[p.bones[0]] += f * (1 - h); wb[p.bones[1]] += f * h;
      } else wb[p.bones[0]] += f;
    }
    // top 4
    let tot = 0;
    for (let s = 0; s < 4; s++) {
      let bi = 0, bw = -1; for (let b = 0; b < 32; b++) if (wb[b] > bw) { bw = wb[b]; bi = b; }
      SI[v * 4 + s] = bi; SW[v * 4 + s] = Math.max(0, bw); tot += Math.max(0, bw); wb[bi] = -1;
    }
    for (let s = 0; s < 4; s++) SW[v * 4 + s] /= tot || 1;
    // AO: how open the surface is 3 cm and 9 cm out along the normal
    const o1 = Math.min(1, Math.max(0, F(x + gx * 0.03, y + gy * 0.03, z + gz * 0.03) / 0.03));
    const o2 = Math.min(1, Math.max(0, F(x + gx * 0.09, y + gy * 0.09, z + gz * 0.09) / 0.09));
    const ao = 0.25 + 0.75 * Math.pow(o1 * 0.45 + o2 * 0.55, 1.3);
    // thinness: still inside 4 cm under the surface → thick
    const th = Math.min(1, Math.max(0, -F(x - gx * 0.04, y - gy * 0.04, z - gz * 0.04) / 0.03));
    // mottling: bruised blue-violet patches + paler stretched skin over bone (the joints and ribs read)
    const m = vnoise(x * 9, y * 9, z * 9) * 0.6 + vnoise(x * 23 + 5, y * 23, z * 23) * 0.4;
    const bruise = Math.max(0, m - 0.55) * 2.2;
    const r = ao * (0.92 + 0.22 * m - 0.05 * bruise), g = ao * (0.92 + 0.2 * m - 0.12 * bruise), b = ao * (0.95 + 0.22 * m + 0.08 * bruise);
    COL[v * 3] = r; COL[v * 3 + 1] = g; COL[v * 3 + 2] = b;
    // frost: faces that point up once the torso stoops ~35° (upper back, shoulders, skull, the top of the arms)
    const su = y > 1.55 ? gy * 0.82 - gz * 0.57 : gy;
    const zone = Math.min(1, Math.max(0, (y - 1.62) / 0.2)) + (y < 0.2 ? 0.0 : 0);
    const fr = Math.min(1, Math.max(0, (su - 0.25) / 0.45)) * zone * (0.55 + 0.9 * vnoise(x * 31, y * 31, z * 31));
    SK[v * 4] = Math.min(1, fr); SK[v * 4 + 1] = 1 - th; SK[v * 4 + 2] = 0; SK[v * 4 + 3] = ao;
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(P3, 3));
  geo.setAttribute('normal', new BufferAttribute(N3, 3));
  geo.setAttribute('color', new BufferAttribute(COL, 3));
  geo.setAttribute('aSkin', new BufferAttribute(SK, 4));
  geo.setAttribute('skinIndex', new BufferAttribute(SI, 4));
  geo.setAttribute('skinWeight', new BufferAttribute(SW, 4));
  geo.setIndex(new BufferAttribute(I, 1));
  for (const c of tubes) c.geo.dispose();
  return { geometry: geo, tris: I.length / 3, ms: performance.now() - t0 };
}
