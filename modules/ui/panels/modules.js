// Ship Loadout: central ARPG-style paper doll for every equippable ship system.
// Progression still lives in Arsenal/Research/Foundry; this screen is the single place to see and fit the ship.
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { fmt, pct } from '@last-orbit/core/format.js';
import { WEAPONS, WEAPON_ORDER, EVO_LEVELS } from '@last-orbit/data/weapons.js';
import { DRONES, DRONE_ORDER } from '@last-orbit/data/drones.js';
import { ABILITIES, ABILITY_ORDER } from '@last-orbit/data/abilities.js';
import { RECIPES } from '@last-orbit/data/foundry.js';
import { RARITIES, MODULE_TYPES, MODULE_MODS, MODULE_SETS, MODULE_SLOTS } from '@last-orbit/data/modules.js';
import { DEF, moduleScale, equippedModules } from '@last-orbit/progression/stats.js';
import { xpProgress } from '@last-orbit/progression/experience.js';
import { weaponOwned, droneTypeOpen, abilityOpen, equipWeapon, equipAbility, equipDroneBay, can } from '@last-orbit/progression/economy.js';
import { recipeOpen, equipSupply } from '@last-orbit/progression/foundry.js';
import { allSlots, slotAccepts, score, getModule, equippedSlotOf, equipModule, unequipModule, fitBest, salvageQuote, salvage, salvageAllBelow, toggleLock, FORGE_COST, forge, maxModuleLevel, tuneCost, tune } from '@last-orbit/modules/modules.js';
import { playSfx } from '@last-orbit/audio/audio.js';
import { h, clear, select } from '@last-orbit/ui/dom.js';
import { gameIcon } from '@last-orbit/ui/icons.js';
import { equipmentPicker } from '@last-orbit/ui/equipment-picker.js';
import { weaponReadout, loadoutDps } from '@last-orbit/ui/weapon-readout.js';
import { confirmDialog } from '@last-orbit/ui/modals.js';

const WEAPON_ICONS = { cannon: '▰', laser: '╫', missile: '⇈', tesla: 'ϟ', rail: '━', plasma: '◉', mine: '✣', prism: '◇' };
const DRONE_ICONS = { attack: '✥', mining: '⛏', survey: '◎', missile: '⌁', repair: '✚', collect: '◆', shield: '⬡', intercept: '✦' };
const KIND_ORDER = { weapon: 0, module: 1, drone: 2, ability: 3, support: 4 };

function fxText([stat, op, v], scale) { const meta = MODULE_MODS.find((m) => m[0] === stat), label = meta ? meta[3] : stat, x = v * scale; return (op === 'add' ? (meta && meta[4] === 'n' ? '+' + fmt(x, 1) : '+' + pct(x, 1)) : (x < 0 ? '−' : '+') + pct(Math.abs(x), 0)) + ' ' + label; }
function primaryText(m) { const t = MODULE_TYPES[m.type], [, op, v] = t.primary, x = v * moduleScale(m); return (op === 'add' ? '+' + fmt(x, 2) + '× ' : '+' + pct(x, 0) + ' ') + t.text; }
function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }
function moduleSlotName(slot) { if (slot.startsWith('exp')) return 'Experimental'; return MODULE_TYPES[slot]?.name || slot; }

function equipmentOptions(value, options, onChange, label, kind) {
  return { value: String(value ?? ''), options, onChange, label, kind };
}

