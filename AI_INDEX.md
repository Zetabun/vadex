# Last Orbit source guide

| Work area | Read / edit |
|---|---|
| Boot, frame loop, input, Hangar and sortie flow | `modules/main.js`, `modules/ui/ui.js` |
| Waves, sectors, death and revive | `modules/combat/sim.js`, `modules/combat/waves.js`, `modules/data/sectors.js` |
| Enemy and player damage, loot drops | `modules/combat/world.js`, `modules/combat/pickups.js`, `modules/combat/player.js` |
| Level-ups, card offers, relics, sortie start/end | `modules/progression/run.js`, `modules/data/cards.js`, `modules/data/relics.js` |
| Workshop, ships, contracts | `modules/progression/meta.js`, `modules/data/workshop.js`, `modules/data/ships.js`, `modules/data/contracts.js` |
| Stats and weapon builds | `modules/progression/stats.js`, `modules/data/weapons.js` |
| Difficulty and economy numbers | `modules/data/balance.js` |
| HUD, Hangar, overlays, CSS | `modules/ui/hud.js`, `modules/ui/hangar.js`, `modules/ui/overlays.js`, `index.html` |
| Save compatibility | `modules/core/state.js`, `modules/save/save.js` |
| Global boards (posting, fetching, the Records Global tab, the Deck TV's Boards channel) | `modules/progression/global.js`, `modules/data/global.js`, `api/src/index.js`, `tests/global-regression.mjs`, `tests/api-regression.mjs` |
| Field kit (supply meter, canisters, boosts, the kit panel and HUD chips) | `modules/data/boosts.js`, `modules/progression/boosts.js`, `modules/ui/hud.js`, `modules/ui/overlays.js` (showKit), `tests/kit-regression.mjs`, `tests/kit-probe.mjs` |
| What's new (the gear's "!", Settings > Updates) | `modules/progression/updates.js`, `modules/data/updates.js` (generated from `CHANGELOG.md` by `tools/build_updates.py`), `modules/ui/overlays.js` (showSettings) |
| Release check and balance bot | `tools/run_release_gates.py`, `tests/sortie-regression.mjs`, `tests/balance-sim.mjs` |

The import map in `index.html` resolves each `@last-orbit/` specifier to a published module path. `tests/loader.mjs` resolves the same specifiers in Node.
