// First-person player: input (engine/input.js) → yaw/pitch, accelerated walk/sprint/crouch through deep snow, stamina
// with an exhaustion lock-out, jump, gravity on the terrain height (terrain.heightAt), circle-vs-AABB collision (two
// passes so inside corners never leak) with a 35 cm step-up onto floors/landings (the camera eases over the step),
// spring head bob with stride-synced roll, landing dip, and a breathing sway that deepens with exhaustion and fear.
//   createPlayer(G, { input, colliders, heightAt }) → { update(dt, t), position, velocity, yaw, pitch, eye,
//     teleport(pos, yaw, pitch), grounded, crouching, sprinting, stamina 0..1, enabled, control, fear (written by
//     game), lookAt(x, y, z, rate) / release() (scripted look, used by the caught sequence), shake(amount),
//     knock(dx, dz, v) (shove), slump (true → the knees give: eye sinks to crouch height) }
// Bus: emits 'player:step' (speed, crouching) on every footfall and 'noise' (x, z, radius) on footfalls: walking
//   RULES.hearWalk, sprinting RULES.hearSprint, crouching silent; a hard landing is a walk-radius thud.
// Respects G.camLocked (captures/bench own the camera) and G.paused. Allocation-free update.
import { Euler, Vector3 } from 'three';
import { Spring, damp, dampAngle } from '../../cookbook/engine/springs.js';
import { PLAYER as P, WORLD, RULES } from '../../contracts.js';

const STEP_UP = 0.35;           // m: tops within this of the feet are walked onto (lab floor 0.3, landings, plinths)
const TWO_PI = Math.PI * 2;

