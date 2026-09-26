// Regression checks for the v2 sortie loop: runs, cards, XP, relics, contracts, workshop, ships, saves, pickups and revives.
import assert from 'node:assert/strict';
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState, SCHEMA } from '@last-orbit/core/state.js';
import { BAL, TICK, xpToNext, enemyHp } from '@last-orbit/data/balance.js';
import { sectorOf, SECTORS } from '@last-orbit/data/sectors.js';
import { waveKind, genWave } from '@last-orbit/combat/waves.js';
import { WEAPONS, WEAPON_ORDER } from '@last-orbit/data/weapons.js';
import { CONTRACTS } from '@last-orbit/data/contracts.js';
import { SHIPS } from '@last-orbit/data/ships.js';
import { WORKSHOP, workshopCost } from '@last-orbit/data/workshop.js';
import { MODS } from '@last-orbit/data/cards.js';
import { initWorld, step, startWave } from '@last-orbit/combat/sim.js';
import { spawnPickup, collectAll } from '@last-orbit/combat/pickups.js';
import { hurtPlayer, hitEnemy } from '@last-orbit/combat/world.js';
import { startSortie, endSortie, recoverInterruptedRun, grantXp, rollOffer, pickCard, cardPool, nextOffer, rollRelics, pickRelic, describeCard, choicePending } from '@last-orbit/progression/run.js';
import { addPilotXp, selectPaint, threatMax, setThreat, dailyToday, addMastery, masteryOf, buyWorkshop, workshopNext, shipStatus, shipContract, buyShip, selectShip, checkContracts } from '@last-orbit/progression/meta.js';
import { parseSave } from '@last-orbit/save/save.js';
import { rankMult } from '@last-orbit/progression/stats.js';
import { rankNeed, rankReward, MAX_RANK, masteryNeed } from '@last-orbit/data/career.js';
import { threatMods, THREAT_UNLOCK_SECTOR } from '@last-orbit/data/threat.js';
import { dayKey, prevDayKey, dailyFor, dailyBonus, MUTATOR_BY_ID } from '@last-orbit/data/daily.js';

import { setWaveBase, killEnemy } from '@last-orbit/combat/world.js';
import { killScore, waveScore, scoreMult, TOP_N, addScore as addScoreT } from '@last-orbit/data/score.js';
import { ACHIEVEMENTS, FEATS, TIERS, FEAT_XP, MEDAL_COUNT } from '@last-orbit/data/achievements.js';
import { checkAchievements, medalProgress, medalTotal, medalDesc } from '@last-orbit/progression/meta.js';
import { selectBanner } from '@last-orbit/progression/meta.js';
import { BANNERS, bannerReqLabel } from '@last-orbit/data/banners.js';

const fresh = () => { G.state = newState(); G.mode = 'hangar'; recalc(); initWorld(); };
const launch = (opts) => { const r = startSortie({ seed: 7, ...opts }); initWorld(); return r; };

// ---- sector structure: ten waves, elite/mini at 5, convoy at 8, boss at 10 ----
assert.equal(sectorOf(1).idx, 0); assert.equal(sectorOf(10).n, 10); assert.equal(sectorOf(11).idx, 1);
assert.equal(waveKind(5), 'elite'); assert.equal(waveKind(15), 'mini'); assert.equal(waveKind(8), 'resource'); assert.equal(waveKind(10), 'boss'); assert.equal(waveKind(20), 'boss');
assert.equal(genWave(1, 10).boss, SECTORS[0].boss); assert.equal(genWave(1, 15).boss, SECTORS[1].mini);
assert.ok(sectorOf(61).def.name.startsWith('Deep Void'), 'Endless sectors follow the last one');
assert.ok(enemyHp(11, 1).gt(enemyHp(10, 0)), 'Enemy health rises into a new sector');

// ---- a fresh pilot starts with the Vanguard, its cannon and Overdrive ----
fresh();
assert.equal(G.state.run, null);
let run = launch();
assert.equal(G.mode, 'sortie'); assert.deepEqual(run.order, ['cannon']); assert.deepEqual(run.abilities, ['overdrive']);
assert.equal(G.state.stats.sorties, 1); assert.ok(G.state.contracts.c_first, 'Launching completes First Flight');
assert.equal(G.state.salvage, 25);

// ---- XP levels up and queues card choices ----
grantXp(xpToNext(1) + xpToNext(2));
assert.equal(run.level, 3); assert.equal(run.pendingLevels, 2);
assert.ok(nextOffer() && choicePending(), 'A pending level opens an offer');
assert.equal(run.offer.length, BAL.cardChoices);
assert.ok(run.offer.some((c) => c.kind === 'upgrade' || c.kind === 'weapon'), 'Every offer improves the arsenal when it can');
assert.equal(new Set(run.offer.map((c) => c.kind + c.id)).size, run.offer.length, 'Offers never repeat a card');
for (const c of run.offer) assert.ok(describeCard(c, run).title, 'Every card describes itself');

// ---- picking a weapon upgrade raises rank, applies the evolution and damage ----
const before = G.sheet.weapons.cannon; run.offer = [{ kind: 'upgrade', id: 'cannon', rank: 2, rarity: 'common' }];
pickCard(0);
assert.equal(run.weapons.cannon, 2); assert.equal(G.sheet.weapons.cannon.proj, before.proj + 1, 'Twin Barrel adds a projectile');
assert.ok(G.sheet.weapons.cannon.dmg.gt(before.dmg)); assert.equal(rankMult(2), 1.3);
assert.equal(run.pendingLevels, 1); assert.ok(run.offer, 'The next level-up is offered straight away');

// ---- only unlocked weapons are offered; the arsenal caps at four ----
assert.ok(!cardPool(run).some((c) => c.kind === 'weapon'), 'A fresh pilot has no other weapons unlocked');
for (const id of WEAPON_ORDER) G.state.unlocked.weapons[id] = 1;
assert.ok(cardPool(run).some((c) => c.kind === 'weapon' && c.id === 'laser'));
for (const id of ['laser', 'missile', 'tesla']) { run.offer = [{ kind: 'weapon', id, rarity: 'rare' }]; pickCard(0); }
assert.equal(run.order.length, BAL.maxWeapons); assert.equal(G.state.stats.maxWeapons, 4);
assert.ok(!cardPool(run).some((c) => c.kind === 'weapon'), 'No new weapons once four are carried');
run.weapons.cannon = BAL.maxRank; assert.ok(!cardPool(run).some((c) => c.kind === 'upgrade' && c.id === 'cannon'), 'Rank 7 is the cap');

// ---- mods stack additively and respect their maximum ----
const dmg0 = G.sheet.n('damage');
run.offer = [{ kind: 'mod', id: 'm_dmg', rarity: 'common' }]; pickCard(0); run.offer = [{ kind: 'mod', id: 'm_dmg', rarity: 'common' }]; pickCard(0);
assert.ok(Math.abs(G.sheet.n('damage') / dmg0 - 1.4) < 1e-9, 'Two Hot Loads give +40%, not ×1.44');
run.cards.m_dmg = MODS.find((m) => m.id === 'm_dmg').max; assert.ok(!cardPool(run).some((c) => c.id === 'm_dmg'));
assert.ok(!cardPool(run).some((c) => c.id === 'm_droned'), 'Drone cards need a drone first');

// ---- relics ----
const offer = rollRelics(run); assert.equal(offer.length, 3); assert.equal(new Set(offer).size, 3);
pickRelic(0); assert.equal(run.relics.length, 1); assert.equal(run.relicOffer, null);

// ---- pickups: XP and salvage are banked when collected ----
const xp0 = run.xp + run.level * 1000, sal0 = run.salvage;
spawnPickup(G.world, 'salvage', 0, 100, 10); spawnPickup(G.world, 'xp', 0, 100, 3);
collectAll(G.world); assert.ok(run.salvage > sal0); assert.ok(run.xp + run.level * 1000 > xp0);

// ---- ending a sortie banks salvage, records bests and returns to the hangar ----
run.salvage += 100.7; run.wave = 12; G.state.stats.bestWave = 12; const bank0 = G.state.salvage, runSalvage = Math.floor(run.salvage);
const summary = endSortie('destroyed');
assert.equal(G.state.run, null); assert.equal(G.mode, 'hangar');
assert.ok(G.state.salvage >= bank0 + runSalvage, 'Run salvage is banked');
assert.equal(summary.salvage, runSalvage); assert.equal(summary.sector, 2);
assert.ok(summary.contracts.includes('c_wave5'), 'Debrief lists contracts completed by this sortie');
assert.ok(G.state.unlocked.weapons.laser, 'Hold the Line unlocks the Lance Laser');
assert.equal(G.state.history[0].wave, 12);

// ---- workshop: costs rise, levels cap, effects apply ----
fresh(); G.state.salvage = 1e6;
const dmgBase = G.sheet.n('damage'), c0 = workshopNext('w_dmg');
assert.equal(c0, workshopCost(WORKSHOP[0], 0)); assert.ok(buyWorkshop('w_dmg')); assert.ok(workshopNext('w_dmg') > c0);
assert.ok(Math.abs(G.sheet.n('damage') - dmgBase * 1.15) < 1e-9);
for (let i = 0; i < 20; i++) buyWorkshop('w_dmg');
assert.equal(G.state.workshop.w_dmg, 10); assert.equal(workshopNext('w_dmg'), null);
G.state.salvage = 0; assert.equal(buyWorkshop('w_hull'), false, 'Cannot buy without salvage');
buyWorkshop('w_start'); G.state.salvage = 1e6; buyWorkshop('w_start'); buyWorkshop('w_reroll');
run = launch(); assert.equal(run.pendingLevels, 1, 'Veteran Crew grants an opening card'); assert.equal(run.rerolls, 1);
endSortie('abandoned');

// ---- ships: contract-gated, bought with salvage, change the loadout ----
fresh(); G.state.salvage = 1e6;
for (const s of SHIPS.slice(1).filter((x) => !x.yard)) { assert.ok(shipContract(s.id), s.id + ' has an unlocking contract'); assert.equal(shipStatus(s.id), 'locked'); } /* the Shipyard's ship is built, not bought (v2.16 block) */
assert.equal(buyShip('striker'), false);
G.state.stats.bestWave = 15; checkContracts();
assert.equal(shipStatus('striker'), 'buyable'); assert.ok(buyShip('striker')); assert.equal(G.state.ship, 'striker');
run = launch(); assert.deepEqual(run.order, ['laser']); assert.deepEqual(run.abilities, ['charge']);
assert.equal(selectShip('vanguard'), false, 'Ships cannot be swapped mid-sortie');
endSortie('abandoned'); assert.ok(selectShip('vanguard'));

// ---- every contract points at real stats and real unlocks ----
const stats = newState().stats;
for (const c of CONTRACTS) {
  assert.ok(c.stat in stats, c.id + ' tracks a known stat');
  if (c.unlock?.weapon) assert.ok(WEAPONS[c.unlock.weapon], c.id);
  if (c.unlock?.ship) assert.ok(SHIPS.some((s) => s.id === c.unlock.ship), c.id);
}

// ---- death ends the sortie; a revive brings the ship back once ----
fresh(); G.state.workshop.w_revive = 1; recalc(); run = launch();
let over = 0; const off = bus.on('sortieOver', () => over++);
const kill = () => {
  for (let i = 0; i < 600 && G.world.wave.state !== 'fighting'; i++) step(TICK);
  const p = G.world.player; p.invuln = 0; p.shield = 0; p.lastStand = false; G.state.run.windUsed = true; hurtPlayer(G.world, 1e9);
  assert.equal(p.alive, false); for (let i = 0; i < 200; i++) step(TICK); };
kill(); assert.equal(over, 0, 'First death uses the revive'); assert.ok(G.world.player.alive); assert.equal(run.revivesUsed, 1);
kill(); assert.equal(over, 1, 'Second death ends the sortie');
off();

// ---- dying in the safe gap after a wave, then reviving, does not clear that wave twice ----
fresh(); G.state.workshop.w_revive = 1; recalc(); run = launch(); run.wave = 10;
G.world.wave.timer = 0; step(TICK); for (const e of G.world.enemies) e.alive = false;
for (let i = 0; i < 200 && G.world.wave.state !== 'cleared'; i++) step(TICK);
assert.equal(run.wave, 11); assert.equal(run.pendingRelics, 1);
G.world.player.invuln = 0; G.world.player.shield = 0; G.world.player.lastStand = false; hurtPlayer(G.world, 1e9);
for (let i = 0; i < 400; i++) step(TICK);
assert.ok(G.world.player.alive); assert.equal(run.pendingRelics, 1, 'No second relic'); assert.ok(run.wave <= 11, 'No skipped wave');
endSortie('abandoned');

// ---- the debrief best-wave flag needs a strictly better wave ----
fresh(); G.state.stats.bestWave = 7; run = launch(); G.world.wave.num = 7; assert.equal(endSortie('destroyed').best, false);
run = launch(); G.world.wave.num = 8; const s8 = endSortie('destroyed'); assert.equal(s8.best, true); assert.equal(s8.wave, 8);

// ---- an interrupted sortie in the save banks its salvage at boot ----
fresh(); G.state.salvage = 100; run = launch(); run.salvage = 80.6;
const loaded = parseSave(JSON.stringify(G.state)); assert.ok(loaded.run);
assert.equal(recoverInterruptedRun(loaded), 80); assert.equal(loaded.run, null); assert.equal(loaded.salvage, G.state.salvage + 80);

// ---- pilot career: sorties earn XP, ranks pay salvage or unlock paint jobs ----
fresh(); G.state.salvage = 0;
assert.equal(selectPaint('ember'), false, 'Locked paints cannot be selected');
const pr = addPilotXp(rankNeed(1) + rankNeed(2) + 5);
assert.equal(pr.from, 1); assert.equal(pr.to, 3); assert.equal(G.state.pilot.xp, 5);
assert.equal(rankReward(2).paint, 'ember'); assert.ok(G.state.paints.ember); assert.equal(G.state.salvage, rankReward(3).salvage);
assert.ok(selectPaint('ember')); assert.equal(G.state.paint, 'ember');
run = launch(); grantXp(200); const sp = endSortie('destroyed'); assert.ok(sp.pilot.gained > 0, 'A sortie earns pilot XP');
G.state.pilot = { rank: MAX_RANK - 1, xp: 0 }; addPilotXp(1e9); assert.equal(G.state.pilot.rank, MAX_RANK); assert.equal(G.state.pilot.xp, 0);
const v20 = JSON.parse(JSON.stringify(G.state)); v20.v = 20; delete v20.pilot; delete v20.paints; delete v20.paint;
const up = parseSave(JSON.stringify(v20)); assert.equal(up.pilot.rank, 1); assert.equal(up.paint, 'factory');

