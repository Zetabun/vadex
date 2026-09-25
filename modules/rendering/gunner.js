// Gunner seat (prototype): man the station's guns in 3D. The turret sits on a mast above the station, which lies ahead
// and below with Earth beyond. Fighters make strafing runs at it, bombers fly in to release torpedoes, torpedoes streak
// at its hull, and a capital ship with three weak points ends it. Drag to aim; the twin cannons fire on their own
// whenever something is in the sights (with a lead marker for fast targets). Hold the sights on a target and the
// missile seeker locks on (beeping faster, then a steady tone): fire, and a homing missile goes for it. Between waves,
// pick one of three turret upgrades (data/turret.js); what the station has built sets the starting kit. The station's
// hull is your life. Its own little simulation: nothing here touches the 2D fight.
import { G } from '@last-orbit/core/game.js';
import { backdrop, glowTex } from '@last-orbit/rendering/intro.js';
import { Station } from '@last-orbit/rendering/station.js';
import { shapeGeometry } from '@last-orbit/rendering/geometry.js';
import { SIEGE_STARS } from '@last-orbit/data/siege.js';
import { turretKit, turretStats, turretOffer, TURRET_MOD } from '@last-orbit/data/turret.js';
import { playSfx, playSample, lockTone, whoosh, explosion } from '@last-orbit/audio/audio.js';
import { haptic } from '@last-orbit/ui/haptics.js';
const T = () => window.THREE;

const HUB = [0, -26, -45]; // the station's core, ahead and below the turret
const YAW_MAX = 1.2, PITCH_MIN = -0.75, PITCH_MAX = 0.75, LOCK_CONE = 0.16, HOLD_CONE = 0.32, MISSILE_SPEED = 230;
const KIND = {
  fighter: { hp: 3, r: 5, shape: 'diver', color: 0xffb547, score: 100 },
  // armour: the share of a cannon round that gets through (missiles ignore it). missile: what the seeker will lock onto.
  bomber: { hp: 16, r: 8, shape: 'artillery', color: 0xff5d6a, score: 300, armour: 0.35, missile: true, label: 'BOMBER' },
  gunship: { hp: 26, r: 9, shape: 'plate', color: 0x9fb0c8, score: 500, armour: 0.3, missile: true, label: 'GUNSHIP' },
  torpedo: { hp: 1, r: 2.4, score: 50 },
  capital: { hp: Infinity, r: 52, shape: 'bossCarrier', color: 0x8a5ac8, score: 0 },
  weak: { hp: 34, r: 7, score: 400, armour: 0.4, missile: true },
};
export const WAVES = [
  { name: 'Wave 1', fighters: 6 }, { name: 'Wave 2', fighters: 7, bombers: 1 }, { name: 'Wave 3', fighters: 8, bombers: 1, gunships: 1 },
  { name: 'Wave 4', fighters: 9, bombers: 2, gunships: 1 }, { name: 'Capital ship', fighters: 3, capital: true },
];
// how much tougher each kind gets per wave (fighters most: bombers and weak points are the missiles' work)
const GROW = { fighter: 0.3, bomber: 0.12, gunship: 0.1, weak: 0.06 };
const rnd = (a, b) => a + Math.random() * (b - a);
const DEBRIS_MAX = 380, PIECES = { fighter: 10, bomber: 18, gunship: 20, torpedo: 4, weak: 12, capital: 44 };

/** A thin bright ring on a clear middle: a missile's shock wave. */
function ringTex() {
  const THREE = T(), c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,200,140,0)'); gr.addColorStop(0.7, 'rgba(255,190,120,0)'); gr.addColorStop(0.86, 'rgba(255,240,210,.85)'); gr.addColorStop(0.94, 'rgba(255,160,80,.3)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

