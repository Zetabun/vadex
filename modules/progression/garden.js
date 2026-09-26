// The Greenhouse (data/garden.js): its beds, the seeds in the drawer, what is growing, and the basket of blooms the next
// sortie takes. A plant's growth is worked out from when it was planted (and how often it was watered), so it grows while
// the game is closed. Bosses beaten in a sortie leave seeds, banked when it ends.
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { dayKey } from '@last-orbit/data/daily.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { BOSSES } from '@last-orbit/data/bosses.js';
import { VOID_BOSSES } from '@last-orbit/data/beacons.js';
import { SEEDS, SEED_BY_ID, bedsOpen, gardenOpen, wingOpen, WING_SPEED, WATER_BOOST, SEEDS_PER_SORTIE, STARTER_SEEDS, GARDEN_PAINT, seedsFor } from '@last-orbit/data/garden.js';

const HOUR = 3600000;
export const garden = (st = G.state) => (st.garden ||= { beds: [], seeds: {}, basket: {}, grown: {}, wateredDay: '', started: false });
/** How far the plant in a bed has grown, 0..1 (1: in bloom), or null for an empty bed. */
export function growth(st, i, now = Date.now()) { const p = garden(st).beds[i]; return p ? Math.min(1, Math.max(0, (now - p.at) / p.need + (p.extra || 0))) : null; }
/** Hours until a bed's plant blooms (0 once it has). */
export function hoursLeft(st, i, now = Date.now()) { const p = garden(st).beds[i], g = growth(st, i, now); return p && g < 1 ? ((1 - g) * p.need) / HOUR : 0; }
/** The first visit: a few seeds in the drawer to start with. */
export function startGarden(st = G.state) { const g = garden(st); if (g.started) return false; g.started = true; for (const id of STARTER_SEEDS) g.seeds[id] = (g.seeds[id] || 0) + 1; return true; }
/** Plant a seed from the drawer in an empty bed that is open (the second wing's six need the Solar wings). */
export function plant(st, i, id, now = Date.now()) {
  const g = garden(st), s = SEED_BY_ID[id]; if (!s || !(i >= 0 && i < bedsOpen(st)) || g.beds[i] || !(g.seeds[id] > 0)) return false;
  g.seeds[id]--; if (!g.seeds[id]) delete g.seeds[id];
  g.beds[i] = { id, at: now, need: (s.hours * HOUR) / (wingOpen(st) ? WING_SPEED : 1), extra: 0 }; return true;
}
/** Water the beds, once a day: every plant still growing moves on. 'watered', 'already' (today) or 'nothing' (growing). */
export function water(st = G.state, today = dayKey(), now = Date.now()) {
  const g = garden(st); if (g.wateredDay === today) return 'already';
  const growing = g.beds.map((p, i) => (p && growth(st, i, now) < 1 ? i : -1)).filter((i) => i >= 0); if (!growing.length) return 'nothing';
  g.wateredDay = today; for (const i of growing) g.beds[i].extra = (g.beds[i].extra || 0) + WATER_BOOST; return 'watered';
}
export const wateredToday = (st = G.state, today = dayKey()) => garden(st).wateredDay === today;
/** Harvest a bloom into the basket (growing every kind once pays the Verdant paint). { id, paint } or null. */
export function harvest(st, i, now = Date.now()) {
  const g = garden(st), p = g.beds[i]; if (!p || growth(st, i, now) < 1) return null;
  g.beds[i] = null; g.basket[p.id] = (g.basket[p.id] || 0) + 1; g.grown[p.id] = (g.grown[p.id] || 0) + 1; st.stats.harvests = (st.stats.harvests || 0) + 1;
  const paint = !st.paints[GARDEN_PAINT] && SEEDS.every((s) => g.grown[s.id]) ? GARDEN_PAINT : null; if (paint) st.paints[paint] = Date.now();
  return { id: p.id, paint };
}
/** The kinds in the basket: the next sortie takes one of each. */
export const basketNext = (st = G.state) => SEEDS.map((s) => s.id).filter((id) => garden(st).basket[id] > 0);
/** A sortie is starting: it takes one of every kind in the basket, each a boost for that sortie. */
export function takeBasket(st = G.state) { const b = garden(st).basket, out = basketNext(st); for (const id of out) { b[id]--; if (!b[id]) delete b[id]; } return out; }
/** Beds in bloom, beds empty (and open), plants still growing. */
export function gardenCounts(st = G.state, now = Date.now()) {
  const n = bedsOpen(st), out = { bloom: 0, empty: 0, growing: 0, next: Infinity };
  for (let i = 0; i < n; i++) { const g = growth(st, i, now); if (g == null) out.empty++; else if (g >= 1) out.bloom++; else { out.growing++; out.next = Math.min(out.next, hoursLeft(st, i, now)); } }
  return out;
}
export const seedCount = (st = G.state) => Object.values(garden(st).seeds).reduce((a, b) => a + b, 0);

// A boss falling in a sortie (not the Counterattack) leaves its seed once the Greenhouse is open; a Void boss leaves a
// Beacon lily too. They are banked when the sortie ends.
bus.on('bossDied', (w, boss) => {
  const st = G.state, run = st.run, id = boss.boss?.id; if (!run || run.mode || !BOSSES[id] || BOSSES[id].mini || !gardenOpen(st)) return;
  (run.seeds ||= []).push(...seedsFor(sectorOf(run.wave), VOID_BOSSES.includes(id)));
});
/** The sortie is over: it brings home the seeds of its two deepest bosses and every Beacon lily. Returns them. */
export function bankSeeds(st, run) {
  const found = run.seeds || [], home = [...found.filter((id) => SEED_BY_ID[id]?.tier !== 'answer').slice(-SEEDS_PER_SORTIE), ...found.filter((id) => SEED_BY_ID[id]?.tier === 'answer')];
  const g = garden(st); for (const id of home) g.seeds[id] = (g.seeds[id] || 0) + 1; return home;
}
