// Enemy simulation: the marching formation, detached behaviours (dives, kamikaze, cruisers), auras, enemy fire and hazards.
import { G, count } from '@last-orbit/core/game.js';
import { rand } from '@last-orbit/core/rng.js';
import { BAL, FIELD } from '@last-orbit/data/balance.js';
import { ENEMIES } from '@last-orbit/data/enemies.js';
import { fx, sfx, spawnEnemy, spawnBullet, hurtPlayer, hitEnemy, killEnemy } from '@last-orbit/combat/world.js';
import { movePath } from '@last-orbit/combat/paths.js';
import { weave } from '@last-orbit/combat/anomalies.js';
import { raidSpeed, stationHit } from '@last-orbit/combat/siege.js';

const HALF = FIELD.W / 2;

export function updateFormation(w, dt) {
  const f = w.form; if (f.total <= 0) return;
  if (f.enter > 0) { f.enter = Math.max(0, f.enter - dt); return; }
  // classic: the fewer remain, the faster they march
  const thin = 1 + (1 - f.alive / Math.max(1, f.total)) * 1.6;
  const sp = f.speed * thin * w.sim.formSpeed * (w.wave.info?.mod?.formSpeed || 1);
  f.x += f.dir * sp * dt;
  if (f.x + f.maxOff > HALF - 4 && f.dir > 0) { f.dir = -1; f.y -= BAL.formStep; }
  else if (f.x + f.minOff < -HALF + 4 && f.dir < 0) { f.dir = 1; f.y -= BAL.formStep; }
  f.y -= 0.35 * dt * thin; // slow constant creep so stalemates always end
}

