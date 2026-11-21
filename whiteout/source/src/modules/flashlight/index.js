// FLASHLIGHT (the hero light the player owns).
//  - SpotLight, 512² shadow map (256 on low), plain PCF (shadow.radius < 0, see lighting/README), procedural lens
//    cookie (cookie.js: hot core, reflector ring, spill, smudges) used by the light AND the volumetric beam.
//  - Aim lags the view through a damped angular spring (heavy torch in a gloved hand), plus walk sway; snaps on
//    harness camera cuts ('camset').
//  - Battery drains over RULES.battery s; below 30 % the output sags and warms, below 15 % it browns out (smooth sag
//    + stutter drop-outs), at 0 it dies. Switching on ramps over ~80 ms with a tiny settle flicker.
//  - Volumetric beam (beam.js) + held view model (viewmodel.js), both drawn on the post pipeline's 'posttransparent'
//    event (HDR target, opaque depth available): beam additive and depth-clipped, view model in depthRange(0, .05).
//  create(G) → { on, battery, level, light, vm, beam, toggle(), setOn(b), refill(), beamHits(pos, r), update }
//  ?shot: on, full battery, no flicker, lag snapped. Allocation-free update.
import { SpotLight, Object3D, Vector2, Vector3, Quaternion, Color } from 'three';
import { RULES } from '../../contracts.js';
import { makeCookie } from './cookie.js';
import { createBeam } from './beam.js';
import { createViewModel } from './viewmodel.js';

const INTENSITY = 1350;                     // cd at full charge (decay 1.6): the pool still reads 15 m out in the blizzard
const INDOOR_K = 0.6;                       // in the lab the eye adapts to the dark room: lit white paint keeps its detail
const OFFSET = new Vector3(0.16, -0.16, -0.05); // lamp origin in camera space (inside the player radius: no wall poke)
const COL_FULL = new Color(1.0, 0.9, 0.76), COL_LOW = new Color(1.0, 0.74, 0.5);
const _f = new Vector3(), _d = new Vector3(), _l = new Vector3(), _a = new Vector3(), _qi = new Quaternion(), _wind = new Vector3();

// cheap smooth 1D noise (allocation-free) for the brown-out
const h1 = (i) => { const x = Math.sin(i * 127.1 + 74.7) * 43758.5453; return x - Math.floor(x); };
const n1 = (t) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return h1(i) * (1 - u) + h1(i + 1) * u; };

