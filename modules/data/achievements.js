// Achievements: medals for lifetime milestones (bronze, silver and gold tiers) and one-off feats (a single medal for
// a specific deed in one sortie). Every medal pays pilot XP. They sit alongside contracts, which unlock gear.
// get(state) → the value the medal tracks; goals: one per tier (a feat has one goal). art: key into ui/art.js.
import { PAINTS } from '@last-orbit/data/career.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { SHIPS } from '@last-orbit/data/ships.js';

export const TIERS = [
  { id: 'bronze', name: 'Bronze', xp: 100 },
  { id: 'silver', name: 'Silver', xp: 250 },
  { id: 'gold', name: 'Gold', xp: 600 },
];
export const FEAT_XP = 400;
const S = (k) => (st) => Number(st.stats[k]) || 0;
const masteryLevels = (st) => Object.values(st.mastery || {}).reduce((n, m) => n + (m.level || 1), 0);
const workshopLevels = (st) => Object.values(st.workshop || {}).reduce((n, l) => n + (l || 0), 0);
const WORKSHOP_MAX = WORKSHOP.reduce((n, u) => n + u.max, 0);

export const ACHIEVEMENTS = [
  { id: 'a_kills', name: 'Exterminator', desc: 'Destroy {n} invaders', get: S('kills'), goals: [500, 5000, 50000], art: 'weapon:cannon' },
  { id: 'a_wave', name: 'Deep Space', desc: 'Reach wave {n}', get: S('bestWave'), goals: [10, 30, 60], art: 'ach:flag' },
  { id: 'a_score', name: 'High Roller', desc: 'Score {n} in one sortie', get: S('bestScore'), goals: [25000, 150000, 500000], art: 'ach:star' },
  { id: 'a_boss', name: 'Boss Hunter', desc: 'Defeat {n} bosses or mini-bosses', get: S('bossKills'), goals: [5, 25, 100], art: 'relic:r_giant' },
  { id: 'a_elite', name: 'Elite Slayer', desc: 'Destroy {n} elites', get: S('eliteKills'), goals: [25, 250, 2500], art: 'relic:r_crit' },
  { id: 'a_waves', name: 'Wave Breaker', desc: 'Clear {n} waves', get: S('wavesCleared'), goals: [50, 500, 2500], art: 'mod:m_blast' },
  { id: 'a_flawless', name: 'Untouchable', desc: 'Clear {n} waves without taking damage', get: S('flawless'), goals: [25, 150, 750], art: 'mod:m_shield' },
  { id: 'a_graze', name: 'Close Shave', desc: 'Graze {n} enemy shots while steering', get: S('grazes'), goals: [100, 1000, 10000], art: 'mod:m_speed' },
  { id: 'a_sorties', name: 'Veteran', desc: 'Fly {n} sorties', get: S('sorties'), goals: [10, 50, 200], art: 'ship:vanguard' },
  { id: 'a_salvage', name: 'Tycoon', desc: 'Earn {n} salvage in total', get: S('totalSalvage'), goals: [5000, 50000, 500000], art: 'cur:salvage' },
  { id: 'a_cards', name: 'Card Shark', desc: 'Pick {n} upgrade cards', get: S('cards'), goals: [100, 750, 3000], art: 'ws:w_choice' },
  { id: 'a_ability', name: 'Trigger Happy', desc: 'Use abilities {n} times', get: S('abilitiesUsed'), goals: [50, 500, 5000], art: 'ability:overdrive' },
  { id: 'a_daily', name: 'Daily Grind', desc: 'Fly {n} Daily Sorties', get: S('dailies'), goals: [3, 15, 50], art: 'ach:calendar' },
  { id: 'a_streak', name: 'On Fire', desc: 'Keep a {n}-day daily streak', get: S('bestStreak'), goals: [3, 7, 30], art: 'ach:flame' },
  { id: 'a_threat', name: 'Danger Zone', desc: 'Defeat the wave 40 boss at Threat {n}', get: S('threatClear'), goals: [2, 5, 10], art: 'ws:w_revive', roman: true },
  { id: 'a_rank', name: 'Career Pilot', desc: 'Reach pilot rank {n}', get: (st) => st.pilot?.rank || 1, goals: [10, 25, 40], art: 'ws:w_start' },
  { id: 'a_mastery', name: 'Fleet Veteran', desc: 'Earn {n} ship mastery levels in total', get: masteryLevels, goals: [10, 25, SHIPS.length * 10], art: 'ship:bulwark' },
  { id: 'a_workshop', name: 'Engineer', desc: 'Buy {n} Workshop levels', get: workshopLevels, goals: [15, 60, WORKSHOP_MAX], art: 'ach:wrench' },
  { id: 'a_paint', name: 'Fashionista', desc: 'Own {n} paint jobs', get: (st) => Object.keys(st.paints || {}).length, goals: [5, 12, PAINTS.length], art: 'ach:brush' },
];
export const FEATS = [
  { id: 'f_cleanboss', name: 'Clean Kill', desc: 'Clear a sector boss wave without taking damage', get: S('flawlessBosses'), goal: 1, art: 'mod:m_boss' },
  { id: 'f_perfect', name: 'Perfect Sector', desc: 'Clear all ten waves of a sector without taking damage', get: S('perfectSectors'), goal: 1, art: 'relic:r_aegis' },
  { id: 'f_solo', name: 'Lone Gun', desc: 'Reach wave 20 carrying a single weapon', get: S('soloWave'), goal: 20, art: 'mod:m_aim' },
  { id: 'f_arms', name: 'Arms Race', desc: 'Fully evolve three weapons in one sortie', get: S('maxedWeapons'), goal: 3, art: 'weapon:prism' },
  { id: 'f_relics', name: 'Hoarder', desc: 'Hold five relics in one sortie', get: S('maxRelics'), goal: 5, art: 'relic:r_midas' },
  { id: 'f_daily30', name: 'Daily Champion', desc: 'Reach wave 30 on a Daily Sortie', get: (st) => st.daily?.best || 0, goal: 30, art: 'ach:calendar' },
  { id: 'f_fleet', name: 'Old Hands', desc: 'Reach mastery 5 with all five ships', get: (st) => Math.min(...SHIPS.map((s) => st.mastery?.[s.id]?.level || 0)), goal: 5, art: 'ship:revenant' },
  { id: 'f_fusion', name: 'Fusion Reactor', desc: 'Fuse two fully evolved weapons', get: S('fusions'), goal: 1, art: 'weapon:plasma' },
  { id: 'f_signature', name: 'Signature Move', desc: 'Unleash a ship\u2019s signature evolution', get: S('signatures'), goal: 1, art: 'ship:vanguard' },
  { id: 'f_counter', name: 'Counterattack', desc: 'Clear a Counterattack stage', get: S('counterBest'), goal: 1, art: 'ship:striker' },
  { id: 'f_homerun', name: 'Home Invasion', desc: 'Clear Counterattack stage 6', get: S('counterBest'), goal: 6, art: 'ach:trophy' },
  { id: 'f_fame', name: 'Hall of Fame', desc: 'Score 750,000 in one sortie', get: S('bestScore'), goal: 750000, art: 'ach:trophy' },
];
export const MEDAL_COUNT = ACHIEVEMENTS.length * TIERS.length + FEATS.length;