// ---- threat levels: gated, cumulative, harder enemies and better pay ----
fresh();
assert.equal(threatMax(), 0, 'Threat is locked for new pilots'); assert.equal(setThreat(3), 0);
G.state.stats.bestSector = THREAT_UNLOCK_SECTOR; assert.equal(threatMax(), 1); assert.equal(setThreat(5), 1);
G.state.stats.threatClear = 4; assert.equal(threatMax(), 5);
assert.deepEqual(threatMods(3), { hp: 1.3, dmg: 1.25, elites: 1, bossHp: 1, fireRate: 1, hull: 1, formSpeed: 1 });
setThreat(0); run = launch(); setWaveBase(G.world, 5, 0); const hp0 = G.world.base.hp, hull0 = G.sheet.n('hull'), sg0 = G.sheet.n('salvageGain'); endSortie('abandoned');
setThreat(5); run = launch(); assert.equal(run.threat, 5); setWaveBase(G.world, 5, 0);
assert.ok(Math.abs(G.world.base.hp.ratio(hp0) - 1.3) < 1e-6, 'Threat I+ raises enemy health'); assert.equal(G.world.sim.fireRate, 1.25);
assert.equal(G.sheet.n('hull'), hull0, 'Hull is untouched until Threat VI'); assert.ok(G.sheet.n('salvageGain') > sg0, 'Threat pays more salvage');
run.wave = 40; G.world.wave.timer = 0; step(TICK); for (const e of G.world.enemies) e.alive = false;
for (let i = 0; i < 300 && G.world.wave.state !== 'cleared'; i++) step(TICK);
assert.equal(G.state.stats.threatClear, 5, 'Beating the wave 40 boss records the threat level'); assert.equal(threatMax(), 6);
const tSum = endSortie('abandoned'); assert.equal(tSum.threat, 5);

// ---- daily sortie: shared seed and mutator, one attempt, streaks and bonus ----
fresh(); G.state.stats.sorties = 1;
const today = dailyToday(); assert.equal(today.key, dayKey()); assert.equal(today.seed, dailyFor(today.key).seed); assert.equal(today.done, false);
G.state.threat = 0; G.state.daily.lastDay = prevDayKey(today.key); G.state.daily.streak = 4;
run = launch({ daily: true }); assert.ok(run, 'The daily launches'); assert.equal(run.seed, today.seed); assert.equal(run.mutator, today.mutator.id); assert.equal(run.threat, 0);
assert.equal(dailyToday().done, true, "Launching uses today's attempt");
const s0 = G.state.salvage; G.world.wave.num = 12; const dsum = endSortie('destroyed');
assert.equal(dsum.daily.streak, 5, 'Flying on consecutive days extends the streak'); assert.equal(dsum.daily.bonus, dailyBonus(12, 5));
assert.ok(G.state.salvage >= s0 + dsum.daily.bonus); assert.equal(G.state.stats.dailies, 1); assert.ok(G.state.contracts.c_daily1);
assert.equal(startSortie({ daily: true }), null, 'Only one daily a day'); assert.equal(G.state.run, null);
assert.equal(prevDayKey('2026-03-01'), '2026-02-28');
for (const m of Object.values(MUTATOR_BY_ID)) { fresh(); G.state.stats.sorties = 1; G.state.daily = { day: '', done: false, wave: 0, streak: 0, lastDay: '', best: 0 };
  run = startSortie({ seed: 1 }); run.mutator = m.id; recalc(); initWorld(); step(TICK); endSortie('abandoned'); }

// ---- ship mastery: waves flown level the ship, add bonuses and unlock its paint ----
fresh(); const dmgM = G.sheet.n('damage');
const mr = addMastery('vanguard', masteryNeed(1) + masteryNeed(2)); assert.equal(mr.to, 3); assert.equal(masteryOf('vanguard').level, 3);
recalc(); assert.ok(G.sheet.n('damage') > dmgM, 'Mastery adds damage'); assert.equal(G.sheet.n('startLevels'), 1, 'Mastery 3 grants an opening card');
addMastery('vanguard', 1e6); assert.equal(masteryOf('vanguard').level, 10); assert.ok(G.state.paints.m_vanguard, 'Mastery 10 unlocks the Prime paint');
assert.equal(G.state.stats.maxMastery, 10);
run = launch(); G.world.wave.num = 9; assert.equal(endSortie('destroyed').mastery.gained, 9, 'A sortie gives one mastery point per wave');

// ---- hold a screen side to steer ----
fresh(); run = launch(); const p0 = G.world.player.x; G.world.input.hold = -1; for (let i = 0; i < 30; i++) step(TICK);
assert.ok(G.world.player.x < p0 - 5, 'Holding the left side flies left'); G.world.input.hold = 0; endSortie('abandoned');

// ---- score: kills and cleared waves score, threat multiplies, the first pass of the high score is flagged ----
assert.ok(killScore({ boss: { def: {} } }, 10) > killScore({ elite: {} }, 10) && killScore({ elite: {} }, 10) > killScore({}, 10));
assert.ok(killScore({}, 30) > killScore({}, 1), 'Deeper kills score more'); assert.equal(waveScore(4, true), waveScore(4, false) * 1.5); assert.equal(scoreMult(4), 2);
fresh(); run = launch(); step(TICK); { const e = G.world.enemies.find((x) => x.alive && !x.parent);
  if (e) { killEnemy(G.world, e, null); assert.ok(run.score >= 10, 'A kill scores points'); } }
let sc = endSortie('abandoned'); assert.equal(sc.score, G.state.stats.bestScore); assert.equal(sc.place, 1); assert.equal(G.state.records.top.length, 1);
assert.equal(G.state.records.ships.vanguard.score, sc.score);
for (let i = 0; i < TOP_N + 3; i++) { run = launch(); run.score = 100 * (i + 1); endSortie('abandoned'); }
assert.equal(G.state.records.top.length, TOP_N, 'The leaderboard keeps the top ten'); assert.equal(G.state.records.top[0].score, 100 * (TOP_N + 3));
assert.ok(G.state.records.top.every((r, i, a) => !i || a[i - 1].score >= r.score), 'Sorted by score');
run = launch(); run.score = 5; sc = endSortie('abandoned'); assert.equal(sc.place, 0); assert.equal(sc.highScore, false);
run = launch(); G.state.run.threat = 2; run.prevScore = 100; run.score = 0;
{ const { addScore } = await import('@last-orbit/data/score.js'); assert.equal(addScore(run, 40), false); assert.equal(run.score, 60, 'Threat II scores ×1.5'); assert.equal(addScore(run, 40), true, 'Passing the high score is flagged once'); assert.equal(addScore(run, 40), false); run.score = 1e6; }
sc = endSortie('abandoned'); assert.equal(sc.highScore, true); assert.equal(G.state.seen.records, false, 'A new high score badges Records');

// ---- achievements: tiers pay pilot XP once each, feats too, during a sortie with the debrief ----
fresh(); assert.equal(MEDAL_COUNT, ACHIEVEMENTS.length * 3 + FEATS.length);
for (const a of [...ACHIEVEMENTS, ...FEATS]) { assert.ok(typeof a.get(G.state) === 'number', a.id + ' reads a number'); assert.ok(medalDesc(a, 0).length > 3); }
for (const a of ACHIEVEMENTS) assert.ok(a.goals[0] < a.goals[1] && a.goals[1] < a.goals[2], a.id + ' goals rise');
G.state.stats.kills = 600; const mxp0 = G.state.pilot.xp + G.state.pilot.rank * 1e6; let got = checkAchievements({ silent: true });
assert.deepEqual(got.map((m) => m.id), ['a_kills']); assert.equal(G.state.medals.a_kills, 1); assert.ok(G.state.pilot.xp + G.state.pilot.rank * 1e6 > mxp0, 'Hangar medals pay XP at once');
assert.equal(checkAchievements({ silent: true }).length, 0, 'A medal is awarded once');
G.state.stats.kills = 60000; got = checkAchievements({ silent: true }); assert.equal(got.length, 2, 'Silver and gold together'); assert.equal(medalProgress(ACHIEVEMENTS[0]).done, true);
run = launch(); G.state.stats.flawlessBosses = 1; checkContracts(); assert.equal(run.medalXp, FEAT_XP, 'In-sortie medals wait for the debrief');
const pBefore = G.state.pilot.rank * 1e6 + G.state.pilot.xp; sc = endSortie('abandoned');
assert.ok(sc.medals.some((m) => m.id === 'f_cleanboss')); assert.ok(sc.pilot.gained >= FEAT_XP, 'The debrief pays medal XP');
assert.equal(medalTotal().earned, 4); assert.ok(G.state.pilot.rank * 1e6 + G.state.pilot.xp > pBefore);
// feats tracked by the sim
fresh(); run = launch(); run.weapons.cannon = BAL.maxRank; run.order.push('laser'); run.weapons.laser = BAL.maxRank; run.order.push('missile'); run.weapons.missile = 6;
run.offer = [{ kind: 'upgrade', id: 'missile', rank: 7, rarity: 'evo' }]; pickCard(0); assert.equal(G.state.stats.maxedWeapons, 3); endSortie('abandoned');
fresh(); run = launch(); G.state.unlocked.weapons.laser = 1; run.wave = 20; startWave(G.world);
assert.ok(G.state.stats.soloWave >= 20, 'Solo-weapon waves are tracked'); endSortie('abandoned');
// migration from schema 22 keeps everything and adds records
{ const old = JSON.parse(JSON.stringify(newState())); old.v = 22; delete old.records; delete old.medals; old.stats.bestWave = 33;
  const m = parseSave(JSON.stringify(old)); assert.deepEqual(m.records, { top: [], ships: {} }); assert.deepEqual(m.medals, {}); assert.equal(m.stats.bestWave, 33); assert.equal(m.seen.medals, 0); }

// ---- banners: unlocked by medals and scores, selectable once owned ----
fresh(); assert.equal(G.state.banner, 'none'); assert.equal(selectBanner('signal'), false, 'Locked banners cannot be flown');
G.state.stats.kills = 600; G.state.stats.bestWave = 12; G.state.stats.bossKills = 6; checkAchievements({ silent: true });
assert.ok(G.state.banners.signal, 'Three medals unlock the first banner'); assert.equal(selectBanner('signal'), true); assert.equal(G.state.banner, 'signal');
run = launch(); run.score = 60000; sc = endSortie('abandoned'); assert.ok(sc.banners.includes('ember'), 'A 50,000 score unlocks a banner and the debrief lists it');
assert.ok(BANNERS.every((b) => !b.req || bannerReqLabel(b)), 'Every banner explains its unlock');
{ const legends = BANNERS.filter((b) => b.rarity === 'legendary'); assert.ok(legends.length >= 6, 'Several legendary stat trackers');
  for (const b of legends) { assert.ok(b.live && b.label && b.emblem && b.colors.length === 3, b.id + ' is a complete stat tracker'); assert.ok(b.live in newState().stats, b.id + ' tracks a real stat'); }
  G.state.stats.flawless = 500; checkAchievements({ silent: true }); assert.ok(G.state.banners.t_flawless, 'Legendary banners unlock from their stat'); }

// ---- ship passives ----
fresh(); run = launch(); step(TICK); { const p = G.world.player; p.invuln = 0; p.shield = 0; G.world.passive = 'secondwind'; run.windUsed = false; hurtPlayer(G.world, 1e9);
  assert.ok(p.alive && p.hull > 0.3 && run.windUsed, 'Second Wind saves the Vanguard once a sector'); } endSortie('abandoned');
{ const { momentumMul, MOMENTUM_MAX, updatePassives } = await import('@last-orbit/combat/passives.js');
  fresh(); G.state.ship = 'striker'; G.state.unlocked.ships.striker = 1; run = launch(); assert.equal(G.world.passive, 'momentum');
  for (let i = 0; i < 15; i++) bus.emit('kill', G.world, { x: 0, y: 100 }); assert.equal(G.world.player.momentum, MOMENTUM_MAX); assert.ok(momentumMul(G.world.player) > 1.25);
  updatePassives(G.world, 3.1); assert.equal(G.world.player.momentum, 0, 'Momentum falls away'); endSortie('abandoned'); }
for (const s of SHIPS) assert.ok(s.passive?.name && s.signature?.fx, s.id + ' has a passive and a signature');

// ---- signature and fusion cards appear once weapons are fully evolved ----
fresh(); G.state.mastery.vanguard = { level: 5, xp: 0 }; for (const id of ['laser']) G.state.unlocked.weapons[id] = 1; run = launch();
run.weapons.cannon = BAL.maxRank; assert.ok(cardPool(run).some((c) => c.kind === 'signature'), 'Mastery 5 + rank 7 offers the signature');
const dmgBefore = G.sheet.weapons.cannon.dmg; run.offer = [{ kind: 'signature', id: 'vanguard', rarity: 'signature' }]; pickCard(0);
assert.ok(run.signature && G.sheet.weapons.cannon.dmg.gt(dmgBefore), 'The signature strengthens the ship weapon'); assert.ok(!cardPool(run).some((c) => c.kind === 'signature'));
run.order.push('laser'); run.weapons.laser = BAL.maxRank; recalc(); assert.ok(cardPool(run).some((c) => c.kind === 'fusion' && c.id === 'fu_twinsuns'), 'Two rank-7 weapons can fuse');
const projBefore = G.sheet.weapons.laser.proj; run.offer = [{ kind: 'fusion', id: 'fu_twinsuns', rarity: 'fusion' }]; pickCard(0);
assert.equal(G.sheet.weapons.laser.proj, projBefore + 1, 'Fusion fx apply'); assert.equal(G.state.stats.fusions, 1);
assert.ok(describeCard({ kind: 'fusion', id: 'fu_twinsuns' }).icon2); endSortie('abandoned');
{ const { FUSIONS } = await import('@last-orbit/data/fusions.js'); for (const f of FUSIONS) assert.ok(WEAPONS[f.a] && WEAPONS[f.b] && f.fx[f.a] && f.fx[f.b], f.id);
  for (const id of WEAPON_ORDER) assert.ok(FUSIONS.some((f) => f.a === id || f.b === id), id + ' has a fusion'); }

// ---- routes: chosen after a sector boss, applied to the next sector ----
{ const { nextRoute, pickRoute } = await import('@last-orbit/progression/run.js'); const { ROUTE_BY_ID } = await import('@last-orbit/data/routes.js');
  fresh(); run = launch(); run.pendingRoute = true; assert.ok(nextRoute()); assert.equal(run.routeOffer[0], 'steady'); assert.equal(run.routeOffer.length, 3); assert.ok(choicePending());
  run.routeOffer = ['steady', 'salvage', 'gauntlet']; const hp0 = G.world.mods.hp, sal0 = G.sheet.n('salvageGain');
  pickRoute(1); assert.equal(run.route, 'salvage'); assert.ok(G.world.mods.hp > hp0 && G.sheet.n('salvageGain') > sal0, 'A route changes both sides');
  run.pendingRoute = true; nextRoute(); run.routeOffer = ['steady', 'gauntlet', 'blitz']; pickRoute(0); assert.equal(run.route, null, 'Steady Course clears the route');
  for (const r of Object.values(ROUTE_BY_ID)) assert.ok(r.name && r.desc && r.art, r.id); endSortie('abandoned'); }

