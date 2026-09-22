# Last Orbit Code Map

Current gameplay build: **v1.17.7**. The browser entrypoint is `index.html` -> `modules/main.js`.

## Runtime flow

```text
index.html
  -> import map (@last-orbit/...)
  -> modules/main.js
       -> load persistent G.state
       -> recalc G.sheet
       -> init transient G.world
       -> init Renderer + UI
       -> requestAnimationFrame loop
            -> fixed-step combat simulation
            -> automation / persistent producers
            -> onboarding / audio
            -> renderer reads G.world
            -> UI reads state/sheet/world
            -> autosave
```

## State ownership

| Layer | Owner | Lifetime | Rule |
|---|---|---|---|
| Persistent state | `modules/core/state.js`, mutated by systems, stored by `modules/save/save.js` | across sessions | serialized as the save |
| Derived stat sheet | `modules/progression/stats.js` via `recalc()` | until build/state changes | never serialized |
| Live battle world | `modules/combat/world.js`, orchestrated by `combat/sim.js` | current runtime battle | never serialized as progression |
| Visual state | `modules/rendering/*`, `modules/ui/*` | presentation only | must not become combat authority |

## Core

- `modules/core/game.js` — global runtime context `G`, `recalc`, stat/flag access, counters/toasts.
- `modules/core/state.js` — save schema/default state/currency metadata.
- `modules/core/events.js` — synchronous event bus for loose system communication.
- `modules/core/big.js` — immutable large-number type used by economy/progression.
- `modules/core/rng.js` — deterministic wave RNG + non-deterministic general RNG.
- `modules/core/format.js` — numeric/time presentation helpers.

## Data / content definitions

- `modules/data/balance.js` — global combat/economy constants and enemy/reward scaling formulas.
- `modules/data/upgrades.js` — credit upgrade definitions.
- `modules/data/research.js` — research tree definitions.
- `modules/data/weapons.js` — weapon definitions/evolution metadata.
- `modules/data/drones.js` — drone definitions.
- `modules/data/abilities.js` — active abilities + automation conditions.
- `modules/data/enemies.js` — enemy and elite definitions.
- `modules/data/bosses.js` — boss definitions.
- `modules/data/boons.js` — run boons/anomalies.
- `modules/data/prestige.js` — rewind/ascension tree definitions.
- `modules/data/relics.js` — relic and alien-tech definitions.
- `modules/data/materials.js` — material ladder and smelter upgrades.
- `modules/data/foundry.js` — supply recipes/upgrades.
- `modules/data/fleet.js` — Recovery Fleet definitions.
- `modules/data/modules.js` — generated ship-module types/modifiers/sets/rarities.
- `modules/data/goals.js` — challenges/achievements.
- `modules/data/projects.js` — construction/project definitions.
- `modules/data/sectors.js` — sector progression/presentation.
- `modules/data/experience.js` — run XP/level curve.

## Live combat

- `modules/combat/sim.js` — fixed-step orchestrator and wave state machine; owns start/clear/death flow.
- `modules/combat/world.js` — transient world structure, spawning, targeting, damage/reward/fx primitives.
- `modules/combat/player.js` — player movement, survivability and Autopilot/evasion logic.
- `modules/combat/weapons.js` — player weapon fire/projectiles.
- `modules/combat/drones.js` — live drone entities/behavior.
- `modules/combat/abilities.js` — active ability runtime effects.
- `modules/combat/enemies.js` — enemy formation, projectiles and hazard updates.
- `modules/combat/bosses.js` — boss spawn/update behavior.
- `modules/combat/waves.js` — deterministic wave composition.

## Progression / economy

- `modules/progression/economy.js` — canonical gain/spend, upgrades, trees, weapon/drone/ability equipment and unlock rules.
- `modules/progression/stats.js` — applies definitions/effects into `G.sheet`; weapon build derivation.
- `modules/progression/experience.js` — run XP and ship-level progression.
- `modules/progression/materials.js` — ore discovery, smelter, collection and material offline simulation.
- `modules/progression/foundry.js` — supply manufacturing and combat effects.
- `modules/progression/fleet.js` — Recovery Fleet production/spend behavior.
- `modules/progression/projects.js` — project construction/progression.
- `modules/progression/rewards.js` — focused reward helpers.
- `modules/prestige/prestige.js` — rewind, ascension and challenge lifecycle actions.
- `modules/modules/modules.js` — generated module drops, fitting, salvage, forge/tuning.
- `modules/automation/automation.js` — automatic decisions using public system APIs.

