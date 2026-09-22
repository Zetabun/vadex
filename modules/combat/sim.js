// Simulation orchestrator. Fixed 60 Hz steps, no rendering. Owns the wave state machine:
//   spawning → fighting → cleared → (next wave)      fighting → dead → (rollback + farm mode)
import { Big } from '@last-orbit/core/big.js';
import { G, count, maxStat, flag, recalc, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { rand } from '@last-orbit/core/rng.js';
import { BAL, FIELD, TICK } from '@last-orbit/data/balance.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { ENEMIES, ELITE_MODS } from '@last-orbit/data/enemies.js';
import { BOONS, ANOMALIES } from '@last-orbit/data/boons.js';
import { DEF } from '@last-orbit/progression/stats.js';
import { gain, checkUnlocks, weaponOwned } from '@last-orbit/progression/economy.js';
import { bossCoreReward } from '@last-orbit/progression/rewards.js';
import { createWorld, fx, sfx, setWaveBase, refreshDefence, spawnEnemy, makeElite, rebuildBuckets } from '@last-orbit/combat/world.js';
import { genWave, isBossWave } from '@last-orbit/combat/waves.js';
import { updateFormation, updateEnemies, updateRockets, updateBullets, updateHazards } from '@last-orbit/combat/enemies.js';
import { updateWeapons } from '@last-orbit/combat/weapons.js';
import { spawnBoss, updateBoss } from '@last-orbit/combat/bosses.js';
import { updateDrones, syncDrones } from '@last-orbit/combat/drones.js';
import { updateAbilities } from '@last-orbit/combat/abilities.js';
import { updateFoundryCombat } from '@last-orbit/progression/foundry.js';
import { updatePlayer } from '@last-orbit/combat/player.js';
import { clearXp, grantXp } from '@last-orbit/progression/experience.js';

const BARRIER_X = [-34, -11.5, 11.5, 34];

export function initWorld() {
  const w = (G.world = createWorld());
  for (const x of BARRIER_X) w.barriers.push({ x, w: 13, hp: 1, flash: 0 });
  w.rules = G.state.run.challenge ? DEF.challenges[G.state.run.challenge] : null;
  w.sim.formSpeed = w.rules?.sim?.formSpeed || 1; w.sim.fireRate = w.rules?.sim?.fireRate || 1;
  w.dps = Big.ZERO; w.dpsAcc = Big.ZERO; w.dpsT = 0; w.income = Big.ZERO; w.incomeLast = G.state.stats.earned?.credits || Big.ZERO;
  syncDrones(w); w.wave.state = 'idle'; w.wave.timer = 0.6;
  return w;
}

let accum = 0;
/** Advance the simulation by real seconds (already scaled by game speed). Returns the number of ticks run. */
export function advance(seconds) {
  accum += Math.min(seconds, 0.25); let n = 0;
  while (accum >= TICK && n < 30) { step(TICK); accum -= TICK; n++; }
  if (n >= 30) accum = 0;
  return n;
}

export function step(dt) {
  const w = G.world, st = G.state, ws = w.wave;
  w.t += dt; st.run.time += dt; ws.t += dt;
  if (w.sheetVersion !== G.sheet.version) { w.sheetVersion = G.sheet.version; refreshDefence(w); }
  updateFoundryCombat(w, dt); updatePlayer(w, dt); updateAbilities(w, dt);
  switch (ws.state) {
    case 'idle': ws.timer -= dt; if (ws.timer <= 0) startWave(w); break;
    case 'fighting': {
      spawnPending(w, dt);
      rebuildBuckets(w);
      updateFormation(w, dt); updateEnemies(w, dt); updateBoss(w, dt); updateRockets(w, dt);
      updateWeapons(w, dt); updateDrones(w, dt); updateBullets(w, dt); updateHazards(w, dt);
      if (!w.player.alive) break;
      let live = 0; for (let i = 0; i < w.enemies.length; i++) { const e = w.enemies[i]; if (e.alive && !e.def.projectile && !(e.def.cruiser && ws.info.kind !== 'resource')) live++; }
      if (live === 0 && !ws.pending.length && ws.t > 0.5) clearWave(w);
      break; }
    case 'cleared': updateWeapons(w, dt); updateDrones(w, dt); updateBullets(w, dt); updateEnemies(w, dt); if (!ws.intermissionPaused) { ws.timer -= dt; if (ws.timer <= 0) startWave(w); } break;
    case 'dead': updateBullets(w, dt); updateEnemies(w, dt); ws.timer -= dt; if (ws.timer <= 0) respawn(w); break;
  }
  for (const b of w.barriers) { if (b.flash > 0) b.flash -= dt; const r = G.sheet.n('barrierRegen'); if (r && b.hp > 0 && b.hp < 1) b.hp = Math.min(1, b.hp + r * dt); }
  // once a second: flush damage accounting, DPS / income meters
  w.dpsT += dt;
  if (w.dpsT >= 1) {
    w.dpsT -= 1; let tot = Big.ZERO; const by = st.stats.dmgBy || (st.stats.dmgBy = {});
    for (const id in w.acc) { if (!w.acc[id]) continue; const d = w.accSrc[id].mul(w.acc[id]); by[id] = Big.from(by[id] || 0).add(d); tot = tot.add(d); w.acc[id] = 0; }
    st.stats.damage = Big.from(st.stats.damage || 0).add(tot); st.run.stats.damage = Big.from(st.run.stats.damage || 0).add(tot);
    w.dps = w.dps.mul(0.7).add(tot.mul(0.3));
    const earned = st.stats.earned?.credits || Big.ZERO; w.income = w.income.mul(0.8).add(earned.sub(w.incomeLast).max(0).mul(0.2)); w.incomeLast = earned;
    st.meta.playTime += 1; count('time');
  }
}

// ---------------------------------------------------------------- waves
export function startWave(w) {
  const st = G.state, run = st.run, ws = w.wave, p = w.player;
  const info = genWave(run.seed, run.wave, { bossRush: !!w.rules?.bossRush }), sec = info.sector;
  const prevSector = w.base.sectorIdx, first = ws.num === 0;
  ws.num = run.wave; ws.info = info; ws.state = 'fighting'; ws.t = 0; ws.damaged = false; ws.kills = 0; ws.boss = null; ws.pending = []; ws.shotsFired = 0; ws.intermission = false; ws.intermissionPaused = false; ws.clearedNum = 0;
  setWaveBase(w, run.wave, sec.idx);
  // clear the field of leftovers (farm repeats, rollbacks)
  w.enemies = w.enemies.filter((e) => e.alive && e.def.cruiser); w.ebullets.length = 0; w.hazards = w.hazards.filter((h) => h.kind === 'pool');
  p.lastStand = true; if (!p.alive) { p.alive = true; p.hull = 1; p.shield = 1; }
  const noBarriers = G.sheet.n('barrier') <= 0;
  for (const b of w.barriers) b.hp = noBarriers ? 0 : Math.min(1, Math.max(0, b.hp) + 0.5);
  const haste = 1 - Math.min(0.85, G.sheet.n('waveHaste'));
  const f = w.form; f.x = 0; f.dir = rand() < 0.5 ? 1 : -1; f.enter = BAL.formationEnter * haste; f.total = 0; f.alive = 0;
  f.speed = BAL.formSpeed * (1 + Math.min(1.5, sec.n * 0.012) + Math.min(6, sec.idx) * 0.1);
  const seen = st.seen.enemies || (st.seen.enemies = {}), seenB = st.seen.bosses || (st.seen.bosses = {});
  if (info.boss) { seenB[info.boss] = 1; spawnBoss(w, info.boss); f.total = 0; }
  else {
    const rows = info.rows, nR = rows.length; f.y = 132; let cols = 0;
    const placed = [];
    for (let r = 0; r < nR; r++) { const row = rows[r]; cols = Math.max(cols, row.length); for (let c = 0; c < row.length; c++) { seen[row[c]] = 1; const sx = (c - (row.length - 1) / 2) * info.spacing, sy = r * 8; const e = spawnEnemy(w, row[c], sx, f.y - sy + 60, { slot: { x: sx, y: sy } }); if (e) placed.push(e); } }
    f.total = placed.length; f.alive = placed.length; f.minOff = -((cols - 1) / 2) * info.spacing - 4; f.maxOff = -f.minOff;
    const rng = info.rng || rand;
    for (let i = 0; i < info.elites && placed.length; i++) { const cand = placed.filter((e) => !e.elite && !e.def.aura && e.def.cost >= 1); if (!cand.length) break; makeElite(w, cand[Math.floor(rng() * cand.length)], ELITE_MODS[Math.floor(rng() * ELITE_MODS.length)]); }
    for (let i = 0; i < info.haulers; i++) ws.pending.push({ t: 1.5 + i * 2.2, type: 'treasure' });
    if (!info.haulers && run.wave > 8 && rand() < G.sheet.n('haulerChance') * (1 + G.sheet.n('luck'))) ws.pending.push({ t: 4 + rand() * 6, type: 'treasure' });
  }
  if (first || sec.idx !== prevSector) fx(w, 'sector', sec.idx, sec.def.name, sec.def.intro);
  fx(w, 'wave', run.wave, info.label, info.kind);
  bus.emit('waveStart', w, info);
}

function spawnPending(w, dt) {
  const P = w.wave.pending; if (!P.length) return;
  for (let i = P.length - 1; i >= 0; i--) { const s = P[i]; s.t -= dt; if (s.t > 0) continue; P.splice(i, 1);
    const dir = rand() < 0.5 ? 1 : -1, e = spawnEnemy(w, s.type, -dir * (FIELD.W / 2 + 10), 96 + rand() * 36, { state: 'free', vx: dir * (17 + rand() * 6) });
    if (e) { fx(w, 'text', -dir * 38, e.y + 5, 'HAULER', '#ffd700', 1); sfx(w, 'hauler'); } }
}

function clearWave(w) {
  const st = G.state, run = st.run, ws = w.wave, p = w.player, info = ws.info;
  const interPref = Number(st.settings.waveIntermission ?? 5);
  ws.state = 'cleared'; ws.clearedNum = run.wave; ws.intermission = interPref !== 0; ws.intermissionPaused = interPref < 0;
  const interSeconds = interPref < 0 ? 5 : interPref;
  ws.timer = ws.intermission ? (info.kind === 'boss' ? Math.max(interSeconds, 8) : interSeconds) : BAL.waveGap * (1 - Math.min(0.85, G.sheet.n('waveHaste')));
  // A cleared wave is a genuinely safe breather: no hostile projectile can drift into the intermission.
  w.ebullets.length = 0;
  count('wavesCleared');
  grantXp(clearXp(run.wave, info.kind), 'wave');
  // Guaranteed wreck salvage prevents unlucky drop streaks from stalling the Arsenal.
  if (st.unlocks.arsenal && run.wave >= 3) gain('scrap', w.base.reward.mul(BAL.clearScrap).mul(G.sheet.b('scrapGain')));
  if (run.wave >= 5) { const d = w.base.dataWave.mul(info.boss ? 5 : 1); gain('data', d); if (st.unlocks.research) fx(w, 'text', 0, 70, d, '#5ee6ff', 2); }
  if (!ws.damaged) { count('flawless'); run.cleanStreak++; if (!info.boss) { const bonus = w.base.reward.mul(ws.kills * (flag('f.flawless') ? BAL.researchedCleanSweep : BAL.cleanSweep)).mul(G.sheet.b('creditGain')); gain('credits', bonus); fx(w, 'text', 0, 62, 'CLEAN SWEEP', '#ffc857', 1); } }
  else run.cleanStreak = 0;
  p.hull = Math.min(1, p.hull + 0.2);
  if (run.farm) { if (flag('f.autopush') && st.auto.push && run.cleanStreak >= 3) { run.farm = false; toast('Pushing forward again.', 'info'); } }
  if (!run.farm) {
    run.wave++; if (run.wave > run.best) { run.best = run.wave; maxStat('bestWave', run.best); const s = sectorOf(run.best).idx + 1; if (s > (st.stats.bestSector || 1)) { st.stats.bestSector = s; } pace(run); }
  }
  queueChoicesThrough(run.best);
  checkUnlocks(); bus.emit('waveCleared', w, info);
}
/** Remember how long each 10-wave mark took, so the Rewind screen can show this run vs. the best. */
function pace(run) { if ((run.best - 1) % 10 === 0) { const k = run.best - 1; (run.stats.pace || (run.stats.pace = {}))[k] = Math.round(run.time); const pb = G.state.prestige.paceBest; if (!pb[k] || run.time < pb[k]) pb[k] = Math.round(run.time); if (k === 50 && run.time < 300 && G.state.prestige.count) maxStat('fast50', 1); } }

bus.on('playerDied', (w) => {
  const run = G.state.run; w.wave.state = 'dead'; w.wave.timer = 2.4; count('deaths'); run.cleanStreak = 0;
  if (w.rules?.oneLife && !run.failed && !G.state.challenges.done[run.challenge]) { run.failed = true; bus.emit('challengeFail'); }
});
function respawn(w) {
  const run = G.state.run, was = run.wave;
  let to = Math.max(1, run.wave - BAL.deathRollback); const opts = { bossRush: !!w.rules?.bossRush };
  if (!opts.bossRush) while (to > 1 && isBossWave(to, opts)) to--;
  run.wave = to; run.farm = true;
  w.foundryBurst = 0; w.player.focus = 0; w.player.combo = 0; w.shots.length = 0;
  if (!run.seen_retreat) { run.seen_retreat = 1; toast(flag('f.autopush') ? 'Ship lost. Falling back to regroup, then pushing again.' : `Ship lost at wave ${was}. Holding at wave ${to} to gather strength. Tap Push when ready.`, 'warn'); }
  startWave(w);
}
/** HUD Hold/Push toggle. Hold repeats the wave just cleared; Push advances to the next one. */
export function setFarm(on) {
  const run = G.state.run, ws = G.world?.wave; run.farm = on; run.cleanStreak = 0;
  if (ws?.state === 'cleared' && ws.num > 0) run.wave = on ? ws.num : ws.num + 1;
  bus.emit('stats'); bus.emit('farm', on);
}
/** Freeze/resume the safe between-wave countdown without changing Hold/Push mode. */
export function pauseIntermission(on = true) {
  const ws = G.world?.wave; if (!ws || ws.state !== 'cleared' || !ws.intermission) return false;
  ws.intermissionPaused = !!on; bus.emit('intermission', ws); return true;
}
/** Skip the remaining intermission and begin the currently selected Hold/Push target immediately. */
export function startNextWave() {
  const w = G.world, ws = w?.wave; if (!w || !ws || ws.state !== 'cleared') return false;
  ws.intermissionPaused = false; ws.timer = 0; startWave(w); bus.emit('intermission', ws); return true;
}

// ---------------------------------------------------------------- boss rewards
bus.on('bossDied', (w, boss) => {
  const st = G.state, def = boss.boss.def, t = boss.boss.t;
  count('bossKills'); if (!def.mini) count('sectorBossKills');
  if (!(st.stats.fastestBoss <= t)) st.stats.fastestBoss = Math.round(t * 10) / 10;
  if (t < 10) maxStat('fastBoss10', 1);
  if (!w.wave.bossDamaged && !def.mini) maxStat('flawlessBoss', 1);
  const cores = bossCoreReward(def);
  if (cores > 0) { gain('cores', cores); fx(w, 'text', boss.x, boss.y + 6, '+' + cores + ' core' + (cores > 1 ? 's' : ''), '#ff5fa2', 1); }
  bus.emit('bossLoot', w, boss, def);
});

// ---------------------------------------------------------------- boons & anomalies
export function rollBoons() {
  const st = G.state, run = st.run, n = Math.max(2, Math.min(5, Math.round(G.sheet.n('boonChoices')))), luck = G.sheet.n('luck');
  const pool = BOONS.filter((b) => (run.boons[b.id] || 0) < b.max && (!b.need || weaponOwned(b.need)) && (!b.needDrones || G.sheet.n('droneBays') > 0) && (!b.needRewind || st.prestige.count > 0));
  const out = [];
  while (out.length < n && pool.length) { let tot = 0; for (const b of pool) tot += b.w * (b.rare ? 1 + luck : 1); let x = rand() * tot, pick = pool[0]; for (const b of pool) { x -= b.w * (b.rare ? 1 + luck : 1); if (x <= 0) { pick = b; break; } } out.push(pick.id); pool.splice(pool.indexOf(pick), 1); }
  return out;
}
function openChoice(kind) {
  const run = G.state.run; if (run.pendingChoice) return false;
  if (kind === 'boon') { const opts = rollBoons(); if (!opts.length) return false; run.pendingChoice = { kind: 'boon', options: opts }; }
  else { const a = ANOMALIES[Math.floor(rand() * ANOMALIES.length)]; if (!a) return false; run.pendingChoice = { kind: 'anomaly', id: a.id }; }
  bus.emit('choice'); return true;
}
function enqueueChoice(kind) {
  const run = G.state.run;
  if (!run.pendingChoice && openChoice(kind)) return;
  (run.choiceQueue ||= []).push(kind);
}
function activateQueuedChoice() {
  const run = G.state.run;
  while (!run.pendingChoice && run.choiceQueue?.length) if (openChoice(run.choiceQueue.shift())) break;
}
/** Advance every boon/anomaly threshold through bestWave and bank each missed decision in order. */
export function queueChoicesThrough(bestWave) {
  const run = G.state.run, every = Math.max(3, Math.round(G.sheet.n('boonEvery'))); let b = run.nextBoon, a = Math.max(13, run.nextAnomaly);
  while (Math.min(b, a) <= bestWave) {
    if (b <= a) { enqueueChoice('boon'); b += every; }
    else { enqueueChoice('anomaly'); a += BAL.anomalyMin + Math.floor(rand() * (BAL.anomalyMax - BAL.anomalyMin + 1)); }
  }
  run.nextBoon = b; run.nextAnomaly = a;
}
/** Resolve the pending boon (index into options) or anomaly (0 = a, 1 = b). */
export function resolveChoice(idx) {
  const st = G.state, run = st.run, pc = run.pendingChoice, w = G.world; if (!pc) return;
  run.pendingChoice = null;
  if (pc.kind === 'boon') { const id = pc.options[idx] || pc.options[0]; run.boons[id] = (run.boons[id] || 0) + 1; count('boons'); toast('Boon: ' + DEF.boons[id].name, 'good'); }
  else {
    const a = ANOMALIES.find((x) => x.id === pc.id), c = idx ? a.b : a.a; count('anomalies');
    if (c.fx) run.picks.push({ id: a.id, label: c.label, fx: c.fx, tag: c.tag });
    if (c.module) bus.emit('grantModule', c.module, 1);
    if (c.scrapWaves) gain('scrap', w.base.reward.mul(BAL.scrapShare * 4 * c.scrapWaves).mul(G.sheet.b('scrapGain')));
    if (c.dataWaves) gain('data', w.base.dataWave.mul(c.dataWaves));
    if (c.fragments) gain('frags', c.fragments);
    toast(a.name + ': ' + c.label, 'good');
  }
  recalc(); checkUnlocks(); activateQueuedChoice(); bus.emit('choice');
}

/** Debug / dev helpers */
export function debugSetWave(n) { const run = G.state.run; run.wave = Math.max(1, n | 0); run.best = Math.max(run.best, run.wave); maxStat('bestWave', run.best); st_sector(); const w = G.world; w.wave.state = 'idle'; w.wave.timer = 0.1; w.enemies.length = 0; w.ebullets.length = 0; checkUnlocks(); }
function st_sector() { const s = sectorOf(G.state.run.best).idx + 1; if (s > (G.state.stats.bestSector || 1)) G.state.stats.bestSector = s; }
export function debugSpawn(type, elite) { const w = G.world; if (ENEMIES[type]) { const e = spawnEnemy(w, type, (rand() - 0.5) * 60, 120, { state: 'free' }); if (e && elite) makeElite(w, e, ELITE_MODS[Math.floor(rand() * ELITE_MODS.length)]); } else { spawnBoss(w, type); } if (w.wave.state !== 'fighting') { w.wave.state = 'fighting'; w.wave.pending = w.wave.pending || []; w.wave.info = w.wave.info || genWave(1, 1); } }
