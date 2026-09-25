// Defence Control: the station's war room, the second room aboard to walk around (rendering/room.js). It opens when the
// invaders first strike back (Station Siege). The window looks out past the station's own guns into deep space, where
// the next siege's fleet gathers as red lights. Four consoles down the side walls run the defences (weapons,
// protection, operations, alien hardware), each screen listing its systems. The tactical table in the middle shows the
// station under a radar sweep with the invaders closing in. The threat board on the back wall lists every siege tier,
// with its stars and best score. ORBIT's terminal answers when tapped. Doors lead back to the hangar and through to
// the Command Deck. Tapping an exhibit names it (the UI shows the details).
import { Room, canvas, tex, text, drawSign } from '@last-orbit/rendering/room.js';
import { Station } from '@last-orbit/rendering/station.js';
import { nightAmount } from '@last-orbit/rendering/background.js';
import { SIEGE_TIERS, SIEGE_CONSOLES, siegeOpen, siegeSystems, nextSiege } from '@last-orbit/data/siege.js';
const T = () => window.THREE;

// Room: x -5..5, z -7.5 (window) .. 3.5 (back wall), height 3.2.
const W = 5, FRONT = -7.5, BACK = 3.5, H = 3.2;
const TABLE = { x: 0, z: -2.4, r: 1.45 }, CONSOLE_Z = [-5.2, -2.1], AMBER = 0xffb547;
// Where each console stands: Weapons and Protection on the left wall, Operations and Alien hardware on the right.
const CONSOLE_AT = { weapons: [-1, CONSOLE_Z[0]], hull: [-1, CONSOLE_Z[1]], ops: [1, CONSOLE_Z[0]], alien: [1, CONSOLE_Z[1]] };
// The guns on the hull outside the window, and the system each one is.
const GUNS = [{ id: 'w_dmg', x: -3.2, z: -12, s: 1.2 }, { id: 'w_rate', x: 3.2, z: -12, s: 1.2 }, { id: 'w_crit', x: -6.5, z: -17, s: 0.9, pd: true }];
// Where each tier's fleet gathers in the sky outside.
const FLEET_AT = [[-230, 70], [190, 95], [-70, 108], [300, 50], [-320, 88], [80, 58]];

