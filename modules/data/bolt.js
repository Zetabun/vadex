// Bolt: the maintenance drone that decided it lives in your quarters (they open at Overhaul rank 5), and from then on
// follows you all round the station (rendering/bolt.js). What it can wear, and what earns each piece; what it says,
// in beeps with ORBIT's translation, by what is going on; and what ORBIT says about it.
import { QUARTERS_RANK } from '@last-orbit/data/quarters.js';

/** Bolt is aboard once your quarters are. */
export const boltHere = (state) => (state.prestige?.level || 0) >= QUARTERS_RANK;
const s = (st) => st.stats || {};
const bolt = (st) => st.bolt || {};

/** What it can wear, a slot at a time. paint: body and band; hat: on top; eye: the colour its eye glows. when: what earns
 *  it (the first of each slot is what it came with). how: said while it is still to find. */
export const COSMETICS = {
  paint: [
    { id: 'factory', name: 'Factory', body: 0xdfe4ee, band: 0xffb070, when: () => true },
    { id: 'rust', name: 'Scrapheap', body: 0xb07a55, band: 0x6a4a36, when: (st) => (s(st).sorties || 0) >= 25, how: 'Fly 25 sorties' },
    { id: 'midnight', name: 'Midnight', body: 0x2a3450, band: 0x5ee6ff, when: (st) => (s(st).bestWave || 0) >= 30, how: 'Reach wave 30' },
    { id: 'gold', name: 'Gold plated', body: 0xf2c65a, band: 0xfff0c8, when: (st) => (st.prestige?.level || 0) >= 6, how: 'Overhaul rank 6' },
    { id: 'mint', name: 'Greenhouse', body: 0xbfeccb, band: 0x3f9a56, when: (st) => Object.keys(st.garden?.grown || {}).length >= 3, how: 'Grow three kinds of plant' },
    { id: 'void', name: 'Void black', body: 0x1a1626, band: 0xb69cff, when: (st) => (s(st).bestWave || 0) > 60, how: 'Reach the Deep Void' },
    { id: 'scout', name: 'Pathfinder', body: 0x163440, band: 0x6dffc8, when: (st) => (st.fleet?.home || 0) >= 12, how: 'Bring 12 expeditions home' },
    { id: 'candy', name: 'Candy', body: 0xffd6e8, band: 0xff6fae, when: (st) => (bolt(st).pets || 0) >= 100, how: 'Give Bolt 100 pats' },
  ],
  hat: [
    { id: 'none', name: 'Nothing', when: () => true },
    { id: 'prop', name: 'Propeller cap', when: (st) => (s(st).sectorsCleared || 0) >= 1, how: 'Clear sector 1' },
    { id: 'party', name: 'Party hat', when: (st) => (bolt(st).fetches || 0) >= 10, how: 'Play fetch with Bolt 10 times' },
    { id: 'crown', name: 'Tiny crown', when: (st) => (s(st).bossKills || 0) >= 25, how: 'Beat 25 bosses' },
    { id: 'helmet', name: 'Pilot helmet', when: (st) => (st.pilot?.rank || 1) >= 15, how: 'Reach pilot rank 15' },
    { id: 'ears', name: 'Rabbit ears', when: (st) => (s(st).bestStreak || 0) >= 7, how: 'Fly the Daily Sortie 7 days running' },
    { id: 'beacon', name: 'Beacon lamp', when: (st) => Object.keys(st.beacons?.beaten || {}).length >= 1, how: 'Beat a Void boss' },
    { id: 'halo', name: 'Halo', when: (st) => (st.prestige?.level || 0) >= 9, how: 'Overhaul rank 9' },
  ],
  eye: [
    { id: 'cyan', name: 'Cyan', color: 0x5ee6ff, when: () => true },
    { id: 'amber', name: 'Amber', color: 0xffc857, when: (st) => (s(st).sorties || 0) >= 10, how: 'Fly 10 sorties' },
    { id: 'pink', name: 'Pink', color: 0xff7ad8, when: (st) => (bolt(st).pets || 0) >= 25, how: 'Give Bolt 25 pats' },
    { id: 'green', name: 'Green', color: 0x6dff8e, when: (st) => !!st.counter?.unlocked, how: 'Open the Counterattack' },
    { id: 'red', name: 'Red alert', color: 0xff4d6a, when: (st) => (s(st).siegeWins || 0) >= 1, how: 'Hold a Station Siege' },
    { id: 'violet', name: 'Void violet', color: 0xb69cff, when: (st) => (s(st).bestWave || 0) > 60, how: 'Reach the Deep Void' },
    { id: 'gold', name: 'Gold', color: 0xffe2a0, when: (st) => (s(st).shipsOwned || 0) >= 6, how: 'Own all six ships' },
  ],
};
export const SLOTS = [['paint', 'Paint'], ['hat', 'Hat'], ['eye', 'Eyes']];
export const COSMETIC_BY_ID = Object.fromEntries(Object.entries(COSMETICS).flatMap(([slot, list]) => list.map((c) => [slot + ':' + c.id, { ...c, slot }])));
/** Pats in a row (within a few seconds) that make it happy, and then dizzy. */
export const HAPPY_AT = 3, DIZZY_AT = 9;

