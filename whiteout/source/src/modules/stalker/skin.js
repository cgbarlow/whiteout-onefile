// Stalker skin: wet near-black hide (ART palette `stalker` #1A1C20) on MeshPhysicalMaterial (clearcoat = the wet film)
// + one engine/patch.js patch 'stalkerSkin'. Everything is procedural in bind space (vBind: it rides the skin as it
// moves) and every octave fades out before its wavelength drops under ~2 px (skW + fwidth), so nothing shimmers.
//   - albedo: livid blue-black bruising and warm flushed patches, dark veins over the thin skin, pale stretched hide
//     over bone, three healed claw rakes across the chest + two over the back + one down the right thigh (pale ridged
//     scar tissue with a dark scab core), black grime packed into every crevice (aSkin.w = baked AO), yellowed
//     keratin claws and teeth (aSkin.z)
//   - micro relief (bump from dFdx/dFdy of a height): stretched wrinkles, pores, fold rings over the knees, elbows and
//     throat, cord-like tendons down the limbs, raised veins and scars
//   - roughness: wet runs and patches (glossy, clearcoated) on tacky matt hide, dry frost, glossy keratin
//   - frost: hoarfrost grains on the up-facing ridges of the shoulders / back / skull (aSkin.x), never a painted patch
//   - subsurface: thin parts (aSkin.y: fingers, ears of the jaw, brow, ribs, lips) pass the light they receive on as
//     deep red, and glow when the low dusk sun is behind them
//   - a cold wet rim from the haze in-scatter colour so the silhouette separates from mid-tone backgrounds
// Then the shared weathering (no snow / dust: the frost replaces it) and, at finalizeMaterials, the atmos fog.
import { MeshPhysicalMaterial, Color } from 'three';
import { patch, after, before } from '../../cookbook/engine/patch.js';
import { patchWeathering, ensureNoise } from '../../cookbook/materials/weathering.js';
import { PALETTE } from '../../art.js';

const LIB = /*glsl*/`
float skPx = 0.002;                                    // bind-space metres per pixel (set at the top of main)
float skW(float f) { return 1.0 - smoothstep(0.16, 0.42, f * skPx); }
float skBand(float d, float w) { float aa = max(w * 0.5, skPx * 1.5); return 1.0 - smoothstep(w * 0.35, w * 0.35 + aa, abs(d)); }
// healed claw rakes: 0..1 scar mask (x) and the scab core (y)
vec2 skScar(vec3 b) {
  float s = 0.0, c = 0.0;
  if (b.y > 1.55 && b.y < 2.0) {
    // chest: three diagonal rakes from the left pectoral down across the sternum
    float u = b.x * 0.78 + (b.y - 1.78) * 0.62, v = -b.x * 0.62 + (b.y - 1.78) * 0.78;
    float m = smoothstep(0.02, 0.07, b.z) * (1.0 - smoothstep(0.07, 0.12, abs(v + 0.01)));
    for (int i = 0; i < 3; i++) {
      float d = u - (-0.035 + float(i) * 0.03) + sin(v * 47.0 + float(i)) * 0.0025;
      s = max(s, skBand(d, 0.009) * m); c = max(c, skBand(d, 0.0035) * m);
    }
    // upper back: two rakes over the right scapula
    float u2 = b.x * 0.55 - (b.y - 1.84) * 0.83, v2 = b.x * 0.83 + (b.y - 1.84) * 0.55;
    float m2 = smoothstep(-0.06, -0.1, b.z) * (1.0 - smoothstep(0.06, 0.1, abs(v2 + 0.08)));
    for (int i = 0; i < 2; i++) {
      float d = u2 - (-0.02 + float(i) * 0.034) + sin(v2 * 39.0) * 0.003;
      s = max(s, skBand(d, 0.011) * m2); c = max(c, skBand(d, 0.004) * m2);
    }
  }
  if (b.x < -0.07 && b.y > 0.78 && b.y < 1.16) {
    // down the front of the right thigh
    float d = b.x + 0.118 - (b.y - 0.97) * 0.12 + sin(b.y * 31.0) * 0.004;
    float m = smoothstep(0.0, 0.04, b.z) * (1.0 - smoothstep(0.12, 0.18, abs(b.y - 0.97)));
    s = max(s, skBand(d, 0.012) * m); c = max(c, skBand(d, 0.0045) * m);
  }
  return vec2(s, c);
}
float skVein(vec3 b) {
  float n = vnoise3(b * vec3(24.0, 7.0, 24.0) + 11.0) * 0.7 + vnoise3(b * 61.0) * 0.3;
  return pow(1.0 - abs(n * 2.0 - 1.0), 14.0) * skW(24.0);
}
float skH(vec3 b, vec2 scar, float vein) {
  float wr = vnoise3(b * vec3(70.0, 18.0, 70.0)) * 0.55 * skW(70.0) + vnoise3(b * vec3(160.0, 45.0, 160.0)) * 0.3 * skW(160.0);
  float pore = vnoise3(b * 420.0) * skW(420.0);
  // fold rings over the joints (knees, elbows, throat), broken up so they never read as a lathe
  float joint = exp(-pow((b.y - 0.665) / 0.05, 2.0)) * step(0.06, abs(b.x))
              + exp(-pow((b.y - 1.45) / 0.06, 2.0)) * step(0.22, abs(b.x))
              + exp(-pow((b.y - 2.0) / 0.045, 2.0)) * step(abs(b.x), 0.07);
  float folds = (0.5 + 0.5 * sin(b.y * 210.0 + vnoise3(b * 28.0) * 5.0)) * joint * skW(33.0);
  float tend = 0.5 + 0.5 * sin(atan(b.z, abs(b.x) - 0.25) * 9.0);
  tend *= step(0.18, abs(b.x)) * step(b.y, 1.5) * step(0.9, b.y);
  float lump = vnoise3(b * 24.0 + 7.0) * skW(24.0);                  // lumpy flesh, breaks the wet highlight
  return lump * 0.9 + wr * 0.5 + pore * 0.12 + folds * 0.7 + tend * 0.3 + scar.x * 1.1 - scar.y * 0.6 + vein * 0.5;
}`;

