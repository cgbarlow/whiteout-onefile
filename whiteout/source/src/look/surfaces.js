// WHITEOUT look: game-specific baked surfaces, registered into the cookbook SURFACES table so makeMaterial() gives
// them the full pipeline (metric UVs, tint mask, weathering, spec AA). Written in the SURF_LIB dialect (periodic,
// whole-number frequencies per tile). Look-director owned.
//   snow_crust   compacted wind-packed snow: matte, granular, NO metre-scale ripples (the broad drift and sastrugi
//                shapes come from the world-space ground patch in look/materials.js, so they never tile)
//   module_paint exterior prefab paint: few clustered chips, broad soft dirt, faint vertical run streaks
//   lab_panel    interior vinyl-faced wall panels: 1.2 m vertical seams, orange peel, faint smudges (tint = colour)
//   lab_coat     powder-coated steel / sheet vinyl: fine stipple, light scuffs, no cell pattern
import { SURFACES } from '../cookbook/materials/surfaces.glsl.js';

const snowCrust = /*glsl*/`
void surf(vec2 uv, inout Surf s) {
  float lump = nfbm(warpP(uv, 1.0, 0.04, 2.0), 6.0, 4, 3.0);              // footprint-scale lumps ~15 cm
  float crust = nridge(warpP(uv, 2.0, 0.03, 7.0), 3.0, 3, 8.0);            // faint wind-crust plates
  float gran = nfbm(uv, 120.0, 2, 5.0), pit = nval(uv, 300.0, 6.0);
  float h = lump * 0.55 + crust * 0.15 + gran * 0.3 - smoothstep(0.78, 0.96, pit) * 0.08;
  vec3 col = vec3(0.78, 0.80, 0.84) * (0.95 + 0.07 * gran) * (0.97 + 0.05 * lump);
  col = mix(col, vec3(0.60, 0.69, 0.82), (1.0 - smoothstep(0.2, 0.5, h)) * 0.25);
  s.albedo = col; s.mask = 1.0; s.height = h;
  s.rough = 0.86 + 0.08 * gran - smoothstep(0.7, 0.9, crust) * 0.08;
  s.ao = 0.88 + 0.12 * smoothstep(0.2, 0.7, h);
}`;

const modulePaint = /*glsl*/`
void surf(vec2 uv, inout Surf s) {
  float zone = smoothstep(0.58, 0.8, nfbm(uv, 0.8, 4, 12.0));              // chips cluster in a few worn zones
  vec3 dmg = paintDamage(uv, 0.18 + 0.5 * zone, 20.0);
  float mid = nfbm(uv, 1.0, 4, 2.0), peel = nfbm(uv, 60.0, 2, 1.0);
  float dirt = smoothstep(0.4, 0.85, nfbm(uv, 0.75, 5, 3.0));
  float runs = nfbm2(uv, vec2(9.0, 0.6), 4, 4.0);                         // vertical grime runs (v = up)
  vec3 col = vec3(0.84) * (0.93 + 0.08 * mid) * (0.98 + 0.04 * peel);
  col = mix(col, rustColor(0.25), dmg.x);
  col = mix(col, rustColor(0.45), dmg.z * 0.5);
  col *= 1.0 - dirt * 0.16 - smoothstep(0.55, 0.85, runs) * 0.1;
  s.albedo = col;
  float paint = 1.0 - dmg.x;
  s.mask = paint * (1.0 - dmg.z * 0.5);
  s.metal = 0.0;
  s.rough = mix(0.5 + 0.1 * mid + 0.15 * dirt, 0.85, dmg.x);
  s.height = 0.5 + paint * 0.3 + peel * 0.05;
  s.ao = 1.0 - dmg.x * 0.2;
}`;

const labPanel = /*glsl*/`
void surf(vec2 uv, inout Surf s) {
  float seam = isoLine(abs(uv.x - 0.5) - 0.5, 0.006);                    // one butt joint per 1.2 m tile
  float seamHalo = 1.0 - smoothstep(0.0, 0.03, 0.5 - abs(uv.x - 0.5));
  float peel = nfbm(uv, 90.0, 2, 1.0), mid = nfbm(uv, 1.2, 4, 2.0);
  float smudge = smoothstep(0.55, 0.85, nfbm(warpP(uv, 1.0, 0.1, 3.0), 2.0, 4, 6.0));
  float scuff = scratches(uv, 3.0, 9.0, 0.002, 0.0, 0.15, 0.2, 0.5);
  vec3 col = vec3(0.80) * (0.95 + 0.06 * mid) * (0.985 + 0.03 * peel);
  col *= 1.0 - smudge * 0.07 - seamHalo * 0.08;
  col = mix(col, vec3(0.08), seam * 0.85);
  col = mix(col, col * 0.75, scuff * 0.5);
  s.albedo = col; s.mask = 1.0 - seam;
  s.rough = 0.55 + 0.1 * mid + 0.15 * smudge + 0.1 * scuff;
  s.height = 0.6 + peel * 0.04 - seam * 0.5 - seamHalo * 0.05;
  s.ao = 1.0 - seam * 0.5;
}`;

const labCoat = /*glsl*/`
void surf(vec2 uv, inout Surf s) {
  float st = nfbm(uv, 160.0, 2, 1.0), mid = nfbm(uv, 1.5, 4, 2.0);
  float wear = smoothstep(0.55, 0.85, nfbm(warpP(uv, 1.0, 0.08, 3.0), 2.5, 4, 5.0));
  float scuff = scratches(uv, 4.0, 7.0, 0.0015, 0.3, 0.5, 0.35, 0.6);
  vec3 col = vec3(0.70) * (0.95 + 0.06 * mid) * (0.97 + 0.05 * st);
  col *= 1.0 - wear * 0.08;
  col = mix(col, col * 0.7, scuff * 0.45);
  s.albedo = col; s.mask = 1.0;
  s.rough = 0.5 + 0.12 * st + 0.18 * wear + 0.1 * scuff;
  s.height = 0.5 + 0.1 * st - scuff * 0.1;
  s.ao = 1.0;
}`;

let done = false;
export function registerLookSurfaces() {
  if (done) return; done = true;
  SURFACES.snow_crust = { glsl: snowCrust, scale: 4, depth: 0.012, tint: 0xffffff, porosity: 0.2, ground: true, note: 'compacted wind-packed snow (matte, no ripples)' };
  SURFACES.module_paint = { glsl: modulePaint, scale: 3, depth: 0.0012, tint: 0xd4561e, porosity: 0.25, note: 'prefab exterior paint, clustered chips, soft dirt' };
  SURFACES.lab_panel = { glsl: labPanel, scale: 1.2, depth: 0.003, tint: 0xd0d2d4, porosity: 0.1, note: 'interior vinyl wall panels, 1.2 m seams' };
  SURFACES.lab_coat = { glsl: labCoat, scale: 1.5, depth: 0.0008, tint: 0xffffff, porosity: 0.1, note: 'powder-coated steel / sheet vinyl' };
}
