// Held-torch view-model geometry (load-time only): a 27 cm aluminium work torch (rubber tail boot, grooved tail cap,
// knurled body with grip rings, pocket clip, lanyard ring, tapered neck, finned head, stainless crenellated bezel,
// faceted reflector + LED die) gripped by an insulated winter glove (back-of-hand shell with knuckle pad, four curled
// fingers with joint creases and leather tips, thumb over the top toward the switch, gauntlet with a velcro strap)
// and the parka sleeve with a reflective band and a knit inner cuff.
// Everything is merged into ONE indexed geometry with attributes position / normal / color (linear albedo) /
// pbr (roughness, metalness, emissive weight, surface kind) / dig (finger + thumb uv: flag+length, 0..1 along) so the whole view model is a single draw call.
// Frame: torch axis along -Z (lens forward), +X right, +Y up, origin at the middle of the grip.
// Surface kinds (viewmodel.js shader): 0 plain, 1 knurl, 2 glove shell, 3 knit, 4 nylon sleeve, 5 rubber, 6 leather.
//   buildTorchGeometry() → { geometry, lensZ, tris }
import {
  BufferGeometry, BufferAttribute, Matrix4, Quaternion, Vector3, SphereGeometry, TorusGeometry,
} from 'three';
import { lathe, roundedBox, tube, normalizeGeo } from '../../cookbook/geo/kit.js';

const Y = new Vector3(0, 1, 0);
const TORCH_Y0 = 0.135;            // lathe y of the grip middle (moved to the origin)
export const LENS_Y = 0.262;

function hash(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

class Parts {
  constructor() { this.list = []; }
  // add a geometry with a transform, a linear colour [r,g,b] (or fn(x,y,z) → [r,g,b] in final space) and pbr
  add(geo, m, color, pbr) {
    normalizeGeo(geo);
    if (m) geo.applyMatrix4(m);
    const n = geo.attributes.position.count, P = geo.attributes.position.array;
    const C = new Float32Array(n * 3), B = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const c = typeof color === 'function' ? color(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], i) : color;
      C[i * 3] = c[0]; C[i * 3 + 1] = c[1]; C[i * 3 + 2] = c[2];
      B[i * 4] = pbr[0]; B[i * 4 + 1] = pbr[1]; B[i * 4 + 2] = pbr[2]; B[i * 4 + 3] = pbr[3];
    }
    geo.setAttribute('color', new BufferAttribute(C, 3));
    this.list.push({ geo, pbr: B });
    return this;
  }
  merge() {
    let nv = 0, ni = 0;
    for (const { geo } of this.list) { nv += geo.attributes.position.count; ni += geo.index.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), B = new Float32Array(nv * 4);
    const UV = new Float32Array(nv * 2), I = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const { geo, pbr } of this.list) {
      const c = geo.attributes.position.count;
      P.set(geo.attributes.position.array, ov * 3); N.set(geo.attributes.normal.array, ov * 3);
      C.set(geo.attributes.color.array, ov * 3); B.set(pbr, ov * 4);
      if (geo.userData.vmUv) UV.set(geo.attributes.uv.array, ov * 2);  // only parts that author a shader uv keep it
      const ix = geo.index.array; for (let k = 0; k < ix.length; k++) I[oi + k] = ix[k] + ov;
      ov += c; oi += ix.length;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(P, 3)); g.setAttribute('normal', new BufferAttribute(N, 3));
    g.setAttribute('color', new BufferAttribute(C, 3)); g.setAttribute('pbr', new BufferAttribute(B, 4));
    g.setAttribute('dig', new BufferAttribute(UV, 2));   // digit uv (viewmodel.js glove detail), 0 elsewhere
    g.setIndex(new BufferAttribute(I, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return { geometry: g, tris: ni / 3 };
  }
}

// lathe profile [[r, y]] (y along the torch from the tail) → torch frame (axis -Z, grip middle at the origin)
const TORCH_M = new Matrix4().makeRotationX(-Math.PI / 2).multiply(new Matrix4().makeTranslation(0, -TORCH_Y0, 0));
const torchM = (extra) => (extra ? TORCH_M.clone().multiply(extra) : TORCH_M);
// matrix placing a +Y-built part at `at`, its +Y along `dir`
function along(at, dir) {
  const q = new Quaternion().setFromUnitVectors(Y, new Vector3(...dir).normalize());
  return new Matrix4().compose(new Vector3(...at), q, new Vector3(1, 1, 1));
}

