// Station signage + ground decals through decals/canvas-text.js: stencilled module names (wind-distressed), GEN A/B/C,
// hazard placards (high voltage, diesel, no smoking), shed bay stencil, lab interior notices + whiteboard, and dirty /
// trampled snow patches (custom canvases) draped on the snow at every door, the shed apron and along the beaten paths.
// All exterior decals merge into ONE mesh (one draw call); the lab's into a second one inside the probe-lit group.
import { Mesh, Matrix4, Vector3, Quaternion, Euler, PlaneGeometry } from 'three';
import { DecalAtlas, stencilCanvas, signCanvas, decalGeo, decalMaterial, distress } from '../../cookbook/decals/canvas-text.js';
import { mergeGeos, normalizeGeo } from '../../cookbook/geo/kit.js';
import { gy } from './parts.js';
import { addLabels } from './lablabels.js';

function slushCanvas(seed, { trail = false } = {}) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true });
  let s = seed * 9301 + 49297; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  // soft overlapping smears of grey-brown slush, denser in the middle
  for (let i = 0; i < 34; i++) {
    const a = r() * 6.283, rad = Math.pow(r(), 0.7) * S * (trail ? 0.22 : 0.33);
    const x = S / 2 + Math.cos(a) * rad * (trail ? 0.45 : 1), y = S / 2 + Math.sin(a) * rad * (trail ? 1.9 : 1), w = 10 + r() * 35;
    const gr = g.createRadialGradient(x, y, 0, x, y, w);
    const c = r() < 0.45 ? '118,110,100' : '128,138,152';
    gr.addColorStop(0, `rgba(${c},${0.07 + r() * 0.1})`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, w, w * (0.5 + r() * 0.5), r() * 3, 0, 6.283); g.fill();
  }
  // boot prints: paired ovals with tread bars, walking both ways
  for (let i = 0; i < (trail ? 26 : 16); i++) {
    const t = r(), x = S / 2 + (r() - 0.5) * S * (trail ? 0.22 : 0.5) + (i % 2 ? 7 : -7), y = trail ? 10 + t * (S - 20) : S / 2 + (r() - 0.5) * S * 0.5;
    g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.5 + (r() < 0.5 ? 0 : Math.PI));
    g.fillStyle = 'rgba(80,92,112,0.16)'; g.beginPath(); g.ellipse(0, 0, 4, 8.5, 0, 0, 6.283); g.fill();
    g.fillStyle = 'rgba(60,68,84,0.12)'; for (let q = -3; q <= 3; q++) g.fillRect(-3, q * 2.3 - 0.5, 6, 0.9);
    g.restore();
  }
  distress(cv, { amount: 0.35, seed, edge: 0.0, chips: 0.6, scratches: 0, specks: 1.2 });
  return cv;
}

function whiteboard() {
  const W = 480, H = 288, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#eef0ee'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(30,60,140,0.85)'; g.lineWidth = 2; g.font = 'bold 22px sans-serif'; g.fillStyle = 'rgba(30,60,140,0.9)';
  g.fillText('CORE LOG  —  SITE 4', 16, 32);
  g.font = '16px sans-serif';
  ['BH-2  112.4 m  DONE', 'BH-3  64.0 m   ABORTED?', 'GEN C  FAULT  (ask R.)', 'RADIO SKED 1800 / 0600', 'DO NOT GO OUT ALONE'].forEach((t, i) => g.fillText(t, 20, 70 + i * 30));
  g.strokeStyle = 'rgba(160,30,30,0.85)'; g.beginPath(); g.ellipse(330, 220, 90, 28, -0.05, 0, 6.283); g.stroke();
  g.beginPath(); g.moveTo(300, 70); for (let x = 300; x < 460; x += 8) g.lineTo(x, 110 - Math.abs(Math.sin(x * 0.07)) * 30 - (x > 400 ? 20 : 0)); g.stroke();
  g.fillStyle = 'rgba(120,120,120,0.12)'; for (let i = 0; i < 6; i++) g.fillRect(40 + i * 70, 150 + (i % 3) * 30, 60, 8); // ghosted erasures
  return cv;
}

