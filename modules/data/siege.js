// Station Siege: the invaders' answer to Counterattack. Every Counterattack stage the pilot clears provokes a siege of
// the same tier against the home station. A siege is main-game combat with a station to hold: the waves of that tier's
// sector from its third wave to its boss, with bombards in the formation shelling the station and raiders diving past
// the ship at it. Anything that reaches the defence line hits the station, not the ship; the station falls at 0% hull.
// The station fights back with what the pilot has built (SIEGE_SYSTEMS): every Workshop module and every piece of
// alien hardware is a system here, and a maxed (lit) module works harder.
import { STAGES } from '@last-orbit/data/counter.js';
import { STATION_MODULES, STATION_ALIEN, stationSnapshot, trophyWon } from '@last-orbit/data/station.js';
import { BAL } from '@last-orbit/data/balance.js';

const NAMES = ['First Reprisal', 'Scrap Storm', 'Red Tide', 'Iron Fist', 'Swarm Front', 'The Unmaking'];
/** One tier per Counterattack stage, fought one sector deeper than the stage (a pilot who has just cleared it is well past
 *  that sector in the main game): that sector's waves from the third to its boss, the last tier in the Deep Void. */
export const SIEGE_TIERS = STAGES.map((sg) => {
  const sector = sg.n, first = sector * BAL.sectorWaves + 3, last = (sector + 1) * BAL.sectorWaves;
  return { n: sg.n, name: NAMES[sg.n - 1], sector, first, last, waves: last - first + 1,
    bombards: 2 + Math.floor(sg.n / 2), shellEvery: 4.6 - sg.n * 0.25, raidEvery: 7.5 - sg.n * 0.5,
    // each wave is an assault to hold for this long, however fast the formation falls: raiders and bombers keep coming
    assault: 18 + sg.n * 2, bomberEvery: 8 - sg.n * 0.6, bomberDrop: 1.8 - sg.n * 0.1 };
});
export const TIER_BY_N = Object.fromEntries(SIEGE_TIERS.map((t) => [t.n, t]));

/** Station damage (share of its hull) from each kind of hit, before armour. */
export const SIEGE_DMG = { shell: 0.05, raider: 0.07, breach: 0.1, bossShell: 0.06 };
/** Stars: hold the station, keep it above half, keep it nearly untouched. */
export const SIEGE_STARS = [['Hold the station', 0], ['Station above 50%', 0.5], ['Station above 85%', 0.85]];
/** Rewards: Blueprints on a tier's first win, an Alien Core for each new star (salvage comes from the fighting). */
export const SIEGE_BLUEPRINTS = 2, SIEGE_CORES_PER_STAR = 1;

/** A tier opens once its Counterattack stage is cleared: the invaders retaliate for it. */
export const siegeOpen = (state, n) => trophyWon(state, n);
export const siegeUnlocked = (state) => siegeOpen(state, 1);

// The station's systems in a siege, one per module and alien piece. at: [built, lit] strength; the combat code reads
// them through siegeSystems(). desc: what it does, for the defences list and the Defence Control room.
export const SIEGE_SYSTEMS = [
  { id: 'w_dmg', name: 'Station cannon', at: [4, 2.8], desc: (v) => `Fires on the nearest attacker every ${v}s.` },
  { id: 'w_rate', name: 'Second cannon', at: [5, 3.4], desc: (v) => `A second gun, firing every ${v}s.` },
  { id: 'w_crit', name: 'Point defence', at: [7, 5], desc: (v) => `Shoots down the lowest shell every ${v}s.` },
  { id: 'w_shield', name: 'Station shield', at: [0.15, 0.25], desc: (v) => `Soaks up ${pc(v)} of hull damage each wave.` },
  { id: 'w_hull', name: 'Armour', at: [0.15, 0.3], desc: (v) => `The station takes ${pc(1 - 1 / (1 + v))} less damage.` },
  { id: 'w_regen', name: 'Repair crews', at: [0.04, 0.08], desc: (v) => `Repair ${pc(v)} hull after every wave.` },
  { id: 'w_speed', name: 'Evasive thrusters', at: [0.08, 0.15], desc: (v) => `${pc(v)} of hits on the station miss.` },
  { id: 'w_barrier', name: 'Bunkers', at: [1, 2], desc: (v) => v > 1 ? 'Your four bunkers stand, rebuilt after every wave.' : 'Your four bunkers stand in the siege.' },
  { id: 'w_magnet', name: 'Tractor field', at: [0.25, 0.4], desc: (v) => `Shells slow by ${pc(v)} as they near the station.` },
  { id: 'w_xp', name: 'Wingmen', at: [1, 2], desc: (v) => v > 1 ? 'Two wingmen fly with you.' : 'A wingman flies with you.' },
  { id: 'w_salvage', name: 'Cargo hold', at: [0.15, 0.3], desc: (v) => `+${pc(v)} salvage in the siege.` },
  { id: 'w_start', name: 'Crew quarters', at: [0.05, 0.1], desc: (v) => `Your ship repairs ${pc(v)} after every wave.` },
  { id: 'w_reroll', name: 'Tactical relay', at: [0.2, 0.35], desc: (v) => `Raiders are tracked early and fly ${pc(v)} slower.` },
  { id: 'w_choice', name: 'Briefing dome', at: [1, 2], desc: (v) => `Start the siege ${v} card${v > 1 ? 's' : ''} ahead.` },
  { id: 'w_revive', name: 'Emergency beacon', at: [0.15, 0.15], desc: (v) => `Once per siege, a killing blow leaves the station at ${pc(v)}.` },
  { id: 'x_alloy', name: 'Xeno plating', alien: true, at: [0.15, 0.15], desc: (v) => `Alien armour: the station takes ${pc(1 - 1 / (1 + v))} less damage.` },
  { id: 'x_phase', name: 'Phase coil', alien: true, at: [20, 20], desc: (v) => `Every ${v}s a pulse wipes enemy fire and shells off the field.` },
  { id: 'x_charts', name: 'Star chart array', alien: true, at: [0.5, 0.5], desc: (v) => `Station guns deal +${pc(v)} damage.` },
  { id: 'x_siphon', name: 'Core siphon', alien: true, at: [0.03, 0.03], desc: (v) => `Every elite or boss part destroyed restores ${pc(v)} station hull.` },
];
const pc = (v) => Math.round(v * 100) + '%';
export const SYSTEM_BY_ID = Object.fromEntries(SIEGE_SYSTEMS.map((s) => [s.id, s]));

/** Which systems the station has and how strong: { id: value } for every system online (built modules, fitted alien
 *  hardware), with the lit value for maxed modules. Also a list for the UI: { sys, state 0 off / 1 on / 2 lit, value }. */
export function siegeSystems(state) {
  const parts = stationSnapshot(state).parts, out = {}, list = [];
  for (const s of SIEGE_SYSTEMS) {
    const st = parts[s.id] || 0, on = st > 0, lit = s.alien ? on : st >= 2, v = on ? s.at[lit ? 1 : 0] : 0;
    if (on) out[s.id] = v; list.push({ sys: s, state: on ? (lit ? 2 : 1) : 0, value: v || s.at[0] });
  }
  return { on: out, list, count: list.filter((x) => x.state).length };
}
/** The module or alien piece a system belongs to (for names on the station). */
export const systemPart = (id) => STATION_MODULES.find((m) => m.id === id) || STATION_ALIEN.find((a) => a.id === id);
