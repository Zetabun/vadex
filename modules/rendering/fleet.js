// Fleet Ops: the launch deck in the Halo ring, the ninth room aboard to walk around (rendering/room.js). It opens with the
// halo, at Overhaul rank 9. Three berths stand before the force field at the front, where the ships you are not flying
// leave on expeditions (data/fleet.js) and come home: an empty pad, the ghost of a ship that is out (its place held),
// or the ship itself back and waiting to be unloaded (scorched and smoking if it came home damaged). A ship sent while you watch lifts off and goes out through the
// field; one coming home while you are here flies in and settles; one unloaded goes down to the hangar on the pad's
// lift. The ring map in the middle is a hologram of everywhere they can go, round the station, each ship out a light on
// its way there and back. The routes board on the left wall lists the destinations, the log on the right what came
// home. Outside, the halo arcs across the dark. Doors lead back to the Shipyard and out to the hangar. Tapping anything
// names it (the UI shows the details).
import { G } from '@last-orbit/core/game.js';
import { Room, canvas, tex, text, drawSign } from '@last-orbit/rendering/room.js';
import { playerParts, NOZZLES } from '@last-orbit/rendering/geometry.js';
import { SHIP_BY_ID } from '@last-orbit/data/ships.js';
import { MAT_BY_ID } from '@last-orbit/data/materials.js';
import { DESTINATIONS, DEST_BY_ID, BERTHS, PATHFINDER_AT, destOpen } from '@last-orbit/data/fleet.js';
import { fleet, tripDone, tripLeft, tripFinds } from '@last-orbit/progression/fleet.js';
const T = () => window.THREE;

// Room: x -5.2..5.2, z -9.5 (the force field onto the halo) .. 3 (back wall, the doors), height 4.6.
const W = 5.2, FRONT = -9.5, BACK = 3, H = 4.6, CYAN = 0x5ee6ff, TEAL = 0x6dffc8, EMBER = 0xff8a4a, MAP = { x: -2.75, z: -0.7, r: 1.05, y: 0.95 }, PAD_Y = 0.25;
/** Where the berths stand: across the front, before the force field. */
export const berthAt = (i) => ({ x: (i - 1) * 3, z: -5.8 });
/** Where a destination sits on the ring map: round the station, further out the deeper it is. */
const ringR = (i) => 0.3 + i * 0.11, nodeAt = (i) => { const a = -Math.PI / 2 - 0.5 + i * 0.95, r = ringR(i); return { x: Math.cos(a) * r, z: Math.sin(a) * r }; };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const hrs = (v) => (v >= 1 ? `${Math.floor(v)}H ${String(Math.floor((v % 1) * 60)).padStart(2, '0')}M` : `${Math.max(1, Math.ceil(v * 60))}M`);
const ease = (k) => k * k * (3 - 2 * k);

