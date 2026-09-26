// Flight recorder: while a sortie runs it notes where everything is, ten times a second, for the replay TV aboard the
// station (rendering/replay.js). The field is only 100 × 150, so a position packs into a byte or two. It keeps the last
// KEEP seconds (the ending is the story: the boss, or how it went wrong), and when the sortie ends it is packed,
// compressed and stored in a slot of its own, apart from the save. Read-only: it never changes the fight.
// The replay TV has channels, each kept in a slot of its own: the last sortie; your best run (the furthest wave, kept
// until you beat it); the last boss you beat (the minute before the kill and a few seconds of the wreck); and your
// last Daily Sortie.
// Counterattack is not recorded: its walls, city and scrolling set pieces are not part of what is noted.
import { bus } from '@last-orbit/core/events.js';
import { G } from '@last-orbit/core/game.js';
import { putBlob, getBlob } from '@last-orbit/save/save.js';

export const HZ = 10, KEEP = 90;
const MAX_E = 90, MAX_S = 70, MAX_B = 110, MAGIC = 0x4c4f5231; // 'LOR1'
const SLOTS = { last: 'v2_replay', best: 'v2_replay_best', boss: 'v2_replay_boss', daily: 'v2_replay_daily' }, BOSS_BEFORE = 60, BOSS_AFTER = 4;
/** The TV's channels: what each is, and how to fill it while it is empty. */
export const CHANNELS = [{ id: 'last', name: 'Last', how: 'Fly a sortie' }, { id: 'best', name: 'Best', how: 'Fly a sortie' }, { id: 'boss', name: 'Boss', how: 'Beat a sector boss' }, { id: 'daily', name: 'Daily', how: 'Fly the Daily Sortie' }];
// packing: x -60..60 and y -10..170 into a byte each, speeds in steps of 1.5 into a signed byte
const qx = (x) => Math.max(0, Math.min(255, Math.round((x + 60) * 2.125))), qy = (y) => Math.max(0, Math.min(255, Math.round((y + 10) * 1.4167)));
const qv = (v) => Math.max(-127, Math.min(127, Math.round(v / 1.5))) & 255;
export const unpack = { x: (b) => b / 2.125 - 60, y: (b) => b / 1.4167 - 10, v: (b) => (b > 127 ? b - 256 : b) * 1.5 };
const BULLET = { heavy: 1, orb: 2, snipe: 3 }; // anything else is a plain bolt (0)

let rec = null, kills = [], loading = null, stamp = 0, bossAt = null, bossName = '';
const kept = {}; // channel → its replay
const index = (list, key) => { let i = list.indexOf(key); if (i < 0) { i = list.length; list.push(key); } return i; };

