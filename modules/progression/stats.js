// The stat sheet. Every system contributes modifiers as data ([stat, op, value]); this folds them into totals
// and remembers which source group contributed what, so the UI can show "where does this number come from".
//   total = (base + Σ adds) × Π group multipliers
// Sources: the ship hull, Workshop levels (permanent), and — during a sortie — cards and relics.
import { Big } from '@last-orbit/core/big.js';
import { BAL } from '@last-orbit/data/balance.js';
import { WEAPONS } from '@last-orbit/data/weapons.js';
import { MODS } from '@last-orbit/data/cards.js';
import { RELICS } from '@last-orbit/data/relics.js';
import { SHIPS } from '@last-orbit/data/ships.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { masteryFx } from '@last-orbit/data/career.js';
import { threatMods, threatSalvage } from '@last-orbit/data/threat.js';
import { MUTATOR_BY_ID } from '@last-orbit/data/daily.js';
import { ROUTE_BY_ID } from '@last-orbit/data/routes.js';
import { fusionsFor } from '@last-orbit/data/fusions.js';
import { SYNERGIES, activeTiers } from '@last-orbit/data/synergies.js';

export const STAT_BASE = {
  damage: 1, fireRate: 1, critChance: 0.03, critDmg: 1, projSpeed: 1, multishot: 0, pierce: 0, blast: 1, armorPen: 0, bossDmg: 1, eliteDmg: 1, weakMult: BAL.weakMult,
  hull: BAL.hull, hullRegen: 0, lifeSteal: 0, shieldRatio: 0, shieldRegen: 0.15, shieldDelay: BAL.shieldDelay, moveSpeed: 1, barrier: 1, barrierRegen: 0, dmgReduce: 0,
  focusMax: BAL.focusMax, focusRate: 1, comboMax: 0.5, droneDmg: 1, droneRate: 1, drones: 0, energyRegen: 2, energyCap: 100,
  abilityCd: 1, abilityPower: 1, abilityCharges: 1, aimAssist: 0, autoDodge: 0, waveHaste: 0, gameSpeed: 1,
  magnet: BAL.magnet, xpGain: 1, salvageGain: 1, rerolls: 0, startLevels: 0, cardChoices: BAL.cardChoices, revives: 0,
  'f.autofire': 1,
};
export const STAT_NAMES = { damage: 'Damage', fireRate: 'Fire rate', critChance: 'Critical chance', critDmg: 'Critical damage', hull: 'Hull', shieldRatio: 'Shield', lifeSteal: 'Lifesteal', moveSpeed: 'Speed', magnet: 'Pickup range', xpGain: 'Experience', salvageGain: 'Salvage' };
const byId = (list) => { const m = {}; for (const d of list) m[d.id] = d; return m; };
export const DEF = { mods: byId(MODS), relics: byId(RELICS), ships: byId(SHIPS), workshop: byId(WORKSHOP) };

export class Sheet {
  constructor() { this.s = {}; this.totalN = {}; this.totalB = {}; this.weapons = {}; this.version = 0; }
  _e(stat) { return this.s[stat] || (this.s[stat] = { add: {}, mul: {} }); }
  add(stat, group, v) { if (v) { const e = this._e(stat); e.add[group] = (e.add[group] || 0) + v; } }
  mul(stat, group, v) { if (v !== 1) { const e = this._e(stat); e.mul[group] = (e.mul[group] ?? 1) * v; } }
  /** Apply a data fx list `lvl` times into a group. */
  fx(list, lvl, group) {
    if (!list || lvl <= 0) return;
    for (const [stat, op, v] of list) {
      if (op === 'add') this.add(stat, group, v * lvl);
      else if (op === 'mult') this.mul(stat, group, Math.max(0.05, 1 + v * lvl));
      else if (op === 'pow') this.mul(stat, group, Math.pow(v, lvl));
    }
  }
  finish() {
    this.totalN = {}; this.totalB = {};
    for (const stat of new Set([...Object.keys(STAT_BASE), ...Object.keys(this.s)])) {
      const e = this.s[stat]; let base = STAT_BASE[stat] ?? (stat.startsWith('dmg.') ? 1 : 0);
      if (e) for (const g in e.add) base += e.add[g];
      let n = base, b = Big.from(base);
      if (e) for (const g in e.mul) { n *= e.mul[g]; b = b.mul(e.mul[g]); }
      this.totalN[stat] = n; this.totalB[stat] = b;
    }
    this.version++;
  }
  n(stat) { return this.totalN[stat] ?? STAT_BASE[stat] ?? (stat.startsWith('dmg.') ? 1 : 0); }
  b(stat) { return this.totalB[stat] ?? Big.from(STAT_BASE[stat] ?? 0); }
  f(flag) { return this.totalN[flag] || 0; }
  breakdown(stat) {
    const e = this.s[stat] || { add: {}, mul: {} }, rows = [{ group: 'Base', add: STAT_BASE[stat] ?? 0 }];
    for (const g in e.add) rows.push({ group: g, add: e.add[g] });
    for (const g in e.mul) rows.push({ group: g, mul: e.mul[g] });
    return rows;
  }
}