// ---- v2.8: Deep Void anomalies (one per Deep Void sector, stacking) ----
{ const { nextAnomaly, pickAnomaly, rollAnomalies } = await import('@last-orbit/progression/run.js'); const { ANOMALIES, ANOMALY_BY_ID, anomalyPay, anomalyName } = await import('@last-orbit/data/anomalies.js');
  for (const a of ANOMALIES) assert.ok(a.name && a.desc && a.pay > 0 && a.max >= 1 && (a.world || a.mech), a.id);
  // Beating the wave 60 boss queues one; earlier sector bosses do not.
  fresh(); run = launch(); run.offer = null; run.pendingLevels = 0;
  for (const wv of [50, 60]) { run.wave = wv; startWave(G.world); for (let i = 0; i < 4000 && G.world.wave.state === 'fighting'; i++) { for (const e of [...G.world.enemies]) if (e.alive) killEnemy(G.world, e, null, false, 0); step(TICK); }
    assert.equal(!!run.pendingAnomaly, wv === 60, 'Anomaly after the wave ' + wv + ' boss: ' + (wv === 60)); run.pendingRoute = false; run.routeOffer = null; run.pendingRelics = 0; run.relicOffer = null; }
  assert.ok(nextAnomaly() && choicePending(), 'An anomaly offer freezes combat'); assert.equal(run.anomalyOffer.length, 2); assert.notEqual(run.anomalyOffer[0], run.anomalyOffer[1]);
  const hp0 = G.world.mods.hp, sal0 = G.sheet.n('salvageGain'); run.anomalyOffer = ['hardened', 'lances']; pickAnomaly(0);
  assert.ok(G.world.mods.hp > hp0 * 1.15 && Math.abs(G.sheet.n('salvageGain') / sal0 - 1.2) < 1e-9, 'Hardened Hulls: tougher invaders, +20% salvage');
  const sc = run.score || 0; addScoreT(run, 100); assert.equal(run.score - sc, Math.round(100 * scoreMult(run.threat) * 1.2), 'Anomalies raise the score');
  run.anomalies.push('hardened', 'hardened'); recalc(); rollAnomalies(run); assert.ok(!run.anomalyOffer.includes('hardened'), 'A maxed anomaly is not offered again');
  run.anomalyOffer = ['lances', 'minefield']; pickAnomaly(0); assert.ok(G.world.anom?.lances, 'Rule anomalies switch on'); assert.equal(anomalyName('hardened', 3), 'Hardened Hulls III'); assert.equal(anomalyName('lances'), 'Void Lances');
  assert.ok(Math.abs(anomalyPay(run) - (1 + 0.2 * 3 + ANOMALY_BY_ID.lances.pay)) < 1e-9);
  endSortie('abandoned'); fresh(); assert.equal(G.world.anom ?? null, null, 'A new sortie starts clean'); }

// ---- v2.8: Counterattack stage 6 checkpoint ----
{ const { STAGE_BY_N } = await import('@last-orbit/data/counter.js');
  fresh(); G.state.counter.unlocked = true; G.state.counter.stars = { 5: 1 };
  run = launch({ counter: 6 }); run.offer = null; run.pendingLevels = 0; assert.ok(!run.fromCheckpoint);
  run.level = 40; { const c = G.world.counter; c.t = STAGE_BY_N[6].len * 0.5; c.next = c.events.findIndex((ev) => ev.t > c.t); } step(TICK); assert.ok(G.world.counter.mini, 'The mini-boss arrives at the midpoint'); killEnemy(G.world, G.world.counter.mini, null, false, 0); assert.equal(run.checkpointLevel, 40, 'Beating the stage 6 mini-boss saves the level');
  let r = endSortie('destroyed'); assert.ok(r.counter.checkpoint && G.state.counter.checkpoints['6'] === 40, 'A failed run past the mini-boss files a checkpoint');
  run = launch({ counter: 6, checkpoint: true }); assert.ok(run.fromCheckpoint && run.level === 40, 'Resume starts at the saved level');
  assert.ok(G.world.counter.midDone && G.world.counter.t > STAGE_BY_N[6].len * 0.5, 'Resume starts past the midpoint');
  run.stageCleared = true; run.hits = 0; run.pathKills = 999; run.pathSpawned = 1; r = endSortie('cleared');
  assert.equal(r.counter.stars, 1, 'A checkpoint run earns the clear star only'); assert.ok(!G.state.counter.checkpoints['6'], 'Clearing the stage uses up the checkpoint');
  assert.equal(STAGE_BY_N[1].place, 'Earth'); }

// ---- v2.8: new enemies (Binders share hits, Warpers swap places), the station and the Command Deck ----
{ const { ENEMIES } = await import('@last-orbit/data/enemies.js'); const { spawnEnemy } = await import('@last-orbit/combat/world.js');
  const { STATION_MODULES } = await import('@last-orbit/data/station.js'); const { refreshMenus, menuState, overhaul } = await import('@last-orbit/progression/meta.js');
  for (const id of ['burster', 'sower', 'binder', 'coiler', 'warper']) { assert.ok(ENEMIES[id]?.desc, id); assert.ok(SECTORS.some((sec) => sec.pool.some(([t]) => t === id)), id + ' is in a sector pool'); }
  fresh(); run = launch(); run.offer = null; run.pendingLevels = 0; const w = G.world;
  const a = spawnEnemy(w, 'binder', -5, 100, { slot: { x: -5, y: 0 } }), b = spawnEnemy(w, 'binder', 5, 100, { slot: { x: 5, y: 0 } }); a.link = b; b.link = a;
  const src = { ...G.sheet.weapons[run.order[0]], critChance: 0, dmg: a.hpMax.mul(0.4) };
  hitEnemy(w, a, src, 1, a.x, a.y, true); assert.ok(Math.abs(a.hp - 0.8) < 1e-6 && Math.abs(b.hp - 0.8) < 1e-6, 'A hit on one Binder lands half on each');
  killEnemy(w, a, null, false, 0); assert.ok(b.overcharged && !b.link, 'The surviving Binder overcharges');
  const wp = spawnEnemy(w, 'warper', -20, 110, { slot: { x: -20, y: 0 } }), other = spawnEnemy(w, 'grunt', 20, 110, { slot: { x: 20, y: 0 } }); wp.state = other.state = 'form';
  hitEnemy(w, wp, { ...src, dmg: wp.hpMax.mul(0.6) }, 1, wp.x, wp.y, true); assert.ok(wp.evaded && wp.slot.x !== -20, 'A badly hurt Warper swaps places'); endSortie('abandoned');
  assert.equal(new Set(STATION_MODULES.map((m) => m.id)).size, WORKSHOP.length, 'Every Workshop upgrade builds one station module');
  fresh(); G.state.seen.menusInit = true; refreshMenus(); assert.equal(menuState('deck'), 'locked', 'The Command Deck waits for the first Overhaul');
  for (const u of WORKSHOP) G.state.workshop[u.id] = u.max; overhaul(); assert.equal(menuState('deck'), 'new', 'The first Overhaul opens the Command Deck'); }

// ---- v2.9: the station never un-builds (Overhaul keeps each module's peak level) ----
{ const { overhaul, notePeaks } = await import('@last-orbit/progression/meta.js');
  fresh(); for (const u of WORKSHOP) G.state.workshop[u.id] = u.max; notePeaks(); overhaul();
  assert.ok(WORKSHOP.every((u) => G.state.stationPeak[u.id] === u.max), 'An Overhaul keeps every module the station had built');
  assert.ok(WORKSHOP.some((u) => (G.state.workshop[u.id] || 0) < u.max), 'while the Workshop itself resets');
  assert.equal(G.state.seen.intro, false, 'A new save plays the intro');
  const { setStationName } = await import('@last-orbit/progression/meta.js'); assert.equal(setStationName('  Halcyon <3 '), 'Halcyon 3'); assert.equal(G.state.stationName, 'Halcyon 3'); }

// ---- v2.10: the rebuild figure (modules 40, core pieces 40, Counterattack captures 20), each piece's reel and station AI line ----
{ const { rebuildPct, pieceAt, STATION_CORE, CORE_PIECES } = await import('@last-orbit/data/station.js');
  const max = Object.fromEntries(WORKSHOP.map((u) => [u.id, u.max])), pct = (workshop, stationPeak, level) => rebuildPct({ workshop, stationPeak, prestige: { level } });
  assert.equal(pct({}, {}, 0), 0, 'A new station is 0% rebuilt');
  assert.equal(pct(max, {}, 0), 40, 'Every module built is 40% of the rebuild');
  assert.equal(pct({}, max, 1), 44, 'The first Overhaul: modules kept, plus the Command Deck');
  assert.equal(pct({}, max, CORE_PIECES), 80, 'Every core piece adds the next 40%');
  assert.equal(pct(max, max, CORE_PIECES + 4), 80, 'Overhauls past the crown add nothing more');
  const all = { workshop: max, stationPeak: max, prestige: { level: CORE_PIECES }, counter: { stars: { 1: 1, 2: 3, 3: 1, 4: 2, 5: 1 }, hard: { 6: 1 }, tech: { x_alloy: 1, x_phase: 2, x_charts: 1, x_siphon: 3 } } };
  assert.equal(rebuildPct(all), 100, 'Counterattack captures are the last 20%: every boss towed home (either difficulty) and all alien hardware');
  assert.equal(rebuildPct({ ...all, counter: { ...all.counter, hard: {} } }), 98, 'One boss short is not complete');
  assert.equal(pieceAt(0), null); assert.equal(pieceAt(1).id, 'deck'); assert.equal(pieceAt(CORE_PIECES + 1), null, 'No reel past the crown');
  assert.ok(STATION_CORE.filter((c) => c.at >= 2).every((c) => c.say && c.name), 'Every piece after the Deck has a station AI line'); }

// ---- v2.9: station news (what a buy changed) and the alien hardware Alien Tech bolts on ----
{ const { stationSnapshot, STATION_ALIEN, STATION_MODULES } = await import('@last-orbit/data/station.js'); const { ALIEN_TECH } = await import('@last-orbit/data/alientech.js');
  assert.ok(STATION_MODULES.every((m) => m.name), 'Every module has a name for the station news');
  assert.deepEqual(STATION_ALIEN.map((a) => a.id).sort(), ALIEN_TECH.map((u) => u.id).sort(), 'Every Alien Tech upgrade has a piece on the station');
  assert.ok(STATION_ALIEN.every((a) => a.name && a.say && a.anchor), 'and a name, a strut and a station AI line');
  const base = { workshop: { w_dmg: 0 }, stationPeak: {}, prestige: { level: 0 }, counter: { tech: {} } };
  assert.equal(stationSnapshot(base).parts.w_dmg, 0, 'An unbought module is an outline');
  assert.equal(stationSnapshot({ ...base, workshop: { w_dmg: 1 } }).parts.w_dmg, 1, 'Its first level builds it');
  assert.equal(stationSnapshot({ ...base, workshop: { w_dmg: 10 } }).parts.w_dmg, 2, 'Maxed, it is lit');
  assert.equal(stationSnapshot({ ...base, stationPeak: { w_dmg: 10 } }).parts.w_dmg, 1, 'After an Overhaul it stays built, lights out');
  assert.equal(stationSnapshot({ ...base, counter: { tech: { x_alloy: 1 } } }).parts.x_alloy, 1, 'Alien Tech bolts its hardware on at level 1');
  const { STATION_TROPHIES, TROPHY_BY_ID } = await import('@last-orbit/data/station.js'); const { STAGES } = await import('@last-orbit/data/counter.js');
  assert.equal(STATION_TROPHIES.length, STAGES.length, 'Every Counterattack stage has a boss to tow home'); assert.ok(STATION_TROPHIES.every((t) => t.name && t.say && t.anchor), 'each named, with a field and a line');
  assert.equal(stationSnapshot({ ...base, counter: { tech: {}, stars: { 2: 1 } } }).parts.trophy2, 1, "Clearing stage 2 tows its boss home"); }

// ---- v2.8: callsign ----
{ const { cleanCallsign, setCallsign, CALLSIGN_MAX } = await import('@last-orbit/progression/meta.js');
  assert.equal(cleanCallsign('  Ace<b>  Rimmer!! '), 'Aceb Rimmer'); assert.equal(cleanCallsign('Zoë-7'), 'Zoë-7'); assert.equal(cleanCallsign('x'.repeat(40)).length, CALLSIGN_MAX); assert.equal(cleanCallsign('!!!'), '');
  fresh(); assert.equal(G.state.seen.callsign, false); assert.equal(setCallsign(' Adam '), 'Adam'); assert.equal(G.state.pilot.name, 'Adam'); assert.ok(G.state.seen.callsign);
  const back = parseSave(JSON.stringify(G.state)); assert.equal(back.pilot.name, 'Adam'); }

// ---- v2.4: warp start ----
{ const { warpMax } = await import('@last-orbit/progression/run.js');
  fresh(); assert.equal(warpMax(), 1, 'No warp before a sector is cleared'); G.state.warp = 4; run = launch(); assert.equal(run.wave, 1, 'Warp is clamped to what is unlocked'); endSortie('abandoned');
  fresh(); G.state.stats.sectorsCleared = 3; G.state.warp = 3; run = launch();
  assert.equal(run.wave, 21); assert.equal(run.warp, 3); assert.ok(run.pendingLevels >= 2 * BAL.warpCards, 'Warp grants catch-up cards'); assert.equal(run.pendingRelics, 2 * BAL.warpRelics);
  G.world.wave.num = 25; const ws = endSortie('abandoned'); assert.equal(ws.mastery.gained, 5, 'Mastery counts only waves flown'); assert.equal(G.state.records.top[0].warp, 3);
  G.state.warp = 3; run = startSortie({ daily: true }); assert.equal(run.wave, 1, 'The daily never warps'); endSortie('abandoned'); }

