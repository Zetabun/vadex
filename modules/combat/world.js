// The live battle. Pure simulation state: no DOM, no Three.js. The renderer reads these arrays and drains world.fx.
import { Big } from '@last-orbit/core/big.js';
import { G, count, maxStat, flag } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { rand } from '@last-orbit/core/rng.js';
import { BAL, FIELD, enemyHp, enemyDmg, salvageDrop, killXp } from '@last-orbit/data/balance.js';
import { ENEMIES } from '@last-orbit/data/enemies.js';
import { spawnPickup } from '@last-orbit/combat/pickups.js';
import { addScore, killScore } from '@last-orbit/data/score.js';

let nextId = 1;
export function createWorld() {
  return {
    t: 0, player: { x: 0, y: FIELD.PLAYER_Y, r: 3.2, hull: 1, shield: 1, leechBudget: 0.08, alive: true, invuln: 0, sinceHit: 99, focus: 0, combo: 0, comboT: 0, energy: 50, retal: 0, lastStand: true, vx: 0, tilt: 0, fireFlash: 0 },
    input: { targetX: 0, fire: false, manualT: 99, tap: null },
    enemies: [], shots: [], ebullets: [], drones: [], barriers: [], hazards: [], pickups: [], fx: [],
    wave: { num: 0, state: 'idle', timer: 0, info: null, damaged: false, t: 0, boss: null, kills: 0, shotsFired: 0 },
    form: { x: 0, y: 0, dir: 1, speed: BAL.formSpeed, minOff: 0, maxOff: 0, enter: 0, alive: 0, total: 1 },
    wt: {}, volleys: {}, abil: { cd: {}, charges: {}, active: {} }, painted: null, paintT: 0, acc: {}, slowT: 0, stunT: 0, chargeShots: 0,
    base: { hp: Big.ONE, reward: Big.ONE, dmg: Big.ONE, dmgPerHull: 0.1, dmgPerShield: 0.1, dmgPerBarrier: 0.1, sectorIdx: 0 },
    buckets: Array.from({ length: 12 }, () => []), sim: { formSpeed: 1, fireRate: 1 },
  };
}

// ---------- fx queue (renderer + audio consume; capped so headless runs never grow) ----------
export function fx(w, k, a, b, c, d, e, f, g) { if (w.fx.length < 260) w.fx.push({ k, a, b, c, d, e, f, g }); }
/** Add to the sortie score; the first time it passes the pilot's high score, celebrate. */
export function score(w, pts) {
  const run = G.state.run; if (!run || !(pts > 0)) return;
  if (addScore(run, pts)) { fx(w, 'text', 0, 60, 'NEW HIGH SCORE', '#ffc857', 2); sfx(w, 'milestone'); bus.emit('highScore', run.score); }
}
export const sfx = (w, id, vol) => fx(w, 'sfx', id, vol);

export function setWaveBase(w, waveNum, sectorIdx) {
  const b = w.base; b.sectorIdx = sectorIdx; b.wave = waveNum;
  const m = w.mods || {}; b.hp = enemyHp(waveNum, sectorIdx).mul(m.hp || 1); b.dmg = enemyDmg(waveNum, sectorIdx).mul(m.dmg || 1);
  refreshDefence(w);
}
export function refreshDefence(w) {
  const hull = G.sheet.b('hull'), ratio = G.sheet.n('shieldRatio'), red = 1 - Math.min(0.8, G.sheet.n('dmgReduce'));
  w.base.dmgPerHull = w.base.dmg.ratio(hull) * red;
  w.base.dmgPerShield = ratio > 0 ? w.base.dmgPerHull / ratio : Infinity;
  w.base.hasShield = ratio > 0;
  w.base.dmgPerBarrier = w.base.dmg.ratio(Big.from(BAL.hull).mul(G.sheet.n('barrier') * 0.6));
}

