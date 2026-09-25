// After an Overhaul: the station as it stands, and the core piece that rank adds, built in front of you. The piece is
// projected first as a flickering hologram outline, then a weld line sweeps across it (sparks along the seam) leaving
// solid hull behind, and its lights come on. The crown that completes the station ends with every window lighting up
// and the camera pulling back to show it whole. The UI layer (ui/intro.js) types the captions; beats: holo, build, lit,
// whole (the crown only), end.
import { Station } from '@last-orbit/rendering/station.js';
import { backdrop, glowTex } from '@last-orbit/rendering/intro.js';
import { pieceAt, CORE_PIECES } from '@last-orbit/data/station.js';
import { playSfx } from '@last-orbit/audio/audio.js';
const T = () => window.THREE;

// When things happen (seconds): the outline appears, the weld line starts, the piece is done, (the crown) the station wakes.
export const HOLO = 1.1, BUILD = 2.5, LIT = 5.6, WHOLE = LIT + 1.6;
const lerp = (a, b, k) => a + (b - a) * k, ease = (k) => k * k * (3 - 2 * k), clamp = (k) => Math.max(0, Math.min(1, k));
// Which way the weld line travels over each piece (in its own frame): a direction, or 'out' for away from the hub, part by part.
const SWEEP = { deck: [0, 1, 0], ring: [1, 0, 0], spire: [0, 1, 0], solar: 'out', ring2: [1, 0, 0], dome: [0, -1, 0], yard: [-1, 0, 0], beacons: 'out', halo: [1, 0, 0], crown: [0, 1, 0] };

