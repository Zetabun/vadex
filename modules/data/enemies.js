// Enemy archetypes. hp/reward/dmg are multipliers on the per-wave baseline (balance.js).
// cost = formation budget, prio = auto-targeting priority once Priority Targeting is researched.
export const ENEMIES = {
  // ---- Counterattack: Liftoff (the home world's surface)
  tower:     { name: 'Gun Tower', hp: 2.2, reward: 2, r: 3.6, cost: 2, prio: 2, color: 0xc9d2e8, shape: 'turret', ground: true, fire: { every: 2.8, kind: 'aimed', speed: 40, dmg: 1 }, desc: 'Rooftop battery. Shoots up at you as you pass over.' },
  hullgun:   { name: 'Hull Gun', hp: 2.6, reward: 2.2, r: 3.8, cost: 2, prio: 2, color: 0x9ff5d8, shape: 'deckgun', ground: true, fire: { every: 3.3, kind: 'spread', speed: 36, dmg: 0.9 }, desc: 'Deck battery on the machine battleship. Fires a fan of three.' },
  spore:     { name: 'Spore Pod', hp: 1.6, reward: 1.6, r: 3.4, cost: 1.5, prio: 2, color: 0xff7ad9, shape: 'pod', ground: true, fire: { every: 3.4, kind: 'aimed', speed: 26, dmg: 0.9 }, desc: 'Grows on the hive walls and spits slow spores.' },
  // ---- Counterattack: one new enemy per stage past Liftoff (see data/counter.js STAGES extra)
  scrapper:  { name: 'Scrapper', hp: 1.6, reward: 1.8, r: 3.6, cost: 2, prio: 3, color: 0xffb070, shape: 'scrapper', fire: { every: 4.6, kind: 'mine', dmg: 1.6, fuse: 3.4, radius: 8, drift: 7 }, desc: 'Salvage drone. Seeds the lanes with drifting mines that blow when you get close.' },
  stalker:   { name: 'Stalker', hp: 1.4, reward: 2.2, r: 3.3, cost: 2.2, prio: 3, color: 0xff4d6d, shape: 'stalker', stealth: { on: 2.4, off: 1.8 }, fire: { every: 3.6, kind: 'split', speed: 30, dmg: 0.8, fuse: 0.9, n: 5, split: 30 }, desc: 'Hunts from inside the gas. Its orbs burst into a ring.' },
  flanker:   { name: 'Flanker', hp: 2, reward: 2.4, r: 3.8, cost: 2.4, prio: 3, color: 0x7dffcf, shape: 'flanker', fire: { every: 1.6, kind: 'side', speed: 46, dmg: 0.9, aligned: true }, desc: 'Climbs up from behind you and fires broadsides when level. Change height.' },
  lunger:    { name: 'Lunger', hp: 1.2, reward: 1.8, r: 3.6, cost: 1.8, prio: 4, color: 0xff5fd2, shape: 'lunger', desc: 'Bursts from the hive wall at your height and lunges across. Climb or dive.' },
  riftling:  { name: 'Riftling', hp: 1.3, reward: 2, r: 3.2, cost: 2, prio: 3, color: 0xb69cff, shape: 'rift', blink: { every: 2.6, range: 14 }, fire: { every: 3.8, kind: 'wave', speed: 30, dmg: 0.7, n: 5 }, desc: 'Blinks through folded space and fires snaking streams.' },
  skimmer:   { name: 'Skimmer', hp: 0.6, reward: 1.2, r: 2.8, cost: 1.2, prio: 2, color: 0x5ee6ff, shape: 'phantom', fire: { every: 2.6, kind: 'bolt', speed: 46, dmg: 0.8 }, desc: 'Fast interceptor that skims low across the city.' },
  // ---- v2.8: one new enemy for sectors 2-6, each with a fire pattern or trick the main game had not seen
  burster:   { name: 'Burster', hp: 1.9, reward: 2.2, r: 3.6, cost: 2.2, prio: 3, color: 0xff7a59, shape: 'burster', fire: { every: 5.2, kind: 'split', speed: 24, dmg: 0.85, fuse: 1.6, n: 7, split: 26 }, desc: 'Lobs a slow orb that bursts into a ring of bolts. Read the gaps.' },
  sower:     { name: 'Sower', hp: 2.1, reward: 2.4, r: 3.7, cost: 2.4, prio: 4, color: 0xffc36b, shape: 'sower', fire: { every: 6.4, kind: 'mine', dmg: 1.7, fuse: 6, radius: 7.5, drift: 16 }, desc: 'Drops mines that sink toward your line and blow when you come near.' },
  binder:    { name: 'Binder', hp: 2, reward: 2.4, r: 3.5, cost: 2.4, prio: 4, color: 0x7df9ff, shape: 'binder', link: true, fire: { every: 5.2, kind: 'aimed', speed: 44, dmg: 0.9 }, desc: 'Flies in linked pairs that share every hit. Break the pair and the survivor overcharges.' },
  coiler:    { name: 'Coiler', hp: 1.8, reward: 2.4, r: 3.6, cost: 2.4, prio: 3, color: 0xc6ff5e, shape: 'coil', fire: { every: 6.8, kind: 'wave', speed: 28, dmg: 0.7, n: 5 }, desc: 'Spits a snaking stream of spores.' },
  warper:    { name: 'Warper', hp: 2.2, reward: 2.8, r: 3.5, cost: 2.8, prio: 5, color: 0xb98cff, shape: 'warper', evade: true, fire: { every: 5.4, kind: 'aimed', speed: 50, dmg: 1 }, desc: 'Badly hurt, it folds space and swaps places with another invader.' },
  grunt:     { name: 'Scout', hp: 1, reward: 1, r: 3.4, cost: 1, prio: 1, color: 0x6fd3ff, shape: 'scout', fire: { every: 5.5, kind: 'bolt', speed: 38, dmg: 1 }, desc: 'Holds formation and takes pot shots.' },
  weaver:    { name: 'Weaver', hp: 0.85, reward: 1.2, r: 3.2, cost: 1.3, prio: 1, color: 0x9dff8a, shape: 'weaver', weave: 7, fire: { every: 6, kind: 'bolt', speed: 42, dmg: 0.9 }, desc: 'Sways out of line. Hard to hit with slow shots.' },
  diver:     { name: 'Stooper', hp: 1.3, reward: 1.6, r: 3.4, cost: 1.8, prio: 2, color: 0xffb547, shape: 'diver', dive: { every: 9, speed: 55 }, fire: { every: 3.2, kind: 'aimed', speed: 50, dmg: 1, onlyDiving: true }, desc: 'Peels off and strafes you on the way down.' },
  lancer:    { name: 'Lancer', hp: 0.7, reward: 1.5, r: 3, cost: 1.6, prio: 3, color: 0xff4d7a, shape: 'lancer', kamikaze: { every: 7, speed: 70, dmg: 4 }, desc: 'Suicide run. Kill it or dodge it.' },
  plate:     { name: 'Ironclad', hp: 3, reward: 2.6, r: 4.2, cost: 2.6, prio: 1, color: 0xb9c4d6, shape: 'plate', armour: 0.6, scrap: 4, fire: { every: 8, kind: 'heavy', speed: 30, dmg: 2.2 }, desc: 'Armour shrugs off 60% of damage. Armour penetration ignores it.' },
  aegis:     { name: 'Aegis Projector', hp: 2.4, reward: 3, r: 3.8, cost: 3, prio: 9, color: 0x7aa2ff, shape: 'aegis', aura: { kind: 'shield', radius: 24, value: 0.85 }, desc: 'Shields everything nearby for 85%. Destroy it first.' },
  mender:    { name: 'Mender', hp: 1.8, reward: 2.6, r: 3.4, cost: 2.6, prio: 8, color: 0x66ffc2, shape: 'mender', aura: { kind: 'heal', radius: 26, value: 0.05 }, desc: 'Repairs neighbours by 5% a second.' },
  herald:    { name: 'Herald', hp: 2, reward: 2.8, r: 3.6, cost: 2.8, prio: 7, color: 0xffe066, shape: 'herald', aura: { kind: 'buff', radius: 28, value: 0.6 }, desc: 'Neighbours fire 60% faster.' },
  carrier:   { name: 'Tender', hp: 6, reward: 5, r: 5.6, cost: 5, prio: 6, color: 0xd48cff, shape: 'carrier', spawn: { type: 'swarmling', every: 4.5, max: 10 }, scrap: 3, desc: 'Launches swarmlings until it dies.' },
  swarmling: { name: 'Swarmling', hp: 0.22, reward: 0.3, r: 2, cost: 0.35, prio: 0, color: 0xff9bd2, shape: 'swarm', weave: 3, fire: { every: 14, kind: 'bolt', speed: 36, dmg: 0.5 }, desc: 'Weak alone. Never alone.' },
  phantom:   { name: 'Phantom', hp: 1.3, reward: 2.2, r: 3.3, cost: 2.2, prio: 2, color: 0xa0a8ff, shape: 'phantom', stealth: { on: 3.2, off: 3 }, fire: { every: 4.5, kind: 'aimed', speed: 46, dmg: 1.1 }, desc: 'Cloaks. Auto-targeting loses it until you research Deep Scanners.' },
  sniper:    { name: 'Marksman', hp: 1, reward: 2.2, r: 3.2, cost: 2.2, prio: 5, color: 0xff6b6b, shape: 'sniper', fire: { every: 6.5, kind: 'snipe', speed: 130, dmg: 3, telegraph: 1.1 }, desc: 'Paints a line, then fires along it. Move.' },
  rocketeer: { name: 'Rocketeer', hp: 1.5, reward: 2.4, r: 3.6, cost: 2.4, prio: 4, color: 0xff8a3d, shape: 'rocketeer', fire: { every: 7.5, kind: 'rocket', speed: 26, dmg: 2.4 }, desc: 'Homing rockets. They can be shot down.' },
  lasher:    { name: 'Lasher', hp: 2, reward: 3, r: 3.8, cost: 3, prio: 5, color: 0xff3df0, shape: 'lasher', fire: { every: 8, kind: 'beam', dmg: 2.5, telegraph: 1.3, dur: 0.9 }, desc: 'Charges a column beam straight down.' },
  artillery: { name: 'Bombard', hp: 2.2, reward: 3.2, r: 4.2, cost: 3.2, prio: 6, color: 0xffa94d, shape: 'artillery', scrap: 2, fire: { every: 7, kind: 'shell', dmg: 3.5, telegraph: 1.5, radius: 11 }, desc: 'Lobs shells at where you are standing.' },
  splitter:  { name: 'Mitosid', hp: 1.6, reward: 1.6, r: 4, cost: 2, prio: 1, color: 0x8affd0, shape: 'splitter', split: { type: 'splitling', n: 2 }, fire: { every: 8, kind: 'bolt', speed: 38, dmg: 1 }, desc: 'Bursts into two smaller ones.' },
  splitling: { name: 'Mitosid Spawn', hp: 0.45, reward: 0.5, r: 2.4, cost: 0.5, prio: 0, color: 0x8affd0, shape: 'swarm', weave: 4, fire: { every: 9, kind: 'bolt', speed: 40, dmg: 0.6 }, desc: '' },
  rocket:    { name: 'Rocket', hp: 0.18, reward: 0, r: 1.8, cost: 0, prio: 3, color: 0xff8a3d, shape: 'rocket', projectile: true, desc: '' },
  siegeshell: { name: 'Siege shell', hp: 1.8, reward: 0, r: 2.1, cost: 0, prio: 3, color: 0xff7a3d, shape: 'rocket', desc: 'Lobbed at your station by bombards in a Station Siege. Shoot it down before it lands.' },
  bomber:    { name: 'Siege Bomber', hp: 2.4, reward: 1.6, r: 3.8, cost: 0, prio: 3, color: 0xff9a4d, shape: 'artillery', cruiser: true, desc: 'Crosses the sky in a Station Siege, dropping shells on your station.' },
  raider:    { name: 'Raider', hp: 1.8, reward: 1.2, r: 3.2, cost: 1.4, prio: 2, color: 0xff5a4d, shape: 'diver', desc: 'Dives past you at your station in a Station Siege.' },
  treasure:  { name: 'Salvage Hauler', hp: 5, reward: 30, r: 5, cost: 0, prio: 10, color: 0xffd700, shape: 'treasure', cruiser: true, scrap: 12, desc: 'Unarmed, fast and full of loot.' },
};

