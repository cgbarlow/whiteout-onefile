// Ground-hugging blowing snow, one fullscreen draw in post.transparent: each pixel ray-marches (14 steps, quadratic
// spacing, stops at the opaque depth from targets.zFull) through a 1.5 m slab above the drifted surface. Density =
// 3D value noise stretched ~5x along the wind and scrolled by the integrated wind offset (coherent streaming sheets;
// the fine octave races ahead = spindrift), exponential height profile that thickens with the gust, openness mask
// (0 under roofs / footprints). Heights + mask come from a field texture baked once from terrain.heightAt.
// Lit by sky + low sun + flashlight, fogged per sample with lighting/atmos. Marching (not stacked slices) means no
// layer lines against walls and no hard intersections with drifts. Temporal stability: every noise lookup is driven
// only by world position minus an integrated wind offset (no time / frame seed), so the field translates as coherent
// wind-aligned streaks instead of re-randomising in cells; density is biased to the 0-1.2 m slab.
// The same pass adds (a) the work-light airlight (shared.js lampAir: near-field softened, shelter-masked, soft
// luminance cap uAirMax) and (b) a far falling-snow volume (15-55 m, 4 taps) so distance reads as snow, not flat fog.
import { BufferGeometry, BufferAttribute, Mesh, ShaderMaterial, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, AddEquation, DataTexture, RGBAFormat, HalfFloatType,
  LinearFilter, ClampToEdgeWrapping, Vector2, Vector3, Vector4, Matrix4, Color, DataUtils } from 'three';
import { ATMOS_DECL, ATMOS_GLSL } from '../../cookbook/lighting/atmos.glsl.js';
import { fogUniforms } from '../../cookbook/weather/rain.js';
import { LAYOUT as L } from '../../contracts.js';
import { SPOT_GLSL, NOISE_GLSL, LAMP_GLSL, LAMP_AIR_GLSL, SHELTER_GLSL } from './shared.js';

// Height (R) + openness (G) field, 1 m texels over the play area, the berm and a margin.
export function bakeField(heightAt, o = {}) {
  const x0 = o.x0 ?? -110, z0 = o.z0 ?? -100, w = o.w ?? 220, d = o.d ?? 200, cell = o.cell ?? 1;
  const nx = Math.round(w / cell), nz = Math.round(d / cell);
  const rects = [];
  const add = (c, s, pad = 0.35) => rects.push([c[0] - s[0] / 2 - pad, c[1] - s[1] / 2 - pad, c[0] + s[0] / 2 + pad, c[1] + s[1] / 2 + pad]);
  for (const m of L.modules) add(m.c, m.size);
  add(L.shed.c, L.shed.size); add(L.radioHut.c, L.radioHut.size);
  for (const g of L.generators) add(g.c, [5, 4], 0.1);
  for (const t of L.fuelTanks) add([t[0], t[1]], [2.6, 6.2], 0.1);
  const data = new Uint16Array(nx * nz * 4);
  const h1 = DataUtils.toHalfFloat(1);
  for (let j = 0; j < nz; j++) {
    const z = z0 + (j + 0.5) * cell;
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * cell;
      let open = 1;
      for (let r = 0; r < rects.length; r++) {
        const R = rects[r];
        const dx = Math.max(R[0] - x, 0, x - R[2]), dz = Math.max(R[1] - z, 0, z - R[3]);
        const dd = Math.hypot(dx, dz);
        if (dd < 1.2) open = Math.min(open, dd / 1.2);
      }
      const k = (j * nx + i) * 4;
      data[k] = DataUtils.toHalfFloat(heightAt ? heightAt(x, z) : 0);
      data[k + 1] = DataUtils.toHalfFloat(open);
      data[k + 2] = 0; data[k + 3] = h1;
    }
  }
  const tex = new DataTexture(data, nx, nz, RGBAFormat, HalfFloatType);
  tex.magFilter = tex.minFilter = LinearFilter; tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  tex.generateMipmaps = false; tex.needsUpdate = true;
  return { tex, rect: new Vector4(x0, z0, 1 / w, 1 / d) };
}

