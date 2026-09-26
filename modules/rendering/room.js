// A room aboard the station to walk around (the Command Deck, Defence Control): its shell (floor, walls, ceiling, a
// window in the front wall), doors, walking, looking and tapping. Drag to look, tap the floor to walk there, tap an
// exhibit to inspect it (the UI shows the details). W/A/S/D walk. Each room builds its exhibits on top.
import { artSvg } from '@last-orbit/ui/art.js';
import { bolt } from '@last-orbit/rendering/bolt.js';
import { playSfx } from '@last-orbit/audio/audio.js';
import { G } from '@last-orbit/core/game.js';
import { ROOM_BY_ID, roomFresh } from '@last-orbit/data/rooms.js';
const T = () => window.THREE;
export const EYE = 1.6, SPEED = 2.4;
/** How doors sit in their walls: 'recess' (the doorway set back into the wall, its leaves sliding into the reveal; the
 *  look chosen in v2.19) or 'proud' (the frame standing out from the wall, as before; &doors=proud to compare). */
export const DOOR_STYLE = typeof location !== 'undefined' && /[?&]doors=proud/.test(location.search) ? 'proud' : 'recess';
const NOBAKE = typeof location !== 'undefined' && /[?&]nobake=1/.test(location.search); /* debug: compare a room unbaked */

/** Merges the still meshes under root into one mesh per material: the same triangles and materials, in far fewer draw
 *  calls (each costs a phone real time). Only for what never moves, hides or swaps material by itself: a shared material
 *  can still change colour. Left as they are: anything under an object marked userData.live, hidden or see-through
 *  meshes, meshes drawn in a set order, mirrored ones, vertex-coloured ones, and a material used once. A mesh under an
 *  anchor (a tappable exhibit, say) merges only with others under the same anchor, and the merged mesh stays there, so
 *  tapping still finds it. Returns how many draw calls it saved. */
export function bake(root, anchors = new Set()) {
  if (NOBAKE) return 0;
  const THREE = T(); root.updateMatrixWorld(true);
  const sets = new Map(), inv = new Map(), m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  const walk = (o, anchor) => {
    if (!o.visible || (o !== root && o.userData.live)) return;
    if (o !== root && anchors.has(o)) anchor = o;
    const mat = o.material, g = o.geometry;
    if (o.isMesh && !o.isInstancedMesh && g?.isBufferGeometry && g.attributes.position && g.attributes.normal && !g.attributes.color && !g.morphAttributes?.position && !Array.isArray(mat) && !mat.transparent && !mat.vertexColors && !o.renderOrder && o.matrixWorld.determinant() > 0) {
      const key = mat.uuid + '|' + anchor.uuid, e = sets.get(key) || { mat, anchor, list: [] }; e.list.push(o); sets.set(key, e);
    }
    for (const c of [...o.children]) walk(c, anchor);
  };
  walk(root, root); let saved = 0;
  for (const { mat, anchor, list } of sets.values()) {
    if (list.length < 2) continue;
    const uv = list.every((o) => o.geometry.attributes.uv); if (mat.map && !uv) continue;
    if (!inv.has(anchor)) inv.set(anchor, anchor.matrixWorld.clone().invert());
    // chunks under 65,535 vertices each, so every index fits 16 bits
    const chunks = [[]]; let n = 0;
    for (const o of list) { const c = o.geometry.attributes.position.count; if (n + c > 65535 && n) { chunks.push([]); n = 0; } chunks[chunks.length - 1].push(o); n += c; }
    for (const chunk of chunks) {
      if (chunk.length < 2) continue;
      let verts = 0, idx = 0; for (const o of chunk) { const g = o.geometry; verts += g.attributes.position.count; idx += g.index ? g.index.count : g.attributes.position.count; }
      const P = new Float32Array(verts * 3), N = new Float32Array(verts * 3), U = uv ? new Float32Array(verts * 2) : null, I = new Uint16Array(idx); let vo = 0, io = 0;
      for (const o of chunk) {
        const g = o.geometry, pos = g.attributes.position, nor = g.attributes.normal, uvs = g.attributes.uv, c = pos.count;
        m.multiplyMatrices(inv.get(anchor), o.matrixWorld); nm.getNormalMatrix(m);
        for (let i = 0; i < c; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m); P[(vo + i) * 3] = v.x; P[(vo + i) * 3 + 1] = v.y; P[(vo + i) * 3 + 2] = v.z;
          v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); N[(vo + i) * 3] = v.x; N[(vo + i) * 3 + 1] = v.y; N[(vo + i) * 3 + 2] = v.z;
          if (U) { U[(vo + i) * 2] = uvs.getX(i); U[(vo + i) * 2 + 1] = uvs.getY(i); }
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) I[io++] = g.index.getX(i) + vo; else for (let i = 0; i < c; i++) I[io++] = i + vo;
        vo += c;
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); if (U) geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); geo.setIndex(new THREE.BufferAttribute(I, 1));
      const merged = new THREE.Mesh(geo, mat), ex = chunk[0].userData.exhibit; if (ex) merged.userData.exhibit = ex;
      merged.matrixAutoUpdate = false; anchor.add(merged); merged.updateMatrix();
      for (const o of chunk) o.parent.remove(o); saved += chunk.length - 1;
    }
  }
  return saved;
}
/** Free what a scene holds on the GPU: its geometry buffers, materials (their shaders) and textures. The objects stay
 *  usable (three.js uploads them again if drawn), so anything shared with another scene (the battle's shape cache) is safe. */
