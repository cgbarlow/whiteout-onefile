// Stalker body: the SDF sculpt (sculpt.js) skinned to the 26-bone skeleton of rig.js → one SkinnedMesh, one draw
// (+ its shadow depth passes). Bones start with identity rotations in the bind pose, so anim.js writes absolute
// local rotations every frame (zero allocation).
//   buildBody() → { root (Group: place/yaw it in the world), mesh, bones[], skin (material), tris, ms }
import { Group, Bone, Skeleton, SkinnedMesh, Sphere, Vector3 } from 'three';
import { BONES } from './rig.js';
import { buildSculpt } from './sculpt.js';
import { createSkin } from './skin.js';

export function buildBody() {
  const { geometry, tris, ms } = buildSculpt();
  const skin = createSkin();
  const bones = BONES.map(([name]) => { const b = new Bone(); b.name = 'stk_' + name; return b; });
  BONES.forEach(([, parent, x, y, z], i) => {
    if (parent < 0) { bones[i].position.set(x, y, z); return; }
    const p = BONES[parent];
    bones[i].position.set(x - p[2], y - p[3], z - p[4]);
    bones[parent].add(bones[i]);
  });
  const mesh = new SkinnedMesh(geometry, skin);
  mesh.name = 'stalkerBody';
  mesh.add(bones[0]);
  mesh.updateMatrixWorld(true); // the Skeleton computes its bone inverses from the current bone world matrices
  mesh.bind(new Skeleton(bones));
  mesh.castShadow = true; mesh.receiveShadow = true;
  // generous fixed bounds (the rig never leaves them: crouch, reach, run) so culling never recomputes skinned bounds
  mesh.boundingSphere = new Sphere(new Vector3(0, 1.1, 0.2), 1.9);
  const root = new Group(); root.name = 'stalker';
  root.add(mesh);
  return { root, mesh, bones, skin, tris, ms };
}