export class ControlRoom extends Room {
  constructor() {
    super({ w: W, front: FRONT, back: BACK, h: H, start: [0, 2.2, 0] });
    this.shell({ floor: '#161c29', wall: '#232a3b', ceil: '#1a2030', stud: '#4a3a24', tick: 'rgba(255,181,71,.2)', strip: AMBER, cove: AMBER, frame: 0x353d52, rib: 0x2c3448,
      lamp: 0xcfe0ff, lampI: 0.42, panel: 0xdfe8ff, panelW: 1.8, hemi: 0.45, sky: 0xbfd0ff, sun: 0.55,
      window: { hw: 4.2, y0: 0.5, y1: 2.85, struts: [-1.4, 1.4] }, lamps: [-5.4, 0.2, 2.4], ribs: [-6.9, -3.65, 0.1] });
    this.nearFront = 0.9;
    this.furnish(); this.outside();
    this.solids.push({ ...TABLE });
    for (const [s, z] of Object.values(CONSOLE_AT)) this.blocks.push(s < 0 ? { x0: -W, x1: -W + 0.95, z0: z - 1.15, z1: z + 1.15 } : { x0: W - 0.95, x1: W, z0: z - 1.15, z1: z + 1.15 });
    this.blocks.push({ x0: -W, x1: -3.75, z0: 1.85, z1: BACK }); // the crates
  }
  pickExtra() { return [{ obj: this.station.group, kind: 'table' }]; }
  // ---------------------------------------------------------------- the room
  furnish() {
    const THREE = T(), S = this.scene, Ph = (o) => new THREE.MeshPhongMaterial(o), strip = this.stripMat;
    const metal = Ph({ color: 0x2c3650, specular: 0x4a5a78, shininess: 40 }), dark = Ph({ color: 0x141b2c, specular: 0x223044, shininess: 30 });
    // the tactical table: an octagon with a radar on top, the station hologram over it, the invaders closing in
    const tbl = new THREE.Group(); tbl.position.set(TABLE.x, 0, TABLE.z); S.add(tbl);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.85, 0.85, 8), metal); base.position.y = 0.42; tbl.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.08, 8), dark); top.position.y = 0.88; top.rotation.y = Math.PI / 8; tbl.add(top);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.022, 6, 8), strip); rim.rotation.set(Math.PI / 2, 0, Math.PI / 8); rim.position.y = 0.93; tbl.add(rim);
    const radarC = canvas(512, 512), r = radarC.getContext('2d'), c0 = 256;
    r.strokeStyle = 'rgba(255,181,71,.55)'; for (const [rad, lw] of [[250, 3], [188, 2], [125, 2], [62, 2]]) { r.lineWidth = lw; r.beginPath(); r.arc(c0, c0, rad, 0, Math.PI * 2); r.stroke(); }
    r.strokeStyle = 'rgba(255,181,71,.3)'; r.lineWidth = 1.5; for (let a = 0; a < 12; a++) { const k = (a / 12) * Math.PI * 2; r.beginPath(); r.moveTo(c0 + Math.cos(k) * 62, c0 + Math.sin(k) * 62); r.lineTo(c0 + Math.cos(k) * 250, c0 + Math.sin(k) * 250); r.stroke(); }
    r.strokeStyle = 'rgba(255,181,71,.7)'; r.lineWidth = 2; for (let a = 0; a < 72; a++) { const k = (a / 72) * Math.PI * 2, l = a % 6 ? 8 : 16; r.beginPath(); r.moveTo(c0 + Math.cos(k) * 250, c0 + Math.sin(k) * 250); r.lineTo(c0 + Math.cos(k) * (250 - l), c0 + Math.sin(k) * (250 - l)); r.stroke(); }
    const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const radar = new THREE.Mesh(new THREE.CircleGeometry(1.05, 64), new THREE.MeshBasicMaterial({ map: tex(radarC), opacity: 0.8, ...add })); radar.rotation.x = -Math.PI / 2; radar.position.y = 0.925; tbl.add(radar);
    // the sweep: a wedge that fades behind its leading edge
    const sweepC = canvas(256, 256), sw = sweepC.getContext('2d');
    for (let i = 0; i < 40; i++) { const a0 = -(i / 40) * 1.1, a1 = -((i + 1) / 40) * 1.1; sw.fillStyle = `rgba(255,190,90,${0.5 * (1 - i / 40) ** 2})`; sw.beginPath(); sw.moveTo(128, 128); sw.arc(128, 128, 126, a1, a0); sw.closePath(); sw.fill(); }
    sw.strokeStyle = 'rgba(255,220,150,.95)'; sw.lineWidth = 2.5; sw.beginPath(); sw.moveTo(128, 128); sw.lineTo(254, 128); sw.stroke();
    this.sweep = new THREE.Mesh(new THREE.CircleGeometry(1.04, 48), new THREE.MeshBasicMaterial({ map: tex(sweepC), opacity: 0.9, ...add })); this.sweep.rotation.x = -Math.PI / 2; this.sweep.position.y = 0.93; tbl.add(this.sweep);
    this.blipMat = new THREE.MeshBasicMaterial({ color: 0xff4d6a, transparent: true, depthWrite: false }); this.blipGeo = new THREE.CircleGeometry(0.035, 12); this.blips = [];
    this.blipGroup = new THREE.Group(); this.blipGroup.position.y = 0.94; tbl.add(this.blipGroup);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.3, 0.9, 32, 1, true), new THREE.MeshBasicMaterial({ color: AMBER, opacity: 0.05, side: THREE.DoubleSide, ...add })); beam.position.y = 1.4; tbl.add(beam);
    this.tag(tbl, 'table');
    this.station = new Station(S); this.station.group.visible = true; this.station.group.position.set(TABLE.x, 1.42, TABLE.z); this.station.group.scale.setScalar(0.024);
    // a hazard ring painted on the floor round it
    const ringC = canvas(512, 64), rc = ringC.getContext('2d'); rc.fillStyle = '#ffb547'; rc.fillRect(0, 0, 512, 64); rc.fillStyle = '#1a1406'; for (let x = -64; x < 512; x += 48) { rc.beginPath(); rc.moveTo(x, 64); rc.lineTo(x + 24, 64); rc.lineTo(x + 64, 0); rc.lineTo(x + 40, 0); rc.fill(); }
    const rt = tex(ringC); rt.wrapS = THREE.RepeatWrapping; rt.repeat.set(6, 1);
    const hazard = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.62, 64, 1), new THREE.MeshBasicMaterial({ map: rt, transparent: true, opacity: 0.55 })); hazard.rotation.x = -Math.PI / 2; hazard.position.set(TABLE.x, 0.012, TABLE.z); S.add(hazard);
    // the alert beacon hanging over the table
    const bc = new THREE.Group(); bc.position.set(TABLE.x, H, TABLE.z); S.add(bc); this.beacon = bc;
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.22, 16), metal); mount.position.y = -0.11; bc.add(mount);
    this.lens = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: AMBER })); this.lens.rotation.x = Math.PI; this.lens.position.y = -0.22; bc.add(this.lens);
    const bladeC = canvas(128, 32), bl = bladeC.getContext('2d'), gr = bl.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,190,90,.9)'); gr.addColorStop(1, 'rgba(255,190,90,0)'); bl.fillStyle = gr; bl.fillRect(0, 0, 128, 32);
    this.blades = new THREE.Group(); this.blades.position.y = -0.28; bc.add(this.blades);
    for (const s of [0, Math.PI]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshBasicMaterial({ map: tex(bladeC), opacity: 0.35, side: THREE.DoubleSide, ...add })); b.geometry.translate(0.8, 0, 0); b.rotation.set(0, s, -0.35); this.blades.add(b); }
    // the four consoles: a desk against the wall, its controls, and a screen above (drawn in sync)
    this.consoles = {};
    for (const cn of SIEGE_CONSOLES) {
      const [side, z] = CONSOLE_AT[cn.id], g = new THREE.Group(); g.position.set(side * W, 0, z); g.rotation.y = -side * Math.PI / 2; S.add(g);
      const col = new THREE.Color(cn.color), desk = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.78, 0.62), metal); desk.position.set(0, 0.39, 0.4); g.add(desk);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.05, 0.66), Ph({ color: 0x3a4560, specular: 0x7a8aa8, shininess: 60 })); lip.position.set(0, 0.8, 0.4); g.add(lip);
      const padC = canvas(512, 128), pc = padC.getContext('2d'); pc.fillStyle = '#0a0f1c'; pc.fillRect(0, 0, 512, 128);
      for (let i = 0; i < 18; i++) for (let j = 0; j < 3; j++) { const on = Math.random() < 0.55; pc.fillStyle = on ? (Math.random() < 0.25 ? '#ff5d6a' : cn.color) : '#1c2438'; pc.fillRect(22 + i * 26, 20 + j * 32, 16, 18); }
      // the control surface: a wedge tilted towards whoever stands at it, its buttons on top
      const TILT = 0.48, slope = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.3, 0.5), metal); slope.rotation.x = TILT; slope.position.set(0, 0.88, 0.47); g.add(slope);
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.46), new THREE.MeshBasicMaterial({ map: tex(padC) })); pad.rotation.x = -Math.PI / 2 + TILT;
      pad.position.set(0, 0.88 + 0.156 * Math.cos(TILT), 0.47 + 0.156 * Math.sin(TILT)); g.add(pad);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: col })); edge.position.set(0, 0.74, 0.72); g.add(edge);
      this.hitBox(g, 2.2, 2.5, 1.0, 0, 1.25, 0.45); this.tag(g, cn.id); this.consoles[cn.id] = { g, edge };
    }
    // ORBIT's terminal on the left wall, behind the consoles, and supply crates in the corner
    const orbit = new THREE.Group(); orbit.position.set(-W, 0, 1.15); orbit.rotation.y = Math.PI / 2; S.add(orbit);
    const eyeC = canvas(256, 320), ey = eyeC.getContext('2d'); ey.fillStyle = '#060b18'; ey.fillRect(0, 0, 256, 320);
    for (const [rad, a] of [[92, 0.35], [70, 0.6], [46, 0.9]]) { ey.strokeStyle = `rgba(94,230,255,${a})`; ey.lineWidth = 6; ey.beginPath(); ey.arc(128, 128, rad, 0, Math.PI * 2); ey.stroke(); }
    const eg = ey.createRadialGradient(128, 128, 0, 128, 128, 34); eg.addColorStop(0, '#e8fdff'); eg.addColorStop(0.5, '#5ee6ff'); eg.addColorStop(1, 'rgba(94,230,255,0)'); ey.fillStyle = eg; ey.beginPath(); ey.arc(128, 128, 34, 0, Math.PI * 2); ey.fill();
    text(ey, 'ORBIT', 128, 262, '800 34px sans-serif', '#9ff0ff'); text(ey, 'STATION AI · TAP TO TALK', 128, 296, '700 15px sans-serif', '#5a7a90');
    this.orbitFace = this.screen(orbit, eyeC, 0.8, 1.0, 0, 1.6, 0.03, 0, 0x1a2030).userData.face; this.hitBox(orbit, 1.0, 1.3, 0.3, 0, 1.6, 0.1); this.tag(orbit, 'orbit');
    const crate = Ph({ color: 0x3a3428, specular: 0x222222, shininess: 12 }), band = new THREE.MeshBasicMaterial({ color: 0x8a6a2a });
    for (const [x, y, z, s, ry] of [[-4.45, 0.35, 2.75, 0.7, 0.1], [-4.4, 1.0, 2.85, 0.6, -0.15], [-4.4, 0.3, 1.95 + 0.3, 0.6, 0.3]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crate); b.position.set(x, y, z); b.rotation.y = ry; S.add(b);
      const st = new THREE.Mesh(new THREE.BoxGeometry(s + 0.01, 0.06, s + 0.01), band); st.position.copy(b.position); st.rotation.y = ry; S.add(st);
    }
    // the way out, on the back wall
    this.exitDoor = this.door(S, 3.4, BACK, 0, 'HANGAR  ›', 'exit', { sign: '#ffd9a0', edge: AMBER });
  }
  /** Deep space beyond the window: stars, a red nebula where they come from, and the station's hull with its guns. */
  outside() {
    const THREE = T(), S = this.scene, add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const n = 1100, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); pos.set([Math.cos(a) * r * 1800, u * 900 + 200, -Math.abs(Math.sin(a) * r) * 1800 - 250], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    S.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })));
    const neb = (w, h, stops) => { const c = canvas(256, 256), x = c.getContext('2d'), gr = x.createRadialGradient(128, 128, 0, 128, 128, 128); stops.forEach(([k, s]) => gr.addColorStop(k, s)); x.fillStyle = gr; x.fillRect(0, 0, 256, 256); return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(c), ...add })); };
    const n1 = neb(1500, 900, [[0, 'rgba(150,30,60,.55)'], [0.5, 'rgba(90,20,70,.25)'], [1, 'rgba(0,0,0,0)']]); n1.position.set(-150, 150, -1500); S.add(n1);
    const n2 = neb(1100, 800, [[0, 'rgba(90,40,150,.45)'], [0.6, 'rgba(40,20,90,.18)'], [1, 'rgba(0,0,0,0)']]); n2.position.set(380, 260, -1450); S.add(n2);
    // the hull outside: a deck of plating below the window, a truss running out along it
    const plateC = canvas(256, 256), p = plateC.getContext('2d'); p.fillStyle = '#4a5162'; p.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 80; i++) { p.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + Math.random() * 0.06})`; p.fillRect(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 40, 6 + Math.random() * 30); }
    p.strokeStyle = 'rgba(30,36,48,.8)'; p.lineWidth = 3; for (let i = 0; i <= 256; i += 64) { p.beginPath(); p.moveTo(i, 0); p.lineTo(i, 256); p.stroke(); p.beginPath(); p.moveTo(0, i); p.lineTo(256, i); p.stroke(); }
    const hullMat = new THREE.MeshPhongMaterial({ map: tex(plateC, [6, 4]), specular: 0x444c5c, shininess: 20 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(34, 1, 24), hullMat); deck.position.set(0, -0.7, FRONT - 12.4); S.add(deck);
    const edgeLights = new THREE.MeshBasicMaterial({ color: 0xff4d6a }); this.edgeLights = [];
    for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), edgeLights.clone()); l.position.set(-16 + i * 4, -0.15, FRONT - 24.2); S.add(l); this.edgeLights.push(l); }
    const truss = new THREE.MeshPhongMaterial({ color: 0x8a94a8, specular: 0x333844, shininess: 20 });
    for (const y of [0.4, 1.6]) for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 22), truss); b.position.set(-9 + s * 0.6, y, FRONT - 13); S.add(b); }
    for (let i = 0; i < 11; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.34, 1.34, 0.1), truss); b.position.set(-9, 1, FRONT - 3 - i * 2); S.add(b); const d = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 0.08), truss); d.position.set(-9, 1, FRONT - 4 - i * 2); d.rotation.z = 0.78; S.add(d); }
    // the window itself: tap it to ask what is out there
    this.tag(this.hitBox(S, 8.4, 2.35, 0.1, 0, 1.675, FRONT + 0.12), 'window');
    this.hull = { mat: new THREE.MeshPhongMaterial({ color: 0x9aa4b6, specular: 0x556070, shininess: 40 }), dark: new THREE.MeshPhongMaterial({ color: 0x2a3140, shininess: 20 }), gold: new THREE.MeshPhongMaterial({ color: 0xffc857, emissive: 0x3a2600, specular: 0xfff0c0, shininess: 80 }) };
  }
  // ---------------------------------------------------------------- what is on display (rebuilt when it changes)
  sync(state) {
    this.station.sync(state);
    const sys = siegeSystems(state), sg = state.siege || { stars: {}, best: {} }, rank = state.prestige?.level || 0, next = nextSiege(state);
    const threat = SIEGE_TIERS.filter((t) => siegeOpen(state, t.n) && !sg.won?.[t.n]).map((t) => t.n);
    const sig = [sys.list.map((x) => x.state).join(''), JSON.stringify(sg.stars), JSON.stringify(sg.best), sg.wins || 0, threat.join(), SIEGE_TIERS.map((t) => (siegeOpen(state, t.n) ? 1 : 0)).join(''), rank > 0, state.stationName, (state.siege?.damage?.ids || []).join(), sg.kills || 0].join('|');
    if (sig === this.sig) return; this.sig = sig; this.threat = threat; this.next = next; this.damaged = sys.damaged > 0;
    if (this.show) { this.scene.remove(this.show); this.untag(this.show); } const THREE = T(); this.show = new THREE.Group(); this.scene.add(this.show);
    for (const cn of SIEGE_CONSOLES) this.consoleScreen(cn, sys);
    this.threatBoard(state, sg); this.guns(sys); this.fleet(threat); this.nameSign(state); this.blipsFor(threat.length);
    this.door(this.show, W, 1.6, Math.PI / 2, 'COMMAND DECK  ›', 'deck', { sealed: rank < 1, sign: '#9ff0ff', edge: 0x5ee6ff });
  }
  consoleScreen(cn, sys) {
    const c = canvas(512, 300), x = c.getContext('2d'), rows = cn.ids.map((id) => sys.list.find((l) => l.sys.id === id)), on = rows.filter((r) => r.state).length;
    x.fillStyle = '#050a18'; x.fillRect(0, 0, 512, 300); x.fillStyle = cn.color; x.globalAlpha = 0.16; x.fillRect(0, 0, 512, 52); x.globalAlpha = 1; x.strokeStyle = cn.color; x.lineWidth = 3; x.strokeRect(4, 4, 504, 292);
    text(x, cn.name.toUpperCase(), 20, 28, '800 26px sans-serif', cn.color, 'left'); text(x, `${on}/${rows.length} ONLINE`, 492, 28, '700 18px sans-serif', on ? '#e8fbff' : '#6a7690', 'right');
    const step = Math.min(40, 236 / rows.length);
    rows.forEach((r, i) => { const y = 76 + i * step, col = r.damaged ? '#ff4d6a' : r.state === 2 ? '#ffd27a' : r.state ? '#5ee6ff' : '#3a4560';
      x.fillStyle = col; x.beginPath(); x.arc(30, y, 8, 0, Math.PI * 2); x.fill();
      text(x, r.sys.name, 50, y, `700 ${step < 38 ? 19 : 21}px sans-serif`, r.state || r.damaged ? '#e8fbff' : '#6a7690', 'left'); text(x, r.damaged ? 'DAMAGED' : r.state === 2 ? (r.sys.alien ? 'FITTED' : 'MAXED') : r.state ? 'ONLINE' : 'OFFLINE', 492, y, '800 15px sans-serif', col, 'right'); });
    const [side, z] = CONSOLE_AT[cn.id], scr = this.screen(this.show, c, 1.9, 1.1, side * (W - 0.03), 1.92, z, -side * Math.PI / 2); this.tag(scr, cn.id);
    this.consoles[cn.id].edge.material.color.set(rows.some((r) => r.damaged) ? '#ff4d6a' : on ? cn.color : '#3a4560');
  }
  threatBoard(state, sg) {
    const c = canvas(640, 350), x = c.getContext('2d'), stars = Object.values(sg.stars || {}).reduce((a, b) => a + b, 0);
    x.fillStyle = '#060a16'; x.fillRect(0, 0, 640, 350); x.strokeStyle = '#ffb547'; x.lineWidth = 3; x.strokeRect(5, 5, 630, 340);
    text(x, 'THREAT BOARD', 24, 32, '800 28px sans-serif', '#ffd9a0', 'left'); text(x, `HELD ${sg.wins || 0} · ★ ${stars}/${SIEGE_TIERS.length * 3} · ${sg.kills || 0} DOWNED`, 616, 32, '700 17px sans-serif', '#9fb0d0', 'right');
    SIEGE_TIERS.forEach((t, i) => { const y = 84 + i * 44, open = siegeOpen(state, t.n), held = !!sg.won?.[t.n], got = sg.stars?.[t.n] || 0;
      x.fillStyle = open ? (held ? 'rgba(109,255,200,.07)' : 'rgba(255,181,71,.1)') : 'rgba(255,255,255,.02)'; x.fillRect(16, y - 19, 608, 38);
      text(x, String(t.n), 36, y, '800 22px sans-serif', open ? '#ffd9a0' : '#3e4a66'); text(x, open ? t.name.toUpperCase() : 'UNKNOWN', 64, y, '800 21px sans-serif', open ? '#e8fbff' : '#3e4a66', 'left');
      text(x, open ? '★'.repeat(got) + '☆'.repeat(3 - got) : '', 430, y, '700 22px sans-serif', '#ffc857');
      text(x, !open ? `COUNTERATTACK ${t.n}` : held ? 'HELD' : 'MASSING', 612, y, '800 16px sans-serif', !open ? '#3e4a66' : held ? '#6dffc8' : '#ff8a5e', 'right'); });
    const scr = this.screen(this.show, c, 3.5, 1.92, -1.25, 1.72, BACK - 0.06, Math.PI); this.tag(scr, 'board');
  }
  /** The guns on the hull outside: a turret for each gun system that is online (gold-trimmed once maxed), a bare mount
   *  where one is still to be built. */
  guns(sys) {
    const THREE = T(), M = this.hull; this.turrets = [];
    for (const gdef of GUNS) {
      const st = sys.list.find((l) => l.sys.id === gdef.id).state, g = new THREE.Group(); g.position.set(gdef.x, -0.2, gdef.z); g.scale.setScalar(gdef.s); this.show.add(g);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.3, 24), M.dark); ring.position.y = 0.15; g.add(ring);
      if (!st) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: 0x3a4560 })); c.rotation.x = Math.PI / 2; c.position.y = 0.32; g.add(c); continue; }
      const yaw = new THREE.Group(); yaw.position.y = 0.3; g.add(yaw);
      if (gdef.pd) { const dome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.mat); dome.position.y = 0.05; yaw.add(dome); }
      else {
        // an eight-sided turret with a lid, and a mantlet the barrels come out of
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.92, 0.66, 8), M.mat); body.position.y = 0.36; yaw.add(body);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.8, 0.14, 8), M.mat); lid.position.y = 0.76; yaw.add(lid);
        const mant = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.46, 0.4), M.dark); mant.position.set(0, 0.45, -0.72); yaw.add(mant);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4d6a })); lamp.position.set(0.3, 0.86, 0.2); yaw.add(lamp); g.userData.lamp2 = lamp;
      }
      if (st === 2) { const band = new THREE.Mesh(gdef.pd ? new THREE.TorusGeometry(0.74, 0.04, 6, 24) : new THREE.CylinderGeometry(0.87, 0.87, 0.09, 8), M.gold); if (gdef.pd) band.rotation.x = Math.PI / 2; band.position.y = gdef.pd ? 0.08 : 0.52; yaw.add(band); }
      const pitch = new THREE.Group(); pitch.position.set(0, gdef.pd ? 0.45 : 0.45, gdef.pd ? 0 : -0.75); yaw.add(pitch);
      const barrels = gdef.pd ? [[-0.12, 0.08], [0.12, 0.08], [-0.12, -0.12], [0.12, -0.12]] : [[-0.32, 0], [0.32, 0]];
      for (const [bx, by] of barrels) { const b = new THREE.Mesh(new THREE.CylinderGeometry(gdef.pd ? 0.06 : 0.11, gdef.pd ? 0.06 : 0.13, gdef.pd ? 1.2 : 2.4, 10), M.dark); b.rotation.x = Math.PI / 2; b.position.set(bx, by, gdef.pd ? -0.6 : -1.2); pitch.add(b);
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(gdef.pd ? 0.07 : 0.15, gdef.pd ? 0.07 : 0.15, 0.2, 10), st === 2 ? M.gold : M.mat); tip.rotation.x = Math.PI / 2; tip.position.set(bx, by, gdef.pd ? -1.2 : -2.4); pitch.add(tip); }
      this.turrets.push({ yaw, pitch, ph: gdef.x * 0.7, pd: !!gdef.pd, lamp: g.userData.lamp2 });
    }
  }
  /** The fleets gathering outside: a cluster of red running lights for each siege that is open and not yet held. */
  fleet(threat) {
    const THREE = T(); this.fleetLights = null;
    const glow = canvas(64, 64), gx = glow.getContext('2d'), gr = gx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,120,120,.8)'); gr.addColorStop(1, 'rgba(255,40,60,0)'); gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64);
    const map = tex(glow);
    // one instanced mesh for every light (each winks on its own through its colour)
    const lights = []; for (const n of threat) { const [fx, fy] = FLEET_AT[n - 1], count = 5 + n * 2;
      for (let i = 0; i < count; i++) { const row = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2), col = i - (row * (row + 1)) / 2; /* a wedge: row r has r + 1 ships */
        lights.push([fx + (col - row / 2) * 16 + (Math.random() - 0.5) * 5, fy - row * 9 + (Math.random() - 0.5) * 4, -950 - row * 12, 10 + Math.random() * 5]); } }
    if (!lights.length) return;
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), lights.length), d = new THREE.Object3D();
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(lights.length * 3), 3); m.frustumCulled = false;
    lights.forEach(([x, y, z, sc], i) => { d.position.set(x, y, z); d.scale.setScalar(sc); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    this.fleetLights = { m, ph: lights.map(() => Math.random() * 6) }; this.show.add(m);
  }
  /** Red blips on the radar, closing on the station: more of them the more sieges are massing. */
  blipsFor(n) {
    const THREE = T(); for (const b of this.blips) this.blipGroup.remove(b.m); this.blips = [];
    const count = n ? 4 + n * 3 : 0;
    for (let i = 0; i < count; i++) { const m = new THREE.Mesh(this.blipGeo, this.blipMat.clone()); m.rotation.x = -Math.PI / 2; this.blipGroup.add(m); this.blips.push({ m, a: Math.random() * Math.PI * 2, r: 0.3 + Math.random() * 0.7, v: 0.05 + Math.random() * 0.05, w: (Math.random() - 0.5) * 0.3 }); }
  }
  nameSign(state) {
    const THREE = T(), c = canvas(768, 96), x = c.getContext('2d');
    drawSign(x, 'DEFENCE CONTROL', (state.stationName ? state.stationName.toUpperCase() + ' · ' : '') + 'STATION DEFENCE GRID', '#ffe2b0', '#ffb547');
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.2625), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true })); m.position.set(0, 2.995, FRONT + 0.17); this.show.add(m); /* low enough to clear the first ceiling beam */
  }
  // ---------------------------------------------------------------- every frame
  update(dt) {
    this.walk(dt); const t = this.t, red = !!this.damaged, alert = red || !!this.threat?.length, night = nightAmount();
    // the room: dim screens-and-panels light; on alert the cove glows amber and breathes, red and faster while the station
    // is damaged
    const k = alert ? 0.75 + 0.25 * Math.sin(t * (red ? 4.2 : 2.4)) : 0.8; if (red) this.coveMat.color.setRGB(k, 0.18 * k, 0.16 * k); else this.coveMat.color.setRGB(k, 0.71 * k, 0.28 * k); for (const l of this.lamps) l.intensity = 0.42 - night * 0.1;
    // the radar: the sweep turns, blips brighten as it passes and creep in towards the station
    const sa = (t * 1.3) % (Math.PI * 2); this.sweep.rotation.z = sa;
    for (const b of this.blips) {
      b.r -= b.v * dt * 0.25; b.a += b.w * dt * 0.2; if (b.r < 0.2) { b.r = 0.95 + Math.random() * 0.08; b.a = Math.random() * Math.PI * 2; }
      b.m.position.set(Math.cos(b.a) * b.r, 0, -Math.sin(b.a) * b.r); const d = ((sa - b.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); b.m.material.opacity = 0.2 + 0.8 * Math.exp(-d * 1.4);
    }
    this.station.animate(dt, 0.4); this.station.body.rotation.set(0.35, t * 0.25, 0);
    // the beacon: turning amber blades on alert, a steady green lens when all is quiet
    for (const b of this.blades.children) b.material.color.setRGB(1, red ? 0.25 : 1, red ? 0.25 : 1); /* red blades while damaged */
    this.blades.visible = alert; if (alert) { this.blades.rotation.y = t * (red ? 5 : 3.2); if (red) this.lens.material.color.setRGB(1, 0.12 + 0.12 * Math.sin(t * 9), 0.15); else this.lens.material.color.setRGB(1, 0.6 + 0.2 * Math.sin(t * 6.4), 0.2); } else this.lens.material.color.setRGB(0.3, 0.9, 0.55);
    // outside: the guns scan the dark, the fleet's running lights wink, the hull's edge lights blink in turn
    for (const g of this.turrets || []) { g.yaw.rotation.y = Math.sin(t * (g.pd ? 0.5 : 0.23) + g.ph) * (g.pd ? 0.9 : 0.45); g.pitch.rotation.x = 0.12 + Math.sin(t * 0.31 + g.ph) * 0.08; if (g.lamp) g.lamp.visible = (t + g.ph) % 1.4 < 0.7; }
    const fl = this.fleetLights; if (fl?.m) { const c = (this._fc ||= new (T().Color)()); fl.ph.forEach((ph, i) => fl.m.setColorAt(i, c.setHex(0xff5566).multiplyScalar(0.45 + 0.55 * Math.max(0, Math.sin(t * 2.1 + ph))))); fl.m.instanceColor.needsUpdate = true; }
    this.edgeLights.forEach((l, i) => l.material.color.setRGB(((t * 1.5 - i * 0.18) % 1.5) < 0.25 ? 1 : 0.25, 0.2, 0.25));
    const o = this.orbitFace.material.color, pk = 0.8 + 0.2 * Math.sin(t * 1.7); o.setRGB(pk, pk, pk);
  }
}
