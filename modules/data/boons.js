// Run boons: pick 1 of N every few waves. Reset on rewind. tags drive auto-pick preferences.
export const BOONS = [
  { id: 'b_dmg', name: 'Hot loads', tag: 'offence', w: 10, max: 99, fx: [['damage', 'pow', 1.35]], desc: '+35% damage' },
  { id: 'b_rate', name: 'Greased actions', tag: 'offence', w: 10, max: 99, fx: [['fireRate', 'pow', 1.2]], desc: '+20% fire rate' },
  { id: 'b_crit', name: 'Hairline sights', tag: 'crit', w: 8, max: 6, fx: [['critChance', 'add', 0.08]], desc: '+8% critical chance' },
  { id: 'b_critd', name: 'Hollow points', tag: 'crit', w: 8, max: 99, fx: [['critDmg', 'add', 0.6]], desc: '+60% critical damage' },
  { id: 'b_pierce', name: 'Needle rounds', tag: 'offence', w: 5, max: 3, fx: [['pierce', 'add', 1]], desc: 'Projectiles pierce +1 target' },
  { id: 'b_multi', name: 'Splitter muzzle', tag: 'offence', w: 3, max: 2, fx: [['multishot', 'add', 1]], desc: '+1 projectile', rare: true },
  { id: 'b_critex', name: 'Frag criticals', tag: 'crit', w: 4, max: 1, fx: [['f.critExplode', 'add', 9]], desc: 'Critical hits explode', rare: true },
  { id: 'b_split', name: 'MIRV kit', tag: 'offence', w: 4, max: 1, fx: [['f.missileSplit', 'add', 2]], desc: 'Missiles split into 2 more', need: 'missile' },
  { id: 'b_drone', name: 'Wingman', tag: 'drone', w: 5, max: 3, fx: [['droneBays', 'add', 1], ['f.freeDrone', 'add', 1]], desc: '+1 attack drone for this run' },
  { id: 'b_droned', name: 'Overclocked drones', tag: 'drone', w: 6, max: 99, fx: [['droneDmg', 'pow', 1.5]], desc: '+50% drone damage', needDrones: true },
  { id: 'b_regen', name: 'Firing capacitors', tag: 'defence', w: 5, max: 1, fx: [['f.fireRegen', 'add', 1]], desc: 'Shields recharge even while under fire' },
  { id: 'b_hull', name: 'Bulkheads', tag: 'defence', w: 8, max: 99, fx: [['hull', 'pow', 1.4]], desc: '+40% hull' },
  { id: 'b_shield', name: 'Deflector mesh', tag: 'defence', w: 6, max: 99, fx: [['shieldRatio', 'add', 0.5]], desc: 'Shield +50% of hull' },
  { id: 'b_cred', name: 'War bonds', tag: 'economy', w: 9, max: 99, fx: [['creditGain', 'pow', 1.4]], desc: '+40% Credits' },
  { id: 'b_scrap', name: 'Magnet nets', tag: 'economy', w: 7, max: 99, fx: [['scrapGain', 'pow', 1.5], ['scrapChance', 'add', 0.03]], desc: '+50% Scrap, +3% drop chance' },
  { id: 'b_data', name: 'Black box taps', tag: 'economy', w: 7, max: 99, fx: [['dataGain', 'pow', 1.5]], desc: '+50% Research Data' },
  { id: 'b_boss', name: 'Giant killer', tag: 'boss', w: 6, max: 99, fx: [['bossDmg', 'pow', 1.6]], desc: '+60% boss damage' },
  { id: 'b_blast', name: 'Wide charges', tag: 'offence', w: 5, max: 5, fx: [['blast', 'pow', 1.25]], desc: '+25% blast radius' },
  { id: 'b_energy', name: 'Flux tap', tag: 'drone', w: 5, max: 5, fx: [['energyRegen', 'add', 2]], desc: '+2 Energy per second' },
  { id: 'b_cd', name: 'Quick cycling', tag: 'boss', w: 5, max: 5, fx: [['abilityCd', 'mult', -0.12]], desc: 'Abilities cool down 12% faster' },
  { id: 'b_killex', name: 'Chain reaction', tag: 'offence', w: 3, max: 1, fx: [['f.killExplode', 'add', 0.2]], desc: '20% of kills explode', rare: true },
  { id: 'b_return', name: 'Ricochet field', tag: 'offence', w: 3, max: 1, fx: [['f.bounceAll', 'add', 1]], desc: 'All projectiles bounce to one more enemy', rare: true },
  { id: 'b_focus', name: 'Ace pilot', tag: 'crit', w: 4, max: 3, fx: [['focusMax', 'add', 0.25]], desc: '+25% Focus cap from manual flying' },
  { id: 'b_shard', name: 'Causal debt', tag: 'economy', w: 3, max: 5, fx: [['shardGain', 'pow', 1.15]], desc: '+15% Chrono Shards from this run', rare: true, needRewind: true },
];
export const BOON_TAGS = [['offence', 'Offence'], ['crit', 'Critical'], ['drone', 'Drones'], ['defence', 'Defence'], ['economy', 'Economy'], ['boss', 'Boss killing']];

// Anomalies: a two-way choice that lasts the rest of the run (or an instant payout).
export const ANOMALIES = [
  { id: 'quantum', name: 'Quantum anomaly', text: 'Space folds in your favour. It will only fold once.', a: { label: '+50% fire rate', tag: 'offence', fx: [['fireRate', 'pow', 1.5]] }, b: { label: '+40% all resources', tag: 'economy', fx: [['creditGain', 'pow', 1.4], ['scrapGain', 'pow', 1.4], ['dataGain', 'pow', 1.4]] } },
  { id: 'derelict', name: 'Derelict cruiser', text: 'A dead warship drifts past with its holds open.', a: { label: 'Strip it for a module', tag: 'economy', module: 1 }, b: { label: 'Take the Scrap', tag: 'offence', scrapWaves: 25 } },
  { id: 'storm', name: 'Ion storm', text: 'Charged particles everywhere. Useful, if you can ground them.', a: { label: '+3 Energy a second', tag: 'drone', fx: [['energyRegen', 'add', 3]] }, b: { label: '+25% critical chance, −20% hull', tag: 'crit', fx: [['critChance', 'add', 0.25], ['hull', 'pow', 0.8]] } },
  { id: 'signal', name: 'Encrypted signal', text: 'Enemy command traffic, briefly readable.', a: { label: 'Research Data worth 15 waves', tag: 'economy', dataWaves: 15 }, b: { label: '+80% boss damage', tag: 'boss', fx: [['bossDmg', 'pow', 1.8]] } },
  { id: 'relic', name: 'Precursor vault', text: 'Older than the war. Older than the invaders.', a: { label: 'Take 2 Relic Fragments', tag: 'economy', fragments: 2 }, b: { label: '+60% damage', tag: 'offence', fx: [['damage', 'pow', 1.6]] } },
  { id: 'glass', name: 'Unstable reactor', text: 'You could run it past the red line.', a: { label: '×2 damage, −40% hull', tag: 'crit', fx: [['damage', 'pow', 2], ['hull', 'pow', 0.6]] }, b: { label: '+60% hull and shields', tag: 'defence', fx: [['hull', 'pow', 1.6]] } },
];
