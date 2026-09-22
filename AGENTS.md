# Last Orbit Agent Contract

Last updated: 2026-09-22  
Current gameplay build: **v1.17.8**  
Save schema: **12**  
Onboarding schema: **5**

This file is the mandatory entry point for any coding agent working in this repository.

## Start here every time

1. Read this file completely.
2. Read [`AI_INDEX.md`](AI_INDEX.md) and route the task to the smallest relevant documentation/source set.
3. Read [`CODEMAP.md`](CODEMAP.md) before moving or creating modules.
4. If code will change, establish a clean baseline with the relevant tests before editing.
5. Make the smallest coherent change that solves the actual gameplay/UX/technical goal. Preserve established subsystem boundaries unless the task is explicitly architectural.
6. Update the relevant Markdown documentation when behavior, ownership, invariants, save shape, balance intent, UI flow, or test coverage changes.
7. Run the relevant focused tests, then run the full release gate before returning a build.
8. Perform a second verification pass over the changed files and packaged tree. Do not stop after the first green test run.

For a quick route, run:

```bash
python3 tools/agent_context.py --list
python3 tools/agent_context.py <topic>
```

For the complete automated gate, run:

```bash
python3 tools/run_release_gates.py
```

## Core architectural invariants

### 1. Persistent, derived and live state are different things

- `G.state` is persistent save state. Its shape originates in `modules/core/state.js`.
- `G.sheet` is derived statistics computed by `modules/progression/stats.js`. Do not save it.
- `G.world` is transient live-battle state created by `modules/combat/world.js` / `modules/combat/sim.js`. Do not treat it as persistent progression.
- Recompute derived stats with `recalc()` after progression/equipment changes that affect the sheet.

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before changing these boundaries.

### 2. Simulation is authoritative; rendering is a view

- Combat advances in fixed **60 Hz** steps through `modules/combat/sim.js`.
- Rendering is decoupled from simulation.
- `modules/rendering/renderer.js` reads the world and drains `world.fx`; it must not become a second gameplay authority or write progression state.
- Simulation modules must not depend on DOM or Three.js.

### 3. Data definitions and behavior have separate owners

- Tunable/configuration tables live under `modules/data/`.
- Purchase/unlock/economy rules are centralized in `modules/progression/economy.js`.
- Derived player/build statistics are centralized in `modules/progression/stats.js`.
- UI should call public gameplay/progression functions instead of duplicating purchase rules or combat formulas.

Read [`docs/BALANCING.md`](docs/BALANCING.md) for balance changes.

### 4. Save compatibility is a hard requirement

- `modules/core/state.js` defines the current schema.
- `modules/save/save.js` owns persistence and migration.
- **Never delete or rewrite old migration entries.** Add a new migration when a schema change requires one.
- A build must refuse a save from a newer schema rather than overwrite it.
- Debug/sandbox state must remain isolated from the real save.
- Main save + rotating backup behavior must remain intact.

Read [`docs/SAVE_AND_OFFLINE.md`](docs/SAVE_AND_OFFLINE.md) before changing save, state, reset, sandbox, offline, materials/fleet/foundry persistence, or schema behavior.

### 5. Pause/freeze semantics are intentional

Different UI states intentionally affect time differently:

- Live management uses tactical slowdown rather than a full pause.
- A paused cleared-wave Command Phase stops combat simulation.
- Normal choice dialogs can pause combat without necessarily freezing persistent producers.
- Blocking onboarding briefings and the guided first-upgrade flow freeze the entire game clock.
- Required onboarding dialogs cannot be dismissed with Escape.

Do not collapse these into a single generic pause flag. Read [`docs/UI_RENDERING.md`](docs/UI_RENDERING.md) and `modules/main.js` first.

### 6. Interaction hardening from v1.17.6 must not regress

- Closed `#modal` must not own pointer input; open `#modal.on` must.
- Decorative game icons/UI artwork/material artwork must remain click-through.
- Modal inert/background state must self-recover even if modal visibility state is interrupted.
- Touch scrolling must not accidentally purchase upgrades.
- Focused form controls/buttons must keep their normal keyboard interaction.

These are covered by `tests/interaction-regression.mjs` and `tests/ux-regression.mjs`.

### 7. Offline simulation is not a second version of live combat

Offline rewards deliberately approximate the player's build and exclude active-only play bonuses. Preserve its documented cap, safe-farm behavior, and front-line position guarantees unless intentionally redesigning offline progression.

### 8. Browser module routing must stay in sync

The browser uses an import map embedded in `index.html`. Tests resolve `@last-orbit/...` through `tests/loader.mjs`.

If a new `@last-orbit/...` module is created:

- add the browser import-map entry in `index.html`;
- ensure test resolution still works;
- add it to `CODEMAP.md` / `AI_INDEX.md` if it owns a meaningful subsystem.

## Documentation update rule

Documentation is part of the build, not cleanup work.

Update at least one of the following whenever its facts change:

- `AI_INDEX.md` — task routing / subsystem ownership.
- `CODEMAP.md` — module boundaries, new files, moved responsibilities.
- `docs/ARCHITECTURE.md` — state, boot, simulation, event or layer changes.
- `docs/GAME_SYSTEMS.md` — player-facing system behavior/ownership.
- `docs/BALANCING.md` — formulas, tuning philosophy, pacing or economy rules.
- `docs/SAVE_AND_OFFLINE.md` — schema, migration, persistence or offline changes.
- `docs/UI_RENDERING.md` — input, modal, management, rendering or icon rules.
- `TESTING.md` — test commands, new regression suites or changed release gates.
- `CHANGELOG.md` / `BUILD_NOTES.md` — release-facing change summary.

Do not bump the gameplay version for documentation-only housekeeping unless the user asks for a new numbered build.

## Verification contract

For code changes, use the smallest relevant focused test first, then the full gate:

```bash
python3 tools/run_release_gates.py
```

The full gate currently checks:

- all `modules/**/*.js` with `node --check`;
- autopilot/status behavior;
- icon source-atlas, runtime-slice and mapping integrity;
- modal/click-through interaction invariants;
- offline simulation invariants;
- ship-loadout and UI/UX regressions.

Then do a second pass:

- inspect the actual diff/changed files;
- confirm version/schema numbers are intentional;
- confirm documentation agrees with source;
- confirm no temporary files or generated junk are included;
- if packaging, inspect the ZIP contents after creation.

See [`TESTING.md`](TESTING.md) and [`docs/AGENT_RELEASE_WORKFLOW.md`](docs/AGENT_RELEASE_WORKFLOW.md).

## Scope discipline

- Prefer changing an existing owner module over adding a parallel implementation.
- Do not duplicate formulas between UI, live combat and offline simulation without a deliberate reason.
- Do not move large blocks merely for aesthetics during an unrelated fix.
- Preserve current mobile/touch behavior when making desktop UX changes, and vice versa.
- Treat accessibility attributes, focus behavior and touch gestures as functional behavior, not decoration.
- When a task exposes a more scalable/cleaner route, surface it, but do not silently replace working architecture with a rewrite outside the requested scope.