// ---------------- palette (linear) ----------------
const ANOD = [0.032, 0.034, 0.038], ANOD_WORN = [0.42, 0.42, 0.43], STEEL = [0.56, 0.55, 0.53], RUBBER = [0.022, 0.022, 0.024];
const GLOVE = [0.085, 0.086, 0.08], GLOVE_PAD = [0.115, 0.11, 0.1], LEATHER = [0.2, 0.135, 0.085], VELCRO = [0.018, 0.018, 0.02];
const SLEEVE = [0.17, 0.04, 0.012], STRIPE = [0.5, 0.52, 0.5], KNIT = [0.035, 0.036, 0.04];
//                               rough  metal  emis  kind
const P_ANOD = [0.38, 1, 0, 0], P_KNURL = [0.45, 1, 0, 1], P_STEEL = [0.24, 1, 0, 0], P_RUBBER = [0.82, 0, 0, 5];
const P_REFL = [0.06, 1, 0.35, 0], P_LED = [0.3, 0, 1, 0], P_GLOVE = [0.78, 0, 0, 2], P_LEATHER = [0.55, 0, 0, 6];
const P_SLEEVE = [0.62, 0, 0, 4], P_STRIPE = [0.35, 0.2, 0, 0], P_KNIT = [0.95, 0, 0, 3], P_VELCRO = [0.95, 0, 0, 2];

