// Serialized contextual onboarding. Briefing copy is presented by the UI as a blocking modal;
// after acknowledgement, lightweight highlights point at the real controls without stealing input.
// Completion lives above run/prestige state so Rewinds cannot replay lessons already learned.
import { G, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { newOnboarding } from '@last-orbit/core/state.js';
import { BAL } from '@last-orbit/data/balance.js';

const ack = (o, key) => !!o.acknowledged?.[key];
const brief = (key, kicker, title, text, hint, okLabel = 'Continue', action = null) => ({ key, kicker, title, text, hint, okLabel, ...(action ? { action } : {}) });

const STEPS = [
  {
    id: 'controls', gate: () => true,
    complete: (s, o) => o.flags.move && o.flags.fire,
    briefing: (s, o) => !ack(o, 'controls') ? brief('controls', 'Command briefing', 'Hold the line', 'Drag or use A/D to steer the ship. Hold fire to destroy the incoming formation.', 'Push advances after a clear. Hold repeats a cleared wave when you want to farm safely.', 'Begin') : null,
    view: (s, o) => ack(o, 'controls') ? ({ kicker: 'Command objective', title: 'Hold the line', text: `${o.flags.move ? '✓' : '○'} Move   ${o.flags.fire ? '✓' : '○'} Fire`, hint: 'Move and fire once to complete basic controls.' }) : null,
  },
  {
    id: 'upgrade', gate: (s, o, ctx) => ctx.panel === 'upgrades' || (s.stats.bestWave || 1) >= 2 || (s.run.wave || 1) >= 2,
    complete: (s, o) => {
      const bought = o.flags.upgrade || Object.values(s.run.upgrades || {}).some((v) => Number(v) > 0);
      if (!ack(o, 'upgrade-scale') || !bought) return false;
      return ack(o, 'upgrade-pick') || ack(o, 'upgrade-already');
    },
    briefing: (s, o, ctx) => {
      const bought = o.flags.upgrade || Object.values(s.run.upgrades || {}).some((v) => Number(v) > 0);
      if (!ack(o, 'upgrade-scale')) {
        const early = (s.run.wave || 1) < 2 && (s.stats.bestWave || 1) < 2;
        return brief('upgrade-scale', early ? 'Prepare for Wave 2' : 'Wave 2 · Hostiles adapting', 'Each wave gets stronger', 'Enemy hull and damage increase as the front line advances. Your ship must improve alongside them.', ctx.panel === 'upgrades' ? 'You opened Upgrades early, so we can prepare now. After this briefing I’ll point out a strong first purchase.' : 'Open Upgrades after this briefing. The control will be highlighted for you.', 'Show me', { panel: 'upgrades' });
      }
      if (bought && !ack(o, 'upgrade-pick') && !ack(o, 'upgrade-already')) return brief('upgrade-already', 'Ship improvement', 'First upgrade already installed', 'You have already strengthened the ship, so there is nothing to repurchase.', 'Future waves continue scaling upward. This lesson is now counted as complete and the next combat concept can continue.', 'Continue');
      if (ctx.panel === 'upgrades' && !ack(o, 'upgrade-pick')) return brief('upgrade-pick', 'First upgrade', 'Strengthen the ship', 'Weapon Damage is a strong first purchase because every cannon hit benefits immediately.', 'You can buy a different affordable upgrade if you prefer — any first purchase completes this lesson.', 'Show upgrade');
      return null;
    },
    view: (s, o, ctx) => {
      if (!ack(o, 'upgrade-scale')) return null;
      if (ctx.panel === 'upgrades') {
        if (!ack(o, 'upgrade-pick')) return null;
        return { kicker: 'First upgrade', title: 'Buy your first upgrade', text: 'Weapon Damage is highlighted as the recommended first purchase.', hint: 'Any upgrade purchase completes this lesson.', targetUpgrade: 'dmg', spotlight: true };
      }
      return { kicker: 'Ship improvement', title: 'Open Upgrades', text: 'Spend Credits to keep pace with stronger waves.', hint: 'Open the highlighted Upgrades control.', targetNav: 'upgrades', spotlight: true };
    },
  },
  {
    id: 'streak', gate: (s, o) => (s.stats.kills || 0) >= 2 || !!o.flags.streakSeen,
    complete: (s, o) => ack(o, 'streak'),
    briefing: (s, o) => !ack(o, 'streak') ? brief('streak', 'Combat rhythm', 'Kill streak established', `Destroy enemies within ${BAL.comboWindow.toFixed(1)} seconds of one another to build Streak. Each stack increases the Credits paid by subsequent kills.`, 'If the kill gap gets too long, Streak begins to decay. The amber multiplier near your hull display shows Streak together with any active Focus bonus.', 'Got it') : null,
  },
  {
    id: 'xp', gate: (s, o) => !!o.flags.xpSeen,
    complete: (s, o) => ack(o, 'xp'),
    briefing: (s, o) => !ack(o, 'xp') ? brief('xp', 'Ship proficiency', 'Ship Level increased', 'Combat now earns Ship XP. Higher waves and more dangerous enemies award more XP, while each successive level requires progressively more.', 'Ship Levels reset on Rewind. Each level above 1 currently grants +0.8% damage and +0.5% hull for that run.', 'Understood') : null,
  },
  {
    id: 'smelter', gate: (s) => !!s.materials.discovered,
    complete: (s, o) => o.flags.smelter || !!s.materials.smelter,
    briefing: (s, o) => !ack(o, 'smelter') ? brief('smelter', 'Recovered material', 'Iron Ore recovered', 'Destroyed ships are dropping usable material. Raw Ore becomes much more valuable once you can refine it.', 'Build the Basic Smelter from Menu → Smelting when you have the required Credits and Iron Ore.', 'Show me', { panel: 'menu', screen: 'materials' }) : null,
    view: (s, o) => ack(o, 'smelter') ? ({ kicker: 'Recovered material', title: 'Build the Basic Smelter', text: 'Open Menu → Smelting and construct the Basic Smelter.', hint: 'Materials persist through Rewinds.', targetNav: 'menu', targetMenu: 'materials' }) : null,
  },
  {
    id: 'focus', gate: (s) => (s.stats.kills || 0) > 0,
    complete: (s, o) => o.flags.focus,
    briefing: (s, o) => !ack(o, 'focus') ? brief('focus', 'Active piloting', 'Manual control builds Focus', 'Steering the ship yourself builds Focus during combat.', 'Focus increases both damage and Credit income. It decays when you stop actively piloting.', 'Continue') : null,
    view: (s, o) => ack(o, 'focus') ? ({ kicker: 'Active piloting', title: 'Build Focus', text: 'Keep steering manually until the Focus bonus appears.', hint: 'The multiplier is shown near your hull display.' }) : null,
  },
  {
    id: 'paint', gate: (s) => (s.stats.bestWave || 1) >= 2,
    complete: (s, o) => o.flags.paint,
    briefing: (s, o) => !ack(o, 'paint') ? brief('paint', 'Target priority', 'Paint dangerous targets', 'A quick tap on an enemy marks it as the priority target.', 'Painting is especially useful for support ships and exposed boss weak points.', 'Continue') : null,
    view: (s, o) => ack(o, 'paint') ? ({ kicker: 'Target priority', title: 'Paint a target', text: 'Tap or click an enemy once to mark it.', hint: 'The targeting mark is temporary.' }) : null,
  },
  {
    id: 'arsenal', gate: (s) => !!s.unlocks.arsenal,
    complete: (s, o) => o.flags.weapon,
    briefing: (s, o) => !ack(o, 'arsenal') ? brief('arsenal', 'System online', 'Arsenal unlocked', 'Scrap recovered from combat can now improve and evolve weapons.', 'Open Arsenal and level one weapon with Scrap.', 'Show Arsenal', { panel: 'arsenal' }) : null,
    view: (s, o) => ack(o, 'arsenal') ? ({ kicker: 'System online', title: 'Use the Arsenal', text: 'Open Arsenal and level a weapon with Scrap.', hint: 'Weapon levels and evolutions use Scrap instead of Credits.', targetNav: 'arsenal' }) : null,
  },
  {
    id: 'ability', gate: (s) => !!s.unlocks.abilities,
    complete: (s, o) => ack(o, 'ability-energy') && o.flags.ability,
    briefing: (s, o) => !ack(o, 'ability-energy') ? brief('ability-energy', 'Reactor reserve online', 'Energy powers sustained abilities', 'Energy is a regenerating combat reserve shown beneath your hull. It starts at 50/100, regenerates automatically, and grazing enemy fire restores extra Energy.', 'Overdrive doubles fire rate. While Energy is available it uses up to 10 Energy per second to make its duration drain 50% slower. At 0 Energy, Overdrive does not shut off — it simply continues at its normal remaining duration until Energy returns.', 'Understood') : null,
    view: (s, o) => ack(o, 'ability-energy') ? ({ kicker: 'System online', title: 'Trigger Overdrive', text: 'Use Overdrive and watch the Energy reserve feed its extended duration.', hint: 'The ability control is highlighted. Energy regenerates automatically.', target: 'ability' }) : null,
  },
  {
    id: 'skills', gate: (s) => !!s.unlocks.skills,
    complete: (s, o) => o.flags.skill || Object.values(s.run.skills || {}).some(rank => Number(rank) > 0),
    briefing: (s, o) => !ack(o, 'skills') ? brief('skills', 'Ship proficiency', 'Skill tree online', 'Every second Ship Level, starting at Level 3, grants a Skill Point. Spend points on small run perks across Offence, Defence and Utility.', 'Try a first rank now. Vital Siphon later adds lifesteal. Skill ranks and points reset on Rewind.', 'Show Skills', { panel: 'skills' }) : null,
    view: (s, o) => ack(o, 'skills') ? ({ kicker: 'Ship proficiency', title: 'Spend a Skill Point', text: 'Open Skills and buy any available perk.', hint: 'Branch prerequisites unlock stronger perks. You can respec freely during this run.', targetNav: 'skills' }) : null,
  },
  {
    id: 'research', gate: (s) => !!s.unlocks.research,
    complete: (s, o) => o.flags.research,
    briefing: (s, o) => !ack(o, 'research') ? brief('research', 'System online', 'Research Lab online', 'Research Data can now unlock new mechanics, automation and build options for this timeline.', 'Open Research and purchase one node.', 'Show Research', { panel: 'research' }) : null,
    view: (s, o) => ack(o, 'research') ? ({ kicker: 'System online', title: 'Start Research', text: 'Open Research and purchase one node with Data.', hint: 'Research belongs to the current timeline.', targetNav: 'research' }) : null,
  },
  {
    id: 'fleet', gate: (s) => !!s.unlocks.fleet,
    complete: (s, o) => o.flags.fleet,
    briefing: (s, o) => !ack(o, 'fleet') ? brief('fleet', 'Parallel operation', 'Recovery Fleet commissioned', 'The Fleet operates alongside combat and can keep producing while you are away.', 'Open Menu → Recovery Fleet and purchase a Fleet upgrade.', 'Continue') : null,
    view: (s, o) => ack(o, 'fleet') ? ({ kicker: 'Parallel operation', title: 'Improve the Recovery Fleet', text: 'Open Menu → Recovery Fleet and purchase a Fleet upgrade.', hint: 'Fleet progress survives Rewinds and Ascension.', targetNav: 'menu', targetMenu: 'fleet' }) : null,
  },
  {
    id: 'drones', gate: (s) => !!s.unlocks.drones,
    complete: (s, o) => o.flags.drone,
    briefing: (s, o) => !ack(o, 'drones') ? brief('drones', 'Autonomous support online', 'Drone bays unlocked', 'Drones are not a separate bottom-menu system: they are managed inside Arsenal → Drones. Each researched Drone Bay is a slot you can fill with an autonomous support craft.', 'The first Arsenal visit after this unlock opens directly on Drones. Use +/− to deploy drones into bays; Scrap levels up each drone type.', 'Show Drones', { panel: 'arsenal', screen: 'drones' }) : null,
    view: (s, o) => ack(o, 'drones') ? ({ kicker: 'Autonomous support', title: 'Open Arsenal → Drones', text: 'Your new Drone Bays are waiting inside the Arsenal.', hint: 'The Arsenal control is highlighted until you visit the Drones tab.', targetNav: 'arsenal' }) : null,
  },
  {
    id: 'foundry', gate: (s) => !!s.unlocks.foundry,
    complete: (s, o) => o.flags.foundry,
    briefing: (s, o) => !ack(o, 'foundry') ? brief('foundry', 'Tactical reserve', 'Orbital Foundry commissioned', 'The Foundry manufactures tactical supplies that can be deployed during combat.', 'Use the Supply control or open Menu → Orbital Foundry to improve production.', 'Continue') : null,
    view: (s, o) => ack(o, 'foundry') ? ({ kicker: 'Tactical reserve', title: 'Use the Foundry', text: 'Deploy your free Overclock cell with the Supply button, or buy a Foundry upgrade.', hint: 'Blueprints improve production and permanent ship power.', targetNav: 'menu', targetMenu: 'foundry' }) : null,
  },
  {
    id: 'rewind', gate: (s) => (s.stats.bestWave || 1) >= 20,
    complete: (s, o) => o.flags.rewind,
    briefing: (s, o) => !ack(o, 'rewind') ? brief('rewind', 'Chrono Core', 'Timeline recovery detected', 'Rewind will eventually trade run depth for permanent Chrono Shards.', 'Ship XP resets with the run, while permanent systems and currencies keep their documented persistence.', 'Continue') : null,
    view: (s, o) => !ack(o, 'rewind') ? null : (s.run.best || 1) < 30
      ? ({ kicker: 'Chrono Core', title: 'Push to wave 30', text: `First Rewind access unlocks at wave 30. Current best: ${s.run.best || 1}.`, hint: 'When progress slows, Rewind converts run depth into permanent Chrono Shards.', targetNav: 'rewind' })
      : ({ kicker: 'Chrono Core ready', title: 'Perform your first Rewind', text: 'Open Rewind and reset the timeline for permanent Chrono Shards.', hint: 'A Rewind is progression, not failure: the next timeline starts stronger and reaches old ground faster.', targetNav: 'rewind' }),
  },
];

function data() { return G.state?.onboarding; }
function current(ctx = {}) {
  const s = G.state, o = data(); if (!s || !o || !o.enabled || o.completed) return null;
  if (G.world?.player?.focus >= 0.08) o.flags.focus = true;
  let guard = 0;
  while (o.step < STEPS.length && guard++ < STEPS.length + 1) {
    const step = STEPS[o.step];
    // Completion is checked before visibility/gating. Lessons are persistent above the run, so an
    // action already performed must never become impossible to advance merely because its unlock
    // condition or panel context is no longer active (for example, buying in an early intermission
    // and then closing Upgrades before Wave 2 begins).
    if (step.complete(s, o, ctx)) { o.done[step.id] = 1; o.step++; continue; }
    if (!step.gate(s, o, ctx)) return null;
    return step;
  }
  if (o.step >= STEPS.length && !o.completed) {
    o.completed = true; o.enabled = false;
    toast('Command briefing complete. Help remains available in the Menu.', 'good');
    bus.emit('onboardingComplete');
  }
  return null;
}

/** Mark an observed action. Safe to call even when onboarding is disabled. */
export function noteOnboarding(action) {
  const o = data(); if (!o || !o.enabled || o.completed) return;
  if (action in o.flags) { o.flags[action] = true; bus.emit('onboarding'); }
}

/** Advance across actions already performed. Returns the current non-blocking guidance, if any. */
export function syncOnboarding(ctx = {}) {
  const step = current(ctx); if (!step) return null;
  return step.view?.(G.state, data(), ctx) || null;
}

/** Blocking briefing to show next. UI only asks for this when no other modal is open. */
export function onboardingBriefing(ctx = {}) {
  const step = current(ctx); if (!step) return null;
  return step.briefing?.(G.state, data(), ctx) || null;
}

export function acknowledgeOnboarding(key) {
  const o = data(); if (!o || !key) return;
  o.acknowledged ||= {}; o.acknowledged[key] = true;
  if (key === 'ability-energy') (G.state.seen ||= {}).energyBriefingV1 = 1;
  bus.emit('onboarding');
}

export function onboardingObjective(ctx = {}) {
  const o = data(); if (!o || !o.enabled || o.completed) return null;
  const view = syncOnboarding(ctx); if (!view) return null;
  const step = STEPS[o.step];
  return { id: step.id, index: o.step + 1, total: STEPS.length, ...view };
}

export function onboardingStatus() {
  const o = data();
  if (!o) return { enabled: false, completed: false, step: 0, total: STEPS.length };
  return { enabled: !!o.enabled, completed: !!o.completed, step: Math.min(o.step || 0, STEPS.length), total: STEPS.length };
}

/**
 * The guided first-upgrade purchase is interactive, but it is still part of the blocking tutorial.
 * Once the scaling briefing has been acknowledged, freeze every simulation clock until the player
 * actually buys an upgrade. The navigation/purchase controls stay live because this is not a modal.
 */
export function onboardingFreezesAll() {
  const s = G.state, o = data();
  if (!s || !o || !o.enabled || o.completed) return false;
  const step = STEPS[o.step];
  if (step?.id !== 'upgrade' || !ack(o, 'upgrade-scale')) return false;
  const bought = o.flags.upgrade || Object.values(s.run.upgrades || {}).some((v) => Number(v) > 0);
  return !bought;
}

export function replayOnboarding() {
  G.state.onboarding = newOnboarding();
  toast('Command briefing restarted.', 'info');
  bus.emit('onboarding');
}

export function skipOnboarding() {
  const o = data(); if (!o) return;
  o.enabled = false; o.completed = true; o.step = STEPS.length;
  toast('Command briefing skipped. You can replay it from Help.', 'info');
  bus.emit('onboarding');
}

bus.on('bought', (kind) => {
  if (kind === 'upgrade') noteOnboarding('upgrade');
  else if (kind === 'materials') noteOnboarding('smelter');
  else if (kind === 'weapon') noteOnboarding('weapon');
  else if (kind === 'research') noteOnboarding('research');
  else if (kind === 'skill') noteOnboarding('skill');
  else if (kind === 'fleet') noteOnboarding('fleet');
  else if (kind === 'foundry') noteOnboarding('foundry');
});
bus.on('streakActive', () => noteOnboarding('streakSeen'));
bus.on('levelUp', () => noteOnboarding('xpSeen'));
bus.on('supplyUsed', () => noteOnboarding('foundry'));
bus.on('abilityUsed', (id, auto) => { if (!auto) noteOnboarding('ability'); });
bus.on('droneTabOpened', () => noteOnboarding('drone'));
bus.on('targetPainted', () => noteOnboarding('paint'));
bus.on('rewind', (shards, auto) => { if (!auto) noteOnboarding('rewind'); });