export function createPlayer(G, { input, colliders = [], heightAt = null }) {
  const pos = new Vector3().fromArray(P.spawn), vel = new Vector3();
  const e = new Euler(0, 0, 0, 'YXZ');
  const S = {
    position: pos, velocity: vel, yaw: P.spawnYaw, pitch: 0, grounded: true, eye: P.eye, enabled: true, control: true,
    crouching: false, sprinting: false, stamina: 1, tired: false, fear: 0, speed: 0, slump: false,
  };
  const bob = new Spring(140, 13), land = new Spring(140, 13);
  const look = { on: false, x: 0, y: 0, z: 0, rate: 6 };
  let phase = 0, lastStep = 0, wasGrounded = true, airVy = 0, stepOff = 0, shakeA = 0, breathT = 0;
  const groundAt = (x, z) => (heightAt ? heightAt(x, z) : WORLD.groundY);
  pos.y = groundAt(pos.x, pos.z);

  // circle (radius r) vs every collider box in XZ; boxes whose top is within STEP_UP of the feet are stood on
  function collide() {
    const r = P.radius;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < colliders.length; i++) {
        const b = colliders[i];
        if (pos.y + P.height < b.min.y) continue;                       // box entirely overhead
        if (pos.y > b.max.y - STEP_UP) {                                  // feet at/above the top band → walk onto it
          if (pass === 0 && pos.y <= b.max.y + 0.02 && vel.y <= 0.01 &&
              pos.x > b.min.x - r * 0.4 && pos.x < b.max.x + r * 0.4 && pos.z > b.min.z - r * 0.4 && pos.z < b.max.z + r * 0.4) {
            if (b.max.y > pos.y + 0.03) stepOff -= b.max.y - pos.y;       // camera eases over the step
            pos.y = b.max.y; vel.y = 0; S.grounded = true;
          }
          continue;
        }
        const cx = b.min.x > pos.x ? b.min.x : b.max.x < pos.x ? b.max.x : pos.x;
        const cz = b.min.z > pos.z ? b.min.z : b.max.z < pos.z ? b.max.z : pos.z;
        const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2), push = (r - d) / d;
          pos.x += dx * push; pos.z += dz * push;
          // kill the velocity component into the wall (no sticky sliding)
          const nx = dx / d, nz = dz / d, vn = vel.x * nx + vel.z * nz;
          if (vn < 0) { vel.x -= vn * nx; vel.z -= vn * nz; }
        } else { // centre inside the box: leave by the nearest face
          const ox0 = pos.x - b.min.x, ox1 = b.max.x - pos.x, oz0 = pos.z - b.min.z, oz1 = b.max.z - pos.z;
          const m = Math.min(ox0, ox1, oz0, oz1);
          if (m === ox0) pos.x = b.min.x - r; else if (m === ox1) pos.x = b.max.x + r; else if (m === oz0) pos.z = b.min.z - r; else pos.z = b.max.z + r;
        }
      }
    }
  }

  function footfall(hs) {
    G.emit('player:step', hs, S.crouching);
    if (S.crouching) return;
    G.emit('noise', pos.x, pos.z, S.sprinting ? RULES.hearSprint : RULES.hearWalk);
  }

  S.update = (dt, t) => {
    if (!S.enabled || G.paused) return;
    const ctl = S.control;
    // ---- look ----
    if (look.on) {
      const dx = look.x - pos.x, dz = look.z - pos.z, dy = look.y - (pos.y + S.eye);
      S.yaw = dampAngle(S.yaw, Math.atan2(-dx, -dz), look.rate, dt);
      S.pitch = damp(S.pitch, Math.atan2(dy, Math.hypot(dx, dz)), look.rate, dt);
    } else if (ctl) {
      S.yaw -= input.lookX; S.pitch = Math.max(-1.45, Math.min(1.45, S.pitch - input.lookY));
      if (S.yaw > Math.PI) S.yaw -= TWO_PI; else if (S.yaw < -Math.PI) S.yaw += TWO_PI;
    }
    // ---- locomotion ----
    const mx = ctl ? input.move.x : 0, my = ctl ? input.move.y : 0;
    S.crouching = ctl && input.down('crouch');
    if (S.stamina <= 0.02) S.tired = true; else if (S.stamina > 0.35) S.tired = false;
    S.sprinting = ctl && input.down('sprint') && !S.crouching && !S.tired && my > 0.2;
    const moving = mx * mx + my * my > 0.01;
    const regen = S.sprinting ? -1 / P.stamina : (moving ? 0.55 : 1) / (P.stamina * 1.4);
    S.stamina = Math.max(0, Math.min(1, S.stamina + regen * dt));
    const speed = S.crouching ? P.crouch : S.sprinting ? P.sprint : P.walk * (S.tired ? 0.8 : 1);
    const sy = Math.sin(S.yaw), cy = Math.cos(S.yaw);
    const wx = (mx * cy - my * sy) * speed, wz = (-mx * sy - my * cy) * speed;
    const k = (S.grounded ? P.accel : P.airAccel) / Math.max(1, speed);
    vel.x = damp(vel.x, wx, moving ? k : k * 1.6, dt); vel.z = damp(vel.z, wz, moving ? k : k * 1.6, dt);
    if (ctl && S.grounded && input.pressed('jump') && !S.crouching) { vel.y = P.jump; S.grounded = false; }
    vel.y -= P.gravity * dt;
    if (vel.y < -30) vel.y = -30;
    pos.x += vel.x * dt; pos.y += vel.y * dt; pos.z += vel.z * dt;
    S.grounded = false;
    collide();
    const gy = groundAt(pos.x, pos.z);
    if (pos.y <= gy + 0.02 && vel.y <= 0.01) {
      // snow underfoot: follow small rises smoothly (eased), snap down short drops instead of hopping
      if (gy > pos.y + 0.03) stepOff -= gy - pos.y;
      pos.y = gy; vel.y = 0; S.grounded = true;
    } else if (pos.y < gy) { pos.y = gy; vel.y = 0; S.grounded = true; }
    pos.x = Math.max(WORLD.min[0], Math.min(WORLD.max[0], pos.x)); pos.z = Math.max(WORLD.min[2], Math.min(WORLD.max[2], pos.z));
    // ---- landing ----
    if (!S.grounded) airVy = Math.min(airVy, vel.y);
    if (S.grounded && !wasGrounded) {
      const hit = Math.min(1, -airVy / 9);
      if (hit > 0.15) { land.impulse(-2.6 * hit); if (hit > 0.45 && !S.crouching) G.emit('noise', pos.x, pos.z, RULES.hearWalk * 1.5); }
      airVy = 0;
    }
    wasGrounded = S.grounded;
    // ---- stride ----
    const hs = Math.hypot(vel.x, vel.z);
    S.speed = hs;
    if (S.grounded && hs > 0.4) phase += dt * (S.crouching ? 4.2 : 4.6 + 1.25 * hs);
    const step = Math.floor(phase / Math.PI);
    if (step !== lastStep) { lastStep = step; footfall(hs); }
    const gait = Math.min(1, hs / P.walk);
    bob.target = S.grounded ? -Math.abs(Math.sin(phase)) * (S.sprinting ? 0.055 : S.crouching ? 0.018 : 0.034) * gait : 0;
    bob.update(dt); land.update(dt);
    S.eye = S.slump ? damp(S.eye, P.crouchEye + 0.12, 3.2, dt) : damp(S.eye, S.crouching ? P.crouchEye : P.eye, 9, dt);
    stepOff = damp(stepOff, 0, 11, dt);
    shakeA = Math.max(0, shakeA - dt * 1.4);
    if (G.camLocked) return;
    // ---- camera: breathing (faster + deeper when winded or afraid), bob, roll with the stride, shake ----
    const winded = 1 - S.stamina, fear = S.fear;
    breathT += dt * (1.35 + 1.6 * winded + 1.1 * fear);
    const breath = Math.sin(breathT) * (0.005 + 0.012 * winded + 0.006 * fear);
    const sh = shakeA * shakeA;
    const shx = sh * (Math.sin(t * 61.3) * 0.6 + Math.sin(t * 37.1) * 0.4), shy = sh * (Math.sin(t * 53.7 + 1.3) * 0.6 + Math.sin(t * 29.3) * 0.4);
    G.camera.position.set(pos.x, pos.y + S.eye + bob.x + land.x * 0.1 + breath + stepOff, pos.z);
    e.set(S.pitch + breath * 0.35 + shy * 0.03, S.yaw + shx * 0.03,
      Math.sin(phase) * 0.006 * gait * (S.sprinting ? 1.6 : 1) + Math.sin(breathT * 0.5) * 0.0025 * (1 + fear));
    G.camera.quaternion.setFromEuler(e);
  };
  S.teleport = (p, yaw = S.yaw, pitch = 0) => {
    pos.fromArray(p); pos.y = Math.max(pos.y, groundAt(pos.x, pos.z));
    vel.set(0, 0, 0); S.yaw = yaw; S.pitch = pitch; S.stamina = 1; S.tired = false;
    stepOff = 0; airVy = 0; wasGrounded = true; S.grounded = true; bob.set(0); land.set(0); shakeA = 0;
    look.on = false; S.control = true; S.slump = false;
  };
  S.lookAt = (x, y, z, rate = 6) => { look.on = true; look.x = x; look.y = y; look.z = z; look.rate = rate; };
  S.release = () => { look.on = false; };
  S.shake = (a) => { shakeA = Math.max(shakeA, a); };
  // shoved: a horizontal impulse (m/s) along (dx, dz); with control off it bleeds out over ~0.3 m
  S.knock = (dx, dz, v) => { const l = Math.hypot(dx, dz) || 1; vel.x = (dx / l) * v; vel.z = (dz / l) * v; land.impulse(-1.5); };
  // harness cameras (__setCam) → keep the controller in sync so unlocking does not snap
  G.on('camset', (p, tg) => {
    S.yaw = Math.atan2(-(tg[0] - p[0]), -(tg[2] - p[2]));
    S.pitch = Math.atan2(tg[1] - p[1], Math.hypot(tg[0] - p[0], tg[2] - p[2]));
  });
  return S;
}
