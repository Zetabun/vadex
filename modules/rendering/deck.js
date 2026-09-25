// The Command Deck: the pilot's room aboard the station, a small 3D space to walk around. A big window looks down on
// Earth (the same planet and day/night clock as the hangar); the pilot's medals line the left wall, their ships stand
// on pedestals to the right, banners hang from the ceiling, the records screen and the way out are behind, Overhaul
// trophies sit on a shelf under the window, and a hologram of the station turns on the table in the middle.
// Drag to look, tap the floor to walk there, tap an exhibit to inspect it (the UI shows the details). W/A/S/D walk.
import { Station } from '@last-orbit/rendering/station.js';
import { earthMaterial, nightAmount } from '@last-orbit/rendering/background.js';
import { playerParts } from '@last-orbit/rendering/geometry.js';
import { paintBanner } from '@last-orbit/rendering/bannerArt.js';
import { artSvg } from '@last-orbit/ui/art.js';
import { ACHIEVEMENTS, FEATS } from '@last-orbit/data/achievements.js';
import { BANNERS } from '@last-orbit/data/banners.js';
import { SHIPS } from '@last-orbit/data/ships.js';
import { PAINT_BY_ID, rankTitle } from '@last-orbit/data/career.js';
import { STATION_CORE } from '@last-orbit/data/station.js';
const T = () => window.THREE;

