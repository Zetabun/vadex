// The Cipher: the finale, in the Stellar crown (Overhaul rank 10). The signal from past the Deep Void comes home in
// fragments (Deep Void expeditions from Fleet Ops, and now and then a Void boss drops one). In the Cipher room each
// fragment is decoded by tuning the signal (ui/overlays.js showTune), and each lights a glyph and reads out a line of a
// message. With all seven read, the message is a set of coordinates: from then on a Deep Void run can follow the signal
// (a route, data/routes.js SIGNAL) into a hidden sector, the Origin, which ends on the Cipher itself: a boss that fights
// in the voices of the bosses it has watched you beat (data/bosses.js, combat/bosses.js masks). progression/cipher.js
// keeps the record.

/** The chamber opens with the crown, at this Overhaul rank. */
export const CIPHER_RANK = 10;
export const cipherOpen = (state) => (state.prestige?.level || 0) >= CIPHER_RANK;

/** The seven glyphs, in the order they are read: what ORBIT makes of each fragment. strokes: the glyph as polylines in a
 *  unit box (0..1, y down), drawn on the room's plinths and in the tuner. */
export const GLYPHS = [
  { id: 'listen', name: 'Listening', line: 'We hear you, little light. We have always heard you.',
    strokes: [[[0.5, 0.1], [0.5, 0.9]], [[0.2, 0.35], [0.5, 0.55], [0.8, 0.35]], [[0.25, 0.8], [0.75, 0.8]]] },
  { id: 'learn', name: 'Learning', line: 'Every ship you broke, we remembered. Every way you fought, we learned.',
    strokes: [[[0.15, 0.2], [0.85, 0.2], [0.5, 0.85], [0.15, 0.2]], [[0.5, 0.2], [0.5, 0.55]], [[0.35, 0.45], [0.65, 0.45]]] },
  { id: 'make', name: 'Making', line: 'The ones who fall on your world are our hands. We make them new each time.',
    strokes: [[[0.2, 0.15], [0.2, 0.85], [0.8, 0.85], [0.8, 0.15]], [[0.2, 0.5], [0.8, 0.5]], [[0.5, 0.15], [0.5, 0.5]]] },
  { id: 'ask', name: 'Asking', line: 'We asked the dark what you were. The dark did not know. So we sent more.',
    strokes: [[[0.25, 0.3], [0.5, 0.12], [0.75, 0.3], [0.5, 0.55], [0.5, 0.7]], [[0.45, 0.88], [0.55, 0.88]], [[0.15, 0.6], [0.3, 0.75]], [[0.85, 0.6], [0.7, 0.75]]] },
  { id: 'wait', name: 'Waiting', line: 'Past the edge of your charts is a place with no name. We wait there.',
    strokes: [[[0.15, 0.5], [0.85, 0.5]], [[0.3, 0.25], [0.7, 0.25]], [[0.3, 0.75], [0.7, 0.75]], [[0.5, 0.1], [0.5, 0.9]]] },
  { id: 'name', name: 'Naming', line: 'You call us invaders. We have no name. You may call us the Cipher.',
    strokes: [[[0.2, 0.2], [0.8, 0.8]], [[0.8, 0.2], [0.2, 0.8]], [[0.5, 0.1], [0.9, 0.5], [0.5, 0.9], [0.1, 0.5], [0.5, 0.1]]] },
  { id: 'open', name: 'Opening', line: 'Come to the Origin, keeper of the last orbit, and show us what we could not learn.',
    strokes: [[[0.5, 0.1], [0.85, 0.35], [0.85, 0.75], [0.5, 0.9], [0.15, 0.75], [0.15, 0.35], [0.5, 0.1]], [[0.5, 0.35], [0.5, 0.65]], [[0.38, 0.5], [0.62, 0.5]]] },
];
export const FRAGMENTS = GLYPHS.length;
/** The chance a Void boss drops a signal fragment when it falls in a main sortie (Deep Void expeditions bring the rest). */
export const FRAGMENT_DROP = 0.4;
/** Once the message is read, a fragment decodes into an echo of it: a Blueprint. */
export const ECHO_BP = 1;

/** Tuning a fragment: match the signal's frequency (whole steps), phase and strength. The target for the nth fragment
 *  (0-based) is fixed, so the same fragment always tunes the same way. */
export const TUNE = { freqMin: 1, freqMax: 5, ampMin: 0.25, ampMax: 1, phaseTol: 0.05, ampTol: 0.07 };
export function tuneTarget(n) {
  const r = (k) => { const x = Math.sin((n + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  return { freq: TUNE.freqMin + 1 + Math.floor(r(1) * (TUNE.freqMax - TUNE.freqMin)), phase: Math.round((0.15 + r(2) * 0.7) * 100) / 100, amp: Math.round((0.4 + r(3) * 0.5) * 100) / 100 };
}
/** How close a setting is to the target: each of the three dials locked or not. */
export function tuneLocks(target, set) {
  const dp = Math.abs(((set.phase - target.phase) % 1 + 1.5) % 1 - 0.5);
  return { freq: set.freq === target.freq, phase: dp <= TUNE.phaseTol, amp: Math.abs(set.amp - target.amp) <= TUNE.ampTol };
}
export const tuned = (target, set) => { const l = tuneLocks(target, set); return l.freq && l.phase && l.amp; };

/** The hidden sector past the charts. Its waves are as strong as the Deep Void sector it takes the place of. */
export const ORIGIN = {
  id: 'origin', name: 'The Origin', waves: 10, boss: 'cipher', mini: 'scribe',
  sky: ['#020709', '#082126', '#17565a'], star: '#fff3c4', accent: '#ffe9a8', decor: 'glyphs',
  intro: 'Past the edge of the charts. Everything it has learned from you, all at once.',
  pool: [['plate', 1, 4], ['phantom', 1, 4], ['artillery', 1, 3], ['lasher', 1, 3], ['herald', 1, 3], ['aegis', 1, 3], ['mender', 1, 3], ['splitter', 1, 4], ['rocketeer', 1, 4], ['sniper', 1, 4], ['lancer', 1, 4], ['swarmling', 1, 4], ['warper', 1, 3], ['coiler', 1, 3], ['binder', 1, 3], ['burster', 1, 2], ['sower', 1, 2]],
};

/** What beating the Cipher pays: Blueprints (the first time, and a few every time after), the Keeper paint and title. */
export const CIPHER_BP = 10, CIPHER_BP_AGAIN = 2, KEEPER_PAINT = 'keeper', KEEPER_TITLE = 'Keeper';

/** What ORBIT says in the Cipher room, round and round, by how far the reading has got. */
export const CIPHER_LINES = {
  none: ['The crown hears it clearer than anything else aboard, {n}: the signal from past the Deep Void. I need fragments of it to read.', 'Deep Void expeditions bring fragments home, and the Void bosses sometimes drop one when they fall.'],
  some: ['Each fragment you tune gives up a glyph, {n}, and a line. I do not like what the lines are saying.', 'Keep bringing fragments home. The message is not finished, and neither are they.'],
  read: ['The message is coordinates, {n}. A place past every chart we have. Follow the signal on your next Deep Void run.', 'When you pick your route in the Deep Void, the signal will be one of them. It is waiting for you.'],
  beaten: ['The signal is silent, {n}. For the first time since the Fall, nothing is listening to us.', 'The crown still hums with it now and then. An echo. Nothing more. I think.'],
};
