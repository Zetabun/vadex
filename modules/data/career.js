// Pilot career: every sortie earns pilot XP; each rank pays out salvage or unlocks a paint job.
// Paint jobs are cosmetic (the ship's trim and hull colours) and apply to every ship. They come from pilot ranks,
// late-game contracts (see data/contracts.js, unlock: { paint }) and ship mastery (a ship's own paint at mastery 10).
export const PAINTS = [
  { id: 'factory', name: 'Factory', trim: null, hull: null, desc: 'Each ship in its own colours.' },
  { id: 'ember', name: 'Ember', trim: 0xff8a3d, hull: 0x8a6a5c },
  { id: 'crimson', name: 'Crimson', trim: 0xff4d7a, hull: 0x7a5566 },
  { id: 'aurum', name: 'Aurum', trim: 0xffc857, hull: 0xa08a5a },
  { id: 'toxin', name: 'Toxin', trim: 0x6dff8e, hull: 0x5e7a66 },
  { id: 'nebula', name: 'Nebula', trim: 0xb69cff, hull: 0x6b6590 },
  { id: 'glacier', name: 'Glacier', trim: 0xd9f6ff, hull: 0x9fc2d8 },
  { id: 'obsidian', name: 'Obsidian', trim: 0x5ee6ff, hull: 0x2a3140 },
  { id: 'solar', name: 'Solar', trim: 0xffe066, hull: 0xd8b25a },
  { id: 'phantom', name: 'Phantom', trim: 0xffffff, hull: 0x1c2030 },
  { id: 'singularity', name: 'Singularity', trim: 0xff5fa2, hull: 0x3b2360 },
  // contract paints
  { id: 'hazard', name: 'Hazard', trim: 0xffd400, hull: 0x2b2b2b, source: 'contract' },
  { id: 'daybreak', name: 'Daybreak', trim: 0xff9ec7, hull: 0xa8768c, source: 'contract' },
  { id: 'inferno', name: 'Inferno', trim: 0xff3d1f, hull: 0x5a1e14, source: 'contract' },
  { id: 'deepvoid', name: 'Deep Void', trim: 0x8a7dff, hull: 0x0d0b1f, source: 'contract' },
  { id: 'apex', name: 'Apex', trim: 0xfff2c2, hull: 0xc9a44c, source: 'contract' },
  // ship mastery paints (mastery 10 with that ship)
  { id: 'm_vanguard', name: 'Vanguard Prime', trim: 0x9ff4ff, hull: 0x3d5f8c, source: 'mastery', ship: 'vanguard' },
  { id: 'm_striker', name: 'Striker Prime', trim: 0xff9bff, hull: 0x5b2a6e, source: 'mastery', ship: 'striker' },
  { id: 'm_bulwark', name: 'Bulwark Prime', trim: 0xffc36b, hull: 0x6e4a1e, source: 'mastery', ship: 'bulwark' },
  { id: 'm_tempest', name: 'Tempest Prime', trim: 0xd3c4ff, hull: 0x3a2f78, source: 'mastery', ship: 'tempest' },
  { id: 'm_revenant', name: 'Revenant Prime', trim: 0xff7a95, hull: 0x4a1224, source: 'mastery', ship: 'revenant' },
];
export const PAINT_BY_ID = Object.fromEntries(PAINTS.map((p) => [p.id, p]));
/** Pilot rank that unlocks a paint job (see PAINT_AT below), or 0 when it comes from elsewhere. */
export const paintRank = (id) => Number(Object.keys(PAINT_AT).find((r) => PAINT_AT[r] === id)) || 0;

export const MAX_RANK = 40;
/** Pilot XP needed to go from rank r to r+1. */
export const rankNeed = (r) => 350 + 180 * (r - 1);
// Paint jobs arrive at fixed ranks; every other rank pays salvage that grows with rank.
export const PAINT_AT = { 2: 'ember', 4: 'crimson', 7: 'aurum', 10: 'toxin', 14: 'nebula', 18: 'glacier', 23: 'obsidian', 28: 'solar', 34: 'phantom', 40: 'singularity' };
/** What reaching rank r pays out. */
export const rankReward = (r) => PAINT_AT[r] ? { paint: PAINT_AT[r] } : { salvage: 40 + r * 15 };
export const TITLES = [[1, 'Cadet'], [3, 'Pilot'], [6, 'Wingman'], [10, 'Ace'], [15, 'Squadron Leader'], [20, 'Commander'], [26, 'Captain'], [32, 'Admiral'], [40, 'Legend']];
export const rankTitle = (r) => { let t = TITLES[0][1]; for (const [at, name] of TITLES) if (r >= at) t = name; return t; };
/** Pilot XP a finished sortie earns: experience gathered plus a bonus per wave and boss. */
export const sortiePilotXp = (s) => Math.round((s.xpTotal || 0) * 0.35 + s.wave * 6 + (s.bosses || 0) * 40);

// ---------------------------------------------------------------- ship mastery
// Each ship levels up with the waves it flies. Every level adds 2% damage and hull to that ship;
// level 3 adds an opening card, level 6 a reroll, and level 10 unlocks the ship's own paint job.
export const MAX_MASTERY = 10;
export const masteryNeed = (lvl) => 40 + 25 * (lvl - 1);
export const MASTERY_PERKS = { 3: 'Opening upgrade card', 6: '+1 card reroll', 10: 'Prime paint job' };
export const masteryFx = (lvl) => {
  const fx = [['damage', 'mult', 0.02 * (lvl - 1)], ['hull', 'mult', 0.02 * (lvl - 1)]];
  if (lvl >= 3) fx.push(['startLevels', 'add', 1]);
  if (lvl >= 6) fx.push(['rerolls', 'add', 1]);
  return fx;
};
