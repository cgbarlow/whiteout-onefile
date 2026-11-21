// Faint distant silhouettes past the berm (r1 D11): two far antenna clusters and a distant hut with a warm window,
// standing on the horizon skirt 140-230 m out, dissolved by the SAME atmos fog as everything else (finalizeMaterials
// patches both materials: the masts get fog + weathering, the additive glows get transmittance only). They give the
// whiteout a "something is out there" horizon in pose 1 without ever reading as a second station.
//   masts  — bevelled tapered lattice-like shafts (3 legs merged, cross-arms every ~7 m), 24-42 m, dark slate
//   glows  — warm (winColor) halo cards at each mast top and the hut window: 3 crossed quads with a radial falloff
// Draw calls: 2. Triangles: ~3 k. Load time only, no update.
import { Mesh, MeshStandardMaterial, MeshBasicMaterial, PlaneGeometry, Float32BufferAttribute, DataTexture, RGBAFormat, LinearFilter, AdditiveBlending, Color, Group } from 'three';
import { roundedBox, mergeGeos } from '../../cookbook/geo/kit.js';

// [x, z, height, legs-spread] — placed to sit left and right of the pose-1 view (out of every other hero pose)
export const FAR_MASTS = [[-92, -104, 38, 1.0], [-99, -111, 27, 0.8], [-84, -114, 31, 0.9], [-176, 52, 24, 0.7]];
export const FAR_HUTS = [[-168, 58, 7, 3.2, 3.0]]; // [x, z, length, depth, height]

function halo() {
  const n = 64, d = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n * 2 - 1, y = (j + 0.5) / n * 2 - 1, r = Math.min(1, Math.hypot(x, y));
    const v = Math.exp(-r * r * 9) * 0.85 + Math.exp(-r * r * 2.2) * 0.15 * (1 - r), k = (i + j * n) * 4;
    d[k] = d[k + 1] = d[k + 2] = Math.round(255 * v * (1 - r * r)); d[k + 3] = 255;
  }
  const t = new DataTexture(d, n, n, RGBAFormat); t.magFilter = t.minFilter = LinearFilter; t.needsUpdate = true;
  return t;
}

export function farSilhouettes({ groundAt, baseY, winColor = [3.0, 1.8, 0.8] }) {
  const group = new Group(); group.name = 'far-silhouettes';
  const parts = [], glows = [];
  const card = (x, y, z, s, k) => { // k = intensity (vertex colour; the hut window sits in the dense ground fog)
    for (let a = 0; a < 3; a++) {
      const g = new PlaneGeometry(s, s).rotateY((a * Math.PI) / 3).translate(x, y, z);
      g.setAttribute('color', new Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(k), 3));
      glows.push(g);
    }
  };
  for (const [x, z, H, sp] of FAR_MASTS) {
    const y0 = Math.max(baseY, groundAt(x, z)) - 0.5;
    // three legs leaning in to a 0.25 m apex, cross-arms and a top platform: reads as a guyed lattice mast at range
    for (let l = 0; l < 3; l++) {
      const a = (l * Math.PI * 2) / 3, ox = Math.cos(a) * sp, oz = Math.sin(a) * sp, lean = Math.atan2(sp * 0.85, H);
      const g = roundedBox(0.16, H, 0.16, 0.03, 1, 1e9).translate(0, H / 2, 0).rotateZ(lean * Math.cos(a)).rotateX(-lean * Math.sin(a));
      parts.push(g.translate(x + ox, y0, z + oz));
    }
    for (let y = 7; y < H - 2; y += 7) { const w = sp * 2 * (1 - (y / H) * 0.85) + 0.3; parts.push(roundedBox(w, 0.12, 0.12, 0.03, 1, 1e9).translate(x, y0 + y, z)); }
    parts.push(roundedBox(0.7, 0.25, 0.7, 0.05, 1, 1e9).translate(x, y0 + H, z), roundedBox(0.08, 4.5, 0.08, 0.02, 1, 1e9).translate(x, y0 + H + 2.3, z));
    card(x, y0 + H + 0.4, z, 3.2, 1);
  }
  for (const [x, z, L, D, H] of FAR_HUTS) {
    const y0 = Math.max(baseY, groundAt(x, z)) - 0.3;
    parts.push(roundedBox(L, H, D, 0.12, 2, 1e9).translate(x, y0 + H / 2, z), roundedBox(L + 0.4, 0.3, D + 0.4, 0.08, 1, 1e9).translate(x, y0 + H + 0.1, z));
    card(x + D * 0.5 + 0.3, y0 + 2.2, z, 18, 12);
  }
  const mastMat = new MeshStandardMaterial({ color: new Color(0.11, 0.12, 0.14), roughness: 0.85, metalness: 0.2 });
  mastMat.name = 'far-mast'; mastMat.userData.weather = 'prop';
  const masts = new Mesh(mergeGeos(parts), mastMat); masts.name = 'far-masts'; masts.matrixAutoUpdate = false;
  const glowMat = new MeshBasicMaterial({ map: halo(), color: new Color().fromArray(winColor).multiplyScalar(0.55), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: true });
  glowMat.name = 'far-glow'; glowMat.userData.noWeather = true;
  const glow = new Mesh(mergeGeos(glows), glowMat); glow.name = 'far-glow'; glow.matrixAutoUpdate = false; glow.renderOrder = 2;
  group.add(masts, glow);
  let tris = 0; for (const m of [masts, glow]) { const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; }
  return { group, tris, dispose() { masts.geometry.dispose(); glow.geometry.dispose(); glowMat.map.dispose(); } };
}
