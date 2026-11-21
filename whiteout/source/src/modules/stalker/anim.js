// Stalker procedural animator: writes absolute local rotations into the rig.js bones every frame (zero allocation).
//   - Gait: a phase-locked biped cycle. The phase advances by the distance the body actually travelled / stride, and
//     a stance foot moves backward in body space at exactly that speed, so planted feet never slide. Feet follow the
//     snow (terrain.heightAt under each foot) and are reached with an analytic two-bone IK (thigh → shin), the sole
//     kept flat, heel peeling off before the swing. The LEFT leg drags: longer stance, low swing with the toes
//     scraping, a hip dip on its stance → the lurch.
//   - Body: deep stoop that grows with speed, counter-rotating shoulders, lateral sway over the stance foot, a neck that
//     juts forward with the face held level, loose arms on lagging springs (they hang plumb from the stooped chest).
//   - Listening (still): slow breathing, shoulders hunched, one hand half-raised, the head snapping between tilts
//     on a stiff spring (twitch, then hold), fingers flexing.
//   - Chase: long loping strides, low, both arms reaching. Stagger (beam): recoil spring — torso thrown back, arms up
//     to shield the face, head wrenched away. Retreat: crouched run.
//   createAnimator(bones, { heightAt, rng }) → A;  A.update(dt, t, s) with s = { speed (m/s forward, measured),
//     turn (rad/s), state, x, z, yaw, groundY, still }.  A.onPlant(foot 0|1, x, z, yaw) fires at every heel strike.
import { Quaternion, Vector3 } from 'three';
import { BI, LEG } from './rig.js';

const TAU = Math.PI * 2;
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ss = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));

// damped spring in 8 ms sub-steps (frame-rate independent)
function spring(k, c) {
  return {
    x: 0, v: 0, k, c,
    step(target, dt) {
      const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
      for (let i = 0; i < n; i++) { this.v += (this.k * (target - this.x) - this.c * this.v) * h; this.x += this.v * h; }
      return this.x;
    },
  };
}

const _q = new Quaternion(), _d = new Vector3();

