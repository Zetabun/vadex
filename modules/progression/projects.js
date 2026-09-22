import { Big } from '@last-orbit/core/big.js';
import { G, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { PROJECTS } from '@last-orbit/data/projects.js';
import { CUR } from '@last-orbit/core/state.js';

export const projectDef = (id) => PROJECTS.find((p) => p.id === id);
export const projectRevealed = (p) => (G.state.stats.bestWave || 1) >= p.wave || !!G.state.projects?.completed?.[p.id];
export const projectComplete = (id) => !!G.state.projects?.completed?.[id];
export const projectCanBuild = (p) => projectRevealed(p) && !projectComplete(p.id) && p.costs.every(([cur,n]) => G.state.cur[cur].gte(n));
export const projectCostText = (p) => p.costs.map(([cur,n]) => `${CUR[cur]?.name || cur} ${n}`).join(' · ');

export function buildProject(id) {
  const p = projectDef(id); if (!p || !projectCanBuild(p)) return false;
  for (const [cur,n] of p.costs) G.state.cur[cur] = G.state.cur[cur].sub(Big.from(n)).max(0);
  G.state.projects.completed[p.id] = Date.now();
  if (id === 'fleet') {
    G.state.unlocks.fleet ||= Date.now(); G.state.fleet.commissioned = true;
    if (G.state.fleet.lifetime.isZero() && G.state.fleet.spent.isZero()) { G.state.fleet.supply = G.state.fleet.supply.add(25); G.state.fleet.lifetime = G.state.fleet.lifetime.add(25); }
  } else if (id === 'foundry') {
    G.state.unlocks.foundry ||= Date.now(); G.state.foundry.commissioned = true; G.state.foundry.blueprints += 4; G.state.foundry.stock.burst += 1;
  }
  toast(`${p.name} commissioned. New ship system online.`, 'unlock');
  bus.emit('project', id); bus.emit('unlock', id); return true;
}

export const projectsAttention = () => PROJECTS.some(projectCanBuild);
