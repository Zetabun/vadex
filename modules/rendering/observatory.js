// The Observatory: the glass dome beneath the hub, the sixth room aboard to walk around (rendering/room.js). It opens
// with the dome, at Overhaul rank 6. No ceiling: the dome, ribbed in brass, is open to the stars, and in its sky hang the
// constellations of the Deep Void (data/observatory.js), one for each depth charted, gold once charted, a faint pulse
// where a depth reached waits to be. The telescope in the middle turns to track them. The chart on the left wall lists
// every depth, what it pays and whether it is charted; the orrery on the right rings the sectors out to the Void, a light
// on your deepest. Through the window, the Void itself. Doors lead back to your quarters and out to the hangar, and
// (once it is back) on through to the Shipyard.
import { Room, canvas, tex, text } from '@last-orbit/rendering/room.js';
import { VOID_MARKS, voidSector } from '@last-orbit/data/observatory.js';
import { isCharted } from '@last-orbit/progression/observatory.js';
import { PAINT_BY_ID } from '@last-orbit/data/career.js';
import { YARD_RANK } from '@last-orbit/data/shipyard.js';
const T = () => window.THREE;

// Room: x -4..4, z -6 (window) .. 3 (back wall, the doors), walls 3 high, the dome over the middle.
const W = 4, FRONT = -6, BACK = 3, H = 3, DOME = { z: -1.5, r: 3.9 }, SKY = 480, TEL = { x: 0, z: -2.2 };
const BRASS = 0xd9a441, CYAN = 0x9ff0ff;
/** A point in the dome's sky: azimuth (0 ahead, towards the window; positive to the right) and height, in degrees. */
function sky(az, h, r = SKY) { const THREE = T(), a = (az * Math.PI) / 180, e = (h * Math.PI) / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(e) * r, H + Math.sin(e) * r, DOME.z - Math.cos(a) * Math.cos(e) * r); }
/** The middle of a constellation, as [azimuth, height] in degrees (its stars' directions averaged, each star once). */
function centre(m) {
  const THREE = T(), seen = new Set(), v = new THREE.Vector3(), o = new THREE.Vector3(0, H, DOME.z);
  for (const [az, h] of m.stars) { if (seen.has(az + ',' + h)) continue; seen.add(az + ',' + h); v.add(sky(az, h, 1).sub(o)); }
  v.normalize(); return [(Math.atan2(v.x, -v.z) * 180) / Math.PI, (Math.asin(v.y) * 180) / Math.PI];
}

