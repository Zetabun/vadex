// Tiny DOM helpers. No framework: panels build their nodes once and patch text/classes on a 4 Hz update.
import { G } from '@last-orbit/core/game.js';
import { fmt } from '@last-orbit/core/format.js';
import { CUR } from '@last-orbit/core/state.js';
import { playSfx } from '@last-orbit/audio/audio.js';

/** h('div.card.can', {onclick}, child, 'text', [more]) */
export function h(sel, props, ...kids) {
  const parts = sel.split('.'), tag = parts[0] || 'div', el = document.createElement(tag.replace(/#.*/, ''));
  const id = tag.split('#')[1]; if (id) el.id = id; if (parts.length > 1) el.className = parts.slice(1).join(' ');
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { kids.unshift(props); props = null; }
  if (props) for (const k in props) { const v = props[k]; if (v == null) continue; if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'style') el.style.cssText = v; else if (k === 'html') el.innerHTML = v; else if (k in el && k !== 'list') el[k] = v; else el.setAttribute(k, v); }
  add(el, kids); return el;
}
export function displayText(v) { return v == null || v === 'null' || v === 'undefined' ? '' : v; }
function add(el, kids) { for (const k of kids) { if (k == null || k === false) continue; if (Array.isArray(k)) add(el, k); else if (k instanceof Node) el.append(k); else { const v = displayText(k); if (v !== '') el.append(document.createTextNode(String(v))); } } }
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
/** Only touch the DOM when the value changed. Nullish display values are always rendered as empty text. */
export function setText(el, s) { s = displayText(s); if (el._t !== s) { el._t = s; el.textContent = s; } }
export function setClass(el, name, on) { on = !!on; if (el['_c' + name] !== on) { el['_c' + name] = on; el.classList.toggle(name, on); } }
export function setWidth(el, f) { const s = (Math.max(0, Math.min(1, f)) * 100).toFixed(1) + '%'; if (el._w !== s) { el._w = s; el.style.width = s; } }

/** Tap, or press and hold to repeat (accelerating). fn returns false to stop. */
export function holdable(el, fn) {
  let timer = null, n = 0, pointer = null, x = 0, y = 0, repeated = false, cancelled = false;
  const stop = () => { clearTimeout(timer); timer = null; pointer = null; };
  const tick = () => {
    if (!el.isConnected || el.disabled || cancelled) return stop();
    repeated = true;
    if (fn() === false) return stop();
    n++; timer = setTimeout(tick, Math.max(60, 260 - n * 28));
  };
  el.addEventListener('pointerdown', (e) => {
    if (el.disabled || (e.button != null && e.button !== 0) || e.isPrimary === false) return;
    stop(); pointer = e.pointerId; x = e.clientX; y = e.clientY; n = 0; repeated = false; cancelled = false;
    // A scrolling gesture must never purchase an upgrade. Commit a tap on release.
    timer = setTimeout(tick, 350);
  });
  el.addEventListener('pointermove', (e) => { if (pointer === e.pointerId && Math.hypot(e.clientX - x, e.clientY - y) > 10) { cancelled = true; stop(); } });
  el.addEventListener('pointerup', (e) => { if (pointer !== e.pointerId) return; const tap = !repeated && !cancelled && !el.disabled; stop(); if (tap) fn(); });
  for (const ev of ['pointerleave', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, () => { cancelled = true; stop(); });
  el.addEventListener('click', (e) => { if (e.detail === 0 && !el.disabled) fn(); });
  return el;
}

export function costText(cur, amt) { return CUR[cur].icon + ' ' + fmt(amt); }
export function toggle(get, set) { const sync = () => { const on = !!get(); el.classList.toggle('on', on); el.setAttribute('aria-checked', String(on)); }; const el = h('button.tog', { role: 'switch', onclick: () => { set(!get()); sync(); playSfx('tab'); } }); sync(); return el; }
export function field(label, hint, control) { if (control && !control.getAttribute('aria-label')) control.setAttribute('aria-label', label); return h('div.field', h('div', label, hint ? h('small', hint) : null), control); }
export function select(options, get, set) { const el = h('select', { onchange: () => set(el.value) }, options.map(([v, t]) => h('option', { value: v }, t))); el.value = get(); return el; }
export function slider(get, set, min = 0, max = 1, step = 0.05) { const el = h('input', { type: 'range', min, max, step, oninput: () => set(+el.value) }); el.value = get(); return el; }
export function tabs(list, get, set) { const bar = h('div.tabs', { role: 'tablist' }); const btns = list.map(([id, name]) => { const b = h('button.tab', { role: 'tab', onclick: () => { set(id); sync(); playSfx('tab'); } }, name, h('span.pip')); b._id = id; bar.append(b); return b; }); const sync = () => btns.forEach((b) => { const on = b._id === get(); b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); sync(); bar.btns = btns; bar.sync = sync; return bar; }

/** Buy-amount selector shared by Upgrades and Arsenal. Options appear as they are researched. */
export const MULTS = [[1, '×1', null], ['next', 'Next ★', null], [10, '×10', 'f.buy10'], [25, '×25', 'f.buy25'], [100, '×100', 'f.buy100'], ['max', 'Max', 'f.buymax']];
export function multBar(onChange) {
  const bar = h('div.mults'); let sig = '';
  bar.refresh = () => { const avail = MULTS.filter((m) => !m[2] || G.sheet.f(m[2]) > 0), s = avail.map((m) => m[0]).join() + G.ui.mult; if (s === sig) return; sig = s; clear(bar); if (!avail.some((m) => m[0] === G.ui.mult)) G.ui.mult = 1;
    for (const [v, t] of avail) bar.append(h('button.mult' + (G.ui.mult === v ? '.on' : ''), { onclick: () => { G.ui.mult = v; playSfx('tab'); bar.refresh(); onChange && onChange(); } }, t)); };
  bar.refresh(); return bar;
}
