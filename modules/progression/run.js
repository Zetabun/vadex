// The sortie: start, experience and level-ups, card offers, relics, salvage and the end-of-run debrief.
import { G, recalc, count, maxStat, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { rand } from '@last-orbit/core/rng.js';
import { newRun } from '@last-orbit/core/state.js';
import { BAL, xpToNext } from '@last-orbit/data/balance.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { WEAPONS, WEAPON_ORDER } from '@last-orbit/data/weapons.js';
import { ABILITIES, ABILITY_ORDER } from '@last-orbit/data/abilities.js';
import { MODS, MOD_BY_ID, RARITY } from '@last-orbit/data/cards.js';
import { RELICS, RELIC_BY_ID } from '@last-orbit/data/relics.js';
import { SHIP_BY_ID } from '@last-orbit/data/ships.js';
import { checkContracts, addPilotXp, threatMax, dailyToday, addMastery } from '@last-orbit/progression/meta.js';
import { sortiePilotXp } from '@last-orbit/data/career.js';
import { threatPilotXp } from '@last-orbit/data/threat.js';
import { MUTATOR_BY_ID, prevDayKey, dailyBonus } from '@last-orbit/data/daily.js';

// ---------------------------------------------------------------- sortie lifecycle
export function startSortie(opts = {}) {
  const st = G.state, ship = SHIP_BY_ID[st.ship] || SHIP_BY_ID.vanguard;
  // A Daily Sortie uses the day's shared seed and mutator, at no threat. It can be flown once a day.
  const daily = opts.daily ? dailyToday() : null;
  if (daily && daily.done) return null;
  st.run = newRun(ship, { ...opts, seed: daily ? daily.seed : opts.seed }); st.run.prevBest = st.stats.bestWave || 0; G.mode = 'sortie';
  const run = st.run;
  run.threat = daily ? 0 : Math.max(0, Math.min(threatMax(), st.threat || 0));
  if (daily) { run.daily = daily.key; run.mutator = daily.mutator.id; st.daily.done = true; }
  const start = MUTATOR_BY_ID[run.mutator]?.start;
  if (start?.weapon) { const pool = WEAPON_ORDER.filter((id) => !run.weapons[id]); const id = pool[Math.floor(rand() * pool.length)]; run.weapons[id] = 1; run.order.push(id); }
  recalc();
  run.rerolls = Math.round(G.sheet.n('rerolls'));
  run.pendingLevels = Math.round(G.sheet.n('startLevels')) + (start?.cards || 0);
  count('sorties'); checkContracts();
  bus.emit('sortieStart', run);
  return run;
}

/** Bank the sortie, update lifetime records and contracts, and return a debrief summary. */
export function endSortie(reason = 'destroyed') {
  const st = G.state, run = st.run; if (!run) return null;
  const reached = Math.max(1, G.world?.wave?.num || run.wave), sec = sectorOf(reached), banked = Math.floor(run.salvage);
  st.salvage += banked; st.stats.totalSalvage = (st.stats.totalSalvage || 0) + banked; maxStat('bestSalvage', banked);
  if (reason === 'destroyed') count('deaths');
  const summary = {
    reason, ship: run.ship, wave: reached, sector: sec.idx + 1, sectorName: sec.def.name, level: run.level, kills: run.stats.kills || 0,
    bosses: run.stats.bossKills || 0, time: Math.round(run.time), salvage: banked, cards: run.stats.cards || 0, relics: run.relics.slice(),
    weapons: run.order.map((id) => [id, run.weapons[id]]), best: reached > (run.prevBest || 0), date: Date.now(),
  };
  st.run = null; G.mode = 'hangar';
  summary.threat = run.threat || 0; summary.mutator = run.mutator || null;
  if (run.daily) {
    const d = st.daily; d.streak = d.lastDay === prevDayKey(run.daily) ? d.streak + 1 : d.lastDay === run.daily ? d.streak : 1; d.lastDay = run.daily;
    d.wave = reached; d.best = Math.max(d.best || 0, reached); count('dailies'); maxStat('bestStreak', d.streak);
    const bonus = dailyBonus(reached, d.streak); st.salvage += bonus; summary.daily = { bonus, streak: d.streak };
  }
  summary.mastery = addMastery(run.ship, reached);
  summary.pilot = addPilotXp(sortiePilotXp({ xpTotal: run.xpTotal, wave: reached, bosses: summary.bosses }) * threatPilotXp(summary.threat) * (run.daily ? 2 : 1));
  // Contracts finished mid-sortie were announced as they happened; the debrief lists them all.
  summary.contracts = (run.contractsDone || []).concat(checkContracts({ silent: true }));
  st.history.unshift({ wave: summary.wave, level: summary.level, ship: summary.ship, salvage: banked, time: summary.time, date: summary.date }); st.history.length = Math.min(st.history.length, 12);
  recalc(); bus.emit('sortieEnded', summary);
  return summary;
}

/** A saved sortie found at boot (closed or discarded tab) cannot be resumed: bank its salvage and drop it. */
export function recoverInterruptedRun(state) {
  const run = state.run; if (!run) return 0;
  const got = Math.floor(run.salvage || 0), s = state.stats;
  state.salvage += got; s.totalSalvage = (s.totalSalvage || 0) + got; if (!(s.bestSalvage >= got)) s.bestSalvage = got;
  state.run = null; return got;
}

// ---------------------------------------------------------------- experience
export function grantXp(amount) {
  const run = G.state.run; if (!run || !(amount > 0)) return;
  const got = amount * G.sheet.n('xpGain'); run.xp += got; run.xpTotal = (run.xpTotal || 0) + got;
  let need = xpToNext(run.level), gained = 0;
  while (run.xp >= need) { run.xp -= need; run.level++; run.pendingLevels++; gained++; need = xpToNext(run.level); }
  if (gained) { maxStat('maxLevel', run.level); bus.emit('levelUp', run.level); }
}
export const xpProgress = (run) => run ? Math.min(1, run.xp / xpToNext(run.level)) : 0;

export function grantSalvage(v) {
  const run = G.state.run; if (!run || !(v > 0)) return 0;
  const got = v * G.sheet.n('salvageGain'); run.salvage += got; return got;
}

// ---------------------------------------------------------------- card offers
const unlockedWeapons = () => WEAPON_ORDER.filter((id) => G.state.unlocked.weapons[id]);
const unlockedAbilities = (run) => ABILITY_ORDER.filter((id) => G.state.unlocked.abilities[id] || SHIP_BY_ID[run.ship]?.ability === id);

/** Every card that could be offered right now, with its sampling weight. */
export function cardPool(run = G.state.run) {
  const out = [], sh = G.sheet;
  for (const id of run.order) { const r = run.weapons[id]; if (r < BAL.maxRank) out.push({ kind: 'upgrade', id, rank: r + 1, weight: 9, group: 'weapon', rarity: r + 1 === BAL.maxRank ? 'evo' : r + 1 >= 4 ? 'rare' : 'common' }); }
  if (run.order.length < BAL.maxWeapons) for (const id of unlockedWeapons()) if (!run.weapons[id]) out.push({ kind: 'weapon', id, weight: 5, group: 'weapon', rarity: 'rare' });
  if (run.abilities.length < BAL.maxAbilities) for (const id of unlockedAbilities(run)) if (!run.abilities.includes(id)) out.push({ kind: 'ability', id, weight: 2.5, rarity: 'rare' });
  for (const m of MODS) {
    const have = run.cards[m.id] || 0; if (have >= m.max) continue;
    if (m.needDrones && sh.n('drones') < 1) continue;
    if (m.needShield && sh.n('shieldRatio') <= 0) continue;
    out.push({ kind: 'mod', id: m.id, stack: have + 1, weight: RARITY[m.rarity].weight, rarity: m.rarity });
  }
  return out;
}

function sample(pool, n) {
  const out = [], p = pool.slice();
  while (out.length < n && p.length) {
    let tot = 0; for (const c of p) tot += c.weight; let x = rand() * tot, k = 0;
    for (; k < p.length - 1; k++) { x -= p[k].weight; if (x <= 0) break; }
    out.push(p[k]); p.splice(k, 1);
  }
  return out;
}

/** Roll a fresh offer. At least one card improves the arsenal whenever that is possible. */
export function rollOffer(run = G.state.run) {
  const n = Math.max(2, Math.min(5, Math.round(G.sheet.n('cardChoices'))));
  const pool = cardPool(run), weaponCards = pool.filter((c) => c.group === 'weapon');
  let picks = [];
  if (weaponCards.length) { picks = sample(weaponCards, 1); pool.splice(pool.indexOf(picks[0]), 1); }
  picks = picks.concat(sample(pool, n - picks.length));
  if (!picks.length) picks = [{ kind: 'heal', rarity: 'common' }, { kind: 'cash', rarity: 'common' }];
  for (let i = picks.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [picks[i], picks[j]] = [picks[j], picks[i]]; }
  run.offer = picks.map(({ weight, group, ...c }) => c);
  bus.emit('offer', run.offer);
  return run.offer;
}

/** Open the next pending level-up if none is showing. Returns true when an offer is waiting for the pilot. */
export function nextOffer() {
  const run = G.state.run; if (!run) return false;
  if (run.offer) return true;
  if (run.pendingLevels > 0) { rollOffer(run); return true; }
  return false;
}

export function reroll() {
  const run = G.state.run; if (!run?.offer || run.rerolls <= 0) return false;
  run.rerolls--; rollOffer(run); return true;
}

export function pickCard(idx) {
  const st = G.state, run = st.run, c = run?.offer?.[idx]; if (!c) return null;
  const p = G.world?.player;
  switch (c.kind) {
    case 'weapon': run.weapons[c.id] = 1; run.order.push(c.id); maxStat('maxWeapons', run.order.length); break;
    case 'upgrade': run.weapons[c.id] = Math.min(BAL.maxRank, (run.weapons[c.id] || 1) + 1); maxStat('maxRank', run.weapons[c.id]); break;
    case 'ability': if (!run.abilities.includes(c.id)) run.abilities.push(c.id); break;
    case 'mod': { const m = MOD_BY_ID[c.id]; run.cards[c.id] = (run.cards[c.id] || 0) + 1; if (m.heal && p) p.hull = Math.min(1, p.hull + m.heal); break; }
    case 'heal': if (p) p.hull = Math.min(1, p.hull + 0.4); break;
    case 'cash': grantSalvage(10 + run.wave * 2); break;
  }
  run.offer = null; run.pendingLevels = Math.max(0, run.pendingLevels - 1); count('cards');
  recalc();
  maxStat('maxDrones', Math.floor(G.sheet.n('drones')));
  bus.emit('cardPicked', c);
  nextOffer();
  return c;
}

// ---------------------------------------------------------------- relics
export function rollRelics(run = G.state.run) {
  const have = new Set(run.relics), pool = RELICS.filter((r) => !have.has(r.id)), out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0].id);
  run.relicOffer = out.length ? out : null; bus.emit('relicOffer', run.relicOffer);
  return run.relicOffer;
}
export function nextRelic() {
  const run = G.state.run; if (!run) return false;
  if (run.relicOffer) return true;
  if (run.pendingRelics > 0) { run.pendingRelics--; return !!rollRelics(run); }
  return false;
}
export function pickRelic(idx) {
  const run = G.state.run, id = run?.relicOffer?.[idx]; if (!id) return null;
  run.relics.push(id); run.relicOffer = null; recalc();
  maxStat('maxDrones', Math.floor(G.sheet.n('drones')));
  bus.emit('relicPicked', id);
  return id;
}

