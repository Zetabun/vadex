// Full-screen moments that pause combat: level-up cards, relic choice, pause/settings and the sortie debrief.
import { G } from '@last-orbit/core/game.js';
import { fmt, fmtInt, fmtTime } from '@last-orbit/core/format.js';
import { RARITY, MOD_BY_ID } from '@last-orbit/data/cards.js';
import { ABILITIES } from '@last-orbit/data/abilities.js';
import { ACHIEVEMENTS, FEATS, TIERS } from '@last-orbit/data/achievements.js';
import { BANNER_BY_ID } from '@last-orbit/data/banners.js';
import { RELIC_BY_ID } from '@last-orbit/data/relics.js';
import { WEAPONS } from '@last-orbit/data/weapons.js';
import { SHIP_BY_ID } from '@last-orbit/data/ships.js';
import { CONTRACT_BY_ID } from '@last-orbit/data/contracts.js';
import { describeCard, pickCard, reroll, pickRelic, pickRoute } from '@last-orbit/progression/run.js';
import { ROUTE_BY_ID } from '@last-orbit/data/routes.js';
import { FUSION_BY_ID } from '@last-orbit/data/fusions.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { unlockLabel, pilotProgress, medalDesc } from '@last-orbit/progression/meta.js';
import { PAINT_BY_ID, rankTitle } from '@last-orbit/data/career.js';
import { THREATS } from '@last-orbit/data/threat.js';
import { MUTATOR_BY_ID } from '@last-orbit/data/daily.js';
import { applyVolumes, playSfx } from '@last-orbit/audio/audio.js';
import { h, clear, toggle, slider, select } from '@last-orbit/ui/dom.js';
import { uiIcon } from '@last-orbit/ui/icons.js';
import { art } from '@last-orbit/ui/art.js';
import { dailyShareText, shareText } from '@last-orbit/ui/share.js';

