// The home world's surface for Counterattack's Liftoff stage: a city on a street grid that scrolls beneath the ship,
// then sinks away and fades as the ship climbs to orbit. Every lot sits on the grid and everything on it is grounded:
// pavement slabs, soft shadows under buildings, rooftop details, parks, plazas and landing pads in several designs.
// Gun towers are ordinary enemies riding at GROUND_SPEED; this draws a pillar under each so they stand on the city.
// The city lives in its own coordinates: one group slides down, and a row of lots is rebuilt when it scrolls off.
import { GROUND_SPEED } from '@last-orbit/data/counter.js';

const Z = -10, PITCH = 26, LOT = 21, COLS = 5, ROWS = 12, BOTTOM = -50;
const CAP = { slab: COLS * ROWS, bld: COLS * ROWS * 4, shadow: COLS * ROWS * 4, roof: COLS * ROWS * 8, tree: COLS * ROWS * 9, pad: 14, pillar: 16 };

function padTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#1a2130'; g.fillRect(0, 0, 128, 128);
  if (kind === 0) { // helipad: amber ring and H
    g.strokeStyle = '#ffc857'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 46, 0, 7); g.stroke();
    g.fillStyle = '#ffc857'; g.fillRect(44, 36, 10, 56); g.fillRect(74, 36, 10, 56); g.fillRect(44, 59, 40, 10);
  } else if (kind === 1) { // launch ring: cyan double ring with chevrons
    g.strokeStyle = '#5ee6ff'; g.lineWidth = 4; for (const r of [52, 38]) { g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke(); }
    g.fillStyle = '#5ee6ff'; for (let i = 0; i < 4; i++) { g.save(); g.translate(64, 64); g.rotate(i * Math.PI / 2); g.beginPath(); g.moveTo(-8, -24); g.lineTo(0, -32); g.lineTo(8, -24); g.lineTo(8, -18); g.lineTo(0, -26); g.lineTo(-8, -18); g.fill(); g.restore(); }
  } else { // target: red and white rings with a dot
    for (const [r, col] of [[52, '#ff5f7a'], [40, '#e8ecf5'], [28, '#ff5f7a'], [16, '#e8ecf5']]) { g.fillStyle = col; g.beginPath(); g.arc(64, 64, r, 0, 7); g.fill(); }
    g.fillStyle = '#ff5f7a'; g.beginPath(); g.arc(64, 64, 7, 0, 7); g.fill();
  }
  g.fillStyle = '#fff'; for (const [x, y] of [[10, 10], [118, 10], [10, 118], [118, 118]]) g.fillRect(x - 3, y - 3, 6, 6); // corner lights
  return c;
}

