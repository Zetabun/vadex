// Cheap glow: everything luminous (bullets, beams, explosions, particles, telegraphs) is an additive instanced quad.
// One SpriteBatch = one draw call. Matrices and colours are written straight into the instance buffers: no per-sprite objects.
const T = () => window.THREE;
const colCache = new Map();
export function rgb(c) {
  let v = colCache.get(c); if (v) return v;
  let n = typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : (c | 0); if (typeof c === 'string' && c.length === 4) { const s = c.slice(1); n = parseInt(s[0] + s[0] + s[1] + s[1] + s[2] + s[2], 16); }
  v = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; colCache.set(c, v); return v;
}
export const css = (c) => (typeof c === 'string' ? c : '#' + (c | 0).toString(16).padStart(6, '0'));

function tex(draw, w = 64, h = 64) { const THREE = T(), cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; }
export function makeTextures() {
  return {
    soft: tex((g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)'); r.addColorStop(0.6, 'rgba(255,255,255,0.12)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }),
    streak: tex((g, w, h) => { const img = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = 1 - Math.abs(y - h / 2 + 0.5) / (h / 2), u = Math.min(1, Math.min(x, w - 1 - x) / 6); const a = Math.pow(Math.max(0, v), 2.2) * u; const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255; } g.putImageData(img, 0, 0); }, 64, 32),
    ring: tex((g, w) => { g.strokeStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8; g.lineWidth = 5; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 10, 0, 6.3); g.stroke(); }, 128, 128),
    reticle: tex((g, w) => { g.strokeStyle = '#fff'; g.lineWidth = 6; g.shadowColor = '#fff'; g.shadowBlur = 6; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 12, i * Math.PI / 2 + 0.3, i * Math.PI / 2 + 1.27); g.stroke(); } }, 128, 128),
    ore: tex((g, w) => { g.translate(w / 2, w / 2); g.fillStyle = '#fff'; g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-18,-8); g.lineTo(-8,-21); g.lineTo(10,-17); g.lineTo(21,-3); g.lineTo(13,16); g.lineTo(-5,22); g.lineTo(-20,9); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(-9,-8); g.lineTo(4,-14); g.lineTo(11,-4); g.lineTo(1,2); g.closePath(); g.fill(); }, 64, 64),
  };
}

export class SpriteBatch {
  constructor(texture, cap, additive = true, z = 0) {
    const THREE = T(); this.cap = cap; this.n = 0; this.z = z;
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const m = (this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, cap));
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); m.frustumCulled = false; m.count = 0; m.renderOrder = additive ? 10 : 5;
    this.ma = m.instanceMatrix.array; this.ca = m.instanceColor.array;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  }
  begin() { this.n = 0; }
  /** c: [r,g,b] 0..1, a: intensity multiplier */
  add(x, y, sx, sy, rot, c, a = 1, z = this.z) {
    if (this.n >= this.cap) return; const i = this.n++, o = i * 16, m = this.ma, cs = rot ? Math.cos(rot) : 1, sn = rot ? Math.sin(rot) : 0;
    m[o] = cs * sx; m[o + 1] = sn * sx; m[o + 2] = 0; m[o + 3] = 0; m[o + 4] = -sn * sy; m[o + 5] = cs * sy; m[o + 6] = 0; m[o + 7] = 0; m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = 1; m[o + 11] = 0; m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
    const k = i * 3; this.ca[k] = c[0] * a; this.ca[k + 1] = c[1] * a; this.ca[k + 2] = c[2] * a;
  }
  /** A streak from (x1,y1) to (x2,y2). */
  line(x1, y1, x2, y2, width, c, a = 1) { const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy); if (len < 0.01) return; this.add((x1 + x2) / 2, (y1 + y2) / 2, len, width, Math.atan2(dy, dx), c, a); }
  // Upload only the instances written this frame; the rest of the buffer is never drawn.
  end() {
    const m = this.mesh, n = this.n; m.count = n; if (!n && !this.last) return; this.last = n;
    const mi = m.instanceMatrix, ci = m.instanceColor; mi.updateRange.offset = 0; mi.updateRange.count = n * 16; ci.updateRange.offset = 0; ci.updateRange.count = n * 3;
    mi.needsUpdate = true; ci.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ particles (struct of arrays, swap-remove)
const PARTICLE_FIELDS = ['x', 'y', 'vx', 'vy', 'life', 'max', 'size', 'r', 'g', 'b', 'drag'];
export class Particles {
  constructor(cap) { this.cap = cap; this.n = 0; this.scale = 1; for (const k of PARTICLE_FIELDS) this[k] = new Float32Array(cap); }
  emit(x, y, vx, vy, life, size, c, drag = 1.5) { let i = this.n; if (i >= this.cap) i = (Math.random() * this.cap) | 0; else this.n++; this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy; this.life[i] = this.max[i] = life; this.size[i] = size; this.r[i] = c[0]; this.g[i] = c[1]; this.b[i] = c[2]; this.drag[i] = drag; }
  burst(x, y, count, c, speed, size, life) { count = Math.max(1, Math.round(count * this.scale)); for (let i = 0; i < count; i++) { const a = Math.random() * 6.283, s = speed * (0.25 + Math.random()); this.emit(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.5 + Math.random() * 0.7), size * (0.6 + Math.random() * 0.8), c); } }
  update(dt) { for (let i = this.n - 1; i >= 0; i--) { this.life[i] -= dt; if (this.life[i] <= 0) { const l = --this.n; if (i !== l) for (const k of PARTICLE_FIELDS) this[k][i] = this[k][l]; continue; } const d = Math.max(0, 1 - this.drag[i] * dt); this.vx[i] *= d; this.vy[i] *= d; this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; } }
  draw(batch) { const c = [0, 0, 0]; for (let i = 0; i < this.n; i++) { const t = this.life[i] / this.max[i]; c[0] = this.r[i]; c[1] = this.g[i]; c[2] = this.b[i]; const s = this.size[i] * (0.4 + t * 0.6); batch.add(this.x[i], this.y[i], s, s, 0, c, t * 1.4); } }
}