export class GunnerScene {
  constructor() {
    const THREE = T(); this.scene = new THREE.Scene(); const S = this.scene;
    this.cam = new THREE.PerspectiveCamera(70, 1, 0.1, 9000); this.cam.rotation.order = 'YXZ'; S.add(this.cam);
    ({ earth: this.earth, sunDir: this.sunDir } = backdrop(S)); this.keys = {}; this.t = 0;
    this.station = new Station(S); this.station.group.visible = true; this.station.group.position.set(...HUB); this.station.group.rotation.set(0.35, 0.5, 0);
    this.hub = new THREE.Vector3(...HUB);
    this.fireTex = glowTex('rgba(255,236,170,.95)', 'rgba(255,120,40,.55)'); this.sparkTex = glowTex('rgba(255,200,220,.9)', 'rgba(255,60,106,.4)'); this.cyanTex = glowTex('rgba(200,250,255,.95)', 'rgba(94,230,255,.5)');
    this.smokeTex = glowTex('rgba(200,200,210,.55)', 'rgba(120,120,135,.25)'); this.coreTex = glowTex('rgba(255,255,255,1)', 'rgba(255,214,150,.7)'); this.ringTex = ringTex();
    this.boomLight = new THREE.PointLight(0xffb070, 0, 620, 2); S.add(this.boomLight); this.boomT = 0; this.punch = 0; /* a missile hit's flash lights the ships and the station near it */
    // the guns, fixed to the view: two barrels that kick back as they fire, a flash at each muzzle; the missile rack below
    const gun = (this.rig = new THREE.Group()); this.cam.add(gun); /* the guns and rack: they jolt with every round */ const Ph = (o) => new THREE.MeshPhongMaterial(o), metal = Ph({ color: 0x4a5468, specular: 0x8899bb, shininess: 60 }), dark = Ph({ color: 0x1c2230, shininess: 30 });
    const house = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 0.7), dark); house.position.set(0, -0.98, -1.25); gun.add(house); // mostly below the view: the barrels are what shows
    this.barrels = [-1, 1].map((s) => { const b = new THREE.Group(); b.position.set(s * 0.55, -0.44, -1.2); gun.add(b);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.7, 12), dark); tube.rotation.x = Math.PI / 2; tube.position.z = -0.45; b.add(tube);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12), metal); ring.rotation.x = Math.PI / 2; ring.position.z = -1.2; b.add(ring);
      const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: this.cyanTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); flash.position.z = -1.45; flash.visible = false; b.add(flash);
      return { g: b, flash, kick: 0 }; });
    this.rack = new THREE.Object3D(); this.rack.position.set(0.9, -0.9, -1.3); gun.add(this.rack); // where missiles leave from
    // tracers
    this.bulletMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 7), new THREE.MeshBasicMaterial({ color: 0xb8f4ff }), 300); this.bulletMesh.frustumCulled = false; S.add(this.bulletMesh);
    // enemy laser bolts at the station; tesla arcs; point defence
    const beamOf = (color, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; S.add(m); return { m, t: 0 }; };
    this.beams = Array.from({ length: 14 }, () => beamOf(0xff4d6a, 0.18)); this.arcs = Array.from({ length: 8 }, () => beamOf(0x9ff0ff, 0.22));
    this.pdBeam = beamOf(0xffd27a, 0.25).m;
    this.missileGeo = new THREE.CylinderGeometry(0.5, 0.3, 3.2, 8); /* narrow nose forward */ this.missileGeo.rotateX(Math.PI / 2); this.missileMat = Ph({ color: 0xdfe6f0, emissive: 0x222222 });
    // wreckage: every kill breaks into plates and shards that tumble away (one instanced mesh for all of them)
    this.debrisMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), DEBRIS_MAX); this.debrisMesh.frustumCulled = false; this.debrisMesh.count = 0;
    this.debrisMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DEBRIS_MAX * 3), 3); S.add(this.debrisMesh); this.debris = []; this.hot = new THREE.Color(0xffd9a0);
    // embers: small bright bits that fly out fast and burn out, so a kill reads even far away
    this.emberMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), 300); this.emberMesh.frustumCulled = false; this.emberMesh.count = 0;
    this.emberMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(300 * 3), 3); S.add(this.emberMesh); this.embers = [];
    this.blasts = []; this.v = new THREE.Vector3(); this.d = new THREE.Object3D();
    this.start();
  }
  // ---------------------------------------------------------------- a fresh engagement
  start() {
    for (const e of this.enemies || []) this.drop(e); for (const m of this.missiles || []) this.scene.remove(m.g); this.debris = []; this.embers = [];
    this.enemies = []; this.bullets = []; this.missiles = []; this.hull = 1; this.shield = 0; this.score = 0; this.kills = 0; this.wave = -1; this.gap = 1.2; this.over = false; this.won = false;
    this.yaw = 0; this.pitch = -0.18; this.fireT = 0; this.side = 0; this.banner = { text: 'Man the guns', t: 2.2 }; this.hitT = 0; this.pdT = 0; this.sentryT = 0; this.spawnQ = [];
    this.picks = {}; this.pick = null; this.waveLive = false; this.kit = null; this.running = true;
    this.ms = { ammo: 0, reloadT: 0, target: null, lockT: 0, locked: false, beepT: 0, noLock: 0 }; this.gun = { ammo: 0, reloadT: 0 }; this.recoil = 0; this.roll = 0; this.jolt = 0; this.shake = 0;
    if (G.state) this.sync(G.state); lockTone(false);
  }
  sync(state) {
    this.station.sync(state); if (this.kit) return;
    this.kit = turretKit(state); this.st = turretStats(this.kit, this.picks); this.ms.ammo = this.st.missiles; this.gun.ammo = this.st.mag; this.picksDue = this.kit.freePicks; this.rerolls = this.kit.rerolls; this.beacon = this.kit.beacon;
  }
  resize(w, h) { this.w = w; this.h = h; this.cam.aspect = w / Math.max(1, h); this.cam.fov = this.fov0 = w < h ? 74 : 58; this.cam.updateProjectionMatrix(); }
  look(dx, dy) { if (this.pick) return; this.yaw = Math.max(-YAW_MAX, Math.min(YAW_MAX, this.yaw - dx * 0.0042)); this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch - dy * 0.0042)); }
  /** Stop the seeker's tone (leaving the seat). */
  silence() { lockTone(false); }
  // ---------------------------------------------------------------- upgrades between waves
  offerPick() { this.pick = { ids: turretOffer(this.picks) }; if (!this.pick.ids.length) { this.pick = null; return; } this.ms.target = null; this.ms.locked = false; lockTone(false); playSfx('unlock', 0.6); }
  choosePick(i) {
    const id = this.pick?.ids[i]; if (!id) return null; const m = TURRET_MOD[id]; this.picks[id] = (this.picks[id] || 0) + 1;
    const before = this.st.missiles, mag0 = this.st.mag; this.st = turretStats(this.kit, this.picks); this.ms.ammo += Math.max(0, this.st.missiles - before); if (!this.gun.reloadT) this.gun.ammo += Math.max(0, this.st.mag - mag0); m.now?.(this); this.pick = null; this.gap = 0.8; playSfx('buy', 0.8); return m;
  }
  reroll() { if (!this.pick || this.rerolls <= 0) return false; this.rerolls--; this.pick = { ids: turretOffer(this.picks) }; playSfx('tab'); return true; }
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
      if (kind !== 'capital') { const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.cyanTex, color: kind === 'fighter' ? 0x9ff0ff : 0xff9a6a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); e.scale.setScalar(k.r * 1.6); g.add(e); g.userData.engine = e; }
    }
    return g;
  }
  spawn(kind, pos, extra = {}) {
    // the invaders toughen wave by wave, as the guns are upgraded between them
    const THREE = T(), grow = 1 + (GROW[kind] || 0) * Math.max(0, this.wave), e = { kind, k: KIND[kind], hp: KIND[kind].hp * grow, max: KIND[kind].hp * grow, pos: pos.clone(), vel: new THREE.Vector3(), t: 0, g: this.mesh(kind), alive: true, flash: 0, ...extra };
    this.enemies.push(e); return e;
  }
  drop(e) { e.alive = false; this.scene.remove(e.g); e.g.traverse((o) => { o.material?.dispose?.(); }); }
  far(latMax = 0.9) { const THREE = T(), a = rnd(-latMax, latMax), d = rnd(420, 560); return new THREE.Vector3(Math.sin(a) * d, rnd(40, 170), -Math.cos(a) * d); } // near enough that the action starts in seconds
  nextWave() {
    this.wave++; const W = WAVES[this.wave]; if (!W) { this.win(); return; } this.waveLive = true;
    this.gun.ammo = this.st.mag; this.gun.reloadT = 0; this.ms.ammo = this.st.missiles; this.ms.reloadT = 0; // the crew reloads between waves
    this.banner = { text: W.capital ? 'Capital ship inbound' : W.name, t: 2.4 }; this.shield = this.st.shieldMax; playSfx(W.capital ? 'bossintro' : 'milestone', 0.6);
    for (let i = 0; i < (W.fighters || 0); i++) this.spawnQ.push({ kind: 'fighter', at: 0.4 + i * 0.9 });
    for (let i = 0; i < (W.bombers || 0); i++) this.spawnQ.push({ kind: 'bomber', at: 3 + i * 4 });
    for (let i = 0; i < (W.gunships || 0); i++) this.spawnQ.push({ kind: 'gunship', at: 5 + i * 5 });
    if (W.capital) this.spawnQ.push({ kind: 'capital', at: 0.5 });
  }
  /** A wave held: the repair crews patch the hull, and an upgrade is earned (not after the last). */
  waveCleared() { this.waveLive = false; if (this.st.regen) this.hull = Math.min(1, this.hull + this.st.regen); if (this.wave < WAVES.length - 1) this.picksDue++; this.gap = 1.1; }
  fighterGoal(e) { const THREE = T(); e.state = 'approach'; e.goal = new THREE.Vector3(rnd(-80, 80), rnd(10, 70), rnd(-300, -230)); }
  addFighter(from) { const e = this.spawn('fighter', from || this.far()); this.fighterGoal(e); e.vel.set(0, 0, 1).multiplyScalar(40); e.shotT = 0; return e; }
  addBomber() { const THREE = T(), p = this.far(0.5); p.y = rnd(40, 120); const e = this.spawn('bomber', p); e.state = 'inbound'; e.goal = new THREE.Vector3(p.x * 0.18, rnd(0, 25), -150); e.vel.set(0, 0, 20); return e; }
  /** A gunship takes a station off to one side and shells the station from there, sliding back and forth. */
  addGunship() { const THREE = T(), side = Math.random() < 0.5 ? -1 : 1, e = this.spawn('gunship', this.far(0.6)); e.home = new THREE.Vector3(side * rnd(70, 130), rnd(35, 85), rnd(-290, -240)); e.shotT = 3; e.vel.set(0, 0, 20); return e; }
  addTorpedo(from) { const THREE = T(), e = this.spawn('torpedo', from), to = this.v.copy(this.hub).add(new THREE.Vector3(rnd(-6, 6), rnd(-3, 5), rnd(-4, 4))); e.vel.subVectors(to, from).normalize().multiplyScalar(38); e.trailT = 0; return e; }
  addCapital() {
    const THREE = T(), e = this.spawn('capital', new THREE.Vector3(0, 160, -900)); e.goal = new THREE.Vector3(0, 60, -330); e.launchT = 4; e.salvoT = 7;
    e.weak = [[-20, 4, 6], [20, 4, 6], [0, -14, 9]].map((o) => this.spawn('weak', e.pos, { off: new THREE.Vector3(...o), host: e })); return e;
  }
  steer(e, goal, speed, turn, dt) { const want = this.v.subVectors(goal, e.pos); const d = want.length(); want.multiplyScalar(speed / Math.max(1e-3, d)); e.vel.lerp(want, Math.min(1, dt * turn)); e.pos.addScaledVector(e.vel, dt); return d; }
  // ---------------------------------------------------------------- the station takes a hit
  hurt(dmg, at) {
    if (this.over) return; if (this.st.evade && Math.random() < this.st.evade) return;
    dmg /= 1 + this.st.armour;
    dmg *= 1 + 0.08 * Math.max(0, this.wave); /* and hit harder */ if (this.shield > 0) { const a = Math.min(this.shield, dmg); this.shield -= a; dmg -= a; }
    if (dmg > 0) { this.hull = Math.max(0, this.hull - dmg); this.station.flash = 1; this.shake = Math.max(this.shake || 0, dmg > 0.05 ? 0.9 : 0.35); if (dmg > 0.05) haptic('hit'); }
    this.blast(at, 5, 0.4, this.sparkTex);
    if (this.hull <= 0 && this.beacon) { this.beacon = false; this.hull = 0.15; this.banner = { text: 'Emergency beacon', t: 2 }; playSfx('milestone', 0.8); return; }
    if (this.hull <= 0) { this.over = true; this.running = false; lockTone(false); this.banner = { text: 'Station lost', t: 99 }; playSfx('bossdie', 0.9); for (let i = 0; i < 8; i++) this.blast(this.v.copy(this.hub).add(new (T().Vector3)(rnd(-18, 18), rnd(-8, 8), rnd(-10, 10))), rnd(12, 26), rnd(0.6, 1.2)); }
  }
  win() { this.won = true; this.over = true; this.running = false; lockTone(false); this.banner = { text: 'Station held', t: 99 }; playSfx('milestone', 1); }
  /** Damage to one enemy (cannon round, missile, arc, blast); true if it died. */
  damage(e, n, cannon = false) { if (!e.alive || e.kind === 'capital') return false; if (cannon && e.k.armour) n *= e.k.armour + (1 - e.k.armour) * Math.min(1, this.st.ap); /* armour turns most cannon fire aside */ e.hp -= n; e.flash = 1; if (e.hp <= 0) { this.kill(e); return true; } return false; }
  kill(e) {
    e.alive = false; this.score += e.k.score; this.kills++;
    this.blast(e.pos, e.kind === 'bomber' ? 26 : e.kind === 'weak' ? 22 : e.kind === 'torpedo' ? 9 : 16, 0.6); this.blast(e.pos, e.kind === 'bomber' ? 14 : 8, 0.35, this.sparkTex);
    playSfx(e.kind === 'torpedo' ? 'hurt' : 'boom', e.kind === 'bomber' || e.kind === 'weak' ? 0.9 : 0.5); this.shatter(e); this.drop(e);
    if (e.kind === 'weak' && e.host.weak.every((w) => !w.alive)) e.host.dying = 1.3; // the capital ship goes up in a chain of blasts
  }
  /** A ship breaks apart: plates and shards in its colour fly out from where it died, carried on along its path,
   *  tumbling; bigger ships throw more, and a few of their pieces burn. */
  shatter(e) {
    const THREE = T(), n = PIECES[e.kind] || 8, R = e.k.r, big = R >= 7, base = new THREE.Color(e.kind === 'weak' ? 0xb08a40 : e.kind === 'torpedo' ? 0xc07070 : e.k.color ?? 0x8a93a8);
    for (let i = 0; i < n; i++) {
      if (this.debris.length >= DEBRIS_MAX) this.debris.shift();
      const dir = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(), plate = Math.random() < 0.6, k = (big ? rnd(0.14, 0.36) : rnd(0.18, 0.4)) * R;
      this.debris.push({ p: e.pos.clone().addScaledVector(dir, R * 0.3), v: dir.multiplyScalar(rnd(6, 26) * Math.sqrt(R / 5)).addScaledVector(e.vel, 0.6),
        r: new THREE.Euler(rnd(0, 6), rnd(0, 6), rnd(0, 6)), w: new THREE.Vector3(rnd(-7, 7), rnd(-7, 7), rnd(-7, 7)), s: plate ? [k * 1.4, k * 0.14, k] : [k * 0.7, k * 0.6, k * 0.8],
        c: base.clone().multiplyScalar(rnd(0.45, 0.9)), t: 0, life: rnd(1.4, 2.6) * (big ? 1.3 : 1), burn: big && i < 3 + (e.kind === 'capital' ? 5 : 0), smokeT: 0 });
    }
    for (let i = 0; i < n * 1.6; i++) { if (this.embers.length >= 300) this.embers.shift(); const dir = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize();
      this.embers.push({ p: e.pos.clone(), v: dir.multiplyScalar(rnd(30, 90) * Math.sqrt(R / 5)).addScaledVector(e.vel, 0.4), t: 0, life: rnd(0.35, 0.9), s: rnd(0.25, 0.55) * Math.sqrt(R), c: new THREE.Color().setHSL(rnd(0.05, 0.13), 1, rnd(0.55, 0.75)) }); }
  }
  /** Everything within r of a point takes n (a burst). */
  burst(at, r, n, skip, cannon = false) { for (const e of this.enemies) if (e !== skip && e.alive && e.kind !== 'capital' && e.pos.distanceTo(at) < r + e.k.r) this.damage(e, n, cannon); }
  /** A flash, fireball or puff. o: delay (s before it shows), vel (it drifts), from and grow (its size over its life),
   *  ease (grows fast, then slows), lin (fades evenly rather than holding and dropping). */
  blast(pos, size, life, tex = this.fireTex, o = {}) {
    const THREE = T(), m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos); m.visible = !o.delay; this.scene.add(m); this.blasts.push({ m, t: -(o.delay || 0), life, size, vel: o.vel, from: o.from ?? 0.4, grow: o.grow ?? 0.9, ease: o.ease, lin: o.lin });
  }
  sparks(p, n, speed, size) {
    const THREE = T(); for (let i = 0; i < n; i++) { if (this.embers.length >= 300) this.embers.shift(); const d = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize();
      this.embers.push({ p: p.clone(), v: d.multiplyScalar(rnd(0.3, 1) * speed), t: 0, life: rnd(0.45, 1.2), s: rnd(0.5, 1) * size, c: new THREE.Color().setHSL(rnd(0.06, 0.14), 1, rnd(0.6, 0.85)) }); }
  }
  /** A missile hits: a white-hot flash, a fireball with smaller ones bursting round it, a shock wave, sparks, smoke that
   *  hangs, and a flash of light on everything near; a heavy boom and a shake that fall off with distance. */
  missileBoom(p, big = 0) {
    const THREE = T(), s = 1 + big / 32, dir = () => new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize();
    this.blast(p, 38 * s, 0.16, this.coreTex, { from: 0.6, grow: 0.7 }); this.blast(p, (62 + big) * s, 0.9);
    for (let i = 0; i < 7; i++) { const d = dir(); this.blast(this.v.copy(p).addScaledVector(d, rnd(6, 16) * s), rnd(18, 32) * s, rnd(0.5, 0.85), this.fireTex, { delay: rnd(0.02, 0.24), vel: d.multiplyScalar(rnd(14, 34)) }); }
    this.blast(p, 140 * s, 0.5, this.ringTex, { from: 0.08, grow: 1, ease: true, lin: true });
    for (let i = 0; i < 5; i++) { const d = dir(); this.blast(this.v.copy(p).addScaledVector(d, rnd(4, 12)), rnd(24, 36) * s, rnd(1.6, 2.4), this.smokeTex, { delay: rnd(0.1, 0.3), vel: d.multiplyScalar(rnd(5, 12)), from: 0.5, grow: 0.8 }); }
    this.sparks(p, 48, 160 * s, 1.3); this.boomLight.position.copy(p); this.boomT = 1;
    const near = Math.max(0, Math.min(1, 1 - (p.length() - 120) / 700)); this.shake = Math.max(this.shake, 0.6 + 1.1 * near); haptic('thud'); explosion(0.5 + 0.5 * near);
  }
  beam(m, a, b) { const THREE = T(), d = this.v.subVectors(b, a), len = d.length(); m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.visible = true; }
  /** Where a target will be when a round fired now reaches it. */
  lead(e, from, speed = this.st?.speed || 520) { const d = e.pos.distanceTo(from), t = d / speed; return this.v.copy(e.pos).addScaledVector(e.vel, t); }
  // ---------------------------------------------------------------- the missile: lock, fire, home in
  /** Fire at the locked target; without a lock the launcher refuses (true if it fired). */
  fireMissile() {
    const ms = this.ms; if (!this.running || this.pick) return false;
    if (!ms.locked || !ms.target?.alive || ms.ammo <= 0) { ms.noLock = 0.8; playSfx('deny', 0.6); return false; }
    const THREE = T(), g = new THREE.Group(), body = new THREE.Mesh(this.missileGeo, this.missileMat); g.add(body);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fireTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); flame.scale.setScalar(4); flame.position.z = 2.2; g.add(flame);
    const from = this.rack.getWorldPosition(new THREE.Vector3()), fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cam.quaternion); this.blast(from.clone().addScaledVector(fwd, 1.4), 0.7, 0.09, this.coreTex, { from: 0.7, grow: 0.5 });
    this.scene.add(g); this.missiles.push({ g, p: from, v: fwd.multiplyScalar(110), target: ms.target, life: 6, trailT: 0, t: 0 });
    ms.ammo--; if (ms.ammo <= 0) ms.reloadT = this.st.reload; ms.locked = false; ms.lockT = 0; ms.target = null; lockTone(false); whoosh(1); this.shake = Math.max(this.shake, 2.4); this.recoil = Math.max(this.recoil, 0.12); this.roll = (Math.random() < 0.5 ? -1 : 1) * 0.06; this.jolt = 2.8; this.punch = 1; haptic('launch'); return true;
  }
  seek(dt, fwd, origin) {
    const ms = this.ms; if (ms.reloadT > 0) { ms.reloadT -= dt; if (ms.reloadT <= 0) { ms.reloadT = 0; ms.ammo = this.st.missiles; playSfx('dashReady', 0.6); } } // the whole rack at once
    ms.noLock = Math.max(0, ms.noLock - dt);
    const ang = (e) => fwd.angleTo(this.v.subVectors(e.pos, origin));
    if (ms.target && (!ms.target.alive || ang(ms.target) > HOLD_CONE)) { if (ms.locked) playSfx('deny', 0.35); ms.target = null; ms.locked = false; ms.lockT = 0; }
    if (!ms.target && ms.ammo > 0) { let best = LOCK_CONE * (this.st.cone / 0.09); for (const e of this.enemies) { if (!e.alive || !e.k.missile) continue; const a = ang(e); if (a < best) { best = a; ms.target = e; } } ms.lockT = 0; ms.beepT = 0; }
    if (ms.target && !ms.locked) {
      ms.lockT += dt; const k = ms.lockT / this.st.lockTime; ms.beepT -= dt;
      if (ms.beepT <= 0) { ms.beepT = 0.32 - 0.24 * Math.min(1, k); playSfx('lockBeep', 0.9); }
      if (k >= 1) { ms.locked = true; }
    }
    lockTone(ms.locked && this.running && !this.pick);
  }
  // ---------------------------------------------------------------- every frame
  update(dt) {
    const THREE = T(), cam = this.cam; this.t += dt; const k = this.keys; if (!this.st) return;
    if (k.l || k.r || k.f || k.b) this.look(((k.r ? 1 : 0) - (k.l ? 1 : 0)) * 380 * dt, ((k.b ? 1 : 0) - (k.f ? 1 : 0)) * 380 * dt); // W/A/S/D or the arrows aim too
    // shake: a smooth rumble (layered sines, so it rolls rather than jitters), a recoil kick up that settles fast, a roll;
    // the gun rig jolts back with each round. All off with the Screen shake setting.
    const on = G.state?.settings?.shake !== false, sk = this.shake; this.shake = Math.max(0, sk - dt * 2.6); this.recoil *= Math.exp(-dt * 13); this.roll *= Math.exp(-dt * 5); this.jolt *= Math.exp(-dt * 18);
    const amp = on ? sk * sk * 0.011 : 0, tt = this.t, nx = Math.sin(tt * 61.3) + 0.6 * Math.sin(tt * 37.1 + 2), ny = Math.sin(tt * 53.7 + 1.3) + 0.6 * Math.sin(tt * 29.9);
    cam.position.set(0, 0, 0); cam.rotation.set(this.pitch + (on ? this.recoil : 0) + ny * amp, this.yaw + nx * amp, (on ? this.roll : 0) + nx * amp * 0.6); cam.updateMatrixWorld();
    const j = on ? this.jolt : 0; this.rig.position.set(nx * amp * 2, ny * amp * 2 - j * 0.025, j * 0.09); this.rig.rotation.x = j * 0.03;
    this.punch *= Math.exp(-dt * 7); const fov = (this.fov0 || cam.fov) + (on ? this.punch * 7 : 0); if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); } /* a launch punches the view wide */
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), origin = cam.position;
    const fight = this.running && !this.pick, fdt = fight ? dt : 0; // an upgrade being chosen holds the fight
    // waves: when the sky is clear, any upgrades earned, then the next
    if (fight) {
      for (let i = this.spawnQ.length - 1; i >= 0; i--) { const q = this.spawnQ[i]; q.at -= dt; if (q.at <= 0) { this.spawnQ.splice(i, 1); if (q.kind === 'fighter') this.addFighter(); else if (q.kind === 'bomber') this.addBomber(); else if (q.kind === 'gunship') this.addGunship(); else this.addCapital(); } }
      if (!this.spawnQ.length && !this.enemies.some((e) => e.alive)) {
        if (this.waveLive) this.waveCleared();
        this.gap -= dt; if (this.gap <= 0) { if (this.picksDue > 0) { this.picksDue--; this.offerPick(); } else { this.gap = 2.2; this.nextWave(); } }
      }
    }
    // enemies
    for (const e of this.enemies) {
      if (!e.alive) continue; e.t += fdt; e.flash = Math.max(0, e.flash - dt * 6);
      if (fdt) {
        if (e.kind === 'fighter') {
          if (e.state === 'approach') { if (this.steer(e, e.goal, 80, 1.6, dt) < 30) { e.state = 'run'; e.runGoal = this.v.copy(this.hub).add(new THREE.Vector3(rnd(-10, 10), rnd(-2, 6), rnd(-6, 6))).clone(); e.shots = 3; e.shotT = 0.6; } }
          else if (e.state === 'run') {
            const d = this.steer(e, e.runGoal, 110, 2.4, dt); e.shotT -= dt;
            if (e.shotT <= 0 && e.shots > 0 && d < 230) { e.shots--; e.shotT = 0.45; const bm = this.beams.find((b) => !b.m.visible); const hit = this.v.copy(e.runGoal).add(new THREE.Vector3(rnd(-5, 5), rnd(-3, 3), rnd(-3, 3))).clone(); if (bm) { this.beam(bm.m, e.pos, hit); bm.t = 0.12; } if (Math.random() < 0.65) this.hurt(0.011, hit); playSfx('laser', 0.3, 0.8 + Math.random() * 0.3); }
            if (d < 45) { e.state = 'break'; const s = Math.sign(e.pos.x) || 1; e.goal = new THREE.Vector3(s * rnd(140, 220), rnd(80, 160), rnd(-260, -120)); }
          } else if (this.steer(e, e.goal, 100, 1.4, dt) < 30) this.fighterGoal(e);
        } else if (e.kind === 'bomber') {
          if (e.state === 'inbound') { if (this.steer(e, e.goal, 32, 0.8, dt) < 12) { e.state = 'outbound'; for (let i = 0; i < 3; i++) this.addTorpedo(e.pos.clone().add(new THREE.Vector3((i - 1) * 4, -2, 0))); playSfx('missile', 0.7); e.goal = new THREE.Vector3(e.pos.x * 3 + (Math.sign(e.pos.x) || 1) * 200, 220, -700); } }
          else if (this.steer(e, e.goal, 34, 0.7, dt) < 40) { e.state = 'inbound'; e.goal = new THREE.Vector3(rnd(-60, 60), rnd(0, 25), -150); } // round again for another pass
        } else if (e.kind === 'gunship') {
          const hover = this.v.copy(e.home).add(new THREE.Vector3(Math.sin(e.t * 0.4) * 40, Math.sin(e.t * 0.7) * 6, 0)).clone(); this.steer(e, hover, 36, 1.2, dt);
          if (e.pos.distanceTo(e.home) < 90) { e.shotT -= dt; if (e.shotT <= 0) { e.shotT = 4; const bm = this.beams.find((b) => !b.m.visible), hit = this.hub.clone().add(new THREE.Vector3(rnd(-6, 6), rnd(-2, 5), rnd(-4, 4)));
            if (bm) { this.beam(bm.m, e.pos, hit); bm.m.scale.x = bm.m.scale.z = 2.4; bm.t = 0.25; } this.hurt(0.022, hit); playSfx('ebeam', 0.5); } }
        } else if (e.kind === 'torpedo') {
          const to = this.v.subVectors(this.hub, e.pos), dist = to.length(); if (dist < 9) { e.alive = false; this.hurt(0.08, e.pos); this.blast(e.pos, 20, 0.7); playSfx('boom', 1); this.drop(e); continue; }
          const slow = dist < 150 ? 1 - this.st.torpSlow : 1; /* the tractor field drags them near the station */ e.pos.addScaledVector(e.vel, dt * slow); e.trailT -= dt; if (e.trailT <= 0) { e.trailT = 0.05; this.blast(e.pos, 3.5, 0.5, this.sparkTex); }
        } else if (e.kind === 'capital') {
          if (e.dying != null) { e.dying -= dt; e.boomT = (e.boomT || 0) - dt; if (e.boomT <= 0) { e.boomT = 0.12; this.blast(this.v.copy(e.pos).add(new THREE.Vector3(rnd(-30, 30), rnd(-14, 14), rnd(-10, 10))), rnd(20, 50), rnd(0.7, 1.4)); this.shake = 0.3; }
            if (e.dying <= 0) { this.shatter(e); this.drop(e); playSfx('bossdie', 1); this.score += 2000; this.shake = Math.max(this.shake, 1.2); } continue; }
          this.steer(e, e.goal, 40, 0.5, dt); e.vel.multiplyScalar(0.98);
          if (e.pos.distanceTo(e.goal) < 40) {
            e.launchT -= dt; if (e.launchT <= 0 && this.enemies.filter((x) => x.alive && x.kind === 'fighter').length < 4) { e.launchT = 7; this.addFighter(e.pos.clone().add(new THREE.Vector3(rnd(-20, 20), -10, 20))); }
            e.salvoT -= dt; if (e.salvoT <= 0) { e.salvoT = 8; for (let i = 0; i < 3; i++) this.addTorpedo(e.pos.clone().add(new THREE.Vector3((i - 1) * 14, -8, 12))); playSfx('missile', 0.9); }
          }
        }
      }
      if (e.kind === 'weak') { e.host.g.updateMatrixWorld(); e.pos.copy(e.host.g.localToWorld(e.off.clone())); /* the ship has just been placed and turned */ e.g.userData.glow.material.opacity = 0.6 + 0.4 * Math.sin(this.t * 6 + e.off.x); }
      // face the camera, nose along the way it is moving on screen (the models are drawn to be seen from above)
      e.g.position.copy(e.pos);
      if (e.g.userData.body) {
        e.g.quaternion.copy(cam.quaternion); const a = this.v.copy(e.pos).add(e.vel).project(cam), b = e.pos.clone().project(cam);
        e.g.rotateZ(Math.atan2(a.y - b.y, a.x - b.x) + Math.PI / 2); e.g.rotateX(0.35);
        e.g.userData.body.material.emissive.setScalar(e.flash * 0.8).add(new THREE.Color(e.k.color).multiplyScalar(0.18));
      } else if (e.kind === 'torpedo') e.g.lookAt(this.v.copy(e.pos).add(e.vel));
    }
    // the cannons: they fire on their own at whatever is in the sights (aimed at where it will be), barrels in turn
    let target = null, best = this.st.cone;
    for (const e of this.enemies) { if (!e.alive || e.kind === 'capital') continue; const L = this.lead(e, origin), ang = fwd.angleTo(this.v.subVectors(L, origin)); if (ang < best) { best = ang; target = e; } }
    this.locked = target; this.fireT -= fdt; const gun = this.gun;
    if (gun.reloadT > 0) { gun.reloadT -= fdt; if (gun.reloadT <= 0) { gun.reloadT = 0; gun.ammo = this.st.mag; if (!playSample('turretReady', 0.22)) playSfx('dashReady', 0.5); haptic('thud'); } }
    if (target && fight && this.fireT <= 0 && !gun.reloadT && gun.ammo > 0) {
      this.fireT = this.st.fireEvery; gun.ammo--; this.recoil = Math.min(0.03, this.recoil + 0.014); this.shake = Math.max(this.shake, 0.6); this.jolt = 1; haptic('tick'); // a heavy round: kick, rumble, the rig jolts
      if (gun.ammo <= 0) { gun.reloadT = this.st.gunReload; playSfx('charge', 0.5); } const b = this.barrels[this.side = 1 - this.side]; b.kick = 1; b.flash.visible = true; b.flash.rotation.z = Math.random() * 6;
      const muzzle = b.flash.getWorldPosition(new THREE.Vector3()), aim = this.lead(target, muzzle).clone(), dir = aim.sub(muzzle).normalize();
      if (this.bullets.length < 280) this.bullets.push({ p: muzzle, v: dir.multiplyScalar(this.st.speed), life: 2.2, pierce: this.st.pierce, hit: [], mul: 1 });
      if (!playSample('turretShot', 0.55, 1)) playSfx('cannon', 0.28); // the recorded shot (the synth one until it has loaded)
    }
    for (const b of this.barrels) { b.kick = Math.max(0, b.kick - dt * 9); b.g.position.z = -1.2 + b.kick * 0.14; if (b.kick < 0.5) b.flash.visible = false; }
    // the sentry guns on the station: a round at a fighter now and then
    if (this.st.sentries && fight) { this.sentryT -= dt; if (this.sentryT <= 0) { this.sentryT = 0.6 / this.st.sentries; let f = null, bd = 420; for (const e of this.enemies) if (e.alive && e.kind === 'fighter') { const dd = e.pos.distanceTo(this.hub); if (dd < bd) { bd = dd; f = e; } }
      if (f) { const from = this.hub.clone().add(new THREE.Vector3(0, 8, 0)), aim = this.lead(f, from).clone().add(new THREE.Vector3(rnd(-4, 4), rnd(-4, 4), rnd(-4, 4))); this.bullets.push({ p: from, v: aim.sub(from).normalize().multiplyScalar(this.st.speed), life: 2, pierce: 0, hit: [], mul: 0.6 }); } } }
    // rounds fly and hit
    const seg = new THREE.Vector3(); let n = 0; const d = this.d;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const u = this.bullets[i]; u.life -= fdt; const step = seg.copy(u.v).multiplyScalar(fdt); let hit = null;
      if (u.life > 0 && fdt) for (const e of this.enemies) { if (!e.alive || e.kind === 'capital' || u.hit.includes(e)) continue; if (segHitsSphere(u.p, step, e.pos, e.k.r + (e.kind === 'torpedo' ? this.st.flak : 0))) { hit = e; break; } }
      if (hit) {
        const n0 = this.st.dmg * u.mul; this.hitT = 0.12; u.hit.push(hit); const at = hit.pos.clone();
        if (!this.damage(hit, n0, true)) this.blast(u.p, hit.k.armour ? 2 : 3, 0.15, hit.k.armour ? this.sparkTex : this.cyanTex); /* armour sparks */
        if (this.st.splash) { this.burst(at, this.st.splash, n0 * 0.5, hit, true); this.blast(at, this.st.splash * 1.4, 0.3); }
        if (this.st.tesla && Math.random() < this.st.tesla) this.arc(at, n0, hit);
        if (u.pierce > 0) u.pierce--; else { this.bullets.splice(i, 1); continue; }
      }
      if (u.life <= 0) { this.bullets.splice(i, 1); continue; }
      u.p.add(step); d.position.copy(u.p); d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), seg.copy(u.v).normalize()); d.updateMatrix(); this.bulletMesh.setMatrixAt(n++, d.matrix);
    }
    this.bulletMesh.count = n; this.bulletMesh.instanceMatrix.needsUpdate = true; this.hitT = Math.max(0, this.hitT - dt);
    // missiles: the seeker locks on; missiles in flight turn toward where their target will be
    if (fight) this.seek(dt, fwd, origin); else lockTone(false);
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i]; m.life -= fdt; if (!fdt) continue; m.t += dt;
      if (!m.target?.alive) m.target = this.retarget(m); const tg = m.target;
      const speed = Math.min(MISSILE_SPEED, m.v.length() + 300 * dt), dir = m.v.clone().normalize();
      if (tg && m.t > 0.12) { // a moment's straight flight off the rack, then it turns in
        const lt = Math.min(0.8, m.p.distanceTo(tg.pos) / MISSILE_SPEED), want = tg.pos.clone().addScaledVector(tg.vel, lt).sub(m.p).normalize(); // lead from its top speed, and never far
        const ang = dir.angleTo(want), turn = Math.min(1, (dt * 5.5) / Math.max(ang, 1e-3)); dir.lerp(want, turn).normalize();
      }
      m.v.copy(dir).multiplyScalar(speed);
      m.p.addScaledVector(m.v, dt); m.g.position.copy(m.p); m.g.lookAt(this.v.copy(m.p).sub(m.v));
      m.trailT -= dt; if (m.trailT <= 0) { m.trailT = 0.03; this.blast(m.p, 3, 0.9, this.smokeTex); }
      if ((tg && m.p.distanceTo(tg.pos) < tg.k.r + 3) || m.life <= 0) {
        if (tg) { this.damage(tg, this.st.missileDmg); if (this.st.missileBlast) this.burst(m.p, this.st.missileBlast, this.st.missileDmg * 0.5, tg); this.missileBoom(m.p, this.st.missileBlast); }
        this.scene.remove(m.g); this.missiles.splice(i, 1);
      }
    }
    // point defence: the station picks off the torpedo nearest it now and then
    if (this.st.pdEvery && fight) { this.pdT -= dt; if (this.pdT <= 0) { let tor = null, bd = 260; for (const e of this.enemies) if (e.alive && e.kind === 'torpedo') { const dd = e.pos.distanceTo(this.hub); if (dd < bd) { bd = dd; tor = e; } } if (tor) { this.pdT = this.st.pdEvery; this.beam(this.pdBeam, this.hub, tor.pos); this.pdBeamT = 0.15; this.kill(tor); } } }
    this.pdBeamT = Math.max(0, (this.pdBeamT || 0) - dt); this.pdBeam.visible = this.pdBeamT > 0;
    for (const b of [...this.beams, ...this.arcs]) { if (!b.m.visible) continue; b.t -= dt; b.m.material.opacity = Math.max(0, b.t / 0.12); if (b.t <= 0) b.m.visible = false; }
    this.enemies = this.enemies.filter((e) => e.alive);
    { let n = 0; const d2 = this.d, col = new THREE.Color();
      for (let i = this.debris.length - 1; i >= 0; i--) {
        const b = this.debris[i]; b.t += dt; if (b.t >= b.life) { this.debris.splice(i, 1); continue; }
        b.p.addScaledVector(b.v, dt); b.v.multiplyScalar(1 - dt * 0.25); b.r.x += b.w.x * dt; b.r.y += b.w.y * dt; b.r.z += b.w.z * dt;
        if (b.burn && b.t < b.life * 0.75) { b.smokeT -= dt; if (b.smokeT <= 0) { b.smokeT = 0.07; this.blast(b.p, rnd(2.5, 4), 0.45); this.blast(b.p, rnd(3, 5), 1.1, this.smokeTex); } }
        const fade = Math.min(1, (b.life - b.t) / 0.5); d2.position.copy(b.p); d2.rotation.copy(b.r); d2.scale.set(b.s[0] * fade, b.s[1] * fade, b.s[2] * fade); d2.updateMatrix(); this.debrisMesh.setMatrixAt(n, d2.matrix);
        col.copy(b.c).lerp(this.hot, Math.max(0, 1 - b.t / 0.35)); this.debrisMesh.setColorAt(n, col); n++; } /* hot for a moment, then its own colour */
      this.debrisMesh.count = n; this.debrisMesh.instanceMatrix.needsUpdate = true; this.debrisMesh.instanceColor.needsUpdate = true;
      let m = 0; for (let i = this.embers.length - 1; i >= 0; i--) { const b = this.embers[i]; b.t += dt; if (b.t >= b.life) { this.embers.splice(i, 1); continue; } b.p.addScaledVector(b.v, dt); b.v.multiplyScalar(1 - dt * 1.8);
        const k = 1 - b.t / b.life; d2.position.copy(b.p); d2.rotation.set(b.t * 9, b.t * 7, 0); d2.scale.setScalar(b.s * k); d2.updateMatrix(); this.emberMesh.setMatrixAt(m, d2.matrix); this.emberMesh.setColorAt(m, col.copy(b.c).multiplyScalar(0.6 + 0.4 * k)); m++; }
      this.emberMesh.count = m; this.emberMesh.instanceMatrix.needsUpdate = true; this.emberMesh.instanceColor.needsUpdate = true; }
    for (let i = this.blasts.length - 1; i >= 0; i--) { const b = this.blasts[i]; b.t += dt; if (b.t < 0) continue; b.m.visible = true; const q = b.t / b.life; if (q >= 1) { this.scene.remove(b.m); b.m.material.dispose(); b.m.geometry.dispose(); this.blasts.splice(i, 1); continue; }
      if (b.vel) { b.m.position.addScaledVector(b.vel, dt); b.vel.multiplyScalar(Math.max(0, 1 - dt * 1.5)); } b.m.scale.setScalar(b.size * (b.from + (b.ease ? 1 - (1 - q) * (1 - q) : q) * b.grow)); b.m.material.opacity = b.lin ? 1 - q : 1 - q * q; b.m.quaternion.copy(cam.quaternion); }
    this.boomT = Math.max(0, this.boomT - dt * 3); this.boomLight.intensity = this.boomT * this.boomT * 7;
    if (this.banner.t < 90) this.banner.t -= dt;
    // the world: Earth turning below, the station breathing
    this.station.animate(dt, 0.2); this.station.body.rotation.y = this.t * 0.05;
    const u2 = this.earth.material.uniforms; u2.time.value = 300 + this.t; u2.sun.value.copy(this.sunDir).transformDirection(cam.matrixWorldInverse);
    this.station.flash = Math.max(0, (this.station.flash || 0) - dt * 2.2); const f = Math.min(1, this.station.flash); this.station.M.hull.emissive.setRGB(1, 0.83 - 0.6 * f, 0.6 - 0.5 * f);
  }
  /** A missile whose target died goes for the nearest target worth a missile (or anything) ahead of it. */
  retarget(m) { const dir = m.v.clone().normalize(); let best = null, bs = Infinity; for (const e of this.enemies) { if (!e.alive || e.kind === 'capital') continue; const to = e.pos.clone().sub(m.p), d = to.length(); if (dir.angleTo(to) > 1.1) continue; const s = d * (e.k.missile ? 0.5 : 1); if (s < bs) { bs = s; best = e; } } return best; }
  /** Tesla rounds: the hit arcs on to the two nearest other enemies. */
  arc(at, n, skip) {
    const near = this.enemies.filter((e) => e.alive && e !== skip && e.kind !== 'capital' && e.pos.distanceTo(at) < 90).sort((a, b) => a.pos.distanceTo(at) - b.pos.distanceTo(at)).slice(0, 2);
    for (const e of near) { const b = this.arcs.find((x) => !x.m.visible); if (b) { this.beam(b.m, at, e.pos); b.t = 0.15; } this.damage(e, n, true); }
    if (near.length) playSfx('arc', 0.5);
  }
  render(gl, dt) { this.update(dt); gl.setClearColor(0x000000, 1); gl.render(this.scene, this.cam); }
  /** The sights, drawn flat over the view: crosshair, target brackets (with a lead marker for fast ones), the missile
   *  seeker closing on its target, arrows at the edge for bombers and torpedoes out of view, a hit marker, the banner. */
  draw2d(ctx, W, H, pr) {
    ctx.setTransform(pr, 0, 0, pr, 0, 0); const w = W / pr, h = H / pr, cx = w / 2, cy = h / 2, cam = this.cam;
    const toScreen = (p) => { const v = p.clone().project(cam); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, front: v.z < 1 }; };
    const focal = h / (2 * Math.tan((cam.fov * Math.PI) / 360));
    for (const e of this.enemies) {
      if (!e.alive || e.kind === 'capital') continue; const s = toScreen(e.pos), dist = e.pos.distanceTo(cam.position), col = e.kind === 'fighter' ? '#ffb547' : e.kind === 'weak' ? '#ffd27a' : e.kind === 'gunship' ? '#b8c8e8' : '#ff5d6a';
      const on = s.front && s.x > 0 && s.x < w && s.y > 0 && s.y < h;
      if (!on) { if (e.kind === 'fighter') continue; // an arrow at the edge toward what matters
        let dx = s.x - cx, dy = s.y - cy; if (!s.front) { dx = -dx; dy = -dy; } const m = Math.max(Math.abs(dx) / (cx - 22), Math.abs(dy) / (cy - 22)) || 1, ax = cx + dx / m, ay = cy + dy / m, ang = Math.atan2(dy, dx);
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.fill(); ctx.restore(); continue; }
      const r = Math.max(e.kind === 'torpedo' ? 7 : 10, Math.min(60, (e.k.r / dist) * focal * 1.3)), c = e === this.locked ? '#ffffff' : col;
      ctx.strokeStyle = c; ctx.lineWidth = e === this.locked ? 2.5 : 1.8;
      if (e.kind === 'torpedo') { ctx.beginPath(); ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x + r, s.y); ctx.lineTo(s.x, s.y + r); ctx.lineTo(s.x - r, s.y); ctx.closePath(); ctx.stroke(); }
      else { const q = r * 0.45; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.beginPath(); ctx.moveTo(s.x + sx * r, s.y + sy * (r - q)); ctx.lineTo(s.x + sx * r, s.y + sy * r); ctx.lineTo(s.x + sx * (r - q), s.y + sy * r); ctx.stroke(); } }
      if (e.k.label) { ctx.fillStyle = col; ctx.font = '800 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('◆ ' + e.k.label, s.x, s.y - r - 6); /* ◆: a missile target */ ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(s.x - r, s.y + r + 4, 2 * r, 3); ctx.fillStyle = col; ctx.fillRect(s.x - r, s.y + r + 4, 2 * r * Math.max(0, e.hp / e.max), 3); }
      if (e.kind === 'fighter' || e.kind === 'torpedo') { const L = toScreen(this.lead(e, cam.position)); if (L.front && Math.hypot(L.x - s.x, L.y - s.y) > 6) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(L.x, L.y); ctx.stroke(); ctx.beginPath(); ctx.arc(L.x, L.y, 4, 0, Math.PI * 2); ctx.stroke(); } }
      // the missile seeker: a diamond closing in as it locks, a red box and LOCK once it has
      if (e === this.ms.target && !this.pick) {
        const k = Math.min(1, this.ms.lockT / this.st.lockTime), R = r + 34 * (1 - k) + 8, locked = this.ms.locked;
        ctx.strokeStyle = locked ? '#ff4d6a' : '#ffd27a'; ctx.lineWidth = locked ? 3 : 2;
        if (locked) { ctx.strokeRect(s.x - R, s.y - R, 2 * R, 2 * R); ctx.fillStyle = '#ff4d6a'; ctx.font = '800 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('LOCK', s.x, s.y - R - 6); }
        else { ctx.beginPath(); ctx.moveTo(s.x, s.y - R); ctx.lineTo(s.x + R, s.y); ctx.lineTo(s.x, s.y + R); ctx.lineTo(s.x - R, s.y); ctx.closePath(); ctx.stroke(); }
      }
    }
    // the magazine: a ring round the crosshair, draining as the cannons fire; amber and filling while they reload
    { const g2 = this.gun, R = 34, reloading = g2.reloadT > 0, k = reloading ? 1 - g2.reloadT / this.st.gunReload : g2.ammo / this.st.mag;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = reloading ? '#ffb547' : k < 0.25 ? '#ff8a9a' : 'rgba(159,240,255,.9)'; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
      if (reloading) { ctx.fillStyle = '#ffb547'; ctx.font = '800 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('RELOADING', cx, cy + R + 16); }
      else { ctx.fillStyle = k < 0.25 ? '#ff8a9a' : 'rgba(159,240,255,.8)'; ctx.font = '700 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(g2.ammo), cx + R + 12, cy + 4); } }
    // crosshair: white when something is in the sights
    const lock = !!this.locked; ctx.strokeStyle = lock ? '#ffffff' : 'rgba(159,240,255,.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.stroke(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(cx + dx * 20, cy + dy * 20); ctx.lineTo(cx + dx * 28, cy + dy * 28); ctx.stroke(); }
    ctx.fillStyle = ctx.strokeStyle; ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    if (this.hitT > 0) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.beginPath(); ctx.moveTo(cx + dx * 8, cy + dy * 8); ctx.lineTo(cx + dx * 14, cy + dy * 14); ctx.stroke(); } }
    if (this.ms.noLock > 0) { ctx.globalAlpha = Math.min(1, this.ms.noLock * 2); ctx.fillStyle = '#ff8a9a'; ctx.font = '800 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(this.ms.ammo > 0 ? 'NO LOCK' : 'RELOADING', cx, cy + 52); ctx.globalAlpha = 1; }
    if (this.banner.t > 0) { const a = Math.min(1, this.banner.t * 2); ctx.globalAlpha = a; ctx.fillStyle = this.won ? '#6dffc8' : this.over ? '#ff8a9a' : '#ffe2b0'; ctx.font = '800 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(this.banner.text.toUpperCase(), cx, h * 0.3); ctx.globalAlpha = 1; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  status() {
    const stars = this.won ? SIEGE_STARS.filter(([, need]) => this.hull >= need).length : 0, ms = this.ms;
    return { hull: this.hull, shield: this.shield, wave: Math.max(0, this.wave) + 1, waves: WAVES.length, score: this.score, over: this.over, won: this.won, stars,
      ammo: ms.ammo, missiles: this.st?.missiles || 0, reload: ms.reloadT > 0 && this.st ? 1 - ms.reloadT / this.st.reload : 1, rackReloading: ms.reloadT > 0, seeking: !!ms.target && !ms.locked, locked: ms.locked,
      pick: this.pick, rerolls: this.rerolls || 0, picks: this.picks };
  }
}
/** Does a round moving from p along step pass within r of c? */
function segHitsSphere(p, step, c, r) {
  const lx = c.x - p.x, ly = c.y - p.y, lz = c.z - p.z, len2 = step.x * step.x + step.y * step.y + step.z * step.z;
  const t = Math.max(0, Math.min(1, (lx * step.x + ly * step.y + lz * step.z) / (len2 || 1)));
  const dx = p.x + step.x * t - c.x, dy = p.y + step.y * t - c.y, dz = p.z + step.z * t - c.z; return dx * dx + dy * dy + dz * dz < r * r;
}
