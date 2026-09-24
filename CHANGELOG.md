# Changelog

## v2.8.0 — unreleased

- **Deep Void anomalies:** past wave 60, every Deep Void sector makes you take one of two anomalies, and they stack for the rest of the sortie. Each raises your salvage and score (+10% to +20%), so how many you can carry is the endless goal. Five bend the numbers (Hardened Hulls, Overdrive, Heavy Ordnance and Forced March stack up to three or two times; Elite Vanguard adds an elite to every wave) and five change the fight: **Serpent Fire** (enemy bolts weave), **Minefield** (the dead sometimes leave drifting mines), **Shrapnel** (the dead sometimes burst into bolts), **Void Lances** (a beam locks onto your lane every few seconds) and **Gravity Wells** (wells open on the defence line and drag you in). They show in the HUD, the pause loadout and the Deep Void sector title. Tuned with a new Deep Void probe over some 1,500 late-game runs: with anomalies, bot pilots fall about one wave sooner in the Deep Void but bring home 6–9% more Deep Void salvage, so a whole sortie pays about 3% more and Overhaul pacing is unchanged.
- **Callsign:** new pilots pick a callsign at first launch (existing pilots are asked once). It sits on the rank card, the app greets you by name when it opens, and it can be changed in Settings.
- **Your orbital station:** a station now hangs in the sky above Earth on the home screen, and it is a picture of your progress. Every Workshop upgrade builds one of its fifteen modules (gun batteries, shield dishes, cargo pods, a repair bay and more): unbuilt modules show as faint outlines, and maxed ones light up. Finishing it (every upgrade maxed) gets its own moment and opens the Overhaul. Each Overhaul rank adds a permanent piece to its core that the reset never takes away: the Command Deck, a habitat ring, a comms spire, solar wings and so on up to a stellar crown at rank 10. It is built like a real station: lattice trusses, windowed modules with gold-foil insulation, radiators, solar wings that catch the light, navigation lights, a shuttle coming and going, and cyan scaffolding where a module is still to be built. Its windows glow at night. It adds no stats of its own.
- **Command Deck:** your first Overhaul opens your own room aboard the station, a small 3D space you walk around: drag to look, tap the floor to walk there (W/A/S/D on a keyboard). A big window looks down on Earth (lit by day, city lights by night, on your own clock). Your medals line one wall, your ships turn on pedestals under your banners, the records screen and the way out are behind you, a trophy for each Overhaul rank sits on the shelf under the window, and a hologram of your station turns on the table in the middle. Tap any of them for the details. Reach it from the new Deck menu, or by tapping the station in the sky on the home screen.
- **Overhaul panel redesign:** a blueprint of your station fills in as you build (the piece the next Overhaul adds is marked in gold), what the Overhaul pays is shown up front, and a roadmap strip shows what every rank brings, starting at the next one.
- **New enemies:** one for each sector from 2 to 6, each with something the main game had not seen: the **Burster** lobs orbs that burst into rings of bolts, the **Sower** drops mines that sink toward your line, **Binders** fly in linked pairs that share every hit (break the pair and the survivor overcharges and fires twice as fast), the **Coiler** spits snaking streams, and the **Warper** swaps places with another invader when badly hurt. They join their sectors a few waves in and all of them roam the Singularity Frontier.
- **Pilot header:** the top left of the hangar now shows your callsign (or rank title) with your rank beneath, instead of the game's name. Tap it for your career.
- **Counterattack:** Hard mode is tuned per stage (Iron Curtain eased, the last two stages made the finale they should be). Stage 6 saves a checkpoint once you beat its mini-boss: resume from there at the level you had reached (a checkpoint run can earn the clear star only). Liftoff's card now says it is flown from Earth.
- The shield bubble only shows in battle, not around your ship in the hangar.
- The menu bar never wraps onto a second row (it pages with Back and More as needed), and the Deck menu stays out of it until your first Overhaul.
- **Earth:** the home world behind the hangar and sector 1 is now Earth, with oceans, continents, polar ice and drifting clouds. At night on your device's clock (from about 6:30pm to 6:30am) it turns to the night side, dark with city lights and road networks. It dims a little during sorties so bullets stay easy to read.