function torch(T) {
  // tail boot button (rubber dome)
  T.add(lathe([[0, -0.006], [0.006, -0.0058], [0.0095, -0.0042], [0.0108, -0.001], [0.011, 0.002]], { seg: 28 }), torchM(), RUBBER, P_RUBBER);
  // tail cap: grooved, worn edges
  const tail = [[0.011, 0.002], [0.0172, 0.0], [0.0184, 0.0015], [0.0186, 0.006], [0.0178, 0.0068], [0.0178, 0.0085], [0.0186, 0.0093],
    [0.0186, 0.0135], [0.0178, 0.0143], [0.0178, 0.016], [0.0186, 0.0168], [0.0186, 0.026], [0.0181, 0.029], [0.0172, 0.031]];
  T.add(lathe(tail, { seg: 40 }), torchM(), (x, y, z) => (Math.hypot(x, y) > 0.0185 ? ANOD_WORN : ANOD), P_ANOD);
  // knurled body (+ thin bevel lips), grip rings
  T.add(lathe([[0.0172, 0.031], [0.0167, 0.033], [0.0167, 0.149], [0.0172, 0.151]], { seg: 48 }), torchM(), ANOD, P_KNURL);
  for (const y of [0.038, 0.143]) {
    T.add(lathe([[0.0167, y - 0.003], [0.0178, y - 0.0024], [0.0181, y], [0.0178, y + 0.0024], [0.0167, y + 0.003]], { seg: 48 }), torchM(),
      (x, yy, z) => (Math.hypot(x, yy) > 0.018 ? ANOD_WORN : ANOD), P_ANOD);
  }
  // neck taper → finned head
  const head = [[0.0172, 0.151], [0.0176, 0.158], [0.0205, 0.172], [0.025, 0.188], [0.0285, 0.196], [0.0302, 0.199]];
  let y = 0.2;
  for (let k = 0; k < 5; k++) { head.push([0.0302, y + 0.0055], [0.0286, y + 0.006], [0.0278, y + 0.0068], [0.0278, y + 0.0082], [0.0286, y + 0.009], [0.0302, y + 0.0095]); y += 0.0095; }
  head.push([0.0302, 0.2495], [0.0296, 0.2505]);
  T.add(lathe(head, { seg: 48 }), torchM(), (x, yy, z) => (Math.hypot(x, yy) > 0.0301 ? [0.07, 0.07, 0.075] : ANOD), P_ANOD);
  // stainless bezel ring
  T.add(lathe([[0.0296, 0.2505], [0.031, 0.2515], [0.0313, 0.254], [0.0313, 0.2635], [0.0305, 0.2655], [0.0288, 0.2665], [0.0272, 0.266], [0.0266, 0.263]], { seg: 48 }), torchM(), STEEL, P_STEEL);
  // crenellations (6 rounded teeth on the strike bezel)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26, r = 0.0292;
    const m = new Matrix4().compose(new Vector3(Math.sin(a) * r, 0.2685, Math.cos(a) * r), new Quaternion().setFromAxisAngle(Y, a), new Vector3(1, 1, 1));
    T.add(roundedBox(0.0085, 0.0045, 0.0034, 0.0012, 2, 1), torchM(m), STEEL, P_STEEL);
  }
  // reflector bowl (concave, mirror, faintly glowing) + LED die + glass rim
  const refl = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10, r = 0.0045 + 0.0221 * t; refl.push([r, 0.2465 + 0.0165 * t * t]); }
  refl.reverse(); // inner surface faces the axis: reversed profile flips the lathe normals inward
  T.add(lathe(refl, { seg: 40, crease: 80 }), torchM(), [0.75, 0.74, 0.72], P_REFL);
  T.add(roundedBox(0.0042, 0.0016, 0.0042, 0.0005, 1, 1), torchM(new Matrix4().makeTranslation(0, 0.2468, 0)), [0.9, 0.78, 0.3], P_LED);
  T.add(lathe([[0.0045, 0.2462], [0.0, 0.2462]], { seg: 20 }), torchM(), [0.02, 0.02, 0.02], [0.4, 0, 0, 0]);
  // glass lens edge: the light piped through the glass rim glows between the strike teeth (the lens glint seen
  // from behind the torch; bloom spreads it), plus a hot inner lip
  T.add(new TorusGeometry(0.0272, 0.0013, 8, 48), torchM(new Matrix4().compose(new Vector3(0, 0.2652, 0),
    new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2), new Vector3(1, 1, 1))), [0.9, 0.88, 0.84], [0.08, 0, 0.9, 0]);
  T.add(lathe([[0.0262, 0.2628], [0.0268, 0.2645], [0.0272, 0.2662]], { seg: 48 }), torchM(), [0.9, 0.9, 0.88], [0.1, 0, 0.6, 0]);
  // pocket clip on the left flank (strip + tail loop) and lanyard ring
  const clipM = new Matrix4().compose(new Vector3(-0.0193, 0.068, 0), new Quaternion(), new Vector3(1, 1, 1));
  T.add(roundedBox(0.0016, 0.07, 0.0062, 0.0006, 2, 0.02), torchM(clipM), STEEL, [0.3, 1, 0, 0]);
  T.add(roundedBox(0.0036, 0.006, 0.0066, 0.0012, 2, 1), torchM(new Matrix4().makeTranslation(-0.0185, 0.104, 0)), STEEL, [0.3, 1, 0, 0]);
  T.add(roundedBox(0.003, 0.009, 0.0066, 0.0011, 2, 1), torchM(new Matrix4().makeTranslation(-0.0182, 0.031, 0)), ANOD, P_ANOD);
  const ring = new TorusGeometry(0.0055, 0.0011, 8, 24);
  T.add(ring, torchM(new Matrix4().compose(new Vector3(0.0, -0.002, 0.0175), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2), new Vector3(1, 1, 1))), STEEL, [0.3, 1, 0, 0]);
}

// shader uv for a swept digit: x = flag + length (m) (flag 1 finger, 3 thumb), y = 0..1 from the root to the tip
function digitUv(geo, flag) {
  const UVa = geo.attributes.uv.array;
  let vmax = 1e-6; for (let i = 1; i < UVa.length; i += 2) vmax = Math.max(vmax, UVa[i]);
  for (let i = 0; i < UVa.length; i += 2) { UVa[i + 1] /= vmax; UVa[i] = flag + vmax; }
  geo.userData.vmUv = true;
  return geo;
}

