// The ship: steering (manual or autopilot), regeneration, Focus / streak / Energy upkeep, retaliation beam, target painting.
import { G, count, flag } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { BAL, FIELD } from '@last-orbit/data/balance.js';
import { fx, sfx, pickTarget, hitEnemy } from '@last-orbit/combat/world.js';
import { bestDps } from '@last-orbit/combat/abilities.js';
import { COUNTER_TOP } from '@last-orbit/data/counter.js';

const HALF = FIELD.W / 2 - 3.5;

export function updatePlayer(w, dt) {
  const p = w.player, inp = w.input, sh = G.sheet;
  inp.manualT += dt; p.sinceHit += dt;
  if (p.invuln > 0) p.invuln -= dt; if (p.fireFlash > 0) p.fireFlash -= dt;
  if (p.dashCd > 0) { p.dashCd -= dt; if (p.dashCd <= 0 && p.alive) { fx(w, 'dashReady', p.x, p.y); sfx(w, 'dashReady', 0.8); } } if (p.dashInv > 0) p.dashInv -= dt;
  if (w.paintT > 0) { w.paintT -= dt; if (w.paintT <= 0 || !w.painted?.alive) w.painted = null; }
  if (inp.tap) { paint(w, inp.tap.x, inp.tap.y); inp.tap = null; }
  if (!p.alive) return;
  const manual = inp.manualT < BAL.manualWindow;

  // ---- dodge dash: a quick burst sideways, briefly untouchable ----
  if (inp.dash) { const d = inp.dash; inp.dash = 0; if (!(p.dashCd > 0)) { p.dashDir = d; p.dodged = false; p.dashT = BAL.dashTime; p.dashCd = BAL.dashCd * sh.n('dashCd'); p.dashInv = BAL.dashInvuln; inp.manualT = 0; fx(w, 'dash', p.x, p.y, d); sfx(w, 'dash', 1); count('dashes'); } else sfx(w, 'deny', 0.5); }
  if (p.dashT > 0) {
    p.dashT -= dt; const x0 = p.x; p.x = Math.max(-HALF, Math.min(HALF, p.x + p.dashDir * BAL.dashSpeed * dt));
    p.vx = (p.x - x0) / Math.max(dt, 1e-4); p.tilt += (p.dashDir - p.tilt) * Math.min(1, 14 * dt); inp.targetX = p.x;
  }

  // ---- steering ----
  const speed = 62 * sh.n('moveSpeed'); let want = p.x;
  const dir = inp.keys || inp.hold || 0;
  if (p.dashT > 0) want = p.x;
  else if (inp.active || dir) { want = dir ? p.x + dir * 30 : inp.targetX; inp.manualT = 0; p.autoThinkT = 0; p.autoWantX = p.x; }
  else if (flag('f.autopilot') && w.wave.state === 'fighting') want = autopilot(w, p, sh.n('autoDodge'), dt);
  else { p.autoThinkT = 0; p.autoWantX = p.x; }
  const dx = Math.max(-HALF, Math.min(HALF, want)) - p.x, stepX = Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
  if (w.counter) { // Counterattack: the ship also flies up and down the lower half of the field
    const dirY = inp.keysY || 0, wantY = dirY ? p.y + dirY * 30 : inp.active && inp.targetY != null ? inp.targetY : flag('f.autopilot') && w.wave.state === 'fighting' ? autoY(w, p) : p.y;
    const dy = Math.max(FIELD.PLAYER_Y, Math.min(COUNTER_TOP, wantY)) - p.y; p.y += Math.sign(dy) * Math.min(Math.abs(dy), speed * 0.9 * dt);
  }
  p.x += stepX; p.vx = stepX / Math.max(dt, 1e-4); p.tilt += (Math.max(-1, Math.min(1, p.vx / 60)) - p.tilt) * Math.min(1, 10 * dt);

  // ---- active-play meters ----
  const fMax = sh.n('focusMax');
  if (manual && w.wave.state === 'fighting') p.focus = Math.min(fMax, p.focus + BAL.focusGain * sh.n('focusRate') * fMax * dt);
  else p.focus = Math.max(0, p.focus - BAL.focusDecay * fMax * dt);
  if (p.comboT > 0) p.comboT -= dt; else if (p.combo > 0) p.combo = Math.max(0, p.combo - dt * 0.5);
  p.energy = Math.min(sh.n('energyCap'), p.energy + sh.n('energyRegen') * dt);

  // ---- repairs ----
  const hr = sh.n('hullRegen');
  if (hr > 0 && p.hull < 1) {
    const before = p.hull; p.hull = Math.min(1, p.hull + hr * dt);
    if (p.hull > before) {
      p.repairFxT = Math.max(0, (p.repairFxT || 0) - dt);
      if (!p.repairFxT) { p.repairFxT = 0.24; fx(w, 'naniteRepair', p.x, p.y); }
    }
  } else p.repairFxT = 0;
  p.leechBudget = Math.min(0.08, (p.leechBudget ?? 0.08) + 0.08 * dt);
  if (w.base.hasShield && p.shield < 1 && (p.sinceHit > Math.max(0.5, sh.n('shieldDelay')) || flag('f.fireRegen'))) p.shield = Math.min(1, p.shield + sh.n('shieldRegen') * dt);

  // ---- retaliation beam: absorbed shield damage is thrown back ----
  if (p.retal >= 0.5) {
    const t = pickBiggest(w); if (t) {
      const src = { id: 'retal', dmg: bestDps().mul(5 * p.retal), critChance: 0, critMult: 1, color: 0x7aa2ff, shieldPierce: 1, armorPen: 0.5 };
      fx(w, 'beam', p.x, p.y + 4, t.x, t.y, 0x7aa2ff, 2.4, 0.3); sfx(w, 'rail', 0.7); hitEnemy(w, t, src, 1, t.x, t.y, true); p.retal = 0;
    }
  }
}

