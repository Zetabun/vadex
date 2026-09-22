// Sectors: length, look, enemy pool (type, first wave-in-sector it appears, weight), bosses, new systems.
export const SECTORS = [
  { id: 'orbit', name: 'Outer Orbit', waves: 40, boss: 'broodcarrier', mini: 'warden',
    sky: ['#050a24', '#0d1b4a', '#123a6b'], star: '#bcd8ff', accent: '#5ee6ff', decor: 'none',
    intro: 'Scout formations. Learn the guns.',
    pool: [['grunt', 1, 10], ['weaver', 4, 6], ['diver', 12, 4], ['lancer', 22, 3], ['plate', 30, 3]] },
  { id: 'graveyard', name: 'Lunar Graveyard', waves: 50, boss: 'bastion', mini: 'gravekeeper',
    sky: ['#07070f', '#1a1c2e', '#3a3f55'], star: '#e6e2d0', accent: '#c9d2ff', decor: 'rocks',
    intro: 'Wrecks hide shield projectors and snipers. Scrap is plentiful.',
    pool: [['grunt', 1, 7], ['weaver', 1, 5], ['diver', 1, 4], ['plate', 1, 4], ['aegis', 3, 2.5], ['splitter', 10, 4], ['sniper', 18, 3], ['carrier', 28, 2], ['lancer', 1, 3]] },
  { id: 'nebula', name: 'Red Nebula', waves: 60, boss: 'wyrm', mini: 'veilmother',
    sky: ['#1a0410', '#4a0d22', '#8a2432'], star: '#ffd0c0', accent: '#ff7a5c', decor: 'mist',
    intro: 'Sensors falter. Phantoms cloak, menders repair, rockets home.',
    pool: [['weaver', 1, 6], ['diver', 1, 4], ['phantom', 2, 5], ['mender', 8, 2.5], ['rocketeer', 16, 3.5], ['swarmling', 24, 5], ['aegis', 1, 2], ['splitter', 1, 3], ['sniper', 1, 3], ['plate', 1, 3]] },
  { id: 'machine', name: 'Machine Territory', waves: 70, boss: 'dreadnought', mini: 'foundry',
    sky: ['#02110f', '#06302c', '#0b5a4a'], star: '#b8ffe6', accent: '#3dffb5', decor: 'grid',
    intro: 'Armoured lines, artillery and beam emitters. Alien Matter appears.',
    pool: [['plate', 1, 7], ['artillery', 2, 3.5], ['lasher', 10, 3], ['herald', 18, 2.5], ['aegis', 1, 2.5], ['rocketeer', 1, 3], ['sniper', 1, 3], ['carrier', 1, 2], ['mender', 1, 2], ['grunt', 1, 4]] },
  { id: 'hive', name: 'Hive Space', waves: 80, boss: 'oracle', mini: 'broodqueen',
    sky: ['#0d0618', '#2a0f45', '#5a1d7a'], star: '#e8c8ff', accent: '#c77dff', decor: 'spores',
    intro: 'Endless bodies. Area damage and chain weapons earn their keep.',
    pool: [['swarmling', 1, 10], ['splitter', 1, 6], ['carrier', 1, 4], ['lancer', 1, 5], ['herald', 1, 3], ['mender', 1, 3], ['phantom', 1, 3], ['diver', 1, 4], ['lasher', 20, 2], ['artillery', 30, 2]] },
  { id: 'singularity', name: 'Singularity Frontier', waves: 100, boss: 'singularity', mini: 'eventguard',
    sky: ['#000004', '#0a0a2a', '#2b1055'], star: '#ffffff', accent: '#ffd166', decor: 'rings',
    intro: 'Everything at once, and gravity is not on your side.',
    pool: [['plate', 1, 5], ['phantom', 1, 4], ['artillery', 1, 3], ['lasher', 1, 3], ['herald', 1, 3], ['aegis', 1, 3], ['mender', 1, 3], ['carrier', 1, 3], ['splitter', 1, 4], ['rocketeer', 1, 4], ['sniper', 1, 4], ['lancer', 1, 4], ['swarmling', 1, 5]] },
];
export const ENDLESS = { name: 'Deep Void', waves: 100 };
const STARTS = []; { let s = 1; for (const sec of SECTORS) { STARTS.push(s); s += sec.waves; } STARTS.push(s); }
export const LAST_WAVE = STARTS[STARTS.length - 1] - 1;

/** → { idx (0-based, keeps growing in endless), def, n (1-based wave in sector), len, start, endless } */
export function sectorOf(w) {
  for (let i = 0; i < SECTORS.length; i++) if (w < STARTS[i + 1]) return { idx: i, def: SECTORS[i], n: w - STARTS[i] + 1, len: SECTORS[i].waves, start: STARTS[i], endless: false };
  const k = Math.floor((w - LAST_WAVE - 1) / ENDLESS.waves);
  const base = SECTORS[(k + 3) % SECTORS.length];
  return { idx: SECTORS.length + k, def: { ...SECTORS[5], name: `${ENDLESS.name} ${k + 1}`, boss: base.boss, mini: base.mini, pool: SECTORS[5].pool }, n: ((w - LAST_WAVE - 1) % ENDLESS.waves) + 1, len: ENDLESS.waves, start: LAST_WAVE + 1 + k * ENDLESS.waves, endless: true };
}
export const sectorStart = (i) => STARTS[Math.min(i, STARTS.length - 1)];
