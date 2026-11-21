// STALKER (actor): the sculpted, skinned creature (body.js ← sculpt.js + skin.js + rig.js) driven by the AI (brain.js)
// through the procedural animator (anim.js), footprints in the snow (prints.js) and frost breath (fx smoke puffs).
//   create(G, { mats, colliders, station, terrain }) → { brain, root, pos, state (getter), caught (getter),
//     setPlayer({ pos, hidden, lit, beamOnMe }) (game writes this every frame), reset(), update, stats }
// Bus: listens to 'noise' (x, z, radius); emits 'stalker:state' (state, distToPlayer) on every state change.
//   states: patrol · listen · investigate · chase · stagger · retreat
// Draws: body 1 (+ shadow passes) · footprints 1 · breath rides the shared fx billboard pool (0 extra).
// ?shot captures: AI frozen, the rig holds the still listening pose at LAYOUT.stalkerStart facing the pose-5 camera,
//   with the trail of prints it left coming in from the west. Inspection hooks (showcase only):
//   ?stk=walk|run|listen|stagger|retreat (+ &sph=0..1 gait phase) poses the frozen rig in that state.
import { Vector3 } from 'three';
import { LAYOUT as L } from '../../contracts.js';
import { createBrain } from './brain.js';
import { buildBody } from './body.js';
import { createAnimator } from './anim.js';
import { createPrints } from './prints.js';
import { BI } from './rig.js';

const FORCED = { walk: ['patrol', 1.25], run: ['chase', 4.6], listen: ['listen', 0], stagger: ['stagger', 0], retreat: ['retreat', 4.0] };
const _mouth = new Vector3(), _vel = new Vector3(), _ank = new Vector3(), _toe = new Vector3();
const FEET = [[BI.footL, BI.toesL], [BI.footR, BI.toesR]];

