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
import { startSortie, endSortie, grantXp, rollOffer, pickCard, cardPool, nextOffer, rollRelics, pickRelic, describeCard, choicePending } from '@last-orbit/progression/run.js';
import { buyWorkshop, workshopNext, shipStatus, shipContract, buyShip, selectShip, checkContracts } from '@last-orbit/progression/meta.js';
import { parseSave } from '@last-orbit/save/save.js';
import { rankMult } from '@last-orbit/progression/stats.js';

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
assert.ok(Math.abs(G.sheet.n('damage') - dmgBase * 1.1) < 1e-9);
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

// ---- saves round-trip and refuse newer schemas ----
fresh(); G.state.salvage = 1234; G.state.workshop.w_hull = 3;
const back = parseSave(JSON.stringify(G.state)); assert.equal(back.salvage, 1234); assert.equal(back.workshop.w_hull, 3); assert.equal(back.v, SCHEMA);
assert.throws(() => parseSave(JSON.stringify({ ...G.state, v: SCHEMA + 1 })), /newer version/);
assert.throws(() => parseSave('{"run":{},"cur":{}}'), /Not a Last Orbit v2 save/);

console.log('Sortie, cards, relics, contracts, workshop, ships, pickups, revive and save checks pass.');
