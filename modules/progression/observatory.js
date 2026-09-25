// The Observatory's chart of the Deep Void (data/observatory.js): the depths a pilot has reached, which of them are
// charted, and charting one (its Blueprints and paint paid). A depth reached before the Observatory is open waits there.
import { G } from '@last-orbit/core/game.js';
import { VOID_MARKS, MARK_BY_WAVE, observatoryOpen } from '@last-orbit/data/observatory.js';

const chart = (st) => (st.observatory ||= { charted: {} });
export const isCharted = (st, m) => !!st.observatory?.charted?.[m.wave];
/** Depths reached (the best wave is past them) and not charted yet. */
export const chartable = (st = G.state) => VOID_MARKS.filter((m) => (st.stats.bestWave || 0) >= m.wave && !isCharted(st, m));
/** Chart a depth: its constellation lit, its Blueprints and paint paid. Returns { bp, paint, name }, or null. */
export function chartMark(st = G.state, wave) {
  const m = MARK_BY_WAVE[wave]; if (!m || !observatoryOpen(st) || (st.stats.bestWave || 0) < wave || isCharted(st, m)) return null;
  chart(st).charted[wave] = Date.now(); st.prestige.bp += m.bp; st.prestige.bpEarned = (st.prestige.bpEarned || 0) + m.bp;
  if (m.paint) st.paints[m.paint] ||= Date.now();
  return { bp: m.bp, paint: m.paint || null, name: m.name };
}
/** The depths a sortie reached for the first time: past the old best, up to the wave it got to. */
export const newMarks = (prevBest, wave) => VOID_MARKS.filter((m) => prevBest < m.wave && wave >= m.wave);
