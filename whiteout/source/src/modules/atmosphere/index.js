// ATMOSPHERE (blizzard), 3 draws:
//   1. falling snow   cookbook weather/snow.js (9 k on high, uSnow cover) with the flakes.js shader upgrade:
//                     streaks, no near-lens bokeh, integrated wind, shelter culling, flashlight glints
//   2. blowing snow   sheets.js: 7 ground-hugging layers (0-1.2 m) streaming along the wind, soft against drifts
//   3. plumes + motes particles.js: roof-edge plumes in gusts + ice motes lit only by the flashlight cone
// A gust cycle (shared.js gustAt, ~20-30 s, analytic so particles know the gust at their birth) thickens the shared
// fog (uFogSigma ×1 → ×GUST_FOG), speeds up and tilts the flakes, thickens the sheets and grows the plumes.
//   create(G, { station }) → { snow, dust, sheets, gust (0..1), visibility (m, T = 2%), indoor (bool), update }
// Indoor (camera in a station.insideAt zone): flakes never exist inside shelters (culled per flake), and the
// outdoor layers thin out while the camera is inside. Allocation-free update. Deterministic under ?dt (G.t).
// ?gust=0..1 pins the gust (look dev); ?show=atmosphere pins it at 0.8 so the showcase frames a gust.
import { createSnow } from '../../cookbook/weather/snow.js';
import { patchUniforms } from '../../cookbook/engine/patch.js';
import { damp } from '../../cookbook/engine/springs.js';
import { gustAt, createSpot, syncSpot, shelterUniforms, roofEdges, createLamps } from './shared.js';
import { upgradeFlakes } from './flakes.js';
import { bakeField, createSheets } from './sheets.js';
import { createParticles } from './particles.js';

const GUST_FOG = 2.2;   // fog multiplier at the peak of a gust (visibility ~230 m → ~105 m at T = 2%)
const SNOW_BOX = [20, 10, 20];