// ---------- enemies ----------
export function spawnEnemy(w, type, x, y, opts = {}) {
  const def = opts.def || ENEMIES[type]; if (w.enemies.length >= 110) return null;
  const hpMul = (opts.hp ?? def.hp) * (w.wave.info?.mod?.hp || 1);
  const e = { id: nextId++, type, def, x, y, r: opts.r ?? def.r, hpMax: w.base.hp.mul(hpMul), hp: 1, armour: opts.armour ?? def.armour ?? 0, rewardMul: opts.reward ?? def.reward,
    slot: opts.slot || null, state: opts.slot ? 'form' : (opts.state || 'free'), t: rand() * 10, fireT: (def.fire?.every || 5) * (0.4 + rand()), spawnT: 0, diveT: 0,
    elite: null, shielded: false, buffed: false, cloaked: false, stunT: 0, burn: 0, burnT: 0, flash: 0, vx: opts.vx || 0, vy: opts.vy || 0, boss: null, part: null, parent: null, invuln: false, alive: true, rot: 0, scale: opts.scale || 1, leech: 0, regen: 0, color: def.color, weak: null, weakOpen: false, rampId: 0 };
  w.enemies.push(e); return e;
}
export function makeElite(w, e, mod) {
  e.elite = mod; (G.state.seen.elites || (G.state.seen.elites = {}))[mod.id] = 1; e.hpMax = e.hpMax.mul(BAL.eliteHp * (mod.hp || 1)); e.rewardMul *= BAL.eliteReward; e.scale *= mod.size || 1.2; e.r *= mod.size || 1.2;
  e.armour = Math.max(e.armour, mod.armour || 0); e.regen = mod.regen || 0; e.leech = mod.leech || 0;
}

// ---------- targeting ----------
/** Best target for automated weapons. skip: Set/array of enemies to ignore. from: {x,y} for nearest-first weapons. */
export function pickTarget(w, skip, from, maxRange) {
  let best = null, bs = -Infinity;
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (!e.alive || e.invuln || e.y > FIELD.TOP + 12 || e.cloaked || (skip && skip.indexOf(e) >= 0)) continue;
    let s = (FIELD.H - e.y) * 2;
    if (from) { const d = Math.hypot(e.x - from.x, e.y - from.y); if (maxRange && d > maxRange) continue; s = 300 - d; }
    s += e.def.prio * 30;
    if (e.state === 'dive') s += 120;
    if (e === w.painted) s += 1e6;
    else if (e.droneMarkT > 0) s += 1e5;
    if (e.weakOpen) s += 5e4;
    if (e.shielded) s -= 200;
    if (e.def.projectile) s -= 150;
    if (s > bs) { bs = s; best = e; }
  }
  return best;
}
export function rebuildBuckets(w) {
  const B = w.buckets; for (let i = 0; i < B.length; i++) B[i].length = 0;
  for (let i = 0; i < w.enemies.length; i++) { const e = w.enemies[i]; if (!e.alive) continue; const a = bucketOf(e.x - e.r - 3), b = bucketOf(e.x + e.r + 3); for (let k = a; k <= b; k++) B[k].push(e); }
}
export const bucketOf = (x) => Math.max(0, Math.min(11, Math.floor((x + 60) / 10)));

