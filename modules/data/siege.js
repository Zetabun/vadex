// Station Siege: the invaders' answer to Counterattack. Every Counterattack stage the pilot clears provokes a siege of
// the same tier against the home station. A siege is main-game combat with a station to hold: the waves of that tier's
// sector from its third wave to its boss, with bombards in the formation shelling the station and raiders diving past
// the ship at it. Anything that reaches the defence line hits the station, not the ship; the station falls at 0% hull.
// The station fights back with what the pilot has built (SIEGE_SYSTEMS): every Workshop module and every piece of
// alien hardware is a system here, and a maxed (lit) module works harder.
import { STAGES } from '@last-orbit/data/counter.js';
import { STATION_MODULES, STATION_ALIEN, stationSnapshot, trophyWon } from '@last-orbit/data/station.js';
import { BAL } from '@last-orbit/data/balance.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { ALIEN_TECH } from '@last-orbit/data/alientech.js';

const NAMES = ['First Reprisal', 'Scrap Storm', 'Red Tide', 'Iron Fist', 'Swarm Front', 'The Unmaking'];
/** One tier per Counterattack stage, fought one sector deeper than the stage (a pilot who has just cleared it is well past
 *  that sector in the main game): that sector's waves from the third to its boss, the last tier in the Deep Void. */
export const SIEGE_TIERS = STAGES.map((sg) => {
  const sector = sg.n, first = sector * BAL.sectorWaves + 3, last = (sector + 1) * BAL.sectorWaves;
  return { n: sg.n, name: NAMES[sg.n - 1], sector, first, last, waves: last - first + 1,
    // shellEvery: each bombard's interval, so that together they lob about 0.4 + 0.07 × tier shells a second
    bombards: 3 + Math.floor(sg.n / 2), shellEvery: (3 + Math.floor(sg.n / 2)) / (0.4 + sg.n * 0.07), raidEvery: 5.6 - sg.n * 0.4, wing: 1 + Math.floor((sg.n + 1) / 3),
    // each wave is an assault to hold for this long, however fast the formation falls: raiders and bombers keep coming,
    // and halfway through, the bombards fire a barrage spread right across the line
    assault: 20 + sg.n * 2, bomberEvery: 11 - sg.n * 0.8, bomberDrop: 2.4 - sg.n * 0.15, barrage: 3 + Math.ceil(sg.n / 2) };
});
export const TIER_BY_N = Object.fromEntries(SIEGE_TIERS.map((t) => [t.n, t]));

/** The invaders adapt: each tier expects a pilot of about this power (powerRating: the Workshop, mastery, Alien Tech,
 *  Overhauls and Blueprints), and for every point more its invaders are SIEGE_TOUGH times tougher, so a strong station
 *  still has to be defended. Never easier than the tier itself. */
export const SIEGE_EXPECT = [28, 48, 72, 92, 106, 116], SIEGE_TOUGH = 1.035;
export const siegeToughness = (power, n) => Math.max(1, Math.pow(SIEGE_TOUGH, power - SIEGE_EXPECT[n - 1]));
/** Station damage (share of its hull) from each kind of hit, before armour. */
export const SIEGE_DMG = { shell: 0.06, raider: 0.08, breach: 0.1, bossShell: 0.07 };
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
  { id: 'w_dmg', name: 'Station cannon', at: [4, 2.8], desc: (v) => `Fires on diving raiders, or the nearest invader, every ${v}s.` },
  { id: 'w_rate', name: 'Second cannon', at: [5, 3.4], desc: (v) => `A second gun, firing every ${v}s.` },
  { id: 'w_crit', name: 'Point defence', at: [14, 10], desc: (v) => `Shoots down the lowest shell every ${v}s.` },
  { id: 'w_shield', name: 'Station shield', at: [0.08, 0.14], desc: (v) => `Soaks up ${pc(v)} of hull damage each wave.` },
  { id: 'w_hull', name: 'Armour', at: [0.12, 0.24], desc: (v) => `The station takes ${pc(1 - 1 / (1 + v))} less damage.` },
  { id: 'w_regen', name: 'Repair crews', at: [0.03, 0.06], desc: (v) => `Repair ${pc(v)} hull after every wave.` },
  { id: 'w_speed', name: 'Evasive thrusters', at: [0.06, 0.12], desc: (v) => `${pc(v)} of hits on the station miss.` },
  { id: 'w_barrier', name: 'Bunkers', at: [1, 2], desc: (v) => v > 1 ? 'Your four bunkers stand, rebuilt after every wave.' : 'Your four bunkers stand in the siege.' },
  { id: 'w_magnet', name: 'Tractor field', at: [0.25, 0.4], desc: (v) => `Shells slow by ${pc(v)} as they near the station.` },
  { id: 'w_xp', name: 'Wingmen', at: [1, 2], desc: (v) => v > 1 ? 'Two wingmen fly with you.' : 'A wingman flies with you.' },
  { id: 'w_salvage', name: 'Cargo hold', at: [0.15, 0.3], desc: (v) => `+${pc(v)} salvage in the siege.` },
  { id: 'w_start', name: 'Crew quarters', at: [0.05, 0.1], desc: (v) => `Your ship repairs ${pc(v)} after every wave.` },
  { id: 'w_reroll', name: 'Tactical relay', at: [0.2, 0.35], desc: (v) => `Raiders are tracked early and fly ${pc(v)} slower.` },
  { id: 'w_choice', name: 'Briefing dome', at: [1, 2], desc: (v) => `Start the siege ${v} card${v > 1 ? 's' : ''} ahead.` },
  { id: 'w_revive', name: 'Emergency beacon', at: [0.15, 0.15], desc: (v) => `Once per siege, a killing blow leaves the station at ${pc(v)}.` },
  { id: 'x_alloy', name: 'Xeno plating', alien: true, at: [0.12, 0.12], desc: (v) => `Alien armour: the station takes ${pc(1 - 1 / (1 + v))} less damage.` },
  { id: 'x_phase', name: 'Phase coil', alien: true, at: [32, 32], desc: (v) => `Every ${v}s a pulse wipes enemy fire and shells off the field.` },
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

