// Sortie score: points for every kill and cleared wave. Both grow with the wave number, flawless waves pay half again,
// and the whole score is multiplied by the Threat level. Scores feed the Records tab (personal bests and a local top 10).
export const TOP_N = 10;
export const scoreMult = (threat) => 1 + 0.25 * (threat || 0);
const waveMul = (wave) => 1 + 0.1 * (Math.max(1, wave) - 1);
/** Points for destroying an enemy on a wave. */
export const killScore = (e, wave) => Math.round((e.boss ? (e.boss.def.mini ? 250 : 1000) : e.elite ? 50 : 10) * waveMul(wave));
/** Points for clearing a wave. */
export const waveScore = (wave, flawless) => Math.round(50 * wave * (flawless ? 1.5 : 1));
/** Add points to a run. Returns true the first time the run passes the pilot's previous high score. */
export function addScore(run, pts) {
  run.score = (run.score || 0) + Math.round(pts * scoreMult(run.threat));
  if (!run.beatBest && run.prevScore > 0 && run.score > run.prevScore) { run.beatBest = true; return true; }
  return false;
}
