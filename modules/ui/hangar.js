// The Hangar: everything between sorties. Launch, Workshop (permanent upgrades), Armory (weapons & abilities),
// Ships (with paint jobs), Career (pilot rank track and contracts), Records (high scores) and Awards (achievements). The 3D ship idles in the close-up camera above the panel.
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
import { ACHIEVEMENTS, FEATS, TIERS, FEAT_XP } from '@last-orbit/data/achievements.js';
import { BANNERS, bannerReqLabel } from '@last-orbit/data/banners.js';
import { paintBanner } from '@last-orbit/rendering/bannerArt.js';
import { workshopLevel, workshopNext, buyWorkshop, shipStatus, shipContract, buyShip, selectShip, contractProgress, nextContracts, unlockLabel, pilotProgress, selectPaint, threatMax, setThreat, dailyToday, masteryOf, masteryProgress, medalProgress, medalTotal, medalDesc, bannerProgress, nextBanner, selectBanner } from '@last-orbit/progression/meta.js';
import { weaponDps, buildWeapon } from '@last-orbit/progression/stats.js';
import { playSfx } from '@last-orbit/audio/audio.js';
import { h, clear, setText, setClass } from '@last-orbit/ui/dom.js';
import { uiIcon } from '@last-orbit/ui/icons.js';
import { art } from '@last-orbit/ui/art.js';
import { insignia } from '@last-orbit/ui/insignia.js';
import { dailyShareText, shareText } from '@last-orbit/ui/share.js';
import { SYNERGIES } from '@last-orbit/data/synergies.js';
import { BAL } from '@last-orbit/data/balance.js';
import { MOD_BY_ID } from '@last-orbit/data/cards.js';
import { warpMax } from '@last-orbit/progression/run.js';
import { STAGES, COUNTER_UNLOCK_SECTOR } from '@last-orbit/data/counter.js';
import { ALIEN_TECH } from '@last-orbit/data/alientech.js';
import { techLevel, buyTech, powerRating } from '@last-orbit/progression/meta.js';
import { MUTATOR_BY_ID } from '@last-orbit/data/daily.js';

