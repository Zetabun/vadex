// The Cipher (data/cipher.js, progression/cipher.js): fragments decode in order into the seven glyphs, then into
// echoes worth a Blueprint; the tuner's targets are fixed and its locks forgiving at the edges; once the message is
// read a Deep Void route can follow the signal into the Origin (never in the Daily, once a sortie), which takes the place
// of that one sector, ends on the Cipher (not a Void boss) and is gone when the next sortie starts; the Cipher wears the
// voices of other bosses as its phases turn; beating it pays, and Void bosses drop fragments that bank with the sortie.
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, startWave, step } from '@last-orbit/combat/sim.js';
import { spawnBoss, updateBoss } from '@last-orbit/combat/bosses.js';
import { startSortie, endSortie, rollRoutes, pickRoute } from '@last-orbit/progression/run.js';
import { sectorOf, hidden, LAST_WAVE } from '@last-orbit/data/sectors.js';
import { genWave } from '@last-orbit/combat/waves.js';
import { BOSSES } from '@last-orbit/data/bosses.js';
import { GLYPHS, FRAGMENTS, ECHO_BP, CIPHER_BP, CIPHER_BP_AGAIN, CIPHER_RANK, ORIGIN, tuneTarget, tuned, tuneLocks } from '@last-orbit/data/cipher.js';
import { cipherOf, cannotDecode, decodeFragment, messageRead, glyphsRead, signalOffered, fragmentsHeld, keeper } from '@last-orbit/progression/cipher.js';
import { BEACON_RANK } from '@last-orbit/data/beacons.js';

let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.error('FAIL', msg); } };
const st = (G.state = newState()); st.meta.legacyChecked = true;

// ------------------------------------------------------------------ decoding
ok(/crown/.test(cannotDecode(st)), 'before the crown, nothing can be decoded: ' + cannotDecode(st));
st.prestige.level = CIPHER_RANK; ok(/No fragments/.test(cannotDecode(st)), 'with the crown but no fragments: ' + cannotDecode(st));
st.fleet.fragments = FRAGMENTS + 1; const bp0 = st.prestige.bp;
const read = []; for (let i = 0; i < FRAGMENTS; i++) read.push(decodeFragment(st));
ok(read.every((r, i) => r && r.glyph === GLYPHS[i] && r.n === i) && read.at(-1).last && messageRead(st) && glyphsRead(st).length === FRAGMENTS, 'fragments decode into the seven glyphs in order, the last one completing the message');
const echo = decodeFragment(st);
ok(echo?.echo && st.prestige.bp === bp0 + ECHO_BP && cipherOf(st).echoes === 1 && fragmentsHeld(st) === 0, 'after the message, a fragment is an echo worth a Blueprint');
ok(decodeFragment(st) === null, 'with no fragments left, nothing decodes');

// ------------------------------------------------------------------ the tuner
const t0 = tuneTarget(0); ok(JSON.stringify(t0) === JSON.stringify(tuneTarget(0)) && GLYPHS.some((_, i) => JSON.stringify(tuneTarget(i)) !== JSON.stringify(t0)), 'a fragment always tunes the same way, and they differ');
ok(GLYPHS.every((_, i) => { const t = tuneTarget(i); return t.freq >= 2 && t.freq <= 5 && t.amp >= 0.4 && t.amp <= 0.9 && t.phase > 0.1 && t.phase < 0.9; }), 'every target is reachable and away from where the dials start');
ok(tuned(t0, t0) && !tuned(t0, { freq: 1, phase: 0, amp: 0.25 }), 'the target tunes; the dials as they start do not');
ok(tuneLocks({ freq: 3, phase: 0.98, amp: 0.5 }, { freq: 3, phase: 0.01, amp: 0.55 }).phase && !tuneLocks(t0, { ...t0, phase: t0.phase + 0.2 }).phase, 'phase wraps round (0.98 is next to 0.01), and a long way off does not lock');

