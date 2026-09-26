// Healing probe (v2.19): how much of the hull the pilot loses comes back, and from where, through the opening waves.
// A bot flies the Vanguard from a fresh save (or with an early Workshop) to a wave cap or its death, and the run's hull
// counters (run.hullBy: lost, regen, kit, leech, wind, card, wave, sector, route, revive, drone) are totalled per sector.
// Usage: node --experimental-loader ./tests/loader.mjs ./tests/heal-probe.mjs [runs] [dodge] [cards] [workshop] [cap]
//   cards: bot (the progression sim's picks) | heal (every healing card offered) | noheal (never a healing card)
//   workshop: fresh | early (what a pilot has bought after a handful of sorties, Repair Bay included)
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, nextRoute, pickRoute, nextAnomaly, pickAnomaly } from '@last-orbit/progression/run.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { TICK, BAL } from '@last-orbit/data/balance.js';
import { MOD_BY_ID } from '@last-orbit/data/cards.js';
// BALSET='{"regenPause":2}' and MODSET='{"m_regen":0.006}' try other numbers (a card's first effect's value).
Object.assign(BAL, JSON.parse(process.env.BALSET || '{}')); for (const [id, v] of Object.entries(JSON.parse(process.env.MODSET || '{}'))) MOD_BY_ID[id].fx[0][2] = v;

const N = Number(process.argv[2] || 20), dodge = Number(process.argv[3] ?? 0.5), cards = process.argv[4] || 'bot', shop = process.argv[5] || 'fresh', cap = Number(process.argv[6] || 30);
const HEAL = ['m_regen', 'm_leech', 'm_hull'];
const pickScore = (c) => c.kind === 'upgrade' ? 10 + (c.rank >= 4 ? 2 : 0) : c.kind === 'weapon' ? 9 : c.kind === 'mod' ? ({ m_dmg: 8, m_rate: 8, m_multi: 9, m_hull: 6, m_shield: 5, m_crit: 5, m_critd: 4 }[c.id] || 3) : 2;
const score = (c) => (cards === 'heal' && HEAL.includes(c.id) ? 50 : cards === 'noheal' && HEAL.includes(c.id) ? -50 : 0) + pickScore(c) + Math.random();
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = dodge; });
let over = false; bus.on('sortieOver', () => { over = true; });
const KINDS = ['lost', 'regen', 'kit', 'leech', 'wind', 'card', 'wave', 'sector'], sectors = [0, 1, 2].map(() => ({ runs: 0, full: 0, low: 0, ...Object.fromEntries(KINDS.map((k) => [k, 0])) }));
const ends = []; let deaths = 0, regenCards = 0;
for (let r = 0; r < N; r++) {
  G.state = newState(); G.state.meta.legacyChecked = true;
  if (shop === 'early') Object.assign(G.state.workshop, { w_dmg: 3, w_rate: 2, w_hull: 3, w_regen: 2, w_magnet: 1, w_speed: 1 });
  recalc(); startSortie({ seed: 5000 + r }); initWorld(); over = false;
  let t = 0, sec = -1, prev = {}, full = 0, secT = 0, low = 1;
  const close = () => { if (sec < 0 || sec > 2) return; const s = sectors[sec], hb = G.state.run?.hullBy || prev; s.runs++; s.full += full / Math.max(1, secT); s.low += low; for (const k of KINDS) s[k] += (hb[k] || 0) - (prev[k] || 0); prev = { ...hb }; };
  while (!over && t < 60 * 60) {
    if (nextOffer()) { const o = G.state.run.offer; let bi = 0; o.forEach((c, i) => { if (score(c) > score(o[bi])) bi = i; }); pickCard(bi); continue; }
    if (nextRelic()) { pickRelic(Math.floor(Math.random() * G.state.run.relicOffer.length)); continue; } if (nextRoute()) { pickRoute(0); continue; } if (nextAnomaly()) { pickAnomaly(0); continue; }
    const s = Math.floor((G.state.run.wave - 1) / 10); if (s !== sec) { close(); sec = s; full = 0; secT = 0; low = 1; }
    if (G.state.run.wave > cap) break;
    step(TICK); t += TICK; G.world.fx.length = 0; secT += TICK; const h = G.world.player.hull; if (h >= 0.999) full += TICK; low = Math.min(low, h);
    if (Math.random() < 0.02) for (const id of G.state.run.abilities) useAbility(G.world, id, true);
  }
  close(); if (over) deaths++; regenCards += G.state.run?.cards?.m_regen || 0; ends.push(G.state.run?.wave || 0); if (G.state.run) endSortie(over ? 'destroyed' : 'abandoned');
}
const pc = (v) => `${Math.round(v * 100)}%`;
console.log(`${N} runs · dodge ${dodge} · cards ${cards} · workshop ${shop} · cap wave ${cap} · died ${deaths}/${N} · median end wave ${ends.sort((a, b) => a - b)[N >> 1]} · Nanite Swarm cards ${(regenCards / N).toFixed(1)}/run`);
console.table(sectors.map((s, i) => { const n = Math.max(1, s.runs), heal = KINDS.slice(1, -1).reduce((a, k) => a + s[k], 0); /* during the sector: not the boss's full repair at its end */
  return { waves: `${i * 10 + 1}-${i * 10 + 10}`, runs: s.runs, 'hull lost': pc(s.lost / n), 'healed': pc(heal / n), 'heal/lost': pc(heal / Math.max(1e-9, s.lost)), regen: pc(s.regen / n), kits: pc(s.kit / n), leech: pc(s.leech / n), 'wave +6%': pc(s.wave / n), wind: pc(s.wind / n), cards: pc(s.card / n), 'boss repair': pc(s.sector / n), 'at full hull': pc(s.full / n), 'lowest hull': pc(s.low / n) }; }));
