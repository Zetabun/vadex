# UI and rendering

`modules/ui/ui.js` switches `#app[data-mode]` between `hangar` and `sortie`, owns banners, toasts, screen flash and the damage vignette, and tells the renderer how much of the screen the battlefield may use (`setInsets`). The renderer has two camera framings (`setView('field' | 'hangar')`): the whole battlefield during a sortie, and a close-up of the ship above the Hangar's Launch card.

`modules/ui/hud.js` is the sortie HUD: pause, sector name, ten wave pips (elite/mini, convoy and boss pips are tinted), salvage collected, XP bar and level, a boss bar while a boss lives, the loadout strip (weapon icons with rank pips, and relic icons), shield and hull bars, and round ability buttons with a conic cooldown. A short flight hint appears in the first waves of a pilot's first sorties.

`modules/ui/hangar.js` builds the five Hangar screens and the bottom tab bar; tabs show a gold badge when something there is affordable. `modules/ui/overlays.js` owns every blocking moment: level-up cards (keys 1-3, R to reroll), relic choice, pause, settings, abandon and erase confirmations, and the debrief with a salvage count-up. Any open overlay freezes combat.

The renderer reads `G.world` and never changes progression. Pickups are drawn from `world.pickups`; the ship's optional parts (wings, pods, armour, fins, crown) appear as the run's build grows, and its trim takes the selected ship's colour. CSS lives in `index.html`, built on a small token set (`--cyan` ship and primary actions, `--gold` salvage and rewards, `--green` experience, `--red` hostile). Pixel icons come from `modules/ui/icons.js` (`iconKey('weapon:laser')`).
