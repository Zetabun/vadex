// Station Siege: the invaders' answer to Counterattack. Every Counterattack stage the pilot clears provokes a siege of
// the same tier against the home station, fought from the gunner seat (rendering/gunner.js): man the station's guns in
// 3D against waves of fighters, bombers and gunships, ending on a capital ship. The station's hull is the pilot's life.
// What the pilot has built arms the guns (SIEGE_SYSTEMS): every Workshop module and every piece of alien hardware is a
// system here, and a maxed (lit) module works harder. Holding a siege pays stars, salvage, Blueprints the first time,
// and a turret upgrade the guns keep for good; losing one knocks some of the station's systems offline until they are
// repaired (progression/siege.js).
import { STAGES } from '@last-orbit/data/counter.js';
import { STATION_MODULES, STATION_ALIEN, stationSnapshot, trophyWon } from '@last-orbit/data/station.js';
import { BAL } from '@last-orbit/data/balance.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { ALIEN_TECH } from '@last-orbit/data/alientech.js';

const NAMES = ['First Reprisal', 'Scrap Storm', 'Red Tide', 'Iron Fist', 'Swarm Front', 'The Unmaking'];
// Each tier's fight: its waves (f, b, g: fighters, bombers and gunships; cap: a capital ship with that many weak points),
// tougher tier by tier (hp scales every invader, dmg every hit on the station) and fiercer: shots (a fighter's per strafing
// run), torps (torpedoes per bomber drop or capital salvo), beamEvery (seconds between a gunship's beams). salvage: what holding it pays at full hull
// (less the more the station took, double the first time); repair: what patching the station costs after losing it;
// breaks: how many of its systems a loss knocks offline; gun: the turret upgrade the first win fits for good.
// Tuned with the debug build's gunnerBot against a typical station at each tier's unlock: a phone player holds tiers 1-4
// at about 90/75/70/60% hull and tiers 5-6 at 50-60%, losing about a quarter of those; salvage is about a sortie's worth
// a minute at that point of the game (tests/gunner-campaign-sim.mjs), less at the first tiers so they are never worth farming.
const PLANS = [
  { hp: 1.15, dmg: 1.6, shots: 4, torps: 3, beamEvery: 3.8, salvage: 400, repair: 900, breaks: 2, gun: 't_rack', plan: [{ f: 8 }, { f: 9, b: 1 }, { f: 10, b: 1, g: 1 }, { cap: 2, f: 5 }] },
  { hp: 1.3, dmg: 1.45, shots: 4, torps: 3, beamEvery: 3.5, salvage: 700, repair: 1400, breaks: 2, gun: 't_mag', plan: [{ f: 7 }, { f: 8, b: 1 }, { f: 9, b: 1, g: 1 }, { f: 10, b: 2, g: 1 }, { cap: 3, f: 4 }] },
  { hp: 1.35, dmg: 1.5, shots: 4, torps: 3, beamEvery: 3.2, salvage: 1300, repair: 2500, breaks: 2, gun: 't_blast', plan: [{ f: 8, b: 1 }, { f: 9, b: 2 }, { f: 10, b: 2, g: 1 }, { f: 10, b: 3, g: 1 }, { cap: 3, f: 4, b: 1 }] },
  { hp: 1.8, dmg: 1.85, shots: 4, torps: 4, beamEvery: 3, salvage: 4500, repair: 7000, breaks: 3, gun: 't_ap', plan: [{ f: 8, g: 1 }, { f: 9, b: 1, g: 1 }, { f: 10, b: 2, g: 2 }, { f: 10, b: 2, g: 2 }, { f: 12, b: 2, g: 3 }, { cap: 4, f: 5, g: 1 }] },
  { hp: 2, dmg: 2.05, shots: 5, torps: 4, beamEvery: 2.8, salvage: 6500, repair: 11000, breaks: 3, gun: 't_sentry', plan: [{ f: 12 }, { f: 13, b: 1 }, { f: 14, b: 2, g: 1 }, { f: 15, b: 2, g: 2 }, { f: 16, b: 2, g: 2 }, { cap: 4, f: 6, b: 1 }] },
  { hp: 2.15, dmg: 2.05, shots: 5, torps: 4, beamEvery: 2.6, salvage: 11000, repair: 14000, breaks: 3, gun: 't_warhead', plan: [{ f: 10, b: 2, g: 1 }, { f: 12, b: 2, g: 2 }, { cap: 3, f: 5 }, { f: 14, b: 3, g: 2 }, { f: 16, b: 3, g: 3 }, { f: 16, b: 4, g: 3 }, { cap: 5, f: 8, b: 2, g: 1 }] },
];
/** One tier per Counterattack stage. (sector, first, last and the rest describe the old 2D siege, still read by its
 *  combat code until that is removed.) */
