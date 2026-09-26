// In-sortie HUD: sector/wave track, XP bar, salvage, boss bar, loadout strip, hull/shield bars and ability buttons.
import { bus } from '@last-orbit/core/events.js';
import { BOOST_BY_ID, kitOn } from '@last-orbit/data/boosts.js';
import { kitCount, supplyPct, running } from '@last-orbit/progression/boosts.js';
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
import { counterProgress } from '@last-orbit/combat/counter.js';
import { useAbility, abilityCooldown, abilityMaxCharges } from '@last-orbit/combat/abilities.js';
import { xpProgress } from '@last-orbit/progression/run.js';
import { h, clear, setText, setClass, setWidth } from '@last-orbit/ui/dom.js';
import { uiIcon } from '@last-orbit/ui/icons.js';
import { art } from '@last-orbit/ui/art.js';
import { SHIP_BY_ID } from '@last-orbit/data/ships.js';
import { FUSION_BY_ID } from '@last-orbit/data/fusions.js';
import { setThrust } from '@last-orbit/audio/audio.js';

export function createHud(hooks) {
  const $ = {};
  $.pause = h('button.icon-btn', { 'aria-label': 'Pause', onclick: (e) => { e.currentTarget.blur(); hooks.pause(); } }, uiIcon('pause'));
  $.sector = h('div.sector-name'); $.waveN = h('b'); $.pips = h('div.pips', { 'aria-hidden': 'true' });
  $.salvage = h('span');
  $.level = h('b'); $.xp = h('i'); $.score = h('b');
  $.bossName = h('span'); $.bossHp = h('i'); $.boss = h('div.bossbar', { hidden: true }, h('div.boss-label', art('relic:r_giant', 'boss-ico'), $.bossName), h('div.meter.boss', $.bossHp));
  const top = h('div#hud',
    h('div.hud-top', $.pause,
      h('div.wave-block', $.sector, h('div.wave-line', $.waveLbl = h('small', 'WAVE'), $.waveN, $.pips)),
      h('div.chip.salvage', { title: 'Salvage collected this sortie' }, art('cur:salvage', 'cur-ico'), $.salvage)),
    h('div.xp-row', h('div.lv', h('small', 'LV'), $.level), h('div.meter.xp', $.xp), h('div.hud-score', h('small', 'SCORE'), $.score)),
    $.boss);

  $.loadout = h('div.loadout');
  // the field kit (progression/boosts.js): its supply meter filling as you fight, how many boosts it holds (tap to open
  // it), and the boosts running, each with its icon and time left
  $.kitFill = h('i'); $.kitN = h('b.kit-n'); $.kit = h('div.kit', { 'data-key': 'kit', title: 'Field kit', 'aria-label': 'Field kit: tap to use a boost' }, h('div.kit-meter', $.kitFill), art('boost:kit', 'kit-ico'), $.kitN);
  $.buffs = h('div.buffs', { 'aria-live': 'polite' });
  $.strikeI = Array.from({ length: BAL.breachStrikes }, () => h('i')); $.strikes = h('div.strikes', { title: 'Breaches this sector: the last ends the sortie' }, h('small', 'LINE'), $.strikeI);
  $.hullTxt = h('span.val'); $.hull = h('i'); $.shield = h('i'); $.shieldTxt = h('span.val');
  $.shieldRow = h('div.bar-row.shield-row', h('span.lbl', 'SHIELD'), h('div.meter.shield', $.shield), $.shieldTxt);
  $.abil = h('div.abilities');
  // Dodge: a small chip beside the hull bar, its ring filling as the dash recharges.
  $.dashRing = h('i.cd'); $.dash = h('div.dash-chip', { title: 'Dodge: double-tap a side' }, h('span.dash-glyph', '»'), $.dashRing);
  const dock = h('div#dock',
    h('div.dock-top', $.loadout, $.buffs, $.kit, $.strikes),
    h('div.dock-row',
      $.dash, h('div.bars', $.shieldRow, h('div.bar-row', h('span.lbl', 'HULL'), h('div.meter.hull', $.hull), $.hullTxt)),
      $.abil));
  $.hintB = h('b'); $.hintS = h('span'); $.hint = h('div.fly-hint', $.hintB, $.hintS);
  const el = h('div.hud-layer', top, dock, $.hint);

  let pipSig = '', loadSig = '', abilSig = '', hintT = 0, hintKind = '', strikeSig = null, kitSig = '', buffSig = '';
  const clock = (t) => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  /** The kit and the running boosts: redrawn only when what they show changes. */
  function updateKit(run) {
    const on = kitOn(run); $.kit.hidden = $.buffs.hidden = !on; if (!on) return;
    const n = kitCount(G.state), pct = Math.round(supplyPct(run) * 100), sig = n + ':' + pct;
    if (sig !== kitSig) { kitSig = sig; $.kitFill.style.height = pct + '%'; setText($.kitN, String(n)); setClass($.kit, 'empty', !n); }
    const list = running(run), bs = list.map((b) => b.id + Math.ceil(b.left)).join(); if (bs === buffSig) return; buffSig = bs; clear($.buffs);
    for (const b of list) { const d = BOOST_BY_ID[b.id]; $.buffs.append(h('span.buff' + (b.left < 8 ? '.ending' : ''), { style: `--c:${d.color}`, title: `${d.name}: ${d.desc}` }, art(d.icon, 'buff-ico'), h('b', clock(b.left)))); }
  }
  bus.on('canister', (g) => { if (g.where !== 'sortie' || g.sold) return; $.kit.classList.remove('got'); void $.kit.offsetWidth; $.kit.classList.add('got'); });
  const abilBtns = {};
  function buildPips(wave) {
    const sec = sectorOf(wave), sig = sec.start + ':' + sec.len; if (sig === pipSig) return; pipSig = sig; clear($.pips);
    for (let i = 0; i < sec.len; i++) { const k = waveKind(sec.start + i); $.pips.append(h('span.pip.' + k)); }
  }
  let loadN = null;
  function buildLoadout(run) {
    const sig = run.order.map((id) => id + run.weapons[id]).join() + '|' + run.relics.join() + '|' + (run.fusions || []).join() + (run.signature ? '*' : '') + '|' + Object.values(run.cards || {}).filter((n) => n > 0).length; if (sig === loadSig) return; loadSig = sig; clear($.loadout);
    const special = (id) => (run.signature && SHIP_BY_ID[run.ship]?.weapon === id) || (run.fusions || []).some((f) => FUSION_BY_ID[f].a === id || FUSION_BY_ID[f].b === id);
    // one stack in the corner instead of a row of icons: the newest three fanned on top, how many pieces in all, and a
    // tap opens the whole loadout (a new piece drops onto it)
    const pieces = [...run.order.map((id) => ({ key: 'weapon:' + id, c: '#' + WEAPONS[id].color.toString(16).padStart(6, '0'), special: special(id) })), ...run.relics.map((id) => ({ key: 'relic:' + id, c: '#b69cff' }))];
    const total = pieces.length + Object.values(run.cards || {}).filter((n) => n > 0).length, grew = total > (loadN || 0) && loadN != null; loadN = total;
    const stack = h('div.stack' + (pieces.some((p) => p.special) ? '.special' : '') + (grew ? '.grew' : ''), { 'data-key': 'build', title: 'Your loadout', 'aria-label': `Loadout: ${total} pieces. Tap to see them all.` },
      pieces.slice(-3).map((p, i, a) => h('span.st-card' + (i === a.length - 1 && grew ? '.new' : ''), { style: `--c:${p.c};--i:${i - (a.length - 1) / 2}` }, art(p.key, 'gun-icon'))), h('b.st-n', String(total)));
    $.loadout.append(stack);
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
    buildLoadout(run); buildAbilities(run); updateKit(run);
    const k = run.mode === 'counter' ? -1 : run.strikes || 0; if (k !== strikeSig) { const was = strikeSig; strikeSig = k; $.strikes.hidden = k < 0; const n = BAL.breachStrikes;
      $.strikeI.forEach((el, i) => { const lost = i >= n - k; setClass(el, 'lost', lost); setClass(el, 'hit', lost && was != null && i === n - k); }); setClass($.strikes, 'last', k === n - 1); }
    if (w.counter) {
      const c = w.counter; setText($.sector, `Counterattack · Stage ${c.stage.n}: ${c.stage.name}` + (c.hard ? ' · Hard' : ''));
      setText($.waveN, Math.round(counterProgress(w) * 100) + '%'); setText($.waveLbl, 'STAGE'); $.pips.hidden = true;
    } else { $.pips.hidden = false; setText($.waveLbl, 'WAVE'); buildPips(waveShown); }
    if (!w.counter) setText($.sector, (sec.endless ? sec.def.name : `Sector ${sec.idx + 1} · ${sec.def.name}`) + (run.mutator ? ' · Daily' : run.threat ? ` · Threat ${THREATS[run.threat].roman}` : '') + (run.route ? ' · ' + ROUTE_BY_ID[run.route].name : '') + (run.anomalies?.length ? ` · ${run.anomalies.length} anomal${run.anomalies.length > 1 ? 'ies' : 'y'}` : '')); if (!w.counter) setText($.waveN, `${sec.n}/${sec.len}`);
    const cur = sec.n - 1, cleared = w.wave.state === 'cleared';
    const pips = $.pips.children; for (let i = 0; i < pips.length; i++) { setClass(pips[i], 'done', i < cur || (i === cur && cleared)); setClass(pips[i], 'now', i === cur && !cleared); }
    setText($.salvage, fmt(Math.floor(run.salvage)));
    setText($.score, fmtInt(run.score || 0)); setClass($.score, 'hot', !!run.beatBest);
    setText($.level, String(run.level)); setWidth($.xp, xpProgress(run));
    const p = w.player; setWidth($.hull, p.hull); setText($.hullTxt, (p.hull > 0 ? Math.max(1, Math.round(p.hull * 100)) : 0) + '%'); /* never 0% while there is any hull left: at 0 the ship is gone */
    setClass($.hull.parentNode, 'low', p.hull < 0.3); setClass($.hullTxt, 'crit', p.alive && p.hull > 0 && p.hull < 0.1);
    const hasShield = !!w.base.hasShield; setClass($.shieldRow, 'off', !hasShield); if (hasShield) { setWidth($.shield, p.shield); setText($.shieldTxt, Math.round(p.shield * 100) + '%'); }
    let boss = null; for (const e of w.enemies) if (e.alive && e.boss && !e.parent) { boss = e; break; }
    $.boss.hidden = !boss; if (boss) { setText($.bossName, boss.boss.def.name); setWidth($.bossHp, boss.hp); setClass($.boss, 'enraged', !!boss.boss.enraged); }
    const max = abilityMaxCharges();
    for (const id in abilBtns) {
      const a = abilBtns[id], ch = w.abil.charges[id] ?? max, cd = w.abil.cd[id] || 0, full = abilityCooldown(id), ready = ch > 0 && w.wave.state === 'fighting' && p.alive;
      const deg = Math.round((ch > 0 ? 1 : 1 - cd / full) * 360); if (a.deg !== deg) { a.deg = deg; a.ring.style.setProperty('--p', deg + 'deg'); }
      setClass(a.b, 'ready', ready); setClass(a.b, 'active', (w.abil.active[id] || 0) > 0); setText(a.charges, max > 1 ? String(ch) : '');
    }
    // Opening lessons: the flight hint in the first two waves of a pilot's first sorties, and in Counterattack the reminder
    // that the ship flies up and down too, for the first few stages flown.
    const ca = !!w.counter, kind = ca ? 'ca' : 'main';
    if (kind !== hintKind) { hintKind = kind; setText($.hintB, ca ? 'Drag to fly anywhere' : 'Hold a side or drag to steer'); setText($.hintS, ca ? 'Up and down too. Fly higher to hit harder; climb or dive out of beams and lungers.' : 'Double-tap a side to dash through fire. Your guns shoot on their own; tap an enemy to focus it.'); }
    // The steering tip plays once, in the pilot's first sortie (decided as the sortie starts, so it runs its full time).
    const seen = G.state.seen; if ($.steerThis == null) $.steerThis = !seen.steerTip && (G.state.stats.sorties || 0) <= 1;
    let lesson = ca ? (G.state.stats.counterRuns || 0) <= 3 && hintT < 9 : $.steerThis && run.wave <= 2 && hintT < 14;
    if (lesson && !ca && hintT > 5) seen.steerTip = true;
    // The dodge lesson: once, after the steering tip (if any) has had its turn.
    const dodgeOn = (seen.dodgeTips || 0) < 1 && hintT > (lesson ? 15 : 3) && hintT < (lesson ? 24 : 12);
    if (dodgeOn && !lesson) { if (hintKind !== 'dodge') { hintKind = 'dodge'; setText($.hintB, 'Dodge'); setText($.hintS, 'Double-tap a side to dash that way. You cannot be hit mid-dash. The » chip by your hull bar lights up when it is ready.'); } lesson = true; if (!$.dodgeCounted) { $.dodgeCounted = true; seen.dodgeTips = (seen.dodgeTips || 0) + 1; } }
    hintT += dt; setClass($.hint, 'on', lesson && w.wave.state !== 'dead' && !hooks.blocking?.());
    // dash readiness
    const dcd = Math.max(0, p.dashCd || 0), dfull = BAL.dashCd * G.sheet.n('dashCd'), dk = dcd > 0 ? 1 - dcd / dfull : 1;
    const deg = Math.round(dk * 90) * 4; if (deg !== $.dashDeg) { $.dashDeg = deg; $.dashRing.style.setProperty('--p', deg + 'deg'); } setClass($.dash, 'ready', dk >= 1 && p.alive);
    const th = p.alive && w.wave.state !== 'dead' && !hooks.blocking?.() ? Math.round(Math.min(1, Math.abs(p.vx || 0) / 70) * 20) / 20 : 0; if (th !== $.thrust) { $.thrust = th; setThrust(th); }
  }
  function reset() { pipSig = loadSig = abilSig = hintKind = kitSig = buffSig = ''; loadN = null; strikeSig = null; hintT = 0; $.dodgeCounted = false; $.steerThis = null; $.thrust = 0; $.dashDeg = -1; setThrust(0); for (const k in abilBtns) delete abilBtns[k]; }
  /** The loadout icon under a screen point (a tap there explains the loadout), padded to be easy to hit. */
  function loadoutAt(x, y) {
    for (const c of $.loadout.children) { const r = c.getBoundingClientRect(); if (x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 8 && y <= r.bottom + 8) return c.dataset.key || null; }
    return null;
  }
  /** Whether a screen point is on the field kit (a tap there opens it), padded to be easy to hit. */
  function kitAt(x, y) { if ($.kit.hidden) return false; const r = $.kit.getBoundingClientRect(); return x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 8 && y <= r.bottom + 8; }
  return { el, top, dock, update, reset, loadoutAt, kitAt };
}
