// Generator control end (+x, local coords — see model.js): panel enclosure on two posts with a rain hood and a door
// carrying 3 frosted gauges, hour meter, status lamp (key 'lamp'), key switch, 4 guarded toggles, E-stop, header
// plate and a frost bloom; the crank quadrant + pivot boss on its +z side (the lever itself is leverKit, its own
// mesh so it can pump while cranking); the battery box on a tray under the panel with cables to the starter; the
// day-tank fuel hose; unit C's soot, scorch and FAULT tag. The rain-cap flap is flapKit (own mesh, flutters).
import { lathe, tube, extrudeBevel } from '../../cookbook/geo/kit.js';
import { bolt } from './parts.js';

const HP = Math.PI / 2, FX = 1.296; // door face x

// lathe helpers oriented along +x (profile y → world +x)
const alongX = (k, at, profile, key, o = {}) => { k.push(at[0], at[1], at[2], 0, 0, -HP); k.add(lathe(profile, { seg: o.seg || 20, crease: 30 }), key, { color: o.color, occ: false }); k.pop(); };
const BEZEL = [[0.047, 0], [0.058, 0], [0.06, 0.007], [0.057, 0.017], [0.05, 0.02], [0.047, 0.012]];
const SMALL_BEZEL = [[0.015, 0], [0.026, 0], [0.027, 0.008], [0.022, 0.014], [0.016, 0.014]];

