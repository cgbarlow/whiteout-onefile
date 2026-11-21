// WHITEOUT sound design: synth.js recipes for everything the cookbook presets do not cover.
// Each entry: name → { variants, sr?, make(rnd, v) → recipe }. Loudness is relative (peakDb); buses do the mix.
//   wind_howl (loop)   two resonant howl bands gliding around the station edges, swells with the gust
//   snow_hiss (loop)   blown ice grains rattling against parkas / skins (bright crackle bed)
//   wind_gust ×3       a gust front passing (pink swell + whistle), placed upwind of the listener
//   lab_hum (loop)     fluorescent ballast: 100 Hz buzz stack + tube sizzle (positional at the lab lamp)
//   crank (loop)       12 V starter on a cold diesel: whine dipping at every compression + chug thump + rattle
//   alternator (loop)  running unit: alternator whine + cooling fan
//   gen_catch          the engine catching: pops, a rev bark settling into idle
//   arc (loop)         loose exciter lead on GEN C: irregular arc snaps over a 100 Hz sputter
//   call ×3            distant stalker call: a long hoarse wail, formant voice, glide contour per variant
//   breath (loop)      the creature breathing close: wet inhale/exhale with a low rumble undertone
//   sting              chase sting: brass-like cluster stab + sub boom + metal scrape
//   heartbeat ×2       lub-dub (sine thumps + chest-cavity noise)
//   chirp              beacon chirp: FM double blip with a breath of radio static
//   stinger_won / stinger_lost   end-of-run cues
const j = (r, a, b) => a + (b - a) * r();
const ON = { a: 0.0005, s: 1, r: 0.0005 }; // flat bed envelope for loops (no dip at the seam)
const TAU = Math.PI * 2;
// smooth periodic pulse 0..1 at phase p (0..1): fast rise, exponential fall
const pulse = (p, rise, fall) => (p < rise ? p / rise : Math.exp(-(p - rise) / fall));

