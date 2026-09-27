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

// ------------------------------------------------------------------ the sortie song (v2.28.0)
{ const { songWanted, SONG } = await import('@last-orbit/audio/audio.js'); const set = G.state.settings, mode0 = G.mode, sm = set.sortieMusic, mu = set.music;
  G.mode = 'sortie'; set.sortieMusic = 'song'; set.music = 0.5; const inSortie = songWanted();
  set.sortieMusic = 'synth'; const synth = songWanted(); set.sortieMusic = 'off'; const off = songWanted(); set.sortieMusic = 'song'; set.music = 0; const quiet = songWanted(); set.music = 0.5;
  G.mode = 'hangar'; const hangar = songWanted();
  ok(inSortie && !synth && !off && !quiet && !hangar, 'the song plays in a sortie when chosen and the music is up; not with the synth or off chosen, the music down, or in the hangar');
  ok(newState().settings.sortieMusic === 'song' && readFileSync(new URL('../' + SONG.src, import.meta.url)).length > 100000, 'the song is the default for sorties, and its file ships with the game');
  G.mode = mode0; set.sortieMusic = sm; set.music = mu; }

// ------------------------------------------------------------------ drops drawn smoothly (v2.28.1)
{ const w3 = G.world; w3.pickups.length = 0; const drops = [0, 1, 2, 3].map((k) => spawnPickup(w3, 'xp', -10 + k * 6, 80, 1)); step(TICK);
  ok(drops.every((d) => d.px !== undefined && d.py !== undefined && (d.px !== d.x || d.py !== d.y)), 'drops keep their last position each tick, so they are drawn smoothly between ticks (they juddered as they fell)');
  ok(new Set(drops.map((d) => d.ph)).size === drops.length && drops.every((d) => d.ph >= 0 && d.ph < 6.3), 'each drop has its own bob and spin phase (by place in the list, collecting one made the rest jump)');
  w3.pickups.length = 0; }
{ const { SONG } = await import('@last-orbit/audio/audio.js'); ok(SONG.gain > 0 && SONG.gain < 0.6, 'the song is trimmed to sit under the fight: ' + SONG.gain); }

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
