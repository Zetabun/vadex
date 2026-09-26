// Per-sector backdrop: gradient sky with drifting nebula noise, three parallax star layers, and one signature set piece per sector.
import { SECTORS } from '@last-orbit/data/sectors.js';
import { ORIGIN } from '@last-orbit/data/cipher.js';
import { SpriteBatch, rgb } from '@last-orbit/rendering/effects.js';
const T = () => window.THREE;

const SKY_FS = `uniform vec3 c0,c1,c2; uniform float time,mist; uniform vec3 mistCol; varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){ float y=vUv.y; vec3 c=mix(c0,c1,smoothstep(0.,.55,y)); c=mix(c,c2,smoothstep(.45,1.,y)*.85);
 vec2 p=vUv*vec2(3.,4.)+vec2(0.,time*.02); float f=n(p)*.55+n(p*2.3+time*.015)*.3+n(p*5.1)*.15; c+=mistCol*pow(f,2.4)*mist; gl_FragColor=vec4(c,1.);} `;
// The home world: Earth, drawn procedurally on the sphere so it stays sharp however large it is on screen. Continents
// and biomes from 3D noise on the unit sphere, polar ice, a slow cloud layer, a sun glint on the oceans and a blue rim.
const EARTH_VS = `varying vec3 vPos, vN, vView; void main(){ vPos=position; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`;
const EARTH_FS = `uniform float time, night, dim; uniform vec3 sun; varying vec3 vPos, vN, vView;
float hs(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float ns(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
 return mix(mix(mix(hs(i),hs(i+vec3(1,0,0)),f.x),mix(hs(i+vec3(0,1,0)),hs(i+vec3(1,1,0)),f.x),f.y),mix(mix(hs(i+vec3(0,0,1)),hs(i+vec3(1,0,1)),f.x),mix(hs(i+vec3(0,1,1)),hs(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<6;i++){ s+=a*ns(p); p=p*2.07+vec3(1.7,9.2,3.1); a*=.5; } return s; }
void main(){
 // Only a thin strip of this huge sphere is ever on screen, so the features are small on the sphere.
 vec3 p=normalize(vPos); float lat=abs(p.y);
 float h=fbm(p*13.), land=smoothstep(.505,.52,h), m=fbm(p*34.+7.3);
 vec3 ocean=mix(vec3(.015,.07,.24),vec3(.05,.33,.55),smoothstep(.42,.505,h));
 vec3 ground=mix(vec3(.07,.21,.09),vec3(.2,.42,.16),m);
 ground=mix(ground,vec3(.58,.48,.29),smoothstep(.56,.7,m)*smoothstep(.8,.45,lat));
 ground=mix(ground,vec3(.46,.42,.37),smoothstep(.6,.68,h));
 vec3 col=mix(ocean,ground,land);
 col=mix(col,vec3(.9,.94,1.),smoothstep(.9,.95,lat+(h-.5)*.25));
 float ct=time*.004; vec3 q=vec3(p.x*cos(ct)-p.z*sin(ct),p.y,p.x*sin(ct)+p.z*cos(ct));
 float cl=smoothstep(.5,.78,fbm(q*16.+vec3(0.,time*.01,0.)));
 float d=max(0.,dot(vN,sun));
 // Day: sunlit, a glint on the seas, bright clouds.
 vec3 day=col*(.3+.8*d)+vec3(.9,.95,1.)*pow(max(0.,dot(reflect(-sun,vN),vView)),24.)*(1.-land)*(1.-cl)*.35;
 day=mix(day,vec3(.93,.96,1.)*(.38+.7*d),cl*.85);
 // Night: the dark side, lit by cities. Clusters where the land is populated, strung together by roads, and
 // scattered towns; moonlit cloud tops dim them.
 float pop=smoothstep(.5,.72,fbm(p*55.+3.1))*land*(.55+.45*smoothstep(.56,.515,h));
 float cores=smoothstep(.55,.85,fbm(p*160.))*pop;
 float road=smoothstep(.035,0.,abs(ns(p*230.)-.5))*smoothstep(.3,.6,pop)*.55;
 float towns=step(.975,hs(floor(p*1400.)))*smoothstep(.15,.4,pop+land*.25)*land;
 float glow=min(1.,cores*1.6+road+towns*.9)*(1.-cl*.75);
 vec3 dark=col*vec3(.05,.07,.13)+vec3(.03,.045,.08)*cl;
 vec3 nightCol=dark+vec3(1.,.72,.36)*glow*1.35+vec3(1.,.55,.25)*pop*.07;
 vec3 c=mix(day,nightCol,night);
 float rim=pow(1.-max(0.,dot(vN,vView)),9.); c+=mix(vec3(.3,.6,1.),vec3(.12,.2,.45),night)*rim*.7;
 gl_FragColor=vec4(c*dim,1.); }`;
