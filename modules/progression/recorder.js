// Flight recorder: while a sortie runs it notes where everything is, ten times a second, for the replay screen aboard
// the station (rendering/replay.js). The field is only 100 × 150, so a position packs into two bytes. Read-only: it
// never changes the fight.
import { bus } from '@last-orbit/core/events.js';
import { G } from '@last-orbit/core/game.js';

export const HZ = 10;
const MAX_E = 90, MAX_S = 70, MAX_B = 110;
// packing: x -60..60 and y -10..170 into a byte each, speeds in steps of 1.5 into a signed byte
const qx = (x) => Math.max(0, Math.min(255, Math.round((x + 60) * 2.125))), qy = (y) => Math.max(0, Math.min(255, Math.round((y + 10) * 1.4167)));
const qv = (v) => Math.max(-127, Math.min(127, Math.round(v / 1.5))) & 255;
export const unpack = { x: (b) => b / 2.125 - 60, y: (b) => b / 1.4167 - 10, v: (b) => (b > 127 ? b - 256 : b) * 1.5 };
const BULLET = { heavy: 1, orb: 2, snipe: 3 }; // anything else is a plain bolt (0)

let rec = null, last = null, kills = [];
const index = (list, key) => { let i = list.indexOf(key); if (i < 0) { i = list.length; list.push(key); } return i; };

/** Start a new recording. meta: what the replay screen shows beside the fight (ship, mode, sector). */
export function recStart(meta = {}) { rec = { meta, shapes: [], colors: [], frames: [], acc: 1 / HZ, t: 0 }; kills = []; }
/** Call as the fight advances (dt: game seconds); takes a frame every 1/HZ seconds. */
export function recTick(w, dt) {
  if (!rec || !w || !G.state.run) return; rec.t += dt; rec.acc += dt; if (rec.acc < 1 / HZ) return; rec.acc %= 1 / HZ;
  const run = G.state.run, p = w.player, es = [];
  rec.meta.sector = 'Sector ' + ((w.base.sectorIdx || 0) + 1);
  for (const e of w.enemies) if (e.alive && e.y < 175 && es.length < MAX_E) es.push(e);
  // enemies: id, shape, colour, x, y, size, flags (1 boss, 2 elite, 4 cloaked, 8 just hit)
  const E = new Uint8Array(es.length * 7);
  es.forEach((e, i) => { const o = i * 7; E[o] = e.id & 255; E[o + 1] = index(rec.shapes, e.def.shape || 'scout'); E[o + 2] = index(rec.colors, e.elite?.color ?? e.color ?? e.def.color ?? 0xffffff); E[o + 3] = qx(e.x); E[o + 4] = qy(e.y); E[o + 5] = Math.min(255, Math.round(e.r * 8));
    E[o + 6] = (e.boss ? 1 : 0) | (e.elite ? 2 : 0) | (e.cloaked ? 4 : 0) | (e.flash > 0 ? 8 : 0); });
  const pack = (list, max, kindOf) => { const n = Math.min(max, list.length), A = new Uint8Array(n * 5); let k = 0;
    for (const s of list) { if (k >= n) break; if (!s.alive) continue; const o = k * 5; A[o] = qx(s.x); A[o + 1] = qy(s.y); A[o + 2] = qv(s.vx); A[o + 3] = qv(s.vy); A[o + 4] = kindOf(s); k++; }
    return A.subarray(0, k * 5); };
  const S = pack(w.shots, MAX_S, (s) => index(rec.colors, s.c?.color ?? 0x5ee6ff)), B = pack(w.ebullets, MAX_B, (b) => BULLET[b.kind] || 0);
  rec.frames.push({ t: rec.t, wave: w.wave.num, score: Math.round(run.score || 0), hull: p.hull, shield: p.shield, alive: p.alive, px: p.x, py: p.y, tilt: p.tilt || 0, level: run.level || 1, E, S, B, K: kills });
  kills = [];
}
/** Stop and keep it as the last replay. end: how the sortie ended (the summary). */
export function recStop(end) { if (!rec) return last; last = { ...rec, end, secs: rec.t }; rec = null; return last; }
export const lastReplay = () => last;
/** Rough size of a replay packed for storage, in bytes. */
export const replayBytes = (r) => r ? r.frames.reduce((n, f) => n + 24 + f.E.length + f.S.length + f.B.length + f.K.length * 4, 0) : 0;
bus.on('kill', (w, e) => { if (rec) kills.push([qx(e.x), qy(e.y), index(rec.colors, e.color ?? e.def?.color ?? 0xffffff), e.boss ? 2 : e.elite ? 1 : 0]); });
