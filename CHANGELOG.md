# Changelog

## v2.27.0

- **Pick up a sortie where you left off.** If the game closes in the middle of a sortie (your phone closing it in the background, or you swiping it away), the next time you open it you can resume from the start of the wave you were on, with everything you had then: your cards, relics, route, hull and salvage. Or end it there and get your full debrief, with pilot XP and medals (before, only the salvage was kept). Counterattack stages are still banked as before.
- tests/resume-regression.mjs covers the checkpoint, the offer, resuming and ending it.

## v2.26.2 — 2026-09-26

- **Lighter on your phone's memory aboard the station.** Every room you visited used to stay loaded until the app closed: all twelve together came to about 150 MB of graphics memory, enough to crash the game on an older phone after a long walk round the station. Now only the room you are in and the last two you came through stay loaded. A room further back is rebuilt in a moment when you return, Bolt and all.
- rendering/room.js Room.dispose and disposeScene; rendering/renderer.js keeps the last three rooms (ROOM_KEEP). How the memory was measured is in TESTING.md.

## v2.26.1 — 2026-09-26

- **Fixed: your badge on the global boards shows straight away.** After signing in with a pilot key, and whenever you rank up, the game now sends your rank to the boards itself. Before, it only went up with a new best score or when you looked at the boards, so a fresh save with Records still locked could leave you with no badge.
- tests/global-regression.mjs checks that signing in and ranking up send the rank.

## v2.26.0 — 2026-09-26

The Cipher: the finale.

- **The Cipher (a new room aboard, in the Stellar crown at Overhaul rank 10).** The crown's great crystal hears the signal from past the Deep Void. Bring home signal fragments and decode them here one at a time by tuning the signal: match its frequency, phase and strength. Each fragment lights a glyph and reads out a line of a message. The walls keep the message so far, and a chart of where it points. Its door is on the left of the Beacon array.
- **Signal fragments from Void bosses.** Deep Void expeditions still find them, and now a Void boss sometimes drops one when it falls (a notice says so, and the debrief counts them). Once the message is whole, each fragment decodes into an echo worth a Blueprint.
- **The Origin: a hidden sector.** Read all seven glyphs and, on any Deep Void run, one of the routes is to follow the signal: ten waves past the edge of the charts, under a pale sun, as strong as the Deep Void sector they take the place of. The Scribe waits halfway.
- **The Cipher: the final boss.** At the end of the Origin waits the thing that has been sending the signal. It fights in the voices of the bosses it watched you beat: Bastion's beams, the Wyrm's rain, the Dreadnought's shells, the Oracle's blinks and the Singularity's wells, then all of them at once. Beating it the first time pays 10 Blueprints, the Keeper paint and the Keeper title; after that, 2 Blueprints each time.
- **Keeper of the last orbit.** The first win brings a finale, your title becomes Keeper, and the News covers it.
- **Records tells you how to get your callsign back.** If the boards show you as Pilot because your callsign belongs to another pilot key (from an earlier save or another device), Records now suggests signing in with that key.
- tests/cipher-regression.mjs covers decoding, the route, the Origin, the Cipher's voices and its rewards; tests/cipher-probe.mjs duels it against the Void bosses at the same depth (at wave 70 with a strong late-game build: the Cipher about 260 s, 7 of 8 beaten, beside the Choir 270 s and Mirror Host 230 s). Debug scenes cipher[...], route:signal, origin[:scribe|boss], debrief:cipher.

## v2.25.2 — 2026-09-26

Fixes and polish.

- **Fixed: the opening no longer plays again by itself.** After erasing a save, the opening cinematic came back on some later launch, even ranks into the new save. Erasing now remembers you have seen it, and the opening only plays by itself for a pilot who has not flown yet. Settings > Story > Watch intro still plays it whenever you like.
- **Fixed: long paint names no longer break in half.** "Greenhouse" and "Lightkeeper" split mid-word on the Ships screen on a phone. Paint, trail and banner names now shrink a touch to fit on narrower phones, and every screen was checked at three phone sizes for words broken in two.
- **Enemy shots without the trails.** The streak behind each enemy shot was busy rather than helpful, so it is gone. Shots stay red, with a dark rim and a hot core, and still look nothing like drops.
- **ORBIT keeps quiet while you are on the guns.** In the Station Siege its messages covered the Missile button, and talked about other things mid-fight. It now saves them for when you leave the gun seat.
- **Records tells you when the boards cannot show your callsign.** If your callsign is reserved, taken or not allowed on the global boards, Records > Global now says the boards show you as Pilot, and why. Your scores still go up; pick another callsign in Settings to show yours.
- **More News on the Command Deck TV.** New stories about your place on the global boards and in today's Daily, your Daily streak, the field kit, a ship in the dry dock or home damaged, a new room waiting for your first visit, and Bolt's latest outfit. Eight new station stories run between them.
- tools/overflow.mjs also lists words broken across two lines; tests/news-regression.mjs covers the new stories, and tests/playtest-regression.mjs the opening after an erase.

## v2.25.1 — 2026-09-26

Changes from playtesting.

- **Drops no longer look like enemy fire.** Enemy shots now trail behind them and have a dark rim around a hot core, so you can see they're incoming. Drops are solid shapes that bob gently, with a white sparkle ring and a glint now and then. The repair kit is now a green cross; red is only ever the enemy's colour.
- **Enemy shots are red, with a Settings option to make them flash.** All enemy fire is now red by default, the colour that means danger, and nothing else in a battle is red. Settings > Enemy shots can make them pulse between red and white for the most visibility, or bring back the old colours by type.
- **The rocks in the background are clearly background.** In the Lunar Graveyard they sit further back, smaller, fainter and slower. They were never dangerous, but they looked like they might be.
- **Fixed: the next wave no longer starts while you're choosing cards.** When XP orbs landed just as a wave was cleared, the next wave could march in before, or between, your level-up choices. Now it waits until every card, relic and route choice is made.
- **Boss shots hit harder,** half as hard again as an invader's, and they're drawn a little bigger so you can tell them apart.
- **Diving enemies crash into you.** A Stooper that dives into your ship now does real damage and is destroyed. A Lancer's suicide run hits harder (6 damage, up from 4). Kill them or dodge them.
- **Refits explained properly.** The first time refits appear, they're explained in three short steps: bring home materials, refit a ship, give it time in the dock. Every ship's Refits panel has a "How refits work" link to see them again. The explanation now waits if something else is on screen, instead of being missed.
- **Fixed: menus no longer show the station's debris through their bottom edge.** Where a menu list fades out at the bottom (more to scroll), it now fades into darkness instead of into the scene behind, which looked like sparks sitting on top of the menu.
- Balance check (bots, median wave reached): new pilot 30 → 27, mid-game 40 → 40, maxed Workshop 53 → 50.

## v2.25.0 — 2026-09-26