/** Short-lived drawn effects: beams, lightning arcs, shock rings, flashes. */
export class Transients {
  constructor() { this.list = []; }
  add(o) { if (this.list.length < 160) this.list.push(o); }
  update(dt) { const L = this.list; for (let i = L.length - 1; i >= 0; i--) { const o = L[i]; o.t += dt; if (o.k === 'ore') { o.vy -= 48 * dt; o.vx *= Math.max(0, 1 - dt * 0.8); o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt; } if (o.t >= o.life) { L[i] = L[L.length - 1]; L.pop(); } } }
  draw(B) {
    for (const o of this.list) { const k = 1 - o.t / o.life;
      if (o.k === 'beam') { B.streak.line(o.x1, o.y1, o.x2, o.y2, o.w * (0.6 + k * 1.6), o.c, k * 1.2); B.streak.line(o.x1, o.y1, o.x2, o.y2, o.w * 0.5, WHITE, k); }
      else if (o.k === 'arc') { const pts = o.pts; for (let i = 0; i < pts.length - 2; i += 2) { B.streak.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], 2.4, o.c, k * 1.3); B.streak.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], 0.8, WHITE, k); } }
      else if (o.k === 'ring') { const r = o.r * (0.25 + (1 - k * k) * 0.95) * 2.3; B.ring.add(o.x, o.y, r, r, 0, o.c, k * 1.2); }
      else if (o.k === 'flash') { const r = o.r * (1 + (1 - k) * 0.6) * 2; B.soft.add(o.x, o.y, r, r, 0, o.c, k * k * o.a); }
      else if (o.k === 'ore') { const s = o.size * (0.8 + k * 0.25); B.ore.add(o.x, o.y, s, s, o.rot, o.c, Math.min(1, k * 1.8)); }
    }
  }
}
export const WHITE = [1, 1, 1];
export function jagged(x1, y1, x2, y2) { const n = Math.max(2, Math.min(7, Math.round(Math.hypot(x2 - x1, y2 - y1) / 7))), pts = [x1, y1], nx = -(y2 - y1), ny = x2 - x1, l = Math.hypot(nx, ny) || 1; for (let i = 1; i < n; i++) { const t = i / n, j = (Math.random() - 0.5) * 5; pts.push(x1 + (x2 - x1) * t + (nx / l) * j, y1 + (y2 - y1) * t + (ny / l) * j); } pts.push(x2, y2); return pts; }
