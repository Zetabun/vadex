// Station News: the Command Deck TV's News channel (rendering/deck.js). Stories from what has been happening to you
// (the sortie just flown, your records, the station's rebuild, the fleet, sieges, the Greenhouse, bounties, the Daily
// Sortie, the Deep Void, even Bolt), with the station's lore, the weather, sport and adverts in between, and a ticker
// along the bottom. Stories are worked out from the save each time the channel is shown; the lore is fixed.
import { SHIP_BY_ID } from '@last-orbit/data/ships.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { rebuildPct } from '@last-orbit/data/station.js';
import { DEST_BY_ID } from '@last-orbit/data/fleet.js';
import { VOID_BOSSES } from '@last-orbit/data/beacons.js';
import { BOSSES } from '@last-orbit/data/bosses.js';

const fmt = (n) => Math.round(n || 0).toLocaleString('en-GB');
/** The station's stories, always in the running: history, the invaders, the people out there, weather, sport, adverts. */
export const LORE = [
  { tag: 'History', art: 'relic:r_phoenix', head: 'Ten years since the Fall', body: 'The invaders came down on the colonies in a single night. What was left of the fleet fell back to the last station still in orbit, and held.' },
  { tag: 'History', art: 'ship:vanguard', head: 'Why they call it the Last Orbit', body: 'Of the forty stations that once ringed the Earth, one kept its lights on. The old crews named it for what it was, and the name stuck.' },
  { tag: 'Science', art: 'relic:r_quantum', head: 'Where do the invaders come from?', body: 'ORBIT\'s best guess: somewhere past the Deep Void. Every wave that comes down is a little different, as if something out there is learning.' },
  { tag: 'Community', art: 'relic:r_midas', head: 'Trawler families mark Salvage Day', body: 'The trawlers who pick the wreck fields clean held their yearly feast out past the ring. Everyone is invited. Nobody knows who brings the soup.' },
  { tag: 'Community', art: 'ws:w_shield', head: 'Miners\' guild thanks the pilots', body: 'The asteroid crews say the lanes have not been this quiet in years. They have promised to keep posting bounties "until the pilot says stop".' },
  { tag: 'Deep Void', art: 'relic:r_giant', head: 'The signal past the beacons', body: 'Listening posts report a faint, steady pulse from beyond the Deep Void. It is not from us. It is not from them, either, as far as anyone can tell.' },
  { tag: 'Weather', art: 'relic:r_chrono', head: 'Meteor showers over the Outer ring', body: 'Expect light debris tonight on the sunward side. Shields up, windows closed, and please stop the drones chasing the shooting stars.' },
  { tag: 'Weather', art: 'relic:r_aegis', head: 'Solar storm: nothing to worry about', body: 'A mild flare will brush the station this week. The Solar wings love it. Expect bright aurora and slightly crackly radio.' },
  { tag: 'Sport', art: 'relic:r_swarm', head: 'Drone racing: another disqualification', body: 'The ring\'s drone league has again excluded a maintenance unit for "following a pilot around the course instead of racing".' },
  { tag: 'Sport', art: 'weapon:laser', head: 'Target range record falls', body: 'A deck hand hit forty targets in forty seconds on the old gunnery range. The pilots are said to be "politely unimpressed".' },
  { tag: 'Advert', art: 'relic:r_titan', head: 'Titan Frame: be the wall', body: 'Plating so thick the invaders give up and go home. Terms apply. They do not give up. They do not go home.' },
  { tag: 'Advert', art: 'cur:salvage', head: 'Sell your salvage? Never.', body: 'The Workshop pays in rebuilt station, and that is the best price there is. A message from the Rebuild Committee.' },
  { tag: 'Culture', art: 'relic:r_scholar', head: 'The station choir is back', body: 'Rehearsals resume in the Habitat ring on rest days. They are looking for tenors, and for someone to tell the Comms spire to stop singing along.' },
  { tag: 'Culture', art: 'relic:r_predict', head: 'ORBIT answers your questions', body: 'Asked what it does when nobody is flying, the station AI said it "counts the stars and recalibrates the kettle". It did not say which it prefers.' },
];

