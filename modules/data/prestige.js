// Overhaul: the prestige loop. Once every Workshop upgrade is maxed, the pilot can strip the Workshop back to zero for
// Blueprints. Blueprints buy permanent perks that survive every Overhaul: escort drones that fly with you in both modes,
// faster rebuilds and a little raw power. Each Overhaul also raises the Overhaul rank, which adds a small bonus and
// unlocks engine trails. Everything else (ships, cosmetics, ranks, mastery, medals, Counterattack) is kept.

/** Blueprints paid by an Overhaul: a base, plus one for every 10 waves past 60 reached since the last Overhaul (up to +5). */
export const BP_BASE = 5, BP_DEPTH_MAX = 5;
export const overhaulBlueprints = (cycleBest) => BP_BASE + Math.min(BP_DEPTH_MAX, Math.floor(Math.max(0, cycleBest - 60) / 10));

/** Per Overhaul rank (up to OVERHAUL_FX_CAP ranks): a little more salvage and damage. */
export const OVERHAUL_FX = [['salvageGain', 'mult', 0.1], ['damage', 'mult', 0.02]], OVERHAUL_FX_CAP = 10;
/** Each Overhaul rank makes Workshop upgrades this much dearer (uncapped), so rebuilds settle at a steady pace instead
 * of collapsing to a sortie or two as salvage bonuses and deeper runs pile up (see tests/prestige-sim.mjs). */
export const OVERHAUL_COST_STEP = 0.25;

/** Workshop upgrades that Head Start never hands out for free (the one-off capstones). */
export const HEAD_START_SKIP = ['w_choice', 'w_revive'];

// kind: 'escort' unlocks an escort drone type; 'bay' adds escort slots; plain entries are perks (fx per level, or a
// special effect read by id). cost: blueprints for each level in turn.
export const BLUEPRINTS = [
  { id: 'bp_bay', kind: 'bay', name: 'Escort Bay', max: 2, cost: [2, 6], per: '+1 escort drone slot', desc: 'An escort flies with you on every sortie, in both modes. The first slot comes with the Attack escort.', art: 'mod:m_drone' },
  { id: 'bp_missile', kind: 'escort', drone: 'missile', name: 'Missile Escort', max: 1, cost: [2], per: 'Slow homing missiles with splash', art: 'weapon:missile' },
  { id: 'bp_repair', kind: 'escort', drone: 'repair', name: 'Repair Escort', max: 1, cost: [2], per: 'Repairs 0.6% hull a second', art: 'mod:m_regen' },
  { id: 'bp_shield', kind: 'escort', drone: 'shield', name: 'Shield Escort', max: 1, cost: [2], per: 'Blocks a bullet near the ship every 5 seconds', art: 'mod:m_shield' },
  { id: 'bp_intercept', kind: 'escort', drone: 'intercept', name: 'Interceptor Escort', max: 1, cost: [2], per: 'Shoots down enemy bullets and rockets', art: 'mod:m_barrier' },
  { id: 'bp_painter', kind: 'escort', drone: 'survey', name: 'Painter Escort', max: 1, cost: [2], per: 'Marks an enemy for +8% damage', art: 'mod:m_aim' },
  { id: 'bp_salvage', name: 'Salvage Contracts', max: 3, cost: [2, 2, 3], fx: [['salvageGain', 'mult', 0.25]], per: '+25% salvage', art: 'mod:m_salvage' },
  { id: 'bp_engineers', name: 'Veteran Engineers', max: 3, cost: [3, 3, 4], per: 'Workshop upgrades cost 8% less', art: 'ws:w_rate' },
  { id: 'bp_head', name: 'Head Start', max: 3, cost: [3, 4, 5], per: 'After an Overhaul, Workshop upgrades start 1 level higher', art: 'ws:w_start' },
  { id: 'bp_calib', name: 'Deep Calibration', max: 5, cost: [3, 3, 4, 4, 5], fx: [['damage', 'mult', 0.05], ['hull', 'mult', 0.05]], per: '+5% damage and hull', art: 'ws:w_dmg' },
];
export const BLUEPRINT_BY_ID = Object.fromEntries(BLUEPRINTS.map((b) => [b.id, b]));
export const ENGINEER_DISCOUNT = 0.08;
/** Escort drone types: 'attack' comes with the first bay; the rest are bought as blueprints. */
export const ESCORT_TYPES = ['attack', ...BLUEPRINTS.filter((b) => b.kind === 'escort').map((b) => b.drone)];
export const ESCORT_BLUEPRINT = Object.fromEntries(BLUEPRINTS.filter((b) => b.kind === 'escort').map((b) => [b.drone, b.id]));

/** Engine trails, unlocked by Overhaul rank. style picks how the renderer draws them. */
export const TRAILS = [
  { id: 'none', name: 'Standard', at: 0, style: 'none' },
  { id: 'ion', name: 'Ion Wake', at: 1, style: 'stream', color: 0x5ee6ff },
  { id: 'ember', name: 'Ember Sparks', at: 2, style: 'sparks', color: 0xff8a3d },
  { id: 'prism', name: 'Prism', at: 3, style: 'prism' },
  { id: 'gilded', name: 'Gilded', at: 5, style: 'glitter', color: 0xffc857 },
  { id: 'void', name: 'Void Wake', at: 8, style: 'stream', color: 0xb69cff, core: 0x1a0b33 },
];
export const TRAIL_BY_ID = Object.fromEntries(TRAILS.map((t) => [t.id, t]));
