// Entry point: boot, input, the frame loop, autosave and the Hangar ⇄ Sortie flow.
// Simulation time is decoupled from rendering (see combat/sim.js advance()).
import { G, recalc, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { setNotation } from '@last-orbit/core/format.js';
import { newState } from '@last-orbit/core/state.js';
import { FIELD } from '@last-orbit/data/balance.js';
import { initWorld, advance } from '@last-orbit/combat/sim.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { collectAll } from '@last-orbit/combat/pickups.js';
import { startSortie, endSortie, nextOffer, nextRelic, recoverInterruptedRun } from '@last-orbit/progression/run.js';
import { checkContracts } from '@last-orbit/progression/meta.js';
import { save, load, hardReset, legacyBestWave } from '@last-orbit/save/save.js';
import { initAudio, applyVolumes, tickMusic, setMusicMode, suspendAudio } from '@last-orbit/audio/audio.js';
import { Renderer } from '@last-orbit/rendering/renderer.js';
import { initUI } from '@last-orbit/ui/ui.js';

const app = document.getElementById('app'), glCanvas = document.getElementById('gl'), overlay = document.getElementById('overlay');
let renderer, ui, last = 0, saveT = 0, running = false, levelBeat = 0;

function adopt(state) {
  // A sortie interrupted by a closed or discarded tab cannot be resumed, but its salvage is kept.
  const recovered = recoverInterruptedRun(state);
  G.state = state;
  if (recovered > 0) setTimeout(() => toast(`Recovered ${recovered} salvage from your last sortie.`, 'good'), 600);
  setNotation(state.settings.notation); recalc(); checkContracts(); initWorld(); applyVolumes();
  if (renderer) { renderer.lastSector = -1; renderer.lookV = -1; renderer.setQuality(); }
}

const hooks = {
  setInsets: (t, b) => renderer && renderer.setInsets(t, b),
  applySettings: () => { renderer.setQuality(); setNotation(G.state.settings.notation); document.getElementById('scan')?.classList.toggle('off', !G.state.settings.scanlines); },
  celebrate: (color) => { const p = G.world.player; renderer.celebrate(p.x, p.y + 6, color, 40); },
  launch: () => { initAudio(); startSortie(); initWorld(); ui.setMode('sortie'); save('launch'); if (nextOffer()) ui.nextChoice(); },
  abandon: () => finish('abandoned'),
  toHangar: (tab) => { initWorld(); ui.setMode('hangar', tab); },
  pendingOffer: () => nextOffer(),
  pendingRelic: () => nextRelic(),
  hardReset: async () => { await hardReset(); const s = newState(); s.meta.sandbox = G.state.meta.sandbox; s.meta.legacyChecked = G.state.meta.legacyChecked; adopt(s); ui.setMode('hangar'); await save('reset'); toast('Save erased. Good luck, pilot.', 'warn'); },
};

function finish(reason) {
  if (!G.state.run) return;
  if (G.world) collectAll(G.world);
  const summary = endSortie(reason);
  save('sortie-end');
  ui.showDebrief(summary);
}
bus.on('sortieOver', (reason) => setTimeout(() => finish(reason), 350));
// A level-up gets a brief beat of celebration in the battle before the card choice freezes it.
bus.on('levelUp', (lvl) => { if (G.mode !== 'sortie' || !G.world) return; if (levelBeat <= 0) levelBeat = 0.45; const p = G.world.player; renderer.celebrate(p.x, p.y + 4, '#6dffc8', 50); G.world.fx.push({ k: 'text', a: p.x, b: p.y + 12, c: 'LEVEL ' + lvl, d: '#6dffc8', e: 2 }); });

// ------------------------------------------------------------------ input
function wireInput() {
  let down = null; const inp = () => G.world.input;
  const at = (e) => { const r = glCanvas.getBoundingClientRect(); return renderer.screenToWorld(e.clientX - r.left, e.clientY - r.top); };
  glCanvas.addEventListener('pointerdown', (e) => { initAudio(); if (G.mode !== 'sortie') return; e.preventDefault(); try { glCanvas.setPointerCapture(e.pointerId); } catch { /* not critical */ } const p = at(e); down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), sx: p.x, px: G.world.player.x }; const i = inp(); i.active = true; i.targetX = G.world.player.x; });
  app.addEventListener('pointerdown', initAudio, { capture: true });
  addEventListener('keydown', initAudio, { capture: true });
  // Relative drag: the ship follows your finger's movement, so your thumb never covers it.
  glCanvas.addEventListener('pointermove', (e) => { if (!down || e.pointerId !== down.id) return; const p = at(e); inp().targetX = down.px + (p.x - down.sx) * 1.35; });
  const up = (e) => { if (!down || e.pointerId !== down.id) return; const i = inp(); i.active = false; if (performance.now() - down.t < 260 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12) { const p = at(e); if (p.y > FIELD.BARRIER_Y + 6) i.tap = p; } down = null; };
  glCanvas.addEventListener('pointerup', up); glCanvas.addEventListener('pointercancel', up);
  const keys = { l: false, r: false };
  addEventListener('keydown', (e) => {
    if (G.mode !== 'sortie' || ui.blocking() || e.target.closest?.('input,textarea,select')) return;
    const i = inp();
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = true; else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = true;
    else if (/^Digit[1-2]$/.test(e.code) || e.code === 'KeyQ' || e.code === 'KeyE' || e.code === 'Space') { const idx = e.code === 'KeyE' || e.code === 'Digit2' ? 1 : 0; const id = G.state.run.abilities[idx]; if (id) useAbility(G.world, id); e.preventDefault(); }
    i.keys = (keys.r ? 1 : 0) - (keys.l ? 1 : 0); });
  addEventListener('keyup', (e) => { if (!G.world) return; const i = inp(); if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = false; else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = false; i.keys = (keys.r ? 1 : 0) - (keys.l ? 1 : 0); });
  const editable = (target) => !!target?.closest?.('input,textarea,select');
  const block = (e) => { if (!editable(e.target) && e.cancelable) e.preventDefault(); };
  for (const ev of ['contextmenu', 'selectstart', 'dragstart']) app.addEventListener(ev, block);
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) app.addEventListener(ev, block, { passive: false });
  app.addEventListener('touchmove', (e) => { if (e.touches.length > 1) block(e); }, { passive: false });
}

