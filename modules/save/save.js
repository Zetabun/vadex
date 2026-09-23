// Persistence. IndexedDB is primary, localStorage mirrors it, and a rotating backup slot covers a corrupt main slot.
// Debug/sandbox sessions write to their own slot so cheats can never touch a real save.
import { bigReviver } from '@last-orbit/core/big.js';
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState, withDefaults, SCHEMA, ONBOARDING_VERSION } from '@last-orbit/core/state.js';

const DB = 'last-orbit', STORE = 'saves', LS = 'last-orbit:';
let db = null, dbTried = false;
function openDb() {
  if (db || dbTried) return Promise.resolve(db); dbTried = true;
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

// ---------- schema migrations: each entry upgrades v → v+1. Never remove entries. ----------
const MIGRATIONS = {
  13: (s) => {
    s.projects ||= { completed: {} }; s.projects.completed ||= {};
    // Anyone who has already reached the Graveyard keeps their unlocked route.
    if (Math.max(Number(s.stats?.bestWave || 1), Number(s.run?.best || 1)) >= 41) s.projects.completed.passage ||= Date.now();
    s.projects.passageBossCleared ||= false;
    return s;
  },
  12: (s) => {
    // Ship Level perks belong to the current run. Keep completed lessons complete,
    // and preserve the position of active tutorials after inserting the Skills lesson.
    if (s.run) s.run.skills ||= {};
    if (s.onboarding?.enabled && !s.onboarding.completed && Number(s.onboarding.step || 0) >= 9) s.onboarding.step++;
    return s;
  },
  11: (s) => {
    // v1.11 adds run-bound Ship XP and replaces toast-style onboarding with serialized,
    // acknowledged modal briefings. Preserve observed actions so in-progress players smart-skip.
    if (s.run && s.run.xp == null) s.run.xp = 0;
    if (s.onboarding) {
      const was = s.onboarding, fresh = newState().onboarding;
      if (was.completed || was.enabled === false) {
        was.version = 3; was.acknowledged ||= {}; was.flags ||= {}; was.done ||= {};
      } else {
        s.onboarding = { ...fresh, flags: { ...fresh.flags, ...(was.flags || {}) }, done: { ...(was.done || {}) }, acknowledged: { ...(was.acknowledged || {}) } };
      }
    }
    return s;
  },
  10: (s) => {
    s.projects ||= { completed: {} }; s.projects.completed ||= {};
    // Grandfather systems that were already unlocked in v1.9.x. New saves must construct them.
    if (s.unlocks?.fleet || s.fleet?.commissioned) s.projects.completed.fleet = s.unlocks?.fleet || Date.now();
    if (s.unlocks?.foundry || s.foundry?.commissioned) s.projects.completed.foundry = s.unlocks?.foundry || Date.now();
    if (s.onboarding) { s.onboarding.version = 2; s.onboarding.prompted ||= {}; }
    return s;
  },
  9: (s) => {
    const m = s.materials ||= {}; m.discoveredOres ||= {};
    const hasIron = !!m.discovered || !!m.barsProduced || (s.cur?.ore && !s.cur.ore.isZero?.()) || (s.cur?.iron && !s.cur.iron.isZero?.());
    if (hasIron) m.discoveredOres.iron = true;
    // v9 only knew Iron. Preserve the player's already-reached frontier when introducing the
    // wider material ladder, so an established save does not have to backtrack through old waves
    // merely to reveal ores it has already progressed beyond. Keep this migration table immutable.
    const best = Math.max(1, Number(s.stats?.bestWave || s.run?.best || s.run?.wave || 1));
    const v10Bands = [['iron',1],['copper',5],['silver',10],['gold',15],['cobalt',20],['titanium',25],['iridium',30],['palladium',35],['uranium',40],['platinum',45],['tungsten',50],['osmium',55],['neutronium',60]];
    for (const [id, wave] of v10Bands) if (best >= wave) m.discoveredOres[id] = true;
    m.discovered = Object.keys(m.discoveredOres).length > 0;
    m.selected ||= 'iron'; if (m.running && !m.runningMaterial) m.runningMaterial = 'iron'; if ((m.readyBars || 0) > 0 && !m.readyMaterial) m.readyMaterial = 'iron';
    m.lifetimeOreBy ||= {}; m.lifetimeBarsBy ||= {};
    if (m.lifetimeOre && !m.lifetimeOreBy.iron) m.lifetimeOreBy.iron = m.lifetimeOre;
    if (m.lifetimeBars && !m.lifetimeBarsBy.iron) m.lifetimeBarsBy.iron = m.lifetimeBars;
    return s;
  },
  8: (s) => {
    const m = s.materials ||= {}; m.smelter = !!m.discovered || !!m.barsProduced; m.running = false; m.progress = 0; m.readyBars = 0; m.batchesStarted ||= 0;
    m.upgrades ||= {}; if (m.upgrades.miners && !m.upgrades.extractorRate) m.upgrades.extractorRate = m.upgrades.miners; delete m.upgrades.miners;
    return s;
  },
  7: (s) => { s.materials ||= { discovered: false, progress: 0, mineProgress: 0, barsProduced: 0, upgrades: {} }; return s; },
  6: (s) => { if (s.settings && s.settings.waveIntermission == null) s.settings.waveIntermission = 5; return s; },
  5: (s) => { if (s.onboarding && s.onboarding.step >= 8) s.onboarding.step++; return s; },
  1: (s) => { s.relics ||= {}; s.alien ||= {}; return s; },
  2: (s) => { if (s.run && !s.run.picks) s.run.picks = []; if (s.auto && !s.auto.rewind) s.auto.rewind = { on: false, mode: 'gain', value: 2, minMinutes: 3 }; return s; },
  3: (s) => { if (s.run && !s.run.choiceQueue) s.run.choiceQueue = []; return s; },
  // Existing players should not be forced through a new tutorial after updating. They can replay it from Menu -> Help.
  4: (s) => { if (!s.onboarding) s.onboarding = { enabled: false, version: 1, step: 9, completed: true, done: {}, flags: {} }; return s; },
};
export function parseSave(text) {
  let raw = text.trim(); if (!raw.startsWith('{')) raw = decodeURIComponent(escape(atob(raw)));
  let s = JSON.parse(raw, bigReviver); if (!s || typeof s !== 'object' || !s.run || !s.cur) throw new Error('Not a Last Orbit save');
  const version = Number(s.v || 1);
  if (version > SCHEMA) { const e = new Error(`This save was created by a newer version of Last Orbit (schema ${version}; this build supports ${SCHEMA}). Open it in the newer build instead of overwriting it here.`); e.code = 'NEWER_SAVE'; throw e; }
  for (let v = version; v < SCHEMA; v++) if (MIGRATIONS[v]) s = MIGRATIONS[v](s);
  s.v = SCHEMA;
  const out = withDefaults(s, newState());
  // v1.11.0 touch input only counted pointer-drag as movement. A player who tapped to reposition
  // could therefore remain silently stuck on the Controls step and starve every later lesson.
  // Repair active affected saves without changing save schema: meaningful combat progress proves
  // that the opening controls have already been exercised in practice.
  const ob = out.onboarding;
  if (ob && ob.enabled && !ob.completed && Number(ob.version || 0) < ONBOARDING_VERSION) {
    const progressed = Number(out.stats?.kills || 0) > 0 || Number(out.run?.wave || 1) >= 2 || Number(out.run?.best || 1) >= 2;
    if (progressed) { ob.flags ||= {}; ob.flags.move = true; ob.flags.fire = true; }
    ob.version = ONBOARDING_VERSION;
  }
  return out;
}
const slot = () => (G.state?.meta.sandbox ? 'sandbox' : 'main');
export const serialize = () => JSON.stringify(G.state);

let lastBackup = 0;
export async function save(reason = 'auto') {
  if (!G.state) return; const now = Date.now(); G.state.meta.lastSave = now; G.state.meta.lastSeen = now;
  const text = serialize(); await put(slot(), text);
  if (!G.state.meta.sandbox && now - lastBackup > 5 * 60000) { lastBackup = now; await put('main_backup', text); }
  bus.emit('saved', reason);
}
export async function load() {
  for (const key of ['main', 'main_backup']) { const t = await get(key); if (!t) continue; try { const s = parseSave(t); s.meta.sandbox = false; return { state: s, recovered: key !== 'main' }; } catch (e) { if (e?.code === 'NEWER_SAVE') throw e; console.warn('Save slot unreadable:', key, e); } }
  return { state: newState(), fresh: true };
}
export function exportSave() { return btoa(unescape(encodeURIComponent(serialize()))); }
export function importSave(text) { const s = parseSave(text); s.meta.sandbox = G.state.meta.sandbox; return s; }
export async function hardReset() { await del(slot()); if (slot() === 'main') await del('main_backup'); }
/** Enter the debug sandbox: clone the live state into a separate slot. The real save is left exactly as it was. */
export async function enterSandbox() { await save('pre-sandbox'); G.state.meta.sandbox = true; await save('sandbox'); }
export async function leaveSandbox() { await del('sandbox'); }
