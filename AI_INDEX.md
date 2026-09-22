# Last Orbit AI Index

This is the routing hub for agents. Read `AGENTS.md` first, then use this file to load only the context needed for the task.

## Fast route table

| Task / symptom | Read first | Primary source owners | Focused regression |
|---|---|---|---|
| Boot, frame loop, pause/time behavior, lifecycle | `docs/ARCHITECTURE.md`, `docs/UI_RENDERING.md` | `modules/main.js`, `modules/ui/management.js`, `modules/ui/modals.js` | `tests/ux-regression.mjs`, `tests/interaction-regression.mjs` |
| Combat pacing, waves, enemies, bosses, damage | `docs/GAME_SYSTEMS.md`, `docs/BALANCING.md` | `modules/combat/*`, `modules/data/balance.js`, `modules/data/enemies.js`, `modules/data/bosses.js` | add/run a focused combat test; full gate |
| Player movement, Autopilot, dodging | `docs/GAME_SYSTEMS.md`, `docs/BALANCING.md` | `modules/combat/player.js`, `modules/data/research.js` | `tests/autopilot-status-regression.mjs` |
| Weapons, drones, abilities | `docs/GAME_SYSTEMS.md`, `docs/BALANCING.md` | `modules/combat/weapons.js`, `drones.js`, `abilities.js`; matching `modules/data/*` | autopilot/status + relevant new focused test |
| Upgrades, unlocks, currencies, purchase logic | `docs/GAME_SYSTEMS.md`, `docs/BALANCING.md` | `modules/progression/economy.js`, `stats.js`, `modules/data/upgrades.js`, `research.js`, `prestige.js` | full gate; add focused economy test for rule changes |
| Rewind / Ascension / permanent progression | `docs/GAME_SYSTEMS.md`, `docs/SAVE_AND_OFFLINE.md` | `modules/prestige/prestige.js`, `modules/data/prestige.js`, `relics.js`, `progression/economy.js` | full gate + save compatibility check |
| Ship Loadout / paper doll / modules | `docs/GAME_SYSTEMS.md`, `docs/UI_RENDERING.md` | `modules/ui/panels/modules.js`, `modules/ui/equipment-picker.js`, `modules/modules/modules.js`, `progression/stats.js` | `tests/ux-regression.mjs` |
| Materials / smelter | `docs/GAME_SYSTEMS.md`, `docs/BALANCING.md`, `docs/SAVE_AND_OFFLINE.md` | `modules/progression/materials.js`, `modules/data/materials.js`, `modules/ui/panels/materials.js` | offline + UX where relevant |
| Foundry / combat supplies | `docs/GAME_SYSTEMS.md`, `docs/SAVE_AND_OFFLINE.md` | `modules/progression/foundry.js`, `modules/data/foundry.js`, `modules/ui/panels/foundry.js` | offline + UX where relevant |
| Recovery Fleet | `docs/GAME_SYSTEMS.md`, `docs/SAVE_AND_OFFLINE.md` | `modules/progression/fleet.js`, `modules/data/fleet.js`, `modules/ui/panels/fleet.js` | `tests/offline-regression.mjs` |
| Offline / tab return / away rewards | `docs/SAVE_AND_OFFLINE.md`, `docs/BALANCING.md` | `modules/offline/offline.js`, `modules/main.js`, persistent producer modules | `tests/offline-regression.mjs` |
| Save, migration, import/export, sandbox | `docs/SAVE_AND_OFFLINE.md` | `modules/core/state.js`, `modules/save/save.js` | full gate + explicit migration fixture when schema changes |
| Onboarding, guided upgrade, tutorial blocking | `docs/UI_RENDERING.md`, `docs/GAME_SYSTEMS.md` | `modules/meta/onboarding.js`, `modules/ui/ui.js`, `modules/ui/modals.js`, `modules/main.js` | `tests/ux-regression.mjs` |
| Menus, panels, keyboard/touch interaction | `docs/UI_RENDERING.md` | `modules/ui/*`, `index.html` | `tests/ux-regression.mjs`, `tests/interaction-regression.mjs` |
| Renderer, visuals, draw-call/performance work | `docs/UI_RENDERING.md`, `docs/ARCHITECTURE.md` | `modules/rendering/*`, `modules/combat/world.js` (read-only contract) | syntax + manual browser check; full gate |
| Audio, SFX, music, volume/lifecycle | `docs/GAME_SYSTEMS.md`, `docs/ARCHITECTURE.md` | `modules/audio/audio.js`, effect emitters in `modules/combat/world.js` / combat systems, `modules/main.js` | full gate + manual browser audio check |
| Icon atlas / ore & bar art | `docs/UI_RENDERING.md` | `modules/ui/icons.js`, `assets/icons/*`, `index.html` | `tests/icon-atlas-regression.mjs` |
| Balance / difficulty / pacing / rewards | `docs/BALANCING.md` | `modules/data/balance.js`, other `modules/data/*`, `progression/stats.js`, `economy.js` | relevant focused test + full gate |
| Tests / release / packaging | `TESTING.md`, `docs/AGENT_RELEASE_WORKFLOW.md` | `tests/*`, `tools/run_release_gates.py` | `python3 tools/run_release_gates.py` |

