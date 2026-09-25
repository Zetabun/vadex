// Daily bounties: three jobs a day, picked up over the radio once the Comms spire is back (Overhaul rank 3) and shown in
// the Comms room and in Missions. One easy, one harder and one hard each day, sized to the pilot's own form (their
// average per sortie of whatever the job counts), each paying salvage by what a sortie of theirs earns; all three in a
// day pay a Blueprint besides. A job counts a lifetime stat from when it was posted (stat), or looks for one sortie that
// reaches a wave (best). progression/bounties.js posts, tracks and pays them.
import { fmtInt } from '@last-orbit/core/format.js';

/** The Comms spire comes back at this Overhaul rank, and with it the bounties. */
export const COMMS_RANK = 3;
/** What a job pays, as a share of one of the pilot's sorties, by how hard it is (tier 1-3). */
export const BOUNTY_PAY = { 1: 0.5, 2: 0.8, 3: 1.2 };
/** All three done in a day. */
export const BOUNTY_BONUS_BP = 1;

// per: how many sorties' worth of the pilot's average (their lifetime stat / sorties); min: never less; step: rounded to.
// goal: a fixed goal instead. needs(state, today): when the job can be posted.
export const BOUNTY_POOL = [
  { id: 'kills', tier: 1, stat: 'kills', per: 1.5, min: 120, step: 10, text: (n) => `Down ${fmtInt(n)} invaders` },
  { id: 'waves', tier: 1, stat: 'wavesCleared', per: 1.5, min: 12, step: 1, text: (n) => `Clear ${n} waves` },
  { id: 'dodges', tier: 1, stat: 'dodges', per: 1.5, min: 15, step: 5, text: (n) => `Dodge ${n} times` },
  { id: 'daily', tier: 1, stat: 'dailies', goal: 1, text: () => 'Fly the Daily Sortie', needs: (s, today) => s.stats.sorties > 0 && s.daily.lastDay !== today },
  { id: 'caRuns', tier: 1, stat: 'counterRuns', goal: 2, text: () => 'Fly 2 Counterattack stages', needs: (s) => s.counter.unlocked },
  { id: 'elites', tier: 2, stat: 'eliteKills', per: 1.6, min: 4, step: 1, text: (n) => `Destroy ${n} elites` },
  { id: 'bosses', tier: 2, stat: 'bossKills', per: 1.6, min: 2, step: 1, text: (n) => `Defeat ${n} bosses or mini-bosses` },
  { id: 'flawless', tier: 2, stat: 'flawless', per: 1.4, min: 3, step: 1, text: (n) => `Clear ${n} waves without taking a hit` },
  { id: 'weak', tier: 2, stat: 'weakHits', per: 1.6, min: 10, step: 5, text: (n) => `Hit bosses' weak points ${n} times` },
  { id: 'salvage', tier: 2, stat: 'totalSalvage', per: 1.8, min: 300, step: 50, text: (n) => `Bank ${fmtInt(n)} salvage` },
  { id: 'siege', tier: 2, stat: 'siegeWins', goal: 1, text: () => 'Hold a Station Siege', needs: (s) => s.counter.unlocked && Object.keys(s.counter.stars || {}).length > 0 },
  { id: 'reach', tier: 3, best: true, text: (n) => `Reach wave ${n} in one sortie` },
  { id: 'ship', tier: 3, best: true, ship: true, text: (n, ship) => `Reach wave ${n} flying the ${ship}`, needs: (s) => Object.keys(s.unlocked.ships).length > 1 },
  { id: 'caStar', tier: 3, stat: 'counterStars', goal: 1, text: () => 'Earn a new Counterattack star', needs: (s) => s.counter.unlocked && Object.values(s.counter.stars || {}).reduce((a, b) => a + b, 0) < 18 },
];
export const BOUNTY_BY_ID = Object.fromEntries(BOUNTY_POOL.map((b) => [b.id, b]));

// ORBIT on the radio in the Comms room: what the spire picks up, after any word on the day's bounties.
export const TRANSMISSIONS = [
  'A trawler off the Lunar Graveyard, {n}. They say the lanes are quieter since you went through. They say thank you.',
  'Static from the Red Nebula. Something in there is still broadcasting on their old frequencies. I am keeping a log.',
  'A child on a mining tug asked who flies the ship with our callsign. I told them: {n}. They asked if you are real.',
  'Relay buoys coming back online across the belt, one by one. Every one we hear is somebody still out there.',
  'I have been listening to their fleet chatter. They have a word for our station now. I think it means "the one that stayed".',
  'Distress call from the Hive side, forty years old and still repeating. We cannot answer it. I play it once a day anyway.',
  'The miners pay for bounties because we are the only ones who come when they call. Keep it that way, {n}.',
  'Machine Territory is sending again. Not words: numbers. Counting down, or counting up. I cannot tell yet.',
  'An old navy frequency just opened. One voice, reading out the names of ships. Ours was on the list.',
  'Nothing tonight but the Earth, humming. It sounds different from up here. Calmer.',
];
