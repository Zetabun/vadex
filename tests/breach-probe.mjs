// Breach probe: how far bots get with the line's strikes (BAL.breachStrikes a sector) against with breaches only
// costing hull (as before v2.20), and how many runs the line ends. Not part of the release checks.
//   node --experimental-loader ./tests/loader.mjs tests/breach-probe.mjs [runs] [workshop level] [dodge]
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, nextRoute, pickRoute, nextAnomaly, pickAnomaly, autoPickIndex } from '@last-orbit/progression/run.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { BAL, TICK } from '@last-orbit/data/balance.js';
const N = +(process.argv[2] || 12), wl = +(process.argv[3] || 0), dodge = +(process.argv[4] ?? 0.5), STRIKES = BAL.breachStrikes;
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = dodge; });
let over = false; bus.on('sortieOver', () => { over = true; });
function fly(seed) {
  G.state = newState(); G.state.meta.legacyChecked = true; for (const u of WORKSHOP) G.state.workshop[u.id] = Math.min(u.max, wl); recalc();
  startSortie({ seed }); initWorld(); over = false; let t = 0;
  while (!over && t < 60 * 60 * 2) {
    if (nextOffer()) { pickCard(autoPickIndex()); continue; } if (nextRelic()) { pickRelic(0); continue; } if (nextRoute()) { pickRoute(0); continue; } if (nextAnomaly()) { pickAnomaly(0); continue; }
    step(TICK); t += TICK; G.world.fx.length = 0; if (Math.random() < 0.02) for (const id of G.state.run.abilities) useAbility(G.world, id, true);
  }
  const broke = !!G.state.run.breached; return { wave: endSortie('destroyed').wave, broke };
}
const med = (a) => { const s = a.map((r) => r.wave).sort((x, y) => x - y); return `median wave ${s[s.length >> 1]} (${s[0]}-${s[s.length - 1]})`; };
BAL.breachStrikes = 999; const before = Array.from({ length: N }, (_, i) => fly(700 + i));
BAL.breachStrikes = STRIKES; const after = Array.from({ length: N }, (_, i) => fly(700 + i));
console.log(`Workshop ${wl}, dodge ${dodge}, ${N} runs: breaches cost hull only: ${med(before)} · ${STRIKES} strikes a sector: ${med(after)}, ${after.filter((r) => r.broke).length}/${N} ended by the line`);
