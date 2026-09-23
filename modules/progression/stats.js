// The stat sheet. Every system contributes modifiers as data ([stat, op, value]); this folds them into totals
// and remembers which source group contributed what, so the UI can show "where does this number come from".
//   total = (base + Σ adds) × Π group multipliers
import { Big } from '@last-orbit/core/big.js';
import { BAL, milestonesReached } from '@last-orbit/data/balance.js';
import { UPGRADES } from '@last-orbit/data/upgrades.js';
import { RESEARCH } from '@last-orbit/data/research.js';
import { PRESTIGE, ASCENSION } from '@last-orbit/data/prestige.js';
import { RELICS, ALIEN } from '@last-orbit/data/relics.js';
import { BOONS } from '@last-orbit/data/boons.js';
import { ACHIEVEMENTS, CHALLENGES } from '@last-orbit/data/goals.js';
import { WEAPONS, EVO_LEVELS, weaponLevelMult } from '@last-orbit/data/weapons.js';
import { DRONES } from '@last-orbit/data/drones.js';
import { MODULE_TYPES, MODULE_SPECIALS, MODULE_SETS, RARITIES } from '@last-orbit/data/modules.js';
import { FOUNDRY_UPGRADES } from '@last-orbit/data/foundry.js';
import { FLEET_UPGRADES } from '@last-orbit/data/fleet.js';
import { levelFromXp, levelBonuses } from '@last-orbit/data/experience.js';
import { SKILLS } from '@last-orbit/data/skills.js';
import { MATERIAL_UPGRADES } from '@last-orbit/data/materials.js';

export const STAT_BASE = {
  damage: 1, fireRate: 1, critChance: 0.02, critDmg: 1, projSpeed: 1, multishot: 0, pierce: 0, blast: 1, armorPen: 0, bossDmg: 1, eliteDmg: 1, weakMult: BAL.weakMult,
  hull: BAL.hull, hullRegen: 0, lifeSteal: 0, shieldRatio: 0, shieldRegen: 0.12, shieldDelay: BAL.shieldDelay, moveSpeed: 1, barrier: 1, barrierRegen: 0, dmgReduce: 0,
  creditGain: 1, scrapChance: BAL.scrapChance, scrapGain: 1, dataGain: 1, matterGain: 1, coreGain: 1, coreBonus: 0, shardGain: 1, missionGain: 1, haulerChance: 0.03, luck: 0,
  focusMax: BAL.focusMax, focusRate: 1, comboMax: 0.5, droneDmg: 1, droneRate: 1, droneBays: 0, energyRegen: 2, energyCap: 100,
  abilityCd: 1, abilityPower: 1, abilitySlots: 2, abilityCharges: 1, weaponSlots: 1, moduleSlots: 0,
  offlineEff: BAL.offlineEff, offlineCap: BAL.offlineCapH, startWave: 0, startCredits: 0, boonChoices: 3, boonEvery: BAL.boonEvery, aimAssist: 0, autoDodge: 0, waveHaste: 0, gameSpeed: 1,
};
export const STAT_NAMES = { damage: 'Weapon damage', fireRate: 'Fire rate', critChance: 'Critical chance', critDmg: 'Critical damage', hull: 'Hull', lifeSteal: 'Lifesteal', shieldRatio: 'Shield (× hull)', creditGain: 'Credit gain', scrapGain: 'Scrap gain', dataGain: 'Data gain', droneDmg: 'Drone damage', bossDmg: 'Boss damage', shardGain: 'Shard gain', offlineEff: 'Offline efficiency', moveSpeed: 'Move speed', blast: 'Blast radius', matterGain: 'Alien Matter gain', abilityPower: 'Ability power', abilityCd: 'Ability cooldown', eliteDmg: 'Elite damage', energyRegen: 'Energy per second' };
const ENERGY_WEAPONS = { laser: 1, tesla: 1, plasma: 1, prism: 1 };
const byId = (list) => { const m = {}; for (const d of list) m[d.id] = d; return m; };
export const DEF = { upgrades: byId(UPGRADES), research: byId(RESEARCH), prestige: byId(PRESTIGE), asc: byId(ASCENSION), relics: byId(RELICS), alien: byId(ALIEN), boons: byId(BOONS), ach: byId(ACHIEVEMENTS), challenges: byId(CHALLENGES), specials: byId(MODULE_SPECIALS) };