// a finger curled around the torch body in the plane z ≈ z0. The palm presses on the torch's right flank, so the
// knuckle (MCP) sits low on the right; the finger runs under the body and its tip curls up the upper-left side.
function finger(T, z0, { len = 1, r = 0.0112, rb = 0.0167, tilt = 0, seed = 0 }) {
  const deg = [-8, -44, -88, -132, -164, -186];
  const Rr = [0.043, rb + r + 0.0035, rb + r + 0.001, rb + r + 0.0006, rb + r + 0.0005, rb + r * 0.95];
  const n = len < 1 ? 5 : 6;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = ((deg[i] + (i === n - 1 && len < 1 ? 18 : 0)) * Math.PI) / 180;
    pts.push([Math.cos(a) * Rr[i], Math.sin(a) * Rr[i], z0 + tilt * i]);
  }
  // joint creases between phalanges, slight taper toward the tip
  // padded segments bulge between the joints, the fabric pinches at each crease (0.36 / 0.68 = vmglsl joints)
  const g = (t, c, w) => Math.exp(-((t - c) ** 2) / w);
  const rf = (t) => r * (1 - 0.13 * g(t, 0.36, 0.0012) - 0.12 * g(t, 0.68, 0.0012) + 0.05 * g(t, 0.2, 0.006) + 0.05 * g(t, 0.53, 0.005)
    + 0.04 * g(t, 0.85, 0.004) - 0.1 * t * t);
  // no caps: the root is buried in the hand shell, the tip under the leather cap sphere
  const geo = tube(pts, rf, { radial: 16, curve: true, samples: 40, caps: false });
  // shader uv: x = 1 + finger length (m) flags a finger, y = 0..1 along it (joint creases, seams, stitches)
  digitUv(geo, 1);
  // leather wraps the last phalanx (by angle around the torch axis: past ~-165° = the curled tip)
  T.add(geo, null, (x, y) => {
    let a = Math.atan2(y, x); if (a > 0.6) a -= Math.PI * 2;
    const v = 0.88 + 0.24 * hash(seed + Math.round(a * 30));
    return a < -2.85 ? LEATHER.map((c) => c * v) : GLOVE.map((c) => c * v);
  }, P_GLOVE);
  // fingertip: an ellipsoid stretched along the last phalanx (a rounded pad, not a ball on a stick)
  const last = pts[n - 1], prev = pts[n - 2], rt = rf(1) * 1.02;
  const td = new Vector3(last[0] - prev[0], last[1] - prev[1], last[2] - prev[2]).normalize();
  const tipM = new Matrix4().compose(new Vector3(...last).addScaledVector(td, -rt * 0.35), new Quaternion().setFromUnitVectors(Y, td),
    new Vector3(rt, rt * 1.45, rt * 0.94));
  T.add(new SphereGeometry(1, 16, 12), tipM, LEATHER, P_LEATHER);
  // moulded knuckle pad over the middle joint (seen from below/behind)
  const k = pts[1], kd = new Vector3(k[0], k[1], 0).normalize();
  T.add(roundedBox(0.013, 0.0055, 0.015, 0.0025, 2, 1), along([k[0] + kd.x * 0.0105, k[1] + kd.y * 0.0105, k[2]], [kd.x, kd.y, 0]), GLOVE_PAD, P_RUBBER);
}

// ellipsoid helper (scaled sphere; BufferGeometry.applyMatrix4 keeps the normals right)
function blob(T, at, scale, rotZ, color, pbr, seg = 20) {
  const m = new Matrix4().compose(new Vector3(...at), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rotZ), new Vector3(...scale));
  T.add(new SphereGeometry(1, seg, Math.round(seg * 0.75)), m, color, pbr);
}

