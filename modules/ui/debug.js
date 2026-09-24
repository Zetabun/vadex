// ?debug=1 test panel. It switches to a sandbox save slot first, so nothing here touches the real save.
import { G, recalc, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { WEAPON_ORDER } from '@last-orbit/data/weapons.js';
import { ABILITY_ORDER } from '@last-orbit/data/abilities.js';
import { SHIPS } from '@last-orbit/data/ships.js';
import { grantXp, nextOffer, nextRelic, pickCard, pickRelic, autoPickIndex } from '@last-orbit/progression/run.js';
import { debugSetWave } from '@last-orbit/combat/sim.js';
import { killEnemy } from '@last-orbit/combat/world.js';
import { enterSandbox } from '@last-orbit/save/save.js';
import { h } from '@last-orbit/ui/dom.js';
import { BANNERS, BANNER_BY_ID } from '@last-orbit/data/banners.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { STAGE_BY_N } from '@last-orbit/data/counter.js';
import { powerRating } from '@last-orbit/progression/meta.js';

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
  if (scene) { panel.style.display = 'none'; G.demo = true; runScene(scene, hooks, ui); } // demo scenes never auto-pause
}

function runScene(scene, hooks, ui) {
  const st = G.state; st.salvage = 4200; for (const id of WEAPON_ORDER) st.unlocked.weapons[id] = 1; for (const id of ABILITY_ORDER) st.unlocked.abilities[id] = 1;
  st.unlocked.ships.striker = 1; st.stats.sorties = 6; st.stats.bestWave = 27; st.stats.bestSector = 4; st.stats.threatClear = 2; st.threat = 2; st.mastery = { vanguard: { level: 4, xp: 60 }, striker: { level: 2, xp: 10 } }; st.daily.streak = 3; st.daily.lastDay = '2000-01-01'; st.stats.kills = 900; st.workshop.w_dmg = 3; st.workshop.w_hull = 2; st.pilot = { rank: 6, xp: 700 }; st.paints.ember = st.paints.crimson = 1;
  st.stats.bestScore = 48210; st.stats.bestKills = 612; st.stats.longestRun = 402; st.stats.maxLevel = 22; st.stats.bestSalvage = 931; st.stats.flawless = 40; st.stats.bossKills = 7; st.stats.flawlessBosses = 1; st.medals = { a_kills: 1, a_wave: 1, a_boss: 1, a_flawless: 1, a_score: 1, f_cleanboss: 1 };
  st.records.top = [48210, 40555, 31204, 22950, 9120].map((score, i) => ({ score, wave: [28, 26, 23, 19, 11][i], ship: i === 1 ? 'striker' : 'vanguard', level: 24 - i * 3, kills: 600 - i * 90, threat: i === 0 ? 2 : 0, daily: i === 2, date: Date.now() - i * 86400000 }));
  st.records.ships = { vanguard: { score: 48210, wave: 28 }, striker: { score: 40555, wave: 26 } }; recalc();
  const [name, arg, arg2, arg3] = scene.split(':');
  if (name === 'hull' || name === 'hullfly') { st.unlocked.ships[arg] = 1; st.ship = arg; st.banner = 'none'; recalc(); if (name === 'hull') { hooks.toHangar('launch'); return; } }
  if (name === 'paint') { st.paints[arg] = 1; st.paint = arg; hooks.toHangar('launch'); return; }
  if (name === 'caintro') { st.counter.unlocked = true; hooks.toHangar('missions'); setTimeout(() => document.querySelector('.ca-how')?.click(), 400); return; }
  // counter:<n>:boss jumps to the stage's boss; counter:<n>:foe sends in the stage's own enemy again and again. The ship cannot die.
  if (name === 'counter' && (arg2 === 'boss' || arg2 === 'foe')) {
    st.counter.unlocked = true; hooks.launch({ counter: +arg }); for (let g = 0; g < 60 && (nextRelic() || nextOffer()); g++) { if (st.run.relicOffer) pickRelic(0); else pickCard(autoPickIndex(st.run)); } ui.closeOverlays();
    const c = G.world.counter, x = c.stage.extra;
    if (arg2 === 'boss') { c.t = c.stage.len + 8; c.next = c.events.length; c.midDone = true; }
    else { c.t = c.stage.len * 0.3; c.midDone = true; c.events = Array.from({ length: 40 }, (_, i) => ({ t: c.t + 1 + i * 3.5, type: x?.type || 'grunt', pattern: x?.pattern || 'hover', n: x?.n || 2, x: ((i * 37) % 50) - 25, dir: i % 2 ? 1 : -1, ph: i, elite: false })); c.next = 0; }
    setInterval(() => { const w = G.world, run = st.run; if (!w?.player || !run) return; if (run.offer || run.relicOffer) { run.offer = run.relicOffer = null; run.pendingLevels = run.pendingRelics = 0; ui.closeOverlays(); } w.player.hull = 1; w.player.invuln = 0; if (arg3 === 'look') w.shots.length = 0; }, 100); // look: hold fire, to see the models
    return;
  }
  if (name === 'counter' && arg2 === 'late') { st.counter.unlocked = true; hooks.launch({ counter: +arg }); for (let g = 0; g < 60 && (nextRelic() || nextOffer()); g++) { if (st.run.relicOffer) pickRelic(0); else pickCard(autoPickIndex(st.run)); } ui.closeOverlays(); G.world.counter.t = G.world.counter.stage.len * (arg3 ? +arg3 : 0.5); G.world.counter.midDone = true; G.world.counter.next = G.world.counter.events.findIndex((ev) => ev.t >= G.world.counter.t); if (G.world.counter.next < 0) G.world.counter.next = G.world.counter.events.length;
    setTimeout(() => { if (G.renderer?.ground) { G.renderer.groundWorld = G.world; G.renderer.ground.reset(); G.renderer.ground.scroll = G.world.counter.t * 13; for (const row of G.renderer.ground.rows) { row.y += G.renderer.ground.scroll; row.plan = G.renderer.ground.planRow(row.y); } G.renderer.ground.rebuild(); } }, 50);
    setInterval(() => { const run = st.run; if (!run) return; run.offer = null; run.pendingLevels = 0; ui.closeOverlays(); if (G.world?.player) G.world.player.hull = 1; }, 150); return; }
  if (name === 'counter') { st.counter.unlocked = true; st.stats.sectorsCleared = 6; st.counter.cores = 7; st.counter.stars = { 1: 3, 2: 2 }; if (!arg) { hooks.toHangar('missions'); return; }
    // Bring the sandbox up to the stage's recommended power, so the stage plays at the strength a player would bring.
    for (let g = 0; g < 20 && powerRating() < STAGE_BY_N[+arg].rec; g++) { for (const u of WORKSHOP) if (u.id !== 'w_revive' && u.id !== 'w_choice') st.workshop[u.id] = Math.min(u.max, (st.workshop[u.id] || 0) + 1); recalc(); }
    hooks.launch({ counter: +arg }); for (let g = 0; g < 60 && (nextRelic() || nextOffer()); g++) { if (st.run.relicOffer) pickRelic(0); else pickCard(autoPickIndex(st.run)); } ui.closeOverlays();
    let t = 0; setInterval(() => { const w = G.world; if (!w?.player) return; w.player.hull = 1; t += 0.2; w.input.keysY = Math.sin(t * 0.7) > 0.2 ? 1 : Math.sin(t * 0.7) < -0.6 ? -1 : 0; w.input.keys = Math.sin(t * 0.45) > 0.3 ? 1 : Math.sin(t * 0.45) < -0.3 ? -1 : 0; }, 200); return; }
  if (name === 'warp') { st.stats.sectorsCleared = 4; st.warp = +(arg || 3); if (!arg2) { hooks.toHangar('launch'); return; } }
  if (name === 'bannershow' && arg === 'legendary') {
    // Every legendary stat tracker in turn with plausible stats, the kill counter ticking.
    Object.assign(st.stats, { kills: 48213, bossKills: 91, bestWave: 64, bestScore: 612840, totalSalvage: 318400, flawless: 523, sorties: 164 });
    const ids = BANNERS.filter((b) => b.rarity === 'legendary').map((b) => b.id); let k = 0; for (const id of ids) st.banners[id] = 1;
    const next = () => { st.banner = ids[k++ % ids.length]; toast(BANNER_BY_ID[st.banner].name + ' · Legendary', 'info'); };
    next(); setInterval(next, 4000); setInterval(() => { st.stats.kills += 1 + Math.floor(Math.random() * 3); }, 300);
    hooks.toHangar(arg2 === 'ships' ? 'ships' : 'launch'); return;
  }
  if (name === 'bannershow') {
    // Every banner in turn, four seconds each: in the hangar close-up (default) or in flight (bannershow:fly).
    const ids = BANNERS.filter((b) => b.shape).map((b) => b.id); let k = 0;
    for (const id of ids) st.banners[id] = 1;
    const next = () => { st.banner = ids[k++ % ids.length]; toast(BANNER_BY_ID[st.banner].name, 'info'); };
    next(); setInterval(next, 4000);
    if (arg !== 'fly') { hooks.toHangar('launch'); return; }
    hooks.launch();
    setInterval(() => { const w = G.world, run = st.run; if (!w || !run) return; if (run.offer || run.relicOffer) { run.offer = run.relicOffer = null; run.pendingLevels = run.pendingRelics = 0; ui.closeOverlays(); }
      const s = Math.sin(performance.now() / 900); w.input.hold = s > 0.35 ? 1 : s < -0.35 ? -1 : 0; w.player.hull = 1; w.player.invuln = 0; }, 50);
    return;
  }
  if (name === 'banner' || name === 'bannerfly') { for (const id of ['signal', 'checker', 'ember', 'royal', 'jolly']) st.banners[id] = 1; st.banners[arg] = 1; st.banner = arg; if (name === 'banner') { hooks.toHangar(arg === 'royal' ? 'launch' : 'ships'); return; } }
  // Overhaul: overhaul (Workshop maxed, ready), blueprints (rank 3 with Blueprints to spend), escorts[:trail] (in flight).
  if (name === 'overhaul' || name === 'blueprints' || name === 'escorts') {
    const pr = st.prestige;
    if (name === 'overhaul') { for (const u of WORKSHOP) st.workshop[u.id] = u.max; pr.cycleBest = 74; }
    else { pr.level = name === 'escorts' ? 8 : 3; pr.bp = 14; pr.tech = { bp_bay: 2, bp_intercept: 1, bp_shield: 1, bp_salvage: 1 }; pr.escorts = ['intercept', 'shield']; st.stats.overhauls = pr.level; st.trail = arg || 'prism'; for (const u of WORKSHOP) st.workshop[u.id] = Math.min(u.max, 6); }
    recalc(); if (name !== 'escorts') { hooks.toHangar('workshop'); return; }
    hooks.launch(); st.run.offer = null; st.run.pendingLevels = 0; ui.closeOverlays();
    setInterval(() => { const w = G.world, run = st.run; if (!w?.player || !run) return; if (run.offer || run.relicOffer) { if (run.relicOffer) pickRelic(0); else pickCard(autoPickIndex(run)); if (!run.offer && !run.relicOffer) ui.closeOverlays(); }
      const s = Math.sin(performance.now() / 1100); w.input.hold = s > 0.3 ? 1 : s < -0.3 ? -1 : 0; w.player.hull = 1; }, 120); return;
  }
  if (arg === 'locked') { st.unlocked.weapons = { cannon: 1, laser: 1 }; st.unlocked.abilities = { overdrive: 1 }; }
  if (['workshop', 'armory', 'ships', 'contracts', 'launch', 'missions', 'records', 'awards'].includes(name)) { hooks.toHangar(name); return; }
  hooks.launch();
  if (name !== 'levelup') { st.run.offer = null; st.run.pendingLevels = 0; ui.closeOverlays(); }
  if (name === 'levelup') { grantXp(40); ui.nextChoice(); }
  else if (name === 'relic') { st.run.pendingRelics = 1; ui.nextChoice(); }
  else if (name === 'synergy') { const run = st.run; run.offer = null; run.pendingLevels = 0; run.cards = { m_crit: 1, m_critd: 2 }; recalc();
    run.offer = [{ kind: 'mod', id: 'm_aim', stack: 1, rarity: 'common' }, { kind: 'mod', id: 'm_hull', stack: 1, rarity: 'common' }, { kind: 'mod', id: 'm_drone', stack: 1, rarity: 'rare' }]; ui.closeOverlays(); ui.nextChoice(); }
  else if (name === 'dash') { const run = st.run; run.offer = null; run.pendingLevels = 0; ui.closeOverlays(); let d = 1; setInterval(() => { const w = G.world; if (!w) return; w.input.dash = d; d = -d; w.player.hull = 1; }, 900); }
  else if (name === 'route') { st.run.offer = null; st.run.pendingLevels = 0; st.run.pendingRoute = true; ui.closeOverlays(); ui.nextChoice(); }
  else if (name === 'fusion') { const run = st.run; run.offer = null; run.pendingLevels = 0; run.order.push('laser'); run.weapons.cannon = 7; run.weapons.laser = 7; st.mastery.vanguard = { level: 5, xp: 0 }; recalc();
    run.offer = [{ kind: 'fusion', id: 'fu_twinsuns', rarity: 'fusion' }, { kind: 'signature', id: run.ship, rarity: 'signature' }, { kind: 'mod', id: 'm_dmg', stack: 1, rarity: 'common' }]; ui.closeOverlays(); ui.nextChoice(); }
  else if (name === 'notice') bus.emit('notice', { kind: 'unlock', kicker: 'Contract complete', title: 'Hold the Line', salvage: 40, sub: 'Weapon: Lance Laser unlocked', art: 'weapon:laser' });
  else if (name === 'bannerfly') { let d = 1; setInterval(() => { const i = G.world?.input; if (!i) return; i.hold = d; if (Math.abs(G.world.player.x) > 30) d = -Math.sign(G.world.player.x); const p = G.world.player; p.hull = 1; p.invuln = 0; }, 100); }
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
