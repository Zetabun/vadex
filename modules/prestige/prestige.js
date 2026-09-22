// Meta-progression layers. Layer 1: Chrono Rewind (run → shards). Layer 2: Ascension (rewind tree → sigils).
// Adding a third layer means: a new currency, a new tree in economy.TREES, and a reset function like these two.
import { Big } from '@last-orbit/core/big.js';
import { G, recalc, toast } from '@last-orbit/core/game.js';
import { fmt } from '@last-orbit/core/format.js';
import { bus } from '@last-orbit/core/events.js';
import { newRun } from '@last-orbit/core/state.js';
import { BAL, shardsForWave, sigilsForShards, enemyReward } from '@last-orbit/data/balance.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { RESEARCH } from '@last-orbit/data/research.js';
import { PRESTIGE } from '@last-orbit/data/prestige.js';
import { DEF } from '@last-orbit/progression/stats.js';
import { gain, checkUnlocks, trimBays } from '@last-orbit/progression/economy.js';
import { initWorld } from '@last-orbit/combat/sim.js';

export const canRewind = () => G.state.run.best >= BAL.rewindWave;
export function shardPreview(wave = G.state.run.best) { return shardsForWave(wave).mul(G.sheet.b('shardGain')).floor(); }
/** Waves until the shard payout grows again: gives the Rewind screen a "push a bit further?" hint. */
export function nextShardWave() { const now = shardPreview(); for (let w = G.state.run.best + 1; w < G.state.run.best + 40; w++) if (shardPreview(w).gt(now)) return w; return null; }

export function startingWave() { const s = G.state; return Math.max(1, Math.min(Math.floor(G.sheet.n('startWave')) + 1, Math.floor(s.prestige.bestWave * 0.6))); }
function startingCredits(wave) { const lv = G.sheet.n('startCredits'); if (!lv) return Big.ZERO; const w = Math.max(wave, Math.floor(G.state.prestige.bestWave * 0.35)); return enemyReward(w, sectorOf(w).idx).mul(40 * lv * lv).mul(G.sheet.b('creditGain')); }

/** Begin a fresh run (after rewind, ascension, challenge start or abandon). keep: what survives from the old run. */
function beginRun(opts = {}) {
  const st = G.state, old = st.run, sh = G.sheet, run = newRun();
  if (sh.f('f.keepResearch')) run.research = { ...old.research };
  else if (sh.f('f.keepAuto')) for (const d of RESEARCH) if (d.br === 'auto' && old.research[d.id]) run.research[d.id] = old.research[d.id];
  if (sh.f('f.keepWeapons')) for (const id in old.weapons) run.weapons[id] = 1;
  run.challenge = opts.challenge || null;
  st.run = run;
  for (const c of ['credits', 'scrap', 'data']) st.cur[c] = Big.ZERO;
  if (!sh.f('f.keepCores')) st.cur.cores = Big.ZERO;
  recalc();
  const ch = run.challenge && DEF.challenges[run.challenge];
  if (ch?.onlyWeapon) { run.weapons = { [ch.onlyWeapon]: 1 }; run.equipped = [ch.onlyWeapon]; }
  if (!ch) { run.wave = run.best = startingWave(); st.cur.credits = startingCredits(run.wave); const every = Math.max(3, Math.round(G.sheet.n('boonEvery'))); run.nextBoon = run.wave < 6 ? 6 : 6 + Math.ceil((run.wave - 5) / every) * every; run.nextAnomaly = run.wave + 8; }
  if (sh.f('f.droneKeep')) run.drones.bays = ['attack', 'attack'];
  trimBays(); recalc(); initWorld(); checkUnlocks();
}

export function doRewind(opts = {}) {
  const st = G.state, run = st.run; if (!canRewind() && !opts.force) return false;
  const shards = shardPreview(), pr = st.prestige;
  pr.history.unshift({ n: pr.count + 1, wave: run.best, time: Math.round(run.time), shards, challenge: run.challenge, at: Date.now() }); if (pr.history.length > 12) pr.history.length = 12;
  pr.count++; pr.total = pr.total.add(shards); pr.bestWave = Math.max(pr.bestWave, run.best); gain('shards', shards);
  st.stats.rewinds = pr.count; st.stats.lastRunTime = Math.round(run.time);
  beginRun({ challenge: opts.challenge });
  bus.emit('rewind', shards, !!opts.auto);
  if (opts.auto) toast(`Auto-rewind: +${fmt(shards)} Chrono Shards`, 'good');
  return true;
}

// ---------- challenges ----------
export function startChallenge(id) { const c = DEF.challenges[id]; if (!c || G.state.prestige.count < c.rewinds) return false; if (canRewind()) return doRewind({ challenge: id }); beginRun({ challenge: id }); bus.emit('rewind', Big.ZERO, false); return true; }
export function abandonChallenge() { if (!G.state.run.challenge) return; if (canRewind()) doRewind(); else { beginRun(); bus.emit('rewind', Big.ZERO, false); } }

// ---------- layer 2 ----------
export const canAscend = () => G.sheet.f('f.ascension') > 0 && sigilPreview() > 0;
export function sigilPreview() { return sigilsForShards(G.state.prestige.total); }
export function doAscend() {
  if (!canAscend()) return false;
  const st = G.state, sig = sigilPreview(), keep = G.sheet.f('f.keepTier1') > 0, tree = {};
  if (keep) for (const d of PRESTIGE) if (d.tier <= 3 && st.prestige.tree[d.id]) tree[d.id] = st.prestige.tree[d.id];
  st.asc.count++; st.asc.total = st.asc.total.add(sig); gain('sigils', sig); st.stats.ascensions = st.asc.count;
  st.prestige = { count: 0, tree, total: Big.ZERO, bestWave: 1, history: [], paceBest: {} };
  st.cur.shards = Big.ZERO; st.cur.matter = Big.ZERO; st.cur.cores = Big.ZERO; st.alien = {};
  recalc(); beginRun(); bus.emit('ascend', sig);
  return true;
}
