// Counterattack set pieces, drawn (see combat/setpieces.js for how each one plays).
//   wrecks  derelict hulks: a broken hull, exposed ribs, a bridge block and blinking running lights
//   nebula  gas banks: a dark crimson body with a hot rim and lightning inside, drawn over the ships it veils
//   hull    a machine battleship passing beneath: bow, armoured deck, a glowing spine, vents, towers and engines
//   hive    organic walls: fleshy lumps along the tunnel edge with pulsing veins
//   horizon the singularity: event horizon, photon ring, a tilted accretion disc and matter spiralling in
import { FIELD } from '@last-orbit/data/balance.js';
import { HULL, HORIZON, hiveDepth, hullFront, hullLength } from '@last-orbit/combat/setpieces.js';

const T = () => window.THREE;
const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
/** Deterministic 0..1 from integers, so scenery built from a seed looks the same every frame. */
const hash = (a, b = 0) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x27d4eb2d); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };

/** A round, lumpy gas cloud: fractal noise faded out towards the edge. */
function cloudBlob(seed) {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  const lat = (n) => Float32Array.from({ length: n * n }, (_, i) => hash(seed, i * 7 + n)), oct = [[4, 0.55], [8, 0.28], [16, 0.17]].map(([n, a]) => ({ n, a, v: lat(n) }));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0; for (const o of oct) { const fx = (x / S) * o.n, fy = (y / S) * o.n, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, x1 = (ix + 1) % o.n, y1 = (iy + 1) % o.n;
      const a = o.v[iy * o.n + ix], b = o.v[iy * o.n + x1], q = o.v[y1 * o.n + ix], e = o.v[y1 * o.n + x1]; v += o.a * (a + (b - a) * tx + (q - a + (a - b - q + e) * tx) * ty); }
    const r = Math.hypot(x - S / 2, y - S / 2) / (S / 2), k = Math.max(0, Math.min(1, (v * 1.25 - r * 0.95) * 2.4)), i = (y * S + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = 255 * k * k * (3 - 2 * k);
  }
  g.putImageData(img, 0, 0); return c;
}
/** Soft radial falloff for the accretion disc (bright inner rim → dark outer edge). */
function discTexture(front = false) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.05, 'rgba(255,246,214,1)'); gr.addColorStop(0.3, 'rgba(255,176,96,.8)'); gr.addColorStop(0.65, 'rgba(200,70,40,.35)'); gr.addColorStop(1, 'rgba(90,20,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  // streaky banding, so the disc visibly turns
  g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${0.15 + hash(i) * 0.3})`; g.lineWidth = 1 + hash(i, 1) * 4; g.beginPath(); g.arc(S / 2, S / 2, S * (0.22 + hash(i, 2) * 0.27), hash(i, 3) * 6.3, hash(i, 3) * 6.3 + 0.6 + hash(i, 4) * 2); g.stroke(); }
  if (front) { g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fillRect(0, 0, S, S / 2 + 2); } // keep only the near half, which crosses in front of the hole
  return c;
}

export class SetPieces {
  constructor(scene) { this.scene = scene; this.groups = {}; this.world = null; }

  /** Called every frame after the sprite batches begin. */
  update(w, dt, B) {
    const s = w.set, kind = w.counter && s ? s.kind : null;
    if (this.world !== w) { this.world = w; this.reset(); }
    for (const k in this.groups) this.groups[k].visible = k === kind;
    if (!kind) return;
    if (!this.groups[kind]) this.build(kind);
    this.groups[kind].visible = true;
    this[kind](w, s, dt, B);
  }
  reset() { for (const k of ['wrecks', 'nebula']) if (this.groups[k]) { for (const g of this.pool[k].values()) this.groups[k].remove(g); this.pool[k].clear(); } }

  build(kind) {
    const THREE = T(), g = new THREE.Group(); this.groups[kind] = g; this.scene.add(g); this.pool ||= { wrecks: new Map(), nebula: new Map() };
    const inst = (geo, mat, cap) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); m.frustumCulled = false; m.count = 0; g.add(m); return m; };
    if (kind === 'wrecks') {
      this.metal = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x07080c }); this.lamp = new THREE.MeshBasicMaterial({ color: 0xffffff });
      this.box = new THREE.BoxGeometry(1, 1, 1); this.cyl = new THREE.CylinderGeometry(1, 1.2, 1, 8).rotateZ(Math.PI / 2);
    } else if (kind === 'nebula') {
      this.blobs = [0, 1, 2, 3].map((k) => { const t = new THREE.CanvasTexture(cloudBlob(k * 31 + 5)); return t; });
    } else if (kind === 'hull') {
      this.hullBox = inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x05070a }), 520);
      this.hullGlow = inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), 260);
      // The bow: one pointed, flared prow (tip at y = 0, full beam at y = HULL.bow), with a raised armoured deck on it.
      const prow = (k) => { const s = new THREE.Shape(), hw = HULL.half * k, L = HULL.bow; s.moveTo(0, 0); s.bezierCurveTo(hw * 0.45, L * 0.05, hw * 0.95, L * 0.45, hw, L); s.lineTo(-hw, L); s.bezierCurveTo(-hw * 0.95, L * 0.45, -hw * 0.45, L * 0.05, 0, 0); return new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false, curveSegments: 12 }); };
      this.bow = new THREE.Mesh(prow(1), new THREE.MeshLambertMaterial({ color: 0x1d222a, emissive: 0x05070a, side: THREE.DoubleSide })); g.add(this.bow);
      this.bowDeck = new THREE.Mesh(prow(0.8), new THREE.MeshLambertMaterial({ color: 0x29303a, emissive: 0x05070a })); g.add(this.bowDeck);
    } else if (kind === 'hive') {
      this.flesh = inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x12030f }), 420);
    } else if (kind === 'horizon') {
      const add = (mesh, z, order) => { mesh.position.set(HORIZON.x, HORIZON.y, z); mesh.renderOrder = order; g.add(mesh); return mesh; };
      // A flat, squashed accretion disc behind the hole, its near half again in front of it, and a lensed glow
      // arching round the rim (the look of a black hole seen from just above its disc).
      const glowMat = (front) => new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(discTexture(front)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const discGeo = new THREE.PlaneGeometry(64, 64);
      this.disc = add(new THREE.Mesh(discGeo, glowMat(false)), -7.2, 1); this.disc.scale.y = 0.3;
      this.hole = add(new THREE.Mesh(new THREE.CircleGeometry(8.6, 48), new THREE.MeshBasicMaterial({ color: 0x000000 })), -6.8, 2);
      this.discFront = add(new THREE.Mesh(discGeo, glowMat(true)), -6.6, 3); this.discFront.scale.y = 0.3;
      this.lens = add(new THREE.Mesh(new THREE.PlaneGeometry(42, 42), glowMat(false)), -7.4, 0); this.lens.material.opacity = 0.55;
      this.photon = add(new THREE.Mesh(new THREE.RingGeometry(8.6, 9.3, 64), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })), -6.7, 3);
    }
  }

  // ---------------------------------------------------------------- wrecks
  /** One derelict, built once from its seed: its footprint matches the item's w × h (the collision box). */
  wreck(it) {
    const THREE = T(), g = new THREE.Group(), r = (k) => hash(it.seed, k), W = it.w, H = it.h;
    const shade = [0x383c46, 0x41454f, 0x32363e, 0x463f38][Math.floor(r(0) * 4)];
    const part = (geo, sx, sy, sz, x, y, z, col, rz = 0, mat = this.metal) => { const m = new THREE.Mesh(geo, mat.clone()); m.material.color.setHex(col); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.z = rz; g.add(m); return m; };
    const broken = r(1) < 0.5 ? -1 : 1; // which end snapped off
    part(this.box, W * 0.72, H, 3, -broken * W * 0.12, 0, 0, shade);
    part(this.box, W * 0.16, H * 0.62, 2.4, -broken * W * 0.43, 0, 0.1, shade - 0x0a0a0a);                                     // intact prow
    part(this.box, W * 0.22, H * 0.46, 1.6, -broken * W * 0.18, (r(2) - 0.5) * H * 0.3, 2.2, shade + 0x0c0c0c);             // bridge block
    for (let k = 0; k < 3; k++) part(this.box, W * (0.1 + r(10 + k) * 0.12), 0.35, 0.4, -broken * W * (0.05 + k * 0.14), (r(20 + k) - 0.5) * H * 0.7, 1.65, 0x2a2e36); // plating seams
    for (let k = 0; k < 4; k++) part(this.box, 0.55, H * (0.8 + r(30 + k) * 0.35), 0.7, broken * W * (0.24 + k * 0.065), (r(40 + k) - 0.5) * H * 0.2, 0.3 + r(50 + k), 0x5a5f6a, (r(60 + k) - 0.5) * 0.5); // exposed ribs
    for (let k = 0; k < 3; k++) part(this.box, 1 + r(70 + k) * 2.2, 0.8 + r(80 + k) * 1.8, 1.2 + r(90 + k) * 1.4, broken * W * (0.3 + r(100 + k) * 0.18), (r(110 + k) - 0.5) * H * 0.8, 0, shade - 0x080808, r(120 + k) * 2); // torn plates
    if (r(3) < 0.7) part(this.cyl, 2.4, 1.6, 1.6, -broken * W * 0.36, H * 0.5 * (r(4) < 0.5 ? -1 : 1), -0.2, 0x363a44); // dead engine pod
    for (const sd of [-1, 1]) part(this.box, W * 0.13, H * 0.36, 2, -broken * W * 0.44, sd * H * 0.17, 0, shade - 0x060606, sd * broken * 0.55); // pointed prow
    part(this.box, W * 0.46, H * 0.16, 0.3, -broken * W * 0.14, H * 0.24, 1.55, [0x6e3a28, 0x2f4a6a, 0x6a5a2a][Math.floor(r(7) * 3)]);   // faded livery stripe
    part(this.box, W * 0.2, H * 0.85, 0.3, broken * W * 0.12, 0, 1.56, 0x16181c, (r(8) - 0.5) * 0.4);                                 // scorch where it broke
    for (let k = 0; k < 2; k++) part(this.box, 1.4, 1.4, 1.2, -broken * W * (0.02 + k * 0.1), (k ? -1 : 1) * H * 0.3, 2, shade + 0x080808); // deck stubs
    part(this.box, 0.25, 0.25, 4, -broken * W * 0.24, H * 0.1, 3, 0x6a6f7a);                                                            // snapped mast
    g.userData.lights = [[-broken * W * 0.47, H * 0.2, 0xff4d5e], [-broken * W * 0.2, -H * 0.4, 0xffb347], [broken * W * 0.3, 0, 0xff8a3d]].slice(0, 2 + (r(5) < 0.5 ? 1 : 0));
    g.rotation.x = (r(6) - 0.5) * 0.5; this.groups.wrecks.add(g); return g;
  }
  wrecks(w, s, dt, B) {
    const pool = this.pool.wrecks, live = new Set(s.items), t = w.t;
    for (const [it, g] of pool) if (!live.has(it)) { this.groups.wrecks.remove(g); pool.delete(it); }
    for (const it of s.items) {
      let g = pool.get(it); if (!g) { g = this.wreck(it); pool.set(it, g); }
      g.position.set(it.x, it.y, 0); g.rotation.z = it.rot;
      const cs = Math.cos(it.rot), sn = Math.sin(it.rot);
      g.userData.lights.forEach(([lx, ly, col], k) => { const on = Math.sin(t * (2.2 + k) + it.seed % 7) > 0.2; if (on) B.soft.add(it.x + lx * cs - ly * sn, it.y + lx * sn + ly * cs, 3.4, 3.4, 0, rgb(col), 1.4); });
      if (Math.random() < dt * 1.5) { const lx = (hash(it.seed, 1) < 0.5 ? -1 : 1) * it.w * 0.4, ly = (Math.random() - 0.5) * it.h; B.soft.add(it.x + lx * cs - ly * sn, it.y + lx * sn + ly * cs, 3, 3, 0, rgb(0x9fd8ff), 1.4); } // arcing wiring
    }
  }

  // ---------------------------------------------------------------- nebula banks
  nebula(w, s, dt, B) {
    const THREE = T(), pool = this.pool.nebula, live = new Set(s.items), t = w.t;
    for (const [it, g] of pool) if (!live.has(it)) { this.groups.nebula.remove(g); pool.delete(it); }
    for (const it of s.items) {
      let g = pool.get(it);
      if (!g) {
        g = new THREE.Group(); const tex = this.blobs[it.seed % this.blobs.length], geo = new THREE.PlaneGeometry(1, 1);
        const body = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: 0x3a0716, transparent: true, opacity: 0.8, depthWrite: false })); body.renderOrder = 3;
        const rim = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.blobs[(it.seed + 1) % this.blobs.length], color: 0xff3f6c, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending })); rim.renderOrder = 4; rim.position.z = 0.2; rim.scale.setScalar(1.12);
        g.add(body, rim); g.userData = { body, rim }; this.groups.nebula.add(g); pool.set(it, g);
      }
      g.position.set(it.x, it.y, 3); g.scale.setScalar(it.r * 2.5); g.userData.body.rotation.z = it.rot; g.userData.rim.rotation.z = -it.rot * 0.7 + 1;
      // lightning in the bank
      if (Math.random() < dt * 0.9) { const a = Math.random() * 6.3, d = it.r * 0.4 * Math.random(); B.soft.add(it.x + Math.cos(a) * d, it.y + Math.sin(a) * d, it.r * 0.9, it.r * 0.9, 0, rgb(0xff8fb0), 0.35); }
      B.soft.add(it.x, it.y, it.r * 1.1, it.r * 1.1, 0, rgb(0xff2a55), 0.07 + 0.03 * Math.sin(t * 1.3 + it.seed));
    }
    // A ship hidden in a bank gets a faint outline, so the pilot never loses it.
    if (w.playerVeiled) B.ring.add(w.player.x, w.player.y, 9, 9, t * 2, rgb(0xff9fbf), 0.5);
  }

  // ---------------------------------------------------------------- the battleship hull
  hull(w, s, dt, B) {
    const stage = w.counter.stage, front = hullFront(stage, s.clock ?? w.counter.t), L = hullLength(stage), P = 16, Z = -3, t = w.t;
    const box = this.hullBox, glow = this.hullGlow, d = this.dummy ||= new (T().Object3D)(), col = this.col ||= new (T().Color)();
    let nb = 0, ng = 0;
    const put = (m, n, x, y, z, sx, sy, sz, hex) => { d.position.set(x, y, z); d.rotation.set(0, 0, 0); d.scale.set(sx, sy, sz); d.updateMatrix(); m.setMatrixAt(n, d.matrix); col.setHex(hex); m.setColorAt(n, col); };
    const plate = (x, y, z, sx, sy, sz, hex) => { if (nb < 520) put(box, nb++, x, y, z, sx, sy, sz, hex); };
    const lamp = (x, y, z, sx, sy, hex) => { if (ng < 260) put(glow, ng++, x, y, z, sx, sy, 0.3, hex); };
    const rows = Math.ceil(L / P), first = Math.max(0, Math.floor((-40 - front) / P)), last = Math.min(rows - 1, Math.floor((FIELD.H + 60 - front) / P));
    for (let i = first; i <= last; i++) {
      const y0 = front + i * P, cy = y0 + P / 2, h = (k) => hash(i, k), fromBow = i * P, toStern = L - fromBow - P;
      const hw = HULL.half;
      if (fromBow < HULL.bow) { if (fromBow > P) lamp(0, cy, Z + 0.9, 0.9, 3.2, 0x3dffb5); continue; } // the prow mesh covers the bow rows
      plate(0, cy, Z - 1.5, hw * 2, P + 0.1, 3, 0x1d222a);                                          // keel
      plate(-hw + 2.5, cy, Z + 0.4, 5, P - 0.8, 2.2, 0x29303a); plate(hw - 2.5, cy, Z + 0.4, 5, P - 0.8, 2.2, 0x29303a); // armour belts
      if (fromBow >= HULL.bow && toStern > P * 2 && i % 3 === 1) for (const sd of [-1, 1]) { plate(sd * (hw + 2.2), cy, Z - 0.2, 5, P * 0.7, 3, 0x252b34); plate(sd * (hw + 3.2), cy, Z + 1.6, 2.4, 2.4, 2.4, 0x333b46); lamp(sd * (hw + 4.6), cy, Z + 1.7, 0.5, 0.5, 0xff4d5e); } // gun blisters
      plate(0, cy, Z + 0.05, 7, P + 0.1, 1.2, 0x12161c);                                            // spine trench
      lamp(0, cy - P * 0.25, Z + 0.8, 0.9, 3.2, 0x3dffb5); lamp(0, cy + P * 0.25, Z + 0.8, 0.9, 3.2, 0x3dffb5);
      if (i % 2 === 0) { lamp(-hw + 0.8, cy, Z + 1.6, 0.8, 0.8, 0xff4d5e); lamp(hw - 0.8, cy, Z + 1.6, 0.8, 0.8, 0xff4d5e); }
      if (fromBow < HULL.bow) continue;
      if (toStern < P * 2) { // engine block at the stern
        for (const ex of [-hw * 0.6, 0, hw * 0.6]) { plate(ex, cy + P * 0.1, Z + 1.4, 9, P * 0.9, 4, 0x2f3640); lamp(ex, y0 + P + 0.4, Z + 1.6, 6.5, 1.2, 0xffa24d); B.soft.add(ex, y0 + P + 2.5, 10, 7, 0, rgb(0xff8a3d), 0.9 + 0.2 * Math.sin(t * 20 + ex)); }
        continue;
      }
      const kind = h(1);
      if (kind < 0.35) for (let k = 0; k < 3; k++) { const px = (k - 1) * hw * 0.55 + (h(10 + k) - 0.5) * 4; if (Math.abs(px) > 5) plate(px, cy + (h(20 + k) - 0.5) * 5, Z + 0.9, 6 + h(30 + k) * 7, 5 + h(40 + k) * 6, 1.4, 0x2e3640); } // raised deck plates
      else if (kind < 0.6) { const vx = (h(2) < 0.5 ? -1 : 1) * hw * 0.45; plate(vx, cy, Z + 0.6, 10, 8, 1, 0x161a20); for (let k = 0; k < 4; k++) plate(vx, cy - 3 + k * 2, Z + 1.1, 9, 0.5, 0.5, 0x2c333d); lamp(vx, cy, Z + 0.8, 8.5, 7, 0x1c7a5c); } // vent grille
      else if (kind < 0.78) { const tx = (h(3) < 0.5 ? -1 : 1) * hw * 0.5; plate(tx, cy, Z + 3, 7, 9, 6, 0x333b46); plate(tx, cy + 2, Z + 6.5, 4, 4, 1.5, 0x3d4652); lamp(tx - 2, cy - 4.6, Z + 4.5, 1, 0.6, 0x3dffb5); lamp(tx + 2, cy - 4.6, Z + 4.5, 1, 0.6, 0x3dffb5); } // command tower
      else { for (const px of [-hw * 0.5, hw * 0.5]) plate(px, cy, Z + 0.9, 1.6, P, 1.6, 0x3a4048); } // conduits
    }
    this.bow.position.set(0, front, Z - 3); this.bowDeck.position.set(0, front + HULL.bow * 0.2, Z - 2.2); this.bow.visible = this.bowDeck.visible = front > -HULL.bow - 10;
    box.count = nb; glow.count = ng; box.instanceMatrix.needsUpdate = glow.instanceMatrix.needsUpdate = true; box.instanceColor.needsUpdate = glow.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- hive walls
  hive(w, s, dt, B) {
    const m = this.flesh, d = this.dummy ||= new (T().Object3D)(), col = this.col ||= new (T().Color)(), ramp = s.ramp || 0, sc = s.scroll || 0, t = w.t, P = 3.4;
    let n = 0;
    if (ramp > 0) for (let k = Math.floor((sc - 16) / P); k * P - sc < FIELD.H + 24; k++) {
      const y = k * P - sc;
      for (const side of [-1, 1]) {
        const depth = hiveDepth(k * P, side, ramp), edge = side * (FIELD.W / 2 - depth), h = (q) => hash(k * 2 + (side > 0 ? 1 : 0), q), r = 2.4 + h(1) * 2.2;
        const lump = (x, yy, rad, hex, z = 0) => { if (n >= 420) return; d.position.set(x, yy, z); d.rotation.set(h(2) * 3, h(3) * 3, h(4) * 3); d.scale.set(rad, rad * (0.8 + h(5) * 0.4), rad * 0.8); d.updateMatrix(); m.setMatrixAt(n, d.matrix); col.setHex(hex); m.setColorAt(n++, col); };
        lump(edge + side * r * 0.55, y, r, h(6) < 0.3 ? 0x8a3a86 : 0x6e2a70, -0.5);                     // the edge you bump into
        lump(edge + side * (depth * 0.5 + 2), y + (h(7) - 0.5) * 2, Math.max(3, depth * 0.55 + 2), 0x3b1242, -2); // wall mass behind it
        lump(side * (FIELD.W / 2 + 6), y, 7 + h(8) * 3, 0x250a2c, -3);                                  // off-screen fill
        if (k % 3 === 0) B.soft.add(edge + side * 0.6, y, 3.2, 3.2, 0, rgb(0xff5fd2), (0.25 + 0.2 * Math.sin(t * 3 + k)) * ramp); // pulsing veins
      }
    }
    m.count = n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the singularity
  horizon(w, s, dt, B) {
    const t = w.t, H = HORIZON, surge = s.surge > 0, warn = s.warn > 0;
    // the disc's banding turns (its texture spins; the mesh stays squashed flat)
    this.disc.material.map.center.set(0.5, 0.5); this.disc.material.map.rotation = t * 0.3; this.discFront.material.map.center.set(0.5, 0.5);
    this.photon.material.opacity = 0.5 + 0.2 * Math.sin(t * 5); this.lens.rotation.z = -t * 0.1;
    this.lens.scale.setScalar(1 + 0.04 * Math.sin(t * 2) + (surge ? 0.2 : 0));
    // matter spiralling in
    for (let i = 0; i < 34; i++) {
      const ph = (t * (surge ? 0.5 : 0.22) + i / 34) % 1, rad = 12 + 115 * (1 - ph) ** 1.4, a = i * 2.39 + ph * 3.2, x = H.x + Math.cos(a) * rad, y = H.y + Math.sin(a) * rad * 0.8;
      if (y < -10) continue; const tang = a + Math.PI / 2 + 0.5;
      B.streak.add(x, y, 3 + 5 * ph, 0.6, tang, rgb(i % 3 ? 0xffb070 : 0xb69cff), (0.2 + 0.55 * ph) * (surge ? 1.4 : 1));
    }
    B.soft.add(H.x, H.y, 60, 60, 0, rgb(0xff8a3d), surge ? 0.28 : 0.13);
    // a tidal surge: a warning ring closes on the singularity, then the whole field ripples inward
    if (warn) { const k = s.warn / H.telegraph, r = 12 + 150 * k; B.ring.add(H.x, H.y, r, r, t, rgb(0xffb070), 0.9 - 0.4 * k); B.ring.add(H.x, H.y, r * 0.7, r * 0.7, -t, rgb(0xff5d8f), 0.45); }
    if (surge) for (let k = 0; k < 3; k++) { const r = 20 + ((t * 70 + k * 45) % 140); B.ring.add(H.x, H.y, 160 - r, 160 - r, 0, rgb(0xb69cff), 0.25); }
  }
}
