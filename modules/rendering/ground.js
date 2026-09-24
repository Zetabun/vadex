// The home world's surface for Counterattack's Liftoff stage. The ship climbs out over a city that changes as it goes:
// the spaceport it launched from, downtown, residential streets and canals, the industrial outskirts, and finally the
// coast and open sea, before the surface sinks away into space. The layout is built row by row as rows scroll in
// (a row can be a street of lots, an avenue, a runway, a canal, a railway, a park strip, a beach or open water), lots
// can merge into larger developments, and everything sits on the ground with soft shadows. A subtle drifting mist and
// tint between the city and the fighting keeps ships and bullets readable against the buildings.
// Gun towers are ordinary enemies riding at GROUND_SPEED; this draws a pillar under each so they stand on the city.
import { GROUND_SPEED } from '@last-orbit/data/counter.js';

const Z = -10, PITCH = 26, LOT = 21, COLS = 5, ROWS = 12, BOTTOM = -50, WIDTH = COLS * PITCH + 20;
// District by distance travelled (field units from the start of the stage).
const DISTRICTS = [[0, 'spaceport'], [300, 'downtown'], [650, 'residential'], [950, 'industrial'], [1180, 'coast']];
const districtAt = (y) => { let d = DISTRICTS[0][1]; for (const [at, name] of DISTRICTS) if (y >= at) d = name; return d; };
const CAP = { slab: 260, bld: 360, shadow: 380, roof: 520, tree: 520, cyl: 90, pad: 16, pillar: 16 };
const R = Math.random, pickOf = (list) => list[Math.floor(R() * list.length)];
// The city is a backdrop: every colour is pulled toward grey and dimmed, so ships, enemies and bullets own the colour.
const MUTE = 0.5, DIM = 0.78;

function padTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#1a2130'; g.fillRect(0, 0, 128, 128);
  if (kind === 0) { g.strokeStyle = '#ffc857'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 46, 0, 7); g.stroke(); g.fillStyle = '#ffc857'; g.fillRect(44, 36, 10, 56); g.fillRect(74, 36, 10, 56); g.fillRect(44, 59, 40, 10); }
  else if (kind === 1) { g.strokeStyle = '#5ee6ff'; g.lineWidth = 4; for (const r of [52, 38]) { g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke(); } g.fillStyle = '#5ee6ff'; for (let i = 0; i < 4; i++) { g.save(); g.translate(64, 64); g.rotate(i * Math.PI / 2); g.beginPath(); g.moveTo(-8, -24); g.lineTo(0, -32); g.lineTo(8, -24); g.lineTo(8, -18); g.lineTo(0, -26); g.lineTo(-8, -18); g.fill(); g.restore(); } }
  else { for (const [r, col] of [[52, '#ff5f7a'], [40, '#e8ecf5'], [28, '#ff5f7a'], [16, '#e8ecf5']]) { g.fillStyle = col; g.beginPath(); g.arc(64, 64, r, 0, 7); g.fill(); } g.fillStyle = '#ff5f7a'; g.beginPath(); g.arc(64, 64, 7, 0, 7); g.fill(); }
  g.fillStyle = '#fff'; for (const [x, y] of [[10, 10], [118, 10], [10, 118], [118, 118]]) g.fillRect(x - 3, y - 3, 6, 6);
  return c;
}
/** Soft cloud wisps for the mist layer (tiles seamlessly enough at low opacity). */
function mistTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  for (let i = 0; i < 22; i++) {
    const x = R() * 256, y = R() * 256, r = 40 + R() * 80, grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${0.35 + R() * 0.35})`); grad.addColorStop(0.55, `rgba(255,255,255,${0.12 + R() * 0.12})`); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { g.save(); g.translate(dx, dy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
  }
  return c;
}

export class Ground {
  constructor(scene) {
    const THREE = window.THREE, box = new THREE.BoxGeometry(1, 1, 1), flat = new THREE.PlaneGeometry(1, 1);
    const inst = (geo, mat, cap) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); m.frustumCulled = false; m.count = 0; return m; };
    this.mats = [];
    const mat = (Kind, o, base = 1) => { const m = new Kind({ transparent: true, ...o }); m.baseOpacity = base; this.mats.push(m); return m; };
    this.street = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH + 60, 330), mat(THREE.MeshLambertMaterial, { color: 0x0e131d, emissive: 0x03050a })); this.street.position.set(0, 75, Z - 0.05);
    this.slab = inst(box, mat(THREE.MeshLambertMaterial, { color: 0xffffff, emissive: 0x04060b }), CAP.slab);
    this.bld = inst(box, mat(THREE.MeshLambertMaterial, { color: 0xffffff, emissive: 0x04060c }), CAP.bld);
    this.shadow = inst(flat, mat(THREE.MeshBasicMaterial, { color: 0x000000, depthWrite: false }, 0.45), CAP.shadow);
    this.roof = inst(box, mat(THREE.MeshBasicMaterial, { color: 0xffffff }), CAP.roof);
    this.tree = inst(new THREE.ConeGeometry(1, 1, 6).rotateX(Math.PI / 2), mat(THREE.MeshLambertMaterial, { color: 0xffffff, emissive: 0x020805 }), CAP.tree);
    this.cyl = inst(new THREE.CylinderGeometry(1, 1, 1, 12).rotateX(Math.PI / 2), mat(THREE.MeshLambertMaterial, { color: 0xffffff, emissive: 0x05070c }), CAP.cyl);
    this.pillar = inst(new THREE.CylinderGeometry(1, 1.25, 1, 8).rotateX(Math.PI / 2), mat(THREE.MeshLambertMaterial, { color: 0x9aa6bf, emissive: 0x0a0e18 }), CAP.pillar);
    this.pads = [0, 1, 2].map((k) => inst(flat, mat(THREE.MeshLambertMaterial, { map: new THREE.CanvasTexture(padTexture(k)), color: 0x5f6574 }), CAP.pad));
    // Mist: a gentle dark tint plus slow drifting wisps, between the rooftops and the fighting.
    this.mistTex = new THREE.CanvasTexture(mistTexture()); this.mistTex.wrapS = this.mistTex.wrapT = THREE.RepeatWrapping; this.mistTex.repeat.set(1.4, 2.6);
    this.tint = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH + 60, 330), mat(THREE.MeshBasicMaterial, { color: 0x0a1226, depthWrite: false }, 0.36)); this.tint.position.set(0, 75, -1.3); this.tint.renderOrder = 2;
    this.mist = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH + 60, 330), mat(THREE.MeshBasicMaterial, { map: this.mistTex, color: 0x8ea4c8, depthWrite: false }, 0.46)); this.mist.position.set(0, 75, -0.9); this.mist.renderOrder = 3;
    this.city = new THREE.Group(); this.city.add(this.slab, this.bld, this.shadow, this.roof, this.tree, this.cyl, ...this.pads);
    this.street.renderOrder = -6; for (const m of this.city.children) m.renderOrder = -5; this.pillar.renderOrder = -4;
    this.group = new THREE.Group(); this.group.add(this.street, this.city, this.pillar, this.tint, this.mist); this.group.visible = false; scene.add(this.group);
    this.d = new THREE.Object3D(); this.c = new THREE.Color();
    this.reset();
  }
  /** Back to the spaceport, for a fresh attempt at the stage. */
  reset() {
    this.scroll = 0; this.rows = [];
    for (let r = 0; r < ROWS; r++) { const y = BOTTOM + r * PITCH + PITCH / 2; this.rows.push({ y, plan: this.planRow(Math.max(0, y)) }); }
    this.rebuild();
  }

  // ------------------------------------------------------------------ layout
  /** One row of the city at distance y: its kind depends on the district. */
  planRow(y) {
    const district = districtAt(y), roll = R();
    const kinds = {
      spaceport: [['lots', 0.55], ['runway', 0.3], ['avenue', 0.15]],
      downtown: [['lots', 0.68], ['avenue', 0.22], ['park', 0.1]],
      residential: [['lots', 0.6], ['canal', 0.16], ['park', 0.14], ['avenue', 0.1]],
      industrial: [['lots', 0.62], ['rail', 0.26], ['avenue', 0.12]],
      coast: [['lots', 0.25], ['beach', 0.2], ['ocean', 0.55]],
    }[district];
    // The last stretch is always open sea, the first always spaceport lots, so the ends read clearly.
    let kind = 'lots', acc = 0; for (const [k, w] of kinds) { acc += w; if (roll < acc) { kind = k; break; } }
    if (y > 1330) kind = 'ocean'; if (y < 20) kind = 'lots';
    const row = { kind, district, lots: [] };
    if (kind === 'lots') for (let k = 0; k < COLS; k++) {
      const merge = k < COLS - 1 && R() < ({ downtown: 0.22, industrial: 0.25, spaceport: 0.2 }[district] || 0.08);
      row.lots.push({ col: k, span: merge ? 2 : 1, plan: this.planLot(district, merge ? 2 : 1), jx: (R() - 0.5) * 3, jy: (R() - 0.5) * 3 });
      if (merge) k++;
    }
    if (kind === 'canal') row.bridges = [0, 1].map(() => Math.floor(R() * COLS));
    if (kind === 'runway' || kind === 'avenue' || kind === 'rail') row.traffic = Array.from({ length: kind === 'rail' ? 1 : 3 + Math.floor(R() * 4) }, () => ({ x: (R() - 0.5) * WIDTH, lane: R() < 0.5 ? -1 : 1 }));
    return row;
  }
  /** What stands on a lot (span 1 or 2 columns), by district. */
  planLot(district, span) {
    const w = LOT + (span - 1) * PITCH, roll = R(), greys = [0x2b3447, 0x323c52, 0x262e3f, 0x384359, 0x2f3a4d, 0x3b3a4d];
    const light = () => (R() < 0.5 ? 0x5ee6ff : 0xffc857);
    const cluster = (maxH, minH = 1.5, colors = greys) => {
      const lays = span > 1 ? [[[0, 0, w - 5, 16]], [[-w / 4, 0, w / 2 - 4, 16], [w / 4, 0, w / 2 - 4, 16]]] : [[[0, 0, 16, 16]], [[-4.5, 0, 7, 16], [4.5, 0, 7, 16]], [[0, -4.5, 16, 7], [0, 4.5, 16, 7]], [[-4.5, -4.5, 7, 7], [4.5, -4.5, 7, 7], [-4.5, 4.5, 7, 7], [4.5, 4.5, 7, 7]], [[-4, 0, 8, 16], [4.5, -4.5, 7, 7], [4.5, 4.5, 7, 7]]];
      return pickOf(lays).map(([x, y, bw, bd]) => {
        const s = 0.72 + R() * 0.22, h = minH + R() * (maxH - minH), roof = [];
        for (let i = Math.floor(R() * 3); i > 0; i--) roof.push({ x: (R() - 0.5) * bw * s * 0.6, y: (R() - 0.5) * bd * s * 0.6, s: 0.6 + R() * 0.9, c: R() < 0.35 ? light() : 0x4b5670 });
        return { x, y, w: bw * s, d: bd * s, h, c: pickOf(colors), roof };
      });
    };
    switch (district) {
      case 'spaceport':
        if (roll < 0.4 && span === 1) return { base: 0x1a2130, pad: Math.floor(R() * 3), rot: Math.floor(R() * 4) * Math.PI / 2 };
        if (roll < 0.7) return { base: 0x1f2533, blds: [{ x: 0, y: 0, w: w - 4, d: 11, h: 2.4, c: 0x3a4660, roof: [{ x: 0, y: 0, s: 0, strip: w - 6, c: 0x5ee6ff }] }] }; // hangar with a light strip
        if (roll < 0.85) return { base: 0x1f2533, blds: [{ x: 0, y: 0, w: 3.5, d: 3.5, h: 8, c: 0x4a5670, roof: [{ x: 0, y: 0, s: 2.2, c: 0xffc857 }] }], marks: true }; // control tower
        return { base: 0x232a38, marks: true }; // open apron
      case 'downtown':
        if (span > 1 && roll < 0.3) return { base: 0x1d2433, stadium: true };
        if (roll < 0.1) return { base: 0x2a3040, blds: [{ x: 0, y: 0, w: 5, d: 5, h: 1.2, c: 0x4a5a78, roof: [{ x: 0, y: 0, s: 1.6, c: 0x5ee6ff }] }] }; // plaza fountain
        return { base: 0x1d2433, blds: cluster(8, 3) };
      case 'residential':
        if (roll < 0.22) return { base: 0x16301f, trees: this.trees(span, 6) };
        return { base: 0x1f2a24, blds: Array.from({ length: 4 + Math.floor(R() * 3) * span }, (_, i) => ({ x: (R() - 0.5) * (w - 6), y: (R() - 0.5) * 14, w: 3 + R() * 1.5, d: 3 + R() * 1.5, h: 1 + R() * 1.4, c: pickOf([0x5a4a44, 0x4d4a5a, 0x5a5448, 0x44505a]), roof: R() < 0.4 ? [{ x: 0, y: 0, s: 0.7, c: 0xffd79a }] : [] })), trees: this.trees(span, 3) };
      case 'industrial':
        if (roll < 0.35) return { base: 0x22262c, tanks: Array.from({ length: 2 + Math.floor(R() * 3) * span }, () => ({ x: (R() - 0.5) * (w - 8), y: (R() - 0.5) * 12, r: 2.2 + R() * 1.6, h: 2 + R() * 3 })) };
        if (roll < 0.55) return { base: 0x22262c, blds: [{ x: 0, y: 0, w: w - 6, d: 12, h: 3, c: 0x3f4550, roof: [] }], stacks: Array.from({ length: 1 + Math.floor(R() * 2) }, () => ({ x: (R() - 0.5) * (w - 8), y: (R() - 0.5) * 10 })) };
        return { base: 0x22262c, blds: cluster(5, 2, [0x3a3f48, 0x444a55, 0x363b44]) };
      default: // coast: fields and a few farmhouses
        return { base: pickOf([0x2a3320, 0x33301f, 0x28331f]), furrows: true, blds: R() < 0.4 ? [{ x: (R() - 0.5) * 8, y: (R() - 0.5) * 8, w: 3.5, d: 3, h: 1.4, c: 0x5a4a44, roof: [] }] : [] };
    }
  }
  trees(span, n) { return Array.from({ length: n * span + Math.floor(R() * 3) }, () => ({ x: (R() - 0.5) * (LOT - 4 + (span - 1) * PITCH), y: (R() - 0.5) * 16, r: 1.2 + R() * 1.2, h: 2 + R() * 2.5, c: R() < 0.5 ? 0x2f6b3e : 0x3d7a48 })); }

  /** Write every row into the instanced meshes (rows keep their city y). Runs only when a row scrolls off. */
  rebuild() {
    const n = { slab: 0, bld: 0, shadow: 0, roof: 0, tree: 0, cyl: 0, pads: [0, 0, 0] }, d = this.d, c = this.c;
    const put = (key, mesh, x, y, z, sx, sy, sz, rz, col) => { const i = key === 'pad' ? null : n[key]++; if (i != null && i >= CAP[key]) return; d.position.set(x, y, z); d.scale.set(sx, sy, sz); d.rotation.set(0, 0, rz || 0); d.updateMatrix(); mesh.setMatrixAt(i ?? mesh._i, d.matrix);
      c.setHex(col); const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; c.setRGB((c.r + (l - c.r) * MUTE) * DIM, (c.g + (l - c.g) * MUTE) * DIM, (c.b + (l - c.b) * MUTE) * DIM); mesh.setColorAt(i ?? mesh._i, c); };
    const slab = (x, y, w, h, col, z = 0.2, t = 0.4) => put('slab', this.slab, x, y, Z + z, w, h, t, 0, col);
    const light = (x, y, s, col, z = 0.5) => put('roof', this.roof, x, y, Z + z, s, s, s * 0.5, 0, col);
    const building = (x, y, b) => {
      put('shadow', this.shadow, x + 1.4 + b.h * 0.12, y - 1.4 - b.h * 0.12, Z + 0.42, b.w + b.h * 0.18, b.d + b.h * 0.18, 1, 0, 0);
      put('bld', this.bld, x, y, Z + 0.4 + b.h / 2, b.w, b.d, b.h, 0, b.c);
      for (const r of b.roof) { if (r.strip) put('roof', this.roof, x, y, Z + 0.5 + b.h, r.strip, 0.8, 0.3, 0, r.c); else put('roof', this.roof, x + r.x, y + r.y, Z + 0.4 + b.h + r.s / 2, r.s, r.s, r.s, 0, r.c); }
    };
    for (const row of this.rows) {
      const cy = row.y, p = row.plan;
      switch (p.kind) {
        case 'avenue': slab(0, cy, WIDTH, 16, 0x151a24, 0.05, 0.1); for (let x = -WIDTH / 2; x < WIDTH / 2; x += 9) slab(x, cy, 4, 0.5, 0x8a93a6, 0.12, 0.05); for (const t of p.traffic) { light(t.x, cy + t.lane * 4, 0.9, t.lane > 0 ? 0xfff2c2 : 0xff4d7a); light(t.x + 1.4 * t.lane, cy + t.lane * 4, 0.9, t.lane > 0 ? 0xfff2c2 : 0xff4d7a); } break;
        case 'runway': slab(0, cy, WIDTH, 18, 0x2a2f3a, 0.05, 0.1); for (let x = -WIDTH / 2; x < WIDTH / 2; x += 12) slab(x, cy, 6, 0.9, 0xe8ecf5, 0.12, 0.05); for (let x = -WIDTH / 2; x < WIDTH / 2; x += 8) { light(x, cy + 8.2, 0.7, 0xffc857); light(x + 4, cy - 8.2, 0.7, 0x5ee6ff); } break;
        case 'canal': slab(0, cy, WIDTH, 16, 0x0d2a44, 0.05, 0.1); slab(0, cy + 8.3, WIDTH, 0.8, 0x3a5a7a, 0.12, 0.2); slab(0, cy - 8.3, WIDTH, 0.8, 0x3a5a7a, 0.12, 0.2); for (const b of p.bridges) slab((b - (COLS - 1) / 2) * PITCH, cy, 6, 18, 0x3a4458, 0.6, 0.6); break;
        case 'rail': slab(0, cy, WIDTH, 12, 0x1b1e24, 0.05, 0.1); for (const off of [-2.2, 2.2]) slab(0, cy + off, WIDTH, 0.4, 0x6a7080, 0.15, 0.1); for (let x = -WIDTH / 2; x < WIDTH / 2; x += 2.5) slab(x, cy, 0.5, 6, 0x2e3440, 0.1, 0.1);
          for (const t of p.traffic) for (let k = 0; k < 5; k++) building(t.x + k * 7.5, cy, { w: 7, d: 3.4, h: 1.6, c: k === 0 ? 0xc94f5a : 0x4a5468, roof: k === 0 ? [{ x: 3, y: 0, s: 0.8, c: 0xfff2c2 }] : [] }); break;
        case 'park': slab(0, cy, WIDTH, 22, 0x16301f); for (const t of this.trees(4, 5)) put('tree', this.tree, t.x * 1.3, cy + t.y, Z + 0.4 + t.h / 2, t.r, t.r, t.h, 0, t.c); slab(0, cy, WIDTH, 1.6, 0x4a4436, 0.42, 0.05); break;
        case 'beach': slab(0, cy + 5, WIDTH, 12, 0x6b6044); slab(0, cy - 7, WIDTH, 12, 0x0d2a44, 0.05, 0.1); for (let x = -WIDTH / 2; x < WIDTH / 2; x += 11) slab(x + (x % 3), cy - 1.2, 6, 0.5, 0x9fc2e0, 0.12, 0.05); break;
        case 'ocean': slab(0, cy, WIDTH + 40, PITCH + 0.5, 0x0b2238, 0.05, 0.1); for (let i = 0; i < 6; i++) slab((((i * 37 + cy * 13) % WIDTH) + WIDTH) % WIDTH - WIDTH / 2, cy + ((i * 7) % 20) - 10, 5, 0.4, 0x5a86b0, 0.12, 0.05); break;
        default: // lots
          for (const L of p.lots) {
            const pl = L.plan, w = LOT + (L.span - 1) * PITCH, cx = (L.col + (L.span - 1) / 2 - (COLS - 1) / 2) * PITCH + L.jx, ly = cy + L.jy;
            slab(cx, ly, w, LOT, pl.base);
            if (pl.pad != null) { const pm = this.pads[pl.pad]; if (n.pads[pl.pad] < CAP.pad) { pm._i = n.pads[pl.pad]++; put('pad', pm, cx, ly, Z + 0.45, LOT - 3, LOT - 3, 1, pl.rot, 0xffffff); } }
            if (pl.marks) for (let k = -1; k <= 1; k += 2) slab(cx + k * (w / 2 - 3), ly, 1, LOT - 4, 0xffc857, 0.42, 0.05);
            if (pl.furrows) for (let k = -8; k <= 8; k += 3) slab(cx, ly + k, w - 3, 0.5, 0x1f2616, 0.42, 0.05);
            if (pl.stadium) { for (const [ox, oy, sw, sh] of [[0, 8.5, w - 4, 2.5], [0, -8.5, w - 4, 2.5], [w / 2 - 3, 0, 2.5, 17], [-(w / 2 - 3), 0, 2.5, 17]]) building(cx + ox, ly + oy, { w: sw, d: sh, h: 3, c: 0x4a5670, roof: [] }); slab(cx, ly, w - 10, 13, 0x2f7a44, 0.42, 0.05); for (let k = -1; k <= 1; k += 2) light(cx + k * (w / 2 - 3), ly + 8.5, 1.4, 0xfff2c2, 3.8); }
            for (const t of pl.trees || []) put('tree', this.tree, cx + t.x, ly + t.y, Z + 0.4 + t.h / 2, t.r, t.r, t.h, 0, t.c);
            for (const b of pl.blds || []) building(cx + b.x, ly + b.y, b);
            for (const t of pl.tanks || []) { put('shadow', this.shadow, cx + t.x + 1.2, ly + t.y - 1.2, Z + 0.42, t.r * 2.2, t.r * 2.2, 1, 0, 0); put('cyl', this.cyl, cx + t.x, ly + t.y, Z + 0.4 + t.h / 2, t.r, t.r, t.h, 0, 0x8a93a6); }
            for (const s of pl.stacks || []) { put('cyl', this.cyl, cx + s.x, ly + s.y, Z + 0.4 + 3.5, 0.9, 0.9, 7, 0, 0x5a606c); light(cx + s.x, ly + s.y, 1.1, 0xff4d7a, 7.6); }
          }
      }
    }
    for (const k of ['slab', 'bld', 'shadow', 'roof', 'tree', 'cyl']) this[k].count = Math.min(n[k], CAP[k]);
    this.pads.forEach((pm, i) => { pm.count = n.pads[i]; });
    for (const m of [this.slab, this.bld, this.shadow, this.roof, this.tree, this.cyl, ...this.pads]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }

  /** show: whether the stage has ground; fade: 1 on the surface → 0 in orbit; dt: simulated seconds; towers: ground enemies. */
  update(show, fade, dt, towers = []) {
    this.group.visible = show && fade > 0.01; if (!this.group.visible) return;
    this.scroll += GROUND_SPEED * dt; this.city.position.y = -this.scroll;
    let rebuilt = false;
    for (const row of this.rows) if (row.y - this.scroll < BOTTOM) { row.y += ROWS * PITCH; row.plan = this.planRow(row.y); rebuilt = true; }
    if (rebuilt) this.rebuild();
    // The mist drifts a little slower than the ground and a touch sideways, so it reads as a layer of its own.
    this.mistTex.offset.y += (GROUND_SPEED * 0.7 * dt) / 330 * this.mistTex.repeat.y; this.mistTex.offset.x += dt * 0.004;
    // As the ship climbs, the surface drops away and dims.
    this.group.position.z = -(1 - fade) * 70;
    for (const m of this.mats) m.opacity = m.baseOpacity * fade;
    // A pillar under every gun tower, from the street up to the gameplay plane, so the towers stand on the city.
    let n = 0; const d = this.d;
    for (const e of towers) { if (n >= CAP.pillar) break; d.position.set(e.x, e.y, Z / 2); d.scale.set(1.6, 1.6, -Z); d.rotation.set(0, 0, 0); d.updateMatrix(); this.pillar.setMatrixAt(n++, d.matrix); }
    this.pillar.count = n; this.pillar.instanceMatrix.needsUpdate = true;
  }
}