export function create(G, { colliders = [], station = null, terrain = null } = {}) {
  const body = buildBody();
  G.scene.add(body.root);
  const heightAt = terrain?.heightAt ? (x, z) => terrain.heightAt(x, z) : null;
  const normalAt = terrain?.normalAt ? (x, z, o) => terrain.normalAt(x, z, o) : null;
  const brain = createBrain({ colliders, station, rng: G.rng(91) });
  const anim = createAnimator(body.bones, { heightAt, rng: G.rng(92) });
  const prints = createPrints(G, { heightAt, normalAt });
  G.scene.add(prints.mesh);
  anim.onPlant = (foot, x, z, yaw) => prints.add(x, z, yaw, foot);
  const fx = G.mods?.fx && !G.mods.fx.isStub ? G.mods.fx : null;
  const breathOpt = { count: 2, size: 0.07, grow: 4.5, life: 1.6, color: [0.62, 0.66, 0.72], opacity: 0.16, spread: 0.08, vel: _vel, rise: 0.05 };

  const player = { pos: G.camera.position, hidden: false, lit: false, beamOnMe: false };
  const shot = !!G.params.get('shot');
  const forced = FORCED[G.params.get('stk')] || null;
  const frozen = shot || !!forced;
  let last = brain.state, lastX = brain.pos.x, lastZ = brain.pos.z, lastYaw = 0, exhale = false, footPrints = false;
  // three-quarter on to the pose-5 camera (a head-on stoop foreshortens into an upright mannequin): the body turned
  // 50° to its left, listening past the camera, the head swung back toward it. The low ?show=stalker camera gets a
  // body turned only 26° off so the open jaw and the raised claw read against the sky.
  const showCam = G.params.get('show') === 'stalker';
  const face = showCam ? [SHOW.cam[0], SHOW.cam[2], 1.0] : [-13, 3, 0.87];
  const faceCam = () => { brain.yaw = Math.atan2(-(face[0] - brain.pos.x), -(face[1] - brain.pos.z)) + face[2]; };

  // the trail it walked in on: prints coming from the west (patrol leg -40,6 → start), aged older further back
  function prefill(now) {
    prints.clear();
    const sx = L.stalkerStart[0], sz = L.stalkerStart[2], p = L.stalkerPatrol[L.stalkerPatrol.length - 1];
    const dx = sx - p[0], dz = sz - p[1], d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d, yaw = Math.atan2(-ux, -uz);
    const wob = [0.0, 0.05, -0.03, 0.06, -0.02, 0.04, 0.0, -0.05];
    for (let i = 13; i >= 1; i--) {
      // left foot (+x of the body) = to the left of the travel direction: perpendicular (uz, -ux) points right
      const along = 0.35 + i * 0.78, foot = i & 1, off = (foot === 0 ? -0.13 : 0.13) + wob[i % 8] * 0.5;
      prints.add(sx - ux * along + uz * off, sz - uz * along - ux * off, yaw + wob[(i + 3) % 8] * 1.5, foot, now - i * 2.2);
    }
    footPrints = true; // + the two it is standing in, pressed once the rig has posed (first update)
  }
  // contact pools under both feet (midpoint ankle → toes on the snow, faded by the sole's height above it) + one body pool
  function contacts(gyBody) {
    body.root.updateMatrixWorld(true);
    let mx = 0, mz = 0, mk = 0;
    for (let i = 0; i < 2; i++) {
      _ank.setFromMatrixPosition(body.bones[FEET[i][0]].matrixWorld);
      _toe.setFromMatrixPosition(body.bones[FEET[i][1]].matrixWorld);
      const cx = (_ank.x + _toe.x) * 0.5, cz = (_ank.z + _toe.z) * 0.5;
      const g = heightAt ? heightAt(cx, cz) : gyBody, h = Math.min(_ank.y - 0.1, _toe.y - 0.035) - g;
      const k = 1 - Math.min(1, Math.max(0, h / 0.28));
      const yaw = Math.atan2(-(_toe.x - _ank.x), -(_toe.z - _ank.z));
      prints.setContact(i, cx, cz, yaw, k * k);
      if (footPrints) prints.add(cx, cz, yaw, i, G.t - 1);
      mx += cx * 0.5; mz += cz * 0.5; mk += k * 0.5;
    }
    // the broad pool under the whole body (between the feet, pulled toward the pelvis): grounds it in fog and drift
    _ank.setFromMatrixPosition(body.bones[BI.pelvis].matrixWorld);
    mx = mx * 0.6 + _ank.x * 0.4; mz = mz * 0.6 + _ank.z * 0.4;
    prints.setContact(2, mx, mz, brain.yaw, 0.35 + 0.45 * mk, 3.4);
    footPrints = false;
  }
  if (frozen) { faceCam(); prefill(0); }

  G.on('noise', (x, z, r) => brain.hear(x, z, r));
  const animIn = { speed: 0, turn: 0, state: 'patrol', x: 0, z: 0, yaw: 0, groundY: 0, still: false };
  const S = {
    brain, root: body.root, pos: brain.pos, anim, prints,
    get state() { return brain.state; }, get caught() { return brain.caught; },
    stats: { tris: body.tris, buildMs: body.ms },
    setPlayer(p) { player.pos = p.pos; player.hidden = !!p.hidden; player.lit = !!p.lit; player.beamOnMe = !!p.beamOnMe; },
    reset() {
      brain.reset(); last = brain.state; lastX = brain.pos.x; lastZ = brain.pos.z; lastYaw = brain.yaw;
      if (frozen) { faceCam(); prefill(G.t); } else prints.clear();
    },
    update(dt, t) {
      if (!frozen && !G.paused) brain.update(dt, player);
      if (brain.state !== last) { last = brain.state; G.emit('stalker:state', last, Math.hypot(player.pos.x - brain.pos.x, player.pos.z - brain.pos.z)); }
      // measured forward speed + turn rate drive the gait (feet stay planted even when collisions shove the body)
      const fx_ = -Math.sin(brain.yaw), fz_ = -Math.cos(brain.yaw), idt = dt > 1e-5 ? 1 / dt : 0;
      let dy = brain.yaw - lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      animIn.speed = ((brain.pos.x - lastX) * fx_ + (brain.pos.z - lastZ) * fz_) * idt;
      animIn.turn = dy * idt;
      animIn.state = brain.state;
      if (forced) { animIn.state = forced[0]; animIn.speed = forced[1]; animIn.turn = 0; }
      lastX = brain.pos.x; lastZ = brain.pos.z; lastYaw = brain.yaw;
      const gy = heightAt ? heightAt(brain.pos.x, brain.pos.z) : 0;
      animIn.x = brain.pos.x; animIn.z = brain.pos.z; animIn.yaw = brain.yaw; animIn.groundY = gy;
      animIn.still = frozen;
      if (forced) {
        // settle the blend weights for a deterministic still; sph = gait phase
        const sph = +(G.params.get('sph') || 0.15);
        for (let i = 0; i < 40; i++) anim.update(1 / 30, 0, animIn);
        anim.phase = sph; animIn.speed = 0; anim.update(1e-4, 0, animIn);
      } else anim.update(Math.min(dt, 0.05), frozen ? 0 : t, animIn); // stills: no idle sway (stable frame to frame)
      body.root.position.set(brain.pos.x, gy, brain.pos.z);
      body.root.rotation.y = brain.yaw + Math.PI; // rig faces +z; brain forward is -z at yaw 0
      contacts(gy);
      prints.update(t);
      // frost breath: a puff from the mouth on every exhale (faster and bigger when it runs)
      if (fx && !G.paused && !shot) {
        const ex = Math.sin(anim.breath) < -0.2;
        if (ex && !exhale) {
          body.root.updateMatrixWorld(true);
          body.bones[BI.jaw].localToWorld(_mouth.set(0, -0.03, 0.1));
          _vel.set(-Math.sin(brain.yaw) * (0.25 + brain.speed * 0.6), -0.05, -Math.cos(brain.yaw) * (0.25 + brain.speed * 0.6));
          breathOpt.count = brain.state === 'chase' ? 3 : 2;
          fx.smoke(_mouth, breathOpt);
        }
        exhale = ex;
      }
    },
    dispose() { G.scene.remove(body.root, prints.mesh); body.skin.dispose(); body.mesh.geometry.dispose(); prints.dispose(); },
  };
  return S;
}

// ?show=stalker: 3.2 m from the start point, knee-high and looking up into the dusk (WSW) so the head, the open jaw
// and the claws cut a hard silhouette against the sky while the flashlight pool grounds the feet; the fuel tank's end
// cap and the drum cluster are pushed to the frame edges.
const SHOW = { cam: [-19.6, 1.0, 6.0], target: [-21.2, 1.05, 8.8] };
export function showcase(G) {
  const a = G?.mods?.atmosphere; if (a && a.hold == null) a.hold = 0.35;
  return SHOW;
}
