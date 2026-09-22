// A second persistent idle loop: manufacture tactical stock, then choose when to deploy it.
export const FOUNDRY = { wave: 12, cycle: 75, blueprints: 2, blueprintCap: 80, stockCap: 3 };
export const RECIPES = [
  { id: 'burst', name: 'Overclock cell', icon: 'ϟ', wave: 12, desc: '+35% damage for 12 seconds. Save one for a boss weak point.' },
  { id: 'repair', name: 'Repair capsule', icon: '✚', wave: 15, desc: 'Restore 35% hull and shields, plus 2 seconds of protection.' },
  { id: 'salvage', name: 'Salvage beacon', icon: '▣', wave: 20, desc: 'Recover a cache of Credits and Scrap scaled to the current wave.' },
];
export const FOUNDRY_UPGRADES = [
  { id: 'fabricators', name: 'Parallel fabricators', max: 10, cost: [4, 1.6], desc: '+20% manufacturing speed per level.' },
  { id: 'archive', name: 'Blueprint archive', max: 8, cost: [8, 1.65], desc: 'Double Blueprint storage per level.' },
  { id: 'racks', name: 'Reserve racks', max: 7, cost: [10, 1.7], desc: '+1 stored item of each type per level.' },
  { id: 'analysis', name: 'Production analysis', max: 8, cost: [16, 1.65], desc: '+1 Blueprint earned each manufacturing cycle per level.' },
  { id: 'quality', name: 'Precision assembly', max: 5, cost: [20, 1.8], desc: '+10% supply strength and +2 seconds of Overclock per level.' },
  { id: 'weapons', name: 'Ship calibration', max: 10, cost: [12, 1.7], fx: [['damage', 'mult', 0.03]], desc: '+3% permanent weapon damage per level.' },
  { id: 'bulkheads', name: 'Hull reinforcement', max: 10, cost: [12, 1.7], fx: [['hull', 'mult', 0.04]], desc: '+4% permanent hull per level.' },
  { id: 'dispatch', name: 'Automatic dispatch', max: 1, wave: 25, cost: [40, 1], desc: 'Unlock optional auto-use: repair below 45% hull, Overclock against bosses, salvage on any wave.' },
];
