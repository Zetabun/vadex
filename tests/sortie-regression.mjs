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
import { hurtPlayer } from '@last-orbit/combat/world.js';
import { startSortie, endSortie, recoverInterruptedRun, grantXp, rollOffer, pickCard, cardPool, nextOffer, rollRelics, pickRelic, describeCard, choicePending } from '@last-orbit/progression/run.js';
import { addPilotXp, selectPaint, threatMax, setThreat, dailyToday, addMastery, masteryOf, buyWorkshop, workshopNext, shipStatus, shipContract, buyShip, selectShip, checkContracts } from '@last-orbit/progression/meta.js';
import { parseSave } from '@last-orbit/save/save.js';
import { rankMult } from '@last-orbit/progression/stats.js';
import { rankNeed, rankReward, MAX_RANK, masteryNeed } from '@last-orbit/data/career.js';
import { threatMods, THREAT_UNLOCK_SECTOR } from '@last-orbit/data/threat.js';
import { dayKey, prevDayKey, dailyFor, dailyBonus, MUTATOR_BY_ID } from '@last-orbit/data/daily.js';

import { setWaveBase, killEnemy } from '@last-orbit/combat/world.js';
import { killScore, waveScore, scoreMult, TOP_N } from '@last-orbit/data/score.js';
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
for (const s of SHIPS.slice(1)) { assert.ok(shipContract(s.id), s.id + ' has an unlocking contract'); assert.equal(shipStatus(s.id), 'locked'); }
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

console.log('Sortie, cards, relics, contracts, workshop, ships, pickups, revive and save checks pass.');
