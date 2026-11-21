// Small label canvases for signs.js (decals/canvas-text.js): lab asset tags (barcode stickers), hazard stickers
// (biohazard-yellow, LN2 cryogenic, hot surface), handwritten sticky notes, rubber kick scuffs for the wall feet;
// lean-to cabinet placards (hazard triangle, DB-A/B/C stencils) and the snowcat fleet number.
import { stencilCanvas, distress } from '../../cookbook/decals/canvas-text.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; };
function rng(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

function assetTag(seed) {
  const cv = mk(160, 80), g = cv.getContext('2d'), r = rng(seed);
  g.fillStyle = ['#d8dcdc', '#e8e2c8', '#c8d4dc'][seed % 3]; g.fillRect(0, 0, 160, 80);
  g.fillStyle = '#1a1c20'; g.font = 'bold 15px monospace'; g.fillText('BAS-' + (4000 + Math.floor(r() * 5999)), 8, 20);
  for (let x = 8; x < 152;) { const w = 1 + Math.floor(r() * 3); g.fillRect(x, 28, w, 34); x += w + 1 + Math.floor(r() * 3); }
  g.font = '10px monospace'; g.fillText('PROPERTY OF BAS', 8, 75);
  distress(cv, { amount: 0.25, seed, edge: 0.3, chips: 0.6, scratches: 0.4, specks: 0.8 });
  return cv;
}
function hazard(kind) {
  const cv = mk(160, 160), g = cv.getContext('2d');
  g.translate(80, 86);
  g.fillStyle = kind === 1 ? '#1d4fa8' : '#e8b41c'; g.strokeStyle = '#141414'; g.lineWidth = 9;
  g.beginPath(); g.moveTo(0, -70); g.lineTo(72, 56); g.lineTo(-72, 56); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = kind === 1 ? '#f0f4fa' : '#141414'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center';
  g.fillText(['☣', 'LN2', '!'][kind], 0, 40);
  if (kind === 1) { g.font = 'bold 13px sans-serif'; g.fillText('CRYOGENIC', 0, 52); }
  distress(cv, { amount: 0.22, seed: 31 + kind, edge: 0.3, chips: 0.5, scratches: 0.5, specks: 0.6 });
  return cv;
}
function note(seed) {
  const cv = mk(128, 128), g = cv.getContext('2d'), r = rng(seed + 3);
  g.fillStyle = ['#f2e07a', '#f4b8c8', '#bfe3f0'][seed % 3]; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 0, 128, 18);
  g.strokeStyle = 'rgba(20,30,90,0.85)'; g.lineWidth = 2.2; g.lineCap = 'round';
  const words = [['DO NOT', 'UNPLUG!'], ['BH-3 core', 'in -80 →', 'shelf 2'], ['call base', '1800 sked']][seed % 3];
  g.font = 'italic 19px cursive, sans-serif'; g.fillStyle = 'rgba(20,30,90,0.9)';
  words.forEach((w, i) => { g.save(); g.translate(10, 44 + i * 28); g.rotate((r() - 0.5) * 0.08); g.fillText(w, 0, 0); g.restore(); });
  g.beginPath(); g.moveTo(14, 112); g.lineTo(96 + r() * 20, 108); g.stroke();
  return cv;
}
function kick(seed) {
  const W = 512, H = 80, cv = mk(W, H), g = cv.getContext('2d'), r = rng(seed + 11);
  for (let i = 0; i < 46; i++) {
    const x = r() * W, y = H * (0.35 + r() * 0.6), l = 10 + r() * 60, a = (r() - 0.5) * 0.5;
    g.strokeStyle = `rgba(20,20,22,${0.08 + r() * 0.22})`; g.lineWidth = 1 + r() * 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.3); g.stroke();
  }
  const gr = g.createLinearGradient(0, H, 0, 0); gr.addColorStop(0, 'rgba(40,36,30,0.28)'); gr.addColorStop(0.6, 'rgba(40,36,30,0.06)'); gr.addColorStop(1, 'rgba(40,36,30,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  return cv;
}

/** register every small label on the signs atlas */
export function addLabels(atlas) {
  for (let i = 0; i < 3; i++) { atlas.add('tag' + i, assetTag(i + 1)); atlas.add('haz' + i, hazard(i)); atlas.add('note' + i, note(i)); }
  for (let i = 0; i < 2; i++) atlas.add('kick' + i, kick(i));
  atlas.add('hvs', hazard(2));
  for (const id of ['A', 'B', 'C']) atlas.add('db' + id, stencilCanvas({ text: 'DB-' + id + ' 400V', h: 0.05, ppm: 500, color: 'rgba(24,24,26,1)', wear: 0.35 }));
  atlas.add('cat', stencilCanvas({ text: 'SC-02', h: 0.16, ppm: 360, color: 'rgba(236,232,222,0.95)', wear: 0.5, overspray: 0.4 }));
}
