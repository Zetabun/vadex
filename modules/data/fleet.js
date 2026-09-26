// Fleet expeditions: the ships you are not flying go out on their own, from Fleet Ops in the Halo ring (Overhaul rank 9),
// to scout a sector you have cleared (or the Deep Void, once you have been past wave 60) and come back hours later
// (progression/fleet.js). The deeper they go, the longer they are gone and the more they bring: that stretch's material
// (data/materials.js) above all, salvage in proportion to your sorties, mastery for the ship that went, and now and then
// a seed for the Greenhouse, an Alien Core or a Blueprint. The Deep Void sometimes gives up a signal fragment nobody can
// read yet. The further out, the riskier too: a ship can come home damaged, and needs repairing (salvage, and Alloy for
// the plating if it is bad) before it flies again. A reinforced frame (its second refit) makes that rarer. Three berths;
// twelve expeditions home and the Pathfinder paint is yours.
import { SECTORS } from '@last-orbit/data/sectors.js';
import { materialOf } from '@last-orbit/data/materials.js';

export const FLEET_RANK = 9, BERTHS = 3, PATHFINDER_AT = 12, FLEET_PAINT = 'pathfinder';
export const fleetOpen = (state) => (state.prestige?.level || 0) >= FLEET_RANK;
/** Where they can go: the six sectors, then the Deep Void. hours: how long a round trip takes. mat: the material and how
 *  much. worth: salvage, as a share of what one of your sorties pays. mastery: for the ship that went, in waves. seed,
 *  core, bp, fragment: the chance of each find. risk: the chance it comes home damaged; heavy: how often that damage is
 *  bad. */
export const DESTINATIONS = [
  ...SECTORS.slice(0, 6).map((s, i) => ({ id: 's' + (i + 1), name: s.name, n: i + 1, sector: i, hours: [1, 1.5, 2.5, 3.5, 4.5, 6][i], mat: materialOf(i), matN: 8 + i * 3, worth: 0.3 + i * 0.12, mastery: 6 + i * 3, seed: 0.4, core: 0.05 + i * 0.03, bp: i < 2 ? 0 : 0.02 + i * 0.01, fragment: 0, risk: 0.06 + i * 0.04, heavy: 0.2 + i * 0.06 })), /* no Blueprints so close to home */
  { id: 'void', name: 'The Deep Void', n: 7, sector: 6, hours: 8, mat: 'shard', matN: 30, worth: 1.5, mastery: 30, seed: 0.5, core: 0.35, bp: 0.2, fragment: 0.35, risk: 0.35, heavy: 0.6, deep: true },
];
export const DEST_BY_ID = Object.fromEntries(DESTINATIONS.map((d) => [d.id, d]));
/** The finds a trip there might turn up, in words (a seed only once the Greenhouse is open, Alien Cores once the
 *  Counterattack is). */
export const mayFind = (state, d, gardenOn) => [gardenOn && d.seed ? 'a Greenhouse seed' : '', state.counter?.unlocked && d.core ? 'an Alien Core' : '', d.bp ? 'a Blueprint' : '', d.fragment ? 'a signal fragment' : ''].filter(Boolean);
/** Damage: 1 is light (salvage to patch up), 2 is heavy (more salvage, and Alloy for new plating). A reinforced frame (the
 *  ship's second refit, data/refits.js) cuts the risk. */
export const DAMAGE = { 1: { name: 'Light damage', salvage: 0.12, alloy: 0 }, 2: { name: 'Heavy damage', salvage: 0.35, alloy: 6 } }, FRAME_REFIT = 2, FRAME_SAFER = 0.6;
export const riskWord = (d) => (d.risk < 0.12 ? 'Low risk' : d.risk < 0.24 ? 'Some risk' : 'High risk');
/** What the log says of a ship that came home damaged. */
export const DAMAGE_LINES = { 1: ['took a few hits on the way home', 'clipped the debris on the way back', 'came home with a scorched wing'], 2: ['limped home on one engine', 'was caught in a crossfire and barely made it', 'came home holed and venting'] };
/** Open to scouting: a sector you have cleared, the Deep Void once you have been past wave 60. */
export const destOpen = (state, d) => (d.deep ? (state.stats?.bestWave || 0) > 60 : (state.stats?.sectorsCleared || 0) >= d.n);
/** What ORBIT and the log say a ship ran into, by where it went (one picked at random for each return). */
export const FINDS_LINES = {
  sector: ['picked through a wreck field', 'shadowed an invader convoy home', 'found an abandoned relay still broadcasting', 'mapped a debris belt nobody had charted', 'towed back a scout\'s drifting hull'],
  deep: ['went further than anyone since the Fall', 'heard something singing past the last beacon', 'found a hull that was not ours, and not theirs', 'came back with frost on the inside of the canopy'],
};
/** Tapping the halo map, the berths or the log: what ORBIT says when there is nothing to do. */
export const OPS_LINES = [
  'Every light on that map is somewhere we used to be afraid of, {n}. Now we send scouts.',
  'The ships you are not flying get restless. I have been giving them things to do.',
  'The halo relays their telemetry. I can hear every one of them, all the way out.',
];