// ---- v2.4: synergies ----
{ const { SYNERGIES, synergyOf } = await import('@last-orbit/data/synergies.js'); const { autoPickIndex } = await import('@last-orbit/progression/run.js');
  const seen = new Set(); for (const s of SYNERGIES) for (const id of s.cards) { assert.ok(MODS.some((m) => m.id === id), id + ' is a card'); assert.ok(!seen.has(id), id + ' in one theme only'); seen.add(id); }
  fresh(); run = launch(); run.offer = null; run.pendingLevels = 0; const cc = G.sheet.n('critDmg'); let fired = null; const offS = bus.on('synergy', (s) => { fired = s.id; });
  for (const id of ['m_crit', 'm_critd']) { run.offer = [{ kind: 'mod', id, rarity: 'common' }]; pickCard(0); } assert.equal(fired, null);
  run.offer = [{ kind: 'mod', id: 'm_aim', rarity: 'common' }]; pickCard(0); assert.equal(fired, 'precision', 'Three Precision cards complete the theme'); offS();
  assert.ok(G.sheet.n('critDmg') > cc + 0.6, 'The synergy bonus applies');
  run.offer = [{ kind: 'mod', id: 'm_hull', rarity: 'common' }, { kind: 'mod', id: 'm_apen', rarity: 'common' }, { kind: 'heal', rarity: 'common' }]; assert.equal(autoPickIndex(run), 1, 'Auto-pick finishes a synergy tier');
  endSortie('abandoned'); }

// ---- v2.4: dodge dash ----
fresh(); run = launch(); step(TICK); { const p = G.world.player, x0 = p.x; G.world.input.dash = 1; for (let i = 0; i < 12; i++) step(TICK);
  assert.ok(p.x > x0 + 10, 'The dash moves the ship'); assert.ok(p.dashCd > 0);
  p.dashInv = 0.3; p.invuln = 0; p.shield = 0; const h0 = p.hull; hurtPlayer(G.world, 5); assert.equal(p.hull, h0, 'Dashing dodges damage');
  const cd = p.dashCd; G.world.input.dash = -1; step(TICK); assert.ok(p.dashCd <= cd, 'No dash while cooling down'); } endSortie('abandoned');

// ---- v2.4: boss intel ----
{ fresh(); G.state.stats.sectorsCleared = 3; G.state.warp = 4; run = launch(); const { debugSetWave } = await import('@last-orbit/combat/sim.js');
  run.pendingLevels = 0; run.pendingRelics = 0; run.offer = null; /* the warp's catch-up picks: waves wait for choices (v2.25.1) */
  debugSetWave(40); for (let i = 0; i < 400 && !G.world.wave.boss; i++) step(TICK); const boss = G.world.wave.boss; assert.ok(boss, 'Wave 40 has a boss');
  const p = G.world.player; p.invuln = 0; p.shield = 0; p.lastStand = false; run.windUsed = true; hurtPlayer(G.world, 1e9); for (let i = 0; i < 400 && G.state.run; i++) step(TICK);
  const intel = G.state.intel[boss.boss.id]; assert.equal(intel, 1, 'Dying to a sector boss records intel');
  const s = endSortie('destroyed'); assert.equal(s.intel.level, 1); }

// ---- v2.7: menus open up for new pilots ----
{ const M = await import('@last-orbit/progression/meta.js');
  fresh(); assert.deepEqual(M.refreshMenus(), [], 'A new pilot starts with only Launch'); assert.equal(M.menuState('workshop'), 'locked'); assert.equal(M.menuState('launch'), 'open');
  G.state.stats.sorties = 1; assert.deepEqual(M.refreshMenus(), ['workshop'], 'The Workshop opens after the first sortie'); assert.equal(M.menuState('workshop'), 'new');
  M.menuSeen('workshop'); assert.equal(M.menuState('workshop'), 'open'); assert.equal(M.menuState('awards'), 'locked');
  fresh(); G.state.stats.sorties = 9; M.refreshMenus(); assert.equal(M.menuState('awards'), 'open', 'Established pilots keep every menu, without explainers'); }

// ---- v2.6: Overhaul (prestige) ----
{ const M = await import('@last-orbit/progression/meta.js'); const { OVERHAUL_COST_STEP, BP_BASE } = await import('@last-orbit/data/prestige.js');
  fresh(); assert.equal(M.workshopMaxed(), false); assert.equal(M.overhaul(), 0, 'No Overhaul until the Workshop is maxed');
  for (const u of WORKSHOP) G.state.workshop[u.id] = u.max; recalc(); const d0 = G.sheet.n('damage');
  G.state.prestige.cycleBest = 75; assert.equal(M.overhaulReward(), BP_BASE + 1, 'Waves past 60 pay extra Blueprints');
  assert.equal(M.overhaul(), BP_BASE + 1); const pr = G.state.prestige;
  assert.equal(pr.level, 1); assert.equal(pr.bp, BP_BASE + 1); assert.equal(pr.cycleBest, 0); assert.equal(G.state.stats.overhauls, 1);
  assert.ok(WORKSHOP.every((u) => !G.state.workshop[u.id]), 'The Workshop is stripped back to zero'); assert.ok(G.sheet.n('damage') < d0);
  assert.ok(G.state.banners.t_overhaul, 'The Overhaul Log banner unlocks');
  assert.equal(M.workshopNext('w_dmg'), Math.round(workshopCost(WORKSHOP[0], 0) * (1 + OVERHAUL_COST_STEP) / 5) * 5, 'Each rank makes the Workshop dearer');
  // Blueprints: escort types need a bay; the first bay flies the Attack escort
  assert.equal(M.buyBlueprint('bp_intercept'), false, 'Escort types need an Escort Bay');
  assert.ok(M.buyBlueprint('bp_bay')); assert.deepEqual(pr.escorts, ['attack']);
  assert.ok(M.buyBlueprint('bp_intercept')); assert.ok(M.toggleEscort('intercept')); assert.deepEqual(pr.escorts, ['intercept'], 'A full bay swaps out the oldest pick');
  run = startSortie({ seed: 5 }); initWorld(); run.offer = null; run.pendingLevels = 0; step(TICK);
  assert.ok(G.world.drones.some((d) => d.type === 'intercept'), 'Escorts fly in the sortie'); endSortie('abandoned');
  // Head Start and trails
  pr.bp = 20; assert.ok(M.buyBlueprint('bp_head')); for (const u of WORKSHOP) G.state.workshop[u.id] = u.max; M.overhaul();
  assert.equal(G.state.workshop.w_dmg, 1, 'Head Start keeps a level'); assert.equal(G.state.workshop.w_revive, 0, 'but not the capstones');
  assert.ok(M.selectTrail('ember')); assert.equal(M.selectTrail('prism'), false, 'Prism needs Overhaul rank 3');
  assert.ok(M.powerRating() > 0); }

// ---- v2.5: Counterattack ----
{ const { unlockCounter, buyTech, powerRating } = await import('@last-orbit/progression/meta.js'); const { buildTimeline } = await import('@last-orbit/combat/counter.js');
  const { STAGES } = await import('@last-orbit/data/counter.js'); const { movePath, squadPaths } = await import('@last-orbit/combat/paths.js');
  fresh(); assert.equal(unlockCounter({ silent: true }), false, 'Locked before the sector 3 boss');
  G.state.stats.sectorsCleared = 3; assert.equal(unlockCounter({ silent: true }), true); assert.ok(G.state.counter.unlocked);
  // every stage builds a timeline that fills its length with squads of real enemies
  { const tl = buildTimeline(STAGES[0], false); assert.equal(STAGES[0].name, 'Liftoff'); assert.ok(tl.some((ev) => ev.type === 'tower' && ev.pattern === 'ground'), 'Liftoff has gun towers on the ground');
    assert.ok(tl.some((ev) => ev.type === 'skimmer'), 'Liftoff has skimmers'); assert.ok(tl.every((ev, i) => !i || tl[i - 1].t <= ev.t), 'The timeline is in order');
    assert.ok(!buildTimeline(STAGES[3], false).some((ev) => ev.type === 'tower'), 'Only Liftoff has gun towers');
    assert.ok(buildTimeline(STAGES[3], false).some((ev) => ev.type === 'hullgun'), 'Iron Curtain has deck guns'); assert.ok(buildTimeline(STAGES[4], false).some((ev) => ev.type === 'spore'), 'Hive Breach has spore pods'); }
  // set pieces: wrecks are cover, hive walls hem the ship in, the singularity pulls
  { const SP = await import('@last-orbit/combat/setpieces.js');
    run = startSortie({ counter: 2, seed: 3 }); initWorld(); run.offer = null; run.pendingLevels = 0; step(TICK); assert.equal(G.world.set.kind, 'wrecks');
    G.world.set.items.push({ x: 0, y: 40, w: 20, h: 8, rot: 0, vr: 0, seed: 1 }); G.world.ebullets.push({ x: 0, y: 41, vx: 0, vy: 0, r: 1, dmg: 1, alive: true, kind: 'bolt' }); step(TICK);
    assert.ok(!G.world.ebullets.some((b) => b.alive && Math.abs(b.y - 41) < 2 && b.x === 0), 'A wreck stops enemy fire');
    G.world.player.x = 0; G.world.player.y = 38; step(TICK); assert.ok(Math.abs(G.world.player.y - 40) > 3 || Math.abs(G.world.player.x) > 9, 'The ship cannot sit inside a wreck'); endSortie('abandoned');
    run = startSortie({ counter: 5, seed: 3 }); initWorld(); run.offer = null; run.pendingLevels = 0; G.world.counter.t = 60; step(TICK); G.world.player.x = -60; step(TICK);
    assert.ok(G.world.player.x > -50.5 + SP.hiveDepth(G.world.player.y + G.world.set.scroll, -1, G.world.set.ramp) - 0.5, 'Hive walls hem the ship in'); endSortie('abandoned');
    run = startSortie({ counter: 6, seed: 3 }); initWorld(); run.offer = null; run.pendingLevels = 0; G.world.counter.t = 10; G.world.player.x = -30; const x0 = G.world.player.x; for (let i = 0; i < 30; i++) step(TICK);
    assert.ok(G.world.player.x > x0, 'The singularity pulls the ship'); endSortie('abandoned'); G.state.stats.counterRuns = 0; }
  for (const sg of STAGES) { const tl = buildTimeline(sg, false); assert.ok(tl.length > 30, 'stage ' + sg.n + ' has squads'); assert.ok(tl.every((ev) => ev.type && ev.pattern && ev.n > 0)); assert.ok(buildTimeline(sg, true).length > tl.length, 'Hard mode is denser'); }
  // every path pattern moves an enemy and eventually lets it leave
  for (const kind of ['column', 'vee', 'sweep', 'swirl', 'hover', 'dive']) { const [path] = squadPaths(kind, 1, 0, 1, 0, Math.random); const e = { x: 0, y: 160, rot: 0, path }; let alive = true, n = 0; while (alive && n++ < 4000) alive = movePath(e, 1 / 60, { x: 0, y: 9 }); assert.ok(!alive, kind + ' leaves the field'); }
  // a stage flies in 2D, pays stars and cores on a clear, and records the best score
  run = startSortie({ counter: 1, seed: 3 }); initWorld(); run.offer = null; run.pendingLevels = 0;
  assert.equal(run.mode, 'counter'); assert.equal(G.state.stats.counterRuns, 1, 'Counterattack flights are counted for the flight lesson'); assert.ok(G.world.counter); assert.equal(G.world.barriers.length, 0, 'No bunkers in Counterattack');
  G.world.input.keysY = 1; for (let i = 0; i < 60; i++) step(TICK); assert.ok(G.world.player.y > 20, 'The ship flies up in Counterattack'); G.world.input.keysY = 0;
  for (let i = 0; i < 60 * 6; i++) step(TICK); assert.ok(run.pathSpawned > 0, 'Squads arrive');
  run.stageCleared = true; run.hits = 2; run.pathKills = run.pathSpawned; run.score = 1234;
  let cs = endSortie('cleared'); assert.equal(cs.counter.stars, 3); assert.equal(cs.counter.cores, 3); assert.ok(cs.counter.bounty > 0);
  assert.equal(G.state.counter.stars[1], 3); assert.equal(G.state.counter.best[1], 1234); assert.equal(G.state.stats.counterStars, 3);
  run = startSortie({ counter: 1, seed: 3 }); initWorld(); run.stageCleared = true; run.hits = 9; cs = endSortie('cleared'); assert.equal(cs.counter.cores, 0, 'Stars pay once');
  // Alien Tech spends cores and strengthens both modes
  const d0 = G.sheet.n('damage'); assert.ok(buyTech('x_alloy')); assert.equal(G.state.counter.cores, 1); assert.ok(G.sheet.n('damage') > d0); assert.equal(buyTech('x_phase'), false, 'Needs enough cores');
  assert.ok(powerRating() >= 2);
  // clearing stage 6 unlocks the Xeno paint
  run = startSortie({ counter: 6, seed: 3 }); initWorld(); run.stageCleared = true; endSortie('cleared'); assert.ok(G.state.paints.xeno); }

// ---- saves round-trip and refuse newer schemas ----
fresh(); G.state.salvage = 1234; G.state.workshop.w_hull = 3;
const back = parseSave(JSON.stringify(G.state)); assert.equal(back.salvage, 1234); assert.equal(back.workshop.w_hull, 3); assert.equal(back.v, SCHEMA);
assert.throws(() => parseSave(JSON.stringify({ ...G.state, v: SCHEMA + 1 })), /newer version/);
assert.throws(() => parseSave('{"run":{},"cur":{}}'), /Not a Last Orbit v2 save/);

