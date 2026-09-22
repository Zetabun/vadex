// Generic node-tree view. Research, the Rewind tree, Ascension, Relics and Alien tech are all the same widget over economy.TREES.
import { G } from '@last-orbit/core/game.js';
import { fmt } from '@last-orbit/core/format.js';
import { CUR } from '@last-orbit/core/state.js';
import { TREES, nodeLevel, nodeCost, nodeStatus, gateText, buyNode, can } from '@last-orbit/progression/economy.js';
import { playSfx } from '@last-orbit/audio/audio.js';
import { h, setText, setClass, holdable } from '@last-orbit/ui/dom.js';

/** groups: [[key, title]], groupOf: def → key. Returns {el, update, anyAffordable}. */
export function treeView(kind, groups, groupOf, opts = {}) {
  const t = TREES[kind], root = h('div'), nodes = [];
  for (const [key, title] of groups) {
    const defs = t.defs.filter((d) => groupOf(d) === key); if (!defs.length) continue;
    const head = h('div.sec-h', title), grid = h('div.tree-tier'); root.append(head, grid);
    for (const d of defs) { const lv = h('span.lv'), cost = h('span.cost'), ds = h('div.ds', d.desc);
      const el = holdable(h('button.node' + (opts.violet ? '.vi' : ''), h('div.nm', d.name), ds, h('div.ft', lv, cost)), () => { if (!buyNode(kind, d.id)) { playSfx('deny'); return false; } playSfx(d.max === 1 ? 'unlock' : 'buy'); update(); if (d.max === 1) return false; });
      grid.append(el); nodes.push({ d, el, lv, cost, ds, head, grid, key }); }
  }
  function update() {
    const seen = {};
    for (const n of nodes) { const d = n.d, lvl = nodeLevel(kind, d.id), stt = nodeStatus(kind, d), c = nodeCost(d, lvl), afford = stt === 'open' && can(t.cur, c);
      const reqMet = !d.req || d.req.every((r) => nodeLevel(kind, r) > 0), hidden = opts.hideLocked && !reqMet && !(d.req || []).some((r) => nodeStatus(kind, t.defs.find((x) => x.id === r)) !== 'locked');
      n.el.style.display = hidden ? 'none' : ''; if (!hidden) seen[n.key] = 1;
      setClass(n.el, 'open', stt === 'open'); setClass(n.el, 'can', afford); setClass(n.el, 'maxed', stt === 'maxed'); setClass(n.el, 'locked', stt === 'locked');
      setText(n.lv, d.max === 1 ? (lvl ? 'Owned' : '') : `${lvl}/${d.max}`);
      setText(n.cost, stt === 'maxed' ? '✓' : stt === 'locked' ? (reqMet ? gateText(d.gate) : 'Needs: ' + d.req.map((r) => t.defs.find((x) => x.id === r).name).join(', ')) : CUR[t.cur].icon + ' ' + fmt(c)); }
    for (const n of nodes) { const v = seen[n.key] ? '' : 'none'; if (n.head.style.display !== v) { n.head.style.display = v; n.grid.style.display = v; } }
  }
  return { el: root, update };
}
export function treeAffordable(kind) { const t = TREES[kind]; for (const d of t.defs) if (nodeStatus(kind, d) === 'open' && G.state.cur[t.cur].gte(nodeCost(d, nodeLevel(kind, d.id)))) return true; return false; }
