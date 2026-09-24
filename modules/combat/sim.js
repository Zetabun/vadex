// Simulation orchestrator. Fixed 60 Hz steps, no rendering. Owns the wave state machine:
//   idle → fighting → cleared → (next wave)      fighting → dead → (revive | sortie over)
// Between sorties (no G.state.run) the world is an empty parade ground for the Hangar backdrop.
import { Big } from '@last-orbit/core/big.js';
import { G, count, maxStat, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { rand } from '@last-orbit/core/rng.js';
import { BAL, FIELD, TICK, clearSalvage } from '@last-orbit/data/balance.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { ENEMIES, ELITE_MODS } from '@last-orbit/data/enemies.js';
import { createWorld, fx, sfx, setWaveBase, refreshDefence, spawnEnemy, makeElite, rebuildBuckets } from '@last-orbit/combat/world.js';
import { genWave } from '@last-orbit/combat/waves.js';
import { updateFormation, updateEnemies, updateRockets, updateBullets, updateHazards } from '@last-orbit/combat/enemies.js';
import { updateWeapons } from '@last-orbit/combat/weapons.js';
import { spawnBoss, updateBoss } from '@last-orbit/combat/bosses.js';
import { updateDrones, syncDrones } from '@last-orbit/combat/drones.js';
import { updateAbilities } from '@last-orbit/combat/abilities.js';
import { updatePlayer } from '@last-orbit/combat/player.js';
import { updatePickups, collectAll } from '@last-orbit/combat/pickups.js';
import { grantSalvage, grantXp } from '@last-orbit/progression/run.js';
import { checkContracts } from '@last-orbit/progression/meta.js';
import { threatMods, THREAT_GATE_WAVE } from '@last-orbit/data/threat.js';
import { MUTATOR_BY_ID } from '@last-orbit/data/daily.js';

const BARRIER_X = [-34, -11.5, 11.5, 34];

export function initWorld() {
  const w = (G.world = createWorld());
  if (G.state.run) for (const x of BARRIER_X) w.barriers.push({ x, w: 13, hp: 1, flash: 0 });
  // Enemy-side rules from the threat level and any daily mutator.
  const run = G.state.run, m = threatMods(run?.threat || 0), mw = MUTATOR_BY_ID[run?.mutator]?.world || {};
  w.mods = { hp: m.hp * (mw.hp || 1), dmg: m.dmg, bossHp: m.bossHp, elites: m.elites + (mw.elites || 0) };
  w.sim.fireRate = m.fireRate * (mw.fireRate || 1); w.sim.formSpeed = m.formSpeed * (mw.formSpeed || 1);
  w.dps = Big.ZERO; w.dpsT = 0;
  syncDrones(w); w.wave.state = 'idle'; w.wave.timer = 1.4;
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
  const w = G.world, st = G.state, run = st.run, ws = w.wave;
  w.t += dt; ws.t += dt;
  if (w.sheetVersion !== G.sheet.version) { w.sheetVersion = G.sheet.version; refreshDefence(w); }
  if (!run) { parade(w, dt); return; }
  run.time += dt;
  updatePlayer(w, dt); updateAbilities(w, dt);
  switch (ws.state) {
    case 'idle': ws.timer -= dt; updatePickups(w, dt); if (ws.timer <= 0) startWave(w); break;
    case 'fighting': {
      spawnPending(w, dt);
      rebuildBuckets(w);
      updateFormation(w, dt); updateEnemies(w, dt); updateBoss(w, dt); updateRockets(w, dt);
      updateWeapons(w, dt); updateDrones(w, dt); updateBullets(w, dt); updateHazards(w, dt); updatePickups(w, dt);
      if (!w.player.alive) break;
      let live = 0; for (let i = 0; i < w.enemies.length; i++) { const e = w.enemies[i]; if (e.alive && !e.def.projectile && !(e.def.cruiser && ws.info.kind !== 'resource')) live++; }
      if (live === 0 && !ws.pending.length && ws.t > 0.5) clearWave(w);
      break; }
    case 'cleared': updateWeapons(w, dt); updateDrones(w, dt); updateBullets(w, dt); updateEnemies(w, dt); updatePickups(w, dt); ws.timer -= dt; if (ws.timer <= 0 && !w.pickups.length) startWave(w); break;
    case 'dead': updateBullets(w, dt); updateEnemies(w, dt); ws.timer -= dt; if (ws.timer <= 0) afterDeath(w); break;
  }
  for (const b of w.barriers) { if (b.flash > 0) b.flash -= dt; const r = G.sheet.n('barrierRegen'); if (r && b.hp > 0 && b.hp < 1) b.hp = Math.min(1, b.hp + r * dt); }
  // once a second: DPS meter
  w.dpsT += dt;
  if (w.dpsT >= 1) {
    w.dpsT -= 1; let tot = Big.ZERO;
    for (const id in w.acc) { if (!w.acc[id]) continue; tot = tot.add(w.accSrc[id].mul(w.acc[id])); w.acc[id] = 0; }
    w.dps = w.dps.mul(0.7).add(tot.mul(0.3));
    st.meta.playTime += 1;
  }
}

/** Hangar backdrop: the ship idles on patrol while menus are open. */
function parade(w, dt) {
  const p = w.player; p.alive = true; p.hull = 1;
  const tx = Math.sin(w.t * 0.45) * 14, dx = tx - p.x; p.x += dx * Math.min(1, dt * 1.5); p.vx = dx * 1.5;
  p.tilt += (Math.max(-1, Math.min(1, p.vx / 60)) - p.tilt) * Math.min(1, 6 * dt);
  updateDrones(w, dt);
}

// ---------------------------------------------------------------- waves
export function startWave(w) {
  const st = G.state, run = st.run, ws = w.wave;
  const info = genWave(run.seed, run.wave), sec = info.sector;
  const prevSector = ws.num ? sectorOf(ws.num).idx : -1;
  ws.num = run.wave; ws.info = info; ws.state = 'fighting'; ws.t = 0; ws.damaged = false; ws.bossDamaged = false; ws.kills = 0; ws.boss = null; ws.pending = []; ws.shotsFired = 0;
  setWaveBase(w, run.wave, sec.idx);
  maxStat('bestWave', run.wave); maxStat('bestSector', sec.idx + 1);
  w.enemies = w.enemies.filter((e) => e.alive && e.def.cruiser); w.ebullets.length = 0; w.hazards = w.hazards.filter((h) => h.kind === 'pool');
  const p = w.player; p.lastStand = true;
  const newSector = sec.idx !== prevSector;
  for (const b of w.barriers) b.hp = newSector ? 1 : Math.min(1, Math.max(0, b.hp) + 0.25);
  const f = w.form; f.x = 0; f.dir = rand() < 0.5 ? 1 : -1; f.enter = BAL.formationEnter; f.total = 0; f.alive = 0;
  f.speed = BAL.formSpeed * (1 + sec.n * 0.04 + Math.min(6, sec.idx) * 0.1);
  const seen = st.seen.enemies, seenB = st.seen.bosses;
  if (info.boss) { seenB[info.boss] = 1; if (w.mods.bossHp !== 1) w.base.hp = w.base.hp.mul(w.mods.bossHp); spawnBoss(w, info.boss); f.total = 0; }
  else {
    const rows = info.rows, nR = rows.length; f.y = 132; let cols = 0;
    const placed = [];
    for (let r = 0; r < nR; r++) { const row = rows[r]; cols = Math.max(cols, row.length); for (let c = 0; c < row.length; c++) { seen[row[c]] = 1; const sx = (c - (row.length - 1) / 2) * info.spacing, sy = r * 8; const e = spawnEnemy(w, row[c], sx, f.y - sy + 60, { slot: { x: sx, y: sy } }); if (e) placed.push(e); } }
    f.total = placed.length; f.alive = placed.length; f.minOff = -((cols - 1) / 2) * info.spacing - 4; f.maxOff = -f.minOff;
    const rng = info.rng || rand;
    const elites = info.elites + (w.mods.elites || 0);
    for (let i = 0; i < elites && placed.length; i++) { const cand = placed.filter((e) => !e.elite && !e.def.aura && e.def.cost >= 1); if (!cand.length) break; makeElite(w, cand[Math.floor(rng() * cand.length)], ELITE_MODS[Math.floor(rng() * ELITE_MODS.length)]); }
    for (let i = 0; i < info.haulers; i++) ws.pending.push({ t: 1.5 + i * 2.2, type: 'treasure' });
  }
  if (newSector) fx(w, 'sector', sec.idx, sec.def.name, sec.def.intro);
  fx(w, 'wave', run.wave, info.label, info.kind);
  bus.emit('waveStart', w, info);
}

function spawnPending(w, dt) {
  const P = w.wave.pending; if (!P.length) return;
  for (let i = P.length - 1; i >= 0; i--) { const s = P[i]; s.t -= dt; if (s.t > 0) continue; P.splice(i, 1);
    const dir = rand() < 0.5 ? 1 : -1, e = spawnEnemy(w, s.type, -dir * (FIELD.W / 2 + 10), 96 + rand() * 36, { state: 'free', vx: dir * (17 + rand() * 6) });
    if (e) { fx(w, 'text', -dir * 38, e.y + 5, 'SALVAGE HAULER', '#ffd700', 1); sfx(w, 'hauler'); } }
}

function clearWave(w) {
  const st = G.state, run = st.run, ws = w.wave, p = w.player, info = ws.info, sec = info.sector;
  ws.state = 'cleared'; ws.timer = BAL.waveGap;
  w.ebullets.length = 0;
  for (const e of w.enemies) if (e.alive && (e.def.projectile || e.homingRocket)) { e.alive = false; e.rewardMul = 0; }
  count('wavesCleared');
  const pay = grantSalvage(clearSalvage(run.wave)), bossWave = sec.n === sec.len;
  if (!bossWave) fx(w, 'text', 0, 52, `WAVE ${run.wave} CLEAR  +${Math.round(pay)} SALVAGE`, '#ffc857', 2);
  grantXp(1 + run.wave * 0.25);
  if (!ws.damaged) { count('flawless'); if (!bossWave) fx(w, 'text', 0, 45, 'FLAWLESS', '#6dffc8', 1); }
  p.hull = Math.min(1, p.hull + 0.06);
  if (sec.n === sec.len) {
    maxStat('sectorsCleared', sec.idx + 1);
    if (run.wave === THREAT_GATE_WAVE && run.threat) maxStat('threatClear', run.threat);
    run.pendingRelics++; p.hull = 1; p.shield = 1; ws.timer = 2.6;
    fx(w, 'sectorClear', sec.idx, sec.def.name); sfx(w, 'milestone');
  }
  run.wave++;
  checkContracts();
  bus.emit('waveCleared', w, info);
}

// ---------------------------------------------------------------- death
bus.on('playerDied', (w) => {
  if (!G.state.run) return;
  w.wave.before = w.wave.state === 'dead' ? w.wave.before : w.wave.state; w.wave.state = 'dead'; w.wave.timer = 2.2; count('deathsAll');
});
function afterDeath(w) {
  const run = G.state.run, p = w.player;
  if (run.revivesUsed < Math.floor(G.sheet.n('revives'))) {
    run.revivesUsed++; p.alive = true; p.hull = 1; p.shield = 1; p.invuln = 3; w.ebullets.length = 0;
    for (const h of w.hazards) h.t = Math.max(h.t, 99);
    w.hazards.length = 0; w.wave.state = w.wave.before === 'cleared' || w.wave.before === 'idle' ? w.wave.before : 'fighting'; if (w.wave.state !== 'fighting') w.wave.timer = Math.max(w.wave.timer, 1);
    fx(w, 'text', p.x, p.y + 10, 'REVIVED', '#6dffc8', 2); fx(w, 'boom', p.x, p.y, 40, 0x6dffc8); sfx(w, 'milestone');
    toast('Emergency systems restored your ship.', 'good');
    return;
  }
  w.wave.state = 'over'; collectAll(w);
  bus.emit('sortieOver', 'destroyed');
}

/** Debug helpers */
export function debugSetWave(n) { const run = G.state.run; if (!run) return; run.wave = Math.max(1, n | 0); const w = G.world; w.wave.state = 'idle'; w.wave.timer = 0.1; w.enemies.length = 0; w.ebullets.length = 0; }
export function debugSpawn(type, elite) { const w = G.world; if (ENEMIES[type]) { const e = spawnEnemy(w, type, (rand() - 0.5) * 60, 120, { state: 'free' }); if (e && elite) makeElite(w, e, ELITE_MODS[Math.floor(rand() * ELITE_MODS.length)]); } else { spawnBoss(w, type); } }
