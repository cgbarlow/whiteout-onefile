// Art direction constants (schema: cookbook/CONTRACT.md). Thesis T3 "Overcast snow, research station"
// (references/art-direction.md), adapted to DUSK + a rising BLIZZARD for WHITEOUT. Colours are LINEAR RGB; intensities HDR.
// Change one knob per critic round (look-director). Read-only at runtime (gusts modulate shared uniforms, not ART).
export const ART = {
  // last dusk light bleeding through the overcast, low in the west-south-west; capped at 3 (overcast, soft shadows)
  sun:   { elevDeg: 7, azimDeg: 255, color: [1.0, 0.56, 0.30], intensity: 3.0 },
  sky:   { zenith: [0.09, 0.11, 0.16], horizon: [0.38, 0.44, 0.53], groundTint: [0.62, 0.65, 0.70],
           cloudCover: 0.94, cloudSharp: 0.18, sunGlow: 0.6, burnGap: 0.22, diskRadiance: 6 },
  // whiteout: shapes dissolve at 60-90 m; horizon colour = scatter (keep sky.horizon close to it)
  fog:   { sigma: [0.017, 0.017, 0.016], scatter: [0.36, 0.43, 0.53], heightFalloff: 0.13, baseHeight: 0.0,
           sunInscatter: 2.2, start: 2.5 },
  vol:   { density: 0.012, g: 0.35, steps: 16, strength: 0.35, shaft: 1.3 }, // r1 D2: shaft/strength down, no camera-near cone
  ambient: { skyIntensity: 1.8, envIntensity: 2.2, probeIntensity: 0.6, bounce: [0.55, 0.58, 0.66] }, // bounce: snow relight of exterior down/side faces (look/materials.js)
  grade: { exposure: 0.95, adaptKey: 0.135, agxMix: 0.65, lookPower: 1.18, sat: 0.92, contrast: 0.24,
           splitShadow: [0.86, 0.97, 1.14], splitHigh: [1.08, 1.0, 0.90], vignette: 0.38,
           bloom: 0.05, bloomThreshold: 2.0, lensDirt: 0.12, chroma: 0.0012, grain: 0.035, sharpen: 0.28,
           adaptMin: 0.25, adaptMax: 1.0, adaptTau: 2.0 }, // r1 D2: AgX-heavier shoulder, capped push-up, higher bloom knee: lit tanks roll off, no orbs
  // post extras (look/post.js): shafts depth, contact AO under skids/crates (weak sun: AO carries the grounding)
  post:  { volShaft: 1.3, aoRadius: 1.1, aoIntensity: 3.2 },
  surface: { wet: 0.05, dust: 0.0, snow: 0.85, macroVar: 0.22 },
  weather: { kind: 'snow', amount: 0.8, wind: [6.0, 0, 2.0], lightning: false },
};

// Named palette (linear approximations of the sRGB hex in ART.md) for modules that tint vertex colours / emissives.
export const PALETTE = {
  snow: 0xd9dfe6, shadowBlue: 0x7c8a9c, moduleOrange: 0xd4561e, sodium: 0xffb060, steel: 0x5a6068, ice: 0xa8c4d6,
  beaconRed: 0xff2a1a, fluoro: 0xdfe8ff, stalker: 0x1a1c20,
};
