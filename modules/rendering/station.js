// The orbital station, drawn in the hangar sky above the home world (layout and meaning: data/station.js), and as the
// hologram on the Command Deck's table. Rebuilt whenever the Workshop or Overhaul rank changes; otherwise it turns
// slowly, its lights breathe and a shuttle comes and goes. After a lost Station Siege, until it is repaired, its lights
// are half out and flickering and smoke and sparks pour off the systems that were knocked out.
import { STATION_MODULES, STATION_ALIEN, STATION_TROPHIES, MODULE_BY_ID, ALIEN_BY_ID, TROPHY_BY_ID, coreBuilt, trophyWon } from '@last-orbit/data/station.js';
import { BOSSES } from '@last-orbit/data/bosses.js';
import { shapeGeometry } from '@last-orbit/rendering/geometry.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
const T = () => window.THREE;
const MAX = Object.fromEntries(WORKSHOP.map((u) => [u.id, u.max]));

// ---- procedural textures (shared by every station)
let TEX = null;
function canvasTex(w, h, draw) { const THREE = T(), c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
function textures() {
  if (TEX) return TEX;
  const panels = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#d6dbe6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '90,100,120'},${0.05 + Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 26, 4 + Math.random() * 18); }
    g.strokeStyle = 'rgba(70,80,100,.55)'; g.lineWidth = 1.5;
    for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 32) % 2 ? 16 : 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } }
    g.fillStyle = 'rgba(60,70,90,.6)'; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  });
  const windows = canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h; y += 22) for (let x = 4; x < w; x += 10) if (Math.random() < 0.7) { g.fillStyle = Math.random() < 0.8 ? '#ffd9a0' : '#9fe8ff'; g.fillRect(x, y, 5, 6); }
  });
  const solar = canvasTex(128, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1a3a8a'); gr.addColorStop(0.5, '#10265e'); gr.addColorStop(1, '#1c4596'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(200,215,255,.55)'; g.lineWidth = 1; for (let x = 0; x <= w; x += 8) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); g.stroke(); } for (let y = 0; y <= h; y += 8) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke(); }
    g.strokeStyle = 'rgba(230,235,255,.9)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  });
  const foil = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#c8962e'; g.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,230,160' : '120,80,20'},${0.15 + Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 14, 2 + Math.random() * 8); } });
  return (TEX = { panels, windows, solar, foil });
}

