import { materialIcon, gameIcon } from '@last-orbit/ui/icons.js';
// UI shell: top HUD, boss bar, banners, toasts, player status, ability bar, sliding panel and bottom nav.
// Panels are built lazily, updated at ~5 Hz while open. The HUD updates at ~10 Hz. Nothing here touches the simulation except through public functions.
import { RECIPES } from '@last-orbit/data/foundry.js';
import { supplyReady, useSupply } from '@last-orbit/progression/foundry.js';
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { fmt, fmtTime } from '@last-orbit/core/format.js';
import { CUR } from '@last-orbit/core/state.js';
import { Big } from '@last-orbit/core/big.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { ABILITIES } from '@last-orbit/data/abilities.js';
import { BOONS } from '@last-orbit/data/boons.js';
import { UPGRADES } from '@last-orbit/data/upgrades.js';
import { upgradeVisible, upgradeOwnedFree, upgradeLevel, upgradeQuote } from '@last-orbit/progression/economy.js';
import { useAbility, abilityCooldown, abilityMaxCharges } from '@last-orbit/combat/abilities.js';
import { setFarm, pauseIntermission, startNextWave } from '@last-orbit/combat/sim.js';
import { genWave } from '@last-orbit/combat/waves.js';
import { canRewind, shardPreview } from '@last-orbit/prestige/prestige.js';
import { playSfx } from '@last-orbit/audio/audio.js';
import { h, clear, setText, setClass, setWidth } from '@last-orbit/ui/dom.js';
import { initModals, showChoice, modalOpen, onboardingDialog, bossLootDialog } from '@last-orbit/ui/modals.js';
import { upgradesPanel } from '@last-orbit/ui/panels/upgrades.js';
import { arsenalPanel } from '@last-orbit/ui/panels/arsenal.js';
import { researchPanel } from '@last-orbit/ui/panels/research.js';
import { modulesPanel } from '@last-orbit/ui/panels/modules.js';
import { skillsPanel } from '@last-orbit/ui/panels/skills.js';
import { rewindPanel } from '@last-orbit/ui/panels/rewind.js';
import { menuPanel, menuAttention } from '@last-orbit/ui/panels/menu.js';
import { treeAffordable } from '@last-orbit/ui/panels/tree.js';
import { onboardingObjective, onboardingBriefing, acknowledgeOnboarding } from '@last-orbit/meta/onboarding.js';
import { managementPanelHeight, commandPanelHeight, commandPhaseActive, TACTICAL_TIME_SCALE } from '@last-orbit/ui/management.js';
import { MATERIAL_TIERS } from '@last-orbit/data/materials.js';
import { PROJECTS } from '@last-orbit/data/projects.js';
import { uiIcon } from '@last-orbit/ui/icons.js';
import { xpProgress } from '@last-orbit/data/experience.js';
import { skillPoints } from '@last-orbit/progression/skills.js';

const NAV = [['upgrades', 'Upgrades', '▲', null], ['arsenal', 'Arsenal', '✦', 'arsenal'], ['research', 'Research', '◈', 'research'], ['modules', 'Loadout', '⬢', 'arsenal'], ['skills', 'Skills', '✧', 'skills'], ['rewind', 'Rewind', '◆', 'rewind'], ['menu', 'Menu', '≡', null]];
const BOON_BY_ID = Object.fromEntries(BOONS.map((b) => [b.id, b]));
const BOON_ICON = { offence: '▲', crit: '✦', drone: '⁂', defence: '⬡', economy: '¢', boss: '◆' };
const BOON_COLOR = { offence: '#ffb547', crit: '#b69cff', drone: '#66ffc2', defence: '#7aa2ff', economy: '#ffd66b', boss: '#ff6f91' };

export function statusEffectItems(st, w) {
  const p = w.player, items = [];
  const add = (id, icon, name, value, color, detail, kind = 'buff', artKind = null, artId = null) => items.push({ id, icon, name, value, color, detail, kind, artKind, artId });
  if (w.foundryBurst > 0) add('foundry', 'ϟ', 'Overclock', Math.ceil(w.foundryBurst) + 's', '#ffb547', `Foundry Overclock: +${Math.round((w.foundryPower || 0.35) * 100)}% damage while active.`, 'buff', 'support', 'burst');
  if ((w.abil.active.overdrive || 0) > 0) add('overdrive', ABILITIES.overdrive.icon, ABILITIES.overdrive.name, Math.ceil(w.abil.active.overdrive) + 's', ABILITIES.overdrive.color, ABILITIES.overdrive.desc, 'buff', 'ability', 'overdrive');
  if ((w.abil.active.aegis || 0) > 0) add('aegis', ABILITIES.aegis.icon, ABILITIES.aegis.name, Math.ceil(w.abil.active.aegis) + 's', ABILITIES.aegis.color, ABILITIES.aegis.desc, 'buff', 'ability', 'aegis');
  if (w.slowT > 0) add('slow', ABILITIES.slow.icon, ABILITIES.slow.name, Math.ceil(w.slowT) + 's', ABILITIES.slow.color, ABILITIES.slow.desc, 'buff', 'ability', 'slow');
  if (w.chargeShots > 0) add('charge', ABILITIES.charge.icon, ABILITIES.charge.name, w.chargeShots + ' volleys', ABILITIES.charge.color, ABILITIES.charge.desc, 'buff', 'ability', 'charge');
  const swarmLeft = Math.max(0, ...w.drones.filter((d) => d.temp).map((d) => d.life || 0));
  if (swarmLeft > 0) add('swarm', ABILITIES.swarm.icon, ABILITIES.swarm.name, Math.ceil(swarmLeft) + 's', ABILITIES.swarm.color, ABILITIES.swarm.desc, 'buff', 'ability', 'swarm');
  const holeLeft = Math.max(0, ...w.hazards.filter((h) => h.kind === 'hole').map((h) => Math.max(0, (h.dur || 0) - (h.t || 0))));
  if (holeLeft > 0) add('hole', ABILITIES.hole.icon, ABILITIES.hole.name, Math.ceil(holeLeft) + 's', ABILITIES.hole.color, ABILITIES.hole.desc, 'buff', 'ability', 'hole');
  if (p.invuln > 0 && !(w.abil.active.aegis > 0)) add('protection', '⬡', 'Protection', Math.ceil(p.invuln) + 's', '#7aa2ff', 'Temporary damage immunity.', 'buff', 'ability', 'aegis');
  if (w.stunT > 0) add('stun', '◎', 'Enemy stun', Math.ceil(w.stunT) + 's', '#5ee6ff', 'Enemies are disabled by EMP.', 'buff', 'ability', 'emp');
  for (const id of Object.keys(st.run.boons || {})) {
    const n = st.run.boons[id] || 0, b = BOON_BY_ID[id]; if (!b || n <= 0) continue;
    add('boon:' + id, b.rare ? '★' : (BOON_ICON[b.tag] || '◆'), b.name, n > 1 ? '×' + n : 'BOON', BOON_COLOR[b.tag] || '#b69cff', b.desc, 'boon', 'boon', id);
  }
  for (let i = 0; i < (st.run.picks || []).length; i++) {
    const pick = st.run.picks[i]; if (!pick?.label) continue;
    add('anomaly:' + i, '◈', pick.label, 'ANOMALY', '#b69cff', 'Persistent anomaly effect for this run.', 'anomaly', 'tag', pick.tag || 'crit');
  }
  return items;
}

