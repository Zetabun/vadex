// Level-up cards. Each level-up offers a few of these; picks last for the current sortie only.
// Weapon and ability cards are generated from data/weapons.js and data/abilities.js (see progression/run.js).
// fx: [stat, op, value] applied once per stack. op 'add' adds; 'mult' stacks additively into one multiplier (×(1 + value·stacks)).
// rarity: common | rare | epic — drives colour and how often the card is offered.
export const MODS = [
  // ---- offence ----
  { id: 'm_dmg', name: 'Hot Loads', tag: 'offence', rarity: 'common', max: 8, fx: [['damage', 'mult', 0.2]], desc: '+20% damage' },
  { id: 'm_rate', name: 'Autoloader', tag: 'offence', rarity: 'common', max: 8, fx: [['fireRate', 'mult', 0.12]], desc: '+12% fire rate' },
  { id: 'm_crit', name: 'Hairline Sights', tag: 'offence', rarity: 'common', max: 5, fx: [['critChance', 'add', 0.06]], desc: '+6% critical chance' },
  { id: 'm_critd', name: 'Hollow Points', tag: 'offence', rarity: 'common', max: 5, fx: [['critDmg', 'add', 0.4]], desc: '+40% critical damage' },
  { id: 'm_pierce', name: 'Needle Rounds', tag: 'offence', rarity: 'rare', max: 3, fx: [['pierce', 'add', 1]], desc: 'Shots pierce 1 more enemy' },
  { id: 'm_multi', name: 'Splitter Muzzle', tag: 'offence', rarity: 'epic', max: 2, fx: [['multishot', 'add', 1]], desc: '+1 projectile on every gun' },
  { id: 'm_apen', name: 'Tungsten Tips', tag: 'offence', rarity: 'common', max: 3, fx: [['armorPen', 'add', 0.2]], desc: 'Ignore 20% more armour' },
  { id: 'm_boss', name: 'Giant Killer', tag: 'offence', rarity: 'common', max: 5, fx: [['bossDmg', 'mult', 0.3], ['eliteDmg', 'mult', 0.3]], desc: '+30% damage to bosses and elites' },
  { id: 'm_blast', name: 'Wide Charges', tag: 'offence', rarity: 'common', max: 4, fx: [['blast', 'mult', 0.2]], desc: '+20% blast radius' },
  { id: 'm_critex', name: 'Frag Criticals', tag: 'offence', rarity: 'epic', max: 1, fx: [['f.critExplode', 'add', 9]], desc: 'Critical hits explode' },
  { id: 'm_killex', name: 'Chain Reaction', tag: 'offence', rarity: 'rare', max: 2, fx: [['f.killExplode', 'add', 0.15]], desc: '15% of kills explode' },
  { id: 'm_bounce', name: 'Ricochet Field', tag: 'offence', rarity: 'epic', max: 1, fx: [['f.bounceAll', 'add', 1]], desc: 'Projectiles bounce to one more enemy' },
  { id: 'm_burst', name: 'Double Tap', tag: 'offence', rarity: 'rare', max: 3, fx: [['f.burst', 'add', 0.12]], desc: '12% chance to fire a volley twice' },
  { id: 'm_aim', name: 'Gyro Sights', tag: 'offence', rarity: 'common', max: 3, fx: [['aimAssist', 'add', 1]], desc: 'Guns angle toward targets' },
  // ---- defence ----
  { id: 'm_hull', name: 'Bulkheads', tag: 'defence', rarity: 'common', max: 6, fx: [['hull', 'mult', 0.25]], desc: '+25% hull, repairs 25%', heal: 0.25 },
  { id: 'm_shield', name: 'Deflector Mesh', tag: 'defence', rarity: 'common', max: 5, fx: [['shieldRatio', 'add', 0.3]], desc: 'Shield +30% of hull' },
  { id: 'm_regen', name: 'Nanite Swarm', tag: 'defence', rarity: 'common', max: 4, fx: [['hullRegen', 'add', 0.008]], desc: 'Repair 0.8% hull a second' },
  { id: 'm_leech', name: 'Siphon Rounds', tag: 'defence', rarity: 'rare', max: 3, fx: [['lifeSteal', 'add', 0.03]], desc: 'Heal 3% of damage dealt' },
  { id: 'm_armour', name: 'Ablative Plating', tag: 'defence', rarity: 'common', max: 4, fx: [['dmgReduce', 'add', 0.08]], desc: 'Take 8% less damage' },
  { id: 'm_srech', name: 'Fast Capacitors', tag: 'defence', rarity: 'rare', max: 1, fx: [['f.fireRegen', 'add', 1], ['shieldRegen', 'mult', 0.5]], desc: 'Shields recharge even under fire', needShield: true },
  { id: 'm_barrier', name: 'Hardened Bunkers', tag: 'defence', rarity: 'common', max: 3, fx: [['barrier', 'mult', 0.5], ['barrierRegen', 'add', 0.02]], desc: 'Bunkers +50% tougher and self-repair' },
  { id: 'm_last', name: 'Last Stand', tag: 'defence', rarity: 'rare', max: 1, fx: [['f.lastStand', 'add', 1]], desc: 'Survive one killing blow per wave' },
  // ---- utility ----
  { id: 'm_speed', name: 'Vector Thrusters', tag: 'utility', rarity: 'common', max: 3, fx: [['moveSpeed', 'mult', 0.15]], desc: '+15% move speed' },
  { id: 'm_magnet', name: 'Tractor Beam', tag: 'utility', rarity: 'common', max: 3, fx: [['magnet', 'mult', 0.5]], desc: '+50% pickup range' },
  { id: 'm_xp', name: 'Combat Analysis', tag: 'utility', rarity: 'common', max: 4, fx: [['xpGain', 'mult', 0.15]], desc: '+15% experience' },
  { id: 'm_salvage', name: 'Scavenger Nets', tag: 'utility', rarity: 'common', max: 4, fx: [['salvageGain', 'mult', 0.2]], desc: '+20% salvage' },
  { id: 'm_drone', name: 'Wingman', tag: 'utility', rarity: 'rare', max: 3, fx: [['drones', 'add', 1]], desc: '+1 attack drone' },
  { id: 'm_droned', name: 'Drone Uplink', tag: 'utility', rarity: 'common', max: 4, fx: [['droneDmg', 'mult', 0.4]], desc: '+40% drone damage', needDrones: true },
  { id: 'm_cd', name: 'Quick Cycling', tag: 'utility', rarity: 'common', max: 4, fx: [['abilityCd', 'mult', -0.12]], desc: 'Abilities recharge 12% faster' },
  { id: 'm_power', name: 'Capacitor Bank', tag: 'utility', rarity: 'common', max: 4, fx: [['abilityPower', 'mult', 0.25]], desc: '+25% ability power' },
];

export const RARITY = {
  common: { name: 'Common', weight: 10, color: '#8fb3ff' },
  rare: { name: 'Rare', weight: 4.5, color: '#5ee6ff' },
  epic: { name: 'Epic', weight: 1.6, color: '#d68cff' },
  evo: { name: 'Evolution', weight: 0, color: '#ffc857' },
  signature: { name: 'Signature', weight: 0, color: '#ff9e5e' },
  fusion: { name: 'Fusion', weight: 0, color: '#ff8bff' },
};
export const MOD_BY_ID = Object.fromEntries(MODS.map((m) => [m.id, m]));