const STAR_VS = `uniform float time,speed,size,pr; attribute float tw; varying float vTw; void main(){ vec3 p=position; p.y=mod(p.y-time*speed,420.)-130.; vTw=.55+.45*sin(time*(1.+tw*3.)+tw*40.); vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=size*pr*(.6+tw)*(260./-mv.z); gl_Position=projectionMatrix*mv; }`;
const STAR_FS = `uniform vec3 col; varying float vTw; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.05,d)*vTw; gl_FragColor=vec4(col*a,a); }`;

/** How much of night it is on the player's own clock: 1 from 8pm to 5am, easing in from 6:30pm and out by 6:30am.
 *  (?night=0|1 in debug overrides it.) */
export function nightAmount(date = new Date()) {
  const o = /[?&]night=([01])/.exec(typeof location !== 'undefined' ? location.search : ''); if (o) return +o[1];
  const h = date.getHours() + date.getMinutes() / 60, ease = (x) => x * x * (3 - 2 * x);
  if (h >= 20 || h < 5) return 1;
  if (h >= 18.5) return ease((h - 18.5) / 1.5);
  if (h < 6.5) return ease(1 - (h - 5) / 1.5);
  return 0;
}

/** A new Earth material (also used for the view from the Command Deck). sun: light direction in view space. */
export function earthMaterial() {
  const THREE = T();
  return new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, dim: { value: 1 }, night: { value: nightAmount() }, sun: { value: new THREE.Vector3(-0.45, 0.62, 0.64).normalize() } }, vertexShader: EARTH_VS, fragmentShader: EARTH_FS });
}

