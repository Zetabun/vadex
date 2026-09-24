// Ship banners: cosmetic cloth banners that stream from the ship's tail (see rendering/banner.js). They are unlocked by
// earning medals, setting high scores and a few long-haul feats, and are chosen in the Ships tab next to paint jobs.
// shape: how the cloth is cut (flag, pennant, swallowtail, streamer). pattern + colors: the design (rendering/bannerArt.js).
// req: { medals } medals earned, { score } best sortie score, or { stat, n, label } a lifetime stat.
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
];
export const BANNER_BY_ID = Object.fromEntries(BANNERS.map((b) => [b.id, b]));
/** Short unlock requirement, e.g. '10 medals' or 'Score 50,000'. */
export const bannerReqLabel = (b) => !b.req ? '' : b.req.medals ? `${b.req.medals} medals` : b.req.score ? `Score ${b.req.score.toLocaleString('en-GB')}` : b.req.label;
