// Fleet expeditions (data/fleet.js): sending a ship out from a berth, how far along it is, and what it brings home. A
// trip's progress is worked out from when it left, so ships come back while the game is closed. What it finds is rolled
// from when it left, so reopening the game never changes it.
import { TRIP_CANISTER } from '@last-orbit/data/boosts.js';
import { rollBoost, stow } from '@last-orbit/progression/boosts.js';
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { makeRng } from '@last-orbit/core/rng.js';
import { BERTHS, DEST_BY_ID, PATHFINDER_AT, FLEET_PAINT, FINDS_LINES, DAMAGE, DAMAGE_LINES, FRAME_REFIT, FRAME_SAFER, fleetOpen, destOpen } from '@last-orbit/data/fleet.js';
import { SECTORS } from '@last-orbit/data/sectors.js';
import { seedsFor, gardenOpen } from '@last-orbit/data/garden.js';
import { sortieWorth } from '@last-orbit/progression/bounties.js';
import { bankMaterials, mats } from '@last-orbit/progression/refits.js';
import { garden } from '@last-orbit/progression/garden.js';
import { addMastery } from '@last-orbit/progression/meta.js';

const HOUR = 3600000, LOG_KEEP = 12;
export const fleet = (st = G.state) => {
  const f = (st.fleet ||= { out: [], log: [], sent: 0, home: 0, fragments: 0 });
  while (f.out.length < BERTHS) f.out.push(null); f.damage ||= {};
  return f;
};
/** The berth a ship is out from, or -1 when it is home. */
export const shipAway = (st, ship) => fleet(st).out.findIndex((o) => o && o.ship === ship);
/** How far along a trip is, 0..1 (1: home and waiting in its berth), or null for an empty berth. */
export function tripDone(st, i, now = Date.now()) { const o = fleet(st).out[i]; return o ? Math.min(1, Math.max(0, (now - o.at) / o.need)) : null; }
export function tripLeft(st, i, now = Date.now()) { const o = fleet(st).out[i]; return o ? Math.max(0, (o.at + o.need - now) / HOUR) : 0; }
/** How damaged a ship is: 0 (fine), 1 (light) or 2 (heavy). A damaged ship neither flies nor goes out till it is repaired. */
export const damageOf = (st, ship) => st.fleet?.damage?.[ship] || 0;
/** What a repair costs: salvage by what your sorties pay, and Alloy for heavy damage. */
export function repairCost(st, ship) { const d = DAMAGE[damageOf(st, ship)]; if (!d) return null; return { salvage: Math.max(50, Math.round((sortieWorth(st) * d.salvage) / 10) * 10), alloy: d.alloy }; }
export const canRepair = (st, ship) => { const c = repairCost(st, ship); return !!c && st.salvage >= c.salvage && (mats(st).alloy || 0) >= c.alloy; };
/** Pays for a ship's repairs: it is ready to fly (and go out) again. */
export function repairShip(st, ship) {
  const c = repairCost(st, ship); if (!c || !canRepair(st, ship)) return null;
  st.salvage -= c.salvage; if (c.alloy) mats(st).alloy -= c.alloy; delete fleet(st).damage[ship]; bus.emit('fleet', 'repaired', ship); return c;
}
/** Why a ship could not go (or null if it can): not owned, the one you fly, already out, damaged. */
export function cannotSend(st, ship) {
  if (!st.unlocked?.ships?.[ship]) return 'not owned';
  if (st.ship === ship) return 'flying';
  if (shipAway(st, ship) >= 0) return 'away';
  if (damageOf(st, ship)) return 'damaged';
  if (st.refitting?.ship === ship) return 'refit';
  return null;
}
/** Sends a ship out from an empty berth to a destination it can reach. Returns the trip, or null. */
export function sendShip(st, i, ship, destId, now = Date.now()) {
  const f = fleet(st), d = DEST_BY_ID[destId];
  if (!fleetOpen(st) || !d || !destOpen(st, d) || i < 0 || i >= BERTHS || f.out[i] || cannotSend(st, ship)) return null;
  f.out[i] = { ship, dest: d.id, at: now, need: d.hours * HOUR, frame: (st.refits?.[ship] || 0) >= FRAME_REFIT ? 1 : 0 }; /* frame: reinforced when it left */ f.sent = (f.sent || 0) + 1;
  bus.emit('fleet', 'sent', i); return f.out[i];
}
/** Calls a ship home early: it comes back with nothing. */
export function recallShip(st, i) { const f = fleet(st); if (!f.out[i]) return false; f.out[i] = null; bus.emit('fleet', 'recalled', i); return true; }
/** What a trip found, rolled from when it left (so it is the same however many times it is asked). */
export function tripFinds(st, o) {
  const d = DEST_BY_ID[o.dest], r = makeRng((o.at ^ (o.ship.length * 7919) ^ (d.n * 104729)) >>> 0), got = { salvage: 0, mats: {}, seeds: [], cores: 0, bp: 0, fragments: 0 };
  got.salvage = Math.round(sortieWorth(st) * d.worth * (0.85 + r() * 0.3));
  got.mats[d.mat] = Math.round(d.matN * (0.8 + r() * 0.4));
  if (gardenOpen(st) && r() < d.seed) { const sec = d.deep ? { endless: true, idx: 6 + r.int(0, 1) } : { idx: d.sector }; got.seeds.push(...seedsFor(sec, false).slice(0, 1)); }
  if (st.counter?.unlocked && r() < d.core) got.cores = 1 + (r() < 0.3 ? 1 : 0);
  if (r() < d.bp) got.bp = 1;
  if (d.fragment && r() < d.fragment) got.fragments = 1;
  got.line = r.pick(FINDS_LINES[d.deep ? 'deep' : 'sector']);
  got.damage = r() < d.risk * (o.frame ? FRAME_SAFER : 1) ? (r() < d.heavy ? 2 : 1) : 0; if (got.damage) got.line = r.pick(DAMAGE_LINES[got.damage]);
  if (r() < TRIP_CANISTER + 0.04 * (d.n || 0)) got.canister = rollBoost(r); /* a supply canister for the field kit (drawn last, so older finds are unchanged) */
  return got;
}
/** Brings a ship that is home in: banks what it found, gives it mastery and writes it in the log. Returns the log entry. */
export function collectShip(st, i, now = Date.now()) {
  const f = fleet(st), o = f.out[i]; if (!o || tripDone(st, i, now) < 1) return null;
  const d = DEST_BY_ID[o.dest], got = tripFinds(st, o);
  st.salvage += got.salvage; st.stats.totalSalvage = (st.stats.totalSalvage || 0) + got.salvage;
  got.mats = bankMaterials(st, got.mats);
  const g = got.seeds.length ? garden(st) : null; for (const id of got.seeds) g.seeds[id] = (g.seeds[id] || 0) + 1;
  if (got.cores) st.counter.cores += got.cores;
  if (got.bp) { st.prestige.bp += got.bp; st.prestige.bpEarned = (st.prestige.bpEarned || 0) + got.bp; }
  if (got.canister) stow(st, got.canister, 'expedition');
  f.fragments = (f.fragments || 0) + got.fragments; if (got.damage) f.damage[o.ship] = Math.max(f.damage[o.ship] || 0, got.damage);
  const mastery = st === G.state ? addMastery(o.ship, d.mastery) : null;
  f.out[i] = null; f.home = (f.home || 0) + 1;
  const paint = f.home >= PATHFINDER_AT && !st.paints[FLEET_PAINT] ? FLEET_PAINT : null; if (paint) st.paints[paint] = now;
  const entry = { ship: o.ship, dest: d.id, at: now, got: { salvage: got.salvage, mats: got.mats, seeds: got.seeds, cores: got.cores, bp: got.bp, fragments: got.fragments, damage: got.damage, canister: got.canister || null }, line: got.line };
  f.log.unshift(entry); f.log.length = Math.min(f.log.length, LOG_KEEP);
  bus.emit('fleet', 'home', i); return { ...entry, mastery, paint };
}
/** The fleet at a glance: ships out, ships home and waiting, empty berths. */
export function fleetCounts(st = G.state, now = Date.now()) {
  const f = fleet(st); let out = 0, ready = 0, free = 0;
  for (let i = 0; i < BERTHS; i++) { const t = tripDone(st, i, now); if (t == null) free++; else if (t >= 1) ready++; else out++; }
  return { out, ready, free, home: f.home || 0, fragments: f.fragments || 0, damaged: Object.keys(f.damage).filter((id) => f.damage[id] && st.unlocked?.ships?.[id]).length };
}
/** The next ship due home, in hours (Infinity when none are out). */
export function nextHome(st = G.state, now = Date.now()) { let best = Infinity; for (let i = 0; i < BERTHS; i++) if (tripDone(st, i, now) != null) best = Math.min(best, tripLeft(st, i, now)); return best; }
export const destName = (id) => DEST_BY_ID[id]?.name || '';
export const destSector = (id) => SECTORS[DEST_BY_ID[id]?.sector];