## v2.7.0 — 2026-09-24

- **A sharper opening:** the first waves now press harder without turning enemies into bullet sponges. Sector 1 opens with a fuller formation, more frequent enemy fire and a quicker march, and Stoopers (which dive and fire aimed shots) and Lancers (kamikazes) arrive from waves 2 and 4 instead of 3 and 6. A little extra health on the first dozen waves means a scout takes two or three shots instead of one, and it is gone by wave 13. Early levels come slightly slower. In the bot probes the first three waves last 11–27 seconds instead of 9–21 and actually land hits, and a new pilot's first-death point is unchanged.
- **Menus open up as you play:** a new pilot starts with just Launch. The Workshop opens after the first sortie, the Armory and Career after the second, Ships, Records and Missions after the third (Missions sooner if Counterattack unlocks), and Awards after the fourth. Locked menus show a lock and say when they open; new ones carry a NEW tag and explain themselves the first time they are opened. The launch screen's ship switcher and Daily/Threat row appear with their menus. Pilots already past their first few sorties keep everything open.
- **Next rank reward:** the rank card now shows the next reward as a tag in its own colours, with your ship in the paint job it unlocks.
- **Debrief count-up:** the salvage tally ticks as it counts up, rising in pitch, and lands on a chime.

## v2.6.2 — 2026-09-24 (engine hum in v2.6.3)

- **Smoother motion:** ships, enemies and bullets are now drawn between simulation steps, so movement stays smooth when frames do not line up with the 60 Hz simulation, and uses the full refresh rate on 120 Hz screens. Before, uneven frame timing made the ship step in small jerks that read as a low frame rate.
- **No more magnifier:** touches on the battlefield are cancelled during a sortie, so iOS no longer brings up its magnifier on a long press or a double-tap-and-hold (a dodge, or holding a corner to steer). Text selection is off everywhere except input fields.
- The dash cooldown chip and the thruster sound only update when they change.
- **Engine sound:** the steering sound is now a soft, low engine hum that swells a little as you steer, replacing the hiss (which sounded more like rustling fabric), and it is much quieter.

## v2.6.1 — unreleased

- **Dodge feedback:** the dash now has a proper whoosh (and a soft ping when it recharges; a dud tap while it recharges gives a short buzz). A » chip by the hull bar fills as the dash recharges and glows when it is ready, and a short tip explains dodging in your next two sorties.
- **Thrusters:** a subtle engine hiss rises and falls with how hard you steer.
- **Battle damage:** under 40% hull the ship smokes from its wings and throws sparks, with a flickering red glow; under 20% its wingtips burn.
- **Shield bubble:** an active shield now shows as a bubble round the ship, brighter the fuller it is, flaring when it soaks a hit and bursting when it fails.
- **Redrawn icons:** Pulse Cannon, Lance Laser, Tesla, Railgun, Hollow Points, Tungsten Tips and Singularity Rounds, bolder so they read at the loadout strip's small size.
- **Locked content:** locked paints, banners, trails, Threat levels, Counterattack stages, ships and armoury entries share one matte grey look instead of fading out, and picker labels wrap inside their tiles (the engine-trail row no longer spills over).

## v2.6.0 — unreleased

