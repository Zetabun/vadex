import { G, recalc, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { levelFromXp } from '@last-orbit/data/experience.js';
import { SKILLS, SKILL_BY_ID, SKILL_TIER_WAVES, skillNeighbours, skillPointsEarned } from '@last-orbit/data/skills.js';

export function skillRank(id) { return Math.max(0, Math.min(SKILL_BY_ID[id]?.max || 0, Math.floor(Number(G.state?.run?.skills?.[id]) || 0))); }
export function skillPoints() {
  const spent = SKILLS.reduce((sum, skill) => sum + skillRank(skill.id), 0);
  return Math.max(0, skillPointsEarned(levelFromXp(G.state?.run?.xp || 0)) - spent);
}
export function skillStatus(id) {
  const skill = SKILL_BY_ID[id];
  if (!skill || !G.state?.unlocks?.skills) return 'locked';
  if (skillRank(id) >= skill.max) return 'maxed';
  if ((G.state.run?.best || 1) < SKILL_TIER_WAVES[skill.tier]) return 'wave';
  if (!skillNeighbours(id).some(neighbour => neighbour === 'core' || skillRank(neighbour) > 0)) return 'prerequisite';
  return skillPoints() > 0 ? 'available' : 'no-points';
}
export function buySkill(id) {
  if (skillStatus(id) !== 'available') return false;
  G.state.run.skills ||= {};
  G.state.run.skills[id] = skillRank(id) + 1;
  recalc(); bus.emit('bought', 'skill', id, {}); bus.emit('skillsChanged');
  toast(`${SKILL_BY_ID[id].name} ${G.state.run.skills[id]}/${SKILL_BY_ID[id].max}`, 'good');
  return true;
}
export function respecSkills() {
  if (!G.state?.unlocks?.skills || !SKILLS.some(skill => skillRank(skill.id))) return false;
  G.state.run.skills = {};
  recalc(); bus.emit('skillsChanged'); toast('Skill points returned for this run.', 'info');
  return true;
}
