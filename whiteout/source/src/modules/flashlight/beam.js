// Volumetric torch beam: one capped cone mesh (BackSide, no depth test) drawn on the post pipeline's
// 'posttransparent' event into the HDR target. Each fragment intersects its view ray with the analytic spot cone,
// then ray-marches the lit segment (clipped to this frame's opaque depth targets.zFull, so the beam stops softly
// on every surface and never shows through a wall) with N IGN-jittered steps, quadratically packed toward the lens.
// Per step: the spot's own shadow map (bench legs, door frames, the stalker cut dark shafts), the lens cookie
// (same rings as on the surfaces), inverse-square + three's range window, fog extinction light→sample and the
// shared analytic fog camera→sample (lighting/atmos), a drifting snow-haze density and a back-scatter phase.
// Additive, linear HDR. ≤ 1 draw call.
//   createBeam(G, { cookie, steps }) → { mesh, scene, material, sync(light, cam, state), dispose }
import {
  Mesh, Scene, ShaderMaterial, ConeGeometry, BackSide, AdditiveBlending, Matrix4, Vector2, Vector3, Vector4, Color,
} from 'three';
import { ATMOS_DECL, ATMOS_GLSL, atmosUniforms } from '../../cookbook/lighting/atmos.js';

const _t = new Vector3(), _dir = new Vector3();

