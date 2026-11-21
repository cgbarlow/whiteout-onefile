// WHITEOUT look: the shared world materials handed to every module as `mats` (keys are the module contract; see
// OWNERS.md). Look-director owned. Every material comes from materials/library.js (baked PBR + weathering); the
// game-specific surfaces live in look/surfaces.js. Two world-space patches (engine/patch.js) add what a tiling bake
// cannot:
//   snowGround  'snowgnd'  broad wind drifts + sastrugi stretched along ART.weather.wind (world metres, never tile),
//                          map-normal faded with distance (no moire band toward the horizon), macro albedo, blue
//                          hollows, and a sparse sun glint (stable, distance-faded).
//   interior    'labwear'  grime clustered at floor contact and room corners, soot along the ceiling edges, a
//                          polished wear path down the lab aisle and dirt along the skirting (LAYOUT lab box).
import { MeshStandardMaterial, Color, Vector2, Vector4 } from 'three';
import { makeMaterial } from '../cookbook/materials/library.js';
import { ensureWorldVaryings, ensureNoise } from '../cookbook/materials/weathering.js';
import { patch, after, before, sharedUniform } from '../cookbook/engine/patch.js';
import { registerLookSurfaces } from './surfaces.js';
import { ART } from '../art.js';

const SNOW_COMMON = /*glsl*/`
vec2 sgWind() { return normalize(vec2(SG_WX, SG_WZ)); }
// broad snow relief in metres: long drifts across the wind + sastrugi tongues stretched along it
float sgH(vec2 p) {
  vec2 w = sgWind(), q = vec2(dot(p, w), dot(p, vec2(-w.y, w.x)));
  float drift = vnoise(q * vec2(0.03, 0.055), 11.0) * 0.65 + vnoise(q * vec2(0.08, 0.14) + 7.3, 12.0) * 0.35;
  float sast = vnoise(q * vec2(0.16, 0.7) + 3.1, 13.0);
  sast = smoothstep(0.35, 0.9, sast) * (0.5 + 0.5 * vnoise(q * vec2(0.05, 0.09) + 1.7, 14.0));
  return drift * 0.55 + sast * 0.09;
}
`;

function patchSnowGround(mat) {
  const w = ART.weather.wind;
  patch(mat, 'snowgnd', (shader) => {
    ensureWorldVaryings(shader); ensureNoise(shader);
    let fs = shader.fragmentShader;
    if (!fs.includes('varying vec3 vWthPos')) fs = fs.replace('#include <common>', '#include <common>\nvarying vec3 vWthPos;\nvarying vec3 vWthN;');
    fs = fs.replace('void main() {', `#define SG_WX ${(+w[0] || 1).toFixed(3)}\n#define SG_WZ ${(+w[2] || 0).toFixed(3)}\n#define SG_FLAT 0.25\n` + SNOW_COMMON + 'void main() {');
    // broad relief sampled once per pixel (centre + 2 taps for the slope)
    fs = after(fs, 'void main() {', /*glsl*/`
  float sgDist = length(vViewPosition);
  float sgH0 = sgH(vWthPos.xz);
  vec2 sgG = vec2(sgH(vWthPos.xz + vec2(0.35, 0.0)) - sgH0, sgH(vWthPos.xz + vec2(0.0, 0.35)) - sgH0) / 0.35;
  float sgNF = mix(1.0, 0.18, smoothstep(4.0, 38.0, sgDist));`);
    fs = after(fs, '#include <color_fragment>', /*glsl*/`
  {
    float m = vnoise(vWthPos.xz * 0.045, 21.0) * 0.6 + vnoise(vWthPos.xz * 0.19 + 4.0, 22.0) * 0.4;
    diffuseColor.rgb *= 0.92 + 0.12 * m;
    float hollow = 1.0 - smoothstep(0.18, 0.5, sgH0);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.80, 0.88, 1.0), hollow * 0.35);
  }`);
    fs = fs.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * sgNF;');
    // the heightfield's own metre-scale sastrugi octaves light up like waves under a 7° sun: pull the geometric
    // normal 25 % toward up before the map is applied, then add the broad world-space relief back
    fs = before(fs, '#include <normal_fragment_maps>', /*glsl*/`
  {
    vec3 sgUp = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));
    normal = normalize(mix(normal, sgUp, SG_FLAT));
#if defined( USE_NORMALMAP_TANGENTSPACE )
    tbn[2] = normal;
#endif
  }`);
    fs = after(fs, '#include <normal_fragment_maps>', /*glsl*/`
  normal = normalize(normal + mat3(viewMatrix) * vec3(-sgG.x, 0.0, -sgG.y) * 2.6);`);
    // sparse glints: 1.2 cm cells, a random facet normal per cell lit by the (dim) sun; fades before it can alias
    fs = after(fs, '#include <emissivemap_fragment>', /*glsl*/`
  {
    vec2 gc = floor(vWthPos.xz * 85.0);
    vec3 gh = hash32(ivec2(gc), 31.0);
    float fade = 1.0 - smoothstep(3.0, 9.0, sgDist);
    if (gh.z > 0.985 && fade > 0.0) {
      vec3 V = normalize(cameraPosition - vWthPos);
      vec3 fn = normalize(vec3(gh.x - 0.5, 1.4, gh.y - 0.5));
      float spec = pow(max(dot(fn, normalize(V + normalize(uSunDir + vec3(0.0, 0.25, 0.0)))), 0.0), 60.0);
      totalEmissiveRadiance += (uSunColor * 0.06 + vec3(0.25, 0.3, 0.38)) * spec * fade;
    }
  }`);
    shader.fragmentShader = fs;
  });
  return mat;
}

