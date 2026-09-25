// The Pilot's quarters (data/quarters.js): resting in the bunk, once a day, leaves the pilot well rested for their next
// sortie (it banks more salvage); the lights' mood. Keepsakes and photos are worked out from the save as it is.
import { G } from '@last-orbit/core/game.js';
import { dayKey } from '@last-orbit/data/daily.js';
import { KEEPSAKES, PHOTOS, MOODS } from '@last-orbit/data/quarters.js';

const quarters = (st) => (st.quarters ||= { restDay: '', rested: false, mood: 'warm' });
/** Rest in the bunk: 'rested' (well rested for the next sortie), 'already' (still rested, not flown yet) or
 *  'tomorrow' (rested today already). */
export function rest(st = G.state, today = dayKey()) {
  const q = quarters(st); if (q.rested) return 'already'; if (q.restDay === today) return 'tomorrow';
  q.restDay = today; q.rested = true; return 'rested';
}
/** A sortie is starting: a rested pilot takes it with them (true), and is rested no longer. */
export function takeRest(st = G.state) { const q = st.quarters; if (!q?.rested) return false; q.rested = false; return true; }
/** The next mood for the lights. */
export function nextMood(st = G.state) { const q = quarters(st), i = MOODS.findIndex((m) => m.id === q.mood); q.mood = MOODS[(i + 1) % MOODS.length].id; return MOODS.find((m) => m.id === q.mood); }
export const keepsakesEarned = (st = G.state) => KEEPSAKES.filter((k) => k.req(st));
export const photosEarned = (st = G.state) => PHOTOS.filter((p) => p.req(st));
