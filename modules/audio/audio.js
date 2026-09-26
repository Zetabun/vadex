// Audio: everything is synthesised with WebAudio, so the game ships no sound files.
//   master ─┬─ sfx bus  (pooled one-shot voices, per-id rate limit, random pitch spread, global voice cap)
//           └─ music bus (step sequencer: bass + arp + pad, scale/tempo per sector, extra layer during bosses)
// The context is created on the first user gesture (browser autoplay rules). When the page is hidden it is closed,
// because iOS can leave a suspended context silent for good once the screen locks; the next touch builds a fresh one.
import { G } from '@last-orbit/core/game.js';

let ctx = null, master, sfxBus, musicBus, comp, noiseBuf;
let voices = 0; const MAX_VOICES = 14; const last = {};
// id: [type, f0, f1, dur, vol, minGap, noiseMix, pitchSpread]
const S = {
  cannon: ['square', 520, 180, 0.07, 0.10, 0.045, 0, 0.06], laser: ['sawtooth', 1500, 500, 0.05, 0.06, 0.05, 0, 0.08], missile: ['sawtooth', 160, 420, 0.22, 0.09, 0.09, 0.5, 0.1],
  plasma: ['sine', 300, 90, 0.2, 0.13, 0.1, 0.2, 0.1], mine: ['triangle', 200, 140, 0.12, 0.1, 0.12, 0, 0.1], rail: ['sawtooth', 2400, 60, 0.35, 0.16, 0.12, 0.4, 0.04],
  arc: ['square', 900, 2200, 0.06, 0.05, 0.06, 0.6, 0.3], beam: ['sine', 660, 700, 0.09, 0.035, 0.11, 0, 0.02], boom: ['sine', 140, 30, 0.35, 0.22, 0.07, 0.9, 0.2],
  die: ['square', 380, 70, 0.12, 0.09, 0.035, 0.5, 0.25], bossdie: ['sawtooth', 220, 18, 1.6, 0.34, 1, 1, 0], shield: ['sine', 1200, 600, 0.12, 0.1, 0.08, 0, 0.1],
  hurt: ['sawtooth', 200, 50, 0.28, 0.22, 0.15, 0.7, 0.05], dive: ['sawtooth', 900, 250, 0.4, 0.06, 0.25, 0, 0.1], eshot: ['square', 260, 160, 0.08, 0.04, 0.09, 0, 0.15],
  snipe: ['sine', 1800, 1800, 0.25, 0.06, 0.3, 0, 0], ebeam: ['sawtooth', 90, 70, 0.6, 0.12, 0.4, 0.5, 0], graze: ['sine', 1400, 2100, 0.07, 0.07, 0.06, 0, 0.1],
  bossintro: ['sawtooth', 55, 110, 1.8, 0.3, 2, 0.3, 0], phase: ['square', 110, 440, 0.7, 0.2, 0.5, 0.3, 0], weak: ['sine', 880, 1760, 0.18, 0.1, 0.2, 0, 0],
  ring: ['triangle', 500, 250, 0.3, 0.07, 0.25, 0, 0.1], charge: ['sine', 120, 900, 0.9, 0.09, 0.6, 0, 0], teleport: ['sine', 2000, 200, 0.18, 0.08, 0.15, 0.2, 0.2],
  ability: ['triangle', 330, 990, 0.3, 0.16, 0.1, 0.1, 0], dash: ['sawtooth', 240, 1100, 0.24, 0.2, 0.12, 0.85, 0.06], dashReady: ['sine', 1320, 1980, 0.09, 0.06, 0.3, 0, 0], paint: ['sine', 1100, 1500, 0.08, 0.09, 0.08, 0, 0], hauler: ['triangle', 1320, 1760, 0.25, 0.1, 0.5, 0, 0],
  // ui
  buy: ['triangle', 660, 880, 0.06, 0.08, 0.03, 0, 0.04], deny: ['square', 140, 110, 0.09, 0.06, 0.1, 0, 0], tab: ['sine', 520, 620, 0.04, 0.05, 0.03, 0, 0],
  lockBeep: ['square', 1760, 1760, 0.045, 0.045, 0.03, 0, 0], /* a missile seeker searching (gunner seat) */
  milestone: ['triangle', 523, 1046, 0.5, 0.16, 0.2, 0, 0], unlock: ['sine', 440, 1320, 0.6, 0.14, 0.3, 0, 0], rewind: ['sawtooth', 1200, 40, 2.2, 0.25, 2, 0.4, 0], count: ['triangle', 1180, 1050, 0.035, 0.05, 0.05, 0, 0.02], loot: ['sine', 990, 1480, 0.2, 0.1, 0.1, 0, 0.05],
};

