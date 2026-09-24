// Ship banners: cosmetic cloth banners that stream from the ship's tail (see rendering/banner.js). They are unlocked by
// earning medals, setting high scores and a few long-haul feats, and are chosen in the Ships tab next to paint jobs.
// shape: how the cloth is cut (flag, pennant, swallowtail, streamer). pattern + colors: the design (rendering/bannerArt.js).
// req: { medals } medals earned, { score } best sortie score, or { stat, n, label } a lifetime stat.
// Legendary banners (rarity: 'legendary') are stat trackers: live names a lifetime stat the banner displays and keeps up
// to date as it changes; label is printed above the number; emblem and colors [cloth, accent, digits] set the look.
import { MEDAL_COUNT } from '@last-orbit/data/achievements.js';

export const BANNERS = [
  { id: 'none', name: 'None', desc: 'A clean tail.' },
  { id: 'signal', name: 'Signal Pennant', shape: 'pennant', pattern: 'bands', colors: ['#5ee6ff', '#e9fbff'], req: { medals: 3 } },
  { id: 'checker', name: 'Chequered', shape: 'flag', pattern: 'checker', colors: ['#f4f7ff', '#151a2c'], req: { medals: 10 } },
  { id: 'ember', name: 'Ember Streamer', shape: 'streamer', pattern: 'gradient', colors: ['#ffd166', '#ff5a1f', '#a3121f'], req: { score: 50000 } },
  { id: 'sunrise', name: 'Sunrise', shape: 'pennant', pattern: 'stripes', colors: ['#ff9ec7', '#ffb86b'], req: { stat: 'bestStreak', n: 14, label: '14-day daily streak' } },
  { id: 'hazard', name: 'Hazard Tape', shape: 'flag', pattern: 'diagonal', colors: ['#ffd400', '#16161a'], req: { medals: 20 } },
  { id: 'jolly', name: 'Jolly Roger', shape: 'flag', pattern: 'emblem', emblem: 'skull', colors: ['#0e0f16', '#f2f2f2'], req: { stat: 'bossKills', n: 100, label: 'Defeat 100 bosses' } },
  { id: 'royal', name: 'Royal Standard', shape: 'swallow', pattern: 'emblem', emblem: 'star', colors: ['#5b2a9e', '#ffc857'], req: { medals: 32 } },
  { id: 'comet', name: 'Comet Tail', shape: 'streamer', pattern: 'gradient', colors: ['#ffffff', '#7ae8ff', '#3a4bff'], req: { score: 250000 } },
  { id: 'void', name: 'Void Banner', shape: 'swallow', pattern: 'stars', colors: ['#120b2e', '#b69cff'], req: { medals: 45 } },
  { id: 'laurel', name: "Victor's Laurel", shape: 'swallow', pattern: 'emblem', emblem: 'laurel', colors: ['#7a560f', '#ffe08a'], req: { score: 750000 } },
  { id: 'aurora', name: 'Aurora', shape: 'streamer', pattern: 'rainbow', colors: ['#ffffff'], req: { medals: MEDAL_COUNT } }, // every medal
  // ---- legendary stat trackers
  { id: 'tally', name: 'Kill Counter', rarity: 'legendary', shape: 'flag', pattern: 'tally', emblem: 'skull', label: 'KILLS', tracks: 'lifetime kills', live: 'kills', colors: ['#0b0d14', '#ff8a3d', '#ffd8b0'], req: { stat: 'kills', n: 25000, label: '25,000 kills' } },
  { id: 't_boss', name: 'Headsman', rarity: 'legendary', shape: 'swallow', pattern: 'tally', emblem: 'crown', label: 'BOSSES', tracks: 'boss kills', live: 'bossKills', colors: ['#1a0710', '#ff4d7a', '#ffd1dc'], req: { stat: 'bossKills', n: 75, label: '75 boss kills' } },
  { id: 't_wave', name: 'Deep Record', rarity: 'legendary', shape: 'flag', pattern: 'tally', emblem: 'chevron', label: 'BEST WAVE', tracks: 'your best wave', live: 'bestWave', colors: ['#04121c', '#5ee6ff', '#dffaff'], req: { stat: 'bestWave', n: 61, label: 'Clear sector 6' } },
  { id: 't_score', name: 'Scoreboard', rarity: 'legendary', shape: 'flag', pattern: 'tally', emblem: 'star', label: 'HIGH SCORE', tracks: 'your high score', live: 'bestScore', colors: ['#141004', '#ffc857', '#fff2c2'], req: { score: 500000 } },
  { id: 't_salvage', name: 'Treasure Log', rarity: 'legendary', shape: 'swallow', pattern: 'tally', emblem: 'hex', label: 'SALVAGE', tracks: 'salvage earned', live: 'totalSalvage', colors: ['#0f0c04', '#e8a33c', '#ffe6a6'], req: { stat: 'totalSalvage', n: 250000, label: '250,000 salvage earned' } },
  { id: 't_flawless', name: 'Ghost Ledger', rarity: 'legendary', shape: 'flag', pattern: 'tally', emblem: 'shield', label: 'FLAWLESS', tracks: 'flawless waves', live: 'flawless', colors: ['#06140e', '#6dffc8', '#d9fff0'], req: { stat: 'flawless', n: 500, label: '500 flawless waves' } },
  { id: 't_stars', name: 'Star Map', rarity: 'legendary', shape: 'swallow', pattern: 'tally', emblem: 'star', label: 'STARS', tracks: 'Counterattack stars', live: 'counterStars', colors: ['#0a0c22', '#6dffc8', '#e0fff4'], req: { stat: 'counterStars', n: 18, label: '18 Counterattack stars' } },
  { id: 't_sorties', name: "Veteran's Log", rarity: 'legendary', shape: 'swallow', pattern: 'tally', emblem: 'wings', label: 'SORTIES', tracks: 'sorties flown', live: 'sorties', colors: ['#0d0a1c', '#b69cff', '#ece4ff'], req: { stat: 'sorties', n: 150, label: '150 sorties flown' } },
];
export const BANNER_BY_ID = Object.fromEntries(BANNERS.map((b) => [b.id, b]));
/** Short unlock requirement, e.g. '10 medals' or 'Score 50,000'. */
export const bannerReqLabel = (b) => !b.req ? '' : b.req.medals ? `${b.req.medals} medals` : b.req.score ? `Score ${b.req.score.toLocaleString('en-GB')}` : b.req.label;