export class Sheet {
  constructor() { this.s = {}; this.totalN = {}; this.totalB = {}; this.weapons = {}; this.drones = {}; this.version = 0; }
  _e(stat) { return this.s[stat] || (this.s[stat] = { add: {}, mul: {} }); }
  add(stat, group, v) { if (v) { const e = this._e(stat); e.add[group] = (e.add[group] || 0) + v; } }
  mul(stat, group, v) { if (v !== 1) { const e = this._e(stat); e.mul[group] = (e.mul[group] ?? 1) * v; } }
  /** Apply a data fx list at a level into a group. */
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

/** level → stat contribution for a credit upgrade (also used by the UI for "current → next") */
export function upgradeValue(def, lvl) {
  const ms = def.noMs ? 0 : milestonesReached(lvl);
  if (def.type === 'mult') return (1 + def.per * lvl) * Math.pow(def.ms || 1, ms);
  if (def.type === 'add') return def.per * lvl + (def.msAdd || 0) * ms;
  return lvl > 0 ? 1 : 0;
}

export function moduleScale(mod) { return RARITIES[mod.rarity].mult * (1 + 0.15 * (mod.level - 1)); }
function applyModuleFx(sheet, [stat, op, v], scale) {
  if (op === 'add') sheet.add(stat, 'Modules', v * scale);
  else if (op === 'pow') sheet.mul(stat, 'Modules', 1 + v * scale);
  else sheet.mul(stat, 'Modules', Math.max(0.3, 1 + v * scale));
}
export function equippedModules(state) {
  const out = [];
  for (const slot in state.modules.equipped) { const m = state.modules.inv.find((x) => x.id === state.modules.equipped[slot]); if (m) out.push(m); }
  return out;
}

export function computeSheet(state, sheet = new Sheet()) {
  sheet.s = {};
  const run = state.run;
  for (const id in run.upgrades) {
    const d = DEF.upgrades[id], lvl = run.upgrades[id]; if (!d || !lvl) continue;
    if (d.type === 'mult') sheet.mul(d.stat, 'Upgrades', upgradeValue(d, lvl));
    else sheet.add(d.stat, 'Upgrades', upgradeValue(d, lvl));
    if (d.special) for (const l in d.special) if (lvl >= +l) sheet.fx(d.special[l].fx, 1, 'Upgrades');
  }
  for (const id in run.research) sheet.fx(DEF.research[id]?.fx, run.research[id], 'Research');
  for (const skill of SKILLS) sheet.fx(skill.fx, Math.max(0, Math.min(skill.max, Math.floor(Number(run.skills?.[skill.id]) || 0))), 'Skills');
  for (const upgrade of MATERIAL_UPGRADES) if (upgrade.fx) sheet.fx(upgrade.fx, Math.max(0, Math.min(upgrade.max, Number(state.materials?.upgrades?.[upgrade.id]) || 0)), 'Refined materials');
  for (const id in state.prestige.tree) sheet.fx(DEF.prestige[id]?.fx, state.prestige.tree[id], 'Rewind tree');
  for (const id in state.asc.tree) sheet.fx(DEF.asc[id]?.fx, state.asc.tree[id], 'Ascension');
  for (const id in state.relics) sheet.fx(DEF.relics[id]?.fx, state.relics[id], 'Relics');
  for (const id in state.alien) sheet.fx(DEF.alien[id]?.fx, state.alien[id], 'Alien tech');
  for (const id in run.boons) sheet.fx(DEF.boons[id]?.fx, run.boons[id], 'Boons');
  for (const p of run.picks) sheet.fx(p.fx, 1, 'Anomalies');
  for (const id in state.ach) sheet.fx(DEF.ach[id]?.fx, 1, 'Achievements');
  for (const id in state.challenges.done) sheet.fx(DEF.challenges[id]?.reward.fx, 1, 'Challenges');
  for (const d of FLEET_UPGRADES) sheet.fx(d.fx, state.fleet?.upgrades?.[d.id] || 0, 'Recovery Fleet');
  for (const d of FOUNDRY_UPGRADES) sheet.fx(d.fx, state.foundry?.upgrades?.[d.id] || 0, 'Orbital Foundry');
  const xpLevel = levelFromXp(run.xp || 0), xpBonus = levelBonuses(xpLevel);
  sheet.mul('damage', 'Ship level', xpBonus.damage);
  sheet.mul('hull', 'Ship level', xpBonus.hull);
  if (run.challenge) sheet.fx(DEF.challenges[run.challenge]?.mods, 1, 'Challenge rules');
  // shards held give a small passive bonus so banking them is never wasted
  const held = state.cur.shards.log10(); if (held > 0) sheet.mul('damage', 'Shards held', 1 + held * 0.25);
  // modules
  const sets = {};
  for (const m of equippedModules(state)) {
    const sc = moduleScale(m);
    applyModuleFx(sheet, MODULE_TYPES[m.type].primary, sc);
    for (const mm of m.mods) applyModuleFx(sheet, mm, sc);
    if (m.special) sheet.fx(DEF.specials[m.special]?.fx, 1, 'Modules');
    if (m.set) sets[m.set] = (sets[m.set] || 0) + 1;
  }
  for (const s in sets) { if (sets[s] >= 2) sheet.fx(MODULE_SETS[s].two.fx, 1, 'Module sets'); if (sets[s] >= 4) sheet.fx(MODULE_SETS[s].four.fx, 1, 'Module sets'); }
  // collector drones feed the economy
  const bays = run.drones.bays, nCol = bays.filter((t) => t === 'collect').length;
  if (nCol) { const g = 1 + nCol * (DRONES.collect.gain + 0.04 * ((run.drones.levels.collect || 1) - 1)); sheet.mul('creditGain', 'Drones', g); sheet.mul('scrapGain', 'Drones', g); }
  // weapon link research: each other equipped weapon boosts damage
  sheet.finish();
  const eq = run.equipped.filter(Boolean);
  if (sheet.f('f.weaponLink') && eq.length > 1) { sheet.mul('damage', 'Weapon link', 1 + sheet.f('f.weaponLink') * (eq.length - 1)); sheet.finish(); }
  sheet.weapons = {};
  for (const id of eq) sheet.weapons[id] = buildWeapon(id, run.weapons[id] || 1, sheet);
  return sheet;
}

/** Merge base + evolutions + global stats into the runtime config the simulation fires from. */
export function buildWeapon(id, lvl, sheet) {
  const def = WEAPONS[id], c = { id, kind: def.kind, color: def.color, dmgMul: 1, pierce: 0, bounce: 0, splash: 0, homing: 0, split: 0, burn: 0, armorPen: 0, crit: 0, critDmg: 0, bossMul: 1, ...def.base };
  let evos = 0;
  for (let i = 0; i < EVO_LEVELS.length; i++) if (lvl >= EVO_LEVELS[i]) {
    evos++;
    const fx = def.evo[i].fx;
    for (const k in fx) {
      if (k.endsWith('Mul') && k !== 'dmgMul' && k !== 'nthMult') { const t = k.slice(0, -3); c[t] = (c[t] || 1) * fx[k]; }
      else if (k === 'dmgMul' || k === 'bossMul') c[k] *= fx[k];
      else if (k === 'nth' || k === 'nthMult') c[k] = fx[k];
      else c[k] = (c[k] || 0) + fx[k];
    }
  }
  c.evos = evos; c.level = lvl;
  const ms = sheet.n('multishot');
  if (def.multishot === 1) c.proj = (c.proj || 1) + ms; else c.dmgMul *= 1 + def.multishot * ms;
  if (c.kind === 'bolt' || c.kind === 'orb' || c.kind === 'missile') c.pierce += c.kind === 'missile' ? 0 : sheet.n('pierce');
  if (sheet.f('f.bounceAll') && c.kind !== 'beam' && c.kind !== 'arc' && c.kind !== 'rail') c.bounce += 1;
  if (id === 'missile') { c.split += sheet.f('f.missileSplit'); if (sheet.f('f.retargetAll')) c.retarget = 1; }
  if (sheet.f('f.critExplode')) c.critExplode = Math.max(c.critExplode || 0, sheet.f('f.critExplode'));
  if (ENERGY_WEAPONS[id] && sheet.f('f.shieldPierce')) c.shieldPierce = 1;
  c.splash *= sheet.n('blast'); if (c.critExplode) c.critExplode *= sheet.n('blast');
  if (c.speed) c.speed *= sheet.n('projSpeed');
  c.rate *= sheet.n('fireRate');
  c.armorPen = Math.min(1, c.armorPen + sheet.n('armorPen'));
  c.levelMult = weaponLevelMult(lvl, milestonesReached(lvl));
  c.dmg = sheet.b('damage').mul(def.base.dmg * c.levelMult * c.dmgMul * sheet.n('dmg.' + id));
  c.critChance = Math.min(1, sheet.n('critChance') + c.crit);
  c.critMult = 1 + sheet.n('critDmg') + c.critDmg;
  return c;
}
