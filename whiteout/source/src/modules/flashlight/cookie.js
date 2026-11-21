// Procedural lens cookie for the hero torch (load-time only). One 256² sRGB-free (linear) canvas texture shared
// by the SpotLight .map (surface pattern) and the volumetric beam (so the haze carries the same rings).
// Radial profile of a real reflector torch: a hot LED core with a faint die dip, the reflector's bright ring,
// a dark gap, the wide soft spill with a faint outer ring, then a soft rim. Smudges: low-frequency grime on the
// lens (multiplicative, 0.8-1.05), two finger-wipe streaks and a scratch. A warm/cool fringe is baked into RGB.
//   makeCookie(size = 256) → CanvasTexture (linear, clamp, mipmapped)
import { CanvasTexture, ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter, NoColorSpace } from 'three';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));

function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => 0.55 * vnoise(x, y) + 0.3 * vnoise(x * 2.1 + 17, y * 2.1 + 3) + 0.15 * vnoise(x * 4.3 + 5, y * 4.3 + 29);

// radial intensity, r = 0 centre .. 1 = cone edge (texture inscribed circle)
export function cookieProfile(r) {
  const core = 1.0 - 0.1 * bump(r, 0, 0.025);                       // LED die dip in the very centre
  const hot = core * (1 - sstep(0.02, 0.15, r));                     // tight hot core
  const halo = 0.16 * (1 - sstep(0.1, 0.3, r));                      // soft falloff shoulder around the core
  const ring = 0.13 * bump(r, 0.24, 0.035);                          // reflector's bright ring
  const gap = 1 - 0.35 * bump(r, 0.32, 0.04);                        // dark gap after the ring
  const spill = 0.065 * (1 - sstep(0.16, 0.95, r)) + 0.015 * bump(r, 0.62, 0.05); // wide soft spill + faint outer ring
  const rim = 1 - sstep(0.55, 0.99, r);                                // long soft rim: no hard pool edge on the snow
  return Math.max(0, (hot + halo + ring + spill) * gap * rim);
}

export function makeCookie(size = 256) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const img = g.createImageData(size, size), D = img.data, c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c, dy = (y - c) / c, r = Math.hypot(dx, dy);
      let v = cookieProfile(r);
      // lens grime: broad blotches, stronger toward the edge where fingers wipe
      const n = fbm(dx * 3.2 + 4.1, dy * 3.2 + 1.7);
      v *= 0.8 + 0.25 * n;
      // two diagonal finger-wipe streaks (brighter clean band beside a darker smear) and one fine scratch
      const s1 = dx * 0.8 + dy * 0.6 - 0.18, s2 = dx * -0.55 + dy * 0.83 + 0.42;
      v *= 1 - 0.13 * bump(s1, 0, 0.03) + 0.05 * bump(s1, 0.06, 0.03);
      v *= 1 - 0.09 * bump(s2, 0, 0.05);
      const sc = dx * 0.2 - dy * 0.98 + 0.3;
      v *= 1 - 0.18 * bump(sc, 0, 0.004) * sstep(-0.6, -0.1, dx) * (1 - sstep(0.2, 0.5, dx));
      v = Math.min(1, Math.max(0, v));
      // colour fringe: core slightly cool-white, reflector ring/spill a touch warm (phosphor + reflector tint)
      const warm = sstep(0.2, 0.45, r) * 0.07, cool = (1 - sstep(0.05, 0.2, r)) * 0.03;
      const i = (y * size + x) * 4;
      const dz = (hash2(x + 911, y + 37) - 0.5) / 255; // 1-LSB dither: no 8-bit ring banding on near walls
      D[i] = 255 * Math.min(1, Math.max(0, v * (1 + warm - cool * 0.5) + dz));
      D[i + 1] = 255 * Math.min(1, Math.max(0, v * (1 + warm * 0.35) + dz));
      D[i + 2] = 255 * Math.min(1, Math.max(0, v * (1 - warm * 0.9 + cool) + dz));
      D[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(cv);
  t.colorSpace = NoColorSpace; // the profile is authored as linear intensity
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter;
  t.generateMipmaps = true;
  return t;
}
