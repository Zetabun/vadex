// Low-poly ship geometry, built once from primitives and merged into one BufferGeometry per shape (one InstancedMesh each).
// All shapes fit a unit radius and face −Y (down the screen, toward the player). r128 has no BufferGeometryUtils on the CDN build, so merge() is ours.
const T = () => window.THREE;
let M, E, Q, V, S;
function part(geo, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rz = 0, rx = 0) {
  const THREE = T(); M ||= new THREE.Matrix4(); E ||= new THREE.Euler(); Q ||= new THREE.Quaternion(); V ||= new THREE.Vector3(); S ||= new THREE.Vector3();
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(M.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, 0, rz)), S.set(sx, sy, sz)));
  return g;
}
export function merge(parts) {
  const THREE = T(); let n = 0; for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3); let o = 0;
  for (const p of parts) { pos.set(p.attributes.position.array, o); o += p.attributes.position.array.length; p.dispose(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
const prim = {};
function P() {
  const THREE = T();
  if (!prim.box) Object.assign(prim, { box: new THREE.BoxGeometry(1, 1, 1), cone: new THREE.ConeGeometry(1, 1, 5), cone3: new THREE.ConeGeometry(1, 1, 3), cone4: new THREE.ConeGeometry(1, 1, 4), cyl: new THREE.CylinderGeometry(1, 1, 1, 8), hex: new THREE.CylinderGeometry(1, 1, 1, 6), octa: new THREE.OctahedronGeometry(1, 0), ico: new THREE.IcosahedronGeometry(1, 0), dodeca: new THREE.DodecahedronGeometry(1, 0), tetra: new THREE.TetrahedronGeometry(1, 0), torus: new THREE.TorusGeometry(1, 0.16, 5, 14), sph: new THREE.SphereGeometry(1, 8, 6) });
  return prim;
}
const PI = Math.PI;
const box = (w, h, d, x, y, z = 0, rz = 0) => part(P().box, x, y, z, w, h, d, rz);
const spike = (r, len, x, y, rz, z = 0, g = 'cone4') => part(P()[g], x, y, z, r, len, r, rz); // cone points +Y before rz
const gem = (sx, sy, sz, x = 0, y = 0, z = 0, rz = 0, g = 'octa') => part(P()[g], x, y, z, sx, sy, sz, rz);
const disc = (r, h, x = 0, y = 0, z = 0, g = 'cyl') => part(P()[g], x, y, z, r, h, r, 0, PI / 2); // axis along Z
const ring = (r, x = 0, y = 0, z = 0, sy = 1) => part(P().torus, x, y, z, r, r * sy, r);
const mirror = (fn) => [fn(1), fn(-1)];

const SHAPES = {
  scout: () => [gem(0.55, 0.9, 0.45), ...mirror((s) => box(0.7, 0.22, 0.2, s * 0.6, 0.15, 0, s * 0.35)), ...mirror((s) => spike(0.14, 0.6, s * 0.95, -0.25, PI)), box(0.3, 0.3, 0.5, 0, 0.35, 0.1)],
  weaver: () => [gem(0.4, 0.75, 0.4), ...mirror((s) => gem(0.75, 0.22, 0.12, s * 0.6, 0.1, 0, s * -0.5)), ...mirror((s) => gem(0.5, 0.16, 0.1, s * 0.5, -0.4, 0, s * 0.6)), spike(0.12, 0.5, 0, -0.9, PI)],
  diver: () => [spike(0.45, 1.5, 0, -0.15, PI, 0, 'cone3'), ...mirror((s) => box(0.9, 0.14, 0.12, s * 0.55, 0.45, 0, s * -0.6)), ...mirror((s) => spike(0.12, 0.7, s * 0.9, 0.2, PI)), box(0.35, 0.3, 0.4, 0, 0.65)],
  lancer: () => [spike(0.28, 2, 0, 0, PI, 0, 'cone4'), ...mirror((s) => box(0.12, 0.9, 0.5, s * 0.32, 0.45, 0, s * 0.2)), gem(0.3, 0.3, 0.3, 0, 0.8)],
  plate: () => [box(1.5, 0.9, 0.7, 0, 0.05), box(1.8, 0.35, 0.9, 0, -0.35), ...mirror((s) => box(0.35, 1.2, 0.8, s * 0.85, 0)), box(0.5, 0.4, 1, 0, 0.3, 0.1), ...mirror((s) => spike(0.15, 0.5, s * 0.45, -0.75, PI))],
  aegis: () => [gem(0.5, 0.5, 0.5, 0, 0, 0, 0, 'ico'), ring(0.95), ...mirror((s) => box(0.16, 0.5, 0.16, s * 0.95, 0)), box(0.16, 0.5, 0.16, 0, 0.95, 0, PI / 2), box(0.16, 0.5, 0.16, 0, -0.95, 0, PI / 2)],
  mender: () => [box(0.45, 1.5, 0.45, 0, 0), box(1.5, 0.45, 0.45, 0, 0), gem(0.45, 0.45, 0.6), ...mirror((s) => gem(0.2, 0.2, 0.2, s * 0.85, 0.85, 0, 0, 'ico'))],
  herald: () => [spike(0.5, 1.1, 0, 0.3, 0, 0, 'cone3'), spike(0.5, 1.1, 0, -0.3, PI, 0, 'cone3'), ...mirror((s) => box(1, 0.1, 0.1, s * 0.7, 0)), ...mirror((s) => gem(0.18, 0.4, 0.18, s * 1.05, 0))],
  carrier: () => [part(P().hex, 0, 0, 0, 1, 0.5, 1, 0, PI / 2), box(0.5, 1.7, 0.4, 0, 0, 0.15), ...mirror((s) => box(0.5, 0.9, 0.35, s * 0.75, -0.2)), ...mirror((s) => box(0.22, 0.22, 0.6, s * 0.75, -0.7)), box(0.6, 0.3, 0.7, 0, 0.7)],
  swarm: () => [gem(0.6, 0.8, 0.4, 0, 0, 0, 0, 'tetra'), ...mirror((s) => spike(0.12, 0.8, s * 0.55, -0.2, PI + s * 0.5))],
  phantom: () => [gem(0.35, 1.1, 0.25), ...mirror((s) => gem(1, 0.18, 0.08, s * 0.5, 0.2, 0, s * -0.8)), ...mirror((s) => gem(0.7, 0.12, 0.08, s * 0.4, -0.3, 0, s * -1.1))],
  sniper: () => [box(0.3, 1.9, 0.3, 0, -0.1), gem(0.55, 0.55, 0.5, 0, 0.5), ...mirror((s) => box(0.7, 0.14, 0.14, s * 0.55, 0.5)), disc(0.24, 0.3, 0, -1, 0)],
  rocketeer: () => [box(0.9, 1, 0.6, 0, 0.1), ...mirror((s) => part(P().cyl, s * 0.75, -0.1, 0, 0.28, 1.2, 0.28)), ...mirror((s) => spike(0.28, 0.4, s * 0.75, -0.9, PI, 0, 'cone')), box(0.4, 0.4, 0.8, 0, 0.5)],
  lasher: () => [ring(0.8, 0, 0.1), box(0.35, 1.5, 0.35, 0, -0.15), spike(0.3, 0.6, 0, -1.05, PI), ...mirror((s) => gem(0.22, 0.5, 0.22, s * 0.8, 0.1))],
  artillery: () => [box(1.6, 0.8, 0.7, 0, 0.3), part(P().cyl, 0, -0.45, 0.2, 0.32, 1.3, 0.32), part(P().cyl, 0, -1.05, 0.2, 0.42, 0.25, 0.42), ...mirror((s) => box(0.3, 1.1, 0.5, s * 0.95, 0.2))],
  splitter: () => [gem(0.62, 0.62, 0.5, -0.38, 0, 0, 0, 'ico'), gem(0.62, 0.62, 0.5, 0.38, 0, 0, 0, 'ico'), box(0.5, 0.2, 0.3, 0, 0), ...mirror((s) => spike(0.1, 0.5, s * 0.5, -0.7, PI))],
  rocket: () => [part(P().cyl, 0, 0.1, 0, 0.35, 1.3, 0.35), spike(0.35, 0.6, 0, -0.85, PI, 0, 'cone'), ...mirror((s) => box(0.5, 0.4, 0.08, s * 0.4, 0.6))],
  treasure: () => [box(1.7, 0.8, 0.8, 0, 0), box(0.5, 0.5, 0.95, -0.5, 0), box(0.5, 0.5, 0.95, 0.5, 0), spike(0.4, 0.6, 1.1, 0, -PI / 2), ...mirror((s) => box(1.2, 0.12, 0.3, 0, s * 0.5))],
  // ---- Counterattack enemies
  scrapper: () => [box(0.9, 0.8, 0.5, 0, 0.1), ...mirror((s) => spike(0.18, 0.9, s * 0.72, -0.55, PI + s * 0.5)), ...mirror((s) => box(0.25, 0.75, 0.3, s * 0.55, 0.05, 0, s * 0.3)), gem(0.32, 0.32, 0.4, 0, 0.2, 0.3, 0, 'ico'), box(0.5, 0.18, 0.2, 0, 0.62)],
  stalker: () => [gem(0.34, 1.2, 0.25), ...mirror((s) => gem(0.95, 0.2, 0.12, s * 0.55, 0.3, 0, s * -0.5)), ...mirror((s) => gem(0.5, 0.14, 0.1, s * 0.35, -0.35, 0, s * -0.9)), spike(0.12, 0.6, 0, -1.15, PI)],
  flanker: () => [box(0.7, 1.15, 0.55, 0, 0), ...mirror((s) => part(P().cyl, s * 0.78, 0.05, 0, 0.17, 0.95, 0.17, PI / 2)), ...mirror((s) => box(0.5, 0.25, 0.3, s * 0.42, 0.52)), spike(0.34, 0.5, 0, -0.82, PI), box(0.3, 0.3, 0.7, 0, 0.1)],
  lunger: () => [gem(0.72, 0.9, 0.6, 0, 0.2, 0, 0, 'dodeca'), ...mirror((s) => spike(0.16, 0.7, s * 0.34, -0.72, PI + s * 0.28, 0, 'cone3')), ...[0, 1, 2].map((i) => gem(0.46 - i * 0.1, 0.46 - i * 0.1, 0.36, 0, 0.95 + i * 0.42, 0, 0, 'ico'))],
  rift: () => [...[0, 1, 2, 3].map((i) => box(1.15, 0.18, 0.32, Math.cos(i * PI / 2 + PI / 4) * 0.56, Math.sin(i * PI / 2 + PI / 4) * 0.56, 0, i * PI / 2 - PI / 4)), gem(0.3, 0.3, 0.3, 0, 0, 0, 0, 'ico'), ...mirror((s) => spike(0.1, 0.4, s * 0.95, 0, s * -PI / 2))],
  deckgun: () => [disc(0.85, 0.5, 0, 0, 0, 'hex'), box(0.9, 0.62, 0.5, 0, 0.05, 0.25), ...mirror((s) => part(P().cyl, s * 0.22, -0.78, 0.3, 0.13, 0.95, 0.13)), box(0.3, 0.25, 0.3, 0, 0.36, 0.5)],
  pod: () => [gem(0.8, 0.95, 0.8, 0, 0, 0, 0, 'sph'), ...[0, 1, 2, 3, 4, 5].map((i) => spike(0.1, 0.45, Math.cos(i * PI / 3) * 0.86, Math.sin(i * PI / 3) * 0.86, i * PI / 3 - PI / 2, 0, 'cone3')), gem(0.3, 0.3, 0.3, 0, -0.45, 0.5, 0, 'ico')],
  claw: () => [box(0.5, 1.2, 0.5, 0, 0.2), ...mirror((s) => spike(0.2, 0.85, s * 0.3, -0.7, PI + s * 0.4)), gem(0.25, 0.25, 0.4, 0, 0.5, 0.3, 0, 'ico')],
  tendril: () => [gem(0.5, 1.1, 0.5, 0, 0, 0, 0, 'dodeca'), spike(0.26, 0.8, 0, -1, PI, 0, 'cone3')],
  shard: () => [gem(0.5, 1.25, 0.3, 0, 0, 0, 0, 'octa'), gem(0.22, 0.6, 0.4, 0, 0, 0.1, 0, 'octa')],
  // ---- v2.8 main-mode enemies
  burster: () => [gem(0.9, 0.9, 0.7, 0, 0.1, 0, 0, 'ico'), ...[0, 1, 2, 3, 4, 5].map((i) => spike(0.14, 0.45, Math.cos(i * PI / 3) * 0.85, Math.sin(i * PI / 3) * 0.85 + 0.1, i * PI / 3 - PI / 2)), part(P().cyl, 0, -0.85, 0, 0.3, 0.5, 0.3)],
  sower: () => [box(1.5, 0.7, 0.6, 0, 0.35), ...mirror((s) => box(0.4, 1, 0.5, s * 0.8, 0.1, 0, s * 0.25)), gem(0.36, 0.36, 0.36, 0, -0.55, 0.2, 0, 'ico'), box(0.9, 0.18, 0.3, 0, -0.1)],
  binder: () => [gem(0.62, 1, 0.5, 0, 0, 0, 0, 'octa'), ...mirror((s) => box(0.7, 0.16, 0.2, s * 0.6, 0.1)), ...mirror((s) => gem(0.22, 0.22, 0.22, s * 1, 0.1, 0.1, 0, 'ico')), spike(0.16, 0.4, 0, -1, PI)],
  coil: () => [...[0, 1, 2].map((i) => ring(0.62 - i * 0.12, 0, 0.45 - i * 0.42, 0, 0.55)), gem(0.34, 0.5, 0.34, 0, -1, 0.1, 0, 'ico')],
  warper: () => [gem(0.5, 1.1, 0.4, 0, 0, 0, 0, 'octa'), ...mirror((s) => gem(0.35, 0.8, 0.2, s * 0.62, 0.15, 0, s * 0.5, 'octa')), ring(0.9, 0, 0, -0.1, 0.35)],
  turret: () => [disc(0.8, 0.5, 0, 0, 0, 'hex'), part(P().cyl, 0, -0.7, 0.1, 0.22, 1, 0.22), gem(0.4, 0.4, 0.5, 0, 0, 0.2, 0, 'ico')],
  armourPlate: () => [box(1.7, 0.7, 0.5, 0, 0), box(1.3, 0.35, 0.7, 0, -0.2)],
  wyrmSeg: () => [gem(0.95, 0.95, 0.7, 0, 0, 0, 0, 'dodeca'), ...mirror((s) => spike(0.2, 0.8, s * 0.9, 0, s * -PI / 2))],
  miniA: () => [gem(1, 0.7, 0.5), box(2, 0.25, 0.3, 0, 0.1), ...mirror((s) => box(0.3, 1.1, 0.5, s * 0.95, -0.1)), ...mirror((s) => spike(0.16, 0.6, s * 0.95, -0.9, PI)), box(0.4, 0.5, 0.7, 0, 0.4)],
  miniB: () => [box(1.2, 1.5, 0.6, 0, 0.1), spike(0.6, 0.7, 0, 1.1, 0, 0, 'cone4'), ...mirror((s) => box(0.3, 1.8, 0.4, s * 0.85, 0)), box(1.9, 0.2, 0.7, 0, -0.5), gem(0.3, 0.3, 0.5, 0, 0, 0.3, 0, 'ico')],
  miniC: () => [gem(0.8, 1, 0.6, 0, 0.1, 0, 0, 'ico'), ...mirror((s) => gem(1.1, 0.25, 0.1, s * 0.7, 0.3, 0, s * -0.7)), ...mirror((s) => gem(0.9, 0.2, 0.1, s * 0.6, -0.4, 0, s * -1.1)), spike(0.15, 0.7, 0, -1.1, PI)],
  miniD: () => [part(P().hex, 0, 0, 0, 1, 0.6, 1, 0, PI / 2), ...mirror((s) => part(P().cyl, s * 0.9, -0.2, 0, 0.25, 1.3, 0.25)), box(0.7, 0.7, 0.9, 0, 0), ...mirror((s) => box(0.5, 0.3, 0.3, s * 0.5, 0.8))],
  miniE: () => [gem(0.9, 1.1, 0.7, 0, 0, 0, 0, 'dodeca'), ...[0, 1, 2, 3, 4, 5].map((i) => spike(0.14, 0.9, Math.cos(i * PI / 3) * 1, Math.sin(i * PI / 3) * 1, i * PI / 3 - PI / 2))],
  miniF: () => [ring(1), ring(0.65, 0, 0, 0.1), gem(0.35, 0.35, 0.35, 0, 0, 0, 0, 'ico'), ...mirror((s) => spike(0.15, 0.6, s * 1.2, 0, s * -PI / 2))],
  // ---- Counterattack bosses
  bossScrap: () => [box(1.5, 1.1, 0.6, 0, 0.2), box(0.8, 0.5, 0.85, 0, 0.55), ...mirror((s) => box(0.3, 1.3, 0.4, s * 0.9, -0.1, 0, s * 0.2)), ...mirror((s) => spike(0.2, 0.7, s * 0.9, -0.9, PI + s * 0.3)), box(2.3, 0.2, 0.3, 0, -0.15), part(P().cyl, 0, -0.72, 0.1, 0.25, 0.6, 0.25), gem(0.3, 0.3, 0.4, 0, 0.1, 0.45, 0, 'ico')],
  bossShroud: () => [gem(0.5, 0.5, 0.5, 0, 0, 0.2, 0, 'ico'), ...[0, 1, 2, 3, 4, 5].map((i) => gem(0.36, 1.05, 0.38, Math.cos(i * PI / 3) * 0.56, Math.sin(i * PI / 3) * 0.56, 0, i * PI / 3 - PI / 2)), ...[0, 1, 2, 3, 4, 5].map((i) => gem(0.26, 0.72, 0.3, Math.cos(i * PI / 3 + PI / 6) * 0.82, Math.sin(i * PI / 3 + PI / 6) * 0.82, -0.1, i * PI / 3 + PI / 6 - PI / 2))],
  bossAdmiral: () => [box(1.6, 1.2, 0.6, 0, 0.15), box(0.9, 0.7, 0.9, 0, 0.35), box(0.5, 0.4, 1.3, 0, 0.45), ...mirror((s) => box(0.45, 1.5, 0.5, s * 1.05, 0)), spike(0.6, 0.7, 0, -1, PI, 0, 'cone4'), box(2.5, 0.18, 0.3, 0, 0.8), ...mirror((s) => part(P().cyl, s * 0.5, 0.9, 0.2, 0.08, 0.6, 0.08))],
  bossHeart: () => [gem(0.85, 0.9, 0.75, 0, 0, 0, 0, 'dodeca'), gem(0.55, 0.6, 0.5, 0, 0.15, 0.35, 0, 'ico'), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => spike(0.14, 0.55, Math.cos(i * PI / 4) * 0.86, Math.sin(i * PI / 4) * 0.86, i * PI / 4 - PI / 2, 0, 'cone3'))],
  bossUnmaker: () => [gem(0.6, 0.6, 0.6, 0, 0, 0, 0, 'sph'), ring(0.95), ...[0, 1, 2, 3, 4, 5].map((i) => spike(0.16, 0.9, Math.cos(i * PI / 3) * 1.05, Math.sin(i * PI / 3) * 1.05, i * PI / 3 - PI / 2, 0, 'cone4')), ring(1.3, 0, 0, 0, 0.25)],
  bossCarrier: () => [box(1.1, 1.7, 0.5, 0, 0.05), ...mirror((s) => box(0.55, 1.3, 0.4, s * 0.8, 0.2)), ...mirror((s) => box(0.3, 0.6, 0.5, s * 0.8, -0.65)), spike(0.55, 0.6, 0, -1.05, PI, 0, 'cone4'), box(0.5, 0.5, 0.75, 0, 0.5), ...mirror((s) => box(0.9, 0.12, 0.2, s * 1.1, 0.6, 0, s * 0.3))],
  bossBastion: () => [part(P().hex, 0, 0, 0, 1, 0.5, 1, 0, PI / 2), ring(1.15), box(0.6, 0.6, 0.8, 0, 0), ...[0, 1, 2, 3].map((i) => box(0.35, 0.35, 0.6, Math.cos(i * PI / 2 + PI / 4) * 0.95, Math.sin(i * PI / 2 + PI / 4) * 0.95))],
  bossWyrm: () => [gem(1, 1.1, 0.8, 0, 0, 0, 0, 'dodeca'), ...mirror((s) => spike(0.22, 1, s * 0.6, -0.95, PI + s * 0.35)), ...mirror((s) => spike(0.18, 0.9, s * 0.95, 0.4, s * -1.1)), gem(0.3, 0.3, 0.4, 0, -0.2, 0.5, 0, 'ico')],
  bossDread: () => [box(1.3, 1.9, 0.6, 0, 0), ...mirror((s) => box(0.5, 1.5, 0.5, s * 0.95, -0.1)), ...mirror((s) => part(P().cyl, s * 0.95, -1, 0.1, 0.16, 0.7, 0.16)), box(0.7, 0.6, 0.85, 0, 0.45), spike(0.5, 0.5, 0, -1.2, PI, 0, 'cone4'), box(2.3, 0.2, 0.3, 0, 0.75)],
  bossOracle: () => [gem(0.75, 0.75, 0.75, 0, 0, 0, 0, 'ico'), ring(1.1), ring(0.9, 0, 0, 0, 0.45), ...[0, 1, 2].map((i) => gem(0.2, 0.45, 0.2, Math.cos(i * 2.094 + PI / 2) * 1.1, Math.sin(i * 2.094 + PI / 2) * 1.1))],
  bossSing: () => [gem(0.62, 0.62, 0.62, 0, 0, 0, 0, 'sph'), ring(1.05), ring(1.25, 0, 0, 0, 0.3), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => spike(0.1, 0.5, Math.cos(i * PI / 4) * 1.35, Math.sin(i * PI / 4) * 1.35, i * PI / 4 - PI / 2))],
};
SHAPES.aegis2 = SHAPES.aegis;
export const SHAPE_IDS = Object.keys(SHAPES);
const cache = {};
export function shapeGeometry(id) { return cache[id] || (cache[id] = merge((SHAPES[id] || SHAPES.scout)())); }

