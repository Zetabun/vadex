// Offline progress without running the battle: an analytic model of the player's build against the same wave data the live game uses.
// estimateDps() is also what the debug panel's "Inspect DPS" shows, so the model can be checked against live numbers.
import { Big } from '@last-orbit/core/big.js';
import { simulateFoundry, applyFoundryReport } from '@last-orbit/progression/foundry.js';
import { G, flag, count } from '@last-orbit/core/game.js';
import { BAL, enemyHp, enemyReward, enemyDmg, dataPerWave } from '@last-orbit/data/balance.js';
import { sectorOf } from '@last-orbit/data/sectors.js';
import { DRONES, DRONE_BASE, droneLevelMult } from '@last-orbit/data/drones.js';
import { milestonesReached } from '@last-orbit/data/balance.js';
import { waveTotals, isBossWave } from '@last-orbit/combat/waves.js';
import { queueChoicesThrough } from '@last-orbit/combat/sim.js';
import { CHALLENGES } from '@last-orbit/data/goals.js';
const waveOpts = () => ({ bossRush: !!CHALLENGES.find((c) => c.id === G.state.run.challenge)?.bossRush });
import { gain, checkUnlocks } from '@last-orbit/progression/economy.js';
import { bossCoreReward } from '@last-orbit/progression/rewards.js';
import { simulateFleetOffline, applyFleetOfflineReport } from '@last-orbit/progression/fleet.js';
import { simulateMaterials, applyMaterialsReport } from '@last-orbit/progression/materials.js';
import { materialForWave } from '@last-orbit/data/materials.js';
import { clearXp, grantXp, killXp } from '@last-orbit/progression/experience.js';

/** Expected sustained damage per second as Big: { total, boss, parts:{id:Big} } */
export function estimateDps() {
  const sh = G.sheet, assist = sh.n('aimAssist'); let total = Big.ZERO, boss = Big.ZERO; const parts = {};
  for (const id in sh.weapons) {
    const c = sh.weapons[id], crit = 1 + c.critChance * (c.critMult - 1); let crowd = 1, single = 1;
    if (c.kind === 'bolt') { const acc = Math.min(0.92, 0.5 + assist * 0.13); crowd = (c.proj || 1) * acc * (1 + Math.min(3, c.pierce) * 0.5 + c.bounce * 0.6) * (c.column ? 2 : 1) * (c.returnShot ? 1.5 : 1) * (1 + (c.burn || 0)); single = (c.proj || 1) * Math.min(0.97, acc + 0.25) * (1 + (c.burn || 0)); if (c.nth) { const k = 1 + (c.nthMult - 1) / c.nth; crowd *= k; single *= k; } }
    else if (c.kind === 'missile') { single = (c.proj || 1) * (1 + c.split * 0.4); crowd = single * 2.2; }
    else if (c.kind === 'orb' || c.kind === 'mine') { single = (c.proj || 1) * (1 + (c.burn || 0)) * (c.kind === 'mine' ? 0.7 : 0.85); crowd = single * 2.6 * (c.pool ? 1.3 : 1); }
    else if (c.kind === 'rail') { single = (c.proj || 1) * 0.9; crowd = single * 2.6 * (c.width > 4 ? 1.5 : 1); }
    else if (c.kind === 'arc') { let s = 0, m = 1; for (let j = 0; j <= c.chains; j++) { s += m; m *= c.chainFall; } single = (c.proj || 1); crowd = single * s; }
    else if (c.kind === 'beam') { single = c.targets > 1 ? 1 + (c.targets - 1) * 0.3 : 1; single *= (1 + c.ramp) / 2 + 0.6; crowd = c.targets * 1.3; }
    const base = c.dmg.mul(c.rate * crit);
    parts[id] = base.mul(crowd); total = total.add(parts[id]); boss = boss.add(base.mul(single * (c.bossMul || 1)));
  }
  const bays = G.state.run.drones.bays.slice(0, Math.floor(sh.n('droneBays'))); let dr = Big.ZERO;
  for (const t of bays) { const d = DRONES[t]; if (!d.dmg) continue; const lvl = G.state.run.drones.levels[t] || 1; dr = dr.add(sh.b('damage').mul(DRONE_BASE * d.dmg * d.rate * droneLevelMult(lvl, milestonesReached(lvl)) * sh.n('droneDmg') * sh.n('droneRate') * (d.splash ? 2 : 1) * (flag('f.droneEnergy') ? 1.4 : 1))); }
  if (!dr.isZero()) { parts.drone = dr; total = total.add(dr); boss = boss.add(dr); }
  const focusless = 1; // offline/idle play has no Focus, no weak points, no paint
  return { total: total.mul(focusless), boss: boss.mul(sh.n('bossDmg') * 1.25), parts };
}

