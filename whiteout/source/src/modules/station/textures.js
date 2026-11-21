// Station canvas textures + the few station-owned materials (all procedural, load-time only):
//   window atlas  4×2 tiles of lit/unlit module window interiors (blinds, curtains, shelves, a taped notice, dark
//                 rooms, a lit back door), frost creeping from every edge. Emissive map on the 'win' material.
//   lab frost     RGBA feathered frost for the lab's real glass (transparent, dusk-blue scatter, see-through centre).
//   screens       2×2 lab monitor tiles (waveform, seismograph, terminal, radar) for the 'screen' material.
// Materials get userData.noWeather (glass/screens never collect snow); main.js finalizeMaterials adds the fog.
import { CanvasTexture, SRGBColorSpace, MeshStandardMaterial, MeshBasicMaterial, AdditiveBlending, Color, DoubleSide, LinearMipmapLinearFilter } from 'three';

// tile i → uv rect [u0, v0, u1, v1] (canvas row 0 is the top = v 1 with flipY)
export const winUV = (i) => { const c = i % 4, r = Math.floor(i / 4); return [c / 4 + 0.004, 1 - (r + 1) / 2 + 0.008, (c + 1) / 4 - 0.004, 1 - r / 2 - 0.008]; };
export const WIN_LIT = [0.8, 1.0, 0.85, 0, 0.45, 1.0, 0.2, 1.1]; // glow pool gain per variant (0 = dark room)
export const screenUV = (i) => { const c = i % 2, r = Math.floor(i / 2); return [c / 2 + 0.01, 1 - (r + 1) / 2 + 0.02, (c + 1) / 2 - 0.01, 1 - r / 2 - 0.02]; };

function hashN(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hashN(xi, yi, s), b = hashN(xi + 1, yi, s), c = hashN(xi, yi + 1, s), d = hashN(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vnoise(x, y, s) * 0.5 + vnoise(x * 2.1, y * 2.1, s + 1) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 2) * 0.2;

function tex(cv, renderer) {
  const t = new CanvasTexture(cv); t.colorSpace = SRGBColorSpace; t.generateMipmaps = true; t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 4); return t;
}

// frost mask 0..1 at tile-local (u, v) in 0..1: feathered from the edges, crystal fronds
function frostAt(u, v, s, amt = 1) {
  const e = Math.min(u, v, 1 - u, 1 - v);
  const n = fbm(u * 9, v * 9, s), fr = fbm(u * 26 + n * 3, v * 26, s + 7);
  return Math.min(1, Math.max(0, (0.2 + 0.25 * n - e) * 5.5 * amt + (fr - 0.62) * 1.4 * (1 - Math.min(1, e * 5))));
}

