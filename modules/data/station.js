// The orbital station above the home world: a picture of the pilot's progress, with no stats of its own.
// Workshop upgrades build its modules (a faint outline until the first level, lit once maxed); every Overhaul rank adds
// a permanent piece to its core, which the Workshop reset never takes away. The Command Deck (the pilot's trophy room)
// opens with the first Overhaul. One layout feeds the 3D model (rendering/station.js) and the Overhaul panel's
// blueprint (ui/hangar.js). Coordinates are station units, front view: x right, y up, hub at the origin.
import { WORKSHOP } from '@last-orbit/data/workshop.js';

/** Workshop modules. shape: how it is drawn; x, y: where it sits on the trusses. */
export const STATION_MODULES = [
  { id: 'w_dmg', shape: 'battery', x: 5.5, y: 1.9 },
  { id: 'w_rate', shape: 'drum', x: 5.5, y: -1.9 },
  { id: 'w_shield', shape: 'dish', x: 9.6, y: 2 },
  { id: 'w_crit', shape: 'sensor', x: 9.6, y: -2 },
  { id: 'w_speed', shape: 'thruster', x: 13.4, y: 0 },
  { id: 'w_hull', shape: 'plates', x: -5.5, y: 1.9 },
  { id: 'w_regen', shape: 'bay', x: -5.5, y: -1.9 },
  { id: 'w_salvage', shape: 'cargo', x: -9.6, y: 2 },
  { id: 'w_barrier', shape: 'bunker', x: -9.6, y: -2 },
  { id: 'w_magnet', shape: 'tractor', x: -13.4, y: 0 },
  { id: 'w_xp', shape: 'hangar', x: 0, y: 5.6 },
  { id: 'w_start', shape: 'hab', x: 0, y: 8.4 },
  { id: 'w_reroll', shape: 'comms', x: 2.4, y: 9.4 },
  { id: 'w_choice', shape: 'briefing', x: 0, y: -5.4 },
  { id: 'w_revive', shape: 'beacon', x: 0, y: -8.4 },
];
export const MODULE_BY_ID = Object.fromEntries(STATION_MODULES.map((m) => [m.id, m]));

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
