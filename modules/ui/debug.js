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
  st.unlocked.ships.striker = 1; st.stats.sorties = 6; st.stats.bestWave = 27; st.stats.bestSector = 4; st.stats.threatClear = 2; st.threat = 2; st.mastery = { vanguard: { level: 4, xp: 60 }, striker: { level: 2, xp: 10 } }; st.daily.streak = 3; st.daily.lastDay = '2000-01-01'; st.stats.kills = 900; st.workshop.w_dmg = 3; st.workshop.w_hull = 2; st.pilot = { rank: 6, xp: 700 }; st.paints.ember = st.paints.crimson = 1;
  st.stats.bestScore = 48210; st.stats.bestKills = 612; st.stats.longestRun = 402; st.stats.maxLevel = 22; st.stats.bestSalvage = 931; st.stats.flawless = 40; st.stats.bossKills = 7; st.stats.flawlessBosses = 1; st.medals = { a_kills: 1, a_wave: 1, a_boss: 1, a_flawless: 1, a_score: 1, f_cleanboss: 1 };
  st.records.top = [48210, 40555, 31204, 22950, 9120].map((score, i) => ({ score, wave: [28, 26, 23, 19, 11][i], ship: i === 1 ? 'striker' : 'vanguard', level: 24 - i * 3, kills: 600 - i * 90, threat: i === 0 ? 2 : 0, daily: i === 2, date: Date.now() - i * 86400000 }));
  st.records.ships = { vanguard: { score: 48210, wave: 28 }, striker: { score: 40555, wave: 26 } }; recalc();
  const [name, arg] = scene.split(':');
  if (name === 'paint') { st.paints[arg] = 1; st.paint = arg; hooks.toHangar('launch'); return; }
  if (arg === 'locked') { st.unlocked.weapons = { cannon: 1, laser: 1 }; st.unlocked.abilities = { overdrive: 1 }; }
  if (['workshop', 'armory', 'ships', 'contracts', 'launch', 'missions', 'records', 'awards'].includes(name)) { hooks.toHangar(name); return; }
  hooks.launch();
  if (name !== 'levelup') { st.run.offer = null; st.run.pendingLevels = 0; ui.closeOverlays(); }
  if (name === 'levelup') { grantXp(40); ui.nextChoice(); }
  else if (name === 'relic') { st.run.pendingRelics = 1; ui.nextChoice(); }
  else if (name === 'notice') bus.emit('notice', { kind: 'unlock', kicker: 'Contract complete', title: 'Hold the Line', salvage: 40, sub: 'Weapon: Lance Laser unlocked', art: 'weapon:laser' });
  else if (name === 'pause') ui.pause();
  else if (name === 'medal') bus.emit('notice', { kind: 'medal', kicker: 'Silver medal', title: 'Exterminator', sub: 'Destroy 5,000 invaders', art: 'weapon:cannon', tier: 'silver', xp: 250 });
  else if (name === 'loadout') { const run = st.run; run.order.push('laser'); run.weapons.laser = 4; run.weapons.cannon = 3; run.relics.push('r_glass'); run.cards = { m_dmg: 2, m_crit: 1, m_hull: 1 }; run.abilities.push('emp'); recalc();
    run.offer = null; run.pendingLevels = 0; ui.closeOverlays();
    setTimeout(() => { const g = document.querySelectorAll('#dock .gun')[1]; if (g) { const r = g.getBoundingClientRect(); ui.tapHud(r.left + 5, r.top + 5); } }, 800); }
  else if (name === 'stress') {
    // Late-game load: wave 34, four rank-7 guns, relics and drones, autopilot on.
    const run = st.run; run.order = ['cannon', 'laser', 'missile', 'tesla']; for (const id of run.order) run.weapons[id] = 7;
    run.relics = ['r_barrel', 'r_swarm', 'r_chain']; run.cards = { m_multi: 2, m_rate: 6, m_dmg: 8, m_drone: 2 }; run.wave = +(arg || 34); run.level = 30; recalc();
    bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = 2; }); recalc(); debugSetWave(run.wave);
    setInterval(() => { if (st.run?.offer) st.run.offer = null, st.run.pendingLevels = 0; if (st.run) st.run.pendingRelics = 0; if (st.run?.relicOffer) st.run.relicOffer = null; ui.closeOverlays?.(); const p = G.world?.player; if (p) { p.hull = 1; p.invuln = 1; } }, 200);
  }
  else if (name === 'debrief') { st.run.salvage = 812; st.run.weapons.laser = 5; st.run.order.push('laser'); st.run.relics.push('r_glass'); st.run.contractsDone = ['c_wave5', 'c_kills']; st.run.score = 52340; st.run.medalsDone = [{ id: 'a_score', tier: 1, xp: 250 }, { id: 'f_solo', tier: 0, xp: 400 }]; G.world.wave.num = 23; hooks.abandon(); }
}
