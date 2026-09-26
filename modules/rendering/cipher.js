// The Cipher: the chamber in the Stellar crown, the last room aboard to walk around (rendering/room.js). It opens with the
// crown, at Overhaul rank 10. The crown's great crystal hangs from the ceiling over the loom, a ring of light that plays
// the signal from past the Deep Void (data/cipher.js): ragged noise at first, cleaner with every glyph read, steady
// gold once the message is whole, still once the Cipher is beaten. Seven plinths stand in an arc beyond it, one for
// each glyph: dark until its fragment is decoded, then lit with the glyph and a beam. The decoding console stands
// before the loom; the message read so far is on the left wall, the chart of the Origin on the right. Doors lead back
// to the Beacon array and out to the hangar. Tapping anything names it (the UI shows the details).
import { Room, canvas, tex, text, drawSign } from '@last-orbit/rendering/room.js';
import { GLYPHS, FRAGMENTS } from '@last-orbit/data/cipher.js';
const T = () => window.THREE;

// Room: x -4.4..4.4, z -8.4 (window) .. 3 (back wall, the doors), height 5.
const W = 4.4, FRONT = -8.4, BACK = 3, H = 5, LOOM = { x: 0, z: -3.4 }, CONSOLE = { x: 1.65, z: -0.9, ry: -0.45 }, GOLD = 0xffe9a8, TEAL = 0x6dfff0, INK = '#ffe9a8';
/** Where each glyph's plinth stands: an arc beyond the loom, first on the left. */
export const plinthAt = (i) => { const a = Math.PI + 0.35 + (i / (FRAGMENTS - 1)) * (Math.PI - 0.7); return { x: LOOM.x + Math.cos(a) * 2.35, z: LOOM.z + Math.sin(a) * 2.35, a }; };
/** A glyph drawn into a canvas box (x, y, size), in its strokes. */
export function drawGlyph(x, g, bx, by, s, color, width = 0.07) {
  x.strokeStyle = color; x.lineWidth = s * width; x.lineCap = 'round'; x.lineJoin = 'round';
  for (const line of g.strokes) { x.beginPath(); line.forEach(([u, v], k) => (k ? x.lineTo(bx + u * s, by + v * s) : x.moveTo(bx + u * s, by + v * s))); x.stroke(); }
}

