// Chrono Rewind (prestige layer 1) and, once charted, Ascension (layer 2).
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { fmt, fmtTime } from '@last-orbit/core/format.js';
import { BAL } from '@last-orbit/data/balance.js';
import { canRewind, shardPreview, nextShardWave, startingWave, doRewind, canAscend, sigilPreview, doAscend } from '@last-orbit/prestige/prestige.js';
import { h, clear, tabs, setClass } from '@last-orbit/ui/dom.js';
import { confirmDialog } from '@last-orbit/ui/modals.js';
import { treeView, treeAffordable } from '@last-orbit/ui/panels/tree.js';

export function rewindPanel() {
  let tab = 'rewind'; const st = () => G.state;
  const main = h('div'), tree = treeView('prestige', [[1, 'Tier 1 · Echoes'], [2, 'Tier 2 · Continuity'], [3, 'Tier 3 · Foresight'], [4, 'Tier 4 · Causality'], [5, 'Tier 5 · Beyond']], (d) => d.tier, { violet: true, hideLocked: true });
  const asc = h('div'), ascTree = treeView('asc', [['all', 'Constellation']], () => 'all', { violet: true }), ascHead = h('div'); asc.append(ascHead, ascTree.el);
  const bar = tabs([['rewind', 'Rewind'], ['tree', 'Shard tree'], ['asc', 'Ascension']], () => tab, (t) => { tab = t; show(); });
  const root = h('div', bar, main, tree.el, asc); let sig = '';
  function show() { main.style.display = tab === 'rewind' ? '' : 'none'; tree.el.style.display = tab === 'tree' ? '' : 'none'; asc.style.display = tab === 'asc' ? '' : 'none'; sig = ''; update(); }
  function go() {
    const gain = shardPreview(), act = () => { bus.emit('rewindFx'); setTimeout(() => doRewind(), 650); };
    if (!st().settings.confirmRewind) return act();
    confirmDialog('Chrono Rewind', `Rewind to the start of the war and keep ${fmt(gain)} Chrono Shards. Credits, Scrap, Research Data, upgrades, weapons and boons reset. Modules, relics, achievements and the shard tree stay.`, 'Rewind', act);
  }
  function buildMain() {
    clear(main); const s = st(), run = s.run, pr = s.prestige, ok = canRewind(), gain = shardPreview(), nxt = nextShardWave();
    main.append(h('div.card' + (ok ? '.can' : ''), h('div.c-name', h('span', { style: 'color:var(--violet)' }, '◆ Chrono Shards on rewind'), h('b', '+' + fmt(gain))),
      h('button.buy.vi' + (ok ? '.can' : ''), { disabled: !ok, onclick: go }, h('span', ok ? 'Rewind' : 'Wave ' + BAL.rewindWave), h('small', ok ? 'keep shards' : 'required')),
      h('div.c-desc', ok ? (nxt ? `Reaching wave ${nxt} raises the payout. Best this run: wave ${run.best}.` : `Best this run: wave ${run.best}.`) : `The Chrono Core needs a wave ${BAL.rewindWave} anchor point. Best this run: wave ${run.best}.`),
      h('div.c-val', `Next run starts at wave ${startingWave()}`)));
    if (run.challenge) main.append(h('p.note', { style: 'color:var(--amber)' }, 'A challenge run is active. Rewinding ends it.'));
    main.append(h('div.sec-h', 'This timeline'), h('div.kv', 'Run time', h('b', fmtTime(run.time))), h('div.kv', 'Rewinds', h('b', String(pr.count))), h('div.kv', 'Lifetime shards', h('b', fmt(pr.total))), h('div.kv', 'Best wave ever', h('b', String(s.stats.bestWave))));
    const pace = run.stats.pace || {}, keys = Object.keys(pace).map(Number).sort((a, b) => b - a).slice(0, 4);
    if (keys.length) { main.append(h('div.sec-h', 'Pace vs. your best')); for (const k of keys) { const b = pr.paceBest[k], d = pace[k] - b; main.append(h('div.kv', 'Wave ' + k, h('b', { style: d <= 0 ? 'color:var(--green)' : '' }, fmtTime(pace[k]) + (b && d > 0 ? `  (+${fmtTime(d)})` : '  (best)')))); } }
    if (pr.history.length) { main.append(h('div.sec-h', 'Previous runs')); for (const r of pr.history.slice(0, 6)) main.append(h('div.kv', `#${r.n} · wave ${r.wave} · ${fmtTime(r.time)}`, h('b', '+' + fmt(r.shards) + ' ◆'))); }
    main.append(h('p.note', 'No timers, no penalties: rewind whenever the payout feels worth it. A good rule is when shards on offer match or beat your lifetime total.'));
  }
  function update() {
    const s = st(), ascOpen = G.sheet.f('f.ascension') > 0; bar.btns[2].style.display = ascOpen ? '' : 'none'; bar.btns[1].style.display = s.prestige.count || s.cur.shards.gt(0) ? '' : 'none';
    setClass(bar.btns[0], 'can', canRewind() && shardPreview().gte(s.prestige.total.max(3))); setClass(bar.btns[1], 'can', treeAffordable('prestige')); setClass(bar.btns[2], 'can', ascOpen && treeAffordable('asc'));
    if (tab === 'rewind') { const k = [s.run.best, s.prestige.count, Math.floor(s.run.time / 5), shardPreview().toString(), s.run.challenge].join(); if (k !== sig) { sig = k; buildMain(); } }
    else if (tab === 'tree') tree.update();
    else { const sg = sigilPreview(), k = sg + '|' + s.asc.count; if (k !== sig) { sig = k; clear(ascHead).append(h('div.card' + (canAscend() ? '.can' : ''), h('div.c-name', h('span', '✹ Stellar Sigils on ascension'), h('b', '+' + sg)), h('button.buy.vi' + (canAscend() ? '.can' : ''), { disabled: !canAscend(), onclick: () => confirmDialog('Ascend', `Leave the timeline entirely for ${sg} Stellar Sigils. This resets Chrono Shards, the shard tree, Alien tech and Boss Cores as well as the run. Relics, modules, achievements and the constellation are permanent.`, 'Ascend', () => { bus.emit('rewindFx'); setTimeout(() => doAscend(), 650); }, true) }, h('span', 'Ascend'), h('small', 'layer 2')), h('div.c-desc', `Sigils come from lifetime Chrono Shards this ascension (${fmt(s.prestige.total)}). The first sigil needs ${fmt(BAL.ascendShards)}.`), h('div.c-val', { style: 'color:var(--dim)' }, 'Worth it once the shard tree has stopped moving. Buy The Root first: it keeps tiers 1 to 3.'))); } ascTree.update(); }
  }
  show();
  return { el: root, title: 'Chrono core', update, onOpen() { sig = ''; } };
}
