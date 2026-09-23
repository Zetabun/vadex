// A single-target sustained estimate from the same weapon config combat fires.
// Splash, chain hits, burns, armour, temporary buffs and accuracy are situational.
import { Big } from '@last-orbit/core/big.js';
import { fmt } from '@last-orbit/core/format.js';

export function weaponReadout(config) {
  if (!config) return null;
  const rate = Math.max(0, config.rate || 0);
  const projectiles = Math.max(1, Math.floor(config.proj || 1));
  const critChance = Math.max(0, Math.min(1, config.critChance || 0));
  const critDamage = Math.max(1, config.critMult || 1);
  const dps = Big.from(config.dmg || 0).mul(rate * projectiles * (1 + critChance * (critDamage - 1)));
  return {
    damage: fmt(config.dmg || 0),
    critRate: `${fmt(critChance * 100, 1)}%`,
    critDamage: `×${fmt(critDamage, 2)}`,
    fireRate: `${fmt(rate, 2)}/s`,
    projectiles,
    dps,
    dpsText: fmt(dps),
  };
}

export function loadoutDps(ids, configs) {
  return ids.filter(Boolean).reduce((sum, id) => sum.add(weaponReadout(configs[id])?.dps || 0), Big.ZERO);
}
