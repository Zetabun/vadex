// Relics (Relic Fragments, permanent through everything) and Alien Tech (Alien Matter, resets on Ascension only).
export const RELICS = [
  { id: 'r_lens', name: 'Star-glass lens', max: 20, cost: [1, 1.4], fx: [['critChance', 'add', 0.01], ['critDmg', 'add', 0.2]], desc: '+1% critical chance and +20% critical damage per level.' },
  { id: 'r_abacus', name: 'Merchant\'s abacus', max: 20, cost: [1, 1.4], fx: [['creditGain', 'pow', 1.25]], desc: '×1.25 Credits per level.' },
  { id: 'r_anvil', name: 'Cold anvil', max: 20, cost: [1, 1.4], fx: [['damage', 'pow', 1.25]], desc: '×1.25 damage per level.' },
  { id: 'r_clock', name: 'Stopped clock', max: 10, cost: [2, 1.6], fx: [['offlineEff', 'add', 0.03], ['offlineCap', 'add', 1]], desc: '+3% offline efficiency and +1h to the offline reward window per level.' },
  { id: 'r_seed', name: 'Hive seed', max: 10, cost: [2, 1.6], fx: [['droneDmg', 'pow', 1.3]], desc: '×1.3 drone damage per level.' },
  { id: 'r_die', name: 'Weighted die', max: 10, cost: [3, 1.6], fx: [['luck', 'add', 0.1]], desc: 'Better module rarity and more rare boons.' },
  { id: 'r_horn', name: 'War horn', max: 10, cost: [3, 1.7], fx: [['abilityPower', 'mult', 0.2], ['abilityCd', 'mult', -0.03]], desc: '+20% ability power, −3% cooldown per level.' },
  { id: 'r_prism', name: 'Shard prism', max: 10, cost: [5, 1.8], fx: [['shardGain', 'pow', 1.1]], desc: '×1.1 Chrono Shards per level.' },
];
export const ALIEN = [
  { id: 'x_bio', name: 'Living hull', max: 50, cost: [5, 1.35], fx: [['hull', 'pow', 1.3], ['hullRegen', 'add', 0.001]], desc: '×1.3 hull and +0.1% repair per level.' },
  { id: 'x_acid', name: 'Corrosive payloads', max: 50, cost: [5, 1.35], fx: [['damage', 'pow', 1.3]], desc: '×1.3 damage per level.' },
  { id: 'x_rot', name: 'Armour rot', max: 10, cost: [20, 1.8], fx: [['f.armourRot', 'add', 0.03]], desc: 'Each hit strips 3% of a target\'s armour per level. Fast weapons shred Ironclads.' },
  { id: 'x_nest', name: 'Drone nest', max: 3, cost: [200, 12], fx: [['droneBays', 'add', 1]], desc: '+1 drone bay per level.' },
  { id: 'x_echo', name: 'Death echo', max: 10, cost: [60, 1.9], fx: [['f.deathEcho', 'add', 0.05]], desc: 'Kills deal 5% of the victim\'s hull to its neighbours per level. Swarms eat themselves.' },
  { id: 'x_mind', name: 'Borrowed instincts', max: 10, cost: [100, 2], fx: [['fireRate', 'pow', 1.08], ['moveSpeed', 'pow', 1.05]], desc: '×1.08 fire rate per level.' },
  { id: 'x_yield', name: 'Matter lattice', max: 25, cost: [30, 1.5], fx: [['creditGain', 'pow', 1.5], ['matterGain', 'mult', 0.1]], desc: '×1.5 Credits and +10% Alien Matter per level.' },
];
