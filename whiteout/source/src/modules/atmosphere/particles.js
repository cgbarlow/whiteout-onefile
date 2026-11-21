// One instanced draw, two populations (premultiplied blend: plumes are alpha "over", motes are additive):
//  PLUMES  snow scoured off the flat roofs, peeling off the downwind edges as soft wispy puffs that lift, stretch
//          along the wind and sink. Strength = gust at each puff's BIRTH time (analytic gustAt), so a gust front
//          grows whole plumes and they die out coherently; a faint baseline keeps the 6 m/s wind visible.
//  MOTES   fine ice dust in a camera-wrapped box ahead of the lens, lit ONLY by the flashlight cone (cd/d², range
//          window, glints from tumbling facets). Outdoors they ride the wind, indoors they hang and drift.
// Both fogged with lighting/atmos, culled in the vertex shader when invisible, soft-faded against zFull.
import { InstancedBufferGeometry, InstancedBufferAttribute, BufferAttribute, Mesh, ShaderMaterial, CustomBlending,
  OneFactor, OneMinusSrcAlphaFactor, AddEquation, Vector2, Vector3, Color } from 'three';
import { ATMOS_DECL, ATMOS_GLSL } from '../../cookbook/lighting/atmos.glsl.js';
import { fogUniforms } from '../../cookbook/weather/rain.js';
import { SPOT_GLSL, GUST_GLSL } from './shared.js';

const TIER = { low: 0.4, med: 0.7, high: 1.0, ultra: 1.3 };

