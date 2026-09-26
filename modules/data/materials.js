// Materials: what the wrecks in each stretch of the invasion leave behind, spent on ship refits (data/refits.js). Each
// band of sectors drops its own: Alloy in sectors 1-2, Crystal in 3-4, Void shards in 5-6 and on into the Deep Void, so
// every stretch of a sortie is worth flying through (warping past one forgoes its material). Bosses always drop some,
// elites often, any other kill now and then; fleet expeditions bring back the material of the sector they scout.

/** band: the sector indexes (0-based) that drop it. color: its pickup and chip. */
export const MATERIALS = [
  { id: 'alloy', name: 'Alloy', color: 0x9fc2ff, from: 'sectors 1-2', lore: 'Hull alloy stripped from the invaders\' scouts: light, springy, and it takes a weld like nothing we ever made.' },
  { id: 'crystal', name: 'Crystal', color: 0xff7ad8, from: 'sectors 3-4', lore: 'Lattice crystal grown inside their heavier ships. It holds a charge for days.' },
  { id: 'shard', name: 'Void shards', color: 0xb07bff, from: 'sectors 5-6 and the Deep Void', lore: 'Splinters of whatever the deep ones are made of. Cold to the touch, even through a glove.' },
];
export const MAT_BY_ID = Object.fromEntries(MATERIALS.map((m) => [m.id, m]));
/** The material a sector drops (0-based sector index; the Deep Void runs on past 5). */
export const materialOf = (sectorIdx) => (sectorIdx <= 1 ? 'alloy' : sectorIdx <= 3 ? 'crystal' : 'shard');
/** How much drops: a sector boss, a mini-boss, the chance an elite drops one, the chance any other kill does; the Deep
 *  Void drops half as much again. Roughly 12-16 a sector for a pilot who flies all of it. */
export const MAT_DROP = { boss: 5, mini: 3, elite: 0.35, kill: 0.012, deep: 1.5 };
