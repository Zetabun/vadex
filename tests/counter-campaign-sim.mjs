// Headless Counterattack pacing probe: one bot pilot plays a fresh save the way a player would, flying a main-mode
// sortie, spending salvage on the cheapest Workshop upgrade, then (once Counterattack unlocks) flying one stage: the
// next uncleared one, or after a failure a cleared one still missing stars, spending cores on Alien Tech. Everything
// earned in either mode carries over, so it shows
// when each stage falls against the main-mode progression it sits on.
// Usage: node --experimental-loader ./tests/loader.mjs ./tests/counter-campaign-sim.mjs [sorties] [dodge] [seed]
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, nextRoute, nextAnomaly, pickAnomaly, pickRoute, autoPickIndex } from '@last-orbit/progression/run.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { STAGES } from '@last-orbit/data/counter.js';
import { workshopNext, buyWorkshop, unlockCounter, buyTech, powerRating } from '@last-orbit/progression/meta.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { TICK } from '@last-orbit/data/balance.js';

const N = Number(process.argv[2] || 40), dodge = Number(process.argv[3] ?? 1), seed0 = Number(process.argv[4] || 1);
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = dodge; });
const pickScore = (c) => c.kind === 'upgrade' ? 10 + (c.rank >= 4 ? 2 : 0) : c.kind === 'weapon' ? 9 : c.kind === 'mod' ? ({ m_dmg: 8, m_rate: 8, m_multi: 9, m_hull: 6, m_shield: 5, m_crit: 5, m_critd: 4 }[c.id] || 3) : 2;
let reason = null; bus.on('sortieOver', (r) => { reason = r; });

function fly(opts, counter) {
  startSortie(opts); initWorld(); reason = null; let t = 0;
  while (!reason && t < 60 * 60 * 2) {
    if (nextOffer()) { const o = G.state.run.offer; if (counter) pickCard(autoPickIndex(G.state.run)); else { let bi = 0; o.forEach((c, i) => { if (pickScore(c) + Math.random() > pickScore(o[bi]) + Math.random() * 0.5) bi = i; }); pickCard(bi); } continue; }
    if (nextRelic()) { pickRelic(Math.floor(Math.random() * G.state.run.relicOffer.length)); continue; }
    if (nextRoute()) { pickRoute(Math.floor(Math.random() * G.state.run.routeOffer.length)); continue; }
    if (nextAnomaly()) { pickAnomaly(Math.floor(Math.random() * G.state.run.anomalyOffer.length)); continue; }
    step(TICK); t += TICK; G.world.fx.length = 0;
    if (Math.random() < 0.02) for (const id of G.state.run.abilities) useAbility(G.world, id, true);
  }
  return endSortie(reason || 'abandoned');
}
function spend() {
  for (;;) { let best = null, cost = Infinity; for (const u of WORKSHOP) { const c = workshopNext(u.id); if (c != null && c < cost) { cost = c; best = u.id; } } if (!best || G.state.salvage < cost) break; buyWorkshop(best); }
  for (const id of ['x_alloy', 'x_siphon', 'x_phase', 'x_charts']) while (buyTech(id));
}

G.state = newState(); G.state.meta.legacyChecked = true; recalc();
const rows = [], firstClear = {}, tries = {}; let lastFailed = false;
for (let n = 1; n <= N; n++) {
  const s = fly({ seed: seed0 * 1000 + n }, false); spend(); unlockCounter({ silent: true });
  const c = G.state.counter; let ca = '';
  if (c.unlocked) {
    // Push the next stage; after a failure, go back for missing stars on a cleared one (cores buy Alien Tech).
    const push = STAGES.find((sg) => !c.stars[sg.n]), farm = STAGES.find((sg) => c.stars[sg.n] && c.stars[sg.n] < 3);
    const next = push && farm && lastFailed ? farm : push || farm;
    if (next) {
      const power = powerRating(); tries[next.n] = (tries[next.n] || 0) + 1;
      const r = fly({ counter: next.n, seed: seed0 * 7000 + n }, true).counter; spend();
      lastFailed = next === push && !r.cleared;
      if (r.cleared && !firstClear[next.n]) firstClear[next.n] = { sortie: n, tries: tries[next.n], power, rec: next.rec };
      ca = `s${next.n} ${r.cleared ? r.stars + '*' : 'fail ' + Math.round(r.killed * 100) + '%'} p${power}/${next.rec}`;
    }
  }
  rows.push({ n, wave: s.wave, workshop: Object.values(G.state.workshop).reduce((a, b) => a + b, 0), mastery: G.state.mastery[G.state.ship]?.level || 1, power: powerRating(), cores: c.cores, counter: ca });
}
console.table(rows);
console.log(`dodge ${dodge} seed ${seed0}: unlocked at sortie ${rows.find((r) => r.counter)?.n ?? '-'}`);
for (const sg of STAGES) { const f = firstClear[sg.n]; console.log(`stage ${sg.n} (rec ${sg.rec}): ${f ? `cleared sortie ${f.sortie}, attempt ${f.tries}, power ${f.power}` : `not cleared (${tries[sg.n] || 0} attempts)`}`); }
