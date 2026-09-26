// The warp draft: warping past sectors (or starting a late Counterattack stage) comes with catch-up upgrades, five a
// sector skipped, which used to be picked one by one (twenty-five and more for sector 6). Now the pilot makes two
// choices: a FOCUS the catch-up cards and relics are drafted towards (progression/run.js warpDraft, using the same
// judgement as Auto-pick, weighted to the focus), and one WARP PERK, a perk only a warp gives. The old way (every card
// by hand) stays one tap away.

/** What the catch-up is drafted towards. themes: the synergies (data/synergies.js) whose cards it favours; kinds: extra
 *  weight for card kinds; relics: the relics it favours. */
export const FOCI = [
  { id: 'fire', name: 'Firepower', color: '#ff8a3d', icon: 'weapon:cannon', desc: 'More guns, higher ranks, critical hits and explosions',
    themes: ['barrage', 'precision', 'demolition'], kinds: { weapon: 6, upgrade: 6, signature: 6, fusion: 6 }, relics: ['r_quantum', 'r_barrel', 'r_crit', 'r_chain', 'r_giant', 'r_glass', 'r_predict'] },
  { id: 'hold', name: 'Survival', color: '#5ec8ff', icon: 'relic:r_titan', desc: 'Hull, armour, shields and repairs, to outlast anything',
    themes: ['ironclad', 'aegis'], kinds: { heal: 0 }, relics: ['r_titan', 'r_aegis', 'r_phoenix', 'r_leech'] },
  { id: 'tech', name: 'Tech', color: '#6dffc8', icon: 'relic:r_swarm', desc: 'Drones and abilities: let the machines do the work',
    themes: ['squadron', 'tactician'], kinds: { ability: 4, upgrade: 5 }, relics: ['r_swarm', 'r_chrono', 'r_predict', 'r_barrel'] },
];
export const FOCUS_BY_ID = Object.fromEntries(FOCI.map((f) => [f.id, f]));
/** How much a focus weighs a card or relic it favours, against Auto-pick's own scores (a new weapon is 10, a rank 12). */
export const FOCUS_WEIGHT = 6;

/** Perks only a warp gives: three are offered each time. fx: stat sheet modifiers for the sortie; world: what it does
 *  to the invaders (as a route or a daily mutator does). */
export const WARP_PERKS = [
  { id: 'wp_slip', name: 'Slipstream', icon: 'relic:r_midas', desc: '+35% salvage this sortie, but the invaders have 15% more health', fx: [['salvageGain', 'mult', 0.35]], world: { hp: 1.15 } },
  { id: 'wp_burn', name: 'Afterburners', icon: 'relic:r_quantum', desc: '+20% fire rate and +15% speed', fx: [['fireRate', 'mult', 0.2], ['speed', 'mult', 0.15]] },
  { id: 'wp_plate', name: 'Warp plating', icon: 'relic:r_titan', desc: '+30% hull and shields that recharge 40% faster', fx: [['hull', 'mult', 0.3], ['shieldRegen', 'mult', 0.4]] },
  { id: 'wp_hunt', name: 'Big-game hunter', icon: 'relic:r_giant', desc: '+40% damage to bosses and elites', fx: [['bossDmg', 'mult', 0.4], ['eliteDmg', 'mult', 0.4]] },
  { id: 'wp_lock', name: 'Target lock', icon: 'relic:r_crit', desc: '+10% critical chance, +50% critical damage', fx: [['critChance', 'add', 0.1], ['critDmg', 'add', 0.5]] },
  { id: 'wp_nav', name: 'Navigator\'s log', icon: 'relic:r_scholar', desc: '+25% experience, and one more card to choose from', fx: [['xpGain', 'mult', 0.25], ['cardChoices', 'add', 1]] },
  { id: 'wp_drone', name: 'Escort wing', icon: 'relic:r_swarm', desc: '+1 attack drone, drones +30% damage', fx: [['drones', 'add', 1], ['droneDmg', 'mult', 0.3]] },
];
export const WARP_PERK_BY_ID = Object.fromEntries(WARP_PERKS.map((p) => [p.id, p]));
/** The catch-up is big enough to draft (below this, the few cards are picked by hand as before). */
export const DRAFT_FROM = 5;
