// Player weapons. Each equipped weapon config (built in progression/stats.js) fires on its own cooldown.
// Projectile kinds share one pooled "shot" entity; rail / arc / beam resolve instantly.
import { G, count, flag } from '@last-orbit/core/game.js';
import { rand } from '@last-orbit/core/rng.js';
import { FIELD } from '@last-orbit/data/balance.js';
import { fx, sfx, hitEnemy, blast, pickTarget, bucketOf } from '@last-orbit/combat/world.js';
import { momentumMul } from '@last-orbit/combat/passives.js';

const MAX_SHOTS = 340;
const tmpSkip = [];

// Keep live weapon cadence in sync with stat/evolution changes made while combat is running.
// Damage and behaviour configs are read from G.sheet every tick already; this additionally preserves
// the fraction of the current cooldown when fire rate changes and makes a newly fitted/evolved
// weapon use its new firing behaviour on the very next volley rather than after a stale timer.
function syncWeaponRuntime(w, sh) {
  if (w.weaponSheetVersion === sh.version) return;
  const prev = w.weaponRuntime || {}, next = {};
  for (const id in sh.weapons) {
    const c = sh.weapons[id], p = prev[id];
    const behavior = [c.kind, c.proj || 1, c.pierce || 0, c.bounce || 0, c.split || 0, c.targets || 0, c.chains || 0, c.returnShot || 0, c.column || 0, c.pool || 0, c.homing || 0, c.fuse || 0].join('|');
    if (p && (w.wt[id] ?? 0) > 0 && p.rate > 0 && c.rate > 0) w.wt[id] *= p.rate / c.rate;
    if (!p || p.behavior !== behavior) w.wt[id] = 0;
    next[id] = { rate: c.rate, behavior };
  }
  w.weaponRuntime = next;
  w.weaponSheetVersion = sh.version;
}

export function updateWeapons(w, dt) {
  const p = w.player, sh = G.sheet, cfgs = sh.weapons;
  syncWeaponRuntime(w, sh);
  const firing = p.alive && w.wave.state === 'fighting' && (w.input.fire || flag('f.autofire'));
  const od = (w.abil.active.overdrive > 0 ? 2 : 1) * momentumMul(p);
  for (const id in cfgs) {
    const c = cfgs[id];
    w.wt[id] = (w.wt[id] ?? 0) - dt * od;
    if (c.kind === 'beam') { if (firing) beamTick(w, c, dt * od); else w.beamRamp = 0; continue; }
    if (!firing) { if (w.wt[id] < 0) w.wt[id] = 0; continue; }
    let guard = 0;
    while (w.wt[id] <= 0 && guard++ < 4) {
      w.wt[id] += 1 / c.rate;
      let reps = 1;
      if (rand() < sh.f('f.burst')) reps++;
      if (rand() < sh.f('f.echo')) reps++;
      const v = (w.volleys[id] = (w.volleys[id] || 0) + 1);
      if (sh.f('f.setVolley') && v % 5 === 0) reps++;
      for (let r = 0; r < reps; r++) volley(w, c, v, r * 1.6);
      if (w.chargeShots > 0) w.chargeShots--;
    }
  }
  updateShots(w, dt);
}

function volley(w, c, v, yOff) {
  const p = w.player; w.wave.shotsFired++; count('shots', c.proj || 1); p.fireFlash = 0.06;
  let mult = 1; let over = false;
  if (c.nth && v % c.nth === 0) { mult *= c.nthMult; over = true; }
  if (w.chargeShots > 0) mult *= 6 * G.sheet.n('abilityPower');
  if (c.kind === 'rail') return fireRail(w, c, mult);
  if (c.kind === 'arc') return fireArc(w, c, mult, p.x, p.y + 4);
  const n = Math.max(1, Math.floor(c.proj));
  const assist = G.sheet.n('aimAssist'), tgt = (assist > 0 || c.kind === 'missile') ? pickTarget(w) : null;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2);
    let ang = Math.PI / 2 - off * (c.kind === 'missile' ? 0.22 : 0.05);
    if (tgt && assist > 0 && c.kind !== 'missile' && c.kind !== 'mine') {
      let tx = tgt.x, ty = tgt.y;
      if (flag('f.predict')) { const tt = Math.hypot(tx - p.x, ty - p.y) / c.speed; tx += (tgt.lastVx || 0) * tt; }
      const want = Math.atan2(ty - p.y, tx - p.x), lim = assist * 0.11;
      ang = Math.max(Math.PI / 2 - lim, Math.min(Math.PI / 2 + lim, want)) - off * 0.035;
    }
    spawnShot(w, c, p.x + off * 2.4, p.y + 4 + yOff, ang, mult, over ? 3 : 0, c.kind === 'missile' ? tgt : null);
  }
  sfx(w, c.kind === 'missile' ? 'missile' : c.kind === 'orb' ? 'plasma' : c.kind === 'mine' ? 'mine' : c.id === 'laser' ? 'laser' : 'cannon');
}

