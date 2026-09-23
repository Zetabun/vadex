// Arsenal: weapons (Scrap levels, evolutions, hardpoints), drones (bays + levels) and ability loadout.
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { fmt, fmtTime } from '@last-orbit/core/format.js';
import { CUR } from '@last-orbit/core/state.js';
import { WEAPONS, WEAPON_ORDER, EVO_LEVELS } from '@last-orbit/data/weapons.js';
import { DRONES, DRONE_ORDER } from '@last-orbit/data/drones.js';
import { ABILITIES, ABILITY_ORDER, AUTO_CONDITIONS } from '@last-orbit/data/abilities.js';
import { weaponOwned, weaponGate, weaponUnlockCost, unlockWeapon, weaponQuote, levelWeapon, equipWeapon, droneTypeOpen, droneQuote, levelDrone, setBay, abilityOpen, equipAbility, can } from '@last-orbit/progression/economy.js';
import { abilityCooldown } from '@last-orbit/combat/abilities.js';
import { playSfx } from '@last-orbit/audio/audio.js';
import { h, clear, setText, setClass, holdable, tabs, multBar, select } from '@last-orbit/ui/dom.js';
import { gameIcon } from '@last-orbit/ui/icons.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
export function arsenalPanel(openLoadout) {
  let tab = (G.state.unlocks.drones && !G.state.seen.dronesTab) ? 'drones' : 'weapons', sig = '', selSlot = 0, selAb = 0, rows = [];
  const body = h('div'), mb = multBar(() => update());
  const markDronesSeen = () => { G.state.seen.dronesTab = 1; bus.emit('droneTabOpened'); };
  const bar = tabs([['weapons', 'Weapons'], ['drones', 'Drones'], ['abilities', 'Abilities']], () => tab, (t) => { tab = t; if (t === 'drones') markDronesSeen(); sig = ''; update(); });
  const loadout = h('button.btn.sm.arsenal-loadout-link', { type: 'button', onclick: () => { playSfx('tab'); openLoadout?.(); } }, 'Go to Loadout →');
  const root = h('div', h('div.row', { style: 'margin-bottom:8px' }, bar, mb), h('div.arsenal-loadout-row', h('span', 'Unlocked gear can be fitted on your ship.'), loadout), body); bar.style.cssText = 'flex:1 1 100%;margin:0';
  const offLoadout = bus.on('loadout', () => { sig = ''; });

  function buildWeapons() {
    const st = G.state, slots = Math.floor(G.sheet.n('weaponSlots')), eq = st.run.equipped; if (selSlot >= slots) selSlot = 0;
    const sl = h('div.slots'); for (let i = 0; i < slots; i++) { const id = eq[i], d = id && WEAPONS[id]; sl.append(h('button.slot' + (d ? '.full' : '') + (i === selSlot && slots > 1 ? '.sel' : ''), { onclick: () => { selSlot = i; sig = ''; update(); playSfx('tab'); } }, h('small', 'Hardpoint ' + (i + 1)), d ? [h('span.arsenal-art', { style: 'color:' + hex(d.color) }, gameIcon('weapon', id)), h('span', { style: 'color:' + hex(d.color) }, d.name)] : h('span', { style: 'color:var(--mute)' }, 'Empty'))); }
    body.append(sl); if (slots > 1) body.append(h('p.note', 'Select a hardpoint, then press Fit on a weapon.')); else body.append(h('p.note', 'Research "Second hardpoint" to run two weapons at once.'));
    for (const id of WEAPON_ORDER) { const d = WEAPONS[id], owned = weaponOwned(id), gate = weaponGate(id); if (!owned && !gate.ok && WEAPON_ORDER.indexOf(id) > WEAPON_ORDER.findIndex((x) => !weaponOwned(x) && !weaponGate(x).ok)) continue;
      const lv = h('b'), val = h('div.c-val'), cost = h('span'), qty = h('small'), evo = h('div.evo', EVO_LEVELS.map(() => h('span'))), ms = h('div.ms-note');
      const buy = holdable(h('button.buy.cy', cost, qty), () => { const ok = weaponOwned(id) ? levelWeapon(id, G.ui.mult) : unlockWeapon(id); if (!ok) { playSfx('deny'); return false; } playSfx('buy'); if (!owned) { sig = ''; } update(); });
      const fit = h('button.btn.sm', { onclick: () => { equipWeapon(selSlot, id); playSfx('tab'); } }, 'Fit');
      const el = h('div.card', h('div.c-name', h('span.arsenal-art', { style: 'color:' + hex(d.color) }, gameIcon('weapon', id)), h('span', { style: 'color:' + hex(d.color) }, d.name), lv), buy, val, h('div.c-desc', d.desc), h('div.c-ms', evo, ms, h('div.row', { style: 'margin-top:6px' }, fit)));
      body.append(el); rows.push({ kind: 'w', id, d, el, lv, val, cost, qty, evo, ms, buy, fit });
    }
  }
  function buildDrones() {
    const cap = Math.floor(G.sheet.n('droneBays')), bays = G.state.run.drones.bays;
    if (!cap) { body.append(h('p.note', 'No drone bays yet. Research "Drone bay" in the Drones branch (wave 15).')); return; }
    const sl = h('div.slots'); for (let i = 0; i < cap; i++) { const t = bays[i], d = t && DRONES[t]; sl.append(h('div.slot' + (d ? '.full' : ''), h('small', 'Bay ' + (i + 1)), d ? [h('span.arsenal-art', { style: 'color:' + hex(d.color) }, gameIcon('drone', t)), h('span', { style: 'color:' + hex(d.color) }, d.name.replace(' drone', ''))] : h('span', { style: 'color:var(--mute)' }, 'Empty'))); } body.append(sl);
    for (const t of DRONE_ORDER) { const d = DRONES[t]; if (!droneTypeOpen(t)) { body.append(h('div.card.locked', h('div.c-name', h('span.arsenal-art', gameIcon('drone', t)), h('span', d.name)), h('div'), h('div.c-desc', `Research tier ${d.tier} drones to unlock.`))); continue; }
      const lv = h('b'), cnt = h('b', { style: 'min-width:22px;text-align:center;font-family:var(--disp)' }), cost = h('span'), qty = h('small');
      const buy = holdable(h('button.buy.cy', cost, qty), () => { if (!levelDrone(t, G.ui.mult)) { playSfx('deny'); return false; } playSfx('buy'); update(); });
      const minus = h('button.btn.sm', { 'aria-label': `Recall ${d.name}`, onclick: () => { setBay(t, -1); playSfx('tab'); update(); } }, '−');
      const plus = h('button.btn.sm', { 'aria-label': `Deploy ${d.name}`, onclick: () => { setBay(t, 1); playSfx('tab'); update(); } }, '+');
      const el = h('div.card', h('div.c-name', h('span.arsenal-art', { style: 'color:' + hex(d.color) }, gameIcon('drone', t)), h('span', { style: 'color:' + hex(d.color) }, d.name), lv), buy, h('div.c-desc', d.desc), h('div.row', { style: 'margin-top:6px' }, minus, cnt, plus, h('span.note', { style: 'margin:0 0 0 4px' }, 'deployed')));
      body.append(el); rows.push({ kind: 'd', t, el, lv, cnt, cost, qty, buy, minus, plus });
    }
  }
  function buildAbilities() {
    const st = G.state, slots = Math.floor(G.sheet.n('abilitySlots')), eq = st.abilities.equipped; if (selAb >= slots) selAb = 0;
    const sl = h('div.slots'); for (let i = 0; i < slots; i++) { const id = eq[i], d = id && ABILITIES[id]; sl.append(h('button.slot' + (d ? '.full' : '') + (i === selAb ? '.sel' : ''), { onclick: () => { selAb = i; sig = ''; update(); playSfx('tab'); } }, h('small', 'Slot ' + (i + 1)), d ? [h('span.arsenal-art', { style: 'color:' + d.color }, gameIcon('ability', id)), h('span', d.name)] : h('span', { style: 'color:var(--mute)' }, 'Empty'))); } body.append(sl);
    body.append(h('p.note', 'Select a slot, then press Fit. Abilities use charges and cooldowns. Overdrive also draws from the regenerating Energy reserve to extend its active time.'));
    const auto = G.sheet.f('f.autoAbility') > 0;
    for (const id of ABILITY_ORDER) { const d = ABILITIES[id], open = abilityOpen(id);
      if (!open) { body.append(h('div.card.locked', h('div.c-name', '???'), h('div'), h('div.c-desc', `Unlocks at wave ${d.unlock}.`))); if (ABILITY_ORDER.indexOf(id) > ABILITY_ORDER.findIndex((x) => !abilityOpen(x))) break; continue; }
      const on = eq.slice(0, slots).includes(id);
      body.append(h('div.card' + (on ? '.can' : ''), h('div.c-name', h('span.arsenal-art', { style: 'color:' + d.color }, gameIcon('ability', id)), h('span', { style: 'color:' + d.color }, d.name), h('b', fmtTime(abilityCooldown(id)))), h('button.btn.sm' + (on ? '.selected' : ''), { onclick: () => { if (on) { const e = G.state.abilities.equipped; e[e.indexOf(id)] = null; bus.emit('loadout'); } else equipAbility(selAb, id); playSfx('tab'); sig = ''; update(); } }, on ? 'Remove' : 'Fit'), h('div.c-desc', d.desc),
        auto ? h('div.row', { style: 'grid-column:1/-1;margin-top:6px' }, h('span.note', { style: 'margin:0' }, 'Auto-cast:'), select(AUTO_CONDITIONS, () => G.state.auto.ability[id] || 'never', (v) => { G.state.auto.ability[id] = v; })) : null));
    }
    if (!auto) body.append(h('p.note', 'Research "Ability automation" to set auto-cast conditions for each ability.'));
  }
  function update() {
    mb.refresh(); mb.style.visibility = tab === 'abilities' ? 'hidden' : '';
    const st = G.state, s = [tab, selSlot, selAb, G.sheet.n('weaponSlots'), G.sheet.n('droneBays'), G.sheet.n('abilitySlots'), st.run.drones.bays.join(), st.run.equipped.join(), st.abilities.equipped.join(), WEAPON_ORDER.map((w) => (weaponOwned(w) ? 2 : weaponGate(w).ok ? 1 : 0)).join(''), ABILITY_ORDER.filter(abilityOpen).length, DRONE_ORDER.filter(droneTypeOpen).length, G.sheet.f('f.autoAbility')].join('|');
    if (s !== sig) { sig = s; clear(body); rows = []; if (tab === 'weapons') buildWeapons(); else if (tab === 'drones') buildDrones(); else buildAbilities(); }
    setClass(bar.btns[0], 'can', WEAPON_ORDER.some((w) => (weaponOwned(w) ? st.run.equipped.includes(w) && can('scrap', weaponQuote(w, 1).cost) : weaponGate(w).ok && weaponUnlockCost(w).every(([c, a]) => can(c, a)))));
    bar.btns[1].style.display = st.unlocks.drones ? '' : 'none'; bar.btns[1].classList.toggle('new', !!st.unlocks.drones && !st.seen.dronesTab); bar.btns[2].style.display = st.unlocks.abilities ? '' : 'none';
    for (const r of rows) {
      if (r.kind === 'w') { const owned = weaponOwned(r.id), lvl = st.run.weapons[r.id] || 0, cfg = G.sheet.weapons[r.id], eqd = st.run.equipped.includes(r.id);
        if (owned) { const q = weaponQuote(r.id, G.ui.mult), ok = can('scrap', q.cost); setText(r.lv, 'LV ' + lvl); setText(r.cost, '⚙ ' + fmt(q.cost)); setText(r.qty, '+' + q.n + (q.n === 1 ? ' level' : ' levels')); setClass(r.buy, 'can', ok); setClass(r.el, 'can', ok);
          setText(r.val, cfg ? `${fmt(cfg.dmg)} dmg × ${fmt(cfg.rate * (cfg.proj || 1), 1)}/s${eqd ? '' : '  ·  not fitted'}` : `Level ${lvl}  ·  not fitted`);
          const ni = EVO_LEVELS.findIndex((l) => lvl < l); r.evo.childNodes.forEach((n, i) => setClass(n, 'on', lvl >= EVO_LEVELS[i])); setText(r.ms, ni >= 0 ? `LV ${EVO_LEVELS[ni]}: ${r.d.evo[ni].name}. ${r.d.evo[ni].desc}` : 'Fully evolved');
          r.fit.style.display = ''; r.fit.disabled = st.run.equipped[selSlot] === r.id; r.fit.classList.toggle('selected', r.fit.disabled); setText(r.fit, eqd ? (st.run.equipped[selSlot] === r.id ? 'Fitted' : 'Move here') : 'Fit'); }
        else { const gate = weaponGate(r.id), costs = weaponUnlockCost(r.id), ok = gate.ok && costs.every(([c, a]) => can(c, a)); setText(r.lv, 'LOCKED'); setText(r.cost, gate.ok ? costs.map(([c, a]) => CUR[c].icon + ' ' + fmt(a)).join('  ') : gate.text); setText(r.qty, gate.ok ? 'Unlock' : ''); setClass(r.buy, 'can', ok); setText(r.val, ''); setText(r.ms, 'First evolution: ' + r.d.evo[0].name); r.fit.style.display = 'none'; }
      } else { const lvl = st.run.drones.levels[r.t] || 1, q = droneQuote(r.t, G.ui.mult), ok = can('scrap', q.cost); setText(r.lv, 'LV ' + lvl); setText(r.cost, '⚙ ' + fmt(q.cost)); setText(r.qty, '+' + q.n); setClass(r.buy, 'can', ok); const deployed = st.run.drones.bays.filter((x) => x === r.t).length; setText(r.cnt, String(deployed)); r.minus.disabled = deployed === 0; r.plus.disabled = st.run.drones.bays.length >= Math.floor(G.sheet.n('droneBays')); }
    }
  }
  return { el: root, update, title: 'Arsenal', goto(next) { if (next === 'drones' && G.state.unlocks.drones) markDronesSeen(); tab = next; sig = ''; update(); }, onOpen() { if (G.state.unlocks.drones && !G.state.seen.dronesTab) { tab = 'drones'; markDronesSeen(); sig = ''; } }, destroy() { offLoadout(); } };
}
