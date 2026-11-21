// AUDIO: the blizzard you hear. Mixer graph (cookbook audio/mixer.js) suspended until the first gesture; the bank
// (bank.js: cookbook presets + recipes.js + SONGS.calm stems) renders time-sliced AFTER ready in two passes
// (ambience + steps first) and is metered on the way in (peak ≤ -1 dBFS, no NaN, no silent stem → else G.errors).
//   create(G, { generators, atmosphere }) → { mixer, music, play(name, o), setVolume(v), unlock(), update, stats }
// Layers: wind bed + resonant howl + ice-grain hiss (gains/rate follow atmosphere.gust, gust fronts placed upwind),
//   muffled through a lowpass and swapped to the 'room' reverb inside the lab (atmosphere.indoor) where the
//   fluorescent ballast hums at the lamp · footsteps: snow crunch outdoors / deck plate inside, round-robin variants,
//   crouch quieter and duller · generators: starter crank + sputter while cranking, catch, idle loop at each unit
//   (per-unit rate), arc fizz at faulty C · stalker (stalker-cues.js) · heartbeat from game.fear · beacon chirp at
//   the tower lamp · end stingers · music intensity by stalker state.
// Voices: mixer cap 26 + 5 music stems ≤ 32. update() is allocation-free.
import { createMixer } from '../../cookbook/audio/mixer.js';
import { createMusic } from '../../cookbook/audio/music.js';
import { renderBank } from './bank.js';
import { createStalkerCues } from './stalker-cues.js';