/** Defence Control's four consoles, two down each side wall, and which systems each one runs. */
export const SIEGE_CONSOLES = [
  { id: 'weapons', name: 'Weapons', color: '#ff8a5e', ids: ['w_dmg', 'w_rate', 'w_crit', 'w_xp'] },
  { id: 'hull', name: 'Protection', color: '#5ee6ff', ids: ['w_shield', 'w_hull', 'w_regen', 'w_speed', 'w_barrier', 'w_revive'] },
  { id: 'ops', name: 'Operations', color: '#6dffc8', ids: ['w_magnet', 'w_reroll', 'w_choice', 'w_start', 'w_salvage'] },
  { id: 'alien', name: 'Alien hardware', color: '#c77dff', ids: ['x_alloy', 'x_phase', 'x_charts', 'x_siphon'] },
];
export const CONSOLE_BY_ID = Object.fromEntries(SIEGE_CONSOLES.map((c) => [c.id, c]));
const won = (state, n) => !!state.siege?.won?.[n];
/** The siege the invaders are massing for: the lowest open tier not yet held (null when all is quiet). */
export const nextSiege = (state) => SIEGE_TIERS.find((t) => siegeOpen(state, t.n) && !won(state, t.n)) || null;
/** The first tier still to be provoked (its Counterattack stage not yet cleared). */
export const lockedSiege = (state) => SIEGE_TIERS.find((t) => !siegeOpen(state, t.n)) || null;

// ORBIT's tips in Defence Control, after the advice about the station itself.
const TIPS = [
  'Shells fall at the station, not at you. Shoot them down before they reach the line and it never feels them.',
  'Raiders dive past you for the station. Turn on them fast: they are fragile.',
  'Hold the station above 85% for all three stars. Every new star pays an Alien Core.',
  'The first time you hold each tier pays Blueprints.',
  'Maxed modules work harder in a siege, {n}. The Workshop is our armoury.',
];
/** What ORBIT says when its terminal is tapped (the k-th time): the next threat, then a system worth building or
 *  maxing, then the general tips, round and round. */
export function siegeAdvice(state, k = 0) {
  const lines = [], next = nextSiege(state), locked = lockedSiege(state), { list } = siegeSystems(state);
  if (next) lines.push(`${next.name} is massing for waves ${next.first} to ${next.last}. Tap the threat board when you are ready, {n}.`);
  else if (locked) lines.push(`All quiet. Clear Counterattack stage ${locked.n} and they will answer with ${locked.name}.`);
  else lines.push('Every siege held. The station has never been safer, {n}.');
  const off = list.find((x) => !x.state), soft = list.find((x) => x.state === 1 && x.sys.at[0] !== x.sys.at[1]);
  if (off) lines.push(`${systemSource(off.sys.id)} to bring our ${off.sys.name.toLowerCase()} online. ${off.sys.desc(off.value)}`);
  if (soft) lines.push(`Our ${soft.sys.name.toLowerCase()} could do more. Max ${sourceName(soft.sys.id)} in the Workshop: ${soft.sys.desc(soft.sys.at[1]).replace(/^./, (c) => c.toLowerCase())}`);
  if (!off && !soft) lines.push('Every system online and maxed. Let them come, {n}.');
  lines.push(...TIPS);
  return lines[((k % lines.length) + lines.length) % lines.length];
}
/** The upgrade that brings a system online, by the name the Workshop shows it under. */
export const sourceName = (id) => (WORKSHOP.find((u) => u.id === id) || ALIEN_TECH.find((u) => u.id === id))?.name || id;
export const systemSource = (id) => SYSTEM_BY_ID[id]?.alien ? `Fit ${sourceName(id)} (Alien Tech)` : `Upgrade ${sourceName(id)} in the Workshop`;