export function createSkin() {
  const mat = new MeshPhysicalMaterial({
    color: new Color(PALETTE.stalker), roughness: 0.62, metalness: 0, vertexColors: true,
    clearcoat: 0.5, clearcoatRoughness: 0.3, specularIntensity: 0.36,
  });
  mat.name = 'stalker';
  patch(mat, 'stalkerSkin', (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aSkin;\nvarying vec4 vSkin;\nvarying vec3 vBind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkin = aSkin;\nvBind = position;');
    let fs = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vSkin;\nvarying vec3 vBind;');
    fs = fs.replace('#include <common>', '#include <common>\n' + LIB);
    fs = fs.replace('void main() {', 'void main() {\n  skPx = max(length(fwidth(vBind)), 1e-5);\n  vec2 skSc = skScar(vBind);\n  float skVn = skVein(vBind) * (0.35 + 0.65 * vSkin.y);');
    fs = after(fs, '#include <normal_fragment_maps>', /*glsl*/`
  {
    float h0 = skH(vBind, skSc, skVn);
    vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
    float hx = dFdx(h0), hy = dFdy(h0);
    vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
    float det = dot(dpx, r1);
    vec3 grad = sign(det) * (hx * r1 + hy * r2);
    float bumpK = 0.0036 * (1.0 - smoothstep(7.0, 20.0, length(vViewPosition)));   // ~3 mm relief
    normal = normalize(abs(det) * normal - grad * bumpK);
  }`);
    // the wet film follows the same relief (three starts the clearcoat from the unperturbed normal)
    fs = after(fs, '#include <clearcoat_normal_fragment_begin>', '#ifdef USE_CLEARCOAT\n  clearcoatNormal = normalize(mix(nonPerturbedNormal, normal, 0.8));\n#endif');
    // wet film in runs and patches (streaks stretched down the body), tacky matt skin between them
    fs = after(fs, '#include <roughnessmap_fragment>', /*glsl*/`
  float skWet = smoothstep(0.52, 0.78, vnoise3(vBind * vec3(13.0, 4.0, 13.0) + 3.0) * 0.7 + vnoise3(vBind * 31.0) * 0.3 * skW(31.0) + 0.15 * (1.0 - vSkin.w));
  roughnessFactor = mix(0.8, 0.36, skWet) - (vnoise3(vBind * 90.0) - 0.5) * 0.16 * skW(90.0);
  roughnessFactor = mix(roughnessFactor, 0.6, skSc.x);
  roughnessFactor = mix(roughnessFactor, 0.32, vSkin.z);`);
    fs = after(fs, '#include <color_fragment>', /*glsl*/`
  float skFrost = 0.0;
  {
    vec3 b = vBind;
    float ao = vSkin.w, thin = vSkin.y;
    // large blotches: livid blue-black bruising and warm flushed hide where it is thin
    float bl = vnoise3(b * 6.0 + 2.0) * 0.65 + vnoise3(b * 15.0) * 0.35;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.013, 0.016, 0.03), smoothstep(0.55, 0.75, bl) * 0.8);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.017, 0.01, 0.01), smoothstep(0.5, 0.2, bl) * thin * 0.5);
    // pale hide stretched over bone (ridges: open + thin), dark veins in the thin skin
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.045, 0.042, 0.046), smoothstep(0.75, 1.0, ao) * thin * thin * 0.5);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.004, 0.007, 0.022), skVn * 0.75);
    // scars: pale pink-grey ridged tissue, a dark scab line down the middle
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.085, 0.06, 0.058), skSc.x * 0.85);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.006, 0.005), skSc.y * 0.8);
    // grime packed into the crevices
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0035, 0.003, 0.0025), (1.0 - smoothstep(0.3, 0.8, ao)) * 0.8);
    // keratin: yellowed teeth and claws, darker toward the tips
    vec3 ker = vec3(0.13, 0.11, 0.075) * (0.7 + 0.3 * vnoise3(b * 300.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, ker, vSkin.z);
    // hoarfrost: fine grains on the up-facing ridges (a flat average once the grains drop under 2 px)
    float grain = vnoise3(b * 520.0), wg = skW(520.0);
    float cov = vSkin.x * smoothstep(0.55, 0.9, ao) * (vnoise3(b * 40.0) * 0.6 + 0.4);
    skFrost = mix(cov * 0.35, smoothstep(0.62 - cov * 0.35, 0.82 - cov * 0.35, grain) * cov, wg) * 0.85;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.4, 0.46), skFrost);
  }`);
    fs = after(fs, '#include <lights_physical_fragment>', /*glsl*/`
  material.roughness = mix(material.roughness, 0.82, skFrost);
#ifdef USE_CLEARCOAT
  material.clearcoatRoughness = mix(0.5, 0.2, skWet);
  material.clearcoat *= (1.0 - skFrost) * max(skWet, vSkin.z) * (1.0 - skSc.x * 0.7);
#endif`);
    // subsurface: thin flesh passes on part of the light it receives as deep red (exact irradiance from the lit
    // diffuse: directDiffuse = irradiance × albedo / π)
    fs = after(fs, '#include <lights_fragment_end>', /*glsl*/`
  {
    // only the truly thin parts (fingers, lips, brow, jaw edge): the term is of the order of the hide's own albedo
    float th = pow(vSkin.y, 4.0) * (1.0 - vSkin.z) * (1.0 - skFrost);
    vec3 inv = 1.0 / max(material.diffuseColor, vec3(0.002));
    reflectedLight.directDiffuse += reflectedLight.directDiffuse * inv * th * vec3(0.012, 0.002, 0.0015);
    reflectedLight.indirectDiffuse += reflectedLight.indirectDiffuse * inv * th * vec3(0.008, 0.0015, 0.001);
  }`);
    fs = before(fs, '#include <emissivemap_fragment>', /*glsl*/`
  {
    vec3 V = normalize(vViewPosition);                        // view space, surface → camera
    float NoV = clamp(dot(normal, V), 0.0, 1.0);
    float rim = pow(1.0 - NoV, 3.0);
    vec3 sunV = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
    float back = pow(clamp(dot(-V, sunV), 0.0, 1.0), 4.0);    // the sun behind the creature, facing the camera
    float thin = vSkin.y;
    totalEmissiveRadiance += uSunColor * vec3(0.42, 0.1, 0.07) * back * (0.022 * thin * thin + 0.03 * rim) * (1.0 - skFrost);
    // cold wet rim: the haze colour caught on grazing wet hide (the silhouette never sinks into a mid-tone wall)
    totalEmissiveRadiance += uFogScatter * pow(1.0 - NoV, 4.0) * (0.015 + 0.08 * skWet) * (1.0 - skFrost * 0.6) * (0.4 + 0.6 * vSkin.w);
  }`);
    shader.fragmentShader = fs;
    ensureNoise(shader); // lands right after <common>, ahead of the LIB which uses vnoise3
  });
  patchWeathering(mat, { snow: 0, dust: 0, beads: 0.3, porosity: 0.2, macro: 0.4 });
  return mat;
}
