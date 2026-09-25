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
  gear: 'M10.3 2h3.4l.6 2.7 1.9.8 2.3-1.5 2.4 2.4-1.5 2.3.8 1.9 2.7.6v3.4l-2.7.6-.8 1.9 1.5 2.3-2.4 2.4-2.3-1.5-1.9.8-.6 2.7h-3.4l-.6-2.7-1.9-.8-2.3 1.5-2.4-2.4 1.5-2.3-.8-1.9L2 13.7v-3.4l2.7-.6.8-1.9L4 5.5l2.4-2.4 2.3 1.5 1.9-.8zM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8',
  close: 'M5 5l14 14M19 5L5 19',
  reroll: 'M20 11a8 8 0 0 0-14-5L4 8M4 3v5h5M4 13a8 8 0 0 0 14 5l2-2M20 21v-5h-5',
  check: 'M4 12l5 5L20 6',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  play: 'M7 4l13 8-13 8z',
  home: 'M3 11l9-8 9 8M5 9v12h14V9',
  chevron: 'M9 5l7 7-7 7',
  back: 'M15 5l-7 7 7 7',
  deck: 'M4 4h16v16H4zM4 15c5-4 11-4 16 0M9 4v5M15 4v5M7 12h.5M12 10.5h.5M16.5 12h.5',
  records: 'M7 3h10v6a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6',
  awards: 'M8 2l2.5 7M16 2l-2.5 7M12 9a6 6 0 1 1 0 12 6 6 0 0 1 0-12M12 12.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z',
  share: 'M12 3v12M7 8l5-5 5 5M5 12v8h14v-8',
  control: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9M12 12l6.4-6.4M16 15.5h.5M8 9.5h.5',
  missions: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
  comms: 'M12 10l-4 11M12 10l4 11M9.6 16.5h4.8M13.5 8.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0M8.5 5.5a4.5 4.5 0 0 0 0 6M15.5 5.5a4.5 4.5 0 0 1 0 6M6 3.5a7.5 7.5 0 0 0 0 10M18 3.5a7.5 7.5 0 0 1 0 10',
  observatory: 'M3.5 12.5l12-6 1.8 3.6-12 6zM11.3 13.1L8 21M11.3 13.1l3.2 7.9M20.5 1.5v4M18.5 3.5h4',
  yard: 'M2 21h20M4 21V5h16v16M12 5v3M12 10l3.5 8L12 16l-3.5 2z',
  beacon: 'M9.5 21l1.2-10h2.6l1.2 10zM7 21h10M10 11V7.5h4V11M9.5 7.5L12 5l2.5 2.5M3.5 5.5l5 2.5M20.5 5.5l-5 2.5M3 10.5l5.5-1M21 10.5l-5.5-1',
};
export function uiIcon(id) {
  const path = paths[id] || paths.ships;
  return h('span.ui-icon', { 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter" focusable="false"><path d="${path}"/></svg>` });
}
