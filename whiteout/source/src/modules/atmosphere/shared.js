// Shared pieces of the blizzard: the analytic gust curve (JS + GLSL twins, so particles can read the gust at their
// birth time and plumes grow/die coherently), the flashlight-spot uniforms + GLSL every particle layer is lit by,
// the shelter boxes (enterable / roofed spaces where no flake may exist) and small GLSL helpers.
import { Vector2, Vector3, Vector4, Color } from 'three';
import { LAYOUT as L } from '../../contracts.js';

const TAU = Math.PI * 2;
// Gust curve 0..1: a frequency-modulated sine (period wanders ~20-30 s), shaped so calm dominates and the gust
// front is fairly sharp, plus a slow amplitude wobble and a little flutter while it blows.
export function gustAt(t) {
  const ph = t * (TAU / 24) + 0.69 * Math.sin(t * (TAU / 83));
  const s = Math.sin(ph);
  const e = Math.min(1, Math.max(0, (s + 0.1) / 1.05));
  const k = e * e * (3 - 2 * e);
  const g = k * k * (0.8 + 0.2 * Math.sin(t * 0.41 + 1.3)) + 0.07 * Math.sin(t * 1.9) * k;
  return Math.min(1, Math.max(0, g));
}
export const GUST_GLSL = /*glsl*/`
float gustAt(float t) {
  float ph = t * 0.261799 + 0.69 * sin(t * 0.075701);
  float s = sin(ph);
  float k = smoothstep(-0.1, 0.95, s);
  float g = k * k * (0.8 + 0.2 * sin(t * 0.41 + 1.3)) + 0.07 * sin(t * 1.9) * k;
  return clamp(g, 0.0, 1.0);
}
`;

// Flashlight spot as seen by particles: position, direction, (cosOuter, cosInner, range, gain), colour × intensity.
export function createSpot() {
  return {
    uSpP: { value: new Vector3(0, -100, 0) }, uSpD: { value: new Vector3(0, 0, -1) },
    uSpK: { value: new Vector4(0.9, 0.95, 38, 0) }, uSpCol: { value: new Color(0, 0, 0) },
  };
}
const _d = new Vector3();
// copy the flashlight SpotLight into the uniforms (allocation-free); off / missing → zero colour
export function syncSpot(S, light) {
  const k = S.uSpK.value;
  if (!light || !light.visible || light.intensity < 1) { S.uSpCol.value.setRGB(0, 0, 0); k.w = 0; return; }
  S.uSpP.value.copy(light.position);
  _d.copy(light.target.position).sub(light.position);
  if (_d.lengthSq() > 1e-8) S.uSpD.value.copy(_d.normalize());
  k.x = Math.cos(light.angle); k.y = Math.cos(light.angle * (1 - light.penumbra)); k.z = light.distance; k.w = 1;
  S.uSpCol.value.copy(light.color).multiplyScalar(light.intensity);
}
export const SPOT_GLSL = /*glsl*/`
uniform vec3 uSpP;
uniform vec3 uSpD;
uniform vec4 uSpK;
uniform vec3 uSpCol;
// irradiance of the flashlight at p (cd / d^2, cone with penumbra, three's range window)
vec3 spotIrr(vec3 p) {
  if (uSpK.w < 0.5) return vec3(0.0);
  vec3 v = p - uSpP;
  float d2 = max(dot(v, v), 0.09);
  float d = sqrt(d2);
  float cone = smoothstep(uSpK.x, uSpK.y, dot(v / d, uSpD));
  float rw = uSpK.z > 0.0 ? clamp(1.0 - pow(d / uSpK.z, 4.0), 0.0, 1.0) : 1.0;
  return uSpCol * (cone * rw * rw / d2);
}
`;