/** Player ship pieces for one hull; the renderer shows more of them as the build grows. Faces +Y.
 *  Every hull fills the same material slots (hull, deck, cockpit, chassis, markings, lights, engine), so paint jobs
 *  recolour them all alike; the outboard upgrade hardware (wings, pods, armour, fins, crown) is shared. */
export function playerParts(ship = 'vanguard') {
  const base = (HULLS[ship] || HULLS.vanguard)();
  const out = {};
  for (const k in base) out[k] = merge(base[k]);
  Object.assign(out, {
    wings: merge(mirror(s => gem(.48, .65, .11, s * 1.28, -.52, -.02, s * -.32))),
    pods: merge([...mirror(s => box(.24, .85, .25, s * 1.47, -.14)), ...mirror(s => part(P().cyl, s * 1.47, .41, .03, .085, .5, .085))]),
    pods2: merge([...mirror(s => box(.17, .7, .2, s * .38, .33, .19)), ...mirror(s => part(P().cyl, s * .38, .83, .19, .065, .36, .065))]),
    armour: merge([...mirror(s => gem(.26, .67, .18, s * .78, -.28, .27)), box(.66, .2, .15, 0, -.73, .26)]),
    fins: merge(mirror(s => gem(.17, .72, .21, s * 1.8, -.5, .02, s * -.25))),
    crown: merge([ring(.32, 0, -.23, .43), ...mirror(s => gem(.1, .34, .1, s * 1.08, .2, .15))]),
  });
  return out;
}
/** Engine nozzles (x, y in model units) per hull: the renderer hangs exhaust flames from them. */
export const NOZZLES = {
  vanguard: [[-.62, -1.17], [.62, -1.17]],
  striker: [[0, -1.3]],
  bulwark: [[-.95, -1.28], [-.36, -1.17], [.36, -1.17], [.95, -1.28]],
  tempest: [[-.32, -1.2], [.32, -1.2]],
  revenant: [[-.3, -1.2], [.3, -1.2]],
};
/** Where the cosmetic banner is pinned on each hull. */
export const BANNER_PIN = { vanguard: -1.05, striker: -1.2, bulwark: -1.1, tempest: -1.12, revenant: -1.1 };

