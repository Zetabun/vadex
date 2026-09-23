// Run-bound Ship Level perks. A point is earned at levels 3, 5, 7, ... .
// Small capped bonuses keep the skill tree complementary to upgrades and Research.
export const SKILL_UNLOCK_WAVE = 8;
export const SKILL_TIER_WAVES = { 1: 8, 2: 12, 3: 20 };
export const SKILLS = [
  { id: 'calibration', branch: 'Offence', tier: 1, name: 'Calibration', icon: '◎', max: 5, desc: '+3% weapon damage per rank.', fx: [['damage', 'mult', 0.03]] },
  { id: 'rapid', branch: 'Offence', tier: 2, name: 'Rapid Cycling', icon: '⇈', max: 4, desc: '+2% fire rate per rank.', fx: [['fireRate', 'mult', 0.02]] },
  { id: 'precision', branch: 'Offence', tier: 2, name: 'Precision Array', icon: '✦', max: 3, desc: '+0.6 percentage points critical chance per rank.', fx: [['critChance', 'add', 0.006]] },
  { id: 'execution', branch: 'Offence', tier: 3, name: 'Execution Protocol', icon: '✹', max: 3, desc: '+4% damage against bosses per rank.', fx: [['bossDmg', 'mult', 0.04]] },
  { id: 'plating', branch: 'Defence', tier: 1, name: 'Adaptive Plating', icon: '⬡', max: 5, desc: '+4% hull per rank.', fx: [['hull', 'mult', 0.04]] },
  { id: 'repair', branch: 'Defence', tier: 2, name: 'Nanorepair', icon: '✚', max: 4, desc: '+0.15% maximum hull regeneration per second per rank.', fx: [['hullRegen', 'add', 0.0015]] },
  { id: 'barrier', branch: 'Defence', tier: 2, name: 'Capacitor Shield', icon: '◈', max: 3, desc: '+2% shield capacity relative to hull per rank.', fx: [['shieldRatio', 'add', 0.02]] },
  { id: 'siphon', branch: 'Defence', tier: 3, name: 'Vital Siphon', icon: '♥', max: 4, desc: 'Heal 0.6% maximum hull per enemy health bar dealt per rank, capped at 8% hull per second.', fx: [['lifeSteal', 'add', 0.006]] },
  { id: 'salvage', branch: 'Utility', tier: 1, name: 'Salvage Sense', icon: '¢', max: 5, desc: '+3% Credits per rank.', fx: [['creditGain', 'mult', 0.03]] },
  { id: 'scavenger', branch: 'Utility', tier: 2, name: 'Scavenger Grid', icon: '⚙', max: 4, desc: '+3% Scrap per rank.', fx: [['scrapGain', 'mult', 0.03]] },
  { id: 'momentum', branch: 'Utility', tier: 1, name: 'Vector Thrusters', icon: '➤', max: 4, desc: '+2% movement speed per rank.', fx: [['moveSpeed', 'mult', 0.02]] },
  { id: 'tactician', branch: 'Utility', tier: 3, name: 'Tactical Relay', icon: '⌁', max: 3, desc: 'Reduce ability cooldowns by 2% per rank.', fx: [['abilityCd', 'mult', -0.02]] },
];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map(skill => [skill.id, skill]));
// The central core is always allocated. Paths can split and reconnect; a real perk may be
// purchased when any connected neighbour has at least one rank. Future nodes are visual only.
export const SKILL_NODES = [
  { id: 'core', x: 700, y: 550, branch: 'core', name: 'Pilot Core', icon: '▲' },
  { id: 'calibration', x: 580, y: 450, branch: 'weapons' },
  { id: 'rapid', x: 450, y: 375, branch: 'weapons' },
  { id: 'precision', x: 590, y: 275, branch: 'weapons' },
  { id: 'execution', x: 320, y: 255, branch: 'weapons' },
  { id: 'plating', x: 820, y: 450, branch: 'defence' },
  { id: 'repair', x: 950, y: 375, branch: 'defence' },
  { id: 'barrier', x: 810, y: 275, branch: 'defence' },
  { id: 'siphon', x: 1080, y: 255, branch: 'defence' },
  { id: 'salvage', x: 580, y: 650, branch: 'salvage' },
  { id: 'scavenger', x: 450, y: 755, branch: 'salvage' },
  { id: 'momentum', x: 820, y: 650, branch: 'mobility' },
  { id: 'tactician', x: 950, y: 755, branch: 'mobility' },
  { id: 'blast_future', x: 185, y: 365, branch: 'weapons', name: 'Ballistics', icon: '✹', future: true },
  { id: 'crit_future', x: 490, y: 120, branch: 'weapons', name: 'Critical Cascade', icon: '✦', future: true },
  { id: 'guard_future', x: 925, y: 115, branch: 'defence', name: 'Guard Matrix', icon: '⬡', future: true },
  { id: 'leech_future', x: 1210, y: 365, branch: 'defence', name: 'Blood Circuit', icon: '♥', future: true },
  { id: 'ore_future', x: 325, y: 905, branch: 'salvage', name: 'Deep Mining', icon: '⚙', future: true },
  { id: 'drive_future', x: 1080, y: 905, branch: 'mobility', name: 'Afterburner', icon: '➤', future: true },
];
export const SKILL_NODE_BY_ID = Object.fromEntries(SKILL_NODES.map(node => [node.id, node]));
export const SKILL_LINKS = [
  ['core', 'calibration'], ['core', 'plating'], ['core', 'salvage'], ['core', 'momentum'],
  ['calibration', 'rapid'], ['calibration', 'precision'], ['rapid', 'execution'],
  ['plating', 'repair'], ['plating', 'barrier'], ['repair', 'siphon'],
  ['salvage', 'scavenger'], ['momentum', 'tactician'],
  ['precision', 'barrier'], ['scavenger', 'tactician'],
  ['rapid', 'blast_future'], ['precision', 'crit_future'], ['barrier', 'guard_future'],
  ['siphon', 'leech_future'], ['scavenger', 'ore_future'], ['tactician', 'drive_future'],
];
export const skillNeighbours = id => SKILL_LINKS.flatMap(([a, b]) => a === id ? [b] : b === id ? [a] : []);
export const skillPointsEarned = level => Math.max(0, Math.floor((Math.max(1, Math.floor(level)) - 1) / 2));
