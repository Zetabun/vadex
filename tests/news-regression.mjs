// The News channel's stories (data/news.js) from v2.25.2: where the pilot stands on the global boards and in today's
// Daily, a Daily streak, the field kit, a ship in the dry dock, ships home damaged, a room waiting for its first visit
// and Bolt's outfit; each only when there is something to tell. Also the paint chips keep their names whole.
import { newState } from '@last-orbit/core/state.js';
import { newsStories, LORE } from '@last-orbit/data/news.js';
import { dayKey } from '@last-orbit/data/daily.js';
import { ROOMS_ABOARD } from '@last-orbit/data/rooms.js';
import { readFileSync } from 'node:fs';

let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.error('FAIL', msg); } };
const heads = (st) => newsStories(st).map((s) => s.tag + ': ' + s.head);
const has = (st, re) => heads(st).some((h) => re.test(h));

// ------------------------------------------------------------------ a new pilot: none of it
const fresh = newState();
ok(!has(fresh, /^(Boards|Daily|Supply|Shipyard|Fashion):/) && !has(fresh, /limps home|opens aboard/), 'a new pilot has none of these stories: ' + heads(fresh).join(' | '));

// ------------------------------------------------------------------ a pilot with all of it going on
const st = newState(); st.pilot.name = 'Zetabun';
Object.assign(st.global, { told: true, place: { n: 7, of: 212 }, dayPlace: { n: 1, of: 40, day: dayKey() } });
st.daily.streak = 5; st.stats.boostsUsed = 14; st.stats.canisters = 20;
st.refitting = { ship: 'striker', n: 2 }; st.unlocked.ships.striker = 1; st.fleet.damage = { striker: 1, vanguard: 2 };
st.bolt.wear = { paint: 'gold', hat: 'party', eye: 'cyan' }; st.prestige.level = 5;
ok(has(st, /^Boards: Zetabun #7 on the global boards$/), 'the all-time board place is news');
ok(has(st, /^Daily: Zetabun leads today's Daily$/), "leading today's Daily is news");
ok(has(st, /^Daily: 5 Daily Sorties in a row$/), 'a Daily streak is news');
ok(has(st, /^Supply: 14 field boosts used$/), 'the field kit is news');
ok(has(st, /^Shipyard: The Striker in dry dock$/), 'a ship in the dry dock is news');
ok(has(st, /^Fleet: The Striker limps home$/) && newsStories(st).find((s) => /limps/.test(s.head)).body.includes('send them out'), 'ships home damaged are news');
ok(has(st, /^Breaking: Pilot's quarters opens aboard$/), 'a room not yet visited is news');
ok(has(st, /^Fashion: Bolt steps out in a party hat$/), "Bolt's outfit is news");

// ------------------------------------------------------------------ and each only while it is true
st.global.dayPlace.day = '2000-01-01'; ok(!has(st, /today's Daily|Daily Sortie: /), "yesterday's Daily place is not today's news");
st.global.told = false; ok(!has(st, /^Boards:/), 'off the boards: no boards story');
st.refitting = null; st.fleet.damage = {}; for (const r of ROOMS_ABOARD) if (r.seen) st.seen[r.seen] = true; st.bolt.wear = { paint: 'factory', hat: 'none', eye: 'cyan' };
ok(!has(st, /dry dock|limps home|opens aboard|^Fashion:/), 'no dock, no damage, every room visited, Bolt in factory paint: none of those stories');
ok(LORE.length >= 20 && LORE.every((l) => l.tag && l.head && l.body && l.art), 'the lore has its new stories, each complete');

// ------------------------------------------------------------------ the paint chips keep their names whole
const css = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
ok(!/\.paint span\{[^}]*overflow-wrap:anywhere/.test(css) && /\.paints>\.paint span\{font-size:clamp\(/.test(css), 'paint chip names shrink to fit rather than breaking mid-word');

if (failures) { console.error(`news-regression: ${failures} failed`); process.exit(1); }
console.log('news-regression: all passed');