export function updateEnemies(w, dt) {
  const p = w.player, f = w.form, slow = w.slowT > 0 ? 0.35 : 1, stunAll = w.stunT > 0;
  const edt = dt * slow;
  let alive = 0, minOff = 1e9, maxOff = -1e9;
  w.auraT = (w.auraT || 0) - dt; const doAura = w.auraT <= 0; if (doAura) w.auraT = 0.25;
  if (doAura) for (const e of w.enemies) { e.shielded = false; e.buffed = false; }
  for (let i = w.enemies.length - 1; i >= 0; i--) {
    const e = w.enemies[i];
    if (!e.alive) { w.enemies[i] = w.enemies[w.enemies.length - 1]; w.enemies.pop(); continue; }
    const def = e.def; e.t += edt; if (e.flash > 0) e.flash -= dt; if (e.spawnT > 0) e.spawnT -= dt; if (e.droneMarkT > 0) e.droneMarkT = Math.max(0, e.droneMarkT - dt);
    const px = e.x;
    if (e.burnT > 0) { e.burnT -= dt; e.hp -= e.burn * dt; if (rand() < 0.1) fx(w, 'trail', e.x, e.y, 0xff8a3d); if (e.hp <= 0) { e.hp = 0; killEnemy(w, e, e.burnSrc, false, 0); continue; } }
    if (e.regen && e.hp < 1) e.hp = Math.min(1, e.hp + e.regen * dt);
    const stunned = stunAll || e.stunT > 0; if (e.stunT > 0) e.stunT -= dt;
    if (e.boss || e.parent) { alive++; continue; } // driven by bosses.js
    if (e.slot) { alive++; if (e.slot.x < minOff) minOff = e.slot.x; if (e.slot.x > maxOff) maxOff = e.slot.x; }
    if (def.blink && e.path && !stunned) { e.blinkT = (e.blinkT ?? def.blink.every * (0.5 + rand() * 0.5)) - edt; if (e.blinkT <= 0) { e.blinkT = def.blink.every; fx(w, 'boom', e.x, e.y, e.r * 0.9, def.color); const nx = Math.max(-40, Math.min(40, (e.path.x0 ?? e.x) + (rand() - 0.5) * 2 * def.blink.range)); if (e.path.x0 != null) e.path.x0 = nx; e.x = nx; fx(w, 'boom', e.x, e.y, e.r * 0.9, def.color); sfx(w, 'teleport', 0.4); } }
    if (def.stealth) { const cyc = def.stealth.on + def.stealth.off; e.cloaked = (e.t % cyc) < def.stealth.on && !stunned; e.visible = !e.cloaked; }

    if (!stunned) {
      if (e.state === 'form') {
        const wob = def.weave ? Math.sin(e.t * 1.7 + e.slot.y) * def.weave : 0;
        const ty = f.y - e.slot.y + f.enter * 45, tx = f.x + e.slot.x + wob;
        e.x += (tx - e.x) * Math.min(1, 10 * edt); e.y += (ty - e.y) * Math.min(1, 10 * edt);
        if (f.enter <= 0) {
          if (def.dive || def.kamikaze) { e.diveT += edt; const d = def.dive || def.kamikaze; if (e.diveT > d.every * (0.7 + (e.id % 7) * 0.1)) { e.diveT = 0; e.state = 'dive'; e.aimX = p.x; e.vy = 0; sfx(w, 'dive'); } }
          if (def.spawn) { e.diveT += edt; if (e.diveT > def.spawn.every && w.enemies.length < 90) { e.diveT = 0; const c = spawnEnemy(w, def.spawn.type, e.x + (rand() - 0.5) * 8, e.y - 5, { state: 'free', vy: -10, vx: (rand() - 0.5) * 14 }); if (c) { c.spawnT = 0.3; fx(w, 'hit', e.x, e.y - 4, e.color); } } }
        }
      } else if (e.state === 'dive') {
        const d = def.dive || def.kamikaze;
        if (def.kamikaze) { e.aimX += (p.x - e.aimX) * 1.5 * edt; }
        const dx = e.aimX - e.x; e.x += Math.sign(dx) * Math.min(Math.abs(dx), d.speed * 0.6 * edt) + Math.sin(e.t * 5) * 8 * edt * (def.dive ? 1 : 0);
        e.y -= d.speed * edt; e.rot += edt * 6;
        if (def.kamikaze && Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 1) { hurtPlayer(w, d.dmg, e); e.rewardMul = 0; killEnemy(w, e, null, false, 0); continue; }
        if (e.y < -8) { if (def.kamikaze) { e.rewardMul = 0; e.alive = false; continue; } e.y = FIELD.H + 10; e.state = 'form'; }
      } else if (e.state === 'path') { // Counterattack squads fly scripted lines and simply leave at the end
        if (!movePath(e, edt, p)) { e.rewardMul = 0; e.alive = false; continue; } alive++;
      } else if (e.state === 'raid') { // Station Siege: shells and raiders heading for the station (combat/siege.js)
        const k = raidSpeed(w, e); e.y += e.vy * k * edt; e.x += e.vx * k * edt + (e.siegeKind === 'raider' ? Math.sin(e.t * 2.6 + e.id) * 9 * edt : 0);
        if (e.x < -HALF + 3) e.x = -HALF + 3; if (e.x > HALF - 3) e.x = HALF - 3; alive++;
      } else { // free: swarmlings, split spawn, cruisers
        if (def.cruiser) { e.x += e.vx * edt; e.y += Math.sin(e.t * 2) * 3 * edt; if (Math.abs(e.x) > HALF + 14) { e.rewardMul = 0; e.alive = false; continue; } alive++; }
        else {
          e.x += e.vx * edt; e.y += e.vy * edt; e.vx *= 1 - 1.5 * edt; alive++;
          e.vy += ((-6 - (def.weave ? 3 : 0)) - e.vy) * edt; e.x += Math.sin(e.t * 2.3 + e.id) * (def.weave || 2) * edt;
          if (e.x < -HALF + 3) e.x = -HALF + 3; if (e.x > HALF - 3) e.x = HALF - 3;
        }
      }
      // landing: anything marching past the defence line costs hull and is gone
      if (w.counter) {
        // In Counterattack there is no line to defend: enemies that slip past just leave, but ramming the ship hurts.
        if (e.y < -12 && e.state !== 'path') { e.rewardMul = 0; e.alive = false; continue; }
        if (p.alive && Math.abs(e.x - p.x) < e.r + p.r && Math.abs(e.y - p.y) < e.r + p.r && Math.hypot(e.x - p.x, e.y - p.y) < e.r * e.scale + p.r * 0.8) {
          hurtPlayer(w, 1, e); if (!e.elite) { killEnemy(w, e, null, false, 0); continue; }
        }
      } else if (e.y < FIELD.LAND_Y && e.state !== 'dive' && !def.cruiser) { if (w.siege) stationHit(w, e); else { hurtPlayer(w, 0, e); landed(w, e); } continue; } // in a siege the station takes it
      if (def.fire && f.enter <= 0 && e.spawnT <= 0 && !(def.fire.onlyDiving && e.state !== 'dive') && !(w.counter && (e.y > FIELD.H - 2 || (e.y < p.y + 6 && !def.ground && def.fire.kind !== 'side')))) {
        e.fireT -= edt * w.sim.fireRate * (w.wave.fire || 1) * (w.wave.info?.mod?.fireRate || 1) * (e.buffed ? 1.6 : 1) * (e.elite?.fireRate || 1) * (e.overcharged ? 2 : 1);
        // aligned: hold fire until level with the ship (broadside gunships)
        if (e.fireT <= 0 && (!def.fire.aligned || Math.abs(e.y - p.y) < 3)) { e.fireT = def.fire.every * (0.75 + rand() * 0.5); if (!e.cloaked) enemyFire(w, e, def.fire); }
      }
    }
    e.lastVx = (e.x - px) / Math.max(dt, 1e-4);
    if (doAura && def.aura) applyAura(w, e, def.aura, dt);
  }
  f.alive = alive; if (alive && minOff < 1e9) { f.minOff = minOff - 4; f.maxOff = maxOff + 4; }
}

