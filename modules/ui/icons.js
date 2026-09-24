// Line glyphs for interface controls (navigation, pause, settings…). Decorative: the containing button supplies its name.
// Game artwork (weapons, cards, relics, ships, currency) lives in art.js.
import { h } from '@last-orbit/ui/dom.js';
const paths = {
  launch: 'M12 2c4 3 5 8 4 13l-4 3-4-3c-1-5 0-10 4-13zM8 15l-3 3 1 4 3-2M16 15l3 3-1 4-3-2M12 8v3',
  workshop: 'M14 6a4 4 0 0 0 5 5l2 2-8 8-2-2a4 4 0 0 0-5-5L3 11l8-8zM7 17l-3 3',
  armory: 'M12 2v4M12 18v4M2 12h4M18 12h4M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0M12 10v4M10 12h4',
  ships: 'M12 2l3 7 6 3-6 2-3 8-3-8-6-2 6-3z',
  contracts: 'M8 3h8v3H8zM6 5H4v17h16V5h-2M8 11h8M8 15h8M8 19h5',
  pause: 'M8 5v14M16 5v14',
  gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8 7 17M17 7l2.8-2.8',
  close: 'M5 5l14 14M19 5L5 19',
  reroll: 'M20 11a8 8 0 0 0-14-5L4 8M4 3v5h5M4 13a8 8 0 0 0 14 5l2-2M20 21v-5h-5',
  check: 'M4 12l5 5L20 6',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  play: 'M7 4l13 8-13 8z',
  home: 'M3 11l9-8 9 8M5 9v12h14V9',
  chevron: 'M9 5l7 7-7 7',
  back: 'M15 5l-7 7 7 7',
  records: 'M7 3h10v6a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6',
  awards: 'M8 2l2.5 7M16 2l-2.5 7M12 9a6 6 0 1 1 0 12 6 6 0 0 1 0-12M12 12.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z',
  share: 'M12 3v12M7 8l5-5 5 5M5 12v8h14v-8',
  missions: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
};
export function uiIcon(id) {
  const path = paths[id] || paths.ships;
  return h('span.ui-icon', { 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter" focusable="false"><path d="${path}"/></svg>` });
}
