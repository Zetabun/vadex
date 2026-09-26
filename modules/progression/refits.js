// Materials and ship refits (data/materials.js, data/refits.js): banking what a sortie picked up, and buying a ship's
// next refit with them.
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { MATERIALS } from '@last-orbit/data/materials.js';
import { REFIT_MAX, refitStep } from '@last-orbit/data/refits.js';

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
/** A ship its pilot owns that could take its next refit now. */
export const refitReady = (st, ship) => { const n = refitNext(st, ship); return !!(n && st.unlocked?.ships?.[ship] && canAfford(st, n.cost)); };
/** Buys the ship's next refit if it is owned and the materials are there. */
export function buyRefit(st, ship) {
  const n = refitNext(st, ship); if (!n || !st.unlocked?.ships?.[ship] || !canAfford(st, n.cost)) return null;
  const m = mats(st); for (const [id, c] of Object.entries(n.cost)) m[id] -= c;
  (st.refits ||= {})[ship] = n.n; if (st === G.state) recalc(); bus.emit('bought', 'refit', ship); return n;
}
