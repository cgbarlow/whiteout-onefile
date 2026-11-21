// Snowcat (hero prop parked in the vehicle shed, seen through the roller door at spawn): twin rubber track
// assemblies (belt loop with grouser cleats, rear drive sprocket, 5 dual road wheels on a bogie beam, front
// idler, packed snow), a chassis frame between the tracks, enamel hull with track fenders, an engine hood with
// grille and lamps, a pillared cab (rounded corner posts, inset dark tinted glazing in rubber gaskets, wipers,
// roof light bar, mirrors, handrail, steps) and a curved plough blade on push arms + a pivot frame with two
// hydraulic rams. Keys: gloss (enamel), paint (blade), steel, dark, tint (glazing), snow. Local +x = nose.
import { tube, lathe, extrudeBevel } from '../../cookbook/geo/kit.js';
import { C, shade, jit } from './parts.js';

const OR = 0xc4421a, OR_D = 0x8e2e12, TRACK = 0x17181a, RUB = 0x1c1d1f, CHAS = 0x2a2c2f, SNOW = 0xe6ebf1;

/** closed belt loop (x, y) in the track plane: bottom run, front idler arc, top run, rear sprocket arc */
function beltPath() {
  const F = [1.5, 0.385, 0.36], R = [-1.5, 0.425, 0.4], pts = [];
  for (let i = 0; i < 15; i++) pts.push([R[0] + (F[0] - R[0]) * (i / 15), 0.025]);
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + Math.PI * (i / 10); pts.push([F[0] + Math.cos(a) * F[2], F[1] + Math.sin(a) * F[2]]); }
  for (let i = 1; i < 14; i++) { const t = i / 14; pts.push([F[0] + (R[0] - F[0]) * t, F[1] + F[2] + (R[1] + R[2] - F[1] - F[2]) * t - 0.03 * Math.sin(t * Math.PI)]); }
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + Math.PI * (i / 10); pts.push([R[0] + Math.cos(a) * R[2], R[1] + Math.sin(a) * R[2]]); }
  return { pts, F, R };
}

