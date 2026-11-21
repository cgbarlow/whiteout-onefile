// Bot / playtest helpers on __G.mods.game.debug (never used by the game itself):
//   spots            named stand points { name: [x, y, z, yaw] }: genA genB genC (facing each panel), console (facing the
//                    extraction unit), cell0..cell3 (facing each charger), lab / radio / shed (hide spots)
//   tp(name)         teleport the player to a spot (feet on the ground, facing the thing) → true
//   stage(name)      deterministic actor set-ups in an open lane north of the store:
//                      'beam'  stalker 12 m ahead, torch on: hold the beam on it → stagger → retreat
//                      'catch' stalker 4 m ahead, torch off: it closes and catches the player
//   peace            true → the stalker is fed a far-away hidden decoy (objective runs cannot be interrupted)
//   freezeConsole    true → the console LEDs keep a staged state (?show=game)
import { LAYOUT as L } from '../../contracts.js';

const yawTo = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz));
const LANE = { stalker: [14, 16.5], beam: [26, 17.5], catch: [18, 16.5] };

export function createDebug(G, { S, player, generators, stalker, flashlight, pickups }) {
  const spots = {};
  for (const g of L.generators) {
    const e = generators?.list?.find((x) => x.id === g.id); if (!e) continue;
    const nx = Math.cos(g.rotY), nz = -Math.sin(g.rotY);            // the panel faces the lean-to's local +x
    const x = e.pos.x + nx * 0.78, z = e.pos.z + nz * 0.78;
    spots['gen' + g.id] = [x, 0, z, yawTo(x, z, e.pos.x, e.pos.z)];
  }
  const con = pickups.console;
  spots.console = [con.stand.x, 0, con.stand.z, yawTo(con.stand.x, con.stand.z, con.at.x, con.at.z)];
  pickups.cells.forEach((c, i) => { spots['cell' + i] = [c.stand.x, 0, c.stand.z, yawTo(c.stand.x, c.stand.z, c.pos.x, c.pos.z)]; });
  const lab = L.modules.find((m) => m.interior);
  spots.lab = [lab.c[0] + 2.5, 0, lab.c[1], Math.PI / 2];
  spots.radio = [L.radioHut.c[0] + 0.6, 0, L.radioHut.c[1] + 0.6, 0];
  spots.shed = [L.shed.c[0] + 1, 0, L.shed.c[1], Math.PI / 2];

  const D = { spots, peace: false, freezeConsole: false };
  D.tp = (name) => {
    const s = spots[name]; if (!s) return false;
    player.teleport(s, s[3], name.startsWith('cell') ? -0.35 : name === 'console' ? -0.3 : 0);
    return true;
  };
  D.stage = (name) => {
    if (!stalker?.brain) return false;
    const [sx, sz] = LANE.stalker, pp = LANE[name]; if (!pp) return false;
    stalker.reset();
    const b = stalker.brain;
    b.pos.set(sx, 0, sz); b.yaw = yawTo(sx, sz, pp[0], pp[1]); b.speed = 0; b.sightT = 0;
    player.teleport([pp[0], 0, pp[1]], yawTo(pp[0], pp[1], sx, sz), -0.05);
    flashlight?.refill?.(); flashlight?.setOn?.(name === 'beam');
    D.peace = false;
    return true;
  };
  return D;
}
