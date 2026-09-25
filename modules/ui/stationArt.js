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

/** SVG markup for the pilot's station. rank: Overhaul rank; workshop: levels by id; next: highlight what the next rank adds. */
export function stationBlueprint(rank, workshop, { next = true, peak = {} } = {}) {
  const parts = [];
  // trusses and hub
  parts.push(`<g class="sb-core"><path d="M-13.6 0H13.6M0 -9.8V9.2"/><rect x="-1.8" y="-3" width="3.6" height="6" rx="0.6"/></g>`);
  for (const c of STATION_CORE) {
    if (!CORE[c.id]) continue;
    if (coreBuilt(c.id, rank)) parts.push(`<g class="sb-core">${CORE[c.id]}</g>`);
    else if (next && c.at === rank + 1) parts.push(`<g class="sb-next">${CORE[c.id]}</g>`);
  }
  for (const m of STATION_MODULES) {
    const lvl = workshop[m.id] || 0, st = Math.max(lvl, peak[m.id] || 0) <= 0 ? 'ghost' : lvl >= MAX[m.id] ? 'lit' : 'built';
    parts.push(`<g class="sb-mod ${st}" transform="translate(${m.x} ${-m.y})">${shapeOf(m, m.shape)}</g>`);
  }
  return `<svg viewBox="-24 -20 48 33" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs><pattern id="sb-grid" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M2 0H0V2" fill="none" class="sb-gridline"/></pattern></defs>
    <rect x="-24" y="-20" width="48" height="33" fill="url(#sb-grid)"/>${parts.join('')}</svg>`;
}
/** Built modules out of all modules, counting levels (for a meter). */
export function stationProgress(workshop) {
  let cur = 0, goal = 0; for (const m of STATION_MODULES) { cur += Math.min(MAX[m.id], workshop[m.id] || 0); goal += MAX[m.id]; } return { cur, goal };
}
