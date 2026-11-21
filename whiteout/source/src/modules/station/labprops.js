// Lab bench props (interior kit ki + detail di, local frames, real metres, bevelled): monitors with a bezel, rear
// housing, VESA neck + foot and cables to the desk grommet; instruments with an inset front panel, display, knobs,
// vents, feet and handles; paper stacks, a clipboard, sample jars, a sharps box. Every prop that should carry a
// label pushes a decal spec into `labels` ([name, w, [x,y,z], ry]); lab.js hands them to signs.js (inside group).
import { tube, lathe, roundedBox } from '../../cookbook/geo/kit.js';
import { jit, shade, remapUV } from './parts.js';
import { screenUV } from './textures.js';

const PLASTIC = 0x1b1c1f, PAPER = [0xf2efe4, 0xe9e4d2, 0xf4f4f0, 0xe6dcc0];
const toW = (x, z, ry, lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];

export function monitor(ki, d, x, y, z, dir, tile, items, labels, rnd) {
  const ry = dir > 0 ? 0 : Math.PI; // screen faces the room (local +z = into the room)
  ki.push(x, y, z, ry);
  ki.box(0.24, 0.016, 0.18, 'idark', { at: [0, 0.008, 0.0], color: PLASTIC, r: 0.006 });             // foot
  ki.box(0.05, 0.3, 0.03, 'idark', { at: [0, 0.16, -0.05], rot: [-0.08, 0, 0], color: 0x2a2c30, r: 0.01 }); // neck
  ki.box(0.12, 0.12, 0.03, 'idark', { at: [0, 0.42, -0.045], color: 0x2a2c30, r: 0.01 });           // VESA plate
  ki.box(0.5, 0.29, 0.03, 'idark', { at: [0, 0.425, -0.025], color: 0x202226, r: 0.02 });           // rear housing
  ki.box(0.56, 0.35, 0.022, 'idark', { at: [0, 0.425, -0.003], color: 0x141517, r: 0.008 });        // front shell
  for (const [w, h, ox, oy] of [[0.56, 0.022, 0, 0.165], [0.56, 0.034, 0, -0.159], [0.022, 0.31, 0.269, 0], [0.022, 0.31, -0.269, 0]]) ki.box(w, h, 0.008, 'idark', { at: [ox, 0.425 + oy, 0.011], color: 0x0f1012, r: 0.003, occ: false }); // bezel lip
  const g = roundedBox(0.514, 0.296, 0.003, 0, 0); remapUV(g, screenUV(tile));
  ki.add(g, 'screen', { at: [0, 0.428, 0.008], occ: false });
  d.box(0.012, 0.006, 0.004, 'screen', { at: [0.24, 0.27, 0.013], occ: false });                    // power LED
  // keyboard with key rows, mouse on a pad
  ki.box(0.44, 0.022, 0.15, 'idark', { at: [0.02, 0.012, 0.27], rot: [0.05, 0, 0], color: 0x232529, r: 0.006 });
  for (let r = 0; r < 4; r++) d.box(0.4, 0.006, 0.026, 'idark', { at: [0.02, 0.026 + r * 0.002, 0.215 + r * 0.032], color: 0x34373c, r: 0.002, occ: false });
  ki.box(0.22, 0.003, 0.18, 'idark', { at: [0.36, 0.002, 0.28], color: 0x2a3440, r: 0.002, occ: false });
  d.box(0.06, 0.022, 0.1, 'idark', { at: [0.36, 0.012, 0.28], color: 0x26282b, r: 0.012, occ: false });
  // cables from the back of the housing down behind the foot to the grommet
  for (const [ox, c] of [[-0.06, 0x111214], [0.04, 0x2a2c30]]) d.add(tube([[ox, 0.36, -0.04], [ox, 0.2, -0.12], [ox * 1.4, 0.02, -0.2], [ox * 2, 0.004, -0.26]], 0.006, { radial: 5, curve: true, samples: 8 }), 'idark', { color: c, occ: false });
  ki.pop();
  items.push([x, y + 0.4, z]);
  if (rnd() < 0.55) { const [wx, wz] = toW(x, z, ry, 0.2, 0.019); labels.push(['note' + Math.floor(rnd() * 3), 0.07, [wx, y + 0.53, wz], ry]); }
  const [tx, tz] = toW(x, z, ry, -0.22, 0.016); labels.push(['tag' + Math.floor(rnd() * 3), 0.07, [tx, y + 0.262, tz], ry]);
}

