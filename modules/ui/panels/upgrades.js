// Upgrades panel: credit upgrades by category. Cards show level, current → next, cost, and a gauge to the next milestone.
import { gameIcon } from '@last-orbit/ui/icons.js';
import { G } from '@last-orbit/core/game.js';
import { fmt, pct } from '@last-orbit/core/format.js';
import { nextMilestone, MILESTONES } from '@last-orbit/data/balance.js';
import { UPGRADES, UPGRADE_CATS } from '@last-orbit/data/upgrades.js';
import { upgradeValue, STAT_NAMES } from '@last-orbit/progression/stats.js';
import { upgradeLevel, upgradeVisible, upgradeOwnedFree, upgradeQuote, buyUpgrade } from '@last-orbit/progression/economy.js';
import { playSfx } from '@last-orbit/audio/audio.js';
import { h, clear, setText, setClass, setWidth, holdable, tabs, multBar } from '@last-orbit/ui/dom.js';
import { showBreakdown } from '@last-orbit/ui/modals.js';

function show(d, v) { return d.show === '%' ? pct(v, v < 0.1 ? 1 : 0) : d.show === 'x' ? '×' + fmt(v, 2) : d.show === 'x+' ? '+' + pct(v) : d.show === '/s' ? pct(v, 1) + '/s' : d.type === 'flag' ? (v ? 'Online' : 'Offline') : fmt(v); }
function nextSpecial(d, lvl) { if (!d.special) return null; for (const l of Object.keys(d.special).map(Number).sort((a, b) => a - b)) if (lvl < l) return [l, d.special[l].desc]; return null; }

export function upgradesPanel() {
  let cat = 'off', cards = [], sig = '';
  const list = h('div'), mb = multBar(() => update(true));
  const bar = tabs(UPGRADE_CATS, () => cat, (c) => { cat = c; sig = ''; update(true); });
  const tabGlyphs = { off: '▥', def: '⬡', eco: '◈', sys: '⚙' };
  for (const button of bar.btns) button.prepend(h('span.upgrade-tab-glyph', { 'aria-hidden': 'true' }, tabGlyphs[button._id]));
  const root = h('div.upgrades-console', h('div.upgrade-controls', bar, h('div.upgrade-orders', h('span', 'Purchase order'), mb)), list);

  function build() {
    clear(list); cards = [];
    for (const d of UPGRADES) { if (d.cat !== cat || !upgradeVisible(d)) continue;
      const lv = h('b'), val = h('div.c-val'), desc = h('div.c-desc', d.desc), g = h('i'), ms = h('div.ms-note'), cost = h('span'), qty = h('small');
      const buy = holdable(h('button.buy', cost, qty), () => { const n = buyUpgrade(d.id, G.ui.mult); if (!n) { playSfx('deny'); return false; } playSfx('buy'); update(true); });
      const name = h('div.c-name', STAT_NAMES[d.stat] ? h('button.statlink', { 'aria-label': `${d.name}: view stat breakdown`, onclick: () => showBreakdown(d.stat) }, d.name) : h('span', d.name), lv);
      const art = h('div.upgrade-art', { 'aria-hidden': 'true' }, gameIcon('upgrade', d.id, 'upgrade-pixel', '◆'));
      const heading = h('div.upgrade-name', name);
      const el = h('div.card.upgrade-card', art, heading, buy, val, desc, d.noMs || d.type === 'flag' ? null : h('div.c-ms', h('div.gauge', g), ms)); if (d.noMs || d.type === 'flag') el.append(h('div.c-ms', ms));
      list.append(el); cards.push({ d, el, lv, val, g, ms, cost, qty, buy });
    }
    if (!cards.length) list.append(h('p.note', 'Nothing here yet. Keep pushing waves.'));
    const hidden = UPGRADES.filter((d) => d.cat === cat && !upgradeVisible(d)).sort((a, b) => a.wave - b.wave)[0]; if (hidden) list.append(h('p.note', `Next upgrade unlocks at wave ${hidden.wave}.`));
  }
  function update(force) {
    mb.refresh(); const s = cat + UPGRADES.filter((d) => d.cat === cat && upgradeVisible(d)).length; if (s !== sig) { sig = s; build(); }
    for (const c of bar.btns) setClass(c, 'can', UPGRADES.some((d) => d.cat === c._id && upgradeVisible(d) && !upgradeOwnedFree(d) && upgradeLevel(d.id) < (d.max || Infinity) && G.state.cur.credits.gte(upgradeQuote(d, 1).cost)));
    for (const c of cards) { const d = c.d, lvl = upgradeLevel(d.id), free = upgradeOwnedFree(d), maxed = free || lvl >= (d.max || Infinity), q = upgradeQuote(d, G.ui.mult);
      setText(c.lv, d.type === 'flag' ? (lvl || free ? 'ON' : 'OFF') : 'LV ' + lvl + (d.max ? '/' + d.max : ''));
      if (d.type === 'flag') c.val.textContent = free ? 'Granted by the Rewind tree' : '';
      else { const a = show(d, upgradeValue(d, lvl)), b = maxed ? '' : show(d, upgradeValue(d, lvl + Math.max(1, q.n))); const k = a + b; if (c.val._k !== k) { c.val._k = k; c.val.innerHTML = maxed ? a : `${a}<span class="arrow">▸</span><em>${b}</em>`; } }
      setClass(c.el, 'maxed', maxed); const can = !maxed && G.state.cur.credits.gte(q.cost); setClass(c.buy, 'can', can); setClass(c.el, 'can', can); c.buy.disabled = maxed;
      setText(c.cost, maxed ? 'MAX' : '¢ ' + fmt(q.cost)); setText(c.qty, maxed ? '' : '+' + q.n + (q.n === 1 ? ' level' : ' levels'));
      if (!d.noMs && d.type !== 'flag') { const nm = nextMilestone(lvl), prev = [0, ...MILESTONES].filter((m) => m <= lvl).pop(); const sp = nextSpecial(d, lvl);
        if (nm && !(d.max && nm > d.max)) { setWidth(c.g, (lvl - prev) / (nm - prev)); setText(c.ms, sp && sp[0] <= nm ? `LV ${sp[0]}: ${sp[1]}` : `LV ${nm}: milestone ${d.type === 'mult' ? '×' + d.ms + ' ' + d.name.toLowerCase() : '+' + show(d, d.msAdd || 0)}`); } else { setWidth(c.g, 1); setText(c.ms, sp ? `LV ${sp[0]}: ${sp[1]}` : maxed ? 'Fully upgraded' : ''); } }
      else { const sp = nextSpecial(d, lvl); setText(c.ms, sp ? `LV ${sp[0]}: ${sp[1]}` : ''); }
    }
  }
  function guideTarget(id = 'dmg') { const c = cards.find((x) => x.d.id === id) || cards.find((x) => x.buy.classList.contains('can')) || cards[0]; return c?.buy || null; }
  return { el: root, update, title: 'Upgrades', guideTarget };
}
