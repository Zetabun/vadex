// Entry point: boot, input, the frame loop, autosave and lifecycle. Simulation time is decoupled from rendering (see combat/sim.js advance()).

import { G, recalc, stat, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { setNotation } from '@last-orbit/core/format.js';
import { newState } from '@last-orbit/core/state.js';
import { FIELD } from '@last-orbit/data/balance.js';
import { checkUnlocks } from '@last-orbit/progression/economy.js';
import { initWorld, advance } from '@last-orbit/combat/sim.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { tickAutomation } from '@last-orbit/automation/automation.js';
import { updateGoals } from '@last-orbit/meta/goals.js';
import { noteOnboarding, syncOnboarding, onboardingFreezesAll } from '@last-orbit/meta/onboarding.js';
import '@last-orbit/modules/modules.js';
import { awaySeconds, simulateOffline, applyOffline } from '@last-orbit/offline/offline.js';
import { tickFoundry, simulateFoundry, applyFoundryReport, useSupply } from '@last-orbit/progression/foundry.js';
import { tickFleet, simulateFleetOffline, applyFleetOfflineReport } from '@last-orbit/progression/fleet.js';
import { tickMaterials, simulateMaterials, applyMaterialsReport } from '@last-orbit/progression/materials.js';
import { save, load, importSave, hardReset, enterSandbox, leaveSandbox } from '@last-orbit/save/save.js';
import { initAudio, applyVolumes, tickMusic, setMusicMode, suspendAudio } from '@last-orbit/audio/audio.js';
import { Renderer } from '@last-orbit/rendering/renderer.js';
import { initUI } from '@last-orbit/ui/ui.js';
import { approachManagementScale, commandPhaseActive } from '@last-orbit/ui/management.js';
import { initDebug } from '@last-orbit/ui/debug.js';
import { showOffline, closeModal, modalOpen, modalFreezesAll } from '@last-orbit/ui/modals.js';

const app = document.getElementById('app'), glCanvas = document.getElementById('gl'), overlay = document.getElementById('overlay');
let renderer, ui, debug, last = 0, saveT = 0, running = false, managementScale = 1;

function adopt(state, { offline = true } = {}) {
  G.state = state; setNotation(state.settings.notation); recalc(); checkUnlocks();
  let report = null;
  if (offline) { const a = awaySeconds(); if (a.s > 90 || a.note) { const r = simulateOffline(a.s); if (a.s > 90) { applyOffline(r); recalc(); } report = [r, a.note]; } else if (a.s > 1) { applyFleetOfflineReport(simulateFleetOffline(a.s)); applyFoundryReport(simulateFoundry(a.s)); applyMaterialsReport(simulateMaterials(a.s)); } }
  state.meta.lastSeen = Date.now(); initWorld(); checkUnlocks(); applyVolumes();
  if (renderer) { renderer.lastSector = -1; renderer.lookV = -1; renderer.setQuality(); }
  if (ui) ui.reset(); if (debug) debug.tag.classList.toggle('on', !!state.meta.sandbox);
  G.hintOn = state.stats.bestWave < 3 && !(state.stats.kills > 30);
  if (report && (report[0].waves > 0 || !report[0].fleet?.earned?.isZero?.() || report[0].foundry?.cycles > 0 || report[0].materials?.completed > 0 || report[0].materials?.barsCollected > 0 || report[0].materials?.passiveOre > 0 || report[0].materials?.extraOre > 0 || report[1])) showOffline(report[0], report[1]);
}

const hooks = {
  setInsets: (t, b) => renderer && renderer.setInsets(t, b),
  applySettings: () => renderer.setQuality(),
  celebrate: (color) => { const p = G.world.player; renderer.celebrate(p.x, p.y + 6, color); },
  saveNow: async () => { await save('manual'); toast(G.state.meta.sandbox ? 'Sandbox saved (separate from your real save).' : 'Game saved.', 'good'); },
  importSave: (text) => { try { const s = importSave(text); closeModal(); adopt(s, { offline: false }); save('import'); toast('Save imported.', 'good'); } catch (e) { toast('That save string could not be read: ' + e.message, 'warn'); } },
  hardReset: async () => { await hardReset(); const s = newState(); s.meta.sandbox = G.state.meta.sandbox; adopt(s, { offline: false }); await save('reset'); toast('Save erased. Good luck, commander.', 'warn'); },
  openDebug: async () => { if (!G.state.meta.sandbox) { await enterSandbox(); toast('Sandbox mode: progress from here is kept apart from your real save.', 'warn'); } debug.open(); },
  leaveSandbox: async () => { await leaveSandbox(); G.debugSpeed = 1; const r = await load(); adopt(r.state, { offline: false }); document.getElementById('debug').classList.remove('on'); toast('Back on your real save.', 'good'); },
  resetSandbox: () => { const s = newState(); s.meta.sandbox = true; adopt(s, { offline: false }); },
  refreshNav: () => ui.refreshNav(),
};

// ------------------------------------------------------------------ input
function wireInput() {
  let down = null; const inp = () => G.world.input;
  const at = (e) => { const r = glCanvas.getBoundingClientRect(); return renderer.screenToWorld(e.clientX - r.left, e.clientY - r.top); };
  glCanvas.addEventListener('pointerdown', (e) => { initAudio(); e.preventDefault(); try { glCanvas.setPointerCapture(e.pointerId); } catch { /* not critical */ } const p = at(e), px = G.world?.player?.x; noteOnboarding('fire'); if (Number.isFinite(px) && Math.abs(p.x - px) > 0.75) noteOnboarding('move'); down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), wy: p.y }; const i = inp(); i.active = true; i.fire = true; i.targetX = p.x; G.hintOn = false; });
  // A returning player often taps a menu first, not the battlefield. That gesture
  // must be allowed to wake an interrupted WebAudio context as well.
  app.addEventListener('pointerdown', initAudio, { capture: true });
  addEventListener('keydown', initAudio, { capture: true });
  glCanvas.addEventListener('pointermove', (e) => { if (!down || e.pointerId !== down.id) return; if (Math.abs(e.clientX - down.x) > 3) noteOnboarding('move'); inp().targetX = at(e).x; });
  const up = (e) => { if (!down || e.pointerId !== down.id) return; const i = inp(); i.active = false; i.fire = false; if (performance.now() - down.t < 260 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12) { const p = at(e); if (p.y > FIELD.BARRIER_Y + 6) i.tap = p; } down = null; };
  glCanvas.addEventListener('pointerup', up); glCanvas.addEventListener('pointercancel', up);
  const keys = { l: false, r: false };
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape') { if (modalOpen()) closeModal(); else ui.toggle(null); return; }
    // Do not steal Space/arrow activation from focused UI controls. Gameplay keys remain active on the canvas/page itself.
    if (modalOpen() || e.target.closest?.('button,a,input,textarea,select,[contenteditable="true"]')) return;
    initAudio(); const i = inp();
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keys.l = true; noteOnboarding('move'); } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.r = true; noteOnboarding('move'); } else if (e.code === 'Space') { i.fire = true; noteOnboarding('fire'); e.preventDefault(); }
    else if (e.code === 'KeyQ') { useSupply(); }
    else if (/^Digit[1-6]$/.test(e.code)) { const id = G.state.abilities.equipped[+e.code.slice(5) - 1]; if (id) useAbility(G.world, id); } else if (e.code === 'Backquote') hooks.openDebug();
    i.keys = (keys.r ? 1 : 0) - (keys.l ? 1 : 0); if (i.keys) G.hintOn = false; });
  addEventListener('keyup', (e) => { const i = inp(); if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = false; else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = false; else if (e.code === 'Space') i.fire = false; i.keys = (keys.r ? 1 : 0) - (keys.l ? 1 : 0); });
  // Keep long-press/pinch/drag browser UI out of the game surface. Text-entry controls remain normal
  // so save import/export and debug tools can still use selection and copy/paste when needed.
  const editable = (target) => !!target?.closest?.('input,textarea,select,[contenteditable="true"]');
  const blockBrowserGesture = (e) => { if (!editable(e.target) && e.cancelable) e.preventDefault(); };
  app.addEventListener('contextmenu', blockBrowserGesture);
  app.addEventListener('selectstart', blockBrowserGesture);
  app.addEventListener('dragstart', blockBrowserGesture);
  app.addEventListener('gesturestart', blockBrowserGesture, { passive: false });
  app.addEventListener('gesturechange', blockBrowserGesture, { passive: false });
  app.addEventListener('gestureend', blockBrowserGesture, { passive: false });
  app.addEventListener('touchstart', (e) => { if (e.touches.length > 1) blockBrowserGesture(e); }, { passive: false });
  app.addEventListener('touchmove', (e) => { if (e.touches.length > 1) blockBrowserGesture(e); }, { passive: false });
}