export function disposeScene(scene) {
  const seen = new Set();
  scene.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) { if (seen.has(m)) continue; seen.add(m); for (const k in m) { const v = m[k]; if (v?.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); } } m.dispose(); }
  });
}
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
/** A sign over a room's window, drawn into a 768 x 96 canvas (for a 2.4 x 0.3 plane): the room's name and a line under
 *  it on a dark plate edged in its colour, so both read against whatever is behind (a lamp's glint on the frame). */
export function drawSign(x, title, sub, ink, accent) {
  x.fillStyle = 'rgba(5,7,15,.86)'; x.beginPath(); if (x.roundRect) x.roundRect(3, 3, 762, 90, 16); else x.rect(3, 3, 762, 90); x.fill();
  x.strokeStyle = accent; x.globalAlpha = 0.55; x.lineWidth = 3; x.stroke(); x.globalAlpha = 1;
  const fit = (str, px, wt) => { let s = px; do x.font = `${wt} ${s}px sans-serif`; while (x.measureText(str).width > 724 && (s -= 2) > 12); return x.font; }; /* a long station name shrinks to fit */
  text(x, title, 384, 38, fit(title, 40, 800), ink); text(x, sub, 384, 74, fit(sub, 19, 700), accent);
}

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
   *  look: colours and where things go (see the Command Deck and Defence Control for the two looks). look.open: no
   *  ceiling, light panels or beams across the top (the room builds its own roof: the Observatory's dome, the Greenhouse's
   *  glass). look.glassWalls: the side walls are glass. */
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
    if (!L.open) { const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, D), Ph({ map: tex(ceilC, [W, D / 2]), shininess: 5 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, (FRONT + BACK) / 2); S.add(ceil); }
    const wallMat = Ph({ map: tex(wallC, [D / 2, 1.4]), specular: 0x222a3a, shininess: 18 });
    const wall = (w, h, x, y, z, ry, m = wallMat) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.y = ry; S.add(o); return o; };
    const side = L.glassWalls ? Ph({ color: 0xdff2ff, transparent: true, opacity: 0.1, specular: 0xffffff, shininess: 110, side: THREE.DoubleSide, depthWrite: false }) : wallMat; /* look.glassWalls: glass down both sides (the Greenhouse) */
    wall(D, H, -W, H / 2, (FRONT + BACK) / 2, Math.PI / 2, side); wall(D, H, W, H / 2, (FRONT + BACK) / 2, -Math.PI / 2, side); wall(2 * W, H, 0, H / 2, BACK, Math.PI);
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
    const pc = canvas(256, 64), px = pc.getContext('2d'), pg = px.createLinearGradient(0, 7, 0, 57); px.fillStyle = '#262c3a'; px.fillRect(0, 0, 256, 64); /* a diffuser in its frame, brightest down the middle */
    pg.addColorStop(0, '#c4c4c4'); pg.addColorStop(0.5, '#ffffff'); pg.addColorStop(1, '#c4c4c4'); px.fillStyle = pg; px.fillRect(7, 7, 242, 50); px.fillStyle = 'rgba(0,0,0,.16)'; for (let i = 1; i < 8; i++) px.fillRect(7 + i * 30.25 - 1, 7, 2, 50);
    const lightMat = (this.lightMat = new THREE.MeshBasicMaterial({ color: L.panel ?? 0xfff1d8, map: tex(pc) }));
    if (!L.open) for (const z of L.lamps) { const p = new THREE.Mesh(new THREE.PlaneGeometry(L.panelW ?? 2.4, 0.5), lightMat); p.rotation.x = Math.PI / 2; p.position.set(0, H - 0.025, z); S.add(p); }
    // structure: ribs down the side walls, beams across the ceiling, and a cove light along the top of the walls
    const rib = Ph({ color: L.rib ?? 0x323c55, specular: 0x4a5a78, shininess: 30 }), cove = (this.coveMat = new THREE.MeshBasicMaterial({ color: L.cove ?? L.strip ?? 0x5ee6ff, transparent: true, opacity: 0.7 }));
    for (const z of L.ribs) { for (const s of [-1, 1]) box(0.14, H, 0.22, s * (W - 0.07), H / 2, z, rib); if (!L.open) box(2 * W, 0.16, 0.22, 0, H - 0.08, z, rib); }
    this.ribZ = L.ribs; /* doors on the side walls keep their panels off them */
    for (const s of [-1, 1]) box(0.03, 0.03, D, s * (W - 0.05), H - 0.2, (FRONT + BACK) / 2, cove); box(2 * W, 0.03, 0.03, 0, H - 0.2, BACK - 0.05, cove);
    // where a tap on the floor is taking you
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 32), new THREE.MeshBasicMaterial({ color: L.strip ?? 0x5ee6ff, transparent: true, opacity: 0 })); this.marker.rotation.x = -Math.PI / 2; this.marker.position.y = 0.02; S.add(this.marker);
  }
  /** A door set into a wall, facing into the room along ry (0: the back wall, π/2: the right wall, -π/2: the left wall),
   *  at (x, z) on the floor: a chamfered frame with a glowing inner trim, two leaves that slide apart onto a lit corridor
   *  as you walk up, its sign above and a control panel beside it. sealed: shut and lit red, taped across, a padlock on
   *  the panel. edge: the trim's colour, sign: the sign's. Tapping it is exhibit kind. A door to a room aboard
   *  (data/rooms.js) wears a NEW tag on its sign while that room is open and not yet visited, its threshold glowing.
   *  DOOR_STYLE 'recess': the doorway is set back into the wall, framed by a flat plate on the wall's face, with the
   *  leaves sliding into its reveal; an unseen mask cuts the wall away in front of it (drawn after the recess and before
   *  the wall, so the wall fails the depth test there). */
  door(parent, x, z, ry, label, kind, { sealed = false, sign = '#9ff0ff', edge = 0x5ee6ff } = {}) {
    const THREE = T(), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
    const f = new THREE.Group(); f.rotation.y = Math.PI; g.add(f); // built facing +z, into the room; the wall is at z 0
    const OW = 0.7, OH = 2.3, C = 0.26, F = 0.14, acc = sealed ? 0xff4d6a : edge, css = hexCss(acc), txt = sealed ? '#ff9aa8' : sign;
    const outline = (w, h, c) => { const o = new THREE.Shape(); o.moveTo(-w, 0); o.lineTo(w, 0); o.lineTo(w, h - c); o.lineTo(w - c, h); o.lineTo(-w + c, h); o.lineTo(-w, h - c); o.closePath(); return o; };
    const Ph = (o) => new THREE.MeshPhongMaterial(o), put = (geo, m, px = 0, py = 0, pz = 0, to = f) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); to.add(o); return o; };
    const metal = Ph({ color: 0x2c3448, specular: 0x6a7c9e, shininess: 50 }), recess = DOOR_STYLE === 'recess', deep = recess ? 0.34 : 0, lift = recess ? -0.1 : 0;
    // what sits in the doorway (the corridor, the leaves, the tape): at the wall, or at the back of the recess
    const back = new THREE.Group(); back.position.z = -deep; f.add(back);
    // the frame, standing proud of the wall (or a plate flat on it round the recess), and the light round its inside edge
    const frame = outline(OW + F, OH + F, C + F * 0.59); frame.holes.push(outline(OW, OH, C));
    put(new THREE.ExtrudeGeometry(frame, recess ? { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 } : { depth: 0.12, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 1 }), metal);
    const ring = outline(OW + 0.04, OH + 0.04, C + 0.024); ring.holes.push(outline(OW, OH, C));
    const trim = new THREE.MeshBasicMaterial({ color: acc }); put(new THREE.ShapeGeometry(ring), trim, 0, 0, 0.145, back);
    if (recess) {
      // the reveal: the recess's sides, head and floor, the wall's thickness; a lit lip where it meets the room; the mask
      const rv = outline(OW + 0.05, OH + 0.05, C + 0.03); rv.holes.push(outline(OW, OH, C));
      put(new THREE.ExtrudeGeometry(rv, { depth: deep, bevelEnabled: false }), Ph({ color: 0x222a3c, specular: 0x55657f, shininess: 35 }), 0, 0, -deep).renderOrder = -2;
      const lip = outline(OW + 0.02, OH + 0.02, C + 0.012); lip.holes.push(outline(OW, OH, C)); put(new THREE.ShapeGeometry(lip), trim, 0, 0, 0.034);
      const mask = put(new THREE.ShapeGeometry(outline(OW, OH, C)), new THREE.MeshBasicMaterial({ colorWrite: false }), 0, 0, 0.006); mask.renderOrder = -1;
    }
    // the corridor beyond, painted in perspective, lit at the far end
    const cc = canvas(256, 384), cx = cc.getContext('2d'), vx = 128, vy = 210;
    cx.fillStyle = '#04070f'; cx.fillRect(0, 0, 256, 384);
    const glow = cx.createRadialGradient(vx, vy, 0, vx, vy, 90); glow.addColorStop(0, css); glow.addColorStop(0.35, css + '66'); glow.addColorStop(1, css + '00'); cx.fillStyle = glow; cx.fillRect(0, 0, 256, 384);
    cx.strokeStyle = css; for (let i = 0; i < 7; i++) { const k = 0.8 ** i, w = 128 * k, top = vy - (vy + 10) * k, bot = vy + (384 - vy) * k; cx.globalAlpha = 0.18 + 0.1 * (6 - i) / 6; cx.lineWidth = 1 + 2 * k; cx.strokeRect(vx - w, top, 2 * w, bot - top); }
    cx.globalAlpha = 0.25; for (const [a, b] of [[0, 0], [256, 0], [0, 384], [256, 384]]) { cx.beginPath(); cx.moveTo(a, b); cx.lineTo(vx, vy); cx.stroke(); } cx.globalAlpha = 1;
    const ct = tex(cc); ct.repeat.set(1 / (2 * OW), 1 / OH); ct.offset.set(0.5, 0); // shape UVs are its own coordinates
    put(new THREE.ShapeGeometry(outline(OW, OH, C)), new THREE.MeshBasicMaterial({ map: ct }), 0, 0, 0.004, back);
    // the two leaves, clipped to the doorway so they vanish into the frame as they part
    const leaf = new THREE.MeshPhongMaterial({ color: sealed ? 0x2e3446 : 0x3d4964, specular: 0x7a8cae, shininess: 55 }), inset = Ph({ color: 0x27324a, emissive: new THREE.Color(acc).multiplyScalar(0.14), specular: 0x9fb4d8, shininess: 80 }), slit = new THREE.MeshBasicMaterial({ color: acc }), leafEdge = Ph({ color: 0x1c2336, shininess: 20 });
    const hz = canvas(128, 48), hx = hz.getContext('2d'); hx.fillStyle = '#10141f'; hx.fillRect(0, 0, 128, 48); hx.fillStyle = sealed ? '#ffc857' : css; for (let i = -48; i < 128; i += 22) { hx.beginPath(); hx.moveTo(i, 48); hx.lineTo(i + 11, 48); hx.lineTo(i + 59, 0); hx.lineTo(i + 48, 0); hx.fill(); }
    const kick = new THREE.MeshBasicMaterial({ map: tex(hz), color: 0x9a9a9a }), mats = [leaf, inset, slit, kick, leafEdge], leaves = [];
    for (const side of [-1, 1]) {
      const half = new THREE.Shape(); half.moveTo(0, 0); half.lineTo(side * OW, 0); half.lineTo(side * OW, OH - C); half.lineTo(side * (OW - C), OH); half.lineTo(0, OH); half.closePath();
      const lg = new THREE.Group(); back.add(lg); leaves.push(lg); const mid = side * OW * 0.5;
      put(new THREE.ExtrudeGeometry(half, { depth: 0.06, bevelEnabled: false }), leaf, 0, 0, 0.03, lg);
      put(new THREE.BoxGeometry(OW * 0.5, 0.86, 0.012), inset, mid + side * 0.03, 1.52, 0.095, lg); put(new THREE.BoxGeometry(OW * 0.58, 0.94, 0.008), leafEdge, mid + side * 0.03, 1.52, 0.092, lg);
      put(new THREE.BoxGeometry(OW * 0.64, 0.035, 0.012), slit, mid, 0.98, 0.095, lg);
      put(new THREE.PlaneGeometry(OW * 0.86, 0.3), kick, mid, 0.24, 0.093, lg);
      put(new THREE.BoxGeometry(0.018, OH - 0.02, 0.012), slit, side * 0.012, OH / 2, 0.093, lg);
    }
    if (sealed) {
      const tc = canvas(512, 64), t2 = tc.getContext('2d'); t2.fillStyle = '#ffc857'; t2.fillRect(0, 0, 512, 64); t2.fillStyle = '#1a1406'; for (let i = -64; i < 512; i += 40) { t2.beginPath(); t2.moveTo(i, 64); t2.lineTo(i + 20, 64); t2.lineTo(i + 64, 0); t2.lineTo(i + 44, 0); t2.fill(); }
      t2.fillStyle = '#1a1406'; t2.fillRect(176, 8, 160, 48); text(t2, 'SEALED', 256, 33, '800 30px sans-serif', '#ffc857');
      const tape = new THREE.MeshBasicMaterial({ map: tex(tc) }); mats.push(tape); const band = put(new THREE.PlaneGeometry(2 * OW + (recess ? 0.1 : 0.2), 0.26), tape, 0, 1.3, 0.106, back); band.rotation.z = -0.1;
    }
    // the sign over the door, and the panel beside it (a way through, or a padlock)
    const sw = label.length > 12 ? 1.62 : 1.2, cw = Math.round(sw * 256), sc = canvas(cw, 80), sx = sc.getContext('2d');
    const out = Math.abs(OH + F + 0.22 - ((this.H || 99) - 0.2)) < 0.22 ? 0.075 : 0; /* a low room: the sign stands off the wall, in front of the cove light along its top */
    const bg = sx.createLinearGradient(0, 0, 0, 80); bg.addColorStop(0, '#0c1628'); bg.addColorStop(1, '#060b16'); sx.fillStyle = bg; sx.fillRect(0, 0, cw, 80);
    sx.fillStyle = css; sx.fillRect(0, 0, cw, 4); sx.fillRect(0, 76, cw, 4); sx.globalAlpha = 0.5; sx.fillRect(10, 12, 6, 56); sx.fillRect(cw - 16, 12, 6, 56); sx.globalAlpha = 1;
    sx.shadowColor = css; sx.shadowBlur = 14; text(sx, label, cw / 2, 42, `800 ${sw > 1.3 ? 30 : 32}px sans-serif`, txt); sx.shadowBlur = 0;
    put(new THREE.BoxGeometry(sw + 0.06, 0.34, 0.05 + lift * 0.3 + out), metal, 0, OH + F + 0.22, (0.05 + lift * 0.3 + out) / 2);
    put(new THREE.PlaneGeometry(sw, 0.3), new THREE.MeshBasicMaterial({ map: tex(sc) }), 0, OH + F + 0.22, 0.052 + lift * 0.3 + out);
    const pc = canvas(96, 144), px = pc.getContext('2d'); px.fillStyle = '#060b16'; px.fillRect(0, 0, 96, 144); px.strokeStyle = css; px.lineWidth = 4; px.strokeRect(4, 4, 88, 136); px.fillStyle = css; px.strokeStyle = css;
    if (sealed) { px.lineWidth = 7; px.beginPath(); px.arc(48, 62, 16, Math.PI, 0); px.stroke(); px.fillRect(26, 62, 44, 36); px.fillStyle = '#060b16'; px.fillRect(45, 72, 6, 14); }
    else for (const y of [52, 82]) { px.lineWidth = 7; px.beginPath(); px.moveTo(34, y - 14); px.lineTo(56, y); px.lineTo(34, y + 14); px.stroke(); }
    px.fillStyle = sealed ? '#ff9aa8' : sign; px.font = '800 15px sans-serif'; px.textAlign = 'center'; px.fillText(sealed ? 'LOCKED' : 'OPEN', 48, 126);
    // beside the door, on whichever side has room: inside the corners, and clear of the side walls' ribs (standing off the
    // wall past a rib if neither side is clear)
    const onSide = this.W && Math.abs(Math.abs(x) - this.W) < 0.05; g.updateWorldMatrix(true, true);
    const at = (s) => f.localToWorld(new THREE.Vector3(s * (OW + F + 0.24), 1.22, 0));
    const ribAt = (s) => onSide && (this.ribZ || []).some((rz) => Math.abs(at(s).z - rz) < 0.26);
    const cornered = (s) => { if (!this.W) return false; const w = at(s); return onSide ? w.z + 0.14 > this.BACK - 0.02 || w.z - 0.14 < this.FRONT + 0.25 : Math.abs(w.x) + 0.14 > this.W - 0.02; };
    const ok = (s) => !cornered(s) && !ribAt(s), pdir = ok(1) ? 1 : ok(-1) ? -1 : cornered(1) ? -1 : 1, pout = ribAt(pdir) ? 0.15 : 0, pside = pdir * (OW + F + 0.24);
    put(new THREE.BoxGeometry(0.24, 0.36, 0.05 + lift * 0.3 + pout), metal, pside, 1.22, (0.05 + lift * 0.3 + pout) / 2); put(new THREE.PlaneGeometry(0.2, 0.3), new THREE.MeshBasicMaterial({ map: tex(pc) }), pside, 1.22, 0.052 + lift * 0.3 + pout);
    // a strip of light on the floor at the threshold
    const fc = canvas(8, 64), fx = fc.getContext('2d'), fg = fx.createLinearGradient(0, 0, 0, 64); fg.addColorStop(0, css); fg.addColorStop(1, css + '00'); fx.fillStyle = fg; fx.fillRect(0, 0, 8, 64);
    const strip = put(new THREE.PlaneGeometry(2 * OW, 0.5 + deep), new THREE.MeshBasicMaterial({ map: tex(fc), transparent: true, opacity: 0.35, depthWrite: false }), 0, 0.012, 0.25 - deep / 2); strip.rotation.x = -Math.PI / 2; /* from the leaves out into the room */
    if (recess) back.traverse((o) => { o.renderOrder = -2; }); /* the recess before the mask, the mask before the wall */
    let news = null;
    if (ROOM_BY_ID[kind]?.seen) {
      const nc = canvas(128, 64), nx = nc.getContext('2d'); nx.fillStyle = '#ffc857'; nx.beginPath(); if (nx.roundRect) nx.roundRect(4, 6, 120, 52, 12); else nx.rect(4, 6, 120, 52); nx.fill(); text(nx, 'NEW', 64, 33, '900 32px sans-serif', '#1a1300');
      news = put(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshBasicMaterial({ map: tex(nc), transparent: true }), sw / 2 - 0.1, OH + F + 0.35, 0.08 + out); news.rotation.z = -0.12; news.visible = false;
    }
    // clip the leaves (and the tape) to the doorway, in world space
    g.updateWorldMatrix(true, true);
    const planes = [[1, 0, -OW, 0], [-1, 0, OW, 0], [0, -1, 0, OH], [1, -1, -OW, OH - C], [-1, -1, OW, OH - C]].map(([nx, ny, ax, ay]) => {
      const n = new THREE.Vector3(nx, ny, 0).normalize().transformDirection(f.matrixWorld), pt = f.localToWorld(new THREE.Vector3(ax, ay, 0)); return new THREE.Plane().setFromNormalAndCoplanarPoint(n, pt); });
    for (const m of mats) m.clippingPlanes = planes;
    this.hitBox(g, 2.1, 3.1, 0.4, 0, 1.55, -0.2); this.tag(g, kind);
    Object.assign(g.userData, { sealed, trim, slit, acc, leaves, open: 0, OW, news, strip, room: kind, live: true }); /* its leaves slide: never baked */ (this.doors ||= []).push(g); return g;
  }
  /** Doors breathe their light, and slide open as you walk up to one (sealed ones stay shut). */
  animateDoors(dt) {
    const v = (this._dv ||= new (T().Vector3)());
    for (const g of this.doors || []) {
      const u = g.userData; g.getWorldPosition(v); const near = !u.sealed && Math.hypot(this.pos.x - v.x, this.pos.z - v.z) < 2.3, was = u.open;
      u.open += ((near ? 1 : 0) - u.open) * Math.min(1, dt * 5); if (near && was < 0.02 && u.open >= 0.02) playSfx('dash', 0.22, 0.5);
      const s = u.open * u.OW * 0.97; u.leaves[0].position.x = -s; u.leaves[1].position.x = s;
      const k = (u.sealed ? 0.55 + 0.35 * Math.sin(this.t * 1.3) : 0.8 + 0.2 * Math.sin(this.t * 2.2)) + u.open * 0.25; u.trim.color.setHex(u.acc).multiplyScalar(k); u.slit.color.setHex(u.acc).multiplyScalar(0.6 + 0.4 * k);
      if (u.news) { const fresh = !u.sealed && !!G.state && roomFresh(u.room, G.state), p = 0.5 + 0.5 * Math.sin(this.t * 4); u.news.visible = fresh; if (fresh) u.news.scale.setScalar(1 + 0.08 * p); u.strip.material.opacity = fresh ? 0.35 + 0.4 * p : 0.35; }
    }
  }
  /** An invisible box that makes a whole exhibit easy to tap (gaps and all). */
  hitBox(parent, w, h, d, x, y, z) { const THREE = T(), m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); m.position.set(x, y, z); m.visible = false; parent.add(m); return m; } /* never drawn: the raycaster still finds it */
  tag(obj, kind) { obj.traverse((o) => { o.userData.exhibit = kind; }); this.exhibits.push(obj); }
  untag(group) { this.exhibits = this.exhibits.filter((o) => o !== group && !group.children.includes(o)); if (this.doors) this.doors = this.doors.filter((d) => d.parent !== group); }
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
    if (hit && !hit.object.userData.exhibit) { let o = hit.object; while (o && !o.userData.exhibit) o = o.parent; hit.object.userData.exhibit = o?.userData.exhibit || extra.find((e) => { let q = hit.object; while (q && q !== e.obj) q = q.parent; return q; })?.kind; } // added after tagging (radar blips), or rebuilt as the station grows
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
  /** Take the room down (rendering/renderer.js keeps only the last few you were in): Bolt is sent on first, so it keeps
   *  its own model, then everything the room holds on the GPU is freed, a screen's own scene and render target too (the
   *  Command Deck's replay TV). */
  dispose() {
    if (bolt.room === this) bolt.leave();
    for (const v of Object.values(this)) if (v?.target?.isWebGLRenderTarget) { v.target.dispose(); if (v.scene?.isScene) disposeScene(v.scene); }
    disposeScene(this.scene); this.disposed = true;
  }
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
    this.cam.updateMatrixWorld(); this.animateDoors(dt);
  }
  update(dt) { this.walk(dt); }
  /** Anything a room draws off-screen before the room itself (the replay screen). */
  /** Merges the room's still parts (bake): anything the room keeps a reference to, directly or in a list, stays apart
   *  (its code may move, hide or change it later), as do the doors; tappable exhibits stay tappable. Call at the end of
   *  the constructor. A room that finds objects any other way marks them userData.live itself. */
  bakeStatic() {
    const skip = new Set(['scene', 'cam', 'exhibits', 'doors']), mark = (v) => { if (v?.isObject3D && v !== this.scene) v.userData.live = true; }, plain = (v) => v && typeof v === 'object' && !v.isMaterial && !v.isTexture && !ArrayBuffer.isView(v);
    for (const [k, v] of Object.entries(this)) { if (skip.has(k) || !plain(v)) continue; if (v.isObject3D) { mark(v); continue; }
      for (const x of Array.isArray(v) ? v : v instanceof Map ? [...v.values()] : v instanceof Set ? [...v] : Object.values(v)) { if (x?.isObject3D) mark(x); else if (plain(x)) for (const y of Array.isArray(x) ? x : Object.values(x)) mark(y); } }
    return bake(this.scene, new Set(this.exhibits));
  }
  offscreen() {}
  render(gl, dt) { this.update(dt); bolt.visit(this, dt); /* Bolt comes along (rendering/bolt.js) */ this.offscreen(gl); gl.localClippingEnabled = true; /* the doors' leaves are clipped to their doorways */ gl.setClearColor(0x000000, 1); gl.render(this.scene, this.cam); }
}
