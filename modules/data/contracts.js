// Contracts: the long-term goal ladder. Completing one pays Salvage and may unlock a weapon, ability or ship.
// stat: key in state.stats (lifetime totals and bests). goal: value to reach. Listed in intended order.
export const CONTRACTS = [
  { id: 'c_first', name: 'First Flight', desc: 'Launch a sortie', stat: 'sorties', goal: 1, salvage: 25 },
  { id: 'c_wave5', name: 'Hold the Line', desc: 'Reach wave 5', stat: 'bestWave', goal: 5, salvage: 40, unlock: { weapon: 'laser' } },
  { id: 'c_kills', name: 'Target Practice', desc: 'Destroy 250 enemies', stat: 'kills', goal: 250, salvage: 50 },
  { id: 'c_level8', name: 'Quick Study', desc: 'Reach pilot level 8 in one sortie', stat: 'maxLevel', goal: 8, salvage: 60, unlock: { ability: 'emp' } },
  { id: 'c_boss1', name: 'Broodbreaker', desc: 'Defeat a sector boss', stat: 'sectorBosses', goal: 1, salvage: 120, unlock: { weapon: 'missile' } },
  { id: 'c_wave15', name: 'Deep Patrol', desc: 'Reach wave 15', stat: 'bestWave', goal: 15, salvage: 120, unlock: { ship: 'striker' } },
  { id: 'c_flawless', name: 'Untouchable', desc: 'Clear 10 waves without taking damage', stat: 'flawless', goal: 10, salvage: 100, unlock: { ability: 'aegis' } },
  { id: 'c_rank7', name: 'Master Gunner', desc: 'Fully evolve a weapon to rank 7', stat: 'maxRank', goal: 7, salvage: 150, unlock: { ability: 'charge' } },
  { id: 'c_boss3', name: 'Big Game', desc: 'Defeat 3 bosses or mini-bosses', stat: 'bossKills', goal: 3, salvage: 150, unlock: { ship: 'bulwark' } },
  { id: 'c_kills2', name: 'Attrition', desc: 'Destroy 1,500 enemies', stat: 'kills', goal: 1500, salvage: 200, unlock: { weapon: 'tesla' } },
  { id: 'c_sector3', name: 'Into the Red', desc: 'Reach the Red Nebula (sector 3)', stat: 'bestSector', goal: 3, salvage: 250, unlock: { weapon: 'rail' } },
  { id: 'c_level20', name: 'Ace', desc: 'Reach pilot level 20 in one sortie', stat: 'maxLevel', goal: 20, salvage: 250, unlock: { ability: 'barrage' } },
  { id: 'c_drones', name: 'Squadron', desc: 'Field 3 drones in one sortie', stat: 'maxDrones', goal: 3, salvage: 200, unlock: { ability: 'swarm' } },
  { id: 'c_boss8', name: 'Headhunter', desc: 'Defeat 8 bosses or mini-bosses', stat: 'bossKills', goal: 8, salvage: 300, unlock: { weapon: 'plasma' } },
  { id: 'c_sector4', name: 'Machine Frontier', desc: 'Reach Machine Territory (sector 4)', stat: 'bestSector', goal: 4, salvage: 400, unlock: { ship: 'tempest' } },
  { id: 'c_arsenal', name: 'Full Arsenal', desc: 'Carry 4 weapons in one sortie', stat: 'maxWeapons', goal: 4, salvage: 300, unlock: { ability: 'slow' } },
  { id: 'c_sector5', name: 'Hive Mind', desc: 'Reach Hive Space (sector 5)', stat: 'bestSector', goal: 5, salvage: 600, unlock: { weapon: 'mine' } },
  { id: 'c_kills3', name: 'Exterminator', desc: 'Destroy 10,000 enemies', stat: 'kills', goal: 10000, salvage: 600, unlock: { ability: 'hole' } },
  { id: 'c_sector6', name: 'Event Horizon', desc: 'Reach the Singularity Frontier (sector 6)', stat: 'bestSector', goal: 6, salvage: 800, unlock: { weapon: 'prism' } },
  { id: 'c_clear', name: 'Last Orbit', desc: 'Defeat the Singularity and clear sector 6', stat: 'sectorsCleared', goal: 6, salvage: 1500, unlock: { ship: 'revenant' } },
  { id: 'c_salvage', name: 'Payday', desc: 'Bring home 1,000 salvage from one sortie', stat: 'bestSalvage', goal: 1000, salvage: 500 },
  { id: 'c_level40', name: 'Living Legend', desc: 'Reach pilot level 40 in one sortie', stat: 'maxLevel', goal: 40, salvage: 1000 },
  { id: 'c_boss25', name: 'Titan Slayer', desc: 'Defeat 25 bosses or mini-bosses', stat: 'bossKills', goal: 25, salvage: 1000 },
  { id: 'c_void', name: 'Into the Void', desc: 'Reach wave 80', stat: 'bestWave', goal: 80, salvage: 2500 },
];
export const CONTRACT_BY_ID = Object.fromEntries(CONTRACTS.map((c) => [c.id, c]));
/** Everything a fresh pilot starts with. */
export const STARTER = { weapons: ['cannon'], abilities: ['overdrive'], ships: ['vanguard'] };
