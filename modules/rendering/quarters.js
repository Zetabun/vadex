// The Pilot's quarters: your own room aboard, in the Outer ring, the fifth room to walk around (rendering/room.js). It
// opens with the ring, at Overhaul rank 5. Your bunk under the window, the Earth beyond it and your name over it (rest
// in it once a day and the next sortie banks more salvage); the keepsakes you have picked up on a cabinet on the left
// wall, each turning on its stand on a lit shelf (the ones still to find are dim shapes); your desk on the right with the pilot's log on the
// wall over it and a recruitment poster beside; photos of the big moments pinned up between the doors; a switch for the
// lights' mood; and Bolt, the maintenance drone that follows you round. A door by the back leads down to the
// Observatory once it is back. Tapping anything names it.
import { Room, canvas, tex, drawArt, text } from '@last-orbit/rendering/room.js';
import { earthMaterial, nightAmount } from '@last-orbit/rendering/background.js';
import { KEEPSAKES, PHOTOS, MOOD_BY_ID } from '@last-orbit/data/quarters.js';
import { rankTitle } from '@last-orbit/data/career.js';
import { OBSERVATORY_RANK } from '@last-orbit/data/observatory.js';
const T = () => window.THREE;

// Room: x -3..3, z -4.8 (window) .. 2.4 (back wall, the doors), height 2.9. Small: it is a cabin.
const W = 3, FRONT = -4.8, BACK = 2.4, H = 2.9;
const BUNK = { x0: -1.7, x1: 0.55, d: 0.95 }, SHELF = { z: -1.45, w: 2 }, DESK = { z: -2.75 };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
/** Where the keepsakes stand along a shelf, four to a shelf. */
const keepX = (col) => -SHELF.w / 2 + 0.28 + col * ((SHELF.w - 0.56) / 3);
/** A keepsake, built small from simple shapes (about 0.2 across), standing on its base at y 0. */
function keepsake(shape, mat, glow) {
  const THREE = T(), g = new THREE.Group(), M = (geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, m = mat) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  switch (shape) {
    case 'coin': M(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 24), 0, 0.09, 0, Math.PI / 2 - 0.25); break;
    case 'plate': M(new THREE.BoxGeometry(0.22, 0.15, 0.02), 0, 0.085, 0, -0.25, 0.3, 0.12); M(new THREE.BoxGeometry(0.06, 0.05, 0.022), 0.05, 0.1, 0.004, -0.25, 0.3, 0.12, glow); break;
    case 'fang': M(new THREE.ConeGeometry(0.045, 0.24, 8), 0, 0.12, 0, 0, 0, 0.22); break;
    case 'pin': M(new THREE.CylinderGeometry(0.007, 0.012, 0.1, 6), 0, 0.05, -0.012); for (const s of [-1, 1]) M(new THREE.BoxGeometry(0.1, 0.03, 0.012), s * 0.06, 0.11, 0, 0, 0, s * -0.18); M(new THREE.SphereGeometry(0.03, 12, 8), 0, 0.11, 0.004, 0, 0, 0, glow); break;
    case 'gem': M(new THREE.OctahedronGeometry(0.085), 0, 0.1, 0, 0, 0.5, 0.2); M(new THREE.OctahedronGeometry(0.045), 0.08, 0.05, 0.03, 0.4, 0, 0); break;
    case 'gear': { const o = M(new THREE.TorusGeometry(0.068, 0.022, 6, 18), 0, 0.105, 0); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; M(new THREE.BoxGeometry(0.032, 0.032, 0.03), Math.cos(a) * 0.094, 0.105 + Math.sin(a) * 0.094, 0, 0, 0, a); } o.rotation.x = 0; break; }
    case 'jar': M(new THREE.CylinderGeometry(0.07, 0.07, 0.19, 18, 1, true), 0, 0.1, 0, 0, 0, 0, new THREE.MeshPhongMaterial({ color: 0xcfefff, transparent: true, opacity: 0.25, shininess: 120, side: THREE.DoubleSide, depthWrite: false })); M(new THREE.SphereGeometry(0.04, 14, 10), 0, 0.1, 0, 0, 0, 0, glow); M(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 18), 0, 0.2, 0); break;
    case 'drop': { const d = M(new THREE.SphereGeometry(0.07, 16, 12), 0, 0.09, 0, 0, 0, 0.3); d.scale.set(1, 1.35, 0.85); M(new THREE.SphereGeometry(0.018, 8, 6), 0.01, 0.1, 0.035, 0, 0, 0, glow); break; }
    case 'roll': M(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 14), 0, 0.04, 0, 0, 0, Math.PI / 2); M(new THREE.CylinderGeometry(0.038, 0.038, 0.03, 14), 0, 0.04, 0, 0, 0, Math.PI / 2, glow); break;
    case 'casing': M(new THREE.CylinderGeometry(0.035, 0.038, 0.17, 14), 0, 0.085, 0); M(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 14), 0, 0.01, 0); break;
    case 'shard': { const a = M(new THREE.OctahedronGeometry(0.06), 0, 0.13, 0, 0, 0.3, 0.12); a.scale.set(0.8, 2.2, 0.8); M(new THREE.SphereGeometry(0.03, 10, 8), 0, 0.13, 0, 0, 0, 0, glow); break; }
    case 'compass': M(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 24), 0, 0.09, 0, Math.PI / 2 - 0.35); M(new THREE.BoxGeometry(0.012, 0.11, 0.01), 0, 0.09, 0.02, -0.35, 0, 0.6, glow); break;
    default: M(new THREE.BoxGeometry(0.12, 0.12, 0.12), 0, 0.06, 0);
  }
  return g;
}

