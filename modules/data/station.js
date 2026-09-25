// The orbital station above the home world: a picture of the pilot's progress, with no stats of its own.
// Workshop upgrades build its modules (a faint outline until the first level, lit once maxed); every Overhaul rank adds
// a permanent piece to its core, which the Workshop reset never takes away. The Command Deck (the pilot's trophy room)
// opens with the first Overhaul. One layout feeds the 3D model (rendering/station.js) and the Overhaul panel's
// blueprint (ui/hangar.js). Coordinates are station units, front view: x right, y up, hub at the origin.
import { WORKSHOP } from '@last-orbit/data/workshop.js';

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

/** Core pieces by Overhaul rank. The hub is always there. say: what the station AI says once it is back (from rank 2;
 *  the Command Deck has its own line). */
export const STATION_CORE = [
  { at: 0, id: 'hub', name: 'Station hub' },
  { at: 1, id: 'deck', name: 'Command Deck', line: 'Your own room aboard, to walk round', desc: 'Your own room aboard: medals, banners, records and ships on display.' },
  { at: 2, id: 'ring', name: 'Habitat ring', line: 'A spinning ring round the hub', say: 'The habitat ring is turning again. It almost feels like home, {n}.' },
  { at: 3, id: 'spire', name: 'Comms spire', line: 'A mast and beacon above it all', say: 'Comms spire online. For the first time in years, I can hear the rest of the system.' },
  { at: 4, id: 'solar', name: 'Solar wings', line: 'Great panels on both arms', say: 'Solar wings deployed. Full power, for the first time since the Fall.' },
  { at: 5, id: 'ring2', name: 'Outer ring', line: 'A second, wider ring', say: 'The outer ring is sealed. There is room for everyone now, {n}.' },
  { at: 6, id: 'dome', name: 'Observatory', line: 'A glass dome beneath the hub', say: 'The observatory is open. Now we see them coming long before they arrive.' },
  { at: 7, id: 'yard', name: 'Shipyard', line: 'A frame for building ships', say: 'The shipyard frame is up. We build our own ships again.' },
  { at: 8, id: 'beacons', name: 'Beacon array', line: 'Lights at every tip', say: 'Beacons lit. Anyone still out there will know we are here.' },
  { at: 9, id: 'halo', name: 'Halo ring', line: 'A holographic halo', say: 'The halo is up. The old station never looked this good.' },
  { at: 10, id: 'crown', name: 'Stellar crown', line: 'The crowning jewel', say: 'The crown is in place. The last orbit is whole again, {n}. Thank you.' },
];
export const coreBuilt = (id, rank) => (STATION_CORE.find((c) => c.id === id)?.at ?? 99) <= (rank || 0);
/** The core piece a given Overhaul rank adds (none past the crown). */
export const pieceAt = (rank) => (rank > 0 ? STATION_CORE.find((c) => c.at === rank) || null : null);
export const CORE_PIECES = STATION_CORE.filter((c) => c.at > 0).length;
const MAX = Object.fromEntries(WORKSHOP.map((u) => [u.id, u.max]));
/** How far the rebuild has come, 0..100. The modules (the highest Workshop level each has reached) are half of it and
 *  the core pieces the Overhauls add are the other half, so it reaches 100% only when the crown goes on. */
export function rebuildPct(state) {
  let cur = 0, goal = 0; for (const m of STATION_MODULES) { cur += Math.min(MAX[m.id], Math.max(state.workshop?.[m.id] || 0, state.stationPeak?.[m.id] || 0)); goal += MAX[m.id]; }
  const pieces = Math.min(CORE_PIECES, state.prestige?.level || 0);
  return Math.floor((cur / goal + pieces / CORE_PIECES) * 50 + 1e-9);
}
/** The station part by part (modules: 0 outline, 1 built, 2 lit; alien pieces: 0 or 1) and its rebuild figure. The
 *  hangar compares two of these to show what changed. */
export function stationSnapshot(state) {
  const parts = {}, tech = state.counter?.tech || {};
  for (const m of STATION_MODULES) { const lvl = state.workshop?.[m.id] || 0; parts[m.id] = Math.max(lvl, state.stationPeak?.[m.id] || 0) <= 0 ? 0 : lvl >= MAX[m.id] ? 2 : 1; }
  for (const a of STATION_ALIEN) parts[a.id] = (tech[a.id] || 0) > 0 ? 1 : 0;
  return { parts, pct: rebuildPct(state) };
}
