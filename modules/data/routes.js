// Routes: after each sector boss the pilot chooses how to fly the next sector. Every route but Steady Course trades
// a risk for a reward, and lasts until that sector's boss falls.
// fx: player stat modifiers (card format). world: enemy-side multipliers (hp, dmg, fireRate, formSpeed) and extra elites.
// relic: extra relic choices at the sector boss. repair: hull repaired after every cleared wave. clearMul: wave clear salvage and score.
export const ROUTES = [
  { id: 'steady', name: 'Steady Course', desc: 'No changes. Hold the line.', art: 'ws:w_barrier' },
  { id: 'salvage', name: 'Salvage Run', desc: '+60% salvage, but invaders have 25% more health.', fx: [['salvageGain', 'pow', 1.6]], world: { hp: 1.25 }, art: 'mod:m_salvage' },
  { id: 'gauntlet', name: 'Elite Gauntlet', desc: 'An extra elite in every wave. Choose an extra relic at the boss.', world: { elites: 1 }, relic: 1, art: 'relic:r_crit' },
  { id: 'scholar', name: 'Scholar’s Path', desc: '+50% experience, but invaders hit 20% harder.', fx: [['xpGain', 'pow', 1.5]], world: { dmg: 1.2 }, art: 'mod:m_xp' },
  { id: 'overclock', name: 'Overclock', desc: 'You fire 25% faster. So do they.', fx: [['fireRate', 'pow', 1.25]], world: { fireRate: 1.25 }, art: 'mod:m_rate' },
  { id: 'supply', name: 'Supply Line', desc: 'Repair 15% hull after every wave, but −30% salvage.', fx: [['salvageGain', 'pow', 0.7]], repair: 0.15, art: 'mod:m_regen' },
  { id: 'blitz', name: 'Blitz', desc: 'Formations march 30% faster. Wave clears pay double salvage and score.', world: { formSpeed: 1.3 }, clearMul: 2, art: 'mod:m_speed' },
];
export const ROUTE_BY_ID = Object.fromEntries(ROUTES.map((r) => [r.id, r]));
