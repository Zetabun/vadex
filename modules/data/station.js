// The orbital station above the home world: a picture of the pilot's progress, with no stats of its own.
// Workshop upgrades build its modules (a faint outline until the first level, lit once maxed); every Overhaul rank adds
// a permanent piece to its core, which the Workshop reset never takes away. The Command Deck (the pilot's trophy room)
// opens with the first Overhaul. One layout feeds the 3D model (rendering/station.js) and the Overhaul panel's
// blueprint (ui/hangar.js). Coordinates are station units, front view: x right, y up, hub at the origin.

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

/** Core pieces by Overhaul rank. The hub is always there. */
export const STATION_CORE = [
  { at: 0, id: 'hub', name: 'Station hub' },
  { at: 1, id: 'deck', name: 'Command Deck', desc: 'Your own room aboard: medals, banners, records and ships on display.' },
  { at: 2, id: 'ring', name: 'Habitat ring' },
  { at: 3, id: 'spire', name: 'Comms spire' },
  { at: 4, id: 'solar', name: 'Solar wings' },
  { at: 5, id: 'ring2', name: 'Outer ring' },
  { at: 6, id: 'dome', name: 'Observatory' },
  { at: 7, id: 'yard', name: 'Shipyard' },
  { at: 8, id: 'beacons', name: 'Beacon array' },
  { at: 9, id: 'halo', name: 'Halo ring' },
  { at: 10, id: 'crown', name: 'Stellar crown' },
];
export const coreBuilt = (id, rank) => (STATION_CORE.find((c) => c.id === id)?.at ?? 99) <= (rank || 0);