// Roofed / enterable spaces (mirrors station zones + lean-tos): flakes are culled inside them so nothing falls
// through a roof, while the snow outside the door keeps falling. [minX,minY,minZ, maxX,maxY,maxZ]
export function shelterBoxes() {
  const out = [];
  const rect = (c, s, y1, pad = 0.15) => out.push([c[0] - s[0] / 2 - pad, -2, c[1] - s[1] / 2 - pad, c[0] + s[0] / 2 + pad, y1, c[1] + s[1] / 2 + pad]);
  const lab = L.modules.find((m) => m.interior);
  if (lab) rect(lab.c, lab.size, lab.floor + lab.h + 0.3);
  rect(L.shed.c, L.shed.size, L.shed.h + 0.25);
  rect(L.radioHut.c, L.radioHut.size, L.radioHut.h + 0.3);
  for (const g of L.generators) rect(g.c, [5, 4], 2.95, 0.1);
  return out; // 6 boxes
}
export const SHELTER_N = 6;
export const SHELTER_GLSL = /*glsl*/`
uniform vec3 uShMin[6];
uniform vec3 uShMax[6];
float sheltered(vec3 p) {
  for (int i = 0; i < 6; i++) {
    if (all(greaterThan(p, uShMin[i])) && all(lessThan(p, uShMax[i]))) return 1.0;
  }
  return 0.0;
}
`;
export function shelterUniforms() {
  const b = shelterBoxes(), mn = [], mx = [];
  for (let i = 0; i < SHELTER_N; i++) {
    const r = b[i] || [1e5, 1e5, 1e5, 1e5 + 1, 1e5 + 1, 1e5 + 1];
    mn.push(new Vector3(r[0], r[1], r[2])); mx.push(new Vector3(r[3], r[4], r[5]));
  }
  return { uShMin: { value: mn }, uShMax: { value: mx } };
}

// Roof lee edges for the gust plumes: snow scoured off a flat roof peels off the downwind edges.
// Each entry [x0, z0, x1, z1, y, nx, nz, weight] (n = outward normal of the edge, pointing downwind-ish).
export function roofEdges(wind) {
  const wl = Math.hypot(wind[0], wind[2]) || 1, wx = wind[0] / wl, wz = wind[2] / wl;
  const roofs = [];
  for (const m of L.modules) roofs.push([m.c, m.size, (m.floor ?? 0.3) + m.h + 0.26]);
  roofs.push([L.shed.c, L.shed.size, L.shed.h + 0.2]);
  roofs.push([L.radioHut.c, L.radioHut.size, L.radioHut.h + 0.1]);
  for (const g of L.generators) roofs.push([g.c, [5, 4], 2.95]);
  const edges = [];
  for (const [c, s, y] of roofs) {
    const x0 = c[0] - s[0] / 2, x1 = c[0] + s[0] / 2, z0 = c[1] - s[1] / 2, z1 = c[1] + s[1] / 2;
    if (Math.abs(wx) > 0.05) { const x = wx > 0 ? x1 : x0; edges.push([x, z0, x, z1, y, Math.sign(wx), 0, s[1] * Math.abs(wx)]); }
    if (Math.abs(wz) > 0.05) { const z = wz > 0 ? z1 : z0; edges.push([x0, z, x1, z, y, 0, Math.sign(wz), s[0] * Math.abs(wz)]); }
  }
  return edges;
}

// 2D/3D value noise + hash shared by the sheet and particle shaders
export const NOISE_GLSL = /*glsl*/`
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), u.x), mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), u.x), u.y);
  float b = mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), u.x), mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), u.x), u.y);
  return mix(a, b, u.z);
}
`;

