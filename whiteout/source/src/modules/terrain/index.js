// TERRAIN (ground + boundary + far field).
//   create(G, { mats }) → { group, ground (first mesh), meshes, heightAt(x,z), normalAt(x,z,out), farfield, update }
// The shelf is a rectilinear heightfield (grid.js: 0.5 m over the play area + berm, 4 m at the far edge) whose
// height (height.js) carries wind-stretched dunes, sharp sastrugi (noise.js, mirrored per pixel by snow.js), drifts
// on the windward side of every LAYOUT footprint and lee tongues behind them (footprints.js), exact flats under every
// footprint, dug-out door aprons, a trampled path shed → LAB → generators, and a
// 4-6 m berm with pressure ridges past WORLD bounds. Ice-slab outcrops on the berm (outcrops.js, SDF + surface nets),
// a horizon skirt and 3 far-field ice-ridge rings (backdrop/farfield.js) close the distance in the same fog.
// Loose station props get windward banks, lee hollows/tails and contact darkening (propdrift.js, station colliders);
// long wind-parallel dunes, a metre-scale wind crust and hand-placed whaleback drifts sculpt the open shelf (height.js).
// Faint far silhouettes (farsil.js: antenna clusters, a distant hut window) sit on the skirt in the same fog.
// Draw calls: ground 4 + skirt 1 + outcrops 1 + far silhouettes 2 + far field 3 = 11.
import { Group, Float32BufferAttribute, PlaneGeometry, Matrix4, Vector3 } from 'three';
import { createFarfield, horizonSkirt } from '../../cookbook/backdrop/farfield.js';
import { makeMaterial } from '../../cookbook/materials/library.js';
import { patch, before } from '../../cookbook/engine/patch.js';
import { heightFn, SKIRT_Y, FAR } from './height.js';
import { axis, rectTerrain } from './grid.js';
import { buildOutcrops } from './outcrops.js';
import { patchGroundDetail } from './snow.js';
import { propDriftField } from './propdrift.js';
import { farSilhouettes } from './farsil.js';
import { sampleGrid } from './footprints.js';
import { fbm } from './noise.js';

// far ice ridges: each nearer ring darker and less fogged (layer separation by aerial perspective), cool slate;
// low `rough` = broad ice massifs and long pressure-ridge lines (high values read as spiky alpine peaks)
export const FAR_LAYERS = [
  { kind: 'mountains', radius: 1150, height: 260, base: -30, follow: 0.9, body: [0.25, 0.28, 0.34], top: [0.42, 0.46, 0.54], rim: 0.7, fogScale: 0.33, rough: 0.55, seed: 2 },
  { kind: 'mountains', radius: 650, height: 105, base: -12, follow: 0.5, body: [0.17, 0.20, 0.25], top: [0.33, 0.37, 0.44], rim: 0.6, fogScale: 0.37, rough: 0.9, seed: 7 },
  { kind: 'mountains', radius: 300, height: 30, base: -2, follow: 0.0, body: [0.12, 0.14, 0.18], top: [0.28, 0.31, 0.37], rim: 0.8, fogScale: 0.44, rough: 1.5, seed: 11 },
];

