// Shareable Daily Sortie result: a short, spoiler-free text card (in the spirit of Wordle's squares) that players can
// send to friends. Uses the system share sheet where there is one (iOS, Android), otherwise the clipboard.

/** Text for a daily result. sectors: one square per sector of the six: cleared, fell in, not reached. */
export function dailyShareText({ key, mutator, wave, score, streak }) {
  const fell = Math.floor((Math.max(1, wave) - 1) / 10);
  const bar = Array.from({ length: 6 }, (_, i) => (i < fell ? '🟩' : i === fell ? '🟥' : '⬛')).join('') + (wave > 60 ? ` +${wave - 60}` : '');
  const url = typeof location !== 'undefined' ? location.href.split(/[?#]/)[0] : '';
  return [`Last Orbit · Daily ${key}`, mutator, bar, `Wave ${wave} · Score ${Math.round(score || 0).toLocaleString('en-GB')}` + (streak > 1 ? ` · 🔥 ${streak}-day streak` : ''), url].filter(Boolean).join('\n');
}

/** Share text; resolves to 'shared', 'copied', 'cancelled' or 'failed'. */
export async function shareText(text) {
  try { if (navigator.share) { await navigator.share({ text }); return 'shared'; } } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}
