// Automation: everything here does what the player could do by hand, through the same economy functions, on a 0.5 s cadence.
// Nothing is active unless its research/rewind node is owned AND the player has switched it on in the Automation panel.
import { G, flag } from '@last-orbit/core/game.js';
import { UPGRADES } from '@last-orbit/data/upgrades.js';
import { RESEARCH } from '@last-orbit/data/research.js';
import { BOONS, ANOMALIES } from '@last-orbit/data/boons.js';
import { WEAPONS } from '@last-orbit/data/weapons.js';
import { DEF } from '@last-orbit/progression/stats.js';
import { buyUpgrade, upgradeLevel, upgradeQuote, upgradeVisible, upgradeOwnedFree, nodeStatus, nodeCost, nodeLevel, buyNode, weaponOwned, weaponQuote, levelWeapon } from '@last-orbit/progression/economy.js';
import { useAbility, abilityReady } from '@last-orbit/combat/abilities.js';
import { resolveChoice } from '@last-orbit/combat/sim.js';
import { canRewind, shardPreview, doRewind } from '@last-orbit/prestige/prestige.js';

export const REWIND_MODES = [['gain', 'Shards ≥ ×N of lifetime total'], ['wave', 'Best wave ≥ N'], ['time', 'Run longer than N minutes'], ['stuck', 'Holding for N minutes']];
let acc = 0, heldFor = 0;
export function tickAutomation(dt) {
  const st = G.state, run = st.run;
  heldFor = run.farm ? heldFor + dt : 0;
  acc += dt; if (acc < 0.5) return; acc = 0;
  const au = st.auto, w = G.world;
  if (flag('f.autoBoon') && au.boonTag !== 'ask' && run.pendingChoice) autoChoice(run.pendingChoice, au.boonTag);
  if (flag('f.autoBuy') && au.buy.on) autoBuy(au);
  if (flag('f.autoResearch') && au.research) {
    let best = null, bc = null;
    for (const d of RESEARCH) { if (nodeStatus('research', d) !== 'open') continue; const c = nodeCost(d, nodeLevel('research', d.id)); if (!bc || c.lt(bc)) { bc = c; best = d; } }
    if (best && st.cur.data.gte(bc)) buyNode('research', best.id, true);
  }
  if (flag('f.autoAbility') && w && w.wave.state === 'fighting') for (const id of st.abilities.equipped.slice(0, Math.floor(G.sheet.n('abilitySlots')))) {
    if (!id) continue; const cond = au.ability[id] || 'never';
    if (cond !== 'never' && abilityReady(w, id) && conditionMet(w, cond)) useAbility(w, id, true);
  }
  if (flag('f.autoRewind') && au.rewind.on && canRewind() && !run.challenge && run.time > au.rewind.minMinutes * 60) {
    const r = au.rewind, v = Number(r.value) || 0;
    const ok = r.mode === 'gain' ? shardPreview().gte(st.prestige.total.max(1).mul(v)) : r.mode === 'wave' ? run.best >= v : r.mode === 'time' ? run.time >= v * 60 : r.mode === 'stuck' ? heldFor >= v * 60 : false;
    if (ok) { heldFor = 0; doRewind({ auto: true }); }
  }
}
export function conditionMet(w, c) {
  let live = 0, elite = false; for (const e of w.enemies) if (e.alive && !e.def.projectile) { live++; if (e.elite) elite = true; }
  const b = w.wave.boss, boss = !!(b && b.alive && !(b.boss?.enter > 0));
  return c === 'ready' ? live > 0 : c === 'boss' ? boss : c === 'crowd' ? live >= 15 : c === 'hurt' ? w.player.hull < 0.4 : c === 'elite' ? boss || elite : false;
}
function autoChoice(pc, tag) {
  if (pc.kind === 'boon') { let i = pc.options.findIndex((id) => DEF.boons[id]?.tag === tag); if (i < 0) i = pc.options.findIndex((id) => BOONS.find((b) => b.id === id)?.rare); resolveChoice(Math.max(0, i)); }
  else { const a = ANOMALIES.find((x) => x.id === pc.id); resolveChoice(a.b.tag === tag && a.a.tag !== tag ? 1 : 0); }
}
function autoBuy(au) {
  const st = G.state, keep = 1 - Math.min(0.9, au.buy.reserve || 0);
  // 1) ordered rules: "take X to level N before anything else". A rule that cannot be afforded yet blocks the free-for-all below it.
  if (flag('f.rules')) for (const r of au.rules) {
    if (r.type === 'weapon') { if (!weaponOwned(r.id) || !WEAPONS[r.id]) continue; let g = 0; while ((st.run.weapons[r.id] || 0) < r.until && g++ < 25 && weaponQuote(r.id, 1).cost.lte(st.cur.scrap.mul(keep))) if (!levelWeapon(r.id, 1, true)) break; continue; }
    const d = DEF.upgrades[r.id]; if (!d || !upgradeVisible(d) || upgradeOwnedFree(d)) continue;
    const goal = Math.min(r.until, d.max || Infinity); let g = 0;
    while (upgradeLevel(r.id) < goal && g++ < 50 && upgradeQuote(d, 1).cost.lte(st.cur.credits.mul(keep))) if (!buyUpgrade(r.id, 1, true)) break;
    if (upgradeLevel(r.id) < goal) return;
  }
  // 2) cheapest-first inside the enabled categories (one-off systems are always taken)
  for (let pass = 0; pass < 16; pass++) {
    let best = null, bc = null;
    for (const d of UPGRADES) { if (!upgradeVisible(d) || upgradeOwnedFree(d) || upgradeLevel(d.id) >= (d.max || Infinity)) continue; if (d.cat !== 'sys' && !au.buy.cats[d.cat]) continue; const c = upgradeQuote(d, 1).cost; if (!bc || c.lt(bc)) { bc = c; best = d; } }
    if (!best || bc.gt(st.cur.credits.mul(keep))) break; buyUpgrade(best.id, 1, true);
  }
}