// snow bounce: the shelf (albedo ~0.8) relights every down- and side-facing exterior surface. Without it the
// lean-to roofs, module undersides and the generator sides crush to black next to bright snow. Scaled by AO in post.
function patchBounce(mat) {
  patch(mat, 'bounce', (shader) => {
    ensureWorldVaryings(shader);
    let fs = shader.fragmentShader;
    if (!fs.includes('varying vec3 vWthPos')) fs = fs.replace('#include <common>', '#include <common>\nvarying vec3 vWthPos;\nvarying vec3 vWthN;');
    fs = after(fs, '#include <emissivemap_fragment>', /*glsl*/`
  {
    vec3 bN = normalize(vWthN);
    float bw = clamp(0.5 - 0.5 * bN.y, 0.0, 1.0); bw *= bw;
    float bh = 1.0 - smoothstep(1.0, 9.0, vWthPos.y);                       // fades with height above the shelf
    totalEmissiveRadiance += diffuseColor.rgb * uBounce * bw * (0.35 + 0.65 * bh);
  }`);
    shader.fragmentShader = fs;
  });
  return mat;
}

const WEAR_COMMON = /*glsl*/`
uniform vec4 uLabBox;   // x0, z0, x1, z1 (world)
uniform vec2 uLabY;     // floor y, ceiling y
`;
function patchLabWear(mat, box, ys) {
  const uBox = { value: new Vector4().fromArray(box) }, uY = { value: new Vector2(ys[0], ys[1]) };
  patch(mat, 'labwear', (shader) => {
    ensureWorldVaryings(shader); ensureNoise(shader);
    shader.uniforms.uLabBox = uBox; shader.uniforms.uLabY = uY;
    let fs = shader.fragmentShader;
    if (!fs.includes('varying vec3 vWthPos')) fs = fs.replace('#include <common>', '#include <common>\nvarying vec3 vWthPos;\nvarying vec3 vWthN;');
    fs = after(fs, '#include <common>', WEAR_COMMON);
    fs = after(fs, '#include <roughnessmap_fragment>', /*glsl*/`
  {
    vec3 wP = vWthPos, wN = normalize(vWthN);
    float n = vnoise(wP.xz * 3.1 + wP.y * 2.3, 41.0), n2 = vnoise(wP.xz * 0.9 + wP.y * 0.7, 42.0);
    float dw = min(min(wP.x - uLabBox.x, uLabBox.z - wP.x), min(wP.z - uLabBox.y, uLabBox.w - wP.z));
    float inside = step(-0.05, dw) * step(wP.y, uLabY.y + 0.05);
    float dirt = 0.0, polish = 0.0;
    if (abs(wN.y) < 0.5) {
      float base = 1.0 - smoothstep(0.0, 0.25 + 0.3 * n2, wP.y - uLabY.x);          // floor contact band
      float corner = 1.0 - smoothstep(0.0, 0.35 + 0.3 * n, dw);                       // vertical room corners
      float top = 1.0 - smoothstep(0.0, 0.25, uLabY.y - wP.y);                         // ceiling seam soot
      dirt = max(base * (0.55 + 0.45 * n), max(corner * 0.45, top * 0.4)) * (0.6 + 0.4 * n2);
    } else if (wN.y > 0.5 && wP.y < uLabY.x + 0.06) {
      float aisle = 1.0 - smoothstep(0.35, 1.1 + 0.4 * n2, abs(wP.z - 0.5 * (uLabBox.y + uLabBox.w)));
      polish = aisle * (0.5 + 0.5 * n2);
      dirt = (1.0 - smoothstep(0.0, 0.6 + 0.4 * n, dw)) * 0.85 + smoothstep(0.6, 0.9, n) * 0.15 * (1.0 - aisle);
    } else if (wN.y < -0.5) {
      dirt = (1.0 - smoothstep(0.0, 0.6 + 0.3 * n, dw)) * 0.5;
    }
    dirt *= inside; polish *= inside;
    diffuseColor.rgb *= (1.0 - 0.6 * dirt) * (1.0 + 0.05 * polish);
    roughnessFactor = clamp(roughnessFactor + 0.3 * dirt - 0.38 * polish, 0.08, 1.0);
  }`);
    shader.fragmentShader = fs;
  });
  return mat;
}

