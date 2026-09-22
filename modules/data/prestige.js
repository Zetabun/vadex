// Chrono Rewind tree (paid in Chrono Shards, permanent until Ascension) and the Ascension constellation (Stellar Sigils, permanent).
// Same fx format as research. tier groups nodes visually; req lists prerequisite ids.
export const PRESTIGE = [
  // tier 1: first rewind
  { id: 'p_dmg', tier: 1, name: 'Remembered ballistics', max: 50, cost: [1, 1.4], fx: [['damage', 'pow', 1.45]], desc: '\u00d71.45 damage per level. Permanent, and it compounds.' },
  { id: 'p_cred', tier: 1, name: 'Remembered contracts', max: 50, cost: [1, 1.4], fx: [['creditGain', 'pow', 1.45]], desc: '\u00d71.45 Credits per level.' },
  { id: 'p_auto', tier: 1, name: 'Muscle memory', max: 1, cost: [2, 1], fx: [['f.autofire', 'add', 1], ['f.autopilot', 'add', 1], ['f.buy10', 'add', 1]], desc: 'Start every run with Autofire, Autopilot and ×10 orders.' },
  { id: 'p_start', tier: 1, name: 'Seed funding', max: 10, cost: [2, 1.8], fx: [['startCredits', 'add', 1]], desc: 'Start with Credits worth several waves of your best sector. Scales with your best wave.' },
  { id: 'p_hull', tier: 1, name: 'Remembered armour', max: 50, cost: [1, 1.4], fx: [['hull', 'pow', 1.45]], desc: '\u00d71.45 hull per level.' },
  // tier 2
  { id: 'p_skip', tier: 2, name: 'Forward base', max: 10, cost: [5, 1.9], req: ['p_dmg'], fx: [['startWave', 'add', 5]], desc: 'Start 5 waves further in per level (never past 60% of your best wave).' },
  { id: 'p_shard', tier: 2, name: 'Shard lattice', max: 25, cost: [6, 1.5], req: ['p_cred'], fx: [['shardGain', 'mult', 0.15]], desc: '+15% Chrono Shards per level.' },
  { id: 'p_data', tier: 2, name: 'Archived findings', max: 25, cost: [4, 1.5], req: ['p_cred'], fx: [['dataGain', 'pow', 1.4]], desc: '\u00d71.4 Research Data per level.' },
  { id: 'p_scrap', tier: 2, name: 'Stockpiles', max: 25, cost: [4, 1.5], req: ['p_cred'], fx: [['scrapGain', 'pow', 1.4]], desc: '\u00d71.4 Scrap per level.' },
  { id: 'p_drone', tier: 2, name: 'Standing wing', max: 1, cost: [15, 1], req: ['p_auto'], fx: [['droneBays', 'add', 2], ['f.droneKeep', 'add', 1]], desc: 'Two drone bays are permanently unlocked from wave 1.' },
  { id: 'p_autobuy', tier: 2, name: 'Quartermaster', max: 1, cost: [20, 1], req: ['p_auto'], fx: [['f.autoBuy', 'add', 1], ['f.buy25', 'add', 1]], desc: 'Procurement AI and ×25 orders from the start of every run.' },
  { id: 'p_off', tier: 2, name: 'Night watch', max: 5, cost: [8, 2], req: ['p_hull'], fx: [['offlineEff', 'add', 0.06], ['offlineCap', 'add', 2]], desc: '+6% offline efficiency and +2h to the offline reward window per level.' },
  // tier 3
  { id: 'p_slot', tier: 3, name: 'Twin mounts', max: 1, cost: [60, 1], req: ['p_skip'], fx: [['weaponSlots', 'add', 1]], desc: 'A permanent extra weapon slot.' },
  { id: 'p_mod', tier: 3, name: 'Expanded chassis', max: 3, cost: [40, 6], req: ['p_drone'], fx: [['moduleSlots', 'add', 1]], desc: '+1 Experimental module slot per level.' },
  { id: 'p_core', tier: 3, name: 'Core vault', max: 1, cost: [50, 1], req: ['p_scrap'], fx: [['f.keepCores', 'add', 1]], desc: 'Boss Cores survive a rewind.' },
  { id: 'p_keepw', tier: 3, name: 'Armoury records', max: 1, cost: [80, 1], req: ['p_scrap'], fx: [['f.keepWeapons', 'add', 1]], desc: 'Weapon unlocks survive a rewind (levels still reset).' },
  { id: 'p_res', tier: 3, name: 'Indexed archive', max: 1, cost: [120, 1], req: ['p_data'], fx: [['f.keepAuto', 'add', 1]], desc: 'The whole Automation research branch survives a rewind.' },
  { id: 'p_prio', tier: 3, name: 'Veteran gunnery AI', max: 1, cost: [45, 1], req: ['p_autobuy'], fx: [['f.priority', 'add', 1], ['aimAssist', 'add', 1], ['autoDodge', 'add', 1]], desc: 'Priority targeting, aim assist and evasive routines from wave 1.' },
  { id: 'p_crit', tier: 3, name: 'Fault lines', max: 20, cost: [25, 1.5], req: ['p_dmg'], fx: [['critDmg', 'add', 0.25]], desc: '+25% critical damage per level.' },
  { id: 'p_boss', tier: 3, name: 'Known quantities', max: 20, cost: [25, 1.5], req: ['p_dmg'], fx: [['bossDmg', 'pow', 1.4]], desc: '\u00d71.4 boss damage per level.' },
  // tier 4
  { id: 'p_autorew', tier: 4, name: 'Causal autopilot', max: 1, cost: [500, 1], req: ['p_res'], fx: [['f.autoRewind', 'add', 1]], desc: 'Auto-rewind rules: rewind by shard gain, wave or run time.' },
  { id: 'p_boon', tier: 4, name: 'Branching futures', max: 2, cost: [300, 10], req: ['p_shard'], fx: [['boonChoices', 'add', 1]], desc: '+1 boon to choose from per level.' },
  { id: 'p_boonf', tier: 4, name: 'Dense timeline', max: 1, cost: [800, 1], req: ['p_boon'], fx: [['boonEvery', 'add', -3]], desc: 'Boons arrive every 7 waves instead of 10.' },
  { id: 'p_drone2', tier: 4, name: 'Carrier refit', max: 4, cost: [400, 3], req: ['p_mod'], fx: [['droneBays', 'add', 1], ['droneDmg', 'mult', 0.5]], desc: '+1 drone bay and +50% drone damage per level.' },
  { id: 'p_fast', tier: 4, name: 'Compressed time', max: 3, cost: [250, 5], req: ['p_skip'], fx: [['waveHaste', 'add', 0.25]], desc: 'Formations arrive 25% sooner per level.' },
  { id: 'p_abil', tier: 4, name: 'Charged reserves', max: 1, cost: [350, 1], req: ['p_prio'], fx: [['abilityCharges', 'add', 1]], desc: 'Every ability holds a second charge.' },
  { id: 'p_matter', tier: 4, name: 'Xeno familiarity', max: 25, cost: [1000, 1.6], req: ['p_core'], fx: [['matterGain', 'mult', 0.3]], desc: '+30% Alien Matter per level.' },
  // tier 5
  { id: 'p_slot4', tier: 5, name: 'Broadside', max: 1, cost: [25000, 1], req: ['p_slot'], fx: [['weaponSlots', 'add', 1]], desc: 'Another weapon slot.' },
  { id: 'p_omni', tier: 5, name: 'Paradox engine', max: 100, cost: [2500, 1.3], req: ['p_crit', 'p_boss'], fx: [['damage', 'pow', 2.5], ['creditGain', 'pow', 2]], desc: '\u00d72.5 damage and \u00d72 Credits per level. The long game.' },
  { id: 'p_offx', tier: 5, name: 'Closed loop', max: 5, cost: [8000, 3], req: ['p_off'], fx: [['offlineEff', 'add', 0.1]], desc: '+10% offline efficiency per level. Yes, past 100%.' },
  { id: 'p_asc', tier: 5, name: 'Stellar cartography', max: 1, cost: [4e5, 1], req: ['p_omni'], fx: [['f.ascension', 'add', 1]], desc: 'Reveals what lies above the timeline.' },
];

