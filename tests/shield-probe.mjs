// Shield bubble probe: how far bots get with shots hitting the hull's own small circle only (as before v2.21) and with
// the bubble taking them while the shield is up (BAL.shieldR), at a given strength (BAL.bubbleDmg). Not part of the
// release checks.
//   node --experimental-loader ./tests/loader.mjs tests/shield-probe.mjs [runs] [workshop level] [bubbleDmg,...]
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, nextRoute, pickRoute, nextAnomaly, pickAnomaly, autoPickIndex } from '@last-orbit/progression/run.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { BAL, TICK } from '@last-orbit/data/balance.js';
const N = +(process.argv[2] || 12), wl = +(process.argv[3] || 0), dmgs = (process.argv[4] || '1').split(',').map(Number), R = BAL.shieldR;
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = 0.5; });
let over = false; bus.on('sortieOver', () => { over = true; });
function fly(seed) {
  G.state = newState(); G.state.meta.legacyChecked = true; for (const u of WORKSHOP) G.state.workshop[u.id] = Math.min(u.max, wl); recalc();
  startSortie({ seed }); initWorld(); over = false; let t = 0;
  while (!over && t < 60 * 60 * 2) {
    if (nextOffer()) { pickCard(autoPickIndex()); continue; } if (nextRelic()) { pickRelic(0); continue; } if (nextRoute()) { pickRoute(0); continue; } if (nextAnomaly()) { pickAnomaly(0); continue; }
    step(TICK); t += TICK; G.world.fx.length = 0; if (Math.random() < 0.02) for (const id of G.state.run.abilities) useAbility(G.world, id, true);
  }
  return endSortie('destroyed').wave;
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return `${s[s.length >> 1]} (${s[0]}-${s[s.length - 1]})`; };
BAL.shieldR = 3.2; BAL.bubbleDmg = 1; const out = [`hull circle only: ${med(Array.from({ length: N }, (_, i) => fly(900 + i)))}`];
for (const d of dmgs) { BAL.shieldR = R; BAL.bubbleDmg = d; out.push(`bubble r${R} x${d}: ${med(Array.from({ length: N }, (_, i) => fly(900 + i)))}`); }
console.log(`Workshop ${wl}, ${N} runs, median wave: ` + out.join(' · '));
