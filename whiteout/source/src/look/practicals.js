// WHITEOUT look: practical-light dressing on top of the modules' own lamps (look-director owned, wired by main.js).
//   failingTube  the lab fluorescent is steady (static views never change frame to frame) and stutters only in
//                rare, readable bursts every 9-17 s; no bursts under ?shot=1 (critic stills / shimmer pairs).
//   shedLamps    a caged wall lamp under each generator lean-to (real light for A and C — hero poses 3 and 5 —
//                fake pool for B) so the covered space has lit context instead of a crushed void.
//   groundPools  window/ground light pools re-seated on the snow surface (terrain heightAt), so drifts never
//                swallow them; snow albedo and a window-spill gain so the warm pools read at dusk exposure.
// Zero allocation per frame: every scratch is created here at boot.
import { LAYOUT } from '../contracts.js';

// burst pattern (seconds from burst start → off/dim segments): a tube that catches, drops, buzzes and recovers
const BURST = [[0.0, 0.06, 0.05], [0.11, 0.16, 0.25], [0.24, 0.27, 0.0], [0.42, 0.62, 0.55], [0.7, 0.74, 0.1]];
const BURST_LEN = 0.8;
const WINDOW_SPILL = 2.6; // fake-pool gain for window glows (station adds them at 14 cd)

export function failingTube(G, item, tubeMat) {
  if (!item) return { update() {} };
  const base = item.base, emisBase = item.emisBase, tubeBase = tubeMat ? tubeMat.emissiveIntensity : 0;
  item.flicker = 0; // lights.js skips it; this driver owns the intensity from now on
  const shot = !!G.params.get('shot');
  const rnd = G.rng(9901);
  let next = 6 + rnd() * 6, start = -1, last = 1;
  const apply = (f) => {
    if (f === last) return;
    last = f;
    if (item.light) item.light.intensity = base * f;
    if (item.emisMat) item.emisMat.emissiveIntensity = emisBase * f;
    if (tubeMat) tubeMat.emissiveIntensity = tubeBase * (0.15 + 0.85 * f);
  };
  function update(dt, t) {
    if (shot) { apply(1); return; }
    if (start < 0 && t >= next) start = t;
    let f = 1;
    if (start >= 0) {
      const u = t - start;
      if (u > BURST_LEN) { start = -1; next = t + 9 + rnd() * 8; }
      else for (let i = 0; i < BURST.length; i++) if (u >= BURST[i][0] && u < BURST[i][1]) f = BURST[i][2];
    }
    apply(f);
  }
  G.on('update', update);
  return { update };
}

export function shedLamps(G, lights) {
  const out = [];
  if (!lights?.add) return out;
  // A (pose 3) and C (pose 5) get the real lights; B (off-pose) is a fake pool
  const order = ['A', 'C', 'B'];
  for (const id of order) {
    const g = LAYOUT.generators.find((x) => x.id === id);
    if (!g) continue;
    const [cx, cz] = g.c;
    out.push(lights.add({
      position: [cx + 1.35, 2.42, cz - 1.82], kind: 'wall', color: [1.0, 0.74, 0.48], intensity: 13, range: 8,
      real: id !== 'B', pool: id === 'B' ? 'always' : false, poolRadius: 2.6, albedo: 0.5, halo: true, haloStrength: 0.35,
      groundY: 0.12,
    }));
  }
  return out;
}

export function groundPools(lights, terrain) {
  if (!lights?.items || !terrain?.heightAt) return 0;
  let n = 0;
  for (const it of lights.items) {
    if (!it.pool) continue;
    let mesh = null;
    lights.root.traverse((m) => { if (!mesh && m.isMesh && m.material === it.pool) mesh = m; });
    if (!mesh) continue;
    const x = mesh.position.x, z = mesh.position.z, r = mesh.scale.x * 0.25;
    let h = terrain.heightAt(x, z);
    for (let a = 0; a < 6; a++) h = Math.max(h, terrain.heightAt(x + Math.cos(a * 1.047) * r, z + Math.sin(a * 1.047) * r));
    mesh.position.y = Math.max(mesh.position.y, h + 0.015);
    // the pools land on snow (albedo ~0.8, not the 0.35 default); window-only glows (no real light) are lifted so a
    // lit window visibly spills warm light onto the snow under it at dusk exposure
    const u = it.pool.uniforms;
    if (u.uAlbedo) u.uAlbedo.value = 0.8;
    if (!it.light && u.uColor) u.uColor.value.multiplyScalar(WINDOW_SPILL);
    n++;
  }
  return n;
}
