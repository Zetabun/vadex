// Gunner seat (prototype): man the station's twin cannons in 3D. The turret sits on a mast above the station, which
// lies ahead and below with Earth beyond. Fighters make strafing runs at it, bombers fly in to release torpedoes,
// torpedoes streak at its hull, and a capital ship with three weak points ends it. Drag to aim; the guns fire on their
// own whenever something is in the sights (with a little help and a lead marker for fast targets). The station's hull
// is your life, and what you have built still helps: point defence picks off torpedoes, armour and the shield soften
// hits, a built or maxed weapon battery hits harder. Its own little simulation: nothing here touches the 2D fight.
import { backdrop, glowTex } from '@last-orbit/rendering/intro.js';
import { Station } from '@last-orbit/rendering/station.js';
import { shapeGeometry } from '@last-orbit/rendering/geometry.js';
import { siegeSystems, SIEGE_STARS } from '@last-orbit/data/siege.js';
import { playSfx } from '@last-orbit/audio/audio.js';
const T = () => window.THREE;

const HUB = [0, -26, -45]; // the station's core, ahead and below the turret
const BULLET_SPEED = 520, FIRE_EVERY = 0.11, CONE = 0.09, YAW_MAX = 1.2, PITCH_MIN = -0.75, PITCH_MAX = 0.75;
const KIND = {
  fighter: { hp: 3, r: 5, shape: 'diver', color: 0xffb547, score: 100 },
  bomber: { hp: 16, r: 8, shape: 'artillery', color: 0xff5d6a, score: 300 },
  torpedo: { hp: 1, r: 2.4, score: 50 },
  capital: { hp: Infinity, r: 52, shape: 'bossCarrier', color: 0x8a5ac8, score: 0 },
  weak: { hp: 34, r: 7, score: 400 },
};
export const WAVES = [
  { name: 'Wave 1', fighters: 6 }, { name: 'Wave 2', fighters: 7, bombers: 1 }, { name: 'Wave 3', fighters: 8, bombers: 2 },
  { name: 'Wave 4', fighters: 10, bombers: 3 }, { name: 'Capital ship', fighters: 3, capital: true },
];
const rnd = (a, b) => a + Math.random() * (b - a);

