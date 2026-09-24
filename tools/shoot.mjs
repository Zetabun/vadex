// Phone-sized screenshots of game screens through the Chrome DevTools protocol (no npm packages needed; Node 22+).
//   node tools/shoot.mjs <outDir> [scene ...]     (needs a local server; PORT env, default 8177)
// Scenes are defined in modules/ui/debug.js (?debug=1&scene=…) and run in the sandbox save slot.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const [outDir = 'shots', ...list] = process.argv.slice(2);
const scenes = list.length ? list : ['launch', 'workshop', 'armory', 'ships', 'contracts', 'levelup', 'relic', 'notice', 'pause', 'debrief'];
const PORT = process.env.PORT || 8177, W = +(process.env.W || 390), H = +(process.env.H || 844);
const chrome = [String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, '/usr/bin/google-chrome'].find(existsSync);
mkdirSync(outDir, { recursive: true });

const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=9333', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--user-data-dir=${join(tmpdir(), 'lo-shoot')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch('http://127.0.0.1:9333/json')).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ } }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true });
for (const scene of scenes) {
  await send('Page.navigate', { url: `http://localhost:${PORT}/?debug=1&scene=${scene}` });
  await sleep(+(process.env.WAIT || 3500));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = resolve(outDir, scene + '.png'); writeFileSync(file, Buffer.from(shot.result.data, 'base64')); console.log('captured', file);
}
ws.close(); proc.kill();