function track(k, d, tz, s, rnd) {
  const { pts, F, R } = beltPath(), n = pts.length, W = 0.62;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    k.push((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, tz, 0, 0, ang);
    k.box(L + 0.012, 0.045, W, 'dark', { color: TRACK, r: 0.008, occ: false });                 // rubber belt
    d.box(Math.min(0.07, L * 0.55), 0.035, W + 0.02, 'dark', { at: [0, -0.035, 0], color: 0x232427, r: 0.006, occ: false }); // grouser cleat
    if (i % 2 === 0) for (const e of [-1, 1]) d.box(0.05, 0.02, 0.06, 'steel', { at: [0, 0.03, e * 0.12], color: 0x55595e, r: 0.005, occ: false }); // guide horns
    k.pop();
  }
  // bogie beam + 5 dual road wheels riding on the inner bottom run
  k.box(3.0, 0.14, 0.12, 'steel', { at: [0, 0.42, tz - s * 0.0], color: CHAS, r: 0.02 });
  for (let i = 0; i < 5; i++) {
    const x = -1.0 + i * 0.5, y = 0.255;
    for (const e of [-0.17, 0.17]) { k.push(x, y, tz + e, 0, Math.PI / 2); k.add(lathe([[0.12, -0.075], [0.19, -0.075], [0.205, -0.05], [0.205, 0.05], [0.19, 0.075], [0.12, 0.075]], { seg: 22, crease: 40 }), 'dark', { color: RUB }); k.cyl(0.125, 0.13, 'steel', { seg: 16, color: 0x6a6e72 }); k.pop(); }
    k.push(x, y, tz, 0, Math.PI / 2); k.cyl(0.06, 0.5, 'steel', { seg: 10, color: 0x404448 }); k.pop();                 // axle
    k.bar([x, y, tz], [x + 0.18, 0.42, tz], 0.08, 0.08, 'steel', { color: CHAS, r: 0.01 });                               // swing arm
    for (let b = 0; b < 5; b++) { const an = b * 1.2566; d.cyl(0.012, 0.02, 'steel', { at: [x + Math.cos(an) * 0.08, y + Math.sin(an) * 0.08, tz + s * 0.25], rot: [Math.PI / 2, 0, 0], seg: 6, color: 0x2a2c2e, occ: false }); }
  }
  // front idler (dual rim) and rear drive sprocket (toothed discs)
  for (const e of [-0.17, 0.17]) { k.push(F[0], F[1], tz + e, 0, Math.PI / 2); k.add(lathe([[0.1, -0.07], [0.31, -0.07], [0.32, 0], [0.31, 0.07], [0.1, 0.07]], { seg: 24, crease: 40 }), 'dark', { color: RUB }); k.pop(); }
  k.push(F[0], F[1], tz, 0, Math.PI / 2); k.cyl(0.12, 0.5, 'steel', { seg: 14, color: 0x5a5e62 }); k.pop();
  for (const e of [-0.12, 0.12]) {
    k.push(R[0], R[1], tz + e, 0, Math.PI / 2); k.cyl(0.33, 0.04, 'steel', { seg: 24, color: 0x4a4e52 }); k.pop();
    for (let t = 0; t < 14; t++) { const an = t * (Math.PI * 2 / 14); k.push(R[0] + Math.cos(an) * 0.34, R[1] + Math.sin(an) * 0.34, tz + e, 0, 0, an); k.box(0.07, 0.05, 0.04, 'steel', { color: 0x4a4e52, r: 0.008, occ: false }); k.pop(); }
  }
  k.push(R[0], R[1], tz, 0, Math.PI / 2); k.cyl(0.16, 0.42, 'steel', { seg: 16, color: 0x3a3e42 }); k.pop();
  // snow packed into the belt: lumps on the top run and between the lower wheels, a crust on the sprocket
  for (let i = 0; i < 9; i++) {
    const x = -1.25 + i * 0.32 + (rnd() - 0.5) * 0.1, y = 0.79 + (x < 0 ? 0.02 : -0.01) * (1 - Math.abs(x) / 1.5);
    k.add(lathe([[0, 0], [0.06 + rnd() * 0.05, 0], [0.04, 0.03 + rnd() * 0.03], [0, 0.045]], { seg: 8, crease: 80 }), 'snow', { at: [x, y + 0.02, tz + (rnd() - 0.5) * 0.4], color: SNOW, occ: false });
  }
  for (let i = 0; i < 4; i++) k.box(0.28, 0.08, 0.5, 'snow', { at: [-0.75 + i * 0.5, 0.09, tz], color: SNOW, r: 0.035, occ: false });
  k.box(0.22, 0.12, 0.56, 'snow', { at: [F[0] + 0.25, 0.1, tz], rot: [0, 0, 0.6], color: SNOW, r: 0.05, occ: false });
}

/** inset glazed pane with a rubber gasket, centred at (x, y, z) in a plane facing ±x (axis 'x') or ±z (axis 'z') */
function pane(k, d, x, y, z, w, h, axis) {
  const rot = axis === 'x' ? [0, Math.PI / 2, 0] : [0, 0, 0];
  k.box(w, h, 0.012, 'tint', { at: [x, y, z], rot, r: 0, occ: false });
  const g = 0.03;
  for (const [gw, gh, ox, oy] of [[w + g, g, 0, h / 2], [w + g, g, 0, -h / 2], [g, h, w / 2, 0], [g, h, -w / 2, 0]]) {
    const at = axis === 'x' ? [x, y + oy, z + ox] : [x + ox, y + oy, z];
    d.box(gw, gh, 0.03, 'dark', { at, rot, color: 0x111214, r: 0.006, occ: false });
  }
}

