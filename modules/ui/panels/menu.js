// Menu: everything that is not a core tab. Sub-screens appear as their systems unlock.
import { G, toast } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { fmt, fmtTime, fmtInt, setNotation } from '@last-orbit/core/format.js';
import { Big } from '@last-orbit/core/big.js';
import { CUR } from '@last-orbit/core/state.js';
import { UPGRADES } from '@last-orbit/data/upgrades.js';
import { WEAPONS, WEAPON_ORDER } from '@last-orbit/data/weapons.js';
import { CHALLENGES, ACHIEVEMENTS } from '@last-orbit/data/goals.js';
import { BOON_TAGS } from '@last-orbit/data/boons.js';
import { DEF } from '@last-orbit/progression/stats.js';
import { missionDef, missionProgress, missionRewardText, claimMission, missionsReady, achievementCount } from '@last-orbit/meta/goals.js';
import { startChallenge, abandonChallenge } from '@last-orbit/prestige/prestige.js';
import { REWIND_MODES } from '@last-orbit/automation/automation.js';
import { estimateDps } from '@last-orbit/offline/offline.js';
import { applyVolumes, playSfx } from '@last-orbit/audio/audio.js';
import { h, clear, field, toggle, select, slider, setClass } from '@last-orbit/ui/dom.js';
import { confirmDialog, showBreakdown, showSaveTools } from '@last-orbit/ui/modals.js';
import { treeView, treeAffordable } from '@last-orbit/ui/panels/tree.js';
import { intelScreen } from '@last-orbit/ui/panels/intel.js';
import { foundryScreen } from '@last-orbit/ui/panels/foundry.js';
import { foundryAffordable } from '@last-orbit/progression/foundry.js';
import { fleetScreen, fleetSignature } from '@last-orbit/ui/panels/fleet.js';
import { fleetAffordable, fleetRate } from '@last-orbit/progression/fleet.js';
import { onboardingObjective, onboardingStatus, replayOnboarding, skipOnboarding } from '@last-orbit/meta/onboarding.js';
import { materialsScreen } from '@last-orbit/ui/panels/materials.js';
import { materialsAffordable, materialsSignature, selectedMaterial, materialDef } from '@last-orbit/progression/materials.js';
import { MATERIAL_TIERS } from '@last-orbit/data/materials.js';
import { PROJECTS } from '@last-orbit/data/projects.js';
import { projectRevealed, projectComplete, projectCanBuild, projectCostText, buildProject, projectsAttention } from '@last-orbit/progression/projects.js';

