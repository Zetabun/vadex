// The opening: the station in its golden age above Earth, the invader fleet arriving, the station torn apart, and the
// pilot's lone ship among the wreckage. About twenty seconds, played once (and from Settings). The UI layer shows the
// captions and the whiteout; this draws the scene and reports its beats through onBeat(name).
import { Station } from '@last-orbit/rendering/station.js';
import { earthMaterial } from '@last-orbit/rendering/background.js';
import { shapeGeometry, playerParts, NOZZLES } from '@last-orbit/rendering/geometry.js';
import { WORKSHOP } from '@last-orbit/data/workshop.js';
import { playSfx, rumble } from '@last-orbit/audio/audio.js';
const T = () => window.THREE;

export const INTRO_LEN = 21.5;
// When things happen (seconds): a long look at the station, the fleet arriving, the build to the blast, a slow aftermath.
export const WARP = 6.2, FIRE = 7.9, BLOW = 9.8, CORE = 11.3, AFTER = 13.4;
const lerp = (a, b, k) => a + (b - a) * k, ease = (k) => k * k * (3 - 2 * k), clamp = (k) => Math.max(0, Math.min(1, k));

export function glowTex(inner, mid) {
  const THREE = T(), c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, inner); gr.addColorStop(0.55, mid); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** The shared backdrop of the cinematics: sunlight, Earth below with its atmosphere, and the stars. */
export function backdrop(S) {
  const THREE = T();
  S.add(new THREE.HemisphereLight(0xcfe0ff, 0x10121e, 0.6)); const sun = new THREE.DirectionalLight(0xfff4e0, 1.1); sun.position.set(-60, 50, 40); S.add(sun);
  const sunDir = new THREE.Vector3(-0.6, 0.5, 0.4).normalize();
  // Earth below, stars behind
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1300, 96, 64), earthMaterial()); earth.position.set(0, -1390, -300); earth.rotation.x = 1.15; S.add(earth);
  earth.material.uniforms.night.value = 0;
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1325, 64, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN, vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vN, vV; void main(){ float k = pow(1. - abs(dot(vN, vV)), 3.5); gl_FragColor = vec4(vec3(.3, .6, 1.) * k * 1.4, k); }' })); atmo.position.copy(earth.position); S.add(atmo);
  const n = 1400, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); pos.set([Math.cos(a) * r * 5000, u * 5000, Math.sin(a) * r * 5000], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); S.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false })));
  return { earth, sunDir };
}

