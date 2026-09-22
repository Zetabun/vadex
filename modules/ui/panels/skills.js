// Run skill tree, funded by Ship Levels rather than another currency.
import { G } from '@last-orbit/core/game.js';
import { xpProgress } from '@last-orbit/data/experience.js';
import { SKILLS, skillPointsEarned } from '@last-orbit/data/skills.js';
import { skillPoints, skillRank, skillStatus, buySkill, respecSkills } from '@last-orbit/progression/skills.js';
import { h, setText, setClass } from '@last-orbit/ui/dom.js';
import { playSfx } from '@last-orbit/audio/audio.js';

export function skillsPanel() {
  const root = h('div.skills-root');
  const points = h('b.skills-points'), progress = h('p.note');
  const respec = h('button.btn.sm', { type: 'button', onclick: () => { if (respecSkills()) { playSfx('tab'); update(); } } }, 'Reset skills');
  root.append(h('div.skills-summary', h('div', h('small', 'SHIP PROFICIENCY'), points), respec), progress);
  const records = [];
  for (const branch of ['Offence', 'Defence', 'Utility']) {
    const section = h('section.skill-branch', h('h4', branch));
    for (const skill of SKILLS.filter(s => s.branch === branch)) {
      const rank = h('span.skill-rank'), req = h('small.skill-req');
      const button = h('button.skill-node', { type: 'button', onclick: () => { if (buySkill(skill.id)) { playSfx('buy'); update(); } else playSfx('deny'); } },
        h('span.skill-glyph', { 'aria-hidden': 'true' }, skill.icon), h('span.skill-copy', h('b', skill.name), h('span', skill.desc), req), rank);
      section.append(button); records.push({ skill, button, rank, req });
    }
    root.append(section);
  }
  function update() {
    const level = xpProgress(G.state.run.xp || 0).level, available = skillPoints();
    setText(points, `${available} ${available === 1 ? 'point' : 'points'} available`);
    setText(progress, `Level ${level} · ${skillPointsEarned(level)} earned this run. Gain 1 point at levels 3, 5, 7 and every two levels after. Skills reset on Rewind.`);
    respec.disabled = !SKILLS.some(s => skillRank(s.id));
    for (const { skill, button, rank, req } of records) {
      const status = skillStatus(skill.id), current = skillRank(skill.id);
      setText(rank, `${current}/${skill.max}`);
      setText(req, skill.req ? `Requires ${SKILLS.find(s => s.id === skill.req[0]).name} rank ${skill.req[1]}` : 'Entry perk');
      setClass(button, 'available', status === 'available');
      setClass(button, 'maxed', status === 'maxed');
      setClass(button, 'locked', status === 'prerequisite');
      button.disabled = status !== 'available';
      button.setAttribute('aria-label', `${skill.name}, rank ${current} of ${skill.max}. ${skill.desc} ${skill.req ? req.textContent : ''} ${status === 'available' ? 'Spend one Skill Point.' : ''}`);
    }
  }
  update();
  return { el: root, title: 'Skill Tree', update };
}
