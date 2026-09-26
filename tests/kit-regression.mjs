// The field kit (progression/boosts.js) and the Daily's shared luck (progression/run.js): the supply meter packs
// canisters and grows; a full slot sells for salvage; boosts run, stack to two doses, count down with the battle and
// wear off; the hull patch repairs; none of it in the Daily; expeditions and Bolt turn canisters up; and two pilots
// flying the same Daily the same way are offered the same cards and relics.
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { TICK } from '@last-orbit/data/balance.js';
import { startSortie, endSortie, rollOffer, reroll, pickCard, rollRelics } from '@last-orbit/progression/run.js';
import { BOOSTS, KIT_MAX, KIT_SELL, SUPPLY_FIRST, SUPPLY_GROWTH, PATCH_HEAL } from '@last-orbit/data/boosts.js';
import { kit, kitCount, stow, useBoost, cannotUse, running, supplyPct } from '@last-orbit/progression/boosts.js';
import { tripFinds } from '@last-orbit/progression/fleet.js';
import { fetched } from '@last-orbit/progression/bolt.js';
import { DESTINATIONS } from '@last-orbit/data/fleet.js';

let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.error('FAIL', msg); } };
const fresh = () => { G.state = newState(); G.state.meta.legacyChecked = true; recalc(); return G.state; };

// ------------------------------------------------------------------ the kit and the meter
let st = fresh();
ok(BOOSTS.every((b) => kit(st)[b.id] === 0) && kitCount(st) === 0, 'a new pilot has an empty kit');
startSortie({}); initWorld();
const sp = st.run.supply;
ok(sp && sp.need === SUPPLY_FIRST && sp.fill === 0 && supplyPct(st.run) === 0, 'a sortie starts with an empty meter');
sp.fill = SUPPLY_FIRST + 5; bus.emit('supplyFull');
ok(kitCount(st) === 1 && sp.packed === 1 && sp.need === Math.round(SUPPLY_FIRST * SUPPLY_GROWTH) && Math.abs(sp.fill - 5) < 1e-9, 'a full meter packs a canister and the next one takes longer');
ok(st.run.canisters?.length === 1 && st.stats.canisters === 1, 'the sortie remembers what it packed, and the pilot counts canisters');
for (const b of BOOSTS) kit(st)[b.id] = 0; kit(st).surge = KIT_MAX; const before = st.run.salvage;
const sold = stow(st, 'surge');
ok(sold.sold === KIT_SELL && kit(st).surge === KIT_MAX && st.run.salvage === before + KIT_SELL, 'a canister for a full slot is sold for salvage');

// ------------------------------------------------------------------ using boosts
const gain0 = G.sheet.n('salvageGain');
ok(useBoost(st, 'surge') && st.run.boosts.surge === 60 && kit(st).surge === KIT_MAX - 1, 'a boost runs from the kit');
ok(Math.abs(G.sheet.n('salvageGain') / gain0 - 1.5) < 1e-6, 'Salvage Surge adds half as much salvage again: ' + (G.sheet.n('salvageGain') / gain0));
ok(useBoost(st, 'surge') && st.run.boosts.surge === 120, 'a second dose adds its time');
ok(cannotUse(st, 'surge') === 'running' && !useBoost(st, 'surge'), 'a third waits until a dose has run down');
ok(running(st.run)[0]?.id === 'surge', 'running boosts are listed');
const w = G.world; w.player.hull = 1; kit(st).patch = 1;
ok(cannotUse(st, 'patch') === 'full', 'a whole hull needs no patch');
w.player.hull = 0.4; ok(useBoost(st, 'patch') && Math.abs(w.player.hull - (0.4 + PATCH_HEAL)) < 1e-9 && kit(st).patch === 0, 'the hull patch repairs at once');
ok(cannotUse(st, 'patch') === 'none', 'none left');
w.player.hull = 1; w.player.shield = 1; let ended = []; bus.on('boostEnded', (id) => ended.push(id));
for (let t = 0; t < 125 && st.run; t += TICK) { step(TICK); w.player.hull = 1; w.player.alive = true; G.world.fx.length = 0; }
ok(!st.run.boosts.surge && ended.includes('surge') && Math.abs(G.sheet.n('salvageGain') - gain0) < 1e-6, 'boosts wear off with the battle, and the sheet goes back');
const summary = endSortie('abandoned');
ok(summary.canisters.length >= 1 && summary.canisters.every((id) => BOOSTS.some((b) => b.id === id)), 'the debrief lists the canisters kept (not the one sold)');

// ------------------------------------------------------------------ not in the Daily
st = fresh(); kit(st).overcharge = 2; startSortie({ daily: true }); initWorld();
ok(st.run.supply === null && cannotUse(st, 'overcharge') === 'daily' && !useBoost(st, 'overcharge'), 'the Daily has no meter and no boosts (the global board stays even)');
endSortie('abandoned');

// ------------------------------------------------------------------ the Daily's shared luck
function dailyDraws() {
  const s = fresh(); s.unlocked.weapons = { cannon: 1, laser: 1, missile: 1 }; recalc(); startSortie({ daily: true }); initWorld();
  const run = s.run, out = []; run.pendingLevels = 3; run.rerolls = 2;
  out.push(rollOffer(run).map((c) => c.kind + ':' + (c.id || ''))); reroll(); out.push(run.offer.map((c) => c.kind + ':' + (c.id || '')));
  pickCard(0); out.push(rollOffer(run).map((c) => c.kind + ':' + (c.id || ''))); out.push(rollRelics(run).slice());
  endSortie('abandoned'); return JSON.stringify(out);
}
const a = dailyDraws(), b = dailyDraws();
ok(a === b, 'two pilots flying the same Daily the same way are offered the same cards, rerolls and relics');
function mainDraws() { const s = fresh(); s.unlocked.weapons = { cannon: 1, laser: 1, missile: 1 }; recalc(); startSortie({}); initWorld(); const r = rollOffer(s.run).map((c) => c.kind + (c.id || '')).join() + rollRelics(s.run).join(); endSortie('abandoned'); return r; }
ok(new Set(Array.from({ length: 6 }, mainDraws)).size > 1, 'outside the Daily, the luck is anyone\'s');

// ------------------------------------------------------------------ canisters from expeditions and Bolt
st = fresh(); let found = 0;
for (let i = 0; i < 200; i++) if (tripFinds(st, { dest: DESTINATIONS[0].id, ship: 'vanguard', at: 1e12 + i * 7777 }).canister) found++;
ok(found > 35 && found < 90, 'about a third of expeditions bring a canister home: ' + found + '/200');
st = fresh(); for (let i = 0; i < 5; i++) fetched(st);
ok(kitCount(st) === 1, 'Bolt turns one up every five games of fetch');

if (failures) { console.error(`kit-regression: ${failures} failed`); process.exit(1); }
console.log('kit-regression: all passed');
