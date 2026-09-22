// Orbital Recovery Fleet: a persistent idle subsystem that runs beside the battle.
// Fleet Supplies are intentionally local to this system so the main HUD does not gain another permanent currency.
export const FLEET_BASE_RATE = 0.18; // supplies / real second once the fleet unlocks
export const FLEET_BASE_CAP = 600;
export const FLEET_CAP_GROWTH = 1.55;

export const FLEET_UPGRADES = [
  { id: 'drones', tier: 'Recovery', name: 'Recovery drones', max: 20, cost: [25, 1.55], desc: '+55% base Fleet Supply production per level.' },
  { id: 'cargo', tier: 'Recovery', name: 'Cargo cradles', max: 15, cost: [40, 1.65], desc: '×1.55 Fleet Supply storage per level.' },
  { id: 'scanners', tier: 'Recovery', name: 'Deep scanners', max: 12, cost: [100, 1.75], req: [['drones', 2]], desc: '+18% Fleet Supply production per level.' },

  { id: 'brokers', tier: 'Support protocols', name: 'Salvage brokers', max: 10, cost: [120, 1.9], req: [['drones', 2]], fx: [['creditGain', 'mult', 0.02]], desc: '+2% Credits from all sources per level.' },
  { id: 'sorters', tier: 'Support protocols', name: 'Alloy sorters', max: 10, cost: [950, 1.9], req: [['scanners', 2]], fx: [['scrapGain', 'mult', 0.03]], desc: '+3% Scrap gain per level.' },
  { id: 'telemetry', tier: 'Support protocols', name: 'Telemetry relay', max: 10, cost: [1200, 1.9], req: [['scanners', 3]], fx: [['dataGain', 'mult', 0.03]], desc: '+3% Research Data gain per level.' },
  { id: 'endurance', tier: 'Support protocols', name: 'Long-range stores', max: 6, cost: [3200, 2.1], req: [['cargo', 4]], gate: { wave: 20 }, fx: [['offlineCap', 'add', 1]], desc: '+1 hour to the offline reward window per level.' },

  { id: 'uplink', tier: 'Fleet unlocks', name: 'Targeting uplink', max: 1, cost: [18000, 1], req: [['telemetry', 5]], gate: { wave: 40 }, fx: [['bossDmg', 'mult', 0.15]], desc: 'Unlock a fleet targeting uplink: +15% damage to bosses.' },
  { id: 'reserve', tier: 'Fleet unlocks', name: 'Reserve capacitor bank', max: 1, cost: [36000, 1], req: [['sorters', 5], ['endurance', 2]], gate: { rewinds: 1 }, fx: [['abilityCharges', 'add', 1]], desc: 'Unlock a permanent reserve charge for every fitted ability.' },
  { id: 'bulkheads', tier: 'Fleet unlocks', name: 'Emergency bulkheads', max: 1, cost: [52000, 1], req: [['brokers', 6], ['reserve', 1]], gate: { wave: 80 }, fx: [['hull', 'mult', 0.12]], desc: 'Fleet-fabricated armour packages add +12% maximum hull.' },
];
