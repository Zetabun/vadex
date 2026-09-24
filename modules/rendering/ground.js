// The home world's surface for Counterattack's Liftoff stage: a city that scrolls beneath the ship (a tiled street
// texture plus instanced buildings that rise toward the camera), then falls away and fades as the ship climbs to orbit.
// Purely visual: gun towers that shoot at the ship are ordinary enemies moving at the same speed (GROUND_SPEED).
import { GROUND_SPEED } from '@last-orbit/data/counter.js';

const N = 70, Z = -10, SPAN = 230, H = 300;

function cityTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#1b2433'; g.fillRect(0, 0, 256, 512);
  let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // blocks between streets
  for (let y = 0; y < 512; y += 64) for (let x = 0; x < 256; x += 64) {
    g.fillStyle = ['#243044', '#212b3c', '#2a3446', '#1f2a2a'][Math.floor(r() * 4)]; g.fillRect(x + 6, y + 6, 52, 52);
    if (r() < 0.25) { g.strokeStyle = '#ffc857'; g.lineWidth = 2; g.beginPath(); g.arc(x + 32, y + 32, 14, 0, 7); g.stroke(); g.fillStyle = '#ffc857'; g.fillRect(x + 30, y + 22, 4, 20); g.fillRect(x + 22, y + 30, 20, 4); } // landing pad
  }
  // streets and their lights
  g.fillStyle = '#10151f'; for (let i = 0; i < 256; i += 64) g.fillRect(i - 3, 0, 6, 512); for (let j = 0; j < 512; j += 64) g.fillRect(0, j - 3, 256, 6);
  for (let i = 0; i < 90; i++) { g.fillStyle = r() < 0.5 ? '#5ee6ff' : '#ffd79a'; g.globalAlpha = 0.5 + r() * 0.5; const along = r() < 0.5; const a = Math.floor(r() * 5) * 64, b = r() * 512; g.fillRect(along ? a - 1 : b % 256, along ? b : a - 1, 2, 2); }
  g.globalAlpha = 1;
  return c;
}

export class Ground {
  constructor(scene) {
    const THREE = window.THREE;
    this.tex = new THREE.CanvasTexture(cityTexture()); this.tex.wrapS = this.tex.wrapT = THREE.RepeatWrapping; this.tex.repeat.set(1, 2);
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(150, H), new THREE.MeshLambertMaterial({ map: this.tex, color: 0x4a5264, transparent: true, emissive: 0x05070c }));
    this.plane.position.set(0, 75, Z); this.plane.renderOrder = -5;
    this.bmat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x04060c, transparent: true });
    this.blds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.bmat, N); this.blds.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.blds.frustumCulled = false; this.blds.renderOrder = -4;
    this.group = new THREE.Group(); this.group.add(this.plane, this.blds); this.group.visible = false; scene.add(this.group);
    this.items = []; this.dummy = new THREE.Object3D(); this.col = new THREE.Color(); this.lit = new THREE.Color(0x3d6f8a);
    for (let i = 0; i < N; i++) this.items.push(this.spawn({}, -40 + Math.random() * SPAN));
  }
  spawn(b, y) {
    const tall = Math.random() < 0.18;
    b.x = (Math.random() - 0.5) * 120; b.y = y; b.w = 4 + Math.random() * 7; b.d = 4 + Math.random() * 7; b.h = tall ? 12 + Math.random() * 10 : 2 + Math.random() * 6;
    b.c = [0x232b3b, 0x2b3446, 0x1e2533, 0x313b4f, 0x27303f][Math.floor(Math.random() * 5)]; b.lit = Math.random() < 0.3;
    return b;
  }
  /** show: whether the stage has ground; fade: 1 on the surface → 0 in orbit; dt: simulated seconds. */
  update(show, fade, dt) {
    this.group.visible = show && fade > 0.01; if (!this.group.visible) return;
    const move = GROUND_SPEED * dt;
    this.tex.offset.y += move / H * this.tex.repeat.y;
    // As the ship climbs, the surface drops away and dims.
    const sink = (1 - fade) * 70; this.group.position.z = -sink; this.plane.material.opacity = fade; this.bmat.opacity = fade;
    const d = this.dummy;
    for (let i = 0; i < N; i++) {
      const b = this.items[i]; b.y -= move; if (b.y < -45) this.spawn(b, b.y + SPAN);
      d.position.set(b.x, b.y, Z + b.h / 2); d.scale.set(b.w, b.d, b.h); d.rotation.set(0, 0, 0); d.updateMatrix(); this.blds.setMatrixAt(i, d.matrix);
      this.col.setHex(b.c); if (b.lit) this.col.lerp(this.lit, 0.3); this.blds.setColorAt(i, this.col);
    }
    this.blds.instanceMatrix.needsUpdate = true; this.blds.instanceColor.needsUpdate = true;
  }
}