// Work-light floodlights as seen by the blizzard: flakes and the blowing snow catch their light (cd / d², downward
// cone) and the fullscreen sheet pass adds their single-scatter airlight (closed-form ∫ 1/d² along the view ray,
// cone weight at 3 taps, snow-noise modulated): that is the volumetric beam + halo around each lamp head.
export const LAMP_N = 4;
export function createLamps(G) {
  const P = [], C = [];
  for (let i = 0; i < LAMP_N; i++) { P.push(new Vector4(0, -100, 0, 0)); C.push(new Color(0, 0, 0)); }
  const u = { uLampP: { value: P }, uLampC: { value: C },
    uLampAxis: { value: new Vector3(0, -1, 0.3).normalize() }, uLampCone: { value: new Vector2(0.42, 0.86) } };
  // live items from lighting/lights.js (the station adds one real point light per work-light pole)
  const items = [];
  const src = G.mods?.lights?.items || [];
  for (const [x, z] of L.workLights) {
    let best = null, bd = 1.5;
    for (const it of src) {
      const p = it.light ? it.light.position : it.group.position;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = it; }
    }
    items.push(best ? best : { fixed: true, pos: new Vector3(x, 4.3, z + 0.3), color: new Color(1, 0.66, 0.36), intensity: 90 });
  }
  const sync = () => {
    for (let i = 0; i < LAMP_N; i++) {
      const it = items[i];
      if (!it) { P[i].w = 0; C[i].setRGB(0, 0, 0); continue; }
      if (it.fixed) { P[i].set(it.pos.x, it.pos.y, it.pos.z, 1); C[i].copy(it.color).multiplyScalar(it.intensity); continue; }
      const p = it.light ? it.light.position : it.group.position;
      const k = it.light ? it.light.intensity : it.base;
      P[i].set(p.x, p.y, p.z, k > 0.5 ? 1 : 0);
      C[i].copy(it.color).multiplyScalar(k);
    }
  };
  sync();
  return { uniforms: u, sync };
}
export const LAMP_GLSL = /*glsl*/`
uniform vec4 uLampP[4];
uniform vec3 uLampC[4];
uniform vec3 uLampAxis;
uniform vec2 uLampCone;
const float LAMP_R0 = 0.6;   // m, emitter radius used to soften every 1/d^2 (flakes, sheets, airlight)
float lampCone(vec3 v) {
  float l = length(v);
  return mix(0.06, 1.0, smoothstep(uLampCone.x, uLampCone.y, dot(v / max(l, 1e-3), uLampAxis)));
}
// irradiance of the work lights at p
vec3 lampIrr(vec3 p) {
  vec3 s = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (uLampP[i].w < 0.5) continue;
    vec3 v = p - uLampP[i].xyz;
    float d2 = dot(v, v) + LAMP_R0 * LAMP_R0;   // near-field softening: no white clip at the lamp head
    s += uLampC[i] * (lampCone(v) / d2);
  }
  return s;
}
`;
// needs NOISE_GLSL + LAMP_GLSL + SHELTER_GLSL + ATMOS_GLSL first. Single-scatter airlight per unit scattering
// coefficient along ro + rd t, t in [t0, t1]; off = integrated wind offset (the snow texture in the beam streams
// with the wind, never re-seeded per frame). Near field: 1/(d^2 + r0^2) (closed form with h^2 + r0^2), so the
// integral peaks at pi / r0 instead of exploding next to the lamp head. hitOpaque: the ray ends on geometry; when
// that point sits close to the lamp the beam in front of it is cut back so the lit surface keeps its shading.
// No beam is integrated inside a shelter (shed, lab, radio hut, lean-tos): the cone taps are masked by sheltered().
export const LAMP_AIR_GLSL = /*glsl*/`
vec3 lampAir(vec3 ro, vec3 rd, float t0, float t1, vec3 off, float hitOpaque) {
  vec3 s = vec3(0.0);
  vec3 ph = ro + rd * t1;
  for (int i = 0; i < 4; i++) {
    if (uLampP[i].w < 0.5) continue;
    vec3 lp = uLampP[i].xyz;
    vec3 w = lp - ro;
    float tc = dot(w, rd);
    float h = sqrt(max(dot(w, w) - tc * tc, 0.0) + LAMP_R0 * LAMP_R0);
    float I = (atan((t1 - tc) / h) - atan((t0 - tc) / h)) / h;
    if (I < 1e-4) continue;
    float tm = clamp(tc, t0, t1);
    vec3 pa = ro + rd * clamp(tc - 1.5 * h, t0, t1), pm = ro + rd * tm, pb = ro + rd * clamp(tc + 1.5 * h, t0, t1);
    float cw = 0.25 * (lampCone(pa - lp) * (1.0 - sheltered(pa)) + 2.0 * lampCone(pm - lp) * (1.0 - sheltered(pm))
                     + lampCone(pb - lp) * (1.0 - sheltered(pb)));
    if (cw < 1e-3) continue;
    // snow texture in the beam: world position minus the wind offset only, narrow range (0.8 .. 1.2): no patches
    vec3 q = (pm - off) * vec3(0.18, 0.9, 0.18);
    float n = 0.8 + 0.4 * (0.65 * vnoise3(q) + 0.35 * vnoise3(q * 2.7 + 7.0));
    float near = mix(1.0, mix(0.3, 1.0, smoothstep(0.8, 5.0, distance(ph, lp))), hitOpaque);
    s += uLampC[i] * (I * cw * n * near) * exp(-atmosTau(pm, ro));
  }
  return s;
}
`;