export class Station {
  constructor(scene) {
    const THREE = T(), X = textures(); this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group); this.sig = ''; this.t = 0; this.fade = 0; this.pulses = []; this.trophyMats = {}; this.trophies = [];
    this.body = new THREE.Group(); this.group.add(this.body); this.blink = []; this.rings = []; this.nav = []; this.crown = null;
    const Ph = (o) => new THREE.MeshPhongMaterial(o);
    this.M = {
      hull: Ph({ color: 0xffffff, map: X.panels, specular: 0x506070, shininess: 28, emissive: 0xffd49a, emissiveMap: X.windows, emissiveIntensity: 0.9 }),
      plain: Ph({ color: 0xffffff, map: X.panels, specular: 0x506070, shininess: 28 }),
      dark: Ph({ color: 0x323b50, specular: 0x222833, shininess: 18 }),
      truss: Ph({ color: 0x9aa5ba, specular: 0x333844, shininess: 20 }),
      gold: Ph({ color: 0xffffff, map: X.foil, specular: 0xffe7a0, shininess: 70 }),
      solar: Ph({ color: 0xffffff, map: X.solar, specular: 0x9fb8ff, shininess: 90, side: THREE.DoubleSide }),
      radiator: Ph({ color: 0xf2f4f8, specular: 0x888888, shininess: 40, side: THREE.DoubleSide }),
      glass: Ph({ color: 0x0f3550, emissive: 0x1d7aa0, specular: 0xd0f4ff, shininess: 120, transparent: true, opacity: 0.88 }),
      light: new THREE.MeshBasicMaterial({ color: 0x9ff0ff }), warm: new THREE.MeshBasicMaterial({ color: 0xffd27a }), red: new THREE.MeshBasicMaterial({ color: 0xff4455 }), green: new THREE.MeshBasicMaterial({ color: 0x44ff88 }), strobe: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      off: Ph({ color: 0x2a3140, shininess: 10 }), engine: new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.85 }),
      scaffold: new THREE.LineBasicMaterial({ color: 0x5ee6ff, transparent: true, opacity: 0.4 }),
      halo: new THREE.MeshBasicMaterial({ color: 0x5ee6ff, transparent: true, opacity: 0.2, depthWrite: false }),
      alien: Ph({ color: 0x4a2c66, emissive: 0x1c0a30, specular: 0xb08aff, shininess: 70 }), alienGlow: new THREE.MeshBasicMaterial({ color: 0xc18cff }),
      field: new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
    const G = THREE;
    this.geo = { box: new G.BoxGeometry(1, 1, 1), cyl: new G.CylinderGeometry(1, 1, 1, 20), cone: new G.ConeGeometry(1, 1, 16), sph: new G.SphereGeometry(1, 20, 14),
      dome: new G.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), torus: new G.TorusGeometry(1, 0.03, 6, 72), ring: new G.TorusGeometry(1, 0.24, 12, 48), oct: new G.OctahedronGeometry(1, 0), plane: new G.PlaneGeometry(1, 1) };
    this.edges = {}; // scaffold outlines, by geometry
    this.shuttle = this.makeShuttle(); this.group.add(this.shuttle); this.smoke = []; this.dmgAt = [];
  }
  /** Rebuild if the Workshop, the Overhaul rank or the Alien Tech fitted changed. */
  sync(state) {
    // damage from a lost siege (no rebuild: it only smokes)
    const dmg = state.siege?.damage?.ids || [], dsig = dmg.join();
    if (dsig !== this.dmgSig) { this.dmgSig = dsig; this.dmgAt = dmg.map((id) => MODULE_BY_ID[id] || ALIEN_BY_ID[id]).filter(Boolean).map((m) => ({ x: m.x, y: m.y, t: Math.random() * 0.3 })); }
    const rank = state.prestige?.level || 0, peak = (id) => Math.max(state.stationPeak?.[id] || 0, state.workshop[id] || 0), tech = state.counter?.tech || {};
    const alien = STATION_ALIEN.filter((a) => (tech[a.id] || 0) > 0), caught = STATION_TROPHIES.filter((t) => trophyWon(state, t.stage));
    const sig = rank + ':' + STATION_MODULES.map((m) => (state.workshop[m.id] || 0) + '/' + peak(m.id)).join(',') + '|' + alien.map((a) => a.id).join(',') + '|' + caught.map((t) => t.stage).join('');
    if (sig === this.sig) return; this.sig = sig;
    const b = this.body; while (b.children.length) b.remove(b.children[0]); this.blink = []; this.rings = []; this.nav = []; this.crown = null; this.trophies = [];
    this.core(rank);
    // never un-built: a module stays once it has been built; the Workshop reset after an Overhaul only puts its lights out
    for (const m of STATION_MODULES) { const lvl = state.workshop[m.id] || 0; this.module(m, peak(m.id) <= 0 ? 'ghost' : lvl >= MAX[m.id] ? 'lit' : 'built'); }
    for (const a of alien) this.alien(a);
    for (const t of caught) this.trophy(t);
    this.wreckage(1 - STATION_MODULES.reduce((a, m) => a + Math.min(MAX[m.id], peak(m.id)), 0) / STATION_MODULES.reduce((a, m) => a + MAX[m.id], 0));
  }
  part(geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const THREE = T(); let m;
    if (mat === 'ghost') { const e = this.edges[geo] ||= new THREE.EdgesGeometry(this.geo[geo], 25); m = new THREE.LineSegments(e, this.M.scaffold); }
    else m = new THREE.Mesh(this.geo[geo], mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); this.body.add(m); return m;
  }
  /** Open lattice trusses ([axis 'x'|'y', from, to, offset]) as one instanced mesh: four longerons and zigzag bracing. */
  truss(bars) {
    const THREE = T(), segs = [], k = 0.32, bay = 1.6;
    for (const [axis, a0, a1, c] of bars) {
      const len = a1 - a0, n = Math.max(1, Math.round(len / bay)), step = len / n;
      const at = (u, v, w) => (axis === 'x' ? [u, c + v, w] : [c + v, u, w]);
      for (const [v, w] of [[-k, -k], [-k, k], [k, -k], [k, k]]) segs.push({ p: at(a0 + len / 2, v, w), s: axis === 'x' ? [len, 0.11, 0.11] : [0.11, len, 0.11], r: [0, 0, 0] });
      for (let i = 0; i < n; i++) {
        const u = a0 + step * (i + 0.5), ang = Math.atan2(2 * k, step), diag = Math.hypot(step, 2 * k);
        for (const w of [-k, k]) segs.push({ p: at(u, 0, w), s: axis === 'x' ? [diag, 0.07, 0.07] : [0.07, diag, 0.07], r: [0, 0, (axis === 'x' ? 1 : -1) * (i % 2 ? ang : -ang)] });
      }
    }
    const mesh = new THREE.InstancedMesh(this.geo.box, this.M.truss, segs.length), d = new THREE.Object3D();
    segs.forEach((s, i) => { d.position.set(...s.p); d.scale.set(...s.s); d.rotation.set(...s.r); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); });
    this.body.add(mesh); return mesh;
  }
  /** A group turning about the station's vertical axis (rings), holding what add() moves into it. */
  spinner(y) { const THREE = T(), r = new THREE.Group(); r.position.y = y; this.body.add(r); this.rings.push(r); return (m) => { this.body.remove(m); r.add(m); m.position.y -= y; return m; }; }
  core(rank) {
    const M = this.M, P = (...a) => this.part(...a), has = (id) => coreBuilt(id, rank);
    // what each core piece added to the body, so a cinematic can build one in front of you (rendering/rebuild.js)
    this.pieces = {}; const piece = (id, fn) => { if (!has(id)) return; const n = this.body.children.length; fn(); this.pieces[id] = this.body.children.slice(n); };
    // the backbone: a lattice truss across and a spine up and down
    this.truss([['x', -13.6, -1.8, 0], ['x', 1.8, 13.6, 0], ['y', 3.4, 9.8, 0], ['y', -9, -3.4, 0]]);
    // the hub: a windowed core with end cones, docking ports and gold-foil bands
    P('cyl', M.hull, 0, 0, 0, 1.8, 6, 1.8); P('cone', M.plain, 0, 3.55, 0, 1.8, 1.1, 1.8); P('cone', M.plain, 0, -3.55, 0, 1.8, 1.1, 1.8, Math.PI);
    for (const y of [-2.2, 2.2]) P('cyl', M.gold, 0, y, 0, 1.86, 0.5, 1.86);
    for (const s of [-1, 1]) { P('cyl', M.plain, 0, 0.8, s * 2.2, 0.6, 0.9, 0.6, Math.PI / 2); P('cyl', M.dark, 0, 0.8, s * 2.68, 0.45, 0.08, 0.45, Math.PI / 2); }
    // radiators along the spine
    for (const s of [-1, 1]) P('plane', M.radiator, s * 1.6, 6.6, 0, 2.2, 3.6, 1, 0, s * 0.5, 0);
    // navigation lights: red to port, green to starboard, a white strobe on top
    this.nav.push([P('sph', M.red, -13.8, 0.5, 0, 0.28, 0.28, 0.28), 0], [P('sph', M.green, 13.8, 0.5, 0, 0.28, 0.28, 0.28), 0.5], [P('sph', M.strobe, 0, 10, 0, 0.22, 0.22, 0.22), 0.25]);
    piece('deck', () => { P('dome', M.glass, 0, 4.1, 0, 1.5, 1.2, 1.5); P('cyl', M.gold, 0, 4.1, 0, 1.6, 0.16, 1.6); });
    piece('ring', () => { const add = this.spinner(0.6); add(P('ring', M.hull, 0, 0.6, 0, 4.6, 4.6, 4.6, Math.PI / 2)); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; add(P('cyl', M.truss, Math.cos(a) * 3.2, 0.6, Math.sin(a) * 3.2, 0.1, 2.9, 0.1, 0, -a, Math.PI / 2)); } });
    piece('spire', () => { P('cyl', M.truss, 0, 12.6, 0, 0.14, 5.2, 0.14); P('sph', M.plain, 0, 11.2, 0, 0.5, 0.5, 0.5); P('dome', M.plain, 0.9, 13.5, 0, 0.7, 0.28, 0.7, 0, 0, -0.6); this.blink.push(P('sph', M.red, 0, 15.3, 0, 0.26, 0.26, 0.26)); });
    piece('solar', () => { for (const s of [-1, 1]) { P('cyl', M.truss, s * 15.4, 0, 0, 0.12, 3.8, 0.12, 0, 0, Math.PI / 2); for (const y of [-1.75, 1.75]) P('plane', M.solar, s * 19.8, y, 0, 6.4, 3, 1, -0.35, 0, 0); P('box', M.truss, s * 19.8, 0, 0, 6.4, 0.12, 0.12); } });
    piece('ring2', () => { const add = this.spinner(-0.4); add(P('ring', M.hull, 0, -0.4, 0, 7.8, 7.8, 5, Math.PI / 2)); });
    piece('dome', () => { P('sph', M.glass, 0, -10.8, 0, 1.5, 1.5, 1.5); P('cyl', M.gold, 0, -9.5, 0, 0.9, 0.3, 0.9); });
    piece('yard', () => { for (const [x, y, w, h] of [[-4.2, -4.6, 5, 0.16], [-4.2, -7.4, 5, 0.16], [-6.6, -6, 0.16, 3], [-1.8, -6, 0.16, 3]]) P('box', M.gold, x, y, 0, w, h, 0.16); P('cone', M.plain, -4.2, -6, 0, 0.6, 2.4, 0.45, 0, 0, -Math.PI / 2); });
    piece('beacons', () => { for (const [x, y] of [[-13.6, -0.8], [13.6, -0.8], [0, 9.9], [0, -9]]) this.blink.push(P('sph', M.warm, x, y, 0.4, 0.32, 0.32, 0.32)); });
    piece('halo', () => { const add = this.spinner(0); add(P('torus', M.halo, 0, 0, 0, 11.5, 11.5, 11.5, Math.PI / 2 - 0.25)); });
    piece('crown', () => { this.crown = P('oct', M.warm, 0, 17, 0, 1, 1.5, 1); });
  }
  module(m, st) {
    const M = this.M, ghost = st === 'ghost', lit = st === 'lit';
    const h = ghost ? 'ghost' : M.plain, hw = ghost ? 'ghost' : M.hull, d = ghost ? 'ghost' : M.dark, g = ghost ? 'ghost' : M.gold, gl = ghost ? 'ghost' : M.glass;
    const glow = ghost ? null : lit ? M.light : M.off, warm = ghost ? null : lit ? M.warm : M.off;
    const P = (geo, mat, x, y, z, ...r) => (mat ? this.part(geo, mat, m.x + x, m.y + y, z, ...r) : null), up = m.y >= 0 ? 1 : -1, L = [];
    switch (m.shape) {
      case 'battery': P('box', h, 0, 0, 0, 2.4, 1.1, 1.4); P('box', g, 0, -0.3 * up, 0, 2.5, 0.3, 1.45); for (const x of [-0.5, 0.5]) P('cyl', d, x, 1.1 * up, 0, 0.18, 1.6, 0.18); L.push(P('box', warm, 0, 0.1 * up, 0.72, 1.6, 0.16, 0.04)); break;
      case 'drum': P('cyl', h, 0, 0, 0, 1, 1.4, 1, Math.PI / 2); P('cyl', g, 0, 0, 0, 1.05, 0.3, 1.05, Math.PI / 2); P('cyl', d, 0, 0, 0.75, 0.45, 0.12, 0.45, Math.PI / 2); L.push(P('sph', glow, 0, 0, 0.8, 0.2, 0.2, 0.08)); break;
      case 'dish': P('dome', h, 0, 0.2 * up, 0, 1.5, 0.55, 1.5, up > 0 ? 0 : Math.PI); P('cyl', d, 0, -0.3 * up, 0, 0.1, 0.8, 0.1); L.push(P('sph', glow, 0, 0.95 * up, 0, 0.22, 0.22, 0.22)); break;
      case 'sensor': P('box', h, 0, 0, 0, 1.4, 1, 1); P('box', g, -0.3, 0, 0.52, 0.6, 0.6, 0.05); P('cyl', d, 0.4, -1.1, 0, 0.06, 1.6, 0.06); L.push(P('sph', lit ? M.red : glow, 0.4, -1.9, 0, 0.18, 0.18, 0.18)); break;
      case 'thruster': P('cyl', h, -0.6, 0, 0, 0.9, 1.4, 0.9, 0, 0, Math.PI / 2); P('cone', d, 0.8, 0, 0, 0.9, 1.3, 0.9, 0, 0, -Math.PI / 2); L.push(P('sph', lit ? M.engine : glow, 1.45, 0, 0, 0.5, 0.5, 0.5)); break;
      case 'plates': for (const [y, mt] of [[-0.45, d], [0, g], [0.45, d]]) P('box', mt, 0, y, 0.1, 2.6, 0.36, 1.3); L.push(P('box', warm, 1.2, 0, 0.76, 0.12, 0.9, 0.04)); break;
      case 'bay': P('box', hw, 0, 0, 0, 2.2, 1.6, 1.6); L.push(P('box', lit ? M.green : glow, 0, 0, 0.82, 0.8, 0.22, 0.04), P('box', lit ? M.green : glow, 0, 0, 0.82, 0.22, 0.8, 0.04)); break;
      case 'cargo': for (const [x, y, mt] of [[-0.6, -0.4, g], [0.6, -0.4, h], [0, 0.45, g]]) P('box', mt, x, y, 0, 1.1, 0.8, 1.1); L.push(P('box', warm, 0, 0.9, 0.3, 0.5, 0.1, 0.04)); break;
      case 'bunker': P('box', h, 0, 0, 0, 2.6, 1.2, 1.4); P('box', d, 0, 0.7 * up, 0, 1.8, 0.4, 1.2); L.push(P('box', glow, 0, 0, 0.72, 2, 0.12, 0.04)); break;
      case 'tractor': P('ring', h, 0, 0, 0, 1.3, 1.3, 1.3); P('cyl', d, 0, 0, 0, 0.35, 0.8, 0.35, Math.PI / 2); L.push(P('sph', glow, 0, 0, 0.4, 0.3, 0.3, 0.3)); break;
      case 'hangar': P('box', hw, 0, 0, 0, 3.2, 1.8, 1.8); P('box', d, 0, -0.15, 0.92, 2.2, 1.1, 0.04); L.push(P('box', warm, 0, 0.62, 0.93, 2.4, 0.1, 0.04)); break;
      case 'hab': P('cyl', hw, 0, 0, 0, 0.9, 3.4, 0.9, 0, 0, Math.PI / 2); for (const x of [-1.75, 1.75]) P('cyl', g, x, 0, 0, 0.95, 0.12, 0.95, 0, 0, Math.PI / 2); break;
      case 'comms': P('cyl', d, 0, -0.6, 0, 0.06, 1.4, 0.06); P('dome', h, 0, 0.2, 0, 0.9, 0.3, 0.9, -0.6); L.push(P('sph', glow, 0, 0.6, 0, 0.14, 0.14, 0.14)); break;
      case 'briefing': P('sph', gl, 0, 0, 0, 1.2, 1.2, 1.2); P('cyl', g, 0, 0, 0, 1.25, 0.2, 1.25); break;
      case 'beacon': P('cyl', d, 0, 0, 0, 0.1, 2.4, 0.1); P('cyl', g, 0, 1.1, 0, 0.32, 0.28, 0.32); L.push(P('sph', lit ? M.red : glow, 0, -1.3, 0, 0.32, 0.32, 0.32)); break;
    }
    if (lit) this.blink.push(...L.filter(Boolean));
  }
  /** Captured alien hardware (Alien Tech), on a dark strut from where it is bolted on: violet hull, glowing veins. */
  alien(a) {
    const M = this.M, A = M.alien, G = M.alienGlow, P = (geo, mat, x, y, z, ...r) => this.part(geo, mat, a.x + x, a.y + y, z, ...r);
    const dx = a.x - a.anchor[0], dy = a.y - a.anchor[1]; this.part('cyl', M.dark, a.anchor[0] + dx / 2, a.anchor[1] + dy / 2, 0, 0.13, Math.hypot(dx, dy), 0.13, 0, 0, Math.atan2(dy, dx) - Math.PI / 2);
    switch (a.shape) {
      case 'shards': P('oct', A, 0, 0, 0, 0.75, 1.7, 0.75, 0, 0, 0.35); P('oct', A, 0.95, -0.45, 0.25, 0.5, 1.2, 0.5, 0, 0, -0.55); P('oct', A, -0.75, -0.55, -0.2, 0.45, 1.05, 0.45, 0, 0, 0.95); P('oct', G, 0, 0, 0, 0.3, 1.95, 0.3, 0, 0, 0.35); break;
      case 'coil': P('ring', A, 0, 0, 0, 1.25, 1.25, 1.25); P('sph', G, 0, 0, 0, 0.5, 0.5, 0.5); for (let i = 0; i < 3; i++) { const t = i * 2.094 + 0.5; P('oct', A, Math.cos(t) * 1.6, Math.sin(t) * 1.6, 0, 0.22, 0.55, 0.22, 0, 0, t - Math.PI / 2); } break;
      case 'spike': P('oct', A, 0, 0, 0, 0.6, 0.6, 0.6); P('cone', A, 0.55, 1.45, 0, 0.32, 2.8, 0.32, 0, 0, -0.36); P('sph', G, 1.05, 2.85, 0, 0.2, 0.2, 0.2); P('cone', A, -0.45, 0.9, 0, 0.2, 1.6, 0.2, 0, 0, 0.45); P('sph', G, -0.8, 1.6, 0, 0.14, 0.14, 0.14); break;
      case 'siphon': P('cone', A, 0, -0.2, 0, 1.05, 1.9, 1.05, Math.PI); P('sph', G, 0, -1.35, 0, 0.42, 0.42, 0.42); for (const s of [-1, 1]) P('cone', A, s * 0.95, -1.1, 0, 0.16, 1.1, 0.16, 0, 0, s * 0.5 + Math.PI); break;
    }
  }
  /** A captured boss, held off the station in a tractor field: its own hull, darkened, turning slowly. */
  trophy(t) {
    const THREE = T(), b = BOSSES[t.boss] || {}, dark = new THREE.Color(0x16141f);
    const mat = (this.trophyMats[t.boss] ||= new THREE.MeshPhongMaterial({ color: new THREE.Color(b.color || 0x8890a0).lerp(dark, 0.45), emissive: new THREE.Color(b.color || 0x8890a0).multiplyScalar(0.12), specular: 0x55607a, shininess: 30 }));
    const m = new THREE.Mesh(shapeGeometry(b.shape), mat); m.position.set(t.x, t.y, 0); m.scale.setScalar(1.9); m.userData.ph = t.stage * 1.7; this.body.add(m); this.trophies.push(m);
    const dx = t.x - t.anchor[0], dy = t.y - t.anchor[1]; this.part('cyl', this.M.field, t.anchor[0] + dx / 2, t.anchor[1] + dy / 2, 0, 0.45, Math.hypot(dx, dy), 0.45, 0, 0, Math.atan2(dy, dx) - Math.PI / 2);
  }
  /** A soft glow, twice, over parts that changed while you were away (module or alien ids); it waits for the station to fade in. */
  pulse(ids) {
    const THREE = T(); this.glowTex ||= canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(170,240,255,.7)'); gr.addColorStop(1, 'rgba(94,230,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    for (const id of ids) {
      const m = MODULE_BY_ID[id] || ALIEN_BY_ID[id] || TROPHY_BY_ID[id]; if (!m) continue;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: ALIEN_BY_ID[id] ? 0xd8b0ff : 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      s.position.set(m.x, m.y, 1.5); this.body.add(s); this.pulses.push({ s, t: -0.8 });
    }
  }
  /** Wreckage from the old station, drifting round the new one: share 0..1 of it still to clear. */
  wreckage(share) {
    const THREE = T();
    if (!this.wreck) {
      this.wreck = new THREE.InstancedMesh(this.geo.box, new THREE.MeshPhongMaterial({ color: 0x3a3f4c, emissive: 0x0c0806, specular: 0x444a58, shininess: 20 }), 36); this.wreck.frustumCulled = false; this.group.add(this.wreck);
      this.wreckSeed = Array.from({ length: 36 }, (_, i) => ({ r: 13 + Math.random() * 13, a: (i / 36) * Math.PI * 2 + Math.random() * 0.3, y: (Math.random() - 0.5) * 16, sp: 0.02 + Math.random() * 0.05, s: [0.6 + Math.random() * 2.2, 0.12 + Math.random() * 0.3, 0.4 + Math.random() * 1.4], rot: [Math.random() * 6, Math.random() * 6, Math.random() * 6], spin: (Math.random() - 0.5) * 0.6 }));
    }
    this.wreck.count = Math.round(36 * Math.max(0, Math.min(1, share)));
  }
  makeShuttle() {
    const THREE = T(), g = new THREE.Group(), M = this.M;
    const add = (geo, mat, p, s) => { const m = new THREE.Mesh(this.geo[geo], mat); m.position.set(...p); m.scale.set(...s); g.add(m); return m; };
    add('cone', M.plain, [0, 0.9, 0], [0.45, 1.1, 0.35]); add('box', M.plain, [0, -0.1, 0], [0.8, 1.1, 0.5]); add('box', M.dark, [0, -0.2, 0], [1.8, 0.35, 0.12]);
    this.flame = add('sph', M.engine, [0, -0.85, 0], [0.22, 0.5, 0.22]); return g;
  }
  /** A puff of smoke (or now and then a spark) off a damaged system, drifting out from the station. */
  puff(d) {
    const THREE = T(); this.smokeTex ||= canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(96,98,108,.9)'); gr.addColorStop(0.55, 'rgba(62,64,74,.45)'); gr.addColorStop(1, 'rgba(40,40,48,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    this.sparkTex ||= canvasTex(32, 32, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.35, 'rgba(255,170,70,.8)'); gr.addColorStop(1, 'rgba(255,90,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    const spark = Math.random() < 0.2, s = new THREE.Sprite(new THREE.SpriteMaterial({ map: spark ? this.sparkTex : this.smokeTex, transparent: true, depthWrite: false, blending: spark ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: 0 }));
    const out = new THREE.Vector3(d.x, d.y, 0); if (out.lengthSq() < 1) out.set(0, 1, 0); out.normalize();
    s.position.set(d.x + (Math.random() - 0.5) * 1.2, d.y + (Math.random() - 0.5) * 1.2, 1.1); this.body.add(s);
    this.smoke.push({ s, t: 0, spark, life: spark ? 0.3 : 2.2 + Math.random() * 0.8, v: out.multiplyScalar(spark ? 3.5 : 1.1).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.5, 0.6)), size: spark ? 0.7 + Math.random() * 0.5 : 1.2 + Math.random() * 0.8 });
  }
  /** Lights, rings, the shuttle; smoke off anything damaged. */
  animate(dt, night) {
    this.t += dt; const t = this.t, M = this.M;
    // damaged in a lost siege: smoke and sparks off the broken systems, the lights half out and flickering
    const hurt = this.dmgAt.length > 0, flick = hurt ? 0.3 + 0.25 * (Math.sin(t * 13.7) > 0.55 ? 1 : 0) : 1;
    if (hurt) for (const d of this.dmgAt) { d.t -= dt; if (d.t <= 0) { d.t = 0.16 + Math.random() * 0.22; this.puff(d); } }
    for (let i = this.smoke.length - 1; i >= 0; i--) { const p = this.smoke[i]; p.t += dt; const k = p.t / p.life; if (k >= 1) { p.s.parent?.remove(p.s); p.s.material.dispose(); this.smoke.splice(i, 1); continue; }
      p.s.position.addScaledVector(p.v, dt); p.s.scale.setScalar(p.size * (p.spark ? 1 - k : 1 + k * 2.2)); p.s.material.opacity = p.spark ? 1 - k : Math.min(1, k * 6) * (1 - k) * 0.85; }
    for (const r of this.rings) r.rotation.y = t * 0.2;
    if (this.crown) this.crown.rotation.y = t * 0.8;
    const k = (0.8 + 0.2 * Math.sin(t * 2.2) + night * 0.25) * (hurt ? 0.3 + flick * 0.4 : 1); M.light.color.setRGB(0.62 * k, 0.94 * k, k); M.warm.color.setRGB(k, 0.82 * k, 0.48 * k);
    M.hull.emissiveIntensity = (0.55 + night * 0.7) * flick; M.red.color.setRGB(Math.sin(t * 3) > 0.3 ? 1 : 0.25, 0.2, 0.25);
    for (const [m, ph] of this.nav) m.visible = ((t * 0.9 + ph) % 1) < (m.material === M.strobe ? 0.12 : 0.55);
    M.scaffold.opacity = 0.28 + 0.12 * Math.sin(t * 1.6);
    const v = 0.72 + 0.28 * Math.sin(t * 1.3) + night * 0.15; M.alienGlow.color.setRGB(0.66 * v, 0.46 * v, v);
    M.field.opacity = 0.08 + 0.05 * Math.sin(t * 2.1); for (const m of this.trophies) m.rotation.set(Math.sin(t * 0.3 + m.userData.ph) * 0.25, Math.sin(t * 0.2 + m.userData.ph) * 0.5, Math.sin(t * 0.15 + m.userData.ph) * 0.3);
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i]; p.t += dt; const k = p.t / 2.6; if (k >= 1) { p.s.parent?.remove(p.s); p.s.material.dispose(); this.pulses.splice(i, 1); continue; }
      const a = k < 0 ? 0 : Math.abs(Math.sin(k * Math.PI * 2)); p.s.material.opacity = a * (1 - k * 0.3); p.s.scale.setScalar(7 + a * 6);
    }
    if (this.wreck?.count) { const d = (this._d ||= new (T().Object3D)()); for (let i = 0; i < this.wreck.count; i++) { const w = this.wreckSeed[i], a = w.a + t * w.sp; d.position.set(Math.cos(a) * w.r, w.y, Math.sin(a) * w.r * 0.6); d.rotation.set(w.rot[0] + t * w.spin, w.rot[1] + t * w.spin * 0.7, w.rot[2]); d.scale.set(...w.s); d.updateMatrix(); this.wreck.setMatrixAt(i, d.matrix); } this.wreck.instanceMatrix.needsUpdate = true; }
    // the shuttle: a slow loop around the station
    const s = this.shuttle, a = t * 0.35, R = 9.5, x = Math.cos(a) * R, y = 1.8 + Math.sin(a * 2) * 2.2, z = Math.sin(a) * R * 0.6;
    s.position.set(x, y, z); s.lookAt(x - Math.sin(a) * R, y + Math.cos(a * 2) * 4.4 * 0.35, z + Math.cos(a) * R * 0.6); s.rotateX(Math.PI / 2);
    this.flame.scale.y = 0.4 + 0.2 * Math.random();
  }
  /** Place it in the sky, upper right, at a distance behind everything: in the room between the hangar's header and the
   *  ship (room.top, room.low: screen pixels), as big as fits there and at most 260px wide. */
  update(dt, camera, show, night, w, h, room = null) {
    const siege = room === 'siege'; if (siege) room = null;
    const THREE = T(); this.fade += ((show ? 1 : 0) - this.fade) * Math.min(1, dt * 3);
    const g = this.group; g.visible = this.fade > 0.02; if (!g.visible) return;
    this.animate(dt, night);
    // px: on-screen width of the station at full size (46 units with its solar wings); it stands about 27 units tall, 16 of
    // them above the hub, so the hub sits that far below the header.
    // In a Station Siege it is the thing being defended: big, behind the defence line at the foot of the field.
    const top = room?.top ?? h * 0.13, low = room?.low ?? h * 0.33, px = siege ? Math.min(w * 1.3, 820) : Math.max(110, Math.min(w * 0.5, 260, ((low - top - 12) / 27) * 46)), hubY = siege ? h * 0.97 : top + 8 + (16 * px) / 46;
    const D = 420, v = (this._v ||= new THREE.Vector3()).set(siege ? 0 : 0.47, 1 - (2 * hubY) / Math.max(1, h), 0.5).unproject(camera).sub(camera.position).normalize();
    if (!siege) g.position.copy(camera.position).addScaledVector(v, D); this.screenPx = px;
    const perPx = 2 * D * Math.tan((camera.fov * Math.PI) / 360) / Math.max(1, h);
    // in a siege the captured bosses and the old wreckage stay out of the fight's way (they read as enemies there)
    for (const m of this.trophies) m.visible = !siege; this.M.field.visible = !siege; if (this.wreck) this.wreck.visible = !siege;
    if (siege) { g.position.set(0, -7, -50); g.scale.setScalar(2.3 * (0.85 + 0.15 * this.fade)); } // just behind the defence line, in front of the Earth
    if (!siege) g.scale.setScalar((px * perPx / 46) * (0.85 + 0.15 * this.fade));
    g.quaternion.copy(camera.quaternion); // face the camera, then turn a little to show depth
    // where the hub is on screen (the hangar's callout points at it)
    g.updateMatrixWorld(true); this.hubNdc = (this._hn ||= new THREE.Vector3()); this.body.getWorldPosition(this.hubNdc).project(camera);
    this.body.rotation.set(siege ? 0.5 : 0.32, Math.sin(this.t * 0.12) * (siege ? 0.2 : 0.5) + (siege ? 0 : 0.2), Math.sin(this.t * 0.07) * 0.05);
    // struck: the hull's lights and plating flash red and fade
    this.flash = Math.max(0, (this.flash || 0) - dt * 2.2); const f = Math.min(1, this.flash); this.M.hull.emissive.setRGB(1, 0.83 - 0.6 * f, 0.6 - 0.5 * f); this.M.plain.emissive.setRGB(0.55 * f, 0.06 * f, 0.04 * f);
  }
}
