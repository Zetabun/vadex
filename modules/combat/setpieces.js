// Counterattack set pieces: each stage past Liftoff has one feature that changes how it plays.
//   wrecks  (Graveyard Run) derelict hulks drift down the field; they are solid and soak up fire from both sides.
//   nebula  (Into the Red)  gas banks drift past; enemies inside are veiled, and aimed fire loses track of a ship inside.
//   hull    (Iron Curtain)  a battleship hull slides beneath; hull guns ride on it (see buildTimeline).
//   hive    (Hive Breach)   organic walls close in and open out on both sides; spore pods grow on them.
//   horizon (Event Horizon) the singularity pulls the ship and bends enemy fire, with a tidal surge now and then.
// Everything here is seeded or a pure function of stage time, so every attempt at a stage plays the same.
import { FIELD } from '@last-orbit/data/balance.js';
import { GROUND_SPEED, COUNTER_TOP } from '@last-orbit/data/counter.js';
import { fx, sfx } from '@last-orbit/combat/world.js';

const HALF = FIELD.W / 2 - 3.5;
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// ---- tunables
export const WRECK = { speed: 8, gap: [6.5, 9] };
export const NEBULA = { speed: 10, gap: [4.2, 6.5], core: 0.78 };
export const HULL = { from: 0.1, to: 0.62, half: 32, bow: 60 };
export const HIVE = { from: 0.05, to: 0.93 };
export const HORIZON = { x: 12, y: 126, pull: 6, surgePull: 17, surgeEvery: 15, telegraph: 1.6, surge: 2.4, bend: 9 };

/** Hive wall thickness at a world height (field y + scroll), for one side (-1 left, 1 right). Ramped in at the start. */
export function hiveDepth(wy, side, ramp = 1) {
  const ph = side < 0 ? 0 : 2.1;
  const d = 9 + 6 * Math.sin(wy * 0.019 + ph) + 3 * Math.sin(wy * 0.061 + ph * 1.7) + 1.5 * Math.sin(wy * 0.13 + ph * 3.1);
  return Math.max(2, d) * ramp;
}
/** How far the hive tunnel has scrolled (world units) at stage time t, and how far in its walls have grown. */
export const hiveScroll = (stage, t) => GROUND_SPEED * (t - HIVE.from * stage.len);
export const hiveRamp = (stage, t) => { const a = t - HIVE.from * stage.len, b = HIVE.to * stage.len - t; return Math.max(0, Math.min(1, a / 6, b / 6)); };
/** The hull's bow (its lowest point) in field y at stage time t, and its length. */
export const hullFront = (stage, t) => FIELD.H + 30 - GROUND_SPEED * (t - HULL.from * stage.len);
export const hullLength = (stage) => GROUND_SPEED * (HULL.to - HULL.from) * stage.len;

export function initSetPiece(w) {
  const stage = w.counter.stage; if (!stage.set || stage.set === 'city') { w.set = null; return; }
  w.set = { kind: stage.set, items: [], next: 3, primed: false, rand: rng(stage.n * 104729 + 7), surgeT: HORIZON.surgeEvery, surge: 0, warn: 0 };
}

/** One tick of the stage's set piece: after the enemies, shots and bullets have moved. */
export function stepSetPiece(w, dt) {
  const s = w.set, c = w.counter; if (!s || !c) return;
  // The scenery clock keeps running while the timeline waits on the mini-boss, so the hull and walls never stall.
  s.clock = s.clock == null ? c.t : s.clock + dt;
  if (s.kind === 'wrecks' || s.kind === 'nebula') drifters(w, s, c, dt);
  if (s.kind === 'wrecks') wrecks(w, s);
  else if (s.kind === 'nebula') nebula(w, s);
  else if (s.kind === 'hive') hive(w, s, c);
  else if (s.kind === 'horizon') horizon(w, s, c, dt);
}

// ---------------------------------------------------------------- drifting wrecks and gas banks
function drifters(w, s, c, dt) {
  const wreck = s.kind === 'wrecks', cfg = wreck ? WRECK : NEBULA, R = s.rand;
  const make = (y) => wreck
    ? { x: (R() - 0.5) * 58, y, w: 22 + R() * 15, h: 7.5 + R() * 4.5, rot: (R() - 0.5) * 0.9, vr: (R() - 0.5) * 0.06, seed: (R() * 1e9) | 0 }
    : { x: (R() - 0.5) * 66, y, r: 17 + R() * 11, rot: R() * 6, vr: (R() - 0.5) * 0.1, seed: (R() * 1e9) | 0 };
  // A stage entered part-way (a retry never is, but the debug scenes are) starts with the field already populated.
  if (!s.primed) { s.primed = true; if (c.t > 6) for (const y of [40, 95, 150]) s.items.push(make(y)); s.next = Math.max(3, c.t + 2); }
  if (!c.boss && c.t >= s.next && c.t < c.stage.len) { s.items.push(make(FIELD.H + 30)); s.next = c.t + cfg.gap[0] + R() * (cfg.gap[1] - cfg.gap[0]); }
  for (let i = s.items.length - 1; i >= 0; i--) { const it = s.items[i]; it.y -= cfg.speed * dt; it.rot += it.vr * dt; if (it.y < -40) s.items.splice(i, 1); }
}

