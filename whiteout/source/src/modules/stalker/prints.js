// Stalker footprints: one InstancedMesh (1 draw) ring buffer of 48 prints pressed into the snow at every heel strike,
// plus 2 contact-shadow instances (0, 1) that follow the feet every frame: a soft blue-grey occlusion pool under each
// foot, strongest under the sole, fading as the foot lifts (the body is grounded in any light, flashlight included).
// Procedural three-toed print (heel pad, narrow sole, long splayed toe drags, claw rakes, the dragged left foot leaves
// a scuff toward the next step) shaded as a MULTIPLY decal (blend ZERO, SRC_COLOR): it only darkens whatever the snow
// already receives — blue in the shade, warm under a window — so it can never glow. Hollows are deepest on the side
// away from the light (a cheap wall term), the snow refills a print over ~2 min, the fog transmittance fades it.
//   createPrints(G, { heightAt, normalAt }) → { mesh, add(x, z, yaw, foot, birth?), setContact(foot, x, z, yaw, k),
//     clear(), update(t) }
import { InstancedMesh, PlaneGeometry, ShaderMaterial, CustomBlending, AddEquation, ZeroFactor, SrcColorFactor, OneFactor,
  InstancedBufferAttribute, Matrix4, Quaternion, Vector3, Euler } from 'three';
import { atmosUniforms, ATMOS_DECL, ATMOS_GLSL } from '../../cookbook/lighting/atmos.js';

const N = 48, C = 3;           // ring prints, contact instances (first C slots: foot L, foot R, body)
const VS = /*glsl*/`
attribute vec2 aInfo;            // x = birth time (s), y = foot (0 = dragged left, 1 = right) + seed fraction
uniform float uNow;
varying vec2 vUv;
varying vec3 vW;
varying float vAge;
varying float vInfo;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vAge = aInfo.y > 1.99 ? aInfo.x : uNow - aInfo.x;   // contact instances: x = strength
  vInfo = aInfo.y;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = /*glsl*/`