const SHEET_VS = /*glsl*/`
varying vec2 vNdc;
void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const SHEET_FS = /*glsl*/`
uniform sampler2D tField;
uniform vec4 uFieldRect;
uniform sampler2D tZ;
uniform float uHasZ;
uniform vec2 uTan;
uniform mat4 uCamWorld;
uniform vec3 uOff;
uniform vec2 uWdir;
uniform float uGust;
uniform float uAmt;
uniform float uT;
uniform float uGroundCam;
uniform float uSpotGain;
uniform vec3 uAmbB;
uniform vec3 uSunB;
uniform vec3 uSunDirB;
uniform float uLampGain;
uniform float uLampAirK;
uniform float uAirMax;
uniform vec3 uSnowOff;
uniform float uFarK;
varying vec2 vNdc;
${ATMOS_DECL}
${ATMOS_GLSL}
${SPOT_GLSL}
${NOISE_GLSL}
${LAMP_GLSL}
${SHELTER_GLSL}
${LAMP_AIR_GLSL}
const int STEPS = 14;
void main() {
  if (uHasZ < 0.5) discard;
  vec3 dv = vec3(vNdc * uTan, -1.0);
  vec3 rd = normalize(mat3(uCamWorld) * dv);
  vec3 ro = cameraPosition;
  float tScene = texelFetch(tZ, ivec2(gl_FragCoord.xy), 0).r * length(dv);
  // work-light beams: airlight of the floodlights in the snow-laden air (forward-scattering ice, HG g = 0.45)
  float tE = min(tScene, 90.0);
  vec3 air = vec3(0.0);
  if (uLampAirK > 0.0) {
    float sigA = uFogSigma.g * (1.0 + 1.6 * uGust) + 0.012;
    air = lampAir(ro, rd, 0.3, tE, uOff, step(tScene, 89.0)) * (sigA * uLampAirK * 0.0796);
    // soft luminance cap: the beam saturates at uAirMax instead of clipping the frame to white
    float la = dot(air, vec3(0.2126, 0.7152, 0.0722));
    air *= uAirMax / (uAirMax + la);
  }
  // slab: 1.6 m deep blowing layer above the snow (bounds around the ground under the camera)
  float yLo = uGroundCam - 0.7, yHi = uGroundCam + 1.6;
  float t0, t1;
  bool slab = uAmt >= 0.002;
  if (abs(rd.y) < 1e-4) { slab = slab && ro.y >= yLo && ro.y <= yHi; t0 = 0.0; t1 = 1e4; }
  else { float a = (yLo - ro.y) / rd.y, b = (yHi - ro.y) / rd.y; t0 = max(min(a, b), 0.0); t1 = max(a, b); }
  t0 = max(t0, 0.6);
  t1 = min(min(t1, tScene), 62.0);
  vec3 C = vec3(0.0);
  float T = 1.0;
  if (slab && t1 > t0) {
    float sunUp = smoothstep(-0.05, 0.08, uSunDirB.y);
    vec3 Lsky = uAmbB + uSunB * (0.1 + 0.3 * pow(max(dot(rd, uSunDirB), 0.0), 5.0)) * sunUp;
    float thr = mix(0.54, 0.3, uGust);
    float H = mix(0.32, 0.6, uGust);
    float sig = mix(0.032, 0.09, uGust) * uAmt;
    float tp = t0;
    for (int i = 0; i < STEPS; i++) {
      float f = (float(i) + 1.0) / float(STEPS);
      float t = mix(t0, t1, f * f);
      float dt = t - tp;
      float ts = 0.5 * (t + tp);
      tp = t;
      vec3 p = ro + rd * ts;
      vec4 fl = texture2D(tField, (p.xz - uFieldRect.xy) * uFieldRect.zw);
      float hy = p.y - fl.r;
      if (hy < 0.0 || hy > 1.25) continue;
      vec2 q2 = p.xz - uOff.xz;
      float u = dot(q2, uWdir), v = dot(q2, vec2(-uWdir.y, uWdir.x));
      vec3 P = vec3(u * 0.11, v * 0.55, hy * 1.3);
      float n = vnoise3(P) * 0.62;
      // spindrift: a finer octave that races ahead (1.35x the integrated offset), faded out with distance
      vec2 q3 = p.xz - uOff.xz * 1.35;
      float u3 = dot(q3, uWdir), v3 = dot(q3, vec2(-uWdir.y, uWdir.x));
      float fineK = 1.0 - smoothstep(8.0, 24.0, ts);
      n += mix(0.5, vnoise3(vec3(u3 * 0.3, v3 * 1.5, hy * 2.4 + 3.1)), fineK) * 0.38;
      float dens = smoothstep(thr - 0.06, thr + 0.42, n) * exp(-hy / H) * smoothstep(1.2, 0.55, hy) * fl.g;
      dens *= (1.0 - smoothstep(40.0, 62.0, ts)) * smoothstep(0.6, 2.5, ts);
      float a = 1.0 - exp(-sig * dens * dt * 4.0);
      vec3 L = (Lsky + spotIrr(p) * uSpotGain + lampIrr(p) * uLampGain) * 0.9;
      C += T * a * atmosApply(L, p, ro);
      T *= 1.0 - a;
      if (T < 0.02) break;
    }
  }
  // far falling-snow volume (15 .. 55 m): soft curtains of snow drifting with the integrated wind / fall offset,
  // stretched along the wind and vertically, so the distance reads as a volume of falling snow, not flat fog.
  float f0 = 15.0, f1 = min(tScene, 55.0);
  if (uFarK > 0.0 && f1 > f0 && T > 0.05) {
    float sunUp = smoothstep(-0.05, 0.08, uSunDirB.y);
    vec3 Lf = (uAmbB + uSunB * (0.1 + 0.3 * pow(max(dot(rd, uSunDirB), 0.0), 5.0)) * sunUp) * 0.85;
    float sigF = mix(0.006, 0.014, uGust) * uFarK;
    float dt = (f1 - f0) / 4.0;
    float Tf = 1.0;
    for (int i = 0; i < 4; i++) {
      float t = f0 + (float(i) + 0.5) * dt;
      vec3 p = ro + rd * t;
      vec3 q = p - uSnowOff;
      float u = dot(q.xz, uWdir), v = dot(q.xz, vec2(-uWdir.y, uWdir.x));
      float n = vnoise3(vec3(u * 0.09, q.y * 0.14, v * 0.4)) * 0.7 + vnoise3(vec3(u * 0.21, q.y * 0.33, v * 0.9) + 5.3) * 0.3;
      float hy = p.y - uGroundCam;
      float dens = (0.5 + 1.0 * smoothstep(0.3, 0.8, n)) * (1.0 - smoothstep(9.0, 16.0, hy)) * smoothstep(15.0, 20.0, t) * (1.0 - sheltered(p));
      Tf *= exp(-sigF * dens * dt);
    }
    // one fog evaluation at the middle of the far segment (cheap: 8 noise taps + 1 atmosApply per pixel)
    C += T * (1.0 - Tf) * atmosApply(Lf, ro + rd * (0.5 * (f0 + f1)), ro);
    T *= Tf;
  }
  float A = 1.0 - T;
  vec3 outC = C + air * mix(1.0, T, 0.5);
  if (A < 0.002 && dot(outC, vec3(1.0)) < 0.0005) discard;
  gl_FragColor = vec4(outC, A);   // premultiplied
}
`;

export function createSheets(G, { field, spot, lamps, shelter, wind }) {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const wl = Math.hypot(wind[0], wind[2]) || 1;
  const uniforms = {
    ...fogUniforms(G), ...spot, ...lamps, ...shelter,
    tField: { value: field.tex }, uFieldRect: { value: field.rect }, tZ: { value: null }, uHasZ: { value: 0 },
    uTan: { value: new Vector2(1, 1) }, uCamWorld: { value: new Matrix4() }, uGroundCam: { value: 0 },
    uOff: { value: new Vector3() }, uWdir: { value: new Vector2(wind[0] / wl, wind[2] / wl) }, uGust: { value: 0 },
    uAmt: { value: 1 }, uT: { value: 0 }, uSpotGain: { value: 0.012 }, uLampGain: { value: 0.08 }, uLampAirK: { value: 4.0 },
    uAirMax: { value: 0.45 }, uSnowOff: { value: new Vector3() }, uFarK: { value: 1 },
    uAmbB: { value: new Color(0.66, 0.7, 0.8) }, uSunB: { value: new Vector3() }, uSunDirB: { value: new Vector3() },
  };
  const mat = new ShaderMaterial({ uniforms, vertexShader: SHEET_VS, fragmentShader: SHEET_FS, transparent: true,
    depthWrite: false, depthTest: false, blending: CustomBlending, blendEquation: AddEquation,
    blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 11; mesh.userData.noReflect = true; mesh.name = 'blowing-snow';
  // camera basis taken at draw time (the player moves the camera after this module's update)
  const sync = (cam = G.camera) => { const pe = cam.projectionMatrix.elements; uniforms.uTan.value.set(1 / pe[0], 1 / pe[5]); uniforms.uCamWorld.value.copy(cam.matrixWorld); };
  mesh.onBeforeRender = (r, sc, cam) => sync(cam);
  return { mesh, uniforms, sync, dispose() { geo.dispose(); mat.dispose(); field.tex.dispose(); } };
}
