// The ship's cosmetic banner: a strip of cloth pinned under the tail. Its spine is a verlet chain pulled back by the
// slipstream (down the screen, as the ship flies up it) and rippled by a travelling flutter, so it trails, swings
// when the ship darts sideways and settles when it holds still. The strip is rebuilt from the spine each frame with a
// little twist, and lit, so the folds catch the light. Purely visual: it never touches game state.
import { G } from '@last-orbit/core/game.js';
import { BANNER_BY_ID } from '@last-orbit/data/banners.js';
import { paintBanner } from '@last-orbit/rendering/bannerArt.js';

const N = 14, LEN = 8, WID = 2.4, SEG = LEN / (N - 1);
const PULL = 240, FLUTTER = 75, DAMP = 0.975;

export class Banner {
  constructor(scene) {
    const THREE = window.THREE;
    this.px = new Float32Array(N); this.py = new Float32Array(N); this.ox = new Float32Array(N); this.oy = new Float32Array(N);
    const geo = (this.geo = new THREE.BufferGeometry()), uv = [], idx = [];
    for (let i = 0; i < N; i++) { const v = 1 - i / (N - 1); uv.push(0, v, 1, v); if (i < N - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    this.pos = new THREE.Float32BufferAttribute(new Float32Array(N * 6), 3); this.pos.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pos); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    this.canvas = document.createElement('canvas'); this.canvas.width = 128; this.canvas.height = 512;
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.anisotropy = 4;
    this.mat = new THREE.MeshLambertMaterial({ map: this.tex, side: THREE.DoubleSide, alphaTest: 0.5, emissive: 0x333333 });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.visible = false; scene.add(this.mesh);
    this.id = 'none'; this.reset = true; this.anchor = new THREE.Vector3();
  }
  setDesign(id) {
    const b = BANNER_BY_ID[id];
    // Banners that display a stat repaint when it changes, at most a few times a second.
    if (id === this.id) { if (b?.live && G.state.stats[b.live] !== this.shown && performance.now() - this.paintedAt > 250) this.paint(b); return; }
    this.id = id; this.reset = true; if (b?.shape) this.paint(b);
  }
  paint(b) {
    this.shown = b.live ? G.state.stats[b.live] || 0 : 0; this.paintedAt = performance.now();
    this.legendary = b.rarity === 'legendary'; this.accent = new window.THREE.Color(b.colors[1]);
    paintBanner(this.canvas.getContext('2d'), b, this.canvas.width, this.canvas.height, this.shown); this.tex.needsUpdate = true;
  }
  /** ship: the player's Three.js group (already positioned); dt: simulated seconds (0 while paused). */
  update(ship, dt, t, visible) {
    if (!visible || !BANNER_BY_ID[this.id]?.shape) { this.mesh.visible = false; this.reset = true; return; }
    this.mesh.visible = true;
    if (this.legendary) this.mat.emissive.copy(this.accent).multiplyScalar(0.22 + 0.14 * Math.sin(t * 3.2)); else this.mat.emissive.setHex(0x333333);
    const { px, py, ox, oy } = this, a = this.anchor.set(0, -1.05, 0).applyMatrix4(ship.matrixWorld), ax = a.x, ay = a.y;
    if (this.reset || Math.hypot(ax - px[0], ay - py[0]) > 12) { for (let i = 0; i < N; i++) { px[i] = ox[i] = ax; py[i] = oy[i] = ay - i * SEG; } this.reset = false; }
    const h = Math.min(dt, 1 / 30) / 2;
    for (let s = 0; h > 0 && s < 2; s++) {
      const tt = t + s * h;
      for (let i = 1; i < N; i++) {
        const k = i / (N - 1), vx = (px[i] - ox[i]) * DAMP, vy = (py[i] - oy[i]) * DAMP; ox[i] = px[i]; oy[i] = py[i];
        const fx = (Math.sin(tt * 8.5 - i * 0.75) + 0.35 * Math.sin(tt * 13.7 - i * 1.4)) * FLUTTER * k;
        px[i] += vx + fx * h * h; py[i] += vy - PULL * h * h;
      }
      px[0] = ox[0] = ax; py[0] = oy[0] = ay;
      for (let it = 0; it < 4; it++) for (let i = 1; i < N; i++) {
        const dx = px[i] - px[i - 1], dy = py[i] - py[i - 1], d = Math.hypot(dx, dy) || 1e-4, e = (d - SEG) / d;
        if (i === 1) { px[i] -= dx * e; py[i] -= dy * e; } else { px[i] -= dx * e * 0.5; py[i] -= dy * e * 0.5; px[i - 1] += dx * e * 0.5; py[i - 1] += dy * e * 0.5; }
      }
    }
    // Skin the spine: a strip across it, twisting slightly along its length so the cloth folds.
    const P = this.pos.array;
    for (let i = 0; i < N; i++) {
      const j0 = Math.max(0, i - 1), j1 = Math.min(N - 1, i + 1); let tx = px[j1] - px[j0], ty = py[j1] - py[j0]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const k = i / (N - 1), hw = WID / 2, nx = ty * hw, ny = -tx * hw;
      const z = -0.9 + Math.sin(t * 7 - i * 0.9) * 0.35 * k, tw = Math.sin(t * 5.3 - i * 0.6) * 0.55 * k, sq = 1 - 0.18 * Math.abs(Math.sin(t * 5.3 - i * 0.6)) * k;
      P[i * 6] = px[i] + nx * sq; P[i * 6 + 1] = py[i] + ny * sq; P[i * 6 + 2] = z + tw;
      P[i * 6 + 3] = px[i] - nx * sq; P[i * 6 + 4] = py[i] - ny * sq; P[i * 6 + 5] = z - tw;
    }
    this.pos.needsUpdate = true; this.geo.computeVertexNormals();
  }
}
