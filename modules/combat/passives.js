// Ship passives: each hull's unique trait (data/ships.js passive). Kill-driven ones listen for kills here;
// the damage-shaping ones are one-line checks where damage happens (world.js hurtPlayer / hitEnemy) via passiveOf().
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { fx, sfx, hitEnemy } from '@last-orbit/combat/world.js';
import { bestDps } from '@last-orbit/combat/abilities.js';

export const MOMENTUM_MAX = 10, MOMENTUM_STEP = 0.03, MOMENTUM_TIME = 3, STATIC_EVERY = 6;
/** Meltdown (the Chimera): a burst's reach, its damage as a share of the best weapon's damage a second, how hot the fire
 *  it sets, and how many bursts go off in a tick (a long chain carries on over the ticks after). */
export const MELT_R = 7, MELT_DMG = 0.45, MELT_BURN = 0.6, MELT_PER_TICK = 4;

bus.on('kill', (w, e) => {
  const run = G.state.run, p = w.player; if (!run || !p.alive) return;
  const id = w.passive;
  if (id === 'momentum') { p.momentum = Math.min(MOMENTUM_MAX, (p.momentum || 0) + 1); p.momentumT = MOMENTUM_TIME; }
  else if (id === 'static' && ++w.staticN >= STATIC_EVERY) {
    w.staticN = 0;
    // Arc into the three nearest living enemies around the kill.
    const near = w.enemies.filter((t) => t.alive && !t.invuln && t !== e).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, 3);
    const src = { id: 'static', dmg: bestDps().mul(1.2), critChance: 0, critMult: 1, color: 0xb69cff, armorPen: 0.5 };
    let x = e.x, y = e.y;
    for (const t of near) { fx(w, 'beam', x, y, t.x, t.y, 0xb69cff, 1.4, 0.25); hitEnemy(w, t, src, 1, t.x, t.y, true); x = t.x; y = t.y; }
    if (near.length) sfx(w, 'arc', 0.8);
  }
  else if (id === 'meltdown' && e.burnT > 0 && w.melts) w.melts.push(e.x, e.y); /* it bursts next tick: a chain runs across ticks, not down the stack */
});

/** Fire-rate multiplier from the Striker's Momentum stacks. */
export const momentumMul = (p) => 1 + MOMENTUM_STEP * (p.momentum || 0);
/** Per-tick upkeep: Momentum stacks fall away together once the kill streak pauses. */
export function updatePassives(w, dt) {
  const p = w.player;
  if (p.momentumT > 0) { p.momentumT -= dt; if (p.momentumT <= 0) p.momentum = 0; }
  if (w.meltSfx > 0) w.meltSfx -= dt;
  if (w.melts?.length) meltdown(w);
}
/** Meltdown: each enemy that died burning bursts, hitting everything close for part of your best weapon's damage and
 *  setting what it hits alight, so the fire runs on through a formation. */
function meltdown(w) {
  const q = w.melts, n = Math.min(q.length, MELT_PER_TICK * 2), src = { id: 'meltdown', dmg: bestDps().mul(MELT_DMG), critChance: 0, critMult: 1, color: 0x6dff8e, armorPen: 0.3 };
  for (let k = 0; k < n; k += 2) {
    const x = q[k], y = q[k + 1]; fx(w, 'boom', x, y, MELT_R, 0x6dff8e);
    for (let i = w.enemies.length - 1; i >= 0; i--) {
      const t = w.enemies[i]; if (!t?.alive) continue; const dx = t.x - x, dy = t.y - y, rr = MELT_R + t.r; if (dx * dx + dy * dy >= rr * rr) continue;
      const frac = hitEnemy(w, t, src, 1, t.x, t.y, true); if (t.alive && frac > 0 && !(t.burnT > 0)) { t.burn = (frac * MELT_BURN) / 3; t.burnT = 3; t.burnSrc = src; }
    }
  }
  q.splice(0, n); if (q.length > 80) q.length = 80; /* a runaway chain fizzles out */
  if (n && !(w.meltSfx > 0)) { sfx(w, 'boom', 0.35); w.meltSfx = 0.12; }
}
