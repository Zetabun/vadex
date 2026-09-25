// The orbital station as a blueprint: a schematic of the same layout the 3D model uses (data/station.js). Built modules
// are filled, maxed ones glow, unbuilt ones are dashed outlines; the core piece the next Overhaul adds is marked in gold.
import { STATION_MODULES, STATION_CORE, coreBuilt } from '@last-orbit/data/station.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
const MAX = Object.fromEntries(WORKSHOP.map((u) => [u.id, u.max]));

// Module outlines in station units, centred on the module's slot (front view, y up).
function shapeOf(m, s) {
  const up = m.y >= 0 ? 1 : -1, R = (x, y, w, h) => `<rect x="${x - w / 2}" y="${-(y + h / 2)}" width="${w}" height="${h}" rx="0.25"/>`, C = (x, y, r) => `<circle cx="${x}" cy="${-y}" r="${r}"/>`;
  switch (s) {
    case 'battery': return R(0, 0, 2.4, 1.2) + R(-0.5, 1.1 * up, 0.35, 1.2) + R(0.5, 1.1 * up, 0.35, 1.2);
    case 'drum': return C(0, 0, 0.95) + C(0, 0, 0.45);
    case 'dish': return `<path d="M-1.4 ${-0.2 * up}Q0 ${-1.4 * up} 1.4 ${-0.2 * up}Z"/>` + C(0, 1 * up, 0.25);
    case 'sensor': return R(0, 0, 1.4, 1) + R(0.4, -1.3, 0.12, 1.4) + C(0.4, -2, 0.22);
    case 'thruster': return R(-0.5, 0, 1.4, 1.6) + `<path d="M0.3 -0.8L1.9 -1.1L1.9 1.1L0.3 0.8Z"/>`;
    case 'plates': return R(0, 0.45, 2.6, 0.36) + R(0, 0, 2.6, 0.36) + R(0, -0.45, 2.6, 0.36);
    case 'bay': return R(0, 0, 2.2, 1.6) + R(0, 0, 0.9, 0.24) + R(0, 0, 0.24, 0.9);
    case 'cargo': return R(-0.6, -0.4, 1.1, 0.8) + R(0.6, -0.4, 1.1, 0.8) + R(0, 0.45, 1.1, 0.8);
    case 'bunker': return R(0, 0, 2.6, 1.2) + R(0, 0.75 * up, 1.8, 0.4);
    case 'tractor': return C(0, 0, 1.3) + C(0, 0, 0.45);
    case 'hangar': return R(0, 0, 3.2, 1.8) + R(0, -0.1, 2.2, 1.2);
    case 'hab': return R(0, 0, 3.4, 1.6) + C(-1, 0, 0.2) + C(0, 0, 0.2) + C(1, 0, 0.2);
    case 'comms': return R(0, -0.6, 0.12, 1.4) + `<path d="M-0.9 -0.1Q0 -1 0.9 -0.4Z"/>`;
    case 'briefing': return C(0, 0, 1.2);
    case 'beacon': return R(0, 0, 0.2, 2.4) + C(0, -1.3, 0.35);
  }
  return '';
}
const CORE = {
  deck: '<path d="M-1.6 -3.2A1.6 1.4 0 0 1 1.6 -3.2Z"/>',
  ring: '<ellipse cx="0" cy="-0.6" rx="4.4" ry="1.3"/>',
  spire: '<path d="M0 -10V-15.3"/><circle cx="0" cy="-11" r="0.5"/><circle cx="0" cy="-15.4" r="0.3"/>',
  solar: '<rect x="-22.5" y="-3.1" width="6" height="2.8"/><rect x="-22.5" y="0.3" width="6" height="2.8"/><rect x="16.5" y="-3.1" width="6" height="2.8"/><rect x="16.5" y="0.3" width="6" height="2.8"/><path d="M-16.5 0H-13.6M13.6 0H16.5"/>',
  ring2: '<ellipse cx="0" cy="0.4" rx="7.6" ry="2.1"/>',
  dome: '<circle cx="0" cy="10.8" r="1.5"/>',
  yard: '<rect x="-6.7" y="4.6" width="5" height="2.8"/><path d="M-5.6 6H-2.8L-3.4 5.6M-2.8 6L-3.4 6.4"/>',
  beacons: '<circle cx="-13.6" cy="-0.6" r="0.4"/><circle cx="13.6" cy="-0.6" r="0.4"/><circle cx="0" cy="-9.9" r="0.4"/><circle cx="0" cy="9" r="0.4"/>',
  halo: '<ellipse cx="0" cy="0" rx="11.5" ry="2.9"/>',
  crown: '<path d="M0 -18.6L1.1 -17L0 -15.4L-1.1 -17Z"/>',
};

// How far each core piece reaches (x0, y0, x1, y1 in SVG coordinates, y down), so the blueprint can fit itself.
const REACH = { spire: [-1, -15.8, 1, 0], crown: [-1.2, -18.8, 1.2, 0], solar: [-22.6, -3.2, 22.6, 3.2], halo: [-11.7, -3, 11.7, 3], dome: [-1.6, 0, 1.6, 12.4], ring2: [-7.8, -2, 7.8, 2.6] };
const BASE = [-15.4, -10.6, 15.4, 10.2];
const fmt = (n) => +n.toFixed(2);

/** SVG markup for the pilot's station, as a technical blueprint that fits the frame to what is drawn.
 *  rank: Overhaul rank; workshop: levels by id; peak: highest levels ever (modules stay built); next: mark the next piece;
 *  name, pct: for the title block. */
