// The orbital station above the home world: a picture of the pilot's progress, with no stats of its own.
// Workshop upgrades build its modules (a faint outline until the first level, lit once maxed); every Overhaul rank adds
// a permanent piece to its core, which the Workshop reset never takes away. The Command Deck (the pilot's trophy room)
// opens with the first Overhaul. One layout feeds the 3D model (rendering/station.js) and the Overhaul panel's
// blueprint (ui/hangar.js). Coordinates are station units, front view: x right, y up, hub at the origin.
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { STAGES } from '@last-orbit/data/counter.js';
import { BOSSES } from '@last-orbit/data/bosses.js';
import { SECTORS } from '@last-orbit/data/sectors.js';

/** Workshop modules. name: what the station calls it; shape: how it is drawn; x, y: where it sits on the trusses. */
export const STATION_MODULES = [
  { id: 'w_dmg', name: 'Weapon battery', shape: 'battery', x: 5.5, y: 1.9 },
  { id: 'w_rate', name: 'Cycler drum', shape: 'drum', x: 5.5, y: -1.9 },
  { id: 'w_shield', name: 'Shield emitter', shape: 'dish', x: 9.6, y: 2 },
  { id: 'w_crit', name: 'Targeting mast', shape: 'sensor', x: 9.6, y: -2 },
  { id: 'w_speed', name: 'Main thruster', shape: 'thruster', x: 13.4, y: 0 },
  { id: 'w_hull', name: 'Hull plating', shape: 'plates', x: -5.5, y: 1.9 },
  { id: 'w_regen', name: 'Repair bay', shape: 'bay', x: -5.5, y: -1.9 },
  { id: 'w_salvage', name: 'Cargo pods', shape: 'cargo', x: -9.6, y: 2 },
  { id: 'w_barrier', name: 'Bunker', shape: 'bunker', x: -9.6, y: -2 },
  { id: 'w_magnet', name: 'Tractor ring', shape: 'tractor', x: -13.4, y: 0 },
  { id: 'w_xp', name: 'Flight school hangar', shape: 'hangar', x: 0, y: 5.6 },
  { id: 'w_start', name: 'Crew quarters', shape: 'hab', x: 0, y: 8.4 },
  { id: 'w_reroll', name: 'Tactical relay', shape: 'comms', x: 2.4, y: 9.4 },
  { id: 'w_choice', name: 'Briefing dome', shape: 'briefing', x: 0, y: -5.4 },
  { id: 'w_revive', name: 'Emergency beacon', shape: 'beacon', x: 0, y: -8.4 },
];
export const MODULE_BY_ID = Object.fromEntries(STATION_MODULES.map((m) => [m.id, m]));

/** Captured alien hardware, one piece per Alien Tech upgrade (Counterattack's Alien Cores), bolted on at its first level
 *  by a strut from anchor. Like the rest of the station it is a picture only. say: the station AI's line when it is fitted. */
export const STATION_ALIEN = [
  { id: 'x_alloy', name: 'Xeno plating', shape: 'shards', x: 4.4, y: -5.8, anchor: [1.1, -5.8], say: 'Their alloy holds better than ours. I have plated the lower decks with it.' },
  { id: 'x_phase', name: 'Phase coil', shape: 'coil', x: -4.6, y: 7, anchor: [-0.35, 7], say: 'The phase coil is humming, {n}. I would rather not ask how it works.' },
  { id: 'x_charts', name: 'Star chart array', shape: 'spike', x: 4.6, y: 7, anchor: [0.35, 7], say: 'Their star charts are decoded. We know where they came from now.' },
  { id: 'x_siphon', name: 'Core siphon', shape: 'siphon', x: -11.6, y: -4.6, anchor: [-11.6, -0.35], say: 'The siphon draws power from their own cores. I find that fitting.' },
];
export const ALIEN_BY_ID = Object.fromEntries(STATION_ALIEN.map((a) => [a.id, a]));

