// Build synergies: every upgrade card belongs to one theme. Holding enough different cards of a theme in one sortie
// switches on its bonus (and a bigger one for the larger themes), so pilots chase a build instead of the biggest number.
// cards: MOD ids in the theme. tiers: [{ n: distinct cards needed, desc, fx: sheet modifiers (card format) }].
export const SYNERGIES = [
  { id: 'precision', name: 'Precision', color: '#ff5f7a', cards: ['m_crit', 'm_critd', 'm_aim', 'm_apen'],
    tiers: [{ n: 3, desc: '+5% critical chance, +60% critical damage', fx: [['critChance', 'add', 0.05], ['critDmg', 'add', 0.6]] },
      { n: 4, desc: 'Critical hits explode', fx: [['f.critExplode', 'add', 9]] }] },
  { id: 'demolition', name: 'Demolition', color: '#ff8a3d', cards: ['m_blast', 'm_killex', 'm_critex', 'm_boss'],
    tiers: [{ n: 3, desc: '20% more kills explode, +25% blast radius', fx: [['f.killExplode', 'add', 0.2], ['blast', 'mult', 0.25]] },
      { n: 4, desc: '+25% damage to bosses, +50% to elites', fx: [['bossDmg', 'mult', 0.25], ['eliteDmg', 'mult', 0.5]] }] },
  { id: 'barrage', name: 'Barrage', color: '#ffc857', cards: ['m_dmg', 'm_rate', 'm_multi', 'm_burst', 'm_pierce', 'm_bounce'],
    tiers: [{ n: 3, desc: '15% chance to fire every volley twice, +15% fire rate', fx: [['f.echo', 'add', 0.15], ['fireRate', 'mult', 0.15]] },
      { n: 5, desc: 'Every projectile bounces to another enemy', fx: [['f.bounceAll', 'add', 1]] }] },
  { id: 'ironclad', name: 'Ironclad', color: '#5ec8ff', cards: ['m_hull', 'm_armour', 'm_barrier', 'm_last', 'm_regen'],
    tiers: [{ n: 3, desc: 'Take 12% less damage, repair 0.4% hull a second', fx: [['dmgReduce', 'add', 0.12], ['hullRegen', 'add', 0.004]] },
      { n: 5, desc: 'Survive one killing blow every wave, take another 10% less damage', fx: [['f.lastStand', 'add', 1], ['dmgReduce', 'add', 0.1]] }] },
  { id: 'aegis', name: 'Aegis', color: '#7aa2ff', cards: ['m_shield', 'm_srech', 'm_leech'],
    tiers: [{ n: 3, desc: 'Shield +40% of hull, heal 2% of damage dealt', fx: [['shieldRatio', 'add', 0.4], ['lifeSteal', 'add', 0.02]] }] },
  { id: 'squadron', name: 'Squadron', color: '#6dffc8', cards: ['m_drone', 'm_droned', 'm_speed'],
    tiers: [{ n: 3, desc: '+1 attack drone, drones +50% damage', fx: [['drones', 'add', 1], ['droneDmg', 'mult', 0.5]] }] },
  { id: 'tactician', name: 'Tactician', color: '#ffe066', cards: ['m_cd', 'm_power', 'm_xp'],
    tiers: [{ n: 3, desc: 'Abilities recharge 20% faster and hit 30% harder', fx: [['abilityCd', 'mult', -0.2], ['abilityPower', 'mult', 0.3]] }] },
  { id: 'scavenger', name: 'Scavenger', color: '#e8a33c', cards: ['m_magnet', 'm_salvage'],
    tiers: [{ n: 2, desc: '+30% salvage, pickups fly to you from twice as far', fx: [['salvageGain', 'mult', 0.3], ['magnet', 'mult', 1]] }] },
];
export const SYNERGY_BY_ID = Object.fromEntries(SYNERGIES.map((s) => [s.id, s]));
/** The theme a card belongs to (or null). */
export const synergyOf = (cardId) => SYNERGIES.find((s) => s.cards.includes(cardId)) || null;
/** Distinct cards of a theme held in a run. */
export const synergyCount = (s, run) => s.cards.filter((id) => (run?.cards?.[id] || 0) > 0).length;
/** Tiers of a theme that are switched on in a run. */
export const activeTiers = (s, run) => { const n = synergyCount(s, run); return s.tiers.filter((t) => n >= t.n); };
