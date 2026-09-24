// Scripted flight paths for Counterattack squads. Each enemy carries e.path = { kind, t, x0, y0, ... }; t starts
// negative for later squad members, so they queue off-screen and fly the same line one after another.
// movePath returns false once the enemy has left the field for good (it escapes without penalty).
import { FIELD } from '@last-orbit/data/balance.js';
import { GROUND_SPEED } from '@last-orbit/data/counter.js';

const TOP = FIELD.H + 12;
const ease = (k) => k * k * (3 - 2 * k);

export function movePath(e, dt, player) {
  const P = e.path; P.t += dt; const t = P.t;
  switch (P.kind) {
    case 'column': case 'vee': { // straight down, then peel away to the nearer side before the ship's airspace
      const u = Math.max(0, t), y = TOP - P.speed * u, wob = P.kind === 'vee' ? Math.sin(u * 1.3 + P.ph) * 5 : 0;
      if (y > 58) { e.x = P.x0 + wob; e.y = y; P.out ??= (P.x0 >= 0 ? 1 : -1); }
      else { e.x += P.out * 30 * dt; e.y -= P.speed * 0.45 * dt; }
      break; }
    case 'ground': e.x = P.x0; e.y = TOP - GROUND_SPEED * Math.max(0, t); break; // fixed to the scrolling city
    case 'skim': { // a fast pass low across the field
      const u = Math.max(0, t); e.x = -P.dir * 64 + P.dir * P.speed * u; e.y = P.y0 + Math.sin(u * 3 + P.ph) * 3; e.rot = P.dir * -0.4; break; }
    case 'sweep': { // in from one side high up, weaving across and slowly down
      const u = Math.max(0, t); e.x = -P.dir * 62 + P.dir * P.speed * u; e.y = P.y0 - u * 5 + Math.sin(u * 2.2 + P.ph) * 7; break; }
    case 'swirl': { // a spiral opening out from high centre
      const u = Math.max(0, t), a = P.ph + u * 1.7 * P.dir, r = 6 + u * 4.5; e.x = P.x0 + Math.cos(a) * r; e.y = P.y0 - u * 8 + Math.sin(a) * r * 0.45; break; }
    case 'hover': { // drop to a firing position, strafe, then peel away up and out to the side
      if (t < 0) { e.x = P.x0; e.y = TOP; break; }
      const arrive = 1.8;
      if (t < arrive) { e.x = P.x0; e.y = TOP + (P.yh - TOP) * ease(t / arrive); }
      else if (t < arrive + P.stay) { e.x = P.x0 + Math.sin((t - arrive) * 0.8 + P.ph) * 9; e.y = P.yh + Math.sin((t - arrive) * 1.6) * 2; }
      else { e.x += (P.x0 >= 0 ? 1 : -1) * 30 * dt; e.y += 12 * dt; } // peel away up and out
      break; }
    case 'rise': { // up from below and behind the ship, weaving, and out of the top
      const u = Math.max(0, t); e.x = P.x0 + Math.sin(u * 1.1 + P.ph) * 7; e.y = -14 + P.speed * u; e.rot = Math.PI; if (e.y > TOP + 6) return false; break; }
    case 'lunge': { // bursts from a wall at the pilot's height, holds while it telegraphs, then crosses at speed
      const edge = P.side * (P.edge ?? 47); if (t < 0) { e.x = P.side * 62; e.y = P.y0; break; }
      e.rot = P.side * Math.PI / 2; if (t < P.wait) { e.x += (edge - e.x) * Math.min(1, 6 * dt); e.y = P.y0 + Math.sin(t * 18) * 0.4; } else { e.x -= P.side * P.speed * dt; e.y = P.y0; } break; }
    case 'dive': { // fall on the pilot's position at launch, drifting after them a little
      if (t < 0) { e.x = P.x0; e.y = TOP; break; }
      e.y -= P.speed * dt; const dx = (player?.x ?? P.tx) - e.x; e.x += Math.sign(dx) * Math.min(Math.abs(dx), 9 * dt); e.rot += dt * 5; break; }
  }
  return !(t > 0.5 && (e.y < -14 || Math.abs(e.x) > 72)) && t < 45;
}

/** Per-member path settings for a squad of `n` using pattern `kind`. */
export function squadPaths(kind, n, x, dir, ph, rand, player) {
  const out = [];
  for (let i = 0; i < n; i++) {
    switch (kind) {
      case 'column': out.push({ kind, t: -i * 0.55, x0: x, speed: 24 }); break;
      case 'vee': { const k = i - (n - 1) / 2; out.push({ kind, t: -Math.abs(k) * 0.45, x0: x + k * 7, speed: 20, ph: ph + i }); break; }
      case 'sweep': out.push({ kind, t: -i * 0.4, dir, y0: 118 + rand() * 18, speed: 26, ph: ph + i * 0.4 }); break;
      case 'swirl': out.push({ kind, t: -i * 0.35, x0: x * 0.5, y0: 128, dir, ph: ph + (i / n) * Math.PI * 2 }); break;
      case 'hover': { const k = i - (n - 1) / 2; out.push({ kind, t: -i * 0.5, x0: Math.max(-38, Math.min(38, x + k * 22)), yh: 100 + rand() * 22, stay: 6 + rand() * 3, ph: ph + i }); break; }
      case 'dive': out.push({ kind, t: -i * 0.7, x0: x + (i - (n - 1) / 2) * 10, speed: 34, tx: x }); break;
      case 'ground': out.push({ kind, t: 0, x0: Math.max(-44, Math.min(44, x + (i - (n - 1) / 2) * 18)) }); break;
      case 'skim': out.push({ kind, t: -i * 0.3, dir, y0: 34 + rand() * 14, speed: 44, ph: ph + i }); break;
      case 'rise': out.push({ kind, t: -i * 0.8, x0: Math.max(-40, Math.min(40, x + (i - (n - 1) / 2) * 16)), speed: 22, ph: ph + i }); break;
      case 'lunge': { const side = i % 2 ? -dir : dir, y0 = Math.max(12, Math.min(68, (player?.y ?? 20) + (i ? (rand() < 0.5 ? -1 : 1) * 16 : 0))); out.push({ kind, t: -i * 1.4, side, y0, wait: 1.15, speed: 95 }); break; }
    }
  }
  return out;
}
export const PATTERNS = [['column', 5], ['vee', 5], ['sweep', 6], ['swirl', 6], ['hover', 3], ['dive', 3]];
