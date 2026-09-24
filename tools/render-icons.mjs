// Render icons/icon.svg to the PNG sizes home screens and browsers need, through headless Chrome.
//   node tools/render-icons.mjs        (needs a local server; PORT env, default 8177)
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PORT = process.env.PORT || 8177;
const SIZES = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512, 'favicon-32.png': 32 };
const chrome = [String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, '/usr/bin/google-chrome'].find(existsSync);
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${join(tmpdir(), 'lo-icons')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch('http://127.0.0.1:9334/json')).json()).find((t) => t.type === 'page'); } catch { /* starting */ } }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
for (const [file, size] of Object.entries(SIZES)) {
  await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://localhost:${PORT}/icons/icon.svg` }); await sleep(700);
  await send('Runtime.evaluate', { expression: `document.documentElement.setAttribute('width', ${size}); document.documentElement.setAttribute('height', ${size});` }); await sleep(200);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
  writeFileSync(join('icons', file), Buffer.from(shot.result.data, 'base64')); console.log('wrote icons/' + file);
}
ws.close(); proc.kill();
