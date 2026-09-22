// Research tree, paid in Research Data. fx ops: add → v·lvl, mult → ×(1+v·lvl), pow → ×v^lvl.
// gate: {wave} best wave this run, {sector} best sector ever (1-based), {rewinds} count.
export const BRANCHES = [['wpn', 'Weapons'], ['eco', 'Economy'], ['auto', 'Automation'], ['def', 'Defence'], ['drn', 'Drones'], ['eng', 'Engineering'], ['xen', 'Alien tech'], ['chr', 'Chrono']];
export const RESEARCH = [
  // ---- weapons ----
  { id: 'w_cal', br: 'wpn', name: 'Calibrated optics', max: 5, cost: [8, 2.2], fx: [['critChance', 'add', 0.02]], desc: '+2% critical chance per level.' },
  { id: 'w_slot', br: 'wpn', name: 'Second hardpoint', max: 1, cost: [150, 1], req: ['w_cal'], fx: [['weaponSlots', 'add', 1]], desc: 'Equip two weapons at once. This is where builds begin.' },
  { id: 'w_aim', br: 'wpn', name: 'Aim assist', max: 3, cost: [60, 6], req: ['w_cal'], fx: [['aimAssist', 'add', 1]], desc: 'Straight-firing weapons angle toward targets. Each level widens the arc.' },
  { id: 'w_elite', br: 'wpn', name: 'Elite hunters', max: 10, cost: [200, 2], req: ['w_aim'], fx: [['eliteDmg', 'mult', 0.2]], desc: '+20% damage to elites per level.' },
  { id: 'w_over', br: 'wpn', name: 'Overkill accounting', max: 5, cost: [900, 3], req: ['w_slot'], fx: [['f.overkill', 'add', 0.08]], desc: 'Damage beyond a kill pays out as Credits (8% per level). Big single hits become an economy build.' },
  { id: 'w_critex', br: 'wpn', name: 'Volatile criticals', max: 1, cost: [5000, 1], req: ['w_over'], fx: [['f.critExplode', 'add', 6]], desc: 'Every weapon\'s critical hits cause a small explosion.' },
  { id: 'w_link', br: 'wpn', name: 'Cross-linked capacitors', max: 5, cost: [2e4, 4], req: ['w_slot'], fx: [['f.weaponLink', 'add', 0.08]], desc: 'Each equipped weapon gives the others +8% damage per level.' },
  { id: 'w_weak', br: 'wpn', name: 'Boss analysis', max: 1, cost: [4e4, 1], req: ['w_elite'], gate: { wave: 40 }, fx: [['f.bossAnalysis', 'add', 1], ['weakMult', 'add', 1]], desc: 'Auto-targeting aims for exposed weak points, and weak-point hits deal +100%.' },
  { id: 'w_slot3', br: 'wpn', name: 'Third hardpoint', max: 1, cost: [5e8, 1], req: ['w_link'], gate: { sector: 3 }, fx: [['weaponSlots', 'add', 1]], desc: 'A third weapon slot.' },
  // ---- economy ----
  { id: 'e_bounty', br: 'eco', name: 'Bounty ledger', max: 10, cost: [10, 1.9], fx: [['creditGain', 'mult', 0.2]], desc: '+20% Credits per level.' },
  { id: 'e_survey', br: 'eco', name: 'Survey drones', max: 10, cost: [15, 2], fx: [['dataGain', 'mult', 0.15]], desc: '+15% Research Data per level.' },
  { id: 'e_salv', br: 'eco', name: 'Wreck processing', max: 10, cost: [40, 2], req: ['e_bounty'], fx: [['scrapGain', 'mult', 0.2]], desc: '+20% Scrap per level.' },
  { id: 'e_flaw', br: 'eco', name: 'Clean sweep bonus', max: 1, cost: [400, 1], req: ['e_bounty'], fx: [['f.flawless', 'add', 1]], desc: 'Clearing a wave without hull damage pays a bonus worth half the wave.' },
  { id: 'e_haul', br: 'eco', name: 'Trade lane intel', max: 3, cost: [2500, 5], req: ['e_salv'], fx: [['haulerChance', 'add', 0.04]], desc: 'Salvage Haulers cross the field more often.' },
  { id: 'e_core', br: 'eco', name: 'Core extraction', max: 4, cost: [1e5, 6], req: ['e_haul'], gate: { sector: 2 }, fx: [['coreGain', 'mult', 0.25]], desc: '+25% sector-boss Core drops per level.' },
  { id: 'e_miss', br: 'eco', name: 'Command favour', max: 5, cost: [3000, 3], req: ['e_flaw'], fx: [['missionGain', 'mult', 0.3]], desc: '+30% mission rewards per level.' },
  // ---- automation ----
  { id: 'a_prio', br: 'auto', name: 'Priority targeting', max: 1, cost: [120, 1], gate: { wave: 12 }, fx: [['f.priority', 'add', 1]], desc: 'Auto-targeting goes for shield projectors, menders and heralds first.' },
  { id: 'a_dodge', br: 'auto', name: 'Evasive routines', max: 3, cost: [300, 8], req: ['a_prio'], fx: [['autoDodge', 'add', 1]], desc: 'Improves Autopilot threat prediction: earlier bullet dodges, near-miss awareness, then telegraphed hazards and close threats. Better each level, never as good as you.' },
  { id: 'a_buy', br: 'auto', name: 'Procurement AI', max: 1, cost: [2000, 1], req: ['a_prio'], fx: [['f.autoBuy', 'add', 1]], desc: 'Auto-buys Credit upgrades by category. Set it up in Menu → Automation.' },
  { id: 'a_abil', br: 'auto', name: 'Ability triggers', max: 1, cost: [6000, 1], req: ['a_buy'], fx: [['f.autoAbility', 'add', 1]], desc: 'Abilities fire on conditions you choose.' },
  { id: 'a_boon', br: 'auto', name: 'Standing orders', max: 1, cost: [1.5e4, 1], req: ['a_buy'], fx: [['f.autoBoon', 'add', 1]], desc: 'Boons and anomalies are picked automatically by your preferred tag.' },
  { id: 'a_rules', br: 'auto', name: 'Rule engine', max: 1, cost: [8e4, 1], req: ['a_abil'], fx: [['f.rules', 'add', 1]], desc: 'Ordered purchase rules: "buy Damage to level 100, then Fire rate".' },
  { id: 'a_res', br: 'auto', name: 'Research queue', max: 1, cost: [5e5, 1], req: ['a_rules'], fx: [['f.autoResearch', 'add', 1]], desc: 'Spare Data is spent on the cheapest available research.' },
  { id: 'a_salv', br: 'auto', name: 'Auto-salvage', max: 1, cost: [4e4, 1], req: ['a_boon'], gate: { wave: 10 }, fx: [['f.autoSalvage', 'add', 1]], desc: 'Modules below a rarity you choose are broken down on pickup.' },
  { id: 'a_off', br: 'auto', name: 'Offline combat', max: 1, cost: [1e4, 1], req: ['a_dodge'], fx: [['f.offlineCombat', 'add', 1]], desc: 'While away, the ship pushes waves instead of only holding the current one.' },
  { id: 'a_eff', br: 'auto', name: 'Standby efficiency', max: 6, cost: [2e4, 4], req: ['a_off'], fx: [['offlineEff', 'add', 0.05]], desc: '+5% offline efficiency per level.' },
  // ---- defence ----
  { id: 'd_hull', br: 'def', name: 'Composite frame', max: 10, cost: [12, 1.9], fx: [['hull', 'mult', 0.2]], desc: '+20% hull per level.' },
  { id: 'd_delay', br: 'def', name: 'Fast capacitors', max: 5, cost: [250, 2.4], req: ['d_hull'], fx: [['shieldDelay', 'add', -0.4]], desc: 'Shields start recharging 0.4s sooner per level.' },
  { id: 'd_stand', br: 'def', name: 'Last stand', max: 1, cost: [1500, 1], req: ['d_hull'], fx: [['f.lastStand', 'add', 1]], desc: 'Once per wave, a killing blow leaves you at 1 hull with 2s of invulnerability.' },
  { id: 'd_crit', br: 'def', name: 'Feedback loop', max: 3, cost: [8000, 5], req: ['d_delay'], fx: [['f.critShield', 'add', 0.01]], desc: 'Critical kills restore 1% shield per level. Crit builds get tanky.' },
  { id: 'd_retal', br: 'def', name: 'Retaliation beam', max: 5, cost: [5e4, 4], req: ['d_crit'], fx: [['f.retaliate', 'add', 1]], desc: 'Damage your shield absorbs charges a beam that fires back at the largest enemy.' },
  { id: 'd_barr', br: 'def', name: 'Self-sealing barriers', max: 3, cost: [3000, 6], req: ['d_stand'], fx: [['barrierRegen', 'add', 0.02]], desc: 'Barriers repair 2% per second per level.' },
  // ---- drones ----
  { id: 'dr_bay', br: 'drn', name: 'Drone bay', max: 3, cost: [500, 25], gate: { wave: 15 }, fx: [['droneBays', 'add', 2]], desc: 'Two drone bays per level. Drones fight on their own.' },
  { id: 'dr_dmg', br: 'drn', name: 'Drone munitions', max: 10, cost: [1000, 2.1], req: ['dr_bay'], fx: [['droneDmg', 'mult', 0.25]], desc: '+25% drone damage per level.' },
  { id: 'dr_t2', br: 'drn', name: 'Support patterns', max: 1, cost: [4000, 1], req: ['dr_bay'], fx: [['f.droneT2', 'add', 1]], desc: 'Unlocks Missile, Repair and Collector drones.' },
  { id: 'dr_t3', br: 'drn', name: 'Escort patterns', max: 1, cost: [2e5, 1], req: ['dr_t2'], fx: [['f.droneT3', 'add', 1]], desc: 'Unlocks Shield and Interceptor drones.' },
  { id: 'dr_link', br: 'drn', name: 'Energy link', max: 1, cost: [2e4, 1], req: ['dr_dmg'], fx: [['f.droneEnergy', 'add', 1]], desc: 'Drones spend Energy to double their shot damage.' },
  { id: 'dr_crit', br: 'drn', name: 'Shared telemetry', max: 1, cost: [1e5, 1], req: ['dr_link'], fx: [['f.droneCrit', 'add', 1]], desc: 'Drones use your critical chance and damage.' },
  { id: 'dr_arc', br: 'drn', name: 'Arc relay', max: 1, cost: [1e6, 1], req: ['dr_crit'], fx: [['f.droneArc', 'add', 1]], desc: 'Drone critical hits trigger a free arc from your Arc Projector, if you own one.' },
  { id: 'dr_copy', br: 'drn', name: 'Mirror protocol', max: 3, cost: [5e6, 10], req: ['dr_crit'], fx: [['f.droneCopy', 'add', 0.2]], desc: 'Attack drones also fire a copy of your first weapon at 20% power per level.' },
  // ---- engineering ----
  { id: 'en_react', br: 'eng', name: 'Reactor tuning', max: 5, cost: [80, 3], gate: { wave: 6 }, fx: [['energyRegen', 'add', 1]], desc: '+1 Energy per second per level.' },
  { id: 'en_cap', br: 'eng', name: 'Capacitor banks', max: 4, cost: [300, 4], req: ['en_react'], fx: [['energyCap', 'add', 25]], desc: '+25 maximum Energy per level.' },
  { id: 'en_cool', br: 'eng', name: 'Heat sinks', max: 6, cost: [600, 3], req: ['en_react'], fx: [['abilityCd', 'mult', -0.06]], desc: 'Abilities cool down 6% faster per level.' },
  { id: 'en_pow', br: 'eng', name: 'Amplifiers', max: 8, cost: [1500, 2.6], req: ['en_cool'], fx: [['abilityPower', 'mult', 0.15]], desc: '+15% ability power per level.' },
  { id: 'en_slot', br: 'eng', name: 'Ability bus', max: 2, cost: [1e4, 60], req: ['en_cool'], fx: [['abilitySlots', 'add', 1]], desc: '+1 ability slot per level.' },
  { id: 'en_craft', br: 'eng', name: 'Module forge', max: 1, cost: [3e4, 1], req: ['en_cap'], gate: { wave: 10 }, fx: [['f.craft', 'add', 1]], desc: 'Forge new modules from Boss Cores.' },
  { id: 'en_fuse', br: 'eng', name: 'Module tuning', max: 1, cost: [3e5, 1], req: ['en_craft'], fx: [['f.fuse', 'add', 1]], desc: 'Level up modules with Scrap and Cores.' },
  // ---- alien tech ----
  { id: 'x_lab', br: 'xen', name: 'Xeno laboratory', max: 1, cost: [1e9, 1], gate: { sector: 4 }, fx: [['f.alien', 'add', 1]], desc: 'Opens the Alien Matter workshop in the Menu.' },
  { id: 'x_scan', br: 'xen', name: 'Deep scanners', max: 1, cost: [1e7, 1], gate: { sector: 3 }, fx: [['f.scanStealth', 'add', 1]], desc: 'Auto-targeting sees cloaked Phantoms.' },
  { id: 'x_phase', br: 'xen', name: 'Phase rounds', max: 1, cost: [5e9, 1], req: ['x_lab'], fx: [['f.shieldPierce', 'add', 1]], desc: 'Energy weapons (laser, arc, plasma, prism) ignore projected shields.' },
  { id: 'x_pred', br: 'xen', name: 'Formation prediction', max: 1, cost: [2e10, 1], req: ['x_lab'], fx: [['f.predict', 'add', 1], ['projSpeed', 'mult', 0.3]], desc: 'Aim assist leads moving targets. +30% projectile speed.' },
  { id: 'x_matter', br: 'xen', name: 'Matter harvesting', max: 10, cost: [1e10, 3], req: ['x_lab'], fx: [['matterGain', 'mult', 0.25]], desc: '+25% Alien Matter per level.' },
  // ---- chrono ----
  { id: 'c_echo', br: 'chr', name: 'Echo rounds', max: 5, cost: [500, 5], gate: { rewinds: 1 }, fx: [['f.echo', 'add', 0.06]], desc: '6% chance per level for any volley to repeat itself.' },
  { id: 'c_shard', br: 'chr', name: 'Shard resonance', max: 10, cost: [2000, 3], gate: { rewinds: 1 }, fx: [['shardGain', 'mult', 0.1]], desc: '+10% Chrono Shards per level.' },
  { id: 'c_haste', br: 'chr', name: 'Temporal haste', max: 3, cost: [1e4, 10], req: ['c_echo'], fx: [['waveHaste', 'add', 0.2]], desc: 'Formations arrive 20% sooner per level. Faster waves, faster runs.' },
];