export class QuartersRoom extends Room {
  constructor() {
    super({ w: W, front: FRONT, back: BACK, h: H, start: [0, 1.3, 0] });
    this.shell({ floor: '#211c1a', wall: '#2e2a30', ceil: '#221e22', stud: '#5a4430', tick: 'rgba(255,176,112,.18)', strip: 0xffb070, cove: 0xffb070, frame: 0x3e3834, rib: 0x35302c,
      lamp: 0xffd2a0, lampI: 0.5, panel: 0xfff0dc, panelW: 1.2, hemi: 0.5, sky: 0xffe8d0, sun: 0.5,
      window: { hw: 2.2, y0: 0.8, y1: 2.4, struts: [-0.75, 0.75] }, lamps: [-3.3, -0.9, 1.4], ribs: [-4.35, -0.1] }); /* clear of the poster and the Observatory door */
    this.nearFront = 0.8;
    this.furnish(); this.outside(); this.bolt = this.makeBolt();
    this.blocks.push({ x0: BUNK.x0 - 0.1, x1: BUNK.x1 + 0.1, z0: FRONT, z1: FRONT + BUNK.d + 0.2 }, { x0: -W, x1: -W + 0.6, z0: SHELF.z - SHELF.w / 2 - 0.05, z1: SHELF.z + SHELF.w / 2 + 0.05 }, { x0: W - 0.85, x1: W, z0: DESK.z - 0.85, z1: DESK.z + 0.85 });
    this.bakeStatic(); /* still parts merged into fewer draw calls (room.js) */
  }
  // ---------------------------------------------------------------- the room
  furnish() {
    const THREE = T(), S = this.scene, Ph = (o) => new THREE.MeshPhongMaterial(o);
    const wood = Ph({ color: 0x6a4a36, specular: 0x3a2a20, shininess: 25 }), metal = Ph({ color: 0x3a3a44, specular: 0x6a6a7a, shininess: 40 }), dark = Ph({ color: 0x1a1a22, shininess: 20 });
    const box = (w, h, d, x, y, z, m, parent = S) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); parent.add(b); return b; };
    // the bunk, under the window: frame, mattress, blanket, pillow; a reading lamp clamped to the sill over its head,
    // your name over the window
    const bl = BUNK.x1 - BUNK.x0, bx = (BUNK.x0 + BUNK.x1) / 2, bz = FRONT + 0.18 + BUNK.d / 2, bunk = new THREE.Group(); S.add(bunk);
    const sheet = Ph({ color: 0xe8e2d8, shininess: 10 }), bc = canvas(128, 32), bk = bc.getContext('2d'); bk.fillStyle = '#3a5a8a'; bk.fillRect(0, 0, 128, 32); bk.fillStyle = '#7090c0'; for (const u of [98, 108]) bk.fillRect(u, 0, 4, 32); /* two stripes near the foot */
    box(bl, 0.32, BUNK.d, bx, 0.2, bz, wood, bunk); box(bl - 0.06, 0.14, BUNK.d - 0.04, bx, 0.43, bz, sheet, bunk);
    this.blanket = box(bl * 0.62, 0.08, BUNK.d + 0.02, bx + bl * 0.19, 0.52, bz, Ph({ map: tex(bc), shininess: 8 }), bunk);
    box(0.16, 0.03, BUNK.d + 0.03, bx - bl * 0.12 + 0.08, 0.575, bz, sheet, bunk); /* the sheet turned down over it */
    const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12), Ph({ color: 0xf2eee6, shininess: 8 })); pillow.scale.set(0.38, 0.13, 0.62); pillow.position.set(BUNK.x0 + 0.3, 0.555, bz); bunk.add(pillow);
    for (const x of [BUNK.x0 - 0.03, BUNK.x1 + 0.03]) box(0.06, 0.7, BUNK.d, x, 0.35, bz, wood, bunk);
    const rl = new THREE.Group(); rl.position.set(BUNK.x0 + 0.25, 0.79, FRONT + 0.05); bunk.add(rl); box(0.1, 0.03, 0.1, 0, 0.015, 0, metal, rl);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.3, 6), metal); neck.position.set(0, 0.165, 0.07); neck.rotation.x = 0.48; rl.add(neck);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.12, 18, 1, true), Ph({ color: 0x4a4550, specular: 0x9a8a7a, shininess: 60, side: THREE.DoubleSide })); shade.position.set(0, 0.266, 0.181); shade.rotation.x = -0.75; rl.add(shade);
    this.readLamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2b0 })); this.readLamp.position.set(0, 0.237, 0.208); rl.add(this.readLamp);
    const gc = canvas(64, 64), gx = gc.getContext('2d'), gg = gx.createRadialGradient(32, 32, 0, 32, 32, 32); gg.addColorStop(0, 'rgba(255,220,170,.9)'); gg.addColorStop(1, 'rgba(255,200,140,0)'); gx.fillStyle = gg; gx.fillRect(0, 0, 64, 64);
    this.readGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(gc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.readGlow.scale.setScalar(0.3); this.readGlow.position.copy(this.readLamp.position); rl.add(this.readGlow);
    this.namePlate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.32), new THREE.MeshBasicMaterial({ transparent: true })); this.namePlate.position.set(0, 2.63, FRONT + 0.17); S.add(this.namePlate);
    this.hitBox(bunk, bl + 0.2, 1, BUNK.d + 0.2, bx, 0.5, bz); this.tag(bunk, 'bunk');
    // the keepsake cabinet on the left wall: three lit shelves, four places on each
    const cab = new THREE.Group(); cab.position.set(-W, 0, SHELF.z); cab.rotation.y = Math.PI / 2; S.add(cab); /* its +z faces into the room */
    box(SHELF.w, 1.66, 0.04, 0, 0.83, 0.02, dark, cab); this.shelfLights = [];
    for (const y of [0.1, 0.62, 1.14, 1.66]) { box(SHELF.w + 0.06, 0.04, 0.46, 0, y, 0.23, wood, cab); if (y < 1.5) this.shelfLights.push(box(SHELF.w - 0.1, 0.012, 0.02, 0, y + 0.47, 0.42, new THREE.MeshBasicMaterial({ color: 0xffb070 }), cab)); } /* a light under each shelf over a row */
    for (const s of [-1, 1]) box(0.05, 1.68, 0.46, s * (SHELF.w / 2 + 0.02), 0.84, 0.23, wood, cab);
    const stand = Ph({ color: 0x2a2630, specular: 0x6a5a4a, shininess: 50 });
    for (let i = 0; i < KEEPSAKES.length; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.05, 20), stand); p.position.set(keepX(i % 4), 1.14 - Math.floor(i / 4) * 0.52 + 0.045, 0.24); cab.add(p); } /* a stand under each keepsake */
    this.cabinet = cab; this.hitBox(cab, SHELF.w + 0.1, 2, 0.6, 0, 1, 0.3); this.tag(cab, 'shelf');
    // the desk on the right wall, a chair, the pilot's log on the wall over it, a poster by the doors
    const desk = new THREE.Group(); desk.position.set(W, 0, DESK.z); desk.rotation.y = -Math.PI / 2; S.add(desk);
    box(1.5, 0.05, 0.7, 0, 0.76, 0.35, wood, desk); for (const [x, z] of [[-0.7, 0.05], [0.7, 0.05], [-0.7, 0.66], [0.7, 0.66]]) box(0.05, 0.74, 0.05, x, 0.37, z, metal, desk);
    const cup = Ph({ color: 0xd9dee8, shininess: 60 }), mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.1, 16), cup); mug.position.set(0.45, 0.835, 0.42); desk.add(mug); /* a mug */
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.007, 6, 14), cup); handle.position.set(0.495, 0.838, 0.42); desk.add(handle);
    const chair = new THREE.Group(); chair.position.set(0, 0, 1.0); desk.add(chair); box(0.46, 0.05, 0.46, 0, 0.46, 0, metal, chair); box(0.46, 0.5, 0.05, 0, 0.72, 0.22, metal, chair); box(0.05, 0.44, 0.05, 0, 0.22, 0, metal, chair);
    this.logScreen = this.screen(desk, canvas(512, 300), 1.2, 0.7, 0, 1.55, 0.02, 0, 0x1a1a22); this.logCanvas = this.logScreen.userData.face.material.map.image;
    this.hitBox(desk, 1.6, 2.1, 1.5, 0, 1, 0.6); this.tag(desk, 'log');
    this.poster = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.0), new THREE.MeshBasicMaterial({ color: 0xffffff })); this.poster.position.set(W - 0.02, 1.62, -0.75); this.poster.rotation.y = -Math.PI / 2; S.add(this.poster); this.tag(this.poster, 'poster');
    // the photos, pinned up between the doors (drawn in sync), and the mood switch by the left door
    this.photoGroup = new THREE.Group(); this.photoGroup.position.set(0, 1.62, BACK - 0.03); this.photoGroup.rotation.y = Math.PI; S.add(this.photoGroup);
    this.hitBox(this.photoGroup, 1.4, 1.15, 0.1, 0, 0, 0); this.tag(this.photoGroup, 'photos');
    const sw = new THREE.Group(); sw.position.set(-W + 0.02, 1.25, 0.7); sw.rotation.y = Math.PI / 2; S.add(sw);
    this.switchFace = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.46), new THREE.MeshBasicMaterial({ color: 0xffffff })); sw.add(this.switchFace); box(0.38, 0.5, 0.02, 0, 0, -0.012, metal, sw);
    this.hitBox(sw, 0.6, 0.7, 0.2, 0, 0, 0); this.tag(sw, 'mood');
    // a rug, and a plant in the corner by the window
    const rc = canvas(256, 256), rx = rc.getContext('2d'); rx.fillStyle = '#4a3444'; rx.fillRect(0, 0, 256, 256);
    for (const [r, c, w] of [[123, '#2e2030', 10], [110, '#8a5a44', 5], [96, '#5e3e50', 12], [78, '#b08a5a', 3], [64, '#3a2838', 10], [44, '#8a5a44', 6], [26, '#5e3e50', 14], [8, '#b08a5a', 8]]) { rx.strokeStyle = c; rx.lineWidth = w; rx.beginPath(); rx.arc(128, 128, r, 0, Math.PI * 2); rx.stroke(); }
    for (let i = 0; i < 1800; i++) { rx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,230,200' : '0,0,0'},${Math.random() * 0.09})`; rx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } /* the weave */
    this.rug = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), Ph({ map: tex(rc), shininess: 5 })); this.rug.rotation.x = -Math.PI / 2; this.rug.position.set(0, 0.012, -1.6); S.add(this.rug);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.44, 16), Ph({ color: 0xd9dee8, shininess: 40 })); pot.position.set(W - 0.45, 0.22, FRONT + 0.5); S.add(pot);
    const leaf = Ph({ color: 0x3f9a56, specular: 0x224422, shininess: 10, side: THREE.DoubleSide });
    for (let i = 0; i < 11; i++) { const lf = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.8, 5), leaf), a = (i / 11) * Math.PI * 2; lf.position.set(W - 0.45 + Math.cos(a) * 0.1, 0.78, FRONT + 0.5 + Math.sin(a) * 0.1); lf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); S.add(lf); }
    // the doors, on the back wall
    this.door(S, 1.95, BACK, 0, 'HANGAR  ›', 'exit', { sign: '#ffe2c4', edge: 0xffb070 });
    this.door(S, -1.95, BACK, 0, 'TROPHY HALL  ›', 'hall', { sign: '#ffe2b0', edge: 0xffc857 });
  }
  /** Bolt: a little round drone with a ring round its middle and one eye, following you about. */
  makeBolt() {
    const THREE = T(), g = new THREE.Group(); g.position.set(0.35, 1.42, -0.3); this.scene.add(g);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), new THREE.MeshPhongMaterial({ color: 0xdfe4ee, specular: 0xffffff, shininess: 80 })); g.add(body);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 28), new THREE.MeshPhongMaterial({ color: 0xffb070, shininess: 60 })); band.rotation.x = Math.PI / 2; g.add(band);
    this.boltEye = new THREE.Mesh(new THREE.CircleGeometry(0.055, 20), new THREE.MeshBasicMaterial({ color: 0x5ee6ff })); this.boltEye.position.z = -0.128; this.boltEye.rotation.y = Math.PI; g.add(this.boltEye);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), new THREE.MeshPhongMaterial({ color: 0x8890a0 })); ant.position.y = 0.18; g.add(ant);
    this.boltTip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4d6a })); this.boltTip.position.y = 0.245; g.add(this.boltTip);
    this.hitBox(g, 0.5, 0.5, 0.5, 0, 0, 0); this.tag(g, 'bolt'); this.boltV = new THREE.Vector3(); this.spin = 0; return g;
  }
  /** Tapped: Bolt spins round, happily. */
  poke() { this.spin = 1; }
  /** A night in the bunk: the lights go down and come back up. */
  sleep() { this.sleepT = 2.4; }
  /** Earth below the window, the stars. */
  outside() {
    const THREE = T(), S = this.scene;
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(600, 96, 64), earthMaterial()); this.earth.position.set(-60, -560, -720); this.earth.rotation.x = 1.2; S.add(this.earth);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(622, 64, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN, vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN, vV; void main(){ float k = pow(1. - abs(dot(vN, vV)), 3.5); gl_FragColor = vec4(vec3(.3, .6, 1.) * k * 1.4, k); }' }));
    atmo.position.copy(this.earth.position); S.add(atmo); this.sunDir = new THREE.Vector3(-0.5, 0.6, 0.5).normalize();
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); pos.set([Math.cos(a) * r * 1800, Math.abs(u) * 1800 - 100, -Math.abs(Math.sin(a) * r) * 1800 - 250], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); S.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })));
    this.tag(this.hitBox(S, 4.4, 1.3, 0.1, 0, 1.85, FRONT + 0.12), 'window'); /* above the bunk: the bunk takes taps below */
  }
  // ---------------------------------------------------------------- what is on display (rebuilt when it changes)
  sync(state) {
    const earned = KEEPSAKES.map((k) => (k.req(state) ? 1 : 0)).join(''), photos = PHOTOS.map((p) => (p.req(state) ? 1 : 0)).join(''), q = state.quarters || {};
    const sig = [earned, photos, q.mood, state.pilot.name, state.pilot.rank, state.ship, state.stats.bestWave, state.prestige?.level || 0].join('|');
    if (sig === this.sig) return; this.sig = sig; const THREE = T();
    this.setMood(MOOD_BY_ID[q.mood] || MOOD_BY_ID.warm);
    // the keepsakes
    if (this.pieces) this.cabinet.remove(this.pieces); this.pieces = new THREE.Group(); this.cabinet.add(this.pieces);
    const dim = new THREE.MeshBasicMaterial({ color: 0x3a3440, transparent: true, opacity: 0.55 });
    KEEPSAKES.forEach((k, i) => {
      const row = Math.floor(i / 4), col = i % 4, has = k.req(state), col3 = new THREE.Color(k.color);
      const mat = has ? new THREE.MeshPhongMaterial({ color: col3, emissive: col3.clone().multiplyScalar(0.2), specular: 0xffffff, shininess: 80 }) : dim, glow = has ? new THREE.MeshBasicMaterial({ color: col3.clone().lerp(new THREE.Color(0xffffff), 0.3) }) : dim;
      const o = keepsake(k.shape, mat, glow); o.position.set(keepX(col), 1.14 - row * 0.52 + 0.07, 0.24); /* on its stand */ o.scale.setScalar(1.25); o.userData.spin = i * 0.9; o.userData.has = has; this.pieces.add(o);
    });
    // the name over the bunk
    const nc = canvas(640, 136), nx = nc.getContext('2d'), name = state.pilot.name || rankTitle(state.pilot.rank);
    nx.fillStyle = '#16100c'; nx.fillRect(0, 0, 640, 136); nx.strokeStyle = '#c89a5a'; nx.lineWidth = 6; nx.strokeRect(6, 6, 628, 124);
    text(nx, name.toUpperCase(), 320, 60, `800 ${name.length > 12 ? 44 : 56}px sans-serif`, '#ffe2c4'); text(nx, `${rankTitle(state.pilot.rank).toUpperCase()} · RANK ${state.pilot.rank}`, 320, 108, '700 22px sans-serif', '#c89a5a');
    this.namePlate.material.map?.dispose(); this.namePlate.material.map = tex(nc); this.namePlate.material.needsUpdate = true; /* over the window */
    this.drawLog(state); this.drawPhotos(state); this.drawPoster(state);
    // the way down to the Observatory, on the right wall by the doors
    if (this.obsDoor) { this.scene.remove(this.obsDoor); this.untag(this.obsDoor); } this.obsDoor = new THREE.Group(); this.scene.add(this.obsDoor);
    this.door(this.obsDoor, W, 1.15, Math.PI / 2, 'OBSERVATORY  ›', 'observatory', { sealed: (state.prestige?.level || 0) < OBSERVATORY_RANK, sign: '#fff0c8', edge: 0xd9a441 });
  }
  /** Set the lights to a mood: the lamps, the strips, the cove, the shelf lights, the rug. */
  setMood(m) {
    this.mood = m; for (const l of this.lamps) { l.color.setHex(m.lamp); l.intensity = m.lampI; } this.hemi.intensity = m.hemi;
    this.stripMat.color.setHex(m.strip); this.coveMat.color.setHex(m.cove); this.lightMat.color.setHex(m.panel ?? 0xfff0dc); for (const l of this.shelfLights) l.material.color.setHex(m.strip);
    const c = canvas(136, 184), x = c.getContext('2d'); x.fillStyle = '#12100e'; x.fillRect(0, 0, 136, 184); x.strokeStyle = hex(m.strip); x.lineWidth = 5; x.strokeRect(4, 4, 128, 176);
    x.fillStyle = hex(m.strip); x.beginPath(); x.arc(68, 70, 30, 0, Math.PI * 2); x.fill(); text(x, 'LIGHTS', 68, 130, '800 20px sans-serif', '#d8d0c8'); text(x, m.name.toUpperCase(), 68, 158, '800 22px sans-serif', hex(m.strip));
    this.switchFace.material.map?.dispose(); this.switchFace.material.map = tex(c); this.switchFace.material.needsUpdate = true;
  }
  /** The pilot's log on the wall over the desk: the latest entries. */
  drawLog(state) {
    const x = this.logCanvas.getContext('2d'), got = KEEPSAKES.filter((k) => k.req(state));
    x.fillStyle = '#0e0c0a'; x.fillRect(0, 0, 512, 300); x.strokeStyle = '#ffb070'; x.lineWidth = 4; x.strokeRect(4, 4, 504, 292);
    text(x, "PILOT'S LOG", 24, 34, '800 30px sans-serif', '#ffe2c4', 'left'); text(x, `${got.length}/${KEEPSAKES.length} ENTRIES`, 488, 34, '700 18px sans-serif', '#c89a5a', 'right');
    let y = 78; x.font = '500 17px sans-serif'; x.fillStyle = '#e8dccc'; x.textAlign = 'left'; x.textBaseline = 'middle';
    for (const k of got.slice(-3).reverse()) { for (const line of wrap(x, '“' + k.log + '”', 460).slice(0, 3)) { x.fillText(line, 26, y); y += 22; } y += 10; if (y > 280) break; }
    if (!got.length) text(x, 'Nothing written yet.', 256, 160, '500 italic 20px sans-serif', '#8a7a6a');
    this.logScreen.userData.face.material.map.needsUpdate = true;
  }
  /** The photos: a polaroid for every big moment reached, a bare pin where one is still to come. */
  drawPhotos(state) {
    const THREE = T(); while (this.photoGroup.children.length > 1) this.photoGroup.remove(this.photoGroup.children[1]);
    PHOTOS.forEach((p, i) => {
      const col = i % 3, row = Math.floor(i / 3), px = (col - 1) * 0.44, py = row ? -0.28 : 0.28, tilt = ((i * 7919) % 11 - 5) * 0.012;
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: [0xff4d6a, 0x5ee6ff, 0xffc857][i % 3] })); pin.position.set(px, py + 0.21, 0.02); this.photoGroup.add(pin);
      if (!p.req(state)) return;
      const c = canvas(220, 260), x = c.getContext('2d'); x.fillStyle = '#f4efe6'; x.fillRect(0, 0, 220, 260);
      const g = x.createLinearGradient(0, 14, 0, 196); g.addColorStop(0, '#1a2a4a'); g.addColorStop(1, '#0a1020'); x.fillStyle = g; x.fillRect(14, 14, 192, 182);
      for (let s = 0; s < 30; s++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.7})`; x.fillRect(14 + Math.random() * 192, 14 + Math.random() * 182, 2, 2); }
      text(x, p.caption(state), 110, 228, 'italic 700 22px Georgia, serif', '#2a2420');
      const t = tex(c), photo = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.45), new THREE.MeshBasicMaterial({ map: t })); photo.position.set(px, py, 0.01); photo.rotation.z = tilt; this.photoGroup.add(photo);
      drawArt(p.art(state), x, 46, 40, 128, () => { t.needsUpdate = true; });
    });
  }
  /** The recruitment poster by the window: your ship. */
  drawPoster(state) {
    const c = canvas(288, 400), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, '#3a1a2a'); g.addColorStop(1, '#10121e'); x.fillStyle = g; x.fillRect(0, 0, 288, 400);
    x.strokeStyle = '#ffb070'; x.lineWidth = 6; x.strokeRect(8, 8, 272, 384); text(x, 'LAST ORBIT', 144, 50, '800 36px sans-serif', '#ffe2c4'); text(x, 'THE STATION NEEDS PILOTS', 144, 350, '800 16px sans-serif', '#ffb070');
    const t = tex(c); this.poster.material.map?.dispose(); this.poster.material.map = t; this.poster.material.needsUpdate = true;
    drawArt('ship:' + (state.ship || 'vanguard'), x, 64, 90, 160, () => { t.needsUpdate = true; });
  }
  // ---------------------------------------------------------------- every frame
  update(dt) {
    this.walk(dt); const t = this.t, THREE = T();
    const u = this.earth.material.uniforms; u.time.value = this.t + 900; u.night.value = nightAmount(); u.sun.value.copy(this.sunDir).transformDirection(this.cam.matrixWorldInverse); this.earth.rotation.y = this.t * 0.002;
    // the keepsakes turn slowly on their shelf; the ones still to find stay put
    for (const o of this.pieces?.children || []) if (o.userData.has) o.rotation.y = Math.sin(t * 0.5 + o.userData.spin) * 0.6;
    // a night in the bunk: the lights go down, then come back up
    if (this.sleepT > 0) { this.sleepT = Math.max(0, this.sleepT - dt); const k = Math.sin((1 - this.sleepT / 2.4) * Math.PI); for (const l of this.lamps) l.intensity = this.mood.lampI * (1 - k * 0.92); this.hemi.intensity = this.mood.hemi * (1 - k * 0.85); this.lightMat.color.setHex(this.mood.panel ?? 0xfff0dc).multiplyScalar(1 - k * 0.88); this.readLamp.visible = this.readGlow.visible = k < 0.5; }
    // Bolt keeps near you: ahead and off to one side, bobbing; it turns to look at you
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), want = new THREE.Vector3(this.pos.x + fx * 2 - fz * 0.62, 1.5 + Math.sin(t * 1.7) * 0.06, this.pos.z + fz * 2 + fx * 0.62); /* at the edge of your view, peeking in */
    want.x = Math.max(-W + 0.4, Math.min(W - 0.4, want.x)); want.z = Math.max(FRONT + 0.5, Math.min(BACK - 0.5, want.z));
    this.boltV.lerp(want.sub(this.bolt.position).multiplyScalar(1.6), Math.min(1, dt * 2)); this.bolt.position.addScaledVector(this.boltV, dt);
    this.bolt.lookAt(this.cam.position.x, this.bolt.position.y, this.cam.position.z); this.bolt.rotateY(Math.PI); if (this.spin > 0) { this.spin = Math.max(0, this.spin - dt * 0.9); this.bolt.rotateY((1 - this.spin) * Math.PI * 4); }
    this.boltTip.visible = Math.sin(t * 3) > 0; this.boltEye.scale.y = Math.sin(t * 0.7) > 0.97 ? 0.15 : 1; // it blinks
  }
}
/** Lines of text that fit a width. */
function wrap(ctx, str, w) { const out = []; let line = ''; for (const word of str.split(' ')) { const t = line ? line + ' ' + word : word; if (ctx.measureText(t).width > w && line) { out.push(line); line = word; } else line = t; } if (line) out.push(line); return out; }
