// Developer panel. Opening it moves the session into a sandbox save slot first, so nothing done here can reach the real save.
import { G, recalc, toast } from '@last-orbit/core/game.js';
import { Big } from '@last-orbit/core/big.js';
import { fmt, fmtTime } from '@last-orbit/core/format.js';
import { CUR } from '@last-orbit/core/state.js';
import { enemyHp, enemyReward, enemyDmg } from '@last-orbit/data/balance.js';
import { SECTORS, sectorOf, sectorStart } from '@last-orbit/data/sectors.js';
import { ENEMIES } from '@last-orbit/data/enemies.js';
import { BOSSES } from '@last-orbit/data/bosses.js';
import { RESEARCH } from '@last-orbit/data/research.js';
import { gain, checkUnlocks } from '@last-orbit/progression/economy.js';
import { debugSetWave, debugSpawn } from '@last-orbit/combat/sim.js';
import { killEnemy } from '@last-orbit/combat/world.js';
import { doRewind } from '@last-orbit/prestige/prestige.js';
import { grantModule } from '@last-orbit/modules/modules.js';
import { estimateDps, clearTime, simulateOffline, applyOffline } from '@last-orbit/offline/offline.js';
import { h, clear, select } from '@last-orbit/ui/dom.js';
import { showOffline } from '@last-orbit/ui/modals.js';

export function initDebug(root, hooks) {
  const el = h('div#debug'), tag = h('div.sandbox-tag', 'SANDBOX · not your real save'); root.append(el, tag); let built = false, out;
  const btn = (t, fn) => h('button.btn', { onclick: () => { fn(); refresh(); } }, t), num = (v) => h('input', { type: 'text', value: v });
  function build() {
    built = true; clear(el); const amt = num('1e6'), wave = num('30'), hrs = num('8'); let enemy = 'grunt', boss = 'warden';
    out = h('pre');
    el.append(h('div.row', h('b', { style: 'flex:1;color:#ff9db6;font:700 13px var(--disp)' }, 'DEV PANEL'), btn('Close', () => el.classList.remove('on')), btn('Leave sandbox', hooks.leaveSandbox)),
      h('h4', 'Currency'), h('div.row', amt, ...Object.keys(CUR).map((c) => btn('+' + CUR[c].icon, () => gain(c, Big.from(parseFloat(amt.value) || 0))))),
      h('h4', 'Waves'), h('div.row', wave, btn('Set wave', () => debugSetWave(parseInt(wave.value) || 1)), ...SECTORS.map((s, i) => btn('S' + (i + 1), () => debugSetWave(sectorStart(i)))), btn('Sector boss', () => { const s = sectorOf(G.state.run.wave); debugSetWave(s.start + s.len - 1); })),
      h('h4', 'Spawn'), h('div.row', select(Object.keys(ENEMIES).map((k) => [k, ENEMIES[k].name]), () => enemy, (v) => { enemy = v; }), btn('Spawn', () => debugSpawn(enemy)), btn('Elite', () => debugSpawn(enemy, true)), btn('×10', () => { for (let i = 0; i < 10; i++) debugSpawn(enemy); })),
      h('div.row', { style: 'margin-top:4px' }, select(Object.keys(BOSSES).map((k) => [k, BOSSES[k].name]), () => boss, (v) => { boss = v; }), btn('Spawn boss', () => debugSpawn(boss)), btn('Kill all', () => { for (const e of G.world.enemies.slice()) if (e.alive) killEnemy(G.world, e, null); })),
      h('h4', 'Time'), h('div.row', ...[0, 0.25, 1, 2, 5, 10, 30].map((s) => btn('×' + s, () => { G.debugSpeed = s; })), hrs, btn('Simulate offline (h)', () => { const r = simulateOffline((parseFloat(hrs.value) || 1) * 3600); applyOffline(r); showOffline(r); })),
      h('h4', 'Progress'), h('div.row', btn('Force rewind', () => doRewind({ force: true })), btn('Unlock all systems', () => { const u = G.state.unlocks; for (const k of ['arsenal', 'missions', 'abilities', 'skills', 'research', 'modules', 'rewind', 'drones', 'automation', 'challenges', 'relics', 'alien', 'ascension']) u[k] = u[k] || Date.now(); hooks.refreshNav(); }),
        btn('All research', () => { for (const d of RESEARCH) G.state.run.research[d.id] = d.max; recalc(); checkUnlocks(); }), btn('Module', () => grantModule(0, 1)), btn('Legendary', () => grantModule(4, 0)), btn('+5 rewinds', () => { G.state.prestige.count += 5; checkUnlocks(); }), btn('God hull', () => { G.state.run.picks.push({ id: 'dbg', label: 'Debug hull', fx: [['hull', 'pow', 1e12]] }); recalc(); }), btn('Reset sandbox save', hooks.resetSandbox)),
      h('h4', 'Inspect'), h('div.row', btn('Refresh', () => {})), out);
  }
  function refresh() {
    if (!out) return; const st = G.state, w = G.world, run = st.run, sec = sectorOf(run.wave), d = estimateDps(), L = [];
    L.push(`wave ${run.wave} (best ${run.best})  sector ${sec.idx + 1} "${sec.def.name}" n=${sec.n}/${sec.len}  state=${w.wave.state}  farm=${run.farm}`);
    L.push(`enemies ${w.enemies.length}  shots ${w.shots.length}  ebullets ${w.ebullets.length}  drones ${w.drones.length}  frame ${G.renderer ? G.renderer.frameMs.toFixed(1) : '-'}ms`);
    L.push(`DPS live ${fmt(w.dps)}   model crowd ${fmt(d.total)}   model boss ${fmt(d.boss)}   income ${fmt(w.income)}/s`);
    L.push('DPS parts: ' + Object.keys(d.parts).map((k) => `${k} ${fmt(d.parts[k])}`).join('  '));
    L.push('', 'wave     enemy HP     reward      enemy dmg    model clear');
    for (const k of [0, 1, 5, 10, 25, 50, 100]) { const n = run.wave + k, s = sectorOf(n), c = clearTime(n, d); L.push(`${String(n).padEnd(8)} ${fmt(enemyHp(n, s.idx)).padEnd(12)} ${fmt(enemyReward(n, s.idx)).padEnd(11)} ${fmt(enemyDmg(n, s.idx)).padEnd(12)} ${c ? fmtTime(c.t) : 'wall'}`); }
    L.push('', `hull ${fmt(G.sheet.b('hull'))}  dmg/hit→hull ${(w.base.dmgPerHull * 100).toFixed(2)}%  shieldRatio ${G.sheet.n('shieldRatio').toFixed(2)}  offlineEff ${G.sheet.n('offlineEff')}`);
    out.textContent = L.join('\n');
  }
  setInterval(() => { if (el.classList.contains('on')) refresh(); }, 1000);
  return { open() { if (!built) build(); el.classList.add('on'); tag.classList.add('on'); refresh(); }, tag };
}
