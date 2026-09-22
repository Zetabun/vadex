// Shared game context. Systems import G instead of each other; G.state is the save, G.sheet the derived stats, G.world the live battle.
import { Sheet, computeSheet } from '@last-orbit/progression/stats.js';
import { bus } from '@last-orbit/core/events.js';
export const G = { state: null, sheet: new Sheet(), world: null, paused: false, debugSpeed: 1, headless: false, ui: { mult: 1 }, renderer: null };
/** Recompute derived stats after any purchase/equip/unlock. Cheap enough to call eagerly. */
export function recalc() { computeSheet(G.state, G.sheet); bus.emit('stats'); }
export function stat(id) { return G.sheet.n(id); }
export function flag(id) { return G.sheet.f(id) > 0; }
/** Bump a lifetime + per-run counter. */
export function count(key, n = 1) { const s = G.state.stats, r = G.state.run.stats; s[key] = (s[key] || 0) + n; r[key] = (r[key] || 0) + n; }
export function maxStat(key, v) { const s = G.state.stats; if (!(s[key] >= v)) s[key] = v; }
export function toast(text, kind = 'info') { bus.emit('toast', text, kind); }
