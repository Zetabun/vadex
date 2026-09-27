// Corner probe: is anywhere on the field safe? A mid-game pilot (Workshop half built) warps to a sector and flies for a
// few minutes either parked at one spot (the ship does not move; it still fires) or flying as the bot does. Hull and
// shield are topped up each moment so the run lasts; what it would have lost is counted. Reports the damage taken per
// minute at each spot, so a corner can be set against the middle of the field.
// Usage: node --experimental-loader ./tests/loader.mjs ./tests/corner-probe.mjs [sector] [minutes] [runs]
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, nextRoute, pickRoute, nextAnomaly, pickAnomaly } from '@last-orbit/progression/run.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { TICK, FIELD } from '@last-orbit/data/balance.js';

const sector = Number(process.argv[2] || 3), minutes = Number(process.argv[3] || 3), runs = Number(process.argv[4] || 4);
const EDGE = FIELD.W / 2 - 3.5, spots = [['corner', EDGE], ['near corner', EDGE - 6], ['quarter', EDGE / 2], ['centre', 0], ['flying (bot)', null]];
let parked = false; bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = parked ? 0 : 1; G.sheet.totalN.autoDodge = parked ? 0 : 1; });
const rows = [];
for (const [label, x] of spots) {
  let dmg = 0, fromShots = 0, secs = 0, waves = 0;
  for (let r = 0; r < runs; r++) {
    parked = x != null; const st = (G.state = newState()); st.meta.legacyChecked = true;
    WORKSHOP.forEach((u, i) => { st.workshop[u.id] = Math.round(u.max * 0.5); }); st.stats.sectorsCleared = sector; st.stats.bestSector = sector;
    recalc(); startSortie({ seed: 101 + r * 7919, warp: sector }); initWorld(); const w0 = G.state.run.wave;
    for (let t = 0; t < minutes * 60; t += TICK) {
      const run = G.state.run; if (!run) break;
      if (nextOffer()) { pickCard(0); continue; } if (nextRelic()) { pickRelic(0); continue; } if (nextRoute()) { pickRoute(0); continue; } if (nextAnomaly()) { pickAnomaly(0); continue; }
      const p = G.world.player; if (x != null) { p.x = r % 2 ? -x : x; } /* either corner */
      const near = G.world.ebullets.filter((b) => b.alive && Math.hypot(b.x - p.x, b.y - p.y) < 16);
      const before = p.hull + p.shield; step(TICK); const after = p.hull + p.shield;
      if (after < before) { dmg += before - after; if (near.some((b) => !G.world.ebullets.includes(b) && Math.hypot(b.x - p.x, b.y - p.y) < 6.2 + b.r + 2)) fromShots += before - after; } /* an enemy shot vanished at the ship: it was the shot */
      p.hull = 1; p.shield = 1; p.alive = true; run.strikes = 0; run.breached = false; secs += TICK;
      if (G.world.wave.state === 'dead' || G.world.wave.state === 'over') G.world.wave.state = 'fighting';
    }
    waves += (G.state.run?.wave || w0) - w0; if (G.state.run) endSortie('abandoned');
  }
  rows.push({ spot: label, x: x == null ? 'moves' : x, 'damage/min': +(dmg / (secs / 60)).toFixed(2), 'from shots/min': +(fromShots / (secs / 60)).toFixed(2), 'other/min': +((dmg - fromShots) / (secs / 60)).toFixed(2), 'waves cleared': waves });
}
console.table(rows);
console.log(`sector ${sector}, ${minutes} min x ${runs} runs each; damage is hull + shield lost (1 = a full bar)`);