/** Captured bosses: each Counterattack stage's boss (data/counter.js), towed home on the stage's first clear and held off
 *  the station in a tractor field projected from anchor. say: the station AI's line when it arrives. */
export const STATION_TROPHIES = [
  { stage: 1, x: -18, y: 8, anchor: [-13.6, 0], say: 'We towed the Broodcarrier home. Let them see it from orbit.' },
  { stage: 2, x: -9, y: 11.5, anchor: [0, 9.8], say: 'Vorr\'s scrap heap is ours now, {n}. It suits us better.' },
  { stage: 3, x: 9, y: 11.5, anchor: [0, 9.8], say: 'The Red Shroud hangs in our tractor field. It is quieter than it was.' },
  { stage: 4, x: 18, y: 8, anchor: [13.6, 0], say: 'Admiral Kross\'s flagship, docked at our station. I enjoy this more than I should.' },
  { stage: 5, x: 18, y: -8, anchor: [13.6, 0], say: 'The Hive Heart has stopped beating. We keep it where they can see it.' },
  { stage: 6, x: -18, y: -8, anchor: [-13.6, 0], say: 'The Unmaker, unmade. It will never threaten this orbit again.' },
].map((t) => ({ ...t, id: 'trophy' + t.stage, boss: STAGES[t.stage - 1].boss, name: BOSSES[STAGES[t.stage - 1].boss]?.name || 'Boss' }));
export const TROPHY_BY_ID = Object.fromEntries(STATION_TROPHIES.map((t) => [t.id, t]));
/** The Trophy Hall (rendering/hall.js) opens with the Habitat ring, at this Overhaul rank. */
export const HALL_RANK = 2;
export const hallOpen = (state) => (state.prestige?.level || 0) >= HALL_RANK;
/** The Trophy Hall's hunting record: the main game's six sector bosses, and where each is fought. */
export const HUNTED = SECTORS.slice(0, 6).map((sec, i) => ({ id: sec.boss, sector: i + 1, place: sec.name }));
/** A stage's boss is captured once the stage has been cleared on either difficulty. */
export const trophyWon = (state, n) => (state.counter?.stars?.[n] || 0) > 0 || (state.counter?.hard?.[n] || 0) > 0;
export const caughtStages = (state) => STATION_TROPHIES.filter((t) => trophyWon(state, t.stage)).map((t) => t.stage);

/** Core pieces by Overhaul rank. The hub is always there. say: what the station AI says once it is back (from rank 2;
 *  the Command Deck has its own line). */
export const STATION_CORE = [
  { at: 0, id: 'hub', name: 'Station hub' },
  { at: 1, id: 'deck', name: 'Command Deck', line: 'Your own room aboard, to walk round', desc: 'Your own room aboard: medals, banners, records and ships on display.' },
  { at: 2, id: 'ring', name: 'Habitat ring', line: 'A spinning ring round the hub, and a hall for the bosses you capture', say: 'The habitat ring is turning again. It almost feels like home, {n}.' },
  { at: 3, id: 'spire', name: 'Comms spire', line: 'A mast and beacon above it all, and three bounties a day on the radio', say: 'Comms spire online. For the first time in years, I can hear the rest of the system.' },
  { at: 4, id: 'solar', name: 'Solar wings', line: 'Great panels on both arms', say: 'Solar wings deployed. Full power, for the first time since the Fall.' },
  { at: 5, id: 'ring2', name: 'Outer ring', line: 'A second, wider ring, and a bunk of your own to rest in for more salvage', say: 'The outer ring is sealed. There is room for everyone now, {n}.' },
  { at: 6, id: 'dome', name: 'Observatory', line: 'A glass dome beneath the hub, to chart the Deep Void for Blueprints', say: 'The observatory is open. Now we see them coming long before they arrive.' },
  { at: 7, id: 'yard', name: 'Shipyard', line: 'A frame for building ships, and the Chimera to build: a sixth ship', say: 'The shipyard frame is up. We build our own ships again.' },
  { at: 8, id: 'beacons', name: 'Beacon array', line: 'Lights at every tip, and Void bosses answering from the Deep Void', say: 'Beacons lit. Anyone still out there will know we are here.' },
  { at: 9, id: 'halo', name: 'Halo ring', line: 'A holographic halo', say: 'The halo is up. The old station never looked this good.' },
  { at: 10, id: 'crown', name: 'Stellar crown', line: 'The crowning jewel', say: 'The crown is in place. The last orbit is whole again, {n}. Thank you.' },
];
export const coreBuilt = (id, rank) => (STATION_CORE.find((c) => c.id === id)?.at ?? 99) <= (rank || 0);
/** The core piece a given Overhaul rank adds (none past the crown). */
export const pieceAt = (rank) => (rank > 0 ? STATION_CORE.find((c) => c.at === rank) || null : null);
export const CORE_PIECES = STATION_CORE.filter((c) => c.at > 0).length;
const MAX = Object.fromEntries(WORKSHOP.map((u) => [u.id, u.max]));
/** The rebuild has three parts, each with its share of the whole: the modules (Workshop), the core pieces (Overhauls)
 *  and what is captured from the enemy (Counterattack: its bosses and the alien hardware). */
