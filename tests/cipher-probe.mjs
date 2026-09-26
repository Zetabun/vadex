// The Cipher probe: boss duels at the same depth. A strong late-game build (Workshop maxed, Overhaul rank 10, Deep
// Calibration 5, cannon, laser, tesla and missiles at rank 9, the bot flying with auto-dodge) meets each boss at the
// last wave of a Deep Void sector, the Cipher through the Origin, and fights it to the end. The ship's hull is topped up
// each moment (so every duel runs its course) while the hull it would have lost is counted. Reports the seconds to
// beat each boss and the hull lost doing it, so the Cipher can be set against the Void bosses it stands beside.
// Usage: node --experimental-loader ./tests/loader.mjs ./tests/cipher-probe.mjs [runs] [Deep Void sector: 1-6] [bosses...]
import { G, recalc } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newState } from '@last-orbit/core/state.js';
import { initWorld, step, debugSetWave } from '@last-orbit/combat/sim.js';
import { startSortie, endSortie, nextOffer, pickCard, nextRelic, pickRelic } from '@last-orbit/progression/run.js';
import { followSignal } from '@last-orbit/progression/cipher.js';
import { spawnBoss } from '@last-orbit/combat/bosses.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { WEAPON_ORDER } from '@last-orbit/data/weapons.js';
import { ABILITY_ORDER } from '@last-orbit/data/abilities.js';
import { useAbility } from '@last-orbit/combat/abilities.js';
import { TICK } from '@last-orbit/data/balance.js';
import { LAST_WAVE } from '@last-orbit/data/sectors.js';

const runs = Number(process.argv[2] || 8), sector = Number(process.argv[3] || 3), list = process.argv.slice(4).length ? process.argv.slice(4) : ['watcher', 'choir', 'maw', 'cipher'];
const bossWave = LAST_WAVE + sector * 10, LIMIT = 300, CARDS = Number(process.env.CARDS || 60);
const score = (c) => c.kind === 'upgrade' ? 10 + (c.rank >= 4 ? 2 : 0) : c.kind === 'weapon' ? 9 : c.kind === 'mod' ? ({ m_dmg: 8, m_rate: 8, m_multi: 9, m_hull: 6, m_shield: 5, m_crit: 5, m_critd: 4 }[c.id] || 3) : 2;
bus.on('stats', () => { G.sheet.totalN['f.autopilot'] = 1; G.sheet.totalN.autoDodge = 1; });
const out = [];
for (const id of list) {
  const secs = [], lost = []; let unbeaten = 0;
  for (let r = 0; r < runs; r++) {
    const st = (G.state = newState()); st.meta.legacyChecked = true;
    for (const w of WEAPON_ORDER) st.unlocked.weapons[w] = 1; for (const a of ABILITY_ORDER) st.unlocked.abilities[a] = 1;
    for (const u of WORKSHOP) st.workshop[u.id] = u.max; st.stats.sectorsCleared = 6; st.stats.bestSector = 6; st.prestige.level = 10; st.prestige.tech = { bp_calib: 5 }; st.cipher.decoded = 7;
    recalc(); startSortie({ seed: 811 + r * 7919 }); initWorld(); const run = st.run;
    run.pendingLevels = CARDS; run.pendingRelics = 6; /* a pilot this deep has picked this many */
    for (let k = 0; k < CARDS * 2 + 20 && (nextOffer() || nextRelic()); k++) { if (run.offer) { const o = run.offer; let bi = 0; o.forEach((c, i) => { if (score(c) > score(o[bi])) bi = i; }); pickCard(bi); } else if (run.relicOffer) pickRelic(0); }
    run.offer = run.relicOffer = null; run.pendingLevels = run.pendingRelics = 0;
    for (const w of ['cannon', 'laser', 'tesla', 'missile']) { if (!run.weapons[w]) run.order.push(w); run.weapons[w] = 9; } run.level = 40; recalc();
    run.wave = bossWave; if (id === 'cipher') followSignal(run); /* the Origin takes this sector's place */
    debugSetWave(bossWave); const wave = bossWave;
    for (let k = 0; k < 600 && !G.world.wave.boss; k++) step(TICK); /* the wave starts */
    if (G.world.wave.boss?.boss?.id !== id) { for (const e of G.world.enemies) e.alive = false; G.world.enemies.length = 0; spawnBoss(G.world, id); } /* any other boss meets the same wave's strength */
    let t = 0, dead = false, met = null; const lost0 = run.hullBy?.lost || 0;
    const off = bus.on('bossDied', (w, b) => { if (b.boss?.id === id) dead = true; });
    while (!dead && t < LIMIT + 3) { if (process.env.DBG && Math.abs(t % 15) < TICK) console.log(id, t.toFixed(0), G.world.wave.boss?.hp?.toFixed?.(3)); /* DBG=1: the boss's health every 15 s */
      if (run.offer || run.relicOffer || run.routeOffer || run.anomalyOffer) { run.offer = run.relicOffer = run.routeOffer = run.anomalyOffer = null; run.pendingLevels = run.pendingRelics = 0; run.pendingRoute = run.pendingAnomaly = false; }
      step(TICK); t += TICK; G.world.fx.length = 0; const p = G.world.player; p.hull = 1; p.alive = true; run.strikes = 0; run.breached = false; run.revivesUsed = -99; if (G.world.wave.state === 'dead' || G.world.wave.state === 'over') { G.world.wave.state = 'fighting'; }
      if (!met && G.world.wave.boss?.boss?.id) met = G.world.wave.boss.boss.id;
      if (Math.random() < 0.02) for (const a of run.abilities) useAbility(G.world, a, true);
    }
    off(); if (met !== id) console.warn('wanted', id, 'met', met, 'at wave', wave);
    if (dead) { secs.push(t); lost.push((run.hullBy?.lost || 0) - lost0); } else unbeaten++;
    endSortie('abandoned');
  }
  const med = (a) => { const v = [...a].sort((x, y) => x - y); return v.length ? v[v.length >> 1] : NaN; };
  out.push({ boss: id, beaten: `${runs - unbeaten}/${runs}`, secs: +med(secs).toFixed(0), hullLost: +(med(lost) * 100).toFixed(0) + '%' });
}
console.table(out);
console.log(`duels at the depth of Deep Void ${sector} (wave ${bossWave}); hull lost is what the ship would have lost, in whole hulls ×100`);
