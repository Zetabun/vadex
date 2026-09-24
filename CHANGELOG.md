# Changelog

## v2.2.0 — 2026-09-24

- **Missions tab.** A new home for the two return loops below. The tab bar now pages with chevrons (More / Back), and a dot on the chevron shows when something on the other page needs attention.
- **Daily Sortie.** One attempt a day on a seed shared by every pilot, with one of eight twists (Glass Cannon, Overclock, Loaded, Elite Squadron, Carrier Group, Veteran Start, Blood Moon, Rush Hour). Finishing pays a salvage bonus that grows with the wave reached and your day streak, and doubles pilot XP.
- **Threat levels I–X.** Once you reach sector 4, stack extra rules (tougher, faster, more elites, weaker hull) for up to +200% salvage and +150% pilot XP. Each level opens by beating the wave 40 boss at the level below.
- **Ship Mastery.** Every ship levels up with the waves it flies: +2% damage and hull per level, an opening card at 3, a reroll at 6 and a Prime paint job at 10.
- **Late-game contracts and paints.** Eleven new contracts (dailies, streaks, mastery, threat, owning every ship, wave 100) and ten new paint jobs.
- **Controls.** Hold the left or right side of the screen to fly that way; sliding your finger switches to drag steering as before. Toggle in Settings.
- **Paint jobs** now recolour the whole ship (deck, wings, hull, markings and engine glow), not just the trim lights.
- **No more double-tap zoom** on menus, cards and buttons in iOS.
- **Smoother frames, identical visuals.** Glow and particle batches upload only the sprites in use each frame (previously ~250 KB per frame regardless), particle removal no longer allocates, and floating combat text no longer re-parses its font per number.

## v2.1.2 — 2026-09-24

- Second fix for the iOS home-screen app stopping short of the bottom of the screen: the page root now grows to the full screen as well, with a `display-mode: standalone` CSS fallback.
- Settings shows a small display readout (version, app or browser, screen and window size) to help diagnose layout on specific devices.

## v2.1.1 — 2026-09-24

- Fixed the home-screen (installed) app on iOS stopping short of the bottom of the screen, which left a strip below the tab bar and cut off its labels.

## v2.1.0 — 2026-09-24

- **New artwork.** Every weapon, ability, card, relic, Workshop upgrade and ship has its own hand-drawn vector icon in one consistent style (`modules/ui/art.js`), replacing the reused pixel sprites. Salvage has a proper icon instead of the ¢ text symbol. The page is about 430 KB lighter.
- **Home-screen app.** Added an app icon, favicons and a web app manifest, so "Add to Home Screen" on iOS and Android shows the Last Orbit icon and launches full-screen.
- **Pilot career.** Every sortie earns pilot XP. 40 ranks with titles from Cadet to Legend pay salvage or unlock one of ten cosmetic paint jobs for your ship. The Contracts tab is now Career, with the rank track; paint jobs are chosen in Ships; the debrief shows XP earned and rank-ups.
- **Notifications.** Contract alerts are now full-width cards with the unlocked item's artwork and reward. Fixed Safari squeezing them into a narrow column, and they no longer cover level-up and relic screens.
- Screenshot and icon tools: `tools/shoot.mjs` captures phone-sized screens through headless Chrome; `tools/render-icons.mjs` renders the app icon sizes; `tools/icons.html` previews the artwork set.

## v2.0.0 — 2026-09-24

A ground-up redesign of progression and interface. The combat engine, enemies, bosses, weapons and artwork carry over.

- **Roguelite sorties.** Runs through ten-wave sectors with elite/mini-boss, convoy and boss waves. Death ends the sortie; salvage is banked either way.
- **Auto-fire and pickups.** Guns fire on their own; steering, dodging and target focus are the skill. Kills drop XP orbs, salvage canisters and repair kits that fly to the ship.
- **Level-up cards.** Choose new weapons, weapon ranks (every rank is an evolution), abilities and 30 stackable modules. Relics after every sector boss.
- **The Hangar.** Launch, Workshop (15 permanent upgrades), Armory, Ships (five hulls with their own gun and ability) and Contracts (24 goals that pay salvage and unlock weapons, abilities and ships).
- **New interface.** Glass-over-space HUD with wave pips, XP and boss bars, a loadout strip and round ability buttons; a close-up ship camera in the Hangar; card, relic, pause and debrief screens.
- **Removed** credits, scrap, research data, 13 ores and bars, smelting, foundry, recovery fleet, projects, modules, skills, Rewind/Ascension, automation and offline progress.
- Fixed a crash when a boss death cleared hazards while they were being updated.
- New regression suite (`tests/sortie-regression.mjs`) and a headless balance bot (`tests/balance-sim.mjs`).
- v2 uses separate save keys; players with a v1 save receive a one-time salvage gift.

## v1.24.0 — 2026-09-23