export const REBUILD_PARTS = [
  { id: 'mod', weight: 40, label: 'Modules', from: 'Workshop upgrades' },
  { id: 'core', weight: 40, label: 'Core pieces', from: 'Overhauls' },
  { id: 'ctr', weight: 20, label: 'Captured from the enemy', from: 'Counterattack and Alien Tech' },
];
const CAPTURES = STATION_TROPHIES.length + STATION_ALIEN.length;
/** How far each part has come (0..1), with counts for the overview: modules by Workshop levels the station has reached
 *  (never un-built), core pieces by Overhaul rank, captures by bosses towed home and alien hardware fitted. */
export function rebuildParts(state) {
  let cur = 0, goal = 0, built = 0; for (const m of STATION_MODULES) { const l = Math.min(MAX[m.id], Math.max(state.workshop?.[m.id] || 0, state.stationPeak?.[m.id] || 0)); cur += l; goal += MAX[m.id]; if (l > 0) built++; }
  const pieces = Math.min(CORE_PIECES, state.prestige?.level || 0), tech = state.counter?.tech || {};
  const caught = STATION_TROPHIES.filter((t) => trophyWon(state, t.stage)).length + STATION_ALIEN.filter((a) => (tech[a.id] || 0) > 0).length;
  return { mod: { share: cur / goal, cur: built, goal: STATION_MODULES.length }, core: { share: pieces / CORE_PIECES, cur: pieces, goal: CORE_PIECES }, ctr: { share: caught / CAPTURES, cur: caught, goal: CAPTURES } };
}
/** How far the rebuild has come, 0..100: modules 40, core pieces 40, captures 20, so 100% means everything. */
export function rebuildPct(state) {
  const p = rebuildParts(state); return Math.floor(REBUILD_PARTS.reduce((a, r) => a + p[r.id].share * r.weight, 0) + 1e-9);
}
/** The station part by part (modules: 0 outline, 1 built, 2 lit; alien hardware and captured bosses: 0 or 1), its rebuild
 *  figure and its parts' shares. The hangar compares two of these to show what changed. */
export function stationSnapshot(state) {
  const parts = {}, tech = state.counter?.tech || {};
  for (const m of STATION_MODULES) { const lvl = state.workshop?.[m.id] || 0; parts[m.id] = Math.max(lvl, state.stationPeak?.[m.id] || 0) <= 0 ? 0 : lvl >= MAX[m.id] ? 2 : 1; }
  for (const a of STATION_ALIEN) parts[a.id] = (tech[a.id] || 0) > 0 ? 1 : 0;
  for (const t of STATION_TROPHIES) parts[t.id] = trophyWon(state, t.stage) ? 1 : 0;
  const p = rebuildParts(state); return { parts, pct: rebuildPct(state), shares: { mod: p.mod.share, core: p.core.share, ctr: p.ctr.share } };
}
