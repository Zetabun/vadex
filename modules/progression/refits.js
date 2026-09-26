// Materials and ship refits (data/materials.js, data/refits.js): banking what a sortie picked up, and buying a ship's
// next refit with them. A refit takes time (REFIT_MINUTES) in the dock, one at a time, and it keeps going with the game
// closed; the ship in the dock can't fly or go on expeditions. You can take her out early to fly her: the refit waits,
// keeping what was done, and she goes back in after the sortie (or when you put her back).
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { MATERIALS } from '@last-orbit/data/materials.js';
import { REFIT_MAX, REFIT_MINUTES, refitStep } from '@last-orbit/data/refits.js';

export const mats = (st = G.state) => (st.materials ||= {});
/** Adds a sortie's (or an expedition's) materials to the bank; returns what was added. */
export function bankMaterials(st, got = {}) {
  const m = mats(st), out = {}; for (const { id } of MATERIALS) { const n = Math.floor(got[id] || 0); if (n > 0) { m[id] = (m[id] || 0) + n; out[id] = n; } }
  return out;
}
export const refitLevel = (st, ship) => st.refits?.[ship] || 0;
/** The next refit for a ship, or null once it has all five. */
export const refitNext = (st, ship) => (refitLevel(st, ship) >= REFIT_MAX ? null : refitStep(ship, refitLevel(st, ship) + 1));
export const canAfford = (st, cost) => Object.entries(cost).every(([id, n]) => (mats(st)[id] || 0) >= n);
/** A ship its pilot owns that could take its next refit now (the dock free, the ship home). */
export const refitReady = (st, ship) => { const n = refitNext(st, ship); return !!(n && st.unlocked?.ships?.[ship] && canAfford(st, n.cost) && !st.refitting && !shipOut(st, ship)); };
const shipOut = (st, ship) => !!st.fleet?.out?.some((o) => o?.ship === ship);
// ---------------------------------------------------------------- the dock
/** The refit under way ({ ship, n, done, need, since }: since is when she went into the dock, null while she is out). */
export const refitUnderway = (st = G.state) => st.refitting || null;
/** In the dock now (she can't fly or go out). */
export const inDock = (st, ship) => st.refitting?.ship === ship && st.refitting.since != null;
/** How far along the refit is, 0..1, and how long is left, in minutes. */
export function refitProgress(st = G.state, now = Date.now()) { const r = st.refitting; if (!r) return null; const done = r.done + (r.since != null ? now - r.since : 0); return { k: Math.min(1, done / r.need), mins: Math.max(0, (r.need - done) / 60000), step: refitStep(r.ship, r.n), ship: r.ship, out: r.since == null }; }
/** Take her out of the dock to fly her: the refit waits. */
export function takeOut(st = G.state, now = Date.now()) { const r = st.refitting; if (!r || r.since == null) return false; r.done += now - r.since; r.since = null; return true; }
/** Back into the dock: the refit carries on. */
export function redock(st = G.state, now = Date.now()) { const r = st.refitting; if (!r || r.since != null) return false; r.since = now; return true; }
/** A refit whose time is up is fitted: returns its step (and the ship), or null. */
export function settleRefit(st = G.state, now = Date.now()) {
  const p = refitProgress(st, now); if (!p || p.k < 1 || p.out) return null; const r = st.refitting; st.refitting = null;
  (st.refits ||= {})[r.ship] = r.n; if (st === G.state) recalc(); bus.emit('refitDone', r.ship, r.n); return { ...refitStep(r.ship, r.n), ship: r.ship };
}
/** Starts the ship's next refit, if it is owned and home, the materials are there and the dock is free: the materials
 *  are paid now, and she goes into the dock. Returns the step, with how long it takes (mins). */
export function buyRefit(st, ship, now = Date.now()) {
  const n = refitNext(st, ship); if (!n || !st.unlocked?.ships?.[ship] || !canAfford(st, n.cost) || st.refitting || shipOut(st, ship)) return null;
  const m = mats(st); for (const [id, c] of Object.entries(n.cost)) m[id] -= c;
  const mins = REFIT_MINUTES[n.n - 1] || 60; st.refitting = { ship, n: n.n, done: 0, need: mins * 60000, since: now };
  bus.emit('bought', 'refit', ship); return { ...n, mins };
}
