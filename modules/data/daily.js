// The Daily Sortie: one attempt a day on a shared seed with a twist (mutator). Finishing it pays a bonus that grows
// with the wave reached and with the pilot's daily streak, and doubles the sortie's pilot XP.
// fx: stat modifiers for the run (same format as cards); world: enemy-side modifiers; start: opening bonuses.
export const MUTATORS = [
  { id: 'glass', name: 'Glass Cannon', desc: 'Double damage, but half the hull.', fx: [['damage', 'pow', 2], ['hull', 'pow', 0.5]] },
  { id: 'overclock', name: 'Overclock', desc: 'You and the invaders both fire 50% faster.', fx: [['fireRate', 'pow', 1.5]], world: { fireRate: 1.5 } },
  { id: 'arsenal', name: 'Loaded', desc: 'Launch with a second, random weapon from the whole armoury.', start: { weapon: 1 } },
  { id: 'elite', name: 'Elite Squadron', desc: 'An extra elite in every wave. +50% salvage.', fx: [['salvageGain', 'pow', 1.5]], world: { elites: 1 } },
  { id: 'carrier', name: 'Carrier Group', desc: 'Launch with three attack drones, but guns deal 25% less damage.', fx: [['drones', 'add', 3], ['damage', 'pow', 0.75]] },
  { id: 'veteran', name: 'Veteran Start', desc: 'Launch with four upgrades, but invaders have 40% more health.', start: { cards: 4 }, world: { hp: 1.4 } },
  { id: 'bloodmoon', name: 'Blood Moon', desc: 'Heal 6% of damage dealt, but 30% less hull.', fx: [['lifeSteal', 'add', 0.06], ['hull', 'pow', 0.7]] },
  { id: 'rush', name: 'Rush Hour', desc: 'Formations march 40% faster. +40% experience.', fx: [['xpGain', 'pow', 1.4]], world: { formSpeed: 1.4 } },
];
export const MUTATOR_BY_ID = Object.fromEntries(MUTATORS.map((m) => [m.id, m]));

/** Local calendar day, e.g. '2026-09-24'. */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function prevDayKey(key) { const [y, m, d] = key.split('-').map(Number), t = new Date(y, m - 1, d); t.setDate(t.getDate() - 1); return dayKey(t); }
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/** Seed and mutator for a day: the same for every pilot. */
export const dailyFor = (key = dayKey()) => { const h = hash('last-orbit:' + key); return { key, seed: h & 0x7fffffff, mutator: MUTATORS[h % MUTATORS.length] }; };
/** Salvage bonus for finishing the daily: grows with the wave reached and the streak (+10% a day, up to double). */
export const dailyBonus = (wave, streak) => Math.round((150 + wave * 12) * (1 + Math.min(10, Math.max(0, streak - 1)) * 0.1));
