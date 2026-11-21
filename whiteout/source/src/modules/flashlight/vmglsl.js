// GLSL for the held-torch view model (viewmodel.js patches MeshStandardMaterial with these chunks).
// Surface detail per kind (torchgeo.js pbr.w): 0 plain, 1 diamond knurl, 2 glove shell, 3 knit rib, 4 crinkled
// nylon, 5 rubber stipple, 6 pebbled leather. Swept digits (fingers + thumb, attribute `dig`) add joint creases,
// stretched-fabric wrinkles across the knuckles, a welted side seam with lock stitches, a fabric weave and scuffed
// wear on the dorsal side. Every micro pattern fades with the pixel footprint (vAA, metres per pixel) so nothing
// finer than ~2 px survives: the held item never crawls when it sways.
export const VM_VERT_DECL = /*glsl*/`
attribute vec4 pbr;
attribute vec2 dig;
varying vec4 vPbr;
varying vec3 vLoc;
varying vec3 vLocN;
varying vec2 vDig;
`;
export const VM_VERT_MAIN = /*glsl*/`
vPbr = pbr;
vLoc = position;
vLocN = objectNormal;
vDig = dig;
`;

export const VM_FRAG_DECL = /*glsl*/`
uniform float uGlow;
uniform vec3 uGlowCol;
uniform float uFrost;
varying vec4 vPbr;
varying vec3 vLoc;
varying vec3 vLocN;
varying vec2 vDig;
float vmH(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vmN(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(vmH(i), vmH(i + vec3(1.0, 0.0, 0.0)), f.x), mix(vmH(i + vec3(0.0, 1.0, 0.0)), vmH(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(vmH(i + vec3(0.0, 0.0, 1.0)), vmH(i + vec3(1.0, 0.0, 1.0)), f.x), mix(vmH(i + vec3(0.0, 1.0, 1.0)), vmH(i + vec3(1.0)), f.x), f.y), f.z);
}
// fade for a pattern of period P metres given the pixel footprint fw: 1 while P spans >= 4 px, 0 below 2 px
float vmKeep(float P, float fw) { return 1.0 - smoothstep(0.25, 0.5, fw / P); }

// digit frame: phi = angle around the digit cross-section (0 = faces +z neighbour, pi/2 = dorsal, pi = -z side)
struct Dg { float t; float s; float len; float phi; float dors; float thumb; };
Dg vmDigit(vec2 dg, vec3 p, vec3 n) {
  Dg d;
  d.thumb = step(2.5, dg.x);
  d.len = dg.x - mix(1.0, 3.0, d.thumb);
  d.t = dg.y; d.s = dg.y * d.len;
  vec2 rad = normalize(p.xy + vec2(1e-5));
  d.dors = dot(normalize(n).xy, rad);
  d.phi = atan(d.dors, normalize(n).z);   // 0..pi on the visible outer half, negative on the palm side
  return d;
}
float vmJoint(float th, float j) { return mix(j < 0.5 ? 0.36 : 0.68, 0.52, th); }

// digit height (m): creases, wrinkles, welt seam + stitches
float vmDigitH(Dg d, float fw) {
  float h = 0.0;
  for (int k = 0; k < 2; k++) {
    if (d.thumb > 0.5 && k == 1) break;
    float dj = (d.t - vmJoint(d.thumb, float(k))) * d.len;
    h -= 0.0016 * exp(-dj * dj / (2.0 * 0.0013 * 0.0013)) * vmKeep(0.003, fw);
    float w = exp(-dj * dj / (2.0 * 0.0042 * 0.0042)) * smoothstep(-0.1, 0.8, d.dors);
    h += 0.0005 * sin(dj * 6.2832 / 0.003 + d.phi * 1.7) * w * vmKeep(0.003, fw);
  }
  // welt seams where the dorsal panel meets the fourchettes (both sides of every digit)
  float fwP = fw / 0.011;                                    // footprint in radians (digit radius ~11 mm)
  for (int k = 0; k < 2; k++) {
    float ps = k == 0 ? 0.62 : 2.52;
    float dp = abs(d.phi - ps);
    h += 0.00042 * (1.0 - smoothstep(0.0, 0.16 + fwP, dp)) - 0.00028 * (1.0 - smoothstep(0.0, 0.05 + fwP, dp));
    // lock stitches 3 mm apart, just on the dorsal side of the welt
    float st = abs(fract(d.s / 0.003) - 0.5);
    float sb = (1.0 - smoothstep(0.0, 0.07 + fwP, abs(dp - 0.13))) * (1.0 - smoothstep(0.18, 0.3, st));
    h += 0.00022 * sb * vmKeep(0.003, fw);
  }
  // fine plain weave
  float wv = sin(d.s * 6.2832 / 0.0011) * sin(d.phi * 0.011 * 6.2832 / 0.0011);
  h += 0.00004 * wv * vmKeep(0.0011, fw);
  return h;
}

// height field (metres) per surface kind, evaluated in the view-model's local frame (torch axis = -Z)
float vmHeight(vec3 p, float kind, float fw) {
  if (kind < 0.5) return 0.0;
  if (kind < 1.5) {                       // diamond knurl, 2.3 mm pitch, around the torch axis (fades before it aliases)
    float s = atan(p.y, p.x) * 0.0167;
    float a = abs(fract((s + p.z) * 440.0) - 0.5), b = abs(fract((s - p.z) * 440.0) - 0.5);
    return 0.00022 * min(a, b) * vmKeep(0.0023, fw);
  }
  if (kind < 2.5) {                       // glove shell: quilted channels + fibre grain
    float q = abs(fract(dot(p, vec3(0.3, 0.5, 1.0)) * 55.0) - 0.5);
    return 0.0001 * smoothstep(0.0, 0.06, q) + 0.00012 * vmN(p * 1400.0) * vmKeep(0.0007, fw) + 0.0002 * vmN(p * 260.0);
  }
  if (kind < 3.5) return 0.0004 * abs(sin(dot(p, vec3(1.0, 1.0, 0.3)) * 700.0)) * vmKeep(0.009, fw);  // knit rib
  if (kind < 4.5) return 0.0012 * vmN(p * 70.0) + 0.0005 * vmN(p * 190.0);                            // crinkled nylon
  if (kind < 5.5) return 0.00008 * vmN(p * 900.0) * vmKeep(0.0011, fw);                                 // rubber stipple
  return 0.00014 * vmN(p * 700.0) * vmKeep(0.0014, fw) + 0.00005 * vmN(p * 1900.0) * vmKeep(0.0005, fw); // pebbled leather
}
`;

