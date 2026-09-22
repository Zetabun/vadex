// Runtime for missions, achievements and challenge completion. Definitions live in data/goals.js.
import { Big } from '@last-orbit/core/big.js';
import { G, recalc, toast, maxStat } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { rand } from '@last-orbit/core/rng.js';
import { WEAPON_ORDER } from '@last-orbit/data/weapons.js';
import { MISSIONS, ACHIEVEMENTS, CHALLENGES } from '@last-orbit/data/goals.js';
import { gain, weaponOwned, upgradeLevel } from '@last-orbit/progression/economy.js';

const MISSION_SLOTS = 3;
/** Read a counter; a few are derived instead of stored. */
export function statValue(key) {
  const s = G.state.stats;
  switch (key) {
    case 'damageLog': return s.damage ? Big.from(s.damage).log10() : 0;
    case 'creditsLog': return s.earned?.credits ? Big.from(s.earned.credits).log10() : 0;
    case 'offlineHours': return (s.offlineSeconds || 0) / 3600;
    case 'challengesDone': return Object.keys(G.state.challenges.done).length;
    case 'missionsDone': return G.state.missions.done;
    default: return s[key] || 0;
  }
}

// ---------- missions ----------
function eligible(t) {
  const s = G.state; if (t.minWave && s.stats.bestWave < t.minWave) return false;
  if (t.need && !upgradeLevel(t.need) && s.stats.bestWave < 3) return false;
  if (t.needWeapon && !(weaponOwned(t.needWeapon) && s.run.equipped.includes(t.needWeapon))) return false;
  if (t.needDrones && !s.run.drones.bays.length) return false;
  return !s.missions.active.some((m) => m.tid === t.id);
}
function rollMission() {
  const s = G.state, pool = MISSIONS.filter(eligible); if (!pool.length) return null;
  const t = pool[Math.floor(rand() * pool.length)], scale = Math.floor(s.stats.bestWave / 5) + s.missions.done * 0.5;
  return { tid: t.id, base: statValue(t.stat), n: Math.max(1, Math.round(t.amt(scale))), seq: ++s.missions.seq };
}
export function missionDef(m) { return MISSIONS.find((t) => t.id === m.tid); }
export function missionProgress(m) { const t = missionDef(m); return Math.max(0, Math.min(m.n, statValue(t.stat) - m.base)); }
export function missionRewardText(m) { const [k, n] = missionDef(m).reward, g = G.sheet.n('missionGain'); return k === 'credits' ? `Credits worth ${Math.round(n * g)} waves` : k === 'data' ? `Data worth ${Math.round(n * g)} waves` : k === 'frag' ? `${Math.round(n * g)} Relic Fragment${n * g >= 1.5 ? 's' : ''}` : `${Math.round(n * g)} Boss Core${n * g >= 1.5 ? 's' : ''}`; }
export function claimMission(seq) {
  const s = G.state, i = s.missions.active.findIndex((m) => m.seq === seq); if (i < 0) return false; const m = s.missions.active[i]; if (missionProgress(m) < m.n) return false;
  const [k, n] = missionDef(m).reward, g = G.sheet.n('missionGain'), w = G.world;
  if (k === 'credits') gain('credits', w.base.reward.mul(28 * n * g).mul(G.sheet.b('creditGain')));
  else if (k === 'data') gain('data', w.base.dataWave.mul(n * g));
  else if (k === 'frag') gain('frags', Math.round(n * g)); else gain('cores', Math.round(n * g));
  s.missions.done++; s.missions.active.splice(i, 1); fill(); bus.emit('bought', 'mission', seq, {}); bus.emit('missions'); return true;
}
function fill() { const s = G.state; if (!s.unlocks.missions) return; while (s.missions.active.length < MISSION_SLOTS) { const m = rollMission(); if (!m) break; s.missions.active.push(m); } }
export const missionsReady = () => G.state.missions.active.filter((m) => missionProgress(m) >= m.n).length;

// ---------- achievements ----------
export function checkAchievements() {
  const s = G.state; let any = false;
  maxStat('maxDrones', G.world ? G.world.drones.filter((d) => !d.temp).length : 0);
  if (WEAPON_ORDER.every(weaponOwned)) maxStat('allWeapons', 1);
  const w = G.world; if (w && w.wave.state === 'fighting' && w.wave.t > 60 && w.wave.shotsFired === 0 && w.player.alive) maxStat('pacifist', 1);
  for (const a of ACHIEVEMENTS) if (!s.ach[a.id] && statValue(a.stat) >= a.n) { s.ach[a.id] = Date.now(); any = true; toast(`Achievement: ${a.name}`, 'ach'); bus.emit('achievement', a); }
  if (any) recalc();
}
export const achievementCount = () => Object.keys(G.state.ach).length;

// ---------- challenges ----------
function checkChallenge() {
  const s = G.state, id = s.run.challenge; if (!id || s.challenges.done[id] || s.run.failed) return;
  const c = CHALLENGES.find((x) => x.id === id); if (s.run.best >= c.goal) { s.challenges.done[id] = Date.now(); recalc(); toast(`Challenge complete: ${c.name}. ${c.reward.text}.`, 'epic'); bus.emit('challengeDone', c); }
}
bus.on('challengeFail', () => toast('Challenge failed. Rewind or abandon it from the Menu to try again.', 'warn'));

let t = 0;
export function updateGoals(dt) { t += dt; if (t < 1) return; t = 0; fill(); checkAchievements(); checkChallenge(); }