/** What Bolt says: a beep, and what it means (ORBIT translates). Picked by what is happening, never the same one twice
 *  until all of that kind have been said (progression/bolt.js). */
export const BOLT_SAYS = {
  tap: [['Bip?', 'Yes? You need something?'], ['Brrp.', 'That tickles.'], ['Bwee!', 'Hello again!'], ['Bip-bip.', 'Still here. Always here.'], ['Wrrr?', 'Is it time to go somewhere?'],
    ['Beep boop.', 'Systems nominal. Mostly.'], ['Bip!', 'I polished your keepsakes. Twice.'], ['Brr-bip.', 'I counted the rivets in here. You would not believe how many.'], ['Bweep?', 'Can I come on the next sortie? No? Okay.'],
    ['Bip bip bip.', 'I have been practising hovering. Look.'], ['Wheee-oo.', 'The air filters sound funny today.'], ['Bip.', 'I like it when you visit.']],
  happy: [['Bweee!', 'Again! Again!'], ['Brrrrrr.', 'This is the best day.'], ['Bip-bee-bip!', 'You are my favourite pilot.'], ['Wheeee!', 'Spin! Spin!'], ['Bweep bweep!', 'Nobody pats a maintenance drone. Except you.'],
    ['Brrr-bip.', 'My fan is doing a happy noise.'], ['Bee-doo!', 'Happiness levels: exceeding tolerance.'], ['Bip bip!', 'I will scrub the reactor twice as hard tomorrow.']],
  dizzy: [['Brrrzzt...', 'Too... much... spinning.'], ['Bwoo-oo-oop.', 'The room is doing the spinning now.'], ['Bip...?', 'Which way is up again?'], ['Wrrrbl.', 'Gyroscope needs a minute.'], ['Bzzt!', 'Recalibrating. Please hold.']],
  greet: [['Bip!', 'New room! Lots to look at.'], ['Bweep?', 'Where are we going?'], ['Brrp.', 'I will stay close.'], ['Bip-bip!', 'Right behind you.'], ['Wrrr.', 'I know this room. I have scrubbed it.'],
    ['Bee!', 'Following!'], ['Bip?', 'Is this one safe? It looks safe.'], ['Brr-bip!', 'Tour time.']],
  win: [['Bweee-bip!', 'You beat your best! I watched the whole thing.'], ['Bip bip bip!', 'That was amazing. I made a note in my log.'], ['Brrrp!', 'Further than ever! Can we celebrate?'], ['Bee-doo!', 'The whole station felt that one.'],
    ['Bip!', 'I knew you could do it. I calculated it. Sort of.'], ['Wheee!', 'New record! I am doing a lap of the room.']],
  loss: [['Bwoo.', 'You came back. That is the important part.'], ['Brrp...', 'I patched the dents while you were out. Mostly.'], ['Bip.', 'They got lucky. Next time.'], ['Wrrr.', 'I kept your seat warm. Metaphorically.'],
    ['Bee-oo.', 'Want me to polish something? It helps me.'], ['Bip bip.', 'Every scratch is a lesson. That is what the manual says.']],
  breach: [['Bweep!?', 'They got past the line? I will sweep up after them.'], ['Brrzt.', 'Three breaches. I counted. I wish I had not.'], ['Bip...', 'Hold the line next time? I will cheer louder.'], ['Wrrr!', 'I do not like them near the station.']],
  abandoned: [['Bip?', 'Back early? That is fine. More time with me.'], ['Brrp.', 'Sometimes you just have to come home.'], ['Bee.', 'I will not tell anyone.']],
  long: [['BWEEEP!', 'You are back! It has been ages!'], ['Bip bip bip bip!', 'I missed you. I counted the days. And the hours.'], ['Brrrrp!', 'I kept everything tidy while you were gone.'], ['Wheee!', 'Welcome home! Welcome home!']],
  night: [['Bip... zz.', 'It is late. Pilots need sleep. Drones need a charge.'], ['Brr-yawn.', 'My battery is feeling it.'], ['Bip.', 'The station is quiet at night. I like it.'], ['Wrrr.', 'Late shift again? Me too.']],
  morning: [['Bweep!', 'Good morning! Systems warm, coffee not included.'], ['Bip-bip!', 'First light over the Earth. Every day.'], ['Brrp!', 'I have been up for hours. Well. Always.']],
  idle: [['Bip?', 'What is this? Oh. I have seen it before.'], ['Brrp.', 'Needs dusting.'], ['Wrrr...', 'Scanning. Scanning. Nothing.'], ['Bip bip.', 'That one is my favourite.'], ['Bee?', 'Is it supposed to hum like that?'],
    ['Brr.', 'I could fix that. If I had hands.'], ['Bip.', 'Just looking. Carry on.']],
  fetch: [['BWEE!', 'Got it! Got it! Got it!'], ['Bip bip!', 'Again!'], ['Brrrp!', 'Retrieval complete. Very important work.'], ['Wheee!', 'I am the fastest drone in the ring.'], ['Bee-doo!', 'Throw it further next time!']],
  sleep: [['Bip... zzz.', 'Charging. Wake me if anything explodes.'], ['Brr... zz.', 'Dreaming about clean reactors.'], ['Wrrr... zz.', 'Good night, pilot.']],
  dress: [['Bweep!', 'How do I look?'], ['Bip bip!', 'Very dashing. I checked the window.'], ['Brrp!', 'I feel faster already.'], ['Bee!', 'Nobody on the station looks this good.'], ['Wheee!', 'Fashion!']],
  found: [['BWEEP!', 'Something new for my locker!'], ['Bip bip!', 'I found it on the way back from the reactor. Honest.'], ['Brrp!', 'Can I wear it now? Please?']],
};
/** The first time Bolt comes along into a room, it has something to say about it. */
export const BOLT_ROOMS = {
  deck: ['Bip!', 'Your Command Deck! I like the medals. I polish them at night.'],
  control: ['Brrp.', 'Defence Control. Very serious. I will whisper.'],
  gunner: null,
  hall: ['Bwoo...', 'The big ones in the cradles. They cannot see me. Right?'],
  comms: ['Bip bip!', 'The radio room. I listen to the trawlers sing sometimes.'],
  quarters: ['Bweep!', 'Home!'],
  observatory: ['Wheee...', 'So many stars. I tried counting. I stopped.'],
  yard: ['Brrrp!', 'The shipyard! I want to help. I will hold this. Nothing. I will hold nothing.'],
  beacons: ['Bip...', 'Something out there is answering. I do not like it.'],
  garden: ['Bee!', 'Sprig! Hello Sprig! We are friends. Sprig does not know yet.'],
  cipher: ['Bzzt?', 'The big crystal hums at me. I hum back. We are friends now, I think.'],
  ops: ['Bip bip!', 'When the ships come home, I count them. All of them. Every time.'],
};
/** What ORBIT says about Bolt, now and then, when you tap it. */
export const ORBIT_ON_BOLT = [
  'That is Bolt, {n}. It was built to scrub carbon off the reactor. It follows you instead.',
  'Bolt has been in your quarters every day since you moved in. It rearranges your keepsakes when you are out.',
  'I asked Bolt why it stays. It beeped twice. I think that means you.',
  'Bolt tried to fly a sortie once. It got as far as the airlock.',
  'Bolt keeps a log. It is mostly you, {n}, and the word "again".',
  'I translate for Bolt. Some of it I soften. Not much.',
  'The reactor has never been cleaner. Bolt does it in the time you are out on sorties, then hurries back.',
  'Bolt beeps at the Deck\'s trophies when it thinks nobody is looking. Encouragingly, I think.',
  'Every drone on the station has a job. Bolt decided its job is you.',
  'If you are wondering: yes, it follows you everywhere. I did ask it to give you some room. It did not.',
];
