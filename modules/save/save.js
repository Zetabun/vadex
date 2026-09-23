// Persistence. IndexedDB is primary, localStorage mirrors it, and a rotating backup slot covers a corrupt main slot.
// v2 saves live under their own keys, so the original incremental save is never overwritten.
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState, withDefaults, SCHEMA } from '@last-orbit/core/state.js';

const DB = 'last-orbit', STORE = 'saves', LS = 'last-orbit:', MAIN = 'v2_main', BACKUP = 'v2_backup', SANDBOX = 'v2_sandbox';
let db = null, dbTried = false;
function openDb() {
  if (db || dbTried || typeof indexedDB === 'undefined') return Promise.resolve(db); dbTried = true;
  return new Promise((res) => { try { const rq = indexedDB.open(DB, 1); rq.onupgradeneeded = () => rq.result.createObjectStore(STORE); rq.onsuccess = () => { db = rq.result; res(db); }; rq.onerror = () => res(null); rq.onblocked = () => res(null); } catch { res(null); } });
}
async function put(key, val) {
  try { localStorage.setItem(LS + key, val); } catch { /* storage may be unavailable; IndexedDB still tried */ }
  const d = await openDb(); if (!d) return;
  await new Promise((res) => { try { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(val, key); tx.oncomplete = res; tx.onerror = res; tx.onabort = res; } catch { res(); } });
}
async function get(key) {
  const d = await openDb(); let a = null;
  if (d) a = await new Promise((res) => { try { const rq = d.transaction(STORE).objectStore(STORE).get(key); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); } catch { res(null); } });
  let b = null; try { b = localStorage.getItem(LS + key); } catch { /* ignore */ }
  if (a && b) { try { return JSON.parse(a).meta.lastSave >= JSON.parse(b).meta.lastSave ? a : b; } catch { return a; } }
  return a || b;
}
async function del(key) { try { localStorage.removeItem(LS + key); } catch { /* ignore */ } const d = await openDb(); if (d) await new Promise((res) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(key); tx.oncomplete = res; tx.onerror = res; }); }

// Schema migrations: each entry upgrades v → v+1. Never remove entries. v2 saves start at schema 20.
const MIGRATIONS = {};
export function parseSave(text) {
  let raw = text.trim(); if (!raw.startsWith('{')) raw = decodeURIComponent(escape(atob(raw)));
  let s = JSON.parse(raw); if (!s || typeof s !== 'object' || !s.unlocked || !s.stats) throw new Error('Not a Last Orbit v2 save');
  const version = Number(s.v || SCHEMA);
  if (version > SCHEMA) { const e = new Error(`This save was created by a newer version of Last Orbit (schema ${version}; this build supports ${SCHEMA}).`); e.code = 'NEWER_SAVE'; throw e; }
  for (let v = version; v < SCHEMA; v++) if (MIGRATIONS[v]) s = MIGRATIONS[v](s);
  s.v = SCHEMA;
  return withDefaults(s, newState());
}
const slot = () => (G.state?.meta.sandbox ? SANDBOX : MAIN);
export const serialize = () => JSON.stringify(G.state);

let lastBackup = 0;
export async function save(reason = 'auto') {
  if (!G.state) return; const now = Date.now(); G.state.meta.lastSave = now;
  const text = serialize(); await put(slot(), text);
  if (!G.state.meta.sandbox && now - lastBackup > 5 * 60000) { lastBackup = now; await put(BACKUP, text); }
  bus.emit('saved', reason);
}
export async function load() {
  for (const key of [MAIN, BACKUP]) { const t = await get(key); if (!t) continue; try { const s = parseSave(t); s.meta.sandbox = false; return { state: s, recovered: key !== MAIN }; } catch (e) { if (e?.code === 'NEWER_SAVE') throw e; console.warn('Save slot unreadable:', key, e); } }
  return { state: newState(), fresh: true };
}
/** Best wave from an original (v1) Last Orbit save on this device, if any. Read-only. */
export async function legacyBestWave() {
  try { const t = await get('main'); if (!t) return 0; const s = JSON.parse(t); return Math.max(0, Number(s?.stats?.bestWave) || 0); } catch { return 0; }
}
export function exportSave() { return btoa(unescape(encodeURIComponent(serialize()))); }
export function importSave(text) { const s = parseSave(text); s.meta.sandbox = G.state.meta.sandbox; return s; }
export async function hardReset() { await del(slot()); if (slot() === MAIN) await del(BACKUP); }
/** Enter the debug sandbox: clone the live state into a separate slot. The real save is left exactly as it was. */
export async function enterSandbox() { await save('pre-sandbox'); G.state.meta.sandbox = true; await save('sandbox'); }
export async function leaveSandbox() { await del(SANDBOX); }
