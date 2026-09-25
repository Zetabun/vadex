// The Command Deck: the pilot's room aboard the station, a small 3D space to walk around (rendering/room.js). A big
// window looks down on Earth (the same planet and day/night clock as the hangar); the pilot's medals line the left wall,
// their ships stand on pedestals to the right, banners hang from the ceiling, the records screen and the way out are
// behind, Overhaul trophies sit on a shelf under the window, and a hologram of the station turns on the table in the
// middle. A door on the right leads to Defence Control once the invaders have struck back.
import { Room, canvas, tex, drawArt, text, EYE } from '@last-orbit/rendering/room.js';
import { Station } from '@last-orbit/rendering/station.js';
import { earthMaterial, nightAmount } from '@last-orbit/rendering/background.js';
import { playerParts } from '@last-orbit/rendering/geometry.js';
import { paintBanner } from '@last-orbit/rendering/bannerArt.js';
import { ACHIEVEMENTS, FEATS } from '@last-orbit/data/achievements.js';
import { BANNERS } from '@last-orbit/data/banners.js';
import { SHIPS } from '@last-orbit/data/ships.js';
import { PAINT_BY_ID, rankTitle } from '@last-orbit/data/career.js';
import { STATION_CORE } from '@last-orbit/data/station.js';
import { siegeUnlocked } from '@last-orbit/data/siege.js';
import { ReplayScreen, replayTitle, replayEnding } from '@last-orbit/rendering/replay.js';
import { lastReplay, loadReplay } from '@last-orbit/progression/recorder.js';
import { SHIP_BY_ID } from '@last-orbit/data/ships.js';
const T = () => window.THREE;

// Room: x -5..5, z -8 (window) .. 4 (back wall), height 3.4. The pilot's eyes are at 1.6.
const W = 5, FRONT = -8, BACK = 4, H = 3.4;
const TABLE = { x: 0, z: -3, r: 1.3 }, PEDESTAL_X = 4.1, PEDESTAL_Z = [-6.3, -4.7, -3.1, -1.5, 0.1];
const TIER_COL = ['#d08a4e', '#cfd8e8', '#ffc857'], FEAT_COL = '#b69cff';
/** Where Defence Control's door stands, on the right wall behind the ships. */
const CONTROL_DOOR_Z = 2.3;

