// Entry point: boot, input, the frame loop, autosave and the Hangar ⇄ Sortie flow.
// Simulation time is decoupled from rendering (see combat/sim.js advance()).
import { G, recalc, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { setNotation } from '@last-orbit/core/format.js';
import { erasedState, introDue } from '@last-orbit/core/state.js';
import { FIELD } from '@last-orbit/data/balance.js';
import { initWorld, advance } from '@last-orbit/combat/sim.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { collectAll } from '@last-orbit/combat/pickups.js';
import { recStart, recTick, recStop } from '@last-orbit/progression/recorder.js';
import { startSortie, endSortie, nextOffer, nextRelic, nextRoute, nextAnomaly, recoverInterruptedRun, resumeOffer, resumeInfo } from '@last-orbit/progression/run.js';
import { resetOrigin } from '@last-orbit/progression/cipher.js';
import { checkContracts, unlockCounter, refreshMenus, notePeaks } from '@last-orbit/progression/meta.js';
import { save, load, hardReset, legacyBestWave } from '@last-orbit/save/save.js';
import { initAudio, applyVolumes, tickMusic, setMusicMode, suspendAudio } from '@last-orbit/audio/audio.js';
import { Renderer } from '@last-orbit/rendering/renderer.js';
import { initUI } from '@last-orbit/ui/ui.js';

const app = document.getElementById('app'), glCanvas = document.getElementById('gl'), overlay = document.getElementById('overlay');
let renderer, ui, last = 0, saveT = 0, running = false, levelBeat = 0, lastLaunch = {};

function adopt(state, boot = false) {
  // A main sortie cut short when the app closed is offered at launch, to resume or end (progression/run.js resumeOffer);
  // any other sortie interrupted (Counterattack, or a save restored mid-run) cannot be resumed, but its salvage is kept.
  const resumable = boot ? resumeOffer(state) : null, recovered = resumable ? 0 : recoverInterruptedRun(state);
  G.state = state;
  if (recovered > 0) setTimeout(() => toast(`Recovered ${recovered} salvage from your last sortie.`, 'good'), 600);
  setNotation(state.settings.notation); recalc(); checkContracts({ silent: true }); unlockCounter({ silent: true }); refreshMenus(); notePeaks(state); initWorld(); applyVolumes();
  if (renderer) { renderer.lastSector = -1; renderer.lookV = -1; renderer.setQuality(); }
}

const hooks = {
  setInsets: (t, b) => renderer && renderer.setInsets(t, b),
  applySettings: () => { renderer.setQuality(); setNotation(G.state.settings.notation); document.getElementById('scan')?.classList.toggle('off', !G.state.settings.scanlines); },
  celebrate: (color) => { const p = G.world.player; renderer.celebrate(p.x, p.y + 6, color, 40); },
  launch: (opts = {}) => { initAudio(); lastLaunch = opts; if (!startSortie(opts)) { toast('Today\'s Daily Sortie has already been flown.', 'warn'); return; } initWorld(); const run = G.state.run; recStart({ ship: run.ship, mode: run.mode || 'main', daily: !!run.daily }); ui.setMode('sortie'); save('launch'); if (nextOffer()) ui.nextChoice(); },
  abandon: () => finish('abandoned'),
  relaunch: (next, opts) => hooks.launch(next ? { ...lastLaunch, counter: lastLaunch.counter + 1, checkpoint: false } : { ...lastLaunch, checkpoint: false, ...opts }),
  counterNotice: () => {},
  toHangar: (tab) => { initWorld(); ui.setMode('hangar', tab); },
  toSiege: (n) => { initWorld(); ui.setMode('hangar', 'control'); ui.siege(n); },
  pendingOffer: () => nextOffer(),
  pendingRelic: () => nextRelic(),
  pendingRoute: () => nextRoute(),
  pendingAnomaly: () => nextAnomaly(),
  // a save restored from a backup code replaces this device's progress, and is saved at once
  restoreSave: async (s) => { adopt(s); ui.setMode('hangar'); await save('restore'); toast('Progress restored from your backup.', 'good'); },
  saveNow: (why = 'manual') => save(why),
  hardReset: async () => { await hardReset(); const s = erasedState(G.state); /* keeps their place on the global boards and having seen the opening */ adopt(s); ui.setMode('hangar'); await save('reset'); toast('Save erased. Good luck, pilot.', 'warn'); setTimeout(() => ui.callsign({ first: true }), 600); },
};

function finish(reason) {
  if (!G.state.run) return;
  if (G.world) collectAll(G.world);
  const summary = endSortie(reason); recStop({ reason, wave: summary.wave });
  save('sortie-end');
  ui.showDebrief(summary);
}
bus.on('sortieOver', (reason) => setTimeout(() => finish(reason), 350));
/** A sortie the app closed in the middle of: resume it, or end it (the debrief, as if it had been abandoned). */
function offerResume() {
  const r = G.state.resume; if (!r?.run) return;
  ui.resume({ info: resumeInfo(r), onResume: resumeSortie, onEnd: endResumed });
}
/** Back into the fight at the start of the wave it was on (or between waves, where it was), everything as it was then. */
function resumeSortie() {
  const st = G.state, r = st.resume; if (!r?.run) return;
  try {
    initAudio(); st.run = r.run; delete r.live; resetOrigin(st.run); G.mode = 'sortie'; recalc(); initWorld();
    const w = G.world, run = st.run; w.player.hull = Math.max(0.05, r.hull ?? 1); w.player.shield = r.shield ?? 0;
    (r.barriers || []).forEach((hp, i) => { if (w.barriers[i]) w.barriers[i].hp = hp; });
    w.wave.num = Math.max(0, run.wave - 1); /* the wave before it: so the sector it is in does not count as a new one */
    recStart({ ship: run.ship, mode: 'main', daily: !!run.daily }); ui.setMode('sortie'); save('resume'); ui.nextChoice();
    toast(`Back in the fight: wave ${run.wave}.`, 'good');
  } catch (e) { console.warn('Could not resume the sortie:', e); endResumed(); }
}
/** End it instead: the sortie as it stood when the app closed is banked, with its debrief. */
function endResumed() {
  const st = G.state, r = st.resume; if (!r?.run) return;
  st.run = r.live || r.run; st.resume = null; resetOrigin(st.run); G.mode = 'sortie'; recalc(); initWorld(); G.world.wave.num = st.run.wave; finish('abandoned');
}
// A level-up gets a brief beat of celebration in the battle before the card choice freezes it.
bus.on('levelUp', (lvl) => { if (G.mode !== 'sortie' || !G.world) return; if (levelBeat <= 0) levelBeat = 0.45; const p = G.world.player; renderer.celebrate(p.x, p.y + 4, '#6dffc8', 50); G.world.fx.push({ k: 'text', a: p.x, b: p.y + 12, c: 'LEVEL ' + lvl, d: '#6dffc8', e: 2 }); });

// ------------------------------------------------------------------ input
function wireInput() {
  const inp = () => G.world.input;
  const at = (e) => { const r = glCanvas.getBoundingClientRect(); return renderer.screenToWorld(e.clientX - r.left, e.clientY - r.top); };
  const sideOf = (e) => { const r = glCanvas.getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? -1 : 1; };
  // Two touch schemes at once: hold the left or right half of the screen to fly that way, or drag to steer.
  // A press is a hold unless the finger sets off quickly (a swipe), which makes it a relative drag. A held finger that
  // drifts keeps holding, following whichever half it is on. Every finger is tracked, and the newest one steers, so a
  // second touch (an ability, a tap on an enemy) never cancels the first. Short taps mark targets or open the loadout.
  const holdOn = () => G.state.settings.holdSides !== false;
  const touches = new Map(); let cur = null, lastDown = null;
  const steer = () => { const i = inp(); i.active = !!cur; i.hold = cur && !cur.drag ? cur.side : 0; };
  glCanvas.addEventListener('pointerdown', (e) => {
    initAudio(); if (G.mode !== 'sortie') return; e.preventDefault(); try { glCanvas.setPointerCapture(e.pointerId); } catch { /* not critical */ }
    const p = at(e), now = performance.now(), side = sideOf(e);
    // Double-tap a side to dash that way.
    if (lastDown && now - lastDown.t < 300 && lastDown.side === side && Math.abs(e.clientX - lastDown.x) < 90) { inp().dash = side; lastDown = null; } else lastDown = { t: now, side, x: e.clientX };
    const counter = !!G.world.counter; // Counterattack always steers by dragging, in both directions
    cur = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), sx: p.x, lx: p.x, sy: p.y, ly: p.y, px: G.world.player.x, py: G.world.player.y, drag: counter || !holdOn(), side: sideOf(e) };
    touches.set(e.pointerId, cur); inp().targetX = G.world.player.x; inp().targetY = G.world.player.y; steer();
  });
  glCanvas.addEventListener('pointermove', (e) => {
    const d = touches.get(e.pointerId); if (!d) return; const p = at(e); d.lx = p.x; d.ly = p.y;
    if (!d.drag) {
      if (performance.now() - d.t < 200 && Math.abs(e.clientX - d.x) > 18) { d.drag = true; d.sx = p.x; d.px = G.world.player.x; }
      else d.side = sideOf(e);
    }
    if (d === cur) { if (d.drag) { inp().targetX = d.px + (p.x - d.sx) * 1.35; inp().targetY = d.py + (p.y - d.sy) * 1.35; } steer(); }
  });
  const up = (e) => {
    const d = touches.get(e.pointerId); if (!d) return; touches.delete(e.pointerId);
    if (e.type === 'pointerup' && performance.now() - d.t < 260 && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 12) {
      if (!ui.tapHud(e.clientX, e.clientY)) { const p = at(e); if (p.y > FIELD.BARRIER_Y + 6) inp().tap = p; }
    }
    if (d === cur) {
      cur = [...touches.values()].pop() || null; // hand steering back to a finger still down
      if (cur?.drag) { cur.sx = cur.lx; cur.sy = cur.ly; cur.px = G.world.player.x; cur.py = G.world.player.y; inp().targetX = G.world.player.x; inp().targetY = G.world.player.y; }
    }
    steer();
  };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) glCanvas.addEventListener(ev, up);
  // Anything that interrupts the page drops every touch, so the ship never flies off on a finger lifted elsewhere.
  const drop = () => { touches.clear(); cur = null; if (G.world) steer(); };
  addEventListener('blur', drop); document.addEventListener('visibilitychange', drop);
  const keys = { l: false, r: false, u: false, d: false };
  addEventListener('keydown', (e) => {
    if (G.mode !== 'sortie' || ui.blocking() || e.target.closest?.('input,textarea,select')) return;
    const i = inp();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyF') { i.dash = i.keys || (G.world.player.vx < 0 ? -1 : 1); e.preventDefault(); }
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = true; else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = true;
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { keys.u = true; e.preventDefault(); } else if (e.code === 'ArrowDown' || e.code === 'KeyS') { keys.d = true; e.preventDefault(); }
    else if (/^Digit[1-2]$/.test(e.code) || e.code === 'KeyQ' || e.code === 'KeyE' || e.code === 'Space') { const idx = e.code === 'KeyE' || e.code === 'Digit2' ? 1 : 0; const id = G.state.run.abilities[idx]; if (id) useAbility(G.world, id); e.preventDefault(); }
    i.keys = (keys.r ? 1 : 0) - (keys.l ? 1 : 0); i.keysY = (keys.u ? 1 : 0) - (keys.d ? 1 : 0); });
  addEventListener('keyup', (e) => { if (!G.world) return; const i = inp(); if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = false; else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = false; else if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.u = false; else if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.d = false; i.keys = (keys.r ? 1 : 0) - (keys.l ? 1 : 0); i.keysY = (keys.u ? 1 : 0) - (keys.d ? 1 : 0); });
  const editable = (target) => !!target?.closest?.('input,textarea,select');
  const block = (e) => { if (!editable(e.target) && e.cancelable) e.preventDefault(); };
  for (const ev of ['contextmenu', 'selectstart', 'dragstart']) app.addEventListener(ev, block);
  document.addEventListener('dblclick', block, { passive: false }); // no double-tap zoom anywhere
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) app.addEventListener(ev, block, { passive: false });
  app.addEventListener('touchmove', (e) => { if (e.touches.length > 1) block(e); }, { passive: false });
  // iOS raises its magnifier on a long press or a double-tap-and-hold (a dodge, or holding a corner to steer) unless the
  // touch itself is cancelled; cancelling pointer events is not enough. In a sortie, cancel touches on the battlefield,
  // leaving buttons and the overlay layer (level-ups, pause) alone so their taps still land.
  const control = (t) => t?.closest?.('button, a, input, select, textarea, #layer');
  for (const ev of ['touchstart', 'touchend']) app.addEventListener(ev, (e) => { if (G.mode === 'sortie' && e.cancelable && !control(e.target)) e.preventDefault(); }, { passive: false });
}

