// The Cipher's record (data/cipher.js): fragments held (kept with the fleet's, st.fleet.fragments, where the expeditions
// have always put them), fragments decoded into glyphs, the route into the Origin once the message is read, and the
// Cipher beaten. Void bosses drop fragments too (a notice on the spot, banked with the sortie).
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { rand } from '@last-orbit/core/rng.js';
import { GLYPHS, FRAGMENTS, FRAGMENT_DROP, ECHO_BP, CIPHER_BP, CIPHER_BP_AGAIN, KEEPER_PAINT, KEEPER_TITLE, cipherOpen } from '@last-orbit/data/cipher.js';
import { VOID_BOSSES } from '@last-orbit/data/beacons.js';
import { sectorOf, hidden } from '@last-orbit/data/sectors.js';

export const cipherOf = (st = G.state) => (st.cipher ||= { decoded: 0, echoes: 0, beaten: 0, kills: 0, best: 0 });
/** Fragments waiting to be decoded. */
export const fragmentsHeld = (st = G.state) => st.fleet?.fragments || 0;
/** Every glyph read: the message is whole, and the Origin can be found. */
export const messageRead = (st = G.state) => cipherOf(st).decoded >= FRAGMENTS;
/** The glyphs read so far, in order. */
export const glyphsRead = (st = G.state) => GLYPHS.slice(0, Math.min(FRAGMENTS, cipherOf(st).decoded));
/** Why a fragment cannot be decoded now, or '' if it can. */
export function cannotDecode(st = G.state) {
  if (!cipherOpen(st)) return 'The Cipher room opens with the crown';
  if (!fragmentsHeld(st)) return 'No fragments to decode';
  return '';
}
/** Decode a fragment (once its signal has been tuned): the next glyph and its line, or once the message is read, an
 *  echo worth a Blueprint. Returns { glyph, n, echo, bp } or null. */
export function decodeFragment(st = G.state) {
  if (cannotDecode(st)) return null; const c = cipherOf(st); st.fleet.fragments--;
  if (c.decoded < FRAGMENTS) { const n = c.decoded++; bus.emit('cipher', 'decoded', n); return { glyph: GLYPHS[n], n, last: c.decoded === FRAGMENTS, echo: false, bp: 0 }; }
  c.echoes = (c.echoes || 0) + 1; st.prestige.bp += ECHO_BP; st.prestige.bpEarned = (st.prestige.bpEarned || 0) + ECHO_BP; bus.emit('cipher', 'echo');
  return { glyph: null, n: FRAGMENTS, echo: true, bp: ECHO_BP };
}
/** The number of the fragment the tuner is on (0-based; past the message, the echoes go round the glyphs again). */
export const tuningFor = (st = G.state) => { const c = cipherOf(st); return c.decoded < FRAGMENTS ? c.decoded : FRAGMENTS + (c.echoes || 0); };

// ------------------------------------------------------------------ the Origin
/** Whether this sortie can follow the signal at the route it is choosing now: the message read, a main sortie (not the
 *  Daily), a Deep Void sector next, and not already followed this sortie. */
export function signalOffered(st = G.state, run = st.run) {
  return !!run && messageRead(st) && !run.mode && !run.daily && !(run.origin >= 0) && sectorOf(run.wave).endless;
}
/** The route is picked: the next sector is the Origin. */
export function followSignal(run = G.state.run) { const idx = sectorOf(run.wave).idx; run.origin = idx; hidden.origin = idx; return idx; }
/** A new sortie starts on the charts again. */
export function resetOrigin(run) { hidden.origin = run?.origin >= 0 ? run.origin : -1; }
export const inOrigin = (w = G.world) => !!w && sectorOf(w.wave?.num || G.state.run?.wave || 1).origin === true;

/** The Cipher falls: the record, the Blueprints, and the first time the Keeper paint and title. Returns what it paid. */
export function recordCipher(st, secs = 0) {
  const c = cipherOf(st), first = !c.beaten; if (first) c.beaten = Date.now(); c.kills = (c.kills || 0) + 1;
  if (secs > 0 && (!c.best || secs < c.best)) c.best = Math.round(secs);
  const bp = first ? CIPHER_BP : CIPHER_BP_AGAIN; st.prestige.bp += bp; st.prestige.bpEarned = (st.prestige.bpEarned || 0) + bp;
  if (first) st.paints[KEEPER_PAINT] ||= Date.now();
  return { first, bp, paint: first ? KEEPER_PAINT : null, title: first ? KEEPER_TITLE : null };
}
/** The pilot's title: Keeper, once the Cipher has fallen; otherwise their rank's. */
export const keeper = (st = G.state) => !!st?.cipher?.beaten;

bus.on('bossDied', (w, boss) => {
  const st = G.state, run = st.run, id = boss.boss?.id; if (!run || run.mode) return;
  if (id === 'cipher') {
    const got = recordCipher(st, boss.boss.t); run.cipher = got;
    bus.emit('notice', { kind: 'unlock', kicker: got.first ? 'The signal is silent' : 'The Cipher, again', title: 'The Cipher beaten', sub: got.first ? `+${got.bp} Blueprints · the Keeper paint · Keeper of the last orbit` : `+${got.bp} Blueprints`, art: 'ach:trophy' });
    return;
  }
  // a Void boss, falling, sometimes lets go of a piece of the signal
  if (VOID_BOSSES.includes(id) && rand() < FRAGMENT_DROP) {
    run.fragments = (run.fragments || 0) + 1;
    bus.emit('notice', { kind: 'unlock', kicker: 'Signal fragment', title: 'A piece of the signal', sub: cipherOpen(st) ? 'Decode it in the Cipher room, in the crown' : 'It will keep until the crown can read it', art: 'relic:r_quantum' });
  }
});
/** The sortie is over: fragments it found go with the rest. Returns how many. */
export function bankFragments(st, run) { const n = run.fragments || 0; if (n) { (st.fleet ||= { out: [null, null, null], log: [], sent: 0, home: 0, fragments: 0, damage: {} }).fragments = (st.fleet.fragments || 0) + n; } return n; }
