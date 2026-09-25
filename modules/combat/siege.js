// Station Siege in combat (rules in data/siege.js). The station's hull and shield, bombards in the formation shelling it,
// raiders diving past the ship at it, and the station's own systems fighting back. sim.js calls in at wave start,
// every fighting tick and at wave clear; enemies.js moves shells and raiders ('raid' state) and hands anything that
// reaches the defence line to stationHit. The station falling ends the sortie ('stationLost').
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { rand } from '@last-orbit/core/rng.js';
import { FIELD } from '@last-orbit/data/balance.js';
import { TIER_BY_N, SIEGE_DMG, siegeSystems } from '@last-orbit/data/siege.js';
import { fx, sfx, spawnEnemy, hitEnemy, killEnemy, pickTarget } from '@last-orbit/combat/world.js';
import { collectAll } from '@last-orbit/combat/pickups.js';

const GUNS = [[-38, 3], [38, 3]]; // the station's cannons, firing up from the bottom corners

export function initSiege(w) {
  const run = G.state.run, tier = TIER_BY_N[run.siege], sys = siegeSystems(G.state).on;
  w.siege = { tier, sys, hull: 1, shield: 0, gunCd: [0.6, 1.1], flakT: 2, pulseT: sys.x_phase || 0, raidT: tier.raidEvery, bossT: 3, beacon: !!sys.w_revive, hits: 0, won: false, over: false, first: true };
  run.siegeHull = 1;
}

/** A new wave: the shield recharges, some invaders become bombards, the station's guns load for this wave's foes. */
export function siegeWaveStart(w) {
  const s = w.siege; if (!s) return;
  s.shield = s.sys.w_shield || 0; s.raidT = s.tier.raidEvery * (0.5 + rand() * 0.4); s.bossT = 3;
  s.assault = w.wave.info?.boss ? 0 : s.tier.assault; s.bomberT = s.tier.bomberEvery * (0.3 + rand() * 0.4); // the boss wave lasts as long as the boss
  s.gun = { dmg: w.base.hp.mul(0.35 * (1 + (s.sys.x_charts || 0))), critChance: 0.05, critMult: 2, bossMul: 0.5, id: 'station', color: 0x7fe8ff };
  const cand = w.enemies.filter((e) => e.alive && e.slot && !e.boss && !e.parent && e.def.cost >= 1);
  for (let i = 0; i < s.tier.bombards && cand.length; i++) { const e = cand.splice(Math.floor(rand() * cand.length), 1)[0]; e.bombard = { t: s.tier.shellEvery * (0.25 + rand() * 0.4) }; }
  if (s.sys.w_barrier > 1) for (const b of w.barriers) b.hp = 1;
  if (s.first) { s.first = false; fx(w, 'siegeStart', s.tier.n, s.tier.name); }
}

/** Speed factor for a shell or raider: the tractor field drags shells near the station, the relay slows raiders. */
export function raidSpeed(w, e) {
  const s = w.siege; if (!s) return 1;
  if (e.siegeKind === 'raider') return 1 - (s.sys.w_reroll || 0);
  return e.y < 60 ? 1 - (s.sys.w_magnet || 0) : 1;
}

