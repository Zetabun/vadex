// Looking after the global boards from the command line (through wrangler, so only whoever is logged in to the
// Cloudflare account can do it). Run from the repository root:
//   node api/admin.mjs stats                 players, today's and the week's, and every board's size
//   node api/admin.mjs top [board] [n]       a board's top n with each pilot's id (board: all, or daily:2026-09-26)
//   node api/admin.mjs ban <id>              take a pilot off every board; their later posts are dropped
//   node api/admin.mjs unban <id>
//   node api/admin.mjs rename <id>           reset a pilot's shown name (to Pilot, with their tag) and station, for good
//   node api/admin.mjs role <id|name> <dev|mod|none>   the tag beside a pilot's name (a name must match one pilot only)
// Add --local to work on `wrangler dev`'s local database instead of the live one.
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2), local = args.includes('--local'), [cmd, a, b] = args.filter((x) => x !== '--local');
const PID = /^[0-9a-f]{32}$/, BOARD = /^(all|daily:\d{4}-\d{2}-\d{2})$/;
function sql(command) {
  const win = process.platform === 'win32'; /* Windows runs npx through its shell, which splits an unquoted command at every space */
  const out = execFileSync('npx', ['--yes', 'wrangler', 'd1', 'execute', 'last-orbit', local ? '--local' : '--remote', '--json', '--command', win ? `"${command.replace(/"/g, '""')}"` : command], { cwd: new URL('.', import.meta.url), encoding: 'utf8', shell: win, stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out.slice(out.indexOf('['))).flatMap((r) => r.results || []);
}
const id = (x) => { if (!PID.test(x || '')) throw new Error('an id is 32 hex characters (see: top)'); return x; };
const day = (off = 0) => new Date(Date.now() + off * 864e5).toISOString().slice(0, 10);

if (cmd === 'stats') {
  const [p] = sql('SELECT COUNT(*) AS players, SUM(banned) AS banned FROM players');
  const days = sql(`SELECT day, COUNT(*) AS n FROM days WHERE day >= '${day(-6)}' GROUP BY day ORDER BY day`);
  console.log(`Pilots: ${p.players} (${p.banned || 0} banned)`);
  console.log('Using the boards by day (UTC): ' + (days.map((d) => `${d.day} ${d.n}`).join(' · ') || 'none yet'));
  console.table(sql('SELECT board, n FROM boards ORDER BY board DESC LIMIT 12'));
} else if (cmd === 'top') {
  const board = a || 'all', n = Math.min(200, +b || 20); if (!BOARD.test(board)) throw new Error('board: all, or daily:YYYY-MM-DD');
  console.table(sql(`SELECT s.score, s.wave, s.ship, s.threat, s.warp, s.kills, s.time, p.name, p.tag, p.station, p.pid FROM scores s JOIN players p ON p.pid = s.pid WHERE s.board = '${board}' ORDER BY s.score DESC, s.at ASC LIMIT ${n}`));
} else if (cmd === 'ban') {
  const pid = id(a);
  sql(`UPDATE boards SET n = n - 1 WHERE board IN (SELECT board FROM scores WHERE pid = '${pid}'); DELETE FROM scores WHERE pid = '${pid}'; UPDATE players SET banned = 1 WHERE pid = '${pid}'`);
  console.log('Banned and taken off the boards: ' + pid);
} else if (cmd === 'unban') {
  sql(`UPDATE players SET banned = 0 WHERE pid = '${id(a)}'`); console.log('Unbanned (their next post counts again): ' + a);
} else if (cmd === 'rename') {
  const pid = id(a); sql(`UPDATE players SET name = 'Pilot', nkey = 'pilot', station = '', locked = 1 WHERE pid = '${pid}'`); console.log('Name reset: ' + pid);
} else if (cmd === 'role') {
  const role = b === 'none' ? '' : b; if (!['dev', 'mod', ''].includes(role ?? 'x')) throw new Error('role: dev, mod or none');
  let pid = PID.test(a || '') ? a : null;
  if (!pid) { const key = String(a || '').toLowerCase().replace(/'/g, "''"); const found = sql(`SELECT pid, name, tag, station, posts FROM players WHERE nkey = '${key}'`); if (found.length !== 1) { console.table(found); throw new Error(found.length ? 'more than one pilot has that name: use their id' : 'no pilot has that name'); } pid = found[0].pid; }
  sql(`UPDATE players SET role = '${role}' WHERE pid = '${pid}'`); console.log(`Role ${role || 'none'} set for ${pid}`);
} else {
  console.log('node api/admin.mjs stats | top [board] [n] | ban <id> | unban <id> | rename <id> | role <id|name> <dev|mod|none>   (--local for wrangler dev)');
}
