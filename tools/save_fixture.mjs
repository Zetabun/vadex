// Keeps a save made by this build (tests/saves/v<version>.json), so every later build is checked against it by
// tests/save-regression.mjs. A bot pilot flies a few sorties from a fresh save, spending salvage in the Workshop; then
// the rooms get some use (the Greenhouse planted, a bed grown and harvested, the day's bounties posted, a callsign and a
// station name) and a last sortie is left in flight, as if the tab were closed mid-run. Run it at every release:
//   node --experimental-loader ./tests/loader.mjs tools/save_fixture.mjs [version]   (default: the import map's version)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, nextRoute, pickRoute, nextAnomaly, pickAnomaly } from '@last-orbit/progression/run.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { workshopNext, buyWorkshop, setCallsign, setStationName, checkContracts, unlockCounter } from '@last-orbit/progression/meta.js';
import { startGarden, plant, water, harvest, garden } from '@last-orbit/progression/garden.js';
import { refreshBounties } from '@last-orbit/progression/bounties.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { TICK } from '@last-orbit/data/balance.js';

const version = process.argv[2] || /modules\/[^"]+\?v=([^"]+)"/.exec(readFileSync('index.html', 'utf8'))[1]; /* the import map's, not an icon's ?v= */
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = 1; });
let over = false; bus.on('sortieOver', () => { over = true; });
/** A sortie flown by the bot for up to maxT seconds (left in flight if it lasts that long). */
function fly(seed, maxT) {
  startSortie({ seed }); initWorld(); over = false; let t = 0;
  while (!over && t < maxT) {
    if (nextOffer()) { pickCard(0); continue; } if (nextRelic()) { pickRelic(0); continue; } if (nextRoute()) { pickRoute(0); continue; } if (nextAnomaly()) { pickAnomaly(0); continue; }
    step(TICK); t += TICK; G.world.fx.length = 0; if (Math.random() < 0.02) for (const id of G.state.run.abilities) useAbility(G.world, id, true);
  }
}
G.state = newState(); G.state.meta.legacyChecked = true; recalc(); setCallsign('Keeper'); setStationName('Keepsake');
for (let n = 1; n <= 8; n++) {
  fly(900 + n, 60 * 60 * 2); endSortie('destroyed');
  for (;;) { let best = null, cost = Infinity; for (const u of WORKSHOP) { const c = workshopNext(u.id); if (c != null && c < cost) { cost = c; best = u.id; } } if (!best || G.state.salvage < cost) break; buyWorkshop(best); }
}
checkContracts({ silent: true }); unlockCounter({ silent: true });
// the rooms in use: the Greenhouse planted, the first bed grown and harvested into the basket; the day's bounties posted
const now = Date.now(), g = garden(G.state); startGarden(G.state);
Object.keys(g.seeds).filter((k) => g.seeds[k] > 0).slice(0, 3).forEach((id, i) => plant(G.state, i, id, i ? now : now - 40 * 3600e3));
harvest(G.state, 0, now); water(G.state); refreshBounties(G.state);
// and a sortie still in flight, as if the tab were closed mid-run
fly(999, 90);
mkdirSync('tests/saves', { recursive: true }); const file = `tests/saves/v${version}.json`, text = JSON.stringify(G.state); writeFileSync(file, text);
console.log(`Kept ${file}: best wave ${G.state.stats.bestWave}, ${G.state.stats.sorties} sorties, a sortie in flight at wave ${G.state.run?.wave}, ${Math.round(text.length / 1024)} KB`);