export class ObservatoryRoom extends Room {
  constructor() {
    super({ w: W, front: FRONT, back: BACK, h: H, start: [0, 1.6, 0] });
    this.shell({ open: true, floor: '#141626', wall: '#22243a', stud: '#4a4020', tick: 'rgba(217,164,65,.22)', strip: BRASS, cove: 0x7a5cff, frame: 0x34364e, rib: 0x2c2e46,
      lamp: 0xc8d0ff, lampI: 0.3, hemi: 0.34, sky: 0xb8c0ff, sun: 0.35, window: { hw: 3, y0: 0.6, y1: 2.5, struts: [-1, 1] }, lamps: [-4.2, -1.2, 1.8], ribs: [-5.4, 2.4] });
    this.nearFront = 0.9;
    this.roof(); this.furnish(); this.outside();
    this.solids.push({ x: TEL.x, z: TEL.z, r: 1.1 }, { x: 2.6, z: -3.9, r: 0.95 });
    this.bakeStatic(); /* still parts merged into fewer draw calls (room.js) */
  }
  // ---------------------------------------------------------------- the dome
  roof() {
    const THREE = T(), S = this.scene, brass = new THREE.MeshPhongMaterial({ color: BRASS, emissive: 0x2a1c06, specular: 0xfff0c0, shininess: 70 });
    // a ceiling ring from the walls to the dome's rim
    const sh = new THREE.Shape(); sh.moveTo(-W, FRONT); sh.lineTo(W, FRONT); sh.lineTo(W, BACK); sh.lineTo(-W, BACK); sh.lineTo(-W, FRONT);
    const hole = new THREE.Path(); hole.absarc(0, DOME.z, DOME.r, 0, Math.PI * 2, false); sh.holes.push(hole);
    const ring = new THREE.Mesh(new THREE.ShapeGeometry(sh, 48), new THREE.MeshPhongMaterial({ color: 0x1c1e30, shininess: 10, side: THREE.DoubleSide })); ring.rotation.x = Math.PI / 2; ring.position.y = H; S.add(ring);
    // the glass, faintly there, and its brass ribs: meridians over the top and two rings round it
    const glass = new THREE.Mesh(new THREE.SphereGeometry(DOME.r, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0x9fb4ff, transparent: true, opacity: 0.07, specular: 0xffffff, shininess: 120, side: THREE.BackSide, depthWrite: false }));
    glass.position.set(0, H, DOME.z); S.add(glass);
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(DOME.r, 0.035, 6, 64, Math.PI), brass); m.position.set(0, H, DOME.z); m.rotation.y = (i / 6) * Math.PI; S.add(m); }
    for (const [k, t] of [[0, 0.07], [0.5, 0.04]]) { const y = Math.sin(k) * DOME.r, r = Math.cos(k) * DOME.r, m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 72), brass); m.rotation.x = Math.PI / 2; m.position.set(0, H + y, DOME.z); S.add(m); }
    // the stars through it, and the constellations (drawn in sync)
    const n = 1400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = sky(Math.random() * 360 - 180, Math.asin(Math.random()) * 57.3 - 4); pos.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); S.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false })));
    const sc = canvas(32, 32), sx = sc.getContext('2d'), sg = sx.createRadialGradient(16, 16, 0, 16, 16, 16); sg.addColorStop(0, 'rgba(255,255,255,1)'); sg.addColorStop(0.3, 'rgba(255,255,255,.6)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 32, 32);
    this.starTex = tex(sc); this.skyGroup = new THREE.Group(); S.add(this.skyGroup);
  }
  // ---------------------------------------------------------------- the room
  furnish() {
    const THREE = T(), S = this.scene, Ph = (o) => new THREE.MeshPhongMaterial(o), add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const metal = Ph({ color: 0x3a3c56, specular: 0x7a7ca0, shininess: 50 }), brass = Ph({ color: BRASS, emissive: 0x2a1c06, specular: 0xfff0c0, shininess: 70 }), dark = Ph({ color: 0x14151f, shininess: 30 });
    // the telescope: a pedestal, a fork, the tube tilted up at the dome, an eyepiece at its foot
    const tel = new THREE.Group(); tel.position.set(TEL.x, 0, TEL.z); S.add(tel);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 1.1, 24), metal); ped.position.y = 0.55; tel.add(ped);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 8, 32), brass); band.rotation.x = Math.PI / 2; band.position.y = 1.02; tel.add(band);
    this.telYaw = new THREE.Group(); this.telYaw.position.y = 1.15; tel.add(this.telYaw);
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.2), metal); arm.position.set(s * 0.4, 0.3, 0); this.telYaw.add(arm);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 24), brass); hub.rotation.z = Math.PI / 2; hub.position.set(s * 0.465, 0.5, 0); this.telYaw.add(hub); } /* the bearings the tube turns in */
    this.telPitch = new THREE.Group(); this.telPitch.position.y = 0.5; this.telYaw.add(this.telPitch);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 2.6, 28), Ph({ color: 0xe8e2d4, specular: 0xffffff, shininess: 60 })); tube.rotation.x = Math.PI / 2; tube.position.z = -0.5; this.telPitch.add(tube);
    for (const z of [-1.75, 0.7]) { const r = new THREE.Mesh(new THREE.TorusGeometry(z < 0 ? 0.27 : 0.33, 0.04, 8, 28), brass); r.position.z = z; this.telPitch.add(r); }
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.25, 28), new THREE.MeshBasicMaterial({ color: 0x1a3a6a })); lens.position.z = -1.81; lens.rotation.y = Math.PI; this.telPitch.add(lens);
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 12), dark); eye.rotation.x = Math.PI / 2; eye.position.set(0, 0.2, 0.9); this.telPitch.add(eye);
    this.hitBox(tel, 1.6, 3.2, 1.6, 0, 1.6, 0); this.tag(tel, 'telescope');
    // a brass ring set in the floor round it
    const fl = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.28, 64), new THREE.MeshBasicMaterial({ color: BRASS })); fl.rotation.x = -Math.PI / 2; fl.position.set(TEL.x, 0.012, TEL.z); S.add(fl);
    // the chart on the left wall
    this.chart = this.screen(S, canvas(1024, 720), 2.6, 1.83, -W + 0.03, 1.55, 0.55, Math.PI / 2, 0x1c1e2a); /* back by the doors, clear of the telescope */ this.tag(this.chart, 'chart');
    // the orrery on the right: rings for the sectors and the Void beyond, a light on the deepest you have flown
    const orr = new THREE.Group(); orr.position.set(2.6, 0, -3.9); S.add(orr);
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.9, 24), metal); tb.position.y = 0.45; orr.add(tb);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 32), dark); top.position.y = 0.93; orr.add(top);
    this.orrery = new THREE.Group(); this.orrery.position.y = 1.2; orr.add(this.orrery);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: 0x5ea8ff })); this.orrery.add(earth);
    this.orbits = [];
    for (let i = 0; i < 9; i++) { const r = 0.14 + i * 0.07, m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 4, 64), new THREE.MeshBasicMaterial({ color: i < 6 ? 0x5ee6ff : 0xb69cff, transparent: true, opacity: 0.5, ...add })); m.rotation.x = Math.PI / 2; this.orrery.add(m); this.orbits.push(m); }
    this.deepest = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a })); this.orrery.add(this.deepest);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.4, 0.7, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xb69cff, opacity: 0.05, side: THREE.DoubleSide, ...add })); beam.position.y = 1.25; orr.add(beam);
    this.hitBox(orr, 1.6, 2, 1.6, 0, 1, 0); this.tag(orr, 'orrery');
    // the doors, on the back wall
    this.door(S, 2.2, BACK, 0, 'HANGAR  ›', 'exit', { sign: '#fff0c8', edge: BRASS });
    this.door(S, -2.2, BACK, 0, 'QUARTERS  ›', 'quarters', { sign: '#ffe2c4', edge: 0xffb070 });
  }
  /** Through the window: the Deep Void, violet and teal, a far spiral turning. */
  outside() {
    const THREE = T(), S = this.scene, add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const neb = (w, h, stops, x, y, z) => { const c = canvas(256, 256), cx = c.getContext('2d'), gr = cx.createRadialGradient(128, 128, 0, 128, 128, 128); stops.forEach(([k, s]) => gr.addColorStop(k, s)); cx.fillStyle = gr; cx.fillRect(0, 0, 256, 256); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(c), ...add })); m.position.set(x, y, z); S.add(m); return m; };
    neb(1400, 900, [[0, 'rgba(140,70,220,.55)'], [0.5, 'rgba(70,30,120,.22)'], [1, 'rgba(0,0,0,0)']], -200, 60, -1100);
    neb(1000, 700, [[0, 'rgba(60,200,200,.35)'], [0.6, 'rgba(20,80,110,.14)'], [1, 'rgba(0,0,0,0)']], 320, -60, -1000);
    const gc = canvas(256, 256), gx = gc.getContext('2d'); gx.translate(128, 128);
    for (let i = 0; i < 900; i++) { const t = i / 900, arm = i % 2 ? Math.PI : 0, a = t * 9 + arm, r = t * 118; gx.fillStyle = `rgba(${220 - t * 80},${200 - t * 40},255,${0.9 - t * 0.7})`; gx.fillRect(Math.cos(a) * r + (Math.random() - 0.5) * 8, Math.sin(a) * r * 0.55 + (Math.random() - 0.5) * 6, 2, 2); }
    const gg = gx.createRadialGradient(0, 0, 0, 0, 0, 30); gg.addColorStop(0, 'rgba(255,240,220,.9)'); gg.addColorStop(1, 'rgba(255,240,220,0)'); gx.fillStyle = gg; gx.fillRect(-30, -30, 60, 60);
    this.galaxy = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.MeshBasicMaterial({ map: tex(gc), ...add })); this.galaxy.position.set(120, 40, -900); S.add(this.galaxy);
    this.tag(this.hitBox(S, 6, 1.9, 0.1, 0, 1.55, FRONT + 0.12), 'window');
  }
  // ---------------------------------------------------------------- what is on display
  sync(state) {
    const best = state.stats.bestWave || 0, yard = (state.prestige?.level || 0) >= YARD_RANK, sig = [best, VOID_MARKS.map((m) => (isCharted(state, m) ? 2 : best >= m.wave ? 1 : 0)).join(''), yard].join('|');
    if (sig === this.sig) return; const was = this.charted || {}; this.sig = sig; this.best = best;
    // the way through to the Shipyard, on the right wall by the doors
    if (this.yardDoor) { this.scene.remove(this.yardDoor); this.untag(this.yardDoor); } this.yardDoor = new (T().Group)(); this.scene.add(this.yardDoor);
    this.door(this.yardDoor, W, 0.6, Math.PI / 2, 'SHIPYARD  ›', 'yard', { sealed: !yard, sign: '#fff0c8', edge: 0xffc93c });
    this.charted = Object.fromEntries(VOID_MARKS.map((m) => [m.wave, isCharted(state, m)]));
    // a depth charted just now draws itself in
    for (const m of VOID_MARKS) if (this.charted[m.wave] && this.built && !was[m.wave]) { this.flash = { wave: m.wave, t: 0 }; this.aim = m; }
    this.drawSky(state); this.drawChart(state); this.built = true;
    // the orrery: the rings you have reached lit, the light on your deepest
    const ring = best > 60 ? Math.min(8, 6 + Math.floor((best - 61) / 10) + 1) : Math.max(0, Math.ceil(best / 10) - 1); this.markRing = ring;
    this.orbits.forEach((o, i) => { o.material.opacity = i <= ring ? 0.75 : 0.12; });
    // the telescope turns to the latest charted (or the next waiting)
    this.aim ||= [...VOID_MARKS].reverse().find((m) => this.charted[m.wave]) || VOID_MARKS.find((m) => best >= m.wave) || VOID_MARKS[0];
  }
  /** The constellations: gold and named once charted, a faint pulse where a depth waits to be, the rest barely there. */
  drawSky(state) {
    const THREE = T(); while (this.skyGroup.children.length) this.skyGroup.remove(this.skyGroup.children[0]); this.lines = [];
    const best = state.stats.bestWave || 0;
    for (const m of VOID_MARKS) {
      const done = this.charted[m.wave], ready = !done && best >= m.wave, pts = m.stars.map(([a, hh]) => sky(a, hh, SKY - 20));
      for (const p of pts) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.starTex, color: done ? 0xffe2a0 : ready ? CYAN : 0x8890b0, transparent: true, opacity: done ? 1 : ready ? 0.9 : 0.4, blending: THREE.AdditiveBlending, depthWrite: false })); s.position.copy(p); s.scale.setScalar(done ? 16 : 11); this.skyGroup.add(s); }
      if (done || ready) {
        const g = new THREE.BufferGeometry().setFromPoints(pts), line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: done ? 0xffc857 : CYAN, transparent: true, opacity: done ? 0.85 : 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.skyGroup.add(line); this.lines.push({ line, wave: m.wave, done, ready, n: pts.length });
      }
      if (done) { const c = canvas(512, 96), x = c.getContext('2d'); text(x, m.name.toUpperCase(), 256, 48, '800 44px sans-serif', '#ffe2a0');
        const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, opacity: 0.85, depthWrite: false })); const mid = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length); lab.position.copy(mid).add(new THREE.Vector3(0, -26, 0)); lab.scale.set(120, 22, 1); this.skyGroup.add(lab); }
    }
  }
  /** The chart on the wall: every depth, what it pays, charted or waiting or still to reach. */
  drawChart(state) {
    const face = this.chart.userData.face, c = face.material.map.image, x = c.getContext('2d'), best = state.stats.bestWave || 0;
    x.fillStyle = '#090a14'; x.fillRect(0, 0, 1024, 720); x.strokeStyle = '#d9a441'; x.lineWidth = 5; x.strokeRect(6, 6, 1012, 708);
    text(x, 'CHART OF THE DEEP VOID', 36, 48, '800 40px sans-serif', '#fff0c8', 'left'); text(x, best > 60 ? `DEEPEST: WAVE ${best}` : 'NOT YET PAST WAVE 60', 988, 48, '700 24px sans-serif', '#d9a441', 'right');
    VOID_MARKS.forEach((m, i) => {
      const y = 98 + i * 77, done = this.charted[m.wave], ready = !done && best >= m.wave;
      x.fillStyle = ready ? 'rgba(159,240,255,.1)' : done ? 'rgba(255,200,87,.07)' : 'rgba(255,255,255,.02)'; x.fillRect(24, y, 976, 71);
      text(x, `VOID ${voidSector(m.wave)}`, 44, y + 36, '800 24px sans-serif', done ? '#d9a441' : ready ? '#9ff0ff' : '#4a4e6a', 'left');
      text(x, m.name, 172, y + 25, '800 34px sans-serif', done ? '#fff0c8' : ready ? '#e0fbff' : '#6a6e8a', 'left');
      text(x, `wave ${m.wave} · +${m.bp} Blueprints` + (m.paint ? ` · ${PAINT_BY_ID[m.paint]?.name} paint` : ''), 172, y + 56, '600 23px sans-serif', done ? '#b89a60' : '#6a6e8a', 'left');
      text(x, done ? 'CHARTED' : ready ? 'READY TO CHART' : best > 60 || i === 0 ? `${Math.max(0, m.wave - best)} WAVES ON` : 'BEYOND WAVE 60', 976, y + 36, '800 24px sans-serif', done ? '#ffc857' : ready ? '#9ff0ff' : '#4a4e6a', 'right');
    });
    face.material.map.needsUpdate = true;
  }
  /** Turn the view up to a depth's constellation (just charted: it draws itself in). */
  showMark(wave) { const m = VOID_MARKS.find((x) => x.wave === wave); if (!m) return; const [a, hh] = centre(m); this.lookTo = { yaw: (-a * Math.PI) / 180, pitch: Math.min(0.75, (hh * Math.PI) / 180), t: 0 }; this.aim = m; }
  // ---------------------------------------------------------------- every frame
  update(dt) {
    this.walk(dt); const t = this.t;
    if (this.lookTo) { const L = this.lookTo; L.t += dt; let d = L.yaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); const k = Math.min(1, dt * 3); this.yaw += d * k; this.pitch += (L.pitch - this.pitch) * k; if (L.t > 1.6) this.lookTo = null; }
    // the telescope tracks its constellation, drifting a little as if following it across the sky
    if (this.aim) { if (this.aimAt?.m !== this.aim) this.aimAt = { m: this.aim, at: centre(this.aim) }; const [a, hh] = this.aimAt.at, wantYaw = (-a * Math.PI) / 180 + Math.sin(t * 0.07) * 0.03, wantPitch = (hh * Math.PI) / 180 * 0.85;
      this.telYaw.rotation.y += (wantYaw - this.telYaw.rotation.y) * Math.min(1, t > 0.5 ? 0.02 : 1); this.telPitch.rotation.x += (wantPitch - this.telPitch.rotation.x) * 0.02; }
    // stars waiting to be charted pulse; one just charted draws itself in, gold
    for (const l of this.lines || []) {
      if (l.ready) l.line.material.opacity = 0.18 + 0.2 * (0.5 + 0.5 * Math.sin(t * 2.4));
      if (this.flash?.wave === l.wave) { this.flash.t += dt; const k = Math.min(1, this.flash.t / 2.2); l.line.geometry.setDrawRange(0, Math.max(2, Math.ceil(l.n * k))); l.line.material.opacity = 0.4 + 0.5 * k; if (k >= 1) this.flash = null; }
    }
    this.orrery.rotation.y = t * 0.25; const rr = 0.14 + (this.markRing || 0) * 0.07; this.deepest.position.set(Math.cos(t * 0.8) * rr, 0, Math.sin(t * 0.8) * rr);
    this.galaxy.rotation.z = t * 0.01;
  }
}