const HULLS = {
  // All-rounder: a clean arrowhead with swept wings, intakes and a dorsal spine.
  vanguard: () => ({
    hull: [gem(.49, 1.5, .27, 0, .32), box(.76, 1.05, .34, 0, -.32), ...mirror(s => gem(.7, .68, .15, s * .76, -.37, -.03, s * -.65)), ...mirror(s => box(.31, .96, .34, s * .62, -.48)), spike(.07, .5, 0, 1.95, 0)],
    deck: [gem(.28, .9, .14, 0, .62, .24), ...mirror(s => gem(.52, .42, .09, s * .77, -.27, .16, s * -.65)), ...mirror(s => box(.22, .7, .1, s * .62, -.4, .23)), ...mirror(s => gem(.26, .12, .06, s * .36, .72, .12, s * -.4))],
    cockpit: [gem(.21, .48, .19, 0, .26, .39)],
    chassis: [box(.9, .9, .18, 0, -.38, -.19), ...mirror(s => box(.26, .34, .34, s * .62, -.94)), ...mirror(s => box(.12, .67, .16, s * 1.11, -.23, .03)), ...mirror(s => box(.14, .3, .2, s * .38, .05, .22)), box(.08, .8, .1, 0, -.35, .36)],
    markings: [...mirror(s => box(.06, .39, .025, s * .64, -.22, .295)), ...mirror(s => box(.32, .06, .025, s * .89, -.4, .27)), box(.08, .33, .025, 0, 1.05, .30)],
    lights: [...mirror(s => box(.1, .15, .04, s * 1.15, -.05, .12)), box(.07, .21, .03, 0, -.38, .38), ...mirror(s => box(.05, .05, .05, s * .38, .22, .34))],
    engine: mirror(s => box(.18, .09, .2, s * .62, -1.12, .015)),
  }),
  // Glass cannon: a long needle with forward-swept blades and twin laser barrels.
  striker: () => ({
    hull: [gem(.3, 1.95, .22, 0, .45), gem(.42, .75, .28, 0, -.55), ...mirror(s => gem(.95, .2, .09, s * .72, -.3, 0, s * .38)), ...mirror(s => gem(.42, .12, .07, s * .3, .95, 0, s * .5)), spike(.05, .45, 0, 2.55, 0)],
    deck: [gem(.16, 1.2, .09, 0, .85, .17), ...mirror(s => gem(.62, .1, .05, s * .72, -.26, .07, s * .38)), gem(.3, .45, .12, 0, -.55, .2)],
    cockpit: [gem(.14, .46, .15, 0, .3, .24)],
    chassis: [box(.36, .5, .16, 0, -.9, -.1), ...mirror(s => part(P().cyl, s * .46, .45, .02, .05, 1.35, .05)), ...mirror(s => box(.12, .35, .14, s * .46, -.2, .02)), ...mirror(s => gem(.1, .45, .12, s * 1.2, .05, 0, s * .38))],
    markings: [...mirror(s => box(.035, .6, .02, s * .12, 1.05, .2)), ...mirror(s => box(.28, .045, .02, s * .7, -.22, .12, s * .38))],
    lights: [...mirror(s => box(.07, .18, .04, s * 1.33, .12, .06)), ...mirror(s => box(.05, .05, .05, s * .46, 1.14, .03)), box(.05, .3, .03, 0, -.62, .27)],
    engine: [box(.3, .1, .22, 0, -1.2, 0)],
  }),
  // Tank: a broad armoured slab with twin side hulls, a shield emitter dome and four engines.
  bulwark: () => ({
    hull: [box(1.25, 1.45, .46, 0, -.1), gem(.62, .8, .36, 0, .82), ...mirror(s => box(.46, 1.35, .52, s * .96, -.25)), ...mirror(s => gem(.35, .5, .3, s * .96, .55)), box(1.9, .22, .3, 0, .25, -.05)],
    deck: [box(.86, .95, .1, 0, -.1, .28), ...mirror(s => box(.3, 1.05, .08, s * .96, -.25, .3)), ...mirror(s => box(.5, .16, .08, s * .45, .5, .22))],
    cockpit: [gem(.26, .3, .17, 0, .58, .34)],
    chassis: [...mirror(s => box(.36, .38, .42, s * .96, -1.04)), ...mirror(s => box(.26, .3, .32, s * .36, -.95)), box(.36, .3, .3, 0, -.95), ...mirror(s => box(.1, .5, .2, s * 1.24, .15, .1)), ...mirror(s => box(.2, .2, .24, s * .55, -.55, .3))],
    markings: [...mirror(s => box(.06, .75, .02, s * .6, -.1, .34)), box(.6, .07, .02, 0, .36, .34), ...mirror(s => box(.2, .05, .02, s * .96, .1, .35)), ...mirror(s => box(.2, .05, .02, s * .96, -.05, .35))],
    lights: [gem(.24, .24, .12, 0, -.38, .38, 0, 'ico'), ...mirror(s => box(.08, .08, .06, s * 1.24, .45, .2))],
    engine: [...mirror(s => box(.24, .1, .22, s * .95, -1.24)), ...mirror(s => box(.18, .09, .2, s * .36, -1.12))],
  }),
  // Swarm control: a round coil-ship. A charged ring around a glowing core, three forward prongs.
  tempest: () => ({
    hull: [disc(.72, .34, 0, -.1, 0, 'hex'), gem(.34, .85, .24, 0, .62), ...mirror(s => gem(.3, .55, .16, s * .7, -.7, 0, s * -.4))],
    deck: [ring(.98, 0, -.1, 0), disc(.5, .1, 0, -.1, .19, 'hex')],
    cockpit: [gem(.26, .26, .26, 0, -.1, .3, 0, 'ico')],
    chassis: [spike(.1, .75, 0, 1.25, 0), ...mirror(s => spike(.09, .62, s * .5, .92, s * -.35)), box(.42, .3, .2, 0, -.98), ...mirror(s => box(.12, .12, .3, s * .98, -.1, .05))],
    markings: [...mirror(s => gem(.1, .22, .08, s * .98, -.1, .14)), gem(.1, .22, .08, 0, .88, .14), gem(.1, .22, .08, 0, -1.08, .14)],
    lights: [...mirror(s => box(.05, .05, .08, s * .5, 1.2, .05)), box(.05, .05, .08, 0, 1.6, .05), ...mirror(s => box(.06, .14, .04, s * .69, -.1, .2))],
    engine: mirror(s => box(.16, .09, .2, s * .32, -1.14)),
  }),
  // Boss hunter: a dark raptor between two long railgun spines, with a glowing charge channel.
  revenant: () => ({
    hull: [gem(.4, 1.25, .26, 0, -.25), ...mirror(s => gem(1.05, .46, .12, s * .78, -.55, 0, s * -.58)), ...mirror(s => box(.13, 2.05, .2, s * .22, .72)), ...mirror(s => gem(.35, .3, .1, s * 1.45, -.95, 0, s * -.9))],
    deck: [...mirror(s => gem(.55, .2, .07, s * .72, -.5, .1, s * -.58)), ...mirror(s => box(.06, 1.9, .06, s * .22, .72, .12))],
    cockpit: [gem(.16, .36, .16, 0, -.05, .26)],
    chassis: [box(.5, .6, .2, 0, -.82, -.1), ...mirror(s => box(.14, .38, .3, s * 1.32, -.85)), ...mirror(s => box(.2, .14, .26, s * .22, 1.72)), box(.46, .12, .16, 0, .35, 0)],
    markings: [...mirror(s => box(.3, .05, .02, s * .7, -.44, .16, s * -.58)), box(.05, .5, .02, 0, -.55, .24)],
    lights: [box(.07, 1.75, .05, 0, .82, .04), ...mirror(s => box(.06, .06, .06, s * .22, 1.82, .1)), ...mirror(s => box(.05, .14, .04, s * 1.5, -.9, .08))],
    engine: mirror(s => box(.2, .1, .2, s * .3, -1.14)),
  }),
};
export function unitBox() { return new (T().BoxGeometry)(1, 1, 1); }
export function droneGeometry() { return merge([gem(0.7, 1, 0.5), ...mirror((s) => box(0.8, 0.18, 0.15, s * 0.6, -0.2, 0, s * -0.4))]); }
/** Compact service craft with outboard grabber arms and two thrusters; faces +Y. */
export function supportCraftGeometry() { return merge([gem(.48, .73, .36, 0, .08), gem(.23, .35, .22, 0, .34, .24), ...mirror(s => gem(.54, .16, .12, s * .57, -.12, 0, s * -.42)), ...mirror(s => box(.16, .45, .16, s * .9, -.35, .02, s * -.18)), ...mirror(s => box(.17, .24, .22, s * .31, -.65, .04))]); }