export const VM_FRAG_COLOR = /*glsl*/`
float vmFw = length(fwidth(vLoc));
{
  float kind = vPbr.w;
  // snow crumbs + frost on up-facing glove / sleeve surfaces (world up = camera-relative via the view matrix)
  vec3 wn = normalize((vec4(normalize(vNormal), 0.0) * viewMatrix).xyz);
  if (kind > 1.5 && abs(kind - 5.0) > 0.5) {
    float n = vmN(vLoc * 260.0) * vmN(vLoc * 77.0 + 3.1);
    float crumbs = smoothstep(0.42, 0.6, n) * smoothstep(0.35, 0.8, wn.y) * uFrost;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.66, 0.72), crumbs);
  }
  // glove digits: worn nap on the dorsal side and around the joints, darker seam grooves, light-grey stitch thread
  if (vDig.x > 0.5) {
    Dg d = vmDigit(vDig, vLoc, vLocN);
    float wear = smoothstep(0.45, 0.95, d.dors) * (0.4 + 0.6 * vmN(vLoc * 330.0));
    for (int k = 0; k < 2; k++) {
      float dj = (d.t - vmJoint(d.thumb, float(k))) * d.len;
      wear += 0.6 * exp(-dj * dj / (2.0 * 0.004 * 0.004)) * smoothstep(0.2, 0.9, d.dors);
    }
    diffuseColor.rgb *= 1.0 + 0.8 * clamp(wear, 0.0, 1.0);
    float fwP = vmFw / 0.011;
    for (int k = 0; k < 2; k++) {
      float dp = abs(d.phi - (k == 0 ? 0.62 : 2.52));
      diffuseColor.rgb *= 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.05 + fwP, dp));
      float st = abs(fract(d.s / 0.003) - 0.5);
      float sb = (1.0 - smoothstep(0.0, 0.06 + fwP, abs(dp - 0.13))) * (1.0 - smoothstep(0.16, 0.28, st)) * vmKeep(0.003, vmFw);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.2, 0.19), sb * 0.85);
    }
  }
  // metal: scratches + scuffs brighten the dark anodizing
  if (vPbr.y > 0.5 && kind < 1.5) {
    float sc = smoothstep(0.93, 0.99, vmN(vec3(vLoc.x * 90.0, vLoc.y * 90.0, vLoc.z * 2600.0))) * 0.5 * vmKeep(0.0008, vmFw)
             + smoothstep(0.82, 0.95, vmN(vLoc * 420.0)) * 0.25;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.45), sc * step(diffuseColor.r, 0.2));
  }
}
`;

export const VM_FRAG_ROUGH = /*glsl*/`
roughnessFactor = clamp(vPbr.x * (0.85 + 0.3 * vmN(vLoc * 350.0)), 0.04, 1.0);
`;

export const VM_FRAG_NORMAL = /*glsl*/`
{
  float h = vmHeight(vLoc, vPbr.w, vmFw);
  if (vDig.x > 0.5) h += vmDigitH(vmDigit(vDig, vLoc, vLocN), vmFw);
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
  vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
  float det = dot(sx, r1) * faceDirection;
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  normal = normalize(abs(det) * normal - grad);
}
`;
