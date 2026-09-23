// Drone types. Levels cost Scrap. dmg is a fraction of the player's global damage stat × DRONE_BASE.
export const DRONE_BASE = 6;
export const DRONES = {
  attack:  { name: 'Attack drone', color: 0x5ee6ff, tier: 1, dmg: 1, rate: 2.4, cost: [40, 1.13], desc: 'Fires bolts at the best target it can see.' },
  missile: { name: 'Missile drone', color: 0xff8a3d, tier: 2, dmg: 3.2, rate: 0.5, splash: 7, cost: [120, 1.13], desc: 'Slow homing missiles with splash.' },
  repair:  { name: 'Repair drone', color: 0x66ffc2, tier: 2, heal: 0.006, cost: [150, 1.14], desc: 'Repairs 0.6% hull a second (+8% per level).' },
  collect: { name: 'Collector drone', color: 0xffd700, tier: 2, gain: 0.08, cost: [200, 1.14], desc: '+8% Credits and Scrap per drone (+4% per level).' },
  mining: { name: 'Mining drone', color: 0xffca65, tier: 1, cost: [120, 1.14], desc: 'Extracts bonus Ore from enemies. Hold mode mines your selected discovered material.' },
  survey: { name: 'Target Painter drone', color: 0xf077b5, tier: 1, cost: [120, 1.14], desc: 'Marks one enemy for +8% damage (+1% per level, up to +16%).' },
  shield:  { name: 'Shield drone', color: 0x7aa2ff, tier: 3, block: 5, cost: [600, 1.14], desc: 'Projects a plate that blocks a bullet every 5s (faster per level).' },
  intercept: { name: 'Interceptor drone', color: 0xff5fa2, tier: 3, rate: 1.6, cost: [600, 1.14], desc: 'Shoots down enemy bullets and rockets.' },
};
export const DRONE_ORDER = ['attack', 'mining', 'survey', 'missile', 'repair', 'collect', 'shield', 'intercept'];
export const SPECIALIST_DRONES = ['mining', 'survey'];
export const droneLevelMult = (lvl, ms) => (1 + 0.2 * (lvl - 1)) * Math.pow(2, ms);
