// Pilot rank insignia: a badge that evolves with the pilot's title. The emblem changes with each title (chevrons,
// wings, stars, a shield, a laurel wreath) and the metal climbs from steel to bronze, silver, gold and finally a
// prismatic Legend finish. The rank number sits on a ribbon across the foot of the badge. Pure SVG, no filters.
import { TITLES } from '@last-orbit/data/career.js';

// One metal per title: [light, mid, dark, rim]
const METALS = {
  steel: ['#e6edf7', '#9aa9c2', '#56647f', '#2b3348'],
  bronze: ['#ffd9b0', '#d98f52', '#8a4f25', '#3f220e'],
  silver: ['#ffffff', '#c8d6ea', '#7d8fae', '#2e3950'],
  gold: ['#fff4c2', '#ffc857', '#b87a16', '#4a2e05'],
  prism: ['#ffffff', '#ff9bff', '#6a5cff', '#1c1244'],
};
const TIER = [ // by title index in TITLES
  { metal: 'steel', emblem: 'chevron1' }, { metal: 'steel', emblem: 'chevron2' }, { metal: 'bronze', emblem: 'wings' },
  { metal: 'bronze', emblem: 'ace' }, { metal: 'silver', emblem: 'shield2' }, { metal: 'silver', emblem: 'shieldStar' },
  { metal: 'gold', emblem: 'stars3' }, { metal: 'gold', emblem: 'laurel' }, { metal: 'prism', emblem: 'legend' },
];
export const titleIndex = (rank) => { let i = 0; TITLES.forEach(([at], k) => { if (rank >= at) i = k; }); return i; };

const chev = (y) => `<path d="M16 ${y}l16 -9 16 9v6l-16 -9 -16 9z" class="e"/>`;
const star = (x, y, r) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + (x + Math.cos(a) * q).toFixed(1) + ' ' + (y + Math.sin(a) * q).toFixed(1); } return `<path d="${d}z" class="e"/>`; };
const wing = (s) => `<path d="M${32 + s * 5} 28c${s * 8}-7 ${s * 18}-9 ${s * 24}-7c${-s * 3} 3 ${-s * 6} 5 ${-s * 10} 6c${s * 3} 0 ${s * 6} 0 ${s * 8} 1c${-s * 4} 3 ${-s * 9} 5 ${-s * 15} 5c${s * 2} 1 ${s * 4} 1 ${s * 6} 1c${-s * 5} 3 ${-s * 10} 3 ${-s * 13} 1z" class="e"/>`;
const leaf = (x, y, r, s) => `<ellipse cx="${x}" cy="${y}" rx="4.2" ry="1.9" transform="rotate(${r} ${x} ${y})" class="e"/>`;
const laurel = () => [0, 1, 2, 3, 4].map((i) => [leaf(15 + i * 1.2, 40 - i * 5.5, -60 + i * 12), leaf(49 - i * 1.2, 40 - i * 5.5, 60 - i * 12)].join('')).join('');
const EMBLEMS = {
  chevron1: () => chev(30),
  chevron2: () => chev(24) + chev(35),
  wings: () => wing(1) + wing(-1) + `<circle cx="32" cy="29" r="5" class="e"/>`,
  ace: () => wing(1) + wing(-1) + star(32, 28, 8),
  shield2: () => `<path d="M32 12l13 5v10c0 9-6 15-13 19-7-4-13-10-13-19V17z" class="e"/><path d="M24 25l8-4 8 4v3l-8-4-8 4zM24 32l8-4 8 4v3l-8-4-8 4z" class="k"/>`,
  shieldStar: () => `<path d="M32 12l13 5v10c0 9-6 15-13 19-7-4-13-10-13-19V17z" class="e"/>` + star(32, 28, 7).replace('class="e"', 'class="k"'),
  stars3: () => star(32, 20, 7) + star(21, 33, 6) + star(43, 33, 6),
  laurel: () => laurel() + star(32, 28, 9),
  legend: () => laurel() + star(32, 27, 10) + `<circle cx="32" cy="27" r="3" class="k"/>`,
};

let uid = 0;
/** SVG markup for a rank's insignia. */
export function insigniaSvg(rank) {
  const t = TIER[Math.min(TIER.length - 1, titleIndex(rank))], [lt, md, dk, rim] = METALS[t.metal], id = 'ins' + ++uid;
  const prism = t.metal === 'prism';
  const fill = prism ? `url(#${id}p)` : `url(#${id}m)`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
<defs>
  <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lt}"/><stop offset=".5" stop-color="${md}"/><stop offset="1" stop-color="${dk}"/></linearGradient>
  <linearGradient id="${id}p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd166"/><stop offset=".3" stop-color="#ff5fa2"/><stop offset=".6" stop-color="#c77dff"/><stop offset="1" stop-color="#5ee6ff"/></linearGradient>
  <radialGradient id="${id}b" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${prism ? '#3a2470' : '#1f2a52'}"/><stop offset="1" stop-color="#0a0f26"/></radialGradient>
</defs>
<path d="M32 2l26 10v20c0 15-11 25-26 30C17 57 6 47 6 32V12z" fill="url(#${id}b)" stroke="${fill}" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M32 7l21 8v17c0 12-9 20-21 24-12-4-21-12-21-24V15z" fill="none" stroke="${rim}" stroke-width="1.2" opacity=".8"/>
<g fill="${fill}" stroke="${rim}" stroke-width="1" stroke-linejoin="round" class="emb">${EMBLEMS[t.emblem]().replace(/class="k"/g, `fill="${rim}" stroke="none"`).replace(/class="e"/g, '')}</g>
<path d="M9 42h46l-3.5 6.5 3.5 6.5H9l3.5-6.5z" fill="${fill}" stroke="${rim}" stroke-width="1.3" stroke-linejoin="round"/>
<text x="32" y="53.2" text-anchor="middle" font-family="Chakra Petch, sans-serif" font-weight="700" font-size="14" fill="${rim}">${rank}</text>
</svg>`;
}
/** A span holding the insignia, sized by CSS. */
export function insignia(rank, className = '') {
  const el = document.createElement('span');
  el.className = 'insignia' + (className ? ' ' + className : '') + (titleIndex(rank) >= TIER.length - 1 ? ' legend' : '');
  el.innerHTML = insigniaSvg(rank); el.title = 'Rank ' + rank;
  return el;
}