export const SIEGE_TIERS = STAGES.map((sg) => {
  const sector = sg.n, first = sector * BAL.sectorWaves + 3, last = (sector + 1) * BAL.sectorWaves;
  return { n: sg.n, name: NAMES[sg.n - 1], ...PLANS[sg.n - 1], sector, first, last, waves: last - first + 1,
    bombards: 3 + Math.floor(sg.n / 2), shellEvery: (3 + Math.floor(sg.n / 2)) / (0.4 + sg.n * 0.07), raidEvery: 5.6 - sg.n * 0.4, wing: 1 + Math.floor((sg.n + 1) / 3),
    assault: 20 + sg.n * 2, bomberEvery: 11 - sg.n * 0.8, bomberDrop: 2.4 - sg.n * 0.15, barrage: 3 + Math.ceil(sg.n / 2) };
});
export const TIER_BY_N = Object.fromEntries(SIEGE_TIERS.map((t) => [t.n, t]));
/** A tier's fight in a few words, for the lists. */
export function tierSummary(t) { const caps = t.plan.filter((w) => w.cap).length; return `${t.plan.length} waves · ${caps > 1 ? 'two capital ships' : 'capital ship'}`; }
/** The same, as words: "4 waves and a capital ship". */
export function tierPhrase(t) { const caps = t.plan.filter((w) => w.cap).length; return caps > 1 ? `${t.plan.length} waves with two capital ships` : `${t.plan.length} waves and a capital ship`; }

// The old 2D siege's scaling (its combat code still reads these until it is removed).
export const SIEGE_EXPECT = [28, 48, 72, 92, 106, 116], SIEGE_TOUGH = 1.035;
export const siegeToughness = (power, n) => Math.max(1, Math.pow(SIEGE_TOUGH, power - SIEGE_EXPECT[n - 1]));
export const SIEGE_DMG = { shell: 0.06, raider: 0.08, breach: 0.1, bossShell: 0.07 };
/** Stars: hold the station, keep it above half, keep it nearly untouched. */
export const SIEGE_STARS = [['Hold the station', 0], ['Station above 50%', 0.5], ['Station above 85%', 0.85]];
/** Rewards beyond the salvage: Blueprints on a tier's first win, an Alien Core for each new star. */
export const SIEGE_BLUEPRINTS = 2, SIEGE_CORES_PER_STAR = 1;
/** What holding a tier pays: its salvage, scaled by the hull kept (40% at the barest hold), doubled the first time,
 *  and raised by the Cargo hold. */
export const siegePay = (t, hull, first, cargo = 0) => Math.round(t.salvage * (0.4 + 0.6 * Math.max(0, Math.min(1, hull))) * (first ? 2 : 1) * (1 + cargo));

/** A tier opens once its Counterattack stage is cleared: the invaders retaliate for it. */
export const siegeOpen = (state, n) => trophyWon(state, n);
export const siegeUnlocked = (state) => siegeOpen(state, 1);

