// The Shipyard: the dry dock at the station's rim, the seventh room aboard to walk around (rendering/room.js). It opens
// with the shipyard frame, at Overhaul rank 7. A tall bay, open to space through force-field doors onto the slipway: the
// ship on the cradle in the middle, gantries down both sides with welding arms that work on her while the build goes
// on, a crane overhead, the build console on the left, her blueprint on the left wall and the fleet board on the right.
// The yard builds the Chimera (data/shipyard.js) in four stages, each showing on the ship: the plans as a hologram,
// then her frame, her plating, her drive, and at last her colours, when the arms stand back and she lifts off the
// cradle. After that the bay holds whichever ship you fly, in its paint. Doors lead back to the Observatory and out to
// the hangar, on to the Beacon array once the beacons are lit, and to Fleet Ops once the halo is up. Tapping anything names it (the UI shows the details).
import { Room, canvas, tex, text, drawSign, drawArt } from '@last-orbit/rendering/room.js';
import { playerParts, supportCraftGeometry, NOZZLES } from '@last-orbit/rendering/geometry.js';
import { earthMaterial, nightAmount } from '@last-orbit/rendering/background.js';
import { SHIPS, SHIP_BY_ID } from '@last-orbit/data/ships.js';
import { PAINT_BY_ID } from '@last-orbit/data/career.js';
import { YARD_STAGES, YARD_SHIP } from '@last-orbit/data/shipyard.js';
import { BEACON_RANK } from '@last-orbit/data/beacons.js';
import { FLEET_RANK, DEST_BY_ID } from '@last-orbit/data/fleet.js';
import { yardStage, nextStage, stageBlock } from '@last-orbit/progression/shipyard.js';
const T = () => window.THREE;

// Room: x -5.5..5.5, z -12 (the bay doors) .. 3.5 (back wall, the doors), height 5.2.
const W = 5.5, FRONT = -12, BACK = 3.5, H = 5.2, YELLOW = 0xffc93c, STEEL = 0x7fb2ff;
// The ship in her jig: stood on her tail and leaning back, her top to the doors you come in by (the shape you know from
// flying her), turned a little; and the gantries either side.
const CRADLE = { x: 0, z: -5.6 }, SHIP_Y = 1.85, SCALE = 1.25, LEAN = 0.5, TURN = 0.14, GANTRY_X = 3.6, GANTRY_Z = [-8.4, -2.8];
const fmt = (n) => Math.round(n).toLocaleString('en-GB');

