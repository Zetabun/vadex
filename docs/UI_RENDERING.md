# UI and rendering

`modules/ui/ui.js` owns the HUD, navigation and management panel. Ordinary management leaves part of the battlefield visible at 30% combat speed; the paused Command Phase enlarges the panel. Ship Loadout and Skills use the whole viewport and pause combat, since the battle cannot be seen. Back to game and close controls remain at the top. Loadout and Skills link to each other after unlock. The Skills map uses tappable, inspectable nodes and a bottom detail sheet; boon status chips open a small effect card. Arsenal includes a direct Loadout button.

The paper doll renders artwork only for fitted items. Empty and locked sockets keep their outline and status text; inventory cards, picker options and forge choices display equipment art. `modules/ui/icons.js` owns the pixel images and uses the text `¢` for Credits. Decorative artwork has no pointer input. `modules/ui/modals.js` owns focus and blocking dialogs; `modules/meta/onboarding.js` owns tutorial progression.

The renderer reads `G.world` and does not change progression. CSS lives in `index.html`. The import map must resolve each `@last-orbit/` module to its published relative path.