// The station's systems in a siege, one per module and alien piece. at: [built, lit] strength; the gunner seat reads
// them through turretKit() (data/turret.js). desc: what it does, for the defences list and the Defence Control room.
export const SIEGE_SYSTEMS = [
  { id: 'w_dmg', name: 'Main cannons', at: [0.25, 0.5], desc: (v) => `Cannon rounds hit ${pc(v)} harder.` },
  { id: 'w_rate', name: 'Cycler drum', at: [0.1, 0.2], desc: (v) => `The cannons fire ${pc(v)} faster.` },
  { id: 'w_crit', name: 'Point defence', at: [8, 6], desc: (v) => `Shoots down a torpedo every ${v}s.` },
  { id: 'w_shield', name: 'Station shield', at: [0.08, 0.14], desc: (v) => `Soaks up ${pc(v)} of hull damage each wave.` },
  { id: 'w_hull', name: 'Armour', at: [0.12, 0.24], desc: (v) => `The station takes ${pc(1 - 1 / (1 + v))} less damage.` },
  { id: 'w_regen', name: 'Repair crews', at: [0.03, 0.06], desc: (v) => `Repair ${pc(v)} hull after every wave.` },
  { id: 'w_speed', name: 'Evasive thrusters', at: [0.06, 0.12], desc: (v) => `${pc(v)} of hits on the station miss.` },
  { id: 'w_barrier', name: 'Bunkers', at: [1, 2], desc: (v) => v > 1 ? 'The first two hits of every wave do no damage.' : 'The first hit of every wave does no damage.' },
  { id: 'w_magnet', name: 'Tractor field', at: [0.25, 0.4], desc: (v) => `Torpedoes slow by ${pc(v)} as they near the station.` },
  { id: 'w_xp', name: 'Sentry guns', at: [1, 2], desc: (v) => v > 1 ? 'Two sentry guns on the hull fire at fighters.' : 'A sentry gun on the hull fires at fighters.' },
  { id: 'w_salvage', name: 'Cargo hold', at: [0.15, 0.3], desc: (v) => `+${pc(v)} salvage for every siege held.` },
  { id: 'w_start', name: 'Gun crews', at: [0.15, 0.3], desc: (v) => `The cannons and the missile rack reload ${pc(v)} faster.` },
  { id: 'w_reroll', name: 'Tactical relay', at: [1, 2], desc: (v) => `Reroll the upgrades on offer ${v > 1 ? 'twice' : 'once'} a siege.` },
  { id: 'w_choice', name: 'Briefing dome', at: [1, 1], desc: () => 'Start every siege with an upgrade to pick.' },
  { id: 'w_revive', name: 'Emergency beacon', at: [0.15, 0.15], desc: (v) => `Once a siege, a killing blow leaves the station at ${pc(v)}.` },
  { id: 'x_alloy', name: 'Xeno plating', alien: true, at: [0.12, 0.12], desc: (v) => `Alien armour: the station takes ${pc(1 - 1 / (1 + v))} less damage.` },
  { id: 'x_phase', name: 'Phase coil', alien: true, at: [30, 30], desc: (v) => `Every ${v}s a pulse destroys every torpedo in the sky.` },
  { id: 'x_charts', name: 'Star chart array', alien: true, at: [0.5, 0.5], desc: (v) => `Cannon rounds deal +${pc(v)} damage.` },
  { id: 'x_siphon', name: 'Core siphon', alien: true, at: [0.03, 0.03], desc: (v) => `Every bomber, gunship or weak point destroyed restores ${pc(v)} hull.` },
];
const pc = (v) => Math.round(v * 100) + '%';
export const SYSTEM_BY_ID = Object.fromEntries(SIEGE_SYSTEMS.map((s) => [s.id, s]));

/** Which systems the station has and how strong: { id: value } for every system online (built modules, fitted alien
 *  hardware, and not knocked out in a lost siege), with the lit value for maxed modules. Also a list for the UI:
 *  { sys, state 0 off / 1 on / 2 lit, value, damaged }. */
