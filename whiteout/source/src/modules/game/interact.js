// Interaction queries for game/index.js (allocation-free; labels are prebuilt strings):
//   generator panels  hold E to crank (generators.crank does the work and the noise)
//   torch cells       press E to swap the torch onto a fresh cell (refused while the torch is still > 90 %)
//   radio console     hold E once the beacon is powered (the call itself is timed in index.js)
//   createInteract(G, { generators, flashlight, pickups }) → { query(p, yaw), kind 'gen'|'cell'|'console'|null,
//     target, label, takeCell(c), reset() }
// "In reach" is horizontal distance from the feet plus a facing test (the player must roughly look at it, ±70°), so
// two interactables side by side never fight and prompts do not flash on through a wall the player has turned from.
import { RULES as R } from '../../contracts.js';

const CELL_R = 1.35, CON_R = 1.7, FACE_COS = Math.cos((70 * Math.PI) / 180);

export function createInteract(G, { generators, flashlight, pickups }) {
  const genLabel = {}, genRun = {};
  for (const g of generators?.list || []) { genLabel[g.id] = 'Hold E  crank GEN ' + g.id; genRun[g.id] = 'GEN ' + g.id + ' running'; }
  const L_CELL = 'E  swap in a fresh torch cell', L_FULL = 'Torch charge is full', L_EMPTY = 'Charger empty';
  const L_CALL = 'Hold E  call for extraction', L_DEAD = ['Radio dead  restart the generators 0/3', 'Radio dead  restart the generators 1/3', 'Radio dead  restart the generators 2/3', 'Radio dead  restart the generators 2/3'];
  const I = { kind: null, target: null, label: '', cells: pickups ? pickups.cells : [] };

  const facing = (p, yaw, x, z) => {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.45) return true;
    return (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / d > FACE_COS;
  };
  // what is in reach of p (feet position) looking along yaw?
  I.query = (p, yaw) => {
    I.kind = null; I.target = null; I.label = '';
    const g = generators?.nearest?.(p, R.interactRange);
    if (g && facing(p, yaw, g.pos.x, g.pos.z)) {
      if (g.state !== 'running') { I.kind = 'gen'; I.target = g; I.label = genLabel[g.id] || 'Hold E  crank'; return I; }
      I.label = genRun[g.id] || '';
    }
    const cs = I.cells;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i], dx = c.pos.x - p.x, dz = c.pos.z - p.z;
      if (dx * dx + dz * dz > CELL_R * CELL_R || !facing(p, yaw, c.pos.x, c.pos.z)) continue;
      if (c.taken) { I.label = L_EMPTY; continue; }
      I.target = c;
      if (flashlight && flashlight.battery > 0.9) { I.label = L_FULL; return I; }
      I.kind = 'cell'; I.label = L_CELL; return I;
    }
    const con = pickups?.console;
    if (con) {
      const dx = con.at.x - p.x, dz = con.at.z - p.z;
      if (dx * dx + dz * dz < CON_R * CON_R && facing(p, yaw, con.at.x, con.at.z)) {
        I.kind = 'console'; I.target = con;
        I.label = generators?.beacon?.powered ? L_CALL : L_DEAD[Math.min(3, generators?.running ?? 0)];
      }
    }
    return I;
  };
  I.takeCell = (c) => { if (!c || c.taken) return false; pickups.setTaken(c, true); flashlight?.refill?.(); flashlight?.setOn?.(true); return true; };
  I.reset = () => { for (const c of I.cells) pickups.setTaken(c, false); I.kind = null; I.target = null; I.label = ''; };
  return I;
}
