// Finds interface that runs off the side of a phone screen: loads debug scenes at a phone's size (W, H: an iPhone 16 by
// default) and lists every element that sticks out past the left or right edge and is not inside something that
// scrolls or clips it, the outermost first (the one to fix). Needs the local server, like tools/shoot.mjs.
//   node tools/overflow.mjs [scene ...]        (PORT, W, H, WAIT env as for shoot.mjs; SHOTS=dir also saves screenshots)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const list = process.argv.slice(2);
const scenes = list.length ? list : ['launch', 'workshop', 'armory', 'ships', 'contracts', 'missions', 'records', 'awards', 'levelup', 'relic', 'notice', 'pause', 'debrief', 'debrief:garden', 'loadout', 'route', 'anomaly', 'fusion', 'synergy', 'overhaul', 'overhaul:4:confirm', 'blueprints', 'aboard:4:card', 'aboard:4:offer', 'backup', 'callsign', 'medal', 'paint', 'caintro', 'newpilot', 'sgdamage', 'garden:bloom', 'comms', 'quarters', 'observatory', 'yard', 'beacons', 'deck', 'hall', 'control'];
const PORT = process.env.PORT || 8177, W = +(process.env.W || 402), H = +(process.env.H || 874), SHOTS = process.env.SHOTS;
const chrome = [String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, '/usr/bin/google-chrome'].find(existsSync);
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=9334', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--user-data-dir=${join(tmpdir(), 'lo-overflow')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch('http://127.0.0.1:9334/json')).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ } }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true });
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
// in the page: what sticks out past the screen's sides, outermost first, ignoring what a scroller or a clip hides
const probe = `(() => {
  const vw = innerWidth, out = [], name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].join('.') : '');
  const hidden = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { const r = a.getBoundingClientRect(); if (r.right <= vw + 1 && r.left >= -1) return true; } } return false; };
  const bad = (e) => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || s.position === 'fixed' && e.id === 'gl') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.right > vw + 1 || r.left < -1) && !hidden(e); };
  for (const e of document.querySelectorAll('#app *, body > *')) { if (e.closest('svg') && e.tagName !== 'svg' || e.tagName === 'CANVAS') continue; if (bad(e) && !(e.parentElement && bad(e.parentElement))) { const r = e.getBoundingClientRect(); out.push({ el: name(e), path: [e.parentElement, e.parentElement?.parentElement].filter(Boolean).map(name).reverse().join(' > '), left: Math.round(r.left), right: Math.round(r.right), text: (e.innerText || '').trim().slice(0, 50).replace(/\\s+/g, ' ') }); } }
  return JSON.stringify({ vw, page: document.documentElement.scrollWidth, out });
})()`;
let problems = 0;
for (const scene of scenes) {
  await send('Page.navigate', { url: `http://localhost:${PORT}/?debug=1&scene=${scene}` });
  await sleep(+(process.env.WAIT || 3500));
  const r = JSON.parse((await send('Runtime.evaluate', { expression: probe, returnByValue: true })).result.result.value);
  if (SHOTS) { const shot = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(resolve(SHOTS, scene.replace(/[^a-z0-9_-]/gi, '-') + '.png'), Buffer.from(shot.result.data, 'base64')); }
  if (!r.out.length && r.page <= r.vw) { console.log(`ok   ${scene}`); continue; }
  problems++; console.log(`OFF  ${scene} (page ${r.page}px wide on a ${r.vw}px screen)`);
  for (const o of r.out) console.log(`       ${o.left}..${o.right}  ${o.el}   in ${o.path}   "${o.text}"`);
}
console.log(problems ? `${problems} screen(s) with something off the side` : 'Nothing off the side');
ws.close(); proc.kill();
