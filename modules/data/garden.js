// The Greenhouse (rendering/garden.js): the old glasshouse on the station's arm, the first room aboard a pilot can walk
// into. It opens a few sorties in (every hangar menu open, sector 1 cleared); the Solar wings (Overhaul rank 4) power its
// second wing, with more beds under grow lights, and everything grows faster. Seeds are found by beating bosses; planted,
// they grow in real time (sprout, leaf, bud, bloom), faster for a daily watering, and never wilt. A bloom goes into the
// basket, and each sortie takes one of every kind in it: a boost for that sortie only, never a permanent stat, so it
// matters as much at rank 10 as on the first day. Growing every kind once pays the Verdant paint.
import { ESTABLISHED } from '@last-orbit/data/menus.js';

/** It opens once every hangar menu has (this many sorties) and sector 1 has been cleared. */
export const GARDEN_SORTIES = ESTABLISHED + 1;
export const gardenOpen = (state) => (state.stats?.sorties || 0) >= GARDEN_SORTIES && (state.stats?.sectorsCleared || 0) >= 1;
/** The Solar wings power the second wing at this Overhaul rank. */
export const WING_RANK = 4;
export const wingOpen = (state) => (state.prestige?.level || 0) >= WING_RANK;
/** Beds: three in the old bay, six more in the second wing. */
export const BEDS = 9, BEDS_EARLY = 3;
export const bedsOpen = (state) => (wingOpen(state) ? BEDS : BEDS_EARLY);
/** With the second wing's grow lights on, everything planted grows this much faster. */
export const WING_SPEED = 1.5;
/** Watering, once a day, moves every plant still growing on by this share of its growth. */
export const WATER_BOOST = 0.25;
/** A sortie brings home the seeds of its two deepest bosses (and a Beacon lily for every Void boss). */
export const SEEDS_PER_SORTIE = 2;
/** In the drawer on the first visit. */
export const STARTER_SEEDS = ['sunpetal', 'emberroot', 'mistvine'];
export const GARDEN_PAINT = 'verdant';

// What grows. tier: where it is found (sector: that sector's boss; void: a Deep Void boss; answer: a Void boss). hours:
// to bloom in the old bay. boost: what a bloom does for the sortie that takes it (fx, as cards and relics have). style,
// color, leaf: how it looks (rendering/garden.js).
export const SEEDS = [
  { id: 'sunpetal', name: 'Sunpetal', tier: 'sector', sector: 1, hours: 16, style: 'daisy', color: 0xffc857, leaf: 0x5aa84a, boost: '+15% salvage', fx: [['salvageGain', 'mult', 0.15]],
    lore: 'It turns to face the sun, even through the glass. Pilots swear it brings them home with fuller holds.' },
  { id: 'emberroot', name: 'Emberroot', tier: 'sector', sector: 2, hours: 16, style: 'tulip', color: 0xff6a3d, leaf: 0x7a9a3a, boost: 'Start with a card', fx: [['startLevels', 'add', 1]],
    lore: 'A root that stays warm for days after it is pulled. The crews keep a sliver in the cockpit for a flying start.' },
  { id: 'mistvine', name: 'Mistvine', tier: 'sector', sector: 3, hours: 16, style: 'bell', color: 0x7dffd8, leaf: 0x3aa87a, boost: '+2 rerolls', fx: [['rerolls', 'add', 2]],
    lore: 'It breathes out a cool mist at night. Second thoughts come easily through it.' },
  { id: 'ironbark', name: 'Ironbark', tier: 'sector', sector: 4, hours: 16, style: 'shrub', color: 0xa9c4ec, leaf: 0x4a6a5a, boost: '+25% shield', fx: [['shieldRatio', 'add', 0.25]],
    lore: 'Bark as hard as hull plating. Ground into the shield lattice, it holds a charge for longer.' },
  { id: 'hivebloom', name: 'Hivebloom', tier: 'sector', sector: 5, hours: 16, style: 'cluster', color: 0xff7ad8, leaf: 0x6aa84a, boost: '+20% XP', fx: [['xpGain', 'mult', 0.2]],
    lore: 'Grown from a pod the hive left behind. Everything near it learns faster, pilots included.' },
  { id: 'gravfern', name: 'Gravity fern', tier: 'sector', sector: 6, hours: 16, style: 'fern', color: 0xb69cff, leaf: 0x4a8a6a, boost: 'One more card to choose from', fx: [['cardChoices', 'add', 1]],
    lore: 'Its fronds curl towards the nearest mass. It shows a pilot one more way out of every fight.' },
  { id: 'starbloom', name: 'Starbloom', tier: 'void', hours: 24, style: 'star', color: 0x8fb8ff, leaf: 0x2a4a7a, boost: 'A relic to pick at the start', fx: [['startRelics', 'add', 1]],
    lore: 'It only opens under light from the Deep Void. Something useful always turns up in its petals.' },
  { id: 'nightshade', name: 'Nightshade', tier: 'void', hours: 24, style: 'bell', color: 0xc77dff, leaf: 0x3a2a5a, boost: '+15% damage', fx: [['damage', 'mult', 0.15]],
    lore: 'Dark petals that drink the light. Its sap, cooked into the ammunition, burns hotter.' },
  { id: 'lily', name: 'Beacon lily', tier: 'answer', hours: 36, style: 'lily', color: 0xfff0c8, leaf: 0x5a8a5a, boost: 'An extra revive', fx: [['revives', 'add', 1]],
    lore: 'It grew from what the Void bosses left behind, and it glows as the beacon sweeps past. Pilots say it has pulled them back from the edge.' },
];
export const SEED_BY_ID = Object.fromEntries(SEEDS.map((s) => [s.id, s]));
/** Where a kind is found, in a line. */
export const seedWhere = (s) => (s.tier === 'sector' ? `Beat the sector ${s.sector} boss` : s.tier === 'void' ? 'Beat a boss in the Deep Void' : 'Beat a Void boss');
/** The seed a boss leaves: its sector's kind, a Deep Void kind past wave 60 (alternating by sector), or for a Void boss
 *  a Beacon lily as well. sec: sectorOf the wave it fell on; void: it answered the beacons. */
export function seedsFor(sec, isVoid) {
  if (sec.endless) { const deep = sec.idx % 2 ? 'starbloom' : 'nightshade'; return isVoid ? [deep, 'lily'] : [deep]; }
  const s = SEEDS.find((x) => x.sector === sec.idx + 1); return s ? [s.id] : [];
}

/** ORBIT on the drone that tends the beds, round and round. */
export const SPRIG_LINES = [
  'That is Sprig, {n}. It crop-dusted the whole ring once. Now it has the one greenhouse, and it takes it very seriously.',
  'Sprig talks to the plants. I have checked: it is not transmitting anything. It just talks.',
  'Sprig counts every leaf in here twice a day. The number only ever goes up, which it seems to find reassuring.',
  'If a bed is empty for long, Sprig hovers over it looking disappointed. I think it wants you to plant something.',
];
/** The old tree at the end of the second wing: bare, in leaf once the wing is lit, in flower once every kind has grown. */
export const TREE_LINES = {
  bare: 'The old tree was here before the Fall. It lost every leaf, but it never quite died.',
  leaf: 'Under the new lights the old tree is putting out leaves again, {n}.',
  flower: 'Every kind we can grow has grown in here now, and the old tree has flowered. I did not know it could.',
};
