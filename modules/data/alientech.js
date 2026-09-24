// Alien Tech: upgrades built from Alien Cores, which only Counterattack stars pay. They work in both modes, so the
// shmup feeds the main game without being a better salvage farm.
export const ALIEN_TECH = [
  { id: 'x_alloy', name: 'Xeno Alloy', max: 5, cost: 2, fx: [['damage', 'mult', 0.08], ['hull', 'mult', 0.08]], per: '+8% damage and hull', art: 'relic:r_quantum' },
  { id: 'x_phase', name: 'Phase Drive', max: 3, cost: 3, fx: [['dashCd', 'mult', -0.15]], per: 'Dash recharges 15% faster', art: 'mod:m_speed' },
  { id: 'x_charts', name: 'Star Charts', max: 2, cost: 2, fx: [['warpCards', 'add', 2]], per: '+2 catch-up cards per sector when warping', art: 'ws:w_choice' },
  { id: 'x_siphon', name: 'Core Siphon', max: 3, cost: 2, fx: [['salvageGain', 'mult', 0.1]], per: '+10% salvage', art: 'mod:m_salvage' },
];
export const ALIEN_BY_ID = Object.fromEntries(ALIEN_TECH.map((u) => [u.id, u]));
