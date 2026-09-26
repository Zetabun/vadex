# Last Orbit code map

`index.html` is the static page and CSS entry point. Its import map loads `modules/main.js` and the other ES modules from `modules/`. GitHub Pages serves these files directly. Pixel icon data lives in `modules/ui/icons.js`.

| Directory | Responsibility |
|---|---|
| `modules/core/` | Save-state defaults, large numbers, events, formatting and the shared `G` context |
| `modules/data/` | Definitions and tuning: sectors, enemies, bosses, weapons, abilities, cards, relics, ships, Workshop, contracts, balance |
| `modules/combat/` | Fixed-step battle simulation, damage, loot pickups, player, weapons, drones, enemies and bosses |
| `modules/progression/` | Derived stats (`stats.js`), the sortie (`run.js`) and between-sortie spending and contracts (`meta.js`) |
| `modules/save/` | Storage, backup and schema migration |
| `modules/ui/` | HUD, Hangar screens, overlays (level-up, relics, pause, debrief), icons and the debug panel |
| `modules/rendering/`, `modules/audio/` | Three.js presentation and synthesized sound |
| `tests/`, `tools/` | Regression tests, balance bot, import-map builder (which also builds `modules/data/updates.js` from `CHANGELOG.md` through `tools/build_updates.py`) and release gate |
| `api/` | The global boards' server: a Cloudflare Worker (`src/index.js`) over a D1 database (`schema.sql`), deployed on its own with wrangler (`wrangler.toml`), moderated with `admin.mjs` (stats, top, ban, rename, role, reserve); schema changes for the live database go in `api/migrations/`. Not part of the static site's import map; the game reaches it through `modules/progression/global.js` |

A sortie: `startSortie()` creates `G.state.run` from the selected ship. Kills spawn XP, salvage and repair pickups (`combat/pickups.js`); `grantXp()` queues level-ups; the frame loop opens `rollOffer()` and `pickCard()` applies the choice, then `recalc()` rebuilds `G.sheet` and the weapon configs. Clearing a sector's tenth wave queues a relic choice. Death (after any revives) emits `sortieOver`; `endSortie()` banks salvage, updates lifetime stats, completes contracts and returns a debrief summary.
