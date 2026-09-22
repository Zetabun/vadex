// Runtime Ship XP mutation. The curve itself lives in /data so the stat sheet can consume it
// without creating a core/game <-> stats circular dependency.
import { G, recalc, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { levelFromXp } from '@last-orbit/data/experience.js';
export { xpForLevel, levelFromXp, xpProgress, killXp, clearXp, levelBonuses } from '@last-orbit/data/experience.js';

export function grantXp(amount, source = 'combat') {
  const run = G.state?.run; if (!run) return { gained: 0, level: 1, levels: 0 };
  const n = Math.max(0, Math.round(Number(amount) || 0)); if (!n) return { gained: 0, level: levelFromXp(run.xp || 0), levels: 0 };
  const before = levelFromXp(run.xp || 0);
  run.xp = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Number(run.xp) || 0) + n);
  const after = levelFromXp(run.xp);
  if (after > before) {
    recalc();
    toast(`Ship Level ${after} — combat systems strengthened.`, 'good');
    bus.emit('levelUp', after, before, source);
  }
  bus.emit('xp', n, source);
  return { gained: n, level: after, levels: after - before };
}
