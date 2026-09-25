// The Observatory (rendering/observatory.js): a glass dome beneath the hub, open to the stars (it opens with the dome, at
// Overhaul rank 6). It charts the Deep Void: every depth marked below, once a sortie has reached it, waits there to be
// charted, and charting it lights its constellation in the dome and pays Blueprints (and at some depths a paint job
// found nowhere else). progression/observatory.js keeps the chart.

/** The Observatory comes back at this Overhaul rank. */
export const OBSERVATORY_RANK = 6;
export const observatoryOpen = (state) => (state.prestige?.level || 0) >= OBSERVATORY_RANK;

// The depths: the first wave of that Deep Void sector (wave 61 is the first wave past the last sector), the
// constellation it is charted as, and what charting it pays. stars: where its stars sit in the dome's sky, as
// [azimuth, height] in degrees (azimuth 0 ahead, towards the window), joined in order.
export const VOID_MARKS = [
  { wave: 61, name: 'The Threshold', bp: 2, paint: 'v_starlit', stars: [[-12, 52], [-4, 58], [5, 55], [12, 49]] },
  { wave: 71, name: 'The Drift', bp: 2, stars: [[38, 40], [46, 47], [55, 44], [62, 50], [70, 46]] },
  { wave: 81, name: 'The Lantern', bp: 3, paint: 'v_horizon', stars: [[-60, 36], [-54, 44], [-46, 40], [-50, 32], [-60, 36]] },
  { wave: 91, name: 'The Shoal', bp: 3, stars: [[100, 30], [108, 36], [116, 31], [124, 38], [110, 44]] },
  { wave: 101, name: 'The Crown', bp: 4, paint: 'v_glass', stars: [[-110, 48], [-102, 56], [-94, 50], [-86, 58], [-78, 50]] },
  { wave: 121, name: 'The Serpent', bp: 5, stars: [[150, 40], [160, 48], [170, 42], [180, 52], [190, 46], [200, 55]] },
  { wave: 151, name: 'The Abyss', bp: 6, paint: 'v_abyssal', stars: [[-160, 30], [-150, 40], [-140, 34], [-150, 26], [-160, 30]] },
  { wave: 201, name: 'The Far Shore', bp: 8, stars: [[0, 78], [30, 72], [60, 76], [90, 70], [120, 75], [150, 71]] },
];
export const MARK_BY_WAVE = Object.fromEntries(VOID_MARKS.map((m) => [m.wave, m]));
/** Which Deep Void sector a wave is in (1 for waves 61-70), for the labels. */
export const voidSector = (wave) => Math.floor((wave - 61) / 10) + 1;

// What ORBIT says through the telescope, round and round (after anything waiting to be charted).
export const SKY_LINES = [
  'Past wave sixty there are no names on the old charts, {n}. We are making them up as you go.',
  'The Deep Void is not empty. It is only very far from everything we know.',
  'I have been tracking a light out past the Serpent. It moves when nothing out there should.',
  'Every depth you chart, the next pilot will not have to guess. There will be a next pilot, {n}.',
];
