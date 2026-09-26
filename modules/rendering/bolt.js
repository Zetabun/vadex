// Bolt, in 3D: the maintenance drone that comes with you through every room aboard once your quarters are open. One
// Bolt for the whole station: each room hands it over as it is drawn (rendering/room.js), and it arrives through the
// door behind you. It keeps to the lower right of your view (worked out from the screen's shape, so on a phone too),
// clear of the walls and the furniture, bobbing on its hover glow and turning to look at you; its one eye shows how it
// feels (open, happy, in love, sleepy, surprised, dizzy). Left alone for a while it drifts off to look at something in
// the room, then comes back. Pat it and it spins, hops or nuzzles up to you; pat it a lot and it gets giddy, then
// dizzy. In your quarters it naps on its dock when you rest, and plays fetch with its toy. It wears what you pick in its
// locker (data/bolt.js): a paint, a hat, an eye colour. The game's UI decides what it says (ui/hangar.js).
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { COSMETIC_BY_ID, HAPPY_AT, DIZZY_AT, boltHere } from '@last-orbit/data/bolt.js';
import { boltOf } from '@last-orbit/progression/bolt.js';
const T = () => window.THREE;
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const EYE_Y = 1.6, R = 0.12, BELT = -0.07, EYE_UP = 0.014; /* the band is a belt below the eye, so it never crosses it */