const MAX_VOICES = 26;
const HEADROOM = 0.85;                                  // master trim: the worst-case mix (3 engines + chase + stinger) stays under -2 dBFS at 100 %
const INTENSITY = { patrol: 0.12, listen: 0.3, investigate: 0.55, chase: 1, stagger: 0.75, retreat: 0.35 };
const GEN_RATE = [0.94, 1.0, 1.07];                     // no two skids idle at the same pitch
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function create(G, { generators = null, atmosphere = null } = {}) {
  const mixer = createMixer({ volume: 0.8 * HEADROOM, maxVoices: MAX_VOICES });
  const ctx = mixer.ctx;
  // outdoor ambience path: loops → lowpass (closes inside the lab) → ambience bus
  const ambIn = ctx.createGain(), ambLp = ctx.createBiquadFilter();
  ambLp.type = 'lowpass'; ambLp.frequency.value = 12000; ambLp.Q.value = 0.4;
  ambIn.connect(ambLp); ambLp.connect(mixer.bus('ambience'));
  const rng = G.rng ? G.rng(7331) : Math.random;

  const A = { mixer, music: null, ready1: false, ready2: false, stats: { ready: false, voices: 0, cpuMs: 0, wallMs: 0, buffers: 0, peakDb: null, failed: 0 } };
  Object.defineProperty(A, 'ready', { get: () => A.ready1 });
  const live = () => ctx.state === 'running';
  A.play = (name, o) => (live() && (typeof name !== 'string' || mixer.has(name)) ? mixer.play(name, o) : null);
  // one-shots never steal a loop: they are dropped when the pool is nearly full (the mixer steals the OLDEST voice,
  // which would be a wind bed or an engine)
  A.shot = (name, o) => (mixer.voiceCount < MAX_VOICES - 2 ? A.play(name, o) : null);
  A.setVolume = (v) => { mixer.setVolume('master', Math.max(0, Math.min(1, +v || 0)) * HEADROOM, 0.15); };
  A.unlock = () => mixer.unlock();

  const W = { bed: null, howl: null, hiss: null, hum: null, gBed: -1, gHowl: -1, gHiss: -1, rHowl: -1, gHum: -1, lp: -1, gustArmed: true, gustCd: 6, idleGust: 10 };
  const env = { indoor: false, k: 0 };
  const gens = {};                                       // id → { kind, a, b, arc }
  const beat = { t: 0, gain: 0 };
  const beacon = { on: false, t: 0 };
  const end = { over: false };
  const _gp = [0, 0, 0];
  const stepI = { step_snow: 0, step_metal: 0 };
  const cues = createStalkerCues(G, A);

  // ---------- loops ----------
  const ambLoop = (name, gain) => {
    const v = A.play(name, { loop: true, bus: 'ambience', gain, pitchJitter: 0 });
    if (v) { v.gain.disconnect(); v.gain.connect(ambIn); }       // reroute through the indoor lowpass
    return v;
  };
  const startAmbience = () => {
    if (!A.ready1 || !live() || W.bed) return;
    W.bed = ambLoop('wind', 0.4); W.howl = ambLoop('wind_howl', 0.1); W.hiss = ambLoop('snow_hiss', 0.15);
  };
  const lampAt = () => G.mods?.station?.interior?.probeAt || null;
  const startWorld = () => {
    if (!A.ready2 || !live()) return;
    if (!A.music && A._music) {
      A.music = createMusic(mixer, A._music, { intensity: INTENSITY.patrol, gain: 0.8 });
      if (!end.over) A.music.start();
    }
    const lp = lampAt();
    if (!W.hum && lp) W.hum = A.play('lab_hum', { loop: true, pos: lp, gain: 0.1, refDistance: 1.6, rolloff: 1.6, send: 0.2, pitchJitter: 0 });
    for (const e of generators?.list || []) syncGen(e, null);
    cues.start();
  };
  function syncGen(e, prev) {
    if (!A.ready2 || !live()) return;
    const g = gens[e.id] ||= { kind: 'off', a: null, b: null, arc: null };
    const i = Math.max(0, (generators.list || []).indexOf(e)), rate = GEN_RATE[i % GEN_RATE.length];
    if (e.faulty && !g.arc) g.arc = A.play('arc', { loop: true, pos: e.pos, gain: 0.45, refDistance: 1.2, rolloff: 1.4, send: 0.15, pitchJitter: 0 });
    if (g.kind === e.state) return;
    g.a?.stop(0.35); g.b?.stop(0.35); g.a = g.b = null; g.kind = e.state;
    if (e.state === 'cranking') {
      g.a = A.play('crank', { loop: true, pos: e.pos, gain: 0.75, rate: rate * 1.02, refDistance: 2.5, send: 0.2, pitchJitter: 0 });
      g.b = A.play('engine_high', { loop: true, pos: e.pos, gain: 0.16, rate: 0.38 * rate, refDistance: 2.5, send: 0.2, pitchJitter: 0 });   // misfiring sputter under the starter
    } else if (e.state === 'running') {
      if (prev === 'cranking') A.shot('gen_catch', { pos: e.pos, gain: 0.95, refDistance: 3, send: 0.3, rate });
      g.a = A.play('engine_idle', { loop: true, pos: e.pos, gain: 0.7, rate: 0.82 * rate, refDistance: 3, rolloff: 0.9, send: 0.18, pitchJitter: 0 });
      g.b = A.play('alternator', { loop: true, pos: e.pos, gain: 0.3, rate, refDistance: 2, send: 0.1, pitchJitter: 0 });   // alternator whine + cooling fan
    }
  }
  const stopAll = (fade) => {
    for (const k in gens) { const g = gens[k]; g.a?.stop(fade); g.b?.stop(fade); g.a = g.b = null; g.kind = 'off'; }
    cues.stop();
  };

  // ---------- bank: render after ready ----------
  G.on('ready', () => {
    renderBank(G, ctx, {
      onPass: (bank, pass) => {
        mixer.addBank(bank);
        if (pass === 1) { A.ready1 = true; startAmbience(); }
      },
    }).then(async (r) => {
      await mixer.setEnv('room'); await mixer.setEnv('outdoor');   // both IRs cached; outdoor active
      A._music = r.music; A.ready2 = true;
      Object.assign(A.stats, { ready: true, cpuMs: r.report.cpuMs, wallMs: r.report.wallMs, buffers: r.report.buffers, peakDb: r.report.peakDb,
        failed: r.report.rows.filter((x) => !x.ok).length });
      A.report = r.report;
      console.info(`[audio] ${r.report.buffers} buffers, cpu ${r.report.cpuMs} ms (wall ${r.report.wallMs} ms), peak ${r.report.peakDb} dBFS, ${A.stats.failed} failed`);
      startWorld();
    }).catch((e) => G.errors.push('audio: ' + (e && e.message || e)));
  });
  mixer.unlocked.then(() => { startAmbience(); startWorld(); });

  // ---------- events ----------
  G.on('player:step', (speed, crouch) => {
    const name = env.indoor ? 'step_metal' : 'step_snow', list = mixer.bank[name];
    if (!list || !live()) return;
    const i = stepI[name] = (stepI[name] + 1 + (rng() < 0.3 ? 1 : 0)) % list.length;   // never the same variant twice
    stepOpts.gain = crouch ? 0.26 : Math.min(0.9, 0.38 + speed * 0.09);
    stepOpts.rate = crouch ? 0.93 : speed > 4 ? 1.05 : 1;
    stepOpts.send = env.indoor ? 0.3 : 0.06;
    if (mixer.voiceCount < MAX_VOICES - 2) mixer.play(list[i], stepOpts);
  });
  const stepOpts = { bus: 'sfx', gain: 0.6, rate: 1, send: 0.06 };
  G.on('gen:state', (id, st) => {
    const e = generators?.list?.find((x) => x.id === id); if (!e) return;
    const prev = gens[id]?.kind ?? 'off';
    syncGen(e, prev);
  });
  G.on('stalker:state', (st) => {
    cues.onState(st);
    if (!end.over) A.music?.setIntensity(INTENSITY[st] ?? 0.2, st === 'chase' ? 0.8 : 4);
  });
  G.on('beacon:on', () => {
    beacon.on = true; beacon.t = 0.8;
    A.shot('chirp', { bus: 'ui', gain: 0.8, pitchJitter: 0 });      // the handheld radio answers first
  });
  G.on('game:end', (res) => {
    end.over = true; beat.gain = 0;
    if (A.music) { A.music.output.gain.setTargetAtTime(0, ctx.currentTime, res === 'won' ? 1.2 : 0.25); }
    if (res === 'won') A.shot('stinger_won', { bus: 'music', gain: 1, pitchJitter: 0 });
    else { A.shot('stinger_lost', { bus: 'sfx', gain: 1, pitchJitter: 0 }); A.shot('growl', { bus: 'sfx', gain: 0.9, rate: 0.75, pitchJitter: 0 }); }
    cues.stop();
  });
  const restart = () => {
    end.over = false; beacon.on = false; cues.reset();
    if (A.music) { A.music.setIntensity(INTENSITY.patrol, 0.1); A.music.output.gain.setTargetAtTime(0.8, ctx.currentTime, 0.5); A.music.start(); }
    for (const e of generators?.list || []) syncGen(e, null);
    cues.start();
  };
  G.on('game:start', restart);
  G.on('restart', () => stopAll(0.2));               // the game's reset then emits gen:state + game:start

  // ---------- per frame (allocation-free) ----------
  A.update = (dt = 1 / 60) => {
    dt = Math.min(0.1, dt);
    mixer.update(G.camera);
    A.stats.voices = mixer.voiceCount;
    const cam = G.camera.position;
    // inside / outside: reverb swap + outdoor muffle + lab hum
    const indoor = !!atmosphere?.indoor;
    if (indoor !== env.indoor) { env.indoor = indoor; if (A.ready2) mixer.setEnv(indoor ? 'room' : 'outdoor', 0.5); }
    env.k += ((indoor ? 1 : 0) - env.k) * Math.min(1, dt * 3);
    const lp = 12000 * Math.pow(650 / 12000, env.k);
    if (Math.abs(lp - W.lp) > 20) { ambLp.frequency.setTargetAtTime(lp, ctx.currentTime, 0.05); W.lp = lp; }
    if (W.hum) { const g = 0.08 + 0.42 * env.k; if (Math.abs(g - W.gHum) > 0.01) { W.hum.setGain(g, 0.2); W.gHum = g; } }
    // wind follows the gust
    const gust = atmosphere ? Math.max(0, Math.min(1, atmosphere.gust || 0)) : 0.4, out = 1 - 0.5 * env.k;
    if (W.bed) {
      const gb = (0.32 + 0.4 * gust) * out, gh = (0.06 + 0.8 * gust * gust) * out, gs = (0.08 + 0.55 * gust) * (1 - 0.85 * env.k), rh = 0.9 + 0.22 * gust;
      if (Math.abs(gb - W.gBed) > 0.008) { W.bed.setGain(gb, 0.3); W.gBed = gb; }
      if (Math.abs(gh - W.gHowl) > 0.008) { W.howl.setGain(gh, 0.4); W.gHowl = gh; }
      if (Math.abs(gs - W.gHiss) > 0.008) { W.hiss.setGain(gs, 0.3); W.gHiss = gs; }
      if (Math.abs(rh - W.rHowl) > 0.004) { W.howl.setRate(rh, 0.8); W.rHowl = rh; }
      // gust fronts: a whoosh passing upwind of the listener on every rising gust (and now and then in the lulls)
      W.gustCd -= dt; W.idleGust -= dt;
      if (gust < 0.4) W.gustArmed = true;
      const rising = W.gustArmed && gust > 0.55 && W.gustCd <= 0, idle = W.idleGust <= 0;
      if ((rising || idle) && !indoor) {
        const a = rng() * Math.PI * 2, r = 14 + rng() * 10;
        _gp[0] = cam.x + Math.cos(a) * r; _gp[1] = cam.y + 2.5; _gp[2] = cam.z + Math.sin(a) * r;
        gustOpts.gain = rising ? 0.55 + 0.45 * gust : 0.3; gustOpts.rate = 0.9 + rng() * 0.2;
        A.shot('wind_gust', gustOpts);
        if (rising) { W.gustArmed = false; W.gustCd = 5; }
        W.idleGust = 9 + rng() * 9;
      }
    }
    const game = G.mods?.game;
    const playing = !end.over && !G.paused && (!game || game.state === 'playing');
    cues.update(dt, cam.x, cam.z, playing && A.ready2);
    // heartbeat from game.fear: rate 62 → 138 bpm, fades in above fear 0.15
    const fear = playing && game ? game.fear || 0 : 0;
    beat.t -= dt;
    if (beat.t <= 0) {
      beat.t = 60 / (62 + 76 * fear);
      const g = sstep(0.15, 0.85, fear);
      if (g > 0.02) { beatOpts.gain = 0.25 + 0.75 * g; A.shot('heartbeat', beatOpts); }
    }
    // beacon chirp from the tower lamp, every second flash
    if (beacon.on && !end.over && generators?.beacon?.lampAt) {
      beacon.t -= dt;
      if (beacon.t <= 0) { beacon.t = 2.4; chirpOpts.pos = generators.beacon.lampAt; A.shot('chirp', chirpOpts); }
    }
  };
  const gustOpts = { pos: _gp, bus: 'ambience', gain: 0.6, rate: 1, send: 0.25, refDistance: 10, rolloff: 0.6 };
  const beatOpts = { bus: 'sfx', gain: 0.5, pitchJitter: 0.01 };
  const chirpOpts = { pos: null, bus: 'sfx', gain: 0.9, refDistance: 16, rolloff: 0.6, send: 0.5, speedOfSound: true, pitchJitter: 0 };

  A.rerender = () => renderBank(G, ctx, {}).then((r) => r.report);   // diagnostics: re-time the bank render
  window.__audio = A;
  return A;
}

// ?show=audio: the HUD framing over the station (audio has no geometry of its own); window.__audio.stats / .report
// carry the render budget + meter rows for the bot.
export function showcase() { return { cam: [44, 1.68, 12], target: [0, 2.6, 2] }; }