export class IntroScene {
  constructor(shipId = 'vanguard') {
    const THREE = T(); this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(50, 1, 0.5, 7000); this.t = 0; this.fired = {}; this.onBeat = null;
    const S = this.scene; ({ earth: this.earth, sunDir: this.sunDir } = backdrop(S));
    // the station at its height: every module built and lit, every core piece in place
    this.station = new Station(S); this.station.group.visible = true;
    this.station.sync({ prestige: { level: 10 }, workshop: Object.fromEntries(WORKSHOP.map((u) => [u.id, u.max])) });
    // the invader fleet: a mothership and escorts, waiting out of sight
    const foeMat = (c) => new THREE.MeshPhongMaterial({ color: new THREE.Color(c).lerp(new THREE.Color(0x14121e), 0.45), emissive: new THREE.Color(c).multiplyScalar(0.12), specular: 0x554466, shininess: 40 });
    this.eyeTex = glowTex('rgba(255,140,150,.95)', 'rgba(255,30,60,.55)'); this.warpTex = glowTex('rgba(200,240,255,.95)', 'rgba(90,170,255,.5)');
    const eye = () => { const e = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.eyeTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); e.visible = false; S.add(e); return e; };
    this.fleet = [];
    const add = (shape, c, s, home) => { const m = new THREE.Mesh(shapeGeometry(shape), foeMat(c)); m.scale.setScalar(s); m.visible = false; S.add(m); this.fleet.push({ m, s, eyes: shape === 'bossCarrier' ? [eye(), eye()] : [eye()], home: new THREE.Vector3(...home), from: new THREE.Vector3(home[0] * 6, home[1] * 4 + 160, home[2] - 900), delay: Math.random() * 1.1 }); };
    add('bossCarrier', 0x7a4aa8, 9, [0, 26, -40]);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; add(['scout', 'diver', 'lancer', 'phantom'][i % 4], [0x6fd3ff, 0xffb547, 0xff4d7a, 0xa0a8ff][i % 4], 2.4, [Math.cos(a) * 30, 6 + Math.sin(a * 2) * 9, -10 + Math.sin(a) * 22]); }
    // beams, blasts, debris, the shockwave
    this.beams = []; const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3d6a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const sleeveMat = new THREE.MeshBasicMaterial({ color: 0xff6a8a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 10; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1, 8, 1, true), beamMat), sl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1, 10, 1, true), sleeveMat); b.add(sl); b.visible = false; S.add(b); this.beams.push(b); }
    this.smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(34,30,36,.8)'); gr.addColorStop(0.6, 'rgba(24,22,28,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })(); this.smokes = [];
    this.coreLight = new THREE.PointLight(0xffa050, 0, 220, 1.6); this.coreLight.position.set(0, 1, 0); S.add(this.coreLight);
    this.traffic = [0, 1].map((i) => { const sh = this.station.makeShuttle(); sh.scale.setScalar(0.9); S.add(sh); sh.userData = { r: 15 + i * 7, sp: 0.5 - i * 0.18, ph: i * 2.4, y: -3 + i * 7 }; return sh; });
    this.fireTex = glowTex('rgba(255,236,170,.95)', 'rgba(255,120,40,.55)'); this.sparkTex = glowTex('rgba(255,200,220,.9)', 'rgba(255,60,106,.4)'); this.blasts = [];
    const dbox = new THREE.BoxGeometry(1, 0.18, 0.7); this.debris = new THREE.InstancedMesh(dbox, new THREE.MeshPhongMaterial({ color: 0x3a4152, emissive: 0x120804, specular: 0x556070, shininess: 30 }), 220);
    this.embers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff9a3c }), 90); this.embers.visible = false; S.add(this.embers); this.debris.visible = false; S.add(this.debris); this.dummy = new THREE.Object3D();
    this.bits = Array.from({ length: 220 }, () => { const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.4, Math.random() - 0.5).normalize(); return { p: d.clone().multiplyScalar(2 + Math.random() * 6), v: d.multiplyScalar(6 + Math.random() * 26), r: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(4), s: 0.25 + Math.random() * 0.7 }; });
    this.wave = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 72), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); this.wave.rotation.x = Math.PI / 2 - 0.3; S.add(this.wave);
    // the survivor: the pilot's ship, in the foreground at the end
    const P = playerParts(shipId), ship = new THREE.Group(), M = { hull: 0x718996, deck: 0xe2eced, chassis: 0x152735, cockpit: 0x125875, markings: 0xffb94e, lights: 0x52dcff, engine: 0x52dcff, wings: 0xe2eced, fins: 0x718996, pods: 0x667782 };
    for (const k of Object.keys(M)) if (P[k]) ship.add(new THREE.Mesh(P[k], new THREE.MeshPhongMaterial({ color: M[k], emissive: k === 'lights' || k === 'engine' ? 0x176c83 : 0x0a0f18, shininess: 50 })));
    ship.rotation.x = -Math.PI / 2; this.shipInner = ship; this.ship = new THREE.Group(); this.ship.add(ship); const rim = new THREE.PointLight(0x9fdcff, 2.2, 26, 1.5); rim.position.set(2.5, 3, 4); this.ship.add(rim); this.ship.scale.setScalar(1.9); this.ship.visible = false; S.add(this.ship);
    this.nozzles = NOZZLES[shipId] || NOZZLES.vanguard;
    this.flames = this.nozzles.map((nz) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex('rgba(180,240,255,.95)', 'rgba(60,160,255,.5)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); f.userData.nz = nz; S.add(f); f.visible = false; return f; });
  }
  resize(w, h) { const a = w / Math.max(1, h); this.cam.aspect = a; this.cam.fov = Math.max(50, (2 * Math.atan(Math.tan((23 * Math.PI) / 180) / a) * 180) / Math.PI); this.cam.updateProjectionMatrix(); }
  beat(name, fn) { if (this.fired[name]) return; this.fired[name] = true; fn?.(); this.onBeat?.(name); }
  smoke(pos, size, life) { const THREE = T(), m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.smokeTex, transparent: true, depthWrite: false })); m.position.copy(pos); m.rotation.z = Math.random() * 6; this.scene.add(m); this.smokes.push({ m, t: 0, life, size, spin: (Math.random() - 0.5) * 0.4, drift: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2) }); }
  blast(pos, size, life, tex = this.fireTex) {
    const THREE = T(), m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos); this.scene.add(m); this.blasts.push({ m, t: 0, life, size });
  }
  /** Where a module sits in world space (for blasts along the station). */
  worldOf(obj) { const THREE = T(), v = new THREE.Vector3(); obj.getWorldPosition(v); return v; }
  update(dt) {
    const THREE = T(); this.t += dt; const t = this.t, st = this.station, cam = this.cam;
    // ---- camera: a slow drift round the station, a push-in for the attack, shake in the blast, then back to the ship
    let cp, look;
    if (t < BLOW) { const k = ease(clamp(t / BLOW)); cp = new THREE.Vector3(lerp(34, 16, k), lerp(10, 6, k), lerp(44, 34, k)); look = new THREE.Vector3(0, lerp(1, 3, k), 0); }
    else if (t < AFTER) { cp = new THREE.Vector3(16, 6, 34); look = new THREE.Vector3(0, 3, 0); }
    else { const k = ease(clamp((t - AFTER) / 5.2)); cp = new THREE.Vector3(lerp(16, -6, k), lerp(6, 5, k), lerp(34, 58, k)); look = new THREE.Vector3(lerp(0, -2, k), lerp(3, 0, k), 0); }
    const shake = t > BLOW && t < AFTER + 0.6 ? (t > CORE && t < CORE + 1.2 ? 1.6 : 0.45) * (1 - clamp((t - CORE - 1) / 1.5) * 0.6) : 0;
    cam.position.copy(cp).add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake)); cam.lookAt(look); cam.updateMatrixWorld();
    // ---- the station: turning, lit; after the core blows, what is left drifts apart and goes dark
    st.animate(dt, 0); if (!this.broken) st.body.rotation.set(0.25, t * 0.1, 0); else st.M.hull.emissiveIntensity = Math.random() < 0.08 ? 0.35 : 0.04;
    if (t < CORE) st.group.visible = true;
    for (const sh of this.traffic) { if (!sh.visible) continue; const u = sh.userData, a = t * u.sp + u.ph, x = Math.cos(a) * u.r, z = Math.sin(a) * u.r * 0.7; sh.position.set(x, u.y + Math.sin(a * 1.5) * 1.2, z); sh.lookAt(x - Math.sin(a) * u.r, sh.position.y, z + Math.cos(a) * u.r * 0.7); sh.rotateX(Math.PI / 2); }
    // ---- the fleet warps in (a flash as each arrives), holds and fires; after the blast they warp out again
    for (const [i, f] of this.fleet.entries()) {
      const k = clamp((t - WARP - f.delay) / 1.2), out = clamp((t - AFTER - 3 - f.delay * 1.5) / 0.5);
      f.m.visible = k > 0 && out < 1; for (const e of f.eyes) e.visible = f.m.visible; if (!f.m.visible) continue;
      if (out > 0) { if (!f.gone) { f.gone = true; this.blast(f.m.position.clone(), f.s * 3, 0.45, this.warpTex); } f.m.position.lerp(f.from, out * 0.5); f.m.scale.set(f.s, f.s * (1 + out * 8), f.s); }
      else { f.m.position.lerpVectors(f.from, f.home, 1 - Math.pow(1 - k, 3)); if (this.broken) f.m.position.y += Math.sin(t * 0.8 + i) * 0.4; f.m.scale.set(f.s, f.s * (1 + (1 - k) * 6), f.s); }
      f.m.lookAt(0, 0, 0); f.m.rotateX(-Math.PI / 2);
      if (k >= 0.97 && !f.arrived) { f.arrived = true; this.blast(f.m.position.clone(), f.s * 3.2, 0.5, this.warpTex); }
      // red eyes on the leading edge, facing the camera
      const fwd = new THREE.Vector3(0, -1, 0).applyQuaternion(f.m.quaternion), side = new THREE.Vector3(1, 0, 0).applyQuaternion(f.m.quaternion);
      f.eyes.forEach((e, j) => { e.position.copy(f.m.position).addScaledVector(fwd, f.s * 0.35).addScaledVector(side, f.eyes.length > 1 ? (j ? 1 : -1) * f.s * 0.35 : 0); e.scale.setScalar(f.s * (0.7 + 0.15 * Math.sin(t * 7 + i))); e.quaternion.copy(cam.quaternion); });
      if (t > WARP) this.beat('warp', () => playSfx('teleport', 1));
    }
    const firing = t > FIRE && t < CORE + 0.3, charge = clamp((t - FIRE) / 0.7); this.zap = (this.zap || 0) - dt;
    this.beams.forEach((b, i) => {
      const f = this.fleet[i % this.fleet.length], was = b.visible; b.visible = firing && Math.sin(t * 13 + i * 2.1) > -0.2;
      if (b.visible && !was && (this.zap || 0) <= 0) { this.zap = 0.12 + Math.random() * 0.12; playSfx('laser', 0.55, 0.45 + Math.random() * 0.2); }
      if (!b.visible) return; const to = new THREE.Vector3(Math.sin(i * 4.1) * 8, Math.cos(i * 2.7) * 5, Math.sin(i * 1.3) * 4), from = f.m.position, d = to.clone().sub(from), len = d.length();
      b.position.copy(from).addScaledVector(d, 0.5); b.scale.set(0.3 + 0.7 * charge, len, 0.3 + 0.7 * charge); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      if (Math.random() < dt * 6) this.blast(to, 2 + Math.random() * 2, 0.35, this.sparkTex);
      if (Math.random() < dt * 5) this.blast(from.clone(), f.s * 1.4, 0.18, this.sparkTex); // muzzle flash
    });
    if (t > FIRE) this.beat('fire', () => playSfx('ebeam', 1));
    // ---- chain explosions across the modules, then the core
    if (t > BLOW && t < CORE) { if (Math.random() < dt * (7 + 12 * (t - BLOW) / (CORE - BLOW))) { const kids = st.body.children, c = kids[1 + Math.floor(Math.random() * (kids.length - 1))]; const at = this.worldOf(c); this.blast(at, 5 + Math.random() * 6, 0.9); this.smoke(at, 6 + Math.random() * 5, 2.6); if (Math.random() < 0.4) playSfx('boom', 1); } }
    if (t > BLOW) this.beat('blow', () => playSfx('bossdie', 0.8));
    if (t > CORE) this.beat('core', () => {
      rumble(3.2, 1); this.broken = true; this.debris.visible = true; this.embers.visible = true; this.coreLight.intensity = 7;
      for (let n = 0; n < 7; n++) this.smoke(new THREE.Vector3((Math.random() - 0.5) * 12, 1 + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 10 - 4), 10 + Math.random() * 8, 3.2 + Math.random() * 1.2);
      for (const sh of this.traffic) { this.blast(sh.position.clone(), 5, 0.7); sh.visible = false; } this.blast(new THREE.Vector3(0, 1, 0), 60, 1.6); this.blast(new THREE.Vector3(0, 1, 0), 26, 1.1);
      // every piece flies off on its own heading, tumbling; the hub stays, scorched
      st.body.children.forEach((c, i) => { if (i === 1) return; const d = c.position.clone(); if (d.lengthSq() < 0.01) d.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5); d.normalize(); c.userData.v = d.multiplyScalar(8 + Math.random() * 14); c.userData.w = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(3); });
      for (const k in st.M) { const m = st.M[k]; if (m.color && m.isMeshPhongMaterial) { m.color.multiplyScalar(0.35); if ('emissiveIntensity' in m) m.emissiveIntensity = 0; } }
      st.M.light.color.setRGB(0.15, 0.1, 0.08); st.M.warm.color.setRGB(0.2, 0.1, 0.05);
      for (const f of this.fleet) f.leave = true;
    });
    if (this.broken) {
      for (const c of st.body.children) { const u = c.userData; if (!u.v) continue; c.position.addScaledVector(u.v, dt); u.v.multiplyScalar(1 - dt * 0.35); c.rotation.x += u.w.x * dt; c.rotation.y += u.w.y * dt; c.rotation.z += u.w.z * dt; }
      st.body.rotation.y += dt * 0.02; this.coreLight.intensity *= Math.exp(-dt * 1.8);
      st.M.halo.opacity = Math.max(0, st.M.halo.opacity - dt * 0.6); st.M.scaffold.opacity = 0; /* holograms do not survive the blast */
      if (t > CORE + 0.8 && Math.random() < dt * 3.5) { const hub = this.worldOf(st.body.children[1]); hub.add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3)); this.blast(hub, 1.2 + Math.random() * 1.6, 0.3, this.sparkTex); }
      const d = this.dummy; this.bits.forEach((b, i) => { b.p.addScaledVector(b.v, dt); b.v.multiplyScalar(1 - dt * 0.25); d.position.copy(b.p); d.rotation.set(b.r.x * t, b.r.y * t, b.r.z * t); d.scale.setScalar(b.s); d.updateMatrix(); this.debris.setMatrixAt(i, d.matrix); if (i < 90) { d.scale.setScalar(Math.max(0, 1 - (t - CORE) / 5) * (0.6 + (i % 5) * 0.2)); d.position.copy(b.p).multiplyScalar(0.8); d.updateMatrix(); this.embers.setMatrixAt(i, d.matrix); } }); this.debris.instanceMatrix.needsUpdate = true; this.embers.instanceMatrix.needsUpdate = true;
      const wk = clamp((t - CORE) / 1.4); this.wave.scale.setScalar(4 + wk * 70); this.wave.material.opacity = (1 - wk) * 0.6; this.wave.quaternion.copy(cam.quaternion); /* a ring expanding toward the viewer */
    }
    // ---- aftermath: the pilot's ship slides into the foreground
    if (t > AFTER) {
      const k = ease(clamp((t - AFTER - 0.8) / 4.6)); this.ship.visible = t > AFTER + 0.8; this.ship.position.set(lerp(-14, -3.2, k), lerp(-9, -1.6, k), lerp(72, 47, k)); this.ship.rotation.set(0, 0, Math.sin(t * 1.4) * 0.06);
      this.ship.updateMatrixWorld(true); this.flames.forEach((f) => { f.visible = true; f.position.copy(this.shipInner.localToWorld(new THREE.Vector3(f.userData.nz[0], f.userData.nz[1] - 0.25, 0))); f.scale.setScalar(1.4 + Math.random() * 0.5); f.quaternion.copy(cam.quaternion); });
      this.beat('after');
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) { const s = this.smokes[i]; s.t += dt; const k = s.t / s.life; if (k >= 1) { this.scene.remove(s.m); s.m.material.dispose(); this.smokes.splice(i, 1); continue; } s.m.position.addScaledVector(s.drift, dt); s.m.scale.setScalar(s.size * (0.5 + k * 0.9)); s.m.material.opacity = Math.min(1, k * 6) * (1 - k) * (1 - k) * 0.85; s.m.quaternion.copy(cam.quaternion); s.m.rotateZ(s.spin * t); }
    // ---- blasts: grow and fade, always facing the camera
    for (let i = this.blasts.length - 1; i >= 0; i--) { const b = this.blasts[i]; b.t += dt; const k = b.t / b.life; if (k >= 1) { this.scene.remove(b.m); b.m.material.dispose(); this.blasts.splice(i, 1); continue; } b.m.scale.setScalar(b.size * (0.4 + k * 0.9)); b.m.material.opacity = 1 - k * k; b.m.quaternion.copy(cam.quaternion); }
    // Earth, lit from the sun (the shader wants the light in view space)
    const u = this.earth.material.uniforms; u.time.value = 300 + t; u.sun.value.copy(this.sunDir).transformDirection(cam.matrixWorldInverse);
    if (t > INTRO_LEN) this.beat('end');
  }
  render(gl, dt) { this.update(dt); gl.setClearColor(0x000000, 1); gl.render(this.scene, this.cam); }
}