export function initAudio() {
  if (ctx) { resumeAudio(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try { ctx = new AC(); } catch { return; }
  // A new context's clock starts again at zero: forget when each sound last played on the old one, or its rate limit
  // would hold it silent until the new clock caught up (every gun after the phone slept).
  for (const k in last) delete last[k];
  master = ctx.createGain(); comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
  sfxBus = ctx.createGain(); musicBus = ctx.createGain(); sfxBus.connect(master); musicBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes(); fetching = null; loadSamples(); // a new context decodes its own copies
}
export function applyVolumes() { if (!ctx) return; const s = G.state.settings, t = ctx.currentTime; master.gain.setTargetAtTime(s.master, t, 0.05); sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05); musicBus.gain.setTargetAtTime(s.music * 0.55, t, 0.2); }
export function resumeAudio() {
  if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
  // Mobile browsers can leave a context interrupted after an app switch. Retry on
  // the next gesture if their first automatic resume is blocked.
  try { Promise.resolve(ctx.resume()).then(() => { nextT = 0; applyVolumes(); }).catch(() => {}); } catch { /* next gesture retries */ }
}
export function suspendAudio(on) {
  if (!ctx) return;
  if (!on) { resumeAudio(); return; }
  const old = ctx; ctx = null; pad = null; voices = 0; nextT = 0;
  try { Promise.resolve(old.close()).catch(() => {}); } catch { /* page is closing */ }
}
// Any touch, click or key brings sound back (or starts it), whichever screen it lands on.
if (typeof document !== 'undefined') for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => { if (!ctx || ctx.state !== 'running') initAudio(); }, { capture: true, passive: true });

export function playSfx(id, vol = 1, pitch = 1) {
  if (!ctx || ctx.state !== 'running') return; const d = S[id]; if (!d) return;
  const now = ctx.currentTime, prev = last[id] || 0; if ((now - prev < d[5] && prev <= now) || voices >= MAX_VOICES) return; last[id] = now;
  const [type, f0, f1, dur, v, , nz, spread] = d, p = (1 + (Math.random() * 2 - 1) * spread) * pitch;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(v * vol, now + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, now + dur); g.connect(sfxBus);
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0 * p, now); o.frequency.exponentialRampToValueAtTime(Math.max(10, f1 * p), now + dur); o.connect(g); o.start(now); o.stop(now + dur + 0.02);
  voices++; o.onended = () => { voices = Math.max(0, voices - 1); g.disconnect(); };
  if (nz) { const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.playbackRate.value = 0.5 + Math.random(); const ng = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(Math.max(300, f0 * 4), now); f.frequency.exponentialRampToValueAtTime(120, now + dur); ng.gain.value = nz; n.connect(f); f.connect(ng); ng.connect(g); n.start(now, Math.random() * 0.5, dur + 0.02); }
}