export function stationBlueprint(rank, workshop, { next = true, peak = {}, name = '', pct = null } = {}) {
  const parts = [], box = [...BASE];
  const grow = (r) => { box[0] = Math.min(box[0], r[0]); box[1] = Math.min(box[1], r[1]); box[2] = Math.max(box[2], r[2]); box[3] = Math.max(box[3], r[3]); };
  // trusses, the hub and its windows
  parts.push(`<g class="sb-core"><path d="M-13.6 0H13.6M0 -9.8V9.2"/><rect x="-1.8" y="-3" width="3.6" height="6" rx="0.6"/><path class="sb-fine" d="M-1.2 -1.6H1.2M-1.2 0H1.2M-1.2 1.6H1.2"/></g>`);
  for (const c of STATION_CORE) {
    if (!CORE[c.id]) continue;
    const built = coreBuilt(c.id, rank), soon = next && c.at === rank + 1;
    if (built || soon) { parts.push(`<g class="${built ? 'sb-core' : 'sb-next'}">${CORE[c.id]}</g>`); if (REACH[c.id]) grow(REACH[c.id]); }
  }
  for (const m of STATION_MODULES) {
    const lvl = workshop[m.id] || 0, st = Math.max(lvl, peak[m.id] || 0) <= 0 ? 'ghost' : lvl >= MAX[m.id] ? 'lit' : 'built';
    parts.push(`<g class="sb-mod ${st}" transform="translate(${m.x} ${-m.y})">${shapeOf(m, m.shape)}</g>`);
  }
  // the sheet: fit a 4:3 frame round the drawing, with room for the tag (top left) and the title block (bottom right)
  let [x0, y0, x1, y1] = [box[0] - 2.2, box[1] - 4.2, box[2] + 2.2, box[3] + 3.4], w = x1 - x0, h = y1 - y0;
  if (w / h < 4 / 3) { const nw = h * 4 / 3; x0 -= (nw - w) / 2; w = nw; } else { const nh = w * 3 / 4; y0 -= (nh - h) / 2; h = nh; }
  x1 = x0 + w; y1 = y0 + h; const u = w / 48; // one 'unit' of sheet furniture, scaled with the frame
  const ticks = []; for (let x = Math.ceil(x0 / 2) * 2; x < x1; x += 2) ticks.push(`M${x} ${fmt(y0)}v${fmt(x % 10 ? u * 0.5 : u)}`); for (let y = Math.ceil(y0 / 2) * 2; y < y1; y += 2) ticks.push(`M${fmt(x0)} ${y}h${fmt(y % 10 ? u * 0.5 : u)}`);
  const c = u * 2.2, corners = [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].map(([x, y, sx, sy]) => `M${fmt(x + sx * 0.6 * u)} ${fmt(y + sy * (0.6 * u + c))}v${fmt(-sy * c)}h${fmt(sx * c)}`).join('');
  const tbW = u * 15, tbH = u * 3.4, tbX = x1 - tbW - u * 0.9, tbY = y1 - tbH - u * 0.9;
  const title = `<g class="sb-title"><rect x="${fmt(tbX)}" y="${fmt(tbY)}" width="${fmt(tbW)}" height="${fmt(tbH)}"/><path d="M${fmt(tbX)} ${fmt(tbY + tbH / 2)}h${fmt(tbW)}"/>
    <text x="${fmt(tbX + u * 0.6)}" y="${fmt(tbY + tbH * 0.36)}" style="font-size:${fmt(u * 1.15)}px">STN · ${esc((name || 'UNNAMED').toUpperCase())}</text>
    <text x="${fmt(tbX + u * 0.6)}" y="${fmt(tbY + tbH * 0.86)}" style="font-size:${fmt(u * 1.15)}px">REV ${rank}${pct != null ? ` · ${pct}% REBUILT` : ''}</text></g>`;
  return `<svg viewBox="${fmt(x0)} ${fmt(y0)} ${fmt(w)} ${fmt(h)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs><pattern id="sb-grid" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M2 0H0V2" fill="none" class="sb-gridline"/></pattern><pattern id="sb-grid10" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" class="sb-gridmajor"/></pattern></defs>
    <rect x="${fmt(x0)}" y="${fmt(y0)}" width="${fmt(w)}" height="${fmt(h)}" fill="url(#sb-grid)"/><rect x="${fmt(x0)}" y="${fmt(y0)}" width="${fmt(w)}" height="${fmt(h)}" fill="url(#sb-grid10)"/>
    <path class="sb-axis" d="M${fmt(x0)} 0H${fmt(x1)}M0 ${fmt(y0)}V${fmt(y1)}"/><path class="sb-ticks" d="${ticks.join('')}"/><path class="sb-corner" d="${corners}"/>
    ${parts.join('')}${title}</svg>`;
}
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

/** A small picture of one core piece, in gold on a faint outline of the station (the roadmap cards). */
export function pieceThumb(id) {
  const box = [...BASE]; if (REACH[id]) { box[0] = Math.min(box[0], REACH[id][0]); box[1] = Math.min(box[1], REACH[id][1]); box[2] = Math.max(box[2], REACH[id][2]); box[3] = Math.max(box[3], REACH[id][3]); }
  const w = box[2] - box[0] + 3, h = box[3] - box[1] + 3;
  return `<svg viewBox="${fmt(box[0] - 1.5)} ${fmt(box[1] - 1.5)} ${fmt(w)} ${fmt(h)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <g class="th-base"><path d="M-13.6 0H13.6M0 -9.8V9.2"/><rect x="-1.8" y="-3" width="3.6" height="6" rx="0.6"/></g><g class="th-piece">${CORE[id] || ''}</g></svg>`;
}
/** Built modules out of all modules, counting levels (for a meter). */
export function stationProgress(workshop) {
  let cur = 0, goal = 0; for (const m of STATION_MODULES) { cur += Math.min(MAX[m.id], workshop[m.id] || 0); goal += MAX[m.id]; } return { cur, goal };
}