// ---- v2.10 / v2.14: Station Siege, fought from the gunner seat ----
{ const S = await import('@last-orbit/data/siege.js'), { SIEGE_TIERS, TIER_BY_N, siegeOpen, siegeSystems, SIEGE_BLUEPRINTS, siegeGuns, siegePay } = S;
  const { settleSiege, repairStation, patchStation, PATCH_TIME } = await import('@last-orbit/progression/siege.js'); const { turretKit, TURRET_MOD } = await import('@last-orbit/data/turret.js');
  fresh(); assert.equal(SIEGE_TIERS.length, 6); assert.equal(siegeOpen(G.state, 1), false, 'No siege before the first Counterattack clear');
  G.state.counter.unlocked = true; G.state.counter.stars[1] = 1; assert.equal(siegeOpen(G.state, 1), true, 'Clearing stage 1 brings the first siege'); assert.equal(siegeOpen(G.state, 2), false);
  assert.equal(siegeSystems(G.state).count, 0, 'A bare station has no defences');
  for (const t of SIEGE_TIERS) { assert.ok(t.plan.length >= 4 && t.plan.at(-1).cap, `Tier ${t.n} ends on a capital ship`); assert.ok(TURRET_MOD[t.gun], `Tier ${t.n} fits a real turret upgrade`); assert.ok(t.salvage > 0 && t.repair > 0 && t.breaks > 0); }
  for (let n = 2; n <= 6; n++) assert.ok(TIER_BY_N[n].hp >= TIER_BY_N[n - 1].hp && TIER_BY_N[n].salvage > TIER_BY_N[n - 1].salvage, 'Each tier is tougher and pays more');
  const bare = turretKit(G.state);
  G.state.workshop.w_hull = 1; G.state.workshop.w_shield = 5; G.state.workshop.w_dmg = 1; const sys = siegeSystems(G.state).on, shieldAt = S.SYSTEM_BY_ID.w_shield.at;
  assert.ok(sys.w_hull > 0 && sys.w_shield === shieldAt[1] && shieldAt[1] > shieldAt[0], 'Built modules are systems; maxed ones work harder');
  const kit = turretKit(G.state); assert.ok(kit.dmg > bare.dmg && kit.armour > 0 && kit.shieldMax === shieldAt[1], 'and they arm the guns');
  // a win: stars by the hull kept, salvage (double the first time), Blueprints and a turret upgrade for good, the first time only
  G.state.salvage = 0; const bp0 = G.state.prestige.bp, cores0 = G.state.counter.cores || 0;
  let r = settleSiege({ tier: 1, won: true, hull: 0.9, kills: 40, score: 9000 });
  assert.equal(r.stars, 3); assert.equal(G.state.prestige.bp - bp0, SIEGE_BLUEPRINTS); assert.equal((G.state.counter.cores || 0) - cores0, 3);
  assert.equal(r.salvage, siegePay(TIER_BY_N[1], 0.9, true)); assert.equal(G.state.salvage, r.salvage); assert.equal(r.gun, TIER_BY_N[1].gun); assert.deepEqual(siegeGuns(G.state), { [TIER_BY_N[1].gun]: 1 }, 'The guns keep the upgrade');
  r = settleSiege({ tier: 1, won: true, hull: 0.6, kills: 30, score: 5000 });
  assert.equal(r.bp, 0, 'Blueprints only on the first win'); assert.equal(r.cores, 0, 'cores only for new stars'); assert.equal(r.gun, null); assert.equal(r.salvage, siegePay(TIER_BY_N[1], 0.6, false), 'and salvage every time, by the hull kept');
  assert.ok(siegePay(TIER_BY_N[1], 1, false) > siegePay(TIER_BY_N[1], 0.3, false), 'A cleaner hold pays more'); assert.equal(G.state.siege.kills, 70, 'Invaders downed are tallied');
  // a loss: some systems knocked offline (the guns go without them) until repaired, for salvage or by a sortie long enough
  const before = siegeSystems(G.state).count; r = settleSiege({ tier: 1, won: false, hull: 0, kills: 5, score: 100 }, () => 0);
  assert.equal(r.stars, 0); assert.equal(r.broke.length, Math.min(TIER_BY_N[1].breaks, before)); assert.equal(siegeSystems(G.state).count, before - r.broke.length, 'A lost siege knocks systems out');
  assert.ok(siegeSystems(G.state).list.filter((x) => x.damaged).length === r.broke.length && S.siegeDamage(G.state).cost === TIER_BY_N[1].repair);
  assert.ok(!r.broke.includes('w_salvage'), 'never the cargo hold'); assert.ok(turretKit(G.state).dmg < kit.dmg || turretKit(G.state).armour < kit.armour || turretKit(G.state).shieldMax < kit.shieldMax, 'and the guns feel it');
  assert.equal(G.state.workshop.w_dmg, 1, 'The Workshop itself is untouched');
  G.state.salvage = 10; assert.equal(repairStation(), false, 'Repairs cost salvage'); assert.equal(patchStation(PATCH_TIME - 1), null, 'A short sortie is not long enough for the crews'); assert.ok(S.siegeDamage(G.state));
  G.state.salvage = TIER_BY_N[1].repair; assert.equal(repairStation(), true); assert.equal(G.state.salvage, 0); assert.equal(siegeSystems(G.state).count, before, 'Paid for, every system is back');
  settleSiege({ tier: 1, won: false, hull: 0 }, () => 0); assert.deepEqual(patchStation(PATCH_TIME).length > 0, true, 'or the crews patch it while the pilot is out'); assert.equal(S.siegeDamage(G.state), null);
  settleSiege({ tier: 1, won: false, hull: 0 }, () => 0); r = settleSiege({ tier: 1, won: true, hull: 0.5 }); assert.ok(r.repaired.length > 0 && !S.siegeDamage(G.state), 'and a siege held repairs it too');
  // a sortie of a minute or more finishes the repairs, and the debrief says so
  settleSiege({ tier: 1, won: false, hull: 0 }, () => 0); launch(); G.state.run.time = PATCH_TIME + 5; let sum = endSortie('abandoned'); assert.ok(sum.repaired?.length > 0 && !S.siegeDamage(G.state), 'A sortie brings the crews home with the station patched');
  settleSiege({ tier: 1, won: false, hull: 0 }, () => 0); launch(); G.state.run.time = 10; sum = endSortie('abandoned'); assert.equal(sum.repaired, null); assert.ok(S.siegeDamage(G.state), 'but not a sortie abandoned at once'); }

// ---- v2.10.1: sounds come back after the phone sleeps (a new audio context's clock starts again at zero) ----
{ let clock = 500, oscs = 0; const node = () => ({ connect() {}, disconnect() {}, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} } });
  class FakeCtx { constructor() { this.currentTime = clock; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; }
    createGain() { return node(); } createDynamicsCompressor() { return { ...node(), threshold: {}, ratio: {} }; } createBuffer() { return { getChannelData: () => new Float32Array(8) }; }
    createBiquadFilter() { return { ...node(), frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 } }; } createBufferSource() { return { ...node(), playbackRate: {}, start() {} }; }
    createOscillator() { oscs++; return { ...node(), frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, start() {}, stop() {} }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } }
  globalThis.window ||= {}; const had = window.AudioContext; window.AudioContext = FakeCtx;
  const A = await import('@last-orbit/audio/audio.js'); fresh();
  A.initAudio(); A.playSfx('cannon'); assert.equal(oscs, 1, 'A gunshot plays');
  A.suspendAudio(true); clock = 0.5; A.initAudio(); A.playSfx('cannon'); assert.equal(oscs, 2, 'and still plays on the fresh context after the phone slept');
  A.suspendAudio(true); window.AudioContext = had; }

// ---- v2.10.1: the opening tips play once ----
{ fresh(); G.state.stats.sorties = 1; assert.ok(!G.state.seen.steerTip, 'A new pilot has not seen the steering tip'); }

// ---- v2.11: Defence Control, the station's war room ----
{ const S = await import('@last-orbit/data/siege.js'); fresh();
  const ids = S.SIEGE_CONSOLES.flatMap((c) => c.ids); assert.equal(new Set(ids).size, ids.length, 'No system sits on two consoles');
  assert.deepEqual([...ids].sort(), S.SIEGE_SYSTEMS.map((x) => x.id).sort(), 'Every siege system has a console');
  for (const x of S.SIEGE_SYSTEMS) assert.ok(!/undefined|x_|w_/.test(S.systemSource(x.id)), `${x.id} names the upgrade that brings it online`);
  assert.equal(S.nextSiege(G.state), null, 'Nothing massing before the first Counterattack clear'); assert.equal(S.lockedSiege(G.state).n, 1);
  G.state.counter.unlocked = true; G.state.counter.stars[1] = 1; G.state.counter.stars[2] = 1; assert.equal(S.nextSiege(G.state).n, 1, 'The lowest open tier not yet held is next');
  G.state.siege.won[1] = 1; assert.equal(S.nextSiege(G.state).n, 2); G.state.siege.won[2] = 1; assert.equal(S.nextSiege(G.state), null, 'All open tiers held: all quiet'); assert.equal(S.lockedSiege(G.state).n, 3);
  const lines = Array.from({ length: 12 }, (_, k) => S.siegeAdvice(G.state, k)); assert.ok(lines.every((l) => l && !/undefined|NaN/.test(l)), 'ORBIT always has something sensible to say');
  assert.ok(lines.some((l) => l.includes('Counterattack stage 3')), 'ORBIT points at what provokes the next siege');
  for (const u of S.SIEGE_SYSTEMS.filter((x) => !x.alien)) G.state.workshop[u.id] = 1; assert.ok(Array.from({ length: 10 }, (_, k) => S.siegeAdvice(G.state, k)).some((l) => l.startsWith('Our ')), 'Once a module is built, ORBIT suggests maxing it');
  for (const u of WORKSHOP) G.state.workshop[u.id] = u.max; for (const a of ['x_alloy', 'x_phase', 'x_charts', 'x_siphon']) G.state.counter.tech[a] = 1;
  assert.equal(S.siegeSystems(G.state).count, S.SIEGE_SYSTEMS.length); assert.ok(S.siegeAdvice(G.state, 1).includes('maxed'), 'and says so when every system is maxed'); }

// ---- v2.15: the Trophy Hall ----
{ const S = await import('@last-orbit/data/station.js'); const { BOSSES } = await import('@last-orbit/data/bosses.js'); const { spawnBoss } = await import('@last-orbit/combat/bosses.js');
  fresh(); assert.equal(S.hallOpen(G.state), false, 'The hall is shut before the Habitat ring is back'); G.state.prestige.level = S.HALL_RANK; assert.equal(S.hallOpen(G.state), true, 'and opens with it');
  assert.equal(S.HUNTED.length, 6); assert.ok(S.HUNTED.every((b) => BOSSES[b.id] && !BOSSES[b.id].mini), 'The hunting record is the six sector bosses'); assert.equal(new Set(S.HUNTED.map((b) => b.id)).size, 6);
  launch(); const e = spawnBoss(G.world, 'bastion'); killEnemy(G.world, e, null); assert.equal(G.state.stats.bossBy.bastion, 1, 'Each boss kill is tallied by boss');
  endSortie('abandoned'); }

// ---- v2.15: daily bounties (the Comms room) ----
{ const B = await import('@last-orbit/progression/bounties.js'), D = await import('@last-orbit/data/bounties.js');
  fresh(); G.state.stats.sorties = 20; G.state.stats.kills = 6000; G.state.stats.bestWave = 30; G.state.history = [800, 1000, 1200, 900].map((salvage) => ({ salvage }));
  assert.equal(B.refreshBounties(G.state, '2030-01-01'), null); assert.equal(G.state.bounties.list.length, 0, 'No bounties before the Comms spire is back');
  G.state.prestige.level = D.COMMS_RANK; B.refreshBounties(G.state, '2030-01-01'); const L = G.state.bounties.list;
  assert.equal(L.length, 3); assert.deepEqual(L.map((b) => b.tier), [1, 2, 3], 'One easy, one harder, one hard');
  assert.ok(L.every((b) => b.goal > 0 && b.reward > 0 && !b.done), 'Each has a goal and pay, and starts open'); assert.ok(L[2].reward > L[0].reward, 'Harder pays more');
  assert.equal(B.refreshBounties(G.state, '2030-01-01'), null, 'The same day keeps the same three'); assert.equal(G.state.bounties.list, L);
  // a job sized to the pilot, counted from when it was posted
  const kills = B.makeBounty(G.state, D.BOUNTY_BY_ID.kills); assert.equal(kills.goal, 450, 'Kills: one and a half sorties of the pilot\'s average'); assert.equal(B.bountyProgress(G.state, kills), 0);
  G.state.stats.kills += 200; assert.equal(B.bountyProgress(G.state, kills), 200);
  const reach = B.makeBounty(G.state, D.BOUNTY_BY_ID.reach); assert.equal(reach.goal, 26);
  // finish all three (whatever they are), collect, and the day's Blueprint
  G.state.bounties.list = [B.makeBounty(G.state, D.BOUNTY_BY_ID.kills), B.makeBounty(G.state, D.BOUNTY_BY_ID.bosses), reach];
  assert.equal(B.rerollBounty(G.state, 1), true, 'One swap a day'); assert.notEqual(G.state.bounties.list[1].id, 'bosses'); assert.equal(B.rerollBounty(G.state, 0), false, 'and only one');
  const [a, b] = G.state.bounties.list, stat = (x) => D.BOUNTY_BY_ID[x.id].stat; G.state.stats[stat(a)] = (G.state.stats[stat(a)] || 0) + a.goal;
  if (D.BOUNTY_BY_ID[b.id].best) b.best = b.goal; else G.state.stats[stat(b)] = (G.state.stats[stat(b)] || 0) + b.goal;
  let done = B.checkBounties(G.state, { wave: 25, ship: 'vanguard' }); assert.equal(done.length, 2, 'Two done'); assert.equal(reach.best, 25);
  assert.equal(B.bountyClaimable(G.state), true); const s0 = G.state.salvage, bp0 = G.state.prestige.bp;
  assert.equal(B.claimBounty(G.state, 0).salvage, a.reward); assert.equal(G.state.salvage, s0 + a.reward); assert.equal(B.claimBounty(G.state, 0).salvage, 0, 'Paid once');
  done = B.checkBounties(G.state, { wave: 27, ship: 'vanguard' }); assert.deepEqual(done, [reach], 'A sortie deep enough finishes the reach job');
  B.claimBounty(G.state, 2); assert.equal(G.state.prestige.bp, bp0, 'No bonus until all three are paid'); const r = B.claimBounty(G.state, 1); assert.equal(r.bp, D.BOUNTY_BONUS_BP, 'All three: the Blueprint'); assert.equal(G.state.bounties.days, 1);
  // a new day pays anything done but not collected, and posts three new
  G.state.stats.kills += 99999; const k2 = B.makeBounty(G.state, D.BOUNTY_BY_ID.kills); G.state.bounties.list = [k2]; G.state.stats.kills += k2.goal; B.checkBounties(G.state); const s1 = G.state.salvage;
  const paid = B.refreshBounties(G.state, '2030-01-02'); assert.equal(paid.salvage, k2.reward, 'Nothing earned is lost overnight'); assert.equal(G.state.salvage, s1 + k2.reward); assert.equal(G.state.bounties.list.length, 3); assert.equal(G.state.bounties.day, '2030-01-02');
  // and a sortie's end reports what it finished
  G.state.bounties.list = [B.makeBounty(G.state, D.BOUNTY_BY_ID.waves)]; launch(); G.state.stats.wavesCleared = (G.state.stats.wavesCleared || 0) + 9999; const sum = endSortie('abandoned'); assert.ok(sum.bounties.length === 1, 'The debrief lists the bounties a sortie finished'); }