// ------------------------------------------------------------------ recorded sounds (assets/sfx)
// Most sounds are synthesised; these are recordings, loaded once sound starts. Several files for one id are variations,
// played in turn at random. playSample returns false until they have loaded, so the caller can fall back to a synth one.
const VER = import.meta.url.split('?')[1] || ''; // the build's cache-bust, so a changed file is fetched afresh
// wet: how much goes to the reverb (so a burst rings out when it stops instead of cutting dead)
const SAMPLES = { turretShot: { files: ['turret-shot-1', 'turret-shot-2', 'turret-shot-3', 'turret-shot-4'], gap: 0.05, spread: 0.04, wet: 0.4 }, turretReady: { files: ['turret-ready'], gap: 0.3, spread: 0, wet: 0.2 } };
const bufs = {}; let fetching = null;
function loadSamples() {
  if (fetching || !ctx) return; const c = ctx;
  fetching = Promise.all(Object.entries(SAMPLES).map(([id, d]) => Promise.all(d.files.map((f) => fetch(new URL(`../../assets/sfx/${f}.wav${VER ? '?' + VER : ''}`, import.meta.url)).then((r) => r.arrayBuffer()).then((a) => c.decodeAudioData(a)).catch(() => null)))
    .then((list) => { bufs[id] = list.filter(Boolean); }))).catch(() => { fetching = null; });
}
/** A recorded sound; false if it is not loaded (yet). */
export function playSample(id, vol = 1, pitch = 1) {
  if (!ctx || ctx.state !== 'running') return false; const list = bufs[id], d = SAMPLES[id]; if (!list?.length) { loadSamples(); return false; }
  const now = ctx.currentTime, prev = last['s:' + id] || 0; if ((now - prev < d.gap && prev <= now) || voices >= MAX_VOICES) return true; last['s:' + id] = now;
  const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = list[Math.floor(Math.random() * list.length)]; src.playbackRate.value = pitch * (1 + (Math.random() * 2 - 1) * d.spread);
  g.gain.value = vol; src.connect(g); g.connect(sfxBus); sendToReverb(g, d.wet); src.start(now); voices++; src.onended = () => { voices = Math.max(0, voices - 1); g.disconnect(); }; return true;
}
// A short, dark reverb (a synthesised impulse: decaying noise, a little pre-delay, the highs rolled off) that sounds
// can send to, so they ring out as if fired from a steel mount rather than stopping dead. One per audio context.
let verb = null;
function sendToReverb(node, wet) {
  if (!wet || !ctx) return;
  if (!verb || verb.ctx !== ctx) {
    const sr = ctx.sampleRate, len = Math.floor(sr * 1.4), ir = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) { const t = i / sr; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3.6) * Math.min(1, t / 0.01); } }
    const conv = ctx.createConvolver(), pre = ctx.createDelay(0.1), lp = ctx.createBiquadFilter(), out = ctx.createGain(); conv.buffer = ir; pre.delayTime.value = 0.025; lp.type = 'lowpass'; lp.frequency.value = 2800; out.gain.value = 0.9;
    pre.connect(conv); conv.connect(lp); lp.connect(out); out.connect(sfxBus); verb = { ctx, input: pre };
  }
  const w = ctx.createGain(); w.gain.value = wet; node.connect(w); w.connect(verb.input);
}

// ------------------------------------------------------------------ the station AI's voice, and big explosions
/** One soft chirp of the station AI's 'voice' for a typed letter: a short rising sine, vowels a little higher. */
export function voiceBlip(ch, vol = 1, pitch = 1) {
  if (!ctx || ctx.state !== 'running' || !/[a-z0-9]/i.test(ch)) return;
  const now = ctx.currentTime, base = (330 + ('aeiou'.includes(ch.toLowerCase()) ? 90 : 0) + (ch.charCodeAt(0) % 7) * 12) * pitch;
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
  o.type = 'sine'; o.frequency.setValueAtTime(base, now); o.frequency.exponentialRampToValueAtTime(base * 1.12, now + 0.05);
  g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.1 * vol, now + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, now + 0.07);
  o.connect(g); g.connect(f); f.connect(sfxBus); o.start(now); o.stop(now + 0.09); o.onended = () => { g.disconnect(); f.disconnect(); };
}
/** A long, low explosion: filtered noise falling in pitch over a sinking sub tone. */
export function rumble(dur = 2.5, vol = 1) {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime, n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; n.loop = true; f.type = 'lowpass';
  f.frequency.setValueAtTime(1400, now); f.frequency.exponentialRampToValueAtTime(70, now + dur); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.7 * vol, now + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  n.connect(f); f.connect(g); g.connect(sfxBus); n.start(now); n.stop(now + dur + 0.05);
  const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(95, now); o.frequency.exponentialRampToValueAtTime(28, now + dur);
  og.gain.setValueAtTime(0.0001, now); og.gain.exponentialRampToValueAtTime(0.5 * vol, now + 0.05); og.gain.exponentialRampToValueAtTime(0.0001, now + dur); o.connect(og); og.connect(sfxBus); o.start(now); o.stop(now + dur + 0.05);
}

