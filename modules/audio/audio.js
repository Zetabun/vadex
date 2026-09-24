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
  milestone: ['triangle', 523, 1046, 0.5, 0.16, 0.2, 0, 0], unlock: ['sine', 440, 1320, 0.6, 0.14, 0.3, 0, 0], rewind: ['sawtooth', 1200, 40, 2.2, 0.25, 2, 0.4, 0], loot: ['sine', 990, 1480, 0.2, 0.1, 0.1, 0, 0.05],
};

export function initAudio() {
  if (ctx) { resumeAudio(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try { ctx = new AC(); } catch { return; }
  master = ctx.createGain(); comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
  sfxBus = ctx.createGain(); musicBus = ctx.createGain(); sfxBus.connect(master); musicBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
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

export function playSfx(id, vol = 1) {
  if (!ctx || ctx.state !== 'running') return; const d = S[id]; if (!d) return;
  const now = ctx.currentTime; if (now - (last[id] || 0) < d[5] || voices >= MAX_VOICES) return; last[id] = now;
  const [type, f0, f1, dur, v, , nz, spread] = d, p = 1 + (Math.random() * 2 - 1) * spread;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(v * vol, now + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, now + dur); g.connect(sfxBus);
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0 * p, now); o.frequency.exponentialRampToValueAtTime(Math.max(10, f1 * p), now + dur); o.connect(g); o.start(now); o.stop(now + dur + 0.02);
  voices++; o.onended = () => { voices = Math.max(0, voices - 1); g.disconnect(); };
  if (nz) { const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.playbackRate.value = 0.5 + Math.random(); const ng = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(Math.max(300, f0 * 4), now); f.frequency.exponentialRampToValueAtTime(120, now + dur); ng.gain.value = nz; n.connect(f); f.connect(ng); ng.connect(g); n.start(now, Math.random() * 0.5, dur + 0.02); }
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
