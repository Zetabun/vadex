// Spending and earning. All purchase rules live here so UI, automation and tests share one implementation.
import { Big } from '@last-orbit/core/big.js';
import { G, recalc, flag, toast, maxStat } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { nextMilestone } from '@last-orbit/data/balance.js';
import { UPGRADES } from '@last-orbit/data/upgrades.js';
import { RESEARCH } from '@last-orbit/data/research.js';
import { PRESTIGE, ASCENSION } from '@last-orbit/data/prestige.js';
import { RELICS, ALIEN } from '@last-orbit/data/relics.js';
import { WEAPONS, WEAPON_ORDER, EVO_LEVELS } from '@last-orbit/data/weapons.js';
import { DRONES } from '@last-orbit/data/drones.js';
import { ABILITIES, ABILITY_ORDER } from '@last-orbit/data/abilities.js';
import { DEF } from '@last-orbit/progression/stats.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { PROJECTS } from '@last-orbit/data/projects.js';

// ---------- currencies ----------
export function gain(cur, amt) {
  amt = Big.from(amt); if (amt.m <= 0) return;
  const s = G.state;
  // Scrap economy begins when the Arsenal is introduced. Never bank hidden pre-unlock Scrap.
  if (cur === 'scrap' && !s.unlocks.arsenal) return;
  s.cur[cur] = s.cur[cur].add(amt);
  const e = s.stats.earned || (s.stats.earned = {}); e[cur] = Big.from(e[cur] || 0).add(amt);
  const re = s.run.stats.earned || (s.run.stats.earned = {}); re[cur] = Big.from(re[cur] || 0).add(amt);
}
export const can = (cur, amt) => G.state.cur[cur].gte(amt);
export function spend(cur, amt) { if (!can(cur, amt)) return false; G.state.cur[cur] = G.state.cur[cur].sub(amt).max(0); return true; }

// ---------- geometric cost helpers ----------
export function geoCost(base, growth, lvl, n = 1) {
  const first = Big.pow(growth, lvl).mul(base);
  if (growth === 1) return first.mul(n);
  return first.mul(Big.pow(growth, n).sub(1)).div(growth - 1);
}
export function geoMax(base, growth, lvl, funds) {
  if (growth === 1) return Math.floor(Math.min(1e6, funds.div(base).toNumber()));
  const first = Big.pow(growth, lvl).mul(base);
  const x = funds.mul(growth - 1).div(first).add(1).log10() / Math.log10(growth);
  return Math.max(0, Math.floor(x + 1e-9));
}

// ---------- credit upgrades ----------
export const upgradeLevel = (id) => G.state.run.upgrades[id] || 0;
export const upgradeVisible = (d) => !d.wave || G.state.stats.bestWave >= d.wave;
export const upgradeOwnedFree = (d) => d.type === 'flag' && flag(d.stat) && !upgradeLevel(d.id); // granted by the Rewind tree
/** n: number | 'max' | 'next' (to next milestone). Returns {n, cost}. */
export function upgradeQuote(d, n) {
  const lvl = upgradeLevel(d.id), room = (d.max || Infinity) - lvl;
  if (room <= 0) return { n: 0, cost: Big.ZERO };
  let want = n;
  if (n === 'max') want = Math.max(1, geoMax(d.cost[0], d.cost[1], lvl, G.state.cur.credits));
  else if (n === 'next') { const m = d.noMs ? null : nextMilestone(lvl); want = m ? m - lvl : 1; }
  want = Math.max(1, Math.min(want, room));
  return { n: want, cost: geoCost(d.cost[0], d.cost[1], lvl, want) };
}
export function buyUpgrade(id, n = 1, silent) {
  const d = DEF.upgrades[id]; if (!d || !upgradeVisible(d) || upgradeOwnedFree(d)) return 0;
  const q = upgradeQuote(d, n); if (!q.n || !spend('credits', q.cost)) return 0;
  const before = upgradeLevel(id); G.state.run.upgrades[id] = before + q.n; recalc();
  if (!silent) bus.emit('bought', 'upgrade', id, { before, after: before + q.n, milestone: !d.noMs && nextMilestone(before) && before + q.n >= nextMilestone(before) });
  return q.n;
}