// Elite modifiers: rolled on elite enemies. Controlled randomness, clearly labelled in the HUD.
export const ELITE_MODS = [
  { id: 'swift', name: 'Swift', fireRate: 1.8, color: 0xffff66 },
  { id: 'colossal', name: 'Colossal', hp: 2.2, size: 1.35, color: 0xff9955 },
  { id: 'regen', name: 'Regenerating', regen: 0.04, color: 0x66ff99 },
  { id: 'volatile', name: 'Volatile', deathBurst: 10, color: 0xff5555 },
  { id: 'warded', name: 'Warded', armour: 0.5, color: 0x88aaff },
  { id: 'vampiric', name: 'Vampiric', leech: 0.15, color: 0xcc66ff },
];

// Challenge-wave modifiers (one wave only, bonus payout).
export const WAVE_MODS = [
  { id: 'fast', name: 'Blitz', desc: 'Formation moves twice as fast', formSpeed: 2, reward: 2.5 },
  { id: 'tough', name: 'Reinforced', desc: 'Enemies have triple hull', hp: 3, reward: 3 },
  { id: 'storm', name: 'Barrage', desc: 'Enemies fire twice as often', fireRate: 2, reward: 2.5 },
  { id: 'dense', name: 'Full Deck', desc: 'An oversized formation', budget: 1.8, reward: 2.2 },
];