export class GunnerScene {
  constructor() {
    const THREE = T(); this.scene = new THREE.Scene(); const S = this.scene;
    this.cam = new THREE.PerspectiveCamera(70, 1, 0.1, 9000); this.cam.rotation.order = 'YXZ'; S.add(this.cam);
    ({ earth: this.earth, sunDir: this.sunDir } = backdrop(S)); this.keys = {}; this.t = 0;
    this.station = new Station(S); this.station.group.visible = true; this.station.group.position.set(...HUB); this.station.group.rotation.set(0.35, 0.5, 0);
    this.hub = new THREE.Vector3(...HUB);
    this.fireTex = glowTex('rgba(255,236,170,.95)', 'rgba(255,120,40,.55)'); this.sparkTex = glowTex('rgba(255,200,220,.9)', 'rgba(255,60,106,.4)'); this.cyanTex = glowTex('rgba(200,250,255,.95)', 'rgba(94,230,255,.5)');
    // the guns, fixed to the view: a housing, two barrels that kick back as they fire, a flash at each muzzle
    const gun = new THREE.Group(); this.cam.add(gun); const Ph = (o) => new THREE.MeshPhongMaterial(o), metal = Ph({ color: 0x4a5468, specular: 0x8899bb, shininess: 60 }), dark = Ph({ color: 0x1c2230, shininess: 30 });
    const house = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 0.7), dark); house.position.set(0, -0.98, -1.25); gun.add(house); // mostly below the view: the barrels are what shows
    this.barrels = [-1, 1].map((s) => { const b = new THREE.Group(); b.position.set(s * 0.55, -0.44, -1.2); gun.add(b);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.7, 12), dark); tube.rotation.x = Math.PI / 2; tube.position.z = -0.45; b.add(tube);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12), metal); ring.rotation.x = Math.PI / 2; ring.position.z = -1.2; b.add(ring);
      const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: this.cyanTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); flash.position.z = -1.45; flash.visible = false; b.add(flash);
      return { g: b, flash, kick: 0 }; });
    // tracers
    this.bulletMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 7), new THREE.MeshBasicMaterial({ color: 0xb8f4ff }), 260); this.bulletMesh.frustumCulled = false; S.add(this.bulletMesh);
    // enemy laser bolts at the station
    this.beams = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4d6a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; S.add(m); return { m, t: 0 }; });
    this.pdBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.pdBeam.visible = false; S.add(this.pdBeam);
    this.blasts = []; this.v = new THREE.Vector3(); this.d = new THREE.Object3D();
    this.start();
  }
  // ---------------------------------------------------------------- a fresh engagement
  start() {
    for (const e of this.enemies || []) this.drop(e);
    this.enemies = []; this.bullets = []; this.hull = 1; this.shield = 0; this.score = 0; this.kills = 0; this.wave = -1; this.gap = 1.2; this.over = false; this.won = false;
    this.yaw = 0; this.pitch = -0.18; this.fireT = 0; this.side = 0; this.banner = { text: 'Man the guns', t: 2.2 }; this.hitT = 0; this.pdT = 0; this.spawnQ = [];
    this.sys = null; this.running = true;
  }
  sync(state) {
    this.station.sync(state); if (this.sys) return; const s = siegeSystems(state), weapon = s.list.find((x) => x.sys.id === 'w_dmg');
    this.sys = s.on; this.dmg = 1 + (weapon?.state || 0) * 0.25; // a built weapon battery hits a quarter harder, maxed a half
  }
  resize(w, h) { this.w = w; this.h = h; this.cam.aspect = w / Math.max(1, h); this.cam.fov = w < h ? 74 : 58; this.cam.updateProjectionMatrix(); }
  look(dx, dy) { this.yaw = Math.max(-YAW_MAX, Math.min(YAW_MAX, this.yaw - dx * 0.0042)); this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch - dy * 0.0042)); }
  // ---------------------------------------------------------------- enemies
  mesh(kind) {
    const THREE = T(), k = KIND[kind], g = new THREE.Group(); this.scene.add(g);
    if (kind === 'torpedo') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb0b8 })); body.scale.set(1, 1, 2.2); g.add(body);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sparkTex, color: 0xff4d6a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(9); g.add(glow);
    } else if (kind === 'weak') {
      const core = new THREE.Mesh(new THREE.SphereGeometry(k.r * 0.7, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffc857 })); g.add(core);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fireTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(k.r * 4); g.add(glow); g.userData.glow = glow;
    } else {
      const m = new THREE.Mesh(shapeGeometry(k.shape), new THREE.MeshLambertMaterial({ color: k.color, emissive: new THREE.Color(k.color).multiplyScalar(0.18) })); m.scale.setScalar(k.r * (kind === 'capital' ? 0.9 : 0.95)); g.add(m); g.userData.body = m;
      if (kind !== 'capital') { const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.cyanTex, color: kind === 'bomber' ? 0xff9a6a : 0x9ff0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); e.scale.setScalar(k.r * 1.6); g.add(e); g.userData.engine = e; }
    }
    return g;
  }
  spawn(kind, pos, extra = {}) {
    const THREE = T(), e = { kind, k: KIND[kind], hp: KIND[kind].hp, pos: pos.clone(), vel: new THREE.Vector3(), t: 0, g: this.mesh(kind), alive: true, flash: 0, ...extra };
    this.enemies.push(e); return e;
  }
  drop(e) { e.alive = false; this.scene.remove(e.g); e.g.traverse((o) => { o.material?.dispose?.(); }); }
  far(latMax = 0.9) { const THREE = T(), a = rnd(-latMax, latMax), d = rnd(420, 560); return new THREE.Vector3(Math.sin(a) * d, rnd(40, 170), -Math.cos(a) * d); } // near enough that the action starts in seconds
  nextWave() {
    this.wave++; const W = WAVES[this.wave]; if (!W) { this.win(); return; }
    this.banner = { text: W.capital ? 'Capital ship inbound' : W.name, t: 2.4 }; this.shield = this.sys?.w_shield || 0; playSfx(W.capital ? 'bossintro' : 'milestone', 0.6);
    for (let i = 0; i < (W.fighters || 0); i++) this.spawnQ.push({ kind: 'fighter', at: 0.4 + i * 0.9 });
    for (let i = 0; i < (W.bombers || 0); i++) this.spawnQ.push({ kind: 'bomber', at: 3 + i * 4 });
    if (W.capital) this.spawnQ.push({ kind: 'capital', at: 0.5 });
  }
  fighterGoal(e) { const THREE = T(); e.state = 'approach'; e.goal = new THREE.Vector3(rnd(-80, 80), rnd(10, 70), rnd(-300, -230)); }
  addFighter(from) { const e = this.spawn('fighter', from || this.far()); this.fighterGoal(e); e.vel.set(0, 0, 1).multiplyScalar(40); e.shotT = 0; return e; }
  addBomber() { const THREE = T(), p = this.far(0.5); p.y = rnd(40, 120); const e = this.spawn('bomber', p); e.state = 'inbound'; e.goal = new THREE.Vector3(p.x * 0.18, rnd(0, 25), -150); e.vel.set(0, 0, 20); return e; }
  addTorpedo(from) { const THREE = T(), e = this.spawn('torpedo', from), to = this.v.copy(this.hub).add(new THREE.Vector3(rnd(-6, 6), rnd(-3, 5), rnd(-4, 4))); e.vel.subVectors(to, from).normalize().multiplyScalar(38); e.trailT = 0; return e; }
  addCapital() {
    const THREE = T(), e = this.spawn('capital', new THREE.Vector3(0, 160, -900)); e.goal = new THREE.Vector3(0, 60, -330); e.launchT = 4; e.salvoT = 7;
    e.weak = [[-20, 4, 6], [20, 4, 6], [0, -14, 9]].map((o) => this.spawn('weak', e.pos, { off: new THREE.Vector3(...o), host: e })); return e;
  }
  steer(e, goal, speed, turn, dt) { const want = this.v.subVectors(goal, e.pos); const d = want.length(); want.multiplyScalar(speed / Math.max(1e-3, d)); e.vel.lerp(want, Math.min(1, dt * turn)); e.pos.addScaledVector(e.vel, dt); return d; }
  // ---------------------------------------------------------------- the station takes a hit
  hurt(dmg, at) {
    if (this.over) return; if (this.sys?.w_speed && Math.random() < this.sys.w_speed) return;
    dmg /= 1 + (this.sys?.w_hull || 0) + (this.sys?.x_alloy || 0);
    if (this.shield > 0) { const a = Math.min(this.shield, dmg); this.shield -= a; dmg -= a; }
    if (dmg > 0) { this.hull = Math.max(0, this.hull - dmg); this.station.flash = 1; this.shake = 0.4; }
    this.blast(at, 5, 0.4, this.sparkTex);
    if (this.hull <= 0) { this.over = true; this.running = false; this.banner = { text: 'Station lost', t: 99 }; playSfx('bossdie', 0.9); for (let i = 0; i < 8; i++) this.blast(this.v.copy(this.hub).add(new (T().Vector3)(rnd(-18, 18), rnd(-8, 8), rnd(-10, 10))), rnd(12, 26), rnd(0.6, 1.2)); }
  }
  win() { this.won = true; this.over = true; this.running = false; this.banner = { text: 'Station held', t: 99 }; playSfx('milestone', 1); }
  kill(e) {
    e.alive = false; this.score += e.k.score; this.kills++;
    this.blast(e.pos, e.kind === 'bomber' ? 26 : e.kind === 'weak' ? 22 : e.kind === 'torpedo' ? 9 : 16, 0.6); this.blast(e.pos, e.kind === 'bomber' ? 14 : 8, 0.35, this.sparkTex);
    playSfx(e.kind === 'torpedo' ? 'hurt' : 'boom', e.kind === 'bomber' || e.kind === 'weak' ? 0.9 : 0.5); this.drop(e);
    if (e.kind === 'weak' && e.host.weak.every((w) => !w.alive)) e.host.dying = 1.3; // the capital ship goes up in a chain of blasts
  }
  blast(pos, size, life, tex = this.fireTex) {
    const THREE = T(), m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos); this.scene.add(m); this.blasts.push({ m, t: 0, life, size });
  }
  beam(m, a, b) { const THREE = T(), d = this.v.subVectors(b, a), len = d.length(); m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.visible = true; }
  /** Where a target will be when a shot fired now reaches it. */
  lead(e, from) { const d = e.pos.distanceTo(from), t = d / BULLET_SPEED; return this.v.copy(e.pos).addScaledVector(e.vel, t); }
  // ---------------------------------------------------------------- every frame
  update(dt) {
    const THREE = T(), cam = this.cam; this.t += dt; const k = this.keys;
    if (k.l || k.r || k.f || k.b) this.look(((k.r ? 1 : 0) - (k.l ? 1 : 0)) * 380 * dt, ((k.b ? 1 : 0) - (k.f ? 1 : 0)) * 380 * dt); // W/A/S/D or the arrows aim too
    this.shake = Math.max(0, (this.shake || 0) - dt * 1.5); const sh = this.shake * 0.02;
    cam.position.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, 0); cam.rotation.set(this.pitch, this.yaw, 0); cam.updateMatrixWorld();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), origin = cam.position;
    // waves: the next once the sky is clear
    if (this.running) {
      for (let i = this.spawnQ.length - 1; i >= 0; i--) { const q = this.spawnQ[i]; q.at -= dt; if (q.at <= 0) { this.spawnQ.splice(i, 1); if (q.kind === 'fighter') this.addFighter(); else if (q.kind === 'bomber') this.addBomber(); else this.addCapital(); } }
      if (!this.spawnQ.length && !this.enemies.some((e) => e.alive)) { this.gap -= dt; if (this.gap <= 0) { this.gap = 2.6; this.nextWave(); } }
    }
    // enemies
    for (const e of this.enemies) {
      if (!e.alive) continue; e.t += dt; e.flash = Math.max(0, e.flash - dt * 6);
      if (e.kind === 'fighter') {
        if (e.state === 'approach') { if (this.steer(e, e.goal, 80, 1.6, dt) < 30) { e.state = 'run'; e.runGoal = this.v.copy(this.hub).add(new THREE.Vector3(rnd(-10, 10), rnd(-2, 6), rnd(-6, 6))).clone(); e.shots = 3; e.shotT = 0.6; } }
        else if (e.state === 'run') {
          const d = this.steer(e, e.runGoal, 110, 2.4, dt); e.shotT -= dt;
          if (e.shotT <= 0 && e.shots > 0 && d < 230) { e.shots--; e.shotT = 0.45; const bm = this.beams.find((b) => !b.m.visible); const hit = this.v.copy(e.runGoal).add(new THREE.Vector3(rnd(-5, 5), rnd(-3, 3), rnd(-3, 3))).clone(); if (bm) { this.beam(bm.m, e.pos, hit); bm.t = 0.12; } if (Math.random() < 0.65) this.hurt(0.015, hit); playSfx('laser', 0.3, 0.8 + Math.random() * 0.3); }
          if (d < 45) { e.state = 'break'; const s = Math.sign(e.pos.x) || 1; e.goal = new THREE.Vector3(s * rnd(140, 220), rnd(80, 160), rnd(-260, -120)); }
        } else if (this.steer(e, e.goal, 100, 1.4, dt) < 30) this.fighterGoal(e);
      } else if (e.kind === 'bomber') {
        if (e.state === 'inbound') { if (this.steer(e, e.goal, 32, 0.8, dt) < 12) { e.state = 'outbound'; for (let i = 0; i < 3; i++) this.addTorpedo(e.pos.clone().add(new THREE.Vector3((i - 1) * 4, -2, 0))); playSfx('missile', 0.7); e.goal = new THREE.Vector3(e.pos.x * 3 + (Math.sign(e.pos.x) || 1) * 200, 220, -700); } }
        else if (this.steer(e, e.goal, 34, 0.7, dt) < 40) { e.state = 'inbound'; e.goal = new THREE.Vector3(rnd(-60, 60), rnd(0, 25), -150); } // round again for another pass
      } else if (e.kind === 'torpedo') {
        const to = this.v.subVectors(this.hub, e.pos); if (to.length() < 9) { e.alive = false; this.hurt(0.08, e.pos); this.blast(e.pos, 20, 0.7); playSfx('boom', 1); this.drop(e); continue; }
        e.pos.addScaledVector(e.vel, dt); e.trailT -= dt; if (e.trailT <= 0) { e.trailT = 0.05; this.blast(e.pos, 3.5, 0.5, this.sparkTex); }
      } else if (e.kind === 'capital') {
        if (e.dying != null) { e.dying -= dt; e.boomT = (e.boomT || 0) - dt; if (e.boomT <= 0) { e.boomT = 0.12; this.blast(this.v.copy(e.pos).add(new THREE.Vector3(rnd(-30, 30), rnd(-14, 14), rnd(-10, 10))), rnd(20, 50), rnd(0.7, 1.4)); this.shake = 0.3; }
          if (e.dying <= 0) { this.drop(e); playSfx('bossdie', 1); this.score += 2000; } continue; }
        this.steer(e, e.goal, 40, 0.5, dt); e.vel.multiplyScalar(0.98);
        if (e.pos.distanceTo(e.goal) < 40) {
          e.launchT -= dt; if (e.launchT <= 0 && this.enemies.filter((x) => x.alive && x.kind === 'fighter').length < 4) { e.launchT = 7; this.addFighter(e.pos.clone().add(new THREE.Vector3(rnd(-20, 20), -10, 20))); }
          e.salvoT -= dt; if (e.salvoT <= 0) { e.salvoT = 8; for (let i = 0; i < 3; i++) this.addTorpedo(e.pos.clone().add(new THREE.Vector3((i - 1) * 14, -8, 12))); playSfx('missile', 0.9); }
        }
      } else if (e.kind === 'weak') { e.host.g.updateMatrixWorld(); e.pos.copy(e.host.g.localToWorld(e.off.clone())); /* the ship has just been placed and turned this frame */ e.g.userData.glow.material.opacity = 0.6 + 0.4 * Math.sin(this.t * 6 + e.off.x); }
      // face the camera, nose along the way it is moving on screen (the models are drawn to be seen from above)
      e.g.position.copy(e.pos);
      if (e.g.userData.body) {
        e.g.quaternion.copy(cam.quaternion); const a = this.v.copy(e.pos).add(e.vel).project(cam), b = e.pos.clone().project(cam);
        e.g.rotateZ(Math.atan2(a.y - b.y, a.x - b.x) + Math.PI / 2); e.g.rotateX(0.35);
        e.g.userData.body.material.emissive.setScalar(e.flash * 0.8).add(new THREE.Color(e.k.color).multiplyScalar(0.18));
      } else if (e.kind === 'torpedo') e.g.lookAt(this.v.copy(e.pos).add(e.vel));
    }
    // the guns: they fire on their own at whatever is in the sights (aimed at where it will be), barrels in turn
    let target = null, best = CONE;
    for (const e of this.enemies) { if (!e.alive || e.kind === 'capital') continue; const L = this.lead(e, origin), ang = fwd.angleTo(this.v.subVectors(L, origin)); if (ang < best) { best = ang; target = e; } }
    this.locked = target; this.fireT -= dt;
    if (target && this.running && this.fireT <= 0) {
      this.fireT = FIRE_EVERY; const b = this.barrels[this.side = 1 - this.side]; b.kick = 1; b.flash.visible = true; b.flash.rotation.z = Math.random() * 6;
      const muzzle = b.flash.getWorldPosition(new THREE.Vector3()), aim = this.lead(target, muzzle).clone(), dir = aim.sub(muzzle).normalize();
      if (this.bullets.length < 250) this.bullets.push({ p: muzzle, v: dir.multiplyScalar(BULLET_SPEED), life: 2.2 });
      playSfx('cannon', 0.28);
    }
    for (const b of this.barrels) { b.kick = Math.max(0, b.kick - dt * 9); b.g.position.z = -1.2 + b.kick * 0.14; if (b.kick < 0.5) b.flash.visible = false; }
    // tracers fly and hit
    const seg = new THREE.Vector3(); let n = 0; const d = this.d;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const u = this.bullets[i]; u.life -= dt; const step = seg.copy(u.v).multiplyScalar(dt); let hit = null;
      if (u.life > 0) for (const e of this.enemies) { if (!e.alive || e.kind === 'capital') continue; if (segHitsSphere(u.p, step, e.pos, e.k.r)) { hit = e; break; } }
      if (hit || u.life <= 0) { if (hit) { hit.hp -= this.dmg || 1; hit.flash = 1; this.hitT = 0.12; if (hit.hp <= 0) this.kill(hit); else this.blast(u.p, 3, 0.15, this.cyanTex); } this.bullets.splice(i, 1); continue; }
      u.p.add(step); d.position.copy(u.p); d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), seg.copy(u.v).normalize()); d.updateMatrix(); this.bulletMesh.setMatrixAt(n++, d.matrix);
    }
    this.bulletMesh.count = n; this.bulletMesh.instanceMatrix.needsUpdate = true; this.hitT = Math.max(0, this.hitT - dt);
    // point defence: the station picks off the torpedo nearest it now and then
    if (this.sys?.w_crit && this.running) { this.pdT -= dt; if (this.pdT <= 0) { let tor = null, bd = 260; for (const e of this.enemies) if (e.alive && e.kind === 'torpedo') { const dd = e.pos.distanceTo(this.hub); if (dd < bd) { bd = dd; tor = e; } } if (tor) { this.pdT = this.sys.w_crit * 0.6; this.beam(this.pdBeam, this.hub, tor.pos); this.pdBeamT = 0.15; this.kill(tor); } } }
    this.pdBeamT = Math.max(0, (this.pdBeamT || 0) - dt); this.pdBeam.visible = this.pdBeamT > 0;
    for (const b of this.beams) { if (!b.m.visible) continue; b.t -= dt; b.m.material.opacity = Math.max(0, b.t / 0.12); if (b.t <= 0) b.m.visible = false; }
    this.enemies = this.enemies.filter((e) => e.alive);
    for (let i = this.blasts.length - 1; i >= 0; i--) { const b = this.blasts[i]; b.t += dt; const q = b.t / b.life; if (q >= 1) { this.scene.remove(b.m); b.m.material.dispose(); b.m.geometry.dispose(); this.blasts.splice(i, 1); continue; } b.m.scale.setScalar(b.size * (0.4 + q * 0.9)); b.m.material.opacity = 1 - q * q; b.m.quaternion.copy(cam.quaternion); }
    if (this.banner.t < 90) this.banner.t -= dt;
    // the world: Earth turning below, the station breathing
    this.station.animate(dt, 0.2); this.station.body.rotation.y = this.t * 0.05;
    const u2 = this.earth.material.uniforms; u2.time.value = 300 + this.t; u2.sun.value.copy(this.sunDir).transformDirection(cam.matrixWorldInverse);
    this.station.flash = Math.max(0, (this.station.flash || 0) - dt * 2.2); const f = Math.min(1, this.station.flash); this.station.M.hull.emissive.setRGB(1, 0.83 - 0.6 * f, 0.6 - 0.5 * f);
  }
  render(gl, dt) { this.update(dt); gl.setClearColor(0x000000, 1); gl.render(this.scene, this.cam); }
  /** The sights, drawn flat over the view: crosshair, target brackets (with a lead marker for fast ones), arrows at the
   *  edge for bombers and torpedoes out of view, a hit marker, and the wave banner. */
  draw2d(ctx, W, H, pr) {
    ctx.setTransform(pr, 0, 0, pr, 0, 0); const w = W / pr, h = H / pr, cx = w / 2, cy = h / 2, cam = this.cam, THREE = T();
    const toScreen = (p) => { const v = p.clone().project(cam); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, front: v.z < 1 }; };
    const focal = h / (2 * Math.tan((cam.fov * Math.PI) / 360));
    for (const e of this.enemies) {
      if (!e.alive || e.kind === 'capital') continue; const s = toScreen(e.pos), dist = e.pos.distanceTo(cam.position), col = e.kind === 'fighter' ? '#ffb547' : e.kind === 'weak' ? '#ffd27a' : '#ff5d6a';
      const on = s.front && s.x > 0 && s.x < w && s.y > 0 && s.y < h;
      if (!on) { if (e.kind === 'fighter') continue; // an arrow at the edge toward what matters
        let dx = s.x - cx, dy = s.y - cy; if (!s.front) { dx = -dx; dy = -dy; } const m = Math.max(Math.abs(dx) / (cx - 22), Math.abs(dy) / (cy - 22)) || 1, ax = cx + dx / m, ay = cy + dy / m, ang = Math.atan2(dy, dx);
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.fill(); ctx.restore(); continue; }
      const r = Math.max(e.kind === 'torpedo' ? 7 : 10, Math.min(60, (e.k.r / dist) * focal * 1.3)), c = e === this.locked ? '#ffffff' : col;
      ctx.strokeStyle = c; ctx.lineWidth = e === this.locked ? 2.5 : 1.8;
      if (e.kind === 'torpedo') { ctx.beginPath(); ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x + r, s.y); ctx.lineTo(s.x, s.y + r); ctx.lineTo(s.x - r, s.y); ctx.closePath(); ctx.stroke(); }
      else { const q = r * 0.45; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.beginPath(); ctx.moveTo(s.x + sx * r, s.y + sy * (r - q)); ctx.lineTo(s.x + sx * r, s.y + sy * r); ctx.lineTo(s.x + sx * (r - q), s.y + sy * r); ctx.stroke(); } }
      if (e.kind === 'bomber') { ctx.fillStyle = col; ctx.font = '800 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BOMBER', s.x, s.y - r - 6); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(s.x - r, s.y + r + 4, 2 * r, 3); ctx.fillStyle = col; ctx.fillRect(s.x - r, s.y + r + 4, 2 * r * Math.max(0, e.hp / e.k.hp), 3); }
      if (e.kind === 'fighter' || e.kind === 'torpedo') { const L = toScreen(this.lead(e, cam.position)); if (L.front && Math.hypot(L.x - s.x, L.y - s.y) > 6) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(L.x, L.y); ctx.stroke(); ctx.beginPath(); ctx.arc(L.x, L.y, 4, 0, Math.PI * 2); ctx.stroke(); } }
    }
    // crosshair: white when something is in the sights
    const lock = !!this.locked; ctx.strokeStyle = lock ? '#ffffff' : 'rgba(159,240,255,.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.stroke(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(cx + dx * 20, cy + dy * 20); ctx.lineTo(cx + dx * 28, cy + dy * 28); ctx.stroke(); }
    ctx.fillStyle = ctx.strokeStyle; ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    if (this.hitT > 0) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.beginPath(); ctx.moveTo(cx + dx * 8, cy + dy * 8); ctx.lineTo(cx + dx * 14, cy + dy * 14); ctx.stroke(); } }
    if (this.banner.t > 0) { const a = Math.min(1, this.banner.t * 2); ctx.globalAlpha = a; ctx.fillStyle = this.won ? '#6dffc8' : this.over ? '#ff8a9a' : '#ffe2b0'; ctx.font = '800 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(this.banner.text.toUpperCase(), cx, h * 0.3); ctx.globalAlpha = 1; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  status() {
    const stars = this.won ? SIEGE_STARS.filter(([, need]) => this.hull >= need).length : 0;
    return { hull: this.hull, shield: this.shield, wave: Math.max(0, this.wave) + 1, waves: WAVES.length, score: this.score, over: this.over, won: this.won, stars };
  }
}
/** Does a tracer moving from p along step pass within r of c? */
function segHitsSphere(p, step, c, r) {
  const lx = c.x - p.x, ly = c.y - p.y, lz = c.z - p.z, len2 = step.x * step.x + step.y * step.y + step.z * step.z;
  const t = Math.max(0, Math.min(1, (lx * step.x + ly * step.y + lz * step.z) / (len2 || 1)));
  const dx = p.x + step.x * t - c.x, dy = p.y + step.y * t - c.y, dz = p.z + step.z * t - c.z; return dx * dx + dy * dy + dz * dz < r * r;
}
