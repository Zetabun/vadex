// What Bolt has noticed about how things stand aboard (data/bolt.js has what it says in general; this is what it says
// about now): ships home or hurt in Fleet Ops, blooms and dry beds in the Greenhouse, a bounty to claim, systems still
// down after a siege, a new depth to chart, a refit it could take, the Chimera's next stage, your bunk, the Daily
// Sortie, a ship you can afford, and something about whichever room you are in. Each piece of news has a key (so the
// UI can rest it a while once said), a priority (2 and up: it says it without being asked; 3: it can't wait), and a
// line: a beep and what it means. Where the news is about the room you are standing in, it says it that way.
import { SHIPS, SHIP_BY_ID } from '@last-orbit/data/ships.js';
import { DEST_BY_ID, fleetOpen } from '@last-orbit/data/fleet.js';
import { fleet, tripDone, tripLeft, damageOf, fleetCounts } from '@last-orbit/progression/fleet.js';
import { gardenOpen } from '@last-orbit/data/garden.js';
import { gardenCounts, wateredToday } from '@last-orbit/progression/garden.js';
import { bountyClaimable, commsOpen } from '@last-orbit/progression/bounties.js';
import { siegeDamage, SYSTEM_BY_ID } from '@last-orbit/data/siege.js';
import { chartable } from '@last-orbit/progression/observatory.js';
import { observatoryOpen, VOID_MARKS } from '@last-orbit/data/observatory.js';
import { yardOpen, YARD_STAGES } from '@last-orbit/data/shipyard.js';
import { yardStage, yardDone, nextStage, stageBlock } from '@last-orbit/progression/shipyard.js';
import { refitReady } from '@last-orbit/progression/refits.js';
import { quartersOpen, KEEPSAKES } from '@last-orbit/data/quarters.js';
import { dayKey } from '@last-orbit/data/daily.js';
import { dailyToday, shipStatus, workshopMaxed } from '@last-orbit/progression/meta.js';
import { VOID_BOSSES } from '@last-orbit/data/beacons.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const hrs = (v) => (v >= 1 ? `${Math.floor(v)} hour${Math.floor(v) === 1 ? '' : 's'}` : `${Math.max(1, Math.ceil(v * 60))} minutes`);
const say = (key, pri, lines, vars = {}) => { const [b, t] = pick(lines); return { key, pri, line: [b, t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')] }; };

/** Everything Bolt could mention right now, most pressing first. room: the room you are in (G.room). */
export function boltNews(st, room, now = Date.now()) {
  const out = [], here = (id) => room === id;
  // Fleet Ops: ships home, ships hurt, ships out, an empty berth
  if (fleetOpen(st)) {
    const f = fleet(st);
    f.out.forEach((o, i) => { if (!o) return; const ship = SHIP_BY_ID[o.ship]?.name || 'ship', dest = DEST_BY_ID[o.dest]?.name || 'the dark';
      if (tripDone(st, i, now) >= 1) out.push(say('home:' + o.ship + o.at, 3, here('ops') ? [['Bweep!', 'The {ship} is home! Right there, berth {n}. Tap her to unload!'], ['Bip bip bip!', 'I counted her in. The {ship}, safe and sound.']] : [['Bweep!', 'The {ship} is home! She is waiting in Fleet Ops.'], ['Bip bip!', 'A ship just docked. The {ship}! I counted her in.'], ['Brrp!', 'Fleet Ops pinged me: the {ship} is back from {dest}.']], { ship, dest, n: i + 1 }));
      else out.push(say('out:' + o.ship, 1, [['Bip?', 'The {ship} is still out at {dest}. Back in about {time}.'], ['Wrrr.', 'I keep checking on the {ship}. {time} to go.'], ['Bip.', 'No news from the {ship} yet. No news is good news. I think.']], { ship, dest, time: hrs(tripLeft(st, i, now)) })); });
    for (const s of SHIPS) if (st.unlocked?.ships?.[s.id] && damageOf(st, s.id)) out.push(say('hurt:' + s.id, 2, [['Brrp...', 'The {ship} is still dented from that expedition. She needs repairs before she flies.'], ['Bwoo.', 'I looked at the {ship}. The dents look sore. Repairs?']], { ship: s.name }));
    const c = fleetCounts(st, now); if (here('ops') && c.free && SHIPS.some((s) => st.unlocked?.ships?.[s.id] && s.id !== st.ship && !damageOf(st, s.id) && !f.out.some((o) => o?.ship === s.id))) out.push(say('berth', 2, [['Bip!', 'An empty berth! Someone could go scouting.'], ['Bip bip?', 'Nobody in berth {n}. Can we send someone?']], { n: f.out.findIndex((o) => !o) + 1 }));
  }
  // the Greenhouse
  if (gardenOpen(st) && st.garden?.started) {
    const g = gardenCounts(st, now);
    if (g.bloom) out.push(say('bloom:' + g.bloom, 3, here('garden') ? [['Bee!', '{n} in bloom! Harvest them and they come with you next sortie.']] : [['Bee!', 'Something is in bloom in the Greenhouse! Sprig told me. Sort of.'], ['Bip bip!', 'The Greenhouse smells lovely today. {n} ready to harvest.']], { n: g.bloom }));
    else if (g.growing && !wateredToday(st)) out.push(say('water:' + dayKey(), 2, here('garden') ? [['Bip?', 'The beds look thirsty. The tap is just there.']] : [['Bip?', 'The Greenhouse beds look thirsty today.'], ['Brrp.', 'Sprig is waiting for you to turn the tap on.']]));
  }
  // the Comms room: a bounty to claim
  if (commsOpen(st) && bountyClaimable(st)) out.push(say('bounty', 3, [['Bweep!', 'A bounty is done! Your pay is waiting in the Comms room.'], ['Bip bip!', 'The trawlers radioed. They owe you. Comms room!']]));
  // Defence Control: systems still down
  const dmg = siegeDamage(st); if (dmg) out.push(say('siege:' + dmg.ids.join(), 3, [['Bzzt!', 'The {sys} is still down since the siege. Defence Control can patch it.'], ['Brrp...', 'I can hear the {sys} sparking. Repairs would help.']], { sys: SYSTEM_BY_ID[dmg.ids[0]]?.name || 'station' }));
  // the Observatory: a depth to chart
  if (observatoryOpen(st) && chartable(st).length) out.push(say('chart:' + chartable(st).length, 2, [['Wheee...', 'A new depth to chart in the Observatory. So many stars!'], ['Bip!', 'You went so deep there is a new bit of sky to chart.']]));
  // the Shipyard: the next stage, if it can be built
  if (yardOpen(st) && !yardDone(st) && !stageBlock(st)) { const n = nextStage(st); out.push(say('yard:' + yardStage(st), 2, [['Brrrp!', 'The shipyard crews are ready: you can fund {stage} now.'], ['Bip bip!', 'The Chimera is waiting for {stage}. I can already hear the welders.']], { stage: n?.name?.toLowerCase() || 'the next stage' })); }
  // refits, a ship to buy
  const refit = SHIPS.find((s) => refitReady(st, s.id)); if (refit) out.push(say('refit:' + refit.id + (st.refits?.[refit.id] || 0), 2, [['Bip!', 'The {ship} could take a refit. I have the materials counted.'], ['Brrp!', 'Enough materials for the {ship}\'s next refit. Ships menu!']], { ship: refit.name }));
  const buy = SHIPS.find((s) => shipStatus(s.id) === 'buyable' && st.salvage >= s.cost); if (buy) out.push(say('buy:' + buy.id, 1, [['Bip?', 'The {ship} is for sale in the Ships menu. And you can afford her. Just saying.']], { ship: buy.name }));
  // your quarters: the bunk; the Workshop full; the Daily Sortie
  if (quartersOpen(st) && !st.quarters?.rested && st.quarters?.restDay !== dayKey()) out.push(say('rest:' + dayKey(), here('quarters') ? 2 : 1, [['Bip... zz.', 'Your bunk is made. A rest now means more salvage next sortie.'], ['Brr-yawn.', 'You look tired. The bunk is right there. I will keep watch.']]));
  if (workshopMaxed()) out.push(say('overhaul', 1, [['Bip bip!', 'The Workshop is full up. ORBIT says an Overhaul is next. I will miss nothing. I remember everything.']]));
  if ((st.stats?.sorties || 0) > 0) { const d = dailyToday(); if (!d.done) out.push(say('daily:' + d.key, 1, [['Bweep?', 'Today\'s Daily Sortie is waiting: {m}!'], ['Bip!', 'A new Daily Sortie. {m}. Sounds exciting. Sounds dangerous.']], { m: d.mutator?.name || 'something new' })); }
  // the room you are in
  const rl = ROOM_TALK[room]?.(st); if (rl) out.push(say('room:' + room, 1, rl.lines, rl.vars));
  return out.sort((a, b) => b.pri - a.pri);
}
/** Something about the room you are in, from how things stand. */
const ROOM_TALK = {
  deck: (st) => ({ lines: [['Bip!', 'Wave {w}. That is your best. I tell the other drones about it.'], ['Brrp.', 'I dusted the medals. {m} of them now.']], vars: { w: st.stats?.bestWave || 0, m: Object.keys(st.medals || {}).length } }),
  hall: (st) => ({ lines: [['Bwoo...', 'They are so big. {n} bosses beaten, and you still come back for more.'], ['Bip?', 'Do the ones in the cradles dream? I hope not.']], vars: { n: st.stats?.bossKills || 0 } }),
  comms: (st) => ({ lines: [['Bip bip!', 'The radio hums at night. The trawlers sing to each other.'], ['Brrp.', '{n} bounties done today. The miners talk about you.']], vars: { n: (st.bounties?.list || []).filter((b) => b.done).length } }),
  quarters: (st) => ({ lines: [['Bip!', '{n} keepsakes on the shelf. I rearranged them by colour. Then back.'], ['Brrp.', 'Home. My favourite room. Yours too, I think.']], vars: { n: KEEPSAKES.filter((k) => k.req?.(st)).length } }),
  observatory: (st) => ({ lines: [['Wheee...', '{n} depths charted. The sky is filling up.'], ['Bip.', 'I tried counting the stars again. I got to eleven.']], vars: { n: VOID_MARKS.filter((m) => st.observatory?.charted?.[m.wave]).length } }),
  yard: (st) => ({ lines: yardDone(st) ? [['Brrrp!', 'She is finished. The crews let me sit in the cockpit once.']] : [['Bip bip!', 'The Chimera, {s} of {t} built. I am helping. Mostly by watching.']], vars: { s: yardStage(st), t: YARD_STAGES.length } }),
  beacons: (st) => ({ lines: [['Bip...', '{n} of the Void bosses beaten. The beacon still hums at the others.'], ['Wrrr.', 'The light is so bright up here. I keep my eye half closed.']], vars: { n: VOID_BOSSES.filter((id) => st.beacons?.beaten?.[id]).length } }),
  garden: () => ({ lines: [['Bee!', 'Sprig! Hello Sprig!'], ['Bip.', 'I like how it smells in here. Like outside. I think. I have never been outside.']] }),
  ops: (st) => ({ lines: [['Bip bip!', '{n} expeditions home so far. I counted every one.'], ['Brrp.', 'The halo out there hums. The ships can hear it all the way out.']], vars: { n: fleet(st).home || 0 } }),
  control: () => ({ lines: [['Brrp.', 'Defence Control. I will whisper.'], ['Bip?', 'Every light on these consoles is a gun. I counted. I stopped.']] }),
};
