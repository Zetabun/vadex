// The global boards from the game's side (progression/global.js), talking to the real worker (api/src/index.js) over
// SQLite: nothing posts before the pilot is told or from a sandbox; telling puts their best up; a Daily goes to its
// day and a new best to 'all'; a post made offline waits and goes up later; a refused one is dropped; turning the
// boards off takes the pilot off them; a finished sortie queues itself and says where it landed.
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { dayKey } from '@last-orbit/data/daily.js';
import { net, gl, posting, tell, boardsFor, entryOf, queue, flush, setBoards, fetchBoard, cachedBoard, boardOf, pilotId } from '@last-orbit/progression/global.js';
import worker from '../api/src/index.js';
import { d1 } from './d1-shim.mjs';

let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.error('FAIL', msg); } };
const { db, env } = d1();
let down = false, sent = [];
net.base = 'https://api.test';
net.fetch = async (url, opts = {}) => { if (down) throw new TypeError('Failed to fetch'); sent.push({ url, body: opts.body ? JSON.parse(opts.body) : null }); return worker.fetch(new Request(url, { ...opts, headers: { ...(opts.headers || {}), Origin: 'https://zetabun.github.io' } }), env); };
const posted = []; bus.on('globalPosted', (item, res, why) => posted.push({ item, res, why }));

const st = (G.state = newState()); st.pilot.name = 'Ace'; st.stationName = 'Haven';
st.records.top = [{ score: 42000, wave: 25, ship: 'vanguard', level: 18, kills: 500, threat: 0, daily: false, warp: 1, date: Date.now() - 864e5 }];
const today = dayKey(), summary = (score, more = {}) => ({ score, wave: 20, ship: 'vanguard', threat: 0, warp: 1, level: 15, kills: 400, time: 300, ...more });

// ------------------------------------------------------------------ not before being told, never from a sandbox
ok(!posting(st) && boardsFor(st, summary(1)).length === 1, 'a new pilot is not posting yet');
bus.emit('sortieEnded', summary(50000)); ok(gl(st).pending.length === 0 && sent.length === 0, 'nothing goes up before the pilot is told');
st.meta.sandbox = true; ok(!tell(st) && !gl(st).told, 'a sandbox save never joins the boards'); st.meta.sandbox = false;

// ------------------------------------------------------------------ joining: the best so far goes up
ok(tell(st) && gl(st).told && gl(st).pending.length === 1 && gl(st).pending[0].boards.join() === 'all' && gl(st).best === 42000, 'being told queues the best sortie so far for the all-time board');
ok(!tell(st), 'told once');
await flush(st);
ok(gl(st).pending.length === 0 && sent.length === 1 && /^[0-9a-f]{32}$/.test(sent[0].body.p) && sent[0].body.name === 'Ace' && sent[0].body.station === 'Haven' && sent[0].body.rank === st.pilot.rank, 'it goes up with the id, callsign and station: ' + JSON.stringify(sent[0]?.body));
ok(posted.at(-1).res?.boards?.all?.me?.n === 1 && cachedBoard('all')?.data?.total === 1, 'the post says where it landed and refreshes the board');
ok(/^[2-9A-HJKMNP-Z]{4}$/.test(gl(st).tag || ''), 'the pilot keeps the tag the boards gave them: ' + gl(st).tag);
ok(gl(st).place?.n === 1 && gl(st).place.of === 1, 'the pilot keeps their place on the all-time board (for the News): ' + JSON.stringify(gl(st).place));

// ------------------------------------------------------------------ which boards a sortie goes to
st.daily.lastDay = today;
ok(boardsFor(st, summary(1000)).length === 0, 'a sortie below the best posted goes nowhere');
ok(boardsFor(st, summary(1000, { daily: { bonus: 1, streak: 1 } })).join() === 'daily:' + today, 'a Daily always goes to its day');
ok(boardsFor(st, summary(99999, { daily: { bonus: 1, streak: 1 } })).join() === `daily:${today},all`, 'a Daily that is a best goes to both');
ok(boardsFor(st, summary(99999, { counter: { stage: 2 } })).length === 0, 'Counterattack runs are not on the boards');
ok(entryOf(summary(1234.6)).score === 1235 && !('mutator' in entryOf(summary(1))), 'an entry is tidy');

