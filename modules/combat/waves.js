// Deterministic wave generation: (run seed, wave number) → formation layout. Pure data out, no world access.
// Each ten-wave sector: wave 5 is an elite wave (sector 1) or mini-boss, wave 8 a salvage convoy, wave 10 the sector boss.
import { makeRng } from '@last-orbit/core/rng.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { ENEMIES, WAVE_MODS } from '@last-orbit/data/enemies.js';
import { BOSSES } from '@last-orbit/data/bosses.js';

export function waveKind(w) {
  const sec = sectorOf(w);
  if (sec.n === sec.len) return 'boss';
  if (sec.n === 5) return sec.idx >= 1 ? 'mini' : 'elite';
  if (sec.n === 8) return 'resource';
  return 'normal';
}
export const isBossWave = (w) => { const k = waveKind(w); return k === 'boss' || k === 'mini'; };

export function genWave(seed, w) {
  const rng = makeRng((seed ^ Math.imul(w, 0x9e3779b1)) >>> 0), sec = sectorOf(w);
  let kind = waveKind(w);
  const out = { wave: w, sector: sec, kind, rows: [], boss: null, mod: null, elites: 0, spacing: 9, haulers: 0, label: '' };
  if (kind === 'boss' || kind === 'mini') {
    out.boss = kind === 'boss' ? sec.def.boss : sec.def.mini;
    out.label = BOSSES[out.boss].name; return out;
  }
  const pool = sec.def.pool.filter(([, from]) => sec.n >= from);
  if (kind === 'normal' && (w >= 6 || sec.idx > 0)) {
    const roll = rng();
    if (roll < 0.14) { kind = out.kind = 'challenge'; out.mod = rng.pick(WAVE_MODS); }
    else if (roll < 0.22 && pool.some(([t]) => t === 'swarmling')) kind = out.kind = 'swarm';
  }
  if (kind === 'swarm') { const cols = 11, rows = 4 + Math.min(3, sec.idx); out.spacing = 6.5; for (let r = 0; r < rows; r++) out.rows.push(Array(cols).fill('swarmling')); out.label = 'Swarm'; return out; }

  const cols = Math.min(9, 6 + Math.floor(sec.n / 3) + Math.min(2, sec.idx));
  let budget = (11 + sec.n * 1.5 + sec.idx * 5) * (out.mod?.budget || 1);
  if (kind === 'resource') { budget *= 0.6; out.haulers = 2 + Math.min(3, sec.idx); out.label = 'Salvage convoy'; }
  budget = Math.min(budget, 52);
  const filler = pool.filter(([t]) => ENEMIES[t].cost < 2.2), special = pool.filter(([t]) => ENEMIES[t].cost >= 2.2);
  const maxRows = 6;
  while (budget > 0 && out.rows.length < maxRows) {
    const base = rng.weighted(filler.length ? filler : pool, (p) => p[2])[0];
    const row = Array(cols).fill(base); let cost = ENEMIES[base].cost * cols;
    if (special.length && rng.chance(0.55 + sec.idx * 0.05)) {
      const sp = rng.weighted(special, (p) => p[2])[0], n = ENEMIES[sp].cost >= 3 ? rng.int(1, 2) : rng.int(2, 3);
      const mid = (cols - 1) / 2;
      for (let i = 0; i < n; i++) { const off = n === 1 ? 0 : Math.round((i / (n - 1) - 0.5) * (cols - 3)); const c = Math.round(mid + off); cost += ENEMIES[sp].cost - ENEMIES[row[c]].cost; row[c] = sp; }
    }
    // supports (aura units) belong at the back where they are hard to reach
    if (row.some((t) => ENEMIES[t].aura)) out.rows.unshift(row); else out.rows.push(row);
    budget -= cost;
  }
  if (!out.rows.length) out.rows.push(Array(cols).fill(pool[0][0]));
  out.elites = kind === 'elite' ? 2 : (sec.idx >= 1 && rng.chance(0.15) ? 1 : 0);
  if (!out.label) out.label = kind === 'elite' ? 'Elite wave' : kind === 'challenge' ? out.mod.name : '';
  out.rng = rng;
  return out;
}
