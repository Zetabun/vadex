// Run-bound Ship Level perks. A point is earned at levels 3, 5, 7, ... .
// Small capped bonuses keep the skill tree complementary to upgrades and Research.
export const SKILL_UNLOCK_WAVE = 8;
export const SKILL_TIER_WAVES = { 1: 8, 2: 12, 3: 20 };
export const SKILLS = [
  { id: 'calibration', branch: 'Offence', tier: 1, name: 'Calibration', icon: '◎', max: 5, desc: '+3% weapon damage per rank.', fx: [['damage', 'mult', 0.03]] },
  { id: 'rapid', branch: 'Offence', tier: 2, name: 'Rapid Cycling', icon: '⇈', max: 4, req: ['calibration', 2], desc: '+2% fire rate per rank.', fx: [['fireRate', 'mult', 0.02]] },
  { id: 'precision', branch: 'Offence', tier: 2, name: 'Precision Array', icon: '✦', max: 3, req: ['calibration', 3], desc: '+0.6 percentage points critical chance per rank.', fx: [['critChance', 'add', 0.006]] },
  { id: 'execution', branch: 'Offence', tier: 3, name: 'Execution Protocol', icon: '✹', max: 3, req: ['rapid', 2], desc: '+4% damage against bosses per rank.', fx: [['bossDmg', 'mult', 0.04]] },
  { id: 'plating', branch: 'Defence', tier: 1, name: 'Adaptive Plating', icon: '⬡', max: 5, desc: '+4% hull per rank.', fx: [['hull', 'mult', 0.04]] },
  { id: 'repair', branch: 'Defence', tier: 2, name: 'Nanorepair', icon: '✚', max: 4, req: ['plating', 2], desc: '+0.15% maximum hull regeneration per second per rank.', fx: [['hullRegen', 'add', 0.0015]] },
  { id: 'barrier', branch: 'Defence', tier: 2, name: 'Capacitor Shield', icon: '◈', max: 3, req: ['plating', 3], desc: '+2% shield capacity relative to hull per rank.', fx: [['shieldRatio', 'add', 0.02]] },
  { id: 'siphon', branch: 'Defence', tier: 3, name: 'Vital Siphon', icon: '♥', max: 4, req: ['repair', 2], desc: 'Heal 0.6% maximum hull per enemy health bar dealt per rank, capped at 8% hull per second.', fx: [['lifeSteal', 'add', 0.006]] },
  { id: 'salvage', branch: 'Utility', tier: 1, name: 'Salvage Sense', icon: '¢', max: 5, desc: '+3% Credits per rank.', fx: [['creditGain', 'mult', 0.03]] },
  { id: 'scavenger', branch: 'Utility', tier: 2, name: 'Scavenger Grid', icon: '⚙', max: 4, req: ['salvage', 2], desc: '+3% Scrap per rank.', fx: [['scrapGain', 'mult', 0.03]] },
  { id: 'momentum', branch: 'Utility', tier: 2, name: 'Vector Thrusters', icon: '➤', max: 4, req: ['salvage', 2], desc: '+2% movement speed per rank.', fx: [['moveSpeed', 'mult', 0.02]] },
  { id: 'tactician', branch: 'Utility', tier: 3, name: 'Tactical Relay', icon: '⌁', max: 3, req: ['momentum', 2], desc: 'Reduce ability cooldowns by 2% per rank.', fx: [['abilityCd', 'mult', -0.02]] },
];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map(skill => [skill.id, skill]));
export const skillPointsEarned = level => Math.max(0, Math.floor((Math.max(1, Math.floor(level)) - 1) / 2));
