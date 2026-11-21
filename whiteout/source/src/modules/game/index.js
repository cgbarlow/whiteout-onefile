// GAME (rules): player controller + interactions + objective loop + win/lose/restart + fear.
//   create(G, { input, colliders, terrain, station, generators, stalker, flashlight }) → {
//     player, state: 'playing'|'won'|'lost', time, objective, prompt, hold 0..1, fear 0..1, gens (running count),
//     hidden, calling, pickups, debug (bot helpers, see debug.js), reset(), update }
// Loop: crank GEN A/B/C (any order, hold E 3 s each; noisy) → beacon powers on → hold E 5 s at the radio console = WON.
// The stalker reaching the player = LOST (the view is wrenched round onto it, then the end screen). Torch cells sit in
// the lab dock and in chargers by the closed modules' doors (pickups.js). Hide = crouch inside the lab / radio hut /
// vehicle shed (station.insideAt): the stalker cannot see you there. Restart: G 'restart' (hud button) → spawn.
// Bus: emits 'game:end' (result, time) after the end beat, 'game:start' () on the first play and every restart;
//   listens 'restart', 'ui:state'. Per-frame cost is timed into __stats().gameMs (budget 0.3 ms).
import { PLAYER as P, RULES as R } from '../../contracts.js';
import { createPlayer } from './player.js';
import { createInteract } from './interact.js';
import { createPickups } from './pickups.js';
import { createDebug } from './debug.js';

const OBJ = ['Restart the generators  0/3', 'Restart the generators  1/3', 'Restart the generators  2/3',
  'Beacon live  call extraction from the radio hut', 'Calling extraction  keep holding', 'Extraction inbound'];
const END_BEAT = { won: 1.4, lost: 1.25 };   // s between the deciding moment and 'game:end' (the end screen)
const L_HIDE = 'Hold C  hide', L_HIDDEN = 'Hidden';
const HEAD_Y = 1.62, HEAD_FWD = 0.35;         // m: the stooped stalker's head above the snow / ahead of its feet

