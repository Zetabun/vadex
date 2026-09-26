// Last Orbit's global boards: a Cloudflare Worker (`last-orbit-api`, api/wrangler.toml) over a D1 database
// (api/schema.sql). It is deployed on its own, apart from the game's GitHub Pages site, and the game never depends on
// it: when it is down, or the free plan's daily requests run out, the boards go quiet and the game carries on
// (modules/progression/global.js).
//   Boards: 'all' holds every pilot's best sortie score; 'daily:YYYY-MM-DD' holds that day's Daily Sortie, where each
//   pilot has one attempt, so the first score posted stands.
//   Pilots are a random id made on the device (never shown to anyone) with the callsign and station name they chose,
//   their pilot rank (shown as their badge; written with every post and refreshed whenever they look at a board),
//   a role shown beside their name (DEV: set only with api/admin.mjs, never by the game),
//   and a four-character tag the server gives them. No two pilots share a name and a tag, and where two on a board
//   share a name the board shows their tags (Ace #4F2A, Ace #91CX), so a copied callsign cannot pass as the original.
//   The server hands tags out (checking each name change) because a tag worked out on the device could be matched by
//   making new ids until one fitted.
//   Scores are checked against the wave reached (plausible()); the boards are moderated from the command line
//   (api/admin.mjs).
// Routes: GET /board?b=<board>&p=<id> · POST /score · POST /forget. POSTs take JSON sent as text/plain, which keeps
// them "simple" requests with no CORS preflight: one request each against the daily allowance, not two.

const TOP = 50;
const NAME_MAX = 16, STATION_MAX = 20;
const PID = /^[0-9a-f]{32}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SHIP = /^[a-z]{2,16}$/;
const VER = /^[\w.-]{1,24}$/;
const ORIGINS = [/^https:\/\/zetabun\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const RATE_MS = 3000; // a pilot posts at most once every few seconds
const WAVES_PER_SECTOR = 10;

// Words a name may not contain (ROT13, so this file does not read as a list of them). Letters only, after the usual
// digit swaps (0→o, 1→i, 3→e, 4→a, 5→s, 7→t). WITHIN: anywhere in the name; WHOLE: as a whole word only, as they
// sit inside ordinary words too (a cockpit, grapes).
const WITHIN = ['shpx', 'fuvg', 'phag', 'avtt', 'avttn', 'sntt', 'snttbg', 'ergneq', 'juber', 'fyhg', 'ovgpu', 'jnax', 'gjng', 'chffl', 'cravf', 'intvan', 'qvyqb', 'cbea', 'encvfg', 'uvgyre', 'anmv', 'xvxr', 'genaal', 'zbyrfg', 'crqb', 'cnrqb', 'obyybpx', 'onfgneq', 'nffubyr', 'nefrubyr'];
const WHOLE = ['snt', 'sntf', 'encr', 'encrq', 'pbpx', 'pbpxf', 'qvpx', 'qvpxf', 'fcvp', 'cnxv', 'pbba', 'gvgf', 'phz', 'wvmm', 'puvax', 'tbbx', 'jbc', 'qlxr', 'ubzb', 'abapr', 'cevpx', 'nefr', 'nff', 'frk', 'xxx'];
const rot13 = (s) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
const WITHIN_LIST = WITHIN.map(rot13), WHOLE_LIST = WHOLE.map(rot13);
const SWAP = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };
function rude(name) {
  const low = name.toLowerCase().replace(/[013457@$]/g, (c) => SWAP[c]);
  const joined = low.replace(/[^a-z]/g, ''), words = low.split(/[^a-z]+/).filter(Boolean);
  return WITHIN_LIST.some((w) => joined.includes(w)) || words.some((w) => WHOLE_LIST.includes(w));
}

