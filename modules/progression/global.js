// The global boards from the game's side (the server is api/src/index.js; data/global.js says where it is).
// Posting: when a sortie ends, a Daily goes up to its day's board and a new best to 'all'. Each post waits in the save
// until it lands, so one made offline goes up later (flush(), tried again from the hangar). Nothing is posted until
// the pilot has been told (tell(), when Records is open), with Settings' "Global boards" off, or from a sandbox save.
// The game never waits on any of this: a board that cannot be reached just says so.
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { API, BOARD_TTL, TIMEOUT, POST_GAP, PENDING_MAX, dailyBoard } from '@last-orbit/data/global.js';
import { dayKey, prevDayKey } from '@last-orbit/data/daily.js';

const VERSION = (import.meta.url.split('?v=')[1] || '').split('&')[0]; // this build (the import map's version)
/** How the game reaches the server. Tests swap in their own fetch; in Node nothing is sent unless they do. */
export const net = { fetch: typeof window !== 'undefined' && typeof fetch === 'function' ? (...a) => fetch(...a) : null, base: API, local: false };
// A local copy of the game can be pointed at `wrangler dev` (?api=http://127.0.0.1:8787); the live site cannot be.
if (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) { const q = new URLSearchParams(location.search).get('api'); if (q) { net.base = q.replace(/\/+$/, ''); net.local = true; } }

/** The save's part: this device's id (made on the first post), whether the pilot has been told, the best score
 *  posted to 'all', posts still waiting, a request to be taken off the boards that has not reached them yet, and the
 *  tag and name the boards last gave them (tag: shown beside their name when another pilot has the same one). */
export function gl(st = G.state) {
  const g = (st.global ||= {}); g.id ??= ''; g.told ??= false; g.best ??= 0; g.pending ||= []; g.forget ??= false; return g;
}
/** A sandbox (debug) save never posts, except to a local test server (net.local). */
export const boardsOn = (st = G.state) => st.settings.globalBoards !== false && (!st.meta.sandbox || net.local);
export const posting = (st = G.state) => boardsOn(st) && gl(st).told;
function newId() {
  const b = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = (Math.random() * 256) | 0;
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export const pilotId = (st = G.state) => (gl(st).id ||= newId());
/** The name the boards show for this pilot: their callsign, or Pilot without one. */
export const boardName = (st = G.state) => st.pilot?.name || 'Pilot';
// ------------------------------------------------------------------ the pilot key: signing in elsewhere
// The key is this device's id, shown in groups of four. Entered on another device (or after a fresh save), that
// device becomes the same pilot on the boards: name, tag, badge, role and scores. Its own save is untouched.
export const formatKey = (id) => (id || '').toUpperCase().match(/.{1,4}/g)?.join('-') || '';
/** A typed or pasted key as an id (32 hex characters, any spacing or dashes), or '' if it is not one. */
export function parseKey(text) { const hex = String(text || '').toLowerCase().replace(/[^0-9a-f]/g, ''); return /^[0-9a-f]{32}$/.test(hex) ? hex : ''; }
/** Whose key it is: { name, tag, station, rank, role, best }, or rejects ('unknown' when no pilot has it). */
export const lookupPilot = (id) => send('/pilot?p=' + id);
/** Become that pilot on this device. Scores already posted from here stay with the old id. */
export function signIn(st, id, who = {}) {
  const g = gl(st); Object.assign(g, { id, told: true, best: who.best || 0, pending: [], forget: false, tag: who.tag || '', shownAs: who.name || '' });
  st.settings.globalBoards = true; if (who.name && who.name !== 'Pilot') { st.pilot.name = who.name; st.seen.callsign = true; }
  cache.clear(); bus.emit('globalSignedIn', who); return g;
}

/** A board to look at: 'today' and 'yday' are the Daily Sortie's (by this device's calendar, like the Daily itself). */
export const boardOf = (tab, now = new Date()) => (tab === 'all' ? 'all' : dailyBoard(tab === 'yday' ? prevDayKey(dayKey(now)) : dayKey(now)));

// ------------------------------------------------------------------ what gets posted
/** The boards a finished sortie goes to: its day's Daily, and 'all' when it beats the best already posted there. */
export function boardsFor(st, s) {
  if (!s || s.counter || !(s.score > 0)) return [];
  const out = []; if (s.daily && st.daily?.lastDay) out.push(dailyBoard(st.daily.lastDay)); if (s.score > gl(st).best) out.push('all');
  return out;
}
export const entryOf = (s) => ({ score: Math.round(s.score), wave: s.wave, ship: s.ship, threat: s.threat || 0, warp: s.warp || 1, level: s.level || 1, kills: s.kills || 0, ...(s.time != null ? { time: Math.round(s.time) } : {}), ...(s.mutator ? { mutator: s.mutator } : {}) });
/** Queue a post. A new best for 'all' replaces one still waiting (only the best matters there). */
export function queue(st, entry, boards, at = Date.now()) {
  const g = gl(st);
  if (boards.includes('all')) { for (const p of g.pending) p.boards = p.boards.filter((b) => b !== 'all'); g.best = Math.max(g.best, entry.score); }
  g.pending = g.pending.filter((p) => p.boards.length);
  const item = { at, entry, boards: [...boards] }; g.pending.push(item);
  if (g.pending.length > PENDING_MAX) g.pending.splice(0, g.pending.length - PENDING_MAX);
  return item;
}
/** The pilot's best sortie before the boards, so they are on the all-time board from their first post. */
function queueBest(st) {
  const top = st.records?.top?.[0]; if (!(top?.score > gl(st).best)) return null;
  return queue(st, { score: Math.round(top.score), wave: top.wave || 1, ship: top.ship || st.ship, threat: top.threat || 0, warp: top.warp || 1, level: top.level || 1, kills: top.kills || 0 }, ['all'], top.date || Date.now());
}
/** The first time the boards apply to this pilot: they are told (the caller shows how), and their best goes up. */
export function tell(st = G.state) { const g = gl(st); if (g.told || !boardsOn(st)) return false; g.told = true; queueBest(st); return true; }
/** Settings: boards off takes the pilot off them (now, or when the server can next be reached); on again puts their
 *  best back up. */
export function setBoards(st, on) {
  const g = gl(st); st.settings.globalBoards = !!on; cache.clear();
  if (!on) { if (g.id) g.forget = true; g.pending = []; g.best = 0; } else if (g.told) { g.forget = false; queueBest(st); }
  flush(st);
}

// ------------------------------------------------------------------ talking to the server
async function send(path, body) {
  if (!net.fetch) throw Object.assign(new Error('offline'), { status: 0 });
  const ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = setTimeout(() => ctl?.abort(), TIMEOUT);
  try {
    let res;
    try { res = await net.fetch(net.base + path, body ? { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body), signal: ctl?.signal } : { signal: ctl?.signal }); } catch { throw Object.assign(new Error('offline'), { status: 0 }); }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(data?.error || 'http ' + res.status), { status: res.status });
    return data;
  } finally { clearTimeout(timer); }
}
/** Whether a failed post is worth trying again later (no connection, the server busy or over its day's requests). */
const retryable = (e) => !e.status || e.status === 429 || e.status >= 500;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let flushing = null;
/** Send what is waiting, oldest first. Each post emits 'globalPosted' (item, result) or (item, null, why); one that
 *  cannot go now stays for the next try. Returns the promise of the round (or null when there is nothing to do). */
