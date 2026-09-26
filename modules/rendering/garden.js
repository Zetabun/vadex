// The Greenhouse: the old glasshouse on the station's arm, the first room aboard a pilot can walk into (rendering/room.js,
// data/garden.js). Glass walls and a glass roof, the Earth below, the station's solar arrays outside. The old bay by the
// doors holds a round stone planter of three beds, the seed drawer, the tap, the potting bench with the basket of blooms,
// the herbarium between the doors, and Sprig, the drone that tends it all. A glass partition shuts off the second wing
// until the Solar wings power it (Overhaul rank 4): six more beds under grow lights, and the old tree at the far end, bare,
// then in leaf, then (once every kind has grown) in flower. Each plant is built from its kind and how far it has grown.
import { Room, canvas, tex, text, drawSign } from '@last-orbit/rendering/room.js';
import { earthMaterial, nightAmount } from '@last-orbit/rendering/background.js';
import { dayKey } from '@last-orbit/data/daily.js';
import { SEEDS, SEED_BY_ID, BEDS, wingOpen } from '@last-orbit/data/garden.js';
import { growth } from '@last-orbit/progression/garden.js';
const T = () => window.THREE;

// Room: x -3.6..3.6, z -11.5 (the glass end) .. 3 (back wall, the doors); walls 3 high under a glass roof whose ridge
// is 1.5 higher. The partition between the old bay and the second wing stands at z -3.8, its doorway 1.9 wide.
const W = 3.6, FRONT = -11.5, BACK = 3, H = 3, RIDGE = 1.5, WALL_Z = -3.8, DOOR_HW = 0.95, LEAF = 0x7ddc6f, FRAME = 0xdfe6e2;
const ISLAND = { x: 0, z: -1.2, r: 1.25 }, TREE = { x: 0, z: -10.1 };
/** Where each bed's plants stand: 0-2 the three wedges of the round planter (one facing the doors), 3-8 troughs down the
 *  second wing, left and right, three plants to a trough. */
const BED_AT = [
  ...[90, 210, 330].map((d) => { const a = (d * Math.PI) / 180; return { x: ISLAND.x + Math.cos(a) * 0.72, z: ISLAND.z + Math.sin(a) * 0.72, y: 0.5, n: 1 }; }),
  ...[-5.5, -7.4, -9.3].flatMap((z) => [-1, 1].map((s) => ({ x: s * 2.35, z, y: 0.62, n: 3 }))),
];
/** How far along a plant is, in the steps it is drawn at: a sprout, in leaf, leafier, in bud, in bloom. */
const stage = (k) => (k < 0.12 ? 0 : k < 0.35 ? 1 : k < 0.6 ? 2 : k < 1 ? 3 : 4);

// Shared shapes, stretched into leaves, stems and petals, and materials by colour.
let GEO = null;
const geo = () => (GEO ||= { ball: new (T().SphereGeometry)(1, 12, 8), rod: new (T().CylinderGeometry)(1, 1, 1, 6), cone: new (T().ConeGeometry)(1, 1, 8) });
const MATS = new Map();
function mat(color, glow = 0, metal = false) {
  const k = `${color}|${glow}|${metal}`;
  if (!MATS.has(k)) { const THREE = T(); MATS.set(k, new THREE.MeshPhongMaterial({ color, shininess: metal ? 90 : 16, specular: metal ? 0xffffff : 0x1a1a1a, emissive: new THREE.Color(color).multiplyScalar(glow) })); }
  return MATS.get(k);
}

/** A plant of kind s grown to p (0..1): a sprout, a stem putting out leaves, a bud, then its flower, by its style. glow:
 *  the soft light a flower in bloom gives off. */
