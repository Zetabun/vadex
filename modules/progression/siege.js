// Station Siege results. The gunner seat (rendering/gunner.js) fights the siege; when it ends, the hangar files the result
// here. Holding a tier pays stars (an Alien Core each), salvage by the hull kept (double the first time), Blueprints and a
// turret upgrade the guns keep for good the first time, and gets the crews repairing any damage. Losing one knocks some
// of the station's systems offline until they are repaired: for salvage in Defence Control, or free, by the crews, while
// the pilot is out on a sortie of a minute or more. The Workshop itself is never touched.
import { G, count, maxStat } from '@last-orbit/core/game.js';
import { TIER_BY_N, SIEGE_STARS, SIEGE_BLUEPRINTS, SIEGE_CORES_PER_STAR, SYSTEM_BY_ID, siegePay, siegeSystems } from '@last-orbit/data/siege.js';
import { checkContracts, checkAchievements } from '@last-orbit/progression/meta.js';

/** How long a sortie must last for the crews to finish their repairs while the pilot is out (seconds). */
export const PATCH_TIME = 60;

/** File a finished siege. result: { tier, won, hull, kills, score, cargo }. pick: the dice for which systems a loss
 *  knocks out. Returns what it earned or cost, for the end card. */
export function settleSiege(result, pick = Math.random) {
  const st = G.state, sg = (st.siege ||= { stars: {}, best: {}, won: {}, wins: 0 }), t = TIER_BY_N[result.tier], n = t.n, hull = Math.max(0, Math.min(1, result.hull || 0));
  sg.won ||= {}; sg.stars ||= {}; sg.best ||= {}; sg.kills = (sg.kills || 0) + (result.kills || 0); count('siegeRuns');
  const score = Math.round(result.score || 0), best = sg.best[n] || 0; if (score > best) sg.best[n] = score;
  const out = { tier: n, name: t.name, won: !!result.won, hull, score, kills: result.kills || 0, newBest: score > best && score > 0 };
  if (result.won) {
    const earned = SIEGE_STARS.filter(([, need]) => hull >= need).length, prev = sg.stars[n] || 0, gained = Math.max(0, earned - prev), first = !sg.won[n];
    if (earned > prev) sg.stars[n] = earned;
    const cores = gained * SIEGE_CORES_PER_STAR; st.counter.cores = (st.counter.cores || 0) + cores;
    const bp = first ? SIEGE_BLUEPRINTS : 0; if (bp) { st.prestige.bp += bp; st.prestige.bpEarned = (st.prestige.bpEarned || 0) + bp; }
    const salvage = siegePay(t, hull, first, result.cargo || 0); st.salvage += salvage; st.stats.totalSalvage = (st.stats.totalSalvage || 0) + salvage;
    const repaired = sg.damage?.ids?.length ? sg.damage.ids.slice() : []; sg.damage = null; // the invaders beaten, the crews get to work
    sg.won[n] = 1; sg.wins = (sg.wins || 0) + 1; count('siegeWins'); maxStat('siegeBest', n);
    Object.assign(out, { stars: earned, gained, cores, bp, salvage, first, gun: first ? t.gun : null, repaired });
  } else {
    // some of what is online goes down (never the cargo hold: it only pays), on top of any damage still unrepaired
    const online = siegeSystems(st).list.filter((x) => x.state && x.sys.id !== 'w_salvage').map((x) => x.sys.id), broke = [];
    while (broke.length < t.breaks && online.length) broke.push(online.splice(Math.floor(pick() * online.length), 1)[0]);
    const was = sg.damage;
    if (broke.length) sg.damage = { ids: [...(was?.ids || []), ...broke], tier: Math.max(was?.tier || 0, n), cost: Math.max(was?.cost || 0, t.repair) };
    count('siegeLosses');
    Object.assign(out, { stars: 0, broke, cost: sg.damage?.cost || 0 });
  }
  checkContracts(); checkAchievements();
  return out;
}

/** Pay to repair the station now (Defence Control). True if it was damaged and the salvage was there. */
export function repairStation() {
  const st = G.state, d = st.siege?.damage; if (!d?.ids?.length || st.salvage < d.cost) return false;
  st.salvage -= d.cost; st.siege.damage = null; count('siegeRepairs'); return true;
}

/** A sortie has ended: if it lasted long enough, the crews finished the repairs while the pilot was out. Returns the
 *  names of the systems back online (empty if nothing was damaged), or null if the sortie was too short to finish them. */
export function patchStation(time) {
  const st = G.state, d = st.siege?.damage; if (!d?.ids?.length) return [];
  if (time < PATCH_TIME) return null;
  st.siege.damage = null; return d.ids.map((id) => SYSTEM_BY_ID[id]?.name || id);
}
