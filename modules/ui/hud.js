// In-sortie HUD: sector/wave track, XP bar, salvage, boss bar, loadout strip, hull/shield bars and ability buttons.
import { G } from '@last-orbit/core/game.js';
import { fmt, fmtInt } from '@last-orbit/core/format.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { waveKind } from '@last-orbit/combat/waves.js';
import { ABILITIES } from '@last-orbit/data/abilities.js';
import { WEAPONS } from '@last-orbit/data/weapons.js';
import { RELIC_BY_ID } from '@last-orbit/data/relics.js';
import { BAL } from '@last-orbit/data/balance.js';
import { THREATS } from '@last-orbit/data/threat.js';
import { ROUTE_BY_ID } from '@last-orbit/data/routes.js';
import { useAbility, abilityCooldown, abilityMaxCharges } from '@last-orbit/combat/abilities.js';
import { xpProgress } from '@last-orbit/progression/run.js';
import { h, clear, setText, setClass, setWidth } from '@last-orbit/ui/dom.js';
import { uiIcon } from '@last-orbit/ui/icons.js';
import { art } from '@last-orbit/ui/art.js';
import { SHIP_BY_ID } from '@last-orbit/data/ships.js';
import { FUSION_BY_ID } from '@last-orbit/data/fusions.js';

