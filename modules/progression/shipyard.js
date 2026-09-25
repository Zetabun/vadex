// The Shipyard's build (data/shipyard.js): how far the yard has got, what the next stage costs and what is short, and
// building it. The last stage hands the ship over: she joins the hangar and is the one flown next.
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { YARD_STAGES, YARD_SHIP, yardOpen, stageSalvage } from '@last-orbit/data/shipyard.js';
import { checkContracts } from '@last-orbit/progression/meta.js';

/** Stages built so far (0 to 4). */
export const yardStage = (st = G.state) => Math.min(YARD_STAGES.length, st.shipyard?.stage || 0);
export const yardDone = (st = G.state) => yardStage(st) >= YARD_STAGES.length;
/** The next stage (n counts from 1) and its cost at the pilot's Overhaul rank, or null once she is built. */
export function nextStage(st = G.state) {
  const i = yardStage(st), s = YARD_STAGES[i]; if (!s) return null;
  return { ...s, n: i + 1, cost: { salvage: stageSalvage(s, st.prestige?.level || 0), cores: s.cores || 0, bp: s.bp || 0 } };
}
/** Why the next stage cannot be built yet: 'closed', 'done', 'salvage', 'cores' or 'bp'; null when it can. */
export function stageBlock(st = G.state) {
  if (!yardOpen(st)) return 'closed'; const n = nextStage(st); if (!n) return 'done';
  if ((st.salvage || 0) < n.cost.salvage) return 'salvage'; if ((st.counter?.cores || 0) < n.cost.cores) return 'cores'; if ((st.prestige?.bp || 0) < n.cost.bp) return 'bp';
  return null;
}
/** Build the next stage: pay for it and move the yard on (the last stage hands the ship over). The stage built, or null. */
export function buildStage(st = G.state) {
  if (stageBlock(st)) return null; const n = nextStage(st);
  st.salvage -= n.cost.salvage; st.counter.cores -= n.cost.cores; st.prestige.bp -= n.cost.bp; const yd = (st.shipyard ||= { stage: 0 }); yd.stage = n.n; (yd.at ||= [])[n.n - 1] = Date.now(); /* the build log on the yard's back wall */
  if (n.n >= YARD_STAGES.length) {
    st.unlocked.ships[YARD_SHIP] = Date.now(); st.ship = YARD_SHIP; st.stats.shipsOwned = Object.keys(st.unlocked.ships).length;
    recalc(); checkContracts(); bus.emit('bought', 'ship', YARD_SHIP);
  }
  return n;
}
