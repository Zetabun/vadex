// Warp draft probe: how far a bot gets warping to a sector with its catch-up picked the old way (Auto-pick, every card
// and the first relic offered) and with the warp draft (each focus, with a warp perk). Not part of the release checks.
//   node --experimental-loader ./tests/loader.mjs tests/warp-probe.mjs [runs] [sector] [workshop level]
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, nextRoute, pickRoute, nextAnomaly, pickAnomaly, autoPickIndex, warpDraft } from '@last-orbit/progression/run.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { FOCI, WARP_PERKS } from '@last-orbit/data/warp.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { TICK } from '@last-orbit/data/balance.js';
const N = +(process.argv[2] || 12), sector = +(process.argv[3] || 4), wl = +(process.argv[4] || 6);
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = 0.5; });
let over = false; bus.on('sortieOver', () => { over = true; });
function fly(seed, how) {
  G.state = newState(); G.state.meta.legacyChecked = true; G.state.stats.sectorsCleared = 6; for (const u of WORKSHOP) G.state.workshop[u.id] = Math.min(u.max, wl); recalc();
  startSortie({ seed, warp: sector }); initWorld(); over = false; let t = 0;
  if (how !== 'old') warpDraft(how.focus, how.perk);
  while (!over && t < 60 * 60 * 2) {
    if (nextOffer()) { pickCard(autoPickIndex()); continue; } if (nextRelic()) { pickRelic(0); continue; } if (nextRoute()) { pickRoute(0); continue; } if (nextAnomaly()) { pickAnomaly(0); continue; }
    step(TICK); t += TICK; G.world.fx.length = 0; if (Math.random() < 0.02) for (const id of G.state.run.abilities) useAbility(G.world, id, true);
  }
  return endSortie('destroyed').wave;
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return `${s[s.length >> 1]} (${s[0]}-${s[s.length - 1]})`; };
const start = (sector - 1) * 10 + 1;
console.log(`Warp to sector ${sector} (wave ${start}), Workshop ${wl}, ${N} runs each: median wave reached`);
if (!process.argv[5]) console.log(`  every card by Auto-pick: ${med(Array.from({ length: N }, (_, i) => fly(500 + i, 'old')))}`);
for (const f of FOCI.filter((x) => !process.argv[5] || x.id === process.argv[5])) console.log(`  ${f.name} focus: ${med(Array.from({ length: N }, (_, i) => fly(500 + i, { focus: f.id, perk: WARP_PERKS[i % WARP_PERKS.length].id })))}`);
