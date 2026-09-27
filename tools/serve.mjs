// A static server for local checks that answers byte ranges, as GitHub Pages does, so audio can be sought (python -m
// http.server cannot: a check that jumps to a song's end needs this). Usage: node tools/serve.mjs [port] (default 8179)
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)), port = Number(process.argv[2] || 8179);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.wav': 'audio/wav', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (path.endsWith('/')) path += 'index.html';
  const file = join(root, path); let st; try { st = statSync(file); } catch { res.writeHead(404); res.end(); return; }
  const type = TYPES[extname(file)] || 'application/octet-stream', range = req.headers.range;
  if (range) { const [a, b] = range.replace('bytes=', '').split('-'); const start = +a, end = b ? +b : st.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 }); createReadStream(file, { start, end }).pipe(res); return; }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); createReadStream(file).pipe(res);
}).listen(port, () => console.log('range server on', port));
