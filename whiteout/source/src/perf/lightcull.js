// Perf: per-fragment light culling for the forward light loop (all tiers, bit-identical output).
// three's lights_fragment_begin runs the full BRDF (and the spot shadow PCF taps) for every point / spot light on
// every fragment, even where the light contributes exactly zero: past its range (cutoff attenuation = 0), outside a
// spot cone, or for the FX flash lights parked at intensity 0. With 13 local lights in WHITEOUT that loop was half
// the frame. getPointLightInfo / getSpotLightInfo already compute `directLight.visible` (= colour != 0 / inside the
// cone), so we branch on it: the skipped work added 0.0, so the image does not change. Branches are spatially
// coherent (a light's range is metres wide), so the GPU really skips them. Patched once at import, before any compile.
import { ShaderChunk } from 'three';

const SRC = ShaderChunk.lights_fragment_begin;
const RE = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';

function cullSection(src, start, end) {
  const a = src.indexOf(start), b = src.indexOf(end, a);
  if (a < 0 || b < 0) return src;
  let body = src.slice(a, b);
  body = body.replace(RE, 'if ( directLight.visible ) { ' + RE + ' }');
  // spot shadow: only sample the map where the cone is lit (the ternary may be flattened by the compiler)
  body = body.replace(
    /directLight\.color \*= \( directLight\.visible && receiveShadow \) \? (getShadow\([^;]*\)) : 1\.0;/,
    'if ( directLight.visible && receiveShadow ) directLight.color *= $1;');
  return src.slice(0, a) + body + src.slice(b);
}

// sun: a fragment whose normal faces away from the light gets exactly zero from it (Lambert / GGX / sheen all scale
// by saturate(N.L)), so neither the PCSS lookup (8 blocker + 16-32 PCF taps) nor the BRDF needs to run there.
// Toon (N.L remapped through a gradient) and clearcoat (its own normal) keep the stock path.
const DIR_SH = /directLight\.color \*= \( directLight\.visible && receiveShadow \) \? (getShadow\( directionalShadowMap[^;]*\)) : 1\.0;/;
function cullSun(src) {
  const a = src.indexOf('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )'), b = src.indexOf('#pragma unroll_loop_end', a);
  if (a < 0 || b < 0) return src;
  let body = src.slice(a, b);
  if (!DIR_SH.test(body) || body.indexOf(RE) < 0) return src;
  // declared once outside the loop: three unrolls the body without braces (one copy per light)
  body = body.replace('#pragma unroll_loop_start', 'bool pcFacing = true;\n\t#pragma unroll_loop_start');
  body = body.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n' +
    '\t\t#if !defined( TOON ) && !defined( USE_CLEARCOAT )\n' +
    '\t\tpcFacing = dot( geometryNormal, directLight.direction ) > 0.0;\n\t\t#endif');
  body = body.replace(DIR_SH, 'if ( pcFacing && directLight.visible && receiveShadow ) directLight.color *= $1;');
  body = body.replace(RE, 'if ( pcFacing ) { ' + RE + ' }');
  return src.slice(0, a) + body + src.slice(b);
}

let patched = false;
export function installLightCull() {
  if (patched || SRC.indexOf(RE) < 0) return patched;
  let s = SRC;
  s = cullSection(s, '#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )', '#pragma unroll_loop_end');
  s = cullSection(s, '#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )', '#pragma unroll_loop_end');
  s = cullSun(s);
  ShaderChunk.lights_fragment_begin = s;
  patched = s !== SRC;
  return patched;
}
installLightCull();
