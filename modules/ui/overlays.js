// Full-screen moments that pause combat: level-up cards, relic choice, pause/settings and the sortie debrief.
import { G } from '@last-orbit/core/game.js';
import { fmt, fmtInt, fmtTime } from '@last-orbit/core/format.js';
import { RARITY } from '@last-orbit/data/cards.js';
import { RELIC_BY_ID } from '@last-orbit/data/relics.js';
import { WEAPONS } from '@last-orbit/data/weapons.js';
import { SHIP_BY_ID } from '@last-orbit/data/ships.js';
import { CONTRACT_BY_ID } from '@last-orbit/data/contracts.js';
import { describeCard, pickCard, reroll, pickRelic } from '@last-orbit/progression/run.js';
import { unlockLabel, pilotProgress } from '@last-orbit/progression/meta.js';
import { PAINT_BY_ID, rankTitle } from '@last-orbit/data/career.js';
import { applyVolumes, playSfx } from '@last-orbit/audio/audio.js';
import { h, clear, toggle, slider, select } from '@last-orbit/ui/dom.js';
import { uiIcon } from '@last-orbit/ui/icons.js';
import { art } from '@last-orbit/ui/art.js';

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
        h('div.card-art', art(d.icon, 'card-icon')),
        h('div.card-main', h('div.card-kicker', h('span', d.kicker), h('span.rar', c.kind === 'upgrade' ? (c.rarity === 'evo' ? 'Final evolution' : 'Upgrade') : c.kind === 'weapon' ? 'Weapon' : c.kind === 'ability' ? 'Ability' : rar.name)), h('div.card-title', d.title), h('div.card-body', d.body)),
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

  // ------------------------------------------------------------ pause / settings
  function settingsBody() {
    const s = G.state.settings, set = (k) => (v) => { s[k] = v; applyVolumes(); hooks.applySettings?.(); };
    const field = (label, control) => h('label.field', h('span', label), control);
    return h('div.settings',
      field('Master volume', slider(() => s.master, set('master'), 0, 1, 0.05, 'Master volume')),
      field('Music', slider(() => s.music, set('music'), 0, 1, 0.05, 'Music volume')),
      field('Sound effects', slider(() => s.sfx, set('sfx'), 0, 1, 0.05, 'Sound effects volume')),
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
      buildSummary(run),
      h('div.modal-actions', h('button.btn.primary', { onclick: close, 'data-autofocus': '' }, uiIcon('play'), 'Resume'),
        h('button.btn.ghost', { onclick: () => showSettings(true) }, uiIcon('gear'), 'Settings'),
        h('button.btn.danger', { onclick: () => confirmAbandon() }, 'Abandon sortie')));
    mount('pause', el, (e) => { if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { close(); return true; } return false; });
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
        fromPause ? null : h('button.btn.danger.small', { onclick: () => confirmReset() }, 'Erase save')));
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
      h('div.modal-head', h('div.kicker', `${ship.name} · Sector ${s.sector} · ${s.sectorName}`), h('h2', win), s.best && s.wave > 1 ? h('div.pb', 'New best wave') : null),
      h('div.hero-row', h('div.big-wave', h('small', 'Wave'), h('b', String(s.wave))), h('div.earned', h('small', 'Salvage banked'), h('div', art('cur:salvage', 'cur-ico'), salvageEl))),
      h('div.stat-grid', stat('Level', s.level), stat('Kills', fmtInt(s.kills)), stat('Bosses', s.bosses), stat('Time', fmtTime(s.time))),
      s.pilot ? h('div.pilot-xp', h('div.pilot-row', h('span', s.pilot.to > s.pilot.from ? `Rank up! ${rankTitle(s.pilot.to)} · Rank ${s.pilot.to}` : `Pilot rank ${s.pilot.to}`), h('b', '+' + fmtInt(s.pilot.gained) + ' XP')),
        h('div.meter.rank', h('i', { style: `width:${(pilotProgress() * 100).toFixed(1)}%` })),
        s.pilot.rewards.length ? h('div.rank-rewards', s.pilot.rewards.map((r) => h('span.reward' + (r.paint ? '.paint' : ''), r.paint ? `${PAINT_BY_ID[r.paint].name} paint unlocked` : [art('cur:salvage', 'cur-ico'), '+' + fmtInt(r.salvage)]))) : null) : null,
      done.length ? h('div.unlocks', h('div.kicker', `Contracts complete (${done.length})`), done.map((c) => h('div.unlock', uiIcon('check'), h('b', c.name), h('small', `+${c.salvage} salvage` + (c.unlock ? ' · ' + unlockLabel(c.unlock) : ''))))) : null,
      h('div.build', s.weapons.map(([id, r]) => h('div.build-item', { style: `--c:#${WEAPONS[id].color.toString(16).padStart(6, '0')}` }, art('weapon:' + id, 'build-icon'), h('span', WEAPONS[id].name), h('b', 'R' + r))), s.relics.map((id) => h('div.build-item.relic', art('relic:' + id, 'build-icon'), h('span', RELIC_BY_ID[id].name)))),
      h('div.modal-actions', h('button.btn.primary', { onclick: () => { close(); hooks.launch(); }, 'data-autofocus': '' }, uiIcon('launch'), 'Launch again'),
        h('button.btn.gold', { onclick: () => { close(); hooks.toHangar('workshop'); } }, uiIcon('workshop'), 'Workshop'),
        h('button.btn.ghost.wide', { onclick: () => { close(); hooks.toHangar('launch'); } }, uiIcon('home'), 'Back to hangar')));
    mount('debrief', el, () => false);
    // Count the salvage up for a little payoff.
    const target = s.salvage, t0 = performance.now(), dur = Math.min(1400, 400 + target * 3);
    const tick = (now) => { const k = Math.min(1, (now - t0) / dur); salvageEl.textContent = fmtInt(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1 && salvageEl.isConnected) requestAnimationFrame(tick); else if (k >= 1) playSfx('loot'); };
    setTimeout(() => requestAnimationFrame(tick), 350);
  }
  const stat = (k, v) => h('div.stat', h('small', k), h('b', String(v)));

  return {
    showOffer, showRelics, showPause, showSettings, showDebrief, close,
    get kind() { return open?.kind || null; },
    /** Combat freezes while any overlay is up. */
    blocking: () => !!open,
    key: (e) => !!open?.keys?.(e),
  };
}
