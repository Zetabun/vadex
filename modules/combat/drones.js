// Drones: autonomous helpers that hover around the ship. Bays come from state.run.drones.bays;
// boons and the Drone swarm ability add temporary attack drones on top.
import { G, flag } from '@last-orbit/core/game.js';
import { rand } from '@last-orbit/core/rng.js';
import { milestonesReached } from '@last-orbit/data/balance.js';
import { DRONES, DRONE_BASE, droneLevelMult } from '@last-orbit/data/drones.js';
import { fx, sfx, pickTarget, hitEnemy, killEnemy } from '@last-orbit/combat/world.js';
import { spawnShot, fireArc } from '@last-orbit/combat/weapons.js';

let cfgVersion = -1; const cfg = {};
/** Weapon-like configs for drone shots, rebuilt whenever the stat sheet changes. */
function configs() {
  const sh = G.sheet; if (cfgVersion === sh.version) return cfg; cfgVersion = sh.version;
  const L = G.state.run.drones.levels, crit = sh.f('f.droneCrit') > 0;
  const mk = (t, extra) => { const lvl = L[t] || 1, d = DRONES[t]; return { id: 'drone', type: t, color: d.color, dmg: sh.b('damage').mul(DRONE_BASE * (d.dmg || 1) * droneLevelMult(lvl, milestonesReached(lvl)) * sh.n('droneDmg')), critChance: crit ? sh.n('critChance') : 0, critMult: crit ? 1 + sh.n('critDmg') : 1, armorPen: sh.n('armorPen'), lvl, ...extra }; };
  cfg.attack = mk('attack', { kind: 'bolt', speed: 130, r: 0.8, life: 3 });
  cfg.missile = mk('missile', { kind: 'missile', speed: 55, r: 1.1, life: 5, homing: 4.5, retarget: 1, splash: DRONES.missile.splash * sh.n('blast') });
  return cfg;
}

/** Desired runtime roster: fitted bays + free boon drones. Temp (swarm) drones carry their own life. */
export function syncDrones(w) {
  const want = G.state.run.drones.bays.slice(0, Math.floor(G.sheet.n('droneBays')));
  for (let i = 0, n = G.sheet.f('f.freeDrone'); i < n; i++) want.push('attack');
  const keep = w.drones.filter((d) => d.temp);
  const perm = w.drones.filter((d) => !d.temp);
  const next = [];
  for (let i = 0; i < want.length; i++) { const old = perm.find((d) => d.type === want[i] && !d._used); if (old) { old._used = true; next.push(old); } else next.push(makeDrone(w, want[i])); }
  for (const d of next) delete d._used;
  w.drones = next.concat(keep); w.droneVersion = G.sheet.version; w.droneBays = want.join();
}
function makeDrone(w, type, life) { const p = w.player; return { type, x: p.x, y: p.y - 4, t: rand() * 10, cd: rand(), temp: !!life, life: life || 0, flash: 0, tx: 0, ty: 0 }; }
export function addSwarm(w, n, life) { for (let i = 0; i < n; i++) if (w.drones.length < 26) w.drones.push(makeDrone(w, 'attack', life)); }