const TABS = [['launch', 'Launch'], ['missions', 'Missions'], ['workshop', 'Workshop'], ['armory', 'Armory'], ['ships', 'Ships'], ['contracts', 'Career'], ['records', 'Records'], ['awards', 'Awards']];
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
    if (id === 'awards') G.state.seen.medals = medalTotal().earned;
    if (id === 'records') G.state.seen.records = true;
    const changed = el.dataset.tab !== id; el.dataset.tab = id; render(changed || quiet); badges(); hooks.measure?.();
  }
  /** Rebuild the current tab. Re-renders after a purchase or a choice keep the scroll position, so rapid taps
   *  on a list (Workshop upgrades) stay on the row under the finger; switching tabs starts at the top. */
  function render(top = false) {
    const y = $.body.scrollTop; clear($.body);
    const view = { launch: launchView, missions: missionsView, workshop: workshopView, armory: armoryView, ships: shipsView, contracts: contractsView, records: recordsView, awards: awardsView }[tab]();
    $.body.append(view); $.body.scrollTop = top ? 0 : y;
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
      warpRow(),
      fresh ? h('p.lede', 'Invaders are descending on the last orbit. Fly a sortie, level up mid-fight by picking upgrades, and bring salvage home to build a better ship.')
        : h('button.stat-row.as-link', { onclick: () => show('records'), 'aria-label': 'Open records' }, stat('High score', s.bestScore ? fmt(s.bestScore) : '—'), stat('Best wave', best ? `${best} · S${bestSector}` : '—'), stat('Sorties', fmtInt(s.sorties))),
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
  function rankStrip() {
    const p = G.state.pilot, max = p.rank >= MAX_RANK;
    return h('button.rank-strip', { onclick: () => show('contracts') },
      insignia(p.rank, 'rank-ins'),
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
      const btn = h('button.buy', { disabled: cost == null || G.state.salvage < cost, onclick: () => { if (buyWorkshop(u.id)) { playSfx('buy'); render(); hooks.flash?.('#ffc857'); } else playSfx('deny'); } },
        cost == null ? 'MAX' : [art('cur:salvage', 'cur-ico'), fmt(cost)]);
      list.append(h('div.row' + (cost == null ? '.maxed' : ''), art('ws:' + u.id, 'row-icon'), h('div.row-main', h('div.row-title', h('b', u.name), h('span.lv', `${lvl}/${u.max}`)), h('div.row-desc', u.per + ' per level'), pips), btn));
    }
    const c = G.state.counter, tech = c.unlocked ? h('div.rows', ALIEN_TECH.map((u) => {
      const lvl = techLevel(u.id), maxed = lvl >= u.max, pips = h('div.lvl-pips'); for (let i = 0; i < u.max; i++) pips.append(h('i' + (i < lvl ? '.on' : '')));
      const btn = h('button.buy.tech', { disabled: maxed || c.cores < u.cost, onclick: () => { if (buyTech(u.id)) { playSfx('unlock'); render(); hooks.flash?.('#6dffc8'); } else playSfx('deny'); } }, maxed ? 'MAX' : [art('relic:r_quantum', 'cur-ico'), String(u.cost)]);
      return h('div.row.tech-row' + (maxed ? '.maxed' : ''), art(u.art, 'row-icon'), h('div.row-main', h('div.row-title', h('b', u.name), h('span.lv', `${lvl}/${u.max}`)), h('div.row-desc', u.per + ' per level'), pips), btn);
    })) : null;
    return h('div.screen', h('div.screen-head', h('h2', 'Workshop'), h('p', 'Permanent upgrades. They apply to every ship on every sortie.')), list,
      tech ? [h('h3.tech-h', 'Alien Tech', h('span', `${c.cores} cores`)), h('p.sub-note', 'Built from Alien Cores, which only Counterattack stars pay. Works in every mode.'), tech] : null);
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
      h('h3', 'Weapons'), weapons, h('h3', 'Abilities'), abilities, h('h3', 'Synergies'), h('p.sub-note', 'Every upgrade card belongs to a theme. Hold enough different cards of one theme in a sortie to switch on its bonus.'), syns);
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
        h('div.traits', h('div.trait', h('small', 'Trait'), h('b', s.passive.name), h('span', s.passive.desc)),
          h('div.trait' + ((masteryOf(s.id).level || 1) >= 5 ? '.on' : ''), h('small', 'Signature · mastery 5'), h('b', s.signature.name), h('span', `${WEAPONS[s.weapon].name} at rank 7: ${s.signature.desc}.`))),
        action));
    }
    const paints = h('div.paints', PAINTS.map((pt) => {
      const owned = !!st.paints[pt.id], on = st.paint === pt.id;
      const how = pt.source === 'counter' ? 'Clear Counterattack stage 6' : pt.source === 'mastery' ? `${SHIP_BY_ID[pt.ship].name} mastery 10` : pt.source === 'contract' ? `Contract: ${CONTRACTS.find((c) => c.unlock?.paint === pt.id)?.name}` : `Pilot rank ${paintRank(pt.id)}`;
      const short = pt.source === 'counter' ? 'Counterattack' : pt.source === 'mastery' ? 'Mastery 10' : pt.source === 'contract' ? 'Contract' : 'Rank ' + paintRank(pt.id);
      return h('button.paint' + (on ? '.on' : '') + (owned ? '' : '.locked'), { disabled: !owned, title: owned ? pt.name : `${pt.name}: ${how}`, onclick: () => { if (selectPaint(pt.id)) { playSfx('tab'); render(); } } }, swatch(pt.id), h('span', owned ? pt.name : short));
    }));
    const pick = (b) => {
      const owned = !!st.banners[b.id], on = (st.banner || 'none') === b.id, pr = bannerProgress(b), legend = b.rarity === 'legendary';
      return h('button.paint.banner-pick' + (on ? '.on' : '') + (owned ? '' : '.locked') + (legend ? '.legendary' : ''), { disabled: !owned, title: owned ? b.name : `${b.name}: ${bannerReqLabel(b)}`, style: legend ? `--lg:${b.colors[1]}` : null, onclick: () => { if (selectBanner(b.id)) { playSfx('tab'); render(); } } },
        bannerThumb(b), h('span', owned ? b.name : bannerReqLabel(b), legend ? h('small.legend-tag', owned ? 'Legendary · ' + fmt(st.stats[b.live] || 0) : `Legendary · ${fmt(pr.cur)}/${fmt(pr.goal)}`) : null), owned || !b.req ? null : h('i.banner-meter', { style: `width:${(pr.frac * 100).toFixed(0)}%` }));
    };
    const banners = h('div.paints.banners', BANNERS.filter((b) => b.rarity !== 'legendary').map(pick));
    const legendRow = (b) => {
      const owned = !!st.banners[b.id], on = st.banner === b.id, pr = bannerProgress(b), v = st.stats[b.live] || 0;
      return h('button.legend-row' + (on ? '.on' : '') + (owned ? '' : '.locked'), { disabled: !owned, style: `--lg:${b.colors[1]}`, onclick: () => { if (selectBanner(b.id)) { playSfx('tab'); render(); } } },
        bannerThumb(b, 'legend-thumb'),
        h('div.lr-main', h('b', b.name), h('small', owned ? (on ? 'Flying now · ' : '') + 'Tracks ' + b.tracks : bannerReqLabel(b)), owned ? null : h('div.meter.small', h('i', { style: `width:${(pr.frac * 100).toFixed(1)}%` }))),
        h('div.lr-stat', h('b', owned ? fmt(v) : `${fmt(pr.cur)}/${fmt(pr.goal)}`), h('small', owned ? b.label : 'Locked')));
    };
    const legends = h('div.legend-box', h('div.legend-head', h('b', 'Legendary'), h('span', 'Stat trackers: each shows a lifetime record, live.')), h('div.legend-list', BANNERS.filter((b) => b.rarity === 'legendary').map(legendRow)));
    return h('div.screen', h('div.screen-head', h('h2', 'Ships'), h('p', 'Each hull starts with its own gun and signature ability. Workshop upgrades apply to all of them.')),
      h('h3', 'Paint job'), paints, h('h3', 'Banner'), h('p.sub-note', 'Cloth banners that stream from your ship. Earn them with medals and high scores.'), banners, legends, h('h3', 'Hulls'), list);
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
    return h('div.screen', h('div.screen-head', h('h2', 'Missions'), h('p', 'Counterattack, a fresh Daily Sortie every day, and Threat levels for when the sectors stop being scary.')),
      counterPanel(), daily, h('h3', 'Threat level'), threat);
  }

  async function shareDaily() {
    const d = G.state.daily, r = await shareText(dailyShareText({ key: d.day, mutator: MUTATOR_BY_ID[d.mutator]?.name, wave: d.wave, score: d.score, streak: d.streak }));
    if (r === 'copied') hooks.toast?.('Result copied. Paste it to a friend!'); else if (r === 'failed') hooks.toast?.('Could not share from this browser.');
  }

  // ------------------------------------------------------------ counterattack
  let counterHard = false;
  // The first Counterattack launch opens the briefing; launching from it marks it seen.
  const launchCounter = (opts) => G.state.seen.counterIntro ? hooks.launch(opts) : hooks.counterIntro(() => { G.state.seen.counterIntro = true; hooks.launch(opts); });
  function counterPanel() {
    const st = G.state, c = st.counter;
    if (!c.unlocked) return h('section.panel.ca-panel.locked', h('div.ca-head', h('div', h('div.kicker', 'New mode'), h('h3', 'Counterattack')), uiIcon('lock')),
      h('p', `A vertical shooter where you fly free and take the fight to the invaders. Unlocks when you defeat the sector ${COUNTER_UNLOCK_SECTOR} boss.`));
    const power = powerRating(), stars = (tbl) => Object.values(tbl).reduce((a, b) => a + b, 0);
    const rows = STAGES.map((sg) => {
      const open = sg.n === 1 || (c.stars[sg.n - 1] || 0) > 0, hardOpen = (c.stars[sg.n] || 0) > 0, hard = counterHard && hardOpen, got = (hard ? c.hard : c.stars)[sg.n] || 0;
      const rec = sg.rec + (hard ? 12 : 0), ok = power >= rec;
      return h('div.ca-stage' + (open ? '' : '.locked') + (hard ? '.hard' : ''),
        h('div.ca-num', h('small', 'Stage'), h('b', String(sg.n))),
        h('div.ca-main', h('b', sg.name), h('small', open ? `${SECTORS[sg.sector].name} · best ${fmtInt(c.best[sg.n] || 0)}` : `Clear stage ${sg.n - 1} to unlock`),
          h('div.ca-stars', [1, 2, 3].map((i) => h('i' + (i <= got ? '.on' : ''), '★')), open ? h('span.ca-rec' + (ok ? '.ok' : '.low'), `Power ${power}/${rec}`) : null)),
        open ? h('button.btn.' + (hard ? 'danger' : 'primary') + '.ca-go', { onclick: () => launchCounter({ counter: sg.n, hard }) }, uiIcon('launch')) : uiIcon('lock'));
    });
    const anyHard = STAGES.some((sg) => (c.stars[sg.n] || 0) > 0);
    return h('section.panel.ca-panel',
      h('div.ca-head', h('div', h('div.kicker', 'Counterattack', h('button.ca-how', { onclick: () => hooks.counterIntro(null) }, 'How it works')), h('h3', 'Take the fight to them')), h('div.ca-cores', art('relic:r_quantum', 'ca-core-ico'), h('b', String(c.cores)), h('small', 'cores'))),
      h('p', 'Fly free in every direction: drag to move, double-tap a side to dash. Each stage ends with its sector boss. Stars earn Alien Cores for Alien Tech in the Workshop.'),
      h('div.ca-meta', h('span', `★ ${stars(c.stars)}/18` + (anyHard ? ` · Hard ★ ${stars(c.hard)}/18` : '')), anyHard ? h('button.ca-toggle' + (counterHard ? '.on' : ''), { onclick: () => { counterHard = !counterHard; playSfx('tab'); render(); } }, counterHard ? 'Hard mode on' : 'Hard mode off') : null),
      h('div.ca-list', rows));
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
  function recordsView() {
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
    return h('div.screen', h('div.screen-head', h('h2', 'Records'), h('p', 'Your personal bests. Every sortie is a shot at a new one.')),
      hero, bannerHint('score'), h('h3', 'Personal bests'), bests, h('h3', 'Top sorties'), top, h('h3', 'Ship bests'), ships, h('h3', 'Lifetime'), life);
  }
  const dateLabel = (t) => { const d = new Date(t), now = new Date(); return d.toDateString() === now.toDateString() ? 'Today' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };

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
    const ship = SHIPS.some((s) => shipStatus(s.id) === 'buyable' && st.salvage >= s.cost);
    const daily = (st.stats.sorties > 0 && !dailyToday().done) || (st.counter.unlocked && !Object.keys(st.counter.stars).length);
    setClass(navBtns.records, 'badged', !st.seen.records); setClass(navBtns.awards, 'badged', medalTotal().earned > (st.seen.medals || 0));
    setClass(navBtns.workshop, 'badged', canBuy); setClass(navBtns.ships, 'badged', ship); setClass(navBtns.missions, 'badged', daily);
    const hidden = (p) => TABS.some(([id], i) => Math.floor(i / PER_PAGE) === p && navBtns[id].classList.contains('badged'));
    setClass($.next, 'badged', hidden(page + 1)); setClass($.prev, 'badged', page > 0 && hidden(page - 1));
  }
  function update() { setText($.salvage, fmtInt(G.state.salvage)); badges(); }
  bus.on('contract', () => { if (G.mode === 'hangar') render(); });
  bus.on('medal', () => { if (G.mode === 'hangar' && tab === 'awards') { G.state.seen.medals = medalTotal().earned; render(); } });
  layoutNav();
  return { el, top, nav: $.nav, show, render, update, get tab() { return tab; } };
}
