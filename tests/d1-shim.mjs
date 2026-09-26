// A stand-in for Cloudflare D1 over node:sqlite, with the global boards' schema (api/schema.sql) loaded: enough of D1
// (prepare, bind, first, all, run, batch) for the worker in api/src/index.js to run in the regression tests.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../api/schema.sql', import.meta.url), 'utf8'));
  const vals = (a) => a.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...vals(args)) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...vals(args)) }),
    run: async () => ({ meta: { changes: db.prepare(sql).run(...vals(args)).changes } }),
    exec: () => db.prepare(sql).run(...vals(args)),
  });
  const DB = { prepare: (sql) => stmt(sql), batch: async (list) => { db.exec('BEGIN'); try { const r = list.map((s) => s.exec()); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } } };
  return { db, env: { DB } };
}
