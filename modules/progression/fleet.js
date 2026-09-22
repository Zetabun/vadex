// Persistent parallel idle loop. The Recovery Fleet earns its own capped resource in real time,
// spends it on fleet upgrades, and contributes modest bonuses back into the main stat sheet.
import { Big } from '@last-orbit/core/big.js';
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { FLEET_BASE_RATE, FLEET_BASE_CAP, FLEET_CAP_GROWTH, FLEET_UPGRADES } from '@last-orbit/data/fleet.js';

const BY_ID = Object.fromEntries(FLEET_UPGRADES.map((d) => [d.id, d]));
export const fleetLevel = (id) => G.state.fleet.upgrades[id] || 0;
export const fleetCost = (d, lvl = fleetLevel(d.id)) => Big.pow(d.cost[1], lvl).mul(d.cost[0]);

export function fleetGateOpen(d) {
  const g = d.gate, s = G.state; if (!g) return true;
  if (g.wave && (s.stats.bestWave || 1) < g.wave) return false;
  if (g.rewinds && s.prestige.count < g.rewinds) return false;
  return true;
}
export function fleetReqOpen(d) { return !d.req || d.req.every(([id, lvl]) => fleetLevel(id) >= lvl); }
export function fleetStatus(d) {
  const lvl = fleetLevel(d.id);
  if (lvl >= d.max) return 'maxed';
  return fleetGateOpen(d) && fleetReqOpen(d) ? 'open' : 'locked';
}
export function fleetLockText(d) {
  if (!fleetGateOpen(d)) {
    if (d.gate.wave) return `Reach wave ${d.gate.wave}`;
    if (d.gate.rewinds) return `Rewind ${d.gate.rewinds}×`;
  }
  if (d.req) {
    const miss = d.req.find(([id, lvl]) => fleetLevel(id) < lvl);
    if (miss) return `${BY_ID[miss[0]]?.name || miss[0]} LV ${miss[1]}`;
  }
  return '';
}

export function fleetRate() {
  if (!G.state.unlocks.fleet) return 0;
  const drones = fleetLevel('drones'), scan = fleetLevel('scanners');
  const depth = 1 + Math.max(0, (G.state.stats.bestSector || 1) - 1) * 0.08;
  return FLEET_BASE_RATE * (1 + drones * 0.55) * (1 + scan * 0.18) * depth;
}
export function fleetCapacity() { return Big.from(FLEET_BASE_CAP).mul(Big.pow(FLEET_CAP_GROWTH, fleetLevel('cargo'))); }

function addSupply(amount) {
  amount = Big.from(amount); if (amount.m <= 0 || !G.state.unlocks.fleet) return Big.ZERO;
  const f = G.state.fleet, before = f.supply, after = before.add(amount).min(fleetCapacity()), gained = after.sub(before).max(0);
  if (!gained.isZero()) {
    f.supply = after; f.lifetime = f.lifetime.add(gained);
    G.state.stats.fleetSupply = Big.from(G.state.stats.fleetSupply || 0).add(gained);
  }
  return gained;
}

/** Active production uses real seconds, not game-speed multipliers. */
export function tickFleet(seconds) { return addSupply(fleetRate() * Math.max(0, seconds)); }

export function buyFleetUpgrade(id) {
  const d = BY_ID[id]; if (!G.state.unlocks.fleet || !d || fleetStatus(d) !== 'open') return false;
  const cost = fleetCost(d), f = G.state.fleet; if (!f.supply.gte(cost)) return false;
  f.supply = f.supply.sub(cost); f.upgrades[id] = fleetLevel(id) + 1; f.spent = f.spent.add(cost);
  if (d.fx) recalc();
  bus.emit('fleet', id); bus.emit('bought', 'fleet', id, { after: f.upgrades[id] });
  return true;
}
export function fleetAffordable() { return FLEET_UPGRADES.some((d) => fleetStatus(d) === 'open' && G.state.fleet.supply.gte(fleetCost(d))); }

/** Analytic fleet production for time spent away. Does not mutate state. */
export function simulateFleetOffline(seconds) {
  const f = G.state.fleet, rate = fleetRate(), cap = fleetCapacity(), room = cap.sub(f.supply).max(0), raw = Big.from(rate * Math.max(0, seconds)), earned = raw.min(room);
  return { rate, cap, before: f.supply, earned, after: f.supply.add(earned), capped: raw.gt(room) };
}
export function applyFleetOfflineReport(r) {
  if (!r || !G.state.unlocks.fleet || !r.earned || Big.from(r.earned).isZero()) return Big.ZERO;
  const f = G.state.fleet, earned = Big.from(r.earned); f.supply = Big.from(r.after).min(fleetCapacity()); f.lifetime = f.lifetime.add(earned); G.state.stats.fleetSupply = Big.from(G.state.stats.fleetSupply || 0).add(earned); return earned;
}
