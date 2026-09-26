// The Beacon array: the signal room at the station's tip, under the great beacon, the eighth room aboard to walk around
// (rendering/room.js). It opens with the beacons, at Overhaul rank 8. The great lamp in the middle, a crystal lens in a
// brass cage, sweeps its beam out through the window into the Void, where the beacons have started getting answers: the
// Void bosses (data/beacons.js). Six hologram pedestals stand down the walls, one for each: static until it answers, a
// flickering outline once you have met it, solid in its own colour once you have beaten it (and then a light of its
// colour out in the Void). The signal log between the doors keeps the record. Doors lead back to the Shipyard and out
// to the hangar. Tapping anything names it (the UI shows the details).
import { Room, canvas, tex, text, drawSign } from '@last-orbit/rendering/room.js';
import { shapeGeometry } from '@last-orbit/rendering/geometry.js';
import { BOSSES } from '@last-orbit/data/bosses.js';
import { VOID_BOSSES, firstWaveOf } from '@last-orbit/data/beacons.js';
import { CIPHER_RANK } from '@last-orbit/data/cipher.js';
const T = () => window.THREE;

// Room: x -4.2..4.2, z -8 (window) .. 3 (back wall, the doors), height 4.2.
const W = 4.2, FRONT = -8, BACK = 3, H = 4.2, LAMP = { x: 0, z: -4.4 }, GOLD = 0xffe2a0, VIOLET = 0xb69cff;
/** Where the Void bosses' pedestals stand: down both walls in the order they answer, first by the window. */
export const answerAt = (i) => ({ x: (i % 2 ? 1 : -1) * 3.05, z: [-6.3, -3.9, -1.5][Math.floor(i / 2)] });
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export class BeaconRoom extends Room {
  constructor() {
    super({ w: W, front: FRONT, back: BACK, h: H, start: [0, 1.7, 0] });
    this.shell({ floor: '#15141f', wall: '#24223a', ceil: '#1a1828', stud: '#5a4a24', tick: 'rgba(255,226,160,.2)', strip: GOLD, cove: VIOLET, frame: 0x363452, rib: 0x2e2c46,
      lamp: 0xffe8c8, lampI: 0.34, panel: 0xfff0d8, panelW: 1.6, hemi: 0.4, sky: 0xd8ccff, sun: 0.4,
      window: { hw: 3.4, y0: 0.55, y1: 3.7, struts: [-1.15, 1.15] }, lamps: [-6.6, -1.9, 1.6], ribs: [-7.3, -0.2, 2.4] });
    this.nearFront = 0.9;
    this.furnish(); this.outside();
    this.solids.push({ ...LAMP, r: 1.45 }); for (let i = 0; i < VOID_BOSSES.length; i++) { const a = answerAt(i); this.solids.push({ x: a.x, z: a.z, r: 0.8 }); }
    this.bakeStatic(); /* still parts merged into fewer draw calls (room.js) */
  }
  // ---------------------------------------------------------------- the room
  furnish() {
    const THREE = T(), S = this.scene, Ph = (o) => new THREE.MeshPhongMaterial(o), add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const metal = Ph({ color: 0x2e2c44, specular: 0x6a6a9a, shininess: 45 }), brass = Ph({ color: 0xd9a441, emissive: 0x2a1c06, specular: 0xfff0c0, shininess: 70 });
    const mc = canvas(32, 32), mx = mc.getContext('2d'), mg = mx.createRadialGradient(16, 16, 0, 16, 16, 16); mg.addColorStop(0, 'rgba(255,255,255,1)'); mg.addColorStop(0.35, 'rgba(255,255,255,.5)'); mg.addColorStop(1, 'rgba(255,255,255,0)'); mx.fillStyle = mg; mx.fillRect(0, 0, 32, 32);
    this.moteTex = tex(mc);
    // the great lamp: a base, a brass cage with a dome, the crystal lens turning inside it and its glow
    const lamp = new THREE.Group(); lamp.position.set(LAMP.x, 0, LAMP.z); S.add(lamp);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 0.9, 32), metal); base.position.y = 0.45; lamp.add(base);
    for (const y of [0.9, 2.2, 3.4]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.88, y === 0.9 ? 0.06 : 0.04, 8, 48), brass); r.rotation.x = Math.PI / 2; r.position.y = y; lamp.add(r); }
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.5, 8), brass); rod.position.set(Math.cos(a) * 0.88, 2.15, Math.sin(a) * 0.88); lamp.add(rod); }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), brass); dome.position.y = 3.4; lamp.add(dome);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 12), brass); tip.position.y = 4.0; lamp.add(tip);
    this.lens = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), Ph({ color: 0xfff6e0, emissive: 0x7a5a28, specular: 0xffffff, shininess: 120, transparent: true, opacity: 0.88 })); this.lens.position.y = 2.2; lamp.add(this.lens);
    this.core = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.moteTex, color: 0xfff0c8, ...add })); this.core.position.y = 2.2; this.core.scale.setScalar(1.9); lamp.add(this.core);
    // its beam, sweeping out through the window
    const bc = canvas(4, 128), bx = bc.getContext('2d'), bg = bx.createLinearGradient(0, 128, 0, 0); bg.addColorStop(0, 'rgba(255,255,255,1)'); bg.addColorStop(0.25, 'rgba(255,255,255,.45)'); bg.addColorStop(1, 'rgba(255,255,255,0)'); bx.fillStyle = bg; bx.fillRect(0, 0, 4, 128);
    this.sweep = new THREE.Group(); this.sweep.position.y = 2.2; lamp.add(this.sweep);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 0.28, 30, 24, 1, true), new THREE.MeshBasicMaterial({ map: tex(bc), color: 0xfff0c8, opacity: 0.4, side: THREE.DoubleSide, ...add }));
    this.beam.rotation.x = -Math.PI / 2; this.beam.position.z = -15; this.sweep.add(this.beam); /* narrow at the lens, wide out in the Void */
    const fl = new THREE.Mesh(new THREE.RingGeometry(1.34, 1.42, 64), new THREE.MeshBasicMaterial({ color: GOLD })); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.012; lamp.add(fl);
    this.hitBox(lamp, 2.4, 4.2, 2.4, 0, 2.1, 0); this.tag(lamp, 'beacon');
    // the answers: a hologram pedestal for each Void boss, its name over it (drawn in sync)
    this.answers = [];
    const nc = canvas(64, 64), nx = nc.getContext('2d'); for (let i = 0; i < 420; i++) { nx.fillStyle = `rgba(200,200,230,${Math.random() * 0.8})`; nx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
    this.noiseTex = tex(nc);
    VOID_BOSSES.forEach((id, i) => {
      const { x, z } = answerAt(i), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; S.add(g); /* its +z faces the aisle */
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.8, 8), metal); ped.position.y = 0.4; ped.rotation.y = Math.PI / 8; g.add(ped);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 28), new THREE.MeshBasicMaterial({ color: 0x3a3450 })); disc.position.y = 0.82; g.add(disc);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.32, 1.5, 28, 1, true), new THREE.MeshBasicMaterial({ color: VIOLET, opacity: 0.05, side: THREE.DoubleSide, ...add })); beam.position.y = 1.58; g.add(beam);
      const holder = new THREE.Group(); holder.position.y = 1.6; g.add(holder);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.3), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })); label.position.set(0, 2.62, 0.1); g.add(label);
      this.hitBox(g, 1.3, 3, 1.3, 0, 1.5, 0); this.tag(g, 'answer' + (i + 1));
      this.answers.push({ id, g, disc, beam, holder, label, state: -1 });
    });
    // the signal log on the back wall, between the doors
    this.log = this.screen(S, canvas(1024, 560), 2.3, 1.26, -0.15, 1.95, BACK - 0.03, Math.PI, 0x201e30); this.tag(this.log, 'log');
    // the sign over the window (named in sync), and the doors
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), new THREE.MeshBasicMaterial({ transparent: true })); this.sign.position.set(0, 3.95, FRONT + 0.17); S.add(this.sign);
    this.door(S, 2.4, BACK, 0, 'HANGAR  ›', 'exit', { sign: '#fff0c8', edge: GOLD });
    this.door(S, -2.4, BACK, 0, 'SHIPYARD  ›', 'yard', { sign: '#fff0c8', edge: 0xffc93c });
  }
  /** Beyond the window: the Void, the station's other beacons blinking along its arms, and a light for every Void boss
   *  beaten, out where it answered from. */
  outside() {
    const THREE = T(), S = this.scene, add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const n = 1100, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); pos.set([Math.cos(a) * r * 1600, u * 1600, -Math.abs(Math.sin(a) * r) * 1600 - 200], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); S.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.9, sizeAttenuation: false })));
    const neb = (w, h, stops, x, y, z) => { const c = canvas(256, 256), cx = c.getContext('2d'), gr = cx.createRadialGradient(128, 128, 0, 128, 128, 128); stops.forEach(([k, s]) => gr.addColorStop(k, s)); cx.fillStyle = gr; cx.fillRect(0, 0, 256, 256); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(c), ...add })); m.position.set(x, y, z); S.add(m); };
    neb(1500, 900, [[0, 'rgba(110,60,200,.45)'], [0.55, 'rgba(50,25,110,.18)'], [1, 'rgba(0,0,0,0)']], 160, 120, -1200); neb(900, 700, [[0, 'rgba(60,160,190,.28)'], [0.6, 'rgba(20,60,90,.1)'], [1, 'rgba(0,0,0,0)']], -300, -80, -1000);
    // the station's arm running off to the left, its beacons down it
    const truss = new THREE.MeshPhongMaterial({ color: 0x5a6070, specular: 0x333a48, shininess: 20 }), arm = new THREE.Group(); arm.position.set(-6, -3, -12); arm.rotation.set(0.05, 0.9, 0); S.add(arm);
    for (const [y, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(80, 0.12, 0.12), truss); b.position.set(-40, y, z); arm.add(b); }
    for (let k = 0; k < 20; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.2), truss); b.position.set(-k * 4, 0, 0); b.rotation.x = k % 2 ? 0.8 : -0.8; arm.add(b); }
    const lc = canvas(64, 64), lx = lc.getContext('2d'), lg = lx.createRadialGradient(32, 32, 0, 32, 32, 32); lg.addColorStop(0, 'rgba(255,255,255,1)'); lg.addColorStop(0.3, 'rgba(255,220,150,.9)'); lg.addColorStop(1, 'rgba(255,200,120,0)'); lx.fillStyle = lg; lx.fillRect(0, 0, 64, 64);
    this.beacons = [];
    for (let k = 0; k < 4; k++) { const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(lc), ...add })); b.position.set(-10 - k * 20, 0.8, 0); b.scale.setScalar(2.2 + k * 0.6); arm.add(b); this.beacons.push(b); }
    // the answers' lights, out in the Void (shown in sync)
    this.far = VOID_BOSSES.map((id, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.moteTex, color: BOSSES[id].color, ...add })); s.position.set(-250 + i * 100, 70 + Math.sin(i * 1.7) * 70, -900); s.scale.setScalar(26); s.visible = false; S.add(s); return s; });
    this.tag(this.hitBox(S, 6.8, 3.15, 0.1, 0, 2.12, FRONT + 0.12), 'window');
  }
  // ---------------------------------------------------------------- what is on display (rebuilt when it changes)
  sync(state) {
    const beat = state.beacons?.beaten || {}, met = state.seen?.bosses || {}, by = state.stats?.bossBy || {};
    const crown = (state.prestige?.level || 0) >= CIPHER_RANK;
    const sig = [VOID_BOSSES.map((id) => (beat[id] ? 2 : met[id] ? 1 : 0) + ':' + (by[id] || 0)).join(','), state.stationName, crown].join('|');
    if (sig === this.sig) return; this.sig = sig; const THREE = T();
    // the way up into the crown, to the Cipher, on the left wall by the doors
    if (this.cipherDoor) { this.scene.remove(this.cipherDoor); this.untag(this.cipherDoor); } this.cipherDoor = new THREE.Group(); this.scene.add(this.cipherDoor);
    this.door(this.cipherDoor, -W, 1.2, -Math.PI / 2, 'THE CIPHER  ›', 'cipher', { sealed: !crown, sign: '#fff4dc', edge: 0x6dfff0 });
    this.answers.forEach((a, i) => {
      const def = BOSSES[a.id], s = beat[a.id] ? 2 : met[a.id] ? 1 : 0, col = new THREE.Color(def.color); a.state = s;
      while (a.holder.children.length) a.holder.remove(a.holder.children[0]);
      const geo = shapeGeometry(def.shape); geo.computeBoundingSphere(); const bs = geo.boundingSphere, k = 0.5 / Math.max(0.1, bs.radius), at = new THREE.Vector3(-bs.center.x * k, -bs.center.y * k, -bs.center.z * k);
      if (s === 2) { const m = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: col.clone().lerp(new THREE.Color(0x8890a0), 0.3), emissive: col.clone().multiplyScalar(0.3), specular: 0xffffff, shininess: 60 })); m.scale.setScalar(k); m.position.copy(at); a.holder.add(m); }
      else if (s === 1) { const m = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.setScalar(k); m.position.copy(at); a.holder.add(m); }
      else { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.noiseTex, color: 0x9a96c0, transparent: true, opacity: 0.35, depthWrite: false })); m.scale.setScalar(0.8); a.holder.add(m); }
      a.holder.rotation.x = -0.6; /* tipped towards the aisle, so its face shows */
      a.disc.material.color.copy(s ? col : new THREE.Color(0x3a3450)).multiplyScalar(s === 2 ? 1 : 0.5); a.beam.material.color.copy(s ? col : new THREE.Color(VIOLET));
      const c = canvas(640, 150), x = c.getContext('2d');
      text(x, s ? def.name.toUpperCase() : 'UNKNOWN SIGNAL', 320, 52, `800 ${s && def.name.length > 14 ? 44 : 50}px sans-serif`, s === 2 ? '#fff0c8' : s ? '#e0dcff' : '#7a76a0');
      text(x, s === 2 ? `BEATEN ×${by[a.id] || 1}` : s ? 'ANSWERED · STILL OUT THERE' : `WAITS AT WAVE ${firstWaveOf(a.id)}`, 320, 112, '800 30px sans-serif', s === 2 ? hex(def.color) : s ? '#b69cff' : '#5a5680');
      const lm = a.label.material; lm.map?.dispose(); lm.map = tex(c); lm.needsUpdate = true;
      this.far[i].visible = s === 2;
    });
    const sc = canvas(768, 96); drawSign(sc.getContext('2d'), 'BEACON ARRAY', `SIGNAL ROOM${state.stationName ? ' · ' + state.stationName.toUpperCase() : ''}`, '#fff0c8', '#c9b6ff');
    this.sign.material.map?.dispose(); this.sign.material.map = tex(sc); this.sign.material.needsUpdate = true;
    this.drawLog(state, beat, met, by);
  }
  /** The signal log: every Void boss, where it waits, whether it has answered and been beaten. */
  drawLog(state, beat, met, by) {
    const t = this.log.userData.face.material.map, x = t.image.getContext('2d'), got = VOID_BOSSES.filter((id) => beat[id]).length;
    x.fillStyle = '#0b0a14'; x.fillRect(0, 0, 1024, 560); x.strokeStyle = '#c9b6ff'; x.lineWidth = 5; x.strokeRect(6, 6, 1012, 548);
    text(x, 'SIGNAL LOG', 36, 52, '800 42px sans-serif', '#fff0c8', 'left'); text(x, `${got}/${VOID_BOSSES.length} BEATEN`, 988, 52, '800 26px sans-serif', '#c9b6ff', 'right');
    VOID_BOSSES.forEach((id, i) => {
      const y = 124 + i * 72, s = beat[id] ? 2 : met[id] ? 1 : 0, def = BOSSES[id];
      x.fillStyle = s === 2 ? 'rgba(182,156,255,.1)' : 'rgba(255,255,255,.03)'; x.fillRect(24, y - 30, 976, 60);
      x.fillStyle = s ? hex(def.color) : '#3a3650'; x.beginPath(); x.arc(58, y, 11, 0, Math.PI * 2); x.fill();
      text(x, s ? def.name : 'Unknown signal', 88, y, '800 30px sans-serif', s === 2 ? '#fff0c8' : s ? '#e0dcff' : '#6a6690', 'left');
      text(x, `WAVE ${firstWaveOf(id)}`, 640, y, '700 22px sans-serif', '#8a86b0', 'left');
      text(x, s === 2 ? `BEATEN ×${by[id] || 1}` : s ? 'ANSWERED' : '—', 976, y, '800 24px sans-serif', s === 2 ? '#c9b6ff' : s ? '#9a96c0' : '#4a4668', 'right');
    });
    t.needsUpdate = true;
  }
  // ---------------------------------------------------------------- every frame
  update(dt) {
    this.walk(dt); const t = this.t;
    // the lamp turns and breathes; its beam sweeps across the window
    this.lens.rotation.y = t * 0.5; this.lens.rotation.x = Math.sin(t * 0.3) * 0.2; this.core.material.opacity = 0.75 + 0.2 * Math.sin(t * 2.1);
    this.sweep.rotation.y = Math.sin(t * 0.3) * 0.62; this.beam.material.opacity = 0.34 + 0.06 * Math.sin(t * 3.3);
    // the answers: those beaten turn slowly, those met flicker, the rest are static
    for (const [i, a] of this.answers.entries()) {
      const m = a.holder.children[0]; if (!m) continue; a.holder.rotation.y = t * 0.4 + i; a.holder.position.y = 1.6 + Math.sin(t * 0.9 + i) * 0.04;
      if (a.state === 1) m.material.opacity = Math.sin(t * 13 + i) > 0.25 ? 0.65 : 0.25; else if (a.state === 0) { m.material.opacity = 0.2 + 0.2 * Math.random(); m.material.rotation = Math.random() * 6; }
      a.beam.material.opacity = a.state === 2 ? 0.08 + 0.03 * Math.sin(t * 2 + i) : 0.04;
    }
    // the other beacons blink in turn down the arm; the answers' lights pulse out in the Void
    for (const [k, b] of this.beacons.entries()) b.material.opacity = Math.sin(t * 2.2 - k * 0.9) > 0.4 ? 1 : 0.18;
    for (const [i, s] of this.far.entries()) if (s.visible) s.material.opacity = 0.5 + 0.35 * Math.sin(t * 1.3 + i * 2);
  }
}