function pickBiggest(w) { let t = null, best = -Infinity; for (const e of w.enemies) { if (!e.alive || e.invuln || e.y > FIELD.TOP + 10) continue; const v = e.hpMax.log10() + Math.log10(Math.max(1e-6, e.hp)); if (v > best) { best = v; t = e; } } return t; }

function paint(w, x, y) {
  let best = null, bd = 1e9;
  for (const e of w.enemies) { if (!e.alive) continue; const d = Math.hypot(e.x - x, e.y - y) - e.r; if (d < 6 && d < bd) { bd = d; best = e; } }
  if (best) { w.painted = best; w.paintT = BAL.paintDur; count('targetsPainted'); bus.emit('targetPainted', best); fx(w, 'paint', best.x, best.y, best.r); sfx(w, 'paint', 0.6); w.input.manualT = 0; }
}

// ---- autopilot: pursue useful targets, but make deliberately imperfect evasive decisions. ----
// Basic Autopilot has a short last-second bullet reflex. Evasive Routines extends the
// prediction horizon, notices near misses / telegraphed hazards and reacts a little faster.
// Decisions are sampled rather than recomputed continuously so manual flying remains superior.
const CAND = [0, -4, 4, -8, 8, -13, 13, -19, 19, -27, 27];
/** The bot's height in Counterattack: low by default, and out of the way of horizontal beams and lungers. */
function autoY(w, p) {
  let want = 14;
  const bands = [];
  for (const h of w.hazards) if (h.kind === 'hbeam') bands.push([h.y, h.width / 2 + 5]);
  for (const e of w.enemies) if (e.alive && e.path?.kind === 'lunge') bands.push([e.path.y0, e.r + 5]);
  for (let tries = 0; tries < 4; tries++) { const hit = bands.find(([y, r]) => Math.abs(want - y) < r); if (!hit) break; want = hit[0] > 40 ? hit[0] - hit[1] - 2 : hit[0] + hit[1] + 2; }
  return Math.max(FIELD.PLAYER_Y, Math.min(COUNTER_TOP, want));
}

