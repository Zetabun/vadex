// The replay screen: the flight recorder's last sortie (progression/recorder.js) played back as a miniature of the
// fight, with the game's own enemy models and your ship, rendered into a texture for a screen aboard the station.
// Between the recorder's frames everything glides: enemies are matched by id and eased, shots and bullets fly on
// along their recorded velocity. It loops, holding on the ending for a moment.
import { shapeGeometry, playerParts } from '@last-orbit/rendering/geometry.js';
import { HZ, unpack } from '@last-orbit/progression/recorder.js';
import { SHIP_BY_ID } from '@last-orbit/data/ships.js';
const T = () => window.THREE;
const BULLET_COL = [0xff5d8f, 0xff9f43, 0xd17bff, 0xffffff], HOLD = 2.5;
const SPIN = { miniF: 0.9, bossOracle: 0.35, bossSing: 0.35, aegis: 0.9, bossBastion: 0.35, rift: 2.4, bossShroud: 0.5, bossUnmaker: -0.3 };

function glowTex(inner = 0.25) {
  const THREE = T(), c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(inner, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

export class ReplayScreen {
  constructor(w = 512, h = 768) {
    const THREE = T(); this.target = new THREE.WebGLRenderTarget(w, h); this.texture = this.target.texture; this.t = 0; this.rep = null;
    const S = (this.scene = new THREE.Scene()); S.background = new THREE.Color(0x050b1e);
    this.cam = new THREE.OrthographicCamera(-57, 57, 168, -3, -200, 200); /* the whole field and the lane they enter by, at 2:3 */ this.cam.position.set(0, 0, 100);
    S.add(new THREE.HemisphereLight(0xbfd8ff, 0x1a1030, 0.85)); const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(-40, 60, 120); S.add(sun); // the battlefield's own lights
    // stars drifting down the screen, as the fight's backdrop does
    const n = 160, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 118, Math.random() * 175 - 4, -50], i * 3);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9fb4ff, size: 1.6, sizeAttenuation: false })); S.add(this.stars);
    const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const quads = (count, tex, z) => { const m = this.inst(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, ...add }), count); m.position.z = z; return m; };
    const soft = glowTex(), streak = glowTex(0.45);
    this.glow = quads(200, soft, 30); this.bullets = quads(260, soft, 40); this.shots = quads(160, streak, 35); this.booms = quads(80, soft, 45);
    const ringC = document.createElement('canvas'); ringC.width = ringC.height = 64; const rc = ringC.getContext('2d'); rc.strokeStyle = '#fff'; rc.lineWidth = 5; rc.beginPath(); rc.arc(32, 32, 27, 0, Math.PI * 2); rc.stroke();
    this.rings = quads(60, new THREE.CanvasTexture(ringC), 44);
    this.enemyMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x10131c }); this.meshes = {}; this.d = new THREE.Object3D(); this.col = new THREE.Color();
    this.ship = new THREE.Group(); S.add(this.ship); this.shipLook = '';
  }
  /** The fleet's meshes, one instanced mesh per enemy shape (as the battlefield draws them). */
  meshFor(shape) { return this.meshes[shape] || (this.meshes[shape] = this.inst(shapeGeometry(shape), this.enemyMat, 60)); }
  /** An instanced mesh with its colours in place from the start (a colour buffer added later would be ignored). */
  inst(geo, mat, cap) {
    const THREE = T(), m = new THREE.InstancedMesh(geo, mat, cap); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    m.count = 0; m.frustumCulled = false; this.scene.add(m); return m;
  }
  /** Your ship as it flew (its hull's own model, in its trim colour). */
  buildShip(id) {
    const THREE = T(), ship = SHIP_BY_ID[id] || SHIP_BY_ID.vanguard, parts = playerParts(ship.id), Ph = (o) => new THREE.MeshPhongMaterial(o); this.ship.clear();
    const M = { hull: Ph({ color: 0x8aa0b0, emissive: 0x0c1420, shininess: 30 }), deck: Ph({ color: 0xe2eced, emissive: 0x141a22, shininess: 40 }), dark: Ph({ color: 0x152735 }), glass: Ph({ color: 0x1a7aa0, emissive: 0x0a4a60, shininess: 110 }),
      trim: Ph({ color: ship.trim, emissive: new THREE.Color(ship.trim).multiplyScalar(0.5) }), gun: Ph({ color: 0x667782 }), gold: Ph({ color: 0xffb94e, emissive: 0x583000 }) };
    const use = { hull: 'hull', deck: 'deck', cockpit: 'glass', chassis: 'dark', markings: 'gold', lights: 'trim', wings: 'deck', pods: 'gun', fins: 'hull', engine: 'trim' };
    for (const k in use) if (parts[k]) this.ship.add(new THREE.Mesh(parts[k], M[use[k]]));
    this.ship.scale.setScalar(4); this.trim = ship.trim;
  }
  load(rep) { this.rep = rep; this.t = 0; if (rep && this.shipLook !== rep.meta.ship) { this.shipLook = rep.meta.ship; this.buildShip(rep.meta.ship); } }
  /** Where the playback is: the frame before, the frame after, and how far between them. */
  at() {
    const F = this.rep.frames, x = Math.min(this.t * HZ, F.length - 1), i = Math.floor(x); return { a: F[i], b: F[Math.min(F.length - 1, i + 1)], k: x - i, i };
  }
  get length() { return this.rep ? this.rep.frames.length / HZ : 0; }
  update(dt) {
    if (!this.rep?.frames.length) return; const THREE = T();
    this.t += dt; if (this.t > this.length + HOLD) this.t = 0;
    const { a, b, k, i } = this.at(), R = this.rep, d = this.d, t = this.t, ux = unpack.x, uy = unpack.y, uv = unpack.v;
    // the enemies, eased toward where the next frame has them
    if (!b.ids) { b.ids = new Map(); for (let o = 0; o < b.E.length; o += 7) b.ids.set(b.E[o] | (b.E[o + 1] << 8), o); }
    for (const s in this.meshes) this.meshes[s].count = 0; this.glow.count = 0;
    const E = a.E;
    for (let o = 0; o < E.length; o += 7) {
      const shape = R.shapes[E[o + 1]], m = this.meshFor(shape), n = m.count; if (n >= m.instanceMatrix.count) continue;
      const ob = b.ids.get(E[o] | (E[o + 1] << 8)); let x = ux(E[o + 3]), y = uy(E[o + 4]); if (ob != null) { x += (ux(b.E[ob + 3]) - x) * k; y += (uy(b.E[ob + 4]) - y) * k; }
      const r = E[o + 5] / 8, fl = E[o + 6], boss = fl & 1, id = E[o];
      d.position.set(x, y, 0); d.rotation.set(Math.sin(t * 1.3 + id) * 0.08, Math.sin(t * 1.7 + id * 1.7) * (boss ? 0.06 : 0.22), (SPIN[shape] || 0) * t); d.scale.setScalar(r * 0.92); d.updateMatrix(); m.setMatrixAt(n, d.matrix);
      const c = this.col.setHex(R.colors[E[o + 2]]); if (fl & 8) c.lerp(new THREE.Color(0xffffff), 0.6); if (fl & 4) c.multiplyScalar(0.25); m.setColorAt(n, c); m.count = n + 1;
      this.quad(this.glow, x, y, r * (boss ? 3.2 : 2.6), r * (boss ? 3.2 : 2.6), 0, R.colors[E[o + 2]], boss ? 0.35 : 0.22);
    }
    for (const s in this.meshes) { const m = this.meshes[s]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    // shots and bullets fly on along their recorded velocity until the next frame
    const lead = k / HZ; this.shots.count = 0; this.bullets.count = 0;
    for (let o = 0; o < a.S.length; o += 5) { const vx = uv(a.S[o + 2]), vy = uv(a.S[o + 3]), x = ux(a.S[o]) + vx * lead, y = uy(a.S[o + 1]) + vy * lead; this.quad(this.shots, x, y, 5.5, 1.6, Math.atan2(vy, vx), R.colors[a.S[o + 4]], 1); }
    for (let o = 0; o < a.B.length; o += 5) { const x = ux(a.B[o]) + uv(a.B[o + 2]) * lead, y = uy(a.B[o + 1]) + uv(a.B[o + 3]) * lead, kind = a.B[o + 4], s = kind === 1 ? 5 : 3.6; this.quad(this.bullets, x, y, s, s, 0, BULLET_COL[kind], 1); }
    // kills in the last half second: a flash and a ring
    this.booms.count = 0; this.rings.count = 0;
    for (let j = Math.max(0, i - 6); j <= i; j++) { const f = R.frames[j], age = t - j / HZ; if (age < 0 || age > 0.6) continue;
      for (const [kx, ky, ci, big] of f.K) { const x = ux(kx), y = uy(ky), s = (big === 2 ? 26 : big ? 12 : 8) * (0.5 + age * 2); this.quad(this.booms, x, y, s * 0.8, s * 0.8, 0, R.colors[ci], Math.max(0, 1 - age / 0.45)); this.quad(this.rings, x, y, s, s, 0, R.colors[ci], Math.max(0, 1 - age / 0.6)); } }
    for (const q of [this.shots, this.bullets, this.booms, this.rings, this.glow]) { q.instanceMatrix.needsUpdate = true; if (q.instanceColor) q.instanceColor.needsUpdate = true; }
    // your ship, banking as it flew; gone once it fell
    const px = a.px + (b.px - a.px) * k, py = a.py + (b.py - a.py) * k, tilt = a.tilt + (b.tilt - a.tilt) * k;
    this.ship.visible = a.alive; this.ship.position.set(px, py, 5); this.ship.rotation.set(-0.3, -tilt * 0.6, -tilt * 0.12);
    if (a.alive) { this.quad(this.glow, px, py - 3.5, 7, 9, 0, this.trim || 0x5ee6ff, 0.5); this.quad(this.glow, px, py, 16, 16, 0, 0x5ee6ff, 0.15); this.glow.instanceMatrix.needsUpdate = true; this.glow.instanceColor.needsUpdate = true; }
    this.stars.position.y = -((t * 6) % 175);
  }
  /** One glowing quad: centre, size, angle, colour and strength. */
  quad(q, x, y, w, h, ang, color, a) {
    const n = q.count; if (n >= q.instanceMatrix.count) return; const d = this.d; d.position.set(x, y, 0); d.rotation.set(0, 0, ang); d.scale.set(w, h, 1); d.updateMatrix(); q.setMatrixAt(n, d.matrix);
    q.setColorAt(n, this.col.setHex(color).multiplyScalar(a)); q.count = n + 1;
  }
  /** What the side panels show at this moment. */
  status() {
    if (!this.rep?.frames.length) return null; const { a } = this.at(), done = this.t >= this.length - 0.05;
    return { wave: a.wave, score: a.score, hull: a.hull, shield: a.shield, level: a.level, t: Math.min(this.t, this.length), len: this.length, done, alive: a.alive };
  }
  render(gl) { if (!this.rep) return; gl.setRenderTarget(this.target); gl.setClearColor(0x050b1e, 1); gl.render(this.scene, this.cam); gl.setRenderTarget(null); }
}
