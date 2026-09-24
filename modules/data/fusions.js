// Weapon fusions: when two fully evolved weapons meet in one sortie, a fusion card can join them. Each fusion adds an
// evolution to both weapons (fx per weapon, merged like evolution fx) and names the pair.
export const FUSIONS = [
  { id: 'fu_flak', name: 'Flak Barrage', a: 'cannon', b: 'missile', desc: 'Cannon slugs burst on impact. +2 missiles. Both +30% damage.', fx: { cannon: { splash: 6, dmgMul: 1.3 }, missile: { proj: 2, dmgMul: 1.3 } } },
  { id: 'fu_twinsuns', name: 'Twin Suns', a: 'cannon', b: 'laser', desc: 'Both fire an extra shot, 20% faster.', fx: { cannon: { proj: 1, rateMul: 1.2 }, laser: { proj: 1, rateMul: 1.2 } } },
  { id: 'fu_storm', name: 'Storm Lance', a: 'laser', b: 'tesla', desc: 'Laser bolts ricochet 3 more times. Arcs jump 3 more. Both +30% damage.', fx: { laser: { bounce: 3, dmgMul: 1.3 }, tesla: { chains: 3, dmgMul: 1.3 } } },
  { id: 'fu_napalm', name: 'Napalm Swarm', a: 'missile', b: 'plasma', desc: 'Missiles leave burning pools. Plasma orbs home in. Both +25% damage.', fx: { missile: { pool: 2, burn: 0.5, dmgMul: 1.25 }, plasma: { homing: 2, dmgMul: 1.25 } } },
  { id: 'fu_grid', name: 'Tesla Minefield', a: 'tesla', b: 'mine', desc: 'Arcs stun more often and jump 2 more. Mines trigger from twice as far, and their kills explode.', fx: { tesla: { stun: 0.15, chains: 2 }, mine: { fuse: 2, killExplode: 10 } } },
  { id: 'fu_gauss', name: 'Gauss Battery', a: 'rail', b: 'cannon', desc: 'Cannon slugs pierce 3 and ignore armour. The railgun fires a second slug.', fx: { rail: { proj: 1, dmgMul: 1.2 }, cannon: { pierce: 3, armorPen: 1 } } },
  { id: 'fu_singular', name: 'Singularity Lance', a: 'rail', b: 'prism', desc: 'Railgun ×1.5 against bosses and elites. Prism locks 2 more targets.', fx: { rail: { bossMul: 1.5 }, prism: { targets: 2, dmgMul: 1.2 } } },
  { id: 'fu_firestorm', name: 'Firestorm', a: 'plasma', b: 'mine', desc: 'Plasma blasts leave fire. Mines burn and blast 30% wider.', fx: { plasma: { pool: 3, dmgMul: 1.2 }, mine: { burn: 0.6, splashMul: 1.3 } } },
  { id: 'fu_spectrum', name: 'Spectrum', a: 'prism', b: 'laser', desc: 'Prism ramps twice as fast. Laser bolts pierce 3. Both +20% damage.', fx: { prism: { rampTimeMul: 0.5, dmgMul: 1.2 }, laser: { pierce: 3, dmgMul: 1.2 } } },
];
export const FUSION_BY_ID = Object.fromEntries(FUSIONS.map((f) => [f.id, f]));
/** Fusion ids that apply to a weapon in a run. */
export const fusionsFor = (id, run) => (run?.fusions || []).map((f) => FUSION_BY_ID[f]).filter((f) => f && (f.a === id || f.b === id));
