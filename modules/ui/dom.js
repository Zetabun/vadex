// Tiny DOM helpers. No framework: screens build their nodes once and patch text/classes on update.
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

export function toggle(get, set, label) { const el = h('button.tog', { role: 'switch', 'aria-label': label, onclick: () => { set(!get()); sync(); playSfx('tab'); } }, h('i')); const sync = () => { const on = !!get(); el.classList.toggle('on', on); el.setAttribute('aria-checked', String(on)); }; sync(); return el; }
export function slider(get, set, min = 0, max = 1, step = 0.05, label = '') { const el = h('input', { type: 'range', min, max, step, 'aria-label': label, oninput: () => set(+el.value) }); el.value = get(); return el; }
export function select(options, get, set, label = '') { const el = h('select', { 'aria-label': label, onchange: () => set(el.value) }, options.map(([v, t]) => h('option', { value: v }, t))); el.value = get(); return el; }
