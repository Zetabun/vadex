// Survivors: the people the station takes in, a look to try (not in the game yet). Rounded, low-poly and flat-coloured
// like everything else aboard: coveralls in the colour of the work each does, and a friendly face (eyes that blink,
// brows, a smile) or, the other look, a helmet with a dark visor. Each is built on a small rig (hips, chest, neck and
// head; shoulders, elbows and hands; hips, knees and feet) so it can stand, carry, water the beds, work at a bench,
// read a tablet, sit on a wall or wave, and it breathes, blinks and looks up at you now and then while it does.
const T = () => window.THREE;

/** The people in the look test: what they wear, their hair, what they carry. */
export const CREW_LOOKS = [
  { id: 'mara', name: 'Mara', job: 'Botanist', suit: 0x5d8a55, trim: 0xa6e07e, skin: 0x8d5a3b, hair: 'curls', hairCol: 0x1c1410, rolled: true, hold: 'can' },
  { id: 'tomas', name: 'Tomas', job: 'Engineer', suit: 0xc8743a, trim: 0x3a3f48, skin: 0xe8b48a, hair: 'beanie', hairCol: 0xa4522a, hat: 0x3d4656, beard: true, belt: 0x5a4030, hold: 'pot' },
  { id: 'anya', name: 'Dr Anya', job: 'Medic', suit: 0xdde3ea, trim: 0x3fc6e0, skin: 0xf1c9a5, hair: 'bun', hairCol: 0xb9bcc2, glasses: true, hold: 'tablet' },
  { id: 'iko', name: 'Iko', job: 'Helps out', suit: 0xf2c14e, trim: 0x4a8fe0, skin: 0xc68642, hair: 'crop', hairCol: 0x2a1a10, kid: true, hold: 'flower' },
];

let GEO = null;
const geo = () => (GEO ||= { ball: new (T().SphereGeometry)(1, 24, 16), rod: new (T().CylinderGeometry)(1, 1, 1, 16), box: new (T().BoxGeometry)(1, 1, 1) });

/** Joint angles ([x, y, z], radians) for each pose; a joint left out stands straight. can, flower: how the held thing
 *  is turned; seat: sitting, thighs level at the height of what is sat on. */
const POSES = {
  stand: { shL: [0.04, 0, 0.1], shR: [0.04, 0, -0.1], elL: [-0.12, 0, 0], elR: [-0.12, 0, 0] },
  carry: { shL: [0.04, 0, 0.1], shR: [0.05, 0, -0.2], elL: [-0.12, 0, 0], elR: [-0.05, 0, 0] },
  pot: { shL: [-0.5, 0, -0.28], elL: [-1.15, 0, 0], shR: [-0.5, 0, 0.28], elR: [-1.15, 0, 0] },
  tablet: { head: [0.3, 0, 0], shL: [-0.4, 0, -0.12], elL: [-1.5, 0, 0], shR: [-0.42, 0, 0.26], elR: [-1.3, 0, 0] },
  wave: { shR: [-0.15, 0, -2.35], elR: [0, 0, -0.6], shL: [-0.55, 0, 0.1], elL: [-0.95, 0, 0], flower: [1.5, 0, 0] },
  water: { chest: [0.12, 0, 0], head: [0.3, 0, 0], shR: [-1.0, 0, 0.04], elR: [-0.22, 0, 0], shL: [0.1, 0, 0.2], elL: [-0.3, 0, 0], can: [0.65, 0, 0] },
  bench: { chest: [0.26, 0, 0], head: [0.32, 0, 0], shL: [-0.85, 0, 0.12], elL: [-0.6, 0, 0], shR: [-0.95, 0, -0.08], elR: [-0.55, 0, 0] },
  sit: { hipL: [-1.5, 0, 0.06], hipR: [-1.5, 0, -0.06], kneeL: [1.45, 0, 0], kneeR: [1.45, 0, 0], shL: [0.15, 0, 0.32], elL: [-0.2, 0, 0], shR: [-0.75, 0, -0.05], elR: [-1.05, 0, 0], head: [0.12, 0, 0], flower: [1.8, 0, 0], seat: true },
};

