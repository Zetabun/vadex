# Last Orbit Testing

Baseline captured from v1.17.7 on 2026-09-22: all module syntax checks and all five regression suites pass.

## One-command release gate

From the repository root:

```bash
python3 tools/run_release_gates.py
```

This runs syntax checks over every `modules/**/*.js` file and then all `tests/*-regression.mjs` suites with the project Node loader.

## Individual regression suites

```bash
node --experimental-loader ./tests/loader.mjs tests/autopilot-status-regression.mjs
node --experimental-loader ./tests/loader.mjs tests/icon-atlas-regression.mjs
node --experimental-loader ./tests/loader.mjs tests/interaction-regression.mjs
node --experimental-loader ./tests/loader.mjs tests/offline-regression.mjs
node --experimental-loader ./tests/loader.mjs tests/ux-regression.mjs
```

Node may print an ExperimentalWarning for `--experimental-loader`; that warning is not a test failure.

## Coverage map

| Suite | Protects |
|---|---|
| `autopilot-status-regression.mjs` | target pursuit, base last-second bullet reflex, researched telegraph prediction, current buffs/boons/anomaly status model |
| `icon-atlas-regression.mjs` | 8x8/64-icon source-atlas contract, runtime slice-path integrity, core mappings, upgrade/boon mappings, material fallbacks |
| `interaction-regression.mjs` | modal pointer ownership, click-through artwork, inert/background recovery source invariants |
| `offline-regression.mjs` | 30-minute base away cap, cap upgrades, persistent producer window, build-scaled rewards, safe farming without front-line rollback, Arsenal-gated Scrap |
| `ux-regression.mjs` | Ship Loadout/paper doll, picker preview/apply/remove behavior, locked systems, 20-slot identity path, modal Escape/inert recovery, touch/scroll/keyboard/hold purchase behavior |

## Focused test expectations by change

- **Combat/player/autopilot:** run `autopilot-status-regression.mjs`; add a focused deterministic test when changing an uncovered combat rule.
- **Icon assets/mappings:** run `icon-atlas-regression.mjs`.
- **Modal/input/CSS pointer fixes:** run both interaction + UX suites.
- **Loadout/equipment/panels:** run UX.
- **Offline/fleet/foundry/material persistence:** run offline; add fixtures for new persistent semantics.
- **Save schema/migrations:** add explicit old-save migration coverage. The existing suite is not enough by itself for a schema bump.
- **Renderer-only visual work:** syntax + full gate plus a manual browser visual/input check.
- **Balance changes:** full gate plus a focused numeric/pacing assertion for the rule being changed where practical.

## Syntax check only

```bash
find modules -type f -name '*.js' -print0 | while IFS= read -r -d '' f; do node --check "$f"; done
```

## Browser smoke test

For any UI/render/input/release change:

1. Serve the root with `python3 -m http.server 8000`.
2. Open the game in a browser.
3. Confirm boot succeeds with no console error.
4. Confirm battlefield movement/fire works.
5. Open/close each affected management panel and modal.
6. Confirm pointer/touch interaction still reaches the intended control.
7. Confirm closing a modal restores background controls.
8. For progression work, exercise the actual purchase/equip/unlock path rather than only changing state in debug.

## Second-pass rule

A green test run is the start of verification, not the end. Before returning a build:

- inspect changed files/diff;
- compare docs against source constants/behavior;
- search for stale version/schema references;
- ensure no temporary artifacts are included;
- if a ZIP is created, inspect its file list and test the tree that was actually packaged.