function landed(w, e) {
  const p = w.player; if (p.invuln <= 0 && !(w.abil.active.aegis > 0)) { p.hull -= BAL.landDamage; w.wave.damaged = true; fx(w, 'hurt', p.x, p.y); fx(w, 'shake', 0.6); fx(w, 'text', e.x, FIELD.LAND_Y + 4, 'BREACH', '#ff4d7a', 1); sfx(w, 'hurt');
    if (p.hull <= 0) hurtPlayer(w, 1e-9, e); }
  e.rewardMul = 0; e.alive = false;
}

function applyAura(w, src, aura) {
  const r2 = aura.radius * aura.radius;
  for (const o of w.enemies) {
    if (!o.alive || o === src) continue; const dx = o.x - src.x, dy = o.y - src.y; if (dx * dx + dy * dy > r2) continue;
    if (aura.kind === 'shield') { if (!o.def.aura) o.shielded = true; }
    else if (aura.kind === 'heal') { if (o.hp < 1) { o.hp = Math.min(1, o.hp + aura.value * 0.25); if (rand() < 0.3) fx(w, 'trail', o.x, o.y, 0x66ffc2); } }
    else if (aura.kind === 'buff') o.buffed = true;
  }
}

function enemyFire(w, e, fire) {
  const p = w.player;
  switch (fire.kind) {
    case 'bolt': weave(w, spawnBullet(w, e.x, e.y - e.r, 0, -fire.speed, fire.dmg, 'bolt')); break;
    case 'heavy': weave(w, spawnBullet(w, e.x, e.y - e.r, 0, -fire.speed, fire.dmg, 'heavy')); break;
    case 'aimed': case 'spread': { // a ship hidden in a nebula bank throws the aim off
      const a = Math.atan2(p.y - e.y, p.x - e.x) + (w.playerVeiled ? (rand() - 0.5) * 1.1 : 0);
      for (const o of fire.kind === 'spread' ? [-0.24, 0, 0.24] : [0]) spawnBullet(w, e.x, e.y - e.r, Math.cos(a + o) * fire.speed, Math.sin(a + o) * fire.speed, fire.dmg, 'bolt'); break; }
    case 'snipe': w.hazards.push({ kind: 'snipe', src: e, x: e.x, y: e.y, tx: p.x + (w.playerVeiled ? (rand() - 0.5) * 24 : 0), ty: p.y, t: 0, telegraph: fire.telegraph, speed: fire.speed, dmg: fire.dmg }); break;
    case 'beam': w.hazards.push({ kind: 'beam', src: e, x: e.x, y: e.y, t: 0, telegraph: fire.telegraph, dur: fire.dur, width: 7, dmg: fire.dmg }); break;
    case 'shell': w.hazards.push({ kind: 'shell', x: p.x + (rand() - 0.5) * 8, y: p.y, t: 0, telegraph: fire.telegraph, r: fire.radius, dmg: fire.dmg }); break;
    case 'side': for (const d of [-1, 1]) spawnBullet(w, e.x + d * e.r, e.y, d * fire.speed, -3, fire.dmg, 'bolt'); break; // broadsides: dodge up or down
    case 'mine': w.hazards.push({ kind: 'mine', x: e.x, y: e.y - e.r, vy: -(fire.drift || 7), t: 0, fuse: fire.fuse || 3.4, r: fire.radius || 8, dmg: fire.dmg }); break;
    case 'split': { const a = Math.atan2(p.y - e.y, p.x - e.x) + (w.playerVeiled ? (rand() - 0.5) * 1.1 : 0), b = spawnBullet(w, e.x, e.y - e.r, Math.cos(a) * fire.speed, Math.sin(a) * fire.speed, fire.dmg, 'orb', 1.7); if (b) b.split = { t: fire.fuse || 0.9, n: fire.n || 5, speed: fire.split || 30 }; break; }
    case 'wave': for (let k = 0; k < (fire.n || 5); k++) { const b = spawnBullet(w, e.x, e.y - e.r - k * 3.2, 0, -fire.speed, fire.dmg, 'orb'); if (b) b.wob = { a: 24, f: 4, p: k * 0.45 }; } break;
    case 'rocket': { const r = spawnEnemy(w, 'rocket', e.x, e.y - e.r, { state: 'free' }); if (r) { r.homingRocket = { speed: fire.speed, dmg: fire.dmg, life: 9 }; r.rewardMul = 0; } break; }
  }
  if (rand() < 0.3) sfx(w, 'eshot', 0.4);
}

