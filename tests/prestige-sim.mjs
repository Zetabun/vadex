// Headless Overhaul (prestige) probe: a bot pilot plays a fresh save, buying the cheapest Workshop upgrade after each
// sortie and overhauling as soon as the Workshop is maxed, then spending Blueprints in a sensible order. It reports each
// Overhaul cycle: how many sorties the rebuild took, how deep the pilot got, and how weak the first sorties after the
// reset were, so the loop can be judged against the first climb.
// Usage: node --experimental-loader ./tests/loader.mjs ./tests/prestige-sim.mjs [sorties] [dodge] [seed]
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, nextRoute, pickRoute } from '@last-orbit/progression/run.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { workshopNext, buyWorkshop, workshopMaxed, overhaul, buyBlueprint, blueprintNext, powerRating } from '@last-orbit/progression/meta.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { TICK } from '@last-orbit/data/balance.js';

const N = Number(process.argv[2] || 150), dodge = Number(process.argv[3] ?? 1), seed0 = Number(process.argv[4] || 1);
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = dodge; });
const pickScore = (c) => c.kind === 'upgrade' ? 10 + (c.rank >= 4 ? 2 : 0) : c.kind === 'weapon' ? 9 : c.kind === 'mod' ? ({ m_dmg: 8, m_rate: 8, m_multi: 9, m_hull: 6, m_shield: 5, m_crit: 5, m_critd: 4 }[c.id] || 3) : 2;
let reason = null; bus.on('sortieOver', (r) => { reason = r; });
// Blueprint priorities: a first escort, faster rebuilds, then power and the rest.
const ORDER = ['bp_bay', 'bp_intercept', 'bp_salvage', 'bp_head', 'bp_calib', 'bp_engineers', 'bp_shield', 'bp_repair', 'bp_missile', 'bp_painter'];

function fly(seed) {
  startSortie({ seed }); initWorld(); reason = null; let t = 0;
  while (!reason && t < 60 * 60 * 2) {
    if (nextOffer()) { const o = G.state.run.offer; let bi = 0; o.forEach((c, i) => { if (pickScore(c) + Math.random() > pickScore(o[bi]) + Math.random() * 0.5) bi = i; }); pickCard(bi); continue; }
    if (nextRelic()) { pickRelic(Math.floor(Math.random() * G.state.run.relicOffer.length)); continue; }
    if (nextRoute()) { pickRoute(Math.floor(Math.random() * G.state.run.routeOffer.length)); continue; }
    step(TICK); t += TICK; G.world.fx.length = 0;
    if (Math.random() < 0.02) for (const id of G.state.run.abilities) useAbility(G.world, id, true);
  }
  return endSortie(reason || 'abandoned');
}

G.state = newState(); G.state.meta.legacyChecked = true; recalc();
const cycles = []; let cyc = { n: 0, start: 1, sorties: 0, best: 0, first3: [], bp: 0 };
for (let n = 1; n <= N; n++) {
  const s = fly(seed0 * 1000 + n);
  cyc.sorties++; cyc.best = Math.max(cyc.best, s.wave); if (cyc.first3.length < 3) cyc.first3.push(s.wave);
  for (;;) { let best = null, cost = Infinity; for (const u of WORKSHOP) { const c = workshopNext(u.id); if (c != null && c < cost) { cost = c; best = u.id; } } if (!best || G.state.salvage < cost) break; buyWorkshop(best); }
  if (workshopMaxed()) {
    const power = powerRating(), bp = overhaul(); cycles.push({ ...cyc, first3: cyc.first3.join('/'), bp, power, ends: n });
    for (let bought = true; bought;) { bought = false; for (const id of ORDER) { const c = blueprintNext(id); if (c != null && G.state.prestige.bp >= c) { buyBlueprint(id); bought = true; break; } } }
    cyc = { n: G.state.prestige.level, start: n + 1, sorties: 0, best: 0, first3: [], bp: 0 };
  }
}
cycles.push({ ...cyc, first3: cyc.first3.join('/'), bp: '-', power: powerRating(), ends: '(open)' });
console.table(cycles.map((c) => ({ cycle: c.n, sorties: c.sorties, best: c.best, first3: c.first3, power: c.power, bp: c.bp, ends: c.ends })));
const pr = G.state.prestige;
console.log(`dodge ${dodge} seed ${seed0}: ${pr.level} overhauls in ${N} sorties; blueprints earned ${pr.bpEarned}; bought ${JSON.stringify(pr.tech)}; escorts ${pr.escorts.join(',')}`);