- **Pilot key: sign in to your place on the global boards.** Settings > Pilot key shows a key for your pilot on the boards: your name, tag, rank badge and scores. Copy or share it and keep it safe, like your backup code. On another device, or after starting a fresh save, paste it under "Sign in with a pilot key": the game shows whose it is, and once you confirm, that device posts as you and takes your callsign. Its own progress stays as it is, unlike a backup code, which brings a whole save across.
- **Your rank badge on the boards is the highest rank you have reached,** so signing in on a fresh save never lowers it.
- **Reserved names.** Some names belong to one pilot only (and a few, like Dev, Admin, Moderator and ORBIT, to nobody). Anyone else using one shows as Pilot on the boards, as does any name that sounds official (admin, moderator, developer, official, Last Orbit). Nobody can pass as the developer or a moderator.
- The boards server gained a pilot lookup for signing in, reserved names, and admin commands to reserve and free names (api/admin.mjs reserve, unreserve, reserved).

## v2.24.0 — 2026-09-26

- **What's new.** When an update lands, the settings gear shows a red "!". Settings now has two tabs, Settings and Updates. Updates lists every update so far, newest first, back to the original game, with the ones you haven't seen marked New. Opening it clears the "!".
- **Rank badges on the global boards.** Every pilot's rank badge now sits beside their name, in Records > Global and on the Deck TV's Boards channel. It is written with every score you post and refreshed whenever you look at the boards, so a rank-up shows straight away. Pilots who haven't played since this update show their badge after their next sortie or look at the boards.
- **DEV tag.** The game's developer shows a DEV tag beside their name on the boards. Only the boards' server can give one out.
- **Erasing your save keeps your place on the global boards.** Your entries, name tag, badge and any DEV tag stay with you; type your callsign again after starting over. Moving to another device is still done with your backup code.
- **Fixed:** on a short screen, the station's name and its line no longer run across the ship card on the Launch screen; they wait until there is room.
- **ORBIT on the field kit.** Pilots who flew before the field kit get a word from ORBIT about the supply meter and where to find the kit.
- The release checks now refuse a release without its dated changelog entry (which the Updates tab is built from) and up-to-date version notes in the docs.

## v2.23.0 — 2026-09-26

- **Field boosts.** Short, strong boosts you time yourself, packed in supply canisters.
  - **The supply meter** sits beside your loadout during a sortie and fills as you damage invaders (elites and bosses fill it faster). Each time it fills, a canister lands in your **field kit** and the next fill takes a little longer, so a sortie brings home two to four.
  - **Tap the kit** (or press K) to open it: the battle waits while it is open. Pick a boost and it starts at once. The kit keeps what you don't use for later sorties, up to five of each; a canister for a full slot is sold for salvage.
  - **Six boosts,** each with its own icon:
    - **Salvage Surge:** +50% salvage for 60 seconds.
    - **Data Burst:** +50% XP for 60 seconds.
    - **Prospector:** materials count twice for 90 seconds.
    - **Overcharge:** +50% damage for 45 seconds. Save it for a boss.
    - **Tractor Pulse:** pickups fly to you from five times as far for 60 seconds.
    - **Hull Patch:** repairs 35% of your hull at once.
  - **Running boosts** show beside your loadout as a small icon with the time left, pulsing in their last few seconds. Using one that's already running adds its time, up to two doses' worth.
  - **Canisters turn up elsewhere too:** about a third of expeditions bring one home, and Bolt finds one every five games of fetch.
  - **Your first canister** comes with a note on where it went and how to use it. The Armory has a new Field kit section showing what you hold and what each boost does, and the debrief lists the canisters a sortie brought home.
  - Main sorties only: not in the Daily Sortie (so the global board stays a fair race) or Counterattack.
- **The Daily Sortie shares its luck.** Level-up cards, rerolls, relic and route choices in the Daily are now drawn from the day's seed, so every pilot gets the same draw at the same point. Pilots flying the same ship with the same unlocks who pick the same way see exactly the same cards. Your own upgrades still count.

## v2.22.0 — 2026-09-26

