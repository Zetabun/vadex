// Field boosts: short, strong boosts the pilot times for themselves, packed in supply canisters.
// The supply meter fills as the ship damages invaders during a sortie (a kill's worth at a time: an invader destroyed
// fills one, an elite three, a boss twenty). Full, it packs a canister into the field kit, and each fill after that
// takes longer (SUPPLY_GROWTH), so a sortie brings home a few. The kit keeps boosts between sorties; tapping it during
// a sortie opens it (the battle waits) to use one. Expeditions and Bolt turn up canisters too.
// Boosts are for main sorties only: never in the Daily (the global board's race stays even) or Counterattack.
// fx: stat modifiers while the boost lasts (as cards have); secs 0: it acts at once (the hull patch). Another of a boost
// already running adds its time, up to STACK_MAX doses' worth. (Tuned with tests/kit-probe.mjs and progression-sim.mjs KIT=1:
// at double salvage with no cap, boosts used as they came added a third to the salvage of 40 sorties.)
export const BOOSTS = [
  { id: 'surge', name: 'Salvage Surge', icon: 'boost:surge', color: '#ffc857', secs: 60, weight: 5, fx: [['salvageGain', 'mult', 0.5]], desc: '+50% salvage', how: 'Half as much salvage again for 60 seconds. Best in a wave full of elites, or just before a boss goes down.' },
  { id: 'burst', name: 'Data Burst', icon: 'boost:burst', color: '#6dffc8', secs: 60, weight: 5, fx: [['xpGain', 'mult', 0.5]], desc: '+50% XP', how: 'Half as much experience again for 60 seconds: more level-ups, sooner.' },
  { id: 'prospect', name: 'Prospector', icon: 'boost:prospect', color: '#9fc2ff', secs: 90, weight: 4, fx: [], desc: 'Double materials', how: 'Every material you pick up counts twice for 90 seconds: Alloy, Crystal or Shard, whichever the sector drops.' },
  { id: 'overcharge', name: 'Overcharge', icon: 'boost:overcharge', color: '#ff8a3d', secs: 45, weight: 3, fx: [['damage', 'mult', 0.5]], desc: '+50% damage', how: 'Every gun hits half as hard again for 45 seconds. Save it for a boss.' },
  { id: 'tractor', name: 'Tractor Pulse', icon: 'boost:tractor', color: '#ff6b9a', secs: 60, weight: 3, fx: [['magnet', 'mult', 4]], desc: 'Pull in every pickup', how: 'Pickups fly to you from five times as far for 60 seconds, so nothing is left behind.' },
  { id: 'patch', name: 'Hull Patch', icon: 'boost:patch', color: '#6dff8e', secs: 0, weight: 3, fx: [], desc: 'Repair 35% hull', how: 'Repairs 35% of your hull at once.' },
];
export const BOOST_BY_ID = Object.fromEntries(BOOSTS.map((b) => [b.id, b]));
export const KIT_MAX = 5; // of each boost; a canister for a full slot is sold for salvage (KIT_SELL)
export const KIT_SELL = 120;
export const PATCH_HEAL = 0.35;
export const STACK_MAX = 2; // a boost's timer holds at most two doses
export const SUPPLY_FIRST = 150; // kills' worth to the first canister of a sortie
export const SUPPLY_GROWTH = 1.6; // each canister after that takes this much more
export const SUPPLY_WEIGHT = { boss: 20, elite: 3, kill: 1 };
export const TRIP_CANISTER = 0.3; // an expedition's chance of bringing one home (and 4% more per destination further out)
export const BOLT_CANISTER_EVERY = 5; // Bolt turns one up every so many games of fetch
/** Whether a sortie uses the field kit: main sorties only, not the Daily or Counterattack. */
export const kitOn = (run) => !!run && !run.mode && !run.daily;