export class DeckRoom extends Room {
  constructor() {
    super({ w: W, front: FRONT, back: BACK, h: H, start: [0, 3.2, 0] });
    this.shell({ floor: '#1b2233', wall: '#2a3348', window: { hw: 4.3, y0: 0.45, y1: 3.05, struts: [-1.45, 1.45] }, lamps: [-5.8, -2.4, 1], ribs: [-6.9, -0.9, 0.5] /* clear of the medal wall and the lounge screen */ });
    this.furnish(); this.outside();
    this.solids.push({ ...TABLE }, ...PEDESTAL_Z.map((z) => ({ x: PEDESTAL_X, z, r: 0.85 }))); this.blocks.push({ x0: -W, x1: -3.85, z0: 0.95, z1: 3.45 }); /* the couch */
    this.station = new Station(this.scene); this.station.group.visible = true; this.station.group.position.set(TABLE.x, 1.55, TABLE.z); this.station.group.scale.setScalar(0.042);
  }
  pickExtra() { return [{ obj: this.station.group, kind: 'station' }]; }
  // ---------------------------------------------------------------- the room
  furnish() {
    const THREE = T(), S = this.scene, Ph = (o) => new THREE.MeshPhongMaterial(o), strip = this.stripMat, frame = this.frameMat;
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
    this.exitDoor = this.door(S, 3.4, BACK, 0, 'HANGAR  ›', 'exit');
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
  // ---------------------------------------------------------------- what is on display (rebuilt when it changes)
  sync(state) {
    const earned = [...ACHIEVEMENTS, ...FEATS].filter((a) => state.medals[a.id]).length, banners = BANNERS.filter((b) => b.shape && state.banners[b.id]).map((b) => b.id);
    const ships = SHIPS.map((s) => (state.unlocked.ships[s.id] ? 1 : 0)).join(''), rank = state.prestige?.level || 0;
    const sig = [earned, banners.join(), ships, state.ship, state.paint, rank, state.pilot.name, state.pilot.rank, state.stats.bestWave, state.stats.bestScore, state.stationName, siegeUnlocked(state), lastReplay()?.stamp || 0].join('|');
    if (!this.askedReplay) { this.askedReplay = true; loadReplay(); } /* the stored replay, if any: the TV appears when it has loaded */
    this.station.sync(state);
    if (sig === this.sig) return; this.sig = sig;
    if (this.show) { this.scene.remove(this.show); this.untag(this.show); } const THREE = T(); this.show = new THREE.Group(); this.scene.add(this.show);
    this.medalWall(state); this.shipBay(state); this.bannerHall(state, banners); this.recordsScreen(state); this.trophyShelf(rank); this.nameSign(state, rank); this.roadmap(rank); this.controlDoor(siegeUnlocked(state));
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
    if (lastReplay()) { this.replayTv(state); return; } this.tv = null;
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
  /** The records screen as a replay TV: your last sortie playing in the middle, how it is going on the left, your
   *  records on the right. */
  replayTv(state) {
    const THREE = T(), g = new THREE.Group(); g.position.set(-1.2, 1.75, BACK - 0.085); g.rotation.y = Math.PI; this.show.add(g);
    const hud = canvas(1024, 560), face = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.75), new THREE.MeshBasicMaterial({ map: tex(hud) })); g.add(face);
    this.replay ||= new ReplayScreen();
    const field = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.62), new THREE.MeshBasicMaterial({ map: this.replay.texture })); field.position.z = 0.004; g.add(field);
    const scan = canvas(4, 256), sc = scan.getContext('2d'); for (let y = 0; y < 256; y += 4) { sc.fillStyle = 'rgba(0,0,0,.35)'; sc.fillRect(0, y, 4, 2); }
    const lines = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.62), new THREE.MeshBasicMaterial({ map: tex(scan, [1, 1]), transparent: true })); lines.position.z = 0.006; g.add(lines);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(3.36, 1.91, 0.06), new THREE.MeshPhongMaterial({ color: 0x1a2030, shininess: 40 })); bezel.position.set(-1.2, 1.75, BACK - 0.04); this.show.add(bezel);
    this.tag(g, 'replay'); this.tv = { hud, face, stats: state.stats, next: 0 };
  }
  /** The TV's side panels, redrawn a few times a second as the replay plays. */
  drawTv() {
    const tv = this.tv, st = this.replay.status(); if (!st) return; const rep = this.replay.rep, x = tv.hud.getContext('2d'), s = tv.stats;
    x.fillStyle = '#050a18'; x.fillRect(0, 0, 1024, 560); x.strokeStyle = '#5ee6ff'; x.lineWidth = 3; x.strokeRect(6, 6, 1012, 548);
    x.strokeStyle = 'rgba(94,230,255,.45)'; x.lineWidth = 2; x.strokeRect(338, 14, 348, 532);
    // left: the sortie as it plays
    if (Math.floor(this.t * 1.6) % 2 === 0) { x.fillStyle = '#ff4d6a'; x.beginPath(); x.arc(40, 44, 9, 0, Math.PI * 2); x.fill(); }
    const name = replayTitle(rep); text(x, 'REPLAY', 58, 45, '800 22px sans-serif', '#ff8a9a', 'left'); text(x, 'TAP TO WATCH', 320, 45, '700 15px sans-serif', '#5ee6ff', 'right');
    text(x, name.title, 34, 86, `800 ${name.title.length > 12 ? 24 : 30}px sans-serif`, '#e8fbff', 'left'); text(x, name.sub, 34, 118, '700 16px sans-serif', '#7f8bb0', 'left');
    text(x, 'WAVE', 34, 172, '700 16px sans-serif', '#7f8bb0', 'left'); text(x, String(st.wave), 34, 214, '800 54px sans-serif', '#9ff0ff', 'left');
    text(x, 'SCORE', 34, 268, '700 16px sans-serif', '#7f8bb0', 'left'); text(x, st.score.toLocaleString(), 34, 300, '800 32px sans-serif', '#e8fbff', 'left');
    text(x, 'HULL', 34, 350, '700 16px sans-serif', '#7f8bb0', 'left'); x.fillStyle = '#1a2440'; x.fillRect(34, 366, 270, 14); x.fillStyle = st.hull > 0.35 ? '#6dffc8' : '#ff5d6a'; x.fillRect(34, 366, 270 * Math.max(0, st.hull), 14);
    x.fillStyle = '#1a2440'; x.fillRect(34, 386, 270, 6); x.fillStyle = '#5ee6ff'; x.fillRect(34, 386, 270 * Math.max(0, Math.min(1, st.shield)), 6);
    if (st.done) { const end = replayEnding(rep); text(x, end.text.toUpperCase(), 34, 440, '800 26px sans-serif', end.lost ? '#ff8a9a' : '#6dffc8', 'left'); text(x, `AT WAVE ${st.wave}`, 34, 472, '700 18px sans-serif', '#9fb0d0', 'left'); }
    const mm = (v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
    x.fillStyle = '#1a2440'; x.fillRect(34, 512, 270, 6); x.fillStyle = '#ff8a9a'; x.fillRect(34, 512, 270 * st.t / st.len, 6); text(x, `${mm(st.t)} / ${mm(st.len)}`, 304, 496, '700 15px sans-serif', '#7f8bb0', 'right');
    // right: the records it is up against
    text(x, 'RECORDS', 990, 45, '800 22px sans-serif', '#9ff0ff', 'right');
    const deep = Math.max(0, (s.bestWave || 0) - 60), rows = [['Furthest wave', s.bestWave || '—'], ['High score', s.bestScore ? Math.round(s.bestScore).toLocaleString() : '—'], ['Deep Void', deep ? `+${deep} waves` : '—'], ['Sorties', s.sorties || 0], ['Invaders', (s.kills || 0).toLocaleString()]];
    rows.forEach(([k, v], i) => { const y = 100 + i * 84; text(x, k.toUpperCase(), 990, y, '700 15px sans-serif', '#7f8bb0', 'right'); text(x, String(v), 990, y + 30, '800 28px sans-serif', '#e8fbff', 'right'); });
    tv.face.material.map.needsUpdate = true;
  }
  offscreen(gl) { if (this.tv) this.replay.render(gl); }
  resize(w, h) { super.resize(w, h); this.vw = w; this.vh = h; }
  /** Watching the replay: it takes the whole screen (the UI lays its controls over it). */
  render(gl, dt) { if (this.watching && this.replay?.rep) { this.replay.update(dt); this.replay.renderFull(gl, this.vw, this.vh, this.watchInsets); return; } super.render(gl, dt); }
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
  /** The way through to Defence Control: sealed until the invaders strike back (the first Counterattack clear). */
  controlDoor(open) { this.door(this.show, W, CONTROL_DOOR_Z, Math.PI / 2, 'DEFENCE CONTROL  ›', 'control', { sealed: !open, sign: '#ffd9a0', edge: 0xffb547 }); }
  update(dt) {
    this.walk(dt); const night = nightAmount();
    // outside: Earth turns slowly, lit from the sun (its shader wants the light in view space)
    const u = this.earth.material.uniforms; u.time.value = this.t + 400; u.night.value = night; u.sun.value.copy(this.sunDir).transformDirection(this.cam.matrixWorldInverse); this.earth.rotation.y = this.t * 0.002;
    this.sun.visible = false; // the sun itself is behind you
    // evening in the room: the lights dim a little and warm up when it is night outside
    for (const l of this.lamps) { l.intensity = 0.55 - night * 0.18; l.color.setRGB(1, 0.9 - night * 0.08, 0.77 - night * 0.15); } this.hemi.intensity = 0.55 - night * 0.2; this.lightMat.color.setRGB(1, 0.94 - night * 0.1, 0.85 - night * 0.2);
    this.holoGrid.rotation.z = this.t * 0.15;
    // the hologram, the ships, the banners
    this.station.animate(dt, night); this.station.body.rotation.set(0.25, this.t * 0.3, 0);
    if (this.tv) { const r = lastReplay(); if (this.replay.rep !== r) this.replay.load(r); this.replay.update(dt); if (this.t >= this.tv.next) { this.tv.next = this.t + 0.2; this.drawTv(); } }
    for (const p of this.spins || []) { p.rotation.y = this.t * 0.5 + p.userData.spin; p.position.y = 1.35 + Math.sin(this.t * 1.4 + p.userData.spin) * 0.05; }
    for (const [i, f] of (this.flags || []).entries()) { f.rotation.z = Math.sin(this.t * 0.9 + i) * 0.04; f.rotation.y = (f.userData.ry || 0) + Math.sin(this.t * 0.6 + i * 1.7) * 0.12; }
  }
}
