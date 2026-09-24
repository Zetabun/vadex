// Headless progression probe: a bot pilot starts from a fresh save and flies sortie after sortie, spending salvage on
// the cheapest Workshop upgrade after each one and collecting every reward the game pays (contracts, pilot ranks,
// mastery, medals). It reports how quickly the pilot gets deeper, so reward changes can be judged by pacing.
// Usage: node --experimental-loader ./tests/loader.mjs ./tests/progression-sim.mjs [sorties] [mode] [dodge] [seed]
//   mode: 'all' (every reward system) | 'nomedals' (achievements switched off, as in v2.2)
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { nextRoute, nextAnomaly, pickAnomaly, pickRoute } from '@last-orbit/progression/run.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic } from '@last-orbit/progression/run.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { ACHIEVEMENTS, FEATS } from '@last-orbit/data/achievements.js';
import { workshopNext, buyWorkshop, medalTotal } from '@last-orbit/progression/meta.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { TICK } from '@last-orbit/data/balance.js';

const N = Number(process.argv[2] || 30), mode = process.argv[3] || 'all', dodge = Number(process.argv[4] ?? 1), seed0 = Number(process.argv[5] || 1);
if (mode === 'nomedals') { ACHIEVEMENTS.length = 0; FEATS.length = 0; }
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = dodge; });
const pickScore = (c) => c.kind === 'upgrade' ? 10 + (c.rank >= 4 ? 2 : 0) : c.kind === 'weapon' ? 9 : c.kind === 'mod' ? ({ m_dmg: 8, m_rate: 8, m_multi: 9, m_hull: 6, m_shield: 5, m_crit: 5, m_critd: 4 }[c.id] || 3) : 2;
let over = false; bus.on('sortieOver', () => { over = true; });

G.state = newState(); G.state.meta.legacyChecked = true; recalc();
const rows = [], firsts = {};
let spent = 0;
for (let n = 1; n <= N; n++) {
  const before = G.state.salvage + spent;
  startSortie({ seed: seed0 * 1000 + n }); initWorld(); over = false; let t = 0;
  while (!over && t < 60 * 60 * 2) {
    if (nextOffer()) { const o = G.state.run.offer; let bi = 0; o.forEach((c, i) => { if (pickScore(c) + Math.random() > pickScore(o[bi]) + Math.random() * 0.5) bi = i; }); pickCard(bi); continue; }
    if (nextRelic()) { pickRelic(Math.floor(Math.random() * G.state.run.relicOffer.length)); continue; }
    if (nextRoute()) { pickRoute(Math.floor(Math.random() * G.state.run.routeOffer.length)); continue; }
    if (nextAnomaly()) { pickAnomaly(Math.floor(Math.random() * G.state.run.anomalyOffer.length)); continue; }
    step(TICK); t += TICK; G.world.fx.length = 0;
    if (Math.random() < 0.02) for (const id of G.state.run.abilities) useAbility(G.world, id, true);
  }
  const s = endSortie('destroyed');
  const income = G.state.salvage + spent - before;
  // Spend: cheapest Workshop upgrade first, while affordable.
  for (;;) {
    let best = null, cost = Infinity;
    for (const u of WORKSHOP) { const c = workshopNext(u.id); if (c != null && c < cost) { cost = c; best = u.id; } }
    if (!best || G.state.salvage < cost) break;
    buyWorkshop(best); spent += cost;
  }
  const wl = Object.values(G.state.workshop).reduce((a, b) => a + b, 0);
  for (const m of [20, 30, 40, 50, 60]) if (s.wave >= m && !firsts[m]) firsts[m] = n;
  rows.push({ n, wave: s.wave, score: s.score, income, medals: medalTotal().earned, rank: G.state.pilot.rank, workshop: wl, mastery: G.state.mastery.vanguard?.level || 1, min: +(s.time / 60).toFixed(1) });
}
// SNAP=file: keep the pilot's save at the end, for probes that start from a late-game pilot (tests/void-sim.mjs).
if (process.env.SNAP) (await import('node:fs')).writeFileSync(process.env.SNAP, JSON.stringify(G.state));
console.table(rows);
const tot = rows.reduce((a, r) => a + r.income, 0);
console.log(`${mode} dodge ${dodge} seed ${seed0}: first sortie reaching wave 20/30/40/50/60 = ${[20, 30, 40, 50, 60].map((m) => firsts[m] || '-').join('/')}; salvage earned ${tot}; workshop levels ${rows.at(-1).workshop}; rank ${rows.at(-1).rank}; medals ${rows.at(-1).medals}`);