/** A survivor, built facing +z with its feet at the origin (or, sitting, its thighs at seat). visor: the helmet look.
 *  userData.tick(dt, cam) moves it along: breathing, blinking, glancing up at the camera, and whatever its pose does. */
export function buildSurvivor(o, { visor = false, pose = 'stand', seat = 0.53 } = {}) {
  const THREE = T(), g = geo(), side = THREE.DoubleSide, P = POSES[pose] || POSES.stand;
  const M = (c, sh = 14, sp = 0x1c1c1c, extra = {}) => new THREE.MeshPhongMaterial({ color: c, shininess: sh, specular: sp, ...extra });
  const suit = M(o.suit), trim = M(o.trim, 24), skin = M(o.skin, 16, 0x241a12), hair = M(o.hairCol ?? 0x2a1d14, 8, 0x1c1c1c, { side }), boots = M(0x2b2f36, 30, 0x333333);
  const ink = new THREE.MeshBasicMaterial({ color: 0x1b1414 }), white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const root = new THREE.Group(), J = {}, s = o.kid ? 0.64 : o.size || 1, body = new THREE.Group(); root.add(body); body.scale.setScalar(s);
  const part = (to, geom, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geom, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); to.add(m); return m; };
  const joint = (to, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); to.add(j); return j; };
  const limb = (to, r0, r1, len, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 16), mat); m.position.y = -len / 2; to.add(m); return m; }; /* r0 at the joint */
  const ring = (to, r, tube, y, mat, sq = 0.72) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 28), mat); m.rotation.x = Math.PI / 2; m.scale.set(1, sq, 1); m.position.y = y; to.add(m); return m; };

  // the body: hips, a rounded chest in coveralls, belt and buckle, collar, a zip and a patch
  J.hips = joint(body, 0, 0.86, 0);
  const seatM = new THREE.Mesh(new THREE.LatheGeometry([[0.001, -0.15], [0.07, -0.14], [0.125, -0.1], [0.15, -0.03], [0.152, 0.08]].map(([x, y]) => new THREE.Vector2(x, y)), 24), suit); seatM.scale.z = 0.7; J.hips.add(seatM);
  J.chest = joint(J.hips, 0, 0.06, 0);
  const torso = new THREE.Mesh(new THREE.LatheGeometry([[0.001, -0.03], [0.15, -0.03], [0.152, 0.0], [0.157, 0.1], [0.17, 0.24], [0.18, 0.36], [0.158, 0.45], [0.085, 0.5], [0.001, 0.51]].map(([x, y]) => new THREE.Vector2(x, y)), 24), suit);
  torso.scale.z = 0.7; J.chest.add(torso);
  ring(J.chest, 0.153, 0.021, 0, o.belt ? M(o.belt, 20) : trim); part(J.chest, g.box, M(0xd9a441, 70, 0xfff0c0), 0, 0, 0.112, 0.046, 0.034, 0.014);
  ring(J.chest, 0.082, 0.022, 0.47, trim, 0.8); part(J.chest, g.box, trim, 0, 0.24, 0.123, 0.013, 0.32, 0.008);
  part(J.chest, g.ball, trim, 0.085, 0.33, 0.112, 0.03, 0.03, 0.006).rotation.y = 0.35;

  // the head: a face, or a helmet
  J.neck = joint(J.chest, 0, 0.49, 0); part(J.neck, g.rod, skin, 0, 0.035, 0, 0.052, 0.09, 0.05);
  J.head = joint(J.neck, 0, 0.07, 0); if (o.kid) J.head.scale.setScalar(1.22);
  part(J.head, g.ball, skin, 0, 0.13, 0, 0.15, 0.158, 0.148); J.eyes = [];
  if (visor) {
    const vc = document.createElement('canvas'); vc.width = 8; vc.height = 128; const vx = vc.getContext('2d'), vg = vx.createLinearGradient(0, 0, 0, 128);
    vg.addColorStop(0, '#f6e2b0'); vg.addColorStop(0.38, '#b88a3a'); vg.addColorStop(0.42, '#fff4d8'); vg.addColorStop(0.46, '#5a3f12'); vg.addColorStop(1, '#1c1206'); vx.fillStyle = vg; vx.fillRect(0, 0, 8, 128);
    const shell = M(o.helmet ?? 0xe8edf2, 60, 0x999999), glass = M(0xffffff, 40, 0x6a5a3a, { map: new THREE.CanvasTexture(vc) });
    part(J.head, g.ball, shell, 0, 0.14, 0, 0.184, 0.19, 0.182);
    const v = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, Math.PI / 2 - 0.95, 1.9, 1.0, 1.0), glass); v.scale.set(0.189, 0.195, 0.187); v.position.set(0, 0.14, 0); J.head.add(v);
    ring(J.head, 0.105, 0.026, -0.01, trim, 0.9); const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.186, 0.012, 6, 32, Math.PI * 0.62), trim); stripe.rotation.set(0, Math.PI / 2, Math.PI * 0.3); stripe.position.y = 0.14; J.head.add(stripe);
    part(J.head, g.rod, trim, -0.172, 0.2, 0.03, 0.022, 0.07, 0.022).rotation.x = Math.PI / 2; part(J.head, g.ball, new THREE.MeshBasicMaterial({ color: 0xeaffff }), -0.172, 0.2, 0.066, 0.015, 0.015, 0.006);
  } else {
    const cheek = M(new THREE.Color(o.skin).lerp(new THREE.Color(0xff5c7a), 0.3).getHex(), 10);
    for (const sx of [-1, 1]) {
      part(J.head, g.ball, skin, sx * 0.147, 0.125, -0.01, 0.02, 0.034, 0.024);
      J.eyes.push(part(J.head, g.ball, ink, sx * 0.052, 0.147, 0.136, 0.017, 0.024, 0.01));
      part(J.head, g.ball, white, sx * 0.052 + 0.007, 0.156, 0.145, 0.0055, 0.0055, 0.003);
      const brow = part(J.head, g.box, hair, sx * 0.056, 0.19, 0.126, 0.042, 0.009, 0.008); brow.rotation.set(0, sx * 0.35, -sx * 0.12);
      part(J.head, g.ball, cheek, sx * 0.09, 0.1, 0.114, 0.026, 0.016, 0.008);
    }
    part(J.head, g.ball, skin, 0, 0.118, 0.146, 0.02, 0.017, 0.016);
    if (!o.beard) { const m = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0045, 4, 14, Math.PI), ink); m.position.set(0, 0.093, 0.141); m.rotation.z = Math.PI; J.head.add(m); }
    // hair: a cap over the top and back of the head, then the style
    const cap = (theta, tilt, sc = 1.055, mat = hair, to = J.head) => { const c = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, theta), mat); c.scale.set(0.15 * sc, 0.158 * sc, 0.148 * sc); c.position.set(0, 0.13, 0); c.rotation.x = -tilt; to.add(c); return c; };
    if (o.hair === 'crop') cap(1.3, 0.45);
    if (o.hair === 'bun') { cap(1.2, 0.35); part(J.head, g.ball, hair, 0, 0.285, -0.1, 0.068, 0.064, 0.068); }
    if (o.hair === 'curls') { cap(1.22, 0.42);
      for (let i = 0; i < 26; i++) { const a = i * 2.4, e = 0.15 + (((i * 7) % 13) / 13) * 1.35, d = new THREE.Vector3(Math.sin(e) * Math.cos(a), Math.cos(e), Math.sin(e) * Math.sin(a)).applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.42);
        if (d.z > 0.25 && d.y < 0.8) continue; part(J.head, g.ball, hair, d.x * 0.16, 0.13 + d.y * 0.168, d.z * 0.158, 0.05, 0.05, 0.05); } }
    if (o.hair === 'beanie') { cap(1.4, 0.55); const knit = M(o.hat, 6, 0x111111, { side }), hat = joint(J.head, 0, 0.13, 0); hat.rotation.x = -0.28;
      const c = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, 1.08), knit); c.scale.set(0.166, 0.176, 0.164); hat.add(c);
      const brim = new THREE.Mesh(new THREE.TorusGeometry(0.146, 0.026, 8, 28), knit); brim.rotation.x = Math.PI / 2; brim.position.y = Math.cos(1.08) * 0.176 - 0.004; hat.add(brim); part(hat, g.ball, knit, 0, 0.19, 0, 0.036, 0.036, 0.036); }
    if (o.beard) { part(J.head, g.ball, hair, 0, 0.04, 0.07, 0.128, 0.094, 0.098); part(J.head, g.ball, hair, 0, 0.101, 0.142, 0.046, 0.013, 0.014); for (const sx of [-1, 1]) part(J.head, g.ball, hair, sx * 0.135, 0.1, 0.03, 0.03, 0.06, 0.05); }
    if (o.glasses) { const fr = M(0x3a3340, 60, 0x999999);
      for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0055, 6, 22), fr); l.position.set(sx * 0.054, 0.148, 0.153); l.rotation.y = sx * 0.12; J.head.add(l); part(J.head, g.box, fr, sx * 0.13, 0.152, 0.075, 0.006, 0.007, 0.15).rotation.y = -sx * 0.42; }
      part(J.head, g.box, fr, 0, 0.152, 0.157, 0.03, 0.006, 0.006); }
  }

  // arms and legs (the wearer's left is +x): coverall sleeves, rolled up on some, hands; boots
  for (const sd of [-1, 1]) { const k = sd > 0 ? 'L' : 'R';
    const sh = (J['sh' + k] = joint(J.chest, sd * 0.19, 0.42, 0)); part(sh, g.ball, suit, 0, 0, 0, 0.061, 0.062, 0.06); limb(sh, 0.056, 0.049, 0.27, suit);
    const el = (J['el' + k] = joint(sh, 0, -0.27, 0)), fore = o.rolled ? skin : suit; part(el, g.ball, fore, 0, 0, 0, 0.05, 0.05, 0.05); limb(el, 0.047, 0.039, 0.24, fore);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(o.rolled ? 0.058 : 0.045, o.rolled ? 0.056 : 0.045, o.rolled ? 0.05 : 0.03, 16), o.rolled ? suit : trim); cuff.position.y = o.rolled ? -0.015 : -0.225; el.add(cuff);
    J['hand' + k] = joint(el, 0, -0.26, 0); part(J['hand' + k], g.ball, skin, 0, -0.005, 0.004, 0.04, 0.05, 0.032);
    const hp = (J['hip' + k] = joint(J.hips, sd * 0.078, -0.02, 0)); part(hp, g.ball, suit, 0, 0, 0, 0.08, 0.08, 0.08); limb(hp, 0.08, 0.063, 0.4, suit);
    const kn = (J['knee' + k] = joint(hp, 0, -0.4, 0)); part(kn, g.ball, suit, 0, 0, 0, 0.063, 0.063, 0.063); limb(kn, 0.059, 0.051, 0.37, suit);
    const ft = joint(kn, 0, -0.37, 0); part(ft, g.rod, boots, 0, 0.02, 0, 0.056, 0.09, 0.056); part(ft, g.ball, boots, 0, -0.035, 0.035, 0.066, 0.05, 0.115); part(ft, g.box, M(0x15181d, 20), 0, -0.075, 0.035, 0.12, 0.018, 0.22);
  }

  // what they carry
  if (o.hold === 'can' && (pose === 'water' || pose === 'carry')) J.can = can(M, J.handR);
  if (o.hold === 'pot' && pose === 'pot') { const p = pot(M); p.position.set(0, 0.2, 0.38); J.chest.add(p); }
  if (o.hold === 'tablet' && pose === 'tablet') { const p = tablet(M); p.position.set(0.03, 0.3, 0.3); p.rotation.x = -0.95; J.chest.add(p); }
  if (o.hold === 'flower' && P.flower) { const f = flower(M); f.rotation.set(...P.flower); J[pose === 'wave' ? 'handL' : 'handR'].add(f); }

  // the pose, and a soft shadow under anyone standing
  const base = {}; for (const [k, v] of Object.entries(P)) if (J[k]?.rotation) { J[k].rotation.set(...v); base[k] = v; }
  if (J.can && P.can) J.can.rotation.set(...P.can);
  if (P.seat) body.position.y = seat + 0.07 * s - 0.84 * s;
  else { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.75 * s, 0.6 * s), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012; root.add(sh); }

  // moving: breathing, blinking, a glance up at you every so often (turning the head, not the body), and the pose's own
  // movement: swinging legs, a wave, a tap at the tablet, watering
  const v = new THREE.Vector3(), headY = (P.seat ? seat + 0.62 * s : 1.62 * s), drops = [], dropM = new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.8 });
  let t = Math.random() * 3, blinkAt = 1 + Math.random() * 2, blinkT = 0, glance = 5 + Math.random() * 2, look = 1, lookY = 0, lookX = 0, dropAt = 0;
  const ph = Math.random() * 6;
  root.userData = { J, pose, tick(dt, cam) {
    t += dt; J.chest.scale.y = 1 + Math.sin(t * 2.2 + ph) * 0.012;
    if ((blinkAt -= dt) < 0) { blinkAt = 2.2 + Math.random() * 3; blinkT = 0.12; } blinkT -= dt; for (const e of J.eyes) e.scale.y = blinkT > 0 ? 0.004 : 0.024;
    if ((glance -= dt) < 0) { look = 1 - look; glance = look ? 2.5 + Math.random() * 2 : 3 + Math.random() * 4; }
    let ty = Math.sin(t * 0.4 + ph) * 0.25, tx = 0;
    if (look && cam) { v.copy(cam.position); root.worldToLocal(v); const yaw = Math.atan2(v.x, v.z); if (Math.abs(yaw) < 1.35) { ty = Math.max(-1, Math.min(1, yaw)); tx = -Math.atan2(cam.position.y - headY, Math.hypot(v.x, v.z)) - (base.head?.[0] || 0); } }
    const k = Math.min(1, dt * 3); lookY += (ty - lookY) * k; lookX += (tx - lookX) * k;
    J.head.rotation.set((base.head?.[0] || 0) + Math.max(-0.5, Math.min(0.4, lookX)), lookY, 0);
    if (pose === 'sit') { J.kneeL.rotation.x = 1.45 + Math.sin(t * 2.4) * 0.28; J.kneeR.rotation.x = 1.45 + Math.sin(t * 2.4 + 1.9) * 0.28; }
    if (pose === 'wave') J.elR.rotation.z = -0.6 + Math.sin(t * 7) * 0.32;
    if (pose === 'tablet') J.elR.rotation.x = -1.2 + Math.max(0, Math.sin(t * 5)) * 0.1;
    if (pose === 'bench') { J.elL.rotation.x = -0.6 + Math.sin(t * 3.1) * 0.1; J.elR.rotation.x = -0.55 + Math.sin(t * 3.1 + 1.4) * 0.1; }
    if (pose === 'water' && J.can && root.parent) {
      if ((dropAt -= dt) < 0) { dropAt = 0.035; J.can.userData.rose.getWorldPosition(v); const d = new THREE.Mesh(g.ball, dropM); d.scale.setScalar(0.011); d.position.copy(v); d.userData.v = new THREE.Vector3((Math.random() - 0.5) * 0.35, -0.2, (Math.random() - 0.5) * 0.35); root.parent.add(d); drops.push(d); }
    }
    for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.userData.v.y -= 5 * dt; d.position.addScaledVector(d.userData.v, dt); if (d.position.y < 0.5) { d.parent?.remove(d); drops.splice(i, 1); } }
  } };
  return root;
}

