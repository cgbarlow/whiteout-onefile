// No-op stand-ins, one per boot stage, matching each module's public API. engine/boot.js swaps one in when a
// non-critical stage throws during create(), so the game still boots and the failure shows up as
// __stats().modules[i].stub === true (a gate failure — never ship with a stub).
// Keep every stub's shape in sync with the real module's api (OWNERS.md): callers must not need `if (mod.isStub)`.
import { Vector3 } from 'three';
const noop = () => {};
const zero = () => 0;
export const STUBS = {
  // engine / lighting / post (lead)
  sky:       () => ({ update: noop, mesh: null, material: null }),
  env:       () => ({ bake: noop }),
  post:      () => ({ update: noop, params: {} }),       // no G.render → core renders the scene directly
  materials: () => ({ update: noop, get: () => null }),
  lights:    () => ({ update: noop, add: () => ({ light: null, emisMat: null, halo: null, pool: null, base: 0 }), items: [] }),
  shadows:   () => ({ update: noop, invalidate: noop }),
  fx:        () => ({ update: noop, sparks: noop, smoke: noop, emitter: () => ({ stop: noop, start: noop, set: noop }), prewarm: noop, setGround: noop, materials: [] }),
  probes:    () => ({ update: noop, capture: noop, assign: noop }),
  // wave 1 — environment
  station:   () => ({ update: noop, root: null, colliders: [], bounds: null, interior: null, windows: [], insideAt: () => null, labLamp: null }),
  terrain:   () => ({ update: noop, group: null, ground: null, meshes: [], heightAt: zero, normalAt: (x, z, o) => (o ? o.set(0, 1, 0) : new Vector3(0, 1, 0)), farfield: null }),
  atmosphere: () => ({ update: noop, snow: null, dust: null, gust: 0, visibility: 230, indoor: false }),
  // wave 2 — hero / actors / fx
  generators: () => ({ update: noop, list: [], colliders: [], running: 0, beacon: { powered: false, lampAt: [0, 0, 0] }, crank: zero, nearest: () => null, reset: noop }),
  stalker:   () => ({ update: noop, pos: new Vector3(0, -100, 0), state: 'idle', caught: false, setPlayer: noop, reset: noop, root: null }),
  flashlight: () => ({ update: noop, on: false, battery: 1, light: null, toggle: noop, setOn: noop, refill: noop, beamHits: () => false }),
  // wave 3 — rules / ui / audio
  game:      (G) => ({ update: noop, player: { update: noop, yaw: 0, pitch: 0, position: G.camera.position, teleport: noop, stamina: 1, enabled: true }, state: 'playing', time: 0, objective: '', prompt: '', hold: 0, fear: 0, gens: 0, reset: noop }),
  hud:       () => ({ update: noop, setState: noop, set: noop, state: 'playing' }),
  audio:     () => ({ update: noop, play: () => null, setVolume: noop, unlock: noop, mixer: null, music: null }),
};