export function createOverlays(layer, hooks) {
  let open = null; // { kind, el, keys }
  const close = () => { if (!open) return; const el = open.el; el.classList.add('out'); setTimeout(() => el.remove(), 180); open = null; layer.classList.remove('on'); hooks.measure?.(); };
  function mount(kind, el, keys) {
    if (open) { open.el.remove(); open = null; }
    open = { kind, el, keys }; layer.append(el); layer.classList.add('on');
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => el.querySelector('[data-autofocus]')?.focus({ preventScroll: true }), 60);
  }

  // ------------------------------------------------------------ level-up
  function showOffer() {
    const run = G.state.run; if (!run?.offer) return;
    const cards = h('div.cards');
    const choose = (i) => { if (!open || open.kind !== 'offer' || open.busy) return; open.busy = true; const btn = cards.children[i]; btn?.classList.add('picked'); playSfx('buy');
      setTimeout(() => { const c = pickCard(i); hooks.cardPicked?.(c); if (!hooks.nextChoice()) close(); }, 170); };
    run.offer.forEach((c, i) => {
      const d = describeCard(c, run), rar = RARITY[c.rarity] || RARITY.common;
      cards.append(h('button.card.' + c.rarity, { style: `--c:${d.color};--r:${rar.color};--d:${i * 70}ms`, onclick: () => choose(i), 'data-autofocus': i === 0 ? '' : null },
        h('div.card-art' + (d.icon2 ? '.duo' : ''), art(d.icon, 'card-icon'), d.icon2 ? art(d.icon2, 'card-icon') : null),
        h('div.card-main', h('div.card-kicker', h('span', d.kicker), h('span.rar', c.kind === 'upgrade' ? (c.rarity === 'evo' ? 'Final evolution' : 'Upgrade') : c.kind === 'weapon' ? 'Weapon' : c.kind === 'ability' ? 'Ability' : c.kind === 'fusion' ? 'Fusion' : c.kind === 'signature' ? 'Signature' : rar.name)), h('div.card-title', d.title), h('div.card-body', d.body)),
        h('span.card-key', String(i + 1))));
    });
    const rr = run.rerolls <= 0 ? null : h('button.btn.ghost.reroll', { onclick: () => { if (open?.busy) return; if (reroll()) { playSfx('tab'); showOffer(); } } }, uiIcon('reroll'), `Reroll (${run.rerolls})`);
    const shownLevel = run.level - run.pendingLevels + 1;
    const more = run.pendingLevels > 1 ? h('span.more', `+${run.pendingLevels - 1} more`) : null;
    const el = h('div.modal.levelup', { role: 'dialog', 'aria-label': 'Level up' },
      h('div.modal-head', h('div.kicker', 'Level up'), h('h2', shownLevel > 1 ? 'Level ' + shownLevel : 'Pre-flight', more), h('p', shownLevel > 1 ? 'Choose an upgrade for this sortie.' : 'Your veteran crew fits an upgrade before launch.')),
      cards, rr ? h('div.modal-foot', rr) : null);
    mount('offer', el, (e) => { const n = Number(e.key); if (n >= 1 && n <= run.offer.length) { choose(n - 1); return true; } if ((e.key === 'r' || e.key === 'R') && rr) { rr.click(); return true; } return false; });
  }

  // ------------------------------------------------------------ relics
  function showRelics() {
    const run = G.state.run; if (!run?.relicOffer) return;
    const cards = h('div.cards.relics');
    const choose = (i) => { if (!open || open.busy) return; open.busy = true; cards.children[i]?.classList.add('picked'); playSfx('unlock');
      setTimeout(() => { pickRelic(i); hooks.flash?.('#b69cff'); if (!hooks.nextChoice()) close(); }, 220); };
    run.relicOffer.forEach((id, i) => {
      const r = RELIC_BY_ID[id];
      cards.append(h('button.card.relic', { style: `--c:#d6b4ff;--r:#b69cff;--d:${i * 90}ms`, onclick: () => choose(i), 'data-autofocus': i === 0 ? '' : null },
        h('div.card-art', art('relic:' + id, 'card-icon')), h('div.card-main', h('div.card-kicker', h('span', 'Relic'), h('span.rar', 'Permanent this sortie')), h('div.card-title', r.name), h('div.card-body', r.desc)), h('span.card-key', String(i + 1))));
    });
    const el = h('div.modal.relic-pick', { role: 'dialog', 'aria-label': 'Choose a relic' },
      h('div.modal-head', h('div.kicker', 'Sector cleared'), h('h2', 'Choose a relic'), h('p', 'Hull and shields restored. Relics are powerful and last until the sortie ends.')), cards);
    mount('relic', el, (e) => { const n = Number(e.key); if (n >= 1 && n <= run.relicOffer.length) { choose(n - 1); return true; } return false; });
  }

  // ------------------------------------------------------------ routes
  function showRoutes() {
    const run = G.state.run; if (!run?.routeOffer) return;
    const cards = h('div.cards.routes'), next = sectorOf(run.wave);
    const choose = (i) => { if (!open || open.busy) return; open.busy = true; cards.children[i]?.classList.add('picked'); playSfx('buy');
      setTimeout(() => { const r = pickRoute(i); if (r && r.id !== 'steady') hooks.flash?.('#ffc857'); if (!hooks.nextChoice()) close(); }, 200); };
    run.routeOffer.forEach((id, i) => {
      const r = ROUTE_BY_ID[id];
      cards.append(h('button.card.route' + (id === 'steady' ? '.steady' : ''), { style: `--c:#ffc857;--r:#ffb547;--d:${i * 90}ms`, onclick: () => choose(i), 'data-autofocus': i === 0 ? '' : null },
        h('div.card-art', art(r.art, 'card-icon')), h('div.card-main', h('div.card-kicker', h('span', id === 'steady' ? 'No risk' : 'Risk and reward'), h('span.rar', 'Route')), h('div.card-title', r.name), h('div.card-body', r.desc)), h('span.card-key', String(i + 1))));
    });
    const el = h('div.modal.route-pick', { role: 'dialog', 'aria-label': 'Choose a route' },
      h('div.modal-head', h('div.kicker', `Next: Sector ${next.idx + 1} · ${next.def.name}`), h('h2', 'Choose your route'), h('p', 'The route holds until this sector\u2019s boss falls.')), cards);
    mount('route', el, (e) => { const n = Number(e.key); if (n >= 1 && n <= run.routeOffer.length) { choose(n - 1); return true; } return false; });
  }

  // ------------------------------------------------------------ pause / settings
  function settingsBody() {
    const s = G.state.settings, set = (k) => (v) => { s[k] = v; applyVolumes(); hooks.applySettings?.(); };
    const field = (label, control) => h('label.field', h('span', label), control);
    return h('div.settings',
      field('Master volume', slider(() => s.master, set('master'), 0, 1, 0.05, 'Master volume')),
      field('Music', slider(() => s.music, set('music'), 0, 1, 0.05, 'Music volume')),
      field('Sound effects', slider(() => s.sfx, set('sfx'), 0, 1, 0.05, 'Sound effects volume')),
      field('Hold screen sides to move', toggle(() => s.holdSides !== false, set('holdSides'), 'Hold screen sides to move')),
      field('Screen shake', toggle(() => s.shake, set('shake'), 'Screen shake')),
      field('Damage numbers', toggle(() => s.dmgNumbers, set('dmgNumbers'), 'Damage numbers')),
      field('Scanlines', toggle(() => s.scanlines, set('scanlines'), 'Scanlines')),
      field('Graphics', select([['auto', 'Auto'], ['high', 'High'], ['low', 'Low']], () => s.quality, set('quality'), 'Graphics quality')),
      field('Number format', select([['suffix', '1.2K'], ['sci', '1.2e3']], () => s.notation, (v) => { s.notation = v; hooks.applySettings?.(); }, 'Number format')));
  }
  function showPause() {
    const run = G.state.run; if (!run) return;
    const el = h('div.modal.pause', { role: 'dialog', 'aria-label': 'Paused' },
      h('div.modal-head', h('div.kicker', `Wave ${run.wave} · Level ${run.level}`), h('h2', 'Paused')),
      h('button.build.build-open', { onclick: () => showLoadout(null, true), 'aria-label': 'Show loadout details' }, [...buildSummary(run).childNodes], h('span.build-more', 'Details', uiIcon('chevron'))),
      h('div.modal-actions', h('button.btn.primary', { onclick: close, 'data-autofocus': '' }, uiIcon('play'), 'Resume'),
        h('button.btn.ghost', { onclick: () => showSettings(true) }, uiIcon('gear'), 'Settings'),
        h('button.btn.danger', { onclick: () => confirmAbandon() }, 'Abandon sortie')));
    mount('pause', el, (e) => { if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { close(); return true; } return false; });
  }
  // ------------------------------------------------------------ loadout: everything active this sortie, explained
  /** focus: an art key such as 'weapon:laser' to scroll to and highlight. */
  function showLoadout(focus, fromPause) {
    const run = G.state.run; if (!run) return;
    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    const row = (key, color, title, tag, body) => h('div.lo-row' + (key === focus ? '.focus' : ''), { style: `--c:${color}`, 'data-key': key }, art(key, 'lo-icon'), h('div.lo-main', h('div.lo-title', h('b', title), tag ? h('span', tag) : null), h('p', body)));
    const section = (title, rows) => rows.length ? [h('h3.lo-h', title), h('div.lo-list', rows)] : [];
    const weapons = run.order.map((id) => {
      const d = WEAPONS[id], r = run.weapons[id], evos = d.evo.slice(0, r - 1);
      return row('weapon:' + id, hex(d.color), d.name, `Rank ${r}/${d.evo.length + 1}`, d.desc + (evos.length ? ' Evolved: ' + evos.map((e) => e.name).join(', ') + '.' : ''));
    });
    const abilities = run.abilities.map((id, i) => row('ability:' + id, ABILITIES[id].color, ABILITIES[id].name, 'Button ' + (i + 1), ABILITIES[id].desc));
    const relics = run.relics.map((id) => row('relic:' + id, '#b69cff', RELIC_BY_ID[id].name, 'Relic', RELIC_BY_ID[id].desc));
    const mods = Object.entries(run.cards).filter(([, n]) => n > 0).map(([id, n]) => { const m = MOD_BY_ID[id]; return row('mod:' + id, RARITY[m.rarity].color, m.name, m.max > 1 ? `×${n}` : 'Unique', m.desc); });
    const ship = SHIP_BY_ID[run.ship], specials = [];
    if (run.signature && ship.signature) specials.push(row('weapon:' + ship.weapon, '#' + ship.trim.toString(16).padStart(6, '0'), ship.signature.name, 'Signature', `${WEAPONS[ship.weapon].name}: ${ship.signature.desc}.`));
    for (const id of run.fusions || []) { const f = FUSION_BY_ID[id]; specials.push(row('weapon:' + f.a, '#ff8bff', f.name, 'Fusion', `${WEAPONS[f.a].name} + ${WEAPONS[f.b].name}. ${f.desc}`)); }
    if (ship.passive) specials.push(row('ship:' + ship.id, '#' + ship.trim.toString(16).padStart(6, '0'), ship.passive.name, 'Ship trait', ship.passive.desc));
    const rules = [];
    if (run.route) rules.push(row(ROUTE_BY_ID[run.route].art, '#ffc857', 'Route: ' + ROUTE_BY_ID[run.route].name, 'This sector', ROUTE_BY_ID[run.route].desc));
    if (run.mutator) rules.push(row('relic:r_phoenix', '#ffc857', 'Daily: ' + MUTATOR_BY_ID[run.mutator].name, 'Today', MUTATOR_BY_ID[run.mutator].desc));
    for (let t = 1; t <= (run.threat || 0); t++) rules.push(row('relic:r_giant', '#ff5f7a', 'Threat ' + THREATS[t].roman, null, THREATS[t].rule + '.'));
    const el = h('div.modal.loadout-sheet', { role: 'dialog', 'aria-label': 'Loadout' },
      h('div.modal-head', h('div.kicker', `Wave ${run.wave} · Level ${run.level}`), h('h2', 'Loadout'), h('p', 'Everything working for (and against) you this sortie.')),
      ...section('Weapons', weapons), ...section('Specials', specials), ...section('Abilities', abilities), ...section('Relics', relics), ...section(`Upgrades (${mods.length})`, mods), ...section('Conditions', rules),
      h('div.modal-actions', fromPause ? h('button.btn.ghost', { onclick: showPause }, uiIcon('back'), 'Back') : null, h('button.btn.primary', { onclick: close, 'data-autofocus': '' }, uiIcon('play'), 'Resume')));
    mount('loadout', el, (e) => { if (e.key === 'Escape') { if (fromPause) showPause(); else close(); return true; } return false; });
    if (focus) setTimeout(() => el.querySelector('.lo-row.focus')?.scrollIntoView({ block: 'center' }), 80);
  }
  function buildSummary(run) {
    return h('div.build', run.order.map((id) => h('div.build-item', { style: `--c:#${WEAPONS[id].color.toString(16).padStart(6, '0')}` }, art('weapon:' + id, 'build-icon'), h('span', `${WEAPONS[id].name}`), h('b', 'R' + run.weapons[id]))),
      run.relics.map((id) => h('div.build-item.relic', art('relic:' + id, 'build-icon'), h('span', RELIC_BY_ID[id].name))));
  }
  function confirmAbandon() {
    const el = h('div.modal.confirm', { role: 'alertdialog', 'aria-label': 'Abandon sortie?' },
      h('div.modal-head', h('h2', 'Abandon sortie?'), h('p', 'You keep the salvage collected so far. Cards and relics are lost.')),
      h('div.modal-actions', h('button.btn.ghost', { onclick: showPause, 'data-autofocus': '' }, 'Keep flying'), h('button.btn.danger', { onclick: () => { close(); hooks.abandon(); } }, 'Abandon')));
    mount('confirm', el, (e) => { if (e.key === 'Escape') { showPause(); return true; } return false; });
  }
  function showSettings(fromPause) {
    const el = h('div.modal.settings-modal', { role: 'dialog', 'aria-label': 'Settings' },
      h('div.modal-head', h('h2', 'Settings')), settingsBody(),
      h('div.modal-actions', h('button.btn.primary', { onclick: () => (fromPause ? showPause() : close()), 'data-autofocus': '' }, 'Done'),
        fromPause ? null : h('button.btn.danger.small', { onclick: () => confirmReset() }, 'Erase save')),
      h('div.display-info', displayInfo()));
    mount('settings', el, (e) => { if (e.key === 'Escape') { if (fromPause) showPause(); else close(); return true; } return false; });
  }
  function confirmReset() {
    const el = h('div.modal.confirm', { role: 'alertdialog', 'aria-label': 'Erase save?' },
      h('div.modal-head', h('h2', 'Erase all progress?'), h('p', 'Salvage, upgrades, ships and contracts will be wiped. This cannot be undone.')),
      h('div.modal-actions', h('button.btn.ghost', { onclick: () => showSettings(false), 'data-autofocus': '' }, 'Cancel'), h('button.btn.danger', { onclick: () => { close(); hooks.hardReset(); } }, 'Erase')));
    mount('confirm', el, (e) => { if (e.key === 'Escape') { showSettings(false); return true; } return false; });
  }

  // ------------------------------------------------------------ debrief
  function showDebrief(s) {
    const ship = SHIP_BY_ID[s.ship], win = s.reason === 'abandoned' ? 'Sortie abandoned' : 'Signal lost';
    const salvageEl = h('b.count', '0');
    const done = s.contracts.map((id) => CONTRACT_BY_ID[id]);
    const el = h('div.modal.debrief', { role: 'dialog', 'aria-label': 'Sortie debrief' },
      h('div.modal-head', h('div.kicker', `${ship.name} · Sector ${s.sector} · ${s.sectorName}` + (s.threat ? ` · Threat ${THREATS[s.threat].roman}` : '') + (s.mutator ? ` · Daily: ${MUTATOR_BY_ID[s.mutator].name}` : '')), h('h2', win), h('div.pbs', s.highScore ? h('div.pb', 'New high score') : null, s.best && s.wave > 1 ? h('div.pb', 'New best wave') : null)),
      h('div.hero-row', h('div.big-wave', h('small', 'Wave'), h('b', String(s.wave))), h('div.earned', h('small', 'Salvage banked'), h('div', art('cur:salvage', 'cur-ico'), salvageEl))),
      h('div.score-row', h('small', 'Score'), h('b', fmtInt(s.score || 0)), s.place ? h('span', `#${s.place} of your top 10`) : s.prevScore ? h('span', `Best ${fmtInt(s.prevScore)}`) : null),
      h('div.stat-grid', stat('Level', s.level), stat('Kills', fmtInt(s.kills)), stat('Bosses', s.bosses), stat('Time', fmtTime(s.time))),
      s.daily ? h('div.earned.daily-earned', h('small', `Daily bonus · ${s.daily.streak}-day streak`), h('div', art('cur:salvage', 'cur-ico'), '+' + fmtInt(s.daily.bonus))) : null,
      s.mastery ? h('div.pilot-row.mastery-row', h('span', `${SHIP_BY_ID[s.ship].name} mastery ${s.mastery.to}` + (s.mastery.to > s.mastery.from ? ' · level up!' : '')), h('b', '+' + s.mastery.gained)) : null,
      s.pilot ? h('div.pilot-xp', h('div.pilot-row', h('span', s.pilot.to > s.pilot.from ? `Rank up! ${rankTitle(s.pilot.to)} · Rank ${s.pilot.to}` : `Pilot rank ${s.pilot.to}`), h('b', '+' + fmtInt(s.pilot.gained) + ' XP')),
        h('div.meter.rank', h('i', { style: `width:${(pilotProgress() * 100).toFixed(1)}%` })),
        s.pilot.rewards.length ? h('div.rank-rewards', s.pilot.rewards.map((r) => h('span.reward' + (r.paint ? '.paint' : ''), r.paint ? `${PAINT_BY_ID[r.paint].name} paint unlocked` : [art('cur:salvage', 'cur-ico'), '+' + fmtInt(r.salvage)]))) : null) : null,
      s.medals?.length ? h('div.unlocks.medals', h('div.kicker', `Achievements earned (${s.medals.length})`), s.medals.map((m) => { const a = ACHIEVEMENTS.find((x) => x.id === m.id) || FEATS.find((x) => x.id === m.id), tier = a.goals ? TIERS[m.tier].id : 'feat';
        return h('div.unlock', h('span.medal-frame.sm.tier-' + tier, art(a.art, 'medal-ico')), h('b', a.name), h('small', `${a.goals ? TIERS[m.tier].name : 'Feat'} · ${medalDesc(a, m.tier)} · +${m.xp} XP`)); })) : null,
      s.banners?.length ? h('div.unlocks.medals', h('div.kicker', 'Banners unlocked'), s.banners.map((id) => h('div.unlock', art('ach:flag', 'build-icon'), h('b', BANNER_BY_ID[id].name), h('small', 'Fly it from the Ships tab')))) : null,
      done.length ? h('div.unlocks', h('div.kicker', `Contracts complete (${done.length})`), done.map((c) => h('div.unlock', uiIcon('check'), h('b', c.name), h('small', `+${c.salvage} salvage` + (c.unlock ? ' · ' + unlockLabel(c.unlock) : ''))))) : null,
      h('div.build', s.weapons.map(([id, r]) => h('div.build-item', { style: `--c:#${WEAPONS[id].color.toString(16).padStart(6, '0')}` }, art('weapon:' + id, 'build-icon'), h('span', WEAPONS[id].name), h('b', 'R' + r))), s.relics.map((id) => h('div.build-item.relic', art('relic:' + id, 'build-icon'), h('span', RELIC_BY_ID[id].name)))),
      s.daily ? h('button.btn.gold.share-btn.wide', { onclick: async () => { const r = await shareText(dailyShareText({ key: G.state.daily.lastDay, mutator: MUTATOR_BY_ID[s.mutator]?.name, wave: s.wave, score: s.score, streak: s.daily.streak })); if (r === 'copied') hooks.toast?.('Result copied. Paste it to a friend!'); else if (r === 'failed') hooks.toast?.('Could not share from this browser.'); } }, uiIcon('share'), 'Share daily result') : null,
      h('div.modal-actions', h('button.btn.primary', { onclick: () => { close(); hooks.launch(); }, 'data-autofocus': '' }, uiIcon('launch'), s.daily ? 'Launch a sortie' : 'Launch again'),
        h('button.btn.gold', { onclick: () => { close(); hooks.toHangar('workshop'); } }, uiIcon('workshop'), 'Workshop'),
        h('button.btn.ghost.wide', { onclick: () => { close(); hooks.toHangar('launch'); } }, uiIcon('home'), 'Back to hangar')));
    mount('debrief', el, () => false);
    // Count the salvage up for a little payoff.
    const target = s.salvage, t0 = performance.now(), dur = Math.min(1400, 400 + target * 3);
    const tick = (now) => { const k = Math.min(1, (now - t0) / dur); salvageEl.textContent = fmtInt(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1 && salvageEl.isConnected) requestAnimationFrame(tick); else if (k >= 1) playSfx('loot'); };
    setTimeout(() => requestAnimationFrame(tick), 350);
  }
  const stat = (k, v) => h('div.stat', h('small', k), h('b', String(v)));
  // Small readout to help diagnose layout on unusual screens (e.g. installed home-screen apps).
  const displayInfo = () => {
    const app = document.getElementById('app'), sa = getComputedStyle(document.documentElement), standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    return `v${document.querySelector('script[type=importmap]')?.textContent.match(/v=([0-9.]+)/)?.[1] || '?'} · ${standalone ? 'app' : 'browser'} · screen ${screen.width}×${screen.height} · window ${innerWidth}×${innerHeight} · game ${Math.round(app.clientHeight)}`;
  };

  return {
    showOffer, showRelics, showRoutes, showPause, showSettings, showDebrief, showLoadout, close,
    get kind() { return open?.kind || null; },
    /** Combat freezes while any overlay is up. */
    blocking: () => !!open,
    key: (e) => !!open?.keys?.(e),
  };
}