export function autopilot(w, p, dodge, dt) {
  dodge = Math.max(0, Math.min(3, Number(dodge) || 0));
  const t = pickTarget(w, null, null, 0); let desired = t ? t.x : 0;
  if (t && t.state === 'form') desired += (t.lastVx || 0) * 0.35;
  if (w.painted?.alive) desired = w.painted.x;
  desired = Math.max(-HALF, Math.min(HALF, desired));

  p.autoThinkT = (p.autoThinkT || 0) - dt;
  const reflexHorizon = 0.24 + dodge * 0.03;
  const urgent = danger(w, p, p.x, reflexHorizon, 0, true) >= 6;
  if (p.autoThinkT > 0 && !urgent && Number.isFinite(p.autoWantX)) return p.autoWantX;

  const horizon = 0.34 + dodge * 0.18;
  const count = dodge <= 0 ? 5 : dodge === 1 ? 7 : CAND.length;
  let bestX = desired, bestScore = Infinity;
  const previous = Number.isFinite(p.autoWantX) ? p.autoWantX : p.x;
  for (let i = 0; i < count; i++) {
    for (let pass = 0; pass < 2; pass++) {
      const origin = pass ? p.x : desired, x = Math.max(-HALF, Math.min(HALF, origin + CAND[i]));
      // Target alignment stays important. Research makes the AI increasingly willing to give up
      // a firing lane for survival, but never grants perfect movement.
      let score = Math.abs(x - desired) * (dodge ? 0.052 : 0.072) + Math.abs(x - p.x) * 0.018;
      score += Math.abs(x - previous) * 0.008; // hysteresis: avoid constant left/right twitching
      score += danger(w, p, x, horizon, dodge, false);
      if (score < bestScore) { bestScore = score; bestX = x; }
    }
  }

  p.autoWantX = bestX;
  p.autoThinkT = Math.max(0.08, 0.17 - dodge * 0.02);
  return bestX;
}
function danger(w, p, x, horizon, dodge, directOnly) {
  let d = 0; const B = w.ebullets, near = directOnly ? 0 : (dodge <= 0 ? 0.7 : 1.8 + dodge * 0.8);
  for (let i = 0; i < B.length; i++) {
    const b = B[i]; if (b.vy >= -0.01 || b.y < p.y - 2) continue;
    const tt = (b.y - p.y) / -b.vy; if (tt < 0 || tt > horizon) continue;
    const bx = b.x + b.vx * tt, gap = Math.abs(bx - x) - (p.r + b.r + 0.75), urgency = 1 + Math.max(0, horizon - tt) / Math.max(0.1, horizon);
    if (gap < 0) d += (7 + Math.min(6, Math.max(0, b.dmg) * 3)) * urgency;
    else if (near > 0 && gap < near) d += (near - gap) / near * (0.55 + dodge * 0.35) * urgency;
  }
  if (directOnly || dodge <= 0) return d;

  // Learned hazard awareness. Level 1 reacts to imminent telegraphs; later levels also
  // respect persistent hazards and close-range suicide/rocket threats.
  for (const h of w.hazards) {
    const left = Math.max(0, (h.telegraph || 0) - (h.t || 0));
    if (h.kind === 'beam' && left <= horizon + 0.12 && Math.abs(h.x - x) < h.width / 2 + p.r + 1) d += 7 + dodge;
    else if (h.kind === 'shell' && left <= horizon + 0.18 && Math.abs(h.x - x) < h.r + p.r + 1) d += 6 + dodge;
    else if (h.kind === 'mine' && h.y < p.y + 26 && Math.abs(h.x - x) < h.r + p.r + 1) d += 5 + dodge;
    else if (dodge >= 2 && h.kind === 'well' && Math.abs(h.x - x) < 8 + dodge) d += 2.5;
  }
  if (dodge >= 2) for (const e of w.enemies) {
    if (!e.alive) continue;
    if (e.homingRocket && e.y < p.y + 34 && Math.abs(e.x - x) < 7 + p.r) d += 4.5;
    else if (e.state === 'dive' && e.def.kamikaze && e.y < 52 && Math.abs(e.x - x) < 7 + p.r) d += dodge >= 3 ? 5 : 3;
  }
  return d;
}
