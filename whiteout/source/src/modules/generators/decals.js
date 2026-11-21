// Generator + tower decals (decals/canvas-text.js, one 2048² atlas, ONE merged mesh for all three skids + the tower):
//   GEN A/B/C stencils on the frame rails, panel header plates, frosted gauge dials (oil / temp / volts·Hz), hour
//   meter, toggle legend, E-stop ring, CRANK quadrant label, alternator data plate, DANGER 400 V, HOT SURFACE,
//   DIESEL ONLY, a feathered frost bloom over each panel door, soot under unit C's exhaust and a FAULT tag on C.
// Dials carry their own frost (rime creeping in from the bezel, crystal fronds over the glass): "frost on the
// panel glass" is painted into the face so it costs nothing at runtime.
import { DecalAtlas, stencilCanvas, signCanvas, labelCanvas, decalGeo, decalMaterial, distress, grime, FONTS } from '../../cookbook/decals/canvas-text.js';
import { fbm2, vnoise2 } from '../../cookbook/geo/noise.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// frost mask in 0..1 at distance-from-edge e (0 = edge … 0.5 = centre): a dense rime band hugging the edge with a
// noisy front, feathery crystal fronds (ridged noise veins) growing inward from it, clear centre
function frost(u, v, e, seed, amt, dustK = 1) {
  const n = fbm2(u * 9 + seed, v * 9, 4, seed);
  const band = cl(((0.05 + 0.09 * n) * amt - e) * 22);
  const rd = 1 - Math.abs(2 * fbm2(u * 26 + n * 3, v * 26 - n * 3, 3, seed + 3) - 1);
  const fronds = Math.pow(rd, 7) * cl(1 - e / (0.2 * amt)) * 1.3;
  const dust = fbm2(u * 60, v * 60, 2, seed + 9) * 0.25 * dustK * cl(1 - e / (0.3 * amt));
  return cl(Math.max(band, fronds) + dust * (1 - band));
}
// top = rime hangs from the TOP edge (door under the rain hood: drips refreeze along the lip and in the hinge /
// latch recesses at the sides), thin at the bottom, no speckle over the open face
function frostPaint(cv, seed, amt, round, top = false) {
  const g = cv.getContext('2d', { willReadFrequently: true }), W = cv.width, H = cv.height, id = g.getImageData(0, 0, W, H), p = id.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, o = (y * W + x) * 4;
    // rectangles: rime builds thickest along the bottom edge and in the corners (meltwater refreezes there)
    const du = Math.min(u, 1 - u) * (top ? 1.0 + 1.6 * v : 1), dv = top ? Math.min(v * 0.5, (1 - v) * 2.6) : Math.min(v * 1.5, (1 - v) * 0.7);
    const e = round ? 0.5 - Math.hypot(u - 0.5, v - 0.5) : Math.min(du, dv, Math.hypot(du, dv) * 0.6);
    if (round && e < 0) continue;
    // icicle-like drip runs hanging under the top band
    const drip = top ? cl((0.5 + 0.5 * Math.sin(u * 61 + 3 * fbm2(u * 7, seed, 2, seed))) ** 9 * (1 - v * 3.2)) * 0.6 : 0;
    const f = Math.max(frost(u, v, e, seed, amt, top ? 0.15 : 1), drip) * 0.88, a = p[o + 3] / 255;
    // rime: blue-white, slightly translucent; over the face it lightens and desaturates
    const r = 214, gg = 226, b = 238;
    p[o] = p[o] * (1 - f) + r * f; p[o + 1] = p[o + 1] * (1 - f) + gg * f; p[o + 2] = p[o + 2] * (1 - f) + b * f;
    p[o + 3] = Math.round(255 * cl(a + f * (1 - a)));
  }
  g.putImageData(id, 0, 0);
}

