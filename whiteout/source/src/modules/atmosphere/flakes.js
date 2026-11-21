// Flake shader upgrade for the cookbook weather/snow.js system (same buffers, uniforms, uSnow cover logic and update;
// only the two shader strings are replaced before the first compile). Fixes and additions over the stock shader:
//  - depth layering: far flakes are clamped to uMaxPx (energy capped at 1, so big flakes get smaller, never
//    brighter); near flakes get a lens circle of confusion (focus ~uFocus m), so the closest ones become large,
//    soft, dim out-of-focus discs; per-flake brightness / size spread, so no two dashes look alike;
//  - wind is an integrated offset (uWindOff, CPU-side ∫wind dt) instead of wind·t, so gusts never teleport the field;
//  - motion streaks: each flake is a capsule from its position one shutter ago to now (energy-conserving), which is
//    what makes a 12 m/s gust read as a blizzard instead of strobing dots;
//  - wrap box anchored to the ground under the camera (no flakes wasted under the snow), edge fade on the four sides
//    and the top only (the bottom face is under the snow surface, so wrapping there never pops);
//  - flakes are culled inside shelters (lab, shed, radio hut, lean-tos) so nothing falls through a roof;
//  - lit by the flashlight spot (cone + range, forward-ish glint) and the work-light floodlights (forward-scatter
//    lobe), so flakes sparkle in the beams.
import { Vector3 } from 'three';
import { ATMOS_DECL, ATMOS_GLSL } from '../../cookbook/lighting/atmos.glsl.js';
import { SPOT_GLSL, SHELTER_GLSL, LAMP_GLSL } from './shared.js';