export function createHud(hooks) {
  const $ = {};
  $.pause = h('button.icon-btn', { 'aria-label': 'Pause', onclick: (e) => { e.currentTarget.blur(); hooks.pause(); } }, uiIcon('pause'));
  $.sector = h('div.sector-name'); $.waveN = h('b'); $.pips = h('div.pips', { 'aria-hidden': 'true' });
  $.salvage = h('span');
  $.level = h('b'); $.xp = h('i'); $.score = h('b');
  $.bossName = h('span'); $.bossHp = h('i'); $.boss = h('div.bossbar', { hidden: true }, h('div.boss-label', art('relic:r_giant', 'boss-ico'), $.bossName), h('div.meter.boss', $.bossHp));
  const top = h('div#hud',
    h('div.hud-top', $.pause,
      h('div.wave-block', $.sector, h('div.wave-line', h('small', 'WAVE'), $.waveN, $.pips)),
      h('div.chip.salvage', { title: 'Salvage collected this sortie' }, art('cur:salvage', 'cur-ico'), $.salvage)),
    h('div.xp-row', h('div.lv', h('small', 'LV'), $.level), h('div.meter.xp', $.xp), h('div.hud-score', h('small', 'SCORE'), $.score)),
    $.boss);

  $.loadout = h('div.loadout');
  $.hullTxt = h('span.val'); $.hull = h('i'); $.shield = h('i'); $.shieldTxt = h('span.val');
  $.shieldRow = h('div.bar-row.shield-row', h('span.lbl', 'SHIELD'), h('div.meter.shield', $.shield), $.shieldTxt);
  $.abil = h('div.abilities');
  const dock = h('div#dock',
    $.loadout,
    h('div.dock-row',
      h('div.bars', $.shieldRow, h('div.bar-row', h('span.lbl', 'HULL'), h('div.meter.hull', $.hull), $.hullTxt)),
      $.abil));
  $.hint = h('div.fly-hint', h('b', 'Hold a side or drag to steer'), h('span', 'Double-tap a side to dash through fire. Your guns shoot on their own; tap an enemy to focus it.'));
  const el = h('div.hud-layer', top, dock, $.hint);

  let pipSig = '', loadSig = '', abilSig = '', hintT = 0;
  const abilBtns = {};
  function buildPips(wave) {
    const sec = sectorOf(wave), sig = sec.start + ':' + sec.len; if (sig === pipSig) return; pipSig = sig; clear($.pips);
    for (let i = 0; i < sec.len; i++) { const k = waveKind(sec.start + i); $.pips.append(h('span.pip.' + k)); }
  }
  function buildLoadout(run) {
    const sig = run.order.map((id) => id + run.weapons[id]).join() + '|' + run.relics.join() + '|' + (run.fusions || []).join() + (run.signature ? '*' : ''); if (sig === loadSig) return; loadSig = sig; clear($.loadout);
    const special = (id) => (run.signature && SHIP_BY_ID[run.ship]?.weapon === id) || (run.fusions || []).some((f) => FUSION_BY_ID[f].a === id || FUSION_BY_ID[f].b === id);
    for (const id of run.order) {
      const r = run.weapons[id], pips = h('span.rank', { 'aria-hidden': 'true' }); for (let i = 1; i <= BAL.maxRank; i++) pips.append(h('i' + (i <= r ? '.on' : '')));
      $.loadout.append(h('div.gun' + (special(id) ? '.special' : ''), { 'data-key': 'weapon:' + id, title: `${WEAPONS[id].name} rank ${r}`, style: `--c:#${WEAPONS[id].color.toString(16).padStart(6, '0')}` }, art('weapon:' + id, 'gun-icon'), pips));
    }
    for (const id of run.relics) $.loadout.append(h('div.relic-mini', { 'data-key': 'relic:' + id, title: RELIC_BY_ID[id].name }, art('relic:' + id, 'gun-icon')));
  }
  function buildAbilities(run) {
    const sig = run.abilities.join(); if (sig === abilSig) return; abilSig = sig; clear($.abil);
    run.abilities.forEach((id, i) => {
      const d = ABILITIES[id], ring = h('i.cd'), charges = h('span.charges');
      const b = h('button.abil', { 'aria-label': d.name, style: `--c:${d.color}`, onclick: (e) => { e.currentTarget.blur(); if (G.world) useAbility(G.world, id); } }, art('ability:' + id, 'abil-icon'), ring, charges, h('span.key', String(i + 1)));
      abilBtns[id] = { b, ring, charges }; $.abil.append(b);
    });
  }

  function update(dt) {
    const run = G.state.run, w = G.world; if (!run || !w) return;
    const waveShown = w.wave.num || run.wave, sec = sectorOf(waveShown);
    buildPips(waveShown); buildLoadout(run); buildAbilities(run);
    setText($.sector, `Sector ${sec.idx + 1} · ${sec.def.name}` + (run.mutator ? ' · Daily' : run.threat ? ` · Threat ${THREATS[run.threat].roman}` : '') + (run.route ? ' · ' + ROUTE_BY_ID[run.route].name : '')); setText($.waveN, `${sec.n}/${sec.len}`);
    const cur = sec.n - 1, cleared = w.wave.state === 'cleared';
    const pips = $.pips.children; for (let i = 0; i < pips.length; i++) { setClass(pips[i], 'done', i < cur || (i === cur && cleared)); setClass(pips[i], 'now', i === cur && !cleared); }
    setText($.salvage, fmt(Math.floor(run.salvage)));
    setText($.score, fmtInt(run.score || 0)); setClass($.score, 'hot', !!run.beatBest);
    setText($.level, String(run.level)); setWidth($.xp, xpProgress(run));
    const p = w.player; setWidth($.hull, p.hull); setText($.hullTxt, Math.max(0, Math.round(p.hull * 100)) + '%'); setClass($.hull.parentNode, 'low', p.hull < 0.3);
    const hasShield = !!w.base.hasShield; setClass($.shieldRow, 'off', !hasShield); if (hasShield) { setWidth($.shield, p.shield); setText($.shieldTxt, Math.round(p.shield * 100) + '%'); }
    let boss = null; for (const e of w.enemies) if (e.alive && e.boss && !e.parent) { boss = e; break; }
    $.boss.hidden = !boss; if (boss) { setText($.bossName, boss.boss.def.name); setWidth($.bossHp, boss.hp); setClass($.boss, 'enraged', !!boss.boss.enraged); }
    const max = abilityMaxCharges();
    for (const id in abilBtns) {
      const a = abilBtns[id], ch = w.abil.charges[id] ?? max, cd = w.abil.cd[id] || 0, full = abilityCooldown(id), ready = ch > 0 && w.wave.state === 'fighting' && p.alive;
      const deg = Math.round((ch > 0 ? 1 : 1 - cd / full) * 360); if (a.deg !== deg) { a.deg = deg; a.ring.style.setProperty('--p', deg + 'deg'); }
      setClass(a.b, 'ready', ready); setClass(a.b, 'active', (w.abil.active[id] || 0) > 0); setText(a.charges, max > 1 ? String(ch) : '');
    }
    // Opening lesson: show the flight hint during the first two waves of a pilot's first sorties.
    hintT += dt; setClass($.hint, 'on', G.state.stats.sorties <= 2 && run.wave <= 2 && hintT < 14 && w.wave.state !== 'dead' && !hooks.blocking?.());
  }
  function reset() { pipSig = loadSig = abilSig = ''; hintT = 0; for (const k in abilBtns) delete abilBtns[k]; }
  /** The loadout icon under a screen point (a tap there explains the loadout), padded to be easy to hit. */
  function loadoutAt(x, y) {
    for (const c of $.loadout.children) { const r = c.getBoundingClientRect(); if (x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 8 && y <= r.bottom + 8) return c.dataset.key || null; }
    return null;
  }
  return { el, top, dock, update, reset, loadoutAt };
}
