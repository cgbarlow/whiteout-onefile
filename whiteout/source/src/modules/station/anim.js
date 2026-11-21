// Station motion that reads in the wind: route-marker flags (cloth flutter, CPU, one merged two-sided mesh), the
// windsock by the shed (stripes, droop eased by the gust), anemometer cups spinning on the met masts. Load-time
// buffers only; update() writes into preallocated arrays (zero allocation per frame).
import { BufferGeometry, BufferAttribute, Mesh, Group, Color } from 'three';
import { Kit, lathe } from '../../cookbook/geo/kit.js';
import { ART } from '../../art.js';

const WIND = ART.weather.wind, WL = Math.hypot(WIND[0], WIND[2]) || 1, WX = WIND[0] / WL, WZ = WIND[2] / WL;

/** two-sided grid: nu×nv quads; returns geometry with position/normal/color/uv + index (front + back copies) */
function clothGeo(count, nu, nv, colorOf) {
  const per = (nu + 1) * (nv + 1), nvx = count * per * 2;
  const pos = new Float32Array(nvx * 3), nor = new Float32Array(nvx * 3), col = new Float32Array(nvx * 3), uv = new Float32Array(nvx * 2), idx = [];
  const c = new Color();
  for (let f = 0; f < count; f++) for (let side = 0; side < 2; side++) {
    const base = (f * 2 + side) * per;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const v = base + j * (nu + 1) + i; c.set(colorOf(f, i / nu, j / nv)); col.set([c.r, c.g, c.b], v * 3); uv.set([i / nu, j / nv], v * 2);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, cc = a + nu + 1, d = cc + 1;
      if (side === 0) idx.push(a, b, d, a, d, cc); else idx.push(a, d, b, a, cc, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('color', new BufferAttribute(col, 3)); g.setAttribute('uv', new BufferAttribute(uv, 2)); g.setIndex(idx);
  return { g, per };
}

export function createAnim(G, mats, { flags = [], sock = null, cups = [] }) {
  const group = new Group(); group.name = 'station-anim';
  // ---- flags: [x, top y, z, colour]
  const FU = 6, FV = 3, FW = 0.55, FH = 0.36;
  const fl = clothGeo(flags.length, FU, FV, (f) => flags[f][3]);
  const fpos = fl.g.attributes.position.array, fnor = fl.g.attributes.normal.array, fphase = flags.map((_, i) => i * 1.7);
  const flagMesh = new Mesh(fl.g, mats.paint); flagMesh.name = 'flags'; flagMesh.castShadow = true; flagMesh.frustumCulled = false;
  if (flags.length) group.add(flagMesh);
  // ---- windsock: ring frustum along local +X (mouth at 0), stripes orange/white
  const SR = 12, SS = 6, SL = 1.5;
  const sk = clothGeo(1, SR, SS, (_, u, v) => (Math.floor(v * 5 - 0.001) % 2 ? 0xe8e4dc : 0xd2501a));
  const spos = sk.g.attributes.position.array, snor = sk.g.attributes.normal.array;
  const sockMesh = new Mesh(sk.g, mats.paint); sockMesh.name = 'windsock'; sockMesh.castShadow = true; sockMesh.frustumCulled = false;
  if (sock) {
    group.add(sockMesh);
    const pk = new Kit(); // pole + swivel frame
    pk.cyl(0.05, sock[1], 'steel', { at: [sock[0], sock[1] / 2, sock[2]], seg: 10, color: 0x8a9098 });
    pk.add(lathe([[0.2, -0.01], [0.21, 0], [0.2, 0.01], [0.19, 0]], { seg: 16 }), 'steel', { at: [sock[0] + 0.2, sock[1], sock[2]], rot: [0, 0, Math.PI / 2], color: 0x5a6068 });
    pk.box(0.6, 0.6, 0.6, 'concrete', { at: [sock[0], 0.15, sock[2]], color: 0x9a968e, r: 0.03 });
    group.add(pk.build({ steel: mats.steel, concrete: mats.concrete, default: mats.steel }));
  }
  // ---- anemometer cups: hub + 3 arms + hemispherical cups, one shared geometry, one group each
  const ck = new Kit();
  ck.cyl(0.03, 0.1, 'steel', { seg: 10, color: 0x9aa0a6 });
  for (let i = 0; i < 3; i++) {
    const a = i * 2.0944;
    ck.bar([0, 0.03, 0], [Math.cos(a) * 0.28, 0.03, Math.sin(a) * 0.28], 0.012, 0.012, 'steel', { color: 0x9aa0a6 });
    ck.add(lathe([[0, -0.06], [0.04, -0.055], [0.06, -0.03], [0.065, 0], [0.06, 0.0]], { seg: 12, crease: 60 }), 'steel', { at: [Math.cos(a) * 0.28, 0.03, Math.sin(a) * 0.28], rot: [0, -a, Math.PI / 2], color: 0xd8dadc });
  }
  const cupGeo = ck.build({ steel: mats.steel }).children[0].geometry;
  const spinners = cups.map((p) => { const m = new Mesh(cupGeo, mats.steel); m.position.fromArray(p); m.castShadow = true; m.name = 'anemometer'; group.add(m); return m; });

  function update(dt, t) {
    const gust = 0.65 + 0.35 * Math.sin(t * 0.23) * Math.sin(t * 0.071 + 1.3);
    // flags: stream downwind from the pole, travelling wave grows toward the free edge
    for (let f = 0; f < flags.length; f++) {
      const [x, y, z] = flags[f], ph = fphase[f];
      for (let side = 0; side < 2; side++) {
        const base = (f * 2 + side) * fl.per;
        for (let j = 0; j <= FV; j++) for (let i = 0; i <= FU; i++) {
          const u = i / FU, vv = j / FV, v = base + j * (FU + 1) + i;
          const wave = Math.sin(t * 9.5 * (0.7 + 0.3 * gust) - u * 5.0 + ph) * 0.09 * u * (0.5 + gust) + Math.sin(t * 17 + u * 9 + vv * 3 + ph) * 0.015 * u;
          const droop = (1 - gust) * 0.12 * u * u;
          const px = u * FW, o = v * 3;
          fpos[o] = x + WX * px - WZ * wave; fpos[o + 1] = y - FH + vv * FH - droop; fpos[o + 2] = z + WZ * px + WX * wave;
          const sn = side ? -1 : 1, dwave = Math.cos(t * 9.5 - u * 5.0 + ph) * 0.45 * u;
          fnor[o] = (-WZ + WX * dwave) * sn; fnor[o + 1] = 0; fnor[o + 2] = (WX + WZ * dwave) * sn;
        }
      }
    }
    if (flags.length) { fl.g.attributes.position.needsUpdate = true; fl.g.attributes.normal.needsUpdate = true; }
    // windsock: frustum radius 0.2 → 0.08, axis droops when the gust eases, tail snakes
    if (sock) {
      const sx = sock[0] + 0.2, sy = sock[1], sz = sock[2];
      for (let side = 0; side < 2; side++) for (let j = 0; j <= SS; j++) for (let i = 0; i <= SR; i++) {
        const s = j / SS, a = (i / SR) * 6.2832, r = 0.2 - 0.12 * s, v = side * sk.per + j * (SR + 1) + i, o = v * 3;
        const along = s * SL, sag = (1 - gust) * 0.55 * s * s, wig = Math.sin(t * 7 - s * 4) * 0.07 * s;
        const ca = Math.cos(a), sa = Math.sin(a), sn = side ? -1 : 1;
        spos[o] = sx + WX * along - WZ * (wig + ca * r); spos[o + 1] = sy - sag + sa * r; spos[o + 2] = sz + WZ * along + WX * (wig + ca * r);
        snor[o] = -WZ * ca * sn; snor[o + 1] = sa * sn; snor[o + 2] = WX * ca * sn;
      }
      sk.g.attributes.position.needsUpdate = true; sk.g.attributes.normal.needsUpdate = true;
    }
    for (let i = 0; i < spinners.length; i++) spinners[i].rotation.y = -t * (5 + 4 * gust) - i;
  }
  update(0, 0);
  sk.g.computeBoundingSphere(); fl.g.computeBoundingSphere();
  return { group, update };
}
