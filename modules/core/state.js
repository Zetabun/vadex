// Single source of truth. Everything here is plain data (plus Big) and is what gets saved.
// Layers, from most to least volatile:  run → (rewind) → prestige → (ascension) → asc / relics / achievements.
import { Big } from '@last-orbit/core/big.js';
export const SCHEMA = 14;
export const ONBOARDING_VERSION = 6;
export const newOnboarding = () => ({
  enabled: true, version: ONBOARDING_VERSION, step: 0, completed: false, done: {}, acknowledged: {},
  flags: { move: false, fire: false, upgrade: false, smelter: false, focus: false, streakSeen: false, xpSeen: false, paint: false, weapon: false, ability: false, skill: false, research: false, fleet: false, foundry: false, drone: false, rewind: false },
});

export function newRun(seed) {
  return {
    seed: seed ?? ((Math.random() * 2 ** 31) | 0), wave: 1, best: 1, farm: false, time: 0, cleanStreak: 0, xp: 0,
    upgrades: {}, weapons: { cannon: 1 }, equipped: ['cannon'], research: {}, skills: {},
    drones: { levels: {}, bays: [] }, boons: {}, picks: [], nextBoon: 6, nextAnomaly: 9,
    challenge: null, failed: false, pendingChoice: null, choiceQueue: [],
    stats: {},
  };
}

export function newState() {
  const now = Date.now();
  return {
    v: SCHEMA,
    meta: { created: now, lastSave: now, lastSeen: now, playTime: 0, sandbox: false },
    settings: { master: 0.7, music: 0.5, sfx: 0.8, shake: true, dmgNumbers: true, scanlines: true, quality: 'auto', notation: 'suffix', confirmRewind: true, speed: 1, waveIntermission: 5 },
    cur: { credits: Big.ZERO, ore: Big.ZERO, iron: Big.ZERO, copperOre: Big.ZERO, copper: Big.ZERO, silverOre: Big.ZERO, silver: Big.ZERO, goldOre: Big.ZERO, gold: Big.ZERO, cobaltOre: Big.ZERO, cobalt: Big.ZERO, titaniumOre: Big.ZERO, titanium: Big.ZERO, iridiumOre: Big.ZERO, iridium: Big.ZERO, palladiumOre: Big.ZERO, palladium: Big.ZERO, uraniumOre: Big.ZERO, uranium: Big.ZERO, platinumOre: Big.ZERO, platinum: Big.ZERO, tungstenOre: Big.ZERO, tungsten: Big.ZERO, osmiumOre: Big.ZERO, osmium: Big.ZERO, neutroniumOre: Big.ZERO, neutronium: Big.ZERO, scrap: Big.ZERO, data: Big.ZERO, cores: Big.ZERO, matter: Big.ZERO, shards: Big.ZERO, frags: Big.ZERO, sigils: Big.ZERO },
    run: newRun(),
    prestige: { count: 0, tree: {}, total: Big.ZERO, bestWave: 1, history: [], paceBest: {} },
    asc: { count: 0, tree: {}, total: Big.ZERO },
    modules: { inv: [], equipped: {}, nextId: 1 },
    foundry: { commissioned: false, recipe: 'burst', equipped: 'burst', progress: 0, blueprints: 0, stock: { burst: 0, repair: 0, salvage: 0 }, upgrades: {}, auto: false, lifetime: 0, produced: 0, used: 0 },
    projects: { completed: {}, passageBossCleared: false },
    fleet: { commissioned: false, supply: Big.ZERO, lifetime: Big.ZERO, spent: Big.ZERO, upgrades: {} },
    materials: { discovered: false, discoveredOres: {}, selected: 'iron', smelter: false, running: false, runningMaterial: null, progress: 0, readyBars: 0, readyMaterial: null, mineProgress: 0, lifetimeOre: Big.ZERO, lifetimeBars: Big.ZERO, lifetimeOreBy: {}, lifetimeBarsBy: {}, barsProduced: 0, batchesStarted: 0, upgrades: {} },
    onboarding: newOnboarding(),
    relics: {}, alien: {},
    abilities: { equipped: ['overdrive', null, null, null, null, null] },
    auto: { buy: { on: false, cats: { off: true, def: true, eco: true }, reserve: 0 }, rules: [], ability: {}, boonTag: 'offence', research: false, salvageBelow: 1, rewind: { on: false, mode: 'gain', value: 2, minMinutes: 3 }, push: true },
    missions: { active: [], done: 0, seq: 0 },
    challenges: { done: {} },
    ach: {},
    stats: { kills: 0, bestWave: 1, bestSector: 1 },
    unlocks: {}, seen: {}, log: [],
  };
}

/** Fill in anything missing from an older/partial save using defaults (deep, non-destructive). */
export function withDefaults(obj, def) {
  if (obj == null) return def;
  if (def instanceof Big) return obj instanceof Big ? obj : Big.from(obj);
  if (Array.isArray(def) || typeof def !== 'object' || def === null) return obj;
  for (const k of Object.keys(def)) obj[k] = k in obj ? withDefaults(obj[k], def[k]) : def[k];
  return obj;
}

