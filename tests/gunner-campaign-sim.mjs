// Gunner-seat siege calibration probe: one bot pilot plays a fresh save through the main game and Counterattack (as
// siege-sim does), and at the moment each siege tier opens (its Counterattack stage first cleared) notes what a player
// has then: the turret kit their station gives the guns, how many defences are online, and what a main sortie is
// earning, so the siege's tiers and salvage payouts can be set against it. The 3D fight itself is balanced in the
// browser (it needs Three.js); this prints the kits to test it with.
// Usage: node --experimental-loader ./tests/loader.mjs ./tests/gunner-campaign-sim.mjs [sorties] [dodge] [seed] [json]
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, nextRoute, nextAnomaly, pickAnomaly, pickRoute, autoPickIndex } from '@last-orbit/progression/run.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { STAGES } from '@last-orbit/data/counter.js';
import { siegeOpen, siegeSystems } from '@last-orbit/data/siege.js';
import { turretKit } from '@last-orbit/data/turret.js';
import { workshopNext, buyWorkshop, unlockCounter, buyTech, powerRating } from '@last-orbit/progression/meta.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { TICK } from '@last-orbit/data/balance.js';

const N = Number(process.argv[2] || 40), dodge = Number(process.argv[3] ?? 1), seed0 = Number(process.argv[4] || 1), asJson = process.argv[5] === 'json';
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = dodge; });
const pickScore = (c) => c.kind === 'upgrade' ? 10 + (c.rank >= 4 ? 2 : 0) : c.kind === 'weapon' ? 9 : c.kind === 'mod' ? ({ m_dmg: 8, m_rate: 8, m_multi: 9, m_hull: 6, m_shield: 5, m_crit: 5, m_critd: 4 }[c.id] || 3) : 2;
let reason = null; bus.on('sortieOver', (r) => { reason = r; });

function fly(opts, auto) {
  startSortie(opts); initWorld(); reason = null; let t = 0;
  while (!reason && t < 60 * 60 * 2) {
    if (nextOffer()) { const o = G.state.run.offer; if (auto) pickCard(autoPickIndex(G.state.run)); else { let bi = 0; o.forEach((c, i) => { if (pickScore(c) + Math.random() > pickScore(o[bi]) + Math.random() * 0.5) bi = i; }); pickCard(bi); } continue; }
    if (nextRelic()) { pickRelic(Math.floor(Math.random() * G.state.run.relicOffer.length)); continue; }
    if (nextRoute()) { pickRoute(Math.floor(Math.random() * G.state.run.routeOffer.length)); continue; }
    if (nextAnomaly()) { pickAnomaly(Math.floor(Math.random() * G.state.run.anomalyOffer.length)); continue; }
    step(TICK); t += TICK; G.world.fx.length = 0;
    if (Math.random() < 0.02) for (const id of G.state.run.abilities) useAbility(G.world, id, true);
  }
  const s = endSortie(reason || 'abandoned'); s.time = t; return s;
}
function spend() {
  for (;;) { let best = null, cost = Infinity; for (const u of WORKSHOP) { const c = workshopNext(u.id); if (c != null && c < cost) { cost = c; best = u.id; } } if (!best || G.state.salvage < cost) break; buyWorkshop(best); }
  for (const id of ['x_alloy', 'x_siphon', 'x_phase', 'x_charts']) while (buyTech(id));
}

G.state = newState(); G.state.meta.legacyChecked = true; recalc();
const opened = {}, recent = []; let lastFailed = false;
for (let n = 1; n <= N && Object.keys(opened).length < STAGES.length; n++) {
  const s = fly({ seed: seed0 * 1000 + n }, false); recent.push({ salvage: s.salvage || 0, time: s.time }); spend(); unlockCounter({ silent: true });
  const c = G.state.counter;
  if (c.unlocked) {
    const push = STAGES.find((x) => !c.stars[x.n]), farm = STAGES.find((x) => c.stars[x.n] && c.stars[x.n] < 3);
    const next = push && farm && lastFailed ? farm : push || farm;
    if (next) { const r = fly({ counter: next.n, seed: seed0 * 7000 + n }, true).counter; spend(); lastFailed = next === push && !r.cleared; }
  }
  for (const sg of STAGES) {
    if (opened[sg.n] || !siegeOpen(G.state, sg.n)) continue;
    const last = recent.slice(-4), per = last.reduce((a, r) => a + r.salvage, 0) / last.length, perMin = last.reduce((a, r) => a + r.salvage, 0) / (last.reduce((a, r) => a + r.time, 0) / 60);
    const sys = siegeSystems(G.state), kit = turretKit(G.state), cheapest = Math.min(...WORKSHOP.map((u) => workshopNext(u.id) ?? Infinity));
    opened[sg.n] = { tier: sg.n, sortie: n, power: powerRating(), on: sys.on, systems: sys.count, lit: sys.list.filter((x) => x.state === 2).length, sortieSalvage: Math.round(per), perMinute: Math.round(perMin), nextBuy: Number.isFinite(cheapest) ? cheapest : 0, kit };
  }
}
const rows = Object.values(opened);
if (asJson) console.log(JSON.stringify(rows));
else {
  console.table(rows.map(({ kit, ...r }) => ({ ...r, dmg: +kit.dmg.toFixed(2), every: +kit.fireEvery.toFixed(3), shield: kit.shieldMax, armour: kit.armour, regen: kit.regen, evade: kit.evade, pd: kit.pdEvery })));
}