// ---------- damage ----------
/** src: weapon config (dmg Big, critChance, critMult, armorPen, shieldPierce, bossMul, id). Returns damage fraction dealt. */
export function hitEnemy(w, e, src, mult, hx, hy, noCrit) {
  if (!e.alive) return 0;
  if (e.invuln) { if (rand() < 0.3) fx(w, 'text', e.x, e.y + e.r, 'SHIELDED', '#7aa2ff', 0); e.flash = 0.06; return 0; }
  const p = w.player, sh = G.sheet;
  let m = mult * (1 + p.focus), crit = false, weak = false;
  if (!noCrit && (w.chargeShots > 0 && src.id !== 'drone' ? true : rand() < src.critChance)) { crit = true; m *= src.critMult; }
  if (e.boss || e.parent) m *= sh.n('bossDmg') * (src.bossMul || 1); else if (e.elite) m *= sh.n('eliteDmg') * (src.bossMul || 1);
  if (e.armour > 0) m *= 1 - e.armour * (1 - (src.armorPen || 0));
  if (e.shielded && !src.shieldPierce) m *= 0.15;
  if (e.weakOpen && e.weak && Math.abs(hx - (e.x + e.weak.x)) < e.weak.r + 1.5) { weak = true; m *= sh.n('weakMult'); count('weakHits'); }
  if (w.passive === 'execute' && e.hp < 0.3) m *= 1.6;
  { const bossId = e.boss?.id || e.parent?.boss?.id, intel = bossId ? G.state.intel?.[bossId] || 0 : 0; if (intel) m *= 1 + BAL.intelStep * intel; }
  if (e === w.painted) m *= BAL.paintMult;
  else if (e.droneMarkT > 0) m *= 1 + (e.droneMarkPower || 0.08);
  const frac = src.dmg.ratio(e.hpMax) * m;
  const dealt = Math.max(0, Math.min(e.hp, frac));
  e.hp -= frac; e.flash = 0.08;
  // Heal from health actually removed, never overkill. A refillable budget caps dense AoE.
  const leech = sh.n('lifeSteal');
  if (leech > 0 && p.alive && p.hull < 1 && p.leechBudget > 0) {
    const heal = Math.min(1 - p.hull, p.leechBudget, dealt * leech);
    p.hull += heal; p.leechBudget -= heal;
  }
  w.acc[src.id] = (w.acc[src.id] || 0) + m; w.accSrc = w.accSrc || {}; w.accSrc[src.id] = src.dmg;
  if (crit) count('crits');
  if (G.state.settings.dmgNumbers && (crit || weak || rand() < 0.35)) fx(w, 'text', hx ?? e.x, (hy ?? e.y) + 2, src.dmg.mul(m), weak ? '#ff5fa2' : crit ? '#ffd166' : '#dfe9ff', crit || weak ? 1 : 0);
  if (e.hp <= 0) {
    const over = -e.hp; e.hp = 0;
    killEnemy(w, e, src, crit, over);
  } else if (e.parent && e.part?.parentDamage) { e.parent.hp -= frac * e.part.parentDamage * e.hpMax.ratio(e.parent.hpMax); }
  return frac;
}
/** Radial damage. falloff keeps the centre hit strongest. */
export function blast(w, x, y, radius, src, mult, exclude) {
  fx(w, 'boom', x, y, radius, src.color || 0xffaa55); sfx(w, 'boom', Math.min(1, radius / 14));
  const r2 = radius * radius;
  for (let i = w.enemies.length - 1; i >= 0; i--) {
    const e = w.enemies[i]; if (!e || !e.alive || e === exclude) continue;
    const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy, rr = radius + e.r;
    if (d2 < rr * rr) hitEnemy(w, e, src, mult * (d2 < r2 * 0.25 ? 1 : 0.6), e.x, e.y, true);
  }
}

/** Rewards scale with the enemy's reward weight: XP orbs always, salvage canisters sometimes, rare repair kits. */
function dropLoot(w, e) {
  const wave = w.base.wave || 1, sec = w.base.sectorIdx, big = e.boss ? 2 : e.elite ? 1 : 0;
  const xp = killXp(e.rewardMul, sec), orbs = big === 2 ? 14 : big === 1 ? 5 : e.rewardMul >= 2.5 ? 2 : 1;
  for (let i = 0; i < orbs; i++) spawnPickup(w, 'xp', e.x, e.y, xp / orbs, big);
  let cans = 0, per = salvageDrop(wave);
  if (e.boss) { cans = 8; per = Math.round((e.boss.def.mini ? BAL.miniSalvage : BAL.bossSalvage) * (1 + sec * 0.6) / cans); }
  else if (e.elite) cans = 3;
  else if (rand() < BAL.salvageChance * (e.def.scrap || 1)) cans = 1;
  for (let i = 0; i < cans; i++) spawnPickup(w, 'salvage', e.x, e.y, per, big);
  if (rand() < (e.boss ? 1 : e.elite ? 0.35 : 0.012)) spawnPickup(w, 'repair', e.x, e.y, e.boss ? 0.35 : 0.12, big);
}

