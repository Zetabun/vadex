// Workshop: permanent upgrades bought with Salvage between sorties.
// cost(level) = base × growth^level, rounded. fx applies once per level.
export const WORKSHOP = [
  { id: 'w_dmg', name: 'Weapon Calibration', max: 10, base: 25, growth: 2.05, fx: [['damage', 'mult', 0.15]], per: '+15% damage' },
  { id: 'w_rate', name: 'Cycler Tuning', max: 10, base: 30, growth: 2.05, fx: [['fireRate', 'mult', 0.07]], per: '+7% fire rate' },
  { id: 'w_hull', name: 'Hull Plating', max: 10, base: 25, growth: 2.0, fx: [['hull', 'mult', 0.15]], per: '+15% hull' },
  { id: 'w_shield', name: 'Shield Emitter', max: 5, base: 120, growth: 2.3, fx: [['shieldRatio', 'add', 0.12]], per: 'Shield +12% of hull' },
  { id: 'w_crit', name: 'Targeting Suite', max: 5, base: 60, growth: 2.4, fx: [['critChance', 'add', 0.02], ['critDmg', 'add', 0.1]], per: '+2% crit, +10% crit damage' },
  { id: 'w_regen', name: 'Repair Bay', max: 5, base: 80, growth: 2.4, fx: [['hullRegen', 'add', 0.003]], per: 'Repair 0.3% hull a second' },
  { id: 'w_speed', name: 'Thruster Tuning', max: 5, base: 40, growth: 2.2, fx: [['moveSpeed', 'mult', 0.06]], per: '+6% move speed' },
  { id: 'w_magnet', name: 'Tractor Field', max: 5, base: 30, growth: 2.2, fx: [['magnet', 'mult', 0.18]], per: '+18% pickup range' },
  { id: 'w_xp', name: 'Flight School', max: 5, base: 70, growth: 2.4, fx: [['xpGain', 'mult', 0.08]], per: '+8% experience' },
  { id: 'w_salvage', name: 'Salvage Rights', max: 10, base: 50, growth: 1.9, fx: [['salvageGain', 'mult', 0.1]], per: '+10% salvage' },
  { id: 'w_barrier', name: 'Bunker Works', max: 4, base: 45, growth: 2.3, fx: [['barrier', 'mult', 0.25]], per: 'Bunkers +25% tougher' },
  { id: 'w_reroll', name: 'Tactical Reroll', max: 3, base: 90, growth: 3, fx: [['rerolls', 'add', 1]], per: '+1 card reroll per sortie' },
  { id: 'w_start', name: 'Veteran Crew', max: 3, base: 200, growth: 3, fx: [['startLevels', 'add', 1]], per: 'Start each sortie with +1 card' },
  { id: 'w_choice', name: 'Wide Briefing', max: 1, base: 4000, growth: 1, fx: [['cardChoices', 'add', 1]], per: '+1 option on every level-up' },
  { id: 'w_revive', name: 'Emergency Beacon', max: 1, base: 3000, growth: 1, fx: [['revives', 'add', 1]], per: 'Revive once per sortie' },
];
export const WORKSHOP_BY_ID = Object.fromEntries(WORKSHOP.map((u) => [u.id, u]));
export const workshopCost = (def, lvl) => Math.round(def.base * Math.pow(def.growth, lvl) / 5) * 5 || def.base;