export function create(G, { station } = {}) {
  const ART = G.ART, wx = ART.weather, amt = wx.amount ?? 0.8;
  const wind0 = wx.wind.slice(), base = ART.fog.sigma.slice();
  const heightAt = G.mods?.terrain?.heightAt || null;

  // 1. falling snow (cookbook system + shader upgrade)
  const snow = createSnow(G, { amount: amt, cover: ART.surface.snow, size: 0.013, turbulence: 1.3, groundY: -50,
    fall: 1.5, box: SNOW_BOX, minPx: 1.5, opacity: 0.85 });
  const spot = createSpot();
  const lamps = createLamps(G);   // work-light floodlights: lit flakes, lit blowing snow, volumetric beams
  const shelter = shelterUniforms();
  const su = upgradeFlakes(snow, spot, shelter, lamps.uniforms,
    { maxPx: 3.5, shutter: 0.016, maxStreak: 48, spotGain: 0.018, lampGain: 0.024, focus: 6, coc: 2.6, maxCoc: 14 });

  // 2. blowing-snow sheets (height + openness field baked once from the terrain)
  const field = bakeField(heightAt);
  const sheets = createSheets(G, { field, spot, lamps: lamps.uniforms, shelter, wind: wind0 });
  const sh = sheets.uniforms;
  snow.mesh.add(sheets.mesh);          // until post exists: parked under the snow mesh (draws nothing without zFull)

  // 3. roof plumes + flashlight motes
  const parts = createParticles(G, { spot, edges: roofEdges(wind0), wind: wind0 });
  const pu = parts.uniforms;
  G.scene.add(parts.mesh);
  const dust = { mesh: parts.mesh, uniforms: pu, get amount() { return pu.uMotes.value; }, set amount(v) { pu.uMotes.value = v; } };

  const sig = patchUniforms.uFogSigma?.value;
  const sheetK = parseFloat(G.params?.get('sheets') || '1');   // look-dev multiplier for the blowing-snow layers
  const pin = G.params?.get('gust');
  const lampAirK = parseFloat(G.params?.get('lampair') || '1');  // look-dev multiplier for the work-light airlight
  const airK0 = sh.uLampAirK.value * lampAirK;
  if (G.params?.get('torch') === '0') {                            // look-dev: torch off (isolate the work lights)
    const off = () => G.mods?.flashlight?.setOn?.(false);
    G.on('ready', off); G.on('game:start', off);
  }
  const A = { snow, dust, sheets, gust: 0, visibility: Math.log(50) / base[1], indoor: false, selfUpdating: false,
    hold: pin != null && pin !== '' ? Math.min(1, Math.max(0, parseFloat(pin))) : null };
  const windOff = su.uWindOff.value, windVel = su.uWindVel.value;
  let indoorK = 0, inPost = false;

  // after warm-up (programs compiled in-scene), move the layers into post.transparent for soft depth fades
  const toPost = () => {
    const tr = G.post && G.post.transparent;
    if (!tr || inPost) return;
    tr.add(sheets.mesh); tr.add(parts.mesh); inPost = true;
  };
  G.on('ready', toPost);

  A.update = (dt, t) => {
    const g = A.hold != null ? A.hold : gustAt(t);
    A.gust = g;
    // fog thickens with the gust (shared by every patched material, sky, far field and particles)
    const k = 1 + (GUST_FOG - 1) * g;
    if (sig) sig.set(base[0] * k, base[1] * k, base[2] * k);
    A.visibility = Math.log(50) / (base[1] * k);
    // wind: stronger and veering slightly in gusts; positions integrate it (no jumps when it changes)
    const ws = 1 + 1.1 * g, veer = 0.18 * g * Math.sin(t * 0.7);
    windVel.set(wind0[0] * ws - wind0[2] * veer, 0, wind0[2] * ws + wind0[0] * veer);
    windOff.addScaledVector(windVel, dt);
    su.uTurb.value = 1.2 + 0.9 * g;
    // indoor: thin the outdoor layers (flakes are culled inside shelters per flake anyway)
    const cam = G.camera.position;
    A.indoor = !!(station?.insideAt && station.insideAt(cam.x, cam.z));
    indoorK = damp(indoorK, A.indoor ? 1 : 0, 5, dt);
    snow.amount = Math.min(1, amt * (1 + 0.25 * g)) * (1 - 0.45 * indoorK);
    // wrap box sits on the ground under the camera (bottom face 0.6 m under the snow)
    const gy = heightAt ? heightAt(cam.x, cam.z) : 0;
    su.uBoxLift.value = 0.5 * SNOW_BOX[1] - Math.min(Math.max(cam.y - gy + 0.6, 0), 0.5 * SNOW_BOX[1]);
    su.uGroundY.value = gy - 1.5;
    // flashlight
    syncSpot(spot, G.mods?.flashlight?.light);
    lamps.sync();
    // sheets
    sh.uT.value = t; sh.uGust.value = g; sh.uGroundCam.value = gy; sh.uAmt.value = sheetK * (1 - 0.7 * indoorK); sh.uFarK.value = sheetK * (1 - indoorK);
    sh.uOff.value.addScaledVector(windVel, dt * 0.8);
    sh.uSnowOff.value.set(windOff.x, -1.5 * t, windOff.z);
    sh.uLampAirK.value = airK0 * (1 - indoorK);   // no work-light beam integrated while the camera is indoors
    sh.uSunDirB.value.copy(G.sun.dir);
    sh.uSunB.value.set(G.sun.color.r, G.sun.color.g, G.sun.color.b).multiplyScalar(G.sun.intensity);
    // plumes + motes (outdoors motes ride the wind, indoors they hang in the air)
    pu.uT.value = t;
    G.renderer.getDrawingBufferSize(pu.uRes.value);
    pu.uSunDirP.value.copy(sh.uSunDirB.value); pu.uSunP.value.copy(sh.uSunB.value);
    pu.uPlume.value = 1 - 0.5 * indoorK;
    const mv = 0.5 * (1 - indoorK);
    pu.uMoteOff.value.x += (windVel.x * mv + 0.04 * indoorK) * dt;
    pu.uMoteOff.value.z += (windVel.z * mv + 0.02 * indoorK) * dt;
    pu.uMoteOff.value.y += (-0.35 * (1 - indoorK) + 0.01) * dt;
    // soft-particle depth (valid only once the layers draw in post.transparent)
    if (!inPost && G.frame > 0 && G.post && window.__ready) toPost();
    const z = inPost ? G.post.targets?.zFull : null;
    const zt = z ? z.texture : null;
    sh.tZ.value = zt; pu.tZ.value = zt;
    sh.uHasZ.value = pu.uHasZ.value = zt ? 1 : 0;
  };
  A.dispose = () => {
    G.off?.('ready', toPost);
    sheets.mesh.parent?.remove(sheets.mesh); parts.mesh.parent?.remove(parts.mesh);
    snow.dispose?.(); sheets.dispose(); parts.dispose();
    if (sig) sig.fromArray(base);
  };
  return A;
}

// ?show=atmosphere: low, across the wind (flakes stream left → right instead of fanning from the vanishing point),
// the lab work light in the left third with its beam and pool, mid-gust. The torch is off: every light in the frame
// has a visible source.
export const SHOW_CAM = [8.5, 0.8, 9.6, 15, 2.4, -1];
export function showcase(G) {
  const A = G?.mods?.atmosphere;
  if (A && A.hold == null) A.hold = 0.8;
  const torchOff = () => G.mods?.flashlight?.setOn?.(false);
  torchOff();
  G.on?.('ready', torchOff);
  G.on?.('game:start', torchOff);
  return { cam: SHOW_CAM.slice(0, 3), target: SHOW_CAM.slice(3, 6) };
}
