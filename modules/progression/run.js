// The sortie: start, experience and level-ups, card offers, relics, salvage and the end-of-run debrief.
import { G, recalc, count, maxStat, toast, noteHull } from '@last-orbit/core/game.js';
import { FOCUS_BY_ID, FOCUS_WEIGHT, WARP_PERKS, WARP_PERK_BY_ID, DRAFT_FROM } from '@last-orbit/data/warp.js';
import { bankMaterials } from '@last-orbit/progression/refits.js';
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
import { checkContracts, checkAchievements, addPilotXp, threatMax, dailyToday, addMastery, refreshMenus } from '@last-orbit/progression/meta.js';
import { TOP_N } from '@last-orbit/data/score.js';
import { sortiePilotXp } from '@last-orbit/data/career.js';
import { threatPilotXp } from '@last-orbit/data/threat.js';
import { MUTATOR_BY_ID, prevDayKey, dailyBonus } from '@last-orbit/data/daily.js';
import { FUSIONS, FUSION_BY_ID } from '@last-orbit/data/fusions.js';
import { ROUTES, ROUTE_BY_ID } from '@last-orbit/data/routes.js';
import { ANOMALIES, ANOMALY_BY_ID, ANOMALY_CHOICES, anomalyCounts } from '@last-orbit/data/anomalies.js';
import { SYNERGIES, synergyOf, synergyCount } from '@last-orbit/data/synergies.js';
import { STAGE_BY_N, STAR_HITS, STAR_KILLS, CORES_PER_STAR, clearBounty } from '@last-orbit/data/counter.js';
import { unlockCounter } from '@last-orbit/progression/meta.js';
import { patchStation } from '@last-orbit/progression/siege.js';
import { checkBounties } from '@last-orbit/progression/bounties.js';
import { takeRest } from '@last-orbit/progression/quarters.js';
import { takeBasket, bankSeeds } from '@last-orbit/progression/garden.js'; /* also listens for bosses leaving seeds */
import { newMarks } from '@last-orbit/progression/observatory.js';
import '@last-orbit/progression/beacons.js'; /* the Void bosses' record: listens for them falling */
import { REST_BONUS } from '@last-orbit/data/quarters.js';

// ---------------------------------------------------------------- sortie lifecycle
export function startSortie(opts = {}) {
  const st = G.state, ship = SHIP_BY_ID[st.ship] || SHIP_BY_ID.vanguard;
  // A Daily Sortie uses the day's shared seed and mutator, at no threat. It can be flown once a day.
  const counter = opts.counter ? STAGE_BY_N[opts.counter] : null;
  const daily = opts.daily && !counter ? dailyToday() : null;
  if (daily && daily.done) return null;
  st.run = newRun(ship, { ...opts, seed: daily ? daily.seed : opts.seed }); st.run.prevBest = st.stats.bestWave || 0; st.run.prevScore = st.stats.bestScore || 0; G.mode = 'sortie';
  const run = st.run;
  if (takeRest(st)) run.rested = true; // a night in the bunk: this sortie banks more salvage
  run.garden = takeBasket(st); // one of every bloom in the Greenhouse basket: boosts for this sortie
  run.threat = daily ? 0 : Math.max(0, Math.min(threatMax(), st.threat || 0));
  if (daily) { run.daily = daily.key; run.mutator = daily.mutator.id; st.daily.done = true; }
  // Warp start: begin at an unlocked sector with catch-up upgrades and relics for the sectors skipped.
  const warp = daily || counter ? 1 : Math.max(1, Math.min(warpMax(), opts.warp ?? st.warp ?? 1));
  if (warp > 1) { run.warp = warp; run.wave = (warp - 1) * BAL.sectorWaves + 1; run.level = 1 + (warp - 1) * BAL.warpCards; }
  // Counterattack: a stage of the vertical shooter. It gets the same catch-up as a warp to its sector.
  if (counter) st.stats.counterRuns = (st.stats.counterRuns || 0) + 1;
  if (counter) { run.mode = 'counter'; run.stage = counter.n; run.hard = !!opts.hard; run.threat = 0; run.wave = counter.wave; run.level = 1 + (counter.n - 1) * BAL.warpCards; run.catchUp = counter.n; }
  // A checkpoint resume starts at the level the pilot had reached, with those cards to pick again.
  const cpLevel = counter && opts.checkpoint ? st.counter.checkpoints?.[counter.n + (opts.hard ? 'h' : '')] : 0, cpExtra = cpLevel ? Math.max(0, cpLevel - run.level) : 0;
  if (cpLevel) { run.fromCheckpoint = true; run.level += cpExtra; }
  const start = MUTATOR_BY_ID[run.mutator]?.start;
  if (start?.weapon) { const pool = WEAPON_ORDER.filter((id) => !run.weapons[id]); const id = pool[Math.floor(rand() * pool.length)]; run.weapons[id] = 1; run.order.push(id); }
  recalc();
  run.rerolls = Math.round(G.sheet.n('rerolls'));
  const skipped = counter ? counter.n - 1 : warp - 1, perSector = BAL.warpCards + Math.round(G.sheet.n('warpCards'));
  run.pendingLevels = Math.round(G.sheet.n('startLevels')) + (start?.cards || 0) + skipped * perSector + (cpExtra || 0);
  run.pendingRelics = skipped * BAL.warpRelics + Math.round(G.sheet.n('startRelics'));
  count('sorties'); checkContracts();
  bus.emit('sortieStart', run);
  return run;
}

