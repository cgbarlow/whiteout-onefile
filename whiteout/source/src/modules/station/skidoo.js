// Skidoo + Nansen sledge parked north of the shed. The machine is seated on the drift: the snow height is sampled
// under the ski tips, the spindles and the rear of the track, a plane is fitted (pitch + roll), and the body sinks
// 6 cm so the skis and the track bed into the crust; snow builds up round the skis and banks along the track, and
// a contact-AO blob goes under it. Bodywork: bevelled enamel cowl ('gloss', smoother than the module paint), side
// panels, bumper, windscreen, bars with hand guards, a stitched seat, running boards, flap and tail lamp.
import { tube, lathe, barrel, extrudeBevel, roundedBox } from '../../cookbook/geo/kit.js';
import { C, shade, jit, box3, gy, remapUV } from './parts.js';
import { winUV } from './textures.js';
import { driftAlong, mound } from './wear.js';
import { MARKS } from './props.js';

const RED = 0xa82a1a, BLK = 0x18191b;

export function skidoo(k, d, [x, z], ry, rnd) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];        // local → world (Kit yaw convention)
  const h = (lx, lz) => { const [wx, wz] = W(lx, lz); return gy(wx, wz); };
  // fit a plane through the contact points: ski tips + spindles (front), track rear (back), left / right
  const fr = (h(1.5, -0.45) + h(1.5, 0.45) + h(0.9, -0.45) + h(0.9, 0.45)) / 4, bk = (h(-1.1, -0.25) + h(-1.1, 0.25) + h(-0.4, 0)) / 3;
  const lf = (h(1.2, -0.45) + h(-0.8, -0.25)) / 2, rt = (h(1.2, 0.45) + h(-0.8, 0.25)) / 2;
  const pitch = Math.max(-0.12, Math.min(0.12, Math.atan2(fr - bk, 2.4))), roll = Math.max(-0.08, Math.min(0.08, Math.atan2(lf - rt, 0.8)));
  const y0 = (fr + bk) / 2 - 0.06;
  k.push(x, y0, z, ry, roll, pitch);
  // skis: runner with an upturned tip, keel, spindle + shock tower
  for (const e of [-0.45, 0.45]) {
    k.box(1.1, 0.04, 0.13, 'dark', { at: [1.0, 0.04, e], color: BLK, r: 0.018 });
    k.push(1.62, 0.1, e, 0, 0, 0.55); k.box(0.26, 0.04, 0.13, 'dark', { color: BLK, r: 0.018 }); k.pop();
    d.box(0.9, 0.018, 0.02, 'steel', { at: [1.0, 0.012, e], color: 0x5a5e62, r: 0.004, occ: false });
    d.bar([1.0, 0.08, e], [0.86, 0.44, e * 0.72], 0.04, 0.04, 'steel', { color: C.dark });
    k.push(0.92, 0.26, e * 0.84, 0, 0, -0.35); k.cyl(0.03, 0.3, 'steel', { seg: 10, color: C.yellow }); k.pop();
    d.bar([0.98, 0.12, e], [0.55, 0.3, e * 0.55], 0.03, 0.03, 'steel', { color: C.dark });
  }
  // tunnel + track: lugged belt round two idlers, running boards with traction holes
  k.box(1.7, 0.22, 0.5, 'dark', { at: [-0.35, 0.2, 0], color: 0x1d1e20, r: 0.04 });
  for (let i = 0; i < 13; i++) d.box(0.05, 0.03, 0.48, 'dark', { at: [-1.1 + i * 0.125, 0.06, 0], color: 0x2a2b2d, r: 0.006, occ: false });
  for (const ex of [-1.12, 0.42]) { k.push(ex, 0.17, 0, 0, Math.PI / 2); k.cyl(0.11, 0.46, 'dark', { seg: 14, color: 0x202124 }); k.pop(); }
  k.box(1.5, 0.06, 0.95, 'gloss', { at: [-0.35, 0.33, 0], color: shade(RED, 0.9), r: 0.025 });
  for (const e of [-1, 1]) for (let i = 0; i < 6; i++) d.box(0.12, 0.012, 0.1, 'dark', { at: [-0.95 + i * 0.22, 0.362, e * 0.36], color: 0x111214, r: 0.004, occ: false });
  // cowl: bevelled side profile extruded across, side panels, bumper loop, headlamp, windscreen
  k.add(extrudeBevel([[-0.15, 0.32], [1.15, 0.32], [1.48, 0.44], [1.24, 0.64], [0.6, 0.8], [0.2, 0.87], [-0.15, 0.72]], { depth: 0.8, bevel: 0.04, bevelSeg: 3 }), 'gloss', { color: RED });
  for (const e of [-1, 1]) k.add(extrudeBevel([[0.05, 0.33], [1.0, 0.33], [1.12, 0.42], [0.92, 0.52], [0.12, 0.55]], { depth: 0.03, bevel: 0.01 }), 'gloss', { at: [0, 0, e * 0.4], color: 0x24262a });
  k.add(tube([[1.42, 0.36, -0.36], [1.62, 0.4, -0.25], [1.66, 0.42, 0], [1.62, 0.4, 0.25], [1.42, 0.36, 0.36]], 0.018, { radial: 8, curve: true, samples: 14 }), 'steel', { color: 0x2a2c2e, occ: false });
  k.box(0.08, 0.1, 0.3, 'dark', { at: [1.33, 0.53, 0], rot: [0, 0, 0.6], color: BLK, r: 0.02 });
  k.box(0.012, 0.08, 0.26, 'tint', { at: [1.37, 0.555, 0], rot: [0, 0, 0.6], r: 0, occ: false });
  k.push(0.35, 0.86, 0, 0, 0, 0.75); k.add(remapUV(roundedBox(0.03, 0.34, 0.64, 0.012, 1), winUV(3)), 'tint', { rot: [0, Math.PI / 2, 0], occ: false }); k.pop();
  // bars: riser, cross bar, grips, hand guards, throttle block
  d.bar([0.25, 0.8, 0], [0.1, 0.95, 0], 0.045, 0.045, 'dark', { color: C.dark });
  d.add(tube([[0.12, 0.92, -0.38], [0.1, 0.96, -0.2], [0.1, 0.96, 0.2], [0.12, 0.92, 0.38]], 0.014, { radial: 8, curve: true, samples: 10 }), 'steel', { color: 0x2a2c2e, occ: false });
  for (const e of [-1, 1]) { d.cyl(0.02, 0.12, 'dark', { at: [0.12, 0.92, e * 0.34], rot: [Math.PI / 2, 0, 0], seg: 8, color: 0x111111, occ: false }); k.box(0.16, 0.1, 0.03, 'gloss', { at: [0.2, 0.94, e * 0.4], rot: [0, e * 0.4, 0], color: BLK, r: 0.012 }); }
  // seat: stitched saddle, grab handle, rear flap, tail lamp
  k.add(extrudeBevel([[-1.15, 0.38], [-0.12, 0.38], [-0.12, 0.6], [-0.3, 0.66], [-1.1, 0.62]], { depth: 0.44, bevel: 0.03, bevelSeg: 3 }), 'dark', { color: 0x141516 });
  for (const e of [-0.2, 0.2]) d.box(0.95, 0.006, 0.006, 'dark', { at: [-0.65, 0.645, e], color: 0x2e2f31, r: 0, occ: false });
  d.add(tube([[-1.12, 0.62, -0.24], [-1.22, 0.66, -0.2], [-1.24, 0.66, 0.2], [-1.12, 0.62, 0.24]], 0.014, { radial: 6, curve: true, samples: 8 }), 'steel', { color: 0x2a2c2e, occ: false });
  k.box(0.02, 0.28, 0.46, 'dark', { at: [-1.2, 0.2, 0], rot: [0, 0, -0.12], color: 0x121314, r: 0.006 });
  k.box(0.04, 0.05, 0.2, 'paint', { at: [-1.2, 0.4, 0], color: 0x8a1a12, r: 0.012 });
  // sledge on a tow bar, two drums lashed with ratchet straps
  d.bar([-1.0, 0.2, 0], [-2.0, 0.2, 0], 0.04, 0.04, 'steel', { color: C.steel });
  for (const e of [-0.45, 0.45]) { k.box(2.6, 0.06, 0.08, 'wood', { at: [-3.4, 0.05, e], color: 0x7a5a3a, r: 0.015 }); for (let q = 0; q < 4; q++) k.box(0.05, 0.26, 0.05, 'wood', { at: [-4.4 + q * 0.65, 0.2, e], color: 0x6a4a2a, r: 0.008 }); }
  for (let q = 0; q < 9; q++) k.box(0.12, 0.03, 1.0, 'wood', { at: [-4.5 + q * 0.27, 0.34, 0], color: jit(0x8a6a44, rnd, 0.1), r: 0.006 });
  for (let j = 0; j < 2; j++) { k.push(-3.9 + j * 0.9, 0.36 + 0.29, 0, 0, Math.PI / 2); k.push(0, -0.425, 0); barrel(k, { color: jit(0x2a4a6a, rnd, 0.1) }); k.pop(); k.pop(); }
  for (let j = 0; j < 2; j++) d.add(tube(Array.from({ length: 9 }, (_, q) => { const a = Math.PI * q / 8; return [-3.9 + j * 0.9 + 0.2, 0.65 + Math.sin(a) * 0.3, Math.cos(a) * 0.48]; }), 0.012, { radial: 4 }), 'dark', { color: C.yellow, occ: false });
  // wind-packed snow on the seat back and footwells
  k.add(roundedBox(0.4, 0.04, 0.36, 0.018, 2, 0.5), 'snow', { at: [-0.95, 0.655, 0], color: 0xe6ebf1, occ: false });
  for (const e of [-1, 1]) k.add(roundedBox(0.5, 0.03, 0.12, 0.014, 2, 0.5), 'snow', { at: [-0.75, 0.375, e * 0.38], color: 0xe6ebf1, occ: false });
  k.pop();
  // snow build-up round the skis and banked against the track (world space, on the real drift surface)
  for (const e of [-0.45, 0.45]) { const [mx, mz] = W(1.55, e); mound(k, mx, mz, 0.32, 0.12); const a = W(0.6, e - 0.12), b = W(1.45, e - 0.12); driftAlong(k, a, b, 0.07, 0.22, 31 + e * 10, { side: 1 }); driftAlong(k, W(0.6, e + 0.12), W(1.45, e + 0.12), 0.07, 0.22, 37 + e * 10, { side: -1 }); }
  driftAlong(k, W(-1.15, -0.3), W(0.35, -0.3), 0.14, 0.4, 41, { side: 1 });
  driftAlong(k, W(-1.15, 0.3), W(0.35, 0.3), 0.12, 0.36, 43, { side: -1 });
  driftAlong(k, W(-4.8, -0.52), W(-2.1, -0.52), 0.1, 0.35, 47, { side: 1 });
  driftAlong(k, W(-4.8, 0.52), W(-2.1, 0.52), 0.08, 0.3, 49, { side: -1 });
  const [bx, bz] = W(0.2, 0), [sx, sz] = W(-3.4, 0);
  MARKS.blobs.push([bx, bz, 3.4, 1.6, ry], [sx, sz, 3.2, 1.5, ry]);
  return box3(x + Math.min(1.8 * c, -4.8 * c) - 0.6, 0, z + Math.min(-1.8 * s, 4.8 * s) - 0.6, x + Math.max(1.8 * c, -4.8 * c) + 0.6, y0 + 1.0, z + Math.max(-1.8 * s, 4.8 * s) + 0.6);
}
