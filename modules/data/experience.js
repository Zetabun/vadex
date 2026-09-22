// Ship XP curve and reward model. Pure data/math so combat, UI, offline simulation and the
// stat sheet can share exactly the same progression without circular dependencies.
export const XP_CURVE_POWER = 1.72;
export const XP_LINEAR = 16;
export const XP_CURVE = 7;

/** Cumulative XP required to have reached a given level (level 1 starts at 0 XP). */
export function xpForLevel(level) {
  const n = Math.max(0, Math.floor(level) - 1);
  return Math.round(XP_LINEAR * n + XP_CURVE * Math.pow(n, XP_CURVE_POWER));
}

export function levelFromXp(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  let lo = 1, hi = 2;
  while (xpForLevel(hi) <= xp && hi < 100000) hi *= 2;
  hi = Math.min(hi, 100000);
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (xpForLevel(mid) <= xp) lo = mid; else hi = mid;
  }
  return xpForLevel(hi) <= xp ? hi : lo;
}

export function xpProgress(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0), level = levelFromXp(xp);
  const from = xpForLevel(level), to = xpForLevel(level + 1), span = Math.max(1, to - from);
  return { level, xp, from, to, current: xp - from, needed: span, fraction: Math.max(0, Math.min(1, (xp - from) / span)) };
}

/** XP per destroyed enemy. Wave value grows sub-linearly; tougher/elite/boss reward weight matters too. */
export function killXp(wave, rewardMul = 1, { boss = false, elite = false } = {}) {
  const w = Math.max(1, Number(wave) || 1), threat = Math.pow(Math.max(0.25, Number(rewardMul) || 1), 0.30);
  const special = boss ? 1.65 : elite ? 1.25 : 1;
  return Math.max(1, Math.round(0.55 * Math.pow(w, 0.62) * threat * special));
}

/** Small completion award keeps XP moving on low-count boss/resource waves. */
export function clearXp(wave, kind = 'normal') {
  const w = Math.max(1, Number(wave) || 1), special = kind === 'boss' ? 1.8 : kind === 'mini' ? 1.4 : kind === 'elite' ? 1.2 : 1;
  return Math.max(2, Math.round((2 + Math.pow(w, 0.65)) * special));
}

/** Modest run-only proficiency bonus: meaningful, but secondary to purchased upgrades. */
export function levelBonuses(level) {
  const n = Math.max(0, Math.floor(level) - 1);
  return { damage: 1 + n * 0.008, hull: 1 + n * 0.005 };
}
