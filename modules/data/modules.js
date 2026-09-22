// Ship modules. One slot per type, plus Experimental slots from the Rewind tree. Modules survive rewinds.
// A module = type primary (scaled by rarity and level) + rarity-many random mods + maybe a set tag + maybe a special (epic+).
export const RARITIES = [
  { id: 0, name: 'Common', color: '#9fb0c8', mods: 0, mult: 1, w: 60, salvage: 0 },
  { id: 1, name: 'Uncommon', color: '#5dde8a', mods: 1, mult: 1.5, w: 28, salvage: 0 },
  { id: 2, name: 'Rare', color: '#5ea9ff', mods: 2, mult: 2.2, w: 9, salvage: 1 },
  { id: 3, name: 'Epic', color: '#c77dff', mods: 2, mult: 3.2, w: 2.5, salvage: 2, special: 0.6 },
  { id: 4, name: 'Legendary', color: '#ffb547', mods: 3, mult: 4.5, w: 0.5, salvage: 5, special: 1 },
  { id: 5, name: 'Exotic', color: '#ff5fa2', mods: 3, mult: 7, w: 0, salvage: 12, special: 1 },
];
export const MODULE_TYPES = {
  weaponmod: { name: 'Weapon mod', icon: '▲', primary: ['damage', 'pow', 0.12], text: 'damage' },
  reactor:   { name: 'Reactor', icon: '◉', primary: ['fireRate', 'pow', 0.05], text: 'fire rate' },
  targeting: { name: 'Targeting computer', icon: '⌖', primary: ['critDmg', 'add', 0.3], text: 'critical damage' },
  shieldgen: { name: 'Shield generator', icon: '⬡', primary: ['shieldRatio', 'add', 0.25], text: 'shield (× hull)' },
  engine:    { name: 'Engine', icon: '➤', primary: ['hull', 'pow', 0.12], text: 'hull' },
  dronebay:  { name: 'Drone control', icon: '⁂', primary: ['droneDmg', 'pow', 0.15], text: 'drone damage' },
  processor: { name: 'Resource processor', icon: '⛁', primary: ['creditGain', 'pow', 0.12], text: 'Credits' },
  experimental: { name: 'Experimental', icon: '✧', primary: ['bossDmg', 'pow', 0.15], text: 'boss damage', anySlot: true },
};
export const MODULE_SLOTS = ['weaponmod', 'reactor', 'targeting', 'shieldgen', 'engine', 'dronebay', 'processor'];
// random secondary modifiers: [stat, op, value at rarity mult 1, label]
export const MODULE_MODS = [
  ['critChance', 'add', 0.02, 'critical chance', '%'], ['scrapGain', 'pow', 0.1, 'Scrap', 'x'], ['dataGain', 'pow', 0.1, 'Research Data', 'x'],
  ['eliteDmg', 'pow', 0.15, 'elite damage', 'x'], ['blast', 'pow', 0.06, 'blast radius', 'x'], ['moveSpeed', 'pow', 0.08, 'move speed', 'x'],
  ['energyRegen', 'add', 0.5, 'Energy/s', 'n'], ['abilityCd', 'mult', -0.03, 'ability cooldown', '%'], ['hullRegen', 'add', 0.002, 'hull repair/s', '%'],
  ['shieldRegen', 'add', 0.02, 'shield recharge/s', '%'], ['armorPen', 'add', 0.05, 'armour penetration', '%'], ['projSpeed', 'pow', 0.08, 'projectile speed', 'x'],
  ['focusMax', 'add', 0.06, 'Focus cap', '%'], ['shardGain', 'pow', 0.04, 'Chrono Shards', 'x'], ['matterGain', 'pow', 0.1, 'Alien Matter', 'x'],
];
// specials: mechanics, not numbers
export const MODULE_SPECIALS = [
  { id: 'sp_proj', text: '+1 projectile', fx: [['multishot', 'add', 1]] },
  { id: 'sp_retarget', text: 'Missiles retarget when their target dies', fx: [['f.retargetAll', 'add', 1]] },
  { id: 'sp_critshield', text: 'Critical kills recharge 2% shield', fx: [['f.critShield', 'add', 0.02]] },
  { id: 'sp_tenth', text: 'Every tenth kill drops bonus Scrap', fx: [['f.tenthScrap', 'add', 1]] },
  { id: 'sp_dronecrit', text: 'Drones gain your critical modifiers', fx: [['f.droneCrit', 'add', 1]] },
  { id: 'sp_phase', text: 'Energy weapons penetrate shields', fx: [['f.shieldPierce', 'add', 1]] },
  { id: 'sp_pierce', text: 'Projectiles pierce +1 enemy', fx: [['pierce', 'add', 1]] },
  { id: 'sp_killex', text: '10% of kills explode', fx: [['f.killExplode', 'add', 0.1]] },
  { id: 'sp_charge', text: 'Abilities hold +1 charge', fx: [['abilityCharges', 'add', 1]] },
  { id: 'sp_bay', text: '+1 drone bay', fx: [['droneBays', 'add', 1]] },
];
export const MODULE_SETS = {
  vanguard: { name: 'Vanguard', two: { text: '+40% damage', fx: [['damage', 'pow', 1.4]] }, four: { text: 'Every 5th volley of every weapon fires twice', fx: [['f.setVolley', 'add', 1]] } },
  custodian: { name: 'Custodian', two: { text: '+50% hull', fx: [['hull', 'pow', 1.5]] }, four: { text: 'Absorbed shield damage is reflected ×3 by the Retaliation beam', fx: [['f.retaliate', 'add', 3]] } },
  prospector: { name: 'Prospector', two: { text: '+40% Credits and Scrap', fx: [['creditGain', 'pow', 1.4], ['scrapGain', 'pow', 1.4]] }, four: { text: 'Overkill damage pays out +25% as Credits', fx: [['f.overkill', 'add', 0.25]] } },
  hivemind: { name: 'Hivemind', two: { text: '+60% drone damage', fx: [['droneDmg', 'pow', 1.6]] }, four: { text: '+2 drone bays', fx: [['droneBays', 'add', 2]] } },
};
export const MODULE_NAMES = { weaponmod: ['Coil', 'Breech', 'Accelerator', 'Bore'], reactor: ['Cell', 'Pile', 'Core', 'Dynamo'], targeting: ['Lens', 'Oracle', 'Tracker', 'Cortex'], shieldgen: ['Ward', 'Lattice', 'Mantle', 'Screen'], engine: ['Drive', 'Vector', 'Frame', 'Keel'], dronebay: ['Roost', 'Uplink', 'Hive', 'Relay'], processor: ['Smelter', 'Ledger', 'Refinery', 'Sifter'], experimental: ['Paradox', 'Fragment', 'Prototype', 'Shard'] };
export const MODULE_PREFIX = ['Surplus', 'Tuned', 'Precision', 'Masterwork', 'Mythic', 'Precursor'];
