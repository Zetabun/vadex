// A room aboard the station to walk around (the Command Deck, Defence Control): its shell (floor, walls, ceiling, a
// window in the front wall), doors, walking, looking and tapping. Drag to look, tap the floor to walk there, tap an
// exhibit to inspect it (the UI shows the details). W/A/S/D walk. Each room builds its exhibits on top.
import { artSvg } from '@last-orbit/ui/art.js';
const T = () => window.THREE;
export const EYE = 1.6, SPEED = 2.4;

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function tex(c, repeat) { const THREE = T(), t = new THREE.CanvasTexture(c); t.anisotropy = 4; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; }
/** An icon from the game's art set, drawn into a canvas once it has loaded (the SVG's colour variables inlined). */
export function drawArt(key, ctx, x, y, s, done) {
  const src = artSvg(key), a = /--ic-a:([^;"]+)/.exec(src)?.[1] || '#5ee6ff', b = /--ic-b:([^;"]+)/.exec(src)?.[1] || '#2f6fa8';
  const style = `<style>.a{fill:${a}}.b{fill:${b}}.c{fill:#0b1330}.w{fill:#fff}.f{fill:#ffcf5e}.r{fill:#ff4d7a}.a,.b,.c,.w,.f,.r{stroke:#040816;stroke-width:2.5;stroke-linejoin:round;paint-order:stroke}.s,.t,.k{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:4}.s{stroke:${a}}.t{stroke:${b}}.k{stroke:#fff;stroke-width:2.5}.g{opacity:.3}</style>`;
  const svg = src.replace(/<svg([^>]*)>/, `<svg$1 xmlns="http://www.w3.org/2000/svg" width="64" height="64">${style}`).replace(/style="[^"]*"/, '');
  const img = new Image(); img.onload = () => { ctx.drawImage(img, x, y, s, s); done?.(); }; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
export function text(ctx, str, x, y, font, color, align = 'center') { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(str, x, y); }
const hexCss = (n) => '#' + n.toString(16).padStart(6, '0');

export class Room {
  /** w: half the width (x -w..w); front: the window wall's z; back: the back wall's z; h: the ceiling. start: [x, z, yaw]. */
  constructor({ w, front, back, h, start = [0, 3.2, 0] }) {
    const THREE = T(); this.W = w; this.FRONT = front; this.BACK = back; this.H = h;
    this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(72, 1, 0.1, 2200); this.cam.rotation.order = 'YXZ';
    this.pos = new THREE.Vector3(start[0], 0, start[1]); this.yaw = start[2] || 0; this.pitch = 0.02; this.target = null; this.keys = {}; this.t = 0; this.sig = ''; this.exhibits = []; this.ray = new THREE.Raycaster();
    this.solids = []; this.blocks = []; // what you cannot walk through: circles { x, z, r } and boxes { x0, x1, z0, z1 }
  }
  // ---------------------------------------------------------------- the room
  /** Floor, ceiling and walls, the window in the front wall (its frame, struts and glass), glowing strips along the floor
   *  and round the window, ceiling light panels and their lamps, ribs and beams, and a cove light round the top.
   *  look: colours and where things go (see the Command Deck and Defence Control for the two looks). */
  shell(look) {
    const THREE = T(), S = this.scene, { W, FRONT, BACK, H } = this, L = look, win = L.window;
    this.hemi = new THREE.HemisphereLight(L.sky ?? 0xcfe0ff, 0x1a1830, L.hemi ?? 0.55); S.add(this.hemi); S.add(new THREE.AmbientLight(0x405070, L.ambient ?? 0.35)); this.lamps = [];
    const sun = new THREE.DirectionalLight(0xfff2dd, L.sun ?? 0.7); sun.position.set(-3, 4, -10); S.add(sun);
    for (const z of L.lamps) { const l = new THREE.PointLight(L.lamp ?? 0xffe6c4, L.lampI ?? 0.55, 9, 1.6); l.position.set(0, H - 0.3, z); S.add(l); this.lamps.push(l); }
    const floorC = canvas(256, 256), f = floorC.getContext('2d');
    f.fillStyle = L.floor; f.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 200; i++) { f.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`; f.fillRect(Math.random() * 256, Math.random() * 256, 20, 20); }
    f.strokeStyle = '#0c111c'; f.lineWidth = 4; for (let i = 0; i <= 256; i += 128) { f.beginPath(); f.moveTo(i, 0); f.lineTo(i, 256); f.stroke(); f.beginPath(); f.moveTo(0, i); f.lineTo(256, i); f.stroke(); }
    f.fillStyle = L.stud ?? '#3a455c'; for (const [x, y] of [[10, 10], [118, 10], [10, 118], [118, 118]]) for (const [dx, dy] of [[0, 0], [128, 0], [0, 128], [128, 128]]) f.fillRect(x + dx - 2, y + dy - 2, 4, 4);
    const wallC = canvas(256, 256), w = wallC.getContext('2d');
    w.fillStyle = L.wall; w.fillRect(0, 0, 256, 256); w.strokeStyle = '#1a2031'; w.lineWidth = 3;
    for (let x = 0; x <= 256; x += 64) { w.beginPath(); w.moveTo(x, 0); w.lineTo(x, 256); w.stroke(); } w.beginPath(); w.moveTo(0, 170); w.lineTo(256, 170); w.stroke();
    w.fillStyle = L.tick ?? 'rgba(94,230,255,.18)'; for (let x = 30; x < 256; x += 64) w.fillRect(x, 176, 4, 12);
    const ceilC = canvas(256, 256), c = ceilC.getContext('2d'); c.fillStyle = L.ceil ?? '#20283a'; c.fillRect(0, 0, 256, 256); c.strokeStyle = '#141a28'; c.lineWidth = 3; for (let i = 0; i <= 256; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke(); }
    const Ph = (o) => new THREE.MeshPhongMaterial(o), D = BACK - FRONT;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, D), Ph({ map: tex(floorC, [W, D / 2]), specular: 0x33415c, shininess: 40 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (FRONT + BACK) / 2); S.add(floor); this.floor = floor;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, D), Ph({ map: tex(ceilC, [W, D / 2]), shininess: 5 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, (FRONT + BACK) / 2); S.add(ceil);
    const wallMat = Ph({ map: tex(wallC, [D / 2, 1.4]), specular: 0x222a3a, shininess: 18 });
    const wall = (w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat); m.position.set(x, y, z); m.rotation.y = ry; S.add(m); return m; };
    wall(D, H, -W, H / 2, (FRONT + BACK) / 2, Math.PI / 2); wall(D, H, W, H / 2, (FRONT + BACK) / 2, -Math.PI / 2); wall(2 * W, H, 0, H / 2, BACK, Math.PI);
    // the window wall: an opening from x -hw..hw, y y0..y1, framed, with struts and faint glass
    const frame = (this.frameMat = Ph({ color: L.frame ?? 0x3a4560, specular: 0x556680, shininess: 50 })), box = (this.box = (w, h, d, x, y, z, m = frame, parent = S) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); parent.add(b); return b; });
    const { hw, y0, y1 } = win, mid = (y0 + y1) / 2;
    // (a centimetre short of the walls, floor and ceiling so no two faces share a plane and flicker)
    box(2 * W - 0.02, y0 - 0.01, 0.3, 0, y0 / 2, FRONT); box(2 * W - 0.02, H - y1 - 0.01, 0.3, 0, (y1 + H) / 2, FRONT); for (const s of [-1, 1]) box(W - hw - 0.01, H - 0.02, 0.3, s * (hw + (W - hw) / 2), H / 2, FRONT);
    for (const x of win.struts) box(0.16, y1 - y0, 0.24, x, mid, FRONT);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2 * hw, y1 - y0), Ph({ color: 0x9fd8ff, transparent: true, opacity: 0.06, specular: 0xffffff, shininess: 120, depthWrite: false })); glass.position.set(0, mid, FRONT + 0.02); S.add(glass);
    // glowing strips along the floor edges and round the window
    const strip = (this.stripMat = new THREE.MeshBasicMaterial({ color: L.strip ?? 0x5ee6ff }));
    for (const s of [-1, 1]) box(0.05, 0.04, D, s * (W - 0.03), 0.06, (FRONT + BACK) / 2, strip);
    box(2 * hw, 0.04, 0.05, 0, y0 + 0.02, FRONT + 0.17, strip); box(2 * hw, 0.04, 0.05, 0, y1 - 0.02, FRONT + 0.17, strip);
    // ceiling light panels
    const lightMat = (this.lightMat = new THREE.MeshBasicMaterial({ color: L.panel ?? 0xfff1d8 }));
    for (const z of L.lamps) { const p = new THREE.Mesh(new THREE.PlaneGeometry(L.panelW ?? 2.4, 0.5), lightMat); p.rotation.x = Math.PI / 2; p.position.set(0, H - 0.025, z); S.add(p); }
    // structure: ribs down the side walls, beams across the ceiling, and a cove light along the top of the walls
    const rib = Ph({ color: L.rib ?? 0x323c55, specular: 0x4a5a78, shininess: 30 }), cove = (this.coveMat = new THREE.MeshBasicMaterial({ color: L.cove ?? L.strip ?? 0x5ee6ff, transparent: true, opacity: 0.7 }));
    for (const z of L.ribs) { for (const s of [-1, 1]) box(0.14, H, 0.22, s * (W - 0.07), H / 2, z, rib); box(2 * W, 0.16, 0.22, 0, H - 0.08, z, rib); }
    for (const s of [-1, 1]) box(0.03, 0.03, D, s * (W - 0.05), H - 0.2, (FRONT + BACK) / 2, cove); box(2 * W, 0.03, 0.03, 0, H - 0.2, BACK - 0.05, cove);
    // where a tap on the floor is taking you
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 32), new THREE.MeshBasicMaterial({ color: L.strip ?? 0x5ee6ff, transparent: true, opacity: 0 })); this.marker.rotation.x = -Math.PI / 2; this.marker.position.y = 0.02; S.add(this.marker);
  }
  /** A door set into a wall, its sign above: at (x, z) on the floor, facing into the room along ry (0: the back wall,
   *  π/2: the right wall, -π/2: the left wall). sealed: shut, with a red light. Tapping it is exhibit kind. */
  door(parent, x, z, ry, label, kind, { sealed = false, sign = '#9ff0ff', edge = 0x5ee6ff } = {}) {
    const THREE = T(), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
    const Ph = (o) => new THREE.MeshPhongMaterial(o), part = (w, h, d, px, py, pz, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(px, py, pz); g.add(b); return b; };
    const panelMat = Ph({ color: sealed ? 0x2e3548 : 0x3d4964, specular: 0x6a7c9e, shininess: 45 }), trimMat = Ph({ color: 0x232b3e, shininess: 20 }), frame = this.frameMat;
    for (const s of [-1, 1]) { part(0.64, 2.3, 0.08, s * 0.33, 1.15, -0.05, panelMat); part(0.08, 1.5, 0.02, s * 0.2, 1.2, -0.1, trimMat); }
    part(1.6, 0.16, 0.2, 0, 2.38, -0.08, frame); for (const s of [-1, 1]) part(0.16, 2.46, 0.2, s * 0.74, 1.23, -0.08, frame);
    part(0.02, 2.3, 0.03, 0, 1.15, -0.1, new THREE.MeshBasicMaterial({ color: sealed ? 0x55303a : edge }));
    if (sealed) for (const y of [0.7, 1.6]) part(1.2, 0.1, 0.03, 0, y, -0.11, new THREE.MeshBasicMaterial({ color: 0x3a2a1a }));
    const lamp = part(0.12, 0.12, 0.03, 0.55, 1.25, -0.2, new THREE.MeshBasicMaterial({ color: sealed ? 0xff4d6a : 0x6dffc8 }));
    const k = label.length > 12 ? 1.5 : 1, cw = Math.round(256 * k), c = canvas(cw, 64), x2 = c.getContext('2d'); // a long name gets a wider sign
    x2.fillStyle = '#081222'; x2.fillRect(0, 0, cw, 64); x2.strokeStyle = sealed ? '#6a3444' : hexCss(edge); x2.lineWidth = 3; x2.strokeRect(2, 2, cw - 4, 60);
    text(x2, label, cw / 2, 33, `800 ${k > 1 ? 26 : 30}px sans-serif`, sealed ? '#8a5a66' : sign);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(k, 0.25), new THREE.MeshBasicMaterial({ map: tex(c) })); s.position.set(0, 2.66, -0.12); s.rotation.y = Math.PI; g.add(s);
    this.hitBox(g, 1.6, 2.8, 0.4, 0, 1.4, -0.2); this.tag(g, kind); g.userData.lamp = lamp; g.userData.sealed = sealed; return g;
  }
  /** Breathe a door's light (open: green; sealed: a slow red). */
  doorLight(g) { const l = g?.userData.lamp; if (!l) return; const k = 0.6 + 0.4 * Math.sin(this.t * (g.userData.sealed ? 1.2 : 2.5)); if (g.userData.sealed) l.material.color.setRGB(k, 0.3 * k, 0.4 * k); else l.material.color.setRGB(0.43 * k, k, 0.78 * k); }
  /** An invisible box that makes a whole exhibit easy to tap (gaps and all). */
  hitBox(parent, w, h, d, x, y, z) { const THREE = T(), m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); m.position.set(x, y, z); parent.add(m); return m; }
  tag(obj, kind) { obj.traverse((o) => { o.userData.exhibit = kind; }); this.exhibits.push(obj); }
  untag(group) { this.exhibits = this.exhibits.filter((o) => o !== group && !group.children.includes(o)); }
  label(str, w, h, color) {
    const THREE = T(), c = canvas(512, Math.max(32, Math.round(512 * h / w))); text(c.getContext('2d'), str, 256, c.height / 2, `800 ${Math.round(c.height * 0.62)}px sans-serif`, color);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true }));
  }
  /** A flat screen on a wall, drawn from a canvas (redrawn by setting its map again). */
  screen(parent, c, w, h, x, y, z, ry, bezel = 0x1a2030) {
    const THREE = T(), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(c) })); m.position.z = 0.045; g.add(m);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.06), new THREE.MeshPhongMaterial({ color: bezel, shininess: 40 })); b.position.z = 0.01; g.add(b);
    g.userData.face = m; return g;
  }
  // ---------------------------------------------------------------- moving and looking
  look(dx, dy) { this.yaw -= dx * 0.0055; this.pitch = Math.max(-0.9, Math.min(0.75, this.pitch - dy * 0.0045)); }
  /** Anything else a tap can land on besides the tagged exhibits (the station hologram), and what it counts as. */
  pickExtra() { return []; }
  /** A tap at normalised device coords: an exhibit's id, or a walk to a spot on the floor. */
  pick(nx, ny) {
    this.ray.setFromCamera({ x: nx, y: ny }, this.cam);
    const extra = this.pickExtra(), hit = this.ray.intersectObjects([...this.exhibits, ...extra.map((e) => e.obj)], true)[0], floor = this.ray.intersectObject(this.floor)[0];
    if (hit && !hit.object.userData.exhibit) hit.object.userData.exhibit = extra.find((e) => { let o = hit.object; while (o && o !== e.obj) o = o.parent; return o; })?.kind; // parts rebuilt as it grows
    if (hit && hit.object.userData.exhibit && (!floor || hit.distance <= floor.distance + 0.01)) return { exhibit: hit.object.userData.exhibit };
    if (floor) { this.target = this.clamp(floor.point.x, floor.point.z); this.marker.position.x = this.target.x; this.marker.position.z = this.target.z; this.marker.material.opacity = 1; return { walk: true }; }
    return null;
  }
  /** Where you would end up: inside the walls, round the furniture. */
  clamp(x, z) {
    const { W, FRONT, BACK } = this, near = this.nearFront ?? 1.1;
    x = Math.max(-W + 0.6, Math.min(W - 0.6, x)); z = Math.max(FRONT + near, Math.min(BACK - 0.6, z));
    for (const s of this.solids) { const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz); if (d < s.r) { if (d > 1e-3) { x = s.x + dx / d * s.r; z = s.z + dz / d * s.r; } else x = s.x + s.r; } }
    // out of a box by its nearest side
    for (const b of this.blocks) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) {
      const out = [[b.x1 - x, 'x', b.x1], [x - b.x0, 'x', b.x0], [b.z1 - z, 'z', b.z1], [z - b.z0, 'z', b.z0]].filter((o) => !(o[1] === 'x' ? Math.abs(o[2]) > W - 0.6 : o[2] < FRONT + near || o[2] > BACK - 0.6)).sort((a, c) => a[0] - c[0])[0];
      if (out) { if (out[1] === 'x') x = out[2]; else z = out[2]; }
    }
    return { x, z };
  }
  resize(w, h) { this.cam.aspect = w / Math.max(1, h); this.cam.updateProjectionMatrix(); }
  /** Keys walk relative to where you are looking; a tap target walks you there. Places the camera. */
  walk(dt) {
    this.t += dt;
    const k = this.keys, fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), mv = (k.f ? 1 : 0) - (k.b ? 1 : 0), st = (k.r ? 1 : 0) - (k.l ? 1 : 0);
    if (mv || st) { this.target = null; const n = this.clamp(this.pos.x + (fx * mv - fz * st) * SPEED * dt, this.pos.z + (fz * mv + fx * st) * SPEED * dt); this.pos.x = n.x; this.pos.z = n.z; }
    else if (this.target) { const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, d = Math.hypot(dx, dz), step = Math.min(d, SPEED * dt * Math.min(1, d + 0.4));
      if (d < 0.03) this.target = null; else { const n = this.clamp(this.pos.x + dx / d * step, this.pos.z + dz / d * step); if (Math.hypot(n.x - this.pos.x, n.z - this.pos.z) < step * 0.2) this.target = null; this.pos.x = n.x; this.pos.z = n.z; } }
    if (this.marker.material.opacity > 0) this.marker.material.opacity = Math.max(0, this.marker.material.opacity - dt * (this.target ? 0.4 : 2.5));
    const bob = this.target || mv || st ? Math.sin(this.t * 9) * 0.02 : 0;
    this.cam.position.set(this.pos.x, EYE + bob, this.pos.z); this.cam.rotation.set(this.pitch, this.yaw, 0);
    this.cam.updateMatrixWorld();
  }
  update(dt) { this.walk(dt); }
  render(gl, dt) { this.update(dt); gl.setClearColor(0x000000, 1); gl.render(this.scene, this.cam); }
}