/** Start a new recording. meta: what the replay TV shows beside the fight (ship, mode). */
export function recStart(meta = {}) { rec = meta.mode === 'counter' ? null : { meta, shapes: [], colors: [], frames: [], acc: 1 / HZ, t: 0 }; kills = []; bossAt = null; }
/** Call as the fight advances (dt: game seconds); takes a frame every 1/HZ seconds, keeping the last KEEP seconds. */
export function recTick(w, dt) {
  if (!rec || !w || !G.state.run) return; rec.t += dt; rec.acc += dt; if (rec.acc < 1 / HZ) return; rec.acc %= 1 / HZ;
  const run = G.state.run, p = w.player, es = [];
  if (!rec.meta.tier) rec.meta.sector = 'Sector ' + ((w.base.sectorIdx || 0) + 1);
  for (const e of w.enemies) if (e.alive && e.y < 175 && es.length < MAX_E) es.push(e);
  // enemies: id, shape, colour, x, y, size, flags (1 boss, 2 elite, 4 cloaked, 8 just hit)
  const E = new Uint8Array(es.length * 7);
  es.forEach((e, i) => { const o = i * 7; E[o] = e.id & 255; E[o + 1] = index(rec.shapes, e.def.shape || 'scout'); E[o + 2] = index(rec.colors, e.elite?.color ?? e.color ?? e.def.color ?? 0xffffff); E[o + 3] = qx(e.x); E[o + 4] = qy(e.y); E[o + 5] = Math.min(255, Math.round(e.r * 8));
    E[o + 6] = (e.boss ? 1 : 0) | (e.elite ? 2 : 0) | (e.cloaked ? 4 : 0) | (e.flash > 0 ? 8 : 0); });
  const pack = (list, max, kindOf) => { const n = Math.min(max, list.length), A = new Uint8Array(n * 5); let k = 0;
    for (const s of list) { if (k >= n) break; if (!s.alive) continue; const o = k * 5; A[o] = qx(s.x); A[o + 1] = qy(s.y); A[o + 2] = qv(s.vx); A[o + 3] = qv(s.vy); A[o + 4] = kindOf(s); k++; }
    return A.subarray(0, k * 5); };
  const S = pack(w.shots, MAX_S, (s) => index(rec.colors, s.c?.color ?? 0x5ee6ff)), B = pack(w.ebullets, MAX_B, (b) => BULLET[b.kind] || 0);
  rec.frames.push({ t: rec.t, wave: w.wave.num, score: Math.round(run.score || 0), hull: p.hull, shield: p.shield, alive: p.alive, px: p.x, py: p.y, tilt: p.tilt || 0, level: run.level || 1, E, S, B, K: kills.slice(0, 255) });
  if (rec.frames.length > HZ * KEEP) rec.frames.shift(); kills = [];
  if (bossAt != null && rec.t >= bossAt + BOSS_AFTER) { keepBoss(); bossAt = null; }
}
/** A boss down: in a few seconds (once it has blown up) the minute before the kill becomes the Boss channel. */
bus.on('bossDied', (w, e) => { if (!rec || e.boss?.def?.mini || rec.meta.mode === 'counter') return; bossAt = rec.t; bossName = e.boss?.def?.name || 'Boss'; });
function keepBoss() {
  const from = bossAt - BOSS_BEFORE, frames = rec.frames.filter((f) => f.t >= from); if (frames.length < HZ * 3) return;
  const r = { kind: 'boss', meta: { ...rec.meta, boss: bossName }, shapes: rec.shapes.slice(), colors: rec.colors.slice(), frames, end: { reason: 'boss', boss: bossName, wave: frames[frames.length - 1].wave }, secs: rec.t, stamp: ++stamp };
  kept.boss = r; storeReplay('boss', r);
}
/** Stop, keep it as the last replay, and store it. end: how the sortie ended ({ reason, wave }). */
export function recStop(end) {
  if (!rec) return kept.last || null; if (bossAt != null) { keepBoss(); bossAt = null; } const r = rec; rec = null; if (r.frames.length < HZ * 3) return kept.last || null; // a few seconds is not worth a replay
  const rep = { kind: 'last', meta: r.meta, shapes: r.shapes, colors: r.colors, frames: r.frames, end, secs: r.t, stamp: ++stamp }; kept.last = rep; storeReplay('last', rep);
  if (r.meta.daily) { kept.daily = { ...rep, kind: 'daily', stamp: ++stamp }; storeReplay('daily', kept.daily); }
  // the best run: kept until a sortie gets further (the stored one is looked at first, if it is not loaded yet)
  if (r.meta.mode === 'main' || !r.meta.mode) loadSlot('best').then((b) => { if (!b || (end.wave || 0) >= (b.end?.wave || 0)) { kept.best = { ...rep, kind: 'best', stamp: ++stamp }; storeReplay('best', kept.best); } });
  return rep;
}
export const lastReplay = () => kept.last || null;
/** A channel's replay (null if it has none yet, or it has not loaded). */
export const replayOf = (id) => kept[id] || null;
/** One channel's stored replay, loaded once. */
const slotLoads = {};
function loadSlot(id) { return (slotLoads[id] ||= getBlob(SLOTS[id]).then((buf) => buf ? unpackReplay(buf) : null).then((r) => { if (r && !kept[id]) { r.kind = id; r.stamp = ++stamp; kept[id] = r; } return kept[id] || null; }).catch(() => kept[id] || null)); }
/** Every channel's stored replay, loaded the first time they are wanted (only aboard the station). Resolves to the last. */
export function loadReplay() { return (loading ||= Promise.all(CHANNELS.map((c) => loadSlot(c.id))).then(() => kept.last || null)); }