// ------------------------------------------------------------------ following the signal
st.prestige.level = CIPHER_RANK; recalc(); startSortie({}); initWorld();
const run = st.run, voidStart = LAST_WAVE + 11; /* the first wave of Deep Void 2 */
run.wave = voidStart; ok(signalOffered(st, run) && rollRoutes(run).includes('signal'), 'with the message read, a Deep Void route offers the signal');
run.wave = 21; ok(!signalOffered(st, run) && !rollRoutes(run).includes('signal'), 'not before the Deep Void');
run.wave = voidStart; run.daily = 'x'; ok(!signalOffered(st, run), 'never in the Daily'); run.daily = null;
rollRoutes(run); pickRoute(run.routeOffer.indexOf('signal'));
const sec = sectorOf(voidStart);
ok(sec.origin && sec.def === ORIGIN && run.route === 'signal' && run.origin === sec.idx, 'picking it makes the next sector the Origin: ' + sec.def.name);
ok(!sectorOf(voidStart - 10).origin && !sectorOf(voidStart + 10).origin && sectorOf(voidStart + 10).def.name.startsWith('Deep Void'), 'only that one sector: the charts carry on after it');
ok(genWave(run.seed, voidStart + 9).boss === 'cipher' && genWave(run.seed, voidStart + 4).boss === 'scribe', 'the Origin ends on the Cipher, with the Scribe halfway');
ok(!signalOffered(st, run), 'once followed, not offered again this sortie');
st.prestige.level = Math.max(CIPHER_RANK, BEACON_RANK); run.wave = voidStart + 9; startWave(G.world);
ok(G.world.wave.info.boss === 'cipher' && G.world.wave.boss?.boss?.id === 'cipher', 'with the beacons lit, the Origin still ends on the Cipher, not a Void boss: ' + G.world.wave.info.boss);

// ------------------------------------------------------------------ the Cipher's voices
const w = G.world, boss = w.wave.boss; boss.boss.enter = 0;
updateBoss(w, 0.016); ok(boss.color === BOSSES.cipher.color && !boss.boss.mask, 'it starts in its own colour');
boss.hp = 0.8; updateBoss(w, 0.016); ok(boss.boss.mask === 'bastion' && boss.color === BOSSES.bastion.color, 'then it speaks as Bastion Halcyon, in its colour');
boss.hp = 0.65; updateBoss(w, 0.016); ok(boss.boss.mask === 'wyrm', 'then as the Wyrm');
boss.hp = 0.05; updateBoss(w, 0.016); ok(!boss.boss.mask && boss.color === BOSSES.cipher.color, 'and at the end, all voices at once, in its own');
ok(BOSSES.cipher.phases.filter((p) => p.mask).every((p) => BOSSES[p.mask] && !BOSSES[p.mask].mini), 'every voice it wears is a boss the pilot has fought');

// ------------------------------------------------------------------ beating it, and fragments from Void bosses
const bp1 = st.prestige.bp; bus.emit('bossDied', w, { boss: { id: 'cipher', t: 95, parts: [] } });
ok(st.prestige.bp === bp1 + CIPHER_BP && st.paints.keeper && keeper(st) && cipherOf(st).best === 95 && run.cipher?.first, 'the first time pays Blueprints, the Keeper paint and title');
bus.emit('bossDied', w, { boss: { id: 'cipher', t: 120, parts: [] } });
ok(st.prestige.bp === bp1 + CIPHER_BP + CIPHER_BP_AGAIN && cipherOf(st).kills === 2 && cipherOf(st).best === 95, 'after that, a few Blueprints each time');
for (let i = 0; i < 200; i++) bus.emit('bossDied', w, { boss: { id: 'watcher', t: 30, parts: [] } });
const found = run.fragments || 0; ok(found > 50 && found < 110, 'Void bosses drop a fragment now and then (about 40%): ' + found);
const held = fragmentsHeld(st), summary = endSortie('abandoned');
ok(summary.fragments === found && fragmentsHeld(st) === held + found && summary.cipher && summary.origin, 'the sortie banks the fragments it found, and says the Cipher fell in the Origin');
startSortie({}); ok(hidden.origin === -1 && !sectorOf(voidStart).origin, 'the next sortie starts on the charts again');
endSortie('abandoned');

if (failures) { console.error(`cipher-regression: ${failures} failed`); process.exit(1); }
console.log('cipher-regression: all passed');
