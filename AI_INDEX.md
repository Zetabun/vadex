# Last Orbit source guide

| Work area | Read / edit |
|---|---|
| Boot, battle clock, input | `modules/main.js`, `modules/ui/management.js`, `modules/combat/sim.js` |
| Ship Loadout and gear | `modules/ui/panels/modules.js`, `modules/ui/equipment-picker.js`, `modules/modules/modules.js`, `modules/data/modules.js` |
| Ship Level and Skills | `modules/data/experience.js`, `modules/data/skills.js`, `modules/progression/experience.js`, `modules/progression/skills.js`, `modules/ui/panels/skills.js` |
| Damage, lifesteal, survivability | `modules/combat/world.js`, `modules/combat/player.js`, `modules/progression/stats.js` |
| Credits and artwork | `modules/core/state.js`, `modules/ui/icons.js`, `modules/ui/ui.js` |
| Onboarding | `modules/meta/onboarding.js`, `modules/ui/ui.js` |
| Save compatibility | `modules/core/state.js`, `modules/save/save.js` |
| Navigation, menus, CSS | `modules/ui/ui.js`, `modules/ui/panels/menu.js`, `index.html` |
| Release check | `tools/run_release_gates.py`, `tests/skills-regression.mjs` |

The import map in `index.html` resolves each `@last-orbit/` specifier to a published module path. `tests/loader.mjs` resolves the same specifiers in Node.