// ---- v2.15: the Pilot's quarters ----
{ const Q = await import('@last-orbit/progression/quarters.js'), D = await import('@last-orbit/data/quarters.js'); const { grantSalvage } = await import('@last-orbit/progression/run.js');
  fresh(); assert.equal(D.quartersOpen(G.state), false); G.state.prestige.level = D.QUARTERS_RANK; assert.equal(D.quartersOpen(G.state), true, 'The quarters open with the Outer ring');
  assert.equal(Q.rest(G.state, '2030-02-01'), 'rested', 'A night in the bunk'); assert.equal(Q.rest(G.state, '2030-02-01'), 'already', 'still rested until a sortie');
  launch(); assert.equal(G.state.run.rested, true, 'The next sortie takes the rest with it'); assert.equal(G.state.quarters.rested, false);
  const a = grantSalvage(100); G.state.run.rested = false; const b = grantSalvage(100); assert.ok(Math.abs(a / b - (1 + D.REST_BONUS)) < 1e-9, 'A rested pilot banks more salvage');
  G.state.run.rested = true; const sum = endSortie('abandoned'); assert.equal(sum.rested, true, 'The debrief says so');
  assert.equal(Q.rest(G.state, '2030-02-01'), 'tomorrow', 'Once a day'); assert.equal(Q.rest(G.state, '2030-02-02'), 'rested', 'and again the next');
  fresh(); assert.equal(Q.keepsakesEarned(G.state).length, 0, 'A new pilot has found nothing yet'); G.state.stats.sorties = 1; G.state.stats.deaths = 1; assert.deepEqual(Q.keepsakesEarned(G.state).map((k) => k.id), ['k_chip', 'k_plate']);
  for (const k of D.KEEPSAKES) assert.ok(k.name && k.how && k.log && typeof k.req(G.state) === 'boolean', `${k.id} is complete`);
  const m0 = G.state.quarters.mood; const seen = new Set([m0]); for (let i = 0; i < D.MOODS.length; i++) seen.add(Q.nextMood(G.state).id); assert.equal(seen.size, D.MOODS.length, 'The switch goes round every mood'); }

// ---- v2.15: the Observatory and the Deep Void chart ----
{ const O = await import('@last-orbit/progression/observatory.js'), D = await import('@last-orbit/data/observatory.js'); const { PAINT_BY_ID } = await import('@last-orbit/data/career.js');
  fresh(); for (const m of D.VOID_MARKS) { assert.ok(m.wave > 60 && m.bp > 0 && m.stars.length >= 3, `${m.name} is a Deep Void depth with a constellation`); if (m.paint) assert.equal(PAINT_BY_ID[m.paint]?.source, 'void'); }
  assert.deepEqual(O.newMarks(58, 75).map((m) => m.wave), [61, 71], 'A sortie from wave 58 to 75 reaches two new depths'); assert.deepEqual(O.newMarks(75, 80), []);
  G.state.stats.bestWave = 84; assert.deepEqual(O.chartable(G.state).map((m) => m.wave), [61, 71, 81]); assert.equal(O.chartMark(G.state, 61), null, 'Nothing is charted before the Observatory is back');
  G.state.prestige.level = D.OBSERVATORY_RANK; const bp0 = G.state.prestige.bp; const r = O.chartMark(G.state, 61);
  assert.equal(r.bp, 2); assert.equal(G.state.prestige.bp - bp0, 2); assert.ok(G.state.paints.v_starlit, 'and its paint is yours'); assert.equal(O.chartMark(G.state, 61), null, 'Charted once');
  assert.equal(O.chartMark(G.state, 91), null, 'A depth not reached cannot be charted'); assert.deepEqual(O.chartable(G.state).map((m) => m.wave), [71, 81]);
  launch(); G.state.run.prevBest = 30; G.state.run.wave = 31; G.world.fx.length = 0; startWave(G.world); assert.ok(G.world.fx.some((f) => f.k === 'newBest'), 'Passing your best says so as it happens');
  G.world.fx.length = 0; G.state.run.wave = 33; startWave(G.world); assert.ok(!G.world.fx.some((f) => f.k === 'newBest'), 'once'); endSortie('abandoned'); }

// ---- v2.16: the Shipyard builds the Chimera ----
{ const Y = await import('@last-orbit/progression/shipyard.js'), D = await import('@last-orbit/data/shipyard.js'), P = await import('@last-orbit/combat/passives.js'); const { spawnEnemy } = await import('@last-orbit/combat/world.js');
  fresh(); assert.ok(SHIPS.find((s) => s.id === D.YARD_SHIP)?.yard, 'The Shipyard builds a ship of its own');
  G.state.salvage = 1e9; assert.equal(shipStatus(D.YARD_SHIP), 'yard'); assert.equal(buyShip(D.YARD_SHIP), false, 'She is built, never bought');
  assert.equal(Y.stageBlock(G.state), 'closed', 'The yard waits for its frame'); assert.equal(Y.buildStage(G.state), null);
  G.state.prestige.level = D.YARD_RANK; G.state.salvage = 0; G.state.counter.cores = 0; G.state.prestige.bp = 0;
  assert.equal(Y.nextStage(G.state).cost.salvage, D.stageSalvage(D.YARD_STAGES[0], D.YARD_RANK)); assert.equal(Y.stageBlock(G.state), 'salvage');
  assert.ok(D.stageSalvage(D.YARD_STAGES[0], 9) > D.stageSalvage(D.YARD_STAGES[0], 7), "The yard's prices rise with the Overhaul rank, like the Workshop's");
  G.state.salvage = 1e7; assert.ok(Y.buildStage(G.state), 'The keel is laid'); assert.equal(Y.yardStage(G.state), 1); assert.ok(G.state.shipyard.at[0] > 0, 'and the day logged');
  assert.equal(Y.stageBlock(G.state), 'cores', 'The plating needs Alien Cores'); G.state.counter.cores = 3; const s0 = G.state.salvage; Y.buildStage(G.state);
  assert.equal(G.state.counter.cores, 0); assert.equal(s0 - G.state.salvage, D.stageSalvage(D.YARD_STAGES[1], D.YARD_RANK));
  assert.equal(Y.stageBlock(G.state), 'bp', 'The drive needs Blueprints'); G.state.prestige.bp = 2; Y.buildStage(G.state); assert.equal(G.state.unlocked.ships[D.YARD_SHIP], undefined, 'Not hers until the last stage');
  const owned0 = Object.keys(G.state.unlocked.ships).length; Y.buildStage(G.state);
  assert.ok(G.state.unlocked.ships[D.YARD_SHIP], 'Commissioned: she is in the hangar'); assert.equal(G.state.ship, D.YARD_SHIP, 'and flown next'); assert.equal(G.state.stats.shipsOwned, owned0 + 1); assert.equal(shipStatus(D.YARD_SHIP), 'owned');
  assert.ok(Y.yardDone(G.state)); assert.equal(Y.nextStage(G.state), null); assert.equal(Y.stageBlock(G.state), 'done'); assert.equal(Y.buildStage(G.state), null, 'Built once');
  // Meltdown: an enemy that dies burning bursts, hitting and lighting what is close; one that dies cold does not
  launch(); const w = G.world; assert.equal(w.passive, 'meltdown', 'She flies with Meltdown'); w.enemies.length = 0;
  const a = spawnEnemy(w, 'grunt', 0, 100, { slot: { x: 0, y: 0 } }), b = spawnEnemy(w, 'grunt', 4, 100, { slot: { x: 4, y: 0 } }), far = spawnEnemy(w, 'grunt', 40, 100, { slot: { x: 40, y: 0 } });
  const c = spawnEnemy(w, 'grunt', -30, 100, { slot: { x: -30, y: 0 } }); killEnemy(w, c, null, false, 0); assert.equal(w.melts.length, 0, 'A cold kill does not burst');
  a.burn = 0.2; a.burnT = 2; killEnemy(w, a, null, false, 0); assert.equal(w.melts.length, 2, 'A burning kill bursts (next tick)'); P.updatePassives(w, TICK);
  assert.ok(b.hp < 1 && (!b.alive || b.burnT > 0), 'The enemy beside it is hit and set alight'); assert.ok(far.hp === 1 && !(far.burnT > 0), 'One further off is not'); assert.equal(w.melts.length, 0);
  endSortie('abandoned'); }

// ---- v2.17: the Beacon array and the Void bosses ----
{ const D = await import('@last-orbit/data/beacons.js'), B = await import('@last-orbit/progression/beacons.js'); const { BOSSES } = await import('@last-orbit/data/bosses.js'); const { SHAPE_IDS } = await import('@last-orbit/rendering/geometry.js');
  const KINDS = ['aimed', 'ring', 'spiral', 'rain', 'beam', 'shell', 'summon', 'well', 'teleport', 'hbeam', 'sweep', 'mines', 'wave', 'split', 'gapwall', 'veil', 'ambush'];
  for (const id of D.VOID_BOSSES) { const b = BOSSES[id]; assert.ok(b && b.title === 'Void boss' && SHAPE_IDS.includes(b.shape), `${id} is a Void boss with a body`); for (const ph of b.phases) for (const a of ph.attacks) assert.ok(KINDS.includes(a.kind), `${id} attacks with ${a.kind}`); assert.ok(D.VOID_LORE[id], `${id} has its story`); }
  assert.deepEqual([70, 80, 90, 100, 110, 120].map(D.voidBossAt), D.VOID_BOSSES, 'One ends each Deep Void sector, in turn'); assert.equal(D.voidBossAt(130), 'watcher', 'then round again'); assert.equal(D.voidBossAt(125), 'watcher');
  const bossAt = (rank, wave, mode) => { fresh(); G.state.prestige.level = rank; launch(mode ? { mode } : {}); G.state.run.wave = wave; startWave(G.world); const id = G.world.wave.boss?.boss?.id; endSortie('abandoned'); return id; };
  assert.equal(bossAt(7, 70), 'dreadnought', 'Before the beacons, the old sector bosses come round again'); assert.equal(bossAt(8, 70), 'watcher', 'Lit, something answers'); assert.equal(bossAt(8, 120), 'maw'); assert.equal(bossAt(8, 60), 'singularity', 'The Singularity still ends sector 6');
  fresh(); G.state.prestige.level = D.BEACON_RANK; const bp0 = G.state.prestige.bp; const r1 = B.recordVoidKill(G.state, 'watcher');
  assert.equal(r1.bp, D.VOID_BOSS_BP); assert.equal(G.state.prestige.bp - bp0, D.VOID_BOSS_BP, 'The first kill pays Blueprints'); assert.equal(B.recordVoidKill(G.state, 'watcher'), null, 'once'); assert.equal(B.recordVoidKill(G.state, 'bastion'), null, 'Only Void bosses count');
  for (const id of D.VOID_BOSSES.slice(1, -1)) B.recordVoidKill(G.state, id); assert.ok(!G.state.paints[D.LIGHTKEEPER]); const last = B.recordVoidKill(G.state, 'maw');
  assert.equal(last.paint, D.LIGHTKEEPER, 'The sixth pays the Lightkeeper paint'); assert.ok(G.state.paints[D.LIGHTKEEPER] && B.allBeaten(G.state));
  // a Void boss falling in a sortie goes on the record and in the debrief
  fresh(); G.state.prestige.level = D.BEACON_RANK; launch(); G.state.run.wave = 70; startWave(G.world); const boss = G.world.wave.boss; assert.equal(boss.boss.id, 'watcher');
  killEnemy(G.world, boss, null, false, 0); assert.ok(B.beaten(G.state).watcher, 'Beaten'); const sum = endSortie('abandoned'); assert.equal(sum.voidBeaten?.[0]?.id, 'watcher', 'and said so in the debrief'); }

// ---- v2.17: finding your way aboard, and how to beat each boss ----
{ const R = await import('@last-orbit/data/rooms.js'); const { STATION_CORE } = await import('@last-orbit/data/station.js'); const { BOSSES } = await import('@last-orbit/data/bosses.js');
  for (const r of R.ROOMS_ABOARD) { assert.ok(r.name && r.icon && r.color && r.for, `${r.id} says what it is for`); if (r.seen) assert.ok(r.lock && r.intro && r.door, `${r.id} says how to find it`); }
  for (const c of STATION_CORE.filter((c) => c.at >= 1 && c.at <= 8)) assert.equal(!!R.roomAt(c.at), c.id !== 'solar', `Overhaul rank ${c.at} opens a room (the Solar wings do not)`);
  fresh(); G.state.prestige.level = 7; assert.ok(R.roomFresh('yard', G.state), 'A room just opened is new until visited'); assert.ok(!R.roomFresh('beacons', G.state), 'one still sealed is not');
  G.state.seen.shipyard = true; assert.ok(!R.roomFresh('yard', G.state), 'Visited'); assert.ok(!R.roomFresh('control', G.state), 'Defence Control waits for the invaders to strike back');
  G.state.counter.stars[1] = 1; assert.ok(R.roomFresh('control', G.state));
  // every boss says how to beat it as it arrives, until you have beaten it once
  for (const [id, b] of Object.entries(BOSSES)) assert.ok(b.tip || b.weak, `${id} has a tip`);
  const bossIntro = () => G.world.fx.find((f) => f.k === 'bossIntro');
  fresh(); launch(); G.state.run.wave = 20; startWave(G.world); const id = G.world.wave.boss.boss.id; assert.equal(bossIntro().a, BOSSES[id].name); assert.equal(bossIntro().d, BOSSES[id].tip, 'A boss not yet beaten arrives with its tip');
  G.state.stats.bossBy[id] = 1; G.world.fx.length = 0; startWave(G.world); assert.equal(bossIntro().d, null, 'and once beaten, without'); endSortie('abandoned');
  // with the beacons lit, a Deep Void sector opens by naming the Void boss at its end
  const sectorLine = (rank) => { fresh(); G.state.prestige.level = rank; launch(); G.state.run.wave = 61; startWave(G.world); const f = G.world.fx.find((x) => x.k === 'sector'); endSortie('abandoned'); return f.c; };
  assert.match(sectorLine(8), /^The Pale Watcher waits at wave 70: \+3 Blueprints/); assert.doesNotMatch(sectorLine(7), /waits at wave/, 'Before the beacons, the sector reads as it did'); }

