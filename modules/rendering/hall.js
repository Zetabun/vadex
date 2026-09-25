// The Trophy Hall: a gallery in the station's Habitat ring, the third room aboard to walk around (rendering/room.js). It
// opens with the ring, at Overhaul rank 2. Down both sides stand six stasis cradles, one for each Counterattack boss: a
// boss you have captured (its stage cleared) hangs in its cradle's field, turning slowly in its own colour, its record on
// the plaque in front; one still at large shows as a flickering red outline. Between the doors a hologram cycles through
// the main-game bosses you have faced (the hunting record). The window looks back at the station's hub with the captured
// bosses held in its tractor fields, the view turning slowly as the ring spins. Doors lead to the Command Deck, out to
// the hangar, and (once the spire is back) up to the Comms room. Tapping an exhibit names it (the UI shows the details).
import { Room, canvas, tex, text } from '@last-orbit/rendering/room.js';
import { Station } from '@last-orbit/rendering/station.js';
import { shapeGeometry } from '@last-orbit/rendering/geometry.js';
import { BOSSES } from '@last-orbit/data/bosses.js';
import { STAGES } from '@last-orbit/data/counter.js';
import { trophyWon, HUNTED } from '@last-orbit/data/station.js';
import { COMMS_RANK } from '@last-orbit/data/bounties.js';
const T = () => window.THREE;