/** True while the pilot must choose something; combat is frozen until they do. */
export function choicePending() { const run = G.state.run; return !!(run && (run.offer || run.relicOffer)); }

// ---------------------------------------------------------------- descriptions (shared by the card UI and tests)
export function describeCard(c, run = G.state.run) {
  switch (c.kind) {
    case 'weapon': { const d = WEAPONS[c.id]; return { title: d.name, kicker: 'New weapon', icon: 'weapon:' + c.id, body: d.desc, color: '#' + d.color.toString(16).padStart(6, '0') }; }
    case 'upgrade': { const d = WEAPONS[c.id], evo = d.evo[c.rank - 2]; return { title: d.name, kicker: `Rank ${c.rank - 1} → ${c.rank}`, icon: 'weapon:' + c.id, body: `${evo.name}: ${evo.desc}. +30% damage.`, color: '#' + d.color.toString(16).padStart(6, '0'), evo: evo.name }; }
    case 'ability': { const d = ABILITIES[c.id]; return { title: d.name, kicker: 'New ability', icon: 'ability:' + c.id, body: d.desc, color: d.color }; }
    case 'mod': { const m = MOD_BY_ID[c.id], have = run?.cards[c.id] || 0; return { title: m.name, kicker: m.max > 1 ? `${have ? 'Level ' + (have + 1) : 'New'} · max ${m.max}` : 'Unique', icon: 'mod:' + c.id, body: m.desc, color: RARITY[m.rarity].color }; }
    case 'heal': return { title: 'Field Repairs', kicker: 'Supply', icon: 'supply:heal', body: 'Repair 40% hull.', color: '#6dff8e' };
    case 'cash': return { title: 'Salvage Cache', kicker: 'Supply', icon: 'supply:cash', body: `+${10 + (run?.wave || 1) * 2} salvage.`, color: '#ffc857' };
  }
  return { title: '?', kicker: '', icon: 'cur:salvage', body: '', color: '#fff' };
}