- **Global boards.** Your scores now go up against every pilot's, on any device. Records has a new Global tab next to your own records, with three boards:
  - **Today's Daily:** everyone flies the same Daily Sortie, so this is the fair race. One attempt each, so your first score stands. The day's twist is shown with the board.
  - **Yesterday:** yesterday's Daily, with its final standings.
  - **All-time:** every pilot's best sortie, with Threat and warp start shown.
  - Each board shows the top 50 and how many pilots are on it. Your own row is highlighted, and if you're further down it's pinned under the top 50 with your rank.
  - You post under your callsign, with your station's name. Without a callsign you show as Pilot; add one in Settings. Names are tidied like a callsign, and rude ones are replaced with Pilot.
  - **Name tags.** Every pilot gets a four-character tag from the boards. When two pilots on a board have the same name, both show their tag (Ace #4F2A, Ace #91CX); otherwise names stand alone. No two pilots ever share a name and a tag, so nobody can pass as someone else by copying their callsign.
- **Posting is automatic.** After a sortie, a Daily goes up to its day's board, and a new best goes up to the all-time board. The debrief says where it landed (for example "Daily #12 of 340 · All-time #88 of 1,204"). Offline, the score waits in your save and goes up the next time the boards can be reached, so nothing is lost.
- **Joining.** Once Records is open, a notice says you're on the boards and what name you post under, and your best sortie so far goes straight up to the all-time board.
- **Moving to another device:** your backup code (Settings, Save backup) carries your place on the boards, so restoring it on another phone or a PC keeps you the same pilot. The backup screen now warns not to share the code, since it is your save and your place on the boards.
- **Settings has a Global boards switch.** Turning it off takes you off every board, and your scores stay on your device. Turning it back on puts your best back up.
- **A Boards channel on the Command Deck's TV.** A sixth channel button shows today's Daily and the all-time board in turn, ten seconds each, with the top eight. Your row is picked out, and if you're further down your own place is pinned at the bottom. Tapping the screen on this channel opens the full boards in Records.
- **Behind the scenes:** the boards run on a small server of their own (a Cloudflare Worker with a database), separate from the game's site. It checks each score against the wave reached, the time taken and the kills, so impossible scores are refused. It takes one post every few seconds from a pilot. If it's down or busy, the game carries on as normal and the boards just say they're out of reach. Your id is random, is made on your device, and is never shown to anyone.

## v2.21.0 — 2026-09-26

- **Bolt comes with you.** The maintenance drone from your quarters now follows you through every room aboard, once you have met it there. It flies in through the door behind you and keeps to the lower right of your view (on a phone as well), clear of walls and furniture. When you stand still for a while it drifts off to look at something, then comes back.
  - **New look:** an expressive eye (happy, love, sleepy, surprised, dizzy, curious), fins, a hover glow and a pulsing antenna. It turns to look at you and banks as it flies.
  - **Pat it:** it spins or hops. Pat it a few times in a row and it gets giddy, with heart eyes and hearts, and nuzzles up to you. Pat it too many times and it gets dizzy.
  - **Its corner in your quarters,** by the head of your bunk: a locker, a charging dock where it naps while you rest (or when you tap the dock), and a toy on the rug. Tap the toy and Bolt plays fetch.
  - **It talks:** its beeps, with ORBIT's translation, in its own orange speech box and a higher, quicker voice. It has lines for when you come back from a sortie (a new best, a loss, the line broken, cutting it short), after a long time away, late at night and first thing, for the first time it comes into each room, and for pats, games, naps and new outfits. None repeats until all of its kind have been said. ORBIT has more to say about it too.
  - **Bolt notices things,** and tells you about them. It knows when a ship is home, hurt or still out in Fleet Ops, when something is in bloom or the beds are dry in the Greenhouse, when a bounty is ready to claim, when a system is still down after a siege, when there is a depth to chart, a Chimera stage you can fund, a refit or a ship you can afford, when your bunk is made, and what the Daily Sortie is. It also has something to say about whichever room you are in (your best wave on the Deck, the bosses beaten in the Hall, the keepsakes on your shelf, and so on). When it has news that matters, a "!" pops up over it and it flies up and tells you by itself, without waiting to be tapped. Tap it when it has a "!" and you hear the news first. It never talks over ORBIT or a panel, says one thing at a time, and lets news rest for a while once told.
  - **Dress it up:** 23 pieces to find, across paints, hats and eye colours. They're earned by playing: sorties, sectors, bosses, the Deep Void, the Daily Sortie, the Greenhouse, expeditions, sieges, your pilot rank, Overhauls, pats and games of fetch. The locker shows what each is for, and you can leave Bolt at home if you prefer.
- **The Command Deck's TV has channels.** A row of buttons under the screen switches it between five, and the same buttons sit at the top of the full-screen replay:
  - **Last:** your most recent sortie (its last minute and a half).
  - **Best:** your furthest run, kept until you beat it.
  - **Boss:** the minute before the last boss you beat, and a few seconds of it blowing up.
  - **Daily:** your latest Daily Sortie.
  - **News:** ORBIT News, the station's own channel. Stories from your game (a new record, the line breaking, how your last sortie went, the rebuild, ships out on expeditions, sieges, Void bosses, the Greenhouse, bounties, even Bolt) take turns with the station's lore, weather, sport and adverts, with a ticker of your numbers along the bottom. Stay and watch: there's no reading it all at once.
  - Pressing a channel button pushes it in and lights it up, and the TV cuts over through a burst of static (with a click and a hiss). A channel with nothing on it yet shakes its button instead.
  - Channels with nothing on them yet are dimmed, and the TV remembers which one you left it on. With nothing recorded yet, it shows the News instead of going blank.
- **The shield bubble is what gets hit.** The bubble round your ship used to be drawn about four times wider than the part that could actually be hit, so shots flew straight through it. Now it's drawn just outside the ship's wings, and while your shield is up, any shot that touches the bubble hits the shield and sparks where it lands. With the shield down, only the ship's own small hit circle counts, as before. In bot runs it made no measurable difference to how far pilots get: the shield takes more hits, but it recharges, and the hull is as hard to hit as ever.
- **Refits take time.** A ship's refit is done in the dock now: 20 minutes for the first, then 40 minutes, an hour, two hours and three hours for the last. It keeps going with the game closed. One ship at a time, and while she is in, she can't fly or go on an expedition: fly another ship meanwhile (buying a refit for the ship you fly switches you to another if you have one). Need her anyway? Take her out: the refit waits with what is done, and she goes back in after the sortie. Each ship's card shows how it is going, and a notice says when she is out.
  - Once the Shipyard is open, a ship in for a refit sits on the cradle in the dry dock with the welders at her, and the console counts down. Before that, the crews do it in the hangar.
  - Bolt keeps you posted on how the crews are getting on.
- **Door fixes:** a door's control panel no longer sinks into a wall, a corner or a wall beam; it moves to the free side. In low rooms, door signs stand in front of the light strip along the top of the walls instead of behind it.
- The note under the materials in the Ships menu has room to breathe.
- **Card synergies explain themselves.** The strip on an upgrade card that said something like "Demolition 1/3" now shows the set as pips (the cards of it you hold, and this one glowing) and says in words how many more different cards its bonus needs after this one, and what the bonus does. For example: "2 more after this for its bonus: 20% more kills explode, +25% blast radius".

## v2.20.0 — 2026-09-26

- **Warping no longer means picking 25 cards.** Warping past sectors (or starting a late Counterattack stage) still gives you the same catch-up, five upgrades for every sector skipped plus a relic each, but now you make two choices instead of one per card:
  - **A focus:** Firepower (more guns, higher ranks, crits and explosions), Survival (hull, armour, shields and repairs) or Tech (drones and abilities). The crew fits the catch-up cards and relics towards it, with the same judgement as Auto-pick.
  - **A warp perk**, one of three and only found on a warp: Slipstream (+35% salvage, but the invaders are tougher), Afterburners, Warp plating, Big-game hunter, Target lock, Navigator's log or Escort wing.
  - Then you see the build you're launching with. "Pick all the cards myself" is still there if you want the old way.
- **Breaches end runs.** Each sector can be breached three times. An invader reaching the bottom line still costs 20% hull, and it's now also a strike against the sector; invaders landing together count as one breach. The third breach breaks the line and ends the sortie, and no revive saves it. Clearing the sector resets the count. Three markers by the ability button show how many breaches are left, pulsing red on the last one, and the debrief says when the line broke. Counterattack has no line, so it's unchanged.
- **Fixed: the bottom of a pop-up no longer fades out when there's nothing more to see.** The level-up cards (and other panels that slide in) could leave the last card faded as if you could scroll. The fade now appears only when a panel really has more below, and it's gentler.
- **The loadout is one stack.** The row of gun and relic icons along the bottom of the screen is now a single stack in the corner: your three newest pieces fanned out, with a count of everything you've picked. Each new piece drops onto it. Tap it for the whole loadout, explained, with the game paused.

## v2.19.0 — 2026-09-26

- **Fleet Ops (new room aboard, with the Halo ring at Overhaul rank 9):** the ships you are not flying can go out on expeditions. The room is a launch deck in the halo, through a new door on the Shipyard's right wall.
  - **Three berths.** Tap an empty one, choose any ship you own except the one you fly, and choose where it goes: any sector you have cleared, or the Deep Void once you have been past wave 60. Trips take from an hour (sector 1) to eight (the Deep Void), and ships keep flying with the game closed.
  - **What they bring home:** that stretch's material (Alloy, Crystal or Void shards), salvage in proportion to what your sorties pay, and mastery for the ship that went. Now and then they also find a Greenhouse seed, an Alien Core, or (from sector 3 out) a Blueprint. The Deep Void sometimes gives up a signal fragment that nobody can read yet.
  - **The further out, the riskier.** A ship can come home damaged: smoking on its pad, its hull scorched. The risk runs from low in sector 1 to high in the Deep Void, and each route says which. A damaged ship can't fly or go out again until it is repaired. Light damage costs salvage; heavy damage costs more salvage plus 6 Alloy for new plating. You can repair a ship as you unload it, from its card in Ships, or by tapping it when you choose a ship to send. A ship with a reinforced frame (its second refit) is damaged 40% less often.
  - **A ship that is out can't fly** until it is home and unloaded. The Ships menu says where it is and when it is due back. You can call a ship home early, but it comes back with nothing.
  - **Bring 12 expeditions home for the Pathfinder paint.**
  - The ring map in the middle shows every destination round the station, with a light for each ship on its way there and back. The routes board lists what each trip brings, and the log shows what came home. A ship you send lifts off and leaves through the force field; one that comes home while you are there flies in and settles on its pad.
  - Pilots already past rank 9 when the update arrives are offered the way aboard once, as if it had just opened.
  - The Launch screen has a Fleet shortcut when a ship is home. The station card says when ships are home or a berth is free, and the Shipyard's fleet board shows who is away.
- **Materials and ship refits.** Each stretch of the invasion now drops its own material: **Alloy** in sectors 1-2, **Crystal** in 3-4, and **Void shards** in 5-6 and the Deep Void (half as many again past wave 60). Bosses always drop some, elites often and other invaders now and then. Warping past a stretch means going without its material.
  - Spend materials on **ship refits:** five for each ship, bought on its card in the Ships menu: a tuning for its gun, a reinforced frame, capacitors for its ability, a stronger trait, and a Void-tempered hull. A refit counts while you fly that ship, and an Overhaul leaves it alone.
  - Each sector's banner names its material, and the debrief lists what came home.
- **See everything you hold:** tap your salvage at the top of the screen for a list of every resource: salvage, the three materials, Blueprints, Alien Cores and seeds, with where each comes from and what it buys.
- **Healing is less generous early on.** Hull repairs over time (Nanite Swarm, the Repair Bay, Vampire Coil, Ironclad and the Repair Escort) now pause for 3 seconds after each hit, instead of repairing straight through a fight. Nanite Swarm repairs 0.5% a second (was 0.8%), and lifesteal repairs at most 6% a second (was 8%). Repair kits, the repair after each wave, Second Wind and the full repair at the end of each sector are unchanged, so new pilots' first sorties are no harder.
- **Nothing crowds the right edge on a phone.** The hangar pages, the debrief and pop-ups no longer show a scroll bar (on an iPhone it sat over the right edge of every panel). Instead, when there is more to see, the last panel fades into the bottom of the screen.
- **The debrief fits long runs:** a long sortie's time no longer gets cut off (it reads 24:38), a haul in the millions stays beside its coin, and the stat labels read clearly over a bright planet.
- **Smoother in the rooms aboard, with every effect kept.** Rooms now draw their still parts in far fewer steps: the Greenhouse's second wing needs 128 draw calls a frame instead of 404, the Shipyard 92 instead of 155, and every other room fewer too. The hangar no longer re-measures the page every frame, the effects layer is left alone when there is nothing on it, and the Command Deck's replay TV only plays while it is on screen.
- **Doors aboard are set into the walls:** every doorway is now recessed, framed by a plate flat on the wall, and its doors slide back into the wall as they open, instead of a frame standing out from it.
- **Hull never reads 0% while you are still flying:** a sliver of hull under half a percent used to show as 0% while your shield kept you alive. It now shows 1%, and the figure flashes red below 10%. At 0 the ship is destroyed, shield or not, as before.
- The Greenhouse's seed drawer and potting bench no longer sink into the sill along the glass wall.
- Saves from every release from now on are kept and checked against each new build, so an update can't stop an old save from loading.

## v2.18.0 — 2026-09-26

- **The Greenhouse (new room aboard, and the first you can walk into):** the old glasshouse on the station's arm. It opens a few sorties in, once every hangar menu has opened and you have cleared sector 1. ORBIT tells you, and the Greenhouse offers the way aboard. Until there is a Command Deck you get there by tapping your station; after that, through a new door on the Deck's back wall, by the lounge.
  - **Seeds:** bosses leave seeds when you beat them in a sortie. Each sortie brings home the seeds of its two deepest bosses: a kind for each sector boss, two Deep Void kinds past wave 60, and a Beacon lily from every Void boss. There are three in the drawer on your first visit.
  - **Growing:** plant a seed in a bed and it grows in real time, even with the game closed: sprout, leaf, bud, bloom (16 hours for most, longer for the rare ones). Water the beds once a day at the tap and everything still growing comes on by a quarter. Plants never wilt or die.
  - **Blooms are boosts for your next sortie**, never permanent stats, so they matter as much late on as early: +15% salvage (Sunpetal), start with a card (Emberroot), two more rerolls (Mistvine), +25% shield (Ironbark), +20% XP (Hivebloom), one more card to choose from (Gravity fern), a relic to pick at the start (Starbloom), +15% damage (Nightshade) and an extra revive (Beacon lily). Harvest a bloom into the basket and your next sortie takes one of every kind in it. The Launch card shows what it will take, and the debrief says what it used and which seeds came home.
  - **The Solar wings (Overhaul rank 4) power the second wing:** six more beds under grow lights, and everything grows half as fast again. The old tree at the far end comes back into leaf.
  - **Grow every kind once** for the **Verdant** paint. The herbarium between the doors keeps a pressed specimen of each, and the old tree flowers when it is full.
  - Also in the room: the seed drawer, the potting bench with the basket, the water point (the tap on its board, the hose reel and the water butt), a fan turning in the gable over the doors, and Sprig, the drone that tends the beds. When you water, Sprig fills up at the butt and then mists every bed still growing.
- The station card, the Launch screen's station callout and the Deck's directory all list the Greenhouse, with what is waiting there: blooms to harvest, empty beds, beds to water. The Overhaul roadmap's rank 4 card and the Overhaul confirmation say what the Solar wings do for it.
- **The Overhaul confirmation is easier to read:** one column instead of two. What you get is a row each, with a picture: the Blueprints, the station piece, the room it opens, the rank bonus and any engine trail. What you keep is a set of tags underneath.

## v2.17.0 — 2026-09-26

- **Void bosses:** once the beacons are lit (Overhaul rank 8), each Deep Void sector ends on a Void boss of its own instead of an old sector boss come round again. There are six, met in turn and then round again, each as strong as the depth:
  - **The Pale Watcher** (wave 70): a vast eye whose gaze sweeps the field like a searchlight, and blinks out of sight.
  - **Umbra Leviathan** (wave 80): a serpent that throws walls of fire with one gap in them.
  - **The Choir** (wave 90): a singing core, shielded while its four singers live. Silence them first.
  - **Grave Colossus** (wave 100): armoured wreckage with gun turrets, artillery and laser beams across the screen. Its armour goes with its turrets.
  - **The Mirror Host** (wave 110): it blinks across the field and sends its reflections at you from the sides.
  - **The Maw** (wave 120): gravity wells, swarms and a four-phase finish.
  - **The first time you beat each one pays 3 Blueprints.** The sector-cleared banner and the debrief say so. Beat all six for the new **Lightkeeper** paint.
- **The Beacon array (new room aboard):** the signal room under the great beacon at the station's tip. It opens with the beacons, at Overhaul rank 8. Go on to it from the Shipyard (a new door by the bay doors), or from the station card.
  - **The great beacon:** a crystal lens turning in a brass cage, sweeping its beam out into the Void.
  - **What has answered:** six hologram pedestals, one for each Void boss. Each shows static until its boss answers, a flickering outline once you've met it, and a solid hologram in its own colour once you've beaten it, with a light of that colour out in the Void too. Tap one for what it is and how the hunt has gone.
  - **The signal log** between the doors keeps the record.
- **Finding your way aboard:** the new rooms are easier to find, and easier to understand once you are there.
  - **After an Overhaul that opens a room,** once the rebuild reel is done, the room introduces itself, says where its door is, and offers **Go aboard** (or Later).
  - **The station card lists every room aboard,** with what is waiting in each: a bounty to claim, new bounties posted, your bunk made up, depths to chart, a Shipyard stage you can build, systems down. The next room to open and what opens it are at the bottom.
  - **NEW until you visit:** a room that has opened and not been visited is marked NEW on the station card, on the station on the Launch screen ("New room aboard"), and on the doors that lead to it, with its threshold glowing.
  - **The Overhaul roadmap says what each piece brings** (daily bounties, a bunk that pays salvage, charts of the Deep Void, the Chimera, Void bosses) and names the room it opens. The Overhaul confirmation lists the room too.
- **Every boss says how to beat it** as it arrives, until you have beaten it once: "Silence its four singers to break the shield", "Armoured while its turrets stand: knock them out first", and so on (bosses with only a weak point say to hit the amber target). A Void boss's pedestal in the Beacon array says the same once it has answered.
- **With the beacons lit, each Deep Void sector opens by naming the Void boss at its end,** and what the first kill pays ("The Pale Watcher waits at wave 70: +3 Blueprints the first time").
- **The Command Deck is bigger:** it runs 3.5 m further back, so the doors added since it was built have walls of their own. The Trophy Hall (left) and Defence Control (right) now face each other behind the medals and the ships, clear of the lounge, the ship pedestals and the way out. The lounge, the records screen and the Hangar door moved back with the back wall.
- **A station directory** on the Deck's new stretch of right wall, by the way in: every room aboard and the door that leads there from here (NEW until you have been), or what opens it. Tap it for the station card.
- **Comms room:** the dish outside the window no longer floats on a short post. It stands on a lattice tower of its own rising from the spire below, like the mast beside it, turning on a turntable with its mount holding the back of the bowl and its feed horn out on struts.

## v2.16.0 — 2026-09-25

- **The Shipyard (new room aboard):** the dry dock at the station's rim. It opens with the shipyard frame, at Overhaul rank 7. Go through to it from the Observatory (a new door on its right wall), or from the station card.
  - **A tall bay open to space** through force-field doors onto the slipway, with the Earth below and the yard's gold frame outside. Gantries run down both sides with welding arms that work on the ship while she is built, sparks and all, and a crane brings in hull plates.
  - **Build the Chimera,** the first ship built aboard since the Fall. She stands in her jig in the middle of the bay, and you fund her in four stages: her keel and frame, alien plating, her plasma drive, then her weapon and colours.
  - **Each stage shows on the ship:** the plans as a hologram, then a bare frame, grey primer plating, her drive and glass, and at last her colours. The last stage commissions her: the arms stand back, she lifts off the cradle, and she joins your hangar.
  - **The price:** salvage (about a sortie or two a stage, rising with your Overhaul rank like the Workshop's), plus 3 Alien Cores for the plating and 2 Blueprints for the drive.
  - **In the room:** the build console shows what the next stage needs, her blueprint is on one wall, and the fleet board on the other shows every ship and its mastery. A build log between the doors records the day each stage was built.
  - **Once she is built,** the bay holds whichever ship you fly. Try your paint jobs on it there.
- **The Chimera, a sixth ship:** Demolition. Built in your own yard and plated in the alien hulls you towed home.
  - **Plasma Mortar and Black Hole:** burning plasma orbs with a wide blast, and a black hole to drag them all together first. +25% blast radius, abilities recharge 15% faster, 8% slower.
  - **Trait, Meltdown:** enemies that die burning burst into plasma, hitting everything close and setting it alight, so the fire runs on through a formation.
  - **Signature, Starforge** (mastery 5): every blast scatters 3 bomblets, and its burn is doubled.
  - Her own mastery paint, **Chimera Prime**, at mastery 10.
- **The Command Deck** has six ship pedestals now. The Chimera shows as an outline until she is built.
- **The Overhaul roadmap** names the room each core piece opens.

## v2.15.0 — 2026-09-25

- **The Trophy Hall (new room aboard):** a gallery in the station's Habitat ring. It opens with the ring, at Overhaul rank 2. Walk in from the Command Deck (a new door on its left wall), from the station card, or from the Counterattack panel in Missions.
  - **Six stasis cradles**, one for each Counterattack boss. A boss you've captured hangs inside its cradle's field, turning slowly in its own colour, with sparks drifting up through the light. One still at large shows only as a flickering red outline.
  - **Each cradle has a plaque** with its stage, the boss, your stars and hard stars, and your best score. Tap a cradle for its record and ORBIT's word on it, and to fly its stage again (or on Hard) straight from the hall.
  - **The hunting record:** a hologram between the doors turns through every main-game sector boss you've faced. Tap it for how each hunt has gone: which you've beaten and how many times, and which have beaten you (and so taught you their moves).
  - **The window** looks back at your station's hub, with the bosses you've towed home held in its tractor fields. The view turns slowly as the ring spins.
- Boss kills are now counted boss by boss, for the hunting record.
- **The Pilot's quarters (new room aboard):** your own cabin in the Outer ring. It opens with the ring, at Overhaul rank 5. Walk out to it from the Trophy Hall (a new door on its left wall), or from the station card.
  - **Your bunk** sits under the window, with the Earth beyond and your callsign and rank over it. Rest in it once a day and you're well rested: your next sortie banks 10% more salvage, and the debrief says so.
  - **Keepsakes:** twelve to find as you play, each turning on its own stand on a lit shelf in the cabinet. They run from your first salvage chip and a scorched hull plate off your first lost ship to a Singularity shard and a Void compass. The ones still to find stand as dark shapes; tap the cabinet to see how to get them.
  - **The pilot's log** on the wall over your desk gets a new entry, in your own words, every time something goes on the shelf.
  - **Photos** of the big moments are pinned up between the doors: first launch, first boss down, your best wave, the Counterattack, the first rebuild, the first siege held.
  - **A switch by the door** sets the lights' mood: Warm, Cool, Night or Neon.
  - **Bolt,** the station's little maintenance drone, has moved in and follows you round. Tap it and ORBIT will tell you about it.
- **The Observatory (new room aboard):** the glass dome under the hub, open to the stars. It opens with the dome, at Overhaul rank 6. Go down to it from your quarters (a new door by the back), or from the station card.
  - **Chart the Deep Void.** Past wave 60 there are no charts. Eight depths, from wave 61 to wave 201, each wait in the Observatory once a sortie has reached them.
  - **Charting a depth** lights its constellation in the dome (The Threshold, The Drift, The Lantern, The Crown, The Abyss and more), turns your view up to watch it draw itself in gold, and pays Blueprints.
  - **Four Void paint jobs,** found nowhere else, come with charting: Starlit, Event Horizon, Void Glass and Abyssal.
  - **In the room:** the telescope in the middle turns to track the constellations; tap it for what ORBIT sees out there. The chart on the wall lists every depth and what it pays, and the orrery rings the sectors out to the Void, a light riding the deepest you've flown. Through the window, the Void itself.
  - The debrief tells you when a sortie reaches a new depth.
- **New best, as it happens:** when a sortie takes you past your best wave, a banner says so the moment you cross it.
- **The Comms room and daily bounties (new room aboard):** the radio room at the top of the Comms spire. It opens with the spire, at Overhaul rank 3. Go up from the Trophy Hall (a new door on its right wall), or from the station card or Missions.
  - **Three bounties a day,** picked up over the radio from the miners and trawlers: one easy, one harder, one hard. Examples: "Down 450 invaders", "Hit bosses' weak points 10 times", "Reach wave 26 in one sortie", "Reach wave 16 flying the Striker", "Hold a Station Siege".
  - **Sized to how you fly:** each goal is based on your own average per sortie, and each pays salvage based on what one of your sorties earns. Harder bounties pay more.
  - **All three done in a day pays a Blueprint.** You can swap one bounty you don't fancy, once a day.
  - **Collecting:** tap Collect in Missions (the new panel at the top) or at the bounty board in the Comms room. The debrief tells you when a sortie or a siege finishes one, and the Missions tab lights up while pay is waiting. Anything done but not collected is paid when the next day's bounties arrive, so nothing is lost.
  - **In the room:** the radio console carries a live waveform and ORBIT's listening post; tap it for what the spire is picking up. The bounty board is on one wall and a system map of the sectors you've reached on the other. Through the window, the spire's mast with its beacon, a big dish sweeping the sky and sending out rings, and the Earth below.
- **Polish across the rooms aboard:**
  - **Ceiling lights** are proper fittings now, a framed diffuser rather than a flat white slab. A soft shade under the header keeps the room's name and Exit readable when a light is behind them.
  - **The signs over the windows** sit on a dark plate, so they read against the glint off the frame. Defence Control's no longer hides behind a ceiling beam.
  - **Comms room:** the microphone has moved to the front of the desk, clear of the frequency readout. A clock between the doors shows the station's time and when the next bounties post, and the system map's labels are bigger.
  - **Pilot's quarters:** the keepsakes stand on little turntables, and the stray light floating over the cabinet is gone. The ceiling lights follow the mood, and go down with the rest for a night in the bunk. The reading lamp is on a gooseneck over the pillow. A softer pillow, a striped blanket with the sheet turned down, a braided rug, and a mug that looks like a mug.
  - **Observatory:** tapping the floor shows where you're walking again. Charting a depth centres your view on its constellation, and the telescope aims at the middle of it. Bigger type on the chart, and brass bearings on the telescope's mount.
  - **New icons** for the Comms room and the Observatory.
  - **Toasts** no longer let what's under them show through.

## v2.14.0 — 2026-09-25

- **The Station Siege is now fought from the station's guns.** The gunner seat is no longer a prototype. It is the siege, and it replaces the old 2D one. Launch a siege from Missions, from Defence Control's threat board or its window, and it puts you straight in the seat.
- **Six tiers, each its own fight:** First Reprisal, Scrap Storm, Red Tide, Iron Fist, Swarm Front and The Unmaking. Each is a run of waves ending on a capital ship with more weak points tier by tier; The Unmaking sends two. The invaders get tougher and fiercer tier by tier: more shots per strafing run, more torpedoes in each drop, faster gunship beams.
- **Your whole station arms the guns.** Every module you've built is a system in the seat: harder rounds, a faster cycler, point defence against torpedoes, sentry guns on the hull, a shield, armour, repairs, bunkers that take the first heavy hits of a wave, faster reloads, rerolls and a free upgrade to start. Alien hardware joins in too: the phase coil wipes every torpedo in the sky, and the core siphon repairs the hull with every armoured kill. Maxed modules work harder.
- **Winning pays:**
  - Stars for the hull you keep, with an Alien Core for each new one.
  - Salvage every time, more the less damage the station took, and double for your first hold of a tier.
  - Your first hold of each tier also pays 2 Blueprints, and the armoury fits the guns with an upgrade they keep for every siege after: an extra missile, a bigger magazine, explosive rounds, armour-piercing rounds, a sentry gun, heavy warheads.
  - The siege's debrief stamps the stars in, counts the salvage up, shows the new gear, and ORBIT has a word.
- **Losing costs you, without setting you back:**
  - A lost siege knocks 2 or 3 of the station's systems offline (never the cargo hold), and the guns go without them until they're repaired.
  - The station shows it: smoke, sparks and fires on the broken modules, lights half out, and Defence Control on red alert with the damaged systems flashing on its consoles.
  - Repair it for salvage at the tactical table (Defence Control), or fly any sortie of a minute or more and the crews patch everything for free while you're out. Holding a siege repairs it too.
  - Your Workshop is never touched.
- **Leaving mid-siege** asks first, and counts as a loss.
- **Defence Control:** the threat board counts the invaders you've downed. Every system's description now says what it does in the seat, and the station card and the Missions panel warn you while the station is damaged.
- **Replay TV:** sieges are no longer recorded (the seat isn't a sortie); it keeps your last sortie.

## v2.13.0 — 2026-09-25

- **Man the guns (prototype, Defence Control):** tap Defence Control's window and choose "Man the guns" to take the station's own twin cannons in 3D. Drag to aim; the cannons fire on their own at whatever is in the sights. Hold off five waves: fighters, bombers that drop torpedoes on the station, gunships that hover and beam it, and finally a capital ship whose weak points you shoot out. It's a first version to try out: no rewards yet, and damage to the station doesn't carry over.
  - **Homing missiles:** bombers, gunships and weak points are armoured (marked ◆) and shrug off most cannon fire. Hold the sights on one and the seeker locks on, its beeps speeding up to a steady tone. Then fire. The missile rack reloads all at once when it's empty.
  - **The cannons** carry a 30-round magazine, shown as a ring round the crosshair, then reload slowly.
  - **Upgrades between waves:** pick one of three turret upgrades after each wave (18 in all, for the cannons, the missiles and the station), with rerolls. What you've built on the station sets the guns' starting kit: the weapon battery, the cycler drum, the shield, the hull, point defence and more. The invaders get tougher every wave.
  - **Feel:** a recorded plasma cannon that rings out through a reverb, a kick and a rumble with every round, a heavy jolt with every missile launched, big explosions when missiles hit, and ships that break apart into tumbling, burning wreckage.
- **Vibration (Settings, on by default):** the gunner seat vibrates as the cannons fire and reload, and when missiles launch or the station is hit, on phones that support it.
- **Station Siege is harder:** after playtesting it was far too easy. The station's guns and auto-aim no longer do the defending for you, and the station's systems are weaker. There are more shells, raiders attack in wings, and every wave brings a barrage. The invaders also scale with your pilot's power, so a strong pilot still gets a fight.

## v2.12.0 — 2026-09-25

- **The replay TV (Command Deck):** a flight recorder now keeps the last 90 seconds of every sortie and Station Siege. That's the ending, whether it's the boss fight or how it went wrong. The big screen on the Command Deck's back wall plays it back as a miniature of the fight, with the game's own enemy models in their colours, your ship banking as it flew, shots and enemy fire, and a burst for every kill. The left of the screen follows the run as it plays (wave, score, hull and shield); the right shows your records.
- **Tap the TV to watch:** the replay fills the screen, with pause, restart, ½×, 1× and 2× speed, and a scrubber to jump anywhere. It stops on the ending ("Signal lost at wave 31", "Station held"…) with a Watch again button.
- The recording is kept compressed (about 200 KB) in its own slot, separate from your save, so it survives closing the app. Counterattack isn't recorded yet, because its walls and city aren't part of what's noted. Erase save clears the recording too.

## v2.11.0 — 2026-09-25

- **Defence Control (new room aboard):** the station's war room, a second room to walk round like the Command Deck. It opens when the invaders first strike back (your first Counterattack clear): enter it from the Station Siege panel in Missions, from the station card, through its door in the Command Deck, or straight from a siege debrief. A short briefing explains it on your first visit.
- **What's in it:**
  - **The window** looks out past the station's own guns into deep space. A turret stands on the hull for each gun you have built (gold-trimmed once maxed), and an empty mount for each you haven't. The fleet massing for each open siege gathers out there as red running lights. Tap the window for what's coming and to defend against it.
  - **Four consoles** (Weapons, Protection, Operations, Alien hardware) run every defence you've built. Each screen lists its systems as online, maxed or offline; tap one for what each does and which upgrade brings the rest online.
  - **The tactical table** turns a hologram of your station under a radar sweep, with the invaders closing in as red blips. Tap it for the station's defences in numbers (damage taken, hits that miss, shield and repairs each wave, guns) and the full list.
  - **The threat board** lists all six siege tiers with their stars and whether each is held or massing. Tap it for your siege record and to launch any open siege.
  - **ORBIT's terminal:** tap it and the station AI tells you what's massing, which system to build or max next, and siege tips.
  - An alert beacon turns amber over the table while a siege is massing, and glows green when all is quiet.
- **Siege panel:** an "Enter Defence Control" button, and the defences list is now grouped by console with the station's totals at the top. Everywhere a defence is offline, it names the Workshop upgrade (or Alien Tech) that brings it online.
- **Fix:** long lists in information panels (the defences, the medal wall) no longer squash the panel's stats into a thin line.
- **New doors aboard:** every door in the station's rooms is now a proper bulkhead: a chamfered frame with a glowing trim in the room's colour, two leaves with frosted windows and hazard-striped kick plates, a lit sign above and a status panel beside it. Walk up to one and it slides open onto a lit corridor. A sealed door glows red, is taped across and shows a padlock.
- **ORBIT in the rooms** now speaks from the bottom of the screen, so its messages never cover the room's title or the Exit button.
- **Missions:** siege tiers and Counterattack stages you haven't flown say "not yet flown" instead of "best 0".
- **Save backup (Settings):** your progress lives only on this device, and iOS can clear a home-screen app's storage when the phone runs low on space. Settings now has Save backup: share or copy a backup code to keep in Notes or an email, and paste one back in to restore. Before anything is replaced it shows whose save the code holds (pilot, rank, best wave, salvage, when it was saved) and asks you to confirm. Settings shows when you last backed up, and highlights the button if you never have.
- **Opening cinematic:** when the core blows, the station's hub now tears in two. The halves drift apart with glowing, jagged rims, sparks and smoke venting from the break. The habitat rings snap into tumbling arcs instead of flying off whole. The closing shot now fits your ship to your screen: on phones it was too big, clipped at the edge and sitting under the captions.

## v2.10.1 — 2026-09-25

- **Fix: sound after the phone sleeps.** Waking the phone rebuilt the sound engine, but its clock started again at zero while each sound's repeat limit still remembered the old clock, so anything played before sleep (gunfire above all) stayed silent until the new clock caught up. The limits now reset with the engine.
- **Fix: the flight tips play once.** The steering tip now shows in your first sortie only, and the dodge tip once after it, instead of each playing across two sorties.

## v2.10.0 — 2026-09-25

- **Counterattack builds the station too:** the boss of each Counterattack stage is towed home on your first clear (either difficulty) and held off the station in a glowing tractor field: the Broodcarrier, Scrapmonger Vorr, the Red Shroud, Iron Admiral Kross, the Hive Heart and the Unmaker. The debrief says so, the station glows where it arrived, the blueprint marks it, and ORBIT has a line for each.
- **One rebuild for every mode:** the station's figure now counts modules 40%, core pieces 40% and what you capture from the enemy 20% (the six bosses and the four pieces of alien hardware), so 100% means everything.
- **The rebuild bar:** a segmented bar in the station callout, one skewed segment per 5% in three groups (cyan for modules, blue-violet for core pieces, violet for captures), each filling on its own; the segment still filling pulses, and new progress lights segment by segment as the figure counts up.
- **Station overview:** the station card lists the three parts of the rebuild in the bar's colours: what each is, where it comes from and how far along it is.
- **Station Siege (new mode):** the invaders' answer to your Counterattack. Clearing a Counterattack stage brings a siege of the same tier against your station, six in all (from First Reprisal to The Unmaking, the last in the Deep Void). You fight main-game style with the station behind you: anything that reaches the line hits the station, not your ship, and if it falls the siege is lost. Bombards in the formation glow as they load and lob shells at it, bombers cross the sky dropping more, and raiders dive past you at it, each trailing a line to where it will land. Every wave is an assault to hold for a while (HOLD in the station bar), however fast the formation falls, and the tier's boss shells the station too.
- **Your station fights back:** every Workshop module is a defence in a siege (cannons, point defence, a shield, armour, repair crews, evasive thrusters, bunkers, a tractor field, wingmen and more), a maxed module works harder, and the four pieces of alien hardware add their own (a phase pulse that wipes the field, alien armour, targeting data, a core siphon). Missions lists every defence, what it does and how to get it.
- **Siege rewards:** stars for holding the station, keeping it above 50% and above 85%; each new star pays an Alien Core and each tier's first win pays 2 Blueprints. A siege briefing explains it all the first time, and ORBIT warns you when the first one is coming.
- **Debrief fix:** the star notes and rewards under a Counterattack (or Siege) result now sit on their own lines instead of squeezing beside the stars.
- **Intro:** the invaders' beams now make a low laser sound as they fire on the station.

## v2.9.1 — 2026-09-25

- **Fix (iPhone):** the station on the home screen could sit under the header on tall phones, so the callout overlapped your name and a tap on Settings opened the station instead. The header now always sits above the station's tap area, and the station is placed in the room between the header and your ship on every screen (a little smaller on short phones), with its tap area and callout following it.
- **Fix (iPhone):** the cinematics' Skip button sat under the Dynamic Island and could be clipped; it now sits clear of it and of the screen's rounded corner.

## v2.9.0 — 2026-09-25

- **The Fall (opening cinematic):** the game now opens on the story. The station in its golden age turns over Earth, shuttles tracing their orbits, until the invader fleet warps in, beams converge, explosions ripple through the modules and the core blows in a whiteout, tearing the rings away. When the smoke clears, your ship drifts in past the broken hub: "The last orbit fell. We must rebuild it." About twenty seconds, it starts on a title card (tap to begin, so it has sound on phones), can be skipped (top right), plays once for every pilot, and can be watched again from Settings (Story: Watch intro).
- **ORBIT, the station AI:** captions and messages are typed out in a soft blip voice. ORBIT greets you by callsign and speaks up at milestones (your first sortie, the first sector cleared, Counterattack, the Deep Void, your first Overhaul), each once. Pilots already past a milestone only hear the welcome.
- **Your station on the home screen:** a HUD callout beside the station shows its name and how much of it has been rebuilt, with a hairline to the hub. Tap it (or the station) for one station card: the blueprint, the rebuild, a Rename button and the way aboard the Command Deck. Name the station there or in Settings; the name also shows over the Command Deck's window and on the Overhaul blueprint.
- **Overhaul panel polish:** the blueprint fits itself to your station and reads like a real technical sheet (rulers, corner marks, a crosshair and a title block with the station's name, revision and progress), and the roadmap cards are compact, each with a small diagram of its piece and a one-line description.
- **Rebuilding the station:** the wreckage of the old station drifts round the new one and thins out as you rebuild it. Modules now stay built for good: after an Overhaul the Workshop resets, but the station only puts those modules' lights out until they are rebuilt, instead of turning them back into scaffolding.
- **Every Overhaul rebuilds a piece, on screen:** after an Overhaul that adds to the station, a short cinematic (about ten seconds, skippable) shows it happen: the new piece is projected as a flickering hologram, a weld line sweeps across it trailing sparks and leaves solid hull behind, then its lights come on ("Habitat ring restored."), with the piece named at the top as core system N of 10. The Stellar crown at rank 10 gets a longer finale: every window lights up, a ring of light goes out from the hub and the camera pulls back on the whole station ("The last orbit is whole again.").
- **A rebuild figure that means something:** the station's "% rebuilt" now counts the modules as half of the job and the ten core pieces as the other half, so it only reaches 100% when the crown goes on (before, it read 100% from the first Overhaul on). The Overhaul confirmation lists the station piece you get and says your station keeps every module; the "Every module built" prompt now says Ready to Overhaul.
- **ORBIT on every piece:** the station AI has a line for each core piece as it comes back, from the habitat ring to the crown.
- **See the station change as you upgrade:** every Workshop module now has a name, and a buy that changes the station says so ("Station: Cargo pods rebuilt" on its first level, "Station: Weapon battery online" when maxed). Back on the Launch screen, whatever changed since you last looked glows twice on the station, and the callout's rebuild figure counts up to its new value. The Workshop's first-time message now mentions that every upgrade rebuilds a piece of the station.
- **Alien Tech on the station:** each Alien Tech upgrade bolts a piece of captured alien hardware onto the station in the invaders' violet (Xeno plating, a phase coil, a star chart array and a core siphon), drawn on the blueprint too, and ORBIT has a line for each. Counterattack's own progression now shows on the station like everything else. Visual only; no balance change.
- **Readable locked buttons:** Blueprint buttons you cannot press yet no longer sit orange with faded text: a locked escort shows a lock and "Needs bay" on a dark button, and unaffordable Blueprint and Alien Tech buttons go dark with readable prices.

## v2.8.0 — 2026-09-25

- **Deep Void anomalies:** past wave 60, every Deep Void sector makes you take one of two anomalies, and they stack for the rest of the sortie. Each raises your salvage and score (+10% to +20%), so how many you can carry is the endless goal. Five bend the numbers (Hardened Hulls, Overdrive, Heavy Ordnance and Forced March stack up to three or two times; Elite Vanguard adds an elite to every wave) and five change the fight: **Serpent Fire** (enemy bolts weave), **Minefield** (the dead sometimes leave drifting mines), **Shrapnel** (the dead sometimes burst into bolts), **Void Lances** (a beam locks onto your lane every few seconds) and **Gravity Wells** (wells open on the defence line and drag you in). They show in the HUD, the pause loadout and the Deep Void sector title. Tuned with a new Deep Void probe over some 1,500 late-game runs: with anomalies, bot pilots fall about one wave sooner in the Deep Void but bring home 6–9% more Deep Void salvage, so a whole sortie pays about 3% more and Overhaul pacing is unchanged.
- **Callsign:** new pilots pick a callsign at first launch (existing pilots are asked once). It sits on the rank card, the app greets you by name when it opens, and it can be changed in Settings.
- **Your orbital station:** a station now hangs in the sky above Earth on the home screen, and it is a picture of your progress. Every Workshop upgrade builds one of its fifteen modules (gun batteries, shield dishes, cargo pods, a repair bay and more): unbuilt modules show as faint outlines, and maxed ones light up. Finishing it (every upgrade maxed) gets its own moment and opens the Overhaul. Each Overhaul rank adds a permanent piece to its core that the reset never takes away: the Command Deck, a habitat ring, a comms spire, solar wings and so on up to a stellar crown at rank 10. It is built like a real station: lattice trusses, windowed modules with gold-foil insulation, radiators, solar wings that catch the light, navigation lights, a shuttle coming and going, and cyan scaffolding where a module is still to be built. Its windows glow at night. It adds no stats of its own.
- **Command Deck:** your first Overhaul opens your own room aboard the station, a small 3D space you walk around: drag to look, tap the floor to walk there (W/A/S/D on a keyboard). A big window looks down on Earth (lit by day, city lights by night, on your own clock). Your medals line one wall, your ships turn on pedestals under your banners, the records screen and the way out are behind you, a trophy for each Overhaul rank sits on the shelf under the window, a hologram of your station turns on the holo-table in the middle, and there is a lounge corner with a screen showing your station roadmap. The lights dim and warm up at night. Tap any exhibit for the details. Reach it from the new Deck menu, or by tapping the station in the sky on the home screen.
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
