// ?debug=1 test panel. It switches to a sandbox save slot first, so nothing here touches the real save.
import { ALIEN_TECH } from '@last-orbit/data/alientech.js';
import { G, recalc, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { WEAPON_ORDER } from '@last-orbit/data/weapons.js';
import { ABILITY_ORDER } from '@last-orbit/data/abilities.js';
import { SHIPS } from '@last-orbit/data/ships.js';
import { grantXp, nextOffer, nextRelic, nextRoute, nextAnomaly, pickCard, pickRelic, pickRoute, pickAnomaly, autoPickIndex, endSortie } from '@last-orbit/progression/run.js';
import { step } from '@last-orbit/combat/sim.js';
import { TICK } from '@last-orbit/data/balance.js';
import { recTick, recStop, lastReplay, replayBytes } from '@last-orbit/progression/recorder.js';
import { debugSetWave } from '@last-orbit/combat/sim.js';
import { killEnemy } from '@last-orbit/combat/world.js';
import { enterSandbox, exportSave } from '@last-orbit/save/save.js';
import { h } from '@last-orbit/ui/dom.js';
import { BANNERS, BANNER_BY_ID } from '@last-orbit/data/banners.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { STAGE_BY_N } from '@last-orbit/data/counter.js';
import { ENEMIES } from '@last-orbit/data/enemies.js';
import { LINES } from '@last-orbit/ui/comms.js';
import { powerRating, refreshMenus } from '@last-orbit/progression/meta.js';
import { CREW_LOOKS, buildSurvivor } from '@last-orbit/rendering/crew.js';
import { kitFrom } from '@last-orbit/data/turret.js';
import { SIEGE_TIERS } from '@last-orbit/data/siege.js';
import { refreshBounties, checkBounties, claimBounty } from '@last-orbit/progression/bounties.js';
import { BOUNTY_BY_ID } from '@last-orbit/data/bounties.js';
import { ROOMS_ABOARD, roomAt } from '@last-orbit/data/rooms.js';

export async function initDebug(app, { hooks, ui } = {}) {
  // &st=<px>: pretend to have a notch (the top safe-area inset), to check layouts the way a phone shows them
  { const st = new URLSearchParams(location.search).get('st'); if (st) document.documentElement.style.setProperty('--st', st + 'px'); }
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
  window.gunnerBot = gunnerBot;
  window.roomTap = (kind) => ui.tap?.(kind); // tap an exhibit in the room open, as a finger would (for checks in the console)
}

// ---- the gunner-seat balance bot (window.gunnerBot, in a debug build with the seat open: scene=gunner)
// A typical player's station at each tier's unlock (tests/gunner-campaign-sim.mjs): the systems online.
const BOT_BASE = { w_barrier: 1, w_crit: 8, w_dmg: 0.25, w_hull: 0.12, w_magnet: 0.25, w_rate: 0.1, w_regen: 0.03, w_reroll: 1, w_salvage: 0.15, w_shield: 0.08, w_speed: 0.06, w_start: 0.15, w_xp: 1, x_alloy: 0.12 };
const BOT_ON = { 1: BOT_BASE, 2: { ...BOT_BASE, w_barrier: 2, w_magnet: 0.4 }, 3: { ...BOT_BASE, w_barrier: 2, w_magnet: 0.4, w_reroll: 2, w_speed: 0.12, w_start: 0.3 },
  4: { ...BOT_BASE, w_barrier: 2, w_crit: 6, w_magnet: 0.4, w_regen: 0.06, w_reroll: 2, w_revive: 0.15, w_shield: 0.14, w_speed: 0.12, w_start: 0.3, w_xp: 2, x_siphon: 0.03 },
  5: { ...BOT_BASE, w_barrier: 2, w_choice: 1, w_crit: 6, w_dmg: 0.5, w_hull: 0.24, w_magnet: 0.4, w_regen: 0.06, w_reroll: 2, w_revive: 0.15, w_shield: 0.14, w_speed: 0.12, w_start: 0.3, w_xp: 2, x_siphon: 0.03 } };
BOT_ON[6] = { ...BOT_ON[5], w_rate: 0.2, w_salvage: 0.3 };
/** Fly one siege of tier n in the seat, flat out (no rendering): aims at the most urgent target (torpedoes near the
 *  station, then, with missiles, the armoured ones, then the nearest) at up to speed rad a frame, fires a missile on
 *  every lock, picks upgrades at random. o: { style: 'balanced' | 'cannon' | 'human', speed, on (systems), picks (standing ones) }.
 *  human: a phone player, roughly: slower to switch targets, a looser aim, torpedoes noticed later, a beat before firing. */
function gunnerBot(n, o = {}) {
  const g = G.renderer?.room; if (!g?.fireMissile) return 'Open the gunner seat first (scene=gunner)';
  const style = o.style || 'balanced', human = style === 'human', speed = o.speed ?? (human ? 0.025 : 0.03), holdFor = human ? 1.4 : 0.8, torpR = human ? 130 : 200, slack = human ? 5 : 0, picks = o.picks || Object.fromEntries(SIEGE_TIERS.filter((t) => t.n < n).map((t) => [t.gun, 1]));
  g.start(n, { kit: kitFrom(o.on || BOT_ON[n]), picks }); const dt = 1 / 30; let t = 0, fired = 0, tgt = null, hold = 0, lastWave = -1, lockedFor = 0; const hulls = [], off = { x: 0, y: 0, z: 0 };
  const aimAt = (p) => { const d = p.clone().sub(g.cam.position), yaw = Math.atan2(-d.x, -d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)), k = Math.min(1, dt * 2.2);
    g.yaw = Math.max(-1.2, Math.min(1.2, g.yaw + Math.max(-speed, Math.min(speed, (yaw - g.yaw) * k)))); g.pitch = Math.max(-0.75, Math.min(0.75, g.pitch + Math.max(-speed, Math.min(speed, (pitch - g.pitch) * k)))); };
  while (!g.over && t < 900) {
    if (g.pick) g.choosePick(Math.floor(Math.random() * g.pick.ids.length));
    if (g.wave !== lastWave) { hulls.push(Math.round(g.hull * 100)); lastWave = g.wave; }
    const cam = g.cam.position, missiles = style !== 'cannon' && g.ms.ammo > 0, pri = (e) => (e.kind === 'torpedo' && e.pos.distanceTo(g.hub) < torpR ? 0 : missiles && e.k.missile ? 1 : 2);
    hold -= dt; if (!tgt?.alive || hold <= 0) { tgt = g.enemies.filter((e) => e.alive && e.kind !== 'capital').sort((a, b) => pri(a) - pri(b) || a.pos.distanceTo(cam) - b.pos.distanceTo(cam))[0]; hold = holdFor; off.x = (Math.random() - 0.5) * slack * 2; off.y = (Math.random() - 0.5) * slack * 2; }
    if (tgt) { const p = g.lead(tgt, cam).clone(); p.x += off.x; p.y += off.y; aimAt(p); } g.update(dt); t += dt;
    lockedFor = g.ms.locked ? lockedFor + dt : 0; if (style !== 'cannon' && g.ms.locked && lockedFor >= (human ? 0.5 : 0) && g.fireMissile()) fired++;
  }
  const s = g.status(); g.filed = true; /* a bot's siege is never filed */ return { n, style, speed, won: s.won, hull: Math.round(s.hull * 100), wave: s.wave, t: Math.round(t), fired, hulls: hulls.join('/') };
}