export function initUI(root, hooks) {
  const $ = {}, panels = {}, factories = { upgrades: upgradesPanel, arsenal: () => arsenalPanel(() => toggle('modules')), research: researchPanel, modules: modulesPanel, skills: skillsPanel, rewind: rewindPanel, menu: () => menuPanel(hooks) };
  let open = null, lastTouch = -Infinity, bannerT = null, curSig = '', onboardingRouteHoldUntil = 0;
  // ---------- build ----------
  $.scan = h('div#scan'); $.vig = h('div#vig'); $.flash = h('div#flash');
  $.waveN = h('span'); $.sector = h('div.sector'); $.tag = h('span.wave-tag'); $.xpN = h('b'); $.xpI = h('i'); $.xpBar = h('span.xp-bar', $.xpI); $.level = h('button.levelbox', { onclick: () => { const x = xpProgress(G.state.run.xp || 0); if (G.state.unlocks.skills) toggle('skills'); else bus.emit('toast', `Ship Level ${x.level}: ${x.current}/${x.needed} XP. Skills unlock at wave 8.`, 'info'); } }, $.xpN, $.xpBar); $.farm = h('button.hbtn', { onclick: () => { setFarm(!G.state.run.farm); playSfx('tab'); } }); $.choice = h('button.hbtn.badge', { 'aria-label': 'Choose pending field upgrade', onclick: () => showChoice() }, '◆ Pick'); $.secI = h('i'); $.secProg = h('div.sec-prog', $.secI);
  $.curs = h('div.curs'); $.bossName = h('span'); $.bossTitle = h('span'); $.bossI = h('i'); $.bossHp = h('div.boss-hp', $.bossI); $.bossNote = h('div.boss-note'); $.boss = h('div#bossbar', h('div.boss-name', $.bossName, $.bossTitle), $.bossHp, $.bossNote);
  $.objK = h('div.obj-k'); $.objTitle = h('b'); $.objText = h('span'); $.objHint = h('small'); $.objProg = h('i');
  $.objective = h('div#objective', { role: 'status', 'aria-live': 'polite' }, h('div.obj-head', $.objK, $.objProg), $.objTitle, $.objText, $.objHint);
  $.routeText = h('span'); $.routeMeter = h('i'); $.route = h('button.route-tracker', { type: 'button', 'aria-label': 'Open Lunar Passage construction', onclick: () => { if (open !== 'menu') toggle('menu'); panels.menu.goto('projects'); } }, h('span.route-symbol', '◇'), $.routeText, h('span.route-track', $.routeMeter), h('span.route-arrow', '›'));
  $.hud = h('div#hud', h('div.hud-row', h('div.wavebox', h('div.wave-n', h('small', 'Wave'), $.waveN), $.tag, $.sector), $.level, $.choice, $.farm), $.secProg, $.curs, $.route, $.boss, $.objective);
  $.buffs = h('div#buff-stack', { role: 'status', 'aria-label': 'Current buffs and boons' });
  $.boonInfo = h('aside#boon-info', { role: 'status', 'aria-live': 'polite', hidden: true });
  $.banner = h('div#banner', { role: 'status', 'aria-live': 'polite' }); $.toasts = h('div#toasts', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false' }); $.hint = h('div#hint', 'Drag to move · hold to fire');
  $.guideSpot = h('div#tutorial-spot', { 'aria-hidden': 'true' }); $.guideK = h('div.tg-k'); $.guideTitle = h('b'); $.guideText = h('span'); $.guideHint = h('small');
  $.guideCard = h('div#tutorial-guide', { role: 'status', 'aria-live': 'polite' }, $.guideK, $.guideTitle, $.guideText, $.guideHint);
  $.interK = h('div.inter-k'); $.interTitle = h('b'); $.interMode = h('span'); $.interHelp = h('small', 'Push advances to a harder wave. Hold repeats the wave you just cleared to farm resources.');
  $.interStart = h('button.btn.sm.pri', { onclick: () => { startNextWave(); playSfx('tab'); } }, 'Start now');
  $.interShop = h('button.btn.sm', { onclick: () => { const ws = G.world?.wave; if (ws?.intermissionPaused) pauseIntermission(false); else { pauseIntermission(true); if (open !== 'upgrades') toggle('upgrades'); } playSfx('tab'); } });
  $.intermission = h('div#wave-intermission', { role: 'status', 'aria-live': 'polite' }, $.interK, $.interTitle, $.interMode, $.interHelp, h('div.inter-actions', $.interStart, $.interShop));
  $.commandK = h('span.command-k', 'Intermission paused'); $.commandTitle = h('b'); $.commandNext = h('small');
  $.commandSystems = h('button.btn.sm', { onclick: () => { if (open !== 'menu') toggle('menu'); panels.menu.goto('systems'); } }, 'Systems');
  $.commandStart = h('button.btn.sm.pri', { onclick: () => { toggle(null); startNextWave(); } }, 'Start wave');
  $.commandBar = h('div#command-phase-bar', { role: 'status', 'aria-live': 'polite' }, h('div.command-copy', $.commandK, $.commandTitle, $.commandNext), h('div.command-actions', $.commandSystems, $.commandStart));
  $.hullI = h('i'); $.hull = h('div.bar.hull', $.hullI); $.shieldI = h('i'); $.shield = h('div.bar.shield', $.shieldI); $.energyI = h('i'); $.energy = h('div.bar.energy', $.energyI);
  $.combo = h('div.combo'); $.meters = h('div.meters');
  $.status = h('div#status', h('div.bars', $.meters, $.shield, $.hull, $.energy), $.combo);
  $.supplyIcon = h('span.supply-art'); $.supplyText = h('span.supply-copy'); $.supply = h('button.supply-quick', { onclick: () => { if (!useSupply()) { if (open !== 'menu') toggle('menu'); panels.menu.goto('foundry'); } } }, $.supplyIcon, $.supplyText);
  $.tactical = h('div#tactical-time', { role: 'status', 'aria-live': 'polite' }, h('b', `×${TACTICAL_TIME_SCALE.toFixed(1)}`), ' Tactical time');
  $.abil = h('div#abil'); $.pTitle = h('h3', { id: 'panel-title' }); $.pBody = h('div.p-body');
  $.backGame = h('button.btn.sm.loadout-back', { type: 'button', onclick: () => toggle(null) }, '← Back to game');
  $.skillsLink = h('button.btn.sm.loadout-skills', { type: 'button', onclick: () => toggle('skills') }, 'Skills');
  $.loadoutLink = h('button.btn.sm.skills-loadout-link', { type: 'button', onclick: () => toggle('modules') }, 'Loadout');
  $.panel = h('div#panel', { role: 'region', 'aria-labelledby': 'panel-title', 'aria-hidden': 'true' }, $.commandBar, h('div.p-head', $.pTitle, $.loadoutLink, $.skillsLink, $.backGame, h('button.x', { 'aria-label': 'Close panel and return to game', onclick: () => toggle(open) }, '✕')), $.pBody);
  $.nav = h('div#nav'); $.navBtns = {};
  for (const [id, name, icon] of NAV) { const b = h('button.nb', { 'aria-label': name, 'aria-pressed': 'false', onclick: () => toggle(id) }, uiIcon(id), name, h('span.pip')); $.navBtns[id] = b; $.nav.append(b); }
  $.bottom = h('div#bottom', $.tactical, $.status, $.abil, $.supply, $.panel, $.nav);
  root.append($.scan, $.vig, $.hud, $.buffs, $.boonInfo, $.banner, $.hint, $.intermission, $.toasts, $.bottom, $.guideSpot, $.guideCard, $.flash); initModals(root);
  root.addEventListener('pointerdown', () => { lastTouch = performance.now(); }, true);
  root.addEventListener('pointerdown', (event) => { if (!$.boonInfo.hidden && !event.target.closest('#boon-info,.buff-chip.boon')) $.boonInfo.hidden = true; });

  // ---------- panels ----------
  const commandPhase = () => commandPhaseActive(!!open, G.world?.wave);
  function syncManagementLayout() {
    const active = !!open, command = commandPhase();
    const fullLoadout = open === 'modules', fullSkills = open === 'skills', fullScreen = fullLoadout || fullSkills;
    $.bottom.classList.toggle('management', active);
    $.bottom.classList.toggle('command-phase', command);
    $.bottom.classList.toggle('loadout-fullscreen', fullLoadout);
    $.bottom.classList.toggle('skills-fullscreen', fullSkills);
    root.classList.toggle('management-open', active);
    root.classList.toggle('command-phase', command);
    root.classList.toggle('loadout-open', fullLoadout);
    root.classList.toggle('skills-open', fullSkills);
    $.skillsLink.hidden = !fullLoadout || !G.state.unlocks.skills;
    $.loadoutLink.hidden = !fullSkills;
    $.tactical.classList.toggle('on', active && !command);
    if (active) {
      // Live management preserves the battlefield. A paused intermission instead expands into
      // a Command Phase because there is no active threat to monitor.
      const ph = fullScreen ? innerHeight : command
        ? commandPanelHeight(innerHeight, $.hud.offsetHeight, $.nav.offsetHeight)
        : managementPanelHeight(innerHeight, $.hud.offsetHeight, $.status.offsetHeight + $.nav.offsetHeight);
      $.panel.style.setProperty('--management-panel-height', ph + 'px');
    } else $.panel.style.removeProperty('--management-panel-height');
  }
  function toggle(id) {
    if (open && panels[open]?.onClose) panels[open].onClose();
    if (!id || open === id) { const was = open; open = null; $.panel.classList.remove('open'); $.panel.setAttribute('aria-hidden', 'true'); if ($.panel.contains(document.activeElement) && was) $.navBtns[was]?.focus(); }
    else { if (G.world?.wave?.state === 'cleared' && G.world.wave.intermission) pauseIntermission(true); open = id; const p = panels[id] || (panels[id] = factories[id]()); clear($.pBody).append(p.el); $.pBody.scrollTop = 0; setText($.pTitle, p.title); $.panel.classList.add('open'); $.panel.setAttribute('aria-hidden', 'false'); if (p.onOpen) p.onOpen(); p.update(true); G.state.seen['nav_' + id] = 1; bus.emit('panelOpen', id); }
    syncManagementLayout();
    for (const k in $.navBtns) { const on = k === open; $.navBtns[k].classList.toggle('on', on); $.navBtns[k].setAttribute('aria-pressed', String(on)); } playSfx('tab'); setTimeout(measure, 260); measure(true);
    // Panel-open tutorial gates must be evaluated synchronously. Otherwise a fast tap can purchase
    // past the first-upgrade lesson before the next animation frame has a chance to open its briefing.
    maybeShowOnboardingBriefing(); updateObjective();
  }
  function refreshNav(reveal) { const u = G.state.unlocks; for (const [id, , , gate] of NAV) { const b = $.navBtns[id], show = !gate || !!u[gate]; if (b.classList.contains('hide') !== !show) { b.classList.toggle('hide', !show); if (show && reveal) { b.classList.add('reveal'); setTimeout(() => b.classList.remove('reveal'), 1100); } } setClass(b, 'new', show && gate && !G.state.seen['nav_' + id]); } }
  function measure(predict) {
    syncManagementLayout();
    if (open === 'modules' || open === 'skills') { hooks.setInsets(0, 0); return; }
    const top = $.hud.offsetHeight, bh = $.bottom.offsetHeight; let bottom = bh;
    if (predict && open) {
      const command = commandPhase();
      if (command) bottom = $.nav.offsetHeight + commandPanelHeight(innerHeight, top, $.nav.offsetHeight);
      else { const chrome = $.status.offsetHeight + $.nav.offsetHeight; bottom = chrome + managementPanelHeight(innerHeight, top, chrome); }
    }
    hooks.setInsets(top - 6, bottom - 2);
    $.buffs.style.top = Math.max(8, top + 5) + 'px';
    $.buffs.style.bottom = Math.max(8, bottom + 7) + 'px';
  }

  // ---------- abilities ----------
  let abSig = ''; const abBtns = [];
  function buildAbilities() {
    const st = G.state, slots = Math.floor(G.sheet.n('abilitySlots')), eq = st.abilities.equipped.slice(0, slots), s = (st.unlocks.abilities ? 1 : 0) + eq.join(); if (s === abSig) return; abSig = s; clear($.abil); abBtns.length = 0;
    if (!st.unlocks.abilities) return;
    for (const id of eq) { if (!id) continue; const d = ABILITIES[id], cd = h('div.cd'), t = h('span.t'), ch = h('span.ch'), au = h('span.au');
      const b = h('button.ab', { style: 'color:' + d.color, 'aria-label': d.name, onclick: (e) => { e.preventDefault(); e.stopPropagation(); if (!useAbility(G.world, id)) playSfx('deny'); } }, h('span.ability-art', gameIcon('ability', id, 'ability-pixel', d.icon)), cd, t, ch, au); $.abil.append(b); abBtns.push({ id, b, cd, t, ch, au }); }
    setTimeout(measure, 0);
  }

  // ---------- banners / toasts ----------
  function banner(kicker, title, sub, color = 'var(--amber)', ms = 2200) { const clean = (v) => v == null || v === 'null' || v === 'undefined' ? '' : v; kicker = clean(kicker); title = clean(title); sub = clean(sub); const box = clear($.banner); if (kicker) box.append(h('div.k', kicker)); box.append(h('h2', { style: 'color:' + color }, title)); if (sub) box.append(h('p', sub)); $.banner.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => $.banner.classList.remove('on'), ms); }
  function toastEl(text, kind) { const el = h('div.toast.' + kind, text); $.toasts.append(el); while ($.toasts.children.length > 4) $.toasts.firstChild.remove(); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, kind === 'unlock' || kind === 'epic' || kind === 'warn' ? 5200 : 3200); if (kind === 'unlock') playSfx('unlock'); else if (kind === 'ach' || kind === 'epic') playSfx('milestone'); }
  bus.on('toast', toastEl);
  bus.on('unlock', () => { refreshNav(true); });
  bus.on('fx', (e) => {
    if (e.k === 'wave') { const kind = e.c; if (kind === 'elite') banner(null, 'Elite wave', 'Marked enemies carry a modifier and better loot', 'var(--violet)', 1600); else if (kind === 'challenge') banner('Challenge wave', e.b, G.world.wave.info.mod?.desc, 'var(--amber)', 2000); else if (kind === 'resource') banner(null, 'Salvage convoy', 'Haulers are unarmed and full of loot', '#ffd700', 1800); else if (kind === 'swarm') banner(null, 'Swarm', null, '#ff9bd2', 1300); }
    else if (e.k === 'sector') banner('Sector ' + (e.a + 1), e.b, e.c, 'var(--cyan)', 3600);
    else if (e.k === 'bossIntro') banner(e.b, e.a, null, typeof e.c === 'number' ? '#' + e.c.toString(16).padStart(6, '0') : e.c, 2600);
    else if (e.k === 'hurt') { $.vig.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => $.vig.classList.remove('on'))); }
  });
  bus.on('bought', (kind, id, info) => { if (info?.milestone) { playSfx('milestone'); const d = UPGRADES.find((u) => u.id === id); banner('Milestone', d ? d.name + ' LV ' + info.after : 'Milestone', null, 'var(--amber)', 1300); hooks.celebrate('#ffb547'); } if (info?.evo) { playSfx('unlock'); banner('Weapon evolved', info.evo.name, info.evo.desc, 'var(--cyan)', 2600); hooks.celebrate('#5ee6ff'); } if (info?.unlock) { playSfx('unlock'); hooks.celebrate('#5ee6ff'); } });
  bus.on('rewindFx', () => { playSfx('rewind'); $.flash.style.transition = 'opacity .6s ease-in'; $.flash.style.opacity = '1'; });
  const afterReset = (title, sub, color) => { toggle(null); $.flash.style.transition = 'opacity 1.4s ease-out'; $.flash.style.opacity = '0'; banner('Timeline reset', title, sub, color, 3800); abSig = ''; refreshNav(); };
  bus.on('rewind', (shards) => afterReset('+' + fmt(shards) + ' Chrono Shards', 'Spend them in the Shard tree. Everything you learned makes this run faster.', 'var(--violet)'));
  bus.on('ascend', (sig) => afterReset('+' + sig + ' Stellar Sigils', 'Above the timeline, everything is permanent.', '#ffffff'));
  bus.on('bossDied', (w, boss) => { if (!boss.boss.def.mini) banner('Sector boss destroyed', boss.boss.def.name, null, 'var(--green)', 2600); });
  bus.on('bossRewardReady', (report) => bossLootDialog(report));
  bus.on('passageLocked', () => banner('Route sealed', 'Lunar Graveyard', 'Build Lunar Passage with Ore, a Bar and a Boss Core', 'var(--amber)', 3600));
  bus.on('project', (id) => { if (id === 'passage') banner('Route open', 'Lunar Passage', 'The next sector is yours to explore', 'var(--cyan)', 3200); });
  bus.on('choice', () => { if (G.state.run.pendingChoice && !modalOpen() && performance.now() - lastTouch < 20000 && !(G.sheet.f('f.autoBoon') > 0 && G.state.auto.boonTag !== 'ask')) showChoice(); });
  bus.on('grantModule', () => playSfx('loot'));

  // ---------- per-frame-ish updates ----------
  const curEls = {};
  function updateCurrencies() {
    const st = G.state, u = st.unlocks;
    const show = { credits: true, scrap: !!u.arsenal, data: !!u.research, cores: st.cur.cores.gt(0) || !!u.modules, matter: st.cur.matter.gt(0), shards: st.cur.shards.gt(0) || st.prestige.count > 0, frags: st.cur.frags.gt(0), sigils: st.cur.sigils.gt(0) || st.asc.count > 0 };
    const mats = MATERIAL_TIERS.filter((m) => !!st.materials.discoveredOres?.[m.id]);
    const matSig = mats.map((m) => m.id + ':' + (st.cur[m.barCur].gt(0) || Big.from(st.materials.lifetimeBarsBy?.[m.id] || 0).gt(0) ? 1 : 0)).join(',');
    const s = Object.keys(show).filter((k) => show[k]).join() + '|m:' + matSig;
    if (s !== curSig) {
      curSig = s; clear($.curs);
      const addNormal = (k) => { const v = h('span'), d = CUR[k], el = h('button.cur', { 'aria-label': d.name + ': ' + d.hint, title: d.hint, onclick: () => bus.emit('toast', d.name + ': ' + d.hint, 'info') }, gameIcon('currency', k, 'currency-pixel', d.icon), v); curEls[k] = { el, v }; $.curs.append(el); };
      if (show.credits) addNormal('credits');
      for (const m of mats) {
        const v = h('span'), b = h('span'), icon = materialIcon(m, 'ore'), bars = h('small.material-bar-count', materialIcon(m, 'bar'), b);
        const tip = () => `${m.name}: ${fmt(st.cur[m.oreCur])} Ore${st.cur[m.barCur].gt(0) || Big.from(st.materials.lifetimeBarsBy?.[m.id] || 0).gt(0) ? ` · ${fmt(st.cur[m.barCur])} Bars` : ''}. ${m.orePerBar} Ore → 1 Bar.`;
        const el = h('button.cur.mat-cur', { 'aria-label': m.name + ' material', title: m.name, style: `--mat:${m.color}`, onclick: () => bus.emit('toast', tip(), 'info') }, icon, v, bars);
        curEls['mat:' + m.id] = { el, v, b, bars, m }; $.curs.append(el);
      }
      for (const k in show) if (k !== 'credits' && show[k]) addNormal(k);
      setTimeout(measure, 0);
    }
    for (const k in show) if (show[k]) setText(curEls[k].v, fmt(st.cur[k]));
    for (const m of mats) { const x = curEls['mat:' + m.id], barSeen = st.cur[m.barCur].gt(0) || Big.from(st.materials.lifetimeBarsBy?.[m.id] || 0).gt(0); setText(x.v, fmt(st.cur[m.oreCur])); setText(x.b, fmt(st.cur[m.barCur])); x.bars.hidden = !barSeen; x.el.setAttribute('aria-label', `${m.name}: ${fmt(st.cur[m.oreCur])} Ore${barSeen ? `, ${fmt(st.cur[m.barCur])} Bars` : ''}`); }
  }
  let buffSig = '';
  function updateBuffStack() {
    const items = statusEffectItems(G.state, G.world);
    const sig = items.map((x) => `${x.id}:${x.value}`).join('|');
    if (sig === buffSig) return; buffSig = sig; clear($.buffs);
    for (const x of items) {
      const boon = x.kind === 'boon';
      const chip = h((boon ? 'button' : 'div') + '.buff-chip.' + x.kind, { style: '--buff-accent:' + x.color, type: boon ? 'button' : null, title: x.detail || x.name, 'aria-label': `${x.name}${x.value ? ', ' + x.value : ''}. ${x.detail || ''}${boon ? ' Tap for details.' : ''}`, onclick: boon ? () => {
        const b = BOON_BY_ID[x.artId], count = G.state.run.boons[x.artId] || 0;
        if (!b) return;
        clear($.boonInfo).append(h('div.boon-info-head', gameIcon('boon', b.id, 'boon-info-art', x.icon), h('div', h('b', b.name), h('small', `${count} ${count === 1 ? 'STACK' : 'STACKS'} · ${b.tag.toUpperCase()}`)), h('button.boon-info-close', { type: 'button', 'aria-label': 'Close boon details', onclick: () => { $.boonInfo.hidden = true; chip.focus(); } }, '✕')), h('p', b.desc), h('small.boon-info-foot', 'Effect per stack · lasts until Rewind'));
        $.boonInfo.hidden = false;
        const box = chip.getBoundingClientRect(), app = root.getBoundingClientRect();
        $.boonInfo.style.top = Math.min(Math.max(8, box.top - app.top), Math.max(8, app.height - $.boonInfo.offsetHeight - 8)) + 'px';
      } : null },
        h('span.buff-icon', x.artKind ? gameIcon(x.artKind, x.artId, 'buff-pixel', x.icon || '◆') : x.icon), h('span.buff-copy', h('b', x.name), h('small', x.value || '')));
      $.buffs.append(chip);
    }
    $.buffs.hidden = !items.length;
    requestAnimationFrame(() => $.buffs.classList.toggle('scrollable', $.buffs.scrollHeight > $.buffs.clientHeight + 2));
  }

  let slowT = 0, objectiveId = '', objectiveSig = '';
  function hideTutorialSpotlight() { $.guideSpot.classList.remove('on'); $.guideCard.classList.remove('on', 'above', 'below'); }
  function positionTutorialSpotlight(target, o) {
    if (!target || !o?.spotlight || !target.isConnected) { hideTutorialSpotlight(); return; }
    const rr = root.getBoundingClientRect(), tr = target.getBoundingClientRect();
    if (tr.bottom < rr.top || tr.top > rr.bottom || tr.right < rr.left || tr.left > rr.right) { hideTutorialSpotlight(); return; }
    const pad = 5, left = Math.max(5, tr.left - rr.left - pad), top = Math.max(5, tr.top - rr.top - pad);
    const width = Math.min(rr.width - left - 5, tr.width + pad * 2), height = Math.min(rr.height - top - 5, tr.height + pad * 2);
    Object.assign($.guideSpot.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' });
    setText($.guideK, o.kicker || 'Command briefing'); setText($.guideTitle, o.title || ''); setText($.guideText, o.text || ''); setText($.guideHint, o.hint || '');
    $.guideSpot.classList.add('on'); $.guideCard.classList.add('on');
    $.guideCard.classList.remove('above', 'below'); $.guideCard.style.width = Math.min(330, rr.width - 20) + 'px';
    const cw = $.guideCard.offsetWidth || Math.min(330, rr.width - 20), ch = $.guideCard.offsetHeight || 120;
    const cx = Math.max(10, Math.min(rr.width - cw - 10, tr.left - rr.left + tr.width / 2 - cw / 2));
    const above = tr.top - rr.top > ch + 24;
    const cy = above ? Math.max(10, tr.top - rr.top - ch - 16) : Math.min(rr.height - ch - 10, tr.bottom - rr.top + 16);
    $.guideCard.style.left = cx + 'px'; $.guideCard.style.top = Math.max(10, cy) + 'px'; $.guideCard.classList.add(above ? 'above' : 'below');
  }
  function updateObjective() {
    const o = onboardingObjective({ panel: open }); objectiveId = o?.id || '';
    const sig = o ? [o.id, o.title, o.text, o.hint, o.targetNav, o.targetUpgrade, o.spotlight].join('|') : ''; if (sig !== objectiveSig) { objectiveSig = sig; setTimeout(measure, 0); }
    // Event-driven onboarding: no persistent banner. Most steps use a subtle control glow;
    // high-value first-run lessons can opt into a reusable anchored spotlight.
    setClass($.objective, 'on', false);
    for (const k in $.navBtns) setClass($.navBtns[k], 'guide', !!o && o.targetNav === k);
    for (const a of abBtns) setClass(a.b, 'guide', !!o && o.target === 'ability');
    let target = null;
    if (o?.targetUpgrade && open === 'upgrades') target = panels.upgrades?.guideTarget?.(o.targetUpgrade);
    if (!target && o?.targetNav) target = $.navBtns[o.targetNav];
    positionTutorialSpotlight(target, o);
  }
  function maybeShowSystemBriefing() {
    if (modalOpen()) return;
    const st = G.state, trainingInactive = !st.onboarding?.enabled || st.onboarding.completed;
    if (!trainingInactive) return;
    st.seen ||= {};
    if (st.unlocks.abilities && !st.seen.energyBriefingV1) {
      st.seen.energyBriefingV1 = 1;
      onboardingDialog({ kicker: 'Reactor reserve online', title: 'Energy powers sustained abilities', text: 'Energy is the regenerating combat reserve beneath your hull. Overdrive doubles fire rate and uses up to 10 Energy per second to make its duration drain 50% slower.', hint: 'At 0 Energy, Overdrive does not shut off: it continues at normal duration drain. Energy regenerates automatically, and grazing enemy fire restores extra Energy.', okLabel: 'Understood' });
      return;
    }
    if (st.unlocks.drones && !st.seen.droneBriefingV1) {
      st.seen.droneBriefingV1 = 1;
      onboardingDialog({ kicker: 'Autonomous support online', title: 'Drone bays unlocked', text: 'Choose a specialist in Arsenal → Drones: the Mining Drone extracts extra Ore, while the Target Painter marks enemies for extra damage. Only one specialist can be fitted at a time; Scrap improves either drone.', hint: 'Ship Loadout lets you choose its bay. You can swap specialists whenever your build changes.', okLabel: 'Show Drones' }, () => { if (open !== 'arsenal') toggle('arsenal'); panels.arsenal?.goto?.('drones'); });
      return;
    }
    if ((st.stats.bestWave || 1) >= 30 && !st.projects?.completed?.passage && !st.seen.passageBriefingV1) {
      st.seen.passageBriefingV1 = 1;
      onboardingDialog({ kicker: 'New route charted', title: 'Build the Lunar Passage', text: 'The Outer Orbit ends at Wave 40. To cross into the Lunar Graveyard, secure its boss and build a transit beacon with 40 Palladium Ore, one Iridium Bar and one Boss Core.', hint: 'A small route tracker now sits beneath your resources. Tap it to see construction progress. Hold mode mines whichever discovered ore you select in Smelting.', okLabel: 'View route' }, () => { if (open !== 'menu') toggle('menu'); panels.menu?.goto?.('projects'); });
    }
  }
  function followOnboardingAction(action) {
    if (!action?.panel) return;
    onboardingRouteHoldUntil = performance.now() + 800;
    if (open !== action.panel) toggle(action.panel);
    if (action.screen) panels[action.panel]?.goto?.(action.screen);
    updateObjective();
    setTimeout(() => measure(true), 0);
  }
  function maybeShowOnboardingBriefing() {
    if (modalOpen() || performance.now() < onboardingRouteHoldUntil) return;
    const spec = onboardingBriefing({ panel: open });
    if (!spec) { maybeShowSystemBriefing(); return; }
    onboardingDialog(spec, () => {
      acknowledgeOnboarding(spec.key);
      followOnboardingAction(spec.action);
      updateObjective();
      setTimeout(maybeShowOnboardingBriefing, 0);
    });
  }
  function update(dt) {
    const st = G.state, w = G.world, run = st.run, p = w.player, sec = sectorOf(run.wave);
    maybeShowOnboardingBriefing();
    setText($.waveN, String(run.wave)); setText($.sector, sec.def.name); setWidth($.secI, (sec.n - 1) / sec.len);
    const xp = xpProgress(run.xp || 0); setText($.xpN, `LV ${xp.level}`); setWidth($.xpI, xp.fraction); $.level.setAttribute('aria-label', `Ship Level ${xp.level}. ${xp.current} of ${xp.needed} XP toward next level.`); $.level.title = `${xp.current}/${xp.needed} XP`;
    const passage = PROJECTS.find((p) => p.id === 'passage'), routeVisible = (st.stats.bestWave || 1) >= passage.wave && !st.projects?.completed?.passage && !run.challenge;
    $.route.style.display = routeVisible ? '' : 'none';
    if (routeVisible) {
      const costs = passage.costs, ready = costs.filter(([cur, n]) => st.cur[cur].gte(n)).length;
      const detail = costs.map(([cur, n]) => `${CUR[cur]?.name || cur} ${fmt(st.cur[cur])}/${n}`).join(' · ');
      setText($.routeText, ready === costs.length ? 'LUNAR PASSAGE · READY' : `LUNAR PASSAGE · ${ready}/${costs.length}`);
      setWidth($.routeMeter, ready / costs.length); $.route.classList.toggle('ready', ready === costs.length);
      $.route.title = detail; $.route.setAttribute('aria-label', `Lunar Passage: ${detail}. Tap to open Ship Projects.`);
    }
    const kind = w.wave.info?.kind, tagTxt = kind === 'boss' ? 'Boss' : kind === 'mini' ? 'Mini boss' : kind === 'elite' ? 'Elite' : kind === 'challenge' ? w.wave.info.mod.name : kind === 'resource' ? 'Convoy' : kind === 'swarm' ? 'Swarm' : ''; setText($.tag, tagTxt); $.tag.className = 'wave-tag' + (tagTxt ? ' on' : '') + (kind === 'boss' || kind === 'mini' ? ' boss' : kind === 'elite' ? ' elite' : kind === 'resource' ? ' resource' : '');
    const showFarm = run.farm || (st.stats.bestWave || 1) >= 2 || (st.stats.deaths || 0) > 0; $.farm.style.display = showFarm ? '' : 'none'; if (showFarm) {
      setText($.farm, run.farm ? '▮▮ Hold' : '▲ Push'); $.farm.className = 'hbtn ' + (run.farm ? 'hold' : 'push');
      const selectedOre = MATERIAL_TIERS.find((m) => m.id === st.materials.selected);
      const farmTip = run.farm ? `Holding: repeat Wave ${w.wave.clearedNum || run.wave} and mine ${selectedOre?.name || 'selected'} Ore. Change ore in Menu → Smelting. Tap to Push forward.` : 'Pushing: advance to the next wave after each clear. Tap to Hold and mine the selected discovered ore.';
      $.farm.setAttribute('aria-label', farmTip); $.farm.title = farmTip;
    }
    const inter = w.wave.state === 'cleared' && w.wave.intermission;
    // If a wave ends while the player is already browsing, promote the existing tactical
    // panel into the safe Command Phase instead of letting the countdown expire behind it.
    if (inter && open && !w.wave.intermissionPaused) pauseIntermission(true);
    const command = inter && w.wave.intermissionPaused && !!open; setClass($.intermission, 'on', inter); setClass($.commandBar, 'on', command);
    if (root.classList.contains('command-phase') !== command) { syncManagementLayout(); setTimeout(() => measure(true), 0); }
    if (inter) {
      const cleared = w.wave.clearedNum || w.wave.num, paused = w.wave.intermissionPaused, sectorBoss = w.wave.info?.kind === 'boss';
      setText($.interK, sectorBoss ? 'Sector secured' : `Wave ${cleared} cleared`);
      setText($.interTitle, paused ? 'Next wave paused' : `Next wave in ${Math.max(1, Math.ceil(w.wave.timer))}`);
      setText($.interMode, run.farm ? `▮▮ HOLD · repeat Wave ${cleared}` : `▲ PUSH · advance to Wave ${run.wave}`);
      setText($.interStart, run.farm ? `Repeat Wave ${cleared}` : `Start Wave ${run.wave}`);
      setText($.interShop, paused ? 'Resume countdown' : 'Pause & shop');
      if (command) {
        const next = genWave(run.seed, run.wave, { bossRush: !!w.rules?.bossRush });
        const threat = next.kind === 'boss' ? `Sector boss · ${next.label}` : next.kind === 'mini' ? `Mini boss · ${next.label}` : next.kind === 'elite' ? 'Elite formation' : next.kind === 'resource' ? 'Salvage convoy' : next.kind === 'challenge' ? `Challenge · ${next.mod?.name || next.label}` : next.kind === 'swarm' ? 'Swarm formation' : 'Standard formation';
        setText($.commandTitle, run.farm ? `Holding at Wave ${cleared}` : `Prepare for Wave ${run.wave}`);
        setText($.commandNext, run.farm ? `Repeat cleared formation · ${threat}` : `Next contact: ${threat}`);
        setText($.commandStart, run.farm ? `Repeat Wave ${cleared}` : `Start Wave ${run.wave}`);
      }
    }
    $.choice.style.display = run.pendingChoice ? '' : 'none';
    updateCurrencies();
    const foundry = st.foundry, recipe = RECIPES.find((r) => r.id === foundry.equipped);
    if ($.supply.hidden !== !st.unlocks.foundry) { $.supply.hidden = !st.unlocks.foundry; setTimeout(measure, 0); }
    if (st.unlocks.foundry) { const ready = supplyReady(), active = foundry.equipped === 'burst' && w.foundryBurst > 0; setClass($.supply, 'ready', ready); if ($.supply._iconId !== recipe.id) { $.supply._iconId = recipe.id; clear($.supplyIcon).append(gameIcon('support', recipe.id, 'supply-pixel', recipe.icon)); } setText($.supplyText, active ? `Overclock · ${Math.ceil(w.foundryBurst)}s` : `${recipe.name} ×${foundry.stock[recipe.id]} · ${ready ? 'Deploy [Q]' : 'Foundry ›'}`); $.supply.setAttribute('aria-label', ready ? `Deploy ${recipe.name}. ${foundry.stock[recipe.id]} available. Shortcut Q.` : 'Open Orbital Foundry'); }
    // boss bar
    const b = w.wave.boss; if (b && b.alive) { $.boss.classList.add('on'); const bossDef = b.boss?.def || {}; setText($.bossName, bossDef.name || 'Boss'); const bossMeta = []; if (typeof bossDef.title === 'string' && bossDef.title.trim()) bossMeta.push(bossDef.title.trim()); if (b.boss.phase > 0) bossMeta.push('phase ' + (b.boss.phase + 1)); setText($.bossTitle, bossMeta.join(' · ')); setWidth($.bossI, b.hp); setClass($.bossHp, 'weak', b.weakOpen); const shielded = b.boss.parts.some((x) => x.alive && x.part.shieldsParent); setText($.bossNote, b.boss.enter > 0 ? '' : shielded ? 'Shielded: destroy the generators' : b.weakOpen ? 'Weak point exposed: aim for the core' : b.boss.enraged ? 'Enraged' : b.armour > 0.5 && b.boss.parts.some((x) => x.alive) ? 'Armoured: break the plating' : ''); if (!$.boss._m) { $.boss._m = 1; setTimeout(measure, 0); } } else if ($.boss._m) { $.boss.classList.remove('on'); $.boss._m = 0; setTimeout(measure, 0); }
    // status
    setWidth($.hullI, p.alive ? p.hull : 0); setClass($.hull, 'low', p.hull < 0.3); $.shield.style.display = w.base.hasShield ? '' : 'none'; setWidth($.shieldI, p.shield); const cap = G.sheet.n('energyCap'); $.energy.style.display = st.unlocks.abilities ? '' : 'none'; setWidth($.energyI, p.energy / cap); const energyLabel = `Energy ${Math.floor(p.energy)}/${Math.floor(cap)}. Regenerates automatically; Overdrive consumes up to 10 per second to extend its duration.`; $.energy.title = energyLabel; $.energy.setAttribute('aria-label', energyLabel);
    const mult = (1 + p.focus) * (1 + p.combo); if (mult > 1.01) { const k = '×' + mult.toFixed(2); if ($.combo._k !== k) { $.combo._k = k; clear($.combo).append(k, h('small', p.focus > 0.01 && p.combo > 0.01 ? 'focus + streak' : p.focus > 0.01 ? 'focus' : 'streak')); } } else if ($.combo._k) { $.combo._k = ''; clear($.combo); }
    for (const a of abBtns) { const max = abilityMaxCharges(), ch = w.abil.charges[a.id] ?? max, cd = w.abil.cd[a.id] || 0, total = abilityCooldown(a.id), live = (w.abil.active[a.id] || 0) > 0 || (a.id === 'slow' && w.slowT > 0) || (a.id === 'charge' && w.chargeShots > 0); setClass(a.b, 'ready', ch > 0); setClass(a.b, 'live', live); a.cd.style.height = ch > 0 ? '0%' : Math.min(100, (cd / total) * 100) + '%'; setText(a.t, ch >= max ? '' : Math.ceil(cd) + 's'); setText(a.ch, max > 1 ? String(ch) : ''); setText(a.au, G.sheet.f('f.autoAbility') > 0 && (st.auto.ability[a.id] || 'never') !== 'never' ? 'AUTO' : ''); }
    if (G.hintOn !== undefined) setClass($.hint, 'on', G.hintOn && objectiveId !== 'controls');
    slowT += dt; if (slowT < 0.2) return; slowT = 0;
    // slow lane (5 Hz)
    buildAbilities(); updateBuffStack(); updateObjective(); setClass($.scan, 'off', !st.settings.scanlines);
    const html = `DPS <b>${fmt(w.dps)}</b> · <b>${fmt(w.income)}</b> ¢/s${st.unlocks.abilities ? ` · ENERGY <b>${Math.floor(p.energy)}/${Math.floor(G.sheet.n('energyCap'))}</b>` : ''}`; if ($.meters._h !== html) { $.meters._h = html; $.meters.innerHTML = html; }
    if (open && panels[open]) panels[open].update();
    const N = $.navBtns; setClass(N.upgrades, 'can', open !== 'upgrades' && UPGRADES.some((d) => upgradeVisible(d) && !upgradeOwnedFree(d) && upgradeLevel(d.id) < (d.max || Infinity) && st.cur.credits.gte(upgradeQuote(d, 1).cost.mul(3))));
    setClass(N.research, 'can', open !== 'research' && treeAffordable('research')); setClass(N.skills, 'can', open !== 'skills' && !!st.unlocks.skills && skillPoints() > 0); setClass(N.rewind, 'can', open !== 'rewind' && ((canRewind() && shardPreview().gte(st.prestige.total.max(3))) || treeAffordable('prestige'))); setClass(N.menu, 'can', open !== 'menu' && menuAttention()); setClass(N.modules, 'can', open !== 'modules' && st.modules.inv.some((m) => m.isNew));
  }
  refreshNav(); updateObjective(); measure(); addEventListener('resize', () => measure());
  return { update, toggle, refreshNav, banner, measure, isOpen: () => open, reset() { for (const k in panels) { panels[k]?.destroy?.(); delete panels[k]; } if (open) { const o = open; open = null; toggle(o); } abSig = ''; curSig = ''; refreshNav(); } };
}