export function panelKit(k, d, o) {
  const { v, rnd, id } = o;
  const snowTops = [];
  // posts on the cross-beam, side brackets, enclosure, hood with drip lip
  for (const s of [1, -1]) {
    k.box(0.04, 1.2, 0.04, 'paint', { at: [1.2, 0.9, s * 0.4], color: v.frame, r: 0.006 });
    for (const y of [1.0, 1.42]) k.box(0.07, 0.06, 0.05, 'paint', { at: [1.2, y, s * 0.385], color: v.frame, r: 0.006 });
  }
  k.box(0.18, 0.56, 0.74, 'paint', { at: [1.19, 1.22, 0], color: v.panel, r: 0.014 });
  k.box(0.26, 0.012, 0.82, 'paint', { at: [1.21, 1.515, 0], rot: [0, 0, -0.12], color: v.panel, r: 0.004 });
  k.box(0.012, 0.03, 0.82, 'paint', { at: [1.335, 1.495, 0], color: v.panel, r: 0.003 });
  snowTops.push([0.24, 0.78, 0.03, 1.21, 1.522, 0, 31, [0, 0, -0.12]]);
  // door slab, hinges (-z), quarter-turn latch (+z), corner screws
  k.box(0.016, 0.52, 0.7, 'paint', { at: [FX - 0.008, 1.22, 0], color: v.panel, r: 0.006 });
  for (const y of [1.04, 1.4]) k.cyl(0.009, 0.06, 'steel', { at: [FX + 0.002, y, -0.356], seg: 10, color: 0x9a9a96 });
  alongX(k, [FX, 1.22, 0.31], [[0, 0], [0.018, 0], [0.018, 0.012], [0, 0.013]], 'steel', { color: 0x8a8a86, seg: 14 });
  k.box(0.012, 0.055, 0.012, 'dark', { at: [FX + 0.018, 1.22, 0.31], color: 0x1a1a1a, r: 0.003 });
  for (const y of [0.985, 1.455]) for (const z of [-0.33, 0.33]) bolt(k, [FX, y, z], 'x', 0.006, 'steel', 0x9a9a96);
  // header plate
  d('plate' + id, 0.36, [FX + 0.0015, 1.435, -0.02], '+x');
  // gauges: chrome bezel, frosted dial, three bezel screws
  for (let i = 0; i < 3; i++) {
    const z = -0.2 + i * 0.2;
    alongX(k, [FX, 1.3, z], BEZEL, 'steel', { color: 0xc8c8c2, seg: 18 });
    d(`dial${id}${i}`, 0.098, [FX + 0.006, 1.3, z], '+x');
    k.box(0.006, 0.024, 0.086, 'steel', { at: [FX + 0.002, 1.222, z], color: 0x8a8a86, r: 0.0015 });            // label plate
    d('glabel' + i, 0.08, [FX + 0.0055, 1.222, z], '+x', 0.02);
    for (let j = 0; j < 3; j++) { const a = j * 2.094 + 0.5; bolt(k, [FX + 0.006, 1.3 + Math.cos(a) * 0.067, z + Math.sin(a) * 0.067], 'x', 0.0035, 'steel', 0x8a8a86); }
  }
  // hour meter, status lamp, key switch
  k.box(0.01, 0.038, 0.082, 'dark', { at: [FX + 0.003, 1.165, -0.2], color: 0x141414, r: 0.002 });
  d('hours' + id, 0.07, [FX + 0.0085, 1.165, -0.2], '+x');
  alongX(k, [FX, 1.165, 0], SMALL_BEZEL, 'steel', { color: 0xc8c8c2, seg: 20 });
  alongX(k, [FX + 0.006, 1.165, 0], [[0.0175, 0], [0.0175, 0.008], [0.014, 0.018], [0.008, 0.024], [0, 0.026]], 'lamp', { seg: 18 });
  alongX(k, [FX, 1.165, 0.2], SMALL_BEZEL, 'steel', { color: 0xc8c8c2, seg: 20 });
  alongX(k, [FX + 0.006, 1.165, 0.2], [[0, 0], [0.013, 0], [0.013, 0.012], [0, 0.013]], 'dark', { color: 0x222222, seg: 16 });
  k.box(0.02, 0.004, 0.018, 'steel', { at: [FX + 0.026, 1.165, 0.2], rot: [id === 'C' ? 0.6 : 0, 0, 0], color: 0xb8b4a8, r: 0.001, occ: false });
  k.box(0.004, 0.026, 0.022, 'steel', { at: [FX + 0.037, 1.165, 0.2], color: 0xb8b4a8, r: 0.001, occ: false });
  // toggles under the legend: hex nut, guard rails, lever up or down (each unit left differently)
  d('legend', 0.36, [FX + 0.0015, 1.108, -0.12], '+x');
  const ups = { A: [1, 1, 0, 0], B: [0, 1, 0, 1], C: [1, 0, 1, 0] }[id];
  for (let i = 0; i < 4; i++) {
    const z = -0.255 + i * 0.09, up = ups[i] ? 1 : -1;
    bolt(k, [FX, 1.06, z], 'x', 0.009, 'steel', 0xb0b0aa);
    for (const s of [1, -1]) k.box(0.022, 0.05, 0.004, 'steel', { at: [FX + 0.011, 1.06, z + s * 0.019], color: 0x9a9a96, r: 0.0015, occ: false });
    k.push(FX + 0.007, 1.06, z, 0, 0, -HP + up * 0.45);
    k.add(lathe([[0.0035, 0], [0.0035, 0.024], [0.0055, 0.027], [0.005, 0.032], [0, 0.033]], { seg: 8 }), 'steel', { color: 0xd0d0ca, occ: false });
    k.pop();
  }
  // E-stop: yellow ring + red mushroom
  d('estop', 0.09, [FX + 0.0015, 1.04, 0.2], '+x');
  alongX(k, [FX, 1.04, 0.2], [[0, 0], [0.018, 0], [0.018, 0.02], [0.031, 0.024], [0.033, 0.033], [0.026, 0.042], [0, 0.044]], 'paint', { color: 0xb01e14, seg: 24 });
  // frost bloom over the door + cable glands under the enclosure
  d('frost' + 'ABC'.indexOf(id), 0.7, [FX + 0.0025, 1.22, 0], '+x', 0.52);
  for (const z of [-0.2, 0.0, 0.18]) k.cyl(0.017, 0.03, 'dark', { at: [1.17, 0.925, z], seg: 12, color: 0x1a1a1a });

  // crank quadrant (notched sector) + pivot boss on the +z side, CRANK label
  const piv = [1.2, 1.08, 0.405];
  const sector = [[0, -0.02]];
  for (let i = 0; i <= 14; i++) { const a = -0.3 + (i / 14) * 1.3, r = i % 2 ? 0.115 : 0.125; sector.push([Math.sin(a) * r, Math.cos(a) * r]); }
  k.add(extrudeBevel(sector.map(([x, y]) => [-x, y]), { depth: 0.008, bevel: 0.0015 }), 'paint', { at: [piv[0], piv[1], 0.376], color: 0xd8a21e });
  k.cyl(0.03, 0.03, 'steel', { at: [piv[0], piv[1], 0.385], seg: 18, color: 0x7a7a76, rot: [HP, 0, 0] });
  d('crank', 0.13, [1.19, 0.975, 0.3815], '+z');

  // battery box on a tray: lid, straps, vent caps, terminals, cables to the starter and the frame
  const bx = 1.19, bz = 0.17;
  k.box(0.24, 0.016, 0.38, 'paint', { at: [bx, 0.308, bz], color: v.frame, r: 0.003 });
  k.box(0.22, 0.22, 0.34, 'dark', { at: [bx, 0.426, bz], color: 0x1c2420, r: 0.012 });
  k.box(0.235, 0.034, 0.355, 'dark', { at: [bx, 0.553, bz], color: 0x222a26, r: 0.01 });
  for (const z of [bz - 0.1, bz + 0.1]) {
    k.box(0.242, 0.01, 0.026, 'dark', { at: [bx, 0.572, z], color: 0x141414, r: 0.003 });
    for (const s of [1, -1]) k.box(0.006, 0.24, 0.026, 'dark', { at: [bx + s * 0.121, 0.45, z], color: 0x141414, r: 0.002 });
  }
  for (const z of [bz - 0.05, bz + 0.05]) k.cyl(0.013, 0.016, 'dark', { at: [bx - 0.04, 0.578, z], seg: 10, color: 0x1e2420 });
  snowTops.push([0.21, 0.32, 0.02, bx, 0.576, bz, 37]);
  for (const [dx, col] of [[-0.05, 0x8a1a12], [0.05, 0x161616]]) {
    k.cyl(0.011, 0.03, 'steel', { at: [bx + dx, 0.47, 0.348], seg: 10, color: 0xb0a070, rot: [HP, 0, 0] });
  }
  k.add(tube([[bx - 0.05, 0.47, 0.36], [bx - 0.1, 0.43, 0.46], [0.6, 0.36, 0.5], [0.15, 0.5, 0.42], [-0.03, 0.66, 0.37]], 0.011, { radial: 8, curve: true, samples: 22 }), 'dark', { color: 0x5a1610, occ: false });
  k.add(tube([[bx + 0.05, 0.47, 0.36], [bx + 0.03, 0.4, 0.45], [1.05, 0.31, 0.52], [0.98, 0.25, 0.556]], 0.011, { radial: 8, curve: true, samples: 12 }), 'dark', { color: 0x141414, occ: false });
  k.add(tube([[1.17, 0.91, -0.2], [1.12, 0.8, -0.26], [1.0, 0.62, -0.3], [0.9, 0.42, -0.36]], 0.012, { radial: 8, curve: true, samples: 12 }), 'dark', { color: 0x161616, occ: false });

  // day-tank fuel hose: valve under the lean-to day tank → down to the plinth → into the frame end
  if (o.dayTank) {
    const [tx, ty, tz] = o.dayTank;
    k.add(tube([[tx, ty, tz], [tx, ty - 0.2, tz + 0.05], [tx + 0.1, 0.03, tz + 0.15], [-1.45, 0.025, -0.52], [-1.3, 0.06, -0.47], [-1.0, 0.2, -0.42]], 0.012, { radial: 8, curve: true, samples: 26 }), 'dark', { color: 0x1a1612, occ: false });
    k.cyl(0.02, 0.05, 'steel', { at: [tx, ty + 0.02, tz], seg: 10, color: 0xb09a50 });
    k.box(0.06, 0.008, 0.012, 'paint', { at: [tx + 0.03, ty + 0.03, tz], color: 0xc81e14, r: 0.002 });
  }

  // unit C: soot up the stack side, scorch round the panel glands, a FAULT tag wired to the door latch
  if (id === 'C') {
    d('soot', 0.3, [-0.12, 1.92, -0.149], '+z', 0.5);
    d('scorch', 0.22, [FX + 0.004, 1.02, -0.05], '+x');
    k.add(tube([[FX + 0.02, 1.22, 0.31], [FX + 0.03, 1.19, 0.3], [FX + 0.035, 1.16, 0.29]], 0.0012, { radial: 4 }), 'steel', { color: 0x9a9a96, occ: false });
    d('tag', 0.055, [FX + 0.012, 1.11, 0.28], '+x');
    // loose, taped exciter lead hanging out of the gland — the spark source
    k.add(tube([[1.17, 0.92, 0.0], [1.2, 0.86, 0.04], [1.26, 0.8, 0.08], [1.31, 0.82, 0.1]], 0.007, { radial: 6, curve: true, samples: 10 }), 'dark', { color: 0x1a1a1a, occ: false });
    k.cyl(0.01, 0.035, 'paint', { at: [1.26, 0.8, 0.08], seg: 8, color: 0x2a3a6a, rot: [0, 0, 0.9] });
  }
  return { panel: [FX + 0.06, 1.15, 0], lamp: [FX + 0.03, 1.165, 0], lever: piv, sparks: id === 'C' ? [1.31, 0.82, 0.1] : [1.17, 0.92, 0.0], snowTops };
}