export const CUR = {
  credits: { name: 'Credits', icon: '¢', color: '#ffc857', hint: 'Spent on upgrades. Lost on rewind.' },
  ore: { name: 'Iron Ore', icon: '▰', color: '#9aa3ad', material: 'iron', kind: 'ore', hint: 'Raw Iron Ore. Smelt it into Iron Bars.' },
  iron: { name: 'Iron Bars', icon: '▰', color: '#9aa3ad', material: 'iron', kind: 'bar', hint: 'Collected Iron Bars.' },
  copperOre: { name: 'Copper Ore', icon: '▰', color: '#b87345', material: 'copper', kind: 'ore', hint: 'Raw Copper Ore.' },
  copper: { name: 'Copper Bars', icon: '▰', color: '#b87345', material: 'copper', kind: 'bar', hint: 'Collected Copper Bars.' },
  silverOre: { name: 'Silver Ore', icon: '▰', color: '#d9e1e8', material: 'silver', kind: 'ore', hint: 'Raw Silver Ore.' },
  silver: { name: 'Silver Bars', icon: '▰', color: '#d9e1e8', material: 'silver', kind: 'bar', hint: 'Collected Silver Bars.' },
  goldOre: { name: 'Gold Ore', icon: '▰', color: '#e7bd4f', material: 'gold', kind: 'ore', hint: 'Raw Gold Ore.' },
  gold: { name: 'Gold Bars', icon: '▰', color: '#e7bd4f', material: 'gold', kind: 'bar', hint: 'Collected Gold Bars.' },
  cobaltOre: { name: 'Cobalt Ore', icon: '▰', color: '#527bd8', material: 'cobalt', kind: 'ore', hint: 'Raw Cobalt Ore.' },
  cobalt: { name: 'Cobalt Bars', icon: '▰', color: '#527bd8', material: 'cobalt', kind: 'bar', hint: 'Collected Cobalt Bars.' },
  titaniumOre: { name: 'Titanium Ore', icon: '▰', color: '#b8c8d2', material: 'titanium', kind: 'ore', hint: 'Raw Titanium Ore.' },
  titanium: { name: 'Titanium Bars', icon: '▰', color: '#b8c8d2', material: 'titanium', kind: 'bar', hint: 'Collected Titanium Bars.' },
  iridiumOre: { name: 'Iridium Ore', icon: '▰', color: '#8c78d8', material: 'iridium', kind: 'ore', hint: 'Raw Iridium Ore.' },
  iridium: { name: 'Iridium Bars', icon: '▰', color: '#8c78d8', material: 'iridium', kind: 'bar', hint: 'Collected Iridium Bars.' },
  palladiumOre: { name: 'Palladium Ore', icon: '▰', color: '#c9eee7', material: 'palladium', kind: 'ore', hint: 'Raw Palladium Ore.' },
  palladium: { name: 'Palladium Bars', icon: '▰', color: '#c9eee7', material: 'palladium', kind: 'bar', hint: 'Collected Palladium Bars.' },
  uraniumOre: { name: 'Uranium Ore', icon: '▰', color: '#83d95b', material: 'uranium', kind: 'ore', hint: 'Raw Uranium Ore.' },
  uranium: { name: 'Uranium Bars', icon: '▰', color: '#83d95b', material: 'uranium', kind: 'bar', hint: 'Collected Uranium Bars.' },
  platinumOre: { name: 'Platinum Ore', icon: '▰', color: '#e3e4dc', material: 'platinum', kind: 'ore', hint: 'Raw Platinum Ore.' },
  platinum: { name: 'Platinum Bars', icon: '▰', color: '#e3e4dc', material: 'platinum', kind: 'bar', hint: 'Collected Platinum Bars.' },
  tungstenOre: { name: 'Tungsten Ore', icon: '▰', color: '#6f7780', material: 'tungsten', kind: 'ore', hint: 'Raw Tungsten Ore.' },
  tungsten: { name: 'Tungsten Bars', icon: '▰', color: '#6f7780', material: 'tungsten', kind: 'bar', hint: 'Collected Tungsten Bars.' },
  osmiumOre: { name: 'Osmium Ore', icon: '▰', color: '#7098ad', material: 'osmium', kind: 'ore', hint: 'Raw Osmium Ore.' },
  osmium: { name: 'Osmium Bars', icon: '▰', color: '#7098ad', material: 'osmium', kind: 'bar', hint: 'Collected Osmium Bars.' },
  neutroniumOre: { name: 'Neutronium Ore', icon: '▰', color: '#9a8cff', material: 'neutronium', kind: 'ore', hint: 'Raw Neutronium Ore.' },
  neutronium: { name: 'Neutronium Bars', icon: '▰', color: '#9a8cff', material: 'neutronium', kind: 'bar', hint: 'Collected Neutronium Bars.' },
  scrap: { name: 'Scrap', icon: '⚙', color: '#b9c4d6', hint: 'Levels up weapons and drones.' },
  data: { name: 'Research Data', icon: '◈', color: '#5ee6ff', hint: 'Spent in the research tree.' },
  cores: { name: 'Boss Cores', icon: '⬢', color: '#ff5fa2', hint: 'From bosses. Forges and tunes modules, unlocks heavy weapons.' },
  matter: { name: 'Alien Matter', icon: '✺', color: '#6dff8e', hint: 'From Machine Territory onward. Alien tech.' },
  shards: { name: 'Chrono Shards', icon: '◆', color: '#b69cff', hint: 'Earned by rewinding. Permanent upgrades.' },
  frags: { name: 'Relic Fragments', icon: '✧', color: '#ffe066', hint: 'Rare. Permanent relics.' },
  sigils: { name: 'Stellar Sigils', icon: '✹', color: '#ffffff', hint: 'Earned by ascending.' },
};
