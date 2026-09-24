// Counterattack stage director. Replaces the wave state machine when run.mode === 'counter': squads arrive from a
// seeded timeline, a mini-boss holds the middle (the timeline waits for it), and the sector boss ends the stage.
//   fighting → (boss down) cleared → sortie over ('cleared')        fighting → dead → (revive | sortie over)
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { FIELD } from '@last-orbit/data/balance.js';
import { SECTORS } from '@last-orbit/data/sectors.js';
import { ELITE_MODS } from '@last-orbit/data/enemies.js';
import { STAGE_BY_N, HARD, hardWaves } from '@last-orbit/data/counter.js';
import { fx, sfx, spawnEnemy, makeElite, setWaveBase, rebuildBuckets } from '@last-orbit/combat/world.js';
import { updateEnemies, updateRockets, updateBullets, updateHazards } from '@last-orbit/combat/enemies.js';
import { updateWeapons } from '@last-orbit/combat/weapons.js';
import { spawnBoss, updateBoss } from '@last-orbit/combat/bosses.js';
import { updateDrones } from '@last-orbit/combat/drones.js';
import { updatePickups, collectAll } from '@last-orbit/combat/pickups.js';
import { squadPaths, PATTERNS } from '@last-orbit/combat/paths.js';
import { initSetPiece, stepSetPiece, HULL, HIVE, hiveDepth, hullFront, hullLength } from '@last-orbit/combat/setpieces.js';

/** Small seeded generator so every attempt at a stage flies the same assault. */
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const pick = (list, r) => { let tot = 0; for (const [, w] of list) tot += w; let x = r() * tot; for (const [v, w] of list) { x -= w; if (x <= 0) return v; } return list[0][0]; };

/** The stage's squads: [{ t, type, pattern, n, x, dir, ph, elite }]. Squads come thicker as the stage goes on. */
export function buildTimeline(stage, hard) {
  const r = rng(stage.n * 7919 + (hard ? 17 : 0)), pool = SECTORS[stage.sector].pool.map(([type, , w]) => [type, w]), out = [];
  const g0 = 3.6 * (hard ? HARD.gap : 1), g1 = 2.3 * (hard ? HARD.gap : 1);
  for (let t = 2; t < stage.len;) {
    const k = t / stage.len, [pattern, n] = PATTERNS[Math.floor(r() * PATTERNS.length)];
    out.push({ t, type: pick(pool, r), pattern, n: n + (k > 0.6 ? 1 : 0), x: (r() - 0.5) * 56, dir: r() < 0.5 ? -1 : 1, ph: r() * 6, elite: r() < 0.08 + 0.12 * k + stage.n * 0.02 });
    t += g0 + (g1 - g0) * k + r() * 0.9;
  }
  // Liftoff: gun towers ride the city below and skimmers sweep low, until the surface falls away.
  if (stage.ground) {
    for (let t = 4; t < stage.len * stage.ground; t += 4.2 + r() * 2.5) out.push({ t, type: 'tower', pattern: 'ground', n: r() < 0.45 ? 3 : 2, x: (r() - 0.5) * 60, dir: 1, ph: 0, elite: false });
    for (let t = 12; t < stage.len * (stage.ground + 0.1); t += 11 + r() * 5) out.push({ t, type: 'skimmer', pattern: 'skim', n: 3, x: 0, dir: r() < 0.5 ? -1 : 1, ph: r() * 6, elite: false });
    out.sort((a, b) => a.t - b.t);
  }
  // The stage's own enemy, woven through the squads from early on.
  if (stage.extra) { const x = stage.extra; for (let t = 9; t < stage.len - 6; t += x.gap[0] + r() * (x.gap[1] - x.gap[0])) out.push({ t, type: x.type, pattern: x.pattern, n: x.n, x: (r() - 0.5) * 50, dir: r() < 0.5 ? -1 : 1, ph: r() * 6, elite: false }); out.sort((a, b) => a.t - b.t); }
  // Iron Curtain: guns on the battleship's deck while its hull passes beneath.
  if (stage.set === 'hull') { for (let t = HULL.from * stage.len + 6; t < HULL.to * stage.len - 4; t += 3.4 + r() * 2) out.push({ t, type: 'hullgun', pattern: 'ground', n: r() < 0.4 ? 3 : 2, x: (r() - 0.5) * 30, dir: 1, ph: 0, elite: false, hull: true }); out.sort((a, b) => a.t - b.t); }
  // Hive Breach: spore pods on the tunnel walls (placed on the wall when they spawn).
  if (stage.set === 'hive') { for (let t = HIVE.from * stage.len + 8; t < HIVE.to * stage.len - 6; t += 2.8 + r() * 2.4) out.push({ t, type: 'spore', pattern: 'ground', n: 1, x: 0, side: r() < 0.5 ? -1 : 1, dir: 1, ph: 0, elite: false, pod: true }); out.sort((a, b) => a.t - b.t); }
  return out;
}

