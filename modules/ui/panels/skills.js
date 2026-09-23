// Compact radial skill map. Selecting a node inspects it; the separate action spends a point.
import { G } from '@last-orbit/core/game.js';
import { xpProgress } from '@last-orbit/data/experience.js';
import { SKILLS, SKILL_BY_ID, SKILL_TIER_WAVES, skillPointsEarned } from '@last-orbit/data/skills.js';
import { skillPoints, skillRank, skillStatus, buySkill, respecSkills } from '@last-orbit/progression/skills.js';
import { h, setText, setClass } from '@last-orbit/ui/dom.js';
import { playSfx } from '@last-orbit/audio/audio.js';

const BRANCHES = [
  { id: 'weapons', title: 'WEAPONS', hint: 'Deal more damage', skills: ['calibration', 'rapid', 'precision', 'execution'] },
  { id: 'defence', title: 'DEFENCE', hint: 'Stay in the fight', skills: ['plating', 'repair', 'barrier', 'siphon'] },
  { id: 'salvage', title: 'SALVAGE', hint: 'Harvest more', skills: ['salvage', 'scavenger'] },
  { id: 'mobility', title: 'MOBILITY', hint: 'Move and react', skills: ['momentum', 'tactician'] },
];
const COLORS = { weapons: '#ff7778', defence: '#69e6af', salvage: '#ffd36d', mobility: '#eb83d3' };
const EFFECT_NAMES = { damage: 'Weapon damage', fireRate: 'Fire rate', critChance: 'Crit chance', bossDmg: 'Boss damage', hull: 'Hull', hullRegen: 'Hull regen / s', shieldRatio: 'Shield / hull', lifeSteal: 'Lifesteal', creditGain: 'Credits', scrapGain: 'Scrap', moveSpeed: 'Move speed', abilityCd: 'Ability cooldown' };
const effectText = (skill, rank) => {
  const [stat, , perRank] = skill.fx[0];
  const amount = Math.round(perRank * rank * 1000) / 10;
  return EFFECT_NAMES[stat] + ' ' + (amount > 0 ? '+' : '') + amount + '%';
};

export function skillsPanel() {
  let selected = 'calibration';
  const root = h('div.skills-root');
  const points = h('b.skills-points'), progress = h('small.skills-progress');
  const respec = h('button.btn.sm', { type: 'button', onclick: () => { if (respecSkills()) { playSfx('tab'); update(); } } }, 'Reset');
  const summary = h('div.skills-summary', h('div', h('small', 'SHIP PROFICIENCY'), points, progress), respec);
  const map = h('div.skill-map', { role: 'group', 'aria-label': 'Ship skill tree' });
  const core = h('div.skill-core', { 'aria-hidden': 'true' }, h('span.skill-ship'), h('b', 'PILOT CORE'), h('small', 'ALL PATHS LEAD OUTWARD'));
  map.append(h('div.skill-orbit', { 'aria-hidden': 'true' }), core);
  const nodes = new Map();
  for (const branch of BRANCHES) {
    const group = h('section.skill-cluster.' + branch.id, { style: '--branch:' + COLORS[branch.id] },
      h('div.skill-cluster-label', h('b', branch.title), h('small', branch.hint)));
    const grid = h('div.skill-cluster-grid');
    branch.skills.forEach((id) => {
      const skill = SKILL_BY_ID[id], rank = h('small.skill-node-rank');
      const button = h('button.skill-node', { type: 'button', title: skill.name, onclick: () => { selected = id; playSfx('tab'); update(); } },
        h('span.skill-glyph', { 'aria-hidden': 'true' }, skill.icon), rank);
      grid.append(button); nodes.set(id, { button, rank });
    });
    group.append(grid); map.append(group);
  }
  const detailBranch = h('small.skill-detail-branch'), detailIcon = h('span.skill-detail-icon'), detailName = h('h4'), detailRank = h('span.skill-detail-rank');
  const detailDesc = h('p'), detailNext = h('div.skill-detail-next'), detailReq = h('small.skill-detail-req');
  const buy = h('button.btn.pri.skill-buy', { type: 'button', onclick: () => { if (buySkill(selected)) { playSfx('buy'); update(); } else playSfx('deny'); } }, 'UNLOCK · 1 POINT');
  const detail = h('section.skill-detail', { 'aria-live': 'polite' }, detailBranch,
    h('div.skill-detail-head', detailIcon, h('div', detailName, detailRank)), detailDesc, detailNext, detailReq, buy);
  root.append(summary, map, detail);

  function update() {
    const level = xpProgress(G.state.run.xp || 0).level, available = skillPoints();
    setText(points, available + (available === 1 ? ' POINT AVAILABLE' : ' POINTS AVAILABLE'));
    setText(progress, 'LEVEL ' + level + ' · ' + skillPointsEarned(level) + ' EARNED · NEXT POINT AT LEVEL ' + (level % 2 ? level + 2 : level + 1));
    respec.disabled = !SKILLS.some(s => skillRank(s.id));
    for (const skill of SKILLS) {
      const { button, rank } = nodes.get(skill.id), current = skillRank(skill.id), status = skillStatus(skill.id);
      setText(rank, current + '/' + skill.max);
      for (const cls of ['available', 'maxed', 'locked', 'selected', 'owned']) setClass(button, cls,
        cls === 'available' ? status === 'available' : cls === 'maxed' ? status === 'maxed' : cls === 'locked' ? status === 'prerequisite' || status === 'wave' : cls === 'selected' ? selected === skill.id : current > 0);
      button.setAttribute('aria-pressed', String(selected === skill.id));
      button.setAttribute('aria-label', skill.name + ', rank ' + current + ' of ' + skill.max + '. ' + skill.desc + ' Tap for details.');
    }
    const skill = SKILL_BY_ID[selected], current = skillRank(selected), status = skillStatus(selected);
    const branch = BRANCHES.find(b => b.skills.includes(selected));
    detail.style.setProperty('--branch', COLORS[branch.id]);
    setText(detailBranch, branch.title + '  ›  TIER ' + skill.tier);
    setText(detailIcon, skill.icon); setText(detailName, skill.name.toUpperCase());
    setText(detailRank, 'LV ' + current + ' / ' + skill.max);
    setText(detailDesc, skill.desc);
    setText(detailNext, current >= skill.max ? effectText(skill, current) + ' · maximum rank' : effectText(skill, current) + '  →  ' + effectText(skill, current + 1));
    const req = skill.req && skillRank(skill.req[0]) < skill.req[1] ? 'Requires ' + SKILL_BY_ID[skill.req[0]].name + ' rank ' + skill.req[1] : '';
    setText(detailReq, status === 'wave' ? 'Opens at Wave ' + SKILL_TIER_WAVES[skill.tier] : req || (status === 'no-points' ? 'Earn another point by gaining Ship Levels' : 'Ranks and points reset on Rewind'));
    buy.disabled = status !== 'available';
    setText(buy, status === 'maxed' ? 'MAX RANK' : status === 'wave' ? 'OPENS AT WAVE ' + SKILL_TIER_WAVES[skill.tier] : status === 'prerequisite' ? 'PREREQUISITE REQUIRED' : status === 'no-points' ? 'NO POINTS AVAILABLE' : 'UNLOCK · 1 POINT');
  }
  update();
  return { el: root, title: 'Skill Tree', update };
}
