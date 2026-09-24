// Early-game curve probe: a fresh pilot (no Workshop, starter unlocks) flies first sorties; for each wave it records
// how long the wave took, hull lost, pilot level, and the pilot's best weapon DPS against enemy health.
// Usage: node --experimental-loader ./tests/loader.mjs ./tests/early-sim.mjs [runs] [dodge] [maxWave]
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, nextRoute, pickRoute } from '@last-orbit/progression/run.js';
import { useAbility, bestDps } from '@last-orbit/combat/abilities.js';
import { TICK, enemyHp } from '@last-orbit/data/balance.js';

const runs = Number(process.argv[2] || 6), dodge = Number(process.argv[3] ?? 0), maxWave = Number(process.argv[4] || 30);
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = dodge; });
const score = (c) => c.kind === 'upgrade' ? 10 : c.kind === 'weapon' ? 9 : c.kind === 'mod' ? ({ m_dmg: 8, m_rate: 8, m_multi: 9, m_hull: 6 }[c.id] || 3) : 2;
let over = false; bus.on('sortieOver', () => { over = true; });
const per = {}; // wave → { time, hullLost, level, ttk, n }
let deaths = [];
bus.on('waveCleared', (w, info) => {
  const run = G.state.run, wave = run.wave - 1, rec = (per[wave] ||= { time: 0, lost: 0, level: 0, ttk: 0, n: 0 });
  rec.time += w.wave.t; rec.lost += Math.max(0, (w.hullAtStart ?? 1) - w.player.hull); rec.level += run.level; rec.n++;
  rec.ttk += enemyHp(wave, info.sector.idx).toNumber() / Math.max(1e-9, bestDps().toNumber()); // seconds for the best gun to kill a 1× enemy
});
bus.on('waveStart', (w) => { w.hullAtStart = w.player.hull; });
for (let r = 0; r < runs; r++) {
  G.state = newState(); recalc(); startSortie({ seed: 900 + r }); initWorld(); over = false; let t = 0;
  while (!over && t < 3600 && G.state.run.wave <= maxWave) {
    if (nextOffer()) { const o = G.state.run.offer; let bi = 0; o.forEach((c, i) => { if (score(c) + Math.random() > score(o[bi]) + Math.random() * 0.5) bi = i; }); pickCard(bi); continue; }
    if (nextRelic()) { pickRelic(0); continue; }
    if (nextRoute()) { pickRoute(0); continue; }
    step(TICK); t += TICK; G.world.fx.length = 0;
    if (Math.random() < 0.02) for (const id of G.state.run.abilities) useAbility(G.world, id, true);
  }
  deaths.push(over ? G.world.wave.num : '>' + maxWave); endSortie('abandoned');
}
const rows = Object.entries(per).map(([wave, r]) => ({ wave: +wave, secs: +(r.time / r.n).toFixed(1), hullLost: Math.round(r.lost / r.n * 100) + '%', level: +(r.level / r.n).toFixed(1), ttk: +(r.ttk / r.n).toFixed(2), runs: r.n }));
console.table(rows);
console.log(`dodge ${dodge}: died at waves ${deaths.join(', ')}`);