export function snowcat(k, d, x, z, rnd) {
  k.push(x, 0.1, z, Math.PI); // nose toward -x (door)
  for (const s of [-1, 1]) track(k, d, s * 1.0, s, rnd);
  // chassis frame between the tracks: two rails, cross members, belly pan
  for (const e of [-0.52, 0.52]) k.box(3.4, 0.16, 0.12, 'steel', { at: [0.05, 0.56, e], color: CHAS, r: 0.015 });
  for (let i = 0; i < 4; i++) k.box(0.1, 0.12, 1.94, 'steel', { at: [-1.35 + i * 0.9, 0.5, 0], color: CHAS, r: 0.012 });
  k.box(3.0, 0.05, 1.0, 'steel', { at: [0.1, 0.44, 0], color: shade(CHAS, 0.8), r: 0.01 });
  // hull tub + track fenders (enamel, bevelled), mud-dark lower band
  k.box(3.7, 0.5, 1.36, 'gloss', { at: [0.05, 0.9, 0], color: OR, r: 0.05 });
  k.box(3.72, 0.1, 1.38, 'gloss', { at: [0.05, 0.69, 0], color: shade(OR_D, 0.55), r: 0.03 });
  for (const s of [-1, 1]) {
    k.box(3.5, 0.06, 0.74, 'gloss', { at: [0.0, 0.95, s * 1.0], color: OR, r: 0.025 });
    k.box(3.5, 0.14, 0.04, 'gloss', { at: [0.0, 0.89, s * 1.36], color: OR_D, r: 0.015 });
    k.push(1.9, 0.82, s * 1.0, 0, 0, -0.55); k.box(0.42, 0.05, 0.74, 'gloss', { color: OR, r: 0.02 }); k.pop(); // nose wrap
  }
  // engine hood: rounded block, louvres, grille, twin headlamps, exhaust stack with a rain cap
  k.box(1.35, 0.55, 1.5, 'gloss', { at: [1.22, 1.4, 0], color: OR, r: 0.08 });
  k.box(0.04, 0.38, 1.1, 'dark', { at: [1.9, 1.36, 0], color: 0x15161a, r: 0.01 });
  for (let i = 0; i < 6; i++) d.box(0.03, 0.02, 1.08, 'steel', { at: [1.925, 1.2 + i * 0.065, 0], color: 0x3a3c40, r: 0.004, occ: false });
  for (const s of [-1, 1]) {
    k.box(0.08, 0.16, 0.22, 'dark', { at: [1.88, 1.45, s * 0.64], color: 0x1b1c1e, r: 0.02 });
    k.box(0.02, 0.12, 0.18, 'tint', { at: [1.925, 1.45, s * 0.64], r: 0.01, occ: false });
    for (let j = 0; j < 4; j++) d.box(0.25, 0.012, 0.03, 'dark', { at: [1.25, 1.68, s * (0.3 + j * 0.09)], color: 0x2a1a12, r: 0.004, occ: false });
  }
  k.add(tube([[0.7, 1.6, -0.62], [0.7, 2.35, -0.62], [0.78, 2.45, -0.62]], 0.055, { radial: 10, curve: true, samples: 8 }), 'steel', { color: 0x4a4d50, occ: false });
  k.cyl(0.08, 0.05, 'steel', { at: [0.8, 2.47, -0.62], rot: [0, 0, -0.3], seg: 10, color: 0x2c2e30 });
  // cab: lower body, corner pillars (rounded), B/rear posts, roof with drip rail; inset tinted glazing in gaskets
  const cx0 = -1.32, cx1 = 0.54, cw = 0.95, yb = 0.98, yw = 1.6, yr = 2.42;
  k.box(cx1 - cx0, yw - yb, 2 * cw, 'gloss', { at: [(cx0 + cx1) / 2, (yb + yw) / 2, 0], color: OR, r: 0.05 });
  for (const px of [cx0, cx1]) for (const s of [-1, 1]) k.box(0.1, yr - yw, 0.1, 'gloss', { at: [px + (px < 0 ? 0.04 : -0.04), (yw + yr) / 2, s * (cw - 0.04)], color: OR, r: 0.035 });
  for (const s of [-1, 1]) k.box(0.08, yr - yw, 0.08, 'gloss', { at: [-0.32, (yw + yr) / 2, s * (cw - 0.04)], color: OR, r: 0.03 });
  for (const s of [-1, 1]) k.box(cx1 - cx0, 0.07, 0.08, 'gloss', { at: [(cx0 + cx1) / 2, yw + 0.02, s * (cw - 0.04)], color: OR_D, r: 0.02 }); // belt line
  k.box(cx1 - cx0 + 0.12, 0.12, 2 * cw + 0.12, 'gloss', { at: [(cx0 + cx1) / 2, yr + 0.06, 0], color: 0xd8d4cc, r: 0.05 });
  k.box(cx1 - cx0 + 0.04, 0.03, 2 * cw + 0.04, 'dark', { at: [(cx0 + cx1) / 2, yr + 0.005, 0], color: 0x1b1c1e, r: 0.01 });
  const gh = yr - yw - 0.1, gy0 = (yw + yr) / 2 + 0.02;
  for (const s of [-1, 1]) { pane(k, d, (cx0 + 0.08 - 0.32) / 2 - 0.02, gy0, s * (cw - 0.035), 0.82, gh, 'z'); pane(k, d, (-0.32 + cx1 - 0.08) / 2 + 0.02, gy0, s * (cw - 0.035), 0.66, gh, 'z'); }
  pane(k, d, cx1 - 0.03, gy0, 0, 2 * cw - 0.2, gh, 'x');           // windscreen
  pane(k, d, cx0 + 0.03, gy0, 0, 2 * cw - 0.2, gh, 'x');           // rear window
  k.box(0.06, gh, 0.05, 'dark', { at: [cx1 - 0.03, gy0, 0], color: 0x111214, r: 0.01 }); // centre mullion
  // wipers parked at the screen foot, pivot bosses
  for (const s of [-0.42, 0.42]) { d.cyl(0.02, 0.04, 'dark', { at: [cx1 + 0.0, yw + 0.1, s], rot: [0, 0, Math.PI / 2], seg: 8, color: 0x111214, occ: false }); k.push(cx1 + 0.015, yw + 0.12, s, 0, 0.15 * Math.sign(s)); d.box(0.012, 0.02, 0.62, 'dark', { at: [0, 0.0, -Math.sign(s) * 0.3], color: 0x101113, r: 0.004, occ: false }); k.pop(); }
  // doors: seams, handle, step plates hung off the fender, grab rail up the B-post
  for (const s of [-1, 1]) {
    const zf = s * (cw + 0.003);
    for (const [u, y0, y1] of [[-1.16, 1.02, 2.36], [-0.36, 1.02, 2.36]]) d.box(0.012, y1 - y0, 0.008, 'dark', { at: [u, (y0 + y1) / 2, zf], color: 0x2a1610, r: 0, occ: false });
    d.box(0.8, 0.012, 0.008, 'dark', { at: [-0.76, 1.02, zf], color: 0x2a1610, r: 0, occ: false });
    d.box(0.14, 0.035, 0.04, 'steel', { at: [-0.5, 1.5, zf + s * 0.02], color: 0x9aa0a4, r: 0.01, occ: false });
    for (const y of [0.6, 0.32]) { k.box(0.42, 0.03, 0.2, 'steel', { at: [-0.75, y + 0.1, s * 1.42], color: 0x6a6e72, r: 0.006 }); for (let q = 0; q < 5; q++) d.box(0.4, 0.008, 0.012, 'dark', { at: [-0.75, y + 0.118, s * (1.35 + q * 0.035)], color: 0x2a2c2e, r: 0, occ: false }); }
    for (const e of [-0.95, -0.55]) d.rod([e, 0.38, s * 1.42], [e, 0.98, s * 1.38], 0.014, 'steel', { color: 0x5a5e62 });
    k.add(tube([[-0.24, 1.25, zf + s * 0.06], [-0.24, 1.3, zf + s * 0.09], [-0.24, 2.2, zf + s * 0.09], [-0.24, 2.25, zf + s * 0.06]], 0.016, { radial: 8 }), 'steel', { color: C.yellow, occ: false });
    // mirror on a tubular arm off the front pillar
    d.add(tube([[cx1 - 0.02, 2.05, s * cw], [cx1 + 0.1, 2.08, s * (cw + 0.22)], [cx1 + 0.1, 2.12, s * (cw + 0.3)]], 0.014, { radial: 6 }), 'dark', { color: 0x1b1c1e, occ: false });
    k.box(0.06, 0.26, 0.16, 'dark', { at: [cx1 + 0.12, 2.04, s * (cw + 0.36)], color: 0x1b1c1e, r: 0.02 });
    k.box(0.01, 0.22, 0.12, 'tint', { at: [cx1 + 0.085, 2.04, s * (cw + 0.36)], r: 0, occ: false });
  }
  // roof: amber light bar on feet, two work lamps, antenna, roof rails
  k.box(0.22, 0.09, 1.3, 'dark', { at: [-0.25, yr + 0.18, 0], color: 0x18191b, r: 0.02 });
  for (let i = 0; i < 4; i++) k.box(0.18, 0.075, 0.24, 'paint', { at: [-0.25, yr + 0.245, -0.45 + i * 0.3], color: i % 3 ? 0xd88a1a : 0xc85a14, r: 0.025 });
  for (const s of [-1, 1]) { k.box(0.16, 0.12, 0.2, 'dark', { at: [cx1 - 0.1, yr + 0.2, s * 0.7], color: 0x18191b, r: 0.02 }); k.box(0.01, 0.09, 0.16, 'tint', { at: [cx1 - 0.015, yr + 0.2, s * 0.7], r: 0, occ: false }); }
  for (const s of [-1, 1]) d.rod([cx0 + 0.1, yr + 0.14, s * 0.85], [cx1 - 0.2, yr + 0.14, s * 0.85], 0.015, 'steel', { color: 0x8a8e92 });
  d.rod([cx0 + 0.15, yr + 0.12, 0.6], [cx0 + 0.15, yr + 1.0, 0.6], 0.006, 'dark', { color: 0x111111 });
  // plough: pivot frame on the chassis nose, two push arms, two rams, curved mouldboard + cutting edge + end plates
  const bx = 2.42, by = 0.08;
  k.box(0.14, 0.32, 1.3, 'steel', { at: [1.9, 0.55, 0], color: CHAS, r: 0.02 });                     // pivot frame
  for (const e of [-0.55, 0.55]) {
    k.bar([1.9, 0.5, e], [bx - 0.06, by + 0.32, e * 1.25], 0.1, 0.12, 'steel', { color: CHAS, r: 0.015 }); // push arm
    k.push(bx - 0.06, by + 0.32, e * 1.25, 0, Math.PI / 2); k.cyl(0.05, 0.16, 'steel', { seg: 10, color: 0x3a3c3e }); k.pop(); // pin boss
    const r0 = [1.98, 1.02, e * 0.55], r1 = [bx - 0.1, by + 0.78, e * 1.0], m = [(r0[0] * 0.45 + r1[0] * 0.55), (r0[1] * 0.45 + r1[1] * 0.55), (r0[2] * 0.45 + r1[2] * 0.55)];
    k.box(0.12, 0.14, 0.1, 'steel', { at: [1.93, 1.02, e * 0.55], color: CHAS, r: 0.015 });              // ram bracket
    k.add(tube([r0, m], 0.055, { radial: 12 }), 'steel', { color: C.yellow });                          // ram barrel
    k.add(tube([m, r1], 0.028, { radial: 10 }), 'steel', { color: 0xc8ccd0, occ: false });              // chromed rod
    d.add(tube([[r0[0] + 0.05, r0[1] + 0.03, r0[2]], [m[0] - 0.05, m[1] + 0.09, m[2]]], 0.012, { radial: 5, curve: true, samples: 6 }), 'dark', { color: 0x111111, occ: false }); // hose
  }
  const prof = [];
  for (let i = 0; i <= 12; i++) { const y = 0.02 + 0.98 * (i / 12), dy = y - 0.5; prof.push([0.36 - Math.sqrt(0.42 - dy * dy) + 0.29, y]); }
  for (let i = 12; i >= 0; i--) { const p = prof[i]; prof.push([p[0] - 0.045, p[1]]); }
  k.push(bx, by, 0);
  d.add(extrudeBevel(prof, { depth: 3.0, bevel: 0.008 }), 'gloss', { color: jit(0xd09a1c, rnd, 0.05) }); // detail kit: no AO banding along the long extrude strips
  k.box(0.04, 0.13, 3.04, 'steel', { at: [0.2, 0.08, 0], color: 0x3a3c3e, r: 0.006 });                // cutting edge
  k.box(0.08, 0.06, 3.02, 'paint', { at: [0.18, 1.0, 0], color: shade(C.yellow, 0.85), r: 0.015 });     // top lip
  for (const s of [-1, 1]) { k.box(0.34, 0.96, 0.03, 'paint', { at: [0.07, 0.5, s * 1.515], color: shade(C.yellow, 0.92), r: 0.01 }); for (let q = 0; q < 3; q++) k.box(0.05, 0.85, 0.08, 'steel', { at: [-0.04, 0.5, s * (0.5 + q * 0.45)], color: shade(C.yellow, 0.8), r: 0.01 }); }
  for (let q = 0; q < 2; q++) k.box(0.06, 0.08, 2.9, 'steel', { at: [-0.04, 0.3 + q * 0.4, 0], color: shade(C.yellow, 0.75), r: 0.012 }); // back stiffeners
  for (let i = 0; i < 6; i++) k.box(0.22, 0.05 + rnd() * 0.06, 0.4 + rnd() * 0.4, 'snow', { at: [0.18, 0.04, -1.2 + i * 0.48], color: SNOW, r: 0.025, occ: false }); // snow on the edge
  k.pop();
  k.pop();
}