// ---- v2.18: the Greenhouse ----
{ const D = await import('@last-orbit/data/garden.js'), P = await import('@last-orbit/progression/garden.js'); const R = await import('@last-orbit/data/rooms.js');
  fresh(); assert.ok(!D.gardenOpen(G.state), 'Shut for a new pilot'); G.state.stats.sorties = D.GARDEN_SORTIES; assert.ok(!D.gardenOpen(G.state), 'and until sector 1 is cleared');
  G.state.stats.sectorsCleared = 1; assert.ok(D.gardenOpen(G.state) && R.roomFresh('garden', G.state), 'Then it opens, new'); assert.match(R.roomWhere(R.ROOM_BY_ID.garden, G.state), /Tap your station/, 'found from the station before there is a Command Deck');
  G.state.prestige.level = 1; assert.match(R.roomWhere(R.ROOM_BY_ID.garden, G.state), /Command Deck/, 'and by its door after'); G.state.prestige.level = 0;
  assert.equal(R.wingAt(D.WING_RANK)?.id, 'garden', 'The Solar wings add its second wing'); assert.equal(R.roomAt(D.WING_RANK), null);
  // planting, growing (in real time), watering once a day, harvesting into the basket
  assert.ok(P.startGarden(G.state) && !P.startGarden(G.state), 'Seeds in the drawer on the first visit, once'); const g = P.garden(G.state), t0 = Date.now(), hour = 3600000;
  assert.ok(P.plant(G.state, 0, 'sunpetal', t0)); assert.ok(!P.plant(G.state, 0, 'emberroot', t0), 'One plant to a bed'); assert.ok(!P.plant(G.state, D.BEDS_EARLY, 'emberroot', t0), 'The second wing is dark before the Solar wings');
  assert.equal(P.growth(G.state, 0, t0 + 8 * hour), 0.5, 'It grows while you are away');
  assert.equal(P.water(G.state, 'd1', t0 + 8 * hour), 'watered'); assert.equal(P.water(G.state, 'd1', t0 + 8 * hour), 'already', 'Watered once a day'); assert.equal(P.growth(G.state, 0, t0 + 8 * hour), 0.75);
  assert.equal(P.harvest(G.state, 0, t0 + 9 * hour), null, 'Not before it blooms'); assert.equal(P.harvest(G.state, 0, t0 + 12 * hour).id, 'sunpetal'); assert.deepEqual(P.basketNext(G.state), ['sunpetal'], 'into the basket');
  G.state.prestige.level = D.WING_RANK; assert.ok(P.plant(G.state, D.BEDS - 1, 'emberroot', t0), 'The Solar wings open the rest'); assert.ok(Math.abs(g.beds[D.BEDS - 1].need - (16 * hour) / D.WING_SPEED) < 1, 'and everything grows faster');
  // a sortie takes one bloom of each kind in the basket: boosts for that sortie only
  g.basket = { sunpetal: 2, mistvine: 1, starbloom: 1 }; recalc(); const rr = Math.round(G.sheet.n('rerolls')); launch();
  assert.deepEqual([...G.state.run.garden].sort(), ['mistvine', 'starbloom', 'sunpetal']); assert.deepEqual(g.basket, { sunpetal: 1 }, 'One of each taken; the rest wait for the next');
  assert.equal(G.state.run.rerolls, rr + 2, 'Mistvine: two more rerolls'); assert.ok(G.state.run.pendingRelics >= 1, 'Starbloom: a relic to pick'); assert.ok(G.sheet.breakdown('salvageGain').some((x) => x.group === 'Greenhouse'), 'Sunpetal: more salvage');
  const used = endSortie('abandoned'); assert.deepEqual([...used.garden].sort(), ['mistvine', 'starbloom', 'sunpetal'], 'The debrief says what it took'); assert.ok(!G.sheet.breakdown('salvageGain').some((x) => x.group === 'Greenhouse'), 'and it is gone after');
  // bosses leave seeds: a sortie brings home its two deepest
  fresh(); G.state.stats.sorties = 9; G.state.stats.sectorsCleared = 1; launch();
  for (const w of [10, 20, 30]) { G.state.run.wave = w; startWave(G.world); killEnemy(G.world, G.world.wave.boss, null, false, 0); }
  const home = endSortie('abandoned'); assert.deepEqual(home.seeds, ['emberroot', 'mistvine'], 'The two deepest bosses\' seeds'); assert.equal(P.garden(G.state).seeds.mistvine, 1, 'in the drawer');
  fresh(); G.state.stats.sorties = 9; G.state.stats.sectorsCleared = 6; G.state.prestige.level = 8; launch(); G.state.run.wave = 70; startWave(G.world); killEnemy(G.world, G.world.wave.boss, null, false, 0);
  assert.deepEqual(endSortie('abandoned').seeds, ['nightshade', 'lily'], 'A Void boss leaves a Deep Void seed and a Beacon lily');
  // growing every kind pays the Verdant paint
  fresh(); const g2 = P.garden(G.state); for (const s of D.SEEDS) g2.grown[s.id] = 1; delete g2.grown.lily; g2.beds[0] = { id: 'lily', at: 0, need: 1, extra: 0 };
  assert.equal(P.harvest(G.state, 0).paint, D.GARDEN_PAINT, 'Every kind grown: the Verdant paint'); assert.ok(G.state.paints[D.GARDEN_PAINT]); }

// ---- v2.11: save backup codes ----
{ const S = await import('@last-orbit/save/save.js'); fresh(); G.state.pilot.name = 'Adam ✦'; G.state.salvage = 12345; G.state.stats.bestWave = 74; G.state.prestige.level = 3;
  const code = S.exportSave(); assert.ok(code.startsWith(S.BACKUP_TAG), 'A backup code is tagged so it can be recognised');
  const back = S.importSave(code); assert.equal(back.pilot.name, 'Adam ✦'); assert.equal(back.salvage, 12345); assert.equal(back.stats.bestWave, 74); assert.equal(back.prestige.level, 3);
  // what pasting does to a long code: wrapped lines, spaces, a trailing newline
  const messy = '  ' + code.replace(/(.{60})/g, '$1\n ') + '\n'; assert.equal(S.importSave(messy).salvage, 12345, 'Line breaks and spaces from pasting are ignored');
  assert.equal(S.importSave(code.slice(S.BACKUP_TAG.length)).salvage, 12345, 'A code without its tag still restores');
  assert.equal(S.importSave(JSON.stringify(G.state)).salvage, 12345, 'Raw JSON still restores');
  for (const bad of ['', 'hello', code.slice(0, code.length / 2), S.BACKUP_TAG + btoa('{"x":1}')]) assert.throws(() => S.importSave(bad), `A bad code is refused: ${bad.slice(0, 20)}`);
  const newer = JSON.parse(JSON.stringify(G.state)); newer.v = 999; assert.throws(() => S.importSave(S.BACKUP_TAG + btoa(unescape(encodeURIComponent(JSON.stringify(newer))))), (e) => e.code === 'NEWER_SAVE', 'A code from a newer build says so');
  assert.equal(newState().meta.lastBackup, 0, 'A new save has never been backed up'); }

// ---- v2.12: the flight recorder behind the replay TV ----
{ const R = await import('@last-orbit/progression/recorder.js'); fresh();
  R.recStart({ mode: 'counter' }); launch({}); for (let i = 0; i < 200; i++) { step(TICK); R.recTick(G.world, TICK); } assert.equal(R.recStop({ reason: 'abandoned' }), R.lastReplay(), 'Counterattack is not recorded');
  endSortie('abandoned'); fresh(); launch({}); R.recStart({ ship: G.state.run.ship, mode: 'main' });
  for (let i = 0; i < 60 * (R.KEEP + 15) && G.state.run; i++) { step(TICK); R.recTick(G.world, TICK); G.world.player.hull = 1; }
  const rep = R.recStop({ reason: 'abandoned', wave: G.state.run.wave }); endSortie('abandoned');
  assert.ok(rep && rep.frames.length <= R.HZ * R.KEEP && rep.frames.length >= R.HZ * R.KEEP - 1, `It keeps the last ${R.KEEP} seconds (${rep?.frames.length} frames)`);
  assert.ok(rep.frames.some((f) => f.E.length) && rep.frames.some((f) => f.S.length), 'Enemies and shots are recorded');
  const back = await R.unpackReplay(R.packReplay(rep).buffer); assert.equal(back.frames.length, rep.frames.length, 'Packed and unpacked, every frame comes back');
  const a = rep.frames.at(-1), b = back.frames.at(-1); assert.deepEqual([...b.E], [...a.E]); assert.deepEqual([...b.B], [...a.B]); assert.equal(b.wave, a.wave); assert.equal(b.score, a.score); assert.ok(Math.abs(b.px - a.px) < 1e-3);
  assert.deepEqual(back.shapes, rep.shapes); assert.deepEqual(back.end, rep.end);
  if (typeof CompressionStream !== 'undefined') { const packed = R.packReplay(rep), z = new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    assert.ok(z.length < packed.length, 'It stores compressed'); assert.equal((await R.unpackReplay(z.buffer)).frames.length, rep.frames.length, 'and a compressed replay unpacks'); } }

// ---- v2.19: materials from each stretch of the invasion, and ship refits ----
{ const M = await import('@last-orbit/data/materials.js'), R = await import('@last-orbit/progression/refits.js'), RF = await import('@last-orbit/data/refits.js');
  assert.equal(M.materialOf(0), 'alloy'); assert.equal(M.materialOf(3), 'crystal'); assert.equal(M.materialOf(7), 'shard', 'The Deep Void drops Void shards');
  // a sector boss always drops its stretch's material; picked up, it comes home at the end
  fresh(); launch(); G.state.run.wave = 10; startWave(G.world); killEnemy(G.world, G.world.wave.boss, null, false, 0); collectAll(G.world);
  assert.equal(G.state.run.mats.alloy, M.MAT_DROP.boss, 'A sector 1 boss drops Alloy');
  G.state.run.wave = 30; startWave(G.world); killEnemy(G.world, G.world.wave.boss, null, false, 0); collectAll(G.world); assert.equal(G.state.run.mats.crystal, M.MAT_DROP.boss, 'a sector 3 boss Crystal');
  const home = endSortie('abandoned'); assert.deepEqual(home.mats, { alloy: M.MAT_DROP.boss, crystal: M.MAT_DROP.boss }, 'The debrief says what came home'); assert.equal(G.state.materials.alloy, M.MAT_DROP.boss, 'and it is banked');
  fresh(); launch(); G.state.run.mats = { shard: 3 }; recoverInterruptedRun(G.state); assert.equal(G.state.materials.shard, 3, 'A sortie cut off keeps its materials');
  // refits: paid in materials, for a ship you own, counting only while you fly her
  fresh(); assert.equal(R.buyRefit(G.state, 'vanguard'), null, 'No materials, no refit');
  G.state.materials.alloy = 100; recalc(); const d0 = G.sheet.n('damage'), got = R.buyRefit(G.state, 'vanguard');
  assert.equal(got.n, 1); assert.equal(G.state.materials.alloy, 75, 'It costs its materials'); assert.equal(got.mins, 20, 'The first refit takes 20 minutes');
  assert.ok(R.inDock(G.state, 'vanguard') && Math.abs(G.sheet.n('damage') / d0 - 1) < 1e-9, 'In the dock: not fitted yet');
  assert.equal(R.settleRefit(G.state, Date.now() + 10 * 60000), null, 'Not done after 10 minutes'); assert.ok(R.settleRefit(G.state, Date.now() + 21 * 60000), 'Done after 20');
  assert.ok(!G.state.refitting && Math.abs(G.sheet.n('damage') / d0 - 1.1) < 1e-9, 'Gun tuning: +10% damage');
  assert.equal(R.buyRefit(G.state, 'striker'), null, 'Only a ship you own');
  G.state.unlocked.ships.striker = 1; selectShip('striker'); assert.ok(!G.sheet.breakdown('damage').some((x) => x.group === 'Refits'), 'The Vanguard\'s refit stays with her');
  selectShip('vanguard'); G.state.refits.vanguard = 3; G.state.materials.crystal = 60; recalc(); assert.equal(R.buyRefit(G.state, 'vanguard').n, 4); R.settleRefit(G.state, Date.now() + 4 * 3600000); assert.equal(G.sheet.n('passivePower'), RF.PASSIVE_REFIT, 'The trait refit');
  launch(); const p = G.world.player; p.invuln = 0; p.dashInv = 0; p.hull = 0.301; hurtPlayer(G.world, 1); assert.equal(G.state.run.hullBy.wind, 0.4 * RF.PASSIVE_REFIT, 'Second Wind repairs 50% after its refit');
  G.state.refits.vanguard = RF.REFIT_MAX; assert.equal(R.refitNext(G.state, 'vanguard'), null, 'Five refits a ship'); endSortie('abandoned'); }

// ---- v2.19: Fleet expeditions (Fleet Ops, Overhaul rank 9) ----
{ const F = await import('@last-orbit/progression/fleet.js'), FD = await import('@last-orbit/data/fleet.js'), HR = 3600000, t0 = Date.UTC(2026, 8, 1);
  fresh(); const st = G.state; st.unlocked.ships.striker = 1; st.unlocked.ships.bulwark = 1; st.stats.sectorsCleared = 2;
  assert.deepEqual(st.fleet.out, [null, null, null], 'Three empty berths');
  assert.equal(F.sendShip(st, 0, 'striker', 's1', t0), null, 'Fleet Ops opens with the halo, at Overhaul rank 9');
  st.prestige.level = FD.FLEET_RANK;
  assert.equal(F.sendShip(st, 0, st.ship, 's1', t0), null, 'The ship you fly stays with you');
  assert.equal(F.sendShip(st, 0, 'tempest', 's1', t0), null, 'Only ships you own go out');
  assert.equal(F.sendShip(st, 0, 'striker', 's3', t0), null, 'Only to sectors you have cleared');
  assert.equal(F.sendShip(st, 0, 'striker', 'void', t0), null, 'The Deep Void once you have been past wave 60');
  const o = F.sendShip(st, 0, 'striker', 's2', t0); assert.ok(o, 'Sent');
  assert.equal(F.sendShip(st, 1, 'striker', 's1', t0), null, 'A ship is only out once'); assert.equal(F.sendShip(st, 0, 'bulwark', 's1', t0), null, 'One ship to a berth');
  assert.equal(selectShip('striker'), false, 'A ship out cannot be flown'); assert.equal(F.shipAway(st, 'striker'), 0);
  assert.equal(F.tripDone(st, 0, t0 + 0.75 * HR), 0.5, 'Halfway through a trip of an hour and a half'); assert.equal(F.collectShip(st, 0, t0 + HR), null, 'Not back yet');
  const finds = F.tripFinds(st, o), d = FD.DEST_BY_ID.s2; assert.deepEqual(F.tripFinds(st, o), finds, 'What it finds is settled when it leaves');
  assert.ok(finds.mats.alloy >= Math.round(d.matN * 0.8) && finds.mats.alloy <= Math.round(d.matN * 1.2), 'It brings its stretch\'s material');
  const s0 = st.salvage, a0 = st.materials.alloy || 0, m0 = masteryOf('striker'), r = F.collectShip(st, 0, t0 + 1.5 * HR);
  assert.equal(st.salvage - s0, finds.salvage, 'Salvage banked'); assert.ok(finds.salvage > 0); assert.equal(st.materials.alloy - a0, finds.mats.alloy, 'Material banked');
  assert.equal(r.mastery.gained, d.mastery, 'Mastery for the ship that went'); assert.ok(masteryOf('striker').xp > m0.xp || masteryOf('striker').level > m0.level);
  assert.equal(st.fleet.out[0], null, 'The berth is free again'); assert.equal(st.fleet.log[0].ship, 'striker', 'It is logged'); assert.equal(st.fleet.home, 1);
  assert.equal(selectShip('striker'), true, 'Home again, she can fly'); selectShip('vanguard');
  F.sendShip(st, 1, 'bulwark', 's1', t0); const s1 = st.salvage; assert.ok(F.recallShip(st, 1)); assert.equal(st.salvage, s1, 'Called home early, she brings nothing'); assert.equal(st.fleet.out[1], null);
  assert.deepEqual(F.fleetCounts(st, t0), { out: 0, ready: 0, free: 3, home: 1, fragments: 0, damaged: 0 });
  for (let k = 0; k < FD.PATHFINDER_AT; k++) { const at = t0 + k * 10 * HR; st.fleet.damage = {}; /* (repaired between trips) */ F.sendShip(st, 2, 'bulwark', 's1', at); assert.ok(F.collectShip(st, 2, at + 2 * HR)); }
  assert.ok(st.paints[FD.FLEET_PAINT], 'Twelve home: the Pathfinder paint'); assert.equal(st.fleet.log.length, 12, 'The log keeps the last twelve');
  st.stats.bestWave = 70; st.fleet.damage = {}; const v = F.sendShip(st, 0, 'bulwark', 'void', t0); assert.ok(v, 'Past wave 60, the Deep Void'); const vf = F.tripFinds(st, v);
  assert.ok(F.collectShip(st, 0, t0 + FD.DEST_BY_ID.void.hours * HR).got.mats.shard > 0, 'The Deep Void brings Void shards'); assert.equal(st.fleet.fragments, vf.fragments, 'Only the Deep Void gives up signal fragments');
  // damage: settled when she leaves, likelier further out, rarer with a reinforced frame; repaired for salvage (and Alloy)
  const rolls = (frame) => { let n = 0; for (let k = 0; k < 3000; k++) if (F.tripFinds(st, { ship: 'bulwark', dest: 'void', at: t0 + k * 7919, need: HR, frame }).damage) n++; return n / 3000; };
  const raw = rolls(0), tough = rolls(1); assert.ok(Math.abs(raw - FD.DEST_BY_ID.void.risk) < 0.04, `Deep Void risk ${raw}`); assert.ok(Math.abs(tough / raw - FD.FRAME_SAFER) < 0.12, 'A reinforced frame cuts the risk');
  let hit = { ship: 'bulwark', dest: 's6', at: t0, need: 6 * HR }; while (!F.tripFinds(st, hit).damage) hit.at += 1;
  st.fleet.out[1] = hit; const hr = F.collectShip(st, 1, hit.at + hit.need); assert.equal(F.damageOf(st, 'bulwark'), hr.got.damage, 'She comes home damaged'); assert.equal(st.fleet.log[0].got.damage, hr.got.damage, 'and the log says so');
  assert.equal(F.cannotSend(st, 'bulwark'), 'damaged', 'A damaged ship cannot go out'); assert.equal(selectShip('bulwark'), false, 'nor fly');
  st.fleet.damage.bulwark = 2; st.materials.alloy = 0; st.salvage = 1e6; const cost = F.repairCost(st, 'bulwark'); assert.equal(cost.alloy, FD.DAMAGE[2].alloy, 'Heavy damage needs Alloy for new plating');
  assert.equal(F.repairShip(st, 'bulwark'), null, 'No Alloy, no repair'); st.materials.alloy = 10; assert.ok(F.repairShip(st, 'bulwark')); assert.equal(st.salvage, 1e6 - cost.salvage); assert.equal(st.materials.alloy, 10 - cost.alloy);
  assert.equal(F.damageOf(st, 'bulwark'), 0, 'Repaired'); assert.equal(F.cannotSend(st, 'bulwark'), null); assert.equal(F.repairCost(st, 'bulwark'), null, 'Nothing to repair');
  const old = newState(); delete old.fleet; assert.deepEqual(F.fleet(old).out, [null, null, null], 'A save from before the fleet gets its berths');
  const short = newState(); short.fleet.out = [null]; assert.equal(F.fleet(short).out.length, 3); }

