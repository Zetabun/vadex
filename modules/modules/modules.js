// Ship modules: generation, fitting, salvage, forging and tuning. Kept deliberately low-friction:
// one tap to fit, "fit best" for everything, auto-salvage by rarity, and the inventory never blocks a drop.
import { Big } from '@last-orbit/core/big.js';
import { G, recalc, flag, toast, count, maxStat } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { rand } from '@last-orbit/core/rng.js';
import { BAL } from '@last-orbit/data/balance.js';
import { RARITIES, MODULE_TYPES, MODULE_SLOTS, MODULE_MODS, MODULE_SPECIALS, MODULE_SETS, MODULE_NAMES, MODULE_PREFIX } from '@last-orbit/data/modules.js';
import { moduleScale } from '@last-orbit/progression/stats.js';
import { gain, spend, can, checkUnlocks } from '@last-orbit/progression/economy.js';

const pick = (a) => a[Math.floor(rand() * a.length)];
export function rollRarity(min = 0, bonus = 0) {
  const luck = G.sheet.n('luck') + bonus + ((G.state.stats.bestSector || 1) - 1) * 0.12; let tot = 0; const ws = [];
  for (const r of RARITIES) { let w = r.id < min ? 0 : r.w * Math.pow(1 + luck, r.id); if (r.id === 5 && (G.state.stats.bestSector || 1) >= 5) w = 0.08 * Math.pow(1 + luck, 3); ws.push(w); tot += w; }
  if (tot <= 0) return min; let x = rand() * tot; for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x <= 0) return i; } return min;
}
export function generateModule(min = 0, bonus = 0, type) {
  const st = G.state, rarity = rollRarity(min, bonus), R = RARITIES[rarity];
  type = type || (rand() < 0.1 && G.sheet.n('moduleSlots') > 0 ? 'experimental' : pick(MODULE_SLOTS));
  const mods = [], pool = MODULE_MODS.slice();
  for (let i = 0; i < R.mods && pool.length; i++) { const m = pool.splice(Math.floor(rand() * pool.length), 1)[0]; mods.push([m[0], m[1], m[2] * (0.8 + rand() * 0.4)]); }
  const m = { id: st.modules.nextId++, type, rarity, level: 1, mods, set: rarity >= 1 && rand() < 0.4 ? pick(Object.keys(MODULE_SETS)) : null, special: R.special && rand() < R.special ? pick(MODULE_SPECIALS).id : null, locked: false, isNew: true };
  m.name = `${MODULE_PREFIX[rarity]} ${m.set ? MODULE_SETS[m.set].name + ' ' : ''}${pick(MODULE_NAMES[type])}`;
  return m;
}

/** Add a module to the inventory, honouring auto-salvage and the cap. Returns the module, or null if it was salvaged. */
export function grantModule(min = 0, bonus = 0, type) {
  const st = G.state, m = generateModule(min, bonus, type); count('modulesFound'); if (m.rarity >= 4) maxStat('legendary', 1);
  if (flag('f.autoSalvage') && m.rarity < st.auto.salvageBelow) { salvageValue(m, true); return null; }
  st.modules.inv.push(m);
  if (st.modules.inv.length > BAL.invCap) { const eq = new Set(Object.values(st.modules.equipped)); const junk = st.modules.inv.filter((x) => !eq.has(x.id) && !x.locked && x !== m).sort((a, b) => score(a) - score(b))[0]; if (junk) salvage(junk.id, true); }
  // an empty slot is always an upgrade: fit it automatically so the first module "just works"
  const slot = freeSlotFor(m); if (slot) { st.modules.equipped[slot] = m.id; recalc(); }
  toast(`Module recovered: ${m.name} (${RARITIES[m.rarity].name})`, m.rarity >= 3 ? 'epic' : 'good'); checkUnlocks(); bus.emit('modules');
  return m;
}
export const allSlots = () => { const out = MODULE_SLOTS.slice(); for (let i = 0, n = Math.floor(G.sheet.n('moduleSlots')); i < n; i++) out.push('exp' + i); return out; };
export const slotAccepts = (slot, m) => slot.startsWith('exp') ? true : m.type === slot;
function freeSlotFor(m) { const eq = G.state.modules.equipped; for (const s of allSlots()) if (!eq[s] && slotAccepts(s, m) && (m.type === 'experimental' ? s.startsWith('exp') : !s.startsWith('exp'))) return s; return null; }
export const score = (m) => moduleScale(m) * (1 + m.mods.length * 0.25 + (m.special ? 0.6 : 0) + (m.set ? 0.2 : 0));
export const getModule = (id) => G.state.modules.inv.find((m) => m.id === id);
export const equippedSlotOf = (id) => { const eq = G.state.modules.equipped; for (const s in eq) if (eq[s] === id) return s; return null; };

