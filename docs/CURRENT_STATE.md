# Last Orbit Current State

Snapshot date: 2026-09-22  
Gameplay build: **v1.17.8**  
Save schema: **12**  
Onboarding schema: **5**

This is a compact baseline for agents. It describes what is already present so a new task is less likely to reimplement an existing system.

## Runtime / platform

- Browser application using native ES modules and an import map in `index.html`.
- Three.js renders the battlefield; a 2D overlay handles floating text/health bars and related effects.
- Combat simulation runs at a fixed 60 Hz and is decoupled from rendering.
- The UI is DOM-based and designed for mouse, keyboard and touch/mobile interaction.
- State uses the large-number `Big` type for long-running incremental progression.

## Active gameplay layers

- Wave-based orbital defence with sectors, formations, elites, bosses, hazards and a player ship.
- Manual movement/fire plus an unlockable Autopilot.
- Autopilot has a basic last-second bullet reflex; researched Evasive Routines add stronger prediction including telegraphed hazards.
- Weapon progression, weapon fitting and evolution.
- Drones with bay capacity and per-type progression.
- Active abilities with cooldowns and automation conditions.
- Run boons and anomaly choices.
- Credit upgrades and research trees.
- Run XP / ship levels.
- Chrono Rewind, Ascension, Relics, Alien tech and challenges.
- Generated ship modules with rarity/modifiers/sets, fitting, salvage, forge/tuning and a central Ship Loadout paper doll.
- Multi-material ore recovery and one shared smelter.
- Foundry production and combat supplies.
- Recovery Fleet persistent production.
- Missions and achievements.
- Automation for supported unlocked systems.
- Offline progress simulation with an upgradable away-time cap.

## Current UI behavior worth preserving

- The Ship Loadout is the single paper-doll view for weapons, drones, abilities, foundry supply and generated modules.
- Equipment selection uses the in-game picker; previewing does not mutate loadout until confirmed.
- Current timed buffs, boons and anomaly effects are exposed through a compact status model.
- Live management mode slows combat to tactical time while keeping part of the battlefield visible.
- A deliberately paused between-wave Command Phase expands management space and stops combat.
- Blocking onboarding briefings freeze the entire game clock and require explicit continuation.
- The first guided upgrade cannot be bypassed simply by opening Upgrades early; the onboarding route is evaluated synchronously on panel open.
- Closed modal backdrop and decorative icon art are click-through; open modal owns pointer input.

## Persistence baseline

- IndexedDB is primary persistence; localStorage mirrors it.
- A rotating `main_backup` is retained for recovery.
- Sandbox/debug writes to a separate save slot.
- Main save migrations are incremental and retained permanently.
- Offline simulation never moves the player's actual front-line wave backwards when it chooses an earlier safe farm wave.

## Current icon pipeline

- `assets/icons/icon-atlas.png` is retained as the 8x8 source/reference atlas containing 64 cells.
- Named normalized slice PNGs live in `assets/icons/` and are the runtime rendering path, so one atlas request cannot blank every icon. The runtime slices have their bright cyan atlas-corner accents cleaned away.
- `assets/icons/icon-map.json` records the atlas/slice mapping.
- `modules/ui/icons.js` maps gameplay categories to named slice files and falls back to a visible glyph if an asset cannot load.

## Regression baseline

As of this snapshot, the following all pass:

- JavaScript syntax check across every module.
- Autopilot/status regression.
- Icon atlas regression.
- Interaction/modal click-through regression.
- Offline progression regression.
- Ship Loadout/UI UX regression.

Run `python3 tools/run_release_gates.py` to reproduce the baseline.