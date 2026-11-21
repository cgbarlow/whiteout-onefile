// Frozen contracts shared by every module owner. Change only through the lead (re-run captures after any change).
//  POSES  6 hero camera poses [x,y,z, tx,ty,tz] — the critic judges exactly these (capture.mjs --poses).
//  YAWS   2 extra eye-height views from the spawn in directions no hero pose covers (random-yaw defect hunting).
//  PATH   fly-through keys, same format; title-screen flyover (closed loop) and #bench (engine/bench.js).
//  WORLD  playable bounds (metres, Y up, X east, Z south). Outside = berm/ridges/far field hidden by fog.
//  LAYOUT shared placement of every set piece (station, generators, stalker, game all read it; never hard-code twice).
//  PLAYER body + feel constants read by modules/game/player.js.
// Sun: elev 7°, azim 255° → dir ≈ (-0.96, 0.12, -0.26): it sits WSW, so "into the sun" = looking toward -X.
export const SEED = 7713;

export const POSES = [
  [50.0, 6.0, 24.0, -48.0, 3.5, -8.0],    // 1 establishing vista from the east gantry INTO the dusk glow, tower silhouette
  [44.0, 1.68, 12.0, 0.0, 2.6, 2.0],      // 2 gameplay eye at spawn (vehicle-shed door), objective path west
  [11.0, 1.45, -32.6, 8.0, 1.0, -34.3],   // 3 hero close-up: generator A in its lean-to, rim from the dusk
  [5.2, 1.98, -9.4, -5.0, 1.5, -10.8],    // 4 interior: the lab (floor 0.3 m) by a failing fluorescent
  [-13.0, 1.68, 3.0, -23.0, 1.3, 9.5],    // 5 action: stalker in the flashlight beam by the fuel tanks, generator C sparking
  [-42.0, 3.0, -2.0, 10.0, 2.0, 6.0],     // 6 reverse from the tower base back east to the lit station, AWAY from the sun
];

export const YAWS = [
  [44.0, 1.68, 12.0, 44.0, 1.5, -30.0],   // spawn, looking north along the shed wall toward the north berm
  [44.0, 1.68, 12.0, 70.0, 1.3, 30.0],    // spawn, looking south-east at the east boundary ridge (behind the player)
];

export const PATH = [
  [50.0, 6.0, 24.0, -48.0, 3.5, -8.0],
  [38.0, 3.0, 14.0, 0.0, 2.0, 0.0],
  [16.0, 2.6, -26.0, 8.0, 1.0, -34.0],
  [12.0, 2.2, -12.0, 0.0, 1.8, -10.0],
  [-8.0, 2.5, 0.0, -22.0, 1.3, 9.0],
  [-40.0, 4.0, -2.0, 10.0, 2.0, 6.0],
  [10.0, 5.0, 30.0, 40.0, 2.0, 10.0],
];

export const WORLD = { min: [-60, -2, -50], max: [60, 40, 46], groundY: 0 };

// Footprints: c = centre [x, z], size = [x-extent, z-extent] (m), h = wall height, floor = floor height above snow,
// door = world [x, z] of the doorway centre on the wall facing `doorFace` ('+x' | '-x' | '+z' | '-z').
export const LAYOUT = {
  spawn: [44.0, 0.0, 12.0],
  shed:  { c: [50, 12], size: [8, 12], h: 4.6, door: [46, 12], doorFace: '-x' },               // vehicle shed (spawn)
  modules: [
    { id: 'hab',   name: 'HAB-1', c: [22, 4],   size: [16, 6], h: 3.2, floor: 0.3, door: [14, 4],   doorFace: '-x' },
    { id: 'lab',   name: 'LAB-2', c: [0, -10],  size: [14, 6], h: 3.2, floor: 0.3, door: [7, -10],  doorFace: '+x', interior: true },
    { id: 'mess',  name: 'MESS',  c: [-14, -22], size: [12, 6], h: 3.2, floor: 0.3, door: [-8, -22], doorFace: '+x' },
    { id: 'store', name: 'STORE', c: [26, 24],  size: [10, 5], h: 3.0, floor: 0.3, door: [21, 24],  doorFace: '-x' },
  ],
  // generator lean-tos: open on the -x (sun) side; gen = generator centre (skid on the ground), panel faces +x
  generators: [
    { id: 'A', c: [8, -34], gen: [8.0, -34.3], rotY: 0 },
    { id: 'B', c: [6, 30],  gen: [6.0, 30.0],  rotY: 0 },
    { id: 'C', c: [-28, 14], gen: [-28.0, 14.0], rotY: 0 },
  ],
  tower: { c: [-48, -8], h: 28, base: 5 },                                // lattice beacon tower, square base 5 m
  radioHut: { c: [-46, -15], size: [4, 3], h: 2.8, door: [-44, -15], doorFace: '+x', console: [-45.2, -15] },
  fuelTanks: [[-26, 6.5, 0.15], [-25, 1.5, -0.1], [22, -16, 0.4]],       // [x, z, rotY]: horizontal 6 m × Ø2.4 m
  workLights: [[34, 10], [10, -2], [-6, -30], [-34, 4]],                  // pole feet [x, z]
  masts: [[47, 22], [30, -12], [-4, 20], [-36, -24]],                     // antenna masts [x, z] (first = pose-1 foreground)
  stalkerPatrol: [[-22, 9], [-6, 12], [12, 16], [34, 18], [30, -6], [14, -22], [-4, -36], [-26, -12], [-40, 6]],
  stalkerStart: [-21.5, 0.0, 8.5],
  batteries: [[19, 3.6], [-2, -12], [-16, -23], [27, 25]],                // spare cells inside modules [x, z] (floor height)
};

export const PLAYER = {
  eye: 1.68, crouchEye: 1.05, radius: 0.32, height: 1.8,
  fov: 68, viewFov: 54,                     // horror: narrower FOV (genre recipe 65-70)
  walk: 3.4, sprint: 5.8, crouch: 1.6,      // m/s (deep snow)
  accel: 26, airAccel: 4, friction: 10,     // m/s² / 1/s
  jump: 4.2, gravity: 18,                   // m/s, m/s²
  spawn: [44.0, 0.0, 12.0], spawnYaw: 1.35, // facing west toward the station and the tower
  stamina: 6.0,                             // s of sprint
};

// Game tuning shared by game / stalker / flashlight / hud.
export const RULES = {
  crankHold: 3.0,          // s holding E to restart a generator
  callHold: 5.0,           // s holding E at the radio console
  interactRange: 2.0,      // m
  battery: 150,            // s of flashlight on a full cell
  catchDist: 1.3,          // m: stalker reaching the player = caught
  hearSprint: 22, hearCrank: 45, hearWalk: 7, // m
  sight: 25, sightLit: 45, sightFovDeg: 110,
  staggerBeam: 1.5,        // s of beam on the stalker → it retreats
  retreat: 10,             // s
};