export class Ground {
  constructor(scene) {
    const THREE = window.THREE, box = new THREE.BoxGeometry(1, 1, 1), flat = new THREE.PlaneGeometry(1, 1);
    const inst = (geo, mat, cap) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); m.frustumCulled = false; m.count = 0; return m; };
    this.mats = [];
    const mat = (Kind, o, base = 1) => { const m = new Kind({ transparent: true, ...o }); m.baseOpacity = base; this.mats.push(m); return m; };
    this.street = new THREE.Mesh(new THREE.PlaneGeometry(170, 330), mat(THREE.MeshLambertMaterial, { color: 0x0e131d, emissive: 0x03050a })); this.street.position.set(0, 75, Z - 0.05);
    this.slab = inst(box, mat(THREE.MeshLambertMaterial, { color: 0xffffff, emissive: 0x04060b }), CAP.slab);
    this.bld = inst(box, mat(THREE.MeshLambertMaterial, { color: 0xffffff, emissive: 0x04060c }), CAP.bld);
    this.shadow = inst(flat, mat(THREE.MeshBasicMaterial, { color: 0x000000, depthWrite: false }, 0.45), CAP.shadow);
    this.roof = inst(box, mat(THREE.MeshBasicMaterial, { color: 0xffffff }), CAP.roof);
    this.tree = inst(new THREE.ConeGeometry(1, 1, 6).rotateX(Math.PI / 2), mat(THREE.MeshLambertMaterial, { color: 0xffffff, emissive: 0x020805 }), CAP.tree);
    this.pillar = inst(new THREE.CylinderGeometry(1, 1.25, 1, 8).rotateX(Math.PI / 2), mat(THREE.MeshLambertMaterial, { color: 0x9aa6bf, emissive: 0x0a0e18 }), CAP.pillar);
    this.pads = [0, 1, 2].map((k) => inst(flat, mat(THREE.MeshLambertMaterial, { map: new THREE.CanvasTexture(padTexture(k)), color: 0x8a93a6 }), CAP.pad));
    this.city = new THREE.Group(); this.city.add(this.slab, this.bld, this.shadow, this.roof, this.tree, ...this.pads);
    this.group = new THREE.Group(); this.group.add(this.street, this.city, this.pillar); this.group.visible = false; scene.add(this.group);
    this.d = new THREE.Object3D(); this.c = new THREE.Color(); this.scroll = 0;
    this.rows = []; for (let r = 0; r < ROWS; r++) this.rows.push({ y: BOTTOM + r * PITCH + PITCH / 2, lots: null });
    this.rebuild();
  }
  /** Lay out every lot (rows keep their city y). Cheap enough: only runs when a row scrolls off the bottom. */
  rebuild() {
    const n = { slab: 0, bld: 0, shadow: 0, roof: 0, tree: 0, pads: [0, 0, 0] }, d = this.d, c = this.c;
    const put = (mesh, i, x, y, z, sx, sy, sz, rz, col) => { d.position.set(x, y, z); d.scale.set(sx, sy, sz); d.rotation.set(0, 0, rz || 0); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); c.setHex(col); mesh.setColorAt(i, c); };
    for (const row of this.rows) {
      row.lots ||= Array.from({ length: COLS }, () => this.planLot());
      for (let k = 0; k < COLS; k++) {
        const L = row.lots[k], cx = (k - (COLS - 1) / 2) * PITCH, cy = row.y;
        put(this.slab, n.slab++, cx, cy, Z + 0.2, LOT, LOT, 0.4, 0, L.kind === 'park' ? 0x16301f : L.kind === 'plaza' ? 0x2a3040 : 0x1d2433);
        if (L.kind === 'pad') { const p = L.pad; put(this.pads[p], n.pads[p]++, cx, cy, Z + 0.45, LOT - 3, LOT - 3, 1, L.rot, 0xffffff); }
        for (const t of L.trees || []) put(this.tree, n.tree++, cx + t.x, cy + t.y, Z + 0.4 + t.h / 2, t.r, t.r, t.h, 0, t.c);
        for (const b of L.blds || []) {
          const x = cx + b.x, y = cy + b.y;
          put(this.shadow, n.shadow++, x + 1.4 + b.h * 0.12, y - 1.4 - b.h * 0.12, Z + 0.42, b.w + b.h * 0.18, b.d + b.h * 0.18, 1, 0, 0x000000);
          put(this.bld, n.bld++, x, y, Z + 0.4 + b.h / 2, b.w, b.d, b.h, 0, b.c);
          for (const r of b.roof) put(this.roof, n.roof++, x + r.x, y + r.y, Z + 0.4 + b.h + r.s / 2, r.s, r.s, r.s, 0, r.c);
        }
      }
    }
    this.slab.count = n.slab; this.bld.count = n.bld; this.shadow.count = n.shadow; this.roof.count = n.roof; this.tree.count = n.tree; this.pads.forEach((p, i) => { p.count = n.pads[i]; });
    for (const m of [this.slab, this.bld, this.shadow, this.roof, this.tree, ...this.pads]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }
  /** What stands on one lot: a cluster of buildings (most), a park, a plaza or a landing pad. */
  planLot() {
    const R = Math.random, roll = R(), greys = [0x2b3447, 0x323c52, 0x262e3f, 0x384359, 0x2f3a4d, 0x3b3a4d];
    if (roll < 0.1) return { kind: 'pad', pad: Math.floor(R() * 3), rot: Math.floor(R() * 4) * Math.PI / 2 };
    if (roll < 0.22) return { kind: 'park', trees: Array.from({ length: 5 + Math.floor(R() * 4) }, () => ({ x: (R() - 0.5) * 16, y: (R() - 0.5) * 16, r: 1.2 + R() * 1.2, h: 2 + R() * 2.5, c: R() < 0.5 ? 0x2f6b3e : 0x3d7a48 })) };
    if (roll < 0.3) return { kind: 'plaza', blds: [{ x: 0, y: 0, w: 5, d: 5, h: 1.2, c: 0x4a5a78, roof: [{ x: 0, y: 0, s: 1.6, c: 0x5ee6ff }] }] };
    // A cluster of 1-4 buildings inside the lot, with lights and plant on the roofs.
    const layouts = [[[0, 0, 16, 16]], [[-4.5, 0, 7, 16], [4.5, 0, 7, 16]], [[0, -4.5, 16, 7], [0, 4.5, 16, 7]], [[-4.5, -4.5, 7, 7], [4.5, -4.5, 7, 7], [-4.5, 4.5, 7, 7], [4.5, 4.5, 7, 7]], [[-4, 0, 8, 16], [4.5, -4.5, 7, 7], [4.5, 4.5, 7, 7]]];
    const lay = layouts[Math.floor(R() * layouts.length)], tall = R() < 0.22;
    return { kind: 'block', blds: lay.map(([x, y, w, d]) => {
      const h = tall && R() < 0.6 ? 10 + R() * 8 : 2 + R() * 6, shrink = 0.72 + R() * 0.22, roof = [];
      for (let i = Math.floor(R() * 3); i > 0; i--) roof.push({ x: (R() - 0.5) * w * shrink * 0.6, y: (R() - 0.5) * d * shrink * 0.6, s: 0.6 + R() * 0.9, c: R() < 0.35 ? (R() < 0.5 ? 0x5ee6ff : 0xffc857) : 0x4b5670 });
      return { x, y, w: w * shrink, d: d * shrink, h, c: greys[Math.floor(R() * greys.length)], roof };
    }) };
  }
  /** show: whether the stage has ground; fade: 1 on the surface → 0 in orbit; dt: simulated seconds; towers: ground enemies. */
  update(show, fade, dt, towers = []) {
    this.group.visible = show && fade > 0.01; if (!this.group.visible) return;
    this.scroll += GROUND_SPEED * dt; this.city.position.y = -this.scroll;
    let rebuilt = false;
    for (const row of this.rows) if (row.y - this.scroll < BOTTOM) { row.y += ROWS * PITCH; row.lots = null; rebuilt = true; }
    if (rebuilt) this.rebuild();
    // As the ship climbs, the surface drops away and dims.
    this.group.position.z = -(1 - fade) * 70;
    for (const m of this.mats) m.opacity = m.baseOpacity * fade;
    // A pillar under every gun tower, from the street up to the gameplay plane, so the towers stand on the city.
    let n = 0; const d = this.d;
    for (const e of towers) { if (n >= CAP.pillar) break; d.position.set(e.x, e.y, Z / 2); d.scale.set(1.6, 1.6, -Z); d.rotation.set(0, 0, 0); d.updateMatrix(); this.pillar.setMatrixAt(n++, d.matrix); }
    this.pillar.count = n; this.pillar.instanceMatrix.needsUpdate = true;
  }
}
