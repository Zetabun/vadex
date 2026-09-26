// The Hangar: everything between sorties. Launch, Workshop (permanent upgrades), Armory (weapons & abilities),
// Ships (with paint jobs), Career (pilot rank track and contracts), Records (high scores) and Awards (achievements). The 3D ship idles in the close-up camera above the panel.
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { fmt, fmtInt, fmtTime } from '@last-orbit/core/format.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { SHIPS, SHIP_BY_ID } from '@last-orbit/data/ships.js';
import { MATERIALS, MAT_BY_ID } from '@last-orbit/data/materials.js';
import { REFIT_MAX, REFIT_MINUTES, refitStep } from '@last-orbit/data/refits.js';
import { mats, refitLevel, refitNext, canAfford, refitReady, buyRefit, refitProgress, takeOut, redock, inDock, settleRefit } from '@last-orbit/progression/refits.js';
import { CONTRACTS } from '@last-orbit/data/contracts.js';
import { WEAPONS, WEAPON_ORDER } from '@last-orbit/data/weapons.js';
import { ABILITIES, ABILITY_ORDER } from '@last-orbit/data/abilities.js';
import { SECTORS } from '@last-orbit/data/sectors.js';
import { PAINTS, MAX_RANK, rankNeed, rankReward, rankTitle, paintRank, MAX_MASTERY, masteryNeed, MASTERY_PERKS } from '@last-orbit/data/career.js';
import { THREATS, MAX_THREAT, THREAT_UNLOCK_SECTOR, threatSalvage, threatPilotXp } from '@last-orbit/data/threat.js';
import { dailyBonus } from '@last-orbit/data/daily.js';
import { ACHIEVEMENTS, FEATS, TIERS, FEAT_XP } from '@last-orbit/data/achievements.js';
import { BANNERS, bannerReqLabel } from '@last-orbit/data/banners.js';
import { paintBanner } from '@last-orbit/rendering/bannerArt.js';
import { workshopLevel, workshopNext, buyWorkshop, shipStatus, shipContract, buyShip, selectShip, contractProgress, nextContracts, unlockLabel, pilotProgress, selectPaint, threatMax, setThreat, dailyToday, masteryOf, masteryProgress, medalProgress, medalTotal, medalDesc, bannerProgress, nextBanner, selectBanner } from '@last-orbit/progression/meta.js';
import { weaponDps, buildWeapon } from '@last-orbit/progression/stats.js';
import { playSfx } from '@last-orbit/audio/audio.js';
import { h, clear, setText, setClass, scrollHints } from '@last-orbit/ui/dom.js';
import { uiIcon } from '@last-orbit/ui/icons.js';
import { art } from '@last-orbit/ui/art.js';
import { insignia } from '@last-orbit/ui/insignia.js';
import { dailyShareText, shareText } from '@last-orbit/ui/share.js';
import { SYNERGIES } from '@last-orbit/data/synergies.js';
import { BAL } from '@last-orbit/data/balance.js';
import { MOD_BY_ID } from '@last-orbit/data/cards.js';
import { warpMax } from '@last-orbit/progression/run.js';
import { hardRec, STAGES, COUNTER_UNLOCK_SECTOR } from '@last-orbit/data/counter.js';
import { ALIEN_TECH } from '@last-orbit/data/alientech.js';
import { menuState, menuSeen, menuLockText } from '@last-orbit/progression/meta.js';
import { MENU_BY_ID } from '@last-orbit/data/menus.js';
import { techLevel, buyTech, powerRating, workshopMaxed, workshopProgress, overhaulReward, blueprintLevel, blueprintNext, buyBlueprint, blueprintLocked, escortSlots, escortTypes, toggleEscort, trailUnlocked, selectTrail } from '@last-orbit/progression/meta.js';
import { BLUEPRINTS, TRAILS, BP_BASE, OVERHAUL_FX_CAP, OVERHAUL_COST_STEP } from '@last-orbit/data/prestige.js';
import { SIEGE_TIERS, SIEGE_SYSTEMS, SIEGE_CONSOLES, CONSOLE_BY_ID, TIER_BY_N, SYSTEM_BY_ID, siegeOpen, siegeUnlocked, siegeSystems, systemPart, systemSource, sourceName, nextSiege, lockedSiege, siegeAdvice, siegeGuns, siegeDamage, tierSummary, tierPhrase, listNames } from '@last-orbit/data/siege.js';
import { settleSiege, repairStation } from '@last-orbit/progression/siege.js';
import { commsOpen, refreshBounties, bountyProgress, bountyText, claimBounty, rerollBounty, bountyClaimable, untilNextPost } from '@last-orbit/progression/bounties.js';
import { COMMS_RANK, BOUNTY_BONUS_BP, TRANSMISSIONS } from '@last-orbit/data/bounties.js';
import { REST_BONUS, KEEPSAKES, PHOTOS } from '@last-orbit/data/quarters.js';
import { COSMETICS, SLOTS as BOLT_SLOTS, ORBIT_ON_BOLT, boltHere } from '@last-orbit/data/bolt.js';
import { bolt } from '@last-orbit/rendering/bolt.js';
import { boltOf, owns, wear, pat, fetched, boltLine, roomLine, welcomeLine, checkWardrobe } from '@last-orbit/progression/bolt.js';
import { boltNews } from '@last-orbit/progression/boltTalk.js';
import { rest, nextMood } from '@last-orbit/progression/quarters.js';
import { VOID_MARKS, MARK_BY_WAVE, SKY_LINES, voidSector } from '@last-orbit/data/observatory.js';
import { chartable, chartMark, isCharted } from '@last-orbit/progression/observatory.js';
import { YARD_RANK, YARD_STAGES, YARD_SHIP, YARD_LINES, yardOpen, stageSalvage } from '@last-orbit/data/shipyard.js';
import { yardStage, yardDone, nextStage, stageBlock, buildStage } from '@last-orbit/progression/shipyard.js';
import { VOID_BOSSES, VOID_BOSS_BP, VOID_LORE, BEACON_LINES, firstWaveOf } from '@last-orbit/data/beacons.js';
import { beaten as voidBeaten, allBeaten as voidAllBeaten } from '@last-orbit/progression/beacons.js';
import { DESTINATIONS, DEST_BY_ID, PATHFINDER_AT, FLEET_PAINT, OPS_LINES, DAMAGE, fleetOpen, destOpen, mayFind, riskWord } from '@last-orbit/data/fleet.js';
import { fleet, shipAway, tripDone, tripLeft, cannotSend, sendShip, recallShip, collectShip, fleetCounts, nextHome, damageOf, repairCost, canRepair, repairShip } from '@last-orbit/progression/fleet.js';
import { sortieWorth } from '@last-orbit/progression/bounties.js';
import { BOSSES } from '@last-orbit/data/bosses.js';
import { STATION_CORE, MODULE_BY_ID, ALIEN_BY_ID, TROPHY_BY_ID, REBUILD_PARTS, rebuildPct, rebuildParts, stationSnapshot, caughtStages, hallOpen, STATION_TROPHIES, trophyWon, HUNTED } from '@last-orbit/data/station.js';
import { ROOMS_ABOARD, ROOM_BY_ID, roomOpen, roomFresh, roomIntro, wingAt } from '@last-orbit/data/rooms.js';
import { SEEDS, SEED_BY_ID, gardenOpen, bedsOpen, wingOpen, WING_RANK, WING_SPEED, WATER_BOOST, SPRIG_LINES, TREE_LINES, seedWhere } from '@last-orbit/data/garden.js';
import { garden, growth, hoursLeft, startGarden, plant, water, wateredToday, harvest, basketNext, gardenCounts, seedCount } from '@last-orbit/progression/garden.js';
import { stationBlueprint, pieceThumb } from '@last-orbit/ui/stationArt.js';
import { replayTitle, replayEnding } from '@last-orbit/rendering/replay.js';
import { CHANNELS, replayOf } from '@last-orbit/progression/recorder.js';
const TV_CHANNELS = [...CHANNELS, { id: 'news', name: 'News', how: '', live: true }, { id: 'boards', name: 'Boards', how: '', live: true }]; /* as rendering/deck.js */
import { TURRET_MOD, TURRET_RARITY, turretKit } from '@last-orbit/data/turret.js';
import { nightAmount } from '@last-orbit/rendering/background.js';
import { DRONES } from '@last-orbit/data/drones.js';
import { MUTATOR_BY_ID, dayKey, dailyFor } from '@last-orbit/data/daily.js';
import { BOARD_TABS, RETRY_MS } from '@last-orbit/data/global.js';
import { BOOSTS, BOOST_BY_ID } from '@last-orbit/data/boosts.js';
import { kit, kitCount } from '@last-orbit/progression/boosts.js';
import { gl, posting, boardsOn, tell, flush, boardName, boardOf, cachedBoard, boardFresh, fetchBoard } from '@last-orbit/progression/global.js';