// ------------------------------------------------------------------ loop
function frame(now) {
  requestAnimationFrame(frame); if (!running) return;
  const elapsed = Math.max(0, (now - last) / 1000 || 0.016), real = Math.min(0.1, elapsed); last = now;
  const speed = Math.max(0, stat('gameSpeed') * G.debugSpeed * (G.state.settings.speed || 1)), w0 = G.world;
  const managementOpen = !!ui?.isOpen(), commandPaused = commandPhaseActive(managementOpen, G.world?.wave);
  const tutorialPaused = onboardingFreezesAll(), loadoutPaused = ['modules', 'skills', 'xp'].includes(ui?.isOpen());
  // Tactical management slows live combat. A between-wave Command Phase and the guided first-upgrade
  // purchase are genuinely paused, while the highlighted UI control remains interactive.
  managementScale = approachManagementScale(managementScale, managementOpen && !commandPaused && !tutorialPaused && !loadoutPaused, real);
  const simulationPaused = commandPaused || tutorialPaused || loadoutPaused;
  const combatSpeed = simulationPaused ? 0 : speed * managementScale;
  // a carried-over input belongs to the world it was made in (rewinds swap the world)
  const freezeAll = modalFreezesAll() || tutorialPaused;
  if (!modalOpen() && !simulationPaused) { advance(real * combatSpeed); tickAutomation(real * combatSpeed); } const w = G.world; if (w !== w0) { w.input.targetX = w0.input.targetX; }
  // Normal choices pause combat only; onboarding briefings and the interactive first-upgrade guide
  // freeze the entire game clock so combat, wave countdowns and background production cannot advance.
  if (!freezeAll) { tickFleet(elapsed); tickFoundry(elapsed); tickMaterials(elapsed); updateGoals(real); }
  syncOnboarding();
  setMusicMode(w.base.sectorIdx % 6, !!(w.wave.boss && w.wave.boss.alive)); tickMusic();
  renderer.render(real, G.world, combatSpeed); ui.update(real);
  saveT += real; if (saveT > 20) { saveT = 0; save('auto'); }
}