export function buildSigns(G, { modules }) {
  const atlas = new DecalAtlas(2048);
  const wear = (t) => ({ wear: 0.56, overspray: 0.55, seed: t.length * 7 }); // blizzard-blasted: broken bridges, faded fill
  for (const m of modules) {
    const cv = stencilCanvas({ text: m.name, h: 0.34, ppm: 300, color: m.id === 'store' ? 'rgba(30,32,34,0.92)' : 'rgba(236,232,222,0.95)', ...wear(m.name) });
    distress(cv, { amount: 0.22, seed: m.name.length * 13, edge: 0.1, chips: 1.0, scratches: 1.0, specks: 1.2 }); atlas.add(m.id, cv);
  }
  atlas.add('exitOut', signCanvas({ ppm: 256, w: 0.5, h: 0.2, bg: '#1f7a3a', fg: '#e8f4ea', border: '#1f7a3a', lines: [{ text: 'FIRE EXIT', size: 0.55 }], wear: 0.5, dirt: 0.4 }));
  for (const id of ['A', 'B', 'C']) atlas.add('gen' + id, stencilCanvas({ text: 'GEN ' + id, h: 0.3, ppm: 300, color: 'rgba(250,200,60,1)', wear: 0.4 }));
  atlas.add('shed', stencilCanvas({ text: 'VEHICLE BAY 1', h: 0.26, ppm: 300, color: 'rgba(30,32,34,1)', wear: 0.5 }));
  atlas.add('radio', signCanvas({ ppm: 256, w: 1.0, h: 0.5, lines: [{ text: 'RADIO / BEACON' }, { text: 'AUTHORISED PERSONNEL', size: 0.16 }], wear: 0.5 }));
  atlas.add('hv', signCanvas({ ppm: 256, w: 0.4, h: 0.3, bg: '#e8b41c', lines: [{ text: 'DANGER', size: 0.3 }, { text: '400 V', size: 0.26 }], wear: 0.55 }));
  atlas.add('diesel', signCanvas({ ppm: 256, w: 0.9, h: 0.45, stripes: true, lines: [{ text: 'DIESEL AN-8' }, { text: 'FLAMMABLE  25 000 L', size: 0.15, color: '#9a1e14' }], wear: 0.6 }));
  atlas.add('nosmoke', signCanvas({ ppm: 256, w: 0.5, h: 0.32, bg: '#e9e4d6', fg: '#a01a12', border: '#a01a12', lines: [{ text: 'NO SMOKING', size: 0.24 }, { text: 'NO NAKED FLAME', size: 0.14 }], wear: 0.45 }));
  atlas.add('exit', signCanvas({ ppm: 256, w: 0.42, h: 0.16, bg: '#1f7a3a', fg: '#e8f4ea', border: '#1f7a3a', lines: [{ text: 'EXIT  ►', size: 0.6 }], wear: 0.2, dirt: 0.15 }));
  atlas.add('labsign', signCanvas({ ppm: 256, w: 0.9, h: 0.42, lines: [{ text: 'LAB-2' }, { text: 'GLACIOLOGY / CORE PROCESSING', size: 0.13 }], wear: 0.3, dirt: 0.2 }));
  atlas.add('protocol', signCanvas({ ppm: 256, w: 0.42, h: 0.6, bg: '#f0ecd8', lines: [{ text: 'COLD ROOM', size: 0.09 }, { text: 'PROTOCOL', size: 0.09 }, { text: '— gloves on —', size: 0.06 }, { text: '— log every core —', size: 0.06 }, { text: '— close freezer —', size: 0.06 }], wear: 0.3, dirt: 0.25 }));
  atlas.add('m80', signCanvas({ ppm: 256, w: 0.3, h: 0.12, bg: '#2a4a8a', fg: '#e8eef8', border: '#e8eef8', lines: [{ text: '-80 °C', size: 0.6 }], wear: 0.2 }));
  atlas.add('wb', whiteboard());
  atlas.add('slush0', slushCanvas(3)); atlas.add('slush1', slushCanvas(8)); atlas.add('trail', slushCanvas(5, { trail: true }));
  addLabels(atlas);
  atlas.finish(G.renderer);

  const outGeos = [], inGeos = [];
  const m4 = new Matrix4(), q = new Quaternion(), e = new Euler(), v = new Vector3(), one = new Vector3(1, 1, 1);
  /** wall decal: plane facing local +Z rotated by ry about Y, placed at `at` */
  const wall = (name, w, at, ry, inside = false, h = null) => {
    const g = normalizeGeo(decalGeo(atlas, name, w, h));
    m4.compose(v.fromArray(at), q.setFromEuler(e.set(0, ry, 0)), one); g.applyMatrix4(m4);
    (inside ? inGeos : outGeos).push(g);
  };
  /** ground decal draped on the snow (8×8 grid), rotated ry */
  const ground = (name, w, h, x, z, ry) => {
    const r = atlas.uv(name), g = new PlaneGeometry(w, h, 8, 8), uv = g.attributes.uv.array, p = g.attributes.position.array;
    for (let i = 0; i < uv.length; i += 2) { uv[i] = r.u0 + uv[i] * (r.u1 - r.u0); uv[i + 1] = r.v0 + uv[i + 1] * (r.v1 - r.v0); }
    const c = Math.cos(ry), s = Math.sin(ry);
    for (let i = 0; i < p.length; i += 3) {
      const lx = p[i], lz = -p[i + 1], wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
      p[i] = wx; p[i + 1] = Math.max(0.0, gy(wx, wz)) + 0.03; p[i + 2] = wz;
    }
    const n = g.attributes.normal.array; for (let i = 0; i < n.length; i += 3) { n[i] = 0; n[i + 1] = 1; n[i + 2] = 0; }
    outGeos.push(normalizeGeo(g));
  };
  function build(root, labGroup) {
    const mk = (geos, key) => {
      if (!geos.length) return null;
      const mat = decalMaterial(atlas.texture, { key, roughness: 0.75 }); mat.userData.noWeather = true;
      const mesh = new Mesh(mergeGeos(geos), mat); mesh.renderOrder = 2; mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'decals:' + key;
      mesh.matrixAutoUpdate = false; return mesh;
    };
    const a = mk(outGeos, 'station'), b = mk(inGeos, 'lab');
    if (a) root.add(a); if (b) labGroup.add(b);
  }
  return { atlas, wall, ground, build };
}