const FLAKE_VS = /*glsl*/`
attribute vec2 corner;
attribute vec4 aSeed;
uniform float uT;
uniform vec3 uBox;
uniform vec3 uWindOff;
uniform vec3 uWindVel;
uniform float uFall;
uniform float uSize;
uniform float uMinPx;
uniform float uMaxPx;
uniform float uShutter;
uniform float uMaxStreak;
uniform vec2 uRes;
uniform float uAmount;
uniform float uGroundY;
uniform float uBoxLift;
uniform float uTurb;
uniform float uSpotGain;
uniform float uLampGainS;
uniform float uFocus;
uniform float uCoc;
uniform float uMaxCoc;
uniform vec3 uAmbS;
uniform vec3 uSunS;
uniform vec3 uSunDirS;
varying vec2 vUv;
varying vec2 vLen;
varying float vA;
varying vec3 vCol;
${ATMOS_DECL}
${ATMOS_GLSL}
${SPOT_GLSL}
${SHELTER_GLSL}
${LAMP_GLSL}
vec3 flakeRaw(float t, vec3 off, float sp, float ph) {
  vec3 base = aSeed.xyz * uBox + vec3(off.x, -uFall * sp * t, off.z);
  vec3 tb = vec3(sin(t * (0.7 + aSeed.x) + ph) * 0.35 + sin(t * 2.3 + ph * 3.0) * 0.08,
                 sin(t * 1.1 + ph * 2.0) * 0.12,
                 cos(t * (0.6 + aSeed.y) + ph) * 0.35 + cos(t * 2.7 + ph * 5.0) * 0.08);
  vec3 g = base * 0.07;
  tb.xz += vec2(sin(g.y + t * 0.31 + sin(g.z * 1.7)), cos(g.x * 1.3 + t * 0.27 + sin(g.y))) * 1.2;
  return base + tb * uTurb;
}
void main() {
  float sp = 0.75 + 0.5 * aSeed.w;
  float ph = aSeed.w * 6.2831;
  // per-flake decorrelated randoms (aSeed.w also gates uAmount, so derive the looks from all four seeds)
  float r1 = fract(aSeed.w * 7.13 + aSeed.x * 3.71 + aSeed.y * 1.37);
  float r2 = fract(aSeed.x * 5.31 + aSeed.z * 9.17 + aSeed.w * 2.23);
  float r3 = fract(aSeed.y * 4.77 + aSeed.z * 2.93 + aSeed.w * 1.11);
  float r4 = fract(aSeed.z * 6.37 + aSeed.x * 1.91 + aSeed.y * 8.41);
  // depth layer: ~35 % of the flakes live in a 3x wrap box (fine, dense far snow: short dim dots past the near box)
  float farL = step(0.72, r4);
  vec3 box = uBox * mix(1.0, 3.0, farL);
  float lift = uBoxLift + farL * (0.5 * box.y - 0.5 * uBox.y);
  float shut = uShutter * mix(0.6, 1.4, r3);
  // far layer: seed spread over the 3x box (same motion as the near flakes)
  vec3 spread = farL * 2.0 * aSeed.xyz * uBox;
  vec3 raw = flakeRaw(uT, uWindOff, sp, ph) + spread;
  vec3 rawP = flakeRaw(uT - shut, uWindOff - uWindVel * shut, sp, ph) + spread;
  vec3 disp = raw - rawP;
  vec3 c = cameraPosition + vec3(0.0, lift, 0.0);
  vec3 p = mod(raw - c + 0.5 * box, box) - 0.5 * box + c;
  vec3 q = p - disp;
  float alive = step(aSeed.w, uAmount) * step(uGroundY, p.y) * (1.0 - sheltered(p));
  vec4 cp = projectionMatrix * viewMatrix * vec4(p, 1.0);
  if (cp.w < 0.3 || alive < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; return; }
  vec4 cq = projectionMatrix * viewMatrix * vec4(q, 1.0);
  vec2 hr = 0.5 * uRes;
  float dist = length(p - cameraPosition);
  // distance layering: far flakes are short dim dots, only mid-range flakes streak
  float farK = smoothstep(9.0, 17.0, dist);
  // size spread 0.5 .. 1.6x, skewed small (a few big aggregates)
  float size = uSize * mix(0.5, 1.6, r1 * r1) * mix(1.0, 0.8, farL);
  float px = size * projectionMatrix[1][1] * hr.y / cp.w;
  // depth of field: circle of confusion (px) grows as the flake nears the lens; capped so no disc fills the frame
  float coc = min(uCoc * max(uFocus / cp.w - 1.0, 0.0), uMaxCoc);
  float P = clamp(max(px, coc), uMinPx, max(uMaxPx, coc));
  vec2 a = cp.xy / cp.w * hr;
  vec2 b = cq.w > 0.1 ? cq.xy / cq.w * hr : a;
  vec2 d = a - b;
  // per-flake angle jitter (about +-5 degrees): no two streaks parallel
  float ang = (r2 - 0.5) * 0.18;
  float ca = cos(ang), sa = sin(ang);
  d = vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y);
  float dl = length(d);
  vec2 dir = dl > 1e-3 ? d / dl : vec2(1.0, 0.0);
  float L = min(dl, uMaxStreak) * mix(1.0, 0.25, farK) * (1.0 - smoothstep(4.0, 12.0, coc) * 0.85);
  vec2 nrm = vec2(-dir.y, dir.x);
  float hl = 0.5 * L;
  vec2 mid = a - dir * hl;
  // quad padded 1.5x across / along: the profile is Gaussian, so its tails must not be cut by the quad edge
  vec2 o = dir * (corner.x * (1.5 * P + hl)) + nrm * (corner.y * 1.5 * P);
  gl_Position = vec4((mid + o) / hr * cp.w, cp.z, cp.w);
  // energy: the true disc px^2 spread over the drawn capsule (sub-pixel flakes dim instead of flickering);
  // out-of-focus discs fall off as 1/coc^2 down to a floor (energy conservation, no opaque discs)
  float energy = min(1.0, (px * px) / (P * P + 0.3 * P * L));
  energy = max(energy, 0.08 * smoothstep(4.0, 7.0, P));
  vUv = vec2(corner.x * (1.5 * P + hl), corner.y * 1.5 * P);
  vLen = vec2(hl, P);
  vec3 lp = (p - c) / (0.5 * box);
  float e = max(max(abs(lp.x), abs(lp.z)), lp.y);
  float edge = 1.0 - smoothstep(0.72, 1.0, e);
  // opacity spread 0.35 .. 1.0, dimmer with distance; far-layer flakes vanish inside the near box (no double density)
  float bright = mix(0.35, 1.0, r2) * mix(1.0, 0.6, farK) * mix(1.0, smoothstep(9.0, 13.0, dist), farL);
  vA = energy * edge * smoothstep(0.6, 1.4, dist) * bright * 2.1;
  vec3 vd = normalize(p - cameraPosition);
  float mu = dot(vd, uSunDirS);
  float sunUp = smoothstep(-0.05, 0.08, uSunDirS.y);
  vec3 Lc = uAmbS + uSunS * (0.12 + 0.25 * pow(max(mu, 0.0), 6.0)) * sunUp;
  // flashlight: the camera sits at the lamp, so flakes are seen near back-scatter; ice facets glint
  float tw = 0.55 + 0.45 * pow(0.5 + 0.5 * sin(uT * (3.0 + 5.0 * aSeed.x) + ph * 9.0), 4.0);
  Lc += spotIrr(p) * (uSpotGain * mix(tw, 0.6, farL));   // far dots: no star-like glints
  // floodlights: ice crystals scatter forward, so flakes between the camera and a lamp flare up
  vec3 li = lampIrr(p);
  if (li.r + li.g > 0.0) {
    float fw = 0.0;
    for (int i = 0; i < 4; i++) { vec3 lv = normalize(uLampP[i].xyz - p); fw = max(fw, uLampP[i].w * pow(max(dot(lv, -vd), 0.0), 3.0)); }
    Lc += li * uLampGainS * tw * (0.6 + 2.5 * fw);
  }
  vCol = atmosApply(Lc * 0.85, p, cameraPosition);
}
`;
const FLAKE_FS = /*glsl*/`
uniform float uOpacity;
varying vec2 vUv;
varying vec2 vLen;
varying float vA;
varying vec3 vCol;
void main() {
  // Gaussian capsule: soft across the width, tapered ends along the streak (head brighter than the tail)
  float qx = max(abs(vUv.x) - vLen.x, 0.0);
  float r = length(vec2(qx, vUv.y)) / vLen.y;
  float s = vUv.x / (vLen.x + vLen.y);
  float taper = 1.0 - smoothstep(0.45, 1.0, abs(s)) * 0.6;
  float a = exp(-2.2 * r * r) * taper * mix(0.55, 1.0, 0.5 + 0.5 * clamp(s, -1.0, 1.0)) * vA * uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vCol, a);
}
`;

/**
 * Swap the snow material's shaders for the streaked / clamped / spot-lit version.
 * @returns the extra uniforms (uWindOff, uWindVel, uBoxLift, ...) the atmosphere update writes each frame.
 */
export function upgradeFlakes(snow, spot, shelter, lamps, o = {}) {
  const u = snow.uniforms;
  Object.assign(u, spot, shelter, lamps, {
    uWindOff: { value: new Vector3() }, uWindVel: { value: new Vector3() },
    uMaxPx: { value: o.maxPx ?? 4.0 }, uShutter: { value: o.shutter ?? 0.012 }, uMaxStreak: { value: o.maxStreak ?? 40 },
    uBoxLift: { value: 0 }, uSpotGain: { value: o.spotGain ?? 0.02 }, uLampGainS: { value: o.lampGain ?? 0.02 },
    uFocus: { value: o.focus ?? 6 }, uCoc: { value: o.coc ?? 3.5 }, uMaxCoc: { value: o.maxCoc ?? 14 },
  });
  const m = snow.mesh.material;
  m.vertexShader = FLAKE_VS;
  m.fragmentShader = FLAKE_FS;
  m.needsUpdate = true;
  return u;
}