const PART_VS = /*glsl*/`
attribute vec2 corner;
attribute vec4 aSeed;
attribute vec4 aA;      // plume: edge start x, roof y, edge start z, kind (0 plume / 1 mote)
attribute vec4 aB;      // plume: edge end x, edge end z, outward normal x, z
uniform float uT;
uniform vec2 uRes;
uniform vec3 uWind0;
uniform float uPlume;
uniform float uMotes;
uniform vec3 uMoteOff;
uniform vec3 uMoteBox;
uniform float uMoteGain;
uniform float uMinPx;
uniform vec3 uAmbP;
uniform vec3 uSunP;
uniform vec3 uSunDirP;
varying vec2 vUv;
varying vec4 vCol;      // premultiplied rgb, alpha
varying float vKind;
varying float vViewZ;
varying float vSeed;
${ATMOS_DECL}
${ATMOS_GLSL}
${SPOT_GLSL}
${GUST_GLSL}
void cull() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vCol = vec4(0.0); }
void main() {
  vSeed = aSeed.w; vKind = aA.w; vUv = corner;
  vec2 hr = 0.5 * uRes;
  if (aA.w < 0.5) {
    // ---------------- plume puff ----------------
    float life = mix(1.1, 2.2, aSeed.x);
    float a01 = fract(uT / life + aSeed.y);
    float age = a01 * life;
    float tb = uT - age;
    float g = gustAt(tb);
    float strength = (0.1 + 0.9 * smoothstep(0.15, 0.8, g)) * uPlume;
    vec2 e0 = aA.xz, e1 = aB.xy, n = aB.zw;
    vec2 wd = normalize(uWind0.xz);
    float ws = length(uWind0.xz) * (0.7 + 0.8 * g) * mix(0.75, 1.05, aSeed.z);
    vec2 s = mix(e0, e1, aSeed.z) - n * (0.1 + 0.7 * aSeed.w);       // scoured just upwind of the edge
    vec2 side = vec2(-wd.y, wd.x);
    float sway = sin(uT * 1.7 + aSeed.w * 17.0) * 0.18 * age;
    vec2 xz = s + wd * ws * age + side * ((aSeed.x - 0.5) * 0.7 * age + sway);
    // lifts off the edge, then the lee eddy pulls it down along the wall
    float lift = mix(0.15, 0.5, aSeed.y);
    float y = aA.y + 0.06 + lift * age - 0.75 * age * age + 0.1 * sin(age * 4.0 + aSeed.z * 9.0);
    vec3 p = vec3(xz.x, max(y, 0.05), xz.y);
    float env = smoothstep(0.0, 0.1, a01) * pow(1.0 - a01, 1.8);
    float distC = length(p - cameraPosition);
    float alpha = env * strength * 0.26 * (1.0 - smoothstep(40.0, 60.0, distC)) * smoothstep(1.0, 3.0, distC);
    if (alpha < 0.004) { cull(); return; }
    float size = mix(0.14, 0.36, aSeed.x * aSeed.y) * (1.0 + 1.1 * age);
    vec4 vp = viewMatrix * vec4(p, 1.0);
    // stretch along the screen-space wind a little (streaming plume, not round balls)
    vec3 wv = (viewMatrix * vec4(wd.x, 0.0, wd.y, 0.0)).xyz;
    vec2 wdir = length(wv.xy) > 1e-3 ? normalize(wv.xy) : vec2(1.0, 0.0);
    vec2 off = wdir * corner.x * size * 1.7 + vec2(-wdir.y, wdir.x) * corner.y * size;
    vp.xy += off;
    vViewZ = -vp.z;
    gl_Position = projectionMatrix * vp;
    float sunUp = smoothstep(-0.05, 0.08, uSunDirP.y);
    float mu = dot(normalize(p - cameraPosition), uSunDirP);
    vec3 Lc = (uAmbP + uSunP * (0.12 + 0.35 * pow(max(mu, 0.0), 5.0)) * sunUp + spotIrr(p) * 0.012) * 0.88;
    vCol = vec4(atmosApply(Lc, p, cameraPosition) * alpha, alpha);
  } else {
    // ---------------- flashlight mote ----------------
    if (uMotes < 0.01 || uSpK.w < 0.5) { cull(); return; }
    float ph = aSeed.w * 6.2831;
    vec3 w = vec3(sin(uT * 0.37 + ph) + 0.5 * sin(uT * 0.91 + ph * 2.1),
                  sin(uT * 0.29 + ph * 1.7) + 0.5 * sin(uT * 0.83 + ph * 3.1),
                  cos(uT * 0.33 + ph * 1.3) + 0.5 * cos(uT * 1.07 + ph * 2.7)) * 0.18;
    vec3 c = uSpP + uSpD * (0.5 * uMoteBox.z * 0.8);
    vec3 p = aSeed.xyz * uMoteBox + w + uMoteOff;
    p = mod(p - c + 0.5 * uMoteBox, uMoteBox) - 0.5 * uMoteBox + c;
    vec3 irr = spotIrr(p);
    float lum = dot(irr, vec3(0.3, 0.5, 0.2));
    if (lum < 0.05) { cull(); return; }
    vec4 cp = projectionMatrix * viewMatrix * vec4(p, 1.0);
    if (cp.w < 0.25) { cull(); return; }
    float size = 0.0022 * (0.5 + 1.5 * aSeed.y * aSeed.y);
    float px = size * projectionMatrix[1][1] * hr.y / cp.w;
    float P = clamp(px, uMinPx, 3.0);
    float energy = min(1.0, (px * px) / (P * P));
    gl_Position = cp + vec4(corner * P / hr * cp.w, 0.0, 0.0);
    vec3 lp = abs(p - c) / (0.5 * uMoteBox);
    float edge = 1.0 - smoothstep(0.7, 1.0, max(lp.x, max(lp.y, lp.z)));
    float dist = length(p - cameraPosition);
    float glint = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uT * (1.2 + 2.6 * aSeed.x) + ph * 7.0), 8.0);
    float a = energy * edge * glint * smoothstep(0.35, 1.2, dist) * uMotes;
    vViewZ = cp.w;
    vec3 col = irr * (uMoteGain * a) * atmosTransmittance(p, cameraPosition);
    vCol = vec4(col, 0.0);    // additive in the premultiplied blend
  }
}
`;
const PART_FS = /*glsl*/`
uniform sampler2D tZ;
uniform float uHasZ;
varying vec2 vUv;
varying vec4 vCol;
varying float vKind;
varying float vViewZ;
varying float vSeed;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn2(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
void main() {
  float r2 = dot(vUv, vUv);
  float m;
  float soft = 1.0;
  if (vKind < 0.5) {
    // wispy puff: soft core broken up by 2 octaves of per-puff noise
    float nz = vn2(vUv * 2.2 + vSeed * 31.0) * 0.65 + vn2(vUv * 5.1 + vSeed * 17.0) * 0.35;
    m = smoothstep(1.0, 0.1, r2) * smoothstep(0.1, 0.95, nz + 0.35 * (1.0 - r2));   // soft wisps: no hard cells in motion
    if (uHasZ > 0.5) soft = clamp((texelFetch(tZ, ivec2(gl_FragCoord.xy), 0).r - vViewZ) / 0.8, 0.0, 1.0);
  } else {
    m = exp(-r2 * 3.5);
    if (uHasZ > 0.5) soft = clamp((texelFetch(tZ, ivec2(gl_FragCoord.xy), 0).r - vViewZ) / 0.1, 0.0, 1.0);
  }
  vec4 c = vCol * (m * soft);
  if (c.a < 0.002 && dot(c.rgb, vec3(1.0)) < 0.0005) discard;
  gl_FragColor = c;
}
`;