function shipSVG() { return `<svg viewBox="0 0 240 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Armoured defence ship with swept wings, twin engines and illuminated cockpit">
<defs><linearGradient id="hull" x2="1" y2=".4"><stop stop-color="#263e4b"/><stop offset=".43" stop-color="#a7bdc7"/><stop offset=".51" stop-color="#718d9d"/><stop offset="1" stop-color="#233b49"/></linearGradient><linearGradient id="plate" x2=".8" y2="1"><stop stop-color="#c6d8dc"/><stop offset=".45" stop-color="#536f80"/><stop offset="1" stop-color="#182f3e"/></linearGradient><linearGradient id="glass" x2=".3" y2="1"><stop stop-color="#e7feff"/><stop offset=".2" stop-color="#6ce1ed"/><stop offset="1" stop-color="#12364d"/></linearGradient><linearGradient id="exhaust" x2="0" y2="1"><stop stop-color="#e9ffff"/><stop offset=".25" stop-color="#63e2ff"/><stop offset="1" stop-color="#327cf2" stop-opacity="0"/></linearGradient></defs>
<g stroke="#07141e" stroke-width="2" stroke-linejoin="round">
<path d="M85 269L98 343L109 278M131 278L142 343L155 269" fill="url(#exhaust)" stroke="none"/>
<path d="M101 111L69 131L20 218L17 261L75 250L104 217M139 111L171 131L220 218L223 261L165 250L136 217" fill="url(#plate)"/>
<path d="M73 149L36 222L31 243L74 229L91 173M167 149L204 222L209 243L166 229L149 173" fill="#203e50" stroke="#7894a2"/>
<path d="M31 244L75 231L72 242L28 255M209 244L165 231L168 242L212 255" fill="#ecae58" stroke="none"/>
<path d="M56 147L65 132L74 147L74 253L56 253ZM166 147L175 132L184 147L184 253L166 253" fill="url(#hull)"/>
<path d="M61 133V112H69V133M171 133V112H179V133" fill="#b3cbd2"/>
<path d="M80 227L99 214L112 237L109 283L83 283ZM128 237L141 214L160 227L157 283L131 283Z" fill="url(#hull)"/>
<path d="M85 273H107V283H85ZM133 273H155V283H133Z" fill="#69e6f3"/>
<path d="M120 23L139 73L153 190L139 255L120 272L101 255L87 190L101 73Z" fill="url(#hull)"/>
<path d="M120 23V70L104 85M120 70L136 85" fill="none" stroke="#d1e1e5" stroke-width="1"/>
<path d="M120 76L132 98L129 143L120 154L111 143L108 98Z" fill="url(#glass)" stroke="#183d52" stroke-width="4"/>
<path d="M112 108L128 100M120 79V144" fill="none" stroke="#c8fbff" stroke-width="1" opacity=".55"/>
<path d="M100 156L112 171L109 216L98 202ZM140 156L128 171L131 216L142 202Z" fill="#344f60" stroke="#91a9b5" stroke-width="1"/>
<path d="M120 165L130 177L126 200L114 200L110 177Z" fill="#182d3c"/><path d="M120 175L124 181L122 193H118L116 181Z" fill="#ffd28b" stroke="#f4a746"/>
<path d="M111 212H129L133 244L120 256L107 244Z" fill="url(#plate)"/>
<path d="M114 220H126M113 226H127M112 232H128M111 238H129" stroke="#142c3d"/>
<path d="M60 166H70M60 174H70M60 182H70M170 166H180M170 174H180M170 182H180" stroke="#152c3a"/>
<path d="M94 117L98 98M146 117L142 98" stroke="#f6b75d" stroke-width="3"/>
<circle cx="22" cy="237" r="3" fill="#eeb571" stroke="none"/><circle cx="218" cy="237" r="3" fill="#76eddd" stroke="none"/>
</g></svg>`; }

function shipFigure(st) {
  const xp = xpProgress(st.run.xp || 0);
  return h('div.loadout-ship-stage',
    h('div.loadout-orbit-ring.r1'), h('div.loadout-orbit-ring.r2'), h('div.loadout-grid-plane'),
    h('div.loadout-ship-level', h('small', 'SHIP LEVEL'), h('b', String(xp.level)), h('span', `${fmt(xp.current)} / ${fmt(xp.needed)} XP`), h('i', h('u', { style: `width:${(xp.fraction * 100).toFixed(1)}%` }))),
    h('div.loadout-ship-art', { html: shipSVG() }),
    h('div.loadout-ship-caption', h('b', 'DEFENCE SHIP'), h('span', 'LIVE CONFIGURATION')));
}

function itemKey(kind, id) { return kind + ':' + id; }

