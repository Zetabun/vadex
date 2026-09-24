// Deep Void probe: a late-game pilot (Workshop maxed, everything unlocked) warps to sector 6 and flies until destroyed.
// Reports how far past wave 60 it gets and what the Deep Void paid, with anomalies off, picked at random, or with a
// forced first anomaly (to measure each one on its own; later picks are random).
// Usage: node --experimental-loader ./tests/loader.mjs ./tests/void-sim.mjs [runs] [dodge] [off|random|<anomaly id>] [seed] [save.json]
//   save.json: a late-game pilot saved by progression-sim (SNAP=file); without it, a maxed Workshop warps to sector 6.
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState, withDefaults } from '@last-orbit/core/state.js';
import { readFileSync } from 'node:fs';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, nextRoute, pickRoute, nextAnomaly, pickAnomaly } from '@last-orbit/progression/run.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { WEAPON_ORDER } from '@last-orbit/data/weapons.js';
import { ABILITY_ORDER } from '@last-orbit/data/abilities.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { TICK } from '@last-orbit/data/balance.js';

const runs = Number(process.argv[2] || 20), dodge = Number(process.argv[3] ?? 1), mode = process.argv[4] || 'random', seed0 = Number(process.argv[5] || 1), snap = process.argv[6] ? readFileSync(process.argv[6], 'utf8') : null;
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = dodge; });
const score = (c) => c.kind === 'upgrade' ? 10 + (c.rank >= 4 ? 2 : 0) : c.kind === 'weapon' ? 9 : c.kind === 'mod' ? ({ m_dmg: 8, m_rate: 8, m_multi: 9, m_hull: 6, m_shield: 5, m_crit: 5, m_critd: 4 }[c.id] || 3) : 2;

const rows = [];
for (let r = 0; r < runs; r++) {
  if (snap) { G.state = withDefaults(JSON.parse(snap), newState()); G.state.warp = 1; }
  else {
    G.state = newState(); G.state.meta.legacyChecked = true;
    for (const id of WEAPON_ORDER) G.state.unlocked.weapons[id] = 1; for (const id of ABILITY_ORDER) G.state.unlocked.abilities[id] = 1;
    for (const u of WORKSHOP) G.state.workshop[u.id] = u.max;
    G.state.stats.sectorsCleared = 6; G.state.stats.bestSector = 6;
  }
  recalc(); startSortie({ seed: seed0 * 7919 + r, warp: snap ? 1 : 6 }); initWorld();
  let over = false, t = 0, at61 = null; const first = [];
  const offs = [bus.on('sortieOver', () => { over = true; }), bus.on('waveStart', () => { if (G.state.run.wave === 61) at61 = { salvage: G.state.run.salvage, score: G.state.run.score || 0 }; })];
  while (!over && t < 60 * 60 * 2) {
    const run = G.state.run;
    if (nextOffer()) { const o = run.offer; let bi = 0; o.forEach((c, i) => { if (score(c) + Math.random() > score(o[bi]) + Math.random() * 0.5) bi = i; }); pickCard(bi); continue; }
    if (nextRelic()) { pickRelic(Math.floor(Math.random() * run.relicOffer.length)); continue; }
    if (nextRoute()) { pickRoute(Math.floor(Math.random() * run.routeOffer.length)); continue; }
    if (mode === 'off') run.pendingAnomaly = false;
    else if (nextAnomaly()) {
      if (mode !== 'random' && !(run.anomalies || []).length) run.anomalyOffer = [mode, ...run.anomalyOffer.filter((id) => id !== mode)].slice(0, 2);
      pickAnomaly(Math.floor(Math.random() * run.anomalyOffer.length) * (mode !== 'random' && !(run.anomalies || []).length ? 0 : 1)); first.push(run.anomalies.at(-1)); continue;
    }
    step(TICK); t += TICK; G.world.fx.length = 0;
    if (Math.random() < 0.02) for (const id of run.abilities) useAbility(G.world, id, true);
  }
  for (const off of offs) off();
  const run = G.state.run, wave = G.world.wave.num || run.wave, s = endSortie('destroyed');
  rows.push({ wave, depth: Math.max(0, wave - 60), voidSalvage: at61 ? Math.round(s.salvage - at61.salvage) : 0, salvage: s.salvage, voidScore: at61 ? Math.round((s.score || 0) - at61.score) : 0, min: +(s.time / 60).toFixed(1), anomalies: first.join(' ') });
}
console.table(rows);
const avg = (k, list = rows) => list.reduce((a, x) => a + x[k], 0) / Math.max(1, list.length);
const med = (k) => { const v = rows.map((x) => x[k]).sort((a, b) => a - b); return v[v.length >> 1]; };
console.log(`void ${mode} dodge ${dodge} seed ${seed0} runs ${runs}: depth avg ${avg('depth').toFixed(1)} median ${med('depth')} | reached Void 2 (wave 71+) ${rows.filter((x) => x.wave > 70).length}/${runs} | void salvage avg ${avg('voidSalvage').toFixed(0)} | total salvage avg ${avg('salvage').toFixed(0)} | void score avg ${avg('voidScore').toFixed(0)} | minutes avg ${avg('min').toFixed(1)}`);
