// UI root: switches between the Hangar and the sortie HUD, owns overlays, banners, toasts and screen effects,
// and tells the renderer how much of the screen the battlefield may use.
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { playSfx, setThrust } from '@last-orbit/audio/audio.js';
import { h, clear } from '@last-orbit/ui/dom.js';
import { createHud } from '@last-orbit/ui/hud.js';
import { createHangar } from '@last-orbit/ui/hangar.js';
import { createOverlays } from '@last-orbit/ui/overlays.js';
import { art } from '@last-orbit/ui/art.js';
import { createIntro } from '@last-orbit/ui/intro.js';
import { createComms } from '@last-orbit/ui/comms.js';

export function initUI(app, hooks) {
  const $ = {};
  $.scan = h('div#scan'); $.vig = h('div#vig'); $.flash = h('div#flash');
  $.banner = h('div#banner', { 'aria-live': 'polite' }); $.toasts = h('div#toasts', { 'aria-live': 'polite' });
  $.layer = h('div#layer');
  const uiHooks = {
    ...hooks,
    measure: () => setTimeout(measure, 0),
    blocking: () => overlays.blocking(),
    flash: (color) => flash(color),
    nextChoice: () => nextChoice(),
    settings: () => overlays.showSettings(false),
    counterIntro: (go) => overlays.showCounterIntro(go),
    confirmOverhaul: () => overlays.showOverhaul(),
    menuIntro: (m) => overlays.showMenuIntro(m),
    replayIntro: () => { overlays.close(); intro.play({ tap: false }); },
    panel: (o) => overlays.showPanel(o),
    nameStation: () => overlays.showStationName(),
    stationNamed: () => { if (G.mode === 'hangar') hangar.render(); },
    closeOverlays: () => overlays.close(),
    stationComplete: () => overlays.showStationComplete(),
    callsignSet: (name, first) => { if (G.mode === 'hangar') hangar.render(); if (first) greet(true); },
    overhauled: (bp) => { banner('Overhaul complete', `Rank ${G.state.prestige.level}`, `+${bp} Blueprints`, '#ff9f43', 2200); if (G.mode === 'hangar') hangar.render(); },
    pause: () => { if (G.mode === 'sortie' && !overlays.blocking()) { playSfx('tab'); overlays.showPause(); } },
    toHangar: (tab) => hooks.toHangar(tab),
    toast: (text, kind = 'good') => toast(text, kind),
    cardPicked: (c) => { if (c.kind === 'upgrade' && c.rank === 7) banner('Final evolution', null, null, 'var(--gold)', 1400); hooks.celebrate?.(c.kind === 'weapon' || c.kind === 'upgrade' ? '#5ee6ff' : '#6dffc8'); },
  };
  const hud = createHud(uiHooks), hangar = createHangar(uiHooks), overlays = createOverlays($.layer, uiHooks);
  const intro = createIntro(app), comms = createComms(app); let commsT = 0;
  app.append($.scan, hud.el, hangar.el, $.vig, $.banner, $.toasts, $.layer, $.flash);

  // ------------------------------------------------------------ mode
  function setMode(mode, tab) {
    G.mode = mode; app.dataset.mode = mode;
    if (mode === 'hangar') { hangar.show(tab || 'launch', true); G.renderer?.setView('hangar'); setThrust(0); }
    else { hud.reset(); G.renderer?.setView('field'); }
    $.scan.classList.toggle('off', !G.state.settings.scanlines);
    measure();
  }
  /** Leave the battlefield visible between the HUD bars (sortie) or above the panel (hangar). */
  function measure() {
    const r = app.getBoundingClientRect();
    if (G.mode === 'sortie') { hooks.setInsets(hud.top.getBoundingClientRect().bottom - r.top - 4, r.bottom - hud.dock.getBoundingClientRect().top - 2); return; }
    const stage = hangar.el.querySelector('.ship-stage');
    if (hangar.tab === 'launch' && stage) { const s = stage.getBoundingClientRect(); hooks.setInsets(Math.max(0, s.top - r.top), Math.max(0, r.bottom - s.bottom)); }
    else hooks.setInsets(r.height * 0.02, r.height * 0.55);
  }

  // ------------------------------------------------------------ choices
  /** Show whichever choice is waiting (relic first, then level-ups). Returns false when nothing is pending. */
  function nextChoice() {
    const run = G.state.run; if (!run) return false;
    if (hooks.pendingRelic()) { overlays.showRelics(); return true; }
    if (hooks.pendingRoute()) { overlays.showRoutes(); return true; }
    if (hooks.pendingAnomaly?.()) { overlays.showAnomalies(); return true; }
    if (hooks.pendingOffer()) { overlays.showOffer(); return true; }
    return false;
  }

  // ------------------------------------------------------------ banners, toasts, effects
  let bannerT = 0;
  function banner(kicker, title, sub, color = 'var(--amber)', ms = 2200) {
    const box = clear($.banner); if (kicker) box.append(h('div.k', kicker)); if (title) box.append(h('h2', { style: 'color:' + color }, title)); if (sub) box.append(h('p', sub));
    $.banner.classList.remove('on'); void $.banner.offsetWidth; $.banner.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => $.banner.classList.remove('on'), ms);
  }
  function post(el, kind, ms) {
    $.toasts.append(el); while ($.toasts.children.length > 2) $.toasts.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
    if (kind === 'unlock' || kind === 'legendary') playSfx('unlock');
  }
  function toast(text, kind) { post(h('div.toast.' + kind, h('span.toast-text', text)), kind, kind === 'unlock' ? 5200 : 3200); }
  /** Structured notice: artwork, kicker, title, detail line and an optional salvage reward. */
  function notice(n) {
    const el = h('div.toast.notice.' + (n.kind || 'info'),
      n.art ? h('div.notice-art' + (n.tier ? '.medal-frame.tier-' + n.tier : ''), art(n.art, 'notice-ico')) : null,
      h('div.notice-main', h('small', n.kicker || ''), h('b', n.title || ''), n.sub ? h('span', n.sub) : null),
      n.salvage ? h('div.notice-reward', art('cur:salvage', 'cur-ico'), '+' + n.salvage) : n.xp ? h('div.notice-reward.xp', '+' + n.xp, h('small', 'XP')) : null);
    post(el, n.kind, 5200);
  }
  bus.on('notice', notice);
  function flash(color = '#fff') { $.flash.style.background = color; $.flash.style.transition = 'none'; $.flash.style.opacity = '0.35'; requestAnimationFrame(() => { $.flash.style.transition = 'opacity .5s ease-out'; $.flash.style.opacity = '0'; }); }
  bus.on('toast', toast);
  bus.on('fx', (e) => {
    if (G.mode !== 'sortie') return;
    if (e.k === 'wave') { const kind = e.c; if (kind === 'elite') banner('Wave ' + e.a, 'Elite wave', 'Glowing enemies are tougher and drop more loot', 'var(--violet)', 1800); else if (kind === 'challenge') banner('Wave ' + e.a, e.b, G.world.wave.info.mod?.desc, 'var(--amber)', 2000); else if (kind === 'resource') banner('Wave ' + e.a, 'Salvage convoy', 'Shoot the haulers before they escape', 'var(--gold)', 1900); else if (kind === 'swarm') banner('Wave ' + e.a, 'Swarm', null, '#ff9bd2', 1400); }
    else if (e.k === 'sector') banner('Sector ' + (e.a + 1), e.b, e.c, 'var(--cyan)', 3200);
    else if (e.k === 'bossIntro') banner(e.b, e.a, null, typeof e.c === 'number' ? '#' + e.c.toString(16).padStart(6, '0') : e.c, 2600);
    else if (e.k === 'sectorClear') { banner('Sector cleared', e.b, 'Hull restored', 'var(--green)', 2400); flash('#6dffc8'); }
    else if (e.k === 'hurt') { $.vig.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => $.vig.classList.remove('on'))); }
  });
  bus.on('levelUp', () => { playSfx('milestone'); });
  bus.on('synergy', (s, t) => { if (G.mode !== 'sortie') return; banner('Synergy · ' + s.name, t.desc, null, s.color, 2600); flash(s.color); playSfx('unlock'); });

  // ------------------------------------------------------------ input routing
  addEventListener('keydown', (e) => {
    if (overlays.blocking()) { if (overlays.key(e)) e.preventDefault(); return; }
    if (G.mode === 'sortie' && (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) { uiHooks.pause(); e.preventDefault(); }
    else if (G.mode === 'hangar' && e.key === 'Enter' && hangar.tab === 'launch' && !e.target.closest?.('button,input,select')) hooks.launch();
  });

  function update(dt) {
    if (G.mode === 'sortie') hud.update(dt); else hangar.update();
    // The station AI speaks up at milestones, in the hangar, once the pilot has a callsign.
    if (G.mode === 'hangar' && !G.introPlaying && G.state.seen.callsign && !overlays.blocking() && (commsT -= dt) <= 0) { commsT = 1.5; comms.check(); }
  }
  /** The greeting when the app opens (or right after a new pilot registers). */
  function greet(fresh) { const n = G.state.pilot.name; if (n) banner(fresh ? 'Welcome aboard' : 'Welcome back', n, null, 'var(--cyan)', 2600); }
  addEventListener('resize', () => setTimeout(measure, 50));
  return {
    update, setMode, measure, banner, nextChoice, greet,
    intro: (o) => intro.play(o), comms,
    callsign: (o) => overlays.showCallsign(o),
    blocking: () => overlays.blocking(),
    showDebrief: (s) => { clear($.toasts); $.banner.classList.remove('on'); overlays.showDebrief(s); },
    pause: () => uiHooks.pause(),
    /** A short tap on the battlefield: if it landed on a loadout icon, explain the loadout. */
    tapHud: (x, y) => { if (overlays.blocking()) return false; const key = hud.loadoutAt(x, y); if (!key) return false; playSfx('tab'); overlays.showLoadout(key, false); return true; },
    refreshHangar: () => { if (G.mode === 'hangar') hangar.render(); },
    closeOverlays: () => overlays.close(),
  };
}