/** Real materials (library bakes). `lab` = LAYOUT module with interior: true (for the world-space wear patch). */
export function buildMaterials(lab) {
  registerLookSurfaces();
  const ub = sharedUniform('uBounce', 'vec3', null);
  if (!ub.value) { const b = ART.ambient.bounce || [0.3, 0.32, 0.36]; ub.value = new Color(b[0], b[1], b[2]); }
  const vc = (m) => { m.vertexColors = true; return m; };
  const emis = (c, k, rough = 0.35, base = 0x0a0a0a) => new MeshStandardMaterial({ color: new Color(base), emissive: new Color().fromArray(c), emissiveIntensity: k, roughness: rough });
  const M = {
    // ground: compacted snow, matte, broad world-space drifts (no tiling ripples)
    snowGround: patchSnowGround(vc(makeMaterial('snow_crust', { weather: false, normal: 0.8 }))),
    paint: vc(makeMaterial('module_paint', { tint: 0xffffff })), steel: vc(makeMaterial('galvanised')), dark: vc(makeMaterial('plastic', { tint: 0xffffff })),
    concrete: vc(makeMaterial('concrete')), wood: vc(makeMaterial('wood_planks')),
    // interior (lab): own instances, 'sheltered' weathering; panels with seams, powder-coat/vinyl instead of zinc spangle
    iface: vc(makeMaterial('lab_panel', { weather: 'sheltered', tint: 0xffffff })),
    isteel: vc(makeMaterial('lab_coat', { weather: 'sheltered', tint: 0xffffff })),
    idark: vc(makeMaterial('plastic', { weather: 'sheltered', tint: 0xffffff })),
    glassLit: emis([1.0, 0.6, 0.3], 2.6, 0.25),         // sodium-lit frosted windows (outdoor modules)
    glassFrost: emis([0.16, 0.26, 0.46], 1.0, 0.2, 0x2a3442), // lab windows: blue dusk through frost
    lamp: emis([0.86, 0.92, 1.0], 7.0, 0.3),            // fluorescent tubes
  };
  for (const k of ['paint', 'steel', 'dark', 'concrete', 'wood']) patchBounce(M[k]);
  if (lab) {
    const [cx, cz] = lab.c, [sx, sz] = lab.size, f = lab.floor ?? 0.3, t = 0.1;
    const box = [cx - sx / 2 + t, cz - sz / 2 + t, cx + sx / 2 - t, cz + sz / 2 - t];
    for (const k of ['iface', 'isteel', 'idark']) patchLabWear(M[k], box, [f, f + lab.h]);
  }
  // the ground IS the snow: finalizeMaterials must not stack the weathering snow layer on it (that layer's
  // noise-broken normals were the 'lake ripple' at a grazing sun)
  M.snowGround.userData.noWeather = true;
  M.glassLit.userData.noWeather = true; M.lamp.userData.noWeather = true;
  return M;
}

/** Stub fallback (materials stage failed): flat colours with the same keys. */
export function flatMaterials() {
  const m = (c, r = 0.8, mt = 0) => { const x = new MeshStandardMaterial({ color: new Color(c), roughness: r, metalness: mt }); x.vertexColors = true; return x; };
  const e = (c, k) => new MeshStandardMaterial({ color: 0x0a0a0a, emissive: new Color(c), emissiveIntensity: k });
  return { snowGround: m(0xd9dfe6, 0.9), paint: m(0xffffff, 0.5), steel: m(0x8a8f96, 0.4, 1), dark: m(0x222428, 0.6), concrete: m(0x8a8680),
    wood: m(0x7a5a3a), iface: m(0xd0d2d4), isteel: m(0x8a8f96, 0.4, 1), idark: m(0x222428), glassLit: e(0xffb060, 2.6), glassFrost: e(0x8090a0, 0.7), lamp: e(0xdfe8ff, 7) };
}
