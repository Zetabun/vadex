// Second onboarding phase: a new pilot starts with only Launch open; the other hangar menus open one or two at a time
// as they fly, each with a short explainer the first time it is opened, so the hangar never overwhelms.
// after: sorties flown (or another condition) before the menu opens. Pilots already past ESTABLISHED sorties keep
// every menu open without explainers.
export const ESTABLISHED = 4;
export const MENUS = [
  { id: 'workshop', sorties: 1, icon: 'workshop', title: 'Workshop', text: 'Spend the salvage you bring home on permanent upgrades. They apply to every ship on every sortie, and each one rebuilds a piece of your station.' },
  { id: 'armory', sorties: 2, icon: 'armory', title: 'Armory', text: 'Every weapon and ability that can turn up as a card. Open one to see how it evolves; contracts unlock the rest.' },
  { id: 'contracts', sorties: 2, icon: 'contracts', title: 'Career', text: 'Contracts are goals that unlock new weapons, abilities and ships. Pilot ranks pay out paint jobs and salvage.' },
  { id: 'ships', sorties: 3, icon: 'ships', title: 'Ships', text: 'New hulls with their own guns and abilities, plus the paint jobs, banners and trails you have earned.' },
  { id: 'records', sorties: 3, icon: 'records', title: 'Records', text: 'Your best scores, waves and sorties. Every run is a shot at a new personal best.' },
  { id: 'missions', sorties: 3, counter: true, icon: 'missions', title: 'Missions', text: 'A fresh Daily Sortie every day, Threat levels for bigger rewards, and later on, Counterattack.' },
  { id: 'awards', sorties: 4, icon: 'awards', title: 'Awards', text: 'Medals for milestones. Each pays pilot XP, and collecting them unlocks banners for your ship.' },
  // overhaul: opens at this Overhaul rank instead of after a number of sorties.
  { id: 'deck', overhaul: 1, icon: 'deck', title: 'Command Deck', text: 'Your own room aboard the station. Your medals line the wall, your banners hang from the rafters, and your records and ships are on display. It grows with every Overhaul.' },
];
export const MENU_BY_ID = Object.fromEntries(MENUS.map((m) => [m.id, m]));
