// Bolt (data/bolt.js): what it owns and wears, how often it has been patted and played with, what it remembers of your
// last sortie (so it can say something when you are back), and which line it says next (none again until all of that
// kind have been said).
import { BOLT_CANISTER_EVERY } from '@last-orbit/data/boosts.js';
import { rollBoost, stow } from '@last-orbit/progression/boosts.js';
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { COSMETICS, COSMETIC_BY_ID, BOLT_SAYS, BOLT_ROOMS, boltHere } from '@last-orbit/data/bolt.js';

export const boltOf = (st = G.state) => {
  const b = (st.bolt ||= {});
  b.wear ||= { paint: 'factory', hat: 'none', eye: 'cyan' }; b.owned ||= {}; b.rooms ||= {}; b.pets ||= 0; b.fetches ||= 0; if (b.follow == null) b.follow = true;
  return b;
};
/** Owned: what it came with, and whatever it has earned since. */
export const owns = (st, slot, id) => COSMETICS[slot]?.[0]?.id === id || !!boltOf(st).owned[slot + ':' + id];
/** New pieces earned since last asked: they go in the locker, and each is announced once. Returns them. */
export function checkWardrobe(st = G.state, silent = false) {
  if (!boltHere(st)) return [];
  const b = boltOf(st), got = [];
  for (const [slot, list] of Object.entries(COSMETICS)) for (const c of list.slice(1)) { const key = slot + ':' + c.id; if (!b.owned[key] && c.when(st)) { b.owned[key] = Date.now(); got.push(key); } }
  if (got.length && !silent) { const one = got.length === 1 ? COSMETIC_BY_ID[got[0]] : null; /* several at once (the first time, or a big sortie): one notice */
    bus.emit('notice', { kind: 'unlock', kicker: 'Bolt found something', title: one ? one.name : `${got.length} new things to wear`, sub: 'In Bolt\'s locker, in your quarters: tap it to dress Bolt up', art: 'relic:r_swarm' }); }
  if (got.length) b.fresh = (b.fresh || 0) + got.length;
  return got;
}
/** Puts on something it owns. */
export function wear(st, slot, id) { if (!owns(st, slot, id)) return false; boltOf(st).wear[slot] = id; bus.emit('boltDressed', slot, id); return true; }
export const wearing = (st = G.state) => boltOf(st).wear;
/** A pat, and a game of fetch: counted (some pieces are earned by them). */
export function pat(st = G.state) { const b = boltOf(st); b.pets++; checkWardrobe(st); return b.pets; }
export function fetched(st = G.state) { const b = boltOf(st); b.fetches++; checkWardrobe(st); if (b.fetches % BOLT_CANISTER_EVERY === 0) stow(st, rollBoost(), 'bolt'); /* it brings back more than the toy now and then */ return b.fetches; }

// ---------------------------------------------------------------- what it says
const bags = {};
/** A line of a kind, as [beep, meaning], never the same twice running through the kind. */
export function boltLine(kind) {
  const all = BOLT_SAYS[kind]; if (!all?.length) return null;
  let bag = bags[kind]; if (!bag?.length) { bag = bags[kind] = all.map((_, i) => i); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } }
  return all[bag.pop()];
}
/** The first time Bolt comes into a room with you it says something about it (once). */
export function roomLine(st, room) { const b = boltOf(st), l = BOLT_ROOMS[room]; if (!l || b.rooms[room]) return null; b.rooms[room] = Date.now(); return l; }
/** The line for coming back: after a sortie (how it went), after a long time away, or by the time of day. Once. */
export function welcomeLine(st = G.state, now = new Date()) {
  const b = boltOf(st), last = b.last; let kind = null;
  if (last && !last.said) { last.said = true; kind = last.breached ? 'breach' : last.best ? 'win' : last.reason === 'abandoned' ? 'abandoned' : 'loss'; }
  else if (b.seenAt && now - b.seenAt > 36 * 3600000) kind = 'long';
  else if (!b.greetedDay || b.greetedDay !== now.toDateString()) { const hr = now.getHours(); kind = hr >= 23 || hr < 5 ? 'night' : hr >= 5 && hr < 10 ? 'morning' : null; }
  b.seenAt = +now; if (kind === 'night' || kind === 'morning') b.greetedDay = now.toDateString();
  return kind ? boltLine(kind) : null;
}
/** A sortie ended: Bolt remembers how (it says so next time you are aboard). */
bus.on('sortieEnded', (summary) => { const st = G.state; if (!boltHere(st) || !summary || summary.counter) return; boltOf(st).last = { at: Date.now(), reason: summary.reason, best: !!summary.best && summary.wave > 1, breached: !!summary.breached, said: false }; });
