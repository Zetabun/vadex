// Fixes from playtesting (v2.25.1): the next wave waits until the pilot has made every choice (level-up cards came
// up as a new wave began), a Stooper diving into the ship crashes into it, and boss shots hit harder than an
// invader's.
import { G, recalc } from '@last-orbit/core/game.js';
import { newState, erasedState, introDue } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { spawnEnemy } from '@last-orbit/combat/world.js';
import { spawnPickup } from '@last-orbit/combat/pickups.js';
import { lean } from '@last-orbit/combat/enemies.js';
import { startSortie, nextOffer, pickCard } from '@last-orbit/progression/run.js';
import { BAL, TICK } from '@last-orbit/data/balance.js';
import { readFileSync } from 'node:fs';

let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.error('FAIL', msg); } };
G.state = newState(); G.state.meta.legacyChecked = true; recalc(); startSortie({}); initWorld();
const w = G.world, run = G.state.run, p = w.player;
const run_ = (secs, each) => { for (let t = 0; t < secs; t += TICK) { step(TICK); each?.(); } };
const safe = () => { p.hull = 1; p.alive = true; w.ebullets.length = 0; w.pickups.length = 0; };

// ------------------------------------------------------------------ the next wave waits for the pilot's choices
run_(8, () => { safe(); if (w.wave.state === 'fighting') w.enemies.forEach((e) => { e.alive = false; }); });
for (let i = 0; i < 400 && w.wave.state !== 'fighting'; i++) step(TICK);
const n = w.wave.num; ok(w.wave.state === 'fighting', 'a wave is under way: ' + w.wave.state);
w.enemies.length = 0; w.wave.pending.length = 0; run.pendingLevels = 1;
run_(12, safe);
ok(w.wave.num === n && w.wave.state !== 'fighting', `with a level-up still to choose, the next wave waits (wave ${w.wave.num}, ${w.wave.state})`);
ok(nextOffer() && pickCard(0), 'the cards are chosen');
run_(12, safe);
ok(w.wave.num === n + 1, 'once chosen, the next wave comes: ' + w.wave.num);

// ------------------------------------------------------------------ a Stooper diving into the ship
w.enemies.length = 0; w.base.hasShield = false; p.shield = 0; p.invuln = 0; p.dashInv = 0; p.hull = 1; p.alive = true; w.wave.state = 'fighting';
const e = spawnEnemy(w, 'diver', p.x, p.y + 2, {}); e.state = 'dive'; e.aimX = p.x; e.vy = 0; e.spawnT = 0;
const lost0 = run.hullBy?.lost || 0; step(TICK);
const lost = (run.hullBy?.lost || 0) - lost0, want = BAL.diverRam * w.base.dmgPerHull; /* the hit itself (any healing in the same moment aside) */
ok(!e.alive && Math.abs(lost - Math.min(1, want)) < 0.02, `a Stooper diving into the ship hurts (${(lost * 100).toFixed(1)}% hull, expected ${(want * 100).toFixed(1)}%) and is destroyed`);