// the station's ground cable to the shed (station/index.js: x = 30.2 + 1.12 i, z = 6.6 + 0.3 sin 0.7 i, seated on the
// pure shelf function) is half-buried in the mesh: a 4-7 cm rounded snow cover with gaps, so it reads as a cable in
// the snow, never as a dark crease line drawn over the drift silhouette (r1 D10)
function cableCover(x, z) {
  if (x < 29.6 || x > 46.6 || z < 5.6 || z > 7.6) return 0;
  const f = (x - 30.2) / 1.12, i = Math.max(0, Math.min(13, Math.floor(f))), t = Math.max(0, Math.min(1, f - i));
  const zc = 6.6 + Math.sin(i * 0.7) * 0.3 + (Math.sin((i + 1) * 0.7) - Math.sin(i * 0.7)) * 0.3 * t;
  const q = Math.abs(z - zc) / 0.42;
  if (q >= 1) return 0;
  const w = 1 - q * q, gap = ss(0.3, 0.55, fbm(x * 0.7, 3.1, 77, 2));
  return (0.04 + 0.03 * gap) * w * w * ss(29.6, 30.6, x) * (1 - ss(45.6, 46.6, x)) * (0.35 + 0.65 * gap);
}

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function create(G, { mats }) {
  const t0 = performance.now();
  const group = new Group(); group.name = 'terrain';
  const tier = G.quality?.tier || 'high';
  const res = tier === 'low' ? 1.0 : tier === 'med' ? 0.75 : 0.5;
  const fn = heightFn();
  const tRaster = performance.now() - t0;

  const ground = mats.snowGround;
  patchGroundDetail(ground);
  // vertex colour: Laplacian cavity × contact darkening at the foot of every obstacle (cool, never black) × greyer
  // trampled path; the snow albedo itself stays ~0.8 so the shelf is never pure white
  const tint = (x, z, o, path, near, C, k) => {
    const c = ss(0.0, 2.0, near), r = o * (0.78 + 0.22 * c) * (1 - 0.03 * path), b = o * (0.85 + 0.15 * c) * (1 - 0.02 * path);
    C[k] = r; C[k + 1] = (r + b) * 0.5; C[k + 2] = b;
  };
  // snow banked around the station's loose props (station collider boxes, public API) — mesh only, see propdrift.js
  const PD = propDriftField(G.mods?.station?.colliders, fn.rects, fn);
  const parts = (x, z) => {
    const p = fn.parts(x, z);
    const d = (PD ? sampleGrid(PD.drift, x, z, 0) : 0) + cableCover(x, z);
    if (d !== 0 && p.h > 0) { const h = Math.max(0, p.h + d); p.smooth += h - p.h; p.h = h; p.mask *= 1 - Math.min(1, Math.abs(d) * 4); }
    if (PD) p.near = Math.min(p.near, sampleGrid(PD.near, x, z, 4) + 0.15);
    return p;
  };
  const X = axis(-150, -66, 66, 150, res), Z = axis(FAR.cz - 150, -58, 54, FAR.cz + 150, res);
  const T = rectTerrain({ X, Z, parts, material: ground, chunks: [2, 2], cavity: 0.55, tint });
  for (const m of T.meshes) m.name = 'ground';
  group.add(T.group);
  const tGround = performance.now() - t0 - tRaster;

  // horizon skirt under the far rings (the shelf sinks 0.6 m beneath it beyond r = 118-138 m)
  const skirt = horizonSkirt({ r0: FAR.r0 + 6, r1: 1700, y: SKIRT_Y, material: ground });
  const sc = skirt.geometry.attributes.position.count;
  skirt.geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(sc * 3).fill(0.9), 3));
  skirt.geometry.setAttribute('tmask', new Float32BufferAttribute(new Float32Array(sc * 2), 2));
  skirt.position.z = FAR.cz; skirt.updateMatrix();
  skirt.name = 'ground-skirt'; group.add(skirt);

  // ice outcrops on the berm: ice bake, world triplanar, weathering snow on the slab tops
  const iceMat = makeMaterial('ice', { triplanar: { blend: 0.5, sharp: 4 }, weather: { preset: 'prop' }, rough: 1.0 });
  // the bake is dark clear ice; pressure-ridge ice is milky blue-grey: remap its luminance (cracks / frost keep their
  // contrast) before the vertex AO multiplies in, so albedo stays in 0.3..0.8
  patch(iceMat, 'iceremap', (sh) => {
    sh.fragmentShader = before(sh.fragmentShader, '#include <color_fragment>', 'diffuseColor.rgb = mix(vec3(0.27, 0.36, 0.44), vec3(0.74, 0.79, 0.84), smoothstep(0.06, 0.7, dot(diffuseColor.rgb, vec3(0.3333))));');
  });
  iceMat.vertexColors = true; iceMat.name = 'ice-outcrop';
  const t1 = performance.now();
  const O = buildOutcrops({ heightAt: T.heightAt, material: iceMat, voxel: tier === 'low' ? 0.65 : 0.5 });
  group.add(O.mesh);
  const tOut = performance.now() - t1;

  const WIN = [3.0, 1.8, 0.8];
  const FS = farSilhouettes({ groundAt: T.heightAt, baseY: SKIRT_Y, winColor: WIN });
  group.add(FS.group);
  G.scene.add(group);
  const farfield = createFarfield(G, { layers: FAR_LAYERS, winColor: WIN });
  const stats = { ms: Math.round(performance.now() - t0), raster: Math.round(tRaster), ground: Math.round(tGround), outcrops: Math.round(tOut), tris: T.tris + O.tris + sc + FS.tris, farTris: FS.tris, propDrifts: PD ? PD.count : 0, groundTris: T.tris, outcropTris: O.tris };
  G.terrainStats = stats;
  G.statsHooks?.push(() => ({ terrain: stats }));
  return {
    group, ground: T.meshes[0], meshes: T.meshes, heightAt: T.heightAt, normalAt: T.normalAt, farfield, outcrops: O.mesh, stats,
    conform: (mesh, o) => conform(mesh, T.heightAt, o),
    selfUpdating: true, update() {},
    dispose() { G.scene.remove(group); farfield.dispose?.(); for (const m of T.meshes) m.geometry.dispose(); O.mesh.geometry.dispose(); skirt.geometry.dispose(); FS.dispose(); },
  };
}

/**
 * Drape a flat decal (a PlaneGeometry mesh: light pool, dirty-snow patch) onto the snow: the plane is re-tessellated
 * (seg × seg) and every vertex is moved to heightAt + lift in world space, so it never floats over a hollow nor cuts
 * into a drift. Load time only. Returns false (mesh untouched) when the geometry is not a PlaneGeometry.
 */
export function conform(mesh, heightAt, { seg = 12, lift = 0.02 } = {}) {
  const pr = mesh?.geometry?.parameters;
  if (!pr || !(pr.width > 0) || !(pr.height > 0)) return false;
  const g = new PlaneGeometry(pr.width, pr.height, seg, seg);
  mesh.updateMatrixWorld(true);
  const M = mesh.matrixWorld, Mi = new Matrix4().copy(M).invert(), v = new Vector3(), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i).applyMatrix4(M);
    v.y = heightAt(v.x, v.z) + lift;
    v.applyMatrix4(Mi); P.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); g.computeBoundingSphere();
  mesh.geometry.dispose(); mesh.geometry = g;
  return true;
}

// ?show=terrain: east of the LAB looking upwind (west, into the dusk glow) across the wind ripples, the lee drift
// tongue and a whaleback drift, the lab work light on the left motivating the pool on the snow
// The torch is off: every light in the frame has a visible source (work lights, windows).
export function showcase(G) {
  const torchOff = () => G?.mods?.flashlight?.setOn?.(false);
  torchOff(); G?.on?.('ready', torchOff); G?.on?.('game:start', torchOff);
  // look dev: ?show=terrain&tcam=x,y,z,tx,ty,tz overrides the framing (torch still off)
  const tc = (G?.params?.get?.('tcam') || '').split(',').map(Number);
  if (tc.length === 6 && tc.every(Number.isFinite)) return { cam: tc.slice(0, 3), target: tc.slice(3, 6) };
  return { cam: SHOW[0], target: SHOW[1] };
}
export const SHOW = [[17, 1.3, -4], [4, 0.6, -11]];
