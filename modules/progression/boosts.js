// The field kit (data/boosts.js): the boosts the pilot holds, the supply meter of the sortie in flight, packing a
// canister when it fills, and using a boost. The battle's side is small: combat/world.js adds to the meter as invaders
// are hit and says 'supplyFull'; combat/sim.js counts running boosts down; progression/stats.js applies them.
import { G, recalc, count } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { rand } from '@last-orbit/core/rng.js';
import { BOOSTS, BOOST_BY_ID, KIT_MAX, KIT_SELL, PATCH_HEAL, STACK_MAX, SUPPLY_FIRST, SUPPLY_GROWTH, kitOn } from '@last-orbit/data/boosts.js';

/** The kit: boost id → how many the pilot holds. */
export function kit(st = G.state) { const k = (st.kit ||= {}); for (const b of BOOSTS) k[b.id] ??= 0; return k; }
export const kitCount = (st = G.state) => BOOSTS.reduce((n, b) => n + (kit(st)[b.id] || 0), 0);
/** A boost at random, by weight. */
export function rollBoost(r = rand) {
  let tot = 0; for (const b of BOOSTS) tot += b.weight; let x = r() * tot;
  for (const b of BOOSTS) { x -= b.weight; if (x <= 0) return b.id; }
  return BOOSTS[BOOSTS.length - 1].id;
}
/** A canister's boost into the kit ('canister' tells the HUD and the hangar). With KIT_MAX of it held already, it is
 *  sold for salvage instead (the sortie's, or the bank's between sorties). where: sortie, expedition or bolt. */
export function stow(st, id, where = 'sortie') {
  const k = kit(st); st.stats.canisters = (st.stats.canisters || 0) + 1;
  const sold = k[id] >= KIT_MAX ? KIT_SELL : 0;
  if (sold) { if (st.run) st.run.salvage += sold; else st.salvage += sold; } else k[id]++;
  if (where === 'sortie' && st.run && !sold) (st.run.canisters ||= []).push(id); /* the debrief lists the ones kept */
  const got = { id, sold, where }; bus.emit('canister', got); return got;
}

// ------------------------------------------------------------------ the supply meter
/** A new sortie's meter (none in the Daily or Counterattack), and no boosts running. */
export function startSupply(run) { run.supply = kitOn(run) ? { fill: 0, need: SUPPLY_FIRST, packed: 0 } : null; run.boosts = {}; }
/** How full the meter is, 0 to 1. */
export const supplyPct = (run) => (run?.supply ? Math.min(1, run.supply.fill / run.supply.need) : 0);
function packFull() {
  const st = G.state, sp = st.run?.supply; if (!sp) return;
  while (sp.fill >= sp.need) { sp.fill -= sp.need; sp.packed++; sp.need = Math.round(sp.need * SUPPLY_GROWTH); stow(st, rollBoost()); }
}
bus.on('supplyFull', packFull);

// ------------------------------------------------------------------ using a boost
/** Why a boost cannot be used now ('' when it can): none left, not in this kind of sortie, the ship is down, the hull
 *  is whole (the patch), or it is running with a dose or more still to go (the timer holds STACK_MAX doses). */
export function cannotUse(st, id) {
  if (!BOOST_BY_ID[id]) return 'unknown';
  if (!kitOn(st.run)) return st.run?.daily ? 'daily' : 'off';
  if (!(kit(st)[id] > 0)) return 'none';
  if (!G.world?.player?.alive) return 'down';
  if (id === 'patch' && G.world.player.hull >= 1) return 'full';
  const b = BOOST_BY_ID[id]; if (b.secs && (st.run.boosts?.[id] || 0) > b.secs * (STACK_MAX - 1)) return 'running';
  return '';
}
/** Use a boost: a timed one runs (another of the same adds its time), the hull patch repairs at once. */
export function useBoost(st, id) {
  if (cannotUse(st, id)) return false;
  const b = BOOST_BY_ID[id]; kit(st)[id]--; count('boostsUsed');
  if (b.secs) { st.run.boosts[id] = (st.run.boosts[id] || 0) + b.secs; recalc(); }
  else { const p = G.world.player; p.hull = Math.min(1, p.hull + PATCH_HEAL); }
  bus.emit('boostUsed', id); return true;
}
/** The boosts running, longest left first: [{ id, left }]. */
export const running = (run) => Object.entries(run?.boosts || {}).map(([id, left]) => ({ id, left })).sort((a, b) => b.left - a.left);