// ---- v2.20: the warp draft (data/warp.js) ----
{ const W = await import('@last-orbit/data/warp.js'), R = await import('@last-orbit/progression/run.js'), S = await import('@last-orbit/combat/sim.js'), { synergyOf } = await import('@last-orbit/data/synergies.js');
  fresh(); G.state.stats.sectorsCleared = 6; recalc(); launch({ warp: 6 }); let run = G.state.run;
  const cards = run.pendingLevels, relics = run.pendingRelics; assert.ok(cards >= 25 && relics >= 5, 'Warping to sector 6: twenty-five catch-up cards and five relics');
  assert.ok(R.draftDue(run), 'A big catch-up is drafted'); const offer = R.warpPerkOffer(run); assert.equal(new Set(offer).size, 3, 'Three different warp perks'); assert.deepEqual(R.warpPerkOffer(run), offer, 'and the same three if asked again');
  const hull0 = G.sheet.n('hull'), got = R.warpDraft('hold', 'wp_plate', run);
  assert.equal(got.cards.length, cards, 'Every catch-up card fitted'); assert.equal(got.relics.length, relics, 'and every relic'); assert.equal(run.pendingLevels, 0); assert.equal(run.pendingRelics, 0);
  assert.ok(!R.draftDue(run), 'Drafted once'); assert.equal(run.warpFocus, 'hold'); assert.equal(run.warpPerk, 'wp_plate');
  const withPerk = G.sheet.n('hull'); run.warpPerk = null; recalc(); assert.ok(withPerk > G.sheet.n('hull') * 1.1, 'The warp perk counts (Warp plating: more hull)'); run.warpPerk = 'wp_plate'; recalc(); void hull0;
  const theme = (id) => W.FOCUS_BY_ID.hold.themes.includes(synergyOf(id)?.id); assert.ok(Object.keys(run.cards).filter(theme).length >= 3, 'Survival drafts Survival cards');
  endSortie('abandoned');
  fresh(); G.state.stats.sectorsCleared = 6; recalc(); launch({ warp: 4 }); run = G.state.run; run.manual = true; assert.ok(!R.draftDue(run), 'Picking them by hand turns the draft off');
  endSortie('abandoned');
  fresh(); launch(); assert.ok(!R.draftDue(G.state.run), 'No draft without a warp'); endSortie('abandoned');
  fresh(); G.state.stats.sectorsCleared = 6; recalc(); launch({ warp: 3 }); R.warpDraft('fire', 'wp_slip'); S.applyRunMods(G.world); assert.ok(Math.abs(G.world.mods.hp - 1.15) < 1e-9, 'Slipstream: the invaders are tougher'); endSortie('abandoned'); }

// ---- v2.20: breaches, three a sector ----
{ const Wd = await import('@last-orbit/combat/world.js');
  fresh(); launch(); const run = G.state.run, w = G.world; run.time = 10;
  Wd.breach(w); run.time = 10.5; Wd.breach(w); assert.equal(run.strikes, 1, 'Landings together are one breach');
  run.time = 12; Wd.breach(w); assert.equal(run.strikes, 2); assert.ok(w.player.alive, 'Two breaches: still flying');
  G.state.workshop.w_revive = 0; recalc(); run.time = 14; Wd.breach(w); assert.equal(run.strikes, 3); assert.ok(run.breached && !w.player.alive, 'The third breaks the line');
  const s = endSortie('destroyed'); assert.ok(s.breached, 'The debrief knows'); }

// ---- v2.21: Bolt (data/bolt.js, progression/bolt.js) ----
{ const B = await import('@last-orbit/progression/bolt.js'), D = await import('@last-orbit/data/bolt.js');
  fresh(); const st = G.state; st.stats.sorties = 30; st.stats.sectorsCleared = 1;
  assert.deepEqual(B.checkWardrobe(st), [], 'No Bolt before your quarters open');
  st.prestige.level = 5; let notes = 0; const off = bus.on('notice', (n) => { if (n.kicker === 'Bolt found something') notes++; });
  const got = B.checkWardrobe(st); off(); assert.ok(got.includes('paint:rust') && got.includes('eye:amber') && got.includes('hat:prop'), 'Earned pieces go in its locker');
  assert.equal(notes, 1, 'Several at once: one notice'); assert.equal(st.bolt.fresh, got.length, 'and the locker says there is something new');
  assert.ok(B.wear(st, 'paint', 'rust')); assert.equal(B.wear(st, 'paint', 'gold'), false, 'Only what it owns'); assert.equal(st.bolt.wear.paint, 'rust');
  for (let i = 0; i < 25; i++) B.pat(st); assert.ok(B.owns(st, 'eye', 'pink'), '25 pats: pink eyes');
  const seen = new Set(); for (let i = 0; i < D.BOLT_SAYS.tap.length; i++) seen.add(B.boltLine('tap')[1]); assert.equal(seen.size, D.BOLT_SAYS.tap.length, 'No line again until all of its kind are said');
  assert.ok(B.roomLine(st, 'deck')); assert.equal(B.roomLine(st, 'deck'), null, 'A room\'s line, once');
  bus.emit('sortieEnded', { reason: 'destroyed', breached: true, wave: 20, best: false }); const w = B.welcomeLine(st, new Date(2026, 8, 1, 14));
  assert.ok(D.BOLT_SAYS.breach.some((l) => l[1] === w[1]), 'It remembers the line breaking'); assert.equal(B.welcomeLine(st, new Date(2026, 8, 1, 14, 5)), null, 'and says so once');
  const back = parseSave(JSON.stringify(st)); assert.equal(back.bolt.wear.paint, 'rust'); assert.equal(back.bolt.pets, 25, 'Bolt saves'); }

// ---- v2.21: what Bolt notices (progression/boltTalk.js) ----
{ const N = await import('@last-orbit/progression/boltTalk.js'), F = await import('@last-orbit/progression/fleet.js'), HR = 3600000;
  fresh(); const st = G.state; st.prestige.level = 9; st.stats.sectorsCleared = 2; st.unlocked.ships.striker = 1; st.unlocked.ships.bulwark = 1; recalc();
  const t0 = Date.now() - 2 * HR; F.sendShip(st, 0, 'striker', 's1', t0);
  let news = N.boltNews(st, 'deck'); const home = news.find((n) => n.key.startsWith('home:'));
  assert.ok(home && home.pri === 3 && home.line[1].includes('Striker'), 'A ship home is news, and it names her'); assert.equal(news[0], home, 'the most pressing first');
  assert.ok(N.boltNews(st, 'ops').find((n) => n.key.startsWith('home:')).line[1].match(/berth|counted/i), 'said differently in Fleet Ops itself');
  F.collectShip(st, 0); st.fleet.damage.bulwark = 2; news = N.boltNews(st, 'deck');
  assert.ok(!news.some((n) => n.key.startsWith('home:')), 'Unloaded: no longer news'); assert.ok(news.some((n) => n.key === 'hurt:bulwark' && n.pri === 2), 'A ship waiting on repairs');
  assert.ok(N.boltNews(st, 'quarters').some((n) => n.key.startsWith('rest:') && n.pri === 2), 'In the quarters, the bunk'); assert.ok(news.every((n) => n.line[0] && n.line[1] && !n.line[1].includes('{')), 'Every line filled in'); }

// ---- v2.21: the replay TV's channels and the News ----
{ const N = await import('@last-orbit/data/news.js');
  fresh(); const st = G.state; st.stationName = 'Keepsake'; st.stats.bestWave = 41; st.stats.kills = 900; st.stats.sorties = 12;
  st.history = [{ wave: 41, ship: 'vanguard', salvage: 5200 }]; st.bolt = { last: { best: true } };
  const news = N.newsStories(st); assert.ok(news[0].tag === 'Breaking' && news[0].head.includes('41'), 'A new record leads the News');
  st.bolt.last = { breached: true }; assert.ok(N.newsStories(st)[0].head.startsWith('Line broken'), 'and so does the line breaking');
  assert.ok(N.newsTicker(st).includes('KEEPSAKE') && N.newsTicker(st).includes('BEST WAVE 41'), 'The ticker has your numbers');
  assert.ok(N.LORE.length >= 10 && N.LORE.every((l) => l.tag && l.head && l.body), 'and the station\'s stories'); }

// ---- v2.21: the shield bubble takes the shots that touch it ----
{ const E = await import('@last-orbit/combat/enemies.js'), Wd = await import('@last-orbit/combat/world.js');
  fresh(); G.state.workshop.w_shield = 3; recalc(); launch(); const w = G.world, p = w.player; Wd.setWaveBase(w, 5, 0); p.shield = 1; p.invuln = 0; p.dashInv = 0; w.ebullets.length = 0;
  assert.ok(w.base.hasShield && p.shield > 0.5, 'A shield to test');
  const shot = (dx) => { Wd.spawnBullet(w, p.x + dx, p.y, 0, 0, 1, 'bolt'); const s0 = p.shield, h0 = p.hull; E.updateBullets(w, 0.001); return { shield: s0 - p.shield, hull: h0 - p.hull, left: w.ebullets.length }; };
  const on = shot(BAL.shieldR - 0.3); assert.ok(on.shield > 0 && on.hull === 0 && on.left === 0, 'A shot touching the bubble hits the shield');
  const off = shot(BAL.shieldR + 2); assert.ok(off.shield === 0 && off.left === 1, 'One outside it misses'); w.ebullets.length = 0;
  p.shield = 0; const bare = shot(BAL.shieldR - 0.3); assert.ok(bare.hull === 0 && bare.left === 1, 'With the shield down, only the hull\'s own circle is hit'); endSortie('abandoned'); }

// ---- v2.21: refits take time in the dock ----
{ const R = await import('@last-orbit/progression/refits.js'), F = await import('@last-orbit/progression/fleet.js'), MIN = 60000;
  fresh(); const st = G.state; st.unlocked.ships.striker = 1; st.materials.alloy = 200; st.prestige.level = 9; st.stats.sectorsCleared = 2; const t0 = Date.now();
  assert.ok(R.buyRefit(st, 'striker', t0)); assert.equal(R.buyRefit(st, 'vanguard', t0), null, 'One refit at a time: the dock is busy');
  assert.equal(selectShip('striker'), false, 'A ship in the dock can\'t be picked to fly'); assert.equal(F.cannotSend(st, 'striker'), 'refit', 'nor sent out');
  assert.ok(Math.abs(R.refitProgress(st, t0 + 10 * MIN).mins - 10) < 0.01, 'Ten minutes in, ten to go');
  assert.ok(R.takeOut(st, t0 + 10 * MIN)); assert.ok(Math.abs(R.refitProgress(st, t0 + 60 * MIN).mins - 10) < 0.01, 'Taken out: the refit waits'); assert.equal(R.settleRefit(st, t0 + 60 * MIN), null);
  assert.equal(selectShip('striker'), true, 'Out of the dock she can fly'); selectShip('vanguard');
  assert.ok(R.redock(st, t0 + 60 * MIN)); assert.ok(R.settleRefit(st, t0 + 71 * MIN), 'Back in the dock, it finishes'); assert.equal(st.refits.striker, 1);
  // flying the ship in the dock takes her out; she goes back in after the sortie
  st.materials.alloy = 200; selectShip('vanguard'); R.buyRefit(st, 'vanguard', t0); launch(); assert.ok(!R.inDock(st, 'vanguard') && st.refitting, 'Launching takes her out');
  endSortie('abandoned'); assert.ok(R.inDock(st, 'vanguard'), 'and the sortie over, she is back in'); }

console.log('Sortie, cards, relics, contracts, workshop, ships, pickups, revive and save checks pass.');