- **Counterattack stages 2–6 each get a set piece, a new enemy and a boss of their own.**
  - **Graveyard Run:** derelict hulks drift through the field. They are solid and soak up fire from both sides, so they make cover. New enemy: the **Scrapper**, which seeds the lanes with drifting proximity mines. Boss: **Scrapmonger Vorr**, with claw turrets, mine fields, a cutting-torch sweep and flak walls.
  - **Into the Red:** crimson gas banks drift past. Enemies inside are veiled, and aimed fire loses track of a ship hiding in one. New enemy: the **Stalker**, which cloaks and fires orbs that burst into rings. Boss: **The Red Shroud**, which fades out, reappears elsewhere, and fires snaking streams and bursting orbs.
  - **Iron Curtain:** a colossal machine battleship slides beneath you, with deck guns firing fans of three. New enemy: the **Flanker**, which climbs up from behind and fires broadsides when level with you. Boss: **Iron Admiral Kross**, with deck turrets, horizontal broadside beams, sweeping lasers and flak walls.
  - **Hive Breach:** organic walls close in and open out, with spore pods growing on them. New enemy: the **Lunger**, which bursts from the wall at your height and dashes across. Boss: **The Hive Heart**, a beating heart with orbiting tendrils, horizontal lashes and lunger ambushes.
  - **Event Horizon:** the singularity looms over the field. It pulls the ship and bends enemy fire towards it, with a tidal surge now and then. New enemy: the **Riftling**, which blinks through folded space. Boss: **The Unmaker**, with sweeping beams, gravity wells, horizontal beams and flak walls.
  - **Moving up and down matters now:** flying higher hits harder (up to +25% damage at the top of your airspace), and horizontal beams, broadsides and lungers come at your height, so climb or dive to dodge them.
  - **Attack tells:** every boss now winds up visibly before each attack, glowing in the attack's colour as a ring closes in.

- **Overhaul: a prestige loop for the late game.** Once every Workshop upgrade is maxed, an Overhaul panel appears at the top of the Workshop. Overhauling strips the Workshop back to zero for **Blueprints** (5, plus 1 for every 10 waves past 60 you reached since the last Overhaul, up to +5) and raises your Overhaul rank. Ships, weapons, cosmetics, ranks, mastery, medals, records, Counterattack progress and salvage in the bank are all kept.
  - **Escort drones:** Blueprints buy an Escort Bay (up to two) and escort types that fly with you on every sortie, in both modes: Attack, Missile, Repair, Shield, Interceptor and Target Painter. Pick which ones fly from the Blueprints section.
  - **Perks:** Salvage Contracts (+25% salvage per level), Veteran Engineers (Workshop 8% cheaper per level), Head Start (after an Overhaul, Workshop upgrades start up to 3 levels higher; the one-off capstones excepted) and Deep Calibration (+5% damage and hull per level).
  - **Overhaul rank:** each rank adds +10% salvage and +2% damage (up to rank 10), and makes the Workshop 25% dearer, so rebuilds settle at a steady pace. Ranks unlock engine trails (Ion Wake, Ember Sparks, Prism, Gilded, Void Wake) in the Ships tab, and the first Overhaul unlocks the Overhaul Log legendary banner.
  - **Balance:** in the bot probes the first climb is unchanged; after that a strong pilot rebuilds in roughly 10–16 sorties and a weaker one in about 15–22 (never faster than the first climb collapsing to a sortie or two), and buying every Blueprint takes about 150 sorties for a strong pilot and longer for a weaker one.

## v2.5.0 — 2026-09-25

- **Counterattack: a new vertical shooter mode.** Unlocked by defeating the sector 3 boss, and found at the top of Missions. Six stages carry the fight back through the six sectors (about 3–5 minutes each). Fly freely in every direction (drag to move, W/A/S/D on a keyboard), dash through fire, and face squads on scripted flight paths, a mid-stage mini-boss and the sector boss.
  - **Stage 1: Liftoff.** The invaders blockade the home world. Fight your way off the surface past rooftop gun towers and low-skimming interceptors, climbing out over a 3D city that changes as you go: the spaceport (runways, hangars, launch pads), downtown (avenues, stadiums, taller blocks), residential streets with parks and canals, the industrial outskirts (tanks, smokestacks, railways), then the coast and open sea, before the surface falls away and you break into orbit to face the first boss. Low cloud drifts past in two layers with clear gaps between the banks, and over the city enemy fire carries a dark backing so it stays readable.
  - **Briefing:** the first launch opens a short briefing on what the mode is and how it flies (with a diagram of the airspace you can fly in, since the ship moves up and down here), and a flight tip reminds you during your first few stages. Reread it any time from **How it works** on the Missions panel.
  - **Stars:** each stage awards up to three: clear it, take 5 hits or fewer, and destroy 80% of the assault force. Clearing a stage opens the next and a Hard version of itself.
  - **Recommended power:** each stage shows a recommended power level against yours (Workshop levels, ship mastery and Alien Tech). Power helps but skill can carry you. The difficulty climbs steeply: the first stages open up soon after the unlock, the middle ones as your main-mode build deepens, and the last is meant for a near-maxed Workshop (or a very good pilot).
  - **Alien Cores and Alien Tech:** new stars pay Alien Cores, spent on Alien Tech in the Workshop (Xeno Alloy, Phase Drive, Star Charts, Core Siphon). It strengthens both modes. Counterattack only pays modest salvage, so the main mode stays the place to farm.
  - **Exclusive rewards:** a first-clear salvage bounty per stage, the Xeno paint job for clearing stage 6, the legendary Star Map banner (tracks your stars, unlocks at 18), and the feats Counterattack and Home Invasion.
