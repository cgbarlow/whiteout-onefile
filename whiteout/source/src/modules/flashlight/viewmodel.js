// Held torch view model: one merged mesh (torchgeo.js, 1 draw call) in its own scene + camera (FOV PLAYER.viewFov),
// drawn by index.js on 'posttransparent' into gl.depthRange(0, 0.05) — the same depth trick as the post pipeline's
// overlay, so it never clips into walls while AO / shafts still see the world depth. Lighting: the sky env (G.env,
// dimmed indoors), a dusk key from the sun direction (outdoors only), and a warm bounce in front of the lens that
// follows the beam (light thrown back at the glove by whatever the torch hits). Shader detail by surface kind:
// diamond knurl, quilted glove shell, pebbled leather, knit rib, crinkled nylon; scratches / edge wear on the metal,
// snow crumbs on up-facing glove surfaces. The reflector + LED glow with the beam (bloom does the halo).
//   createViewModel(G) → { group, scene, camera, update(dt, t, camQ, lagYaw, lagPitch, glow, motion), render(R), dispose }
import {
  Group, Mesh, Scene, PerspectiveCamera, MeshStandardMaterial, DirectionalLight, PointLight, Color, Vector3, Euler,
} from 'three';
import { patch } from '../../cookbook/engine/patch.js';
import { PLAYER } from '../../contracts.js';
import { buildTorchGeometry } from './torchgeo.js';
import { VM_VERT_DECL, VM_VERT_MAIN, VM_FRAG_DECL, VM_FRAG_COLOR, VM_FRAG_ROUGH, VM_FRAG_NORMAL } from './vmglsl.js';

const _e = new Euler();
const FLUO = new Color(0.78, 0.88, 1.0);

function patchViewModel(mat, U) {
  patch(mat, 'torchvm', (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VM_VERT_DECL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VM_VERT_MAIN);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + VM_FRAG_DECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + VM_FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + VM_FRAG_ROUGH)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vPbr.y;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + VM_FRAG_NORMAL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlowCol * (vPbr.z * uGlow);');
  });
  return mat;
}

export function createViewModel(G) {
  const shot = !!G.params.get('shot');
  const { geometry, tris, lensZ } = buildTorchGeometry();
  const U = { uGlow: { value: 0 }, uGlowCol: { value: new Color(1.0, 0.95, 0.86) }, uFrost: { value: 1 } };
  const mat = patchViewModel(new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: 1 }), U);
  mat.userData.noAtmos = true; mat.userData.noWeather = true;
  const mesh = new Mesh(geometry, mat);
  mesh.frustumCulled = false; mesh.name = 'torch-vm';
  const scene = new Scene(); scene.name = 'torch-vm-scene';
  const camera = new PerspectiveCamera(PLAYER.viewFov || 54, 16 / 9, 0.01, 4);
  // root carries the camera's world orientation (env reflections and the sun key stay world-correct)
  const root = new Group();
  const group = new Group(); group.name = 'torch-vm'; group.userData.noReflect = true;
  group.add(mesh); root.add(group);
  const key = new DirectionalLight(0xffffff, 0);
  const bounce = new PointLight(0xffe9cc, 0, 2.2, 2);
  bounce.position.set(0.05, 0.02, -0.75);
  root.add(bounce);
  scene.add(root, key, key.target);
  // rest pose: lower right, angled slightly in toward the screen centre (camera-space metres)
  const rest = new Vector3(0.15, -0.118, -0.4);
  let envK = 1, bob = 0, walkPh = 0;
  // env set before the first compile (G.env exists once the env stage ran); a re-bake swaps the texture only
  mat.envMap = G.env || G.scene.environment || null;
  G.on('env', (tex) => { if (tex && mat.envMap !== tex) { const had = !!mat.envMap; mat.envMap = tex; if (!had) mat.needsUpdate = true; } });
  const S = {
    group, scene, camera, tris, lensZ, visible: true,
    update(dt, t, camQ, lagYaw, lagPitch, glow, motion) {
      // env + key from the world; indoor (lab) dims both
      const indoor = G.mods?.atmosphere?.indoor ? 1 : 0;
      envK += ((indoor ? 0.42 : 1.0) - envK) * Math.min(1, dt * 3);
      mat.envMapIntensity = (G.ART.ambient?.envIntensity ?? 1.5) * 0.55 * envK;
      // outdoors the dusk sun keys the glove; in the lab a dim cool overhead fill stands in for the fluorescent tubes
      // (so the gauntlet and sleeve read as shapes instead of a dark blob at the frame edge)
      key.intensity = indoor ? 1.1 : 1.2 * envK;
      if (indoor) { key.color.copy(FLUO); key.position.set(0.6, 5, 1.2); }
      else { key.color.copy(G.sun.color); key.position.copy(G.sun.dir).multiplyScalar(5); }
      key.target.position.set(0, 0, 0);
      bounce.intensity = 1.2 * glow;
      U.uGlow.value = glow * 9.0;
      U.uFrost.value = 1 - indoor * 0.6;
      // walk bob (speed-driven), breathing idle, lag spring offsets
      const sp = Math.min(1, motion / 4);
      walkPh += dt * (4.5 + 3.0 * sp) * (sp > 0.05 ? 1 : 0);
      bob += (sp - bob) * Math.min(1, dt * 6);
      const breathe = shot ? 0 : Math.sin(t * 1.4) * 0.0025;   // ?shot holds the hand still (stable captures)
      const bx = Math.sin(walkPh) * 0.006 * bob, by = -Math.abs(Math.cos(walkPh)) * 0.008 * bob + breathe;
      root.position.set(0, 0, 0); root.quaternion.copy(camQ);
      camera.position.set(0, 0, 0); camera.quaternion.copy(camQ);
      _e.set(0.035 + lagPitch * 0.9 + breathe * 2, 0.11 + lagYaw * 0.9, -0.08 - lagYaw * 0.5, 'YXZ');
      group.quaternion.setFromEuler(_e);
      // the lag also swings the hand a little sideways/up (the wrist leads, the torch trails)
      group.position.set(rest.x + bx - lagYaw * 0.06, rest.y + by + lagPitch * 0.05, rest.z);
      root.updateMatrixWorld(true);
      const asp = G.width / Math.max(1, G.height);
      if (Math.abs(camera.aspect - asp) > 1e-4) { camera.aspect = asp; camera.updateProjectionMatrix(); }
    },
    // lens centre in the view-model camera's frame (camera space of the player, view-model FOV)
    lensCam(out) { return out.set(0, 0, lensZ).applyMatrix4(group.matrix); },
    // world-space position of the lens centre (for glow anchoring / debug)
    lensWorld(out) { return out.set(0, 0, lensZ).applyMatrix4(group.matrixWorld); },
    render(R) {
      if (!S.visible) return;
      const gl = R.getContext();
      gl.depthRange(0, 0.05);
      R.render(scene, camera);
      gl.depthRange(0, 1);
    },
    compile(R) { R.compile(scene, camera); },
    dispose() { geometry.dispose(); mat.dispose(); },
  };
  return S;
}
