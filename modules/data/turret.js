// Gunner seat: the turret's starting kit (from what the station has built) and the upgrades picked between waves, which
// belong to this mode alone. A stat block is rebuilt from the kit and every pick each time one is taken
// (rendering/gunner.js reads it).
import { siegeSystems } from '@last-orbit/data/siege.js';

/** What the station you have built gives the guns before the first pick. */
export function turretKit(state) {
  const { on, list } = siegeSystems(state), lvl = (id) => list.find((x) => x.sys.id === id)?.state || 0;
  return {
    dmg: (1 + lvl('w_dmg') * 0.25) * (1 + (on.x_charts || 0) * 0.5), // the weapon battery (a quarter harder built, a half maxed); star charts
    fireEvery: 0.11 * [1, 0.9, 0.8][lvl('w_rate')], // the cycler drum
    cone: 0.09, speed: 520, pierce: 0, splash: 0, tesla: 0, flak: 0,
    missiles: 2, lockTime: 1.5, missileDmg: 20, missileBlast: 0, reload: 7,
    shieldMax: on.w_shield || 0, regen: on.w_regen || 0, armour: (on.w_hull || 0) + (on.x_alloy || 0), evade: on.w_speed || 0,
    pdEvery: on.w_crit ? on.w_crit * 0.6 : 0, torpSlow: on.w_magnet || 0, sentries: 0,
    rerolls: on.w_reroll ? (on.w_reroll > 0.3 ? 2 : 1) : 0, freePicks: on.w_choice || 0, beacon: !!on.w_revive,
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
  { id: 't_rack', kind: 'Missiles', name: 'Missile rack', art: 'weapon:missile', rarity: 'common', max: 3, desc: 'Carry one more missile.', apply: (s) => { s.missiles += 1; } },
  { id: 't_seeker', kind: 'Missiles', name: 'Seeker head', art: 'relic:r_predict', rarity: 'rare', max: 2, desc: 'Missiles lock on 35% faster.', apply: (s) => { s.lockTime *= 0.65; } },
  { id: 't_warhead', kind: 'Missiles', name: 'Heavy warhead', art: 'mod:m_power', rarity: 'rare', max: 2, desc: 'Missiles hit 60% harder and blast everything near the target.', apply: (s) => { s.missileDmg *= 1.6; s.missileBlast += 16; } },
  { id: 't_loader', kind: 'Missiles', name: 'Autoloader', art: 'mod:m_cd', rarity: 'common', max: 2, desc: 'Missiles reload 30% faster.', apply: (s) => { s.reload *= 0.7; } },
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