export function flush(st = G.state) {
  const g = gl(st); if (flushing || !net.fetch || (!g.forget && (!posting(st) || !g.pending.length))) return flushing;
  flushing = (async () => {
    if (g.forget) {
      try { await send('/forget', { p: g.id }); g.forget = false; g.id = ''; g.tag = ''; } catch (e) { if (retryable(e)) return; g.forget = false; }
      if (!posting(st)) return;
    }
    let sent = 0;
    while (g.pending.length && posting(st)) {
      const item = g.pending[0]; if (sent++) await wait(POST_GAP);
      try {
        const res = await send('/score', { p: pilotId(st), name: st.pilot?.name || '', station: st.stationName || '', rank: st.pilot?.rank || 0, v: VERSION, entry: item.entry, boards: item.boards });
        g.pending.shift(); g.shownAs = res.name; if (res.tag) g.tag = res.tag; for (const [b, v] of Object.entries(res.boards || {})) cache.set(b, { at: Date.now(), data: v });
        bus.emit('globalPosted', item, res);
      } catch (e) {
        bus.emit('globalPosted', item, null, retryable(e) ? 'offline' : e.message);
        if (retryable(e)) { for (const it of g.pending.slice(1)) bus.emit('globalPosted', it, null, 'offline'); break; } /* the rest wait too */
        g.pending.shift(); // refused (too old, or not believed): dropped
      }
    }
  })().finally(() => { flushing = null; });
  return flushing;
}

// ------------------------------------------------------------------ reading boards
const cache = new Map(), loading = new Map();
/** A board as last fetched ({ data, at } or undefined), however old. */
export const cachedBoard = (id) => cache.get(id);
export const boardFresh = (id) => { const c = cache.get(id); return !!c && Date.now() - c.at < BOARD_TTL; };
/** Fetch a board (the top 50, how many are on it, and where this pilot stands). Resolves to its data, or rejects. */
export function fetchBoard(id, st = G.state) {
  if (loading.has(id)) return loading.get(id);
  const p = send(`/board?b=${encodeURIComponent(id)}` + (posting(st) && gl(st).id ? `&p=${gl(st).id}&r=${st.pilot?.rank || 0}` : '')) /* the rank keeps this pilot's badge current */
    .then((data) => { cache.set(id, { at: Date.now(), data }); return data; })
    .finally(() => loading.delete(id));
  loading.set(id, p); return p;
}

// A sortie's result goes up as soon as it ends (the debrief shows where it landed: ui/overlays.js).
bus.on('sortieEnded', (s) => {
  const st = G.state; if (!s || !posting(st)) return;
  const boards = boardsFor(st, s); if (!boards.length) return;
  s.global = queue(st, entryOf(s), boards); flush(st);
});
