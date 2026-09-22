// Every tunable number lives here (or in the other /data tables). See docs/BALANCING.md.
import { Big } from '@last-orbit/core/big.js';

export const TICK = 1 / 60;
export const FIELD = { W: 100, H: 150, PLAYER_Y: 9, BARRIER_Y: 27, LAND_Y: 15, TOP: 140, SPAWN_Y: 165 };

export const BAL = {
  // enemy scaling per wave
  // Enemy stats scale as base x (1 + linear·(w-1))^poly x growth^(w-1) x sectorJump^sector.
  // The polynomial term tracks the player's own early compounding (many multiplicative upgrades at once);
  // the exponential term is what eventually walls a run and sends you to the Chrono Core. See docs/BALANCING.md.
  scaleLinear: 0.25, polyCap: 45,
  hpBase: 9, hpGrowth: 1.11, hpPoly: 10,
  rewardBase: 2.2, rewardGrowth: 1.09, rewardPoly: 5,
  dmgBase: 7, dmgGrowth: 1.07, dmgPoly: 6,
  sectorHpJump: 2.2, sectorRewardJump: 2.4, sectorDmgJump: 1.6,
  eliteHp: 6, eliteReward: 12, bossReward: 40, miniReward: 18,
  // drops
  scrapChance: 0.12, scrapShare: 0.35, clearScrap: 0.4, cleanSweep: 0.1, researchedCleanSweep: 0.5, dataPerWave: 3, dataGrowth: 1.075,
  matterChance: 0.06, matterFromSector: 3,
  // player baseline
  hull: 100, shieldDelay: 3,
  landDamage: 0.25, deathRollback: 2,
  // active play
  focusMax: 0.5, focusGain: 0.12, focusDecay: 0.2, manualWindow: 2.5,
  weakMult: 3, paintMult: 1.5, paintDur: 4, grazeEnergy: 4, grazeRadius: 7,
  comboWindow: 3.5, comboStep: 0.02,
  // wave pacing
  waveGap: 1.0, formationEnter: 1.0, formSpeed: 5, formStep: 5, enrage: 80,
  boonEvery: 10, anomalyMin: 7, anomalyMax: 13,
  // prestige
  rewindWave: 30, shardDiv: 10, shardPow: 2.35, ascendShards: 2.5e4,
  // offline
  offlineEff: 0.5, offlineCapH: 0.5, offlineWaveOverhead: 5.5,
  // modules
  invCap: 40,
};

export const MILESTONES = [10, 25, 50, 100, 175, 250, 400, 600, 1000, 1500, 2500];

/** Sector index (0-based) and position for an absolute wave number. Endless sectors repeat after the last. */
// The polynomial term models the first 45 waves, where the player unlocks new multiplicative systems every few waves;
// past the cap only the exponential term grows, which is what eventually walls a run.
const poly = (w, p) => Math.pow(1 + (Math.min(w, BAL.polyCap) - 1) * BAL.scaleLinear, p);
// Hull and incoming damage deliberately use separate opening ramps.
//
// Manual/mobile play now has real early spending pressure (Smelter, Autofire and other useful
// systems), so the old hull ramp overtook practical player damage around waves 4-7 even when the
// player spent aggressively on offence. The extended hull ramp smooths that onboarding region and
// blends back to the established long-run curve by wave 14. Enemy damage keeps the proven v1.3
// opening values so this is a time-to-kill correction, not a blanket difficulty nerf.
const OPENING_HP_SCALE = [0.85, 0.35, 0.16, 0.09, 0.07, 0.075, 0.095, 0.15, 0.25, 0.40, 0.60, 0.80, 0.95];
const OPENING_DMG_SCALE = [0.85, 0.70, 0.45, 0.40, 0.60, 0.80, 0.95];
export const openingHpScale = (w) => OPENING_HP_SCALE[w - 1] ?? 1;
export const openingDamageScale = (w) => OPENING_DMG_SCALE[w - 1] ?? 1;
export function enemyHp(w, sectorIdx) {
  return Big.pow(BAL.hpGrowth, w - 1).mul(BAL.hpBase * openingHpScale(w) * poly(w, BAL.hpPoly) * Math.pow(BAL.sectorHpJump, sectorIdx));
}
export function enemyReward(w, sectorIdx) {
  return Big.pow(BAL.rewardGrowth, w - 1).mul(BAL.rewardBase * poly(w, BAL.rewardPoly) * Math.pow(BAL.sectorRewardJump, sectorIdx));
}
export function enemyDmg(w, sectorIdx) {
  return Big.pow(BAL.dmgGrowth, w - 1).mul(BAL.dmgBase * openingDamageScale(w) * poly(w, BAL.dmgPoly) * Math.pow(BAL.sectorDmgJump, sectorIdx));
}
export function dataPerWave(w) { return Big.pow(BAL.dataGrowth, w - 1).mul(BAL.dataPerWave); }
/** Chrono shards for a rewind at best wave w (before multipliers). */
export function shardsForWave(w) {
  if (w < BAL.rewindWave) return Big.ZERO;
  return Big.from(Math.pow((w - BAL.rewindWave + BAL.shardDiv) / BAL.shardDiv, BAL.shardPow) * 3).mul(Big.pow(1.012, Math.max(0, w - 100)));
}
export function sigilsForShards(totalShards) {
  const l = Big.from(totalShards).log10() - Math.log10(BAL.ascendShards);
  return l < 0 ? 0 : Math.floor(Math.pow(2.5, l) * 6);
}
export function milestonesReached(lvl) { let n = 0; for (const m of MILESTONES) if (lvl >= m) n++; return n; }
export function nextMilestone(lvl) { for (const m of MILESTONES) if (lvl < m) return m; return null; }