// ---------- node trees (research, rewind, ascension, relics, alien) ----------
export const TREES = {
  research: { defs: RESEARCH, cur: 'data', store: (s) => s.run.research },
  prestige: { defs: PRESTIGE, cur: 'shards', store: (s) => s.prestige.tree },
  asc: { defs: ASCENSION, cur: 'sigils', store: (s) => s.asc.tree },
  relics: { defs: RELICS, cur: 'frags', store: (s) => s.relics },
  alien: { defs: ALIEN, cur: 'matter', store: (s) => s.alien },
};
export const nodeLevel = (kind, id) => TREES[kind].store(G.state)[id] || 0;
export const nodeCost = (d, lvl) => Big.pow(d.cost[1], lvl).mul(d.cost[0]);
export function gateOpen(g) {
  if (!g) return true; const s = G.state;
  if (g.wave && s.run.best < g.wave && !(s.prestige.count && s.stats.bestWave >= g.wave * 2)) return false;
  if (g.sector && (s.stats.bestSector || 1) < g.sector) return false;
  if (g.rewinds && s.prestige.count < g.rewinds) return false;
  return true;
}
export function gateText(g) { return g.wave ? `Reach wave ${g.wave}` : g.sector ? `Reach sector ${g.sector}` : g.rewinds ? `Rewind ${g.rewinds}×` : ''; }
/** 'maxed' | 'open' | 'locked' (requirements unmet) */
export function nodeStatus(kind, d) {
  const lvl = nodeLevel(kind, d.id);
  if (lvl >= d.max) return 'maxed';
  if (d.req && !d.req.every((r) => nodeLevel(kind, r) > 0)) return 'locked';
  return gateOpen(d.gate) ? 'open' : 'locked';
}
export function buyNode(kind, id, silent) {
  const t = TREES[kind], d = t.defs.find((x) => x.id === id); if (!d || nodeStatus(kind, d) !== 'open') return false;
  const lvl = nodeLevel(kind, id); if (!spend(t.cur, nodeCost(d, lvl))) return false;
  t.store(G.state)[id] = lvl + 1; recalc(); checkUnlocks();
  if (!silent) bus.emit('bought', kind, id, { after: lvl + 1 });
  return true;
}

