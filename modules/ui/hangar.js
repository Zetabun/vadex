// The Hangar: everything between sorties. Launch, Workshop (permanent upgrades), Armory (weapons & abilities),
// Ships (with paint jobs) and Career (pilot rank track and contracts). The 3D ship idles in the close-up camera above the panel.
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { fmt, fmtInt, fmtTime } from '@last-orbit/core/format.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { SHIPS, SHIP_BY_ID } from '@last-orbit/data/ships.js';
import { CONTRACTS } from '@last-orbit/data/contracts.js';
import { WEAPONS, WEAPON_ORDER } from '@last-orbit/data/weapons.js';
import { ABILITIES, ABILITY_ORDER } from '@last-orbit/data/abilities.js';
import { SECTORS } from '@last-orbit/data/sectors.js';
import { PAINTS, MAX_RANK, rankNeed, rankReward, rankTitle, paintRank, MAX_MASTERY, masteryNeed, MASTERY_PERKS } from '@last-orbit/data/career.js';
import { THREATS, MAX_THREAT, THREAT_UNLOCK_SECTOR, threatSalvage, threatPilotXp } from '@last-orbit/data/threat.js';
import { dailyBonus } from '@last-orbit/data/daily.js';
import { workshopLevel, workshopNext, buyWorkshop, shipStatus, shipContract, buyShip, selectShip, contractProgress, nextContracts, unlockLabel, pilotProgress, selectPaint, threatMax, setThreat, dailyToday, masteryOf, masteryProgress } from '@last-orbit/progression/meta.js';
import { weaponDps, buildWeapon } from '@last-orbit/progression/stats.js';
import { playSfx } from '@last-orbit/audio/audio.js';
import { h, clear, setText, setClass } from '@last-orbit/ui/dom.js';
import { uiIcon } from '@last-orbit/ui/icons.js';
import { art } from '@last-orbit/ui/art.js';