/** Bank the sortie, update lifetime records and contracts, and return a debrief summary. */
export function endSortie(reason = 'destroyed') {
  const st = G.state, run = st.run; if (!run) return null;
  const reached = Math.max(1, G.world?.wave?.num || run.wave), sec = sectorOf(reached), banked = Math.floor(run.salvage);
  st.salvage += banked; st.stats.totalSalvage = (st.stats.totalSalvage || 0) + banked; maxStat('bestSalvage', banked); const matsGot = bankMaterials(st, run.mats);
  if (reason === 'destroyed') count('deaths');
  const summary = {
    reason, ship: run.ship, wave: reached, sector: sec.idx + 1, sectorName: sec.def.name, level: run.level, kills: run.stats.kills || 0,
    bosses: run.stats.bossKills || 0, time: Math.round(run.time), salvage: banked, cards: run.stats.cards || 0, relics: run.relics.slice(),
    weapons: run.order.map((id) => [id, run.weapons[id]]), best: !run.mode && reached > (run.prevBest || 0), date: Date.now(),
  };
  st.run = null; G.mode = 'hangar';
  const bannersBefore = { ...st.banners };
  summary.threat = run.threat || 0; summary.mutator = run.mutator || null; summary.mats = matsGot;
  // a station damaged in a lost siege is patched by its crews while the pilot is out (if the sortie lasted long enough)
  summary.repaired = patchStation(summary.time);
  if (run.mode === 'counter') Object.assign(summary, recordCounter(st, run, summary, reason)); else Object.assign(summary, recordSortie(st, run, summary));
  if (run.daily) {
    const d = st.daily; d.streak = d.lastDay === prevDayKey(run.daily) ? d.streak + 1 : d.lastDay === run.daily ? d.streak : 1; d.lastDay = run.daily;
    d.wave = reached; d.score = summary.score; d.mutator = run.mutator; d.best = Math.max(d.best || 0, reached); count('dailies'); maxStat('bestStreak', d.streak);
    const bonus = dailyBonus(reached, d.streak); st.salvage += bonus; summary.daily = { bonus, streak: d.streak };
  }
  const flown = run.mode === 'counter' ? Math.round(3 + run.stage * 2 * (summary.counter?.cleared ? 1 : 0.5)) : Math.max(1, reached - (run.warp ? (run.warp - 1) * BAL.sectorWaves : 0)); summary.warp = run.warp || 1;
  summary.mastery = addMastery(run.ship, flown);
  // Contracts finished mid-sortie were announced as they happened; the debrief lists them all.
  summary.contracts = (run.contractsDone || []).concat(checkContracts({ silent: true, medals: false }));
  summary.counterUnlocked = unlockCounter({ silent: true });
  summary.menus = refreshMenus();
  // Medals earned during the sortie, and those its records just earned, pay their pilot XP with the sortie's own.
  // Rank-ups can unlock paint jobs, which can earn further medals: keep paying until nothing new is earned.
  let medals = checkAchievements({ silent: true, pay: false });
  const sum = (list) => list.reduce((n, m) => n + m.xp, 0);
  summary.pilot = addPilotXp(sortiePilotXp({ xpTotal: run.xpTotal, wave: flown, bosses: summary.bosses }) * threatPilotXp(summary.threat) * (run.daily ? 2 : 1) + (run.medalXp || 0) + sum(medals));
  for (let more; (more = checkAchievements({ silent: true, pay: false })).length;) {
    medals = medals.concat(more); const g = addPilotXp(sum(more));
    summary.pilot.gained += g.gained; summary.pilot.to = g.to; summary.pilot.rewards.push(...g.rewards);
  }
  summary.medals = (run.medalsDone || []).concat(medals);
  if (run.intelGained) summary.intel = { id: run.intelGained, level: st.intel[run.intelGained] };
  summary.banners = (run.bannersDone || []).concat(Object.keys(st.banners).filter((id) => !bannersBefore[id]));
  summary.bounties = checkBounties(st, summary); // the daily bounties this sortie finished
  summary.rested = !!run.rested;
  summary.garden = run.garden || []; summary.seeds = run.mode === 'counter' ? [] : bankSeeds(st, run); // the blooms it took, the seeds it brought home
  summary.voidMarks = !run.mode ? newMarks(run.prevBest || 0, reached) : []; // Deep Void depths reached for the first time
  summary.voidBeaten = run.voidBeaten || []; // Void bosses beaten for the first time
  if (!run.mode) st.history.unshift({ score: summary.score, wave: summary.wave, level: summary.level, ship: summary.ship, salvage: banked, time: summary.time, date: summary.date }); st.history.length = Math.min(st.history.length, 12);
  recalc(); bus.emit('sortieEnded', summary);
  return summary;
}