function glove(T) {
  // fingers: index (front) → pinky (back), snug side by side
  finger(T, 0.0, { len: 1, r: 0.0112, seed: 1, tilt: -0.0006 });
  finger(T, 0.0228, { len: 1, r: 0.0117, seed: 7, tilt: -0.0003 });
  finger(T, 0.0452, { len: 1, r: 0.0112, seed: 13, tilt: 0.0002 });
  finger(T, 0.0654, { len: 0.8, r: 0.0098, seed: 21, tilt: 0.0006 });
  const shell = (x, y, z) => { const s = 0.9 + 0.2 * hash(Math.round(z * 260) + Math.round(y * 260) * 7); return GLOVE.map((c) => c * s); };
  // back of the hand: padded insulated shell on the right flank, rounded (ellipsoids, no box corners)
  blob(T, [0.041, 0.004, 0.034], [0.017, 0.034, 0.056], -0.25, shell, P_GLOVE, 24);
  blob(T, [0.05, -0.022, 0.05], [0.016, 0.03, 0.05], -0.5, shell, P_GLOVE, 20);
  // knuckle ridge (moulded protector along the MCP row)
  T.add(tube([[0.046, -0.012, -0.006], [0.049, -0.014, 0.03], [0.045, -0.016, 0.07]], 0.0072, { radial: 12, curve: true, samples: 12 }), null, GLOVE_PAD, P_RUBBER);
  // thumb: thenar mound on the upper right, then over the top of the body, tip on the upper-left beside the index
  blob(T, [0.03, 0.022, 0.058], [0.02, 0.017, 0.03], 0.4, GLOVE, P_GLOVE, 18);
  const tpts = [[0.036, 0.021, 0.074], [0.022, 0.029, 0.052], [0.009, 0.0302, 0.028], [0.002, 0.0298, 0.008], [-0.003, 0.0292, -0.01]];
  const trf = (t) => 0.0125 * (1 - 0.07 * Math.exp(-((t - 0.55) ** 2) / 0.003) - 0.14 * t * t);
  T.add(digitUv(tube(tpts, trf, { radial: 18, curve: true, samples: 34, caps: false }), 3), null, (x, y, z) => (z < 0.006 ? LEATHER : GLOVE), P_GLOVE);
  T.add(new SphereGeometry(trf(1) * 1.02, 14, 10), new Matrix4().makeTranslation(-0.003, 0.0292, -0.01), LEATHER, P_LEATHER);
  // heel of the palm under the pinky side
  blob(T, [0.03, -0.03, 0.078], [0.02, 0.018, 0.026], -0.6, LEATHER, P_LEATHER, 16);
  // gauntlet: insulated cuff past the wrist (toward the camera, lower right), velcro strap + tab
  const wrist = [0.052, -0.03, 0.112], fdir = [0.3, -0.36, 0.88];
  const gaunt = [[0.0, -0.004], [0.03, -0.004], [0.036, 0.004], [0.04, 0.03], [0.043, 0.062], [0.046, 0.074], [0.0445, 0.078], [0.04, 0.078]];
  T.add(lathe(gaunt, { seg: 36 }), along(wrist, fdir), (x, y, z) => { const s = 0.92 + 0.16 * hash(Math.round((x + y + z) * 200)); return GLOVE.map((c) => c * s); }, P_GLOVE);
  T.add(lathe([[0.0405, 0.03], [0.0422, 0.031], [0.0428, 0.034], [0.0435, 0.05], [0.0428, 0.053], [0.0412, 0.054]], { seg: 36 }), along(wrist, fdir), VELCRO, P_VELCRO);
  const fd = new Vector3(...fdir).normalize();
  const tabAt = new Vector3(...wrist).addScaledVector(fd, 0.042).add(new Vector3(0.03, 0.03, -0.006));
  T.add(roundedBox(0.02, 0.022, 0.006, 0.003, 2, 1), along(tabAt.toArray(), fdir), GLOVE_PAD, P_RUBBER);
  // knit inner cuff + parka sleeve (folds, reflective band)
  const sAt = new Vector3(...wrist).addScaledVector(fd, 0.07);
  T.add(lathe([[0.04, 0.0], [0.0435, 0.002], [0.0445, 0.016], [0.0425, 0.02]], { seg: 32 }), along(sAt.toArray(), fdir), KNIT, P_KNIT);
  const sl = [[0.046, 0.0], [0.053, 0.004]];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18, yy = 0.012 + t * 0.4;
    const fold = 0.0035 * Math.sin(t * 23 + 0.7) * Math.sin(t * 7.1) + 0.002 * Math.sin(t * 41);
    sl.push([0.054 + 0.03 * t + fold, yy]);
  }
  const bandY0 = 0.13, bandY1 = 0.16;
  T.add(lathe(sl, { seg: 40, crease: 60 }), along(sAt.toArray(), fdir), (x, y, z) => {
    const v = new Vector3(x, y, z).sub(sAt).dot(fd);
    return SLEEVE.map((c) => c * (0.92 + 0.12 * hash(Math.round(v * 120))));
  }, P_SLEEVE);
  // reflective band: a slightly raised ring with its own (retro-reflective) pbr
  const ring = [];
  for (let i = 0; i <= 4; i++) { const t = bandY0 + (bandY1 - bandY0) * (i / 4); const tt = (t - 0.012) / 0.4; ring.push([0.0555 + 0.03 * tt + 0.0014, t]); }
  T.add(lathe(ring, { seg: 40 }), along(sAt.toArray(), fdir), STRIPE, P_STRIPE);
}

export function buildTorchGeometry() {
  const T = new Parts();
  torch(T);
  glove(T);
  const { geometry, tris } = T.merge();
  return { geometry, tris, lensZ: -(LENS_Y - TORCH_Y0) };
}