export function spawnShot(w, c, x, y, ang, mult, extraPierce, target, mini) {
  if (w.shots.length >= MAX_SHOTS) return null;
  const sp = c.speed * (mini ? 1.2 : 1);
  const s = { x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, c, mult, pierce: (c.pierce || 0) + extraPierce, bounce: c.bounce || 0, hit: [], target, life: c.life || 6, kind: c.kind, r: (c.r || 1) * (mini ? 0.7 : 1) * (extraPierce ? 1.6 : 1), mini: !!mini, ret: c.returnShot ? 1 : 0, big: !!extraPierce, alive: true, ang };
  w.shots.push(s); return s;
}

function updateShots(w, dt) {
  const shots = w.shots;
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i], c = s.c;
    s.life -= dt;
    if (c.homing && s.life < (c.life || 6) - 0.15) {
      if (!s.target || !s.target.alive) s.target = (c.retarget || s.kind === 'mine') ? pickTarget(w, null, s, s.kind === 'mine' ? 40 : 0) : (s.target ? null : pickTarget(w));
      if (s.target) {
        const want = Math.atan2(s.target.y - s.y, s.target.x - s.x); let d = want - s.ang;
        while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        s.ang += Math.max(-c.homing * dt, Math.min(c.homing * dt, d));
        const sp = c.speed * (s.kind === 'missile' ? Math.min(1.8, 0.6 + ((c.life || 6) - s.life) * 1.2) : 1);
        s.vx = Math.cos(s.ang) * sp; s.vy = Math.sin(s.ang) * sp;
      }
    }
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.kind === 'missile' && rand() < 0.5) fx(w, 'trail', s.x, s.y, 0xff8a3d);
    // returning shots flip at the top of the field
    if (s.ret && s.y > FIELD.TOP + 4) { s.ret = 0; s.vy = -Math.abs(s.vy); s.hit.length = 0; s.y = FIELD.TOP + 4; }
    let dead = s.life <= 0 || s.y > FIELD.H + 12 || s.y < -6 || s.x < -62 || s.x > 62;
    if (dead && s.kind === 'mine' && s.life <= 0) detonate(w, s, null);
    if (!dead) {
      const bucket = w.buckets[bucketOf(s.x)], fuse = s.kind === 'mine' ? 3 * (c.fuse || 1) : 0;
      for (let k = 0; k < bucket.length; k++) {
        const e = bucket[k]; if (!e.alive || (e.cloaked && !e.visible) || s.hit.indexOf(e.id) >= 0) continue;
        const dx = e.x - s.x, dy = e.y - s.y, rr = e.r + s.r + fuse;
        if (dx * dx + dy * dy < rr * rr) { if (onHit(w, s, e)) { dead = true; break; } }
      }
    }
    if (dead) { s.alive = false; shots[i] = shots[shots.length - 1]; shots.pop(); }
  }
}

/** Returns true if the shot is consumed. */
function onHit(w, s, e) {
  const c = s.c;
  if (e.part?.blocker && e.armour >= 0.9 && !(c.armorPen >= 1)) { fx(w, 'hit', s.x, s.y, 0x888888); hitEnemy(w, e, c, s.mult, s.x, s.y); return true; }
  const hpBefore = e.hp, wasCrit = w._lastCrit;
  if (c.column) { for (const o of w.enemies) if (o.alive && o !== e && Math.abs(o.x - e.x) < o.r + 1.5 && s.hit.indexOf(o.id) < 0) { hitEnemy(w, o, c, s.mult * 0.6, o.x, o.y); } fx(w, 'beam', e.x, e.y, e.x, FIELD.TOP + 10, c.color, 0.8, 0.1); }
  const frac = hitEnemy(w, e, c, s.mult * (s.mini ? 0.4 : 1), s.x, s.y);
  fx(w, 'hit', s.x, s.y, c.color);
  if (c.burn && e.alive) { e.burn = Math.max(e.burn, (frac / Math.max(1e-9, 1)) * c.burn / 3); e.burnT = 3; e.burnSrc = c; }
  if (c.splash) detonate(w, s, e);
  else if (c.critExplode && frac > 0 && rand() < c.critChance) blast(w, s.x, s.y, c.critExplode, c, s.mult * 0.5, e);
  s.hit.push(e.id);
  if (s.pierce > 0) { s.pierce--; return false; }
  if (s.bounce > 0) {
    s.bounce--; tmpSkip.length = 0;
    let best = null, bd = 50 * 50; for (const o of w.enemies) { if (!o.alive || s.hit.indexOf(o.id) >= 0 || o.cloaked) continue; const d = (o.x - s.x) ** 2 + (o.y - s.y) ** 2; if (d < bd) { bd = d; best = o; } }
    if (best) { const a = Math.atan2(best.y - s.y, best.x - s.x), sp = Math.hypot(s.vx, s.vy); s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp; s.ang = a; s.ret = 0; return false; }
  }
  return true;
}

