// Hulls. Each ship starts a sortie with its own gun and signature ability and bends a few stats.
// cost: Salvage. The contract that makes a ship available is declared in data/contracts.js (unlock: { ship }).
// look: tint for the 3D model (trim colour) and which optional parts are shown.
export const SHIPS = [
  { id: 'vanguard', name: 'Vanguard', role: 'All-rounder', weapon: 'cannon', ability: 'overdrive', cost: 0,
    trim: 0x5ee6ff, desc: 'Reliable pulse cannon and a fire-rate overdrive. A good ship to learn every threat on.',
    fx: [], perks: ['Pulse Cannon', 'Balanced hull and speed'] },
  { id: 'striker', name: 'Striker', role: 'Glass cannon', weapon: 'laser', ability: 'charge', cost: 600,
    trim: 0xff6bff, desc: 'Fast lasers and a charge-shot. Hits hard and falls apart just as quickly.',
    fx: [['critChance', 'add', 0.1], ['fireRate', 'pow', 1.15], ['hull', 'pow', 0.75]], perks: ['Lance Laser', '+10% crit, +15% fire rate', '−25% hull'] },
  { id: 'bulwark', name: 'Bulwark', role: 'Tank', weapon: 'missile', ability: 'aegis', cost: 1200,
    trim: 0xffb547, desc: 'Heavy plating, a built-in shield and homing missiles that never miss.',
    fx: [['hull', 'pow', 1.5], ['shieldRatio', 'add', 0.4], ['moveSpeed', 'pow', 0.9]], perks: ['Hornet Missiles', '+50% hull, starts with shields', '−10% speed'] },
  { id: 'tempest', name: 'Tempest', role: 'Swarm control', weapon: 'tesla', ability: 'emp', cost: 2500,
    trim: 0xb69cff, desc: 'Chain lightning and an EMP. Learns fast and brings a wingman.',
    fx: [['xpGain', 'pow', 1.2], ['drones', 'add', 1]], perks: ['Arc Projector', '+20% experience', 'Starts with a drone'] },
  { id: 'revenant', name: 'Revenant', role: 'Boss hunter', weapon: 'rail', ability: 'strike', cost: 5000,
    trim: 0xff4d7a, desc: 'A railgun platform that calls down orbital lances. Fragile, devastating.',
    fx: [['damage', 'pow', 1.5], ['bossDmg', 'pow', 1.3], ['hull', 'pow', 0.65]], perks: ['Railgun', '×1.5 damage, +30% boss damage', '−35% hull'] },
];
export const SHIP_BY_ID = Object.fromEntries(SHIPS.map((s) => [s.id, s]));
