// Counterattack: a vertical shoot-'em-up mode. Six stages carry the fight back through the six sectors: squads fly in
// on scripted paths while the ship moves freely in two dimensions, a mini-boss holds the middle and the sector boss
// ends the stage. It unlocks by defeating the sector 3 boss in the main game and pays in stars and Alien Cores.
// wave: the main-game wave whose enemy strength the stage uses. rec: recommended power (see progression/meta.js).
// len: seconds of squads before the boss. fire: enemy fire-rate multiplier. Hard mode adds hardWaves and the multipliers in HARD.
import { SECTORS } from '@last-orbit/data/sectors.js';

const TITLES = ['Liftoff', 'Graveyard Run', 'Into the Red', 'Iron Curtain', 'Hive Breach', 'Event Horizon'];
const BRIEFS = [
  'The invaders blockade the home world. Fight your way off the surface and break through to orbit.',
  'Their salvage fleets hide among the wrecks. Burn them out.',
  'Follow the retreat into the nebula. Watch for cloaked hunters.',
  'Punch through the machine lines to the foundries.',
  'Strike the hive before it can swarm again.',
  'The Singularity waits at the heart of it all. End this.',
];
export const COUNTER_UNLOCK_SECTOR = 3;
export const STAGES = SECTORS.slice(0, 6).map((sec, i) => ({
  n: i + 1, sector: i, name: TITLES[i], brief: BRIEFS[i], mini: sec.mini,
  boss: [sec.boss, 'scrapking', 'shroud', 'admiral', 'hiveheart', 'unmaker'][i], // stages 2-6 end on a boss of their own
  // the stage's own enemy: its flight pattern, squad size, and seconds between squads
  extra: [null, { type: 'scrapper', pattern: 'hover', n: 2, gap: [13, 18] }, { type: 'stalker', pattern: 'hover', n: 2, gap: [12, 16] }, { type: 'flanker', pattern: 'rise', n: 2, gap: [11, 15] }, { type: 'lunger', pattern: 'lunge', n: 2, gap: [8, 11] }, { type: 'riftling', pattern: 'hover', n: 2, gap: [12, 15] }][i],
  wave: [6, 18, 33, 40, 50, 55][i], rec: [0, 35, 55, 85, 100, 110][i], len: [170, 190, 205, 220, 235, 250][i],
  fire: [1, 1, 1, 1, 1, 0.8][i], // enemy fire-rate multiplier: sector 6's artillery, rockets and beams all aim at the ship
  ground: i === 0 ? 0.55 : 0, // Liftoff: the stage starts over the city; the surface falls away by this share of the stage
  set: ['city', 'wrecks', 'nebula', 'hull', 'hive', 'horizon'][i], // each stage's set piece (see combat/setpieces.js)
}));
export const STAGE_BY_N = Object.fromEntries(STAGES.map((s) => [s.n, s]));
/** How fast the city scrolls beneath the ship on Liftoff (field units a second); ground towers ride along with it. */
export const GROUND_SPEED = 13;
export const HARD = { waves: 8, hp: 1.3, dmg: 1.25, gap: 0.8 };
/** Highest y the ship may fly to (the field's lower half, so there is always room to react). */
export const COUNTER_TOP = 72;
/** Pressing the attack: damage bonus at the top of the ship's airspace (scales up from nothing at the bottom). */
export const HEIGHT_BONUS = 0.25;
/** Stars: 1 for clearing the stage, 1 for taking few hits, 1 for destroying most of the assault force. */
export const STAR_HITS = 5, STAR_KILLS = 0.8;
/** Alien Cores paid per new star (normal and hard stars count separately). */
export const CORES_PER_STAR = 1;
/** Salvage paid the first time each stage is cleared (normal / hard). */
export const clearBounty = (n, hard) => (hard ? 400 : 150) * n;
