// Generic boss driver. Boss definitions are data (data/bosses.js); this file turns them into behaviour.
import { bus } from '@last-orbit/core/events.js';
import { rand } from '@last-orbit/core/rng.js';
import { BAL, FIELD } from '@last-orbit/data/balance.js';
import { BOSSES } from '@last-orbit/data/bosses.js';
import { ENEMIES } from '@last-orbit/data/enemies.js';
import { fx, sfx, spawnEnemy, spawnBullet } from '@last-orbit/combat/world.js';
/** A boss's shot: harder-hitting than an invader's (BAL.bossShot) and bigger, so it reads as the threat it is. */
const bossShot = (w, x, y, vx, vy, dmg, kind, r) => spawnBullet(w, x, y, vx, vy, dmg * BAL.bossShot, kind, (r || (kind === 'heavy' ? 1.8 : 1.1)) * BAL.bossShotSize);
import { G } from '@last-orbit/core/game.js';
import { squadPaths } from '@last-orbit/combat/paths.js';

/** Seconds before an attack in which the boss visibly winds up (drawn by the renderer from boss.boss.charge). */
const TELL = 0.7;
/** What a boss with no tip of its own says, if it has a weak point. */
const WEAK_TIP = `Hit the amber target when it opens: ${BAL.weakMult}× damage`;
const TELL_COL = { hbeam: 0xff4d5e, sweep: 0xff4d5e, beam: 0xff3df0, mines: 0xffb070, gapwall: 0xffd166, split: 0xff5d8f, wave: 0xb69cff, ring: 0xd17bff, spiral: 0xd17bff, well: 0xb69cff, shell: 0xffa94d, ambush: 0x7dffcf, veil: 0xff4d6d };

export function spawnBoss(w, id) {
  const def = BOSSES[id];
  const e = spawnEnemy(w, id, 0, FIELD.H + 30, { def: { ...def, reward: def.mini ? BAL.miniReward : BAL.bossReward, prio: 5 }, hp: def.hp, r: def.r, armour: def.armour || 0, reward: def.mini ? BAL.miniReward : BAL.bossReward });
  e.boss = { id, def, phase: -1, timers: [], t: 0, enter: 2.4, weakT: def.weak ? def.weak.every * 0.6 : 0, parts: [], enraged: false, homeY: def.y, tpFlash: 0 };
  e.weak = def.weak ? { x: 0, r: def.weak.r } : null; e.baseArmour = e.armour;
  w.wave.boss = e; w.wave.bossDamaged = false;
  const intel = def.mini ? 0 : G.state.intel?.[id] || 0, tip = G.state.stats?.bossBy?.[id] ? null : def.tip || (def.weak ? WEAK_TIP : null); /* how to beat it, until you have */
  fx(w, 'bossIntro', def.name, intel ? `${def.title} · Intel ${intel}: +${Math.round(intel * BAL.intelStep * 100)}% damage` : def.title, def.color, tip); sfx(w, 'bossintro'); fx(w, 'shake', 0.5);
  spawnParts(w, e);
  return e;
}

function spawnParts(w, boss) {
  const b = boss.boss;
  for (const pd of b.def.parts || []) {
    const n = pd.n || pd.offsets.length;
    for (let i = 0; i < n; i++) {
      if (b.parts.some((p) => p.alive && p.part === pd && p.partIdx === i)) continue;
      const base = ENEMIES[pd.shape] || {};
      const e = spawnEnemy(w, pd.kind, boss.x, boss.y, { def: { name: pd.kind, hp: 1, reward: 0, r: pd.r, prio: pd.shieldsParent ? 12 : 4, color: base.color || b.def.color, shape: pd.shape, fire: pd.fire }, hp: pd.hp * b.def.hp, r: pd.r, armour: pd.armour || 0, reward: 0.5 });
      if (!e) continue; e.parent = boss; e.part = pd; e.partIdx = i; e.color = base.color || b.def.color; b.parts.push(e);
    }
  }
}

