// Loot pickups: XP orbs, salvage canisters and repair kits burst out of kills, drift down, and are pulled in
// once they come within the ship's tractor range. Everything left is vacuumed up when a wave is cleared,
// so flying well only makes rewards arrive sooner; nothing is ever lost.
import { G, noteHull } from '@last-orbit/core/game.js';
import { rand } from '@last-orbit/core/rng.js';
import { BAL, FIELD } from '@last-orbit/data/balance.js';
import { grantXp, grantSalvage } from '@last-orbit/progression/run.js';

const COLOR = { xp: '#6dffc8', salvage: '#ffc857', repair: '#ff6b8f' };

export function spawnPickup(w, kind, x, y, v, big = 0) {
  const P = w.pickups;
  if (P.length >= BAL.pickupCap) {
    // Merge into the oldest pickup of the same kind rather than dropping value.
    for (const p of P) if (p.kind === kind) { p.v += v; return p; }
    return null;
  }
  const a = rand() * Math.PI * 2, sp = (big ? 26 : 12) * (0.4 + rand() * 0.8);
  const p = { kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 6, v, t: 0, pull: false, big: big > 0 || v >= 5 };
  P.push(p); return p;
}

function collect(w, p) {
  const pl = w.player;
  if (p.kind === 'xp') { grantXp(p.v); w.fx.push({ k: 'pickup', a: pl.x, b: pl.y, c: 0x6dffc8 }); }
  else if (p.kind === 'salvage') { const got = grantSalvage(p.v); w.fx.push({ k: 'text', a: pl.x, b: pl.y + 6, c: '+' + Math.max(1, Math.round(got)), d: COLOR.salvage, e: 1 }); w.fx.push({ k: 'sfx', a: 'loot', b: 0.35 }); }
  else if (p.kind === 'repair') { const was = pl.hull; pl.hull = Math.min(1, pl.hull + p.v); noteHull('kit', pl.hull - was); w.fx.push({ k: 'text', a: pl.x, b: pl.y + 6, c: 'REPAIR', d: COLOR.repair, e: 1 }); w.fx.push({ k: 'naniteRepair', a: pl.x, b: pl.y }); }
}

export function updatePickups(w, dt) {
  const P = w.pickups; if (!P.length) return;
  const pl = w.player, range = G.sheet.n('magnet'), vacuum = w.wave.state === 'cleared' || w.wave.state === 'idle';
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.t += dt;
    const dx = pl.x - p.x, dy = pl.y - p.y, d = Math.hypot(dx, dy);
    if (pl.alive && (p.pull || vacuum || d < range || p.t > 7)) p.pull = true;
    if (p.pull && pl.alive) {
      const acc = 240 + p.t * 60, k = 1 / Math.max(d, 0.001);
      p.vx += dx * k * acc * dt; p.vy += dy * k * acc * dt;
      const damp = Math.pow(0.02, dt); p.vx *= damp; p.vy *= damp;
      if (d < 4.5) { collect(w, p); P.splice(i, 1); continue; }
    } else {
      p.vx *= Math.pow(0.25, dt); p.vy = Math.max(-16, (p.vy - 22 * dt) * Math.pow(0.5, dt));
      if (p.y < FIELD.PLAYER_Y - 2) { p.y = FIELD.PLAYER_Y - 2; p.vy = 0; }
    }
    p.x = Math.max(-FIELD.W / 2, Math.min(FIELD.W / 2, p.x + p.vx * dt)); p.y += p.vy * dt;
  }
}

/** Instantly bank everything still floating (used when a sortie ends so nothing earned is lost). */
export function collectAll(w) { for (const p of w.pickups) collect(w, p); w.pickups.length = 0; }
export const PICKUP_COLOR = COLOR;