// ------------------------------------------------------------------ loop
function frame(now) {
  requestAnimationFrame(frame); if (!running) return;
  const real = Math.min(0.1, Math.max(0, (now - last) / 1000 || 0.016)); last = now;
  const paused = ui.blocking();
  const speed = paused ? 0 : Math.max(0, G.sheet.n('gameSpeed') * G.debugSpeed * (G.state.settings.speed || 1));
  if (speed > 0) { advance(real * speed); if (G.mode === 'sortie') recTick(G.world, real * speed); }
  // A level-up or sector relic freezes combat until the pilot chooses.
  if (levelBeat > 0) levelBeat -= real;
  else if (G.mode === 'sortie' && !paused && G.state.run && (nextRelic() || nextRoute() || nextAnomaly() || nextOffer())) ui.nextChoice();
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
  adopt(r.state, true);
  ui = initUI(app, hooks);
  ui.setMode('hangar');
  if (r.recovered) toast('The main save was unreadable. Restored from the backup.', 'warn');
  // One-time welcome gift for pilots of the original Last Orbit on this device.
  if (!G.state.meta.legacyChecked) {
    G.state.meta.legacyChecked = true; const best = await legacyBestWave();
    if (best > 1) { const gift = Math.min(1500, Math.round(best * 6)); G.state.salvage += gift; toast(`Veteran pilot detected (best wave ${best} in the original). +${gift} salvage to get you started.`, 'unlock'); }
    save('legacy');
  }
  // Callsign: asked once (new pilots, and existing ones the first time this version runs); after that, a greeting.
  // The opening cinematic plays once, for a pilot who has not flown yet (core/state.js introDue), then the callsign;
  // Settings > Story plays it again.
  const afterIntro = () => { if (!G.state.seen.callsign) setTimeout(() => ui.callsign({ first: true }), 300); else setTimeout(() => (G.state.resume ? offerResume() : ui.greet()), 400); };
  if (!/[?&]scene=/.test(location.search)) { if (introDue(G.state)) ui.intro({ tap: true, done: () => { G.state.seen.intro = true; save('intro'); afterIntro(); } }); else afterIntro(); }
  wireInput();
  addEventListener('resize', () => { renderer.resize(); ui.measure(); }); new ResizeObserver(() => { renderer.resize(); ui.measure(); }).observe(app);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; suspendAudio(true); if (G.mode === 'sortie' && !ui.blocking() && !G.demo) ui.pause(); save('hidden'); }
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
