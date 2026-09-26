// The global boards' worker (api/src/index.js), run in Node against SQLite through a small stand-in for D1: posting,
// the Daily's one attempt, 'all' keeping the best, ranks outside the top, the plausibility check, names, bans,
// forgetting a pilot, the rate limit and CORS.
import worker, { plausible } from '../api/src/index.js';
import { d1 } from './d1-shim.mjs';

let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.error('FAIL', msg); } };
const { db, env } = d1();

const T0 = Date.parse('2026-09-26T12:00:00Z'); let clock = T0;
const later = (ms = 10000) => (clock += ms);
const ORIGIN = 'https://zetabun.github.io';
async function call(method, path, body, origin = ORIGIN) {
  const res = await worker.fetch(new Request('https://last-orbit-api.test' + path, { method, headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: body ? JSON.stringify(body) : undefined }), env, {}, clock);
  return { status: res.status, headers: res.headers, data: res.status === 204 ? null : await res.json() };
}
const pid = (n) => n.toString(16).padStart(32, '0');
const entry = (score, wave = 30, more = {}) => ({ score, wave, ship: 'vanguard', threat: 0, warp: 1, level: 20, kills: wave * 20, time: wave * 12, ...more });
const post = (p, name, e, boards = ['all'], extra = {}) => call('POST', '/score', { p, name, station: 'Haven', v: '2.22.0', entry: e, boards, ...extra });

// ------------------------------------------------------------------ posting to 'all'
let r = await post(pid(1), 'Ace', entry(50000));
ok(r.status === 200 && r.data.boards.all.kept && r.data.boards.all.total === 1 && r.data.boards.all.me?.n === 1, 'a first post lands at #1 of 1: ' + JSON.stringify(r.data));
ok(r.data.boards.all.top[0].name === 'Ace' && r.data.boards.all.top[0].station === 'Haven' && !('pid' in r.data.boards.all.top[0]), 'rows show the callsign and station, never the id');
r = await post(pid(1), 'Ace', entry(60000));
ok(r.status === 429, 'posting again within seconds is refused: ' + r.status);
later(); r = await post(pid(1), 'Ace', entry(40000));
ok(r.data.boards.all.kept === false && r.data.boards.all.me.score === 50000, "'all' keeps the best, not the latest");
later(); r = await post(pid(1), 'Ace', entry(55000));
ok(r.data.boards.all.kept === true && r.data.boards.all.me.score === 55000 && r.data.boards.all.total === 1, 'a better score replaces the old one, and the pilot is still counted once');

// ------------------------------------------------------------------ ranks beyond the top
for (let i = 2; i <= 60; i++) { later(); await post(pid(i), 'Pilot' + i, entry(60000 + i * 100)); }
later(); r = await call('GET', `/board?b=all&p=${pid(1)}`);
ok(r.data.total === 60 && r.data.top.length === 50 && r.data.me?.n === 60 && r.data.me.me === 1, 'a pilot outside the top 50 still sees their rank: ' + JSON.stringify(r.data.me));
ok(r.data.top[0].score === 66000 && r.data.top[49].score > r.data.top[49 + 0].score - 1, 'the top is ordered by score');
r = await call('GET', '/board?b=all');
ok(r.data.me === null && r.data.top.length === 50, 'without an id the board is just the top');

// ------------------------------------------------------------------ the Daily: one attempt, first post stands
const today = 'daily:2026-09-26';
later(); r = await post(pid(1), 'Ace', entry(20000, 18), [today, 'all']);
ok(r.data.boards[today].kept && r.data.boards[today].total === 1 && r.data.boards.all.kept === false, 'a Daily post lands on the day, and on all only if it is a best');
later(); r = await post(pid(1), 'Ace', entry(90000, 40), [today]);
ok(r.data.boards[today].kept === false && r.data.boards[today].me.score === 20000, "the Daily's first attempt stands");
later(); r = await post(pid(2), 'Two', entry(30000, 20), ['daily:2026-09-25']);
ok(r.status === 200, 'yesterday (UTC) is still today somewhere: accepted');
later(); r = await post(pid(2), 'Two', entry(30000, 20), ['daily:2026-09-22']);
ok(r.status === 400 && r.data.error === 'stale', 'a Daily days old is refused as stale: ' + JSON.stringify(r.data));
later(); r = await post(pid(3), 'Three', entry(30000, 20, { threat: 2 }), [today]);
ok(r.status === 422, 'a Daily flown at Threat cannot be real');
r = await call('GET', '/board?b=daily:2026-09-10');
ok(r.status === 400, 'boards more than a week old are not served');

// ------------------------------------------------------------------ plausibility
ok(plausible(entry(219416, 60, { kills: 1596, time: 584 })) === '', 'a strong bot run (wave 60) passes');
ok(plausible(entry(9e9, 30)) === 'score', 'an absurd score is caught');
ok(plausible(entry(50000, 30, { time: 20 })) === 'time', 'thirty waves in twenty seconds is caught');
ok(plausible(entry(50000, 30, { kills: 99999 })) === 'kills', 'too many kills is caught');
ok(plausible(entry(50000, 30, { time: undefined })) === '', 'an old record without a time is allowed (a best kept from before the boards)');
ok(plausible(entry(90000, 30, { threat: 10 })) === '' && plausible(entry(4 * 70000, 30)) === 'score', 'Threat raises the ceiling');
ok(plausible({ ...entry(5000, 10), ship: 'DROP TABLE' }) === 'ship', 'a ship id must look like one');
later(); r = await post(pid(4), 'Cheat', entry(9e9, 30));
ok(r.status === 422 && /implausible/.test(r.data.error), 'the worker refuses an implausible post');