// ---------------------------------------------------------------- what they hold
/** A watering can hung from the hand by its top handle; userData.rose is the spout's end, where the water comes out. */
function can(M, hand) {
  const THREE = T(), g = new THREE.Group(), m = M(0x3f7a4a, 50, 0x99bb99), brass = M(0xd9a441, 70, 0xfff0c0); hand.add(g);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.18, 18), m); body.position.set(0, -0.14, 0.02); g.add(body);
  const lid = new THREE.Mesh(new THREE.CircleGeometry(0.075, 18), m); lid.rotation.x = -Math.PI / 2; lid.position.set(0, -0.05, 0.02); g.add(lid);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.017, 0.26, 8), m); spout.rotation.x = 1.0; spout.position.set(0, -0.13, 0.17); g.add(spout);
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.018, 0.028, 12), brass); rose.rotation.x = 1.0; rose.position.set(0, -0.06, 0.28); g.add(rose);
  const grip = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 6, 16, Math.PI), m); grip.rotation.y = Math.PI / 2; grip.position.set(0, -0.05, 0.02); g.add(grip);
  g.userData.rose = rose; return g;
}
/** A clay pot with a seedling in it, held in both hands. */
function pot(M) {
  const THREE = T(), g = new THREE.Group(), clay = M(0xb8653a, 10), leaf = M(0x5aa84a, 12);
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.048, 0.1, 16), clay); g.add(p); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.01, 6, 20), clay); rim.rotation.x = Math.PI / 2; rim.position.y = 0.05; g.add(rim);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), M(0x3a2618, 4)); soil.rotation.x = -Math.PI / 2; soil.position.y = 0.045; g.add(soil);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 5), M(0x4f7a3c)); st.position.y = 0.08; g.add(st);
  for (const sd of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), leaf); l.scale.set(0.03, 0.008, 0.017); l.position.set(sd * 0.026, 0.115, 0); l.rotation.z = sd * 0.45; g.add(l); }
  return g;
}
/** A tablet showing the beds: a growth line and three bars. */
function tablet(M) {
  const THREE = T(), g = new THREE.Group(), c = document.createElement('canvas'); c.width = 128; c.height = 88; const x = c.getContext('2d');
  x.fillStyle = '#0d2a33'; x.fillRect(0, 0, 128, 88); x.strokeStyle = '#5ee6ff'; x.lineWidth = 3; x.beginPath(); x.moveTo(8, 72); for (let i = 1; i <= 10; i++) x.lineTo(8 + i * 11, 72 - i * 4 - Math.sin(i) * 6); x.stroke();
  x.fillStyle = '#7ddc6f'; for (let i = 0; i < 3; i++) x.fillRect(10 + i * 38, 10, 28, 9);
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.012, 0.15), M(0xcfd6de, 40, 0x666666)); g.add(b);
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), new THREE.MeshBasicMaterial({ color: 0x5ee6ff })); logo.rotation.x = Math.PI / 2; logo.position.y = -0.0065; g.add(logo);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.13), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })); scr.rotation.x = -Math.PI / 2; scr.position.y = 0.0065; g.add(scr);
  return g;
}
/** A daisy on a long stem. */
function flower(M) {
  const THREE = T(), g = new THREE.Group(), pet = M(0xffc857, 20);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 5), M(0x4f7a3c)); st.position.y = 0.09; g.add(st);
  const head = new THREE.Group(); head.position.y = 0.2; head.rotation.x = 0.5; g.add(head);
  for (let i = 0; i < 11; i++) { const pg = new THREE.Group(); pg.rotation.y = (i / 11) * Math.PI * 2; head.add(pg); const p = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), pet); p.scale.set(0.012, 0.004, 0.032); p.position.z = 0.032; pg.add(p); }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 8), M(0x8a5a1a)); eye.scale.y = 0.6; head.add(eye);
  return g;
}