/** File a finished sortie in the records: personal bests, the top 10 by score and the ship's best. */
function recordSortie(st, run, s) {
  const score = Math.round(run.score || 0), rec = st.records;
  const prev = st.stats.bestScore || 0;
  maxStat('bestScore', score); maxStat('bestKills', s.kills); maxStat('longestRun', s.time);
  if (st.prestige && !run.daily) st.prestige.cycleBest = Math.max(st.prestige.cycleBest || 0, s.wave);
  const entry = { score, wave: s.wave, ship: s.ship, level: s.level, kills: s.kills, threat: s.threat, daily: !!run.daily, warp: run.warp || 1, date: s.date };
  rec.top.push(entry); rec.top.sort((a, b) => b.score - a.score || a.date - b.date); rec.top.length = Math.min(rec.top.length, TOP_N);
  const place = rec.top.indexOf(entry) + 1;
  const sb = (rec.ships[s.ship] ||= { score: 0, wave: 0 }); sb.score = Math.max(sb.score, score); sb.wave = Math.max(sb.wave, s.wave);
  const highScore = score > prev && score > 0;
  if (highScore) st.seen.records = false;
  return { score, place, highScore, prevScore: prev };
}

/** File a Counterattack attempt: stars (clear, few hits, most of the force destroyed), Alien Cores for new stars,
 *  a salvage bounty on the first clear, and the stage's best score. */
function recordCounter(st, run, s, reason) {
  const c = st.counter, key = run.hard ? 'hard' : 'stars', n = run.stage, cleared = reason === 'cleared' && !!run.stageCleared;
  const hits = run.hits || 0, killed = Math.min(1, (run.pathKills || 0) / Math.max(1, run.pathSpawned || 1));
  // A checkpoint resume flies half the stage, so it can only earn the clear star.
  const earned = cleared ? (run.fromCheckpoint ? 1 : 1 + (hits <= STAR_HITS ? 1 : 0) + (killed >= STAR_KILLS ? 1 : 0)) : 0;
  const cpKey = n + (run.hard ? 'h' : ''); c.checkpoints ||= {};
  if (cleared) delete c.checkpoints[cpKey]; else if (run.checkpointLevel) c.checkpoints[cpKey] = Math.max(c.checkpoints[cpKey] || 0, run.checkpointLevel);
  const prev = c[key][n] || 0, gained = Math.max(0, earned - prev), first = cleared && !prev, towed = cleared && !(c.stars[n] || 0) && !(c.hard[n] || 0); // towed: the boss is captured for the station
  if (earned > prev) c[key][n] = earned;
  const cores = gained * CORES_PER_STAR; c.cores += cores; st.stats.counterStars = (st.stats.counterStars || 0) + gained;
  const bounty = first ? clearBounty(n, run.hard) : 0; st.salvage += bounty;
  if (cleared) { maxStat('counterBest', n); if (run.hard) maxStat('counterHard', n); if (n === 6) st.paints.xeno ||= Date.now(); }
  const score = Math.round(run.score || 0), best = c.best[n] || 0; if (score > best) c.best[n] = score;
  return { score, counter: { stage: n, hard: !!run.hard, cleared, checkpoint: !cleared && !!c.checkpoints[cpKey], resumed: !!run.fromCheckpoint, stars: earned, gained, cores, bounty, hits, killed, trophy: towed ? n : 0, siegeUnlocked: towed && n === 1, newBest: score > best && score > 0 } };
}