// Room: x -4.4..4.4, z -10 (window) .. 3.4 (back wall, the doors), height 3.6.
const W = 4.4, FRONT = -10, BACK = 3.4, H = 3.6, GOLD = 0xffc857, VIOLET = 0xc18cff;
// The cradles: stages 1, 3 and 5 down the left, 2, 4 and 6 down the right, from the doors towards the window.
const CRADLE_X = 2.95, CRADLE_Z = [-1.5, -4.6, -7.7];
export const cradleAt = (n) => ({ x: (n % 2 ? -1 : 1) * CRADLE_X, z: CRADLE_Z[Math.floor((n - 1) / 2)] });
const HUNT = { x: 0, z: 2.35 }; // the hunting record's hologram, against the back wall between the doors
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export class HallRoom extends Room {
  constructor() {
    super({ w: W, front: FRONT, back: BACK, h: H, start: [0, 0.8, 0] });
    this.shell({ floor: '#1a1a28', wall: '#2b2a3e', ceil: '#1c1b2a', stud: '#5a4a24', tick: 'rgba(255,200,87,.2)', strip: GOLD, cove: VIOLET, frame: 0x3a3a52, rib: 0x302e46,
      lamp: 0xffe2b8, lampI: 0.38, panel: 0xfff0d8, panelW: 1.6, hemi: 0.42, sky: 0xd8c8ff, sun: 0.45,
      window: { hw: 3.6, y0: 0.55, y1: 3.1, struts: [-1.2, 1.2] }, lamps: [-8.2, -5.2, -2.2, 0.8], ribs: [-9.3, -6.15, -3.05, 0.2] });
    this.nearFront = 0.9;
    this.furnish(); this.outside();
    for (let n = 1; n <= 6; n++) { const c = cradleAt(n); this.solids.push({ x: c.x, z: c.z, r: 1 }); }
    this.solids.push({ ...HUNT, r: 1.05 });
  }
  // ---------------------------------------------------------------- the room
  furnish() {
    const THREE = T(), S = this.scene, Ph = (o) => new THREE.MeshPhongMaterial(o), add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const metal = (this.metal = Ph({ color: 0x2e3148, specular: 0x6a6a9a, shininess: 45 })), dark = Ph({ color: 0x15151f, specular: 0x333344, shininess: 30 });
    // a stasis field's glow: bright at its two emitters, thin in the middle
    const fc = canvas(8, 256), fx = fc.getContext('2d'), fg = fx.createLinearGradient(0, 0, 0, 256);
    for (const [k, a] of [[0, 0.95], [0.16, 0.28], [0.5, 0.07], [0.84, 0.28], [1, 0.95]]) fg.addColorStop(k, `rgba(255,255,255,${a})`); fx.fillStyle = fg; fx.fillRect(0, 0, 8, 256);
    const fieldTex = tex(fc), moteC = canvas(32, 32), mc = moteC.getContext('2d'), mg = mc.createRadialGradient(16, 16, 0, 16, 16, 16); mg.addColorStop(0, 'rgba(255,255,255,1)'); mg.addColorStop(1, 'rgba(255,255,255,0)'); mc.fillStyle = mg; mc.fillRect(0, 0, 32, 32);
    const moteTex = tex(moteC);
    this.cradles = {};
    for (let n = 1; n <= 6; n++) {
      const { x, z } = cradleAt(n), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; S.add(g); // its +z faces the aisle
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.88, 0.46, 8), metal); base.position.y = 0.23; base.rotation.y = Math.PI / 8; g.add(base);
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.72, 0.08, 32), dark); deck.position.y = 0.5; g.add(deck);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.66, 0.16, 32), metal); cap.position.y = 2.98; g.add(cap);
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4, post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.44, 8), metal); post.position.set(Math.cos(a) * 0.7, 1.74, Math.sin(a) * 0.7); g.add(post); }
      const glow = new THREE.MeshBasicMaterial({ color: 0xffffff }), rings = [0.56, 2.89].map((y) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.028, 8, 48), glow); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); return r; });
      const field = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.3, 40, 1, true), new THREE.MeshBasicMaterial({ map: fieldTex, opacity: 0.45, side: THREE.DoubleSide, ...add })); field.position.y = 1.72; g.add(field);
      // motes drifting up through the field
      const count = 26, pos = new Float32Array(count * 3), seeds = [];
      for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2, r = 0.15 + Math.random() * 0.4; seeds.push({ a, r, y: Math.random(), v: 0.08 + Math.random() * 0.12 }); }
      const mg2 = new THREE.BufferGeometry(); mg2.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const motes = new THREE.Points(mg2, new THREE.PointsMaterial({ map: moteTex, size: 0.07, sizeAttenuation: true, opacity: 0.8, ...add })); g.add(motes);
      // the plaque, on a slanted lectern in front of the cradle
      const lect = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.78, 0.22), metal); lect.position.set(0, 0.39, 1.04); g.add(lect);
      const slope = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.46), dark); slope.position.set(0, 0.84, 1.08); slope.rotation.x = 0.55; g.add(slope);
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff })); plaque.position.set(0, 0.87, 1.1); plaque.rotation.x = 0.55 - Math.PI / 2; /* flat on the slope, facing up and out */ g.add(plaque);
      this.hitBox(g, 1.9, 3.2, 2.6, 0, 1.6, 0.4); this.tag(g, 'cradle' + n);
      this.cradles[n] = { g, glow, rings, field, motes, seeds, plaque, holder: null };
    }
    // the hunting record: a pedestal between the doors throwing up a hologram of each main-game boss in turn
    const hp = new THREE.Group(); hp.position.set(HUNT.x, 0, HUNT.z); S.add(hp);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.9, 24), metal); ped.position.y = 0.45; hp.add(ped);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 32), new THREE.MeshBasicMaterial({ color: 0x5ee6ff })); lens.position.y = 0.92; hp.add(lens);
    this.holoBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.4, 1.6, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x5ee6ff, opacity: 0.06, side: THREE.DoubleSide, ...add })); this.holoBeam.position.y = 1.75; hp.add(this.holoBeam);
    this.holo = new THREE.Group(); this.holo.position.y = 1.72; hp.add(this.holo);
    this.holoLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.28), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })); this.holoLabel.position.y = 2.62; hp.add(this.holoLabel);
    this.hitBox(hp, 1.3, 3, 1.3, 0, 1.5, 0); this.tag(hp, 'hunt'); this.huntAt = hp;
    // a sign over the window
    const sc = canvas(768, 96), sx = sc.getContext('2d');
    text(sx, 'TROPHY HALL', 384, 40, '800 42px sans-serif', '#ffe2b0'); text(sx, 'HABITAT RING · CAPTURED IN THE COUNTERATTACK', 384, 80, '700 19px sans-serif', '#c18cff');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), new THREE.MeshBasicMaterial({ map: tex(sc), transparent: true })); sign.position.set(0, 3.36, FRONT + 0.17); S.add(sign);
    // the doors, on the back wall
    this.door(S, 2.5, BACK, 0, 'HANGAR  ›', 'exit', { sign: '#ffd9a0', edge: GOLD });
    this.door(S, -2.5, BACK, 0, 'COMMAND DECK  ›', 'deck', { sign: '#9ff0ff', edge: 0x5ee6ff });
  }
  /** Beyond the window: deep space and the station's hub with the captured bosses in its tractor fields, all turning
   *  slowly as the ring spins. */
  outside() {
    const THREE = T(), S = this.scene, add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    this.sky = new THREE.Group(); this.sky.position.set(0, 1.8, 0); S.add(this.sky);
    const n = 1000, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); pos.set([Math.cos(a) * r * 1600, u * 1600, -Math.abs(Math.sin(a) * r) * 1600 - 300], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sky.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })));
    const nc = canvas(256, 256), nx = nc.getContext('2d'), gr = nx.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(120,70,190,.45)'); gr.addColorStop(0.55, 'rgba(60,30,110,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); nx.fillStyle = gr; nx.fillRect(0, 0, 256, 256);
    const neb = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1100), new THREE.MeshBasicMaterial({ map: tex(nc), ...add })); neb.position.set(260, 180, -1300); this.sky.add(neb);
    this.station = new Station(this.sky); this.station.group.visible = true; this.station.group.position.set(0, 3, -92); this.station.group.rotation.set(0.2, 0, 0);
    this.tag(this.hitBox(S, 7.2, 2.5, 0.1, 0, 1.83, FRONT + 0.12), 'window');
  }
  // ---------------------------------------------------------------- what is on display (rebuilt when it changes)
  sync(state) {
    this.station.sync(state);
    const c = state.counter || {}, rec = (tbl) => STAGES.map((s) => tbl?.[s.n] || 0).join('');
    const sig = [STAGES.map((s) => (trophyWon(state, s.n) ? 1 : 0)).join(''), rec(c.stars), rec(c.hard), JSON.stringify(c.best || {}), HUNTED.map((b) => (state.seen?.bosses?.[b.id] ? 1 : 0)).join(''), state.prestige?.level || 0].join('|');
    if (sig === this.sig) return; this.sig = sig; const THREE = T();
    // the lift up the Comms spire, on the right wall by the doors
    if (this.spire) { this.scene.remove(this.spire); this.untag(this.spire); } this.spire = new THREE.Group(); this.scene.add(this.spire);
    this.door(this.spire, W, 1.75, Math.PI / 2, 'COMMS SPIRE  ›', 'comms', { sealed: (state.prestige?.level || 0) < COMMS_RANK, sign: '#d8fff0', edge: 0x6dffc8 });
    for (let n = 1; n <= 6; n++) {
      const cr = this.cradles[n], stage = STAGES[n - 1], b = BOSSES[stage.boss] || {}, won = trophyWon(state, n), col = new THREE.Color(won ? b.color ?? 0x9fb0c8 : 0xff4d6a);
      if (cr.holder) cr.g.remove(cr.holder); const holder = (cr.holder = new THREE.Group()); holder.position.y = 1.72; cr.g.add(holder);
      const geo = shapeGeometry(b.shape); geo.computeBoundingSphere(); const bs = geo.boundingSphere, k = 0.52 / Math.max(0.1, bs.radius);
      if (won) { // the boss itself, hull in its colour, lit from inside the field
        const mat = new THREE.MeshPhongMaterial({ color: col.clone().lerp(new THREE.Color(0x8890a0), 0.35), emissive: col.clone().multiplyScalar(0.28), specular: 0xffffff, shininess: 60 });
        const m = new THREE.Mesh(geo, mat); m.scale.setScalar(k); m.position.set(-bs.center.x * k, -bs.center.y * k, -bs.center.z * k); holder.add(m);
      } else { // still at large: an outline that flickers
        const m = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: 0xff6a7a, transparent: true, opacity: 0.3, depthWrite: false })); m.scale.setScalar(k); m.position.set(-bs.center.x * k, -bs.center.y * k, -bs.center.z * k); holder.add(m);
      }
      cr.won = won; cr.col = col; cr.glow.color.copy(col); cr.field.material.color.copy(col).multiplyScalar(won ? 1 : 0.45); cr.motes.material.color.copy(col); cr.motes.visible = won;
      cr.plaque.material.map?.dispose(); cr.plaque.material.map = tex(this.plaque(n, state)); cr.plaque.material.needsUpdate = true;
    }
    // the hunting record: the bosses you have faced, in turn
    this.hunted = HUNTED.filter((h) => state.seen?.bosses?.[h.id]); this.huntI = -1; this.huntT = 0;
  }
  /** A cradle's plaque: the stage, the boss, its stars (normal and hard), and whether it is held. */
  plaque(n, state) {
    const c = canvas(512, 244), x = c.getContext('2d'), stage = STAGES[n - 1], b = BOSSES[stage.boss] || {}, won = trophyWon(state, n), cs = state.counter || {};
    const bg = x.createLinearGradient(0, 0, 0, 244); bg.addColorStop(0, '#12121e'); bg.addColorStop(1, '#0a0a12'); x.fillStyle = bg; x.fillRect(0, 0, 512, 244);
    x.strokeStyle = won ? hex(GOLD) : '#5a2a36'; x.lineWidth = 6; x.strokeRect(5, 5, 502, 234);
    text(x, `STAGE ${n} · ${stage.name.toUpperCase()}`, 256, 38, '800 24px sans-serif', won ? '#c18cff' : '#6a5a7a');
    text(x, won ? b.name || 'Boss' : b.name || 'Unknown', 256, 88, `800 ${(b.name || '').length > 16 ? 36 : 42}px sans-serif`, won ? '#ffe9c4' : '#8a7080');
    const s = cs.stars?.[n] || 0, hd = cs.hard?.[n] || 0;
    text(x, '★'.repeat(s) + '☆'.repeat(3 - s), 150, 146, '700 38px sans-serif', s ? '#ffc857' : '#4a4058'); text(x, 'HARD ' + '★'.repeat(hd) + '☆'.repeat(3 - hd), 362, 146, '700 30px sans-serif', hd ? '#ff6a7a' : '#4a4058');
    text(x, won ? 'CAPTURED' + (cs.best?.[n] ? ` · BEST ${cs.best[n].toLocaleString()}` : '') : 'AT LARGE · CLEAR THE STAGE TO CAPTURE', 256, 206, `800 ${won ? 22 : 18}px sans-serif`, won ? '#6dffc8' : '#ff6a7a');
    return c;
  }
  /** The next boss on the hunting hologram. */
  nextHunt() {
    const THREE = T(); while (this.holo.children.length) this.holo.remove(this.holo.children[0]);
    const list = this.hunted || [], lc = canvas(600, 112), lx = lc.getContext('2d');
    if (!list.length) { text(lx, 'NO BOSSES FACED YET', 300, 56, '800 34px sans-serif', '#5ee6ff'); this.setLabel(lc); return; }
    this.huntI = (this.huntI + 1) % list.length; const h = list[this.huntI], b = BOSSES[h.id] || {};
    const geo = shapeGeometry(b.shape); geo.computeBoundingSphere(); const bs = geo.boundingSphere, k = 0.62 / Math.max(0.1, bs.radius), at = new THREE.Vector3(-bs.center.x * k, -bs.center.y * k, -bs.center.z * k);
    const solid = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x5ee6ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })); solid.scale.setScalar(k); solid.position.copy(at); this.holo.add(solid);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: 0x9ff0ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); edges.scale.setScalar(k); edges.position.copy(at); this.holo.add(edges);
    text(lx, (b.name || 'Boss').toUpperCase(), 300, 40, '800 36px sans-serif', '#dffaff'); text(lx, `SECTOR ${h.sector} · ${h.place.toUpperCase()}`, 300, 86, '700 22px sans-serif', '#5ee6ff'); this.setLabel(lc);
  }
  setLabel(c) { const m = this.holoLabel.material; m.map?.dispose(); m.map = tex(c); m.needsUpdate = true; }
  // ---------------------------------------------------------------- every frame
  update(dt) {
    this.walk(dt); const t = this.t;
    // the ring turns: the view outside turns with it
    this.sky.rotation.z = t * 0.014; this.station.animate(dt, 0.3);
    for (let n = 1; n <= 6; n++) {
      const cr = this.cradles[n]; if (!cr.holder) continue; const k = cr.won ? 0.75 + 0.25 * Math.sin(t * 1.6 + n) : 0.35 + 0.25 * Math.max(0, Math.sin(t * 7 + n * 2) * Math.sin(t * 3.1 + n));
      cr.field.material.opacity = cr.won ? 0.4 + 0.1 * Math.sin(t * 2.2 + n) : 0.18 + 0.08 * Math.sin(t * 5 + n);
      cr.glow.color.copy(cr.col).multiplyScalar(k);
      cr.holder.rotation.y = Math.sin(t * 0.35 + n) * 0.55; cr.holder.position.y = 1.72 + Math.sin(t * 0.9 + n) * 0.05;
      if (!cr.won) cr.holder.children[0].material.opacity = 0.12 + 0.3 * (Math.sin(t * 11 + n) > 0.2 ? 1 : 0.4) * (0.6 + 0.4 * Math.sin(t * 1.3 + n));
      if (cr.won) { const p = cr.motes.geometry.attributes.position; for (let i = 0; i < cr.seeds.length; i++) { const s = cr.seeds[i]; s.y = (s.y + s.v * dt) % 1; p.setXYZ(i, Math.cos(s.a + t * 0.3) * s.r, 0.62 + s.y * 2.2, Math.sin(s.a + t * 0.3) * s.r); } p.needsUpdate = true; }
    }
    // the hunting hologram turns, flickers now and then, and moves on to the next boss every few seconds
    this.huntT -= dt; if (this.huntT <= 0) { this.huntT = 4.5; this.nextHunt(); }
    this.holo.rotation.y = t * 0.6; this.holo.visible = Math.sin(t * 23) > -0.92; this.holoBeam.material.opacity = 0.05 + 0.02 * Math.sin(t * 3);
    this.holoLabel.quaternion.copy(this.cam.quaternion);
  }
}