function buildPlant(s, p, glow) {
  const THREE = T(), G3 = geo(), g = new THREE.Group(), leafM = mat(s.leaf), stemM = mat(0x4f7a3c), bloomM = mat(s.color, s.tier === 'sector' ? 0.18 : 0.45);
  const blob = (m, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0, to = g) => { const o = new THREE.Mesh(G3.ball, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); to.add(o); return o; };
  const stem = (len, x = 0, z = 0, to = g) => { const o = new THREE.Mesh(G3.rod, stemM); o.scale.set(0.009, len, 0.009); o.position.set(x, len / 2, z); to.add(o); return o; };
  if (p < 0.12) { stem(0.05); for (const sg of [-1, 1]) blob(leafM, 0.035, 0.01, 0.016, sg * 0.03, 0.05, 0, 0, 0, sg * 0.5); return g; }
  const k = Math.min(1, (p - 0.12) / 0.6), open = p >= 1, bud = p >= 0.6 && !open;
  const top = (0.3 + 0.7 * k) * ({ fern: 0.3, shrub: 0.42, lily: 0.78, cluster: 0.52 }[s.style] || 0.6);
  const halo = (size) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: s.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 })); sp.scale.setScalar(size); return sp; };
  // leaves up the stem, round it by the golden angle
  const leaves = (n, h, size = 1) => { for (let i = 0; i < n; i++) { const a = i * 2.4, y = h * (0.15 + (0.6 * i) / Math.max(1, n)), sc = (0.6 + 0.4 * k) * size;
    const l = new THREE.Group(); l.position.y = y; l.rotation.y = a; g.add(l); blob(leafM, 0.045 * sc, 0.01, 0.1 * sc, 0, 0, 0.08 * sc, -0.45, 0, 0, l); } };
  if (s.style === 'fern') {
    // fronds arching out of the soil; spore tips that glow once it blooms
    const n = 4 + Math.round(4 * k);
    for (let i = 0; i < n; i++) { const f = new THREE.Group(); f.rotation.y = (i / n) * Math.PI * 2; g.add(f); const len = 0.1 + 0.2 * k;
      blob(leafM, 0.03, 0.01, len, 0, top * 0.55, len * 0.75, -0.6, 0, 0, f); if (open) blob(bloomM, 0.022, 0.022, 0.022, 0, top * 0.55 + len * 0.6, len * 1.45, 0, 0, 0, f); }
    if (open) { const h = halo(0.35); h.position.y = top * 0.7; g.add(h); }
    return g;
  }
  if (s.style === 'shrub') {
    // a woody stem and a round, leafy crown; in bloom, silver pods as hard as hull plate
    stem(top * 0.5); const crown = [[0, 1, 0], [0.7, 0.75, 0.2], [-0.6, 0.8, 0.3], [0.1, 0.8, -0.7], [-0.2, 0.55, 0.65]];
    for (const [x, y, z] of crown) blob(leafM, 0.11 * (0.5 + 0.5 * k), 0.09 * (0.5 + 0.5 * k), 0.11 * (0.5 + 0.5 * k), x * 0.1 * k, top * y, z * 0.1 * k);
    if (bud || open) { const pod = mat(s.color, 0.1, true); for (let i = 0; i < (open ? 9 : 4); i++) { const a = i * 2.4, r = 0.11 * k; blob(pod, 0.026, 0.034, 0.026, Math.cos(a) * r, top * (0.72 + 0.25 * Math.sin(i * 1.7)), Math.sin(a) * r); } }
    return g;
  }
  if (s.style === 'cluster') {
    // three short branches, a small flower at the end of each
    stem(top * 0.6); leaves(2 + Math.round(3 * k), top * 0.6, 0.8);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.4, x = Math.cos(a) * 0.07 * k, z = Math.sin(a) * 0.07 * k, y = top * (0.8 + 0.12 * i);
      const b = new THREE.Mesh(G3.rod, stemM); b.scale.set(0.006, y - top * 0.55, 0.006); b.position.set(x / 2, top * 0.55 + (y - top * 0.55) / 2, z / 2); b.rotation.set(z * 3, 0, -x * 3); g.add(b);
      if (bud) blob(bloomM, 0.02, 0.028, 0.02, x, y, z);
      if (open) for (let j = 0; j < 8; j++) { const pg = new THREE.Group(); pg.position.set(x, y, z); pg.rotation.y = (j / 8) * Math.PI * 2; g.add(pg); blob(bloomM, 0.013, 0.004, 0.034, 0, 0, 0.03, 0, 0, 0, pg); } }
    if (open) { const h = halo(0.3); h.position.y = top * 0.9; g.add(h); }
    return g;
  }
  // everything else: a single stem, leaves, and one flower on top
  stem(top); leaves(2 + Math.round(4 * k), top);
  const head = new THREE.Group(); head.position.y = top; head.rotation.x = -0.5; g.add(head); /* turned up to the light, so it shows from the side too */
  if (bud) blob(bloomM, 0.03 * (0.6 + p), 0.05 * (0.6 + p), 0.03 * (0.6 + p), 0, 0.03, 0, 0, 0, 0, head);
  if (!open) return g;
  const petals = (n, sx, sy, sz, r, tilt, m = bloomM) => { for (let i = 0; i < n; i++) { const pg = new THREE.Group(); pg.rotation.y = (i / n) * Math.PI * 2; head.add(pg); blob(m, sx, sy, sz, 0, 0, r, tilt, 0, 0, pg); } };
  if (s.style === 'daisy') { petals(12, 0.022, 0.01, 0.068, 0.064, -0.3); blob(mat(0x8a5a1a, 0.1), 0.042, 0.022, 0.042, 0, 0.012, 0, 0, 0, 0, head); }
  else if (s.style === 'tulip') petals(6, 0.032, 0.075, 0.016, 0.028, 0.3);
  else if (s.style === 'bell') { head.rotation.z = 0.5; petals(5, 0.028, 0.06, 0.012, 0.022, Math.PI - 0.45); }
  else if (s.style === 'star') { for (let i = 0; i < 5; i++) { const pg = new THREE.Group(); pg.rotation.y = (i / 5) * Math.PI * 2; head.add(pg); const c = new THREE.Mesh(G3.cone, bloomM); c.scale.set(0.034, 0.11, 0.012); c.rotation.x = Math.PI / 2 - 0.3; c.position.set(0, 0.015, 0.06); pg.add(c); } }
  else if (s.style === 'lily') petals(6, 0.034, 0.12, 0.012, 0.05, 0.9);
  const h = halo(s.tier === 'sector' ? 0.28 : 0.55); h.position.y = 0.02; head.add(h);
  return g;
}