export function updateDrones(w, dt) {
  const st = G.state, sh = G.sheet, p = w.player;
  if (w.droneVersion !== sh.version) syncDrones(w);
  const D = w.drones; if (!D.length) return;
  const c = configs(), n = D.length, fighting = w.wave.state === 'fighting' && p.alive, rate = sh.n('droneRate');
  for (let i = D.length - 1; i >= 0; i--) {
    const d = D[i]; d.t += dt; if (d.flash > 0) d.flash -= dt;
    if (d.temp) { d.life -= dt; if (d.life <= 0) { fx(w, 'hit', d.x, d.y, 0x66ffc2); D.splice(i, 1); continue; } }
    // loose arc formation around the ship, wider as the fleet grows
    const k = i - (n - 1) / 2, ring = Math.floor(Math.abs(k) / 4), ax = p.x + k * Math.min(7, 44 / n + 2.5) + Math.sin(d.t * 1.3 + i) * 1.2, ay = p.y + 9 + ring * 5 + Math.abs(k) * 0.9 + Math.cos(d.t * 1.7 + i * 2) * 1.2;
    d.x += (Math.max(-47, Math.min(47, ax)) - d.x) * Math.min(1, 5 * dt); d.y += (ay - d.y) * Math.min(1, 5 * dt);
    if (!fighting) continue;
    const def = DRONES[d.type]; d.cd -= dt * rate;
    switch (d.type) {
      case 'attack': case 'missile': {
        if (d.cd > 0) break; const cc = c[d.type];
        const tgt = pickTarget(w, null, d.type === 'attack' ? null : d); if (!tgt) { d.cd = 0.2; break; }
        d.cd = 1 / (def.rate * (1 + 0.02 * (cc.lvl - 1)));
        let mult = 1; if (flag('f.droneEnergy') && p.energy >= 1.5) { p.energy -= 1.5; mult = 2; }
        const ang = Math.atan2(tgt.y - d.y, tgt.x - d.x); d.flash = 0.08;
        spawnShot(w, cc, d.x, d.y + 1, ang, mult, 0, d.type === 'missile' ? tgt : null);
        if (rand() < 0.15) sfx(w, d.type === 'missile' ? 'missile' : 'laser', 0.25);
        if (d.type === 'attack') {
          const copy = sh.f('f.droneCopy'), first = copy && sh.weapons[st.run.equipped[0]];
          if (first && rand() < 0.5) mirror(w, d, first, tgt, copy * 2);
          if (flag('f.droneArc') && sh.weapons.tesla && rand() < cc.critChance) fireArc(w, sh.weapons.tesla, 0.5, d.x, d.y);
        }
        break; }
      case 'repair': { const lvl = st.run.drones.levels.repair || 1; if (p.alive && p.hull < 1) { p.hull = Math.min(1, p.hull + def.heal * (1 + 0.08 * (lvl - 1)) * dt); if (rand() < dt * 2) fx(w, 'trail', p.x + (rand() - 0.5) * 5, p.y + 2, 0x66ffc2); } break; }
      case 'shield': {
        if (d.cd > 0) break;
        for (let j = 0; j < w.ebullets.length; j++) { const b = w.ebullets[j]; if (b.alive && b.vy < 0 && b.y < p.y + 16 && Math.abs(b.x - p.x) < 9) { b.alive = false; fx(w, 'shieldhit', b.x, b.y); fx(w, 'beam', d.x, d.y, b.x, b.y, 0x7aa2ff, 0.5, 0.12); sfx(w, 'shield', 0.4); d.flash = 0.2; d.cd = def.block / (1 + 0.1 * ((st.run.drones.levels.shield || 1) - 1)); break; } }
        break; }
      case 'intercept': {
        if (d.cd > 0) break; let best = null, bd = 60 * 60;
        for (let j = 0; j < w.ebullets.length; j++) { const b = w.ebullets[j]; if (!b.alive || b.y > 80) continue; const dd = (b.x - p.x) ** 2 + (b.y - p.y) ** 2; if (dd < bd) { bd = dd; best = b; } }
        let rocket = null; for (const e of w.enemies) if (e.alive && e.homingRocket) { rocket = e; break; }
        if (rocket) { fx(w, 'beam', d.x, d.y, rocket.x, rocket.y, 0xff5fa2, 0.4, 0.1); fx(w, 'boom', rocket.x, rocket.y, 4, 0xff8a3d); rocket.rewardMul = 0; killEnemy(w, rocket, null, false, 0); }
        else if (best) { best.alive = false; fx(w, 'beam', d.x, d.y, best.x, best.y, 0xff5fa2, 0.4, 0.1); fx(w, 'hit', best.x, best.y, 0xff5fa2); }
        else { d.cd = 0.15; break; }
        d.flash = 0.1; d.cd = 1 / (def.rate * (1 + 0.1 * ((st.run.drones.levels.intercept || 1) - 1))); if (rand() < 0.3) sfx(w, 'laser', 0.2);
        break; }
    }
  }
}

/** Mirror protocol: an attack drone fires a weakened copy of the player's first weapon. */
function mirror(w, d, c, tgt, power) {
  const ang = Math.atan2(tgt.y - d.y, tgt.x - d.x);
  if (c.kind === 'bolt' || c.kind === 'orb' || c.kind === 'missile' || c.kind === 'mine') spawnShot(w, c, d.x, d.y + 1, ang, power, 0, c.kind === 'missile' ? tgt : null);
  else { hitEnemy(w, tgt, c, power * (c.kind === 'beam' ? 3 : 1), tgt.x, tgt.y); fx(w, c.kind === 'arc' ? 'arc' : 'beam', d.x, d.y, tgt.x, tgt.y, c.color, 0.5, 0.1); }
}