// ------------------------------------------------------------------ loop
function frame(now) {
  requestAnimationFrame(frame); if (!running) return;
  const real = Math.min(0.1, Math.max(0, (now - last) / 1000 || 0.016)); last = now;
  const paused = ui.blocking();
  const speed = paused ? 0 : Math.max(0, G.sheet.n('gameSpeed') * G.debugSpeed * (G.state.settings.speed || 1));
  if (speed > 0) advance(real * speed);
  // A level-up or sector relic freezes combat until the pilot chooses.
  if (levelBeat > 0) levelBeat -= real;
  else if (G.mode === 'sortie' && !paused && G.state.run && (nextRelic() || nextOffer())) ui.nextChoice();
  const w = G.world;
  setMusicMode(G.mode === 'sortie' ? w.base.sectorIdx % 6 : 0, !!(w.wave.boss && w.wave.boss.alive)); tickMusic();
  renderer.render(real, w, speed); ui.update(real);
  saveT += real; if (saveT > 15) { saveT = 0; save('auto'); }
}

// iOS home-screen apps with a translucent status bar lay the page out one status-bar height short of the
// screen, leaving a strip at the bottom and clipping the tab bar. Size the app to the whole screen instead.
function fitStandalone() {
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (!standalone) return;
  const portrait = matchMedia('(orientation: portrait)').matches, screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const full = Math.max(innerHeight, document.documentElement.clientHeight, screenH);
  // The root elements must grow too, or the shortened layout viewport clips everything below it.
  const root = document.documentElement; root.classList.add('standalone');
  root.style.height = document.body.style.height = full + 'px';
  app.style.bottom = 'auto'; app.style.height = full + 'px';
}
fitStandalone();
addEventListener('resize', fitStandalone); addEventListener('orientationchange', () => setTimeout(fitStandalone, 250));

async function boot() {
  const r = await load();
  renderer = G.renderer = new Renderer(glCanvas, overlay);
  adopt(r.state);
  ui = initUI(app, hooks);
  ui.setMode('hangar');
  if (r.recovered) toast('The main save was unreadable. Restored from the backup.', 'warn');
  // One-time welcome gift for pilots of the original Last Orbit on this device.
  if (!G.state.meta.legacyChecked) {
    G.state.meta.legacyChecked = true; const best = await legacyBestWave();
    if (best > 1) { const gift = Math.min(1500, Math.round(best * 6)); G.state.salvage += gift; toast(`Veteran pilot detected (best wave ${best} in the original). +${gift} salvage to get you started.`, 'unlock'); }
    save('legacy');
  }
  wireInput();
  addEventListener('resize', () => { renderer.resize(); ui.measure(); }); new ResizeObserver(() => { renderer.resize(); ui.measure(); }).observe(app);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; suspendAudio(true); if (G.mode === 'sortie' && !ui.blocking()) ui.pause(); save('hidden'); }
    else { suspendAudio(false); last = performance.now(); running = true; }
  });
  // The run stays in the save; if the page never comes back, the next boot banks its salvage (see adopt).
  addEventListener('pagehide', () => save('pagehide'));
  if (/[?&]debug=1/.test(location.search)) import('@last-orbit/ui/debug.js').then((m) => m.initDebug(app, { hooks, ui })).catch((e) => console.warn(e));
  document.getElementById('boot').classList.add('off'); setTimeout(() => document.getElementById('boot')?.remove(), 800);
  last = performance.now(); running = true; requestAnimationFrame(frame);
}
function start() { if (window.THREE) boot().catch((e) => { console.error(e); document.getElementById('boot').innerHTML = '<h1>Last Orbit</h1><p>Could not start: ' + String(e.message || e) + '</p>'; }); else document.getElementById('boot').innerHTML = '<h1>Last Orbit</h1><p>Three.js failed to load. Check your connection and reload.</p>'; }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