function runScene(scene, hooks, ui) {
  const st = G.state; st.salvage = 4200; for (const id of WEAPON_ORDER) st.unlocked.weapons[id] = 1; for (const id of ABILITY_ORDER) st.unlocked.abilities[id] = 1;
  st.unlocked.ships.striker = 1; st.stats.sorties = 6; st.stats.bestWave = 27; st.stats.bestSector = 4; st.stats.threatClear = 2; st.threat = 2; st.mastery = { vanguard: { level: 4, xp: 60 }, striker: { level: 2, xp: 10 } }; st.daily.streak = 3; st.daily.lastDay = '2000-01-01'; st.stats.kills = 900; st.workshop.w_dmg = 3; st.workshop.w_hull = 2; st.pilot = { rank: 6, xp: 700 }; st.paints.ember = st.paints.crimson = 1;
  st.stats.bestScore = 48210; st.stats.bestKills = 612; st.stats.longestRun = 402; st.stats.maxLevel = 22; st.stats.bestSalvage = 931; st.stats.flawless = 40; st.stats.bossKills = 7; st.stats.flawlessBosses = 1; st.medals = { a_kills: 1, a_wave: 1, a_boss: 1, a_flawless: 1, a_score: 1, f_cleanboss: 1 };
  st.records.top = [48210, 40555, 31204, 22950, 9120].map((score, i) => ({ score, wave: [28, 26, 23, 19, 11][i], ship: i === 1 ? 'striker' : 'vanguard', level: 24 - i * 3, kills: 600 - i * 90, threat: i === 0 ? 2 : 0, daily: i === 2, date: Date.now() - i * 86400000 }));
  st.records.ships = { vanguard: { score: 48210, wave: 28 }, striker: { score: 40555, wave: 26 } }; recalc();
  const [name, arg, arg2, arg3, arg4] = scene.split(':');
  // &big=1: a late-game pilot's numbers (millions of salvage, long scores, thousands of kills), to check nothing runs off
  // a phone's screen when the numbers get long (tools/overflow.mjs).
  const big = /[?&]big=1/.test(location.search);
  if (big) { st.salvage = 187654321; Object.assign(st.stats, { bestScore: 987654321, kills: 1234567, bestWave: 96, bestKills: 4321, longestRun: 1478, maxLevel: 64, bestSalvage: 23456789, bossKills: 312, sorties: 1234 }); st.prestige.bp = 128; st.counter.cores = 345; recalc(); }
  // Scenes play as an established pilot (every menu open), except newpilot:<sorties>, which shows the menus opening up.
  st.seen.menus = {}; st.seen.menusInit = false; refreshMenus();
  st.seen.offered = { garden: true }; // scenes are not interrupted by the Greenhouse offering the way aboard (garden:offer shows it)
  // station:<overhaul rank>:<share of Workshop levels, 0-1>[:tab[:captures]] (captures: that many stages cleared and Alien Tech fitted)
  // intro[:seconds]: the opening, frozen at a moment (for screenshots) or playing from the start
  if (name === 'intro') { hooks.toHangar('launch'); setTimeout(() => { const sc = ui.intro({ tap: arg === 'title' }); if (arg === 'title') return; if (arg) { for (let k = 0; k < +arg / 0.05; k++) sc.update(0.05); G.introPaused = true; } }, 300); return; }
  // rebuild:<rank>[:seconds[:alien]]: the reel after an Overhaul to that rank (Workshop just reset, every module built), frozen or playing
  if (name === 'rebuild') { st.prestige.level = +arg || 1; st.stationName = 'Halcyon'; for (const u of WORKSHOP) { st.stationPeak[u.id] = u.max; st.workshop[u.id] = 0; } if (arg3) for (const a of ALIEN_TECH) st.counter.tech[a.id] = 1; recalc(); hooks.toHangar('launch'); setTimeout(() => { const sc = ui.intro({ rebuild: true }); if (arg2) { for (let k = 0; k < +arg2 / 0.05; k++) sc.update(0.05); G.introPaused = true; } }, 300); return; }
  // news: station news, what a buy shows (a toast) and what Launch shows after (a glow over the changed parts, the figure counting up)
  if (name === 'news') { st.prestige.level = 2; for (const u of WORKSHOP) { st.stationPeak[u.id] = u.max; st.workshop[u.id] = 2; } st.counter.unlocked = true; recalc(); hooks.toHangar('launch'); setTimeout(() => { st.workshop.w_dmg = 10; st.workshop.w_speed = 5; st.counter.tech.x_alloy = 1; st.counter.tech.x_phase = 1; st.prestige.level = 3; hooks.toHangar('workshop'); setTimeout(() => { hooks.toHangar('launch'); toast('Station: Weapon battery online', 'station'); }, 200); }, 400); return; }
  // comms:<line id>: the station AI saying one of its lines
  if (name === 'comms') { st.pilot.name = 'Adam'; st.seen.callsign = true; hooks.toHangar('launch'); setTimeout(() => { const l = LINES.find((x) => x.id === (arg || 'welcome')); if (l) ui.comms.say(l.text); }, 600); return; }
  if (name === 'deck') { st.prestige.level = +arg || 3; st.pilot.name = 'Adam'; st.seen.callsign = true; for (const id of ['signal', 'checker', 'ember', 'royal']) st.banners[id] = 1; st.unlocked.ships.bulwark = 1; st.stats.bestWave = 74; st.stats.sectorsCleared = 6; st.stats.maxAnomalies = 2; st.counter.stars = { 1: 3, 2: 2, 3: 1 }; refreshMenus(); st.seen.menus.deck = true; recalc(); hooks.toHangar('deck');
    // deck:<rank>:<view>: stand somewhere and look at something (window, medals, ships, back, table, door, doornear,
    // halldoor, rear: the back of the room from the window's left corner, lounge, directory: the station directory by the
    // way in, backwall: the Greenhouse door, the records screen and the way out)
    const V = { window: [0, 1.5, 0, -0.08], medals: [-1.2, -2.2, 1.35, 0], ships: [1.4, -2.2, -1.35, -0.1], back: [0, 2.6, Math.PI, -0.05], table: [0, 0.2, 0, -0.35], door: [1.2, 2.6, -1.5708, 0.04], doornear: [3.3, 2.6, -1.5708, 0.12], halldoor: [-1.2, 2.6, 1.5708, 0.04], rear: [-3.2, -6.6, Math.PI + 0.42, -0.04], lounge: [2.4, 4.6, 1.8208, -0.02], directory: [2.0, 5.35, -1.5708, 0.02], backwall: [-1.4, 2.4, 2.73, 0.05] }[arg2];
    if (V) { let n = 0; const iv = setInterval(() => { const d = G.renderer?.room; if (d) { d.pos.x = V[0]; d.pos.z = V[1]; d.yaw = V[2]; d.pitch = V[3]; } if (++n > 20) clearInterval(iv); }, 100); }
    return; }
  // replay:<start wave>[:<seconds>[:<view>]]: a bot flies a sortie from that wave for that long (headless, in an instant)
  // with the flight recorder on, then the Command Deck's replay TV; view: tv (close, the default) or room
  if (name === 'replay') {
    const from = +arg || 27, secs = +arg2 || 90; st.pilot.name = 'Adam'; st.seen.callsign = true; st.prestige.level = Math.max(1, st.prestige.level || 0); refreshMenus(); st.seen.menus.deck = true;
    WORKSHOP.forEach((u, i) => { st.workshop[u.id] = Math.round(u.max * Math.min(1, 0.55 - (i % 4) * 0.1)); }); Object.assign(st.stats, { bestWave: 41, bestScore: 182400, sorties: 57, kills: 21840 });
    const auto = () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = 1; }; bus.on('stats', auto); recalc(); auto();
    hooks.launch({}); const run = st.run; debugSetWave(from); grantXp(1400);
    const pick = () => { for (let g = 0; g < 120; g++) { if (nextRelic()) pickRelic(0); else if (nextRoute()) pickRoute(0); else if (nextAnomaly()) pickAnomaly(0); else if (nextOffer()) pickCard(autoPickIndex(run)); else break; } };
    pick(); ui.closeOverlays(); let reason = null; const over = (r) => { reason = r; }; bus.on('sortieOver', over);
    for (let i = 0, n = Math.round(secs / TICK); i < n && !reason && st.run; i++) { pick(); step(TICK); recTick(G.world, TICK); if (G.world.fx.length > 200) G.world.fx.length = 0; }
    bus.off?.('sortieOver', over); G.world.fx.length = 0; endSortie(reason || 'abandoned'); recStop({ reason: reason || 'abandoned' }); ui.closeOverlays();
    console.log('replay', lastReplay().frames.length, 'frames', Math.round(replayBytes(lastReplay()) / 1024) + ' KB', reason);
    hooks.toHangar('deck');
    const V = { tv: [-1.2, 1.1, Math.PI, 0.04], room: [0.4, -1.8, Math.PI + 0.2, 0.02], screen: [-1.2, 2.3, Math.PI, 0.09], wide: [-1.2, -1.3, Math.PI, 0.02], watch: [-1.2, 1.1, Math.PI, 0.04], watchend: [-1.2, 1.1, Math.PI, 0.04] }[arg3 || 'tv'];
    // replay:…:watch: then tap the TV, as a finger would
    if (arg3 === 'watchend') setTimeout(() => { const rp = G.renderer.room?.replay; rp?.seek(rp.length - 0.3); }, 3200); /* …and skip to its ending */
    if (arg3 === 'watch' || arg3 === 'watchend') setTimeout(() => { const el = document.querySelector('.deck3d'), r = G.renderer.canvas.getBoundingClientRect(), o = { pointerId: 5, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true }; el?.dispatchEvent(new PointerEvent('pointerdown', o)); el?.dispatchEvent(new PointerEvent('pointerup', o)); }, 2600);
    let k = 0; const iv = setInterval(() => { const d = G.renderer?.room; if (d) { d.pos.x = V[0]; d.pos.z = V[1]; d.yaw = V[2]; d.pitch = V[3]; } if (++k > 20) clearInterval(iv); }, 100);
    return; }
  // control:<stages cleared>[:<view>[:<tiers held>]]: Defence Control, with that many Counterattack stages (and so siege
  // tiers) open, half the Workshop built and a few tiers held; view: window, left, right, back, table, orbit
  if (name === 'control') { const n = Math.min(6, +arg || 3), held = arg3 == null ? Math.max(0, n - 2) : +arg3; st.pilot.name = 'Adam'; st.seen.callsign = true; st.counter.unlocked = true; for (let k = 1; k <= n; k++) st.counter.stars[k] = st.counter.stars[k] || 2; const bare = arg4 === 'bare', mid = arg4 === 'mid'; /* control:n:view:held:bare|mid: nothing built yet, or about what a pilot has when the first siege opens */ if (!bare && !mid) { st.counter.tech.x_alloy = 1; st.counter.tech.x_phase = 1; }
    WORKSHOP.forEach((u, i) => { st.workshop[u.id] = bare ? 0 : Math.round(u.max * Math.min(1, Math.max(0, (mid ? 0.6 : 0.9) - (i % 5) * (mid ? 0.13 : 0.22)))); }); if (mid) { st.counter.tech = {}; st.seen.siegeIntro = false; } if (bare) st.stationPeak = {}; st.siege = { stars: {}, best: {}, won: {}, wins: held }; for (let k = 1; k <= held; k++) { st.siege.stars[k] = 1 + (k % 3); st.siege.best[k] = 20000 + k * 7000; st.siege.won[k] = 1; }
    st.seen.control = true; recalc(); hooks.toHangar('control');
    const V = { window: [0, -4.8, 0, -0.06], left: [0.6, -3.6, 1.45, -0.05], right: [-0.6, -3.6, -1.45, -0.05], back: [0.2, -0.4, Math.PI, 0], table: [0, 0.2, 0, -0.42], orbit: [-2.4, 1.2, 1.5, -0.05], door: [1.4, 1.3, -1.68, 0.06], exit: [2.2, 0.3, -2.76, 0.06] }[arg2];
    if (V) { let k = 0; const iv = setInterval(() => { const d = G.renderer?.room; if (d) { d.pos.x = V[0]; d.pos.z = V[1]; d.yaw = V[2]; d.pitch = V[3]; } if (++k > 20) clearInterval(iv); }, 100); }
    return; }
  if (name === 'station') { st.prestige.level = +arg || 0; const f = arg2 == null ? 0.5 : +arg2; WORKSHOP.forEach((u, i) => { st.workshop[u.id] = Math.round(u.max * Math.min(1, Math.max(0, f * 1.6 - (i % 5) * 0.15))); }); if (arg4) { const n = Math.min(6, +arg4 || 0); st.counter.unlocked = true; ALIEN_TECH.forEach((a, i) => { if (i < n) st.counter.tech[a.id] = 1; }); for (let k = 1; k <= n; k++) st.counter.stars[k] = 1; } recalc(); hooks.toHangar(arg3 === 'card' ? 'launch' : arg3 || 'launch'); if (arg3 === 'card') setTimeout(() => document.querySelector('.st-callout')?.click(), 900); return; }
  // gunner[:tier][:mode]: a Station Siege in the gunner seat, on a save with a mid-game station and the tiers up to it open.
  // Modes: auto (the sights follow the nearest target), boom (a fighter and a bomber blow up in front of the guns every two
  // seconds), missile (a missile into a bomber every 2.5 seconds), won[:hull] / lost (straight to the debrief).
  if (name === 'gunner') { const tier = Math.max(1, Math.min(6, +arg || 1)), mode = isNaN(+arg) ? arg : arg2, extra = isNaN(+arg) ? arg2 : arg3;
    st.pilot.name = 'Adam'; st.seen.callsign = true; st.counter.unlocked = true; for (let k = 1; k <= tier; k++) st.counter.stars[k] = 2; st.seen.gunnerIntro = true;
    WORKSHOP.forEach((u, i) => { st.workshop[u.id] = Math.round(u.max * Math.min(1, Math.max(0, 0.6 - (i % 5) * 0.13))); }); st.seen.control = true; recalc(); hooks.toSiege(tier);
    if (mode === 'won' || mode === 'lost') setTimeout(() => { const g = G.renderer?.room; if (!g?.win) return; g.wave = mode === 'won' ? g.tier.plan.length - 1 : 1; g.score = 18450; g.kills = 57;
      if (mode === 'won') { g.hull = extra == null ? 0.72 : +extra; g.win(); } else { g.hull = 0; g.over = true; g.running = false; g.banner = { text: 'Station lost', t: 99 }; } }, 700);
    // exit / abandon: a wave under way, then Exit pressed (the confirm), and for abandon, Abandon pressed (the debrief)
    if (mode === 'exit' || mode === 'abandon') setTimeout(() => { const g = G.renderer?.room; if (g) { g.wave = 1; g.hull = 0.64; g.score = 6200; g.kills = 21; } document.querySelector('.gunner .d3-exit')?.click();
      if (mode === 'abandon') setTimeout(() => document.querySelector('.modal.confirm .btn.danger')?.click(), 400); }, 1500);
    if (mode === 'boom') setInterval(() => { const g = G.renderer?.room, T3 = window.THREE; if (!g?.shatter || G.room !== 'gunner') return; g.yaw = 0; g.pitch = 0; g.picksDue = 0; g.spawnQ = [];
      for (const [kind, x, z] of [['fighter', -14, -80], ['bomber', 18, -110]]) { const e = g.spawn(kind, new T3.Vector3(x, 4, z)); e.vel.set(x > 0 ? -12 : 12, 0, 20); g.kill(e); } }, 2000);
    if (mode === 'missile') setInterval(() => { const g = G.renderer?.room, T3 = window.THREE; if (!g?.fireMissile || G.room !== 'gunner') return; g.yaw = 0; g.pitch = 0; g.picksDue = 0; g.spawnQ = []; if (g.pick) g.choosePick(0);
      const e = g.spawn('bomber', new T3.Vector3(14, 8, -170)); e.state = 'inbound'; e.goal = new T3.Vector3(14, 8, -3000); e.vel.set(0, 0, 0); Object.assign(g.ms, { target: e, locked: true, ammo: 2, reloadT: 0 }); g.fireMissile(); }, 2500);
    if (mode === 'auto') setInterval(() => { const g = G.renderer?.room; if (!g?.enemies || G.room !== 'gunner') return; const cam = g.cam.position, t = g.enemies.filter((e) => e.alive && e.kind !== 'capital').sort((a, b) => a.pos.distanceTo(cam) - b.pos.distanceTo(cam))[0]; if (!t) return; const d = g.lead(t, cam).clone().sub(cam); g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); if (g.pick) g.choosePick(0); }, 50);
    return; }
  // hall[:captures[:hard[:view]]]: the Trophy Hall at Overhaul rank 2, with that many Counterattack bosses captured (default
  // 4), that many hard stages cleared, and the main-game bosses met. view: left, right, front (the window), back (the doors),
  // hunt (the hologram), plaque (close on a plaque), tap:<exhibit> to open one's panel, or intro (a first visit).
  if (name === 'hall') { const caps = arg == null ? 4 : +arg, hard = +arg2 || 0; st.pilot.name = 'Adam'; st.seen.callsign = true; st.seen.hall = arg3 !== 'intro'; st.prestige.level = arg3 === 'spire' ? 3 : 2; st.stationName = 'Halcyon';
    for (const l of LINES) st.seen.comms[l.id] = 1; st.seen.commsInit = true;
    WORKSHOP.forEach((u, i) => { st.stationPeak[u.id] = u.max; st.workshop[u.id] = Math.round(u.max * Math.min(1, Math.max(0, 0.7 - (i % 5) * 0.12))); });
    st.counter.unlocked = true; for (let k = 1; k <= caps; k++) { st.counter.stars[k] = 1 + (k % 3); st.counter.best[k] = 18000 + k * 7400; if (k <= hard) st.counter.hard[k] = 1 + (k % 2); }
    for (const [i, b] of ['broodcarrier', 'bastion', 'wyrm', 'dreadnought', 'oracle'].entries()) { st.seen.bosses[b] = 1; if (i < 4) st.stats.bossBy[b] = 6 - i; } st.stats.sectorsCleared = 4; st.intel.oracle = 3; st.intel.dreadnought = 1;
    recalc(); hooks.toHangar('hall');
    const view = { left: [0.2, -2.9, 1.25, -0.08], right: [-0.2, -2.9, -1.25, -0.08], front: [0, -5.2, 0, 0.12], back: [0, -6.8, Math.PI, 0.06], hunt: [0, -0.6, Math.PI, 0.04], spire: [-1.6, 1.4, -1.5708, 0.05], plaque: [-1.55, -1.5, 1.57, -0.55] }[arg3];
    if (view) { let tries = 0; const place = () => { const r = G.renderer?.room; if (!r?.pos) { if (tries++ < 60) setTimeout(place, 100); return; } r.pos.set(view[0], 0, view[1]); r.yaw = view[2]; r.pitch = view[3]; }; place(); } /* once the room is built */
    if (arg3 === 'tap') setTimeout(() => ui.tap?.(arg4 || 'cradle1'), 1500);
    return; }
  // spire[:view[:state]]: the Comms room at Overhaul rank 3 with today's bounties posted: the first done, the second half
  // way, the third just started (state 'paid': the first collected; 'all': all three done and collected). view: board,
  // map, radio, window, back, tap:<exhibit> or intro (a first visit). Also missions: the Missions tab with the same bounties.
  if (name === 'spire') { st.pilot.name = 'Adam'; st.seen.callsign = true; st.seen.commsRoom = arg !== 'intro'; st.seen.hall = true; st.prestige.level = 3; st.stationName = 'Halcyon'; st.counter.unlocked = true; st.counter.stars[1] = 2;
    for (const l of LINES) st.seen.comms[l.id] = 1; st.seen.commsInit = true; st.stats.sorties = 30; st.stats.kills = 9000; st.stats.wavesCleared = 700; st.stats.dodges = 900; st.stats.eliteKills = 120; st.stats.bossKills = 40; st.stats.flawless = 160;
    st.history = [900, 1200, 1100, 1400, 1300].map((salvage) => ({ salvage, score: 1, wave: 30 })); st.bounties = { day: '', list: [], rerolled: false, bonus: false, done: 11, days: 3 };
    WORKSHOP.forEach((u, i) => { st.stationPeak[u.id] = u.max; st.workshop[u.id] = Math.round(u.max * Math.min(1, Math.max(0, 0.7 - (i % 5) * 0.12))); });
    refreshBounties(st); const L = st.bounties.list, push = (b, k) => { const d = BOUNTY_BY_ID[b.id]; if (d.best) b.best = Math.round(b.goal * k); else st.stats[d.stat] = (st.stats[d.stat] || 0) + (k >= 1 ? b.goal : Math.floor(b.goal * k)); };
    const all = arg2 === 'all'; L.forEach((b, i) => push(b, all ? 1 : [1, 0.5, 0.12][i])); checkBounties(st); if (arg2 === 'paid' || all) L.forEach((b, i) => { if (all || i === 0) claimBounty(st, i); });
    recalc(); hooks.toHangar(arg === 'missions' ? 'missions' : 'comms');
    const view = { board: [1.6, -1.9, 1.5708, 0.02], map: [-1.6, -1.9, -1.5708, 0.02], radio: [0, -1.0, 0, -0.1], window: [0, -1.2, 0, 0.16], dish: [1.3, -5.9, -0.2, -0.1], back: [0, -3, Math.PI, 0.04] }[arg];
    if (view) { let tries = 0; const place = () => { const r = G.renderer?.room; if (!r?.pos) { if (tries++ < 60) setTimeout(place, 100); return; } r.pos.set(view[0], 0, view[1]); r.yaw = view[2]; r.pitch = view[3]; }; place(); }
    if (arg === 'tap') setTimeout(() => ui.tap?.(arg2 || 'bounties'), 1500);
    return; }
  // quarters[:view[:mood]]: the Pilot's quarters at Overhaul rank 5, with ten of the twelve keepsakes found and most of the
  // photos up. view: bunk, shelf, desk, photos, window, tap:<exhibit> or intro (a first visit). mood: warm, cool, night, neon.
  if (name === 'quarters') { st.pilot.name = 'Adam'; st.pilot.rank = 12; st.seen.callsign = true; st.seen.quarters = arg !== 'intro'; st.prestige.level = 5; st.stationName = 'Halcyon';
    for (const l of LINES) st.seen.comms[l.id] = 1; st.seen.commsInit = true; Object.assign(st.stats, { sorties: 40, deaths: 12, sectorBosses: 5, bestSector: 5, sectorsCleared: 4, bestWave: 48, siegeWins: 1 });
    st.counter.unlocked = true; st.counter.stars[1] = 2; st.quarters = { restDay: '', rested: false, mood: ['warm', 'cool', 'night', 'neon'].includes(arg2) ? arg2 : 'warm' };
    WORKSHOP.forEach((u, i) => { st.stationPeak[u.id] = u.max; st.workshop[u.id] = Math.round(u.max * Math.min(1, Math.max(0, 0.7 - (i % 5) * 0.12))); });
    recalc(); hooks.toHangar('quarters');
    const view = { bunk: [-0.4, -2.3, 0.15, -0.3], shelf: [0.9, -1.45, 1.5708, 0.02], desk: [-0.7, -1.9, -1.2, -0.05], photos: [0, -1.5, Math.PI, 0.04], window: [0, -2.6, 0, 0.12] }[arg];
    if (view) { let tries = 0; const place = () => { const r = G.renderer?.room; if (!r?.pos) { if (tries++ < 60) setTimeout(place, 100); return; } r.pos.set(view[0], 0, view[1]); r.yaw = view[2]; r.pitch = view[3]; }; place(); }
    if (arg === 'tap') setTimeout(() => ui.tap?.(arg2 || 'shelf'), 1500);
    return; }
  // observatory[:view|tap[:best wave[:charted]]]: the Observatory at Overhaul rank 6, the best wave (default 94) and how many
  // depths already charted (default 2). view: telescope, chart, orrery, dome, window, tap:<exhibit> or intro (a first visit).
  if (name === 'observatory') { const best = +arg2 || 94, done = arg3 == null ? 2 : +arg3; st.pilot.name = 'Adam'; st.seen.callsign = true; st.seen.observatory = arg !== 'intro'; st.prestige.level = 6; st.stationName = 'Halcyon';
    for (const l of LINES) st.seen.comms[l.id] = 1; st.seen.commsInit = true; st.stats.bestWave = best; st.stats.bestSector = 6; st.stats.sectorsCleared = 6; st.observatory = { charted: {} };
    [61, 71, 81, 91, 101, 121, 151, 201].slice(0, done).forEach((w) => { if (w <= best) st.observatory.charted[w] = Date.now(); });
    WORKSHOP.forEach((u, i) => { st.stationPeak[u.id] = u.max; st.workshop[u.id] = Math.round(u.max * Math.min(1, Math.max(0, 0.7 - (i % 5) * 0.12))); });
    recalc(); hooks.toHangar('observatory');
    const view = { telescope: [0.8, 0.2, 0.3, 0.1], chart: [1.8, 0.55, 1.5708, 0.02], orrery: [1.2, -1.6, -0.55, -0.15], dome: [0, 0.4, 0, 0.72], window: [1.7, -1.4, 0.3, 0.08] }[arg];
    if (view) { let tries = 0; const place = () => { const r = G.renderer?.room; if (!r?.pos) { if (tries++ < 60) setTimeout(place, 100); return; } r.pos.set(view[0], 0, view[1]); r.yaw = view[2]; r.pitch = view[3]; }; place(); }
    if (arg === 'tap') setTimeout(() => ui.tap?.(arg2 && isNaN(+arg2) ? arg2 : 'telescope'), 1500);
    if (arg === 'charting') setTimeout(() => { ui.tap?.('chart'); setTimeout(() => document.querySelector('.obs-go')?.click(), 400); }, 1500); /* chart the next depth: the view turns up to it */
    return; }
  // yard[:stage] or yard:<view>[:stage] or yard:tap:<exhibit>[:stage]: the Shipyard at Overhaul rank 7 with that many of
  // the Chimera's four stages built (default 1), the pay for the next to hand, and three other ships in the hangar.
  // view: console, blueprint, fleet, side, front, doors, window; build (the next stage built as you watch: at 3, she is
  // commissioned) or intro (a first visit).
  if (name === 'yard') { const num = (v) => v != null && v !== '' && !isNaN(+v), stage = Math.min(4, num(arg) ? +arg : arg === 'tap' ? (num(arg3) ? +arg3 : 1) : num(arg2) ? +arg2 : 1);
    st.pilot.name = 'Adam'; st.seen.callsign = true; st.seen.shipyard = arg !== 'intro'; st.prestige.level = 7; st.stationName = 'Halcyon'; st.salvage = 400000; st.counter.unlocked = true; st.counter.cores = 6; st.prestige.bp = 5;
    for (const l of LINES) st.seen.comms[l.id] = 1; st.seen.commsInit = true; st.shipyard = { stage, at: Array.from({ length: stage }, (_, i) => Date.now() - (stage - i) * 86400000) }; /* a stage a day */
    for (const id of ['striker', 'bulwark', 'tempest']) st.unlocked.ships[id] = 1; st.mastery = { vanguard: { level: 6, xp: 0 }, striker: { level: 3, xp: 0 }, bulwark: { level: 2, xp: 0 }, tempest: { level: 4, xp: 0 } };
    if (stage >= 4) { st.unlocked.ships.chimera = Date.now(); st.ship = 'chimera'; }
    WORKSHOP.forEach((u, i) => { st.stationPeak[u.id] = u.max; st.workshop[u.id] = Math.round(u.max * Math.min(1, Math.max(0, 0.7 - (i % 5) * 0.12))); });
    recalc(); hooks.toHangar('yard');
    const view = { console: [-2.0, 0.43, 0.6, -0.25], blueprint: [-1.8, 0.3, 1.5708, 0.08], fleet: [1.8, 0.3, -1.5708, 0.08], side: [4.6, -1.8, 0.88, -0.02], front: [2.0, -10.3, 2.74, 0], doors: [0, -1.5, Math.PI, 0.05], window: [0, -9.4, 0, 0.1] }[arg];
    if (view) { let tries = 0; const place = () => { const r = G.renderer?.room; if (!r?.pos) { if (tries++ < 60) setTimeout(place, 100); return; } r.pos.set(view[0], 0, view[1]); r.yaw = view[2]; r.pitch = view[3]; }; place(); }
    if (arg === 'tap') setTimeout(() => ui.tap?.(arg2 || 'ship'), 1500);
    if (arg === 'build') setTimeout(() => { ui.tap?.('ship'); setTimeout(() => document.querySelector('.yard-go')?.click(), 400); }, 1500);
    return; }
  // beacons[:beaten[:met]] or beacons:<view>[:beaten] or beacons:tap:<exhibit>[:beaten]: the Beacon array at Overhaul rank 8,
  // that many Void bosses beaten (default 2) and that many more met (default 1). view: lamp, left, right, log, window;
  // intro (a first visit).
  // aboard:<rank>[:card|offer|launch|door]: a save just Overhauled to that rank, every room before it visited and the one
  // it opens not yet: the station card (default), the offer after the rebuild reel, the NEW callout on Launch, or the door
  // to it with its NEW tag
  if (name === 'aboard') { const rank = Math.max(1, Math.min(10, +arg || 7)), mode = arg2 || 'card', fresh = roomAt(rank);
    st.pilot.name = 'Adam'; st.seen.callsign = true; st.stationName = 'Halcyon'; st.prestige.level = rank; st.stats.bestWave = 74; st.stats.bestSector = 8; st.stats.sectorsCleared = 6; st.seen.garden = true; st.counter.unlocked = true; st.counter.stars[1] = 2; st.counter.stars[2] = 1;
    for (const l of LINES) st.seen.comms[l.id] = 1; st.seen.commsInit = true; refreshMenus(); if (fresh?.id !== 'deck') st.seen.menus.deck = true;
    for (const r of ROOMS_ABOARD) if (r.seen) st.seen[r.seen] = r !== fresh; st.seen.gunnerIntro = true;
    WORKSHOP.forEach((u, i) => { st.stationPeak[u.id] = u.max; st.workshop[u.id] = Math.round(u.max * Math.min(1, Math.max(0, 0.6 - (i % 5) * 0.12))); }); recalc();
    if (mode === 'door') { const at = { hall: ['deck', -1.8, 0, Math.PI / 2], comms: ['hall', 1.2, 1.75, -Math.PI / 2], quarters: ['hall', -1.2, 1.75, Math.PI / 2], observatory: ['quarters', -0.2, 1.15, -Math.PI / 2], yard: ['observatory', 0.8, 0.6, -Math.PI / 2], beacons: ['yard', -2.3, -9.9, Math.PI / 2] }[fresh?.id];
      if (!at) { hooks.toHangar('launch'); return; } hooks.toHangar(at[0]); let tries = 0; const place = () => { const r = G.renderer?.room; if (!r?.pos) { if (tries++ < 60) setTimeout(place, 100); return; } r.pos.set(at[1], 0, at[2]); r.yaw = at[3]; r.pitch = 0.1; }; place(); return; }
    hooks.toHangar('launch'); if (mode === 'offer') setTimeout(() => ui.offerRoom(rank), 600); else if (mode === 'card') setTimeout(() => document.querySelector('.st-callout')?.click(), 900); return; }
  // garden[:wing][:view[:tap:<exhibit>]|tap:<exhibit>|intro|offer|bloom]: the Greenhouse with a bloom, a bud and a sprout in the old bay
  // (wing: Overhaul rank 4, the second wing lit and planted too; bloom: every bed in bloom, a kind to each). views: island,
  // drawer, bench, side (along the right wall), water, herbarium, partition, wing, rows, back, roof.
  if (name === 'garden') { const wing = arg === 'wing', a = wing ? arg2 : arg, b = wing ? arg3 : arg2, H = 3600000, now = Date.now();
    st.pilot.name = 'Adam'; st.seen.callsign = true; st.stationName = 'Halcyon'; st.stats.sorties = 12; st.stats.sectorsCleared = 3; st.stats.bestWave = 34; st.prestige.level = wing ? 4 : 0;
    for (const l of LINES) st.seen.comms[l.id] = 1; st.seen.commsInit = true; st.seen.garden = a !== 'intro' && a !== 'offer'; st.seen.offered = a === 'offer' ? {} : { garden: true };
    const bed = (id, grown, hours = 16) => ({ id, at: now - grown * hours * H, need: hours * H, extra: 0 });
    st.garden = { started: true, wateredDay: '', seeds: { sunpetal: 2, emberroot: 1, ironbark: 1, hivebloom: 1 }, basket: { sunpetal: 1, mistvine: 2 }, grown: { sunpetal: 3, emberroot: 1, mistvine: 2 },
      beds: a === 'bloom' ? ['sunpetal', 'emberroot', 'mistvine', 'ironbark', 'hivebloom', 'gravfern', 'starbloom', 'nightshade', 'lily'].slice(0, wing ? 9 : 3).map((id) => bed(id, 1.2))
        : [bed('sunpetal', 1.2), bed('mistvine', 0.8), bed('emberroot', 0.2), ...(wing ? [bed('gravfern', 1.1), bed('starbloom', 0.5, 24), bed('nightshade', 0.75, 24), bed('lily', 0.1, 36), bed('ironbark', 1.3), bed('hivebloom', 0.45)] : [])] };
    WORKSHOP.forEach((u, i) => { st.stationPeak[u.id] = u.max; st.workshop[u.id] = Math.round(u.max * Math.min(1, Math.max(0, 0.6 - (i % 5) * 0.12))); }); recalc();
    if (a === 'offer') { hooks.toHangar('launch'); return; }
    hooks.toHangar('garden');
    const view = { island: [0, 1.1, 0, -0.3], drawer: [1.3, 0.55, -1.5708, -0.1], bench: [1.2, -1.15, -1.5708, -0.28], side: [2.15, 2.5, -0.3, -0.3], water: [-1.15, 0.55, 1.5708, -0.18], herbarium: [-0.1, 0.6, Math.PI, 0.08], partition: [0, -2.6, 0, 0.2], wing: [0, -4.6, 0, -0.12], rows: [0.3, -4.3, 0.42, -0.2], back: [0, -2.6, Math.PI, 0.02], roof: [1.6, 1.5, 0.35, 0.95] }[a === 'bloom' && wing ? 'rows' : a];
    if (view) { let tries = 0; const place = () => { const r = G.renderer?.room; if (!r?.pos) { if (tries++ < 60) setTimeout(place, 100); return; } r.pos.set(view[0], 0, view[1]); r.yaw = view[2]; r.pitch = view[3]; }; place(); }
    if (a === 'tap') setTimeout(() => ui.tap?.(b || 'bed0'), 1500); else if (view && b === 'tap') setTimeout(() => ui.tap?.((wing ? arg4 : arg3) || 'water'), 1500); /* <view>:tap:<exhibit>: from that view */
    return; }
  // crew[:line|wide|close|close2][:visor]: a look at survivors who might one day live aboard (not in the game yet), four of
  // them in the Greenhouse. line (the default): side by side in the second wing, for a good look; wide: at work in the old
  // bay (watering, at the bench, reading, sitting on the planter); close, close2: nearer, two at a time. visor: helmets
  // instead of faces.
  if (name === 'crew') { const visor = arg === 'visor' || arg2 === 'visor', view = arg && arg !== 'visor' ? arg : 'line';
    runScene(view === 'wide' ? 'garden' : 'garden:wing', hooks, ui); let tries = 0;
    const go = () => { const r = G.renderer?.room; if (!r?.sprig) { if (tries++ < 80) setTimeout(go, 100); return; } crewLook(r, view, visor); }; setTimeout(go, 200); return; }
  if (name === 'beacons') { const num = (v) => v != null && v !== '' && !isNaN(+v), won = num(arg) ? +arg : arg === 'tap' ? (num(arg3) ? +arg3 : 2) : num(arg2) ? +arg2 : 2, more = num(arg) && num(arg2) ? +arg2 : 1;
    st.pilot.name = 'Adam'; st.seen.callsign = true; st.seen.beacons = arg !== 'intro'; st.prestige.level = 8; st.stationName = 'Halcyon'; st.stats.bestWave = 96; st.stats.bestSector = 9;
    for (const l of LINES) st.seen.comms[l.id] = 1; st.seen.commsInit = true; st.beacons = { beaten: {} };
    ['watcher', 'leviathan', 'choir', 'colossus', 'mirrorhost', 'maw'].forEach((id, i) => { if (i < won + more) st.seen.bosses[id] = 1; if (i < won) { st.beacons.beaten[id] = Date.now() - (won - i) * 86400000; st.stats.bossBy[id] = won - i + 1; } });
    WORKSHOP.forEach((u, i) => { st.stationPeak[u.id] = u.max; st.workshop[u.id] = Math.round(u.max * Math.min(1, Math.max(0, 0.7 - (i % 5) * 0.12))); });
    recalc(); hooks.toHangar('beacons');
    const view = { lamp: [0, -1.4, 0, 0.12], left: [-0.6, -1.5, 1.2, 0.02], right: [0.6, -1.5, -1.2, 0.02], log: [0, 0.9, Math.PI, 0.05], window: [1.6, -6.4, 0.25, 0.1] }[arg];
    if (view) { let tries = 0; const place = () => { const r = G.renderer?.room; if (!r?.pos) { if (tries++ < 60) setTimeout(place, 100); return; } r.pos.set(view[0], 0, view[1]); r.yaw = view[2]; r.pitch = view[3]; }; place(); }
    if (arg === 'tap') setTimeout(() => ui.tap?.(arg2 || 'log'), 1500);
    return; }
  // sgdamage[:tab]: a station left damaged by a lost siege (three systems out), seen from a tab or room (default Defence Control)
  if (name === 'sgdamage') { st.pilot.name = 'Adam'; st.seen.callsign = true; st.counter.unlocked = true; st.counter.stars[1] = 2; st.counter.stars[2] = 1; st.seen.control = true; st.seen.gunnerIntro = true; st.stationName = 'Halcyon';
    WORKSHOP.forEach((u, i) => { st.workshop[u.id] = Math.round(u.max * Math.min(1, Math.max(0, 0.6 - (i % 5) * 0.13))); }); st.siege.damage = { ids: ['w_shield', 'w_hull', 'w_dmg'], tier: 2, cost: 1400 }; st.seen.commsInit = true; for (const l of LINES) st.seen.comms[l.id] = 1; recalc(); hooks.toHangar(arg || 'control');
    if (arg === 'missions') setTimeout(() => document.querySelector('.sg-panel')?.scrollIntoView({ block: 'start' }), 900); /* down to the siege panel */
    if (arg2 === 'repair') setTimeout(() => document.querySelector('.sg-damage .btn')?.click(), 1200); /* and its repair panel */
    return; }
  // backup[:restore]: Settings, then the save backup screen (restore: with a code pasted and the confirm open)
  if (name === 'backup') { st.pilot.name = 'Adam'; st.seen.callsign = true; hooks.toHangar('launch'); setTimeout(() => { document.querySelector('.hg-top .icon-btn')?.click(); setTimeout(() => { [...document.querySelectorAll('.settings .field')].find((f) => f.textContent.includes('Save backup'))?.querySelector('button')?.click();
    if (arg === 'restore') setTimeout(() => { const i = document.querySelector('.bk-input'); i.value = exportSave(); i.dispatchEvent(new Event('input')); document.querySelector('.modal.backup .btn.ghost.wide')?.click(); }, 300); }, 300); }, 500); return; }
  if (name === 'callsign') { st.pilot.name = arg || ''; st.seen.callsign = !!arg; hooks.toHangar('launch'); setTimeout(() => (arg2 === 'greet' ? ui.greet() : ui.callsign({ first: !arg })), 400); return; }
  if (name === 'newpilot') { st.stats.sorties = +arg || 0; st.seen.menus = {}; st.seen.menusInit = true; refreshMenus(); hooks.toHangar('launch'); if (arg2) setTimeout(() => [...document.querySelectorAll('.nav-btn')].find((b) => b.textContent.toLowerCase().includes(arg2))?.click(), 500); return; }
  if (name === 'hull' || name === 'hullfly') { st.unlocked.ships[arg] = 1; st.ship = arg; st.banner = 'none'; recalc(); if (name === 'hull') { hooks.toHangar('launch'); return; } }
  if (name === 'paint') { st.paints[arg] = 1; st.paint = arg; hooks.toHangar('launch'); return; }
  // shipfx:<hull%>: a shielded ship held at that hull, dodging now and then (shield bubble, damage smoke, dodge chip).
  if (name === 'shipfx') { st.workshop.w_shield = 3; recalc(); hooks.launch(); st.run.offer = null; st.run.pendingLevels = 0; ui.closeOverlays(); let k = 0;
    setInterval(() => { const w = G.world, run = st.run; if (!w?.player || !run) return; if (run.offer || run.relicOffer) { run.offer = run.relicOffer = null; run.pendingLevels = run.pendingRelics = 0; ui.closeOverlays(); } w.player.hull = (+arg || 20) / 100; w.player.shield = arg2 === 'noshield' ? 0 : Math.max(w.player.shield, 0.6); if (++k % 25 === 0) w.input.dash = k % 50 ? 1 : -1; }, 100); return; }
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
  // Overhaul: overhaul[:<rank>][:confirm] (Workshop maxed, ready for that rank, default 1; confirm: Overhaul pressed), blueprints
  // (rank 3 with Blueprints to spend), escorts[:trail] (in flight).
  if (name === 'overhaul' || name === 'blueprints' || name === 'escorts') {
    const pr = st.prestige;
    if (name === 'overhaul') { for (const u of WORKSHOP) st.workshop[u.id] = u.max; pr.cycleBest = 74; if (+arg > 1) { pr.level = st.stats.overhauls = +arg - 1; st.stationName = 'Halcyon'; for (const u of WORKSHOP) st.stationPeak[u.id] = u.max; } }
    else { pr.level = name === 'escorts' ? 8 : 3; pr.bp = 14; pr.tech = { bp_bay: 2, bp_intercept: 1, bp_shield: 1, bp_salvage: 1 }; pr.escorts = ['intercept', 'shield']; st.stats.overhauls = pr.level; st.trail = arg || 'prism'; for (const u of WORKSHOP) st.workshop[u.id] = Math.min(u.max, 6); }
    recalc(); if (name !== 'escorts') { hooks.toHangar('workshop'); if (arg === 'confirm' || arg2 === 'confirm') setTimeout(() => document.querySelector('.oh-go')?.click(), 700); return; }
    hooks.launch(); st.run.offer = null; st.run.pendingLevels = 0; ui.closeOverlays();
    setInterval(() => { const w = G.world, run = st.run; if (!w?.player || !run) return; if (run.offer || run.relicOffer) { if (run.relicOffer) pickRelic(0); else pickCard(autoPickIndex(run)); if (!run.offer && !run.relicOffer) ui.closeOverlays(); }
      const s = Math.sin(performance.now() / 1100); w.input.hold = s > 0.3 ? 1 : s < -0.3 ? -1 : 0; w.player.hull = 1; }, 120); return;
  }
  if (arg === 'locked') { st.unlocked.weapons = { cannon: 1, laser: 1 }; st.unlocked.abilities = { overdrive: 1 }; }
  // A tab scene can scroll to a section by its heading: ships:engine shows the engine trails.
  if (['workshop', 'armory', 'ships', 'contracts', 'launch', 'missions', 'records', 'awards'].includes(name)) { hooks.toHangar(name); if (arg && arg !== 'locked') setTimeout(() => [...document.querySelectorAll('h3')].find((x) => x.textContent.toLowerCase().includes(arg))?.scrollIntoView(), 500); return; }
  hooks.launch();
  if (name !== 'levelup') { st.run.offer = null; st.run.pendingLevels = 0; ui.closeOverlays(); }
  if (name === 'levelup') { grantXp(40); ui.nextChoice(); }
  else if (name === 'relic') { st.run.pendingRelics = 1; ui.nextChoice(); }
  else if (name === 'synergy') { const run = st.run; run.offer = null; run.pendingLevels = 0; run.cards = { m_crit: 1, m_critd: 2 }; recalc();
    run.offer = [{ kind: 'mod', id: 'm_aim', stack: 1, rarity: 'common' }, { kind: 'mod', id: 'm_hull', stack: 1, rarity: 'common' }, { kind: 'mod', id: 'm_drone', stack: 1, rarity: 'rare' }]; ui.closeOverlays(); ui.nextChoice(); }
  else if (name === 'dash') { const run = st.run; run.offer = null; run.pendingLevels = 0; ui.closeOverlays(); let d = 1; setInterval(() => { const w = G.world; if (!w) return; w.input.dash = d; d = -d; w.player.hull = 1; }, 900); }
  else if (name === 'anomaly') { const run = st.run; run.offer = null; run.pendingLevels = 0; run.wave = 71; run.anomalies = arg ? arg.split(',') : ['hardened']; run.pendingAnomaly = true; recalc(); ui.closeOverlays(); ui.nextChoice(); }
  else if (name === 'void') { const run = st.run; run.offer = null; run.pendingLevels = 0; ui.closeOverlays(); run.wave = +(arg2 || 62); run.anomalies = (arg || 'lances').split(','); for (const id of ['laser', 'tesla']) { run.order.push(id); run.weapons[id] = 6; } run.weapons.cannon = 7; recalc(); bus.emit('anomalyPicked'); debugSetWave(run.wave);
    setInterval(() => { const w = G.world; if (!w?.player || !st.run) return; if (st.run.offer || st.run.relicOffer) { st.run.offer = st.run.relicOffer = null; st.run.pendingLevels = st.run.pendingRelics = 0; ui.closeOverlays(); } w.player.hull = 1; const s = Math.sin(performance.now() / 1300); w.input.hold = s > 0.35 ? 1 : s < -0.35 ? -1 : 0; }, 100); }
  // voidboss:<1-6>[:look|:sector]: the beacons lit and a sortie jumped to that Void boss's wave (the ship does not die; look:
  // hold fire; sector: jump to the first wave of its Deep Void sector instead, to see the sector banner name it)
  else if (name === 'voidboss') { const run = st.run, n = Math.max(1, Math.min(6, +arg || 1)); run.offer = null; run.pendingLevels = 0; ui.closeOverlays(); st.prestige.level = Math.max(8, st.prestige.level || 0);
    for (const id of ['laser', 'tesla', 'missile']) { run.order.push(id); run.weapons[id] = 9; } run.weapons.cannon = 9; recalc(); debugSetWave(arg2 === 'sector' ? 51 + n * 10 : 60 + n * 10);
    setInterval(() => { const w = G.world; if (!w?.player || !st.run) return; if (st.run.offer || st.run.relicOffer || st.run.pendingAnomaly) { st.run.offer = st.run.relicOffer = null; st.run.pendingLevels = st.run.pendingRelics = 0; st.run.pendingAnomaly = false; ui.closeOverlays(); } w.player.hull = 1; if (arg2 === 'look') w.shots.length = 0; const s = Math.sin(performance.now() / 1300); w.input.hold = s > 0.35 ? 1 : s < -0.35 ? -1 : 0; }, 100); }
  // mainfoe:<type>[:wave]: a formation of one enemy type, to see it (the ship does not die)
  else if (name === 'mainfoe') { const run = st.run, def = ENEMIES[arg]; run.offer = null; run.pendingLevels = 0; ui.closeOverlays(); debugSetWave(+(arg2 || 24));
    setTimeout(() => { const w = G.world, list = w.enemies.filter((e) => e.alive && e.slot).sort((a, b) => a.slot.y - b.slot.y || a.slot.x - b.slot.x); for (const e of list) { e.def = def; e.type = arg; e.color = def.color; e.r = def.r; e.link = null; }
      if (def.link) for (let i = 0; i + 1 < list.length; i += 2) if (list[i].slot.y === list[i + 1].slot.y) { list[i].link = list[i + 1]; list[i + 1].link = list[i]; } }, 400);
    setInterval(() => { const w = G.world; if (!w?.player || !st.run) return; if (st.run.offer || st.run.relicOffer) { st.run.offer = st.run.relicOffer = null; st.run.pendingLevels = st.run.pendingRelics = 0; ui.closeOverlays(); } w.player.hull = 1; const s = Math.sin(performance.now() / 1300); w.input.hold = s > 0.35 ? 1 : s < -0.35 ? -1 : 0; }, 100); }
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
  else if (name === 'debrief') { st.run.salvage = 812; st.run.weapons.laser = 5; st.run.order.push('laser'); st.run.relics.push('r_glass'); st.run.contractsDone = ['c_wave5', 'c_kills']; st.run.score = 52340; st.run.medalsDone = [{ id: 'a_score', tier: 1, xp: 250 }, { id: 'f_solo', tier: 0, xp: 400 }]; if (arg === 'garden') { st.run.garden = ['sunpetal', 'mistvine']; st.run.seeds = ['emberroot', 'mistvine', 'hivebloom']; } if (big) { st.run.salvage = 23456789; st.run.score = 987654321; st.run.level = 64; st.run.stats.kills = 4321; st.run.stats.bossKills = 9; st.run.time = 1478; } G.world.wave.num = big ? 96 : 23; hooks.abandon(); }
}

