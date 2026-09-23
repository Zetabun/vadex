// Persistent multi-material industry. Enemies provide raw ore by wave band; one smelter
// processes a selected recipe; finished bars must be collected until late automation.
import { Big } from '@last-orbit/core/big.js';
import { G, recalc, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { MATERIALS, MATERIAL_TIERS, MATERIAL_BY_ID, MATERIAL_UPGRADES, materialAtCalibrationLevel } from '@last-orbit/data/materials.js';
import { gain, spend } from '@last-orbit/progression/economy.js';

const BY_ID = Object.fromEntries(MATERIAL_UPGRADES.map((d) => [d.id, d]));
export const materialLevel = (id) => G.state.materials.upgrades[id] || 0;
export const smelterOwned = () => !!G.state.materials.smelter;
export const materialDef = (id) => MATERIAL_BY_ID[id] || MATERIAL_TIERS[0];
export const materialDiscovered = (id) => !!G.state.materials.discoveredOres?.[id];
export const selectedMaterial = () => materialDef(G.state.materials.selected || 'iron');
export const oreAmount = (id) => G.state.cur[materialDef(id).oreCur];
export const barAmount = (id) => G.state.cur[materialDef(id).barCur];

export function materialUpgradeRequirement(d, lvl = materialLevel(d.id)) {
  if (d.dynamicMaterial) {
    const mat = materialAtCalibrationLevel(lvl), within = lvl % MATERIALS.calibrationPerMaterial;
    return { mat, cur: mat.barCur, amount: 1 + within };
  }
  const mat = materialDef(d.bar || 'iron');
  return { mat, cur: mat.barCur, amount: Math.max(1, Math.ceil(d.cost[0] * d.cost[1] ** lvl)) };
}
export const materialCost = (d, lvl = materialLevel(d.id)) => materialUpgradeRequirement(d, lvl).amount;
export const smeltCycle = (id = G.state.materials.runningMaterial || G.state.materials.selected || 'iron') => materialDef(id).smeltTime / MATERIALS.smeltSpeedGrowth ** materialLevel('furnace');
export const orePerBar = (id = G.state.materials.selected || 'iron') => materialDef(id).orePerBar;
export function materialUpgradeOpen(d) {
  if (!smelterOwned() || (d.wave && (G.state.stats.bestWave || 1) < d.wave) || (d.req && materialLevel(d.req) <= 0)) return false;
  const req = materialUpgradeRequirement(d);
  return materialDiscovered(req.mat.id);
}
export const oreRate = () => materialLevel('extractor') > 0 ? MATERIALS.baseMineRate * MATERIALS.mineRateGrowth ** materialLevel('extractorRate') : 0;

function discover(id) {
  const mat = materialDef(id), m = G.state.materials; m.discoveredOres ||= {};
  if (m.discoveredOres[mat.id]) return false;
  m.discovered = true; m.discoveredOres[mat.id] = true;
  if (!m.selected || !materialDiscovered(m.selected)) m.selected = mat.id;
  const first = mat.id === 'iron';
  // Fresh onboarding owns the first-Iron explanation as a serialized blocking briefing, so do not
  // stack an unlock toast behind another tutorial message. Skipped/completed tutorials keep the toast.
  if (!(first && G.state.onboarding?.enabled && !G.state.onboarding?.completed)) {
    toast(first ? `${mat.name} Ore recovered. ${mat.orePerBar} Ore can be smelted into 1 ${mat.name} Bar. Smelting added to the Menu.` : `${mat.name} Ore discovered. New smelting recipe available.`, 'unlock');
  }
  bus.emit('materialsDiscovered', mat.id); bus.emit('materials'); return true;
}

export function selectMaterial(id) {
  if (!materialDiscovered(id)) return false;
  G.state.materials.selected = id; bus.emit('materials'); return true;
}

/** Whole raw units only. */
export function awardMaterialOre(id, amount = 1) {
  const mat = materialDef(id); amount = Math.max(0, Math.floor(amount)); if (!amount) return 0;
  discover(mat.id); gain(mat.oreCur, amount);
  const m = G.state.materials; m.lifetimeOre = Big.from(m.lifetimeOre || 0).add(amount); m.lifetimeOreBy ||= {};
  m.lifetimeOreBy[mat.id] = Big.from(m.lifetimeOreBy[mat.id] || 0).add(amount);
  bus.emit('materials'); return amount;
}
export const awardIronOre = (amount = 1) => awardMaterialOre('iron', amount); // legacy/public compatibility

export function buySmelter() {
  const m = G.state.materials;
  if (!m.discovered || m.smelter || !G.state.cur.credits.gte(MATERIALS.basicSmelterCost) || !G.state.cur.ore.gte(MATERIALS.basicSmelterOreCost)) return false;
  spend('credits', MATERIALS.basicSmelterCost); spend('ore', MATERIALS.basicSmelterOreCost);
  m.smelter = true; m.running = false; m.runningMaterial = null; m.progress = 0; m.readyBars ||= 0; m.readyMaterial ||= null;
  toast('Basic Smelter installed. Choose a discovered ore, load a batch, then collect the finished bar.', 'unlock');
  bus.emit('bought', 'materials', 'smelter', {}); bus.emit('materials'); return true;
}

export function startSmelt(id = G.state.materials.selected || 'iron') {
  const mat = materialDef(id), m = G.state.materials;
  if (!materialDiscovered(mat.id) || !m.smelter || m.running || (m.readyBars || 0) > 0 || !spend(mat.oreCur, mat.orePerBar)) return false;
  m.selected = mat.id; m.running = true; m.runningMaterial = mat.id; m.progress = 0; m.batchesStarted = (m.batchesStarted || 0) + 1;
  bus.emit('materials'); return true;
}

export function collectBars() {
  const m = G.state.materials, n = Math.max(0, Math.floor(m.readyBars || 0)), id = m.readyMaterial || m.runningMaterial || m.selected || 'iron'; if (!n) return 0;
  const mat = materialDef(id); m.readyBars = 0; m.readyMaterial = null; gain(mat.barCur, n);
  m.lifetimeBars = Big.from(m.lifetimeBars || 0).add(n); m.lifetimeBarsBy ||= {}; m.lifetimeBarsBy[mat.id] = Big.from(m.lifetimeBarsBy[mat.id] || 0).add(n); m.barsProduced = (m.barsProduced || 0) + n;
  toast(`${n} ${mat.name} Bar${n === 1 ? '' : 's'} collected.`, 'good'); bus.emit('materials'); return n;
}

/**
 * Pure real-time report. extraOres are literal raw materials earned by offline combat.
 * One shared smelter means only the selected/running recipe can process during the interval.
 */
export function simulateMaterials(seconds, extraOres = {}) {
  const m = G.state.materials, elapsed = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const selected = materialDef(m.selected || 'iron'), extractId = selected.id, rate = oreRate();
  const mineWork = (m.mineProgress || 0) + elapsed * rate, passiveOre = Math.max(0, Math.floor(mineWork + 1e-9)), mineProgress = Math.max(0, mineWork - passiveOre);
  const extra = {}; for (const [id, n] of Object.entries(extraOres || {})) { const q = Math.max(0, Math.floor(Number(n) || 0)); if (q) extra[id] = q; }
  let running = !!m.running, runningMaterial = m.runningMaterial || (running ? selected.id : null), progress = Math.max(0, Number(m.progress) || 0);
  let ready = Math.max(0, Math.floor(m.readyBars || 0)), readyMaterial = m.readyMaterial || null, completed = 0, barsCollected = 0, barsCollectedMaterial = null, left = elapsed;
  const autoLoad = materialLevel('autoLoad') > 0, autoCollect = materialLevel('autoCollect') > 0;
  const selectedOre = selected.oreCur, availableBase = G.state.cur[selectedOre].toNumber();
  let available = availableBase + (extra[selected.id] || 0) + passiveOre, oreSpent = 0;
  if (!Number.isFinite(available)) available = 1e300;

  const collectReady = () => { if (autoCollect && ready > 0) { barsCollected += ready; barsCollectedMaterial = readyMaterial; ready = 0; readyMaterial = null; } };
  const finishCurrent = () => { const id = runningMaterial || selected.id; running = false; runningMaterial = null; progress = 0; ready += 1; readyMaterial = id; completed += 1; collectReady(); };
  collectReady();

  if (running) {
    const cycle = smeltCycle(runningMaterial), rem = Math.max(0, cycle - progress);
    if (left + 1e-9 >= rem) { left = Math.max(0, left - rem); finishCurrent(); }
    else { progress += left; left = 0; }
  }

  if (m.smelter && autoLoad && ready === 0 && left > 0) {
    const cycle = smeltCycle(selected.id), need = selected.orePerBar;
    if (autoCollect) {
      const oreLeft = Math.max(0, available - oreSpent), byOre = Math.floor(oreLeft / need), byTime = Math.floor(left / cycle + 1e-9), n = Math.max(0, Math.min(byOre, byTime));
      if (n) { oreSpent += n * need; completed += n; barsCollected += n; barsCollectedMaterial = selected.id; left = Math.max(0, left - n * cycle); }
      if (left > 0 && available - oreSpent >= need) { oreSpent += need; running = true; runningMaterial = selected.id; progress = Math.min(cycle, left); left = 0; }
    } else if (available - oreSpent >= need) {
      oreSpent += need; running = true; runningMaterial = selected.id; progress = 0;
      if (left + 1e-9 >= cycle) { left -= cycle; finishCurrent(); } else { progress = left; left = 0; }
    }
  }

  return { rate, passiveOre, extractId, extraOres: extra, oreSpent, oreSpentMaterial: selected.id, completed, barsCollected, barsCollectedMaterial, running, runningMaterial, progress, readyBars: ready, readyMaterial, mineProgress };
}

export function applyMaterialsReport(r) {
  if (!r) return r; const m = G.state.materials; let changed = false;
  for (const [id, n0] of Object.entries(r.extraOres || {})) { const n = Math.max(0, Math.floor(n0 || 0)); if (n) { awardMaterialOre(id, n); changed = true; } }
  if (r.passiveOre > 0) { awardMaterialOre(r.extractId || m.selected || 'iron', r.passiveOre); changed = true; }
  if (r.oreSpent > 0) { const mat = materialDef(r.oreSpentMaterial); spend(mat.oreCur, r.oreSpent); changed = true; }
  if (r.barsCollected > 0) {
    const mat = materialDef(r.barsCollectedMaterial || m.selected || 'iron'); gain(mat.barCur, r.barsCollected);
    m.lifetimeBars = Big.from(m.lifetimeBars || 0).add(r.barsCollected); m.lifetimeBarsBy ||= {}; m.lifetimeBarsBy[mat.id] = Big.from(m.lifetimeBarsBy[mat.id] || 0).add(r.barsCollected); m.barsProduced = (m.barsProduced || 0) + r.barsCollected; changed = true;
  }
  m.running = !!r.running; m.runningMaterial = r.runningMaterial || null; m.progress = r.progress || 0; m.readyBars = Math.max(0, Math.floor(r.readyBars || 0)); m.readyMaterial = r.readyMaterial || null; m.mineProgress = r.mineProgress || 0;
  if (r.completed > 0 && r.barsCollected <= 0 && m.readyBars > 0) { const mat = materialDef(m.readyMaterial); toast(`Smelting complete. ${m.readyBars} ${mat.name} Bar${m.readyBars === 1 ? '' : 's'} ready to collect.`, 'good'); changed = true; }
  if (changed || r.completed > 0) bus.emit('materials'); return r;
}

export function tickMaterials(seconds) { const r = simulateMaterials(seconds); applyMaterialsReport(r); return r; }

export function buyMaterialUpgrade(id) {
  const d = BY_ID[id]; if (!d || !materialUpgradeOpen(d)) return false;
  const lvl = materialLevel(id); if (lvl >= d.max) return false;
  const req = materialUpgradeRequirement(d, lvl); if (!spend(req.cur, req.amount)) return false;
  G.state.materials.upgrades[id] = lvl + 1;
  recalc();
  bus.emit('bought', 'materials', id, { after: lvl + 1 }); bus.emit('materials'); return true;
}

export function materialsAffordable() {
  const s = G.state, m = s.materials; if (!m.discovered) return false;
  if (!m.smelter) return s.cur.credits.gte(MATERIALS.basicSmelterCost);
  if ((m.readyBars || 0) > 0) return true;
  if (!m.running) { const mat = selectedMaterial(); if (s.cur[mat.oreCur].gte(mat.orePerBar)) return true; }
  return MATERIAL_UPGRADES.some((d) => { if (!materialUpgradeOpen(d) || materialLevel(d.id) >= d.max) return false; const q = materialUpgradeRequirement(d); return s.cur[q.cur].gte(q.amount); });
}
export function materialsSignature() {
  const s = G.state, m = s.materials, stocks = MATERIAL_TIERS.map((x) => `${s.cur[x.oreCur].floor()}:${s.cur[x.barCur].floor()}:${materialDiscovered(x.id) ? 1 : 0}`).join(',');
  // Keep high-frequency progress out of the structural signature. The open Smelting screen
  // already updates its timer/gauge in place at the UI refresh cadence; including progress here
  // made Menu tear down and recreate the entire screen several times a second, which visibly
  // flickered the disabled "Smelting in progress" control.
  return [stocks, m.smelter ? 1 : 0, m.selected || '', m.running ? 1 : 0, m.runningMaterial || '', m.readyBars || 0, m.readyMaterial || '', ...MATERIAL_UPGRADES.map((d) => materialLevel(d.id)), s.stats.bestWave || 1].join('|');
}
