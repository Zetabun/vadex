// Deep Void anomaly rules that are more than a number: mines and shrapnel from the dead, beams that lock onto the
// ship's lane, gravity wells on the defence line and weaving bolts. w.anom (set by applyRunMods) says which are active.
import { bus } from '@last-orbit/core/events.js';
import { rand } from '@last-orbit/core/rng.js';
import { FIELD } from '@last-orbit/data/balance.js';
import { VOID_RULES as R } from '@last-orbit/data/anomalies.js';
import { sfx, spawnBullet } from '@last-orbit/combat/world.js';

bus.on('kill', (w, e) => {
  const a = w.anom; if (!a || w.counter || e.boss || e.parent || e.def.projectile || !(e.rewardMul > 0)) return;
  if (a.mines && rand() < R.mines.chance && w.hazards.filter((h) => h.void === 'mine').length < R.mines.cap)
    w.hazards.push({ kind: 'mine', void: 'mine', x: e.x, y: e.y, vy: -R.mines.drift, t: 0, fuse: R.mines.fuse + rand(), r: R.mines.radius, dmg: R.mines.dmg });
  if (a.shrapnel && rand() < R.shrapnel.chance) {
    const s = R.shrapnel;
    for (let k = 0; k < s.n; k++) { const ang = -Math.PI / 2 + (k / (s.n - 1) - 0.5) * 2 * s.fan; spawnBullet(w, e.x, e.y, Math.cos(ang) * s.speed, Math.sin(ang) * s.speed, s.dmg, 'bolt'); }
  }
});

/** Timed anomalies, while a wave is being fought. */
export function stepAnomalies(w, dt) {
  const a = w.anom; if (!a || !w.player.alive) return;
  const p = w.player, T = (w.anomT ||= { lance: R.lances.every * 0.6, well: R.wells.every * 0.5 }), boss = !!w.wave.boss;
  if (a.lances && (T.lance -= dt) <= 0) {
    const L = R.lances; T.lance = (boss ? L.bossEvery : L.every) * (0.85 + rand() * 0.3);
    w.hazards.push({ kind: 'beam', void: 'lance', x: p.x, y: FIELD.TOP, t: 0, telegraph: L.telegraph, dur: L.dur, width: L.width, dmg: L.dmg }); sfx(w, 'charge', 0.5);
  }
  if (a.wells && (T.well -= dt) <= 0) {
    const W = R.wells; T.well = W.every * (0.85 + rand() * 0.3);
    // Never right on top of the ship: it opens to one side and pulls.
    const side = p.x > 0 ? -1 : 1, x = Math.max(-38, Math.min(38, p.x + side * (18 + rand() * 18)));
    w.hazards.push({ kind: 'well', void: 'well', x, y: p.y, t: 0, dur: W.dur, pull: W.pull, src: null }); sfx(w, 'charge');
  }
}

/** Serpent Fire: straight-falling invader bolts weave. */
export function weave(w, b) { if (w.anom?.snake && b && !b.wob && !w.counter) b.wob = { a: R.snake.amp, f: R.snake.freq, p: rand() * 6.28 }; }
