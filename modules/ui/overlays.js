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
import { describeCard, pickCard, reroll, pickRelic, pickRoute, pickAnomaly, autoPickIndex } from '@last-orbit/progression/run.js';
import { ANOMALY_BY_ID, anomalyCounts, anomalyPay, anomalyName } from '@last-orbit/data/anomalies.js';
import { STATION_CORE, TROPHY_BY_ID, caughtStages } from '@last-orbit/data/station.js';
import { TIER_BY_N, SIEGE_STARS, SIEGE_BLUEPRINTS, SYSTEM_BY_ID, listNames } from '@last-orbit/data/siege.js';
import { TURRET_MOD } from '@last-orbit/data/turret.js';
import { stationBlueprint } from '@last-orbit/ui/stationArt.js';
import { SYNERGIES, synergyOf, synergyCount, activeTiers } from '@last-orbit/data/synergies.js';
import { ROUTE_BY_ID } from '@last-orbit/data/routes.js';
import { FUSION_BY_ID } from '@last-orbit/data/fusions.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { BOSSES } from '@last-orbit/data/bosses.js';
import { BAL } from '@last-orbit/data/balance.js';
import { unlockLabel, pilotProgress, medalDesc, overhaul, overhaulReward, blueprintLevel, setCallsign, cleanCallsign, CALLSIGN_MAX, setStationName, cleanStationName, STATION_NAME_MAX } from '@last-orbit/progression/meta.js';
import { TRAILS, OVERHAUL_COST_STEP } from '@last-orbit/data/prestige.js';
import { PAINT_BY_ID, rankTitle } from '@last-orbit/data/career.js';
import { THREATS } from '@last-orbit/data/threat.js';
import { COUNTER_TOP, STAR_HITS, STAR_KILLS } from '@last-orbit/data/counter.js';
import { FIELD } from '@last-orbit/data/balance.js';
import { MUTATOR_BY_ID } from '@last-orbit/data/daily.js';
import { applyVolumes, playSfx } from '@last-orbit/audio/audio.js';
import { h, clear, toggle, slider, select } from '@last-orbit/ui/dom.js';
import { uiIcon } from '@last-orbit/ui/icons.js';
import { art } from '@last-orbit/ui/art.js';
import { dailyShareText, shareText } from '@last-orbit/ui/share.js';
import { exportSave, importSave } from '@last-orbit/save/save.js';

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
        h('div.card-main', h('div.card-kicker', h('span', d.kicker), h('span.rar', c.kind === 'upgrade' ? (c.rarity === 'evo' ? 'Final evolution' : 'Upgrade') : c.kind === 'weapon' ? 'Weapon' : c.kind === 'ability' ? 'Ability' : c.kind === 'fusion' ? 'Fusion' : c.kind === 'signature' ? 'Signature' : rar.name)), h('div.card-title', d.title), h('div.card-body', d.body), synChip(c, run)),
        h('span.card-key', String(i + 1))));
    });
    const rr = run.rerolls <= 0 ? null : h('button.btn.ghost.reroll', { onclick: () => { if (open?.busy) return; if (reroll()) { playSfx('tab'); showOffer(); } } }, uiIcon('reroll'), `Reroll (${run.rerolls})`);
    const shownLevel = run.level - run.pendingLevels + 1, preflight = !(run.time > 0);
    const more = run.pendingLevels > 1 ? h('span.more', `+${run.pendingLevels - 1} more`) : null;
    const auto = run.pendingLevels >= 3 ? h('button.btn.ghost.reroll', { onclick: () => { if (open?.busy) return; open.busy = true; playSfx('buy'); let guard = 60; while (run.offer && guard-- > 0) pickCard(autoPickIndex(run)); close(); hooks.nextChoice(); } }, uiIcon('check'), `Auto-pick ${run.pendingLevels}`) : null;
    const el = h('div.modal.levelup', { role: 'dialog', 'aria-label': 'Level up' },
      h('div.modal-head', h('div.kicker', preflight && run.warp ? `Warp to sector ${run.warp}` : 'Level up'), h('h2', preflight ? 'Pre-flight' : 'Level ' + shownLevel, more), h('p', !preflight ? 'Choose an upgrade for this sortie.' : run.warp ? 'Catch-up upgrades for the sectors you are skipping.' : 'Your veteran crew fits an upgrade before launch.')),
      cards, rr || auto ? h('div.modal-foot', rr, auto) : null);
    mount('offer', el, (e) => { const n = Number(e.key); if (n >= 1 && n <= run.offer.length) { choose(n - 1); return true; } if ((e.key === 'r' || e.key === 'R') && rr) { rr.click(); return true; } return false; });
  }

  /** Synergy progress on a card: which theme it feeds and whether it completes a tier. */
  function synChip(c, run) {
    if (c.kind !== 'mod') return null; const s = synergyOf(c.id); if (!s) return null;
    const have = synergyCount(s, run), next = run.cards[c.id] > 0 ? have : have + 1, tier = s.tiers.find((t) => t.n > have) || s.tiers[s.tiers.length - 1];
    const completes = !(run.cards[c.id] > 0) && s.tiers.some((t) => t.n === next);
    return h('div.syn-chip' + (completes ? '.complete' : ''), { style: `--s:${s.color}` }, h('b', s.name), h('span', completes ? `Completes: ${s.tiers.find((t) => t.n === next).desc}` : `${Math.min(next, tier.n)}/${tier.n}`));
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
      h('div.modal-head', h('div.kicker', run.time > 0 ? 'Sector cleared' : 'Pre-flight'), h('h2', 'Choose a relic'), h('p', run.time > 0 ? 'Hull and shields restored. Relics are powerful and last until the sortie ends.' : 'A catch-up relic for the sector you are skipping. It lasts the whole sortie.')), cards);
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

  // ------------------------------------------------------------ Deep Void anomalies
  function showAnomalies() {
    const run = G.state.run; if (!run?.anomalyOffer) return;
    const cards = h('div.cards.anomalies'), next = sectorOf(run.wave), have = anomalyCounts(run), carried = (run.anomalies || []).length;
    const choose = (i) => { if (!open || open.busy) return; open.busy = true; cards.children[i]?.classList.add('picked'); playSfx('unlock', 0.8);
      setTimeout(() => { pickAnomaly(i); hooks.flash?.('#c77dff'); if (!hooks.nextChoice()) close(); }, 220); };
    run.anomalyOffer.forEach((id, i) => {
      const a = ANOMALY_BY_ID[id], n = (have[id] || 0) + 1;
      cards.append(h('button.card.anomaly', { style: `--c:#c77dff;--r:#ff5fa2;--d:${i * 90}ms`, onclick: () => choose(i), 'data-autofocus': i === 0 ? '' : null },
        h('div.card-art', art('void:' + id, 'card-icon')), h('div.card-main', h('div.card-kicker', h('span', n > 1 ? 'Stacks again' : 'Anomaly'), h('span.rar', `+${Math.round(a.pay * 100)}% salvage & score`)), h('div.card-title', anomalyName(id, n)), h('div.card-body', a.desc)), h('span.card-key', String(i + 1))));
    });
    const now = Math.round((anomalyPay(run) - 1) * 100);
    const el = h('div.modal.anomaly-pick', { role: 'dialog', 'aria-label': 'Choose an anomaly' },
      h('div.modal-head', h('div.kicker', `Entering ${next.def.name}`), h('h2', 'Choose an anomaly'),
        h('p', carried ? `Anomalies stack for the rest of the sortie. You carry ${carried}, paying +${now}% salvage and score.` : 'The Deep Void bends the rules. Anomalies stack for the rest of the sortie, and each one raises your salvage and score.')), cards);
    mount('anomaly', el, (e) => { const k = Number(e.key); if (k >= 1 && k <= run.anomalyOffer.length) { choose(k - 1); return true; } return false; });
  }

  // ------------------------------------------------------------ pause / settings
  function settingsBody(fromPause = false) {
    const s = G.state.settings, set = (k) => (v) => { s[k] = v; applyVolumes(); hooks.applySettings?.(); };
    const field = (label, control) => h('label.field', h('span', label), control);
    return h('div.settings',
      field('Story', h('button.btn.ghost.small.callsign-edit', { onclick: () => hooks.replayIntro?.() }, 'Watch intro', uiIcon('play'))),
      field('Station name', h('button.btn.ghost.small.callsign-edit', { onclick: () => showStationName({ fromSettings: true }) }, G.state.stationName || 'Name it', uiIcon('chevron'))),
      field('Callsign', h('button.btn.ghost.small.callsign-edit', { onclick: () => showCallsign({ fromSettings: true }) }, G.state.pilot.name || 'Add callsign', uiIcon('chevron'))),
      fromPause ? null : field('Save backup', h('button.btn.ghost.small.callsign-edit' + (backedUp() ? '' : '.nudge'), { onclick: () => showBackup() }, backupAge(), uiIcon('chevron'))),
      field('Master volume', slider(() => s.master, set('master'), 0, 1, 0.05, 'Master volume')),
      field('Music', slider(() => s.music, set('music'), 0, 1, 0.05, 'Music volume')),
      field('Sound effects', slider(() => s.sfx, set('sfx'), 0, 1, 0.05, 'Sound effects volume')),
      field('Hold screen sides to move', toggle(() => s.holdSides !== false, set('holdSides'), 'Hold screen sides to move')),
      field('Screen shake', toggle(() => s.shake, set('shake'), 'Screen shake')),
      field('Vibration', toggle(() => s.haptics !== false, set('haptics'), 'Vibration')),
      field('Damage numbers', toggle(() => s.dmgNumbers, set('dmgNumbers'), 'Damage numbers')),
      field('Scanlines', toggle(() => s.scanlines, set('scanlines'), 'Scanlines')),
      field('Graphics', select([['auto', 'Auto'], ['high', 'High'], ['low', 'Low']], () => s.quality, set('quality'), 'Graphics quality')),
      field('Number format', select([['suffix', '1.2K'], ['sci', '1.2e3']], () => s.notation, (v) => { s.notation = v; hooks.applySettings?.(); }, 'Number format')));
  }
  function showPause() {
    const run = G.state.run; if (!run) return;
    const el = h('div.modal.pause', { role: 'dialog', 'aria-label': 'Paused' },
      h('div.modal-head', h('div.kicker', `${run.mode === 'counter' ? 'Stage ' + run.stage : 'Wave ' + run.wave} · Level ${run.level}`), h('h2', 'Paused')),
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
    const syns = SYNERGIES.map((s) => ({ s, n: synergyCount(s, run), on: activeTiers(s, run) })).filter((x) => x.n > 0).map(({ s, n, on }) => {
      const next = s.tiers.find((t) => t.n > n);
      return h('div.lo-row' + (on.length ? '.syn-on' : ''), { style: `--c:${s.color}` }, h('span.syn-dot'), h('div.lo-main', h('div.lo-title', h('b', s.name), h('span', `${n}/${(next || s.tiers[s.tiers.length - 1]).n}`)),
        h('p', [...on.map((t) => '✓ ' + t.desc), next ? `Next at ${next.n}: ${next.desc}` : ''].filter(Boolean).join(' · '))));
    });
    const ship = SHIP_BY_ID[run.ship], specials = [];
    if (run.signature && ship.signature) specials.push(row('weapon:' + ship.weapon, '#' + ship.trim.toString(16).padStart(6, '0'), ship.signature.name, 'Signature', `${WEAPONS[ship.weapon].name}: ${ship.signature.desc}.`));
    for (const id of run.fusions || []) { const f = FUSION_BY_ID[id]; specials.push(row('weapon:' + f.a, '#ff8bff', f.name, 'Fusion', `${WEAPONS[f.a].name} + ${WEAPONS[f.b].name}. ${f.desc}`)); }
    if (ship.passive) specials.push(row('ship:' + ship.id, '#' + ship.trim.toString(16).padStart(6, '0'), ship.passive.name, 'Ship trait', ship.passive.desc));
    const rules = [];
    if (run.route) rules.push(row(ROUTE_BY_ID[run.route].art, '#ffc857', 'Route: ' + ROUTE_BY_ID[run.route].name, 'This sector', ROUTE_BY_ID[run.route].desc));
    if (run.mutator) rules.push(row('relic:r_phoenix', '#ffc857', 'Daily: ' + MUTATOR_BY_ID[run.mutator].name, 'Today', MUTATOR_BY_ID[run.mutator].desc));
    for (const [id, n] of Object.entries(anomalyCounts(run))) rules.push(row('void:' + id, '#c77dff', anomalyName(id, n), 'Anomaly', ANOMALY_BY_ID[id].desc + (n > 1 ? ` (×${n})` : '') + ` +${Math.round(ANOMALY_BY_ID[id].pay * n * 100)}% salvage and score.`));
    for (let t = 1; t <= (run.threat || 0); t++) rules.push(row('relic:r_giant', '#ff5f7a', 'Threat ' + THREATS[t].roman, null, THREATS[t].rule + '.'));
    const el = h('div.modal.loadout-sheet', { role: 'dialog', 'aria-label': 'Loadout' },
      h('div.modal-head', h('div.kicker', `${run.mode === 'counter' ? 'Stage ' + run.stage : 'Wave ' + run.wave} · Level ${run.level}`), h('h2', 'Loadout'), h('p', 'Everything working for (and against) you this sortie.')),
      ...section('Weapons', weapons), ...section('Synergies', syns), ...section('Specials', specials), ...section('Abilities', abilities), ...section('Relics', relics), ...section(`Upgrades (${mods.length})`, mods), ...section('Conditions', rules),
      h('div.modal-actions', fromPause ? h('button.btn.ghost', { onclick: showPause }, uiIcon('back'), 'Back') : null, h('button.btn.primary', { onclick: close, 'data-autofocus': '' }, uiIcon('play'), 'Resume')));
    mount('loadout', el, (e) => { if (e.key === 'Escape') { if (fromPause) showPause(); else close(); return true; } return false; });
    if (focus) setTimeout(() => el.querySelector('.lo-row.focus')?.scrollIntoView({ block: 'center' }), 80);
  }
  function buildSummary(run) {
    return h('div.build', run.order.map((id) => h('div.build-item', { style: `--c:#${WEAPONS[id].color.toString(16).padStart(6, '0')}` }, art('weapon:' + id, 'build-icon'), h('span', `${WEAPONS[id].name}`), h('b', 'R' + run.weapons[id]))),
      run.relics.map((id) => h('div.build-item.relic', art('relic:' + id, 'build-icon'), h('span', RELIC_BY_ID[id].name))));
  }
  // ------------------------------------------------------------ counterattack briefing
  /** What Counterattack is and how it flies, before the first stage (go launches it) or from the Missions panel. */
  function showCounterIntro(go) {
    // The field in miniature: the ship's airspace (it can climb to COUNTER_TOP) under the incoming squads.
    const top = FIELD.H - COUNTER_TOP, low = FIELD.H - FIELD.PLAYER_Y, sy = low - 16;
    const arrow = (x, y, r) => `<path d="M0 -7l4 5h-8z" transform="translate(${x} ${y}) rotate(${r})" fill="currentColor"/>`;
    const diagram = h('div.ca-intro-map', { 'aria-hidden': 'true', html: `<svg viewBox="0 0 100 150" focusable="false">
      <rect x="1" y="1" width="98" height="148" rx="6" class="f"/>
      <rect x="1" y="${top}" width="98" height="${149 - top}" rx="6" class="air"/>
      <line x1="4" y1="${top}" x2="96" y2="${top}" class="edge"/>
      ${[[26, 22], [50, 14], [74, 22], [38, 44], [62, 44]].map(([x, y]) => `<path d="M${x - 5} ${y - 3}l5 7 5-7-5 2z" class="foe"/>`).join('')}
      <g class="you"><path d="M50 ${sy - 7}l6 12-6-3-6 3z"/>${arrow(50, sy - 14, 0)}${arrow(50, sy + 12, 180)}${arrow(38, sy, 270)}${arrow(62, sy, 90)}</g>
      <text x="50" y="${top - 5}" class="lbl">YOUR AIRSPACE</text></svg>` });
    const tip = (title, text) => h('li', h('b', title), h('span', text));
    const el = h('div.modal.ca-intro', { role: 'dialog', 'aria-label': 'Counterattack briefing' },
      h('div.modal-head', h('div.kicker', 'New mode'), h('h2', 'Counterattack'), h('p', 'A vertical shooter. The invaders are falling back: chase them through six stages and take the fight to them.')),
      h('div.ca-intro-body', diagram, h('ul.ca-tips',
        tip('Fly anywhere', 'Drag to steer: up and down as well as side to side, anywhere in the lower half. W/A/S/D on a keyboard.'),
        tip('Press the attack', 'Flying higher hits harder: up to +25% damage at the top of your airspace. Some threats come at your height, so climb or dive to dodge them.'),
        tip('Dash through fire', 'Double-tap a side (Shift on a keyboard). Your guns fire on their own.'),
        tip('Break through', 'Each stage has its own hazards: wrecks, gas banks, a battleship, the hive, the singularity. A mini-boss holds the middle and a boss of its own waits at the end.'),
        tip('Earn stars', `Clear the stage, take ${STAR_HITS} hits or fewer, and destroy ${Math.round(STAR_KILLS * 100)}% of the assault force. Stars pay Alien Cores for Alien Tech, which powers up both modes.`))),
      h('div.modal-actions', go ? h('button.btn.ghost', { onclick: close }, 'Not yet') : null,
        h('button.btn.primary', { onclick: () => { close(); go?.(); }, 'data-autofocus': '' }, go ? 'Launch' : 'Got it')));
    mount('counter-intro', el, (e) => { if (e.key === 'Escape') { close(); return true; } return false; });
  }

  // ------------------------------------------------------------ the Station Siege briefing (first launch, and 'How it works')
  function showSiegeIntro(go) {
    const tip = (title, text) => h('li', h('b', title), h('span', text));
    const el = h('div.modal.ca-intro', { role: 'dialog', 'aria-label': 'Station Siege briefing' },
      h('div.modal-head', h('div.kicker', 'Station Siege'), h('h2', 'Man the guns'), h('p', 'Your counterattack stung them. Now they are coming for your station, and every stage you clear brings a bigger siege. You fight it from the station\'s own guns.')),
      h('ul.ca-tips',
        tip('Aim, and the cannons fire', 'Drag to aim. The twin cannons fire on their own at whatever is in the sights, and reload when the magazine runs dry.'),
        tip('Missiles for the armoured', 'Bombers, gunships and a capital ship\'s weak points (marked ◆) shrug off cannon fire. Hold the sights on one until the seeker locks, then fire.'),
        tip('Hold the station', 'Its hull is your life. Fighters strafe it, torpedoes and gunship beams hit hard. If it falls, the siege is lost.'),
        tip('Your station arms the guns', 'Every module you have built is a system here: harder rounds, a shield, armour, point defence, sentry guns and more. Maxed modules work harder. Pick an upgrade for the guns after every wave.'),
        tip('Hold it for rewards', `Stars for the hull you keep (an Alien Core each), salvage every time, and the first win at each tier pays ${SIEGE_BLUEPRINTS} Blueprints and fits the guns with something new for good.`),
        tip('Losing costs you', 'A lost siege knocks some of the station\'s systems offline. Repair them in Defence Control, or fly a sortie and the crews patch them free.')),
      h('div.modal-actions', go ? h('button.btn.ghost', { onclick: close }, 'Not yet') : null,
        h('button.btn.primary', { onclick: () => { close(); go?.(); }, 'data-autofocus': '' }, go ? 'Man the guns' : 'Got it')));
    mount('siege-intro', el, (e) => { if (e.key === 'Escape') { close(); return true; } return false; });
  }
  /** A yes-or-no question: { kicker, title, text, yes, no, danger, onYes, onNo }. */
  function showConfirm({ kicker, title, text, yes = 'OK', no = 'Cancel', danger = true, onYes, onNo }) {
    const done = (f) => { close(); f?.(); };
    const el = h('div.modal.confirm', { role: 'alertdialog', 'aria-label': title },
      h('div.modal-head', kicker ? h('div.kicker', kicker) : null, h('h2', title), text ? h('p', text) : null),
      h('div.modal-actions', h('button.btn.ghost', { onclick: () => done(onNo), 'data-autofocus': '' }, no), h('button.btn' + (danger ? '.danger' : '.primary'), { onclick: () => done(onYes) }, yes)));
    mount('confirm', el, (e) => { if (e.key === 'Escape') { done(onNo); return true; } return false; });
  }

  // ------------------------------------------------------------ a simple information panel (the Command Deck's exhibits)
  function showPanel({ kicker, title, body = [] }) {
    const el = h('div.modal.info-panel', { role: 'dialog', 'aria-label': title }, h('div.modal-head', kicker ? h('div.kicker', kicker) : null, h('h2', title)), ...body,
      h('div.modal-actions', h('button.btn.primary', { onclick: close, 'data-autofocus': '' }, 'Close')));
    mount('panel', el, (e) => { if (e.key === 'Escape') { close(); return true; } return false; });
  }

  // ------------------------------------------------------------ the station is complete (every Workshop upgrade maxed)
  function showStationComplete() {
    if (open) return;
    const rank = G.state.prestige?.level || 0, next = STATION_CORE.find((c) => c.at === rank + 1);
    const el = h('div.modal.confirm.station-done', { role: 'dialog', 'aria-label': 'Every module built' },
      h('div.modal-head', h('div.kicker', 'Every module built'), h('h2', next ? 'Ready to Overhaul' : 'Station complete'),
        h('p', `Your Workshop is maxed. Overhaul to strip it back for Blueprints: every module stays built${next ? `, and the station gains its ${next.name}` : ''}.`)),
      h('div.oh-plan.sd-plan', { html: stationBlueprint(rank, G.state.workshop, { peak: G.state.stationPeak, alien: G.state.counter?.tech, caught: caughtStages(G.state), name: G.state.stationName }) }),
      h('div.modal-actions', h('button.btn.gold', { onclick: () => { close(); hooks.toHangar?.('workshop'); }, 'data-autofocus': '' }, 'Go to Overhaul'), h('button.btn.ghost', { onclick: close }, 'Later')));
    mount('station-done', el, (e) => { if (e.key === 'Escape') { close(); return true; } return false; });
    playSfx('milestone');
  }

  // ------------------------------------------------------------ callsign
  /** Ask for the pilot's callsign. first: the first launch (or the first time since this arrived); fromSettings: return there. */
  function showCallsign({ first = false, fromSettings = false } = {}) {
    const cur = G.state.pilot.name || '';
    const input = h('input.callsign-input', { type: 'text', value: cur, maxLength: CALLSIGN_MAX, placeholder: 'Your callsign', autocomplete: 'nickname', autocapitalize: 'words', spellcheck: false, enterKeyHint: 'done', 'aria-label': 'Callsign', 'data-autofocus': '' });
    const ok = h('button.btn.primary', { onclick: () => done(true) }, first ? 'Confirm' : 'Save');
    const sync = () => { ok.disabled = !cleanCallsign(input.value); }; input.addEventListener('input', sync); sync();
    const back = () => (fromSettings ? showSettings(false) : close());
    function done(save) {
      if (save && !cleanCallsign(input.value)) return;
      let name = cur; if (save) name = setCallsign(input.value); else G.state.seen.callsign = true;
      input.blur(); back(); hooks.callsignSet?.(name, first && save);
    }
    const el = h('div.modal.confirm.callsign', { role: 'dialog', 'aria-label': 'Callsign' },
      h('div.mi-icon', art('ship:' + (G.state.ship || 'vanguard'))),
      h('div.modal-head', h('div.kicker', first ? 'Pilot registration' : 'Callsign'), h('h2', first ? 'Welcome, pilot' : 'Change callsign'),
        h('p', first ? 'Invaders are descending on the last orbit. Before you launch: what do they call you?' : 'The name on your pilot card.')),
      input,
      h('div.modal-actions', ok, h('button.btn.ghost', { onclick: () => done(false) }, first ? 'Skip for now' : 'Cancel')));
    mount('callsign', el, (e) => { if (e.key === 'Enter') { done(true); return true; } if (e.key === 'Escape') { done(false); return true; } return false; });
  }

  // ------------------------------------------------------------ naming the station
  // ------------------------------------------------------------ save backup: a code to keep somewhere safe, and restoring one
  // Progress lives on this device only, and iOS can clear a home-screen app's storage when space runs low.
  const DAY = 86400000, backedUp = () => (G.state.meta.lastBackup || 0) > 0;
  function backupAge() {
    const t = G.state.meta.lastBackup || 0; if (!t) return 'Back up now'; const days = Math.floor((Date.now() - t) / DAY);
    return days < 1 ? 'Backed up today' : days < 2 ? 'Backed up yesterday' : `Backed up ${days} days ago`;
  }
  /** Who a save belongs to and how far along it is, to recognise it by. */
  function saveCard(s) {
    const p = s.pilot || {}, st = s.stats || {}, row = (k, v) => h('div.db-row', h('small', k), h('b', String(v)));
    const when = s.meta?.lastSave ? new Date(s.meta.lastSave).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
    return h('div.deck-board.bk-card', row('Pilot', `${p.name || rankTitle(p.rank || 1)} · Rank ${p.rank || 1}`), row('Overhaul rank', s.prestige?.level || 0), row('Best wave', st.bestWave || '—'), row('Salvage', fmtInt(s.salvage || 0)), row('Sorties', fmtInt(st.sorties || 0)), row('Saved', when));
  }
  function showBackup() {
    const code = exportSave(), note = h('p.bk-note'), err = h('p.bk-err');
    const kept = (how) => { G.state.meta.lastBackup = Date.now(); hooks.saveNow?.('backup'); note.textContent = how; playSfx('unlock', 0.6); };
    // copy to the clipboard; where that is refused, select the code in a box so it can be copied by hand
    const box = h('textarea.bk-code', { readOnly: true, rows: 3, 'aria-label': 'Backup code' }); box.value = code; box.hidden = true;
    async function copy() {
      try { await navigator.clipboard.writeText(code); kept('Backup code copied. Paste it into Notes or an email to yourself.'); }
      catch { box.hidden = false; box.focus(); box.select(); note.textContent = 'Copy this code and keep it somewhere safe.'; }
    }
    async function share() {
      try { await navigator.share({ title: 'Last Orbit backup', text: code }); kept('Backup shared. Keep it somewhere safe.'); }
      catch (e) { if (e?.name !== 'AbortError') copy(); }
    }
    const input = h('textarea.bk-input', { rows: 3, placeholder: 'Paste a backup code', spellcheck: false, autocapitalize: 'off', autocomplete: 'off', 'aria-label': 'Backup code to restore' });
    const go = h('button.btn.ghost.wide', { disabled: true, onclick: () => {
      let s; try { s = importSave(input.value); } catch (e) { err.textContent = e?.code === 'NEWER_SAVE' ? 'That backup comes from a newer version of Last Orbit. Update the game first.' : 'That doesn\'t look like a Last Orbit backup code. Check you copied all of it.'; playSfx('deny'); return; }
      confirmRestore(s);
    } }, 'Restore from code');
    input.addEventListener('input', () => { go.disabled = !input.value.trim(); err.textContent = ''; });
    const el = h('div.modal.backup', { role: 'dialog', 'aria-label': 'Save backup' },
      h('div.modal-head', h('div.kicker', 'Settings'), h('h2', 'Save backup'), h('p', 'Your progress is kept on this device only, and iOS can clear a home-screen app\'s storage when the phone runs low on space. Keep a backup code somewhere safe, like Notes or an email to yourself.')),
      saveCard(G.state),
      h('div.bk-actions', navigator.share ? h('button.btn.gold', { onclick: share }, uiIcon('share'), 'Share backup') : null, h('button.btn' + (navigator.share ? '.ghost' : '.gold'), { onclick: copy }, 'Copy code')),
      note, box,
      h('h3.bk-h', 'Restore'), h('p.sub-note', 'Paste a backup code to bring that progress onto this device.'), input, err, go,
      h('div.modal-actions', h('button.btn.primary', { onclick: () => showSettings(false), 'data-autofocus': '' }, 'Done')));
    mount('backup', el, (e) => { if (e.key === 'Escape') { showSettings(false); return true; } return false; });
  }
  function confirmRestore(s) {
    const el = h('div.modal.confirm', { role: 'alertdialog', 'aria-label': 'Restore this save?' },
      h('div.modal-head', h('div.kicker', 'Save backup'), h('h2', 'Restore this save?'), h('p', 'It replaces all the progress on this device, and it cannot be undone. Back up this device first if you might want its progress back.')),
      saveCard(s),
      h('div.modal-actions', h('button.btn.ghost', { onclick: () => showBackup(), 'data-autofocus': '' }, 'Cancel'), h('button.btn.danger', { onclick: () => { close(); hooks.restoreSave?.(s); } }, 'Restore')));
    mount('confirm', el, (e) => { if (e.key === 'Escape') { showBackup(); return true; } return false; });
  }

  function showStationName({ fromSettings = false } = {}) {
    const cur = G.state.stationName || '';
    const input = h('input.callsign-input', { type: 'text', value: cur, maxLength: STATION_NAME_MAX, placeholder: 'e.g. Halcyon', autocomplete: 'off', autocapitalize: 'words', spellcheck: false, enterKeyHint: 'done', 'aria-label': 'Station name', 'data-autofocus': '' });
    const ok = h('button.btn.primary', { onclick: () => done(true) }, 'Save');
    const sync = () => { ok.disabled = !cleanStationName(input.value); }; input.addEventListener('input', sync); sync();
    const back = () => (fromSettings ? showSettings(false) : close());
    function done(save) { if (save && !cleanStationName(input.value)) return; if (save) { setStationName(input.value); playSfx('unlock', 0.6); } input.blur(); back(); hooks.stationNamed?.(); }
    const el = h('div.modal.confirm.callsign', { role: 'dialog', 'aria-label': 'Station name' },
      h('div.mi-icon', uiIcon('deck')),
      h('div.modal-head', h('div.kicker', 'Station registry'), h('h2', cur ? 'Rename your station' : 'Name your station'), h('p', cur ? 'The name on your station and your Command Deck.' : 'Every rebuild needs a name. What will they call it?')),
      input, h('div.modal-actions', ok, h('button.btn.ghost', { onclick: () => done(false) }, 'Cancel')));
    mount('station-name', el, (e) => { if (e.key === 'Enter') { done(true); return true; } if (e.key === 'Escape') { done(false); return true; } return false; });
  }

  // ------------------------------------------------------------ a menu opening for the first time
  function showMenuIntro(m) {
    if (!m || open) return;
    const el = h('div.modal.confirm.menu-intro', { role: 'dialog', 'aria-label': m.title },
      h('div.mi-icon', uiIcon(m.icon)), h('div.modal-head', h('div.kicker', m.kicker || 'New menu'), h('h2', m.title), h('p', m.text)),
      h('div.modal-actions', h('button.btn.primary', { onclick: close, 'data-autofocus': '' }, 'Got it')));
    mount('menu-intro', el, (e) => { if (e.key === 'Escape' || e.key === 'Enter') { close(); return true; } return false; });
    playSfx('unlock', 0.7);
  }

  // ------------------------------------------------------------ overhaul
  function showOverhaul() {
    const st = G.state, bp = overhaulReward(), head = blueprintLevel('bp_head'), rank = st.prestige.level + 1, trail = TRAILS.find((t) => t.at === rank), piece = STATION_CORE.find((c) => c.at === rank);
    const list = (title, items, cls) => h('div.oh-col' + cls, h('b', title), h('ul', items.map((t) => h('li', t))));
    const el = h('div.modal.confirm.oh-confirm', { role: 'alertdialog', 'aria-label': 'Overhaul the Workshop?' },
      h('div.modal-head', h('div.kicker', `Overhaul rank ${rank}`), h('h2', 'Overhaul?'), h('p', `Every Workshop upgrade goes back to ${head ? 'level ' + head + ' (Head Start)' : 'zero'}. Your next few sorties will be tougher while you rebuild, and each rank makes the Workshop ${Math.round(OVERHAUL_COST_STEP * 100)}% dearer.`)),
      h('div.oh-cols', list('You get', [`${bp} Blueprints`, piece ? `Station: the ${piece.name}` : null, 'Overhaul rank ' + rank + ': +10% salvage, +2% damage', trail ? `${trail.name} engine trail` : null, rank === 1 ? 'Overhaul Log legendary banner' : null].filter(Boolean), '.get'),
        list('You keep', ['Your station: every module stays built', 'Salvage in the bank', 'Ships, weapons and abilities', 'Paints, banners and ranks', 'Mastery, medals and records', 'Counterattack and Alien Tech', 'Blueprints and escorts'], '.keep')),
      h('div.modal-actions', h('button.btn.ghost', { onclick: close, 'data-autofocus': '' }, 'Not yet'),
        h('button.btn.gold', { onclick: () => { const got = overhaul(); close(); if (got) hooks.overhauled?.(got); } }, 'Overhaul')));
    mount('confirm', el, (e) => { if (e.key === 'Escape') { close(); return true; } return false; });
  }

  function confirmAbandon() {
    const el = h('div.modal.confirm', { role: 'alertdialog', 'aria-label': 'Abandon sortie?' },
      h('div.modal-head', h('h2', 'Abandon sortie?'), h('p', 'You keep the salvage collected so far. Cards and relics are lost.')),
      h('div.modal-actions', h('button.btn.ghost', { onclick: showPause, 'data-autofocus': '' }, 'Keep flying'), h('button.btn.danger', { onclick: () => { close(); hooks.abandon(); } }, 'Abandon')));
    mount('confirm', el, (e) => { if (e.key === 'Escape') { showPause(); return true; } return false; });
  }
  function showSettings(fromPause) {
    const el = h('div.modal.settings-modal', { role: 'dialog', 'aria-label': 'Settings' },
      h('div.modal-head', h('h2', 'Settings')), settingsBody(fromPause),
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
    const ship = SHIP_BY_ID[s.ship], ca = s.counter, win = ca?.cleared ? 'Stage cleared' : s.reason === 'abandoned' ? 'Sortie abandoned' : 'Signal lost';
    const salvageEl = h('b.count', '0');
    const done = s.contracts.map((id) => CONTRACT_BY_ID[id]);
    const el = h('div.modal.debrief', { role: 'dialog', 'aria-label': 'Sortie debrief' },
      h('div.modal-head' + (ca?.cleared ? '.won' : ''), h('div.kicker', ca ? `${ship.name} · Counterattack · Stage ${ca.stage}${ca.hard ? ' · Hard' : ''}` : `${ship.name} · Sector ${s.sector} · ${s.sectorName}` + (s.threat ? ` · Threat ${THREATS[s.threat].roman}` : '') + (s.mutator ? ` · Daily: ${MUTATOR_BY_ID[s.mutator].name}` : '') + (s.warp > 1 ? ` · Warp S${s.warp}` : '')), h('h2', win), h('div.pbs', s.highScore ? h('div.pb', 'New high score') : null, s.best && s.wave > 1 ? h('div.pb', 'New best wave') : null)),
      ca ? h('div.stars-row', [1, 2, 3].map((i) => h('span.star-big' + (i <= ca.stars ? '.on' : '') + (i > ca.stars - ca.gained && i <= ca.stars ? '.new' : ''), { style: `--d:${i * 180}ms` }, '★')),
        h('div.star-notes', h('small', (ca.cleared ? '✓' : '·') + ' Clear the stage'), h('small', (ca.hits <= 5 && ca.cleared ? '✓' : '·') + ` Take 5 hits or fewer (${ca.hits})`), h('small', (ca.killed >= 0.8 && ca.cleared ? '✓' : '·') + ` Destroy 80% of the assault (${Math.round(ca.killed * 100)}%)`)),
        ca.cores ? h('div.pilot-row.cores-row', h('span', 'Alien Cores'), h('b', '+' + ca.cores)) : null, ca.bounty ? h('div.pilot-row', h('span', 'First-clear bounty'), h('b', '+' + fmtInt(ca.bounty) + ' salvage')) : null,
        ca.trophy ? h('div.pilot-row.trophy-row', h('span', `${TROPHY_BY_ID['trophy' + ca.trophy]?.name} captured`), h('b', 'Towed to your station')) : null,
        ca.siegeUnlocked ? h('div.pilot-row.siege-row', h('span', 'They will retaliate'), h('b', 'Station Siege unlocked')) : null,
        ca.checkpoint ? h('div.pilot-row', h('span', 'Checkpoint saved'), h('b', 'Past the mini-boss')) : null, ca.resumed ? h('small.cp-note', 'Checkpoint run: the clear star only. Fly the whole stage for the other two.') : null) : null,
      h('div.hero-row', ca ? h('div.big-wave', h('small', 'Stage'), h('b', String(ca.stage))) : h('div.big-wave', h('small', 'Wave'), h('b', String(s.wave))), h('div.earned', h('small', 'Salvage banked'), h('div', art('cur:salvage', 'cur-ico'), salvageEl))),
      h('div.score-row', h('small', 'Score'), h('b', fmtInt(s.score || 0)), s.place ? h('span', `#${s.place} of your top 10`) : s.prevScore ? h('span', `Best ${fmtInt(s.prevScore)}`) : null),
      h('div.stat-grid', stat('Level', s.level), stat('Kills', fmtInt(s.kills)), stat('Bosses', s.bosses), stat('Time', fmtTime(s.time))),
      s.daily ? h('div.earned.daily-earned', h('small', `Daily bonus · ${s.daily.streak}-day streak`), h('div', art('cur:salvage', 'cur-ico'), '+' + fmtInt(s.daily.bonus))) : null,
      s.repaired?.length ? h('div.pilot-row.sg-fixed', h('span', 'Station repaired while you were out'), h('b', `${s.repaired.length} system${s.repaired.length > 1 ? 's' : ''} back online`)) : null,
      s.repaired === null ? h('div.pilot-row.sg-short', h('span', 'Too short for the repair crews'), h('b', 'Stay out a minute or more')) : null,
      s.mastery ? h('div.pilot-row.mastery-row', h('span', `${SHIP_BY_ID[s.ship].name} mastery ${s.mastery.to}` + (s.mastery.to > s.mastery.from ? ' · level up!' : '')), h('b', '+' + s.mastery.gained)) : null,
      s.pilot ? h('div.pilot-xp', h('div.pilot-row', h('span', s.pilot.to > s.pilot.from ? `Rank up! ${rankTitle(s.pilot.to)} · Rank ${s.pilot.to}` : `Pilot rank ${s.pilot.to}`), h('b', '+' + fmtInt(s.pilot.gained) + ' XP')),
        h('div.meter.rank', h('i', { style: `width:${(pilotProgress() * 100).toFixed(1)}%` })),
        s.pilot.rewards.length ? h('div.rank-rewards', s.pilot.rewards.map((r) => h('span.reward' + (r.paint ? '.paint' : ''), r.paint ? `${PAINT_BY_ID[r.paint].name} paint unlocked` : [art('cur:salvage', 'cur-ico'), '+' + fmtInt(r.salvage)]))) : null) : null,
      s.counterUnlocked ? h('div.unlocks.medals', h('div.unlock', art('ship:striker', 'build-icon'), h('b', 'Counterattack unlocked'), h('small', 'The invaders are retreating. Take the fight to them in Missions.'))) : null,
      s.intel ? h('div.pilot-row.intel-row', h('span', `Boss intel on ${BOSSES[s.intel.id]?.name || 'the boss'}: level ${s.intel.level}`), h('b', `+${Math.round(s.intel.level * BAL.intelStep * 100)}% damage`)) : null,
      s.medals?.length ? h('div.unlocks.medals', h('div.kicker', `Achievements earned (${s.medals.length})`), s.medals.map((m) => { const a = ACHIEVEMENTS.find((x) => x.id === m.id) || FEATS.find((x) => x.id === m.id), tier = a.goals ? TIERS[m.tier].id : 'feat';
        return h('div.unlock', h('span.medal-frame.sm.tier-' + tier, art(a.art, 'medal-ico')), h('b', a.name), h('small', `${a.goals ? TIERS[m.tier].name : 'Feat'} · ${medalDesc(a, m.tier)} · +${m.xp} XP`)); })) : null,
      s.banners?.length ? h('div.unlocks.medals', h('div.kicker', 'Banners unlocked'), s.banners.map((id) => h('div.unlock', art('ach:flag', 'build-icon'), h('b', BANNER_BY_ID[id].name), h('small', 'Fly it from the Ships tab')))) : null,
      done.length ? h('div.unlocks', h('div.kicker', `Contracts complete (${done.length})`), done.map((c) => h('div.unlock', uiIcon('check'), h('b', c.name), h('small', `+${c.salvage} salvage` + (c.unlock ? ' · ' + unlockLabel(c.unlock) : ''))))) : null,
      h('div.build', s.weapons.map(([id, r]) => h('div.build-item', { style: `--c:#${WEAPONS[id].color.toString(16).padStart(6, '0')}` }, art('weapon:' + id, 'build-icon'), h('span', WEAPONS[id].name), h('b', 'R' + r))), s.relics.map((id) => h('div.build-item.relic', art('relic:' + id, 'build-icon'), h('span', RELIC_BY_ID[id].name)))),
      s.daily ? h('button.btn.gold.share-btn.wide', { onclick: async () => { const r = await shareText(dailyShareText({ key: G.state.daily.lastDay, mutator: MUTATOR_BY_ID[s.mutator]?.name, wave: s.wave, score: s.score, streak: s.daily.streak })); if (r === 'copied') hooks.toast?.('Result copied. Paste it to a friend!'); else if (r === 'failed') hooks.toast?.('Could not share from this browser.'); } }, uiIcon('share'), 'Share daily result') : null,
      ca ? h('div.modal-actions', h('button.btn.primary', { onclick: () => { close(); hooks.relaunch(false); }, 'data-autofocus': '' }, uiIcon('reroll'), 'Retry stage'),
          ca.checkpoint ? h('button.btn.gold', { onclick: () => { close(); hooks.relaunch(false, { checkpoint: true }); } }, uiIcon('launch'), 'From checkpoint') : null,
          ca.cleared && ca.stage < 6 && !ca.hard ? h('button.btn.gold', { onclick: () => { close(); hooks.relaunch(true); } }, uiIcon('launch'), 'Next stage') : null,
          h('button.btn.ghost.wide', { onclick: () => { close(); hooks.toHangar('missions'); } }, uiIcon('missions'), 'Missions')) :
      h('div.modal-actions', h('button.btn.primary', { onclick: () => { close(); hooks.launch(); }, 'data-autofocus': '' }, uiIcon('launch'), s.daily ? 'Launch a sortie' : 'Launch again'),
        h('button.btn.gold', { onclick: () => { close(); hooks.toHangar('workshop'); } }, uiIcon('workshop'), 'Workshop'),
        h('button.btn.ghost.wide', { onclick: () => { close(); hooks.toHangar('launch'); } }, uiIcon('home'), 'Back to hangar')));
    mount('debrief', el, () => false);
    // Count the salvage up for a little payoff.
    // Each change of the counter ticks (rate-limited in audio), rising in pitch as it climbs, and it lands on a chime.
    const target = s.salvage, dur = Math.min(1400, 400 + target * 3); let t0 = 0, shown = -1;
    const tick = (now) => { t0 ||= now; const k = Math.min(1, (now - t0) / dur), v = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (v !== shown) { shown = v; salvageEl.textContent = fmtInt(v); if (k < 1 && target > 0) playSfx('count', 0.9, 1 + k * 0.7); }
      if (k < 1 && salvageEl.isConnected) requestAnimationFrame(tick); else if (k >= 1) playSfx('loot'); };
    setTimeout(() => requestAnimationFrame(tick), 350);
  }
  const stat = (k, v) => h('div.stat', h('small', k), h('b', String(v)));

  // ------------------------------------------------------------ a siege's end (the gunner seat)
  /** What a siege earned (stars stamped in one by one, the salvage counted up, Alien Cores, Blueprints, the guns' new gear
   *  and any repairs) or cost (the systems knocked offline, and how to get them back), with ORBIT's word on it.
   *  r: progression/siege.js settleSiege(); acts: { again, next, repair, control }. */
  function showSiegeDebrief(r, acts = {}) {
    const t = TIER_BY_N[r.tier], won = r.won, salvageEl = h('b.count', '0'), m = r.gun ? TURRET_MOD[r.gun] : null, sys = (id) => SYSTEM_BY_ID[id];
    const broke = r.broke || [], names = listNames(broke.map((id) => sys(id)?.name.toLowerCase() || id));
    const say = won ? (m ? `Siege broken, {n}! The armoury has fitted the guns for good: ${m.name}.` : r.stars === 3 ? 'Not a scratch on us, {n}. They will think twice next time.' : 'They broke on our guns, {n}. Well held.') + (r.repaired?.length ? ' And the crews have us patched up.' : '')
      : broke.length ? `${r.abandoned ? 'You left the guns, {n}, and they' : 'They'} got through. We lost our ${names}. Fly a sortie and the crews will patch us up, or repair us here.` : 'They got through, {n}, but there was nothing online left for them to break.';
    const orbit = say.replace(/\{n\}/g, G.state.pilot.name || 'pilot');
    const el = h('div.modal.debrief.sg-debrief', { role: 'dialog', 'aria-label': 'Siege debrief' },
      h('div.modal-head' + (won ? '.won' : '.lost'), h('div.kicker', `Station Siege · Tier ${t.n} · ${t.name}`), h('h2', won ? 'Station held' : r.abandoned ? 'Siege abandoned' : 'Station lost'),
        h('div.pbs', won && r.first ? h('div.pb', 'First hold') : null, won && r.newBest ? h('div.pb', 'New best score') : null)),
      h('div.stars-row', [1, 2, 3].map((i) => h('span.star-big' + (i <= r.stars ? '.on' : '') + (i > r.stars - (r.gained || 0) && i <= r.stars ? '.new' : ''), { style: `--d:${i * 260}ms` }, '★')),
        h('div.star-notes', SIEGE_STARS.map(([label, need], i) => h('small', (won && r.hull >= need ? '✓' : '·') + ' ' + label + (i ? ` (${Math.round(r.hull * 100)}%)` : '')))),
        r.cores ? h('div.pilot-row.cores-row', h('span', 'Alien Cores'), h('b', '+' + r.cores)) : null,
        r.bp ? h('div.pilot-row.bp-row', h('span', 'First hold of this tier'), h('b', `+${r.bp} Blueprints`)) : null),
      h('div.hero-row', h('div.big-wave', h('small', 'Station'), h('b', Math.round(r.hull * 100) + '%')),
        h('div.earned', h('small', won && r.first ? 'Salvage · doubled' : 'Salvage'), h('div', art('cur:salvage', 'cur-ico'), salvageEl))),
      h('div.score-row', h('small', 'Score'), h('b', fmtInt(r.score)), h('span', `${fmtInt(r.kills)} invaders downed`)),
      m ? h('div.unlocks.medals.sg-gun', h('div.kicker', 'New for your guns, for good'), h('div.unlock', art(m.art, 'build-icon'), h('b', m.name), h('small', m.desc))) : null,
      r.repaired?.length ? h('div.pilot-row.sg-fixed', h('span', 'Repairs done'), h('b', `${r.repaired.length} system${r.repaired.length > 1 ? 's' : ''} back online`)) : null,
      !won ? h('div.sg-broke', h('div.kicker', 'Damage report'),
        broke.length ? h('div.sg-defs', broke.map((id) => h('div.sg-def.s0.dmg', h('i.sg-dot'), h('div', h('b', sys(id)?.name || id), h('small', 'Offline until repaired'))))) : null,
        h('p', broke.length ? `Repair them in Defence Control for ${fmtInt(r.cost)} salvage, or fly a sortie of a minute or more and the crews patch them for free.` : 'Nothing of the station\'s was online to knock out.')) : null,
      h('p.sg-orbit', h('b', 'ORBIT'), h('span', orbit)),
      h('div.modal-actions',
        won && acts.next ? h('button.btn.gold', { onclick: () => { close(); acts.next(); } }, uiIcon('launch'), 'Next siege') : null,
        h('button.btn.primary', { onclick: () => { close(); acts.again?.(); }, 'data-autofocus': '' }, uiIcon('reroll'), won ? 'Fly it again' : 'Try again'),
        !won && broke.length && acts.repair ? h('button.btn.gold', { onclick: () => { close(); acts.repair(); } }, 'Repair') : null,
        h('button.btn.ghost.wide', { onclick: () => { close(); acts.control?.(); } }, uiIcon('control'), 'Defence Control')));
    mount('debrief', el, () => false);
    playSfx(won ? 'milestone' : 'deny', won ? 0.8 : 0.5);
    const target = won ? r.salvage : 0, dur = Math.min(1400, 400 + target * 3); let t0 = 0, shown = -1;
    const tick = (now) => { t0 ||= now; const k = Math.min(1, (now - t0) / dur), v = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (v !== shown) { shown = v; salvageEl.textContent = fmtInt(v); if (k < 1 && target > 0) playSfx('count', 0.9, 1 + k * 0.7); }
      if (k < 1 && salvageEl.isConnected) requestAnimationFrame(tick); else if (k >= 1 && target) playSfx('loot'); };
    setTimeout(() => requestAnimationFrame(tick), 900);
  }
  // Small readout to help diagnose layout on unusual screens (e.g. installed home-screen apps).
  const displayInfo = () => {
    const app = document.getElementById('app'), sa = getComputedStyle(document.documentElement), standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    return `v${document.querySelector('script[type=importmap]')?.textContent.match(/v=([0-9.]+)/)?.[1] || '?'} · ${standalone ? 'app' : 'browser'} · screen ${screen.width}×${screen.height} · window ${innerWidth}×${innerHeight} · game ${Math.round(app.clientHeight)}`;
  };

  return {
    showOffer, showRelics, showRoutes, showAnomalies, showPause, showSettings, showDebrief, showLoadout, showCounterIntro, showOverhaul, showMenuIntro, showCallsign, showStationComplete, showPanel, showStationName, showSiegeIntro, showConfirm, showSiegeDebrief, close,
    get kind() { return open?.kind || null; },
    /** Combat freezes while any overlay is up. */
    blocking: () => !!open,
    key: (e) => !!open?.keys?.(e),
  };
}
