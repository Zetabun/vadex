// Relics: powerful one-per-sortie rewards. Every sector boss offers a choice of three.
// fx uses the same [stat, op, value] format as cards. Some relics also set special flags read by combat.
export const RELICS = [
  { id: 'r_quantum', name: 'Quantum Trigger', desc: '+40% fire rate on every gun', fx: [['fireRate', 'pow', 1.4]] },
  { id: 'r_glass', name: 'Glass Reactor', desc: '×1.9 damage, but −30% hull', fx: [['damage', 'pow', 1.9], ['hull', 'pow', 0.7]] },
  { id: 'r_aegis', name: 'Aegis Matrix', desc: 'Shield +80% of hull, recharges twice as fast', fx: [['shieldRatio', 'add', 0.8], ['shieldRegen', 'pow', 2]] },
  { id: 'r_phoenix', name: 'Phoenix Core', desc: 'Revive once at full hull when destroyed', fx: [['revives', 'add', 1]] },
  { id: 'r_midas', name: 'Midas Hold', desc: '+75% salvage for the rest of the sortie', fx: [['salvageGain', 'pow', 1.75]] },
  { id: 'r_swarm', name: 'Hive Beacon', desc: '+2 attack drones, +50% drone damage', fx: [['drones', 'add', 2], ['droneDmg', 'pow', 1.5]] },
  { id: 'r_barrel', name: 'Overclocked Barrels', desc: '+1 projectile on every gun', fx: [['multishot', 'add', 1]] },
  { id: 'r_chain', name: 'Singularity Rounds', desc: '30% of kills explode, +25% blast radius', fx: [['f.killExplode', 'add', 0.3], ['blast', 'pow', 1.25]] },
  { id: 'r_predict', name: 'Precog Array', desc: 'Guns lead their targets and turn hard toward them', fx: [['aimAssist', 'add', 3], ['f.predict', 'add', 1]] },
  { id: 'r_crit', name: 'Assassin Protocol', desc: '+20% critical chance, +100% critical damage', fx: [['critChance', 'add', 0.2], ['critDmg', 'add', 1]] },
  { id: 'r_chrono', name: 'Chrono Lens', desc: 'Abilities recharge 40% faster and gain a charge', fx: [['abilityCd', 'mult', -0.4], ['abilityCharges', 'add', 1]] },
  { id: 'r_titan', name: 'Titan Frame', desc: '+80% hull, take 15% less damage', fx: [['hull', 'pow', 1.8], ['dmgReduce', 'add', 0.15]] },
  { id: 'r_leech', name: 'Vampire Coil', desc: 'Heal 6% of damage dealt, +1% hull regen', fx: [['lifeSteal', 'add', 0.06], ['hullRegen', 'add', 0.01]] },
  { id: 'r_scholar', name: 'Black Box', desc: '+50% experience, +1 card choice', fx: [['xpGain', 'pow', 1.5], ['cardChoices', 'add', 1]] },
  { id: 'r_giant', name: 'Executioner Rounds', desc: '×2 damage to bosses and elites', fx: [['bossDmg', 'pow', 2], ['eliteDmg', 'pow', 2]] },
];
export const RELIC_BY_ID = Object.fromEntries(RELICS.map((r) => [r.id, r]));