export function updateBoss(w, dt) {
  const boss = w.wave.boss; if (!boss || !boss.alive) return;
  const b = boss.boss, def = b.def, p = w.player, slow = w.slowT > 0 ? 0.35 : 1, stunned = w.stunT > 0;
  const edt = dt * slow; b.t += edt;
  if (b.enter > 0) { b.enter -= dt; boss.y += (b.homeY - boss.y) * Math.min(1, 2.2 * dt); boss.invuln = true; positionParts(w, boss, edt); if (b.enter <= 0) boss.invuln = false; return; }
  // phases
  let ph = 0; for (let i = 0; i < def.phases.length; i++) if (boss.hp <= def.phases[i].at) ph = i;
  if (ph !== b.phase) {
    b.phase = ph; b.timers = def.phases[ph].attacks.map((a) => a.every * (0.4 + rand() * 0.3));
    if (ph > 0) { fx(w, 'text', boss.x, boss.y - boss.r - 4, 'PHASE ' + (ph + 1), '#ff4d7a', 1); fx(w, 'shake', 0.5); sfx(w, 'phase'); for (const pd of def.parts || []) if (pd.respawnPhase) spawnParts(w, boss); }
  }
  const phase = def.phases[ph], spd = (phase.speed || 1) * (b.enraged ? 1.5 : 1);
  if (!b.enraged && b.t > BAL.enrage) { b.enraged = true; fx(w, 'text', boss.x, boss.y - boss.r - 4, 'ENRAGED', '#ff4d7a', 1); sfx(w, 'phase'); }
  // movement
  if (!stunned) {
    if (def.move === 'hover') { boss.x = Math.sin(b.t * 0.5 * spd) * 30; boss.y = b.homeY + Math.sin(b.t * 0.9) * 4; }
    else if (def.move === 'slow') { boss.x = Math.sin(b.t * 0.22 * spd) * 18; boss.y = b.homeY; }
    else if (def.move === 'worm') { const q = wormPos(b.t * spd, b.homeY); boss.x = q.x; boss.y = q.y; }
    else if (def.move === 'teleport') { boss.y = b.homeY + Math.sin(b.t * 1.3) * 5; boss.x += Math.sin(b.t * 0.8) * 6 * edt; }
  }
  positionParts(w, boss, edt, spd);
  const gens = b.parts.filter((x) => x.alive);
  boss.invuln = gens.some((x) => x.part.shieldsParent);
  boss.armour = def.armourWhileParts ? (gens.length ? def.armour : 0.1) : boss.baseArmour;
  // weak point window
  if (def.weak) { b.weakT -= edt; if (!boss.weakOpen && b.weakT <= 0) { boss.weakOpen = true; b.weakT = def.weak.dur; sfx(w, 'weak'); } else if (boss.weakOpen && b.weakT <= 0) { boss.weakOpen = false; b.weakT = def.weak.every; } }
  if (stunned) return;
  // attacks
  const rate = b.enraged ? 1.7 : 1;
  b.charge = 0;
  phase.attacks.forEach((a, i) => { b.timers[i] -= edt * rate; if (b.timers[i] <= 0) { b.timers[i] = a.every; attack(w, boss, a); } else if (b.timers[i] < TELL && TELL_COL[a.kind]) { const k = 1 - b.timers[i] / TELL; if (k > b.charge) { b.charge = k; b.chargeCol = TELL_COL[a.kind]; } } });
  // Veil: the boss fades out, untouchable, and reappears somewhere else.
  if (b.veilT > 0) { b.veilT -= edt; boss.invuln = true; boss.cloaked = true; if (b.veilT <= 0) { boss.cloaked = false; boss.x = (rand() - 0.5) * 60; fx(w, 'boom', boss.x, boss.y, boss.r, def.color); sfx(w, 'teleport'); } }
  // running spirals
  if (b.spiral) { const s = b.spiral; s.t -= edt; s.acc += edt; while (s.acc >= s.rate) { s.acc -= s.rate; s.ang += 0.35; for (let k = 0; k < s.arms; k++) { const a = s.ang + (k / s.arms) * Math.PI * 2; bossShot(w, boss.x, boss.y, Math.cos(a) * s.speed, Math.sin(a) * s.speed, 1, 'orb'); } } if (s.t <= 0) b.spiral = null; }
  for (const part of gens) if (part.def.fire) { part.fireT -= edt * rate; if (part.fireT <= 0) { part.fireT = part.def.fire.every * (0.8 + rand() * 0.4); const a = Math.atan2(p.y - part.y, p.x - part.x), f = part.def.fire; bossShot(w, part.x, part.y, Math.cos(a) * f.speed, Math.sin(a) * f.speed, f.dmg, 'bolt'); } }
}

