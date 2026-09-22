import { G } from '@last-orbit/core/game.js';
import { fmtTime } from '@last-orbit/core/format.js';
import { RECIPES, FOUNDRY_UPGRADES } from '@last-orbit/data/foundry.js';
import { foundryLevel, foundryCost, foundryCycle, blueprintCapacity, foundryCapacity, recipeOpen, foundryStatus, buyFoundryUpgrade, setFoundryRecipe, equipSupply, setFoundryAuto, supplyReady, useSupply } from '@last-orbit/progression/foundry.js';
import { h, setText, setWidth, setClass, toggle } from '@last-orbit/ui/dom.js';
import { playSfx } from '@last-orbit/audio/audio.js';
import { gameIcon } from '@last-orbit/ui/icons.js';

export function foundryScreen(root, back) {
  root.append(back('Orbital Foundry'));
  const amount = h('b'), detail = h('span'), fill = h('i'), stockNote = h('p.note');
  root.append(h('div.foundry-hero', h('div.foundry-orbit', { 'aria-hidden': 'true' }, gameIcon('misc', 'blueprint', 'foundry-pixel', '⬡')),
    h('div', h('div.sec-h', 'Manufacture. Stockpile. Deploy.'), h('h3', 'Your reserve, on demand'),
      h('p.note', 'Choose a production line. Every cycle makes one supply and Blueprints for permanent upgrades. Production continues while you are away.'))),
    h('div.card', h('div.c-name', 'Blueprints', amount), h('div.c-desc', detail), h('div.c-ms', h('div.gauge', fill))), stockNote);
  const rows = [];
  root.append(h('div.sec-h', 'Production lines'));
  for (const r of RECIPES) {
    const title = h('b'), status = h('small');
    const produce = h('button.btn.sm', { onclick: () => { if (setFoundryRecipe(r.id)) playSfx('tab'); } });
    const equip = h('button.btn.sm', { onclick: () => { if (equipSupply(r.id)) playSfx('tab'); } });
    const use = h('button.btn.sm.pri', { onclick: () => { if (useSupply(r.id)) playSfx('ability'); } }, 'Deploy');
    const card = h('div.supply-card', h('div.row', h('span.foundry-art', gameIcon('support', r.id, 'foundry-pixel', r.icon)), h('strong', r.name), title), h('p.note', r.desc), status, h('div.row', produce, equip, use));
    root.append(card); rows.push({ r, title, status, produce, equip, use, card });
  }
  root.append(h('p.note', 'Manufacturing and quick-slot selection are independent. Changing the production line keeps progress. Full reserves still generate Blueprints until the archive fills. Stored supplies and upgrades survive Rewind and Ascension; active combat effects do not.'));
  if (foundryLevel('dispatch')) root.append(h('div.field', h('div', 'Automatic dispatch', h('small', 'Uses the quick-slot supply: repair below 45% hull, Overclock on bosses, salvage when ready.')),
    toggle(() => G.state.foundry.auto, setFoundryAuto)));
  root.append(h('div.sec-h', 'Foundry upgrades'));
  const upgrades = [];
  for (const d of FOUNDRY_UPGRADES) {
    const lv = h('b'), cost = h('span'), buy = h('button.buy', { onclick: () => { if (buyFoundryUpgrade(d.id)) playSfx('buy'); } }, cost, h('small', 'Blueprints'));
    const card = h('div.card', h('div.c-name', d.name, lv), buy, h('div.c-desc', d.desc));
    root.append(card); upgrades.push({ d, lv, cost, buy, card });
  }
  return { update() {
    const f = G.state.foundry, cap = foundryCapacity(), cycle = foundryCycle();
    setText(amount, `${f.blueprints} / ${blueprintCapacity()}`);
    setText(detail, `${RECIPES.find((r) => r.id === f.recipe).name} · next in ${fmtTime(Math.ceil((1 - f.progress) * cycle))} · ${2 + foundryLevel('analysis')} Blueprints / cycle`);
    setWidth(fill, f.progress);
    setText(stockNote, `Cycle ${Math.ceil(cycle)}s · supply strength ×${(1 + foundryLevel('quality') * 0.1).toFixed(1)} · ${f.produced} supplies made · ${f.used} deployed`);
    for (const x of rows) {
      const open = recipeOpen(x.r.id), producing = f.recipe === x.r.id, equipped = f.equipped === x.r.id;
      setText(x.title, `${f.stock[x.r.id]} / ${cap}`); setClass(x.card, 'selected', producing);
      setText(x.status, !open ? `Unlocks at wave ${x.r.wave}` : producing ? 'Production line active' : equipped ? 'Selected for the battlefield quick slot' : 'Ready to manufacture');
      setText(x.produce, producing ? 'Producing' : 'Produce'); x.produce.disabled = !open || producing; setClass(x.produce, 'selected', producing);
      setText(x.equip, equipped ? 'Quick slot ✓' : 'Quick slot'); x.equip.disabled = !open || equipped; setClass(x.equip, 'selected', equipped);
      x.use.disabled = !supplyReady(x.r.id);
    }
    for (const x of upgrades) {
      const status = foundryStatus(x.d), cost = foundryCost(x.d), can = status === 'open' && f.blueprints >= cost;
      setText(x.lv, status === 'maxed' ? 'MAX' : `LV ${foundryLevel(x.d.id)}/${x.d.max}`);
      setText(x.cost, status === 'locked' ? `Wave ${x.d.wave}` : status === 'maxed' ? 'Complete' : String(cost));
      x.buy.disabled = !can; setClass(x.buy, 'can', can); setClass(x.card, 'can', can);
    }
  } };
}
