// The opening cinematic's screen layer: letterbox bars, typed captions in the station AI's blip voice, the whiteout
// when the core blows, and Skip. The scene itself is rendering/intro.js, drawn by the renderer while G.introPlaying.
// A first play starts on a title card, because phones only allow sound after a tap.
import { G } from '@last-orbit/core/game.js';
import { h } from '@last-orbit/ui/dom.js';
import { typeText } from '@last-orbit/ui/comms.js';
import { BLOW, AFTER } from '@last-orbit/rendering/intro.js';

const CAPTIONS = [[0.9, 'For a hundred years, the last orbit was our home.'], [6.6, 'Then they came.'], [AFTER + 0.9, 'The last orbit fell.'], [AFTER + 4.4, 'We must rebuild it.']];

export function createIntro(app) {
  const cap = h('div.in-cap'), flash = h('div.in-flash'), fade = h('div.in-fade'), title = h('div.in-title', h('b', 'LAST ORBIT'), h('small', 'Orbital defence'), h('span', 'Tap to begin'));
  const skip = h('button.in-skip', { onclick: (e) => { e.stopPropagation(); finish(); } }, 'Skip ›');
  const el = h('div#intro', h('div.in-bar.top'), h('div.in-bar.bottom'), cap, title, flash, fade, skip);
  app.append(el);
  let scene = null, onDone = null, raf = 0, next = 0, ending = false;
  function tick() {
    raf = requestAnimationFrame(tick); if (!scene || G.introPaused) return;
    while (next < CAPTIONS.length && scene.t >= CAPTIONS[next][0]) { const text = CAPTIONS[next++][1]; cap.classList.add('on'); typeText(cap, text, { speed: 55 }); }
    if (scene.t > BLOW - 0.3 && scene.t < AFTER + 0.8) cap.classList.remove('on');
  }
  function beat(name) {
    if (name === 'core') { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
    if (name === 'end') finish();
  }
  function finish() {
    if (ending || !scene) return; ending = true; fade.classList.add('on');
    setTimeout(() => { cancelAnimationFrame(raf); G.introPlaying = false; G.introPaused = false; G.renderer?.stopIntro(); scene = null; el.classList.remove('on', 'titled'); fade.classList.remove('on'); app.classList.remove('intro-on'); cap.textContent = ''; ending = false; onDone?.(); }, 700);
  }
  return {
    /** tap: begin on the title card (first launch). done: called when it ends or is skipped. */
    play({ tap = false, done } = {}) {
      onDone = done; next = 0; ending = false; cap.textContent = ''; cap.classList.remove('on');
      scene = G.renderer.startIntro(G.state.ship); scene.onBeat = beat; G.introPlaying = true; G.introPaused = tap;
      el.classList.add('on'); el.classList.toggle('titled', tap); app.classList.add('intro-on');
      // up from black (on the title card the scene shows behind it straight away)
      fade.style.transition = 'none'; fade.classList.toggle('on', !tap); void fade.offsetWidth; fade.style.transition = ''; if (!tap) setTimeout(() => fade.classList.remove('on'), 60);
      if (tap) el.onclick = () => { if (!G.introPaused) return; G.introPaused = false; el.classList.remove('titled'); };
      else el.onclick = null;
      cancelAnimationFrame(raf); tick();
      return scene;
    },
    get playing() { return !!scene; },
  };
}