// ------------------------------------------------------------------ boss shots hit harder
const src = readFileSync(new URL('../modules/combat/bosses.js', import.meta.url), 'utf8');
ok(BAL.bossShot > 1 && !/[^.]spawnBullet\(w, (?!x, y, vx)/.test(src), 'every boss shot goes through bossShot (half as hard again as an invader\'s)');

// ------------------------------------------------------------------ no safe corner (v2.27.1)
{ const w2 = G.world, p2 = w2.player, x0 = p2.x, foe = spawnEnemy(w2, 'grunt', 40, 110, { slot: { x: 36, y: 0 } }); foe.state = 'form';
  p2.x = 46.5; const inCorner = lean(w2, foe, 38); p2.x = 0; const inMiddle = lean(w2, foe, 38); p2.x = -46.5; const farCorner = lean(w2, foe, 38);
  ok(inCorner > 0 && inCorner <= 38 * BAL.lean, 'in the strip by the wall, the nearest columns angle their shots at the ship: ' + inCorner.toFixed(2));
  ok(inMiddle === 0 && farCorner === 0, 'anywhere else, and from far across the field, shots fall straight down');
  foe.alive = false; p2.x = x0; }

// ------------------------------------------------------------------ the sortie songs (v2.28.0, two from v2.28.1)
{ const { songWanted, TRACKS } = await import('@last-orbit/audio/audio.js'); const set = G.state.settings, mode0 = G.mode, sm = set.sortieMusic, mu = set.music;
  G.mode = 'sortie'; set.music = 0.5; const want = (v) => { set.sortieMusic = v; return songWanted(); };
  const all = want('all'), one = want(TRACKS[1].id), legacy = want('song'), synth = want('synth'), off = want('off'); set.sortieMusic = 'all'; set.music = 0; const quiet = songWanted(); set.music = 0.5;
  G.mode = 'hangar'; const hangar = songWanted();
  ok(all && one && legacy && !synth && !off && !quiet && !hangar, 'songs play in a sortie (the songs, or an older choice of one song or the old setting, which now mean the songs); not with the synth or off, the music down, or in the hangar');
  ok(newState().settings.sortieMusic === 'all' && TRACKS.length >= 2 && TRACKS.every((t) => readFileSync(new URL('../' + t.src, import.meta.url)).length > 100000), 'all songs in turn by default, and the file of every song ships with the game');
  ok(TRACKS.every((t) => t.gain > 0 && t.gain < 0.6) && new Set(TRACKS.map((t) => t.id)).size === TRACKS.length, 'each song is trimmed to sit under the fight, and has its own id');
  ok(TRACKS.every((t) => t.end > 60), 'each song knows where its sound ends, so the silence after it is skipped');
  G.mode = mode0; set.sortieMusic = sm; set.music = mu; }

// ------------------------------------------------------------------ drops drawn smoothly (v2.28.1)
{ const w3 = G.world; w3.pickups.length = 0; const drops = [0, 1, 2, 3].map((k) => spawnPickup(w3, 'xp', -10 + k * 6, 80, 1)); step(TICK);
  ok(drops.every((d) => d.px !== undefined && d.py !== undefined && (d.px !== d.x || d.py !== d.y)), 'drops keep their last position each tick, so they are drawn smoothly between ticks (they juddered as they fell)');
  ok(new Set(drops.map((d) => d.ph)).size === drops.length && drops.every((d) => d.ph >= 0 && d.ph < 6.3), 'each drop has its own bob and spin phase (by place in the list, collecting one made the rest jump)');
  w3.pickups.length = 0; }

// ------------------------------------------------------------------ no leap when a stun wears off (v2.28.4)
{ const { updateFormation, updateEnemies } = await import('@last-orbit/combat/enemies.js'); const { spawnBoss, updateBoss } = await import('@last-orbit/combat/bosses.js');
  const w4 = G.world, f = w4.form, st0 = w4.wave.state; w4.enemies.length = 0; w4.wave.pending.length = 0; w4.wave.boss = null; w4.stunT = 0; w4.slowT = 0; w4.wave.state = 'fighting';
  Object.assign(f, { x: 0, y: 110, dir: 1, speed: BAL.formSpeed, enter: 0, total: 6, alive: 6 });
  const foes = [-15, -9, -3, 3, 9, 15].map((sx, k) => { const e = spawnEnemy(w4, k === 5 ? 'weaver' : 'grunt', sx, 110, { slot: { x: sx, y: 0 } }); e.state = 'form'; e.spawnT = 0; return e; });
  /* one tick: the stun wears off, the formation marches, the ships follow; the most any of them moved */
  const tick = () => { if (w4.stunT > 0) w4.stunT -= TICK; const at = foes.map((e) => [e.x, e.y]); updateFormation(w4, TICK); updateEnemies(w4, TICK); w4.ebullets.length = 0; w4.hazards.length = 0; return Math.max(...foes.map((e, k) => Math.hypot(e.x - at[k][0], e.y - at[k][1]))); };
  const most = (secs) => { let m = 0; for (let k = Math.round(secs / TICK); k > 0; k--) m = Math.max(m, tick()); return m; };
  most(0.5); const usual = most(2), /* settled in first */ fx0 = f.x, fy0 = f.y, weaverT = foes[5].t;
  w4.stunT = 3 + TICK / 2; const held = most(3);
  ok(held === 0 && f.x === fx0 && f.y === fy0 && foes[5].t === weaverT, `under an EMP the formation holds with its ships (it marched on without them), and a Weaver's sway waits too (moved ${held.toFixed(3)}, formation ${(f.x - fx0).toFixed(2)})`);
  const after = most(1);
  ok(after < usual * 1.5 + 0.02, `when the EMP wears off, the ships carry on from where they were (at most ${after.toFixed(3)} a tick, ${usual.toFixed(3)} before it; they leapt to where the formation had got to)`);
  /* stunned alone (Static Lock), the formation marches on without it: it glides back to its place */
  const lone = foes[2]; lone.stunT = 1.5; most(1.6); let fastest = 0; for (let k = 0; k < 240; k++) { const x = lone.x, y = lone.y; tick(); fastest = Math.max(fastest, Math.hypot(lone.x - x, lone.y - y) / TICK); }
  const gap = Math.hypot(lone.x - (f.x + lone.slot.x), lone.y - (f.y - lone.slot.y));
  ok(fastest <= (f.sp + BAL.rejoin) * 1.02 && gap < 1.5 && !lone.rejoin, `a ship stunned on its own glides back to its place (at most ${fastest.toFixed(1)} a second) and is back in line (${gap.toFixed(2)} off)`);
  foes.forEach((e) => { e.alive = false; }); updateEnemies(w4, TICK); w4.enemies.length = 0; f.total = 0;
  /* a boss moves on a clock of its own, held by an EMP */
  const boss = spawnBoss(w4, 'broodcarrier'); boss.boss.enter = 0; const bt = () => { if (w4.stunT > 0) w4.stunT -= TICK; const x = boss.x, y = boss.y; updateBoss(w4, TICK); w4.ebullets.length = 0; w4.hazards.length = 0; return Math.hypot(boss.x - x, boss.y - y); };
  bt(); let bUsual = 0; for (let k = 0; k < 120; k++) bUsual = Math.max(bUsual, bt()); /* after its first step home */
  w4.stunT = 3 + TICK / 2; let bHeld = 0; for (let k = 0; k < 180; k++) bHeld = Math.max(bHeld, bt());
  let bAfter = 0; for (let k = 0; k < 60; k++) bAfter = Math.max(bAfter, bt());
  ok(bHeld === 0 && bAfter < bUsual * 1.5 + 0.02, `a boss holds under an EMP and carries on from there (at most ${bAfter.toFixed(3)} a tick after, ${bUsual.toFixed(3)} before; it leapt to where it would have been)`);
  boss.alive = false; w4.wave.boss = null; w4.enemies.length = 0; w4.stunT = 0; w4.wave.state = st0; }

// ------------------------------------------------------------------ the opening does not replay by itself (v2.25.2)
const old = newState(); old.seen.intro = true; old.stats.sorties = 40; old.global.id = 'a'.repeat(32); old.global.told = true;
const erased = erasedState(old);
ok(erased.seen.intro && erased.global.id === old.global.id && erased.global.told && erased.stats.sorties === 0, 'erasing a save keeps having seen the opening (and the place on the boards), and nothing else');
ok(!introDue(erased), 'so the opening does not play by itself on a later launch');
const hit = newState(); hit.stats.sorties = 12; /* a save erased before the fix, flown since */
ok(!introDue(hit) && hit.seen.intro, 'a save that has flown without the flag is marked seen, not shown the opening again');
const brandNew = newState(); ok(introDue(brandNew), 'a brand-new pilot still gets the opening');

if (failures) { console.error(`playtest-regression: ${failures} failed`); process.exit(1); }
console.log('playtest-regression: all passed');
