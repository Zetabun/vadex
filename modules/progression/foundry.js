import { G, recalc, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { enemyReward, BAL } from '@last-orbit/data/balance.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { FOUNDRY, FOUNDRY_UPGRADES, RECIPES } from '@last-orbit/data/foundry.js';
import { gain } from '@last-orbit/progression/economy.js';

export const foundryLevel = (id) => G.state.foundry.upgrades[id] || 0;
export const foundryCost = (d) => Math.ceil(d.cost[0] * d.cost[1] ** foundryLevel(d.id));
export const foundryCycle = () => FOUNDRY.cycle / (1 + foundryLevel('fabricators') * 0.2);
export const blueprintCapacity = () => FOUNDRY.blueprintCap * 2 ** foundryLevel('archive');
export const foundryCapacity = () => FOUNDRY.stockCap + foundryLevel('racks');
export const recipeOpen = (id) => !!G.state.unlocks.foundry && RECIPES.some((r) => r.id === id && G.state.stats.bestWave >= r.wave);
export function commissionFoundry() {
  const f = G.state.foundry;
  if (!G.state.unlocks.foundry || f.commissioned) return;
  f.commissioned = true; f.blueprints += 4; f.stock.burst += 1;
}
export function foundryStatus(d) {
  if (!G.state.unlocks.foundry || (d.wave && G.state.stats.bestWave < d.wave)) return 'locked';
  return foundryLevel(d.id) >= d.max ? 'maxed' : 'open';
}
export function buyFoundryUpgrade(id) {
  const d = FOUNDRY_UPGRADES.find((d) => d.id === id);
  if (!d || foundryStatus(d) !== 'open') return false;
  const f = G.state.foundry, cost = foundryCost(d); if (f.blueprints < cost) return false;
  f.blueprints -= cost; f.upgrades[id] = foundryLevel(id) + 1;
  if (d.fx) recalc();
  bus.emit('bought', 'foundry', id, { after: f.upgrades[id] }); bus.emit('foundry'); return true;
}
export function setFoundryRecipe(id) {
  if (!recipeOpen(id)) return false;
  // The fraction complete is shared: switching lines never discards work or completes a free cycle.
  G.state.foundry.recipe = id; bus.emit('foundry'); return true;
}
export function equipSupply(id) {
  if (!recipeOpen(id)) return false;
  G.state.foundry.equipped = id; bus.emit('foundry'); return true;
}
export function setFoundryAuto(on) {
  if (!foundryLevel('dispatch')) return false;
  G.state.foundry.auto = !!on; bus.emit('foundry'); return true;
}
/** Same analytic calculation for foreground and offline time. No per-cycle loops. */
export function simulateFoundry(seconds) {
  const f = G.state.foundry;
  const elapsed = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const work = f.progress + (recipeOpen(f.recipe) ? elapsed / foundryCycle() : 0);
  const cycles = Math.floor(work + 1e-9), room = Math.max(0, foundryCapacity() - f.stock[f.recipe]);
  return { recipe: f.recipe, cycles, progress: Math.max(0, work - cycles), items: Math.min(room, cycles),
    blueprints: Math.min(Math.max(0, blueprintCapacity() - f.blueprints), cycles * (FOUNDRY.blueprints + foundryLevel('analysis'))),
    stockFull: cycles > room, archiveFull: cycles * (FOUNDRY.blueprints + foundryLevel('analysis')) > blueprintCapacity() - f.blueprints };
}
export function applyFoundryReport(r) {
  if (!r || !G.state.unlocks.foundry || !recipeOpen(r.recipe)) return;
  const f = G.state.foundry;
  f.progress = r.progress;
  f.stock[r.recipe] = Math.min(foundryCapacity(), f.stock[r.recipe] + r.items);
  f.blueprints = Math.min(blueprintCapacity(), f.blueprints + r.blueprints);
  f.lifetime += r.cycles; f.produced += r.items;
}
export function tickFoundry(seconds) { const r = simulateFoundry(seconds); applyFoundryReport(r); return r; }
export function foundryAffordable() { return FOUNDRY_UPGRADES.some((d) => foundryStatus(d) === 'open' && G.state.foundry.blueprints >= foundryCost(d)); }
export function supplyReady(id = G.state.foundry.equipped) {
  const w = G.world;
  if (!recipeOpen(id) || !w?.player.alive || w.wave.state !== 'fighting' || !(G.state.foundry.stock[id] > 0)) return false;
  if (id === 'burst') return !(w.foundryBurst > 0);
  if (id === 'repair') return w.player.hull < 0.99 || (w.base.hasShield && w.player.shield < 0.99);
  return !(w.foundrySalvageCd > 0);
}
export function useSupply(id = G.state.foundry.equipped, automatic = false) {
  if (!supplyReady(id)) return false;
  const f = G.state.foundry, w = G.world, p = w.player, quality = foundryLevel('quality'), strength = 1 + quality * 0.1;
  f.stock[id]--; f.used++;
  if (id === 'burst') { w.foundryBurst = 12 + quality * 2; w.foundryPower = 0.35 * strength; }
  else if (id === 'repair') { p.hull = Math.min(1, p.hull + 0.35 * strength); p.shield = Math.min(1, p.shield + 0.35 * strength); p.invuln = Math.max(p.invuln, 2); }
  else {
    // Current combat wave, never lifetime best: no late-game payout carried back into wave 1.
    const wave = w.wave.num, base = enemyReward(wave, sectorOf(wave).idx).mul(8 * strength);
    gain('credits', base.mul(G.sheet.b('creditGain'))); gain('scrap', base.mul(BAL.scrapShare).mul(G.sheet.b('scrapGain')));
    w.foundrySalvageCd = 15;
  }
  if (!automatic) toast(RECIPES.find((r) => r.id === id).name + ' deployed.', 'good');
  bus.emit('supplyUsed', id, automatic); bus.emit('foundry'); return true;
}
export function updateFoundryCombat(w, dt) {
  w.foundryBurst = Math.max(0, (w.foundryBurst || 0) - dt);
  w.foundrySalvageCd = Math.max(0, (w.foundrySalvageCd || 0) - dt);
  if (!G.state.foundry.auto || !foundryLevel('dispatch')) return;
  const id = G.state.foundry.equipped;
  if ((id === 'repair' && w.player.hull < 0.45) || (id === 'burst' && w.wave.boss?.alive) || id === 'salvage') useSupply(id, true);
}
