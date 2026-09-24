// Per-sector backdrop: gradient sky with drifting nebula noise, three parallax star layers, and one signature set piece per sector.
import { SECTORS } from '@last-orbit/data/sectors.js';
import { SpriteBatch, rgb } from '@last-orbit/rendering/effects.js';
const T = () => window.THREE;

const SKY_FS = `uniform vec3 c0,c1,c2; uniform float time,mist; uniform vec3 mistCol; varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){ float y=vUv.y; vec3 c=mix(c0,c1,smoothstep(0.,.55,y)); c=mix(c,c2,smoothstep(.45,1.,y)*.85);
 vec2 p=vUv*vec2(3.,4.)+vec2(0.,time*.02); float f=n(p)*.55+n(p*2.3+time*.015)*.3+n(p*5.1)*.15; c+=mistCol*pow(f,2.4)*mist; gl_FragColor=vec4(c,1.);} `;
const STAR_VS = `uniform float time,speed,size,pr; attribute float tw; varying float vTw; void main(){ vec3 p=position; p.y=mod(p.y-time*speed,420.)-130.; vTw=.55+.45*sin(time*(1.+tw*3.)+tw*40.); vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=size*pr*(.6+tw)*(260./-mv.z); gl_Position=projectionMatrix*mv; }`;
const STAR_FS = `uniform vec3 col; varying float vTw; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.05,d)*vTw; gl_FragColor=vec4(col*a,a); }`;

