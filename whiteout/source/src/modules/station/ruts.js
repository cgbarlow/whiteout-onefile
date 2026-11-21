// Snowcat ruts on the snow (wear decal atlas): three track canvases with an irregular grouser phase (the cleat
// spacing drifts with noise so no two metres match), compressed blue troughs, a dark shadowed wall on the sun-away
// side of each rut and a bright ploughed lip on the other (reads as depth at the 7° sun), wind-fill bands that
// half-bury the ruts; plus two soft drift-fill patches laid over the run. trackRun() lays a polyline with per-
// segment variant, width / length / overlap / lateral jitter and drift patches, so the run never visibly repeats.
const cl = (v) => Math.max(0, Math.min(1, v));
function hashN(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vn(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hashN(xi, yi, s), b = hashN(xi + 1, yi, s), c = hashN(xi, yi + 1, s), d = hashN(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vn(x, y, s) * 0.5 + vn(x * 2.1, y * 2.1, s + 1) * 0.3 + vn(x * 4.3, y * 4.3, s + 2) * 0.2;

function paint(w, h, fn) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true }), id = g.createImageData(w, h), p = id.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x / w, y / h), o = (y * w + x) * 4;
    p[o] = c[0]; p[o + 1] = c[1]; p[o + 2] = c[2]; p[o + 3] = Math.round(cl(c[3]) * 255);
  }
  g.putImageData(id, 0, 0); return cv;
}
const _c = [0, 0, 0, 0];
const rgba = (r, g, b, a) => { _c[0] = r; _c[1] = g; _c[2] = b; _c[3] = a; return _c; };

/** one track variant: u across (two 0.9 m belts at 0.22 / 0.78), v along the run (fades at both ends) */
export function rutCanvas(seed, gain = 1) {
  return paint(128, 512, (u, v) => {
    const ends = cl(1 - Math.abs(v - 0.5) * 2.0) ** 0.35;
    const fill = cl((fbm(u * 2.5, v * 5.0, seed + 5) - 0.42) * 3.2);           // wind-fill burying the ruts
    let best = 9, c0 = 0;
    for (const cc of [0.22, 0.78]) { const dd = Math.abs(u - cc - (vn(v * 6, cc * 9, seed) - 0.5) * 0.02); if (dd < best) { best = dd; c0 = cc; } }
    const side = u - c0; // signed distance across the belt (+ = east / toward the sun-away wall after placement)
    if (best > 0.2) {
      const lip = cl(1 - (best - 0.2) * 22) * (0.55 + 0.45 * fbm(u * 20, v * 40, seed + 3));
      return rgba(244, 247, 252, lip * 0.42 * ends * (1 - fill * 0.7) * gain);
    }
    // grouser cleats: the phase wanders (noise-warped v), cleats chip and break
    const ph = v * 34 + (fbm(v * 3, c0 * 7, seed + 9) - 0.5) * 3.0, f = ph - Math.floor(ph);
    const cleat = f < 0.3 && fbm(u * 30, v * 120, seed + 11) > 0.42;
    const wear = 0.5 + 0.5 * fbm(u * 8, v * 30, seed);
    const wall = cl((Math.abs(side) - 0.13) * 14);                               // rut walls
    const shade = side > 0 ? wall : 0, lit = side < 0 ? wall : 0;
    let a = (cleat ? 0.24 : 0.13) * wear + shade * 0.34;
    a *= ends * (1 - fill * 0.85) * gain;
    if (lit > 0.3) return rgba(236, 240, 248, a * 0.8);
    if (shade > 0.3) return rgba(74, 84, 104, a);
    return cleat ? rgba(98, 110, 132, a) : rgba(148, 160, 182, a);
  });
}

/** a soft drift-fill patch: wind-laid fresh snow spilling over the ruts */
export function fillCanvas(seed) {
  return paint(256, 128, (u, v) => {
    const dx = (u - 0.5) * 2, dy = (v - 0.5) * 2, r = Math.hypot(dx, dy * 1.4), n = fbm(u * 6, v * 4, seed);
    const a = cl((1 - r + (n - 0.5) * 0.8) * 1.8) * (0.7 + 0.3 * fbm(u * 40, v * 14, seed + 2));
    return rgba(240, 244, 250, a * 0.75);
  });
}

/** lay a snowcat run along pts [[x, z], ...] through the wear decal builder W */
export function trackRun(W, pts, rnd) {
  let lift = 0.022;
  const fills = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
    let t = 0;
    while (t < L - 0.4) {
      const len = 3.4 + rnd() * 2.2, mid = Math.min(L, t + len * 0.5), wob = (rnd() - 0.5) * 0.18;
      const x = a[0] + (b[0] - a[0]) * (mid / L) + Math.cos(ry) * wob, z = a[1] + (b[1] - a[1]) * (mid / L) - Math.sin(ry) * wob;
      W.ground('ruts' + Math.floor(rnd() * 3), 2.15 + rnd() * 0.35, len, x, z, ry + (rnd() - 0.5) * 0.04, lift);
      lift += 0.0004;
      t += len * (0.62 + rnd() * 0.2);
    }
    // drift-fill patches across the run (fresh snow laid by the wind, partly burying the ruts)
    for (let j = 0; j < Math.ceil(L / 6); j++) {
      const s = rnd() * L, x = a[0] + (b[0] - a[0]) * (s / L), z = a[1] + (b[1] - a[1]) * (s / L);
      fills.push(['fill' + (j % 2), 1.4 + rnd() * 2.0, 0.8 + rnd() * 1.2, x + (rnd() - 0.5) * 1.2, z + (rnd() - 0.5) * 1.2, ry + 1.2 + rnd() * 0.6, 0.034]);
    }
  }
  for (const f of fills) W.ground(...f); // after every rut, so the fresh snow draws over them
}
