import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, autoPickIndex } from '@last-orbit/progression/run.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { TICK } from '@last-orbit/data/balance.js';
const tier = +(process.argv[2] || 2), share = +(process.argv[3] ?? 0.5), dodge = +(process.argv[4] ?? 1); G.siegePrio = +(process.argv[5] ?? 400);
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = dodge; });
let reason = null; bus.on('sortieOver', (r) => { reason = r; });
G.state = newState(); G.state.meta.legacyChecked = true;
for (let k = 1; k <= tier; k++) G.state.counter.stars[k] = 1; G.state.counter.unlocked = true;
WORKSHOP.forEach((u, i) => { G.state.workshop[u.id] = Math.round(u.max * Math.min(1, Math.max(0, share * 1.6 - (i % 5) * 0.15))); }); recalc();
startSortie({ siege: tier, seed: 42 + tier * 7 + (+process.argv[6] || 0) }); initWorld(); const w = G.world;
const c = { shells: 0, raiders: 0, landed: {}, killedBy: {} };
const origFx = w.fx; let t = 0;
bus.on('kill', (w2, e) => { if (e.state === 'raid') { const k = e.siegeKind; c.killedBy[k] = (c.killedBy[k] || 0) + 1; } });
while (!reason && t < 3600) {
  if (nextOffer()) { pickCard(autoPickIndex(G.state.run)); continue; } if (nextRelic()) { pickRelic(0); continue; }
  const before = new Set(w.enemies.filter((e) => e.state === 'raid').map((e) => e.id));
  step(TICK); t += TICK;
  for (const e of G.world.enemies) if (e.state === 'raid' && !before.has(e.id) && e.alive) { if (e.siegeKind === 'raider') c.raiders++; else c.shells++; before.add(e.id); }
  for (const f of G.world.fx) if (f.k === 'stationHit' || f.k === 'stationShield' || (f.k === 'text' && f.c === 'MISS')) c.landed[f.k === 'text' ? 'miss' : f.k] = (c.landed[f.k === 'text' ? 'miss' : f.k] || 0) + 1;
  G.world.fx.length = 0;
}
const s = G.world.siege; console.log(JSON.stringify({ reason, time: Math.round(t), wave: G.world.wave.num, hull: s.hull.toFixed(2), sys: Object.keys(s.sys).join(','), ...c }));