export function initCounter(w) {
  const run = G.state.run, stage = STAGE_BY_N[run.stage], hard = !!run.hard;
  const wave = stage.wave + (hard ? hardWaves(stage.n) : 0);
  if (hard) { w.mods.hp *= HARD.hp; w.mods.dmg *= HARD.dmg; }
  w.sim.fireRate *= stage.fire || 1;
  w.counter = { stage, hard, wave, t: -2.5, events: buildTimeline(stage, hard), next: 0, spawned: 0, midDone: false, mini: null, boss: null, won: false };
  // Resuming from a checkpoint: the second half of the stage, with the mini-boss already beaten.
  if (run.fromCheckpoint) { const c = w.counter; c.t = stage.len * 0.5 + 1; c.midDone = true; c.next = c.events.findIndex((ev) => ev.t >= c.t); if (c.next < 0) c.next = c.events.length; setWaveBase(w, wave + 2, stage.sector); }
  if (!run.fromCheckpoint) setWaveBase(w, wave, stage.sector);
  const ws = w.wave; ws.num = stage.sector * 10 + 1; ws.state = 'fighting'; ws.t = 0; ws.info = { kind: 'counter', sector: { idx: stage.sector } }; ws.pending = [];
  w.form.total = 0; w.form.enter = 0;
  fx(w, 'sector', stage.sector, `Stage ${stage.n}: ${stage.name}`, run.fromCheckpoint ? 'Resuming from the checkpoint. The mini-boss is down: finish it.' : stage.brief);
  initSetPiece(w);
}

// Beating a checkpoint stage's mini-boss saves the pilot's level for a resume (filed when the sortie ends).
bus.on('bossDied', (w, e) => { const run = G.state.run; if (w.counter && e === w.counter.mini && w.counter.stage.checkpoint && run && !run.fromCheckpoint) run.checkpointLevel = run.level; });

/** Progress through the stage, 0..1, for the HUD. */
export const counterProgress = (w) => { const c = w.counter; if (!c) return 0; return c.boss ? 1 : Math.max(0, Math.min(0.97, c.t / c.stage.len)); };

function spawnSquad(w, ev) {
  const c = w.counter, s = w.set, top = FIELD.H + 12;
  // Deck guns only while the hull is under the spawn line; pods sit on whichever wall is thick enough there.
  if (ev.hull && s) { const f = hullFront(c.stage, s.clock ?? c.t); if (f > top - 20 || f + hullLength(c.stage) < top + 10) return; }
  let podX = null;
  if (ev.pod && s) { const wy = top + (s.scroll || 0); let side = ev.side; if (hiveDepth(wy, side, s.ramp) < 7) side = -side; const d = hiveDepth(wy, side, s.ramp); if (d < 7) return; podX = side * (FIELD.W / 2 - d + 1.2); }
  const paths = squadPaths(ev.pattern, ev.n, ev.x, ev.dir, ev.ph, Math.random, w.player); if (podX != null) paths[0].x0 = podX;
  // Lungers wait at the hive wall's inner edge, where the pilot can see them coming.
  if (s?.kind === 'hive') for (const path of paths) if (path.kind === 'lunge') path.edge = FIELD.W / 2 - hiveDepth(path.y0 + (s.scroll || 0), path.side, s.ramp) - 2;
  paths.forEach((path, i) => {
    const e = spawnEnemy(w, ev.type, path.x0 ?? -ev.dir * 62, FIELD.H + 12, { state: 'path' }); if (!e) return;
    e.path = path; c.spawned++; G.state.run.spawned = c.spawned; G.state.run.pathSpawned = (G.state.run.pathSpawned || 0) + 1;
    if (ev.elite && i === 0 && !e.def.aura) makeElite(w, e, ELITE_MODS[(ev.ph * 10 | 0) % ELITE_MODS.length]);
  });
}

/** One simulation tick of a Counterattack stage. afterDeath: the sim's death handling (revives, sortie over). */
export function counterStep(w, dt, afterDeath) {
  const ws = w.wave, c = w.counter, run = G.state.run;
  switch (ws.state) {
    case 'fighting': {
      // The timeline pauses while the mini-boss lives, so the middle of the stage is a duel.
      const holding = c.mini?.alive;
      if (!holding) c.t += dt;
      while (!holding && c.next < c.events.length && c.events[c.next].t <= c.t) spawnSquad(w, c.events[c.next++]);
      if (!c.midDone && c.t >= c.stage.len * 0.5) { c.midDone = true; setWaveBase(w, c.wave + 2, c.stage.sector); c.mini = spawnBoss(w, c.stage.mini); c.spawned++; run.spawned = c.spawned; }
      if (!c.boss && c.next >= c.events.length && !holding && c.t >= c.stage.len) {
        const left = w.enemies.filter((e) => e.alive && !e.homingRocket).length;
        if (left <= 3 || c.t >= c.stage.len + 8) { setWaveBase(w, c.wave + 4, c.stage.sector); c.boss = spawnBoss(w, c.stage.boss); c.spawned++; run.spawned = c.spawned; }
      }
      rebuildBuckets(w);
      updateEnemies(w, dt); updateBoss(w, dt); updateRockets(w, dt);
      updateWeapons(w, dt); updateDrones(w, dt); updateBullets(w, dt); updateHazards(w, dt); updatePickups(w, dt); stepSetPiece(w, dt);
      if (c.boss && !c.boss.alive && w.player.alive && !c.won) {
        c.won = true; run.stageCleared = true; ws.state = 'cleared'; ws.timer = 3;
        fx(w, 'sectorClear', c.stage.sector, 'Stage cleared'); sfx(w, 'milestone');
      }
      break;
    }
    case 'cleared':
      updateWeapons(w, dt); updateDrones(w, dt); updateBullets(w, dt); updateEnemies(w, dt); updatePickups(w, dt);
      ws.timer -= dt; if (ws.timer <= 0) { ws.state = 'over'; collectAll(w); bus.emit('sortieOver', 'cleared'); }
      break;
    case 'dead': updateBullets(w, dt); updateEnemies(w, dt); ws.timer -= dt; if (ws.timer <= 0) afterDeath(w); break;
  }
}
