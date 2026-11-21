// Ground snow detail patch ('tsnow', engine/patch.js) stacked on mats.snowGround after the look-director's
// 'snowgnd' patch. All world-space (never tiles), all faded by distance AND by pixel footprint (no shimmer):
//   sastrugi  exact per-pixel normal of the SAME ridge field the mesh carries (noise.js TERRAIN_GLSL): sharp crests
//             the 0.5 m mesh cannot hold; crest softening grows with the pixel footprint. Weight = tmask.x.
//   ripples   8-14 cm wind ripples, crests across the wind, asymmetric (gentle stoss, steep lee), only in patches
//             and in the troughs between sastrugi (never a uniform ripple field), gone by 10 m.
//   trampled  path (tmask.y): boot-churned lumps, greyer compacted snow, a little more polish.
//   scallops  0.5-1.5 m erosion hollows stretched along the wind (mid frequency between sastrugi and ripples).
//   macro     world-space snow states: wind-polished hard-pack slabs (greyer-blue, low roughness sheen, the tiling
//             crust bake's grain polished away) vs fresh loose snow (brighter, sparkles); prows facing the wind
//             bright, lee faces in a cool shade, so the relief reads under the flat dusk sky light.
//   sparkle   1.4 cm cells, ~0.7-1.5 % of them (fresh snow only) are glassy facets (low roughness, random normal):
//             the scene's real lights make them glint; hidden once a cell is under ~1 px.
import { patch, after, before } from '../../cookbook/engine/patch.js';
import { ensureWorldVaryings, ensureNoise } from '../../cookbook/materials/weathering.js';
import { TERRAIN_GLSL, terrainDefines } from './noise.js';