// ---------- weapons ----------
export const weaponOwned = (id) => !!G.state.run.weapons[id];
export function weaponGate(id) {
  const u = WEAPONS[id].unlock; if (!u) return { ok: true };
  const s = G.state;
  if (u.wave && s.run.best < u.wave) return { ok: false, text: `Reach wave ${u.wave}` };
  if (u.sector && sectorOf(s.run.best).idx + 1 < u.sector) return { ok: false, text: `Reach sector ${u.sector} this run` };
  return { ok: true };
}
export function weaponUnlockCost(id) { const u = WEAPONS[id].unlock || {}; const out = []; if (u.credits) out.push(['credits', Big.from(u.credits)]); if (u.scrap) out.push(['scrap', Big.from(u.scrap)]); if (u.cores) out.push(['cores', Big.from(u.cores)]); return out; }
export function unlockWeapon(id) {
  if (weaponOwned(id) || !weaponGate(id).ok) return false;
  const ch = G.state.run.challenge && DEF.challenges[G.state.run.challenge];
  if (ch?.onlyWeapon && ch.onlyWeapon !== id) { toast('This challenge only allows ' + WEAPONS[ch.onlyWeapon].name, 'warn'); return false; }
  const costs = weaponUnlockCost(id); if (!costs.every(([c, a]) => can(c, a))) return false;
  costs.forEach(([c, a]) => spend(c, a));
  G.state.run.weapons[id] = 1; (G.state.seen.weapons ||= {})[id] = 1;
  const eq = G.state.run.equipped, slots = G.sheet.n('weaponSlots');
  for (let i = 0; i < slots; i++) if (!eq[i]) { eq[i] = id; break; }
  if (WEAPON_ORDER.every((w) => G.state.run.weapons[w])) maxStat('allWeapons', 1);
  recalc(); bus.emit('bought', 'weapon', id, { unlock: true }); return true;
}
export const weaponQuote = (id, n) => {
  const d = WEAPONS[id], lvl = G.state.run.weapons[id] || 1;
  let want = n;
  if (n === 'max') want = Math.max(1, geoMax(d.cost.base, d.cost.growth, lvl - 1, G.state.cur.scrap));
  else if (n === 'next') { const e = EVO_LEVELS.find((x) => x > lvl) || nextMilestone(lvl); want = e ? e - lvl : 1; }
  return { n: want, cost: geoCost(d.cost.base, d.cost.growth, lvl - 1, want) };
};
export function levelWeapon(id, n = 1, silent) {
  if (!weaponOwned(id)) return 0; const q = weaponQuote(id, n); if (!spend('scrap', q.cost)) return 0;
  const before = G.state.run.weapons[id]; G.state.run.weapons[id] = before + q.n; recalc();
  const evo = EVO_LEVELS.findIndex((l) => before < l && before + q.n >= l);
  if (!silent || evo >= 0) bus.emit('bought', 'weapon', id, { before, after: before + q.n, evo: evo >= 0 ? WEAPONS[id].evo[evo] : null });
  return q.n;
}
export function equipWeapon(slot, id) {
  const eq = G.state.run.equipped, slots = G.sheet.n('weaponSlots'); if (slot >= slots) return;
  const ch = G.state.run.challenge && DEF.challenges[G.state.run.challenge];
  if (id && ch?.onlyWeapon && ch.onlyWeapon !== id) return;
  const at = eq.indexOf(id); if (id && at >= 0) eq[at] = eq[slot] || null;
  eq[slot] = id; if (!eq.some(Boolean)) eq[0] = 'cannon'; recalc(); bus.emit('loadout');
}

// ---------- drones ----------
export const droneTypeOpen = (t) => DRONES[t].tier === 1 || flag('f.droneT' + DRONES[t].tier);
export const droneQuote = (t, n) => { const d = DRONES[t], lvl = G.state.run.drones.levels[t] || 1; const want = n === 'max' ? Math.max(1, geoMax(d.cost[0], d.cost[1], lvl - 1, G.state.cur.scrap)) : n === 'next' ? (nextMilestone(lvl) || lvl + 1) - lvl : n; return { n: want, cost: geoCost(d.cost[0], d.cost[1], lvl - 1, want) }; };
export function levelDrone(t, n = 1) { const q = droneQuote(t, n); if (!spend('scrap', q.cost)) return 0; const L = G.state.run.drones.levels; L[t] = (L[t] || 1) + q.n; recalc(); bus.emit('bought', 'drone', t, {}); return q.n; }
export function setBay(t, delta) {
  const bays = G.state.run.drones.bays, cap = Math.floor(G.sheet.n('droneBays'));
  if (delta > 0) { if (bays.length >= cap || !droneTypeOpen(t)) return; bays.push(t); }
  else { const i = bays.lastIndexOf(t); if (i < 0) return; bays.splice(i, 1); }
  recalc(); bus.emit('loadout');
}
/** Fit, replace or empty a specific drone bay from the central Ship Loadout. Bays stay compact because combat treats the array as the active roster. */
export function equipDroneBay(slot, type) {
  const bays = G.state.run.drones.bays, cap = Math.floor(G.sheet.n('droneBays'));
  slot = Math.max(0, Math.floor(slot)); if (slot >= cap) return false;
  if (type && !droneTypeOpen(type)) return false;
  if (!type) {
    if (slot >= bays.length) return false;
    bays.splice(slot, 1);
  } else if (slot < bays.length) bays[slot] = type;
  else if (bays.length < cap) bays.push(type);
  else return false;
  recalc(); bus.emit('loadout'); return true;
}
export function trimBays() { const b = G.state.run.drones.bays, cap = Math.floor(G.sheet.n('droneBays')); if (b.length > cap) b.length = cap; }

