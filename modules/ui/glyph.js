// A glyph of the Cipher's message (data/cipher.js) as an inline SVG, for the panels and the tuner.
import { h } from '@last-orbit/ui/dom.js';

/** The glyph in a span (sized by CSS through the class), drawn in the current text colour. */
export function glyphSvg(g, cls = 'cg-glyph') {
  const el = h('span.' + cls);
  el.innerHTML = `<svg viewBox="-0.1 -0.1 1.2 1.2" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="0.08" stroke-linecap="round" stroke-linejoin="round">${g.strokes.map((line) => `<polyline points="${line.map(([u, v]) => u + ',' + v).join(' ')}"/>`).join('')}</g></svg>`;
  return el;
}