export function windowAtlas(renderer) {
  const T = 128, D = 256, cv = document.createElement('canvas'); cv.width = T * 4; cv.height = T * 2; // drawn at 256, stored at 128
  const g = cv.getContext('2d', { willReadFrequently: true });
  for (let i = 0; i < 8; i++) {
    const ox = (i % 4) * T, oy = Math.floor(i / 4) * T;
    g.save(); g.translate(ox, oy); g.scale(T / D, T / D); g.beginPath(); g.rect(0, 0, D, D); g.clip();
    const lit = WIN_LIT[i] > 0.3;
    const grd = g.createRadialGradient(D * 0.45, D * 0.6, 10, D * 0.5, D * 0.5, D * 0.8);
    if (lit) { grd.addColorStop(0, '#ffd09a'); grd.addColorStop(0.5, '#e8964a'); grd.addColorStop(1, '#8a4a1c'); }
    else { grd.addColorStop(0, i === 6 ? '#2a1c12' : '#141a24'); grd.addColorStop(1, '#07090d'); }
    g.fillStyle = grd; g.fillRect(0, 0, D, D);
    if (i === 0 || i === 4) { // venetian blinds (half / fully drawn), light leaking between slats
      const end = i === 0 ? D * 0.46 : D;
      for (let y = 0; y < end; y += 11) { g.fillStyle = i === 4 ? '#c88850' : '#e0b080'; g.fillRect(0, y, D, 8); g.fillStyle = 'rgba(60,30,10,0.85)'; g.fillRect(0, y + 8, D, 3); }
      if (i === 0) { g.fillStyle = 'rgba(40,20,8,0.7)'; g.fillRect(D * 0.62, D * 0.5, 4, D * 0.5); }
    } else if (i === 1) { // curtains drawn to the sides
      for (const [x0, x1] of [[0, D * 0.3], [D * 0.74, D]]) for (let x = x0; x < x1; x += 6) { g.fillStyle = `rgba(${120 + (x % 18) * 3},40,22,0.92)`; g.fillRect(x, 0, 6, D); }
    } else if (i === 2) { // shelving silhouettes against a lit wall
      g.fillStyle = 'rgba(30,16,8,0.9)';
      for (const y of [0.3, 0.55, 0.8]) g.fillRect(D * 0.08, D * y, D * 0.6, 6);
      for (let b = 0; b < 14; b++) { const x = D * 0.1 + hashN(b, 1, 3) * D * 0.52, y = [0.3, 0.55, 0.8][b % 3] * D; const w = 8 + hashN(b, 2, 3) * 22, h = 18 + hashN(b, 3, 3) * 30; g.fillRect(x, y - h, w, h); }
    } else if (i === 5) { // taped notice + a figure-less chair back
      g.fillStyle = '#efe6cf'; g.save(); g.translate(D * 0.62, D * 0.3); g.rotate(0.06); g.fillRect(-28, -36, 56, 72);
      g.fillStyle = 'rgba(40,30,20,0.7)'; for (let l = 0; l < 6; l++) g.fillRect(-20, -26 + l * 10, 40 - (l % 3) * 8, 3);
      g.fillStyle = 'rgba(220,200,150,0.8)'; g.fillRect(-10, -42, 20, 9); g.restore();
      g.fillStyle = 'rgba(30,16,8,0.85)'; g.fillRect(D * 0.2, D * 0.62, D * 0.22, D * 0.38);
    } else if (i === 6) { // dark room, a lit doorway at the back
      g.fillStyle = '#1a120c'; g.fillRect(D * 0.52, D * 0.2, D * 0.24, D * 0.68); // door frame
      g.fillStyle = '#c8803c'; g.fillRect(D * 0.56, D * 0.24, D * 0.16, D * 0.64);
      g.fillStyle = 'rgba(30,18,10,0.9)'; g.fillRect(D * 0.6, D * 0.36, D * 0.05, D * 0.3); // coat hanging in the doorway
      g.beginPath(); g.moveTo(D * 0.56, D * 0.88); g.lineTo(D * 0.72, D * 0.88); g.lineTo(D * 0.95, D); g.lineTo(D * 0.3, D); g.closePath();
      g.fillStyle = 'rgba(200,128,60,0.35)'; g.fill(); // light thrown across the floor
      g.fillStyle = 'rgba(12,8,6,0.95)'; g.fillRect(D * 0.08, D * 0.55, D * 0.3, D * 0.06); g.fillRect(D * 0.1, D * 0.61, D * 0.03, D * 0.39); // desk
    } else if (i === 7) { // bright frosted (wash room)
      g.fillStyle = 'rgba(255,226,180,0.6)'; g.fillRect(0, 0, D, D);
    }
    g.restore();
  }
  // frost from the edges of every tile (lit tiles: frost glows warm-white; dark tiles: cold blue rime)
  const id = g.getImageData(0, 0, T * 4, T * 2), p = id.data;
  for (let y = 0; y < T * 2; y++) for (let x = 0; x < T * 4; x++) {
    const i = Math.floor(x / T) + 4 * Math.floor(y / T), u = (x % T) / T, v = (y % T) / T;
    const f = frostAt(u, v, 11 + i, i === 7 ? 2 : 1), o = (y * T * 4 + x) * 4, lit = WIN_LIT[i] > 0.3;
    const fr = lit ? [255, 214, 170] : [60, 74, 92];
    for (let c = 0; c < 3; c++) p[o + c] = p[o + c] * (1 - f * 0.8) + fr[c] * f * 0.8;
    const grain = (hashN(x, y, 5) - 0.5) * 10; for (let c = 0; c < 3; c++) p[o + c] = Math.max(0, Math.min(255, p[o + c] + grain));
  }
  g.putImageData(id, 0, 0);
  return tex(cv, renderer);
}

