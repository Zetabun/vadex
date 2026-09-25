// Headless Station Siege pacing probe: one bot pilot plays a fresh save the way a player would (a main-mode sortie,
// then one Counterattack stage once it unlocks, spending salvage and cores as it goes), and after every Counterattack
// clear it also flies the lowest Station Siege tier it has not yet won. Reports when each tier falls, in how many
// attempts, and how much of the station was left.
// Usage: [PRIO=0] node --experimental-loader ./tests/loader.mjs ./tests/siege-sim.mjs [sorties] [dodge] [seed]
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, nextRoute, nextAnomaly, pickAnomaly, pickRoute, autoPickIndex } from '@last-orbit/progression/run.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { STAGES } from '@last-orbit/data/counter.js';
import { SIEGE_TIERS, siegeOpen, siegeSystems } from '@last-orbit/data/siege.js';
import { workshopNext, buyWorkshop, unlockCounter, buyTech, powerRating } from '@last-orbit/progression/meta.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { TICK } from '@last-orbit/data/balance.js';

const N = Number(process.argv[2] || 40), dodge = Number(process.argv[3] ?? 1), seed0 = Number(process.argv[4] || 1);
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = dodge; });
// PRIO=0 models a pilot who does not go after shells and raiders first (the bot's autopilot chases them hardest by default).
if (process.env.PRIO != null) G.siegePrio = +process.env.PRIO;
// MOVE: how hard the pilot chases shells and raiders (400: an attentive pilot who goes and gets them; 0: one who mostly shoots the formation).
if (process.env.MOVE != null) G.siegeMovePrio = +process.env.MOVE;
const pickScore = (c) => c.kind === 'upgrade' ? 10 + (c.rank >= 4 ? 2 : 0) : c.kind === 'weapon' ? 9 : c.kind === 'mod' ? ({ m_dmg: 8, m_rate: 8, m_multi: 9, m_hull: 6, m_shield: 5, m_crit: 5, m_critd: 4 }[c.id] || 3) : 2;
let reason = null; bus.on('sortieOver', (r) => { reason = r; });
// per siege: shells and raiders sent, who stopped them (the station's guns and point defence, or the pilot), and hits
let tally = null; const stationIds = new Set(['station']);
bus.on('kill', (w, e, ...rest) => { if (!tally || e.state !== 'raid') return; tally.killed++; });


function fly(opts, auto) {
  startSortie(opts); initWorld(); reason = null; let t = 0; tally = opts.siege ? { shells: 0, raiders: 0, killed: 0, station: 0, hits: 0 } : null;
  while (!reason && t < 60 * 60 * 2) {
    if (nextOffer()) { const o = G.state.run.offer; if (auto) pickCard(autoPickIndex(G.state.run)); else { let bi = 0; o.forEach((c, i) => { if (pickScore(c) + Math.random() > pickScore(o[bi]) + Math.random() * 0.5) bi = i; }); pickCard(bi); } continue; }
    if (nextRelic()) { pickRelic(Math.floor(Math.random() * G.state.run.relicOffer.length)); continue; }
    if (nextRoute()) { pickRoute(Math.floor(Math.random() * G.state.run.routeOffer.length)); continue; }
    if (nextAnomaly()) { pickAnomaly(Math.floor(Math.random() * G.state.run.anomalyOffer.length)); continue; }
    const pre = tally ? G.world.enemies.length : 0;
    step(TICK); t += TICK;
    if (tally) { for (const e of G.world.enemies) if (e.state === 'raid' && !e._seen) { e._seen = 1; if (e.siegeKind === 'raider') tally.raiders++; else tally.shells++; }
      for (const f of G.world.fx) { if (f.k === 'stationHit') tally.hits++; else if (f.k === 'beam' && (f.e === 0x7fe8ff || f.e === 0xffd27a)) tally.station++; } }
    G.world.fx.length = 0;
    if (Math.random() < 0.02) for (const id of G.state.run.abilities) useAbility(G.world, id, true);
  }
  const hits = G.world?.siege?.hits || 0, wave = G.world?.wave?.num || 0;
  const s = endSortie(reason || 'abandoned'); s.siegeHits = hits; s.lastWave = wave; s.tally = tally; s.time = t; return s;
}
function spend() {
  for (;;) { let best = null, cost = Infinity; for (const u of WORKSHOP) { const c = workshopNext(u.id); if (c != null && c < cost) { cost = c; best = u.id; } } if (!best || G.state.salvage < cost) break; buyWorkshop(best); }
  for (const id of ['x_alloy', 'x_siphon', 'x_phase', 'x_charts']) while (buyTech(id));
}

G.state = newState(); G.state.meta.legacyChecked = true; recalc();
const rows = [], won = {}, tries = {}; let lastFailed = false;
for (let n = 1; n <= N; n++) {
  const s = fly({ seed: seed0 * 1000 + n }, false); spend(); unlockCounter({ silent: true });
  const c = G.state.counter; let ca = '', sg = '';
  if (c.unlocked) {
    const push = STAGES.find((x) => !c.stars[x.n]), farm = STAGES.find((x) => c.stars[x.n] && c.stars[x.n] < 3);
    const next = push && farm && lastFailed ? farm : push || farm;
    if (next) { const r = fly({ counter: next.n, seed: seed0 * 7000 + n }, true).counter; spend(); lastFailed = next === push && !r.cleared; ca = `s${next.n} ${r.cleared ? r.stars + '*' : 'fail'}`; }
    // the lowest open siege tier not yet won
    const tier = SIEGE_TIERS.find((t) => siegeOpen(G.state, t.n) && !won[t.n]);
    if (tier) {
      tries[tier.n] = (tries[tier.n] || 0) + 1; const sys = siegeSystems(G.state).count;
      const r = fly({ siege: tier.n, seed: seed0 * 5000 + n }, true), x = r.siege; spend();
      if (x.won) won[tier.n] = { sortie: n, tries: tries[tier.n], hull: x.hull, stars: x.stars, sys, power: powerRating() };
      sg = `T${tier.n} ${x.won ? `won ${Math.round(x.hull * 100)}% ${x.stars}*` : x.lost ? `LOST w${r.lastWave - tier.first + 1}/${tier.waves}` : `died w${r.lastWave - tier.first + 1}/${tier.waves} stn ${Math.round(x.hull * 100)}%`} sys ${sys} | ${Math.round(r.time)}s sent ${r.tally.shells}sh+${r.tally.raiders}r killed ${r.tally.killed} (stn shots ${r.tally.station}) hits ${r.tally.hits}`;
    }
  }
  rows.push({ n, wave: s.wave, power: powerRating(), counter: ca, siege: sg });
}
console.table(rows);
for (const t of SIEGE_TIERS) { const f = won[t.n]; console.log(`tier ${t.n} ${t.name}: ${f ? `won sortie ${f.sortie}, attempt ${f.tries}, station ${Math.round(f.hull * 100)}%, ${f.stars}*, ${f.sys} systems, power ${f.power}` : `not won (${tries[t.n] || 0} attempts)`}`); }