function detonate(w, s, direct) {
  const c = s.c; let radius = c.splash * (s.mini ? 0.6 : 1);
  if (c.critSplash && rand() < c.critChance) radius *= c.critSplash;
  blast(w, s.x, s.y, radius, c, s.mult * (s.mini ? 0.4 : 1) * 0.8, direct);
  if (c.pool && !s.mini) w.hazards.push({ kind: 'pool', x: s.x, y: s.y, r: radius * 0.8, t: 0, dur: c.pool, src: c, mult: s.mult, tick: 0 });
  if (c.split && !s.mini) for (let i = 0; i < c.split; i++) spawnShot(w, c, s.x, s.y, s.ang + (i - (c.split - 1) / 2) * 0.9 + (rand() - 0.5) * 0.4, s.mult, 0, null, true);
}

function lineHit(w, c, x1, y1, x2, y2, width, mult) {
  const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy; let n = 0;
  for (let i = w.enemies.length - 1; i >= 0; i--) {
    const e = w.enemies[i]; if (!e || !e.alive) continue;
    const t = Math.max(0, Math.min(1, ((e.x - x1) * dx + (e.y - y1) * dy) / len2)), px = x1 + dx * t, py = y1 + dy * t;
    const d = Math.hypot(e.x - px, e.y - py);
    if (d < e.r + width / 2) { hitEnemy(w, e, c, mult, px, e.y - e.r * 0.5); n++; }
  }
  return n;
}
function fireRail(w, c, mult) {
  const p = w.player, n = Math.max(1, c.proj || 1);
  lineHit(w, c, p.x, p.y + 4, p.x, FIELD.H + 10, c.width, mult);
  fx(w, 'beam', p.x, p.y + 4, p.x, FIELD.H + 10, c.color, c.width * 0.7, 0.22); fx(w, 'shake', 0.12); sfx(w, 'rail');
  for (let i = 1; i < n; i++) {
    const t = pickTarget(w); if (!t) break;
    const a = Math.atan2(t.y - p.y, t.x - p.x), x2 = p.x + Math.cos(a) * 220, y2 = p.y + Math.sin(a) * 220;
    lineHit(w, c, p.x, p.y + 4, x2, y2, c.width, mult * 0.7); fx(w, 'beam', p.x, p.y + 4, x2, y2, c.color, c.width * 0.5, 0.2);
  }
}
/** Chain lightning from (x,y). Also used by drone Arc relay. */
export function fireArc(w, c, mult, x, y) {
  const arcs = Math.max(1, c.proj || 1); tmpSkip.length = 0; let any = false;
  for (let a = 0; a < arcs; a++) {
    let from = { x, y }, m = mult, first = pickTarget(w, tmpSkip, null, 0);
    if (!first || Math.hypot(first.x - x, first.y - y) > c.range * 2.2) break;
    let cur = first;
    for (let j = 0; j <= c.chains && cur; j++) {
      fx(w, 'arc', from.x, from.y, cur.x, cur.y, c.color); any = true;
      if (c.stun && rand() < c.stun && !cur.boss) cur.stunT = 1.5;
      hitEnemy(w, cur, c, m, cur.x, cur.y);
      tmpSkip.push(cur); from = cur; m *= c.chainFall >= 1 ? c.chainFall : c.chainFall;
      let best = null, bd = 30 * 30;
      for (const o of w.enemies) { if (!o.alive || tmpSkip.indexOf(o) >= 0 || (o.cloaked && !flag('f.scanStealth'))) continue; const d = (o.x - from.x) ** 2 + (o.y - from.y) ** 2; if (d < bd) { bd = d; best = o; } }
      cur = best;
    }
  }
  if (any) sfx(w, 'arc');
}
function beamTick(w, c, dt) {
  const p = w.player; w.beamT = (w.beamT || 0) - dt;
  w.beamTargets = w.beamTargets || [];
  const tg = w.beamTargets; tmpSkip.length = 0;
  for (let i = 0; i < c.targets; i++) {
    if (!tg[i] || !tg[i].e.alive || tg[i].e.cloaked) { const e = pickTarget(w, tmpSkip.concat(tg.filter(Boolean).map((t) => t.e))); tg[i] = e ? { e, ramp: 0 } : null; }
    if (tg[i]) { tmpSkip.push(tg[i].e); tg[i].ramp = Math.min(1, tg[i].ramp + dt / c.rampTime); fx(w, 'beam', p.x + (i - (c.targets - 1) / 2) * 3, p.y + 5, tg[i].e.x, tg[i].e.y, c.color, 0.6 + tg[i].ramp * 1.2, 0.05); }
  }
  tg.length = c.targets;
  if (w.beamT > 0) return; w.beamT += 1 / c.rate; if (w.beamT < -0.2) w.beamT = 0;
  for (const t of tg) if (t) hitEnemy(w, t.e, c, 1 + (c.ramp - 1) * t.ramp, t.e.x, t.e.y, !c.critTicks);
  if (rand() < 0.2) sfx(w, 'beam', 0.4);
}
