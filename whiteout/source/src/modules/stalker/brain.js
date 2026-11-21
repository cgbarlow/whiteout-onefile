// Stalker AI (pure logic on preallocated scalars, zero allocation per frame, ~0.01-0.03 ms):
//   patrol      walk LAYOUT.stalkerPatrol (loop); at each waypoint it stops to LISTEN
//   listen      stands still 2.5-5 s (head twitches in anim.js); hears/sees from here like patrol
//   investigate a 'noise' inside its radius (sprint 22 m, crank 45 m, walk 7 m): goes to the spot, listens, gives up
//   chase       it sees the player: vision cone RULES.sightFovDeg, range RULES.sight (RULES.sightLit with the torch on),
//               line of sight blocked by the station colliders; loses track after 3 s unseen → searches the last
//               known position (investigate); caught at RULES.catchDist
//   stagger     the beam held on it RULES.staggerBeam s → recoils ~1 s, then
//   retreat     runs away from the player for RULES.retreat s, back to the nearest waypoint
// Hide zones (station.insideAt: lab, radio hut, shed) are never entered and a hidden player is invisible beyond 4 m.
// Steering: goal seek + look-ahead whisker against the collider boxes + circle push-out (no navmesh needed between
// the modules; patrol points sit in open lanes). States are emitted by index.js as 'stalker:state'.
import { Vector3 } from 'three';
import { LAYOUT as L, RULES as R } from '../../contracts.js';

const SPEED = { patrol: 1.25, listen: 0, investigate: 2.1, chase: 4.6, stagger: 0, retreat: 4.0 };
const COS_FOV = Math.cos((R.sightFovDeg * Math.PI) / 360);