## Documentation map

- [`AGENTS.md`](AGENTS.md) — mandatory rules and invariants.
- [`CODEMAP.md`](CODEMAP.md) — file ownership and dependency map.
- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — compact snapshot of the current v1.17.8 feature/state baseline.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — boot, state layers, simulation/render/UI boundaries and event flow.
- [`docs/GAME_SYSTEMS.md`](docs/GAME_SYSTEMS.md) — gameplay/progression system ownership and cross-system rules.
- [`docs/BALANCING.md`](docs/BALANCING.md) — tuning sources, enemy scaling, derived stats and change procedure.
- [`docs/SAVE_AND_OFFLINE.md`](docs/SAVE_AND_OFFLINE.md) — persistence, schema/migration and away simulation.
- [`docs/UI_RENDERING.md`](docs/UI_RENDERING.md) — UI, modal, input, management-mode, renderer and icon invariants.
- [`TESTING.md`](TESTING.md) — test matrix and commands.
- [`docs/AGENT_RELEASE_WORKFLOW.md`](docs/AGENT_RELEASE_WORKFLOW.md) — edit -> verify -> document -> package workflow.
- [`CHANGELOG.md`](CHANGELOG.md) — cumulative change record.
- [`BUILD_NOTES.md`](BUILD_NOTES.md) — current release-specific notes.

## Source ownership by directory

- `modules/core/` — shared state primitives, event bus, number/format helpers.
- `modules/data/` — declarative definitions and tunable content.
- `modules/combat/` — live battle simulation.
- `modules/progression/` — currencies, derived build, resources and persistent production.
- `modules/prestige/` — rewind/ascension actions.
- `modules/modules/` — generated ship-module inventory/equipment system.
- `modules/automation/` — auto-buy/use/rewind decision layer that calls public gameplay APIs.
- `modules/meta/` — onboarding and goals/missions/achievements.
- `modules/offline/` — away-time approximation and application.
- `modules/save/` — persistence, migration and sandbox save separation.
- `modules/audio/` — audio playback/mode/volume lifecycle.
- `modules/rendering/` — Three.js/2D visual presentation of world state.
- `modules/ui/` — DOM UI shell, panels, modals, in-game equipment picker, icons and UI helpers.
- `assets/icons/` — 8x8 atlas, named slices and mapping metadata.
- `tests/` — Node regression suites with the `@last-orbit/` loader.

## Useful agent commands

```bash
# Show known routes
python3 tools/agent_context.py --list

# Get a compact route bundle for a task
python3 tools/agent_context.py combat
python3 tools/agent_context.py ui
python3 tools/agent_context.py save
python3 tools/agent_context.py balance

# Full validation
python3 tools/run_release_gates.py
```

If a task spans multiple rows, load all directly affected docs, but do not read unrelated subsystem docs by default.