// ---------------------------------------------------------------- storage: packed bytes, deflated where the browser can
const deflate = async (bytes, how) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new (how ? CompressionStream : DecompressionStream)('deflate-raw'))).arrayBuffer());
async function storeReplay(id, r) { try { let b = packReplay(r); if (typeof CompressionStream !== 'undefined') b = await deflate(b, true); await putBlob(SLOTS[id], b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); } catch { /* a replay is a nicety: never let it break a sortie's end */ } }
export async function unpackReplay(buf) {
  let b = new Uint8Array(buf); if (new DataView(b.buffer, b.byteOffset).getUint32(0) !== MAGIC) b = await deflate(b, false);
  return readReplay(b);
}
/** Frames as bytes: a header (the meta, shapes and colours as JSON) and then each frame in turn. */
export function packReplay(r) {
  const head = new TextEncoder().encode(JSON.stringify({ meta: r.meta, shapes: r.shapes, colors: r.colors, end: r.end, secs: r.secs })), F = r.frames;
  let size = 12 + head.length; for (const f of F) size += 38 + f.E.length + f.S.length + f.B.length + f.K.length * 4;
  const out = new Uint8Array(size), d = new DataView(out.buffer); let o = 0;
  d.setUint32(o, MAGIC); d.setUint32(o + 4, head.length); out.set(head, o + 8); o += 8 + head.length; d.setUint32(o, F.length); o += 4;
  for (const f of F) {
    d.setFloat32(o, f.t); d.setUint16(o + 4, f.wave); d.setFloat64(o + 6, f.score); d.setUint8(o + 14, Math.round(Math.max(0, Math.min(1, f.hull)) * 255)); d.setUint8(o + 15, Math.round(Math.max(0, Math.min(1, f.shield)) * 255));
    d.setUint8(o + 16, f.alive ? 1 : 0); d.setFloat32(o + 17, f.px); d.setFloat32(o + 21, f.py); d.setFloat32(o + 25, f.tilt); d.setUint16(o + 29, f.level); o += 31;
    for (const A of [f.E, f.S, f.B]) { d.setUint16(o, A.length); out.set(A, o + 2); o += 2 + A.length; }
    d.setUint8(o, f.K.length); o += 1; for (const k of f.K) { out.set(k, o); o += 4; }
  }
  return out.subarray(0, o);
}
function readReplay(b) {
  const d = new DataView(b.buffer, b.byteOffset, b.byteLength); let o = 0; if (d.getUint32(0) !== MAGIC) throw new Error('Not a replay');
  const hl = d.getUint32(4), head = JSON.parse(new TextDecoder().decode(b.subarray(8, 8 + hl))); o = 8 + hl; const n = d.getUint32(o); o += 4; const frames = [];
  for (let i = 0; i < n; i++) {
    const f = { t: d.getFloat32(o), wave: d.getUint16(o + 4), score: d.getFloat64(o + 6), hull: d.getUint8(o + 14) / 255, shield: d.getUint8(o + 15) / 255, alive: !!d.getUint8(o + 16), px: d.getFloat32(o + 17), py: d.getFloat32(o + 21), tilt: d.getFloat32(o + 25), level: d.getUint16(o + 29) }; o += 31;
    for (const k of ['E', 'S', 'B']) { const len = d.getUint16(o); f[k] = b.slice(o + 2, o + 2 + len); o += 2 + len; }
    const nk = d.getUint8(o); o += 1; f.K = []; for (let j = 0; j < nk; j++) { f.K.push([b[o], b[o + 1], b[o + 2], b[o + 3]]); o += 4; }
    frames.push(f);
  }
  return { ...head, frames };
}
/** Size of a replay packed for storage, in bytes (before compression). */
export const replayBytes = (r) => r ? packReplay(r).length : 0;
bus.on('kill', (w, e) => { if (rec) kills.push([qx(e.x), qy(e.y), index(rec.colors, e.color ?? e.def?.color ?? 0xffffff), e.boss ? 2 : e.elite ? 1 : 0]); });
