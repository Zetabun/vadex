// CPU profile of a debug scene in headless Chrome: prints the functions with the most self time.
//   node tools/profile.mjs [scene] [seconds]     (needs a local server; PORT env, default 8177; CPU=4 slows it like a phone)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const [scene = 'stress', secs = '8'] = process.argv.slice(2);
const PORT = process.env.PORT || 8177;
const chrome = [String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, '/usr/bin/google-chrome'].find(existsSync);
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=9335', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--user-data-dir=${join(tmpdir(), 'lo-prof')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target; for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch('http://127.0.0.1:9335/json')).json()).find((t) => t.type === 'page'); } catch { /* starting */ } }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Profiler.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: `http://localhost:${PORT}/?debug=1&scene=${scene}` }); await sleep(4000);
if (process.env.CPU) await send('Emulation.setCPUThrottlingRate', { rate: +process.env.CPU }); /* CPU=4: roughly a phone */
await send('Profiler.setSamplingInterval', { interval: 200 }); await send('Profiler.start');
const t0 = await send('Runtime.evaluate', { expression: 'performance.now()', returnByValue: true });
await sleep(+secs * 1000);
const { result: { profile } } = await send('Profiler.stop');
const info = await send('Runtime.evaluate', { expression: `(async () => { const { G } = await import('/modules/core/game.js?v=' + document.querySelector('script[type=importmap]').textContent.match(/v=([0-9.]+)/)[1]); const w = G.world; return { enemies: w.enemies.length, pickups: w.pickups.length, shots: w.shots.length, wave: G.state.run?.wave, frameMs: G.renderer.frameMs }; })()`, awaitPromise: true, returnByValue: true });
const self = new Map(), byId = new Map(profile.nodes.map((n) => [n.id, n])); const dt = new Map();
for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) || 0) + (profile.timeDeltas[i] || 0));
let total = 0; for (const [nid, t] of dt) { const n = byId.get(nid), f = n.callFrame, key = `${f.functionName || '(anon)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + t); total += t; }
console.log('scene', scene, JSON.stringify(info.result.value));
for (const [k, t] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 28)) console.log((t / 1000).toFixed(0).padStart(6) + ' ms ' + (100 * t / total).toFixed(1).padStart(5) + '%  ' + k);
// INCL=1: the game's own functions by inclusive time (their own work and everything they call), per call path collapsed
if (process.env.INCL) {
  const kids = new Map(profile.nodes.map((n) => [n.id, n.children || []])), memo = new Map();
  const incl = (nid) => { if (memo.has(nid)) return memo.get(nid); let t = dt.get(nid) || 0; for (const c of kids.get(nid)) t += incl(c); memo.set(nid, t); return t; };
  const by = new Map(); for (const n of profile.nodes) { const f = n.callFrame; if (!f.url.includes('/modules/')) continue; const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber + 1}`; by.set(key, (by.get(key) || 0) + incl(n.id)); }
  console.log('--- inclusive (game code)'); for (const [k, t] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log((t / 1000).toFixed(0).padStart(6) + ' ms ' + (100 * t / total).toFixed(1).padStart(5) + '%  ' + k);
}
ws.close(); proc.kill();