export class FleetRoom extends Room {
  constructor() {
    super({ w: W, front: FRONT, back: BACK, h: H, start: [0, 2.2, 0] });
    this.shell({ floor: '#151b25', wall: '#232b3a', ceil: '#19202d', stud: '#2a5a66', tick: 'rgba(94,230,255,.2)', strip: CYAN, cove: TEAL, frame: 0x323c50, rib: 0x2a3446,
      lamp: 0xe8f4ff, lampI: 0.42, panel: 0xeaf6ff, panelW: 2.2, hemi: 0.45, sky: 0xcfe8ff, sun: 0.45,
      window: { hw: 4.6, y0: 0.3, y1: 3.9, struts: [] }, lamps: [-5.8, -1.6, 1.8], ribs: [-9, -4.1, 0.95, 2.6] });
    this.nearFront = 1.3; this.fresh = true;
    this.furnish(); this.outside();
    this.solids.push({ x: MAP.x, z: MAP.z, r: MAP.r + 0.4 }, { x: 4.2, z: 2.05, r: 0.8 });
    this.blocks.push({ x0: -5.2, x1: -3.8, z0: -4.3, z1: -2.3 }); // the fuel rack
    for (let i = 0; i < BERTHS; i++) { const b = berthAt(i); this.solids.push({ x: b.x, z: b.z, r: 1.4 }); }
    this.bakeStatic(); /* still parts merged into fewer draw calls (room.js) */
  }
  // ---------------------------------------------------------------- the deck
  furnish() {
    const THREE = T(), S = this.scene, Ph = (o) => new THREE.MeshPhongMaterial(o), add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const metal = Ph({ color: 0x2c3446, specular: 0x6a7c9e, shininess: 45 }), plate = Ph({ color: 0x3a4456, specular: 0x8090b0, shininess: 60 });
    const mc = canvas(32, 32), mx = mc.getContext('2d'), mg = mx.createRadialGradient(16, 16, 0, 16, 16, 16); mg.addColorStop(0, 'rgba(255,255,255,1)'); mg.addColorStop(0.35, 'rgba(255,255,255,.5)'); mg.addColorStop(1, 'rgba(255,255,255,0)'); mx.fillStyle = mg; mx.fillRect(0, 0, 32, 32);
    this.moteTex = tex(mc);
    this.holoMat = new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    // the ring map: a round table with a glass top, and on it the hologram (the station, and every destination round it)
    const table = new THREE.Group(); table.position.set(MAP.x, 0, MAP.z); S.add(table);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.9, MAP.y - 0.1, 32), metal); foot.position.y = (MAP.y - 0.1) / 2; table.add(foot);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(MAP.r, MAP.r * 0.9, 0.12, 48), plate); rim.position.y = MAP.y - 0.06; table.add(rim);
    const gc = canvas(512, 512), gx = gc.getContext('2d'); gx.fillStyle = '#071a26'; gx.fillRect(0, 0, 512, 512); gx.strokeStyle = 'rgba(94,230,255,.18)'; gx.lineWidth = 2;
    for (let i = 0; i < DESTINATIONS.length; i++) { const r = (ringR(i) / MAP.r) * 256; gx.beginPath(); gx.arc(256, 256, r, 0, Math.PI * 2); gx.stroke(); }
    gx.strokeStyle = 'rgba(94,230,255,.08)'; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; gx.beginPath(); gx.moveTo(256 + Math.cos(a) * 30, 256 + Math.sin(a) * 30); gx.lineTo(256 + Math.cos(a) * 250, 256 + Math.sin(a) * 250); gx.stroke(); }
    const glass = new THREE.Mesh(new THREE.CircleGeometry(MAP.r - 0.05, 48), new THREE.MeshBasicMaterial({ map: tex(gc) })); glass.rotation.x = -Math.PI / 2; glass.position.y = MAP.y + 0.002; table.add(glass);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(MAP.r - 0.03, 0.016, 6, 64), new THREE.MeshBasicMaterial({ color: CYAN })); edge.rotation.x = Math.PI / 2; edge.position.y = MAP.y + 0.005; table.add(edge);
    const holo = new THREE.Group(); holo.position.y = MAP.y + 0.01; table.add(holo);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe8fbff })); hub.position.y = 0.2; holo.add(hub);
    this.hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.008, 6, 48), new THREE.MeshBasicMaterial({ color: CYAN, ...add, opacity: 0.9 })); this.hubRing.position.y = 0.2; this.hubRing.rotation.x = Math.PI / 2 - 0.3; holo.add(this.hubRing);
    const hubGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.moteTex, color: CYAN, ...add, opacity: 0.7 })); hubGlow.position.y = 0.2; hubGlow.scale.setScalar(0.55); holo.add(hubGlow);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.3, 0.2, 24, 1, true), new THREE.MeshBasicMaterial({ color: CYAN, ...add, opacity: 0.12, side: THREE.DoubleSide })); cone.position.y = 0.1; holo.add(cone);
    // the destinations: a node each, lit in sync in its material's colour, with its number beside it
    this.nodes = DESTINATIONS.map((d, i) => {
      const p = nodeAt(i), g = new THREE.Group(); g.position.set(p.x, 0.13, p.z); holo.add(g);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(d.deep ? 0.07 : 0.05, 0), new THREE.MeshBasicMaterial({ color: 0x3a4a5a })); g.add(orb);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.moteTex, color: 0xffffff, ...add, opacity: 0 })); glow.scale.setScalar(d.deep ? 0.44 : 0.3); g.add(glow);
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.13, 4), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.35 })); stalk.position.y = -0.065; g.add(stalk);
      const lc = canvas(128, 64); text(lc.getContext('2d'), d.deep ? 'VOID' : String(d.n), 64, 34, `800 ${d.deep ? 34 : 44}px sans-serif`, '#dff6ff');
      const num = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(lc), transparent: true, depthWrite: false, opacity: 0.8 })); num.scale.set(0.2, 0.1, 1); num.position.set(0, 0.12, 0); g.add(num);
      return { d, orb, glow, num };
    });
    // the ships out: a line to where each is bound and a light travelling it, there and back (placed every frame)
    this.routes = Array.from({ length: BERTHS }, () => {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: CYAN, ...add, opacity: 0.5 })); line.visible = false; line.frustumCulled = false; holo.add(line);
      const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.moteTex, color: 0xffffff, ...add })); dot.scale.setScalar(0.16); dot.visible = false; holo.add(dot);
      return { line, dot, node: -1 };
    });
    this.hitBox(table, 2.3, 1.5, 2.3, 0, 0.75, 0); this.tag(table, 'map');
    // the berths: a hexagonal pad each, its rim lit, lanes painted out to the field, a lift for the ship, and its sign
    // floating overhead (drawn in sync)
    const lc = canvas(64, 256), lx = lc.getContext('2d'); lx.fillStyle = '#0b1018'; lx.fillRect(0, 0, 64, 256); lx.fillStyle = '#5ee6ff'; for (let y = 8; y < 256; y += 48) { lx.beginPath(); lx.moveTo(8, y + 28); lx.lineTo(32, y); lx.lineTo(56, y + 28); lx.lineTo(56, y + 40); lx.lineTo(32, y + 12); lx.lineTo(8, y + 40); lx.fill(); }
    const lane = new THREE.MeshBasicMaterial({ map: tex(lc), transparent: true, opacity: 0.45, depthWrite: false });
    this.berths = [];
    for (let i = 0; i < BERTHS; i++) {
      const { x, z } = berthAt(i), g = new THREE.Group(); g.position.set(x, 0, z); S.add(g);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.28, PAD_Y, 6), metal); pad.position.y = PAD_Y / 2; g.add(pad);
      const pc = canvas(256, 256), px = pc.getContext('2d'); px.fillStyle = '#20283a'; px.fillRect(0, 0, 256, 256); px.strokeStyle = '#ffc857'; px.lineWidth = 6; px.beginPath(); px.arc(128, 128, 84, 0, Math.PI * 2); px.stroke();
      px.strokeStyle = 'rgba(255,200,87,.35)'; px.setLineDash([14, 10]); px.beginPath(); px.arc(128, 128, 106, 0, Math.PI * 2); px.stroke(); px.setLineDash([]); text(px, String(i + 1), 128, 132, '800 96px sans-serif', 'rgba(255,200,87,.5)');
      const top = new THREE.Mesh(new THREE.CircleGeometry(1.1, 6, Math.PI / 6), Ph({ map: tex(pc), specular: 0x445066, shininess: 30 })); top.rotation.x = -Math.PI / 2; top.position.y = PAD_Y + 0.003; g.add(top);
      const rim = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.19, 6, 1, Math.PI / 6), new THREE.MeshBasicMaterial({ color: CYAN })); rim.rotation.x = -Math.PI / 2; rim.position.y = PAD_Y + 0.006; g.add(rim);
      for (const s of [-1, 1]) { const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.5), plate); clamp.position.set(s * 1.02, PAD_Y + 0.12, 0.25); g.add(clamp); }
      const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.4), lane); ln.rotation.x = -Math.PI / 2; ln.position.set(0, 0.012, -2.45); g.add(ln);
      const lift = new THREE.Group(); lift.position.y = PAD_Y; g.add(lift);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })); sign.position.set(0, 2.55, 0.2); g.add(sign);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.2, 6, 1, true), new THREE.MeshBasicMaterial({ color: TEAL, ...add, opacity: 0, side: THREE.DoubleSide })); beam.position.y = PAD_Y + 1.1; g.add(beam);
      this.hitBox(g, 2.5, 2.9, 2.5, 0, 1.45, 0); this.tag(g, 'berth' + (i + 1));
      this.berths.push({ lift, rim, sign, beam, sig: '', mode: '', model: null, fly: null });
    }
    // a walkway painted from the doors to the berths, a fuel rack by the left wall, cargo stacked by the right-hand door
    const wc = canvas(16, 128), wx = wc.getContext('2d'); wx.fillStyle = '#ffc857'; for (let y = 0; y < 128; y += 32) wx.fillRect(0, y, 16, 20);
    const walk = new THREE.MeshBasicMaterial({ map: tex(wc, [1, 13]), transparent: true, opacity: 0.4, depthWrite: false });
    for (const x of [-1.25, 1.25]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 6.6), walk); w.rotation.x = -Math.PI / 2; w.position.set(x, 0.011, -1.05); S.add(w); }
    const tank = Ph({ color: 0xd8dee8, specular: 0xffffff, shininess: 70 }), band = Ph({ color: 0xffc857, emissive: 0x3a2800 }), rack = new THREE.Group(); rack.position.set(-4.45, 0, -3.3); S.add(rack);
    for (const z of [-0.6, 0.6]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.18), plate); c.position.set(0, 0.15, z); rack.add(c); }
    for (const [x, y] of [[-0.2, 0.52], [0.2, 0.52], [0, 0.98]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.7, 20), tank); t.rotation.x = Math.PI / 2; t.position.set(x, y, 0); rack.add(t);
      for (const z of [-0.55, 0.55]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.08, 20), band); b.rotation.x = Math.PI / 2; b.position.set(x, y, z); rack.add(b); } }
    const crate = Ph({ color: 0x3a3a30, shininess: 12 }), lid = Ph({ color: 0x4a4a3c, shininess: 20 });
    for (const [w, x, y, z, r] of [[0.8, 4.45, 0.4, 1.9, 0.2], [0.6, 4.5, 1.1, 1.95, -0.15], [0.6, 3.7, 0.3, 2.25, 0.5]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, w, w), crate); c.position.set(x, y, z); c.rotation.y = r; S.add(c); const l = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.05, w + 0.04), lid); l.position.set(x, y + w / 2, z); l.rotation.y = r; S.add(l); }
    // the boards: the routes on the left wall, the log on the right, the Pathfinder's count between the doors
    this.routesBoard = this.screen(S, canvas(1024, 640), 2.8, 1.75, -W + 0.03, 2.25, -0.7, Math.PI / 2, 0x1a2230); this.tag(this.routesBoard, 'routes');
    this.logBoard = this.screen(S, canvas(1024, 640), 2.8, 1.75, W - 0.03, 2.25, -0.7, -Math.PI / 2, 0x1a2230); this.tag(this.logBoard, 'log');
    this.plaque = this.screen(S, canvas(768, 320), 1.7, 0.71, 0, 2.3, BACK - 0.03, Math.PI, 0x1a2230); this.tag(this.plaque, 'log');
    // the sign over the field (named in sync), and the doors
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.325), new THREE.MeshBasicMaterial({ transparent: true })); this.sign.position.set(0, 4.25, FRONT + 0.17); S.add(this.sign);
    this.door(S, 2.7, BACK, 0, 'HANGAR  ›', 'exit', { sign: '#e6fbff', edge: CYAN });
    this.door(S, -2.7, BACK, 0, 'SHIPYARD  ›', 'yard', { sign: '#fff0c8', edge: 0xffc93c });
    // the force field across the front, faintly scanning
    const fc = canvas(8, 128), fx = fc.getContext('2d'); for (let y = 0; y < 128; y += 4) { fx.fillStyle = `rgba(94,230,255,${0.04 + 0.1 * Math.random()})`; fx.fillRect(0, y, 8, 2); }
    this.fieldTex = tex(fc, [1, 5]); const field = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 3.6), new THREE.MeshBasicMaterial({ map: this.fieldTex, opacity: 0.5, ...add })); field.position.set(0, 2.1, FRONT + 0.05); S.add(field);
    this.tag(this.hitBox(S, 9.2, 3.6, 0.1, 0, 2.1, FRONT + 0.12), 'window');
  }
  /** Beyond the field: stars, a nebula, and the halo, arcing across the dark. */
  outside() {
    const THREE = T(), S = this.scene, add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const n = 1100, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); pos.set([Math.cos(a) * r * 1600, u * 1600, -Math.abs(Math.sin(a) * r) * 1600 - 200], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); S.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.9, sizeAttenuation: false })));
    const neb = (w, h, stops, x, y, z) => { const c = canvas(256, 256), cx = c.getContext('2d'), gr = cx.createRadialGradient(128, 128, 0, 128, 128, 128); stops.forEach(([k, s]) => gr.addColorStop(k, s)); cx.fillStyle = gr; cx.fillRect(0, 0, 256, 256); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(c), ...add })); m.position.set(x, y, z); S.add(m); };
    neb(1400, 800, [[0, 'rgba(40,120,170,.4)'], [0.55, 'rgba(20,60,110,.16)'], [1, 'rgba(0,0,0,0)']], -200, 60, -1150); neb(900, 700, [[0, 'rgba(90,70,190,.3)'], [0.6, 'rgba(40,30,90,.1)'], [1, 'rgba(0,0,0,0)']], 380, -60, -1000);
    // the halo: a bright band and its soft glow, turning slowly
    this.halo = new THREE.Group(); this.halo.position.set(0, -480, -640); this.halo.rotation.x = -0.18; S.add(this.halo);
    this.halo.add(new THREE.Mesh(new THREE.TorusGeometry(530, 2.2, 8, 240), new THREE.MeshBasicMaterial({ color: CYAN, ...add, opacity: 0.75 })));
    this.halo.add(new THREE.Mesh(new THREE.TorusGeometry(530, 9, 8, 240), new THREE.MeshBasicMaterial({ color: 0x3aa8d8, ...add, opacity: 0.14 })));
    const bc = canvas(512, 8), bx = bc.getContext('2d'); for (let x = 0; x < 512; x += 16) { bx.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * Math.random()})`; bx.fillRect(x, 0, 6, 8); }
    this.lightsTex = tex(bc, [24, 1]); this.halo.add(new THREE.Mesh(new THREE.TorusGeometry(536, 1.2, 4, 240), new THREE.MeshBasicMaterial({ map: this.lightsTex, color: 0xdff8ff, ...add, opacity: 0.8 })));
  }
  // ---------------------------------------------------------------- the ships
  /** A ship to stand on a pad, lying flat, nose to the field. solid: in its own colours (home); otherwise the hologram
   *  of one that is out. dmg: home damaged (1 light, 2 heavy): its hull scorched, smoke rising off it, and when it is bad an
   *  engine sputtering. Returns the group, with its engine glows (and smoke). */
  model(id, solid, dmg = 0) {
    const THREE = T(), ship = SHIP_BY_ID[id], parts = playerParts(ship.id), Ph = (o) => new THREE.MeshPhongMaterial(o), out = new THREE.Group(), inner = new THREE.Group();
    const M = { hull: Ph({ color: 0x718996, emissive: 0x0c1420, shininess: 30 }), deck: Ph({ color: 0xe2eced, emissive: 0x141a22, shininess: 40 }), dark: Ph({ color: 0x152735 }), glass: Ph({ color: 0x125875, emissive: 0x073345, shininess: 110, specular: 0xb8f5ff }),
      trim: Ph({ color: ship.trim, emissive: new THREE.Color(ship.trim).multiplyScalar(0.4) }), gold: Ph({ color: 0xffb94e, emissive: 0x583000 }) };
    if (dmg) { const soot = new THREE.Color(0x2a2420), k = dmg > 1 ? 0.6 : 0.38; for (const m of [M.hull, M.deck, M.gold]) m.color.lerp(soot, k); M.hull.emissive.setHex(dmg > 1 ? 0x2a0c04 : 0x140a06); M.trim.emissive.multiplyScalar(0.4); }
    const use = { hull: 'hull', deck: 'deck', cockpit: 'glass', chassis: 'dark', markings: 'gold', lights: 'trim', engine: 'trim' }, box = new THREE.Box3();
    for (const k of Object.keys(use)) { const geo = parts[k]; if (!geo) continue; geo.computeBoundingBox(); box.union(geo.boundingBox); if (solid) inner.add(new THREE.Mesh(geo, M[use[k]])); else { inner.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), this.holoMat)); geo.dispose(); } }
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()), k = 1.75 / Math.max(size.x, size.y);
    inner.position.set(-c.x, -c.y, -box.min.z); /* centred on the pad, its belly on it */ const tilt = new THREE.Group(); tilt.rotation.x = -Math.PI / 2; tilt.scale.setScalar(k); tilt.add(inner); out.add(tilt);
    out.userData.glows = []; out.userData.smoke = [];
    if (solid) for (const [nx, ny] of NOZZLES[ship.id] || []) { const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.moteTex, color: ship.trim, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); gl.position.set(nx, ny - 0.18, 0); gl.scale.setScalar(0.8); inner.add(gl); out.userData.glows.push(gl); }
    if (solid && dmg) {
      for (let k = 0; k < (dmg > 1 ? 7 : 4); k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.moteTex, color: dmg > 1 ? 0x9a948c : 0xb4aea6, transparent: true, depthWrite: false, opacity: 0 })); sp.userData.at = [(Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, Math.random()]; out.add(sp); out.userData.smoke.push(sp); }
      if (dmg > 1) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.moteTex, color: EMBER, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); f.position.set(0.5, 0.75, 0.3); f.scale.setScalar(0.45); /* over a split in her plating */ out.add(f); out.userData.spark = f; }
    }
    return out;
  }
  drop(b) { if (!b.model) return; b.lift.remove(b.model); b.model.traverse((o) => { o.geometry?.dispose(); if (o.material && o.material !== this.holoMat) o.material.dispose(); }); b.model = null; }
  /** What a berth shows: empty, a ship out (its hologram), or a ship home (the ship). A change while you are in the room
   *  plays out: sent ships lift off and leave through the field, returning ones fly in, unloaded ones go down. */
  syncBerth(state, i, now) {
    const o = fleet(state).out[i], mode = !o ? 'empty' : tripDone(state, i, now) >= 1 ? 'home' : 'out', sig = o ? `${o.ship}:${o.at}:${mode}` : 'empty', b = this.berths[i];
    if (sig === b.sig) return; const was = b.mode, ship = o?.ship || b.shipId, wasDmg = b.dmg || 0; b.sig = sig; b.mode = mode; b.shipId = o?.ship; b.dmg = o ? tripFinds(state, o).damage || 0 : 0;
    const watch = !this.fresh, left = o ? now - o.at : 0, back = o ? now - (o.at + o.need) : 0; /* only what just happened plays out */
    if (b.fly) { this.drop(b); b.fly = null; }
    this.drop(b);
    if (watch && mode === 'out' && was === 'empty' && left < 30000) { b.model = this.model(ship, true); b.lift.add(b.model); b.fly = { kind: 'out', t: 0, ship }; return; }
    if (watch && mode === 'home' && was === 'out' && back < 120000) { b.model = this.model(ship, true, b.dmg); b.lift.add(b.model); b.fly = { kind: 'in', t: 0 }; this.place(b, 0); return; }
    if (watch && mode === 'empty' && was === 'home' && ship) { b.model = this.model(ship, true, wasDmg); b.lift.add(b.model); b.fly = { kind: 'down', t: 0 }; return; }
    if (mode !== 'empty') { b.model = this.model(o.ship, mode === 'home', b.dmg); b.lift.add(b.model); }
  }
  /** Where a ship in flight is, k 0..1 along it. */
  place(b, k) {
    const m = b.model, f = b.fly; if (!m || !f) return;
    const glow = (v, grow = 1.4) => { for (const g of m.userData.glows) { g.material.opacity = v; g.scale.setScalar(0.8 + v * grow); } };
    if (f.kind === 'out') { const up = ease(Math.min(1, k / 0.3)), go = Math.max(0, (k - 0.3) / 0.7); m.position.set(0, up * 1.1, -go * go * 60); m.rotation.x = up * 0.12 - go * 0.05; glow(Math.min(1, k * 3)); }
    else if (f.kind === 'in') { const come = Math.min(1, k / 0.75), land = ease(Math.max(0, (k - 0.75) / 0.25)), d = (1 - come) ** 2; m.position.set(0, 1.1 * (1 - land) + d * 6, -d * 70); m.rotation.x = 0.1 * (1 - land); glow(0.5 * (1 - land), 0.5); } /* backing in: its engines face you, so they burn low */
    else { m.position.set(0, -ease(k) * 1.6, 0); glow(0); }
  }
  // ---------------------------------------------------------------- what is on show (rebuilt when it changes)
  sync(state) {
    const f = fleet(state), now = Date.now();
    const trips = f.out.map((o, i) => (o ? `${o.ship}:${o.at}:${tripDone(state, i, now) >= 1 ? 'h' : Math.ceil(tripLeft(state, i, now) * 60)}` : '-')).join(',');
    const sig = [trips, f.log[0]?.at || 0, f.home || 0, state.stationName, state.stats?.sectorsCleared, (state.stats?.bestWave || 0) > 60, state.paints?.pathfinder ? 1 : 0].join('|');
    if (sig === this.sig) return; this.sig = sig; const THREE = T();
    for (let i = 0; i < BERTHS; i++) this.syncBerth(state, i, now);
    this.fresh = false;
    // the map: destinations lit in their material's colour once open; a route for each ship out
    this.nodes.forEach((n) => { const open = destOpen(state, n.d), c = MAT_BY_ID[n.d.mat].color; n.open = open; n.orb.material.color.setHex(open ? c : 0x3a4a5a); n.glow.material.color.setHex(c); n.num.material.opacity = open ? 0.85 : 0.3; });
    f.out.forEach((o, i) => { const r = this.routes[i], j = o ? DESTINATIONS.findIndex((d) => d.id === o.dest) : -1; r.node = j; r.i = i; r.line.visible = r.dot.visible = j >= 0;
      if (j >= 0) { const p = nodeAt(j), a = r.line.geometry.attributes.position; a.setXYZ(0, 0, 0.2, 0); a.setXYZ(1, p.x, 0.13, p.z); a.needsUpdate = true; const c = new THREE.Color(MAT_BY_ID[DEST_BY_ID[o.dest].mat].color); r.line.material.color.copy(c); r.dot.material.color.copy(c).lerp(new THREE.Color(0xffffff), 0.5); } });
    this.drawSigns(state, now); this.drawRoutes(state); this.drawLog(state);
    const sc = canvas(832, 104); drawSign(sc.getContext('2d'), 'FLEET OPS', `HALO RING${state.stationName ? ' · ' + state.stationName.toUpperCase() : ''}`, '#e6fbff', '#6dffc8');
    this.sign.material.map?.dispose(); this.sign.material.map = tex(sc); this.sign.material.needsUpdate = true;
  }
  /** The signs over the berths: whose ship, where it went and when it is back. */
  drawSigns(state, now) {
    const f = fleet(state);
    this.berths.forEach((b, i) => {
      const o = f.out[i], d = o && DEST_BY_ID[o.dest], home = o && tripDone(state, i, now) >= 1, hurt = home && b.dmg, c = canvas(800, 200), x = c.getContext('2d'), col = hurt ? '#ff9a6a' : home ? '#6dffc8' : o ? '#5ee6ff' : '#5a7488';
      const g = x.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, 'rgba(8,22,34,.85)'); g.addColorStop(1, 'rgba(8,22,34,.55)'); x.fillStyle = g; x.fillRect(0, 0, 800, 200);
      x.fillStyle = col; x.fillRect(0, 0, 800, 5); x.fillRect(0, 195, 800, 5); x.globalAlpha = 0.5; x.fillRect(0, 0, 6, 200); x.fillRect(794, 0, 6, 200); x.globalAlpha = 1;
      text(x, `BERTH ${i + 1}`, 30, 44, '800 26px sans-serif', col, 'left');
      if (!o) { text(x, 'EMPTY', 400, 104, '800 60px sans-serif', '#9fb4c8'); text(x, 'TAP TO SEND A SHIP OUT', 400, 162, '700 28px sans-serif', '#5ee6ff'); }
      else {
        text(x, hurt ? 'DAMAGED' : home ? 'HOME' : hrs(tripLeft(state, i, now)), 770, 44, '800 26px sans-serif', col, 'right');
        text(x, SHIP_BY_ID[o.ship].name.toUpperCase(), 400, 104, '800 60px sans-serif', '#e6fbff');
        text(x, home ? `BACK FROM ${d.name.toUpperCase()} · TAP TO UNLOAD` : `SCOUTING ${d.name.toUpperCase()}`, 400, 162, `700 ${d.name.length > 14 ? 25 : 28}px sans-serif`, col);
      }
      const m = b.sign.material; m.map?.dispose(); m.map = tex(c); m.needsUpdate = true;
      b.rim.material.color.setHex(hurt ? EMBER : home ? TEAL : o ? CYAN : 0x2a5a66); b.beam.material.color.setHex(hurt ? EMBER : TEAL);
    });
  }
  /** The routes board: every destination, how long a trip takes, what it brings, and what opens it. */
  drawRoutes(state) {
    const t = this.routesBoard.userData.face.material.map, x = t.image.getContext('2d'), open = DESTINATIONS.filter((d) => destOpen(state, d)).length;
    x.fillStyle = '#0a0f18'; x.fillRect(0, 0, 1024, 640); x.strokeStyle = '#5ee6ff'; x.lineWidth = 5; x.strokeRect(6, 6, 1012, 628);
    text(x, 'ROUTES', 36, 54, '800 40px sans-serif', '#e6fbff', 'left'); text(x, `${open}/${DESTINATIONS.length} OPEN`, 988, 54, '800 24px sans-serif', '#5ee6ff', 'right');
    DESTINATIONS.forEach((d, i) => {
      const y = 128 + i * 72, ok = destOpen(state, d), m = MAT_BY_ID[d.mat];
      x.fillStyle = ok ? 'rgba(94,230,255,.06)' : 'rgba(255,255,255,.025)'; x.fillRect(24, y - 30, 976, 60);
      x.fillStyle = ok ? hex(m.color) : '#2e3a48'; x.beginPath(); x.arc(58, y, 11, 0, Math.PI * 2); x.fill();
      text(x, d.name, 88, y, '800 29px sans-serif', ok ? '#e6fbff' : '#5a6878', 'left');
      if (ok) { text(x, `${d.hours}H`, 560, y, '800 24px sans-serif', '#9fc8e0', 'left'); text(x, `${m.name.toUpperCase()} ×${d.matN}`, 976, y, '800 24px sans-serif', hex(m.color), 'right'); }
      else text(x, d.deep ? 'PAST WAVE 60' : `CLEAR SECTOR ${d.n}`, 976, y, '700 22px sans-serif', '#4a5868', 'right');
    });
    t.needsUpdate = true;
  }
  /** The log: the last few ships home, and what they brought; and between the doors, the count to the Pathfinder. */
  drawLog(state) {
    const f = fleet(state), t = this.logBoard.userData.face.material.map, x = t.image.getContext('2d');
    x.fillStyle = '#0a0f18'; x.fillRect(0, 0, 1024, 640); x.strokeStyle = '#6dffc8'; x.lineWidth = 5; x.strokeRect(6, 6, 1012, 628);
    text(x, 'EXPEDITION LOG', 36, 54, '800 40px sans-serif', '#e6fbff', 'left'); text(x, `${f.home || 0} HOME`, 988, 54, '800 24px sans-serif', '#6dffc8', 'right');
    if (!f.log.length) { text(x, 'NO SHIPS HOME YET', 512, 300, '800 40px sans-serif', '#5a6878'); text(x, 'SEND ONE OUT FROM A BERTH', 512, 356, '700 26px sans-serif', '#3e4c5c'); }
    f.log.slice(0, 7).forEach((e, i) => {
      const y = 128 + i * 72, d = DEST_BY_ID[e.dest], mats = Object.entries(e.got.mats || {}).map(([id, n]) => `+${n} ${MAT_BY_ID[id].name.toUpperCase()}`).join(' ');
      x.fillStyle = 'rgba(109,255,200,.05)'; x.fillRect(24, y - 30, 976, 60);
      text(x, SHIP_BY_ID[e.ship]?.name.toUpperCase() || '', 44, y, '800 26px sans-serif', '#e6fbff', 'left'); text(x, `› ${d?.name.toUpperCase() || ''}`, 250, y, '700 22px sans-serif', '#9fc8e0', 'left');
      const extra = [e.got.seeds?.length ? 'SEED' : '', e.got.cores ? 'CORE' : '', e.got.bp ? 'BLUEPRINT' : '', e.got.fragments ? 'SIGNAL' : ''].filter(Boolean).join(' · ');
      text(x, mats, 976, extra ? y - 11 : y, '800 22px sans-serif', hex(MAT_BY_ID[d?.mat || 'alloy'].color), 'right'); if (extra) text(x, extra, 976, y + 15, '700 17px sans-serif', '#ffc857', 'right');
    });
    t.needsUpdate = true;
    const p = this.plaque.userData.face.material.map, px = p.image.getContext('2d'), got = !!state.paints?.pathfinder, n = Math.min(PATHFINDER_AT, f.home || 0);
    px.fillStyle = '#0a0f18'; px.fillRect(0, 0, 768, 320); px.strokeStyle = '#ffc857'; px.lineWidth = 5; px.strokeRect(5, 5, 758, 310);
    text(px, 'PATHFINDER', 384, 62, '800 44px sans-serif', '#fff0c8'); text(px, got ? 'THE PAINT IS YOURS' : `${n} OF ${PATHFINDER_AT} EXPEDITIONS HOME`, 384, 118, '700 26px sans-serif', got ? '#6dffc8' : '#ffc857');
    for (let k = 0; k < PATHFINDER_AT; k++) { px.fillStyle = k < n ? '#ffc857' : '#2a3242'; px.fillRect(84 + k * 50, 180, 38, 38); }
    text(px, 'A PAINT FOR THE SHIPS THAT GO FURTHEST', 384, 270, '700 20px sans-serif', '#7a8898');
    p.needsUpdate = true;
  }
  // ---------------------------------------------------------------- every frame
  update(dt) {
    this.walk(dt); const t = this.t, now = Date.now(), st = G.state;
    this.hubRing.rotation.z = t * 0.6; this.halo.rotation.z = t * 0.004; this.fieldTex.offset.y = (this.fieldTex.offset.y + dt * 0.08) % 1; this.lightsTex.offset.x = (this.lightsTex.offset.x - dt * 0.02) % 1;
    this.nodes.forEach((n, i) => { n.glow.material.opacity = n.open ? 0.55 + 0.25 * Math.sin(t * 1.7 + i) : 0; n.orb.rotation.y = t * 0.8 + i; });
    for (const r of this.routes) if (r.node >= 0 && st) {
      const k = tripDone(st, r.i, now) ?? 1, there = k < 0.5 ? k * 2 : 2 - k * 2, p = nodeAt(r.node);
      r.dot.position.set(p.x * there, 0.2 + (0.13 - 0.2) * there, p.z * there); r.dot.visible = r.line.visible = k < 1; r.line.material.opacity = k < 1 ? 0.35 + 0.15 * Math.sin(t * 3) : 0.12;
    }
    for (const b of this.berths) {
      const home = b.mode === 'home'; b.beam.material.opacity = home && !b.fly ? 0.05 + 0.03 * Math.sin(t * 2.4) : 0;
      if (home && !b.fly) b.rim.material.color.setHex(b.dmg ? EMBER : TEAL).multiplyScalar(0.7 + 0.3 * Math.sin(t * 3));
      const md = b.model?.userData; if (md?.smoke?.length) for (const sp of md.smoke) { const [sx, sz, ph] = sp.userData.at, k = (t * 0.28 + ph) % 1; sp.position.set(sx + k * 0.25, 0.35 + k * 1.5, sz - k * 0.1); sp.scale.setScalar(0.45 + k * 1.2); sp.material.opacity = (b.dmg > 1 ? 0.55 : 0.38) * Math.sin(k * Math.PI); }
      if (md?.spark) { const on = Math.random() < 0.18; md.spark.material.opacity = on ? 0.9 : 0.12; md.spark.scale.setScalar(on ? 0.5 + Math.random() * 0.3 : 0.3); }
      if (b.mode === 'out' && b.model && !b.fly) b.model.position.y = 0.25 + Math.sin(t * 1.2) * 0.03;
      if (b.fly) { const len = b.fly.kind === 'out' ? 3.2 : b.fly.kind === 'in' ? 3.4 : 1.2; b.fly.t += dt; const k = Math.min(1, b.fly.t / len); this.place(b, k);
        if (k >= 1) { const kind = b.fly.kind, ship = b.fly.ship; b.fly = null; this.drop(b); if (kind === 'out') { b.model = this.model(ship, false); b.lift.add(b.model); } else if (kind === 'in') { b.model = this.model(b.shipId, true, b.dmg); b.lift.add(b.model); } } }
    }
  }
}