export class GardenRoom extends Room {
  constructor() {
    super({ w: W, front: FRONT, back: BACK, h: H, start: [0, 1.9, 0] });
    this.shell({ open: true, glassWalls: true, floor: '#2d2a24', wall: '#2e3a31', stud: '#56643e', tick: 'rgba(125,220,111,.22)', strip: LEAF, cove: 0xc8f5b4, frame: FRAME, rib: FRAME,
      lamp: 0xfff0d6, lampI: 0.42, hemi: 0.62, sky: 0xeefff0, sun: 0.5, window: { hw: W - 0.12, y0: 0.42, y1: H - 0.06, struts: [-1.2, 1.2] }, lamps: [1.2, -1.8], ribs: [-10.4, -8.35, -6.45, -1.95, 1.85] });
    this.nearFront = 0.9;
    const c = canvas(64, 64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    this.glow = tex(c);
    this.roof(); this.partition(); this.furnish(); this.outside(); this.sprig = this.makeSprig();
    this.plants = Array.from({ length: BEDS }, () => ({ key: '', group: null })); this.puffs = []; this.waterQ = []; this.sprigAt = 0;
    this.solids.push({ x: ISLAND.x, z: ISLAND.z, r: ISLAND.r + 0.1 }, { x: TREE.x, z: TREE.z, r: 0.95 });
    for (const b of BED_AT.slice(3)) this.blocks.push({ x0: b.x - 0.4, x1: b.x + 0.4, z0: b.z - 0.95, z1: b.z + 0.95 });
    for (const s of [-1, 1]) this.blocks.push({ x0: s < 0 ? -W : DOOR_HW, x1: s < 0 ? -DOOR_HW : W, z0: WALL_Z - 0.12, z1: WALL_Z + 0.12 });
    this.doorway = { x0: -DOOR_HW, x1: DOOR_HW, z0: WALL_Z - 0.12, z1: WALL_Z + 0.12 }; /* shut until the Solar wings */
    this.blocks.push({ x0: W - 0.62, x1: W, z0: -1.75, z1: 1.2 }, { x0: -W, x1: -W + 0.7, z0: 0.05, z1: 1.55 }); /* the bench and the drawer; the barrel */
  }
  // ---------------------------------------------------------------- the glass
  roof() {
    const THREE = T(), S = this.scene, frame = new THREE.MeshPhongMaterial({ color: FRAME, specular: 0x9aa8a0, shininess: 40 });
    const glass = new THREE.MeshPhongMaterial({ color: 0xe6f6ff, transparent: true, opacity: 0.08, specular: 0xffffff, shininess: 120, side: THREE.DoubleSide, depthWrite: false });
    // the two slopes of the roof, and a gable of glass at the far end
    const quad = (pts) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); return g; };
    for (const s of [-1, 1]) S.add(new THREE.Mesh(quad([[s * W, H, FRONT], [0, H + RIDGE, FRONT], [0, H + RIDGE, BACK], [s * W, H, BACK]]), glass));
    const tri = (z, m) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-W, H, z, W, H, z, 0, H + RIDGE, z], 3)); g.computeVertexNormals(); S.add(new THREE.Mesh(g, m)); };
    tri(FRONT, glass); tri(BACK - 0.01, new THREE.MeshPhongMaterial({ color: 0x2e3a31, side: THREE.DoubleSide }));
    // rafters every so often, the ridge and a purlin down each slope, all in white-painted steel
    const len = Math.hypot(W, RIDGE), pitch = Math.atan2(RIDGE, W);
    for (let z = BACK - 0.05; z > FRONT - 0.01; z -= 1.45) for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.07), frame); r.position.set((s * W) / 2, H + RIDGE / 2, Math.max(FRONT + 0.04, z)); r.rotation.z = s * -pitch; S.add(r); }
    const along = (x, y, t = 0.08) => { const b = new THREE.Mesh(new THREE.BoxGeometry(t, t, BACK - FRONT), frame); b.position.set(x, y, (FRONT + BACK) / 2); S.add(b); };
    along(0, H + RIDGE, 0.11); for (const s of [-1, 1]) { along((s * W) / 2, H + RIDGE / 2); along(s * (W - 0.04), H - 0.02, 0.1); }
    // down the glass walls: a low sill and a rail at waist height
    for (const s of [-1, 1]) { const sill = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, BACK - FRONT), new THREE.MeshPhongMaterial({ color: 0x5a5448, shininess: 10 })); sill.position.set(s * (W - 0.08), 0.21, (FRONT + BACK) / 2); S.add(sill);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, BACK - FRONT), frame); rail.position.set(s * (W - 0.03), 1.25, (FRONT + BACK) / 2); S.add(rail); }
  }
  /** The glass wall across the room between the old bay and the second wing, a doorway in it: shut and dark until the
   *  Solar wings power the wing. */
  partition() {
    const THREE = T(), S = this.scene, frame = new THREE.MeshPhongMaterial({ color: FRAME, specular: 0x9aa8a0, shininess: 40 }), g = new THREE.Group(); g.position.z = WALL_Z; S.add(g);
    const glass = new THREE.MeshPhongMaterial({ color: 0xe6f6ff, transparent: true, opacity: 0.1, specular: 0xffffff, shininess: 120, side: THREE.DoubleSide, depthWrite: false });
    const box = (w, h, d, x, y, m = frame) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, 0); g.add(b); return b; };
    for (const s of [-1, 1]) { const pw = W - DOOR_HW, pane = new THREE.Mesh(new THREE.PlaneGeometry(pw, H), glass); pane.position.set(s * (DOOR_HW + pw / 2), H / 2, 0); g.add(pane);
      box(0.09, H, 0.1, s * DOOR_HW, H / 2); box(0.06, H, 0.08, s * (DOOR_HW + pw / 2), H / 2); box(pw, 0.06, 0.08, s * (DOOR_HW + pw / 2), 1.25); box(pw, 0.36, 0.1, s * (DOOR_HW + pw / 2), 0.18); }
    const lintel = new THREE.Mesh(new THREE.PlaneGeometry(2 * DOOR_HW, H - 2.5), glass); lintel.position.set(0, 2.5 + (H - 2.5) / 2, 0); g.add(lintel); box(2 * DOOR_HW, 0.09, 0.1, 0, 2.5); box(2 * DOOR_HW + 0.1, 0.08, 0.1, 0, H - 0.04);
    // shut: a glass door taped across (tap it for why); open, just the doorway
    this.shut = new THREE.Group(); g.add(this.shut);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2 * DOOR_HW, 2.5), glass); door.position.y = 1.25; this.shut.add(door);
    const tc = canvas(512, 64), t2 = tc.getContext('2d'); t2.fillStyle = '#ffc857'; t2.fillRect(0, 0, 512, 64); t2.fillStyle = '#1a1406'; for (let i = -64; i < 512; i += 40) { t2.beginPath(); t2.moveTo(i, 64); t2.lineTo(i + 20, 64); t2.lineTo(i + 64, 0); t2.lineTo(i + 44, 0); t2.fill(); }
    t2.fillStyle = '#1a1406'; t2.fillRect(146, 8, 220, 48); text(t2, 'NO POWER', 256, 33, '800 30px sans-serif', '#ffc857');
    for (const [y, r] of [[1.55, -0.12], [0.95, 0.1]]) { const band = new THREE.Mesh(new THREE.PlaneGeometry(2 * DOOR_HW + 0.1, 0.22), new THREE.MeshBasicMaterial({ map: tex(tc), side: THREE.DoubleSide })); band.position.set(0, y, 0.02); band.rotation.z = r; this.shut.add(band); }
    this.hitBox(this.shut, 2 * DOOR_HW, 2.5, 0.3, 0, 1.25, 0); this.tag(this.shut, 'wing');
    // the sign over the doorway, facing the old bay
    this.signC = canvas(768, 96); this.sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), new THREE.MeshBasicMaterial({ map: tex(this.signC), transparent: true })); this.sign.position.set(0, 2.76, 0.07); g.add(this.sign);
  }
  // ---------------------------------------------------------------- the beds, the bench, the tap, the drawer
  furnish() {
    const THREE = T(), S = this.scene, Ph = (o) => new THREE.MeshPhongMaterial(o), G3 = geo();
    const stone = Ph({ color: 0x8a8576, specular: 0x333333, shininess: 12 }), soil = (this.soilMat = Ph({ color: 0x3a2618, shininess: 4 })), wood = Ph({ color: 0x7a5534, specular: 0x2a1a0a, shininess: 20 }), brass = Ph({ color: 0xd9a441, emissive: 0x2a1c06, specular: 0xfff0c0, shininess: 70 });
    const dry = (this.drySoil = Ph({ color: 0x6a5238, shininess: 4 }));
    // the round planter: a stone drum, three wedges of soil, a brass sprinkler in the middle
    const isl = new THREE.Group(); isl.position.set(ISLAND.x, 0, ISLAND.z); S.add(isl);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND.r, ISLAND.r + 0.08, 0.46, 40), stone); drum.position.y = 0.23; isl.add(drum);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(ISLAND.r - 0.02, 0.06, 8, 48), stone); lip.rotation.x = Math.PI / 2; lip.position.y = 0.47; isl.add(lip);
    const earthTop = new THREE.Mesh(new THREE.CircleGeometry(ISLAND.r - 0.06, 40), soil); earthTop.rotation.x = -Math.PI / 2; earthTop.position.y = 0.475; isl.add(earthTop);
    for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + (k + 0.5) * (2 * Math.PI / 3), wall = new THREE.Mesh(new THREE.BoxGeometry(ISLAND.r - 0.2, 0.1, 0.06), stone); wall.position.set(Math.cos(a) * (ISLAND.r / 2 + 0.05), 0.5, Math.sin(a) * (ISLAND.r / 2 + 0.05)); wall.rotation.y = -a; isl.add(wall); }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.22, 12), brass); post.position.y = 0.58; isl.add(post);
    const rose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10), brass); rose.position.y = 0.72; isl.add(rose);
    // the troughs down the second wing
    this.troughSoil = [];
    for (const b of BED_AT.slice(3)) { const t = new THREE.Group(); t.position.set(b.x, 0, b.z); S.add(t);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.56, 1.8), wood); body.position.y = 0.28; t.add(body);
      for (const s of [-1, 1]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.04, 0.05), Ph({ color: 0x3a3a3a })); band.position.set(0, 0.46, s * 0.8); t.add(band); }
      const top = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.7), dry); top.rotation.x = -Math.PI / 2; top.position.y = 0.6; t.add(top); this.troughSoil.push(top);
      const stalks = new THREE.Group(); t.add(stalks); for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(G3.cone, Ph({ color: 0x6a5a3a })); c.scale.set(0.012, 0.18 + Math.random() * 0.12, 0.012); c.position.set((Math.random() - 0.5) * 0.4, 0.68, (Math.random() - 0.5) * 1.4); c.rotation.z = (Math.random() - 0.5) * 0.8; stalks.add(c); } t.userData.stalks = stalks; }
    // each bed: a light that says how it is doing (dark: empty; amber: growing; green, pulsing: in bloom)
    this.leds = BED_AT.map((b, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0x223322 })); if (i < 3) { const a = Math.atan2(b.z - ISLAND.z, b.x - ISLAND.x); m.position.set(ISLAND.x + Math.cos(a) * (ISLAND.r + 0.02), 0.34, ISLAND.z + Math.sin(a) * (ISLAND.r + 0.02)); } else m.position.set(b.x - Math.sign(b.x) * 0.37, 0.4, b.z + 0.7); S.add(m); return m; });
    // tapping a bed (the drum's wedges and the troughs are tagged by bed; the drum's middle as the nearest wedge)
    BED_AT.forEach((b, i) => { const hb = this.hitBox(S, i < 3 ? 0.9 : 0.8, i < 3 ? 1.1 : 1.3, i < 3 ? 0.9 : 1.9, b.x, 0.55, b.z); this.tag(hb, 'bed' + i); });
    // the grow lights over the troughs, dark until the wing has power
    this.growMat = new THREE.MeshBasicMaterial({ color: 0x2a2230 }); this.growLights = [];
    for (const b of BED_AT.slice(3)) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 1.7), this.growMat); bar.position.set(b.x, 2.45, b.z); S.add(bar);
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, H + RIDGE * (1 - Math.abs(b.x) / W) - 2.45, 4), Ph({ color: 0x888888 })); const top = H + RIDGE * (1 - Math.abs(b.x) / W); w.position.set(b.x, (2.45 + top) / 2, b.z + s * 0.7); S.add(w); } }
    this.wingLights = [-6.4, -8.6].map((z) => { const l = new THREE.PointLight(0xff8ae0, 0, 7, 1.6); l.position.set(0, 2.6, z); S.add(l); return l; });
    // the seed drawer: a cabinet of nine small drawers on the right wall, one to a kind, labelled
    const cab = new THREE.Group(); cab.position.set(W - 0.3, 0, 0.6); cab.rotation.y = -Math.PI / 2; S.add(cab);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.25, 0.5), wood); body.position.y = 0.625; cab.add(body);
    const topSlab = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.05, 0.56), Ph({ color: 0x5a3f26 })); topSlab.position.y = 1.27; cab.add(topSlab);
    this.drawC = canvas(512, 512); this.drawers = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshPhongMaterial({ map: tex(this.drawC), shininess: 20 })); this.drawers.position.set(0, 0.65, 0.255); cab.add(this.drawers);
    for (let i = 0; i < 3; i++) { const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 12), new THREE.MeshPhongMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35, shininess: 100 })); jar.position.set(-0.35 + i * 0.35, 1.38, 0); cab.add(jar); }
    this.hitBox(cab, 1.3, 1.5, 0.6, 0, 0.75, 0); this.tag(cab, 'seeds');
    // the potting bench beside it, pots and a trowel, and on it the basket of blooms for the next sortie
    const bench = new THREE.Group(); bench.position.set(W - 0.35, 0, -0.95); bench.rotation.y = -Math.PI / 2; S.add(bench);
    const bt = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.6), wood); bt.position.y = 0.86; bench.add(bt);
    for (const [x, z] of [[-0.64, -0.24], [0.64, -0.24], [-0.64, 0.24], [0.64, 0.24]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.86, 0.06), wood); leg.position.set(x, 0.43, z); bench.add(leg); }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.5), wood); shelf.position.y = 0.25; bench.add(shelf);
    const clay = Ph({ color: 0xb8653a, shininess: 10 }); for (const [x, y, s] of [[-0.5, 0.95, 1], [-0.32, 0.93, 0.8], [0.45, 0.33, 1.2], [0.1, 0.33, 1]]) { const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.05 * s, 0.14 * s, 14), clay); pot.position.set(x, y, 0.05); bench.add(pot); }
    const basket = (this.basket = new THREE.Group()); basket.position.set(0.25, 0.89, 0); bench.add(basket);
    const wc = canvas(64, 32), wx = wc.getContext('2d'); wx.fillStyle = '#a8763e'; wx.fillRect(0, 0, 64, 32); wx.strokeStyle = '#6a4420'; wx.lineWidth = 3; for (let i = 0; i < 64; i += 8) { wx.beginPath(); wx.moveTo(i, 0); wx.lineTo(i + 4, 32); wx.stroke(); } for (let j = 4; j < 32; j += 8) { wx.beginPath(); wx.moveTo(0, j); wx.lineTo(64, j); wx.stroke(); }
    const weave = Ph({ map: tex(wc, [4, 1]), shininess: 6, side: THREE.DoubleSide }), bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.17, 20, 1, true), weave); bowl.position.y = 0.085; basket.add(bowl);
    const base = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), weave); base.rotation.x = -Math.PI / 2; base.position.y = 0.005; basket.add(base);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 6, 24, Math.PI), weave); handle.position.y = 0.17; basket.add(handle);
    this.fruit = new THREE.Group(); basket.add(this.fruit);
    this.hitBox(bench, 1.5, 1.2, 0.7, 0, 0.6, 0); this.tag(bench, 'basket');
    // the tap on the left wall, a hose on its reel and a rain barrel: water the beds here, once a day
    const tap = new THREE.Group(); tap.position.set(-W + 0.08, 0, 0.8); tap.rotation.y = Math.PI / 2; S.add(tap);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 10), brass); pipe.position.set(0, 0.6, 0); tap.add(pipe);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 10), brass); spout.rotation.x = Math.PI / 2; spout.position.set(0, 1.15, 0.1); tap.add(spout);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 16), Ph({ color: 0xc0392b })); wheel.position.set(0, 1.25, 0.03); tap.add(wheel);
    const reel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 24), Ph({ color: 0x3aa84a, shininess: 30 })); reel.position.set(0.1, 0.75, 0.12); tap.add(reel);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.75, 20), wood); barrel.position.set(-0.6, 0.375, 0.32); tap.add(barrel);
    for (const y of [0.15, 0.6]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.012, 6, 24), Ph({ color: 0x3a3a3a })); hoop.rotation.x = Math.PI / 2; hoop.position.set(-0.6, y, 0.32); tap.add(hoop); }
    this.waterTop = new THREE.Mesh(new THREE.CircleGeometry(0.27, 20), new THREE.MeshPhongMaterial({ color: 0x3a8ab8, shininess: 120, specular: 0xffffff })); this.waterTop.rotation.x = -Math.PI / 2; this.waterTop.position.set(-0.6, 0.7, 0.32); tap.add(this.waterTop);
    this.tapLed = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb547 })); this.tapLed.position.set(0, 1.42, 0.03); tap.add(this.tapLed);
    this.hitBox(tap, 1.6, 1.6, 0.8, -0.25, 0.8, 0.2); this.tag(tap, 'water');
    // the herbarium between the doors: a pressed specimen of every kind grown
    this.herbC = canvas(1024, 640); this.herb = this.screen(S, this.herbC, 1.6, 1.0, -0.1, 1.95, BACK - 0.03, Math.PI, 0x5a3f26); this.tag(this.herb, 'herbarium');
    // the doors, on the back wall
    this.door(S, 2.1, BACK, 0, 'HANGAR  ›', 'exit', { sign: '#eaffe0', edge: LEAF });
    this.deckDoor = null;
    // the old tree at the end of the second wing, in a round bed of its own
    const tp = new THREE.Group(); tp.position.set(TREE.x, 0, TREE.z); S.add(tp);
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.42, 32), stone); tb.position.y = 0.21; tp.add(tb);
    const tsoil = new THREE.Mesh(new THREE.CircleGeometry(0.8, 32), soil); tsoil.rotation.x = -Math.PI / 2; tsoil.position.y = 0.425; tp.add(tsoil);
    const bark = Ph({ color: 0x5a3e28, shininess: 8 }), limb = (r0, r1, len, x, y, z, rx, rz) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 8), bark); l.position.set(x, y, z); l.rotation.set(rx, 0, rz); tp.add(l); return l; };
    limb(0.16, 0.1, 1.9, 0, 1.35, 0, 0, 0.05); limb(0.08, 0.035, 1.0, -0.38, 2.35, 0.05, 0.1, 0.75); limb(0.08, 0.035, 1.0, 0.4, 2.45, -0.05, -0.1, -0.7); limb(0.07, 0.03, 0.9, 0.05, 2.55, 0.35, 0.8, 0.1); limb(0.06, 0.025, 0.8, -0.1, 2.5, -0.38, -0.85, -0.1);
    this.canopy = new THREE.Group(); tp.add(this.canopy); this.blossom = new THREE.Group(); tp.add(this.blossom);
    const green = Ph({ color: 0x4f9a42, shininess: 10 }), pink = Ph({ color: 0xffc6e4, emissive: 0x3a1a2a, shininess: 30 });
    for (const [x, y, z, r] of [[0, 3.05, 0, 0.62], [-0.72, 2.8, 0.1, 0.46], [0.74, 2.9, -0.1, 0.48], [0.1, 2.85, 0.62, 0.44], [-0.1, 2.8, -0.62, 0.44], [0.4, 3.25, 0.3, 0.38], [-0.4, 3.2, -0.25, 0.38]]) {
      const c = new THREE.Mesh(G3.ball, green); c.scale.setScalar(r); c.position.set(x, y, z); this.canopy.add(c);
      for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(G3.ball, pink); b.scale.setScalar(0.07); const a = i * 2.4 + x, e = 0.3 + (i % 3) * 0.35; b.position.set(x + Math.cos(a) * Math.cos(e) * r, y + Math.sin(e) * r, z + Math.sin(a) * Math.cos(e) * r); this.blossom.add(b); } }
    this.hitBox(tp, 2, 3.8, 2, 0, 1.9, 0); this.tag(tp, 'tree');
  }
  /** Sprig: the drone that tends the beds, a little round body with a spout under it and two rotors. */
  makeSprig() {
    const THREE = T(), g = new THREE.Group(), Ph = (o) => new THREE.MeshPhongMaterial(o); g.position.set(0.9, 1.4, 0.2); this.scene.add(g);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), Ph({ color: 0xeef4ea, specular: 0xffffff, shininess: 80 })); g.add(body);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 24), Ph({ color: LEAF, emissive: 0x1a3a14 })); band.rotation.x = Math.PI / 2; g.add(band);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), new THREE.MeshBasicMaterial({ color: 0x9ff0ff })); eye.position.z = 0.121; g.add(eye);
    const spout = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 10), Ph({ color: 0xd9a441, shininess: 60 })); spout.rotation.x = Math.PI; spout.position.y = -0.15; g.add(spout);
    this.rotors = [-1, 1].map((s) => { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 0.02), Ph({ color: 0x8a948c })); arm.position.set(s * 0.16, 0.06, 0); g.add(arm);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.006, 16), new THREE.MeshBasicMaterial({ color: 0xcfe8d8, transparent: true, opacity: 0.45 })); r.position.set(s * 0.22, 0.075, 0); g.add(r); return r; });
    this.hitBox(g, 0.5, 0.45, 0.5, 0, 0, 0); this.tag(g, 'sprig'); this.sprigV = new THREE.Vector3(); this.sprigGo = g.position.clone(); return g;
  }
  // ---------------------------------------------------------------- outside
  /** The Earth below, the stars and the sun through the glass, and the station's solar arrays out along the arm: bare
   *  trusses and a few salvaged panels until the Solar wings are built. */
  outside() {
    const THREE = T(), S = this.scene;
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(600, 96, 64), earthMaterial()); this.earth.position.set(0, -640, -520); this.earth.rotation.x = 1.1; S.add(this.earth);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(622, 64, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN, vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN, vV; void main(){ float k = pow(1. - abs(dot(vN, vV)), 3.5); gl_FragColor = vec4(vec3(.3, .6, 1.) * k * 1.4, k); }' }));
    atmo.position.copy(this.earth.position); S.add(atmo); this.sunDir = new THREE.Vector3(-0.5, 0.75, 0.3).normalize();
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); pos.set([Math.cos(a) * r * 1800, Math.abs(u) * 1800 - 60, Math.sin(a) * r * 1800], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); S.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })));
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: 0xfff4d8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sun.position.set(-500, 820, 300); sun.scale.setScalar(260); S.add(sun);
    // the arrays: a truss boom out each side, a row of panel frames on it
    const truss = new THREE.MeshPhongMaterial({ color: 0x9aa4b6, specular: 0x444c5c, shininess: 30 }), cells = canvas(128, 256), cx = cells.getContext('2d');
    cx.fillStyle = '#10244a'; cx.fillRect(0, 0, 128, 256); cx.strokeStyle = '#6aa0e0'; cx.lineWidth = 2; for (let x = 0; x <= 128; x += 32) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, 256); cx.stroke(); } for (let y = 0; y <= 256; y += 32) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(128, y); cx.stroke(); }
    const panel = new THREE.MeshPhongMaterial({ map: tex(cells), specular: 0x9fc8ff, shininess: 90 });
    this.panels = []; this.array = new THREE.Group(); S.add(this.array);
    for (const s of [-1, 1]) { const boom = new THREE.Mesh(new THREE.BoxGeometry(34, 0.35, 0.35), truss); boom.position.set(s * (W + 18), -1.4, -4.5); this.array.add(boom);
      for (let i = 0; i < 6; i++) { const x = s * (W + 3.5 + i * 5.2), f = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.1, 8), truss); f.position.set(x, -1.2, -4.5); this.array.add(f);
        const p = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 7.8), panel); p.position.set(x, -1.14, -4.5); this.array.add(p); this.panels.push({ p, salvaged: i === 1 || (s > 0 && i === 3) }); } }
    this.tag(this.hitBox(S, 2 * W - 0.4, H - 0.6, 0.1, 0, 1.7, FRONT + 0.1), 'window');
  }
  // ---------------------------------------------------------------- what is growing (rebuilt as it changes)
  sync(state) {
    const g = state.garden || {}, now = Date.now(), wing = wingOpen(state), deck = (state.prestige?.level || 0) >= 1, basket = SEEDS.filter((s) => g.basket?.[s.id] > 0).map((s) => s.id);
    const beds = Array.from({ length: BEDS }, (_, i) => (g.beds?.[i] ? `${g.beds[i].id}:${stage(growth(state, i, now))}` : '-')), full = SEEDS.every((s) => g.grown?.[s.id]);
    this.bloom = beds.map((b) => b.endsWith(':4')); this.growing = beds.map((b) => b !== '-' && !b.endsWith(':4')); this.watered = g.wateredDay === dayKey();
    const sig = [beds.join(','), wing, deck, full, basket.join(','), SEEDS.map((s) => `${g.seeds?.[s.id] || 0}/${g.grown?.[s.id] || 0}`).join(',')].join('|');
    if (sig === this.sig) return; this.sig = sig;
    beds.forEach((key, i) => { const slot = this.plants[i]; if (slot.key === key) return; slot.key = key; if (slot.group) { this.scene.remove(slot.group); slot.group = null; }
      const p = g.beds?.[i]; if (!p) return; const s = SEED_BY_ID[p.id], b = BED_AT[i], k = growth(state, i, now), grp = new (T().Group)(); grp.position.set(b.x, b.y, b.z);
      for (let j = 0; j < b.n; j++) { const pl = buildPlant(s, k, this.glow); pl.position.z = (j - (b.n - 1) / 2) * 0.55; pl.rotation.y = i * 1.3 + j * 2.1; pl.userData.ph = i + j * 1.7; pl.scale.setScalar(b.n > 1 ? 1.4 : 1.55); grp.add(pl); }
      this.scene.add(grp); slot.group = grp; });
    // the second wing: powered or dark
    this.shut.visible = !wing; const di = this.blocks.indexOf(this.doorway); if (wing && di >= 0) this.blocks.splice(di, 1); else if (!wing && di < 0) this.blocks.push(this.doorway);
    this.untag(this.shut); if (!wing) this.tag(this.shut, 'wing');
    this.growMat.color.setHex(wing ? 0xff7ae0 : 0x2a2230); for (const l of this.wingLights) l.intensity = wing ? 0.45 : 0;
    for (const t of this.troughSoil) t.material = wing ? this.soilMat : this.drySoil; for (const o of this.scene.children) if (o.userData.stalks) o.userData.stalks.visible = !wing;
    for (const { p, salvaged } of this.panels) p.visible = wing || salvaged;
    const sx = this.signC.getContext('2d'); sx.clearRect(0, 0, 768, 96); drawSign(sx, 'GREENHOUSE · SECOND WING', wing ? 'GROW LIGHTS ON · SIX MORE BEDS' : 'NO POWER UNTIL THE SOLAR WINGS · OVERHAUL RANK 4', '#eaffe0', wing ? '#7ddc6f' : '#ffc857'); this.sign.material.map.needsUpdate = true;
    this.canopy.visible = wing || full; this.blossom.visible = full;
    // the door back to the Command Deck, sealed until there is one
    if (this.deckDoorOpen !== deck) { this.deckDoorOpen = deck; if (this.deckDoor) { this.scene.remove(this.deckDoor); this.untag(this.deckDoor); }
      this.deckDoor = new (T().Group)(); this.scene.add(this.deckDoor); this.door(this.deckDoor, -2.1, BACK, 0, 'COMMAND DECK  ›', 'deck', { sealed: !deck, sign: '#9ff0ff', edge: 0x5ee6ff }); }
    this.drawDrawers(g); this.drawHerbarium(g, full); this.fillBasket(basket);
  }
  /** The drawer fronts: each kind's name and how many seeds are in it. */
  drawDrawers(g) {
    const x = this.drawC.getContext('2d'); x.fillStyle = '#5a3f26'; x.fillRect(0, 0, 512, 512);
    SEEDS.forEach((s, i) => { const cx = 14 + (i % 3) * 164, cy = 14 + Math.floor(i / 3) * 164, n = g.seeds?.[s.id] || 0, col = '#' + s.color.toString(16).padStart(6, '0');
      x.fillStyle = '#7a5534'; x.fillRect(cx, cy, 156, 156); x.strokeStyle = '#3a2614'; x.lineWidth = 4; x.strokeRect(cx + 2, cy + 2, 152, 152);
      x.fillStyle = '#efe3c8'; x.fillRect(cx + 22, cy + 22, 112, 52); x.fillStyle = col; x.fillRect(cx + 22, cy + 22, 10, 52);
      const label = s.name.split(' ')[0].toUpperCase(); let px = 20; do x.font = `800 ${px}px sans-serif`; while (x.measureText(label).width > 96 && (px -= 1) > 10); text(x, label, cx + 84, cy + 48, x.font, '#3a2614');
      x.fillStyle = '#d9a441'; x.beginPath(); x.arc(cx + 78, cy + 112, 12, 0, Math.PI * 2); x.fill(); if (n) text(x, `×${n}`, cx + 78, cy + 138, '800 20px sans-serif', '#fff2c8'); });
    this.drawers.material.map.needsUpdate = true;
  }
  /** The herbarium: a pressed specimen of every kind grown, a pencilled outline for the rest. */
  drawHerbarium(g, full) {
    const x = this.herbC.getContext('2d'); x.fillStyle = '#f2ead6'; x.fillRect(0, 0, 1024, 640); x.strokeStyle = '#b8a47a'; x.lineWidth = 6; x.strokeRect(10, 10, 1004, 620);
    text(x, 'HERBARIUM', 512, 52, '800 40px serif', '#3a2c1a'); text(x, full ? 'Every kind grown · the Verdant paint is yours' : `${SEEDS.filter((s) => g.grown?.[s.id]).length} of ${SEEDS.length} kinds grown`, 512, 92, 'italic 600 24px serif', '#6a5a3a');
    SEEDS.forEach((s, i) => { const cx = 190 + (i % 3) * 322, cy = 150 + Math.floor(i / 3) * 160, got = g.grown?.[s.id] || 0, col = '#' + s.color.toString(16).padStart(6, '0');
      x.save(); x.translate(cx - 130, cy); x.globalAlpha = got ? 1 : 0.35; x.strokeStyle = got ? '#4f7a3c' : '#9a8a6a'; x.lineWidth = 4; x.setLineDash(got ? [] : [6, 6]);
      x.beginPath(); x.moveTo(40, 120); x.quadraticCurveTo(30, 70, 44, 30); x.stroke(); x.beginPath(); x.ellipse(26, 84, 16, 6, -0.6, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.ellipse(58, 70, 16, 6, 0.6, 0, Math.PI * 2); x.stroke();
      x.fillStyle = got ? col : 'transparent'; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; x.beginPath(); x.ellipse(44 + Math.cos(a) * 14, 26 + Math.sin(a) * 14, 11, 6, a, 0, Math.PI * 2); if (got) x.fill(); x.stroke(); }
      x.restore(); x.globalAlpha = 1;
      text(x, got ? s.name : '?', cx, cy + 40, `700 ${got ? 26 : 30}px serif`, got ? '#3a2c1a' : '#9a8a6a', 'left'); if (got) text(x, `grown ×${got}`, cx, cy + 72, 'italic 20px serif', '#6a5a3a', 'left'); });
    this.herb.userData.face.material.map.needsUpdate = true;
  }
  /** The basket on the bench: one bloom for every kind in it, waiting for the next sortie. */
  fillBasket(ids) {
    const THREE = T(), G3 = geo(); this.fruit.clear();
    ids.forEach((id, i) => { const s = SEED_BY_ID[id], a = i * 2.4, r = 0.05 + 0.07 * (i % 3) / 2, b = new THREE.Mesh(G3.ball, mat(s.color, 0.3)); b.scale.set(0.05, 0.035, 0.05); b.position.set(Math.cos(a) * r, 0.13 + (i % 4) * 0.012, Math.sin(a) * r); this.fruit.add(b); });
  }
  /** Watered: Sprig flies round the beds still growing, misting each. */
  watering() { this.waterQ = this.growing.map((g, i) => (g ? i : -1)).filter((i) => i >= 0); this.waterT = 0; }
  /** Harvested: a puff of petals from the bed, in the colour of what grew there. */
  burst(i, id) { const b = BED_AT[i], s = SEED_BY_ID[id] || SEEDS[0]; for (let k = 0; k < 14; k++) this.puff(b.x + (Math.random() - 0.5) * 0.3, b.y + 0.6, b.z + (Math.random() - 0.5) * (b.n > 1 ? 1.2 : 0.3), s.color, 1.1, 0.12); }
  puff(x, y, z, color, life, size, vy = 0.5) {
    const THREE = T(), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.set(x, y, z); sp.scale.setScalar(size); this.scene.add(sp);
    this.puffs.push({ sp, t: 0, life, v: new THREE.Vector3((Math.random() - 0.5) * 0.5, vy * (0.5 + Math.random()), (Math.random() - 0.5) * 0.5) });
  }
  // ---------------------------------------------------------------- every frame
  update(dt) {
    this.walk(dt); const t = this.t;
    // plants sway; blooms breathe; the bed lights say how each is doing
    for (const slot of this.plants) if (slot.group) for (const pl of slot.group.children) pl.rotation.z = Math.sin(t * 0.8 + pl.userData.ph) * 0.05;
    this.leds?.forEach((m, i) => m.material.color.setHex(this.bloom?.[i] ? (Math.sin(t * 4 + i) > 0 ? 0x7dff8a : 0x2a8a3a) : this.growing?.[i] ? 0xffb547 : 0x223322));
    this.tapLed.material.color.setHex(this.watered ? 0x5ec8ff : this.growing?.some(Boolean) && Math.sin(t * 3) > 0 ? 0xffb547 : 0x3a2a14); this.waterTop.position.y = this.watered ? 0.55 : 0.7;
    // Sprig: off to mist the beds when you water them, otherwise pottering from bed to bed
    const busy = this.waterQ.length > 0;
    if (busy) { const b = BED_AT[this.waterQ[0]]; this.sprigGo.set(b.x, b.y + 0.95, b.z); if (this.sprig.position.distanceTo(this.sprigGo) < 0.25) { this.waterT += dt; if (Math.random() < dt * 30) this.puff(b.x + (Math.random() - 0.5) * 0.3, b.y + 0.8, b.z + (Math.random() - 0.5) * 0.3, 0x9fdcff, 0.9, 0.18, -0.6); if (this.waterT > 1.1) { this.waterQ.shift(); this.waterT = 0; } } }
    else if ((this.sprigAt -= dt) <= 0) { this.sprigAt = 4 + Math.random() * 3; const planted = this.plants.map((s, i) => (s.group ? i : -1)).filter((i) => i >= 0), i = planted.length ? planted[Math.floor(Math.random() * planted.length)] : Math.floor(Math.random() * 3), b = BED_AT[i]; this.sprigGo.set(b.x + 0.2, b.y + 1.0, b.z + 0.25); }
    const want = this.sprigGo.clone().sub(this.sprig.position); this.sprigV.lerp(want.multiplyScalar(busy ? 2.2 : 1.1), Math.min(1, dt * 2)); this.sprig.position.addScaledVector(this.sprigV, dt); this.sprig.position.y += Math.sin(t * 2.3) * 0.002;
    this.sprig.rotation.y = Math.atan2(this.sprigV.x, this.sprigV.z) * 0.6 + Math.sin(t * 0.7) * 0.3; for (const r of this.rotors) r.rotation.y += dt * 40;
    for (let i = this.puffs.length - 1; i >= 0; i--) { const q = this.puffs[i]; q.t += dt; const k = q.t / q.life; if (k >= 1) { this.scene.remove(q.sp); q.sp.material.dispose(); this.puffs.splice(i, 1); continue; } q.sp.position.addScaledVector(q.v, dt); q.sp.material.opacity = 1 - k; }
    const u = this.earth.material.uniforms; if (u) { u.time.value = t + 900; u.night.value = nightAmount(); u.sun.value.copy(this.sunDir).transformDirection(this.cam.matrixWorldInverse); }
    for (const l of this.wingLights) if (l.intensity > 0) l.intensity = 0.42 + Math.sin(t * 1.3) * 0.04;
  }
}