// ------------------------------------------------------------------ names
later(); r = await post(pid(0xabcd5), 'sh1t head', entry(1000, 3));
ok(r.data.name === 'Pilot' && r.data.boards.all.me.name === 'Pilot', 'a rude callsign shows as Pilot: ' + r.data.name);
later(); r = await post(pid(6), 'Cockpit Kid', entry(1000, 3));
ok(r.data.name === 'Cockpit Kid', 'ordinary words that contain a rude one are fine');
later(); r = await post(pid(7), '  <b>Zed</b>!! ', entry(1000, 3));
ok(r.data.name === 'bZedb', 'names are tidied like a callsign: ' + r.data.name);
later(); r = await post(pid(8), '', entry(1000, 3));
ok(r.data.name === 'Pilot', 'no callsign shows as Pilot');
db.prepare("UPDATE players SET name = 'Pilot', nkey = 'pilot', station = '', locked = 1 WHERE pid = ?").run(pid(6));
later(); r = await post(pid(6), 'Cockpit Kid', entry(1200, 3));
ok(r.data.name === 'Pilot', "a moderator's rename stays");

// ------------------------------------------------------------------ tags: told apart when names clash, never shared
const TAG = /^[2-9A-HJKMNP-Z]{4}$/;
ok(TAG.test(r.data.tag || ''), 'every pilot is given a tag: ' + r.data.tag);
const ace = (await call('GET', `/board?b=all&p=${pid(1)}`)).data.me;
ok(!('tag' in ace), 'a pilot whose name is theirs alone on the board shows no tag');
later(); await post(pid(70), 'ACE', entry(64500));
r = { data: { boards: { all: (await call('GET', `/board?b=all&p=${pid(1)}`)).data } } }; /* the first Ace's view: the new ACE in the top, them pinned under it */
const seen = [...new Set([...r.data.boards.all.top, r.data.boards.all.me].filter(Boolean))], aces = seen.filter((x) => x.name.toLowerCase() === 'ace');
ok(aces.length >= 2 && aces.every((x) => TAG.test(x.tag || '')) && new Set(aces.map((x) => x.tag)).size === aces.length, 'two pilots called Ace on a board both show their (different) tags: ' + JSON.stringify(aces.map((x) => x.name + '#' + x.tag)));
ok(r.data.boards.all.top.filter((x) => x.name.toLowerCase() !== 'ace' && x.name !== 'Pilot').every((x) => !('tag' in x)), 'nobody else shows a tag');
const aceTag = db.prepare('SELECT tag FROM players WHERE pid = ?').get(pid(1)).tag;
db.prepare('UPDATE players SET tag = ? WHERE pid = ?').run(aceTag, pid(71)); /* no row yet: make one holding Ace's tag under another name */
later(); await post(pid(71), 'Bob', entry(900, 3)); db.prepare('UPDATE players SET tag = ? WHERE pid = ?').run(aceTag, pid(71));
later(); r = await post(pid(71), 'Ace', entry(950, 3));
ok(r.data.tag && r.data.tag !== aceTag, 'taking a name moves the pilot off a tag someone with that name already has: ' + aceTag + ' → ' + r.data.tag);
later(); r = await post(pid(71), 'Ace', entry(960, 3));
const kept = db.prepare('SELECT tag FROM players WHERE pid = ?').get(pid(71)).tag;
ok(r.data.tag === kept, 'a pilot keeps their tag while their name stays the same');
const clash = db.prepare("SELECT nkey, tag, COUNT(*) AS n FROM players GROUP BY nkey, tag HAVING n > 1").all();
ok(!clash.length, 'no two pilots share a name and a tag: ' + JSON.stringify(clash));

// ------------------------------------------------------------------ bans and forgetting
db.prepare('UPDATE players SET banned = 1 WHERE pid = ?').run(pid(9));
later(); const before = (await call('GET', '/board?b=all')).data.total; r = await post(pid(9), 'Banned', entry(64000));
ok(r.status === 200 && !r.data.boards.all.kept && r.data.boards.all.total === before, "a banned pilot's post is dropped quietly");
later(); r = await call('POST', '/forget', { p: pid(2) });
const after = (await call('GET', `/board?b=all&p=${pid(2)}`)).data;
ok(r.status === 200 && after.me === null && after.total === before - 1 && !after.top.some((x) => x.name === 'Two'), 'forgetting a pilot takes them off every board and out of the counts');

// ------------------------------------------------------------------ requests
r = await call('OPTIONS', '/score');
ok(r.status === 204 && r.headers.get('Access-Control-Allow-Origin') === ORIGIN, 'the game site is allowed');
r = await call('GET', '/board?b=all', null, 'https://example.com');
ok(!r.headers.get('Access-Control-Allow-Origin'), 'other sites are not');
r = await call('GET', '/board?b=all', null, 'http://127.0.0.1:8123');
ok(r.headers.get('Access-Control-Allow-Origin') === 'http://127.0.0.1:8123', 'a local copy of the game is allowed (testing)');
r = await call('POST', '/score', null); ok(r.status === 400, 'an empty post is refused');
r = await call('GET', '/nowhere'); ok(r.status === 404, 'unknown paths are 404');
r = await call('POST', '/score', { p: 'nope', entry: entry(1), boards: ['all'] }); ok(r.status === 400 && r.data.error === 'bad id', 'ids are checked');
const played = db.prepare('SELECT COUNT(*) AS n FROM days WHERE day = ?').get('2026-09-26').n;
ok(played >= 60, 'the day counts who used the boards: ' + played);

if (failures) { console.error(`api-regression: ${failures} failed`); process.exit(1); }
console.log('api-regression: all passed');