/** Can the current build clear wave w unattended? → seconds, or null if it is a wall. */
export function clearTime(w, dps) {
  const sec = sectorOf(w), tot = waveTotals(G.state.run.seed, w, waveOpts()), hp = enemyHp(w, sec.idx).mul(tot.hp);
  const use = tot.boss ? dps.boss : dps.total; if (use.isZero()) return null;
  const armour = tot.boss?.armour ? 1 - tot.boss.armour * 0.5 * (1 - Math.min(1, G.sheet.n('armorPen'))) : 0.9;
  const t = hp.ratio(use.mul(armour)) , overhead = BAL.offlineWaveOverhead / (1 + G.sheet.n('waveHaste'));
  if (t > (tot.boss ? BAL.enrage * 1.4 : 75)) return null;
  // survival: incoming damage over the fight vs effective hull (autopilot dodges a share)
  const sh = G.sheet, dodge = 0.35 + Math.min(3, sh.n('autoDodge')) * 0.15, incoming = enemyDmg(w, sec.idx).mul((tot.boss ? 1.6 : 0.22 * Math.sqrt(tot.count)) * t * (1 - dodge) * (1 - Math.min(0.8, sh.n('dmgReduce'))));
  const ehp = sh.b('hull').mul(1 + sh.n('shieldRatio') * (1 + sh.n('shieldRegen') * t * 0.5) + sh.n('hullRegen') * t);
  if (incoming.gt(ehp)) return null;
  return { t: t + overhead, tot, sec };
}