## Meta / persistence

- `modules/meta/onboarding.js` — serialized tutorial progression, briefings, objectives and freeze status.
- `modules/meta/goals.js` — missions/achievements/goals runtime.
- `modules/offline/offline.js` — away-time combat/reward approximation and application.
- `modules/save/save.js` — IndexedDB/localStorage storage, migrations, backup, import/export, sandbox isolation.

## UI

- `modules/ui/ui.js` — HUD/nav/panel shell, status stack, management/open-panel behavior and UI event wiring.
- `modules/ui/management.js` — tactical management slowdown and panel sizing/Command Phase rules.
- `modules/ui/modals.js` — modal ownership, focus/inert behavior, choices, onboarding, boss loot, offline report, save tools.
- `modules/ui/dom.js` — DOM helpers and shared touch/hold purchase interaction.
- `modules/ui/icons.js` — icon atlas lookup and material/icon fallback elements.
- `modules/ui/equipment-picker.js` — in-game loadout picker; preview vs apply semantics.
- `modules/ui/debug.js` — debug/sandbox controls.
- `modules/ui/panels/upgrades.js` — credit upgrade UI.
- `modules/ui/panels/arsenal.js` — weapons/drones Arsenal UI.
- `modules/ui/panels/research.js` / `tree.js` — research and generic node-tree UI.
- `modules/ui/panels/modules.js` — central RPG-style Ship Loadout/paper doll.
- `modules/ui/panels/rewind.js` — Rewind/Ascension panel.
- `modules/ui/panels/materials.js`, `foundry.js`, `fleet.js` — persistent production system UIs.
- `modules/ui/panels/intel.js` — enemy/intel presentation sourced from live definitions.
- `modules/ui/panels/menu.js` — non-core screens, help/settings/automation/systems/save tools; owns display `VERSION`.

## Rendering / audio

- `modules/rendering/renderer.js` — Three.js battle renderer + 2D overlay. Reads simulation; drains fx.
- `modules/rendering/geometry.js` — reusable procedural geometry.
- `modules/rendering/effects.js` — sprite batches, particles, transients and render helpers.
- `modules/rendering/background.js` — sector/background presentation.
- `modules/audio/audio.js` — WebAudio/SFX/music/volume lifecycle.

## Browser shell and assets

- `index.html` — application shell, all CSS, DOM canvas roots, Three.js include/import map, module boot.
- `assets/icons/icon-atlas.png` — complete 8x8 source/reference atlas; runtime icons use the normalized named slices.
- `assets/icons/icon-map.json` — slice/mapping metadata.
- `assets/icons/*.png` — named icon slices consumed/verified by the UI test.

## Tests

- `tests/loader.mjs` — maps `@last-orbit/*` imports to `modules/*` in Node.
- `tests/autopilot-status-regression.mjs` — target pursuit, bullet reflex, researched hazard avoidance, status-effect model.
- `tests/icon-atlas-regression.mjs` — atlas dimensions, named slices, runtime slice paths, mappings and fallbacks.
- `tests/interaction-regression.mjs` — click-through/modal inert source invariants.
- `tests/offline-regression.mjs` — cap, producer window, build scaling, safe farm/front-line and Scrap gating.
- `tests/ux-regression.mjs` — paper doll/equipment picker, modal semantics, input/hold behavior and related panels.

## High-risk cross-cutting changes

When changing any item below, inspect all listed owners rather than patching one surface:

- **New persistent field:** `core/state.js` + `save/save.js` migration/defaulting + affected systems + tests.
- **New stat/effect:** data definition + `progression/stats.js` + UI breakdown/labels where exposed + automation/offline if applicable.
- **New equipment type:** data + economy + stats + combat runtime + loadout UI + save defaults + UX tests.
- **New module file:** source + `index.html` import map + `AI_INDEX.md`/this map if it owns behavior.
- **Pause/time change:** `main.js` + onboarding/modals/management + persistent producer expectations + UX tests.
- **Balance change:** `data/balance.js` or relevant data table + live formula owner + offline approximation + `docs/BALANCING.md` + tests.