/** A saved sortie found at boot (closed or discarded tab) cannot be resumed: bank its salvage and drop it. */
export function recoverInterruptedRun(state) {
  const run = state.run; if (!run) return 0;
  const got = Math.floor(run.salvage || 0), s = state.stats;
  state.salvage += got; s.totalSalvage = (s.totalSalvage || 0) + got; if (!(s.bestSalvage >= got)) s.bestSalvage = got;
  bankMaterials(state, run.mats); /* its materials are kept too */
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
  const got = v * G.sheet.n('salvageGain') * (run.rested ? 1 + REST_BONUS : 1); run.salvage += got; return got;
}

// ---------------------------------------------------------------- card offers
const unlockedWeapons = () => WEAPON_ORDER.filter((id) => G.state.unlocked.weapons[id]);
const unlockedAbilities = (run) => ABILITY_ORDER.filter((id) => G.state.unlocked.abilities[id] || SHIP_BY_ID[run.ship]?.ability === id);

/** Every card that could be offered right now, with its sampling weight. */
export function cardPool(run = G.state.run) {
  const out = [], sh = G.sheet;
  for (const id of run.order) { const r = run.weapons[id]; if (r < BAL.maxRank) out.push({ kind: 'upgrade', id, rank: r + 1, weight: 9, group: 'weapon', rarity: r + 1 === BAL.maxRank ? 'evo' : r + 1 >= 4 ? 'rare' : 'common' }); }
  // Special weapon cards once weapons are fully evolved: the ship's signature (mastery 5) and weapon fusions.
  const ship = SHIP_BY_ID[run.ship], max = BAL.maxRank;
  if (ship?.signature && !run.signature && run.weapons[ship.weapon] >= max && (G.state.mastery?.[ship.id]?.level || 1) >= 5) out.push({ kind: 'signature', id: ship.id, weight: 14, group: 'weapon', rarity: 'signature' });
  for (const f of FUSIONS) if (!(run.fusions || []).includes(f.id) && run.weapons[f.a] >= max && run.weapons[f.b] >= max) out.push({ kind: 'fusion', id: f.id, weight: 14, group: 'weapon', rarity: 'fusion' });
  if (run.order.length < BAL.maxWeapons) for (const id of unlockedWeapons()) if (!run.weapons[id]) out.push({ kind: 'weapon', id, weight: 5, group: 'weapon', rarity: 'rare' });
  if (run.abilities.length < BAL.maxAbilities) for (const id of unlockedAbilities(run)) if (!run.abilities.includes(id)) out.push({ kind: 'ability', id, weight: 2.5, rarity: 'rare' });
  for (const m of MODS) {
    const have = run.cards[m.id] || 0; if (have >= m.max) continue;
    if (m.needDrones && sh.n('drones') < 1) continue;
    if (m.needShield && sh.n('shieldRatio') <= 0) continue;
    if (run.mode === 'counter' && m.id === 'm_barrier') continue; // no bunkers in Counterattack
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
    case 'upgrade': run.weapons[c.id] = Math.min(BAL.maxRank, (run.weapons[c.id] || 1) + 1); maxStat('maxRank', run.weapons[c.id]); maxStat('maxedWeapons', run.order.filter((id) => run.weapons[id] >= BAL.maxRank).length); break;
    case 'ability': if (!run.abilities.includes(c.id)) run.abilities.push(c.id); break;
    case 'mod': {
      const m = MOD_BY_ID[c.id], s = synergyOf(c.id), before = s ? synergyCount(s, run) : 0;
      run.cards[c.id] = (run.cards[c.id] || 0) + 1; if (m.heal && p) { const was = p.hull; p.hull = Math.min(1, p.hull + m.heal); noteHull('card', p.hull - was); }
      const tier = s && s.tiers.find((t) => before < t.n && synergyCount(s, run) >= t.n);
      if (tier) { count('synergies'); bus.emit('synergy', s, tier); }
      break;
    }
    case 'signature': run.signature = true; count('signatures'); break;
    case 'fusion': (run.fusions ||= []).push(c.id); maxStat('fusions', run.fusions.length); break;
    case 'heal': if (p) { const was = p.hull; p.hull = Math.min(1, p.hull + 0.4); noteHull('card', p.hull - was); } break;
    case 'cash': grantSalvage(10 + run.wave * 2); break;
  }
  run.offer = null; run.pendingLevels = Math.max(0, run.pendingLevels - 1); count('cards');
  recalc();
  maxStat('maxDrones', Math.floor(G.sheet.n('drones')));
  bus.emit('cardPicked', c);
  nextOffer();
  return c;
}

