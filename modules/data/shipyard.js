// The Shipyard (rendering/shipyard.js): the dry dock at the station's rim, the seventh room aboard to walk around. It
// opens with the shipyard frame, at Overhaul rank 7, and the yard crews start on the first ship built aboard since the
// Fall: the Chimera (data/ships.js), plated in the alien hulls towed home from the Counterattack. She is built in four
// stages, each paid for in the yard and each showing on the ship in the bay; the last one hands her over to the hangar.
// progression/shipyard.js keeps the build.
import { OVERHAUL_COST_STEP } from '@last-orbit/data/prestige.js';

/** The Shipyard comes back at this Overhaul rank. */
export const YARD_RANK = 7;
export const yardOpen = (state) => (state.prestige?.level || 0) >= YARD_RANK;
/** The ship the yard builds. */
export const YARD_SHIP = 'chimera';

// The build, stage by stage. salvage: its price at Overhaul rank 0 (the yard's prices rise with the Workshop's, rank by
// rank, so a stage costs about a sortie or two of salvage whenever it is built); cores: Alien Cores; bp: Blueprints.
export const YARD_STAGES = [
  { id: 'keel', name: 'Keel and frame', desc: 'Lay her keel and raise the frame on the cradle.', salvage: 8000 },
  { id: 'plating', name: 'Alien plating', desc: 'Plate her in hull stripped from the alien bosses you towed home.', salvage: 11000, cores: 3 },
  { id: 'drive', name: 'Plasma drive', desc: 'Fit her engines and the plasma core that feeds her mortar.', salvage: 13000, bp: 2 },
  { id: 'launch', name: 'Arm and commission', desc: 'Mount the Plasma Mortar, paint her and hand her over to the hangar.', salvage: 16000 },
];
/** A stage's salvage at an Overhaul rank, to the nearest hundred. */
export const stageSalvage = (stage, rank) => Math.round((stage.salvage * (1 + OVERHAUL_COST_STEP * (rank || 0))) / 100) * 100;

// What ORBIT says in the yard, round and round (after anything about the build).
export const YARD_LINES = [
  'The yard crews have not built a ship since the Fall, {n}. Listen to them. They are singing.',
  'Every plate on her came off something that tried to kill us. I find that very satisfying.',
  'She is the first ship the station has made for itself. I have started calling her ours.',
  'The frame outside has room for bigger things than fighters. One day, {n}.',
];