export function simulateOffline(seconds) {
  const st = G.state, sh = G.sheet, run = st.run;
  const cap = Math.max(0, sh.n('offlineCap')) * 3600, used = Math.min(Math.max(0, seconds), cap), eff = Math.max(0, sh.n('offlineEff')), effective = used * eff;
  // All persistent offline producers share the same progression-controlled reward window. Combat then
  // applies offline efficiency inside that window; Fleet/Foundry/Materials use the capped real seconds.
  const out = { away: seconds, used, cap, effective, capped: seconds > cap, eff, waves: 0, kills: 0, from: run.wave, to: run.wave, credits: Big.ZERO, scrap: Big.ZERO, data: Big.ZERO, cores: 0, matter: Big.ZERO, xp: 0, ores: {}, wall: false, farmWave: run.wave, fleet: simulateFleetOffline(used), foundry: simulateFoundry(used), materials: null };
  const dps = estimateDps(); let left = effective, w = run.wave, push = flag('f.offlineCombat') && !run.farm, iter = 0;
  const pay = (wave, c, reps = 1) => {
    const waveBase = enemyReward(wave, c.sec.idx), units = c.tot.rewardUnits || [];
    // Credits use the same per-wave reward baseline and the player's current Credit multiplier.
    // Active-only Focus/Streak/overkill bonuses are deliberately excluded from unattended play.
    out.credits = out.credits.add(waveBase.mul(c.tot.reward * reps).mul(sh.b('creditGain')));

    if (st.unlocks.arsenal) {
      // Expected Scrap mirrors live kill rules per enemy: per-archetype drop chance, guaranteed
      // elite/boss drops and the every-tenth-kill perk. This replaces the old padded flat estimate.
      const chance = Math.max(0, sh.n('scrapChance')), tenth = !!flag('f.tenthScrap'); let scrapUnits = 0;
      for (const u of units) {
        const guaranteed = u.elite || u.boss, p = guaranteed ? 1 : Math.min(1, chance * (u.scrap || 1));
        const expectedDrop = tenth ? (guaranteed ? 1.2 : 0.9 * p + 0.3) : p;
        scrapUnits += Math.max(1, u.reward || 0) * expectedDrop;
      }
      if (scrapUnits > 0) out.scrap = out.scrap.add(waveBase.mul(BAL.scrapShare * scrapUnits * reps).mul(sh.b('scrapGain')));
      if (wave >= 3) out.scrap = out.scrap.add(waveBase.mul(BAL.clearScrap * reps).mul(sh.b('scrapGain')));
    }

    if (st.unlocks.research) {
      const eliteData = units.reduce((n, u) => n + (u.elite ? 1.5 : 0), 0);
      out.data = out.data.add(dataPerWave(wave).mul(((c.tot.boss ? 5 : 1) + eliteData) * reps).mul(sh.b('dataGain')));
    }
    if (c.sec.idx >= BAL.matterFromSector) {
      const unitValue = 1 + (c.sec.idx - 3) * 2; let expectedMatter = 0;
      for (const u of units) {
        const p = Math.min(1, BAL.matterChance * (u.elite ? 8 : 1));
        expectedMatter += p * unitValue * Math.max(1, u.reward || 0) * 0.5;
      }
      if (expectedMatter > 0) out.matter = out.matter.add(Big.from(expectedMatter * reps).mul(sh.b('matterGain')));
    }
    if (c.tot.boss) out.cores += bossCoreReward(c.tot.boss) * reps;
    const mat = materialForWave(wave), oreN = units.reduce((n, u) => n + (u.boss ? Math.max(1, Math.round(u.reward || 1)) : 1), 0);
    out.ores[mat.id] = (out.ores[mat.id] || 0) + oreN * reps;
    const killXpTotal = units.reduce((n, u) => n + killXp(wave, u.reward, { boss: !!u.boss, elite: !!u.elite }), 0);
    out.xp += (killXpTotal + clearXp(wave, c.tot.kind)) * reps;
    out.kills += c.tot.count * reps; out.waves += reps;
  };
  while (left > 0 && iter++ < 4000) {
    let c = clearTime(w, dps);
    if (push && c && !run.challenge) { if (c.t > left) break; left -= c.t; pay(w, c); w++; continue; }
    // hold: farm the best non-boss wave we can clear, for all remaining time in one step
    out.wall = push; let fw = w; if (!c || isBossWave(fw, waveOpts())) { fw = Math.max(1, w - 1); while (fw > 1 && (isBossWave(fw, waveOpts()) || !clearTime(fw, dps))) fw--; }
    c = clearTime(fw, dps); if (!c) break;
    out.farmWave = fw;
    const reps = Math.floor(left / c.t); if (reps > 0) pay(fw, c, reps); left = 0;
  }
  out.to = w; out.materials = simulateMaterials(used, out.ores); return out;
}

export function applyOffline(r) {
  const st = G.state, run = st.run;
  gain('credits', r.credits); gain('scrap', r.scrap); gain('data', r.data); gain('matter', r.matter); if (r.cores) gain('cores', r.cores); if (r.xp) grantXp(r.xp, 'offline'); applyFleetOfflineReport(r.fleet); applyFoundryReport(r.foundry); applyMaterialsReport(r.materials);
  count('kills', r.kills); count('wavesCleared', r.waves); count('offlineSeconds', Math.max(0, r.away || 0)); st.stats.offlineHours = (st.stats.offlineSeconds || 0) / 3600;
  if (r.to > run.wave) { run.wave = r.to; if (r.to > run.best) run.best = r.to; if (run.best > st.stats.bestWave) st.stats.bestWave = run.best; const s = sectorOf(run.best).idx + 1; if (s > (st.stats.bestSector || 1)) st.stats.bestSector = s; const q0 = (run.pendingChoice ? 1 : 0) + (run.choiceQueue?.length || 0); queueChoicesThrough(run.best); r.choicesQueued = Math.max(0, (run.pendingChoice ? 1 : 0) + (run.choiceQueue?.length || 0) - q0); }
  // Never move the front line backwards just because unattended farming chose an earlier safe wave.
  run.time += r.used; checkUnlocks();
}

/** Seconds away, with clock-tamper guards: negative or absurd gaps are ignored rather than rewarded. */
export function awaySeconds(now = Date.now()) {
  const last = G.state.meta.lastSeen || now, d = (now - last) / 1000;
  if (d < 0) return { s: 0, note: 'Device clock moved backwards. No offline progress granted.' };
  if (d > 86400 * 60) return { s: 86400 * 60, note: '' };
  return { s: d, note: '' };
}
