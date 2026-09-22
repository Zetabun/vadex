import { G } from '@last-orbit/core/game.js';
import { fmt, fmtTime } from '@last-orbit/core/format.js';
import { MATERIALS, MATERIAL_TIERS, MATERIAL_UPGRADES } from '@last-orbit/data/materials.js';
import { materialLevel, materialUpgradeOpen, materialUpgradeRequirement, oreRate, smeltCycle, buyMaterialUpgrade, buySmelter, startSmelt, collectBars, selectMaterial, selectedMaterial, materialDiscovered } from '@last-orbit/progression/materials.js';
import { h, clear, setText, setWidth, setClass } from '@last-orbit/ui/dom.js';
import { playSfx } from '@last-orbit/audio/audio.js';

import { materialIcon as matIcon } from '@last-orbit/ui/icons.js';

export function materialsScreen(root, back) {
  root.append(back('Smelting'));
  root.append(h('p.note', 'Enemy wreckage changes as you push deeper. A new raw material enters the drop pool every five waves. Select any discovered recipe below; one shared smelter processes one batch at a time, and finished bars must be collected until late automation.'));

  const recipes = h('div.material-recipes'), recipeCard = h('div.card.mat-selected'), recipeName = h('div.c-name'), recipeStock = h('div.c-val'), recipeDesc = h('div.c-desc');
  recipeCard.append(recipeName, recipeStock, recipeDesc); root.append(recipes, recipeCard);

  const status = h('span'), timer = h('span'), fill = h('i'), action = h('button.btn.pri');
  const oreGlyph = h('span.sm-ore'), barGlyph = h('span.sm-bar');
  const machine = h('div.smelter-viz', oreGlyph, h('span.sm-arrow', '›'), h('span.sm-fire', '♨'), h('span.sm-arrow', '›'), barGlyph);
  const smelterCard = h('div.card.smelter-card', h('div.c-name', 'Basic Smelter', status), machine, h('div.c-val', timer), h('div.c-desc', 'Real-time processing continues during combat, Command Phase and while away.'), h('div.c-ms', h('div.gauge', fill)), action);
  root.append(smelterCard, h('div.sec-h', 'Industrial upgrades'));

  const rows = [];
  for (const d of MATERIAL_UPGRADES) {
    const lv = h('b'), costIcon = matIcon(MATERIAL_TIERS[0], 'bar'), cost = h('span'), costName = h('small'), gate = h('div.c-val');
    const buy = h('button.buy', { onclick: () => { if (buyMaterialUpgrade(d.id)) playSfx('buy'); else playSfx('deny'); } }, costIcon, cost, costName);
    const card = h('div.card', h('div.c-name', d.name, lv), buy, h('div.c-desc', d.desc), gate);
    root.append(card); rows.push({ d, lv, costIcon, cost, costName, gate, buy, card });
  }
  root.append(h('p.note', `Automation stays late: Auto-loader at Wave ${MATERIALS.autoLoadWave}, Output Conveyor at Wave ${MATERIALS.autoCollectWave}, and targeted passive extraction at Wave ${MATERIALS.extractorWave}. Until then, ore comes from combat and every finished bar is deliberately collected.`));

  let recipeSig = '', selectedIconId = '', activeIconId = '';
  function buildRecipes() {
    const discovered = MATERIAL_TIERS.filter((m) => materialDiscovered(m.id)), sig = discovered.map((m) => m.id).join('|'); if (sig === recipeSig) return; recipeSig = sig; clear(recipes);
    for (const m of discovered) {
      const b = h('button.mat-recipe', { onclick: () => { selectMaterial(m.id); playSfx('tab'); } }, matIcon(m, 'bar'), h('span', m.name), h('small', `W${m.unlockWave}`));
      b._id = m.id; recipes.append(b);
    }
  }

  action.onclick = () => {
    const m = G.state.materials;
    const ok = !m.smelter ? buySmelter() : (m.readyBars || 0) > 0 ? collectBars() > 0 : startSmelt(m.selected);
    playSfx(ok ? 'buy' : 'deny');
  };

  return { update() {
    buildRecipes();
    const s = G.state, state = s.materials, sel = selectedMaterial(), ready = Math.max(0, Math.floor(state.readyBars || 0)), running = !!state.running;
    const activeId = ready ? (state.readyMaterial || sel.id) : running ? (state.runningMaterial || sel.id) : sel.id;
    const active = MATERIAL_TIERS.find((m) => m.id === activeId) || sel, cycle = smeltCycle(active.id);
    for (const b of recipes.children) setClass(b, 'on', b._id === sel.id);

    if (selectedIconId !== sel.id) { selectedIconId = sel.id; clear(recipeName).append(matIcon(sel, 'bar'), h('span', sel.name + ' recipe')); }
    setText(recipeStock, `${fmt(s.cur[sel.oreCur])} Ore · ${fmt(s.cur[sel.barCur])} collected Bars`);
    setText(recipeDesc, `${sel.orePerBar} ${sel.name} Ore → 1 ${sel.name} Bar · ${fmtTime(smeltCycle(sel.id))} at current furnace calibration. First appears at Wave ${sel.unlockWave}.`);
    recipeCard.style.setProperty('--mat', sel.color);

    if (activeIconId !== active.id) { activeIconId = active.id; machine.style.setProperty('--mat', active.color); clear(oreGlyph).append(matIcon(active, 'ore')); clear(barGlyph).append(matIcon(active, 'bar')); }
    machine.classList.toggle('running', running); machine.classList.toggle('ready', ready > 0);
    if (!state.smelter) {
      setText(status, 'PROJECT READY'); setText(timer, `Install for ${fmt(MATERIALS.basicSmelterCost)} Credits + ${MATERIALS.basicSmelterOreCost} Iron Ore`); setWidth(fill, 0);
      action.textContent = `Build Smelter · ${fmt(MATERIALS.basicSmelterCost)} Credits + ${MATERIALS.basicSmelterOreCost} Ore`; action.disabled = !s.cur.credits.gte(MATERIALS.basicSmelterCost) || !s.cur.ore.gte(MATERIALS.basicSmelterOreCost); setClass(smelterCard, 'can', !action.disabled);
    } else if (ready > 0) {
      setText(status, `${active.name.toUpperCase()} BAR READY`); setText(timer, `${ready} finished Bar${ready === 1 ? '' : 's'} waiting in the output tray`); setWidth(fill, 1);
      action.textContent = `Collect ${ready} ${active.name} Bar${ready === 1 ? '' : 's'}`; action.disabled = false; setClass(smelterCard, 'can', true);
    } else if (running) {
      const left = Math.max(0, cycle - (state.progress || 0)); setText(status, `SMELTING ${active.name.toUpperCase()}`); setText(timer, `${fmtTime(left)} remaining · ${fmtTime(cycle)} cycle`); setWidth(fill, Math.min(1, (state.progress || 0) / cycle));
      action.textContent = 'Smelting in progress…'; action.disabled = true; setClass(smelterCard, 'can', false);
    } else {
      const selectedCycle = smeltCycle(sel.id); setText(status, `READY FOR ${sel.name.toUpperCase()}`); setText(timer, `${sel.orePerBar} Ore required · ${fmtTime(selectedCycle)} cycle`); setWidth(fill, 0);
      action.textContent = `Load ${sel.orePerBar} ${sel.name} Ore & Smelt`; action.disabled = !s.cur[sel.oreCur].gte(sel.orePerBar); setClass(smelterCard, 'can', !action.disabled);
    }

    for (const x of rows) {
      const lvl = materialLevel(x.d.id), maxed = lvl >= x.d.max, open = materialUpgradeOpen(x.d), req = maxed ? null : materialUpgradeRequirement(x.d, lvl), can = open && !maxed && s.cur[req.cur].gte(req.amount);
      setText(x.lv, maxed ? 'MAX' : `LV ${lvl}/${x.d.max}`);
      x.costIcon.hidden = !req;
      if (req) { x.costIcon.style.setProperty('--mat', req.mat.color); setText(x.cost, String(req.amount)); setText(x.costName, req.mat.name + (req.amount === 1 ? ' Bar' : ' Bars')); } else { setText(x.cost, 'Complete'); setText(x.costName, ''); }
      let gate = '';
      if (!open && x.d.req && materialLevel(x.d.req) <= 0) gate = `Requires ${MATERIAL_UPGRADES.find((d) => d.id === x.d.req)?.name || x.d.req}`;
      else if (!open && x.d.wave && (s.stats.bestWave || 1) < x.d.wave) gate = `Unlocks at Wave ${x.d.wave}`;
      else if (!open && req && !materialDiscovered(req.mat.id)) gate = `Requires ${req.mat.name} Ore · Wave ${req.mat.unlockWave}`;
      else if (x.d.dynamicMaterial && req) gate = `Next calibration uses ${req.mat.name} Bars (${Math.floor(lvl / MATERIALS.calibrationPerMaterial) + 1}/${MATERIAL_TIERS.length} material tiers)`;
      else if (x.d.id === 'extractor' && open) gate = `Mines the selected recipe: currently ${sel.name}`;
      else if (x.d.id === 'extractorRate' && open) gate = `Current selected-ore rate: ${fmt(oreRate(), 2)}/s`;
      setText(x.gate, gate); x.buy.disabled = !can; setClass(x.buy, 'can', can); setClass(x.card, 'can', can); setClass(x.card, 'locked', !open);
    }
    const rate = oreRate(); if (rate > 0) setText(timer, running ? `${fmtTime(Math.max(0, cycle - (state.progress || 0)))} remaining · Extracting ${sel.name} +${fmt(rate, 2)}/s` : ready ? `${ready} ${active.name} Bar${ready === 1 ? '' : 's'} waiting · Extracting ${sel.name} +${fmt(rate, 2)}/s` : `Extracting ${sel.name} +${fmt(rate, 2)}/s · ${fmtTime(smeltCycle(sel.id))} smelt cycle`);
  } };
}
