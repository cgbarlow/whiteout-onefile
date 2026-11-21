// Offline render of WHITEOUT's sound bank: the cookbook presets this game uses (sfx.js presetJobs, `only`) + the
// custom recipes (recipes.js) + the SONGS.calm stems (music.js stemJobs), time-sliced by synth.runJobs after G.ready.
// Two passes so the world is audible early: pass 1 = ambience + footsteps, pass 2 = everything else + music.
// Every render is metered (meter.analyse) before it becomes an AudioBuffer: peak > -1 dBFS, NaN or a silent stem
// is pushed to G.errors (the quality bar is a runtime gate, not a hope).
//   renderBank(G, ctx, { onPass(bank, pass) }) → Promise<{ bank, music: { stems, loop, bpm }, report }>
import { render, runJobs, toAudioBuffer } from '../../cookbook/audio/synth.js';
import { presetJobs } from '../../cookbook/audio/sfx.js';
import { stemJobs, SONGS } from '../../cookbook/audio/music.js';
import { analyse } from '../../cookbook/audio/meter.js';
import { RECIPES } from './recipes.js';

const SONG = SONGS.calm, MUSIC_SR = 16000;     // pads/bass under a blizzard: 8 kHz of bandwidth is plenty
// render rate per preset: band-limited beds and low engines do not need 44.1 kHz (budget: ≤ 2 s CPU for everything)
const PRESET_SR = { wind: 16000, engine_idle: 24000, engine_high: 24000, growl: 24000 };
const PASS1 = { presets: ['wind', 'step_snow', 'step_metal'], custom: ['wind_howl', 'snow_hiss', 'wind_gust'] };
const PASS2 = { presets: ['engine_idle', 'engine_high', 'growl'], custom: Object.keys(RECIPES).filter((k) => !PASS1.custom.includes(k)) };

// 'wrap' loops: layers stop at the loop length so the folded tail holds only release/ringing (never a doubled head)
function prep(recipe) {
  if (recipe.loop === 'wrap') for (const L of recipe.layers) if (L.dur == null) L.dur = recipe.dur - (L.start || 0);
  return recipe;
}
const seedOf = (name, v) => 977 + v * 7919 + name.length * 131 + name.charCodeAt(0) * 17 + name.charCodeAt(name.length - 1);
function customJobs(names, sr) {
  const out = [];
  for (const name of names) {
    const R = RECIPES[name];
    for (let v = 0; v < (R.variants || 1); v++) {
      const s = seedOf(name, v);
      let x = s >>> 0; const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
      const recipe = prep(R.make(rnd, v));
      if (R.sr) recipe.sr = R.sr;
      out.push({ name, variant: v, gen: render(recipe, { sr, seed: s, name: `${name}#${v}` }) });
    }
  }
  return out;
}

function meter(G, report, label, res, ms) {
  const m = analyse(res);
  const ok = m.nan === 0 && m.clip === 0 && !m.silent && m.peakDb <= -1;
  report.rows.push({ name: label, peakDb: m.peakDb, rmsDb: m.rmsDb, dur: m.dur, ms: Math.round(ms), ok });
  if (!ok) G.errors.push(`audio: ${label} failed the meter (peak ${m.peakDb} dBFS, rms ${m.rmsDb}, nan ${m.nan}, silent ${m.silent})`);
  if (m.peakDb > report.peakDb) report.peakDb = m.peakDb;
}

// wraps a render generator to measure the CPU it really takes (wall time also includes the frames between slices)
function* timed(gen, report, slot) {
  for (;;) {
    const a = performance.now(), r = gen.next(), dt = performance.now() - a;
    report.cpuMs += dt; slot.ms += dt;
    if (r.done) return r.value;
    yield;
  }
}

async function pass(G, ctx, spec, sr, report, withMusic) {
  const t0 = performance.now();
  const jobs = [...spec.presets.flatMap((n) => presetJobs({ sr: PRESET_SR[n] || sr, only: [n] })), ...customJobs(spec.custom, sr)];
  const mj = withMusic ? stemJobs(SONG, { sr: MUSIC_SR }) : [];
  const gens = [...jobs.map((jb) => jb.gen), ...mj.map((m) => m.gen)], slots = gens.map(() => ({ ms: 0 }));
  const res = await runJobs(gens.map((g, i) => timed(g, report, slots[i])), { budgetMs: 5 });
  const bank = {}, stems = {};
  jobs.forEach((jb, i) => { meter(G, report, `${jb.name}#${jb.variant}`, res[i], slots[i].ms); (bank[jb.name] ||= [])[jb.variant] = toAudioBuffer(ctx, res[i]); });
  mj.forEach((m, i) => { const r = res[jobs.length + i]; meter(G, report, 'music.calm.' + m.name, r, slots[jobs.length + i].ms); stems[m.name] = toAudioBuffer(ctx, r); });
  report.wallMs += Math.round(performance.now() - t0);
  report.buffers += jobs.length + mj.length;
  return { bank, stems };
}

export async function renderBank(G, ctx, { onPass } = {}) {
  const sr = Math.min(44100, ctx.sampleRate);
  const report = { rows: [], peakDb: -Infinity, cpuMs: 0, wallMs: 0, buffers: 0 };
  const p1 = await pass(G, ctx, PASS1, sr, report, false);
  onPass && onPass(p1.bank, 1);
  const p2 = await pass(G, ctx, PASS2, sr, report, true);
  onPass && onPass(p2.bank, 2);
  report.cpuMs = Math.round(report.cpuMs);
  const loop = SONG.chords.length * SONG.beatsPerChord * 60 / SONG.bpm;
  return { bank: { ...p1.bank, ...p2.bank }, music: { stems: p2.stems, loop, bpm: SONG.bpm }, report };
}
