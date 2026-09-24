// Deep Void anomalies: past the last sector (wave 60), each new Deep Void sector makes the pilot take one of two
// anomalies. They stack for the rest of the sortie, and each raises the sortie's salvage and score by its pay, so how
// many a pilot can carry is the endless goal. Pay is tuned per anomaly with tests/void-sim.mjs so that taking one
// costs the pilot about as much Deep Void salvage as it pays back (elites drop their own loot, so Vanguard pays less). Experience is never boosted: the pay must not
// feed back into run power.
// world: enemy-side multipliers (as routes; repeats multiply). mech: a rule run by combat/anomalies.js.
// max: how many times it can be taken (repeats show as II, III).
export const ANOMALIES = [
  { id: 'hardened', name: 'Hardened Hulls', desc: 'Invaders have 20% more health.', world: { hp: 1.2 }, pay: 0.2, max: 3 },
  { id: 'overdrive', name: 'Overdrive', desc: 'Invaders fire 20% faster.', world: { fireRate: 1.2 }, pay: 0.2, max: 3 },
  { id: 'ordnance', name: 'Heavy Ordnance', desc: 'Invader fire hits 20% harder.', world: { dmg: 1.2 }, pay: 0.2, max: 3 },
  { id: 'march', name: 'Forced March', desc: 'Formations march 25% faster.', world: { formSpeed: 1.25 }, pay: 0.15, max: 2 },
  { id: 'vanguard', name: 'Elite Vanguard', desc: 'An extra elite in every wave.', world: { elites: 1 }, pay: 0.1, max: 2 },
  { id: 'serpent', name: 'Serpent Fire', desc: 'Invader bolts weave from side to side as they fall.', mech: 'snake', pay: 0.2, max: 1 },
  { id: 'minefield', name: 'Minefield', desc: 'Destroyed invaders sometimes leave a drifting mine.', mech: 'mines', pay: 0.2, max: 1 },
  { id: 'shrapnel', name: 'Shrapnel', desc: 'Destroyed invaders sometimes burst into a fan of bolts.', mech: 'shrapnel', pay: 0.2, max: 1 },
  { id: 'lances', name: 'Void Lances', desc: 'Every few seconds a beam locks onto your lane. Keep moving.', mech: 'lances', pay: 0.15, max: 1 },
  { id: 'wells', name: 'Gravity Wells', desc: 'Wells open on the defence line and drag your ship in.', mech: 'wells', pay: 0.2, max: 1 },
];
export const ANOMALY_BY_ID = Object.fromEntries(ANOMALIES.map((a) => [a.id, a]));
export const ANOMALY_CHOICES = 2;

// Rule strengths (see combat/anomalies.js).
export const VOID_RULES = {
  mines: { chance: 0.12, cap: 5, fuse: 3.4, radius: 7, drift: 9, dmg: 1.2 },
  shrapnel: { chance: 0.2, n: 4, fan: 0.7, speed: 24, dmg: 0.6 },
  lances: { every: 7, bossEvery: 9.5, telegraph: 1.2, dur: 0.5, width: 6, dmg: 1.4 },
  wells: { every: 14, dur: 4, pull: 14 },
  snake: { amp: 9, freq: 3 },
};

/** How many of each anomaly the run carries: { id: n }. */
export function anomalyCounts(run) { const out = {}; for (const id of run?.anomalies || []) out[id] = (out[id] || 0) + 1; return out; }
/** The salvage and score multiplier from the anomalies carried. */
export const anomalyPay = (run) => 1 + (run?.anomalies || []).reduce((s, id) => s + (ANOMALY_BY_ID[id]?.pay || 0), 0);
const ROMAN = ['', '', ' II', ' III'];
/** Display name with its stack, e.g. 'Hardened Hulls II'. */
export const anomalyName = (id, n = 1) => ANOMALY_BY_ID[id].name + (n > 1 ? ROMAN[n] || ' ' + n : '');
