// Connected, pannable run skill web. Game rules come from progression/skills.
import { G } from '@last-orbit/core/game.js';
import { xpProgress } from '@last-orbit/data/experience.js';
import { SKILLS, SKILL_BY_ID, SKILL_NODES, SKILL_NODE_BY_ID, SKILL_LINKS, SKILL_TIER_WAVES, skillNeighbours, skillPointsEarned } from '@last-orbit/data/skills.js';
import { skillPoints, skillRank, skillStatus, buySkill, respecSkills } from '@last-orbit/progression/skills.js';
import { h, setText, setClass } from '@last-orbit/ui/dom.js';
import { playSfx } from '@last-orbit/audio/audio.js';

const WORLD = { width: 1400, height: 1100, centerX: 700, centerY: 550 };
const COLORS = { core: '#8cdeff', weapons: '#ff7778', defence: '#69e6af', salvage: '#ffd36d', mobility: '#eb83d3' };
const LABELS = { weapons: 'WEAPONS', defence: 'DEFENCE', salvage: 'SALVAGE', mobility: 'MOBILITY' };
const EFFECT_NAMES = { damage: 'Weapon damage', fireRate: 'Fire rate', critChance: 'Crit chance', bossDmg: 'Boss damage', hull: 'Hull', hullRegen: 'Hull regen / s', shieldRatio: 'Shield / hull', lifeSteal: 'Lifesteal', creditGain: 'Credits', scrapGain: 'Scrap', moveSpeed: 'Move speed', abilityCd: 'Ability cooldown' };
const effectText = (skill, rank) => {
  const [stat, , perRank] = skill.fx[0], amount = Math.round(perRank * rank * 1000) / 10;
  return EFFECT_NAMES[stat] + ' ' + (amount > 0 ? '+' : '') + amount + '%';
};
const bounded = (n, min, max) => Math.min(max, Math.max(min, n));