export function modulesPanel() {
  let dirty = true, salvBelow = 2, invTab = 'all', selectedKey = null, selectedSlot = null;
  let slotRecords = [];

  function gearCard(data) {
    const key = data.key || data.kind + ':' + data.label;
    slotRecords.push({ ...data, key });
    if (!selectedSlot) selectedSlot = key;
    return h('button.loadout-gear-card.' + data.side + (data.locked ? '.locked' : '') + (data.empty ? '.empty' : '') + (selectedSlot === key ? '.selected' : ''), { type: 'button', style: `--slot-accent:${data.accent || 'var(--cyan)'}`, 'aria-label': `${data.label}: ${data.name || 'Empty'}`, 'aria-pressed': String(selectedSlot === key), onclick: () => { selectedSlot = key; dirty = true; update(); root.querySelector('.loadout-gear-card.selected')?.focus({ preventScroll: true }); openSlot(key); } }, h('span.loadout-gear-icon', data.empty || data.locked ? '' : data.artKind ? gameIcon(data.artKind, data.artId, 'loadout-pixel', data.icon || '+') : (data.icon || '+')), h('span.loadout-slot-label', data.label), h('span.loadout-slot-state', data.locked ? 'LOCKED' : data.empty ? 'EMPTY' : 'FITTED'), h('span.loadout-slot-name', data.locked || data.empty ? '' : data.name));
  }
  function lockedCard(side, kind, label, icon, copy) { return gearCard({ side, kind, label, icon, name: copy, accent: '#8394a0', locked: true }); }

  function focusSlot() { root.querySelector('.loadout-gear-card.selected')?.focus({ preventScroll: true }); }

  function pickerOptions(slot) {
    const items = inventoryItems(G.state);
    return slot.picker.options.map(([id, name]) => {
      const item = items.find(x => x.kind === slot.picker.kind && String(x.id) === String(id));
      if (!item) return { id, name: id === '' ? 'Empty slot' : name, icon: '−', desc: 'Remove the fitted equipment from this slot. It remains available in your inventory.' };
      const info = detailStats(item);
      let location = '';
      if (item.equipped && String(id) !== slot.picker.value) {
        location = item.kind === 'module' ? 'Fitted elsewhere. Equipping here moves this module out of its current slot.'
          : item.kind === 'weapon' || item.kind === 'ability' ? 'Fitted elsewhere. Equipping here swaps the two slots.' : '';
      }
      return { id, name: item.name, icon: item.icon, artKind: item.artKind, artId: item.artId, accent: item.accent, meta: `${item.rarity} · ${item.kind === 'support' ? 'Stock ×' : 'LV '}${item.level}`, desc: info.desc, rows: info.rows, location };
    });
  }

  function applySlot(key, id) {
    // Rebuild from current state before applying: an unlock, drop or upgrade may have changed it.
    dirty = true; update();
    const live = slotRecords.find(x => x.key === key);
    if (!live?.picker || !live.picker.options.some(x => String(x[0]) === String(id))) return false;
    live.picker.onChange(String(id));
    return true;
  }

  function openSlot(key) {
    const slot = slotRecords.find(x => x.key === key);
    if (!slot) return;
    playSfx('tab');
    equipmentPicker({ title: slot.label, subtitle: slot.locked ? slot.kind : slot.picker?.options.every(([id]) => id === '') ? 'No compatible equipment recovered yet. Find modules through combat or the module forge.' : 'Select compatible equipment. Nothing changes until you confirm.',
      options: slot.picker ? pickerOptions(slot) : [], value: slot.picker?.value,
      lockedMessage: slot.locked ? `${slot.name}. ${slot.kind === 'DRONE BAY' ? 'Open Research → Drones to unlock or expand your drone bays.' : slot.kind === 'ABILITY SLOT' ? 'Progress through combat and research to unlock additional ability slots.' : 'Open Menu → Foundry to commission support production.'}` : null,
      onApply: id => applySlot(key, id), onClose: () => { dirty = true; update(); focusSlot(); } });
  }

  function buildFitting() {
    const slot = slotRecords.find(x => x.key === selectedSlot) || slotRecords[0];
    if (!slot) return;
    const box = h('section.loadout-fitting', { style: `--slot-accent:${slot.accent || 'var(--cyan)'}` }, h('div.loadout-fitting-title', h('span.loadout-gear-icon', slot.empty || slot.locked ? '' : slot.artKind ? gameIcon(slot.artKind, slot.artId, 'loadout-pixel', slot.icon || '◇') : slot.icon), h('div', h('small', slot.kind), h('h4', slot.name), h('p', slot.meta || (slot.locked ? 'Continue progressing to unlock this system.' : slot.empty ? 'Choose compatible equipment below.' : slot.label)))));
    box.append(h('button.btn.loadout-change', { onclick: () => openSlot(slot.key) }, slot.locked ? 'Unlock information' : 'Change equipment')); 
    root.append(box);
  }
  const root = h('div.loadout-root');
  const markDirty = () => { dirty = true; };
  const offModules = bus.on('modules', markDirty);
  const offStats = bus.on('stats', markDirty);
  const offLoadout = bus.on('loadout', markDirty);
  const offFoundry = bus.on('foundry', markDirty);
  const offUnlock = bus.on('unlock', markDirty);

  function buildSummary(st) {
    const weaponCap = Math.floor(G.sheet.n('weaponSlots')), droneCap = Math.floor(G.sheet.n('droneBays')), abilityCap = Math.floor(G.sheet.n('abilitySlots'));
    const moduleSlots = allSlots();
    const fittedWeapons = st.run.equipped.slice(0, weaponCap).filter(Boolean).length;
    const fittedDrones = st.run.drones.bays.slice(0, droneCap).filter(Boolean).length;
    const fittedAbilities = st.abilities.equipped.slice(0, abilityCap).filter(Boolean).length;
    const fittedModules = moduleSlots.filter((s) => st.modules.equipped[s]).length;
    root.append(h('header.loadout-hero',
      h('div', h('small', 'SHIP LOADOUT'), h('h4', 'Your ship. Your build.'), h('p', 'Select a hardpoint to inspect and fit equipment. Changes apply immediately.')),
      h('div.loadout-summary',
        h('span', `Weapons ${fittedWeapons}/${weaponCap}`),
        h('span', `Modules ${fittedModules}/${moduleSlots.length}`),
        h('span', st.unlocks.drones ? `Drones ${fittedDrones}/${droneCap}` : 'Drones —'),
        h('span', st.unlocks.abilities ? `Abilities ${fittedAbilities}/${abilityCap}` : 'Abilities —')),
      h('div.weapon-report', h('div.weapon-report-title', h('b', `Estimated ship DPS ${fmt(loadoutDps(st.run.equipped.slice(0, weaponCap), G.sheet.weapons))}`), h('small', 'Single target · before enemy armour or temporary effects')),
        st.run.equipped.slice(0, weaponCap).filter(Boolean).map((id, index) => {
          const r = weaponReadout(G.sheet.weapons[id]);
          return r ? h('div.weapon-report-row', h('strong', `Hardpoint ${index + 1} · ${WEAPONS[id].name}`), h('span', `Damage ${r.damage}`), h('span', `Crit ${r.critRate}`), h('span', `Crit hit ${r.critDamage}`), h('span', `Fire ${r.fireRate}`), h('b', `${r.dpsText} DPS`)) : null;
        }))));
  }

  function weaponCard(st, slot, side) {
    const current = st.run.equipped[slot] || '', d = current && WEAPONS[current], only = st.run.challenge && DEF.challenges[st.run.challenge]?.onlyWeapon, owned = WEAPON_ORDER.filter(id => weaponOwned(id) && (!only || only === id));
    const opts = (slot > 0 ? [['', 'Empty hardpoint']] : []).concat(owned.map((id) => [id, WEAPONS[id].name]));
    const picker = equipmentOptions(current, opts, (v) => { equipWeapon(slot, v || null); playSfx('tab'); dirty = true; update(); }, `Weapon hardpoint ${slot + 1}`, 'weapon');
    return gearCard({ side, kind: slot === 0 ? 'PRIMARY WEAPON' : slot === 1 ? 'SECONDARY WEAPON' : 'AUXILIARY WEAPON', label: `Hardpoint ${slot + 1}`, icon: d ? WEAPON_ICONS[current] : '＋', artKind: d ? 'weapon' : null, artId: d ? current : null, name: d ? d.name : 'Empty', meta: d ? `LV ${st.run.weapons[current] || 1}` : '', accent: d ? hex(d.color) : 'var(--cyan)', picker, empty: !d });
  }

  function moduleCard(st, slot, side) {
    const currentId = st.modules.equipped[slot] || '', m = currentId && getModule(currentId), experimental = slot.startsWith('exp'), t = MODULE_TYPES[experimental ? 'experimental' : slot];
    const candidates = st.modules.inv.filter((x) => slotAccepts(slot, x) && (experimental || x.type !== 'experimental')).sort((a, b) => score(b) - score(a));
    const opts = [['', 'Empty slot'], ...candidates.map((x) => [String(x.id), `${RARITIES[x.rarity].name} · ${x.name}`])];
    const picker = equipmentOptions(currentId, opts, (v) => { if (v) equipModule(+v, slot); else unequipModule(slot); playSfx(v ? 'loot' : 'tab'); dirty = true; update(); }, `${moduleSlotName(slot)} slot`, 'module');
    return gearCard({ key: 'module-slot:' + slot, side, kind: experimental ? 'EXPERIMENTAL SLOT' : t.name.toUpperCase(), label: experimental ? `Experimental ${Number(slot.slice(3)) + 1}` : moduleSlotName(slot), icon: m ? MODULE_TYPES[m.type].icon : '', artKind: m ? 'module' : null, artId: m?.type, name: m ? m.name : 'Empty slot', meta: m ? `${RARITIES[m.rarity].name} · LV ${m.level}` : '', accent: m ? RARITIES[m.rarity].color : experimental ? 'var(--violet)' : 'var(--cyan)', picker, empty: !m });
  }

  function droneCard(st, slot, side) {
    const cap = Math.floor(G.sheet.n('droneBays'));
    if (!st.unlocks.drones || slot >= cap) return lockedCard(side, 'DRONE BAY', `Bay ${slot + 1}`, '⁂', 'Research required');
    const current = st.run.drones.bays[slot] || '', d = current && DRONES[current], available = DRONE_ORDER.filter(droneTypeOpen);
    const opts = [['', 'Empty bay'], ...available.map((id) => [id, DRONES[id].name])];
    const picker = equipmentOptions(current, opts, (v) => { equipDroneBay(slot, v || null); playSfx('tab'); dirty = true; update(); }, `Drone bay ${slot + 1}`, 'drone');
    return gearCard({ side, kind: 'DRONE BAY', label: `Bay ${slot + 1}`, icon: d ? DRONE_ICONS[current] : '⁂', artKind: d ? 'drone' : null, artId: d ? current : null, name: d ? d.name : 'Empty bay', meta: d ? `LV ${st.run.drones.levels[current] || 1}` : '', accent: d ? hex(d.color) : 'var(--green)', picker, empty: !d });
  }

  function abilityCard(st, slot, side) {
    const cap = Math.floor(G.sheet.n('abilitySlots'));
    if (!st.unlocks.abilities || slot >= cap) return lockedCard(side, 'ABILITY SLOT', `Ability ${slot + 1}`, '◇', 'Unlocks through combat');
    const current = st.abilities.equipped[slot] || '', d = current && ABILITIES[current], available = ABILITY_ORDER.filter(abilityOpen);
    const opts = [['', 'Empty slot'], ...available.map((id) => [id, `${ABILITIES[id].icon} ${ABILITIES[id].name}`])];
    const picker = equipmentOptions(current, opts, (v) => { equipAbility(slot, v || null); playSfx('tab'); dirty = true; update(); }, `Ability slot ${slot + 1}`, 'ability');
    return gearCard({ side, kind: 'ABILITY SLOT', label: `Ability ${slot + 1}`, icon: d ? d.icon : '◇', artKind: d ? 'ability' : null, artId: d ? current : null, name: d ? d.name : 'Empty slot', meta: d ? `${d.cd}s cooldown` : '', accent: d ? d.color : 'var(--amber)', picker, empty: !d });
  }

  function supportCard(st, side) {
    if (!st.unlocks.foundry || !st.foundry.commissioned) return lockedCard(side, 'SUPPORT SLOT', 'Foundry support', '▣', 'Foundry offline');
    const openRecipes = RECIPES.filter((r) => recipeOpen(r.id));
    if (!openRecipes.length) return lockedCard(side, 'SUPPORT SLOT', 'Foundry support', '▣', 'No recipes yet');
    const current = st.foundry.equipped, d = RECIPES.find((r) => r.id === current) || openRecipes[0];
    const picker = equipmentOptions(current, openRecipes.map((r) => [r.id, `${r.icon} ${r.name}`]), (v) => { if (equipSupply(v)) playSfx('tab'); dirty = true; update(); }, 'Foundry support slot', 'support');
    return gearCard({ side, kind: 'SUPPORT SLOT', label: 'Foundry supply', icon: d.icon, artKind: 'support', artId: d.id, name: d.name, meta: `Stock ×${st.foundry.stock[d.id] || 0}`, accent: 'var(--amber)', picker });
  }

  function buildPaperDoll(st) {
    slotRecords = [];
    const left = [], right = [], overflow = [];
    const weaponCap = Math.floor(G.sheet.n('weaponSlots'));
    for (let i = 0; i < weaponCap; i++) (i === 0 ? left : overflow).push(weaponCard(st, i, 'left'));

    for (const s of ['weaponmod', 'shieldgen', 'processor']) left.push(moduleCard(st, s, 'left'));
    for (const s of ['reactor', 'targeting', 'engine', 'dronebay']) right.push(moduleCard(st, s, 'right'));

    const exp = allSlots().filter((s) => s.startsWith('exp'));
    exp.forEach((s) => overflow.push(moduleCard(st, s, 'left')));

    const droneCap = Math.floor(G.sheet.n('droneBays'));
    if (st.unlocks.drones || droneCap) {
      for (let i = 0; i < Math.max(2, droneCap); i++) overflow.push(droneCard(st, i, 'right'));
    } else overflow.push(droneCard(st, 0, 'right'));

    const abilityCap = Math.floor(G.sheet.n('abilitySlots'));
    if (st.unlocks.abilities || abilityCap) {
      for (let i = 0; i < Math.max(2, abilityCap); i++) {
        const card = abilityCard(st, i, i === 0 ? 'left' : 'right');
        overflow.push(card);
      }
    } else overflow.push(abilityCard(st, 0, 'left'));

    overflow.push(supportCard(st, 'right'));

    root.append(h('section.loadout-paperdoll', h('div.loadout-rig.left-rig', left), shipFigure(st), h('div.loadout-rig.right-rig', right)));
    buildFitting();
    if (overflow.length) root.append(h('div.loadout-expansion', h('small', 'SUPPORT & EXPANSION'), h('div', overflow)));
  }

  function inventoryItems(st) {
    const out = [];
    for (const id of WEAPON_ORDER) if (weaponOwned(id)) {
      const d = WEAPONS[id]; out.push({ key: itemKey('weapon', id), kind: 'weapon', id, name: d.name, icon: WEAPON_ICONS[id], artKind: 'weapon', artId: id, accent: hex(d.color), rarity: 'Weapon', level: st.run.weapons[id] || 1, subtitle: d.arch, equipped: st.run.equipped.includes(id), order: KIND_ORDER.weapon });
    }
    for (const m of st.modules.inv) {
      const R = RARITIES[m.rarity], t = MODULE_TYPES[m.type]; out.push({ key: itemKey('module', m.id), kind: 'module', id: m.id, name: m.name, icon: t.icon, artKind: 'module', artId: m.type, accent: R.color, rarity: R.name, level: m.level, subtitle: t.name, equipped: !!equippedSlotOf(m.id), isNew: m.isNew, order: KIND_ORDER.module, module: m });
    }
    if (st.unlocks.drones) for (const id of DRONE_ORDER) if (droneTypeOpen(id)) {
      const d = DRONES[id]; out.push({ key: itemKey('drone', id), kind: 'drone', id, name: d.name, icon: DRONE_ICONS[id], artKind: 'drone', artId: id, accent: hex(d.color), rarity: 'Drone', level: st.run.drones.levels[id] || 1, subtitle: `Tier ${d.tier}`, equipped: st.run.drones.bays.includes(id), order: KIND_ORDER.drone });
    }
    if (st.unlocks.abilities) for (const id of ABILITY_ORDER) if (abilityOpen(id)) {
      const d = ABILITIES[id]; out.push({ key: itemKey('ability', id), kind: 'ability', id, name: d.name, icon: d.icon, artKind: 'ability', artId: id, accent: d.color, rarity: 'Ability', level: 1, subtitle: d.tag, equipped: st.abilities.equipped.includes(id), order: KIND_ORDER.ability });
    }
    if (st.unlocks.foundry && st.foundry.commissioned) for (const r of RECIPES) if (recipeOpen(r.id)) out.push({ key: itemKey('support', r.id), kind: 'support', id: r.id, name: r.name, icon: r.icon, artKind: 'support', artId: r.id, accent: '#ffb547', rarity: 'Support', level: st.foundry.stock[r.id] || 0, subtitle: 'Foundry supply', equipped: st.foundry.equipped === r.id, order: KIND_ORDER.support });
    return out.sort((a, b) => a.order - b.order || (b.equipped ? 1 : 0) - (a.equipped ? 1 : 0) || a.name.localeCompare(b.name));
  }

  function filteredItems(items) {
    if (invTab === 'all') return items;
    if (invTab === 'systems') return items.filter((x) => x.kind === 'ability' || x.kind === 'support');
    return items.filter((x) => x.kind === invTab);
  }

  function selectItem(item) { selectedKey = item.key; if (item.kind === 'module') { const m = getModule(item.id); if (m) m.isNew = false; } dirty = true; update(); root.querySelector('.loadout-item.selected')?.focus({ preventScroll: true }); root.querySelector('.loadout-detail')?.scrollIntoView({ block: 'nearest' }); }

  function inventoryTile(item) {
    return h('button.loadout-item' + (item.equipped ? '.equipped' : '') + (selectedKey === item.key ? '.selected' : '') + (item.isNew ? '.new' : ''), { style: `--item-accent:${item.accent}`, onclick: () => selectItem(item), 'aria-label': `${item.name}, ${item.rarity}${item.equipped ? ', fitted' : ''}`, 'aria-pressed': String(selectedKey === item.key) },
      h('i.loadout-item-icon', item.artKind ? gameIcon(item.artKind, item.artId, 'loadout-pixel', item.icon || '◇') : item.icon), h('b', item.name), h('small', item.rarity), h('span', item.kind === 'support' ? `×${item.level}` : `LV ${item.level}`), item.equipped ? h('em', 'FITTED') : null);
  }

  function actionEquip(item) {
    const slots = slotRecords.filter(x => x.picker?.kind === item.kind && x.picker.value !== String(item.id) && x.picker.options.some(([id]) => String(id) === String(item.id)));
    equipmentPicker({ title: 'Choose a destination', subtitle: `Fit ${item.name}. Select the slot you want to replace.`,
      value: '__none__', preferred: (slots.find(x => x.empty) || slots[0])?.key, applyLabel: 'Equip here',
      lockedMessage: slots.length ? null : 'No compatible slots are available. Unlock a suitable ship slot before fitting this equipment.',
      options: slots.map(x => ({ id: x.key, name: x.label, icon: x.icon, artKind: x.artKind, artId: x.artId, accent: x.accent, meta: x.empty ? 'Empty' : `Fitted: ${x.name}`, desc: x.empty ? 'Fit into this empty slot.' : `Replace ${x.name}. Your existing equipment remains available.`, rows: [['New equipment', item.name]] })),
      onApply: key => { selectedSlot = key; return applySlot(key, item.id); },
      onClose: () => { dirty = true; update(); focusSlot(); } });
  }

  function detailStats(item) {
    const rows = [];
    if (item.kind === 'weapon') {
      const d = WEAPONS[item.id], lvl = G.state.run.weapons[item.id] || 1, evos = EVO_LEVELS.filter((x) => lvl >= x).length;
      const r = weaponReadout(G.sheet.weapons[item.id]);
      rows.push(['Base damage', fmt(d.base.dmg || 0, 1)]);
      if (r) rows.push(['Current damage', r.damage], ['Crit rate', r.critRate], ['Crit hit', r.critDamage], ['Fire rate', r.fireRate], ['Estimated DPS', r.dpsText]);
      else rows.push(['Base fire rate', `${fmt(d.base.rate || 0, 2)}/s`]);
      if (d.base.proj) rows.push(['Projectiles', String(d.base.proj)]); if (d.base.splash) rows.push(['Blast radius', fmt(d.base.splash, 1)]); if (evos) rows.push(['Evolutions', `${evos}/${d.evo.length}`]);
      return { desc: d.desc, rows };
    }
    if (item.kind === 'module') {
      const m = getModule(item.id); if (!m) return { desc: '', rows }; const sc = moduleScale(m);
      rows.push(['Primary', primaryText(m)]); for (const mod of m.mods) rows.push(['Affix', fxText(mod, sc)]); if (m.special) rows.push(['Special', DEF.specials[m.special].text]); if (m.set) rows.push(['Set', MODULE_SETS[m.set].name]);
      return { desc: `Permanent ${MODULE_TYPES[m.type].name.toLowerCase()} hardware.`, rows };
    }
    if (item.kind === 'drone') {
      const d = DRONES[item.id]; rows.push(['Tier', String(d.tier)]); if (d.dmg) rows.push(['Damage scale', `×${fmt(d.dmg, 1)}`]); if (d.rate) rows.push(['Fire rate', `${fmt(d.rate, 1)}/s`]); if (d.heal) rows.push(['Repair', pct(d.heal, 1) + '/s']); if (d.gain) rows.push(['Resource gain', '+' + pct(d.gain, 0)]); return { desc: d.desc, rows };
    }
    if (item.kind === 'ability') { const d = ABILITIES[item.id]; rows.push(['Cooldown', `${d.cd}s`]); if (d.dur) rows.push(['Duration', `${d.dur}s`]); rows.push(['Role', d.tag]); return { desc: d.desc, rows }; }
    const r = RECIPES.find((x) => x.id === item.id); if (r) rows.push(['Stock', `×${G.state.foundry.stock[r.id] || 0}`]); return { desc: r?.desc || '', rows };
  }

  function buildItemDetail(item) {
    if (!item) return h('aside.loadout-detail.empty', h('i', '◇'), h('b', 'Select equipment'), h('p', 'Choose an item from the inventory to inspect its stats and fitting options.'));
    const info = detailStats(item), st = G.state;
    const detail = h('aside.loadout-detail', { style: `--item-accent:${item.accent}` },
      h('div.loadout-detail-head', h('i', item.artKind ? gameIcon(item.artKind, item.artId, 'loadout-pixel', item.icon || '◇') : item.icon), h('div', h('small', item.rarity.toUpperCase()), h('h4', item.name), h('span', item.subtitle))),
      h('div.loadout-detail-level', item.kind === 'support' ? `STOCK ×${item.level}` : `LV ${item.level}`),
      h('div.loadout-detail-stats', info.rows.map(([k, v]) => h('div', h('span', k), h('b', v)))),
      h('p.loadout-detail-desc', info.desc));

    const actions = h('div.loadout-detail-actions');
    if (item.kind === 'module') {
      const m = getModule(item.id), slot = m && equippedSlotOf(m.id), tc = m && tuneCost(m), maxed = m && m.level >= maxModuleLevel(m), canTune = m && !maxed && can('cores', tc.cores) && can('scrap', tc.scrap);
      actions.append(slot ? h('button.btn.sm', { onclick: () => { unequipModule(slot); playSfx('tab'); dirty = true; update(); } }, 'Remove') : h('button.btn.sm.pri', { onclick: () => actionEquip(item) }, 'Equip'));
      if (m && G.sheet.f('f.fuse') > 0) actions.append(h('button.btn.sm', { disabled: !canTune, onclick: () => { if (tune(m.id)) playSfx('buy'); else playSfx('deny'); dirty = true; update(); } }, maxed ? 'Max level' : `Tune ⬢${fmt(tc.cores)}`));
      if (m) actions.append(h('button.btn.sm', { onclick: () => { toggleLock(m.id); dirty = true; update(); } }, m.locked ? 'Unlock' : 'Lock'));
      if (m && !slot && !m.locked) { const sq = salvageQuote(m); actions.append(h('button.btn.sm.danger', { onclick: () => { confirmDialog('Salvage module', `Salvage ${m.name} for ⚙${fmt(sq.scrap)}${sq.cores ? ' and ⬢' + sq.cores : ''}?`, 'Salvage', () => { salvage(m.id); selectedKey = null; playSfx('die'); dirty = true; }, true); } }, 'Salvage')); }
    } else {
      const isEquipped = item.equipped || (item.kind === 'support' && st.foundry.equipped === item.id);
      actions.append(h('button.btn.sm.pri', { disabled: isEquipped && item.kind !== 'drone', onclick: () => actionEquip(item) }, isEquipped ? (item.kind === 'drone' ? 'Fit another bay' : 'Equipped') : 'Equip'));
    }
    detail.append(actions); return detail;
  }

  function buildInventory(st) {
    const items = inventoryItems(st), visible = filteredItems(items);
    if (!selectedKey || !visible.some((x) => x.key === selectedKey)) selectedKey = visible[0]?.key || null;
    const selected = visible.find((x) => x.key === selectedKey) || null;
    const counts = { all: items.length, weapon: items.filter((x) => x.kind === 'weapon').length, module: items.filter((x) => x.kind === 'module').length, drone: items.filter((x) => x.kind === 'drone').length, systems: items.filter((x) => x.kind === 'ability' || x.kind === 'support').length };
    const tabDefs = [['all', 'Inventory'], ['weapon', 'Weapons'], ['module', 'Modules'], ['drone', 'Drones'], ['systems', 'Systems']];
    const tabs = h('div.loadout-inv-tabs', { role: 'group', 'aria-label': 'Inventory categories' }, tabDefs.map(([id, label]) => h('button' + (invTab === id ? '.on' : ''), { 'aria-pressed': String(invTab === id), onclick: () => { invTab = id; const next = filteredItems(items)[0]; if (next) selectedKey = next.key; dirty = true; update(); } }, label, h('small', String(counts[id])))));
    const tools = h('div.loadout-inv-tools', h('span', `${st.modules.inv.length}/40 MODULES`), st.modules.inv.length ? h('button.btn.sm', { onclick: () => { fitBest(); playSfx('loot'); dirty = true; update(); } }, 'Fit best') : null);
    const grid = h('div.loadout-item-grid', visible.length ? visible.map(inventoryTile) : h('p.note', 'No equipment in this category yet.'));
    root.append(h('section.loadout-inventory', h('div.loadout-inventory-head', tabs, tools), h('div.loadout-inventory-body', grid, buildItemDetail(selected))));

    if (st.modules.inv.length) {
      root.append(h('div.loadout-module-tools', h('small', 'MODULE WORKSHOP'),
        h('div.row', h('button.btn.sm', { onclick: () => { const n = st.modules.inv.filter((m) => m.rarity < salvBelow && !equippedSlotOf(m.id) && !m.locked).length; if (!n) return; confirmDialog('Salvage modules', `Salvage ${n} unfitted, unlocked module${n > 1 ? 's' : ''} below ${RARITIES[salvBelow].name}?`, 'Salvage', () => { salvageAllBelow(salvBelow); playSfx('die'); dirty = true; }, true); } }, 'Salvage below'), select(RARITIES.slice(1, 5).map((r) => [r.id, r.name]), () => salvBelow, (v) => { salvBelow = +v; }))));
      if (G.sheet.f('f.autoSalvage') > 0) root.append(h('div.field', h('div', 'Auto-salvage drops below', h('small', 'Applies the moment a module drops')), select([[0, 'Off'], ...RARITIES.slice(1, 5).map((r) => [r.id, r.name])], () => st.auto.salvageBelow, (v) => { st.auto.salvageBelow = +v; })));
      if (G.sheet.f('f.craft') > 0) { const row = h('div.loadout-forge', h('small', `FORGE · ⬢${FORGE_COST}`)); for (const t of MODULE_SLOTS) row.append(h('button', { disabled: !can('cores', FORGE_COST), title: MODULE_TYPES[t].name, onclick: () => { if (forge(t)) playSfx('loot'); dirty = true; update(); } }, gameIcon('module', t, 'forge-pixel', MODULE_TYPES[t].icon), h('span', MODULE_TYPES[t].name))); root.append(row); }
      const sets = {}; for (const m of equippedModules(st)) if (m.set) sets[m.set] = (sets[m.set] || 0) + 1;
      for (const id in sets) { const S = MODULE_SETS[id], n = sets[id]; root.append(h('div.loadout-set-bonus', h('b', `◈ ${S.name} ${n}/4`), h('span', { className: n >= 2 ? 'active' : '' }, `(2) ${S.two.text}`), h('span', { className: n >= 4 ? 'active' : '' }, `(4) ${S.four.text}`))); }
    }
  }

  function update(force = false) {
    if (!dirty && !force) return;
    dirty = false; clear(root); const st = G.state;
    buildSummary(st); buildPaperDoll(st); buildInventory(st);
  }

  return {
    el: root,
    title: 'Ship Loadout',
    update,
    onOpen() { dirty = true; },
    onClose() { for (const m of G.state.modules.inv) m.isNew = false; },
    destroy() { offModules(); offStats(); offLoadout(); offFoundry(); offUnlock(); },
  };
}
