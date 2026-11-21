// Small wall fixtures shared by the station builders (load-time only, real metres, bevelled):
//   elecCabinet  painted steel distribution cabinet: body, proud door leaf with a dark seam all round, lift-off
//                hinges, quarter-turn latch with a padlock hasp, louvred vents, gland plate with conduits to the
//                ground, chipped bare-steel edges. Returns the door-face centre for a placard / stencil decal.
import { tube } from '../../cookbook/geo/kit.js';
import { C, shade } from './parts.js';

export function elecCabinet(k, d, x, y, z, ry, { w = 0.5, h = 0.65, dp = 0.3, color = 0x8a9096, rnd = Math.random, ground = 0.1 } = {}) {
  k.push(x, y, z, ry);
  const fz = dp / 2;
  k.box(w, h, dp, 'paint', { color, r: 0.018 });
  k.box(w + 0.04, 0.035, dp + 0.05, 'paint', { at: [0, h / 2 + 0.012, 0.01], color: shade(color, 0.92), r: 0.01 }); // rain hood
  k.box(w - 0.02, h - 0.02, 0.006, 'dark', { at: [0, 0, fz + 0.002], color: 0x15161a, r: 0, occ: false });          // seam shadow
  k.box(w - 0.04, h - 0.04, 0.018, 'paint', { at: [0, 0, fz + 0.011], color: shade(color, 1.05), r: 0.006 });       // door leaf
  for (const e of [-0.3, 0.3]) { // lift-off hinges on the left edge
    d.cyl(0.011, 0.07, 'steel', { at: [-w / 2 + 0.012, e * h, fz + 0.016], seg: 8, color: 0x5a5e62, occ: false });
    d.box(0.03, 0.05, 0.006, 'steel', { at: [-w / 2 + 0.03, e * h, fz + 0.021], color: 0x6a6e72, r: 0.002, occ: false });
  }
  // quarter-turn latch + padlock hasp on the right
  d.cyl(0.018, 0.012, 'dark', { at: [w / 2 - 0.06, 0.02, fz + 0.026], rot: [Math.PI / 2, 0, 0], seg: 10, color: 0x1b1c1e, occ: false });
  d.box(0.012, 0.07, 0.014, 'dark', { at: [w / 2 - 0.06, 0.02, fz + 0.036], color: 0x1b1c1e, r: 0.004, occ: false });
  d.box(0.03, 0.04, 0.008, 'steel', { at: [w / 2 - 0.06, -0.06, fz + 0.026], color: 0x8a8e92, r: 0.002, occ: false });
  d.box(0.03, 0.035, 0.016, 'paint', { at: [w / 2 - 0.06, -0.1, fz + 0.03], color: 0xb02418, r: 0.005, occ: false });
  // louvred vents low on the door and high on one side
  for (let i = 0; i < 5; i++) {
    d.box(w * 0.5, 0.012, 0.014, 'dark', { at: [0, -h / 2 + 0.07 + i * 0.022, fz + 0.022], rot: [0.6, 0, 0], color: 0x2a2c2e, r: 0.002, occ: false });
    d.box(0.014, 0.012, dp * 0.5, 'dark', { at: [w / 2 + 0.004, h / 2 - 0.08 - i * 0.022, 0], rot: [0, 0, -0.6], color: 0x2a2c2e, r: 0.002, occ: false });
  }
  // chipped bare-steel edges (paint knocked off the corners and the door lip)
  for (let i = 0; i < 7; i++) {
    const sx = rnd() < 0.5 ? -1 : 1, sy = rnd() < 0.5 ? -1 : 1, along = rnd() < 0.5;
    const at = along ? [(rnd() - 0.5) * (w - 0.1), sy * (h / 2 - 0.022), fz + 0.021] : [sx * (w / 2 - 0.022), (rnd() - 0.5) * (h - 0.1), fz + 0.021];
    d.box(along ? 0.02 + rnd() * 0.05 : 0.006, along ? 0.006 : 0.02 + rnd() * 0.05, 0.003, 'steel', { at, color: 0xa8acb0, r: 0, occ: false });
  }
  // gland plate + conduits dropping to the ground, one rising to the cable tray
  k.box(w - 0.06, 0.03, dp - 0.06, 'steel', { at: [0, -h / 2 - 0.012, 0], color: 0x4a4e52, r: 0.005 });
  const down = y - ground;
  for (let j = 0; j < 3; j++) {
    const u = -w / 2 + 0.1 + j * (w - 0.2) / 2;
    d.cyl(0.022, 0.03, 'dark', { at: [u, -h / 2 - 0.04, 0.0], seg: 8, color: 0x2a2c2e, occ: false });
    d.add(tube([[u, -h / 2 - 0.05, 0.0], [u, -down + 0.25, 0.0], [u + 0.04, -down + 0.06, 0.12 + j * 0.05]], 0.016, { radial: 6, curve: true, samples: 8 }), 'dark', { color: [C.black, 0x3a2a1a, 0x2a2c2e][j], occ: false });
  }
  d.add(tube([[w / 2 - 0.08, h / 2 + 0.03, -0.02], [w / 2 - 0.08, h / 2 + 0.6, -0.02]], 0.018, { radial: 6 }), 'steel', { color: 0x6a6e72, occ: false });
  k.pop();
  const c = Math.cos(ry), s = Math.sin(ry), off = fz + 0.024;
  return { face: [x + s * off, y, z + c * off], ry };
}