export class Background {
  constructor(scene, tex, pixelRatio) {
    const THREE = T(); this.scene = scene; this.group = new THREE.Group(); scene.add(this.group); this.t = 0; this.cur = -1;
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.ShaderMaterial({ depthWrite: false, depthTest: false, uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, time: { value: 0 }, mist: { value: 0.2 }, mistCol: { value: new THREE.Color() } }, vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: SKY_FS }));
    this.sky.position.set(0, 75, -140); this.sky.renderOrder = -10; this.group.add(this.sky);
    this.target = { c0: new THREE.Color(), c1: new THREE.Color(), c2: new THREE.Color(), mistCol: new THREE.Color(), mist: 0.2 };
    this.stars = [[260, 3, 1.4, -110], [160, 7, 2, -80], [70, 14, 2.8, -45]].map(([n, speed, size, z]) => {
      const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), tw = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 420; pos[i * 3 + 1] = Math.random() * 420; pos[i * 3 + 2] = z; tw[i] = Math.random(); }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('tw', new THREE.BufferAttribute(tw, 1));
      const m = new THREE.Points(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { time: { value: 0 }, speed: { value: speed }, size: { value: size }, pr: { value: pixelRatio }, col: { value: new THREE.Color(1, 1, 1) } }, vertexShader: STAR_VS, fragmentShader: STAR_FS }));
      m.frustumCulled = false; m.renderOrder = -9; this.group.add(m); return m;
    });
    this.blobs = new SpriteBatch(tex.soft, 40, true, -60); this.blobs.mesh.renderOrder = -8; this.group.add(this.blobs.mesh);
    this.blobSeed = Array.from({ length: 40 }, () => [Math.random(), Math.random(), Math.random(), Math.random()]);
    // set pieces
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), new THREE.MeshLambertMaterial({ color: 0x2a5fa8, emissive: 0x061530 })); this.planet.renderOrder = -7; this.group.add(this.planet);
    this.halo = new SpriteBatch(tex.soft, 4, true, -95); this.halo.mesh.renderOrder = -7.5; this.group.add(this.halo.mesh);
    this.disc = new THREE.Mesh(new THREE.RingGeometry(1.25, 2.6, 48, 1), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); this.disc.renderOrder = -6; this.group.add(this.disc);
    const rockGeo = new THREE.DodecahedronGeometry(1, 0); this.rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0x6a6f86 }), 14); this.rocks.renderOrder = -5; this.rocks.frustumCulled = false; this.group.add(this.rocks);
    this.rockSeed = Array.from({ length: 14 }, () => [(Math.random() - 0.5) * 220, Math.random() * 300, -30 - Math.random() * 50, 2 + Math.random() * 7, Math.random() * 6, 2 + Math.random() * 4]);
    const gp = []; for (let i = -10; i <= 10; i++) { gp.push(i * 20, -200, 0, i * 20, 400, 0); } for (let j = -10; j <= 20; j++) gp.push(-200, j * 20, 0, 200, j * 20, 0);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    this.grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x3dffb5, transparent: true, opacity: 0.13, depthWrite: false })); this.grid.position.z = -40; this.grid.renderOrder = -6; this.group.add(this.grid);
    this.dummy = new THREE.Object3D();
  }
  setSector(idx, instant) {
    if (idx === this.cur) return; this.cur = idx; const d = SECTORS[idx % SECTORS.length], t = this.target;
    t.c0.set(d.sky[0]); t.c1.set(d.sky[1]); t.c2.set(d.sky[2]); t.mistCol.set(d.accent); t.mist = d.decor === 'mist' ? 0.9 : d.decor === 'spores' ? 0.55 : 0.22;
    this.decor = d.decor; this.accent = rgb(d.accent);
    for (const s of this.stars) s.material.uniforms.col.value.set(d.star);
    this.grid.visible = d.decor === 'grid'; this.rocks.visible = d.decor === 'rocks' || d.decor === 'rings'; this.disc.visible = d.decor === 'rings';
    this.planetOn = this.planet.visible = d.decor !== 'mist' && d.decor !== 'spores';
    const p = this.planet;
    if (d.decor === 'none') { p.position.set(-40, -235, -120); p.scale.setScalar(260); p.material.color.set(0x2a5fa8); p.material.emissive.set(0x061a3a); }
    else if (d.decor === 'rocks') { p.position.set(95, 215, -130); p.scale.setScalar(55); p.material.color.set(0x9a9aa8); p.material.emissive.set(0x0c0c12); }
    else if (d.decor === 'grid') { p.position.set(0, 330, -135); p.scale.setScalar(150); p.material.color.set(0x0c3a32); p.material.emissive.set(0x031512); }
    else if (d.decor === 'rings') { p.position.set(30, 200, -120); p.scale.setScalar(26); p.material.color.set(0x000000); p.material.emissive.set(0x000000); this.disc.position.copy(p.position); this.disc.scale.setScalar(26); this.disc.rotation.x = -1.15; }
    if (instant) { const u = this.sky.material.uniforms; u.c0.value.copy(t.c0); u.c1.value.copy(t.c1); u.c2.value.copy(t.c2); u.mistCol.value.copy(t.mistCol); u.mist.value = t.mist; }
  }
  update(dt, speedMul) {
    this.t += dt * (0.6 + 0.4 * speedMul); const u = this.sky.material.uniforms, t = this.target, k = Math.min(1, dt * 1.2);
    u.c0.value.lerp(t.c0, k); u.c1.value.lerp(t.c1, k); u.c2.value.lerp(t.c2, k); u.mistCol.value.lerp(t.mistCol, k); u.mist.value += (t.mist - u.mist.value) * k; u.time.value = this.t;
    for (const s of this.stars) s.material.uniforms.time.value = this.t;
    const B = this.blobs; B.begin(); const n = this.decor === 'mist' || this.decor === 'spores' ? 40 : 10, big = this.decor === 'spores' ? 0.35 : 1;
    for (let i = 0; i < n; i++) { const s = this.blobSeed[i], y = ((s[1] * 400 - this.t * (2 + s[2] * 5)) % 400 + 400) % 400 - 120, sz = (50 + s[3] * 110) * big; B.add((s[0] - 0.5) * 300 + Math.sin(this.t * 0.1 + i) * 10, y, sz, sz, 0, this.accent, 0.05 + s[2] * 0.07); }
    B.end();
    const H = this.halo; H.begin(); if (this.decor === 'none') H.add(-40, -5, 420, 90, 0, this.accent, 0.22); if (this.decor === 'rings') { H.add(30, 200, 150, 150, 0, rgb(0xffb060), 0.3); this.disc.rotation.z = this.t * 0.2; } H.end();
    if (this.rocks.visible) { const d = this.dummy; for (let i = 0; i < 14; i++) { const r = this.rockSeed[i]; d.position.set(r[0], ((r[1] - this.t * r[5]) % 300 + 300) % 300 - 80, r[2]); d.rotation.set(this.t * 0.1 + r[4], this.t * 0.13 * r[5] * 0.3, r[4]); d.scale.setScalar(r[3]); d.updateMatrix(); this.rocks.setMatrixAt(i, d.matrix); } this.rocks.instanceMatrix.needsUpdate = true; }
    if (this.grid.visible) this.grid.position.y = -((this.t * 6) % 20);
    if (this.planet.visible && this.decor === 'none') this.planet.rotation.y = this.t * 0.01;
  }
}
