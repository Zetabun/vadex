// Performance survey of debug scenes in headless Chrome, at a phone's size with its CPU slowed (CPU env, default 4x):
// per scene, the draw calls and triangles in a frame, the textures and geometries alive, texture uploads a second
// (a canvas texture redrawn and re-sent every frame is costly on a phone), the JS time the renderer spends a frame, and
// the frame rate (software rendering here, so only compare scenes and before/after, never with a phone).
//   node tools/perf.mjs [scene ...]        (needs the local server, as tools/shoot.mjs; PORT, W, H, WAIT, SECS env)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const list = process.argv.slice(2), scenes = list.length ? list : ['launch', 'stress', 'deck', 'garden:wing', 'yard', 'observatory', 'beacons', 'comms', 'hall', 'control', 'quarters'];
const PORT = process.env.PORT || 8177, W = +(process.env.W || 393), H = +(process.env.H || 852), CPU = +(process.env.CPU || 4), SECS = +(process.env.SECS || 3);
const chrome = [String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, '/usr/bin/google-chrome'].find(existsSync);
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=9336', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--user-data-dir=${join(tmpdir(), 'lo-perf')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target; for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch('http://127.0.0.1:9336/json')).json()).find((t) => t.type === 'page'); } catch { /* starting */ } }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
const probe = (secs) => `(async () => {
  const G = window.__lo?.G, r = G?.renderer; if (!r) return JSON.stringify({ err: 'no renderer' });
  const ctx = r.gl.getContext(); let uploads = 0; const wrap = (k) => { const f = ctx[k]; ctx[k] = function (...a) { uploads++; return f.apply(this, a); }; return () => { ctx[k] = f; }; };
  const undo = [wrap('texImage2D'), wrap('texSubImage2D')]; let frames = 0, worst = 0, last = performance.now(), js = 0, calls = 0; const t0 = last;
  const orig = r.render; r.render = function (...a) { const t = performance.now(); const v = orig.apply(this, a); js += performance.now() - t; calls++; return v; };
  await new Promise((done) => { const f = (now) => { frames++; worst = Math.max(worst, now - last); last = now; if (now - t0 < ${secs} * 1000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
  undo.forEach((u) => u()); r.render = orig; const i = r.gl.info, s = (performance.now() - t0) / 1000;
  return JSON.stringify({ calls: i.render.calls, tris: i.render.triangles, tex: i.memory.textures, geo: i.memory.geometries, progs: i.programs?.length, up: Math.round(uploads / s), fps: Math.round(frames / s), worst: Math.round(worst), js: +(js / Math.max(1, calls)).toFixed(2), heap: Math.round((performance.memory?.usedJSHeapSize || 0) / 1048576) });
})()`;
console.log(`${W}x${H}, CPU slowed ${CPU}x`);
console.log('scene'.padEnd(18) + 'calls  tris     tex  geo  progs  uploads/s  js ms/frame  fps  worst ms  heap MB');
for (const scene of scenes) {
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await send('Page.navigate', { url: `http://localhost:${PORT}/?debug=1&scene=${scene}` }); await sleep(+(process.env.WAIT || 4500));
  await send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const r = JSON.parse((await send('Runtime.evaluate', { expression: probe(SECS), awaitPromise: true, returnByValue: true })).result.result.value);
  if (r.err) { console.log(scene.padEnd(18) + r.err); continue; }
  console.log(scene.padEnd(18) + String(r.calls).padEnd(7) + String(r.tris).padEnd(9) + String(r.tex).padEnd(5) + String(r.geo).padEnd(5) + String(r.progs).padEnd(7) + String(r.up).padEnd(11) + String(r.js).padEnd(13) + String(r.fps).padEnd(5) + String(r.worst).padEnd(10) + r.heap);
}
ws.close(); proc.kill();