export function createBrain({ colliders = [], station = null, rng = Math.random }) {
  const boxes = colliders.filter((b) => b.max.y > 0.5 && b.max.x - b.min.x < 40 && b.max.z - b.min.z < 40);
  const tall = boxes.filter((b) => b.max.y > 1.3);  // these block sight
  const B = {
    pos: new Vector3().fromArray(L.stalkerStart), yaw: 0, speed: 0, state: 'patrol', alert: 0,
    goal: new Vector3(), last: new Vector3(), wp: 0, timer: 0, lost: 0, beam: 0, caught: false, seen: false,
    sightT: 0, stuckT: 0, hasLast: false,
  };
  const inside = (x, z) => !!(station?.insideAt && station.insideAt(x, z));
  const setWp = (i) => { B.wp = (i + L.stalkerPatrol.length) % L.stalkerPatrol.length; const p = L.stalkerPatrol[B.wp]; B.goal.set(p[0], 0, p[1]); };
  const nearestWp = () => {
    let bi = 0, bd = 1e9;
    for (let i = 0; i < L.stalkerPatrol.length; i++) { const p = L.stalkerPatrol[i], d = (p[0] - B.pos.x) ** 2 + (p[1] - B.pos.z) ** 2; if (d < bd) { bd = d; bi = i; } }
    return bi;
  };
  const enter = (s, timer = 0) => { B.state = s; B.timer = timer; B.stuckT = 0; };
  setWp(1);

  B.hear = (x, z, radius) => {
    if (B.state === 'retreat' || B.state === 'chase' || B.state === 'stagger') return;
    if ((x - B.pos.x) ** 2 + (z - B.pos.z) ** 2 < radius * radius) { enter('investigate', 14); B.goal.set(x, 0, z); }
  };
  B.reset = () => {
    B.pos.fromArray(L.stalkerStart); B.yaw = 0; B.speed = 0; B.beam = 0; B.caught = false; B.alert = 0; B.lost = 0;
    B.hasLast = false; enter('patrol'); setWp(1);
  };

  // 2D segment vs AABB (slab test) over the tall colliders
  function blocked(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0;
    for (let i = 0; i < tall.length; i++) {
      const b = tall[i];
      let t0 = 0, t1 = 1;
      if (Math.abs(dx) < 1e-6) { if (x0 < b.min.x || x0 > b.max.x) continue; } else {
        let a = (b.min.x - x0) / dx, c = (b.max.x - x0) / dx; if (a > c) { const s = a; a = c; c = s; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) continue;
      }
      if (Math.abs(dz) < 1e-6) { if (z0 < b.min.z || z0 > b.max.z) continue; } else {
        let a = (b.min.z - z0) / dz, c = (b.max.z - z0) / dz; if (a > c) { const s = a; a = c; c = s; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) continue;
      }
      return true;
    }
    return false;
  }
  function pushOut(r) {
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const cx = Math.max(b.min.x, Math.min(B.pos.x, b.max.x)), cz = Math.max(b.min.z, Math.min(B.pos.z, b.max.z));
      const dx = B.pos.x - cx, dz = B.pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; B.pos.x += dx * k; B.pos.z += dz * k; }
    }
  }
  // whisker: the point `ahead` m in front inside an inflated box → steer along that box's face
  function avoidYaw(want, ahead) {
    const fx = -Math.sin(want), fz = -Math.cos(want), px = B.pos.x + fx * ahead, pz = B.pos.z + fz * ahead;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i], m = 0.7;
      if (px > b.min.x - m && px < b.max.x + m && pz > b.min.z - m && pz < b.max.z + m) {
        const cx = (b.min.x + b.max.x) * 0.5, cz = (b.min.z + b.max.z) * 0.5;
        // turn toward the side of the box the body is already on
        const cross = fx * (cz - B.pos.z) - fz * (cx - B.pos.x);
        return want + (cross > 0 ? 0.9 : -0.9);
      }
    }
    return want;
  }

  // player: { pos: Vector3 (feet), hidden, lit (torch on), beamOnMe }
  B.update = (dt, player) => {
    const px = player.pos.x, pz = player.pos.z, dx = px - B.pos.x, dz = pz - B.pos.z, dP = Math.hypot(dx, dz);
    const hidden = player.hidden && dP > 4;
    // ---- senses (sight re-evaluated every 0.12 s; hearing is event driven) ----
    if ((B.sightT -= dt) <= 0) {
      B.sightT = 0.12;
      const fwdX = -Math.sin(B.yaw), fwdZ = -Math.cos(B.yaw), cosA = dP > 0.01 ? (dx * fwdX + dz * fwdZ) / dP : 1;
      const range = player.lit ? R.sightLit : R.sight;
      B.seen = !hidden && ((dP < range && cosA > COS_FOV) || dP < 2.5) && !blocked(B.pos.x, B.pos.z, px, pz);
    }
    if (B.seen) { B.last.set(px, 0, pz); B.hasLast = true; }
    // the beam: holding it on the creature drives it off
    B.beam = player.beamOnMe && dP < 30 && B.state !== 'retreat' ? B.beam + dt : Math.max(0, B.beam - dt * 0.6);
    if (B.beam > R.staggerBeam && B.state !== 'stagger' && B.state !== 'retreat') { enter('stagger', 1.05); B.beam = 0; }
    // ---- states ----
    switch (B.state) {
      case 'patrol':
        if (B.seen) { enter('chase'); break; }
        if (Math.hypot(B.goal.x - B.pos.x, B.goal.z - B.pos.z) < 1.0) enter('listen', 2.5 + rng() * 2.5);
        break;
      case 'listen':
        if (B.seen) { enter('chase'); break; }
        if ((B.timer -= dt) <= 0) { enter('patrol'); setWp(B.wp + 1); }
        break;
      case 'investigate':
        if (B.seen) { enter('chase'); break; }
        B.timer -= dt;
        if (Math.hypot(B.goal.x - B.pos.x, B.goal.z - B.pos.z) < 1.2 || B.timer <= 0) { enter('listen', 3 + rng() * 2); B.wp = nearestWp() - 1; }
        break;
      case 'chase':
        if (B.seen) { B.goal.set(px, 0, pz); B.lost = 0; } else {
          if (B.hasLast) B.goal.copy(B.last);
          if ((B.lost += dt) > 3) { B.lost = 0; enter('investigate', 10); }
        }
        if (dP < R.catchDist && !player.hidden) B.caught = true;
        break;
      case 'stagger':
        if ((B.timer -= dt) <= 0) enter('retreat', R.retreat);
        break;
      case 'retreat':
        B.goal.set(B.pos.x - dx * 4, 0, B.pos.z - dz * 4);
        if ((B.timer -= dt) <= 0) { enter('patrol'); setWp(nearestWp()); }
        break;
    }
    B.alert += ((B.state === 'patrol' || B.state === 'listen' ? 0 : 1) - B.alert) * Math.min(1, dt * 3);
    // ---- steering ----
    const gx = B.goal.x - B.pos.x, gz = B.goal.z - B.pos.z, gd = Math.hypot(gx, gz);
    const target = SPEED[B.state] * (gd > 0.4 ? 1 : 0);
    if (gd > 0.05 && B.state !== 'stagger') {
      let want = Math.atan2(-gx, -gz);
      if (target > 0) want = avoidYaw(want, 1.4 + B.speed * 0.3);
      let d = want - B.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      const rate = B.state === 'chase' || B.state === 'retreat' ? 4.0 : 2.2;
      B.yaw += Math.max(-dt * rate, Math.min(dt * rate, d));
      B.yaw = Math.atan2(Math.sin(B.yaw), Math.cos(B.yaw));
    }
    // a sharp turn slows it down (it pivots, then lurches on)
    const facing = gd > 0.05 ? Math.max(0, Math.cos(Math.atan2(-gx, -gz) - B.yaw)) : 1;
    B.speed += (target * (0.25 + 0.75 * facing) - B.speed) * Math.min(1, dt * (B.state === 'stagger' ? 10 : 3.5));
    const ox = B.pos.x, oz = B.pos.z;
    B.pos.x += -Math.sin(B.yaw) * B.speed * dt; B.pos.z += -Math.cos(B.yaw) * B.speed * dt;
    pushOut(0.5);
    // never step into a hide zone: slide along it on one axis, else stay put
    if (inside(B.pos.x, B.pos.z)) {
      if (!inside(B.pos.x, oz)) B.pos.z = oz; else if (!inside(ox, B.pos.z)) B.pos.x = ox; else { B.pos.x = ox; B.pos.z = oz; }
    }
    // stuck on a corner while patrolling → move on to the next waypoint
    const moved = Math.hypot(B.pos.x - ox, B.pos.z - oz);
    if (target > 0 && moved < target * dt * 0.2) { if ((B.stuckT += dt) > 2.5) { B.stuckT = 0; if (B.state === 'patrol' || B.state === 'investigate') { enter('patrol'); setWp(B.wp + 1); } } } else B.stuckT = 0;
  };
  return B;
}
