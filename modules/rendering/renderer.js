// Three.js view of the simulation. Reads world arrays, drains world.fx, never writes game state.
// Draw-call budget: one InstancedMesh per enemy shape in use, one for barriers, one for drones, a handful of sprite batches, the player group and the backdrop.
import { G } from '@last-orbit/core/game.js';
import { bus } from '@last-orbit/core/events.js';
import { fmt } from '@last-orbit/core/format.js';
import { Big } from '@last-orbit/core/big.js';
import { FIELD } from '@last-orbit/data/balance.js';
import { DRONES } from '@last-orbit/data/drones.js';
import { shapeGeometry, playerParts, unitBox, droneGeometry, supportCraftGeometry } from '@last-orbit/rendering/geometry.js';
import { SpriteBatch, Particles, Transients, makeTextures, rgb, css, jagged, WHITE } from '@last-orbit/rendering/effects.js';
import { Background } from '@last-orbit/rendering/background.js';
import { playSfx } from '@last-orbit/audio/audio.js';

const CAP = { swarm: 110, scout: 70, weaver: 70, plate: 60, armourPlate: 12, turret: 12, wyrmSeg: 16, rocket: 30 };
const RED = rgb(0xff4d7a), AMBER = rgb(0xffb547), CYAN = rgb(0x5ee6ff), GOLD = rgb(0xffd700), VIOLET = rgb(0xc77dff);
const SCRAP = rgb(0xc9d5df), REPAIR = rgb(0x80ffd2);
const BULLET_COL = { bolt: rgb(0xff5d8f), heavy: rgb(0xff9f43), orb: rgb(0xd17bff), snipe: rgb(0xffffff) };