const TABS = [['launch', 'Launch'], ['missions', 'Missions'], ['workshop', 'Workshop'], ['armory', 'Armory'], ['ships', 'Ships'], ['contracts', 'Career'], ['records', 'Records'], ['awards', 'Awards'], ['deck', 'Deck']];
// The tab bar holds five buttons. With more tabs than fit it pages: the first page has four tabs and More, the last
// Back and up to four, any between Back, three and More. Hidden tabs (the Command Deck before the first Overhaul) take no slot.
const SLOTS = 5;
function paginate(ids) {
  if (ids.length <= SLOTS) return [ids];
  const out = [ids.slice(0, SLOTS - 1)]; let i = SLOTS - 1;
  while (i < ids.length) { const left = ids.length - i, n = left <= SLOTS - 1 ? left : SLOTS - 2; out.push(ids.slice(i, i + n)); i += n; }
  return out;
}
const roman = (t) => (t ? THREATS[t].roman : '0');
const ROMAN_N = (n) => [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
const untilMidnight = () => { const n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); const s = Math.max(0, (m - n) / 1000); return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`; };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const unlockedBy = (kind, id) => CONTRACTS.find((c) => c.unlock?.[kind] === id);

export function createHangar(hooks) {
  const $ = {}; let tab = 'launch';
  $.salvage = h('span');
  const top = h('header.hg-top',
    // Top left: the pilot, by callsign (or rank title) with their rank beneath; the insignia updates as they rank up.
    $.brand = h('button.brand.pilot-id', { onclick: () => show('contracts'), 'aria-label': 'Pilot career' }, $.brandIns = h('span.brand-ins'), h('span.brand-txt', $.brandName = h('b'), $.brandRank = h('small'))),
    h('button.chip.salvage.big.res-open', { title: 'Your resources', 'aria-label': 'Salvage. Tap to see all your resources', onclick: () => resourcesPanel() }, art('cur:salvage', 'cur-ico'), $.salvage, h('i.chip-more')),
    h('button.icon-btn', { 'aria-label': 'Settings', onclick: () => hooks.settings() }, uiIcon('gear')));
  $.body = scrollHints(h('main.hg-body'));
  $.nav = h('nav.hg-nav', { role: 'tablist' });
  const navBtns = {}; let page = 0;
  for (const [id, name] of TABS) navBtns[id] = h('button.nav-btn', { role: 'tab', onclick: () => show(id) }, uiIcon(id === 'launch' ? 'launch' : id), h('span', name), h('i.badge'), h('i.nav-lock', uiIcon('lock')), h('b.nav-new', 'NEW'));
  let pages = [TABS.map((t) => t[0])], navSig = '';
  const pageOf = (id) => Math.max(0, pages.findIndex((p) => p.includes(id)));
  $.next = h('button.nav-btn.nav-page', { 'aria-label': 'More menus', onclick: () => turn(1) }, uiIcon('chevron'), h('span', 'More'), h('i.badge'));
  $.prev = h('button.nav-btn.nav-page', { 'aria-label': 'Back to main menus', onclick: () => turn(-1) }, uiIcon('back'), h('span', 'Back'), h('i.badge'));
  const shownTabs = () => TABS.map((t) => t[0]).filter((id) => !(id === 'deck' && menuState(id) === 'locked'));
  function layoutNav() {
    const ids = shownTabs(); navSig = ids.join(); pages = paginate(ids); page = Math.min(page, pages.length - 1);
    clear($.nav);
    if (page > 0) $.nav.append($.prev);
    for (const id of pages[page]) $.nav.append(navBtns[id]);
    if (page < pages.length - 1) $.nav.append($.next);
    while ($.nav.children.length < SLOTS) $.nav.append(h('span.nav-gap'));
  }
  function turn(d) { page = Math.max(0, Math.min(pages.length - 1, page + d)); playSfx('tab'); layoutNav(); badges(); }
  // The station in the home-screen sky is a way aboard: it sits over the spot the renderer draws it (rendering/station.js).
  $.stationHot = h('button.station-hot', { 'aria-label': 'Your station', onclick: () => stationCard() });
  // The name tag under the station (drawn in the 3D scene) is tappable too: it names the station.
  // The station callout: its name and how far the rebuild has come, with a hairline to the hub (placed each frame).
  $.coLine = document.createElementNS('http://www.w3.org/2000/svg', 'line'); $.coDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); $.coDot.setAttribute('r', '3.5');
  $.coSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); $.coSvg.setAttribute('class', 'co-svg'); $.coSvg.append($.coLine, $.coDot);
  // The rebuild bar: one segment per 5%, grouped by part (modules, core pieces, captures), each group filling on its own.
  $.coBar = h('div.co-bar', { 'aria-hidden': 'true' }, REBUILD_PARTS.map((r) => h('div.g-' + r.id, { style: `--n:${r.weight / 5}` }, Array.from({ length: r.weight / 5 }, () => h('i')))));
  $.callout = h('button.st-callout', { onclick: () => stationCard() }, h('small', 'Your station', h('em.co-new', 'NEW')), $.coName = h('b'), $.coBar, $.coSub = h('span'));
  const el = h('div#hangar', top, $.body, $.coSvg, $.stationHot, $.callout, $.nav);

  // The rooms aboard the station: 3D spaces to walk round, each reached from the hangar and left the way you came.
  const ROOMS = { deck: 'Command Deck', control: 'Defence Control', gunner: 'Gunner seat', hall: 'Trophy Hall', comms: 'Comms room', quarters: 'Pilot\'s quarters', observatory: 'Observatory', yard: 'Shipyard', beacons: 'Beacon array', garden: 'Greenhouse', ops: 'Fleet Ops' };
  let outside = 'launch'; // the hangar tab the rooms lead back to
  let gunTier = 1, gunFrom = 'control'; // the siege in the gunner seat, and where leaving it goes
  function show(id, quiet) {
    // A room aboard stays sealed until whatever opens it (data/rooms.js: an Overhaul rank, or for Defence Control the
    // invaders' first strike back), and explains itself on the first visit.
    const room = ROOM_BY_ID[id];
    if (room?.seen && !roomOpen(room, G.state)) { if (!quiet) { playSfx('deny'); hooks.toast?.(room.lock, 'info'); } if (tab !== id) return; id = 'launch'; }
    else if (room?.seen && !G.state.seen[room.seen]) { G.state.seen[room.seen] = true; setTimeout(() => hooks.menuIntro?.(roomIntro(room)), 150); }
    // Today's bounties are posted when you arrive in the Comms room (or look in Missions).
    if (id === 'comms' || id === 'missions') postBounties();
    if (id === 'garden') startGarden(G.state); // the first visit finds a few seeds in the drawer
    checkWardrobe(G.state); // anything new for Bolt to wear (data/bolt.js)
    // With Records open, the pilot joins the global boards (progression/global.js): told once, and their best goes up.
    if (menuState('records') === 'open' && tell(G.state)) { G.state.seen.records = false; flush(G.state); const who = boardName(G.state);
      setTimeout(() => bus.emit('notice', { kind: 'unlock', kicker: 'New', title: 'Global boards', sub: `Your Daily and best scores now go up as ${who}. See where you stand in Records, or on the Deck TV.`, art: 'ach:trophy' }), 900); }
    if (id === 'ships' && G.state.seen.materials && !G.state.seen.refits) { G.state.seen.refits = true; setTimeout(() => hooks.menuIntro?.({ icon: 'ships', kicker: 'New', title: 'Ship refits', text: 'Each ship now has five refits of its own, paid in materials: Alloy from sectors 1-2, Crystal from 3-4, Void shards from 5-6 and the Deep Void. Warping past a stretch means going without its material. Find them on each hull\'s card, further down. Each takes a while in the dock (20 minutes for the first, up to 3 hours for the last), one at a time, and that ship cannot fly till it is done: take her out early if you need her, and the refit waits. A refit counts while you fly that ship, and an Overhaul leaves it alone. Tap your salvage at the top of the screen any time to see everything you hold.' }), 350); }
    // A menu the pilot has not earned yet stays shut (with a note on when it opens); a newly opened one explains itself once.
    if (menuState(id) === 'locked') { if (!quiet) { playSfx('deny'); hooks.toast?.(menuLockText(id), 'info'); } if (tab !== id) return; id = 'launch'; }
    if (menuState(id) === 'new') { menuSeen(id); setTimeout(() => hooks.menuIntro?.(MENU_BY_ID[id]), 150); }
    if (!quiet && id !== tab) playSfx('tab');
    if (shownTabs().join() !== navSig) layoutNav();
    if (ROOMS[id] && !ROOMS[tab]) outside = tab; const moved = (ROOMS[id] ? id : null) !== G.room; if (moved) { for (const r of Object.values(G.renderer?.rooms || {})) r.keys = {}; stopWatching(); G.renderer?.rooms?.gunner?.silence?.(); } G.room = ROOMS[id] ? id : null; if (moved && G.room === 'gunner') G.renderer?.room?.start?.(gunTier); /* every time in the seat is a fresh siege */ const app = el.parentElement; if (app) { if (G.room) app.dataset.room = G.room; else delete app.dataset.room; } setClass($.stationHot, 'on', id === 'launch'); setClass($.callout, 'on', id === 'launch'); setClass($.coSvg, 'on', id === 'launch'); if (id === 'launch') stationNews();
    tab = id; if (pageOf(id) !== page) { page = pageOf(id); layoutNav(); }
    for (const k in navBtns) { setClass(navBtns[k], 'on', k === id); navBtns[k].setAttribute('aria-selected', String(k === id)); }
    if (id === 'awards') G.state.seen.medals = medalTotal().earned;
    if (id === 'records') G.state.seen.records = true;
    const changed = el.dataset.tab !== id; el.dataset.tab = id; lay.dirty = true; render(changed || quiet); badges(); hooks.measure?.();
  }
  /** Rebuild the current tab. Re-renders after a purchase or a choice keep the scroll position, so rapid taps
   *  on a list (Workshop upgrades) stay on the row under the finger; switching tabs starts at the top. */
  function render(top = false) {
    const y = $.body.scrollTop; clear($.body);
    const view = { launch: launchView, missions: missionsView, workshop: workshopView, armory: armoryView, ships: shipsView, contracts: contractsView, records: recordsView, awards: awardsView, deck: () => roomView('deck'), control: () => roomView('control'), hall: () => roomView('hall'), comms: () => roomView('comms'), quarters: () => roomView('quarters'), observatory: () => roomView('observatory'), yard: () => roomView('yard'), beacons: () => roomView('beacons'), garden: () => roomView('garden'), ops: () => roomView('ops'), gunner: () => gunnerView() }[tab]();
    $.body.append(view); $.body.scrollTop = top ? 0 : y;
  }

  // ------------------------------------------------------------ launch
  function launchView() {
    const st = G.state, ship = SHIP_BY_ID[st.ship], s = st.stats, next = nextContracts(st.stats.sorties ? 2 : 1);
    const best = s.bestWave || 0, bestSector = Math.min(SECTORS.length, s.bestSector || 1);
    const fresh = !s.sorties;
    const card = h('section.launch-card',
      h('div.ship-head', h('div', h('div.kicker', ship.role), h('h1', ship.name)), menuState('ships') !== 'locked' ? h('button.link', { onclick: () => show('ships') }, 'Change ship', uiIcon('chevron')) : null),
      rankStrip(),
      menuState('missions') !== 'locked' ? opsRow() : null, basketRow(),
      warpRow(),
      fresh ? h('p.lede', 'Invaders are descending on the last orbit. Fly a sortie, level up mid-fight by picking upgrades, and bring salvage home to build a better ship.')
        : h('button.stat-row.as-link', { onclick: () => show('records'), 'aria-label': 'Open records' }, stat('High score', s.bestScore ? fmt(s.bestScore) : '—'), stat('Best wave', best ? `${best} · S${bestSector}` : '—'), stat('Sorties', fmtInt(s.sorties))),
      next.length ? h('div.next', h('div.kicker', next.length > 1 ? 'Next contracts' : 'Next contract'), next.map((c) => contractLine(c, true))) : null);
    const go = h('div.launch-dock', h('button.launch-btn', { onclick: () => launch() }, uiIcon('launch'), h('span', 'Launch sortie'), h('small', ship.name + ' · ' + WEAPONS[ship.weapon].name + ' · ' + ABILITIES[ship.ability].name)));
    return h('div.launch', h('div.ship-stage', { 'aria-hidden': 'true' }), card, history(), go);
  }
  const stat = (k, v) => h('div.stat', h('small', k), h('b', String(v)));
  /** Daily Sortie and threat shortcuts on the Launch card, once they matter. */
  function opsRow() {
    const st = G.state, d = dailyToday(), tmax = threatMax(), items = [];
    if (st.stats.sorties > 0) items.push(h('button.op' + (d.done ? '.done' : '.hot'), { onclick: () => show('missions') }, art('relic:r_phoenix', 'op-ico'),
      h('div', h('small', d.done ? 'Daily done' : 'Daily sortie'), h('b', d.done ? 'Back in ' + untilMidnight() : d.mutator.name))));
    if (tmax > 0) items.push(h('button.op', { onclick: () => show('missions') }, art('relic:r_giant', 'op-ico'),
      h('div', h('small', 'Threat'), h('b', st.threat ? `${roman(st.threat)} · +${Math.round((threatSalvage(st.threat) - 1) * 100)}%` : 'Off'))));
    if (fleetOpen(st) && st.seen.ops) { const c = fleetCounts(st); items.push(h('button.op.fl-op' + (c.ready ? '.hot' : ''), { onclick: () => show('ops') }, h('span.op-ico', uiIcon('ops')),
      h('div', h('small', 'Fleet'), h('b', c.ready ? `${c.ready} home` : c.damaged ? `${c.damaged} to repair` : c.out ? `Back in ${hrs(nextHome(st))}` : `${c.free} berth${c.free === 1 ? '' : 's'} free`)))); }
    return items.length ? h('div.ops', items) : null;
  }
  /** Warp start: choose the sector to begin in, once later sectors have been reached. */
  function warpRow() {
    const st = G.state, max = warpMax(); if (max < 2) return null;
    const cur = Math.min(max, st.warp || 1), chips = [];
    for (let s = 1; s <= max; s++) chips.push(h('button.warp-chip' + (s === cur ? '.on' : ''), { onclick: () => { st.warp = s; playSfx('tab'); render(); } }, h('b', 'S' + s), h('small', SECTORS[s - 1].name.split(' ')[0])));
    return h('div.warp', h('div.warp-head', h('small', 'Start at'), h('span', cur > 1 ? `+${(cur - 1) * BAL.warpCards} catch-up cards and ${(cur - 1) * BAL.warpRelics} relic${cur > 2 ? 's' : ''}` : 'Sector 1, from the very beginning')), h('div.warp-chips', chips));
  }
  function rewardBadge(r) {
    const rw = rankReward(r);
    return rw.paint ? h('span.reward.paint', swatch(rw.paint), PAINTS.find((p) => p.id === rw.paint).name + ' paint') : h('span.reward', art('cur:salvage', 'cur-ico'), fmtInt(rw.salvage));
  }
  /** The next rank's reward as a tag: your ship in the paint job it unlocks (or the salvage), in that paint's colours. */
  function rewardTag(r) {
    const rw = rankReward(r), label = h('small', `Next · Rank ${r}`);
    if (!rw.paint) return h('span.reward-tag.salvage', h('span.rt-ico', art('cur:salvage')), h('span.rt-text', label, h('b', fmtInt(rw.salvage) + ' salvage')));
    const pt = PAINTS.find((p) => p.id === rw.paint), ship = SHIP_BY_ID[G.state.ship], trim = hex(pt.trim ?? ship.trim), hull = hex(pt.hull ?? 0x718996);
    const icon = art('ship:' + ship.id, 'rt-ship'), svg = icon.querySelector('svg'); svg.style.setProperty('--ic-a', trim); svg.style.setProperty('--ic-b', hull);
    return h('span.reward-tag', { style: `--rt:${trim};--rh:${hull}` }, icon, h('span.rt-text', label, h('b', pt.name + ' paint')));
  }
  function rankStrip() {
    const p = G.state.pilot, max = p.rank >= MAX_RANK;
    return h('button.rank-strip', { onclick: () => show('contracts') },
      insignia(p.rank, 'rank-ins'),
      h('div.rank-main', h('div.rank-line', p.name ? h('div.rank-who', h('small', rankTitle(p.rank)), h('b', p.name)) : h('b', rankTitle(p.rank)), max ? h('span', 'Max rank') : rewardTag(p.rank + 1)),
        h('div.meter.rank', h('i', { style: `width:${(pilotProgress() * 100).toFixed(1)}%` }))));
  }
  function swatch(id) {
    const pt = PAINTS.find((x) => x.id === id), ship = SHIP_BY_ID[G.state.ship];
    const trim = hex(pt.trim ?? ship.trim), hull = hex(pt.hull ?? 0x718996);
    return h('i.swatch', { style: `background:linear-gradient(135deg,${hull} 0 50%,${trim} 50% 100%)` });
  }
  function history() {
    const H = G.state.history; if (!H.length) return null;
    return h('section.panel.history', h('div.kicker', 'Recent sorties'), H.slice(0, 4).map((r) => h('div.hist', h('b', 'Wave ' + r.wave), h('span', (r.score ? fmt(r.score) + ' pts · ' : '') + `LV ${r.level} · ${SHIP_BY_ID[r.ship]?.name || ''} · ${fmtTime(r.time)}`), h('span.gold', art('cur:salvage', 'cur-ico'), fmtInt(r.salvage)))));
  }
  function contractLine(c, compact) {
    const pr = contractProgress(c);
    return h('div.contract' + (pr.done ? '.done' : '') + (compact ? '.compact' : ''),
      h('div.c-main', h('div.c-title', pr.done ? uiIcon('check') : null, h('b', c.name), h('span.gold', art('cur:salvage', 'cur-ico'), fmtInt(c.salvage))), h('div.c-desc', c.desc),
        c.unlock ? h('div.c-unlock', 'Unlocks ' + (pr.done ? unlockLabel(c.unlock) : secretLabel(c.unlock))) : null,
        pr.done ? null : h('div.meter.small', h('i', { style: `width:${(pr.frac * 100).toFixed(1)}%` }))),
      pr.done ? null : h('div.c-count', `${fmtInt(pr.cur)}/${fmtInt(pr.goal)}`));
  }

  /** Weapons and abilities stay a mystery until unlocked: contracts only say what kind of thing they unlock. */
  const secretLabel = (u) => u.weapon && !G.state.unlocked.weapons[u.weapon] ? 'a new weapon' : u.ability && !G.state.unlocked.abilities[u.ability] ? 'a new ability' : unlockLabel(u);
  const howToUnlock = (c) => c ? `Complete the contract “${c.name}”: ${c.desc} (${fmtInt(contractProgress(c).cur)}/${fmtInt(c.goal)}).` : 'Keep flying to discover it.';

  // ------------------------------------------------------------ workshop
  function workshopView() {
    const list = h('div.rows');
    for (const u of WORKSHOP) {
      const lvl = workshopLevel(u.id), cost = workshopNext(u.id), pips = h('div.lvl-pips');
      for (let i = 0; i < u.max; i++) pips.append(h('i' + (i < lvl ? '.on' : '')));
      const btn = h('button.buy', { disabled: cost == null || G.state.salvage < cost, onclick: () => { const was = stationSnapshot(G.state); if (buyWorkshop(u.id)) { playSfx('buy'); stationNote(u.id, was); render(); hooks.flash?.('#ffc857'); } else playSfx('deny'); } },
        cost == null ? 'MAX' : [art('cur:salvage', 'cur-ico'), fmt(cost)]);
      list.append(h('div.row' + (cost == null ? '.maxed' : ''), art('ws:' + u.id, 'row-icon'), h('div.row-main', h('div.row-title', h('b', u.name), h('span.lv', `${lvl}/${u.max}`)), h('div.row-desc', u.per + ' per level'), pips), btn));
    }
    const c = G.state.counter, tech = c.unlocked ? h('div.rows', ALIEN_TECH.map((u) => {
      const lvl = techLevel(u.id), maxed = lvl >= u.max, pips = h('div.lvl-pips'); for (let i = 0; i < u.max; i++) pips.append(h('i' + (i < lvl ? '.on' : '')));
      const btn = h('button.buy.tech', { disabled: maxed || c.cores < u.cost, onclick: () => { const was = stationSnapshot(G.state); if (buyTech(u.id)) { playSfx('unlock'); stationNote(u.id, was); render(); hooks.flash?.('#6dffc8'); } else playSfx('deny'); } }, maxed ? 'MAX' : [art('relic:r_quantum', 'cur-ico'), String(u.cost)]);
      return h('div.row.tech-row' + (maxed ? '.maxed' : ''), art(u.art, 'row-icon'), h('div.row-main', h('div.row-title', h('b', u.name), h('span.lv', `${lvl}/${u.max}`)), h('div.row-desc', u.per + ' per level'), pips), btn);
    })) : null;
    const pr = G.state.prestige, ready = workshopMaxed();
    return h('div.screen', h('div.screen-head', h('h2', 'Workshop'), h('p', 'Permanent upgrades. They apply to every ship on every sortie.')),
      ready ? overhaulPanel() : null, list,
      tech ? [h('h3.tech-h', 'Alien Tech', h('span', `${c.cores} cores`)), h('p.sub-note', 'Built from Alien Cores, which only Counterattack stars pay. Works in every mode.'), tech] : null,
      pr.level || pr.bp ? blueprintView() : null, ready ? null : overhaulPanel());
  }

  // ------------------------------------------------------------ overhaul (prestige)
  function overhaulPanel() {
    const pr = G.state.prestige, rank = pr.level || 0, ready = workshopMaxed(), prog = workshopProgress(), bp = overhaulReward();
    // The station blueprint: what the Workshop has built, and (dashed gold) what the next Overhaul adds to the core.
    const plan = h('div.oh-plan', { html: stationBlueprint(rank, G.state.workshop, { peak: G.state.stationPeak, alien: G.state.counter?.tech, caught: caughtStages(G.state), name: G.state.stationName, pct: rebuilt() }) },
      h('div.oh-plan-tag', h('small', G.state.stationName || 'Your station'), h('b', ready ? 'Workshop complete' : `Workshop ${Math.round(prog.cur / prog.goal * 100)}%`)),
      rank < STATION_CORE.at(-1).at ? h('div.oh-plan-next', h('i'), `Next Overhaul adds: ${STATION_CORE.find((c) => c.at === rank + 1).name}`) : null);
    return h('section.panel.oh-panel' + (ready ? '.ready' : ''),
      h('div.oh-head', h('div', h('div.kicker', rank ? `Overhaul · Rank ${rank}` : 'Overhaul'), h('h3', ready ? 'Ready to Overhaul' : 'Build your station')), h('div.oh-rank', h('b', String(rank)), h('small', 'rank'))),
      plan,
      ready ? h('div.oh-pay', h('div', h('small', 'Overhaul now for'), h('b', `${bp} Blueprints`)), h('span', bp > BP_BASE ? `${BP_BASE} + ${bp - BP_BASE} for going past wave 60` : 'Reach past wave 60 first for up to +5'))
        : h('div.oh-meter', h('div.meter.small', h('i', { style: `width:${(prog.cur / prog.goal * 100).toFixed(1)}%` })), h('small', `${prog.cur}/${prog.goal} Workshop levels · every upgrade builds a module`)),
      h('p', ready
        ? 'The Workshop resets for Blueprints: escort drones and perks that are never lost. Your station keeps every module and gains a new core piece. Ships, cosmetics, ranks and Counterattack progress all stay.'
        : 'Max every Workshop upgrade to finish the modules, then Overhaul: the Workshop resets for Blueprints, and the station keeps every module and gains a new core piece every rank.'),
      roadmap(rank),
      h('div.oh-perks', h('span', `Each rank: +10% salvage, +2% damage${rank >= OVERHAUL_FX_CAP ? ' (maxed)' : ''}`), h('span', `Workshop costs +${Math.round(OVERHAUL_COST_STEP * 100)}% per rank`)),
      ready ? h('button.btn.gold.oh-go', { onclick: () => hooks.confirmOverhaul() }, 'Overhaul') : null);
  }
  /** Rank by rank: the station piece each Overhaul brings, the room aboard it opens, and its engine trail. */
  function roadmap(rank) {
    const cards = STATION_CORE.filter((c) => c.at >= 1).map((c) => {
      const trail = TRAILS.find((t) => t.at === c.at), room = ROOMS_ABOARD.find((r) => r.rank === c.at), wing = wingAt(c.at), state = c.at <= rank ? 'done' : c.at === rank + 1 ? 'next' : 'later';
      return h('div.rm-card.' + state, h('div.rm-top', h('small', 'Rank ' + c.at), state === 'done' ? h('i.rm-tick', '✓') : state === 'next' ? h('b.rm-next', 'NEXT') : null),
        h('div.rm-thumb', { html: pieceThumb(c.id) }), h('b.rm-piece', c.name), h('span.rm-desc', c.line || ''), room || wing ? h('span.rm-room', { style: `--c:${hex((room || wing).color)}` }, uiIcon((room || wing).icon), room ? 'Room: ' + room.name : wing.wing.chip) : null, trail ? h('span.rm-trail', trailSwatch(trail), trail.name + ' trail') : null);
    });
    const el = h('div.oh-road', h('h4.oh-sub', 'Station roadmap'), h('div.rm-list', cards));
    // Start the strip at the next rank, so what is coming is in view.
    setTimeout(() => { const n = el.querySelector('.rm-card.next'); if (n) n.parentElement.scrollLeft = Math.max(0, n.offsetLeft - 12); }, 0);
    return el;
  }
  function blueprintView() {
    const pr = G.state.prestige, types = escortTypes(), slots = escortSlots();
    const row = (b) => {
      const lvl = blueprintLevel(b.id), cost = blueprintNext(b.id), maxed = cost == null, pips = h('div.lvl-pips'); for (let i = 0; i < b.max; i++) pips.append(h('i' + (i < lvl ? '.on' : '')));
      const locked = blueprintLocked(b.id), btn = h('button.buy.bp' + (locked ? '.locked' : ''), { disabled: maxed || locked || pr.bp < cost, onclick: () => { if (buyBlueprint(b.id)) { playSfx('unlock'); render(); hooks.flash?.('#ff9f43'); } else playSfx('deny'); } }, maxed ? (b.kind === 'escort' ? 'OWNED' : 'MAX') : locked ? [uiIcon('lock'), 'Needs bay'] : [h('i.bp-ico'), String(cost)]);
      return h('div.row.bp-row' + (maxed ? '.maxed' : ''), art(b.art, 'row-icon'), h('div.row-main', h('div.row-title', h('b', b.name), b.max > 1 ? h('span.lv', `${lvl}/${b.max}`) : null), h('div.row-desc', b.per + (b.max > 1 && b.kind !== 'bay' ? ' per level' : '')), b.max > 1 ? pips : null), btn);
    };
    // The escort bays: tap a type to fly it (a full bay swaps out the oldest pick).
    const bays = slots ? h('div.escorts', h('div.esc-head', h('b', 'Escorts'), h('span', `${pr.escorts.length}/${slots} bays · tap to fly`)),
      h('div.esc-list', types.map((t) => h('button.esc' + (pr.escorts.includes(t) ? '.on' : ''), { style: `--c:${hex(DRONES[t].color)}`, onclick: () => { if (toggleEscort(t)) { playSfx('tab'); render(); } } }, h('i'), h('span', DRONES[t].name.replace(' drone', '')))))) : null;
    const group = (title, list) => [h('h4.bp-sub', title), h('div.rows', list.map(row))];
    return [h('h3.tech-h.bp-h', 'Blueprints', h('span', `${pr.bp} blueprints`)), h('p.sub-note', 'Earned by Overhauls and never lost. Escorts fly with you in every sortie, in both modes.'), bays,
      group('Escort drones', BLUEPRINTS.filter((b) => b.kind)), group('Perks', BLUEPRINTS.filter((b) => !b.kind))];
  }
  function trailSwatch(t) {
    const c = t.style === 'prism' ? 'conic-gradient(#ff5d8f,#ffc857,#6dff8e,#5ee6ff,#b69cff,#ff5d8f)' : t.color ? `radial-gradient(circle at 50% 30%,#fff 0 18%,${hex(t.color)} 40%,${hex(t.core ?? t.color)}55 100%)` : 'linear-gradient(#2a3348,#151a2c)';
    return h('i.swatch.trail-sw', { style: `background:${c}` });
  }

  // ------------------------------------------------------------ armory
  function armoryView() {
    const st = G.state, weapons = h('div.grid'), abilities = h('div.grid');
    for (const id of WEAPON_ORDER) {
      const d = WEAPONS[id], open = !!st.unlocked.weapons[id], c = unlockedBy('weapon', id);
      if (!open) { weapons.append(h('details.item.locked.mystery', h('summary', art('ui:unknown', 'item-icon'), h('div.item-main', h('b', 'Unknown weapon'), h('small', c ? 'Contract: ' + c.name : 'Locked')), uiIcon('lock')), h('div.item-body', h('p', howToUnlock(c))))); continue; }
      const dps = open ? weaponDps(buildWeapon(id, 1, G.sheet)) : null;
      weapons.append(h('details.item' + (open ? '' : '.locked'), { style: `--c:${hex(d.color)}` },
        h('summary', art('weapon:' + id, 'item-icon'), h('div.item-main', h('b', d.name), h('small', open ? d.arch + ' · ' + fmt(dps) + ' DPS at rank 1' : c ? 'Contract: ' + c.name : 'Locked')), open ? uiIcon('chevron') : uiIcon('lock')),
        h('div.item-body', h('p', d.desc), open ? h('ol.evos', d.evo.map((e, i) => h('li', h('span.r', 'R' + (i + 2)), h('b', e.name), h('span', e.desc)))) : c ? h('p.muted', `${c.desc}. ${contractProgress(c).cur}/${c.goal}`) : null)));
    }
    for (const id of ABILITY_ORDER) {
      const d = ABILITIES[id], open = !!st.unlocked.abilities[id], c = unlockedBy('ability', id), ship = SHIPS.find((s) => s.ability === id);
      if (!open && !(ship && st.unlocked.ships[ship.id])) { abilities.append(h('div.item.flat.locked.mystery', art('ui:unknown', 'item-icon'), h('div.item-main', h('b', 'Unknown ability'), h('small', howToUnlock(c))), uiIcon('lock'))); continue; }
      abilities.append(h('div.item.flat' + (open ? '' : '.locked'), { style: `--c:${d.color}` },
        art('ability:' + id, 'item-icon'), h('div.item-main', h('b', d.name), h('small', open ? d.desc : [ship ? `Always available on the ${ship.name}. ` : '', c ? `Contract “${c.name}”: ${c.desc}` : 'Locked'].join(''))), open ? null : uiIcon('lock')));
    }
    const syns = h('div.syn-list', SYNERGIES.map((s) => h('div.syn-card', { style: `--s:${s.color}` }, h('div.syn-top', h('b', s.name), h('small', s.cards.map((id) => MOD_BY_ID[id].name).join(' · '))),
      s.tiers.map((t) => h('div.syn-tier', h('span', t.n + ' cards'), h('p', t.desc))))));
    return h('div.screen', h('div.screen-head', h('h2', 'Armory'), h('p', 'Unlocked weapons and abilities can appear as cards when you level up. Weapons evolve at every rank. The rest are yours to discover.')),
      h('h3', 'Weapons'), weapons, h('h3', 'Abilities'), abilities, h('h3', `Field kit · ${kitCount(st)} boost${kitCount(st) === 1 ? '' : 's'}`),
      h('p.sub-note', 'A supply meter fills beside your loadout as you damage invaders. Each time it fills, a canister with a boost lands in your kit (expeditions and Bolt find them too). Tap the kit mid-sortie to use one: the battle waits. Not in the Daily Sortie or Counterattack.'),
      h('div.rows.kit-shelf', BOOSTS.map((b) => h('div.kit-row' + (kit(st)[b.id] ? '' : '.none'), { style: `--c:${b.color}` }, art(b.icon, 'kit-art'), h('div.kit-txt', h('b', b.name, h('span.kit-count', '×' + (kit(st)[b.id] || 0))), h('small', b.how))))),
      h('h3', 'Synergies'), h('p.sub-note', 'Every upgrade card belongs to a theme. Hold enough different cards of one theme in a sortie to switch on its bonus.'), syns);
  }

  // ------------------------------------------------------------ ships
  // ------------------------------------------------------------ resources: everything the pilot holds (the salvage chip opens it)
  /** Every currency and material in one list: how much you hold, where it comes from, what it buys. Ones not found yet
   *  are dimmed, with where to find them. */
  function resourcesPanel() {
    const st = G.state, m = mats(st), seeds = Object.values(st.garden?.seeds || {}).reduce((a, b) => a + b, 0), reach = st.stats.bestSector || 0;
    const row = (ico, name, n, from, use, found, c) => h('div.res-row' + (found ? '' : '.dim'), { style: `--c:${c}` }, h('span.res-ico', ico), h('div.res-txt', h('b', name), h('small', found ? `${from} · ${use}` : `Not found yet: ${from.charAt(0).toLowerCase() + from.slice(1)}`)), h('em', found ? fmt(n) : '—'));
    const band = [1, 3, 5], go = (id) => h('button.btn.ghost.small.res-go', { onclick: () => { hooks.closeOverlays?.(); show(id); } }, id === 'ships' ? 'Ship refits' : 'Workshop', uiIcon('chevron'));
    playSfx('tab');
    hooks.panel?.({ kicker: st.stationName || 'Your stores', title: 'Resources', body: [h('div.res-list',
      row(art('cur:salvage', 'mat-ico'), 'Salvage', st.salvage, 'Every sortie', 'the Workshop, ships, the Shipyard', true, '#ffc857'),
      ...MATERIALS.map((d, i) => row(art('mat:' + d.id, 'mat-ico'), d.name, m[d.id] || 0, 'From ' + d.from, 'ship refits', (m[d.id] || 0) > 0 || (st.seen.materials && reach >= band[i]), hex(d.color))),
      row(h('i.bp-ico'), 'Blueprints', st.prestige?.bp || 0, 'Overhauls, bounties, Void bosses, charting', 'escort drones and perks', (st.prestige?.level || 0) > 0 || (st.prestige?.bp || 0) > 0, '#ffb070'),
      row(art('relic:r_quantum', 'mat-ico'), 'Alien Cores', st.counter?.cores || 0, 'Counterattack stars and sieges', 'Alien Tech', !!st.counter?.unlocked, '#d9a8ff'),
      row(uiIcon('garden'), 'Seeds', seeds, 'Bosses, once the Greenhouse is open', 'plant them for boosts', !!st.garden?.started, '#7ddc6f')),
      h('div.res-links', go('workshop'), st.seen.materials ? go('ships') : null)] });
  }
  // ------------------------------------------------------------ materials and refits (data/materials.js, data/refits.js)
  const matChip = (id, n, have) => { const short = have != null && have < n; return h('span.mat-chip' + (short ? '.short' : ''), { style: `--c:${hex(MAT_BY_ID[id].color)}` }, art('mat:' + id, 'mat-ico'), h('b', short ? `${fmt(have)}/${fmt(n)}` : fmt(n)), h('em', MAT_BY_ID[id].name)); }; /* short: what you have of what it needs */
  /** The materials in the bank, and where each is found. */
  function matBank() {
    const m = mats(G.state);
    return h('div.mat-bank', h('div.mat-row', MATERIALS.map((d) => matChip(d.id, m[d.id] || 0))), h('p.sub-note', 'Materials for refits: Alloy from sectors 1-2, Crystal from 3-4, Void shards from 5-6 and the Deep Void. Bosses always drop some, elites often.'));
  }
  /** A ship's refits: how far along, what each one did, and the next with its cost and how long it takes in the dock; or
   *  the refit under way, if she is in the dock (take her out to fly her: it waits). */
  const mins = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m` : `${Math.max(1, Math.ceil(m))}m`);
  const dockName = () => (yardOpen(G.state) ? 'the dry dock' : 'the hangar');
  function refitBlock(s) {
    const st = G.state, lvl = refitLevel(st, s.id), next = refitNext(st, s.id), m = mats(st), pips = h('div.lvl-pips'); for (let i = 0; i < REFIT_MAX; i++) pips.append(h('i' + (i < lvl ? '.on' : '')));
    const done = Array.from({ length: lvl }, (_, i) => refitStep(s.id, i + 1).line), p = refitProgress(st), mine = p?.ship === s.id;
    const go = () => {
      const got = buyRefit(st, s.id); if (!got) { playSfx('deny'); return; } playSfx('unlock'); hooks.flash?.(hex(s.trim)); hooks.saveNow?.('refit');
      let also = ''; if (st.ship === s.id) { const other = SHIPS.find((o) => o.id !== s.id && st.unlocked.ships[o.id] && selectShip(o.id)); also = other ? ` You're flying the ${other.name} meanwhile.` : ' She is your only ship: take her out when you want to fly, and the refit waits.'; }
      hooks.toast?.(`The ${s.name} is in ${dockName()}: ${got.name}, ready in ${mins(got.mins)}.${also}`, 'good'); render();
    };
    const head = h('div.rf-head', h('small', 'Refits'), pips, h('span', `${lvl}/${REFIT_MAX}`));
    if (mine) {
      const act = p.out ? h('button.btn.ghost.small.rf-go', { onclick: () => { redock(st); playSfx('tab'); hooks.saveNow?.('refit'); render(); } }, 'Back in the dock')
        : h('button.btn.ghost.small.rf-go', { onclick: () => takeOutConfirm(s, () => render()) }, 'Take her out');
      return h('div.refits.busy', head, done.length ? h('div.rf-done', done.map((d) => h('span', d))) : null,
        h('div.rf-next', h('div.rf-txt', h('b', `${p.out ? 'Waiting' : 'In ' + dockName()}: ${p.step.name}`), h('small', p.out ? `${mins(p.mins)} to go · she goes back in after your next sortie` : `${mins(p.mins)} to go · she can't fly or go out till then`)), act,
          h('div.rf-bar', h('i', { style: `width:${(p.k * 100).toFixed(1)}%` }))));
    }
    const busy = p && !mine ? `The dock is busy with the ${SHIP_BY_ID[p.ship]?.name}'s refit` : shipAway(st, s.id) >= 0 ? 'She is out on an expedition' : '';
    return h('div.refits', head, done.length ? h('div.rf-done', done.map((d) => h('span', d))) : null,
      next ? h('div.rf-next', h('div.rf-txt', h('b', next.name), h('small', `${next.line} · takes ${mins(REFIT_MINUTES[next.n - 1])}`)), h('div.rf-cost', Object.entries(next.cost).map(([id, n]) => matChip(id, n, m[id] || 0))), h('button.btn.gold.small.rf-go', { disabled: !canAfford(st, next.cost) || !!busy, onclick: go }, 'Refit'), busy ? h('small.rf-busy', busy) : null)
        : h('div.rf-max', 'Fully refitted'));
  }
  /** Taking a ship out of the dock early: the refit waits, and she goes back in after her sortie. */
  function takeOutConfirm(s, then) {
    const p = refitProgress(G.state); if (!p) return;
    hooks.confirm?.({ kicker: 'Refit', title: `Take the ${s.name} out?`, text: `Her refit (${p.step.name}) has ${mins(p.mins)} to go. It waits, keeping what is done, and she goes back into the dock after your next sortie.`, yes: 'Take her out', no: 'Leave her in', danger: false,
      onYes: () => { takeOut(G.state); playSfx('tab'); hooks.saveNow?.('refit'); then?.(); } });
  }
  /** Launching the ship that is in the dock: ask first (she comes out, and the refit waits). */
  function launch(opts) {
    const st = G.state, s = SHIP_BY_ID[st.ship]; if (!inDock(st, st.ship)) { hooks.launch(opts); return; }
    takeOutConfirm(s, () => hooks.launch(opts));
  }
  /** A refit whose time is up is fitted, with a notice (checked every few seconds in the hangar). */
  let refitAt = 0;
  function refitTick() {
    if (!G.state.refitting || performance.now() < refitAt) return; refitAt = performance.now() + 1500;
    const got = settleRefit(G.state); if (!got) return; const s = SHIP_BY_ID[got.ship];
    bus.emit('notice', { kind: 'unlock', kicker: 'Refit done', title: `${s.name}: ${got.name}`, sub: `${got.line}. Out of the dock and ready to fly.`, art: 'ship:' + got.ship });
    playSfx('unlock', 0.6); hooks.saveNow?.('refit'); if (tab === 'ships' || tab === 'yard') render();
  }
  function shipsView() {
    const st = G.state, list = h('div.ships');
    for (const s of SHIPS) {
      const status = shipStatus(s.id), sel = st.ship === s.id, c = shipContract(s.id);
      let action;
      const away = status === 'owned' ? shipAway(st, s.id) : -1; /* out on an expedition (Fleet Ops): she cannot fly till she is home */
      if (away >= 0) action = h('button.btn.ghost.fl-away', { onclick: () => show('ops') }, tripDone(st, away) >= 1 ? 'Home: unload her in Fleet Ops' : `Away · ${DEST_BY_ID[fleet(st).out[away].dest].name} · ${hrs(tripLeft(st, away))}`);
      else if (status === 'owned' && inDock(st, s.id)) action = h('div.fl-fixrow', h('small', `In ${dockName()} for her refit: ${mins(refitProgress(st).mins)} to go`), h('button.btn.ghost', { onclick: () => takeOutConfirm(s, () => { selectShip(s.id); render(); }) }, 'Take her out and fly her'));
      else if (status === 'owned' && damageOf(st, s.id)) action = h('div.fl-fixrow', h('small', `${DAMAGE[damageOf(st, s.id)].name} from an expedition: repair her to fly her again`), repairButton(s.id));
      else if (status === 'owned') action = h('button.btn' + (sel ? '.ghost' : '.primary'), { disabled: sel, onclick: () => { selectShip(s.id); playSfx('tab'); render(); } }, sel ? 'Selected' : 'Select');
      else if (status === 'buyable') action = h('button.btn.gold', { disabled: st.salvage < s.cost, onclick: () => { if (buyShip(s.id)) { playSfx('unlock'); hooks.flash?.(hex(s.trim)); render(); } else playSfx('deny'); } }, art('cur:salvage', 'cur-ico'), fmt(s.cost));
      else if (status === 'yard') action = yardOpen(st) ? h('button.btn.gold', { onclick: () => show('yard') }, `Build her in the Shipyard · ${yardStage(st)}/${YARD_STAGES.length}`) : h('div.lock-note', uiIcon('lock'), h('span', `Built in the Shipyard, which opens at Overhaul rank ${YARD_RANK}`));
      else action = h('div.lock-note', uiIcon('lock'), h('span', c ? `Contract “${c.name}”: ${c.desc} (${contractProgress(c).cur}/${c.goal})` : 'Locked'));
      list.append(h('article.ship' + (sel ? '.sel' : '') + (status === 'locked' || (status === 'yard' && !yardOpen(st)) ? '.locked' : ''), { style: `--c:${hex(s.trim)}` },
        h('div.ship-top', h('div', h('div.kicker', s.role), h('h3', s.name)), art('ship:' + s.id, 'ship-icon')),
        h('p', s.desc),
        status === 'owned' ? masteryLine(s.id) : null,
        h('ul.perks', s.perks.map((p, i) => h('li' + (p.startsWith('−') ? '.neg' : ''), p)), h('li', 'Ability: ' + ABILITIES[s.ability].name)),
        status === 'owned' ? refitBlock(s) : null,
        h('div.traits', h('div.trait', h('small', 'Trait'), h('b', s.passive.name), h('span', s.passive.desc)),
          h('div.trait' + ((masteryOf(s.id).level || 1) >= 5 ? '.on' : ''), h('small', 'Signature · mastery 5'), h('b', s.signature.name), h('span', `${WEAPONS[s.weapon].name} at rank 7: ${s.signature.desc}.`))),
        action));
    }
    const paints = h('div.paints', PAINTS.map((pt) => {
      const owned = !!st.paints[pt.id], on = st.paint === pt.id;
      const how = pt.source === 'garden' ? 'Grow every kind of plant in the Greenhouse' : pt.source === 'fleet' ? `Bring ${PATHFINDER_AT} expeditions home in Fleet Ops` : pt.source === 'beacon' ? 'Beat all six Void bosses in the Deep Void' : pt.source === 'void' ? `Reach wave ${pt.mark} and chart ${MARK_BY_WAVE[pt.mark]?.name} in the Observatory` : pt.source === 'counter' ? 'Clear Counterattack stage 6' : pt.source === 'mastery' ? `${SHIP_BY_ID[pt.ship].name} mastery 10` : pt.source === 'contract' ? `Contract: ${CONTRACTS.find((c) => c.unlock?.paint === pt.id)?.name}` : `Pilot rank ${paintRank(pt.id)}`;
      const short = pt.source === 'garden' ? 'Greenhouse' : pt.source === 'fleet' ? 'Fleet Ops' : pt.source === 'beacon' ? 'Void bosses' : pt.source === 'void' ? `Void ${voidSector(pt.mark)}` : pt.source === 'counter' ? 'Stage 6' : pt.source === 'mastery' ? 'Mastery 10' : pt.source === 'contract' ? 'Contract' : 'Rank ' + paintRank(pt.id);
      return h('button.paint' + (on ? '.on' : '') + (owned ? '' : '.locked'), { disabled: !owned, title: owned ? pt.name : `${pt.name}: ${how}`, onclick: () => { if (selectPaint(pt.id)) { playSfx('tab'); render(); } } }, swatch(pt.id), h('span', owned ? pt.name : short));
    }));
    const pick = (b) => {
      const owned = !!st.banners[b.id], on = (st.banner || 'none') === b.id, pr = bannerProgress(b), legend = b.rarity === 'legendary';
      return h('button.paint.banner-pick' + (on ? '.on' : '') + (owned ? '' : '.locked') + (legend ? '.legendary' : ''), { disabled: !owned, title: owned ? b.name : `${b.name}: ${bannerReqLabel(b)}`, style: legend ? `--lg:${b.colors[1]}` : null, onclick: () => { if (selectBanner(b.id)) { playSfx('tab'); render(); } } },
        bannerThumb(b), h('span', owned ? b.name : bannerReqLabel(b), legend ? h('small.legend-tag', owned ? 'Legendary · ' + fmt(st.stats[b.live] || 0) : `Legendary · ${fmt(pr.cur)}/${fmt(pr.goal)}`) : null), owned || !b.req ? null : h('i.banner-meter', { style: `width:${(pr.frac * 100).toFixed(0)}%` }));
    };
    const banners = h('div.paints.banners', BANNERS.filter((b) => b.rarity !== 'legendary').map(pick));
    const trails = h('div.paints', TRAILS.map((t) => { const owned = trailUnlocked(t.id), on = (st.trail || 'none') === t.id;
      return h('button.paint' + (on ? '.on' : '') + (owned ? '' : '.locked'), { disabled: !owned, title: owned ? t.name : `${t.name}: Overhaul rank ${t.at}`, onclick: () => { if (selectTrail(t.id)) { playSfx('tab'); render(); } } }, trailSwatch(t), h('span', owned ? t.name : `Rank ${t.at}`)); }));
    const legendRow = (b) => {
      const owned = !!st.banners[b.id], on = st.banner === b.id, pr = bannerProgress(b), v = st.stats[b.live] || 0;
      return h('button.legend-row' + (on ? '.on' : '') + (owned ? '' : '.locked'), { disabled: !owned, style: `--lg:${b.colors[1]}`, onclick: () => { if (selectBanner(b.id)) { playSfx('tab'); render(); } } },
        bannerThumb(b, 'legend-thumb'),
        h('div.lr-main', h('b', b.name), h('small', owned ? (on ? 'Flying now · ' : '') + 'Tracks ' + b.tracks : bannerReqLabel(b)), owned ? null : h('div.meter.small', h('i', { style: `width:${(pr.frac * 100).toFixed(1)}%` }))),
        h('div.lr-stat', h('b', owned ? fmt(v) : `${fmt(pr.cur)}/${fmt(pr.goal)}`), h('small', owned ? b.label : 'Locked')));
    };
    const legends = h('div.legend-box', h('div.legend-head', h('b', 'Legendary'), h('span', 'Stat trackers: each shows a lifetime record, live.')), h('div.legend-list', BANNERS.filter((b) => b.rarity === 'legendary').map(legendRow)));
    return h('div.screen', h('div.screen-head', h('h2', 'Ships'), h('p', 'Each hull starts with its own gun and signature ability. Workshop upgrades apply to all of them.')),
      h('h3', 'Paint job'), paints, h('h3', 'Banner'), h('p.sub-note', 'Cloth banners that stream from your ship. Earn them with medals and high scores.'), banners, legends,
      h('h3', 'Engine trail'), h('p.sub-note', 'Earned by Overhaul rank (Workshop, once it is maxed).'), trails, h('h3', 'Hulls'), matBank(), list);
  }

  function bannerThumb(b, cls = 'banner-thumb') {
    const c = h('canvas.' + cls, { width: 32, height: 96 });
    if (b.shape) paintBanner(c.getContext('2d'), b, 32, 96, b.live ? G.state.stats[b.live] : 0); else c.classList.add('none');
    return c;
  }
  /** "Next banner" hint for Awards (medals) and Records (score). */
  function bannerHint(kind) {
    const b = nextBanner(kind); if (!b) return null; const pr = bannerProgress(b);
    return h('button.banner-hint', { onclick: () => show('ships') }, bannerThumb(b), h('div', h('small', 'Next banner'), h('b', b.name), h('span', `${bannerReqLabel(b)} · ${fmt(pr.cur)}/${fmt(pr.goal)}`)), uiIcon('chevron'));
  }

  function masteryLine(id) {
    const m = masteryOf(id), max = m.level >= MAX_MASTERY, nextPerk = Object.keys(MASTERY_PERKS).map(Number).find((l) => l > m.level);
    return h('div.mastery', h('div.mastery-top', h('b', `Mastery ${m.level}`), h('span', max ? 'Maxed' : `${m.xp}/${masteryNeed(m.level)} waves` + (nextPerk ? ` · Lv ${nextPerk}: ${MASTERY_PERKS[nextPerk]}` : ''))),
      h('div.meter.mastery-bar', h('i', { style: `width:${(masteryProgress(id) * 100).toFixed(1)}%` })), h('small', `+${(m.level - 1) * 2}% damage and hull with this ship`));
  }

  // ------------------------------------------------------------ missions: daily sortie and threat
  function missionsView() {
    const st = G.state, d = dailyToday(), tmax = threatMax();
    const streakNext = d.lastDay && !d.done ? d.streak + 1 : Math.max(1, d.streak);
    const daily = h('section.panel.daily' + (d.done ? '.done' : ''),
      h('div.daily-head', h('div', h('div.kicker', 'Daily sortie · ' + d.key), h('h3', d.mutator.name)), h('div.streak', art('relic:r_phoenix', 'streak-ico'), h('b', String(d.streak || 0)), h('small', 'day streak'))),
      h('p', d.mutator.desc),
      h('ul.perks', h('li', 'Same seed for every pilot today'), h('li', 'One attempt'), h('li', 'Double pilot XP'), h('li', `Bonus ${fmtInt(dailyBonus(20, streakNext))}+ salvage`)),
      d.done ? h('div.daily-done', h('div.lock-note', uiIcon('check'), h('span', `Flown today: reached wave ${d.wave}. Next daily in ${untilMidnight()}.`)),
          G.state.daily.score != null ? h('button.btn.ghost.share-btn', { onclick: () => shareDaily() }, uiIcon('share'), 'Share result') : null)
        : h('button.btn.gold.daily-go', { onclick: () => launch({ daily: true }) }, uiIcon('launch'), 'Fly the daily'));
    let threat;
    if (!tmax) threat = h('div.lock-note', uiIcon('lock'), h('span', `Threat levels open when you reach sector ${THREAT_UNLOCK_SECTOR} (Machine Territory).`));
    else {
      threat = h('div.rows');
      for (let t = 0; t <= MAX_THREAT; t++) {
        const open = t <= tmax, on = st.threat === t;
        threat.append(h('button.threat' + (on ? '.on' : '') + (open ? '' : '.locked'), { disabled: !open, onclick: () => { setThreat(t); playSfx('tab'); render(); } },
          h('div.threat-lv', h('small', 'Threat'), h('b', roman(t))),
          h('div.threat-main', h('b', t ? THREATS[t].rule : 'Standard rules'), h('small', t ? (open ? `+${Math.round((threatSalvage(t) - 1) * 100)}% salvage · +${Math.round((threatPilotXp(t) - 1) * 100)}% pilot XP · includes all lower levels` : `Defeat the wave 40 boss at Threat ${roman(t - 1)}`) : 'No extra rules')),
          on ? uiIcon('check') : open ? null : uiIcon('lock')));
      }
    }
    return h('div.screen', h('div.screen-head', h('h2', 'Missions'), h('p', 'Counterattack, a fresh Daily Sortie every day, and Threat levels for when the sectors stop being scary.')),
      bountyPanel(), counterPanel(), siegePanel(), daily, h('h3', 'Threat level'), threat);
  }

  async function shareDaily() {
    const d = G.state.daily, r = await shareText(dailyShareText({ key: d.day, mutator: MUTATOR_BY_ID[d.mutator]?.name, wave: d.wave, score: d.score, streak: d.streak }));
    if (r === 'copied') hooks.toast?.('Result copied. Paste it to a friend!'); else if (r === 'failed') hooks.toast?.('Could not share from this browser.');
  }

  // ------------------------------------------------------------ daily bounties (the Comms room)
  /** Post today's bounties if they are not up yet (paying any of yesterday's left unclaimed). */
  function postBounties() {
    const paid = refreshBounties(G.state); if (!paid) return; hooks.saveNow?.('bounties');
    hooks.toast?.(`Yesterday's bounties paid: +${fmtInt(paid.salvage)} salvage` + (paid.bp ? ` · +${paid.bp} Blueprint${paid.bp > 1 ? 's' : ''}` : ''), 'good');
  }
  /** Today's bounties as rows: how hard, what, how far along, the pay, and collecting or rerolling. again: redraw. */
  function bountyList(again) {
    const st = G.state, bt = st.bounties || { list: [] };
    return h('div.bn-list', bt.list.map((b, i) => { const p = bountyProgress(st, b), k = Math.min(1, p / b.goal);
      return h('div.bn-row' + (b.claimed ? '.paid' : b.done ? '.done' : ''), h('div.bn-tier', [3, 2, 1].map((t) => h('i' + (t <= b.tier ? '.on' : '')))),
        h('div.bn-main', h('b', bountyText(b)), h('div.bn-bar', h('i', { style: `width:${(k * 100).toFixed(1)}%` })), h('small', b.claimed ? 'Paid' : b.done ? 'Done: collect your pay' : `${fmtInt(p)} / ${fmtInt(b.goal)}`)),
        h('div.bn-side', h('span.bn-pay', art('cur:salvage', 'cur-ico'), fmtInt(b.reward)),
          b.done && !b.claimed ? h('button.btn.gold.small', { onclick: () => { const r = claimBounty(st, i); playSfx('loot'); hooks.toast?.(`+${fmtInt(r.salvage)} salvage` + (r.bp ? ` · all three done: +${r.bp} Blueprint${r.bp > 1 ? 's' : ''}!` : ''), 'good'); if (r.bp) hooks.celebrate?.('#6dffc8'); hooks.saveNow?.('bounty'); again(); } }, 'Collect')
            : !b.done && !bt.rerolled ? h('button.btn.ghost.small', { onclick: () => { if (rerollBounty(st, i)) { playSfx('tab'); hooks.saveNow?.('bounty'); again(); } }, title: 'Swap it for another (once a day)' }, uiIcon('reroll')) : null)); }));
  }
  const bountyFoot = (bt) => h('div.bn-foot', h('span', `New bounties in ${untilNextPost()}`), h('b' + (bt.bonus ? '.got' : ''), bt.bonus ? `All three done · +${BOUNTY_BONUS_BP} Blueprint` : `All three: +${BOUNTY_BONUS_BP} Blueprint`));
  function bountyPanel() {
    const st = G.state; if ((st.prestige?.level || 0) < 1) return null;
    if (!commsOpen(st)) return h('section.panel.ca-panel.bn-panel.locked', h('div.ca-head', h('div', h('div.kicker', 'Daily bounties'), h('h3', 'Comms spire offline')), uiIcon('lock')),
      h('p', `Rebuild the Comms spire (Overhaul rank ${COMMS_RANK}) and ORBIT will pick up three bounties a day from the miners and trawlers, for salvage and Blueprints.`));
    const bt = st.bounties || { list: [] };
    return h('section.panel.ca-panel.bn-panel', h('div.ca-head', h('div', h('div.kicker', 'Daily bounties'), h('h3', 'Jobs on the radio'))),
      bountyList(() => render()), bountyFoot(bt),
      h('button.btn.ghost.wide.sg-room.bn-room', { onclick: () => show('comms') }, uiIcon('comms'), h('span', 'Enter the Comms room'), uiIcon('chevron')));
  }
  /** The bounty board in the Comms room, as a panel. */
  function bountyBoard() {
    const st = G.state, bt = st.bounties || { list: [] }, body = h('div');
    const draw = () => { clear(body).append(bountyList(draw), bountyFoot(bt)); };
    draw(); hooks.panel?.({ kicker: 'Comms room', title: 'Daily bounties', body: [h('p.sub-note', 'Posted each day by the miners and trawlers ORBIT listens to: one easy, one harder, one hard, sized to how you fly. Swap one you do not fancy, once a day.'), body] });
  }
  /** Tapping something in the Comms room: the radio (ORBIT's word on what the spire hears), the bounty board, the system
   *  map, the window, or a door. */
  let radioTalk = 0;
  function commsExhibit(kind) {
    const st = G.state;
    if (kind === 'exit') { show(outside); return; }
    if (kind === 'hall') { show('hall'); return; }
    playSfx('tab');
    if (kind === 'bounties') { bountyBoard(); return; }
    if (kind === 'radio') {
      const open = (st.bounties?.list || []).filter((b) => !b.done), ready = (st.bounties?.list || []).filter((b) => b.done && !b.claimed);
      const lead = ready.length ? `${ready.length > 1 ? `${ready.length} bounties are` : 'A bounty is'} done and waiting to be paid, {n}. The board, on your left.` : open.length ? `${open.length} bount${open.length > 1 ? 'ies' : 'y'} still open today. The best pays ${fmtInt(Math.max(...open.map((b) => b.reward)))} salvage.` : 'Every bounty done today. The miners are talking about you, {n}.';
      const lines = [lead, ...TRANSMISSIONS]; hooks.say?.(lines[radioTalk++ % lines.length]); return;
    }
    if (kind === 'window') { hooks.say?.('The dish is sweeping the belt, {n}. Anyone out there with a job, we will hear them.'); return; }
    if (kind === 'log') {
      const bt = st.bounties || {};
      hooks.panel?.({ kicker: 'Comms room', title: 'Radio log', body: [h('div.deck-board', [['Bounties done', fmtInt(bt.done || 0)], ['Days all three', fmtInt(bt.days || 0)], ['Today', `${(bt.list || []).filter((b) => b.done).length}/3 done`], ['Next bounties', untilNextPost()]].map(([k, v]) => h('div.db-row', h('small', k), h('b', v)))),
        h('p.sub-note', 'The map pings every sector you have reached. The further out you fly, the more the spire can hear.')] });
    }
  }
  // ------------------------------------------------------------ the Pilot's quarters
  /** Tapping something in your quarters: the bunk (rest), the keepsakes, the log, the photos, the lights, Bolt, the
   *  poster, the window, or a door. */
  // ------------------------------------------------------------ Bolt (data/bolt.js, rendering/bolt.js)
  let boltTaps = 0, boltQuietT = 0, boltPending = null, boltCheckT = 0;
  const boltSaid = new Map(); /* news key → when it was said: news rests a while once said (pressing news 10 minutes, the rest 25) */
  const boltFresh = () => { const now = performance.now(), st = G.state; return G.room && boltHere(st) && st.seen?.quarters ? boltNews(st, G.room).filter((n) => now - (boltSaid.get(n.key) ?? -1e9) > (n.pri >= 2 ? 6e5 : 15e5)) : []; };
  const boltNewsSaid = (n) => { boltSaid.set(n.key, performance.now()); boltPending = null; bolt.setNews(false); };
  /** Bolt says something unprompted, now and then (never over ORBIT, a panel, or itself a moment ago). */
  const boltMaySay = (line, gap = 45) => { const now = performance.now(); if (!line || hooks.blocking?.() || hooks.commsBusy?.() || now < boltQuietT) return false; boltQuietT = now + gap * 1000; hooks.boltSay?.(line); return true; };
  /** Tapped, wherever it is: a spin, a hop, hearts, or dizzy; a pat counted; its beep (and now and then ORBIT on it).
   *  If it has news (a "!" over it), the news first. */
  function boltTap() {
    if (boltPending) { const n = boltPending; boltNewsSaid(n); bolt.speak(); playSfx('unlock', 0.45, 1.9); boltQuietT = performance.now() + 20000; hooks.boltSay?.(n.line); return; }
    const mood = bolt.tap(); pat(G.state); boltTaps++;
    playSfx(mood === 'dizzy' ? 'deny' : 'unlock', 0.45, mood === 'happy' ? 2.1 : 1.7); boltQuietT = performance.now() + 20000;
    if (mood !== 'happy' && mood !== 'dizzy' && boltTaps % 6 === 0) { hooks.say?.(ORBIT_ON_BOLT[(boltTaps / 6 - 1) % ORBIT_ON_BOLT.length]); return; }
    const chat = mood === 'tap' && Math.random() < 0.3 ? boltFresh()[0] : null; /* now and then, something about how things stand instead */
    if (chat) { boltNewsSaid(chat); hooks.boltSay?.(chat.line); return; }
    hooks.boltSay?.(boltLine(mood === 'woke' ? 'sleep' : mood));
  }
  /** News it can't keep to itself: a "!" over it, then it flies up and says it (not over ORBIT or a panel). */
  function boltAnnounce(n, wait = 1800) {
    boltPending = n; bolt.setNews(true);
    setTimeout(() => { if (boltPending !== n || !G.room) return; if (hooks.blocking?.() || hooks.commsBusy?.()) { boltCheckT = 0; return; } boltNewsSaid(n); bolt.speak(); boltQuietT = performance.now() + 40000; hooks.boltSay?.(n.line); }, wait);
  }
  /** Every few seconds in a room: pressing news it has not said lately, it says (at most one line in 40 seconds). */
  function boltTick() {
    if (!G.room || boltPending || performance.now() < boltQuietT || (boltCheckT -= 1) > 0) return; boltCheckT = 360; /* frames, about 6 s */
    const n = boltFresh().find((x) => x.pri >= 2); if (n && !hooks.blocking?.() && !hooks.commsBusy?.()) boltAnnounce(n);
  }
  /** Bolt's locker: what it wears, a slot at a time (what is still to find says how), and whether it comes along. */
  function boltLocker() {
    const st = G.state, b = boltOf(st); b.fresh = 0; playSfx('tab'); const room = G.renderer?.room; if (room) room.lockerNew = false;
    const swatch = (slot, c) => slot === 'paint' ? h('i.bl-sw', { style: `background:linear-gradient(135deg,${hex(c.body)} 55%,${hex(c.band)} 55%)` }) : slot === 'eye' ? h('i.bl-sw.eye', { style: `--c:${hex(c.color)}` }) : h('i.bl-sw.hat', uiIcon(c.id === 'none' ? 'close' : 'awards'));
    const grid = (slot) => h('div.bl-grid', COSMETICS[slot].map((c) => { const have = owns(st, slot, c.id), on = b.wear[slot] === c.id;
      return h('button.bl-item' + (on ? '.on' : '') + (have ? '' : '.locked'), { disabled: !have, title: have ? c.name : c.how, onclick: () => { if (wear(st, slot, c.id)) { playSfx('buy'); hooks.saveNow?.('bolt'); hooks.closeOverlays?.(); boltLocker(); setTimeout(() => hooks.boltSay?.(boltLine('dress')), 250); } } },
        swatch(slot, c), h('b', c.name), h('small', have ? (on ? 'Wearing' : 'Wear it') : c.how)); }));
    const follow = h('button.btn.ghost.small.bl-follow', { onclick: () => { b.follow = !b.follow; hooks.saveNow?.('bolt'); playSfx('tab'); hooks.closeOverlays?.(); boltLocker(); } }, b.follow ? 'Bolt comes with me round the station' : 'Bolt stays in my quarters');
    const total = Object.values(COSMETICS).reduce((n, l) => n + l.length, 0), mine = Object.entries(COSMETICS).reduce((n, [slot, l]) => n + l.filter((c) => owns(st, slot, c.id)).length, 0);
    hooks.panel?.({ kicker: 'Pilot\'s quarters', title: 'Bolt\'s locker', body: [h('p.sub-note', `Things for Bolt to wear, ${mine} of ${total} found. They turn up as you fly: each one says what earns it. Bolt has had ${b.pets} pat${b.pets === 1 ? '' : 's'} and played fetch ${b.fetches} time${b.fetches === 1 ? '' : 's'}.`),
      ...BOLT_SLOTS.flatMap(([slot, name]) => [h('h4.oh-sub', name), grid(slot)]), h('h4.oh-sub', 'Where it goes'), follow] });
  }
  /** Into a room with you: coming back from a sortie or a long time away, a room it has not been in, pressing news, or
   *  now and then a greeting or something about the room. */
  bus.on('boltEnter', (room) => { boltPending = null; bolt.setNews(false); setTimeout(() => { const st = G.state; if (G.room !== room) return;
    const first = welcomeLine(st) || roomLine(st, room); if (first) { boltMaySay(first, 50); return; }
    const news = boltFresh(); if (news[0]?.pri >= 2 && performance.now() >= boltQuietT) { boltAnnounce(news[0], 900); return; }
    const r = Math.random(), idle = news.find((n) => n.key === 'room:' + room); if (r < 0.2 && idle && boltMaySay(idle.line, 50)) boltSaid.set(idle.key, performance.now()); else if (r > 0.82) boltMaySay(boltLine('greet'), 50); }, 1300); });
  bus.on('boltInspect', () => { if (Math.random() < 0.35) boltMaySay(boltLine('idle'), 60); });
  bus.on('boltFetched', () => { const n = fetched(G.state); hooks.saveNow?.('bolt'); hooks.boltSay?.(boltLine('fetch')); if (n === 1) setTimeout(() => hooks.toast?.('Bolt loves fetch. Tap its toy any time.', 'info'), 2500); });
  function quartersExhibit(kind) {
    const st = G.state, room = G.renderer?.room;
    if (kind === 'exit') { show(outside); return; }
    if (kind === 'hall') { show('hall'); return; }
    if (kind === 'observatory') { show('observatory'); return; }
    const panel = (title, ...body) => hooks.panel?.({ kicker: 'Pilot\'s quarters', title, body });
    if (kind === 'bunk') {
      const r = rest(st); playSfx(r === 'rested' ? 'unlock' : 'tab', 0.6);
      if (r === 'rested') { room?.sleep?.(); hooks.saveNow?.('rest'); setTimeout(() => hooks.toast?.(`Well rested: your next sortie banks +${Math.round(REST_BONUS * 100)}% salvage.`, 'good'), 1300); }
      else hooks.toast?.(r === 'already' ? 'You are rested already. Fly a sortie to make the most of it.' : 'You have slept today. The bunk will be here tomorrow.', 'info');
      return;
    }
    if (kind === 'mood') { const m = nextMood(st); room?.setMood?.(m); playSfx('tab'); hooks.toast?.(`Lights: ${m.name}`, 'info'); hooks.saveNow?.('mood'); return; }
    if (kind === 'locker') { boltLocker(); return; }
    if (kind === 'dock') { room?.napBolt?.(); playSfx('tab', 0.5, 0.7); setTimeout(() => hooks.boltSay?.(boltLine('sleep')), 900); return; }
    if (kind === 'toy') { if (room?.throwToy?.()) playSfx('dash', 0.4, 1.3); return; }
    playSfx('tab');
    if (kind === 'poster') { hooks.say?.('The recruitment poster. They printed a thousand of them after the Fall, {n}. You answered.'); return; }
    if (kind === 'window') { hooks.say?.('The Outer ring faces the Earth. On a clear night you can see where the cities were, {n}.'); return; }
    const got = KEEPSAKES.filter((k) => k.req(st)), hexc = (n) => '#' + n.toString(16).padStart(6, '0');
    if (kind === 'shelf') panel(`Keepsakes · ${got.length}/${KEEPSAKES.length}`, h('p.sub-note', 'Things you have picked up on the way. Each one comes home to this shelf.'),
      h('div.ks-list', KEEPSAKES.map((k) => { const has = k.req(st); return h('div.ks-row' + (has ? '' : '.off'), { style: `--c:${has ? hexc(k.color) : '#3a3440'}` }, h('i'), h('div', h('b', has ? k.name : 'Still to find'), h('small', has ? k.log : k.how))); })));
    else if (kind === 'log') panel("Pilot's log", h('p.sub-note', `${got.length} of ${KEEPSAKES.length} entries. A new one every time something goes on the shelf.`),
      got.length ? h('div.ks-list', got.map((k, i) => h('div.ks-row', { style: `--c:${hexc(k.color)}` }, h('i'), h('div', h('b', `Entry ${i + 1}`), h('small', k.log))))) : h('p.sub-note', 'Nothing written yet.'));
    else if (kind === 'photos') { const ph = PHOTOS.filter((p) => p.req(st));
      panel(`Photos · ${ph.length}/${PHOTOS.length}`, h('p.sub-note', 'The big moments, pinned up by the door. The empty pins are the ones still to come.'),
        h('div.ks-list', PHOTOS.map((p) => h('div.ks-row' + (p.req(st) ? '' : '.off'), { style: `--c:${p.req(st) ? '#ffe2c4' : '#3a3440'}` }, h('i'), h('div', h('b', p.req(st) ? p.caption(st) : 'An empty pin'), h('small', p.req(st) ? 'Pinned up.' : 'A moment still to come.'))))));
    }
  }
  // ------------------------------------------------------------ the Observatory
  /** The chart of the Deep Void as a panel: every depth, what it pays, and a button to chart any reached. */
  function chartPanel() {
    const st = G.state, best = st.stats.bestWave || 0, body = h('div');
    const draw = () => { clear(body).append(h('div.sg-defs.obs-chart', VOID_MARKS.map((m) => { const done = isCharted(st, m), ready = !done && best >= m.wave;
      return h('div.sg-def' + (done ? '.s2' : ready ? '.s1' : '.s0'), h('i.sg-dot'), h('div', h('b', `${m.name} · Void ${voidSector(m.wave)}`), h('small', `Wave ${m.wave} · +${m.bp} Blueprints` + (m.paint ? ` · ${PAINTS.find((pt) => pt.id === m.paint)?.name} paint` : '')),
        ready ? h('button.btn.gold.small.obs-go', { onclick: () => { const r = chartMark(st, m.wave); if (!r) return; playSfx('milestone', 0.8); hooks.saveNow?.('chart'); G.renderer?.room?.showMark?.(m.wave); setTimeout(() => render(), 50); /* the title's count */ hooks.toast?.(`${r.name} charted: +${r.bp} Blueprints` + (r.paint ? ` · ${PAINTS.find((pt) => pt.id === r.paint)?.name} paint unlocked` : ''), 'good'); hooks.closeOverlays?.(); } }, 'Chart it')
          : h('em', done ? 'Charted' : `${m.wave - best} waves on from your best`))); }))); };
    draw(); playSfx('tab');
    hooks.panel?.({ kicker: 'Observatory', title: 'Chart of the Deep Void', body: [h('p.sub-note', best > 60 ? `Your deepest: wave ${best}. Reach a depth in a sortie and it waits here to be charted.` : 'Past wave 60 there are no charts. Reach a depth of the Deep Void in a sortie and it waits here to be charted.'), body] });
  }
  /** Tapping something in the Observatory: the telescope, the chart, the orrery, the window, or a door. */
  let skyTalk = 0;
  function observatoryExhibit(kind) {
    const st = G.state;
    if (kind === 'exit') { show(outside); return; }
    if (kind === 'quarters') { show('quarters'); return; }
    if (kind === 'yard') { show('yard'); return; }
    if (kind === 'chart') { chartPanel(); return; }
    playSfx('tab');
    if (kind === 'telescope') { const ready = chartable(st); if (ready.length) { chartPanel(); hooks.say?.(`${ready.length > 1 ? `${ready.length} depths are` : `${ready[0].name} is`} waiting to be charted, {n}. The chart is ready when you are.`); return; } hooks.say?.(SKY_LINES[skyTalk++ % SKY_LINES.length]); return; }
    if (kind === 'window') { hooks.say?.('That is the Void, {n}. Somewhere out there is the far shore. We will chart our way to it.'); return; }
    if (kind === 'orrery') { const s = st.stats, deep = Math.max(0, (s.bestWave || 0) - 60);
      hooks.panel?.({ kicker: 'Observatory', title: 'The orrery', body: [h('div.deck-board', [['Furthest wave', s.bestWave || '—'], ['Into the Deep Void', deep ? `+${deep} waves` : '—'], ['Deepest sector', deep ? `Void ${voidSector(s.bestWave)}` : '—'], ['Depths charted', `${VOID_MARKS.filter((m) => isCharted(st, m)).length}/${VOID_MARKS.length}`]].map(([k, v]) => h('div.db-row', h('small', k), h('b', String(v))))),
        h('p.sub-note', 'Its rings are the six sectors and the Void beyond; the light rides the deepest you have flown.')] }); }
  }
  // ------------------------------------------------------------ the Shipyard
  const costLine = (c) => [`${fmtInt(c.salvage)} salvage`, c.cores ? `${c.cores} Alien Core${c.cores > 1 ? 's' : ''}` : '', c.bp ? `${c.bp} Blueprint${c.bp > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
  /** Every ship in a grid: its name and mastery once in the hangar, the Shipyard's ship with how far the yard has got. */
  function bayGrid(st) {
    const paint = PAINTS.find((x) => x.id === st.paint);
    return h('div.deck-bay', SHIPS.map((sh) => {
      const owned = !!st.unlocked.ships[sh.id], known = owned || (sh.yard && yardOpen(st)), icon = art('ship:' + sh.id, 'bay-ship');
      if (sh.id === st.ship && paint && paint.id !== 'factory') { const svg = icon.querySelector('svg'); svg.style.setProperty('--ic-a', hex(paint.trim ?? sh.trim)); svg.style.setProperty('--ic-b', hex(paint.hull ?? 0x718996)); }
      return h('div.bay-stand' + (sh.id === st.ship ? '.active' : '') + (owned ? '' : '.locked'), { style: `--c:${hex(sh.trim)}` }, icon, h('b', known ? sh.name : '???'),
        h('small', owned ? `Mastery ${masteryOf(sh.id).level}` : sh.yard ? (yardOpen(st) ? `In the Shipyard · ${yardStage(st)}/${YARD_STAGES.length}` : `Shipyard · rank ${YARD_RANK}`) : 'Not owned yet'));
    }));
  }
  /** The build: her four stages, those built, and the next with what it costs and the button to build it (or what is
   *  short). Once she is done, the ship in the dock instead. */
  function yardPanel() {
    const st = G.state; playSfx('tab'); if (yardDone(st)) { dockPanel(); return; }
    const n = nextStage(st), block = stageBlock(st), at = yardStage(st), rank = st.prestige?.level || 0, cores = st.counter?.cores || 0, bp = st.prestige?.bp || 0;
    const short = { salvage: `You need ${fmtInt(n.cost.salvage - (st.salvage || 0))} more salvage.`, cores: `You need ${n.cost.cores - cores} more Alien Core${n.cost.cores - cores > 1 ? 's' : ''}: stars in the Counterattack or a Station Siege pay them.`, bp: `You need ${n.cost.bp - bp} more Blueprint${n.cost.bp - bp > 1 ? 's' : ''}: an Overhaul, charting the Deep Void or a full day of bounties pays them.` }[block];
    hooks.panel?.({ kicker: 'Shipyard', title: 'Building the Chimera', body: [
      h('p.sub-note', 'The first ship built aboard since the Fall, plated in the alien hulls you towed home. Fund each stage and the crews build it on the cradle; the last one hands her over to your hangar.'),
      h('div.sg-defs', YARD_STAGES.map((s, i) => h('div.sg-def' + (i < at ? '.s2' : i === at ? '.s1' : '.s0'), h('i.sg-dot'), h('div', h('b', `${i + 1}. ${s.name}`), h('small', s.desc),
        h('em', i < at ? 'Built' : costLine({ salvage: stageSalvage(s, rank), cores: s.cores || 0, bp: s.bp || 0 })))))),
      h('button.btn.gold.wide.yard-go', { disabled: !!block, onclick: () => buildYard() }, n.n === YARD_STAGES.length ? 'Commission her' : `Build: ${n.name}`),
      block ? h('p.sub-note', short) : null] });
  }
  function buildYard() {
    const n = buildStage(G.state); if (!n) { playSfx('deny'); return; }
    hooks.saveNow?.('yard'); hooks.closeOverlays?.(); render();
    if (n.n >= YARD_STAGES.length) { playSfx('unlock'); hooks.flash?.('#6dff8e'); hooks.toast?.('The Chimera is commissioned: she joins your hangar, ready to fly.', 'unlock'); setTimeout(() => hooks.say?.('She is yours, {n}. The first ship this station has built for itself since the Fall.'), 2200); }
    else { playSfx('buy'); hooks.toast?.(`${n.name} done: stage ${n.n} of ${YARD_STAGES.length}.`, 'good'); }
  }
  /** She is done: whichever ship is flown sits in the dock, and its paints can be tried on her there. */
  function dockPanel() {
    const st = G.state, body = h('div');
    const draw = () => clear(body).append(h('div.paints.yard-paints', PAINTS.filter((pt) => st.paints[pt.id]).map((pt) => h('button.paint' + (st.paint === pt.id ? '.on' : ''), { onclick: () => { if (selectPaint(pt.id)) { playSfx('tab'); draw(); } } }, swatch(pt.id), h('span', pt.name)))));
    draw(); hooks.panel?.({ kicker: 'Shipyard', title: `In the dock: ${SHIP_BY_ID[st.ship]?.name}`, body: [h('p.sub-note', 'Whichever ship you fly comes into the dock. Try her paint jobs on here: the crews repaint her as you pick.'), body,
      h('button.btn.ghost.wide', { onclick: () => { hooks.closeOverlays?.(); show('ships'); } }, 'Change ship', uiIcon('chevron'))] });
  }
  /** Her blueprint: what she is and what she carries. */
  function yardBlueprint() {
    const s = SHIP_BY_ID[YARD_SHIP], st = G.state; playSfx('tab');
    hooks.panel?.({ kicker: 'Shipyard', title: `The ${s.name}`, body: [h('p.sub-note', s.desc),
      h('div.deck-board', [['Role', s.role], ['Weapon', WEAPONS[s.weapon].name], ['Ability', ABILITIES[s.ability].name], ['Hull', yardDone(st) ? 'In the hangar' : `Stage ${yardStage(st)}/${YARD_STAGES.length}`]].map(([k, v]) => h('div.db-row', h('small', k), h('b', v)))),
      h('ul.perks', s.perks.map((p) => h('li' + (p.startsWith('−') ? '.neg' : ''), p))),
      h('div.traits', h('div.trait', h('small', 'Trait'), h('b', s.passive.name), h('span', s.passive.desc)), h('div.trait', h('small', 'Signature · mastery 5'), h('b', s.signature.name), h('span', `${WEAPONS[s.weapon].name} at rank 7: ${s.signature.desc}.`)))] });
  }
  /** Tapping something in the Shipyard: the ship (or the console), her blueprint, the fleet board, the crews on the
   *  gantries, the bay doors, or a door. */
  let yardTalk = 0;
  function yardExhibit(kind) {
    const st = G.state;
    if (kind === 'exit') { show(outside); return; }
    if (kind === 'observatory') { show('observatory'); return; }
    if (kind === 'beacons') { show('beacons'); return; }
    if (kind === 'ops') { show('ops'); return; }
    if (kind === 'ship' || kind === 'console') { yardPanel(); return; }
    if (kind === 'blueprint') { yardBlueprint(); return; }
    playSfx('tab');
    if (kind === 'fleet') { hooks.panel?.({ kicker: 'Shipyard', title: 'The fleet', body: [bayGrid(st), h('button.btn.ghost.small.d3-more', { onclick: () => { hooks.closeOverlays?.(); show('ships'); } }, 'Choose which one flies', uiIcon('chevron'))] }); return; }
    if (kind === 'crews') { hooks.say?.(yardDone(st) ? 'The crews keep her flying now, {n}, and whatever else you bring into the dock.' : yardStage(st) ? YARD_LINES[yardTalk++ % YARD_LINES.length] : 'The crews are waiting on the keel, {n}. Fund the first stage at the console and they start.'); return; }
    if (kind === 'window') hooks.say?.(yardDone(st) ? 'The slipway is clear. Every ship we build from now on leaves by it.' : 'When she is done she leaves by that slipway. I have been practising the countdown.');
  }
  // ------------------------------------------------------------ the Beacon array
  const dayOf = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  /** What has answered the beacons: every Void boss, whether it has been met and beaten, and what it pays. */
  function beaconsPanel() {
    const st = G.state, beat = voidBeaten(st), met = st.seen?.bosses || {}, by = st.stats?.bossBy || {}; playSfx('tab');
    hooks.panel?.({ kicker: 'Beacon array', title: 'What has answered', body: [
      h('p.sub-note', 'The beacons are lit, and each Deep Void sector ends on a Void boss of its own instead of an old sector boss: these six, in turn, then round again, each time as strong as the depth.'),
      h('div.sg-defs', VOID_BOSSES.map((id, i) => { const b = BOSSES[id], s = beat[id] ? 2 : met[id] ? 1 : 0;
        return h('div.sg-def.s' + s, { style: s ? `--c:${hex(b.color)}` : null }, h('i.sg-dot'), h('div', h('b', s ? b.name : 'Unknown signal'), h('small', s ? VOID_LORE[id] : `It waits at the end of Deep Void ${i + 1}, past wave ${firstWaveOf(id) - 1}.`),
          h('em', s === 2 ? `Beaten ×${by[id] || 1} · first on ${dayOf(beat[id])}` : `Wave ${firstWaveOf(id)} · +${VOID_BOSS_BP} Blueprints the first time you beat it`))); })),
      h('p.sub-note', voidAllBeaten(st) ? 'All six beaten: the Lightkeeper paint is yours.' : 'Beat all six for the Lightkeeper paint.')] });
  }
  /** One Void boss: what it is, where it waits and how the hunt has gone. */
  function answerPanel(n) {
    const st = G.state, id = VOID_BOSSES[n - 1]; if (!id) return; const b = BOSSES[id], beat = voidBeaten(st), met = st.seen?.bosses?.[id], kills = st.stats?.bossBy?.[id] || 0; playSfx('tab');
    hooks.panel?.({ kicker: 'Beacon array', title: met ? b.name : 'Unknown signal', body: [h('p.sub-note', met ? VOID_LORE[id] : 'Something out in the Deep Void is on this frequency. It has not answered yet: fly deeper.'),
      met && b.tip ? h('p.boss-tip', h('b', 'How to beat it'), b.tip) : null,
      h('div.deck-board', [['Waits at', `Wave ${firstWaveOf(id)}, then every 60`], ['Beaten', kills ? `${kills}×` : '—'], ['First beaten', beat[id] ? dayOf(beat[id]) : '—'], ['First kill pays', `+${VOID_BOSS_BP} Blueprints`]].map(([k, v]) => h('div.db-row', h('small', k), h('b', v))))] });
  }
  /** Tapping something in the Beacon array: the great beacon, a Void boss's pedestal, the signal log, the window, or a door. */
  let beaconTalk = 0;
  function beaconExhibit(kind) {
    const st = G.state;
    if (kind === 'exit') { show(outside); return; }
    if (kind === 'yard') { show('yard'); return; }
    if (kind === 'log') { beaconsPanel(); return; }
    if (kind.startsWith('answer')) { answerPanel(+kind.slice(6)); return; }
    playSfx('tab');
    if (kind === 'beacon') { const met = VOID_BOSSES.filter((id) => st.seen?.bosses?.[id] && !voidBeaten(st)[id]); hooks.say?.(met.length ? `${BOSSES[met[0]].name} answered and is still out there, {n}. The beacon can hear it breathing.` : BEACON_LINES[beaconTalk++ % BEACON_LINES.length]); return; }
    if (kind === 'window') hooks.say?.(VOID_BOSSES.some((id) => voidBeaten(st)[id]) ? 'Every light out there is something that answered, {n}, and that you beat. We leave the beacons burning for the rest.' : 'Watch the dark past the beam, {n}. When something answers, you will see it.');
  }
  // ------------------------------------------------------------ Fleet Ops (data/fleet.js)
  const matOf = (d) => MAT_BY_ID[d.mat];
  function opsTitle() { const st = G.state, c = fleetCounts(st); return c.ready ? `${c.ready} home to unload` : c.out ? `${c.out} out · back in ${hrs(nextHome(st))}` : `${c.free} berth${c.free === 1 ? '' : 's'} free`; }
  const sendable = (st) => SHIPS.some((s) => !cannotSend(st, s.id));
  /** Pays for a damaged ship's repairs; then after() (or a re-render). */
  function fixShip(id, after) { const st = G.state, c = repairShip(st, id); if (!c) { playSfx('deny'); return; } playSfx('buy'); hooks.saveNow?.('fleet'); hooks.toast?.(`The ${SHIP_BY_ID[id].name} is repaired and ready to fly.`, 'good'); if (after) after(); else render(); }
  /** Repair: what it costs (salvage, and Alloy for heavy damage); greyed out until you have it. */
  function repairButton(id, after, small) {
    const st = G.state, c = repairCost(st, id); if (!c) return null;
    return h('button.btn.gold.fl-fix' + (small ? '.small' : ''), { disabled: !canRepair(st, id), onclick: () => fixShip(id, after) }, 'Repair', art('cur:salvage', 'cur-ico'), fmt(c.salvage), c.alloy ? h('span.fl-alloy', art('mat:alloy', 'cur-ico'), c.alloy) : null);
  }
  /** What a trip to a destination brings: its material, salvage (by what your sorties pay), and mastery. */
  function destGives(d, st) {
    const worth = Math.max(10, Math.round((sortieWorth(st) * d.worth) / 10) * 10);
    return h('div.fl-gives', matChip(d.mat, d.matN), h('span.fl-g', art('cur:salvage', 'mat-ico'), `~${fmt(worth)}`), h('span.fl-g', `+${d.mastery} mastery`), d.fragment ? h('span.fl-g.rare', 'Signal fragments') : null, h('span.fl-g.risk.r' + (d.risk < 0.12 ? 1 : d.risk < 0.24 ? 2 : 3), riskWord(d)));
  }
  /** The finds a trip might turn up, in a line. */
  const finds = (d, st) => { const f = mayFind(st, d, gardenOpen(st)); return f.length ? h('p.sub-note', `Maybe ${f.length > 1 ? f.slice(0, -1).join(', ') + ' or ' + f[f.length - 1] : f[0]} too.`) : null; };
  /** A destination: where, how long, what it brings (and a Send button, when sending); or what opens it. */
  function destRow(d, st, send) {
    const ok = destOpen(st, d);
    return h('div.fl-dest' + (ok ? '' : '.locked'), { style: `--c:${hex(matOf(d).color)}` },
      h('div.fl-dt', h('b', d.name), h('small', ok ? `${hrs(d.hours)} there and back` : d.deep ? 'Opens once you have been past wave 60' : `Opens once you have cleared sector ${d.n}`)),
      ok && send ? h('button.btn.primary.small.fl-go', { onclick: () => send(d) }, 'Send') : ok ? null : h('span.fl-lock', uiIcon('lock')), ok ? destGives(d, st) : null);
  }
  /** An empty berth: choose a ship (any you own but the one you fly) and where it goes. */
  function sendPanel(i) {
    const st = G.state, ships = SHIPS.filter((s) => st.unlocked.ships[s.id]), can = ships.filter((s) => !cannotSend(st, s.id)), kicker = `Fleet Ops · Berth ${i + 1}`; playSfx('tab');
    const hurt = ships.filter((s) => cannotSend(st, s.id) === 'damaged');
    if (!can.length && hurt.length) { hooks.panel?.({ kicker, title: 'Repairs first', body: [h('p.sub-note', 'The ships you could send came home damaged. Repair one and it can go out again.'), h('div.fl-fixes', hurt.map((s) => h('div.fl-fixrow', h('small', `${s.name} · ${DAMAGE[damageOf(st, s.id)].name}`), repairButton(s.id, () => sendPanel(i)))))] }); return; }
    if (!can.length) { hooks.panel?.({ kicker, title: 'No ship to send', body: [h('p.sub-note', ships.length < 2 ? 'Any ship you own but the one you fly can go out. Buy another in the Ships menu and it can scout while you fly.' : 'Every ship you own is out already, or flying with you. Send the next one when a ship comes home.'), h('button.btn.ghost.small.d3-more', { onclick: () => { hooks.closeOverlays?.(); show('ships'); } }, 'Ships', uiIcon('chevron'))] }); return; }
    let pick = can[0].id; const chips = new Map();
    const row = h('div.fl-ships', ships.map((s) => { const why = cannotSend(st, s.id);
      const fix = () => { const c = repairCost(st, s.id); if (!canRepair(st, s.id)) { playSfx('deny'); hooks.toast?.(`Repairs cost ${fmt(c.salvage)} salvage${c.alloy ? ` and ${c.alloy} Alloy` : ''}.`, 'info'); return; }
        hooks.confirm?.({ kicker, title: `Repair the ${s.name}?`, text: `${DAMAGE[damageOf(st, s.id)].name}: ${fmt(c.salvage)} salvage${c.alloy ? ` and ${c.alloy} Alloy for new plating` : ''}. Then she is ready to go out again.`, yes: 'Repair', no: 'Not now', danger: false, onYes: () => fixShip(s.id, () => sendPanel(i)), onNo: () => sendPanel(i) }); };
      const b = h('button.fl-ship' + (s.id === pick ? '.on' : '') + (why === 'damaged' ? '.hurt' : ''), { disabled: !!why && why !== 'damaged', style: `--c:${hex(s.trim)}`, onclick: () => { if (why === 'damaged') { fix(); return; } pick = s.id; for (const [id, el] of chips) setClass(el, 'on', id === pick); playSfx('tab', 0.5); } },
        art('ship:' + s.id, 'fl-art'), h('b', s.name), h('small', why === 'flying' ? 'You fly her' : why === 'away' ? 'Away' : why === 'refit' ? 'In for a refit' : why === 'damaged' ? 'Damaged · repair' : `Mastery ${st.mastery?.[s.id]?.level || 1}${(st.refits?.[s.id] || 0) >= 2 ? ' · tough' : ''}`));
      chips.set(s.id, b); return b; }));
    const go = (d) => { const o = sendShip(st, i, pick, d.id); if (!o) { playSfx('deny'); return; } playSfx('unlock'); hooks.saveNow?.('fleet'); hooks.closeOverlays?.(); render(); hooks.toast?.(`The ${SHIP_BY_ID[pick].name} is away to ${d.name}: back in ${hrs(d.hours)}.`, 'good'); };
    hooks.panel?.({ kicker, title: 'Send a ship out', body: [h('h4.oh-sub', 'Which ship'), row, h('h4.oh-sub', 'Where to'), h('div.fl-dests', DESTINATIONS.map((d) => destRow(d, st, go))),
      h('p.sub-note', 'It brings home that stretch\'s material, salvage and mastery, and now and then a Greenhouse seed, an Alien Core or a Blueprint. It keeps flying while the game is closed. The further out, the likelier she comes home damaged and needs repairs; a ship with a reinforced frame (her second refit) is tougher.')] });
  }
  /** A ship out: how far along, when it is back, what it should bring; it can be called home early, empty-handed. */
  function tripPanel(i) {
    const st = G.state, o = fleet(st).out[i], d = DEST_BY_ID[o.dest], s = SHIP_BY_ID[o.ship], k = tripDone(st, i) || 0; playSfx('tab');
    const recall = () => hooks.confirm?.({ kicker: 'Fleet Ops', title: `Call the ${s.name} home?`, text: 'She turns round now and is back in the hangar straight away, but brings nothing home with her.', yes: 'Call her home', no: 'Let her fly',
      onYes: () => { recallShip(st, i); hooks.saveNow?.('fleet'); render(); hooks.toast?.(`The ${s.name} is back in the hangar.`, 'info'); } });
    hooks.panel?.({ kicker: `Fleet Ops · Berth ${i + 1}`, title: `${s.name} · ${d.name}`, body: [
      h('div.fl-trip', { style: `--c:${hex(matOf(d).color)}` }, h('div.fl-when', h('small', k < 0.5 ? 'On her way out' : 'On her way home'), h('b', `Back in ${hrs(tripLeft(st, i))}`)), h('div.fl-bar', h('i', { style: `width:${(k * 100).toFixed(1)}%` }))),
      h('h4.oh-sub', 'What she should bring'), destGives(d, st), finds(d, st),
      h('button.btn.ghost.small.fl-recall', { onclick: () => { hooks.closeOverlays?.(); recall(); } }, 'Call her home early')] });
  }
  /** A ship home: unload it (the salvage, material and finds banked, its mastery), and say what it brought. */
  function unload(i) {
    const st = G.state, r = collectShip(st, i); if (!r) return; const d = DEST_BY_ID[r.dest], s = SHIP_BY_ID[r.ship], f = fleet(st);
    playSfx('unlock'); hooks.flash?.(hex(matOf(d).color)); hooks.saveNow?.('fleet'); render();
    const rows = [['Salvage', `+${fmt(r.got.salvage)}`], ...Object.entries(r.got.mats).map(([id, n]) => [MAT_BY_ID[id].name, `+${n}`]),
      r.mastery ? [`${s.name} mastery`, r.mastery.to > r.mastery.from ? `Level ${r.mastery.to}` : `+${r.mastery.gained}`] : null,
      r.got.damage ? ['Damage', DAMAGE[r.got.damage].name] : null, ...r.got.seeds.map((id) => ['Greenhouse seed', SEED_BY_ID[id]?.name || id]), r.got.cores ? ['Alien Cores', `+${r.got.cores}`] : null, r.got.bp ? ['Blueprints', `+${r.got.bp}`] : null, r.got.fragments ? ['Signal fragment', 'Unreadable, for now'] : null, r.got.canister ? ['Supply canister', BOOST_BY_ID[r.got.canister]?.name] : null].filter(Boolean);
    const fix = r.got.damage ? h('div.fl-fixrow.hurt', h('small', 'She can\'t fly or go out again until she is repaired: here, or on her card in Ships.'), repairButton(r.ship, () => { hooks.closeOverlays?.(); render(); })) : null;
    hooks.panel?.({ kicker: `Home from ${d.name}`, title: `The ${s.name} is back`, body: [h('p.sub-note', `She ${r.line}.`), h('div.deck-board', rows.map(([k, v]) => h('div.db-row', h('small', k), h('b', v)))), fix,
      r.paint ? h('p.fl-paint', `${f.home} expeditions home: the Pathfinder paint is yours. Find it in the Ships menu.`) : st.paints[FLEET_PAINT] ? null : h('p.sub-note', `${PATHFINDER_AT - f.home} more home for the Pathfinder paint.`)] });
    if (r.got.fragments && f.fragments === 1) setTimeout(() => hooks.say?.('That fragment is a signal, {n}, from further out than anything we know. I cannot read it. Not yet. Keep bringing them home.'), 600);
  }
  /** Every destination: what it brings and how long it takes, or what opens it. */
  function routesPanel() {
    const st = G.state; playSfx('tab');
    hooks.panel?.({ kicker: 'Fleet Ops', title: 'Routes', body: [h('p.sub-note', 'Everywhere the fleet can scout: a sector once you have cleared it, the Deep Void once you have been past wave 60. Tap an empty berth to send a ship.'), h('div.fl-dests', DESTINATIONS.map((d) => destRow(d, st)))] });
  }
  /** The ships home so far, what each brought, and the count to the Pathfinder. */
  function logPanel() {
    const st = G.state, f = fleet(st); playSfx('tab');
    const rows = f.log.map((e) => { const d = DEST_BY_ID[e.dest];
      return h('div.fl-log', h('div.fl-dt', h('b', `${SHIP_BY_ID[e.ship]?.name} · ${d?.name}`), h('small', `${dateLabel(e.at)} · she ${e.line}`)),
        h('div.fl-gives', Object.entries(e.got.mats || {}).map(([id, n]) => matChip(id, n)), h('span.fl-g', art('cur:salvage', 'mat-ico'), fmt(e.got.salvage)), e.got.seeds?.length ? h('span.fl-g.rare', 'Seed') : null,
          e.got.cores ? h('span.fl-g.rare', `${e.got.cores} Core${e.got.cores > 1 ? 's' : ''}`) : null, e.got.bp ? h('span.fl-g.rare', 'Blueprint') : null, e.got.fragments ? h('span.fl-g.rare', 'Signal') : null, e.got.canister ? h('span.fl-g', 'Canister') : null, e.got.damage ? h('span.fl-g.hurt', DAMAGE[e.got.damage].name) : null)); });
    hooks.panel?.({ kicker: 'Fleet Ops', title: 'Expedition log', body: [rows.length ? h('div.fl-logs', rows) : h('p.sub-note', 'No ships home yet. Send one out from a berth and its return is logged here.'),
      h('p.sub-note', st.paints[FLEET_PAINT] ? `${f.home} expeditions home. The Pathfinder paint is yours.` : `${f.home} of ${PATHFINDER_AT} expeditions home for the Pathfinder paint.`),
      f.fragments ? h('p.sub-note', `${f.fragments} signal fragment${f.fragments > 1 ? 's' : ''} from the Deep Void, waiting to be read.`) : null] });
  }
  /** Tapping something in Fleet Ops: a berth (send, see the trip, or unload), the ring map or the routes board, the log,
   *  the field, or a door. */
  let opsTalk = 0;
  function opsExhibit(kind) {
    const st = G.state;
    if (kind === 'exit') { show(outside); return; }
    if (kind === 'yard') { show('yard'); return; }
    if (kind === 'map' || kind === 'routes') { routesPanel(); return; }
    if (kind === 'log') { logPanel(); return; }
    if (kind.startsWith('berth')) { const i = +kind.slice(5) - 1, t = tripDone(st, i); if (t == null) sendPanel(i); else if (t >= 1) unload(i); else tripPanel(i); return; }
    playSfx('tab');
    if (kind === 'window') hooks.say?.(OPS_LINES[opsTalk++ % OPS_LINES.length]);
  }
  // ------------------------------------------------------------ the Greenhouse
  const hrs = (v) => (v >= 1 ? `${Math.floor(v)}h ${String(Math.floor((v % 1) * 60)).padStart(2, '0')}m` : `${Math.max(1, Math.ceil(v * 60))}m`);
  const seedDot = (s) => h('i.gd-dot', { style: `--c:${hex(s.color)}` });
  const growHours = (s, st) => s.hours / (wingOpen(st) ? WING_SPEED : 1);
  const boostLine = (s) => h('div.gd-boost', { style: `--c:${hex(s.color)}` }, h('small', 'In bloom, it goes with your next sortie'), h('b', s.boost));
  function gardenTitle() { const st = G.state, c = gardenCounts(st), n = seedCount(st); return c.bloom ? `${c.bloom} in bloom` : c.growing ? `${c.growing} growing` : `${n} seed${n === 1 ? '' : 's'} to plant`; }
  /** A bed: plant a seed from the drawer, see how its plant is coming on, or harvest the bloom into the basket. */
  function bedPanel(i) {
    const st = G.state, g = garden(st), p = g.beds[i], k = growth(st, i), where = i < 3 ? 'the old bay' : 'the second wing'; playSfx('tab');
    if (i >= bedsOpen(st)) { hooks.panel?.({ kicker: 'Greenhouse', title: `Bed ${i + 1} · ${where}`, body: [h('p.sub-note', `This bed is in the second wing, dark until the Solar wings are built (Overhaul rank ${WING_RANK}).`)] }); return; }
    if (!p) {
      const have = SEEDS.filter((s) => g.seeds[s.id] > 0);
      hooks.panel?.({ kicker: 'Greenhouse', title: `Bed ${i + 1} · empty`, body: [h('p.sub-note', have.length ? 'Pick a seed from the drawer to plant here. It grows while you are away.' : 'The drawer is empty. Bosses leave seeds when you beat them in a sortie: the deeper you go, the rarer the kind.'),
        have.length ? h('div.gd-list', have.map((s) => h('button.gd-seed', { style: `--c:${hex(s.color)}`, onclick: () => plantBed(i, s.id) }, seedDot(s), h('span', h('b', s.name), h('small', `${s.boost} · blooms in about ${Math.round(growHours(s, st))} hours`)), h('em', `×${g.seeds[s.id]}`)))) : null] });
      return;
    }
    const s = SEED_BY_ID[p.id];
    if (k >= 1) { hooks.panel?.({ kicker: 'Greenhouse', title: `${s.name} · in bloom`, body: [h('p.sub-note', s.lore), boostLine(s), h('button.btn.gold.wide.gd-go', { onclick: () => harvestBed(i) }, 'Harvest it into the basket')] }); return; }
    const now = k < 0.12 ? 'just planted' : k < 0.35 ? 'sprouting' : k < 0.6 ? 'in leaf' : 'in bud';
    hooks.panel?.({ kicker: 'Greenhouse', title: `${s.name} · ${now}`, body: [h('p.sub-note', s.lore), boostLine(s),
      h('div.gd-grow', h('div.meter.small', h('i', { style: `width:${(k * 100).toFixed(1)}%` })), h('small', `Blooms in about ${hrs(hoursLeft(st, i))}`)),
      wateredToday(st) ? h('p.sub-note', 'Watered today. Water the beds again tomorrow to bring it on.') : h('button.btn.ghost.wide.gd-go', { onclick: () => waterBeds() }, `Water the beds: everything growing comes on ${Math.round(WATER_BOOST * 100)}%`)] });
  }
  function plantBed(i, id) {
    if (!plant(G.state, i, id)) { playSfx('deny'); return; } const s = SEED_BY_ID[id];
    playSfx('buy'); hooks.saveNow?.('garden'); hooks.closeOverlays?.(); render(); hooks.toast?.(`${s.name} planted: it blooms in about ${Math.round(growHours(s, G.state))} hours.`, 'good');
  }
  function harvestBed(i) {
    const id = garden(G.state).beds[i]?.id, got = harvest(G.state, i); if (!got) { playSfx('deny'); return; } const s = SEED_BY_ID[got.id];
    playSfx('unlock'); hooks.saveNow?.('garden'); hooks.closeOverlays?.(); render(); G.renderer?.room?.burst?.(i, id);
    hooks.toast?.(`${s.name} is in the basket: your next sortie takes ${s.boost.charAt(0).toLowerCase() + s.boost.slice(1)}.`, 'good');
    if (got.paint) setTimeout(() => bus.emit('notice', { kind: 'unlock', kicker: 'Every kind grown', title: 'Verdant paint', sub: 'The herbarium is full, and the old tree has flowered', art: 'ach:trophy' }), 900);
  }
  function waterBeds() {
    const r = water(G.state);
    if (r === 'watered') { playSfx('buy'); hooks.saveNow?.('garden'); hooks.closeOverlays?.(); render(); G.renderer?.room?.watering?.(); hooks.toast?.(`Watered: everything still growing came on ${Math.round(WATER_BOOST * 100)}%.`, 'good'); return; }
    playSfx('deny'); hooks.toast?.(r === 'already' ? 'Already watered today. The beds are fine until tomorrow.' : 'Nothing is growing yet: plant a seed first.', 'info');
  }
  /** The seed drawer: every kind, how many are in it, where it is found and what its bloom does. */
  function seedsPanel() {
    const st = G.state, g = garden(st); playSfx('tab');
    hooks.panel?.({ kicker: 'Greenhouse', title: 'The seed drawer', body: [h('p.sub-note', 'Bosses leave seeds when you beat them in a sortie, and each sortie brings home the two deepest. Tap an empty bed to plant one.'),
      h('div.gd-list', SEEDS.map((s) => { const n = g.seeds[s.id] || 0; return h('div.gd-seed' + (n ? '' : '.dim'), { style: `--c:${hex(s.color)}` }, seedDot(s), h('span', h('b', s.name), h('small', `${s.boost} · ${seedWhere(s)}`)), h('em', n ? `×${n}` : '—')); }))] });
  }
  /** The basket: the blooms waiting for the next sortie, which takes one of each kind. */
  function basketPanel() {
    const st = G.state, b = garden(st).basket, ids = basketNext(st); playSfx('tab');
    hooks.panel?.({ kicker: 'Greenhouse', title: 'The basket', body: [h('p.sub-note', ids.length ? 'Your next sortie takes one of every kind in here, each a boost for that sortie. Any more wait for the one after.' : 'Nothing in the basket yet. Harvest a bloom and it waits here for your next sortie.'),
      ids.length ? h('div.gd-list', ids.map((id) => { const s = SEED_BY_ID[id]; return h('div.gd-seed', { style: `--c:${hex(s.color)}` }, seedDot(s), h('span', h('b', s.name), h('small', s.boost)), h('em', `×${b[id]}`)); })) : null] });
  }
  /** The herbarium: every kind grown so far, and the paint for growing them all. */
  function herbariumPanel() {
    const st = G.state, g = garden(st), n = SEEDS.filter((s) => g.grown[s.id]).length; playSfx('tab');
    hooks.panel?.({ kicker: 'Greenhouse', title: 'Herbarium', body: [h('p.sub-note', n >= SEEDS.length ? 'Every kind grown: the Verdant paint is yours, and the old tree has flowered.' : `${n} of ${SEEDS.length} kinds grown. Grow every kind once for the Verdant paint.`),
      h('div.gd-list', SEEDS.map((s) => h('div.gd-seed' + (g.grown[s.id] ? '' : '.dim'), { style: `--c:${hex(s.color)}` }, seedDot(s), h('span', h('b', s.name), h('small', `${s.boost} · ${seedWhere(s)}`)), h('em', g.grown[s.id] ? `×${g.grown[s.id]}` : '—'))))] });
  }
  /** Tapping something in the Greenhouse: a bed, the seed drawer, the basket, the tap, the herbarium, Sprig, the old tree,
   *  the shut door to the second wing, the view, or a door. */
  let sprigTalk = 0;
  function gardenExhibit(kind) {
    const st = G.state;
    if (kind === 'exit') { show(outside); return; }
    if (kind === 'deck') { show('deck'); return; }
    if (kind.startsWith('bed')) { bedPanel(+kind.slice(3)); return; }
    if (kind === 'seeds') { seedsPanel(); return; }
    if (kind === 'basket') { basketPanel(); return; }
    if (kind === 'herbarium') { herbariumPanel(); return; }
    if (kind === 'water') { waterBeds(); return; }
    if (kind === 'wing') { playSfx('deny'); hooks.toast?.(`The second wing has no power until the Solar wings are built (Overhaul rank ${WING_RANK}).`, 'info'); return; }
    playSfx('tab');
    if (kind === 'sprig') { hooks.say?.(SPRIG_LINES[sprigTalk++ % SPRIG_LINES.length]); return; }
    if (kind === 'tree') { hooks.say?.(SEEDS.every((s) => garden(st).grown[s.id]) ? TREE_LINES.flower : wingOpen(st) ? TREE_LINES.leaf : TREE_LINES.bare); return; }
    if (kind === 'window') hooks.say?.(wingOpen(st) ? 'The solar wings drink the sun all day, {n}, and the greenhouse drinks what they make.' : 'Before the Fall this arm grew food for the whole station. Give it power and it will again.');
  }
  /** The Greenhouse's basket on the Launch card: what the next sortie takes with it. */
  function basketRow() {
    const ids = basketNext(G.state); if (!ids.length) return null;
    return h('button.basket-row', { onclick: () => show('garden') }, uiIcon('garden'), h('span', h('small', 'From the Greenhouse, for this sortie'), h('b', ids.map((id) => SEED_BY_ID[id].boost).join(' · '))));
  }
  // ------------------------------------------------------------ counterattack
  let counterHard = false;
  // The first Counterattack launch opens the briefing; launching from it marks it seen.
  const launchCounter = (opts) => G.state.seen.counterIntro ? launch(opts) : hooks.counterIntro(() => { G.state.seen.counterIntro = true; launch(opts); });
  function counterPanel() {
    const st = G.state, c = st.counter;
    if (!c.unlocked) return h('section.panel.ca-panel.locked', h('div.ca-head', h('div', h('div.kicker', 'New mode'), h('h3', 'Counterattack')), uiIcon('lock')),
      h('p', `A vertical shooter where you fly free and take the fight to the invaders. Unlocks when you defeat the sector ${COUNTER_UNLOCK_SECTOR} boss.`));
    const power = powerRating(), stars = (tbl) => Object.values(tbl).reduce((a, b) => a + b, 0);
    const rows = STAGES.map((sg) => {
      const open = sg.n === 1 || (c.stars[sg.n - 1] || 0) > 0, hardOpen = (c.stars[sg.n] || 0) > 0, hard = counterHard && hardOpen, got = (hard ? c.hard : c.stars)[sg.n] || 0;
      const rec = sg.rec + (hard ? hardRec(sg.n) : 0), ok = power >= rec, cp = sg.checkpoint && c.checkpoints?.[sg.n + (hard ? 'h' : '')];
      return h('div.ca-stage' + (open ? '' : '.locked') + (hard ? '.hard' : ''),
        h('div.ca-num', h('small', 'Stage'), h('b', String(sg.n))),
        h('div.ca-main', h('b', sg.name), h('small', open ? `${sg.place} · ` + (c.best[sg.n] ? `best ${fmtInt(c.best[sg.n])}` : 'not yet flown') : `Clear stage ${sg.n - 1} to unlock`),
          h('div.ca-stars', [1, 2, 3].map((i) => h('i' + (i <= got ? '.on' : ''), '★')), open ? h('span.ca-rec' + (ok ? '.ok' : '.low'), `Power ${power}/${rec}`) : null)),
        open && cp ? h('button.btn.ghost.ca-cp', { onclick: () => launchCounter({ counter: sg.n, hard, checkpoint: true }), title: 'Resume from the checkpoint (clear star only)' }, h('small', 'Checkpoint'), h('b', 'Resume')) : null,
        open ? h('button.btn.' + (hard ? 'danger' : 'primary') + '.ca-go', { onclick: () => launchCounter({ counter: sg.n, hard }) }, uiIcon('launch')) : uiIcon('lock'));
    });
    const anyHard = STAGES.some((sg) => (c.stars[sg.n] || 0) > 0);
    return h('section.panel.ca-panel',
      h('div.ca-head', h('div', h('div.kicker', 'Counterattack', h('button.ca-how', { onclick: () => hooks.counterIntro(null) }, 'How it works')), h('h3', 'Take the fight to them')), h('div.ca-cores', art('relic:r_quantum', 'ca-core-ico'), h('b', String(c.cores)), h('small', 'cores'))),
      h('p', 'Fly free in every direction: drag to move, double-tap a side to dash. Each stage has its own set piece and ends on a boss of its own. Stars earn Alien Cores for Alien Tech in the Workshop.'),
      hallOpen(st) ? h('button.btn.ghost.wide.sg-room.hall-room', { onclick: () => show('hall') }, uiIcon('awards'), h('span', `Trophy Hall · ${caughtStages(st).length}/6 captured`), uiIcon('chevron')) : null,
      h('div.ca-meta', h('span', `★ ${stars(c.stars)}/18` + (anyHard ? ` · Hard ★ ${stars(c.hard)}/18` : '')), anyHard ? h('button.ca-toggle' + (counterHard ? '.on' : ''), { onclick: () => { counterHard = !counterHard; playSfx('tab'); render(); } }, counterHard ? 'Hard mode on' : 'Hard mode off') : null),
      h('div.ca-list', rows));
  }

  // ------------------------------------------------------------ station siege
  // A siege is fought from the gunner seat. The first one opens the briefing; launching from it marks it seen.
  function launchSiege(n) {
    const go = () => { G.state.seen.gunnerIntro = true; hooks.closeOverlays?.(); if (tab === 'gunner') { restartGunner(n); return; } gunTier = n; gunFrom = ROOMS[tab] ? tab : 'missions'; show('gunner'); };
    if (G.state.seen.gunnerIntro) go(); else hooks.siegeIntro(go);
  }
  function siegePanel() {
    const st = G.state, sg = st.siege || { stars: {}, best: {} };
    if (!st.counter.unlocked) return null;
    if (!siegeUnlocked(st)) return h('section.panel.ca-panel.sg-panel.locked', h('div.ca-head', h('div', h('div.kicker', 'New mode'), h('h3', 'Station Siege')), uiIcon('lock')),
      h('p', 'Clear Counterattack stage 1 and the invaders will strike back at your station.'));
    const sys = siegeSystems(st), stars = Object.values(sg.stars).reduce((a, b) => a + b, 0);
    return h('section.panel.ca-panel.sg-panel',
      h('div.ca-head', h('div', h('div.kicker', 'Station Siege', h('button.ca-how', { onclick: () => hooks.siegeIntro(null) }, 'How it works')), h('h3', 'Hold the station')),
        h('button.sg-sys', { onclick: () => defences(), title: 'The station\'s defences' }, h('b', `${sys.count}/${SIEGE_SYSTEMS.length}`), h('small', 'defences'))),
      h('p', 'Every Counterattack stage you clear brings a siege on your station. Man its guns: shoot down the fighters and torpedoes, and missile the armoured bombers, gunships and capital ships. Everything you have built arms the guns.'),
      damageNote(), gunsNote(st),
      h('button.btn.ghost.wide.sg-room', { onclick: () => show('control') }, uiIcon('control'), h('span', 'Enter Defence Control'), uiIcon('chevron')),
      h('div.ca-meta', h('span', `★ ${stars}/${SIEGE_TIERS.length * 3}`)), h('div.ca-list', siegeRows()));
  }
  /** The turret upgrades the guns carry for good (one for each tier held). */
  function gunsNote(st, label = 'Fitted to the guns') {
    const names = Object.keys(siegeGuns(st)).map((id) => TURRET_MOD[id]?.name).filter(Boolean);
    return names.length ? h('p.sg-guns', h('small', label), h('span', names.join(' · '))) : null;
  }
  /** A warning while a lost siege's damage is unrepaired, with the way to fix it. */
  function damageNote() {
    const d = siegeDamage(G.state); if (!d) return null;
    return h('div.sg-damage', h('div', h('b', 'Station damaged'), h('small', `${listNames(d.ids.map((id) => SYSTEM_BY_ID[id]?.name || id))} offline`)), h('button.btn.small.gold', { onclick: () => repairPanel() }, 'Repair'));
  }
  /** One row per siege tier: its name, its fight, best score and stars, and a launch button once it is open. */
  function siegeRows() {
    const st = G.state, sg = st.siege || { stars: {}, best: {} };
    return SIEGE_TIERS.map((t) => {
      const open = siegeOpen(st, t.n), got = sg.stars[t.n] || 0, held = !!sg.won?.[t.n];
      const note = !open ? `Clear Counterattack stage ${t.n} first` : `${tierSummary(t)} · ` + (held ? (sg.best[t.n] ? `best ${fmtInt(sg.best[t.n])}` : 'held') : `first hold fits ${TURRET_MOD[t.gun].name.toLowerCase()}`);
      return h('div.ca-stage' + (open ? '' : '.locked'), h('div.ca-num', h('small', 'Tier'), h('b', String(t.n))),
        h('div.ca-main', h('b', t.name), h('small', note), h('div.ca-stars', [1, 2, 3].map((i) => h('i' + (i <= got ? '.on' : ''), '★')))),
        open ? h('button.btn.primary.ca-go', { onclick: () => launchSiege(t.n), 'aria-label': 'Defend against ' + t.name }, uiIcon('launch')) : uiIcon('lock'));
    });
  }
  /** The station's systems in a siege, console by console: which are online (and maxed), what each does, how to get the rest. */
  function defences() {
    const st = G.state, { list, count } = siegeSystems(st), k = turretKit(st), pc = (v) => (v ? Math.round(v * 100) + '%' : '—'); playSfx('tab');
    const cut = 1 - 1 / (1 + k.armour), more = (v) => (v > 0.005 ? '+' + pc(v) : '—');
    const stats = [['Cannon rounds', more(k.dmg / 2.3 - 1)], ['Rate of fire', more(0.25 / k.fireEvery - 1)], ['Damage taken', cut ? '−' + pc(cut) : '—'], ['Shield each wave', pc(k.shieldMax)], ['Repairs each wave', pc(k.regen)], ['Systems online', `${count}/${list.length}`]];
    hooks.panel?.({ kicker: G.room === 'control' ? 'Defence Control' : 'Station Siege', title: 'Station defences', body: [
      damageNote(),
      h('p.sub-note', 'Every module you build arms the guns in a siege; a maxed module arms them better. Alien Tech fits alien hardware with systems of its own.'),
      h('div.deck-board', stats.map(([a, v]) => h('div.db-row', h('small', a), h('b', v)))), gunsNote(st, 'Fitted to the guns for good'),
      ...SIEGE_CONSOLES.flatMap((cn) => { const rows = list.filter((x) => cn.ids.includes(x.sys.id));
        return [h('h4.sg-group', { style: `--c:${cn.color}` }, h('span', cn.name), h('small', `${rows.filter((r) => r.state).length}/${rows.length} online`)), defList(rows)]; })] });
  }
  /** Systems as a list: a status light, what each does, and where it comes from (or how to bring it online). */
  const defList = (rows) => h('div.sg-defs', rows.map(({ sys, state, value, damaged }) => { const part = systemPart(sys.id);
    return h('div.sg-def.s' + state + (damaged ? '.dmg' : ''), h('i.sg-dot'), h('div', h('b', sys.name), h('small', sys.desc(value)),
      h('em', damaged ? `${part.name} · knocked out in a siege · repair it in Defence Control` : state === 2 ? `${part.name} · ${sys.alien ? 'fitted' : 'maxed'}` : state ? `${part.name} · online · max ${sourceName(sys.id)} for more` : `${systemSource(sys.id)} to bring it online`))); }));
  /** Repairing the station after a lost siege: pay now, or let the crews patch it while you fly. */
  function repairPanel() {
    const st = G.state, d = siegeDamage(st); if (!d) return; playSfx('tab');
    const can = st.salvage >= d.cost;
    hooks.panel?.({ kicker: 'Defence Control', title: 'Repair the station', body: [
      h('p.sub-note', 'The last siege knocked these systems offline. The guns go into a siege without them until they are repaired.'),
      defList(siegeSystems(st).list.filter((x) => x.damaged)),
      h('button.btn.gold.wide.sg-repair', { disabled: !can, onclick: () => { if (!repairStation()) return; playSfx('buy'); hooks.closeOverlays?.(); hooks.toast?.('Repairs done: every system back online.', 'good'); hooks.saveNow?.('repair'); render(); } }, `Repair now · ${fmtInt(d.cost)} salvage`),
      can ? null : h('p.sub-note', `You need ${fmtInt(d.cost - st.salvage)} more salvage for that.`),
      h('p.sub-note', 'Or fly a sortie of a minute or more: the crews patch everything for free while you are out.')] });
  }

  // ------------------------------------------------------------ contracts
  function contractsView() {
    const done = CONTRACTS.filter((c) => G.state.contracts[c.id]).length, p = G.state.pilot;
    const track = h('div.track');
    for (let r = Math.max(2, p.rank - 1); r <= Math.min(MAX_RANK, p.rank + 6); r++) {
      const got = r <= p.rank, rw = rankReward(r);
      track.append(h('div.track-step' + (got ? '.got' : '') + (r === p.rank + 1 ? '.next' : '') + (rw.paint ? '.is-paint' : ''),
        h('small', 'Rank ' + r), rw.paint ? swatch(rw.paint) : art('cur:salvage', 'track-ico'), h('b', rw.paint ? PAINTS.find((x) => x.id === rw.paint).name : fmtInt(rw.salvage)), got ? uiIcon('check') : null));
    }
    const need = p.rank >= MAX_RANK ? 0 : rankNeed(p.rank);
    return h('div.screen', h('div.screen-head', h('h2', 'Career'), h('p', 'Every sortie earns pilot XP. Ranks pay salvage and unlock paint jobs.')),
      h('section.panel.career', h('div.career-top', insignia(p.rank, 'rank-ins big'), h('div', h('h3', rankTitle(p.rank)), h('p', need ? `${fmtInt(p.xp)} / ${fmtInt(need)} pilot XP` : 'Maximum rank reached'))),
        h('div.meter.rank', h('i', { style: `width:${(pilotProgress() * 100).toFixed(1)}%` })), track),
      h('h3', `Contracts · ${done}/${CONTRACTS.length}`), h('div.rows', CONTRACTS.map((c) => contractLine(c, false))));
  }

  // ------------------------------------------------------------ records: high scores and personal bests
  let recTab = 'mine', boardTab = 'today'; // Records' two halves (yours, and the global boards) and the board looked at
  const boardFail = {}; // board id → when it last could not be reached (not asked again for half a minute)
  /** Records' switch between the pilot's own records and the global boards. */
  const recSeg = () => h('div.gl-seg', { role: 'tablist' }, [['mine', 'Yours'], ['global', 'Global']].map(([id, name]) =>
    h('button' + (recTab === id ? '.on' : ''), { role: 'tab', 'aria-selected': String(recTab === id), onclick: () => { if (recTab === id) return; recTab = id; playSfx('tab'); render(true); } }, name)));
  /** From the Deck TV's Boards channel: the boards in full, on the board the TV was showing. */
  function openBoards(t) { recTab = 'global'; if (t) boardTab = t; show('records'); }
  /** The global boards (progression/global.js): today's and yesterday's Daily Sortie, and every pilot's best. A board
   *  is fetched when it is old; meanwhile (or if it cannot be reached) the last fetch shows, or a note. */
  function globalView() {
    const st = G.state, g = gl(st), id = boardOf(boardTab), c = cachedBoard(id), def = BOARD_TABS.find((b) => b.id === boardTab), on = posting(st);
    if (!boardFresh(id) && !(Date.now() - (boardFail[id] || 0) < 30e3)) fetchBoard(id).then(() => { delete boardFail[id]; }, () => { boardFail[id] = Date.now(); }).finally(() => { if (tab === 'records' && recTab === 'global') render(); });
    const name = boardName(st) + (g.tag ? ' #' + g.tag : '');
    const intro = h('section.panel.gl-intro' + (on ? '' : '.off'), art('ach:trophy', 'gl-ico'), h('div',
      on ? [h('b', `You post as ${name}`), h('small', `Your Daily Sortie and any new best go up after each sortie.${g.tag ? ` Your tag shows beside your name when another pilot has the same one.` : ''} ${st.pilot.name ? 'Change your callsign' : 'Add a callsign'} in Settings.`)]
        : [h('b', 'Your scores stay on this device'), h('small', boardsOn(st) ? 'You join the boards once Records is open.' : 'Global boards are off in Settings. You can still look.')]));
    const chips = h('div.gl-boards', BOARD_TABS.map((b) => h('button.gl-chip' + (b.id === boardTab ? '.on' : ''), { onclick: () => { if (boardTab === b.id) return; boardTab = b.id; playSfx('tab'); render(); } }, b.name)));
    const daily = boardTab !== 'all' ? dailyFor(id.slice(6)) : null;
    const row = (r, you) => h('li.lead.gl-row' + (r.n === 1 ? '.first' : '') + (r.me ? '.me' : ''),
      h('span.lead-n', String(r.n)),
      h('div.lead-main', h('b', (you ? 'You · ' : '') + r.name, r.tag ? h('span.gl-tag', '#' + r.tag) : null), h('small', [`Wave ${r.wave}`, SHIP_BY_ID[r.ship]?.name, r.station].filter(Boolean).join(' · '))),
      h('div.lead-tags', h('b.gl-score', fmtInt(r.score)), r.threat ? h('span.tag.tag-threat', 'Threat ' + roman(r.threat)) : null, r.warp > 1 ? h('span.tag.tag-warp', 'Warp S' + r.warp) : null));
    let list;
    if (!c) list = h('div.lock-note', uiIcon('records'), h('span', boardFail[id] ? 'The boards are out of reach right now. Your scores are safe on this device and go up when they can.' : 'Reaching the boards…'));
    else if (!c.data.top.length) list = h('div.lock-note', uiIcon('records'), h('span', def.empty));
    else { const d = c.data; list = h('div', h('ol.leader.gl-list', d.top.map((r) => row(r)), d.me && d.me.n > d.top.length ? [h('li.gl-gap', '···'), row(d.me, true)] : null),
      h('p.gl-foot', `${fmtInt(d.total)} pilot${d.total === 1 ? '' : 's'} on this board` + (boardFail[id] ? ' · the boards are out of reach, so this is the last look' : ''))); }
    const wait = on && g.pending.length ? h('p.gl-wait', `${g.pending.length === 1 ? 'A score is' : g.pending.length + ' scores are'} waiting to go up`) : null;
    return h('div.screen', h('div.screen-head', h('h2', 'Records'), h('p', 'Pilots everywhere. The Daily is the same sortie for every one of them.')), recSeg(), intro, chips,
      daily ? h('p.gl-day', `${boardTab === 'yday' ? 'Yesterday' : 'Today'}: ${daily.mutator.name} · ${daily.mutator.desc}`) : null, wait, list);
  }
  /** Posts still waiting (made offline, or when the boards were busy) are tried again every couple of minutes. */
  let glAt = 0;
  function globalTick() { const now = performance.now(); if (now < glAt) return; glAt = now + RETRY_MS; const g = gl(G.state); if (g.pending.length || g.forget) flush(G.state); }
  addEventListener('online', () => { glAt = 0; });
  bus.on('globalPosted', () => { if (tab === 'records' && recTab === 'global') render(); });
  function recordsView() {
    if (recTab === 'global') return globalView();
    const st = G.state, s = st.stats, rec = st.records, d = st.daily;
    const hero = h('section.panel.rec-hero',
      h('div.rec-main', art('ach:trophy', 'rec-ico'), h('div', h('div.kicker', 'High score'), h('b.rec-score', s.bestScore ? fmtInt(s.bestScore) : '—'), h('small', s.bestScore ? 'Beat it on your next sortie' : 'Fly a sortie to set your first score'))),
      h('div.rec-how', 'Score comes from kills and cleared waves, both worth more the deeper you go. Flawless waves pay half again, and each Threat level adds 25%.'));
    const bests = h('div.stat-grid.bests',
      stat('Furthest wave', s.bestWave || '—'), stat('Most kills', s.bestKills ? fmtInt(s.bestKills) : '—'), stat('Highest level', s.maxLevel > 1 ? s.maxLevel : '—'),
      stat('Most salvage', s.bestSalvage ? fmtInt(s.bestSalvage) : '—'), stat('Longest sortie', s.longestRun ? fmtTime(s.longestRun) : '—'), stat('Top threat', s.threatClear ? roman(s.threatClear) : '—'),
      stat('Best daily', d.best ? 'Wave ' + d.best : '—'), stat('Best streak', s.bestStreak ? s.bestStreak + ' days' : '—'), stat('Sectors cleared', s.sectorsCleared || 0));
    const top = rec.top.length ? h('ol.leader', rec.top.map((r, i) => h('li.lead' + (i === 0 ? '.first' : ''),
      h('span.lead-n', String(i + 1)),
      h('div.lead-main', h('b', fmtInt(r.score)), h('small', `Wave ${r.wave} · ${SHIP_BY_ID[r.ship]?.name || ''} · LV ${r.level} · ${fmtInt(r.kills)} kills`)),
      h('div.lead-tags', r.daily ? h('span.tag.tag-daily', 'Daily') : null, r.warp > 1 ? h('span.tag.tag-warp', 'Warp S' + r.warp) : null, r.threat ? h('span.tag.tag-threat', 'Threat ' + roman(r.threat)) : null, h('small', dateLabel(r.date))))))
      : h('div.lock-note', uiIcon('records'), h('span', 'Your ten best sorties by score will be listed here.'));
    const ships = h('div.rows', SHIPS.map((sh) => { const b = rec.ships[sh.id], owned = !!st.unlocked.ships[sh.id];
      return h('div.ship-best' + (owned ? '' : '.locked'), { style: `--c:${hex(sh.trim)}` }, art('ship:' + sh.id, 'row-icon'), h('div.row-main', h('b', sh.name), h('small', b ? `Best wave ${b.wave} · Mastery ${masteryOf(sh.id).level}` : owned ? 'No scored sortie yet' : 'Not owned yet')), h('b.sb-score', b ? fmtInt(b.score) : '—')); }));
    const life = h('div.stat-grid.bests', stat('Sorties', fmtInt(s.sorties)), stat('Invaders', fmt(s.kills)), stat('Bosses', fmtInt(s.bossKills)),
      stat('Waves cleared', fmtInt(s.wavesCleared || 0)), stat('Salvage earned', fmt(s.totalSalvage || 0)), stat('Play time', fmtTime(Math.round(st.meta.playTime || 0))));
    return h('div.screen', h('div.screen-head', h('h2', 'Records'), h('p', 'Your personal bests. Every sortie is a shot at a new one.')), recSeg(),
      hero, bannerHint('score'), h('h3', 'Personal bests'), bests, h('h3', 'Top sorties'), top, h('h3', 'Ship bests'), ships, h('h3', 'Lifetime'), life);
  }
  const dateLabel = (t) => { const d = new Date(t), now = new Date(); return d.toDateString() === now.toDateString() ? 'Today' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };

  // ------------------------------------------------------------ the rooms aboard: the Command Deck and Defence Control
  function roomView(id) {
    // The room itself is 3D (rendering/deck.js and control.js, drawn while G.room is set); this is the touch layer over it.
    const p = G.state.pilot, hint = h('div.d3-hint', 'Drag to look around · Tap the floor to walk · Tap anything to inspect');
    const el = h('div.deck3d' + (id === 'control' ? '.control' : id === 'hall' ? '.hall' : id === 'comms' ? '.comms' : id === 'quarters' ? '.quarters' : id === 'observatory' ? '.observatory' : id === 'yard' ? '.yard' : id === 'beacons' ? '.beacons' : id === 'garden' ? '.garden' : id === 'ops' ? '.ops' : ''), { 'aria-label': `${ROOMS[id]}. Drag to look around, tap the floor to walk, tap an exhibit to inspect it.` },
      h('div.d3-top', h('div.d3-title', h('small', ROOMS[id]), h('b', id === 'deck' || id === 'quarters' ? p.name || rankTitle(p.rank) : id === 'hall' ? `${caughtStages(G.state).length}/6 captured` : id === 'comms' ? `${(G.state.bounties?.list || []).filter((b) => b.done).length}/3 bounties done` : id === 'observatory' ? `${VOID_MARKS.filter((m) => isCharted(G.state, m)).length}/${VOID_MARKS.length} charted` : id === 'yard' ? (yardDone(G.state) ? (refitProgress(G.state) && !refitProgress(G.state).out ? `Refit: ${SHIP_BY_ID[refitProgress(G.state).ship]?.name} · ${mins(refitProgress(G.state).mins)}` : `In dock: ${SHIP_BY_ID[G.state.ship]?.name}`) : `Chimera · ${yardStage(G.state)}/${YARD_STAGES.length} built`) : id === 'beacons' ? `${VOID_BOSSES.filter((b) => voidBeaten(G.state)[b]).length}/${VOID_BOSSES.length} beaten` : id === 'garden' ? gardenTitle() : id === 'ops' ? opsTitle() : G.state.stationName || 'Station defence')), h('button.btn.ghost.small.d3-exit', { onclick: () => show(outside) }, uiIcon('back'), 'Exit')), hint);
    let down = null;
    if (watch && id === 'deck') { el.append(watch.el); el.classList.add('watching'); }
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('button, input') || watch) return; down = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false }; try { el.setPointerCapture(e.pointerId); } catch { /* not every pointer can be captured */ } });
    el.addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== down.id) return;
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly; // a jump this big in one event is a glitch, not a drag
      if (down.moved && Math.abs(dx) + Math.abs(dy) < 120) G.renderer?.room?.look(dx, dy); down.lx = e.clientX; down.ly = e.clientY;
    });
    const up = (e) => {
      if (!down || e.pointerId !== down.id) return; const tap = !down.moved && performance.now() - down.t < 450; down = null; hint.classList.add('off');
      if (!tap) return; const r = G.renderer.canvas.getBoundingClientRect(), res = G.renderer.room?.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (res?.exhibit === 'bolt') boltTap(); else if (res?.exhibit) ({ control: controlExhibit, hall: hallExhibit, comms: commsExhibit, quarters: quartersExhibit, observatory: observatoryExhibit, yard: yardExhibit, beacons: beaconExhibit, garden: gardenExhibit, ops: opsExhibit }[id] || exhibit)(res.exhibit); else if (res?.walk) playSfx('tab', 0.4);
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', () => { down = null; });
    return el;
  }
  /** Tapping something in Defence Control: a console's systems, the tactical table's totals (and repairs), the threat
   *  board (where a siege is launched), the view outside, ORBIT's advice, or a door. */
  let orbitTalk = 0;
  function controlExhibit(kind) {
    const st = G.state;
    if (kind === 'exit') { show(outside); return; }
    if (kind === 'deck') { show('deck'); return; }
    if (kind === 'yard') { show('yard'); return; }
    playSfx('tab');
    if (kind === 'orbit') { hooks.say?.(siegeAdvice(st, orbitTalk++)); return; }
    if (kind === 'table') { defences(); return; }
    const panel = (title, ...body) => hooks.panel?.({ kicker: 'Defence Control', title, body });
    if (CONSOLE_BY_ID[kind]) {
      const cn = CONSOLE_BY_ID[kind], rows = siegeSystems(st).list.filter((x) => cn.ids.includes(x.sys.id));
      panel(`${cn.name} · ${rows.filter((r) => r.state).length}/${rows.length} online`, h('p.sub-note', CONSOLE_NOTE[kind]), rows.some((r) => r.damaged) ? damageNote() : null, defList(rows));
    } else if (kind === 'board') {
      const sg = st.siege || {}, stars = Object.values(sg.stars || {}).reduce((a, b) => a + b, 0), next = nextSiege(st);
      panel('Threat board', h('div.deck-board', [['Sieges held', fmtInt(sg.wins || 0)], ['Invaders downed', fmtInt(sg.kills || 0)], ['Stars', `${stars}/${SIEGE_TIERS.length * 3}`], ['Highest tier held', SIEGE_TIERS.filter((t) => sg.won?.[t.n]).at(-1)?.n || '—'], ['Massing now', next ? next.name : 'None']].map(([k, v]) => h('div.db-row', h('small', k), h('b', String(v))))),
        damageNote(), h('div.ca-list.sg-ops', siegeRows()));
    } else if (kind === 'window') {
      const next = nextSiege(st), locked = lockedSiege(st), guns = siegeSystems(st).list.filter((x) => ['w_dmg', 'w_rate', 'w_crit'].includes(x.sys.id)), held = SIEGE_TIERS.some((t) => st.siege?.won?.[t.n]);
      panel(next ? `${next.name} is massing` : 'All quiet',
        h('p.sub-note', next ? `Those red lights are the ${next.name} fleet, gathering: ${tierPhrase(next)}. Man the guns and meet them.` : locked ? `Nothing out there yet. Clear Counterattack stage ${locked.n} and they will answer with ${locked.name}.` : 'Every siege has been held. Nothing out there but stars.'),
        damageNote(),
        h('h4.sg-group', { style: '--c:#ff8a5e' }, h('span', 'The guns on the hull'), h('small', `${guns.filter((g) => g.state).length}/3 online`)), defList(guns),
        next ? h('button.btn.gold.wide.sg-defend', { onclick: () => launchSiege(next.n) }, uiIcon('launch'), `Defend against ${next.name}`) : null,
        held ? h('button.btn.ghost.wide.sg-defend', { onclick: () => controlExhibit('board') }, 'Fly a siege again') : null);
    }
  }
  /** Tapping something in the Trophy Hall: a cradle (the boss in it, its record, the way to fly its stage), the hunting
   *  record, the window, or a door. */
  function hallExhibit(kind) {
    const st = G.state;
    if (kind === 'exit') { show(outside); return; }
    if (kind === 'deck') { show('deck'); return; }
    if (kind === 'comms') { show('comms'); return; }
    if (kind === 'quarters') { show('quarters'); return; }
    playSfx('tab');
    if (kind === 'window') { hooks.say?.('The ring turns once every seven and a half minutes, {n}. Out there: our hub, and everything we have towed home.'); return; }
    const panel = (title, ...body) => hooks.panel?.({ kicker: 'Trophy Hall', title, body });
    if (kind.startsWith('cradle')) {
      const n = +kind.slice(6), sg = STAGES[n - 1], b = BOSSES[sg.boss] || {}, c = st.counter, won = trophyWon(st, n), s = c.stars?.[n] || 0, hd = c.hard?.[n] || 0, open = c.unlocked && (n === 1 || (c.stars?.[n - 1] || 0) > 0);
      const say = STATION_TROPHIES[n - 1]?.say?.replace(/\{n\}/g, st.pilot.name || 'pilot');
      panel(won ? b.name : `${b.name} · at large`,
        h('p.sub-note', won ? `${b.title}. Captured in Counterattack stage ${n}, ${sg.name}, over ${sg.place}, and towed home to the station's tractor field.` : `Still out there. Clear Counterattack stage ${n}, ${sg.name}, to capture it and tow it home.`),
        h('div.deck-board', [['Stars', `${s}/3`], ['Hard stars', `${hd}/3`], ['Best score', c.best?.[n] ? fmtInt(c.best[n]) : '—'], ['Status', won ? 'Captured' : 'At large']].map(([k, v]) => h('div.db-row', h('small', k), h('b', v)))),
        won && say ? h('p.sg-orbit', h('b', 'ORBIT'), h('span', say)) : null,
        open ? h('button.btn.primary.wide.hall-fly', { onclick: () => { hooks.closeOverlays?.(); launchCounter({ counter: n }); } }, uiIcon('launch'), won ? `Fly ${sg.name} again` : `Fly ${sg.name}`) : h('p.sub-note', c.unlocked ? `Clear stage ${n - 1} first.` : 'The Counterattack opens when you defeat the sector 3 boss.'),
        open && s > 0 ? h('button.btn.danger.wide.hall-fly', { onclick: () => { hooks.closeOverlays?.(); launchCounter({ counter: n, hard: true }); } }, uiIcon('launch'), `${sg.name} · Hard`) : null);
    } else if (kind === 'hunt') {
      const s = st.stats, by = s.bossBy || {};
      const rows = HUNTED.map((hb) => { const b = BOSSES[hb.id] || {}, met = !!st.seen.bosses?.[hb.id], beaten = (s.sectorsCleared || 0) >= hb.sector, kills = by[hb.id] || 0, lost = st.intel?.[hb.id] || 0;
        return h('div.sg-def.hunt' + (beaten ? '.s2' : met ? '.s1' : '.s0'), h('i.sg-dot'), h('div', h('b', met ? b.name : 'Unknown'), h('small', `Sector ${hb.sector} boss · ${hb.place}`),
          h('em', !met ? 'Not yet faced' : (beaten ? (kills ? `Defeated ${kills}×` : 'Defeated') : 'Faced, not yet beaten') + (lost ? ` · beat you ${lost}×, and you know its moves better for it` : '')))); });
      panel('Hunting record', h('div.deck-board', [['Bosses downed', fmtInt(s.bossKills || 0)], ['Sector bosses', fmtInt(s.sectorBosses || 0)], ['Captured', `${caughtStages(st).length}/6`], ['Hard captures', `${STAGES.filter((x) => (st.counter.hard?.[x.n] || 0) > 0).length}/6`]].map(([k, v]) => h('div.db-row', h('small', k), h('b', v)))),
        h('p.sub-note', 'Every sector boss of the main game, and how your hunts have gone. A boss that beats you teaches you its moves: you hit it harder next time.'), h('div.sg-defs', rows));
    }
  }
  const CONSOLE_NOTE = {
    weapons: 'What arms the guns: harder rounds, a faster cycler, point defence against torpedoes, and sentry guns on the hull.',
    hull: 'Everything between the invaders and the hull: shields, armour, repairs, bunkers, and a beacon for when all else fails.',
    ops: 'Slowing their torpedoes, supplying and briefing the gun crews, and making every siege pay.',
    alien: 'Hardware fitted with Alien Tech. It fights in every siege from the moment it is fitted.',
  };
  // ------------------------------------------------------------ the gunner seat: the Station Siege
  // The 3D fight is rendering/gunner.js (drawn while G.room is 'gunner'); this is its HUD and the drag that aims. When the
  // fight ends, the result is filed (progression/siege.js) and the debrief shows what it earned or cost.
  let gun = null;
  function gunnerView() {
    const $g = {}, t = TIER_BY_N[gunTier] || TIER_BY_N[1];
    const el = h('div.deck3d.gunner', { 'aria-label': `Station Siege, ${t.name}. Drag to aim; the guns fire when a target is in your sights.` },
      h('div.d3-top', h('div.d3-title', h('small', `Station Siege · Tier ${t.n} · ${t.name}`), $g.wave = h('b')), h('button.btn.ghost.small.d3-exit', { onclick: () => leaveGuns() }, uiIcon('back'), 'Exit')),
      h('div.gn-hud', h('small', 'Station'), h('i.gn-hull', $g.hull = h('i'), $g.shield = h('em')), $g.pct = h('b'), $g.score = h('span')),
      $g.hint = h('div.d3-hint', 'Drag to aim · cannons fire on their own · hold the sights on a ◆ target to lock a missile'),
      $g.msl = h('button.gn-msl', { onclick: () => G.renderer?.room?.fireMissile?.(), 'aria-label': 'Fire missile' }, h('small', 'Missile'), $g.mslState = h('b'), $g.ammo = h('span.gn-ammo'), h('i.gn-reload', $g.reload = h('i'))),
      $g.pick = h('div.gn-pick'));
    let down = null;
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('button, .gn-pick')) return; down = { id: e.pointerId, lx: e.clientX, ly: e.clientY }; try { el.setPointerCapture(e.pointerId); } catch { /* not every pointer can be captured */ } $g.hint.classList.add('off'); });
    el.addEventListener('pointermove', (e) => { if (!down || e.pointerId !== down.id) return; const dx = e.clientX - down.lx, dy = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY; if (Math.abs(dx) + Math.abs(dy) < 160) G.renderer?.room?.look?.(dx * 1.15, dy * 1.15); });
    const up = () => { down = null; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    gun = { el, $g, sig: '', msig: '', psig: '' }; return el;
  }
  /** A fresh siege in the seat (from the debrief: again, or the next tier). */
  function restartGunner(n) { gunTier = n; G.renderer?.room?.start?.(n); render(); }
  /** Leave the seat. Mid-fight that abandons the siege, which counts as lost: ask first. */
  function leaveGuns() {
    const g = G.renderer?.room, st = g?.status?.();
    if (!st || st.over || !st.started) { show(gunFrom); return; }
    hooks.confirm?.({ kicker: 'Station Siege', title: 'Abandon the siege?', text: 'Leaving the guns now loses the siege: the invaders get through, and some of the station\'s systems go offline until they are repaired.', yes: 'Abandon', no: 'Keep fighting', onYes: () => g.abandon() });
  }
  /** The siege is over: file it (once), save, and after a moment to watch it end, the debrief. */
  function fileSiege(g, st) {
    g.filed = true; const r = settleSiege({ tier: st.tier, won: st.won, hull: st.hull, kills: st.kills, score: st.score, cargo: st.cargo }); r.abandoned = st.abandoned; hooks.saveNow?.('siege');
    const next = TIER_BY_N[r.tier + 1], acts = {
      again: () => restartGunner(r.tier), control: () => show('control'), repair: () => { show('control'); repairPanel(); },
      next: r.won && next && siegeOpen(G.state, next.n) ? () => restartGunner(next.n) : null };
    setTimeout(() => { if (G.room === 'gunner' && G.renderer?.room?.engagement === st.engagement) hooks.siegeDebrief?.(r, acts); }, st.abandoned ? 300 : 1800);
  }
  function gunnerTick() {
    if (!gun || G.room !== 'gunner') return; const g = G.renderer?.room; if (!g?.status) return; g.paused = !!hooks.blocking?.(); const st = g.status(), { $g } = gun;
    if (st.over && !g.filed) fileSiege(g, st);
    // the missile button: ammo, reload, and what the seeker is doing
    const msig = [st.ammo, st.missiles, Math.round(st.reload * 20), st.seeking, st.locked].join();
    if (msig !== gun.msig) { gun.msig = msig; setText($g.mslState, st.locked ? 'Locked · fire' : st.seeking ? 'Locking…' : st.ammo ? 'Ready' : 'Reloading rack');
      setClass($g.msl, 'locked', st.locked); setClass($g.msl, 'seeking', st.seeking); setClass($g.msl, 'empty', !st.ammo); clear($g.ammo).append(...Array.from({ length: st.missiles }, (_, i) => h('i' + (i < st.ammo ? '.on' : ''))));
      $g.reload.style.width = Math.round(st.reload * 100) + '%'; }
    // an upgrade to choose between waves
    const psig = st.pick ? st.pick.ids.join() + '|' + st.rerolls : '';
    if (psig !== gun.psig) { gun.psig = psig; clear($g.pick); setClass($g.pick, 'on', !!st.pick);
      if (st.pick) { const choose = (i) => { const m = g.choosePick(i); if (m) gun.psig = null; };
        $g.pick.append(h('div.gn-pick-head', h('small', 'Wave held'), h('b', 'Upgrade the guns')),
          h('div.cards', st.pick.ids.map((id, i) => { const m = TURRET_MOD[id], rar = TURRET_RARITY[m.rarity], have = st.picks[id] || 0;
            return h('button.card.' + m.rarity, { style: `--c:${rar.color};--r:${rar.color};--d:${i * 70}ms`, onclick: () => choose(i) }, h('div.card-art', art(m.art, 'card-icon')),
              h('div.card-main', h('div.card-kicker', h('span', m.kind), h('span.rar', rar.name + (m.max > 1 ? ` · ${have}/${m.max}` : ''))), h('div.card-title', m.name), h('div.card-body', m.desc)), h('span.card-key', String(i + 1))); })),
          st.rerolls > 0 ? h('button.btn.ghost.reroll', { onclick: () => { g.reroll(); } }, uiIcon('reroll'), `Reroll (${st.rerolls})`) : null); } }
    const sig = [Math.round(st.hull * 100), Math.round(st.shield * 100), st.wave, st.score, st.over, st.won].join(); if (sig === gun.sig) return; gun.sig = sig;
    setText($g.wave, st.over ? (st.won ? 'Station held' : st.abandoned ? 'Siege abandoned' : 'Station lost') : `Wave ${Math.min(st.wave, st.waves)} of ${st.waves}`);
    $g.hull.style.width = Math.round(st.hull * 100) + '%'; setClass($g.hull, 'low', st.hull < 0.35); $g.shield.style.width = Math.round(Math.min(1, st.shield / 0.2) * 100) + '%';
    setText($g.pct, Math.round(st.hull * 100) + '%'); setText($g.score, fmtInt(st.score) + ' pts');
  }
  // ------------------------------------------------------------ the replay TV, watched full screen
  // The recording plays over the whole screen (rendering/deck.js hands it the frame); these are its controls.
  let watch = null;
  const mm = (v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
  function watchReplay() {
    const d = G.renderer?.room, rp = d?.replay; if (!rp?.rep || watch) return; playSfx('tab');
    d.watching = true; rp.loop = false; rp.speed = 1; rp.paused = false; rp.seek(0);
    const name = replayTitle(rp.rep), end = replayEnding(rp.rep), $w = {};
    const restart = () => { rp.seek(0); rp.paused = false; playSfx('tab', 0.5); };
    const el = h('div.rp-watch',
      h('div.rp-head', h('div.rp-title', h('small', h('i.rp-dot'), 'Replay'), h('b', name.title), h('span', name.sub)), h('button.btn.ghost.small.rp-close', { onclick: () => stopWatching(), 'aria-label': 'Close the replay' }, uiIcon('close'))),
      h('div.rp-ch', TV_CHANNELS.map((c) => h('button.rp-chb' + (d.channel?.() === c.id ? '.on' : '') + (c.live || replayOf(c.id) ? '' : '.empty'), { onclick: () => { if (d.channel?.() === c.id) return; if (tvChannel(c.id)) { stopWatching(); if (!c.live) { d.replay.load(replayOf(c.id)); watchReplay(); } } } }, c.name))), /* News and Boards: back to the Deck, the TV on it */
      h('div.rp-stats', $w.wave = h('b'), $w.score = h('span'), h('i.rp-hull', $w.hull = h('i'))),
      $w.end = h('div.rp-end' + (end.lost ? '.lost' : ''), h('b', end.text), $w.endSub = h('small'), h('button.btn.primary', { onclick: restart }, uiIcon('reroll'), 'Watch again')),
      h('div.rp-bar', h('button.rp-btn', { onclick: restart, 'aria-label': 'From the start' }, uiIcon('reroll')),
        $w.play = h('button.rp-btn', { onclick: () => { if (rp.t >= rp.length) rp.seek(0); rp.paused = !rp.paused; }, 'aria-label': 'Pause or play' }),
        $w.scrub = h('input.rp-scrub', { type: 'range', min: 0, max: rp.length.toFixed(1), step: 0.1, value: 0, 'aria-label': 'Replay position' }),
        $w.time = h('span.rp-time'),
        $w.speed = h('button.rp-btn.rp-speed', { onclick: () => { rp.speed = rp.speed === 1 ? 2 : rp.speed === 2 ? 0.5 : 1; }, 'aria-label': 'Playback speed' })));
    $w.scrub.addEventListener('input', () => { rp.seek(+$w.scrub.value); });
    const room = $.body.querySelector('.deck3d'); room?.append(el); room?.classList.add('watching');
    watch = { el, $w, rp, d, sig: '' }; watchTick();
  }
  /** Switch the replay TV to a channel (Last, Best, Boss, Daily), if it has a recording yet. */
  function tvChannel(id) {
    const c = TV_CHANNELS.find((x) => x.id === id); if (!c) return false;
    const room = G.renderer?.room;
    if (!c.live && !replayOf(id)) { playSfx('deny'); room?.pressKey?.(id, false); hooks.toast?.(`Nothing on ${c.name} yet: ${c.how.toLowerCase()} and it records here.`, 'info'); return false; }
    const changed = room?.channel?.() !== id; G.state.settings.tvChannel = id; playSfx('tab'); if (changed) playSfx('dash', 0.25, 1.8); /* a click, and the hiss of the channel changing */ room?.pressKey?.(id, changed); hooks.saveNow?.('tv'); return true;
  }
  function stopWatching() {
    if (!watch) return; const { d, rp, el } = watch; d.watching = false; rp.loop = true; rp.speed = 1; rp.paused = false;
    el.parentElement?.classList.remove('watching'); el.remove(); watch = null;
  }
  /** Keep the controls in step with the playback, and tell the room where they leave the screen clear. */
  function watchTick() {
    if (!watch) return; const { rp, $w, d, el } = watch, st = rp.status(); if (!st) return;
    const cv = G.renderer?.canvas?.getBoundingClientRect(), head = el.querySelector('.rp-stats')?.getBoundingClientRect(), bar = el.querySelector('.rp-bar')?.getBoundingClientRect();
    if (cv && head && bar) d.watchInsets = { top: Math.max(0, head.bottom - cv.top + 4), bottom: Math.max(0, cv.bottom - bar.top + 4) };
    const sig = [st.wave, st.score, Math.round(st.hull * 50), Math.round(st.t * 4), rp.paused, rp.speed, st.done].join(); if (sig === watch.sig) return; watch.sig = sig;
    setText($w.wave, 'Wave ' + st.wave); setText($w.score, fmtInt(st.score) + ' pts'); $w.hull.style.width = Math.round(Math.max(0, st.hull) * 100) + '%'; setClass($w.hull, 'low', st.hull < 0.35);
    $w.scrub.value = st.t.toFixed(1); setText($w.time, `${mm(st.t)} / ${mm(st.len)}`); setText($w.speed, rp.speed === 0.5 ? '½×' : rp.speed + '×');
    clear($w.play).append(uiIcon(rp.paused ? 'play' : 'pause')); setClass($w.end, 'on', st.done && rp.paused); setText($w.endSub, `Wave ${st.wave} · ${fmtInt(st.score)} points`);
  }
  /** Tapping an exhibit on the deck: its details, as a panel. */
  function exhibit(kind) {
    if (kind === 'exit') { show(outside); return; }
    if (kind === 'replay') { const ch = G.renderer?.room?.channel?.(); if (ch === 'news') playSfx('tab', 0.35); else if (ch === 'boards') openBoards(G.renderer.room.boardTab); else watchReplay(); return; } /* the News is to be watched, not read; the Boards open in full in Records */
    if (kind.startsWith('tv:')) { tvChannel(kind.slice(3)); return; }
    if (kind === 'control') { show('control'); return; }
    if (kind === 'hall') { show('hall'); return; }
    if (kind === 'garden') { show('garden'); return; }
    if (kind === 'directory') { stationCard(); return; }
    const st = G.state, s = st.stats, rank = st.prestige?.level || 0; playSfx('tab');
    const panel = (kicker, title, ...body) => hooks.panel?.({ kicker, title, body });
    if (kind === 'records') {
      const deep = Math.max(0, (s.bestWave || 0) - 60), cstars = Object.values(st.counter.stars || {}).reduce((a, b) => a + b, 0), hstars = Object.values(st.counter.hard || {}).reduce((a, b) => a + b, 0);
      panel('Command Deck', 'Records', h('div.deck-board', [['Furthest wave', s.bestWave || '—'], ['High score', s.bestScore ? fmtInt(s.bestScore) : '—'], ['Deep Void', deep ? `+${deep} waves` : '—'], ['Anomalies carried', s.maxAnomalies || '—'],
        ['Counterattack', `${cstars}★` + (hstars ? ` · Hard ${hstars}★` : '')], ['Invaders', fmt(s.kills || 0)], ['Sorties', fmtInt(s.sorties || 0)], ['Play time', fmtTime(Math.round(st.meta.playTime || 0))]].map(([k, v]) => h('div.db-row', h('small', k), h('b', String(v))))),
        h('button.btn.ghost.small.d3-more', { onclick: () => { hooks.closeOverlays?.(); show('records'); } }, 'All records', uiIcon('chevron')));
    } else if (kind === 'medals') {
      const earned = [], left = [];
      for (const a of ACHIEVEMENTS) { const n = st.medals[a.id] || 0; (n ? earned : left).push(n ? h('div.plaque', medal(a, TIERS[n - 1].id), h('small', a.name)) : a); }
      for (const f of FEATS) (st.medals[f.id] ? earned : left).push(st.medals[f.id] ? h('div.plaque', medal(f, 'feat'), h('small', f.name)) : f);
      panel('Command Deck', `Medal wall · ${earned.length}/${earned.length + left.length}`, earned.length ? h('div.deck-wall', earned) : h('p.sub-note', 'Medals you earn will hang here.'),
        h('button.btn.ghost.small.d3-more', { onclick: () => { hooks.closeOverlays?.(); show('awards'); } }, `${left.length} still to earn`, uiIcon('chevron')));
    } else if (kind === 'banners') {
      const owned = BANNERS.filter((b) => b.shape && st.banners[b.id]);
      panel('Command Deck', `Banners · ${owned.length}/${BANNERS.filter((b) => b.shape).length}`, h('div.deck-rack', owned.map((b) => h('div.rack-slot' + (st.banner === b.id ? '.flying' : ''), h('i.rack-rod'), bannerThumb(b, 'rack-thumb'), h('small', b.name)))),
        h('button.btn.ghost.small.d3-more', { onclick: () => { hooks.closeOverlays?.(); show('ships'); } }, 'Choose which one flies', uiIcon('chevron')));
    } else if (kind === 'ships') {
      panel('Command Deck', 'Hangar bay', bayGrid(st));
    } else if (kind === 'trophies') {
      panel('Command Deck', 'Overhaul trophies', h('div.deck-trophies', Array.from({ length: Math.max(rank, 1) }, (_, i) => h('div.trophy' + (i < rank ? '' : '.empty'), h('b', ROMAN_N(i + 1)), h('small', STATION_CORE.find((c) => c.at === i + 1)?.name || 'Overhaul')))), roadmap(rank));
    } else if (kind === 'station') {
      panel('Command Deck', 'Your station', h('div.oh-plan', { html: stationBlueprint(rank, st.workshop, { peak: st.stationPeak, alien: st.counter?.tech, caught: caughtStages(st), name: st.stationName, pct: rebuilt() }) }), roadmap(rank));
    }
  }

  // ------------------------------------------------------------ awards: achievements
  const medal = (a, tier) => h('span.medal-frame.tier-' + tier, art(a.art, 'medal-ico'));
  function awardsView() {
    const tot = medalTotal(), counts = { bronze: 0, silver: 0, gold: 0, feat: 0 };
    for (const a of ACHIEVEMENTS) { const n = G.state.medals[a.id] || 0; for (let t = 0; t < n; t++) counts[TIERS[t].id]++; }
    for (const f of FEATS) if (G.state.medals[f.id]) counts.feat++;
    const summary = h('section.panel.aw-summary',
      h('div.aw-top', h('div', h('div.kicker', 'Medals earned'), h('b.aw-count', `${tot.earned}`, h('small', ` / ${tot.total}`))),
        h('div.aw-tally', [['gold', 'Gold'], ['silver', 'Silver'], ['bronze', 'Bronze'], ['feat', 'Feats']].map(([k, n]) => h('div.tally.tier-' + k, h('i'), h('b', String(counts[k])), h('small', n))))),
      h('div.meter.rank', h('i', { style: `width:${(tot.earned / tot.total * 100).toFixed(1)}%` })),
      h('small.aw-note', `Every medal pays pilot XP: bronze ${TIERS[0].xp}, silver ${TIERS[1].xp}, gold ${TIERS[2].xp}, feats ${FEAT_XP}.`));
    const row = (a) => {
      const pr = medalProgress(a), tiered = !!a.goals, got = pr.tiers;
      const tier = tiered ? (got ? TIERS[got - 1].id : 'none') : got ? 'feat' : 'none';
      const pips = tiered ? h('div.tier-pips', TIERS.map((t, i) => h('i.tier-' + t.id + (i < got ? '.on' : '')))) : null;
      return h('div.ach' + (pr.done ? '.done' : ''), medal(a, tier),
        h('div.ach-main', h('div.ach-title', h('b', a.name), pips), h('div.ach-desc', pr.done ? (tiered ? 'All tiers complete · ' + medalDesc(a, a.goals.length - 1) : a.desc) : tiered ? `${TIERS[got].name}: ${medalDesc(a, got)}` : a.desc),
          pr.done ? null : h('div.meter.small', h('i', { style: `width:${(pr.frac * 100).toFixed(1)}%` }))),
        pr.done ? uiIcon('check') : h('div.c-count', a.roman ? `${roman(pr.cur)}/${roman(pr.goal)}` : `${fmt(pr.cur)}/${fmt(pr.goal)}`));
    };
    return h('div.screen', h('div.screen-head', h('h2', 'Achievements'), h('p', 'Medals for milestones, and feats for the sorties worth bragging about.')),
      summary, bannerHint('medals'), h('h3', 'Medals'), h('div.rows', ACHIEVEMENTS.map(row)), h('h3', 'Feats'), h('div.rows', FEATS.map(row)));
  }

  // ------------------------------------------------------------ live updates
  function badges() {
    const st = G.state, canBuy = WORKSHOP.some((u) => { const c = workshopNext(u.id); return c != null && st.salvage >= c; });
    const ship = SHIPS.some((s) => (shipStatus(s.id) === 'buyable' && st.salvage >= s.cost) || refitReady(st, s.id));
    const daily = (st.stats.sorties > 0 && !dailyToday().done) || (st.counter.unlocked && !Object.keys(st.counter.stars).length) || bountyClaimable(st);
    setClass(navBtns.records, 'badged', !st.seen.records); setClass(navBtns.awards, 'badged', medalTotal().earned > (st.seen.medals || 0));
    setClass(navBtns.workshop, 'badged', canBuy); setClass(navBtns.ships, 'badged', ship); setClass(navBtns.missions, 'badged', daily);
    for (const [id] of TABS) { const m = menuState(id); setClass(navBtns[id], 'locked', m === 'locked'); setClass(navBtns[id], 'fresh', m === 'new'); if (m === 'locked') setClass(navBtns[id], 'badged', false); }
    if (shownTabs().join() !== navSig) layoutNav(); // a tab appeared (the Command Deck)
    const hidden = (p) => (pages[p] || []).some((id) => navBtns[id].classList.contains('badged') || navBtns[id].classList.contains('fresh'));
    setClass($.next, 'badged', hidden(page + 1)); setClass($.prev, 'badged', page > 0 && hidden(page - 1));
  }
  // The sizes the hangar needs every frame (the header's foot, the screen, the station callout) are measured only when
  // they can have changed (a resize, new text, another tab), so a frame never forces the page to be laid out again.
  const lay = { dirty: true, top: 0, w: 0, h: 0, ch: 0, cl: 0, cw: 0 }, relayout = () => { lay.dirty = true; };
  if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(relayout); ro.observe(el); ro.observe(top); ro.observe($.callout); } addEventListener('resize', relayout);
  function measureLayout() { lay.dirty = !(typeof ResizeObserver !== 'undefined'); lay.top = top.getBoundingClientRect().bottom; const b = el.getBoundingClientRect(), c = $.callout; lay.w = b.width; lay.h = b.height; lay.ch = c.offsetHeight; lay.cl = c.offsetLeft; lay.cw = c.offsetWidth; }
  /** Fleet Ops' title keeps up with its ships (one comes home while you stand there). */
  let opsAt = 0; function opsTick() { if (tab !== 'ops' || performance.now() < opsAt) return; opsAt = performance.now() + 1000; const b = $.body.querySelector('.deck3d.ops .d3-title b'); if (b) setText(b, opsTitle()); }
  function update() { watchTick(); gunnerTick(); opsTick(); boltTick(); refitTick(); globalTick(); const sv = G.state.salvage; if ($.salvage._v !== sv) { $.salvage._v = sv; setText($.salvage, fmtInt(sv)); } badges(); pilotId(); stationDone(); if (lay.dirty) measureLayout(); G.hangarTop = lay.top; stationTag(); }
  /** Keep the label's text current, and its tap target over wherever the renderer drew it. */
  /** A buy that changed the station says so: a module rebuilt for the first time, lit once maxed, alien hardware fitted. */
  function stationNote(id, was) {
    const a = was.parts[id] || 0, b = stationSnapshot(G.state).parts[id] || 0, m = MODULE_BY_ID[id] || ALIEN_BY_ID[id] || TROPHY_BY_ID[id]; if (!m || b <= a) return;
    hooks.toast?.(`Station: ${m.name} ` + (ALIEN_BY_ID[id] ? 'fitted' : b === 2 ? (a === 0 ? 'rebuilt and online' : 'online') : 'rebuilt'), 'station');
  }
  /** What changed on the station since the pilot last looked at it: those parts glow, and the rebuild figure counts up. */
  let lastLook = null;
  function stationNews() {
    const now = stationSnapshot(G.state), was = lastLook; lastLook = now; if (!was) return;
    const up = Object.keys(now.parts).filter((id) => now.parts[id] > (was.parts[id] || 0)); if (up.length) G.renderer?.station?.pulse(up);
    if (now.pct > was.pct) { const c = $.callout; c._pct = was.pct; c._from = performance.now() + 900; c._b0 = was.pct; c._sh0 = was.shares; c._sh1 = now.shares; c._step = Math.max(25, Math.min(90, 1800 / (now.pct - was.pct))); }
  }
  /** The callout's text, and its hairline from the text to wherever the renderer drew the station's hub. */
  function stationTag() {
    if (tab !== 'launch') return;
    const st = G.state, pct = rebuilt(), deck = menuState('deck') !== 'locked', c = $.callout, t = performance.now();
    // a rise since the last look counts up, a point at a time (about two seconds at most)
    if (c._pct == null || c._pct > pct) c._pct = pct;
    if (c._pct < pct && t > (c._from || 0) && t - (c._at || 0) > (c._step || 90)) { c._pct++; c._at = t; c._glow = t + 1400; }
    setClass(c, 'up', c._pct < pct || t < (c._glow || 0));
    // the bar follows the count: from the old shares to the new as the figure climbs
    const now = rebuildParts(st), to = c._sh1 && c._pct < pct ? c._sh1 : null, k = to ? (c._pct - c._b0) / Math.max(1, pct - c._b0) : 1;
    paintBar(Object.fromEntries(REBUILD_PARTS.map((r) => [r.id, to ? c._sh0[r.id] + (to[r.id] - c._sh0[r.id]) * k : now[r.id].share])));
    // a room that has opened says so until you go aboard
    const fresh = freshAboard(st), sig = (st.stationName || '') + '|' + c._pct + '|' + deck + '|' + fresh;
    if (c._sig !== sig) { c._sig = sig; lay.dirty = true; setText($.coName, st.stationName || 'Unnamed'); setClass(c, 'unnamed', !st.stationName); setClass(c, 'news', fresh); setText($.coSub, `${c._pct}% rebuilt` + (fresh ? ' · New room aboard ›' : deck ? ' · Command Deck ›' : '')); }
    const p = G.renderer?.station?.hubNdc; if (!p || !lay.w) return;
    const hx = (p.x + 1) / 2 * lay.w, hy = (1 - p.y) / 2 * lay.h, ch = lay.ch, cTop = Math.max((G.hangarTop || 0) + 6, hy - ch / 2);
    const px = (o, k, v) => { if (o[k] !== v) o[k] = v; }; /* a style is only written when it changes */
    px(c.style, 'top', Math.round(cTop) + 'px');
    // the tap target over the station follows it (it stands 27 units tall, 16 above the hub, 46 wide)
    const u = (G.renderer.station.screenPx || 200) / 46, hs = $.stationHot.style; px(hs, 'left', Math.round(hx - 23 * u) + 'px'); px(hs, 'top', Math.round(hy - 16 * u) + 'px'); px(hs, 'width', Math.round(46 * u) + 'px'); px(hs, 'height', Math.round(27 * u) + 'px');
    const ax = lay.cl + lay.cw + 6, ay = Math.round(Math.min(Math.max(hy, cTop + 10), cTop + ch - 10));
    const ls = `${ax},${ay},${Math.round(hx)},${Math.round(hy)}`; if ($.coLine._s !== ls) { $.coLine._s = ls;
      $.coLine.setAttribute('x1', ax); $.coLine.setAttribute('y1', ay); $.coLine.setAttribute('x2', Math.round(hx - 7)); $.coLine.setAttribute('y2', Math.round(hy)); $.coDot.setAttribute('cx', Math.round(hx)); $.coDot.setAttribute('cy', Math.round(hy)); }
  }
  /** Light the rebuild bar's segments: each part's share across its own group, the one still filling pulsing. */
  function paintBar(sh) {
    const sig = REBUILD_PARTS.map((r) => sh[r.id].toFixed(3)).join(); if ($.coBar._sig === sig) return; $.coBar._sig = sig;
    REBUILD_PARTS.forEach((r, g) => { const segs = $.coBar.children[g].children, f = sh[r.id] * segs.length; for (let i = 0; i < segs.length; i++) { const v = Math.max(0, Math.min(1, f - i)); segs[i].style.setProperty('--f', v.toFixed(3)); segs[i].classList.toggle('part', v > 0 && v < 1); } });
  }
  /** How much of the station has been rebuilt: modules, core pieces and captures (data/station.js). */
  const rebuilt = () => rebuildPct(G.state);
  /** A room aboard has opened and not been visited yet (the Command Deck goes by its menu). */
  const freshAboard = (st) => menuState('deck') === 'new' || ROOMS_ABOARD.some((r) => roomFresh(r.id, st));
  /** The rebuild part by part, in the bar's colours: what each is, where it comes from, how far along. */
  function overview(st) {
    const p = rebuildParts(st);
    return h('div.sc-rows', REBUILD_PARTS.map((r) => h('div.sc-row.g-' + r.id, h('span', h('b', r.label), h('small', `${r.from} · ${r.weight}% of the rebuild`)), h('em', `${p[r.id].cur}/${p[r.id].goal}`),
      h('div.sc-meter', h('i', { style: `width:${(p[r.id].share * 100).toFixed(1)}%` })))));
  }
  /** Everything about the station in one card: its blueprint, the rebuild, the rooms aboard (the way into each), and
   *  its name. */
  function stationCard() {
    const st = G.state, rank = st.prestige?.level || 0, deck = menuState('deck') !== 'locked', control = siegeUnlocked(st); playSfx('tab');
    hooks.panel?.({ kicker: 'Your station', title: st.stationName || 'Unnamed station', body: [
      h('div.oh-plan', { html: stationBlueprint(rank, st.workshop, { peak: st.stationPeak, alien: st.counter?.tech, caught: caughtStages(st), name: st.stationName, pct: rebuilt() }) }),
      overview(st), control ? damageNote() : null, aboard(st),
      h('div.sc-actions', h('button.btn.ghost', { onclick: () => hooks.nameStation?.() }, st.stationName ? 'Rename the station' : 'Name the station'),
        deck ? null : h('button.btn.ghost', { onclick: () => { hooks.closeOverlays?.(); show('workshop'); } }, 'Workshop'))] });
  }
  /** The rooms aboard in the order they open, each with what is waiting there (NEW until the first visit), then the
   *  next one to open and what opens it. */
  function aboard(st) {
    const next = ROOMS_ABOARD.find((r) => r.rank && !roomOpen(r, st)), rows = [];
    for (const r of ROOMS_ABOARD) {
      const open = r.id === 'deck' ? menuState('deck') !== 'locked' : roomOpen(r, st);
      if (open) {
        const fresh = r.id === 'deck' ? menuState('deck') === 'new' : roomFresh(r.id, st), s = roomStatus(r, st);
        rows.push(h('button.sc-room' + (fresh ? '.new' : s.ready ? '.ready' : ''), { style: `--c:${hex(r.color)}`, onclick: () => { hooks.closeOverlays?.(); show(r.id); } },
          h('span.sc-ico', uiIcon(r.icon)), h('span.sc-rt', h('b', r.name), h('small', s.text)), fresh ? h('em.sc-new', 'NEW') : h('span.sc-go', uiIcon('chevron'))));
      } else if (r === next || r.id === 'garden' || (r.id === 'control' && st.counter?.unlocked)) rows.push(h('div.sc-room.locked', h('span.sc-ico', uiIcon('lock')), h('span.sc-rt', h('b', r.name), h('small', r.when || (r.rank === 1 ? 'Opens with your first Overhaul' : `Opens at Overhaul rank ${r.rank}`)))));
    }
    return h('div.sc-aboard', h('h4.oh-sub', 'Aboard'), rows);
  }
  /** What is waiting in a room, in a line, and whether it wants you there (something to claim, build, chart or repair,
   *  new bounties, a bunk made up). */
  function roomStatus(r, st) {
    const pct = Math.round(REST_BONUS * 100), q = st.quarters;
    if (r.id === 'control') { const d = siegeDamage(st), n = nextSiege(st); if (d) return { text: `${d.ids.length} system${d.ids.length > 1 ? 's' : ''} down: repair them here`, ready: true }; return { text: n ? `Next siege: ${n.name}` : r.for }; }
    if (r.id === 'hall') { const n = caughtStages(st).length; return { text: n ? `${n} of ${STATION_TROPHIES.length} Counterattack bosses captured` : r.for }; }
    if (r.id === 'comms') { if (bountyClaimable(st)) return { text: 'A bounty is done: claim it', ready: true }; const bt = st.bounties; if (bt?.day !== dayKey()) return { text: 'Today\'s bounties are posted', ready: true }; return { text: `Today's bounties: ${bt.list.filter((b) => b.done).length} of ${bt.list.length} done` }; }
    if (r.id === 'quarters' && st.bolt?.fresh) return { text: 'Bolt found something new to wear: see its locker', ready: true };
    if (r.id === 'quarters') return q?.rested ? { text: `Rested: +${pct}% salvage next sortie` } : q?.restDay === dayKey() ? { text: 'Rested today: the bunk is yours tomorrow' } : { text: `Your bunk is made: rest for +${pct}% salvage`, ready: true };
    if (r.id === 'observatory') { const n = chartable(st).length, done = VOID_MARKS.filter((m) => isCharted(st, m)).length; return n ? { text: `${n} new ${n > 1 ? 'depths' : 'depth'} to chart`, ready: true } : { text: done ? `${done} of ${VOID_MARKS.length} depths charted` : r.for }; }
    if (r.id === 'yard') { if (yardDone(st)) return { text: 'The Chimera is built: try her paints in the dock' }; const n = nextStage(st), step = `stage ${n.n} of ${YARD_STAGES.length}, ${n.name.toLowerCase()}`; return stageBlock(st) ? { text: `The Chimera, ${step}` } : { text: `Ready to build ${step}`, ready: true }; }
    if (r.id === 'beacons') { const n = VOID_BOSSES.filter((id) => voidBeaten(st)[id]).length; return { text: n ? `${n} of ${VOID_BOSSES.length} Void bosses beaten` : r.for }; }
    if (r.id === 'ops') { const c = fleetCounts(st);
      if (c.ready) return { text: `${c.ready} ship${c.ready > 1 ? 's' : ''} home: unload ${c.ready > 1 ? 'them' : 'her'}`, ready: true };
      if (c.damaged) return { text: `${c.damaged} ship${c.damaged > 1 ? 's' : ''} home damaged: repair ${c.damaged > 1 ? 'them' : 'her'} to fly again`, ready: true };
      if (c.free && sendable(st)) return { text: `${c.free} berth${c.free > 1 ? 's' : ''} free: send a ship out`, ready: true };
      return { text: c.out ? `${c.out} out · next home in ${hrs(nextHome(st))}` : r.for }; }
    if (r.id === 'garden') { const c = gardenCounts(st), seeds = seedCount(st);
      if (c.bloom) return { text: `${c.bloom} in bloom: harvest ${c.bloom > 1 ? 'them' : 'it'}`, ready: true };
      if (c.empty && seeds) return { text: `${c.empty} empty bed${c.empty > 1 ? 's' : ''}: plant a seed`, ready: true };
      if (c.growing && !wateredToday(st)) return { text: 'Water the beds to bring them on', ready: true };
      return { text: c.growing ? `${c.growing} growing · next bloom in ${hrs(c.next)}` : r.for }; }
    return { text: r.for };
  }

  // W/A/S/D or the arrows walk the room aboard that is open.
  const DECK_KEYS = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  for (const [type, on] of [['keydown', true], ['keyup', false]]) addEventListener(type, (e) => { if (on && e.code === 'Escape' && watch && !hooks.blocking?.()) { stopWatching(); e.preventDefault(); return; }
    if (on && G.room === 'gunner' && G.mode === 'hangar' && !hooks.blocking?.()) { const g = G.renderer?.room;
      if (e.code === 'Space' || e.code === 'KeyF') { g?.fireMissile?.(); e.preventDefault(); return; }
      if (g?.pick && /^Digit[1-3]$/.test(e.code)) { g.choosePick(+e.code.slice(5) - 1); if (gun) gun.psig = null; e.preventDefault(); return; }
      if (g?.pick && e.code === 'KeyR') { g.reroll(); e.preventDefault(); return; } }
    const k = DECK_KEYS[e.code], d = G.renderer?.room; if (!k || !d || watch || (on && hooks.blocking?.())) return; d.keys[k] = on; e.preventDefault(); });
  /** Finishing the station (every Workshop upgrade maxed) gets its moment, once per Overhaul cycle. */
  function stationDone() { const st = G.state, lv = st.prestige?.level || 0; if (st.seen.stationDone === lv || !workshopMaxed() || hooks.blocking?.()) return; st.seen.stationDone = lv; hooks.stationComplete?.(); }
  function pilotId() {
    const p = G.state.pilot, sig = p.rank + '|' + (p.name || ''); if ($.brand._sig === sig) return; $.brand._sig = sig;
    setText($.brandName, p.name || rankTitle(p.rank)); setText($.brandRank, p.name ? `${rankTitle(p.rank)} · Rank ${p.rank}` : `Rank ${p.rank}`);
    clear($.brandIns).append(insignia(p.rank, 'rank-ins'));
  }
  /** Straight aboard a room whose intro has just been read (the Overhaul that opened it offered the way there). */
  function board(id) { const room = ROOM_BY_ID[id]; if (room?.seen) G.state.seen[room.seen] = true; else menuSeen(id); show(id); }
  bus.on('contract', () => { if (G.mode === 'hangar') render(); });
  bus.on('medal', () => { if (G.mode === 'hangar' && tab === 'awards') { G.state.seen.medals = medalTotal().earned; render(); } });
  layoutNav();
  return { el, top, nav: $.nav, show, board, render, update, siege: (n) => launchSiege(n), tap: (kind) => kind === 'bolt' ? boltTap() : ({ control: controlExhibit, hall: hallExhibit, comms: commsExhibit, quarters: quartersExhibit, observatory: observatoryExhibit, yard: yardExhibit, beacons: beaconExhibit, garden: gardenExhibit, ops: opsExhibit }[G.room] || exhibit)(kind), get tab() { return tab; } };
}
