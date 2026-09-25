// The Void bosses' record (data/beacons.js): which have been beaten and when. The first time each one falls it pays
// Blueprints (a notice on the spot, beside the sector-cleared banner, and a row in the debrief); the sixth to fall pays
// the Lightkeeper paint too.
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { VOID_BOSSES, VOID_BOSS_BP, LIGHTKEEPER } from '@last-orbit/data/beacons.js';
import { BOSSES } from '@last-orbit/data/bosses.js';

/** Void bosses beaten at least once: id → when first. */
export const beaten = (st = G.state) => st.beacons?.beaten || {};
export const allBeaten = (st = G.state) => VOID_BOSSES.every((id) => beaten(st)[id]);
/** A Void boss falls: the first time, it goes on the record and pays. Returns what it paid, or null. */
export function recordVoidKill(st, id) {
  if (!VOID_BOSSES.includes(id)) return null; const rec = (st.beacons ||= { beaten: {} }).beaten; if (rec[id]) return null;
  rec[id] = Date.now(); st.prestige.bp += VOID_BOSS_BP; st.prestige.bpEarned = (st.prestige.bpEarned || 0) + VOID_BOSS_BP;
  const paint = allBeaten(st) ? LIGHTKEEPER : null; if (paint) st.paints[paint] ||= Date.now();
  return { id, name: BOSSES[id].name, bp: VOID_BOSS_BP, paint };
}
bus.on('bossDied', (w, boss) => {
  const st = G.state, run = st.run; if (!run || run.mode) return; const got = recordVoidKill(st, boss.boss?.id); if (!got) return;
  (run.voidBeaten ||= []).push(got);
  bus.emit('notice', { kind: 'unlock', kicker: 'Void boss beaten', title: got.name, sub: `First time: +${got.bp} Blueprints` + (got.paint ? ' · all six: Lightkeeper paint' : ''), art: 'ach:trophy' });
});
