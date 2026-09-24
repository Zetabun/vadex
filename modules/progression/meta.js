// Between sorties: Salvage spending (Workshop, ships), contracts and unlocks.
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { WORKSHOP_BY_ID, workshopCost } from '@last-orbit/data/workshop.js';
import { SHIP_BY_ID } from '@last-orbit/data/ships.js';
import { CONTRACTS, CONTRACT_BY_ID } from '@last-orbit/data/contracts.js';
import { WEAPONS } from '@last-orbit/data/weapons.js';
import { ABILITIES } from '@last-orbit/data/abilities.js';
import { MAX_RANK, rankNeed, rankReward, PAINT_BY_ID, PAINTS, MAX_MASTERY, masteryNeed } from '@last-orbit/data/career.js';
import { MAX_THREAT, THREAT_UNLOCK_SECTOR } from '@last-orbit/data/threat.js';
import { dayKey, dailyFor } from '@last-orbit/data/daily.js';
import { ACHIEVEMENTS, FEATS, TIERS, FEAT_XP, MEDAL_COUNT } from '@last-orbit/data/achievements.js';

// ---------------------------------------------------------------- workshop
export const workshopLevel = (id) => G.state.workshop[id] || 0;
export function workshopNext(id) { const d = WORKSHOP_BY_ID[id], l = workshopLevel(id); return l >= d.max ? null : workshopCost(d, l); }
export function buyWorkshop(id) {
  const cost = workshopNext(id); if (cost == null || G.state.salvage < cost) return false;
  G.state.salvage -= cost; G.state.workshop[id] = workshopLevel(id) + 1; recalc(); checkAchievements(); bus.emit('bought', 'workshop', id); return true;
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
  G.state.salvage -= s.cost; G.state.unlocked.ships[id] = Date.now(); G.state.ship = id; G.state.stats.shipsOwned = Object.keys(G.state.unlocked.ships).length; recalc(); checkContracts(); bus.emit('bought', 'ship', id); return true;
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
  if (u.paint) return 'Paint: ' + PAINT_BY_ID[u.paint].name;
  return '';
}
/** Complete every contract whose goal is met. Rewards are banked immediately. Returns newly completed ids. */
export function checkContracts({ silent = false, medals = true } = {}) {
  const st = G.state, done = [];
  for (const c of CONTRACTS) {
    if (st.contracts[c.id] || (Number(st.stats[c.stat]) || 0) < c.goal) continue;
    st.contracts[c.id] = Date.now(); st.salvage += c.salvage; done.push(c.id); if (st.run) (st.run.contractsDone ||= []).push(c.id);
    const u = c.unlock;
    if (u?.weapon) st.unlocked.weapons[u.weapon] = Date.now();
    if (u?.ability) st.unlocked.abilities[u.ability] = Date.now();
    if (u?.paint) st.paints[u.paint] = Date.now();
    if (!silent) bus.emit('notice', { kind: 'unlock', kicker: 'Contract complete', title: c.name, salvage: c.salvage, sub: u ? unlockLabel(u) + (u.ship ? ' available in Ships' : ' unlocked') : '', art: u?.weapon ? 'weapon:' + u.weapon : u?.ability ? 'ability:' + u.ability : u?.ship ? 'ship:' + u.ship : 'cur:salvage', paint: u?.paint });
    bus.emit('contract', c.id);
  }
  if (medals) checkAchievements({ silent });
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

// ---------------------------------------------------------------- threat levels
/** Highest threat level the pilot may select (0 until they reach sector 4). */
export function threatMax() { const st = G.state.stats; return (st.bestSector || 1) >= THREAT_UNLOCK_SECTOR ? Math.min(MAX_THREAT, (st.threatClear || 0) + 1) : 0; }
export function setThreat(t) { const v = Math.max(0, Math.min(threatMax(), t | 0)); G.state.threat = v; bus.emit('threat', v); return v; }

// ---------------------------------------------------------------- daily sortie
/** Today's daily: seed, mutator and whether it has been flown. Rolls the record over at local midnight. */
export function dailyToday() {
  const d = G.state.daily, today = dailyFor(dayKey());
  if (d.day !== today.key) { d.day = today.key; d.done = false; d.wave = 0; }
  return { ...today, done: d.done, wave: d.wave, streak: d.streak, lastDay: d.lastDay, best: d.best };
}

// ---------------------------------------------------------------- ship mastery
export const masteryOf = (ship) => G.state.mastery[ship] || { level: 1, xp: 0 };
export const masteryProgress = (ship) => { const m = masteryOf(ship); return m.level >= MAX_MASTERY ? 1 : Math.min(1, m.xp / masteryNeed(m.level)); };
/** Add mastery XP (one per wave flown) to a ship; level 10 unlocks its Prime paint. */
export function addMastery(ship, amount) {
  const m = (G.state.mastery[ship] ||= { level: 1, xp: 0 }), from = m.level, gained = Math.max(0, Math.round(amount)), rewards = [];
  if (m.level < MAX_MASTERY) m.xp += gained;
  while (m.level < MAX_MASTERY && m.xp >= masteryNeed(m.level)) { m.xp -= masteryNeed(m.level); m.level++; rewards.push(m.level); }
  if (m.level >= MAX_MASTERY) { m.xp = 0; const paint = PAINTS.find((p) => p.ship === ship); if (paint) G.state.paints[paint.id] ||= Date.now(); }
  const s = G.state.stats; if (!(s.maxMastery >= m.level)) s.maxMastery = m.level;
  return { ship, gained, from, to: m.level, rewards };
}

// ---------------------------------------------------------------- achievements
export const medalsOf = (id) => G.state.medals[id] || 0;
/** Progress towards an achievement's next tier (or a feat). */
export function medalProgress(a) {
  const v = Number(a.get(G.state)) || 0, goals = a.goals || [a.goal], got = medalsOf(a.id), goal = goals[Math.min(got, goals.length - 1)];
  return { cur: Math.min(v, goal), goal, frac: Math.min(1, v / goal), tiers: got, max: goals.length, done: got >= goals.length };
}
export const medalTotal = () => { let n = 0; for (const a of ACHIEVEMENTS) n += medalsOf(a.id); for (const f of FEATS) n += medalsOf(f.id); return { earned: n, total: MEDAL_COUNT }; };
/** Award every medal whose goal is met. Pilot XP is paid at once in the hangar, or with the debrief during a sortie.
 *  pay: false leaves paying the XP to the caller (the debrief). Returns [{ id, tier, xp }]. */
export function checkAchievements({ silent = false, pay = true } = {}) {
  const st = G.state, out = [];
  const award = (a, tier, xp) => {
    st.medals[a.id] = tier + 1; out.push({ id: a.id, tier, xp });
    if (st.run) { st.run.medalXp = (st.run.medalXp || 0) + xp; (st.run.medalsDone ||= []).push({ id: a.id, tier, xp }); } else if (pay) addPilotXp(xp);
    if (!silent) bus.emit('notice', { kind: 'medal', kicker: a.goals ? `${TIERS[tier].name} medal` : 'Feat', title: a.name, sub: medalDesc(a, tier), art: a.art, tier: a.goals ? TIERS[tier].id : 'feat', xp });
  };
  for (const a of ACHIEVEMENTS) { const v = Number(a.get(st)) || 0; for (let t = medalsOf(a.id); t < a.goals.length && v >= a.goals[t]; t = medalsOf(a.id)) award(a, t, TIERS[t].xp); }
  for (const f of FEATS) if (!medalsOf(f.id) && (Number(f.get(st)) || 0) >= f.goal) award(f, 0, FEAT_XP);
  if (out.length) bus.emit('medal', out);
  return out;
}
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
/** Description of a medal tier with its goal filled in. */
export function medalDesc(a, tier = 0) {
  if (!a.goals) return a.desc;
  const g = a.goals[Math.min(tier, a.goals.length - 1)];
  return a.desc.replace('{n}', a.roman ? ROMAN[g] : g.toLocaleString('en-GB'));
}
