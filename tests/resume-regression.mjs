// Resuming a sortie after the app closes (progression/run.js checkpoint, resumeOffer; main.js resumeSortie and
// endResumed): the checkpoint is the run at the start of the wave under way (or as it is, between waves), with the
// ship's hull and the barriers; it survives the save; the next launch sets the run aside to offer it; resuming starts
// that wave again with everything won during it as it was at its start; ending it instead banks the sortie as it stood,
// with its debrief; a Counterattack stage is banked as before; a new sortie or a finished one leaves no checkpoint.
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic, nextRoute, pickRoute, nextAnomaly, pickAnomaly, resumeOffer, resumeInfo, recoverInterruptedRun, checkpoint } from '@last-orbit/progression/run.js';
import { parseSave } from '@last-orbit/save/save.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { TICK } from '@last-orbit/data/balance.js';

let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.error('FAIL', msg); } };
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = 1; });
const fresh = () => { const s = newState(); s.meta.legacyChecked = true; for (const u of WORKSHOP) s.workshop[u.id] = u.max; return s; };
const fly = (until, secs = 600) => { for (let i = 0; i < secs / TICK && !until(); i++) { if (nextOffer()) { pickCard(0); continue; } if (nextRelic()) { pickRelic(0); continue; } if (nextRoute()) { pickRoute(0); continue; } if (nextAnomaly()) { pickAnomaly(0); continue; } step(TICK); const p = G.world.player; p.hull = Math.max(p.hull, 0.6); p.alive = true; } };
const closeApp = (st) => parseSave(JSON.stringify(st)); /* what the next launch loads */

// ------------------------------------------------------------------ the checkpoint at each wave's start
let st = (G.state = fresh()); recalc(); startSortie({}); initWorld();
ok(!st.resume, 'a new sortie has no checkpoint until its first wave begins');
fly(() => G.world.wave.num === 3 && G.world.wave.state === 'fighting');
const atStart = { salvage: st.run.salvage, score: st.run.score, level: st.run.level };
ok(st.resume?.run?.wave === 3 && st.resume.run.salvage === atStart.salvage && st.resume.barriers.length > 0, 'wave 3 has begun: the checkpoint is the run as it began');
fly(() => st.run.score > atStart.score || G.world.wave.num !== 3 || G.world.wave.state !== 'fighting', 30);
ok(st.run.score > atStart.score && G.world.wave.num === 3 && G.world.wave.state === 'fighting', 'mid-wave 3, score has been won since it began');

// ------------------------------------------------------------------ the app closes mid-wave; the next launch offers it
let loaded = closeApp(st), r = resumeOffer(loaded);
ok(r && !loaded.run && r.live && r.live.score > r.run.score, 'the next launch sets the sortie aside to offer, keeping the run as it stood too');
const info = resumeInfo(r); ok(info.wave === 3 && info.salvage === Math.floor(r.live.salvage) && info.ship === st.run.ship, 'the offer names the wave, the ship and the salvage so far: ' + JSON.stringify(info));
ok(resumeOffer(closeApp(loaded)) && closeApp(loaded).resume.live, 'closed again before choosing: still offered next time');

// ------------------------------------------------------------------ resuming (as main.js resumeSortie does)
G.state = loaded; st = loaded; st.run = r.run; delete r.live; recalc(); initWorld(); G.world.player.hull = r.hull; G.world.wave.num = st.run.wave - 1;
fly(() => G.world.wave.state === 'fighting', 10);
ok(G.world.wave.num === 3 && st.run.salvage === atStart.salvage && st.run.score === atStart.score && st.run.level === atStart.level, `resumed: wave 3 starts again with the salvage and score it began with (${st.run.score} vs ${atStart.score})`);

// ------------------------------------------------------------------ between waves, the checkpoint is the run as it is
fly(() => G.world.wave.state === 'cleared' && G.world.wave.num === 3);
bus.emit('saving', 'auto');
ok(st.resume.run.wave === 4 && st.resume.run.salvage === st.run.salvage, 'between waves, a save takes the checkpoint as things stand (the next wave, the clear paid)');

// ------------------------------------------------------------------ ending it instead: the debrief, with what it had
fly(() => G.world.wave.num === 4 && G.world.wave.state === 'fighting'); fly(() => false, 3);
loaded = closeApp(st); r = resumeOffer(loaded); const bank0 = loaded.salvage, live = Math.floor(r.live.salvage);
G.state = loaded; loaded.run = r.live; loaded.resume = null; recalc(); initWorld(); G.world.wave.num = loaded.run.wave;
const summary = endSortie('abandoned');
ok(summary && summary.salvage === live && loaded.salvage >= bank0 + live && !loaded.run && !loaded.resume && summary.pilot, 'ended instead: the sortie as it stood is banked, with a full debrief (pilot XP too)');

// ------------------------------------------------------------------ Counterattack is banked as before; no stale checkpoints
st = (G.state = fresh()); recalc(); startSortie({}); initWorld(); fly(() => G.world.wave.num === 2 && G.world.wave.state === 'fighting');
st.run.mode = 'counter'; ok(checkpoint(st, G.world) === null, 'a Counterattack stage takes no checkpoint');
loaded = closeApp(st); ok(resumeOffer(loaded) === null, 'and is not offered');
const had = loaded.salvage, got = recoverInterruptedRun(loaded); ok(!loaded.run && !loaded.resume && loaded.salvage === had + got, 'it is banked as before');
st.run.mode = undefined; startSortie({}); ok(!st.resume, 'a new sortie clears an old checkpoint');
initWorld(); fly(() => G.world.wave.num === 1 && G.world.wave.state === 'fighting'); ok(st.resume, 'and takes its own'); endSortie('abandoned'); ok(!st.resume, 'a finished sortie leaves none');

if (failures) { console.error(`resume-regression: ${failures} failed`); process.exit(1); }
console.log('resume-regression: all passed');
