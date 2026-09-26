// Field kit probe: how many supply canisters bots pack per sortie, and what using the boosts does to salvage, XP,
// materials and the wave reached. Not part of the release checks.
//   node --experimental-loader ./tests/loader.mjs tests/kit-probe.mjs [runs] [workshop level] [use: 0 keep, 1 use at once]
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, nextRoute, pickRoute, nextAnomaly, pickAnomaly, autoPickIndex } from '@last-orbit/progression/run.js';
import { kit, useBoost, cannotUse } from '@last-orbit/progression/boosts.js';
import { BOOSTS } from '@last-orbit/data/boosts.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { TICK } from '@last-orbit/data/balance.js';
const N = +(process.argv[2] || 8), wl = +(process.argv[3] || 0), use = +(process.argv[4] || 0);
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = 0.5; });
let over = false; bus.on('sortieOver', () => { over = true; });
const rows = [];
for (let i = 0; i < N; i++) {
  G.state = newState(); G.state.meta.legacyChecked = true; for (const u of WORKSHOP) G.state.workshop[u.id] = Math.min(u.max, wl); recalc();
  startSortie({ seed: 700 + i }); initWorld(); over = false; let t = 0, used = 0;
  while (!over && t < 60 * 60 * 3) {
    if (nextOffer()) { pickCard(autoPickIndex()); continue; } if (nextRelic()) { pickRelic(0); continue; } if (nextRoute()) { pickRoute(0); continue; } if (nextAnomaly()) { pickAnomaly(0); continue; }
    step(TICK); t += TICK; G.world.fx.length = 0; if (Math.random() < 0.02) for (const id of G.state.run.abilities) useAbility(G.world, id, true);
    if (use && Math.random() < 0.01) for (const b of BOOSTS) if (!cannotUse(G.state, b.id) && (b.id !== 'patch' || G.world.player.hull < 0.6)) { useBoost(G.state, b.id); used++; }
  }
  const packed = G.state.run.supply?.packed || 0, s = endSortie('destroyed');
  rows.push({ wave: s.wave, kills: s.kills, packed, used, salvage: s.salvage, mats: Object.values(s.mats || {}).reduce((a, b) => a + b, 0), kitLeft: Object.values(kit(G.state)).reduce((a, b) => a + b, 0) });
}
console.table(rows);
const avg = (k) => (rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(1);
console.log(`Workshop ${wl}, ${use ? 'using boosts' : 'keeping boosts'}: wave ${avg('wave')}, canisters ${avg('packed')}, salvage ${avg('salvage')}, materials ${avg('mats')}`);