export const ASCENSION = [
  { id: 's_all', name: 'North Star', max: 100, cost: [1, 1.25], fx: [['damage', 'pow', 4], ['creditGain', 'pow', 4], ['hull', 'pow', 4]], desc: '×4 damage, Credits and hull per level.' },
  { id: 's_shard', name: 'The Hourglass', max: 25, cost: [1, 1.35], fx: [['shardGain', 'pow', 1.35]], desc: '×1.35 Chrono Shards per level.' },
  { id: 's_keep', name: 'The Archivist', max: 1, cost: [3, 1], fx: [['f.keepResearch', 'add', 1]], desc: 'All research survives a rewind.' },
  { id: 's_slot', name: 'The Broadsword', max: 1, cost: [5, 1], fx: [['weaponSlots', 'add', 1], ['abilitySlots', 'add', 1]], desc: '+1 weapon slot and +1 ability slot, forever.' },
  { id: 's_fleet', name: 'The Swarm', max: 4, cost: [4, 2.5], fx: [['droneBays', 'add', 2], ['droneDmg', 'pow', 2]], desc: '+2 drone bays and ×2 drone damage per level. Fleets become possible.' },
  { id: 's_tree', name: 'The Root', max: 1, cost: [5, 1], fx: [['f.keepTier1', 'add', 1]], desc: 'Tiers 1 to 3 of the Rewind tree survive Ascension. Buy this first.' },
  { id: 's_time', name: 'The Pendulum', max: 3, cost: [6, 3], fx: [['gameSpeed', 'add', 0.25]], desc: 'The whole simulation runs 25% faster per level.' },
  { id: 's_mod', name: 'The Forge', max: 2, cost: [10, 4], fx: [['moduleSlots', 'add', 1], ['luck', 'add', 0.25]], desc: '+1 Experimental slot and better module rolls per level.' },
];
