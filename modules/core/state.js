// Single source of truth for what gets saved. Two layers:
//   meta (salvage, workshop, unlocks, contracts, lifetime stats) persists forever;
//   run (the current sortie) exists only while a sortie is in progress and is discarded when it ends.
export const SCHEMA = 23;

export function newRun(ship, opts = {}) {
  return {
    seed: opts.seed ?? ((Math.random() * 2 ** 31) | 0), ship: ship.id, wave: 1, level: 1, xp: 0, salvage: 0, time: 0,
    weapons: { [ship.weapon]: 1 }, order: [ship.weapon], abilities: [ship.ability], cards: {}, relics: [],
    rerolls: 0, revivesUsed: 0, pendingLevels: 0, pendingRelics: 0, offer: null, relicOffer: null,
    stats: { kills: 0, bossKills: 0, flawless: 0, cards: 0 }, xpTotal: 0, score: 0,
  };
}

export function newState() {
  const now = Date.now();
  return {
    v: SCHEMA,
    meta: { created: now, lastSave: now, playTime: 0, sandbox: false, legacyChecked: false, introSeen: false, lastBackup: 0 },
    settings: { master: 0.7, music: 0.5, sfx: 0.8, shake: true, dmgNumbers: true, scanlines: false, quality: 'auto', notation: 'suffix', speed: 1, holdSides: true, haptics: true },
    salvage: 0,
    ship: 'vanguard',
    pilot: { rank: 1, xp: 0, name: '' }, // name: the pilot's callsign, asked for on first launch
    paints: { factory: 1 },
    paint: 'factory',
    banners: { none: 1 },
    banner: 'none',
    threat: 0,
    warp: 1,        // sector to start sorties in (1 = the beginning)
    intel: {},      // boss id → times that boss has defeated the pilot (boss intel)
    // Counterattack: stars per stage (normal / hard), best scores, Alien Cores and the Alien Tech bought with them.
    stationName: '', // what the pilot calls the station they are rebuilding
    stationPeak: {}, // the highest level each Workshop upgrade has ever reached: the station never un-builds a module
    counter: { unlocked: false, stars: {}, hard: {}, best: {}, cores: 0, tech: {}, checkpoints: {} }, // checkpoints: '6' / '6h' → pilot level saved past the mini-boss
    siege: { stars: {}, best: {}, won: {}, wins: 0 }, // Station Siege: stars and best score per tier, tiers won
    // Overhaul (prestige): rank, unspent Blueprints, blueprint levels, escorts flown, deepest wave since the last Overhaul.
    prestige: { level: 0, bp: 0, bpEarned: 0, tech: {}, escorts: [], cycleBest: 0 },
    trail: 'none',
    daily: { day: '', done: false, wave: 0, streak: 0, lastDay: '', best: 0 },
    mastery: {},
    workshop: {},
    unlocked: { weapons: { cannon: 1 }, abilities: { overdrive: 1 }, ships: { vanguard: 1 } },
    contracts: {},
    stats: { kills: 0, bossKills: 0, sectorBosses: 0, bestWave: 0, bestSector: 1, sectorsCleared: 0, sorties: 0, maxLevel: 1, flawless: 0, maxRank: 1, maxDrones: 0, maxWeapons: 1, bestSalvage: 0, totalSalvage: 0, deaths: 0, cards: 0, threatClear: 0, dailies: 0, bestStreak: 0, maxMastery: 1, shipsOwned: 1,
      bestScore: 0, bestKills: 0, longestRun: 0, perfectSectors: 0, flawlessBosses: 0, soloWave: 0, maxedWeapons: 0, maxRelics: 0, fusions: 0, signatures: 0, counterStars: 0, counterBest: 0, counterHard: 0, overhauls: 0 },
    // menus: hangar menu id → 'new' (opened, explainer not yet shown) or true (seen); see data/menus.js
    seen: { enemies: {}, bosses: {}, elites: {}, medals: 0, records: true, menus: {}, menusInit: false, callsign: false, stationDone: null, intro: false, comms: {}, commsInit: false }, // stationDone: Overhaul rank the finished station was last celebrated at
    // Records: the local top 10 sorties by score and each ship's best. Medals: achievement id → tiers earned.
    records: { top: [], ships: {} },
    medals: {},
    history: [],
    run: null,
  };
}

/** Fill in anything missing from an older/partial save using defaults (deep, non-destructive). */
export function withDefaults(obj, def) {
  if (obj == null) return def;
  if (Array.isArray(def) || typeof def !== 'object' || def === null) return obj;
  for (const k of Object.keys(def)) obj[k] = k in obj ? withDefaults(obj[k], def[k]) : def[k];
  return obj;
}