/** Point in a wreck's rectangle (in its own rotated frame), with extra padding. */
function inWreck(it, x, y, pad = 0) {
  const cs = Math.cos(-it.rot), sn = Math.sin(-it.rot), dx = x - it.x, dy = y - it.y, lx = dx * cs - dy * sn, ly = dx * sn + dy * cs;
  return Math.abs(lx) < it.w / 2 + pad && Math.abs(ly) < it.h / 2 + pad ? [lx, ly] : null;
}

function wrecks(w, s) {
  if (!s.items.length) return;
  // Cover: bullets from either side stop dead against a hulk.
  for (const b of w.ebullets) if (b.alive) for (const it of s.items) if (inWreck(it, b.x, b.y)) { b.alive = false; if (Math.random() < 0.5) fx(w, 'hit', b.x, b.y, 0xffb070); break; }
  for (const sh of w.shots) if (sh.life > 0) for (const it of s.items) if (inWreck(it, sh.x, sh.y)) { sh.life = 0; if (Math.random() < 0.3) fx(w, 'hit', sh.x, sh.y, 0x9fb4d8); break; }
  // Solid: the ship is pushed out along the shallower side of the hulk.
  const p = w.player; if (!p.alive) return;
  for (const it of s.items) {
    const hit = inWreck(it, p.x, p.y, p.r * 0.8); if (!hit) continue;
    const [lx, ly] = hit, px = it.w / 2 + p.r * 0.8 - Math.abs(lx), py = it.h / 2 + p.r * 0.8 - Math.abs(ly);
    let ox = 0, oy = 0; if (px < py) ox = Math.sign(lx || 1) * px; else oy = Math.sign(ly || 1) * py;
    const cs = Math.cos(it.rot), sn = Math.sin(it.rot);
    p.x = Math.max(-HALF, Math.min(HALF, p.x + ox * cs - oy * sn)); p.y = Math.max(FIELD.PLAYER_Y, Math.min(COUNTER_TOP, p.y + ox * sn + oy * cs));
    if (inWreck(it, p.x, p.y, p.r * 0.5)) p.x = Math.max(-HALF, Math.min(HALF, p.x + (p.x < it.x ? -1 : 1) * 1.5)); // wedged against the floor: slide out sideways
  }
}

function nebula(w, s) {
  const inside = (x, y) => s.items.some((it) => (x - it.x) ** 2 + (y - it.y) ** 2 < (it.r * NEBULA.core) ** 2);
  for (const e of w.enemies) if (e.alive) e.veiled = !e.boss && inside(e.x, e.y);
  w.playerVeiled = w.player.alive && inside(w.player.x, w.player.y);
}

// ---------------------------------------------------------------- hive walls
function hive(w, s, c) {
  const ramp = hiveRamp(c.stage, s.clock); s.scroll = hiveScroll(c.stage, s.clock); s.ramp = ramp; if (ramp <= 0) return;
  const p = w.player, wy = p.y + s.scroll;
  const lo = -HALF - 3.5 + hiveDepth(wy, -1, ramp) + p.r, hi = HALF + 3.5 - hiveDepth(wy, 1, ramp) - p.r;
  if (p.x < lo) p.x = lo; else if (p.x > hi) p.x = hi;
}

// ---------------------------------------------------------------- the singularity
function horizon(w, s, c, dt) {
  const H = HORIZON, p = w.player;
  // Tidal surges: a warning ring closes on the singularity, then the pull triples for a moment.
  if (c.t > 4 && !s.surge && !s.warn) { s.surgeT -= dt; if (s.surgeT <= 0) { s.warn = H.telegraph; fx(w, 'text', 0, 96, 'TIDAL SURGE', '#ffb070', 2); sfx(w, 'phase', 0.6); } }
  if (s.warn) { s.warn = Math.max(0, s.warn - dt); if (!s.warn) { s.surge = H.surge; fx(w, 'shake', 0.6); } }
  else if (s.surge) { s.surge = Math.max(0, s.surge - dt); if (!s.surge) s.surgeT = H.surgeEvery; }
  const pull = s.surge ? H.surgePull : H.pull;
  if (p.alive) {
    const dx = H.x - p.x, dy = H.y - p.y, d = Math.hypot(dx, dy) || 1;
    p.x = Math.max(-HALF, Math.min(HALF, p.x + (dx / d) * pull * dt)); p.y = Math.max(FIELD.PLAYER_Y, Math.min(COUNTER_TOP, p.y + (dy / d) * pull * dt));
  }
  // Space bends: enemy fire curves toward the singularity.
  const bend = H.bend * (s.surge ? 2 : 1) * dt;
  for (const b of w.ebullets) { if (!b.alive) continue; const dx = H.x - b.x, dy = H.y - b.y, d = Math.hypot(dx, dy) || 1; b.vx += (dx / d) * bend; b.vy += (dy / d) * bend; }
}
