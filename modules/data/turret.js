// Gunner seat: the turret's starting kit (from what the station has built) and the upgrades picked between waves, which
// belong to this mode alone. A stat block is rebuilt from the kit and every pick each time one is taken
// (rendering/gunner.js reads it).
import { siegeSystems } from '@last-orbit/data/siege.js';

/** What the station you have built gives the guns before the first pick (each system's effect: data/siege.js). */
export const turretKit = (state) => kitFrom(siegeSystems(state).on);
/** The same from the systems online: { id: value }. */
export function kitFrom(on) {
  const crew = 1 - (on.w_start || 0);
  return {
    // the cannons fire four rounds a second (in time with the recorded shot, assets/sfx/turret-shot-*), each a heavy one
    dmg: 2.3 * (1 + (on.w_dmg || 0)) * (1 + (on.x_charts || 0)), fireEvery: 0.25 * (1 - (on.w_rate || 0)),
    cone: 0.09, speed: 520, pierce: 0, splash: 0, tesla: 0, flak: 0, ap: 0,
    mag: 30, gunReload: 2.3 * crew, // a magazine for the cannons, and a slow reload once it runs dry
    missiles: 2, lockTime: 1.1, missileDmg: 20, missileBlast: 0, reload: 8 * crew, // the missile rack reloads, all at once, when it is empty
    shieldMax: on.w_shield || 0, regen: on.w_regen || 0, armour: (on.w_hull || 0) + (on.x_alloy || 0), evade: on.w_speed || 0,
    pdEvery: on.w_crit || 0, torpSlow: on.w_magnet || 0, sentries: on.w_xp || 0, bunkers: on.w_barrier || 0, phaseEvery: on.x_phase || 0, siphon: on.x_siphon || 0,
    rerolls: on.w_reroll || 0, freePicks: on.w_choice || 0, beacon: on.w_revive || 0, cargo: on.w_salvage || 0,
  };
}

