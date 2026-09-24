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
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { spawnPickup, collectAll } from '@last-orbit/combat/pickups.js';
import { hurtPlayer } from '@last-orbit/combat/world.js';
import { startSortie, endSortie, recoverInterruptedRun, grantXp, rollOffer, pickCard, cardPool, nextOffer, rollRelics, pickRelic, describeCard, choicePending } from '@last-orbit/progression/run.js';
import { addPilotXp, selectPaint, threatMax, setThreat, dailyToday, addMastery, masteryOf, buyWorkshop, workshopNext, shipStatus, shipContract, buyShip, selectShip, checkContracts } from '@last-orbit/progression/meta.js';
import { parseSave } from '@last-orbit/save/save.js';
import { rankMult } from '@last-orbit/progression/stats.js';
import { rankNeed, rankReward, MAX_RANK, masteryNeed } from '@last-orbit/data/career.js';
import { threatMods, THREAT_UNLOCK_SECTOR } from '@last-orbit/data/threat.js';
import { dayKey, prevDayKey, dailyFor, dailyBonus, MUTATOR_BY_ID } from '@last-orbit/data/daily.js';
import { setWaveBase } from '@last-orbit/combat/world.js';

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
  const p = G.world.player; p.invuln = 0; p.shield = 0; p.lastStand = false; hurtPlayer(G.world, 1e9);
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

// ---- saves round-trip and refuse newer schemas ----
fresh(); G.state.salvage = 1234; G.state.workshop.w_hull = 3;
const back = parseSave(JSON.stringify(G.state)); assert.equal(back.salvage, 1234); assert.equal(back.workshop.w_hull, 3); assert.equal(back.v, SCHEMA);
assert.throws(() => parseSave(JSON.stringify({ ...G.state, v: SCHEMA + 1 })), /newer version/);
assert.throws(() => parseSave('{"run":{},"cur":{}}'), /Not a Last Orbit v2 save/);

console.log('Sortie, cards, relics, contracts, workshop, ships, pickups, revive and save checks pass.');
