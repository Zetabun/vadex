// The rooms aboard the station, in the order they open, and how a pilot finds their way into each: what it is for,
// what opens it and which door leads there. The station card lists them with what is waiting in each; the Overhaul
// that opens one offers the way aboard; and until a room's first visit its row, the station callout on Launch and the
// doors that lead to it all say NEW (rendering/room.js). The Command Deck's first visit is its menu's (data/menus.js).
import { siegeUnlocked } from '@last-orbit/data/siege.js';
import { HALL_RANK } from '@last-orbit/data/station.js';
import { COMMS_RANK } from '@last-orbit/data/bounties.js';
import { QUARTERS_RANK, REST_BONUS } from '@last-orbit/data/quarters.js';
import { OBSERVATORY_RANK } from '@last-orbit/data/observatory.js';
import { YARD_RANK } from '@last-orbit/data/shipyard.js';
import { BEACON_RANK } from '@last-orbit/data/beacons.js';

/** id: its hangar tab (and the exhibit kind of the doors that lead there). rank: the Overhaul rank that opens it, or
 *  open: what does (when: said while it is shut). seen: its first-visit flag in state.seen. for: what it is for, in a
 *  line. door: the way in from the room before it. lock: what a tap says while it is shut. intro: what it says on the
 *  first visit (or when the Overhaul that opens it offers the way aboard). color: its accent. */
export const ROOMS_ABOARD = [
  { id: 'deck', name: 'Command Deck', icon: 'deck', rank: 1, color: 0x5ee6ff, for: 'Your medals, banners, records and ships on show' },
  { id: 'control', name: 'Defence Control', icon: 'control', seen: 'control', open: siegeUnlocked, when: 'Opens when you clear Counterattack stage 1', color: 0xffb547,
    for: 'Hold the station in a Station Siege', door: 'the Command Deck\'s right-hand door',
    lock: 'Defence Control opens when the invaders strike back: clear Counterattack stage 1.',
    intro: 'The station\'s war room. Its consoles run every defence you have built, the tactical table adds them up, and the threat board is where you launch a siege. Tap ORBIT\'s terminal for advice.' },
  { id: 'hall', name: 'Trophy Hall', icon: 'awards', seen: 'hall', rank: HALL_RANK, color: 0xffc857,
    for: 'The bosses you capture, and your hunting record', door: 'the Command Deck\'s left-hand door',
    lock: `The Trophy Hall is in the Habitat ring: it opens at Overhaul rank ${HALL_RANK}.`,
    intro: 'The Habitat ring is turning again, and inside it a hall for everything you have beaten. Every boss you capture in the Counterattack hangs in a stasis cradle here, its record on the plaque, and the hologram keeps the hunting record of every sector boss you have faced.' },
  { id: 'comms', name: 'Comms room', icon: 'comms', seen: 'commsRoom', rank: COMMS_RANK, color: 0x6dffc8,
    for: 'Three bounties a day, for salvage and a Blueprint', door: 'the Trophy Hall\'s right-hand door',
    lock: `The Comms room is up the Comms spire: it opens at Overhaul rank ${COMMS_RANK}.`,
    intro: 'The Comms spire is back, and with it the radio room at the top. ORBIT listens on every frequency: each day the miners and trawlers post three bounties, one easy, one harder, one hard, sized to how you fly. Finish them for salvage, and all three in a day for a Blueprint. They are in Missions too.' },
  { id: 'quarters', name: 'Pilot\'s quarters', icon: 'home', seen: 'quarters', rank: QUARTERS_RANK, color: 0xffb070,
    for: `Rest once a day for +${Math.round(REST_BONUS * 100)}% salvage on your next sortie`, door: 'the Trophy Hall\'s left-hand door',
    lock: `Your quarters are in the Outer ring: they open at Overhaul rank ${QUARTERS_RANK}.`,
    intro: `The Outer ring is sealed, and there is a room in it with your name on the door. Rest in your bunk once a day and your next sortie banks ${Math.round(REST_BONUS * 100)}% more salvage. The keepsakes you pick up on the way end up on your shelf, the big moments on your wall. Oh, and Bolt lives here now.` },
  { id: 'observatory', name: 'Observatory', icon: 'observatory', seen: 'observatory', rank: OBSERVATORY_RANK, color: 0xd9a441,
    for: 'Chart the Deep Void, past wave 60, for Blueprints', door: 'the right-hand door in your quarters',
    lock: `The Observatory is the glass dome under the hub: it opens at Overhaul rank ${OBSERVATORY_RANK}.`,
    intro: 'The dome under the hub is open to the stars again. Past wave 60 there are no charts: every depth of the Deep Void you reach waits here to be charted, and charting it lights its constellation in the dome and pays Blueprints, some of them a paint job found nowhere else.' },
  { id: 'yard', name: 'Shipyard', icon: 'yard', seen: 'shipyard', rank: YARD_RANK, color: 0xffc93c,
    for: 'Build the Chimera, a sixth ship', door: 'the Observatory\'s right-hand door',
    lock: `The Shipyard is the frame at the station's rim: it opens at Overhaul rank ${YARD_RANK}.`,
    intro: 'The shipyard frame is up, and for the first time since the Fall the station can build its own ships. The crews have laid out the plans for the first: the Chimera, plated in the alien hulls you towed home. Fund her four stages here and watch her come together on the cradle. When she is done she joins your hangar.' },
  { id: 'beacons', name: 'Beacon array', icon: 'beacon', seen: 'beacons', rank: BEACON_RANK, color: 0xc9b6ff,
    for: 'Void bosses in the Deep Void, from wave 70', door: 'the far door on the Shipyard\'s left',
    lock: `The Beacon array lights every tip of the station: it opens at Overhaul rank ${BEACON_RANK}.`,
    intro: 'The beacons are lit at every tip of the station, calling out into the Deep Void, and something out there is answering. From now on each Deep Void sector ends on a Void boss of its own: six of them, in turn. Beat each one for Blueprints; beat all six for the Lightkeeper paint. Their record is kept here, under the great beacon.' },
];
export const ROOM_BY_ID = Object.fromEntries(ROOMS_ABOARD.map((r) => [r.id, r]));
/** The room an Overhaul to this rank opens (none at rank 4, the Solar wings, or past the Beacon array). */
export const roomAt = (rank) => ROOMS_ABOARD.find((r) => r.rank === rank) || null;
export const roomOpen = (r, state) => (r.open ? r.open(state) : (state.prestige?.level || 0) >= r.rank);
/** Open, and not yet visited: the room is NEW. (The Command Deck goes by its menu instead.) */
export const roomFresh = (id, state) => { const r = ROOM_BY_ID[id]; return !!(r?.seen && roomOpen(r, state) && !state.seen?.[r.seen]); };
/** What a room says the first time: its intro, as the hangar's explainer shows it. */
export const roomIntro = (r) => ({ icon: r.icon, kicker: 'New room aboard', title: r.name, text: r.intro });
