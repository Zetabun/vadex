// Fixes from playtesting (v2.25.1): the next wave waits until the pilot has made every choice (level-up cards came
// up as a new wave began), a Stooper diving into the ship crashes into it, and boss shots hit harder than an
// invader's.
import { G, recalc } from '@last-orbit/core/game.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { spawnEnemy } from '@last-orbit/combat/world.js';
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

if (failures) { console.error(`playtest-regression: ${failures} failed`); process.exit(1); }
console.log('playtest-regression: all passed');