export function createAnimator(bones, { heightAt = null, rng = Math.random } = {}) {
  const b = (n) => bones[BI[n]];
  const pelvis = b('pelvis'), sp1 = b('spine1'), sp2 = b('spine2'), chest = b('chest'), neck = b('neck'), head = b('head'), jaw = b('jaw');
  const leg = [0, 1].map((i) => { const s = i ? 'R' : 'L'; return { th: b('thigh' + s), sh: b('shin' + s), ft: b('foot' + s), to: b('toes' + s), side: i ? -1 : 1, prevP: 0, z: 0, x: 0, y: 0 }; });
  const arm = [0, 1].map((i) => { const s = i ? 'R' : 'L'; return { cl: b('clav' + s), ua: b('uarm' + s), fa: b('farm' + s), ha: b('hand' + s), fi: b('fing' + s), side: i ? -1 : 1, sw: spring(38, 6.5), el: spring(55, 9) }; });
  const l1 = LEG.l1, l2 = LEG.l2;
  const S = {
    phase: 0, move: 0, run: 0, listen: 0, crouch: 0, chase: 0, breath: 0,
    stg: spring(70, 9), tilt: spring(240, 17), look: spring(150, 16), nod: spring(60, 10),
    tiltT: 0.25, lookT: 0, twitchT: 0.8, flex: 0, flexT: 0,
    onPlant: null,
  };

  function solveLeg(L, tx, ty, tz, pitch, toe, pp) {
    // target (root space) → pelvis local → relative to the hip joint
    _d.set(tx - pelvis.position.x, ty - pelvis.position.y, tz - pelvis.position.z);
    _q.copy(pelvis.quaternion).invert();
    _d.applyQuaternion(_q);
    _d.x -= L.th.position.x; _d.y -= L.th.position.y; _d.z -= L.th.position.z;
    const dist = Math.min(l1 + l2 - 0.002, Math.max(0.2, _d.length()));
    const knee = Math.PI - Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - dist * dist) / (2 * l1 * l2))));
    const alpha = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))));
    const thetaD = Math.atan2(-_d.z, -_d.y), roll = Math.asin(Math.max(-1, Math.min(1, _d.x / dist)));
    L.th.rotation.set(thetaD - alpha, 0, roll);
    L.sh.rotation.set(knee, 0, 0);
    L.ft.rotation.set(-(pp + thetaD - alpha + knee) + pitch, 0, -roll);
    L.to.rotation.set(toe, 0, 0);
  }

  S.update = (dt, t, s) => {
    const still = !!s.still, st = s.state;
    const v = Math.max(0, s.speed), turn = Math.abs(s.turn || 0);
    // ---- blend weights ----------------------------------------------------------------------------------------
    S.move = damp(S.move, ss(0.06, 0.5, v + turn * 0.2), 7, dt);
    S.run = damp(S.run, ss(2.2, 4.2, v), 4, dt);
    S.listen = damp(S.listen, (st === 'listen' || st === 'patrol' || st === 'investigate') && v < 0.15 ? 1 : 0, 2.5, dt);
    S.chase = damp(S.chase, st === 'chase' ? 1 : 0, 3, dt);
    S.crouch = damp(S.crouch, st === 'retreat' ? 0.5 : st === 'chase' ? 0.18 : 0.06 + S.listen * 0.28, 3, dt);
    const stg = S.stg.step(st === 'stagger' ? 1 : 0, dt);
    const run = S.run, mv = S.move, ls = S.listen;
    const Ls = lerp(1.55, 3.1, run);                       // stride: distance per full cycle
    if (!still) S.phase = (S.phase + (v * dt) / Ls + (v < 0.2 ? turn * dt * 0.25 : 0)) % 1;
    S.breath += dt * TAU * (still ? 0 : lerp(0.32, 0.9, Math.max(S.chase, run)));
    const br = Math.sin(S.breath);
    // ---- feet (root space) ---------------------------------------------------------------------------------------
    const lift = lerp(0.11, 0.24, run);
    let limpDip = 0, swayZ = 0;
    const cy = Math.cos(s.yaw + Math.PI), sy = Math.sin(s.yaw + Math.PI); // root rotation.y = yaw + π
    for (let i = 0; i < 2; i++) {
      const L = leg[i], limp = i === 0 ? 1 - run : 0;
      const beta = lerp(0.62, 0.4, run) + 0.07 * limp, half = Ls * beta * 0.5;
      const p = (S.phase + i * 0.5) % 1;
      let z, y, pitch, toe;
      if (p < beta) {
        const u = p / beta, heel = ss(0.72, 1, u);
        z = half * (1 - 2 * u); y = heel * 0.075; pitch = heel * 0.55; toe = -heel * 0.5;
        if (i === 0) limpDip = Math.sin(Math.PI * u) * limp;
      } else {
        const u = (p - beta) / (1 - beta), e = u * u * (3 - 2 * u);
        z = half * (2 * e - 1); y = lift * (1 - 0.55 * limp) * Math.pow(Math.sin(Math.PI * u), 0.8) + 0.06 * (1 - u) * (1 - limp * 0.6);
        pitch = lerp(0.6 + 0.35 * limp, -0.15 * (1 - limp), ss(0.1, 0.85, u)); toe = lerp(0.25, -0.1, u);
      }
      if (i === 1) swayZ = z / Math.max(half, 0.01);
      // idle stance: staggered, wider when listening
      const ix = L.side * (0.14 + 0.03 * ls), iz = i === 0 ? 0.12 : -0.07;
      L.x = lerp(ix, L.side * (0.13 - 0.03 * run), mv);
      L.z = lerp(iz, z, mv);
      // snow under the foot (world) relative to the body's ground point
      let gy = 0;
      if (heightAt) { const wx = s.x + L.x * cy + L.z * sy, wz = s.z - L.x * sy + L.z * cy; gy = Math.max(-0.3, Math.min(0.3, heightAt(wx, wz) - s.groundY)); }
      L.y = LEG.ankle + y * mv + gy;
      L.pitch = pitch * mv; L.toe = toe * mv;
      if (L.prevP > p && mv > 0.5 && S.onPlant && !still) S.onPlant(i, s.x + L.x * cy + L.z * sy, s.z - L.x * sy + L.z * cy, s.yaw);
      L.prevP = p;
    }
    // ---- pelvis -----------------------------------------------------------------------------------------------------
    const bob = Math.cos(TAU * 2 * (S.phase - 0.3)) * lerp(0.022, 0.05, run) * mv;
    const pp = 0.06 + 0.16 * run + S.crouch * 0.2 - stg * 0.25;
    pelvis.position.set(
      Math.sin(TAU * S.phase) * 0.035 * (1 - 0.5 * run) * mv - 0.035 * ls + Math.sin(t * 0.37) * 0.01 * ls,
      lerp(1.14, 1.04, run) - S.crouch * 0.3 - ls * 0.02 + bob - limpDip * 0.045 * mv + br * 0.004,
      -stg * 0.14);
    const pyaw = -0.14 * mv * Math.cos(TAU * S.phase) * (1 + run * 0.4);
    const proll = -Math.sin(TAU * S.phase) * 0.06 * mv - limpDip * 0.07 * mv - 0.06 * ls;
    pelvis.rotation.set(pp, pyaw, proll);
    for (let i = 0; i < 2; i++) { const L = leg[i]; solveLeg(L, L.x, L.y, L.z, L.pitch, L.toe, pp); }
    // ---- head targets: snap-and-hold twitches -----------------------------------------------------------------------
    if (!still && (S.twitchT -= dt) <= 0) {
      const k = 0.35 + 0.65 * ls;
      S.tiltT = (rng() - 0.5) * 1.1 * k + (rng() < 0.5 ? 0.18 : -0.18) * ls;
      S.lookT = (rng() - 0.5) * 1.3 * k;
      S.flexT = rng();
      S.twitchT = lerp(1.6, 0.5, S.chase) + rng() * 2.6 * (1 - S.chase);
    }
    if (still) { S.tiltT = 0.42; S.lookT = -0.55; S.flexT = 0.6; }
    const tilt = S.tilt.step(S.tiltT * (1 - S.chase * 0.8), dt);
    const look = S.look.step(S.lookT * (1 - S.chase) + stg * 0.7, dt);
    S.flex = damp(S.flex, S.flexT, 5, dt);
    // ---- spine / neck / head --------------------------------------------------------------------------------------
    const stoop = lerp(0.82, 0.98, run) + S.crouch * 0.3 + ls * 0.3 - stg * 1.15;
    const lurch = limpDip * 0.09 * mv + Math.sin(TAU * S.phase) * 0.04 * mv;
    sp1.rotation.set(stoop * 0.22, -pyaw * 0.4, -proll * 0.9 + lurch);
    sp2.rotation.set(stoop * 0.33, -pyaw * 0.4 + look * 0.12, lurch * 0.4);
    chest.rotation.set(stoop * 0.45 + br * 0.025, -pyaw * 0.35 + look * 0.18, Math.sin(t * 0.21) * 0.03 * ls);
    chest.scale.set(1 + br * 0.018, 1, 1 + br * 0.03);
    const total = pp + stoop;
    const nod = S.nod.step(-bob * 3.0, dt);
    neck.rotation.set(-total * 0.28 + 0.2 + S.chase * 0.1, look * 0.35, tilt * 0.3);
    head.rotation.set(-(total * 0.72 + 0.2 + S.chase * 0.1) + 0.16 + nod - stg * 0.5 - ls * 0.04, look * 0.65, tilt * 0.7);
    jaw.rotation.set(0.05 + Math.max(0, br) * 0.06 + S.chase * 0.28 + stg * 0.35 + ls * 0.16 + (still ? 0.12 : 0), 0, 0);
    // ---- arms -------------------------------------------------------------------------------------------------------
    for (let i = 0; i < 2; i++) {
      const A = arm[i], sd = A.side, other = i === 0 ? swayZ : -swayZ;
      const swing = mv * other * lerp(0.26, 0.6, run) * (i === 0 ? 0.7 : 1);   // the dragging side swings less
      const raise = i === 0 ? ls * 0.42 : 0;                                       // listening: the left hand half up
      const tgt = -total * 0.92 - swing - run * 0.55 - S.chase * 0.25 - raise - stg * (i === 0 ? 1.9 : 1.3);
      A.ua.rotation.set(A.sw.step(tgt, dt), sd * (0.22 + stg * 0.2), sd * (0.0 + 0.05 * run + 0.03 * Math.sin(t * 0.8 + i) + stg * 0.25));
      const elb = A.el.step(-(0.42 + 0.5 * run + 0.6 * raise + stg * (i === 0 ? 1.7 : 0.9) + Math.max(0, swing) * 0.35), dt);
      A.fa.rotation.set(elb, 0, 0);
      A.ha.rotation.set(0.12 - 0.25 * raise, 0, sd * (0.12 + 0.1 * S.chase));
      A.fi.rotation.set(0, 0, -sd * (0.3 + 0.35 * S.chase + 0.25 * stg + 0.25 * S.flex * (i === 0 ? ls : 0.5 * ls)));
      // listening: both shoulders hunched up around the neck (the raised side higher) → the head sinks between them
      A.cl.rotation.set(0, sd * -0.16 * (ls + run), sd * ((i === 0 ? 0.24 : 0.15) * ls + 0.08 * run + 0.22 * stg + br * 0.015));
    }
  };
  return S;
}
