// Active abilities: cooldowns, charges and effects. Automation calls the same useAbility() the buttons do.
import { Big } from '@last-orbit/core/big.js';
import { G, count } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { rand } from '@last-orbit/core/rng.js';
import { FIELD } from '@last-orbit/data/balance.js';
import { ABILITIES } from '@last-orbit/data/abilities.js';
import { fx, sfx, hitEnemy, blast, pickTarget } from '@last-orbit/combat/world.js';
import { spawnShot } from '@last-orbit/combat/weapons.js';
import { addSwarm } from '@last-orbit/combat/drones.js';

export const abilityCooldown = (id) => ABILITIES[id].cd * Math.max(0.25, G.sheet.n('abilityCd'));
export const abilityMaxCharges = () => Math.max(1, Math.floor(G.sheet.n('abilityCharges')));
/** Sustained damage per second of the strongest equipped weapon: the yardstick ability damage is measured in. */
export function bestDps() {
  let best = Big.ZERO; const ws = G.sheet.weapons;
  for (const id in ws) { const c = ws[id], d = c.dmg.mul(c.rate * (c.kind === 'rail' || c.kind === 'arc' || c.kind === 'beam' ? 1 : Math.max(1, c.proj || 1)) * (1 + c.critChance * (c.critMult - 1))); if (d.gt(best)) best = d; }
  return best;
}
export function abilityReady(w, id) { const a = w.abil; return (a.charges[id] ?? abilityMaxCharges()) > 0 && w.player.alive && w.wave.state === 'fighting'; }

export function useAbility(w, id, auto) {
  const def = ABILITIES[id]; if (!def || !abilityReady(w, id)) return false;
  const a = w.abil, p = w.player, power = G.sheet.n('abilityPower'), dps = bestDps();
  a.charges[id] = (a.charges[id] ?? abilityMaxCharges()) - 1; if (!(a.cd[id] > 0)) a.cd[id] = abilityCooldown(id);
  count('abilitiesUsed'); bus.emit('abilityUsed', id, !!auto); if (!auto) w.input.manualT = 0;
  fx(w, 'ability', id, def.color); sfx(w, 'ability');
  switch (id) {
    case 'overdrive': a.active.overdrive = def.dur; break;
    case 'emp': {
      for (const b of w.ebullets) fx(w, 'hit', b.x, b.y, 0x5ee6ff); w.ebullets.length = 0;
      for (let i = w.hazards.length - 1; i >= 0; i--) { const k = w.hazards[i].kind; if (k !== 'pool' && k !== 'hole') w.hazards.splice(i, 1); }
      w.stunT = def.dur * Math.sqrt(power); fx(w, 'boom', p.x, p.y + 40, 90, 0x5ee6ff); fx(w, 'shake', 0.5);
      const src = { id: 'emp', dmg: dps.mul(2 * power), critChance: 0, critMult: 1, color: 0x5ee6ff, shieldPierce: 1 };
      for (let i = w.enemies.length - 1; i >= 0; i--) { const e = w.enemies[i]; if (e && e.alive && e.y < FIELD.H) hitEnemy(w, e, src, 1, e.x, e.y, true); }
      break; }
    case 'barrage': {
      const c = { id: 'barrage', kind: 'missile', color: 0xff8a3d, dmg: dps.mul(1.6 * power), critChance: G.sheet.n('critChance'), critMult: 1 + G.sheet.n('critDmg'), speed: 62, r: 1.5, life: 6, homing: 5, retarget: 1, splash: 9 * G.sheet.n('blast'), armorPen: 0.5 };
      for (let i = 0; i < 14; i++) { const s = spawnShot(w, c, p.x + (i - 6.5) * 1.5, p.y + 4, Math.PI / 2 + (i - 6.5) * 0.14, 1, 0, pickTarget(w)); if (s) s.life += i * 0.05; }
      sfx(w, 'missile', 1); break; }
    case 'aegis': a.active.aegis = def.dur * Math.sqrt(power); p.shield = 1; break;
    case 'strike': {
      let t = w.wave.boss && w.wave.boss.alive && !w.wave.boss.invuln ? w.wave.boss : null, best = -1;
      if (!t) for (const e of w.enemies) { if (!e.alive || e.invuln || e.y > FIELD.H) continue; const v = e.hpMax.log10() + Math.log10(Math.max(1e-6, e.hp)); if (v > best) { best = v; t = e; } }
      if (!t) { a.charges[id]++; return false; }
      const src = { id: 'strike', dmg: dps.mul(10 * power * G.sheet.n('weakMult')), critChance: 1, critMult: 1 + G.sheet.n('critDmg'), color: 0xff4d7a, armorPen: 1, shieldPierce: 1 };
      fx(w, 'beam', t.x, FIELD.H + 20, t.x, t.y, 0xff4d7a, 5, 0.5); fx(w, 'shake', 0.8); sfx(w, 'rail', 1);
      hitEnemy(w, t, src, 1, t.x, t.y); blast(w, t.x, t.y, 12 * G.sheet.n('blast'), { ...src, dmg: src.dmg.mul(0.15) }, 1, t);
      break; }
    case 'slow': w.slowT = def.dur * Math.sqrt(power); break;
    case 'swarm': addSwarm(w, 6, def.dur * Math.sqrt(power)); break;
    case 'hole': {
      let sx = 0, sy = 0, n = 0; for (const e of w.enemies) if (e.alive && !e.boss && e.y < FIELD.H) { sx += e.x; sy += e.y; n++; }
      const hx = n ? sx / n : 0, hy = n ? Math.max(60, sy / n) : 100;
      w.hazards.push({ kind: 'hole', x: hx, y: hy, t: 0, dur: def.dur, tick: 0, mult: 1, src: { id: 'hole', dmg: dps.mul(0.6 * power), critChance: 0, critMult: 1, color: 0xc77dff, shieldPierce: 1 } });
      break; }
    case 'charge': w.chargeShots = 12; break;
  }
  return true;
}

export function updateAbilities(w, dt) {
  const a = w.abil, p = w.player, max = abilityMaxCharges();
  for (const id in a.cd) {
    if ((a.charges[id] ?? max) >= max) { a.cd[id] = 0; continue; }
    a.cd[id] -= dt; if (a.cd[id] <= 0) { a.charges[id] = (a.charges[id] ?? max) + 1; a.cd[id] = a.charges[id] < max ? abilityCooldown(id) : 0; if (a.charges[id] >= max) fx(w, 'abilityReady', id); }
  }
  // Overdrive consumes Energy proportionally to the extension it receives. A nearly empty
  // capacitor can no longer turn a tiny regenerated fraction into a full 50% duration extension.
  if (a.active.overdrive > 0) {
    const need = 10 * dt, used = Math.min(Math.max(0, p.energy), need), fueled = need > 0 ? used / need : 0;
    p.energy = Math.max(0, p.energy - used);
    a.active.overdrive = Math.max(0, a.active.overdrive - dt * (1 - 0.5 * fueled));
    if (rand() < dt * 20) fx(w, 'trail', p.x + (rand() - 0.5) * 4, p.y - 2, 0xffb547);
  }
  if (a.active.aegis > 0) a.active.aegis -= dt;
  if (w.slowT > 0) w.slowT -= dt;
  if (w.stunT > 0) w.stunT -= dt;
}