export function create(G) {
  const shot = !!G.params.get('shot');
  const low = G.quality.tier === 'low';
  const cookie = makeCookie(256);
  const light = new SpotLight(COL_FULL.getHex(), INTENSITY, 26, 0.5, 0.32, 1.6); // range window ≈ blizzard extinction past ~18 m
  light.castShadow = true;
  light.shadow.mapSize.set(low ? 256 : 512, low ? 256 : 512);
  light.shadow.radius = -2;               // PCSS opts out: plain PCF on the perspective spot map
  light.shadow.bias = -0.0004; light.shadow.normalBias = 0.03;
  light.shadow.camera.near = 0.15; light.shadow.camera.far = 26;
  light.map = cookie;
  light.name = 'flashlight';
  const target = new Object3D(); light.target = target;
  G.scene.add(light, target);

  const beam = createBeam(G, { cookie, steps: low ? 8 : 14 });
  const vm = createViewModel(G);
  const W = G.ART.weather?.wind || [6, 0, 2];
  _wind.set(W[0], W[1], W[2]);
  // apex = the held lens re-projected into the world camera (the view model has its own FOV), so the visible cone
  // leaves the glass on screen; g = forward-scatter (outdoor snow haze, lab dust)
  const apex = new Vector3();
  const beamState = { range: 24, start: 0.02, gain: 1, gainOut: 1.5, gainIn: 1.6, haze: 1, indoor: 0, nearClamp: 0.06,
    wind: _wind, apex: null, g: new Vector2(0.2, 0.5) };

  const S = {
    on: true, battery: 1, level: 1, power: INTENSITY, light, vm, beam, cookie, showVM: false,
    gain: beamState, selfUpdating: false,
  };
  // lag spring state: yaw/pitch error of the beam vs. the view (rad), angular velocity
  const lag = { ex: 0, ey: 0, vx: 0, vy: 0, k: (2 * Math.PI * 3.0) ** 2, c: 2 * 0.55 * (2 * Math.PI * 3.0) };
  const lagDir = new Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
  const lastPos = new Vector3().copy(G.camera.position);
  let ramp = 1, speed = 0, ready = false, hooked = false, flick = 1, inK = 1;

  S.setOn = (b) => {
    const want = !!b && S.battery > 0;
    if (want && !S.on) ramp = 0;
    S.on = want;
  };
  S.toggle = () => S.setOn(!S.on);
  S.refill = () => { S.battery = 1; };
  // is pos (feet, body ~2 m tall) inside the lit cone? (aim = lagged beam direction)
  S.beamHits = (p, radius = 0.5) => {
    if (!S.on || light.intensity < 1) return false;
    _d.set(p.x, p.y + 1.4, p.z).sub(light.position); const d = _d.length();
    if (d > light.distance || d < 1e-3) return false;
    _f.subVectors(target.position, light.position).normalize();
    return _d.dot(_f) / d > Math.cos(light.angle + Math.atan2(radius, d));
  };

  function snap() {
    lag.ex = lag.ey = lag.vx = lag.vy = 0;
    lagDir.set(0, 0, -1).applyQuaternion(G.camera.quaternion);
    lastPos.copy(G.camera.position); speed = 0;
  }
  G.on('camset', snap);
  G.on('ready', () => { ready = true; snap(); });

  // place the lamp + aim from the lag state (also used before the first update so warm-up frames draw the beam)
  function place(q) {
    _l.copy(OFFSET).applyQuaternion(q).add(G.camera.position);
    light.position.copy(_l);
    target.position.copy(_l).addScaledVector(lagDir, 10);
    light.updateMatrixWorld(); target.updateMatrixWorld();
  }
  place(G.camera.quaternion);

  // post hook: ask for the after-opaque event as soon as the pipeline exists (prerender fires during warm-up too,
  // so the beam and view-model programs compile inside the warm-up, never after ready)
  G.on('prerender', () => {
    if (!hooked && G.post?.useTransparentEvent) { G.post.useTransparentEvent(); hooked = true; }
  });
  G.on('posttransparent', (R, cam, post) => {
    if (post?.targets?.zFull) beam.setDepth(post.targets.zFull.texture);
    beamState.indoor = G.mods?.atmosphere?.indoor ? 1 : 0;
    beamState.haze = 1 - beamState.indoor;
    beamState.gain = beamState.indoor ? beamState.gainIn : beamState.gainOut;
    if (beam.sync(light, cam, beamState)) R.render(beam.scene, cam);
    vm.visible = !ready || S.showVM || !G.camLocked || !!G.params.get('vm');
    vm.render(R);
  });

  S.update = (dt, t) => {
    // battery
    if (S.on && !shot && !G.paused) S.battery = Math.max(0, S.battery - dt / RULES.battery);
    if (S.battery <= 0) S.on = false;
    ramp = Math.min(1, ramp + dt / 0.08);
    let k = S.on ? ramp * ramp * (0.96 + 0.04 * Math.sin(ramp * 40)) : 0;
    const b = S.battery;
    if (S.on && !shot) {
      // sag below 30 %, brown-out below 15 %: smooth dimming waves + hard stutter drop-outs that get denser
      const sag = 0.5 + 0.5 * Math.min(1, b / 0.3);
      let f = 1;
      if (b < 0.15) {
        const sev = 1 - b / 0.15;
        f = 1 - sev * 0.45 * n1(t * 2.3);
        const stut = n1(t * 17.0 + 3.1) * n1(t * 5.3);
        if (stut > 0.62 - sev * 0.25) f *= 0.15 + 0.5 * n1(t * 41.0);
      }
      flick += (f - flick) * Math.min(1, dt * 40);
      k *= sag * flick;
    }
    S.level = k;
    const inT = G.mods?.atmosphere?.indoor ? INDOOR_K : 1;
    inK = shot ? inT : inK + (inT - inK) * Math.min(1, dt * 2.5);
    light.intensity = S.power * k * inK;
    light.color.copy(COL_FULL).lerp(COL_LOW, shot ? 0 : Math.max(0, 1 - b / 0.3) * 0.8);

    // camera speed (walk sway) and lag spring
    const cq = G.camera.quaternion;
    const mv = G.camera.position.distanceTo(lastPos) / Math.max(dt, 1e-4);
    lastPos.copy(G.camera.position);
    speed += (Math.min(mv, 8) - speed) * Math.min(1, dt * 5);
    if (G.camLocked || shot) snap();
    else {
      _qi.copy(cq).invert();
      _d.copy(lagDir).applyQuaternion(_qi);                     // lag direction in camera space (-z forward)
      lag.ex = Math.atan2(_d.x, -_d.z); lag.ey = Math.atan2(_d.y, Math.hypot(_d.x, _d.z));
      let rem = Math.min(dt, 0.1);
      while (rem > 1e-6) {
        const h = Math.min(1 / 125, rem);
        lag.vx += (-lag.k * lag.ex - lag.c * lag.vx) * h; lag.vy += (-lag.k * lag.ey - lag.c * lag.vy) * h;
        lag.ex += lag.vx * h; lag.ey += lag.vy * h;
        rem -= h;
      }
      lag.ex = Math.max(-0.22, Math.min(0.22, lag.ex)); lag.ey = Math.max(-0.16, Math.min(0.16, lag.ey));
      // walk sway: the torch hand bobs with the stride
      const sw = Math.min(1, speed / 4);
      const sx = Math.sin(t * 7.2) * 0.012 * sw, sy = Math.sin(t * 14.4 + 0.6) * 0.008 * sw;
      const ex = lag.ex + sx, ey = lag.ey + sy;
      _d.set(Math.sin(ex) * Math.cos(ey), Math.sin(ey), -Math.cos(ex) * Math.cos(ey));
      lagDir.copy(_d).applyQuaternion(cq);
    }
    place(cq);
    vm.update(dt, t, cq, lag.ex, lag.ey, S.on ? k : 0, speed);
    // beam apex at the on-screen lens (x/y scaled from the view-model FOV to the world FOV at the same depth)
    vm.lensCam(_a);
    const fk = Math.tan((G.camera.fov * Math.PI) / 360) / Math.tan((vm.camera.fov * Math.PI) / 360);
    _a.x *= fk; _a.y *= fk;
    apex.copy(_a).applyQuaternion(cq).add(G.camera.position);
    beamState.apex = apex;
  };
  S.dispose = () => { G.scene.remove(light, target); cookie.dispose(); beam.dispose(); vm.dispose(); };
  return S;
}

// ?show=flashlight: the beam raking the lab's east wall from the doorway, view model in frame
export function showcase(G) {
  const fl = G.mods?.flashlight;
  if (fl) fl.showVM = true;
  return { cam: [6.2, 1.9, -9.6], target: [0, 1.4, -11.5] };
}
