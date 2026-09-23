# UI and rendering

`modules/ui/ui.js` owns the HUD, navigation and management panel. Ordinary management leaves part of the battlefield visible at 30% combat speed; the paused Command Phase fills the viewport above the navigation bar and keeps Start Wave available. Upgrades uses a ship command console layout with rectangular controls. Ship Loadout, Skills and Ship Level use the whole viewport and pause combat, since the battle cannot be seen. Back to game and close controls remain at the top. Loadout and Skills link to each other after unlock. The Skills map has connected, draggable and zoomable branches, jump controls, tappable nodes and a bottom detail sheet; boon status chips open a small effect card. Arsenal includes a direct Loadout button and weapon stats. Ship Level shows earned bonuses and future reward placeholders.

At mobile widths, the bottom navigation displays up to four unlocked destinations at once. A chevron opens the next page, and opening a menu moves navigation to that menu's page.

The paper doll renders artwork only for fitted items. Empty and locked sockets keep their outline and status text; inventory cards, picker options and forge choices display equipment art. `modules/ui/icons.js` owns the pixel images and uses the text `¢` for Credits. Decorative artwork has no pointer input. `modules/ui/modals.js` owns focus and blocking dialogs; `modules/meta/onboarding.js` owns tutorial progression.

The renderer reads `G.world` and does not change progression. CSS lives in `index.html`. The import map must resolve each `@last-orbit/` module to its published relative path.

The combat HUD shows a compact Lunar Passage tracker after Wave 30. It opens Ship Projects, where the passage appears first as a star chart with three resource meters. Mining and Target Painter drones have different colours; mined enemies receive an amber ring, and drone-marked enemies a magenta reticle.

Purchased Salvage rigs add a small collector craft that flies to visual Scrap drops from enemies. Purchased Repair Nanites add a service craft beside the player; its green beam and hull sparks appear while passive regeneration restores hull. Scrap is awarded on kill and healing is applied in combat simulation, independently of the cosmetic effects. Support craft consume no combat drone slots.
