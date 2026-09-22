// Deterministic wave generation: (run seed, wave number) → formation layout. Pure data out, no world access.
import { makeRng } from '@last-orbit/core/rng.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { ENEMIES, ELITE_MODS, WAVE_MODS } from '@last-orbit/data/enemies.js';
import { BOSSES } from '@last-orbit/data/bosses.js';
import { BAL } from '@last-orbit/data/balance.js';

const RUSH = ['warden', 'gravekeeper', 'broodcarrier', 'veilmother', 'foundry', 'bastion', 'broodqueen', 'wyrm', 'eventguard', 'dreadnought', 'oracle', 'singularity'];
export function waveKind(w, opts = {}) {
  const sec = sectorOf(w);
  if (opts.bossRush) return 'boss';
  if (sec.n === sec.len) return 'boss';
  if (sec.n % 10 === 0) return 'mini';
  if (sec.n % 10 === 5) return 'elite';
  return 'normal';
}
export const isBossWave = (w, opts) => { const k = waveKind(w, opts); return k === 'boss' || k === 'mini'; };

export function genWave(seed, w, opts = {}) {
  const rng = makeRng((seed ^ Math.imul(w, 0x9e3779b1)) >>> 0), sec = sectorOf(w);
  let kind = waveKind(w, opts);
  const out = { wave: w, sector: sec, kind, rows: [], boss: null, mod: null, elites: 0, spacing: 9, haulers: 0, label: '' };
  if (kind === 'boss' || kind === 'mini') {
    out.boss = opts.bossRush ? RUSH[(w - 1) % RUSH.length] : kind === 'boss' ? sec.def.boss : sec.def.mini;
    out.label = BOSSES[out.boss].name; return out;
  }
  const pool = sec.def.pool.filter(([t, from]) => sec.n >= from);
  if (kind === 'normal' && w >= 8) {
    const roll = rng();
    if (sec.n % 10 === 8 || roll < 0.07) kind = out.kind = 'resource';
    else if (roll < 0.17) { kind = out.kind = 'challenge'; out.mod = rng.pick(WAVE_MODS); }
    else if (roll < 0.24 && pool.some(([t]) => t === 'swarmling')) kind = out.kind = 'swarm';
  }
  if (kind === 'resource') { out.haulers = (sec.n % 10 === 8 ? 1 : 3) + Math.min(4, Math.floor(sec.idx)); out.rows = [Array(5).fill(pool[0][0])]; out.label = 'Salvage convoy'; return out; }
  if (kind === 'swarm') { const cols = 11, rows = 4 + Math.min(3, Math.floor(sec.n / 25)); out.spacing = 6.5; for (let r = 0; r < rows; r++) out.rows.push(Array(cols).fill('swarmling')); out.label = 'Swarm'; return out; }

  const cols = Math.min(9, 5 + Math.floor(sec.n / 7) + (sec.idx > 0 ? 2 : 0));
  let budget = (7 + sec.n * 0.45 + sec.idx * 3) * (out.mod?.budget || 1);
  budget = Math.min(budget, 46);
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
  out.elites = kind === 'elite' ? 1 + Math.floor(sec.idx / 2) : (sec.idx >= 1 && rng.chance(0.12) ? 1 : 0);
  out.label = kind === 'elite' ? 'Elite wave' : kind === 'challenge' ? out.mod.name : '';
  out.rng = rng;
  return out;
}

/** Deterministic totals used by the offline/DPS estimator.
 * rewardUnits mirrors the actual kill reward multipliers (including which formation units became elites)
 * so offline currencies/XP can use the same progression basis as live combat instead of flat estimates. */
export function waveTotals(seed, w, opts) {
  const g = genWave(seed, w, opts);
  if (g.boss) {
    const b = BOSSES[g.boss]; let hp = b.hp;
    for (const p of b.parts || []) hp += (p.n || p.offsets.length) * p.hp * b.hp;
    const reward = b.mini ? BAL.miniReward : BAL.bossReward;
    return { hp, reward, count: 1, boss: b, kind: g.kind, rewardUnits: [{ reward, scrap: 1, elite: false, boss: true }] };
  }

  const units = [];
  for (const row of g.rows) for (const t of row) units.push({ def: ENEMIES[t], elite: null, boss: false });
  // genWave leaves its deterministic RNG at the exact point live combat uses to choose elite hosts/modifiers.
  const rng = g.rng;
  for (let i = 0; i < g.elites && units.length; i++) {
    const cand = units.filter((u) => !u.elite && !u.def.aura && u.def.cost >= 1); if (!cand.length) break;
    const u = cand[Math.floor(rng() * cand.length)]; u.elite = ELITE_MODS[Math.floor(rng() * ELITE_MODS.length)];
  }
  for (let i = 0; i < g.haulers; i++) units.push({ def: ENEMIES.treasure, elite: null, boss: false });

  let hp = 0, reward = 0; const rewardUnits = [];
  for (const u of units) {
    const eliteMul = u.elite ? BAL.eliteReward : 1, hpMul = u.elite ? BAL.eliteHp * (u.elite.hp || 1) : 1;
    hp += u.def.hp * hpMul; reward += u.def.reward * eliteMul;
    rewardUnits.push({ reward: u.def.reward * eliteMul, scrap: u.def.scrap || 1, elite: !!u.elite, boss: false });
  }
  const m = g.mod; if (m) { hp *= m.hp || 1; reward *= m.reward || 1; }
  return { hp, reward, count: units.length, boss: null, kind: g.kind, rewardUnits };
}