async function boot() {
  const r = await load();
  renderer = G.renderer = new Renderer(glCanvas, overlay);
  G.state = r.state; recalc(); // the UI needs a state to build against
  ui = initUI(app, hooks); debug = initDebug(app, hooks);
  adopt(r.state); if (r.recovered) toast('The main save was unreadable. Restored from the backup.', 'warn');
  if (r.fresh) ui.banner('Orbital defence ship', 'Last Orbit', 'Push advances to harder waves. Hold repeats a cleared wave to farm. Everything you learn carries forward.', 'var(--amber)', 5200);
  wireInput(); addEventListener('resize', () => { renderer.resize(); ui.measure(); }); new ResizeObserver(() => { renderer.resize(); ui.measure(); }).observe(app);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; suspendAudio(true); save('hidden'); }
    else { suspendAudio(false); const a = awaySeconds(); if (a.s > 90 || a.note) { const rep = simulateOffline(a.s); if (a.s > 90) { applyOffline(rep); recalc(); initWorld(); ui.reset(); } if (rep.waves > 0 || !rep.fleet?.earned?.isZero?.() || rep.foundry?.cycles > 0 || rep.materials?.completed > 0 || rep.materials?.barsCollected > 0 || rep.materials?.passiveOre > 0 || rep.materials?.extraOre > 0 || a.note) showOffline(rep, a.note); } else if (a.s > 1) { applyFleetOfflineReport(simulateFleetOffline(a.s)); applyFoundryReport(simulateFoundry(a.s)); applyMaterialsReport(simulateMaterials(a.s)); } G.state.meta.lastSeen = Date.now(); last = performance.now(); running = true; }
  });
  addEventListener('pagehide', () => save('pagehide'));
  if (/[?&]debug=1/.test(location.search)) hooks.openDebug();
  document.getElementById('boot').classList.add('off'); setTimeout(() => document.getElementById('boot').remove(), 800);
  last = performance.now(); running = true; requestAnimationFrame(frame);
}
function start() { if (window.THREE) boot().catch((e) => { console.error(e); document.getElementById('boot').innerHTML = '<h1>Last Orbit</h1><p>Could not start: ' + String(e.message || e) + '</p>'; }); else document.getElementById('boot').innerHTML = '<h1>Last Orbit</h1><p>Three.js failed to load. Check your connection and reload.</p>'; }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
