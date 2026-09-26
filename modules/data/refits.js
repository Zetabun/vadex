// Ship refits: each ship's own upgrade track, paid in materials (data/materials.js) and kept for good (an Overhaul
// leaves them alone). Five steps a ship, the same shape for each but named for its own gun, ability and trait: its gun,
// its frame, its ability, its trait, and last a void-tempered hull. The early steps need Alloy (sectors 1-2), the middle
// ones Crystal (3-4), the last Void shards (5-6 and the Deep Void). A refit only counts while you fly that ship.
import { WEAPONS } from '@last-orbit/data/weapons.js';
import { ABILITIES } from '@last-orbit/data/abilities.js';
import { SHIP_BY_ID } from '@last-orbit/data/ships.js';

/** What the trait refit (a quarter stronger: passivePower 1.25) does for each ship's trait, in a line. */
export const TRAIT_REFIT = {
  secondwind: 'Second Wind repairs 50% (was 40%)', momentum: 'Momentum builds to +37% fire rate (was +30%)', stalwart: 'Stalwart blocks 37% of damage (was 30%)',
  static: 'Static Discharge arcs every 5th kill (was 6th)', execute: 'Executioner deals +75% (was +60%)', meltdown: 'Meltdown bursts hit 25% harder',
};
export const PASSIVE_REFIT = 1.25;
/** The five steps: what each costs and does (name and line filled in per ship by refitStep). */
export const REFIT_STEPS = [
  { cost: { alloy: 25 }, fx: [['damage', 'pow', 1.1]], line: '+10% damage' },
  { cost: { alloy: 50 }, fx: [['hull', 'pow', 1.12]], line: '+12% hull' },
  { cost: { alloy: 20, crystal: 40 }, fx: [['abilityCd', 'pow', 0.85]], line: 'Its ability recharges 15% faster' },
  { cost: { crystal: 60 }, fx: [['passivePower', 'pow', PASSIVE_REFIT]] },
  { cost: { crystal: 30, shard: 40 }, fx: [['damage', 'pow', 1.15], ['fireRate', 'pow', 1.1]], line: '+15% damage, +10% fire rate' },
];
export const REFIT_MAX = REFIT_STEPS.length;
/** Refit step n (1-5) for a ship: its name, what it does, what it costs and its stat effects. */
export function refitStep(shipId, n) {
  const s = SHIP_BY_ID[shipId], d = REFIT_STEPS[n - 1]; if (!s || !d) return null;
  const name = [`${WEAPONS[s.weapon]?.name || 'Gun'} tuning`, 'Reinforced frame', `${ABILITIES[s.ability]?.name || 'Ability'} capacitors`, `${s.passive.name} refit`, 'Void-tempered hull'][n - 1];
  return { n, name, line: n === 4 ? TRAIT_REFIT[s.passive.id] || `${s.passive.name} a quarter stronger` : d.line, cost: d.cost, fx: d.fx };
}