export class Renderer {
  constructor(canvas, overlay) {
    const THREE = window.THREE; this.canvas = canvas; this.overlay = overlay; this.ctx2d = overlay.getContext('2d');
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); this.gl.setClearColor(0x050a24, 1);
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(38, 1, 10, 1500);
    this.scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x1a1030, 0.85)); const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(-40, 60, 120); this.scene.add(sun);
    this.tex = makeTextures(); this.pr = 1; this.insets = { top: 60, bottom: 140 }; this.cur = { top: 60, bottom: 140 }; this.shake = 0; this.frameMs = 16; this.lowT = 0; this.highT = 0; this.autoLow = false; this.qualityMode = null; this.fitCache = null; this.fitDirty = true;
    this.bg = new Background(this.scene, this.tex, 1);
    // field furniture
    const rail = new THREE.BufferGeometry(); rail.setAttribute('position', new THREE.Float32BufferAttribute([-52, -10, 0, -52, 170, 0, 52, -10, 0, 52, 170, 0, -52, FIELD.LAND_Y, 0, 52, FIELD.LAND_Y, 0], 3));
    this.rails = new THREE.LineSegments(rail, new THREE.LineBasicMaterial({ color: 0x5ee6ff, transparent: true, opacity: 0.14 })); this.scene.add(this.rails);
    // enemies
    this.enemyMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x10131c }); this.meshes = {}; this.dummy = new THREE.Object3D(); this.col = new THREE.Color();
    // barriers: 5×2 blocks each
    this.barrierMesh = this.inst(unitBox(), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x0a2530 }), 40);
    this.droneMesh = this.inst(droneGeometry(), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x222222 }), 28);
    this.supportMesh = this.inst(supportCraftGeometry(), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x17232a }), 2);
    // sprite batches (draw order: under → over)
    const B = (this.B = { dark: new SpriteBatch(this.tex.soft, 8, false, -1), under: new SpriteBatch(this.tex.soft, 220, true, -2), soft: new SpriteBatch(this.tex.soft, 2600, true, 1), streak: new SpriteBatch(this.tex.streak, 700, true, 1), ring: new SpriteBatch(this.tex.ring, 120, true, 1), ore: new SpriteBatch(this.tex.ore, 96, false, 2), reticle: new SpriteBatch(this.tex.reticle, 8, true, 2) });
    B.dark.mesh.material.color.set(0x000000); B.under.mesh.renderOrder = 1; for (const k in B) this.scene.add(B[k].mesh);
    this.parts = new Particles(1800); this.trans = new Transients(); this.texts = []; this.engineT = 0;
    this.supportWorld = null; this.salvageDrops = []; this.salvageCraft = null; this.repairCraft = null; this.repairBeamT = 0;
    this.buildPlayer(); this.resize(); this.lastSector = -1;
  }
  inst(geo, mat, cap) { const THREE = window.THREE, m = new THREE.InstancedMesh(geo, mat, cap); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; this.scene.add(m); return m; }
  meshFor(shape) { return this.meshes[shape] || (this.meshes[shape] = this.inst(shapeGeometry(shape), this.enemyMat, CAP[shape] || (shape.startsWith('boss') || shape.startsWith('mini') ? 3 : 40))); }

  buildPlayer() {
    const THREE = window.THREE, g = (this.player = new THREE.Group()), P = playerParts(); this.pp = {};
    const mats = {
      hull: new THREE.MeshLambertMaterial({ color: 0x718996, emissive: 0x07121a }),
      deck: new THREE.MeshLambertMaterial({ color: 0xe2eced, emissive: 0x131a20 }),
      dark: new THREE.MeshLambertMaterial({ color: 0x152735, emissive: 0x03090e }),
      glass: new THREE.MeshPhongMaterial({ color: 0x125875, emissive: 0x073345, shininess: 110, specular: 0xb8f5ff }),
      trim: new THREE.MeshLambertMaterial({ color: 0x52dcff, emissive: 0x176c83 }),
      gun: new THREE.MeshLambertMaterial({ color: 0x667782, emissive: 0x111b24 }),
      gold: new THREE.MeshLambertMaterial({ color: 0xffb94e, emissive: 0x583000 })
    };
    const use = { hull: 'hull', deck: 'deck', cockpit: 'glass', chassis: 'dark', markings: 'gold', lights: 'trim', wings: 'deck', pods: 'gun', pods2: 'gun', armour: 'deck', fins: 'hull', crown: 'gold', engine: 'trim' };
    for (const k in P) { const m = new THREE.Mesh(P[k], mats[use[k]]); g.add(m); this.pp[k] = m; }
    g.scale.setScalar(3.1); this.scene.add(g); this.playerMats = mats;
  }
  /** The ship visibly grows with the build. */
  refreshPlayerLook() {
    const st = G.state, up = st.run.upgrades, pp = this.pp, total = Object.values(up).reduce((a, b) => a + b, 0), slots = st.run.equipped.filter(Boolean).length;
    pp.wings.visible = total >= 8; pp.pods.visible = slots >= 2 || (up.multi || 0) >= 1; pp.pods2.visible = slots >= 3 || (up.multi || 0) >= 3; pp.armour.visible = (up.hull || 0) >= 25; pp.fins.visible = total >= 120 || st.prestige.count >= 1; pp.crown.visible = st.prestige.count >= 3 || st.asc.count > 0;
    this.player.scale.setScalar(3.1 + Math.min(0.9, total / 900) + (st.prestige.count ? 0.2 : 0));
    this.playerMats.trim.color.set(st.asc.count ? 0xffffff : st.prestige.count >= 5 ? 0xb69cff : 0x5ee6ff);
  }

  setQuality() { const q = G.state.settings.quality, dpr = window.devicePixelRatio || 1; if (q !== this.qualityMode) { this.qualityMode = q; this.lowT = 0; this.highT = 0; if (q === 'auto') this.autoLow = false; } this.pr = q === 'low' ? 1 : q === 'high' ? Math.min(dpr, 2.5) : Math.min(dpr, this.autoLow ? 1.25 : 2); this.parts.scale = q === 'low' || (q === 'auto' && this.autoLow) ? 0.45 : 1; this.resize(); }
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight; this.w = w; this.h = h;
    this.gl.setPixelRatio(this.pr); this.gl.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.fitDirty = true;
    const o = this.overlay, opr = Math.min(window.devicePixelRatio || 1, 2); o.width = Math.round(w * opr); o.height = Math.round(h * opr); this.opr = opr;
    for (const s of this.bg.stars) s.material.uniforms.pr.value = this.pr;
  }
  setInsets(top, bottom) { if (Math.abs(this.insets.top - top) > 0.25 || Math.abs(this.insets.bottom - bottom) > 0.25) { this.insets.top = top; this.insets.bottom = bottom; } }

  fitCamera(dt) {
    const THREE = window.THREE, cam = this.camera, c = this.cur, k = Math.min(1, dt * 7);
    const prevTop = c.top, prevBottom = c.bottom; c.top += (this.insets.top - c.top) * k; c.bottom += (this.insets.bottom - c.bottom) * k;
    const rw = this.w - 8, rh = Math.max(120, this.h - c.top - c.bottom - 6), tilt = 0.3, cx = 0, cy = 76;
    this.v ||= [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const cache = this.fitCache, insetMoving = Math.abs(c.top - prevTop) > 0.35 || Math.abs(c.bottom - prevBottom) > 0.35;
    const needFit = this.fitDirty || !cache || Math.abs(cache.rw - rw) > 1.25 || Math.abs(cache.rh - rh) > 1.25 || insetMoving && (!cache || Math.abs(cache.rh - rh) > 1.25);
    let d, box; cam.clearViewOffset();
    if (needFit) {
      let lo = 120, hi = 1100;
      for (let i = 0; i < 11; i++) { d = (lo + hi) / 2; cam.position.set(cx, cy - Math.sin(tilt) * d, Math.cos(tilt) * d); cam.up.set(0, 1, 0); cam.lookAt(cx, cy, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); box = this.bbox(); if (box.w > rw || box.h > rh) lo = d; else hi = d; }
      d = hi; cam.position.set(cx, cy - Math.sin(tilt) * d, Math.cos(tilt) * d); cam.lookAt(cx, cy, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); box = this.bbox();
      this.fitCache = { rw, rh, d, box }; this.fitDirty = false;
    } else {
      d = cache.d; box = cache.box; cam.position.set(cx, cy - Math.sin(tilt) * d, Math.cos(tilt) * d); cam.up.set(0, 1, 0); cam.lookAt(cx, cy, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    }
    let dx = this.w / 2 - box.cx, dy = c.top + 3 + rh / 2 - box.cy;
    if (this.shake > 0.001 && G.state.settings.shake) { const a = this.shake * this.shake * 9; dx += (Math.random() - 0.5) * a; dy += (Math.random() - 0.5) * a; }
    cam.setViewOffset(this.w, this.h, -dx, -dy, this.w, this.h); cam.updateProjectionMatrix();
  }
  bbox() { const v = this.v, cam = this.camera; v[0].set(-53, 1, 0); v[1].set(53, 1, 0); v[2].set(-53, 152, 0); v[3].set(53, 152, 0); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of v) { p.project(cam); const sx = (p.x + 1) / 2 * this.w, sy = (1 - p.y) / 2 * this.h; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); } return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; }
  /** Canvas pixel → world point on the z=0 plane. */
  screenToWorld(px, py) { const THREE = window.THREE, cam = this.camera; this.ray ||= new THREE.Vector3(); const v = this.ray.set((px / this.w) * 2 - 1, -(py / this.h) * 2 + 1, 0.5).unproject(cam).sub(cam.position); const t = -cam.position.z / v.z; return { x: cam.position.x + v.x * t, y: cam.position.y + v.y * t }; }
  worldToScreen(x, y, out) { this.pv ||= new window.THREE.Vector3(); const p = this.pv.set(x, y, 0).project(this.camera); out[0] = (p.x + 1) / 2 * this.w; out[1] = (1 - p.y) / 2 * this.h; return out; }

  // ------------------------------------------------------------------ fx queue
  drain(w) {
    const P = this.parts, q = w.fx, dmgNum = G.state.settings.dmgNumbers;
    for (let i = 0; i < q.length; i++) { const e = q[i];
      switch (e.k) {
        case 'sfx': playSfx(e.a, e.b); break;
        case 'text': if (e.e > 0 || dmgNum) this.addText(e.a, e.b, e.c, e.d, e.e || 0); break;
        case 'boom': { const c = rgb(e.d ?? 0xffb547); this.trans.add({ k: 'ring', x: e.a, y: e.b, r: e.c, c, t: 0, life: 0.35 }); this.trans.add({ k: 'flash', x: e.a, y: e.b, r: e.c * 1.3, c, a: 0.9, t: 0, life: 0.28 }); P.burst(e.a, e.b, 6 + e.c * 0.8, c, 18 + e.c * 2.2, 2.2, 0.5); break; }
        case 'hit': P.burst(e.a, e.b, 3, rgb(e.c ?? 0xffffff), 26, 1.5, 0.22); break;
        case 'die': { const c = rgb(e.d ?? 0xffffff), tier = e.e || 0; P.burst(e.a, e.b, 10 + e.c * 2 + tier * 30, c, 30 + e.c * 3 + tier * 25, 2.2 + tier, 0.55 + tier * 0.5); P.burst(e.a, e.b, 4 + tier * 10, WHITE, 16, 1.6, 0.35); this.trans.add({ k: 'flash', x: e.a, y: e.b, r: e.c * (2.2 + tier * 2), c, a: 1, t: 0, life: 0.25 + tier * 0.3 }); if (tier) { this.trans.add({ k: 'ring', x: e.a, y: e.b, r: e.c * (2 + tier * 2), c, t: 0, life: 0.6 }); this.trans.add({ k: 'ring', x: e.a, y: e.b, r: e.c * (4 + tier * 3), c: WHITE, t: 0, life: 0.9 }); } break; }
        case 'ore': { const c = rgb(e.d ?? 0x9aa3ad), n = 4; for (let j = 0; j < n; j++) { const a = Math.random() * Math.PI * 0.9 + Math.PI * 0.05, sp = 14 + Math.random() * 20; this.trans.add({ k: 'ore', x: e.a + (Math.random() - .5) * e.c, y: e.b, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 8, rot: Math.random() * 6.28, vr: (Math.random() - .5) * 10, size: 2.4 + Math.random() * 1.8, c, t: 0, life: .65 + Math.random() * .35 }); } P.burst(e.a, e.b, 5, c, 18, 1.4, .35); break; }
        case 'salvageDrop': if (this.salvageDrops.length < 16) this.salvageDrops.push({ x: e.a, y: e.b, amount: e.c, vx: (Math.random() - .5) * 16, vy: 9 + Math.random() * 8, t: 0, rot: Math.random() * 6.28 }); else this.addText(e.a, e.b, e.c, '#b9c4d6', 2); break;
        case 'naniteRepair': this.repairBeamT = 0.3; P.burst(e.a + 1, e.b + 1, 3, REPAIR, 7, 1.1, .3); break;
        case 'shake': this.shake = Math.min(1.4, Math.max(this.shake, e.a)); break;
        case 'beam': this.trans.add({ k: 'beam', x1: e.a, y1: e.b, x2: e.c, y2: e.d, c: rgb(e.e ?? 0xffffff), w: e.f || 2, t: 0, life: e.g || 0.18 }); break;
        case 'arc': this.trans.add({ k: 'arc', pts: jagged(e.a, e.b, e.c, e.d), c: rgb(e.e ?? 0xb69cff), t: 0, life: 0.13 }); break;
        case 'trail': P.emit(e.a, e.b, (Math.random() - 0.5) * 4, -6 - Math.random() * 6, 0.35, 1.8, rgb(e.c ?? 0xffb547), 0.5); break;
        case 'shieldhit': this.trans.add({ k: 'ring', x: e.a, y: e.b, r: 6, c: CYAN, t: 0, life: 0.3 }); P.burst(e.a, e.b, 6, CYAN, 22, 1.6, 0.3); break;
        case 'hurt': P.burst(e.a, e.b, 14, RED, 34, 2.2, 0.5); this.trans.add({ k: 'flash', x: e.a, y: e.b, r: 12, c: RED, a: 0.8, t: 0, life: 0.3 }); bus.emit('fx', e); break;
        case 'paint': this.trans.add({ k: 'ring', x: e.a, y: e.b, r: (e.c || 4) * 2.2, c: AMBER, t: 0, life: 0.3 }); bus.emit('fx', e); break;
        default: bus.emit('fx', e);
      }
    }
    q.length = 0;
  }
  addText(x, y, v, color, size) { if (v == null || v === 'null' || v === 'undefined') return; const T = this.texts; if (T.length >= 70) { if (!size) return; T.shift(); } T.push({ x: x + (Math.random() - 0.5) * (size ? 0 : 4), y, s: v instanceof Big ? (size === 2 ? '+' : '') + fmt(v) : String(v), c: css(color ?? 0xffffff), size, t: 0, life: size ? 1.5 : 0.7 }); }

  // ------------------------------------------------------------------ frame
  render(dt, w, speedMul = 1) {
    const st = G.state, t0 = performance.now(); if (!w) return;
    if (this.supportWorld !== w) { this.supportWorld = w; this.salvageDrops.length = 0; this.salvageCraft = null; this.repairCraft = null; this.repairBeamT = 0; }
    this.fitCamera(dt); if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2);
    const secIdx = w.base.sectorIdx % 6; if (secIdx !== this.lastSector) { this.bg.setSector(secIdx, this.lastSector < 0); this.lastSector = secIdx; this.rails.material.color.set(this.bg.target.mistCol); }
    this.bg.update(dt, speedMul); this.drain(w);
    const fdt = dt * Math.min(3, speedMul); this.parts.update(fdt); this.trans.update(fdt);
    const B = this.B; for (const k in B) B[k].begin();
    this.drawEnemies(w); this.drawPlayer(w, dt); this.drawShots(w); this.drawHazards(w); this.drawBarriers(w); this.drawDrones(w); this.drawSupportCraft(w, fdt);
    this.trans.draw(B); this.parts.draw(B.soft);
    for (const k in B) B[k].end();
    this.gl.render(this.scene, this.camera);
    this.drawOverlay(w, dt);
    // Adaptive quality uses hysteresis: degrade after sustained slow frames, recover only after a longer stable period.
    const ms = performance.now() - t0; this.frameMs += (ms - this.frameMs) * 0.05;
    if (st.settings.quality === 'auto') {
      if (!this.autoLow) { this.highT = 0; this.lowT = dt > 0.03 ? this.lowT + dt : Math.max(0, this.lowT - dt * 0.5); if (this.lowT > 4) { this.autoLow = true; this.lowT = 0; this.setQuality(); } }
      else { this.lowT = 0; this.highT = dt < 0.022 ? this.highT + dt : Math.max(0, this.highT - dt * 2); if (this.highT > 12) { this.autoLow = false; this.highT = 0; this.setQuality(); } }
    } else { this.lowT = 0; this.highT = 0; }
  }

  drawEnemies(w) {
    const d = this.dummy, B = this.B, t = w.t; for (const k in this.meshes) this.meshes[k].count = 0;
    for (let i = 0; i < w.enemies.length; i++) { const e = w.enemies[i]; if (!e.alive) continue;
      const shape = e.def.shape || 'scout', m = this.meshFor(shape), n = m.count; if (n >= m.instanceMatrix.count) continue;
      const big = !!e.boss, wob = big ? 0.06 : 0.22; d.position.set(e.x, e.y, 0); d.rotation.set(Math.sin(t * 1.3 + e.id) * wob * 0.6, Math.sin(t * 1.7 + e.id * 1.7) * wob + (e.vx ? Math.max(-0.5, Math.min(0.5, e.vx * 0.012)) : 0), e.rot || 0);
      if (shape === 'miniF' || shape === 'bossOracle' || shape === 'bossSing' || shape === 'aegis' || shape === 'bossBastion') d.rotation.z += t * (big ? 0.35 : 0.9);
      if (e.def.cruiser) d.rotation.z = e.vx < 0 ? Math.PI : 0;
      const pulse = e.state === 'dive' ? 1.1 : 1; d.scale.setScalar(e.r * 0.92 * pulse); d.updateMatrix(); m.setMatrixAt(n, d.matrix);
      const c = rgb(e.color ?? e.def.color ?? 0xffffff); let r = c[0], g = c[1], b = c[2], mul = 1;
      if (e.elite) { const ec = rgb(e.elite.color), k = 0.45 + 0.35 * Math.sin(t * 6 + e.id); r += (ec[0] - r) * k; g += (ec[1] - g) * k; b += (ec[2] - b) * k; }
      if (e.cloaked) mul = 0.16; else if (e.invuln && e.boss && !(e.boss.enter > 0)) mul = 0.5; if (e.stunT > 0 || w.stunT > 0) { r = r * 0.5 + 0.2; g = g * 0.5 + 0.4; b = b * 0.5 + 0.5; }
      const f = e.flash > 0 ? Math.min(1, e.flash * 9) : 0; this.col.setRGB((r + f * 1.6) * mul, (g + f * 1.6) * mul, (b + f * 1.6) * mul); m.setColorAt(n, this.col); m.count = n + 1;
      // glow underlay, status halos
      if (!e.cloaked) B.under.add(e.x, e.y, e.r * 4.2, e.r * 4.2, 0, c, big ? 0.34 : 0.22);
      if (e.elite) B.ring.add(e.x, e.y, e.r * 3.4, e.r * 3.4, t * 1.5, rgb(e.elite.color), 0.8);
      if (e.shielded) B.ring.add(e.x, e.y, e.r * 3, e.r * 3, 0, CYAN, 0.55 + 0.2 * Math.sin(t * 5));
      if (e.buffed) B.soft.add(e.x, e.y + e.r, 2.5, 2.5, 0, GOLD, 0.9);
      if (e.burnT > 0) B.soft.add(e.x + Math.sin(t * 20 + e.id) * e.r * 0.4, e.y + e.r * 0.3, e.r * 1.6, e.r * 2.2, 0, AMBER, 0.6);
      if (e.def.aura && !e.cloaked) { const ar = e.def.aura.radius * 2; B.ring.add(e.x, e.y, ar * 1.15, ar * 1.15, -t * 0.3, c, 0.1); }
      if (e.weak) { const wx = e.x + e.weak.x, wy = e.y - e.r * 0.55; if (e.weakOpen) { const s = e.weak.r * 2.6 * (1 + 0.15 * Math.sin(t * 12)); B.soft.add(wx, wy, s * 1.6, s * 1.6, 0, AMBER, 1.2); B.reticle.add(wx, wy, s * 1.5, s * 1.5, t * 2, WHITE, 1); } else B.soft.add(wx, wy, e.weak.r * 1.4, e.weak.r * 1.4, 0, RED, 0.35); }
      if (e.boss?.enraged) B.soft.add(e.x, e.y, e.r * 5, e.r * 5, 0, RED, 0.25 + 0.15 * Math.sin(t * 9));
      if (e.mined) B.ring.add(e.x, e.y, e.r * 3.1, e.r * 3.1, t * 0.7, rgb(0xffca65), 0.75);
      if (e.droneMarkT > 0 && e !== w.painted) B.reticle.add(e.x, e.y, e.r * 3.5, e.r * 3.5, t * 2, rgb(0xf077b5), 0.9);
      if (e === w.painted) B.reticle.add(e.x, e.y, e.r * 3.6, e.r * 3.6, -t * 3, AMBER, 1);
      if (e.def.projectile && Math.random() < 0.5) this.parts.emit(e.x, e.y + e.r, 0, 8, 0.3, 1.6, AMBER, 1);
    }
    for (const k in this.meshes) { const m = this.meshes[k]; if (m.count) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; } }
  }

  drawPlayer(w, dt) {
    const p = w.player, g = this.player, B = this.B, t = w.t; g.visible = p.alive; if (!p.alive) return;
    if (this.lookV !== G.sheet.version) { this.lookV = G.sheet.version; this.refreshPlayerLook(); }
    g.position.set(p.x, p.y, 0); g.rotation.set(0, -p.tilt * 0.6, -p.tilt * 0.12);
    const blink = p.invuln > 0 && Math.sin(t * 40) > 0; g.visible = !blink;
    const over = w.abil.active.overdrive > 0, glow = over ? AMBER : CYAN;
    B.under.add(p.x, p.y, 15, 15, 0, glow, 0.17 + (p.fireFlash > 0 ? 0.2 : 0));
    // Exhaust follows the actual nozzle transforms, including banking and progression scale.
    this.nozzle ||= new window.THREE.Vector3(); g.updateMatrixWorld(true);
    const flicker = 1 + .12 * Math.sin(t * 37) + .07 * Math.sin(t * 61);
    for (const side of [-1, 1]) {
      const n = this.nozzle.set(side * .62, -1.17, 0).applyMatrix4(g.matrixWorld);
      const length = (over ? 8.6 : 5.3) * flicker;
      B.soft.add(n.x, n.y - length * .34, 2.1, length, -p.tilt * .12, glow, .85);
      B.soft.add(n.x, n.y - .7, .85, 2.5, -p.tilt * .12, WHITE, .95);
    }
    if (p.fireFlash > 0) B.soft.add(p.x, p.y + 5.5, 5, 5, 0, WHITE, p.fireFlash * 8);
    if (w.base.hasShield && p.shield > 0.02) B.ring.add(p.x, p.y, 15, 15, t, CYAN, 0.25 + p.shield * 0.5);
    if (w.abil.active.aegis > 0) { B.ring.add(p.x, p.y, 19, 19, -t * 2, WHITE, 1); B.soft.add(p.x, p.y, 22, 22, 0, rgb(0x7aa2ff), 0.6); }
    if (p.focus > 0.05) B.ring.add(p.x, p.y, 10 + p.focus * 6, 10 + p.focus * 6, -t * 1.4, AMBER, p.focus * 0.9);
    if (w.chargeShots > 0) B.soft.add(p.x, p.y + 4, 8, 8, 0, rgb(0xffe066), 0.8 + 0.4 * Math.sin(t * 20));
    if (w.slowT > 0) B.under.add(0, 80, 260, 260, 0, VIOLET, 0.12);
  }

  drawShots(w) {
    const B = this.B;
    for (let i = 0; i < w.shots.length; i++) { const s = w.shots[i]; if (!s.alive) continue; const c = rgb(s.c.color ?? 0xffffff), ang = Math.atan2(s.vy, s.vx), r = s.r;
      if (s.kind === 'bolt') { B.streak.add(s.x, s.y, r * (s.big ? 7 : 5), r * 2.2, ang, c, 1.3); B.streak.add(s.x, s.y, r * 3, r * 0.9, ang, WHITE, 1); }
      else if (s.kind === 'missile') { B.streak.add(s.x, s.y, r * 3.4, r * 1.8, ang, WHITE, 1); B.soft.add(s.x - Math.cos(ang) * r * 1.6, s.y - Math.sin(ang) * r * 1.6, r * 3, r * 3, 0, c, 1.2); if (Math.random() < 0.6) this.parts.emit(s.x, s.y, -s.vx * 0.1, -s.vy * 0.1, 0.3, 1.5, c, 2); }
      else if (s.kind === 'mine') { const k = 1 + 0.25 * Math.sin(w.t * 8 + i); B.soft.add(s.x, s.y, r * 3.2 * k, r * 3.2 * k, 0, c, 1); B.ring.add(s.x, s.y, r * 2.6, r * 2.6, w.t, c, 0.8); }
      else { B.soft.add(s.x, s.y, r * 4.5, r * 4.5, 0, c, 1.1); B.soft.add(s.x, s.y, r * 2, r * 2, 0, WHITE, 1); }
    }
    for (let i = 0; i < w.ebullets.length; i++) { const b = w.ebullets[i]; if (!b.alive) continue; const c = BULLET_COL[b.kind] || RED, r = b.r;
      if (b.kind === 'snipe') { B.streak.add(b.x, b.y, r * 9, r * 2, Math.atan2(b.vy, b.vx), RED, 1.5); B.streak.add(b.x, b.y, r * 5, r, Math.atan2(b.vy, b.vx), WHITE, 1); }
      else { B.soft.add(b.x, b.y, r * 5, r * 5, 0, c, 1.15); B.soft.add(b.x, b.y, r * 2.1, r * 2.1, 0, WHITE, 1.2); }
    }
  }

  drawHazards(w) {
    const B = this.B, t = w.t;
    for (const h of w.hazards) {
      if (h.kind === 'snipe') { const k = Math.min(1, h.t / h.telegraph), a = Math.atan2(h.ty - h.y, h.tx - h.x), sx = h.src?.x ?? h.x, sy = h.src?.y ?? h.y; B.streak.line(sx, sy, sx + Math.cos(a) * 200, sy + Math.sin(a) * 200, 0.6 + k * 1.2, RED, 0.25 + k * 0.7); }
      else if (h.kind === 'beam') { const live = h.t >= h.telegraph, y0 = h.src ? h.src.y : h.y; if (!live) { const k = h.t / h.telegraph; B.streak.line(h.x, y0, h.x, -10, 1 + k * 2, RED, 0.2 + 0.5 * k * (0.6 + 0.4 * Math.sin(t * 30))); B.soft.add(h.x, y0 - 3, 4 + k * 8, 4 + k * 8, 0, RED, k); } else { B.streak.line(h.x, y0, h.x, -10, h.width * 2.4, rgb(0xff3df0), 1.2); B.streak.line(h.x, y0, h.x, -10, h.width * 0.9, WHITE, 1.2); B.soft.add(h.x, FIELD.PLAYER_Y - 4, h.width * 3, 8, 0, rgb(0xff3df0), 1); } }
      else if (h.kind === 'shell') { const k = Math.min(1, Math.max(0, h.t / h.telegraph)); if (h.t >= 0) { B.ring.add(h.x, h.y, h.r * 2.3, h.r * 2.3, 0, RED, 0.35 + 0.4 * k); B.ring.add(h.x, h.y, h.r * 2.3 * k, h.r * 2.3 * k, 0, AMBER, 0.9); B.soft.add(h.x, h.y + (1 - k) * 120, 4, 7, 0, AMBER, 1.2); } }
      else if (h.kind === 'well') { B.dark.add(h.x, h.y, 16, 16, 0, WHITE, 1); B.ring.add(h.x, h.y, 14 + 3 * Math.sin(t * 6), 14 + 3 * Math.sin(t * 6), t * 3, VIOLET, 0.9); B.streak.line(h.x, h.y, h.x, 160, 2, VIOLET, 0.25); }
      else if (h.kind === 'pool') { const k = 1 - h.t / h.dur; B.soft.add(h.x, h.y, h.r * 2.6, h.r * 2.6, 0, rgb(h.src.color ?? 0x6dff8e), 0.35 * k + 0.1 * Math.sin(t * 12)); }
      else if (h.kind === 'hole') { const k = Math.min(1, h.t * 3) * Math.min(1, (h.dur - h.t) * 3), s = 18 * k; B.dark.add(h.x, h.y, s * 1.5, s * 1.5, 0, WHITE, 1); B.ring.add(h.x, h.y, s * 1.6, s * 1.6, -t * 5, VIOLET, 1); B.soft.add(h.x, h.y, s * 3.5, s * 3.5, 0, VIOLET, 0.35); if (Math.random() < 0.7) { const a = Math.random() * 6.28, d = 25 + Math.random() * 20; this.parts.emit(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, -Math.cos(a) * 45, -Math.sin(a) * 45, 0.5, 1.6, VIOLET, 0); } }
    }
  }

  drawBarriers(w) {
    const m = this.barrierMesh, d = this.dummy; let n = 0; const acc = this.bg.accent || CYAN;
    for (const b of w.barriers) { if (b.hp <= 0) continue; const blocks = Math.ceil(b.hp * 10 - 1e-6), f = b.flash > 0 ? 1.2 : 0;
      for (let k = 0; k < blocks && n < 40; k++) { const col = k % 5, row = k >= 5 ? 1 : 0, idx = [2, 1, 3, 0, 4][col]; d.position.set(b.x + (idx - 2) * 2.6, FIELD.BARRIER_Y - 1 + row * 2.1, 0); d.rotation.set(0, 0, 0); d.scale.set(2.4, 1.9, 2); d.updateMatrix(); m.setMatrixAt(n, d.matrix); this.col.setRGB(acc[0] * 0.8 + f, acc[1] * 0.8 + f, acc[2] * 0.8 + f); m.setColorAt(n, this.col); n++; }
      this.B.under.add(b.x, FIELD.BARRIER_Y, 22, 9, 0, acc, 0.12 + b.hp * 0.12);
    }
    m.count = n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  }
  drawDrones(w) {
    const m = this.droneMesh, d = this.dummy; let n = 0;
    for (const dr of w.drones) { if (n >= 28) break; const c = rgb(DRONES[dr.type]?.color ?? 0x5ee6ff); d.position.set(dr.x, dr.y, 0); d.rotation.set(0, Math.sin(w.t * 3 + n) * 0.5, 0); d.scale.setScalar(dr.temp ? 1.3 : 1.7); d.updateMatrix(); m.setMatrixAt(n, d.matrix); const f = dr.flash > 0 ? 1 : 0; this.col.setRGB(c[0] + f, c[1] + f, c[2] + f); m.setColorAt(n, this.col); n++;
      this.B.soft.add(dr.x, dr.y - 1.4, 2.2, 3, 0, c, 0.9); if (dr.type === 'shield' && dr.ready !== false) this.B.ring.add(dr.x, dr.y, 5, 5, 0, c, 0.35); }
    m.count = n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  }

  // Service craft visualize earned Scrap and actual hull repair; their movement never controls rewards.
  drawSupportCraft(w, dt) {
    const p = w.player, B = this.B, m = this.supportMesh, d = this.dummy, up = G.state.run.upgrades;
    let n = 0;
    const move = (craft, tx, ty, speed) => {
      const dx = tx - craft.x, dy = ty - craft.y, dist = Math.hypot(dx, dy);
      if (dist > 0.01) { const step = Math.min(dist, speed * dt); craft.x += dx / dist * step; craft.y += dy / dist * step; craft.angle = Math.atan2(-dx, dy) * Math.min(1, dist / 22); }
      return dist;
    };
    const draw = (craft, color, scale) => {
      d.position.set(craft.x, craft.y, .7); d.rotation.set(0, Math.sin(w.t * 3 + n) * .15, craft.angle || 0); d.scale.setScalar(scale); d.updateMatrix();
      m.setMatrixAt(n, d.matrix); this.col.setRGB(...color); m.setColorAt(n, this.col); n++;
      B.under.add(craft.x, craft.y, 6, 6, 0, color, .18);
      B.soft.add(craft.x, craft.y - 2, 2.5, 3.5, 0, color, .75);
    };
    if (up.scrapc > 0 && p.alive) {
      const craft = this.salvageCraft ||= { x: p.x - 9, y: p.y + 5, angle: 0 };
      for (let i = this.salvageDrops.length - 1; i >= 0; i--) {
        const drop = this.salvageDrops[i]; drop.t += dt; drop.x += drop.vx * dt; drop.y += drop.vy * dt; drop.vy -= 22 * dt;
        if (drop.t > 4 || drop.y < FIELD.LAND_Y - 4) { this.salvageDrops.splice(i, 1); continue; }
        const flicker = 1 + .14 * Math.sin(w.t * 13 + i);
        B.ore.add(drop.x, drop.y, 3.8 * flicker, 3.8 * flicker, drop.rot + drop.t * 2, SCRAP, 1);
        B.soft.add(drop.x, drop.y, 5, 5, 0, SCRAP, .4);
      }
      const target = this.salvageDrops[0], tx = target ? target.x : p.x - 11, ty = target ? target.y : p.y + 6 + Math.sin(w.t * 2.7) * 1.3;
      const dist = move(craft, tx, ty, target ? 115 : 36);
      if (target && dist < 3.4) { this.salvageDrops.shift(); this.parts.burst(target.x, target.y, 9, SCRAP, 15, 1.5, .36); this.trans.add({ k: 'ring', x: target.x, y: target.y, r: 4, c: SCRAP, t: 0, life: .3 }); this.addText(craft.x, craft.y + 3, `+${fmt(target.amount)} SCRAP`, '#dcecff', 1); }
      else if (target && dist < 23) B.streak.line(craft.x, craft.y + 1.3, target.x, target.y, .75, SCRAP, .34);
      draw(craft, SCRAP, 2.05);
    } else this.salvageDrops.length = 0;
    if (up.regen > 0 && p.alive) {
      const craft = this.repairCraft ||= { x: p.x + 8, y: p.y + 7, angle: 0 };
      move(craft, p.x + 10, p.y + 7 + Math.sin(w.t * 2.3 + 1) * 1.2, 42);
      draw(craft, REPAIR, 1.95);
      if (this.repairBeamT > 0) {
        const hx = p.x + 1.5, hy = p.y + 1.6;
        B.streak.line(craft.x, craft.y + 1, hx, hy, 2.1, REPAIR, .9);
        B.streak.line(craft.x, craft.y + 1, hx, hy, .65, WHITE, 1);
        B.soft.add(hx, hy, 6, 6, 0, REPAIR, .8);
        B.ring.add(hx, hy, 5.5, 5.5, w.t * 4, REPAIR, .65);
        this.repairBeamT = Math.max(0, this.repairBeamT - dt);
      }
    } else this.repairBeamT = 0;
    m.count = n; if (n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }

  drawOverlay(w, dt) {
    const g = this.ctx2d, k = this.opr, s = [0, 0]; g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, this.w, this.h);
    const unit = this.unitPx();
    // enemy hull bars (only damaged or special)
    if (G.sheet.f('f.threat') > 0) for (let i = 0; i < w.enemies.length; i++) { const e = w.enemies[i]; if (!e.alive || e.cloaked || e.def.projectile || (e.boss && !e.boss.def.mini && false)) continue; if (e.hp >= 0.999 && !e.elite) continue; if (e.boss) continue;
      this.worldToScreen(e.x, e.y + e.r + 1.6, s); const bw = Math.max(14, e.r * unit * 1.7), bh = 3; g.fillStyle = 'rgba(4,8,20,.75)'; g.fillRect(s[0] - bw / 2 - 1, s[1] - 1, bw + 2, bh + 2); g.fillStyle = e.elite ? css(e.elite.color) : e.part ? '#ffb547' : '#ff4d7a'; g.fillRect(s[0] - bw / 2, s[1], bw * Math.max(0, e.hp), bh);
      const eliteName = e.elite?.name; if (eliteName && eliteName !== 'null' && eliteName !== 'undefined') { g.font = '600 9px "Barlow Semi Condensed",sans-serif'; g.textAlign = 'center'; g.fillStyle = css(e.elite.color); g.fillText(String(eliteName).toUpperCase(), s[0], s[1] - 3); } }
    // floating text
    const T = this.texts; g.textAlign = 'center'; g.lineJoin = 'round';
    for (let i = T.length - 1; i >= 0; i--) { const t = T[i]; t.t += dt; if (t.t >= t.life) { T.splice(i, 1); continue; } const p = t.t / t.life; this.worldToScreen(t.x, t.y + p * (t.size ? 9 : 6), s); const px = t.size === 2 ? 17 : t.size === 1 ? 14 : 11; g.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1; g.font = `700 ${px}px "Chakra Petch",sans-serif`; g.lineWidth = 3; g.strokeStyle = 'rgba(3,6,18,.85)'; g.strokeText(t.s, s[0], s[1]); g.fillStyle = t.c; g.fillText(t.s, s[0], s[1]); }
    g.globalAlpha = 1;
  }
  unitPx() { const a = [0, 0], b = [0, 0]; this.worldToScreen(0, 70, a); this.worldToScreen(10, 70, b); return (b[0] - a[0]) / 10; }
  /** Celebration burst used by UI moments (milestones, rewind). */
  celebrate(x, y, color, n = 60) { const c = rgb(color); this.parts.burst(x, y, n, c, 60, 2.6, 1); this.trans.add({ k: 'ring', x, y, r: 26, c, t: 0, life: 0.7 }); }
}