export class RebuildScene {
  constructor(state) {
    const THREE = T(), rank = state.prestige?.level || 0; this.rank = rank; this.piece = pieceAt(rank); this.final = rank >= CORE_PIECES;
    this.len = !this.piece ? 3 : this.final ? WHOLE + 6.4 : LIT + 3.8;
    this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(50, 1, 0.5, 7000); this.t = 0; this.fired = {}; this.onBeat = null;
    const S = this.scene; ({ earth: this.earth, sunDir: this.sunDir } = backdrop(S));
    // the pilot's own station: every module they have built (dark until the Workshop is maxed again), the new piece included
    const st = (this.station = new Station(S)); st.group.visible = true; st.sync(state); st.body.rotation.set(0.25, 0.5, 0); st.group.updateMatrixWorld(true);
    this.sparkTex = glowTex('rgba(255,250,230,.95)', 'rgba(120,220,255,.5)'); this.holoTex = glowTex('rgba(200,248,255,.95)', 'rgba(94,230,255,.45)'); this.blasts = []; this.sparkAcc = 0; this.hiss = 0;
    this.weld = new THREE.PointLight(0xcff4ff, 0, 34, 2); S.add(this.weld);
    // The new piece, part by part: a clipped copy of its material (the solid, behind the weld line) and a hologram
    // outline clipped the other way (ahead of it). Extents are measured along the sweep in the part's parent's frame
    // (the body, or a spinning ring), so a ring is built as it turns.
    this.parts = []; let lo = Infinity, hi = -Infinity; const edges = new Map(), sweep = SWEEP[this.piece?.id], c = new THREE.Vector3(), p = new THREE.Vector3();
    for (const root of st.pieces?.[this.piece?.id] || []) root.traverse((o) => {
      if (!o.isMesh) return; o.geometry.computeBoundingBox(); const box = o.geometry.boundingBox.clone().applyMatrix4(o.matrix); box.getCenter(c);
      const d = Array.isArray(sweep) ? new THREE.Vector3(...sweep) : c.lengthSq() > 1 ? c.clone().normalize() : new THREE.Vector3(1, 0, 0);
      let a = Infinity, b = -Infinity; for (let i = 0; i < 8; i++) { const k = p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).dot(d); a = Math.min(a, k); b = Math.max(b, k); }
      lo = Math.min(lo, a); hi = Math.max(hi, b);
      const cut = new THREE.Plane(), keep = new THREE.Plane(), orig = o.material, solid = orig.clone(); solid.clippingPlanes = [cut];
      const holo = new THREE.LineBasicMaterial({ color: 0x7ff0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, clippingPlanes: [keep] });
      let eg = edges.get(o.geometry); if (!eg) edges.set(o.geometry, (eg = new THREE.EdgesGeometry(o.geometry, 10)));
      const line = new THREE.LineSegments(eg, holo); o.add(line); o.material = solid;
      // points on its surface (in the parent's frame), where the weld sparks can land
      const pa = o.geometry.attributes.position, pts = []; for (let i = 0; i < pa.count; i += Math.max(1, Math.floor(pa.count / 240))) pts.push(new THREE.Vector3().fromBufferAttribute(pa, i).applyMatrix4(o.matrix));
      this.parts.push({ o, orig, solid, holo, line, d, a, b, pts, cut, keep });
    });
    this.edgeGeos = [...edges.values()]; this.lo = lo - 0.15; this.hi = hi + 0.15; this.front = this.lo;
    this.roots = st.pieces?.[this.piece?.id] || []; this.pc = new THREE.Vector3(); this.size = 4; this.aim();
    this.wave = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 72), new THREE.MeshBasicMaterial({ color: 0x9ff0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); S.add(this.wave);
  }
  /** Where the new piece is in the world and how big (for the camera and the flash when it lights). */
  aim() {
    const THREE = T(), box = (this._box ||= new THREE.Box3()).makeEmpty(); for (const r of this.roots) box.expandByObject(r);
    if (box.isEmpty()) { this.pc.set(0, 1, 0); this.size = 12; return; }
    box.getCenter(this.pc); this.size = box.getSize(this._v ||= new THREE.Vector3()).length() / 2;
  }
  resize(w, h) { const a = w / Math.max(1, h); this.cam.aspect = a; this.cam.fov = Math.max(50, (2 * Math.atan(Math.tan((23 * Math.PI) / 180) / a) * 180) / Math.PI); this.cam.updateProjectionMatrix(); }
  beat(name, fn) { if (this.fired[name]) return; this.fired[name] = true; fn?.(); this.onBeat?.(name); }
  /** A glow that grows and fades; a spark (v: its velocity) flies off and shrinks instead. */
  blast(pos, size, life, tex, v = null) {
    const THREE = T(), m = new THREE.Mesh(this.quad ||= new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos); this.scene.add(m); this.blasts.push({ m, t: 0, life, size, v });
  }
  /** The piece is done: back to the station's own materials (so its lights pulse with the rest), outlines gone. */
  finishPiece() {
    for (const p of this.parts) { p.o.material = p.orig; p.solid.dispose(); p.o.remove(p.line); p.holo.dispose(); }
    for (const g of this.edgeGeos) g.dispose(); this.parts = []; this.edgeGeos = [];
  }
  update(dt) {
    const THREE = T(); this.t += dt; const t = this.t, st = this.station, cam = this.cam;
    // ---- the station: turning slowly; windows surge when the piece lights (and stay bright once the crown is on)
    st.animate(dt, 0); st.body.rotation.set(0.25, 0.5 + t * 0.03, 0); st.group.updateMatrixWorld(true); this.aim();
    const surge = t > LIT ? Math.exp(-(t - LIT) * 2.2) * 0.9 : 0, whole = this.final && t > WHOLE ? clamp((t - WHOLE) / 0.8) : 0;
    st.M.hull.emissiveIntensity = 0.55 + surge + whole * (0.8 + 0.4 * Math.exp(-(t - WHOLE) * 1.5));
    // ---- camera: wide, then in on the new piece while it is built (kept clear of the rings); the crown ends pulled right back
    // (a piece hung below the hub is seen level and from further off, aimed a little above it, so the rings over it sit
    // mid-frame rather than filling the top)
    const low = this.pc.y < -3, V = (this._V ||= new THREE.Vector3(0.42, low ? 0 : 0.28, 1).normalize()), clear = this.rank >= 9 ? 23 : low && this.rank >= 5 ? 28 : this.rank >= 5 ? 19 : 13;
    let dist = Math.max(13, Math.min(46, this.size * 1.8 + 7)); const reach = this.pc.dot(V); dist = Math.max(dist, -reach + Math.sqrt(Math.max(0, reach * reach - this.pc.lengthSq() + clear * clear)));
    const kIn = ease(clamp(t / (BUILD + 1.4))), kOut = this.final ? ease(clamp((t - WHOLE - 0.3) / 4.5)) : ease(clamp((t - LIT - 0.4) / 4)) * 0.3;
    const near = this.pc.clone().addScaledVector(V, dist), wide = (this._W ||= new THREE.Vector3(30, 12, 52)), far = this.final ? (this._F ||= new THREE.Vector3(10, 11, 74)) : wide;
    const pos = wide.clone().lerp(near, kIn).lerp(far, kOut), look = new THREE.Vector3(0, 1, 0).lerp(this.pc.clone().setY(this.pc.y + (low ? 4.5 : 0)), kIn).lerp(new THREE.Vector3(0, this.final ? 2 : 1, 0), kOut);
    const sway = Math.sin(t * 0.35) * 0.8; cam.position.set(pos.x + sway, pos.y + Math.sin(t * 0.27) * 0.4, pos.z); cam.lookAt(look); cam.updateMatrixWorld();
    if (!this.piece) { if (t > this.len) this.beat('end'); return; }
    // ---- the hologram outline flickers in, then the weld line sweeps across the piece
    if (t > HOLO) this.beat('holo', () => playSfx('charge', 0.5));
    if (t > BUILD) this.beat('build');
    const kb = clamp((t - BUILD) / (LIT - BUILD - 0.25)); this.front = lerp(this.lo, this.hi, kb < 0.5 ? 2 * kb * kb : 1 - Math.pow(-2 * kb + 2, 2) / 2);
    const holoOp = t < HOLO ? 0 : clamp((t - HOLO) / 0.9) * (Math.random() < (t < BUILD ? 0.14 : 0.05) ? 0.3 : 1) * 0.7;
    const live = [];
    for (const p of this.parts) {
      const m = p.o.parent.matrixWorld; p.holo.opacity = holoOp;
      p.cut.normal.copy(p.d).negate(); p.cut.constant = this.front; p.cut.applyMatrix4(m);
      p.keep.normal.copy(p.d); p.keep.constant = -this.front; p.keep.applyMatrix4(m);
      if (this.front > p.a && this.front < p.b) live.push(p);
    }
    // sparks along the seam, and a light that follows them
    if (t > BUILD && t < LIT && live.length) {
      this.sparkAcc += dt * 110; let at = null;
      while (this.sparkAcc >= 1) {
        // a surface point near the seam, nudged toward the camera so the hull does not hide it
        this.sparkAcc--; const p = live[Math.floor(Math.random() * live.length)]; let q = null;
        for (let n = 0; n < 14 && !q; n++) { const v = p.pts[Math.floor(Math.random() * p.pts.length)]; if (Math.abs(v.dot(p.d) - this.front) < 0.45) q = v.clone(); }
        if (!q) continue; q.addScaledVector(p.d, this.front - q.dot(p.d)).applyMatrix4(p.o.parent.matrixWorld); q.lerp(cam.position, 0.02); at = q;
        if (Math.random() < 0.16) this.blast(q, 3 + Math.random() * 1.8, 0.3, this.sparkTex); // a flare at the torch
        else this.blast(q, 0.7 + Math.random() * 0.8, 0.3 + Math.random() * 0.35, this.sparkTex, new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(9));
      }
      if (at) this.weld.position.copy(at); this.weld.intensity = 1.2 + Math.random() * 0.9;
      if ((this.hiss -= dt) <= 0) { this.hiss = 0.14 + Math.random() * 0.2; playSfx('arc', 0.1 + Math.random() * 0.06); }
    } else this.weld.intensity *= Math.exp(-dt * 8);
    // ---- done: the piece takes the station's own materials, a flash, its lights on
    if (t > LIT) this.beat('lit', () => { this.finishPiece(); playSfx('unlock', 0.8); this.blast(this.pc.clone(), this.size * 2.4 + 7, 1.2, this.holoTex); this.blast(this.pc.clone(), this.size + 3, 0.6, this.sparkTex); });
    // ---- the crown: the whole station wakes, a ring of light goes out from the hub
    if (this.final && t > WHOLE) {
      this.beat('whole', () => { playSfx('milestone', 0.8); this.blast(new THREE.Vector3(0, 1, 0), 46, 1.6, this.holoTex); });
      const wk = clamp((t - WHOLE) / 2.2); this.wave.scale.setScalar(3 + wk * 60); this.wave.material.opacity = (1 - wk) * 0.55; this.wave.quaternion.copy(cam.quaternion);
    }
    // ---- blasts and sparks: grow and fade, facing the camera
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i]; b.t += dt; const k = b.t / b.life; if (k >= 1) { this.scene.remove(b.m); b.m.material.dispose(); this.blasts.splice(i, 1); continue; }
      if (b.v) { b.m.position.addScaledVector(b.v, dt); b.v.y -= dt * 6; b.m.scale.setScalar(b.size * (1 - k * 0.7)); } else b.m.scale.setScalar(b.size * (0.4 + k * 0.9));
      b.m.material.opacity = 1 - k * k; b.m.quaternion.copy(cam.quaternion);
    }
    const u = this.earth.material.uniforms; u.time.value = 300 + t; u.sun.value.copy(this.sunDir).transformDirection(cam.matrixWorldInverse);
    if (t > this.len) this.beat('end');
  }
  render(gl, dt) { this.update(dt); gl.localClippingEnabled = true; gl.setClearColor(0x000000, 1); gl.render(this.scene, this.cam); gl.localClippingEnabled = false; }
}