export function siegeSystems(state) {
  const parts = stationSnapshot(state).parts, out = {}, list = [], broken = new Set(state.siege?.damage?.ids || []);
  for (const s of SIEGE_SYSTEMS) {
    const st = parts[s.id] || 0, built = st > 0, lit = s.alien ? built : st >= 2, v = built ? s.at[lit ? 1 : 0] : 0, damaged = built && broken.has(s.id);
    if (built && !damaged) out[s.id] = v; list.push({ sys: s, state: built && !damaged ? (lit ? 2 : 1) : 0, value: v || s.at[0], damaged });
  }
  return { on: out, list, count: list.filter((x) => x.state).length, damaged: list.filter((x) => x.damaged).length };
}
/** The module or alien piece a system belongs to (for names on the station). */
export const systemPart = (id) => STATION_MODULES.find((m) => m.id === id) || STATION_ALIEN.find((a) => a.id === id);
/** The turret upgrades the guns carry into every siege for good: one for each tier held. { id: times } */
export function siegeGuns(state) { const out = {}; for (const t of SIEGE_TIERS) if (state.siege?.won?.[t.n]) out[t.gun] = (out[t.gun] || 0) + 1; return out; }
/** The damage a lost siege left, or null: { ids, tier, cost }. */
export const siegeDamage = (state) => (state.siege?.damage?.ids?.length ? state.siege.damage : null);

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
  'Bombers, gunships and weak points are armoured: cannon fire barely scratches them. Hold the sights on one until the seeker locks, then fire a missile.',
  'Torpedoes are small and fast. Follow the lead marker, and shoot them down before they reach the hull.',
  'Hold the station above 85% for all three stars. Every new star pays an Alien Core.',
  'The first time you hold each tier pays Blueprints, and the armoury fits the guns with something new for good.',
  'Every module you build arms the guns, {n}. Maxed modules arm them better. The Workshop is our armoury.',
];
/** What ORBIT says when its terminal is tapped (the k-th time): any damage to repair, the next threat, then a system
 *  worth building or maxing, then the general tips, round and round. */
export function siegeAdvice(state, k = 0) {
  const lines = [], next = nextSiege(state), locked = lockedSiege(state), { list } = siegeSystems(state), dmg = list.filter((x) => x.damaged);
  if (dmg.length) lines.push(`We are still damaged: ${listNames(dmg.map((x) => x.sys.name.toLowerCase()))} ${dmg.length > 1 ? 'are' : 'is'} offline. Repair them at the tactical table, or fly a sortie and the crews will patch them while you are out.`);
  if (next) lines.push(`${next.name} is massing: ${tierPhrase(next)}. Tap the threat board when you are ready, {n}.`);
  else if (locked) lines.push(`All quiet. Clear Counterattack stage ${locked.n} and they will answer with ${locked.name}.`);
  else lines.push('Every siege held. The station has never been safer, {n}.');
  const off = list.find((x) => !x.state && !x.damaged), soft = list.find((x) => x.state === 1 && x.sys.at[0] !== x.sys.at[1]);
  if (off) lines.push(`${systemSource(off.sys.id)} to bring our ${off.sys.name.toLowerCase()} online. ${off.sys.desc(off.value)}`);
  if (soft) lines.push(`Our ${soft.sys.name.toLowerCase()} could do more. Max ${sourceName(soft.sys.id)} in the Workshop: ${soft.sys.desc(soft.sys.at[1]).replace(/^./, (c) => c.toLowerCase())}`);
  if (!off && !soft && !dmg.length) lines.push('Every system online and maxed. Let them come, {n}.');
  lines.push(...TIPS);
  return lines[((k % lines.length) + lines.length) % lines.length];
}
/** "a", "a and b", "a, b and c". */
export const listNames = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs.at(-1) : xs[0] || '');
/** The upgrade that brings a system online, by the name the Workshop shows it under. */
export const sourceName = (id) => (WORKSHOP.find((u) => u.id === id) || ALIEN_TECH.find((u) => u.id === id))?.name || id;
export const systemSource = (id) => SYSTEM_BY_ID[id]?.alien ? `Fit ${sourceName(id)} (Alien Tech)` : `Upgrade ${sourceName(id)} in the Workshop`;
