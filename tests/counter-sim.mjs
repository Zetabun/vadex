// Headless Counterattack probe: the autopilot bot flies one stage several times and reports clears, stars and time.
// Usage: node --experimental-loader ./tests/loader.mjs ./tests/counter-sim.mjs [stage] [runs] [workshopLevel] [dodge] [hard]
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, autoPickIndex } from '@last-orbit/progression/run.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { WEAPON_ORDER } from '@last-orbit/data/weapons.js';
import { ABILITY_ORDER } from '@last-orbit/data/abilities.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { TICK } from '@last-orbit/data/balance.js';
import { powerRating } from '@last-orbit/progression/meta.js';

const stage = Number(process.argv[2] || 1), runs = Number(process.argv[3] || 4), wl = Number(process.argv[4] || 0), dodge = Number(process.argv[5] ?? 1), hard = process.argv[6] === 'hard';
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = dodge; });
let reason = null; bus.on('sortieOver', (r) => { reason = r; });
const rows = [];
for (let r = 0; r < runs; r++) {
  G.state = newState(); for (const id of WEAPON_ORDER) G.state.unlocked.weapons[id] = 1; for (const id of ABILITY_ORDER) G.state.unlocked.abilities[id] = 1;
  for (const u of WORKSHOP) if (u.id !== 'w_revive' && u.id !== 'w_choice') G.state.workshop[u.id] = Math.min(u.max, wl);
  G.state.stats.sectorsCleared = 6; G.state.counter.unlocked = true; recalc();
  startSortie({ counter: stage, hard, seed: 500 + r }); initWorld(); reason = null; let t = 0;
  while (!reason && t < 60 * 20) {
    if (nextOffer()) { pickCard(autoPickIndex(G.state.run)); continue; }
    if (nextRelic()) { pickRelic(0); continue; }
    step(TICK); t += TICK; G.world.fx.length = 0;
    if (Math.random() < 0.02) for (const id of G.state.run.abilities) useAbility(G.world, id, true);
  }
  const w = G.world, b = w.counter?.boss, hitBy = G.state.run?.hitBy || {}, s = endSortie(reason || 'abandoned');
  rows.push({ cleared: s.counter.cleared, stars: s.counter.stars, min: +(t / 60).toFixed(1), hits: s.counter.hits, killed: Math.round(s.counter.killed * 100) + '%', level: s.level, score: s.score, by: Object.entries(hitBy).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ':' + v).join(' '), end: reason === 'destroyed' ? (b ? `boss ${Math.round(b.hp * 100)}%` : `t${Math.round(w.counter.t)}s`) : reason });
}
console.table(rows);
console.log(`stage ${stage}${hard ? ' hard' : ''} workshop ${wl} dodge ${dodge} power ${powerRating()}: cleared ${rows.filter((x) => x.cleared).length}/${runs}`);