/** round gauge face: kind 0 oil (bar), 1 coolant (°C), 2 volts/Hz; needle at rest (engine off) */
function dialCanvas(kind, seed, frostAmt) {
  const S = 160, cv = mk(S, S), g = cv.getContext("2d", { willReadFrequently: true }), c = S / 2, R = S * 0.47;
  g.fillStyle = kind === 2 ? '#e9e6dc' : '#121315'; g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.fill();
  const ink = kind === 2 ? '#141414' : '#e8e4d8';
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, ticks = 40;
  // coloured arcs
  const arc = (f0, f1, col, w) => { g.strokeStyle = col; g.lineWidth = w * S / 256; g.beginPath(); g.arc(c, c, R * 0.8, a0 + (a1 - a0) * f0, a0 + (a1 - a0) * f1); g.stroke(); };
  if (kind === 0) { arc(0, 0.15, '#b8261a', 10); arc(0.3, 0.8, '#2f8a3a', 6); }
  if (kind === 1) { arc(0.2, 0.75, '#2f8a3a', 6); arc(0.85, 1, '#b8261a', 10); }
  if (kind === 2) { arc(0.55, 0.7, '#2f8a3a', 8); }
  g.strokeStyle = ink; g.lineCap = 'butt';
  for (let i = 0; i <= ticks; i++) {
    const a = a0 + (a1 - a0) * (i / ticks), big = i % 5 === 0, r0 = R * (big ? 0.68 : 0.74), r1 = R * 0.86;
    g.lineWidth = (big ? 3.4 : 1.6) * S / 256; g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.stroke();
  }
  const labels = [['0', '2', '4', '6', '8', '10', '12', '14', '16'], ['40', '60', '80', '100', '120', '140', '160', '180', '200'], ['0', '100', '200', '300', '400', '500', '600', '', '']][kind];
  g.fillStyle = ink; g.font = `bold ${S * 0.075}px ${FONTS.sign}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 9; i++) { if (!labels[i]) continue; const a = a0 + (a1 - a0) * (i / 8); g.fillText(labels[i], c + Math.cos(a) * R * 0.53, c + Math.sin(a) * R * 0.53); }
  g.font = `bold ${S * 0.07}px ${FONTS.sign}`;
  g.fillText(['OIL  bar', 'WATER °C', 'VOLTS'][kind], c, c + R * 0.38);
  g.font = `${S * 0.045}px ${FONTS.sign}`; g.fillText('VDO', c, c - R * 0.3);
  // needle at rest (off) + hub
  const na = a0 + (a1 - a0) * (kind === 1 ? 0.04 : 0.01) + (seed % 3) * 0.02;
  g.strokeStyle = '#d8401c'; g.lineWidth = 5 * S / 256; g.lineCap = 'round'; g.beginPath(); g.moveTo(c - Math.cos(na) * R * 0.15, c - Math.sin(na) * R * 0.15); g.lineTo(c + Math.cos(na) * R * 0.78, c + Math.sin(na) * R * 0.78); g.stroke();
  g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(c, c, R * 0.09, 0, Math.PI * 2); g.fill();
  // glass: soft highlight crescent, grime ring at the bezel
  const hl = g.createLinearGradient(0, 0, S, S); hl.addColorStop(0, 'rgba(255,255,255,0.20)'); hl.addColorStop(0.45, 'rgba(255,255,255,0.0)');
  g.fillStyle = hl; g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.fill();
  const rg = g.createRadialGradient(c, c, R * 0.7, c, c, R); rg.addColorStop(0, 'rgba(30,26,20,0)'); rg.addColorStop(1, 'rgba(30,26,20,0.45)');
  g.fillStyle = rg; g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.fill();
  frostPaint(cv, seed, frostAmt, true);
  return cv;
}

function hourMeter(seed) {
  const cv = mk(256, 96), g = cv.getContext('2d');
  g.fillStyle = '#101112'; g.fillRect(0, 0, 256, 96);
  const digits = String(10000 + ((seed * 7919) % 89999)).slice(1) + '.' + (seed % 10);
  g.font = `bold 52px ${FONTS.mono}`; g.textBaseline = 'middle';
  for (let i = 0; i < digits.length; i++) {
    const x = 16 + i * 38; if (digits[i] !== '.') { g.fillStyle = i === digits.length - 1 ? '#c8c2b0' : '#1c1d1f'; g.fillRect(x - 2, 14, 34, 66); }
    g.fillStyle = i === digits.length - 1 ? '#1c1d1f' : '#e6e2d6'; g.fillText(digits[i], x + 3, 50);
  }
  g.font = `bold 14px ${FONTS.sign}`; g.fillStyle = '#9a968c'; g.fillText('HOURS', 200, 86);
  frostPaint(cv, seed + 5, 0.55, false);
  return cv;
}

function softBlot(seed, { col = '24,22,20', n = 40, w = 256, h = 256, streak = false } = {}) {
  const cv = mk(w, h), g = cv.getContext('2d');
  let s = seed * 9301 + 49297; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    const x = w * (0.5 + (r() - 0.5) * 0.6), y = streak ? h * (0.1 + r() * 0.85) : h * (0.5 + (r() - 0.5) * 0.6);
    const rad = (streak ? 0.08 + 0.12 * (1 - y / h) : 0.12 + r() * 0.2) * w;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${col},${0.08 + r() * 0.12})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rad * (streak ? 0.6 : 1), rad, 0, 0, Math.PI * 2); g.fill();
  }
  distress(cv, { amount: 0.25, seed, edge: 0, chips: 0.4, scratches: 0, specks: 1 });
  return cv;
}

function frostSheet(seed, w = 320, h = 240) {
  const cv = mk(w, h); frostPaint(cv, seed, 1.0, false, true);
  // keep only the rime (clear centre): alpha already from frost mask, colour set by frostPaint over transparent black
  return cv;
}

function toggleLegend() {
  const cv = mk(640, 64), g = cv.getContext('2d');
  g.font = `bold 34px ${FONTS.sign}`; g.fillStyle = 'rgba(30,30,32,0.95)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  ['FUEL', 'GLOW', 'PUMP', 'LAMP'].forEach((t, i) => g.fillText(t, 80 + i * 160, 34));
  distress(cv, { amount: 0.3, seed: 41, edge: 0.1 });
  return cv;
}

function estopRing() {
  const S = 256, cv = mk(S, S), g = cv.getContext('2d'), c = S / 2;
  g.fillStyle = '#e8b41c'; g.beginPath(); g.arc(c, c, c - 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#16181a'; g.font = `bold 26px ${FONTS.sign}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const txt = 'EMERGENCY  STOP  ·  ';
  for (let i = 0; i < txt.length * 2; i++) { const a = (i / (txt.length * 2)) * Math.PI * 2 - Math.PI / 2; g.save(); g.translate(c + Math.cos(a) * (c - 24), c + Math.sin(a) * (c - 24)); g.rotate(a + Math.PI / 2); g.fillText(txt[i % txt.length], 0, 0); g.restore(); }
  grime(cv, { amount: 0.35, seed: 7 }); distress(cv, { amount: 0.3, seed: 7, edge: 0.4 });
  return cv;
}

