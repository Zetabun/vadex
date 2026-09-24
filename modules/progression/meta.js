// Between sorties: Salvage spending (Workshop, ships), contracts and unlocks.
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { WORKSHOP_BY_ID, workshopCost } from '@last-orbit/data/workshop.js';
import { SHIP_BY_ID } from '@last-orbit/data/ships.js';
import { CONTRACTS, CONTRACT_BY_ID } from '@last-orbit/data/contracts.js';
import { WEAPONS } from '@last-orbit/data/weapons.js';
import { ABILITIES } from '@last-orbit/data/abilities.js';
import { MAX_RANK, rankNeed, rankReward, PAINT_BY_ID } from '@last-orbit/data/career.js';

// ---------------------------------------------------------------- workshop
export const workshopLevel = (id) => G.state.workshop[id] || 0;
export function workshopNext(id) { const d = WORKSHOP_BY_ID[id], l = workshopLevel(id); return l >= d.max ? null : workshopCost(d, l); }
export function buyWorkshop(id) {
  const cost = workshopNext(id); if (cost == null || G.state.salvage < cost) return false;
  G.state.salvage -= cost; G.state.workshop[id] = workshopLevel(id) + 1; recalc(); bus.emit('bought', 'workshop', id); return true;
}

// ---------------------------------------------------------------- ships
/** 'owned' | 'buyable' | 'locked' */
/** The contract that makes a ship available for purchase (none for the starter). */
export const shipContract = (id) => CONTRACTS.find((c) => c.unlock?.ship === id) || null;
export function shipStatus(id) {
  const st = G.state, c = shipContract(id);
  if (st.unlocked.ships[id]) return 'owned';
  if (!c || st.contracts[c.id]) return 'buyable';
  return 'locked';
}
export function buyShip(id) {
  const s = SHIP_BY_ID[id]; if (shipStatus(id) !== 'buyable' || G.state.salvage < s.cost) return false;
  G.state.salvage -= s.cost; G.state.unlocked.ships[id] = Date.now(); G.state.ship = id; recalc(); bus.emit('bought', 'ship', id); return true;
}
export function selectShip(id) { if (!G.state.unlocked.ships[id] || G.state.run) return false; G.state.ship = id; recalc(); bus.emit('shipSelected', id); return true; }

// ---------------------------------------------------------------- contracts
export function contractProgress(c) { const v = Number(G.state.stats[c.stat]) || 0; return { cur: Math.min(v, c.goal), goal: c.goal, frac: Math.min(1, v / c.goal), done: !!G.state.contracts[c.id] }; }
/** The next few unfinished contracts, in ladder order. */
export const nextContracts = (n = 3) => CONTRACTS.filter((c) => !G.state.contracts[c.id]).slice(0, n);
export function unlockLabel(u) {
  if (!u) return '';
  if (u.weapon) return 'Weapon: ' + WEAPONS[u.weapon].name;
  if (u.ability) return 'Ability: ' + ABILITIES[u.ability].name;
  if (u.ship) return 'Ship: ' + SHIP_BY_ID[u.ship].name;
  return '';
}
/** Complete every contract whose goal is met. Rewards are banked immediately. Returns newly completed ids. */
export function checkContracts({ silent = false } = {}) {
  const st = G.state, done = [];
  for (const c of CONTRACTS) {
    if (st.contracts[c.id] || (Number(st.stats[c.stat]) || 0) < c.goal) continue;
    st.contracts[c.id] = Date.now(); st.salvage += c.salvage; done.push(c.id); if (st.run) (st.run.contractsDone ||= []).push(c.id);
    const u = c.unlock;
    if (u?.weapon) st.unlocked.weapons[u.weapon] = Date.now();
    if (u?.ability) st.unlocked.abilities[u.ability] = Date.now();
    if (!silent) bus.emit('notice', { kind: 'unlock', kicker: 'Contract complete', title: c.name, salvage: c.salvage, sub: u ? unlockLabel(u) + (u.ship ? ' available in Ships' : ' unlocked') : '', art: u?.weapon ? 'weapon:' + u.weapon : u?.ability ? 'ability:' + u.ability : u?.ship ? 'ship:' + u.ship : 'cur:salvage' });
    bus.emit('contract', c.id);
  }
  return done;
}
export const contractById = (id) => CONTRACT_BY_ID[id];

// ---------------------------------------------------------------- pilot career
/** Add pilot XP, pay out every rank reached. Returns { gained, from, to, rewards: [{ rank, salvage?, paint? }] }. */
export function addPilotXp(amount) {
  const p = G.state.pilot, from = p.rank, rewards = [];
  const gained = Math.max(0, Math.round(amount));
  if (p.rank < MAX_RANK) p.xp += gained;
  while (p.rank < MAX_RANK && p.xp >= rankNeed(p.rank)) {
    p.xp -= rankNeed(p.rank); p.rank++;
    const r = rankReward(p.rank); rewards.push({ rank: p.rank, ...r });
    if (r.salvage) G.state.salvage += r.salvage;
    if (r.paint) G.state.paints[r.paint] = Date.now();
  }
  if (p.rank >= MAX_RANK) p.xp = 0;
  if (rewards.length) bus.emit('rankUp', p.rank, rewards);
  return { gained, from, to: p.rank, rewards };
}
export const pilotProgress = () => { const p = G.state.pilot; return p.rank >= MAX_RANK ? 1 : Math.min(1, p.xp / rankNeed(p.rank)); };
export function selectPaint(id) { if (!G.state.paints[id] || !PAINT_BY_ID[id]) return false; G.state.paint = id; bus.emit('paint', id); return true; }