export function updateRockets(w, dt) {
  const p = w.player, slow = w.slowT > 0 ? 0.35 : 1;
  for (const e of w.enemies) {
    const h = e.homingRocket; if (!h || !e.alive) continue;
    h.life -= dt; const a = Math.atan2(p.y - e.y, p.x - e.x); e.rot = a;
    e.vx += (Math.cos(a) * h.speed - e.vx) * 2 * dt; e.vy += (Math.sin(a) * h.speed - e.vy) * 2 * dt;
    e.x += e.vx * dt * slow; e.y += e.vy * dt * slow; if (rand() < 0.4) fx(w, 'trail', e.x, e.y, 0xff8a3d);
    if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) { hurtPlayer(w, h.dmg, e); fx(w, 'boom', e.x, e.y, 6, 0xff8a3d); e.alive = false; }
    else if (h.life <= 0 || e.y < -5) e.alive = false;
  }
}

export function updateBullets(w, dt) {
  const p = w.player, slow = w.slowT > 0 ? 0.35 : 1, B = w.ebullets, manual = w.input.manualT < BAL.manualWindow;
  for (let i = B.length - 1; i >= 0; i--) {
    const b = B[i]; b.x += b.vx * dt * slow; b.y += b.vy * dt * slow;
    if (b.wob) { b.wt = (b.wt || 0) + dt * slow; b.x += Math.cos(b.wt * b.wob.f + b.wob.p) * b.wob.a * dt * slow; } // snaking streams
    let dead = !b.alive || b.y < -6 || b.y > FIELD.H + 20 || Math.abs(b.x) > HALF + 10;
    if (!dead && b.split) { b.split.t -= dt * slow; if (b.split.t <= 0) { const o = rand() * 6.28; for (let k = 0; k < b.split.n; k++) { const a = o + (k / b.split.n) * 6.283; spawnBullet(w, b.x, b.y, Math.cos(a) * b.split.speed, Math.sin(a) * b.split.speed, b.dmg * 0.7, 'orb'); } fx(w, 'hit', b.x, b.y, 0xff5d8f); dead = true; } } // bursting orbs
    if (!dead && b.y < FIELD.BARRIER_Y + 3 && b.y > FIELD.BARRIER_Y - 3) for (const br of w.barriers) if (br.hp > 0 && Math.abs(b.x - br.x) < br.w / 2) { br.hp -= b.dmg * w.base.dmgPerBarrier; br.flash = 0.12; fx(w, 'hit', b.x, b.y, 0x7aa2ff); fx(w, 'boom', b.x, b.y, 2.2, 0x7aa2ff); dead = true; break; }
    if (!dead && p.alive) {
      const dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy, rr = p.r + b.r;
      if (d2 < rr * rr) { hurtPlayer(w, b.dmg, b); dead = true; }
      else if (!b.grazed && manual && d2 < BAL.grazeRadius * BAL.grazeRadius && b.y < p.y + 2) { b.grazed = true; count('grazes'); if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - BAL.dashGraze); p.energy = Math.min(G.sheet.n('energyCap'), p.energy + BAL.grazeEnergy); p.focus = Math.min(G.sheet.n('focusMax'), p.focus + 0.03); fx(w, 'text', p.x, p.y + 7, 'GRAZE', '#5ee6ff', 0); sfx(w, 'graze', 0.5); }
    }
    if (dead) { B[i] = B[B.length - 1]; B.pop(); }
  }
}

