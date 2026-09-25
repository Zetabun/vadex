// The Beacon array (rendering/beacons.js): lights at every tip of the station, lit again at Overhaul rank 8, and the
// signal room under the great beacon. Lit, they call out into the Deep Void, and something answers: each Deep Void
// sector ends on a Void boss of its own (data/bosses.js) instead of an old sector boss, the six below in turn and then
// round again, each time as strong as the depth. The first time you beat each one pays Blueprints; beat all six and
// the Lightkeeper paint is yours. progression/beacons.js keeps the record.

/** The beacons are lit again at this Overhaul rank. */
export const BEACON_RANK = 8;
export const beaconsLit = (state) => (state.prestige?.level || 0) >= BEACON_RANK;
/** The Void bosses, in the order they answer: the first ends Deep Void 1 (wave 70), the next Deep Void 2, and so on. */
export const VOID_BOSSES = ['watcher', 'leviathan', 'choir', 'colossus', 'mirrorhost', 'maw'];
/** Blueprints for beating each one the first time; the paint for beating all six. */
export const VOID_BOSS_BP = 3, LIGHTKEEPER = 'lightkeeper';
/** The Void boss at the end of the Deep Void sector a wave is in (waves 61-70 are Deep Void 1). */
export const voidBossAt = (wave) => VOID_BOSSES[Math.max(0, Math.floor((wave - 61) / 10)) % VOID_BOSSES.length];
/** The first wave each one waits at. */
export const firstWaveOf = (id) => 70 + VOID_BOSSES.indexOf(id) * 10;

/** What each one is, and the trick to it (the Beacon array's panels). */
export const VOID_LORE = {
  watcher: 'A pale eye as big as a frigate, open since before the Fall. Its gaze sweeps like a searchlight, and when it blinks it is somewhere else.',
  leviathan: 'Something long that swims the dark between the stars. It throws walls of fire with one gap in them: find the gap.',
  choir: 'A core that sings, and four singers that shield it while they live. Silence the singers first.',
  colossus: 'A walking grave of every ship the Void has eaten, its guns still working. Knock the turrets off and its armour goes with them.',
  mirrorhost: 'It shows you yourself, then something worse. It blinks across the field and sends its reflections at you from the sides.',
  maw: 'The mouth at the bottom of the Void. It pulls, and what it pulls in it eats. Keep your engines lit.',
};

// What ORBIT says at the great beacon, round and round (after anything about what has answered).
export const BEACON_LINES = [
  'The beacons say one thing, over and over: we are here. Something out in the Void has started saying it back.',
  'I keep the lamp turning all night, {n}. Old habit. Lighthouses were for ships that were lost.',
  'Every answer comes from deeper than the last. I do not think they are all the same kind of thing.',
  'If anyone is still out there from before the Fall, this is how they will find us.',
];