export class CipherRoom extends Room {
  constructor() {
    super({ w: W, front: FRONT, back: BACK, h: H, start: [0, 1.4, 0] });
    this.shell({ floor: '#0c1517', wall: '#142427', ceil: '#0e1b1d', stud: '#5a4a24', tick: 'rgba(255,233,168,.2)', strip: GOLD, cove: TEAL, frame: 0x26383b, rib: 0x213235,
      lamp: 0xfff0d0, lampI: 0.3, panel: 0xfff4dc, panelW: 1.4, hemi: 0.42, sky: 0xd8f4ff, sun: 0.35,
      window: { hw: 3.6, y0: 0.55, y1: 4.4, struts: [-1.2, 1.2] }, lamps: [-6.6, 1.4], ribs: [-7.6, -0.4, 2.4] });
    this.nearFront = 0.9;
    this.furnish(); this.outside();
    this.solids.push({ ...LOOM, r: 1.55 }, { x: CONSOLE.x, z: CONSOLE.z, r: 0.5 }); for (let i = 0; i < FRAGMENTS; i++) { const p = plinthAt(i); this.solids.push({ x: p.x, z: p.z, r: 0.5 }); }
    this.bakeStatic(); /* still parts merged into fewer draw calls (room.js) */
  }
  // ---------------------------------------------------------------- the room
  furnish() {
    const THREE = T(), S = this.scene, Ph = (o) => new THREE.MeshPhongMaterial(o), add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const stone = Ph({ color: 0x1c2c30, specular: 0x4a6a70, shininess: 40 }), brass = Ph({ color: 0xd9b25a, emissive: 0x2a1e06, specular: 0xfff0c0, shininess: 70 });
    const mc = canvas(32, 32), mx = mc.getContext('2d'), mg = mx.createRadialGradient(16, 16, 0, 16, 16, 16); mg.addColorStop(0, 'rgba(255,255,255,1)'); mg.addColorStop(0.35, 'rgba(255,255,255,.5)'); mg.addColorStop(1, 'rgba(255,255,255,0)'); mx.fillStyle = mg; mx.fillRect(0, 0, 32, 32);
    this.glowTex = tex(mc);
    // the loom: a stepped dais, a brass ring on it, and the signal playing round it in light
    const loom = new THREE.Group(); loom.position.set(LOOM.x, 0, LOOM.z); S.add(loom);
    for (const [r, y, h] of [[1.45, 0.1, 0.2], [1.2, 0.3, 0.2]]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.05, h, 48), stone); d.position.y = y; loom.add(d); }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.035, 8, 64), brass); rim.rotation.x = Math.PI / 2; rim.position.y = 0.41; loom.add(rim);
    const N = 240, pos = new Float32Array(N * 3); this.waveGeo = new THREE.BufferGeometry(); this.waveGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.wave = new THREE.LineLoop(this.waveGeo, new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); this.wave.position.y = 1.55; loom.add(this.wave);
    this.wave2 = new THREE.LineLoop(this.waveGeo, new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); this.wave2.position.y = 1.55; this.wave2.scale.setScalar(1.04); loom.add(this.wave2);
    this.loomGlow = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.2, 48, 1, true), new THREE.MeshBasicMaterial({ color: TEAL, opacity: 0.06, side: THREE.DoubleSide, ...add })); this.loomGlow.position.y = 1.0; loom.add(this.loomGlow);
    this.hitBox(loom, 2.8, 2.4, 2.8, 0, 1.1, 0); this.tag(loom, 'loom');
    // the crown's great crystal, hanging over the loom on a brass collar
    const crown = new THREE.Group(); crown.position.set(LOOM.x, 0, LOOM.z); S.add(crown);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.3, 8), brass); collar.position.y = H - 0.15; crown.add(collar);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, prong = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.7, 6), brass); prong.position.set(Math.cos(a) * 0.52, H - 0.55, Math.sin(a) * 0.52); prong.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35 + Math.PI); crown.add(prong); }
    this.crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), Ph({ color: 0xdffcff, emissive: 0x1a4a4a, specular: 0xffffff, shininess: 140, transparent: true, opacity: 0.85 })); this.crystal.scale.set(0.8, 1.9, 0.8); this.crystal.position.y = H - 1.25; crown.add(this.crystal);
    this.crystalGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: TEAL, ...add })); this.crystalGlow.position.y = H - 1.25; this.crystalGlow.scale.setScalar(2.4); crown.add(this.crystalGlow);
    this.hitBox(crown, 1.4, 2.2, 1.4, 0, H - 1.2, 0); this.tag(crown, 'crystal');
    // the seven plinths, each with its glyph plate facing the loom, and a beam once it is read
    this.plinths = GLYPHS.map((g, i) => {
      const { x, z, a } = plinthAt(i), grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); S.add(grp); /* its +z faces the loom */
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.25, 0.34), stone); body.position.y = 0.625; grp.add(body);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.44), brass); cap.position.y = 1.29; grp.add(cap);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: tex(canvas(128, 128)), transparent: true })); plate.position.set(0, 0.86, 0.175); grp.add(plate);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.08, 2.6, 16, 1, true), new THREE.MeshBasicMaterial({ color: GOLD, opacity: 0, side: THREE.DoubleSide, ...add })); beam.position.y = 2.65; grp.add(beam);
      const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: GOLD, ...add })); orb.position.y = 1.5; orb.scale.setScalar(0.5); orb.material.opacity = 0; grp.add(orb);
      this.hitBox(grp, 0.8, 2, 0.8, 0, 1, 0); this.tag(grp, 'glyph' + (i + 1));
      return { g, grp, plate, beam, orb, lit: -1 };
    });
    // the decoding console, to the right of the loom and turned to the doors, its screen on a slope tipped up at you
    const desk = new THREE.Group(); desk.position.set(CONSOLE.x, 0, CONSOLE.z); desk.rotation.y = CONSOLE.ry; S.add(desk);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 0.85, 12), stone); stem.position.y = 0.43; desk.add(stem);
    const slope = new THREE.Group(); slope.position.y = 0.9; slope.rotation.x = 0.5; desk.add(slope); /* its top faces up and towards you */
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.56), brass); slope.add(top);
    this.console = this.screen(slope, canvas(512, 320), 0.7, 0.44, 0, 0.03, 0, 0, 0x1a2a2c); this.console.rotation.x = -Math.PI / 2; /* lying on the slope */
    this.hitBox(desk, 1, 1.2, 0.8, 0, 0.65, 0); this.tag(desk, 'console');
    // the message on the left wall, the chart of the Origin on the right
    this.message = this.screen(S, canvas(1024, 768), 2.6, 1.95, -W + 0.03, 2.35, -2.9, Math.PI / 2, 0x1a2a2c); this.tag(this.message, 'message');
    this.chart = this.screen(S, canvas(1024, 768), 2.6, 1.95, W - 0.03, 2.35, -2.9, -Math.PI / 2, 0x1a2a2c); this.tag(this.chart, 'chart');
    // the sign over the window (named in sync), and the doors
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.325), new THREE.MeshBasicMaterial({ transparent: true })); this.sign.position.set(0, 4.72, FRONT + 0.17); S.add(this.sign);
    this.door(S, 2.5, BACK, 0, 'HANGAR  ›', 'exit', { sign: '#fff4dc', edge: GOLD });
    this.door(S, -2.5, BACK, 0, 'BEACON ARRAY  ›', 'beacons', { sign: '#f0e8ff', edge: 0xb69cff });
  }
  /** Beyond the window: the dark past the Deep Void, and far off, where the signal comes from, a pale light that grows
   *  as the message is read (and is gone once the Cipher is beaten). */
  outside() {
    const THREE = T(), S = this.scene, add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const n = 1300, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); pos.set([Math.cos(a) * r * 1600, u * 1600, -Math.abs(Math.sin(a) * r) * 1600 - 200], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); S.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff6dc, size: 1.8, sizeAttenuation: false })));
    const neb = (w, h, stops, x, y, z) => { const c = canvas(256, 256), cx = c.getContext('2d'), gr = cx.createRadialGradient(128, 128, 0, 128, 128, 128); stops.forEach(([k, s]) => gr.addColorStop(k, s)); cx.fillStyle = gr; cx.fillRect(0, 0, 256, 256); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(c), ...add })); m.position.set(x, y, z); S.add(m); return m; };
    neb(1600, 900, [[0, 'rgba(40,140,140,.35)'], [0.6, 'rgba(10,50,60,.12)'], [1, 'rgba(0,0,0,0)']], -200, 60, -1250);
    this.source = neb(420, 420, [[0, 'rgba(255,246,220,1)'], [0.18, 'rgba(255,233,168,.55)'], [0.5, 'rgba(109,255,240,.12)'], [1, 'rgba(0,0,0,0)']], 180, 110, -1000); this.source.material.opacity = 0;
    this.tag(this.hitBox(S, 7.2, 3.85, 0.1, 0, 2.48, FRONT + 0.12), 'window');
  }
  // ---------------------------------------------------------------- what is on display (rebuilt when it changes)
  sync(state) {
    const c = state.cipher || {}, read = Math.min(FRAGMENTS, c.decoded || 0), held = state.fleet?.fragments || 0;
    const sig = [read, c.echoes || 0, held, c.beaten ? 1 : 0, c.kills || 0, state.stationName].join('|'); if (sig === this.sig) return; this.sig = sig;
    if (this.readSeen != null && read > this.readSeen) { this.flashT = 2.2; this.flashAt = read - 1; } /* a glyph just read: the crystal flares and its plinth lights */
    this.readSeen = read; this.read = read; this.beaten = !!c.beaten;
    this.plinths.forEach((p, i) => {
      const on = i < read, cv = canvas(128, 128), x = cv.getContext('2d');
      x.fillStyle = on ? 'rgba(20,40,40,.95)' : 'rgba(10,16,18,.95)'; x.fillRect(0, 0, 128, 128); x.strokeStyle = on ? INK : '#2c4044'; x.lineWidth = 4; x.strokeRect(4, 4, 120, 120);
      if (on) drawGlyph(x, p.g, 22, 22, 84, INK, 0.08); else text(x, '?', 64, 68, '800 60px sans-serif', '#2c4044');
      p.plate.material.map?.dispose(); p.plate.material.map = tex(cv); p.plate.material.needsUpdate = true; p.lit = on ? 1 : 0;
    });
    const sc = canvas(768, 96); drawSign(sc.getContext('2d'), 'THE CIPHER', `STELLAR CROWN${state.stationName ? ' · ' + state.stationName.toUpperCase() : ''}`, '#fff4dc', '#6dfff0');
    this.sign.material.map?.dispose(); this.sign.material.map = tex(sc); this.sign.material.needsUpdate = true;
    this.drawConsole(read, held, c); this.drawMessage(read); this.drawChart(read, c);
  }
  drawConsole(read, held, c) {
    const t = this.console.userData.face.material.map, x = t.image.getContext('2d'), done = read >= FRAGMENTS;
    x.fillStyle = '#081214'; x.fillRect(0, 0, 512, 320); x.strokeStyle = held ? INK : '#2c4a4e'; x.lineWidth = 6; x.strokeRect(6, 6, 500, 308);
    text(x, 'DECODER', 256, 50, '800 34px sans-serif', '#6dfff0');
    text(x, `${held}`, 256, 150, '800 96px sans-serif', held ? INK : '#3a5a5e'); text(x, held === 1 ? 'FRAGMENT TO DECODE' : 'FRAGMENTS TO DECODE', 256, 222, '700 26px sans-serif', held ? '#fff4dc' : '#5a7a7e');
    text(x, held ? (done ? 'TAP TO DECODE AN ECHO' : 'TAP TO TUNE THE SIGNAL') : done ? (c.beaten ? 'THE SIGNAL IS SILENT' : 'THE MESSAGE IS READ') : 'BRING FRAGMENTS HOME', 256, 280, '800 24px sans-serif', held ? '#6dfff0' : '#5a7a7e');
    t.needsUpdate = true;
  }
  drawMessage(read) {
    const t = this.message.userData.face.material.map, x = t.image.getContext('2d');
    x.fillStyle = '#081214'; x.fillRect(0, 0, 1024, 768); x.strokeStyle = '#6dfff0'; x.lineWidth = 5; x.strokeRect(6, 6, 1012, 756);
    text(x, 'THE MESSAGE', 36, 56, '800 42px sans-serif', '#fff4dc', 'left'); text(x, `${read}/${FRAGMENTS} GLYPHS`, 988, 56, '800 26px sans-serif', '#6dfff0', 'right');
    GLYPHS.forEach((g, i) => {
      const y = 132 + i * 90, on = i < read;
      x.fillStyle = on ? 'rgba(109,255,240,.06)' : 'rgba(255,255,255,.02)'; x.fillRect(24, y - 38, 976, 76);
      if (on) drawGlyph(x, g, 40, y - 28, 56, INK, 0.09); else text(x, '?', 68, y, '800 40px sans-serif', '#2c4044');
      if (on) { const words = g.line.split(' '), lines = ['']; for (const wd of words) { if ((lines.at(-1) + ' ' + wd).length > 46) lines.push(wd); else lines[lines.length - 1] = (lines.at(-1) + ' ' + wd).trim(); } lines.slice(0, 2).forEach((l, k) => text(x, l, 120, y + (lines.length > 1 ? (k ? 16 : -16) : 0), '600 27px sans-serif', '#dff8f4', 'left')); }
      else text(x, '· · · · · · · · · · · ·', 120, y, '700 27px sans-serif', '#2c4044', 'left');
    });
    t.needsUpdate = true;
  }
  drawChart(read, c) {
    const t = this.chart.userData.face.material.map, x = t.image.getContext('2d'), done = read >= FRAGMENTS;
    x.fillStyle = '#081214'; x.fillRect(0, 0, 1024, 768); x.strokeStyle = INK; x.lineWidth = 5; x.strokeRect(6, 6, 1012, 756);
    text(x, 'THE ORIGIN', 36, 56, '800 42px sans-serif', '#fff4dc', 'left'); text(x, done ? (c.beaten ? 'SILENT' : 'FOUND') : 'UNKNOWN', 988, 56, '800 26px sans-serif', done ? '#6dfff0' : '#5a7a7e', 'right');
    // the charts, and past their edge, where the signal comes from
    x.strokeStyle = 'rgba(109,255,240,.25)'; x.lineWidth = 2; for (let r = 60; r <= 300; r += 60) { x.beginPath(); x.arc(300, 420, r, 0, Math.PI * 2); x.stroke(); }
    x.fillStyle = '#6dfff0'; x.beginPath(); x.arc(300, 420, 10, 0, Math.PI * 2); x.fill(); text(x, 'HOME', 300, 450, '700 20px sans-serif', '#6dfff0');
    text(x, 'EDGE OF THE CHARTS', 300, 100, '700 20px sans-serif', 'rgba(109,255,240,.6)');
    const k = read / FRAGMENTS, sx = 760, sy = 250; x.setLineDash([10, 10]); x.strokeStyle = `rgba(255,233,168,${0.2 + 0.6 * k})`; x.beginPath(); x.moveTo(300, 420); x.lineTo(300 + (sx - 300) * Math.max(0.15, k), 420 + (sy - 420) * Math.max(0.15, k)); x.stroke(); x.setLineDash([]);
    if (done) { x.fillStyle = c.beaten ? '#5a7a7e' : INK; x.beginPath(); x.arc(sx, sy, 16, 0, Math.PI * 2); x.fill(); text(x, 'THE ORIGIN', sx, sy + 40, '800 26px sans-serif', c.beaten ? '#8aa4a8' : INK); }
    text(x, done ? (c.beaten ? `THE CIPHER BEATEN ×${c.kills || 1}${c.best ? ' · BEST ' + Math.floor(c.best / 60) + ':' + String(c.best % 60).padStart(2, '0') : ''}` : 'FOLLOW THE SIGNAL ON A DEEP VOID RUN') : `READ ${FRAGMENTS - read} MORE GLYPH${FRAGMENTS - read === 1 ? '' : 'S'} TO FIND IT`, 512, 720, '800 28px sans-serif', done ? '#fff4dc' : '#8aa4a8');
    t.needsUpdate = true;
  }
  // ---------------------------------------------------------------- every frame
  update(dt) {
    this.walk(dt); const t = this.t, read = this.read || 0, k = read / FRAGMENTS, calm = this.beaten;
    // the signal round the loom: noisy until read, then a clean gold wave; still once the Cipher is beaten
    const P = this.waveGeo.attributes.position.array, N = P.length / 3, noise = calm ? 0 : (1 - k) * 0.22, amp = calm ? 0.02 : 0.08 + 0.12 * k;
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, y = Math.sin(a * 7 + t * (calm ? 0.3 : 2)) * amp + (Math.random() - 0.5) * noise * (0.6 + 0.4 * Math.sin(t * 5 + i)); P[i * 3] = Math.cos(a) * 1.1; P[i * 3 + 1] = y; P[i * 3 + 2] = Math.sin(a) * 1.1; }
    this.waveGeo.attributes.position.needsUpdate = true;
    const col = read >= FRAGMENTS ? GOLD : TEAL; this.wave.material.color.setHex(col); this.wave2.material.color.setHex(col); this.wave.rotation.y = t * 0.15; this.wave2.rotation.y = -t * 0.1;
    // the crystal turns and breathes; a glyph just read makes it flare
    const flare = this.flashT > 0 ? (this.flashT -= dt, Math.max(0, this.flashT) / 2.2) : 0;
    this.crystal.rotation.y = t * 0.25; this.crystalGlow.material.opacity = 0.45 + 0.15 * Math.sin(t * 1.7) + flare * 0.9; this.crystalGlow.scale.setScalar(2.4 + flare * 2.5); this.crystalGlow.material.color.setHex(col);
    this.loomGlow.material.opacity = 0.05 + 0.03 * Math.sin(t * 2.3) + flare * 0.15;
    for (const [i, p] of this.plinths.entries()) {
      const on = p.lit === 1, fresh = flare > 0 && i === this.flashAt;
      p.beam.material.opacity = on ? 0.07 + 0.03 * Math.sin(t * 2 + i) + (fresh ? flare * 0.5 : 0) : 0;
      p.orb.material.opacity = on ? 0.55 + 0.25 * Math.sin(t * 1.6 + i) : 0; p.orb.position.y = 1.5 + Math.sin(t * 1.2 + i) * 0.05;
    }
    // far off, the source of the signal: brighter with each glyph, gone once it is silent
    this.source.material.opacity = calm ? 0 : k * (0.55 + 0.25 * Math.sin(t * 1.1));
  }
}
