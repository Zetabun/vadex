// The Pilot's quarters (rendering/quarters.js): your own room aboard, in the Outer ring (it opens with the ring, at
// Overhaul rank 5). A bunk to rest in once a day (the next sortie banks more salvage), a shelf of keepsakes picked up on
// the way (each with its line in the pilot's log), a wall of photos of the big moments, the lights set to your mood, and
// Bolt, the maintenance drone that has decided it lives here.

/** The Outer ring comes back at this Overhaul rank, and with it the quarters. */
export const QUARTERS_RANK = 5;
export const quartersOpen = (state) => (state.prestige?.level || 0) >= QUARTERS_RANK;
/** Resting in the bunk: the next sortie banks this much more salvage. Once a day. */
export const REST_BONUS = 0.1;

// Keepsakes on the shelf: shape (how it is built in the room), colour, when it is earned (req), how to earn it, and the
// pilot's log entry that goes with it. In the order they tend to come.
export const KEEPSAKES = [
  { id: 'k_chip', name: 'First salvage chip', shape: 'coin', color: 0xffc857, req: (s) => (s.stats.sorties || 0) >= 1, how: 'Fly your first sortie.', log: 'First sortie. I came home with a pocketful of scrap and kept one chip, for luck.' },
  { id: 'k_plate', name: 'Scorched hull plate', shape: 'plate', color: 0x9a7a66, req: (s) => (s.stats.deaths || 0) >= 1, how: 'Lose your ship once.', log: 'They got me. The crews pulled this plate off what was left. It stays on the shelf so I remember.' },
  { id: 'k_fang', name: 'Broodcarrier fang', shape: 'fang', color: 0xd48cff, req: (s) => (s.stats.sectorBosses || 0) >= 1, how: 'Defeat a sector boss.', log: 'Broke this off the Broodcarrier on the way past. It still hums at night.' },
  { id: 'k_wings', name: 'Pilot\'s wings', shape: 'pin', color: 0xdfe6f2, req: (s) => (s.pilot?.rank || 1) >= 5, how: 'Reach pilot rank 5.', log: 'Rank five. ORBIT printed me a set of wings. I pretend not to care.' },
  { id: 'k_crystal', name: 'Red Nebula crystal', shape: 'gem', color: 0xff6a5c, req: (s) => (s.stats.bestSector || 1) >= 3, how: 'Reach the Red Nebula (sector 3).', log: 'The nebula grows these on anything that stays still. I did not stay still.' },
  { id: 'k_gear', name: 'Machine gear', shape: 'gear', color: 0x3dffb5, req: (s) => (s.stats.bestSector || 1) >= 4, how: 'Reach Machine Territory (sector 4).', log: 'Everything in Machine Territory turns. This one stopped.' },
  { id: 'k_core', name: 'Alien core in a jar', shape: 'jar', color: 0x9ff0ff, req: (s) => Object.values(s.counter?.stars || {}).some((n) => n > 0), how: 'Earn a star in the Counterattack.', log: 'We took the fight to them, and I brought back a core. The engineers want it. They can wait.' },
  { id: 'k_amber', name: 'Hive amber', shape: 'drop', color: 0xffb547, req: (s) => (s.stats.bestSector || 1) >= 5, how: 'Reach Hive Space (sector 5).', log: 'Something is sealed inside this amber. I have decided not to find out what.' },
  { id: 'k_roll', name: 'The first blueprint', shape: 'roll', color: 0x5ea8ff, req: (s) => (s.prestige?.level || 0) >= 1, how: 'Complete an Overhaul.', log: 'We tore the station down and built it better. I kept the first blueprint.' },
  { id: 'k_casing', name: 'Shell casing', shape: 'casing', color: 0xff8a5e, req: (s) => (s.stats.siegeWins || 0) >= 1, how: 'Hold a Station Siege.', log: 'The first time they came for the station, we held. I picked this up off the gun deck.' },
  { id: 'k_shard', name: 'Singularity shard', shape: 'shard', color: 0xffd166, req: (s) => (s.stats.sectorsCleared || 0) >= 6, how: 'Defeat the Singularity.', log: 'The Singularity is gone. This is what was left of its heart. It is still warm.' },
  { id: 'k_compass', name: 'Void compass', shape: 'compass', color: 0xc77dff, req: (s) => (s.stats.bestWave || 0) > 60, how: 'Fly past wave 60, into the Deep Void.', log: 'Past the last sector the needle stopped pointing anywhere. I still carry it.' },
];
export const KEEPSAKE_BY_ID = Object.fromEntries(KEEPSAKES.map((k) => [k.id, k]));

// Photos on the back wall: the big moments, each with its art (ui/art.js keys) and a caption.
export const PHOTOS = [
  { id: 'p_launch', req: (s) => (s.stats.sorties || 0) >= 1, art: (s) => 'ship:' + (s.ship || 'vanguard'), caption: () => 'First launch' },
  { id: 'p_boss', req: (s) => (s.stats.sectorBosses || 0) >= 1, art: () => 'relic:r_giant', caption: () => 'First boss down' },
  { id: 'p_best', req: (s) => (s.stats.bestWave || 0) >= 10, art: () => 'ach:trophy', caption: (s) => `Wave ${s.stats.bestWave}!` },
  { id: 'p_counter', req: (s) => Object.values(s.counter?.stars || {}).some((n) => n > 0), art: () => 'ship:striker', caption: () => 'The Counterattack' },
  { id: 'p_overhaul', req: (s) => (s.prestige?.level || 0) >= 1, art: () => 'ach:wrench', caption: (s) => `Rebuilt · rank ${s.prestige.level}` },
  { id: 'p_siege', req: (s) => (s.stats.siegeWins || 0) >= 1, art: () => 'ws:w_shield', caption: () => 'We held the line' },
];

// The lights, set to a mood (the switch by the door): the lamps, the strips, the cove.
export const MOODS = [
  { id: 'warm', name: 'Warm', lamp: 0xffd2a0, lampI: 0.5, strip: 0xffb070, cove: 0xffb070, hemi: 0.5, panel: 0xfff0dc },
  { id: 'cool', name: 'Cool', lamp: 0xd6ecff, lampI: 0.5, strip: 0x5ee6ff, cove: 0x5ee6ff, hemi: 0.52, panel: 0xeaf6ff },
  { id: 'night', name: 'Night', lamp: 0x7080d0, lampI: 0.28, strip: 0x5a5aff, cove: 0x3a3ad0, hemi: 0.3, panel: 0x464e86 },
  { id: 'neon', name: 'Neon', lamp: 0xffb8ec, lampI: 0.45, strip: 0xff5fd2, cove: 0x5ee6ff, hemi: 0.45, panel: 0xffc4ee },
];
export const MOOD_BY_ID = Object.fromEntries(MOODS.map((m) => [m.id, m]));

// What ORBIT says about Bolt, round and round.
export const BOLT_LINES = [
  'That is Bolt, {n}. It was built to scrub carbon off the reactor. It follows you instead.',
  'Bolt has been in here every day since you moved in. It rearranges your keepsakes when you are out.',
  'I asked Bolt why it stays. It beeped twice. I think that means you.',
  'Bolt tried to fly a sortie once. It got as far as the airlock.',
];
