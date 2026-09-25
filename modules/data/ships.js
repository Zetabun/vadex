// Hulls. Each ship starts a sortie with its own gun and signature ability and bends a few stats.
// cost: Salvage. The contract that makes a ship available is declared in data/contracts.js (unlock: { ship }).
// yard: never bought: built in the Shipyard instead (data/shipyard.js).
// look: tint for the 3D model (trim colour) and which optional parts are shown.
// passive: the hull's unique trait (combat/passives.js). signature: a special evolution of the ship's own weapon, offered as
// a card once that weapon is fully evolved and the ship has reached mastery 5 (fx merged like weapon evolution fx).
export const SHIPS = [
  { id: 'vanguard', name: 'Vanguard', role: 'All-rounder', weapon: 'cannon', ability: 'overdrive', cost: 0,
    trim: 0x5ee6ff, desc: 'Reliable pulse cannon and a fire-rate overdrive. A good ship to learn every threat on.',
    fx: [], perks: ['Pulse Cannon', 'Balanced hull and speed'],
    passive: { id: 'secondwind', name: 'Second Wind', desc: 'Once per sector, dropping below 30% hull repairs 40% and grants 2 seconds of invulnerability.' },
    signature: { name: 'Vanguard Salvo', desc: '+2 projectiles and +40% damage', fx: { proj: 2, dmgMul: 1.4 } } },
  { id: 'striker', name: 'Striker', role: 'Glass cannon', weapon: 'laser', ability: 'charge', cost: 800,
    trim: 0xff6bff, desc: 'Fast lasers and a charge-shot. Hits hard and falls apart just as quickly.',
    fx: [['critChance', 'add', 0.1], ['fireRate', 'pow', 1.15], ['hull', 'pow', 0.75]], perks: ['Lance Laser', '+10% crit, +15% fire rate', '−25% hull'],
    passive: { id: 'momentum', name: 'Momentum', desc: 'Every kill adds +3% fire rate for 3 seconds, stacking up to +30%.' },
    signature: { name: 'Starfall Lance', desc: 'Bolts pierce every enemy in their path, +100% critical damage', fx: { pierce: 20, critDmg: 1 } } },
  { id: 'bulwark', name: 'Bulwark', role: 'Tank', weapon: 'missile', ability: 'aegis', cost: 2000,
    trim: 0xffb547, desc: 'Heavy plating, a built-in shield and homing missiles that never miss.',
    fx: [['hull', 'pow', 1.5], ['shieldRatio', 'add', 0.4], ['moveSpeed', 'pow', 0.9]], perks: ['Hornet Missiles', '+50% hull, starts with shields', '−10% speed'],
    passive: { id: 'stalwart', name: 'Stalwart', desc: 'Take 30% less damage while below half hull.' },
    signature: { name: 'Siege Battery', desc: '+4 missiles, +50% blast radius', fx: { proj: 4, splashMul: 1.5 } } },
  { id: 'tempest', name: 'Tempest', role: 'Swarm control', weapon: 'tesla', ability: 'emp', cost: 4500,
    trim: 0xb69cff, desc: 'Chain lightning and an EMP. Learns fast and brings a wingman.',
    fx: [['xpGain', 'pow', 1.2], ['drones', 'add', 1]], perks: ['Arc Projector', '+20% experience', 'Starts with a drone'],
    passive: { id: 'static', name: 'Static Discharge', desc: 'Every 6th kill arcs lightning into three nearby enemies.' },
    signature: { name: 'Thunderhead', desc: '+6 chain jumps that barely fade, +50% damage', fx: { chains: 6, chainFall: 0.15, dmgMul: 1.5 } } },
  { id: 'revenant', name: 'Revenant', role: 'Boss hunter', weapon: 'rail', ability: 'strike', cost: 9000,
    trim: 0xff4d7a, desc: 'A railgun platform that calls down orbital lances. Fragile, devastating.',
    fx: [['damage', 'pow', 1.5], ['bossDmg', 'pow', 1.3], ['hull', 'pow', 0.65]], perks: ['Railgun', '×1.5 damage, +30% boss damage', '−35% hull'],
    passive: { id: 'execute', name: 'Executioner', desc: '+60% damage to enemies below 30% health, bosses included.' },
    signature: { name: 'Planetcracker', desc: 'Slugs twice as wide, ×2.5 damage', fx: { widthMul: 2, dmgMul: 2.5 } } },
  { id: 'chimera', name: 'Chimera', role: 'Demolition', weapon: 'plasma', ability: 'hole', cost: 0, yard: true,
    trim: 0x6dff8e, desc: 'Built in your own shipyard and plated in the alien hulls you towed home. Burning plasma, and a black hole to pull them into it.',
    fx: [['blast', 'pow', 1.25], ['abilityCd', 'pow', 0.85], ['moveSpeed', 'pow', 0.92]], perks: ['Plasma Mortar', '+25% blast radius, abilities recharge 15% faster', '−8% speed'],
    passive: { id: 'meltdown', name: 'Meltdown', desc: 'Enemies that die burning burst into plasma, hitting everything close and setting it alight.' },
    signature: { name: 'Starforge', desc: 'Every blast scatters 3 bomblets, and its burn is doubled', fx: { split: 3, burn: 0.4 } } },
];
export const SHIP_BY_ID = Object.fromEntries(SHIPS.map((s) => [s.id, s]));