export const VERSION = '1.22.0';
export function menuPanel(hooks) {
  let screen = 'home', sig = '', foundryView = null, materialsView = null; const root = h('div'), st = () => G.state;
  const relics = treeView('relics', [['all', 'Relics · permanent']], () => 'all'), alien = treeView('alien', [['all', 'Xeno laboratory']], () => 'all');
  const go = (s) => { screen = s; sig = ''; playSfx('tab'); update(); root.parentNode && (root.parentNode.scrollTop = 0); };
  const back = (title) => h('div.row', { style: 'margin-bottom:8px' }, h('button.btn.sm', { onclick: () => go('home') }, '‹ Menu'), h('span', { style: 'font:700 13px var(--disp);letter-spacing:.1em;text-transform:uppercase;color:var(--amber)' }, title));
  const offMissions = bus.on('missions', () => { sig = ''; });
  const offFoundry = bus.on('bought', (kind) => { if (kind === 'foundry') sig = ''; });
  const offFleet = bus.on('fleet', () => { sig = ''; });
  const offMaterials = bus.on('materials', () => { sig = ''; });

  const screens = {
    home() {
      const u = st().unlocks, ob = onboardingStatus(), guide = onboardingObjective(), items = [['missions', 'Missions', 'Rotating objectives', u.missions, missionsReady() > 0], ['materials', 'Smelting', (() => { const m = st().materials, sel = selectedMaterial(); if ((m.readyBars || 0) > 0) { const r = materialDef(m.readyMaterial || sel.id); return `${r.name} Bar ready to collect`; } return `${sel.name}: ${fmt(st().cur[sel.oreCur])} Ore · ${fmt(st().cur[sel.barCur])} Bars`; })(), st().materials.discovered, st().materials.discovered && materialsAffordable()], ['fleet', 'Recovery Fleet', `▣ ${fmt(st().fleet.supply)}  ·  +${fmt(fleetRate(), 2)}/s`, u.fleet, u.fleet && fleetAffordable()], ['foundry', 'Orbital Foundry', 'Manufacture tactical supplies', u.foundry, u.foundry && foundryAffordable()], ['challenges', 'Challenges', 'Rule-bending runs', u.challenges], ['ach', 'Achievements', `${achievementCount()}/${ACHIEVEMENTS.length} earned`, true], ['intel', 'Intel', 'Bestiary: what you have fought', true], ['stats', 'Statistics', 'Lifetime and this run', true], ['projects', 'Ship Projects', 'Build newly discovered systems', PROJECTS.some(projectRevealed), projectsAttention()], ['systems', 'Ship Systems', 'Online and upcoming systems', true],
        ['relics', 'Relics', 'Permanent artefacts', u.relics, treeAffordable('relics')], ['alien', 'Alien tech', 'Xeno laboratory', u.alien, treeAffordable('alien')], ['auto', 'Automation', 'Rules and standing orders', u.automation], ['help', 'Help', ob.enabled ? `Command briefing ${ob.step + 1}/${ob.total}` : 'Controls and game systems', true], ['settings', 'Settings', 'Audio, display, save data', true]];
      const grid = h('div.menu-grid'); for (const [id, name, sub, open, pip] of items) if (open) grid.append(h('button.mbtn' + (pip ? '.can' : '') + (guide?.targetMenu === id ? '.guide' : ''), { onclick: () => go(id) }, h('b', name), h('span', sub), h('span.pip'))); root.append(grid);
      root.append(h('p.note', { style: 'margin-top:10px' }, 'The main navigation stays focused on systems you can actually use. Open Ship Systems to preview what comes next without cluttering the combat HUD.'));
    },
    materials() { materialsView = materialsScreen(root, back); },
    foundry() { foundryView = foundryScreen(root, back); },
    fleet() { fleetScreen(root, back); },
    missions() { root.append(back('Missions')); const ms = st().missions;
      for (const m of ms.active) { const d = missionDef(m), p = missionProgress(m), done = p >= m.n; root.append(h('div.card' + (done ? '.can' : ''), h('div.c-name', d.text.replace('{n}', fmtInt(m.n))), h('button.buy' + (done ? '.can' : ''), { disabled: !done, onclick: () => { if (claimMission(m.seq)) { playSfx('milestone'); sig = ''; update(); } } }, h('span', done ? 'Claim' : `${fmtInt(p)}/${fmtInt(m.n)}`)), h('div.c-desc', 'Reward: ' + missionRewardText(m)), h('div.c-ms', h('div.gauge', h('i', { style: `width:${(p / m.n * 100).toFixed(1)}%` }))))); }
      if (!ms.active.length) root.append(h('p.note', 'New missions arrive shortly.')); root.append(h('p.note', `Completed: ${ms.done}. Missions never expire and never cost anything.`)); },
    challenges() { root.append(back('Challenges')); const s = st(), active = s.run.challenge;
      root.append(h('p.note', 'A challenge is a fresh run from wave 1 under special rules. Reach the goal wave to bank a permanent reward. Starting one performs a rewind (you keep any shards earned).'));
      for (const c of CHALLENGES) { const done = s.challenges.done[c.id], locked = s.prestige.count < c.rewinds, on = active === c.id;
        root.append(h('div.card' + (done ? '.maxed' : on ? '.can' : locked ? '.locked' : ''), h('div.c-name', c.name, h('b', done ? 'DONE' : on ? `WAVE ${s.run.best}/${c.goal}` : 'GOAL ' + c.goal)),
          done ? h('div') : on ? h('button.btn.sm.danger', { onclick: () => confirmDialog('Abandon challenge', 'End this challenge run and start a normal one?', 'Abandon', () => { abandonChallenge(); sig = ''; }, true) }, 'Abandon') : h('button.btn.sm', { disabled: locked || !!active, onclick: () => confirmDialog(c.name, c.rules + ' Reach wave ' + c.goal + '. Your current run ends now.', 'Begin', () => { bus.emit('rewindFx'); setTimeout(() => { startChallenge(c.id); sig = ''; }, 650); }) }, locked ? `${c.rewinds} rewinds` : 'Begin'),
          h('div.c-desc', c.rules), h('div.c-val', { style: 'color:var(--amber2)' }, 'Reward: ' + c.reward.text))); } if (s.run.failed) root.append(h('p.note', { style: 'color:var(--red)' }, 'This attempt has failed. Abandon or rewind to try again.')); },
    ach() { root.append(back(`Achievements ${achievementCount()}/${ACHIEVEMENTS.length}`)); root.append(h('p.note', 'Each one gives a small permanent bonus.')); const s = st();
      for (const a of ACHIEVEMENTS.slice().sort((x, y) => (s.ach[y.id] ? 1 : 0) - (s.ach[x.id] ? 1 : 0))) { const done = s.ach[a.id], hid = a.hidden && !done; root.append(h('div.ach' + (done ? '.done' : ''), h('i', done ? '★' : '☆'), h('div', hid ? '???' : a.name, h('small', hid ? 'Hidden achievement' : a.desc)))); } },
    projects() {
      root.append(back('Ship Projects'), h('p.note', 'Reaching a milestone now reveals technology instead of granting it for free. Recover materials, then commission the system when you are ready.'));
      const visible = PROJECTS.filter(projectRevealed).sort((a, b) => (a.id === 'passage' ? -1 : b.id === 'passage' ? 1 : 0));
      for (const p of visible) { const done = projectComplete(p.id), can = projectCanBuild(p);
        if (p.id === 'passage') {
          const s = st(), costs = p.costs.map(([cur, need]) => ({ cur, need, have: Math.min(need, s.cur[cur].toNumber()), name: CUR[cur]?.name || cur }));
          root.append(h('section.passage-project' + (can ? '.ready' : ''),
            h('div.passage-sky', h('span.passage-world.origin', 'OUTER ORBIT'), h('span.passage-line', '· · · · · · ·'), h('span.passage-world.destination', 'LUNAR GRAVEYARD')),
            h('div.passage-title', h('span', '◇  LUNAR PASSAGE'), h('b', done ? 'ROUTE OPEN' : s.projects.passageBossCleared ? 'BOSS DEFEATED' : 'SECTOR GATE')),
            h('p', p.desc),
            h('div.passage-costs', ...costs.map(({ cur, need, have, name }) => h('div.passage-resource' + (have >= need ? '.complete' : ''), h('span', name), h('b', `${fmt(have)} / ${need}`), h('i', { style: `width:${Math.min(100, have / need * 100)}%` })) )),
            h('div.passage-actions', done ? h('span', 'Transit beacon online · survives Rewind') : h('button.btn.pri', { disabled: !can, onclick: () => { if (buildProject(p.id)) { playSfx('milestone'); sig = ''; update(); } else playSfx('deny'); } }, can ? 'Power the passage' : 'Gather resources'), !done ? h('button.btn.sm', { onclick: () => go('materials') }, 'Choose ore in Smelting') : null),
            !done ? h('small', 'Iridium begins at Wave 30 and Palladium at Wave 35. Hold a cleared wave and select either in Smelting to farm it. Defeat the sector boss to open the route.') : null));
          continue;
        }
        root.append(h('div.card' + (done ? '.maxed' : can ? '.can' : ''), h('div.c-name', p.name, h('b', done ? 'ONLINE' : `WAVE ${p.wave}`)), done ? h('div') : h('button.buy' + (can ? '.can' : ''), { disabled: !can, onclick: () => { if (buildProject(p.id)) { playSfx('milestone'); sig=''; update(); } else playSfx('deny'); } }, can ? 'Commission' : 'Gather'), h('div.c-desc', p.desc), h('div.c-val', done ? 'Construction complete' : projectCostText(p)))); }
      if (!visible.length) root.append(h('p.note', 'No major ship projects discovered yet. Push deeper to find new technology.'));
    },
    systems() {
      root.append(back('Ship Systems'), h('p.note', 'Normal navigation only reveals systems once they are usable. This overview shows the broader ship roadmap so new unlocks feel anticipated rather than unexplained.'));
      const s = st(), u = s.unlocks, online = (id) => !id || !!u[id];
      const rows = [
        ['Upgrades', 'Spend Credits on immediate ship improvements.', true, 'Online from Wave 1'],
        ['Smelting', 'Process a growing ladder of recovered ores into collected bars, then automate the industry later.', !!s.materials.discovered, 'Discover Iron Ore on Wave 1'],
        ['Arsenal', 'Develop weapons with Scrap and manage combat loadouts.', online('arsenal'), 'Unlocks at Wave 5'],
        ['Skill Tree', 'Spend Ship Level points on run perks, including lifesteal.', online('skills'), 'Unlocks at Wave 8'],
        ['Research Lab', 'Spend Research Data to unlock new mechanics and automation.', online('research'), 'Unlocks at Wave 12'],
        ['Recovery Fleet', 'Persistent autonomous salvage and long-term support protocols.', online('fleet'), projectRevealed(PROJECTS[0]) ? 'Blueprint discovered · construct in Ship Projects' : 'Blueprint at Wave 10'],
        ['Orbital Foundry', 'Manufacture tactical supplies and permanent ship calibration.', online('foundry'), projectRevealed(PROJECTS[1]) ? 'Blueprint discovered · construct in Ship Projects' : 'Blueprint at Wave 20'],
        ['Lunar Passage', 'Mine Palladium and smelt Iridium to chart the next sector.', projectComplete('passage'), projectRevealed(PROJECTS[2]) ? 'Route charted · construct in Ship Projects' : 'Blueprint at Wave 30'],
        ['Ship Loadout', 'See and fit all equipped weapons, modules, drones, abilities and support gear in one place.', online('arsenal'), 'Unlock the Arsenal'],
        ['Chrono Rewind', 'Reset the timeline for permanent Chrono Shards and push farther.', online('rewind') && s.stats.bestWave >= 30, 'Available from Wave 30'],
        ['Challenge Runs', 'Fresh timelines with special rules and permanent rewards.', online('challenges'), 'Unlocks after 2 Rewinds'],
        [u.alien || (s.stats.bestSector || 1) >= 3 ? 'Alien Tech' : 'Unknown Signal', u.alien || (s.stats.bestSector || 1) >= 3 ? 'A xeno laboratory powered by Alien Matter.' : 'A deeper-sector system is not yet identified.', online('alien'), u.alien ? 'Online' : 'Reach deeper sectors'],
        [u.ascension || s.prestige.count > 0 ? 'Beyond the Timeline' : '???', u.ascension ? 'Ascension converts extreme timeline progress into Stellar Sigils.' : 'Something exists above the Chrono layer, but its signal is incomplete.', online('ascension'), u.ascension ? 'Online' : 'Develop the Chrono layer'],
      ];
      const n = rows.filter((r) => r[2]).length; root.append(h('div.system-summary', h('b', `${n}/${rows.length} systems online`), h('span', `Best Wave ${fmtInt(s.stats.bestWave || 1)}`)));
      for (const [name, desc, isOnline, gate] of rows) root.append(h('div.system-card' + (isOnline ? '.online' : '.locked'), h('div.system-state', isOnline ? 'ONLINE' : 'LOCKED'), h('div.system-copy', h('b', name), h('span', desc)), h('small', isOnline ? 'Operational' : gate)));
      root.append(h('p.note', 'Later systems deliberately remain partly mysterious until you are close enough to discover what they are.'));
    },
    intel() { intelScreen(root, back); },
    stats() { root.append(back('Statistics')); const s = st(), S = s.stats, R = s.run.stats, w = G.world, kv = (k, v) => root.append(h('div.kv', k, h('b', v)));
      root.append(h('div.sec-h', 'Right now')); kv('Damage per second (live)', fmt(w.dps)); const est = estimateDps(); kv('Damage per second (model)', fmt(est.total)); kv('Credits per second', fmt(w.income)); kv('Run time', fmtTime(s.run.time));
      root.append(h('div.sec-h', 'Build'), h('div.row', ...['damage', 'fireRate', 'critChance', 'critDmg', 'hull', 'creditGain', 'shardGain', 'offlineEff'].map((k) => h('button.btn.sm', { onclick: () => showBreakdown(k) }, k.replace(/([A-Z])/g, ' $1').toLowerCase()))), h('p.note', 'Tap a stat to see exactly where it comes from.'));
      root.append(h('div.sec-h', 'Lifetime')); kv('Play time', fmtTime(s.meta.playTime)); kv('Best wave', fmtInt(S.bestWave)); kv('Deepest sector', fmtInt(S.bestSector || 1)); kv('Enemies destroyed', fmt(S.kills || 0)); kv('Bosses defeated', fmtInt(S.bossKills || 0)); kv('Elites destroyed', fmtInt(S.eliteKills || 0)); kv('Total damage', fmt(S.damage || 0)); kv('Credits earned', fmt(S.earned?.credits || 0)); if (s.materials.discovered) { kv('Total ore recovered', fmt(s.materials.lifetimeOre || 0)); kv('Total bars collected', fmt(s.materials.lifetimeBars || 0)); const seen = MATERIAL_TIERS.filter((m) => s.materials.discoveredOres?.[m.id]); if (seen.length) kv('Materials discovered', `${seen.length}/${MATERIAL_TIERS.length} · ${seen.map((m) => m.name).join(', ')}`); } kv('Scrap earned', fmt(S.earned?.scrap || 0)); kv('Critical hits', fmt(S.crits || 0)); kv('Weak point hits', fmt(S.weakHits || 0)); kv('Shots grazed', fmtInt(S.grazes || 0)); kv('Abilities used', fmtInt(S.abilitiesUsed || 0)); kv('Flawless waves', fmtInt(S.flawless || 0)); kv('Ships lost', fmtInt(S.deaths || 0)); kv('Rewinds', fmtInt(s.prestige.count)); kv('Ascensions', fmtInt(s.asc.count)); kv('Fastest boss kill', S.fastestBoss ? S.fastestBoss + 's' : '–'); kv('Time offline', fmtTime(S.offlineSeconds || 0)); kv('Missions completed', fmtInt(s.missions.done)); if (s.unlocks.fleet) { kv('Fleet Supplies recovered', fmt(s.fleet.lifetime)); kv('Fleet Supplies spent', fmt(s.fleet.spent)); }
      const by = S.dmgBy || {}, ids = Object.keys(by).sort((a, b) => Big.from(by[b]).cmp(Big.from(by[a]))); if (ids.length) { root.append(h('div.sec-h', 'Damage by source')); const tot = Big.from(S.damage || 1); for (const id of ids.slice(0, 10)) kv(WEAPONS[id]?.name || id[0].toUpperCase() + id.slice(1), `${fmt(by[id])}  ·  ${(Big.from(by[id]).ratio(tot) * 100).toFixed(1)}%`); }
      root.append(h('div.sec-h', 'This run')); kv('Kills', fmt(R.kills || 0)); kv('Waves cleared', fmtInt(R.wavesCleared || 0)); kv('Boons taken', fmtInt(R.boons || 0)); const bo = Object.keys(s.run.boons); if (bo.length) root.append(h('p.note', 'Boons: ' + bo.map((id) => DEF.boons[id].name + (s.run.boons[id] > 1 ? ' ×' + s.run.boons[id] : '')).join(', '))); if (s.run.picks.length) root.append(h('p.note', 'Anomalies: ' + s.run.picks.map((p) => p.label).join(', '))); },
    relics() { root.append(back('Relics')); root.append(h('p.note', 'Relic Fragments come from missions, anomalies and sector bosses. Relics survive rewinds and ascension.'), relics.el); },
    alien() { root.append(back('Alien tech')); root.append(h('p.note', 'Alien Matter drops from Machine Territory onward. Alien tech survives rewinds.'), alien.el); },
    help() {
      root.append(back('Help'));
      const ob = onboardingStatus();
      const actions = h('div.row', { style: 'grid-column:1/-1;margin-top:6px' },
        h('button.btn.sm.pri', { onclick: () => { replayOnboarding(); sig = ''; update(); } }, ob.enabled ? 'Restart briefing' : 'Replay briefing'),
        ob.enabled ? h('button.btn.sm', { onclick: () => { skipOnboarding(); sig = ''; update(); } }, 'Skip briefing') : null);
      const briefing = h('div.card' + (ob.enabled ? '.can' : ''),
        h('div.c-name', h('span', ob.enabled ? 'Briefing active' : ob.completed ? 'Briefing complete' : 'Briefing available'), h('b', `${Math.min(ob.step, ob.total)}/${ob.total}`)),
        h('div'),
        h('div.c-desc', ob.enabled ? 'Each new lesson freezes the game for one short confirmation, then the relevant real control glows until you act. Lessons never stack or leave a permanent banner over combat.' : 'You can replay the first-run objectives at any time.'),
        actions);
      root.append(h('div.sec-h', 'Command briefing'),
        h('p.note', 'Last Orbit teaches one mechanic at a time: a confirmed briefing freezes every game clock while you read, then a temporary highlight returns control to you. There is no persistent tutorial banner, lessons never stack, and actions you already completed are skipped automatically.'),
        briefing);
      root.append(h('div.sec-h', 'Controls'),
        h('div.kv', 'Move', h('b', 'Drag · A/D · ←/→')),
        h('div.kv', 'Fire', h('b', 'Hold · Space')),
        h('div.kv', 'Paint target', h('b', 'Tap / click enemy')),
        h('div.kv', 'Abilities', h('b', 'Buttons · 1–6')),
        h('div.kv', 'Close panel', h('b', 'Esc')));
      root.append(h('div.sec-h', 'Core loop'), h('p.note', 'Destroy formations to earn Credits, Scrap and Research Data. Credits improve the current timeline, Scrap develops weapons and drones, and Data unlocks research mechanics. Manual flying builds Focus, which increases both damage and Credit income.'));
      root.append(h('div.sec-h', 'Streak'), h('p.note', 'Rapid kills build a Credit payout multiplier. Every kill refreshes a 3.5-second grace window; after the gap expires the streak begins to decay. Streak improves kill income, while Focus is the active-piloting bonus that improves both damage and Credits.'));
      root.append(h('div.sec-h', 'Ship XP and Skills'), h('p.note', 'Kills and wave clears award Ship XP, with tougher waves, elites and bosses worth more. Each Ship Level above 1 adds +0.8% damage and +0.5% hull for the current timeline. From Level 3, every second level grants a Skill Point. The Skill Tree opens at Wave 8, deeper perks at Waves 12 and 20. Drag the map to explore; tap a node to inspect it. Spend a point on a connected perk to branch your build. You can reset skills freely. Ship XP, points and ranks reset on Rewind.'));
      root.append(h('div.sec-h', 'Wave pacing'), h('p.note', 'After a clear, the default five-second intermission is completely safe. Start Now skips it; Pause & Shop freezes the countdown while you browse. PUSH means advance into the next, harder wave. HOLD means repeat the wave you just cleared to farm resources without increasing difficulty. The Hold/Push button in the top HUD changes that standing order.'));
      root.append(h('div.sec-h', 'Tactical management'), h('p.note', 'Opening a management panel during combat keeps the battlefield visible and slows combat to 30%. Ship Loadout fills the screen and pauses combat while you fit gear; Back to game returns to the battle. During a safe intermission, Pause & Shop opens an expanded Command Phase. Ordinary modal choices pause combat while persistent production continues; Command Briefing confirmation cards deliberately freeze every game clock until acknowledged.'));
      root.append(h('div.sec-h', 'Ship systems'), h('p.note', 'The normal navigation only shows systems you can use. Menu → Ship Systems previews upcoming layers and their unlock conditions without filling the HUD with locked buttons.'));
      root.append(h('div.sec-h', 'Materials and smelting'), h('p.note', 'Wave 1 starts with Iron, then a new raw material appears every five waves. Choose a discovered recipe, load its Ore into the shared smelter, then collect the finished Bar. Hold mode mines your selected material, so you can revisit older recipes. Bars permanently improve ship systems and build projects. The Auto-loader opens at Wave 12; the Output Conveyor at Wave 22. Ores, Bars and industry upgrades survive Rewind and Ascension.'));
      root.append(h('div.sec-h', 'Specialist drones'), h('p.note', 'From Wave 15, fit one specialist in a Drone Bay: a Mining Drone extracts extra Ore from enemies, or a Target Painter marks a priority target for more damage. You can swap between them freely in Arsenal or Ship Loadout. Manual target painting remains stronger and takes priority.'));
      root.append(h('div.sec-h', 'Sector passages'), h('p.note', 'At Wave 30, the Lunar Passage project appears. Mine 40 Palladium Ore, smelt one Iridium Bar, keep one Boss Core, and defeat the Wave 40 boss to enter the Lunar Graveyard. The beacon stays built across Rewinds.'));
      root.append(h('div.sec-h', 'Recovery Fleet'), h('p.note', 'Wave 10 reveals the Recovery Fleet project. Commission it with Credits, Iron Bars and Copper Bars; once online it runs beside combat in real time. It has its own Fleet Supplies and upgrade tree, continues while you are away, and survives Rewinds and Ascension.'));
      root.append(h('div.sec-h', 'Orbital Foundry'), h('p.note', 'Wave 20 reveals the Orbital Foundry project. Commission it with Credits, Silver Bars and Gold Bars, then choose a production line in Menu → Orbital Foundry: Overclock cells, Repair capsules (wave 15), or Salvage beacons (wave 20). Every cycle also earns Blueprints for Foundry upgrades. Use the Supply button or Q to deploy your quick-slot item. Progress and reserves persist through both resets. Automatic dispatch unlocks at wave 25.'));
      root.append(h('div.sec-h', 'Rewind'), h('p.note', 'At wave 30 the Chrono Core can convert run depth into permanent Chrono Shards. Rewinding is the intended long-term loop: the timeline resets, but permanent power lets later runs recover and push farther.'));
      root.append(h('div.sec-h', 'Offline progress'), h('p.note', `When you return, Last Orbit derives rewards from the ship, upgrades, fitted gear and wave you actually left behind. The base offline reward window is 30 minutes; permanent progression can extend it later. Your current window is ${fmtTime(G.sheet.n('offlineCap') * 3600)} at ${Math.round(G.sheet.n('offlineEff') * 100)}% combat efficiency. Fleet, Foundry and Materials use that same capped real-time window.`));
    },
    auto() { root.append(back('Automation')); const a = st().auto, f = (k) => G.sheet.f(k) > 0;
      if (f('f.autopush')) root.append(field('Auto-advance', 'After falling back, push again once three waves in a row are clean', toggle(() => a.push, (v) => { a.push = v; })));
      if (f('f.autoBuy')) { root.append(h('div.sec-h', 'Auto-buy'), field('Enabled', 'Buys the cheapest upgrade in the chosen categories', toggle(() => a.buy.on, (v) => { a.buy.on = v; })));
        for (const [c, n] of [['off', 'Offence'], ['def', 'Defence'], ['eco', 'Economy']]) root.append(field(n, null, toggle(() => a.buy.cats[c], (v) => { a.buy.cats[c] = v; })));
        const lab = h('small', ''); const sl = slider(() => a.buy.reserve, (v) => { a.buy.reserve = v; lab.textContent = `Keep ${Math.round(v * 100)}% of Credits unspent`; }, 0, 0.9, 0.05); lab.textContent = `Keep ${Math.round(a.buy.reserve * 100)}% of Credits unspent`; root.append(h('div.field', h('div', 'Reserve', lab), sl)); }
      if (f('f.rules')) { root.append(h('div.sec-h', 'Priority rules'), h('p.note', 'Checked top to bottom before the cheapest-first buyer. "Weapon damage until 100" means nothing else is bought until that is done.'));
        a.rules.forEach((r, i) => { const nm = r.type === 'weapon' ? WEAPONS[r.id]?.name : DEF.upgrades[r.id]?.name; root.append(h('div.rule', h('span', `${i + 1}. ${nm} until `, h('b', 'LV ' + r.until)), h('button.btn.sm', { disabled: i === 0, onclick: () => { a.rules.splice(i - 1, 0, a.rules.splice(i, 1)[0]); sig = ''; update(); } }, '▲'), h('button.btn.sm', { onclick: () => { a.rules.splice(i, 1); sig = ''; update(); } }, '✕'))); });
        let pick = 'u:dmg', until = 100; const opts = [...UPGRADES.filter((d) => d.type !== 'flag').map((d) => ['u:' + d.id, d.name]), ...WEAPON_ORDER.map((w) => ['w:' + w, WEAPONS[w].name + ' (Scrap)'])];
        const num = h('input', { type: 'number', min: 1, max: 9999, value: until, oninput: () => { until = Math.max(1, +num.value || 1); } }); num.style.width = '80px';
        root.append(h('div.rule', select(opts, () => pick, (v) => { pick = v; }), h('span', ' until LV'), num, h('button.btn.sm.pri', { onclick: () => { if (a.rules.length >= 12) return toast('Twelve rules is the limit.', 'warn'); const [t, id] = pick.split(':'); a.rules.push({ type: t === 'w' ? 'weapon' : 'upgrade', id, until }); sig = ''; update(); } }, 'Add'))); }
      if (f('f.autoBoon')) root.append(h('div.sec-h', 'Field upgrades'), field('Auto-pick boons and anomalies', 'Prefers this tag, otherwise the first option', select([['ask', 'Ask me'], ...BOON_TAGS], () => a.boonTag, (v) => { a.boonTag = v; })));
      if (f('f.autoRewind')) { const r = a.rewind; root.append(h('div.sec-h', 'Auto-rewind'), field('Enabled', 'Never triggers during a challenge', toggle(() => r.on, (v) => { r.on = v; })), field('Rewind when', null, select(REWIND_MODES, () => r.mode, (v) => { r.mode = v; })));
        const n1 = h('input', { type: 'number', min: 0, step: 'any', value: r.value, oninput: () => { r.value = Math.max(0, +n1.value || 0); } }), n2 = h('input', { type: 'number', min: 0, value: r.minMinutes, oninput: () => { r.minMinutes = Math.max(0, +n2.value || 0); } }); root.append(field('N', 'The number used by the rule above', n1), field('Minimum run length', 'Minutes', n2)); }
      root.append(h('p.note', 'Ability auto-cast conditions live on each ability in the Arsenal. Auto-research has its switch in the Research panel. Auto-salvage is in Ship Loadout.')); },
    settings() { root.append(back('Settings')); const s = st().settings, vol = (k, n) => root.append(field(n, null, slider(() => s[k], (v) => { s[k] = v; applyVolumes(); })));
      root.append(h('div.sec-h', 'Audio')); vol('master', 'Master volume'); vol('music', 'Music'); vol('sfx', 'Effects');
      root.append(h('div.sec-h', 'Display'), field('Screen shake', null, toggle(() => s.shake, (v) => { s.shake = v; })), field('Damage numbers', null, toggle(() => s.dmgNumbers, (v) => { s.dmgNumbers = v; })), field('Scanlines', null, toggle(() => s.scanlines, (v) => { s.scanlines = v; hooks.applySettings(); })),
        field('Graphics quality', 'Auto lowers resolution if frames drop', select([['auto', 'Auto'], ['high', 'High'], ['low', 'Low']], () => s.quality, (v) => { s.quality = v; hooks.applySettings(); })), field('Number format', null, select([['suffix', '12.5M'], ['sci', '1.25e7']], () => s.notation, (v) => { s.notation = v; setNotation(v); })));
      root.append(h('div.sec-h', 'Game'), field('Wave intermission', 'Safe time after each clear. Start Now always skips it.', select([['0', 'Off'], ['3', '3 seconds'], ['5', '5 seconds'], ['-1', 'Pause until ready']], () => String(s.waveIntermission ?? 5), (v) => { s.waveIntermission = +v; })), field('Confirm before rewinding', null, toggle(() => s.confirmRewind, (v) => { s.confirmRewind = v; })));
      if (st().prestige.count > 0 || st().meta.sandbox) root.append(field('Simulation speed', 'Earned with your first rewind', select([[1, '×1'], [1.5, '×1.5'], [2, '×2']], () => s.speed, (v) => { s.speed = +v; })));
      root.append(h('div.sec-h', 'Save data'), h('div.row', h('button.btn.sm', { onclick: () => hooks.saveNow() }, 'Save now'), h('button.btn.sm', { onclick: () => showSaveTools(hooks.importSave) }, 'Export / import'), h('button.btn.sm.danger', { onclick: () => confirmDialog('Erase everything', 'Delete this save and its backup and start from wave 1? This cannot be undone.', 'Erase', hooks.hardReset, true) }, 'Hard reset')), h('p.note', 'Autosaves every 20 seconds and whenever the tab is hidden. A rotating backup is kept in case the main slot is ever unreadable.'));
      let taps = 0; root.append(h('p.note', { style: 'text-align:center;margin-top:16px', onclick: () => { if (++taps >= 7) { taps = 0; hooks.openDebug(); } } }, `Last Orbit v${VERSION}`)); },
  };
  function update() {
    const live = screen === 'stats' ? Math.floor(performance.now() / 1000) : screen === 'missions' ? st().missions.active.map((m) => missionProgress(m)).join() : screen === 'fleet' ? fleetSignature() : screen === 'materials' ? materialsSignature() : screen === 'projects' ? PROJECTS.filter(projectRevealed).map((p) => p.id + ':' + !!st().projects.completed[p.id] + ':' + p.costs.map(([cur]) => fmt(st().cur[cur])).join(',')).join('|') + ':' + !!st().projects.passageBossCleared : screen === 'home' ? (projectsAttention() ? 'p|' : '') + missionsReady() + '|' + achievementCount() + '|' + Object.keys(st().unlocks).length + '|' + treeAffordable('relics') + '|' + treeAffordable('alien') + '|' + (st().unlocks.fleet ? fleetSignature() : '') + '|' + (st().materials.discovered ? materialsSignature() : '') + '|' + onboardingStatus().step + '|' + onboardingStatus().enabled : screen === 'systems' ? Object.keys(st().unlocks).length + '|' + (st().stats.bestWave || 1) + '|' + (st().stats.bestSector || 1) + '|' + st().prestige.count + '|' + st().materials.discovered : screen === 'challenges' ? st().run.best + (st().run.challenge || '') : '';
    const k = screen + '|' + live; if (k !== sig) { sig = k; const sc = root.parentNode?.scrollTop; clear(root); screens[screen](); if (sc && root.parentNode) root.parentNode.scrollTop = sc; }
    if (screen === 'foundry') foundryView?.update();
    if (screen === 'materials') materialsView?.update();
    if (screen === 'relics') relics.update(); if (screen === 'alien') alien.update();
  }
  return { el: root, title: 'Menu', update, onOpen() { sig = ''; }, goto: go, destroy() { offMissions(); offFleet(); offFoundry(); offMaterials(); } };
}
export const menuAttention = () => projectsAttention() || (G.state.materials.discovered && materialsAffordable()) || (G.state.unlocks.foundry && foundryAffordable()) || missionsReady() > 0 || (G.state.unlocks.fleet && fleetAffordable()) || treeAffordable('relics') || (G.state.unlocks.alien && treeAffordable('alien'));
