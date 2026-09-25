// The Comms room: the radio room at the top of the Comms spire, the fourth room aboard to walk around (rendering/room.js).
// It opens with the spire, at Overhaul rank 3. The radio console in the middle carries ORBIT's listening post: a live
// waveform, the frequency, a microphone (tap it for what the spire is picking up). The bounty board on the left wall
// lists the day's three bounties with their progress; the system map on the right pings the sectors and keeps the
// tally. Through the window: the spire's mast with its beacon, the big dish sweeping the sky and sending out rings, and
// the Earth below. Doors lead back to the Trophy Hall and out to the hangar.
import { Room, canvas, tex, text, EYE } from '@last-orbit/rendering/room.js';
import { earthMaterial, nightAmount } from '@last-orbit/rendering/background.js';
import { bountyProgress, bountyText, untilNextPost } from '@last-orbit/progression/bounties.js';
import { BOUNTY_BONUS_BP } from '@last-orbit/data/bounties.js';
import { SECTORS } from '@last-orbit/data/sectors.js';
const T = () => window.THREE;

// Room: x -4.2..4.2, z -7.4 (window) .. 3.2 (back wall, the doors), height 3.8.
const W = 4.2, FRONT = -7.4, BACK = 3.2, H = 3.8, MINT = 0x6dffc8, CONSOLE = { x: 0, z: -4.3 };
const fmt = (n) => Math.round(n).toLocaleString('en-GB');