export function frostTexture(renderer) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true }), id = g.createImageData(S, S), p = id.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, f = frostAt(u, v, 41, 1.25), n = fbm(u * 40, v * 40, 43), o = (y * S + x) * 4;
    const a = 0.42 + 0.55 * f + (n - 0.5) * 0.12;
    const w = 200 + 55 * f;
    p[o] = w * 0.86; p[o + 1] = w * 0.92; p[o + 2] = w; p[o + 3] = Math.max(0, Math.min(255, a * 255));
  }
  g.putImageData(id, 0, 0);
  return tex(cv, renderer);
}

// window pane: clear centre with faint wiped smears, rime blooming from the corners and along the bottom rail
export function paneTexture(renderer) {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true }), id = g.createImageData(S, S), p = id.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, o = (y * S + x) * 4;
    const corner = Math.min(Math.hypot(u, v), Math.hypot(1 - u, v), Math.hypot(u, 1 - v), Math.hypot(1 - u, 1 - v));
    const n = fbm(u * 8, v * 8, 61), fr = fbm(u * 30 + n * 2, v * 30, 67);
    const rim = Math.max(0, 0.26 + 0.14 * n - corner) * 6 + Math.max(0, 0.07 + 0.06 * n - (1 - v)) * 8;
    const f = Math.min(1, rim * (0.6 + 0.6 * fr));
    const smear = 0.035 + 0.05 * Math.max(0, fbm(u * 3 + v * 2, v * 9, 71) - 0.45);
    const a = Math.min(1, smear + f * 0.85), w = 205 + 50 * f;
    p[o] = w * 0.9; p[o + 1] = w * 0.95; p[o + 2] = w; p[o + 3] = a * 255;
  }
  g.putImageData(id, 0, 0);
  return tex(cv, renderer);
}

export function screenAtlas(renderer) {
  const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true }), tw = W / 2, th = H / 2;
  const tiles = [
    (x0, y0) => { g.fillStyle = '#031208'; g.fillRect(x0, y0, tw, th); g.strokeStyle = 'rgba(40,120,60,0.5)'; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(x0 + i * tw / 8, y0); g.lineTo(x0 + i * tw / 8, y0 + th); g.stroke(); }
      g.strokeStyle = '#5cff8a'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x < tw; x++) { const y = th / 2 + Math.sin(x * 0.09) * 22 * Math.sin(x * 0.013) + (hashN(x, 1, 2) - 0.5) * 6; x ? g.lineTo(x0 + x, y0 + y) : g.moveTo(x0, y0 + y); } g.stroke(); },
    (x0, y0) => { g.fillStyle = '#140c02'; g.fillRect(x0, y0, tw, th); g.strokeStyle = '#ffb040'; g.lineWidth = 1.5;
      for (let r = 0; r < 4; r++) { g.beginPath(); for (let x = 0; x < tw; x++) { const k = hashN(x >> 2, r, 9), sp = r === 2 && x > 150 && x < 180 ? 14 : 2; const y = 18 + r * 30 + (k - 0.5) * sp * 2; x ? g.lineTo(x0 + x, y0 + y) : g.moveTo(x0, y0 + y); } g.stroke(); } },
    (x0, y0) => { g.fillStyle = '#02080c'; g.fillRect(x0, y0, tw, th); g.fillStyle = '#6ad8ff'; g.font = 'bold 11px monospace';
      const L = ['> CORE TEMP  -31.4', '> WIND 23.6 m/s  W', '> GEN A ... OFFLINE', '> GEN B ... OFFLINE', '> GEN C ... FAULT', '> BEACON  NO POWER', '> LINK LOST 17:42', '> _'];
      L.forEach((s, i) => g.fillText(s, x0 + 8, y0 + 16 + i * 14)); },
    (x0, y0) => { g.fillStyle = '#020a10'; g.fillRect(x0, y0, tw, th); const cx = x0 + tw / 2, cy = y0 + th / 2; g.strokeStyle = 'rgba(80,200,255,0.6)';
      for (let r = 15; r < 64; r += 16) { g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.stroke(); }
      const gr = g.createLinearGradient(cx, cy, cx + 60, cy - 30); gr.addColorStop(0, 'rgba(120,230,255,0.9)'); gr.addColorStop(1, 'rgba(120,230,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 62, -0.9, -0.3); g.fill(); g.fillStyle = '#ff5a4a'; g.fillRect(cx - 34, cy + 14, 4, 4); },
  ];
  tiles.forEach((fn, i) => fn((i % 2) * tw, Math.floor(i / 2) * th));
  const id = g.getImageData(0, 0, W, H), p = id.data; // scanlines
  for (let y = 0; y < H; y++) if (y % 3 === 0) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; p[o] *= 0.7; p[o + 1] *= 0.7; p[o + 2] *= 0.7; }
  g.putImageData(id, 0, 0);
  return tex(cv, renderer);
}