/** Ship to preview/fly: the active sortie's hull, or the one selected in the Hangar. */
export const activeShip = (state) => DEF.ships[state.run?.ship || state.ship] || SHIPS[0];

export function computeSheet(state, sheet = new Sheet()) {
  sheet.s = {};
  const run = state.run, ship = activeShip(state);
  sheet.fx(ship.fx, 1, 'Ship');
  const mastery = state.mastery?.[ship.id]?.level || 1; if (mastery > 1) sheet.fx(masteryFx(mastery), 1, 'Mastery');
  for (const id in state.workshop) sheet.fx(DEF.workshop[id]?.fx, state.workshop[id], 'Workshop');
  if (run) {
    for (const id in run.cards) sheet.fx(DEF.mods[id]?.fx, run.cards[id], 'Cards');
    for (const s of SYNERGIES) for (const t of activeTiers(s, run)) sheet.fx(t.fx, 1, 'Synergy');
    for (const id of run.relics) sheet.fx(DEF.relics[id]?.fx, 1, 'Relics');
    if (run.mutator) sheet.fx(MUTATOR_BY_ID[run.mutator]?.fx, 1, 'Daily');
    if (run.route) sheet.fx(ROUTE_BY_ID[run.route]?.fx, 1, 'Route');
    if (run.threat) { sheet.mul('hull', 'Threat', threatMods(run.threat).hull); sheet.mul('salvageGain', 'Threat', threatSalvage(run.threat)); }
  }
  sheet.finish();
  sheet.weapons = {};
  const order = run ? run.order : [ship.weapon];
  for (const id of order) sheet.weapons[id] = buildWeapon(id, run ? run.weapons[id] || 1 : 1, sheet, specialFx(id, run, ship));
  return sheet;
}

/** Extra evolutions beyond rank 7: the ship's signature (on its own weapon) and any fusions the weapon belongs to. */
export function specialFx(id, run, ship) {
  const out = [];
  if (run?.signature && ship?.signature && ship.weapon === id) out.push(ship.signature.fx);
  for (const f of fusionsFor(id, run)) out.push(f.fx[id]);
  return out;
}

/** Damage multiplier from weapon rank alone (evolutions add their own effects on top). */
export const rankMult = (rank) => 1 + 0.3 * (rank - 1);

/** Merge base + evolutions (one per rank above 1) + global stats into the runtime config the simulation fires from. */
export function buildWeapon(id, rank, sheet, extra = []) {
  const def = WEAPONS[id], c = { id, kind: def.kind, color: def.color, dmgMul: 1, pierce: 0, bounce: 0, splash: 0, homing: 0, split: 0, burn: 0, armorPen: 0, crit: 0, critDmg: 0, bossMul: 1, ...def.base };
  const evos = Math.max(0, Math.min(def.evo.length, rank - 1));
  const all = def.evo.slice(0, evos).map((e) => e.fx).concat(extra);
  for (const fx of all) {
    for (const k in fx) {
      if (k.endsWith('Mul') && k !== 'dmgMul' && k !== 'nthMult') { const t = k.slice(0, -3); c[t] = (c[t] || 1) * fx[k]; }
      else if (k === 'dmgMul' || k === 'bossMul') c[k] *= fx[k];
      else if (k === 'nth' || k === 'nthMult') c[k] = fx[k];
      else c[k] = (c[k] || 0) + fx[k];
    }
  }
  c.evos = evos; c.level = rank;
  const ms = sheet.n('multishot');
  if (def.multishot === 1) c.proj = (c.proj || 1) + ms; else c.dmgMul *= 1 + def.multishot * ms;
  if (c.kind === 'bolt' || c.kind === 'orb') c.pierce += sheet.n('pierce');
  if (sheet.f('f.bounceAll') && c.kind !== 'beam' && c.kind !== 'arc' && c.kind !== 'rail') c.bounce += 1;
  if (sheet.f('f.critExplode')) c.critExplode = Math.max(c.critExplode || 0, sheet.f('f.critExplode'));
  c.splash *= sheet.n('blast'); if (c.critExplode) c.critExplode *= sheet.n('blast');
  if (c.speed) c.speed *= sheet.n('projSpeed');
  c.rate *= sheet.n('fireRate');
  c.armorPen = Math.min(1, c.armorPen + sheet.n('armorPen'));
  c.levelMult = rankMult(rank);
  c.dmg = sheet.b('damage').mul(def.base.dmg * c.levelMult * c.dmgMul * sheet.n('dmg.' + id));
  c.critChance = Math.min(1, sheet.n('critChance') + c.crit);
  c.critMult = 1 + sheet.n('critDmg') + c.critDmg;
  return c;
}

/** Rough sustained damage per second of one weapon config, for readouts. */
export function weaponDps(c) {
  const hits = c.kind === 'rail' || c.kind === 'arc' || c.kind === 'beam' ? 1 : Math.max(1, c.proj || 1);
  const chain = c.kind === 'arc' ? 1 + (c.chains || 0) * 0.6 : 1, ramp = c.kind === 'beam' ? (1 + (c.ramp || 1)) / 2 : 1;
  return c.dmg.mul(c.rate * hits * chain * ramp * (1 + c.critChance * (c.critMult - 1)));
}