export class YardRoom extends Room {
  constructor() {
    super({ w: W, front: FRONT, back: BACK, h: H, start: [0, 1.4, 0] });
    this.shell({ floor: '#1b1e24', wall: '#272c35', ceil: '#1c2028', stud: '#6a5a2a', tick: 'rgba(255,201,60,.2)', strip: YELLOW, cove: STEEL, frame: 0x363c48, rib: 0x2e343f,
      lamp: 0xfff0d0, lampI: 0.5, panel: 0xfff4e0, panelW: 2.6, hemi: 0.5, sky: 0xdfe8ff, sun: 0.55,
      window: { hw: 4.7, y0: 0.3, y1: 4.5, struts: [] }, lamps: [-9, -5.4, -1.2], ribs: [-11.6, -7, -1.6, 2.4] }); /* the first clear of the door to the beacons */
    this.nearFront = 1.2;
    this.furnish(); this.outside(); this.stageSeen = null;
    this.blocks.push({ x0: -2.45, x1: 2.45, z0: CRADLE.z - 3.6, z1: CRADLE.z + 3.6 }); // the cradle
    for (const s of [-1, 1]) this.blocks.push({ x0: s * GANTRY_X - 0.55, x1: s * GANTRY_X + 0.55, z0: GANTRY_Z[0], z1: GANTRY_Z[1] }); // the gantries
    this.solids.push({ x: -2.9, z: -0.9, r: 0.95 }); // the console
    this.bakeStatic(); /* still parts merged into fewer draw calls (room.js) */
  }
  // ---------------------------------------------------------------- the bay
  furnish() {
    const THREE = T(), S = this.scene, Ph = (o) => new THREE.MeshPhongMaterial(o), add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const steel = Ph({ color: 0x3a414e, specular: 0x6a7a90, shininess: 45 }), dark = Ph({ color: 0x191d25, specular: 0x333a48, shininess: 30 }), yellow = Ph({ color: YELLOW, emissive: 0x3a2800, specular: 0x886a30, shininess: 30 });
    const box = (w, h, d, x, y, z, m, parent = S) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); parent.add(b); return b; };
    const mc = canvas(32, 32), mx = mc.getContext('2d'), mg = mx.createRadialGradient(16, 16, 0, 16, 16, 16); mg.addColorStop(0, 'rgba(255,255,255,1)'); mg.addColorStop(0.35, 'rgba(255,255,255,.55)'); mg.addColorStop(1, 'rgba(255,255,255,0)'); mx.fillStyle = mg; mx.fillRect(0, 0, 32, 32);
    this.moteTex = tex(mc);
    // the cradle: a deck plate edged in hazard stripes, the jig she stands in (a block under her tail, two struts from
    // behind to her belly), her name plate at the front
    const cr = new THREE.Group(); cr.position.set(CRADLE.x, 0, CRADLE.z); S.add(cr);
    const hz = canvas(256, 32), hx = hz.getContext('2d'); hx.fillStyle = '#16140c'; hx.fillRect(0, 0, 256, 32); hx.fillStyle = '#ffc93c'; for (let i = -32; i < 256; i += 24) { hx.beginPath(); hx.moveTo(i, 32); hx.lineTo(i + 12, 32); hx.lineTo(i + 44, 0); hx.lineTo(i + 32, 0); hx.fill(); }
    const stripe = new THREE.MeshBasicMaterial({ map: tex(hz, [6, 1]) });
    box(4.6, 0.3, 7, 0, 0.15, 0, dark, cr);
    for (const s of [-1, 1]) { box(4.6, 0.02, 0.22, 0, 0.31, s * 3.39, stripe, cr); box(7, 0.02, 0.22, s * 2.19, 0.31, 0, stripe, cr).rotation.y = Math.PI / 2; }
    box(1.1, 0.12, 0.8, 0.1, 0.36, 0.78, steel, cr);
    for (const s of [-1, 1]) {
      const from = new THREE.Vector3(s * 0.6, 0.3, -1.8), to = new THREE.Vector3(s * 0.28 - 0.05, 1.58, -0.42), d = to.clone().sub(from), strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, d.length(), 10), steel);
      strut.position.copy(from).addScaledVector(d, 0.5); strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); cr.add(strut); box(0.26, 0.22, 0.06, to.x, to.y, to.z, dark, cr).rotation.x = -LEAN;
    }
    this.plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.24), new THREE.MeshBasicMaterial({ transparent: true })); this.plaque.position.set(0, 0.15, 3.51); cr.add(this.plaque);
    // the plans, thrown up from the cradle before there is anything to build on
    this.holoBeam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 4, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x5ee6ff, opacity: 0.05, side: THREE.DoubleSide, ...add })); this.holoBeam.position.y = 2.3; cr.add(this.holoBeam);
    this.holoMat = new THREE.LineBasicMaterial({ color: 0x7ff0ff, transparent: true, opacity: 0.5, depthWrite: false });
    this.hitBox(cr, 5, 4.4, 7.2, 0, 2.2, 0); this.tag(cr, 'ship');
    this.pivot = new THREE.Group(); this.pivot.position.set(CRADLE.x, SHIP_Y, CRADLE.z); this.pivot.rotation.order = 'YXZ'; this.pivot.rotation.set(-LEAN, TURN, 0); this.pivot.scale.setScalar(SCALE); S.add(this.pivot);
    // the gantries down both sides: posts, rails, a walkway with its railing, braces, and welding arms that reach in to her
    this.welders = [];
    for (const s of [-1, 1]) {
      const len = GANTRY_Z[1] - GANTRY_Z[0], g = new THREE.Group(); g.position.set(s * GANTRY_X, 0, (GANTRY_Z[0] + GANTRY_Z[1]) / 2); S.add(g);
      for (const dx of [-0.42, 0.42]) for (const dz of [-len / 2, 0, len / 2]) box(0.12, 4.4, 0.12, dx, 2.2, dz, steel, g);
      for (const y of [0.9, 3.5, 4.35]) for (const dx of [-0.42, 0.42]) box(0.08, 0.08, len, dx, y, 0, steel, g);
      box(0.98, 0.07, len + 0.1, 0, 2.2, 0, dark, g); box(0.04, 0.04, len, -s * 0.47, 2.72, 0, yellow, g); for (let k = 0; k <= 6; k++) box(0.03, 0.5, 0.03, -s * 0.47, 2.46, -len / 2 + (k * len) / 6, yellow, g);
      for (const dz of [-len / 4, len / 4]) for (const k of [-1, 1]) { const b = box(0.05, Math.hypot(len / 2, 1.3) - 0.1, 0.05, s * 0.42, 1.55, dz, steel, g); b.rotation.x = k * Math.atan2(len / 2, 1.3); }
      this.hitBox(g, 1.2, 4.5, len, 0, 2.25, 0); this.tag(g, 'crews');
      for (const z of [-6.2, -4.5]) {
        const base = new THREE.Group(); base.position.set(s * (GANTRY_X - 0.42), 2.24, z); S.add(base); box(0.3, 0.12, 0.3, 0, 0.06, 0, dark, base);
        const yaw = new THREE.Group(); yaw.position.y = 0.14; base.add(yaw); const sh = new THREE.Group(); yaw.add(sh);
        box(1.1, 0.12, 0.12, 0.55, 0, 0, yellow, sh); const el = new THREE.Group(); el.position.x = 1.1; sh.add(el);
        box(0.9, 0.09, 0.09, 0.45, 0, 0, steel, el); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), dark); tip.position.x = 0.98; tip.rotation.z = -Math.PI / 2; el.add(tip);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.moteTex, color: 0xcfeaff, ...add })); glow.position.x = 1.08; glow.scale.setScalar(0.4); el.add(glow);
        this.welders.push({ yaw, sh, el, tip, glow, ph: Math.random() * 6, face: s < 0 ? 0 : Math.PI });
      }
    }
    // the crane overhead, working in front of her nose: a bridge on rails along the walls, a trolley, and a plate of alien
    // hull on the hook
    for (const s of [-1, 1]) box(0.1, 0.12, BACK - FRONT - 0.4, s * (W - 0.1), H - 0.5, (FRONT + BACK) / 2, steel);
    this.crane = new THREE.Group(); this.crane.position.set(0, H - 0.42, -8.6); S.add(this.crane); box(2 * W - 0.3, 0.26, 0.38, 0, 0, 0, yellow, this.crane);
    this.trolley = new THREE.Group(); this.crane.add(this.trolley); box(0.62, 0.3, 0.62, 0, -0.26, 0, dark, this.trolley);
    this.cable = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 6), dark); this.trolley.add(this.cable);
    this.load = new THREE.Group(); this.trolley.add(this.load); box(0.42, 0.14, 0.3, 0, 0, 0, yellow, this.load);
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.62, 4), dark); c.position.set(s * 0.33, -0.3, 0); c.rotation.z = s * 0.55; this.load.add(c); }
    this.plate = box(1.4, 0.07, 0.9, 0, -0.56, 0, Ph({ color: 0x5f7a66, emissive: 0x0a1a10, specular: 0x9fd0b0, shininess: 60 }), this.load);
    // the build console on the left, turned to her
    const con = new THREE.Group(); con.position.set(-2.9, 0, -0.9); con.rotation.y = 0.6; S.add(con);
    box(1.5, 0.9, 0.6, 0, 0.45, 0, dark, con); box(1.62, 0.06, 0.72, 0, 0.93, 0.02, steel, con); box(1.52, 0.03, 0.03, 0, 0.9, 0.37, new THREE.MeshBasicMaterial({ color: YELLOW }), con);
    this.console = this.screen(con, canvas(768, 480), 1.3, 0.81, 0, 1.46, -0.12, 0, 0x1a1e26); this.console.rotation.x = -0.32;
    this.hitBox(con, 1.8, 2, 1, 0, 1, 0); this.tag(con, 'console');
    // her blueprint on the left wall, the fleet on the right
    this.blueprint = this.screen(S, canvas(1024, 640), 2.9, 1.81, -W + 0.03, 2.35, 0.3, Math.PI / 2, 0x1c2230); this.tag(this.blueprint, 'blueprint');
    this.fleet = this.screen(S, canvas(1024, 640), 2.9, 1.81, W - 0.03, 2.35, 0.3, -Math.PI / 2, 0x1c2230); this.tag(this.fleet, 'fleet');
    // the build log on the back wall, between the doors: each stage and the day it was built
    this.log = this.screen(S, canvas(1024, 512), 2.3, 1.15, 0, 2.05, BACK - 0.03, Math.PI, 0x1c2230); this.tag(this.log, 'ship');
    // spare alien plates stacked by the right-hand door, a couple of crates by the left
    const plateM = Ph({ color: 0x566e5c, specular: 0x88b098, shininess: 50 });
    for (let k = 0; k < 6; k++) box(1.3, 0.07, 0.85, 4.45, 0.04 + k * 0.075, 1.5, plateM).rotation.y = (k % 2 ? 0.08 : -0.06) + k * 0.02;
    const crate = Ph({ color: 0x3a3428, shininess: 12 }); box(0.8, 0.8, 0.8, -4.6, 0.4, 2.3, crate).rotation.y = 0.2; box(0.6, 0.6, 0.6, -4.55, 1.1, 2.3, crate).rotation.y = -0.15;
    // the signs over the bay doors, either side of her nose (named in sync), and the doors on the back wall
    this.signs = [-3.2, 3.2].map((x) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), new THREE.MeshBasicMaterial({ transparent: true })); m.position.set(x, 4.85, FRONT + 0.17); S.add(m); return m; });
    this.door(S, 2.6, BACK, 0, 'HANGAR  ›', 'exit', { sign: '#fff0c8', edge: YELLOW });
    this.door(S, -2.6, BACK, 0, 'OBSERVATORY  ›', 'observatory', { sign: '#fff0c8', edge: 0xd9a441 });
    // sparks, from the welders and from each stage as it goes on
    const N = 180; this.sparks = { p: Array.from({ length: N }, () => ({ x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, life: 0 })), i: 0, geo: new THREE.BufferGeometry() };
    this.sparks.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.sparkPts = new THREE.Points(this.sparks.geo, new THREE.PointsMaterial({ map: this.moteTex, color: 0xffe0a0, size: 0.1, sizeAttenuation: true, ...add })); this.sparkPts.frustumCulled = false; S.add(this.sparkPts);
  }
  /** Beyond the force field: the slipway she will leave by, lit down both sides, the shipyard's gold frame over it, a
   *  tug about its work, and the Earth below. */
  outside() {
    const THREE = T(), S = this.scene, add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(600, 96, 64), earthMaterial()); this.earth.position.set(140, -560, -780); this.earth.rotation.x = 1.15; S.add(this.earth);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(622, 64, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN, vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN, vV; void main(){ float k = pow(1. - abs(dot(vN, vV)), 3.5); gl_FragColor = vec4(vec3(.3, .6, 1.) * k * 1.4, k); }' }));
    atmo.position.copy(this.earth.position); S.add(atmo); this.sunDir = new THREE.Vector3(-0.4, 0.6, 0.5).normalize();
    const n = 800, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); pos.set([Math.cos(a) * r * 1800, Math.abs(u) * 1800 - 100, -Math.abs(Math.sin(a) * r) * 1800 - 250], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); S.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })));
    // the slipway, its lights chasing outwards
    const deck = new THREE.MeshPhongMaterial({ color: 0x2a303a, specular: 0x444c5c, shininess: 20 }), gold = new THREE.MeshPhongMaterial({ color: 0xd9a441, emissive: 0x2a1c06, specular: 0xfff0c0, shininess: 60 });
    const slip = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 44), deck); slip.position.set(0, -0.22, FRONT - 22.2); S.add(slip);
    this.slipLights = [];
    for (let i = 0; i < 13; i++) for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: YELLOW })); l.position.set(s * 4.6, 0.06, FRONT - 1.6 - i * 3.3); S.add(l); this.slipLights.push({ l, i }); }
    // the frame: two gold portals over the slipway, joined along the top, lights blinking at the corners
    const beam = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), gold); b.position.set(x, y, z); S.add(b); };
    const bc = canvas(64, 64), bx = bc.getContext('2d'), bg = bx.createRadialGradient(32, 32, 0, 32, 32, 32); bg.addColorStop(0, 'rgba(255,255,255,1)'); bg.addColorStop(0.3, 'rgba(255,90,100,.9)'); bg.addColorStop(1, 'rgba(255,40,60,0)'); bx.fillStyle = bg; bx.fillRect(0, 0, 64, 64);
    this.beacons = [];
    for (const z of [FRONT - 11, FRONT - 25]) {
      beam(12.6, 0.5, 0.5, 0, 6, z); for (const s of [-1, 1]) { beam(0.5, 6.2, 0.5, s * 6.05, 2.9, z); const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(bc), ...add })); b.position.set(s * 6.05, 6.3, z); b.scale.setScalar(1.4); S.add(b); this.beacons.push(b); }
    }
    for (const s of [-1, 1]) beam(0.36, 0.36, 14, s * 6.05, 6, FRONT - 18);
    // a tug, pottering round the frame
    this.tug = new THREE.Mesh(supportCraftGeometry(), new THREE.MeshPhongMaterial({ color: 0xc9d2e0, specular: 0x666666, shininess: 40 })); this.tug.scale.setScalar(0.9); S.add(this.tug);
    // the force field across the bay doors, faintly scanning
    const fc = canvas(8, 128), fx = fc.getContext('2d'); for (let y = 0; y < 128; y += 4) { fx.fillStyle = `rgba(127,178,255,${0.04 + 0.1 * Math.random()})`; fx.fillRect(0, y, 8, 2); }
    this.fieldTex = tex(fc, [1, 5]); const field = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 4.2), new THREE.MeshBasicMaterial({ map: this.fieldTex, opacity: 0.55, ...add })); field.position.set(0, 2.4, FRONT + 0.05); S.add(field);
    this.tag(this.hitBox(S, 9.4, 4.2, 0.1, 0, 2.4, FRONT + 0.12), 'window');
  }
  // ---------------------------------------------------------------- what is on show (rebuilt when it changes)
  sync(state) {
    const stage = yardStage(state), done = stage >= YARD_STAGES.length, owned = SHIPS.map((s) => (state.unlocked.ships[s.id] ? 1 : 0)).join(''), mastery = SHIPS.map((s) => state.mastery?.[s.id]?.level || 0).join(',');
    const lit = (state.prestige?.level || 0) >= BEACON_RANK, halo = (state.prestige?.level || 0) >= FLEET_RANK, away = (state.fleet?.out || []).map((o) => (o ? o.ship + ':' + o.dest : '')).join(',') + JSON.stringify(state.fleet?.damage || {});
    const sig = [stage, done ? state.ship : '', done ? state.paint : '', state.stationName, owned, mastery, state.ship, stageBlock(state), lit, halo, away].join('|');
    if (sig === this.sig) return; this.sig = sig;
    // the way on to the Beacon array, at the front of the left wall by the bay doors
    if (this.beaconDoor) { this.scene.remove(this.beaconDoor); this.untag(this.beaconDoor); } this.beaconDoor = new (T().Group)(); this.scene.add(this.beaconDoor);
    this.door(this.beaconDoor, -W, -9.9, -Math.PI / 2, 'BEACON ARRAY  ›', 'beacons', { sealed: !lit, sign: '#f0e8ff', edge: 0xb69cff });
    // and to Fleet Ops, opposite it on the right
    if (this.opsDoor) { this.scene.remove(this.opsDoor); this.untag(this.opsDoor); } this.opsDoor = new (T().Group)(); this.scene.add(this.opsDoor);
    this.door(this.opsDoor, W, -9.9, Math.PI / 2, 'FLEET OPS  ›', 'ops', { sealed: !halo, sign: '#e6fffa', edge: 0x6dffc8 });
    if (this.stageSeen != null && stage > this.stageSeen) this.flourish(done); // a stage just built: sparks all over, and if she is done, she lifts off
    this.stageSeen = stage; this.stage = stage; this.done = done; if (done && this.liftT == null) this.liftT = 99;
    this.buildShip(state); this.drawSign(state); this.drawConsole(state); this.drawBlueprint(); this.drawFleet(state); this.drawPlaque(state); this.drawLog(state);
  }
  /** The ship on the cradle as far as she is built: the plans (a hologram), her frame, her plating in bare metal, her
   *  drive and glass, then finished in her colours. Once she is done, whichever ship is flown, in its paint. */
  buildShip(state) {
    const THREE = T(), Ph = (o) => new THREE.MeshPhongMaterial(o);
    if (this.model) { this.pivot.remove(this.model); this.model.traverse((o) => { o.geometry?.dispose(); }); }
    const done = this.done, id = done ? state.ship : YARD_SHIP, ship = SHIP_BY_ID[id] || SHIP_BY_ID[YARD_SHIP], stage = done ? 4 : this.stage, parts = playerParts(ship.id);
    const paint = done ? PAINT_BY_ID[state.paint] : null, painted = paint && paint.id !== 'factory', trim = painted ? paint.trim ?? ship.trim : ship.trim, hullC = painted ? paint.hull ?? 0x718996 : 0x718996;
    const M = { hull: Ph({ color: hullC, emissive: 0x0c1420, shininess: 30 }), deck: Ph({ color: 0xe2eced, emissive: 0x141a22, shininess: 40 }), dark: Ph({ color: 0x152735 }), glass: Ph({ color: 0x125875, emissive: 0x073345, shininess: 110, specular: 0xb8f5ff }),
      trim: Ph({ color: trim, emissive: new THREE.Color(trim).multiplyScalar(0.4) }), gold: Ph({ color: 0xffb94e, emissive: 0x583000 }), primer: Ph({ color: 0x8e9a93, emissive: 0x0e1210, shininess: 14 }) };
    const use = { hull: 'hull', deck: 'deck', cockpit: 'glass', chassis: 'dark', markings: 'gold', lights: 'trim', engine: 'trim' }, frame = new THREE.MeshBasicMaterial({ color: 0xc4d0e0, wireframe: true, transparent: true, opacity: 0.7 }); /* her frame: every member of the hull still open */
    const m = (this.model = new THREE.Group()); this.pivot.add(m); this.glows = [];
    for (const k of ['hull', 'deck', 'cockpit', 'chassis', 'markings', 'lights', 'engine']) {
      const geo = parts[k]; if (!geo) continue; const plated = k === 'hull' || k === 'deck';
      const solid = stage >= 3 || k === 'chassis' || (stage === 2 && plated);
      m.add(stage === 0 ? new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), this.holoMat) : new THREE.Mesh(geo, !solid ? frame : stage < 4 && plated ? M.primer : M[use[k]]));
    }
    // her engines, lit once the drive is in
    for (const [nx, ny] of NOZZLES[ship.id] || []) { const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.moteTex, color: trim, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); gl.position.set(nx, ny - 0.18, 0); gl.scale.setScalar(0.7); m.add(gl); this.glows.push(gl); }
    this.holoBeam.visible = stage === 0; this.plate.visible = !done; this.shipName = ship.name;
  }
  /** The signs over the bay doors: the yard's name on one side, the dock and what is in it on the other. */
  drawSign(state) {
    [['SHIPYARD', state.stationName ? `${state.stationName.toUpperCase()} · WE BUILD OUR OWN AGAIN` : 'WE BUILD OUR OWN AGAIN'], ['DRY DOCK 01', this.done ? `IN DOCK · ${this.shipName.toUpperCase()}` : 'HULL 01 · CHIMERA-CLASS']].forEach(([a, b], i) => {
      const c = canvas(768, 96); drawSign(c.getContext('2d'), a, b, '#fff0c8', '#ffc93c'); const m = this.signs[i].material; m.map?.dispose(); m.map = tex(c); m.needsUpdate = true;
    });
  }
  /** The plate on the front of the cradle: whose hull this is and how far on. */
  drawPlaque(state) {
    const c = canvas(768, 102), x = c.getContext('2d'); x.fillStyle = '#12100a'; x.fillRect(0, 0, 768, 102); x.strokeStyle = '#ffc93c'; x.lineWidth = 5; x.strokeRect(4, 4, 760, 94);
    text(x, this.done ? `IN DOCK · ${this.shipName.toUpperCase()}` : `CHIMERA · HULL 01 · STAGE ${this.stage}/${YARD_STAGES.length}`, 384, 52, '800 40px sans-serif', '#ffe9b0');
    const m = this.plaque.material; m.map?.dispose(); m.map = tex(c); m.needsUpdate = true;
  }
  /** The build console: the stages, which are built, what the next one costs and whether the yard can start it. */
  drawConsole(state) {
    const face = this.console.userData.face, x = face.material.map.image.getContext('2d'), n = nextStage(state), block = stageBlock(state);
    x.fillStyle = '#0b0f16'; x.fillRect(0, 0, 768, 480); x.strokeStyle = '#ffc93c'; x.lineWidth = 5; x.strokeRect(5, 5, 758, 470);
    text(x, 'DRY DOCK ONE', 32, 46, '800 36px sans-serif', '#fff0c8', 'left'); text(x, n ? `HULL 01 · STAGE ${this.stage}/${YARD_STAGES.length}` : 'COMMISSIONED', 736, 46, '800 22px sans-serif', '#ffc93c', 'right');
    YARD_STAGES.forEach((s, i) => {
      const y = 112 + i * 62, built = i < this.stage, next = i === this.stage;
      x.fillStyle = next ? 'rgba(255,201,60,.12)' : 'rgba(255,255,255,.03)'; x.fillRect(24, y - 26, 720, 52);
      text(x, built ? '✓' : next ? '›' : '·', 52, y, '800 30px sans-serif', built ? '#6dff8e' : next ? '#ffc93c' : '#4a5060');
      text(x, s.name.toUpperCase(), 86, y, '800 27px sans-serif', built ? '#bfe9cc' : next ? '#fff0c8' : '#5a6070', 'left');
      text(x, built ? 'BUILT' : next ? 'NEXT' : '', 728, y, '800 21px sans-serif', built ? '#6dff8e' : '#ffc93c', 'right');
    });
    if (n) {
      const cost = [`${fmt(n.cost.salvage)} SALVAGE`, n.cost.cores ? `${n.cost.cores} ALIEN CORES` : '', n.cost.bp ? `${n.cost.bp} BLUEPRINTS` : ''].filter(Boolean).join(' · ');
      text(x, cost, 384, 384, '800 25px sans-serif', block ? '#ff9f43' : '#6dff8e');
      text(x, block ? `SHORT OF ${{ salvage: 'SALVAGE', cores: 'ALIEN CORES', bp: 'BLUEPRINTS' }[block] || 'SOMETHING'}` : 'READY TO BUILD · TAP HER', 384, 430, '700 22px sans-serif', block ? '#a88060' : '#bfe9cc');
    } else text(x, `IN DOCK: ${this.shipName.toUpperCase()}`, 384, 404, '800 30px sans-serif', '#6dff8e');
    face.material.map.needsUpdate = true;
  }
  /** Her blueprint: the ship drawn large on the grid, and what she carries. */
  drawBlueprint() {
    if (this.blueDrawn) return; this.blueDrawn = true;
    const t = this.blueprint.userData.face.material.map, x = t.image.getContext('2d'), ship = SHIP_BY_ID[YARD_SHIP];
    x.fillStyle = '#0d2446'; x.fillRect(0, 0, 1024, 640); x.strokeStyle = 'rgba(159,200,255,.13)'; x.lineWidth = 1;
    for (let i = 0; i <= 1024; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 640); x.stroke(); } for (let j = 0; j <= 640; j += 32) { x.beginPath(); x.moveTo(0, j); x.lineTo(1024, j); x.stroke(); }
    x.strokeStyle = '#9fc8ff'; x.lineWidth = 4; x.strokeRect(10, 10, 1004, 620);
    text(x, `${ship.name.toUpperCase()}-CLASS · HULL 01`, 40, 58, '800 40px sans-serif', '#e6f1ff', 'left'); text(x, `${ship.role.toUpperCase()} · BUILT ABOARD`, 40, 100, '700 22px sans-serif', '#9fc8ff', 'left');
    x.strokeStyle = 'rgba(159,200,255,.6)'; x.lineWidth = 2; x.setLineDash([8, 6]); x.strokeRect(96, 140, 400, 440); x.setLineDash([]);
    text(x, '14.6 M', 296, 604, '700 18px monospace', '#9fc8ff'); text(x, '12.3 M', 60, 360, '700 18px monospace', '#9fc8ff');
    [['WEAPON', 'Plasma Mortar'], ['ABILITY', 'Black Hole'], ['TRAIT', ship.passive.name], ['SIGNATURE', ship.signature.name]].forEach(([k, v], i) => {
      text(x, k, 560, 186 + i * 104, '700 21px sans-serif', '#9fc8ff', 'left'); text(x, v.toUpperCase(), 560, 222 + i * 104, '800 34px sans-serif', '#e6f1ff', 'left');
    });
    t.needsUpdate = true; drawArt('ship:' + YARD_SHIP, x, 106, 160, 380, () => { t.needsUpdate = true; });
  }
  /** The fleet board: every ship, whether it is in the hangar (and its mastery), the one flown, the one in the yard. */
  drawFleet(state) {
    const t = this.fleet.userData.face.material.map, x = t.image.getContext('2d'), own = SHIPS.filter((s) => state.unlocked.ships[s.id]).length;
    x.fillStyle = '#0b0f16'; x.fillRect(0, 0, 1024, 640); x.strokeStyle = '#7fb2ff'; x.lineWidth = 5; x.strokeRect(6, 6, 1012, 628);
    text(x, 'THE FLEET', 36, 54, '800 40px sans-serif', '#e6f1ff', 'left'); text(x, `${own}/${SHIPS.length} IN THE HANGAR`, 988, 54, '800 24px sans-serif', '#7fb2ff', 'right');
    SHIPS.forEach((s, i) => {
      const cx = 180 + (i % 3) * 332, cy = 214 + Math.floor(i / 3) * 236, owned = !!state.unlocked.ships[s.id], fly = owned && state.ship === s.id, out = (state.fleet?.out || []).find((o) => o?.ship === s.id), hurt = owned && !out && state.fleet?.damage?.[s.id];
      x.fillStyle = fly ? 'rgba(109,255,142,.12)' : 'rgba(255,255,255,.035)'; x.fillRect(cx - 152, cy - 110, 304, 222);
      if (owned || s.yard) drawArt('ship:' + s.id, x, cx - 62, cy - 100, 124, () => { t.needsUpdate = true; }); else text(x, '?', cx, cy - 36, '800 96px sans-serif', '#323a4c');
      text(x, owned || s.yard ? s.name.toUpperCase() : 'UNKNOWN', cx, cy + 50, '800 28px sans-serif', owned ? '#e6f1ff' : s.yard ? '#fff0c8' : '#4a5264');
      text(x, fly ? 'FLYING' : out ? `AWAY · ${(DEST_BY_ID[out.dest]?.name || '').toUpperCase()}` : hurt ? 'DAMAGED · NEEDS REPAIR' : owned ? `MASTERY ${state.mastery?.[s.id]?.level || 1}` : s.yard ? `IN THE YARD · ${this.stage}/${YARD_STAGES.length}` : 'NOT YET', cx, cy + 86, '800 21px sans-serif', fly ? '#6dff8e' : out ? '#6dffc8' : hurt ? '#ff9a7a' : owned ? '#7fb2ff' : s.yard ? '#ffc93c' : '#3a4254');
    });
    t.needsUpdate = true;
  }
  /** The build log: her four stages and the day each was built (the last, the day she was commissioned). */
  drawLog(state) {
    const x = this.log.userData.face.material.map.image.getContext('2d'), at = state.shipyard?.at || [], day = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
    x.fillStyle = '#0b0f16'; x.fillRect(0, 0, 1024, 512); x.strokeStyle = '#ffc93c'; x.lineWidth = 5; x.strokeRect(6, 6, 1012, 500);
    text(x, 'BUILD LOG · HULL 01', 40, 58, '800 40px sans-serif', '#fff0c8', 'left'); text(x, this.done ? 'COMMISSIONED' : `${this.stage}/${YARD_STAGES.length} STAGES`, 984, 58, '800 24px sans-serif', '#ffc93c', 'right');
    YARD_STAGES.forEach((s, i) => { const y = 150 + i * 90, built = i < this.stage;
      x.fillStyle = built ? 'rgba(109,255,142,.07)' : 'rgba(255,255,255,.025)'; x.fillRect(28, y - 36, 968, 72);
      text(x, built ? '✓' : '·', 64, y, '800 34px sans-serif', built ? '#6dff8e' : '#4a5060'); text(x, (i === YARD_STAGES.length - 1 && built ? 'Commissioned' : s.name).toUpperCase(), 104, y, '800 30px sans-serif', built ? '#e8f5ec' : '#5a6070', 'left');
      text(x, built ? (at[i] ? day(at[i]) : 'BUILT') : '—', 972, y, '800 26px sans-serif', built ? '#6dff8e' : '#4a5060', 'right'); });
    this.log.userData.face.material.map.needsUpdate = true;
  }
  /** A stage just built: sparks all over her and the lights flare; when she is finished she lifts off the cradle. */
  flourish(final) {
    for (let k = 0; k < 18; k++) this.emit(CRADLE.x + (Math.random() - 0.5) * 3.6, 0.6 + Math.random() * 3.2, CRADLE.z - 0.2 + (Math.random() - 0.5) * 1.6, 7, 2.8);
    this.flareT = 1; if (final) this.liftT = 0;
  }
  emit(x, y, z, n, speed) {
    const P = this.sparks.p;
    for (let k = 0; k < n; k++) { const s = P[this.sparks.i++ % P.length], a = Math.random() * Math.PI * 2, u = Math.random(); s.x = x; s.y = y; s.z = z; s.vx = Math.cos(a) * speed * u; s.vz = Math.sin(a) * speed * u; s.vy = speed * (0.2 + Math.random() * 0.9); s.life = 0.35 + Math.random() * 0.55; }
  }
  // ---------------------------------------------------------------- every frame
  update(dt) {
    this.walk(dt); const t = this.t, v = (this._v ||= new (T().Vector3)()), working = !this.done && this.stage > 0;
    // the plans flicker; the engines glow once her drive is in, bright when she is done
    if (this.stage === 0 && !this.done) { this.holoMat.opacity = 0.38 + 0.14 * Math.sin(t * 3) - (Math.random() < 0.03 ? 0.25 : 0); this.holoBeam.material.opacity = 0.04 + 0.02 * Math.sin(t * 2); }
    for (const [i, g] of (this.glows || []).entries()) g.material.opacity = this.done ? 0.7 + 0.2 * Math.sin(t * 13 + i * 2) : this.stage >= 3 ? 0.28 + 0.06 * Math.sin(t * 5 + i) : 0;
    // the welders work while she is being built (sparks where they touch), and stand back once she is done
    for (const a of this.welders) {
      const rest = this.done || this.stage === 0;
      a.yaw.rotation.y = a.face + (rest ? 0 : Math.sin(t * 0.5 + a.ph) * 0.35); a.sh.rotation.z += ((rest ? 0.5 : -0.42 + Math.sin(t * 0.7 + a.ph) * 0.1) - a.sh.rotation.z) * Math.min(1, dt * 2); a.el.rotation.z += ((rest ? -1.4 : -0.5 + Math.sin(t * 0.9 + a.ph * 2) * 0.14) - a.el.rotation.z) * Math.min(1, dt * 2);
      const on = working && Math.sin(t * 1.3 + a.ph) > -0.2; a.glow.visible = on && Math.random() > 0.2; if (on && Math.random() < dt * 30) { a.tip.getWorldPosition(v); this.emit(v.x, v.y, v.z, 2, 1.6); }
    }
    // the crane works back and forth in front of her with a plate while there is plating to hang
    this.crane.position.z = -8.6 + Math.sin(t * 0.09) * 1; this.trolley.position.x = Math.sin(t * 0.13) * 1.7;
    const drop = 1.5 + Math.sin(t * 0.21) * 0.25; this.cable.scale.y = drop; this.cable.position.y = -0.41 - drop / 2; this.load.position.y = -0.41 - drop; this.load.rotation.y = Math.sin(t * 0.3) * 0.2;
    // she lifts off the cradle when she is commissioned, and hovers there
    if (this.liftT != null && this.liftT < 99) this.liftT += dt; const k = this.done ? Math.min(1, (this.liftT ?? 99) / 2.4) : 0, ease = k * k * (3 - 2 * k);
    this.pivot.position.y = SHIP_Y + ease * 0.35 + Math.sin(t * 1.1) * 0.04 * ease; this.pivot.rotation.z = Math.sin(t * 0.7) * 0.015 * ease;
    if (this.flareT > 0) { this.flareT = Math.max(0, this.flareT - dt * 0.8); this.lamps[1].intensity = 0.5 + this.flareT * 2.2; }
    // sparks fall, bounce once off the cradle and die
    const P = this.sparks.p, pa = this.sparks.geo.attributes.position;
    for (let i = 0; i < P.length; i++) {
      const s = P[i]; if (s.life <= 0) { pa.setXYZ(i, 0, -99, 0); continue; }
      s.life -= dt; s.vy -= 9.8 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; const floor = Math.abs(s.x - CRADLE.x) < 2.3 && Math.abs(s.z - CRADLE.z) < 3.5 ? 0.31 : 0.01;
      if (s.y < floor) { s.y = floor; s.vy *= -0.3; s.vx *= 0.5; s.vz *= 0.5; } pa.setXYZ(i, s.x, s.y, s.z);
    }
    pa.needsUpdate = true;
    // outside: the force field scans, the slipway lights chase out, the beacons blink, the tug potters round the frame
    this.fieldTex.offset.y = (t * 0.06) % 1;
    for (const { l, i } of this.slipLights) l.material.color.setHex(Math.floor(t * 6 - i) % 13 === 0 ? 0xffffff : YELLOW);
    for (const b of this.beacons) b.material.opacity = Math.sin(t * 2.4) > 0.3 ? 1 : 0.15;
    const ta = t * 0.08; this.tug.position.set(Math.sin(ta) * 9, 3.6 + Math.sin(ta * 2.3) * 0.8, FRONT - 18 + Math.cos(ta) * 6); this.tug.rotation.set(-Math.PI / 2, 0, Math.atan2(Math.cos(ta) * 9, -Math.sin(ta) * 6) + Math.PI);
    const u = this.earth.material.uniforms; if (u) { u.time.value = t + 1100; u.night.value = nightAmount(); u.sun.value.copy(this.sunDir).transformDirection(this.cam.matrixWorldInverse); }
  }
}