/** A soft round glow, a heart and a Z, for the sprites. */
function glowTex(THREE) { const c = canvas(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
function iconTex(THREE, kind) {
  const c = canvas(64, 64), x = c.getContext('2d');
  if (kind === 'heart') { x.fillStyle = '#ff6fae'; x.beginPath(); x.moveTo(32, 54); x.bezierCurveTo(4, 34, 10, 8, 32, 22); x.bezierCurveTo(54, 8, 60, 34, 32, 54); x.fill(); }
  else if (kind === 'news') { x.fillStyle = '#ffc857'; x.beginPath(); if (x.roundRect) x.roundRect(6, 4, 52, 44, 14); else x.rect(6, 4, 52, 44); x.fill(); x.beginPath(); x.moveTo(22, 46); x.lineTo(18, 60); x.lineTo(34, 46); x.fill(); x.fillStyle = '#1a1300'; x.font = '900 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 32, 27); }
  else { x.fillStyle = '#cfe8ff'; x.font = '800 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('z', 32, 34); }
  return new THREE.CanvasTexture(c);
}

class Companion {
  constructor() { this.model = null; this.room = null; this.expr = ''; this.combo = 0; this.comboT = 0; this.mode = 'follow'; this.t = 0; this.fx = []; }
  // ---------------------------------------------------------------- the drone
  build() {
    const THREE = T(), Ph = (o) => new THREE.MeshPhongMaterial(o), m = (this.model = new THREE.Group());
    const body = (this.bodyMat = Ph({ color: 0xdfe4ee, specular: 0xffffff, shininess: 80 })), band = (this.bandMat = Ph({ color: 0xffb070, specular: 0x886644, shininess: 60 }));
    this.tilt = new THREE.Group(); m.add(this.tilt); /* banks, pitches, spins and hops; the model itself only moves and turns */
    this.tilt.add(new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), body));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.sqrt(R * R - BELT * BELT) + 0.01, 0.016, 10, 32), band); ring.rotation.x = Math.PI / 2; ring.position.y = BELT; this.tilt.add(ring);
    // fins either side, on the band, and a vent on the back
    this.fins = [-1, 1].map((s) => { const f = new THREE.Group(); f.position.set(s * (Math.sqrt(R * R - BELT * BELT) + 0.02), BELT, 0.01); const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.06), band); blade.position.x = s * 0.035; f.add(blade); this.tilt.add(f); return f; });
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.02, 16), Ph({ color: 0x3a3f4a })); vent.rotation.x = Math.PI / 2; vent.position.z = R - 0.004; this.tilt.add(vent);
    // the eye: a dark bezel and a screen just clear of the shell, so no edge sinks into it (it faces -z, towards you)
    const bezel = new THREE.Mesh(new THREE.CircleGeometry(0.074, 28), new THREE.MeshBasicMaterial({ color: 0x0b0f18 })); bezel.position.set(0, EYE_UP, -(R + 0.001)); bezel.rotation.y = Math.PI; this.tilt.add(bezel);
    this.eyeCanvas = canvas(128, 128); this.eyeTex = new THREE.CanvasTexture(this.eyeCanvas);
    this.eye = new THREE.Mesh(new THREE.CircleGeometry(0.064, 28), new THREE.MeshBasicMaterial({ map: this.eyeTex, transparent: true })); this.eye.position.set(0, EYE_UP, -(R + 0.003)); this.eye.rotation.y = Math.PI; this.tilt.add(this.eye);
    // the antenna, its tip pulsing
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 6), Ph({ color: 0x8890a0 })); ant.position.set(0.03, R + 0.045, 0.02); ant.rotation.z = -0.15; this.tilt.add(ant);
    this.tip = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff4d6a })); this.tip.position.set(0.038, R + 0.098, 0.02); this.tilt.add(this.tip);
    this.glowT = glowTex(THREE);
    this.tipGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowT, color: 0xff4d6a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.tipGlow.scale.setScalar(0.09); this.tipGlow.position.copy(this.tip.position); this.tilt.add(this.tipGlow);
    // the hover glow underneath
    this.hover = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowT, color: 0x5ee6ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 })); this.hover.position.y = -R - 0.03; this.hover.scale.set(0.26, 0.12, 1); m.add(this.hover);
    this.hat = new THREE.Group(); this.hat.position.y = R - 0.01; this.tilt.add(this.hat);
    // easy to tap, but no bigger than it looks (it must not steal taps meant for what is behind it)
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); this.hit.visible = false; this.hit.userData.exhibit = 'bolt'; m.add(this.hit);
    // hearts and z's
    this.heartT = iconTex(THREE, 'heart'); this.zT = iconTex(THREE, 'z');
    this.news = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex(THREE, 'news'), transparent: true, depthWrite: false })); this.news.scale.setScalar(0.11); this.news.position.set(0.1, R + 0.2, 0); this.news.visible = false; m.add(this.news); /* something to say */
    this.v = new THREE.Vector3(); this.want = new THREE.Vector3(); this.look = new THREE.Vector3(); this.yawNow = 0;
    this.dress(boltOf(G.state).wear); this.setExpr('open');
  }
  /** What it wears: its paint, its hat, its eye's colour. */
  dress(wear) {
    if (!this.model) return; const THREE = T(), Ph = (o) => new THREE.MeshPhongMaterial(o);
    const paint = COSMETIC_BY_ID['paint:' + wear.paint] || COSMETIC_BY_ID['paint:factory'], eye = COSMETIC_BY_ID['eye:' + wear.eye] || COSMETIC_BY_ID['eye:cyan'];
    this.bodyMat.color.setHex(paint.body); this.bandMat.color.setHex(paint.band); this.eyeColor = '#' + eye.color.toString(16).padStart(6, '0'); this.hover.material.color.setHex(eye.color);
    const expr = this.expr; this.expr = ''; this.setExpr(expr || 'open');
    while (this.hat.children.length) { const c = this.hat.children[0]; this.hat.remove(c); c.traverse?.((o) => { o.geometry?.dispose(); }); }
    this.prop = null; const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); this.hat.add(o); return o; };
    switch (wear.hat) {
      case 'prop': { add(new THREE.SphereGeometry(0.075, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), Ph({ color: 0xff5f7a, shininess: 40 }), 0, 0.01); add(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), Ph({ color: 0x888888 }), 0, 0.105);
        this.prop = new THREE.Group(); this.prop.position.y = 0.13; for (const [a, c] of [[0, 0xffc857], [Math.PI, 0x5ee6ff]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.006, 0.028), Ph({ color: c })); b.position.x = Math.cos(a) * 0.06; this.prop.add(b); } this.hat.add(this.prop); break; }
      case 'party': { const c = canvas(64, 64), x = c.getContext('2d'); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffc857' : '#ff6fae'; x.fillRect(0, i * 8, 64, 8); } add(new THREE.ConeGeometry(0.055, 0.14, 18), new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(c) }), 0.02, 0.07, 0, 0, -0.15); add(new THREE.SphereGeometry(0.018, 10, 8), Ph({ color: 0xffffff }), 0.03, 0.145, 0); break; }
      case 'crown': { const gold = Ph({ color: 0xf2c65a, emissive: 0x3a2800, specular: 0xffffff, shininess: 90 }); add(new THREE.CylinderGeometry(0.06, 0.06, 0.035, 20, 1, true), gold, 0, 0.025); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add(new THREE.ConeGeometry(0.014, 0.04, 6), gold, Math.cos(a) * 0.058, 0.06, Math.sin(a) * 0.058); } add(new THREE.SphereGeometry(0.012, 8, 6), Ph({ color: 0xff4d6a }), 0, 0.028, -0.061); break; }
      case 'helmet': { add(new THREE.SphereGeometry(0.105, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), Ph({ color: 0xf0f2f6, shininess: 70 }), 0, -0.035); add(new THREE.BoxGeometry(0.012, 0.03, 0.2), Ph({ color: 0xff8a3d }), 0, 0.066); break; }
      case 'ears': { const pink = Ph({ color: 0xfff0f4, shininess: 30 }); for (const s of [-1, 1]) { const e = add(new THREE.SphereGeometry(0.03, 12, 10), pink, s * 0.04, 0.08, 0, 0, s * -0.25); e.scale.set(0.7, 2.6, 0.55); } break; }
      case 'beacon': { add(new THREE.CylinderGeometry(0.03, 0.036, 0.04, 14), Ph({ color: 0x3a3a44 }), 0, 0.03); const lamp = add(new THREE.SphereGeometry(0.03, 14, 10), new THREE.MeshBasicMaterial({ color: 0xfff0c8 }), 0, 0.07); lamp.scale.y = 1.3; this.prop = null; this.beacon = lamp; break; }
      case 'halo': { const h = add(new THREE.TorusGeometry(0.075, 0.009, 8, 36), new THREE.MeshBasicMaterial({ color: 0xfff0c8 }), 0, 0.1, 0.02, Math.PI / 2 - 0.45); h.userData.halo = true; break; } /* tipped towards you, so it reads as a ring */
    }
    if (wear.hat !== 'beacon') this.beacon = null;
  }
  /** Its eye: open (a pupil that looks about), happy, love, sleep, surprise, dizzy, squint, blink. */
  setExpr(kind) {
    if (kind === this.expr || !this.eyeCanvas) return; this.expr = kind;
    const x = this.eyeCanvas.getContext('2d'), c = this.eyeColor || '#5ee6ff'; x.clearRect(0, 0, 128, 128);
    x.fillStyle = '#060a14'; x.beginPath(); x.arc(64, 64, 64, 0, Math.PI * 2); x.fill(); x.strokeStyle = c; x.fillStyle = c; x.lineCap = 'round'; x.shadowColor = c; x.shadowBlur = 16;
    const arc = (y, up) => { x.lineWidth = 12; x.beginPath(); x.arc(64, y, 28, up ? Math.PI * 1.1 : Math.PI * 0.1, up ? Math.PI * 1.9 : Math.PI * 0.9); x.stroke(); };
    switch (kind) {
      case 'happy': arc(80, true); break;
      case 'love': x.beginPath(); x.moveTo(64, 98); x.bezierCurveTo(18, 66, 30, 26, 64, 48); x.bezierCurveTo(98, 26, 110, 66, 64, 98); x.fill(); break;
      case 'sleep': x.lineWidth = 10; x.beginPath(); x.moveTo(34, 70); x.quadraticCurveTo(64, 84, 94, 70); x.stroke(); break;
      case 'blink': x.lineWidth = 10; x.beginPath(); x.moveTo(34, 66); x.lineTo(94, 66); x.stroke(); break;
      case 'surprise': x.lineWidth = 10; x.beginPath(); x.arc(64, 64, 34, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(64, 64, 10, 0, Math.PI * 2); x.fill(); break;
      case 'dizzy': x.lineWidth = 7; x.beginPath(); for (let a = 0; a < Math.PI * 6; a += 0.2) { const r = 4 + a * 2.6; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.stroke(); break;
      case 'squint': x.beginPath(); x.ellipse(64, 70, 30, 14, 0, 0, Math.PI * 2); x.fill(); break;
      default: x.beginPath(); x.arc(64, 64, 30, 0, Math.PI * 2); x.fill(); x.shadowBlur = 0; x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(76, 50, 9, 0, Math.PI * 2); x.fill();
    }
    this.eyeTex.needsUpdate = true;
  }
  /** A heart or a z drifting up off it. */
  puff(kind) { const THREE = T(), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: kind === 'heart' ? this.heartT : this.zT, transparent: true, depthWrite: false })); s.scale.setScalar(0.07); s.position.copy(this.model.position).add(new THREE.Vector3((Math.random() - 0.5) * 0.12, 0.12, 0)); this.room.scene.add(s); this.fx.push({ s, t: 0, vx: (Math.random() - 0.5) * 0.15 }); }
  // ---------------------------------------------------------------- which room it is in
  /** Here in this room, now? (Aboard once your quarters are, and you have met it there; in your quarters only, if you
   *  asked it to stay.) */
  wanted(room) { const st = G.state; if (!st || G.mode !== 'hangar' || room.noBolt || !boltHere(st) || !st.seen?.quarters) return false; return boltOf(st).follow !== false || room.isQuarters; }
  /** Called by every room as it is drawn: comes along if it should, and lives its life. */
  visit(room, dt) {
    if (!this.wanted(room)) { if (this.model?.parent === room.scene) this.leave(); return; }
    if (!this.model) this.build();
    if (this.room !== room || this.model.parent !== room.scene) this.enter(room);
    this.tick(room, Math.min(dt, 0.05));
  }
  leave() { const r = this.room; if (r) { r.scene.remove(this.model); r.exhibits = r.exhibits.filter((o) => o !== this.hit); for (const f of this.fx) r.scene.remove(f.s); this.fx.length = 0; if (this.carry) { this.dropToy(); } } this.room = null; }
  /** Into a room: through the door behind you, and up to your side. */
  enter(room) {
    this.leave(); this.room = room; room.scene.add(this.model); if (!room.exhibits.includes(this.hit)) room.exhibits.push(this.hit);
    const f = this.fwd(room); this.model.position.set(room.pos.x - f.x * 1.2, EYE_Y - 0.2, room.pos.z - f.z * 1.2); this.v.set(0, 0, 0); this.clampTo(room, this.model.position);
    this.mode = 'follow'; this.stillT = 0; this.sleeping = false; this.setExpr('open'); this.arriveT = 0.9;
    bus.emit('boltEnter', G.room);
  }
  fwd(room) { return { x: -Math.sin(room.yaw), z: -Math.cos(room.yaw) }; }
  /** Inside the walls, above the floor, under the ceiling, and out of anything standing in the room. */
  clampTo(room, p) {
    p.x = Math.max(-room.W + 0.3, Math.min(room.W - 0.3, p.x)); p.z = Math.max(room.FRONT + 0.4, Math.min(room.BACK - 0.3, p.z)); p.y = Math.max(0.45, Math.min(room.H - 0.3, p.y));
    for (const s of room.solids || []) { const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz), r = s.r + 0.15; if (d < r && d > 1e-3) { p.x = s.x + (dx / d) * r; p.z = s.z + (dz / d) * r; } }
    for (const b of room.blocks || []) if (p.x > b.x0 - 0.15 && p.x < b.x1 + 0.15 && p.z > b.z0 - 0.15 && p.z < b.z1 + 0.15) { const o = [[b.x1 + 0.15 - p.x, 'x', b.x1 + 0.15], [p.x - b.x0 + 0.15, 'x', b.x0 - 0.15], [b.z1 + 0.15 - p.z, 'z', b.z1 + 0.15], [p.z - b.z0 + 0.15, 'z', b.z0 - 0.15]].sort((a, c) => a[0] - c[0])[0]; p[o[1]] = o[2]; }
    return p;
  }
  /** Where it keeps to: a little ahead of you, low and to the right of your view, whatever the screen's shape. */
  spot(room, out) {
    const f = this.fwd(room), r = { x: -f.z, z: f.x }, d = 1.6, cam = room.cam, halfW = Math.tan((cam.fov * Math.PI) / 360) * cam.aspect * d, side = Math.min(halfW * 0.62, 0.8);
    out.set(room.pos.x + f.x * d + r.x * side, EYE_Y - 0.42 + Math.sin(this.t * 1.8) * 0.035, room.pos.z + f.z * d + r.z * side);
    return this.clampTo(room, out);
  }
  // ---------------------------------------------------------------- what it does when you tap it, rest, or throw its toy
  /** Tapped: a spin or a hop; a few in a row, it is giddy (hearts, and it nuzzles up to you); too many, dizzy. Returns
   *  its mood: 'tap', 'happy', 'dizzy' or 'woke'. */
  tap() {
    if (!this.model) return 'tap';
    if (this.sleeping) { this.sleeping = false; this.mode = 'follow'; this.react = { kind: 'hop', t: 0, len: 0.6 }; this.setExpr('surprise'); this.exprT = 0.8; return 'woke'; }
    this.combo = this.comboT > 0 ? this.combo + 1 : 1; this.comboT = 2.6;
    if (this.combo >= DIZZY_AT) { this.react = { kind: 'dizzy', t: 0, len: 2.2 }; this.setExpr('dizzy'); this.exprT = 2.2; this.combo = 0; return 'dizzy'; }
    if (this.combo >= HAPPY_AT) { this.react = { kind: Math.random() < 0.5 ? 'nuzzle' : 'spin', t: 0, len: this.combo % 2 ? 1.1 : 0.9 }; this.setExpr('love'); this.exprT = 1.6; for (let i = 0; i < 3; i++) setTimeout(() => this.model && this.room && this.puff('heart'), i * 180); return 'happy'; }
    this.react = { kind: this.combo % 2 ? 'spin' : 'hop', t: 0, len: this.combo % 2 ? 0.9 : 0.6 }; this.setExpr('happy'); this.exprT = 1; return 'tap';
  }
  /** Something to say: a "!" over it, until it says it. */
  setNews(on) { if (this.news) this.news.visible = !!on; }
  /** Saying it: it flies up to you, bright-eyed, for a moment. */
  speak() { if (!this.model || this.sleeping) return; this.setNews(false); this.react = { kind: 'speak', t: 0, len: 2.4 }; this.setExpr('happy'); this.exprT = 2.2; }
  /** Down onto its dock for a nap (in your quarters, while you rest). */
  napAt(p) { if (!this.model) return; this.dock = p; this.mode = 'sleep'; this.sleeping = true; this.setExpr('sleep'); }
  /** Fetch: the toy is thrown to a spot; it goes and gets it, and brings it back to where it lives. */
  fetch(toy, home, to) { if (!this.model || this.mode === 'fetch') return false; this.sleeping = false; this.toy = { obj: toy, home: home.clone(), to: to.clone(), from: toy.position.clone(), t: 0 }; this.mode = 'fetch'; this.fetchStage = 'watch'; this.setExpr('surprise'); this.exprT = 0.5; return true; }
  dropToy() { const k = this.toy; if (!k) return; this.carry = false; this.room?.scene.attach(k.obj); k.obj.position.copy(k.home); k.obj.rotation.set(0, 0, 0); this.toy = null; }
  // ---------------------------------------------------------------- every frame
  tick(room, dt) {
    const THREE = T(), m = this.model, p = m.position, cam = room.cam; this.t += dt;
    if (this.comboT > 0) this.comboT -= dt; if (this.exprT > 0 && (this.exprT -= dt) <= 0) this.setExpr(this.sleeping ? 'sleep' : 'open');
    // are you standing still? (then it may wander off to look at something)
    const pose = room.pos.x.toFixed(2) + room.pos.z.toFixed(2) + room.yaw.toFixed(2) + room.pitch.toFixed(2); if (pose !== this.pose) { this.pose = pose; this.stillT = 0; if (this.mode === 'inspect') this.mode = 'follow'; if (this.mode === 'sleep' && !room.isQuarters) this.mode = 'follow'; } else this.stillT += dt;
    // where it wants to be
    let lookAt = cam.position, speed = 5;
    if (this.mode === 'fetch' && this.toy) {
      const k = this.toy; k.t += dt;
      if (this.fetchStage === 'watch') { const u = Math.min(1, k.t / 0.9); k.obj.position.lerpVectors(k.from, k.to, u); k.obj.position.y = k.from.y + (k.to.y - k.from.y) * u + Math.sin(u * Math.PI) * 1.2; k.obj.rotation.x += dt * 12; lookAt = k.obj.position; this.spot(room, this.want); if (u >= 1) { this.fetchStage = 'chase'; k.t = 0; } }
      else if (this.fetchStage === 'chase') { this.want.copy(k.to).setY(Math.max(0.5, k.to.y + 0.22)); lookAt = k.obj.position; speed = 9; if (p.distanceTo(this.want) < 0.18 || k.t > 3) { m.attach(k.obj); k.obj.position.set(0, -R - 0.03, 0); this.carry = true; this.fetchStage = 'bring'; k.t = 0; this.setExpr('happy'); this.exprT = 99; } }
      else if (this.fetchStage === 'bring') { this.spot(room, this.want); speed = 7; if (p.distanceTo(this.want) < 0.25 || k.t > 3) { this.fetchStage = 'home'; k.t = 0; bus.emit('boltFetched'); } }
      else { this.want.copy(k.home).setY(k.home.y + 0.3); speed = 6; lookAt = k.home; if (p.distanceTo(this.want) < 0.15 || k.t > 3) { this.dropToy(); this.mode = 'follow'; this.exprT = 0.01; } }
    } else if (this.mode === 'sleep' && this.dock) { this.want.copy(this.dock); speed = 2.5; lookAt = null; if (Math.random() < dt * 0.9) this.puff('z'); }
    else if (this.mode === 'inspect' && this.target) { this.want.copy(this.target.at); lookAt = this.target.look; if ((this.inspectT -= dt) <= 0) { this.mode = 'follow'; this.setExpr('open'); } }
    else {
      this.mode = 'follow'; this.spot(room, this.want);
      if (this.stillT > 9 && Math.random() < dt * 0.25) this.wander(room);
    }
    // a tap: nuzzle up close
    if (this.react?.kind === 'nuzzle') { const f = this.fwd(room); this.want.set(room.pos.x + f.x * 0.62, EYE_Y - 0.12, room.pos.z + f.z * 0.62); speed = 8; }
    else if (this.react?.kind === 'speak') { const f = this.fwd(room); this.want.set(room.pos.x + f.x * 1.0 - f.z * 0.18, EYE_Y - 0.24 + Math.sin(this.t * 5) * 0.02, room.pos.z + f.z * 1.0 + f.x * 0.18); this.clampTo(room, this.want); speed = 6; lookAt = cam.position; }
    // fly there, springy, never through the walls
    const k = Math.min(1, dt * speed); this.v.lerp(this.want.clone().sub(p).multiplyScalar(speed * 0.9), k); if (this.arriveT > 0) { this.arriveT -= dt; this.v.multiplyScalar(1.02); }
    p.addScaledVector(this.v, dt); this.clampTo(room, p);
    // turn to look (at you, or what it is looking at), banking as it goes
    if (lookAt) { const want = Math.atan2(lookAt.x - p.x, lookAt.z - p.z) + Math.PI; let d = want - this.yawNow; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yawNow += d * Math.min(1, dt * 6); }
    m.rotation.y = this.yawNow;
    const side = this.v.x * Math.cos(this.yawNow) - this.v.z * Math.sin(this.yawNow); this.tilt.rotation.z = THREE.MathUtils.clamp(-side * 0.25, -0.5, 0.5); this.tilt.rotation.x = this.sleeping ? 0.25 : THREE.MathUtils.clamp(this.v.length() * 0.06, 0, 0.3);
    // reactions
    const r = this.react; this.tilt.position.y = 0; this.tilt.rotation.y = 0;
    if (r) { r.t += dt; const u = Math.min(1, r.t / r.len);
      if (r.kind === 'spin') this.tilt.rotation.y = u * u * (3 - 2 * u) * Math.PI * 2 * (1 + (this.combo >= HAPPY_AT ? 1 : 0));
      else if (r.kind === 'hop') this.tilt.position.y = Math.sin(u * Math.PI) * 0.22;
      else if (r.kind === 'dizzy') { this.tilt.rotation.z += Math.sin(r.t * 14) * 0.35 * (1 - u); this.tilt.rotation.y = Math.sin(r.t * 7) * 0.8 * (1 - u); }
      if (u >= 1) this.react = null; }
    // alive: fins flap with speed, the tip pulses, the hover glow breathes, it blinks now and then, the propeller turns
    const sp = this.v.length(); for (const [i, f] of this.fins.entries()) f.rotation.x = Math.sin(this.t * (8 + sp * 10) + i) * (0.15 + Math.min(0.5, sp * 0.4));
    this.tipGlow.material.opacity = 0.5 + 0.5 * Math.sin(this.t * 3); this.hover.material.opacity = this.sleeping ? 0.2 : 0.45 + 0.15 * Math.sin(this.t * 6) + Math.min(0.3, sp * 0.2);
    if (this.news.visible) { this.news.position.y = R + 0.2 + Math.abs(Math.sin(this.t * 4)) * 0.03; }
    if (this.prop) this.prop.rotation.y += dt * (10 + sp * 20); if (this.beacon) this.beacon.material.color.setHex(Math.sin(this.t * 4) > 0 ? 0xfff0c8 : 0x8a7a5a);
    if (!this.sleeping && this.expr === 'open' && Math.random() < dt * 0.35) { this.setExpr('blink'); this.exprT = 0.12; }
    // hearts and z's drift up and fade
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t += dt; f.s.position.y += dt * 0.25; f.s.position.x += f.vx * dt; f.s.material.opacity = Math.max(0, 1 - f.t / 1.4); if (f.t > 1.4) { room.scene.remove(f.s); f.s.material.dispose(); this.fx.splice(i, 1); } }
  }
  /** Off to look at something in the room for a few seconds. */
  wander(room) {
    const THREE = T(), wp = new THREE.Vector3(), picks = [];
    for (const o of room.exhibits) { const kind = o.userData?.exhibit; if (!kind || kind === 'bolt' || kind === 'exit' || o.userData.room) continue; o.getWorldPosition(wp); if (Math.abs(wp.x) < room.W && wp.z > room.FRONT && wp.z < room.BACK) picks.push({ kind, at: wp.clone() }); }
    if (!picks.length) return; const pick = picks[Math.floor(Math.random() * picks.length)], look = pick.at.clone(); look.y = THREE.MathUtils.clamp(look.y, 0.7, 2.2);
    const toMe = new THREE.Vector3(room.pos.x - look.x, 0, room.pos.z - look.z).normalize(), at = look.clone().addScaledVector(toMe, 0.55); at.y = THREE.MathUtils.clamp(look.y + 0.15, 0.7, room.H - 0.4);
    this.target = { at: this.clampTo(room, at), look }; this.mode = 'inspect'; this.inspectT = 3.5; this.stillT = -6; this.setExpr('squint'); this.exprT = 3.3;
    bus.emit('boltInspect', pick.kind);
  }
}
/** The one Bolt aboard. */
export const bolt = new Companion();
bus.on('boltDressed', () => bolt.dress(boltOf(G.state).wear));