export const TURRET_RARITY = { common: { name: 'Common', weight: 10, color: '#8fb3ff' }, rare: { name: 'Rare', weight: 4.5, color: '#5ee6ff' }, epic: { name: 'Epic', weight: 1.6, color: '#d68cff' } };
// kind: what the card is for, shown on it. now: an effect the moment it is picked.
export const TURRET_MODS = [
  { id: 't_rate', kind: 'Cannons', name: 'Rapid cycler', art: 'mod:m_rate', rarity: 'common', max: 3, desc: 'The cannons fire 20% faster.', apply: (s) => { s.fireEvery *= 0.83; } },
  { id: 't_dmg', kind: 'Cannons', name: 'Heavy slugs', art: 'mod:m_dmg', rarity: 'common', max: 3, desc: 'Cannon rounds hit 35% harder.', apply: (s) => { s.dmg *= 1.35; } },
  { id: 't_aim', kind: 'Cannons', name: 'Target computer', art: 'mod:m_aim', rarity: 'common', max: 2, desc: 'Wider sights, and faster rounds that are easier to land.', apply: (s) => { s.cone *= 1.35; s.speed *= 1.2; } },
  { id: 't_blast', kind: 'Cannons', name: 'Explosive rounds', art: 'mod:m_blast', rarity: 'rare', max: 2, desc: 'Rounds burst on impact, hitting anything close by for half damage.', apply: (s) => { s.splash += 9; } },
  { id: 't_pierce', kind: 'Cannons', name: 'Piercing slugs', art: 'mod:m_pierce', rarity: 'rare', max: 2, desc: 'Rounds punch through one more target.', apply: (s) => { s.pierce += 1; } },
  { id: 't_tesla', kind: 'Cannons', name: 'Tesla rounds', art: 'weapon:tesla', rarity: 'rare', max: 2, desc: 'One hit in four arcs to two targets nearby.', apply: (s) => { s.tesla += 0.25; } },
  { id: 't_flak', kind: 'Cannons', name: 'Flak fuses', art: 'mod:m_burst', rarity: 'common', max: 2, desc: 'Rounds burst when they pass close to a torpedo.', apply: (s) => { s.flak += 5; } },
  { id: 't_mag', kind: 'Cannons', name: 'Extended magazine', art: 'relic:r_barrel', rarity: 'common', max: 3, desc: 'The cannons carry 40% more rounds before they reload.', apply: (s) => { s.mag = Math.round(s.mag * 1.4); } },
  { id: 't_speedload', kind: 'Cannons', name: 'Speed loader', art: 'mod:m_srech', rarity: 'common', max: 2, desc: 'The cannons reload 30% faster.', apply: (s) => { s.gunReload *= 0.7; } },
  { id: 't_ap', kind: 'Cannons', name: 'Armour-piercing rounds', art: 'mod:m_apen', rarity: 'rare', max: 2, desc: 'Cannon rounds cut through a third of the armour on bombers, gunships and weak points.', apply: (s) => { s.ap += 0.33; } },
  { id: 't_rack', kind: 'Missiles', name: 'Missile rack', art: 'weapon:missile', rarity: 'common', max: 3, desc: 'Carry one more missile.', apply: (s) => { s.missiles += 1; } },
  { id: 't_seeker', kind: 'Missiles', name: 'Seeker head', art: 'relic:r_predict', rarity: 'rare', max: 2, desc: 'Missiles lock on 35% faster.', apply: (s) => { s.lockTime *= 0.65; } },
  { id: 't_warhead', kind: 'Missiles', name: 'Heavy warhead', art: 'mod:m_power', rarity: 'rare', max: 2, desc: 'Missiles hit 60% harder and blast everything near the target.', apply: (s) => { s.missileDmg *= 1.6; s.missileBlast += 16; } },
  { id: 't_loader', kind: 'Missiles', name: 'Autoloader', art: 'mod:m_cd', rarity: 'common', max: 2, desc: 'The missile rack reloads 30% faster.', apply: (s) => { s.reload *= 0.7; } },
  { id: 't_sentry', kind: 'Station', name: 'Sentry gun', art: 'mod:m_drone', rarity: 'epic', max: 2, desc: 'An automatic gun on the station fires at fighters.', apply: (s) => { s.sentries += 1; } },
  { id: 't_pd', kind: 'Station', name: 'Point defence overclock', art: 'ws:w_crit', rarity: 'rare', max: 2, desc: 'Point defence shoots down torpedoes 40% more often (and comes online if the station has none).', apply: (s) => { s.pdEvery = s.pdEvery ? s.pdEvery * 0.6 : 5; } },
  { id: 't_patch', kind: 'Station', name: 'Hull patch crews', art: 'mod:m_regen', rarity: 'common', max: 3, desc: 'Repair 12% of the station now, and 4% more after every wave.', apply: (s) => { s.regen += 0.04; }, now: (g) => { g.hull = Math.min(1, g.hull + 0.12); } },
  { id: 't_shield', kind: 'Station', name: 'Shield capacitors', art: 'mod:m_shield', rarity: 'common', max: 3, desc: "The station's shield holds 8% more hull, recharged every wave.", apply: (s) => { s.shieldMax += 0.08; }, now: (g) => { g.shield += 0.08; } },
];
export const TURRET_MOD = Object.fromEntries(TURRET_MODS.map((m) => [m.id, m]));

/** The turret's stats: the kit, then every pick in turn. picks: { id: times }. */
export function turretStats(kit, picks) {
  const s = { ...kit }; for (const m of TURRET_MODS) for (let i = 0; i < (picks[m.id] || 0); i++) m.apply(s); return s;
}
/** Three different upgrades to choose from, weighted by rarity, none already maxed. */
export function turretOffer(picks, n = 3, rand = Math.random) {
  const pool = TURRET_MODS.filter((m) => (picks[m.id] || 0) < m.max), out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, m) => a + TURRET_RARITY[m.rarity].weight, 0); let r = rand() * total, i = 0;
    for (; i < pool.length - 1; i++) { r -= TURRET_RARITY[pool[i].rarity].weight; if (r <= 0) break; }
    out.push(pool.splice(i, 1)[0].id);
  }
  return out;
}