export function updateHazards(w, dt) {
  const p = w.player, H = w.hazards;
  for (let i = H.length - 1; i >= 0; i--) {
    const h = H[i]; if (!h) continue; // a boss death mid-loop can clear the list
    h.t += dt * (h.kind === 'pool' || h.kind === 'hole' ? 1 : (w.slowT > 0 ? 0.5 : 1)); let done = false;
    if (h.src && !h.src.alive && h.kind !== 'pool') { H.splice(i, 1); continue; }
    switch (h.kind) {
      case 'snipe': if (h.t >= h.telegraph) { const a = Math.atan2(h.ty - h.y, h.tx - h.x); spawnBullet(w, h.src.x, h.src.y, Math.cos(a) * h.speed, Math.sin(a) * h.speed, h.dmg, 'snipe', 1.3); sfx(w, 'snipe'); done = true; } else { h.x = h.src.x; h.y = h.src.y; } break;
      case 'beam': if (h.src) h.x = h.src.x; if (h.t >= h.telegraph) { if (!h.fired) { h.fired = true; sfx(w, 'ebeam'); } if (Math.abs(p.x - h.x) < h.width / 2 + p.r * 0.6) hurtPlayer(w, h.dmg * dt * 3, h); if (h.t >= h.telegraph + h.dur) done = true; } break;
      // Horizontal beam across the field at one height: get above or below it.
      case 'hbeam': if (h.t >= h.telegraph) { if (!h.fired) { h.fired = true; sfx(w, 'ebeam'); fx(w, 'shake', 0.25); } if (Math.abs(p.y - h.y) < h.width / 2 + p.r * 0.6) hurtPlayer(w, h.dmg * dt * 3, h); if (h.t >= h.telegraph + h.dur) done = true; } break;
      // A laser swinging from its source through an arc.
      case 'sweep': { if (h.src) { h.x = h.src.x; h.y = h.src.y - (h.src.r || 0) * 0.5; } const k = Math.max(0, Math.min(1, (h.t - h.telegraph) / h.dur)); h.ang = h.a0 + (h.a1 - h.a0) * k;
        if (h.t >= h.telegraph) { if (!h.fired) { h.fired = true; sfx(w, 'ebeam'); } const dx = p.x - h.x, dy = p.y - h.y, along = dx * Math.cos(h.ang) + dy * Math.sin(h.ang), perp = Math.abs(-dx * Math.sin(h.ang) + dy * Math.cos(h.ang)); if (along > 0 && perp < h.width / 2 + p.r * 0.6) hurtPlayer(w, h.dmg * dt * 3, h); }
        if (h.t >= h.telegraph + h.dur) done = true; break; }
      // Drifting proximity mine: arms when the ship comes close, or blows when its fuse runs out.
      case 'mine': { h.y += h.vy * dt; const d = Math.hypot(p.x - h.x, p.y - h.y); if (!h.arm && d < h.r + 3) { h.arm = h.t + 0.55; sfx(w, 'charge', 0.5); }
        if (h.t >= h.fuse || (h.arm && h.t >= h.arm)) { fx(w, 'boom', h.x, h.y, h.r, 0xffb070); sfx(w, 'boom', 0.6); if (d < h.r + p.r) hurtPlayer(w, h.dmg, h); done = true; } else if (h.y < -10) done = true; break; }
      case 'shell': if (h.t >= h.telegraph) { fx(w, 'boom', h.x, h.y, h.r, 0xffa94d); fx(w, 'shake', 0.3); sfx(w, 'boom', 0.8); if (Math.hypot(p.x - h.x, p.y - h.y) < h.r + p.r) hurtPlayer(w, h.dmg, h); done = true; } break;
      case 'well': { const dx = h.x - p.x; p.x += Math.sign(dx) * Math.min(Math.abs(dx), h.pull * dt); if (Math.abs(dx) < 6) hurtPlayer(w, 1.5 * dt, h); if (h.t >= h.dur) done = true; break; }
      case 'pool': h.tick -= dt; if (h.tick <= 0) { h.tick = 0.4; for (const e of w.enemies) if (e.alive && Math.hypot(e.x - h.x, e.y - h.y) < h.r + e.r) hitEnemy(w, e, h.src, h.mult * 0.12, e.x, e.y, true); } if (h.t >= h.dur) done = true; break;
      case 'hole': { for (const e of w.enemies) { if (!e.alive || e.boss || e.parent) continue; const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) + 0.01; if (d < 70) { const pull = 40 * dt; if (e.slot) { e.slot.x += (dx / d) * pull * 0.5; } e.x += (dx / d) * pull; e.y += (dy / d) * pull; } }
        h.tick -= dt; if (h.tick <= 0) { h.tick = 0.25; for (const e of w.enemies) if (e.alive && Math.hypot(e.x - h.x, e.y - h.y) < 16 + e.r) hitEnemy(w, e, h.src, h.mult, e.x, e.y, true); } if (h.t >= h.dur) done = true; break; }
    }
    if (done) H.splice(i, 1);
  }
}