export function patchGroundDetail(mat) {
  return patch(mat, 'tsnow', (shader) => {
    ensureWorldVaryings(shader); ensureNoise(shader);
    let vs = shader.vertexShader, fs = shader.fragmentShader;
    vs = after(vs, '#include <common>', 'attribute vec2 tmask;\nvarying vec2 vTMask;');
    vs = after(vs, '#include <begin_vertex>', 'vTMask = tmask;');
    if (!fs.includes('varying vec3 vWthPos')) fs = fs.replace('#include <common>', '#include <common>\nvarying vec3 vWthPos;\nvarying vec3 vWthN;');
    // library after the noise lib (ensureNoise put it right after <common>)
    fs = before(fs, '#include <uv_pars_fragment>', terrainDefines() + 'varying vec2 vTMask;\n' + TERRAIN_GLSL);
    fs = after(fs, '#include <color_fragment>', /*glsl*/`
  vec2 tsWp = vWthPos.xz;
  float tsDist = length(vViewPosition);
  float tsP = clamp(vTMask.y, 0.0, 1.0);
  float tsH = 0.0;
  vec2 tsG = vec2(0.0);
  vec2 tsW = vec2(TS_WX, TS_WZ);
  // macro snow states (world metres, stretched along the wind): wind-polished hard-pack slabs vs fresh loose snow
  float tsU = dot(tsWp, tsW), tsV = dot(tsWp, vec2(-tsW.y, tsW.x));
  float tsPol = smoothstep(0.52, 0.72, tvn(vec2(tsU * 0.035, tsV * 0.09), 101.0) * 0.75 + tvn(tsWp * 0.21, 102.0) * 0.25) * (1.0 - tsP);
  float tsFresh = (1.0 - tsPol) * smoothstep(0.45, 0.7, tvn(tsWp * 0.06 + 3.7, 103.0));
  float tsMapK = mix(1.0, 0.3, tsPol) * mix(1.0, 0.7, tsP);
  {
    float wgt = clamp(vTMask.x, 0.0, 1.0) * (1.0 - smoothstep(35.0, 80.0, tsDist));
    if (wgt > 0.002) {
      float px = max(length(fwidth(tsWp)), 0.002);
      float soft = clamp(px * 1.5, 0.012, 0.3);
      float e = max(0.025, px);
      float s0 = tsSast(tsWp, soft);
      float sx = tsSast(tsWp + vec2(e, 0.0), soft);
      float sz = tsSast(tsWp + vec2(0.0, e), soft);
      tsG = vec2(sx - s0, sz - s0) / e * wgt;
      tsH = s0 * wgt;
    }
    // micro ripples: only where the snow is smooth (troughs, flats), patchy, close range
    float rf = 1.0 - smoothstep(4.0, 14.0, tsDist);
    if (rf > 0.0) {
      vec2 W = vec2(TS_WX, TS_WZ);
      float u = dot(tsWp, W), v = dot(tsWp, vec2(-W.y, W.x));
      float patchy = smoothstep(0.32, 0.6, tvn(tsWp * 0.17, 91.0)) * (1.0 - smoothstep(0.03, 0.12, tsH)) * (1.0 - tsP) * (1.0 - 0.8 * tsPol);
      const float lam = 0.11;
      // crests run across the wind; gentle sideways bend + Y-junction defects from a slow phase field (no rings)
      float ph = u / lam + 1.6 * tvn(vec2(u * 0.18, v * 0.55), 92.0) + 0.5 * tvn(vec2(u * 0.9, v * 2.2), 93.0);
      float aa = clamp(1.4 - fwidth(ph) * 1.6, 0.0, 1.0);
      float f = fract(ph), sl;
      if (f < 0.72) { float t = f / 0.72; sl = 6.0 * t * (1.0 - t) / 0.72; } else { float t = (f - 0.72) / 0.28; sl = -6.0 * t * (1.0 - t) / 0.28; }
      float seg = smoothstep(0.35, 0.65, tvn(vec2(u * 1.3, v * 0.45), 99.0)); // crests break into short segments
      tsG += W * (0.0018 * patchy * seg * rf * aa * sl / lam);
    }
    // erosion scallops: 0.5-1.5 m spoon-shaped hollows elongated along the wind (mid frequency between the
    // sastrugi and the ripples), strongest on the polished hard-pack, faded by pixel footprint
    {
      float sf = 1.0 - smoothstep(18.0, 45.0, tsDist);
      if (sf > 0.0) {
        vec2 q = vec2(tsU * 0.9, tsV * 2.1);
        float e3 = 0.08;
        float c0 = tvn(q, 104.0), cx = tvn(q + vec2(e3, 0.0), 104.0), cz = tvn(q + vec2(0.0, e3), 104.0);
        vec2 gq = vec2(cx - c0, cz - c0) / e3;                 // gradient in (u, v) lattice space
        vec2 gw = (tsW * gq.x * 0.9 + vec2(-tsW.y, tsW.x) * gq.y * 2.1);
        float pxs = length(fwidth(q));
        tsG += gw * 0.045 * sf * (0.35 + 0.65 * tsPol) * (1.0 - tsP) * (1.0 - smoothstep(0.4, 1.2, pxs));
      }
    }
    // trampled path: churned lumps
    if (tsP > 0.01) {
      float pf = tsP * (1.0 - smoothstep(6.0, 28.0, tsDist));
      float e2 = 0.035;
      vec2 q = tsWp;
      float n0 = tvn(q * 3.3, 96.0) * 0.03 + tvn(q * 8.5, 97.0) * 0.012;
      float n1 = tvn((q + vec2(e2, 0.0)) * 3.3, 96.0) * 0.03 + tvn((q + vec2(e2, 0.0)) * 8.5, 97.0) * 0.012;
      float n2 = tvn((q + vec2(0.0, e2)) * 3.3, 96.0) * 0.03 + tvn((q + vec2(0.0, e2)) * 8.5, 97.0) * 0.012;
      tsG += vec2(n1 - n0, n2 - n0) / e2 * pf;
      float grime = 0.5 + 0.5 * tvn(q * 0.6, 98.0);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.90, 0.905, 0.925) * (0.95 + 0.07 * grime), tsP);
    }
    // wind-polished crests a touch brighter, sastrugi troughs a touch darker and bluer
    float fl = clamp(length(tsG) * 1.2, 0.0, 1.0);                 // ridge flanks: a cooler, slightly darker tone
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.88, 0.92, 1.0), fl * (1.0 - smoothstep(0.08, 0.25, tsH)));
    diffuseColor.rgb *= mix(vec3(0.94, 0.96, 1.0), vec3(1.04), smoothstep(0.02, 0.22, tsH));
    // wind-facing prows (slope rising downwind) bright and polished, lee faces in a cool shade: the relief reads
    // even under the flat dusk sky light
    float lee = clamp(dot(tsG, tsW) * 2.2, -1.0, 1.0);
    diffuseColor.rgb *= mix(vec3(1.0), lee > 0.0 ? vec3(1.05, 1.05, 1.04) : vec3(0.86, 0.9, 0.98), abs(lee));
    // macro states: polished hard-pack slightly greyer-blue, fresh snow a touch brighter
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.9, 0.925, 0.96), tsPol) * (1.0 + 0.04 * tsFresh);
  }`);
    fs = after(fs, '#include <roughnessmap_fragment>', /*glsl*/`
  float tsSpk = 0.0;
  vec3 tsSpN = vec3(0.0, 1.0, 0.0);
  {
    roughnessFactor = clamp(roughnessFactor - 0.12 * tsP - 0.32 * tsPol + 0.05 * tsFresh, 0.3, 1.0);
    float fd = 1.0 - smoothstep(2.5, 12.0, tsDist);
    if (fd > 0.0) {
      vec2 cq = tsWp * 70.0;
      vec3 hh = hash3i(ivec3(ivec2(floor(cq)), 97));
      float cellPx = length(fwidth(cq));
      float vis = fd * (1.0 - smoothstep(0.5, 1.1, cellPx)) * (1.0 - 0.7 * tsP) * (1.0 - 0.75 * tsPol);
      if (hh.z > 0.993 - 0.008 * tsFresh && vis > 0.0) {
        tsSpk = vis;
        tsSpN = normalize(vec3(hh.x - 0.5, 1.15, hh.y - 0.5));
        roughnessFactor = mix(roughnessFactor, 0.14, vis);
      }
    }
  }`);
    fs = after(fs, '#include <normal_fragment_maps>', /*glsl*/`
  {
    normal = normalize(normal + mat3(viewMatrix) * vec3(-tsG.x, 0.0, -tsG.y));
    if (tsSpk > 0.0) normal = normalize(mix(normal, normalize(mat3(viewMatrix) * tsSpN), tsSpk));
  }`);
    // the look patch's sun glints: only on fresh snow (on the hard-pack they read as uniform sandpaper specks)
    fs = fs.replace('gh.z > 0.985 && fade > 0.0', 'gh.z > 0.985 + 0.013 * (1.0 - tsFresh) && fade > 0.0');
    // hard-pack and paths: the tiling crust bake's fine grain is mostly polished away
    fs = fs.replace('mapN.xy *= normalScale * sgNF;', 'mapN.xy *= normalScale * sgNF * tsMapK;');
    shader.vertexShader = vs; shader.fragmentShader = fs;
  });
}
