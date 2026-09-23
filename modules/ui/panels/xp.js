// Ship level overview. Future reward tiles are clearly marked as previews;
// current progression only grants proficiency and skill points.
import { G } from '@last-orbit/core/game.js';
import { fmt } from '@last-orbit/core/format.js';
import { xpForLevel, xpProgress, levelBonuses } from '@last-orbit/data/experience.js';
import { skillPoints } from '@last-orbit/progression/skills.js';
import { h, clear } from '@last-orbit/ui/dom.js';

const previewNames = ['Ship paint', 'Pilot banner', 'Thruster trail', 'Cockpit badge'];

export function xpPanel() {
  const root = h('div.xp-page');
  let signature = '';
  function update(force = false) {
    const progress = xpProgress(G.state.run.xp || 0);
    const sig = [progress.level, progress.current, progress.needed, skillPoints(), G.state.unlocks.skills].join('|');
    if (!force && sig === signature) return;
    signature = sig;
    clear(root);
    const bonuses = levelBonuses(progress.level);
    root.append(h('section.xp-hero', h('small', 'PILOT PROGRESSION'), h('div.xp-hero-main', h('b', `LEVEL ${progress.level}`), h('span', `${fmt(progress.current)} / ${fmt(progress.needed)} XP`)),
      h('div.xp-track', { role: 'progressbar', 'aria-label': 'XP toward next ship level', 'aria-valuenow': Math.floor(progress.current), 'aria-valuemax': Math.ceil(progress.needed) }, h('i', { style: `width:${(progress.fraction * 100).toFixed(1)}%` })),
      h('p', `${fmt(progress.to - progress.xp)} XP to Level ${progress.level + 1}. Destroy enemies and clear waves to advance.`)));
    root.append(h('div.xp-benefits', h('div', h('small', 'CURRENT PROFICIENCY'), h('b', `+${fmt((bonuses.damage - 1) * 100, 1)}% damage`), h('span', `+${fmt((bonuses.hull - 1) * 100, 1)}% hull`)),
      h('div', h('small', 'SKILL TREE'), h('b', G.state.unlocks.skills ? `${skillPoints()} points available` : 'Unlocks at Wave 8'), h('span', 'One point every two levels from Level 3.'))));
    root.append(h('header.xp-milestone-heading', h('div', h('small', 'LEVEL ROADMAP'), h('h4', 'Milestones ahead')), h('span', 'PREVIEW REWARDS')));
    const start = Math.max(1, progress.level - 1), end = progress.level + 9;
    const rail = h('div.xp-milestones');
    for (let level = start; level <= end; level++) {
      const reached = level <= progress.level, point = level >= 3 && level % 2 === 1;
      const bonus = levelBonuses(level), preview = previewNames[Math.floor(level / 2) % previewNames.length];
      rail.append(h('div.xp-milestone' + (reached ? '.reached' : '') + (level === progress.level ? '.current' : ''),
        h('div.xp-milestone-level', h('small', 'LEVEL'), h('b', String(level)), h('span', reached ? '✓' : '◇')),
        h('div.xp-milestone-content', h('strong', point ? 'Skill point + proficiency' : 'Ship proficiency'),
          h('span', `+${fmt((bonus.damage - 1) * 100, 1)}% damage · +${fmt((bonus.hull - 1) * 100, 1)}% hull total`),
          h('small', `${fmt(xpForLevel(level))} total XP${point ? ' · +1 skill point' : ''}`)),
        h('div.xp-reward-preview', h('small', 'FUTURE REWARD'), h('b', preview), h('span', 'Placeholder'))));
    }
    root.append(rail, h('p.xp-disclaimer', 'Future reward tiles are previews only. Proficiency and unlocked skill points are the rewards active in this build.'));
  }
  return { el: root, title: 'Ship Level', update };
}