/** The same tidying as the game's callsign (progression/meta.js cleanCallsign): letters, digits, spaces and . _ ' -. */
const tidy = (s, max) => [...String(s || '').replace(/[^\p{L}\p{N} ._'-]/gu, '').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();
const FALLBACK = 'Pilot'; // a pilot with no callsign (or a rude one); the tags tell them apart
const TAG_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L: easy to read out
function randomTag() { const b = new Uint8Array(4); crypto.getRandomValues(b); return [...b].map((x) => TAG_CHARS[x % TAG_CHARS.length]).join(''); }
/** A tag for a pilot under this name that no other pilot with the name has (their own, if it is still free). */
async function freeTag(env, nkey, pid, own) {
  for (let i = 0; i < 20; i++) {
    const t = i === 0 && own ? own : randomTag();
    if (!(await env.DB.prepare('SELECT 1 AS x FROM players WHERE nkey = ?1 AND tag = ?2 AND pid <> ?3').bind(nkey, t, pid).first())) return t;
  }
  throw fail('no tag', 503);
}

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
/** A pilot rank as posted (1 to 999), or 0 when there is none to trust. */
const pilotRank = (r) => { const n = Number(r); return Number.isInteger(n) && n >= 1 && n <= 999 ? n : 0; };
const today = (now) => new Date(now).toISOString().slice(0, 10);
const dayOffset = (key, now) => Math.round((Date.parse(key + 'T00:00:00Z') - Date.parse(today(now) + 'T00:00:00Z')) / 864e5);

/** A board id, checked: 'all', or a daily within a week (and, to post to, within a day of today in UTC: every time
 *  zone's today). */
function boardId(b, now, posting) {
  if (b === 'all') return b;
  const m = /^daily:(.+)$/.exec(b || ''); if (!m || !DAY.test(m[1])) throw fail('bad board');
  const off = dayOffset(m[1], now); if (Number.isNaN(off) || Math.abs(off) > (posting ? 1 : 7)) throw fail(posting ? 'stale' : 'bad board');
  return b;
}

// ------------------------------------------------------------------ plausibility
// Scores come from the player's device, so a determined cheat can post anything; this catches the impossible. Bots
// score 1.3 to 1.5 times base(wave) (tools calibrated this in v2.22), so 4 times it, with Threat and the Deep Void's
// anomalies on top, leaves any real pilot plenty of room.
const waveMul = (w) => 1 + 0.1 * (w - 1);
function base(W) { let s = 0; for (let w = 1; w <= W; w++) s += waveMul(w) * 100 + 75 * w; return s; }
export function plausible(e) {
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!int(e.wave, 1, 2000) || !int(e.score, 0, 1e12) || !int(e.threat, 0, 10) || !int(e.warp, 1, 20) || !int(e.level, 1, 999) || !int(e.kills, 0, 1e7)) return 'fields';
  if (!SHIP.test(e.ship || '')) return 'ship';
  const flown = Math.max(1, e.wave - (e.warp - 1) * WAVES_PER_SECTOR), voidPay = e.wave > 60 ? 1 + 0.25 * Math.ceil((e.wave - 60) / 10) : 1;
  if (e.score > 4 * base(e.wave) * (1 + 0.25 * e.threat) * voidPay) return 'score';
  if (e.kills > 80 * flown) return 'kills';
  if (e.time != null && (!int(e.time, 0, 1e7) || e.time < 3 * flown)) return 'time';
  return '';
}

// ------------------------------------------------------------------ reading boards
const ROLES = ['dev', 'mod']; // the roles a row can show (api/admin.mjs sets them)
const row = (r, rank) => ({ n: rank, name: r.name, tag: r.tag, ...(r.prank > 0 ? { rank: r.prank } : {}), ...(ROLES.includes(r.role) ? { role: r.role } : {}), ...(r.station ? { station: r.station } : {}), score: r.score, wave: r.wave, ship: r.ship, threat: r.threat, warp: r.warp, level: r.level, ...(r.me ? { me: 1 } : {}) });
/** Tags only where they are needed: on pilots who share a name with another on the board as shown. */
function tagClashes(rows) {
  const n = {}; for (const r of rows) { const k = r.name.toLowerCase(); n[k] = (n[k] || 0) + 1; }
  for (const r of rows) if (n[r.name.toLowerCase()] < 2 || !r.tag) delete r.tag;
}

/** A board: its top pilots, how many are on it, and where this pilot stands (when not in the top). */
async function view(env, board, pid) {
  const top = await env.DB.prepare(
    'SELECT s.score, s.wave, s.ship, s.threat, s.warp, s.level, s.at, p.name, p.station, p.tag, p.rank AS prank, p.role, s.pid = ?2 AS me FROM scores s JOIN players p ON p.pid = s.pid WHERE s.board = ?1 ORDER BY s.score DESC, s.at ASC LIMIT ?3',
  ).bind(board, pid || '', TOP).all();
  const rows = top.results.map((r, i) => row(r, i + 1));
  const total = (await env.DB.prepare('SELECT n FROM boards WHERE board = ?1').bind(board).first())?.n || 0;
  let me = rows.find((r) => r.me) || null;
  if (!me && pid) {
    const mine = await env.DB.prepare('SELECT s.score, s.wave, s.ship, s.threat, s.warp, s.level, s.at, p.name, p.station, p.tag, p.rank AS prank, p.role, 1 AS me FROM scores s JOIN players p ON p.pid = s.pid WHERE s.board = ?1 AND s.pid = ?2').bind(board, pid).first();
    if (mine) {
      const above = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE board = ?1 AND (score > ?2 OR (score = ?2 AND at < ?3))').bind(board, mine.score, mine.at).first();
      me = row(mine, (above?.n || 0) + 1);
    }
  }
  tagClashes(me && !rows.includes(me) ? [...rows, me] : rows);
  return { board, total, top: rows, me };
}

// ------------------------------------------------------------------ posting
/** A sortie's result, posted to one or two boards (the day's Daily, and 'all' when it is the pilot's best). */
async function post(env, body, now) {
  const pid = body.p; if (!PID.test(pid || '')) throw fail('bad id');
  const e = body.entry || {}, why = plausible(e); if (why) throw fail('implausible: ' + why, 422);
  const boards = [...new Set((Array.isArray(body.boards) ? body.boards : []).slice(0, 2).map((b) => boardId(b, now, true)))];
  if (!boards.length) throw fail('no board');
  if (boards.some((b) => b.startsWith('daily:')) && (e.warp !== 1 || e.threat !== 0)) throw fail('implausible: daily', 422);
  let name = tidy(body.name, NAME_MAX), station = tidy(body.station, STATION_MAX);
  if (!name || rude(name)) name = FALLBACK; if (station && rude(station)) station = '';
  const v = VER.test(body.v || '') ? body.v : '', prank = pilotRank(body.rank);
  const player = await env.DB.prepare('SELECT banned, locked, last, name, station, tag, nkey FROM players WHERE pid = ?1').bind(pid).first();
  if (player && now - player.last < RATE_MS) throw fail('too fast', 429);
  if (player?.locked) { name = player.name; station = player.station; } /* a name reset by a moderator stays reset */
  const nkey = name.toLowerCase(), tag = player?.tag && player.nkey === nkey ? player.tag : await freeTag(env, nkey, pid, player?.tag); /* a new name: is the tag still free under it? */
  const writes = [
    env.DB.prepare('INSERT INTO players (pid, name, station, first, last, posts, v, tag, nkey, rank) VALUES (?1, ?2, ?3, ?4, ?4, 1, ?5, ?6, ?7, ?8) ON CONFLICT(pid) DO UPDATE SET name = ?2, station = ?3, last = ?4, posts = posts + 1, v = ?5, tag = ?6, nkey = ?7, rank = CASE WHEN ?8 > 0 THEN ?8 ELSE rank END').bind(pid, name, station, now, v, tag, nkey, prank),
    env.DB.prepare('INSERT OR IGNORE INTO days (day, pid) VALUES (?1, ?2)').bind(today(now), pid),
  ];
  const kept = {};
  if (!player?.banned) for (const b of boards) { // a banned pilot's posts are taken and quietly dropped
    const had = await env.DB.prepare('SELECT score FROM scores WHERE board = ?1 AND pid = ?2').bind(b, pid).first();
    const vals = [b, pid, e.score, e.wave, e.ship, e.threat, e.warp, e.level, e.kills, e.time ?? null, typeof e.mutator === 'string' ? e.mutator.slice(0, 24) : null, now];
    if (!had) {
      writes.push(env.DB.prepare('INSERT INTO scores (board, pid, score, wave, ship, threat, warp, level, kills, time, mutator, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)').bind(...vals));
      writes.push(env.DB.prepare('INSERT INTO boards (board, n) VALUES (?1, 1) ON CONFLICT(board) DO UPDATE SET n = n + 1').bind(b));
      kept[b] = true;
    } else if (b === 'all' && e.score > had.score) { // the Daily keeps its first (and only) attempt
      writes.push(env.DB.prepare('UPDATE scores SET score = ?3, wave = ?4, ship = ?5, threat = ?6, warp = ?7, level = ?8, kills = ?9, time = ?10, mutator = ?11, at = ?12 WHERE board = ?1 AND pid = ?2').bind(...vals));
      kept[b] = true;
    } else kept[b] = false;
  }
  await env.DB.batch(writes);
  const out = {};
  for (const b of boards) out[b] = { ...(await view(env, b, pid)), kept: !!kept[b] };
  return { ok: true, name, tag, boards: out };
}

/** A pilot who turns the boards off is taken off them. */
async function forget(env, body) {
  const pid = body.p; if (!PID.test(pid || '')) throw fail('bad id');
  await env.DB.batch([
    env.DB.prepare('UPDATE boards SET n = n - 1 WHERE board IN (SELECT board FROM scores WHERE pid = ?1)').bind(pid),
    env.DB.prepare('DELETE FROM scores WHERE pid = ?1').bind(pid),
    env.DB.prepare('DELETE FROM players WHERE pid = ?1 AND banned = 0').bind(pid),
  ]);
  return { ok: true };
}

// ------------------------------------------------------------------ the worker
function cors(origin) {
  const h = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (ORIGINS.some((re) => re.test(origin || ''))) Object.assign(h, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' });
  return h;
}
async function readBody(req) {
  const text = await req.text(); if (text.length > 4096) throw fail('too big', 413);
  try { return JSON.parse(text); } catch { throw fail('bad json'); }
}

export default {
  async fetch(req, env, ctx, now = Date.now()) {
    const headers = cors(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const send = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
    try {
      const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '') || '/';
      if (path === '/' && req.method === 'GET') return send({ ok: true, name: 'last-orbit-api' });
      if (path === '/board' && req.method === 'GET') {
        const b = boardId(url.searchParams.get('b'), now, false), p = url.searchParams.get('p') || '';
        const pid = PID.test(p) ? p : '';
        if (pid) await env.DB.prepare('INSERT OR IGNORE INTO days (day, pid) VALUES (?1, ?2)').bind(today(now), pid).run();
        const r = pilotRank(url.searchParams.get('r')); if (pid && r) await env.DB.prepare('UPDATE players SET rank = ?2 WHERE pid = ?1 AND rank <> ?2').bind(pid, r).run(); /* a rank up shows before the next post */
        return send(await view(env, b, pid));
      }
      if (path === '/score' && req.method === 'POST') return send(await post(env, await readBody(req), now));
      if (path === '/forget' && req.method === 'POST') return send(await forget(env, await readBody(req)));
      return send({ error: 'not found' }, 404);
    } catch (err) {
      return send({ error: err.status ? err.message : 'server' }, err.status || 500);
    }
  },
};
