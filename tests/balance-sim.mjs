// Headless balance probe: an autopilot bot flies sorties and reports where they end.
// Usage: node --experimental-loader ./tests/loader.mjs ./tests/balance-sim.mjs [runs] [workshopLevel] [ship]
// (env RANK sets the Overhaul rank: from 8 the Deep Void sectors end on Void bosses)
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { nextRoute, nextAnomaly, pickAnomaly, pickRoute } from '@last-orbit/progression/run.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, cardPool } from '@last-orbit/progression/run.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { WEAPON_ORDER } from '@last-orbit/data/weapons.js';
import { ABILITY_ORDER } from '@last-orbit/data/abilities.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { TICK } from '@last-orbit/data/balance.js';

const runs = Number(process.argv[2] || 6), wl = Number(process.argv[3] || 0), ship = process.argv[4] || 'vanguard', unlock = process.argv[5] || 'all', dodge = Number(process.argv[6] ?? 1), threat = Number(process.argv[7] || 0);
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = dodge; });
const score = (c) => c.kind === 'upgrade' ? 10 + (c.rank >= 4 ? 2 : 0) : c.kind === 'weapon' ? 9 : c.kind === 'mod' ? ({ m_dmg: 8, m_rate: 8, m_multi: 9, m_hull: 6, m_shield: 5, m_crit: 5, m_critd: 4 }[c.id] || 3) : 2;

const results = [];
for (let r = 0; r < runs; r++) {
  G.state = newState(); G.state.ship = ship; G.state.unlocked.ships[ship] = 1; G.state.prestige.level = +(process.env.RANK || 0); /* RANK=8: the beacons lit, Void bosses in the Deep Void */
  if (unlock === 'all') { for (const id of WEAPON_ORDER) G.state.unlocked.weapons[id] = 1; for (const id of ABILITY_ORDER) G.state.unlocked.abilities[id] = 1; }
  else if (unlock === 'some') { for (const id of ['laser', 'missile', 'tesla']) G.state.unlocked.weapons[id] = 1; G.state.unlocked.abilities.emp = 1; }
  for (const u of WORKSHOP) if (u.id !== 'w_revive' && u.id !== 'w_choice') G.state.workshop[u.id] = Math.min(u.max, wl);
  G.state.stats.bestSector = 6; G.state.stats.threatClear = 10; G.state.threat = threat;
  recalc(); startSortie({ seed: 1000 + r }); initWorld();
  let over = false, t = 0; const marks = {};
  let death = '';
  const off = bus.on('sortieOver', () => { over = true; const w = G.world, b = w.enemies.find((e) => e.boss); death = `t${Math.round(w.wave.t)}s ${w.wave.info?.kind} ${b ? b.type + ' hp' + Math.round(b.hp * 100) + '%' : 'left ' + w.enemies.filter((e) => e.alive).length}`; });
  bus.on('waveStart', (w) => { const wv = G.state.run?.wave; if (wv && wv % 10 === 1) marks[wv] = { t: Math.round(G.state.run.time), lvl: G.state.run.level }; });
  while (!over && t < 60 * 60 * 2) {
    if (nextOffer()) { const o = G.state.run.offer; let bi = 0; o.forEach((c, i) => { if (score(c) + Math.random() > score(o[bi]) + Math.random() * 0.5) bi = i; }); pickCard(bi); continue; }
    if (nextRelic()) { pickRelic(Math.floor(Math.random() * G.state.run.relicOffer.length)); continue; }
    if (nextRoute()) { pickRoute(Math.floor(Math.random() * G.state.run.routeOffer.length)); continue; }
    if (nextAnomaly()) { pickAnomaly(Math.floor(Math.random() * G.state.run.anomalyOffer.length)); continue; }
    step(TICK); t += TICK; G.world.fx.length = 0;
    if (Math.random() < 0.02) for (const id of G.state.run.abilities) useAbility(G.world, id, true);
  }
  off();
  const run = G.state.run;
  results.push({ wave: run.wave, score: Math.round(run.score || 0), level: run.level, min: +(run.time / 60).toFixed(1), salvage: Math.round(run.salvage), weapons: run.order.map((id) => id + run.weapons[id]).join(' '), relics: run.relics.length, death, marks: JSON.stringify(marks) });
  endSortie();
}
console.table(results);
const waves = results.map((x) => x.wave).sort((a, b) => a - b);
console.log(`workshop ${wl} ${ship} ${unlock} dodge ${dodge} threat ${threat}: median wave ${waves[waves.length >> 1]}, range ${waves[0]}-${waves[waves.length - 1]}`);