/** What has been happening to you, as stories, most newsworthy first. */
export function newsStories(st) {
  const out = [], s = st.stats || {}, name = st.pilot?.name || 'our pilot', station = st.stationName || 'the station', last = st.history?.[0], lastRun = st.bolt?.last;
  if (last) { const ship = SHIP_BY_ID[last.ship]?.name || 'ship', sec = sectorOf(last.wave).def?.name || 'the dark';
    out.push(lastRun?.breached ? { tag: 'Breaking', art: 'relic:r_giant', head: `Line broken in ${sec}`, body: `Invaders slipped past the defences at wave ${last.wave}. ${name} and the ${ship} made it home with ${fmt(last.salvage)} salvage. Crews are sweeping up.` }
      : lastRun?.best ? { tag: 'Breaking', art: 'ship:' + last.ship, head: `New record: wave ${last.wave}`, body: `${name} pushed the ${ship} further than ever before, deep into ${sec}, and brought home ${fmt(last.salvage)} salvage. The Deck is buzzing.` }
      : { tag: 'Sortie report', art: 'ship:' + last.ship, head: `The ${ship} returns from ${sec}`, body: `The latest sortie reached wave ${last.wave} and banked ${fmt(last.salvage)} salvage for the rebuild.` }); }
  const pct = rebuildPct(st); if (pct > 0) out.push({ tag: 'Station', art: 'relic:r_titan', head: `${station} ${pct}% rebuilt`, body: pct >= 100 ? 'Every module, every piece of the station, back. The old crews would not believe it.' : `Another piece of ${station} is back online. Workshop crews say the next ${pct < 50 ? 'modules are' : 'core pieces are'} in reach.` });
  if (s.bestWave) out.push({ tag: 'Records', art: 'relic:r_giant', head: `Furthest wave: ${s.bestWave}`, body: `${fmt(s.kills)} invaders downed across ${fmt(s.sorties)} sorties. High score to beat: ${fmt(s.bestScore)}.` });
  // the fleet
  for (const o of st.fleet?.out || []) if (o) { const d = DEST_BY_ID[o.dest], ship = SHIP_BY_ID[o.ship]?.name; if (d && ship) { out.push({ tag: 'Fleet', art: 'ship:' + o.ship, head: `The ${ship} scouting ${d.name}`, body: `Fleet Ops reports the ${ship} is out past ${d.name}. Families along the halo are watching the telemetry.` }); break; } }
  if ((st.fleet?.home || 0) > 0) out.push({ tag: 'Fleet', art: 'relic:r_swarm', head: `${st.fleet.home} expeditions home`, body: `Every one of them logged in Fleet Ops.${st.fleet.fragments ? ` Researchers are puzzling over ${st.fleet.fragments} signal fragment${st.fleet.fragments > 1 ? 's' : ''} from the Deep Void.` : ''}` });
  // sieges, bosses, the Deep Void
  if (st.siege?.damage?.ids?.length) out.push({ tag: 'Breaking', art: 'ws:w_shield', head: 'Station systems still down', body: 'Repairs after the last siege are under way. Defence Control asks pilots to top up the repair fund.' });
  else if (s.siegeWins) out.push({ tag: 'Defence', art: 'ws:w_shield', head: `${s.siegeWins} siege${s.siegeWins > 1 ? 's' : ''} held`, body: 'The gunners in Defence Control have held the line again. Drinks are on the Habitat ring.' });
  const voidBeaten = VOID_BOSSES.filter((id) => st.beacons?.beaten?.[id]); if (voidBeaten.length) out.push({ tag: 'Deep Void', art: 'relic:r_giant', head: `${BOSSES[voidBeaten[voidBeaten.length - 1]]?.name || 'A Void boss'} silenced`, body: `${voidBeaten.length} of the six things answering the beacons have been beaten. The rest are still out there.` });
  else if ((s.bestWave || 0) > 60) out.push({ tag: 'Deep Void', art: 'relic:r_chrono', head: `Charts reach wave ${s.bestWave}`, body: 'Past wave 60 the maps run out. The Observatory is drawing new ones, depth by depth.' });
  if (s.bossKills) out.push({ tag: 'Hunting', art: 'relic:r_giant', head: `${fmt(s.bossKills)} bosses beaten`, body: 'Each one towed home or scattered across the sectors. The Trophy Hall keeps the count.' });
  // the Greenhouse, bounties, the Daily Sortie, Bolt
  const grown = Object.keys(st.garden?.grown || {}).length; if (grown) out.push({ tag: 'Greenhouse', art: 'relic:r_leech', head: `${grown} kind${grown > 1 ? 's' : ''} of plant grown aboard`, body: 'The old greenhouse is green again. Sprig the drone reports "excellent soil, adequate pilot".' });
  const done = (st.bounties?.list || []).filter((b) => b.done).length; if (done) out.push({ tag: 'Radio', art: 'relic:r_midas', head: `${done} bount${done > 1 ? 'ies' : 'y'} settled today`, body: 'The trawlers and miners send their thanks, and more jobs.' });
  if (st.bolt?.pets > 10) out.push({ tag: 'Local', art: 'relic:r_swarm', head: 'Drone refuses to leave pilot\'s side', body: `The maintenance unit known as Bolt has now been patted ${fmt(st.bolt.pets)} times. It describes this as "not enough".` });
  return out;
}
/** The ticker along the bottom: the numbers, then the lore's headlines. */
export function newsTicker(st) {
  const s = st.stats || {}, bits = [`${(st.stationName || 'The station').toUpperCase()} · ${rebuildPct(st)}% REBUILT`, `BEST WAVE ${s.bestWave || 0}`, `${fmt(s.kills)} INVADERS DOWN`, `${fmt(st.salvage)} SALVAGE IN THE BANK`];
  if (st.fleet?.out?.some(Boolean)) bits.push(`${st.fleet.out.filter(Boolean).length} SHIP${st.fleet.out.filter(Boolean).length > 1 ? 'S' : ''} OUT ON EXPEDITIONS`);
  return [...bits, ...LORE.map((l) => l.head.toUpperCase())].join('   ◆   ');
}
