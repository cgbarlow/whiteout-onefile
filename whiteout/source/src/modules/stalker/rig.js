// Stalker skeleton (bind pose, metres, root on the ground, facing +Z, +X = the creature's left).
// The bind pose is a relaxed upright stance (arms hanging 7° out, legs straight) so the SDF sculpt in sculpt.js
// has clean gaps between arms and thighs; anim.js adds the stoop, the lurch and every other pose on top.
// Joint chains are exactly vertical where anim.js solves IK (thigh → shin → ankle) so the solver can be analytic.
//   BONES[i] = [name, parentIndex, x, y, z]   (world bind position of the joint)
export const BONES = [
  ['root', -1, 0, 0, 0],
  ['pelvis', 0, 0, 1.26, 0],
  ['spine1', 1, 0, 1.40, -0.01],
  ['spine2', 2, 0, 1.58, -0.02],
  ['chest', 3, 0, 1.76, -0.02],
  ['neck', 4, 0, 1.98, -0.03],
  ['head', 5, 0, 2.12, 0.0],
  ['jaw', 6, 0, 2.10, 0.035],
  ['clavL', 4, 0.04, 1.93, 0.0],
  ['clavR', 4, -0.04, 1.93, 0.0],
  ['uarmL', 8, 0.21, 1.93, -0.02],
  ['uarmR', 9, -0.21, 1.93, -0.02],
  ['farmL', 10, 0.27, 1.45, -0.03],
  ['farmR', 11, -0.27, 1.45, -0.03],
  ['handL', 12, 0.33, 0.94, 0.0],
  ['handR', 13, -0.33, 0.94, 0.0],
  ['fingL', 14, 0.34, 0.83, 0.005],
  ['fingR', 15, -0.34, 0.83, 0.005],
  ['thighL', 1, 0.12, 1.22, 0],
  ['thighR', 1, -0.12, 1.22, 0],
  ['shinL', 18, 0.12, 0.64, 0],
  ['shinR', 19, -0.12, 0.64, 0],
  ['footL', 20, 0.12, 0.10, 0],
  ['footR', 21, -0.12, 0.10, 0],
  ['toesL', 22, 0.12, 0.035, 0.15],
  ['toesR', 23, -0.12, 0.035, 0.15],
];
export const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
// leg segment lengths for the analytic IK (thigh → knee, knee → ankle) and the ankle height above the sole
export const LEG = { l1: 0.58, l2: 0.54, ankle: 0.10, hipX: 0.12, hipY: -0.04 };