const TABS = [['launch', 'Launch'], ['missions', 'Missions'], ['workshop', 'Workshop'], ['armory', 'Armory'], ['ships', 'Ships'], ['contracts', 'Career']];
const PER_PAGE = 4; // with more tabs than fit, the bar pages with chevrons
const pageOf = (id) => Math.floor(TABS.findIndex((t) => t[0] === id) / PER_PAGE);
const roman = (t) => (t ? THREATS[t].roman : '0');
const untilMidnight = () => { const n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); const s = Math.max(0, (m - n) / 1000); return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`; };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const unlockedBy = (kind, id) => CONTRACTS.find((c) => c.unlock?.[kind] === id);

export function createHangar(hooks) {
  const $ = {}; let tab = 'launch';
  $.salvage = h('span');
  const top = h('header.hg-top',
    h('div.brand', h('b', 'LAST ORBIT'), h('small', 'Orbital defence')),
    h('div.chip.salvage.big', { title: 'Salvage: spend it in the Workshop and on new ships' }, art('cur:salvage', 'cur-ico'), $.salvage),
    h('button.icon-btn', { 'aria-label': 'Settings', onclick: () => hooks.settings() }, uiIcon('gear')));
  $.body = h('main.hg-body');
  $.nav = h('nav.hg-nav', { role: 'tablist' });
  const navBtns = {}; let page = 0;
  for (const [id, name] of TABS) navBtns[id] = h('button.nav-btn', { role: 'tab', onclick: () => show(id) }, uiIcon(id === 'launch' ? 'launch' : id), h('span', name), h('i.badge'));
  const pages = Math.ceil(TABS.length / PER_PAGE);
  $.next = h('button.nav-btn.nav-page', { 'aria-label': 'More menus', onclick: () => turn(1) }, uiIcon('chevron'), h('span', 'More'), h('i.badge'));
  $.prev = h('button.nav-btn.nav-page', { 'aria-label': 'Back to main menus', onclick: () => turn(-1) }, uiIcon('back'), h('span', 'Back'), h('i.badge'));
  function layoutNav() {
    clear($.nav); const ids = TABS.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).map((t) => t[0]);
    if (page > 0) $.nav.append($.prev);
    for (const id of ids) $.nav.append(navBtns[id]);
    if (page < pages - 1) $.nav.append($.next);
    while ($.nav.children.length < PER_PAGE + 1) $.nav.append(h('span.nav-gap'));
  }
  function turn(d) { page = Math.max(0, Math.min(pages - 1, page + d)); playSfx('tab'); layoutNav(); badges(); }
  const el = h('div#hangar', top, $.body, $.nav);

  function show(id, quiet) {
    if (!quiet && id !== tab) playSfx('tab');
    tab = id; if (pageOf(id) !== page) { page = pageOf(id); layoutNav(); }
    for (const k in navBtns) { setClass(navBtns[k], 'on', k === id); navBtns[k].setAttribute('aria-selected', String(k === id)); }
    el.dataset.tab = id; render(); hooks.measure?.();
  }
  function render() {
    clear($.body); $.body.scrollTop = 0;
    const view = { launch: launchView, missions: missionsView, workshop: workshopView, armory: armoryView, ships: shipsView, contracts: contractsView }[tab]();
    $.body.append(view);
  }

  // ------------------------------------------------------------ launch
  function launchView() {
    const st = G.state, ship = SHIP_BY_ID[st.ship], s = st.stats, next = nextContracts(st.stats.sorties ? 2 : 1);
    const best = s.bestWave || 0, bestSector = Math.min(SECTORS.length, s.bestSector || 1);
    const fresh = !s.sorties;
    const card = h('section.launch-card',
      h('div.ship-head', h('div', h('div.kicker', ship.role), h('h1', ship.name)), h('button.link', { onclick: () => show('ships') }, 'Change ship', uiIcon('chevron'))),
      rankStrip(),
      opsRow(),
      fresh ? h('p.lede', 'Invaders are descending on the last orbit. Fly a sortie, level up mid-fight by picking upgrades, and bring salvage home to build a better ship.')
        : h('div.stat-row', stat('Best wave', best || '—'), stat('Furthest', 'Sector ' + bestSector), stat('Sorties', fmtInt(s.sorties))),
      next.length ? h('div.next', h('div.kicker', next.length > 1 ? 'Next contracts' : 'Next contract'), next.map((c) => contractLine(c, true))) : null);
    const go = h('div.launch-dock', h('button.launch-btn', { onclick: () => hooks.launch() }, uiIcon('launch'), h('span', 'Launch sortie'), h('small', ship.name + ' · ' + WEAPONS[ship.weapon].name + ' · ' + ABILITIES[ship.ability].name)));
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
    return items.length ? h('div.ops', items) : null;
  }
  function rewardBadge(r) {
    const rw = rankReward(r);
    return rw.paint ? h('span.reward.paint', swatch(rw.paint), PAINTS.find((p) => p.id === rw.paint).name + ' paint') : h('span.reward', art('cur:salvage', 'cur-ico'), fmtInt(rw.salvage));
  }
  function rankStrip() {
    const p = G.state.pilot, max = p.rank >= MAX_RANK;
    return h('button.rank-strip', { onclick: () => show('contracts') },
      h('div.rank-badge', h('small', 'Rank'), h('b', String(p.rank))),
      h('div.rank-main', h('div.rank-line', h('b', rankTitle(p.rank)), max ? h('span', 'Max rank') : h('span', 'Next ', rewardBadge(p.rank + 1))),
        h('div.meter.rank', h('i', { style: `width:${(pilotProgress() * 100).toFixed(1)}%` }))));
  }
  function swatch(id) {
    const pt = PAINTS.find((x) => x.id === id), ship = SHIP_BY_ID[G.state.ship];
    const trim = hex(pt.trim ?? ship.trim), hull = hex(pt.hull ?? 0x718996);
    return h('i.swatch', { style: `background:linear-gradient(135deg,${hull} 0 50%,${trim} 50% 100%)` });
  }
  function history() {
    const H = G.state.history; if (!H.length) return null;
    return h('section.panel.history', h('div.kicker', 'Recent sorties'), H.slice(0, 4).map((r) => h('div.hist', h('b', 'Wave ' + r.wave), h('span', `LV ${r.level} · ${SHIP_BY_ID[r.ship]?.name || ''} · ${fmtTime(r.time)}`), h('span.gold', art('cur:salvage', 'cur-ico'), fmtInt(r.salvage)))));
  }
  function contractLine(c, compact) {
    const pr = contractProgress(c);
    return h('div.contract' + (pr.done ? '.done' : '') + (compact ? '.compact' : ''),
      h('div.c-main', h('div.c-title', pr.done ? uiIcon('check') : null, h('b', c.name), h('span.gold', art('cur:salvage', 'cur-ico'), fmtInt(c.salvage))), h('div.c-desc', c.desc),
        c.unlock ? h('div.c-unlock', 'Unlocks ' + unlockLabel(c.unlock)) : null,
        pr.done ? null : h('div.meter.small', h('i', { style: `width:${(pr.frac * 100).toFixed(1)}%` }))),
      pr.done ? null : h('div.c-count', `${fmtInt(pr.cur)}/${fmtInt(pr.goal)}`));
  }

  // ------------------------------------------------------------ workshop
  function workshopView() {
    const list = h('div.rows');
    for (const u of WORKSHOP) {
      const lvl = workshopLevel(u.id), cost = workshopNext(u.id), pips = h('div.lvl-pips');
      for (let i = 0; i < u.max; i++) pips.append(h('i' + (i < lvl ? '.on' : '')));
      const btn = h('button.buy', { disabled: cost == null || G.state.salvage < cost, onclick: () => { if (buyWorkshop(u.id)) { playSfx('buy'); render(); hooks.flash?.('#ffc857'); } else playSfx('deny'); } },
        cost == null ? 'MAX' : [art('cur:salvage', 'cur-ico'), fmt(cost)]);
      list.append(h('div.row' + (cost == null ? '.maxed' : ''), art('ws:' + u.id, 'row-icon'), h('div.row-main', h('div.row-title', h('b', u.name), h('span.lv', `${lvl}/${u.max}`)), h('div.row-desc', u.per + ' per level'), pips), btn));
    }
    return h('div.screen', h('div.screen-head', h('h2', 'Workshop'), h('p', 'Permanent upgrades. They apply to every ship on every sortie.')), list);
  }

  // ------------------------------------------------------------ armory
  function armoryView() {
    const st = G.state, weapons = h('div.grid'), abilities = h('div.grid');
    for (const id of WEAPON_ORDER) {
      const d = WEAPONS[id], open = !!st.unlocked.weapons[id], c = unlockedBy('weapon', id);
      const dps = open ? weaponDps(buildWeapon(id, 1, G.sheet)) : null;
      weapons.append(h('details.item' + (open ? '' : '.locked'), { style: `--c:${hex(d.color)}` },
        h('summary', art('weapon:' + id, 'item-icon'), h('div.item-main', h('b', d.name), h('small', open ? d.arch + ' · ' + fmt(dps) + ' DPS at rank 1' : c ? 'Contract: ' + c.name : 'Locked')), open ? uiIcon('chevron') : uiIcon('lock')),
        h('div.item-body', h('p', d.desc), open ? h('ol.evos', d.evo.map((e, i) => h('li', h('span.r', 'R' + (i + 2)), h('b', e.name), h('span', e.desc)))) : c ? h('p.muted', `${c.desc}. ${contractProgress(c).cur}/${c.goal}`) : null)));
    }
    for (const id of ABILITY_ORDER) {
      const d = ABILITIES[id], open = !!st.unlocked.abilities[id], c = unlockedBy('ability', id), ship = SHIPS.find((s) => s.ability === id);
      abilities.append(h('div.item.flat' + (open ? '' : '.locked'), { style: `--c:${d.color}` },
        art('ability:' + id, 'item-icon'), h('div.item-main', h('b', d.name), h('small', open ? d.desc : [ship ? `Always available on the ${ship.name}. ` : '', c ? `Contract “${c.name}”: ${c.desc}` : 'Locked'].join(''))), open ? null : uiIcon('lock')));
    }
    return h('div.screen', h('div.screen-head', h('h2', 'Armory'), h('p', 'Unlocked weapons and abilities can appear as cards when you level up. Weapons evolve at every rank.')),
      h('h3', 'Weapons'), weapons, h('h3', 'Abilities'), abilities);
  }

  // ------------------------------------------------------------ ships
  function shipsView() {
    const st = G.state, list = h('div.ships');
    for (const s of SHIPS) {
      const status = shipStatus(s.id), sel = st.ship === s.id, c = shipContract(s.id);
      let action;
      if (status === 'owned') action = h('button.btn' + (sel ? '.ghost' : '.primary'), { disabled: sel, onclick: () => { selectShip(s.id); playSfx('tab'); render(); } }, sel ? 'Selected' : 'Select');
      else if (status === 'buyable') action = h('button.btn.gold', { disabled: st.salvage < s.cost, onclick: () => { if (buyShip(s.id)) { playSfx('unlock'); hooks.flash?.(hex(s.trim)); render(); } else playSfx('deny'); } }, art('cur:salvage', 'cur-ico'), fmt(s.cost));
      else action = h('div.lock-note', uiIcon('lock'), h('span', c ? `Contract “${c.name}”: ${c.desc} (${contractProgress(c).cur}/${c.goal})` : 'Locked'));
      list.append(h('article.ship' + (sel ? '.sel' : '') + (status === 'locked' ? '.locked' : ''), { style: `--c:${hex(s.trim)}` },
        h('div.ship-top', h('div', h('div.kicker', s.role), h('h3', s.name)), art('ship:' + s.id, 'ship-icon')),
        h('p', s.desc),
        status === 'owned' ? masteryLine(s.id) : null,
        h('ul.perks', s.perks.map((p, i) => h('li' + (p.startsWith('−') ? '.neg' : ''), p)), h('li', 'Ability: ' + ABILITIES[s.ability].name)),
        action));
    }
    const paints = h('div.paints', PAINTS.map((pt) => {
      const owned = !!st.paints[pt.id], on = st.paint === pt.id;
      const how = pt.source === 'mastery' ? `${SHIP_BY_ID[pt.ship].name} mastery 10` : pt.source === 'contract' ? `Contract: ${CONTRACTS.find((c) => c.unlock?.paint === pt.id)?.name}` : `Pilot rank ${paintRank(pt.id)}`;
      const short = pt.source === 'mastery' ? 'Mastery 10' : pt.source === 'contract' ? 'Contract' : 'Rank ' + paintRank(pt.id);
      return h('button.paint' + (on ? '.on' : '') + (owned ? '' : '.locked'), { disabled: !owned, title: owned ? pt.name : `${pt.name}: ${how}`, onclick: () => { if (selectPaint(pt.id)) { playSfx('tab'); render(); } } }, swatch(pt.id), h('span', owned ? pt.name : short));
    }));
    return h('div.screen', h('div.screen-head', h('h2', 'Ships'), h('p', 'Each hull starts with its own gun and signature ability. Workshop upgrades apply to all of them.')),
      h('h3', 'Paint job'), paints, h('h3', 'Hulls'), list);
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
      d.done ? h('div.lock-note', uiIcon('check'), h('span', `Flown today: reached wave ${d.wave}. Next daily in ${untilMidnight()}.`))
        : h('button.btn.gold.daily-go', { onclick: () => hooks.launch({ daily: true }) }, uiIcon('launch'), 'Fly the daily'));
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
    return h('div.screen', h('div.screen-head', h('h2', 'Missions'), h('p', 'A fresh Daily Sortie every day, and Threat levels for when the sectors stop being scary.')),
      daily, h('h3', 'Threat level'), threat);
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
      h('section.panel.career', h('div.career-top', h('div.rank-badge.big', h('small', 'Rank'), h('b', String(p.rank))), h('div', h('h3', rankTitle(p.rank)), h('p', need ? `${fmtInt(p.xp)} / ${fmtInt(need)} pilot XP` : 'Maximum rank reached'))),
        h('div.meter.rank', h('i', { style: `width:${(pilotProgress() * 100).toFixed(1)}%` })), track),
      h('h3', `Contracts · ${done}/${CONTRACTS.length}`), h('div.rows', CONTRACTS.map((c) => contractLine(c, false))));
  }

  // ------------------------------------------------------------ live updates
  function badges() {
    const st = G.state, canBuy = WORKSHOP.some((u) => { const c = workshopNext(u.id); return c != null && st.salvage >= c; });
    const ship = SHIPS.some((s) => shipStatus(s.id) === 'buyable' && st.salvage >= s.cost);
    const daily = st.stats.sorties > 0 && !dailyToday().done;
    setClass(navBtns.workshop, 'badged', canBuy); setClass(navBtns.ships, 'badged', ship); setClass(navBtns.missions, 'badged', daily);
    const hidden = (p) => TABS.some(([id], i) => Math.floor(i / PER_PAGE) === p && navBtns[id].classList.contains('badged'));
    setClass($.next, 'badged', hidden(page + 1)); setClass($.prev, 'badged', page > 0 && hidden(page - 1));
  }
  function update() { setText($.salvage, fmtInt(G.state.salvage)); badges(); }
  bus.on('contract', () => { if (G.mode === 'hangar') render(); });
  layoutNav();
  return { el, top, nav: $.nav, show, render, update, get tab() { return tab; } };
}