const VS = /*glsl*/`
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FS = /*glsl*/`
#include <packing>
uniform sampler2D tZ;
uniform sampler2D tShadow;
uniform sampler2D tCookie;
uniform mat4 uShadowMat;
uniform vec3 uLP;
uniform vec3 uLD;
uniform vec3 uCamFwd;
uniform vec3 uCol;
uniform vec3 uWind;
uniform vec4 uK;
uniform vec4 uK2;
uniform float uTime;
uniform float uDecay;
uniform vec2 uG;
varying vec3 vW;
// uK  = (cosOuter, range, start (axial m in front of the lamp), gain)
// uK2 = (haze sigma multiplier, indoor 0..1, shadow on 0/1, near clamp m²); uG = Henyey-Greenstein g (out, in)

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h13(i + vec3(0.0, 1.0, 0.0)), h13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(h13(i + vec3(0.0, 0.0, 1.0)), h13(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h13(i + vec3(0.0, 1.0, 1.0)), h13(i + vec3(1.0)), f.x), f.y), f.z);
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vW - ro);
  // ---- ray vs. forward cone (apex uLP, axis uLD, cos half-angle c)
  float c = uK.x, c2 = c * c;
  vec3 co = ro - uLP;
  float dd = dot(rd, uLD), cd = dot(co, uLD);
  float a = dd * dd - c2, b = 2.0 * (dd * cd - c2 * dot(rd, co)), cc = cd * cd - c2 * dot(co, co);
  float disc = b * b - 4.0 * a * cc;
  float t0 = 0.0, t1 = -1.0;
  bool inside0 = cd > 0.0 && cc >= 0.0;
  if (disc < 0.0) {
    if (inside0) { t0 = 0.0; t1 = 1e4; }
  } else {
    float sq = sqrt(disc);
    float r1 = (-b - sq) / (2.0 * a), r2 = (-b + sq) / (2.0 * a);
    float lo = min(r1, r2), hi = max(r1, r2);
    if (a < 0.0) { t0 = lo; t1 = hi; }                       // inside between the roots
    else if (inside0) { t0 = 0.0; t1 = lo > 0.0 ? lo : 1e4; } // camera inside, leaves at the first root ahead
    else { t0 = hi; t1 = 1e4; }                               // enters at the far root
    t0 = max(t0, 0.0);
    // reject the backward nappe
    if (dot(ro + rd * (0.5 * (t0 + min(t1, t0 + 2.0))) - uLP, uLD) <= 0.0) t1 = -1.0;
  }
  // ---- clip: lens plane (axial start), range, this frame's opaque depth (view z → ray length)
  float sceneZ = texelFetch(tZ, ivec2(gl_FragCoord.xy), 0).r;
  float tScene = sceneZ / max(dot(rd, uCamFwd), 1e-3);
  if (dd > 1e-4) t0 = max(t0, (uK.z - cd) / dd);
  t1 = min(min(t1, uK.y), tScene - 0.03);
  if (t1 <= t0) discard;

  // ---- march
  float jit = ign(gl_FragCoord.xy);
  float seg = t1 - t0;
  vec3 sigma = uFogSigma * uK2.x + vec3(0.03) * uK2.y;       // blizzard haze outside, dusty air in the lab
  // forward-scattering haze (Henyey-Greenstein per step, angle between the lamp ray and the eye ray): the eye sits
  // almost on the beam axis, so far haze scatters back weakly (no milky veil over the hotspot) while the air just in
  // front of the lens, seen from the side, carries a visible cone that starts at the glass
  float g = mix(uG.x, uG.y, uK2.y), g2 = g * g;
  float hgK = (1.0 - g2) * 0.0796;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < BEAM_STEPS; i++) {
    float u = (float(i) + jit) / float(BEAM_STEPS);
    float t = t0 + seg * u * u;
    float dt = seg * (2.0 * u) / float(BEAM_STEPS);
    vec3 p = ro + rd * t;
    vec3 lv = p - uLP;
    float d2 = max(dot(lv, lv), uK2.w);
    float d = sqrt(d2);
    float fall = pow(d2, -0.5 * uDecay);
    float cth = dot(lv, -rd) / max(d, 1e-4);
    float ph = hgK * pow(1.0 + g2 - 2.0 * g * cth, -1.5);
    vec4 sc = uShadowMat * vec4(p, 1.0);
    sc.xyz /= sc.w;
    if (sc.w <= 0.0 || any(lessThan(sc.xy, vec2(0.0))) || any(greaterThan(sc.xy, vec2(1.0)))) continue;
    vec3 ck = texture2D(tCookie, sc.xy).rgb;
    float vis = 1.0;
    if (uK2.z > 0.5 && sc.z < 1.0) vis = step(sc.z - 0.0015, unpackRGBAToDepth(texture2D(tShadow, sc.xy)));
    float rw = clamp(1.0 - pow(d / uK.y, 4.0), 0.0, 1.0) * (1.0 - smoothstep(uK.y * 0.3, uK.y * 0.95, d)); // volume fades well before the range
    // drifting snow haze: blown along the wind outside, slow dust churn inside
    vec3 q = p * vec3(0.9, 1.3, 0.9) - uWind * (uTime * mix(0.35, 0.03, uK2.y));
    float dens = 0.45 + 1.1 * vn3(q) * vn3(q * 2.7 + 7.1);
    vec3 Tl = exp(-sigma * d);
    vec3 Tc = atmosTransmittance(p, ro);
    acc += ck * (vis * rw * rw * dens * fall * ph) * Tl * Tc * dt;
  }
  vec3 L = acc * sigma * uCol * uK.w;
  gl_FragColor = vec4(L, 1.0);
}
`;

export function createBeam(G, { cookie, steps = 14 } = {}) {
  const geo = new ConeGeometry(1, 1, 40, 1, false);
  geo.translate(0, -0.5, 0);       // apex at the origin, base at y = -1
  geo.rotateX(-Math.PI / 2);       // base at +z (Object3D.lookAt points +z at the target)
  const material = new ShaderMaterial({
    uniforms: {
      ...atmosUniforms(),
      tZ: { value: null }, tShadow: { value: null }, tCookie: { value: cookie },
      uShadowMat: { value: new Matrix4() }, uLP: { value: new Vector3() }, uLD: { value: new Vector3(0, 0, -1) },
      uCamFwd: { value: new Vector3(0, 0, -1) }, uCol: { value: new Color(0, 0, 0) }, uWind: { value: new Vector3(6, 0, 2) },
      uK: { value: new Vector4(0.88, 30, 0.45, 1) }, uK2: { value: new Vector4(1, 0, 1, 0.25) }, uTime: { value: 0 }, uDecay: { value: 2 }, uG: { value: new Vector2(0.3, 0.5) },
    },
    defines: { BEAM_STEPS: steps },
    vertexShader: VS,
    fragmentShader: ATMOS_DECL + ATMOS_GLSL + FS,
    side: BackSide, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending,
  });
  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false; mesh.name = 'torch-beam';
  mesh.userData.noReflect = true;
  const scene = new Scene(); scene.name = 'torch-beam-scene';
  scene.add(mesh);
  const U = material.uniforms;

  return {
    mesh, scene, material,
    // copy light + camera + game state into the uniforms (allocation-free). Returns false when nothing to draw.
    sync(light, cam, st) {
      if (!light || light.intensity < 0.5 || !light.shadow.map) return false;
      const range = Math.min(st.range, light.distance || st.range);
      const ang = light.angle;
      // apex: the held lens (st.apex, so the cone leaves the glass on screen) or the lamp itself
      const apex = st.apex || light.position;
      mesh.position.copy(apex);
      mesh.lookAt(_t.copy(apex).add(_dir.copy(light.target.position).sub(light.position)));
      const rad = Math.tan(ang) * range * 1.06;
      mesh.scale.set(rad, rad, range);
      mesh.updateMatrixWorld();
      U.uLP.value.copy(apex);
      U.uLD.value.copy(light.target.position).sub(light.position).normalize();
      cam.getWorldDirection(U.uCamFwd.value);
      U.uCol.value.copy(light.color).multiplyScalar(light.intensity);
      U.uK.value.set(Math.cos(ang), range, st.start, st.gain);
      U.uK2.value.set(st.haze, st.indoor, 1, st.nearClamp);
      U.uShadowMat.value.copy(light.shadow.matrix);
      U.tShadow.value = light.shadow.map.texture;
      U.uTime.value = G.t;
      U.uDecay.value = light.decay;
      if (st.wind) U.uWind.value.copy(st.wind);
      if (st.g) U.uG.value.copy(st.g);
      return true;
    },
    setDepth(tex) { U.tZ.value = tex; },
    dispose() { geo.dispose(); material.dispose(); },
  };
}