export function killEnemy(w, e, src, crit, over) {
  if (!e.alive) return; e.alive = false;
  const sh = G.sheet, p = w.player;
  count('kills'); w.wave.kills++; bus.emit('kill', w, e);
  if (e.elite) count('eliteKills');
  const hadStreak = p.combo > BAL.comboStep * 0.5;
  p.combo = Math.min(sh.n('comboMax'), p.combo + BAL.comboStep); p.comboT = BAL.comboWindow;
  if (hadStreak) bus.emit('streakActive', p.combo);
  if (e.rewardMul > 0 && !e.parent) { dropLoot(w, e); score(w, killScore(e, w.base.wave || 1)); }
  if (src?.energyOnKill) p.energy = Math.min(sh.n('energyCap'), p.energy + src.energyOnKill);
  fx(w, 'die', e.x, e.y, e.r * e.scale, e.color, e.boss ? 2 : e.elite ? 1 : 0); sfx(w, e.boss ? 'bossdie' : 'die', Math.min(1, e.r / 5));
  if (e.boss || e.elite) fx(w, 'shake', e.boss ? 1 : 0.35);
  // death-triggered mechanics
  const kx = (src?.killExplode || 0), chance = sh.f('f.killExplode');
  if (src && src.dmg && (kx || (chance && rand() < chance))) blast(w, e.x, e.y, (kx || 10) * sh.n('blast'), src, 0.5, e);
  if (e.elite?.deathBurst) for (let i = 0; i < e.elite.deathBurst; i++) { const a = (i / e.elite.deathBurst) * Math.PI * 2; spawnBullet(w, e.x, e.y, Math.cos(a) * 32, Math.sin(a) * 32, 1, 'bolt'); }
  if (e.def.split) for (let i = 0; i < e.def.split.n; i++) { const c = spawnEnemy(w, e.def.split.type, e.x + (i ? 4 : -4), e.y, { state: 'free', vx: (i ? 1 : -1) * 8, vy: -3 }); if (c) c.spawnT = 0.3; }
  if (e.parent) bus.emit('partDied', w, e);
  if (e.boss) {
    count('bossKills'); if (!e.boss.def.mini) count('sectorBosses');
    bus.emit('bossDied', w, e);
  }
  if (w.painted === e) w.painted = null;
}

// ---------- enemy fire & player damage ----------
export function spawnBullet(w, x, y, vx, vy, dmgMul, kind, r) {
  if (w.ebullets.length >= 240) return null;
  const b = { x, y, vx, vy, dmg: dmgMul, kind, r: r || (kind === 'heavy' ? 1.8 : 1.1), grazed: false, alive: true };
  w.ebullets.push(b); return b;
}
export function hurtPlayer(w, dmgMul, source) {
  const p = w.player; if (!p.alive || p.invuln > 0 || w.abil.active.aegis > 0) { if (p.alive) fx(w, 'shieldhit', p.x, p.y); return; }
  if (p.dashInv > 0) { if (!p.dodged) { p.dodged = true; fx(w, 'text', p.x, p.y + 8, 'DODGE', '#6dffc8', 0); count('dodges'); } return; }
  p.sinceHit = 0;
  let dmg = dmgMul; // in units of base enemy damage
  if (w.base.hasShield && p.shield > 0) {
    const need = dmg * w.base.dmgPerShield;
    if (need <= p.shield) { p.shield -= need; fx(w, 'shieldhit', p.x, p.y); sfx(w, 'shield'); return; }
    dmg *= 1 - p.shield / need; p.shield = 0; fx(w, 'shieldhit', p.x, p.y);
  }
  if (w.passive === 'stalwart' && p.hull < 0.5) dmg *= 0.7;
  p.hull -= dmg * w.base.dmgPerHull; w.wave.damaged = true; w.wave.bossDamaged = true;
  const run = G.state.run;
  if (w.passive === 'secondwind' && run && !run.windUsed && p.hull < 0.3) { run.windUsed = true; p.hull = Math.max(p.hull, 0) + 0.4; p.invuln = 2; fx(w, 'text', p.x, p.y + 10, 'SECOND WIND', '#6dffc8', 2); fx(w, 'boom', p.x, p.y, 20, 0x6dffc8); sfx(w, 'milestone'); }
  fx(w, 'hurt', p.x, p.y); fx(w, 'shake', 0.4); sfx(w, 'hurt');
  if (p.hull <= 0) {
    if (p.lastStand && flag('f.lastStand')) { p.lastStand = false; p.hull = 0.01; p.invuln = 2; fx(w, 'text', p.x, p.y + 8, 'LAST STAND', '#ff5fa2', 1); return; }
    p.hull = 0; p.alive = false; w.shots.length = 0; w.chargeShots = 0; fx(w, 'die', p.x, p.y, 8, 0x5ee6ff, 2); fx(w, 'shake', 1); sfx(w, 'bossdie');
    bus.emit('playerDied', w);
  }
}