export class Background {
  constructor(scene, tex, pixelRatio) {
    const THREE = T(); this.scene = scene; this.group = new THREE.Group(); scene.add(this.group); this.t = 0; this.cur = -1; this.nightT = 0;
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
    this.rockMat = new THREE.MeshLambertMaterial({ color: 0x2a5fa8, emissive: 0x061530 });
    this.earthMat = earthMaterial();
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), this.rockMat); this.planet.renderOrder = -7; this.group.add(this.planet);
    this.halo = new SpriteBatch(tex.soft, 4, true, -95); this.halo.mesh.renderOrder = -7.5; this.group.add(this.halo.mesh);
    this.disc = new THREE.Mesh(new THREE.RingGeometry(1.25, 2.6, 48, 1), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); this.disc.renderOrder = -6; this.group.add(this.disc);
    const rockGeo = new THREE.DodecahedronGeometry(1, 0); this.rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0x2c3246, emissive: 0x05070e, transparent: true, opacity: 0.42, depthWrite: false }), 14); /* dim and far off: scenery, not something to dodge */ this.rocks.renderOrder = -5; this.rocks.frustumCulled = false; this.group.add(this.rocks);
    this.rockSeed = Array.from({ length: 14 }, () => [(Math.random() - 0.5) * 260, Math.random() * 300, -80 - Math.random() * 70, 1.2 + Math.random() * 3.3, Math.random() * 6, 0.8 + Math.random() * 1.6]); /* deep behind the field, drifting slowly */
    const gp = []; for (let i = -10; i <= 10; i++) { gp.push(i * 20, -200, 0, i * 20, 400, 0); } for (let j = -10; j <= 20; j++) gp.push(-200, j * 20, 0, 200, j * 20, 0);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    this.grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x3dffb5, transparent: true, opacity: 0.13, depthWrite: false })); this.grid.position.z = -40; this.grid.renderOrder = -6; this.group.add(this.grid);
    this.dummy = new THREE.Object3D();
  }
  setSector(idx, instant) {
    if (idx === this.cur) return; this.cur = idx; const d = idx === 'origin' ? ORIGIN : SECTORS[idx % SECTORS.length], t = this.target; /* 'origin': the hidden sector (data/cipher.js) */
    t.c0.set(d.sky[0]); t.c1.set(d.sky[1]); t.c2.set(d.sky[2]); t.mistCol.set(d.accent); t.mist = d.decor === 'mist' ? 0.9 : d.decor === 'spores' ? 0.55 : 0.22;
    this.decor = d.decor; this.accent = rgb(d.accent);
    for (const s of this.stars) s.material.uniforms.col.value.set(d.star);
    this.grid.visible = d.decor === 'grid' || d.decor === 'glyphs'; this.grid.material.color.set(d.decor === 'glyphs' ? 0xffe9a8 : 0x3dffb5); this.grid.material.opacity = d.decor === 'glyphs' ? 0.08 : 0.13; /* the Origin: a faint gold lattice */ this.rocks.visible = d.decor === 'rocks' || d.decor === 'rings'; this.disc.visible = d.decor === 'rings';
    this.planetOn = this.planet.visible = d.decor !== 'mist' && d.decor !== 'spores';
    const p = this.planet;
    // The home world is Earth, tilted so the horizon shows the mid-latitudes rather than the pole. Other sectors: plain bodies.
    p.material = d.decor === 'none' ? this.earthMat : this.rockMat; p.rotation.set(d.decor === 'none' ? 1.15 : 0, 0, 0);
    if (d.decor === 'none') { p.position.set(-40, -235, -120); p.scale.setScalar(260); }
    else if (d.decor === 'rocks') { p.position.set(95, 215, -130); p.scale.setScalar(55); p.material.color.set(0x9a9aa8); p.material.emissive.set(0x0c0c12); }
    else if (d.decor === 'glyphs') { p.position.set(0, 290, -140); p.scale.setScalar(70); p.material.color.set(0xfff3c4); p.material.emissive.set(0x8a7440); } /* the Origin's pale sun, where the signal comes from */
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
    const H = this.halo; H.begin(); if (this.decor === 'none') H.add(-40, -5, 420, 90, 0, rgb(0x5aa8ff), 0.26 - 0.14 * this.earthMat.uniforms.night.value); if (this.decor === 'rings') { H.add(30, 200, 150, 150, 0, rgb(0xffb060), 0.3); this.disc.rotation.z = this.t * 0.2; } if (this.decor === 'glyphs') H.add(0, 290, 260 + 20 * Math.sin(this.t * 0.7), 260 + 20 * Math.sin(this.t * 0.7), 0, rgb(0xffe9a8), 0.32); H.end();
    if (this.rocks.visible) { const d = this.dummy; for (let i = 0; i < 14; i++) { const r = this.rockSeed[i]; d.position.set(r[0], ((r[1] - this.t * r[5]) % 300 + 300) % 300 - 80, r[2]); d.rotation.set(this.t * 0.1 + r[4], this.t * 0.13 * r[5] * 0.3, r[4]); d.scale.setScalar(r[3]); d.updateMatrix(); this.rocks.setMatrixAt(i, d.matrix); } this.rocks.instanceMatrix.needsUpdate = true; }
    if (this.grid.visible) this.grid.position.y = -((this.t * 6) % 20);
    if (this.decor === 'none') this.planet.position.y = -235;
    if (this.planet.visible && this.decor === 'none') { this.planet.rotation.y = this.t * 0.004; const u = this.earthMat.uniforms; u.time.value = this.t; u.dim.value += ((this.battle ? 0.62 : 1) - u.dim.value) * Math.min(1, dt * 2); if ((this.nightT -= dt) <= 0) { this.nightT = 20; u.night.value = nightAmount(); } }
  }
}