const wormPos = (t, y) => ({ x: Math.sin(t * 0.7) * 36, y: y + Math.sin(t * 1.15) * 16 + Math.cos(t * 0.4) * 6 });
function positionParts(w, boss, dt, spd = 1) {
  const b = boss.boss; let segIdx = 0;
  for (const e of b.parts) {
    if (!e.alive) { if (e.part.chain) segIdx++; continue; }
    const pd = e.part;
    if (pd.orbit) { const a = b.t * pd.speed + (e.partIdx / pd.n) * Math.PI * 2; e.x = boss.x + Math.cos(a) * pd.orbit; e.y = boss.y + Math.sin(a) * pd.orbit * 0.7; e.rot = a; }
    else if (pd.offsets) { e.x = boss.x + pd.offsets[e.partIdx][0]; e.y = boss.y + pd.offsets[e.partIdx][1]; }
    else if (pd.chain) { segIdx++; if (b.enter > 0) { e.x = boss.x; e.y = boss.y + segIdx * 7; } else { const q = wormPos((b.t - segIdx * 0.22 / spd) * spd, b.homeY); e.x = q.x; e.y = q.y; } }
    e.invuln = b.enter > 0;
  }
}

function attack(w, boss, a) {
  const p = w.player, b = boss.boss;
  switch (a.kind) {
    case 'aimed': { const base = Math.atan2(p.y - boss.y, p.x - boss.x); for (let i = 0; i < a.n; i++) { const ang = base + (a.n === 1 ? 0 : (i / (a.n - 1) - 0.5) * a.spread * 2); bossShot(w, boss.x, boss.y - boss.r * 0.6, Math.cos(ang) * a.speed, Math.sin(ang) * a.speed, 1.2, 'bolt'); } sfx(w, 'eshot'); break; }
    case 'ring': { const o = rand() * 6.28; for (let i = 0; i < a.n; i++) { const ang = o + (i / a.n) * Math.PI * 2; bossShot(w, boss.x, boss.y, Math.cos(ang) * a.speed, Math.sin(ang) * a.speed, 1, 'orb'); } sfx(w, 'ring'); break; }
    case 'spiral': b.spiral = { t: a.dur, acc: 0, rate: a.rate, arms: a.arms, speed: a.speed, ang: rand() * 6 }; sfx(w, 'ring'); break;
    case 'rain': for (let i = 0; i < a.n; i++) bossShot(w, (rand() - 0.5) * (FIELD.W - 8), FIELD.H + rand() * 20, 0, -a.speed * (0.8 + rand() * 0.4), 1, 'bolt'); break;
    case 'beam': for (let i = 0; i < a.cols; i++) { const x = i === 0 ? p.x : (rand() - 0.5) * (FIELD.W - 12); w.hazards.push({ kind: 'beam', src: null, anchor: boss, x, y: boss.y, t: 0, telegraph: a.telegraph, dur: a.dur, width: 8, dmg: 2.5 }); } sfx(w, 'charge'); break;
    case 'shell': for (let i = 0; i < a.n; i++) w.hazards.push({ kind: 'shell', x: i === 0 ? p.x : (rand() - 0.5) * (FIELD.W - 14), y: p.y, t: 0, telegraph: a.telegraph + i * 0.25, r: a.radius, dmg: 3 }); sfx(w, 'charge'); break;
    case 'summon': { let live = 0; for (const e of w.enemies) if (e.alive && !e.boss && !e.parent) live++; if (live > 18) break; for (let i = 0; i < a.n; i++) { const c = spawnEnemy(w, a.type, boss.x + (i - (a.n - 1) / 2) * 8, boss.y - boss.r, { state: 'free', vy: -14, vx: (i - (a.n - 1) / 2) * 5, reward: 0.25 }); if (c) { c.spawnT = 0.4; if (c.def.kamikaze) { c.state = 'dive'; c.aimX = p.x; } } } sfx(w, 'dive'); break; }
    case 'well': w.hazards.push({ kind: 'well', x: (rand() - 0.5) * 60, y: p.y, t: 0, dur: a.dur, pull: a.pull, src: null }); sfx(w, 'charge'); break;
    case 'hbeam': { // rows across the field: the first at the pilot's height, the rest far enough away to leave room
      const rows = [Math.max(12, Math.min(70, p.y))]; for (let k = 1; k < a.rows; k++) { let y; for (let tries = 0; tries < 8; tries++) { y = 12 + rand() * 58; if (rows.every((o) => Math.abs(o - y) > 20)) break; } rows.push(y); }
      for (const y of rows) w.hazards.push({ kind: 'hbeam', src: boss, y, t: 0, telegraph: a.telegraph, dur: a.dur, width: 6, dmg: 2.2 }); sfx(w, 'charge'); break; }
    case 'sweep': { const dir = p.x < boss.x ? 1 : -1, half = a.arc / 2; w.hazards.push({ kind: 'sweep', src: boss, x: boss.x, y: boss.y, a0: -Math.PI / 2 - dir * half, a1: -Math.PI / 2 + dir * half, t: 0, telegraph: a.telegraph, dur: a.dur, width: 5, dmg: 2.2 }); sfx(w, 'charge'); break; }
    case 'mines': for (let i = 0; i < a.n; i++) w.hazards.push({ kind: 'mine', x: (rand() - 0.5) * 80, y: boss.y - 10 - rand() * 20, vy: -9, t: 0, fuse: 4.5 + rand(), r: 9, dmg: 1.8 }); sfx(w, 'charge', 0.5); break;
    case 'wave': for (let s = 0; s < a.n; s++) { const x0 = boss.x + (s - (a.n - 1) / 2) * 12; for (let k = 0; k < 6; k++) { const bl = bossShot(w, x0, boss.y - boss.r - k * 3.2, 0, -a.speed, 1, 'orb'); if (bl) bl.wob = { a: 24, f: 4, p: k * 0.45 + s }; } } sfx(w, 'ring'); break;
    case 'split': { const base = Math.atan2(p.y - boss.y, p.x - boss.x); for (let i = 0; i < a.n; i++) { const ang = base + (a.n === 1 ? 0 : (i / (a.n - 1) - 0.5) * a.spread * 2), bl = bossShot(w, boss.x, boss.y - boss.r * 0.6, Math.cos(ang) * a.speed, Math.sin(ang) * a.speed, 1, 'orb', 1.8); if (bl) bl.split = { t: 1 + rand() * 0.3, n: 5, speed: 28 }; } sfx(w, 'ring'); break; }
    case 'gapwall': { const gx = Math.max(-38, Math.min(38, p.x + (rand() - 0.5) * 40)); for (let x = -48; x <= 48; x += 4.5) if (Math.abs(x - gx) > a.gap / 2) bossShot(w, x, boss.y - boss.r, 0, -a.speed, 1, 'bolt'); sfx(w, 'ring'); break; }
    case 'veil': b.veilT = a.dur; fx(w, 'boom', boss.x, boss.y, boss.r, b.def.color); sfx(w, 'teleport'); break;
    case 'ambush': { // flankers climb from behind, lungers burst from the walls, riftlings drop in to hover
      let live = 0; for (const e of w.enemies) if (e.alive && !e.boss && !e.parent) live++; if (live > 16) break;
      const pattern = a.type === 'flanker' ? 'rise' : a.type === 'lunger' ? 'lunge' : 'hover';
      for (const path of squadPaths(pattern, a.n, (rand() - 0.5) * 50, rand() < 0.5 ? -1 : 1, rand() * 6, rand, p)) { const e = spawnEnemy(w, a.type, path.x0 ?? 0, FIELD.H + 12, { state: 'path' }); if (e) { e.path = path; e.rewardMul = 0.3; } }
      break; }
    case 'teleport': fx(w, 'boom', boss.x, boss.y, boss.r, b.def.color); boss.x = (rand() - 0.5) * 66; fx(w, 'boom', boss.x, boss.y, boss.r, b.def.color); sfx(w, 'teleport'); break;
  }
}

bus.on('partDied', (w, part) => {
  const boss = part.parent; if (!boss?.alive) return;
  fx(w, 'shake', 0.3);
  if (part.part.shieldsParent && !boss.boss.parts.some((x) => x.alive && x.part.shieldsParent)) { fx(w, 'text', boss.x, boss.y - boss.r - 4, 'SHIELD DOWN', '#5ee6ff', 1); sfx(w, 'weak'); }
});
bus.on('bossDied', (w, boss) => { for (const part of boss.boss.parts) if (part.alive) { part.rewardMul = 0; part.alive = false; fx(w, 'die', part.x, part.y, part.r, part.color, 0); } for (const e of w.enemies) if (e.alive && !e.boss) { e.rewardMul *= 0.5; e.hp = 0; e.alive = false; fx(w, 'die', e.x, e.y, e.r, e.color, 0); } w.ebullets.length = 0; w.hazards.length = 0; });