/** The crew look test: the four survivors placed and posed in the Greenhouse, moving with the room; the camera set. */
function crewLook(room, view, visor) {
  const at = view === 'wide' ? { mara: [0.75, -2.5, -0.14, 'water'], tomas: [2.55, -1.5, Math.PI / 2, 'bench'], anya: [1.9, -2.35, -0.75, 'tablet'], iko: [-0.9, -0.44, -0.87, 'sit'] }
    : { mara: [-0.72, -6.3, 0.14, 'carry'], tomas: [-0.12, -6.45, 0.03, 'pot'], anya: [0.5, -6.35, -0.1, 'tablet'], iko: [0.98, -6.0, -0.25, 'wave'] };
  const crew = CREW_LOOKS.map((o) => { const [x, z, yaw, pose] = at[o.id], p = buildSurvivor(o, { visor, pose }); p.position.set(x, 0, z); p.rotation.y = yaw; room.scene.add(p); return p; });
  const up = room.update.bind(room); room.update = (dt) => { up(dt); for (const p of crew) p.userData.tick(dt, room.cam); };
  const cam = { line: [0.1, -2.5, 0, -0.1], wide: [-1.4, 1.6, -0.47, -0.15], close: [-0.42, -4.75, 0, -0.1], close2: [0.74, -4.75, 0, -0.1] }[view] || [0.1, -2.5, 0, -0.1];
  room.pos.set(cam[0], 0, cam[1]); room.yaw = cam[2]; room.pitch = cam[3];
}
