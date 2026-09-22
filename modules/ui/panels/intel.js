// Intel: the bestiary. Everything you have met, described from the same tables the simulation uses.
import { G } from '@last-orbit/core/game.js';
import { ENEMIES, ELITE_MODS, WAVE_MODS } from '@last-orbit/data/enemies.js';
import { BOSSES } from '@last-orbit/data/bosses.js';
import { SECTORS } from '@last-orbit/data/sectors.js';
import { h, clear } from '@last-orbit/ui/dom.js';

const hex = (n) => '#' + (n ?? 0xffffff).toString(16).padStart(6, '0');
const pct = (v) => Math.round(v * 100) + '%';

/** Short mechanical tags read straight off the enemy definition, so they can never drift from the game. */
function traits(d) {
  const t = [];
  if (d.armour) t.push(`Armour ${pct(d.armour)}`);
  if (d.aura) t.push(d.aura.kind === 'shield' ? `Shields allies ${pct(d.aura.value)}` : d.aura.kind === 'heal' ? `Repairs allies ${pct(d.aura.value)}/s` : `Allies fire ${pct(d.aura.value)} faster`);
  if (d.stealth) t.push('Cloaks');
  if (d.dive) t.push('Dives');
  if (d.kamikaze) t.push('Rams you');
  if (d.split) t.push('Splits on death');
  if (d.spawn) t.push('Spawns ' + (ENEMIES[d.spawn.type]?.name || d.spawn.type));
  if (d.weave) t.push('Weaves');
  if (d.cruiser) t.push('Crosses the field');
  if (d.scrap > 1) t.push(`Scrap ×${d.scrap}`);
  if (d.fire) t.push({ bolt: 'Fires bolts', heavy: 'Heavy shells', aimed: 'Aimed shots', snipe: 'Telegraphed sniper line', beam: 'Column beam', shell: 'Mortar shells', rocket: 'Homing rockets' }[d.fire.kind] || 'Armed');
  if (!d.fire && !d.kamikaze && !d.aura && !d.projectile) t.push('Unarmed');
  return t;
}
const sectorsWith = (type) => SECTORS.filter((s) => s.pool.some(([t]) => t === type)).map((s) => s.name);

export function intelScreen(root, back) {
  const st = G.state, seen = st.seen.enemies || {}, seenB = st.seen.bosses || {}, seenE = st.seen.elites || {};
  const ids = Object.keys(ENEMIES).filter((k) => !ENEMIES[k].projectile);
  const known = ids.filter((k) => seen[k]);
  root.append(back(`Intel  ${known.length}/${ids.length}`));
  root.append(h('p.note', 'Every hostile you have fought, and what it does. Elite modifiers and sector bosses are listed once you have met them.'));
  if (G.sheet.f('f.threat') <= 0) root.append(h('p.note', { style: 'color:var(--amber2)' }, 'Buy the Threat readout in Upgrades → Systems to see hull bars and elite names in combat.'));
  for (const k of ids) {
    const d = ENEMIES[k];
    if (!seen[k]) { root.append(h('div.card.locked', h('div.c-name', '???'), h('div'), h('div.c-desc', 'Not yet encountered.'))); continue; }
    const where = sectorsWith(k);
    root.append(h('div.card', h('div.c-name', h('span', { style: 'color:' + hex(d.color) }, d.name), h('b', 'HULL ×' + d.hp)), h('div'),
      h('div.c-desc', d.desc || ''), h('div.c-val', { style: 'color:var(--dim)' }, traits(d).join('  ·  ')),
      where.length ? h('div.c-ms', h('div.ms-note', where.join(', '))) : null));
  }
  const eliteSeen = ELITE_MODS.filter((m) => seenE[m.id]);
  if (eliteSeen.length) { root.append(h('div.sec-h', 'Elite modifiers'));
    for (const m of eliteSeen) root.append(h('div.kv', h('span', { style: 'color:' + hex(m.color) }, m.name), h('b', m.hp ? `×${m.hp} hull, ×${m.size} size` : m.fireRate ? `×${m.fireRate} fire rate` : m.regen ? `Repairs ${pct(m.regen)}/s` : m.deathBurst ? `Bursts on death` : m.armour ? `Armour ${pct(m.armour)}` : m.leech ? `Heals allies on hit` : ''))); }
  const bossSeen = Object.keys(BOSSES).filter((b) => seenB[b]);
  if (bossSeen.length) { root.append(h('div.sec-h', 'Capital ships'));
    for (const b of bossSeen) { const d = BOSSES[b];
      root.append(h('div.card', h('div.c-name', h('span', { style: 'color:' + hex(d.color) }, d.name), h('b', d.title.toUpperCase())), h('div'),
        h('div.c-val', { style: 'color:var(--dim)' }, [`${d.phases.length} phases`, d.weak ? 'Weak point' : null, d.parts ? 'Destructible parts' : null, d.armour ? `Armour ${pct(d.armour)}` : null, d.cores ? `${d.cores} Boss Cores` : null].filter(Boolean).join('  ·  ')))); } }
  root.append(h('div.sec-h', 'Wave modifiers'));
  for (const m of WAVE_MODS) root.append(h('div.kv', m.name, h('b', { style: 'color:var(--dim)' }, m.desc)));
}
