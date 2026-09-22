// Shared reward formulas used by both live combat and analytic/offline simulation.
import { G } from '@last-orbit/core/game.js';

/** Boss Core payout. Mini bosses always pay exactly one; sector bosses receive Core Extraction bonuses. */
export function bossCoreReward(def) {
  if (!def) return 0;
  if (def.mini) return 1;
  const base = def.cores || 0;
  return base > 0 ? base * G.sheet.n('coreGain') + G.sheet.n('coreBonus') : 0;
}