// ------------------------------------------------------------------ thrusters
// A soft engine hum that swells a little when the ship steers (level 0..1): two slightly detuned low tones and a
// touch of low rumble, all under a low-pass filter, so it sits under the music rather than hissing over it.
let thrust = null;
export function setThrust(level) {
  if (!ctx || ctx.state !== 'running') { thrust = null; return; }
  if (!thrust || thrust.ctx !== ctx) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0; lp.connect(g); g.connect(sfxBus);
    const a = ctx.createOscillator(), b = ctx.createOscillator(); a.type = 'triangle'; b.type = 'sawtooth'; a.frequency.value = 92; b.frequency.value = 138; b.detune.value = 7;
    const bg = ctx.createGain(); bg.gain.value = 0.25; a.connect(lp); b.connect(bg); bg.connect(lp);
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.playbackRate.value = 0.35; const ng = ctx.createGain(); ng.gain.value = 0.35; n.connect(ng); ng.connect(lp);
    a.start(); b.start(); n.start(); thrust = { ctx, lp, g, a, b };
  }
  const t = ctx.currentTime, k = Math.max(0, Math.min(1, level));
  thrust.g.gain.setTargetAtTime(0.013 * k, t, 0.14);
  thrust.lp.frequency.setTargetAtTime(240 + 380 * k, t, 0.14);
  thrust.a.frequency.setTargetAtTime(88 + 26 * k, t, 0.2); thrust.b.frequency.setTargetAtTime(132 + 40 * k, t, 0.2);
}

/** A missile leaving the rack: a rush of air (noise through a band sweeping up, then away) over a low roar. */
export function whoosh(vol = 1) {
  if (!ctx || ctx.state !== 'running' || voices >= MAX_VOICES) return; const now = ctx.currentTime, dur = 0.9;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.32 * vol, now + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, now + dur); g.connect(sfxBus);
  const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.playbackRate.value = 0.9; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(500, now); bp.frequency.exponentialRampToValueAtTime(2600, now + 0.18); bp.frequency.exponentialRampToValueAtTime(420, now + dur); n.connect(bp); bp.connect(g); n.start(now); n.stop(now + dur + 0.02);
  const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, now); o.frequency.exponentialRampToValueAtTime(55, now + dur); og.gain.value = 0.25; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
  o.connect(lp); lp.connect(og); og.connect(g); o.start(now); o.stop(now + dur + 0.02);
  sendToReverb(g, 0.3); voices++; n.onended = () => { voices = Math.max(0, voices - 1); g.disconnect(); };
}
// A missile's blast (the gunner seat): a sharp crack, a roar of noise that darkens as it dies away, and a deep thump
// under it, rung out through the reverb. vol falls off with distance.
export function explosion(vol = 1) {
  if (!ctx || ctx.state !== 'running' || voices >= MAX_VOICES) return; const now = ctx.currentTime, dur = 1.9;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.42 * vol, now + 0.01); g.gain.exponentialRampToValueAtTime(0.16 * vol, now + 0.3); g.gain.exponentialRampToValueAtTime(0.06 * vol, now + 1); g.gain.exponentialRampToValueAtTime(0.0001, now + dur); g.connect(sfxBus);
  const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.playbackRate.value = 0.6; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
  lp.frequency.setValueAtTime(5000, now); lp.frequency.exponentialRampToValueAtTime(1000, now + 0.12); lp.frequency.exponentialRampToValueAtTime(320, now + 1); lp.frequency.exponentialRampToValueAtTime(110, now + dur); n.connect(lp); lp.connect(g); n.start(now); n.stop(now + dur + 0.02);
  const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(130, now); o.frequency.exponentialRampToValueAtTime(32, now + 0.9); og.gain.setValueAtTime(0.9, now); og.gain.exponentialRampToValueAtTime(0.0001, now + 1);
  o.connect(og); og.connect(g); o.start(now); o.stop(now + 1.02);
  sendToReverb(g, 0.45); voices++; n.onended = () => { voices = Math.max(0, voices - 1); g.disconnect(); };
}
// A missile seeker's lock: a steady high tone while it holds (the gunner seat). on: true or false.
let lock = null;
export function lockTone(on) {
  if (!ctx || ctx.state !== 'running') { lock = null; return; }
  if (!lock || lock.ctx !== ctx) {
    if (!on) return; const g = ctx.createGain(), lp = ctx.createBiquadFilter(); g.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 2800; lp.connect(g); g.connect(sfxBus);
    const a = ctx.createOscillator(), b = ctx.createOscillator(); a.type = 'square'; b.type = 'square'; a.frequency.value = 1760; b.frequency.value = 1764; a.connect(lp); b.connect(lp); a.start(); b.start(); lock = { ctx, g };
  }
  lock.g.gain.setTargetAtTime(on ? 0.028 : 0, ctx.currentTime, 0.015);
}