export function stepSiege(w, dt) {
  const s = w.siege; if (!s || s.over || s.won) return;
  const f = w.form;
  // bombards lob shells at the station once the formation has settled; a bombard glows as it loads (rendering)
  if (f.enter <= 0) for (const e of w.enemies) if (e.alive && e.bombard && e.state === 'form') { e.bombard.t -= dt; if (e.bombard.t <= 0) { e.bombard.t = s.tier.shellEvery * (0.8 + rand() * 0.4); launch(w, e.x, e.y - e.r, 'shell'); } }
  // the boss shells it too; raiders come in on their own between the formation's volleys
  let boss = null; for (const e of w.enemies) if (e.alive && e.boss && !e.parent) { boss = e; break; }
  if (boss && !(boss.boss.enter > 0)) { s.bossT -= dt; if (s.bossT <= 0) { s.bossT = Math.max(1.8, 3.8 - s.tier.n * 0.3); launch(w, boss.x + (rand() - 0.5) * boss.r, boss.y - boss.r, 'bossShell'); } }
  // the assault: until its time is up, raiders dive at the station and bombers cross the sky dropping shells
  else if (s.assault > 0) {
    s.assault -= dt;
    s.raidT -= dt; if (s.raidT <= 0) { s.raidT = s.tier.raidEvery * (0.8 + rand() * 0.4); raider(w); }
    s.bomberT -= dt; if (s.bomberT <= 0) { s.bomberT = s.tier.bomberEvery * (0.8 + rand() * 0.4); bomber(w); }
  }
  for (const e of w.enemies) if (e.alive && e.type === 'bomber' && Math.abs(e.x) < 44) { e.dropT -= dt; if (e.dropT <= 0) { e.dropT = s.tier.bomberDrop * (0.8 + rand() * 0.4); launch(w, e.x, e.y - e.r, 'shell'); } }
  // bunkers catch shells falling onto them
  if (w.barriers.length) for (const e of w.enemies) if (e.alive && e.state === 'raid' && e.siegeKind !== 'raider' && Math.abs(e.y - FIELD.BARRIER_Y) < 2.5) {
    const b = w.barriers.find((br) => br.hp > 0 && Math.abs(e.x - br.x) < br.w / 2); if (!b) continue;
    b.hp -= 0.34; b.flash = 0.15; e.rewardMul = 0; e.alive = false; fx(w, 'boom', e.x, e.y, 5, 0xff8a3d); sfx(w, 'boom', 0.5);
  }
  // the station's cannons: attackers nearest the station first, then the lowest invader
  s.gunCd.forEach((cd, i) => {
    const every = i ? s.sys.w_rate : s.sys.w_dmg; if (!every) return;
    s.gunCd[i] = cd - dt; if (s.gunCd[i] > 0) return;
    const [gx, gy] = GUNS[i], t = lowestRaid(w, null) || pickTarget(w, null, { x: gx, y: gy }, 115); if (!t) return;
    s.gunCd[i] = every; hitEnemy(w, t, s.gun, 1, t.x, t.y); fx(w, 'beam', gx, gy, t.x, t.y, 0x7fe8ff); sfx(w, 'laser', 0.3);
  });
  // point defence picks off the lowest shell
  if (s.sys.w_crit) { s.flakT -= dt; if (s.flakT <= 0) { const t = lowestRaid(w, 'shell', 75); if (t) { s.flakT = s.sys.w_crit; fx(w, 'beam', 0, 2, t.x, t.y, 0xffd27a); t.rewardMul = 0; killEnemy(w, t, null, false, 0); } } }
  // the phase coil: a pulse that clears the field of enemy fire and shells
  if (s.sys.x_phase) { s.pulseT -= dt; if (s.pulseT <= 0) { s.pulseT = s.sys.x_phase; let n = w.ebullets.length; w.ebullets.length = 0; for (const e of w.enemies) if (e.alive && e.state === 'raid' && e.siegeKind !== 'raider') { e.rewardMul = 0; e.alive = false; n++; } if (n) { fx(w, 'siegePulse'); sfx(w, 'teleport', 0.7); } } }
  G.state.run.siegeHull = s.hull;
}
/** The shell (or raider, kind null) closest to the station, optionally only below maxY. */
function lowestRaid(w, kind, maxY = 140) {
  let best = null; for (const e of w.enemies) if (e.alive && e.state === 'raid' && e.y < maxY && (!kind || (kind === 'shell' ? e.siegeKind !== 'raider' : e.siegeKind === kind)) && (!best || e.y < best.y)) best = e;
  return best;
}
/** A shell lobbed at a spot on the defence line well away from the ship (so it has to go and get it), on a straight
 *  diagonal; landX is where it will come down (the renderer draws the warning line to it). */
