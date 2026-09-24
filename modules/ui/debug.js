// ?debug=1 test panel. It switches to a sandbox save slot first, so nothing here touches the real save.
import { G, recalc, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { WEAPON_ORDER } from '@last-orbit/data/weapons.js';
import { ABILITY_ORDER } from '@last-orbit/data/abilities.js';
import { SHIPS } from '@last-orbit/data/ships.js';
import { grantXp } from '@last-orbit/progression/run.js';
import { debugSetWave } from '@last-orbit/combat/sim.js';
import { killEnemy } from '@last-orbit/combat/world.js';
import { enterSandbox } from '@last-orbit/save/save.js';
import { h } from '@last-orbit/ui/dom.js';

export async function initDebug(app, { hooks, ui } = {}) {
  await enterSandbox(); if (!location.search.includes('scene=')) toast('Debug sandbox: progress here is kept apart from your real save.', 'warn');
  const btn = (label, fn) => h('button', { onclick: () => { fn(); recalc(); } }, label);
  const panel = h('div', { style: 'position:absolute;right:6px;top:50%;z-index:70;display:flex;flex-direction:column;gap:4px;font:600 11px monospace;opacity:.85' },
    btn('+1000 salvage', () => { G.state.salvage += 1000; }),
    btn('Unlock all', () => { for (const id of WEAPON_ORDER) G.state.unlocked.weapons[id] = 1; for (const id of ABILITY_ORDER) G.state.unlocked.abilities[id] = 1; for (const s of SHIPS) G.state.unlocked.ships[s.id] = 1; }),
    btn('+Level', () => grantXp(1e3)),
    btn('Wave +5', () => { if (G.state.run) debugSetWave(G.state.run.wave + 5); }),
    btn('Kill all', () => { for (const e of [...(G.world?.enemies || [])]) if (e.alive) killEnemy(G.world, e, null, false, 0); }),
    btn('Speed ×1/×3', () => { G.debugSpeed = G.debugSpeed === 1 ? 3 : 1; }));
  for (const b of panel.children) b.style.cssText = 'padding:6px 8px;background:#1a2250;border:1px solid #445;border-radius:6px;color:#dfe';
  app.append(panel);
  // ?debug=1&scene=… jumps straight to a screen, for screenshots and layout checks.
  const scene = new URLSearchParams(location.search).get('scene');
  if (scene) { panel.style.display = 'none'; runScene(scene, hooks, ui); }
}

function runScene(scene, hooks, ui) {
  const st = G.state; st.salvage = 4200; for (const id of WEAPON_ORDER) st.unlocked.weapons[id] = 1; for (const id of ABILITY_ORDER) st.unlocked.abilities[id] = 1;
  st.unlocked.ships.striker = 1; st.stats.sorties = 6; st.stats.bestWave = 27; st.stats.bestSector = 3; st.stats.kills = 900; st.workshop.w_dmg = 3; st.workshop.w_hull = 2; st.pilot = { rank: 6, xp: 700 }; st.paints.ember = st.paints.crimson = 1; recalc();
  const [name, arg] = scene.split(':');
  if (['workshop', 'armory', 'ships', 'contracts', 'launch'].includes(name)) { hooks.toHangar(name); return; }
  hooks.launch();
  if (name === 'levelup') { grantXp(40); ui.nextChoice(); }
  else if (name === 'relic') { st.run.pendingRelics = 1; ui.nextChoice(); }
  else if (name === 'notice') bus.emit('notice', { kind: 'unlock', kicker: 'Contract complete', title: 'Hold the Line', salvage: 40, sub: 'Weapon: Lance Laser unlocked', art: 'weapon:laser' });
  else if (name === 'pause') ui.pause();
  else if (name === 'debrief') { st.run.salvage = 812; st.run.weapons.laser = 5; st.run.order.push('laser'); st.run.relics.push('r_glass'); st.run.contractsDone = ['c_wave5', 'c_kills']; G.world.wave.num = 23; hooks.abandon(); }
}