/** crank lever in pivot-local coords (pivot at the origin, rotates about +z) */
export function leverKit(k) {
  k.cyl(0.022, 0.024, 'dark', { at: [0, 0, 0.03], seg: 16, color: 0x2a2a2a, rot: [HP, 0, 0] });
  k.box(0.024, 0.32, 0.012, 'dark', { at: [0, 0.15, 0.045], color: 0x8a1a12, r: 0.004 });
  k.cyl(0.017, 0.095, 'dark', { at: [0, 0.34, 0.045], seg: 14, color: 0x161616, bevel: 0.006 });
  k.add(lathe([[0, 0], [0.019, 0], [0.019, 0.006], [0, 0.012]], { seg: 14 }), 'dark', { at: [0, 0.385, 0.045], color: 0x161616, occ: false });
  bolt(k, [0, 0, 0.045], 'z', 0.007);
}

/** rain-cap flap in hinge-local coords (hinge axis +z through the origin, the cap extends toward +x) */
export function flapKit(k) {
  k.cyl(0.063, 0.007, 'dark', { at: [0.062, 0.006, 0], seg: 22, color: 0x4a3428, bevel: 0.002 });
  k.add(lathe([[0.062, 0], [0.066, 0], [0.066, -0.016], [0.062, -0.016]], { seg: 22 }), 'dark', { at: [0.062, 0.004, 0], color: 0x4a3428, occ: false });
  k.cyl(0.008, 0.05, 'dark', { at: [0, 0.006, 0], seg: 10, color: 0x3a2a20, rot: [HP, 0, 0] });
  k.box(0.04, 0.012, 0.02, 'dark', { at: [-0.018, 0.008, 0], color: 0x3a2a20, r: 0.003 }); // counterweight tab
}
