// Persistent materials ladder. New raw materials appear as the front line advances,
// while one shared smelter turns them into collected bars. The curve deliberately
// mirrors classic mining idlers: frequent ore discoveries, progressively heavier
// recipes, and upgrade requirements that move through the material ladder.
export const MATERIALS = {
  basicSmelterCost: 75,
  basicSmelterOreCost: 10,
  smeltSpeedGrowth: 1.10,   // each calibration level divides cycle time by this
  calibrationPerMaterial: 2,
  autoLoadWave: 12,
  autoCollectWave: 22,
  extractorWave: 60,
  baseMineRate: 0.05,       // selected ore / real second after extractor
  mineRateGrowth: 1.50,
};

export const MATERIAL_TIERS = [
  { id: 'iron',      name: 'Iron',      unlockWave: 1,  oreCur: 'ore',          barCur: 'iron',      orePerBar: 10,  smeltTime: 75,  color: '#9aa3ad', hex: 0x9aa3ad },
  { id: 'copper',    name: 'Copper',    unlockWave: 5,  oreCur: 'copperOre',    barCur: 'copper',    orePerBar: 12,  smeltTime: 90,  color: '#b87345', hex: 0xb87345 },
  { id: 'silver',    name: 'Silver',    unlockWave: 10, oreCur: 'silverOre',    barCur: 'silver',    orePerBar: 15,  smeltTime: 110, color: '#d9e1e8', hex: 0xd9e1e8 },
  { id: 'gold',      name: 'Gold',      unlockWave: 15, oreCur: 'goldOre',      barCur: 'gold',      orePerBar: 18,  smeltTime: 135, color: '#e7bd4f', hex: 0xe7bd4f },
  { id: 'cobalt',    name: 'Cobalt',    unlockWave: 20, oreCur: 'cobaltOre',    barCur: 'cobalt',    orePerBar: 22,  smeltTime: 165, color: '#527bd8', hex: 0x527bd8 },
  { id: 'titanium',  name: 'Titanium',  unlockWave: 25, oreCur: 'titaniumOre',  barCur: 'titanium',  orePerBar: 27,  smeltTime: 200, color: '#b8c8d2', hex: 0xb8c8d2 },
  { id: 'iridium',   name: 'Iridium',   unlockWave: 30, oreCur: 'iridiumOre',   barCur: 'iridium',   orePerBar: 33,  smeltTime: 245, color: '#8c78d8', hex: 0x8c78d8 },
  { id: 'palladium', name: 'Palladium', unlockWave: 35, oreCur: 'palladiumOre', barCur: 'palladium', orePerBar: 40,  smeltTime: 300, color: '#c9eee7', hex: 0xc9eee7 },
  { id: 'uranium',   name: 'Uranium',   unlockWave: 40, oreCur: 'uraniumOre',   barCur: 'uranium',   orePerBar: 48,  smeltTime: 365, color: '#83d95b', hex: 0x83d95b },
  { id: 'platinum',  name: 'Platinum',  unlockWave: 45, oreCur: 'platinumOre',  barCur: 'platinum',  orePerBar: 58,  smeltTime: 445, color: '#e3e4dc', hex: 0xe3e4dc },
  { id: 'tungsten',  name: 'Tungsten',  unlockWave: 50, oreCur: 'tungstenOre',  barCur: 'tungsten',  orePerBar: 70,  smeltTime: 540, color: '#6f7780', hex: 0x6f7780 },
  { id: 'osmium',    name: 'Osmium',    unlockWave: 55, oreCur: 'osmiumOre',    barCur: 'osmium',    orePerBar: 84,  smeltTime: 660, color: '#7098ad', hex: 0x7098ad },
  { id: 'neutronium',name: 'Neutronium',unlockWave: 60, oreCur: 'neutroniumOre',barCur: 'neutronium',orePerBar: 100, smeltTime: 800, color: '#9a8cff', hex: 0x9a8cff },
];
export const MATERIAL_BY_ID = Object.fromEntries(MATERIAL_TIERS.map((m) => [m.id, m]));

/** Current raw-material band. Wave 60+ stays on Neutronium until the next material world is added. */
export function materialForWave(wave) {
  wave = Math.max(1, Math.floor(Number(wave) || 1));
  let out = MATERIAL_TIERS[0];
  for (const m of MATERIAL_TIERS) { if (wave >= m.unlockWave) out = m; else break; }
  return out;
}
export const materialIndex = (id) => Math.max(0, MATERIAL_TIERS.findIndex((m) => m.id === id));
export const materialAtCalibrationLevel = (lvl) => MATERIAL_TIERS[Math.min(MATERIAL_TIERS.length - 1, Math.floor(Math.max(0, lvl) / MATERIALS.calibrationPerMaterial))];

export const MATERIAL_UPGRADES = [
  { id: 'furnace', name: 'Furnace Calibration', max: MATERIAL_TIERS.length * MATERIALS.calibrationPerMaterial, dynamicMaterial: true, desc: 'Smelting speed ×1.10 per level. Every two levels move the bar requirement to the next discovered material.' },
  { id: 'autoLoad', name: 'Auto-loader', max: 1, cost: [2, 1], bar: 'silver', wave: 12, desc: 'Automatically loads the selected ore whenever the smelter is empty.' },
  { id: 'autoCollect', name: 'Output Conveyor', max: 1, cost: [3, 1], bar: 'cobalt', wave: 22, desc: 'Automatically transfers finished bars into storage.' },
  { id: 'extractor', name: 'Ore Extractor', max: 1, cost: [5, 1], bar: 'osmium', wave: 60, desc: 'Unlocks passive extraction of the selected ore at 0.05 Ore/s.' },
  { id: 'extractorRate', name: 'Mining Array', max: 12, cost: [2, 1.8], bar: 'neutronium', wave: 60, req: 'extractor', desc: 'Selected-ore extraction ×1.50 per level.' },
  { id: 'ironFrame', name: 'Iron Frame', max: 3, cost: [1, 2], bar: 'iron', wave: 4, fx: [['hull', 'mult', 0.035]], desc: '+3.5% hull per level. Permanent across Rewinds.' },
  { id: 'copperCoils', name: 'Copper Coils', max: 3, cost: [1, 2], bar: 'copper', wave: 6, fx: [['energyRegen', 'add', 0.4]], desc: '+0.4 Energy per second per level. Permanent across Rewinds.' },
  { id: 'silverOptics', name: 'Silver Optics', max: 3, cost: [1, 2], bar: 'silver', wave: 11, fx: [['critChance', 'add', 0.004]], desc: '+0.4 percentage points critical chance per level.' },
  { id: 'goldContacts', name: 'Gold Contacts', max: 3, cost: [1, 2], bar: 'gold', wave: 16, fx: [['creditGain', 'mult', 0.025]], desc: '+2.5% Credits per level. Permanent across Rewinds.' },
  { id: 'cobaltBank', name: 'Cobalt Capacitors', max: 3, cost: [1, 2], bar: 'cobalt', wave: 21, fx: [['shieldRatio', 'add', 0.015]], desc: '+1.5% shield capacity relative to hull per level.' },
  { id: 'titaniumBore', name: 'Titanium Bore', max: 3, cost: [1, 2], bar: 'titanium', wave: 26, fx: [['armorPen', 'add', 0.012]], desc: '+1.2 percentage points armour penetration per level.' },
];
