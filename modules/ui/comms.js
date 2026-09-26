// The station AI (ORBIT): short lines typed out in its blip voice. typeText drives any typed line (the intro's captions
// too); createComms is the message panel in the hangar that delivers a story line at each milestone, once.
import { G } from '@last-orbit/core/game.js';
import { h } from '@last-orbit/ui/dom.js';
import { voiceBlip } from '@last-orbit/audio/audio.js';
import { STATION_CORE, STATION_ALIEN, STATION_TROPHIES, trophyWon } from '@last-orbit/data/station.js';
import { gardenOpen } from '@last-orbit/data/garden.js';

/** Type text into el letter by letter, chirping every other letter. */
export function typeText(el, text, { speed = 38, onDone, pitch = 1 } = {}) {
  clearTimeout(el._tt); let i = 0;
  const step = () => {
    if (i >= text.length) { onDone?.(); return; }
    const ch = text[i++]; el.textContent = text.slice(0, i); if (i % 2) voiceBlip(ch, 0.9, pitch);
    el._tt = setTimeout(step, /[.,!?]/.test(ch) ? 230 : speed);
  };
  step();
}

// Milestone lines, in story order: when: has the pilot reached it. {n}: the callsign.
export const LINES = [
  { id: 'welcome', when: () => true, text: 'Welcome aboard, {n}. What is left of the station is ours to rebuild.' },
  { id: 'firstSortie', when: (s) => (s.stats.sorties || 0) >= 1, text: 'Salvage secured. Every Workshop upgrade rebuilds a piece of the station.' },
  { id: 'sector1', when: (s) => (s.stats.sectorsCleared || 0) >= 1, text: 'They are pulling back. When we are strong enough, we follow them.' },
  { id: 'fieldKit', when: (s) => (s.stats.sorties || 0) >= 3, text: 'Supply drops are reaching us, {n}. Fight hard and the meter by your loadout fills: every canister holds a boost for when you need it. Your field kit is in the Armory.' },
  { id: 'garden', when: gardenOpen, text: 'Power is back in the old greenhouse, {n}. Something in there survived.' },
  { id: 'counter', when: (s) => !!s.counter?.unlocked, text: 'Counterattack protocols are ready, {n}. Time to take the fight to them.' },
  { id: 'deepVoid', when: (s) => (s.stats.bestWave || 0) > 60, text: 'Anomalous readings past wave sixty. The Deep Void goes on and on.' },
  { id: 'overhaul', when: (s) => (s.prestige?.level || 0) >= 1, text: 'The Command Deck is restored. Come aboard, {n}.' },
  ...STATION_CORE.filter((c) => c.say).map((c) => ({ id: 'core_' + c.id, when: (s) => (s.prestige?.level || 0) >= c.at, text: c.say })),
  ...STATION_ALIEN.map((a) => ({ id: 'alien_' + a.id, when: (s) => (s.counter?.tech?.[a.id] || 0) >= 1, text: a.say })),
  ...STATION_TROPHIES.map((t) => ({ id: 'trophy_' + t.stage, when: (s) => trophyWon(s, t.stage), text: t.say })),
  { id: 'siege', when: (s) => trophyWon(s, 1), text: 'Our counterattack stung them, {n}. They are coming for the station. Meet me in Defence Control: you will find it in Missions.' },
];

export function createComms(app) {
  const text = h('div.cm-text'), who = h('div.cm-who', 'ORBIT · station AI'), el = h('div#comms', { role: 'status', onclick: () => hide() }, h('div.cm-av', h('i')), h('div.cm-main', who, text));
  app.append(el); let hideT = 0, busy = false;
  function hide() { clearTimeout(hideT); clearTimeout(text._tt); el.classList.remove('on'); busy = false; }
  /** A line typed out in the box: ORBIT's, or Bolt's (speaker 'bolt': its beep, then what ORBIT says it means, in Bolt's
   *  own orange and a higher, quicker chirp). */
  function say(line, speaker = 'orbit') {
    clearTimeout(hideT); busy = true; el.classList.add('on'); const n = G.state.pilot.name || 'Pilot', isBolt = speaker === 'bolt';
    el.classList.toggle('bolt', isBolt); who.textContent = isBolt ? 'BOLT · translated by ORBIT' : 'ORBIT · station AI';
    typeText(text, line.replace('{n}', n), { speed: isBolt ? 30 : 36, pitch: isBolt ? 1.9 : 1, onDone: () => { clearTimeout(hideT); hideT = setTimeout(hide, 4200); } });
  }
  /** Deliver the next milestone line not yet heard. Pilots already past milestones when this arrived only hear the welcome. */
  function check() {
    const st = G.state, seen = (st.seen.comms ||= {});
    if (!st.seen.commsInit) { st.seen.commsInit = true; for (const l of LINES) if (l.id !== 'welcome' && l.when(st)) seen[l.id] = true; }
    if (busy) return false;
    const line = LINES.find((l) => !seen[l.id] && l.when(st)); if (!line) return false;
    seen[line.id] = true; say(line.text); return true;
  }
  return { say, check, hide, get busy() { return busy; } };
}
