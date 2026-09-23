# Last Orbit code map

`index.html` is the static page and CSS entry point. Its import map loads `modules/main.js` and the other ES modules from `modules/`. GitHub Pages serves these files directly. Pixel icon data lives in `modules/ui/icons.js`.

| Directory | Responsibility |
|---|---|
| `modules/core/` | Persistent state defaults, large numbers, events, formatting and runtime context |
| `modules/data/` | Game definitions and balance, including the XP curve and Skill Tree |
| `modules/combat/` | Fixed-step battle simulation, damage, player, weapons, enemies and bosses |
| `modules/progression/` | Economy, derived stats, XP, Skills and producers |
| `modules/modules/` | Generated gear, fitting, salvage and forging |
| `modules/meta/` | Onboarding, goals and achievements |
| `modules/save/` | Storage, backup and schema migration |
| `modules/offline/` | Away-time approximation |
| `modules/ui/` | Navigation, panels, dialogs, artwork and management layout |
| `modules/rendering/`, `modules/audio/` | Visual and sound presentation |
| `tests/`, `tools/` | Regression test and release gate |

`G.state.run.skills` holds current-run ranks. `skillPoints()` derives unspent points from Ship Level. `modules/ui/panels/xp.js` presents the level roadmap, and `modules/ui/weapon-readout.js` estimates fitted weapon DPS from combat configurations. `computeSheet()` applies skill bonuses. `hitEnemy()` applies capped lifesteal from actual enemy health removed. Rewind creates a new run, clearing skills and XP.