export function create(G, { input, colliders = [], terrain, station, generators, stalker, flashlight } = {}) {
  const heightAt = terrain?.heightAt ? (x, z) => terrain.heightAt(x, z) : null;
  const player = createPlayer(G, { input, colliders, heightAt });
  const pickups = createPickups(G, { heightAt });
  const inter = createInteract(G, { generators, flashlight, pickups });
  const S = {
    player, inter, pickups, state: 'playing', time: 0, objective: OBJ[0], prompt: '', hold: 0, fear: 0, gens: 0,
    hidden: false, calling: false, callT: 0, endT: 0, ms: 0, msMax: 0,
  };
  const pl = { pos: player.position, hidden: false, lit: false, beamOnMe: false };
  const far = { pos: { x: 1e4, y: 0, z: 1e4 }, hidden: true, lit: false, beamOnMe: false }; // debug.peace decoy
  const held = { pos: { x: 0, y: 0, z: 0 }, hidden: false, lit: false, beamOnMe: false };     // the caught beat
  let ended = false, started = false, msAcc = 0, msN = 0;

  const finish = (res) => {
    if (S.state !== 'playing') return;
    S.state = res; S.endT = END_BEAT[res]; S.hold = res === 'won' ? 1 : 0; S.prompt = '';
    player.control = false;
    if (res === 'lost') {
      // the catch: shoved back a step, the view wrenched onto its head, a hard jolt, the knees give
      const p = player.position, dx = p.x - stalker.pos.x, dz = p.z - stalker.pos.z, d = Math.hypot(dx, dz) || 1;
      // it stops where it caught you (its goal pinned just ahead of it) while the shove opens the distance
      held.pos.x = stalker.pos.x + (dx / d) * 0.3; held.pos.z = stalker.pos.z + (dz / d) * 0.3;
      stalker.setPlayer?.(held);
      player.knock(dx, dz, 6);
      aimHead();
      player.shake(1); player.slump = true;
    } else S.objective = OBJ[5];
  };
  // its head hangs forward of its feet, toward the player (stooped 2.4 m frame)
  const aimHead = () => {
    const p = player.position, dx = p.x - stalker.pos.x, dz = p.z - stalker.pos.z, d = Math.hypot(dx, dz) || 1;
    player.lookAt(stalker.pos.x + (dx / d) * HEAD_FWD, p.y + HEAD_Y, stalker.pos.z + (dz / d) * HEAD_FWD, 10);
  };
  const start = () => { if (!started) { started = true; G.emit('game:start'); } };
  S.reset = () => {
    player.teleport(P.spawn, P.spawnYaw); player.release(); player.control = true;
    generators?.reset?.(); stalker?.reset?.(); flashlight?.refill?.(); flashlight?.setOn?.(true);
    inter.reset(); input?.clear?.();
    S.state = 'playing'; S.time = 0; S.callT = 0; S.hold = 0; S.fear = 0; S.gens = 0; S.endT = 0; S.calling = false;
    S.hidden = false; S.prompt = ''; S.objective = OBJ[0]; ended = false;
    pickups.setConsole(false, 0, false);
    started = true; G.emit('game:start');
  };
  G.on('restart', S.reset);
  G.on('ui:state', (s) => { if (s === 'playing') start(); });

  S.update = (dt, t) => {
    const t0 = performance.now();
    player.fear = S.fear;
    player.update(dt, t);
    pickups.update(dt, t);
    if (!G.paused) step(dt);
    const ms = performance.now() - t0;
    msAcc += ms; msN++; if (ms > S.msMax) S.msMax = ms;
    if (msN >= 120) { S.ms = msAcc / msN; msAcc = 0; msN = 0; }
  };

  function step(dt) {
    if (S.state !== 'playing') {
      // end beat: the world keeps running (the stalker looms, the beacon flashes), then the end screen
      if (!ended && (S.endT -= dt) <= 0) { ended = true; G.emit('game:end', S.state, S.time); }
      if (S.state === 'lost') { aimHead(); S.fear += (1 - S.fear) * Math.min(1, dt * 6); }
      return;
    }
    S.time += dt;
    const p = player.position;
    const powered = !!generators?.beacon?.powered;
    S.gens = generators?.running ?? 0;
    // ---- interactions ----
    inter.query(p, player.yaw);
    S.prompt = inter.label; S.hold = 0;
    const holding = input.down('interact');
    let calling = false;
    if (inter.kind === 'gen') {
      if (holding) { S.hold = generators.crank(inter.target.id, dt); player.shake(0.12); } else S.hold = inter.target.progress || 0;
    } else if (inter.kind === 'cell') {
      if (input.pressed('interact')) inter.takeCell(inter.target);
    } else if (inter.kind === 'console' && powered) {
      calling = holding;
      S.hold = S.callT / R.callHold;
    }
    S.callT = calling ? S.callT + dt : Math.max(0, S.callT - dt * 0.5);
    if (inter.kind === 'console' && powered) S.hold = Math.min(1, S.callT / R.callHold);
    S.calling = calling;
    if (!S.debug.freezeConsole) pickups.setConsole(powered, calling ? S.callT / R.callHold : 0, false);
    if (S.callT >= R.callHold) { pickups.setConsole(true, 1, true); finish('won'); return; }
    S.gens = generators?.running ?? 0;
    S.objective = calling ? OBJ[4] : OBJ[Math.min(3, S.gens)];
    // ---- hiding ----
    const zone = station?.insideAt ? station.insideAt(p.x, p.z) : null;
    S.hidden = !!zone && player.crouching;
    if (zone && !S.prompt) S.prompt = S.hidden ? L_HIDDEN : L_HIDE;
    // ---- the stalker senses the player; fear follows its state and distance ----
    if (stalker && stalker.pos) {
      const peace = S.debug.peace;
      pl.hidden = S.hidden; pl.lit = !!flashlight?.on;
      pl.beamOnMe = !!flashlight?.beamHits?.(stalker.pos, 0.6);
      far.beamOnMe = pl.beamOnMe;
      stalker.setPlayer?.(peace ? far : pl);
      const d = Math.hypot(stalker.pos.x - p.x, stalker.pos.z - p.z);
      const st = stalker.state;
      const alert = st === 'chase' ? 1 : st === 'investigate' ? 0.55 : st === 'stagger' || st === 'retreat' ? 0.4 : 0;
      let want = Math.max(alert, Math.max(0, 1 - d / 26) * 0.9);
      if (S.hidden) want *= 0.6;
      S.fear += (want - S.fear) * Math.min(1, dt * (want > S.fear ? 2.5 : 0.6));
      if (stalker.caught && !peace) finish('lost');
    }
  }

  S.debug = createDebug(G, { S, player, generators, stalker, flashlight, pickups, station });
  G.statsHooks?.push(() => ({ gameMs: Math.round(S.ms * 1000) / 1000, gameMsMax: Math.round(S.msMax * 1000) / 1000 }));
  if (G.params.get('show') === 'game') showSetup(G, S, generators, flashlight);
  return S;
}

// ?show=game: the win interaction at the radio console, its LEDs staged as beacon-live with the call mid-way (PWR
// green, TX amber). The generators stay off: the real beacon's 1.2 s flash floods the hut through the window and
// would read as frame-to-frame shimmer in a still.
function showSetup(G, S, generators, flashlight) {
  S.pickups.setConsole(true, 0.6, false);
  S.debug.freezeConsole = true;
  G.on('ready', () => { flashlight?.setOn?.(true); });
}

// ?show=game frames the console from just inside the hut door (an explicit ?cam= from capture --poses wins). The
// OWNERS pose (-43.4,1.7,-14.2 → -45.4,1.1,-15) sits 0.55 m off the hut's east wall beside the door (it frames the
// HV placard), so the showcase stands in the doorway instead.
export const SHOW_CAM = [-45.05, 1.48, -15.05, -45.95, 1.02, -15.85];
export function showcase(G) {
  // pin the gust (as ?show=station/stalker do) so fog density and exposure hold still between the shimmer frames
  const a = G?.mods?.atmosphere; if (a && a.hold == null) a.hold = 0.3;
  const q = (G?.params?.get?.('cam') || '').split(',').map(Number), c = q.length === 6 && q.every(Number.isFinite) ? q : SHOW_CAM;
  return { cam: c.slice(0, 3), target: c.slice(3, 6) };
}
