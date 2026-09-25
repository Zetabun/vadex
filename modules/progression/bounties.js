// Daily bounties (data/bounties.js): posted each day once the Comms spire is back, tracked from the pilot's lifetime stats
// (or their best sortie since), paid when claimed in the Comms room or in Missions. A day's finished bounties left
// unclaimed are paid when the next day's are posted, so nothing earned is ever lost.
import { G } from '@last-orbit/core/game.js';
import { dayKey } from '@last-orbit/data/daily.js';
import { BOUNTY_POOL, BOUNTY_BY_ID, BOUNTY_PAY, BOUNTY_BONUS_BP, COMMS_RANK } from '@last-orbit/data/bounties.js';
import { SHIPS, SHIP_BY_ID } from '@last-orbit/data/ships.js';

export const commsOpen = (st = G.state) => (st.prestige?.level || 0) >= COMMS_RANK;

/** What one of the pilot's sorties earns: the middle of their recent ones (or a guess from how deep they go). */
export function sortieWorth(st) {
  const recent = (st.history || []).slice(0, 8).map((x) => x.salvage || 0).sort((a, b) => a - b);
  return recent.length >= 3 ? recent[Math.floor(recent.length / 2)] : 150 + 25 * (st.stats.bestWave || 0);
}
const nice = (v, step = 1) => Math.max(step, Math.round(v / step) * step);

/** Post a job from the pool, sized to the pilot. */
export function makeBounty(st, def) {
  const s = st.stats, sorties = Math.max(1, s.sorties || 0), b = { id: def.id, tier: def.tier, done: false, claimed: false };
  if (def.best) {
    const best = s.bestWave || 0;
    if (def.ship) { const own = SHIPS.filter((x) => st.unlocked.ships[x.id] && x.id !== st.ship), pick = own[Math.floor(Math.random() * own.length)] || SHIPS[0]; b.ship = pick.id; b.goal = Math.max(6, Math.round(best * 0.6)); }
    else b.goal = Math.max(8, best - 4);
    b.best = 0;
  } else { b.base = s[def.stat] || 0; b.goal = def.goal ?? Math.max(def.min, nice(((s[def.stat] || 0) / sorties) * def.per, def.step)); }
  b.reward = nice(sortieWorth(st) * BOUNTY_PAY[def.tier], 10);
  return b;
}
/** The day's three: one of each tier, from the jobs that can be posted. */
function post(st, today) {
  const list = [];
  for (const tier of [1, 2, 3]) { const pool = BOUNTY_POOL.filter((d) => d.tier === tier && (!d.needs || d.needs(st, today))), def = pool[Math.floor(Math.random() * pool.length)]; if (def) list.push(makeBounty(st, def)); }
  return list;
}
/** How far along a bounty is (0..goal). */
export function bountyProgress(st, b) { const def = BOUNTY_BY_ID[b.id]; return Math.min(b.goal, def.best ? b.best || 0 : Math.max(0, (st.stats[def.stat] || 0) - (b.base || 0))); }
export const bountyText = (b) => BOUNTY_BY_ID[b.id].text(b.goal, SHIP_BY_ID[b.ship]?.name);

/** Make sure today's bounties are posted. Returns what yesterday's finished-but-unclaimed ones paid ({ salvage, bp }),
 *  or null. */
export function refreshBounties(st = G.state, today = dayKey()) {
  if (!commsOpen(st)) return null; const bt = (st.bounties ||= { day: '', list: [], rerolled: false, bonus: false, done: 0, days: 0 });
  if (bt.day === today) return null;
  let paid = null;
  for (let i = 0; i < bt.list.length; i++) if (bt.list[i].done && !bt.list[i].claimed) { const r = claimBounty(st, i); paid = { salvage: (paid?.salvage || 0) + r.salvage, bp: (paid?.bp || 0) + r.bp }; }
  bt.day = today; bt.list = post(st, today); bt.rerolled = false; bt.bonus = false; return paid;
}
/** After a sortie or a siege: the best wave for 'reach' jobs, then which bounties are newly done (returned). */
export function checkBounties(st = G.state, summary = null) {
  if (!commsOpen(st) || !st.bounties?.list?.length) return [];
  const out = [];
  for (const b of st.bounties.list) {
    const def = BOUNTY_BY_ID[b.id]; if (b.done) continue;
    if (def.best && summary && !summary.counter && summary.wave && (!def.ship || summary.ship === b.ship)) b.best = Math.max(b.best || 0, summary.wave);
    if (bountyProgress(st, b) >= b.goal) { b.done = true; out.push(b); }
  }
  return out;
}
/** Pay a finished bounty (and, once all three are paid, the day's bonus). Returns { salvage, bp }. */
export function claimBounty(st, i) {
  const bt = st.bounties, b = bt?.list?.[i]; if (!b || !b.done || b.claimed) return { salvage: 0, bp: 0 };
  b.claimed = true; st.salvage += b.reward; bt.done = (bt.done || 0) + 1; let bp = 0;
  if (!bt.bonus && bt.list.length && bt.list.every((x) => x.claimed)) { bt.bonus = true; bt.days = (bt.days || 0) + 1; bp = BOUNTY_BONUS_BP; st.prestige.bp += bp; st.prestige.bpEarned = (st.prestige.bpEarned || 0) + bp; }
  return { salvage: b.reward, bp };
}
/** Swap one unfinished bounty for another of the same tier, once a day. */
export function rerollBounty(st, i) {
  const bt = st.bounties, b = bt?.list?.[i]; if (!b || b.done || bt.rerolled) return false;
  const taken = new Set(bt.list.map((x) => x.id)), pool = BOUNTY_POOL.filter((d) => d.tier === b.tier && !taken.has(d.id) && (!d.needs || d.needs(st, bt.day)));
  if (!pool.length) return false; bt.list[i] = makeBounty(st, pool[Math.floor(Math.random() * pool.length)]); bt.rerolled = true; return true;
}
/** A finished bounty is waiting to be paid. */
export const bountyClaimable = (st = G.state) => commsOpen(st) && !!st.bounties?.list?.some((b) => b.done && !b.claimed);
/** Time until the next bounties, as "5h 12m". */
export function untilNextPost(now = new Date()) { const t = new Date(now); t.setHours(24, 0, 0, 0); const m = Math.max(1, Math.round((t - now) / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; }