export const RECIPES = {
  wind_howl: { variants: 1, sr: 16000, make: () => ({
    dur: 8, loop: 1.5, peakDb: -10,
    layers: [
      // low moan: narrow band glides 240-420 Hz (whole cycles over 8 s)
      { type: 'noise', color: 'pink', stereo: true, env: ON, amp: 1, am: { f: 1 / 4, depth: 0.55 },
        filters: [{ type: 'bp', f: (t) => 330 + 70 * Math.sin(TAU * t / 8) + 25 * Math.sin(TAU * t / 2.667 + 1), q: 9 }] },
      // upper howl around the masts and guy wires
      { type: 'noise', color: 'white', env: ON, amp: 0.55, pan: 0.35, am: { f: 1 / 4, depth: 0.8 },
        filters: [{ type: 'bp', f: (t) => 720 + 160 * Math.sin(TAU * t / 6 + 0.6) + 40 * Math.sin(TAU * t / 2), q: 16 }] },
      { type: 'noise', color: 'white', env: ON, amp: 0.2, pan: -0.4, am: { f: 1 / 2, depth: 0.9 },
        filters: [{ type: 'bp', f: (t) => 1150 + 260 * Math.sin(TAU * t / 8 + 2) + 90 * Math.sin(TAU * t / 1.6), q: 20 }] },
    ],
    fx: [{ type: 'width', amt: 0.6 }],
  }) },
  snow_hiss: { variants: 1, sr: 22050, make: () => ({
    dur: 6, loop: 1.2, peakDb: -14,
    layers: [
      { type: 'crackle', rate: 2600, grain: 0.0006, env: ON, filters: [{ type: 'hp', f: 3200 }, { type: 'lp', f: 9000 }], amp: 0.7, pan: -0.5 },
      { type: 'crackle', rate: 2600, grain: 0.0006, env: ON, filters: [{ type: 'hp', f: 3200 }, { type: 'lp', f: 9000 }], amp: 0.7, pan: 0.5 },
      { type: 'noise', color: 'white', stereo: true, env: ON, filters: [{ type: 'hp', f: 4500 }], amp: 0.12, am: { f: 0.5, depth: 0.5 } },
    ],
    fx: [{ type: 'width', amt: 0.5 }],
  }) },
  wind_gust: { variants: 3, sr: 16000, make: (r) => {
    const d = j(r, 3.2, 4.4), pk = j(r, 0.35, 0.5);
    const sw = (t) => { const x = Math.min(1, t / d); return x < pk ? Math.pow(x / pk, 1.6) : Math.pow((1 - x) / (1 - pk), 2.2); };
    return { dur: d, peakDb: -6, layers: [
      { type: 'noise', color: 'pink', stereo: true, env: sw, amp: 1, filters: [{ type: 'bp', f: (t) => 260 + j(r, 700, 1000) * sw(t), q: 1.1 }] },
      { type: 'noise', color: 'brown', stereo: true, env: sw, amp: 0.9, filters: [{ type: 'lp', f: 220 }] },
      { type: 'noise', color: 'white', env: (t) => Math.pow(sw(t), 3), amp: 0.45, filters: [{ type: 'bp', f: (t) => j(r, 900, 1300) + 500 * sw(t), q: 14 }] },
    ], fx: [{ type: 'width', amt: 0.6 }] };
  } },
  lab_hum: { variants: 1, sr: 22050, make: () => ({
    dur: 2, loop: 'wrap', tail: 0.05, peakDb: -12,
    layers: [
      ...[[1, 1], [2, 0.6], [3, 0.45], [4, 0.2], [5, 0.12]].map(([h, a], i) => ({ type: 'osc', wave: 'sine', freq: 100 * h, env: ON, amp: a * 0.5, pan: i % 2 ? 0.25 : -0.25 })),
      { type: 'osc', wave: 'saw', freq: 100, env: ON, amp: 0.25, filters: [{ type: 'bp', f: 2400, q: 1.2 }], am: { f: 0.5, depth: 0.35 } },   // ballast buzz
      { type: 'noise', color: 'white', stereo: true, env: ON, amp: 0.05, filters: [{ type: 'hp', f: 6000 }], am: { f: 100, depth: 0.7 } }, // tube sizzle
    ],
  }) },
  crank: { variants: 1, sr: 24000, make: () => {
    const per = 0.32, n = 5;                 // 5 compressions per 1.6 s loop (periodic → 'wrap')
    const ph = (t) => (t % per) / per;
    return { dur: per * n, loop: 'wrap', tail: 0.1, peakDb: -6, layers: [
      // starter motor whine sags at each compression stroke
      { type: 'osc', wave: 'saw', voices: 2, detune: 12, freq: (t) => 150 + 70 * (1 - Math.exp(-ph(t) * 5)), env: ON, amp: 0.4,
        filters: [{ type: 'bp', f: 900, q: 0.9 }, { type: 'lp', f: 2400 }], drive: 1.5 },
      // compression chug thump
      { type: 'osc', wave: 'sine', freq: (t) => 70 - 25 * ph(t), env: (t) => pulse(ph(t), 0.02, 0.18), amp: 1.2, drive: 1.8 },
      { type: 'noise', color: 'pink', env: (t) => pulse(ph(t), 0.015, 0.12), amp: 0.9, filters: [{ type: 'lp', f: 520 }] },
      // pinion / valve-train rattle
      { type: 'crackle', rate: (t) => 120 + 500 * pulse(ph(t), 0.05, 0.3), grain: 0.0025, env: ON, amp: 0.35, filters: [{ type: 'bp', f: 2600, q: 1.4 }] },
    ], fx: [{ type: 'lp', f: 3200 }, { type: 'width', amt: 0.2 }] };
  } },
  alternator: { variants: 1, sr: 24000, make: () => ({
    // brushless alternator whine (1.2 kHz, 2 s = whole cycles) + cooling-fan blade-pass hum and air rush
    dur: 2, loop: 'wrap', tail: 0.05, peakDb: -14,
    layers: [
      { type: 'osc', wave: 'sine', freq: 1200, env: ON, amp: 0.35, am: { f: 3, depth: 0.25 } },
      { type: 'osc', wave: 'sine', freq: 2400, env: ON, amp: 0.12 },
      { type: 'osc', wave: 'tri', freq: 150, env: ON, amp: 0.5, filters: [{ type: 'lp', f: 600 }] },
      { type: 'noise', color: 'pink', stereo: true, env: ON, amp: 0.6, filters: [{ type: 'bp', f: 700, q: 0.6 }], am: { f: 25, depth: 0.3 } },
    ],
  }) },
  gen_catch: { variants: 1, sr: 24000, make: () => ({
    dur: 1.6, peakDb: -4,
    layers: [
      { type: 'crackle', rate: [[0, 18], [0.35, 30], [0.6, 4]], grain: 0.012, dur: 0.8, env: { a: 0.002, d: 0.9 }, amp: 1, filters: [{ type: 'lp', f: 900 }], drive: 2 },
      { type: 'osc', wave: 'saw', freq: [[0, 22], [0.25, 46], [0.55, 38], [1.2, 30]], start: 0.1, dur: 1.5, env: { a: 0.04, h: 0.25, d: 1.1 }, amp: 0.9,
        filters: [{ type: 'lp', f: [[0, 300], [0.3, 1400], [1.2, 500]], q: 1.4 }], drive: 2.5 },
      { type: 'osc', wave: 'sine', freq: [[0, 40], [0.3, 70], [1.0, 55]], start: 0.1, dur: 1.4, env: { a: 0.03, h: 0.2, d: 0.9 }, amp: 0.7 },
      { type: 'noise', color: 'white', start: 0.12, dur: 0.6, env: { a: 0.02, d: 0.4 }, amp: 0.2, filters: [{ type: 'bp', f: 1800, q: 0.8 }] }, // exhaust huff
    ],
    fx: [{ type: 'echo', time: 0.14, fb: 0.15, mix: 0.12, lp: 1200 }],
  }) },
  arc: { variants: 1, sr: 24000, make: () => ({
    dur: 3, loop: 0.4, peakDb: -9,
    layers: [
      { type: 'crackle', rate: (t) => 35 + 160 * Math.pow(0.5 + 0.5 * Math.sin(TAU * t * 1.3) * Math.sin(TAU * t * 0.37), 3), grain: 0.003, env: ON, amp: 1, filters: [{ type: 'hp', f: 1400 }], drive: 2 },
      { type: 'osc', wave: 'square', freq: 100, env: (t) => Math.pow(Math.max(0, Math.sin(TAU * t * 0.9) * Math.sin(TAU * t * 2.3)), 2), amp: 0.25, filters: [{ type: 'bp', f: 1800, q: 1.5 }] },
      { type: 'noise', color: 'white', env: (t) => Math.pow(Math.max(0, Math.sin(TAU * t * 0.67 + 1)), 8), amp: 0.3, filters: [{ type: 'hp', f: 3000 }] }, // sizzle bursts
    ],
  }) },
  call: { variants: 3, sr: 24000, make: (r, v) => {
    // v0 a rising-falling wail · v1 two syllables "hoo—oooh" · v2 a descending groan that breaks into a stutter
    const d = [j(r, 2.8, 3.2), j(r, 3.0, 3.6), j(r, 2.4, 2.8)][v], f0 = [175, 200, 230][v];
    const contour = [(x) => 1 + 0.6 * Math.sin(Math.PI * Math.min(1, x * 1.15)) - 0.2 * x,
      (x) => (x < 0.32 ? 1.15 - 0.15 * x / 0.32 : 0.9 + 0.5 * Math.sin(Math.PI * Math.min(1, (x - 0.38) / 0.62 * 0.8))),
      (x) => 1.25 - 0.6 * x + 0.08 * Math.sin(TAU * x * 9) * x][v];
    const shape = [(x) => Math.min(1, x / 0.15) * Math.min(1, (1 - x) / 0.35),
      (x) => (x < 0.3 ? Math.min(1, x / 0.06) * Math.min(1, (0.3 - x) / 0.06) * 0.8 : x < 0.38 ? 0 : Math.min(1, (x - 0.38) / 0.12) * Math.min(1, (1 - x) / 0.3)),
      (x) => Math.min(1, x / 0.08) * Math.min(1, (1 - x) / 0.3) * (x > 0.55 ? 0.55 + 0.45 * Math.abs(Math.sin(TAU * x * 7)) : 1)][v];
    const env = (t) => Math.max(0, shape(Math.min(1, t / d))) ** 1.3;
    const fq = (t) => f0 * contour(Math.min(1, t / d)) * (1 + 0.03 * Math.sin(TAU * 5.2 * t) + 0.012 * Math.sin(TAU * 29 * t));
    return { dur: d + 1.6, peakDb: -4, layers: [
      { type: 'osc', wave: 'saw', voices: 3, detune: 18, freq: fq, dur: d, env, amp: 0.7, drive: 1.6,
        filters: [{ type: 'peak', f: j(r, 600, 820), q: 4, gain: 14 }, { type: 'peak', f: j(r, 1100, 1400), q: 5, gain: 11 }, { type: 'peak', f: 2700, q: 6, gain: 6 }, { type: 'lp', f: 3800 }] },
      { type: 'osc', wave: 'sine', freq: (t) => fq(t) * 2.01, dur: d, env, amp: 0.1 },
      { type: 'noise', color: 'pink', dur: d, env, amp: 0.45, filters: [{ type: 'bp', f: 900, q: 1.5 }], am: { f: 23, depth: 0.5 } }, // rasp
    ], fx: [{ type: 'echo', time: 0.42, fb: 0.35, mix: 0.3, lp: 1500 }, { type: 'echo', time: 0.71, fb: 0.2, mix: 0.2, lp: 900 }, { type: 'width', amt: 0.4 }] };
  } },
  breath: { variants: 1, sr: 24000, make: () => {
    const per = 1.6, n = 3;                  // inhale 0..0.45, exhale 0.55..1 of each cycle
    const inh = (t) => { const p = (t % per) / per; return p < 0.45 ? Math.pow(Math.sin(Math.PI * p / 0.45), 2) : 0; };
    const exh = (t) => { const p = (t % per) / per; return p > 0.52 ? Math.pow(Math.sin(Math.PI * (p - 0.52) / 0.48), 1.5) : 0; };
    return { dur: per * n, loop: 'wrap', tail: 0.05, peakDb: -6, layers: [
      { type: 'noise', color: 'pink', stereo: true, env: inh, amp: 0.55, filters: [{ type: 'bp', f: (t) => 1300 + 500 * inh(t), q: 2.2 }, { type: 'peak', f: 2600, q: 3, gain: 6 }] },
      { type: 'noise', color: 'pink', stereo: true, env: exh, amp: 1, filters: [{ type: 'bp', f: 620, q: 1.4 }, { type: 'peak', f: 1100, q: 4, gain: 8 }] },
      { type: 'osc', wave: 'saw', freq: (t) => 52 + 6 * Math.sin(TAU * t * 7), env: (t) => 0.15 + exh(t), amp: 0.3, filters: [{ type: 'lp', f: 260 }], am: { f: 18.75, depth: 0.6 }, drive: 2 }, // throat rumble
      { type: 'crackle', rate: 90, grain: 0.002, env: exh, amp: 0.25, filters: [{ type: 'bp', f: 1700, q: 2 }] },       // wet click of the jaw
    ] };
  } },
  sting: { variants: 1, sr: 24000, make: () => ({
    dur: 3, peakDb: -2,
    layers: [
      ...[46.25, 49, 69.3, 98, 103.8].map((f, i) => ({ type: 'osc', wave: 'saw', voices: 3, detune: 14, freq: f, dur: 2.6, env: { a: 0.006, h: 0.12, d: 2.2 }, amp: 0.4, pan: (i - 2) * 0.25,
        filters: [{ type: 'lp', f: { from: 4200, to: 380, time: 1.2 }, q: 1.6 }], drive: 1.6 })),
      { type: 'osc', wave: 'sine', freq: { from: 90, to: 32, time: 0.5 }, dur: 2.2, env: { a: 0.002, d: 1.6 }, amp: 1.2, drive: 1.5 },          // sub boom
      { type: 'noise', color: 'white', dur: 0.03, env: { a: 0.0003, d: 0.02 }, amp: 0.7, filters: [{ type: 'hp', f: 2000 }] },
      { type: 'partials', freq: 311, modes: [[1, 1, 1.6], [2.76, 0.7, 1.1], [5.4, 0.5, 0.7], [8.93, 0.3, 0.4]], inharm: 0.06, dur: 2.5, env: { a: 0.002, d: 1.5 }, amp: 0.25 },
      { type: 'noise', color: 'white', start: 0.05, dur: 1.6, env: { a: 0.05, d: 1.2 }, amp: 0.25, filters: [{ type: 'bp', f: { from: 5200, to: 1400, time: 1.4 }, q: 7 }] },   // scrape
    ],
    fx: [{ type: 'echo', time: 0.23, fb: 0.3, mix: 0.18, lp: 1800 }, { type: 'width', amt: 0.5 }],
  }) },
  heartbeat: { variants: 2, make: (r) => {
    const t2 = j(r, 0.17, 0.2);
    const thump = (s, a, f) => [
      { type: 'osc', wave: 'sine', freq: { from: f, to: f * 0.62, time: 0.09 }, start: s, dur: 0.24, env: { a: 0.006, d: 0.16 }, amp: a, drive: 1.3 },
      { type: 'noise', color: 'brown', start: s, dur: 0.18, env: { a: 0.004, d: 0.1 }, amp: a * 0.6, filters: [{ type: 'lp', f: 140 }] },
    ];
    return { dur: 0.7, peakDb: -5, layers: [...thump(0, 1, j(r, 58, 64)), ...thump(t2, 0.72, j(r, 50, 55))], fx: [{ type: 'lp', f: 400 }] };
  } },
  chirp: { variants: 1, make: () => ({
    dur: 0.9, peakDb: -8,
    layers: [
      { type: 'osc', wave: 'sine', freq: 1568, fm: { ratio: 2, index: { from: 1.6, to: 0.2, time: 0.08 } }, dur: 0.1, env: { a: 0.002, d: 0.12 }, amp: 0.8 },
      { type: 'osc', wave: 'sine', freq: 2093, fm: { ratio: 2, index: { from: 1.6, to: 0.2, time: 0.08 } }, start: 0.13, dur: 0.16, env: { a: 0.002, d: 0.18 }, amp: 0.8 },
      { type: 'noise', color: 'white', dur: 0.4, env: { a: 0.01, d: 0.3 }, amp: 0.08, filters: [{ type: 'bp', f: 2400, q: 0.7 }] },
    ],
    fx: [{ type: 'echo', time: 0.19, fb: 0.2, mix: 0.22, lp: 3000 }],
  }) },
  stinger_won: { variants: 1, sr: 24000, make: () => ({
    dur: 5, peakDb: -3,
    layers: [
      ...[43.65, 65.4, 110, 196].map((f, i) => ({ type: 'osc', wave: 'saw', voices: 2, detune: 9, freq: f * 2, start: i * 0.04, dur: 4.7, env: { a: 1.0, h: 1.3, d: 2.6 }, amp: 0.4, pan: (i % 3 - 1) * 0.4,
        filters: [{ type: 'lp', f: [[0, 300], [1.3, 2400], [4.7, 700]], q: 0.8 }] })),
      ...[523.25, 659.25, 783.99].map((f, i) => ({ type: 'partials', freq: f, start: 0.6 + i * 0.32, dur: 4, modes: [[1, 1, 3], [2.0, 0.4, 2], [3.01, 0.2, 1.2]], env: { a: 0.002, d: 3 }, amp: 0.18, pan: (i - 1) * 0.5 })),
    ],
    fx: [{ type: 'echo', time: 0.36, fb: 0.35, mix: 0.25, lp: 3500 }, { type: 'width', amt: 0.6 }],
  }) },
  stinger_lost: { variants: 1, sr: 24000, make: () => ({
    dur: 4.5, peakDb: -2,
    layers: [
      ...[36.7, 38.9, 55, 77.8].map((f, i) => ({ type: 'osc', wave: 'saw', voices: 3, detune: 22, freq: (t) => f * (1 - 0.06 * Math.min(1, t / 4)), dur: 4.2, env: { a: 0.01, h: 0.4, d: 3.3 }, amp: 0.45, pan: (i - 1.5) * 0.3,
        filters: [{ type: 'lp', f: { from: 3000, to: 200, time: 3.5 }, q: 2 }], drive: 2 })),
      { type: 'osc', wave: 'sine', freq: { from: 70, to: 26, time: 1.2 }, dur: 3, env: { a: 0.002, d: 2.4 }, amp: 1.1, drive: 1.4 },
      { type: 'osc', wave: 'saw', voices: 2, detune: 40, freq: (t) => 900 + 600 * Math.sin(TAU * t * 0.4) + 80 * Math.sin(TAU * t * 13), dur: 2.6, env: { a: 0.08, h: 0.4, d: 1.8 }, amp: 0.2,
        filters: [{ type: 'peak', f: 2300, q: 5, gain: 12 }, { type: 'hp', f: 600 }], drive: 3 },            // shriek
    ],
    fx: [{ type: 'echo', time: 0.31, fb: 0.4, mix: 0.25, lp: 1400 }, { type: 'width', amt: 0.5 }],
  }) },
};
