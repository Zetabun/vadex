// Every release since v2.18 keeps a save made by that build in tests/saves (tools/save_fixture.mjs makes it). Each must
// still load in this build: nothing in it lost, no value changed kind (a number where an object is now expected would
// stop the save loading at all, and the game would start the pilot again from nothing), the game boots on it, the
// sortie left in flight is recovered, a new sortie can be flown, and it saves and loads again. If this fails, fix the
// code or add a migration in save/save.js; never edit a kept save.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { G, recalc } from '@last-orbit/core/game.js';
import { newState, SCHEMA } from '@last-orbit/core/state.js';
import { setNotation } from '@last-orbit/core/format.js';
import { parseSave } from '@last-orbit/save/save.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, recoverInterruptedRun } from '@last-orbit/progression/run.js';
import { checkContracts, unlockCounter, refreshMenus, notePeaks } from '@last-orbit/progression/meta.js';
import { ROOMS_ABOARD, roomOpen, roomFresh } from '@last-orbit/data/rooms.js';
import { gardenCounts } from '@last-orbit/progression/garden.js';
import { sendShip, collectShip, damageOf, repairShip, fleetCounts } from '@last-orbit/progression/fleet.js';
import { buyRefit, settleRefit } from '@last-orbit/progression/refits.js';
import { TICK } from '@last-orbit/data/balance.js';

const dir = new URL('./saves/', import.meta.url), files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
assert.ok(files.length, 'No kept saves in tests/saves');
const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
/** Where the kept save holds a different kind of value from the one the game now starts with. */
function reshaped(a, b, path, out = []) {
  if (a == null || b == null) return out;
  if (kind(a) !== kind(b)) out.push(`${path}: ${kind(a)} in the save, ${kind(b)} now`); else if (kind(b) === 'object') for (const k of Object.keys(b)) if (k in a) reshaped(a[k], b[k], `${path}.${k}`, out);
  return out;
}
/** Where a value in the kept save didn't come through loading unchanged. */
function lost(a, b, path, out = []) {
  if (kind(a) === 'object') { for (const k of Object.keys(a)) lost(a[k], b?.[k], `${path}.${k}`, out); } else if (JSON.stringify(a) !== JSON.stringify(b)) out.push(path);
  return out;
}

for (const f of files) {
  const text = readFileSync(new URL(f, dir), 'utf8'), kept = JSON.parse(text);
  assert.deepEqual(reshaped(kept, newState(), 'state'), [], `${f}: values that changed kind`);
  const s = parseSave(text);
  if (kept.v === SCHEMA) assert.deepEqual(lost(kept, s, 'state'), [], `${f}: values lost or changed on loading`);
  // boot it as main.js adopts a save: the sortie in flight is closed and its salvage kept
  const inFlight = Math.floor(kept.run?.salvage || 0), before = s.salvage;
  assert.equal(recoverInterruptedRun(s), inFlight, `${f}: the sortie in flight's salvage`); assert.equal(s.salvage, before + inFlight); assert.equal(s.run, null);
  G.state = s; G.mode = 'hangar'; setNotation(s.settings.notation); recalc(); checkContracts({ silent: true }); unlockCounter({ silent: true }); refreshMenus(); notePeaks(s); initWorld();
  for (const r of ROOMS_ABOARD) { roomOpen(r, s); roomFresh(r.id, s); } gardenCounts(s);
  assert.ok(s.stats.bestWave >= kept.stats.bestWave && s.stats.sorties === kept.stats.sorties, `${f}: records kept`);
  // fly a sortie on it, then save and load again
  startSortie({ seed: 11 }); initWorld(); for (let i = 0; i < 900; i++) step(TICK); endSortie('abandoned');
  const back = parseSave(JSON.stringify(G.state)); assert.equal(back.salvage, G.state.salvage); assert.equal(back.v, SCHEMA);
  // the pilot carries on from this save to the Halo ring: what later releases added works on it (Fleet Ops opens, NEW;
  // a ship goes out and comes home; materials bank and buy a refit), and it all saves and loads again
  const late = parseSave(text); late.prestige.level = Math.max(9, late.prestige.level || 0); late.stats.sectorsCleared = Math.max(2, late.stats.sectorsCleared || 0);
  const scout = ['striker', 'bulwark', 'tempest'].find((id) => id !== late.ship); late.unlocked.ships[scout] ||= 1; G.state = late; recalc();
  const ops = ROOMS_ABOARD.find((r) => r.id === 'ops'); assert.ok(roomOpen(ops, late) && roomFresh('ops', late), `${f}: Fleet Ops opens, and is NEW`);
  const t = Date.now(), trip = sendShip(late, 0, scout, 's1', t); assert.ok(trip, `${f}: a ship goes out`); assert.ok(collectShip(late, 0, t + trip.need), `${f}: and comes home`);
  if (damageOf(late, scout)) { late.salvage += 1e6; late.materials.alloy = (late.materials.alloy || 0) + 50; assert.ok(repairShip(late, scout), `${f}: and is repaired`); }
  late.materials.alloy = (late.materials.alloy || 0) + 25; assert.ok(buyRefit(late, late.ship), `${f}: a refit`); assert.ok(settleRefit(late, Date.now() + 4e6), `${f}: fitted`); fleetCounts(late);
  const later = parseSave(JSON.stringify(late)); assert.equal(later.fleet.log.length, 1, `${f}: the fleet saves`); assert.equal(later.refits[late.ship], 1, `${f}: the refit saves`);
}
console.log(`Kept saves load: ${files.join(', ')}.`);