export function equipModule(id, slot) {
  const st = G.state, m = getModule(id); if (!m) return false;
  if (!slot) { const own = allSlots().filter((s) => slotAccepts(s, m)); slot = own.find((s) => !st.modules.equipped[s] && !s.startsWith('exp')) || own.find((s) => !st.modules.equipped[s]) || own[0]; }
  if (!slot || !slotAccepts(slot, m)) return false;
  const was = equippedSlotOf(id); if (was) delete st.modules.equipped[was];
  st.modules.equipped[slot] = id; m.isNew = false; recalc(); bus.emit('modules'); bus.emit('bought', 'module', id, {}); return true;
}
export function unequipModule(slot) { delete G.state.modules.equipped[slot]; recalc(); bus.emit('modules'); }
export function fitBest() {
  const st = G.state, used = new Set(); st.modules.equipped = {};
  for (const slot of allSlots()) { const best = st.modules.inv.filter((m) => !used.has(m.id) && slotAccepts(slot, m) && (slot.startsWith('exp') || m.type !== 'experimental')).sort((a, b) => score(b) - score(a))[0]; if (best) { st.modules.equipped[slot] = best.id; used.add(best.id); } }
  recalc(); bus.emit('modules');
}

function salvageValue(m, pay) {
  const w = G.world, scrap = (w ? w.base.reward : Big.ONE).mul(BAL.scrapShare * 25 * RARITIES[m.rarity].mult * m.level).mul(G.sheet.b('scrapGain')), cores = RARITIES[m.rarity].salvage + Math.floor((m.level - 1) / 2);
  if (pay) { gain('scrap', scrap); if (cores) gain('cores', cores); count('salvaged'); }
  return { scrap, cores };
}
export const salvageQuote = (m) => salvageValue(m, false);
export function salvage(id, silent) {
  const st = G.state, i = st.modules.inv.findIndex((m) => m.id === id); if (i < 0) return false; const m = st.modules.inv[i]; if (m.locked) return false;
  const slot = equippedSlotOf(id); if (slot) delete st.modules.equipped[slot];
  salvageValue(m, true); st.modules.inv.splice(i, 1); recalc(); if (!silent) bus.emit('modules'); return true;
}
export function salvageAllBelow(rarity) { const st = G.state, eq = new Set(Object.values(st.modules.equipped)); let n = 0; for (const m of st.modules.inv.slice()) if (m.rarity < rarity && !eq.has(m.id) && !m.locked) { salvage(m.id, true); n++; } bus.emit('modules'); return n; }
export function toggleLock(id) { const m = getModule(id); if (m) { m.locked = !m.locked; bus.emit('modules'); } }

// ---------- forge & tuning (Engineering research) ----------
export const FORGE_COST = 3;
export function forge(type) { if (!flag('f.craft') || !spend('cores', FORGE_COST)) return null; count('forged'); return grantModule(1, 0.5, type); }
export const maxModuleLevel = (m) => 5 + m.rarity * 3;
export function tuneCost(m) { return { cores: Big.from(Math.ceil(m.level * (1 + m.rarity * 0.5))), scrap: Big.pow(2.6, m.level).mul(2000 * RARITIES[m.rarity].mult) }; }
export function tune(id) {
  const m = getModule(id); if (!m || !flag('f.fuse') || m.level >= maxModuleLevel(m)) return false;
  const c = tuneCost(m); if (!can('cores', c.cores) || !can('scrap', c.scrap)) return false;
  spend('cores', c.cores); spend('scrap', c.scrap); m.level++; count('tuned'); recalc(); bus.emit('modules'); bus.emit('bought', 'module', id, {}); return true;
}

// ---------- drops ----------
bus.on('grantModule', (min, bonus) => grantModule(min, bonus));
bus.on('bossLoot', (w, boss, def) => {
  const st = G.state, first = !st.modules.inv.length && !st.stats.modulesFound;
  if (def.mini) { if (first || rand() < 0.4 + G.sheet.n('luck') * 0.2) grantModule(first ? 1 : 0, 0); }
  else { grantModule(Math.min(3, 1 + Math.floor(w.base.sectorIdx / 2)), 0.5); gain('frags', 1 + (rand() < 0.35 ? 1 : 0)); }
});
bus.on('waveCleared', (w, info) => { if (info.kind === 'elite' && rand() < 0.12 + G.sheet.n('luck') * 0.1) grantModule(0, 0); if (G.state.modules.inv.length) maxStat('fullModules', Object.keys(G.state.modules.equipped).length >= 7 ? 1 : 0); });