function launch(w, x, y, kind) {
  const px = w.player.x, vy = kind === 'bossShell' ? -17 : -13; let tx = (rand() - 0.5) * 84; if (Math.abs(tx - px) < 24) tx = px + (tx < px ? -24 : 24); if (Math.abs(tx) > 44) tx = px + (tx < px ? 24 : -24);
  const e = spawnEnemy(w, 'siegeshell', x, y, { state: 'raid', vy, vx: (tx - x) / Math.max(1, (y - FIELD.LAND_Y) / -vy) });
  if (e) { e.siegeKind = kind; e.rewardMul = 0; e.landX = tx; e.rot = Math.atan2(vy, e.vx); fx(w, 'boom', x, y, 3, 0xff8a3d); sfx(w, 'missile', 0.35); }
}
function bomber(w) {
  const dir = rand() < 0.5 ? 1 : -1, e = spawnEnemy(w, 'bomber', -dir * 60, 112 + rand() * 18, { state: 'free', vx: dir * (13 + w.siege.tier.n) });
  if (e) { e.dropT = 0.8 + rand() * 0.8; fx(w, 'text', -dir * 36, e.y - 6, 'BOMBER', '#ff9a4d', 1); sfx(w, 'hauler', 0.6); }
}
function raider(w) {
  const e = spawnEnemy(w, 'raider', (rand() - 0.5) * 72, FIELD.TOP + 6, { state: 'raid', vy: -24 - w.siege.tier.n * 1.5 });
  if (e) { e.siegeKind = 'raider'; e.rot = 0; e.landX = e.x; sfx(w, 'dive', 0.6); }
}

/** Something reached the defence line: a shell, a raider or an invader breaking through. */
export function stationHit(w, e) {
  e.rewardMul = 0; e.alive = false;
  hurtStation(w, SIEGE_DMG[e.siegeKind] ?? SIEGE_DMG.breach, e.x, e.siegeKind ? null : 'BREACH');
}
export function hurtStation(w, dmg, x, label) {
  const s = w.siege; if (!s || s.over || s.won) return;
  if (s.sys.w_speed && rand() < s.sys.w_speed) { fx(w, 'text', x, FIELD.LAND_Y + 4, 'MISS', '#9fe9ff', 0); fx(w, 'stationShield', x); return; }
  dmg /= 1 + (s.sys.w_hull || 0) + (s.sys.x_alloy || 0);
  if (s.shield > 0) { const a = Math.min(s.shield, dmg); s.shield -= a; dmg -= a; fx(w, 'stationShield', x); if (dmg <= 1e-6) { sfx(w, 'shield', 0.6); return; } }
  s.hull -= dmg; s.hits++; fx(w, 'stationHit', x, dmg); fx(w, 'shake', 0.35); sfx(w, 'boom', 0.8);
  if (label) fx(w, 'text', x, FIELD.LAND_Y + 4, label, '#ff4d7a', 1);
  if (s.hull <= 0) {
    if (s.beacon) { s.beacon = false; s.hull = s.sys.w_revive; fx(w, 'text', 0, 40, 'EMERGENCY BEACON', '#ffc857', 2); sfx(w, 'milestone'); }
    else { s.hull = 0; s.over = true; w.wave.state = 'over'; fx(w, 'stationDown'); fx(w, 'shake', 1.2); sfx(w, 'bossdie'); collectAll(w); bus.emit('sortieOver', 'stationLost'); }
  }
  G.state.run.siegeHull = Math.max(0, s.hull);
}

/** A wave held: repair crews patch the station, the crew quarters patch the ship. */
export function siegeWaveCleared(w) {
  const s = w.siege; if (!s) return;
  if (s.sys.w_regen) s.hull = Math.min(1, s.hull + s.sys.w_regen);
  if (s.sys.w_start) w.player.hull = Math.min(1, w.player.hull + s.sys.w_start);
  G.state.run.siegeHull = s.hull;
}
/** The tier's boss is down: the siege is won (the sortie ends after a short beat, in sim.js). */
export function siegeWon(w) { const s = w.siege; s.won = true; G.state.run.siegeWon = true; G.state.run.siegeHull = s.hull; w.wave.state = 'cleared'; w.wave.timer = 3; fx(w, 'siegeWon', s.tier.n); sfx(w, 'milestone'); }
export function siegeOver(w) { if (w.siege.over) return; w.siege.over = true; w.wave.state = 'over'; collectAll(w); bus.emit('sortieOver', 'cleared'); }

// The core siphon: elites and boss parts feed the station as they die.
bus.on('kill', (w, e) => { const s = w.siege; if (s && s.sys.x_siphon && !s.over && (e.elite || e.parent)) s.hull = Math.min(1, s.hull + s.sys.x_siphon); });