${ATMOS_DECL}
${ATMOS_GLSL}
varying vec2 vUv;
varying vec3 vW;
varying float vAge;
varying float vInfo;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float ell(vec2 p, vec2 c, vec2 r) { return length((p - c) / r) - 1.0; }
float seg(vec2 p, vec2 a, vec2 b, float r) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
void main() {
  float T = dot(atmosTransmittance(vW, cameraPosition), vec3(0.333));
  if (vInfo > 1.99) {
    // contact occlusion: a wide soft pool + a tight core under the sole (the instance is scaled ×1.8)
    float r = length((vUv - 0.5) / vec2(0.5, 0.5));
    float core = 1.0 - smoothstep(0.0, 0.6, length((vUv - vec2(0.5, 0.47)) / vec2(0.26, 0.36)));
    float k = (pow(1.0 - smoothstep(0.1, 1.0, r), 1.6) * 0.5 + core * 0.45) * clamp(vAge, 0.0, 1.0) * T;
    gl_FragColor = vec4(mix(vec3(1.0), vec3(0.36, 0.42, 0.56), k), 1.0);
    return;
  }
  float seed = fract(vInfo) * 10.0, drag = step(vInfo, 0.99);
  vec2 p = vUv;                                    // x across (0..1 = 0.26 m), y along the foot (0 heel → 1 toes)
  p += (vec2(vn(p * 9.0 + seed), vn(p * 9.0 + seed + 3.1)) - 0.5) * 0.05;   // crumbly snow edge
  float d = ell(p, vec2(0.5, 0.17), vec2(0.17, 0.11));
  d = min(d, ell(p, vec2(0.5, 0.38), vec2(0.13, 0.2)) * 0.8);
  float sp = 0.16 + 0.04 * sin(seed);
  d = min(d, seg(p, vec2(0.5 - 0.06, 0.55), vec2(0.5 - sp - 0.1, 0.86), 0.05) * 9.0);
  d = min(d, seg(p, vec2(0.5, 0.56), vec2(0.5, 0.92), 0.055) * 9.0);
  d = min(d, seg(p, vec2(0.5 + 0.06, 0.55), vec2(0.5 + sp + 0.1, 0.86), 0.05) * 9.0);
  // claw rakes past each toe, and the dragged foot's scuff trailing behind the heel
  float rake = min(min(seg(p, vec2(0.5 - sp - 0.1, 0.88), vec2(0.5 - sp - 0.13, 0.98), 0.012), seg(p, vec2(0.5, 0.94), vec2(0.5, 1.0), 0.012)),
                   seg(p, vec2(0.5 + sp + 0.1, 0.88), vec2(0.5 + sp + 0.13, 0.98), 0.012)) * 30.0;
  float scuff = seg(p, vec2(0.5, 0.05), vec2(0.47, -0.4), 0.06) * 9.0 + (1.0 - drag) * 20.0;
  float cov = 1.0 - smoothstep(-0.25, 0.08, d);
  cov = max(cov, (1.0 - smoothstep(-0.2, 0.3, rake)) * 0.7);
  cov = max(cov, (1.0 - smoothstep(-0.4, 0.6, scuff)) * 0.45 * smoothstep(-0.4, 0.05, p.y));
  float depth = 1.0 - smoothstep(-0.9, -0.1, d);  // deeper in the middle of the pads
  float fade = 1.0 - smoothstep(50.0, 140.0, vAge);
  float k = cov * fade * T;
  // a print is a hollow: blue-shadowed floor, darker toward the deepest point
  vec3 tint = mix(vec3(0.74, 0.79, 0.9), vec3(0.5, 0.58, 0.74), depth);
  gl_FragColor = vec4(mix(vec3(1.0), tint, k), 1.0);
}`;

const _m = new Matrix4(), _q = new Quaternion(), _q2 = new Quaternion(), _p = new Vector3(), _s = new Vector3(1, 1, 1), _n = new Vector3(), _up = new Vector3(0, 1, 0), _e = new Euler();

export function createPrints(G, { heightAt = null, normalAt = null } = {}) {
  const geo = new PlaneGeometry(0.26, 0.46);
  geo.rotateX(-Math.PI / 2);          // lie flat, +y up; uv.y runs along -z → rotate so toes point +z
  geo.rotateY(Math.PI);
  const info = new InstancedBufferAttribute(new Float32Array((N + C) * 2), 2);
  geo.setAttribute('aInfo', info);
  const uniforms = { ...atmosUniforms(), uNow: { value: 0 } };
  const mat = new ShaderMaterial({
    uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
    blending: CustomBlending, blendEquation: AddEquation, blendSrc: ZeroFactor, blendDst: SrcColorFactor,
    blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  mat.name = 'stalkerPrints';
  const mesh = new InstancedMesh(geo, mat, N + C);
  mesh.name = 'stalkerPrints'; mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.count = C;
  mesh.userData.noReflect = true;
  let head = 0, used = 0, seed = 0.137;
  const place = (i, x, z, yaw, sc) => {
    const y = (heightAt ? heightAt(x, z) : 0) + 0.004;
    _p.set(x, y, z);
    _e.set(0, yaw + Math.PI, 0); _q.setFromEuler(_e);
    if (normalAt) { normalAt(x, z, _n); _q2.setFromUnitVectors(_up, _n.normalize()); _q.premultiply(_q2); }
    _s.setScalar(sc);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
  };
  for (let i = 0; i < C; i++) { place(i, 0, 0, 0, 1); info.setXY(i, 0, 2); }
  const P = {
    mesh,
    add(x, z, yaw, foot, birth = uniforms.uNow.value) {
      place(C + head, x, z, yaw, 1);
      seed = (seed * 9.7 + 0.31) % 1;
      info.setXY(C + head, birth, foot === 0 ? Math.min(0.98, seed * 0.98) : 1 + seed * 0.98);
      head = (head + 1) % N; used = Math.min(N, used + 1);
      mesh.count = C + used;
      mesh.instanceMatrix.needsUpdate = true; info.needsUpdate = true;
    },
    // contact pool i at (x, z) heading yaw, k = 0..1: 0/1 = under a foot (1 = sole flat on the snow), 2 = the broad
    // ambient-occlusion pool under the whole body (between and around both feet)
    setContact(i, x, z, yaw, k, sc = 1.8) {
      place(i, x, z, yaw, sc);
      info.setXY(i, k, 2);
      mesh.instanceMatrix.needsUpdate = true; info.needsUpdate = true;
    },
    clear() { head = 0; used = 0; mesh.count = C; },
    update(t) { uniforms.uNow.value = t; },
    dispose() { geo.dispose(); mat.dispose(); },
  };
  return P;
}
