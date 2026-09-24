// Threat levels: an optional difficulty ladder for experienced pilots. Every level adds its rule on top of all
// lower levels and raises the salvage and pilot XP a sortie pays. Threat I opens once a pilot reaches sector 4;
// each further level opens after defeating the sector 4 boss (wave 40) at the level below.
export const THREATS = [
  null,
  { roman: 'I', rule: 'Enemies have 30% more health', fx: { hp: 1.3 } },
  { roman: 'II', rule: 'Enemy fire hits 25% harder', fx: { dmg: 1.25 } },
  { roman: 'III', rule: 'An extra elite in every wave', fx: { elites: 1 } },
  { roman: 'IV', rule: 'Bosses have 50% more health', fx: { bossHp: 1.5 } },
  { roman: 'V', rule: 'Enemies fire 25% faster', fx: { fireRate: 1.25 } },
  { roman: 'VI', rule: 'Your hull is 20% weaker', fx: { hull: 0.8 } },
  { roman: 'VII', rule: 'Formations march 25% faster', fx: { formSpeed: 1.25 } },
  { roman: 'VIII', rule: 'Enemies have another 25% more health', fx: { hp: 1.25 } },
  { roman: 'IX', rule: 'A second extra elite in every wave', fx: { elites: 1 } },
  { roman: 'X', rule: 'Enemy fire hits another 25% harder', fx: { dmg: 1.25 } },
];
export const MAX_THREAT = THREATS.length - 1;
export const THREAT_UNLOCK_SECTOR = 4;
export const THREAT_GATE_WAVE = 40;
/** Combined modifiers of every threat level up to t. */
export function threatMods(t) {
  const m = { hp: 1, dmg: 1, elites: 0, bossHp: 1, fireRate: 1, hull: 1, formSpeed: 1 };
  for (let i = 1; i <= Math.min(t, MAX_THREAT); i++) for (const [k, v] of Object.entries(THREATS[i].fx)) m[k] = k === 'elites' ? m[k] + v : m[k] * v;
  return m;
}
export const threatSalvage = (t) => 1 + 0.2 * t;
export const threatPilotXp = (t) => 1 + 0.15 * t;
