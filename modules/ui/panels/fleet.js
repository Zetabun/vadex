// Recovery Fleet menu screen. Kept deliberately separate from the battle currencies:
// it is a slow, persistent idle project whose unlocks feed the main run.
import { G } from '@last-orbit/core/game.js';
import { fmt } from '@last-orbit/core/format.js';
import { FLEET_UPGRADES } from '@last-orbit/data/fleet.js';
import { fleetAffordable, fleetCapacity, fleetCost, fleetLevel, fleetLockText, fleetRate, fleetStatus, buyFleetUpgrade } from '@last-orbit/progression/fleet.js';
import { playSfx } from '@last-orbit/audio/audio.js';
import { h } from '@last-orbit/ui/dom.js';

export function fleetScreen(root, back) {
  const f = G.state.fleet, cap = fleetCapacity(), rate = fleetRate(), fill = Math.max(0, Math.min(1, f.supply.ratio(cap)));
  root.append(back('Recovery Fleet'));
  root.append(h('p.note', 'Autonomous recovery craft work in parallel with the defence ship. Fleet Supplies build in real time while you fight and while you are away. Fleet progress survives rewinds and ascension.'));
  root.append(h('div.card.can',
    h('div.c-name', h('span', 'Fleet Supplies'), h('b', fmt(f.supply) + ' / ' + fmt(cap))),
    h('div.c-val', `+${fmt(rate, 2)}/s  ·  lifetime ${fmt(f.lifetime)}`),
    h('div.c-desc', 'Push deeper sectors to improve recovery yield. Spend Supplies below; they are never used by the main economy.'),
    h('div.c-ms', h('div.gauge', h('i', { style: `width:${(fill * 100).toFixed(1)}%` })))));

  let tier = '';
  for (const d of FLEET_UPGRADES) {
    if (d.tier !== tier) { tier = d.tier; root.append(h('div.sec-h', tier)); }
    const lvl = fleetLevel(d.id), status = fleetStatus(d), maxed = status === 'maxed', open = status === 'open', cost = maxed ? null : fleetCost(d), canBuy = open && f.supply.gte(cost);
    root.append(h('div.card' + (maxed ? '.maxed' : canBuy ? '.can' : status === 'locked' ? '.locked' : ''),
      h('div.c-name', h('span', d.name), h('b', maxed ? 'MAX' : `LV ${lvl}/${d.max}`)),
      maxed ? h('div') : h('button.buy' + (canBuy ? '.can' : ''), { disabled: !canBuy, onclick: () => { if (buyFleetUpgrade(d.id)) playSfx('buy'); else playSfx('deny'); } }, h('span', open ? '▣ ' + fmt(cost) : fleetLockText(d)), h('small', open ? 'Fleet Supplies' : 'Locked')),
      h('div.c-desc', d.desc),
      status === 'locked' ? h('div.c-val', { style: 'color:var(--mute)' }, 'Requires: ' + fleetLockText(d)) : null));
  }
  if (fleetAffordable()) root.append(h('p.note', { style: 'color:var(--green)' }, 'A Fleet upgrade is affordable.'));
}

export function fleetSignature() {
  const f = G.state.fleet; return [Math.floor(f.supply.toNumber()), FLEET_UPGRADES.map((d) => fleetLevel(d.id)).join(','), G.state.stats.bestWave || 1, G.state.prestige.count].join('|');
}
