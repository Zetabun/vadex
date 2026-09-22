// Small deterministic RNG (mulberry32) so waves are reproducible from run seed + wave.
export function makeRng(seed) {
  let a = seed >>> 0;
  const r = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  r.weighted = (items, wf) => { let tot = 0; for (const it of items) tot += wf(it); let x = r() * tot; for (const it of items) { x -= wf(it); if (x <= 0) return it; } return items[items.length - 1]; };
  return r;
}
/** Non-deterministic rng for loot and cosmetics. */
export const rand = makeRng((Date.now() ^ 0x9e3779b9) >>> 0);