// ------------------------------------------------------------------ offline: it waits, and the newest best wins
down = true; const s1 = summary(60000);
await new Promise((r) => setTimeout(r, 3100)); // the server's gap between one pilot's posts
bus.emit('sortieEnded', s1); await flush(st);
ok(s1.global && gl(st).pending.length === 1 && posted.at(-1).why === 'offline' && posted.at(-1).item === s1.global, 'offline, the post waits and the debrief hears so');
const s2 = summary(70000); bus.emit('sortieEnded', s2); await flush(st);
ok(gl(st).pending.length === 1 && gl(st).pending[0].entry.score === 70000 && gl(st).best === 70000, 'a newer best replaces the one still waiting');
down = false; await flush(st);
ok(gl(st).pending.length === 0 && cachedBoard('all').data.me.score === 70000, 'back online, it goes up');

// ------------------------------------------------------------------ the Daily, and a refused post
await new Promise((r) => setTimeout(r, 3100));
const d = summary(30000, { daily: { bonus: 1, streak: 1 }, mutator: 'glass' }); bus.emit('sortieEnded', d); await flush(st);
ok(posted.at(-1).res?.boards?.['daily:' + today]?.me?.n === 1 && !gl(st).pending.length, "the Daily goes up on today's board");
const board = await fetchBoard(boardOf('today')); ok(board.top[0].name === 'Ace' && board.total === 1, "today's board can be fetched: " + JSON.stringify(board.top[0]));
await new Promise((r) => setTimeout(r, 3100));
queue(st, { ...entryOf(summary(9e9)), score: 9e9 }, ['all']); await flush(st);
ok(!gl(st).pending.length && /implausible/.test(posted.at(-1).why || ''), 'a post the boards refuse is dropped, not retried');

// ------------------------------------------------------------------ turning the boards off, and on again
const id = pilotId(st); setBoards(st, false); await flush(st);
ok(!gl(st).forget && gl(st).id === '' && !gl(st).tag && !db.prepare('SELECT COUNT(*) AS n FROM scores WHERE pid = ?').get(id).n, 'boards off takes the pilot off them');
bus.emit('sortieEnded', summary(80000)); ok(!gl(st).pending.length, 'with the boards off, nothing queues');
setBoards(st, true); await flush(st);
ok(gl(st).id && gl(st).id !== id && cachedBoard('all')?.data?.me?.score === 42000, 'on again, the pilot comes back (a new id) with their best record');

// ------------------------------------------------------------------ the pilot key: signing in on another device
const { formatKey, parseKey, lookupPilot, signIn } = await import('@last-orbit/progression/global.js');
const mine = gl(st).id, key = formatKey(mine);
ok(/^([0-9A-F]{4}-){7}[0-9A-F]{4}$/.test(key) && parseKey(key) === mine && parseKey(' ' + key.toLowerCase().replace(/-/g, ' ') + ' ') === mine && parseKey('1234') === '', 'the key reads in groups of four, and comes back however it is typed');
const other = newState(); other.pilot.name = 'Somebody'; other.stats.sorties = 4;
const who = await lookupPilot(parseKey(key));
ok(who.name === 'Ace' && who.best > 0, 'the key names its pilot: ' + JSON.stringify(who));
signIn(other, parseKey(key), who);
ok(gl(other).id === mine && gl(other).told && other.pilot.name === 'Ace' && gl(other).best === who.best && !gl(other).pending.length, 'signing in makes this device that pilot, with their callsign and best');
await lookupPilot('0'.repeat(32)).then(() => ok(false, 'an unknown key should not sign in'), (e) => ok(e.status === 404, 'an unknown key is refused'));

// ------------------------------------------------------------------ a callsign the boards will not show
const { shownInstead } = await import('@last-orbit/progression/global.js');
db.prepare("INSERT INTO reserved (nkey, pid) VALUES ('zetabun', ?)").run('f'.repeat(32));
const third = newState(); third.pilot.name = 'Zetabun'; third.records.top = [{ score: 30000, wave: 20, ship: 'vanguard', level: 14, kills: 300, threat: 0, daily: false, warp: 1, date: Date.now() - 864e5 }];
ok(!shownInstead(third), 'nothing to say before anything has gone up');
tell(third); await flush(third);
ok(gl(third).shownAs === 'Pilot' && shownInstead(third) === 'Pilot', 'a reserved callsign: the pilot is told the boards show them as Pilot: ' + gl(third).shownAs);
third.pilot.name = 'Zeta Two'; ok(!shownInstead(third), 'a new callsign: nothing to say until it has gone up');
ok(!shownInstead(st) && gl(st).shownAs === 'Ace', 'a callsign the boards show as it is: nothing to say');

if (failures) { console.error(`global-regression: ${failures} failed`); process.exit(1); }
console.log('global-regression: all passed');
