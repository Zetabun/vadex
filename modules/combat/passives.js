// Ship passives: each hull's unique trait (data/ships.js passive). Kill-driven ones listen for kills here;
// the damage-shaping ones are one-line checks where damage happens (world.js hurtPlayer / hitEnemy) via passiveOf().
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { fx, sfx, hitEnemy } from '@last-orbit/combat/world.js';
import { bestDps } from '@last-orbit/combat/abilities.js';

export const MOMENTUM_MAX = 10, MOMENTUM_STEP = 0.03, MOMENTUM_TIME = 3, STATIC_EVERY = 6;

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
});

/** Fire-rate multiplier from the Striker's Momentum stacks. */
export const momentumMul = (p) => 1 + MOMENTUM_STEP * (p.momentum || 0);
/** Per-tick upkeep: Momentum stacks fall away together once the kill streak pauses. */
export function updatePassives(w, dt) {
  const p = w.player;
  if (p.momentumT > 0) { p.momentumT -= dt; if (p.momentumT <= 0) p.momentum = 0; }
}
