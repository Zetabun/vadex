import { materialIcon, gameIcon } from '@last-orbit/ui/icons.js';
// Modal dialogs: boon/anomaly picks, welcome back, stat breakdowns, confirmations, save export/import.
import { G, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { fmt, fmtTime, pct } from '@last-orbit/core/format.js';
import { CUR } from '@last-orbit/core/state.js';
import { BOON_TAGS, ANOMALIES } from '@last-orbit/data/boons.js';
import { DEF, STAT_NAMES, STAT_BASE } from '@last-orbit/progression/stats.js';
import { resolveChoice } from '@last-orbit/combat/sim.js';
import { exportSave } from '@last-orbit/save/save.js';
import { playSfx } from '@last-orbit/audio/audio.js';
import { MATERIAL_TIERS, MATERIAL_BY_ID } from '@last-orbit/data/materials.js';
import { h, clear } from '@last-orbit/ui/dom.js';

let host = null, dismissable = true, onClose = null, previousFocus = null, freezeAll = false;
const backgroundState = new Map();
const focusable = () => host ? [...host.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex=\"-1\"])')].filter((el) => !el.hidden && el.offsetParent !== null) : [];
function restoreBackgroundInteraction() {
  for (const [el, wasInert] of backgroundState) {
    el.inert = !!wasInert;
    if (!wasInert) el.removeAttribute?.('inert');
  }
  backgroundState.clear();
}
function lockBackgroundInteraction() {
  restoreBackgroundInteraction();
  if (!host?.parentElement) return;
  for (const sibling of host.parentElement.children) if (sibling !== host) { backgroundState.set(sibling, !!sibling.inert); sibling.inert = true; }
}
export function initModals(root) { host = h('div#modal', { onclick: (e) => { if (e.target === host && dismissable) closeModal(); } }); root.append(host); restoreBackgroundInteraction(); addEventListener('keydown', (e) => { if (!modalOpen()) return; if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (dismissable) closeModal(); return; } if (e.key !== 'Tab') return; const f = focusable(); if (!f.length) { e.preventDefault(); host.querySelector('.dlg')?.focus(); return; } const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }, true); }
export const modalOpen = () => !!host && host.classList.contains('on');
export const modalFreezesAll = () => modalOpen() && freezeAll;
export function openModal(node, opts = {}) { if (!modalOpen()) { previousFocus = document.activeElement; lockBackgroundInteraction(); } clear(host).append(node); host.classList.add('on'); dismissable = opts.dismiss !== false; freezeAll = !!opts.freezeAll; onClose = opts.onClose || null; requestAnimationFrame(() => { if (!node.isConnected || !modalOpen()) return; const f = focusable(); (f[0] || node).focus?.(); }); }
export function closeModal() {
  if (!host) return;
  const wasOpen = modalOpen(), f = onClose, restore = previousFocus;
  host.classList.remove('on'); clear(host); onClose = null; previousFocus = null; freezeAll = false; restoreBackgroundInteraction();
  if (!wasOpen) return;
  if (restore?.isConnected) restore.focus?.({ preventScroll: true }); if (f) f();
}
const dlg = (title, sub, ...kids) => h('div.dlg.cham', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' }, h('h2', title), sub ? h('div.sub', sub) : null, ...kids);

export function confirmDialog(title, text, okLabel, onOk, danger) {
  openModal(dlg(title, null, h('p.note', { style: 'font-size:13.5px;color:var(--text)' }, text), h('div.acts', h('button.btn', { onclick: closeModal }, 'Cancel'), h('button.btn' + (danger ? '.danger' : '.pri'), { onclick: () => { closeModal(); onOk(); } }, okLabel))));
}
export function infoDialog(title, sub, body, okLabel = 'Continue', after) { openModal(dlg(title, sub, body, h('div.acts', h('button.btn.pri', { onclick: closeModal }, okLabel))), { onClose: after }); }
export function onboardingDialog(spec, after) {
  const body = [h('p.note', { style: 'font-size:13.5px;color:var(--text)' }, spec.text), spec.hint ? h('p.note', spec.hint) : null];
  openModal(dlg(spec.title, spec.kicker || 'Command briefing', body, h('div.acts', h('button.btn.pri', { onclick: closeModal }, spec.okLabel || 'Continue'))), { dismiss: false, freezeAll: true, onClose: after });
}

export function bossLootDialog(report) {
  const rows = [];
  const add = (cur, value, label) => {
    if (!value || (value.isZero ? value.isZero() : value <= 0)) return;
    const d = CUR[cur] || { icon: '◆', color: 'var(--text)', name: label || cur };
    rows.push(h('div.gain', d.material ? materialIcon(d, d.kind) : h('i', { style: 'color:' + d.color }, gameIcon('currency', cur, 'reward-pixel', d.icon)), h('span', label || d.name), '+' + fmt(value)));
  };
  add('credits', report.credits); add('scrap', report.scrap); add(report.oreCur, report.ore, report.oreName); add('cores', report.cores); add('frags', report.frags);
  for (const m of report.modules || []) rows.push(h('div.gain', h('i', { style: 'color:var(--cyan)' }, gameIcon('module', m.type || 'experimental', 'reward-pixel', '⬢')), h('span', 'Module recovered'), m.name));
  if (!rows.length) rows.push(h('p.note', 'No additional salvage was recovered from this target.'));
  const body = [
    h('p.note', { style: 'font-size:13.5px;color:var(--text)' }, 'Salvage secured. Review the haul below; the battle and all production remain frozen until you continue.'),
    ...rows,
  ];
  openModal(dlg(report.mini ? 'Mini-boss destroyed' : 'Sector boss destroyed', `${report.name}${report.title ? ' · ' + report.title : ''} · Wave ${report.wave}`, body, h('div.acts', h('button.btn.pri', { onclick: closeModal }, 'Continue'))), { dismiss: false, freezeAll: true });
}

// ---------- boon / anomaly ----------
export function showChoice() {
  const pc = G.state.run.pendingChoice; if (!pc) return; const tagName = (t) => (BOON_TAGS.find((x) => x[0] === t) || [0, t])[1];
  const pick = (i) => { playSfx('milestone'); closeModal(); resolveChoice(i); };
  if (pc.kind === 'boon') {
    openModal(dlg('Field upgrade', `Choose one. Lasts until you rewind`, pc.options.map((id, i) => { const b = DEF.boons[id], have = G.state.run.boons[id] || 0; return h('button.choice' + (b.rare ? '.rare' : ''), { onclick: () => pick(i) }, gameIcon('boon', id, 'choice-pixel', '◆'), h('span.pill', tagName(b.tag)), h('b', b.name + (have ? `  ·  owned ×${have}` : '')), h('span', b.desc)); }),
      h('p.note', { style: 'margin-top:10px' }, 'Combat is paused while you decide. Recovery Fleet, Foundry and any active smelting continue.')), { dismiss: true });
  } else {
    const a = ANOMALIES.find((x) => x.id === pc.id);
    openModal(dlg(a.name, 'Anomaly · one choice', h('p.note', { style: 'font-size:13px;color:var(--text)' }, a.text), [a.a, a.b].map((c, i) => h('button.choice', { onclick: () => pick(i) }, gameIcon('tag', c.tag, 'choice-pixel', '◈'), h('span.pill', tagName(c.tag)), h('b', c.label), h('span', c.fx ? 'For the rest of this run' : 'Paid out now')))), { dismiss: true });
  }
}

// ---------- welcome back ----------
export function showOffline(r, note) {
  const rows = [];
  const line = (cur, v) => { if (v && !(v.isZero ? v.isZero() : v <= 0)) rows.push(h('div.gain', CUR[cur].material ? materialIcon(CUR[cur], CUR[cur].kind) : h('i', { style: 'color:' + CUR[cur].color }, gameIcon('currency', cur, 'reward-pixel', CUR[cur].icon)), h('span', CUR[cur].name), '+' + fmt(v))); };
  line('credits', r.credits); line('scrap', r.scrap); line('data', r.data); line('matter', r.matter); if (r.cores) line('cores', r.cores);
  if (r.xp > 0) rows.push(h('div.gain', h('i', { style: 'color:var(--cyan)' }, 'LV'), h('span', 'Ship XP'), '+' + fmt(r.xp)));
  if (r.fleet?.earned && !r.fleet.earned.isZero()) rows.push(h('div.gain', h('i', { style: 'color:var(--cyan)' }, '▣'), h('span', 'Fleet Supplies'), '+' + fmt(r.fleet.earned)));
  if (r.materials) {
    const ores = { ...(r.materials.extraOres || {}) }; if (r.materials.passiveOre > 0) ores[r.materials.extractId || 'iron'] = (ores[r.materials.extractId || 'iron'] || 0) + r.materials.passiveOre;
    for (const m of MATERIAL_TIERS) if (ores[m.id] > 0) line(m.oreCur, ores[m.id]);
    if (r.materials.barsCollected > 0) { const m = MATERIAL_BY_ID[r.materials.barsCollectedMaterial || 'iron']; line(m.barCur, r.materials.barsCollected); }
  }
  const body = [
    h('p.note', { style: 'color:var(--text);font-size:13px' }, `Offline reward window: ${fmtTime(r.used)}${r.capped ? ` of ${fmtTime(r.away)} away (cap reached)` : ''}. Combat ran at ${pct(r.eff)} efficiency${r.effective != null ? ` · ${fmtTime(r.effective)} combat-equivalent` : ''}.`),
    h('p.note', 'Rewards are derived from the ship, fitted gear, upgrades and real wave rewards at the front line you left behind. Active-only Focus and kill-streak bonuses are not assumed while away.'),
    ...rows,
    h('div.kv', 'Waves cleared', h('b', fmt(r.waves))), h('div.kv', 'Enemies destroyed', h('b', fmt(r.kills))),
    r.to > r.from ? h('div.kv', 'Front line', h('b', `wave ${r.from} → ${r.to}`)) : h('div.kv', 'Front line', h('b', 'wave ' + r.to)),
    r.farmWave && r.farmWave !== r.to ? h('div.kv', 'Offline farm', h('b', 'wave ' + r.farmWave)) : null,
    r.wall ? h('p.note', `Progress stopped at wave ${r.to}: the build could not clear the next wave unattended, so it farmed wave ${r.farmWave || Math.max(1, r.to - 1)} instead without moving your front line backwards.`) : null,
    r.choicesQueued ? h('p.note', `${r.choicesQueued} field decision${r.choicesQueued === 1 ? '' : 's'} crossed while away ${r.choicesQueued === 1 ? 'is' : 'are'} banked for you to choose now.`) : null,
    r.foundry?.cycles > 0 ? h('p.note', `Orbital Foundry: +${r.foundry.items} supplies, +${r.foundry.blueprints} Blueprints. ${r.foundry.stockFull ? 'Supply reserve filled; Blueprint production continued.' : ''} ${r.foundry.archiveFull ? 'Blueprint archive filled.' : ''}`) : null,
    r.materials?.completed > 0 ? (() => { const m = MATERIAL_BY_ID[(r.materials.barsCollected > 0 ? r.materials.barsCollectedMaterial : r.materials.readyMaterial) || 'iron']; return h('p.note', r.materials.barsCollected > 0 ? `Smelting: ${r.materials.barsCollected} ${m.name} Bar${r.materials.barsCollected === 1 ? '' : 's'} automatically collected.` : `Smelting complete: ${r.materials.readyBars} ${m.name} Bar${r.materials.readyBars === 1 ? '' : 's'} waiting for collection in Menu → Smelting.`); })() : null,
    r.fleet?.capped ? h('p.note', 'Recovery Fleet storage filled while you were away. Upgrade Cargo cradles to hold more Supplies.') : null,
    !G.sheet.f('f.offlineCombat') ? h('p.note', 'Research "Offline combat" to let the ship push new waves while you are away.') : null,
    note ? h('p.note', { style: 'color:var(--red)' }, note) : null,
  ];
  infoDialog('Welcome back', 'Offline report', body, 'Collect', () => { if (G.state.run.pendingChoice && !(G.sheet.f('f.autoBoon') > 0 && G.state.auto.boonTag !== 'ask')) showChoice(); });
}

// ---------- stat breakdown ----------
const PCT = { critChance: 1, dmgReduce: 1, offlineEff: 1, armorPen: 1, scrapChance: 1, haulerChance: 1, luck: 1, focusMax: 1, comboMax: 1, hullRegen: 1, shieldRegen: 1, waveHaste: 1 };
const fmtStat = (stat, v) => (PCT[stat] ? pct(v, v < 0.1 ? 1 : 0) : fmt(v, 2));
export function showBreakdown(stat) {
  const rows = G.sheet.breakdown(stat), total = G.sheet.b(stat), name = STAT_NAMES[stat] || stat, out = [];
  for (const r of rows) { if (r.add !== undefined) { if (r.group !== 'Base' && !r.add) continue; out.push(h('div.bd-row', r.group, h('b', (r.group === 'Base' ? '' : '+') + fmtStat(stat, r.add)))); } else out.push(h('div.bd-row', r.group, h('b', '×' + fmt(r.mul, 2)))); }
  out.push(h('div.bd-row.tot', 'Total', h('b', PCT[stat] ? pct(total.toNumber(), 1) : fmt(total, 2))));
  infoDialog(name, 'Where this number comes from', [h('p.note', '(Base + additions) × every multiplier. Base is ' + fmtStat(stat, STAT_BASE[stat] ?? 0) + '.'), ...out], 'Close');
}

// ---------- save export / import ----------
export function showSaveTools(onImport) {
  const ta = h('textarea', { placeholder: 'Paste a save string here to import', spellcheck: false });
  const copy = async () => { const s = exportSave(); ta.value = s; ta.select(); try { await navigator.clipboard.writeText(s); toast('Save copied to clipboard.', 'good'); } catch { toast('Save string is in the box. Copy it manually.', 'info'); } };
  const file = () => {
    const s = exportSave();
    try {
      const url = URL.createObjectURL(new Blob([s], { type: 'text/plain' }));
      const link = h('a', { href: url, download: `last-orbit-save-${new Date().toISOString().slice(0, 10)}.txt` });
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast('Save file ready to download.', 'good');
    } catch { ta.value = s; toast('Download unavailable. Copy the save string from the box.', 'info'); }
  };
  openModal(dlg('Save data', 'Export · import', h('p.note', 'Saves are stored in this browser. Export a copy before clearing site data or switching device.'), ta,
    h('div.acts', h('button.btn', { onclick: copy }, 'Copy save'), h('button.btn', { onclick: file }, 'Save to file')),
    h('div.acts', h('button.btn.danger', { onclick: () => { const v = ta.value.trim(); if (!v) return toast('Paste a save string first.', 'warn'); onImport(v); } }, 'Import (replaces current)'), h('button.btn.pri', { onclick: closeModal }, 'Done'))));
}
bus.on('choice', () => { if (!G.state.run.pendingChoice && modalOpen() && host.querySelector('.choice')) closeModal(); });
