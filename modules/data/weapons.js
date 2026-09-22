// Weapon archetypes. Levels cost Scrap; evolutions at fixed levels change behaviour (fx is merged into the weapon's runtime config).
// kind: bolt|missile|orb|mine (projectiles)  rail|arc|beam (instant)
export const EVO_LEVELS = [10, 25, 50, 100, 175, 250];
export const WEAPONS = {
  cannon: { name: 'Pulse Cannon', arch: 'Cannon', color: 0xffc857, kind: 'bolt', desc: 'Dependable slugs. Gains the most from extra projectiles.',
    base: { dmg: 10, rate: 2.2, speed: 95, proj: 1, r: 1.3 }, cost: { base: 8, growth: 1.125 }, unlock: null, multishot: 1,
    evo: [
      { name: 'Twin Barrel', desc: '+1 projectile', fx: { proj: 1 } },
      { name: 'Tungsten Core', desc: 'Ignores 50% of armour', fx: { armorPen: 0.5 } },
      { name: 'Fifth Round', desc: 'Every 5th shot is overcharged: ×5 damage, pierces 3', fx: { nth: 5, nthMult: 5 } },
      { name: 'Triple Battery', desc: '+1 projectile, +25% fire rate', fx: { proj: 1, rateMul: 1.25 } },
      { name: 'Shrapnel Rounds', desc: 'Critical hits explode', fx: { critExplode: 8 } },
      { name: 'Boomerang Slugs', desc: 'Shots turn around at the top and hit again on the way back', fx: { returnShot: 1 } }] },
  laser: { name: 'Lance Laser', arch: 'Laser', color: 0x5ee6ff, kind: 'bolt', desc: 'Very fast, light bolts. Loves crit and pierce.',
    base: { dmg: 3.6, rate: 6.5, speed: 190, proj: 1, r: 0.9, crit: 0.05 }, cost: { base: 12, growth: 1.125 }, unlock: { wave: 5, credits: 350 }, multishot: 1,
    evo: [
      { name: 'Twin Laser', desc: '+1 projectile', fx: { proj: 1 } },
      { name: 'Rapid Laser', desc: '+50% fire rate', fx: { rateMul: 1.5 } },
      { name: 'Piercing Laser', desc: 'Bolts pierce +2 enemies', fx: { pierce: 2 } },
      { name: 'Refracting Laser', desc: 'Bolts bounce to 2 more enemies', fx: { bounce: 2 } },
      { name: 'Plasma Laser', desc: 'Hits burn for 60% extra over 3s', fx: { burn: 0.6 } },
      { name: 'Quantum Beam', desc: 'Bolts strike every enemy in their column. ×2 damage', fx: { column: 1, dmgMul: 2 } }] },
  missile: { name: 'Hornet Missiles', arch: 'Missile', color: 0xff8a3d, kind: 'missile', desc: 'Homing warheads with splash. Never misses, so it idles well.',
    base: { dmg: 16, rate: 0.85, speed: 60, proj: 1, r: 1.6, homing: 3.2, splash: 8 }, cost: { base: 20, growth: 1.125 }, unlock: { wave: 14, credits: 9000 }, multishot: 1,
    evo: [
      { name: 'Dual Rack', desc: '+1 missile', fx: { proj: 1 } },
      { name: 'Smart Seekers', desc: 'Retarget when the target dies, and prefer priority targets', fx: { retarget: 1 } },
      { name: 'Cluster Warhead', desc: 'Splits into 3 mini missiles on impact', fx: { split: 3 } },
      { name: 'Big Warheads', desc: '+60% blast radius, +30% damage', fx: { splashMul: 1.6, dmgMul: 1.3 } },
      { name: 'Swarm Rack', desc: '+3 missiles', fx: { proj: 3 } },
      { name: 'Nova Payload', desc: 'Enemies killed by missiles explode', fx: { killExplode: 12 } }] },
  tesla: { name: 'Arc Projector', arch: 'Lightning', color: 0xb69cff, kind: 'arc', desc: 'Chains between enemies on its own. Weak against single targets.',
    base: { dmg: 5, rate: 2.2, chains: 3, chainFall: 0.8, range: 60 }, cost: { base: 25, growth: 1.125 }, unlock: { wave: 24, credits: 250000 }, multishot: 0.15,
    evo: [
      { name: 'Long Arc', desc: '+2 chain jumps', fx: { chains: 2 } },
      { name: 'Forked Bolt', desc: 'Fires 2 arcs at once', fx: { proj: 1 } },
      { name: 'Siphon Coil', desc: 'Arc kills generate 2 Energy', fx: { energyOnKill: 2 } },
      { name: 'Static Lock', desc: '15% chance to stun for 1.5s', fx: { stun: 0.15 } },
      { name: 'Storm Front', desc: '+4 chain jumps, +40% range', fx: { chains: 4, rangeMul: 1.4 } },
      { name: 'Superconductor', desc: 'Each jump grows 10% stronger instead of fading', fx: { chainFall: 0.3 } }] },
  rail: { name: 'Railgun', arch: 'Railgun', color: 0xeaf6ff, kind: 'rail', desc: 'One huge slug through the whole column. Aim it yourself for best results.',
    base: { dmg: 85, rate: 0.42, width: 2.2, crit: 0.1, critDmg: 1 }, cost: { base: 60, growth: 1.125 }, unlock: { sector: 2, scrap: 5e4, cores: 1 }, multishot: 0.15,
    evo: [
      { name: 'Charged Slug', desc: '+150% critical damage', fx: { critDmg: 1.5 } },
      { name: 'Penetrator', desc: 'Ignores all armour', fx: { armorPen: 1 } },
      { name: 'Twin Rails', desc: 'Fires a second slug at the priority target', fx: { proj: 1 } },
      { name: 'Shockwave', desc: 'Slug is 3× wider', fx: { widthMul: 3 } },
      { name: 'Recycler', desc: 'Overkill damage is paid out as Credits', fx: { overkill: 1 } },
      { name: 'Executioner', desc: '+200% damage to bosses and elites', fx: { bossMul: 3 } }] },
  plasma: { name: 'Plasma Mortar', arch: 'Plasma', color: 0x6dff8e, kind: 'orb', desc: 'Slow burning orbs with a wide blast.',
    base: { dmg: 24, rate: 0.75, speed: 48, proj: 1, r: 2.2, splash: 11, burn: 0.4 }, cost: { base: 150, growth: 1.125 }, unlock: { sector: 3, scrap: 5e7, cores: 2 }, multishot: 1,
    evo: [
      { name: 'Wide Bloom', desc: '+40% blast radius', fx: { splashMul: 1.4 } },
      { name: 'Clinging Fire', desc: 'Burn doubled', fx: { burn: 0.4 } },
      { name: 'Twin Mortar', desc: '+1 orb', fx: { proj: 1 } },
      { name: 'Scorched Space', desc: 'Blasts leave a burning pool for 3s', fx: { pool: 3 } },
      { name: 'Unstable Core', desc: 'Critical blasts are twice as wide', fx: { critSplash: 2 } },
      { name: 'Pocket Sun', desc: '×3 damage, orbs pierce and detonate on every enemy touched', fx: { dmgMul: 3, pierce: 3 } }] },
  mine: { name: 'Drift Mines', arch: 'Mine', color: 0xff5fa2, kind: 'mine', desc: 'Float upward and wait. Devastating against divers and dense formations.',
    base: { dmg: 34, rate: 0.6, speed: 16, proj: 1, r: 2.4, splash: 13, life: 9 }, cost: { base: 180, growth: 1.125 }, unlock: { sector: 3, scrap: 4e8, cores: 3 }, multishot: 1,
    evo: [
      { name: 'Double Drop', desc: '+1 mine', fx: { proj: 1 } },
      { name: 'Proximity Fuse', desc: 'Trigger radius tripled', fx: { fuse: 3 } },
      { name: 'Cluster Mines', desc: 'Splits into 3 bomblets', fx: { split: 3 } },
      { name: 'Magnetised', desc: 'Mines drift toward enemies', fx: { homing: 1.2 } },
      { name: 'Sympathetic Charge', desc: 'Mine kills explode', fx: { killExplode: 12 } },
      { name: 'Antimatter', desc: '×3 damage, +50% radius', fx: { dmgMul: 3, splashMul: 1.5 } }] },
  prism: { name: 'Prism Beam', arch: 'Beam', color: 0xff6bff, kind: 'beam', desc: 'Locks on and ramps up the longer it holds a target. A boss killer.',
    base: { dmg: 3, rate: 10, ramp: 3, rampTime: 4, targets: 1 }, cost: { base: 400, growth: 1.125 }, unlock: { sector: 4, scrap: 1e13, cores: 5 }, multishot: 0.15,
    evo: [
      { name: 'Fast Focus', desc: 'Ramps twice as fast', fx: { rampTimeMul: 0.5 } },
      { name: 'Split Prism', desc: '+1 target', fx: { targets: 1 } },
      { name: 'Phase Tuning', desc: 'Ignores enemy shields', fx: { shieldPierce: 1 } },
      { name: 'Deep Focus', desc: 'Ramp cap ×3 → ×6', fx: { ramp: 3 } },
      { name: 'Trinity Prism', desc: '+1 target', fx: { targets: 1 } },
      { name: 'Prismatic Core', desc: 'Beam ticks can crit for double crit damage', fx: { critTicks: 1 } }] },
};
export const WEAPON_ORDER = ['cannon', 'laser', 'missile', 'tesla', 'rail', 'plasma', 'mine', 'prism'];
/** damage multiplier from weapon level (levels + milestone doubling) */
export const weaponLevelMult = (lvl, ms) => (1 + 0.22 * (lvl - 1)) * Math.pow(2, ms);