// Room: x -5..5, z -8 (window) .. 4 (back wall), height 3.4. The pilot's eyes are at 1.6.
const W = 5, FRONT = -8, BACK = 4, H = 3.4, EYE = 1.6, SPEED = 2.4;
const TABLE = { x: 0, z: -3, r: 1.3 }, PEDESTAL_X = 4.1, PEDESTAL_Z = [-6.3, -4.7, -3.1, -1.5, 0.1];
const TIER_COL = ['#d08a4e', '#cfd8e8', '#ffc857'], FEAT_COL = '#b69cff';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, repeat) { const THREE = T(), t = new THREE.CanvasTexture(c); t.anisotropy = 4; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; }
/** An icon from the game's art set, drawn into a canvas once it has loaded (the SVG's colour variables inlined). */
function drawArt(key, ctx, x, y, s, done) {
  const src = artSvg(key), a = /--ic-a:([^;"]+)/.exec(src)?.[1] || '#5ee6ff', b = /--ic-b:([^;"]+)/.exec(src)?.[1] || '#2f6fa8';
  const style = `<style>.a{fill:${a}}.b{fill:${b}}.c{fill:#0b1330}.w{fill:#fff}.f{fill:#ffcf5e}.r{fill:#ff4d7a}.a,.b,.c,.w,.f,.r{stroke:#040816;stroke-width:2.5;stroke-linejoin:round;paint-order:stroke}.s,.t,.k{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:4}.s{stroke:${a}}.t{stroke:${b}}.k{stroke:#fff;stroke-width:2.5}.g{opacity:.3}</style>`;
  const svg = src.replace(/<svg([^>]*)>/, `<svg$1 xmlns="http://www.w3.org/2000/svg" width="64" height="64">${style}`).replace(/style="[^"]*"/, '');
  const img = new Image(); img.onload = () => { ctx.drawImage(img, x, y, s, s); done?.(); }; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function text(ctx, str, x, y, font, color, align = 'center') { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(str, x, y); }

export class DeckRoom {
  constructor() {
    const THREE = T(); this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(72, 1, 0.1, 2200); this.cam.rotation.order = 'YXZ';
    this.pos = new THREE.Vector3(0, 0, 3.2); this.yaw = 0; this.pitch = 0.02; this.target = null; this.keys = {}; this.t = 0; this.sig = ''; this.exhibits = []; this.ray = new THREE.Raycaster();
    this.shell(); this.outside();
    this.station = new Station(this.scene); this.station.group.visible = true; this.station.group.position.set(TABLE.x, 1.55, TABLE.z); this.station.group.scale.setScalar(0.042);
  }
  // ---------------------------------------------------------------- the room
  shell() {
    const THREE = T(), S = this.scene;
    this.hemi = new THREE.HemisphereLight(0xcfe0ff, 0x1a1830, 0.55); S.add(this.hemi); S.add(new THREE.AmbientLight(0x405070, 0.35)); this.lamps = [];
    const sun = new THREE.DirectionalLight(0xfff2dd, 0.7); sun.position.set(-3, 4, -10); S.add(sun);
    for (const z of [-5.8, -2.4, 1]) { const l = new THREE.PointLight(0xffe6c4, 0.55, 9, 1.6); l.position.set(0, H - 0.3, z); S.add(l); this.lamps.push(l); }
    const floorC = canvas(256, 256), f = floorC.getContext('2d');
    f.fillStyle = '#1b2233'; f.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 200; i++) { f.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`; f.fillRect(Math.random() * 256, Math.random() * 256, 20, 20); }
    f.strokeStyle = '#0c111c'; f.lineWidth = 4; for (let i = 0; i <= 256; i += 128) { f.beginPath(); f.moveTo(i, 0); f.lineTo(i, 256); f.stroke(); f.beginPath(); f.moveTo(0, i); f.lineTo(256, i); f.stroke(); }
    f.fillStyle = '#3a455c'; for (const [x, y] of [[10, 10], [118, 10], [10, 118], [118, 118]]) for (const [dx, dy] of [[0, 0], [128, 0], [0, 128], [128, 128]]) f.fillRect(x + dx - 2, y + dy - 2, 4, 4);
    const wallC = canvas(256, 256), w = wallC.getContext('2d');
    w.fillStyle = '#2a3348'; w.fillRect(0, 0, 256, 256); w.strokeStyle = '#1a2031'; w.lineWidth = 3;
    for (let x = 0; x <= 256; x += 64) { w.beginPath(); w.moveTo(x, 0); w.lineTo(x, 256); w.stroke(); } w.beginPath(); w.moveTo(0, 170); w.lineTo(256, 170); w.stroke();
    w.fillStyle = 'rgba(94,230,255,.18)'; for (let x = 30; x < 256; x += 64) w.fillRect(x, 176, 4, 12);
    const ceilC = canvas(256, 256), c = ceilC.getContext('2d'); c.fillStyle = '#20283a'; c.fillRect(0, 0, 256, 256); c.strokeStyle = '#141a28'; c.lineWidth = 3; for (let i = 0; i <= 256; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke(); }
    const Ph = (o) => new THREE.MeshPhongMaterial(o);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, BACK - FRONT), Ph({ map: tex(floorC, [5, 6]), specular: 0x33415c, shininess: 40 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (FRONT + BACK) / 2); S.add(floor); this.floor = floor;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, BACK - FRONT), Ph({ map: tex(ceilC, [5, 6]), shininess: 5 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, (FRONT + BACK) / 2); S.add(ceil);
    const wallMat = Ph({ map: tex(wallC, [6, 1.4]), specular: 0x222a3a, shininess: 18 });
    const wall = (w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat); m.position.set(x, y, z); m.rotation.y = ry; S.add(m); return m; };
    wall(BACK - FRONT, H, -W, H / 2, (FRONT + BACK) / 2, Math.PI / 2); wall(BACK - FRONT, H, W, H / 2, (FRONT + BACK) / 2, -Math.PI / 2); wall(2 * W, H, 0, H / 2, BACK, Math.PI);
    // the window wall: an opening from x -4.3..4.3, y 0.45..3.05, framed, with two struts and faint glass
    const frame = Ph({ color: 0x3a4560, specular: 0x556680, shininess: 50 }), box = (w, h, d, x, y, z, m = frame) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); S.add(b); return b; };
    // (a centimetre short of the walls, floor and ceiling so no two faces share a plane and flicker)
    box(2 * W - 0.02, 0.44, 0.3, 0, 0.23, FRONT); box(2 * W - 0.02, H - 3.06, 0.3, 0, (3.05 + H) / 2, FRONT); for (const s of [-1, 1]) { box(W - 4.31, H - 0.02, 0.3, s * (4.3 + (W - 4.3) / 2), H / 2, FRONT); box(0.16, 2.6, 0.24, s * 1.45, 1.75, FRONT); }
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 2.6), Ph({ color: 0x9fd8ff, transparent: true, opacity: 0.06, specular: 0xffffff, shininess: 120, depthWrite: false })); glass.position.set(0, 1.75, FRONT + 0.02); S.add(glass);
    // glowing strips along the floor edges and round the window
    const strip = new THREE.MeshBasicMaterial({ color: 0x5ee6ff });
    for (const s of [-1, 1]) box(0.05, 0.04, BACK - FRONT, s * (W - 0.03), 0.06, (FRONT + BACK) / 2, strip);
    box(8.6, 0.04, 0.05, 0, 0.47, FRONT + 0.17, strip); box(8.6, 0.04, 0.05, 0, 3.03, FRONT + 0.17, strip);
    // ceiling light panels
    const lightMat = (this.lightMat = new THREE.MeshBasicMaterial({ color: 0xfff1d8 }));
    for (const z of [-5.8, -2.4, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), lightMat); p.rotation.x = Math.PI / 2; p.position.set(0, H - 0.025, z); S.add(p); }
    // the holo-table
    const tbl = new THREE.Group(); tbl.position.set(TABLE.x, 0, TABLE.z); S.add(tbl);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 0.85, 24), Ph({ color: 0x2c3650, specular: 0x4a5a78, shininess: 40 })); base.position.y = 0.42; tbl.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.08, 36), Ph({ color: 0x141b2c, specular: 0x7fd8ff, shininess: 90 })); top.position.y = 0.88; tbl.add(top);
    const gridC = canvas(256, 256), gc = gridC.getContext('2d'); gc.strokeStyle = 'rgba(94,230,255,.45)'; gc.lineWidth = 1.5;
    for (let i = 16; i < 256; i += 24) { gc.beginPath(); gc.moveTo(i, 0); gc.lineTo(i, 256); gc.stroke(); gc.beginPath(); gc.moveTo(0, i); gc.lineTo(256, i); gc.stroke(); }
    for (const r of [40, 80, 118]) { gc.beginPath(); gc.arc(128, 128, r, 0, Math.PI * 2); gc.lineWidth = 2.5; gc.strokeStyle = 'rgba(94,230,255,.6)'; gc.stroke(); }
    this.holoGrid = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ map: tex(gridC), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })); this.holoGrid.rotation.x = -Math.PI / 2; this.holoGrid.position.y = 0.925; tbl.add(this.holoGrid);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.35, 1.2, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x5ee6ff, transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 1.5; tbl.add(beam);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.025, 8, 48), strip); rim.rotation.x = Math.PI / 2; rim.position.y = 0.93; tbl.add(rim);
    this.tag(tbl, 'station');
    // the way out, on the back wall
    const doorG = new THREE.Group(); doorG.position.set(3.4, 0, BACK); S.add(doorG);
    const dpart = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); doorG.add(b); return b; };
    const panelMat = Ph({ color: 0x3d4964, specular: 0x6a7c9e, shininess: 45 }), trimMat = Ph({ color: 0x232b3e, shininess: 20 });
    for (const s of [-1, 1]) { dpart(0.64, 2.3, 0.08, s * 0.33, 1.15, -0.05, panelMat); dpart(0.08, 1.5, 0.02, s * 0.2, 1.2, -0.1, trimMat); }
    dpart(1.6, 0.16, 0.2, 0, 2.38, -0.08, frame); for (const s of [-1, 1]) dpart(0.16, 2.46, 0.2, s * 0.74, 1.23, -0.08, frame);
    dpart(0.02, 2.3, 0.03, 0, 1.15, -0.1, strip); this.doorLight = dpart(0.12, 0.12, 0.03, 0.55, 1.25, -0.2, new THREE.MeshBasicMaterial({ color: 0x6dffc8 }));
    const exitC = canvas(256, 64), ec = exitC.getContext('2d'); ec.fillStyle = '#081222'; ec.fillRect(0, 0, 256, 64); ec.strokeStyle = '#5ee6ff'; ec.lineWidth = 3; ec.strokeRect(2, 2, 252, 60); text(ec, 'HANGAR  ›', 128, 33, '800 30px sans-serif', '#9ff0ff');
    const exit = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.25), new THREE.MeshBasicMaterial({ map: tex(exitC) })); exit.position.set(0, 2.66, -0.12); exit.rotation.y = Math.PI; doorG.add(exit);
    this.hitBox(doorG, 1.6, 2.8, 0.4, 0, 1.4, -0.2); this.tag(doorG, 'exit');
    // structure: ribs down the side walls, beams across the ceiling, and a cove light along the top of the walls
    const rib = Ph({ color: 0x323c55, specular: 0x4a5a78, shininess: 30 }), cove = new THREE.MeshBasicMaterial({ color: 0x5ee6ff, transparent: true, opacity: 0.7 });
    for (const z of [-6.9, -0.9, 0.5]) { for (const s of [-1, 1]) box(0.14, H, 0.22, s * (W - 0.07), H / 2, z, rib); /* clear of the medal wall and the lounge screen */ box(2 * W, 0.16, 0.22, 0, H - 0.08, z, rib); }
    for (const s of [-1, 1]) box(0.03, 0.03, BACK - FRONT, s * (W - 0.05), H - 0.2, (FRONT + BACK) / 2, cove); box(2 * W, 0.03, 0.03, 0, H - 0.2, BACK - 0.05, cove);
    // a lounge in the back-left corner: a couch, a plant, and a wall screen with the station roadmap
    const lounge = new THREE.Group(); lounge.position.set(-W, 0, 2.2); S.add(lounge);
    const cushion = Ph({ color: 0x2c4a7a, specular: 0x222222, shininess: 8 }), leg = Ph({ color: 0x1a2030 });
    const lp = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); lounge.add(b); return b; };
    lp(0.8, 0.28, 2.2, 0.55, 0.3, 0, cushion); lp(0.22, 0.62, 2.2, 0.22, 0.6, 0, cushion); for (const s of [-1, 1]) lp(0.8, 0.5, 0.18, 0.55, 0.4, s * 1.09, cushion); lp(0.7, 0.14, 2.1, 0.55, 0.09, 0, leg);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 16), Ph({ color: 0xd9dee8, shininess: 40 })); pot.position.set(0.35, 0.2, 1.55); lounge.add(pot);
    const leafMat = Ph({ color: 0x3f9a56, specular: 0x224422, shininess: 10, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) { const lf = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.7, 5), leafMat), a = (i / 9) * Math.PI * 2; lf.position.set(0.35 + Math.cos(a) * 0.1, 0.72, 1.55 + Math.sin(a) * 0.1); lf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); lounge.add(lf); }
    this.roadmapScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.05), new THREE.MeshBasicMaterial({ color: 0xffffff })); this.roadmapScreen.position.set(0.07, 1.85, 0); this.roadmapScreen.rotation.y = Math.PI / 2; lounge.add(this.roadmapScreen);
    lp(0.03, 1.13, 1.98, 0.02, 1.85, 0, frame); this.tag(this.roadmapScreen, 'station');
    // where a tap on the floor is taking you
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 32), new THREE.MeshBasicMaterial({ color: 0x5ee6ff, transparent: true, opacity: 0 })); this.marker.rotation.x = -Math.PI / 2; this.marker.position.y = 0.02; S.add(this.marker);
  }
  /** Earth below the window, the stars and the sun. */
  outside() {
    const THREE = T(), S = this.scene;
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(600, 96, 64), earthMaterial()); this.earth.position.set(0, -572, -760); /* its horizon sits a little above eye level through the window */ this.earth.rotation.x = 1.15; S.add(this.earth);
    // a thin blue atmosphere round the limb
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(622, 64, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN, vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN, vV; void main(){ float k = pow(1. - abs(dot(vN, vV)), 3.5); gl_FragColor = vec4(vec3(.3, .6, 1.) * k * 1.4, k); }' }));
    atmo.position.copy(this.earth.position); S.add(atmo);
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); pos.set([Math.cos(a) * r * 1800, Math.abs(u) * 1800 - 150, -Math.abs(Math.sin(a) * r) * 1800 - 250], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    S.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false })));
    const sunC = canvas(128, 128), s = sunC.getContext('2d'), gr = s.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.15, 'rgba(255,240,200,.9)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); s.fillStyle = gr; s.fillRect(0, 0, 128, 128);
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshBasicMaterial({ map: tex(sunC), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.sun.position.set(-900, 700, -1800); this.sun.lookAt(0, EYE, 0); S.add(this.sun);
    // Sunlight comes from above and to the left, over your shoulder, so the Earth you look down on is the lit side.
    this.sunDir = new THREE.Vector3(-0.6, 0.55, 0.5).normalize();
  }
  /** An invisible box that makes a whole exhibit easy to tap (gaps and all). */
  hitBox(parent, w, h, d, x, y, z) { const THREE = T(), m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); m.position.set(x, y, z); parent.add(m); return m; }
  tag(obj, kind) { obj.traverse((o) => { o.userData.exhibit = kind; }); this.exhibits.push(obj); }
  untag(group) { this.exhibits = this.exhibits.filter((o) => o !== group); }
  // ---------------------------------------------------------------- what is on display (rebuilt when it changes)
  sync(state) {
    const earned = [...ACHIEVEMENTS, ...FEATS].filter((a) => state.medals[a.id]).length, banners = BANNERS.filter((b) => b.shape && state.banners[b.id]).map((b) => b.id);
    const ships = SHIPS.map((s) => (state.unlocked.ships[s.id] ? 1 : 0)).join(''), rank = state.prestige?.level || 0;
    const sig = [earned, banners.join(), ships, state.ship, state.paint, rank, state.pilot.name, state.pilot.rank, state.stats.bestWave, state.stats.bestScore, state.stationName].join('|');
    this.station.sync(state);
    if (sig === this.sig) return; this.sig = sig;
    if (this.show) { this.scene.remove(this.show); this.untag(this.show); } const THREE = T(); this.show = new THREE.Group(); this.scene.add(this.show);
    this.medalWall(state); this.shipBay(state); this.bannerHall(state, banners); this.recordsScreen(state); this.trophyShelf(rank); this.nameSign(state, rank); this.roadmap(rank);
  }
  medalWall(state) {
    const THREE = T(), g = new THREE.Group(); g.position.set(-W + 0.06, 0, 0); g.rotation.y = Math.PI / 2; this.show.add(g); // on the left wall, facing into the room
    const list = [...ACHIEVEMENTS.map((a) => ({ a, tier: state.medals[a.id] || 0, feat: false })), ...FEATS.map((a) => ({ a, tier: state.medals[a.id] ? 1 : 0, feat: true }))].sort((x, y) => y.tier - x.tier);
    const cols = 6, rows = 4, back = new THREE.MeshPhongMaterial({ color: 0x4a3420, specular: 0x8a6a3a, shininess: 30 }), bare = new THREE.MeshPhongMaterial({ color: 0x232a3a, shininess: 10 });
    for (let i = 0; i < cols * rows && i < list.length; i++) {
      const { a, tier, feat } = list[i], cx = (i % cols - (cols - 1) / 2) * 0.78, cy = 2.55 - Math.floor(i / cols) * 0.62;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.54, 0.04), tier ? back : bare); plate.position.set(cx + 3.8, cy, 0.02); g.add(plate); // z of the wall maps to x here; +3.8 centres it at z -3.8
      const c = canvas(128, 128), x = c.getContext('2d'), t = tex(c);
      x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.fillStyle = tier ? '#0c1330' : '#141a2a'; x.fill(); x.lineWidth = 8; x.strokeStyle = tier ? (feat ? FEAT_COL : TIER_COL[tier - 1]) : '#2a3244'; x.stroke();
      if (tier) drawArt(a.art, x, 30, 34, 68, () => { t.needsUpdate = true; });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.22, 32), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: tier ? 1 : 0.5 })); disc.position.set(cx + 3.8, cy, 0.06); g.add(disc);
    }
    const sign = this.label('MEDALS', 3.2, 0.3, '#ffd99a'); sign.position.set(3.8, 3.05, 0.03); g.add(sign); this.hitBox(g, 4.8, 2.6, 0.2, 3.8, 1.65, 0.1);
    this.tag(g, 'medals');
  }
  shipBay(state) {
    const THREE = T(), paint = PAINT_BY_ID[state.paint], Ph = (o) => new THREE.MeshPhongMaterial(o);
    SHIPS.forEach((ship, i) => {
      const z = PEDESTAL_Z[i]; if (z == null) return; const owned = !!state.unlocked.ships[ship.id], g = new THREE.Group(); g.position.set(PEDESTAL_X, 0, z); this.show.add(g);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.8, 24), Ph({ color: 0x2c3650, specular: 0x4a5a78, shininess: 40 })); ped.position.y = 0.4; g.add(ped);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.02, 8, 36), new THREE.MeshBasicMaterial({ color: owned ? ship.trim : 0x3a4560 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.81; g.add(ring);
      const parts = playerParts(ship.id), model = new THREE.Group(), active = ship.id === state.ship && paint && paint.id !== 'factory';
      const trim = active ? paint.trim ?? ship.trim : ship.trim;
      const M = owned ? { hull: Ph({ color: active ? paint.hull ?? 0x718996 : 0x718996, emissive: 0x0c1420, shininess: 30 }), deck: Ph({ color: 0xe2eced, emissive: 0x141a22, shininess: 40 }), dark: Ph({ color: 0x152735 }), glass: Ph({ color: 0x125875, emissive: 0x073345, shininess: 110, specular: 0xb8f5ff }),
        trim: Ph({ color: trim, emissive: new THREE.Color(trim).multiplyScalar(0.4) }), gun: Ph({ color: 0x667782 }), gold: Ph({ color: 0xffb94e, emissive: 0x583000 }) } : null;
      const use = { hull: 'hull', deck: 'deck', cockpit: 'glass', chassis: 'dark', markings: 'gold', lights: 'trim', wings: 'deck', pods: 'gun', pods2: 'gun', armour: 'deck', fins: 'hull', crown: 'gold', engine: 'trim' };
      const ghost = new THREE.LineBasicMaterial({ color: 0x5ee6ff, transparent: true, opacity: 0.35 });
      for (const k of ['hull', 'deck', 'cockpit', 'chassis', 'markings', 'lights', 'engine', 'wings', 'fins', 'pods']) { if (!parts[k]) continue; model.add(owned ? new THREE.Mesh(parts[k], M[use[k]]) : new THREE.LineSegments(new THREE.EdgesGeometry(parts[k], 30), ghost)); }
      model.rotation.x = -Math.PI / 2 + 0.28; const pivot = new THREE.Group(); pivot.add(model); pivot.scale.setScalar(0.34); pivot.position.y = 1.4;
      const beamUp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.9, 24, 1, true), new THREE.MeshBasicMaterial({ color: owned ? ship.trim : 0x5ee6ff, transparent: true, opacity: owned ? 0.07 : 0.04, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beamUp.position.y = 1.26; g.add(beamUp); pivot.userData.spin = i * 1.3; g.add(pivot); (this.spins ||= []).push(pivot);
      const lbl = this.label(owned ? ship.name.toUpperCase() : '?', 0.9, 0.2, owned ? '#e8f1ff' : '#5a6580'); lbl.position.set(-0.5, 0.5, 0); lbl.rotation.y = -Math.PI / 2; g.add(lbl); this.hitBox(g, 1.1, 1.9, 1.3, 0, 0.95, 0);
      this.tag(g, 'ships');
    });
    this.spins = (this.spins || []).filter((p) => p.parent);
  }
  bannerHall(state, ids) {
    const THREE = T(), list = ids.slice(0, 8).map((id) => BANNERS.find((b) => b.id === id)); this.flags = [];
    if (!list.length) return; const g = new THREE.Group(); this.show.add(g);
    // they hang from a rail along the right wall, over the ships, facing into the room
    const span = list.length * 0.9 + 0.4, rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, span, 8), new THREE.MeshPhongMaterial({ color: 0x8a96b0 })); rod.rotation.x = Math.PI / 2; rod.position.set(W - 0.35, H - 0.25, -3.1); g.add(rod);
    list.forEach((b, i) => {
      const c = canvas(64, 192); paintBanner(c.getContext('2d'), b, 64, 192, b.live ? state.stats[b.live] || 0 : 0);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 1.02), new THREE.MeshLambertMaterial({ map: tex(c), transparent: true, side: THREE.DoubleSide, emissive: 0x222222 }));
      flag.geometry.translate(0, -0.51, 0); flag.position.set(W - 0.38, H - 0.27, -3.1 + (i - (list.length - 1) / 2) * 0.9); flag.userData.ry = -Math.PI / 2; g.add(flag); this.flags.push(flag);
    });
    this.tag(g, 'banners');
  }
  recordsScreen(state) {
    const THREE = T(), s = state.stats, c = canvas(512, 280), x = c.getContext('2d');
    x.fillStyle = '#050a18'; x.fillRect(0, 0, 512, 280); x.strokeStyle = '#5ee6ff'; x.lineWidth = 3; x.strokeRect(6, 6, 500, 268);
    text(x, 'RECORDS', 256, 34, '800 26px sans-serif', '#9ff0ff');
    const deep = Math.max(0, (s.bestWave || 0) - 60), cs = Object.values(state.counter.stars || {}).reduce((a, b) => a + b, 0);
    const rows = [['Furthest wave', s.bestWave || '—'], ['High score', s.bestScore ? Math.round(s.bestScore).toLocaleString() : '—'], ['Deep Void', deep ? `+${deep} waves` : '—'], ['Counterattack', cs + ' ★'], ['Sorties', s.sorties || 0], ['Invaders', (s.kills || 0).toLocaleString()]];
    rows.forEach(([k, v], i) => { const y = 78 + Math.floor(i / 2) * 64, col = i % 2 ? 272 : 26; text(x, k.toUpperCase(), col, y, '700 15px sans-serif', '#7f8bb0', 'left'); text(x, String(v), col, y + 26, '800 26px sans-serif', '#e8fbff', 'left'); });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.75), new THREE.MeshBasicMaterial({ map: tex(c) })); scr.position.set(-1.2, 1.75, BACK - 0.085); scr.rotation.y = Math.PI; this.show.add(scr);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(3.36, 1.91, 0.06), new THREE.MeshPhongMaterial({ color: 0x1a2030, shininess: 40 })); bezel.position.set(-1.2, 1.75, BACK - 0.04); this.show.add(bezel);
    this.tag(scr, 'records');
  }
  trophyShelf(rank) {
    // a low display cabinet standing on the floor against the window sill, the cups along its top
    const THREE = T(), g = new THREE.Group(); g.position.set(0, 0, FRONT + 0.41); this.show.add(g);
    const body = new THREE.MeshPhongMaterial({ color: 0x2a3348, specular: 0x4a5a78, shininess: 30 }), top = new THREE.MeshPhongMaterial({ color: 0x3a4560, specular: 0x7a8aa8, shininess: 60 });
    const cab = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.68, 0.5), body); cab.position.y = 0.34; g.add(cab);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(6.52, 0.06, 0.56), top); slab.position.y = 0.71; g.add(slab);
    const kick = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.08, 0.46), new THREE.MeshPhongMaterial({ color: 0x151b2a })); kick.position.set(0, 0.04, 0.03); g.add(kick);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.025, 0.02), new THREE.MeshBasicMaterial({ color: 0xffc857 })); trim.position.set(0, 0.6, 0.26); g.add(trim);
    for (let i = -2; i <= 2; i++) { const seam = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.5, 0.02), new THREE.MeshPhongMaterial({ color: 0x1a2030 })); seam.position.set(i * 1.28, 0.3, 0.26); g.add(seam); }
    this.hitBox(g, 6.6, 1.3, 0.7, 0, 0.65, 0);
    const gold = new THREE.MeshPhongMaterial({ color: 0xffc857, emissive: 0x3a2600, specular: 0xfff0c0, shininess: 90, side: THREE.DoubleSide });
    const ghost = new THREE.LineBasicMaterial({ color: 0x5ee6ff, transparent: true, opacity: 0.25 });
    // a cup in profile, turned: foot, stem, and a bowl closed at the bottom
    const prof = [[0, 0], [0.12, 0], [0.12, 0.03], [0.05, 0.05], [0.025, 0.08], [0.025, 0.17], [0.05, 0.2], [0.11, 0.26], [0.135, 0.36], [0.14, 0.42], [0.125, 0.42], [0.12, 0.37], [0.1, 0.28], [0, 0.25]].map(([x, y]) => new THREE.Vector2(x, y));
    const cupGeo = new THREE.LatheGeometry(prof, 24), handleGeo = new THREE.TorusGeometry(0.06, 0.012, 6, 16, Math.PI);
    for (let i = 0; i < 10; i++) {
      const x = (i - 4.5) * 0.62, won = i < rank, cup = new THREE.Group(); cup.position.set(x, 0.74, 0); g.add(cup);
      if (won) { cup.add(new THREE.Mesh(cupGeo, gold)); for (const s of [-1, 1]) { const hd = new THREE.Mesh(handleGeo, gold); hd.position.set(s * 0.13, 0.33, 0); hd.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; cup.add(hd); } }
      else cup.add(new THREE.LineSegments(new THREE.EdgesGeometry(cupGeo, 40), ghost));
      const l = this.label(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][i], 0.36, 0.13, won ? '#ffd99a' : '#3e4a66'); l.position.set(0, -0.3, 0.262); cup.add(l); // on the cabinet front
    }
    this.tag(g, 'trophies');
  }
  /** The lounge screen: what each Overhaul rank adds to the station, ticked off as they are reached. */
  roadmap(rank) {
    const c = canvas(512, 284), x = c.getContext('2d');
    x.fillStyle = '#050a18'; x.fillRect(0, 0, 512, 284); x.strokeStyle = 'rgba(94,230,255,.5)'; x.lineWidth = 2; x.strokeRect(4, 4, 504, 276);
    text(x, 'STATION ROADMAP', 256, 28, '800 22px sans-serif', '#9ff0ff');
    STATION_CORE.filter((cr) => cr.at >= 1).forEach((cr, i) => { const col = i < 5 ? 0 : 1, row = i % 5, px = 28 + col * 244, py = 70 + row * 42, done = cr.at <= rank, next = cr.at === rank + 1;
      text(x, done ? '✓' : String(cr.at), px + 10, py, '800 18px sans-serif', done ? '#6dffc8' : next ? '#ffc857' : '#4a5670'); text(x, cr.name, px + 34, py, `${next ? 800 : 600} 18px sans-serif`, done ? '#e8fbff' : next ? '#ffd99a' : '#6a7690', 'left'); });
    const m = this.roadmapScreen.material; m.map?.dispose?.(); m.map = tex(c); m.needsUpdate = true;
  }
  nameSign(state, rank) {
    const THREE = T(), c = canvas(768, 96), x = c.getContext('2d'), p = state.pilot;
    text(x, state.stationName ? `${state.stationName.toUpperCase()} · COMMAND DECK` : `${(p.name || rankTitle(p.rank)).toUpperCase()}'S COMMAND DECK`, 384, 40, '800 40px sans-serif', '#e8fbff'); text(x, `${(p.name || rankTitle(p.rank)).toUpperCase()} · ${rankTitle(p.rank).toUpperCase()} · OVERHAUL RANK ${rank}`, 384, 80, '700 20px sans-serif', '#5ee6ff');
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true })); m.position.set(0, 3.225, FRONT + 0.17); this.show.add(m); /* fits the band between the window's top strip and the ceiling */
  }
  label(str, w, h, color) {
    const THREE = T(), c = canvas(512, Math.max(32, Math.round(512 * h / w))); text(c.getContext('2d'), str, 256, c.height / 2, `800 ${Math.round(c.height * 0.62)}px sans-serif`, color);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true }));
  }
  // ---------------------------------------------------------------- moving and looking
  look(dx, dy) { this.yaw -= dx * 0.0055; this.pitch = Math.max(-0.9, Math.min(0.75, this.pitch - dy * 0.0045)); }
  /** A tap at normalised device coords: an exhibit's id, or a walk to a spot on the floor. */
  pick(nx, ny) {
    this.ray.setFromCamera({ x: nx, y: ny }, this.cam);
    const hit = this.ray.intersectObjects([...this.exhibits, this.station.group], true)[0], floor = this.ray.intersectObject(this.floor)[0];
    if (hit && !hit.object.userData.exhibit) hit.object.userData.exhibit = 'station'; // the hologram's parts are rebuilt as the station grows
    if (hit && (!floor || hit.distance <= floor.distance + 0.01)) return { exhibit: hit.object.userData.exhibit };
    if (floor) { this.target = this.clamp(floor.point.x, floor.point.z); this.marker.position.x = this.target.x; this.marker.position.z = this.target.z; this.marker.material.opacity = 1; return { walk: true }; }
    return null;
  }
  clamp(x, z) {
    x = Math.max(-W + 0.6, Math.min(W - 0.6, x)); z = Math.max(FRONT + 1.1, Math.min(BACK - 0.6, z));
    const push = (cx, cz, r) => { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz); if (d < r) { const k = d > 1e-3 ? r / d : 1; x = cx + (d > 1e-3 ? dx : r) * (d > 1e-3 ? k : 1); z = cz + (d > 1e-3 ? dz * k : 0); } };
    push(TABLE.x, TABLE.z, TABLE.r); for (const pz of PEDESTAL_Z) push(PEDESTAL_X, pz, 0.85);
    if (x < -3.85 && z > 0.95 && z < 3.45) x = -3.85; // the couch
    return { x, z };
  }
  resize(w, h) { this.cam.aspect = w / Math.max(1, h); this.cam.updateProjectionMatrix(); }
  update(dt) {
    const THREE = T(); this.t += dt; const night = nightAmount();
    // keys walk relative to where you are looking; a tap target walks you there
    const k = this.keys, fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), mv = (k.f ? 1 : 0) - (k.b ? 1 : 0), st = (k.r ? 1 : 0) - (k.l ? 1 : 0);
    if (mv || st) { this.target = null; const n = this.clamp(this.pos.x + (fx * mv - fz * st) * SPEED * dt, this.pos.z + (fz * mv + fx * st) * SPEED * dt); this.pos.x = n.x; this.pos.z = n.z; }
    else if (this.target) { const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, d = Math.hypot(dx, dz), step = Math.min(d, SPEED * dt * Math.min(1, d + 0.4));
      if (d < 0.03) this.target = null; else { const n = this.clamp(this.pos.x + dx / d * step, this.pos.z + dz / d * step); if (Math.hypot(n.x - this.pos.x, n.z - this.pos.z) < step * 0.2) this.target = null; this.pos.x = n.x; this.pos.z = n.z; } }
    if (this.marker.material.opacity > 0) this.marker.material.opacity = Math.max(0, this.marker.material.opacity - dt * (this.target ? 0.4 : 2.5));
    const bob = this.target || mv || st ? Math.sin(this.t * 9) * 0.02 : 0;
    this.cam.position.set(this.pos.x, EYE + bob, this.pos.z); this.cam.rotation.set(this.pitch, this.yaw, 0);
    this.cam.updateMatrixWorld();
    // outside: Earth turns slowly, lit from the sun (its shader wants the light in view space)
    const u = this.earth.material.uniforms; u.time.value = this.t + 400; u.night.value = night; u.sun.value.copy(this.sunDir).transformDirection(this.cam.matrixWorldInverse); this.earth.rotation.y = this.t * 0.002;
    this.sun.visible = false; // the sun itself is behind you
    // evening in the room: the lights dim a little and warm up when it is night outside
    for (const l of this.lamps) { l.intensity = 0.55 - night * 0.18; l.color.setRGB(1, 0.9 - night * 0.08, 0.77 - night * 0.15); } this.hemi.intensity = 0.55 - night * 0.2; this.lightMat.color.setRGB(1, 0.94 - night * 0.1, 0.85 - night * 0.2);
    this.holoGrid.rotation.z = this.t * 0.15; this.doorLight.material.color.setRGB(0.43, 1, 0.78).multiplyScalar(0.6 + 0.4 * Math.sin(this.t * 2.5));
    // the hologram, the ships, the banners
    this.station.animate(dt, night); this.station.body.rotation.set(0.25, this.t * 0.3, 0);
    for (const p of this.spins || []) { p.rotation.y = this.t * 0.5 + p.userData.spin; p.position.y = 1.35 + Math.sin(this.t * 1.4 + p.userData.spin) * 0.05; }
    for (const [i, f] of (this.flags || []).entries()) { f.rotation.z = Math.sin(this.t * 0.9 + i) * 0.04; f.rotation.y = (f.userData.ry || 0) + Math.sin(this.t * 0.6 + i * 1.7) * 0.12; }
  }
  render(gl, dt) { this.update(dt); gl.setClearColor(0x000000, 1); gl.render(this.scene, this.cam); }
}