export class CommsRoom extends Room {
  constructor() {
    super({ w: W, front: FRONT, back: BACK, h: H, start: [0, 1.6, 0] });
    this.shell({ floor: '#16201f', wall: '#22302f', ceil: '#18221f', stud: '#2a5a4a', tick: 'rgba(109,255,200,.2)', strip: MINT, cove: MINT, frame: 0x33443f, rib: 0x2a3a36,
      lamp: 0xd8fff0, lampI: 0.38, panel: 0xe6fff4, panelW: 1.6, hemi: 0.45, sky: 0xcff0ff, sun: 0.6,
      window: { hw: 3.5, y0: 0.6, y1: 3.4, struts: [-1.15, 1.15] }, lamps: [-5.6, -2.2, 1], ribs: [-6.5, -3.65, 0.05] });
    this.nearFront = 0.9;
    this.furnish(); this.outside();
    this.solids.push({ x: CONSOLE.x, z: CONSOLE.z - 0.1, r: 1.45 });
    for (const s of [-1, 1]) this.blocks.push({ x0: s < 0 ? -W : W - 0.75, x1: s < 0 ? -W + 0.75 : W, z0: 0.6, z1: 2.6 }); // the racks
  }
  // ---------------------------------------------------------------- the room
  furnish() {
    const THREE = T(), S = this.scene, Ph = (o) => new THREE.MeshPhongMaterial(o);
    const metal = Ph({ color: 0x2c3a38, specular: 0x5a7a70, shininess: 45 }), dark = Ph({ color: 0x121a19, specular: 0x2a3a36, shininess: 30 }), mint = new THREE.MeshBasicMaterial({ color: MINT });
    // the radio console: an arc of desk facing the room, screens along it, a microphone on a boom
    const cg = new THREE.Group(); cg.position.set(CONSOLE.x, 0, CONSOLE.z); S.add(cg);
    const arc = (r0, r1, y, h, m) => { const sh = new THREE.Shape(); sh.absarc(0, 0, r1, Math.PI * 0.12, Math.PI * 0.88, false); sh.absarc(0, 0, r0, Math.PI * 0.88, Math.PI * 0.12, true); const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); const mm = new THREE.Mesh(g, m); mm.position.y = y; mm.rotation.y = Math.PI; cg.add(mm); return mm; };
    arc(0.9, 1.45, 0, 0.78, metal); arc(0.86, 1.52, 0.78, 0.06, dark); arc(1.44, 1.47, 0.72, 0.03, mint);
    this.wave = { c: canvas(512, 256), t: 0 }; this.wave.tex = tex(this.wave.c);
    this.dial = { c: canvas(512, 256), t: 0 }; this.dial.tex = tex(this.dial.c);
    const scr = (map, a) => { const g = new THREE.Group(); g.position.set(Math.sin(a) * 1.2, 1.28, Math.cos(a) * 1.2); g.rotation.y = a + Math.PI; cg.add(g);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.54, 0.05), dark); g.add(b); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.46), new THREE.MeshBasicMaterial({ map })); f.position.z = -0.03; f.rotation.y = Math.PI; g.add(f);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 8), metal); st.position.y = -0.42; g.add(st); return g; };
    scr(this.wave.tex, -0.62); scr(this.dial.tex, 0); this.mapMini = { c: canvas(512, 256) }; this.mapMini.tex = tex(this.mapMini.c); scr(this.mapMini.tex, 0.62);
    // the microphone, on a boom over the desk
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 8), metal); boom.position.set(0.45, 1.12, 1.05); boom.rotation.set(0.9, 0, 0.5); cg.add(boom);
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 12), dark); mic.position.set(0.28, 1.28, 1.3); mic.rotation.x = 0.9; cg.add(mic);
    this.micLight = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4d6a })); this.micLight.position.set(0.28, 1.37, 1.36); cg.add(this.micLight);
    this.hitBox(cg, 3, 1.9, 1.6, 0, 0.95, 0.9); this.tag(cg, 'radio');
    // the bounty board on the left wall, the system map on the right (both drawn in sync)
    this.board = this.screen(S, canvas(1024, 600), 2.7, 1.58, -W + 0.03, 1.8, -1.9, Math.PI / 2, 0x1a2624); this.tag(this.board, 'bounties');
    this.map = this.screen(S, canvas(1024, 600), 2.7, 1.58, W - 0.03, 1.8, -1.9, -Math.PI / 2, 0x1a2624); this.tag(this.map, 'log');
    // racks of radio gear in the back corners, their lights blinking
    this.leds = [];
    for (const s of [-1, 1]) {
      const rk = new THREE.Group(); rk.position.set(s * (W - 0.4), 0, 1.6); S.add(rk);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 1.9), metal); body.position.y = 1.1; rk.add(body);
      for (let i = 0; i < 7; i++) { const face = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 1.7), dark); face.position.set(-s * 0.36, 0.3 + i * 0.27, 0); rk.add(face);
        for (let j = 0; j < 6; j++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), new THREE.MeshBasicMaterial({ color: j % 3 ? MINT : 0xffb547 })); l.position.set(-s * 0.375, 0.3 + i * 0.27, -0.7 + j * 0.28); rk.add(l); this.leds.push({ l, ph: Math.random() * 6, v: 1 + Math.random() * 3 }); } }
    }
    // a sign over the window
    const sc = canvas(768, 96), sx = sc.getContext('2d');
    text(sx, 'COMMS SPIRE', 384, 40, '800 42px sans-serif', '#d8fff0'); text(sx, 'RADIO ROOM · LISTENING ON ALL FREQUENCIES', 384, 80, '700 19px sans-serif', '#6dffc8');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), new THREE.MeshBasicMaterial({ map: tex(sc), transparent: true })); sign.position.set(0, 3.6, FRONT + 0.17); S.add(sign);
    // the doors, on the back wall
    this.door(S, 2.4, BACK, 0, 'HANGAR  ›', 'exit', { sign: '#d8fff0', edge: MINT });
    this.door(S, -2.4, BACK, 0, 'TROPHY HALL  ›', 'hall', { sign: '#ffe2b0', edge: 0xffc857 });
  }
  /** Beyond the window: the Earth below, the spire's mast and beacon, and the dish sweeping the sky. */
  outside() {
    const THREE = T(), S = this.scene, add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(600, 96, 64), earthMaterial()); this.earth.position.set(0, -600, -700); this.earth.rotation.x = 1.1; S.add(this.earth);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(622, 64, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN, vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN, vV; void main(){ float k = pow(1. - abs(dot(vN, vV)), 3.5); gl_FragColor = vec4(vec3(.3, .6, 1.) * k * 1.4, k); }' }));
    atmo.position.copy(this.earth.position); S.add(atmo); this.sunDir = new THREE.Vector3(-0.6, 0.55, 0.5).normalize();
    const n = 800, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); pos.set([Math.cos(a) * r * 1800, Math.abs(u) * 1800 - 100, -Math.abs(Math.sin(a) * r) * 1800 - 250], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); S.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })));
    // the mast: a lattice tower rising past the window on the left, its beacon at the top
    const truss = new THREE.MeshPhongMaterial({ color: 0x9aa4b6, specular: 0x444c5c, shininess: 30 }), M = new THREE.Group(); M.position.set(-3.4, -14.5, FRONT - 10); S.add(M);
    for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 22, 6), truss); leg.position.set(x, 11, z); M.add(leg); }
    for (let i = 0; i < 20; i++) { const y = i * 1.1; for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.05), truss); b.position.set(0, y + 0.55, 0); b.rotation.set(0, r, i % 2 ? 0.66 : -0.66); M.add(b); } }
    const bc = canvas(64, 64), bx = bc.getContext('2d'), bg = bx.createRadialGradient(32, 32, 0, 32, 32, 32); bg.addColorStop(0, 'rgba(255,255,255,1)'); bg.addColorStop(0.3, 'rgba(255,90,100,.9)'); bg.addColorStop(1, 'rgba(255,40,60,0)'); bx.fillStyle = bg; bx.fillRect(0, 0, 64, 64);
    this.beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(bc), ...add })); this.beacon.position.set(0, 22.4, 0); this.beacon.scale.setScalar(3); M.add(this.beacon);
    // the dish on the right: a bowl on a yoke, sweeping slowly, sending rings out as it transmits
    const D = (this.dish = new THREE.Group()); D.position.set(4.6, 1, FRONT - 15); S.add(D);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 4, 12), truss); post.position.y = -2; D.add(post);
    this.dishHead = new THREE.Group(); D.add(this.dishHead);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 12, 0, Math.PI * 2, 0, 0.9), new THREE.MeshPhongMaterial({ color: 0xdfe4ee, specular: 0x8899aa, shininess: 40, side: THREE.DoubleSide })); bowl.rotation.x = -Math.PI / 2 + 0.5; /* its hollow faces up and away, into the sky */ this.dishHead.add(bowl);
    this.axis = new THREE.Vector3(0, Math.sin(0.5), -Math.cos(0.5)); /* where the dish points */ const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6), truss); feed.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.axis); feed.position.copy(this.axis).multiplyScalar(1.4); this.dishHead.add(feed);
    const rc = canvas(128, 128), rx = rc.getContext('2d'), rg = rx.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0.72, 'rgba(109,255,200,0)'); rg.addColorStop(0.86, 'rgba(160,255,220,.8)'); rg.addColorStop(1, 'rgba(109,255,200,0)'); rx.fillStyle = rg; rx.fillRect(0, 0, 128, 128);
    this.ringTex = tex(rc); this.rings = []; this.ringT = 0;
    this.tag(this.hitBox(S, 7, 2.8, 0.1, 0, 2, FRONT + 0.12), 'window');
  }
  // ---------------------------------------------------------------- what is on display
  sync(state) {
    const bt = state.bounties || {}, list = bt.list || [], prog = list.map((b) => bountyProgress(state, b));
    const sig = [bt.day, list.map((b, i) => `${b.id}:${prog[i]}/${b.goal}:${b.done ? 1 : 0}${b.claimed ? 1 : 0}`).join(','), bt.done || 0, bt.days || 0, Math.floor(Date.now() / 60000)].join('|');
    if (sig === this.sig) return; this.sig = sig;
    this.drawBoard(state, list, prog, bt); this.drawMap(state, bt);
  }
  drawBoard(state, list, prog, bt) {
    const face = this.board.userData.face, c = face.material.map.image, x = c.getContext('2d');
    x.fillStyle = '#07100f'; x.fillRect(0, 0, 1024, 600); x.strokeStyle = '#6dffc8'; x.lineWidth = 5; x.strokeRect(6, 6, 1012, 588);
    text(x, 'DAILY BOUNTIES', 36, 50, '800 44px sans-serif', '#d8fff0', 'left'); text(x, bt.day ? `NEW IN ${untilNextPost().toUpperCase()}` : '', 988, 50, '700 26px sans-serif', '#6dffc8', 'right');
    if (!list.length) text(x, 'NO BOUNTIES POSTED YET', 512, 300, '800 40px sans-serif', '#4a6a60');
    list.forEach((b, i) => {
      const y = 110 + i * 150, k = Math.min(1, prog[i] / b.goal), col = b.claimed ? '#4a6a60' : b.done ? '#ffd27a' : '#e8fff6';
      x.fillStyle = b.done && !b.claimed ? 'rgba(255,200,87,.1)' : 'rgba(109,255,200,.05)'; x.fillRect(24, y, 976, 132);
      for (let t = 0; t < 3; t++) { x.fillStyle = t < b.tier ? '#6dffc8' : '#1c3a32'; x.fillRect(44 + t * 22, y + 26, 14, 30); }
      text(x, bountyText(b), 130, y + 42, '800 34px sans-serif', col, 'left');
      text(x, b.claimed ? 'PAID' : b.done ? 'DONE · COLLECT' : `+${fmt(b.reward)}`, 976, y + 42, '800 28px sans-serif', b.claimed ? '#4a6a60' : b.done ? '#ffd27a' : '#ffc857', 'right');
      x.fillStyle = '#12302a'; x.fillRect(130, y + 82, 700, 22); x.fillStyle = b.done ? '#ffd27a' : '#6dffc8'; x.fillRect(130, y + 82, 700 * k, 22);
      text(x, `${fmt(prog[i])} / ${fmt(b.goal)}`, 976, y + 93, '700 26px sans-serif', '#8ab8a8', 'right');
    });
    text(x, `ALL THREE TODAY: +${BOUNTY_BONUS_BP} BLUEPRINT${BOUNTY_BONUS_BP > 1 ? 'S' : ''}${bt.bonus ? ' · EARNED' : ''}`, 512, 572, '800 24px sans-serif', bt.bonus ? '#6dffc8' : '#ff9f43');
    face.material.map.needsUpdate = true;
  }
  drawMap(state, bt) {
    const face = this.map.userData.face, c = face.material.map.image, x = c.getContext('2d');
    x.fillStyle = '#07100f'; x.fillRect(0, 0, 1024, 600); x.strokeStyle = '#6dffc8'; x.lineWidth = 5; x.strokeRect(6, 6, 1012, 588);
    text(x, 'SYSTEM MAP', 36, 50, '800 44px sans-serif', '#d8fff0', 'left'); text(x, `BOUNTIES DONE ${bt.done || 0} · FULL DAYS ${bt.days || 0}`, 988, 50, '700 26px sans-serif', '#6dffc8', 'right');
    const cx = 512, cy = 330; x.strokeStyle = 'rgba(109,255,200,.25)'; x.lineWidth = 2; for (const r of [70, 140, 210]) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); }
    x.fillStyle = '#5ee6ff'; x.beginPath(); x.arc(cx, cy, 16, 0, Math.PI * 2); x.fill(); text(x, 'EARTH', cx, cy + 36, '700 20px sans-serif', '#5ee6ff');
    const reached = state.stats.bestSector || 1;
    SECTORS.slice(0, 6).forEach((s, i) => { const a = -Math.PI / 2 + (i / 6) * Math.PI * 2, px = cx + Math.cos(a) * 210, py = cy + Math.sin(a) * 210, on = i < reached;
      x.fillStyle = on ? '#6dffc8' : '#2a4a40'; x.beginPath(); x.arc(px, py, 11, 0, Math.PI * 2); x.fill(); text(x, s.name.toUpperCase(), px, py + (Math.sin(a) > 0 ? 34 : -28), '700 20px sans-serif', on ? '#bfffe6' : '#3a5a50'); });
    face.material.map.needsUpdate = true;
  }
  /** The live displays on the console: the waveform, the dial, the mini map with its sweep. */
  drawConsole(t) {
    const w = this.wave.c.getContext('2d'); w.fillStyle = '#04100c'; w.fillRect(0, 0, 512, 256); w.strokeStyle = 'rgba(109,255,200,.15)'; w.lineWidth = 1; for (let i = 0; i < 512; i += 32) { w.beginPath(); w.moveTo(i, 0); w.lineTo(i, 256); w.stroke(); } for (let j = 0; j < 256; j += 32) { w.beginPath(); w.moveTo(0, j); w.lineTo(512, j); w.stroke(); }
    w.strokeStyle = '#6dffc8'; w.lineWidth = 3; w.beginPath(); for (let i = 0; i <= 512; i += 4) { const u = i / 512, y = 128 + Math.sin(u * 22 + t * 6) * 38 * Math.sin(t * 0.7 + u * 3) + Math.sin(u * 61 - t * 11) * 14 + (Math.random() - 0.5) * 8; if (i) w.lineTo(i, y); else w.moveTo(i, y); } w.stroke();
    this.wave.tex.needsUpdate = true;
    const d = this.dial.c.getContext('2d'); d.fillStyle = '#04100c'; d.fillRect(0, 0, 512, 256); const f = 121.5 + Math.sin(t * 0.13) * 0.4;
    text(d, f.toFixed(3) + ' MHz', 256, 92, '800 58px monospace', '#d8fff0'); text(d, 'ORBIT · LISTENING', 256, 160, '700 26px sans-serif', '#6dffc8');
    for (let i = 0; i < 16; i++) { const on = i < 6 + Math.round(5 + 4 * Math.sin(t * 3 + i * 0.3)); d.fillStyle = on ? (i > 12 ? '#ffb547' : '#6dffc8') : '#12302a'; d.fillRect(96 + i * 20, 198, 14, 30); }
    this.dial.tex.needsUpdate = true;
    const m = this.mapMini.c.getContext('2d'); m.fillStyle = '#04100c'; m.fillRect(0, 0, 512, 256); m.strokeStyle = 'rgba(109,255,200,.35)'; m.lineWidth = 2; for (const r of [40, 80, 118]) { m.beginPath(); m.arc(256, 128, r, 0, Math.PI * 2); m.stroke(); }
    const a = t * 1.4; m.strokeStyle = '#6dffc8'; m.lineWidth = 3; m.beginPath(); m.moveTo(256, 128); m.lineTo(256 + Math.cos(a) * 118, 128 + Math.sin(a) * 118); m.stroke();
    text(m, 'SIGNAL SWEEP', 256, 236, '700 20px sans-serif', '#6dffc8'); this.mapMini.tex.needsUpdate = true;
  }
  // ---------------------------------------------------------------- every frame
  update(dt) {
    this.walk(dt); const t = this.t;
    this.consoleT = (this.consoleT || 0) - dt; if (this.consoleT <= 0) { this.consoleT = 0.08; this.drawConsole(t); }
    for (const l of this.leds) l.l.visible = Math.sin(t * l.v + l.ph) > -0.3;
    this.micLight.visible = Math.sin(t * 2) > 0;
    this.beacon.material.opacity = Math.sin(t * 2.4) > 0.2 ? 1 : 0.15;
    this.dishHead.rotation.y = 0.85 + Math.sin(t * 0.12) * 0.35; this.dishHead.rotation.x = Math.sin(t * 0.09) * 0.1;
    // the dish transmits: a ring every few seconds, out along where it points
    this.ringT -= dt; if (this.ringT <= 0) { this.ringT = 2.6; const THREE = T(), r = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.ringTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      this.dishHead.add(r); r.rotation.x = 0.5; /* square to where it points */ this.rings.push({ r, t: 0 }); }
    for (let i = this.rings.length - 1; i >= 0; i--) { const q = this.rings[i]; q.t += dt; const k = q.t / 2.4; if (k >= 1) { this.dishHead.remove(q.r); q.r.material.dispose(); this.rings.splice(i, 1); continue; } q.r.scale.setScalar(2.5 + k * 14); q.r.position.copy(this.axis).multiplyScalar(1.5 + k * 16); q.r.material.opacity = (1 - k) * 0.8; }
    const u = this.earth.material.uniforms; if (u) { u.time.value = this.t + 700; u.night.value = nightAmount(); u.sun.value.copy(this.sunDir).transformDirection(this.cam.matrixWorldInverse); }
  }
}