// ---------- abilities ----------
export const abilityOpen = (id) => Math.max(G.state.run.best, G.state.prestige.count ? G.state.stats.bestWave / 2 : 0) >= ABILITIES[id].unlock;
export function equipAbility(slot, id) { const eq = G.state.abilities.equipped; const at = eq.indexOf(id); if (id && at >= 0) eq[at] = eq[slot]; eq[slot] = id; bus.emit('loadout'); }

// ---------- progressive feature reveal ----------
const FEATURES = [
  ['arsenal', (s) => s.stats.bestWave >= 5, 'Arsenal open. Weapons level up with Scrap, and Ship Loadout is now available.'],
  ['missions', (s) => s.stats.bestWave >= 8, 'Missions available in the Menu.'],
  ['abilities', (s) => s.stats.bestWave >= 7, 'Ability unlocked: Overdrive.'],
  ['skills', (s) => s.stats.bestWave >= 8, 'Skill tree online. Ship Levels now grant points for run perks.'],
  ['research', (s) => s.stats.bestWave >= 12, 'Research lab online. Spend Research Data on new mechanics.'],
  ['modules', (s) => s.modules.inv.length > 0, 'Module recovered. It has been added to Ship Loadout.'],
  ['rewind', (s) => s.stats.bestWave >= 20, 'The Chrono Core is warming up. Rewind becomes possible at wave 30.'],
  ['drones', () => G.sheet.n('droneBays') > 0, 'Drone bays ready — open Arsenal → Drones to deploy them.'],
  ['automation', () => ['f.autoBuy', 'f.autoAbility', 'f.autoBoon', 'f.autoRewind', 'f.rules'].some(flag), 'Automation panel added to the Menu.'],
  ['challenges', (s) => s.prestige.count >= 2, 'Challenge runs unlocked in the Menu.'],
  ['relics', (s) => s.cur.frags.gt(0) || Object.keys(s.relics).length > 0, 'Relic Fragment found. Relics are permanent. See the Menu.'],
  ['alien', () => flag('f.alien'), 'Xeno laboratory open in the Menu.'],
  ['ascension', () => flag('f.ascension'), 'Something above the timeline is visible from the Rewind screen.'],
];
export function checkUnlocks() {
  const s = G.state;
  s.seen.projects ||= {};
  for (const p of PROJECTS) if ((s.stats.bestWave || 1) >= p.wave && !s.seen.projects[p.id] && !s.projects?.completed?.[p.id]) { s.seen.projects[p.id] = 1; toast(`Blueprint discovered: ${p.name}. Open Menu → Ship Projects to commission it.`, 'unlock'); bus.emit('projectRevealed', p.id); }
  for (const [id, test, msg] of FEATURES) if (!s.unlocks[id] && test(s)) {
    // Older saves could have hidden wave-clear Scrap banked before the Arsenal reveal.
    // On the one-time Arsenal unlock, start the new economy cleanly at zero.
    if (id === 'arsenal') {
      s.cur.scrap = Big.ZERO;
      if (s.stats.earned) s.stats.earned.scrap = Big.ZERO;
      if (s.run.stats.earned) s.run.stats.earned.scrap = Big.ZERO;
    }
    s.unlocks[id] = Date.now(); toast(msg, 'unlock'); bus.emit('unlock', id);
  }
  for (const id of ABILITY_ORDER) if (abilityOpen(id) && !(s.seen.abilities ||= {})[id]) {
    s.seen.abilities[id] = 1; if (id !== 'overdrive') toast(`Ability unlocked: ${ABILITIES[id].name}`, 'unlock');
    const eq = s.abilities.equipped, slots = G.sheet.n('abilitySlots'); for (let i = 0; i < slots; i++) if (!eq[i]) { eq[i] = id; break; }
    bus.emit('loadout');
  }
}
