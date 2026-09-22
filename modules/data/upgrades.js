// Credit upgrades. type 'mult': stat ×(1 + per·lvl)·ms^milestones   type 'add': stat + per·lvl + msAdd·milestones
// special: {level: {desc, fx:[[stat, op, value]]}} replaces the generic milestone text at that level.
// show: fmt hint for the card: 'x' multiplier, '%' percent, 'n' count, '/s' percent per second.
export const UPGRADE_CATS = [['off', 'Offence'], ['def', 'Defence'], ['eco', 'Economy'], ['sys', 'Systems']];
export const UPGRADES = [
  // ---- offence ----
  { id: 'dmg', cat: 'off', name: 'Weapon damage', stat: 'damage', type: 'mult', per: 0.25, ms: 2, show: 'x', cost: [5, 1.075], desc: 'All weapons hit harder.' },
  { id: 'rate', cat: 'off', name: 'Fire rate', stat: 'fireRate', type: 'mult', per: 0.02, ms: 1.12, max: 200, show: 'x', cost: [15, 1.1], desc: 'All weapons cycle faster.',
    special: { 50: { desc: 'Burst fire: 15% chance to fire a second volley', fx: [['f.burst', 'add', 0.15]] }, 175: { desc: 'Burst chance 30%', fx: [['f.burst', 'add', 0.15]] } } },
  { id: 'critc', cat: 'off', name: 'Critical chance', stat: 'critChance', type: 'add', per: 0.005, msAdd: 0.02, max: 80, show: '%', cost: [30, 1.12], wave: 3, desc: 'Chance for a hit to be critical.' },
  { id: 'critd', cat: 'off', name: 'Critical damage', stat: 'critDmg', type: 'add', per: 0.05, msAdd: 0.5, show: 'x+', cost: [40, 1.09], wave: 3, desc: 'Extra damage on critical hits.',
    special: { 25: { desc: 'Critical hits give 0.5 Energy', fx: [['f.critEnergy', 'add', 0.5]] } } },
  { id: 'bossd', cat: 'off', name: 'Capital ship damage', stat: 'bossDmg', type: 'mult', per: 0.06, ms: 1.5, show: 'x', cost: [200, 1.09], wave: 10, desc: 'Damage against bosses and mini bosses.' },
  { id: 'multi', cat: 'off', name: 'Multishot', stat: 'multishot', type: 'add', per: 1, max: 6, noMs: true, show: 'n', cost: [4000, 40], wave: 12, desc: '+1 projectile on projectile weapons, +15% on the rest.' },
  { id: 'pierce', cat: 'off', name: 'Piercing', stat: 'pierce', type: 'add', per: 1, max: 5, noMs: true, show: 'n', cost: [30000, 60], wave: 18, desc: 'Projectiles pass through one more enemy.' },
  { id: 'pspeed', cat: 'off', name: 'Projectile speed', stat: 'projSpeed', type: 'mult', per: 0.02, max: 50, noMs: true, show: 'x', cost: [60, 1.13], wave: 6, desc: 'Faster shots miss less.' },
  { id: 'blast', cat: 'off', name: 'Blast radius', stat: 'blast', type: 'mult', per: 0.015, max: 60, noMs: true, show: 'x', cost: [5000, 1.14], wave: 14, desc: 'Every explosion is wider.' },
  { id: 'apen', cat: 'off', name: 'Armour penetration', stat: 'armorPen', type: 'add', per: 0.01, max: 60, noMs: true, show: '%', cost: [50000, 1.13], wave: 30, desc: 'Ignore part of enemy armour.' },
  // ---- defence ----
  { id: 'hull', cat: 'def', name: 'Hull plating', stat: 'hull', type: 'mult', per: 0.22, ms: 2, show: 'x', cost: [8, 1.075], desc: 'Maximum hull.' },
  { id: 'regen', cat: 'def', name: 'Repair nanites', stat: 'hullRegen', type: 'add', per: 0.0015, msAdd: 0.005, max: 60, show: '/s', cost: [50, 1.11], wave: 4, desc: 'Hull repaired every second.' },
  { id: 'shield', cat: 'def', name: 'Shield capacity', stat: 'shieldRatio', type: 'add', per: 0.05, msAdd: 0.5, show: 'xh', cost: [120, 1.085], wave: 8, desc: 'Shields absorb damage first and recharge. Sized as a share of hull.' },
  { id: 'srech', cat: 'def', name: 'Shield recharge', stat: 'shieldRegen', type: 'add', per: 0.006, msAdd: 0.03, max: 80, show: '/s', cost: [200, 1.1], wave: 8, desc: 'Shield recharged every second once it kicks in.' },
  { id: 'armor', cat: 'def', name: 'Ablative armour', stat: 'dmgReduce', type: 'add', per: 0.004, max: 100, noMs: true, show: '%', cost: [300, 1.095], wave: 12, desc: 'Flat damage reduction.' },
  { id: 'move', cat: 'def', name: 'Thrusters', stat: 'moveSpeed', type: 'mult', per: 0.03, max: 40, noMs: true, show: 'x', cost: [40, 1.12], desc: 'Move and dodge faster.' },
  { id: 'barrier', cat: 'def', name: 'Barrier projectors', stat: 'barrier', type: 'mult', per: 0.12, ms: 1.5, show: 'x', cost: [90, 1.085], wave: 5, desc: 'The four barriers above you take more punishment.' },
  // ---- economy ----
  { id: 'credit', cat: 'eco', name: 'Bounty contracts', stat: 'creditGain', type: 'mult', per: 0.1, ms: 1.6, show: 'x', cost: [25, 1.085], desc: 'More Credits from every kill.' },
  { id: 'scrapc', cat: 'eco', name: 'Salvage rigs', stat: 'scrapChance', type: 'add', per: 0.004, max: 60, noMs: true, show: '%', cost: [150, 1.12], wave: 4, desc: 'Chance for a kill to drop Scrap.' },
  { id: 'scrapg', cat: 'eco', name: 'Scrap refining', stat: 'scrapGain', type: 'mult', per: 0.1, ms: 1.6, show: 'x', cost: [300, 1.09], wave: 4, desc: 'More Scrap per drop.' },
  { id: 'datag', cat: 'eco', name: 'Sensor arrays', stat: 'dataGain', type: 'mult', per: 0.08, ms: 1.5, show: 'x', cost: [800, 1.095], wave: 7, desc: 'More Research Data.' },
  { id: 'focus', cat: 'eco', name: 'Gunnery training', stat: 'focusMax', type: 'add', per: 0.01, msAdd: 0.1, max: 100, show: '%', cost: [500, 1.1], wave: 6, desc: 'Raises the Focus bonus you build by flying manually.' },
  { id: 'combo', cat: 'eco', name: 'Kill streak payouts', stat: 'comboMax', type: 'add', per: 0.02, msAdd: 0.2, max: 100, show: '%', cost: [1000, 1.1], wave: 9, desc: 'Raises the Credit bonus cap from kill streaks.' },
  // ---- systems: one-off purchases that change how you play ----
  { id: 'autofire', cat: 'sys', name: 'Autofire', stat: 'f.autofire', type: 'flag', max: 1, cost: [40, 1], wave: 2, desc: 'Weapons fire on their own. You can just steer.' },
  { id: 'autopilot', cat: 'sys', name: 'Autopilot', stat: 'f.autopilot', type: 'flag', max: 1, cost: [1200, 1], wave: 6, desc: 'The ship tracks targets and makes basic last-second bullet dodges when you let go. Evasive Routines improves its threat prediction. Flying it yourself still earns Focus.' },
  { id: 'buy10', cat: 'sys', name: 'Bulk orders ×10', stat: 'f.buy10', type: 'flag', max: 1, cost: [600, 1], wave: 5, desc: 'Buy 10 levels at a time.' },
  { id: 'buy25', cat: 'sys', name: 'Bulk orders ×25', stat: 'f.buy25', type: 'flag', max: 1, cost: [40000, 1], wave: 15, desc: 'Buy 25 levels at a time.' },
  { id: 'buy100', cat: 'sys', name: 'Bulk orders ×100', stat: 'f.buy100', type: 'flag', max: 1, cost: [5e6, 1], wave: 28, desc: 'Buy 100 levels at a time.' },
  { id: 'buymax', cat: 'sys', name: 'Bulk orders: Max', stat: 'f.buymax', type: 'flag', max: 1, cost: [5e9, 1], wave: 45, desc: 'Buy as many levels as you can afford.' },
  { id: 'autopush', cat: 'sys', name: 'Auto-advance', stat: 'f.autopush', type: 'flag', max: 1, cost: [15000, 1], wave: 12, desc: 'After a retreat, resume pushing forward once three waves are cleared without hull damage.' },
  { id: 'scanner', cat: 'sys', name: 'Threat readout', stat: 'f.threat', type: 'flag', max: 1, cost: [2500, 1], wave: 8, desc: 'Shows enemy hull bars and names elite modifiers.' },
];