export function skillsPanel() {
  let selected = 'calibration', zoom = 0.85, panX = 0, panY = 0, initialized = false, drag = null, suppressClick = false;
  const root = h('div.skills-root');
  const points = h('b.skills-points'), progress = h('small.skills-progress');
  const respec = h('button.btn.sm', { type: 'button', onclick: () => { if (respecSkills()) { playSfx('tab'); update(); } } }, 'Reset');
  const summary = h('div.skills-summary', h('div', h('small', 'SHIP PROFICIENCY'), points, progress), respec);
  const nav = h('div.skill-web-nav', h('span', 'Drag to explore · tap a node to inspect'),
    ...[['core', 'Core', 700, 550], ['weapons', 'Weapons', 490, 360], ['defence', 'Defence', 910, 360], ['salvage', 'Salvage', 500, 735], ['mobility', 'Mobility', 900, 735]].map(([id, label, x, y]) =>
      h('button.skill-jump.' + id, { type: 'button', onclick: () => { centerOn(x, y); playSfx('tab'); } }, label)));
  const viewport = h('div.skill-viewport', { role: 'group', 'aria-label': 'Connected skill tree. Drag to move, scroll to zoom, or use the map controls.', tabIndex: 0 });
  const world = h('div.skill-world', { style: 'width:' + WORLD.width + 'px;height:' + WORLD.height + 'px' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('skill-links'); svg.setAttribute('viewBox', '0 0 ' + WORLD.width + ' ' + WORLD.height);
  svg.setAttribute('aria-hidden', 'true');
  const links = [];
  for (const [a, b] of SKILL_LINKS) {
    const from = SKILL_NODE_BY_ID[a], to = SKILL_NODE_BY_ID[b];
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    for (const [key, val] of [['x1', from.x], ['y1', from.y], ['x2', to.x], ['y2', to.y]]) line.setAttribute(key, val);
    line.style.setProperty('--path-color', COLORS[to.branch] || COLORS[from.branch]);
    svg.append(line); links.push({ a, b, line });
  }
  world.append(svg);
  for (const [label, x, y, branch] of [['WEAPONS', 350, 90, 'weapons'], ['DEFENCE', 1050, 90, 'defence'], ['SALVAGE', 300, 985, 'salvage'], ['MOBILITY', 1090, 985, 'mobility']]) {
    world.append(h('div.skill-world-label', { style: 'left:' + x + 'px;top:' + y + 'px;--path-color:' + COLORS[branch] }, label));
  }
  const core = h('div.skill-web-core', { style: 'left:' + WORLD.centerX + 'px;top:' + WORLD.centerY + 'px' },
    h('span.skill-ship'), h('b', 'PILOT CORE'), h('small', 'START'));
  world.append(core);
  const nodes = new Map();
  for (const node of SKILL_NODES) {
    if (node.id === 'core') continue;
    const skill = SKILL_BY_ID[node.id], rank = h('small.skill-web-rank'), name = node.name || skill.name;
    const button = h('button.skill-web-node' + (node.future ? '.future' : ''), {
      type: 'button', title: name, style: 'left:' + node.x + 'px;top:' + node.y + 'px;--path-color:' + COLORS[node.branch],
      onclick: () => { selected = node.id; playSfx('tab'); update(); },
    }, h('span.skill-web-icon', { 'aria-hidden': 'true' }, node.icon || skill.icon), rank, h('span.skill-web-name', name));
    world.append(button); nodes.set(node.id, { button, rank });
  }
  viewport.append(world);
  const zoomControls = h('div.skill-zoom', h('button', { type: 'button', 'aria-label': 'Zoom in', onclick: () => zoomAt(zoom * 1.2) }, '+'),
    h('button', { type: 'button', 'aria-label': 'Zoom out', onclick: () => zoomAt(zoom / 1.2) }, '−'),
    h('button', { type: 'button', 'aria-label': 'Center skill tree', onclick: () => centerOn(WORLD.centerX, WORLD.centerY) }, '◎'));
  viewport.append(zoomControls);
  const detailBranch = h('small.skill-detail-branch'), detailIcon = h('span.skill-detail-icon'), detailName = h('h4'), detailRank = h('span.skill-detail-rank');
  const detailDesc = h('p'), detailNext = h('div.skill-detail-next'), detailReq = h('small.skill-detail-req');
  const buy = h('button.btn.pri.skill-buy', { type: 'button', onclick: () => { if (buySkill(selected)) { playSfx('buy'); update(); } else playSfx('deny'); } }, 'UNLOCK · 1 POINT');
  const detail = h('section.skill-detail', { 'aria-live': 'polite' }, detailBranch,
    h('div.skill-detail-head', detailIcon, h('div', detailName, detailRank)), detailDesc, detailNext, detailReq, buy);
  root.append(summary, nav, viewport, detail);

  function clampPan() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    panX = bounded(panX, Math.min(40, w - WORLD.width * zoom - 40), 40);
    panY = bounded(panY, Math.min(40, h - WORLD.height * zoom - 40), 40);
  }
  function place() { clampPan(); world.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + zoom + ')'; }
  function centerOn(x, y) {
    panX = viewport.clientWidth / 2 - x * zoom; panY = viewport.clientHeight / 2 - y * zoom;
    initialized = true; place();
  }
  function zoomAt(next, clientX, clientY) {
    const rect = viewport.getBoundingClientRect(), anchorX = clientX == null ? rect.width / 2 : clientX - rect.left, anchorY = clientY == null ? rect.height / 2 : clientY - rect.top;
    const worldX = (anchorX - panX) / zoom, worldY = (anchorY - panY) / zoom;
    zoom = bounded(next, 0.55, 1.45);
    panX = anchorX - worldX * zoom; panY = anchorY - worldY * zoom; place();
  }
  const move = event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) { drag.moved = true; suppressClick = true; viewport.classList.add('dragging'); }
    if (drag.moved) { panX = drag.panX + event.clientX - drag.x; panY = drag.panY + event.clientY - drag.y; place(); }
  };
  const end = event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null; viewport.classList.remove('dragging');
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
    setTimeout(() => { suppressClick = false; }, 0);
  };
  viewport.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX, panY, moved: false };
    suppressClick = false;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  });
  viewport.addEventListener('click', event => { if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; } }, true);
  viewport.addEventListener('wheel', event => { event.preventDefault(); zoomAt(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX, event.clientY); }, { passive: false });
  viewport.addEventListener('keydown', event => {
    if (event.target !== viewport) return;
    const delta = 55;
    if (event.key === 'ArrowLeft') panX += delta;
    else if (event.key === 'ArrowRight') panX -= delta;
    else if (event.key === 'ArrowUp') panY += delta;
    else if (event.key === 'ArrowDown') panY -= delta;
    else if (event.key === '+' || event.key === '=') zoomAt(zoom * 1.2);
    else if (event.key === '-') zoomAt(zoom / 1.2);
    else if (event.key === '0') centerOn(WORLD.centerX, WORLD.centerY);
    else return;
    event.preventDefault(); place();
  });
  const resize = new ResizeObserver(() => { if (!initialized) centerOn(WORLD.centerX, WORLD.centerY); else place(); });
  resize.observe(viewport);

  function update() {
    const level = xpProgress(G.state.run.xp || 0).level, available = skillPoints();
    setText(points, available + (available === 1 ? ' POINT AVAILABLE' : ' POINTS AVAILABLE'));
    setText(progress, 'LEVEL ' + level + ' · ' + skillPointsEarned(level) + ' EARNED · NEXT POINT AT LEVEL ' + (level % 2 ? level + 2 : level + 1));
    respec.disabled = !SKILLS.some(s => skillRank(s.id));
    const active = id => id === 'core' || skillRank(id) > 0;
    for (const { a, b, line } of links) {
      setClass(line, 'active', active(a) && active(b));
      setClass(line, 'open', active(a) || active(b));
    }
    for (const node of SKILL_NODES) {
      if (node.id === 'core') continue;
      const { button, rank } = nodes.get(node.id), skill = SKILL_BY_ID[node.id];
      const current = skill ? skillRank(node.id) : 0, status = skill ? skillStatus(node.id) : 'future';
      setText(rank, node.future ? 'SOON' : current + '/' + skill.max);
      for (const cls of ['available', 'maxed', 'locked', 'selected', 'owned']) setClass(button, cls,
        cls === 'available' ? status === 'available' : cls === 'maxed' ? status === 'maxed' : cls === 'locked' ? status === 'prerequisite' || status === 'wave' || status === 'future' : cls === 'selected' ? selected === node.id : current > 0);
      button.setAttribute('aria-pressed', String(selected === node.id));
      button.setAttribute('aria-label', node.future ? node.name + ', future branch, preview only' : skill.name + ', rank ' + current + ' of ' + skill.max + '. ' + skill.desc + ' Tap for details.');
    }
    const node = SKILL_NODE_BY_ID[selected], skill = SKILL_BY_ID[selected], branch = LABELS[node.branch];
    detail.style.setProperty('--branch', COLORS[node.branch]);
    setText(detailBranch, branch + (skill ? '  ›  TIER ' + skill.tier : '  ›  FUTURE PATH'));
    setText(detailIcon, node.icon || skill.icon); setText(detailName, (node.name || skill.name).toUpperCase());
    if (!skill) {
      setText(detailRank, 'PLANNED'); setText(detailDesc, 'This route is reserved for a future perk. Explore the connected paths now.');
      setText(detailNext, 'No effect or point cost yet'); setText(detailReq, 'Coming in a future update');
      buy.disabled = true; setText(buy, 'COMING SOON'); return;
    }
    const current = skillRank(selected), status = skillStatus(selected);
    setText(detailRank, 'LV ' + current + ' / ' + skill.max);
    setText(detailDesc, skill.desc);
    setText(detailNext, current >= skill.max ? effectText(skill, current) + ' · maximum rank' : effectText(skill, current) + '  →  ' + effectText(skill, current + 1));
    const paths = skillNeighbours(selected).filter(id => id === 'core' || SKILL_BY_ID[id]).map(id => id === 'core' ? 'Pilot Core' : SKILL_BY_ID[id].name);
    setText(detailReq, status === 'wave' ? 'Opens at Wave ' + SKILL_TIER_WAVES[skill.tier] : status === 'prerequisite' ? 'Connect from ' + paths.join(' or ') : status === 'no-points' ? 'Earn another point by gaining Ship Levels' : 'Connected path · ranks reset on Rewind');
    buy.disabled = status !== 'available';
    setText(buy, status === 'maxed' ? 'MAX RANK' : status === 'wave' ? 'OPENS AT WAVE ' + SKILL_TIER_WAVES[skill.tier] : status === 'prerequisite' ? 'CONNECT AN ADJACENT NODE' : status === 'no-points' ? 'NO POINTS AVAILABLE' : 'UNLOCK · 1 POINT');
  }
  update();
  return { el: root, title: 'Skill Tree', update, onOpen() { if (!initialized) requestAnimationFrame(() => centerOn(WORLD.centerX, WORLD.centerY)); }, destroy() { resize.disconnect(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); } };
}