// soft radial falloff (elongated along the tube) for the ceiling bounce card
function glowTexture(renderer) {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true }), id = g.createImageData(S, S), p = id.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S * 2 - 1, v = (y + 0.5) / S * 2 - 1, r = Math.hypot(u * 0.8, v);
    const a = Math.max(0, 1 - r) ** 2.2, o = (y * S + x) * 4, w = Math.round(255 * a);
    p[o] = w; p[o + 1] = w; p[o + 2] = w; p[o + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  return tex(cv, renderer);
}

/** station-owned materials: window interiors, lab frost glass, monitor screens, fluorescent diffuser */
export function stationMaterials(G) {
  const win = new MeshStandardMaterial({ color: new Color(0x0c0d10), roughness: 0.18, metalness: 0, emissive: new Color(1, 0.9, 0.82), emissiveIntensity: 2.4 });
  win.emissiveMap = windowAtlas(G.renderer); win.name = 'station-win';
  const frost = new MeshStandardMaterial({ color: new Color(0xd8e4ee), roughness: 0.32, metalness: 0, transparent: true, depthWrite: false, side: DoubleSide,
    emissive: new Color(0.16, 0.26, 0.46), emissiveIntensity: 1.1 });
  const ft = frostTexture(G.renderer); frost.map = ft; frost.emissiveMap = ft; frost.name = 'station-frost';
  const screen = new MeshStandardMaterial({ color: new Color(0x050607), roughness: 0.12, metalness: 0, emissive: new Color(1, 1, 1), emissiveIntensity: 1.3 });
  screen.emissiveMap = screenAtlas(G.renderer); screen.name = 'station-screen';
  const diffuser = new MeshStandardMaterial({ color: new Color(0x9aa0a8), roughness: 0.4, emissive: new Color(0.86, 0.92, 1.0), emissiveIntensity: 2.2 });
  diffuser.name = 'station-diffuser';
  const pane = new MeshStandardMaterial({ color: new Color(0xdfe6ee), roughness: 0.07, metalness: 0.0, transparent: true, depthWrite: false, envMapIntensity: 2.4 });
  const pt = paneTexture(G.renderer); pane.map = pt; pane.name = 'station-pane';
  // painted plastic / vehicle enamel (snowcat, skidoo cowl): smoother than the module paint, still vertex-tinted
  const gloss = new MeshStandardMaterial({ color: new Color(0xffffff), roughness: 0.34, metalness: 0, vertexColors: true, envMapIntensity: 1.3 });
  gloss.name = 'station-gloss';
  // dark tinted vehicle glazing: near-black body, mirror-smooth, reads by the sky reflection
  const tint = new MeshStandardMaterial({ color: new Color(0x0a0d11), roughness: 0.05, metalness: 0.1, envMapIntensity: 2.2 });
  tint.name = 'station-tint';
  // fake bounce on the lab ceiling above the working tube: additive radial glow (the probe capture sees it too)
  const glow = new MeshBasicMaterial({ map: glowTexture(G.renderer), color: new Color(0.95, 1.02, 1.12), transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: true });
  glow.name = 'station-ceilglow';
  for (const m of [win, frost, screen, diffuser, pane, tint, glow]) { m.userData.noWeather = true; }
  return { win, frost, screen, diffuser, pane, gloss, tint, glow };
}