- **A tougher opening.** Enemies in the first sectors have extra health (peaking around waves 6–12, where early upgrade cards pile up, and gone by wave 25), scouts fire a little more often, enemies take their first shot sooner, and the first levels need a little more XP. In the bot probes, the opening waves last about twice as long and a brand-new pilot's first run usually ends around wave 20 instead of 30.
- **New settings cog** in the top corner, replacing the icon that looked like a brightness control.

## v2.4.0 — 2026-09-25

- **Warp start.** Once you've beaten a sector's boss, start sorties at the next sector (up to sector 6) from the Launch card. Warped runs get catch-up upgrade cards and relics for the sectors skipped. Mastery and pilot XP count only the waves you actually fly, and warped runs are tagged on the leaderboard. The Daily Sortie always starts at wave 1.
- **Build synergies.** Every upgrade card now belongs to one of eight themes: Precision, Demolition, Barrage, Ironclad, Aegis, Squadron, Tactician and Scavenger. Holding enough different cards of a theme switches on its bonus, and a second, bigger bonus for the larger themes. Level-up cards show the theme and your progress, and flag a pick that completes one. Completing a theme gets a banner. The Loadout panel lists your synergies and the Armory has a full codex.
- **Dodge dash.** Double-tap a side of the screen (or press Shift or F) to dash that way, untouchable for a moment. Grazing enemy shots cools the dash down faster, and a pulse shows when it's ready.
- **Auto-pick.** When three or more upgrade picks are waiting (such as a warp pre-flight), one button picks them all sensibly: finishing synergies, evolving weapons, preferring rarer cards.
- **Boss intel.** Each defeat by a sector boss adds 8% damage against that boss next time (up to +40%), shown when the boss appears and in the debrief. This softens the wave-40 wall without touching skilled play.
- **Rank insignia.** The pilot rank badge is now an insignia that evolves with your title: steel chevrons, bronze wings, silver shields, gold stars and laurels, and a prismatic Legend badge.

## v2.3.0 — 2026-09-24

