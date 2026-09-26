// Every tunable number for a sortie lives here (or in the other /data tables).
// A sortie is a single run: waves get harder, the pilot levels up and picks cards, and death ends it.
import { Big } from '@last-orbit/core/big.js';

export const TICK = 1 / 60;
export const FIELD = { W: 100, H: 150, PLAYER_Y: 9, BARRIER_Y: 27, LAND_Y: 15, TOP: 140, SPAWN_Y: 165 };

export const BAL = {
  // enemy scaling: base × growth^(wave-1) × sectorJump^sector. Health grows more slowly after lateWave,
  // once a typical build has maxed its guns, so Workshop upgrades keep pushing the wall back.
  hpBase: 8, hpGrowth: 1.175, hpLateGrowth: 1.13, lateWave: 30, sectorHpJump: 1.35,
  // early toughness: extra enemy health through the opening sectors, peaking in waves 6-12 (when early upgrade cards
  // pile up fastest) and gone by earlyWave, so the opening waves last long enough for the enemy to shoot back
  earlyHp: 1.2, earlyWave: 25,
  // opening pressure: the first waves come fuller, shoot more and march faster (not tougher), fading out by earlyPressure.until
  earlyPressure: { until: 10, budget: 6, fire: 0.6, march: 0.25 },
  // opening health: a little extra on the very first waves only (so a scout takes two or three shots, not one), gone by wave 13
  openHp: 1, openWaves: 12,
  // Enemy damage grows more slowly after dmgLateWave, so sector 6 is a climb rather than a wall for a maxed Workshop.
  dmgBase: 7, dmgGrowth: 1.045, dmgLateGrowth: 1.02, dmgLateWave: 40, sectorDmgJump: 1.15,
  eliteHp: 5, eliteReward: 6, bossReward: 40, miniReward: 18,
  // salvage (the permanent currency)
  salvageChance: 0.16, salvagePerWave: 0.12, clearSalvage: 3, clearSalvagePerWave: 0.7, bossSalvage: 30, miniSalvage: 12,
  // experience
  xpPerKill: 1, xpSectorBonus: 0.35, xpBase: 10, xpLinear: 3.2, xpCurve: 1.55, xpCurveMul: 0.55,
  // pickups
  magnet: 16, pickupCap: 140,
  // player baseline
  hull: 100, shieldDelay: 3, landDamage: 0.2,
  // repairs (shares of full hull): after every wave cleared; repair kits (the chance a kill drops one, and what it
  // repairs); how much lifesteal can repair a second; the Vanguard's Second Wind; and how long repairs over time (hull
  // regen, a repair drone) wait after a hit. v2.19: regen waits 3 s (it used to repair straight through a fight) and
  // lifesteal repairs at most 6% a second (was 8%), measured with tests/heal-probe.mjs
  waveRepair: 0.06, kitChance: 0.012, kitEliteChance: 0.35, kitHeal: 0.12, kitBossHeal: 0.35, leechBudget: 0.06, windHeal: 0.4, regenPause: 3,
  // active play
  focusMax: 0.25, focusGain: 0.12, focusDecay: 0.2, manualWindow: 2.5,
  weakMult: 3, paintMult: 1.5, paintDur: 4, grazeEnergy: 4, grazeRadius: 7,
  comboWindow: 3.5, comboStep: 0.02,
  // wave pacing
  waveGap: 1.1, formationEnter: 0.9, formSpeed: 5.5, formStep: 5, enrage: 70,
  // run
  sectorWaves: 10, maxWeapons: 4, maxAbilities: 2, maxRank: 7, cardChoices: 3,
  // dodge dash: a burst sideways with a moment of invulnerability; grazing enemy shots cools it down faster
  dashCd: 2.6, dashTime: 0.16, dashSpeed: 150, dashInvuln: 0.32, dashGraze: 0.35,
  // warp start: catch-up for each sector skipped
  warpCards: 5, warpRelics: 1,
  // boss intel: each defeat by a sector boss adds damage against it next time
  intelStep: 0.08, intelMax: 5,
};

// Enemy stats are multiples of these per-wave baselines (see data/enemies.js).
export function enemyHp(w, sectorIdx) {
  const early = Math.min(w, BAL.lateWave) - 1, late = Math.max(0, w - BAL.lateWave);
  const bump = w <= 6 ? 0.4 + 0.6 * (w - 1) / 5 : w <= 12 ? 1 : Math.max(0, (BAL.earlyWave - w) / (BAL.earlyWave - 12));
  const fresh = 1 + BAL.earlyHp * bump + BAL.openHp * Math.max(0, 1 - (w - 1) / BAL.openWaves);
  return Big.pow(BAL.hpGrowth, early).mul(Big.pow(BAL.hpLateGrowth, late)).mul(BAL.hpBase * fresh * Math.pow(BAL.sectorHpJump, sectorIdx));
}
export function enemyDmg(w, sectorIdx) {
  const early = Math.min(w, BAL.dmgLateWave) - 1, late = Math.max(0, w - BAL.dmgLateWave);
  return Big.pow(BAL.dmgGrowth, early).mul(Big.pow(BAL.dmgLateGrowth, late)).mul(BAL.dmgBase * Math.pow(BAL.sectorDmgJump, sectorIdx));
}
/** Salvage carried by one dropped canister at this wave. */
export const salvageDrop = (w) => Math.max(1, Math.round(1 + w * BAL.salvagePerWave));
/** Salvage awarded for clearing a wave. */
export const clearSalvage = (w) => Math.round(BAL.clearSalvage + w * BAL.clearSalvagePerWave);
/** XP to go from level L to L+1. */
export const xpToNext = (L) => Math.round(BAL.xpBase + BAL.xpLinear * (L - 1) + BAL.xpCurveMul * Math.pow(L - 1, BAL.xpCurve));
/** XP from a kill (rewardMul is the enemy's reward weight: 1 for a scout, ~40 for a boss). */
export const killXp = (rewardMul, sectorIdx) => rewardMul * BAL.xpPerKill * (1 + sectorIdx * BAL.xpSectorBonus);
/** How much of the opening pressure applies at wave w: 1 at wave 1, falling to 0 by BAL.earlyPressure.until. */
export const earlyPressure = (w) => Math.max(0, 1 - (w - 1) / (BAL.earlyPressure.until - 1));