function faultTag() {
  const cv = mk(160, 300), g = cv.getContext('2d');
  g.fillStyle = '#d8c89a'; g.beginPath(); g.roundRect(4, 4, 152, 292, 10); g.fill();
  g.fillStyle = '#b02218'; g.fillRect(4, 40, 152, 60);
  g.fillStyle = '#f0e8d0'; g.font = `bold 46px ${FONTS.sign}`; g.textAlign = 'center'; g.fillText('FAULT', 80, 86);
  g.fillStyle = '#2a2420'; g.font = `bold 22px ${FONTS.sign}`; ['DO NOT', 'RUN', '', 'ARCING AT', 'EXCITER', '— R.'].forEach((t, i) => g.fillText(t, 80, 140 + i * 26));
  g.fillStyle = '#6a6458'; g.beginPath(); g.arc(80, 22, 9, 0, Math.PI * 2); g.fill();
  grime(cv, { amount: 0.55, seed: 3 }); distress(cv, { amount: 0.25, seed: 3, edge: 0.5 });
  return cv;
}

export function buildDecals(G) {
  const atlas = new DecalAtlas(2048);
  for (const id of ['A', 'B', 'C']) {
    atlas.add('gen' + id, stencilCanvas({ text: 'GEN ' + id, h: 0.15, ppm: 520, color: 'rgba(236,200,70,0.95)', wear: id === 'C' ? 0.55 : 0.38, overspray: 0.45 }));
    atlas.add('plate' + id, signCanvas({ w: 0.42, h: 0.075, ppm: 900, bg: '#1d1f22', fg: '#e8e2d2', border: '#8a8478', borderW: 0.004,
      lines: [{ text: `GEN ${id}  ·  60 kVA  ·  400 V`, size: 0.62 }], rivets: false, wear: 0.3, dirt: 0.3, radius: 0.006 }));
    atlas.add('hours' + id, hourMeter(id.charCodeAt(0)));
    for (let k = 0; k < 3; k++) atlas.add(`dial${id}${k}`, dialCanvas(k, id.charCodeAt(0) * 3 + k, id === 'B' ? 0.7 : id === 'C' ? 1.15 : 0.95));
  }
  ['OIL', 'COOLANT', 'VOLTS'].forEach((t, k) => atlas.add('glabel' + k, signCanvas({ w: 0.08, h: 0.02, ppm: 2400, bg: '#1a1b1d', fg: '#d8d2c2', border: '#6a665e', borderW: 0.0015,
    lines: [{ text: t, size: 0.62 }], rivets: false, wear: 0.35, dirt: 0.35, radius: 0.002 })));
  atlas.add('legend', toggleLegend());
  atlas.add('estop', estopRing());
  atlas.add('crank', signCanvas({ w: 0.2, h: 0.07, ppm: 900, bg: '#e8b41c', fg: '#16181a', border: '#16181a', borderW: 0.004, lines: [{ text: 'PULL ▲ CRANK', size: 0.6 }], rivets: false, wear: 0.45, dirt: 0.4, radius: 0.004 }));
  atlas.add('data', labelCanvas({ rows: [['MODEL', 'KDG-60'], ['kVA', '60 / 48 kW'], ['V', '400 / 230'], ['Hz · RPM', '50 · 1500'], ['IP', '23']], w: 0.2, ppm: 1400, color: 'rgba(30,30,30,0.95)', plate: '#b8b6ae', wear: 0.25 }));
  atlas.add('hv', signCanvas({ w: 0.16, h: 0.11, ppm: 1000, bg: '#e8b41c', lines: [{ text: 'DANGER', size: 0.32 }, { text: '400 V', size: 0.28 }], wear: 0.45, dirt: 0.4, radius: 0.006, borderW: 0.004 }));
  atlas.add('hot', signCanvas({ w: 0.18, h: 0.07, ppm: 1000, bg: '#e8b41c', lines: [{ text: 'HOT SURFACE', size: 0.55 }], rivets: false, wear: 0.5, dirt: 0.55, radius: 0.004, borderW: 0.004 }));
  atlas.add('diesel', stencilCanvas({ text: 'DIESEL ONLY', h: 0.035, ppm: 1600, color: 'rgba(230,226,214,0.95)', wear: 0.35, overspray: 0.3 }));
  atlas.add('frost0', frostSheet(11)); atlas.add('frost1', frostSheet(23)); atlas.add('frost2', frostSheet(37));
  atlas.add('soot', softBlot(5, { streak: true, n: 60, w: 192, h: 384 }));
  atlas.add('scorch', softBlot(9, { n: 50, col: '18,16,14' }));
  atlas.add('tag', faultTag());
  atlas.add('tower', signCanvas({ w: 0.6, h: 0.4, ppm: 500, bg: '#e9e4d6', lines: [{ text: 'DANGER', size: 0.24, color: '#b8261a' }, { text: 'NO CLIMBING', size: 0.2 }, { text: 'WITHOUT HARNESS', size: 0.14 }], wear: 0.5, dirt: 0.45, stripes: true }));
  atlas.finish(G.renderer);
  const mat = decalMaterial(atlas.texture, { key: 'generators', roughness: 0.55 });
  mat.userData.noWeather = true;
  // decal plane facing +Z, w wide (h from the entry aspect unless given)
  const geo = (name, w, h = null) => decalGeo(atlas, name, w, h);
  return { atlas, mat, geo };
}
