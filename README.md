# Last Orbit

Last Orbit is a browser orbital-defence roguelite. The live page is [zetabun.github.io/vadex](https://zetabun.github.io/vadex/).

## How it plays

- **Sorties.** Launch from the Hangar and hold the line against formations of invaders. Your guns fire automatically; drag (or use A/D) to steer, dodge and line up shots, and tap an enemy to focus fire.
- **Level up mid-fight.** Kills drop experience orbs. Each level offers a choice of cards: new weapons (up to four), weapon ranks that evolve each gun, abilities and passive modules.
- **Sectors and bosses.** Every sector is ten waves: an elite or mini-boss at wave 5, a salvage convoy at wave 8 and a sector boss at wave 10. Beating a boss offers a choice of three relics. After sector 6 the Deep Void is endless, and each Deep Void sector makes you take one of two anomalies: they stack, and each raises your salvage and score.
- **Salvage.** Salvage canisters, wave clears and bosses pay salvage. It is banked when the sortie ends, win or lose.
- **The Hangar.** Spend salvage on permanent Workshop upgrades and new ships. Contracts are the long-term goals: each pays salvage and unlocks a weapon, an ability or a ship.
- **Career.** Every sortie earns pilot XP; 40 pilot ranks pay salvage and unlock paint jobs for your ship. Each ship also earns mastery as you fly it.
- **Missions.** A Daily Sortie with a daily twist and a streak bonus, and Threat levels I–X for experienced pilots.
- **Records and achievements.** Every sortie scores; beat your high score and climb your own top 10. Earn bronze, silver and gold medals and one-off feats.
- **Install it.** Add the page to your home screen for a full-screen app with its own icon.

## Source layout

`index.html` contains the page shell and CSS. Its import map points to the readable ES modules in `modules/`. The pixel artwork is embedded in `modules/ui/icons.js`, so the published page needs no asset directory. GitHub Pages serves the repository root from `main`.

## Run locally

From the repository root, start a static server and open its URL:

```bash
python -m http.server 8000
```

Three.js and fonts load from CDNs. Add `?debug=1` for a sandboxed test panel (it saves to a separate slot).

## Test

```bash
python tools/run_release_gates.py
```

The gate checks the import map, every module's syntax and the regression suite. `npm run balance` flies bot sorties headlessly and reports where they end (arguments: runs, Workshop level, ship, `fresh|some|all` unlocks, dodge skill 0-3). After adding or removing a module, run `python tools/build_importmap.py <version>`. `node tools/shoot.mjs <outDir> [scene…]` captures phone-sized screenshots and `node tools/render-icons.mjs` regenerates the app icons from `icons/icon.svg` (both need the local server).

Current build: **v2.5.0**; save schema **23** (v2 saves use their own storage keys and never overwrite a v1 save).
