import { G } from '@last-orbit/core/game.js';
import { BRANCHES } from '@last-orbit/data/research.js';
import { h, field, toggle } from '@last-orbit/ui/dom.js';
import { treeView } from '@last-orbit/ui/panels/tree.js';
export function researchPanel() {
  const tv = treeView('research', BRANCHES, (d) => d.br, { hideLocked: true });
  const autoRow = field('Auto-research', 'Buys the cheapest open node when affordable', toggle(() => G.state.auto.research, (v) => { G.state.auto.research = v; }));
  const root = h('div', h('p.note', 'Research changes how the ship works, not just its numbers. It resets on rewind until you learn to keep it.'), autoRow, tv.el);
  return { el: root, title: 'Research', update() { autoRow.style.display = G.sheet.f('f.autoResearch') > 0 ? '' : 'none'; tv.update(); } };
}