export function instrument(ki, d, x, y, z, dir, rnd, labels) {
  const ry = dir > 0 ? 0 : Math.PI, w = 0.38 + rnd() * 0.12, h = 0.16 + rnd() * 0.1, dp = 0.32, col = jit(0x9aa2a6, rnd, 0.12);
  ki.push(x, y, z, ry);
  for (const e of [-1, 1]) d.box(0.04, 0.012, 0.04, 'idark', { at: [e * (w / 2 - 0.04), 0.006, dp / 2 - 0.04], color: PLASTIC, r: 0.004, occ: false }); // feet
  ki.box(w, h, dp, 'isteel', { at: [0, h / 2 + 0.012, 0], color: col, r: 0.012 });
  ki.box(w - 0.02, h - 0.02, 0.012, 'idark', { at: [0, h / 2 + 0.012, dp / 2 + 0.002], color: 0x2a2d31, r: 0.004 }); // front panel frame
  ki.box(w - 0.05, h - 0.05, 0.01, 'isteel', { at: [0, h / 2 + 0.012, dp / 2 + 0.006], color: shade(col, 0.82), r: 0.004 });
  ki.box(w * 0.38, h * 0.42, 0.006, 'screen', { at: [-w * 0.2, h * 0.58, dp / 2 + 0.012], occ: false });
  for (let i = 0; i < 4; i++) { d.cyl(0.013, 0.02, 'idark', { at: [w * 0.08 + (i % 2) * 0.08, h * (0.32 + 0.34 * (i >> 1)), dp / 2 + 0.02], rot: [Math.PI / 2, 0, 0], seg: 10, color: 0x161719, occ: false }); }
  d.box(0.03, 0.015, 0.01, 'idark', { at: [w * 0.38, h * 0.3, dp / 2 + 0.014], color: 0xb02418, r: 0.003, occ: false }); // red power switch
  for (let i = 0; i < 6; i++) d.box(0.006, h * 0.5, 0.004, 'idark', { at: [w / 2 + 0.002, h * 0.55, -dp * 0.3 + i * 0.03], rot: [0, Math.PI / 2, 0], color: 0x2a2c30, r: 0, occ: false }); // side vents
  for (const e of [-1, 1]) d.add(tube([[e * (w / 2 + 0.01), h * 0.75, dp / 2 - 0.02], [e * (w / 2 + 0.03), h * 0.75, dp / 2 - 0.06], [e * (w / 2 + 0.03), h * 0.75, dp / 2 - 0.16], [e * (w / 2 + 0.01), h * 0.75, dp / 2 - 0.2]], 0.007, { radial: 5 }), 'isteel', { color: 0x8a8e92, occ: false });
  d.add(tube([[0, 0.05, -dp / 2], [0.02, 0.02, -dp / 2 - 0.08], [0.06, 0.003, -dp / 2 - 0.14]], 0.006, { radial: 5, curve: true, samples: 6 }), 'idark', { color: 0x111214, occ: false });
  ki.pop();
  const [lx, lz] = toW(x, z, ry, w * 0.22, dp / 2 + 0.014);
  labels.push([rnd() < 0.5 ? 'haz' + Math.floor(rnd() * 3) : 'tag' + Math.floor(rnd() * 3), 0.07, [lx, y + h * 0.8 + 0.012, lz], ry]);
}

/** a scatter of papers + a clipboard + pens on the bench top */
export function papers(ki, d, x, y, z, dir, rnd) {
  const n = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) ki.box(0.21, 0.0015, 0.297, 'iface', { at: [x + (rnd() - 0.5) * 0.12, y + 0.001 + i * 0.0016, z + (rnd() - 0.5) * 0.08], rot: [0, (rnd() - 0.5) * 0.6, 0], color: PAPER[Math.floor(rnd() * 4)], r: 0, occ: false });
  if (rnd() < 0.6) { // clipboard
    const cx = x + 0.28, ry = (rnd() - 0.5) * 0.4;
    ki.push(cx, y, z, ry);
    ki.box(0.23, 0.006, 0.32, 'idark', { at: [0, 0.003, 0], color: 0x6a4e30, r: 0.004 });
    ki.box(0.2, 0.002, 0.28, 'iface', { at: [0, 0.007, 0.01], color: PAPER[0], r: 0, occ: false });
    d.box(0.1, 0.012, 0.03, 'isteel', { at: [0, 0.012, -0.145], color: 0xb8bcc0, r: 0.004, occ: false });
    for (let l = 0; l < 6; l++) d.box(0.15 - (l % 3) * 0.03, 0.001, 0.004, 'idark', { at: [-0.01, 0.0085, -0.09 + l * 0.035], color: 0x3a4a6a, r: 0, occ: false });
    ki.pop();
  }
  d.cyl(0.004, 0.14, 'idark', { at: [x - 0.12, y + 0.004, z + dir * 0.1], rot: [0, 0.4, Math.PI / 2], seg: 6, color: 0x1a3a8a, occ: false });
}

/** sample jars (screw caps) and a sharps box */
export function jars(ki, d, x, y, z, rnd, labels, ry) {
  const n = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const r = 0.025 + rnd() * 0.02, h = 0.06 + rnd() * 0.07, jx = x + (i % 3) * 0.075 + (rnd() - 0.5) * 0.02, jz = z + Math.floor(i / 3) * 0.08;
    ki.add(lathe([[0, 0], [r, 0], [r * 1.02, h * 0.1], [r, h * 0.85], [r * 0.85, h], [0, h]], { seg: 12, crease: 40 }), 'isteel', { at: [jx, y, jz], color: jit([0xc8d4dc, 0xb8a888, 0xd8dcd0][i % 3], rnd, 0.06), occ: false });
    ki.cyl(r * 0.88, 0.018, 'idark', { at: [jx, y + h + 0.009, jz], seg: 12, color: [0x1a4a8a, 0xb02418, 0xe8e2d4, 0x2a6a3a][Math.floor(rnd() * 4)], occ: false });
  }
  if (rnd() < 0.5) { ki.box(0.14, 0.18, 0.12, 'idark', { at: [x + 0.32, y + 0.09, z], color: 0xd8b41c, r: 0.012 }); ki.box(0.15, 0.025, 0.13, 'idark', { at: [x + 0.32, y + 0.19, z], color: 0xb02418, r: 0.008 }); const s = Math.sign(Math.cos(ry)) || 1; labels.push(['haz0', 0.08, [x + 0.32, y + 0.1, z + s * 0.062], ry]); }
}

/** a sagging loom loop hanging out of a cable tray (world coords): from tray at (x0..x1) at height y, plane z */
export function trayLoop(d, x0, x1, y, z, sag, color) {
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([x0 + (x1 - x0) * t, y - sag * 4 * t * (1 - t), z + Math.sin(t * Math.PI) * 0.03]); }
  d.add(tube(pts, 0.009, { radial: 5 }), 'idark', { color, occ: false });
}
