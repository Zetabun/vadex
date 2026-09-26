// Materials economy probe: how many days of play it takes to afford every refit on every ship (data/refits.js), from
// sorties alone and with Fleet expeditions (data/fleet.js) too. Sortie income is what tests/balance-sim.mjs-style bots
// measured per sortie with a maxed Workshop (MATS env to override, as JSON); expeditions are sent at each check-in to the
// route that fits before the next one, bringing whichever material is furthest behind, with repairs (Alloy for heavy
// damage) paid from the bank at the expected rate. Not part of the release checks.
//   node --experimental-loader ./tests/loader.mjs tests/economy-probe.mjs
import { SHIPS } from '@last-orbit/data/ships.js';
import { REFIT_STEPS } from '@last-orbit/data/refits.js';
import { DESTINATIONS, DAMAGE, BERTHS } from '@last-orbit/data/fleet.js';

const PER_SORTIE = JSON.parse(process.env.MATS || '{"alloy":17,"crystal":22,"shard":13}');
const need = { alloy: 0, crystal: 0, shard: 0 };
for (let k = 0; k < SHIPS.length; k++) for (const s of REFIT_STEPS) for (const [id, n] of Object.entries(s.cost)) need[id] += n;
const PLAYERS = [
  { name: 'Casual (3 sorties, 2 check-ins a day)', sorties: 3, checks: [8, 19] },
  { name: 'Keen (6 sorties, 4 check-ins a day)', sorties: 6, checks: [8, 12, 17, 22] },
];
function days(p, fleet) {
  const bank = { alloy: 0, crystal: 0, shard: 0 }, berths = Array(BERTHS).fill(null), short = () => Object.keys(need).sort((a, b) => (bank[a] - need[a]) / need[a] - (bank[b] - need[b]) / need[b])[0];
  for (let day = 0; day < 200; day++) {
    for (const [id, n] of Object.entries(PER_SORTIE)) bank[id] += n * p.sorties;
    if (fleet) p.checks.forEach((h, c) => {
      const now = day * 24 + h, next = c + 1 < p.checks.length ? day * 24 + p.checks[c + 1] : (day + 1) * 24 + p.checks[0];
      for (let b = 0; b < BERTHS; b++) {
        const o = berths[b];
        if (o && o.back <= now) { bank[o.d.mat] += o.d.matN; bank.alloy -= o.d.risk * o.d.heavy * DAMAGE[2].alloy; berths[b] = null; }
        if (!berths[b]) { const want = short(), fits = DESTINATIONS.filter((d) => d.hours <= next - now), pick = fits.filter((d) => d.mat === want).sort((a, b2) => b2.matN - a.matN)[0] || fits.sort((a, b2) => b2.matN - a.matN)[0]; if (pick) berths[b] = { d: pick, back: now + pick.hours }; }
      }
    });
    if (Object.keys(need).every((id) => bank[id] >= need[id])) return day + 1;
  }
  return Infinity;
}
console.log(`Every refit on all ${SHIPS.length} ships: ${need.alloy} Alloy, ${need.crystal} Crystal, ${need.shard} Void shards. Per sortie: ${JSON.stringify(PER_SORTIE)}`);
for (const p of PLAYERS) console.log(`${p.name}: ${days(p, false)} days from sorties alone, ${days(p, true)} with expeditions`);