/** Highest sector a sortie may warp to: the one after the furthest sector boss defeated (up to sector 6). */
export function warpMax() { return Math.max(1, Math.min(6, (G.state.stats.sectorsCleared || 0) + 1)); }

/** A sensible card for a pilot who wants to skip choosing: finish synergies, evolve weapons, prefer rarer cards. */
/** How much Auto-pick wants a card: signatures and fusions first, then gun ranks, new guns, and cards that complete a
 *  synergy. A warp focus (data/warp.js) adds weight to the kinds and synergies it favours. */
export function cardScore(c, run = G.state.run, focus = null) {
  let v = { signature: 30, fusion: 28, upgrade: 12, weapon: 10, ability: 6, mod: 5, heal: 1, cash: 1 }[c.kind] || 0;
  v += { evo: 6, epic: 4, rare: 2 }[c.rarity] || 0;
  const s = c.kind === 'mod' && synergyOf(c.id);
  if (s && !(run.cards[c.id] > 0)) { const n = synergyCount(s, run) + 1; v += s.tiers.some((t) => t.n === n) ? 9 : 3; }
  if (focus) { v += focus.kinds[c.kind] || 0; if (s && focus.themes.includes(s.id)) v += FOCUS_WEIGHT; }
  return v;
}
export function autoPickIndex(run = G.state.run, focus = null) {
  let best = 0; (run.offer || []).forEach((c, i) => { if (cardScore(c, run, focus) > cardScore(run.offer[best], run, focus)) best = i; });
  return best;
}
// ---------------------------------------------------------------- the warp draft (data/warp.js)
/** A big catch-up waiting before launch (a warp, or a late Counterattack stage), not yet drafted or refused. */
export const draftDue = (run = G.state.run) => !!run && !run.drafted && !run.manual && !(run.time > 0) && (run.warp > 1 || run.catchUp > 1) && (run.pendingLevels || 0) + (run.pendingRelics || 0) >= DRAFT_FROM;
/** The three warp perks on offer (kept on the run, so they stay the same if the game is reopened). */
export function warpPerkOffer(run = G.state.run) { if (!run.perkOffer) { const pool = WARP_PERKS.map((p) => p.id); run.perkOffer = []; while (run.perkOffer.length < 3 && pool.length) run.perkOffer.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]); } return run.perkOffer; }
/** Drafts every catch-up card and relic towards a focus and takes the warp perk. Returns the cards and relics taken. */
export function warpDraft(focusId, perkId, run = G.state.run) {
  const f = FOCUS_BY_ID[focusId]; if (!run || !f) return null;
  run.warpFocus = f.id; if (WARP_PERK_BY_ID[perkId]) run.warpPerk = perkId; run.drafted = true; recalc();
  const got = { cards: [], relics: [] }; let guard = 400;
  while (guard-- > 0 && nextOffer()) got.cards.push(pickCard(autoPickIndex(run, f)));
  while (guard-- > 0 && nextRelic()) { const o = run.relicOffer || [], i = o.findIndex((id) => f.relics.includes(id)); got.relics.push(pickRelic(i >= 0 ? i : 0)); }
  bus.emit('warpDrafted', run, got); return got;
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
  run.relics.push(id); run.relicOffer = null; recalc(); maxStat('maxRelics', run.relics.length);
  maxStat('maxDrones', Math.floor(G.sheet.n('drones')));
  bus.emit('relicPicked', id);
  return id;
}