// ------------------------------------------------------------------ music
const SCALES = [[0, 3, 5, 7, 10], [0, 2, 3, 7, 8], [0, 1, 5, 7, 8], [0, 2, 5, 7, 9], [0, 3, 6, 7, 10], [0, 1, 4, 6, 10]];
const ROOTS = [45, 43, 41, 46, 40, 38], TEMPO = [96, 88, 104, 120, 132, 80];
let step = 0, nextT = 0, mode = { sector: 0, boss: false }, pad = null, seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export function setMusicMode(sector, boss) { if (mode.sector !== sector) { mode.sector = sector; seed = 7 + sector * 131; killPad(); } mode.boss = boss; }
function killPad() { if (pad) { const t = ctx.currentTime; pad.g.gain.setTargetAtTime(0, t, 0.8); const p = pad; setTimeout(() => { try { p.o.forEach((o) => o.stop()); } catch { /* already stopped */ } }, 4000); pad = null; } }
function note(type, f, t, dur, vol, cutoff) {
  const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cutoff;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05); o.onended = () => g.disconnect();
}
/** Call every frame; schedules a little ahead of the audio clock. */
export function tickMusic() {
  if (!ctx || ctx.state !== 'running' || G.state.settings.music <= 0 || G.state.settings.master <= 0) { if (pad && ctx) killPad(); return; }
  const si = mode.sector % 6, sc = SCALES[si], root = ROOTS[si], spb = 60 / (TEMPO[si] * (mode.boss ? 1.15 : 1)) / 2;
  if (!pad) { const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.05, ctx.currentTime, 2); const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 500; fl.connect(g); g.connect(musicBus); const o = [0, 7, 12.07].map((iv) => { const x = ctx.createOscillator(); x.type = 'sawtooth'; x.frequency.value = hz(root + iv); x.connect(fl); x.start(); return x; }); pad = { g, o }; }
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 16), s = step % 16, shift = [0, 0, sc[2], sc[1]][bar % 4];
    if (s % 8 === 0 || (mode.boss && s % 4 === 0) || (s === 6 && bar % 2)) note('triangle', hz(root - 12 + shift), nextT, spb * 3, 0.16, 400);
    if (s % 2 === 0 ? rnd() < 0.62 : rnd() < (mode.boss ? 0.5 : 0.18)) { const deg = Math.floor(rnd() * sc.length), oct = rnd() < 0.3 ? 24 : 12; note(si >= 3 ? 'square' : 'sine', hz(root + shift + sc[deg] + oct), nextT, spb * (1 + Math.floor(rnd() * 3)), 0.045, 1800 + 1400 * rnd()); }
    if (mode.boss && s % 4 === 2) { const n = ctx.createBufferSource(); n.buffer = noiseBuf; const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000; g.gain.setValueAtTime(0.05, nextT); g.gain.exponentialRampToValueAtTime(0.0001, nextT + 0.06); n.connect(f); f.connect(g); g.connect(musicBus); n.start(nextT, 0, 0.08); }
    nextT += spb; step++;
  }
}
