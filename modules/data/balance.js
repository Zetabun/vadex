// Every tunable number for a sortie lives here (or in the other /data tables).
// A sortie is a single run: waves get harder, the pilot levels up and picks cards, and death ends it.
import { Big } from '@last-orbit/core/big.js';

export const TICK = 1 / 60;
export const FIELD = { W: 100, H: 150, PLAYER_Y: 9, BARRIER_Y: 27, LAND_Y: 15, TOP: 140, SPAWN_Y: 165 };

export const BAL = {
  // enemy scaling: base × growth^(wave-1) × sectorJump^sector
  hpBase: 8, hpGrowth: 1.16, sectorHpJump: 1.35,
  dmgBase: 7, dmgGrowth: 1.055, sectorDmgJump: 1.2,
  eliteHp: 5, eliteReward: 6, bossReward: 40, miniReward: 18,
  // salvage (the permanent currency)
  salvageChance: 0.16, salvagePerWave: 0.12, clearSalvage: 3, clearSalvagePerWave: 0.7, bossSalvage: 30, miniSalvage: 12,
  // experience
  xpPerKill: 1, xpSectorBonus: 0.35, xpBase: 5, xpLinear: 3.2, xpCurve: 1.55, xpCurveMul: 0.55,
  // pickups
  magnet: 16, pickupCap: 140,
  // player baseline
  hull: 100, shieldDelay: 3, landDamage: 0.2,
  // active play
  focusMax: 0.25, focusGain: 0.12, focusDecay: 0.2, manualWindow: 2.5,
  weakMult: 3, paintMult: 1.5, paintDur: 4, grazeEnergy: 4, grazeRadius: 7,
  comboWindow: 3.5, comboStep: 0.02,
  // wave pacing
  waveGap: 1.1, formationEnter: 0.9, formSpeed: 5.5, formStep: 5, enrage: 70,
  // run
  sectorWaves: 10, maxWeapons: 4, maxAbilities: 2, maxRank: 7, cardChoices: 3,
};

// Enemy stats are multiples of these per-wave baselines (see data/enemies.js).
export function enemyHp(w, sectorIdx) {
  return Big.pow(BAL.hpGrowth, w - 1).mul(BAL.hpBase * Math.pow(BAL.sectorHpJump, sectorIdx));
}
export function enemyDmg(w, sectorIdx) {
  return Big.pow(BAL.dmgGrowth, w - 1).mul(BAL.dmgBase * Math.pow(BAL.sectorDmgJump, sectorIdx));
}
/** Salvage carried by one dropped canister at this wave. */
export const salvageDrop = (w) => Math.max(1, Math.round(1 + w * BAL.salvagePerWave));
/** Salvage awarded for clearing a wave. */
export const clearSalvage = (w) => Math.round(BAL.clearSalvage + w * BAL.clearSalvagePerWave);
/** XP to go from level L to L+1. */
export const xpToNext = (L) => Math.round(BAL.xpBase + BAL.xpLinear * (L - 1) + BAL.xpCurveMul * Math.pow(L - 1, BAL.xpCurve));
/** XP from a kill (rewardMul is the enemy's reward weight: 1 for a scout, ~40 for a boss). */
export const killXp = (rewardMul, sectorIdx) => rewardMul * BAL.xpPerKill * (1 + sectorIdx * BAL.xpSectorBonus);