// ---------------------------------------------------------------- routes (chosen after each sector boss)
/** Offer Steady Course and two random routes for the next sector. */
export function rollRoutes(run = G.state.run) {
  const pool = ROUTES.filter((r) => r.id !== 'steady'), out = ['steady'];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0].id);
  run.routeOffer = out; bus.emit('routeOffer', out); return out;
}
export function nextRoute() {
  const run = G.state.run; if (!run) return false;
  if (run.routeOffer) return true;
  if (run.pendingRoute) { run.pendingRoute = false; rollRoutes(run); return true; }
  return false;
}
export function pickRoute(idx) {
  const run = G.state.run, id = run?.routeOffer?.[idx]; if (!id) return null;
  run.route = id === 'steady' ? null : id; run.routeOffer = null; recalc();
  bus.emit('routePicked', id); // the sim re-applies enemy-side modifiers
  return ROUTE_BY_ID[id];
}

// ---------------------------------------------------------------- Deep Void anomalies (one per Deep Void sector, stacking)
/** Offer two anomalies the run can still take. */
export function rollAnomalies(run = G.state.run) {
  const have = anomalyCounts(run), pool = ANOMALIES.filter((a) => (have[a.id] || 0) < a.max), out = [];
  while (out.length < ANOMALY_CHOICES && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0].id);
  run.anomalyOffer = out.length ? out : null; return run.anomalyOffer;
}
export function nextAnomaly() {
  const run = G.state.run; if (!run) return false;
  if (run.anomalyOffer) return true;
  if (run.pendingAnomaly) { run.pendingAnomaly = false; return !!rollAnomalies(run); }
  return false;
}
export function pickAnomaly(idx) {
  const run = G.state.run, id = run?.anomalyOffer?.[idx]; if (!id) return null;
  (run.anomalies ||= []).push(id); run.anomalyOffer = null; recalc(); maxStat('maxAnomalies', run.anomalies.length);
  bus.emit('anomalyPicked', id); // the sim re-applies enemy-side modifiers
  return ANOMALY_BY_ID[id];
}

/** True while the pilot must choose something; combat is frozen until they do. */
export function choicePending() { const run = G.state.run; return !!(run && (run.offer || run.relicOffer || run.routeOffer || run.anomalyOffer)); }

// ---------------------------------------------------------------- descriptions (shared by the card UI and tests)
export function describeCard(c, run = G.state.run) {
  switch (c.kind) {
    case 'weapon': { const d = WEAPONS[c.id]; return { title: d.name, kicker: 'New weapon', icon: 'weapon:' + c.id, body: d.desc, color: '#' + d.color.toString(16).padStart(6, '0') }; }
    case 'upgrade': { const d = WEAPONS[c.id], evo = d.evo[c.rank - 2]; return { title: d.name, kicker: `Rank ${c.rank - 1} → ${c.rank}`, icon: 'weapon:' + c.id, body: `${evo.name}: ${evo.desc}. +30% damage.`, color: '#' + d.color.toString(16).padStart(6, '0'), evo: evo.name }; }
    case 'ability': { const d = ABILITIES[c.id]; return { title: d.name, kicker: 'New ability', icon: 'ability:' + c.id, body: d.desc, color: d.color }; }
    case 'mod': { const m = MOD_BY_ID[c.id], have = run?.cards[c.id] || 0; return { title: m.name, kicker: m.max > 1 ? `${have ? 'Level ' + (have + 1) : 'New'} · max ${m.max}` : 'Unique', icon: 'mod:' + c.id, body: m.desc, color: RARITY[m.rarity].color }; }
    case 'signature': { const s = SHIP_BY_ID[c.id], d = WEAPONS[s.weapon]; return { title: s.signature.name, kicker: `${s.name} signature`, icon: 'weapon:' + s.weapon, body: `${d.name}: ${s.signature.desc}.`, color: '#' + s.trim.toString(16).padStart(6, '0') }; }
    case 'fusion': { const f = FUSION_BY_ID[c.id]; return { title: f.name, kicker: `${WEAPONS[f.a].name} + ${WEAPONS[f.b].name}`, icon: 'weapon:' + f.a, icon2: 'weapon:' + f.b, body: f.desc, color: '#ff8bff' }; }
    case 'heal': return { title: 'Field Repairs', kicker: 'Supply', icon: 'supply:heal', body: 'Repair 40% hull.', color: '#6dff8e' };
    case 'cash': return { title: 'Salvage Cache', kicker: 'Supply', icon: 'supply:cash', body: `+${10 + (run?.wave || 1) * 2} salvage.`, color: '#ffc857' };
  }
  return { title: '?', kicker: '', icon: 'cur:salvage', body: '', color: '#fff' };
}
