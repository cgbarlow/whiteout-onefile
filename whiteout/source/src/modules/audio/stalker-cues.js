// Stalker cues: everything the player hears of the creature, placed at its body (HRTF + air absorption + speed of sound).
//   distant calls (patrol/listen, far: a wail every 14-30 s that echoes off the ice) · grunts while investigating ·
//   heavy footfalls in the snow when within 30 m (stride from the distance it actually moved) · close breathing loop
//   (fades in under 16 m, follows the head) · chase: sting + roar · stagger (beam on it): pained shriek.
//   createStalkerCues(G, A) → { onState(state), start(), update(dt, lx, lz), reset() }   (A = the audio module)
// Zero allocation per frame: one proxy Object3D-like { position } and a scratch Vector3 for the feet.
import { Vector3 } from 'three';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createStalkerCues(G, A) {
  const rng = G.rng ? G.rng(5151) : Math.random;
  const head = { position: new Vector3() }, feet = new Vector3();
  const S = { breath: null, breathG: 0, callT: 8 + rng() * 6, gruntT: 3, stride: 0, lastX: NaN, lastZ: 0, dist: 999, state: 'patrol' };

  const stk = () => { const s = G.mods?.stalker; return s && !s.isStub && s.pos ? s : null; };
  const callOpts = { pos: head.position, send: 0.65, speedOfSound: true, refDistance: 14, rolloff: 0.7, gain: 0.85, bus: 'sfx' };
  const gruntOpts = { pos: head.position, send: 0.35, refDistance: 6, rolloff: 1, gain: 0.5, rate: 0.85, bus: 'sfx' };
  const roarOpts = { pos: head.position, send: 0.45, refDistance: 8, rolloff: 0.9, gain: 1, rate: 0.8, bus: 'sfx' };
  const shriekOpts = { pos: head.position, send: 0.4, refDistance: 8, rolloff: 0.9, gain: 0.8, rate: 1.4, bus: 'sfx' };
  const stingOpts = { bus: 'sfx', gain: 0.95, pitchJitter: 0, duck: { bus: 'music', db: -8, hold: 1.2, release: 2.5 } };
  const stepOpts = { pos: feet, send: 0.15, refDistance: 4, rolloff: 1, gain: 0.8, rate: 0.6, bus: 'sfx' };

  const C = {
    head,
    get dist() { return S.dist; },
    start() {
      if (S.breath || !A.ready2) return;
      S.breath = A.play('breath', { loop: true, follow: head, gain: 0, send: 0.12, refDistance: 1.5, rolloff: 1.2, bus: 'sfx' });
      S.breathG = 0;
    },
    onState(st) {
      const prev = S.state; S.state = st;
      if (st === 'chase' && prev !== 'chase') { A.shot('sting', stingOpts); A.shot('growl', roarOpts); }
      else if (st === 'stagger') A.shot('growl', shriekOpts);
      else if (st === 'investigate' && prev !== 'investigate') S.gruntT = 0.6;
    },
    reset() { S.callT = 8 + rng() * 6; S.gruntT = 3; S.stride = 0; S.lastX = NaN; S.state = 'patrol'; },
    stop() { S.breath?.stop?.(0.5); S.breath = null; },
    update(dt, lx, lz, active) {
      const s = stk(); if (!s) return;
      const gy = s.root ? s.root.position.y : 0;
      head.position.set(s.pos.x, gy + 1.75, s.pos.z);
      const d = Math.hypot(s.pos.x - lx, s.pos.z - lz); S.dist = d;
      // footfalls: stride length from the distance actually travelled
      if (S.lastX === S.lastX) S.stride += Math.hypot(s.pos.x - S.lastX, s.pos.z - S.lastZ);
      S.lastX = s.pos.x; S.lastZ = s.pos.z;
      const strideLen = S.state === 'chase' ? 2.3 : 1.45;
      if (S.stride > strideLen) {
        S.stride = 0;
        if (d < 32 && active) {
          feet.set(s.pos.x, gy + 0.05, s.pos.z);
          stepOpts.gain = 0.35 + 0.6 * sstep(32, 4, d); stepOpts.rate = S.state === 'chase' ? 0.7 : 0.58;
          A.shot('step_snow', stepOpts);
        }
      }
      if (!active) { if (S.breath && S.breathG > 0) { S.breath.setGain(0, 0.3); S.breathG = 0; } return; }
      // breathing: only up close (the HRTF panner already handles distance; this keeps it out of the far mix)
      if (S.breath) {
        const g = sstep(16, 3, d) * (S.state === 'chase' ? 1 : 0.75);
        if (Math.abs(g - S.breathG) > 0.01) { S.breath.setGain(g, 0.25); S.breathG = g; }
        const r = S.state === 'chase' ? 1.35 : 1;
        if (r !== S.breathR) { S.breath.setRate(r, 0.6); S.breathR = r; }
      }
      // distant calls while it roams; grunts while it hunts a noise
      S.callT -= dt; S.gruntT -= dt;
      if ((S.state === 'patrol' || S.state === 'listen') && S.callT <= 0) {
        S.callT = 14 + rng() * 16;
        if (d > 15) A.shot('call', callOpts);
      }
      if (S.state === 'investigate' && S.gruntT <= 0) { S.gruntT = 5 + rng() * 5; if (d < 40) A.shot('growl', gruntOpts); }
    },
  };
  return C;
}