- Moved active abilities, Foundry supplies, buffs, debuffs, boons and combat rates into a compact drawer above the hull and shield bars.
- Reduced ability and effect icon sizes, and show active ability effects as text so Overdrive artwork appears only once.
- Kept the ability tutorial accessible by opening the drawer when it teaches Overdrive.

## v1.23.0 — 2026-09-23

- Prevented iOS text selection and magnifier callouts on non-editable game controls while preserving text fields.
- Moved Shield Capacity to Wave 3, strengthened its early levels, and moved Shield Recharge to Wave 6. The blue shield bar remains above the green hull bar.
- Turned the left buff list into a collapsible combat status tray with buffs, debuffs, boons and combat rates.
- Added a Scrap amount pop-up when the Salvage rig collector reaches a drop, matching the single payout awarded at the kill.
- Added focused checks for early shield absorption, capacity scaling and collector payout.

## v1.22.0 — 2026-09-23

- Added a small Salvage rig collector that chases Scrap falling from rewarded enemies.
- Added a Repair Nanite service craft that beams and sparks against the hull while it heals.
- Kept Scrap payout, repair rates and combat drone slots unchanged.

## v1.21.0 — 2026-09-23

- Made every paused between-wave management panel use the full game screen, with navigation and Start Wave controls in reach.
- Fixed equipment picker previews that rendered stat elements as `[object HTMLDivElement]` text.
- Added weapon damage, crit rate, crit hit, fire rate and estimated DPS to Loadout and Arsenal.
- Added a full-screen Ship Level roadmap from the XP control, with live progression and clearly marked future reward placeholders.
- Restored audio when a player returns through a menu tap or keyboard input, and removed cut corners from Upgrades controls.
- Split crowded mobile bottom navigation into two pages with chevrons, following the selected menu and newly unlocked items.

## v1.20.0 — 2026-09-23

- Restyled live Upgrades as a mobile ship command console with illustrated upgrade plates, shaped category controls, glowing milestone tracks and clearer purchase buttons.
- Kept the battlefield visible during tactical shopping and enlarged the tactical-time and navigation controls to match the new visual language.
- Versioned module URLs so the hosted game loads the refreshed interface.

## v1.19.0 — 2026-09-23

- Added a Mining Drone that extracts extra Ore from enemies and a Target Painter that marks enemies for modest bonus damage. Only one specialist may be fitted at a time; swapping it preserves other drones.
- Hold mode now mines the discovered Ore selected in Smelting, letting players revisit earlier recipes. Mining and marking have distinct battlefield effects. Manual target painting remains stronger.
- Gave six early refined Bars permanent, capped ship upgrades. Moved the Auto-loader to Wave 12 and Output Conveyor to Wave 22 to reduce repeated smelter chores.
- Added the Lunar Passage project at Wave 30. It consumes 40 Palladium Ore, one Iridium Bar and one Boss Core; Wave 40 cannot lead to the Lunar Graveyard until it is built. Existing saves already past Wave 40 keep access.
- Added a compact combat route tracker, chart-style construction view and progression briefings. Updated offline progression, save migration and regression coverage.

## v1.18.2 — 2026-09-23

- Turned the Skill Tree into a draggable, zoomable web with connected branches, cross-links, map jump controls and future-path placeholders.
- A perk now opens when any adjacent purchased node connects it to the Pilot Core; Wave 8, 12 and 20 tier gates and point costs remain in place.
- Updated the Skills lesson and help text to explain exploring and building along connected paths.
- Versioned module URLs so the hosted game loads this release without retaining older cached modules.

## v1.18.1 — 2026-09-23

- Replaced the Skill Tree list with a full-screen, mobile-first pilot-core map. Tap nodes to inspect their rank, effect, prerequisites and next value before spending a point.
- Staged perk tiers at Waves 8, 12 and 20 to match the opening, Research and pre-Rewind difficulty curve; existing saved ranks remain valid.
- Added tap details for active boon chips, including the per-stack effect and stack count.
- Added a direct Go to Loadout button in Arsenal so unlocked gear is easy to fit.

## v1.18.0 — 2026-09-23

- Expanded Ship Loadout to the full viewport, with Back to game and close controls at the top. Combat pauses while the battlefield is covered.
- Empty or locked paper-doll slots now show blank sockets. Fitted modules show the artwork of the actual equipped hardware; equipment and forge choices retain their icons.
- Restored the `¢` Credits mark instead of the ingot image.
- Added a run Skill Tree unlocked at Wave 8, with 12 capped perks across Offence, Defence and Utility. Every second Ship Level from Level 3 earns a point; prerequisites gate deeper ranks. Vital Siphon heals from actual damage with an 8% hull-per-second cap. Free respec lets players try builds.
- Added the Skills briefing and guided first point to onboarding; migrated in-progress tutorials and saves to schema 13.
- Published readable ES modules and a focused release test alongside the GitHub Pages entry point.