- **Score and Records.** Every sortie now scores points for kills and cleared waves (worth more the deeper you go, +50% for flawless waves, +25% per Threat level). The score shows in the HUD, and passing your high score mid-sortie is celebrated. A new Records tab shows your high score, personal bests, a top-10 leaderboard of your sorties, each ship's best and lifetime totals. The debrief shows your score and its place on the leaderboard.
- **Achievements.** A new Awards tab with 19 tiered medals (bronze, silver, gold) for lifetime milestones and 8 feats for standout sorties (a flawless boss wave, a perfect sector, wave 20 with a single weapon…). Every medal pays pilot XP; medals appear as pop-ups when earned and are listed in the debrief. Medals already earned by existing saves are granted on first launch.
- **Loadout panel.** Tap a weapon or relic icon at the bottom of the screen (or Details in the pause menu) to pause and see every weapon, ability, relic, upgrade card and Threat or Daily rule in play, with what each does.
- **More reliable touch steering.** The bottom HUD no longer swallows touches, so holding a bottom corner steers. Every finger is tracked, so a second touch no longer cancels the first. A held finger that drifts keeps holding instead of switching to drag steering.
- **Sound after locking the phone.** Audio is rebuilt on the next touch after the app is hidden, fixing silence after the screen went dark.
- **Workshop keeps its place.** Buying an upgrade no longer scrolls the list back to the top, so rapid taps land on the upgrade you meant.
- **Fixed** locked weapon icons in the Armory drawing outside their cards in iOS Safari.
- **Ship banners.** Eleven cosmetic cloth banners that stream from your ship's tail, swinging as you dodge. Earn them with medals, high scores, a long daily streak and 100 boss kills; pick one in the Ships tab. Awards and Records show the next banner to chase.
- **New app icon.** The home-screen icon now shows the new Vanguard climbing out of orbit with its Royal Standard banner streaming, over a glowing planet horizon with invaders ahead. (Already-installed home-screen apps keep the old icon until re-added.)
- **Five distinct ships.** Every hull now has its own model: the Vanguard arrowhead, the Striker needle with forward-swept blades and twin laser barrels, the four-engined Bulwark slab, the Tempest coil-ring around a glowing core, and the Revenant raptor between twin railgun spines. The ship icons are redrawn to match, with panel detail, canopies, lights and engines. Ships are drawn 30% larger in battle (hitbox unchanged) so detail and banners read on a phone.
- **Ship traits.** Each hull has a unique passive: Vanguard Second Wind (once a sector, survive a big hit), Striker Momentum (kills stack fire rate), Bulwark Stalwart (less damage when hurt), Tempest Static Discharge (every 6th kill arcs lightning) and Revenant Executioner (bonus damage to wounded enemies).
- **Signature evolutions.** At mastery 5, a ship's own weapon can evolve once more past rank 7 (Vanguard Salvo, Starfall Lance, Siege Battery, Thunderhead, Planetcracker).
- **Weapon fusions.** Nine fusions join two fully evolved weapons into a named pair with new behaviour (Twin Suns, Storm Lance, Flak Barrage, Napalm Swarm, Tesla Minefield, Gauss Battery, Singularity Lance, Firestorm, Spectrum). Fused and signature weapons glow in the HUD and are listed in the Loadout panel.
- **Routes.** After each sector boss, choose how to fly the next sector: Steady Course or two of Salvage Run, Elite Gauntlet, Scholar's Path, Overclock, Supply Line and Blitz, each trading a risk for a reward.
- **Share your daily.** A Share button on the daily debrief and the Missions tab sends a spoiler-free result card (sector squares, wave, score, streak) through the phone's share sheet or the clipboard.
- **The wave-60 wall.** Fully upgraded pilots were dying to the Singularity with most of its health left (fights ran up to 15 minutes). It now has 35% less health and four softer, less armoured orbiting plates. Enemy damage also grows more gently after wave 40 (2% a wave instead of 4.5%; waves 1–40 are unchanged). In the bot probes, fully upgraded pilots now pass wave 60 in about a quarter of runs, first doing so around sortie 15 (strong pilot) or 32 (weaker pilot).
- **Legendary banner rows.** The Legendary section is now a roomy list with a big preview, what each banner tracks and the live number.
- **New feats:** Fusion Reactor and Signature Move.
- **Legendary stat-tracker banners.** Seven legendary banners each display a lifetime record live on the cloth: Kill Counter (kills), Headsman (bosses), Deep Record (best wave), Scoreboard (high score), Treasure Log (salvage earned), Ghost Ledger (flawless waves) and Veteran's Log (sorties). They have their own Legendary section in the Ships tab with a turning rainbow rim, pulse with light in flight, and get a special unlock pop-up.
- **Armory mystery.** Weapons and abilities you haven't unlocked stay hidden as "Unknown" until you earn them; contracts only say they unlock "a new weapon".
- **Balance pass.** A headless progression probe (`tests/progression-sim.mjs`) showed a strong bot maxing the whole Workshop in 7 sorties (it cost 34k salvage in total). Early Workshop levels cost the same, but later levels now climb much more steeply (160k for everything; about 25 sorties for a strong pilot, 40 for a weaker one). Ships cost more (800 / 2,000 / 4,500 / 9,000) and pilot ranks need about 45% more XP. The new medal XP adds only ~3% to salvage income.

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