export function createParticles(G, { spot, edges, wind, plumes = 2200, motes = 1800 }) {
  const k = TIER[G.quality.tier] ?? 1;
  const nP = Math.round(plumes * k), nM = Math.round(motes * k), n = nP + nM;
  const geo = new InstancedBufferGeometry();
  geo.setAttribute('corner', new BufferAttribute(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), 2));
  geo.setIndex([0, 1, 2, 2, 1, 3]);
  const rnd = G.rng ? G.rng(4411) : Math.random;
  const seed = new Float32Array(n * 4), A = new Float32Array(n * 4), B = new Float32Array(n * 4);
  const tot = edges.reduce((s, e) => s + e[7], 0) || 1;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 4; c++) seed[i * 4 + c] = rnd();
    if (i < nP && edges.length) {
      let pick = rnd() * tot, e = edges[0];
      for (const ed of edges) { pick -= ed[7]; if (pick <= 0) { e = ed; break; } }
      A.set([e[0], e[4], e[1], 0], i * 4); B.set([e[2], e[3], e[5], e[6]], i * 4);
    } else A[i * 4 + 3] = 1;
  }
  geo.setAttribute('aSeed', new InstancedBufferAttribute(seed, 4));
  geo.setAttribute('aA', new InstancedBufferAttribute(A, 4));
  geo.setAttribute('aB', new InstancedBufferAttribute(B, 4));
  geo.instanceCount = n;
  const uniforms = {
    ...fogUniforms(G), ...spot,
    uT: { value: 0 }, uRes: { value: new Vector2(1, 1) }, uWind0: { value: new Vector3().fromArray(wind) },
    uPlume: { value: 1 }, uMotes: { value: 1 }, uMoteOff: { value: new Vector3() }, uMoteBox: { value: new Vector3(9, 5, 11) },
    uMoteGain: { value: 0.7 }, uMinPx: { value: 1.0 },
    uAmbP: { value: new Color(0.52, 0.57, 0.66) }, uSunP: { value: new Vector3() }, uSunDirP: { value: new Vector3() },
    tZ: { value: null }, uHasZ: { value: 0 },
  };
  const mat = new ShaderMaterial({ uniforms, vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false,
    blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 12; mesh.userData.noReflect = true; mesh.name = 'plumes-motes';
  return { mesh, uniforms, dispose() { geo.dispose(); mat.dispose(); } };
}
