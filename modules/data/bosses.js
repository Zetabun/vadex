// Bosses are data: a body, optional parts, and phases (hp fraction thresholds) holding attack patterns.
// Attack kinds are implemented generically in combat/bosses.js:
//  aimed{n,spread,speed}  ring{n,speed}  spiral{arms,dur,rate,speed}  rain{n,speed}  beam{cols,telegraph,dur}
//  shell{n,radius,telegraph}  summon{type,n}  well{dur,pull}  teleport{}
//  hbeam{rows,telegraph,dur}  sweep{arc,telegraph,dur}  mines{n}  wave{n,speed}  split{n,spread,speed}  gapwall{speed,gap}
//  veil{dur}  ambush{type,n} (enemies that come at you from behind or from the walls)
// weak: periodically exposes a weak point (offset x from centre). Hits landing on it deal BAL.weakMult damage.
export const BOSSES = {
  // ---- sector bosses ----
  broodcarrier: { name: 'Broodcarrier Ixa', title: 'Sector boss', hp: 70, r: 13, shape: 'bossCarrier', color: 0xd48cff, move: 'hover', y: 118,
    weak: { every: 9, dur: 4, x: 0, r: 5 }, cores: 1,
    phases: [
      { at: 1, attacks: [{ kind: 'summon', type: 'grunt', n: 4, every: 8 }, { kind: 'aimed', n: 3, spread: 0.25, speed: 46, every: 3.2 }] },
      { at: 0.6, attacks: [{ kind: 'summon', type: 'diver', n: 3, every: 9 }, { kind: 'ring', n: 12, speed: 34, every: 4.5 }] },
      { at: 0.25, attacks: [{ kind: 'summon', type: 'lancer', n: 4, every: 7 }, { kind: 'aimed', n: 5, spread: 0.4, speed: 52, every: 2.4 }, { kind: 'ring', n: 16, speed: 38, every: 5 }] }] },
  bastion: { name: 'Bastion Halcyon', title: 'Sector boss', hp: 90, r: 12, shape: 'bossBastion', color: 0x7aa2ff, move: 'hover', y: 116,
    parts: [{ kind: 'gen', n: 3, orbit: 22, speed: 0.7, hp: 0.08, r: 4, shape: 'aegis', shieldsParent: true, respawnPhase: true }],
    weak: { every: 11, dur: 4, x: 0, r: 4.5 }, cores: 2,
    phases: [
      { at: 1, attacks: [{ kind: 'aimed', n: 1, spread: 0, speed: 70, every: 1.6 }, { kind: 'ring', n: 10, speed: 30, every: 5 }] },
      { at: 0.55, attacks: [{ kind: 'beam', cols: 2, telegraph: 1.3, dur: 1, every: 6 }, { kind: 'aimed', n: 3, spread: 0.3, speed: 60, every: 2.2 }] },
      { at: 0.2, attacks: [{ kind: 'beam', cols: 3, telegraph: 1.1, dur: 1, every: 5 }, { kind: 'spiral', arms: 3, dur: 3, rate: 0.12, speed: 36, every: 7 }] }] },
  wyrm: { name: 'The Nebula Wyrm', title: 'Sector boss', hp: 60, r: 8, shape: 'bossWyrm', color: 0xff7a5c, move: 'worm', y: 105,
    parts: [{ kind: 'segment', n: 9, hp: 0.12, r: 6, shape: 'wyrmSeg', chain: true, parentDamage: 0.6 }],
    cores: 2,
    phases: [
      { at: 1, attacks: [{ kind: 'rain', n: 6, speed: 40, every: 3 }] },
      { at: 0.5, speed: 1.4, attacks: [{ kind: 'rain', n: 9, speed: 46, every: 2.6 }, { kind: 'summon', type: 'phantom', n: 2, every: 10 }] },
      { at: 0.2, speed: 1.9, attacks: [{ kind: 'rain', n: 12, speed: 52, every: 2.2 }, { kind: 'ring', n: 14, speed: 36, every: 4 }] }] },
  dreadnought: { name: 'Dreadnought KILN-9', title: 'Sector boss', hp: 120, r: 16, shape: 'bossDread', color: 0x3dffb5, move: 'slow', y: 120, armour: 0.75, armourWhileParts: true,
    parts: [{ kind: 'turret', offsets: [[-20, -4], [-9, -9], [9, -9], [20, -4]], hp: 0.1, r: 3.6, shape: 'turret', fire: { every: 2.6, kind: 'aimed', speed: 58, dmg: 1.2 }, respawnPhase: true }],
    weak: { every: 10, dur: 5, x: 0, r: 5 }, cores: 3,
    phases: [
      { at: 1, attacks: [{ kind: 'shell', n: 2, radius: 11, telegraph: 1.5, every: 5 }] },
      { at: 0.6, attacks: [{ kind: 'shell', n: 3, radius: 12, telegraph: 1.3, every: 4.5 }, { kind: 'beam', cols: 2, telegraph: 1.2, dur: 1.2, every: 7 }, { kind: 'summon', type: 'plate', n: 2, every: 12 }] },
      { at: 0.25, attacks: [{ kind: 'shell', n: 4, radius: 12, telegraph: 1.2, every: 4 }, { kind: 'beam', cols: 3, telegraph: 1, dur: 1.2, every: 5.5 }, { kind: 'spiral', arms: 2, dur: 4, rate: 0.1, speed: 40, every: 8 }] }] },
  oracle: { name: 'Hive Oracle Ssyl', title: 'Sector boss', hp: 110, r: 11, shape: 'bossOracle', color: 0xc77dff, move: 'teleport', y: 110,
    weak: { every: 7, dur: 3, x: 0, r: 5 }, cores: 3,
    phases: [
      { at: 1, attacks: [{ kind: 'teleport', every: 6 }, { kind: 'spiral', arms: 4, dur: 3, rate: 0.14, speed: 34, every: 6 }, { kind: 'summon', type: 'swarmling', n: 8, every: 9 }] },
      { at: 0.6, attacks: [{ kind: 'teleport', every: 4.5 }, { kind: 'ring', n: 20, speed: 36, every: 3 }, { kind: 'summon', type: 'splitter', n: 3, every: 10 }] },
      { at: 0.25, attacks: [{ kind: 'teleport', every: 3.2 }, { kind: 'spiral', arms: 6, dur: 4, rate: 0.1, speed: 40, every: 6 }, { kind: 'aimed', n: 7, spread: 0.6, speed: 56, every: 2.2 }, { kind: 'summon', type: 'lancer', n: 5, every: 8 }] }] },
  singularity: { name: 'The Singularity', title: 'Final boss', hp: 130, r: 14, shape: 'bossSing', color: 0xffd166, move: 'hover', y: 114,
    parts: [{ kind: 'plate', n: 4, orbit: 20, speed: 1.1, hp: 0.3, r: 5, shape: 'armourPlate', armour: 0.8, blocker: true, respawnPhase: true }],
    weak: { every: 8, dur: 3.5, x: 0, r: 5 }, cores: 5,
    phases: [
      { at: 1, attacks: [{ kind: 'well', dur: 5, pull: 26, every: 11 }, { kind: 'ring', n: 18, speed: 34, every: 3.5 }] },
      { at: 0.7, attacks: [{ kind: 'well', dur: 5, pull: 32, every: 10 }, { kind: 'spiral', arms: 5, dur: 4, rate: 0.1, speed: 38, every: 6 }, { kind: 'shell', n: 3, radius: 12, telegraph: 1.2, every: 5 }] },
      { at: 0.4, attacks: [{ kind: 'teleport', every: 7 }, { kind: 'beam', cols: 3, telegraph: 1, dur: 1.2, every: 5 }, { kind: 'ring', n: 20, speed: 40, every: 3.2 }, { kind: 'summon', type: 'herald', n: 2, every: 12 }] },
      { at: 0.15, attacks: [{ kind: 'well', dur: 6, pull: 40, every: 9 }, { kind: 'spiral', arms: 6, dur: 5, rate: 0.08, speed: 44, every: 6.5 }, { kind: 'aimed', n: 7, spread: 0.8, speed: 58, every: 2.2 }, { kind: 'beam', cols: 3, telegraph: 1, dur: 1.2, every: 5 }] }] },

  // ---- Counterattack bosses (the end of stages 2-6) ----
  scrapking: { name: 'Scrapmonger Vorr', title: 'Counterattack boss', hp: 90, r: 13, shape: 'bossScrap', color: 0xffb070, move: 'hover', y: 116,
    parts: [{ kind: 'claw', offsets: [[-17, -5], [17, -5]], hp: 0.12, r: 4.4, shape: 'claw', fire: { every: 2.8, kind: 'aimed', speed: 48, dmg: 1 }, respawnPhase: true }],
    weak: { every: 9, dur: 4, x: 0, r: 5 }, cores: 2,
    phases: [
      { at: 1, attacks: [{ kind: 'mines', n: 3, every: 6 }, { kind: 'aimed', n: 3, spread: 0.25, speed: 46, every: 3 }] },
      { at: 0.6, attacks: [{ kind: 'sweep', arc: 1.7, telegraph: 1.1, dur: 2.2, every: 7 }, { kind: 'mines', n: 4, every: 6 }, { kind: 'summon', type: 'scrapper', n: 2, every: 12 }] },
      { at: 0.25, attacks: [{ kind: 'sweep', arc: 2.2, telegraph: 0.9, dur: 2, every: 5.5 }, { kind: 'gapwall', speed: 30, gap: 16, every: 6 }, { kind: 'mines', n: 5, every: 5 }] }] },
  shroud: { name: 'The Red Shroud', title: 'Counterattack boss', hp: 85, r: 11, shape: 'bossShroud', color: 0xff4d6d, move: 'teleport', y: 112,
    weak: { every: 8, dur: 3, x: 0, r: 5 }, cores: 2,
    phases: [
      { at: 1, attacks: [{ kind: 'split', n: 3, spread: 0.5, speed: 32, every: 3.4 }, { kind: 'veil', dur: 2.2, every: 10 }] },
      { at: 0.6, attacks: [{ kind: 'wave', n: 4, speed: 30, every: 4 }, { kind: 'veil', dur: 2, every: 8 }, { kind: 'summon', type: 'stalker', n: 2, every: 11 }] },
      { at: 0.25, attacks: [{ kind: 'split', n: 5, spread: 0.8, speed: 36, every: 3 }, { kind: 'wave', n: 5, speed: 34, every: 3.6 }, { kind: 'hbeam', rows: 1, telegraph: 1.2, dur: 1, every: 7 }] }] },
  admiral: { name: 'Iron Admiral Kross', title: 'Counterattack boss', hp: 125, r: 15, shape: 'bossAdmiral', color: 0x3dffb5, move: 'slow', y: 120, armour: 0.7, armourWhileParts: true,
    parts: [{ kind: 'turret', offsets: [[-19, -3], [-8, -10], [8, -10], [19, -3]], hp: 0.09, r: 3.8, shape: 'deckgun', fire: { every: 2.8, kind: 'aimed', speed: 54, dmg: 1.1 }, respawnPhase: true }],
    weak: { every: 10, dur: 5, x: 0, r: 5 }, cores: 3,
    phases: [
      { at: 1, attacks: [{ kind: 'hbeam', rows: 1, telegraph: 1.4, dur: 1.1, every: 6 }, { kind: 'gapwall', speed: 28, gap: 18, every: 7 }] },
      { at: 0.6, attacks: [{ kind: 'hbeam', rows: 2, telegraph: 1.3, dur: 1.1, every: 6 }, { kind: 'ambush', type: 'flanker', n: 2, every: 10 }, { kind: 'sweep', arc: 1.6, telegraph: 1.1, dur: 2, every: 8 }] },
      { at: 0.25, attacks: [{ kind: 'hbeam', rows: 2, telegraph: 1.1, dur: 1.2, every: 5 }, { kind: 'sweep', arc: 2.1, telegraph: 0.9, dur: 2, every: 6.5 }, { kind: 'gapwall', speed: 32, gap: 16, every: 6 }] }] },
  hiveheart: { name: 'The Hive Heart', title: 'Counterattack boss', hp: 115, r: 12, shape: 'bossHeart', color: 0xff5fd2, move: 'hover', y: 114,
    parts: [{ kind: 'tendril', n: 6, orbit: 19, speed: 0.8, hp: 0.07, r: 3.6, shape: 'tendril', respawnPhase: true }],
    weak: { every: 7, dur: 3.5, x: 0, r: 5 }, cores: 3,
    phases: [
      { at: 1, attacks: [{ kind: 'hbeam', rows: 1, telegraph: 1.3, dur: 0.9, every: 6 }, { kind: 'split', n: 3, spread: 0.5, speed: 30, every: 3.5 }, { kind: 'summon', type: 'swarmling', n: 8, every: 10 }] },
      { at: 0.6, attacks: [{ kind: 'hbeam', rows: 2, telegraph: 1.2, dur: 0.9, every: 5.5 }, { kind: 'ambush', type: 'lunger', n: 2, every: 8 }, { kind: 'rain', n: 8, speed: 40, every: 3.5 }] },
      { at: 0.25, attacks: [{ kind: 'hbeam', rows: 2, telegraph: 1, dur: 1, every: 4.5 }, { kind: 'split', n: 5, spread: 0.9, speed: 34, every: 3 }, { kind: 'ambush', type: 'lunger', n: 3, every: 7 }] }] },
  unmaker: { name: 'The Unmaker', title: 'Final boss', hp: 140, r: 14, shape: 'bossUnmaker', color: 0xffd166, move: 'teleport', y: 100,
    parts: [{ kind: 'plate', n: 3, orbit: 21, speed: 1.2, hp: 0.25, r: 5, shape: 'shard', armour: 0.8, blocker: true, respawnPhase: true }],
    weak: { every: 8, dur: 3.5, x: 0, r: 5 }, cores: 5,
    phases: [
      { at: 1, attacks: [{ kind: 'sweep', arc: 1.8, telegraph: 1.1, dur: 2.2, every: 7 }, { kind: 'wave', n: 4, speed: 32, every: 4 }, { kind: 'teleport', every: 9 }] },
      { at: 0.7, attacks: [{ kind: 'well', dur: 5, pull: 28, every: 11 }, { kind: 'hbeam', rows: 2, telegraph: 1.2, dur: 1, every: 6 }, { kind: 'split', n: 5, spread: 0.8, speed: 34, every: 3.6 }] },
      { at: 0.4, attacks: [{ kind: 'teleport', every: 6 }, { kind: 'sweep', arc: 2.4, telegraph: 1, dur: 2.2, every: 6 }, { kind: 'gapwall', speed: 34, gap: 15, every: 5.5 }, { kind: 'ambush', type: 'riftling', n: 2, every: 11 }] },
      { at: 0.15, attacks: [{ kind: 'hbeam', rows: 2, telegraph: 0.9, dur: 1.1, every: 4.5 }, { kind: 'sweep', arc: 2.6, telegraph: 0.9, dur: 2, every: 5 }, { kind: 'wave', n: 6, speed: 36, every: 3.2 }, { kind: 'well', dur: 5, pull: 34, every: 10 }] }] },

  // ---- mini bosses (every 10th wave) ----
  warden: { name: 'Picket Warden', title: 'Mini boss', mini: true, hp: 22, r: 8, shape: 'miniA', color: 0x6fd3ff, move: 'hover', y: 118, weak: { every: 8, dur: 3.5, x: 0, r: 4 }, cores: 0,
    phases: [{ at: 1, attacks: [{ kind: 'aimed', n: 3, spread: 0.3, speed: 46, every: 2.8 }] }, { at: 0.4, attacks: [{ kind: 'aimed', n: 3, spread: 0.3, speed: 50, every: 2.2 }, { kind: 'ring', n: 10, speed: 32, every: 5 }] }] },
  gravekeeper: { name: 'Gravekeeper', title: 'Mini boss', mini: true, hp: 26, r: 8.5, shape: 'miniB', color: 0xc9d2ff, move: 'hover', y: 118, armour: 0.4, weak: { every: 8, dur: 3.5, x: 0, r: 4 }, cores: 0,
    phases: [{ at: 1, attacks: [{ kind: 'shell', n: 2, radius: 10, telegraph: 1.5, every: 4.5 }, { kind: 'summon', type: 'splitter', n: 2, every: 10 }] }, { at: 0.4, attacks: [{ kind: 'shell', n: 3, radius: 11, telegraph: 1.3, every: 4 }, { kind: 'aimed', n: 1, spread: 0, speed: 90, every: 1.8 }] }] },
  veilmother: { name: 'Veilmother', title: 'Mini boss', mini: true, hp: 26, r: 8, shape: 'miniC', color: 0xff7a5c, move: 'teleport', y: 112, weak: { every: 7, dur: 3, x: 0, r: 4 }, cores: 0,
    phases: [{ at: 1, attacks: [{ kind: 'teleport', every: 5 }, { kind: 'summon', type: 'phantom', n: 2, every: 8 }, { kind: 'ring', n: 12, speed: 34, every: 4 }] }, { at: 0.4, attacks: [{ kind: 'teleport', every: 3.5 }, { kind: 'spiral', arms: 3, dur: 3, rate: 0.12, speed: 36, every: 6 }] }] },
  foundry: { name: 'Foundry Node', title: 'Mini boss', mini: true, hp: 30, r: 9, shape: 'miniD', color: 0x3dffb5, move: 'slow', y: 120, armour: 0.5, weak: { every: 8, dur: 4, x: 0, r: 4 }, cores: 0,
    phases: [{ at: 1, attacks: [{ kind: 'beam', cols: 2, telegraph: 1.3, dur: 1, every: 5.5 }, { kind: 'summon', type: 'plate', n: 2, every: 11 }] }, { at: 0.4, attacks: [{ kind: 'beam', cols: 3, telegraph: 1.1, dur: 1, every: 4.5 }, { kind: 'shell', n: 2, radius: 11, telegraph: 1.3, every: 5 }] }] },
  broodqueen: { name: 'Brood Queen', title: 'Mini boss', mini: true, hp: 30, r: 9, shape: 'miniE', color: 0xc77dff, move: 'hover', y: 116, weak: { every: 7, dur: 3.5, x: 0, r: 4 }, cores: 0,
    phases: [{ at: 1, attacks: [{ kind: 'summon', type: 'swarmling', n: 10, every: 7 }, { kind: 'rain', n: 7, speed: 42, every: 3 }] }, { at: 0.4, attacks: [{ kind: 'summon', type: 'lancer', n: 4, every: 7 }, { kind: 'ring', n: 16, speed: 36, every: 3.5 }] }] },
  eventguard: { name: 'Event Guard', title: 'Mini boss', mini: true, hp: 34, r: 9, shape: 'miniF', color: 0xffd166, move: 'teleport', y: 114, armour: 0.3, weak: { every: 7, dur: 3, x: 0, r: 4 }, cores: 0,
    phases: [{ at: 1, attacks: [{ kind: 'teleport', every: 5 }, { kind: 'well', dur: 4, pull: 24, every: 10 }, { kind: 'aimed', n: 5, spread: 0.5, speed: 54, every: 2.4 }] }, { at: 0.4, attacks: [{ kind: 'teleport', every: 4 }, { kind: 'spiral', arms: 4, dur: 3, rate: 0.1, speed: 40, every: 5.5 }, { kind: 'beam', cols: 2, telegraph: 1, dur: 1, every: 6 }] }] },
};
