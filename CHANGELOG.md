# Changelog

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
